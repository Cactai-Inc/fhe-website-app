-- TASK-BUYANDBOOK §2 + §3 — declaring payment opens the order, both methods, one spine.
--
-- D23: "nothing blocks them from any action because the lesson never happens without
-- payment being verified." The entitlement is created when the client DECLARES, and
-- staff confirmation governs whether the lesson happens, not whether the client can act.
--
-- MEASURED BEFORE (prod, 2026-08-20). Two doors, and only one of them opened the order:
--   * ZELLE reached `finalize_purchase_payment` through the "Pay with Zelle" button —
--     which sets `status = 'awaiting_payment'`, so `purchases_mint_credits` fired and
--     PUR-000238 minted its Evaluation Lesson credit at 16:58:53.
--   * CASH reached only `report_my_payment`, which writes `client_reported_*` and
--     touches no status at all. PUR-000245 is STILL `draft`/`unpaid` — and
--     `_mint_credits_for_purchase_item` returns 0 for a draft on purpose, so nothing
--     could ever mint for it. That is the whole of WALK1's NO_CREDITS.
--
-- THE CONVERGENCE. `report_my_payment` now routes a still-draft order through
-- `finalize_purchase_payment` — the SAME function the Zelle button already calls, the
-- same one that assigns the matching keys and moves the order to
-- `awaiting_payment`/`pending`. Both methods now leave draft through one door, and the
-- INCUMBENT trigger spine does the minting. No `lesson_credits` write is added here
-- and no second mint path exists (D18).
--
-- ⚠️ DELIBERATELY NOT `mark_purchase_paid`. The task named it as the convergence
-- point; it is the convergence point for SETTLEMENT, not for declaration. It writes
-- `payment_status='paid'`, `paid_at` and `amount_paid = amount`, i.e. it records money
-- as RECEIVED. A declaration is the client's word, not a receipt: booking it as paid
-- would put unreceived money in the books, make `confirm_payment_claim` return
-- 'already_paid', and dissolve the staff confirmation D23 explicitly keeps. The
-- DECLARED state is `awaiting_payment` + `payment_status='pending'` +
-- `client_claim_status='pending'` — exactly the state PUR-000238 already reached —
-- and that is the state both methods now converge on. Flagged in the report.
--
-- IDEMPOTENCE. The mint is protected by the partial unique index
-- `lesson_credits_one_per_item_period (purchase_item_id, coalesce(period_start,
-- '0001-01-01')) WHERE purchase_item_id IS NOT NULL AND deleted_at IS NULL`, which the
-- existing `ON CONFLICT DO NOTHING` in `_mint_credits_for_purchase_item` binds to.
-- Declaration then staff confirmation therefore cannot mint twice, and re-declaring
-- (the "Actually, I'll pay cash" link) cannot either.

CREATE OR REPLACE FUNCTION public.report_my_payment(p_purchase_id uuid, p_method text, p_reference text DEFAULT NULL::text)
 RETURNS jsonb
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
  v_opened  boolean := false;
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
         -- the method the buyer intends to use IS the order's method; the amount
         -- and the memo code are untouched.
         payment_method                = v_method,
         -- CASHCONFIRM: every report (re)opens the claim for staff review, so a
         -- claim declined once can be re-filed and resurfaces in the queue.
         client_claim_status           = 'pending',
         client_claim_resolved_by      = NULL,
         client_claim_resolved_at      = NULL,
         client_claim_decline_reason   = NULL
   WHERE id = p_purchase_id;

  -- ── D23 (BUYANDBOOK §2/§3): THE DECLARATION IS WHAT OPENS THE ORDER ──
  -- A draft order is not an order and nothing it contains is entitled — that rule
  -- stays exactly as it was. What changes is who can end the draft: the BUYER's
  -- declaration does it, not a staff status change. `finalize_purchase_payment` is
  -- the incumbent door (the Zelle button's), it authorises the caller as the buyer
  -- itself, and moving out of `draft` is what fires `purchases_mint_credits`.
  -- Nothing here writes an entitlement directly.
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

  RETURN jsonb_build_object('recorded', true, 'method', v_method, 'reference', v_ref,
                            -- the caller re-reads the order when this is true: the
                            -- entitlement it just gained is what unblocks booking.
                            'order_opened', v_opened);
END;
$function$;
