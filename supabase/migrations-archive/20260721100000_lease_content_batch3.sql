-- HORSE_LEASE_V2 content batch (2026-07-21 review). Well-specified clause/field
-- edits. The fee-line builder (§3.1) and its custom control are handled
-- separately; this covers §3.2/4.x, payment method, term, schedule + lease-type
-- wiring, evaluation, vet-exam, and disclaimer.

-- ── LEASE TYPE selector (Partial vs Full) — the missing selection the review
--    flagged. Full = full-time access (no permitted-days section, care duties on
--    Lessee); Partial = shared/limited (Owner retains exercise responsibility).
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   options, guidance, required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.LEASE_TYPE', 'Lease type', 'PURPOSE', 'LESSOR',
   'select', 'select',
   '[{"label": "Full lease (full-time access)", "value": "FULL"},
     {"label": "Partial lease (shared or limited access)", "value": "PARTIAL"}]'::jsonb,
   'Full lease gives the Lessee full-time access and care responsibility. Partial lease is shared or limited; the Owner retains responsibility for the Horse''s exercise and use.',
   true, false, 5, 'select', 'PURPOSE.GRANT');

-- ── §3.2 (was LEASE_FEE.CHOICE "Lease fee: …") — removed. The §3.1 fee builder
--    replaces the fee-type dropdown entirely.
DELETE FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='LEASE_FEE.CHOICE';
DELETE FROM contract_field_defs  WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.LEASE_FEE_TYPE';

-- ── §4.1 (PAYMENT_TERMS.DUE_DATES) removed per spec.
DELETE FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='PAYMENT_TERMS.DUE_DATES';
DELETE FROM contract_field_defs  WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.INVOICE_DAYS';

-- ── §4.2 offset — simplified to the exact requested wording.
UPDATE contract_clause_defs
   SET body = 'A party to whom money is owed under this Agreement may offset the amount owed against any amount that party owes to the other party.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PAYMENT_TERMS.OFFSET';

-- ── §4.4 late payments — replaced with the requested breach/void language.
UPDATE contract_clause_defs
   SET body = 'All payments are due on their due date or within 5 business days of notification of the amount owed. Payments will be deemed late if they remain unpaid on the 6th business day. Late payments are considered a breach of the contract terms and may be grounds for termination of the Agreement unless the party from whom the payment is owed has communicated in writing the date by which payment will be made. Payments exceeding 1 calendar month in past-due status shall void the Agreement unless prior written acceptance of the delay is provided by the party to whom the payment is owed.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PAYMENT_TERMS.LATE';
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2'
  AND field_key IN ('TXN.LATE_FEE','TXN.LATE_DAYS','TXN.LATE_INTEREST_RATE');

-- ── Payment Method section (multi-select: Cash, Zelle, Credit Card + processor).
INSERT INTO contract_section_defs (template_key, section_key, heading, sort_order, is_optional, guidance)
VALUES ('HORSE_LEASE_V2', 'PAYMENT_METHOD', 'Payment Method', 38, false,
        'How the Lessee may pay amounts owed under this Agreement.');

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   options, guidance, required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.PAYMENT_METHODS', 'Accepted payment methods', 'PAYMENT_METHOD',
   'LESSOR', 'buttons', 'checkbox',
   '[{"label": "Cash", "value": "CASH"}, {"label": "Zelle", "value": "ZELLE"}, {"label": "Credit Card", "value": "CREDIT_CARD"}]'::jsonb,
   'Select every method the Lessee may use to pay.', false, false, 10, 'buttons', 'PAYMENT_METHOD.MAIN'),
  ('HORSE_LEASE_V2', 'TXN.CARD_PROCESSOR', 'Card processor & instructions', 'PAYMENT_METHOD',
   'LESSOR', 'longtext', 'longtext', NULL,
   'Name the payment processor and how the Lessee pays (e.g. an invoice with a payment link sent by email or text, a payment URL, etc.).',
   false, false, 20, 'longtext', 'PAYMENT_METHOD.CARD');

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'PAYMENT_METHOD', 'PAYMENT_METHOD.MAIN', NULL,
   'The Lessee may pay amounts owed under this Agreement by the following method(s): {{TXN.PAYMENT_METHODS}}.',
   'input', 10, false, NULL),
  ('HORSE_LEASE_V2', 'PAYMENT_METHOD', 'PAYMENT_METHOD.CARD', NULL,
   'Credit card payments are processed as follows: {{TXN.CARD_PROCESSOR}}.',
   'input', 20, false, '{"field_key": "TXN.PAYMENT_METHODS", "contains": ["CREDIT_CARD"]}'::jsonb);

