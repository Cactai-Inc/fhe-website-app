-- Phase 3b — ONE account-creation spine + purchase↔contract link + orphan drop.
--
-- Discovery established:
--   * redeem_gift is a bare status flip — it creates NO contact/client/category.
--   * redeem_contract_invitation links a document-party identity but creates NO
--     client/category/onboarding docs.
--   * provision_client_invitation holds the ONLY real account-creation logic, but
--     it is gated to staff/service-role and assumes an admin caller + current_org.
--   * contracts.purchase_id exists (0 populated); originator_contact_id populated.
--     start_lease_contract_v2 sets originator but not purchase_id.
--   * start_broker_contract has ZERO callers (safe DROP).
--
-- Rather than weaken the admin gate on provision_client_invitation, we EXTRACT
-- its account-creation core into a SECURITY DEFINER helper _ensure_client_account
-- that both the admin RPC and the (non-staff) redeem flows call. That makes the
-- account-creation logic single-sourced — the true "one spine" — while the admin
-- authorization stays on the admin-facing RPC.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The shared account-creation core: upsert contact → ensure client → standing
--    categories → onboarding docs. Idempotent. SECURITY DEFINER so redeem flows
--    (plain authenticated users) can create their own account through it without
--    the admin gate. Returns {contact_id, client_id}.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._ensure_client_account(
  p_org uuid, p_email text, p_first_name text, p_last_name text,
  p_categories text[], p_template_keys text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_client  uuid;
  v_email   text := lower(trim(p_email));
  v_fn      text := nullif(trim(coalesce(p_first_name, '')), '');
  v_ln      text := nullif(trim(coalesce(p_last_name,  '')), '');
  v_cats    text[];
BEGIN
  IF p_org IS NULL THEN RAISE EXCEPTION 'org is required'; END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'email is required'; END IF;

  SELECT array_agg(DISTINCT upper(btrim(c))) INTO v_cats
    FROM unnest(coalesce(p_categories, '{}')) c WHERE btrim(c) <> '';
  IF v_cats IS NULL OR array_length(v_cats, 1) IS NULL THEN
    v_cats := ARRAY['GUEST'];  -- redeem flows default to GUEST; admin RPC always passes explicit cats
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_cats) c WHERE c NOT IN ('GUEST','RIDER','HORSE_OWNER')) THEN
    RAISE EXCEPTION 'categories must be a subset of GUEST/RIDER/HORSE_OWNER';
  END IF;

  -- upsert contact by email (skip contacts owned by a DIFFERENT account's profile)
  SELECT c.id INTO v_contact FROM contacts c
    WHERE lower(c.email) = v_email AND c.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND lower(coalesce(p.email,'')) <> v_email)
    ORDER BY c.created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email)
      VALUES (p_org, v_fn, v_ln, v_email) RETURNING id INTO v_contact;
  ELSE
    UPDATE contacts SET
        first_name = CASE WHEN v_fn IS NOT NULL AND (NULLIF(trim(coalesce(first_name,'')),'') IS NULL
                            OR lower(trim(first_name)) = lower(coalesce(email,''))) THEN v_fn ELSE first_name END,
        last_name  = CASE WHEN v_ln IS NOT NULL AND NULLIF(trim(coalesce(last_name,'')),'') IS NULL
                          THEN v_ln ELSE last_name END
      WHERE id = v_contact;
  END IF;

  SELECT cl.id INTO v_client FROM clients cl WHERE cl.contact_id = v_contact AND cl.deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source)
      VALUES (p_org, v_contact, 'provisioned invitation') RETURNING id INTO v_client;
  END IF;

  INSERT INTO contact_roles (contact_id, role_type)
  SELECT v_contact, c FROM unnest(v_cats) c
  ON CONFLICT ON CONSTRAINT contact_roles_contact_id_role_type_key DO NOTHING;

  IF p_template_keys IS NOT NULL THEN
    INSERT INTO contact_required_documents (contact_id, template_key, org_id)
    SELECT v_contact, k, p_org FROM unnest(p_template_keys) k WHERE btrim(k) <> ''
    ON CONFLICT DO NOTHING;
  ELSE
    PERFORM apply_category_documents(v_contact);
  END IF;

  RETURN jsonb_build_object('contact_id', v_contact, 'client_id', v_client);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Refactor provision_client_invitation to delegate account-creation to the
