-- TASK CASHCONFIRM — a cash payment is confirmed exactly like a Zelle one.
--
-- Owner: "cash needs to be confirmed just like zelle, the cash payment is a button
-- click on the user side and the payment confirmation page lists it just like a
-- zelle payment for confirmation and staff click a button to confirm it."
--
-- The client half (report_my_payment, ONBOARD §6) already writes an identical
-- claim shape for both methods and is untouched here except for one addition: it
-- must (re)open the claim on every report, or a decline becomes a dead end (a
-- client who is wrongly declined once could never re-file). The staff half is
-- new: a queue that lists BOTH methods' claims, and a confirm/decline pair that
-- settles through the ONE existing payment spine — mark_purchase_paid (D6) —
-- never a second write path.
--
-- The claim itself (client_reported_method/reference/at) is NEVER overwritten by
-- confirm or decline; it is retained as evidence regardless of outcome (D11). A
-- separate small state machine — client_claim_status — tracks STAFF'S handling of
-- that claim, distinct from payment_status (which a claim never touches).

-- ── the staff-facing claim state ─────────────────────────────────────────────
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS client_claim_status text
  NOT NULL DEFAULT 'none'
  CHECK (client_claim_status IN ('none','pending','confirmed','declined'));
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS client_claim_resolved_by uuid
  REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS client_claim_resolved_at timestamptz;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS client_claim_decline_reason text;

COMMENT ON COLUMN purchases.client_claim_status IS
  'CASHCONFIRM: staff handling of the current client-reported claim — ''none'' (no '
  'claim), ''pending'' (claimed, awaiting staff), ''confirmed'', ''declined''. '
  'Distinct from client_reported_* (the claim itself, never overwritten here) and '
  'from payment_status (never set by a claim — only mark_purchase_paid sets that).';

-- backfill: any pre-existing unresolved claim becomes visible in the new queue
UPDATE purchases
   SET client_claim_status = 'pending'
 WHERE client_reported_at IS NOT NULL
   AND client_claim_status = 'none'
   AND payment_status <> 'paid';

-- ── report_my_payment: unchanged claim logic, plus (re)opening the claim state ──
CREATE OR REPLACE FUNCTION public.report_my_payment(
  p_purchase_id uuid,
  p_method      text,
  p_reference   text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pur     purchases%ROWTYPE;
  v_contact uuid := current_contact_id();
  v_method  text := lower(btrim(coalesce(p_method, '')));
  v_ref     text := nullif(btrim(coalesce(p_reference, '')), '');
  v_label   text;
  v_who     text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF v_method NOT IN ('zelle', 'cash') THEN
    RAISE EXCEPTION 'a payment report is zelle or cash';
  END IF;

  SELECT * INTO v_pur FROM purchases
   WHERE id = p_purchase_id AND deleted_at IS NULL
     AND (buyer_user_id = auth.uid() OR (v_contact IS NOT NULL AND buyer_contact_id = v_contact));
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;

  IF coalesce(v_pur.payment_status, '') = 'paid' THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'already paid');
  END IF;

  UPDATE purchases
     SET client_reported_method       = v_method,
         client_reported_reference    = coalesce(v_ref, client_reported_reference),
         client_reported_at           = now(),
         -- the method the buyer intends to use IS the order's method; the amount
         -- and the memo code are untouched.
         payment_method                = v_method,
         -- CASHCONFIRM: every report (re)opens the claim for staff review, so a
         -- claim declined once can be re-filed and resurfaces in the queue.
         client_claim_status           = 'pending',
         client_claim_resolved_by      = NULL,
         client_claim_resolved_at      = NULL,
         client_claim_decline_reason   = NULL
   WHERE id = p_purchase_id;

  SELECT string_agg(pi.label, ', ' ORDER BY pi.created_at) INTO v_label
    FROM purchase_items pi WHERE pi.purchase_id = p_purchase_id;
  v_label := coalesce(nullif(btrim(v_label), ''), 'Order');

  SELECT nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), '')
    INTO v_who FROM contacts c WHERE c.id = v_pur.buyer_contact_id;
  v_who := coalesce(v_who, 'The buyer');

  -- the provable trail: one status event per report, carrying the claim verbatim
  PERFORM log_status_event(
    'order', p_purchase_id, 'payment_reported',
    CASE WHEN v_method = 'cash'
         THEN 'Client says they are paying cash'
         ELSE 'Client says they sent the Zelle payment'
              || coalesce(' — confirmation ' || v_ref, ' — no confirmation number given')
    END,
    v_pur.org_id);

  -- staff see a CLAIM, worded as a claim. The review queue is where it gets settled.
  PERFORM notify_staff(v_pur.org_id, 'payment_reported',
    v_who || ' says they paid ' || v_label
      || CASE WHEN v_method = 'cash' THEN ' in cash' ELSE ' by Zelle' END
      || coalesce(' (ref ' || v_ref || ')', '')
      || ' — not yet confirmed',
    '/app/ops/payments/review');

  RETURN jsonb_build_object('recorded', true, 'method', v_method, 'reference', v_ref);
