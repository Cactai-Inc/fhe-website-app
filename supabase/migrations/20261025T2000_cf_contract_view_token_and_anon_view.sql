-- cf (contract-first) STEP 1 + STEP 2 — the VIEW link and the anonymous read-only view.
--
-- STEP 1. When a contract is sent to a party WITH NO ACTIVE ACCOUNT, the email
-- carries a link to VIEW the contract, not an activation link. The link is keyed
-- to a token that stays valid until the governing document executes — not single
-- use, not time bound. An active account holder is sent to the contract as today.
--   -> issue_contract_view_token(document, contact, email): mints/reuses a
--      CONTRACT_VIEW invitation keyed to the document. A distinct kind from the
--      COMMUNITY/CONTRACT activation tokens, so the view token cannot be confused
--      with a claim token and its validity window is its own (enforced below by
--      the view function, not by invitation status).
--
-- STEP 2. One new token-keyed SECURITY DEFINER function returns the rendered body,
-- the document title and the parties' display names, and NOTHING else, and refuses
-- once the GOVERNING document is executed.
--   -> contract_view_by_token(token): anon-callable. Returns merged_body, title,
--      an ordered list of {role, name} party display names, and the HORSE.<SECTION>
--      disclosure structured fields the boxed component renders — never the editable
--      field graph, never account state, never off-instrument PII.
--
-- GOVERNING DOCUMENT (report item 3): for a document on a contract, the sign_sequence
-- = 1 document; for a standalone document, itself. The view dies the moment that
-- governing document's status = 'EXECUTED' — for EVERY token-holder at once.
--
-- ACL DISCIPLINE (memory fhe-revoke-from-public-is-not-enough): grant anon EXPLICITLY
-- and revoke FROM PUBLIC. The function's internal read is narrow — it returns only
-- what the instrument itself prints.

BEGIN;

-- ── a third invitation kind: CONTRACT_VIEW ──────────────────────────────────
-- The view token is a distinct kind so it can never be confused with a COMMUNITY
-- or CONTRACT activation/claim token. Widen the kind check to admit it.
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_kind_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_kind_check
  CHECK (kind = ANY (ARRAY['COMMUNITY'::text, 'CONTRACT'::text, 'CONTRACT_VIEW'::text]));

-- ── STEP 1: issue the view token ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.issue_contract_view_token(
  p_document_id uuid, p_contact_id uuid, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc   documents%ROWTYPE;
  v_email text := lower(btrim(p_email));
  v_inv   invitations%ROWTYPE;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_c     contacts%ROWTYPE;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  -- Same authorization arms as invite_contract_party_account: staff of the
  -- document's org, or a service-role caller (the /api endpoint).
  IF NOT (coalesce(auth.role(), '') = 'service_role'
          OR coalesce(has_staff_access() AND v_doc.org_id = current_org(), false)) THEN
    RAISE EXCEPTION 'not authorized to issue a view link on document %', p_document_id;
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

  -- REUSE a live view token for this document + email in preference to a second.
  -- The view token is NOT time-bound, so expires_at is set far out; the real
  -- lifecycle (valid-until-executed) is enforced by the view function.
  SELECT * INTO v_inv
    FROM invitations
   WHERE org_id = v_doc.org_id
     AND lower(email) = v_email
     AND coalesce(kind, 'COMMUNITY') = 'CONTRACT_VIEW'
     AND document_id = p_document_id
     AND status = 'sent'
     AND deleted_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'invitation_id', v_inv.id, 'token', v_inv.token,
      'document_id', p_document_id, 'reused', true);
  END IF;

  SELECT * INTO v_c FROM contacts WHERE id = p_contact_id;

  INSERT INTO invitations (org_id, email, token, expires_at, status, kind,
                           document_id, contact_id, invited_role, first_name, last_name)
  VALUES (v_doc.org_id, v_email, v_token, now() + interval '100 years',
          'sent', 'CONTRACT_VIEW', p_document_id, p_contact_id, 'USER',
          nullif(btrim(coalesce(v_c.first_name, '')), ''),
          nullif(btrim(coalesce(v_c.last_name, '')), ''))
  RETURNING * INTO v_inv;

  RETURN jsonb_build_object(
    'invitation_id', v_inv.id, 'token', v_inv.token,
    'document_id', p_document_id, 'reused', false);
END;
$function$;

-- ── STEP 2: the anonymous read-only view ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contract_view_by_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc        documents%ROWTYPE;
  v_gov_status text;
  v_parties    jsonb;
  v_disclosure jsonb;
