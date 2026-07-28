-- HORSE_LEASE_V2 hardening (owner change list, HORSE_LEASE_V2_HARDENING_CHANGES.md 2026-07-27)
-- 1. NEW clause INSURANCE_RISK.DEFINITIONS — party-group definitions, binding effect,
--    third-party beneficiaries; renders first in the section.
-- 2-4, 6-8. REPLACE bodies: ASSUMPTION_INHERENT, RELEASE, SAFETY_ATTIRE,
--    INDEMNIFICATION, WAIVER_UNKNOWN, LESSEE_REPS.MAIN — thread "Lessor Parties" /
--    "Lessee Parties" through, add the gross-negligence/reckless/intentional carve-out,
--    drop the unenforceable absolute-bar tail from the attire clause.
-- 5. NEW conditional clause pair INSURANCE_RISK.LIMITATION_MORTALITY / LIMITATION_FMV —
--    mutual limitation of liability capped at the mortality minimum limit when
--    TXN.MORTALITY_INSURANCE_REQ = YES, else the horse's fair market value.
--    Unset field evaluates as '' in clause_condition_met, so the FMV branch uses
--    equals ["NO",""] to cover "NO or unset".
-- Executed documents are untouched (remerge_contract_from_clauses skips them).

BEGIN;

-- CHANGE 1 — new definitions clause, first in INSURANCE_RISK (before INSURANCE @ 10)
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.DEFINITIONS',
   'Definitions; Binding Effect; Third-Party Beneficiaries',
   '"Lessor Parties" means Lessor and, as applicable, Lessor''s owners, principals, proprietors, partners, employees, trainers, instructors, agents, contractors, and family members of any of the foregoing, and each of their respective heirs and assigns. "Lessee Parties" means Lessee and Lessee''s heirs, next of kin, estate, executors, administrators, legal representatives, and assigns. Lessee enters into this Agreement on behalf of Lessee and all Lessee Parties, and all releases, waivers, assumptions of risk, and covenants made by Lessee under this Agreement are made on behalf of all Lessee Parties and bind each of them to the same extent as Lessee. Each Lessor Party and each Lessee Party is an intended third-party beneficiary of the releases, waivers, assumptions of risk, and limitations of liability in this Agreement and may enforce them directly.',
   'prose', 5, false, NULL)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET heading = EXCLUDED.heading, body = EXCLUDED.body, clause_type = EXCLUDED.clause_type,
      sort_order = EXCLUDED.sort_order, is_optional = EXCLUDED.is_optional,
      conditional_on = EXCLUDED.conditional_on;

-- CHANGE 5 — limitation-of-liability pair, after INDEMNIFICATION (@ 140), end of section
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.LIMITATION_MORTALITY',
   'Limitation of Liability',
   'Under no circumstances shall either party be liable to the other for any special, consequential, incidental, or punitive damages arising out of or relating to this Agreement. The total aggregate liability of either party (including, respectively, the Lessor Parties and the Lessee Parties) to the other under this Agreement shall not exceed the mortality insurance minimum limit of {{TXN.MORTALITY_MIN_LIMIT}}. Any amount owed by one party to the other under this Agreement shall be reduced by the amount of any insurance proceeds actually received by the party owed with respect to the same loss. This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct.',
   'prose', 150, false,
   '{"equals": ["YES"], "field_key": "TXN.MORTALITY_INSURANCE_REQ"}'::jsonb),
  ('HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.LIMITATION_FMV',
   'Limitation of Liability',
   'Under no circumstances shall either party be liable to the other for any special, consequential, incidental, or punitive damages arising out of or relating to this Agreement. The total aggregate liability of either party (including, respectively, the Lessor Parties and the Lessee Parties) to the other under this Agreement shall not exceed the Horse''s current fair market value of {{HORSE.FAIR_MARKET_VALUE}}. Any amount owed by one party to the other under this Agreement shall be reduced by the amount of any insurance proceeds actually received by the party owed with respect to the same loss. This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct.',
   'prose', 152, false,
   '{"equals": ["NO", ""], "field_key": "TXN.MORTALITY_INSURANCE_REQ"}'::jsonb)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET heading = EXCLUDED.heading, body = EXCLUDED.body, clause_type = EXCLUDED.clause_type,
      sort_order = EXCLUDED.sort_order, is_optional = EXCLUDED.is_optional,
      conditional_on = EXCLUDED.conditional_on;

