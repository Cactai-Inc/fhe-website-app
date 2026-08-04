-- record_signature: staff may sign for the COMPANY party (2026-08-03).
-- Production defect found in the signing-lifecycle e2e: after the identity
-- consolidation repointed every staff profile onto a personal TEAM contact,
-- no account maps to the org's company contact — so no one could sign the
-- company side of any contract (the July lease was signed before the
-- repoint). Full body carried forward from live otherwise unchanged.
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

      PERFORM notify_staff(v_doc_org, 'document_executed',
        v_title || ' is signed', '/app/ops/documents');
    END IF;
  END IF;

  SELECT status INTO v_status FROM documents WHERE id = p_document_id;
  RETURN v_status;
END;
$function$

;

-- remove_my_signature: withdrawal regresses an EXECUTED instrument and
-- notifies the staff inbox when the counterparty is the company contact.
CREATE OR REPLACE FUNCTION public.remove_my_signature(p_document_id uuid, p_contact_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me     uuid := current_contact_id();
  v_target uuid;
  v_org    uuid;
  v_title  text;
  v_roles  text[];
  v_n      int := 0;
  s        record;
  r        record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, coalesce(title, 'A document') INTO v_org, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;

  -- staff may remove on a party's behalf (they sign from the barn office);
  -- everyone else may only remove their own.
  v_target := coalesce(p_contact_id, v_me);
  IF v_target IS DISTINCT FROM v_me AND NOT has_staff_access() THEN
    RAISE EXCEPTION 'you can only remove your own signature';
  END IF;

  v_roles := ARRAY[]::text[];

  FOR s IN
    SELECT * FROM signatures
     WHERE document_id = p_document_id AND signer_contact_id = v_target
       AND signed_at IS NOT NULL AND deleted_at IS NULL
  LOOP
    -- 1. ARCHIVE the attested state. This is the evidence, and it is permanent.
    INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value, ip, user_agent)
    VALUES (auth.uid(), 'DELETE', 'signatures', s.id,
            jsonb_build_object(
              'reason', 'signature_withdrawn_by_party',
              'document_id', s.document_id,
              'signer_contact_id', s.signer_contact_id,
              'party_role', s.party_role,
              'typed_name', s.typed_name,
              'signed_at', s.signed_at,
              'method', s.method),
            jsonb_build_object('withdrawn_at', now(), 'withdrawn_by_contact_id', v_me),
            s.ip_address, s.user_agent);

    -- 2. FREE the slot. The unique key spans soft-deleted rows, so the row must
    --    go for the party to be able to sign again. Its content now lives in
    --    audit_logs, and the withdrawal is logged on the document below.
    DELETE FROM signatures WHERE id = s.id;

    v_roles := v_roles || s.party_role;
    v_n := v_n + 1;
  END LOOP;

  IF v_n = 0 THEN
    RETURN jsonb_build_object('removed', 0, 'message', 'no standing signature to remove');
  END IF;

  -- 3. REISSUE a pending row per role, so the signing surface has something to
  --    render and the party can sign again once they have reviewed the changes.
  INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, method)
  SELECT v_org, p_document_id, v_target, role_key, 'TYPED'
    FROM unnest(v_roles) AS role_key
  ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;

  UPDATE documents
     SET signatures_voided_at = now(),
         signatures_voided_roles = coalesce(signatures_voided_roles, '{}') || v_roles,
         -- A withdrawn signature REGRESSES the instrument: an EXECUTED document
         -- with a missing signature is a false state (2026-08-03 e2e finding —
         -- the old CASE kept EXECUTED as-is, so a fully-executed lease still
         -- read as executed after a party withdrew).
         status = 'AWAITING_SIGNATURE',
         -- locked or executed, the document returns to editable — withdrawing
         -- in order to edit is the entire point of L9's withdraw path
         workflow_state = CASE WHEN workflow_state IN ('locked','executed') THEN 'editable' ELSE workflow_state END
   WHERE id = p_document_id;

  PERFORM log_contract_change(p_document_id, 'signature_removed', NULL,
                              'Signature removed', NULL, NULL, NULL,
                              jsonb_build_object('roles', to_jsonb(v_roles),
                                                 'by_contact_id', v_me));

  FOR r IN
    SELECT DISTINCT pr.user_id FROM document_parties dp
      JOIN profiles pr ON pr.contact_id = dp.contact_id
     WHERE dp.document_id = p_document_id AND dp.contact_id <> v_target
       AND pr.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_org, r.user_id, 'signature_removed',
              v_title || ' — a signature was removed, so it can be edited again',
              '/app/contracts/' || p_document_id::text);
  END LOOP;
  -- The company party has no linked account by design — its withdrawal
  -- notice goes to the staff inbox instead (2026-08-03 e2e finding: a
  -- lessee's withdrawal on a company-side lease notified no one).
  IF EXISTS (SELECT 1 FROM document_parties dp JOIN contacts cc ON cc.id = dp.contact_id
              WHERE dp.document_id = p_document_id AND dp.contact_id <> v_target AND cc.is_company)
  THEN
    PERFORM notify_staff(v_org, 'signature_removed',
              v_title || ' — a signature was removed, so it can be edited again',
              '/app/ops/documents/' || p_document_id::text);
  END IF;

  RETURN jsonb_build_object('removed', v_n, 'roles', to_jsonb(v_roles));
END;
$function$

;

-- Withdrawal anchor: staff-on-behalf withdrawals logged only the ACTOR's
-- contact, so changes-since-signature lost its anchor for the withdrawn
-- party. Log the target too; anchor on it with a fallback for old rows.
CREATE OR REPLACE FUNCTION public.remove_my_signature(p_document_id uuid, p_contact_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me     uuid := current_contact_id();
  v_target uuid;
  v_org    uuid;
  v_title  text;
  v_roles  text[];
  v_n      int := 0;
  s        record;
  r        record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, coalesce(title, 'A document') INTO v_org, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;

  -- staff may remove on a party's behalf (they sign from the barn office);
  -- everyone else may only remove their own.
  v_target := coalesce(p_contact_id, v_me);
  IF v_target IS DISTINCT FROM v_me AND NOT has_staff_access() THEN
    RAISE EXCEPTION 'you can only remove your own signature';
  END IF;

  v_roles := ARRAY[]::text[];

  FOR s IN
    SELECT * FROM signatures
     WHERE document_id = p_document_id AND signer_contact_id = v_target
       AND signed_at IS NOT NULL AND deleted_at IS NULL
  LOOP
    -- 1. ARCHIVE the attested state. This is the evidence, and it is permanent.
    INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value, ip, user_agent)
    VALUES (auth.uid(), 'DELETE', 'signatures', s.id,
            jsonb_build_object(
              'reason', 'signature_withdrawn_by_party',
              'document_id', s.document_id,
              'signer_contact_id', s.signer_contact_id,
              'party_role', s.party_role,
              'typed_name', s.typed_name,
              'signed_at', s.signed_at,
              'method', s.method),
            jsonb_build_object('withdrawn_at', now(), 'withdrawn_by_contact_id', v_me),
            s.ip_address, s.user_agent);

    -- 2. FREE the slot. The unique key spans soft-deleted rows, so the row must
    --    go for the party to be able to sign again. Its content now lives in
    --    audit_logs, and the withdrawal is logged on the document below.
    DELETE FROM signatures WHERE id = s.id;

    v_roles := v_roles || s.party_role;
    v_n := v_n + 1;
  END LOOP;

  IF v_n = 0 THEN
    RETURN jsonb_build_object('removed', 0, 'message', 'no standing signature to remove');
  END IF;

  -- 3. REISSUE a pending row per role, so the signing surface has something to
  --    render and the party can sign again once they have reviewed the changes.
  INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, method)
  SELECT v_org, p_document_id, v_target, role_key, 'TYPED'
    FROM unnest(v_roles) AS role_key
  ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;

  UPDATE documents
     SET signatures_voided_at = now(),
         signatures_voided_roles = coalesce(signatures_voided_roles, '{}') || v_roles,
         -- A withdrawn signature REGRESSES the instrument: an EXECUTED document
         -- with a missing signature is a false state (2026-08-03 e2e finding —
         -- the old CASE kept EXECUTED as-is, so a fully-executed lease still
         -- read as executed after a party withdrew).
         status = 'AWAITING_SIGNATURE',
         -- locked or executed, the document returns to editable — withdrawing
         -- in order to edit is the entire point of L9's withdraw path
         workflow_state = CASE WHEN workflow_state IN ('locked','executed') THEN 'editable' ELSE workflow_state END
   WHERE id = p_document_id;

  PERFORM log_contract_change(p_document_id, 'signature_removed', NULL,
                              'Signature removed', NULL, NULL, NULL,
                              jsonb_build_object('roles', to_jsonb(v_roles),
                                                 'by_contact_id', v_me,
                                                 -- the WITHDRAWN party — the anchor
                                                 -- document_changes_since_signature needs
                                                 -- when staff withdraw on a party's behalf
                                                 'for_contact_id', v_target));

  FOR r IN
    SELECT DISTINCT pr.user_id FROM document_parties dp
      JOIN profiles pr ON pr.contact_id = dp.contact_id
     WHERE dp.document_id = p_document_id AND dp.contact_id <> v_target
       AND pr.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_org, r.user_id, 'signature_removed',
              v_title || ' — a signature was removed, so it can be edited again',
              '/app/contracts/' || p_document_id::text);
  END LOOP;
  -- The company party has no linked account by design — its withdrawal
  -- notice goes to the staff inbox instead (2026-08-03 e2e finding: a
  -- lessee's withdrawal on a company-side lease notified no one).
  IF EXISTS (SELECT 1 FROM document_parties dp JOIN contacts cc ON cc.id = dp.contact_id
              WHERE dp.document_id = p_document_id AND dp.contact_id <> v_target AND cc.is_company)
  THEN
    PERFORM notify_staff(v_org, 'signature_removed',
              v_title || ' — a signature was removed, so it can be edited again',
              '/app/ops/documents/' || p_document_id::text);
  END IF;

  RETURN jsonb_build_object('removed', v_n, 'roles', to_jsonb(v_roles));
END;
$function$

;

CREATE OR REPLACE FUNCTION public.document_changes_since_signature(p_document_id uuid, p_contact_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_target uuid := coalesce(p_contact_id, current_contact_id());
  v_since  timestamptz;
BEGIN
  -- when this party's signature last came off (the withdrawal event), else when
  -- they last signed. Nothing before that is "new" to them.
  SELECT max(l.created_at) INTO v_since
    FROM contract_change_log l
   WHERE l.document_id = p_document_id
     AND l.change_kind = 'signature_removed'
     AND coalesce((l.detail ->> 'for_contact_id')::uuid,
                  (l.detail ->> 'by_contact_id')::uuid) = v_target;

  IF v_since IS NULL THEN
    SELECT max(signed_at) INTO v_since
      FROM signatures
     WHERE document_id = p_document_id AND signer_contact_id = v_target;
  END IF;
  IF v_since IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', l.id,
             'change_kind', l.change_kind,
             'field_key', l.field_key,
             'field_label', l.field_label,
             'old_value', l.old_value,
             'new_value', l.new_value,
             'actor', l.actor_label,
             'at', l.created_at)
           ORDER BY l.created_at)
      FROM contract_change_log l
     WHERE l.document_id = p_document_id
       AND l.created_at > v_since
       AND l.change_kind = 'field_value'), '[]'::jsonb);
END;
$function$

;
