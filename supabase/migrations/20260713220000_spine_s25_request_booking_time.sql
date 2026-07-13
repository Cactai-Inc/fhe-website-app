/*
  # Spine Refactor — Slice 2.5 (core): free custom-time booking request

  The Sarah bug: the client booking step dead-ended with "no open times are
  listed, we'll reach out" when no availability_slots existed — the client could
  not request. Owner decision: an empty calendar must ALWAYS allow a free custom
  time request, and loaded slots are one-tap SUGGESTIONS (never hard blocks).

  request_booking_time creates/updates a booking at the client's requested time
  with NO slot (status pending_slot) for staff to confirm/schedule — the always-
  available path alongside hold_slot (the one-tap suggestion path).
*/
CREATE OR REPLACE FUNCTION request_booking_time(
  p_purchase_id uuid,
  p_starts_at   timestamptz,
  p_note        text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_owns    boolean;
  v_buyer   uuid;
  v_booking uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT (p.buyer_user_id = v_user OR is_admin()), p.buyer_user_id
    INTO v_owns, v_buyer
    FROM purchases p WHERE p.id = p_purchase_id AND p.deleted_at IS NULL;
  IF NOT COALESCE(v_owns, false) THEN
    RAISE EXCEPTION 'not authorized for this purchase';
  END IF;

  -- switching to a custom request releases any slot this purchase was holding
  UPDATE availability_slots s SET status = 'open'
   WHERE s.id IN (
     SELECT b.slot_id FROM bookings b
      WHERE b.purchase_id = p_purchase_id AND b.slot_id IS NOT NULL
        AND b.status IN ('pending_slot','pending_payment')
   ) AND s.status = 'held';

  SELECT id INTO v_booking FROM bookings WHERE purchase_id = p_purchase_id LIMIT 1;
  IF v_booking IS NULL THEN
    INSERT INTO bookings (purchase_id, account_user_id, slot_id, starts_at, status, notes, hold_expires_at)
    VALUES (p_purchase_id, v_buyer, NULL, p_starts_at, 'pending_slot', p_note, now() + interval '48 hours')
    RETURNING id INTO v_booking;
  ELSE
    UPDATE bookings SET slot_id = NULL, starts_at = p_starts_at, status = 'pending_slot',
                        notes = coalesce(p_note, notes)
     WHERE id = v_booking;
  END IF;

  RETURN v_booking;
END;
$$;
GRANT EXECUTE ON FUNCTION request_booking_time(uuid, timestamptz, text) TO authenticated, service_role;