--    shared helper (admin gate + org resolution + purchase + invitation stay
--    here). Behaviour identical to before; logic now single-sourced.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.provision_client_invitation(
  p_email text, p_first_name text, p_last_name text, p_categories text[],
  p_offering_ids uuid[] DEFAULT '{}', p_template_keys text[] DEFAULT NULL,
  p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL,
  p_notes text DEFAULT NULL, p_request_id uuid DEFAULT NULL,
  p_org_id uuid DEFAULT NULL, p_partial_amount numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_contact  uuid;
  v_client   uuid;
  v_acct     jsonb;
  v_purchase uuid;
  v_inv_id   uuid;
  v_token    text;
  v_total    numeric := 0;
  v_labels   text[];
  v_has_off  boolean := (array_length(p_offering_ids, 1) IS NOT NULL);
  v_dup_purchase uuid;
  v_cats     text[];
  v_email    text := lower(trim(p_email));
  v_fn       text := nullif(trim(coalesce(p_first_name, '')), '');
  v_ln       text := nullif(trim(coalesce(p_last_name,  '')), '');
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to provision invitations';
  END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'email is required'; END IF;

  SELECT array_agg(DISTINCT upper(btrim(c))) INTO v_cats
    FROM unnest(coalesce(p_categories, '{}')) c WHERE btrim(c) <> '';
  IF v_cats IS NULL OR array_length(v_cats, 1) IS NULL THEN
    RAISE EXCEPTION 'at least one category is required';
  END IF;

  v_org := p_org_id;
  IF v_org IS NULL AND v_has_off THEN
    SELECT o.org_id INTO v_org FROM offerings o WHERE o.id = p_offering_ids[1];
  END IF;
  v_org := coalesce(v_org, current_org());
  IF v_org IS NULL THEN RAISE EXCEPTION 'could not resolve org for this invitation'; END IF;

  -- single-sourced account creation
  v_acct    := _ensure_client_account(v_org, v_email, v_fn, v_ln, v_cats, p_template_keys);
  v_contact := (v_acct->>'contact_id')::uuid;
  v_client  := (v_acct->>'client_id')::uuid;

  IF v_has_off THEN
    SELECT p.id INTO v_dup_purchase
      FROM purchases p
     WHERE p.buyer_contact_id = v_contact AND coalesce(p.status,'') <> 'void' AND p.deleted_at IS NULL
       AND (SELECT array_agg(DISTINCT pi.offering_id ORDER BY pi.offering_id)
              FROM purchase_items pi WHERE pi.purchase_id = p.id)
           = (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_offering_ids) x)
     ORDER BY p.created_at DESC LIMIT 1;
    IF v_dup_purchase IS NOT NULL THEN
      v_purchase := v_dup_purchase;
    ELSE
      v_purchase := _provision_purchase_for_offerings(
        v_org, v_contact, v_client, p_offering_ids,
        p_mark_paid, p_payment_method, p_notes, p_partial_amount);
    END IF;
    SELECT coalesce(sum(o.price_amount), 0), array_agg(o.name) INTO v_total, v_labels
      FROM offerings o WHERE o.id = ANY(p_offering_ids);
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO invitations (org_id, request_id, email, token, expires_at, status,
                           first_name, last_name, contact_id, categories, offering_ids, template_keys)
    VALUES (v_org, p_request_id, v_email, v_token,
            now() + (invitation_expiry_days(v_org) || ' days')::interval, 'sent',
            v_fn, v_ln, v_contact, v_cats, nullif(p_offering_ids, '{}'), p_template_keys)
    RETURNING id INTO v_inv_id;

  IF p_request_id IS NOT NULL THEN
    UPDATE requests SET status = 'invited' WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object(
    'invitation_id', v_inv_id, 'token', v_token, 'contact_id', v_contact,
    'purchase_id', v_purchase, 'categories', v_cats, 'amount', coalesce(v_total, 0),
    'labels', coalesce(v_labels, ARRAY[]::text[]), 'request_id', p_request_id);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fold redeem_gift into the spine: on redemption, ensure the recipient has a
