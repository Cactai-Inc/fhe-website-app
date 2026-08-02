/*
  # Sale + Bill of Sale engine functions

  - fill_party_fields_from_contacts: SELLER/BUYER party-type derivation; a second
    BUYER party (the co-buyer — same party_role, next signer_order) fills the
    COBUYER.* namespace instead of colliding with the primary buyer's fields.
  - start_sale_contract: clause-model sale start, modeled line-for-line on the
    live start_lease_contract_v2 (staff-only, spine contract, defs-seeded fields,
    record auto-import, remerge). Adds: amount/deposit seeding, known-conditions
    seeding from the horse record, and active-lease encumbrance prefill (owner
    ruling: a leased horse is sellable; the encumbrances election prefills YES
    identifying the lease).
  - start_bill_of_sale (from a sale document) + start_bill_of_sale_standalone.
  - set_document_co_buyer / remove_document_co_buyer: co-buyer party machinery.
    A co-buyer is a SECOND contact with party_role BUYER and the next
    signer_order (document_parties/signatures are UNIQUE on document, contact,
    role — verified). Hand-entry fallback creates a CONTACT record deduped on
    email (the requests_capture_contact pattern).
  - set_contract_field: TXN.CO_BUYER_ENABLED → NO tears the co-buyer down
    (remove signer/party rows; the value change itself already voided
    signatures the way any material edit does).
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. fill_party_fields_from_contacts — SELLER/BUYER/COBUYER aware
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fill_party_fields_from_contacts(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_contract uuid;
  r    RECORD;
  v_name text;
  v_addr text;
  v_pair record;
BEGIN
  SELECT contract_id, org_id INTO v_contract, v_org
    FROM documents WHERE id = p_document_id;
  IF v_contract IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT t.*,
           CASE WHEN t.party_role = 'BUYER' AND t.rn > 1 THEN 'COBUYER' ELSE t.party_role END AS ns
      FROM (
        SELECT cp.party_role,
               row_number() OVER (PARTITION BY cp.party_role
                                  ORDER BY cp.signer_order NULLS LAST, cp.id) AS rn,
               c.first_name, c.last_name, c.email, c.phone_display AS phone,
               c.address_composed, c.address_line1, c.address_line2,
               c.city, c.state, c.postal_code, c.is_company
          FROM contract_parties cp
          JOIN contacts c ON c.id = cp.contact_id
         WHERE cp.contract_id = v_contract
      ) t
  LOOP
    v_name := nullif(btrim(coalesce(r.first_name,'') || ' ' || coalesce(r.last_name,'')), '');
    -- prefer a precomposed address; otherwise assemble from parts
    v_addr := coalesce(
      nullif(btrim(coalesce(r.address_composed,'')), ''),
      compose_address(r.address_line1, r.address_line2, r.city, r.state, r.postal_code)
    );

    -- Upsert each party token. INSERT when the row is absent (clause-model docs
    -- have no field_def for these author-invisible auto-fill fields); on conflict,
    -- fill only when the existing value is blank so a value already entered on the
    -- document is never overwritten. Empty source values are skipped.
    FOR v_pair IN
      SELECT * FROM (VALUES
        (r.ns || '.FULL_NAME',    v_name),
        (r.ns || '.PRINTED_NAME', v_name),
        (r.ns || '.EMAIL',        r.email),
        (r.ns || '.PHONE',        r.phone),
        (r.ns || '.ADDRESS',      v_addr),
         (r.ns || '.PARTY_TYPE',
          CASE WHEN r.ns IN ('LESSEE','LESSOR','SELLER','BUYER','COBUYER')
               THEN CASE WHEN coalesce(r.is_company,false) THEN 'ENTITY' ELSE 'INDIVIDUAL' END END)
      ) AS t(field_key, val)
      WHERE coalesce(btrim(t.val), '') <> ''
    LOOP
      INSERT INTO contract_fields (org_id, document_id, field_key, owner_role, value,
                                   value_type, is_optional, included, sort_order)
      VALUES (v_org, p_document_id, v_pair.field_key, 'SYSTEM', v_pair.val,
              'text', false, true, 0)
      ON CONFLICT (document_id, field_key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now()
        WHERE coalesce(btrim(contract_fields.value), '') = '';
    END LOOP;
  END LOOP;

  PERFORM remerge_contract_from_fields(p_document_id);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. start_sale_contract — HORSE_SALE_V2 clause-model start
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.start_sale_contract(
  p_buyer_contact_id uuid,
  p_seller_contact_id uuid DEFAULT NULL,
  p_horse_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_deposit numeric DEFAULT NULL)
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. bill of sale starts (shared worker + from-sale + standalone)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bos_generate_document(
  p_contract_id uuid, p_anchor_contact_id uuid, p_horse_id uuid, p_parties jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_doc uuid;
BEGIN
  -- one ACTIVE bill of sale per contract: a superseding one requires voiding
  -- the old first (executed-docs rule: signed documents are never swept)
  IF EXISTS (
    SELECT 1 FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
     WHERE d.contract_id = p_contract_id AND t.template_key = 'HORSE_BILL_OF_SALE'
       AND d.deleted_at IS NULL AND d.workflow_state <> 'void'
  ) THEN
    RAISE EXCEPTION 'this contract already has a bill of sale — void it before generating another';
  END IF;

  SELECT org_id INTO v_org FROM contacts WHERE id = p_anchor_contact_id;

  SELECT gd.document_id INTO v_doc FROM generate_document(
    p_anchor_contact_id, 'HORSE_BILL_OF_SALE', p_contract_id, p_horse_id, p_parties, NULL::text) gd;

  UPDATE documents SET originator_contact_id = current_contact_id(),
                       workflow_state = 'editable', status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

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
   WHERE d.template_key = 'HORSE_BILL_OF_SALE';

  -- RULE (content file): when the company is a compensated intermediary on this
  -- deal — an executed transaction-representation retainer for any party — the
  -- agent disclosure election must be INCLUDED. Detected via the retainer
  -- document's parties; leave unseeded when no linkage exists.
  IF EXISTS (
    SELECT 1
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id AND t.template_key = 'HORSE_TRANSACTION_REP'
      JOIN document_parties dp ON dp.document_id = d.id
     WHERE d.status = 'EXECUTED' AND d.deleted_at IS NULL
       AND dp.contact_id IN (SELECT contact_id FROM jsonb_to_recordset(p_parties) AS p(contact_id uuid))
  ) THEN
    UPDATE contract_fields SET value = 'INCLUDED'
     WHERE document_id = v_doc AND field_key = 'TXN.AGENT_ELECTION';
  END IF;

  RETURN v_doc;
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_bill_of_sale(p_sale_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale     documents%ROWTYPE;
  v_tkey     text;
  v_doc      uuid;
  v_anchor   uuid;
  v_installments text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to generate a bill of sale'; END IF;

  SELECT * INTO v_sale FROM documents WHERE id = p_sale_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_sale_document_id; END IF;
  SELECT template_key INTO v_tkey FROM contract_templates WHERE id = v_sale.template_id;
  IF v_tkey <> 'HORSE_SALE_V2' THEN
    RAISE EXCEPTION 'a bill of sale is generated from a HORSE_SALE_V2 document (got %)', v_tkey;
  END IF;

  SELECT contact_id INTO v_anchor FROM document_parties
   WHERE document_id = p_sale_document_id AND party_role = 'BUYER'
   ORDER BY signer_order NULLS LAST, id LIMIT 1;
  IF v_anchor IS NULL THEN v_anchor := v_sale.contact_id; END IF;

  -- parties mirror the SALE DOCUMENT's parties (co-buyer + signer_order carried)
  v_doc := bos_generate_document(
    v_sale.contract_id, v_anchor, v_sale.horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',dp.contact_id,'role',dp.party_role,'is_signer',dp.is_signer,'signer_order',dp.signer_order))
       FROM document_parties dp WHERE dp.document_id = p_sale_document_id));

  -- prefill every shared field from the sale document's values (parties, horse,
  -- price, co-buyer set) — same field_keys by design; still editable before signing
  UPDATE contract_fields b
     SET value = s.value, updated_at = now()
    FROM contract_fields s
   WHERE b.document_id = v_doc
     AND s.document_id = p_sale_document_id
     AND s.field_key = b.field_key
     AND coalesce(btrim(s.value), '') <> ''
     AND coalesce(btrim(b.value), '') = '';

  UPDATE contract_fields SET value = 'YES'
   WHERE document_id = v_doc AND field_key = 'TXN.BOS_HAS_SALE_AGREEMENT';

  -- payment status derives from the sale's installment election (still editable)
  SELECT coalesce(btrim(value), '') INTO v_installments
    FROM contract_fields
   WHERE document_id = p_sale_document_id AND field_key = 'TXN.INSTALLMENTS_ENABLED';
  UPDATE contract_fields
     SET value = CASE v_installments WHEN 'YES' THEN 'INSTALLMENTS'
                                     WHEN 'NO'  THEN 'PAID_IN_FULL'
                                     ELSE '' END
   WHERE document_id = v_doc AND field_key = 'TXN.BOS_PAYMENT_STATUS';

  IF v_sale.horse_id IS NOT NULL THEN
    PERFORM attach_horse_to_document(v_doc, v_sale.horse_id);
  END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);
  PERFORM remerge_contract_from_clauses(v_doc);

  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_sale.contract_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_bill_of_sale_standalone(
  p_buyer_contact_id uuid,
  p_seller_contact_id uuid DEFAULT NULL,
  p_horse_id uuid DEFAULT NULL)
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

  INSERT INTO contracts (org_id, segment, status, horse_id, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', p_horse_id, current_contact_id(), jsonb_build_object('deal_side','SALE'))
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. co-buyer party machinery
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_document_co_buyer(
  p_document_id uuid,
  p_contact_id uuid DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address_line1 text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_postal_code text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc      documents%ROWTYPE;
  v_contact  uuid := p_contact_id;
  v_email    text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_next     int;
  v_primary  uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to set a co-buyer'; END IF;

  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;
  IF v_doc.workflow_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'this contract can no longer be edited';
  END IF;

  SELECT contact_id INTO v_primary FROM document_parties
   WHERE document_id = p_document_id AND party_role = 'BUYER'
   ORDER BY signer_order NULLS LAST, id LIMIT 1;
  IF v_primary IS NULL THEN RAISE EXCEPTION 'the document has no primary buyer party'; END IF;

  -- hand-entry fallback: create a contact record from the entry (deduped on
  -- email, the same way inbound capture creates contacts elsewhere)
  IF v_contact IS NULL THEN
    IF v_email IS NOT NULL THEN
      SELECT id INTO v_contact FROM contacts
       WHERE lower(email) = v_email AND org_id = v_doc.org_id AND deleted_at IS NULL
       ORDER BY created_at LIMIT 1;
    END IF;
    IF v_contact IS NULL THEN
      IF coalesce(btrim(coalesce(p_first_name,'') || coalesce(p_last_name,'')), '') = '' THEN
        RAISE EXCEPTION 'a contact or a name is required for the co-buyer';
      END IF;
      INSERT INTO contacts (org_id, first_name, last_name, email, phone,
                            address_line1, city, state, postal_code, contact_type, notes)
      VALUES (v_doc.org_id,
              nullif(btrim(coalesce(p_first_name,'')), ''),
              nullif(btrim(coalesce(p_last_name,'')), ''),
              v_email,
              nullif(btrim(coalesce(p_phone,'')), ''),
              nullif(btrim(coalesce(p_address_line1,'')), ''),
              nullif(btrim(coalesce(p_city,'')), ''),
              nullif(btrim(coalesce(p_state,'')), ''),
              nullif(btrim(coalesce(p_postal_code,'')), ''),
              'CONTACT',
              'Created as co-buyer on contract document ' || p_document_id::text)
      RETURNING id INTO v_contact;
    END IF;
  END IF;

  IF v_contact = v_primary THEN
    RAISE EXCEPTION 'the co-buyer must be a different person than the buyer';
  END IF;

  -- a second BUYER party row with the next signer_order (unique on doc+contact+role)
  SELECT coalesce(max(signer_order), 0) + 1 INTO v_next
    FROM document_parties WHERE document_id = p_document_id;

  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_doc.org_id, v_doc.contract_id, v_contact, 'BUYER', true, v_next)
    ON CONFLICT (contract_id, contact_id, party_role) DO NOTHING;
  INSERT INTO document_parties (org_id, document_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_doc.org_id, p_document_id, v_contact, 'BUYER', true, v_next)
    ON CONFLICT (document_id, contact_id, party_role) DO NOTHING;

  -- adding a signer changes what the signatures attest to
  PERFORM void_signatures_on_edit(p_document_id);

  UPDATE contract_fields SET value = 'YES', updated_at = now()
   WHERE document_id = p_document_id AND field_key = 'TXN.CO_BUYER_ENABLED'
     AND coalesce(btrim(value), '') <> 'YES';

  PERFORM fill_party_fields_from_contacts(p_document_id);
  PERFORM remerge_contract_from_clauses(p_document_id);

  RETURN jsonb_build_object('contact_id', v_contact, 'signer_order', v_next);
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_document_co_buyer(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc documents%ROWTYPE;
  r record;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  FOR r IN
    SELECT contact_id FROM (
      SELECT dp.contact_id,
             row_number() OVER (ORDER BY dp.signer_order NULLS LAST, dp.id) AS rn
        FROM document_parties dp
       WHERE dp.document_id = p_document_id AND dp.party_role = 'BUYER'
    ) t WHERE t.rn > 1
  LOOP
    DELETE FROM document_parties
     WHERE document_id = p_document_id AND contact_id = r.contact_id AND party_role = 'BUYER';
    -- drop the contract-grain row only when no other document under this
    -- contract still names this contact as a BUYER party
    IF NOT EXISTS (
      SELECT 1 FROM document_parties dp
        JOIN documents d ON d.id = dp.document_id
       WHERE d.contract_id = v_doc.contract_id AND d.deleted_at IS NULL
         AND dp.contact_id = r.contact_id AND dp.party_role = 'BUYER'
    ) THEN
      DELETE FROM contract_parties
       WHERE contract_id = v_doc.contract_id AND contact_id = r.contact_id AND party_role = 'BUYER';
    END IF;
  END LOOP;

  -- clear the co-buyer's namespace values (defs stay; values go)
  UPDATE contract_fields SET value = NULL, updated_at = now()
   WHERE document_id = p_document_id AND field_key LIKE 'COBUYER.%'
     AND coalesce(btrim(value), '') <> '';

  PERFORM void_signatures_on_edit(p_document_id);
  PERFORM remerge_contract_from_clauses(p_document_id);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. set_contract_field — co-buyer teardown hook (TXN.CO_BUYER_ENABLED → NO).
--    Full replace of the live body; the only change is the hook after the
--    audit block (search for "co-buyer teardown").
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_contract_field(p_document_id uuid, p_field_key text, p_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org        uuid;
  v_state      text;
  v_recip_edit boolean;
  v_owner_role text;
  v_is_staff   boolean;
  v_is_orig    boolean;
  v_owns_role  boolean;
  v_can_fill   boolean;
  v_can_deal   boolean;
  v_row        contract_fields%ROWTYPE;
  v_confirmed  timestamptz;
  v_old_value  text;
  v_label      text;
  v_changed    boolean;
  v_format     text;
  v_violation  text;
  v_sec        text;
  v_counterpart text;
  v_is_elect   boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state, recipient_editing, horse_section_confirmed_at
    INTO v_org, v_state, v_recip_edit, v_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  SELECT owner_role, value, label INTO v_owner_role, v_old_value, v_label
    FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no field % on document %', p_field_key, p_document_id;
  END IF;

  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'document is locked (workflow_state=%): fields are read-only', v_state;
  END IF;

  -- THE CHANGES FREEZE (Notify model): an author may keep editing the document
  -- until a COUNTERPARTY has actually OPENED it. Requests freeze separately, per
  -- request, on being SEEN. Same predicate the Notify modal copy is built from.
  IF document_changes_frozen(p_document_id, NULL) THEN
    RAISE EXCEPTION 'this contract is fully executed — it can no longer be edited';
  END IF;

  -- U2.1c: money values must be canonical for their declared format BEFORE
  -- anything is written. A bare amount where the fee-schedule object belongs,
  -- a '$'-formatted string where a numeric belongs, or rendered prose saved
  -- back as a value are all rejected here rather than discovered later in a
  -- document that renders wrong.
  SELECT format_type INTO v_format
    FROM contract_field_defs fd
    JOIN documents d ON d.id = p_document_id
   WHERE fd.field_key = p_field_key
     AND fd.template_key = coalesce(
           (SELECT t.template_key FROM contract_templates t WHERE t.id = d.template_id),
           fd.template_key)
   LIMIT 1;
  IF v_format IS NOT NULL THEN
    v_violation := money_shape_violation(v_format, p_value);
    IF v_violation IS NOT NULL THEN
      RAISE EXCEPTION '%', v_violation;
    END IF;
  END IF;

  -- Decided before the write, while v_old_value still holds the prior value.
  v_changed := coalesce(v_old_value,'') IS DISTINCT FROM coalesce(p_value,'');

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_orig  := false;  -- H1: originator no longer grants edit rights
  v_owns_role := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = v_owner_role);

  SELECT bool_or(coalesce(c.can_fill, true)), bool_or(coalesce(c.can_edit_deal, false))
    INTO v_can_fill, v_can_deal
  FROM caller_party_roles(p_document_id) r
  LEFT JOIN document_party_controls c
    ON c.document_id = p_document_id AND c.party_role = r;
  v_can_fill := coalesce(v_can_fill, true);
  v_can_deal := coalesce(v_can_deal, false);

  -- D4(a): the two insurance responsibility elections are PARTY-EXCLUSIVE.
  -- An election is a party's own act; staff status does not stand in for it.
  -- FHE is itself the Lessor on these contracts, so without this carve-out
  -- FHE staff could make the Lessee's election for them.
  v_sec := CASE
             WHEN p_field_key IN ('TXN.GL_LESSEE_RESPONSIBLE','TXN.GL_NOT_REQUIRED') THEN 'GL'
             WHEN p_field_key IN ('TXN.MORT_LESSEE_RESPONSIBLE','TXN.MORT_NOT_REQUIRED') THEN 'MORT'
             WHEN p_field_key IN ('TXN.MED_LESSEE_RESPONSIBLE','TXN.MED_NOT_REQUIRED') THEN 'MED'
             ELSE NULL
           END;
  v_is_elect := v_sec IS NOT NULL;

  IF v_is_elect THEN
    -- Only the owning party may elect. No staff substitution.
    IF NOT (v_owns_role AND v_can_fill) THEN
      RAISE EXCEPTION
        'only the % may make this election (field %) — it is that party''s own act and cannot be made on their behalf',
        v_owner_role, p_field_key;
    END IF;
  ELSIF NOT (
       v_is_staff
    OR (v_owner_role = 'DEAL' AND v_can_deal)
    OR (v_owner_role <> 'DEAL' AND v_owns_role AND v_can_fill)
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this field (owner_role=%)', v_owner_role;
  END IF;

  -- D4(b): mutual exclusivity. While one election is YES, the other cannot be
  -- set to YES. Unchecking your own re-opens the choice (spec).
  IF v_is_elect AND upper(coalesce(p_value,'')) = 'YES' THEN
    v_counterpart := CASE
      WHEN p_field_key LIKE '%_LESSEE_RESPONSIBLE' THEN 'TXN.' || v_sec || '_NOT_REQUIRED'
      ELSE 'TXN.' || v_sec || '_LESSEE_RESPONSIBLE'
    END;
    IF EXISTS (
      SELECT 1 FROM contract_fields
       WHERE document_id = p_document_id
         AND field_key = v_counterpart
         AND upper(coalesce(value,'')) = 'YES'
    ) THEN
      RAISE EXCEPTION
        'conflicting election: % is already accepted on this contract — the other party must uncheck it first',
        v_counterpart;
    END IF;
  END IF;

  -- An edit changes the text a signature attested to, so any standing
  -- signature is voided. A save that writes back the identical value is not
  -- an edit and must leave signatures intact. The signer is told at the next SEND.
  IF v_changed THEN
    PERFORM void_signatures_on_edit(p_document_id);
  END IF;

  UPDATE contract_fields
     SET value = p_value,
         entered_by_contact_id = current_contact_id(),
         entered_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key
   RETURNING * INTO v_row;

  IF p_field_key LIKE 'HORSE.%' AND v_confirmed IS NOT NULL THEN
    UPDATE documents
       SET horse_section_confirmed_at = NULL,
           horse_section_confirmed_by = NULL
     WHERE id = p_document_id;
  END IF;

  -- bidirectional horse sync (contract → record): open states only, party or
  -- staff, never clobbers a differing value, idempotent when unchanged.
  IF p_field_key LIKE 'HORSE.%' THEN
    PERFORM contract_horse_field_writeback(p_document_id, p_field_key, p_value);
  END IF;

  -- audit: only log an actual change
  IF v_changed THEN
    PERFORM log_contract_change(p_document_id, 'field_value', p_field_key, v_label,
                                v_owner_role, v_old_value, p_value, '{}'::jsonb);
  END IF;

  -- co-buyer teardown: flipping the enable to NO removes the co-buyer signer
  -- and party rows (signatures were already voided by the change above).
  IF v_changed AND p_field_key = 'TXN.CO_BUYER_ENABLED'
     AND upper(coalesce(p_value,'')) = 'NO' THEN
    PERFORM remove_document_co_buyer(p_document_id);
  END IF;

  -- D5: the elections drive the unresolved-state notifications. Called after
  -- the write so it observes the new state. Never modifies status values.
  IF v_is_elect OR p_field_key LIKE 'TXN.%_LESSOR_STATUS' OR p_field_key LIKE 'TXN.%_LESSEE_STATUS' THEN
    PERFORM insurance_resolution_sync(p_document_id);
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id, 'document_id', v_row.document_id, 'field_key', v_row.field_key,
    'owner_role', v_row.owner_role, 'value', v_row.value, 'value_type', v_row.value_type,
    'entered_by_contact_id', v_row.entered_by_contact_id, 'entered_at', v_row.entered_at);
END;
$function$;
