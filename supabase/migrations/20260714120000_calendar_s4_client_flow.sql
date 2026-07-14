/*
  # Phase 6 · Slice 4 — the client booking + change flow

  Clients act on the same calendar: book a flexible-open block, or request a
  reschedule / cancel / defer on their own booking. Every client change is a
  REQUEST that staff approve — pending (orange) until decided (green), shown on
  the requester's dashboard the whole time.

  Timing rules (owner):
   - > 48h  : reschedule/cancel freely → pending until staff confirm, no fee.
   - 24–48h : same, but a reschedule fee applies (payment surfaced before submit;
              staff may waive).
   - < 24h  : same submittable request, fee applies, AND a phone call is required
              (the app is not the sole channel) — the submission timestamp is the
              shared record.
  Defer → a lesson credit (granted on approval; no limit). Cancel of a paid
  lesson → a credit on approval. Booking a flexible slot uses a credit, else the
  caller is told to purchase (NO_CREDITS).

  A. calendar_settings (per-org reschedule fee) + reschedule_fee() helper.
  B. book_open_slot — a client claims a flexible block (credit-gated).
  C. request_booking_change — reschedule / cancel / defer (fee + phone flags).
  D. decide_booking_change — staff approve/reject; applies the effect.
  E. my_pending_changes() + open_change_requests() readers.
*/

-- ── A. settings + fee ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_settings (
  org_id         uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  reschedule_fee numeric(10,2) NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calendar_settings_read ON calendar_settings;
CREATE POLICY calendar_settings_read ON calendar_settings
  FOR SELECT TO authenticated USING (org_id = current_org());
DROP POLICY IF EXISTS calendar_settings_write ON calendar_settings;
CREATE POLICY calendar_settings_write ON calendar_settings
  FOR ALL TO authenticated
  USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());
INSERT INTO calendar_settings (org_id) VALUES ('e656f20b-ef43-4725-9029-19e7f0190d9c')
  ON CONFLICT (org_id) DO NOTHING;

