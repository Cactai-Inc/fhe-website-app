-- Disclosure reciprocity, phase 7: the seven disclosure sections on the Bill of Sale,
-- rebuilt in place (0 documents). Each section additionally gated to STANDALONE mode
-- (TXN.BOS_HAS_SALE_AGREEMENT = NO); when a sale agreement accompanies the BOS it
-- still defers to that agreement via BOS_WARRANTY.CONDITION_XREF. Person and horse
-- injuries become two independent sections (was one "person or animal" clause).
-- Also copy the sale's inherent-risk assumption and reciprocal seller release so the
-- standalone BOS stands on its own.

DO $bos$
DECLARE
  v_tpl text := 'HORSE_BILL_OF_SALE';
  v_sec text := 'BOS_DISCLOSURES';
  r record;
  v_sort int := 100;  -- past the existing encumbrances block (<=70)
  v_help text;
  v_standalone jsonb := jsonb_build_object('equals', jsonb_build_array('NO'), 'field_key', 'TXN.BOS_HAS_SALE_AGREEMENT');
  v_sections jsonb := $j$[
    {"k":"KNOWN_CONDITIONS","gate":"KNOWN_CONDITIONS_GATE","tok":"KNOWN_CONDITIONS",
     "none":"To Seller's knowledge, there is no material information regarding the Horse's medical conditions, lameness history, surgeries, allergies, medications, behavioral issues, vices, or prior veterinary concerns to disclose as of the date of this Bill of Sale.",
     "disc":"Seller has disclosed to Buyer all known material information regarding the Horse's medical conditions (ongoing or episodic), lameness, allergies, vices, and prior veterinary concerns, as follows: {{HORSE.KNOWN_CONDITIONS}}. Seller represents that these disclosures are true and complete to Seller's knowledge as of the date of this Bill of Sale.",
     "label":"Known conditions"},
    {"k":"MEDICAL_HISTORY","gate":"MEDICAL_HISTORY_GATE","tok":"MEDICAL_HISTORY",
     "none":"To Seller's knowledge, the Horse has no medical history (treatments, surgeries, or ongoing monitoring) to disclose as of the date of this Bill of Sale.",
     "disc":"Seller discloses the Horse's medical history (treatments past and ongoing), with all known information relating to date, type, description, and status: {{HORSE.MEDICAL_HISTORY}}.",
     "label":"Medical history"},
    {"k":"BEHAVIORAL_HISTORY","gate":"BEHAVIORAL_HISTORY_GATE","tok":"BEHAVIORAL_HISTORY",
     "none":"Seller represents that, to Seller's knowledge, the Horse has no behavioral concerns to disclose as of the date of this Bill of Sale.",
     "disc":"Seller discloses the following behavioral concerns, with all known information relating to description, trigger, and how long observed: {{HORSE.BEHAVIORAL_HISTORY}}.",
     "label":"Behavioral concerns"},
    {"k":"INJURIES_TO_HUMANS","gate":"INJURIES_TO_HUMANS_GATE","tok":"INJURIES_TO_HUMANS",
     "none":"Seller represents that, to Seller''s knowledge, no person has suffered serious injury proximately caused by the direct actions of the Horse, including biting, kicking, striking, bucking, rearing, bolting, crushing, or throwing a rider. This representation does not extend to any incident caused primarily by a third party or an external stimulus — such as another horse or rider being at fault, a loose dog, wildlife, a vehicle, or a similar external provocation — where the Horse''s reaction was within the range of normal equine behavior.",
     "disc":"Seller discloses that one or more persons have suffered serious injury involving the direct actions of the Horse, with all known information relating to date, whether the person was riding, description, and outcome: {{HORSE.INJURIES_TO_HUMANS}}. Buyer acknowledges this disclosure and proceeds with knowledge of it.",
     "label":"Injuries to humans"},
    {"k":"INJURIES_TO_HORSE","gate":"INJURIES_TO_HORSE_GATE","tok":"INJURIES_TO_HORSE",
     "none":"Seller represents that, to Seller''s knowledge, the Horse has not experienced any serious injury.",
     "disc":"Seller discloses the following injuries the Horse has experienced, with all known information relating to date of occurrence, description, outcome, and current status: {{HORSE.INJURIES_TO_HORSE}}.",
     "label":"Injuries to the horse"},
    {"k":"MEDICATIONS","gate":"MEDICATIONS_GATE","tok":"MEDICATIONS",
     "none":"Seller represents that, to Seller's knowledge, the Horse is on no medications as of the date of this Bill of Sale.",
     "disc":"Seller discloses the following medications, with all known information relating to name, dosage, instructions, and conditions of use: {{HORSE.MEDICATIONS}}.",
     "label":"Medications"},
    {"k":"SUPPLEMENTS","gate":"SUPPLEMENTS_GATE","tok":"SUPPLEMENTS",
     "none":"Seller represents that, to Seller's knowledge, the Horse is on no supplements as of the date of this Bill of Sale.",
     "disc":"Seller discloses the following supplements, with all known information relating to name, dosage, instructions, and conditions of use: {{HORSE.SUPPLEMENTS}}.",
     "label":"Supplements"}
  ]$j$::jsonb;
