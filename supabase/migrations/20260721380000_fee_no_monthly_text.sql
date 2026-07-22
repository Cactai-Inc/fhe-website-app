-- Fee schedule: drop the hardcoded "due on the first day of each month." — the
-- fee is just the amount + optional notes.
DO $do$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('compose_field_prose'::regproc);
  v_def := replace(v_def, '''$'' || v_amt', '''$'' || v_amt');  -- no-op guard
  v_def := replace(v_def, 'v_out := v_amt || '' due on the first day of each month.'';', 'v_out := v_amt || ''.'';');
  EXECUTE v_def;
END $do$;
