/*
  # Phase 6 · Slice 6 / Phase 7 — reminders + change notifications

  In-app notifications for every calendar change, plus the hourly reminder sweep.
  Emails ride on the notifications table (emailed_at NULL → the cron sends them),
  so the RPCs only INSERT in-app rows and the cron (api/calendar-reminders)
  delivers email to the client + hello@fhequestrian.com within the hour.

  Recipient rule (owner): a RIDER (lesson) booking notifies the client on any
  change; a HORSE-CARE booking notifies only when OFFSITE (onsite Carmel Creek =
  no notify — the client usually isn't present; offsite = someone is).

  A. notify_staff() + booking_notifies_client() helpers.
  B. request_booking_change + decide_booking_change recreated with notifications.
  C. calendar_reminder_sweep() — 1h + 2h reminders, stamped so they fire once.
*/

-- ── A. helpers ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_staff(p_org uuid, p_kind text, p_title text, p_link text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
  INSERT INTO notifications (org_id, user_id, kind, title, link)
  SELECT p_org, p.user_id, p_kind, p_title, p_link
  FROM profiles p
  WHERE p.org_id = p_org AND coalesce(p.role,'USER') IN ('ADMIN','MANAGER','EMPLOYEE','OWNER','SUPERADMIN');
$fn$;

-- does a change to this booking notify the client? rider always; horse-care only
-- when offsite (location marked offsite or an explicit address is set).
CREATE OR REPLACE FUNCTION booking_notifies_client(p_booking bookings)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT p_booking.kind = 'lesson'
      OR (p_booking.kind = 'care' AND (
            p_booking.address IS NOT NULL
            OR EXISTS (SELECT 1 FROM locations l WHERE l.id = p_booking.location_id AND l.is_offsite)));
$fn$;

-- ── B. change RPCs, now with notifications ───────────────────────────────────
CREATE OR REPLACE FUNCTION request_booking_change(
  p_booking_id uuid, p_kind text,
  p_new_start timestamptz DEFAULT NULL, p_new_end timestamptz DEFAULT NULL,
  p_scope text DEFAULT 'one', p_note text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_client uuid := current_client_id();
  v_b      bookings%ROWTYPE;
  v_fee    numeric;
  v_phone  boolean;
  v_id     uuid;
BEGIN
  IF p_kind NOT IN ('reschedule','cancel','defer') THEN RAISE EXCEPTION 'bad change kind'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  IF NOT (has_staff_access() OR (v_client IS NOT NULL AND v_b.client_id = v_client)) THEN
    RAISE EXCEPTION 'not your booking';
  END IF;
  IF p_kind = 'reschedule' AND (p_new_start IS NULL OR p_new_end IS NULL) THEN
    RAISE EXCEPTION 'a reschedule needs a new time';
  END IF;

  v_fee   := CASE WHEN p_kind = 'reschedule' THEN reschedule_fee(v_b.org_id, v_b.starts_at) ELSE 0 END;
  v_phone := v_b.starts_at - now() < interval '24 hours';

  INSERT INTO booking_change_requests (
    org_id, booking_id, requested_by, request_kind,
    proposed_starts_at, proposed_ends_at, scope, status,
    fee_amount, phone_required, note)
  VALUES (
    v_b.org_id, p_booking_id, auth.uid(), p_kind,
    p_new_start, p_new_end, p_scope, 'pending',
    NULLIF(v_fee,0), v_phone, p_note)
  RETURNING id INTO v_id;

  UPDATE bookings SET status = 'pending', updated_at = now()
   WHERE id = p_booking_id AND status IN ('scheduled','confirmed');

  -- staff get an in-app heads-up (email rides the sweep)
  PERFORM notify_staff(v_b.org_id, 'booking_change_requested',
    initcap(p_kind) || ' requested — ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM'),
    '/app/calendar');

  RETURN jsonb_build_object(
    'change_id', v_id, 'fee_amount', NULLIF(v_fee,0), 'phone_required', v_phone, 'kind', p_kind);
END;
$fn$;

CREATE OR REPLACE FUNCTION decide_booking_change(
  p_change_id uuid, p_approve boolean, p_waive_fee boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_cr booking_change_requests%ROWTYPE;
  v_b  bookings%ROWTYPE;
  v_when text;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_cr FROM booking_change_requests WHERE id = p_change_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'change request not found'; END IF;
  IF v_cr.status <> 'pending' THEN RAISE EXCEPTION 'already decided'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = v_cr.booking_id;

  IF NOT p_approve THEN
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

  IF v_cr.request_kind = 'reschedule' THEN
    UPDATE bookings SET starts_at=v_cr.proposed_starts_at, ends_at=v_cr.proposed_ends_at,
      status = CASE WHEN kind='lesson' THEN 'scheduled' ELSE 'confirmed' END,
      reminder_1h_sent_at = NULL, reminder_2h_sent_at = NULL, updated_at=now()
      WHERE id = v_cr.booking_id;
    v_when := to_char(v_cr.proposed_starts_at, 'FMMon FMDD, HH12:MI AM');
  ELSE
    UPDATE bookings SET status='cancelled', updated_at=now() WHERE id = v_cr.booking_id;
    IF v_cr.request_kind = 'defer' OR v_b.kind = 'lesson' THEN
      INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining, purchased_at)
        VALUES (v_b.org_id, v_b.client_id, 'change_credit', 1, 1, now());
    END IF;
    v_when := to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM');
  END IF;

  UPDATE booking_change_requests
    SET status='approved', fee_waived = p_waive_fee, decided_by=auth.uid(), decided_at=now()
    WHERE id=p_change_id;

  IF v_b.account_user_id IS NOT NULL AND booking_notifies_client(v_b) THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_b.org_id, v_b.account_user_id, 'booking_' || v_cr.request_kind || '_approved',
              CASE v_cr.request_kind
                WHEN 'reschedule' THEN 'Your lesson is now ' || v_when
                WHEN 'defer' THEN 'Lesson deferred — a credit is on your account'
                ELSE 'Your booking on ' || v_when || ' is cancelled' END,
              '/app/calendar');
  END IF;

  RETURN jsonb_build_object('status','approved', 'kind', v_cr.request_kind);
