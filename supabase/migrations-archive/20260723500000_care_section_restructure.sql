-- CARE (Horse Care and Expenses) section restructure.
--
-- Before: two bare certify-checkbox clauses (CARE.EXERCISE_TOGGLE,
-- CARE.TRAINER_TOGGLE) rendered as separate, unnumbered subsections sitting ABOVE
-- the content they control (SCHEDULE.CARE_DUTY, SCHEDULE.TRAINER_CARE) — silently
-- consuming subsection numbers so the first titled subsection showed as 12.3.
--
-- After: fold each checkbox into the clause it controls so the checkbox is the
-- controller of a single numbered subsection that appears only when checked. The
-- checkbox statement itself is dropped from the final document; its meaning is
-- written into the clause body instead. CARE.INTRO ("Horse care and expenses …")
-- floats its number based on how many toggles above it are checked (none→.1,
-- one→.2, both→.3), and everything below renumbers automatically.

-- 1) Exercise responsibility: gate the CONTENT clause directly on the checkbox and
--    move it to the top. Body now states the requirement (formerly only on the
--    checkbox label) plus the rest-day-by-written-agreement caveat.
UPDATE contract_clause_defs
   SET sort_order = 1,
       conditional_on = '{"equals":["YES"],"field_key":"TXN.EXERCISE_INCLUDE"}'::jsonb,
       body = 'Lessee''s use of the Horse is a responsibility as well as a right: regular, consistent exercise and attention are important to the Horse''s health and wellbeing. Lessee is required to maintain regular use and exercise for the Horse on their allowed days, unless Lessee has discussed with and received mutual agreement from the Lessor in writing that one of those days will be used as a rest day for the Horse. If Lessee regularly fails to use and care for the Horse, Lessor may terminate this Agreement.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.CARE_DUTY';

-- The enabling checkbox now lives on the content clause as its authoring control
-- (it is no longer restated in the body). Give it a short control label.
UPDATE contract_field_defs
   SET clause_key='SCHEDULE.CARE_DUTY',
       label='Include Lessee care & exercise responsibility'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.EXERCISE_INCLUDE';

-- 2) 3rd Party Exercise: retitle, reword to align with the trainer clause above,
--    and add the two responsibility selects (arranging / cost) like farrier & vet.
UPDATE contract_clause_defs
   SET heading = '3rd Party Exercise',
       sort_order = 2,
       body = 'Lessee is permitted to engage an approved 3rd party to exercise the Horse. All 3rd party exercise shall be conducted only by a French Heritage Equestrian Approved Trainer. Other 3rd parties must be approved in writing by the Lessor.
Party responsible for arranging: {{TXN.TRAINER_EXERCISE_ARRANGE}}
Party responsible for costs: {{TXN.TRAINER_EXERCISE_COST}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.TRAINER_CARE';

-- The enabling checkbox lives on this clause as its authoring control.
UPDATE contract_field_defs
   SET clause_key='SCHEDULE.TRAINER_CARE',
       label='Include 3rd party exercise'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAINER_CARE_INCLUDE';

-- New arranging / cost selects for 3rd party exercise (same options as farrier/vet,
-- gated on the 3rd-party-exercise checkbox so they only show when included).
INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type, owner_role, is_optional, sort_order, options, conditional_on, guidance)
VALUES
  ('HORSE_LEASE_V2','TXN.TRAINER_EXERCISE_ARRANGE','SCHEDULE.TRAINER_CARE','CARE',
   'Party responsible for arranging','select','select','select','LESSOR',false,10,
   '[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Trainer/Instructor","value":"TRAINER"},{"label":"Boarding Staff","value":"BOARDING"},{"label":"Other","value":"OTHER"}]'::jsonb,
   '{"equals":["YES"],"field_key":"TXN.TRAINER_CARE_INCLUDE"}'::jsonb,
   'Who arranges the 3rd party exercise.'),
  ('HORSE_LEASE_V2','TXN.TRAINER_EXERCISE_COST','SCHEDULE.TRAINER_CARE','CARE',
   'Party responsible for costs','select','select','select','LESSOR',false,12,
   '[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Trainer/Instructor","value":"TRAINER"},{"label":"Boarding Staff","value":"BOARDING"},{"label":"Other","value":"OTHER"}]'::jsonb,
   '{"equals":["YES"],"field_key":"TXN.TRAINER_CARE_INCLUDE"}'::jsonb,
   'Who pays for the 3rd party exercise.')
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label=EXCLUDED.label, clause_key=EXCLUDED.clause_key, options=EXCLUDED.options,
      conditional_on=EXCLUDED.conditional_on, is_optional=EXCLUDED.is_optional,
      sort_order=EXCLUDED.sort_order, guidance=EXCLUDED.guidance;

-- 3) Retire the two now-empty toggle-only clauses (their checkboxes moved onto the
--    content clauses above; nothing else referenced them).
DELETE FROM contract_clause_defs
 WHERE template_key='HORSE_LEASE_V2'
   AND clause_key IN ('CARE.EXERCISE_TOGGLE','CARE.TRAINER_TOGGLE');
