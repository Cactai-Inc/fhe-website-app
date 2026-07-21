/*
  # contract_template_structure — expose clause body

  The authoring UI now renders each clause's full legal prose with input controls
  dropped inline at each {{token}}. That needs the clause body, which the structure
  read model didn't return. Add it (targeted ASCII-safe replace).
*/
DO $patch$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname='contract_template_structure';
  v_new := replace(v_def,
    E'''clause_key'', c.clause_key,\n            ''heading'', c.heading,',
    E'''clause_key'', c.clause_key,\n            ''heading'', c.heading,\n            ''body'', c.body,');
  IF v_new = v_def THEN RAISE EXCEPTION 'clause block not found in contract_template_structure'; END IF;
  EXECUTE v_new;
END $patch$;