BEGIN
  -- Resolve the token -> its document. Only a live CONTRACT_VIEW token reads;
  -- a token of any other kind returns nothing, so an activation/claim token
  -- cannot be bent into a reader.
  SELECT d.* INTO v_doc
    FROM invitations i
    JOIN documents d ON d.id = i.document_id AND d.deleted_at IS NULL
   WHERE i.token = p_token
     AND coalesce(i.kind, '') = 'CONTRACT_VIEW'
     AND i.deleted_at IS NULL
   ORDER BY i.created_at DESC
   LIMIT 1;

  IF v_doc.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- The GOVERNING document decides the dead-switch (report item 3). On a contract
  -- it is the sign_sequence = 1 document; a standalone document is its own.
  IF v_doc.contract_id IS NOT NULL THEN
    SELECT d2.status INTO v_gov_status
      FROM documents d2
     WHERE d2.contract_id = v_doc.contract_id AND d2.deleted_at IS NULL
       AND d2.sign_sequence = 1
     LIMIT 1;
  END IF;
  v_gov_status := coalesce(v_gov_status, v_doc.status);

  -- Valid until signed: once the governing document executes the link goes dead
  -- for every token-holder at once.
  IF v_gov_status = 'EXECUTED' THEN
    RETURN jsonb_build_object('found', true, 'executed', true);
  END IF;

  -- Parties' display names — the names the instrument prints, nothing more. Taken
  -- from the merged party-name fields, not the contact record, so no off-instrument
  -- PII is reachable through this function.
  SELECT coalesce(jsonb_agg(jsonb_build_object('role', role, 'name', nm)
                            ORDER BY role), '[]'::jsonb)
    INTO v_parties
    FROM (
      SELECT split_part(cf.field_key, '.', 1) AS role, cf.value AS nm
        FROM contract_fields cf
       WHERE cf.document_id = v_doc.id
         AND cf.field_key LIKE '%.FULL_NAME'
         AND coalesce(btrim(cf.value), '') <> ''
    ) p;

  -- The HORSE.<SECTION> disclosure structured values the boxed component renders.
  -- Only the disclosure sections — never the full editable field graph.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
                    'field_key', cf.field_key, 'structured', cf.structured)), '[]'::jsonb)
    INTO v_disclosure
    FROM contract_fields cf
   WHERE cf.document_id = v_doc.id
     AND cf.field_key LIKE 'HORSE.%'
     AND cf.structured IS NOT NULL;

  RETURN jsonb_build_object(
    'found', true,
    'executed', false,
    'document_id', v_doc.id,
    'title', v_doc.title,
    'body', v_doc.merged_body,
    'parties', v_parties,
    'disclosure_fields', v_disclosure);
END;
$function$;

-- ── STEP 1: the VIEW-link email template (owner-editable via the templates editor) ─
-- Parallel to CONTRACT_INVITE, but it describes a link to VIEW the contract, not to
-- activate an account. A no-account party is sent THIS; activation happens only when
-- they choose "Do it now" in the view's modal (STEP 4). Seeded only if absent, so a
-- later owner edit in the app is never clobbered by a re-apply.
INSERT INTO email_templates (email_key, title, category, subject, body,
                             from_address_rule, reply_to_rule, recipient_note, transactional, version, active)
SELECT 'CONTRACT_VIEW_INVITE',
       'Contract — view link (no account yet)',
       'CONTRACT',
       'A contract is ready for you to review — {{ORG.BRAND_NAME}}',
       '<p>Hello,</p><p><strong>{{#if DOC.HAS_TITLE}}{{DOC.TITLE}}{{else}}A contract{{/if}}</strong> has been prepared for you to review.</p><p><a href="{{MSG.LINK}}">Read the contract</a>. You can read it right away — no account needed. When you''re ready to add your information and sign, you''ll be asked to set up an account, and a Gmail address lets you sign in without a password.</p><p style="color:#666;font-size:12px">This link is personal to {{MSG.RECIPIENT_EMAIL}} and stays open until the contract is signed.<br/>{{MSG.LINK}}</p>{{#if ORG.FOOTER}}<hr/><p style="color:#666;font-size:12px;white-space:pre-line">{{ORG.FOOTER}}</p>{{/if}}',
       'tenant', 'none',
       'The counterparty contact on the named party role who has NO active account. A read-only view link, valid until the contract is signed. Activation is offered from the view, on demand.',
       true, 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates WHERE email_key = 'CONTRACT_VIEW_INVITE' AND deleted_at IS NULL);

-- ── ACL: anon reads the view; the issuer is staff/service-role only ─────────
REVOKE ALL ON FUNCTION public.contract_view_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contract_view_by_token(text) TO anon, authenticated, service_role;

-- The issuer is staff/service-role only. Supabase's default privileges auto-grant
-- anon+authenticated EXECUTE to every new public function, and REVOKE FROM PUBLIC
-- does NOT strip a role-specific grant (memory fhe-revoke-from-public-is-not-enough),
-- so anon is revoked EXPLICITLY. The function also guards internally, but the ACL
-- must not advertise a callable it refuses.
REVOKE ALL ON FUNCTION public.issue_contract_view_token(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.issue_contract_view_token(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.issue_contract_view_token(uuid, uuid, text) TO authenticated, service_role;

COMMIT;
