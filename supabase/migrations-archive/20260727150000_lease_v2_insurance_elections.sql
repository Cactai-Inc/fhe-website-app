-- HORSE_LEASE_V2: insurance election redesign (owner decision 2026-07-27)
--
-- Replaces the questionnaire-style insurance clauses (Require X? YES/NO + manual
-- minimums + cost/obtain parties) with a per-type Lessor ELECTION rendered as prose:
--   LESSOR_HAS     Lessor carries the policy (limit, deductible, effective date past/present)
--   LESSOR_WILL    Lessor will purchase (limit, deductible, effective date no later than)
--   LESSEE_OBTAIN  Lessor requires Lessee to obtain (min limit, proof by email,
--                  maintain in good standing; failure = material breach -> Termination for Cause)
--   NONE / unset   nothing renders
-- Applies to GENERAL_LIABILITY, MORTALITY, MAJOR_MEDICAL.
--
-- Key fix: the Lessee-obtain MORTALITY minimum is IMPORTED from the horse record
-- ({{HORSE.FAIR_MARKET_VALUE}}), never manually entered — eliminating the
-- min-limit vs FMV mismatch. The Limitation of Liability cap follows the election:
-- actual Lessor policy limit when Lessor has/will have the policy, FMV otherwise.
--
-- Loss of use (owner: exclude loss-of-use insurance entirely):
--   * INSURANCE_RISK.LOSS_OF_USE_ACK — Lessor accepts loss of use may result from
--     injury/illness/death; no loss-of-use insurance under this Agreement.
--   * TERMINATION.LOSS_OF_USE — Lessee's elective right to terminate immediately
--     by written notice if the Horse becomes unusable (prorated refund).
--
-- Pattern: controlling ELECTION field sits on the always-visible per-type title
-- clause; prose variants are headingless clauses conditional on the election
-- (same mechanism as RESTRICT.JUMP_TITLE / JUMP_ON / JUMP_OFF).
-- Executed documents are untouched (remerge skips them).

BEGIN;

-- ============================================================================
-- 1. Retire the 13 questionnaire fields
-- ============================================================================
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN (
     'TXN.GL_INSURANCE_REQ','TXN.GL_REQUIRED_BY','TXN.GL_PROTECTION',
     'TXN.GL_COST_PARTY','TXN.GL_OBTAIN_PARTY',
     'TXN.MORTALITY_INSURANCE_REQ','TXN.MORTALITY_MIN_LIMIT',
     'TXN.MORTALITY_COST_PARTY','TXN.MORTALITY_OBTAIN_PARTY',
     'TXN.MAJOR_MEDICAL_INSURANCE_REQ','TXN.MAJOR_MEDICAL_MIN_LIMIT',
     'TXN.MAJOR_MEDICAL_COST_PARTY','TXN.MAJOR_MEDICAL_OBTAIN_PARTY');

-- ============================================================================
-- 2. New election fields (per type: election, policy amount, deductible,
--    min limit for Lessee-obtain [GL + MM only; mortality imports FMV],
--    effective date, deductible-responsibility party)
-- ============================================================================
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, clause_key, owner_role,
   input_kind, value_type, format_type, options, conditional_on, guidance, required, sort_order)
VALUES
-- ---- General liability ----
('HORSE_LEASE_V2','TXN.GL_ELECTION','General liability insurance election','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY','LESSOR',
 'select','select','select',
 '[{"value":"LESSOR_HAS","label":"Lessor has this policy"},{"value":"LESSOR_WILL","label":"Lessor will purchase this policy"},{"value":"LESSEE_OBTAIN","label":"Lessee must obtain this policy"},{"value":"NONE","label":"Not required"}]'::jsonb,
 NULL,'Lessor elects how general liability coverage is handled. Select "Not required" (or leave unset) to omit the clause.',false,10),
('HORSE_LEASE_V2','TXN.GL_POLICY_AMOUNT','Policy limit','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY','LESSOR',
 'currency','currency','currency',NULL,
 '{"equals":["LESSOR_HAS","LESSOR_WILL"],"field_key":"TXN.GL_ELECTION"}'::jsonb,
 NULL,false,20),
