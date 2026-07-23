-- Agreement Term: add an explicit "Include renewal terms" checkbox and an
-- "Add additional terms" button. Previously the renewal/other-terms clause only
-- appeared when the term-type dropdown was set to "Other" — there was no direct
-- way to enable renewal terms or to write an additional term.

-- 1) "Include renewal terms" checkbox (certify) at the top of the renewal area.
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order)
VALUES
  ('HORSE_LEASE_V2','TERM','TERM.RENEWAL_TOGGLE',NULL,'{{TXN.RENEWAL_INCLUDE}}',18)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key=EXCLUDED.section_key, body=EXCLUDED.body, sort_order=EXCLUDED.sort_order;

INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type, owner_role, is_optional, sort_order, guidance)
VALUES
  ('HORSE_LEASE_V2','TXN.RENEWAL_INCLUDE','TERM.RENEWAL_TOGGLE','TERM',
   'Include renewal terms','certify','checkbox','certify','LESSOR',true,1,
   'Checking this box adds a renewal-terms clause to the lease. Leaving it unchecked omits it.')
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label=EXCLUDED.label, clause_key=EXCLUDED.clause_key, input_kind=EXCLUDED.input_kind,
      value_type=EXCLUDED.value_type, format_type=EXCLUDED.format_type, guidance=EXCLUDED.guidance,
      is_optional=EXCLUDED.is_optional, sort_order=EXCLUDED.sort_order, conditional_on=NULL;

-- 2) Renewal clause: now gated on the checkbox (not the term-type dropdown).
UPDATE contract_clause_defs
   SET heading='Renewal Terms',
       body='Renewal terms: {{TXN.RENEWAL_TERMS}}',
       conditional_on='{"equals":["YES"],"field_key":"TXN.RENEWAL_INCLUDE"}'::jsonb,
       sort_order=19
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TERM.RENEWAL';
UPDATE contract_field_defs SET conditional_on=NULL, label='Renewal terms'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.RENEWAL_TERMS';

-- 3) "Add additional terms" (add_text button → free-text written term).
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order)
VALUES
  ('HORSE_LEASE_V2','TERM','TERM.ADDITIONAL',NULL,'Additional terms: {{TXN.ADDITIONAL_TERMS}}',22)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key=EXCLUDED.section_key, body=EXCLUDED.body, sort_order=EXCLUDED.sort_order;

INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type, owner_role, is_optional, sort_order, guidance)
VALUES
  ('HORSE_LEASE_V2','TXN.ADDITIONAL_TERMS','TERM.ADDITIONAL','TERM',
   'Add additional terms','add_text','text','add_text','LESSOR',true,1,'Additional terms')
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label=EXCLUDED.label, clause_key=EXCLUDED.clause_key, input_kind=EXCLUDED.input_kind,
      value_type=EXCLUDED.value_type, format_type=EXCLUDED.format_type, guidance=EXCLUDED.guidance,
      is_optional=EXCLUDED.is_optional, sort_order=EXCLUDED.sort_order;
