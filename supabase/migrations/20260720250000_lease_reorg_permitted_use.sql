-- HORSE_LEASE_V2 structural + content pass (permitted-use screenshot review).
-- See memory fhe-lease-permitted-use-reorg-2026-07-20 for the confirmed spec.
--
-- Parts:
--   1. Section reorder (Eval above Term; Lease Fee after Purpose; Location after
--      Horse; Schedule after Term; Lessee Reps near the end).
--   2. Merge Permitted Use + Prohibited + Shared Usage into one section
--      ("PERMITTED_USE" → heading "Permitted Use(s) & Restrictions").
--   3. Permitted-activities list rebuilt; Lessons / Training / Competitions gate
--      follow-on content by membership.
--   4. Trainer as a defined NAMED term (not a signer) + trainer-presence clause.
--   5. Offsite-transport grant/prohibit clause; retire the removal checklist.
--   6. Evaluation period → N + unit duration beginning at signing.
--   7. Option-label Owner → Lessor; drop the standalone "Other" permitted field.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 + 2. SECTIONS: reassign sort_order and fold Prohibited/Shared into Permitted.
-- New order (×10). Lease Fee + Payment Terms sit together after Purpose; Care +
-- Expenses together; Evaluation above Term; Lessee Reps just before Signatures.
--   10 Parties · 20 Purpose · 30 Lease Fee · 35 Payment Terms · 40 Horse ·
--   50 Location · 60 Evaluation · 70 Term · 80 Schedule ·
--   90 Permitted Use(s) & Restrictions · 100 Training and Lessons · 110 Care ·
--   120 Expenses · 140 Insurance/Risk · 150 Competitions · 160 Termination ·
--   170 Notice · 180 Assignment · 190 Entire Agreement · 200 Governing Law ·
--   210 Attorneys' · 220 Severability · 230 Lessee's Representations · 240 Signatures
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE contract_section_defs SET sort_order = CASE section_key
    WHEN 'PARTIES'          THEN 10
    WHEN 'PURPOSE'          THEN 20
    WHEN 'LEASE_FEE'        THEN 30
    WHEN 'PAYMENT_TERMS'    THEN 35
    WHEN 'HORSE'            THEN 40
    WHEN 'LOCATION'         THEN 50
    WHEN 'EVALUATION'       THEN 60
    WHEN 'TERM'             THEN 70
    WHEN 'SCHEDULE'         THEN 80
    WHEN 'PERMITTED_USE'    THEN 90
    WHEN 'TRAINING_LESSONS' THEN 100
    WHEN 'CARE'             THEN 110
    WHEN 'EXPENSES'         THEN 120
    WHEN 'INSURANCE_RISK'   THEN 140
    WHEN 'COMPETITIONS'     THEN 150
    WHEN 'TERMINATION'      THEN 160
    WHEN 'NOTICE'           THEN 170
    WHEN 'ASSIGNMENT'       THEN 180
    WHEN 'ENTIRE_AGREEMENT' THEN 190
    WHEN 'GOVERNING_LAW'    THEN 200
    WHEN 'ATTORNEYS_FEES'   THEN 210
    WHEN 'SEVERABILITY'     THEN 220
    WHEN 'LESSEE_REPS'      THEN 230
    WHEN 'SIGNATURES'       THEN 240
    ELSE sort_order END
 WHERE template_key = 'HORSE_LEASE_V2';

UPDATE contract_section_defs
   SET heading = 'Permitted Use(s) & Restrictions'
 WHERE template_key = 'HORSE_LEASE_V2' AND section_key = 'PERMITTED_USE';

-- Re-home the Prohibited + Shared-Usage clauses into the merged section. Clause
-- sort_order is assigned so the group reads: activities · transport · jumping ·
-- shared usage · other riders · other prohibited.
UPDATE contract_clause_defs
   SET section_key = 'PERMITTED_USE',
       sort_order  = CASE clause_key
         WHEN 'PROHIBITED.JUMPING'           THEN 40
         WHEN 'PROHIBITED.JUMP_RESTRICTIONS' THEN 45
         WHEN 'SHARED_USE.MAIN'              THEN 50
         WHEN 'PROHIBITED.OTHERS'            THEN 60   -- other riders → into this group
         WHEN 'PROHIBITED.OTHER'             THEN 70
         ELSE sort_order END
 WHERE template_key = 'HORSE_LEASE_V2'
   AND clause_key IN ('PROHIBITED.JUMPING','PROHIBITED.JUMP_RESTRICTIONS',
                      'SHARED_USE.MAIN','PROHIBITED.OTHERS','PROHIBITED.OTHER');

