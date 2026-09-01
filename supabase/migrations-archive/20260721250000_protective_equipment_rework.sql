-- §11.5 Protective Equipment rework: drop the per-activity specificity. Protective
-- gear is optional for the Lessor to require at all; when required, the Lessor
-- picks the equipment and the Lessee must ensure it's used before all activities.
--
--   Base clause  : a yes/no gate "Horse must wear protective equipment" (empty
--                  body → authoring control only).
--   Gated clause : "Lessor will provide the following equipment for Horse: [buttons]
--                   Lessee must ensure equipment is used and properly secured to
--                   Horse prior to all activities." — shown when the box is Yes.

DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.PROTECTIVE_ACTIVITIES';

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.PROTECTIVE_REQUIRED', 'Horse must wear protective equipment', 'CARE', 'LESSOR',
   'yesno', 'text', 'Check Yes if the Lessor requires the Horse to wear protective equipment.',
   false, false, 60, 'yesno', 'CARE.PROTECTIVE');

-- base clause = the gate only (no printed prose)
UPDATE contract_clause_defs SET body='', heading=NULL, conditional_on=NULL, sort_order=60
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.PROTECTIVE';

-- move the equipment selection onto the gated follow-on clause
UPDATE contract_field_defs SET clause_key='CARE.PROTECTIVE_EQUIP', sort_order=62
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.PROTECTIVE_EQUIPMENT';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'CARE', 'CARE.PROTECTIVE_EQUIP', NULL,
   'Lessor will provide the following equipment for Horse: {{TXN.PROTECTIVE_EQUIPMENT}}
Lessee must ensure equipment is used and properly secured to Horse prior to all activities.',
   'input', 62, false, '{"field_key":"TXN.PROTECTIVE_REQUIRED","equals":["YES"]}'::jsonb);
