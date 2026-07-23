-- Permitted Use (§11) refinements.

-- 11.1: put the permitted-activities buttons on their own line, the "no other
-- purpose" sentence on the next line, and add an "Add Restrictions" control on a
-- third line (a button that reveals a free-text field for restrictions on the
-- selected activities). Newlines in a clause body render as separate lines in both
-- the authoring surface and the composed document.
UPDATE contract_clause_defs
   SET body = 'Lessor grants Lessee the right to use the Horse for the following purpose(s): {{TXN.PERMITTED_ACTIVITIES}}'
           || E'\n' || 'Lessee shall not use the Horse for any other purpose without Lessor''s prior written consent.'
           || E'\n' || 'Restrictions: {{TXN.PERMITTED_RESTRICTIONS}}'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PERMITTED_USE.MAIN';

-- the Add-Restrictions field (button → free-text). New 'add_text' format: the
-- button label is the field label; the revealed prompt comes from guidance.
INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type,
   owner_role, required, is_optional, sort_order, guidance)
VALUES
  ('HORSE_LEASE_V2', 'TXN.PERMITTED_RESTRICTIONS', 'PERMITTED_USE.MAIN', 'PERMITTED_USE',
   'Add Restrictions', 'add_text', 'text', 'add_text',
   'LESSOR', false, true, 40,
   'Restrictions on the permitted activities')
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label = EXCLUDED.label, input_kind = EXCLUDED.input_kind, value_type = EXCLUDED.value_type,
      format_type = EXCLUDED.format_type, clause_key = EXCLUDED.clause_key,
      guidance = EXCLUDED.guidance, sort_order = EXCLUDED.sort_order,
      required = EXCLUDED.required, is_optional = EXCLUDED.is_optional;

-- Remove the Trainer/Instructor definition clause (and its now-unused field, if any).
DELETE FROM contract_clause_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PERMITTED_USE.TRAINER_DEF';

-- TRANSPORT: move the "For clarity, riding trails …" sentence onto its own line.
UPDATE contract_clause_defs
   SET body = 'Transport of the Horse to offsite locations (other than for medical care, which is always permitted): {{TXN.OFFSITE_TRANSPORT}}.'
           || E'\n' || 'For clarity, riding trails attached to the location at which the Horse is kept under this Agreement are not offsite locations.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PERMITTED_USE.TRANSPORT';

-- Remove the "Who may jump Horse / Other jumping restriction" fields.
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key IN ('TXN.JUMP_WHO', 'TXN.JUMP_OTHER');

-- 11.6 Other permitted activities: add "None" in position 1; rename
-- "Emotional Support" → "Emotional Support Services".
UPDATE contract_field_defs
   SET options = '[
        {"label": "None", "value": "NONE"},
        {"label": "Breeding", "value": "BREEDING"},
        {"label": "Emotional Support Services", "value": "EMOTIONAL_SUPPORT"},
        {"label": "Film / Television / Advertising", "value": "FILM_TV_AD"},
        {"label": "Other", "value": "OTHER"}
      ]'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.OTHER_PROHIBITED';

-- 11.5 Other Riders: add "None" in position 1.
UPDATE contract_field_defs
   SET options = '[
        {"label": "None", "value": "NONE"},
        {"label": "Lessee''s family members", "value": "FAMILY"},
        {"label": "The trainer/instructor", "value": "TRAINER"},
        {"label": "Other", "value": "OTHER"}
      ]'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.OTHERS_ALLOWED';

-- 12.1 Lessons: put the "provided by … Claire Bourdon" sentence on its own line,
-- and remove the instructor input field (the instructor is named in the text now).
UPDATE contract_clause_defs
   SET body = 'Lessee is required to maintain continuous enrollment in weekly riding lessons: {{TXN.LESSONS_REQUIRED}}.'
           || E'\n' || 'Lessons are provided by French Heritage Equestrian Approved Instructor Claire Bourdon.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'TRAINING_LESSONS.LESSONS';

DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'HORSE.INSTRUCTOR';

-- 12.2 Training: remove the trainer input field (the trainer is named in the text).
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'HORSE.TRAINER';
