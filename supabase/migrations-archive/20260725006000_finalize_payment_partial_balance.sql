-- Partial payments: the payment modal must show the BALANCE, not the full total.
--
-- finalize_purchase_payment recomputes the total from purchase_items and sets
-- unique_amount = total — which ignores any partial payment already recorded at
-- provisioning time (purchases.amount_paid). The invitee would then be asked to
-- pay the full amount via Zelle instead of just the remaining balance.
--
-- Fix: the amount to pay (and the Zelle match key, unique_amount) is
-- total - amount_paid; amount stays the full order total; amount_paid is
-- preserved. When nothing was pre-paid, amount_paid = 0 and behavior is
-- unchanged.

CREATE OR REPLACE FUNCTION public.finalize_purchase_payment(p_purchase_id uuid, p_method text)
 RETURNS TABLE(unique_amount numeric, payment_reference text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pur     purchases%ROWTYPE;
  v_total   numeric;
  v_balance numeric;
  v_ref     text;
  v_prefix  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  SELECT * INTO v_pur FROM purchases
   WHERE id = p_purchase_id AND buyer_user_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'purchase not found';
  END IF;

  SELECT COALESCE(SUM(pi.price_amount * COALESCE(pi.quantity, 1)), 0) INTO v_total
    FROM purchase_items pi WHERE pi.purchase_id = p_purchase_id;
  IF v_total = 0 THEN v_total := COALESCE(v_pur.amount, 0); END IF;

  -- Balance owed after any partial already paid at provisioning time.
  v_balance := greatest(v_total - COALESCE(v_pur.amount_paid, 0), 0);

  IF v_pur.payment_reference IS NULL THEN
    SELECT cv.value_text INTO v_prefix
      FROM config_values cv
     WHERE cv.org_id = v_pur.org_id AND cv.namespace = 'BRAND' AND cv.key = 'SHORT_NAME';
    v_prefix := COALESCE(NULLIF(regexp_replace(upper(v_prefix), '[^A-Z0-9]', '', 'g'), ''), 'PUR');
    v_ref := v_prefix || '-' || upper(substr(md5(p_purchase_id::text || v_prefix), 1, 6));
  ELSE
    v_ref := v_pur.payment_reference;
  END IF;

  UPDATE purchases p
     SET amount            = v_total,       -- the full order total
         -- the amount the invitee pays now (= the balance); the memo reference
         -- is the true match key, this is the exact expected Zelle amount.
         unique_amount     = v_balance,
         payment_reference = v_ref,
         payment_method    = p_method,
         status            = 'awaiting_payment',
         payment_status    = 'pending'
         -- amount_paid intentionally preserved
   WHERE p.id = p_purchase_id;

  RETURN QUERY SELECT v_balance, v_ref;
END;
$function$;

-- mark_purchase_paid: when a payment is matched (manual or automated Zelle) and
-- flips the purchase to paid, record the full amount as paid so amount_paid
-- reflects reality (balance = 0). Preserves the existing already_paid guard.
CREATE OR REPLACE FUNCTION public.mark_purchase_paid(p_purchase_id uuid, p_amount numeric, p_reference text DEFAULT NULL::text, p_method text DEFAULT 'zelle'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pur purchases%ROWTYPE;
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

  RETURN 'paid';
END;
$function$;
