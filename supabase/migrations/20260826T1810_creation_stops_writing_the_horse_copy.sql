-- THE FOUR CREATION FUNCTIONS STOP WRITING THE COPY.
--
-- Companion to 20260826T1800. Each of these INSERTed the horse into `contracts`
-- AND called attach_horse_to_document, which writes documents.horse_id — so the
-- horse was being recorded twice at creation, and only one of the two was ever
-- updated afterwards. The contracts INSERT is removed; attach_horse_to_document
-- is untouched and remains the one write.
--
-- ⚠️ WITHOUT THIS, CONTRACT CREATION IS BROKEN, because the column these name was
-- renamed in the migration above. That is the tripwire working as intended — it
-- surfaced four writers immediately instead of letting them drift.
CREATE OR REPLACE FUNCTION public.create_deal(p_deal_type text, p_party_a_contact_ids uuid[] DEFAULT '{}'::uuid[], p_party_b_contact_ids uuid[] DEFAULT '{}'::uuid[], p_notes text DEFAULT NULL::text, p_title text DEFAULT NULL::text, p_horse_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_roles text[]; v_contract uuid; v_deal uuid; v_id uuid; v_n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to create a deal'; END IF;

  v_roles := deal_party_roles(p_deal_type);
  IF v_roles IS NULL THEN
    RAISE EXCEPTION 'unknown deal type: % (expected SALE or LEASE)', p_deal_type;
  END IF;

  v_org := current_org();

  INSERT INTO contracts (org_id, segment, status, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', current_contact_id(),
            jsonb_build_object('deal_kind', p_deal_type))
    RETURNING id INTO v_contract;

  v_deal := ensure_deal_for_contract(v_contract, p_deal_type, p_title, p_notes);
  IF v_deal IS NULL THEN
    RAISE EXCEPTION 'could not open a deal for contract %', v_contract;
  END IF;

  FOREACH v_id IN ARRAY coalesce(p_party_a_contact_ids, '{}') LOOP
    PERFORM add_deal_member(v_deal, v_roles[1], v_id); v_n := v_n + 1;
  END LOOP;
  FOREACH v_id IN ARRAY coalesce(p_party_b_contact_ids, '{}') LOOP
    PERFORM add_deal_member(v_deal, v_roles[2], v_id); v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('deal_id', v_deal, 'contract_id', v_contract,
                            'deal_type', p_deal_type, 'roles', v_roles,
                            'members_added', v_n);
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_lease_contract_v2(p_lessee_contact_id uuid, p_lessor_contact_id uuid DEFAULT NULL::uuid, p_horse_id uuid DEFAULT NULL::uuid, p_responsible_role text DEFAULT 'LESSEE'::text, p_template_key text DEFAULT 'HORSE_LEASE_V2'::text)
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
  v_key        text;
  v_active     boolean;
  v_deleted    timestamptz;
  v_kind       text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to start a lease contract'; END IF;
  IF p_lessee_contact_id IS NULL THEN RAISE EXCEPTION 'a lessee contact is required'; END IF;

  -- LEASEFORK: which lease version to author. NULL == not specified == the default.
  v_key := coalesce(p_template_key, 'HORSE_LEASE_V2');

  v_originator := current_contact_id();  -- H1: the company (staff caller) is always the author

  SELECT org_id INTO v_org FROM contacts WHERE id = p_lessee_contact_id;

  -- LEASEFORK: validate the selected template. No silent fallback — a bad key
  -- raises rather than quietly authoring a different contract than was chosen.
  SELECT id, active, deleted_at, contract_kind
    INTO v_tmpl, v_active, v_deleted, v_kind
    FROM contract_templates WHERE template_key = v_key;
  IF v_tmpl IS NULL THEN
    RAISE EXCEPTION 'unknown contract template: %', v_key;
  END IF;
  IF v_kind IS DISTINCT FROM 'HORSE_LEASE' THEN
    RAISE EXCEPTION 'template % is not a lease template (contract_kind = %)',
      v_key, coalesce(v_kind, 'NULL');
  END IF;
  IF NOT v_active OR v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'template % is not active', v_key;
  END IF;

  -- contract + parties (spine model)
  INSERT INTO contracts (org_id, segment, status, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', v_originator, jsonb_build_object('deal_side','LEASE_IN'))
    RETURNING id INTO v_contract;
  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_contract, p_lessee_contact_id, 'LESSEE', true, 1);
  IF p_lessor_contact_id IS NOT NULL THEN
    INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_contract, p_lessor_contact_id, 'LESSOR', true, 2);
  END IF;

  -- document shell (same generator the engine uses; body recomposed below)
  SELECT gd.document_id INTO v_doc FROM generate_document(
    p_lessee_contact_id, v_key, v_contract, p_horse_id,
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
  -- LEASEFIX 2026-08-09: `value` seeds from d.default_value. NULL for every def that
  -- does not set one, which is the prior behaviour exactly.
  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, clause_key, owner_role,
    value_type, input_kind, format_type, options, conditional_on, closed, guidance,
    required, is_optional, responsibility, sort_order, parent_field_key,
    responsibility_kind, value)
  SELECT v_org, v_doc, d.field_key, d.label, d.section, d.clause_key, d.owner_role,
         d.value_type, nullif(d.input_kind,''), d.format_type, d.options, d.conditional_on, d.closed, d.guidance,
         d.required, d.is_optional, d.responsibility, d.sort_order, d.parent_field_key,
         d.responsibility_kind, d.default_value
    FROM contract_field_defs d
   WHERE d.template_key = v_key;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- fill horse + party identity fields from records (reuse verified paths)
  IF p_horse_id IS NOT NULL THEN
    PERFORM attach_horse_to_document(v_doc, p_horse_id);
  END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);

  -- compose the numbered clause body
  PERFORM remerge_contract_from_clauses(v_doc);

  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract,
                            'fields_seeded', v_n, 'template_key', v_key);
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
  INSERT INTO contracts (org_id, segment, status, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', v_originator, jsonb_build_object('deal_side','SALE'))
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
$function$;

CREATE OR REPLACE FUNCTION public.start_bill_of_sale_standalone(p_buyer_contact_id uuid, p_seller_contact_id uuid DEFAULT NULL::uuid, p_horse_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_contract uuid;
  v_doc      uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to start a bill of sale'; END IF;
  IF p_buyer_contact_id IS NULL THEN RAISE EXCEPTION 'a buyer contact is required'; END IF;

  SELECT org_id INTO v_org FROM contacts WHERE id = p_buyer_contact_id;

  INSERT INTO contracts (org_id, segment, status, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', current_contact_id(), jsonb_build_object('deal_side','SALE'))
    RETURNING id INTO v_contract;
  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_contract, p_buyer_contact_id, 'BUYER', true, 1);
  IF p_seller_contact_id IS NOT NULL THEN
    INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_contract, p_seller_contact_id, 'SELLER', true, 2);
  END IF;

  v_doc := bos_generate_document(
    v_contract, p_buyer_contact_id, p_horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,'is_signer',cp.is_signer,'signer_order',cp.signer_order))
       FROM contract_parties cp WHERE cp.contract_id = v_contract));

  UPDATE contract_fields SET value = 'NO'
   WHERE document_id = v_doc AND field_key = 'TXN.BOS_HAS_SALE_AGREEMENT';

  IF p_horse_id IS NOT NULL THEN
    PERFORM attach_horse_to_document(v_doc, p_horse_id);
  END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);
  PERFORM remerge_contract_from_clauses(v_doc);

  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract);
END;
$function$;
