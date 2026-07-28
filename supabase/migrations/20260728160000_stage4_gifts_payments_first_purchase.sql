-- Stage 4 (REMEDIATION_PLAN + D8): ordering.
--
-- 4b  gift redemption end to end, on the Stage-2 spine with the D8 CUSTOMER
--     marker: a gift purchase auto-creates the buyer's account (no manual
--     provisioning) and redemption promotes the recipient through
--     promote_contact_to_account — order visibility, repurchase, community
--     access (D8: community follows the account) and marketing eligibility
--     all follow from the account existing.
-- 4c  gift actions: resend / reschedule (delivery date) / transfer / claim-link.
-- 4d  payment-method update + payment-responsibility transfer.
-- 4x  COMPANY_POLICIES attaches at FIRST SERVICE PURCHASE (recorded in Stage 2
--     when the Guest doc-category dissolved; RELEASE_GENERAL stays kiosk-side).

-- ── A. Gift delivery/lifecycle columns (4c) ─────────────────────────────────
ALTER TABLE gifts
  ADD COLUMN IF NOT EXISTS deliver_on date,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS send_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transferred_from_email text;

-- ── B. Gift purchase → CUSTOMER account through the ONE spine (4b/D8) ───────
-- Called when a gift is created/fulfilled. The buyer becomes an account holder
-- with the CUSTOMER marker; no service documents are pre-assigned (D8 — a
-- purchaser is not a service client until a service engagement attaches).
CREATE OR REPLACE FUNCTION public.ensure_gift_buyer_account(p_gift_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_g      gifts%ROWTYPE;
  v_res    jsonb;
  v_fn     text;
  v_ln     text;
BEGIN
  SELECT * INTO v_g FROM gifts WHERE id = p_gift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift not found'; END IF;
  IF v_g.org_id IS NULL OR nullif(btrim(coalesce(v_g.buyer_email,'')),'') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing org or buyer email');
  END IF;

  v_fn := nullif(split_part(coalesce(v_g.buyer_name,''), ' ', 1), '');
  v_ln := nullif(btrim(substr(coalesce(v_g.buyer_name,''),
            coalesce(nullif(position(' ' in coalesce(v_g.buyer_name,'')), 0),
                     length(coalesce(v_g.buyer_name,''))+1))), '');

  -- THE SPINE, with the commercial marker. Categories empty → no service docs.
  v_res := _ensure_client_account(v_g.org_id, lower(btrim(v_g.buyer_email)),
                                  v_fn, v_ln, ARRAY[]::text[], ARRAY[]::text[], 'CUSTOMER');
  RETURN jsonb_build_object('ok', true, 'contact_id', v_res->>'contact_id');
END;
$function$;
GRANT EXECUTE ON FUNCTION public.ensure_gift_buyer_account(uuid) TO authenticated;

-- ── C. Redemption on the spine (4b) ─────────────────────────────────────────
-- Replaces the old best-effort _ensure_client_account('GUEST') call: the
-- recipient's account is created with the CUSTOMER marker AND promoted, so
-- their documents/community/derivations all resolve through Stage 2's path.
CREATE OR REPLACE FUNCTION public.redeem_gift(p_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_gift    gifts%ROWTYPE;
  v_email   text;
  v_fn      text;
  v_ln      text;
  v_res     jsonb;
  v_contact uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'not_authenticated'; END IF;

  SELECT * INTO v_gift FROM gifts WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_gift.status = 'redeemed' THEN RETURN 'already_redeemed'; END IF;
  IF v_gift.expires_at IS NOT NULL AND v_gift.expires_at < now() THEN RETURN 'expired'; END IF;
  IF v_gift.unlock_gate = 'intro_call' AND NOT v_gift.unlocked THEN RETURN 'awaiting_intro_call'; END IF;

  UPDATE gifts SET status = 'redeemed', redeemed_at = now(), redeemed_user_id = auth.uid()
  WHERE id = v_gift.id;

  -- D8: the redeemer becomes a CUSTOMER account holder through the ONE spine,
  -- then is promoted (community + derivations + document anchoring).
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
  v_email := coalesce(v_email, lower(nullif(trim(v_gift.recipient_email), '')));
  IF v_email IS NOT NULL AND v_gift.org_id IS NOT NULL THEN
    v_fn := nullif(split_part(coalesce(v_gift.recipient_name, ''), ' ', 1), '');
    v_ln := nullif(btrim(substr(coalesce(v_gift.recipient_name, ''),
              coalesce(nullif(position(' ' in coalesce(v_gift.recipient_name,'')), 0),
                       length(coalesce(v_gift.recipient_name,''))+1))), '');
    BEGIN
      v_res := _ensure_client_account(v_gift.org_id, v_email, v_fn, v_ln,
                                      ARRAY[]::text[], ARRAY[]::text[], 'CUSTOMER');
      v_contact := (v_res->>'contact_id')::uuid;
      IF v_contact IS NOT NULL THEN
        PERFORM promote_contact_to_account(auth.uid(), v_contact);
      END IF;
    EXCEPTION WHEN others THEN NULL;  -- never block redemption on provisioning
    END;
  END IF;

  RETURN 'redeemed';
END;
$function$;

-- ── D. Gift actions (4c) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gift_claim_link(p_gift_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_g gifts%ROWTYPE;
BEGIN
  SELECT * INTO v_g FROM gifts WHERE id = p_gift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift not found'; END IF;
  IF NOT (has_staff_access() OR v_g.buyer_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not your gift';
  END IF;
  RETURN '/redeem?code=' || v_g.code;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.gift_claim_link(uuid) TO authenticated;

/** Reschedule the delivery date (buyer or staff; never after redemption). */
CREATE OR REPLACE FUNCTION public.gift_reschedule(p_gift_id uuid, p_deliver_on date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_g gifts%ROWTYPE;
BEGIN
  SELECT * INTO v_g FROM gifts WHERE id = p_gift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift not found'; END IF;
  IF NOT (has_staff_access() OR v_g.buyer_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not your gift';
  END IF;
  IF v_g.status = 'redeemed' THEN RAISE EXCEPTION 'this gift has already been used'; END IF;
  UPDATE gifts SET deliver_on = p_deliver_on WHERE id = p_gift_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.gift_reschedule(uuid, date) TO authenticated;

/** Transfer an unredeemed gift to a different recipient. */
CREATE OR REPLACE FUNCTION public.gift_transfer(p_gift_id uuid, p_recipient_name text, p_recipient_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_g gifts%ROWTYPE;
BEGIN
  SELECT * INTO v_g FROM gifts WHERE id = p_gift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift not found'; END IF;
  IF NOT (has_staff_access() OR v_g.buyer_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not your gift';
  END IF;
  IF v_g.status = 'redeemed' THEN RAISE EXCEPTION 'this gift has already been used'; END IF;
  IF nullif(btrim(coalesce(p_recipient_name,'')),'') IS NULL THEN
    RAISE EXCEPTION 'a recipient name is required';
  END IF;
  UPDATE gifts SET
      transferred_from_email = recipient_email,
      recipient_name  = btrim(p_recipient_name),
      recipient_email = nullif(lower(btrim(coalesce(p_recipient_email,''))), ''),
      -- live status vocabulary: created/paid/delivered/opened/redeemed/
      -- expired/cancelled. A transferred gift that had been opened returns to
      -- 'delivered' so the new recipient opens it fresh.
      status = CASE WHEN status = 'opened' THEN 'delivered' ELSE status END,
      opened_at = NULL
    WHERE id = p_gift_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.gift_transfer(uuid, text, text) TO authenticated;

/** Stamp a (re)send. The email itself goes through the API layer; this records
 *  the provable event so resend is countable and auditable. */
CREATE OR REPLACE FUNCTION public.gift_mark_sent(p_gift_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_g gifts%ROWTYPE;
BEGIN
  SELECT * INTO v_g FROM gifts WHERE id = p_gift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift not found'; END IF;
  IF NOT (has_staff_access() OR v_g.buyer_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not your gift';
  END IF;
  UPDATE gifts SET last_sent_at = now(), send_count = send_count + 1 WHERE id = p_gift_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.gift_mark_sent(uuid) TO authenticated;

-- ── E. Payment method + responsibility transfer (4d) ────────────────────────
/** Update the payment method recorded on an unpaid/partially-paid purchase. */
CREATE OR REPLACE FUNCTION public.update_purchase_payment_method(p_purchase_id uuid, p_method text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_p purchases%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase not found'; END IF;
  IF NOT (has_staff_access() OR v_p.buyer_user_id = auth.uid()
          OR v_p.buyer_contact_id = current_contact_id()) THEN
    RAISE EXCEPTION 'not your purchase';
  END IF;
  IF nullif(btrim(coalesce(p_method,'')),'') IS NULL THEN
    RAISE EXCEPTION 'a payment method is required';
  END IF;
  UPDATE purchases SET payment_method = btrim(p_method), updated_at = now()
   WHERE id = p_purchase_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.update_purchase_payment_method(uuid, text) TO authenticated;

/** Move payment responsibility for a purchase to another account holder
 *  (e.g. a parent taking over a rider's balance). Staff, or the current payer
 *  handing it off. The buyer_contact_id ALWAYS stays populated (Stage 2 rule);
 *  the new payer must be an account holder. */
CREATE OR REPLACE FUNCTION public.transfer_payment_responsibility(p_purchase_id uuid, p_new_payer_contact_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_p    purchases%ROWTYPE;
  v_user uuid;
BEGIN
  SELECT * INTO v_p FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase not found'; END IF;
  IF NOT (has_staff_access() OR v_p.buyer_user_id = auth.uid()
          OR v_p.buyer_contact_id = current_contact_id()) THEN
    RAISE EXCEPTION 'not your purchase';
  END IF;
  IF v_p.payment_status = 'paid' THEN
    RAISE EXCEPTION 'this purchase is already paid';
  END IF;

  SELECT user_id INTO v_user FROM profiles WHERE contact_id = p_new_payer_contact_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'the new payer must have an account';
  END IF;

  UPDATE purchases
     SET buyer_contact_id = p_new_payer_contact_id,
         buyer_user_id    = v_user,
         updated_at       = now()
   WHERE id = p_purchase_id;

  PERFORM log_status_event('order', p_purchase_id, coalesce(v_p.current_status, 'pending'),
    'Payment responsibility transferred to contact ' || p_new_payer_contact_id::text, v_p.org_id);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.transfer_payment_responsibility(uuid, uuid) TO authenticated;

-- ── F. COMPANY_POLICIES at first SERVICE purchase (Stage 2 record) ──────────
-- D8: a purchaser is a CUSTOMER; policies attach when they first buy a SERVICE
-- (any purchase_item whose offering carries a service config_kind — i.e. not a
-- pure product/gift line). Idempotent: the required-doc row is a no-op if the
-- template is already assigned or already executed for that person.
CREATE OR REPLACE FUNCTION public.attach_first_purchase_policies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_org     uuid;
BEGIN
  SELECT p.buyer_contact_id, p.org_id INTO v_contact, v_org
    FROM purchases p WHERE p.id = NEW.purchase_id;
  IF v_contact IS NULL OR v_org IS NULL THEN RETURN NEW; END IF;

  -- service line? (config_kind present and not a pure inquiry row)
  IF NOT EXISTS (
    SELECT 1 FROM offerings o
     WHERE o.id = NEW.offering_id
       AND o.config_kind IS NOT NULL
       AND o.config_kind <> 'inquire'
  ) THEN
    RETURN NEW;
  END IF;

  -- already executed (and current)? nothing to attach
  IF EXISTS (
    SELECT 1 FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
     WHERE d.contact_id = v_contact AND d.deleted_at IS NULL
       AND d.status = 'EXECUTED' AND coalesce(d.current_status,'') <> 'superseded'
       AND ct.template_key = 'COMPANY_POLICIES'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO contact_required_documents (contact_id, template_key, org_id)
  VALUES (v_contact, 'COMPANY_POLICIES', v_org)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS purchase_items_first_purchase_policies ON purchase_items;
CREATE TRIGGER purchase_items_first_purchase_policies
  AFTER INSERT ON purchase_items
  FOR EACH ROW EXECUTE FUNCTION attach_first_purchase_policies();

-- ── G. Payer picker (4d): account holders a balance may be handed to ────────
-- Directory rows are user-keyed; the transfer picker needs contact ids.
CREATE OR REPLACE FUNCTION public.payer_candidates()
RETURNS TABLE(contact_id uuid, name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.contact_id,
         coalesce(nullif(btrim(p.display_name), ''),
                  nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
                  'Member')
    FROM profiles p
    JOIN members m ON m.user_id = p.user_id AND m.status = 'active'
   WHERE p.contact_id IS NOT NULL
     AND p.org_id = current_org()
     AND auth.uid() IS NOT NULL
   ORDER BY 2;
$function$;
GRANT EXECUTE ON FUNCTION public.payer_candidates() TO authenticated;
