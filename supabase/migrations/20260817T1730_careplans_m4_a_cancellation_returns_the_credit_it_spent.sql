-- CAREPLANS m4 — cancelling a booking returns ONE credit: the one it spent.
--
-- Owner, 2026-08-17: "if they cancel a booking they get a credit that expires at the
-- end of the month. they can reschedule it at any time until then."
--
-- Reissued from the LIVE body (pg_get_functiondef, 2026-08-17). Exactly one arm
-- changes — the approve branch for cancel/defer. Everything else, including the three
-- reject shapes, the scope resolution, the reschedule delta and every notification,
-- is byte-identical to what was running.
--
-- WHY THIS IS IN THIS TASK: §5c requires that moving or cancelling a booking never
-- changes the month's allowance, and §5c3 requires a cancellation credit to expire at
-- that month's end. Neither could be true while this arm minted a fresh uncapped row.

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
      -- CAREPLANS m4 — a cancellation returns THE CREDIT IT SPENT, through the one
      -- refund seam, capped at what the month was minted with and carrying that
      -- month's expiry. The shipped body inserted a fresh, untagged, NEVER-EXPIRING
      -- `change_credit` instead: it survived into the next month (the owner's
      -- ruling is that a cancelled lesson does not), it was spendable on any other
      -- service because it named none, and it was minted even when the booking had
      -- never debited anything — entitlement from nothing. `_refund_booking_credit`
      -- is the seam `delete_calendar_item`, `swap_booking_item` and
      -- `withdraw_my_pending_booking` already use; this arm was the one that did not.
      IF r.status <> 'cancelled' AND r.credit_id IS NOT NULL AND r.client_id IS NOT NULL THEN
        IF _refund_booking_credit(r) THEN
          v_freed := v_freed + 1;
        END IF;
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
$function$

;
