-- ─────────────────────────────────────────────────────────────────────────────
-- HORSE_LEASE_V2 template repairs (owner-final, 2026-07-28):
--
--  B. EVALUATION PERIOD REWORK
--     • The "Evaluation period fee" selector + "Evaluation fee amount" line is
--       REMOVED (fields TXN.EVALUATION_FEE_MODE / TXN.EVALUATION_FEE_AMOUNT).
--     • The two config blocks are retitled "Evaluation Period Details" and become
--       ALTERNATIVES chosen by interaction: filling anything in one gates the
--       other off (excluded from the composed document); clearing re-enables both.
--       No selector row. Each block gets its OWN duration fields (the old shared
--       TXN.EVALUATION_LENGTH/UNIT are replaced):
--         included-at-no-charge → TXN.EVAL_INCLUDED_LENGTH / _UNIT
--         fixed fee             → TXN.EVAL_FIXED_LENGTH / _UNIT / _FEE
--     • Blocks show only when the first-line selection is Requested-by-Lessee or
--       Required-by-Lessor; Refused/Waived leaves them inoperable.
--     • Units carry singular AND plural options (day/days/…): the UI locks the
--       unit until a number is entered (the gte gate below) and offers singular
--       options when the number is 1, plural when ≥ 2 — the composed text prints
--       the option label, so document text matches ("1 month", "2 weeks").
--
--  C. §Lessons is now conditional on LESSEE.PARTY_TYPE: the existing clause shows
--     for INDIVIDUAL (or unset); a new alternate clause for ENTITY asks
--     "Lessee is permitted by Lessor to provide riding lessons with the Horse: Yes/No".
--
--  D. RESTRICTION-GATING BUG: the jumping/competition/trail restriction config
--     clauses were gated on the no-restrictions checkbox EQUALING 'NO', which an
--     untouched checkbox ('' — never toggled) does not satisfy: the config only
--     activated after checking and UNchecking the box. Gate now accepts ''
--     (unset) as "restrictions in play". The _ON clauses become is_optional so an
--     all-empty restriction block is omitted from the composed document instead
--     of printing a sentence full of blanks.
--
--  F. "Allowing Others to Ride" gains a "Riding Lesson Participants" option,
--     available only while lessons are permitted (activities include LESSONS, or
--     the entity lessons-permission answer is YES). Option-level availability is
--     carried in a `when` conditional on the option object (evaluated by the UI).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ══ B. EVALUATION PERIOD ══════════════════════════════════════════════════════

-- remove the fee-mode selector line + the shared duration fields entirely
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN ('TXN.EVALUATION_FEE_MODE', 'TXN.EVALUATION_FEE_AMOUNT',
                     'TXN.EVALUATION_LENGTH', 'TXN.EVALUATION_UNIT');

-- per-block duration (+ fee) fields. The unit selects are CLOSED (no synthetic
-- Other) and carry singular+plural options; their conditional_on gte-gates them
-- on the paired number so the UI locks the unit until a number exists.
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, options, conditional_on, required, is_optional, sort_order,
   clause_key, closed, guidance)
VALUES
  ('HORSE_LEASE_V2', 'TXN.EVAL_INCLUDED_LENGTH', 'Length', 'EVALUATION', 'LESSOR',
   'number', 'number', 'number', NULL, NULL, false, false, 20,
   'EVALUATION.DATES_INCLUDED', false, 'How long the evaluation period lasts (enter the number first).'),
  ('HORSE_LEASE_V2', 'TXN.EVAL_INCLUDED_UNIT', 'Unit', 'EVALUATION', 'LESSOR',
   'select', 'select', 'select',
   '[{"value":"DAY","label":"day"},{"value":"WEEK","label":"week"},{"value":"MONTH","label":"month"},{"value":"DAYS","label":"days"},{"value":"WEEKS","label":"weeks"},{"value":"MONTHS","label":"months"}]'::jsonb,
   '{"field_key":"TXN.EVAL_INCLUDED_LENGTH","gte":1}'::jsonb,
   false, false, 21, 'EVALUATION.DATES_INCLUDED', true, NULL),
  ('HORSE_LEASE_V2', 'TXN.EVAL_FIXED_LENGTH', 'Length', 'EVALUATION', 'LESSOR',
   'number', 'number', 'number', NULL, NULL, false, false, 20,
   'EVALUATION.DATES_FIXED', false, 'How long the evaluation period lasts (enter the number first).'),
  ('HORSE_LEASE_V2', 'TXN.EVAL_FIXED_UNIT', 'Unit', 'EVALUATION', 'LESSOR',
   'select', 'select', 'select',
   '[{"value":"DAY","label":"day"},{"value":"WEEK","label":"week"},{"value":"MONTH","label":"month"},{"value":"DAYS","label":"days"},{"value":"WEEKS","label":"weeks"},{"value":"MONTHS","label":"months"}]'::jsonb,
   '{"field_key":"TXN.EVAL_FIXED_LENGTH","gte":1}'::jsonb,
   false, false, 21, 'EVALUATION.DATES_FIXED', true, NULL),
  ('HORSE_LEASE_V2', 'TXN.EVAL_FIXED_FEE', 'Evaluation period fee amount', 'EVALUATION', 'LESSOR',
   'currency', 'currency', 'currency', NULL, NULL, false, false, 30,
   'EVALUATION.DATES_FIXED', false, NULL);

