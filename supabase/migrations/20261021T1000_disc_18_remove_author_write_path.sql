-- Disclosure rebuild, phase 18: remove the retired author-write path entirely.
--
-- The horse record is the only place disclosure content is written; the contract
-- imports and never writes back. This drops everything built for the contract-side
-- authoring path: the ADD.<SECTION> fields and their clauses on all three v3
-- templates, the disc_med structured composer and its branch, and the execution
-- write-back. It also reverts the phase-17 is_optional flip on the DISCLOSED
-- clauses (the rebuilt model needs them to show whenever the gate is yes, including
-- yes-with-no-entries). No live document carries an ADD.* field value (verified),
-- so nothing stored is affected.

-- 1. ADD author fields + their clauses (all three templates). The author-write
--    path produced two families of keys: the ADD.<SECTION> content fields
--    (prefix "ADD.") and the *_DISCLOSED_ADD continuation clauses. Remove BOTH,
--    and any other clause or field keyed with a trailing "_ADD" on the three
--    templates (owner, corrections round 2 — e.g. HORSE.MEDICAL_HISTORY_DISCLOSED_ADD
--    and HORSE.MEDICATIONS_DISCLOSED_ADD), so nothing of the retired path survives.
DELETE FROM contract_field_defs  WHERE field_key  LIKE 'ADD.%';
DELETE FROM contract_field_defs  WHERE template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
                                   AND field_key  LIKE '%\_ADD';
DELETE FROM contract_clause_defs WHERE template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
                                   AND clause_key LIKE '%\_ADD';

-- 2. Revert the phase-17 is_optional flip on the DISCLOSED content clauses.
UPDATE contract_clause_defs SET is_optional = false
 WHERE template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
   AND clause_key LIKE '%\_DISCLOSED'
   AND clause_key NOT LIKE '%\_DISCLOSED\_ADD'
   AND clause_type = 'input';

-- 3. Remove the disc_med branch from compose_field_prose, then drop the composer.
DO $cfp$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.compose_field_prose(text,jsonb,text,text)'::regprocedure) INTO v_def;
  IF position('disc_med' IN v_def) > 0 THEN
    v_def := replace(v_def,
      E'    WHEN \'med_schedule\' THEN v_out := compose_med_schedule(s);\n    WHEN \'disc_med\' THEN v_out := compose_disc_med(s);',
      E'    WHEN \'med_schedule\' THEN v_out := compose_med_schedule(s);');
    EXECUTE v_def;
  END IF;
END $cfp$;
DROP FUNCTION IF EXISTS public.compose_disc_med(jsonb);

-- 4. Remove the execution-time write-back block from apply_contract_execution_effects.
DO $wb$
DECLARE
  v_def text;
  v_old text := $q$  -- Disclosure writeback (contract -> record): authored additions become record
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
  IF position('Disclosure writeback (contract -> record)' IN v_def) = 0 THEN RETURN; END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'apply_contract_execution_effects writeback block not found';
  END IF;
  EXECUTE replace(v_def, v_old, '');
END $wb$;
