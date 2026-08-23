-- TASK-CREDITGRANT 3 — the undo. D19(4): a value-moving action can be REVERSED.
--
-- A grant is an order, so its undo is the order's own retirement path: the existing
-- `void_purchase_item` (which voids, never deletes — what was asked for is evidence)
-- plus a soft-delete of the credit the engine minted from that line. Nothing new is
-- invented for the reversal either.
--
-- WHAT IT REFUSES, and why refusing is the correct behaviour rather than a gap:
--   * a credit already spent — the lesson happened. Un-minting it would erase a
--     delivered service. The message names how many were used.
--   * an order whose payment actually settled through the payment spine (a receipt
--     was sent, or a client payment claim was confirmed). Money genuinely moved and
--     voiding the order would not return it; that is a refund, not an undo.
-- A hand-written grant IS reversible: staff attested the money themselves, so
-- reversing is a correction of their own attestation, and the status event says the
-- recorded payment is being reversed with it.

CREATE OR REPLACE FUNCTION public.revoke_lesson_credit_grant(
  p_purchase_id uuid,
  p_reason      text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org     uuid := current_org();
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
  v_pu      purchases%ROWTYPE;
  v_mode    text;
  v_used    integer;
  v_revoked integer := 0;
  v_voided  integer := 0;
  v_it      record;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'only staff may undo a credit grant';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to undo a credit grant';
  END IF;

  SELECT * INTO v_pu FROM purchases
   WHERE id = p_purchase_id AND deleted_at IS NULL AND org_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found in this organization';
  END IF;

  -- Scoped deliberately: this is the undo for a STAFF GRANT, not a general order
  -- voider. A real client checkout is retired by the order tools, not from here.
  SELECT pi.config->>'grant_mode' INTO v_mode
    FROM purchase_items pi
   WHERE pi.purchase_id = p_purchase_id AND pi.config ? 'grant_mode'
   ORDER BY pi.created_at LIMIT 1;
  IF v_mode IS NULL THEN
    RAISE EXCEPTION 'order % is not a staff credit grant', coalesce(v_pu.display_code, p_purchase_id::text);
  END IF;

  IF v_pu.status = 'void' THEN
    RAISE EXCEPTION 'that grant has already been undone';
  END IF;

  -- Already spent? The lesson happened; this is not undoable.
  SELECT coalesce(sum(lc.credits_total - lc.credits_remaining), 0)::int INTO v_used
    FROM lesson_credits lc
    JOIN purchase_items pi ON pi.id = lc.purchase_item_id
   WHERE pi.purchase_id = p_purchase_id AND lc.deleted_at IS NULL;
  IF v_used > 0 THEN
    RAISE EXCEPTION '% of these credits have already been used — this grant cannot be undone', v_used;
  END IF;
  IF EXISTS (
    SELECT 1 FROM bookings b
      JOIN lesson_credits lc ON lc.id = b.credit_id
      JOIN purchase_items pi ON pi.id = lc.purchase_item_id
     WHERE pi.purchase_id = p_purchase_id
       AND b.status NOT IN ('cancelled', 'expired', 'no_show')
  ) THEN
    RAISE EXCEPTION 'a session is booked against these credits — cancel it first';
  END IF;

  -- Money that actually settled is a refund, not an undo.
  IF coalesce(v_pu.client_claim_status, 'none') = 'confirmed'
     OR EXISTS (SELECT 1 FROM receipt_sends rs WHERE rs.purchase_id = p_purchase_id AND rs.succeeded)
  THEN
    RAISE EXCEPTION 'a payment on this order has already been settled and receipted — refund it rather than undoing the grant';
  END IF;

  -- 1. The entitlement goes first, so no window exists where the order is void and
  --    the credit is still spendable.
  UPDATE lesson_credits lc
     SET deleted_at = now(), deleted_by = auth.uid()
    FROM purchase_items pi
   WHERE pi.id = lc.purchase_item_id
     AND pi.purchase_id = p_purchase_id
     AND lc.deleted_at IS NULL;
  GET DIAGNOSTICS v_revoked = ROW_COUNT;

  -- 2. Void the ORDER before its lines, so _recompute_purchase_total (which skips a
  --    paid or void order) does not log a second, duplicate void event — and so a
  --    hand-written "paid" order does not survive as paid with nothing on it.
  UPDATE purchases
     SET status = 'void', payment_status = 'unpaid', amount_paid = 0, paid_at = NULL
   WHERE id = p_purchase_id;

  -- 3. Void the lines through the existing path (retained as evidence, D11/D16).
  FOR v_it IN SELECT id FROM purchase_items
               WHERE purchase_id = p_purchase_id AND voided_at IS NULL LOOP
    PERFORM void_purchase_item(v_it.id, v_reason);
    v_voided := v_voided + 1;
  END LOOP;

  -- 4. Clear any standing "payment due" notice this order raised.
  PERFORM resolve_notifications_for_link('/order/' || p_purchase_id::text, NULL, 'purchase_unpaid');

  PERFORM log_status_event('order', p_purchase_id, 'grant_reversed',
    'Staff grant undone (' || v_mode || ') — ' || v_revoked || ' credit row(s) withdrawn'
      || CASE WHEN v_mode = 'handwrite' THEN ', recorded payment reversed' ELSE '' END
      || ' — ' || v_reason, v_org);

  RETURN jsonb_build_object(
    'purchase_id',     p_purchase_id,
    'display_code',    v_pu.display_code,
    'mode',            v_mode,
    'credits_revoked', v_revoked,
    'items_voided',    v_voided,
    'reason',          v_reason);
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_lesson_credit_grant(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_lesson_credit_grant(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.revoke_lesson_credit_grant(uuid, text) IS
  'TASK-CREDITGRANT: the undo for grant_lesson_credit. Soft-deletes the minted credits, voids the order and its lines through void_purchase_item, and refuses when the credits were spent or a real payment settled.';
