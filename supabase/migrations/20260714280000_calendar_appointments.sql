/*
  # C5 — external appointments on the calendar (linked to a horse/client)

  An external appointment (vet, farrier, an offsite commitment) is a calendar
  BLOCK: it occupies time, blocks client-facing availability, and carries travel
  buffers — all of which the existing block already does (kind='block', address,
  travel_before/after, location). save_calendar_item already persists client_id
  and horse_id on a block, and calendar_free_busy already shows a client their
  OWN block in full. So the only new backend piece is notifying the linked
  client and, when the appointment is tied to a horse, resolving that horse's
  owner so it lands on the right person's calendar.

  appointment_notify(booking) — staff-only. Resolves the target client (the
  explicit client_id, else the horse's current owner), backfills the booking's
  client_id when it came only from the horse (so calendar_free_busy surfaces it
  to them), and notifies that client's account. Idempotent-ish: safe to call
  again after an edit.
*/

CREATE OR REPLACE FUNCTION appointment_notify(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_org    uuid := current_org();
  v_b      bookings%ROWTYPE;
  v_client uuid;
  v_user   uuid;
  v_when   text;
  v_title  text;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'appointment not found in this org'; END IF;

  v_client := v_b.client_id;

  -- tied only to a horse → resolve the horse's owner, and stamp it on the
  -- booking so the appointment shows on that owner's calendar.
  IF v_client IS NULL AND v_b.horse_id IS NOT NULL THEN
    SELECT c.id INTO v_client
      FROM horses h
      JOIN clients c ON c.contact_id = h.current_owner_contact_id AND c.deleted_at IS NULL
      WHERE h.id = v_b.horse_id AND h.org_id = v_org;
    IF v_client IS NOT NULL THEN
      UPDATE bookings SET client_id = v_client, updated_at = now() WHERE id = p_booking_id;
    END IF;
  END IF;

  IF v_client IS NULL THEN
    RETURN jsonb_build_object('notified', false, 'reason', 'no client linked');
  END IF;

  SELECT p.user_id INTO v_user
    FROM clients c JOIN profiles p ON p.contact_id = c.contact_id
    WHERE c.id = v_client;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('notified', false, 'reason', 'client has no account', 'client_id', v_client);
  END IF;

  v_title := coalesce(nullif(btrim(v_b.notes), ''), 'An appointment');
  v_when  := to_char(v_b.starts_at, 'FMDay, FMMon FMDD, HH12:MI AM');
  PERFORM notify_user(v_user, 'appointment_scheduled',
    v_title || ' — ' || v_when,
    'This appointment is on your calendar.',
    '/app/calendar');

  RETURN jsonb_build_object('notified', true, 'client_id', v_client);
END;
$fn$;
REVOKE ALL ON FUNCTION appointment_notify(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION appointment_notify(uuid) TO authenticated, service_role;
