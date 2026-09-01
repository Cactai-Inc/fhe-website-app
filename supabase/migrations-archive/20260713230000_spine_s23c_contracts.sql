/*
  # Spine Refactor — Slice 2.3c-contracts: start_*_contract create CONTRACTS

  start_lease/purchase/broker_contract now create a top-level `contracts` row +
  `contract_parties` and generate the deal document via the ONE spine generator
  (v11) against that contract, instead of manufacturing an engagement. The
  seed_contract_fields payloads are UNCHANGED (spliced verbatim). Deal docs are
  contact-owned + party-seeded like every other document; the return shape swaps
  engagement_id -> contract_id. create_*_engagement are dropped in S2.3e.
*/

CREATE OR REPLACE FUNCTION start_lease_contract(
  p_lessee_contact_id uuid,
  p_lessor_contact_id uuid DEFAULT NULL,
  p_horse_id          uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_eng  uuid;
  v_contract uuid;
  v_org  uuid;
  v_doc  uuid;
  
  v_n    integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT (has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to start a lease contract';
  END IF;

  SELECT org_id INTO v_org FROM contacts WHERE id = p_lessee_contact_id;
  INSERT INTO contracts (org_id, segment, status, horse_id, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', p_horse_id, p_lessee_contact_id, jsonb_build_object('deal_side','LEASE_IN'))
    RETURNING id INTO v_contract;
  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_contract, p_lessee_contact_id, 'LESSEE', true, 1);
  IF p_lessor_contact_id IS NOT NULL THEN
    INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_contract, p_lessor_contact_id, 'LESSOR', true, 2);
  END IF;
  SELECT gd.document_id INTO v_doc FROM generate_document(
    p_lessee_contact_id, 'HORSE_LEASE', v_contract, p_horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,'is_signer',cp.is_signer,'signer_order',cp.signer_order)) FROM contract_parties cp WHERE cp.contract_id = v_contract),
    NULL::text) gd;

  UPDATE documents
     SET originator_contact_id = p_lessee_contact_id,
         workflow_state = 'editable',
         status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

  v_n := seed_contract_fields(v_doc, jsonb_build_array(
    jsonb_build_object('field_key','LESSEE.FULL_NAME','label','Lessee Name','section','Lessee','owner_role','LESSEE','value_type','text','required',true,'sort_order',10),
    jsonb_build_object('field_key','LESSEE.ADDRESS','label','Lessee Address','section','Lessee','owner_role','LESSEE','value_type','text','sort_order',20),
    jsonb_build_object('field_key','LESSEE.PHONE','label','Lessee Phone','section','Lessee','owner_role','LESSEE','value_type','text','sort_order',30),
    jsonb_build_object('field_key','LESSEE.EMAIL','label','Lessee Email','section','Lessee','owner_role','LESSEE','value_type','text','sort_order',40),
    jsonb_build_object('field_key','LESSEE.PRINTED_NAME','label','Lessee Printed Name','section','Lessee','owner_role','LESSEE','value_type','text','sort_order',50),
    jsonb_build_object('field_key','LESSOR.FULL_NAME','label','Lessor Name','section','Lessor','owner_role','LESSOR','value_type','text','required',true,'sort_order',60),
    jsonb_build_object('field_key','LESSOR.ADDRESS','label','Lessor Address','section','Lessor','owner_role','LESSOR','value_type','text','sort_order',70),
    jsonb_build_object('field_key','LESSOR.PHONE','label','Lessor Phone','section','Lessor','owner_role','LESSOR','value_type','text','sort_order',80),
    jsonb_build_object('field_key','LESSOR.EMAIL','label','Lessor Email','section','Lessor','owner_role','LESSOR','value_type','text','sort_order',90),
    jsonb_build_object('field_key','LESSOR.PRINTED_NAME','label','Lessor Printed Name','section','Lessor','owner_role','LESSOR','value_type','text','sort_order',100),
    jsonb_build_object('field_key','HORSE.REGISTERED_NAME','label','Registered Name','section','Horse','owner_role','LESSOR','value_type','text','required',true,'sort_order',110),
    jsonb_build_object('field_key','HORSE.BARN_NAME','label','Barn Name','section','Horse','owner_role','LESSOR','value_type','text','sort_order',120),
    jsonb_build_object('field_key','HORSE.BREED','label','Breed','section','Horse','owner_role','LESSOR','value_type','text','sort_order',130),
    jsonb_build_object('field_key','HORSE.COLOR','label','Color','section','Horse','owner_role','LESSOR','value_type','text','sort_order',140),
    jsonb_build_object('field_key','HORSE.SEX','label','Sex','section','Horse','owner_role','LESSOR','value_type','text','sort_order',150),
    jsonb_build_object('field_key','HORSE.AGE_DOB','label','Age / Date of Birth','section','Horse','owner_role','LESSOR','value_type','text','sort_order',160),
    jsonb_build_object('field_key','HORSE.REGISTRATION_NUMBER','label','Registration Number','section','Horse','owner_role','LESSOR','value_type','text','sort_order',170),
    jsonb_build_object('field_key','HORSE.MICROCHIP','label','Microchip / ID','section','Horse','owner_role','LESSOR','value_type','text','sort_order',180),
    jsonb_build_object('field_key','HORSE.FAIR_MARKET_VALUE','label','Fair Market Value','section','Horse','owner_role','LESSOR','value_type','currency','sort_order',190),
    jsonb_build_object('field_key','HORSE.CURRENT_LOCATION','label','Current Location','section','Horse','owner_role','LESSOR','value_type','text','sort_order',200),
    jsonb_build_object('field_key','HORSE.VET_NAME','label','Veterinarian Name','section','Horse','owner_role','LESSOR','value_type','text','sort_order',210),
    jsonb_build_object('field_key','HORSE.VET_PHONE','label','Veterinarian Phone','section','Horse','owner_role','LESSOR','value_type','text','sort_order',220),
    jsonb_build_object('field_key','HORSE.FARRIER_NAME','label','Farrier Name','section','Horse','owner_role','LESSOR','value_type','text','sort_order',230),
    jsonb_build_object('field_key','HORSE.FARRIER_PHONE','label','Farrier Phone','section','Horse','owner_role','LESSOR','value_type','text','sort_order',240),
    jsonb_build_object('field_key','TXN.CONDITION_EXCEPTIONS','label','Condition Exceptions','section','Condition & Ownership','owner_role','DEAL','value_type','longtext','sort_order',250),
    jsonb_build_object('field_key','TXN.BEHAVIOR_EXCEPTIONS','label','Behavior Exceptions','section','Condition & Ownership','owner_role','DEAL','value_type','longtext','sort_order',260),
    jsonb_build_object('field_key','TXN.OWNERSHIP_LIMITATIONS','label','Ownership Limitations','section','Condition & Ownership','owner_role','DEAL','value_type','longtext','sort_order',270),
    jsonb_build_object('field_key','TXN.LEASE_TYPE','label','Lease Type','section','Lease Type & Term','owner_role','DEAL','value_type','select','required',true,'sort_order',280),
    jsonb_build_object('field_key','TXN.LEASE_TERM','label','Lease Term','section','Lease Type & Term','owner_role','DEAL','value_type','text','sort_order',290),
    jsonb_build_object('field_key','TXN.LEASE_START','label','Commencement Date','section','Lease Type & Term','owner_role','DEAL','value_type','date','sort_order',300),
    jsonb_build_object('field_key','TXN.LEASE_END','label','Expiration Date','section','Lease Type & Term','owner_role','DEAL','value_type','date','sort_order',310),
    jsonb_build_object('field_key','TXN.RENEWAL_TERMS','label','Renewal Terms','section','Lease Type & Term','owner_role','DEAL','value_type','longtext','sort_order',320),
    jsonb_build_object('field_key','TXN.EVALUATION_START','label','Evaluation Period Start','section','Evaluation Period','owner_role','DEAL','value_type','date','sort_order',330),
    jsonb_build_object('field_key','TXN.EVALUATION_END','label','Evaluation Period End','section','Evaluation Period','owner_role','DEAL','value_type','date','sort_order',340),
    jsonb_build_object('field_key','TXN.PERMITTED_ACTIVITIES','label','Permitted Activities','section','Permitted Use','owner_role','DEAL','value_type','longtext','sort_order',350),
    jsonb_build_object('field_key','TXN.USE_RESTRICTIONS','label','Use Restrictions','section','Permitted Use','owner_role','DEAL','value_type','longtext','sort_order',360),
    jsonb_build_object('field_key','TXN.AUTHORIZED_USERS','label','Authorized Users','section','Permitted Use','owner_role','DEAL','value_type','text','sort_order',370),
    jsonb_build_object('field_key','TXN.RESERVED_DAYS','label','Reserved Days','section','Partial Lease','owner_role','DEAL','value_type','text','sort_order',380),
    jsonb_build_object('field_key','TXN.SHARED_WITH','label','Shared With','section','Partial Lease','owner_role','DEAL','value_type','text','sort_order',390),
    jsonb_build_object('field_key','TXN.LEASE_FEE','label','Lease Fee','section','Payment','owner_role','DEAL','value_type','currency','required',true,'sort_order',400),
    jsonb_build_object('field_key','TXN.PAYMENT_SCHEDULE','label','Payment Schedule','section','Payment','owner_role','DEAL','value_type','text','sort_order',410),
    jsonb_build_object('field_key','TXN.PAYMENT_TERMS','label','Payment Terms','section','Payment','owner_role','DEAL','value_type','longtext','sort_order',420),
    jsonb_build_object('field_key','TXN.LATE_PAYMENT_TERMS','label','Late Payment Terms','section','Payment','owner_role','DEAL','value_type','longtext','sort_order',430),
    jsonb_build_object('field_key','TXN.BOARDING_RESPONSIBILITY','label','Boarding Responsibility','section','Boarding & Care','owner_role','DEAL','value_type','text','sort_order',440),
    jsonb_build_object('field_key','TXN.CARE_RESPONSIBILITY','label','Routine Care Responsibility','section','Boarding & Care','owner_role','DEAL','value_type','text','sort_order',450),
    jsonb_build_object('field_key','TXN.SUPPLEMENTS','label','Supplements','section','Boarding & Care','owner_role','DEAL','value_type','longtext','sort_order',460),
    jsonb_build_object('field_key','TXN.SUPPLEMENTS_RESPONSIBILITY','label','Supplements Responsibility','section','Boarding & Care','owner_role','DEAL','value_type','text','sort_order',470),
    jsonb_build_object('field_key','TXN.ROUTINE_VET_RESPONSIBILITY','label','Routine Vet Responsibility','section','Vet & Farrier','owner_role','DEAL','value_type','text','sort_order',480),
    jsonb_build_object('field_key','TXN.EMERGENCY_VET_RESPONSIBILITY','label','Emergency Vet Responsibility','section','Vet & Farrier','owner_role','DEAL','value_type','text','sort_order',490),
    jsonb_build_object('field_key','TXN.FARRIER_RESPONSIBILITY','label','Farrier Responsibility','section','Vet & Farrier','owner_role','DEAL','value_type','text','sort_order',500),
    jsonb_build_object('field_key','TXN.VET_AUTH_CONTACT','label','Vet Authorization Contact','section','Vet & Farrier','owner_role','DEAL','value_type','text','sort_order',510),
    jsonb_build_object('field_key','TXN.TRAINING_TERMS','label','Training Terms','section','Training & Lessons','owner_role','DEAL','value_type','longtext','sort_order',520),
    jsonb_build_object('field_key','TXN.LESSON_TERMS','label','Lesson Terms','section','Training & Lessons','owner_role','DEAL','value_type','longtext','sort_order',530),
    jsonb_build_object('field_key','TXN.PROTECTIVE_EQUIPMENT','label','Protective Equipment','section','Equipment & Tack','owner_role','DEAL','value_type','longtext','sort_order',540),
    jsonb_build_object('field_key','TXN.PROTECTIVE_EQUIPMENT_PROVIDER','label','Protective Equipment Provider','section','Equipment & Tack','owner_role','DEAL','value_type','text','sort_order',550),
    jsonb_build_object('field_key','TXN.TACK_TERMS','label','Tack Terms','section','Equipment & Tack','owner_role','DEAL','value_type','longtext','sort_order',560),
    jsonb_build_object('field_key','TXN.LESSOR_EQUIPMENT','label','Equipment Provided by Lessor','section','Equipment & Tack','owner_role','DEAL','value_type','longtext','sort_order',570),
    jsonb_build_object('field_key','TXN.LESSEE_EQUIPMENT','label','Equipment Provided by Lessee','section','Equipment & Tack','owner_role','DEAL','value_type','longtext','sort_order',580),
    jsonb_build_object('field_key','TXN.BOARD_COST','label','Board Cost Allocation','section','Cost Allocation','owner_role','DEAL','value_type','text','sort_order',590),
    jsonb_build_object('field_key','TXN.TRAINING_COST','label','Training Cost Allocation','section','Cost Allocation','owner_role','DEAL','value_type','text','sort_order',600),
    jsonb_build_object('field_key','TXN.LESSONS_COST','label','Lessons Cost Allocation','section','Cost Allocation','owner_role','DEAL','value_type','text','sort_order',610),
    jsonb_build_object('field_key','TXN.SUPPLEMENTS_COST','label','Supplements Cost Allocation','section','Cost Allocation','owner_role','DEAL','value_type','text','sort_order',620),
    jsonb_build_object('field_key','TXN.FARRIER_COST','label','Farrier Cost Allocation','section','Cost Allocation','owner_role','DEAL','value_type','text','sort_order',630),
    jsonb_build_object('field_key','TXN.ROUTINE_VET_COST','label','Routine Vet Cost Allocation','section','Cost Allocation','owner_role','DEAL','value_type','text','sort_order',640),
    jsonb_build_object('field_key','TXN.NON_ROUTINE_VET_COST','label','Non-Routine Vet Cost Allocation','section','Cost Allocation','owner_role','DEAL','value_type','text','sort_order',650),
    jsonb_build_object('field_key','TXN.OTHER_CARE_COST','label','Other Care Cost Allocation','section','Cost Allocation','owner_role','DEAL','value_type','text','sort_order',660),
    jsonb_build_object('field_key','TXN.OTHER_EXPENSES_COST','label','Other Expenses Cost Allocation','section','Cost Allocation','owner_role','DEAL','value_type','text','sort_order',670),
    jsonb_build_object('field_key','TXN.MORTALITY_INSURANCE_COST','label','Mortality Insurance Cost','section','Insurance','owner_role','DEAL','value_type','text','sort_order',680),
    jsonb_build_object('field_key','TXN.MORTALITY_INSURANCE_PARTY','label','Mortality Insurance Responsible Party','section','Insurance','owner_role','DEAL','value_type','text','sort_order',690),
    jsonb_build_object('field_key','TXN.MAJOR_MEDICAL_INSURANCE_COST','label','Major Medical Insurance Cost','section','Insurance','owner_role','DEAL','value_type','text','sort_order',700),
    jsonb_build_object('field_key','TXN.MAJOR_MEDICAL_INSURANCE_PARTY','label','Major Medical Insurance Responsible Party','section','Insurance','owner_role','DEAL','value_type','text','sort_order',710),
    jsonb_build_object('field_key','TXN.LOSS_OF_USE_INSURANCE_COST','label','Loss of Use Insurance Cost','section','Insurance','owner_role','DEAL','value_type','text','sort_order',720),
    jsonb_build_object('field_key','TXN.LOSS_OF_USE_INSURANCE_PARTY','label','Loss of Use Insurance Responsible Party','section','Insurance','owner_role','DEAL','value_type','text','sort_order',730),
    jsonb_build_object('field_key','TXN.COMPETITION_TERMS','label','Competition Terms','section','Competition','owner_role','DEAL','value_type','longtext','sort_order',740),
    jsonb_build_object('field_key','TXN.COMPETITION_EXPENSES','label','Competition Expenses','section','Competition','owner_role','DEAL','value_type','text','sort_order',750),
    jsonb_build_object('field_key','TXN.COMPETITION_WINNINGS','label','Competition Winnings','section','Competition','owner_role','DEAL','value_type','text','sort_order',760),
    jsonb_build_object('field_key','TXN.RISK_ALLOCATION','label','Risk of Loss Allocation','section','Risk & Termination','owner_role','DEAL','value_type','longtext','sort_order',770),
    jsonb_build_object('field_key','TXN.PROHIBITED_ACTIVITIES','label','Prohibited Activities','section','Risk & Termination','owner_role','DEAL','value_type','longtext','sort_order',780),
    jsonb_build_object('field_key','TXN.TERMINATION_TERMS','label','Termination Terms','section','Risk & Termination','owner_role','DEAL','value_type','longtext','sort_order',790)
  ));

  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract, 'fields_seeded', v_n);
