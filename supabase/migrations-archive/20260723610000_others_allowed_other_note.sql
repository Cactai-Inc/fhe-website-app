-- Allowing Others to Ride: the "Others allowed to ride" multi-select offers an
-- "Other" option but had no companion free-text to say WHO the other is. Add a
-- gated note clause (mirrors the existing RIDER_AIDS / OTHER_PROHIBITED patterns):
-- a text field shown only when "Other" is selected, placed right after the clause.

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order, conditional_on)
VALUES
  ('HORSE_LEASE_V2','PERMITTED_USE','PROHIBITED.OTHERS_OTHER', NULL,
   'Other persons allowed to ride or handle the Horse: {{TXN.OTHERS_ALLOWED_OTHER}}.',
   49, '{"contains":["OTHER"],"field_key":"TXN.OTHERS_ALLOWED"}'::jsonb)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key=EXCLUDED.section_key, body=EXCLUDED.body,
      sort_order=EXCLUDED.sort_order, conditional_on=EXCLUDED.conditional_on;

INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type, owner_role, is_optional, sort_order, conditional_on, guidance)
VALUES
  ('HORSE_LEASE_V2','TXN.OTHERS_ALLOWED_OTHER','PROHIBITED.OTHERS_OTHER','PERMITTED_USE',
   'Other persons allowed','text','text','text','LESSOR',true,1,
   '{"contains":["OTHER"],"field_key":"TXN.OTHERS_ALLOWED"}'::jsonb,
   'Name the other person(s) allowed to ride or handle the Horse.')
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label=EXCLUDED.label, clause_key=EXCLUDED.clause_key, input_kind=EXCLUDED.input_kind,
      value_type=EXCLUDED.value_type, format_type=EXCLUDED.format_type, owner_role=EXCLUDED.owner_role,
      is_optional=EXCLUDED.is_optional, sort_order=EXCLUDED.sort_order,
      conditional_on=EXCLUDED.conditional_on, guidance=EXCLUDED.guidance;
