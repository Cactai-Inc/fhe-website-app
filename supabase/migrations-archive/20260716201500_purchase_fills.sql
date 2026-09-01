-- start_purchase_contract now attaches the horse AND fills BUYER/SELLER fields.
CREATE OR REPLACE FUNCTION public.start_purchase_contract(p_buyer_contact_id uuid, p_seller_contact_id uuid DEFAULT NULL::uuid, p_horse_id uuid DEFAULT NULL::uuid, p_amount numeric DEFAULT NULL::numeric, p_deposit numeric DEFAULT NULL::numeric)
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
    RAISE EXCEPTION 'not authorized to start a purchase contract';
  END IF;

  -- signing parties + a PURCHASE transaction (amount/deposit seed the txn).
  SELECT org_id INTO v_org FROM contacts WHERE id = p_buyer_contact_id;
  INSERT INTO contracts (org_id, segment, status, horse_id, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', p_horse_id, p_buyer_contact_id, jsonb_build_object('deal_side','PURCHASE'))
    RETURNING id INTO v_contract;
  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_contract, p_buyer_contact_id, 'BUYER', true, 1);
  IF p_seller_contact_id IS NOT NULL THEN
    INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_contract, p_seller_contact_id, 'SELLER', true, 2);
  END IF;
  SELECT gd.document_id INTO v_doc FROM generate_document(
    p_buyer_contact_id, 'HORSE_PURCHASE_SALE', v_contract, p_horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,'is_signer',cp.is_signer,'signer_order',cp.signer_order)) FROM contract_parties cp WHERE cp.contract_id = v_contract),
    NULL::text) gd;

  -- originator = the buyer ("our client"); editable workflow.
  UPDATE documents
     SET originator_contact_id = p_buyer_contact_id,
         workflow_state = 'editable',
         status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

  -- Seed the structured, party-OWNED fields (HORSE_PURCHASE_SALE.md tokens).
  --   BUYER personal â BUYER
  --   SELLER personal + all HORSE.* + seller-disclosure histories â SELLER
  --   all TXN / deal terms â 'DEAL'
  v_n := seed_contract_fields(v_doc, jsonb_build_array(
    -- ââ BUYER personal (owned by the BUYER) ââ
    jsonb_build_object('field_key','BUYER.FULL_NAME','label','Buyer Name','section','Buyer','owner_role','BUYER','value_type','text','required',true,'sort_order',10),
    jsonb_build_object('field_key','BUYER.ADDRESS','label','Buyer Address','section','Buyer','owner_role','BUYER','value_type','text','sort_order',11),
    jsonb_build_object('field_key','BUYER.PHONE','label','Buyer Phone','section','Buyer','owner_role','BUYER','value_type','text','sort_order',12),
    jsonb_build_object('field_key','BUYER.EMAIL','label','Buyer Email','section','Buyer','owner_role','BUYER','value_type','text','sort_order',13),
    -- ââ SELLER personal (owned by the SELLER) ââ
    jsonb_build_object('field_key','SELLER.FULL_NAME','label','Seller Name','section','Seller','owner_role','SELLER','value_type','text','required',true,'sort_order',20),
    jsonb_build_object('field_key','SELLER.ADDRESS','label','Seller Address','section','Seller','owner_role','SELLER','value_type','text','sort_order',21),
    jsonb_build_object('field_key','SELLER.PHONE','label','Seller Phone','section','Seller','owner_role','SELLER','value_type','text','sort_order',22),
    jsonb_build_object('field_key','SELLER.EMAIL','label','Seller Email','section','Seller','owner_role','SELLER','value_type','text','sort_order',23),
    -- ââ HORSE.* (owned by the SELLER â the current owner) ââ
    jsonb_build_object('field_key','HORSE.REGISTERED_NAME','label','Registered Name','section','Horse','owner_role','SELLER','value_type','text','required',true,'sort_order',30),
    jsonb_build_object('field_key','HORSE.BARN_NAME','label','Barn Name','section','Horse','owner_role','SELLER','value_type','text','sort_order',31),
    jsonb_build_object('field_key','HORSE.BREED','label','Breed','section','Horse','owner_role','SELLER','value_type','text','sort_order',32),
    jsonb_build_object('field_key','HORSE.COLOR','label','Color','section','Horse','owner_role','SELLER','value_type','text','sort_order',33),
    jsonb_build_object('field_key','HORSE.SEX','label','Sex','section','Horse','owner_role','SELLER','value_type','text','sort_order',34),
    jsonb_build_object('field_key','HORSE.AGE_DOB','label','Age / DOB','section','Horse','owner_role','SELLER','value_type','text','sort_order',35),
    jsonb_build_object('field_key','HORSE.HEIGHT','label','Height','section','Horse','owner_role','SELLER','value_type','text','sort_order',36),
    jsonb_build_object('field_key','HORSE.REGISTRATION_NUMBER','label','Registration Number','section','Horse','owner_role','SELLER','value_type','text','sort_order',37),
    jsonb_build_object('field_key','HORSE.MICROCHIP','label','Microchip / ID','section','Horse','owner_role','SELLER','value_type','text','sort_order',38),
    jsonb_build_object('field_key','HORSE.CURRENT_LOCATION','label','Current Location','section','Horse','owner_role','SELLER','value_type','text','sort_order',39),
    jsonb_build_object('field_key','HORSE.VET_NAME','label','Veterinarian','section','Horse','owner_role','SELLER','value_type','text','sort_order',40),
    -- ââ Seller disclosure histories (the SELLER represents these) ââ
    jsonb_build_object('field_key','HORSE.TRAINING_HISTORY','label','Training History','section','Seller Disclosures','owner_role','SELLER','value_type','longtext','sort_order',41),
    jsonb_build_object('field_key','HORSE.COMPETITION_HISTORY','label','Competition History','section','Seller Disclosures','owner_role','SELLER','value_type','longtext','sort_order',42),
    jsonb_build_object('field_key','HORSE.MEDICAL_HISTORY','label','Medical History','section','Seller Disclosures','owner_role','SELLER','value_type','longtext','sort_order',43),
    jsonb_build_object('field_key','HORSE.BEHAVIORAL_HISTORY','label','Behavioral History','section','Seller Disclosures','owner_role','SELLER','value_type','longtext','sort_order',44),
    jsonb_build_object('field_key','HORSE.MEDICATION_HISTORY','label','Medication History','section','Seller Disclosures','owner_role','SELLER','value_type','longtext','sort_order',45),
    -- ââ TXN / DEAL terms (owned by 'DEAL' â originator sets, counterparty negotiates) ââ
    jsonb_build_object('field_key','TXN.PURCHASE_PRICE','label','Purchase Price','section','Price & Payment','owner_role','DEAL','value_type','currency','required',true,'sort_order',50),
    jsonb_build_object('field_key','TXN.DEPOSIT_AMOUNT','label','Deposit Amount','section','Price & Payment','owner_role','DEAL','value_type','currency','sort_order',51),
    jsonb_build_object('field_key','TXN.DEPOSIT_TERMS','label','Deposit Terms','section','Price & Payment','owner_role','DEAL','value_type','longtext','sort_order',52),
    jsonb_build_object('field_key','TXN.BALANCE_DUE','label','Balance Due','section','Price & Payment','owner_role','DEAL','value_type','currency','sort_order',53),
    jsonb_build_object('field_key','TXN.PAYMENT_TERMS','label','Payment Terms','section','Price & Payment','owner_role','DEAL','value_type','longtext','sort_order',54),
    jsonb_build_object('field_key','TXN.PAYMENT_METHOD','label','Payment Method','section','Price & Payment','owner_role','DEAL','value_type','text','sort_order',55),
    jsonb_build_object('field_key','TXN.TRANSFER_CONDITION','label','Ownership Transfers Upon','section','Transfer','owner_role','DEAL','value_type','longtext','sort_order',56),
    jsonb_build_object('field_key','TXN.DELIVERY_DATE','label','Delivery Date','section','Delivery','owner_role','DEAL','value_type','date','sort_order',57),
    jsonb_build_object('field_key','TXN.DELIVERY_LOCATION','label','Delivery Location','section','Delivery','owner_role','DEAL','value_type','text','sort_order',58),
    jsonb_build_object('field_key','TXN.TRANSPORT_RESPONSIBILITY','label','Transportation Responsibility','section','Delivery','owner_role','DEAL','value_type','text','sort_order',59),
    jsonb_build_object('field_key','TXN.RISK_TRANSFER','label','Risk of Loss Transfers','section','Delivery','owner_role','DEAL','value_type','text','sort_order',60),
    jsonb_build_object('field_key','TXN.PPE_STATUS','label','Pre-Purchase Exam Status','section','Pre-Purchase Exam','owner_role','DEAL','value_type','text','sort_order',61),
    jsonb_build_object('field_key','TXN.PPE_DATE','label','Examination Date','section','Pre-Purchase Exam','owner_role','DEAL','value_type','date','sort_order',62),
    jsonb_build_object('field_key','TXN.TRIAL_PERIOD','label','Trial Period','section','Trial','owner_role','DEAL','value_type','text','sort_order',63),
    jsonb_build_object('field_key','TXN.TRIAL_TERMS','label','Trial Terms','section','Trial','owner_role','DEAL','value_type','longtext','sort_order',64),
    jsonb_build_object('field_key','TXN.TRIAL_RISK_PARTY','label','Trial Risk Party','section','Trial','owner_role','DEAL','value_type','text','sort_order',65),
    jsonb_build_object('field_key','TXN.TRIAL_CARE_PARTY','label','Trial Care Party','section','Trial','owner_role','DEAL','value_type','text','sort_order',66),
    jsonb_build_object('field_key','TXN.WARRANTIES','label','Seller Warranties','section','Warranties','owner_role','DEAL','value_type','longtext','sort_order',67),
    jsonb_build_object('field_key','TXN.DOCUMENTS_TRANSFERRED','label','Documents Transferred','section','Documents & Equipment','owner_role','DEAL','value_type','longtext','sort_order',68),
    jsonb_build_object('field_key','TXN.EQUIPMENT_INCLUDED','label','Included Equipment','section','Documents & Equipment','owner_role','DEAL','value_type','longtext','sort_order',69),
    jsonb_build_object('field_key','TXN.EQUIPMENT_EXCLUDED','label','Excluded Equipment','section','Documents & Equipment','owner_role','DEAL','value_type','longtext','sort_order',70),
    jsonb_build_object('field_key','TXN.ADDITIONAL_DISCLOSURES','label','Additional Disclosures','section','Seller Disclosures','owner_role','DEAL','value_type','longtext','sort_order',71),
    jsonb_build_object('field_key','TXN.DEFAULT_TERMS','label','Default Terms','section','Default','owner_role','DEAL','value_type','longtext','sort_order',72)
  ));

  IF p_amount IS NOT NULL THEN UPDATE contract_fields SET value = p_amount::text WHERE document_id = v_doc AND field_key = 'TXN.PURCHASE_PRICE'; END IF;
  IF p_deposit IS NOT NULL THEN UPDATE contract_fields SET value = p_deposit::text WHERE document_id = v_doc AND field_key = 'TXN.DEPOSIT_AMOUNT'; END IF;
    -- Fill HORSE.* from the attached horse and BUYER.*/SELLER.* from the selected
  -- contacts (seed leaves them empty; nothing filled them before).
  IF p_horse_id IS NOT NULL THEN PERFORM attach_horse_to_document(v_doc, p_horse_id); END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);
  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract, 'fields_seeded', v_n);
END;
$function$;
