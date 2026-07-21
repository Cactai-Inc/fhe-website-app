-- HORSE_LEASE_V2 review fixes (2026-07-21, second pass).

-- 0. clause_condition_met gains `all` (AND) support: { "all": [ cond, cond, … ] }
--    passes only when EVERY sub-condition passes. Each sub-condition is a normal
--    { field_key, equals|contains } shape. Existing single-condition shapes are
--    unchanged. (The empty string "" in an equals list matches an unset field.)
CREATE OR REPLACE FUNCTION public.clause_condition_met(p_cond jsonb, v_fields jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key   text;
  v_raw   text;
  v_have  text[];
  v_v     jsonb;
  v_sub   jsonb;
BEGIN
  IF p_cond IS NULL THEN RETURN true; END IF;

  -- composite AND: every sub-condition must hold
  IF p_cond ? 'all' THEN
    FOR v_sub IN SELECT * FROM jsonb_array_elements(p_cond -> 'all') LOOP
      IF NOT clause_condition_met(v_sub, v_fields) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;

  v_key := p_cond ->> 'field_key';
  IF v_key IS NULL THEN RETURN true; END IF;
  v_raw := coalesce(v_fields ->> v_key, '');

  IF p_cond ? 'equals' THEN
    IF p_cond -> 'equals' ? v_raw THEN RETURN true; END IF;
  END IF;

  IF p_cond ? 'contains' THEN
    IF jsonb_typeof(to_jsonb(v_raw)) = 'array' THEN
      v_have := ARRAY(SELECT jsonb_array_elements_text(v_raw::jsonb));
    ELSE
      v_have := ARRAY(SELECT btrim(x) FROM regexp_split_to_table(v_raw, ',') x WHERE btrim(x) <> '');
    END IF;
    FOR v_v IN SELECT * FROM jsonb_array_elements(p_cond -> 'contains') LOOP
      IF (v_v #>> '{}') = ANY (v_have) THEN RETURN true; END IF;
    END LOOP;
  END IF;

  RETURN false;
END;
$function$;

-- 1. Horse identity: remove the microchip/passport yes-no flag fields. They were
--    orphan-rendering under the identity block; only the numbers are kept.
DELETE FROM contract_field_defs
 WHERE template_key='HORSE_LEASE_V2' AND field_key IN ('HORSE.MICROCHIP_HAS','HORSE.PASSPORT_HAS');

-- 2. Ownership limitations → yes/no gate; the text field only when Yes.
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.HAS_OWNERSHIP_LIMITS', 'Any limitations on ownership?', 'HORSE', 'LESSOR',
   'yesno', 'text', 'Choose Yes only if there are liens, encumbrances, or other limitations to describe.',
   false, false, 5, 'yesno', 'HORSE.OWNERSHIP');
UPDATE contract_clause_defs
   SET body = 'Lessor warrants that Lessor is the sole lawful and registered owner of Horse, owns Horse free of liens and encumbrances, and has all requisite rights and powers to enter into this Agreement. Are there any limitations on ownership? {{TXN.HAS_OWNERSHIP_LIMITS}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.OWNERSHIP';
-- the limitations text moves to a gated follow-on clause
UPDATE contract_field_defs SET clause_key='HORSE.OWNERSHIP_LIMITS', label='Ownership limitations'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.OWNERSHIP_LIMITATIONS';
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'HORSE', 'HORSE.OWNERSHIP_LIMITS', NULL,
   'Limitations on ownership: {{TXN.OWNERSHIP_LIMITATIONS}}.',
   'input', 42, false, '{"field_key": "TXN.HAS_OWNERSHIP_LIMITS", "equals": ["YES"]}'::jsonb);

