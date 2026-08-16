-- TASK REVIEWQ M3 — R2/R4: confirm · decline · propose another time, all
-- through the existing decision path (decide_booking_change), extended, not
-- duplicated.
--
-- decide_booking_change gains a third caller shape. Today it is staff-only,
-- deciding a request the client raised. It now also admits the booking's own
-- CLIENT deciding a staff-proposed counter-time (booking_change_requests.
-- awaiting_client = true, set by the new propose_booking_time below) —
-- direction-aware, same function, same table.
--
-- Reject has three distinct outcomes depending on shape (see the truth table
-- in the function body): the existing revert-to-scheduled behaviour is
-- unchanged for reschedule/cancel/defer; a genuine company decline of a
-- fresh ('new') request is now terminal + refunded (R3); a client turning
-- down a proposed counter-time leaves the booking pending and re-opens the
-- queue with a fresh row (R2's round-trip, still zero new tables).
--
-- _refund_booking_credit is the shared "give the credit back" helper R3
-- needs — mints a `change_credit` lesson_credits row, the exact convention
-- decide_booking_change's own cancel/defer branch already uses, rather than
-- reversing the original debit in place. M4's delete_calendar_item calls the
-- same helper so both refusal paths (decline, and the delete button) agree.
CREATE OR REPLACE FUNCTION public._refund_booking_credit(p_booking bookings)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_off uuid;
  v_pur uuid;
BEGIN
  IF p_booking.credit_id IS NULL OR p_booking.client_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT offering_id, purchase_id INTO v_off, v_pur FROM lesson_credits WHERE id = p_booking.credit_id;
  INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining,
      purchased_at, offering_id, purchase_id)
    VALUES (p_booking.org_id, p_booking.client_id, 'change_credit', 1, 1, now(), v_off, v_pur);
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public._refund_booking_credit(bookings) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._refund_booking_credit(bookings) TO service_role;

-- ── decide_booking_change ─────────────────────────────────────────────────
-- Gains a 4th parameter (p_reason) — a different signature from the live
-- (uuid, boolean, boolean) function, so CREATE OR REPLACE alone would add an
-- overload instead of replacing it, leaving every existing 3-arg call site
-- ambiguous between the two. Drop the old signature first.
DROP FUNCTION IF EXISTS public.decide_booking_change(uuid, boolean, boolean);

