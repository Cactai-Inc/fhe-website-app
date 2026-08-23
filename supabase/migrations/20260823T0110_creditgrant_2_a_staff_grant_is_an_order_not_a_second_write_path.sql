-- TASK-CREDITGRANT 2 — hand-write, comp, and bill are ONE act with three prices.
--
-- D18: `lesson_credits` has one writer, the credit engine. TASK-AUTHORITY deleted the
-- raw-insert "Grant credits" button precisely because it wrote the table directly with
-- no offering, no purchase, no period and no expiry. This function does NOT resurrect
-- it: it writes a staff-initiated `purchases` + `purchase_items` pair and lets
-- `purchase_items_mint_credits` -> `_mint_credits_for_purchase_item` do the minting,
-- exactly as a real checkout does. Nothing here touches lesson_credits.
--
-- THE THREE MODES DIFFER ONLY IN PRICE AND PAYMENT STATE:
--   handwrite — staff attest the money is already in hand. amount = list, paid.
--   comp      — given away. LINE price 0, but the LIST PRICE AT COMP is captured on
--               the line's config so the loss is a dollar figure later (see
--               `comped_credit_value`). An offering's price may change; a comp's
--               recorded loss may not.
--   bill      — a real balance owed. amount = list, status awaiting_payment / unpaid.
--               Credits mint anyway: `_mint_credits_for_purchase_item` gates on
--               status <> 'draft', NOT on payment_status (verified against the live
--               body, 2026-08-23). That is the same shape D23 rules for a client's own
--               declaration; here it is staff creating the debt, and the entitlement
--               still exists the moment the order is placed. Asking for the money is a
--               SEPARATE act (`request_purchase_payment`), never automatic.
--
-- D19: a reason is MANDATORY (no reason, no grant), the offering is recorded (never a
-- bare unlabelled credit), the act is written to the order's status timeline in words,
-- and `revoke_lesson_credit_grant` is the undo.
--
-- Scope: `config_kind = 'scheduled'` only. A `recurring` SKU is a STANDING SLOT, not a
-- credit balance (D23) — granting one would either mint nothing or mint the punch card
-- D23 rejects, so it is refused by name rather than silently misbehaving.

