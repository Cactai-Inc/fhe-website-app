/*
  # Phase 6 · gap-fix — honor recurring scope on approval

  The client (and staff) can request a change on a recurring booking scoped to
  one / this-and-future / the-whole-series. decide_booking_change previously
  applied the change to a single row only. This recreates it to honor the
  scope stored on the change request: a reschedule shifts every scoped
  occurrence by the same delta; a cancel/defer releases every scoped occurrence
  (granting a lesson credit per released lesson). Notifications preserved.
*/
CREATE OR REPLACE FUNCTION decide_booking_change(
  p_change_id uuid, p_approve boolean, p_waive_fee boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_cr    booking_change_requests%ROWTYPE;
  v_b     bookings%ROWTYPE;
  v_when  text;
  v_delta interval;
  v_scope text;
  r       bookings%ROWTYPE;
  v_freed int := 0;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_cr FROM booking_change_requests WHERE id = p_change_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'change request not found'; END IF;
  IF v_cr.status <> 'pending' THEN RAISE EXCEPTION 'already decided'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = v_cr.booking_id;
  v_scope := coalesce(v_cr.scope, 'one');

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

  -- rows this decision touches (scope over the series; falls back to the one row)
  IF v_cr.request_kind = 'reschedule' THEN
    v_delta := v_cr.proposed_starts_at - v_b.starts_at;
    FOR r IN
      SELECT * FROM bookings
      WHERE (v_scope = 'one' OR v_b.series_id IS NULL) AND id = v_b.id
         OR (v_scope = 'future' AND v_b.series_id IS NOT NULL AND series_id = v_b.series_id AND starts_at >= v_b.starts_at)
         OR (v_scope = 'all'    AND v_b.series_id IS NOT NULL AND series_id = v_b.series_id)
    LOOP
      UPDATE bookings SET starts_at = r.starts_at + v_delta, ends_at = r.ends_at + v_delta,
        status = CASE WHEN kind='lesson' THEN 'scheduled' ELSE 'confirmed' END,
        reminder_1h_sent_at = NULL, reminder_2h_sent_at = NULL, updated_at=now()
      WHERE id = r.id;
    END LOOP;
    v_when := to_char(v_cr.proposed_starts_at, 'FMMon FMDD, HH12:MI AM');
  ELSE
    FOR r IN
      SELECT * FROM bookings
      WHERE (v_scope = 'one' OR v_b.series_id IS NULL) AND id = v_b.id
         OR (v_scope = 'future' AND v_b.series_id IS NOT NULL AND series_id = v_b.series_id AND starts_at >= v_b.starts_at)
         OR (v_scope = 'all'    AND v_b.series_id IS NOT NULL AND series_id = v_b.series_id)
    LOOP
      UPDATE bookings SET status='cancelled', updated_at=now() WHERE id = r.id;
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
      VALUES (v_b.org_id, v_b.account_user_id, 'booking_' || v_cr.request_kind || '_approved',
              CASE v_cr.request_kind
                WHEN 'reschedule' THEN 'Your lesson is now ' || v_when
                WHEN 'defer' THEN 'Lesson deferred — a credit is on your account'
                ELSE 'Your booking on ' || v_when || ' is cancelled' END,
              '/app/calendar');
  END IF;

  RETURN jsonb_build_object('status','approved', 'kind', v_cr.request_kind, 'affected', greatest(v_freed,1));
END;
$fn$;