('HORSE_LEASE_V2','TXN.GL_DEDUCTIBLE','Deductible (enter N/A if none)','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY','LESSOR',
 'text','text',NULL,NULL,
 '{"equals":["LESSOR_HAS","LESSOR_WILL"],"field_key":"TXN.GL_ELECTION"}'::jsonb,
 NULL,false,30),
('HORSE_LEASE_V2','TXN.GL_MIN_LIMIT','Minimum policy limit required of Lessee','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY','LESSOR',
 'currency','currency','currency',NULL,
 '{"equals":["LESSEE_OBTAIN"],"field_key":"TXN.GL_ELECTION"}'::jsonb,
 NULL,false,40),
('HORSE_LEASE_V2','TXN.GL_EFFECTIVE_DATE','Effective date','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY','LESSOR',
 'date','date','date',NULL,
 '{"equals":["LESSOR_HAS","LESSOR_WILL","LESSEE_OBTAIN"],"field_key":"TXN.GL_ELECTION"}'::jsonb,
 '"Lessor has": the policy''s actual effective date (today or earlier). "Will purchase" / "Lessee must obtain": the latest acceptable effective date (today or later).',false,50),
('HORSE_LEASE_V2','TXN.GL_DEDUCTIBLE_PARTY','Party responsible for deductibles on claims','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY','LESSOR',
 'select','select','select',
 '[{"value":"LESSOR","label":"Lessor"},{"value":"LESSEE","label":"Lessee"}]'::jsonb,
 '{"equals":["LESSOR_HAS","LESSOR_WILL","LESSEE_OBTAIN"],"field_key":"TXN.GL_ELECTION"}'::jsonb,
 NULL,false,60),
-- ---- Mortality (Lessee-obtain minimum = FMV, imported; no manual limit field) ----
('HORSE_LEASE_V2','TXN.MORTALITY_ELECTION','Mortality insurance election','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'select','select','select',
 '[{"value":"LESSOR_HAS","label":"Lessor has this policy"},{"value":"LESSOR_WILL","label":"Lessor will purchase this policy"},{"value":"LESSEE_OBTAIN","label":"Lessee must obtain this policy"},{"value":"NONE","label":"Not required"}]'::jsonb,
 NULL,'FHE note: our care, custody & control policy limit is $25,000. When "Lessee must obtain" is selected, the required minimum auto-fills from the horse''s fair market value — if that FMV exceeds $25,000 and FHE is the Lessee, current coverage is insufficient; escalate before sending.',false,10),
('HORSE_LEASE_V2','TXN.MORTALITY_POLICY_AMOUNT','Policy limit','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'currency','currency','currency',NULL,
 '{"equals":["LESSOR_HAS","LESSOR_WILL"],"field_key":"TXN.MORTALITY_ELECTION"}'::jsonb,
 NULL,false,20),
('HORSE_LEASE_V2','TXN.MORTALITY_DEDUCTIBLE','Deductible (enter N/A if none)','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'text','text',NULL,NULL,
 '{"equals":["LESSOR_HAS","LESSOR_WILL"],"field_key":"TXN.MORTALITY_ELECTION"}'::jsonb,
 NULL,false,30),
('HORSE_LEASE_V2','TXN.MORTALITY_EFFECTIVE_DATE','Effective date','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'date','date','date',NULL,
 '{"equals":["LESSOR_HAS","LESSOR_WILL","LESSEE_OBTAIN"],"field_key":"TXN.MORTALITY_ELECTION"}'::jsonb,
 '"Lessor has": the policy''s actual effective date (today or earlier). "Will purchase" / "Lessee must obtain": the latest acceptable effective date (today or later).',false,40),
('HORSE_LEASE_V2','TXN.MORTALITY_DEDUCTIBLE_PARTY','Party responsible for deductibles on claims','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'select','select','select',
 '[{"value":"LESSOR","label":"Lessor"},{"value":"LESSEE","label":"Lessee"}]'::jsonb,
 '{"equals":["LESSOR_HAS","LESSOR_WILL","LESSEE_OBTAIN"],"field_key":"TXN.MORTALITY_ELECTION"}'::jsonb,
 NULL,false,50),
