/*
  # Spine — per-item approval action + hold reaper (Slice 2b)

  approve_line_item(selection_id, assigned_date):
    - moves a line item received/in_review → approved_awaiting_claim
    - stamps approved_at = now(), hold_expires_at = now() + 48h (flat)
    - assigns the date (nullable — some items have no hard date)
    - provisions the engagement (AWAITING_SIGNATURE) via provision_lesson_invitation
      on FIRST approval for this contact/request, so the client can activate + sign.
    Staff-only. Returns the invitation token (for the account-link email) + engagement.

  reap_expired_holds():
    - real-time expiry is by COMPUTATION elsewhere; this is the HOUSEKEEPING sweep.
    - lapses line items past hold_expires_at (state → lapsed, approval preserved,
      hold released), and calls release_expired_holds() for the order/slot side.
    - CALLER gates the 6am-9pm window (the /api/expire-holds cron only invokes this
      between 06:00-21:00 local); the function itself is time-agnostic and safe anytime.
    - Returns count of lapsed items.
*/

-- Per-item approval. SECURITY DEFINER, staff-gated.
CREATE OR REPLACE FUNCTION approve_line_item(
  p_selection_id uuid,
  p_assigned_date date DEFAULT NULL,
  p_mark_paid boolean DEFAULT false,
  p_payment_method text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_sel      request_selections%ROWTYPE;
  v_req      requests%ROWTYPE;
  v_prov     jsonb;
  v_eng      uuid;
  v_names    text[];
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to approve line items';
  END IF;

  SELECT * INTO v_sel FROM request_selections WHERE id = p_selection_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown line item: %', p_selection_id; END IF;
  IF v_sel.state NOT IN ('received','in_review','lapsed') THEN
    RAISE EXCEPTION 'line item is % — cannot approve', v_sel.state;
  END IF;
  SELECT * INTO v_req FROM requests WHERE id = v_sel.request_id;

  -- Provision the engagement + invitation the FIRST time this request is approved
  -- (reuse the flat-offering provisioning RPC). Subsequent approvals on the same
  -- request attach to the existing engagement if one already exists for the item.
  IF v_sel.engagement_id IS NULL AND v_sel.offering_id IS NOT NULL THEN
    v_names := regexp_split_to_array(coalesce(v_req.contact_name,''), '\s+');
    v_prov := provision_lesson_invitation(
      v_req.contact_email,
      coalesce(v_names[1], v_req.contact_name, 'Client'),
      coalesce(array_to_string(v_names[2:], ' '), '.'),
      v_sel.offering_id,
      p_mark_paid, p_payment_method,
      coalesce(v_sel.disposition_note, v_req.notes),
      v_sel.request_id);
    v_eng := (v_prov->>'engagement_id')::uuid;
  ELSE
    v_eng := v_sel.engagement_id;
  END IF;

  UPDATE request_selections SET
    state           = 'approved_awaiting_claim',
    approved_at     = now(),
    hold_expires_at = now() + interval '48 hours',
    assigned_date   = coalesce(p_assigned_date, assigned_date),
    engagement_id   = v_eng
  WHERE id = p_selection_id;

  -- stamp the invitation window on the parent (first approval only)
  UPDATE requests SET
    invited_at = coalesce(invited_at, now()),
    invitation_expires_at = coalesce(invitation_expires_at, now() + interval '7 days')
  WHERE id = v_sel.request_id;

  RETURN jsonb_build_object(
    'selection_id', p_selection_id,
    'engagement_id', v_eng,
    'hold_expires_at', (now() + interval '48 hours'),
    'invitation', v_prov);
END;
$fn$;

REVOKE ALL ON FUNCTION approve_line_item(uuid, date, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_line_item(uuid, date, boolean, text) TO authenticated, service_role;

-- Hold reaper (housekeeping; caller gates the 6am-9pm window).
CREATE OR REPLACE FUNCTION reap_expired_holds()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_count integer := 0;
BEGIN
  -- lapse line items past their 48h hold (approval preserved; re-offer resets)
  UPDATE request_selections SET state = 'lapsed'
   WHERE state = 'approved_awaiting_claim'
     AND hold_expires_at IS NOT NULL
     AND hold_expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- order/booking/slot side (existing housekeeping)
  PERFORM release_expired_holds();

  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION reap_expired_holds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reap_expired_holds() TO service_role;
