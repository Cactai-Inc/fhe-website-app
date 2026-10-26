-- disc_46 (fix round item 5a + 5d). Single transaction.
--   5a: horse_locations gains sub_location (barn / stall / paddock — free text).
--   5d: a fair market value of 0 is not a value, it is "unknown". Null the one
--       existing 0 (Sundance), and make both horse RPCs store NULL for a 0 (or
--       blank) fmv so a 0 can never be written again. The UI renders a null fmv
--       as blank / "Needs update", never $0.
--
-- The two RPC bodies are large; rather than re-emit them (and risk drift against
-- disc_38), this rewrites ONLY the fmv expression in each, in place: read the live
-- body, wrap the existing nullif(...)::numeric in nullif(..., 0), re-execute. If
-- the expected substring is not found the migration RAISEs, so a drifted body
-- fails loudly instead of silently no-opping.

BEGIN;

-- 5a: the column.
ALTER TABLE horse_locations ADD COLUMN IF NOT EXISTS sub_location text;

-- 5d: null the existing zero.
UPDATE horses SET fair_market_value = NULL, updated_at = now()
 WHERE deleted_at IS NULL AND fair_market_value = 0;

-- 5d: create_horse_record — wrap the fmv VALUES expression so 0 stores as NULL.
DO $mig$
DECLARE
  v_src text := pg_get_functiondef('public.create_horse_record(jsonb)'::regprocedure);
  v_old text := 'nullif(replace(replace(coalesce(p ->> ''fair_market_value'', ''''), ''$'', ''''), '','', ''''), '''')::numeric';
  v_new text := 'nullif(nullif(replace(replace(coalesce(p ->> ''fair_market_value'', ''''), ''$'', ''''), '','', ''''), '''')::numeric, 0)';
BEGIN
  IF position(v_old in v_src) = 0 THEN
    RAISE EXCEPTION 'create_horse_record fmv expression not found — body drifted, aborting';
  END IF;
  EXECUTE replace(v_src, v_old, v_new);
END $mig$;

-- 5d: update_horse_record — same wrap on its fmv CASE expression.
DO $mig$
DECLARE
  v_src text := pg_get_functiondef('public.update_horse_record(uuid, jsonb)'::regprocedure);
  v_old text := 'nullif(regexp_replace(coalesce(p ->> ''fair_market_value'',''''),''[$,\s]'','''',''g''),'''')::numeric';
  v_new text := 'nullif(nullif(regexp_replace(coalesce(p ->> ''fair_market_value'',''''),''[$,\s]'','''',''g''),'''')::numeric, 0)';
BEGIN
  IF position(v_old in v_src) = 0 THEN
    RAISE EXCEPTION 'update_horse_record fmv expression not found — body drifted, aborting';
  END IF;
  EXECUTE replace(v_src, v_old, v_new);
END $mig$;

COMMIT;
