-- §6 Location of Horse: the current location IMPORTS from the horse record's
-- Current Location (read-only in the contract, like the other HORSE.* fields — to
-- change it, the horse record is edited). Drop the location-type dropdown. Add a
-- "Horse will move to a new location for the Lessee" checkbox that, when checked,
-- reveals a MANUAL location block (name + full address + notes/access/contact) —
-- no dropdown. The inspection clause follows.

-- retire the dropdown
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.LOCATION_TYPE';

-- main location line: read-only import from the horse record
UPDATE contract_clause_defs
   SET body = 'Location of Horse: {{HORSE.CURRENT_LOCATION}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='LOCATION.MAIN';

-- move-to-new-location toggle (between the address and the inspection clause)
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.HORSE_MOVES', 'Horse will move to a new location for the Lessee', 'LOCATION',
   'LESSOR', 'yesno', 'text',
   'Check yes if the Horse will be kept at a different location during the lease. A location block will appear to fill in manually.',
   false, false, 12, 'yesno', 'LOCATION.MOVE_CHOICE'),
  ('HORSE_LEASE_V2', 'TXN.NEW_LOCATION', 'Location during lease term', 'LOCATION',
   'LESSOR', 'location', 'text',
   'Facility / place name, full street address, and any notes for locating the Horse — access codes and the property manager''s contact information.',
   false, false, 14, 'location', 'LOCATION.NEW');

-- gate clause: the yes/no toggle (empty body → authoring-only prompt)
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'LOCATION', 'LOCATION.MOVE_CHOICE', NULL, '', 'input', 12, false, NULL),
  ('HORSE_LEASE_V2', 'LOCATION', 'LOCATION.NEW', NULL,
   'Location during lease term: {{TXN.NEW_LOCATION}}.',
   'input', 14, false, '{"field_key": "TXN.HORSE_MOVES", "equals": ["YES"]}'::jsonb);

-- keep the inspection clause after the new-location block
UPDATE contract_clause_defs SET sort_order = 20
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='LOCATION.INSPECTION';
