/*
  # Calendar A2 — a client can request ANY open time (not just offered blocks)

  Availability is suggestions, not limits: a client may request an arbitrary
  open in-hours time for a new booking. It lands as a PENDING booking that staff
  confirm (like the offered-block flow, but the client picks the time). No credit
  is consumed until staff confirm.

  A. request_open_time(start, end, offering?, horse?, note) — client creates the
     pending booking + notifies staff.
  B. confirm_booking(booking) — staff flip a pending booking to confirmed/
     scheduled + notify the client.
*/

CREATE OR REPLACE FUNCTION request_open_time(
  p_starts_at timestamptz, p_ends_at timestamptz,
  p_offering_id uuid DEFAULT NULL, p_horse_id uuid DEFAULT NULL, p_note text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_client uuid := current_client_id();
  v_org    uuid := current_org();
  v_kind   text := 'lesson';
  v_id     uuid;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no client profile'; END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'pick a start and a later end';
  END IF;
  IF p_starts_at < now() THEN RAISE EXCEPTION 'pick a future time'; END IF;

  IF p_offering_id IS NOT NULL THEN
    SELECT CASE WHEN o.segment = 'horse' THEN 'care' ELSE 'lesson' END INTO v_kind
      FROM offerings o WHERE o.id = p_offering_id;
    v_kind := coalesce(v_kind, 'lesson');
  END IF;

  -- a horse can't be double-booked
  IF p_horse_id IS NOT NULL AND horse_time_conflict(v_org, p_horse_id, p_starts_at, p_ends_at, NULL, NULL) THEN
    RAISE EXCEPTION 'that horse is already booked in an overlapping time';
  END IF;

  INSERT INTO bookings (org_id, kind, status, client_id, account_user_id,
      offering_id, horse_id, starts_at, ends_at, notes)
    VALUES (v_org, v_kind, 'pending', v_client, auth.uid(),
            p_offering_id, p_horse_id, p_starts_at, p_ends_at,
            NULLIF(btrim(coalesce(p_note,'')),''))
    RETURNING id INTO v_id;

  PERFORM notify_staff(v_org, 'booking_time_requested',
    'A client requested ' || to_char(p_starts_at, 'FMMon FMDD, HH12:MI AM'),
    '/app/calendar');

  RETURN jsonb_build_object('booking_id', v_id, 'status', 'pending');
END;
$fn$;
REVOKE ALL ON FUNCTION request_open_time(timestamptz, timestamptz, uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION request_open_time(timestamptz, timestamptz, uuid, uuid, text) TO authenticated, service_role;

-- staff confirm a pending booking (a requested time, or an open-slot hold)
CREATE OR REPLACE FUNCTION confirm_booking(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_b bookings%ROWTYPE;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found in this org'; END IF;
  IF v_b.status NOT IN ('pending','pending_slot','pending_payment') THEN
    RAISE EXCEPTION 'only a pending booking can be confirmed'; END IF;

  UPDATE bookings SET status = CASE WHEN kind = 'lesson' THEN 'scheduled' ELSE 'confirmed' END,
                      updated_at = now()
   WHERE id = p_booking_id;

  IF v_b.account_user_id IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_b.org_id, v_b.account_user_id, 'booking_confirmed',
              'Your session on ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM') || ' is confirmed',
              '/app/calendar');
  END IF;
  RETURN jsonb_build_object('status', 'confirmed');
END;
$fn$;
REVOKE ALL ON FUNCTION confirm_booking(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION confirm_booking(uuid) TO authenticated, service_role;
