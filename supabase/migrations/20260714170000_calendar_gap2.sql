/*
  # Phase 6 gap-2 — assign-purchase reader + client "N weeks" recurring move

  A. client_purchases(client) — the purchases a booking can be assigned to, for
     the staff config panel's purchase picker.
  B. decide_booking_change rebuilt to also honor scope 'weeks:N' (move/cancel the
     next N occurrences of a series) alongside one / future / all.
*/

-- ── A. purchases for a client (staff picker) ─────────────────────────────────
CREATE OR REPLACE FUNCTION client_purchases(p_client_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', pu.id, 'amount', pu.amount,
        'label', coalesce((SELECT pi.label FROM purchase_items pi WHERE pi.purchase_id = pu.id ORDER BY pi.created_at DESC LIMIT 1), 'Purchase'),
        'created_at', pu.created_at) ORDER BY pu.created_at DESC), '[]'::jsonb)
    FROM purchases pu
    JOIN clients cl ON cl.contact_id = pu.buyer_contact_id
    WHERE cl.id = p_client_id AND pu.org_id = current_org() AND pu.deleted_at IS NULL);
END;
$fn$;
REVOKE ALL ON FUNCTION client_purchases(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION client_purchases(uuid) TO authenticated, service_role;

-- ── B. decide_booking_change + 'weeks:N' scope ───────────────────────────────
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
  v_ids   uuid[];
  v_n     int;
  rid     uuid;
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

  IF v_cr.request_kind = 'reschedule' THEN
    v_delta := v_cr.proposed_starts_at - v_b.starts_at;
    FOREACH rid IN ARRAY v_ids LOOP
      SELECT * INTO r FROM bookings WHERE id = rid;
      UPDATE bookings SET starts_at = r.starts_at + v_delta, ends_at = r.ends_at + v_delta,
        status = CASE WHEN kind='lesson' THEN 'scheduled' ELSE 'confirmed' END,
        reminder_1h_sent_at = NULL, reminder_2h_sent_at = NULL, updated_at=now()
      WHERE id = rid;
    END LOOP;
    v_when := to_char(v_cr.proposed_starts_at, 'FMMon FMDD, HH12:MI AM');
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
      VALUES (v_b.org_id, v_b.account_user_id, 'booking_' || v_cr.request_kind || '_approved',
              CASE v_cr.request_kind
                WHEN 'reschedule' THEN 'Your lesson is now ' || v_when
                WHEN 'defer' THEN 'Lesson deferred — a credit is on your account'
                ELSE 'Your booking on ' || v_when || ' is cancelled' END,
              '/app/calendar');
  END IF;

  RETURN jsonb_build_object('status','approved', 'kind', v_cr.request_kind, 'affected', coalesce(array_length(v_ids,1),1));
END;
$fn$;