-- ── §8.1 Agreement Term — Open-ended drops "and continues until [date]".
--    Split into a base sentence + a fixed-period tail gated on FIXED.
UPDATE contract_clause_defs
   SET body = 'Term of this Agreement: {{TXN.LEASE_TERM_TYPE}}. This Agreement begins on {{TXN.LEASE_START}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TERM.MAIN';
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'TERM', 'TERM.FIXED_END', NULL,
   'This Agreement continues until {{TXN.LEASE_END}}.',
   'input', 12, false, '{"field_key": "TXN.LEASE_TERM_TYPE", "equals": ["FIXED"]}'::jsonb);

-- ── §9 Schedule ---------------------------------------------------------------
-- 9.1 dropdown → just Specific days / Other(specify). Other replaces the week
--     grid with a free-text terms field.
UPDATE contract_field_defs
   SET options = '[{"label": "Specific days of the week", "value": "SPECIFIC_DAYS"},
                   {"label": "Other (specify)", "value": "OTHER"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.SCHEDULE_TYPE';

-- the whole schedule/permitted-days section applies to PARTIAL leases only — a
-- full lease is full-time access, so there are no permitted days to reserve.
UPDATE contract_clause_defs
   SET conditional_on = '{"field_key": "TXN.LEASE_TYPE", "equals": ["PARTIAL"]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key IN ('SCHEDULE.MAIN','SCHEDULE.CHANGES');

-- free-text schedule when Other is chosen (replaces the day grid)
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.SCHEDULE_TERMS', 'Schedule terms', 'SCHEDULE', 'LESSOR',
   'longtext', 'longtext', 'Describe the usage schedule the parties agree to.',
   false, false, 5, 'longtext', 'SCHEDULE.OTHER');
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'SCHEDULE', 'SCHEDULE.OTHER', NULL,
   'Usage schedule: {{TXN.SCHEDULE_TERMS}}.',
   'input', 12,  false, '{"field_key": "TXN.SCHEDULE_TYPE", "equals": ["OTHER"]}'::jsonb);
-- specific-days line only when Specific days is chosen and it's a partial lease
UPDATE contract_clause_defs
   SET conditional_on = '{"field_key": "TXN.SCHEDULE_TYPE", "equals": ["SPECIFIC_DAYS"]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.MAIN';

-- 9.2 schedule changes → exact requested wording.
UPDATE contract_clause_defs
   SET body = 'Any changes to the agreed upon schedule must be made and accepted in writing.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.CHANGES';

-- 9.3 care duty — softened wording; applies to FULL leases (a partial lease keeps
--     exercise responsibility with the Owner). "as listed below" points to 9.4.
UPDATE contract_clause_defs
   SET conditional_on = '{"field_key": "TXN.LEASE_TYPE", "equals": ["FULL"]}'::jsonb,
       body = 'Lessee''s use of Horse is a responsibility as well as a right: regular, consistent exercise and attention are important to Horse''s health and wellbeing. If Lessee regularly fails to use and care for Horse, Lessor may terminate this Agreement. Lessee is responsible for ensuring consistent horse care and exercise as listed below.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.CARE_DUTY';

-- 9.4 (new) — authorize or bar the Lessee hiring the Trainer to assist with care
--     and exercise so Lessee can meet 9.3. Full-lease only.
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, options, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.TRAINER_FOR_CARE', 'Lessee may hire the Trainer for care & exercise', 'SCHEDULE',
   'LESSOR', 'select', 'select',
   '[{"label": "Authorized — Lessee may hire the Trainer to assist", "value": "AUTHORIZED"},
     {"label": "Not authorized", "value": "BARRED"}]'::jsonb,
   'Whether the Lessee may hire the Trainer to help meet the care and exercise requirements above.',
   false, false, 30, 'select', 'SCHEDULE.TRAINER_CARE');
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'SCHEDULE', 'SCHEDULE.TRAINER_CARE', NULL,
   'Lessee''s option to hire the Trainer to assist with the care and exercise required above: {{TXN.TRAINER_FOR_CARE}}.',
   'input', 30, false, '{"field_key": "TXN.LEASE_TYPE", "equals": ["FULL"]}'::jsonb);

