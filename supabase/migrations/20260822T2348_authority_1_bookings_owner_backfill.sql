-- TASK-AUTHORITY §4.1 — account_contact_id is the authoritative booking owner
-- (docs/tasks/TASK-AUTHORITY-one-booking-owner-one-credit-write-path.md §3, owner-approved).
-- Backfill every bookings row carrying client_id but no account_contact_id, deriving
-- it through clients.contact_id (unique, NOT NULL — a single deterministic join).
-- Not restricted to status='scheduled': any row with client_id must end up owned.

DO $$
DECLARE
  v_updated int;
BEGIN
  UPDATE bookings b
     SET account_contact_id = c.contact_id
    FROM clients c
   WHERE b.client_id = c.id
     AND b.account_contact_id IS NULL
     AND b.client_id IS NOT NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  -- Prod measured 33 rows at the time this migration was written (§4.1 measurement,
  -- re-verified 2026-08-22). Not asserted as an exact count here — this migration
  -- also replays against the test/db PGlite harness's fixture data, whose row
  -- count differs; the proving SELECT below is the invariant that must hold in
  -- every environment.
  RAISE NOTICE 'TASK-AUTHORITY: backfilled account_contact_id on % bookings rows', v_updated;
END $$;

-- Proving SELECT: no bookings row may carry client_id without account_contact_id after this.
DO $$
DECLARE v_remaining int;
BEGIN
  SELECT count(*) INTO v_remaining FROM bookings WHERE client_id IS NOT NULL AND account_contact_id IS NULL;
  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'TASK-AUTHORITY backfill: % bookings still missing account_contact_id', v_remaining;
  END IF;
END $$;
