-- SENDGUARD §1 — a signing invitation is never issued to a party who already
-- signed, and an already-signed party's stale link lands on their document.
--
-- Established by TASK-SENDGUARD (verified against production 2026-08-09):
-- neither api/contract-invite.ts, nor invite_contract_counterparty, nor
-- redeem_contract_invitation looks at `signatures` at all. api/deliver-documents.ts
-- does (409 unless every document is EXECUTED) — the discipline exists in this
-- codebase, the signing-invite path never got it.
--
-- Two changes, both narrow:
--
-- 1. invite_contract_counterparty REFUSES when the target contact already holds a
--    live signature on the document. The RPC is directly callable, so it guards
--    independently of the endpoint — the endpoint gets the same check so the UI
--    can render a refusal instead of a raw database error.
--
--    Grain: the RPC takes (document_id, contact_id) and has no role parameter, so
--    the guard is "this contact has signed this document", which is the grain the
--    signature roster actually offers for it. The endpoint, which does know the
--    role, checks (document_id, contact_id, party_role).
--
--    NOT an override. Staff who need a corrected version re-signed have no way
--    past this yet — that is a live owner decision (re-sign / template-version)
--    that this task must not pre-empt. The refusal is deliberately loud.
--
-- 2. redeem_contract_invitation looks the token up WITHOUT the liveness filter,
--    and when the redeemer has already signed, RETURNS the document instead of
--    raising. Today a spent, superseded, or expired link raises
--    'invitation is not valid or has expired' — a dead end for someone whose
--    signature is already on file. The screen that shows a signed document
--    already exists; this routes to it.
--
--    Everything else about redemption is unchanged: the email must still match,
--    and an UNSIGNED party still faces the original liveness rules (status='sent'
--    AND expires_at > now()), the original provisioning, and the original errors.
--    The negative path is preserved deliberately — the guard must not lock out
--    the party who has NOT signed.
--
-- No row is written by this migration. Both functions are replaced whole (not
-- string-rewritten), and the DO block at the end asserts the new text is live so
-- a silent no-op cannot report success.

BEGIN;

CREATE OR REPLACE FUNCTION public.invite_contract_counterparty(p_document_id uuid, p_contact_id uuid, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  v_doc   documents%ROWTYPE;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id    uuid;
  v_role  text;
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
  -- the contact must be a party on the document (spine roster)
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

  INSERT INTO invitations (org_id, email, token, expires_at, status, kind, document_id, contact_id)
  VALUES (v_doc.org_id, lower(trim(p_email)), v_token, now() + interval '14 days',
          'sent', 'CONTRACT', p_document_id, p_contact_id)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'invitation_id', v_id, 'token', v_token,
    'document_id', p_document_id, 'expires_at', now() + interval '14 days');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.redeem_contract_invitation(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
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
  RETURN jsonb_build_object('document_id', v_inv.document_id, 'already_signed', false);
END;
$fn$;

-- Prove both rewrites are live, in the same transaction. A replacement that did
-- not land must not report success.
DO $verify$
DECLARE v_bad int := 0;
BEGIN
  SELECT count(*) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'invite_contract_counterparty'
     AND pg_get_functiondef(p.oid) NOT LIKE '%already signed this document as%';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'SENDGUARD: invite_contract_counterparty lacks the signature guard';
  END IF;

  SELECT count(*) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'redeem_contract_invitation'
     AND pg_get_functiondef(p.oid) NOT LIKE '%already_signed%';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'SENDGUARD: redeem_contract_invitation lacks the already-signed route';
  END IF;
END
$verify$;

COMMIT;
