/*
  # FHE Suite — record_signature caller verification (client self-signing)

  SECURITY FIX. Migration 23's record_signature (left untouched by 34 and 42) is
  SECURITY DEFINER with only an `auth.uid() IS NOT NULL` gate: ANY authenticated
  user who learned a document id could sign as ANY party on ANY tenant's
  document, sealing a forged signature and (once every signer "signed") flipping
  the document EXECUTED. This re-issues the function — signature and every other
  line UNCHANGED from 20260629160000 — adding the missing authorization between
  party resolution and the signature insert:

    - TENANT STAFF may facilitate any party's signature (the assisted-signing
      flow, OPS-DOC-SIGN): has_staff_access() (ADMIN / MANAGER / EMPLOYEE,
      20260629180000) AND the caller's org (current_org(), 20260629190000)
      matches the document's org — staff of one tenant cannot sign another
      tenant's documents through this SECURITY DEFINER path.
    - OTHERWISE the caller must BE the party: auth.uid() → profiles.contact_id
      (current_contact_id(), 20260629010000) must equal the resolved party row's
      contact_id. This is what lets a portal member self-sign a document where
      THEY are a party — and nobody else's.

  No table, policy, or client-code change; the RPC remains the single signing
  entry point.
*/

CREATE OR REPLACE FUNCTION record_signature(
  p_document_id uuid,
  p_party_role  text,
  p_typed_name  text,
  p_ip          text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_eng_id  uuid;
  v_doc_org uuid;
  v_signer  uuid;
  v_need    integer;
  v_have    integer;
  v_status  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT engagement_id, org_id INTO v_eng_id, v_doc_org
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  -- the contact who plays this party_role on the document's engagement
  SELECT contact_id INTO v_signer FROM engagement_parties
    WHERE engagement_id = v_eng_id AND party_role = p_party_role
    ORDER BY signer_order NULLS LAST LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no % party on this document''s engagement', p_party_role;
  END IF;

  -- AUTHORIZATION: tenant staff facilitate any party; anyone else must BE the
  -- party (their profile's contact is the party row's contact).
  IF NOT (
       (has_staff_access() AND v_doc_org = current_org())
    OR (current_contact_id() IS NOT NULL AND current_contact_id() = v_signer)
  ) THEN
    RAISE EXCEPTION 'not authorized to sign as % on document %', p_party_role, p_document_id;
  END IF;

  -- one sealed signature per (document, signer, role); ignore a duplicate sign
  INSERT INTO signatures (document_id, signer_contact_id, party_role, typed_name, signed_at, ip_address, method)
    VALUES (p_document_id, v_signer, p_party_role, p_typed_name, now(), p_ip, 'TYPED')
    ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;

  -- executed once every signer party has signed
  SELECT count(*) FILTER (WHERE is_signer) INTO v_need
    FROM engagement_parties WHERE engagement_id = v_eng_id;
  SELECT count(*) INTO v_have
    FROM signatures WHERE document_id = p_document_id AND signed_at IS NOT NULL AND deleted_at IS NULL;

  IF v_need > 0 AND v_have >= v_need THEN
    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date
      WHERE id = p_document_id AND status <> 'EXECUTED';
  END IF;

  SELECT status INTO v_status FROM documents WHERE id = p_document_id;
  RETURN v_status;
END;
$fn$;

COMMENT ON FUNCTION record_signature(uuid, text, text, text) IS
  'Seal a party''s typed signature. Caller must be tenant staff (same org as the document) or the party''s own contact (profiles.contact_id = engagement_parties.contact_id); flips the document EXECUTED once every signer party has signed.';
