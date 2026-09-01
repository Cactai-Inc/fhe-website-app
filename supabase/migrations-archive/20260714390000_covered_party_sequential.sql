/*
  # Lessee as covered party on the horse docs + sequential execution

  Corrections (owner):
  1. The LESSEE is a covered party on the Vet Auth + Care Release during the
     lease term — a NAMED, non-signer party (the OWNER still authorizes/signs and
     makes the euthanasia choice). Being a document party covers them and grants
     read access to the doc; the fuller RECORD is still hidden post-term
     (client_can_read_horse), while the signed docs they're party to remain.
  2. The three documents execute SEQUENTIALLY: lease contract (1) → vet auth (2)
     → care release (3). A doc can't be signed until every doc in the same
     contract with a lower sign_sequence is executed.
*/

ALTER TABLE documents ADD COLUMN IF NOT EXISTS sign_sequence int;

-- ── record_signature: enforce the sequential gate ───────────────────────────
CREATE OR REPLACE FUNCTION public.record_signature(p_document_id uuid, p_party_role text, p_typed_name text, p_ip text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_esign_consent boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_seq     int;
  v_ctr     uuid;
  v_blocking int;
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

  -- SEQUENTIAL EXECUTION: a doc with a sign_sequence can't be signed until every
  -- doc in the same contract with a lower sequence is executed (contract→vet→care).
  SELECT sign_sequence, contract_id INTO v_seq, v_ctr FROM documents WHERE id = p_document_id;
  IF v_seq IS NOT NULL AND v_ctr IS NOT NULL THEN
    SELECT count(*) INTO v_blocking FROM documents
     WHERE contract_id = v_ctr AND deleted_at IS NULL
       AND sign_sequence IS NOT NULL AND sign_sequence < v_seq
       AND status <> 'EXECUTED';
    IF v_blocking > 0 THEN
      RAISE EXCEPTION 'please sign the prior document(s) in this set first';
    END IF;
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
$function$;

-- ── ensure_horse_documents: add the lessee covered party + stamp sign_sequence ─
CREATE OR REPLACE FUNCTION public.ensure_horse_documents(p_horse_id uuid, p_contract_id uuid DEFAULT NULL::uuid, p_include_care boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org       uuid := current_org();
  v_horse     horses%ROWTYPE;
  v_owner     uuid;
  v_contact   uuid := current_contact_id();
  v_templates text[] := ARRAY['HORSE_EMERGENCY_VET'];
  v_tpl       text;
  v_doc       uuid;
  v_voided    int := 0;
  v_rc        int := 0;
  v_gen       jsonb := '[]'::jsonb;
  v_may       boolean;
  v_parties   jsonb;
  v_seq       int;
  v_lessee    uuid;
BEGIN
  SELECT * INTO v_horse FROM horses WHERE id = p_horse_id AND org_id = v_org AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org'; END IF;

  v_may := has_staff_access()
    OR v_horse.current_owner_contact_id = v_contact
    OR v_horse.lessee_contact_id = v_contact
    OR EXISTS (SELECT 1 FROM horse_relationships hr WHERE hr.horse_id = p_horse_id AND hr.party_contact_id = v_contact AND hr.active);
  IF NOT v_may THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;

  v_owner := coalesce(v_horse.current_owner_contact_id, v_contact);
  IF v_owner IS NULL THEN RAISE EXCEPTION 'horse has no owner on record to authorize'; END IF;

  IF p_include_care IS TRUE
     OR (p_include_care IS NULL AND owner_has_executed_template(v_owner, 'RELEASE_HORSE_CARE')) THEN
    v_templates := array_append(v_templates, 'RELEASE_HORSE_CARE');
  END IF;

  -- the covered lessee: the horse's active lessee, else (at lock, before the
  -- lease executes and stamps the horse) the lease contract's LESSEE party.
  v_lessee := v_horse.lessee_contact_id;
  IF v_lessee IS NULL AND p_contract_id IS NOT NULL THEN
    SELECT cp.contact_id INTO v_lessee FROM contract_parties cp
     WHERE cp.contract_id = p_contract_id AND cp.party_role = 'LESSEE' LIMIT 1;
  END IF;

  -- parties: OWNER signs (CLIENT); the lessee is a NAMED, non-signer covered
  -- party (printed + read access, does not sign).
  v_parties := jsonb_build_array(
    jsonb_build_object('contact_id', v_owner, 'role', 'CLIENT', 'is_signer', true, 'signer_order', 1));
  IF v_lessee IS NOT NULL AND v_lessee <> v_owner THEN
    v_parties := v_parties || jsonb_build_object(
      'contact_id', v_lessee, 'role', 'LESSEE', 'is_signer', false, 'signer_order', 2);
  END IF;

  FOREACH v_tpl IN ARRAY v_templates LOOP
    WITH tmpl AS (SELECT id FROM contract_templates WHERE template_key = v_tpl)
    UPDATE documents d
       SET deleted_at = now(), deleted_by = auth.uid()
     WHERE d.contact_id = v_owner
       AND d.template_id = (SELECT id FROM tmpl)
       AND d.deleted_at IS NULL
       AND (d.horse_id IS NULL
            OR (d.horse_id = p_horse_id AND d.merged_body LIKE '%{{HORSE.REGISTERED_NAME}}%'));
    GET DIAGNOSTICS v_rc = ROW_COUNT;
    v_voided := v_voided + v_rc;

    IF EXISTS (
      SELECT 1 FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.contact_id = v_owner AND t.template_key = v_tpl
        AND d.horse_id = p_horse_id AND d.deleted_at IS NULL
        AND d.merged_body NOT LIKE '%{{HORSE.REGISTERED_NAME}}%'
    ) THEN
      CONTINUE;
    END IF;

    SELECT gd.document_id INTO v_doc FROM generate_document(
      v_owner, v_tpl, p_contract_id, p_horse_id, v_parties, 'horse'::text) gd;

    -- sequence only matters within a contract's signing set: vet=2, care=3
    v_seq := CASE WHEN p_contract_id IS NULL THEN NULL
                  WHEN v_tpl = 'HORSE_EMERGENCY_VET' THEN 2
                  WHEN v_tpl = 'RELEASE_HORSE_CARE'  THEN 3 END;
    UPDATE documents SET status = 'AWAITING_SIGNATURE', sign_sequence = v_seq
      WHERE id = v_doc AND status = 'DRAFT';
    v_gen := v_gen || jsonb_build_object('template_key', v_tpl, 'document_id', v_doc);
  END LOOP;

  -- the lease contract signs first
  IF p_contract_id IS NOT NULL THEN
    UPDATE documents d SET sign_sequence = 1
      FROM contract_templates t
     WHERE d.template_id = t.id AND t.template_key = 'HORSE_LEASE'
       AND d.contract_id = p_contract_id AND d.deleted_at IS NULL
       AND d.sign_sequence IS DISTINCT FROM 1;
  END IF;

  RETURN jsonb_build_object('owner_contact_id', v_owner, 'generated', v_gen, 'voided', v_voided);
END;
$function$;

-- ── Bodies: name the covered lessee on the vet auth + care release ────────────
UPDATE contract_templates SET body = replace(
    body, E'HORSE INFORMATION',
    E'HORSE INFORMATION\nCovered party — current Lessee of the Horse during the lease term (if any): {{LESSEE.FULL_NAME}}')
 WHERE template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE')
   AND body LIKE '%HORSE INFORMATION%'
   AND body NOT LIKE '%{{LESSEE.FULL_NAME}}%';

DO $tok$
DECLARE k text;
BEGIN
  FOREACH k IN ARRAY ARRAY['HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE'] LOOP
    DELETE FROM template_tokens WHERE template_id = (SELECT id FROM contract_templates WHERE template_key = k);
    INSERT INTO template_tokens (template_id, namespace, field, token, kind, required, party_scoped)
      SELECT (SELECT id FROM contract_templates WHERE template_key = k),
             split_part(trim(both '{}' from tok), '.', 1),
             substr(trim(both '{}' from tok), position('.' in trim(both '{}' from tok)) + 1),
             tok,
             CASE split_part(trim(both '{}' from tok), '.', 1)
               WHEN 'SIG' THEN 'signature' WHEN 'DOC' THEN 'system' ELSE 'field' END,
             false,
             split_part(trim(both '{}' from tok), '.', 1) IN ('CLIENT','LESSEE','LESSOR','PARTICIPANT','SIG')
        FROM (SELECT DISTINCT unnest(regexp_matches(
                (SELECT body FROM contract_templates WHERE template_key = k),
                '\{\{[A-Z0-9_.]+\}\}', 'g')) AS tok) t;
  END LOOP;
END;
$tok$;
