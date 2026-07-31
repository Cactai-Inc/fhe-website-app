-- ─────────────────────────────────────────────────────────────────────────────
-- ENTITY PARTY CHAIN: UNAMBIGUOUS SCOPING (2026-07-31)
--
-- The owner challenged whether "…to the same extent as if they had entered into
-- this Agreement personally" actually achieves what the individual-side wording
-- achieves. The enumeration WAS present — heirs, next of kin, estate, executors,
-- administrators, legal representatives, assigns — but the challenge exposed a
-- real scope defect in how it attached:
--
--     "…and volunteers, together with the family members of any of the
--      foregoing, and — as to each individual named above — that individual's
--      heirs, next of kin, …"
--
-- Two problems with "each individual named above":
--   1. It is unclear whether the personal chain reaches the FAMILY MEMBERS, who
--      are themselves individuals but sit in a separate trailing phrase.
--   2. "named above" invites the reading that it covers only individuals
--      actually NAMED, rather than everyone falling within the listed classes —
--      and nobody is named anywhere in this definition.
--
-- Rewritten so the scope is explicit: the chain attaches to every natural person
-- within ANY of the listed categories, family members included. The "as if they
-- had entered personally" phrase is kept only as a closing statement of intent —
-- it is a gloss on the enumeration, never the mechanism, which was the owner's
-- point.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE contract_clause_defs
   SET body =
       '"Lessor Parties" means Lessor and, as applicable, Lessor''s owners, principals, '
    || 'proprietors, partners, members, managers, officers, directors, employees, trainers, '
    || 'instructors, agents, contractors, and volunteers, and the family members of any of '
    || 'the foregoing. With respect to each natural person falling within any of the '
    || 'foregoing categories, "Lessor Parties" also includes that person''s heirs, next of '
    || 'kin, spouse, estate, executors, administrators, legal representatives, successors, '
    || 'and assigns, in each case to the same extent as if that person had entered into this '
    || 'Agreement individually as Lessor.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'DEFINITIONS.LESSOR_ENT';

UPDATE contract_clause_defs
   SET body =
       '"Lessee Parties" means Lessee and, as applicable, Lessee''s owners, principals, '
    || 'proprietors, partners, members, managers, officers, directors, employees, trainers, '
    || 'instructors, agents, contractors, and volunteers, and the family members of any of '
    || 'the foregoing. With respect to each natural person falling within any of the '
    || 'foregoing categories, "Lessee Parties" also includes that person''s heirs, next of '
    || 'kin, spouse, estate, executors, administrators, legal representatives, successors, '
    || 'and assigns, in each case to the same extent as if that person had entered into this '
    || 'Agreement individually as Lessee.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'DEFINITIONS.LESSEE_ENT';

-- The individual-side definitions gain `spouse` and `successors` too, so the two
-- sides enumerate the same personal chain and neither is quietly narrower.
UPDATE contract_clause_defs
   SET body = '"Lessor Parties" means Lessor and Lessor''s heirs, next of kin, spouse, estate, '
           || 'executors, administrators, legal representatives, successors, and assigns.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'DEFINITIONS.LESSOR_IND';

UPDATE contract_clause_defs
   SET body = '"Lessee Parties" means Lessee and Lessee''s heirs, next of kin, spouse, estate, '
           || 'executors, administrators, legal representatives, successors, and assigns.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'DEFINITIONS.LESSEE_IND';
