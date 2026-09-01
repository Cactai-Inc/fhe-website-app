/*
  # Finalize order payment — the missing server-side pricing step

  GAP (found in the pre-go-live wiring hunt): orders.unique_amount and
  orders.payment_reference were displayed by the UI and matched on by the Zelle
  reconciler, but NO code path ever assigned them — the "edge function" promised
  by src/lib/api.ts's markAwaitingPayment comment was never built. Every Zelle
  payment would have fallen to the manual review queue.

  finalize_order_payment(p_order_id, p_method) — SECURITY DEFINER, owner-gated:
    1. Locks the order; only the owner (auth.uid()) or a server caller
       (auth.uid() IS NULL, service role) may finalize; status must be
       draft/awaiting_payment (confirmed orders are immutable here).
    2. PRICE INTEGRITY (partial, by data shape): items carrying a tier_id get
       their price_amount forced to the tier's server-side price; subtotal/total
       are recomputed from the item rows. Items without a tier_id keep their
       client label price — checkout does not yet pass tier_id (flagged in the
       go-live report; full enforcement needs the cart to carry tier ids).
    3. Zelle matching keys, assigned ONCE (idempotent on re-call):
       - unique_amount: total + a 1–99 cent offset not used by any other open
         awaiting_payment order (the deterministic Zelle match key).
       - payment_reference: '<BRAND.SHORT_NAME>-XXXXXX' — the prefix comes from
         the ORDER's org registry (global-value rule; never hardcoded), falling
         back to 'ORD'.
    4. Moves the order to awaiting_payment with the chosen method.

  Returns (unique_amount, payment_reference) for the instructions UI.
*/

CREATE INDEX IF NOT EXISTS orders_payment_reference_idx ON orders (payment_reference);

CREATE OR REPLACE FUNCTION finalize_order_payment(p_order_id uuid, p_method text)
RETURNS TABLE (unique_amount numeric, payment_reference text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   orders%ROWTYPE;
  v_total   numeric(10,2);
  v_prefix  text;
  v_ref     text;
  v_cents   int;
  v_try     int;
  v_candidate numeric(10,2);
BEGIN
  IF p_method NOT IN ('zelle', 'stripe') THEN
    RAISE EXCEPTION 'unknown payment method %', p_method;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  IF auth.uid() IS NOT NULL AND v_order.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not your order';
  END IF;
  IF v_order.status NOT IN ('draft', 'awaiting_payment') THEN
    RAISE EXCEPTION 'order is % — cannot finalize payment', v_order.status;
  END IF;

  -- 2. Price integrity where the data allows: tier-linked items take the
  --    server-side tier price, defeating client-side tampering on those rows.
  UPDATE order_items oi
     SET price_amount = ot.price_amount
    FROM offering_tiers ot
   WHERE oi.order_id = p_order_id
     AND oi.tier_id = ot.id
     AND oi.price_amount IS DISTINCT FROM ot.price_amount;

  SELECT COALESCE(SUM(oi.price_amount), 0) INTO v_total
    FROM order_items oi WHERE oi.order_id = p_order_id;
  -- An empty/priceless cart keeps the client-set total (inquiry-style orders).
  IF v_total = 0 THEN v_total := COALESCE(v_order.total, 0); END IF;

  -- 3a. unique_amount: assign once; 1–99 cent offset unique among OPEN orders.
  IF v_order.unique_amount IS NULL THEN
    v_cents := 1 + (get_byte(decode(md5(p_order_id::text), 'hex'), 0) % 99);
    v_candidate := NULL;
    FOR v_try IN 0..98 LOOP
      v_candidate := v_total + (((v_cents + v_try - 1) % 99) + 1) / 100.0;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM orders o
         WHERE o.status = 'awaiting_payment'
           AND o.unique_amount = v_candidate
           AND o.id <> p_order_id
      );
      v_candidate := NULL;
    END LOOP;
    IF v_candidate IS NULL THEN
      RAISE EXCEPTION 'no unique payment amount available — too many open orders at this total';
    END IF;
  ELSE
    v_candidate := v_order.unique_amount;
  END IF;

  -- 3b. payment_reference: assign once; brand-prefixed from the ORDER's org.
  IF v_order.payment_reference IS NULL THEN
    SELECT cv.value_text INTO v_prefix
      FROM config_values cv
     WHERE cv.org_id = v_order.org_id AND cv.namespace = 'BRAND' AND cv.key = 'SHORT_NAME';
    v_prefix := COALESCE(NULLIF(regexp_replace(upper(v_prefix), '[^A-Z0-9]', '', 'g'), ''), 'ORD');
    v_ref := v_prefix || '-' || upper(substr(md5(p_order_id::text || v_prefix), 1, 6));
  ELSE
    v_ref := v_order.payment_reference;
  END IF;

  UPDATE orders o
     SET subtotal = v_total,
         total = v_total,
         unique_amount = v_candidate,
         payment_reference = v_ref,
         status = 'awaiting_payment',
         payment_method = p_method
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT v_candidate, v_ref;
END;
$$;

REVOKE ALL ON FUNCTION finalize_order_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_order_payment(uuid, text) TO authenticated, service_role;
