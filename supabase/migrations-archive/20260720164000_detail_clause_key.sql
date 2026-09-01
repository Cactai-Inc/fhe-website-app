/*
  # Detail RPC — expose clause_key + responsibility_kind (Pass I-c)

  The Section›Clause›Field UI needs each field's clause membership and (for party
  fields) its responsibility_kind. Add both to contract_document_detail's per-field
  jsonb via a targeted server-side replace of the field block (the function is pure
  ASCII, so no round-trip corruption risk). Everything else is unchanged.
*/

DO $patch$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname='contract_document_detail';
  IF v_def IS NULL THEN RAISE EXCEPTION 'contract_document_detail not found'; END IF;

  -- insert the two keys right after 'section' in the field jsonb_build_object
  v_new := replace(
    v_def,
    E'''field_key'', cf.field_key, ''label'', cf.label, ''section'', cf.section,',
    E'''field_key'', cf.field_key, ''label'', cf.label, ''section'', cf.section,\n'
    || E'          ''clause_key'', cf.clause_key, ''responsibility_kind'', cf.responsibility_kind,'
  );

  IF v_new = v_def THEN
    RAISE EXCEPTION 'field block not found in contract_document_detail — shape changed';
  END IF;

  EXECUTE v_new;
END
$patch$;
