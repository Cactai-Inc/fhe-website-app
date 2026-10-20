-- Disclosure reciprocity, phase 9: on execution, write disclosure content the author
-- entered into the horse record so it is never lost and the next contract inherits it.
-- Only the empty-record case can carry new text (when the record already has entries,
-- the content is read-only and record-fed). No visible provenance is stored — the
-- information simply becomes part of the record. An unsigned contract never runs this.

DO $wb$
DECLARE
  v_def text;
  v_old text := $q$  END IF;

  RETURN NEW;
END;$q$;
  v_new text := $q$  END IF;

  -- Disclosure writeback (contract -> record). For each narrative section, if the
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
  END IF;

  RETURN NEW;
END;$q$;
BEGIN
  SELECT pg_get_functiondef('public.apply_contract_execution_effects'::regproc) INTO v_def;
  IF position('Disclosure writeback (contract -> record)' IN v_def) > 0 THEN RETURN; END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'apply_contract_execution_effects RETURN anchor not found';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $wb$;
