/*
  # Availability holds + booking transitions

  Server-side functions for the self-authored booking system. Holds and status
  transitions must be atomic, so they run as SECURITY DEFINER RPCs rather than
  client writes (availability_slots is admin-write only under RLS).

  - hold_slot(order_id, slot_id): atomically place a hold on an OPEN slot for an
    order the caller owns, creating/updating the booking row. Returns booking id.
  - release_booking_hold(booking_id): release a hold the caller owns (slot back to open).
  - confirm_booking_for_order(order_id): mark the held slot booked + booking confirmed.
    Intended to be called by the payment-confirmation path (service role), but also
    callable by admins.
  - release_expired_holds(): housekeeping — release holds whose order expired.
*/

-- Place a hold. Fails if the slot is not open or the caller does not own the order.
CREATE OR REPLACE FUNCTION hold_slot(p_order_id uuid, p_slot_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owns boolean;
  v_booking_id uuid;
BEGIN
  -- Ownership check (admins allowed)
  SELECT (o.user_id = v_user OR is_admin()) INTO v_owns
  FROM orders o WHERE o.id = p_order_id;
  IF NOT COALESCE(v_owns, false) THEN
    RAISE EXCEPTION 'not authorized for this order';
  END IF;

  -- Lock the slot row and verify it is open
  PERFORM 1 FROM availability_slots WHERE id = p_slot_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'slot is not available';
  END IF;

  -- Release any prior hold this order had on a different slot
  UPDATE availability_slots s SET status = 'open'
  WHERE s.id IN (
    SELECT b.slot_id FROM bookings_v2 b
    WHERE b.order_id = p_order_id AND b.slot_id <> p_slot_id AND b.status IN ('pending_slot','pending_payment')
  ) AND s.status = 'held';

  -- Mark the chosen slot held
  UPDATE availability_slots SET status = 'held' WHERE id = p_slot_id;

  -- Upsert the booking row
  SELECT id INTO v_booking_id FROM bookings_v2 WHERE order_id = p_order_id LIMIT 1;
  IF v_booking_id IS NULL THEN
    INSERT INTO bookings_v2 (order_id, user_id, slot_id, status)
    VALUES (p_order_id, (SELECT user_id FROM orders WHERE id = p_order_id), p_slot_id, 'pending_slot')
    RETURNING id INTO v_booking_id;
  ELSE
    UPDATE bookings_v2 SET slot_id = p_slot_id, status = 'pending_slot' WHERE id = v_booking_id;
  END IF;

  RETURN v_booking_id;
END;
$$;

-- Release a hold the caller owns.
CREATE OR REPLACE FUNCTION release_booking_hold(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slot uuid;
  v_owns boolean;
BEGIN
  SELECT b.slot_id, (b.user_id = auth.uid() OR is_admin())
    INTO v_slot, v_owns
  FROM bookings_v2 b WHERE b.id = p_booking_id;
  IF NOT COALESCE(v_owns, false) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE availability_slots SET status = 'open' WHERE id = v_slot AND status = 'held';
  UPDATE bookings_v2 SET status = 'cancelled', slot_id = NULL WHERE id = p_booking_id;
END;
$$;

-- Confirm the held slot for an order (called on payment confirmation).
CREATE OR REPLACE FUNCTION confirm_booking_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slot uuid;
BEGIN
  SELECT slot_id INTO v_slot FROM bookings_v2 WHERE order_id = p_order_id LIMIT 1;
  IF v_slot IS NOT NULL THEN
    UPDATE availability_slots SET status = 'booked' WHERE id = v_slot;
  END IF;
  UPDATE bookings_v2 SET status = 'confirmed' WHERE order_id = p_order_id;
END;
$$;

-- Housekeeping: release holds whose order has expired and is unpaid.
CREATE OR REPLACE FUNCTION release_expired_holds()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH expired AS (
    SELECT b.id AS booking_id, b.slot_id
    FROM bookings_v2 b
    JOIN orders o ON o.id = b.order_id
    WHERE b.status IN ('pending_slot','pending_payment')
      AND o.status NOT IN ('paid','confirmed')
      AND o.expires_at IS NOT NULL
      AND o.expires_at < now()
  )
  UPDATE availability_slots s SET status = 'open'
  FROM expired e WHERE s.id = e.slot_id AND s.status = 'held';

  WITH expired AS (
    SELECT b.id AS booking_id
    FROM bookings_v2 b
    JOIN orders o ON o.id = b.order_id
    WHERE b.status IN ('pending_slot','pending_payment')
      AND o.status NOT IN ('paid','confirmed')
      AND o.expires_at IS NOT NULL
      AND o.expires_at < now()
  )
  UPDATE bookings_v2 b SET status = 'expired', slot_id = NULL
  FROM expired e WHERE b.id = e.booking_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