-- CHANGE 2 — assumption of inherent risks: Lessee Parties + no-duty framing
UPDATE contract_clause_defs SET body =
'Lessee understands that horseback riding and handling horses are inherently dangerous activities. Lessee acknowledges that horses are unpredictable by nature and may buck, rear, bite, kick, spook, stumble, or otherwise react unpredictably to their environment, which can result in severe injury, paralysis, or death. Lessee acknowledges the California common law doctrine of "Primary Assumption of Risk," as established by the California Supreme Court in Knight v. Jewett (1992) 3 Cal.4th 296 and subsequent equine-specific case law (e.g., Levinson v. Owens (2009) 176 Cal.App.4th 1534). Pursuant to this binding legal precedent, Lessee, on behalf of all Lessee Parties, expressly and voluntarily assumes all inherent risks associated with riding or handling the Horse, and acknowledges that no Lessor Party owes a duty to protect Lessee from these inherent risks.'
WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.ASSUMPTION_INHERENT';

-- CHANGE 3 — release: party groups + gross-negligence/reckless/intentional carve-out
UPDATE contract_clause_defs SET body =
'In consideration for being permitted to handle or ride the Horse, Lessee, on behalf of Lessee and all Lessee Parties, completely releases, forever discharges, and agrees to hold harmless the Lessor Parties from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessee''s use, handling, or riding of the Horse, whether caused by the ordinary negligence of any Lessor Party or otherwise. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.'
WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.RELEASE';

-- CHANGE 4 — attire: keep revocation + material breach, drop the absolute claim-bar tail
UPDATE contract_clause_defs SET body =
'Lessee is strictly required to wear an appropriately fitted and securely fastened ASTM/SEI-certified equestrian helmet at all times while mounted on the Horse, together with heeled boots and long pants; gloves and long sleeves are highly recommended. Lessee shall provide Lessee''s own helmet, boots, and pants meeting these requirements. Lessee, on behalf of all Lessee Parties, assumes all increased risk of injury or death resulting from any failure to wear the required attire. Any refusal or failure to wear an approved helmet or the other required attire immediately revokes Lessee''s permission to ride or handle the Horse and constitutes a material breach of this Agreement.'
WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.SAFETY_ATTIRE';

-- CHANGE 6 — indemnification: extend the indemnified class to the party groups
UPDATE contract_clause_defs SET body =
'Each party shall indemnify, defend, and hold harmless the other party and, respectively, the Lessor Parties or the Lessee Parties, from and against any and all claims, damages, losses, liabilities, costs, and expenses arising out of the indemnifying party''s use, handling, care, or possession of the Horse, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of an indemnified party.'
WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.INDEMNIFICATION';

-- CHANGE 7 — waiver of unknown claims: on behalf of the party groups
UPDATE contract_clause_defs SET body =
'Each party, on behalf of itself and, respectively, the Lessor Parties or the Lessee Parties, expressly waives any and all claims against the other party and its respective party group that the waiving party does not know or suspect to exist at the time of this Agreement, and acknowledges that this waiver is a material term of this Agreement. Each party assumes the risk that claims presently unknown to it may later be discovered.'
WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.WAIVER_UNKNOWN';

-- CHANGE 8 — Lessee's representations: rights given up on behalf of all Lessee Parties
UPDATE contract_clause_defs SET body =
'Lessee represents and warrants that Lessee is at least 18 years of age and has full authority to enter into this Agreement; that Lessee has no physical or mental condition that would prevent Lessee from safely participating in the activities contemplated by this Agreement; and that Lessee has the requisite knowledge and experience to handle and ride the Horse, and will use reasonable care in doing so and follow Lessor''s instructions. By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and all Lessee Parties, including the right to sue the Lessor Parties.'
WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'LESSEE_REPS.MAIN';

-- Verify all 8 changes landed
DO $$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key = 'HORSE_LEASE_V2'
     AND clause_key IN ('INSURANCE_RISK.DEFINITIONS',
                        'INSURANCE_RISK.LIMITATION_MORTALITY',
                        'INSURANCE_RISK.LIMITATION_FMV');
  IF v_n <> 3 THEN RAISE EXCEPTION 'expected 3 new clauses, found %', v_n; END IF;

  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key = 'HORSE_LEASE_V2'
     AND clause_key IN ('INSURANCE_RISK.ASSUMPTION_INHERENT', 'INSURANCE_RISK.RELEASE',
                        'INSURANCE_RISK.SAFETY_ATTIRE', 'INSURANCE_RISK.INDEMNIFICATION',
                        'INSURANCE_RISK.WAIVER_UNKNOWN', 'LESSEE_REPS.MAIN')
     AND body LIKE '%Lessee Parties%';
  IF v_n <> 6 THEN RAISE EXCEPTION 'expected 6 rewritten bodies naming Lessee Parties, found %', v_n; END IF;

  IF EXISTS (SELECT 1 FROM contract_clause_defs
              WHERE template_key = 'HORSE_LEASE_V2'
                AND clause_key = 'INSURANCE_RISK.SAFETY_ATTIRE'
                AND (body ILIKE '%deemed%' OR body ILIKE '%no claim may be brought%')) THEN
    RAISE EXCEPTION 'SAFETY_ATTIRE still contains the absolute-bar tail';
  END IF;
END $$;

COMMIT;
