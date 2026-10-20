-- Disclosure reciprocity, phase 4: horse_field_token_value resolves each disclosure
-- section from the record via its composer, and resolves a per-section HAS-ENTRIES
-- gate ('YES' when the record section holds entries, else 'NO') that the contract
-- gate locks onto. These feed the HORSE.* disclosure tokens on the v3 clauses; the
-- existing attach/sync machinery fills them generically (every HORSE.% field).

DO $t$
DECLARE
  v_def text;
  v_old text := $q$    WHEN 'MEDICATION_NAME'         THEN horse_medications_prose(v_horse.id, 'MEDICATION')
    WHEN 'MEDICATION_DOSAGE'       THEN ''
    WHEN 'MEDICATION_INSTRUCTIONS' THEN ''
    WHEN 'MEDICATION_ADDITIONAL'   THEN ''
    WHEN 'KNOWN_CONDITIONS'        THEN horse_list_prose(v_horse.known_conditions_list, 'condition')
    WHEN 'TRAINING_HISTORY'        THEN horse_list_prose(v_horse.training_history_list, 'entry')
    WHEN 'COMPETITION_HISTORY'     THEN horse_list_prose(v_horse.competition_history_list, 'entry')
    WHEN 'MEDICAL_HISTORY'         THEN horse_list_prose(v_horse.medical_history_list, 'summary')
    WHEN 'BEHAVIORAL_HISTORY'      THEN horse_list_prose(v_horse.behavioral_history_list, 'concern')
    WHEN 'INJURIES_TO_HUMANS'      THEN horse_injuries_prose(v_horse.injuries_to_humans)
    WHEN 'MEDICATION_HISTORY'      THEN horse_medications_prose(v_horse.id, 'MEDICATION')$q$;
  v_new text := $q$    -- Disclosure sections (record -> contract). Prose from the structured lists.
    WHEN 'KNOWN_CONDITIONS'        THEN horse_conditions_prose(v_horse.known_conditions_list)
    WHEN 'MEDICAL_HISTORY'         THEN horse_medical_prose(v_horse.medical_history_list)
    WHEN 'BEHAVIORAL_HISTORY'      THEN horse_behavior_prose(v_horse.behavioral_history_list)
    WHEN 'INJURIES_TO_HUMANS'      THEN horse_injuries_humans_prose(v_horse.injuries_to_humans)
    WHEN 'INJURIES_TO_HORSE'       THEN horse_injuries_horse_prose(v_horse.injuries_to_horse)
    WHEN 'MEDICATIONS'             THEN horse_meds_prose_v2(v_horse.id, 'MEDICATION')
    WHEN 'SUPPLEMENTS'             THEN horse_meds_prose_v2(v_horse.id, 'SUPPLEMENT')
    WHEN 'TRAINING_HISTORY'        THEN horse_list_prose(v_horse.training_history_list, 'entry')
    WHEN 'COMPETITION_HISTORY'     THEN horse_list_prose(v_horse.competition_history_list, 'entry')
    WHEN 'MEDICATION_NAME'         THEN horse_meds_prose_v2(v_horse.id, 'MEDICATION')
    WHEN 'MEDICATION_HISTORY'      THEN horse_meds_prose_v2(v_horse.id, 'MEDICATION')
    WHEN 'MEDICATION_DOSAGE'       THEN ''
    WHEN 'MEDICATION_INSTRUCTIONS' THEN ''
    WHEN 'MEDICATION_ADDITIONAL'   THEN ''
    -- Per-section HAS-ENTRIES gate: 'YES' when the record section holds entries.
    WHEN 'KNOWN_CONDITIONS_GATE'   THEN CASE WHEN jsonb_array_length(coalesce(v_horse.known_conditions_list,'[]'::jsonb))>0 THEN 'YES' ELSE 'NO' END
    WHEN 'MEDICAL_HISTORY_GATE'    THEN CASE WHEN jsonb_array_length(coalesce(v_horse.medical_history_list,'[]'::jsonb))>0 THEN 'YES' ELSE 'NO' END
    WHEN 'BEHAVIORAL_HISTORY_GATE' THEN CASE WHEN jsonb_array_length(coalesce(v_horse.behavioral_history_list,'[]'::jsonb))>0 THEN 'YES' ELSE 'NO' END
    WHEN 'INJURIES_TO_HUMANS_GATE' THEN CASE WHEN jsonb_array_length(coalesce(v_horse.injuries_to_humans,'[]'::jsonb))>0 THEN 'YES' ELSE 'NO' END
    WHEN 'INJURIES_TO_HORSE_GATE'  THEN CASE WHEN jsonb_array_length(coalesce(v_horse.injuries_to_horse,'[]'::jsonb))>0 THEN 'YES' ELSE 'NO' END
    WHEN 'MEDICATIONS_GATE'        THEN CASE WHEN EXISTS(SELECT 1 FROM horse_medications m WHERE m.horse_id=v_horse.id AND m.kind='MEDICATION' AND m.deleted_at IS NULL) THEN 'YES' ELSE 'NO' END
    WHEN 'SUPPLEMENTS_GATE'        THEN CASE WHEN EXISTS(SELECT 1 FROM horse_medications m WHERE m.horse_id=v_horse.id AND m.kind='SUPPLEMENT' AND m.deleted_at IS NULL) THEN 'YES' ELSE 'NO' END$q$;
BEGIN
  SELECT pg_get_functiondef('public.horse_field_token_value(horses,text)'::regprocedure) INTO v_def;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'horse_field_token_value disclosure-branch anchor not found';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $t$;
