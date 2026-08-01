-- ─────────────────────────────────────────────────────────────────────────────
-- CLAUSE-GATE BATCH — items A, B, D (2026-08-01)
-- Spec: clause-gate-batch-spec.md. Template: HORSE_LEASE_V2.
--
-- Every condition changed below was verified byte-for-byte against the live
-- table before this file was written. Conditions are DATA: a wrong assumption
-- renders a legally wrong contract silently and throws no error, so each item
-- was verified, applied, and re-verified individually, with the rendered
-- clause-key set diffed before and after against both live documents.
--
-- The governing principle (from the spec): "" in a gate is a bug only where ""
-- means "not yet chosen" on a select that drives clause identity. It is NOT a
-- bug where "" is a real state — the INSURANCE_RISK certify inputs are
-- unchecked="" by design and their {"equals":["NO",""]} gates are correct and
-- untouched here.
--
-- Items C and E are report-only and are deliberately absent from this file.
-- Item F is a frontend change and lands with the repo stream.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════
-- ITEM A — party-type identity gates: remove "", add pending variants
-- ═════════════════════════════════════════════════════════════════════════
-- Verified before writing:
--   LESSEE_REPS.MAIN_INDIVIDUAL {"equals": ["INDIVIDUAL", ""], ...}
--   TRAINING_LESSONS.LESSONS    {"equals": ["INDIVIDUAL", ""], ...}
--   DEFINITIONS.LESSOR_IND      {"any": [{"equals": ["INDIVIDUAL", ""], ...}]}
--   DEFINITIONS.LESSEE_IND      {"any": [{"equals": ["INDIVIDUAL", ""], ...}]}
--   LESSEE.PARTY_TYPE required=t, LESSOR.PARTY_TYPE required=f
-- An unset party type previously fell through the "" to the INDIVIDUAL
-- variant, so an entity lease left unset silently rendered individual terms.

-- A1. Shrink the four individual equals arrays; shape otherwise preserved.
UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["INDIVIDUAL"], "field_key": "LESSEE.PARTY_TYPE"}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='LESSEE_REPS.MAIN_INDIVIDUAL';

UPDATE contract_clause_defs
   SET conditional_on = '{"any": [{"equals": ["INDIVIDUAL"], "field_key": "LESSOR.PARTY_TYPE"}]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='DEFINITIONS.LESSOR_IND';

UPDATE contract_clause_defs
   SET conditional_on = '{"any": [{"equals": ["INDIVIDUAL"], "field_key": "LESSEE.PARTY_TYPE"}]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='DEFINITIONS.LESSEE_IND';