CREATE OR REPLACE FUNCTION public.grant_lesson_credit(
  p_client_id      uuid,
  p_offering_id    uuid,
  p_quantity       integer DEFAULT 1,
  p_mode           text    DEFAULT 'handwrite',
  p_reason         text    DEFAULT NULL,
  p_payment_method text    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid := current_org();
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_mode     text := lower(btrim(coalesce(p_mode, '')));
  v_qty      integer := coalesce(p_quantity, 1);
  v_cl       clients%ROWTYPE;
  v_off      offerings%ROWTYPE;
  v_list     numeric;
  v_line     numeric;
  v_total    numeric;
  v_purchase uuid;
  v_item     uuid;
  v_credit   lesson_credits%ROWTYPE;
  v_user     uuid;
  v_code     text;
  v_detail   text;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'only staff may grant a credit';
  END IF;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization in scope';
  END IF;
  IF v_mode NOT IN ('handwrite', 'comp', 'bill') THEN
    RAISE EXCEPTION 'mode must be handwrite, comp or bill (got %)', p_mode;
  END IF;
  -- D19(2). Not optional, not defaulted, not a placeholder.
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to grant a credit';
  END IF;
  IF v_qty < 1 THEN
    RAISE EXCEPTION 'quantity must be at least 1';
  END IF;

  SELECT * INTO v_cl FROM clients
   WHERE id = p_client_id AND deleted_at IS NULL AND org_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found in this organization';
  END IF;

  SELECT * INTO v_off FROM offerings WHERE id = p_offering_id AND org_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'service not found in this organization';
  END IF;
  IF coalesce(v_off.config_kind, '') <> 'scheduled' THEN
    RAISE EXCEPTION '% is a % service — only a scheduled service mints a spendable credit. A weekly plan is a standing slot, not a credit balance.',
      v_off.name, coalesce(v_off.config_kind, 'quote-priced');
  END IF;
  IF coalesce(v_off.unit_count, 0) <= 0 THEN
    RAISE EXCEPTION '% carries no credit units, so granting it would mint nothing', v_off.name;
  END IF;

  -- THE LIST PRICE AT GRANT TIME. Read now, stored on the line, never re-derived:
  -- the offering's price is editable and a recorded loss must not move with it.
  v_list  := coalesce(v_off.price_amount, 0);
  v_line  := CASE WHEN v_mode = 'comp' THEN 0 ELSE v_list END;
  v_total := v_line * v_qty;

  INSERT INTO purchases (org_id, buyer_contact_id, status, amount, amount_paid,
                         payment_method, payment_status, paid_at, notes)
  VALUES (
    v_org, v_cl.contact_id,
    CASE WHEN v_mode = 'bill' THEN 'awaiting_payment' ELSE 'paid' END,
    v_total,
    CASE WHEN v_mode = 'bill' THEN 0 ELSE v_total END,
    CASE WHEN v_mode = 'comp' THEN 'comp'
         WHEN v_mode = 'handwrite' THEN coalesce(nullif(btrim(coalesce(p_payment_method, '')), ''), 'offline')
         END,
    CASE WHEN v_mode = 'bill' THEN 'unpaid' ELSE 'paid' END,
    CASE WHEN v_mode = 'bill' THEN NULL ELSE now() END,
    CASE v_mode
      WHEN 'comp'      THEN 'Comped by staff — ' || v_reason
      WHEN 'bill'      THEN 'Billed by staff — ' || v_reason
      ELSE                  'Hand-written by staff — ' || v_reason
    END)
  RETURNING id, display_code INTO v_purchase, v_code;

  -- The line. `config` is the per-line intent this table already carries; the grant's
  -- own facts live there rather than in new columns nothing else would read.
  INSERT INTO purchase_items (org_id, purchase_id, offering_id, label, price_amount,
                              price_unit, quantity, config)
  VALUES (v_org, v_purchase, v_off.id, v_off.name, v_line, v_off.price_unit, v_qty,
          jsonb_build_object(
            'grant_mode',  v_mode,
            'grant_reason', v_reason,
            'list_price',  v_list,
            'granted_by',  auth.uid(),
            'granted_at',  now()))
  RETURNING id INTO v_item;

  -- The INSERT trigger has already minted through the engine. This re-run only names
  -- the client explicitly (the trigger resolves it from the buyer contact); the
  -- one-per-item unique index makes it a no-op when the trigger already succeeded.
  PERFORM _mint_credits_for_purchase_item(v_item, p_client_id);

  SELECT * INTO v_credit FROM lesson_credits
   WHERE purchase_item_id = v_item AND deleted_at IS NULL
   ORDER BY created_at LIMIT 1;
  -- D17: never report a grant that granted nothing. If the engine minted no row, the
  -- whole act rolls back rather than leaving an order that looks like an entitlement.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'the credit engine minted nothing for % — no credit was granted', v_off.name;
  END IF;

  v_detail :=
    CASE v_mode
      WHEN 'comp' THEN 'Comped ' || v_credit.credits_total || ' x ' || v_off.name
                       || ' (list ' || fmt_money(v_list * v_qty) || ' written off)'
      WHEN 'bill' THEN 'Billed ' || v_credit.credits_total || ' x ' || v_off.name
                       || ' — ' || fmt_money(v_total) || ' owed'
      ELSE             'Hand-wrote ' || v_credit.credits_total || ' x ' || v_off.name
                       || ' (' || fmt_money(v_total) || ' recorded as received)'
    END || ' — ' || v_reason;
  PERFORM log_status_event('order', v_purchase, 'staff_grant', v_detail, v_org);

  -- The client is told what they now hold. A BILL raises no "payment due" notice here:
  -- asking for the money is a separate, deliberate staff act (request_purchase_payment).
  SELECT pr.user_id INTO v_user FROM profiles pr WHERE pr.contact_id = v_cl.contact_id LIMIT 1;
  IF v_user IS NOT NULL THEN
    PERFORM notify_user(v_user, 'credit_granted',
      v_credit.credits_total || ' x ' || v_off.name || ' added to your account',
      CASE v_mode
        WHEN 'comp' THEN 'With our compliments. ' || v_reason
        WHEN 'bill' THEN 'Added now — ' || fmt_money(v_total) || ' is owed on order ' || coalesce(v_code, '') || '.'
        ELSE             'Recorded against ' || fmt_money(v_total) || ' already received.'
      END,
      '/order/' || v_purchase::text);
  END IF;

  IF v_mode = 'handwrite' THEN
    -- Same "payment received" trail every other paid order gets. A comp is not a
    -- payment and does not get one.
    PERFORM _notify_purchase_paid(v_purchase);
  END IF;

  RETURN jsonb_build_object(
    'purchase_id',   v_purchase,
    'display_code',  v_code,
    'item_id',       v_item,
    'credit_id',     v_credit.id,
    'credits',       v_credit.credits_total,
    'mode',          v_mode,
    'reason',        v_reason,
    'list_price',    v_list,
    'amount',        v_total,
    'comp_value',    CASE WHEN v_mode = 'comp' THEN v_list * v_qty ELSE 0 END,
    'offering_name', v_off.name,
    'client_id',     p_client_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.grant_lesson_credit(uuid, uuid, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_lesson_credit(uuid, uuid, integer, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.grant_lesson_credit(uuid, uuid, integer, text, text, text) IS
  'TASK-CREDITGRANT: staff hand-write / comp / bill a credit. Writes a purchases + purchase_items pair and lets the existing mint trigger do the work — never lesson_credits directly (D18). Reason mandatory (D19). Undo: revoke_lesson_credit_grant.';
