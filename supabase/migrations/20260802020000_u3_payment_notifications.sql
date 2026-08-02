-- U3 — PAYMENT NOTIFICATIONS
-- Spec: master-finishing-plan.md U3. Verify-first: every function below was
-- rebuilt as a full CREATE OR REPLACE from its LIVE pg_get_functiondef body
-- captured 2026-08-01.
--
-- VERIFIED LIVE BEFORE WRITING:
--   * mark_purchase_paid is the SINGLE payment-side convergence point. All
--     three payment routes reach it over HTTP — api/stripe-webhook.ts,
--     api/_lib/reconcile.ts (Zelle), and the manual mark-paid path — and it has
--     ZERO database-side callers, so the producer placed here fires exactly
--     once per payment regardless of route.
--   * Three other functions match /payment_status = 'paid'/ but none is a
--     producer: transfer_payment_responsibility GUARDS on it
--     ("this purchase is already paid"), and feed_seed_welcome /
--     my_onboarding_state only READ it. finalize_purchase_payment generates a
--     payment reference and never sets paid.
--   * Routes confirmed in src/App.tsx: buyer -> /app/orders (line 215),
--     staff -> /app/ops/payments/review (line 270).
--
-- MODEL: the unpaid alert is a STANDING condition (it resolves when the
-- condition ends), the received alert is INFORMATIONAL (it resolves on read
-- like any other). Emails ride the existing digest — no new sender.

BEGIN;

-- ============================================================================
-- U3(a) — purchase created unpaid/awaiting -> buyer + staff alerts
-- ============================================================================
-- Separated from the provisioning function so both the provisioning path and
-- any future purchase-creation path produce an identical alert pair. The link
-- is per-purchase so resolution can be scoped to exactly this purchase.
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
      '/app/orders');
  END IF;

  -- staff, at the review queue
  PERFORM notify_staff(v_pur.org_id, 'purchase_unpaid',
    v_label || ' — awaiting payment (' || v_due || ')',
    '/app/ops/payments/review');
END;
$function$;

COMMENT ON FUNCTION public.notify_purchase_unpaid(uuid) IS
  'U3(a): standing "payment due" alerts to buyer and staff. Resolved by mark_purchase_paid when payment lands.';

-- ============================================================================
-- U3(b) — payment recorded -> resolve the unpaid alerts, raise "received"
-- ============================================================================
-- Full replacement from the live body. The ONLY change is the notification
-- block appended after the UPDATE: the producer lives HERE, once, because all
-- three payment routes converge here.
CREATE OR REPLACE FUNCTION public.mark_purchase_paid(p_purchase_id uuid, p_amount numeric, p_reference text DEFAULT NULL::text, p_method text DEFAULT 'zelle'::text)
 RETURNS text
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

  -- U3: the payment-side producer. Every route (Stripe webhook, Zelle
  -- reconcile, manual mark-paid) converges on this function, so this fires
  -- exactly once per payment and cannot be duplicated per-route.
  SELECT string_agg(pi.label, ', ' ORDER BY pi.created_at) INTO v_label
    FROM purchase_items pi WHERE pi.purchase_id = p_purchase_id;
  v_label := coalesce(nullif(btrim(v_label), ''), 'Your order');
  v_paid  := fmt_money(coalesce(v_pur.amount, p_amount, 0));

  -- the standing "payment due" condition has ENDED — resolve both alerts.
  -- Kind-scoped (U1 item 5a) so nothing else on those links is disturbed.
  PERFORM resolve_notifications_for_link('/app/orders', NULL, 'purchase_unpaid');
  PERFORM resolve_notifications_for_link('/app/ops/payments/review', NULL, 'purchase_unpaid');

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

COMMIT;
-- U3(a) wiring — _provision_purchase_for_offerings rebuilt as a full
-- CREATE OR REPLACE from its LIVE body (2026-08-01). One change: the
-- unpaid-alert producer at the tail, after the purchase and its items
-- exist so the notification can name them.

CREATE OR REPLACE FUNCTION public._provision_purchase_for_offerings(p_org_id uuid, p_contact_id uuid, p_client_id uuid, p_offering_ids uuid[], p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_partial_amount numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase uuid;
  v_total    numeric;
  v_paid     numeric;
  v_off      offerings%ROWTYPE;
  v_lessons  integer;
BEGIN
  IF array_length(p_offering_ids, 1) IS NULL THEN
    RETURN NULL;  -- nothing to purchase
  END IF;

  SELECT coalesce(sum(o.price_amount), 0) INTO v_total
    FROM offerings o WHERE o.id = ANY(p_offering_ids);

  -- amount_paid: full total when marked paid; else the (clamped) partial amount.
  v_paid := CASE
    WHEN p_mark_paid THEN v_total
    ELSE least(greatest(coalesce(p_partial_amount, 0), 0), v_total)
  END;

  -- payment_status CHECK allows unpaid|pending|paid. A partial payment is
  -- 'pending' (some paid, balance owed) with the exact paid figure in amount_paid.
  INSERT INTO purchases (org_id, buyer_contact_id, status, amount, amount_paid,
                         payment_method, payment_status, payment_reference, paid_at, notes)
    VALUES (p_org_id, p_contact_id,
            CASE WHEN p_mark_paid THEN 'paid' ELSE 'awaiting_payment' END,
            v_total, v_paid, p_payment_method,
            CASE WHEN p_mark_paid THEN 'paid'
                 WHEN v_paid > 0  THEN 'pending'
                 ELSE 'unpaid' END,
            CASE WHEN p_mark_paid THEN 'Provisioned — paid in full via ' || coalesce(p_payment_method, 'offline payment')
                 WHEN v_paid > 0  THEN 'Provisioned — partial ' || v_paid::text || ' via ' || coalesce(p_payment_method, 'offline payment') END,
            CASE WHEN p_mark_paid THEN now() END,
            coalesce(p_notes, 'Provisioned invitation'))
    RETURNING id INTO v_purchase;

  INSERT INTO purchase_items (org_id, purchase_id, offering_id, label, price_amount, price_unit, quantity)
  SELECT p_org_id, v_purchase, o.id, o.name, o.price_amount, o.price_unit, 1
    FROM offerings o WHERE o.id = ANY(p_offering_ids);

  -- each lesson-count offering also grants its punch-card credits
  FOR v_off IN SELECT o.* FROM offerings o WHERE o.id = ANY(p_offering_ids) LOOP
    v_lessons := CASE
      WHEN v_off.name ~ '(\d+)-Lesson' THEN (regexp_match(v_off.name, '(\d+)-Lesson'))[1]::int
      WHEN v_off.price_unit = 'session' THEN 1
      ELSE NULL END;
    IF v_lessons IS NOT NULL AND v_lessons > 0 THEN
      INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining)
        VALUES (p_org_id, p_client_id, v_off.name, v_lessons, v_lessons);
    END IF;
  END LOOP;

  -- U3(a): a purchase that owes money raises the standing "payment due" pair
  -- (buyer + staff). The helper no-ops when the purchase was provisioned paid.
  PERFORM notify_purchase_unpaid(v_purchase);

  RETURN v_purchase;
END;
$function$

;
