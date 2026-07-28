-- Stage 2b (REMEDIATION_PLAN): ALL account-creation entry points route through
-- the promotion spine. The five-writers problem must not regrow.
--
-- Entry-point map after this migration (verified against the 2-verify-first
-- enumeration):
--   redeem_invitation           → profile bootstrap + promote_contact_to_account
--   redeem_contract_invitation  → person branch promotes via the spine; the
--                                 company branch (is_company, by id) never
--                                 links or dissolves (D7/D8)
--   admin provisioning          → _ensure_client_account (the contact-side
--                                 spine, markers stamped — Stage 2a)
--   kiosk (sign_release)        → contact-side client shell + client_since;
--                                 account linkage happens at promotion
--   self-signup                 → account only; community via the re-based
--                                 ensure_my_member_access (D8); contact
--                                 linkage happens when a flow promotes
--   gift redeem                 → not built yet; Stage 4 lands it ON this
--                                 spine (auto-account via _ensure_client_account
--                                 p_marker=>'CUSTOMER' + promote at redemption)

-- ── redeem_invitation: the account-creation path promotes through the spine ──
CREATE OR REPLACE FUNCTION public.redeem_invitation(p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inv     invitations%ROWTYPE;
  v_email   text;
  v_fn      text;
  v_ln      text;
  v_title   text;
  v_contact uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in before redeeming an invitation';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM invitations
   WHERE token = p_token AND status = 'sent' AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation is not valid or has expired';
  END IF;
  IF lower(v_inv.email) IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'this invitation was issued to a different email address';
  END IF;

  v_fn    := nullif(btrim(coalesce(v_inv.first_name, '')), '');
  v_ln    := nullif(btrim(coalesce(v_inv.last_name,  '')), '');
  v_title := nullif(btrim(coalesce(v_inv.title,      '')), '');

  PERFORM set_config('app.allow_profile_link', '1', true);

  INSERT INTO profiles (user_id, org_id, first_name, last_name)
  VALUES (auth.uid(), v_inv.org_id, v_fn, v_ln)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE profiles
     SET role       = CASE WHEN v_inv.invited_role <> 'USER' THEN v_inv.invited_role ELSE role END,
         is_admin   = CASE WHEN v_inv.invited_role = 'ADMIN' THEN true ELSE is_admin END,
         org_id     = coalesce(org_id, v_inv.org_id),
         first_name = coalesce(nullif(btrim(coalesce(first_name, '')), ''), v_fn),
         last_name  = coalesce(nullif(btrim(coalesce(last_name,  '')), ''), v_ln)
   WHERE user_id = auth.uid();

  -- Resolve the person contact this invitation belongs to: the invitation's
  -- own contact, else the same by-email resolution the provisioning spine
  -- uses (never a company contact, never email-matching the shared pair —
  -- is_company is excluded structurally).
  v_contact := v_inv.contact_id;
  IF v_contact IS NULL THEN
    SELECT c.id INTO v_contact FROM contacts c
     WHERE lower(c.email) = v_email AND c.deleted_at IS NULL AND NOT c.is_company
       AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND p.user_id <> auth.uid())
     ORDER BY c.created_at LIMIT 1;
  END IF;

  IF v_contact IS NOT NULL THEN
    -- THE SPINE: link/merge, signature account-stamp, members, derive groups.
    PERFORM promote_contact_to_account(auth.uid(), v_contact);
  ELSE
    -- No person contact exists yet (bare account) — community still follows
    -- the account (D8).
    INSERT INTO members (user_id, status, org_id)
    VALUES (auth.uid(), 'active', v_inv.org_id)
    ON CONFLICT (user_id) DO UPDATE SET status = 'active';
  END IF;

  IF v_inv.invited_role IN ('MANAGER','ADMIN','EMPLOYEE') AND v_title IS NOT NULL THEN
    UPDATE profiles SET title = v_title, staff_active = true WHERE user_id = auth.uid();
  END IF;

  -- Success: 'redeemed' is the new terminal success marker (accepted stays as
  -- the legacy value on historical rows).
  UPDATE invitations SET status = 'redeemed', redeemed_at = now() WHERE id = v_inv.id;
  RETURN true;
END;
$function$;

