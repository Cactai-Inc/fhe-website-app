-- start_broker_contract now attaches the horse AND fills CLIENT.* fields (was filling neither).
CREATE OR REPLACE FUNCTION public.start_broker_contract(p_client_contact_id uuid, p_deal_side text DEFAULT 'BUY'::text, p_horse_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_eng uuid;
  v_contract uuid;
  v_org  uuid;
  v_doc uuid;
  v_n   integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'not authorized to start a representation contract';
  END IF;

  -- stage so the HORSE_TRANSACTION_REP DIR.* terms (direction/role/counterparty)
  -- resolve. retained_by = the client's side; deal_side = BUY/SELL.
  SELECT org_id INTO v_org FROM contacts WHERE id = p_client_contact_id;
  INSERT INTO contracts (org_id, segment, status, horse_id, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', p_horse_id, p_client_contact_id, jsonb_build_object('deal_side', upper(p_deal_side), 'retained_by', CASE WHEN upper(p_deal_side)='SELL' THEN 'seller' ELSE 'buyer' END))
    RETURNING id INTO v_contract;
  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_contract, p_client_contact_id, 'CLIENT', true, 1);
  SELECT gd.document_id INTO v_doc FROM generate_document(
    p_client_contact_id, 'HORSE_TRANSACTION_REP', v_contract, p_horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,'is_signer',cp.is_signer,'signer_order',cp.signer_order)) FROM contract_parties cp WHERE cp.contract_id = v_contract),
    NULL::text) gd;

  -- originator = the client (they retain us). This retainer is client-signed
  -- (+ our COMPANY countersign when a signatory is configured) â not a
  -- counterparty-negotiated instrument, so there is no second private party;
  -- the client owns their fields, we own the fee/protection terms ('DEAL').
  UPDATE documents
     SET originator_contact_id = p_client_contact_id,
         workflow_state = 'editable',
         status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

  v_n := seed_contract_fields(v_doc, jsonb_build_array(
    -- ââ CLIENT personal (owned by the CLIENT) ââ
    jsonb_build_object('field_key','CLIENT.FULL_NAME','label','Client Name','section','Client','owner_role','CLIENT','value_type','text','required',true,'sort_order',10),
    jsonb_build_object('field_key','CLIENT.ADDRESS','label','Client Address','section','Client','owner_role','CLIENT','value_type','text','sort_order',11),
    jsonb_build_object('field_key','CLIENT.PHONE','label','Client Phone','section','Client','owner_role','CLIENT','value_type','text','sort_order',12),
    jsonb_build_object('field_key','CLIENT.EMAIL','label','Client Email','section','Client','owner_role','CLIENT','value_type','text','sort_order',13),
    -- ââ Identified horse, if any (the CLIENT describes the target) ââ
    jsonb_build_object('field_key','HORSE.REGISTERED_NAME','label','Registered Name (if identified)','section','Horse (optional)','owner_role','CLIENT','value_type','text','sort_order',20),
    jsonb_build_object('field_key','HORSE.BARN_NAME','label','Barn Name','section','Horse (optional)','owner_role','CLIENT','value_type','text','sort_order',21),
    jsonb_build_object('field_key','HORSE.BREED','label','Breed','section','Horse (optional)','owner_role','CLIENT','value_type','text','sort_order',22),
    jsonb_build_object('field_key','HORSE.CURRENT_LOCATION','label','Current Location','section','Horse (optional)','owner_role','CLIENT','value_type','text','sort_order',23),
    -- ââ Fee / representation terms (owned by 'DEAL' â we set them, client accepts) ââ
    jsonb_build_object('field_key','TXN.REPRESENTATION_FEE','label','Representation Fee','section','Fees','owner_role','DEAL','value_type','currency','required',true,'sort_order',30),
    jsonb_build_object('field_key','TXN.COMMISSION_RATE','label','Commission Rate','section','Fees','owner_role','DEAL','value_type','text','sort_order',31),
    jsonb_build_object('field_key','TXN.COMMISSION_MIN','label','Minimum Commission','section','Fees','owner_role','DEAL','value_type','currency','sort_order',32),
    jsonb_build_object('field_key','TXN.PAYMENT_TERMS','label','Payment Terms','section','Fees','owner_role','DEAL','value_type','longtext','sort_order',33),
    jsonb_build_object('field_key','ENG.PROTECTION_PERIOD','label','Protection Period (months)','section','Terms','owner_role','DEAL','value_type','number','sort_order',34)
  ));

    -- Fill HORSE.* from the horse and CLIENT.* from the selected contact (seed
  -- leaves them empty; the broker starter previously filled neither).
  IF p_horse_id IS NOT NULL THEN PERFORM attach_horse_to_document(v_doc, p_horse_id); END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);
  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract, 'fields_seeded', v_n);
END;
$function$;
