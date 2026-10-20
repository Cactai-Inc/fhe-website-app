-- Disclosure reciprocity, phase 6: the seven disclosure sections on HORSE_LEASE_V3,
-- in Lessor voice. The lease was thin (a soundness warranty + free-text exceptions +
-- person-injury); it is brought up to parity with the sale. Keep the HORSE.BEHAVIOR
-- and HORSE.CONDITION soundness WARRANTIES; retire the free-text _EXC exceptions and
-- the old person-injury/pending clauses and the old CARE.SUPPLEMENTS (TXN.MEDICATIONS).

DO $lease$
DECLARE
  v_tpl text := 'HORSE_LEASE_V3';
  v_sec text := 'HORSE';
  r record;
  v_sort int := 45;
  v_help text;
  v_sections jsonb := $j$[
    {"k":"KNOWN_CONDITIONS","gate":"KNOWN_CONDITIONS_GATE","tok":"KNOWN_CONDITIONS",
     "none":"To Lessor's knowledge, there is no material information regarding the Horse's medical conditions, lameness history, surgeries, allergies, medications, behavioral issues, vices, or prior veterinary concerns to disclose as of the Effective Date.",
     "disc":"Lessor has disclosed to Lessee all known material information regarding the Horse's medical conditions (ongoing or episodic), lameness, allergies, vices, and prior veterinary concerns, as follows: {{HORSE.KNOWN_CONDITIONS}}. Lessor represents that these disclosures are true and complete to Lessor's knowledge as of the Effective Date.",
     "label":"Known conditions"},
    {"k":"MEDICAL_HISTORY","gate":"MEDICAL_HISTORY_GATE","tok":"MEDICAL_HISTORY",
     "none":"To Lessor's knowledge, the Horse has no medical history (treatments, surgeries, or ongoing monitoring) to disclose as of the Effective Date.",
     "disc":"Lessor discloses the Horse's medical history (treatments past and ongoing), with all known information relating to date, type, description, and status: {{HORSE.MEDICAL_HISTORY}}.",
     "label":"Medical history"},
    {"k":"BEHAVIORAL_HISTORY","gate":"BEHAVIORAL_HISTORY_GATE","tok":"BEHAVIORAL_HISTORY",
     "none":"Lessor represents that, to Lessor's knowledge, the Horse has no behavioral concerns to disclose as of the Effective Date.",
     "disc":"Lessor discloses the following behavioral concerns, with all known information relating to description, trigger, and how long observed: {{HORSE.BEHAVIORAL_HISTORY}}.",
     "label":"Behavioral concerns"},
    {"k":"INJURIES_TO_HUMANS","gate":"INJURIES_TO_HUMANS_GATE","tok":"INJURIES_TO_HUMANS",
     "none":"Lessor represents that, to Lessor''s knowledge, no person has suffered serious injury proximately caused by the direct actions of the Horse, including biting, kicking, striking, bucking, rearing, bolting, crushing, or throwing a rider. This representation does not extend to any incident caused primarily by a third party or an external stimulus — such as another horse or rider being at fault, a loose dog, wildlife, a vehicle, or a similar external provocation — where the Horse''s reaction was within the range of normal equine behavior.",
     "disc":"Lessor discloses that one or more persons have suffered serious injury involving the direct actions of the Horse, with all known information relating to date, whether the person was riding, description, and outcome: {{HORSE.INJURIES_TO_HUMANS}}. Lessee acknowledges this disclosure and proceeds with knowledge of it.",
     "label":"Injuries to humans"},
    {"k":"INJURIES_TO_HORSE","gate":"INJURIES_TO_HORSE_GATE","tok":"INJURIES_TO_HORSE",
     "none":"Lessor represents that, to Lessor''s knowledge, the Horse has not experienced any serious injury.",
     "disc":"Lessor discloses the following injuries the Horse has experienced, with all known information relating to date of occurrence, description, outcome, and current status: {{HORSE.INJURIES_TO_HORSE}}.",
     "label":"Injuries to the horse"},
    {"k":"MEDICATIONS","gate":"MEDICATIONS_GATE","tok":"MEDICATIONS",
     "none":"Lessor represents that, to Lessor's knowledge, the Horse is on no medications as of the Effective Date.",
     "disc":"Lessor discloses the following medications, with all known information relating to name, dosage, instructions, and conditions of use: {{HORSE.MEDICATIONS}}.",
     "label":"Medications"},
    {"k":"SUPPLEMENTS","gate":"SUPPLEMENTS_GATE","tok":"SUPPLEMENTS",
     "none":"Lessor represents that, to Lessor's knowledge, the Horse is on no supplements as of the Effective Date.",
     "disc":"Lessor discloses the following supplements, with all known information relating to name, dosage, instructions, and conditions of use: {{HORSE.SUPPLEMENTS}}.",
     "label":"Supplements"}
  ]$j$::jsonb;
