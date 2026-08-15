-- BOOKLINK B1 + B5 — the client pointer becomes required, and the backfill
-- that makes existing data able to carry it.
--
-- MEASURED 2026-08-15 (docs/tasks/TASK-BOOKLINK-bookings-linked-debited-and-monthly.md):
-- 14 of 39 real scheduled lessons have client_id NULL. 278 more NULLs are open
-- availability slots (status='available', is_flexible=true) — correct, left alone.
--
-- Backfill runs FIRST so the constraint added after it does not immediately
-- start life violating 14 rows. Names → contacts/clients resolved by direct
-- query against prod during this session (all six-plus name variants matched
-- exactly one contact each — no fuzzy/nickname guessing):
--
--   Melanie O'Mea-Smith  (client acf50c76-e1e1-4772-abfe-1d377bccde83) × 6 rows
--   Marissa Robertson    (client 3549ec1c-508d-42a9-98ee-5f08fec6120c) × 1 row
--   Serena Lee           (client 2c096857-0593-4e3e-a810-3628684fdb9d) × 1 row
--   = the orchestrator's "8-row" unambiguous set named in the spec.
--
--   Naomi Pouliot, Hannah Dryden, Gabriella Olenik exist as CONTACTS with no
--   client row (confirmed, re-queried this session). Naomi/Hannah have email
--   on file → _ensure_client_account (the contact-side account spine, per
--   CLAUDE.md) creates their client row with no side effects (no p_template_keys
--   passed → apply_category_documents is skipped for an existing contact with
--   no categories supplied; no email is sent by this function). Gabriella has
--   NO email on file, so _ensure_client_account (which requires one) cannot run
--   for her — a plain INSERT INTO clients is the same write the spine itself
--   would perform once a contact is already resolved (see its own fallback
--   branch), not a second implementation.
--
-- LEFT UNLINKED, flagged for the owner (never guess a link — traps section):
--   "Maddie 7/8" / "Maddie 8/8" — the spec says this name "matches nothing".
--   Re-checked this session: a contact "Madeline Do" *does* exist with a client
--   row (e275f036-574a-455a-aeb0-7bd0d3c85f11) and "Maddie" is a common
--   nickname for Madeline — but a nickname match is not an unambiguous one.
--   Flagged in the report as a candidate, not linked here.
--   "Audrey 2/4" — two candidates, exactly as the spec states: Audrey Slater
--   (has a client row, 13a59482-0ec3-4950-9f01-a6a1b5718770) vs Audrey Brennan
--   (contact only, no client row). Owner ruling pending; not linked here.
--
-- These 3 rows are why the constraint below is added NOT VALID: they exist,
-- are real historical bookings, and cannot be validated without a guess. NOT
-- VALID still enforces the rule on every future INSERT/UPDATE (including any
-- future edit of these 3 rows) — it only skips the initial full-table scan.

-- ── B5: the 8 unambiguous links ────────────────────────────────────────────
-- By id, not by note text: "Melanie 3/8" is written on TWO different bookings
-- (2026-08-07, already correctly linked, and 2026-08-15, the NULL one below) —
-- exactly the note-drift FLOWTRACE §11 flagged. Matching by id keeps the
-- pre-existing correct row untouched and links only the one that was NULL.
UPDATE bookings SET client_id = 'acf50c76-e1e1-4772-abfe-1d377bccde83', updated_at = now()
 WHERE id IN (
   '7f3212cd-1f2f-4841-8f3f-bdb00b05b9f8', -- Melanie lesson 1/8
   'c7762a6f-9be9-499f-9b79-9e8a779fe297', -- Melanie 2/8
   '80daf959-0dd1-4d20-9ee4-df2ff16a6867', -- Melanie 3/8 (2026-08-15 — the NULL one)
   'd0bd8c70-0d1d-43df-a1a5-89e67d99a968', -- Melanie 4/8
   '92078d69-948b-439b-b6f1-3fe0be37d781', -- Melanie 5/8
   '73fee357-15f7-4b06-a950-33393c278aa5'  -- Melanie 6/8
 ) AND client_id IS NULL;

UPDATE bookings SET client_id = '3549ec1c-508d-42a9-98ee-5f08fec6120c', updated_at = now()
 WHERE id = '3b83e850-c954-485c-b484-52dca98fa214' AND client_id IS NULL; -- Marissa Evaluation

UPDATE bookings SET client_id = '2c096857-0593-4e3e-a810-3628684fdb9d', updated_at = now()
 WHERE id = '4db2df96-6f2e-4eea-b2e9-72755b1c2037' AND client_id IS NULL; -- Serena first lesson

-- ── B5: create client rows for the 3 contact-only people ──────────────────
DO $backfill$
DECLARE
  v_org      uuid := 'e656f20b-ef43-4725-9029-19e7f0190d9c';
  v_naomi    jsonb;
  v_hannah   jsonb;
  v_gabriella uuid;
