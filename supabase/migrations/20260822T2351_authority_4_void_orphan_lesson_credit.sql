-- TASK-AUTHORITY §3 / §4.7 — void the orphan lesson_credits grant.
-- Row d2697af5-4d47-4265-9c7a-6362a400fe39 (client Madeline Do, e275f036-…) has
-- no offering_id, no purchase_id, no purchase_item_id, no period_start, no
-- expires_at — it represents no real entitlement. Per the owner's walkthrough
-- (docs/reports/OWNER-WALKTHROUGH-2026-08-18.md), it was created by a test click
-- of the "Grant credits" modal this task retires in Part B. Voided, not deleted:
-- credits_remaining -> 0. audit_lesson_credits (AFTER UPDATE, existing) records
-- the before/after automatically — this migration is the durable "why".

DO $$
DECLARE
  v_updated int;
BEGIN
  UPDATE lesson_credits
     SET credits_remaining = 0
   WHERE id = 'd2697af5-4d47-4265-9c7a-6362a400fe39'
     AND offering_id IS NULL
     AND purchase_id IS NULL
     AND purchase_item_id IS NULL
     AND period_start IS NULL
     AND expires_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  -- 1 row on prod, where this exact orphan lives. 0 is expected (not an error)
  -- when this migration replays against the test/db PGlite harness's fixture
  -- data or any other environment that never had this specific row — id is the
  -- primary key, so more than 1 is the only truly impossible outcome.
  IF v_updated > 1 THEN
    RAISE EXCEPTION 'TASK-AUTHORITY orphan-credit void: expected at most 1 row (id is PK), got %', v_updated;
  END IF;
  RAISE NOTICE 'TASK-AUTHORITY: voided orphan lesson_credits row d2697af5-4d47-4265-9c7a-6362a400fe39 (% row(s))', v_updated;
END $$;

-- Proving SELECT — tolerant of the row being absent (SELECT INTO leaves
-- v_remaining NULL, and NULL <> 0 is not true in plpgsql, so this only raises
-- when the row exists and the void did not take).
DO $$
DECLARE v_remaining int;
BEGIN
  SELECT credits_remaining INTO v_remaining FROM lesson_credits WHERE id = 'd2697af5-4d47-4265-9c7a-6362a400fe39';
  IF v_remaining IS NOT NULL AND v_remaining <> 0 THEN
    RAISE EXCEPTION 'TASK-AUTHORITY orphan-credit void: credits_remaining is % after update, expected 0', v_remaining;
  END IF;
END $$;
