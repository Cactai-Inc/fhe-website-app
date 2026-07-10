-- SPEC E — full-granularity lease field seed. start_lease_contract v2: same
-- engagement/generation/originator flow as v1 (20260705010000), the seed payload
-- rewritten to the standardized template's COMPLETE field set — every non-SIG,
-- non-DOC token has exactly one seeded field (79 fields: 5 LESSEE, 5 LESSOR
-- incl. PRINTED_NAME [reconciled: present in the template, absent from the spec
-- list], 14 HORSE [LESSOR-owned], 55 DEAL terms). required gates lock:
-- LESSEE.FULL_NAME, LESSOR.FULL_NAME, HORSE.REGISTERED_NAME, TXN.LEASE_TYPE,
-- TXN.LEASE_FEE (owner-confirmed set). Cost/insurance *_COST hold the composed
-- phrase ("Lessee 100%" / "Lessor 60% / Lessee 40%") the app writes (E.3).
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
  v_doc  uuid;
  v_org  uuid;
  v_n    integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT (has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to start a lease contract';
  END IF;

  v_eng := create_lease_engagement(p_lessee_contact_id, 'LEASE_IN', p_horse_id, p_lessor_contact_id);
  SELECT gd.document_id INTO v_doc FROM generate_document(v_eng, 'HORSE_LEASE') gd;
  SELECT org_id INTO v_org FROM documents WHERE id = v_doc;

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

  RETURN jsonb_build_object('document_id', v_doc, 'engagement_id', v_eng, 'fields_seeded', v_n);
END;
$fn$;

REVOKE ALL ON FUNCTION start_lease_contract(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_lease_contract(uuid, uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION start_lease_contract(uuid, uuid, uuid) IS
  'v2 (spec E): create_lease_engagement -> generate_document(HORSE_LEASE) -> seed the standardized template''s complete 79-field set (LESSEE/LESSOR personal incl. printed names; all HORSE.* LESSOR-owned; all TXN.* DEAL). Required: both FULL_NAMEs, HORSE.REGISTERED_NAME, TXN.LEASE_TYPE, TXN.LEASE_FEE.';