END;
$function$;

COMMENT ON FUNCTION public.report_my_payment(uuid, text, text) IS
  'ONBOARD §6 + CASHCONFIRM: the buyer''s own statement that they have paid (Zelle, '
  'optional confirmation number) or will pay cash. Records a claim on the status '
  'trail, opens client_claim_status=pending for the staff queue, and alerts staff. '
  'NEVER sets payment_status — only staff confirmation (via mark_purchase_paid) does.';

-- report_my_payment's grants are unchanged (already authenticated + service_role,
-- REVOKE FROM PUBLIC, anon already in place from ONBOARD m4) — re-asserted below
-- for safety since REVOKE...FROM PUBLIC does not undo a direct grant if one ever
-- creeps back in (TRAPS).
REVOKE ALL ON FUNCTION public.report_my_payment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_my_payment(uuid, text, text) TO authenticated, service_role;

-- ── the two new sub-statuses on the order trail ──────────────────────────────
INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
SELECT 'order', 'claim_confirmed', 'Payment claim confirmed by staff', false, false, 26
WHERE NOT EXISTS (
  SELECT 1 FROM status_events_vocab WHERE entity_type = 'order' AND code = 'claim_confirmed');
INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
SELECT 'order', 'claim_declined', 'Payment claim declined by staff', false, false, 27
WHERE NOT EXISTS (
  SELECT 1 FROM status_events_vocab WHERE entity_type = 'order' AND code = 'claim_declined');

-- ── staff confirm: settle through the ONE existing payment spine (D6) ───────
CREATE OR REPLACE FUNCTION public.confirm_payment_claim(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pur    purchases%ROWTYPE;
  v_method text;
  v_result text;
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown purchase: %', p_purchase_id; END IF;
  IF v_pur.client_claim_status <> 'pending' THEN
    RAISE EXCEPTION 'no pending claim on this order (claim status: %)', v_pur.client_claim_status;
  END IF;

  v_method := coalesce(v_pur.client_reported_method, v_pur.payment_method, 'zelle');

  -- D6: one payment spine — the SAME function a matched Zelle payment settles
  -- through. Writes payment_status/status/paid_at/amount_paid/payment_method,
  -- fires the existing status_events trigger, and notifies the buyer + staff.
  v_result := mark_purchase_paid(
    p_purchase_id, v_pur.amount, v_pur.client_reported_reference, v_method);

  UPDATE purchases
     SET client_claim_status      = 'confirmed',
         client_claim_resolved_by = auth.uid(),
         client_claim_resolved_at = now()
   WHERE id = p_purchase_id;

  PERFORM log_status_event('order', p_purchase_id, 'claim_confirmed',
    'Confirmed by staff — settled as ' || v_method, v_pur.org_id);

  RETURN jsonb_build_object('confirmed', true, 'settlement', v_result, 'method', v_method);
END;
$function$;

COMMENT ON FUNCTION public.confirm_payment_claim(uuid) IS
  'CASHCONFIRM C2: staff confirms a pending client-reported claim (zelle or cash). '
  'Settles through mark_purchase_paid — the SAME spine a matched Zelle payment uses '
  '(D6, one payment spine, not two) — then records who/when/method on the claim.';

-- ── staff decline: the claim never arrived; payment_status never moves ──────
CREATE OR REPLACE FUNCTION public.decline_payment_claim(p_purchase_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pur    purchases%ROWTYPE;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'operator access required';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to decline a payment claim';
  END IF;

  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown purchase: %', p_purchase_id; END IF;
  IF v_pur.client_claim_status <> 'pending' THEN
    RAISE EXCEPTION 'no pending claim on this order (claim status: %)', v_pur.client_claim_status;
  END IF;

  -- the claim itself (client_reported_*) is retained verbatim — evidence, D11.
  -- payment_status is untouched: a claim never set it, so there is nothing to
  -- revert; only the resolution is recorded.
  UPDATE purchases
     SET client_claim_status         = 'declined',
         client_claim_resolved_by    = auth.uid(),
         client_claim_resolved_at    = now(),
         client_claim_decline_reason = v_reason
   WHERE id = p_purchase_id;

  PERFORM log_status_event('order', p_purchase_id, 'claim_declined', v_reason, v_pur.org_id);

  RETURN jsonb_build_object('declined', true, 'reason', v_reason);
END;
$function$;

COMMENT ON FUNCTION public.decline_payment_claim(uuid, text) IS
  'CASHCONFIRM C2: staff declines a pending client-reported claim that never '
  'arrived. payment_status is untouched (a claim never set it) and the claim row '
  'is retained, never deleted (D11) — only its resolution (who/when/reason) is '
  'recorded. report_my_payment reopens the claim (client_claim_status=pending) if '
  'the client reports again.';

-- ── grants: authenticated + service_role, never PUBLIC/anon (TRAPS) ─────────
REVOKE ALL ON FUNCTION public.confirm_payment_claim(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment_claim(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.decline_payment_claim(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_payment_claim(uuid, text) TO authenticated, service_role;