-- ── redeem_contract_invitation: the person branch promotes via the spine ─────
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='redeem_contract_invitation';
  -- unlinked profile + person contact → spine (was a hand-rolled UPDATE)
  v_src := replace(v_src,
$old$  IF v_profile.contact_id IS NULL THEN
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
     WHERE shared_with_contact_id = v_inv.contact_id;$old$,
$new$  IF v_profile.contact_id IS NULL THEN
    IF NOT v_inv_is_company THEN
      PERFORM promote_contact_to_account(auth.uid(), v_inv.contact_id);
    ELSE
      UPDATE profiles SET org_id = coalesce(org_id, v_inv.org_id) WHERE user_id = auth.uid();
    END IF;
  ELSIF v_profile.contact_id <> v_inv.contact_id AND NOT v_inv_is_company THEN
    -- THE SPINE merges the duplicate counterparty contact into the account's
    -- contact (documents/parties/signatures/shares re-anchor, duplicate
    -- dissolves) — replacing the hand-rolled partial re-point.
    PERFORM promote_contact_to_account(auth.uid(), v_inv.contact_id);$new$);
  IF v_src NOT ILIKE '%promote_contact_to_account%' THEN
    RAISE EXCEPTION 'redeem_contract_invitation rewrite incomplete';
  END IF;
  EXECUTE v_src;
END $$;

-- ── ensure_contact_for_profile: creation stays, linking goes through the
--    spine. Hardened: is_company contacts are excluded from the email match
--    (the shared hello@ pair — company is matched by id ONLY, D7 rule), and
--    the D1 protected users are refused outright so the platform owner's
--    severed bridge can never silently regrow. ──────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_contact_for_profile(p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c_denied_users constant uuid[] := ARRAY[
    'b45a5503-89bc-489a-b012-c7fbf5c09632',  -- admin@fhequestrian.com
    'fdbdfe89-76d7-486b-b734-8e23b09e0353',  -- hello@fhequestrian.com
    '3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5'   -- admin@cactai.io (platform)
  ]::uuid[];
  v_profile    profiles%ROWTYPE;
  v_contact_id uuid;
  v_first text;
  v_last  text;
  v_org   uuid;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_profile.contact_id IS NOT NULL THEN
    RETURN v_profile.contact_id;
  END IF;

  -- D1: protected identities never regrow a tenant bridge through this path.
  IF p_user_id = ANY(c_denied_users) THEN
    RETURN NULL;
  END IF;

  v_org := coalesce(v_profile.org_id, current_org());
  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;

  v_first := NULLIF(trim(coalesce(v_profile.first_name, '')), '');
  v_last  := NULLIF(trim(coalesce(v_profile.last_name,  '')), '');
  IF v_first IS NULL AND v_last IS NULL THEN
    v_first := coalesce(v_profile.email, 'Unnamed Contact');
  END IF;

  IF v_profile.email IS NOT NULL THEN
    SELECT c.id INTO v_contact_id
    FROM contacts c
    WHERE lower(c.email) = lower(v_profile.email)
      AND c.org_id = v_org
      AND c.deleted_at IS NULL
      AND NOT c.is_company  -- company is matched by id only, never email
      AND NOT EXISTS (SELECT 1 FROM profiles p2 WHERE p2.contact_id = c.id AND p2.user_id <> p_user_id)
    ORDER BY c.created_at
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email, phone,
                          address_line1, address_line2, city, state, postal_code)
    VALUES (v_org, v_first, v_last, v_profile.email, v_profile.phone,
            v_profile.address_line1, v_profile.address_line2, v_profile.city, v_profile.state, v_profile.postal_code)
    RETURNING id INTO v_contact_id;
  END IF;

  -- THE SPINE does the linking (members + derivation ride along).
  PERFORM promote_contact_to_account(p_user_id, v_contact_id);
  RETURN v_contact_id;
END;
$function$;

-- ── Assertion: no other function hand-writes profiles.contact_id ────────────
DO $$
DECLARE v_bad text;
BEGIN
  SELECT string_agg(proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND prosrc ~* 'SET\s+contact_id' AND prosrc ILIKE '%profiles%'
     AND proname NOT IN ('promote_contact_to_account');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'profiles.contact_id writers outside the spine: %', v_bad;
  END IF;
END $$;
