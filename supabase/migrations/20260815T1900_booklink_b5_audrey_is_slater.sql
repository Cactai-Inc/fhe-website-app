-- BOOKLINK B5 follow-up — owner ruling: "Audrey 2/4" is Audrey Slater (2026-08-15).
--
-- TASK-BOOKLINK-REPORT.md flagged this as the last of the 3 unresolved rows: two
-- candidate contacts named "Audrey" (Slater = has a client row / Brennan = does
-- not). Resolved by evidence, not a guess, before the owner ruled: Audrey
-- Brennan's contact record wasn't created until 2026-07-30 (as a LEAD, no
-- client row) — ten days AFTER this booking's 2026-07-20 date — so she cannot
-- be the "Audrey" the note names. Audrey Slater already has a linked booking
-- "Lesson 4/4" (2026-08-03, same client) — the same fraction-of-4 lesson-count
-- convention as "Audrey 2/4", consistent with one 4-lesson package. Owner
-- confirmed the link directly.
--
-- This is the last of the original 14 NULL-client lesson bookings: after this,
-- zero remain, and bookings_lesson_requires_client (20260815T1500) can be
-- VALIDATE CONSTRAINT'd table-wide.

UPDATE bookings SET client_id = '13a59482-0ec3-4950-9f01-a6a1b5718770', updated_at = now()
 WHERE id = 'a2351861-4340-41b8-914f-4178ed662958' AND client_id IS NULL; -- "Audrey 2/4"

DO $verify$
DECLARE v_linked boolean; v_remaining int;
BEGIN
  SELECT (client_id = '13a59482-0ec3-4950-9f01-a6a1b5718770') INTO v_linked
    FROM bookings WHERE id = 'a2351861-4340-41b8-914f-4178ed662958';
  SELECT count(*) INTO v_remaining FROM bookings
   WHERE kind = 'lesson' AND client_id IS NULL AND is_flexible = false AND status <> 'draft';
  IF NOT coalesce(v_linked, false) THEN
    RAISE EXCEPTION 'BOOKLINK B5 (audrey=slater): link did not land';
  END IF;
  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'BOOKLINK B5 (audrey=slater): expected 0 rows still unlinked, got %', v_remaining;
  END IF;
  RAISE NOTICE 'BOOKLINK B5: complete — all 14 original NULL-client lesson bookings now linked';
END
$verify$;

-- ── validate the B1 constraint table-wide — the last unresolved row is gone ──
ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_lesson_requires_client;
