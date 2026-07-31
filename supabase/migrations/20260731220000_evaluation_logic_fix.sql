-- ─────────────────────────────────────────────────────────────────────────────
-- EVALUATION PERIOD: TWO REAL BUGS (2026-07-31, owner's read confirmed)
--
-- BUG 1 — BOTH VARIANTS RENDER AT ONCE. The two length clauses are mutually
-- exclusive in intent (an INCLUDED period with no fee, or a FIXED period with
-- one), but each gate only checked that the OTHER variant's fields were empty:
--
--   DATES_INCLUDED: enabled AND EVAL_FIXED_LENGTH='' AND ..UNIT='' AND ..FEE=''
--   DATES_FIXED:    enabled AND EVAL_INCLUDED_LENGTH='' AND ..UNIT=''
--
-- With the period enabled and NOTHING filled in, both conditions are satisfied,
-- so the contract states the evaluation term twice. Verified against the live
-- predicate: enabled + no lengths → both true.
--
-- Each clause now ALSO requires its OWN length to be present. Empty means the
-- author has not chosen a variant yet, so neither renders, which is correct —
-- an unfilled term should not appear in the prose at all.
--
-- "Is filled" is expressed as gte:1 rather than a negated equals: the condition
-- evaluator supports only all / any / contains / equals / gte, with no negation,
-- and gte parses the value numerically so an empty or non-numeric entry can
-- never satisfy it. A length is a number, so this is exact rather than a
-- workaround.
--
-- BUG 2 — REFUSED / WAIVED RENDERS NOTHING. EVALUATION.CHOICE has an empty body
-- and was the only always-on clause, so choosing "Refused by Lessor" or "Waived
-- by Lessee" produced a section heading with no text under it. The refusal or
-- waiver is a substantive term — it is the record that the parties considered an
-- evaluation period and declined it — and it has to appear in the document.
-- Two new gated clauses state it.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Each variant requires its own fields, not just the other's absence ───
UPDATE contract_clause_defs
   SET conditional_on = jsonb_build_object('all', jsonb_build_array(
         jsonb_build_object('field_key','TXN.EVALUATION_ENABLED','equals',jsonb_build_array('REQUESTED','REQUIRED')),
         jsonb_build_object('field_key','TXN.EVAL_INCLUDED_LENGTH','gte',1),
         jsonb_build_object('field_key','TXN.EVAL_FIXED_LENGTH','equals',jsonb_build_array(''))))
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='EVALUATION.DATES_INCLUDED';

UPDATE contract_clause_defs
   SET conditional_on = jsonb_build_object('all', jsonb_build_array(
         jsonb_build_object('field_key','TXN.EVALUATION_ENABLED','equals',jsonb_build_array('REQUESTED','REQUIRED')),
         jsonb_build_object('field_key','TXN.EVAL_FIXED_LENGTH','gte',1)))
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='EVALUATION.DATES_FIXED';

-- ── 2. Say so when the period is refused or waived ─────────────────────────
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, body, sort_order, conditional_on)
SELECT 'HORSE_LEASE_V2','EVALUATION','EVALUATION.REFUSED',
       'No evaluation period applies to this Agreement. The Lessor has declined to '
    || 'provide an evaluation period, and the Lease begins on the Effective Date without one.',
       40,
       '{"any":[{"field_key":"TXN.EVALUATION_ENABLED","equals":["REFUSED"]}]}'::jsonb
 WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs
                    WHERE template_key='HORSE_LEASE_V2' AND clause_key='EVALUATION.REFUSED');

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, body, sort_order, conditional_on)
SELECT 'HORSE_LEASE_V2','EVALUATION','EVALUATION.WAIVED',
       'No evaluation period applies to this Agreement. The Lessee has waived any '
    || 'evaluation period, and the Lease begins on the Effective Date without one.',
       41,
       '{"any":[{"field_key":"TXN.EVALUATION_ENABLED","equals":["WAIVED"]}]}'::jsonb
 WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs
                    WHERE template_key='HORSE_LEASE_V2' AND clause_key='EVALUATION.WAIVED');
