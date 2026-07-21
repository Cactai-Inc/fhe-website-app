-- Farrier / Veterinarian name+address (HORSE.FARRIER / HORSE.VET contact blocks)
-- should appear ONLY when the Lessee is the party responsible for arranging that
-- care. Move each contact onto a gated follow-on clause shown when the arranging
-- party is LESSEE; otherwise the contact is hidden.
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'CARE', 'CARE.FARRIER_CONTACT', NULL,
   'Farrier: {{HORSE.FARRIER}}',
   'input', 22, false, '{"field_key":"TXN.FARRIER_ARRANGE","equals":["LESSEE"]}'::jsonb),
  ('HORSE_LEASE_V2', 'CARE', 'CARE.VET_CONTACT', NULL,
   'Veterinarian: {{HORSE.VET}}',
   'input', 32, false, '{"field_key":"TXN.VET_ARRANGE","equals":["LESSEE"]}'::jsonb);

UPDATE contract_field_defs SET clause_key='CARE.FARRIER_CONTACT'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='HORSE.FARRIER';
UPDATE contract_field_defs SET clause_key='CARE.VET_CONTACT'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='HORSE.VET';
