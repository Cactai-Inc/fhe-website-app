-- BOOKLINK B5 follow-up — owner ruling: "maddie is madeline" (2026-08-15).
--
-- TASK-BOOKLINK-REPORT.md flagged "Maddie 7/8" / "Maddie 8/8" as a plausible
-- but unconfirmed nickname match to contact "Madeline Do" (client
-- e275f036-574a-455a-aeb0-7bd0d3c85f11) rather than link it on a guess. The
-- owner has now confirmed the match directly. Links the last 2 of the
-- session's remaining 3 unresolved rows — "Audrey 2/4" (Slater vs Brennan)
-- is still open and NOT touched here.

UPDATE bookings SET client_id = 'e275f036-574a-455a-aeb0-7bd0d3c85f11', updated_at = now()
 WHERE id IN (
   '5b4ebb51-a967-428c-9cdb-1628da65eed3', -- Maddie 7/8
   'a7fae8f9-a96f-4641-b37c-e2d8cd40f4fc'  -- Maddie 8/8
 ) AND client_id IS NULL;

DO $verify$
DECLARE v_linked int; v_remaining int;
BEGIN
  SELECT count(*) INTO v_linked FROM bookings
   WHERE id IN ('5b4ebb51-a967-428c-9cdb-1628da65eed3','a7fae8f9-a96f-4641-b37c-e2d8cd40f4fc')
     AND client_id = 'e275f036-574a-455a-aeb0-7bd0d3c85f11';
  SELECT count(*) INTO v_remaining FROM bookings
   WHERE kind = 'lesson' AND client_id IS NULL AND is_flexible = false AND status <> 'draft';
  IF v_linked <> 2 THEN
    RAISE EXCEPTION 'BOOKLINK B5 (maddie=madeline): expected 2 rows linked, got %', v_linked;
  END IF;
  IF v_remaining <> 1 THEN
    RAISE EXCEPTION 'BOOKLINK B5 (maddie=madeline): expected exactly 1 row still unlinked (Audrey 2/4), got %', v_remaining;
  END IF;
  RAISE NOTICE 'BOOKLINK B5: Maddie x2 linked to Madeline Do; only Audrey 2/4 remains open';
END
$verify$;