BEGIN
  v_naomi  := _ensure_client_account(v_org, 'naomi.pouliot@icloud.com', 'Naomi', 'Pouliot', NULL, NULL, 'CLIENT');
  v_hannah := _ensure_client_account(v_org, 'hannah.dryden14@gmail.com', 'Hannah', 'Dryden', NULL, NULL, 'CLIENT');

  -- Gabriella Olenik: no email on file, so the spine's email-matching path
  -- can't run for her. Her contact_id is already known (re-queried this
  -- session: 3c23bb7f-bdce-4943-b40a-85cf41554491, no client row). Same
  -- INSERT the spine performs once a contact is resolved (20260802000000
  -- _ensure_client_account:146-151), applied directly since matching is moot.
  SELECT id INTO v_gabriella FROM clients WHERE contact_id = '3c23bb7f-bdce-4943-b40a-85cf41554491' AND deleted_at IS NULL;
  IF v_gabriella IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source, client_since)
      VALUES (v_org, '3c23bb7f-bdce-4943-b40a-85cf41554491', 'BOOKLINK backfill', now())
      RETURNING id INTO v_gabriella;
  END IF;

  UPDATE bookings SET client_id = (v_naomi->>'client_id')::uuid, updated_at = now()
   WHERE id = '4a904dc1-9b6e-4c9e-8a28-8b5db6f8866f' AND client_id IS NULL; -- Naomi

  UPDATE bookings SET client_id = (v_hannah->>'client_id')::uuid, updated_at = now()
   WHERE id = '33427be1-c33c-47d6-9995-80125c2a8ed2' AND client_id IS NULL; -- Hannah

  UPDATE bookings SET client_id = v_gabriella, updated_at = now()
   WHERE id = '5a81c761-30a1-4036-aba9-eb189bf49ba9' AND client_id IS NULL; -- Gabby single lesson
END
$backfill$;

-- ── verify: exactly 11 of the 14 are now linked, 3 remain (Maddie x2, Audrey x1) ──
DO $verify$
DECLARE v_linked int; v_remaining int;
BEGIN
  SELECT count(*) INTO v_linked FROM bookings
   WHERE id IN (
     '7f3212cd-1f2f-4841-8f3f-bdb00b05b9f8','c7762a6f-9be9-499f-9b79-9e8a779fe297',
     '80daf959-0dd1-4d20-9ee4-df2ff16a6867','d0bd8c70-0d1d-43df-a1a5-89e67d99a968',
     '92078d69-948b-439b-b6f1-3fe0be37d781','73fee357-15f7-4b06-a950-33393c278aa5',
     '3b83e850-c954-485c-b484-52dca98fa214','4db2df96-6f2e-4eea-b2e9-72755b1c2037',
     '4a904dc1-9b6e-4c9e-8a28-8b5db6f8866f','33427be1-c33c-47d6-9995-80125c2a8ed2',
     '5a81c761-30a1-4036-aba9-eb189bf49ba9'
   ) AND client_id IS NOT NULL;
  SELECT count(*) INTO v_remaining FROM bookings
   WHERE kind = 'lesson' AND client_id IS NULL AND is_flexible = false AND status <> 'draft';
  IF v_linked <> 11 THEN
    RAISE EXCEPTION 'BOOKLINK B5: expected 11 rows linked, got %', v_linked;
  END IF;
  IF v_remaining <> 3 THEN
    RAISE EXCEPTION 'BOOKLINK B5: expected exactly 3 rows still unlinked (Maddie x2 + Audrey 2/4), got %', v_remaining;
  END IF;
  RAISE NOTICE 'BOOKLINK B5: 11 rows linked, 3 correctly left for owner ruling';
END
$verify$;

-- ── B1: a committed (non-draft) kind='lesson' booking requires a client ────
-- Drafts and unavailable/open-slot items are exempt by design (spec's own
-- words): status='draft', or an open slot (is_flexible=true, published as
-- status='available'), or status='unavailable'. NOT VALID: 3 rows (Maddie x2,
-- Audrey 2/4) are real historical data this migration deliberately does not
-- guess a link for; they stay exactly as they are unless edited again, at
-- which point the constraint requires a client to be picked (the escape route
-- the panel now offers), which is the correct behavior for an edit, not a
-- retroactive rewrite of history.
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_lesson_requires_client
  CHECK (
    kind <> 'lesson'
    OR is_flexible
    OR status IN ('draft', 'available', 'unavailable')
    OR client_id IS NOT NULL
  ) NOT VALID;

COMMENT ON CONSTRAINT bookings_lesson_requires_client ON public.bookings IS
  'BOOKLINK B1: a committed (non-draft, non-open-slot) lesson must name its client. '
  'NOT VALID — 3 pre-existing rows (2 "Maddie", 1 "Audrey 2/4") are unresolved '
  'name matches pending an owner ruling; see docs/reports/TASK-BOOKLINK-REPORT.md.';
