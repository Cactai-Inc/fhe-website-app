-- Insurance section: add a "General Liability Insurance" subsection as the new
-- 13.2, right after Insurance Requirements (sort 10) and before Mortality
-- Insurance (sort 20). Because subsection numbers are derived from sort_order at
-- render time, inserting at sort 15 automatically advances Mortality → 13.3,
-- Major Medical → 13.4, and the rest of the section accordingly.

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order)
VALUES
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY',
   'General Liability Insurance',
   'General liability insurance is required by {{TXN.GL_REQUIRED_BY}} for {{TXN.GL_PROTECTION}} protection.
Party responsible for the cost: {{TXN.GL_COST_PARTY}}.
Party responsible for obtaining the policy: {{TXN.GL_OBTAIN_PARTY}}.',
   15)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key=EXCLUDED.section_key, heading=EXCLUDED.heading,
      body=EXCLUDED.body, sort_order=EXCLUDED.sort_order;

-- Two inline party selects in the lead sentence + the two standard responsibility
-- selects (cost / obtaining), matching the Mortality and Major Medical subsections.
INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type, owner_role, is_optional, sort_order, options, guidance)
VALUES
  ('HORSE_LEASE_V2','TXN.GL_REQUIRED_BY','INSURANCE_RISK.GENERAL_LIABILITY','INSURANCE_RISK',
   'Required by','select','select','select','DEAL',false,10,
   '[{"label":"Lessee","value":"LESSEE"},{"label":"Lessor","value":"LESSOR"},{"label":"Both Parties","value":"BOTH"}]'::jsonb,
   'Which party is required to carry general liability insurance.'),
  ('HORSE_LEASE_V2','TXN.GL_PROTECTION','INSURANCE_RISK.GENERAL_LIABILITY','INSURANCE_RISK',
   'For whose protection','select','select','select','DEAL',false,12,
   '[{"label":"Lessee","value":"LESSEE"},{"label":"Lessor","value":"LESSOR"},{"label":"Mutual","value":"MUTUAL"}]'::jsonb,
   'Whose protection the general liability coverage is for.'),
  ('HORSE_LEASE_V2','TXN.GL_COST_PARTY','INSURANCE_RISK.GENERAL_LIABILITY','INSURANCE_RISK',
   'Party responsible for the cost','select','select','select','LESSOR',false,14,
   '[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Shared","value":"SHARED"}]'::jsonb,
   'Who pays for this insurance.'),
  ('HORSE_LEASE_V2','TXN.GL_OBTAIN_PARTY','INSURANCE_RISK.GENERAL_LIABILITY','INSURANCE_RISK',
   'Party responsible for obtaining the policy','select','select','select','LESSOR',false,16,
   '[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Shared","value":"SHARED"}]'::jsonb,
   'Who obtains and maintains the policy.')
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label=EXCLUDED.label, clause_key=EXCLUDED.clause_key, input_kind=EXCLUDED.input_kind,
      value_type=EXCLUDED.value_type, format_type=EXCLUDED.format_type, owner_role=EXCLUDED.owner_role,
      is_optional=EXCLUDED.is_optional, sort_order=EXCLUDED.sort_order, options=EXCLUDED.options,
      guidance=EXCLUDED.guidance;
