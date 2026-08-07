/*
  # TASK LEASEFORK — corrective: clone_contract_template was reachable by anon

  Defect introduced by 20260807120000 (this task, Phase 1) and found during Phase 3
  while diffing function ACLs. Two facts compounded:

  1. `pg_default_acl` on this database grants EXECUTE on every NEW function in
     `public` to anon, authenticated and service_role:

         grantor  | schema | objtype |                        defaclacl
         postgres | public |    f    | {postgres=X/postgres,anon=X/postgres,
                                       authenticated=X/postgres,service_role=X/postgres}

     `REVOKE ALL ... FROM public` does NOT remove a grant held by the ROLE `anon` —
     PUBLIC and anon are different grantees. So the original REVOKE/GRANT pair left
     anon holding EXECUTE.

  2. The guard was written as

         IF auth.uid() IS NOT NULL AND NOT is_admin() THEN RAISE ...

     i.e. "a NULL auth.uid() means a trusted direct psql/migration session." That is
     false: an anonymous PostgREST request ALSO has a NULL auth.uid(). The guard
     therefore passed for anon, and the function is SECURITY DEFINER, so it ran as
     postgres and bypassed RLS.

  Proven live before this fix (in a rolled-back transaction):

      SET LOCAL ROLE anon;
      SELECT current_user, auth.uid(), is_admin();   -->  anon | (null) | f
      SELECT clone_contract_template('HORSE_LEASE_V2','ANON_PROOF_OF_CONCEPT','anon reached it');
      -->  {"fields":117,"clauses":144,"sections":22, ... "template_key":"ANON_PROOF_OF_CONCEPT"}

  An unauthenticated caller could mint contract templates. No data was exposed and
  nothing existing could be modified (the function only ever INSERTs, and refuses an
  existing key), but it was writable surface that should never have been open.

  Fixed at two layers:

  * Grant layer (primary): EXECUTE revoked from anon and authenticated, so PostgREST
    cannot reach the function at all — the request fails before any function body
    runs. There is no template-authoring UI, and this task did not add one, so no
    application caller loses anything. Migrations connect as postgres, which owns
    the function and does not need a grant.

  * Guard layer (defence in depth): deny by default. Trusted direct access is now
    identified by `session_user`, which inside a SECURITY DEFINER function still
    reports the real session role (unlike `current_user`, which reports the function
    OWNER and is therefore useless as a caller check here). PostgREST sessions
    connect as `authenticator`; migrations connect as `postgres`.

  Only the guard and the grants change. The copy logic is untouched, and the three
  forks already created by 20260807121000 are unaffected — this does not re-run any
  clone.
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
  -- Deny by default. A NULL auth.uid() is NOT evidence of a trusted caller: the
  -- anon role has one too. Direct psql/migration access is identified by
  -- session_user (SECURITY DEFINER leaves session_user as the real session role).
  IF NOT (is_admin() OR session_user IN ('postgres', 'supabase_admin')) THEN
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

-- anon and authenticated must be named explicitly: they hold EXECUTE via
-- pg_default_acl, and REVOKE ... FROM public does not reach a role grant.
REVOKE ALL ON FUNCTION public.clone_contract_template(text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.clone_contract_template(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.clone_contract_template(text, text, text) FROM authenticated;