-- move the shared-usage fields' clause_key pointer too (field→clause link)
UPDATE contract_field_defs SET section = 'PERMITTED_USE'
 WHERE template_key = 'HORSE_LEASE_V2'
   AND clause_key IN ('SHARED_USE.MAIN','PROHIBITED.OTHERS','PROHIBITED.OTHER',
                      'PROHIBITED.JUMPING','PROHIBITED.JUMP_RESTRICTIONS');

-- retire the now-empty container sections (Prohibited + Shared Usage)
DELETE FROM contract_section_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND section_key IN ('PROHIBITED','SHARED_USE');

-- retire the removal-from-premises checklist clause + its field: superseded by the
-- offsite-transport grant/prohibit clause added below.
DELETE FROM contract_clause_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PROHIBITED.REMOVAL';
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.REMOVAL_ALLOWED';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Permitted activities list — rebuilt in the requested order. Lessons /
--    Training / Competitions gate follow-on content by membership (contains).
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE contract_field_defs
   SET label = 'Permitted activities',
       guidance = 'Select every activity the Lessee may do with the Horse. Riding Lessons, Horse Training, Jumping, and Competitions require an approved Trainer to be present.',
       options = '[
         {"label": "Riding Lessons", "value": "LESSONS"},
         {"label": "Horse Training", "value": "TRAINING"},
         {"label": "Solo Arena Riding", "value": "ARENA_SOLO"},
         {"label": "Group Arena Riding", "value": "ARENA_GROUP"},
         {"label": "Jumping", "value": "JUMPING"},
         {"label": "Competitions", "value": "COMPETITIONS"},
         {"label": "Trail Riding", "value": "TRAIL"}
       ]'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.PERMITTED_ACTIVITIES';

-- drop the standalone "Other permitted use" free-text (and its old Other button)
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.PERMITTED_OTHER';

-- the main permitted-use sentence (unchanged wording, cleaner without the Other tail)
UPDATE contract_clause_defs
   SET body = 'Lessor grants Lessee the right to use Horse for the following purpose(s): {{TXN.PERMITTED_ACTIVITIES}}. Lessee shall not use Horse for any other purpose without Lessor''s prior written consent.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PERMITTED_USE.MAIN';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trainer as a defined NAMED term + the trainer-presence clause.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   guidance, required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.APPROVED_TRAINERS', 'Approved Trainer(s)',
   'PERMITTED_USE', 'LESSOR', 'text', 'text',
   'Name the French Heritage Equestrian Trainer(s) approved to be present for Riding Lessons, Horse Training, Jumping, and Competitions.',
   false, false, 25, 'text', 'PERMITTED_USE.TRAINER');

-- trainer-presence clause: shown when any trainer-present activity is selected.
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order,
   is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'PERMITTED_USE', 'PERMITTED_USE.TRAINER', NULL,
   'For the purposes of this Agreement, "Trainer" means a French Heritage Equestrian trainer approved by Lessor. Riding Lessons, Horse Training, Jumping, and Competitions may take place only while a Trainer is present. Approved Trainer(s): {{TXN.APPROVED_TRAINERS}}. "Horse Training" means training of the Horse conducted by a Trainer without a riding-lesson participant, and may be provided only by an approved Trainer.',
   'input', 20, false,
   '{"field_key": "TXN.PERMITTED_ACTIVITIES", "contains": ["LESSONS","TRAINING","JUMPING","COMPETITIONS"]}'::jsonb);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Offsite-transport grant/prohibit clause (always shown; medical excepted).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   options, guidance, required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.OFFSITE_TRANSPORT', 'Offsite transport',
   'PERMITTED_USE', 'LESSOR', 'select', 'select',
   '[
     {"label": "Lessor grants permission to transport offsite", "value": "GRANTED"},
     {"label": "Lessor prohibits offsite transport without written consent", "value": "PROHIBITED"}
   ]'::jsonb,
   'Controls whether the Lessee may take the Horse to offsite locations for any reason other than medical care. Riding trails attached to the stated location are not considered offsite.',
   false, false, 30, 'select', 'PERMITTED_USE.TRANSPORT');

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order,
   is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'PERMITTED_USE', 'PERMITTED_USE.TRANSPORT', NULL,
   'Transport of Horse to offsite locations (other than for medical care, which is always permitted): {{TXN.OFFSITE_TRANSPORT}}. For clarity, riding trails attached to the location at which the Horse is kept under this Agreement are not offsite locations.',
   'input', 35, false, NULL);

