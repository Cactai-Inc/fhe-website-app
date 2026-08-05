-- SEEDFIX (orchestrator, 2026-08-05): owner ruling "the deal doesn't control or
-- gate anything" — party controls seeded at contract creation now default
-- can_edit_deal = TRUE for every non-FHE/COMPANY party (was false, which left
-- every fresh contract's DEAL-owned fields uneditable by all parties until an
-- admin visited the Document controls panel — the live incident on the Sarah
-- lease, 2026-08-05). Bodies below are the live prosrc with exactly one value
-- changed in each seed INSERT; plus a backfill for existing non-terminal docs.
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
  SELECT DISTINCT v_doc, dp.party_role, true, true, false, false, v_org
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
$function$

;

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
  SELECT DISTINCT v_doc, dp.party_role, true, true, false, false, v_org
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
$function$

;

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
  SELECT DISTINCT v_doc, dp.party_role, true, true, false, false, v_deal.org_id
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
$function$

;

-- Backfill: every configurable (non-executed, non-deleted) document's existing
-- controls rows gain deal-edit, honoring the same ruling.
UPDATE document_party_controls c
   SET can_edit_deal = true
  FROM documents d
 WHERE d.id = c.document_id
   AND d.deleted_at IS NULL
   AND d.status <> 'EXECUTED'
   AND c.can_edit_deal = false;
