-- Disclosure reciprocity, phase 5: author the seven disclosure sections on HORSE_SALE_V3.
-- Replaces the single omnibus disclosure + person-injury block with seven uniform,
-- record-fed sections (known conditions, medical history, behavior, injuries to humans,
-- injuries to the horse, medications, supplements). Each: a yes/no gate (value derived
-- from the record via HORSE.*_GATE; author-answerable only when the record is empty),
-- a NONE clause (shown on NO), a DISCLOSED clause (shown on YES, fed by a HORSE.* token),
-- and a PENDING placeholder that blocks signing until answered.

DO $sale$
DECLARE
  v_tpl text := 'HORSE_SALE_V3';
  v_sec text := 'HORSE';
  r record;
  v_sort int := 40;  -- the disclosure block starts here (behavior warranty sits at 40 today)
  -- each section: concept key, gate token, content token, gate field key,
  -- none body, disclosed body, description-field label + helper
  v_sections jsonb := $j$[
    {"k":"KNOWN_CONDITIONS","gate":"KNOWN_CONDITIONS_GATE","tok":"KNOWN_CONDITIONS",
     "none":"To Seller's knowledge, there is no material information regarding the Horse's medical conditions, lameness history, surgeries, allergies, medications, behavioral issues, vices, or prior veterinary concerns to disclose as of the Effective Date. Seller shall promptly disclose any material change arising before Closing.",
     "disc":"Seller has disclosed to Buyer all known material information regarding the Horse's medical conditions (ongoing or episodic), lameness, allergies, vices, and prior veterinary concerns, as follows: {{HORSE.KNOWN_CONDITIONS}}. Seller warrants that these disclosures are true and complete to Seller's knowledge as of the Effective Date, and shall promptly disclose any material change arising before Closing.",
     "label":"Known conditions"},
    {"k":"MEDICAL_HISTORY","gate":"MEDICAL_HISTORY_GATE","tok":"MEDICAL_HISTORY",
     "none":"To Seller's knowledge, the Horse has no medical history (treatments, surgeries, or ongoing monitoring) to disclose as of the Effective Date.",
     "disc":"Seller discloses the Horse's medical history (treatments past and ongoing), with all known information relating to date, type, description, and status: {{HORSE.MEDICAL_HISTORY}}.",
     "label":"Medical history"},
    {"k":"BEHAVIORAL_HISTORY","gate":"BEHAVIORAL_HISTORY_GATE","tok":"BEHAVIORAL_HISTORY",
     "none":"Seller represents that, to Seller's knowledge, the Horse has no behavioral concerns to disclose as of the Effective Date.",
     "disc":"Seller discloses the following behavioral concerns, with all known information relating to description, trigger, and how long observed: {{HORSE.BEHAVIORAL_HISTORY}}.",
     "label":"Behavioral concerns"},
    {"k":"INJURIES_TO_HUMANS","gate":"INJURIES_TO_HUMANS_GATE","tok":"INJURIES_TO_HUMANS",
     "none":"Seller represents that, to Seller''s knowledge, no person has suffered serious injury proximately caused by the direct actions of the Horse, including biting, kicking, striking, bucking, rearing, bolting, crushing, or throwing a rider. This representation does not extend to any incident caused primarily by a third party or an external stimulus — such as another horse or rider being at fault, a loose dog, wildlife, a vehicle, or a similar external provocation — where the Horse''s reaction was within the range of normal equine behavior.",
     "disc":"Seller discloses that one or more persons have suffered serious injury involving the direct actions of the Horse, with all known information relating to date, whether the person was riding, description, and outcome: {{HORSE.INJURIES_TO_HUMANS}}.",
     "label":"Injuries to humans"},
    {"k":"INJURIES_TO_HORSE","gate":"INJURIES_TO_HORSE_GATE","tok":"INJURIES_TO_HORSE",
     "none":"Seller represents that, to Seller''s knowledge, the Horse has not experienced any serious injury.",
     "disc":"Seller discloses the following injuries the Horse has experienced, with all known information relating to date of occurrence, description, outcome, and current status: {{HORSE.INJURIES_TO_HORSE}}.",
     "label":"Injuries to the horse"},
    {"k":"MEDICATIONS","gate":"MEDICATIONS_GATE","tok":"MEDICATIONS",
     "none":"Seller represents that, to Seller's knowledge, the Horse is on no medications as of the Effective Date.",
     "disc":"Seller discloses the following medications, with all known information relating to name, dosage, instructions, and conditions of use: {{HORSE.MEDICATIONS}}.",
     "label":"Medications"},
    {"k":"SUPPLEMENTS","gate":"SUPPLEMENTS_GATE","tok":"SUPPLEMENTS",
     "none":"Seller represents that, to Seller's knowledge, the Horse is on no supplements as of the Effective Date.",
     "disc":"Seller discloses the following supplements, with all known information relating to name, dosage, instructions, and conditions of use: {{HORSE.SUPPLEMENTS}}.",
     "label":"Supplements"}
  ]$j$::jsonb;
  v_help text;
