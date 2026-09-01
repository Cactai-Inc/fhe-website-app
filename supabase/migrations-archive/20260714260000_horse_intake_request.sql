/*
  # Calendar A4 — staff send a horse-intake form to a client; the completed
  #               horse attaches to that client's lesson/care booking.

  A lesson/care booking may be a client bringing their own horse. Staff ask the
  client to fill their horse's details, and the horse they create attaches back
  to that booking — no staff re-entry.

  A. request_horse_intake(booking) — staff-only: notify the booking's client
     with a click-through link that carries the booking id, so the client's
     answer knows where to land. Uses notify_user (staff→client, in-app + email).
  B. attach_booking_horse(booking, horse) — client-authorized: the client who
     OWNS the booking attaches a horse they OWN to it. set_booking_horse is
     staff-only; this is the client analog, modeled on my_onboarding_attach_horse
     (a SECURITY DEFINER RPC gated on the caller owning both sides).
*/

-- A. staff ask the booking's client to provide their horse ────────────────────
CREATE OR REPLACE FUNCTION request_horse_intake(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_b    bookings%ROWTYPE;
  v_when text;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found in this org'; END IF;
  IF v_b.kind NOT IN ('lesson','care') THEN RAISE EXCEPTION 'only a lesson or care booking takes a horse'; END IF;
  IF v_b.account_user_id IS NULL THEN RAISE EXCEPTION 'this booking has no client account to notify'; END IF;

  v_when := to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM');
  PERFORM notify_user(
    v_b.account_user_id,
    'horse_intake_request',
    'Tell us about your horse',
    'For your session on ' || coalesce(v_when, 'the calendar')
      || ', add your horse''s details so we''re ready for you. It only takes a minute.',
    '/app/horse-intake?booking=' || p_booking_id::text
  );
  RETURN jsonb_build_object('ok', true);
END;
$fn$;
REVOKE ALL ON FUNCTION request_horse_intake(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION request_horse_intake(uuid) TO authenticated, service_role;

-- B. the client attaches a horse they own to a booking they own ───────────────
CREATE OR REPLACE FUNCTION attach_booking_horse(p_booking_id uuid, p_horse_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_client  uuid := current_client_id();
  v_contact uuid := current_contact_id();
  v_org     uuid := current_org();
  v_b       bookings%ROWTYPE;
  v_mine    boolean;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no client profile'; END IF;

  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  IF v_b.client_id IS DISTINCT FROM v_client THEN RAISE EXCEPTION 'not your booking'; END IF;
  IF v_b.kind NOT IN ('lesson','care') THEN RAISE EXCEPTION 'that booking does not take a horse'; END IF;

  -- the caller must have a stake in the horse: the owner pointer, an active party
  -- row (my_stable path), or an active relationship row (create_horse_record path)
  SELECT EXISTS (
    SELECT 1 FROM horses h WHERE h.id = p_horse_id AND h.org_id = v_org AND h.deleted_at IS NULL
      AND (
        h.current_owner_contact_id = v_contact
        OR EXISTS (SELECT 1 FROM horse_parties hp WHERE hp.horse_id = h.id AND hp.contact_id = v_contact
                     AND hp.deleted_at IS NULL AND (hp.effective_to IS NULL OR hp.effective_to >= current_date))
        OR EXISTS (SELECT 1 FROM horse_relationships hr WHERE hr.horse_id = h.id AND hr.party_contact_id = v_contact
                     AND hr.active)
      )
  ) INTO v_mine;
  IF NOT v_mine THEN RAISE EXCEPTION 'that horse is not yours'; END IF;

  UPDATE bookings SET horse_id = p_horse_id, updated_at = now() WHERE id = p_booking_id;

  -- let staff know the client answered
  PERFORM notify_staff(v_org, 'horse_intake_completed',
    'A client added their horse to their session', '/app/calendar');

  RETURN jsonb_build_object('ok', true, 'horse_id', p_horse_id);
END;
$fn$;
REVOKE ALL ON FUNCTION attach_booking_horse(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION attach_booking_horse(uuid, uuid) TO authenticated, service_role;
