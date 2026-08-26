-- TASK-VERSIONSPINE — the two remaining ways a version table could be reached
-- without going through the save path.
--
-- 1. A CLONED TEMPLATE STARTED WITH AN EMPTY HISTORY.
-- clone_contract_template inserts a new contract_templates row at version 1 with
-- a full composition copied from its source, and wrote no version row. It would
-- have self-healed on its first publish (the save path retains the outgoing state
-- before minting), but until then the new template had a version number and
-- nowhere to read that version from — the exact condition §2 of the handoff says
-- no template may be in.
--
-- ⚠️ This is the ONE place a version row is written outside save_*, and it is a
-- CREATION rather than a save: there is no previous state to supersede, and
-- routing it through the save path would mint v2 for a template that has never
-- been edited. Everything that CHANGES a template still goes through save.
create or replace function clone_contract_template(p_source_key text, p_new_key text, p_new_title text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_new_id     uuid;
  v_sections   int;
  v_clauses    int;
  v_fields     int;
BEGIN
  -- Deny by default. A NULL auth.uid() is NOT evidence of a trusted caller: the
  -- anon role has one too. Direct psql/migration access is identified by
  -- session_user (SECURITY DEFINER leaves session_user as the real session role).
  IF NOT coalesce(is_admin() OR session_user IN ('postgres', 'supabase_admin'), false) THEN
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

  -- 5. v1 of the clone, retained whole, so it does not start with a version
  --    number and no version to read (TASK-VERSIONSPINE).
  INSERT INTO contract_template_versions
    (template_key, version, title, body, composition, parent_version, edited_by)
  SELECT p_new_key, 1, p_new_title, t.body,
         capture_contract_template_composition(p_new_key), NULL, auth.uid()
    FROM contract_templates t WHERE t.template_key = p_new_key;

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

-- 2. THE CONTENT-BLOCK HISTORY WAS DIRECTLY WRITABLE FROM THE CLIENT.
-- content_block_versions carried an ALL policy for admins, so an admin's own
-- session could INSERT a version row straight through PostgREST — no parent
-- stamp, no pointer update, no number the save path agreed to. UPDATE and DELETE
-- are already refused by the append-only trigger; this closes INSERT.
-- Reading stays exactly as it was: org-wide SELECT, which is what
-- contentStore.getContentBlockRaw uses to show a version in the editor.
-- The three history tables now agree: read through RLS, write only through the
-- SECURITY DEFINER save path.
drop policy if exists content_versions_admin on content_block_versions;
