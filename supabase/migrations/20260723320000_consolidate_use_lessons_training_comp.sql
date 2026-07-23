-- Consolidate §12 Lessons & Training and §15 Competitions into §11 Permitted Use.
--   • Lessons requirement: always shown.
--   • Training clause: always shown (revised to cover training generally, since
--     "Horse Training" is being removed from the permitted-activities buttons).
--   • Competitions: shown only when "Competitions" is selected.
-- Then remove "Horse Training" from the activity options and drop the two now-empty
-- sections.

-- 1) remove "Horse Training" (TRAINING) from the permitted-activities options.
UPDATE contract_field_defs
   SET options = '[
        {"label": "Riding Lessons", "value": "LESSONS"},
        {"label": "Solo Arena Riding", "value": "ARENA_SOLO"},
        {"label": "Group Arena Riding", "value": "ARENA_GROUP"},
        {"label": "Jumping", "value": "JUMPING"},
        {"label": "Competitions", "value": "COMPETITIONS"},
        {"label": "Trail Riding", "value": "TRAIL"}
      ]'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.PERMITTED_ACTIVITIES';

-- the "must be supervised by an approved trainer" clause listed "Horse Training";
-- reword to drop it (training is its own always-on clause now).
UPDATE contract_clause_defs
   SET body = 'Riding Lessons, Jumping, and Competitions may take place only while a French Heritage Equestrian Approved Trainer or Instructor is present.',
       conditional_on = '{"contains": ["LESSONS", "JUMPING", "COMPETITIONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PERMITTED_USE.TRAINER';

-- 2) move Lessons + Training into PERMITTED_USE, ALWAYS shown (drop their gates).
UPDATE contract_clause_defs
   SET section_key = 'PERMITTED_USE', sort_order = 25, conditional_on = NULL
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'TRAINING_LESSONS.LESSONS';

-- training clause revised: covers professional training generally + who provides it.
UPDATE contract_clause_defs
   SET section_key = 'PERMITTED_USE', sort_order = 27, conditional_on = NULL,
       body = 'Any professional training of the Horse under this Agreement, including groundwork, schooling, and under-saddle training, shall be conducted only by a French Heritage Equestrian Approved Trainer. Professional training: {{TXN.TRAINING_TYPE}}. Training is provided by French Heritage Equestrian Approved Trainer Claire Bourdon.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'TRAINING_LESSONS.TRAINING';

UPDATE contract_field_defs SET section = 'PERMITTED_USE'
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key IN ('TXN.LESSONS_REQUIRED', 'TXN.TRAINING_TYPE');

-- 3) move Competitions into PERMITTED_USE, still gated on Competitions selected.
UPDATE contract_clause_defs
   SET section_key = 'PERMITTED_USE', sort_order = 80
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'COMPETITIONS.INTRO';
UPDATE contract_clause_defs
   SET section_key = 'PERMITTED_USE', sort_order = 82
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'COMPETITIONS.TERMS';
UPDATE contract_field_defs SET section = 'PERMITTED_USE'
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key IN ('TXN.COMPETITION_EXPENSES', 'TXN.COMPETITION_WINNINGS');

-- 4) drop the now-empty sections.
DELETE FROM contract_section_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND section_key IN ('TRAINING_LESSONS', 'COMPETITIONS');

-- 5) layout fixes within Permitted Use:
--   • Transport was a headingless (unnumbered) clause → give it a heading.
UPDATE contract_clause_defs SET heading = 'Transport of the Horse'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PERMITTED_USE.TRANSPORT';

--   • Restrictions was tacked onto the permitted-use line → make it its own
--     numbered subsection, shown immediately after "Other Allowed Activities"
--     (PROHIBITED.OTHER = 70, its note = 72). Remove the line from MAIN.
UPDATE contract_clause_defs
   SET body = 'Lessor grants Lessee the right to use the Horse for the following purpose(s): {{TXN.PERMITTED_ACTIVITIES}}'
           || E'\n' || 'Lessee shall not use the Horse for any other purpose without Lessor''s prior written consent.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PERMITTED_USE.MAIN';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order)
VALUES
  ('HORSE_LEASE_V2', 'PERMITTED_USE', 'PERMITTED_USE.RESTRICTIONS', 'Restrictions',
   'Restrictions: {{TXN.PERMITTED_RESTRICTIONS}}', 73)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key = EXCLUDED.section_key, heading = EXCLUDED.heading,
      body = EXCLUDED.body, sort_order = EXCLUDED.sort_order;

UPDATE contract_field_defs SET clause_key = 'PERMITTED_USE.RESTRICTIONS'
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.PERMITTED_RESTRICTIONS';
