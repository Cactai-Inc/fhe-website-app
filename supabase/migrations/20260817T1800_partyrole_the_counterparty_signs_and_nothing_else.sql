-- TASK-PARTYROLE — a contract counterparty signs the contract and nothing else.
--
-- OWNER RULING 2026-08-17: "a seller/lessor who is already boarding at our
-- facility has no need to sign our policies, rules, or general release. they
-- are simply leasing or selling us or our client their horse." And, decisively:
-- "so we can apply a document or set to them but we dont have a requirement to
-- do so."
--
-- The requirement is NONE; the default is {}; staff may still apply ANY document
-- or set, case by case. This migration builds the DEFAULT and removes the two
-- places that overrode it.
--
-- ── P1 ── the dead `Deal client` requirements row.
-- `CATEGORY_TOKEN` maps 'Deal client' -> 'GUEST' in the browser BEFORE the RPC is
-- called, and `apply_category_documents` matches on the category STRING, so the
-- 'Deal client' row has never matched anything. The screen read it and promised
-- one document; the database resolved Guest's three and wrote three. Under the
-- owner's ruling the THREE are correct, so the row is what lies. Only two
-- functions read `category_document_requirements` at all —
-- `apply_category_documents` (never matches it) and `category_document_defaults`
-- (the prefill this row misleads). Nothing else depends on it.
--
-- ── P2 ── redeem_contract_invitation's FOLD-IN assigned Guest's three.
-- THE LIVE DEFECT THIS TASK EXISTS FOR. The counterparty path
-- (`invite_contract_counterparty` -> CONTRACT invitation -> redeem) carries no
-- categories and no template keys, exactly as a Party should. But the FOLD-IN
-- block called `_ensure_client_account(..., ARRAY['GUEST'], NULL)` — and a NULL
-- `p_template_keys` falls through to `apply_category_documents(contact,
-- ARRAY['GUEST'])`, which:
--   (a) INSERTS Guest's three onto a person who owes nothing, and
--   (b) DELETES every requirement row NOT in Guest's three.
-- (b) is the destructive case the owner named: a boarder who already signed the
-- five horse-owner documents, invited as LESSOR, would have
-- HORSE_EMERGENCY_VET / RELEASE_HORSE_CARE / RELEASE_PARTICIPANT stripped from
-- their record and an unsigned RELEASE_GENERAL added in their place. Every
-- onboarding template is `wall_gating`, so that new unsigned row then blocks the
-- very lease they were invited to sign ("Onboarding documents must be completed
-- first by: ...") — the stall TASK-CONTRACTWALK found, manufactured by the
-- invitation itself.
--
-- An EXPLICIT EMPTY array takes the other branch: INSERT ... FROM unnest('{}')
-- inserts nothing, and `apply_category_documents` — the only thing that deletes —
-- is never reached. The account, the clients row and the promotion are unchanged;
-- only the paperwork side effect goes.
--
-- ── P3 ── onboarding_template_options(): the universe staff may apply FROM.
-- The "apply anything" half of the ruling needs a list that is not the category
-- defaults, because a Party has no category defaults by design. This returns the
-- ONBOARDING class — active, latest-version, `wall_gating` — which is 9 templates
-- where the defaults cover only 7. It is a floor for what staff may reach, never
-- a ceiling on it: the contract templates (leases, bill of sale) are excluded
-- because they are not first-login paperwork, not because staff may not use them.
--
-- NOT DONE HERE, DELIBERATELY: no `Party` provisioning category, and no fifth
-- `groups.group_type`. The Party role already has a home —
-- `document_parties.party_role`, whose CHECK constraint has allowed LESSOR and
-- SELLER since it was written. A PARTY group token would have to be hand-written
-- (groups are DERIVED, and `derive_affiliations` is the sole writer), and nothing
-- would branch on it. See docs/reports/TASK-PARTYROLE-REPORT.md §R2.

-- ── P1 ─────────────────────────────────────────────────────────────────────
DELETE FROM category_document_requirements WHERE category = 'Deal client';

-- ── P2 ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_contract_invitation(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv     invitations%ROWTYPE;
  v_email   text;
  v_profile profiles%ROWTYPE;
  v_inv_is_company boolean;
  v_signed  boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in before redeeming an invitation'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  -- SENDGUARD: resolve the token WITHOUT the liveness filter first, so an
  -- already-signed party who clicks a spent/superseded/expired link can still be
  -- routed to their own signed document. The liveness rules are re-applied below
  -- for anyone who has NOT signed — unchanged.
  SELECT * INTO v_inv FROM invitations
   WHERE token = p_token AND kind = 'CONTRACT'
   ORDER BY created_at DESC
   LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation is not valid or has expired'; END IF;
  IF lower(v_inv.email) IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'this invitation was issued to a different email address';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM signatures s
     WHERE s.document_id = v_inv.document_id
       AND s.deleted_at IS NULL
       AND (s.signer_contact_id = v_inv.contact_id
            OR s.signer_user_id = auth.uid()
            OR s.signer_contact_id = (SELECT p.contact_id FROM profiles p WHERE p.user_id = auth.uid()))
  ) INTO v_signed;

  IF v_signed THEN
    -- Nothing to provision and nothing to re-sign: they are already on the
    -- document. Retire a still-live token so it cannot be walked twice, and
    -- leave a spent/superseded one exactly as it is.
    UPDATE invitations
       SET status = 'redeemed', redeemed_at = coalesce(redeemed_at, now())
     WHERE id = v_inv.id AND status = 'sent';
    RETURN jsonb_build_object('document_id', v_inv.document_id, 'already_signed', true);
  END IF;

  -- ORIGINAL liveness rules for a party who has not signed.
  IF NOT (v_inv.status = 'sent' AND v_inv.expires_at > now()) THEN
    RAISE EXCEPTION 'invitation is not valid or has expired';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'no profile for the signed-in user'; END IF;

  SELECT coalesce(is_company, false) INTO v_inv_is_company FROM contacts WHERE id = v_inv.contact_id;

  PERFORM set_config('app.allow_profile_link', '1', true);

  IF v_profile.contact_id IS NULL THEN
    IF NOT v_inv_is_company THEN
      PERFORM promote_contact_to_account(auth.uid(), v_inv.contact_id);
    ELSE
      UPDATE profiles SET org_id = coalesce(org_id, v_inv.org_id) WHERE user_id = auth.uid();
    END IF;
  ELSIF v_profile.contact_id <> v_inv.contact_id AND NOT v_inv_is_company THEN
    -- THE SPINE merges the duplicate counterparty contact into the account's
    -- contact (documents/parties/signatures/shares re-anchor, duplicate
    -- dissolves) — replacing the hand-rolled partial re-point.
    PERFORM promote_contact_to_account(auth.uid(), v_inv.contact_id);
    UPDATE documents SET originator_contact_id = v_profile.contact_id
     WHERE originator_contact_id = v_inv.contact_id AND deleted_at IS NULL;
  END IF;

  -- FOLD-IN: ensure the counterparty has a real account + clients row (individuals
  -- only — a company party is represented by the company contact, not the person).
  --
  -- PARTYROLE 2026-08-17: `p_template_keys` is an EXPLICIT EMPTY ARRAY, not NULL.
  -- NULL meant "fall through to the category defaults", and the category is
  -- GUEST, so redeeming a contract invitation assigned the general release,
  -- company policies and facility rules to a counterparty who owes none of them —
  -- and, because `apply_category_documents` deletes every requirement outside the
  -- wanted set, STRIPPED the horse-owner requirements off a boarder who was
  -- invited as Lessor. '{}' takes the explicit branch: nothing is inserted, and
  -- nothing is deleted. A Party's document set is decided by staff, never here.
  IF NOT v_inv_is_company AND v_email IS NOT NULL THEN
    BEGIN
      PERFORM _ensure_client_account(v_inv.org_id, v_email,
        nullif(v_inv.first_name,''), nullif(v_inv.last_name,''),
        ARRAY['GUEST'], ARRAY[]::text[]);
    EXCEPTION WHEN others THEN NULL;  -- never block a contract redemption on provisioning
    END;
  END IF;

  UPDATE invitations SET status = 'redeemed', redeemed_at = now() WHERE id = v_inv.id;
  RETURN jsonb_build_object('document_id', v_inv.document_id, 'already_signed', false);
END;
$function$;

-- ── P3 ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.onboarding_template_options()
 RETURNS TABLE(template_key text, title text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ct.template_key, ct.title
    FROM contract_templates ct
   WHERE has_staff_access()
     AND ct.active AND ct.deleted_at IS NULL
     AND coalesce(ct.wall_gating, false)
     AND ct.version = (SELECT max(x.version) FROM contract_templates x
                        WHERE x.template_key = ct.template_key
                          AND x.active AND x.deleted_at IS NULL)
   ORDER BY ct.title
$function$;

GRANT EXECUTE ON FUNCTION public.onboarding_template_options() TO authenticated;