BEGIN
  -- Remove the old omnibus disclosure + person-injury block on v3 (clauses + their fields).
  DELETE FROM contract_field_defs WHERE template_key=v_tpl
    AND (clause_key IN ('HORSE.DISCLOSURES','HORSE.DISCLOSURES_GATE','HORSE.DISCLOSURES_NONE','HORSE.INJURY_GATE','HORSE.INJURY_HISTORY_NONE','HORSE.INJURY_HISTORY_DISCLOSED')
         OR field_key IN ('TXN.KNOWN_CONDITIONS','TXN.HAS_DISCLOSURES','TXN.INJURY_HISTORY','TXN.INJURY_HISTORY_DETAILS'));
  DELETE FROM contract_clause_defs WHERE template_key=v_tpl
    AND clause_key IN ('HORSE.DISCLOSURES','HORSE.DISCLOSURES_GATE','HORSE.DISCLOSURES_NONE','HORSE.INJURY_GATE','HORSE.INJURY_HISTORY_NONE','HORSE.INJURY_HISTORY_DISCLOSED','HORSE.INJURY_HISTORY_PENDING');

  v_help := ' If this relates to anything in the other disclosure sections (Known conditions, Medical history, Behavior, Medications, Supplements, Injuries to the horse, Injuries to humans), mention it in the description — for example a medication the horse takes because of an injury.';

  FOR r IN SELECT e FROM jsonb_array_elements(v_sections) e LOOP
    v_sort := v_sort + 5;
    -- GATE clause (empty body carrier) + its yes/no field, value derived from the record.
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (v_tpl, v_sec, 'HORSE.'||(r.e->>'k')||'_GATE', NULL, '', 'input', v_sort, false, NULL, false);
    INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, options, required, is_optional, format_type, clause_key, default_value, guidance)
    VALUES (v_tpl, 'HORSE.'||(r.e->>'gate'), (r.e->>'label')||' — anything to disclose?', v_sec, 'SELLER', 'select', 'select',
            '[{"label":"Yes","value":"YES"},{"label":"No","value":"NO"}]'::jsonb, true, false, 'select', 'HORSE.'||(r.e->>'k')||'_GATE', NULL,
            'Set automatically from the horse record: Yes and locked when the record has entries in this section; answerable here only when the record has none.');

    -- NONE clause (shown when gate = NO)
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (v_tpl, v_sec, 'HORSE.'||(r.e->>'k')||'_NONE', NULL, r.e->>'none', 'input', v_sort+1, false,
            jsonb_build_object('equals', jsonb_build_array('NO'), 'field_key', 'HORSE.'||(r.e->>'gate')), false);

    -- DISCLOSED clause (shown when gate = YES), fed by the record token; its content field
    -- carries the helper text and is the record-sourced read-only import.
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (v_tpl, v_sec, 'HORSE.'||(r.e->>'k')||'_DISCLOSED', NULL, r.e->>'disc', 'input', v_sort+2, false,
            jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key', 'HORSE.'||(r.e->>'gate')), false);
    INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, guidance)
    VALUES (v_tpl, 'HORSE.'||(r.e->>'tok'), r.e->>'label', v_sec, 'SELLER', 'longtext', 'text', false, true, 'longtext',
            'HORSE.'||(r.e->>'k')||'_DISCLOSED',
            jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key', 'HORSE.'||(r.e->>'gate')),
            'Imported from the horse record.'||v_help);
    -- No PENDING placeholder: the gate field is required, so contract_lock_blockers'
    -- required_fields rule blocks signing until it is answered (same as the v2 sale).
  END LOOP;
END $sale$;
