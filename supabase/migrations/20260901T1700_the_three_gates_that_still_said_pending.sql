-- TASK-LIFECYCLE · E — THE THREE GATES THAT WOULD HAVE LOCKED THE NEW FIRST STATE OUT
--
-- ⚠️ THIS FILE IS THE COST OF RENAMING A STATE, AND IT IS THE FAILURE THIS REPO
-- HAS THE MOST OF. Migration D moved a fresh booking request from `pending` to
-- `requested`. THREE functions gate on `bookings.status = 'pending'` and none of
-- them is in the spec's list of six:
--
--   `withdraw_my_pending_booking`  — the client cancels their own unanswered ask
--   `update_my_pending_booking`    — the client changes the time before staff decide
--   `propose_booking_time`         — staff counter with a different time
--
-- Left alone, every one of them would have raised on the exact booking it exists
-- to serve, and the failure would have read as "the button does nothing". The
-- spec's own §7.2 — *"a client sees their booking is pending — where, and what
-- does it tell them to do?"* — is what surfaced them.
--
-- ⚠️ THE `status = 'pending'` LINES THAT ARE **NOT** TOUCHED HERE are on
-- `booking_change_requests`, a different table with its own vocabulary, where
-- `pending` means "undecided" and is unaffected by any of this.

CREATE OR REPLACE FUNCTION public.withdraw_my_pending_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid := current_client_id();
  v_b      bookings%ROWTYPE;
  v_refund boolean := false;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no member profile'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_b.client_id IS DISTINCT FROM v_client THEN
    RAISE EXCEPTION 'not your booking';
  END IF;
  IF v_b.status NOT IN ('requested','pending') THEN
    RAISE EXCEPTION 'NOT_PENDING: this booking is confirmed — use a change request';
  END IF;

  IF v_b.credit_id IS NOT NULL THEN v_refund := _refund_booking_credit(v_b); END IF;
  UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = p_booking_id;
  UPDATE booking_change_requests
     SET status = 'withdrawn', decided_by = auth.uid(), decided_at = now()
   WHERE booking_id = p_booking_id AND status = 'pending';

  PERFORM notify_staff(v_b.org_id, 'booking_withdrawn',
    'A client withdrew their request for ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM'),
    '/app/calendar');

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'cancelled',
                            'credit_refunded', v_refund);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_my_pending_booking(p_booking_id uuid, p_new_start timestamp with time zone, p_new_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid := current_client_id();
  v_b      bookings%ROWTYPE;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no member profile'; END IF;
  IF p_new_start IS NULL OR p_new_end IS NULL THEN RAISE EXCEPTION 'a new time is required'; END IF;
  IF p_new_end <= p_new_start THEN RAISE EXCEPTION 'the end must be after the start'; END IF;

  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_b.client_id IS DISTINCT FROM v_client THEN
    RAISE EXCEPTION 'not your booking';
  END IF;
  IF v_b.status NOT IN ('requested','pending') THEN
    RAISE EXCEPTION 'NOT_PENDING: this booking is confirmed — use a change request';
  END IF;

  UPDATE bookings
     SET starts_at = p_new_start, ends_at = p_new_end,
         reminder_1h_sent_at = NULL, reminder_2h_sent_at = NULL,
         updated_at = now()
   WHERE id = p_booking_id;

  -- the companion open row follows it, so the staff queue shows the time the
  -- client actually wants rather than the one they first picked
  UPDATE booking_change_requests
     SET proposed_starts_at = p_new_start, proposed_ends_at = p_new_end
   WHERE booking_id = p_booking_id AND status = 'pending' AND NOT coalesce(awaiting_client, false);

  PERFORM notify_staff(v_b.org_id, 'booking_time_requested',
    'A client changed their requested time to ' || to_char(p_new_start, 'FMMon FMDD, HH12:MI AM'),
    '/app/calendar');

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'pending',
                            'starts_at', p_new_start, 'ends_at', p_new_end);
END;
$function$;

CREATE OR REPLACE FUNCTION public.propose_booking_time(p_booking_id uuid, p_new_start timestamp with time zone, p_new_end timestamp with time zone, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_b  bookings%ROWTYPE;
  v_cr booking_change_requests%ROWTYPE;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  IF p_new_start IS NULL OR p_new_end IS NULL OR p_new_end <= p_new_start THEN
    RAISE EXCEPTION 'pick a start and a later end';
  END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found in this org'; END IF;
  IF v_b.status NOT IN ('requested','pending') THEN
    RAISE EXCEPTION 'only a requested or pending booking can be countered'; END IF;

  SELECT * INTO v_cr FROM booking_change_requests
    WHERE booking_id = p_booking_id AND status = 'pending'
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no open request on this booking to counter'; END IF;

  UPDATE booking_change_requests SET
    proposed_starts_at = p_new_start, proposed_ends_at = p_new_end,
    awaiting_client = true, staff_note = coalesce(p_note, staff_note)
  WHERE id = v_cr.id;

  IF v_b.account_user_id IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_b.org_id, v_b.account_user_id, 'booking_time_proposed',
              'We proposed a different time — ' || to_char(p_new_start, 'FMMon FMDD, HH12:MI AM'),
              '/app/calendar');
  END IF;

  RETURN jsonb_build_object('change_id', v_cr.id, 'status', 'pending', 'awaiting_client', true);
END;
$function$;
