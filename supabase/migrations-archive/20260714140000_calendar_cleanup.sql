/*
  # Phase 6 · cleanup — retire the old slot-booking system

  The calendar (bookings + business-hours frame) fully replaced the old
  availability_slots / hold-a-slot flow. Its UI (BookMore, BookingStep,
  AvailabilityPage) is already deleted; this drops the now-orphaned DB objects.

  The one live tie was the purchase-payment path calling confirm_booking_for_purchase,
  which poked availability_slots. Since bookings no longer carry a slot_id, that
  poke was already a no-op — we decouple the function (keep only the "confirm the
  purchase's booking" behavior) so the table can go.

  A. confirm_booking_for_purchase — decoupled from availability_slots.
  B. drop orphaned RPCs: hold_slot, request_booking_time, release_booking_hold.
  C. drop bookings.slot_id (+ FK) — the calendar never sets it.
  D. drop availability_slots (8 stale demo rows go with it).
*/

-- ── A. decouple the payment-confirm from the old slot table ──────────────────
CREATE OR REPLACE FUNCTION confirm_booking_for_purchase(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- the calendar owns scheduling now; on payment we just confirm any booking
  -- already linked to this purchase.
  UPDATE bookings SET status = 'confirmed', updated_at = now()
   WHERE purchase_id = p_purchase_id
     AND status IN ('pending','pending_slot','pending_payment','scheduled');
END;
$$;
GRANT EXECUTE ON FUNCTION confirm_booking_for_purchase(uuid) TO authenticated, service_role;

-- ── B. drop the orphaned slot RPCs (no live callers) ─────────────────────────
DROP FUNCTION IF EXISTS hold_slot(uuid, uuid);
DROP FUNCTION IF EXISTS request_booking_time(uuid, timestamptz, text);
DROP FUNCTION IF EXISTS release_booking_hold(uuid);

-- ── C. drop the vestigial slot linkage on bookings ───────────────────────────
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_slot_id_fkey;
ALTER TABLE bookings DROP COLUMN IF EXISTS slot_id;

-- ── D. drop the old slot table ───────────────────────────────────────────────
DROP TABLE IF EXISTS availability_slots CASCADE;
