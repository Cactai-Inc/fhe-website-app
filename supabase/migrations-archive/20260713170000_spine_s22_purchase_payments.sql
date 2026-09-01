/*
  # Spine Refactor — Slice 2.2 (step 1): purchase payment SQL

  Port the Zelle payment machinery from `orders` onto `purchases`, preserving the
  exact-total + memo-reference matching model verbatim (finalize v3):
    - finalize_purchase_payment(purchase, method): recompute the basket total from
      purchase_items, stamp unique_amount = EXACT total (the memo reference is the
      disambiguator; same-total collisions go to the review queue), mint a
      PUR-prefixed payment_reference, move to awaiting_payment / pending.
    - mark_purchase_paid(purchase, amount, reference, confidence): the confirm side
      the Zelle reconciler / Stripe webhook call — sets payment inline on the
      purchase (paid / paid_at), no separate payments row (single-payment,
      no-refund model; the multi-row payments table is retired in step 2).

  Nothing dropped here; orders keeps working until step 2 repoints the callers.
*/

CREATE OR REPLACE FUNCTION finalize_purchase_payment(p_purchase_id uuid, p_method text)
RETURNS TABLE (unique_amount numeric, payment_reference text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_pur    purchases%ROWTYPE;
  v_total  numeric;
  v_ref    text;
  v_prefix text;
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
     SET amount            = v_total,
         unique_amount     = v_total,   -- EXACT total; the memo reference is the match key
         payment_reference = v_ref,
         payment_method    = p_method,
         status            = 'awaiting_payment',
         payment_status    = 'pending'
   WHERE p.id = p_purchase_id;

  RETURN QUERY SELECT v_total, v_ref;
END;
$fn$;

REVOKE ALL ON FUNCTION finalize_purchase_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION finalize_purchase_payment(uuid, text) TO authenticated, service_role;

-- The confirm side (service-role: Zelle reconciler / Stripe webhook). Inline
-- payment on the purchase; idempotent on an already-paid purchase.
CREATE OR REPLACE FUNCTION mark_purchase_paid(
  p_purchase_id uuid,
  p_amount      numeric,
  p_reference   text DEFAULT NULL,
  p_method      text DEFAULT 'zelle'
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
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
         payment_method    = p_method,
         payment_reference = COALESCE(p.payment_reference, p_reference)
   WHERE p.id = p_purchase_id;

  RETURN 'paid';
END;
$fn$;

REVOKE ALL ON FUNCTION mark_purchase_paid(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_purchase_paid(uuid, numeric, text, text) TO service_role;