BEGIN
  -- Retire the thin disclosure bits (keep HORSE.BEHAVIOR + HORSE.CONDITION warranties).
  DELETE FROM contract_field_defs WHERE template_key=v_tpl
    AND (clause_key IN ('HORSE.BEHAVIOR_EXC','HORSE.CONDITION_EXC','HORSE.INJURY_HISTORY_NONE','HORSE.INJURY_HISTORY_DISCLOSED','CARE.SUPPLEMENTS')
         OR field_key IN ('TXN.BEHAVIOR_EXCEPTIONS','TXN.CONDITION_EXCEPTIONS','TXN.INJURY_HISTORY','TXN.INJURY_HISTORY_DETAILS','TXN.MEDICATIONS','TXN.BEHAVIOR_HAS_EXCEPTIONS','TXN.CONDITION_HAS_EXCEPTIONS'));
  DELETE FROM contract_clause_defs WHERE template_key=v_tpl
    AND clause_key IN ('HORSE.BEHAVIOR_EXC','HORSE.CONDITION_EXC','HORSE.INJURY_HISTORY_PENDING','HORSE.INJURY_HISTORY_NONE','HORSE.INJURY_HISTORY_DISCLOSED','CARE.SUPPLEMENTS');

  v_help := ' If this relates to anything in the other disclosure sections (Known conditions, Medical history, Behavior, Medications, Supplements, Injuries to the horse, Injuries to humans), mention it in the description — for example a medication the horse takes because of an injury.';

  FOR r IN SELECT e FROM jsonb_array_elements(v_sections) e LOOP
    v_sort := v_sort + 5;
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (v_tpl, v_sec, 'HORSE.'||(r.e->>'k')||'_GATE', NULL, '', 'input', v_sort, false, NULL, false);
    INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, options, required, is_optional, format_type, clause_key, guidance)
    VALUES (v_tpl, 'HORSE.'||(r.e->>'gate'), (r.e->>'label')||' — anything to disclose?', v_sec, 'LESSOR', 'select', 'select',
            '[{"label":"Yes","value":"YES"},{"label":"No","value":"NO"}]'::jsonb, true, false, 'select', 'HORSE.'||(r.e->>'k')||'_GATE',
            'Set automatically from the horse record: Yes and locked when the record has entries in this section; answerable here only when the record has none.');
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (v_tpl, v_sec, 'HORSE.'||(r.e->>'k')||'_NONE', NULL, r.e->>'none', 'input', v_sort+1, false,
            jsonb_build_object('equals', jsonb_build_array('NO'), 'field_key', 'HORSE.'||(r.e->>'gate')), false);
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (v_tpl, v_sec, 'HORSE.'||(r.e->>'k')||'_DISCLOSED', NULL, r.e->>'disc', 'input', v_sort+2, false,
            jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key', 'HORSE.'||(r.e->>'gate')), false);
    INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, guidance)
    VALUES (v_tpl, 'HORSE.'||(r.e->>'tok'), r.e->>'label', v_sec, 'LESSOR', 'longtext', 'text', false, true, 'longtext',
            'HORSE.'||(r.e->>'k')||'_DISCLOSED',
            jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key', 'HORSE.'||(r.e->>'gate')),
            'Imported from the horse record.'||v_help);
  END LOOP;
END $lease$;
