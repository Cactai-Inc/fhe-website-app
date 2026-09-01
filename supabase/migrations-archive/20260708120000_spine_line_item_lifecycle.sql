/*
  # Spine — per-item lifecycle + timers (Slice 2a)

  The interest→order→sign→pay spine. A request is the parent intake object;
  request_selections are its line items. Each line item gains its OWN lifecycle,
  dates, hold, and disposition (spec: per-item approval).

  Line-item lifecycle (request_selections.state):
    received → in_review → approved_awaiting_claim → claimed_awaiting_completion → confirmed
    Terminal: declined, not_a_booking, withdrawn, expired
    Recoverable: lapsed (hold released, approval preserved) → back to approved_awaiting_claim on re-offer.

  Timers:
    hold_expires_at       = approved_at + 48h (flat, no runway)
    invitation_expires_at = invited_at   + 7 days (separate)
  Real-time expiry is by COMPUTATION (a hold past 48h is expired to any reader);
  the reaper (next sub-pass) only does housekeeping (status flip + email) 6am-9pm.

  requests currently has 0 rows (clean slate). Additive.
*/

-- line-item lifecycle state
DO $$ BEGIN
  CREATE TYPE line_item_state AS ENUM (
    'received','in_review','approved_awaiting_claim','claimed_awaiting_completion','confirmed',
    'declined','not_a_booking','withdrawn','expired','lapsed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE request_selections ADD COLUMN IF NOT EXISTS state line_item_state NOT NULL DEFAULT 'received';
ALTER TABLE request_selections ADD COLUMN IF NOT EXISTS assigned_date       date;
ALTER TABLE request_selections ADD COLUMN IF NOT EXISTS approved_at         timestamptz;
ALTER TABLE request_selections ADD COLUMN IF NOT EXISTS hold_expires_at     timestamptz;  -- approved_at + 48h
ALTER TABLE request_selections ADD COLUMN IF NOT EXISTS engagement_id       uuid REFERENCES engagements(id) ON DELETE SET NULL;
ALTER TABLE request_selections ADD COLUMN IF NOT EXISTS order_id            uuid REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE request_selections ADD COLUMN IF NOT EXISTS disposition_note    text;
ALTER TABLE request_selections ADD COLUMN IF NOT EXISTS origin              text;  -- 'gift' etc, null = standard

-- subject routing tag on the parent (booking-eligible vs not-a-booking)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS subject           text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS booking_eligible  boolean NOT NULL DEFAULT true;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS invited_at        timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS invitation_expires_at timestamptz;  -- invited_at + 7 days

CREATE INDEX IF NOT EXISTS request_selections_state_idx ON request_selections(state);
CREATE INDEX IF NOT EXISTS request_selections_hold_idx  ON request_selections(hold_expires_at)
  WHERE state = 'approved_awaiting_claim';

COMMENT ON COLUMN request_selections.state IS 'Per-item lifecycle (spec Part 2). Parent request state derives from items.';
COMMENT ON COLUMN request_selections.hold_expires_at IS 'approved_at + 48h. Real-time expiry by computation; reaper housekeeps 6am-9pm.';

-- Helper: is this line item's hold expired RIGHT NOW (real-time, computation-based)?
CREATE OR REPLACE FUNCTION line_item_hold_expired(p_state line_item_state, p_hold_expires_at timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_state = 'approved_awaiting_claim'
     AND p_hold_expires_at IS NOT NULL
     AND p_hold_expires_at < now();
$$;

-- Derive parent request status from its line items (spec: all terminal → closed; any active → open).
CREATE OR REPLACE FUNCTION derive_request_status(p_request_id uuid)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE v_active int; v_total int;
BEGIN
  SELECT count(*) FILTER (WHERE state NOT IN ('declined','not_a_booking','withdrawn','expired','confirmed')),
         count(*)
    INTO v_active, v_total
    FROM request_selections WHERE request_id = p_request_id;
  IF v_total = 0 THEN RETURN 'new'; END IF;
  IF v_active > 0 THEN RETURN 'open'; END IF;
  RETURN 'closed';
END;
$$;
