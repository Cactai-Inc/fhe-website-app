/*
  # Detail RPC — expose template_key (Pass III)
  So the UI can fetch the clause structure for clause-model documents.
*/
DO $patch$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname='contract_document_detail';
  v_new := replace(v_def,
    E'''document_id'', d.id, ''title'', d.title, ''status'', d.status,',
    E'''document_id'', d.id, ''title'', d.title, ''status'', d.status,'
    || E' ''template_key'', (SELECT ct.template_key FROM contract_templates ct WHERE ct.id = d.template_id),');
  IF v_new = v_def THEN RAISE EXCEPTION 'document block not found'; END IF;
  EXECUTE v_new;
END $patch$;