END;
$fn$;

-- ── C. the reminder sweep (called hourly by api/calendar-reminders) ──────────
CREATE OR REPLACE FUNCTION calendar_reminder_sweep()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_n2 int := 0; v_n1 int := 0; b bookings%ROWTYPE; v_title text;
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- 2-hour reminders: bookings starting in the next 2h, not yet 2h-reminded.
  FOR b IN
    SELECT * FROM bookings
    WHERE status IN ('scheduled','confirmed','pending') AND kind IN ('lesson','care')
      AND reminder_2h_sent_at IS NULL
      AND starts_at BETWEEN now() AND now() + interval '2 hours'
  LOOP
    v_title := 'Reminder: session at ' || to_char(b.starts_at, 'HH12:MI AM');
    IF b.account_user_id IS NOT NULL THEN
      INSERT INTO notifications (org_id, user_id, kind, title, link)
        VALUES (b.org_id, b.account_user_id, 'booking_reminder_2h', v_title, '/app/calendar');
    END IF;
    PERFORM notify_staff(b.org_id, 'booking_reminder_2h', v_title, '/app/calendar');
    UPDATE bookings SET reminder_2h_sent_at = now() WHERE id = b.id;
    v_n2 := v_n2 + 1;
  END LOOP;

  -- 1-hour reminders.
  FOR b IN
    SELECT * FROM bookings
    WHERE status IN ('scheduled','confirmed','pending') AND kind IN ('lesson','care')
      AND reminder_1h_sent_at IS NULL
      AND starts_at BETWEEN now() AND now() + interval '1 hour'
  LOOP
    v_title := 'Starting soon: session at ' || to_char(b.starts_at, 'HH12:MI AM');
    IF b.account_user_id IS NOT NULL THEN
      INSERT INTO notifications (org_id, user_id, kind, title, link)
        VALUES (b.org_id, b.account_user_id, 'booking_reminder_1h', v_title, '/app/calendar');
    END IF;
    PERFORM notify_staff(b.org_id, 'booking_reminder_1h', v_title, '/app/calendar');
    UPDATE bookings SET reminder_1h_sent_at = now() WHERE id = b.id;
    v_n1 := v_n1 + 1;
  END LOOP;

  RETURN jsonb_build_object('reminders_2h', v_n2, 'reminders_1h', v_n1);
END;
$fn$;
REVOKE ALL ON FUNCTION calendar_reminder_sweep() FROM public, anon;
GRANT EXECUTE ON FUNCTION calendar_reminder_sweep() TO service_role, authenticated;

REVOKE ALL ON FUNCTION notify_staff(uuid, text, text, text) FROM public, anon;