-- ---- Major medical ----
('HORSE_LEASE_V2','TXN.MAJOR_MEDICAL_ELECTION','Major medical insurance election','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL','LESSOR',
 'select','select','select',
 '[{"value":"LESSOR_HAS","label":"Lessor has this policy"},{"value":"LESSOR_WILL","label":"Lessor will purchase this policy"},{"value":"LESSEE_OBTAIN","label":"Lessee must obtain this policy"},{"value":"NONE","label":"Not required"}]'::jsonb,
 NULL,'Lessor elects how major medical coverage is handled. Select "Not required" (or leave unset) to omit the clause.',false,10),
('HORSE_LEASE_V2','TXN.MAJOR_MEDICAL_POLICY_AMOUNT','Policy limit','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL','LESSOR',
 'currency','currency','currency',NULL,
 '{"equals":["LESSOR_HAS","LESSOR_WILL"],"field_key":"TXN.MAJOR_MEDICAL_ELECTION"}'::jsonb,
 NULL,false,20),
('HORSE_LEASE_V2','TXN.MAJOR_MEDICAL_DEDUCTIBLE','Deductible (enter N/A if none)','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL','LESSOR',
 'text','text',NULL,NULL,
 '{"equals":["LESSOR_HAS","LESSOR_WILL"],"field_key":"TXN.MAJOR_MEDICAL_ELECTION"}'::jsonb,
 NULL,false,30),
('HORSE_LEASE_V2','TXN.MAJOR_MEDICAL_MIN_LIMIT','Minimum policy limit required of Lessee','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL','LESSOR',
 'currency','currency','currency',NULL,
 '{"equals":["LESSEE_OBTAIN"],"field_key":"TXN.MAJOR_MEDICAL_ELECTION"}'::jsonb,
 NULL,false,40),
('HORSE_LEASE_V2','TXN.MAJOR_MEDICAL_EFFECTIVE_DATE','Effective date','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL','LESSOR',
 'date','date','date',NULL,
 '{"equals":["LESSOR_HAS","LESSOR_WILL","LESSEE_OBTAIN"],"field_key":"TXN.MAJOR_MEDICAL_ELECTION"}'::jsonb,
 '"Lessor has": the policy''s actual effective date (today or earlier). "Will purchase" / "Lessee must obtain": the latest acceptable effective date (today or later).',false,50),
('HORSE_LEASE_V2','TXN.MAJOR_MEDICAL_DEDUCTIBLE_PARTY','Party responsible for deductibles on claims','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL','LESSOR',
 'select','select','select',
 '[{"value":"LESSOR","label":"Lessor"},{"value":"LESSEE","label":"Lessee"}]'::jsonb,
 '{"equals":["LESSOR_HAS","LESSOR_WILL","LESSEE_OBTAIN"],"field_key":"TXN.MAJOR_MEDICAL_ELECTION"}'::jsonb,
 NULL,false,60)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label = EXCLUDED.label, section = EXCLUDED.section, clause_key = EXCLUDED.clause_key,
      owner_role = EXCLUDED.owner_role, input_kind = EXCLUDED.input_kind,
      value_type = EXCLUDED.value_type, format_type = EXCLUDED.format_type,
      options = EXCLUDED.options, conditional_on = EXCLUDED.conditional_on,
      guidance = EXCLUDED.guidance, required = EXCLUDED.required, sort_order = EXCLUDED.sort_order;

-- ============================================================================
-- 3. Title clauses become heading-only anchors; intro rewritten
-- ============================================================================
UPDATE contract_clause_defs SET body =
'The parties agree to the insurance elections set forth below. Each policy elected or required below shall be maintained in effect for the duration of this Agreement.'
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.INSURANCE';

UPDATE contract_clause_defs SET body = '', clause_type = 'input'
WHERE template_key='HORSE_LEASE_V2'
  AND clause_key IN ('INSURANCE_RISK.GENERAL_LIABILITY','INSURANCE_RISK.MORTALITY','INSURANCE_RISK.MAJOR_MEDICAL');

