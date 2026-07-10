/*
  # FHE CRM — Purchase & Broker contract instances (generic engine)

  The generic contract-workflow engine (20260705010000) shipped with
  start_lease_contract as its first wired instance. This adds the two remaining
  transaction contracts as convenience RPCs on the SAME engine, modeled exactly
  on start_lease_contract:

  1. start_purchase_contract — the two-party BUYER/SELLER horse purchase & sale.
     Field ownership: BUYER personal → BUYER; SELLER personal + all HORSE.* +
     the seller-disclosure histories → SELLER; all TXN/deal terms → 'DEAL'.
     Reuses create_purchase_engagement (BUYER+SELLER +COMPANY signer) +
     generate_document('HORSE_PURCHASE_SALE'). Originator = the buyer (our
     client), workflow_state=editable, status=AWAITING_SIGNATURE.

  2. start_broker_contract — the transaction-representation RETAINER the client
     signs with COMPANY (us). Unlike lease/purchase this is not a
     counterparty-negotiated instrument: CLIENT retains COMPANY. Field ownership:
     CLIENT personal → CLIENT; the (optional) identified HORSE.* → CLIENT (they
     describe the target); fee/commission/protection terms → 'DEAL' (we set
     them, the client accepts). Reuses create_search_engagement (CLIENT signer +
     a directional stage so DIR.* terms resolve) + generate_document(
     'HORSE_TRANSACTION_REP'). Originator = the client.

  Additive; nothing dropped or modified. Same authorization/ownership rules as
  start_lease_contract (staff-only to start; all field edits flow through
  set_contract_field's ownership matrix; signing via record_signature v6).
*/

-- ============================================================
-- 1. start_purchase_contract — BUYER / SELLER horse purchase & sale
-- ============================================================
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
  v_doc uuid;
  v_n   integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'not authorized to start a purchase contract';
  END IF;

  -- REUSE create_purchase_engagement: BUYER(1) + optional SELLER(2) + COMPANY(99)
  -- signing parties + a PURCHASE transaction (amount/deposit seed the txn).
  v_eng := create_purchase_engagement(p_buyer_contact_id, p_horse_id, p_seller_contact_id, p_amount, p_deposit);

  -- REUSE generate_document('HORSE_PURCHASE_SALE'): fills BUYER.*/SELLER.*/HORSE.*/TXN.*
  SELECT gd.document_id INTO v_doc FROM generate_document(v_eng, 'HORSE_PURCHASE_SALE') gd;

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

  RETURN jsonb_build_object('document_id', v_doc, 'engagement_id', v_eng, 'fields_seeded', v_n);
END;
$fn$;

REVOKE ALL ON FUNCTION start_purchase_contract(uuid, uuid, uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_purchase_contract(uuid, uuid, uuid, numeric, numeric) TO authenticated, service_role;

COMMENT ON FUNCTION start_purchase_contract(uuid, uuid, uuid, numeric, numeric) IS
  'Generic-engine instance: create_purchase_engagement (BUYER+SELLER+COMPANY) → generate_document(''HORSE_PURCHASE_SALE'') → seed_contract_fields with owned fields (BUYER personal→BUYER; SELLER personal + all HORSE.* + disclosure histories→SELLER; all TXN→''DEAL''), originator=buyer. Returns {document_id, engagement_id, fields_seeded}.';

-- ============================================================
-- 2. start_broker_contract — transaction-representation retainer (CLIENT ↔ COMPANY)
-- ============================================================
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
  v_doc uuid;
  v_n   integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'not authorized to start a representation contract';
  END IF;

  -- REUSE create_search_engagement: CLIENT(1) signer + COMPANY(99) + a directional
  -- stage so the HORSE_TRANSACTION_REP DIR.* terms (direction/role/counterparty)
  -- resolve. retained_by = the client's side; deal_side = BUY/SELL.
  v_eng := create_search_engagement(
             p_client_contact_id,
             CASE WHEN upper(p_deal_side) = 'SELL' THEN 'seller' ELSE 'buyer' END,
             upper(p_deal_side),
             p_horse_id);

  -- REUSE generate_document('HORSE_TRANSACTION_REP'): fills CLIENT.*/HORSE.*/TXN.*/DIR.*
  SELECT gd.document_id INTO v_doc FROM generate_document(v_eng, 'HORSE_TRANSACTION_REP') gd;

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

  RETURN jsonb_build_object('document_id', v_doc, 'engagement_id', v_eng, 'fields_seeded', v_n);
END;
$fn$;

REVOKE ALL ON FUNCTION start_broker_contract(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_broker_contract(uuid, text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION start_broker_contract(uuid, text, uuid) IS
  'Generic-engine instance: create_search_engagement (CLIENT signer + directional stage) → generate_document(''HORSE_TRANSACTION_REP'') → seed_contract_fields (CLIENT personal + optional identified HORSE.*→CLIENT; fee/commission/protection→''DEAL''), originator=client. The representation retainer the client signs with COMPANY — client-signed, not counterparty-negotiated. Returns {document_id, engagement_id, fields_seeded}.';
