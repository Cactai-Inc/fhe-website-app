-- THE FIVE DOORS NOW EMIT A PAYMENT ENTRY.
--
-- Each function keeps its existing body verbatim; the only change is one call to
-- the helper, placed where the fact it records becomes true. Rewritten in place
-- from pg_get_functiondef so nothing else drifts.

BEGIN;

-- ── 1. THE CLIENT DECLARES ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_my_payment(p_purchase_id uuid, p_method text, p_reference text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_pur     purchases%ROWTYPE;
  v_contact uuid := current_contact_id();
  v_method  text := lower(btrim(coalesce(p_method, '')));
  v_ref     text := nullif(btrim(coalesce(p_reference, '')), '');
  v_label   text;
  v_who     text;
  v_opened  boolean := false;
  v_pay     uuid;
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
         payment_method                = v_method,
         client_claim_status           = 'pending',
         client_claim_resolved_by      = NULL,
         client_claim_resolved_at      = NULL,
         client_claim_decline_reason   = NULL
   WHERE id = p_purchase_id;

  -- CR-76b: the declaration IS the payment entry. Its number is what the client
  -- sees on My Payments, and it is minted here — at the input, not at settlement.
  v_pay := _payment_open(p_purchase_id, v_method, v_ref, auth.uid(), false);

  IF coalesce(v_pur.status, '') = 'draft' THEN
    PERFORM finalize_purchase_payment(p_purchase_id, v_method);
    v_opened := true;
  END IF;

  SELECT string_agg(pi.label, ', ' ORDER BY pi.created_at) INTO v_label
    FROM purchase_items pi WHERE pi.purchase_id = p_purchase_id;
  v_label := coalesce(nullif(btrim(v_label), ''), 'Order');

  SELECT nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), '')
    INTO v_who FROM contacts c WHERE c.id = v_pur.buyer_contact_id;
  v_who := coalesce(v_who, 'The buyer');

  PERFORM log_status_event(
    'order', p_purchase_id, 'payment_reported',
    CASE WHEN v_method = 'cash'
         THEN 'Client says they are paying cash'
         ELSE 'Client says they sent the Zelle payment'
              || coalesce(' — confirmation ' || v_ref, ' — no confirmation number given')
    END,
    v_pur.org_id);

  PERFORM notify_staff(v_pur.org_id, 'payment_reported',
    v_who || ' says they paid ' || v_label
      || CASE WHEN v_method = 'cash' THEN ' in cash' ELSE ' by Zelle' END
      || coalesce(' (ref ' || v_ref || ')', '')
      || ' — not yet confirmed',
    '/app/ops/payments/review');

  RETURN jsonb_build_object('recorded', true, 'method', v_method, 'reference', v_ref,
                            'payment_id', v_pay,
                            'order_opened', v_opened);
END;
$function$;

-- ── 2. THE METHOD IS CHANGED WHILE PENDING ──────────────────────────────────
-- ⚠️ THE CASING BUG DIES HERE. This wrote `btrim(p_method)` with no lowercasing,
-- while the declaration path and every production row are lowercase — so a value
-- written through the "Manage payment" control matched nothing that looked for
-- 'zelle'. It also accepted ANY string: 'Check' and 'Card' were on the dropdown
-- and are not real options (owner: "thats it there are only two choices").
CREATE OR REPLACE FUNCTION public.update_purchase_payment_method(p_purchase_id uuid, p_method text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_p purchases%ROWTYPE; v_method text := lower(btrim(coalesce(p_method,'')));
BEGIN
  SELECT * INTO v_p FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase not found'; END IF;
  IF NOT coalesce(has_staff_access() OR v_p.buyer_user_id = auth.uid()
          OR v_p.buyer_contact_id = current_contact_id(), false) THEN
    RAISE EXCEPTION 'not your purchase';
  END IF;
  IF v_method NOT IN ('zelle','cash') THEN
    RAISE EXCEPTION 'a payment method is zelle or cash';
  END IF;
  -- A PAID payment is evidence and is never re-methoded (CR-76: pending is
  -- client-editable, paid is not).
  IF coalesce(v_p.payment_status,'') = 'paid' THEN
    RAISE EXCEPTION 'this order is already paid; its method cannot be changed';
  END IF;

  UPDATE purchases SET payment_method = v_method, updated_at = now()
   WHERE id = p_purchase_id;

  PERFORM _payment_open(p_purchase_id, v_method, NULL, auth.uid(), has_staff_access());
END;
$function$;

-- ── 3. STAFF VERIFY THE MONEY ARRIVED ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_purchase_paid(p_purchase_id uuid, p_amount numeric, p_reference text DEFAULT NULL::text, p_method text DEFAULT 'zelle'::text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_pur purchases%ROWTYPE;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown purchase: %', p_purchase_id; END IF;
  IF v_pur.payment_status = 'paid' THEN RETURN 'already_paid'; END IF;

  UPDATE purchases p
     SET payment_status    = 'paid',
         status            = 'paid',
         paid_at           = now(),
         amount_paid       = COALESCE(p.amount, 0),
         payment_method    = lower(btrim(coalesce(p_method, 'zelle'))),
         payment_reference = COALESCE(p.payment_reference, p_reference)
   WHERE p.id = p_purchase_id;

  -- the entry that says WHEN it was marked paid, by WHOM, and against WHAT
  PERFORM _payment_settle(p_purchase_id, coalesce(p_method,'zelle'), p_reference,
                          coalesce(p_amount, v_pur.amount));

  PERFORM _notify_purchase_paid(p_purchase_id);
  RETURN 'paid';
END;
$function$;

-- ── 4. THE CLAIM IS DECLINED ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decline_payment_claim(p_purchase_id uuid, p_reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_pur    purchases%ROWTYPE;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to decline a payment claim';
  END IF;

  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown purchase: %', p_purchase_id; END IF;
  IF v_pur.client_claim_status <> 'pending' THEN
    RAISE EXCEPTION 'no pending claim on this order (claim status: %)', v_pur.client_claim_status;
  END IF;

  UPDATE purchases
     SET client_claim_status         = 'declined',
         client_claim_resolved_by    = auth.uid(),
         client_claim_resolved_at    = now(),
         client_claim_decline_reason = v_reason
   WHERE id = p_purchase_id;

  -- ⚠️ THE ENTRY IS CLOSED, NOT DELETED. "if there were any issues" is the
  -- owner's own line: a declined declaration is exactly the issue the ledger is
  -- for, and the next declaration mints a NEW number rather than reopening this.
  UPDATE payments
     SET status = 'declined', decline_reason = v_reason,
         confirmed_by = auth.uid(), confirmed_at = now()
   WHERE purchase_id = p_purchase_id AND status = 'pending' AND deleted_at IS NULL;

  PERFORM log_status_event('order', p_purchase_id, 'claim_declined', v_reason, v_pur.org_id);
  PERFORM log_status_event('payment', pid, 'declined', v_reason, v_pur.org_id)
     FROM (SELECT id AS pid FROM payments
            WHERE purchase_id = p_purchase_id AND status = 'declined'
              AND confirmed_at >= now() - interval '1 minute') q;

  RETURN jsonb_build_object('declined', true, 'reason', v_reason);
END;
$function$;

COMMIT;
