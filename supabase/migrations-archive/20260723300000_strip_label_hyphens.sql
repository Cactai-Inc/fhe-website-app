-- Composer: broaden the blank-labeled-line strip so labels with hyphens,
-- parentheses, or apostrophes (e.g. "Co-owners:", "Other owner(s):") are also
-- recognized and dropped when their token is empty — previously only pure-alpha
-- labels stripped, so a hyphenated label left an empty "Label:" line behind.
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('remerge_contract_from_clauses'::regproc);
  v_def := replace(v_def,
    'v_stripped := regexp_replace(v_stripped, ''^\s*([[:alpha:]]+[[:space:]]*){1,5}:\s*'', '''');',
    'v_stripped := regexp_replace(v_stripped, ''^\s*[[:alpha:]][[:alpha:] ''''()/-]{0,60}:\s*'', '''');');
  IF v_def NOT LIKE '%[[:alpha:] ''''()/-]%' THEN RAISE EXCEPTION 'composer: label-strip regex not found'; END IF;
  EXECUTE v_def;
END $mig$;
