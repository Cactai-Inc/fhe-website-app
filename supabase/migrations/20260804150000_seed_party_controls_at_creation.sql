-- TASK PARTYCTRL: seed document_party_controls at contract creation.
--
-- No contract starter ever wrote document_party_controls. The admin
-- "Document controls" panel derives its role list FROM party_controls
-- (ContractPage.tsx:1444-1449), and invitableRoles (gating the Send button)
-- derives from the same rows. A freshly authored contract therefore has zero
-- controls rows, the panel renders nothing, and there is no UI path to
-- create the first row -- the contract can never be configured or sent.
--
-- Fix: each starter seeds one document_party_controls row per party role it
-- actually created (read back from document_parties, which generate_document
-- populates), immediately after the document shell exists. Defaults use the
-- UI panel's own fallback for a role with no row yet (ContractPage.tsx:1449:
-- can_fill true, can_edit_deal/can_suggest/can_add_clause false) rather than
-- the executed reference document's rows (ecaecd42-0d82-428b-b72f-b73b0cc3f9f3:
-- LESSOR can_edit_deal=t/can_suggest=f, LESSEE can_edit_deal=f/can_suggest=t),
-- because that asymmetry (LESSOR carries deal-editing authority, LESSEE only
-- suggests) reads as lease-specific business logic, not a generic contract
-- posture -- it doesn't obviously map onto BUYER/SELLER or arbitrary deal
-- templates, and the task spec calls for the UI default in exactly this case.
-- FHE/COMPANY are excluded from seeding, matching both the panel's own filter
-- and set_party_controls' treatment of them as non-counterparty roles.
--
-- Function bodies are otherwise carried forward unchanged from live prosrc
-- (verified against the database before editing); only the seed INSERT is
-- new, placed right after the generate_document() call in each.

