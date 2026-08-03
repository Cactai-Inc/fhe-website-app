/*
  # Stage 3 — documents on a deal (deal plan L4, L5, L7, L8)

  add_deal_document(deal, template_key, ...) generates a document against the
  deal's EXISTING spine row, rather than creating a second one the way the
  standalone starters do. It reuses the same shared machinery those starters use
  — generate_document, the clause-def field seed, attach_horse_to_document,
  fill_party_fields_from_contacts, remerge_contract_from_clauses — so a
  deal-generated document is byte-identical in shape to one from the old path.
  Nothing about generation/filling/locking/signing changes (L13).

  deal_document_status(deal) reports which documents a deal's TYPE requires and
  which it has (L5), as STATUS — never as an enforcement gate:
    SALE  — bill of sale REQUIRED, sale agreement OPTIONAL, both allowed.
    LEASE — lease agreement REQUIRED (its only required document).

  The bill of sale's two Add-a-document choices set TXN.BOS_HAS_SALE_AGREEMENT
  (L17): "Bill of sale (standalone)" → NO, "with the sale agreement" → YES.
*/

-- which templates a deal type may carry, and which it needs
CREATE OR REPLACE FUNCTION public.deal_template_options(p_deal_type text)
 RETURNS TABLE(template_key text, title text, required boolean, sort_order int)
 LANGUAGE sql STABLE
AS $function$
  SELECT t.template_key, t.title, t.required, t.sort_order
    FROM (VALUES
      ('SALE',  'HORSE_BILL_OF_SALE', 'Equine Bill of Sale',               true,  10),
      ('SALE',  'HORSE_SALE_V2',      'Horse Sale and Purchase Agreement', false, 20),
      ('LEASE', 'HORSE_LEASE_V2',     'Horse Lease Agreement',             true,  10)
    ) AS t(deal_type, template_key, title, required, sort_order)
   WHERE t.deal_type = p_deal_type;
$function$;

CREATE OR REPLACE FUNCTION public.deal_document_status(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deal deals%ROWTYPE;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'template_key', o.template_key,
             'title', o.title,
             'required', o.required,
             'present', EXISTS (
               SELECT 1 FROM documents d
                 JOIN contract_templates t ON t.id = d.template_id
                WHERE d.contract_id = v_deal.contract_id
                  AND d.deleted_at IS NULL AND d.workflow_state <> 'void'
                  AND t.template_key = o.template_key),
             'executed', EXISTS (
               SELECT 1 FROM documents d
                 JOIN contract_templates t ON t.id = d.template_id
                WHERE d.contract_id = v_deal.contract_id
                  AND d.deleted_at IS NULL AND d.status = 'EXECUTED'
                  AND t.template_key = o.template_key))
           ORDER BY o.sort_order)
      FROM deal_template_options(v_deal.deal_type) o), '[]'::jsonb);
END;
$function$;