-- ── §7 Evaluation — checkbox choice (Requested/Required/Waived/Refused). When
--    Requested or Required, show the days field + the termination-refund line.
--    (Replaces the yes/no enable gate.)
UPDATE contract_field_defs
   SET input_kind='buttons', value_type='checkbox', format_type='buttons',
       label='Evaluation period',
       options='[{"label": "Requested by Lessee", "value": "REQUESTED"},
                 {"label": "Required by Lessor", "value": "REQUIRED"},
                 {"label": "Waived by Lessee", "value": "WAIVED"},
                 {"label": "Refused by Lessor", "value": "REFUSED"}]'::jsonb,
       guidance='Whether an evaluation (trial) period applies. Choose Requested or Required to set its length.'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.EVALUATION_ENABLED';

-- the enable prompt clause hosts the checkbox (empty body → authoring-only)
UPDATE contract_clause_defs SET body='', heading=NULL, conditional_on=NULL, sort_order=10
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='EVALUATION.CHOICE';

-- duration clause shows when requested or required
UPDATE contract_clause_defs
   SET conditional_on='{"field_key": "TXN.EVALUATION_ENABLED", "contains": ["REQUESTED","REQUIRED"]}'::jsonb,
       heading='Evaluation Period', sort_order=20,
       body='Lessee shall have an evaluation period of {{TXN.EVALUATION_LENGTH}} {{TXN.EVALUATION_UNIT}} beginning on the date this Agreement is fully signed by both parties, during which time either party may terminate the Agreement and all payments must be returned upon notification of termination.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='EVALUATION.DATES';

-- ── §5.3 Vet exam — replace responsibility field + body with a 4-option choice.
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.VET_CHECK_RESPONSIBILITY';
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, options, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.VET_CHECK_CHOICE', 'Pre-lease veterinary examination', 'HORSE', 'LESSOR',
   'buttons', 'checkbox',
   '[{"label": "Lessee requested at their own expense", "value": "LESSEE_OWN"},
     {"label": "Lessee requested at Lessor''s expense", "value": "LESSEE_AT_LESSOR"},
     {"label": "Lessor provided at no cost", "value": "LESSOR_FREE"},
     {"label": "Lessee waives the option", "value": "WAIVED"}]'::jsonb,
   NULL, false, false, 10, 'buttons', 'HORSE.VET_CHECK');
UPDATE contract_clause_defs
   SET body = 'Pre-lease veterinary examination of Horse: {{TXN.VET_CHECK_CHOICE}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.VET_CHECK';

-- ── §5.6 Disclaimer of Warranties — add the same-style 3-option choice.
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, options, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.TRAINER_EVAL_CHOICE', 'Professional suitability evaluation', 'HORSE', 'LESSOR',
   'buttons', 'checkbox',
   '[{"label": "Lessee requested at their own expense", "value": "LESSEE_OWN"},
     {"label": "Lessee requested at Lessor''s expense", "value": "LESSEE_AT_LESSOR"},
     {"label": "Lessor provided at no cost", "value": "LESSOR_FREE"}]'::jsonb,
   NULL, false, false, 10, 'buttons', 'HORSE.WARRANTY');
UPDATE contract_clause_defs
   SET body = body || ' Professional suitability evaluation: {{TXN.TRAINER_EVAL_CHOICE}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.WARRANTY';

-- ── SHARED_USE — no longer hard-codes "This is a partial lease" (lease type now
--    drives it); shown for partial leases only.
UPDATE contract_clause_defs
   SET conditional_on = '{"field_key": "TXN.LEASE_TYPE", "equals": ["PARTIAL"]}'::jsonb,
       body = 'Lessee shares use of Horse with: {{TXN.SHARED_WITH}}. Details: {{TXN.SHARED_WITH_NAMES}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SHARED_USE.MAIN';
UPDATE contract_field_defs SET options = replace(options::text, '"label": "Owner"', '"label": "Lessor"')::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.SHARED_WITH';
