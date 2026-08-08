/*
  # TASK LEASEFORK — Phase 1: clone_contract_template()

  A reusable, faithful deep-copy of a contract template. Forking a template is the
  only safe way to iterate on lease content: `documents.template_id` is a FK to
  `contract_templates.id` (ON DELETE RESTRICT), so editing a template in place
  changes the definition behind documents already signed against it. A clone gets a
  new id, so live documents keep pointing at the row they were authored from.

  Copies exactly four tables, in one transaction:
    contract_templates -> contract_section_defs -> contract_clause_defs
                       -> contract_field_defs

  Verified live 2026-08-06/07 against HORSE_LEASE_V2: every other table that keys on
  a template (template_variants, contract_requirements, contract_role_documents,
  category_document_requirements, contact_required_documents,
  template_version_events, and template_tokens — which keys on template_id and was
  not in the original ground-truth list) holds ZERO rows for it. The function
  therefore copies four tables and no more. If a future source template carries such
  rows, this function will silently not copy them; that is a deliberate limit of
  scope, not a claim that they never matter.

  Fidelity contract — the whole point of the function:
    * section_key / clause_key / field_key are preserved VERBATIM. They are
      namespaced by template_key (each of the three def tables has a
      UNIQUE (template_key, *_key) constraint), so `conditional_on` gates that
      reference sibling keys copy across unchanged and keep resolving inside the
      clone. Renaming or re-prefixing anything would break every gate.
    * conditional_on, options, responsibility (jsonb) copy by value, unchanged.
    * clause/field bodies and labels copy byte-identical — no trim, no normalisation.
    * sort_order is preserved exactly.

  Safety:
    * Refuses if p_new_key already exists. It never merges into, or overwrites, an
      existing template. (The UNIQUE constraint on template_key would catch the
      contract_templates row anyway, but the explicit check gives a clear error and
      also protects against orphan def rows left under that key.)
    * Refuses if the source does not exist.
    * SECURITY DEFINER because contract_section_defs / contract_clause_defs carry
      SELECT-only RLS policies (no write policy at all), so even an admin cannot
      insert into them under RLS. Callers are gated to admins; auth.uid() IS NULL is
      the direct-psql/migration path, the same convention profiles_role_guard uses.

  Returns a jsonb receipt with the new id and the per-table row counts copied, so a
  caller can assert on the numbers rather than trust them.
*/

CREATE OR REPLACE FUNCTION public.clone_contract_template(
  p_source_key text,
  p_new_key    text,
  p_new_title  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_id     uuid;
  v_sections   int;
  v_clauses    int;
  v_fields     int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'not authorized to clone a contract template';
  END IF;

  IF p_source_key IS NULL OR p_new_key IS NULL OR p_new_title IS NULL THEN
    RAISE EXCEPTION 'source key, new key and new title are all required';
  END IF;
  IF p_source_key = p_new_key THEN
    RAISE EXCEPTION 'cannot clone % onto itself', p_source_key;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM contract_templates WHERE template_key = p_source_key) THEN
    RAISE EXCEPTION 'source template % does not exist', p_source_key;
  END IF;

  -- Refuse rather than merge. Check the template row AND any stray def rows under
  -- the target key, so a half-cleaned key cannot be silently completed.
  IF EXISTS (SELECT 1 FROM contract_templates    WHERE template_key = p_new_key)
     OR EXISTS (SELECT 1 FROM contract_section_defs WHERE template_key = p_new_key)
     OR EXISTS (SELECT 1 FROM contract_clause_defs  WHERE template_key = p_new_key)
     OR EXISTS (SELECT 1 FROM contract_field_defs   WHERE template_key = p_new_key) THEN
    RAISE EXCEPTION 'template key % already exists; clone refuses to merge or overwrite', p_new_key;
  END IF;

  -- 1. the template row: new id (default), new key, new title, version reset to 1.
  --    Everything else copies verbatim; deleted_at/deleted_by start clean.
  INSERT INTO contract_templates (
    template_key, title, service_type, party_namespaces, body,
    version, active, wall_gating, contract_kind
  )
  SELECT p_new_key, p_new_title, t.service_type, t.party_namespaces, t.body,
         1, t.active, t.wall_gating, t.contract_kind
    FROM contract_templates t
   WHERE t.template_key = p_source_key
  RETURNING id INTO v_new_id;

  -- 2. sections
  INSERT INTO contract_section_defs (
    template_key, section_key, heading, sort_order, is_optional, cut_name, guidance
  )
  SELECT p_new_key, s.section_key, s.heading, s.sort_order, s.is_optional,
         s.cut_name, s.guidance
    FROM contract_section_defs s
   WHERE s.template_key = p_source_key
   ORDER BY s.sort_order, s.section_key;
  GET DIAGNOSTICS v_sections = ROW_COUNT;

  -- 3. clauses  (conditional_on copies by value; keys stay verbatim)
  INSERT INTO contract_clause_defs (
    template_key, section_key, clause_key, heading, body, clause_type, sort_order,
    is_optional, cut_name, conditional_on, guidance, render_as_subitem
  )
  SELECT p_new_key, c.section_key, c.clause_key, c.heading, c.body, c.clause_type,
         c.sort_order, c.is_optional, c.cut_name, c.conditional_on, c.guidance,
         c.render_as_subitem
    FROM contract_clause_defs c
   WHERE c.template_key = p_source_key
   ORDER BY c.section_key, c.sort_order, c.clause_key;
  GET DIAGNOSTICS v_clauses = ROW_COUNT;

  -- 4. fields  (parent_field_key / clause_key are intra-template references and
  --    stay verbatim so they resolve inside the clone)
  INSERT INTO contract_field_defs (
    template_key, field_key, parent_field_key, label, section, owner_role,
    input_kind, value_type, options, conditional_on, guidance, required,
    is_optional, responsibility, sort_order, format_type, clause_key,
    responsibility_kind, closed
  )
  SELECT p_new_key, f.field_key, f.parent_field_key, f.label, f.section, f.owner_role,
         f.input_kind, f.value_type, f.options, f.conditional_on, f.guidance, f.required,
         f.is_optional, f.responsibility, f.sort_order, f.format_type, f.clause_key,
         f.responsibility_kind, f.closed
    FROM contract_field_defs f
   WHERE f.template_key = p_source_key
   ORDER BY f.sort_order, f.field_key;
  GET DIAGNOSTICS v_fields = ROW_COUNT;

  RETURN jsonb_build_object(
    'template_id', v_new_id,
    'template_key', p_new_key,
    'source_key',  p_source_key,
    'sections', v_sections,
    'clauses',  v_clauses,
    'fields',   v_fields
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.clone_contract_template(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.clone_contract_template(text, text, text) TO authenticated;
