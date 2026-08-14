-- PAYLOCK — a provisioned buyer could see their order and never pay it (server half).
--
-- MECHANISM (TASK-FLOWTRACE-REPORT §5, "Lock 2"):
--   finalize_purchase_payment — the ONLY generator of the Zelle matching keys
--   (unique_amount + payment_reference) — resolved the purchase with
--       WHERE id = p_purchase_id AND buyer_user_id = auth.uid()
--   but `_provision_purchase_for_offerings` never writes buyer_user_id; a
--   staff-provisioned purchase carries buyer_contact_id ONLY
--   (20260802020000_u3_payment_notifications.sql:174-176). So the lookup matched
--   zero rows and the RPC raised 'purchase not found' for exactly the buyers the
--   provisioning spine creates. RLS admitted them (purchases_member_own_select,
--   20260725007000, already keys on buyer_contact_id) — the RPC did not.
--
-- FIX: use the same two-key identity test every other purchase-scoped function in
--   this codebase already uses —
--       buyer_user_id = auth.uid() OR buyer_contact_id = current_contact_id()
--   cf. 20260728170000_stage5_fulfillment_spine.sql:253,403,
--       20260805030000_user_nav_presence.sql:67,
--       20260728160000 update_purchase_payment_method / transfer_payment_responsibility.
--   Both arms fail closed: an unrelated caller (and a caller whose profile has no
--   contact, so current_contact_id() is NULL) matches nothing, since NULL in a
--   WHERE clause is not TRUE. No widening of who may pay — only of how the same
--   person is recognised.
--
-- SECOND CHANGE, deliberate and narrow: when the caller was matched by CONTACT and
--   buyer_user_id is still NULL, stamp it with their uid. The caller IS that buyer
--   contact (that is what matched), so the write is a factual backfill, not a
--   reassignment — and it is exactly what transfer_payment_responsibility does when
--   it moves a payer (20260728160000:230-233: it sets BOTH keys). It matters because
--   downstream payment machinery still reads buyer_user_id alone —
--   api/_lib/receipt.ts:36-44 (the receipt send) and api/stripe-create-session.ts:43.
--   Never overwrites a populated buyer_user_id.
--
-- Everything else in the body is byte-for-byte 20260725006000_finalize_payment_partial_balance.sql:
--   the balance math (total - amount_paid), the brand-prefixed reference, the
--   reference's write-once behavior, and the preservation of amount_paid.

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
  v_contact uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  v_contact := current_contact_id();

  -- The buyer is whichever key the creating path populated: self-serve orders
  -- carry buyer_user_id, provisioned orders carry buyer_contact_id.
  SELECT * INTO v_pur FROM purchases
   WHERE id = p_purchase_id
     AND deleted_at IS NULL
     AND (buyer_user_id = auth.uid() OR buyer_contact_id = v_contact);
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
         payment_status    = 'pending',
         -- backfill only: the caller matched as this purchase's buyer contact.
         buyer_user_id     = COALESCE(p.buyer_user_id,
                                      CASE WHEN v_contact IS NOT NULL
                                            AND p.buyer_contact_id = v_contact
                                           THEN auth.uid() END)
         -- amount_paid intentionally preserved
   WHERE p.id = p_purchase_id;

  RETURN QUERY SELECT v_balance, v_ref;
END;
$function$;

COMMENT ON FUNCTION public.finalize_purchase_payment(uuid, text) IS
  'Assigns the Zelle matching keys (unique_amount = balance owed, brand-prefixed payment_reference) and moves the purchase to awaiting_payment. PAYLOCK 2026-08-13: recognises the buyer by buyer_user_id OR buyer_contact_id, so a staff-provisioned buyer (contact key only) can pay.';

REVOKE ALL ON FUNCTION public.finalize_purchase_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_purchase_payment(uuid, text) TO authenticated, service_role;
