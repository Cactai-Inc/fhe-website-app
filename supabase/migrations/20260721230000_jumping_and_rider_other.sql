-- §10.5 Jumping "Jumping: permitted/restricted" line is redundant now that Jumping
-- is a selectable permitted activity in §9.1. Remove the yes/no jumping clause and
-- its field; keep the jump-restrictions detail but gate it directly on Jumping
-- being a permitted activity (restrictions still apply where relevant).
DELETE FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.JUMPING';
DELETE FROM contract_field_defs  WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.JUMPING_ALLOWED';

UPDATE contract_clause_defs
   SET conditional_on='{"field_key":"TXN.PERMITTED_ACTIVITIES","contains":["JUMPING"]}'::jsonb,
       body='Jumping restrictions: maximum height {{TXN.JUMP_MAX_HEIGHT}}; no more than {{TXN.JUMP_DAYS_PER_WEEK}} days per week; under trainer supervision only: {{TXN.JUMP_SUPERVISION}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.JUMP_RESTRICTIONS';

-- 11.7 (rider aids): selecting "Other" should reveal a free-text explanation.
-- Add a gated free-text field + follow-on clause shown when OTHER is selected.
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.RIDER_AIDS_OTHER', 'Other rider aid', 'CARE', 'LESSOR',
   'text', 'text', 'Describe the other approved rider aid.',
   false, false, 92, 'text', 'CARE.RIDER_AIDS_OTHER');
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'CARE', 'CARE.RIDER_AIDS_OTHER', NULL,
   'Other approved rider aid: {{TXN.RIDER_AIDS_OTHER}}.',
   'input', 92, false, '{"field_key":"TXN.RIDER_AIDS","contains":["OTHER"]}'::jsonb);
