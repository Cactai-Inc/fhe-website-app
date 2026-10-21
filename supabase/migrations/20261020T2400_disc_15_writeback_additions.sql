-- Disclosure reciprocity, phase 15: execution writeback follows the ADD fields.
--
-- Replaces phase 9's writeback. The content tokens (HORSE.<SECTION>) are read-only
-- imports of the record and never carry author input, so writing them back was both
-- a no-op on a populated record and unreachable on an empty one (nothing can type
-- into a read-only, record-fed field). Authored content now lives in the ADD fields
-- (phases 13-14), and those are what flow to the record at execution:
--   * narrative sections: ADD.<SECTION> text -> append one {description: text} entry
--     to the record list, ALWAYS (whether the record already had entries or not).
--   * medications / supplements: each structured ADD item -> one horse_medications
--     row carrying its name, dosage, instructions, and conditions of use.
-- An unsigned contract never reaches this trigger, so nothing is written until the
-- agreement is executed. No provenance is recorded — the content becomes part of the
-- record exactly as if entered there.

DO $wb$
DECLARE
  v_def text;
  v_old text := $q$  -- Disclosure writeback (contract -> record). For each narrative section, if the
  -- contract disclosed content and the record section is still empty, add one entry
  -- carrying that text as its description. Gate 'YES' with text is the signal.
  IF v_horse IS NOT NULL THEN
    UPDATE horses h SET known_conditions_list = known_conditions_list ||
        jsonb_build_array(jsonb_build_object('description', nullif(btrim(v_fields->>'HORSE.KNOWN_CONDITIONS'),'')))
      WHERE h.id = v_horse
        AND nullif(btrim(v_fields->>'HORSE.KNOWN_CONDITIONS'),'') IS NOT NULL
        AND jsonb_array_length(coalesce(h.known_conditions_list,'[]'::jsonb)) = 0;
    UPDATE horses h SET medical_history_list = medical_history_list ||
        jsonb_build_array(jsonb_build_object('description', nullif(btrim(v_fields->>'HORSE.MEDICAL_HISTORY'),'')))
      WHERE h.id = v_horse
        AND nullif(btrim(v_fields->>'HORSE.MEDICAL_HISTORY'),'') IS NOT NULL
        AND jsonb_array_length(coalesce(h.medical_history_list,'[]'::jsonb)) = 0;
    UPDATE horses h SET behavioral_history_list = behavioral_history_list ||
        jsonb_build_array(jsonb_build_object('description', nullif(btrim(v_fields->>'HORSE.BEHAVIORAL_HISTORY'),'')))
      WHERE h.id = v_horse
        AND nullif(btrim(v_fields->>'HORSE.BEHAVIORAL_HISTORY'),'') IS NOT NULL
        AND jsonb_array_length(coalesce(h.behavioral_history_list,'[]'::jsonb)) = 0;
    UPDATE horses h SET injuries_to_humans = injuries_to_humans ||
        jsonb_build_array(jsonb_build_object('description', nullif(btrim(v_fields->>'HORSE.INJURIES_TO_HUMANS'),'')))
      WHERE h.id = v_horse
        AND nullif(btrim(v_fields->>'HORSE.INJURIES_TO_HUMANS'),'') IS NOT NULL
        AND jsonb_array_length(coalesce(h.injuries_to_humans,'[]'::jsonb)) = 0;
    UPDATE horses h SET injuries_to_horse = injuries_to_horse ||
        jsonb_build_array(jsonb_build_object('description', nullif(btrim(v_fields->>'HORSE.INJURIES_TO_HORSE'),'')))
      WHERE h.id = v_horse
        AND nullif(btrim(v_fields->>'HORSE.INJURIES_TO_HORSE'),'') IS NOT NULL
        AND jsonb_array_length(coalesce(h.injuries_to_horse,'[]'::jsonb)) = 0;
    -- Medications / supplements are library-backed; add one row carrying the disclosed
    -- text as the name when the record has none of that kind yet.
    INSERT INTO horse_medications (org_id, horse_id, kind, name)
    SELECT NEW.org_id, v_horse, 'MEDICATION', nullif(btrim(v_fields->>'HORSE.MEDICATIONS'),'')
      WHERE nullif(btrim(v_fields->>'HORSE.MEDICATIONS'),'') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM horse_medications m WHERE m.horse_id=v_horse AND m.kind='MEDICATION' AND m.deleted_at IS NULL);
    INSERT INTO horse_medications (org_id, horse_id, kind, name)
    SELECT NEW.org_id, v_horse, 'SUPPLEMENT', nullif(btrim(v_fields->>'HORSE.SUPPLEMENTS'),'')
      WHERE nullif(btrim(v_fields->>'HORSE.SUPPLEMENTS'),'') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM horse_medications m WHERE m.horse_id=v_horse AND m.kind='SUPPLEMENT' AND m.deleted_at IS NULL);
  END IF;$q$;
  v_new text := $q$  -- Disclosure writeback (contract -> record): authored additions become record
  -- entries. ADD.<SECTION> holds what the author added on the contract (new item or
  -- more detail); each non-empty one is appended as a new entry, regardless of what
  -- the record already held. Meds/supplements come from the structured ADD fields and
  -- land as proper horse_medications rows.
  IF v_horse IS NOT NULL THEN
    UPDATE horses h SET known_conditions_list = coalesce(known_conditions_list,'[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object('description', nullif(btrim(v_fields->>'ADD.KNOWN_CONDITIONS'),'')))
      WHERE h.id = v_horse AND nullif(btrim(v_fields->>'ADD.KNOWN_CONDITIONS'),'') IS NOT NULL;
    UPDATE horses h SET medical_history_list = coalesce(medical_history_list,'[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object('description', nullif(btrim(v_fields->>'ADD.MEDICAL_HISTORY'),'')))
      WHERE h.id = v_horse AND nullif(btrim(v_fields->>'ADD.MEDICAL_HISTORY'),'') IS NOT NULL;
    UPDATE horses h SET behavioral_history_list = coalesce(behavioral_history_list,'[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object('description', nullif(btrim(v_fields->>'ADD.BEHAVIORAL_HISTORY'),'')))
      WHERE h.id = v_horse AND nullif(btrim(v_fields->>'ADD.BEHAVIORAL_HISTORY'),'') IS NOT NULL;
    UPDATE horses h SET injuries_to_humans = coalesce(injuries_to_humans,'[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object('description', nullif(btrim(v_fields->>'ADD.INJURIES_TO_HUMANS'),'')))
      WHERE h.id = v_horse AND nullif(btrim(v_fields->>'ADD.INJURIES_TO_HUMANS'),'') IS NOT NULL;
    UPDATE horses h SET injuries_to_horse = coalesce(injuries_to_horse,'[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object('description', nullif(btrim(v_fields->>'ADD.INJURIES_TO_HORSE'),'')))
      WHERE h.id = v_horse AND nullif(btrim(v_fields->>'ADD.INJURIES_TO_HORSE'),'') IS NOT NULL;

    -- Meds / supplements: read the structured ADD values straight from the fields
    -- (v_fields holds only the composed text) and write one row per item.
    INSERT INTO horse_medications (org_id, horse_id, kind, name, dosage, instructions, conditions_of_use)
    SELECT NEW.org_id, v_horse,
           CASE WHEN cf.field_key = 'ADD.SUPPLEMENTS' THEN 'SUPPLEMENT' ELSE 'MEDICATION' END,
           nullif(btrim(it->>'name'),''), nullif(btrim(it->>'dosage'),''),
           nullif(btrim(it->>'instructions'),''), nullif(btrim(it->>'conditions_of_use'),'')
      FROM contract_fields cf
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(cf.structured->'discMeds','[]'::jsonb)) it
     WHERE cf.document_id = NEW.id
       AND cf.field_key IN ('ADD.MEDICATIONS','ADD.SUPPLEMENTS')
       AND nullif(btrim(it->>'name'),'') IS NOT NULL;
  END IF;$q$;
BEGIN
  SELECT pg_get_functiondef('public.apply_contract_execution_effects'::regproc) INTO v_def;
  IF position('ADD.KNOWN_CONDITIONS' IN v_def) > 0 THEN RETURN; END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'apply_contract_execution_effects phase-9 writeback block not found';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $wb$;