END;
$fn$;

REVOKE ALL ON FUNCTION start_lease_contract(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_lease_contract(uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION start_purchase_contract(
  p_buyer_contact_id  uuid,
  p_seller_contact_id uuid DEFAULT NULL,
  p_horse_id          uuid DEFAULT NULL,
  p_amount            numeric DEFAULT NULL,
  p_deposit           numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
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
  --   BUYER personal → BUYER
  --   SELLER personal + all HORSE.* + seller-disclosure histories → SELLER
  --   all TXN / deal terms → 'DEAL'
  v_n := seed_contract_fields(v_doc, jsonb_build_array(
    -- ── BUYER personal (owned by the BUYER) ──
    jsonb_build_object('field_key','BUYER.FULL_NAME','label','Buyer Name','section','Buyer','owner_role','BUYER','value_type','text','required',true,'sort_order',10),
    jsonb_build_object('field_key','BUYER.ADDRESS','label','Buyer Address','section','Buyer','owner_role','BUYER','value_type','text','sort_order',11),
    jsonb_build_object('field_key','BUYER.PHONE','label','Buyer Phone','section','Buyer','owner_role','BUYER','value_type','text','sort_order',12),
    jsonb_build_object('field_key','BUYER.EMAIL','label','Buyer Email','section','Buyer','owner_role','BUYER','value_type','text','sort_order',13),
    -- ── SELLER personal (owned by the SELLER) ──
    jsonb_build_object('field_key','SELLER.FULL_NAME','label','Seller Name','section','Seller','owner_role','SELLER','value_type','text','required',true,'sort_order',20),
    jsonb_build_object('field_key','SELLER.ADDRESS','label','Seller Address','section','Seller','owner_role','SELLER','value_type','text','sort_order',21),
    jsonb_build_object('field_key','SELLER.PHONE','label','Seller Phone','section','Seller','owner_role','SELLER','value_type','text','sort_order',22),
    jsonb_build_object('field_key','SELLER.EMAIL','label','Seller Email','section','Seller','owner_role','SELLER','value_type','text','sort_order',23),
    -- ── HORSE.* (owned by the SELLER — the current owner) ──
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
    -- ── Seller disclosure histories (the SELLER represents these) ──
    jsonb_build_object('field_key','HORSE.TRAINING_HISTORY','label','Training History','section','Seller Disclosures','owner_role','SELLER','value_type','longtext','sort_order',41),
    jsonb_build_object('field_key','HORSE.COMPETITION_HISTORY','label','Competition History','section','Seller Disclosures','owner_role','SELLER','value_type','longtext','sort_order',42),
    jsonb_build_object('field_key','HORSE.MEDICAL_HISTORY','label','Medical History','section','Seller Disclosures','owner_role','SELLER','value_type','longtext','sort_order',43),
    jsonb_build_object('field_key','HORSE.BEHAVIORAL_HISTORY','label','Behavioral History','section','Seller Disclosures','owner_role','SELLER','value_type','longtext','sort_order',44),
    jsonb_build_object('field_key','HORSE.MEDICATION_HISTORY','label','Medication History','section','Seller Disclosures','owner_role','SELLER','value_type','longtext','sort_order',45),
    -- ── TXN / DEAL terms (owned by 'DEAL' — originator sets, counterparty negotiates) ──
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
  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract, 'fields_seeded', v_n);
END;
$fn$;

REVOKE ALL ON FUNCTION start_purchase_contract(uuid, uuid, uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_purchase_contract(uuid, uuid, uuid, numeric, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION start_broker_contract(
  p_client_contact_id uuid,
  p_deal_side         text DEFAULT 'BUY',   -- BUY | SELL (the side we represent)
  p_horse_id          uuid DEFAULT NULL      -- optional: an already-identified target
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
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
  -- (+ our COMPANY countersign when a signatory is configured) — not a
  -- counterparty-negotiated instrument, so there is no second private party;
  -- the client owns their fields, we own the fee/protection terms ('DEAL').
  UPDATE documents
     SET originator_contact_id = p_client_contact_id,
         workflow_state = 'editable',
         status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

  v_n := seed_contract_fields(v_doc, jsonb_build_array(
    -- ── CLIENT personal (owned by the CLIENT) ──
    jsonb_build_object('field_key','CLIENT.FULL_NAME','label','Client Name','section','Client','owner_role','CLIENT','value_type','text','required',true,'sort_order',10),
    jsonb_build_object('field_key','CLIENT.ADDRESS','label','Client Address','section','Client','owner_role','CLIENT','value_type','text','sort_order',11),
    jsonb_build_object('field_key','CLIENT.PHONE','label','Client Phone','section','Client','owner_role','CLIENT','value_type','text','sort_order',12),
    jsonb_build_object('field_key','CLIENT.EMAIL','label','Client Email','section','Client','owner_role','CLIENT','value_type','text','sort_order',13),
    -- ── Identified horse, if any (the CLIENT describes the target) ──
    jsonb_build_object('field_key','HORSE.REGISTERED_NAME','label','Registered Name (if identified)','section','Horse (optional)','owner_role','CLIENT','value_type','text','sort_order',20),
    jsonb_build_object('field_key','HORSE.BARN_NAME','label','Barn Name','section','Horse (optional)','owner_role','CLIENT','value_type','text','sort_order',21),
    jsonb_build_object('field_key','HORSE.BREED','label','Breed','section','Horse (optional)','owner_role','CLIENT','value_type','text','sort_order',22),
    jsonb_build_object('field_key','HORSE.CURRENT_LOCATION','label','Current Location','section','Horse (optional)','owner_role','CLIENT','value_type','text','sort_order',23),
    -- ── Fee / representation terms (owned by 'DEAL' — we set them, client accepts) ──
    jsonb_build_object('field_key','TXN.REPRESENTATION_FEE','label','Representation Fee','section','Fees','owner_role','DEAL','value_type','currency','required',true,'sort_order',30),
    jsonb_build_object('field_key','TXN.COMMISSION_RATE','label','Commission Rate','section','Fees','owner_role','DEAL','value_type','text','sort_order',31),
    jsonb_build_object('field_key','TXN.COMMISSION_MIN','label','Minimum Commission','section','Fees','owner_role','DEAL','value_type','currency','sort_order',32),
    jsonb_build_object('field_key','TXN.PAYMENT_TERMS','label','Payment Terms','section','Fees','owner_role','DEAL','value_type','longtext','sort_order',33),
    jsonb_build_object('field_key','ENG.PROTECTION_PERIOD','label','Protection Period (months)','section','Terms','owner_role','DEAL','value_type','number','sort_order',34)
  ));

  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract, 'fields_seeded', v_n);
END;
$fn$;

REVOKE ALL ON FUNCTION start_broker_contract(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_broker_contract(uuid, text, uuid) TO authenticated, service_role;
