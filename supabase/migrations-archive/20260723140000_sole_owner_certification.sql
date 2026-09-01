-- Ownership §1: add a sole-owner vs. partial-owner selection, and a conditional
-- authority certification when the Lessor is NOT the sole owner.
--
-- Before: the clause flatly warranted "Lessor is the sole lawful and registered
-- owner" — with no way to say otherwise. Now the Lessor answers "I am the sole
-- owner of the Horse" (Yes/No). If NO, a second line appears with a checkbox the
-- owner must check, certifying they have the authority to enter this lease without
-- the other owner(s) being a party/signer.

-- Reword the ownership clause: the sole-owner warranty is now conditional on the
-- Yes/No answer, and the clause poses the question.
UPDATE contract_clause_defs
   SET body = 'Lessor warrants that Lessor owns the Horse free of liens and encumbrances and has all requisite rights and powers to enter into this Agreement. I am the sole owner of the Horse: {{TXN.IS_SOLE_OWNER}}. Are there any limitations on ownership? {{TXN.HAS_OWNERSHIP_LIMITS}}'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.OWNERSHIP';

-- The sole-owner Yes/No field (renders before the existing limitations question).
INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type,
   owner_role, required, sort_order)
VALUES
  ('HORSE_LEASE_V2', 'TXN.IS_SOLE_OWNER', 'HORSE.OWNERSHIP', 'HORSE',
   'I am the sole owner of the Horse', 'yesno', 'text', 'yesno',
   'LESSOR', true, 3)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label = EXCLUDED.label, input_kind = EXCLUDED.input_kind, value_type = EXCLUDED.value_type,
      format_type = EXCLUDED.format_type, clause_key = EXCLUDED.clause_key,
      required = EXCLUDED.required, sort_order = EXCLUDED.sort_order;

-- Conditional certification clause — shown only when the Lessor is NOT the sole
-- owner. It carries the certification statement + a checkbox the owner must check.
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order, conditional_on)
VALUES
  ('HORSE_LEASE_V2',
   (SELECT section_key FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.OWNERSHIP'),
   'HORSE.SOLE_OWNER_CERT', NULL,
   'Lessor certifies that Lessor has all permission and authority required to enter into this Agreement on behalf of all owners of the Horse, and that no other owner of the Horse need be a party to or signer of this Agreement: {{TXN.SOLE_OWNER_CERT}}',
   21,
   '{"equals": ["NO"], "field_key": "TXN.IS_SOLE_OWNER"}'::jsonb)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET body = EXCLUDED.body, conditional_on = EXCLUDED.conditional_on,
      section_key = EXCLUDED.section_key, sort_order = EXCLUDED.sort_order;

-- The certification checkbox field (single "I certify" checkbox). Required so the
-- non-sole owner must affirmatively check it. Gated to the same NO condition so it
-- only shows / counts as required when the cert clause is active.
INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type,
   owner_role, required, sort_order, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'TXN.SOLE_OWNER_CERT', 'HORSE.SOLE_OWNER_CERT', 'HORSE',
   'I certify that I have the permission or authority needed to enter into this lease agreement without any other owner(s) being a party to the contract as a signer.',
   'certify', 'checkbox', 'certify',
   'LESSOR', true, 5,
   '{"equals": ["NO"], "field_key": "TXN.IS_SOLE_OWNER"}'::jsonb)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label = EXCLUDED.label, input_kind = EXCLUDED.input_kind, value_type = EXCLUDED.value_type,
      format_type = EXCLUDED.format_type, clause_key = EXCLUDED.clause_key,
      required = EXCLUDED.required, sort_order = EXCLUDED.sort_order,
      conditional_on = EXCLUDED.conditional_on;
