-- P1 ITEM 1 — ONE EMAIL, NOT TWO.
--
-- Owner, 2026-08-25: "i dont want to send her two emails since that is confusing
-- and these should be able to be married up as a unified single email send and on
-- activation she sees the contract."
--
-- WHY THERE WERE TWO. `redeem_contract_invitation` requires an existing signed-in
-- user (auth.uid() present, matching email), so the CONTRACT link assumes the
-- account already exists — which is exactly why the account invitation had to go
-- first, in its own email. A unified send must therefore CLAIM THE ACCOUNT FIRST
-- and route to the document second.
--
-- `invitations` already carries both meanings: `kind` and `document_id` are
-- existing columns. Nothing is added here; one row is made to say both things.
--
-- The CONTRACT kind and `redeem_contract_invitation` are DELIBERATELY LEFT ALONE.
-- A counterparty who already has an account is a real case and that path serves
-- it; it simply stops being used for people who have no account.

BEGIN;

-- ── 1. validate_invitation tells the claim page what the invitation is for ───
-- The Register page reads this BEFORE redemption to decide where to land. It is
-- granted to PUBLIC/anon (it is the pre-auth token check), so the grants are
-- restored explicitly below — a DROP takes them with it.
DROP FUNCTION IF EXISTS public.validate_invitation(text);
CREATE FUNCTION public.validate_invitation(p_token text)
RETURNS TABLE(id uuid, email text, status text, expires_at timestamp with time zone,
              request_id uuid, kind text, document_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT i.id, i.email, i.status, i.expires_at, i.request_id, i.kind, i.document_id
  FROM invitations i
  WHERE i.token = p_token
    AND i.status = 'sent'
    AND i.expires_at > now();
$function$;
GRANT EXECUTE ON FUNCTION public.validate_invitation(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invitation(text) TO anon, authenticated, service_role;

-- ── 2. the account invitation, made to carry the contract ────────────────────
-- Issues OR REUSES the counterparty's ACCOUNT invitation and stamps the document
-- on it. Reuse is the point: a saved-but-unsent draft (PAMELA §A) is promoted in
-- place, so the link staff already saved is the link the client receives, and no
-- row is superseded or orphaned.
CREATE OR REPLACE FUNCTION public.invite_contract_party_account(
  p_document_id uuid, p_contact_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_doc   documents%ROWTYPE;
  v_email text := lower(btrim(p_email));
  v_inv   invitations%ROWTYPE;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_days  integer;
  v_role  text;
  v_c     contacts%ROWTYPE;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  -- Same authorization arms as invite_contract_counterparty: staff of the
  -- document's org, or a service-role caller (the /api endpoint).
  IF NOT (coalesce(auth.role(), '') = 'service_role'
          OR coalesce(has_staff_access() AND v_doc.org_id = current_org(), false)) THEN
    RAISE EXCEPTION 'not authorized to invite a counterparty on document %', p_document_id;
  END IF;

  IF v_email IS NULL OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'a valid email is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM document_parties
     WHERE document_id = p_document_id AND contact_id = p_contact_id
  ) THEN
    RAISE EXCEPTION 'contact % is not a party on this contract', p_contact_id;
  END IF;

  -- SENDGUARD: never mint a signing invitation for someone who already signed.
  SELECT s.party_role INTO v_role
    FROM signatures s
   WHERE s.document_id = p_document_id
     AND s.signer_contact_id = p_contact_id
     AND s.deleted_at IS NULL
   ORDER BY s.signed_at NULLS LAST, s.created_at
   LIMIT 1;
  IF v_role IS NOT NULL THEN
    RAISE EXCEPTION 'this party has already signed this document as % — a new signing invitation cannot be sent', v_role
      USING ERRCODE = 'P0001',
            HINT = 'Their signature is on file. Open the document to see it.';
  END IF;

  -- C10: a minor cannot hold an account. The CONTRACT path never had to care —
  -- it only ever reached people who already had one. This one creates accounts,
  -- so it inherits the account rule.
  IF coalesce(is_minor_contact(p_contact_id), false) THEN
    RAISE EXCEPTION 'minors cannot be invited to hold accounts; invite the guardian';
  END IF;

  v_days := coalesce(nullif(invitation_expiry_days(v_doc.org_id), 0), 7);

  -- REUSE, in preference to issuing a second one.
  SELECT * INTO v_inv
    FROM invitations
   WHERE org_id = v_doc.org_id
     AND lower(email) = v_email
     AND coalesce(kind, 'COMMUNITY') = 'COMMUNITY'
     AND status IN ('sent', 'draft')
     AND deleted_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND THEN
    UPDATE invitations
       SET document_id = p_document_id,
           contact_id  = coalesce(contact_id, p_contact_id),
           status      = 'sent',
           -- never shorten a live window; a stale one is refreshed so the person
           -- being asked to sign has the configured time to do it
           expires_at  = greatest(expires_at, now() + make_interval(days => v_days))
     WHERE id = v_inv.id
     RETURNING * INTO v_inv;

    RETURN jsonb_build_object(
      'invitation_id', v_inv.id, 'token', v_inv.token,
      'expires_at', v_inv.expires_at, 'document_id', p_document_id, 'reused', true);
  END IF;

  SELECT * INTO v_c FROM contacts WHERE id = p_contact_id;

  INSERT INTO invitations (org_id, email, token, expires_at, status, kind,
                           document_id, contact_id, invited_role, first_name, last_name)
  VALUES (v_doc.org_id, v_email, v_token, now() + make_interval(days => v_days),
          'sent', 'COMMUNITY', p_document_id, p_contact_id, 'USER',
          nullif(btrim(coalesce(v_c.first_name, '')), ''),
          nullif(btrim(coalesce(v_c.last_name, '')), ''))
  RETURNING * INTO v_inv;

  RETURN jsonb_build_object(
    'invitation_id', v_inv.id, 'token', v_inv.token,
    'expires_at', v_inv.expires_at, 'document_id', p_document_id, 'reused', false);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.invite_contract_party_account(uuid, uuid, text)
  TO authenticated, service_role;

COMMIT;