-- ── generate a document onto the deal's existing spine ──────────────────────
CREATE OR REPLACE FUNCTION public.add_deal_document(
  p_deal_id uuid,
  p_template_key text,
  p_has_sale_agreement text DEFAULT NULL)   -- BOS posture: 'YES' | 'NO' (L17)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal    deals%ROWTYPE;
  v_ctr     contracts%ROWTYPE;
  v_anchor  uuid;
  v_doc     uuid;
  v_n       int;
  v_roles   text[];
  v_horse   horses%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to add a document'; END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;
  IF v_deal.status <> 'pending' THEN
    RAISE EXCEPTION 'this deal is % — documents can only be added while it is pending', v_deal.status;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM deal_template_options(v_deal.deal_type) o
                  WHERE o.template_key = p_template_key) THEN
    RAISE EXCEPTION '% is not a document a % deal carries', p_template_key, v_deal.deal_type;
  END IF;

  -- one live document per template per deal; supersede by voiding the old one
  IF EXISTS (
    SELECT 1 FROM documents d JOIN contract_templates t ON t.id = d.template_id
     WHERE d.contract_id = v_deal.contract_id AND d.deleted_at IS NULL
       AND d.workflow_state <> 'void' AND t.template_key = p_template_key
  ) THEN
    RAISE EXCEPTION 'this deal already has a %  — void it before adding another', p_template_key;
  END IF;

  SELECT * INTO v_ctr FROM contracts WHERE id = v_deal.contract_id;
  v_roles := deal_party_roles(v_deal.deal_type);

  -- the L3 threshold: a person and something given on each side
  IF NOT EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = v_deal.contract_id AND party_role = v_roles[1])
     OR NOT EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = v_deal.contract_id AND party_role = v_roles[2]) THEN
    RAISE EXCEPTION 'both sides need at least one person before a document can be prepared';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM deal_consideration WHERE deal_id = p_deal_id AND party_role = v_roles[1])
     OR NOT EXISTS (SELECT 1 FROM deal_consideration WHERE deal_id = p_deal_id AND party_role = v_roles[2]) THEN
    RAISE EXCEPTION 'both sides need at least one thing given before a document can be prepared';
  END IF;

  -- the document's anchor contact: the receiving side's first member
  SELECT contact_id INTO v_anchor FROM contract_parties
   WHERE contract_id = v_deal.contract_id AND party_role = v_roles[2]
   ORDER BY signer_order NULLS LAST, id LIMIT 1;

  -- SAME generator the standalone starters use — parties/horse carried from the spine
  SELECT gd.document_id INTO v_doc FROM generate_document(
    v_anchor, p_template_key, v_deal.contract_id, v_ctr.horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,
                                         'is_signer',cp.is_signer,'signer_order',cp.signer_order))
       FROM contract_parties cp WHERE cp.contract_id = v_deal.contract_id),
    NULL::text) gd;

  UPDATE documents SET originator_contact_id = current_contact_id(),
                       workflow_state = 'editable', status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

  -- seed fields from the clause defs (identical to the starters' seed)
  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, clause_key, owner_role,
    value_type, input_kind, format_type, options, conditional_on, closed, guidance,
    required, is_optional, responsibility, sort_order, parent_field_key,
    responsibility_kind)
  SELECT v_deal.org_id, v_doc, d.field_key, d.label, d.section, d.clause_key, d.owner_role,
         d.value_type, nullif(d.input_kind,''), d.format_type, d.options, d.conditional_on,
         d.closed, d.guidance, d.required, d.is_optional, d.responsibility, d.sort_order,
         d.parent_field_key, d.responsibility_kind
    FROM contract_field_defs d
   WHERE d.template_key = p_template_key;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- the bill of sale's posture (L17): standalone vs accompanied
  IF p_template_key = 'HORSE_BILL_OF_SALE' AND p_has_sale_agreement IN ('YES','NO') THEN
    UPDATE contract_fields SET value = p_has_sale_agreement
     WHERE document_id = v_doc AND field_key = 'TXN.BOS_HAS_SALE_AGREEMENT';
  END IF;

  -- seed the price from the deal's PAYMENT consideration where the template has one
  UPDATE contract_fields cf SET value = dc.amount::text
    FROM (SELECT amount FROM deal_consideration
           WHERE deal_id = p_deal_id AND kind = 'PAYMENT' AND amount IS NOT NULL
           ORDER BY sort_order LIMIT 1) dc
   WHERE cf.document_id = v_doc AND cf.field_key = 'TXN.PURCHASE_PRICE'
     AND coalesce(btrim(cf.value), '') = '';

  IF v_ctr.horse_id IS NOT NULL THEN
    PERFORM attach_horse_to_document(v_doc, v_ctr.horse_id);

    -- seller-disclosure seed from the record, matching start_sale_contract:
    -- attach_horse_to_document fills HORSE.* only, so the known-conditions
    -- disclosure would otherwise start blank on a document that requires it.
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

GRANT EXECUTE ON FUNCTION public.deal_template_options(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deal_document_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_deal_document(uuid, text, text) TO authenticated;