-- ============================================================================
-- 4. Prose election variants (headingless, conditional — JUMP_ON/OFF pattern)
-- ============================================================================
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
-- ---- General liability (title @15) ----
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.GL_HAS',NULL,
 'Lessor carries general liability insurance covering the activities contemplated by this Agreement, with a policy limit of {{TXN.GL_POLICY_AMOUNT}} and a deductible of {{TXN.GL_DEDUCTIBLE}}, effective as of {{TXN.GL_EFFECTIVE_DATE}}. {{TXN.GL_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy.',
 'input',16,false,'{"equals":["LESSOR_HAS"],"field_key":"TXN.GL_ELECTION"}'::jsonb),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.GL_WILL',NULL,
 'Lessor is in the process of purchasing or agrees to purchase general liability insurance covering the activities contemplated by this Agreement, with a policy limit of {{TXN.GL_POLICY_AMOUNT}} and a deductible of {{TXN.GL_DEDUCTIBLE}}, and an effective date no later than {{TXN.GL_EFFECTIVE_DATE}}. {{TXN.GL_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy.',
 'input',17,false,'{"equals":["LESSOR_WILL"],"field_key":"TXN.GL_ELECTION"}'::jsonb),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.GL_LESSEE',NULL,
 'Lessor requires Lessee to obtain and maintain general liability insurance covering the activities contemplated by this Agreement, with a policy limit of at least {{TXN.GL_MIN_LIMIT}} and an effective date no later than {{TXN.GL_EFFECTIVE_DATE}}. {{TXN.GL_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy. Lessee shall provide proof of insurance to Lessor by email and shall maintain the policy in good standing for the duration of this Agreement; failure to do so constitutes a material breach subject to the Termination for Cause provisions of this Agreement.',
 'input',18,false,'{"equals":["LESSEE_OBTAIN"],"field_key":"TXN.GL_ELECTION"}'::jsonb),
-- ---- Mortality (title @20; Lessee-obtain minimum = FMV, imported) ----
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORTALITY_HAS',NULL,
 'Lessor carries mortality insurance on the Horse with a policy limit of {{TXN.MORTALITY_POLICY_AMOUNT}} and a deductible of {{TXN.MORTALITY_DEDUCTIBLE}}, effective as of {{TXN.MORTALITY_EFFECTIVE_DATE}}. {{TXN.MORTALITY_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy.',
 'input',21,false,'{"equals":["LESSOR_HAS"],"field_key":"TXN.MORTALITY_ELECTION"}'::jsonb),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORTALITY_WILL',NULL,
 'Lessor is in the process of purchasing or agrees to purchase mortality insurance on the Horse with a policy limit of {{TXN.MORTALITY_POLICY_AMOUNT}} and a deductible of {{TXN.MORTALITY_DEDUCTIBLE}}, and an effective date no later than {{TXN.MORTALITY_EFFECTIVE_DATE}}. {{TXN.MORTALITY_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy.',
 'input',22,false,'{"equals":["LESSOR_WILL"],"field_key":"TXN.MORTALITY_ELECTION"}'::jsonb),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORTALITY_LESSEE',NULL,
 'Lessor requires Lessee to obtain and maintain mortality insurance on the Horse with a policy limit of at least the Horse''s fair market value of {{HORSE.FAIR_MARKET_VALUE}} and an effective date no later than {{TXN.MORTALITY_EFFECTIVE_DATE}}. {{TXN.MORTALITY_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy. Lessee shall provide proof of insurance to Lessor by email and shall maintain the policy in good standing for the duration of this Agreement; failure to do so constitutes a material breach subject to the Termination for Cause provisions of this Agreement.',
 'input',23,false,'{"equals":["LESSEE_OBTAIN"],"field_key":"TXN.MORTALITY_ELECTION"}'::jsonb),
