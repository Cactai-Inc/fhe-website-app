-- TASK-AUTHORITY §4.3 — repoint the one live ownership *gate* keyed on the wrong
-- column. bookings_self_read (RLS) admitted a row only when account_user_id =
-- auth.uid(), but account_user_id is unpopulated on 40 of 43 scheduled bookings
-- (§4.2 note: it "records which login acted, not who owns" — documentation, not
-- authority, per the ruling in §3). Any direct client-side read of `bookings` as
-- the account holder (e.g. listOrderBookings() in src/lib/api.ts, read from
-- ActivationOrderPanel.tsx) hit this policy and came back empty for a booking
-- that plainly belonged to the caller — this is the mechanism behind "I couldn't
-- reach the booking from her account." account_contact_id is now backfilled and
-- trigger-derived (previous two migrations), so it is safe to switch the gate to
-- the authoritative column.

DROP POLICY IF EXISTS bookings_self_read ON bookings;
CREATE POLICY bookings_self_read ON bookings
  FOR SELECT
  TO authenticated
  USING (account_contact_id = current_contact_id());