CREATE OR REPLACE FUNCTION public.decide_booking_change(p_change_id uuid, p_approve boolean, p_waive_fee boolean DEFAULT false, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cr     booking_change_requests%ROWTYPE;
  v_b      bookings%ROWTYPE;
  v_client uuid := current_client_id();
  v_when   text;
  v_delta  interval;
  v_scope  text;
  v_ids    uuid[];
  v_n      int;
  rid      uuid;
  r        bookings%ROWTYPE;
  v_freed  int := 0;
  v_refunded boolean := false;
BEGIN
  SELECT * INTO v_cr FROM booking_change_requests WHERE id = p_change_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'change request not found'; END IF;
  IF v_cr.status <> 'pending' THEN RAISE EXCEPTION 'already decided'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = v_cr.booking_id;

  -- REVIEWQ R2: direction-aware — the default (awaiting_client = false) is
  -- the incumbent shape, staff decides a client's ask; awaiting_client = true
  -- is a staff-proposed counter-time, and only the booking's own client may
  -- decide it.
  IF NOT (
    (v_cr.awaiting_client AND v_client IS NOT NULL AND v_b.client_id = v_client)
    OR (NOT v_cr.awaiting_client AND has_staff_access())
  ) THEN
    RAISE EXCEPTION 'not authorized to decide this request';
  END IF;

  v_scope := coalesce(v_cr.scope, 'one');

  IF NOT p_approve THEN
    -- Three distinct reject shapes:
    IF v_cr.request_kind = 'new' AND v_cr.awaiting_client THEN
      -- (1) the client turned down a staff-proposed counter-time. The
      -- booking was never confirmed by anyone, so it stays 'pending' — this
      -- row withdraws and a fresh 'new' row (proposed time reset to the
      -- booking's own current time) reopens the queue for staff, same
      -- invariant book_open_slot/request_open_time established: every
      -- pending booking has exactly one open companion row.
      UPDATE booking_change_requests SET status='withdrawn', decided_by=auth.uid(), decided_at=now()
        WHERE id=p_change_id;
      INSERT INTO booking_change_requests (org_id, booking_id, requested_by, request_kind,
          proposed_starts_at, proposed_ends_at, status)
        VALUES (v_b.org_id, v_b.id, v_cr.requested_by, 'new', v_b.starts_at, v_b.ends_at, 'pending');
      PERFORM notify_staff(v_b.org_id, 'booking_time_declined',
        'Client declined the proposed time for ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM'),
        '/app/calendar');
      RETURN jsonb_build_object('status','withdrawn', 'kind','new', 'booking_status','pending');

    ELSIF v_cr.request_kind = 'new' THEN
      -- (2) a genuine company decline of a fresh request nobody countered:
      -- terminal, credit refunded if one was debited, reason recorded.
      IF v_b.status <> 'cancelled' AND v_b.credit_id IS NOT NULL THEN
        v_refunded := _refund_booking_credit(v_b);
      END IF;
      UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = v_cr.booking_id;
      UPDATE booking_change_requests SET status='rejected', staff_note = coalesce(p_reason, staff_note),
        decided_by=auth.uid(), decided_at=now() WHERE id=p_change_id;
      IF v_b.account_user_id IS NOT NULL AND booking_notifies_client(v_b) THEN
        INSERT INTO notifications (org_id, user_id, kind, title, link)
          VALUES (v_b.org_id, v_b.account_user_id, 'booking_declined',
                  'Your request for ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM') || ' was declined'
                    || CASE WHEN p_reason IS NOT NULL THEN ' — ' || p_reason ELSE '' END,
                  '/app/calendar');
      END IF;
      RETURN jsonb_build_object('status','rejected', 'kind','new', 'credit_refunded', v_refunded);

    ELSE
      -- (3) the incumbent shape, unchanged: a reschedule/cancel/defer ask
      -- against an already-live booking is refused, and the booking reverts
      -- to its prior live status.
      UPDATE booking_change_requests SET status='rejected', decided_by=auth.uid(), decided_at=now() WHERE id=p_change_id;
      UPDATE bookings SET status = CASE WHEN kind='lesson' THEN 'scheduled' ELSE 'confirmed' END, updated_at=now()
        WHERE id = v_cr.booking_id AND status='pending';
      IF v_b.account_user_id IS NOT NULL AND booking_notifies_client(v_b) THEN
        INSERT INTO notifications (org_id, user_id, kind, title, link)
          VALUES (v_b.org_id, v_b.account_user_id, 'booking_change_rejected',
                  initcap(v_cr.request_kind) || ' request declined — please reach out', '/app/calendar');
      END IF;
      RETURN jsonb_build_object('status','rejected');
    END IF;
  END IF;

  -- resolve the affected occurrences by scope
  IF v_b.series_id IS NULL OR v_scope = 'one' THEN
    v_ids := ARRAY[v_b.id];
  ELSIF v_scope = 'all' THEN
    SELECT array_agg(id) INTO v_ids FROM bookings WHERE series_id = v_b.series_id;
  ELSIF v_scope = 'future' THEN
    SELECT array_agg(id) INTO v_ids FROM bookings WHERE series_id = v_b.series_id AND starts_at >= v_b.starts_at;
  ELSIF v_scope LIKE 'weeks:%' THEN
    v_n := nullif(split_part(v_scope, ':', 2), '')::int;
    SELECT array_agg(id) INTO v_ids FROM (
      SELECT id FROM bookings WHERE series_id = v_b.series_id AND starts_at >= v_b.starts_at
      ORDER BY starts_at LIMIT coalesce(v_n, 1)) x;
  ELSE
    v_ids := ARRAY[v_b.id];
  END IF;

  -- REVIEWQ: 'new' rides the same apply-delta-then-schedule branch as
  -- 'reschedule' — a fresh request's proposed_* is set to its own original
  -- time at creation (delta 0, confirm-in-place); a staff counter-offer sets
  -- proposed_* to the new time (delta shifts it), and approving here is the
  -- client's acceptance.
  IF v_cr.request_kind IN ('reschedule','new') THEN
    v_delta := coalesce(v_cr.proposed_starts_at, v_b.starts_at) - v_b.starts_at;
    FOREACH rid IN ARRAY v_ids LOOP
      SELECT * INTO r FROM bookings WHERE id = rid;
      UPDATE bookings SET starts_at = r.starts_at + v_delta, ends_at = r.ends_at + v_delta,
        status = CASE WHEN kind='lesson' THEN 'scheduled' ELSE 'confirmed' END,
        reminder_1h_sent_at = NULL, reminder_2h_sent_at = NULL, updated_at=now()
      WHERE id = rid;
    END LOOP;
    v_when := to_char(coalesce(v_cr.proposed_starts_at, v_b.starts_at), 'FMMon FMDD, HH12:MI AM');
  ELSE
    FOREACH rid IN ARRAY v_ids LOOP
      SELECT * INTO r FROM bookings WHERE id = rid;
      UPDATE bookings SET status='cancelled', updated_at=now() WHERE id = rid;
      IF (v_cr.request_kind = 'defer' OR r.kind = 'lesson') AND r.client_id IS NOT NULL THEN
        INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining, purchased_at)
          VALUES (r.org_id, r.client_id, 'change_credit', 1, 1, now());
        v_freed := v_freed + 1;
      END IF;
    END LOOP;
    v_when := to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM');
  END IF;

  UPDATE booking_change_requests
    SET status='approved', fee_waived = p_waive_fee, decided_by=auth.uid(), decided_at=now()
    WHERE id=p_change_id;

  IF v_b.account_user_id IS NOT NULL AND booking_notifies_client(v_b) THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_b.org_id, v_b.account_user_id,
              CASE WHEN v_cr.request_kind = 'new' THEN 'booking_confirmed' ELSE 'booking_' || v_cr.request_kind || '_approved' END,
              CASE v_cr.request_kind
                WHEN 'reschedule' THEN 'Your lesson is now ' || v_when
                WHEN 'new' THEN 'Your session on ' || v_when || ' is confirmed'
                WHEN 'defer' THEN 'Lesson deferred — a credit is on your account'
                ELSE 'Your booking on ' || v_when || ' is cancelled' END,
              '/app/calendar');
  END IF;

  RETURN jsonb_build_object('status','approved', 'kind', v_cr.request_kind, 'affected', coalesce(array_length(v_ids,1),1));
