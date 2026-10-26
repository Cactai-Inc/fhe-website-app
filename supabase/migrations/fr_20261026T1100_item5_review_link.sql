-- Fix round 3, item 5 — the read-only contract view becomes a staff share-for-
-- review tool, not an invite path.
--
--  · issue_contract_view_token now accepts ANY email with NO contact (a reviewer
--    who is not a party), in addition to a party contact. p_contact_id may be NULL.
--  · the token stays valid until REVOKED. The execution dead-switch is removed
--    from contract_view_by_token — a link is not killed by the lease executing.
--  · revoke_contract_view_token(invitation) revokes one link (soft-delete it).
--  · contract_view_tokens(document) lists the active review links for a contract:
--    who it was sent to, when, and the token, for the revoke action.
--
-- The view function already returns only the body + boxed disclosures + party
-- display names; nothing about account state is exposed, so a non-party reviewer
-- sees exactly what a party reviewer sees — the instrument, read-only.

BEGIN;

-- ── issue_contract_view_token: non-party email allowed, no dead-switch ───────
CREATE OR REPLACE FUNCTION public.issue_contract_view_token(p_document_id uuid, p_contact_id uuid, p_email text)
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

  -- Staff of the document's org, or a service-role caller (the /api endpoint).
  IF NOT (coalesce(auth.role(), '') = 'service_role'
          OR coalesce(has_staff_access() AND v_doc.org_id = current_org(), false)) THEN
    RAISE EXCEPTION 'not authorized to issue a view link on document %', p_document_id;
  END IF;

  IF v_email IS NULL OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'a valid email is required';
  END IF;

  -- A review link can go to ANY email. When a contact is named it must be one on
  -- this contract (a party's own review copy); when none is named the reviewer is
  -- an outside recipient and no contact is attached.
  IF p_contact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM document_parties
     WHERE document_id = p_document_id AND contact_id = p_contact_id
  ) THEN
    RAISE EXCEPTION 'contact % is not a party on this contract', p_contact_id;
  END IF;

  -- REUSE a live view token for this document + email in preference to a second.
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

  IF p_contact_id IS NOT NULL THEN
    SELECT * INTO v_c FROM contacts WHERE id = p_contact_id;
  END IF;

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

-- ── contract_view_by_token: no execution dead-switch; valid until revoked ────
CREATE OR REPLACE FUNCTION public.contract_view_by_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc        documents%ROWTYPE;
  v_parties    jsonb;
  v_disclosure jsonb;
BEGIN
  -- Only a live CONTRACT_VIEW token reads; a revoked one (deleted_at set) does
  -- not. An activation/claim token of any other kind cannot be bent into a reader.
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

  -- A review link is NOT killed by execution (fix round 3, item 5): a reviewer who
  -- was sent the link to read the contract can still read it after it executes.
  -- The link dies only when revoked (the token row soft-deleted), handled above.

  -- Parties' display names — the names the instrument prints, nothing more.
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
  SELECT coalesce(jsonb_agg(jsonb_build_object(
                    'field_key', cf.field_key, 'structured', cf.structured)), '[]'::jsonb)
    INTO v_disclosure
    FROM contract_fields cf
   WHERE cf.document_id = v_doc.id
     AND cf.field_key LIKE 'HORSE.%'
     AND cf.structured IS NOT NULL;

  RETURN jsonb_build_object(
    'found', true,
    'executed', (v_doc.status = 'EXECUTED'),
    'document_id', v_doc.id,
    'title', v_doc.title,
    'body', v_doc.merged_body,
    'parties', v_parties,
    'disclosure_fields', v_disclosure);
END;
$function$;

-- ── revoke_contract_view_token: kill one review link ─────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_contract_view_token(p_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id INTO v_org FROM invitations
   WHERE id = p_invitation_id AND coalesce(kind,'') = 'CONTRACT_VIEW' AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'review link not found'; END IF;
  IF NOT coalesce(has_staff_access() AND v_org = current_org(), false) THEN
    RAISE EXCEPTION 'not authorized to revoke this review link';
  END IF;
  UPDATE invitations SET status = 'revoked', deleted_at = now()
   WHERE id = p_invitation_id;
  RETURN jsonb_build_object('revoked', true, 'invitation_id', p_invitation_id);
END;
$function$;

-- ── contract_view_tokens: the active review links for a contract ─────────────
CREATE OR REPLACE FUNCTION public.contract_view_tokens(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT coalesce(has_staff_access() AND v_org = current_org(), false) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'invitation_id', i.id,
             'email', i.email,
             'sent_at', i.created_at,
             'token', i.token)
           ORDER BY i.created_at DESC)
      FROM invitations i
     WHERE i.document_id = p_document_id
       AND coalesce(i.kind,'') = 'CONTRACT_VIEW'
       AND i.status = 'sent'
       AND i.deleted_at IS NULL), '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.revoke_contract_view_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contract_view_tokens(uuid) TO authenticated;

COMMIT;