-- ─────────────────────────────────────────────────────────────────────────────
--   Competitions gating: the permitted-activities value changed COMPETITION →
--   COMPETITIONS, so update the Competitions section's gate to match.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE contract_clause_defs
   SET conditional_on = '{"field_key": "TXN.PERMITTED_ACTIVITIES", "contains": ["COMPETITIONS"]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key IN ('COMPETITIONS.INTRO','COMPETITIONS.TERMS');

-- Training / Lessons follow-on content gates on its activity being selected.
UPDATE contract_clause_defs
   SET conditional_on = '{"field_key": "TXN.PERMITTED_ACTIVITIES", "contains": ["TRAINING"]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'TRAINING_LESSONS.TRAINING';
UPDATE contract_clause_defs
   SET conditional_on = '{"field_key": "TXN.PERMITTED_ACTIVITIES", "contains": ["LESSONS"]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'TRAINING_LESSONS.LESSONS';
-- reorder so Lessons precedes Training within that section (list order)
UPDATE contract_clause_defs SET sort_order = 10 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.LESSONS';
UPDATE contract_clause_defs SET sort_order = 20 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.TRAINING';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Evaluation period → N + unit duration beginning at signing.
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key IN ('TXN.EVALUATION_START','TXN.EVALUATION_END');

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   options, guidance, required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.EVALUATION_LENGTH', 'Length', 'EVALUATION', 'LESSOR',
   'number', 'number', NULL,
   'How long the evaluation period runs, beginning on the date this Agreement is fully signed.',
   false, false, 20, 'number', 'EVALUATION.DATES'),
  ('HORSE_LEASE_V2', 'TXN.EVALUATION_UNIT', 'Unit', 'EVALUATION', 'LESSOR',
   'select', 'select',
   '[{"label": "days", "value": "DAYS"}, {"label": "weeks", "value": "WEEKS"}, {"label": "months", "value": "MONTHS"}]'::jsonb,
   NULL, false, false, 21, 'select', 'EVALUATION.DATES');

UPDATE contract_clause_defs
   SET body = 'Lessee shall have an evaluation period of {{TXN.EVALUATION_LENGTH}} {{TXN.EVALUATION_UNIT}} beginning on the date this Agreement is fully signed by both parties. All terms of this Agreement apply during the evaluation period. During the evaluation period, either party may terminate this Agreement for any reason upon notice to the other party.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'EVALUATION.DATES';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Option-label Owner → Lessor on the remaining option-bearing fields.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE contract_field_defs
   SET options = replace(options::text, '"label": "Paid by Owner"', '"label": "Paid by Lessor"')::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key = 'TXN.COMPETITION_EXPENSES';
UPDATE contract_field_defs
   SET options = replace(options::text, '"label": "Owner"', '"label": "Lessor"')::jsonb
 WHERE template_key='HORSE_LEASE_V2'
   AND field_key IN ('TXN.COMPETITION_WINNINGS','TXN.PROTECTIVE_PROVIDER','TXN.TACK_PROVIDER');
UPDATE contract_field_defs
   SET options = replace(options::text, '"label": "Owner obtains it"', '"label": "Lessor obtains it"')::jsonb
 WHERE template_key='HORSE_LEASE_V2'
   AND field_key IN ('TXN.MORTALITY_INSURANCE_OBTAINER','TXN.MAJOR_MEDICAL_OBTAINER','TXN.LOSS_OF_USE_OBTAINER');
