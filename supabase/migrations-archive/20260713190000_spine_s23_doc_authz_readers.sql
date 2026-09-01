/*
  # Spine Refactor — Slice 2.3 (step 1): doc authz/signing readers -> document_parties

  Repoint the document authorization + signing readers from the engagement join
  (documents.engagement_id -> engagement_parties) onto document_parties (keyed by
  document_id). Behavior-preserving: document_parties already holds the same
  parties for every document (backfilled in S2.1b + seeded by v11 for new docs).
  Additive and safe to ship on its own — it does not yet drop engagement_id; that
  drops once ALL readers + the initiation points are repointed (later in S2.3).
*/

-- is the caller a party on THIS document (any role)?
CREATE OR REPLACE FUNCTION caller_is_document_party(p_document_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT current_contact_id() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM documents d
    JOIN document_parties dp ON dp.document_id = d.id
    WHERE d.id = p_document_id
      AND d.deleted_at IS NULL
      AND dp.contact_id = current_contact_id()
  );
$$;

-- the caller's party_role(s) on this document
CREATE OR REPLACE FUNCTION caller_party_roles(p_document_id uuid)
RETURNS SETOF text LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT dp.party_role
  FROM documents d
  JOIN document_parties dp ON dp.document_id = d.id
  WHERE d.id = p_document_id
    AND d.deleted_at IS NULL
    AND current_contact_id() IS NOT NULL
    AND dp.contact_id = current_contact_id();
$$;

-- record_signature: seal a party's typed signature. v6 body, with the two
-- engagement_parties lookups (signer + signer-count) repointed to document_parties.
CREATE OR REPLACE FUNCTION record_signature(
  p_document_id   uuid,
  p_party_role    text,
  p_typed_name    text,
  p_ip            text    DEFAULT NULL,
  p_user_agent    text    DEFAULT NULL,
  p_esign_consent boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_doc_org uuid;
  v_signer  uuid;
  v_need    integer;
  v_have    integer;
  v_status  text;
  v_user    uuid;
  v_title   text;
  v_ip      text;
  v_ua      text;
  v_body    text;
  v_sig     record;
  v_hash    text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id INTO v_doc_org
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  -- the contact who plays this party_role on the document
  SELECT contact_id INTO v_signer FROM document_parties
    WHERE document_id = p_document_id AND party_role = p_party_role
    ORDER BY signer_order NULLS LAST LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no % party on this document', p_party_role;
  END IF;

  IF NOT (
       (has_staff_access() AND v_doc_org = current_org())
    OR (current_contact_id() IS NOT NULL AND current_contact_id() = v_signer)
  ) THEN
    RAISE EXCEPTION 'not authorized to sign as % on document %', p_party_role, p_document_id;
  END IF;

  SELECT a.ip, a.user_agent INTO v_ip, v_ua FROM http_request_attribution() a;
  v_ip := coalesce(nullif(trim(coalesce(p_ip, '')), ''), v_ip);
  v_ua := coalesce(nullif(trim(coalesce(p_user_agent, '')), ''), v_ua);

  INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_doc_org, p_document_id, v_signer, p_party_role, p_typed_name, now(), v_ip, v_ua, 'TYPED')
    ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;

  IF coalesce(p_esign_consent, false) THEN
    INSERT INTO esign_consents (org_id, contact_id, document_id, ip_address, user_agent)
      VALUES (v_doc_org, v_signer, p_document_id, v_ip, v_ua);
  END IF;

  UPDATE documents SET merged_body =
      replace(replace(merged_body,
        '{{SIG.' || p_party_role || '.NAME}}', p_typed_name),
        '{{SIG.' || p_party_role || '.DATE}}', to_char(now(), 'FMMonth FMDD, YYYY'))
    WHERE id = p_document_id AND merged_body IS NOT NULL;

  -- executed once every signer party has signed
  SELECT count(*) FILTER (WHERE is_signer) INTO v_need
    FROM document_parties WHERE document_id = p_document_id;
  SELECT count(*) INTO v_have
    FROM signatures WHERE document_id = p_document_id AND signed_at IS NOT NULL AND deleted_at IS NULL;

  IF v_need > 0 AND v_have >= v_need THEN
    SELECT merged_body INTO v_body FROM documents WHERE id = p_document_id;
    SELECT signer_contact_id, typed_name, signed_at INTO v_sig
      FROM signatures
      WHERE document_id = p_document_id AND signer_contact_id = v_signer
        AND party_role = p_party_role AND deleted_at IS NULL;
    IF FOUND THEN
      v_hash := compute_execution_hash(v_body, v_sig.signer_contact_id, v_sig.typed_name, v_sig.signed_at);
    END IF;

    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date,
                         execution_hash = v_hash, workflow_state = 'executed'
      WHERE id = p_document_id AND status <> 'EXECUTED';

    IF FOUND THEN
      SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = v_signer;
      IF v_user IS NOT NULL THEN
        SELECT coalesce(d.title, 'Your document') INTO v_title
          FROM documents d WHERE d.id = p_document_id;
        INSERT INTO notifications (org_id, user_id, kind, title, link)
          VALUES (v_doc_org, v_user, 'document_executed', v_title || ' is signed', '/app/documents');
      END IF;
    END IF;
  END IF;

  SELECT status INTO v_status FROM documents WHERE id = p_document_id;
  RETURN v_status;
END;
$fn$;

-- my_contract_documents: the caller's contract documents (party + has contract_fields)
CREATE OR REPLACE FUNCTION my_contract_documents()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $fn$
DECLARE
  v_me uuid := current_contact_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF v_me IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.generated_at DESC)
    FROM (
      SELECT DISTINCT
        d.id AS document_id, d.title, d.status, d.workflow_state,
        d.recipient_editing, d.execution_hash, d.generated_at,
        (d.originator_contact_id = v_me) AS is_originator,
        (SELECT string_agg(dp.party_role, ',' ORDER BY dp.party_role)
           FROM document_parties dp
           WHERE dp.document_id = d.id AND dp.contact_id = v_me) AS my_roles,
        (SELECT count(*) FROM document_change_requests cr
           WHERE cr.document_id = d.id AND cr.status = 'open') AS open_change_requests
      FROM documents d
      JOIN document_parties dp2 ON dp2.document_id = d.id
      WHERE d.deleted_at IS NULL
        AND dp2.contact_id = v_me
        AND EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
    ) t
  ), '[]'::jsonb);
END;
$fn$;