CREATE OR REPLACE FUNCTION public.start_lease_contract_v2(p_lessee_contact_id uuid, p_lessor_contact_id uuid DEFAULT NULL::uuid, p_horse_id uuid DEFAULT NULL::uuid, p_responsible_role text DEFAULT 'LESSEE'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract   uuid;
  v_org        uuid;
  v_doc        uuid;
  v_tmpl       uuid;
  v_originator uuid;
  v_n          int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to start a lease contract'; END IF;
  IF p_lessee_contact_id IS NULL THEN RAISE EXCEPTION 'a lessee contact is required'; END IF;

  v_originator := current_contact_id();  -- H1: the company (staff caller) is always the author

  SELECT org_id INTO v_org FROM contacts WHERE id = p_lessee_contact_id;
  SELECT id INTO v_tmpl FROM contract_templates WHERE template_key = 'HORSE_LEASE_V2';
  IF v_tmpl IS NULL THEN RAISE EXCEPTION 'HORSE_LEASE_V2 template missing'; END IF;

  -- contract + parties (spine model)
  INSERT INTO contracts (org_id, segment, status, horse_id, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', p_horse_id, v_originator, jsonb_build_object('deal_side','LEASE_IN'))
    RETURNING id INTO v_contract;
  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_contract, p_lessee_contact_id, 'LESSEE', true, 1);
  IF p_lessor_contact_id IS NOT NULL THEN
    INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_contract, p_lessor_contact_id, 'LESSOR', true, 2);
  END IF;

  -- document shell (same generator the engine uses; body recomposed below)
  SELECT gd.document_id INTO v_doc FROM generate_document(
    p_lessee_contact_id, 'HORSE_LEASE_V2', v_contract, p_horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,'is_signer',cp.is_signer,'signer_order',cp.signer_order))
       FROM contract_parties cp WHERE cp.contract_id = v_contract),
    NULL::text) gd;

  -- PARTYCTRL: seed default party controls for every role this document
  -- carries, so the admin panel has rows to render from creation onward.
  INSERT INTO document_party_controls (document_id, party_role, can_fill, can_edit_deal, can_suggest, can_add_clause, org_id)
  SELECT DISTINCT v_doc, dp.party_role, true, false, false, false, v_org
    FROM document_parties dp
   WHERE dp.document_id = v_doc AND dp.party_role NOT IN ('FHE','COMPANY')
  ON CONFLICT (document_id, party_role) DO NOTHING;

  UPDATE documents SET originator_contact_id = v_originator,
                       workflow_state = 'editable', status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

  -- seed fields straight from the clause-model defs (clause_key + responsibility_kind carried)
  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, clause_key, owner_role,
    value_type, input_kind, format_type, options, conditional_on, closed, guidance,
    required, is_optional, responsibility, sort_order, parent_field_key,
    responsibility_kind)
  SELECT v_org, v_doc, d.field_key, d.label, d.section, d.clause_key, d.owner_role,
         d.value_type, nullif(d.input_kind,''), d.format_type, d.options, d.conditional_on, d.closed, d.guidance,
         d.required, d.is_optional, d.responsibility, d.sort_order, d.parent_field_key,
         d.responsibility_kind
    FROM contract_field_defs d
   WHERE d.template_key = 'HORSE_LEASE_V2';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- fill horse + party identity fields from records (reuse verified paths)
  IF p_horse_id IS NOT NULL THEN
    PERFORM attach_horse_to_document(v_doc, p_horse_id);
  END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);

  -- compose the numbered clause body
  PERFORM remerge_contract_from_clauses(v_doc);

  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract, 'fields_seeded', v_n);
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_sale_contract(p_buyer_contact_id uuid, p_seller_contact_id uuid DEFAULT NULL::uuid, p_horse_id uuid DEFAULT NULL::uuid, p_amount numeric DEFAULT NULL::numeric, p_deposit numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract   uuid;
  v_org        uuid;
  v_doc        uuid;
  v_tmpl       uuid;
  v_originator uuid;
  v_n          int;
  v_horse      horses%ROWTYPE;
  v_lessee_nm  text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to start a sale contract'; END IF;
  IF p_buyer_contact_id IS NULL THEN RAISE EXCEPTION 'a buyer contact is required'; END IF;

  v_originator := current_contact_id();  -- H1: the company (staff caller) is always the author

  SELECT org_id INTO v_org FROM contacts WHERE id = p_buyer_contact_id;
  SELECT id INTO v_tmpl FROM contract_templates WHERE template_key = 'HORSE_SALE_V2';
  IF v_tmpl IS NULL THEN RAISE EXCEPTION 'HORSE_SALE_V2 template missing'; END IF;

  -- contract + parties (spine model)
  INSERT INTO contracts (org_id, segment, status, horse_id, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', p_horse_id, v_originator, jsonb_build_object('deal_side','SALE'))
    RETURNING id INTO v_contract;
  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_contract, p_buyer_contact_id, 'BUYER', true, 1);
  IF p_seller_contact_id IS NOT NULL THEN
    INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_contract, p_seller_contact_id, 'SELLER', true, 2);
  END IF;

  -- document shell (same generator the engine uses; body recomposed below)
  SELECT gd.document_id INTO v_doc FROM generate_document(
    p_buyer_contact_id, 'HORSE_SALE_V2', v_contract, p_horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,'is_signer',cp.is_signer,'signer_order',cp.signer_order))
       FROM contract_parties cp WHERE cp.contract_id = v_contract),
    NULL::text) gd;

  -- PARTYCTRL: seed default party controls for every role this document
  -- carries, so the admin panel has rows to render from creation onward.
  INSERT INTO document_party_controls (document_id, party_role, can_fill, can_edit_deal, can_suggest, can_add_clause, org_id)
  SELECT DISTINCT v_doc, dp.party_role, true, false, false, false, v_org
    FROM document_parties dp
   WHERE dp.document_id = v_doc AND dp.party_role NOT IN ('FHE','COMPANY')
  ON CONFLICT (document_id, party_role) DO NOTHING;

  UPDATE documents SET originator_contact_id = v_originator,
                       workflow_state = 'editable', status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

  -- seed fields straight from the clause-model defs (clause_key + responsibility_kind carried)
  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, clause_key, owner_role,
    value_type, input_kind, format_type, options, conditional_on, closed, guidance,
    required, is_optional, responsibility, sort_order, parent_field_key,
    responsibility_kind)
  SELECT v_org, v_doc, d.field_key, d.label, d.section, d.clause_key, d.owner_role,
         d.value_type, nullif(d.input_kind,''), d.format_type, d.options, d.conditional_on, d.closed, d.guidance,
         d.required, d.is_optional, d.responsibility, d.sort_order, d.parent_field_key,
         d.responsibility_kind
    FROM contract_field_defs d
   WHERE d.template_key = 'HORSE_SALE_V2';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- deal terms handed in at start
  IF p_amount IS NOT NULL THEN
    UPDATE contract_fields SET value = p_amount::text
     WHERE document_id = v_doc AND field_key = 'TXN.PURCHASE_PRICE';
  END IF;
  IF p_deposit IS NOT NULL THEN
    UPDATE contract_fields SET value = p_deposit::text
     WHERE document_id = v_doc AND field_key = 'TXN.DEPOSIT_AMOUNT';
    UPDATE contract_fields SET value = 'YES'
     WHERE document_id = v_doc AND field_key = 'TXN.DEPOSIT_ENABLED';
  END IF;

  -- fill horse + party identity fields from records (reuse verified paths)
  IF p_horse_id IS NOT NULL THEN
    PERFORM attach_horse_to_document(v_doc, p_horse_id);
    SELECT * INTO v_horse FROM horses WHERE id = p_horse_id;

    -- seller-disclosure seed from the record (attach fills HORSE.* only)
    UPDATE contract_fields
       SET value = coalesce(horse_field_token_value(v_horse, 'KNOWN_CONDITIONS'), '')
     WHERE document_id = v_doc AND field_key = 'TXN.KNOWN_CONDITIONS'
       AND coalesce(btrim(value), '') = ''
       AND coalesce(horse_field_token_value(v_horse, 'KNOWN_CONDITIONS'), '') <> '';

    -- owner ruling: an actively-leased horse is sellable; prefill the
    -- encumbrances election toward YES identifying the lease (still editable).
    IF v_horse.lessee_contact_id IS NOT NULL
       AND (v_horse.lease_end IS NULL OR v_horse.lease_end >= current_date) THEN
      SELECT nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), '')
        INTO v_lessee_nm FROM contacts c WHERE c.id = v_horse.lessee_contact_id;
      UPDATE contract_fields SET value = 'YES'
       WHERE document_id = v_doc AND field_key = 'TXN.HAS_ENCUMBRANCES'
         AND coalesce(btrim(value), '') = '';
      UPDATE contract_fields
         SET value = 'The Horse is currently under an active lease to '
                     || coalesce(v_lessee_nm, 'the lessee of record')
                     || coalesce(' through ' || to_char(v_horse.lease_end, 'FMMonth FMDD, YYYY'), '')
                     || '.'
       WHERE document_id = v_doc AND field_key = 'TXN.DISCLOSED_ENCUMBRANCES'
         AND coalesce(btrim(value), '') = '';
    END IF;
  END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);

  -- compose the numbered clause body
  PERFORM remerge_contract_from_clauses(v_doc);

  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract, 'fields_seeded', v_n);
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_deal_document(p_deal_id uuid, p_template_key text, p_has_sale_agreement text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal deals%ROWTYPE; v_ctr contracts%ROWTYPE; v_anchor uuid; v_doc uuid;
  v_n int; v_roles text[]; v_horse horses%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to add a document'; END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;
  IF v_deal.status = 'void' THEN
    RAISE EXCEPTION 'this deal is void — documents cannot be added';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM deal_template_options(v_deal.deal_type) o
                  WHERE o.template_key = p_template_key) THEN
    RAISE EXCEPTION '% is not a document a % deal carries', p_template_key, v_deal.deal_type;
  END IF;

  SELECT * INTO v_ctr FROM contracts WHERE id = v_deal.contract_id;
  v_roles := deal_party_roles(v_deal.deal_type);

  IF NOT EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = v_deal.contract_id AND party_role = v_roles[1])
     OR NOT EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = v_deal.contract_id AND party_role = v_roles[2]) THEN
    RAISE EXCEPTION 'both sides need at least one person before a document can be prepared';
  END IF;

  SELECT contact_id INTO v_anchor FROM contract_parties
   WHERE contract_id = v_deal.contract_id AND party_role = v_roles[2]
   ORDER BY signer_order NULLS LAST, id LIMIT 1;

  SELECT gd.document_id INTO v_doc FROM generate_document(
    v_anchor, p_template_key, v_deal.contract_id, v_ctr.horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,
                                         'is_signer',cp.is_signer,'signer_order',cp.signer_order))
       FROM contract_parties cp WHERE cp.contract_id = v_deal.contract_id),
    NULL::text) gd;

  -- PARTYCTRL: seed default party controls for every role this document
  -- carries, so the admin panel has rows to render from creation onward.
  INSERT INTO document_party_controls (document_id, party_role, can_fill, can_edit_deal, can_suggest, can_add_clause, org_id)
  SELECT DISTINCT v_doc, dp.party_role, true, false, false, false, v_deal.org_id
    FROM document_parties dp
   WHERE dp.document_id = v_doc AND dp.party_role NOT IN ('FHE','COMPANY')
  ON CONFLICT (document_id, party_role) DO NOTHING;

  UPDATE documents SET originator_contact_id = current_contact_id(),
                       workflow_state = 'editable', status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, clause_key, owner_role,
    value_type, input_kind, format_type, options, conditional_on, closed, guidance,
    required, is_optional, responsibility, sort_order, parent_field_key, responsibility_kind)
  SELECT v_deal.org_id, v_doc, d.field_key, d.label, d.section, d.clause_key, d.owner_role,
         d.value_type, nullif(d.input_kind,''), d.format_type, d.options, d.conditional_on,
         d.closed, d.guidance, d.required, d.is_optional, d.responsibility, d.sort_order,
         d.parent_field_key, d.responsibility_kind
    FROM contract_field_defs d WHERE d.template_key = p_template_key;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF p_template_key = 'HORSE_BILL_OF_SALE' AND p_has_sale_agreement IN ('YES','NO') THEN
    UPDATE contract_fields SET value = p_has_sale_agreement
     WHERE document_id = v_doc AND field_key = 'TXN.BOS_HAS_SALE_AGREEMENT';
  END IF;

  IF v_ctr.horse_id IS NOT NULL THEN
    PERFORM attach_horse_to_document(v_doc, v_ctr.horse_id);
    SELECT * INTO v_horse FROM horses WHERE id = v_ctr.horse_id;
    UPDATE contract_fields
       SET value = coalesce(horse_field_token_value(v_horse, 'KNOWN_CONDITIONS'), '')
     WHERE document_id = v_doc AND field_key = 'TXN.KNOWN_CONDITIONS'
       AND coalesce(btrim(value), '') = ''
       AND coalesce(horse_field_token_value(v_horse, 'KNOWN_CONDITIONS'), '') <> '';
  END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);
  PERFORM remerge_contract_from_clauses(v_doc);

  RETURN jsonb_build_object('document_id', v_doc, 'template_key', p_template_key,
                            'fields_seeded', v_n);
END;
$function$;

-- Backfill: every existing non-deleted, non-executed document that has
-- document_parties but zero document_party_controls rows gets the same
-- default seed. Executed/terminal documents (status = 'EXECUTED') are left
-- alone -- they can't be configured through the panel anyway, and signed
-- documents are never touched.
INSERT INTO document_party_controls (document_id, party_role, can_fill, can_edit_deal, can_suggest, can_add_clause, org_id)
SELECT DISTINCT dp.document_id, dp.party_role, true, false, false, false, d.org_id
  FROM document_parties dp
  JOIN documents d ON d.id = dp.document_id
 WHERE d.deleted_at IS NULL
   AND d.status NOT IN ('EXECUTED')
   AND dp.party_role NOT IN ('FHE','COMPANY')
   AND NOT EXISTS (
     SELECT 1 FROM document_party_controls c
      WHERE c.document_id = dp.document_id AND c.party_role = dp.party_role)
ON CONFLICT (document_id, party_role) DO NOTHING;