--    GUEST account (their auth email + the gift's org) so a gift recipient is a
--    real client, not a bare status flip.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_gift(p_code text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_gift  gifts%ROWTYPE;
  v_email text;
  v_fn    text;
  v_ln    text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'not_authenticated'; END IF;

  SELECT * INTO v_gift FROM gifts WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_gift.status = 'redeemed' THEN RETURN 'already_redeemed'; END IF;
  IF v_gift.expires_at IS NOT NULL AND v_gift.expires_at < now() THEN RETURN 'expired'; END IF;
  IF v_gift.unlock_gate = 'intro_call' AND NOT v_gift.unlocked THEN RETURN 'awaiting_intro_call'; END IF;

  UPDATE gifts SET status = 'redeemed', redeemed_at = now(), redeemed_user_id = auth.uid()
  WHERE id = v_gift.id;

  -- provision the recipient as a GUEST client so the gift lands on a real
  -- account (best-effort — the gift is redeemed either way).
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
  v_email := coalesce(v_email, lower(nullif(trim(v_gift.recipient_email), '')));
  IF v_email IS NOT NULL AND v_gift.org_id IS NOT NULL THEN
    v_fn := nullif(split_part(coalesce(v_gift.recipient_name, ''), ' ', 1), '');
    v_ln := nullif(btrim(substr(coalesce(v_gift.recipient_name, ''), coalesce(nullif(position(' ' in coalesce(v_gift.recipient_name,'')), 0), length(coalesce(v_gift.recipient_name,''))+1))), '');
    BEGIN
      PERFORM _ensure_client_account(v_gift.org_id, v_email, v_fn, v_ln, ARRAY['GUEST'], NULL);
    EXCEPTION WHEN others THEN NULL;  -- never block redemption on provisioning
    END;
  END IF;

  RETURN 'redeemed';
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fold contract-counterparty redemption into the spine: after the existing
--    party-identity link, ensure the redeemer has a GUEST client account + the
--    contract's document requirements, and mark the invitation 'redeemed' (the
--    new success marker). Additive — the delicate party-repoint logic is intact.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_contract_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inv     invitations%ROWTYPE;
  v_email   text;
  v_profile profiles%ROWTYPE;
  v_inv_is_company boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in before redeeming an invitation'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM invitations
   WHERE token = p_token AND status = 'sent' AND expires_at > now() AND kind = 'CONTRACT';
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation is not valid or has expired'; END IF;
  IF lower(v_inv.email) IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'this invitation was issued to a different email address';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'no profile for the signed-in user'; END IF;

  SELECT coalesce(is_company, false) INTO v_inv_is_company FROM contacts WHERE id = v_inv.contact_id;

  PERFORM set_config('app.allow_profile_link', '1', true);

  IF v_profile.contact_id IS NULL THEN
    IF NOT v_inv_is_company THEN
      UPDATE profiles SET contact_id = v_inv.contact_id, org_id = coalesce(org_id, v_inv.org_id)
       WHERE user_id = auth.uid();
    ELSE
      UPDATE profiles SET org_id = coalesce(org_id, v_inv.org_id) WHERE user_id = auth.uid();
    END IF;
  ELSIF v_profile.contact_id <> v_inv.contact_id AND NOT v_inv_is_company THEN
    UPDATE document_parties SET contact_id = v_profile.contact_id WHERE contact_id = v_inv.contact_id;
    UPDATE contract_parties SET contact_id = v_profile.contact_id WHERE contact_id = v_inv.contact_id;
    UPDATE document_shares SET shared_with_contact_id = v_profile.contact_id
     WHERE shared_with_contact_id = v_inv.contact_id;
    UPDATE documents SET originator_contact_id = v_profile.contact_id
     WHERE originator_contact_id = v_inv.contact_id AND deleted_at IS NULL;
  END IF;

  -- FOLD-IN: ensure the counterparty is a real GUEST client (individuals only —
  -- a company party is represented by the company contact, not the person).
  IF NOT v_inv_is_company AND v_email IS NOT NULL THEN
    BEGIN
      PERFORM _ensure_client_account(v_inv.org_id, v_email,
        nullif(v_inv.first_name,''), nullif(v_inv.last_name,''), ARRAY['GUEST'], NULL);
    EXCEPTION WHEN others THEN NULL;  -- never block a contract redemption on provisioning
    END;
  END IF;

  UPDATE invitations SET status = 'redeemed', redeemed_at = now() WHERE id = v_inv.id;
  RETURN jsonb_build_object('document_id', v_inv.document_id);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Purchase↔contract link: populate contracts.purchase_id when a contract is
--    started from a purchase context. start_lease_contract_v2 already sets
--    originator_contact_id; we add an explicit linker the FE (NewContractPage)
--    calls when it knows the originating purchase, and a convenience that stamps
--    originator from the purchase's buyer if absent. Contract creation stays manual.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.link_contract_to_purchase(
  p_contract_id uuid, p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_buyer uuid;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM contracts WHERE id = p_contract_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'contract not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM purchases WHERE id = p_purchase_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'purchase not found';
  END IF;
  SELECT buyer_contact_id INTO v_buyer FROM purchases WHERE id = p_purchase_id;
  UPDATE contracts
     SET purchase_id = p_purchase_id,
         originator_contact_id = coalesce(originator_contact_id, v_buyer)
   WHERE id = p_contract_id;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Drop the orphaned start_broker_contract (zero callers, confirmed).
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.start_broker_contract(uuid, text, uuid);

COMMIT;
