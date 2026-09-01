-- HORSE_LEASE_V2 owner wording edits (contract-wording agent, 2026-07-29)
-- 1. PERMITTED_USE.RELEASES_REQUIRED — owner-final rewrite: all non-Lessee persons must
--    have executed Lessee's liability release, reviewed and approved by Lessor.
-- 2. Definitions relocation — the party-group definitions / binding-effect /
--    third-party-beneficiaries paragraph (added 20260727120000 as the first clause of
--    INSURANCE_RISK, rendering as 13.1) moves to its OWN standalone section placed
--    directly after PURPOSE, because "Lessor Parties"/"Lessee Parties" are first used
--    in PERMITTED_USE (two sections before the current definition) and the binding-
--    effect / third-party-beneficiary language governs the entire agreement, not just
--    insurance. The clause row is re-keyed DEFINITIONS.MAIN (nothing references the old
--    key: zero contract_field_defs / contract_fields rows, no conditional_on, no src
--    reference), its heading is cleared (the new section carries the title), and it
--    thereby leaves INSURANCE_RISK — the rest of that section is untouched.
--    NOTE: section numbers after PURPOSE shift by one on next remerge (e.g. the
--    insurance section 13 -> 14); numbering is computed, nothing else to update.
-- 3. INSURANCE_RISK.CCC — "effective no later than" -> "with an effective start date
--    no later than".
-- 4. INSURANCE_RISK.MED_TAIL — owner-final replacement of the deductible/cost-advance
--    paragraph (body text only; clause_type/conditional_on untouched — this clause sits
--    in the medical-coverage zone owned by another workstream).
-- Executed documents are untouched (remerge skips workflow_state = 'executed').

BEGIN;

-- EDIT 1 — releases required for authorized riders
UPDATE contract_clause_defs SET body =
'All persons other than Lessee must have executed Lessee''s liability release, which has been reviewed and approved by Lessor, prior to handling or riding the Horse. Lessee is responsible for ensuring this requirement is satisfied before permitting any authorized person to ride or handle the Horse.'
WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PERMITTED_USE.RELEASES_REQUIRED';

-- EDIT 2 — standalone definitions section after PURPOSE (20) / before SCHEDULE (25)
INSERT INTO contract_section_defs (template_key, section_key, heading, sort_order)
VALUES ('HORSE_LEASE_V2', 'DEFINITIONS', 'Definitions; Binding Effect; Third-Party Beneficiaries', 22)
ON CONFLICT (template_key, section_key) DO UPDATE
  SET heading = EXCLUDED.heading, sort_order = EXCLUDED.sort_order;

UPDATE contract_clause_defs
   SET section_key = 'DEFINITIONS',
       clause_key  = 'DEFINITIONS.MAIN',
       heading     = NULL,
       sort_order  = 10
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.DEFINITIONS';

-- EDIT 3 — CCC insurance effective-date phrasing
UPDATE contract_clause_defs SET body =
'Lessee shall obtain and maintain, for the duration of this Agreement, care, custody and control insurance covering the Horse while in Lessee''s care, custody, or control, with a death benefit limit of not less than the Horse''s current fair market value of {{HORSE.FAIR_MARKET_VALUE}}, with an effective start date no later than the commencement of this Agreement. Lessee shall provide proof of coverage to Lessor upon request and shall maintain the policy in good standing for the duration of this Agreement; failure to do so constitutes a material breach subject to the Termination for Cause provisions of this Agreement.'
WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.CCC';

-- EDIT 4 — medical-coverage deductible/cost paragraph (body only)
UPDATE contract_clause_defs SET body =
'Any out-of-pocket costs for deductibles or other expenses related to the needs of the Horse are to be paid by Lessor, and where Lessee is deemed to be responsible for part or all of a cost paid by Lessor, Lessee shall reimburse Lessor in accordance with the acceptable payment methods stated in this Agreement, or, if Lessee so requests prior to payment by Lessor, Lessee may make such request to pay the billing party directly using a method allowed by that party. Lessee may, with Lessor''s written permission, pay for any or all of Lessor''s portion when paying the billing party directly, and Lessor may reimburse Lessee in accordance with the terms of this Agreement. Lessor assumes and is responsible for all risks and costs not paid or covered by any policy held by either party, including in the event a policy is not in effect at the time of the incident, an incident for which a claim is made is deemed not to be covered by a policy, a payment for a claim made for an incident that is covered by a policy is less than the actual cost incurred, or a claim made to a policy is denied for any reason.'
WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MED_TAIL';

-- Verify all four edits landed
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key = 'HORSE_LEASE_V2'
     AND clause_key = 'PERMITTED_USE.RELEASES_REQUIRED'
     AND body LIKE 'All persons other than Lessee must have executed Lessee''s liability release%';
  IF v_n <> 1 THEN RAISE EXCEPTION 'EDIT 1 (RELEASES_REQUIRED) did not land'; END IF;

  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key = 'HORSE_LEASE_V2'
     AND clause_key = 'DEFINITIONS.MAIN' AND section_key = 'DEFINITIONS'
     AND heading IS NULL
     AND body LIKE '"Lessor Parties" means Lessor and, as applicable%'
     AND body LIKE '%may enforce them directly.';
  IF v_n <> 1 THEN RAISE EXCEPTION 'EDIT 2 (definitions relocation) did not land'; END IF;

  IF EXISTS (SELECT 1 FROM contract_clause_defs
              WHERE template_key = 'HORSE_LEASE_V2'
                AND clause_key = 'INSURANCE_RISK.DEFINITIONS') THEN
    RAISE EXCEPTION 'EDIT 2: old INSURANCE_RISK.DEFINITIONS row still present';
  END IF;

  SELECT count(*) INTO v_n FROM contract_section_defs
   WHERE template_key = 'HORSE_LEASE_V2' AND section_key = 'DEFINITIONS' AND sort_order = 22;
  IF v_n <> 1 THEN RAISE EXCEPTION 'EDIT 2: DEFINITIONS section row missing'; END IF;

  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.CCC'
     AND body LIKE '%with an effective start date no later than the commencement%'
     AND body NOT LIKE '%, effective no later than%';
  IF v_n <> 1 THEN RAISE EXCEPTION 'EDIT 3 (CCC) did not land'; END IF;

  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MED_TAIL'
     AND body LIKE 'Any out-of-pocket costs for deductibles%'
     AND body LIKE '%denied for any reason.'
     AND clause_type = 'input'
     AND conditional_on = '{"equals": ["COVERED"], "field_key": "TXN.MED_COVERAGE"}'::jsonb;
  IF v_n <> 1 THEN RAISE EXCEPTION 'EDIT 4 (MED_TAIL) did not land or gating changed'; END IF;
END $$;

COMMIT;
