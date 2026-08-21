-- TASK-BUYANDBOOK §1 — a member can create a purchase (the 403).
--
-- MEASURED BEFORE (prod, 2026-08-20): `purchases` carries exactly three policies —
-- `purchases_org_boundary` (RESTRICTIVE), `purchases_staff_all` (permissive, staff
-- only) and `purchases_member_own_select` (SELECT only). A member INSERT therefore
-- has NO permissive policy to satisfy and is refused, which is the 403 WALK1 hit on
-- the catalog route. Same shape on `purchase_items`.
--
-- WHY AN RPC AND NOT A PERMISSIVE INSERT POLICY. `purchases` holds `status`,
-- `payment_status`, `amount_paid` and `paid_at`; `purchase_items` holds
-- `price_amount`. A permissive INSERT policy cannot say "you may create the row but
-- these columns are the server's" — RLS gates ROWS, not COLUMNS. With one, a member
-- could insert `status='paid'` at `price_amount = 0`, and because
-- `purchase_items_mint_credits` mints for any purchase that is not `draft`, that is
-- a self-service credit press. The RPC owns every money-bearing column instead: the
-- order opens as an unpaid draft and each line is priced from `offerings`, not from
-- what the browser sent.
--
-- ⚠️ AND IT DOES NOT WIDEN `anon`. `anon` already holds INSERT/UPDATE/DELETE on
-- `purchases` through the repo-wide default grant (OPEN-ITEMS §7) — RLS is the only
-- thing refusing it, and this migration adds no policy, so that refusal is untouched.
-- The function itself is REVOKEd from PUBLIC and `anon` and granted to
-- `authenticated` alone, and its first line refuses a null `auth.uid()` regardless.

CREATE OR REPLACE FUNCTION public.create_my_purchase(p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_contact  uuid := current_contact_id();
  v_org      uuid := current_org();
  v_purchase uuid;
  v_off      offerings%ROWTYPE;
  v_item     jsonb;
  v_off_id   uuid;
  v_slug     text;
  v_qty      integer;
  v_config   jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'no organization for this account'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'an order needs at least one item';
  END IF;

  -- Purchase unification (Phase 2/3): stamp BOTH buyer keys — the contact is the
  -- durable identity, the login is who is holding the phone.
  INSERT INTO purchases (org_id, buyer_user_id, buyer_contact_id,
                         status, amount, amount_paid, payment_status)
  VALUES (v_org, v_uid, v_contact, 'draft', 0, 0, 'unpaid')
  RETURNING id INTO v_purchase;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_off_id := nullif(btrim(coalesce(v_item->>'offering_id', '')), '')::uuid;
    v_slug   := nullif(btrim(coalesce(v_item->>'offering_slug', '')), '');

    -- The catalog is the price list. A line that does not resolve to a live
    -- offering in the caller's own org has no price we are willing to honour.
    IF v_off_id IS NOT NULL THEN
      SELECT * INTO v_off FROM offerings
       WHERE id = v_off_id AND org_id = v_org AND active;
    ELSIF v_slug IS NOT NULL THEN
      SELECT * INTO v_off FROM offerings
       WHERE slug = v_slug AND org_id = v_org AND active;
    ELSE
      RAISE EXCEPTION 'every line must name an offering';
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'that offering is not available: %', coalesce(v_off_id::text, v_slug);
    END IF;

    v_qty := greatest(coalesce((v_item->>'quantity')::integer, 1), 1);
    -- `config` is the buyer's own words (a service address, a note). It carries no
    -- price and no entitlement, so it is passed through as given.
    v_config := CASE WHEN jsonb_typeof(v_item->'config') = 'object'
                     THEN v_item->'config' ELSE '{}'::jsonb END;

    INSERT INTO purchase_items (purchase_id, org_id, offering_id, label,
                                price_amount, price_unit, quantity, config)
    VALUES (v_purchase, v_org, v_off.id, v_off.name,
            coalesce(v_off.price_amount, 0), v_off.price_unit, v_qty, v_config);
  END LOOP;

  -- One totaller, the incumbent one — the same function every other line-item
  -- change in this codebase calls.
  PERFORM _recompute_purchase_total(v_purchase);

  RETURN v_purchase;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_my_purchase(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_my_purchase(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_my_purchase(jsonb) TO authenticated;
