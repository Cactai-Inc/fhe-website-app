-- TASK-STABILIZE ITEM 1 — a party can finish activating and be told they failed.
--
-- WALK4 photographed the symptom: password set, Continue clicked, screen reads
-- "We could not finish activating your account." This is the cause, and it is
-- one line of this function.
--
--     SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
--     IF NOT FOUND THEN RAISE EXCEPTION 'no profile for the signed-in user'; END IF;
--
-- NOTHING IN THE PASSWORD-ACTIVATION PATH CREATES THAT ROW. `/api/register-invited`
-- creates the auth user; there is no trigger on `auth.users` (verified: zero
-- non-internal triggers); AuthContext only SELECTs; `ensure_my_member_access`
-- only touches `members`. The one function in the database that inserts a
-- profile for an invitee is `redeem_invitation` — the COMMUNITY redemption —
-- and a contract counterparty never calls it. So the very first thing a brand
-- new counterparty does raises, rolls back, and returns a 400 the browser
-- renders as a generic failure.
--
-- Proof from production, Walk4 WALKTEST:
--   auth.users.created_at   16:45:34.938   (register-invited)
--   profiles.created_at     16:46:53.564  ─┐ identical to the microsecond:
--   invitations.redeemed_at 16:46:53.564  ─┘ ONE transaction, and the only
--                                            function that writes both is
--                                            redeem_invitation — i.e. the
--                                            contract redemption never ran.
--   clients row for that contact: NONE — because `_ensure_client_account`
--   lives BELOW the raise and was never reached (that is ITEM 4's half of the
--   same bug; see 20260822T0110).
--
-- THE FIX: seed the profile instead of refusing. This is not a second write
-- path — it is the SAME insert `redeem_invitation` already performs, under the
-- same `app.allow_profile_link` guard, for the same reason (the profile must
-- carry its org_id, or the profiles_link_contact trigger inserts a contact
-- with a null org_id and aborts). The raise is kept for the genuinely
-- impossible case: no auth user behind auth.uid().
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

  PERFORM set_config('app.allow_profile_link', '1', true);

  -- ── STABILIZE ITEM 1 — SEED THE PROFILE RATHER THAN REFUSING ─────────────
  --
  -- A brand-new counterparty reaches this line 300ms after their account was
  -- created and has no profile row yet, because nothing creates one for them.
  -- The old `IF NOT FOUND THEN RAISE` turned the ordinary case into the error
  -- case. The insert below is `redeem_invitation`'s, verbatim in shape: the
  -- invitation's org_id (so contacts.org_id's NOT NULL is satisfiable through
  -- the link trigger), the invitation's names, the account's own email.
  SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO profiles (user_id, org_id, first_name, last_name, email)
    VALUES (auth.uid(), v_inv.org_id,
            nullif(btrim(coalesce(v_inv.first_name, '')), ''),
            nullif(btrim(coalesce(v_inv.last_name,  '')), ''),
            v_email)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
    IF NOT FOUND THEN
      -- Genuinely impossible short of the row being deleted underneath us.
      RAISE EXCEPTION 'no profile for the signed-in user';
    END IF;
  END IF;

  SELECT coalesce(is_company, false) INTO v_inv_is_company FROM contacts WHERE id = v_inv.contact_id;

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
  --
  -- ⚠️ STABILIZE ITEM 4 — THIS IS THE ONLY THING THAT GIVES A COUNTERPARTY A
  -- `clients` ROW, AND UNTIL ITEM 1 ABOVE IT WAS UNREACHABLE. The swallow stays
  -- (a contract redemption must never fail on provisioning), but it is no longer
  -- swallowing the whole function's failure to get here.
  IF NOT v_inv_is_company AND v_email IS NOT NULL THEN
    BEGIN
      PERFORM _ensure_client_account(v_inv.org_id, v_email,
        nullif(v_inv.first_name,''), nullif(v_inv.last_name,''),
        ARRAY['GUEST'], ARRAY[]::text[]);
    EXCEPTION WHEN others THEN NULL;  -- never block a contract redemption on provisioning
    END;
  END IF;

  -- PARTYEMAIL PHASE 4b — THE MOMENT THE RECORD BECOMES READABLE (D22 §7).
  -- Until now this document held only the address the party was matched on;
  -- name, phone and address were never read from the contact record because the
  -- person had not claimed the contract. They just did. Push the record into the
  -- party tokens and recompose, so the document they are about to be shown carries
  -- their own details rather than blanks. Wrapped, like the fold-in above:
  -- provisioning must never block a redemption.
  BEGIN
    PERFORM regenerate_contract_document(v_inv.document_id);
  EXCEPTION WHEN others THEN NULL;
  END;

  UPDATE invitations SET status = 'redeemed', redeemed_at = now() WHERE id = v_inv.id;
  RETURN jsonb_build_object('document_id', v_inv.document_id, 'already_signed', false);
END;
$function$;
