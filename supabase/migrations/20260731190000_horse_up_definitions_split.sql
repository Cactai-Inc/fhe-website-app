-- ─────────────────────────────────────────────────────────────────────────────
-- HORSE MOVES TO POSITION 2; DEFINITIONS BROKEN INTO PARAGRAPHS (2026-07-31)
--
-- 1. THE HORSE section sat at position 8, after fee and payment terms — so the
--    contract named the money before it named the animal. It moves to position 2,
--    directly after Parties: who, then which horse, then the deal.
--
--    sort_order 15 slots it between PARTIES (10) and PURPOSE (20) without
--    renumbering anything else, so no other section's position shifts.
--
-- 2. DEFINITIONS was one wall of text carrying four distinct statements. Each now
--    starts a new line, per the owner: the "Lessee Parties" definition, the
--    on-behalf-of covenant, and the third-party-beneficiary sentence.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE contract_section_defs
   SET sort_order = 15
 WHERE template_key = 'HORSE_LEASE_V2' AND section_key = 'HORSE';

UPDATE contract_clause_defs
   SET body =
       '"Lessor Parties" means Lessor and, as applicable, Lessor''s owners, principals, '
    || 'proprietors, partners, employees, trainers, instructors, agents, contractors, and '
    || 'family members of any of the foregoing, and each of their respective heirs and assigns.'
    || E'\n\n'
    || '"Lessee Parties" means Lessee and, as applicable, Lessee''s owners, principals, '
    || 'proprietors, partners, employees, trainers, instructors, agents, contractors, and '
    || 'family members of any of the foregoing, and each of their respective heirs, next of '
    || 'kin, estate, executors, administrators, legal representatives, and assigns.'
    || E'\n\n'
    || 'Lessee enters into this Agreement on behalf of Lessee and all Lessee Parties, and all '
    || 'releases, waivers, assumptions of risk, and covenants made by Lessee under this '
    || 'Agreement are made on behalf of all Lessee Parties and bind each of them to the same '
    || 'extent as Lessee.'
    || E'\n\n'
    || 'Each Lessor Party and each Lessee Party is an intended third-party beneficiary of the '
    || 'releases, waivers, assumptions of risk, and limitations of liability in this Agreement '
    || 'and may enforce them directly.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'DEFINITIONS.MAIN';
