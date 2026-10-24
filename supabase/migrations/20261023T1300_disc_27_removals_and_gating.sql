-- Phase 27: Part 5 removals + Part 4.2 (trial-insurance gate) + Part 4.5 (orphan
-- MONTHLY_START). Runs after disc_18-26. Everything here is on HORSE_SALE_V3 /
-- HORSE_LEASE_V3 only; the retired V2/SIMPLE/FULL/STANDARD templates (which hold
-- in-flight documents) are untouched.

-- ── Part 5  Removals (column/field/clause/code) ──
-- Sale drug-testing: two clauses gated on the retired TXN.DRUG_TEST_ELECTION gate,
-- and the two drug-test fields. Remove entirely.
DELETE FROM contract_clause_defs WHERE template_key='HORSE_SALE_V3'
  AND clause_key IN ('PPE.DRUG_TESTING','PPE.DRUG_TESTING_DECLINED');
DELETE FROM contract_field_defs WHERE template_key='HORSE_SALE_V3'
  AND field_key IN ('TXN.DRUG_TEST_ELECTION','TXN.DRUG_TEST_WINDOW');

-- Trial deposit choice clause (retired gate). Remove.
DELETE FROM contract_field_defs  WHERE template_key='HORSE_SALE_V3' AND clause_key='TRIAL.DEPOSIT_CHOICE';
DELETE FROM contract_clause_defs WHERE template_key='HORSE_SALE_V3' AND clause_key='TRIAL.DEPOSIT_CHOICE';

-- PPE notice deadline field (no deadline is added to the contingency, Part 3.5). Remove.
DELETE FROM contract_field_defs WHERE template_key='HORSE_SALE_V3' AND field_key='TXN.PPE_NOTICE_DEADLINE';

-- Part 3.5: the fourth PPE timing option has a BLANK label and feeds a duplicate
-- clause (PPE.CONDUCTED_NONE). Remove the blank option from the selector and drop
-- the duplicate clause. The remaining three timings (on or before / prior to
-- delivery / during the evaluation period) stay.
UPDATE contract_field_defs
   SET options = (SELECT jsonb_agg(o) FROM jsonb_array_elements(options) o WHERE o->>'value' <> 'NONE')
 WHERE template_key='HORSE_SALE_V3' AND field_key='TXN.PPE_TIMING';
DELETE FROM contract_clause_defs WHERE template_key='HORSE_SALE_V3' AND clause_key='PPE.CONDUCTED_NONE';

-- ── Part 4.5  Orphan field: TXN.MONTHLY_START on V3 is attached to a clause
--    (LEASE_FEE.PAYMENTS) that does not exist on V3, and nothing references it.
--    Remove it from V3 only.
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V3' AND field_key='TXN.MONTHLY_START';

-- ── Part 4.2  Sale trial-insurance clause is gated on trial enabled = Yes ──
-- TRIAL.INSURANCE spoke to the trial period but had no condition, so it printed on
-- every sale. Gate it on TXN.TRIAL_ENABLED = YES.
UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["YES"], "field_key": "TXN.TRIAL_ENABLED"}'::jsonb
 WHERE template_key='HORSE_SALE_V3' AND clause_key='TRIAL.INSURANCE';
