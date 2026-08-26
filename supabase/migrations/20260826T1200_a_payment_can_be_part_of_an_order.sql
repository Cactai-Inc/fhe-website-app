-- A PAYMENT CAN BE PART OF AN ORDER.
--
-- Owner, 2026-08-26: "make it operable."
--
-- `mark_purchase_paid` already TOOK an amount and then ignored it — it wrote
-- `amount_paid = COALESCE(p.amount, 0)`, the whole order total, whatever was
-- passed. So every settlement was all-or-nothing and `partial_payment`, a defined
-- status_events term, could never be written by anything.
--
-- It now HONOURS the amount. The order flips to paid only when the settled
-- payment entries cover the total; until then the order stays open and carries a
-- running `amount_paid`. That is what makes the split real rather than merely
-- expressible: take $200 in cash and $120 by Zelle against a $320 order and the
-- order settles on the second entry, with two numbered records saying which money
-- came which way.
--
-- ⚠️ STILL ONE DOOR (D18). No new RPC: this is the same function every staff
-- surface already calls, and calling it the old way — with the full amount, or
-- with NULL — behaves exactly as before.

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_purchase_paid(p_purchase_id uuid, p_amount numeric, p_reference text DEFAULT NULL::text, p_method text DEFAULT 'zelle'::text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_pur       purchases%ROWTYPE;
  v_this      numeric;
  v_settled   numeric;
  v_covers    boolean;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown purchase: %', p_purchase_id; END IF;
  IF v_pur.payment_status = 'paid' THEN RETURN 'already_paid'; END IF;

  -- What was already settled BEFORE this act, from the payment records.
  SELECT coalesce(sum(amount), 0) INTO v_settled
    FROM payments
   WHERE purchase_id = p_purchase_id AND status = 'paid' AND deleted_at IS NULL;

  -- NULL amount keeps the old meaning: "settle whatever is left".
  v_this := coalesce(p_amount, greatest(coalesce(v_pur.amount, 0) - v_settled, 0));
  IF v_this <= 0 THEN RAISE EXCEPTION 'a payment amount must be greater than zero'; END IF;
  IF v_settled + v_this > coalesce(v_pur.amount, 0) + 0.005 THEN
    RAISE EXCEPTION 'that would settle %, more than the order total of %',
      v_settled + v_this, v_pur.amount;
  END IF;

  -- the entry that says WHEN this money was marked paid, by WHOM, and HOW
  PERFORM _payment_settle(p_purchase_id, coalesce(p_method,'zelle'), p_reference, v_this);

  v_covers := (v_settled + v_this) >= coalesce(v_pur.amount, 0) - 0.005;

  UPDATE purchases p
     SET amount_paid       = v_settled + v_this,
         payment_method    = lower(btrim(coalesce(p_method, 'zelle'))),
         payment_reference = COALESCE(p.payment_reference, p_reference),
         -- ⚠️ ONLY when the money is all in. A part-paid order is still open, and
         -- its entitlements are still gated on payment exactly as before.
         payment_status    = CASE WHEN v_covers THEN 'paid' ELSE p.payment_status END,
         status            = CASE WHEN v_covers THEN 'paid' ELSE p.status END,
         paid_at           = CASE WHEN v_covers THEN now() ELSE p.paid_at END
   WHERE p.id = p_purchase_id;

  IF NOT v_covers THEN
    PERFORM log_status_event('order', p_purchase_id, 'partial_payment',
      'Part payment of ' || to_char(v_this, 'FM999999990.00')
        || ' by ' || lower(btrim(coalesce(p_method,'zelle')))
        || ' — ' || to_char(coalesce(v_pur.amount,0) - (v_settled + v_this), 'FM999999990.00')
        || ' still outstanding', v_pur.org_id);
    RETURN 'part_paid';
  END IF;

  PERFORM _notify_purchase_paid(p_purchase_id);
  RETURN 'paid';
END;
$function$;

COMMIT;