-- 3. Disclaimer of warranty (§5.6) — add "Waived by Lessee".
UPDATE contract_field_defs
   SET options = '[{"label": "Lessee requested at their own expense", "value": "LESSEE_OWN"},
                   {"label": "Lessee requested at Lessor''s expense", "value": "LESSEE_AT_LESSOR"},
                   {"label": "Lessor provided at no cost", "value": "LESSOR_FREE"},
                   {"label": "Lessee waives the option", "value": "WAIVED"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAINER_EVAL_CHOICE';

-- 4. Term end date: LEASE_END belongs to the FIXED-only clause, not TERM.MAIN
--    (so it never shows for open-ended). LEASE_START stays on TERM.MAIN.
UPDATE contract_field_defs SET clause_key='TERM.FIXED_END'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.LEASE_END';

-- 5. Jumping clause: only after Jumping is chosen as a permitted activity.
UPDATE contract_clause_defs
   SET conditional_on = '{"field_key": "TXN.PERMITTED_ACTIVITIES", "contains": ["JUMPING"]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.JUMPING';
-- jump-restrictions already gates on JUMPING_ALLOWED=RESTRICTED; keep it but also
-- require Jumping to be a permitted activity (belt & suspenders via the parent).

-- 6. Trainer clause: split purpose vs. definition/identification, and use the full
--    "French Heritage Equestrian Approved Trainers and Instructors" phrasing,
--    including Instructors. Split into two clauses so the reader sees purpose
--    separately from the definition + approved-list.
UPDATE contract_clause_defs
   SET body = 'Riding Lessons, Horse Training, Jumping, and Competitions may take place only while a French Heritage Equestrian Approved Trainer or Instructor is present.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PERMITTED_USE.TRAINER';
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'PERMITTED_USE', 'PERMITTED_USE.TRAINER_DEF', NULL,
   'For the purposes of this Agreement, "Trainer" and "Instructor" mean a French Heritage Equestrian Approved Trainer or Instructor approved by Lessor. Approved Trainer(s) and Instructor(s): {{TXN.APPROVED_TRAINERS}}. "Horse Training" means training of the Horse conducted by an approved Trainer without a riding-lesson participant, and may be provided only by an approved Trainer.',
   'input', 22, false,
   '{"field_key": "TXN.PERMITTED_ACTIVITIES", "contains": ["LESSONS","TRAINING","JUMPING","COMPETITIONS"]}'::jsonb);
UPDATE contract_field_defs
   SET label='Approved Trainer(s) and Instructor(s)', clause_key='PERMITTED_USE.TRAINER_DEF',
       guidance='Name the French Heritage Equestrian Approved Trainer(s) and Instructor(s) permitted for Riding Lessons, Horse Training, Jumping, and Competitions.'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.APPROVED_TRAINERS';

-- 7. Prohibited "Other" → add a free-text specify field shown when Other is picked.
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.OTHER_PROHIBITED_NOTE', 'Other prohibited activity', 'PERMITTED_USE', 'LESSOR',
   'text', 'text', 'Describe the other prohibited activity.',
   false, false, 72, 'text', 'PROHIBITED.OTHER_NOTE');
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'PERMITTED_USE', 'PROHIBITED.OTHER_NOTE', NULL,
   'Other prohibited activity: {{TXN.OTHER_PROHIBITED_NOTE}}.',
   'input', 72, false, '{"field_key": "TXN.OTHER_PROHIBITED", "contains": ["OTHER"]}'::jsonb);

-- 8. Lessons/Training: replace the "from horse record" Instructor/Trainer with the
--    approved-trainers/instructors language.
UPDATE contract_clause_defs
   SET body = 'Lessee required to take lessons: {{TXN.LESSONS_REQUIRED}}. Lessons are provided by a French Heritage Equestrian Approved Trainer or Instructor.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.LESSONS';
UPDATE contract_clause_defs
   SET body = 'Professional training: {{TXN.TRAINING_TYPE}}. Training is provided by a French Heritage Equestrian Approved Trainer.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.TRAINING';

-- 9. Schedule: for a PARTIAL lease the week grid shows directly below the
--    lease-type choice. A "Schedule format" dropdown (Specific days / Other) lets
--    the grid be swapped for free text. Uses the new `all` (AND) condition so the
--    grid requires BOTH a partial lease AND the specific-days format.
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'SCHEDULE', 'SCHEDULE.TYPE', NULL,
   'Schedule format: {{TXN.SCHEDULE_TYPE}}.',
   'input', 5, false, '{"field_key": "TXN.LEASE_TYPE", "equals": ["PARTIAL"]}'::jsonb);
UPDATE contract_field_defs SET clause_key='SCHEDULE.TYPE'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.SCHEDULE_TYPE';
UPDATE contract_field_defs SET clause_key='SCHEDULE.MAIN'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.DAYS_USED';

-- grid: partial lease AND (specific-days OR unset). Default (unset schedule type)
-- shows the grid so it appears immediately on choosing Partial.
UPDATE contract_clause_defs
   SET body = 'Days of the week reserved for Lessee''s use: {{TXN.DAYS_USED}}.',
       conditional_on = '{"all": [
         {"field_key": "TXN.LEASE_TYPE", "equals": ["PARTIAL"]},
         {"field_key": "TXN.SCHEDULE_TYPE", "equals": ["SPECIFIC_DAYS", ""]}
       ]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.MAIN';
-- free text alternative when Other is chosen (already partial-scoped via TYPE)
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [
         {"field_key": "TXN.LEASE_TYPE", "equals": ["PARTIAL"]},
         {"field_key": "TXN.SCHEDULE_TYPE", "equals": ["OTHER"]}
       ]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.OTHER';