-- The two lessons clauses additionally gain the permitted-activities gate: a
-- continuous-lesson-enrollment obligation is incoherent when lessons are not
-- a permitted activity. PERMITTED_USE.TRAINER (sort 200) already gates this
-- way; these two (250/255) did not, so a lease permitting only ARENA_SOLO
-- dropped the trainer clause and still printed the lessons clause.
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["INDIVIDUAL"], "field_key": "LESSEE.PARTY_TYPE"}, {"contains": ["LESSONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.LESSONS';

UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}, {"contains": ["LESSONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.LESSONS_ENTITY';

-- A2. Four PENDING clauses so an unset party type renders a visible bracketed
-- placeholder instead of silently selecting a variant. Bodies are bracketed so
-- they can never read as operative terms. sort_order values sit immediately
-- after the pair each replaces, taken from the live sequence:
--   DEFINITIONS  LESSOR_IND 10, LESSOR_ENT 11, LESSEE_IND 12, LESSEE_ENT 13
--   LESSEE_REPS  MAIN_INDIVIDUAL 10, MAIN_ENTITY 20
--   PERMITTED_USE (TRAINING_LESSONS.* live here, NOT in a TRAINING_LESSONS
--                  section — verified) LESSONS 250, LESSONS_ENTITY 255,
--                  TRAINING 270
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'DEFINITIONS', 'DEFINITIONS.LESSOR_PENDING', NULL,
   '[Pending — select whether Lessor is an individual or an entity. This placeholder is replaced by the applicable definition and blocks signing.]',
   'input', 11, '{"equals": [""], "field_key": "LESSOR.PARTY_TYPE"}'::jsonb),

  ('HORSE_LEASE_V2', 'DEFINITIONS', 'DEFINITIONS.LESSEE_PENDING', NULL,
   '[Pending — select whether Lessee is an individual or an entity. This placeholder is replaced by the applicable definition and blocks signing.]',
   'input', 13, '{"equals": [""], "field_key": "LESSEE.PARTY_TYPE"}'::jsonb),

  ('HORSE_LEASE_V2', 'LESSEE_REPS', 'LESSEE_REPS.PENDING', 'Lessee''s Representations',
   '[Pending — select whether Lessee is an individual or an entity. This placeholder is replaced by the applicable representations and blocks signing.]',
   'prose', 21, '{"equals": [""], "field_key": "LESSEE.PARTY_TYPE"}'::jsonb),

  ('HORSE_LEASE_V2', 'PERMITTED_USE', 'TRAINING_LESSONS.PENDING', 'Lessons',
   '[Pending — select whether Lessee is an individual or an entity. This placeholder is replaced by the applicable lessons terms and blocks signing.]',
   'input', 256,
   '{"all": [{"equals": [""], "field_key": "LESSEE.PARTY_TYPE"}, {"contains": ["LESSONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}]}'::jsonb);

-- A3. LESSOR.PARTY_TYPE required=true (LESSEE already is). Party fill
-- auto-writes both from the contact's company flag, so this only blocks
-- signing on a contract whose party lacks a linked contact — which should
-- block anyway.
UPDATE contract_field_defs
   SET required = true
 WHERE template_key='HORSE_LEASE_V2' AND field_key='LESSOR.PARTY_TYPE';


-- ═════════════════════════════════════════════════════════════════════════
-- ITEM B — LEASE_PURPOSE: default-to-recreation becomes pending
-- ═════════════════════════════════════════════════════════════════════════
-- Verified: PURPOSE.RECREATION_DEFAULT gate is {"equals": [""], ...} and
-- TXN.LEASE_PURPOSE required=f. clause_key and gate are both KEPT — only the
-- body changes, so an unset purpose renders a placeholder rather than
-- silently asserting the recreational-purpose language.
--
-- The body being replaced is preserved here verbatim, so the language stays
-- reachable if the owner later wants it as an explicit selection:
--   'For the purposes permitted herein, Lessee wishes to ride and/or handle
--    Lessor''s horse, and Lessor agrees to allow Lessee to ride and/or handle
--    Lessor''s horse in exchange for the consideration described herein.'
UPDATE contract_clause_defs
   SET body = '[Pending — select the purpose of this lease. This placeholder is replaced by the applicable purpose language and blocks signing.]'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PURPOSE.RECREATION_DEFAULT';

UPDATE contract_field_defs
   SET required = true
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.LEASE_PURPOSE';

-- Residual accepted (spec): an out-of-domain value reaching the field past the
-- select UI renders neither variant. With required=true and a constrained
-- select this is unreachable through the product. clause_condition_met has no
-- negation operator and this batch does not extend it.


-- ═════════════════════════════════════════════════════════════════════════
-- ITEM D — evaluation date variants: explicit mode
-- ═════════════════════════════════════════════════════════════════════════
-- Verified: DATES_INCLUDED carried {"equals": [""], "field_key":
-- "TXN.EVAL_FIXED_LENGTH"} as its mutual-exclusion device — the variants were
-- separated by "the other one's field is empty" rather than by an explicit
-- choice. Verified neither length field currently carries a conditional_on,
-- so D3 overwrites nothing.

-- D1. The explicit mode field.
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, input_kind, value_type, options,
   conditional_on, required, sort_order, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.EVAL_PERIOD_TYPE', 'Evaluation period', 'EVALUATION',
   'select', 'text',
   '[{"label": "Included within the lease term", "value": "INCLUDED"}, {"label": "Fixed evaluation period before the term", "value": "FIXED"}]'::jsonb,
   '{"equals": ["REQUESTED", "REQUIRED"], "field_key": "TXN.EVALUATION_ENABLED"}'::jsonb,
   false, 15, 'EVALUATION.CHOICE');

-- D2. Regate the variants on the explicit mode, keeping the data-completeness
-- checks so a mode chosen without its length still renders nothing.
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["REQUESTED", "REQUIRED"], "field_key": "TXN.EVALUATION_ENABLED"}, {"equals": ["INCLUDED"], "field_key": "TXN.EVAL_PERIOD_TYPE"}, {"gte": 1, "field_key": "TXN.EVAL_INCLUDED_LENGTH"}]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='EVALUATION.DATES_INCLUDED';

UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["REQUESTED", "REQUIRED"], "field_key": "TXN.EVALUATION_ENABLED"}, {"equals": ["FIXED"], "field_key": "TXN.EVAL_PERIOD_TYPE"}, {"gte": 1, "field_key": "TXN.EVAL_FIXED_LENGTH"}]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='EVALUATION.DATES_FIXED';

-- D3. Each length field surfaces only under its own mode.
UPDATE contract_field_defs
   SET conditional_on = '{"equals": ["INCLUDED"], "field_key": "TXN.EVAL_PERIOD_TYPE"}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.EVAL_INCLUDED_LENGTH';

UPDATE contract_field_defs
   SET conditional_on = '{"equals": ["FIXED"], "field_key": "TXN.EVAL_PERIOD_TYPE"}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.EVAL_FIXED_LENGTH';

-- ─────────────────────────────────────────────────────────────────────────────
-- END — items A, B, D
-- ─────────────────────────────────────────────────────────────────────────────