-- the two blocks: retitled, re-tokened, mutually exclusive by interaction
UPDATE contract_clause_defs SET
    heading = 'Evaluation Period Details',
    is_optional = true,
    conditional_on = '{"all":[
      {"field_key":"TXN.EVALUATION_ENABLED","equals":["REQUESTED","REQUIRED"]},
      {"field_key":"TXN.EVAL_FIXED_LENGTH","equals":[""]},
      {"field_key":"TXN.EVAL_FIXED_UNIT","equals":[""]},
      {"field_key":"TXN.EVAL_FIXED_FEE","equals":[""]}
    ]}'::jsonb,
    body = 'Lessee shall have an evaluation period of {{TXN.EVAL_INCLUDED_LENGTH}} {{TXN.EVAL_INCLUDED_UNIT}} beginning on the date this Agreement is fully signed by both parties. The evaluation period fee is included at no separate charge, is earned upon commencement of the evaluation period, and is nonrefundable. Either party may terminate this Agreement during the evaluation period by written notice to the other party. Upon such termination, any per-use or lease fees for usage that occurred remain due, and neither party owes the other any further amount under this Agreement except amounts already accrued.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'EVALUATION.DATES_INCLUDED';

UPDATE contract_clause_defs SET
    heading = 'Evaluation Period Details',
    is_optional = true,
    conditional_on = '{"all":[
      {"field_key":"TXN.EVALUATION_ENABLED","equals":["REQUESTED","REQUIRED"]},
      {"field_key":"TXN.EVAL_INCLUDED_LENGTH","equals":[""]},
      {"field_key":"TXN.EVAL_INCLUDED_UNIT","equals":[""]}
    ]}'::jsonb,
    body = 'Lessee shall have an evaluation period of {{TXN.EVAL_FIXED_LENGTH}} {{TXN.EVAL_FIXED_UNIT}} beginning on the date this Agreement is fully signed by both parties. The evaluation period fee is {{TXN.EVAL_FIXED_FEE}}, is earned upon commencement of the evaluation period, and is nonrefundable. Either party may terminate this Agreement during the evaluation period by written notice to the other party. Upon such termination, any per-use or lease fees for usage that occurred remain due, and neither party owes the other any further amount under this Agreement except amounts already accrued.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'EVALUATION.DATES_FIXED';

-- carry live (non-executed) documents' evaluation data into the new per-block
-- fields so nothing typed is lost. FEE_MODE=FIXED → the fixed block (fee amount
-- included); otherwise any entered duration → the included block. Length 1 maps
-- the old plural unit value to its singular twin so the composed text agrees.
INSERT INTO contract_fields
  (org_id, document_id, field_key, label, section, clause_key, owner_role,
   value_type, input_kind, format_type, options, conditional_on, closed, guidance,
   required, is_optional, sort_order, value)
SELECT d.org_id, d.id, fd.field_key, fd.label, fd.section, fd.clause_key, fd.owner_role,
       fd.value_type, nullif(fd.input_kind,''), fd.format_type, fd.options, fd.conditional_on,
       fd.closed, fd.guidance, fd.required, fd.is_optional, fd.sort_order,
       CASE fd.field_key
         WHEN 'TXN.EVAL_FIXED_LENGTH'    THEN v.len
         WHEN 'TXN.EVAL_FIXED_UNIT'      THEN v.unit
         WHEN 'TXN.EVAL_FIXED_FEE'       THEN v.fee
         WHEN 'TXN.EVAL_INCLUDED_LENGTH' THEN v.len
         WHEN 'TXN.EVAL_INCLUDED_UNIT'   THEN v.unit
       END
