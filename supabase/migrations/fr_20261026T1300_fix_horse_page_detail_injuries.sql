-- Fix round 3 (found while browser-proving items 1/6) — horse_page_detail omitted
-- injuries_to_horse from the record payload, so HorseRecord.tsx reads
-- r.injuries_to_horse.length on undefined and the whole record page crashes blank
-- for every horse. Add the jsonb column to the record object (coalesced to []).
--
-- In-place: read the live body, insert the one key beside injuries_to_humans.

BEGIN;

DO $mig$
DECLARE
  v_src text := pg_get_functiondef('public.horse_page_detail(uuid)'::regprocedure);
  v_old text := '''injuries_to_humans'', v_h.injuries_to_humans,';
  v_new text := '''injuries_to_humans'', v_h.injuries_to_humans,
      ''injuries_to_horse'', coalesce(v_h.injuries_to_horse, ''[]''::jsonb),';
BEGIN
  IF position(v_old in v_src) = 0 THEN RAISE EXCEPTION 'horse_page_detail injuries anchor not found'; END IF;
  IF position('''injuries_to_horse''' in v_src) > 0 THEN
    RAISE NOTICE 'injuries_to_horse already present; no change'; RETURN;
  END IF;
  v_src := replace(v_src, v_old, v_new);
  EXECUTE v_src;
END $mig$;

COMMIT;
