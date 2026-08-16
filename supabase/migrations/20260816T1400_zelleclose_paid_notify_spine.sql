-- TASK ZELLECLOSE — one spine for "a purchase became paid", not two.
--
-- MEASURED: `mark_purchase_paid` (the automatic-match + any future manual-mark
-- path) sends a "payment received" notification to the buyer and to staff.
-- `_provision_purchase_for_offerings` (BOOKLINK's create-and-mark-paid path,
-- reached when staff book a lesson and choose "already paid") writes the exact
-- same terminal columns (status/payment_status/paid_at/payment_method) directly
-- on INSERT — status_events still fires either way (trg_status_purchases, BEFORE
-- INSERT OR UPDATE OF status, payment_status) — but NEITHER buyer nor staff was
-- ever notified on that path, because the notify calls lived inline inside
-- mark_purchase_paid only. Two writers, one of them silent.
--
-- FIX: extract the notify side-effects into one internal helper and call it from
-- both writers. Byte-identical notification behavior either way from now on.

CREATE OR REPLACE FUNCTION public._notify_purchase_paid(p_purchase_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pur   purchases%ROWTYPE;
  v_user  uuid;
  v_label text;
  v_paid  text;
BEGIN
  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT string_agg(pi.label, ', ' ORDER BY pi.created_at) INTO v_label
    FROM purchase_items pi WHERE pi.purchase_id = p_purchase_id;
  v_label := coalesce(nullif(btrim(v_label), ''), 'Your order');
  v_paid  := fmt_money(coalesce(v_pur.amount, 0));

  -- resolve any standing "payment due" / "you said you paid" notices
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
END;
$function$;

REVOKE ALL ON FUNCTION public._notify_purchase_paid(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._notify_purchase_paid(uuid) TO service_role;

-- mark_purchase_paid: same guard/UPDATE/already_paid short-circuit, notify tail
-- now delegates to the shared helper instead of inlining it.
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

  PERFORM _notify_purchase_paid(p_purchase_id);

  RETURN 'paid';
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_purchase_paid(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_purchase_paid(uuid, numeric, text, text) TO authenticated, service_role;

-- _provision_purchase_for_offerings: byte-identical to CREDITFIX's body, plus
-- one call on the p_mark_paid branch so a booking created "already paid" tells
-- the buyer and staff exactly like every other paid path does.
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
  v_item     record;
  v_units    integer;
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

  -- CREDITFIX: mint = offerings.unit_count * purchase_items.quantity for
  -- scheduled SKUs whose segment isn't 'horse'. The name regex is gone.
  FOR v_item IN
    SELECT o.id AS offering_id, o.name, o.unit_count, pi.quantity
      FROM purchase_items pi
      JOIN offerings o ON o.id = pi.offering_id
     WHERE pi.purchase_id = v_purchase
       AND o.config_kind = 'scheduled'
       AND o.segment <> 'horse'
       AND o.unit_count IS NOT NULL
       AND o.unit_count > 0
  LOOP
    v_units := v_item.unit_count * coalesce(v_item.quantity, 1);
    INSERT INTO lesson_credits (org_id, client_id, offering_id, purchase_id,
                                package_key, credits_total, credits_remaining)
      VALUES (p_org_id, p_client_id, v_item.offering_id, v_purchase,
              v_item.name, v_units, v_units);
  END LOOP;

  IF p_mark_paid THEN
    -- ZELLECLOSE: same "payment received" trail mark_purchase_paid gives every
    -- other paid purchase — this one was just paid at creation, not by an UPDATE.
    PERFORM _notify_purchase_paid(v_purchase);
  ELSE
    -- U3(a): a purchase that owes money raises the standing "payment due" pair
    -- (buyer + staff). No-op when paid (handled above instead).
    PERFORM notify_purchase_unpaid(v_purchase);
  END IF;

  RETURN v_purchase;
END;
$function$;