BEGIN
  -- Remove the old omnibus health / behavior / combined person-or-animal injury clauses.
  DELETE FROM contract_field_defs WHERE template_key=v_tpl
    AND (clause_key IN ('BOS_DISCLOSURES.HEALTH','BOS_DISCLOSURES.INJURY_NONE','BOS_DISCLOSURES.INJURY_DISCLOSED','BOS_DISCLOSURES.BEHAVIOR')
         OR field_key IN ('TXN.KNOWN_CONDITIONS','TXN.INJURY_HISTORY','TXN.INJURY_HISTORY_DETAILS'));
  DELETE FROM contract_clause_defs WHERE template_key=v_tpl
    AND clause_key IN ('BOS_DISCLOSURES.HEALTH','BOS_DISCLOSURES.BEHAVIOR','BOS_DISCLOSURES.INJURY_NONE','BOS_DISCLOSURES.INJURY_DISCLOSED','BOS_DISCLOSURES.INJURY_PENDING');

  v_help := ' If this relates to anything in the other disclosure sections (Known conditions, Medical history, Behavior, Medications, Supplements, Injuries to the horse, Injuries to humans), mention it in the description — for example a medication the horse takes because of an injury.';

  FOR r IN SELECT e FROM jsonb_array_elements(v_sections) e LOOP
    v_sort := v_sort + 5;
    -- gate: standalone AND answered yes/no
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (v_tpl, v_sec, 'BOS_'||(r.e->>'k')||'_GATE', NULL, '', 'input', v_sort, false, v_standalone, false);
    INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, options, required, is_optional, format_type, clause_key, conditional_on, guidance)
    VALUES (v_tpl, 'HORSE.'||(r.e->>'gate'), (r.e->>'label')||' — anything to disclose?', v_sec, 'SELLER', 'select', 'select',
            '[{"label":"Yes","value":"YES"},{"label":"No","value":"NO"}]'::jsonb, true, false, 'select', 'BOS_'||(r.e->>'k')||'_GATE',
            v_standalone,
            'Set automatically from the horse record: Yes and locked when the record has entries in this section; answerable here only when the record has none.');
    -- none (standalone AND gate NO)
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (v_tpl, v_sec, 'BOS_'||(r.e->>'k')||'_NONE', NULL, r.e->>'none', 'input', v_sort+1, false,
            jsonb_build_object('all', jsonb_build_array(v_standalone, jsonb_build_object('equals', jsonb_build_array('NO'), 'field_key', 'HORSE.'||(r.e->>'gate')))), false);
    -- disclosed (standalone AND gate YES)
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (v_tpl, v_sec, 'BOS_'||(r.e->>'k')||'_DISCLOSED', NULL, r.e->>'disc', 'input', v_sort+2, false,
            jsonb_build_object('all', jsonb_build_array(v_standalone, jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key', 'HORSE.'||(r.e->>'gate')))), false);
    INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, guidance)
    VALUES (v_tpl, 'HORSE.'||(r.e->>'tok'), r.e->>'label', v_sec, 'SELLER', 'longtext', 'text', false, true, 'longtext',
            'BOS_'||(r.e->>'k')||'_DISCLOSED',
            jsonb_build_object('all', jsonb_build_array(v_standalone, jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key', 'HORSE.'||(r.e->>'gate')))),
            'Imported from the horse record.'||v_help);
  END LOOP;

  -- Standalone strength: copy the sale's inherent-risk assumption + reciprocal seller
  -- release into the BOS, gated to standalone mode.
  INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
  SELECT v_tpl, 'BOS_RELEASE', 'BOS_RISK.ASSUMPTION_INHERENT', c.heading, c.body, c.clause_type, 5, false, v_standalone, c.render_as_subitem
    FROM contract_clause_defs c WHERE c.template_key='HORSE_SALE_V3' AND c.clause_key='RISK.ASSUMPTION_INHERENT'
  ON CONFLICT DO NOTHING;
  INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
  SELECT v_tpl, 'BOS_RELEASE', 'BOS_RELEASE.SELLER', c.heading, c.body, c.clause_type, 25,
         false,
         jsonb_build_object('all', jsonb_build_array(v_standalone, jsonb_build_object('equals', jsonb_build_array('INCLUDED'), 'field_key', 'TXN.BOS_RELEASE_ELECTION'))),
         c.render_as_subitem
    FROM contract_clause_defs c WHERE c.template_key='HORSE_SALE_V3' AND c.clause_key='RISK.RELEASE_SELLER'
  ON CONFLICT DO NOTHING;
END $bos$;
