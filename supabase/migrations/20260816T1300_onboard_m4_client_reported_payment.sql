-- TASK ONBOARD §6 — the client tells us they paid, and that is recorded as a CLAIM.
--
-- Owner: "since we are using zelle there isnt really anything we can do to know they
-- made the payment until we get a payment email from zelle, so we just show them the
-- payment information screen … they can insert a payment confirmation number when they
-- click the button to confirm they made the payment to us but if they leave it blank
-- thats ok. we see they said they made payment and we can monitor for it … if they pay
-- cash they need to be able to have an option on the payment page to click a button for
-- that so its marked paid by cash."
--
-- THE ONE THING THIS MUST NOT DO is let a member mark their own order paid. The task is
-- explicit: "this is NOT payment confirmation, and must not be presented to staff as
-- one." So `report_my_payment` writes a CLAIM — a sub-status on the order's status trail
-- plus three columns saying who said what and when — and never touches payment_status.
-- Reconciliation stays where it already is: the Zelle inbox, /app/ops/payments/review,
-- and mark_purchase_paid (staff/service-role only, unchanged).
--
-- CASH IS THE SAME SHAPE, DELIBERATELY. The owner's words are "marked paid by cash", and
-- one reading is that the button settles the order outright. It does not here: cash is
-- physically handed over at the ranch, so at the moment the button is pressed the money
-- has no more arrived than a Zelle transfer has cleared. It records "paying by cash",
-- sets the order's payment method, and puts it in front of staff to settle. Flagged in
-- the report as an owner ruling to confirm — the difference is one line in this function.

-- ── the claim, on the order ──────────────────────────────────────────────────
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS client_reported_method    text;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS client_reported_reference text;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS client_reported_at        timestamptz;

COMMENT ON COLUMN purchases.client_reported_method IS
  'ONBOARD §6: what the BUYER says they did — ''zelle'' or ''cash''. A claim, never a '
  'confirmation. payment_status is still only ever written by staff reconciliation.';
COMMENT ON COLUMN purchases.client_reported_reference IS
  'ONBOARD §6: the confirmation number the buyer typed, if they typed one. Optional by '
  'owner instruction ("if they leave it blank thats ok"). NOT payment_reference — that '
  'is the memo code WE generate for matching, and it is never overwritten by this.';

-- 'payment_reported' is a SUB-status (is_true_status = false): it goes on the trail
-- without moving the order's true status, which is exactly what a claim should do.
INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
SELECT 'order', 'payment_reported', 'Payment reported by client', false, false, 25
WHERE NOT EXISTS (
  SELECT 1 FROM status_events_vocab WHERE entity_type = 'order' AND code = 'payment_reported');

-- ── the member's own report ──────────────────────────────────────────────────
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
     SET client_reported_method    = v_method,
         client_reported_reference = coalesce(v_ref, client_reported_reference),
         client_reported_at        = now(),
         -- the method the buyer intends to use IS the order's method; the amount
         -- and the memo code are untouched.
         payment_method            = v_method
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
  'ONBOARD §6: the buyer''s own statement that they have paid (Zelle, optional '
  'confirmation number) or will pay cash. Records a claim on the status trail and alerts '
  'staff. NEVER sets payment_status — only staff reconciliation does that.';

-- ── the dashboard notice lands on the payment screen ─────────────────────────
-- Owner: "they will see that as a notice on their dashboard for them to click on,
-- review, and then see the payment screen." The buyer's notice pointed at /app/orders,
-- a list — one extra hop away from the thing they were told to do. It now points at the
-- order itself, which IS the review-and-pay page. The link is also the resolution key
-- (resolve_notifications_for_link matches on it exactly), so mark_purchase_paid is
-- updated in lockstep below; otherwise a paid order would leave its "payment due" notice
-- sitting on the dashboard forever.
CREATE OR REPLACE FUNCTION public.notify_purchase_unpaid(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pur   purchases%ROWTYPE;
  v_user  uuid;
  v_label text;
  v_due   text;
BEGIN
  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  -- only for a purchase that actually owes money
  IF coalesce(v_pur.payment_status, '') NOT IN ('unpaid', 'pending') THEN RETURN; END IF;

  SELECT string_agg(pi.label, ', ' ORDER BY pi.created_at) INTO v_label
    FROM purchase_items pi WHERE pi.purchase_id = p_purchase_id;
  v_label := coalesce(nullif(btrim(v_label), ''), 'Your order');
  v_due   := fmt_money(greatest(coalesce(v_pur.amount, 0) - coalesce(v_pur.amount_paid, 0), 0));

  -- the buyer, when they have an account
  SELECT pr.user_id INTO v_user
    FROM profiles pr WHERE pr.contact_id = v_pur.buyer_contact_id LIMIT 1;
  IF v_user IS NOT NULL THEN
    PERFORM notify_user(v_user, 'purchase_unpaid',
      v_label || ' — payment due',
      'Your order is confirmed and awaiting payment of ' || v_due || '.',
      '/order/' || p_purchase_id::text);
  END IF;

  -- staff, at the review queue
  PERFORM notify_staff(v_pur.org_id, 'purchase_unpaid',
    v_label || ' — awaiting payment (' || v_due || ')',
    '/app/ops/payments/review');
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_purchase_paid(
  p_purchase_id uuid, p_amount numeric, p_reference text DEFAULT NULL::text,
  p_method text DEFAULT 'zelle'::text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pur purchases%ROWTYPE;
  v_user  uuid;
  v_label text;
  v_paid  text;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown purchase: %', p_purchase_id;
  END IF;
  IF v_pur.payment_status = 'paid' THEN
    RETURN 'already_paid';
  END IF;

  UPDATE purchases p
     SET payment_status    = 'paid',
         status            = 'paid',
         paid_at           = now(),
         amount_paid       = COALESCE(p.amount, 0),
         payment_method    = p_method,
         payment_reference = COALESCE(p.payment_reference, p_reference)
   WHERE p.id = p_purchase_id;

  SELECT string_agg(pi.label, ', ' ORDER BY pi.created_at) INTO v_label
    FROM purchase_items pi WHERE pi.purchase_id = p_purchase_id;
  v_label := coalesce(nullif(btrim(v_label), ''), 'Your order');
  v_paid  := fmt_money(coalesce(v_pur.amount, p_amount, 0));

  -- ONBOARD §6: the buyer's "payment due" notice now targets the order page, so
  -- resolve BOTH forms — the new one and any notice raised before this migration.
  PERFORM resolve_notifications_for_link('/order/' || p_purchase_id::text, NULL, 'purchase_unpaid');
  PERFORM resolve_notifications_for_link('/app/orders', NULL, 'purchase_unpaid');
  PERFORM resolve_notifications_for_link('/app/ops/payments/review', NULL, 'purchase_unpaid');
  PERFORM resolve_notifications_for_link('/app/ops/payments/review', NULL, 'payment_reported');

  SELECT pr.user_id INTO v_user
    FROM profiles pr WHERE pr.contact_id = v_pur.buyer_contact_id LIMIT 1;
  IF v_user IS NOT NULL THEN
    PERFORM notify_user(v_user, 'payment_received',
      'Payment received — ' || v_label,
      'We received your payment of ' || v_paid || '. Thank you.',
      '/app/orders');
  END IF;

  PERFORM notify_staff(v_pur.org_id, 'payment_received',
    'Payment received — ' || v_label || ' (' || v_paid || ')',
    '/app/ops/payments/review');

  RETURN 'paid';
END;
$function$;

REVOKE ALL ON FUNCTION public.report_my_payment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_my_payment(uuid, text, text) TO authenticated, service_role;
