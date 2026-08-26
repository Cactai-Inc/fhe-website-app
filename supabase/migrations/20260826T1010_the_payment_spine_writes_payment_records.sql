-- THE EXISTING PAYMENT SPINE NOW WRITES PAYMENT RECORDS.
--
-- D18: no second write path. `report_my_payment`, `update_purchase_payment_method`,
-- `mark_purchase_paid`, `confirm_payment_claim` and `decline_payment_claim` are
-- the five doors payment already goes through, and every surface already calls
-- them. So the payment RECORD is emitted BY those doors rather than by a parallel
-- set of RPCs — there is nothing new to remember to call, and no way to move money
-- without leaving an entry.
--
-- Two helpers do the work, and they are internal on purpose: a payment row is a
-- CONSEQUENCE of one of the five acts, never something a caller creates directly.

BEGIN;

-- ── the open (pending) payment for an order, created or amended ─────────────
CREATE OR REPLACE FUNCTION public._payment_open(
  p_purchase_id uuid, p_method text, p_reference text, p_actor uuid,
  p_staff boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pur purchases%ROWTYPE;
  v_id  uuid;
  v_old text;
  v_method text := lower(btrim(coalesce(p_method, '')));
BEGIN
  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_method NOT IN ('zelle','cash') THEN RETURN NULL; END IF;

  -- ONE open entry per order at a time. Changing the method amends THIS entry and
  -- is logged as a change — owner, 2026-08-25: "all the changes made if any exist".
  -- A NEW number is minted per INPUT, so a fresh declaration after a decline is a
  -- new record; an edit of an unsettled declaration is the same record changed.
  SELECT id, method INTO v_id, v_old
    FROM payments
   WHERE purchase_id = p_purchase_id AND status = 'pending' AND deleted_at IS NULL
   ORDER BY declared_at DESC LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO payments (org_id, purchase_id, payer_contact_id, method, amount,
                          reference, status, declared_by)
    VALUES (v_pur.org_id, p_purchase_id, v_pur.buyer_contact_id, v_method,
            -- what is still outstanding, not the order total: a second entry
            -- against a part-paid order is for the remainder. This is what makes
            -- a split between cash and Zelle expressible.
            greatest(coalesce(v_pur.amount, 0) - coalesce((
              SELECT sum(amount) FROM payments
               WHERE purchase_id = p_purchase_id AND status = 'paid' AND deleted_at IS NULL), 0), 0.01),
            nullif(btrim(coalesce(p_reference,'')), ''), 'pending', p_actor)
    RETURNING id INTO v_id;

    PERFORM log_status_event('payment', v_id,
      CASE WHEN p_staff THEN 'staff_recorded' ELSE 'declared' END,
      CASE WHEN p_staff THEN 'Recorded by staff as ' ELSE 'Client declared ' END || v_method
        || coalesce(' — ref ' || nullif(btrim(coalesce(p_reference,'')), ''), ''),
      v_pur.org_id);
  ELSE
    UPDATE payments
       SET method    = v_method,
           reference = coalesce(nullif(btrim(coalesce(p_reference,'')), ''), reference)
     WHERE id = v_id;

    IF v_old IS DISTINCT FROM v_method THEN
      PERFORM log_status_event('payment', v_id, 'method_changed',
        'Changed from ' || v_old || ' to ' || v_method, v_pur.org_id);
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;

-- ── the settlement: staff verified the money arrived ────────────────────────
CREATE OR REPLACE FUNCTION public._payment_settle(
  p_purchase_id uuid, p_method text, p_reference text, p_amount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM purchases WHERE id = p_purchase_id;
  -- settle the open entry if there is one; otherwise the money arrived without a
  -- declaration (staff took cash at the barn) and the entry is created settled.
  v_id := _payment_open(p_purchase_id, p_method, p_reference, auth.uid(), true);
  IF v_id IS NULL THEN RETURN NULL; END IF;

  UPDATE payments
     SET status       = 'paid',
         amount       = coalesce(p_amount, amount),
         confirmed_at = now(),
         confirmed_by = auth.uid()
   WHERE id = v_id;

  PERFORM log_status_event('payment', v_id, 'confirmed',
    'Confirmed received — ' || lower(btrim(coalesce(p_method,'')))
      || coalesce(' — ref ' || nullif(btrim(coalesce(p_reference,'')), ''), ''), v_org);
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._payment_open(uuid, text, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._payment_settle(uuid, text, text, numeric) FROM PUBLIC, anon, authenticated;

COMMIT;
