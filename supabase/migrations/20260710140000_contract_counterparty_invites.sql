-- SPEC G — contract-counterparty invitation + redemption. A lease/purchase
-- counterparty is invited BY EMAIL to a specific contract; on redemption their
-- profile links to the engagement's party contact (so caller_party_roles /
-- set_contract_field / signing authorize them) and they get NO community
-- membership — the contract, not the feed, is their surface.

-- ── 1. invitation carrier columns (additive; existing community invites keep
--       kind='COMMUNITY' semantics via the default) ──
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS kind        text NOT NULL DEFAULT 'COMMUNITY'
  CHECK (kind IN ('COMMUNITY','CONTRACT'));
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES documents(id);
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS contact_id  uuid REFERENCES contacts(id);

-- ── 2. role-guard escape for the controlled profile-link write. The guard
--       (20260710060000) blocks non-admin org_id changes; contract redemption
--       legitimately sets org_id on a fresh counterparty profile. The escape is
--       transaction-local and settable only inside SECURITY DEFINER redemption. ──
CREATE OR REPLACE FUNCTION public.profiles_role_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- controlled privileged paths (contract-invite redemption) set this flag
  -- transaction-locally inside a SECURITY DEFINER function.
  IF current_setting('app.allow_profile_link', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'only an admin may change role, admin flag, or org';
    END IF;
    IF (NEW.role = 'SUPER_ADMIN' OR OLD.role = 'SUPER_ADMIN')
       AND app_role() <> 'SUPER_ADMIN' THEN
      RAISE EXCEPTION 'only a super admin may grant or revoke super admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. issue a contract invite (staff, or the service-role API) ──
CREATE OR REPLACE FUNCTION invite_contract_counterparty(
  p_document_id uuid,
  p_contact_id  uuid,
  p_email       text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_doc   documents%ROWTYPE;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id    uuid;
BEGIN
  -- staff of the document's org, or a service-role caller (auth.uid() null)
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;
  IF auth.uid() IS NOT NULL AND NOT (has_staff_access() AND v_doc.org_id = current_org()) THEN
    RAISE EXCEPTION 'not authorized to invite a counterparty on document %', p_document_id;
  END IF;
  IF p_email IS NULL OR p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'a valid email is required';
  END IF;
  -- the contact must be a party on the document's engagement
  IF NOT EXISTS (
    SELECT 1 FROM engagement_parties
    WHERE engagement_id = v_doc.engagement_id AND contact_id = p_contact_id
  ) THEN
    RAISE EXCEPTION 'contact % is not a party on this contract''s engagement', p_contact_id;
  END IF;

  INSERT INTO invitations (org_id, email, token, expires_at, status, kind, document_id, contact_id)
  VALUES (v_doc.org_id, lower(trim(p_email)), v_token, now() + interval '14 days',
          'sent', 'CONTRACT', p_document_id, p_contact_id)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'invitation_id', v_id, 'token', v_token,
    'document_id', p_document_id, 'expires_at', now() + interval '14 days');
END;
$fn$;

REVOKE ALL ON FUNCTION invite_contract_counterparty(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION invite_contract_counterparty(uuid, uuid, text) TO authenticated, service_role;

-- ── 4. redeem: link the signed-in user to the party contact; NO membership ──
CREATE OR REPLACE FUNCTION redeem_contract_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_inv     invitations%ROWTYPE;
  v_email   text;
  v_profile profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in before redeeming an invitation';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM invitations
   WHERE token = p_token AND status = 'sent' AND expires_at > now() AND kind = 'CONTRACT';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation is not valid or has expired';
  END IF;
  IF lower(v_inv.email) IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'this invitation was issued to a different email address';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no profile for the signed-in user';
  END IF;

  PERFORM set_config('app.allow_profile_link', '1', true);

  IF v_profile.contact_id IS NULL THEN
    -- fresh account: adopt the engagement's party contact as their identity
    UPDATE profiles
       SET contact_id = v_inv.contact_id,
           org_id     = coalesce(org_id, v_inv.org_id)
     WHERE user_id = auth.uid();
  ELSIF v_profile.contact_id <> v_inv.contact_id THEN
    -- existing account with its own contact: keep THEIR contact singular and
    -- repoint the engagement party rows + shares from the invite's placeholder
    -- contact to the account's contact.
    UPDATE engagement_parties SET contact_id = v_profile.contact_id
     WHERE contact_id = v_inv.contact_id;
    UPDATE document_shares SET shared_with_contact_id = v_profile.contact_id
     WHERE shared_with_contact_id = v_inv.contact_id;
    UPDATE documents SET originator_contact_id = v_profile.contact_id
     WHERE originator_contact_id = v_inv.contact_id AND deleted_at IS NULL;
  END IF;

  UPDATE invitations SET status = 'accepted' WHERE id = v_inv.id;

  -- deliberately NO memberships insert — a contract counterparty is not a
  -- community member; their surface is the contract + their own account.
  RETURN jsonb_build_object('document_id', v_inv.document_id);
END;
$fn$;

REVOKE ALL ON FUNCTION redeem_contract_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION redeem_contract_invitation(text) TO authenticated, service_role;

COMMENT ON FUNCTION redeem_contract_invitation(text) IS
  'Contract-invite redemption: validates the token/email like redeem_invitation, then links the signed-in profile to the engagement party contact (fresh account adopts the contact; an existing account keeps its contact and the party rows repoint to it). Marks the invite accepted. Grants NO community membership. Returns {document_id} — the app routes there.';