-- ---- Major medical (title @30) ----
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL_HAS',NULL,
 'Lessor carries major medical insurance on the Horse with a policy limit of {{TXN.MAJOR_MEDICAL_POLICY_AMOUNT}} and a deductible of {{TXN.MAJOR_MEDICAL_DEDUCTIBLE}}, effective as of {{TXN.MAJOR_MEDICAL_EFFECTIVE_DATE}}. {{TXN.MAJOR_MEDICAL_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy.',
 'input',31,false,'{"equals":["LESSOR_HAS"],"field_key":"TXN.MAJOR_MEDICAL_ELECTION"}'::jsonb),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL_WILL',NULL,
 'Lessor is in the process of purchasing or agrees to purchase major medical insurance on the Horse with a policy limit of {{TXN.MAJOR_MEDICAL_POLICY_AMOUNT}} and a deductible of {{TXN.MAJOR_MEDICAL_DEDUCTIBLE}}, and an effective date no later than {{TXN.MAJOR_MEDICAL_EFFECTIVE_DATE}}. {{TXN.MAJOR_MEDICAL_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy.',
 'input',32,false,'{"equals":["LESSOR_WILL"],"field_key":"TXN.MAJOR_MEDICAL_ELECTION"}'::jsonb),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL_LESSEE',NULL,
 'Lessor requires Lessee to obtain and maintain major medical insurance on the Horse with a policy limit of at least {{TXN.MAJOR_MEDICAL_MIN_LIMIT}} and an effective date no later than {{TXN.MAJOR_MEDICAL_EFFECTIVE_DATE}}. {{TXN.MAJOR_MEDICAL_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy. Lessee shall provide proof of insurance to Lessor by email and shall maintain the policy in good standing for the duration of this Agreement; failure to do so constitutes a material breach subject to the Termination for Cause provisions of this Agreement.',
 'input',33,false,'{"equals":["LESSEE_OBTAIN"],"field_key":"TXN.MAJOR_MEDICAL_ELECTION"}'::jsonb),
-- ---- Explicit "not required" variants (render when election is NONE or unset,
--      so the title heading is never an orphan) ----
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.GL_NONE',NULL,
 'No general liability insurance is required under this Agreement.',
 'input',19,false,'{"equals":["NONE",""],"field_key":"TXN.GL_ELECTION"}'::jsonb),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORTALITY_NONE',NULL,
 'No mortality insurance is required under this Agreement.',
 'input',24,false,'{"equals":["NONE",""],"field_key":"TXN.MORTALITY_ELECTION"}'::jsonb),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL_NONE',NULL,
 'No major medical insurance is required under this Agreement.',
 'input',34,false,'{"equals":["NONE",""],"field_key":"TXN.MAJOR_MEDICAL_ELECTION"}'::jsonb),
-- ---- Loss of use acknowledgment (after RISK_OF_LOSS @50) ----
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.LOSS_OF_USE_ACK','Loss of Use',
 'Lessor acknowledges and accepts that loss of use of the Horse may result from injury to, illness of, or the death of the Horse. No loss-of-use insurance is required or provided under this Agreement.',
 'prose',55,false,NULL),
-- ---- Lessee's elective termination on loss of use (after TERMINATION.LOSS @40) ----
('HORSE_LEASE_V2','TERMINATION','TERMINATION.LOSS_OF_USE','Termination upon Loss of Use',
 'If the Horse becomes unusable for the purposes of this Agreement for any reason, Lessee may terminate this Agreement immediately upon written notice to Lessor. Upon such termination, Lessee is entitled to a prorated refund of any Lease Fee paid for the remaining unused time as of the date of termination.',
 'prose',45,false,NULL)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET heading = EXCLUDED.heading, body = EXCLUDED.body, clause_type = EXCLUDED.clause_type,
      sort_order = EXCLUDED.sort_order, is_optional = EXCLUDED.is_optional,
      conditional_on = EXCLUDED.conditional_on;