FROM documents d
JOIN contract_templates ct ON ct.id = d.template_id AND ct.template_key = 'HORSE_LEASE_V2'
CROSS JOIN LATERAL (
  SELECT
    (SELECT coalesce(value,'') FROM contract_fields WHERE document_id = d.id AND field_key = 'TXN.EVALUATION_FEE_MODE')  AS mode,
    (SELECT coalesce(value,'') FROM contract_fields WHERE document_id = d.id AND field_key = 'TXN.EVALUATION_LENGTH')    AS len,
    (SELECT CASE WHEN (SELECT coalesce(value,'') FROM contract_fields WHERE document_id = d.id AND field_key = 'TXN.EVALUATION_LENGTH') = '1'
                 THEN rtrim(coalesce(value,''), 'S') ELSE coalesce(value,'') END
       FROM contract_fields WHERE document_id = d.id AND field_key = 'TXN.EVALUATION_UNIT')                              AS unit,
    (SELECT coalesce(value,'') FROM contract_fields WHERE document_id = d.id AND field_key = 'TXN.EVALUATION_FEE_AMOUNT') AS fee
) v
JOIN contract_field_defs fd
  ON fd.template_key = 'HORSE_LEASE_V2'
 AND fd.field_key = ANY (CASE WHEN v.mode = 'FIXED'
        THEN ARRAY['TXN.EVAL_FIXED_LENGTH','TXN.EVAL_FIXED_UNIT','TXN.EVAL_FIXED_FEE']
        ELSE ARRAY['TXN.EVAL_INCLUDED_LENGTH','TXN.EVAL_INCLUDED_UNIT'] END)
WHERE d.deleted_at IS NULL
  AND d.workflow_state NOT IN ('executed','void','terminated')
  AND (v.len <> '' OR v.unit <> '' OR (v.mode = 'FIXED' AND v.fee <> ''))
ON CONFLICT (document_id, field_key) DO NOTHING;

-- ══ C. LESSONS: individual vs entity ═════════════════════════════════════════

UPDATE contract_clause_defs
   SET conditional_on = '{"field_key":"LESSEE.PARTY_TYPE","equals":["INDIVIDUAL",""]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'TRAINING_LESSONS.LESSONS';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order,
   is_optional, conditional_on, guidance)
VALUES
  ('HORSE_LEASE_V2', 'PERMITTED_USE', 'TRAINING_LESSONS.LESSONS_ENTITY', 'Lessons',
   'Lessee is permitted by Lessor to provide riding lessons with the Horse: {{TXN.LESSONS_ENTITY_PERMITTED}}.',
   'input', 255, false,
   '{"field_key":"LESSEE.PARTY_TYPE","equals":["ENTITY"]}'::jsonb,
   'Whether the entity Lessee may provide riding lessons with the Horse.')
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, conditional_on, required, is_optional, sort_order, clause_key, closed)
VALUES
  ('HORSE_LEASE_V2', 'TXN.LESSONS_ENTITY_PERMITTED',
   'Lessee permitted to provide riding lessons?', 'PERMITTED_USE', 'DEAL',
   'yesno', 'select', 'yesno', NULL, false, false, 10,
   'TRAINING_LESSONS.LESSONS_ENTITY', false)
ON CONFLICT (template_key, field_key) DO NOTHING;

-- ══ D. RESTRICTION GATING (jumping / competition / trail) ════════════════════
-- unset ('') now counts as "no-restrictions box unchecked" → config active.

UPDATE contract_clause_defs SET is_optional = true, conditional_on =
  '{"all":[{"contains":["JUMPING"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["NO",""],"field_key":"TXN.JUMP_OMIT"}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'RESTRICT.JUMP_ON';

UPDATE contract_clause_defs SET is_optional = true, conditional_on =
  '{"all":[{"contains":["COMPETITIONS"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["NO",""],"field_key":"TXN.COMP_OMIT"}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'RESTRICT.COMP_ON';

UPDATE contract_clause_defs SET is_optional = true, conditional_on =
  '{"all":[{"contains":["TRAIL"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["NO",""],"field_key":"TXN.TRAIL_OMIT"}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'RESTRICT.TRAIL_ON';

-- ══ F. ALLOWING OTHERS TO RIDE: Riding Lesson Participants option ════════════
-- Inserted before the "Other" escape. Available (UI-evaluated `when`) only while
-- lessons are permitted: activities include LESSONS, or the entity lessons answer
-- is YES.

UPDATE contract_field_defs SET options =
  '[{"label":"None","value":"NONE"},
    {"label":"Lessee''s family members","value":"FAMILY"},
    {"label":"The trainer/instructor","value":"TRAINER"},
    {"label":"Riding Lesson Participants","value":"LESSON_PARTICIPANTS",
     "when":{"any":[{"field_key":"TXN.PERMITTED_ACTIVITIES","contains":["LESSONS"]},
                    {"field_key":"TXN.LESSONS_ENTITY_PERMITTED","equals":["YES"]}]}},
    {"label":"Other","value":"OTHER"}]'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.OTHERS_ALLOWED';

COMMIT;
