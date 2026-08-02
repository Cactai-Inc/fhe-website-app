/*
  # record_signature — co-buyer signature tokens substitute the COBUYER namespace

  The co-buyer is a SECOND document party with party_role BUYER (next
  signer_order), but the co-buyer signature block renders {{SIG.COBUYER.NAME}} /
  {{SIG.COBUYER.DATE}}. record_signature substituted only SIG.<party_role>.*, so
  a co-buyer's signature left its tokens literal in the executed body (found by
  the sale-build 6.3a live e2e). Fix: resolve the signer's token NAMESPACE —
  the second-and-later BUYER contact (by signer_order) substitutes SIG.COBUYER.*.

  Full replace of the live body; the only change is the v_ns resolution and its
  use in the merged_body substitution.
*/

CREATE OR REPLACE FUNCTION public.record_signature(p_document_id uuid, p_party_role text, p_typed_name text, p_ip text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_esign_consent boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_org uuid; v_signer uuid; v_need int; v_have int; v_status text;
  v_body text; v_hash text; v_sig record; v_user uuid; v_title text;
  v_ip text; v_ua text; r record;
  v_ns text;
BEGIN
  SELECT org_id INTO v_doc_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_doc_org IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;

  v_signer := current_contact_id();
  IF v_signer IS NULL THEN RAISE EXCEPTION 'no contact for the signing account'; END IF;

  IF NOT EXISTS (SELECT 1 FROM document_parties
                  WHERE document_id = p_document_id AND contact_id = v_signer
                    AND party_role = p_party_role AND is_signer) THEN
    RAISE EXCEPTION 'not a signer on this document in role %', p_party_role;
  END IF;

  IF nullif(btrim(coalesce(p_typed_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'a typed name is required to sign';
  END IF;

  v_ip := coalesce(nullif(trim(coalesce(p_ip, '')), ''), v_ip);
  v_ua := coalesce(nullif(trim(coalesce(p_user_agent, '')), ''), v_ua);

  INSERT INTO signatures (org_id, document_id, signer_contact_id, signer_user_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_doc_org, p_document_id, v_signer, (SELECT pr.user_id FROM profiles pr WHERE pr.contact_id = v_signer LIMIT 1), p_party_role, p_typed_name, now(), v_ip, v_ua, 'TYPED')
    ON CONFLICT (document_id, signer_contact_id, party_role) DO UPDATE
      SET typed_name = EXCLUDED.typed_name,
          signed_at  = EXCLUDED.signed_at,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent,
          method     = EXCLUDED.method
      WHERE signatures.signed_at IS NULL;  -- never overwrite an already-sealed signature

  IF coalesce(p_esign_consent, false) THEN
    INSERT INTO esign_consents (org_id, contact_id, document_id, ip_address, user_agent)
      VALUES (v_doc_org, v_signer, p_document_id, v_ip, v_ua);
  END IF;

  -- the signer's TOKEN namespace: a second (or later) same-role BUYER contact is
  -- the co-buyer and substitutes SIG.COBUYER.* (the block its clause renders)
  v_ns := p_party_role;
  IF p_party_role = 'BUYER' THEN
    SELECT CASE WHEN t.rn > 1 THEN 'COBUYER' ELSE 'BUYER' END INTO v_ns
      FROM (SELECT dp.contact_id,
                   row_number() OVER (ORDER BY dp.signer_order NULLS LAST, dp.id) AS rn
              FROM document_parties dp
             WHERE dp.document_id = p_document_id AND dp.party_role = 'BUYER') t
     WHERE t.contact_id = v_signer;
    v_ns := coalesce(v_ns, p_party_role);
  END IF;

  UPDATE documents SET merged_body =
      replace(replace(merged_body,
        '{{SIG.' || v_ns || '.NAME}}', p_typed_name),
        '{{SIG.' || v_ns || '.DATE}}', to_char(now(), 'FMMonth FMDD, YYYY'))
    WHERE id = p_document_id AND merged_body IS NOT NULL;

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
      -- the contract is signed: its per-party "ready to sign / in review" alerts
      -- (link /app/contracts/<id>) are no longer valid for anyone — clear all.
      PERFORM resolve_notifications_for_link('/app/contracts/' || p_document_id::text, auth.uid());

      SELECT coalesce(d.title, 'Your document') INTO v_title
        FROM documents d WHERE d.id = p_document_id;

      -- ITEM 5c: notify the OTHER parties, never the signer whose own action
      -- completed execution. Telling someone their own click succeeded is
      -- residue, and it arrived in the same breath as the resolve above.
      FOR r IN
        SELECT DISTINCT pr.user_id
          FROM document_parties dp
          JOIN profiles pr ON pr.contact_id = dp.contact_id
         WHERE dp.document_id = p_document_id
           AND dp.contact_id <> v_signer
           AND pr.user_id IS NOT NULL
      LOOP
        INSERT INTO notifications (org_id, user_id, kind, title, link)
          VALUES (v_doc_org, r.user_id, 'document_executed', v_title || ' is signed', '/app/documents');
      END LOOP;

      PERFORM notify_staff(v_doc_org, 'document_executed',
        v_title || ' is signed', '/app/ops/documents');
    END IF;
  END IF;

  SELECT status INTO v_status FROM documents WHERE id = p_document_id;
  RETURN v_status;
END;
$function$;
