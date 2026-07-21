-- HORSE_LEASE_V2 content pass (screenshots review):
--   1. "Owner" (party label) → "Lessor" everywhere; the party is DEFINED as
--      "Lessor" in PARTIES.INTRO and referred to as Lessor throughout. The
--      common-law noun "owner" ("sole lawful and registered owner of Horse")
--      stays lowercase and unchanged.
--   2. §3.2 Physical Condition and §3.4 Behavior are rewritten as COMPLETE
--      attestation sentences. The Lessor always attests; the only choice is
--      whether there are exceptions. A yes/no gate reveals an exceptions
--      sentence + a box for the Lessor to list them. The old "basis" dropdown
--      (which let the Lessee rely on their own knowledge, and stated no actual
--      condition) is removed.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Owner → Lessor across all clause bodies (whole word, capitalized only, so
--    the lowercase common-law noun "owner"/"ownership" is preserved). Also the
--    all-caps "OWNER" inside the §3.6 disclaimer.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE contract_clause_defs
   SET body = regexp_replace(body, '\yOwner\y', 'Lessor', 'g')
 WHERE template_key = 'HORSE_LEASE_V2' AND body ~ '\yOwner\y';

UPDATE contract_clause_defs
   SET body = replace(body, 'OWNER MAKES NO WARRANTIES', 'LESSOR MAKES NO WARRANTIES')
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.WARRANTY';

-- PARTIES.INTRO now defines the party as "Lessor" only (the "Owner" alias is
-- retired). After the global replace the phrase reads ("Lessor" or "Lessor") —
-- collapse it to a single clean definition.
UPDATE contract_clause_defs
   SET body = replace(body, '("Lessor" or "Lessor")', '("Lessor")')
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PARTIES.INTRO';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2a. Condition / behavior: retire the "basis" selects, add yes/no exception
--     gates. The exceptions long-text fields are kept (repurposed).
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN ('HORSE.CONDITION_BASIS', 'HORSE.BEHAVIOR_BASIS');

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   options, guidance, required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.CONDITION_HAS_EXCEPTIONS', 'Any exceptions to note?',
   'HORSE', 'LESSOR', 'yesno', 'text', NULL,
   'The Lessor warrants the Horse is sound and in good condition. Choose Yes only to note specific known illnesses, lamenesses, or physical conditions.',
   false, false, 21, 'yesno', 'HORSE.CONDITION'),
  ('HORSE_LEASE_V2', 'TXN.BEHAVIOR_HAS_EXCEPTIONS', 'Any exceptions to note?',
   'HORSE', 'LESSOR', 'yesno', 'text', NULL,
   'The Lessor warrants the Horse has no history of dangerous behavior. Choose Yes only to note specific known behaviors.',
   false, false, 31, 'yesno', 'HORSE.BEHAVIOR');

-- point the existing exceptions boxes at the right clause + refresh guidance
UPDATE contract_field_defs
   SET clause_key = 'HORSE.CONDITION_EXC',
       label = 'Known condition exceptions',
       guidance = 'List any known illnesses, lamenesses, or physical conditions the Lessee should be aware of.'
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.CONDITION_EXCEPTIONS';

UPDATE contract_field_defs
   SET clause_key = 'HORSE.BEHAVIOR_EXC',
       label = 'Known behavior exceptions',
       guidance = 'List any known behaviors — e.g. biting, kicking, bucking, rearing, bolting, trailer-loading or farrier issues.'
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.BEHAVIOR_EXCEPTIONS';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2b. Rewrite the base condition / behavior clauses as full attestations, and
--     add the gated exception sentences.
-- ─────────────────────────────────────────────────────────────────────────────
-- Base clauses are PURE PROSE (no gate token) so they always compose into the
-- final document and read cleanly. The yes/no gate lives as a field on the clause
-- (an authoring-only control, never printed), and the gated exception clause below
-- supplies the exceptions sentence when the Lessor answers Yes.
UPDATE contract_clause_defs
   SET body = 'The Lessor warrants that Horse is sound and in good physical condition as of the Effective Date of this Agreement.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.CONDITION';

UPDATE contract_clause_defs
   SET body = 'The Lessor warrants that Horse has no history of dangerous or vicious behavior as of the Effective Date of this Agreement.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.BEHAVIOR';

-- gated exception clauses (shown only when the Lessor answers Yes)
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order,
   is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'HORSE', 'HORSE.CONDITION_EXC', NULL,
   'The Lessor notes the following known exceptions to the physical condition of Horse: {{TXN.CONDITION_EXCEPTIONS}}.',
   'input', 21, false,
   '{"field_key": "TXN.CONDITION_HAS_EXCEPTIONS", "equals": ["YES"]}'::jsonb),
  ('HORSE_LEASE_V2', 'HORSE', 'HORSE.BEHAVIOR_EXC', NULL,
   'The Lessor notes the following known exceptions to the behavior of Horse: {{TXN.BEHAVIOR_EXCEPTIONS}}.',
   'input', 31, false,
   '{"field_key": "TXN.BEHAVIOR_HAS_EXCEPTIONS", "equals": ["YES"]}'::jsonb);