CREATE OR REPLACE FUNCTION set_calendar_settings(p_reschedule_fee numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  INSERT INTO calendar_settings (org_id, reschedule_fee, updated_at)
    VALUES (current_org(), coalesce(p_reschedule_fee,0), now())
  ON CONFLICT (org_id) DO UPDATE SET reschedule_fee = excluded.reschedule_fee, updated_at = now();
END;
$fn$;
REVOKE ALL ON FUNCTION set_calendar_settings(numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION set_calendar_settings(numeric) TO authenticated, service_role;

-- the fee owed for a change on a booking starting at p_start (0 when > 48h out).
CREATE OR REPLACE FUNCTION reschedule_fee(p_org uuid, p_start timestamptz)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT CASE WHEN p_start - now() < interval '48 hours'
              THEN coalesce((SELECT reschedule_fee FROM calendar_settings WHERE org_id = p_org), 0)
              ELSE 0 END
$fn$;

-- ── B. book a flexible-open block ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION book_open_slot(p_booking_id uuid, p_horse_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_client uuid := current_client_id();
  v_b      bookings%ROWTYPE;
  v_kind   text;
  v_credit uuid;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no client profile'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR NOT v_b.is_flexible OR v_b.status <> 'available' THEN
    RAISE EXCEPTION 'that time is no longer open';
  END IF;

  -- lesson vs care from the offering; lessons are credit-gated.
  SELECT CASE WHEN o.segment = 'horse' THEN 'care' ELSE 'lesson' END INTO v_kind
    FROM offerings o WHERE o.id = v_b.offering_id;
  v_kind := coalesce(v_kind, 'lesson');

  IF v_kind = 'lesson' THEN
    UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
     WHERE id = (SELECT id FROM lesson_credits
                 WHERE client_id = v_client AND org_id = v_b.org_id
                   AND deleted_at IS NULL AND credits_remaining > 0
                 ORDER BY purchased_at, created_at LIMIT 1 FOR UPDATE)
     RETURNING id INTO v_credit;
    IF v_credit IS NULL THEN RAISE EXCEPTION 'NO_CREDITS'; END IF;
  END IF;

  UPDATE bookings SET
    kind = v_kind, status = 'scheduled', is_flexible = false,
    client_id = v_client,
    account_user_id = auth.uid(),
    horse_id = coalesce(p_horse_id, horse_id),
    credit_id = v_credit,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'scheduled', 'kind', v_kind);
END;
$fn$;
REVOKE ALL ON FUNCTION book_open_slot(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION book_open_slot(uuid, uuid) TO authenticated, service_role;

-- ── C. request a change (reschedule / cancel / defer) ────────────────────────
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

  -- the booking reads as pending while a change is open
  UPDATE bookings SET status = 'pending', updated_at = now()
   WHERE id = p_booking_id AND status IN ('scheduled','confirmed');

  RETURN jsonb_build_object(
    'change_id', v_id, 'fee_amount', NULLIF(v_fee,0), 'phone_required', v_phone,
    'kind', p_kind);
END;
$fn$;
REVOKE ALL ON FUNCTION request_booking_change(uuid, text, timestamptz, timestamptz, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION request_booking_change(uuid, text, timestamptz, timestamptz, text, text) TO authenticated, service_role;

-- ── D. staff decide ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION decide_booking_change(
  p_change_id uuid, p_approve boolean, p_waive_fee boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_cr booking_change_requests%ROWTYPE;
  v_b  bookings%ROWTYPE;
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
    RETURN jsonb_build_object('status','rejected');
  END IF;

  -- approve → apply the effect
  IF v_cr.request_kind = 'reschedule' THEN
    UPDATE bookings SET starts_at=v_cr.proposed_starts_at, ends_at=v_cr.proposed_ends_at,
      status = CASE WHEN kind='lesson' THEN 'scheduled' ELSE 'confirmed' END, updated_at=now()
      WHERE id = v_cr.booking_id;
  ELSE
    -- cancel or defer: release the booking; grant a credit (defer always; cancel
    -- when it was a lesson — assumed paid/credit-based).
    UPDATE bookings SET status='cancelled', updated_at=now() WHERE id = v_cr.booking_id;
    IF v_cr.request_kind = 'defer' OR v_b.kind = 'lesson' THEN
      INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining, purchased_at)
        VALUES (v_b.org_id, v_b.client_id, 'change_credit', 1, 1, now());
    END IF;
  END IF;

  UPDATE booking_change_requests
    SET status='approved', fee_waived = p_waive_fee, decided_by=auth.uid(), decided_at=now()
    WHERE id=p_change_id;
  RETURN jsonb_build_object('status','approved', 'kind', v_cr.request_kind);
END;
$fn$;
REVOKE ALL ON FUNCTION decide_booking_change(uuid, boolean, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION decide_booking_change(uuid, boolean, boolean) TO authenticated, service_role;

-- mark a change's fee paid (Zelle recognition or manual staff confirm).
CREATE OR REPLACE FUNCTION mark_change_fee_paid(p_change_id uuid, p_paid boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  UPDATE booking_change_requests SET fee_paid = p_paid
   WHERE id = p_change_id AND org_id = current_org();
END;
$fn$;
REVOKE ALL ON FUNCTION mark_change_fee_paid(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION mark_change_fee_paid(uuid, boolean) TO authenticated, service_role;

-- ── E. readers ───────────────────────────────────────────────────────────────
-- the requester's own open changes (dashboard pending badge).
CREATE OR REPLACE FUNCTION my_pending_changes()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', cr.id, 'booking_id', cr.booking_id, 'kind', cr.request_kind,
      'status', cr.status, 'proposed_starts_at', cr.proposed_starts_at,
      'fee_amount', cr.fee_amount, 'fee_paid', cr.fee_paid, 'phone_required', cr.phone_required,
      'created_at', cr.created_at) ORDER BY cr.created_at DESC), '[]'::jsonb)
  FROM booking_change_requests cr
  WHERE cr.requested_by = auth.uid() AND cr.status = 'pending'
$fn$;
REVOKE ALL ON FUNCTION my_pending_changes() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_pending_changes() TO authenticated, service_role;

-- staff inbox of open change requests, newest first.
CREATE OR REPLACE FUNCTION open_change_requests()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', cr.id, 'booking_id', cr.booking_id, 'kind', cr.request_kind,
        'proposed_starts_at', cr.proposed_starts_at, 'proposed_ends_at', cr.proposed_ends_at,
        'fee_amount', cr.fee_amount, 'fee_paid', cr.fee_paid, 'phone_required', cr.phone_required,
        'note', cr.note, 'created_at', cr.created_at,
        'client_name', trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
        'starts_at', b.starts_at) ORDER BY cr.created_at DESC), '[]'::jsonb)
    FROM booking_change_requests cr
    JOIN bookings b ON b.id = cr.booking_id
    LEFT JOIN clients cl ON cl.id = b.client_id
    LEFT JOIN contacts c ON c.id = cl.contact_id
    WHERE cr.org_id = current_org() AND cr.status = 'pending');
END;
$fn$;
REVOKE ALL ON FUNCTION open_change_requests() FROM public, anon;
GRANT EXECUTE ON FUNCTION open_change_requests() TO authenticated, service_role;