END;
$function$;
-- the DROP above means this is a fresh function object — grants don't carry
-- over from the old signature. A first pass here only re-GRANTed (matching
-- the old signature's authenticated/service_role) and missed that a fresh
-- function object also picks up Postgres's own default: EXECUTE TO PUBLIC —
-- confirmed live in prod (anon and PUBLIC both showed EXECUTE immediately
-- after this migration ran, unlike every plain CREATE OR REPLACE in this
-- file, which correctly kept its pre-existing grants because the signature
-- didn't change). REVOKE FROM PUBLIC, anon explicitly, matching this
-- codebase's convention for every other function on this table
-- (request_booking_change, propose_booking_time below).
REVOKE ALL ON FUNCTION public.decide_booking_change(uuid, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_booking_change(uuid, boolean, boolean, text) TO authenticated, service_role;

-- ── propose_booking_time — R2's "propose another time" ───────────────────
-- Staff counters a pending request with a different time. Updates the SAME
-- open booking_change_requests row in place (reusing the table, per spec —
-- no new one) and flips awaiting_client so decide_booking_change's
-- permission check hands the decision to the client.
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
  IF v_b.status <> 'pending' THEN RAISE EXCEPTION 'only a pending booking can be countered'; END IF;

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
REVOKE ALL ON FUNCTION public.propose_booking_time(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_booking_time(uuid, timestamptz, timestamptz, text) TO authenticated, service_role;

-- ── confirm_booking — reconcile the companion row ─────────────────────────
-- Staff can still confirm from the item detail panel's existing "Confirm
-- request" button (unchanged call site, CalendarItemPanel.tsx). Now it also
-- closes out the queue's companion row so a stale 'pending' change-request
-- never lingers in open_change_requests() after the booking itself is live,
-- regardless of which UI staff used to confirm.
CREATE OR REPLACE FUNCTION public.confirm_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  UPDATE booking_change_requests SET status='approved', decided_by=auth.uid(), decided_at=now()
   WHERE booking_id = p_booking_id AND status='pending';

  IF v_b.account_user_id IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_b.org_id, v_b.account_user_id, 'booking_confirmed',
              'Your session on ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM') || ' is confirmed',
              '/app/calendar');
  END IF;
  RETURN jsonb_build_object('status', 'confirmed');
END;
$function$;

-- ── open_change_requests — surface the new fields to the staff queue ─────
CREATE OR REPLACE FUNCTION public.open_change_requests()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', cr.id, 'booking_id', cr.booking_id, 'kind', cr.request_kind,
        'proposed_starts_at', cr.proposed_starts_at, 'proposed_ends_at', cr.proposed_ends_at,
        'fee_amount', cr.fee_amount, 'fee_paid', cr.fee_paid, 'phone_required', cr.phone_required,
        'note', cr.note, 'staff_note', cr.staff_note, 'awaiting_client', cr.awaiting_client,
        'created_at', cr.created_at,
        'client_name', trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
        'starts_at', b.starts_at) ORDER BY cr.created_at DESC), '[]'::jsonb)
    FROM booking_change_requests cr
    JOIN bookings b ON b.id = cr.booking_id
    LEFT JOIN clients cl ON cl.id = b.client_id
    LEFT JOIN contacts c ON c.id = cl.contact_id
    WHERE cr.org_id = current_org() AND cr.status = 'pending');
END;
$function$;

-- ── my_pending_changes — a client must also see a staff-proposed counter ─
-- Was scoped to requested_by = auth.uid() only, which misses a counter-offer
-- (requested_by is the STAFF member who created the original companion row,
-- or whichever party inserted it — the client didn't raise this one). Widened
-- to also include any open row on a booking the caller's own client record
-- owns; RLS on booking_change_requests already permits this read, this just
-- makes the function's own filter agree with it.
CREATE OR REPLACE FUNCTION public.my_pending_changes()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', cr.id, 'booking_id', cr.booking_id, 'kind', cr.request_kind,
      'status', cr.status, 'proposed_starts_at', cr.proposed_starts_at,
      'proposed_ends_at', cr.proposed_ends_at, 'awaiting_client', cr.awaiting_client,
      'fee_amount', cr.fee_amount, 'fee_paid', cr.fee_paid, 'phone_required', cr.phone_required,
      'created_at', cr.created_at) ORDER BY cr.created_at DESC), '[]'::jsonb)
  FROM booking_change_requests cr
  WHERE cr.status = 'pending'
    AND (cr.requested_by = auth.uid()
         OR cr.booking_id IN (SELECT id FROM bookings WHERE client_id = current_client_id()))
$function$;