-- ============================================================================
-- 5. Limitation of Liability re-anchored to the election:
--    Lessor has/will → the actual stated policy limit; Lessee-obtain / none → FMV
-- ============================================================================
UPDATE contract_clause_defs SET
  body = 'Under no circumstances shall either party be liable to the other for any special, consequential, incidental, or punitive damages arising out of or relating to this Agreement. The total aggregate liability of either party (including, respectively, the Lessor Parties and the Lessee Parties) to the other under this Agreement shall not exceed the mortality insurance policy limit of {{TXN.MORTALITY_POLICY_AMOUNT}}. Any amount owed by one party to the other under this Agreement shall be reduced by the amount of any insurance proceeds actually received by the party owed with respect to the same loss. This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct.',
  conditional_on = '{"equals":["LESSOR_HAS","LESSOR_WILL"],"field_key":"TXN.MORTALITY_ELECTION"}'::jsonb
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.LIMITATION_MORTALITY';

UPDATE contract_clause_defs SET
  conditional_on = '{"equals":["LESSEE_OBTAIN","NONE",""],"field_key":"TXN.MORTALITY_ELECTION"}'::jsonb
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.LIMITATION_FMV';

-- ============================================================================
-- 6. Verify
-- ============================================================================
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM contract_field_defs
   WHERE template_key='HORSE_LEASE_V2' AND section = 'INSURANCE_RISK'
     AND (field_key LIKE '%_INSURANCE_REQ' OR field_key IN
          ('TXN.GL_REQUIRED_BY','TXN.GL_PROTECTION','TXN.MORTALITY_MIN_LIMIT')
          OR field_key LIKE '%_COST_PARTY' OR field_key LIKE '%_OBTAIN_PARTY');
  IF v_n <> 0 THEN RAISE EXCEPTION 'old questionnaire fields survive: %', v_n; END IF;

  SELECT count(*) INTO v_n FROM contract_field_defs
   WHERE template_key='HORSE_LEASE_V2' AND field_key LIKE 'TXN.%_ELECTION';
  IF v_n <> 3 THEN RAISE EXCEPTION 'expected 3 election fields, found %', v_n; END IF;

  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2'
     AND clause_key IN ('INSURANCE_RISK.GL_HAS','INSURANCE_RISK.GL_WILL','INSURANCE_RISK.GL_LESSEE',
                        'INSURANCE_RISK.MORTALITY_HAS','INSURANCE_RISK.MORTALITY_WILL','INSURANCE_RISK.MORTALITY_LESSEE',
                        'INSURANCE_RISK.MAJOR_MEDICAL_HAS','INSURANCE_RISK.MAJOR_MEDICAL_WILL','INSURANCE_RISK.MAJOR_MEDICAL_LESSEE',
                        'INSURANCE_RISK.GL_NONE','INSURANCE_RISK.MORTALITY_NONE','INSURANCE_RISK.MAJOR_MEDICAL_NONE',
                        'INSURANCE_RISK.LOSS_OF_USE_ACK','TERMINATION.LOSS_OF_USE');
  IF v_n <> 14 THEN RAISE EXCEPTION 'expected 14 new clauses, found %', v_n; END IF;

  IF EXISTS (SELECT 1 FROM contract_clause_defs
              WHERE template_key='HORSE_LEASE_V2'
                AND clause_key='INSURANCE_RISK.LIMITATION_MORTALITY'
                AND body LIKE '%TXN.MORTALITY_MIN_LIMIT%') THEN
    RAISE EXCEPTION 'limitation clause still references the retired manual minimum';
  END IF;

  -- every token referenced by the new clause bodies must resolve to a live field def
  -- (HORSE.* comes from the horse record; DOC.* from the document)
  SELECT count(*) INTO v_n FROM (
    SELECT DISTINCT tok FROM contract_clause_defs c,
      LATERAL regexp_matches(c.body, '\{\{(TXN\.[A-Z0-9_.]+)\}\}', 'g') m(tok)
    WHERE c.template_key='HORSE_LEASE_V2' AND c.section_key IN ('INSURANCE_RISK','TERMINATION')
  ) t
  WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs f
                     WHERE f.template_key='HORSE_LEASE_V2' AND f.field_key = t.tok[1]);
  IF v_n <> 0 THEN RAISE EXCEPTION '% orphan TXN tokens in insurance/termination clause bodies', v_n; END IF;
END $$;

COMMIT;
