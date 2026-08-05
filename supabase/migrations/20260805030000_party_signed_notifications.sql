/*
  # TASK A16 — admin notified when a party signs

  Characterization (read-only pass, live prosrc): record_signature already
  calls notify_staff once — but only inside the completing-signature branch
  (kind 'document_executed', title '<title> is signed', link
  '/app/ops/documents', no document id). There is NO notification of any kind
  on a partial (non-completing) signature — the tracker's "NOT VERIFIED" was
  correct; the gap is real. remove_my_signature's notify_staff('signature_removed', ...)
  call (uncaught, direct PERFORM) is the shape being mirrored; the
  non-blocking isolation is new precedent, borrowed from
  documents_send_executed_email's BEGIN/EXCEPTION WHEN OTHERS pattern (the
  only existing example of a notification failure being deliberately isolated
  from the write it accompanies).

  This migration adds ONE unified notify_staff call, kind 'party_signed',
  firing after every successful signature write (partial or completing),
  wrapped in BEGIN/EXCEPTION so a notification failure can never roll back or
  block the signature that just sealed. Exclusions per the task spec:
    - company-side signing (staff signing on the company's behalf) does not
      notify — mirrors the v_is_company_signer identification already used
      to resolve v_signer in the pre-existing branch above.
    - the completing signature still notifies, but titled to carry both
      facts ('<title> — fully executed; signed by <name> (<role>)') instead
      of firing a second row alongside a plain "signed" notification.

  Consolidation decision (flagged for the orchestrator in the report): since
  a 'document_executed' staff broadcast already existed for the completing
  case and firing the new call there too would produce two staff rows for
  the same event (the exact thing the spec says to avoid), the old
  notify_staff('document_executed', ...) PERFORM for STAFF is removed and
  folded into the new unified call. The OTHER-PARTIES loop directly above it
  (co-signers, kind 'document_executed', unrelated to A16's staff-facing
  scope) is untouched. Every other line of record_signature's live body is
  carried forward unchanged.
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
  v_is_company_signer boolean := false;
BEGIN
  SELECT org_id INTO v_doc_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_doc_org IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;

  v_signer := current_contact_id();
  IF v_signer IS NULL THEN RAISE EXCEPTION 'no contact for the signing account'; END IF;

  IF NOT EXISTS (SELECT 1 FROM document_parties
                  WHERE document_id = p_document_id AND contact_id = v_signer
                    AND party_role = p_party_role AND is_signer) THEN
    -- COMPANY-SIDE SIGNING (2026-08-03): the org's company contact is a
    -- faceless entity with no linked account (the identity consolidation
    -- moved every staff profile onto a personal TEAM contact), so when the
    -- signing party IS the company contact, a staff member signs on the
    -- company's behalf: the signature is recorded against the company
    -- contact, the acting human is captured in signer_user_id + typed_name.
    -- Mirrors remove_my_signature's existing staff-on-behalf allowance.
    IF has_staff_access() AND EXISTS (
         SELECT 1 FROM document_parties dp
           JOIN contacts cc ON cc.id = dp.contact_id
          WHERE dp.document_id = p_document_id AND dp.party_role = p_party_role
            AND dp.is_signer AND cc.is_company AND cc.org_id = v_doc_org
            AND cc.deleted_at IS NULL) THEN
      SELECT dp.contact_id INTO v_signer
        FROM document_parties dp JOIN contacts cc ON cc.id = dp.contact_id
       WHERE dp.document_id = p_document_id AND dp.party_role = p_party_role
         AND dp.is_signer AND cc.is_company LIMIT 1;
      v_is_company_signer := true;
    ELSE
      RAISE EXCEPTION 'not a signer on this document in role %', p_party_role;
    END IF;
  END IF;

  IF nullif(btrim(coalesce(p_typed_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'a typed name is required to sign';
  END IF;

  v_ip := coalesce(nullif(trim(coalesce(p_ip, '')), ''), v_ip);
  v_ua := coalesce(nullif(trim(coalesce(p_user_agent, '')), ''), v_ua);

  INSERT INTO signatures (org_id, document_id, signer_contact_id, signer_user_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_doc_org, p_document_id, v_signer, coalesce((SELECT pr.user_id FROM profiles pr WHERE pr.contact_id = v_signer LIMIT 1), auth.uid()), p_party_role, p_typed_name, now(), v_ip, v_ua, 'TYPED')
    ON CONFLICT (document_id, signer_contact_id, party_role) DO UPDATE
      SET typed_name = EXCLUDED.typed_name,
          -- the rows pre-seeded at lock time carry NULL signer_user_id; the
          -- sealing update must stamp the signing account or no executed
          -- document ever records WHO signed (found in the 2026-08-03 e2e)
          signer_user_id = EXCLUDED.signer_user_id,
          signed_at  = EXCLUDED.signed_at,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent,
          method     = EXCLUDED.method
      WHERE signatures.signed_at IS NULL;  -- never overwrite an already-sealed signature  -- but a WITHDRAWN one may be given again

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

      -- TASK A16: the old staff-only broadcast here is folded into the
      -- unified party_signed notification below (same event, one row).
    END IF;
  END IF;

  -- TASK A16: admin notified when a (non-company) party signs, every
  -- signature event. Best-effort — isolated the same way
  -- documents_send_executed_email isolates its mail send, so a notification
  -- failure can never block or roll back a signature that already sealed.
  IF NOT v_is_company_signer THEN
    BEGIN
      SELECT coalesce(d.title, 'A document') INTO v_title FROM documents d WHERE d.id = p_document_id;
      IF v_need > 0 AND v_have >= v_need THEN
        PERFORM notify_staff(v_doc_org, 'party_signed',
          v_title || ' — fully executed; signed by ' || p_typed_name || ' (' || p_party_role || ')',
          '/app/ops/documents/' || p_document_id::text);
      ELSE
        PERFORM notify_staff(v_doc_org, 'party_signed',
          v_title || ' — signed by ' || p_typed_name || ' (' || p_party_role || ')',
          '/app/ops/documents/' || p_document_id::text);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'record_signature: party_signed notify_staff failed for document %: %', p_document_id, SQLERRM;
    END;
  END IF;

  SELECT status INTO v_status FROM documents WHERE id = p_document_id;
  RETURN v_status;
END;
$function$;

COMMENT ON FUNCTION public.record_signature(p_document_id uuid, p_party_role text, p_typed_name text, p_ip text, p_user_agent text, p_esign_consent boolean) IS 'Seal a party''s typed signature (TASK A16 = v6 + party_signed staff notification on every signature, non-company signer, best-effort/non-blocking; folds the prior staff-only document_executed broadcast into one row on the completing signature). Everything else preserved verbatim — attribution capture, esign_consents log, execution_hash, SIG-token substitution, the co-signer document_executed notification. Caller must be tenant staff or the party''s own contact; flips EXECUTED once every signer party has signed.';
