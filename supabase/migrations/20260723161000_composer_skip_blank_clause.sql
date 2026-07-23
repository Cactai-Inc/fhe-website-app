-- Composer: skip a headingless clause whose rendered body is entirely blank.
--
-- A control-toggle clause (body is just a control token like {{TXN.*_INCLUDE}},
-- which renders empty) was still getting a clause number and printing an empty
-- "10.1" line. The empty-clause skip only fired when the line buffer was length 0,
-- but a control token appends an empty string (length 1). Now also skip when the
-- buffer holds no NON-BLANK line.
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('remerge_contract_from_clauses'::regproc);
  v_def := replace(v_def,
    'IF (v_cl.heading IS NULL OR v_cl.heading = '''') AND coalesce(array_length(v_cl_buf,1),0) = 0 THEN CONTINUE; END IF;',
    'IF (v_cl.heading IS NULL OR v_cl.heading = '''')'
    || ' AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(v_cl_buf, ARRAY[]::text[])) x WHERE btrim(x) <> '''')'
    || ' THEN CONTINUE; END IF;');
  IF v_def NOT LIKE '%WHERE btrim(x)%' THEN
    RAISE EXCEPTION 'composer: empty-clause skip line not found';
  END IF;
  EXECUTE v_def;
END $mig$;
