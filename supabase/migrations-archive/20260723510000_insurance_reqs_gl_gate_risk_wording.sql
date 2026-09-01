-- Insurance section tweaks + risk-clause wording.

-- 1) Insurance Requirements (13.1): fold the "obtained within 30 days" sentence up
--    onto the same paragraph as the sentence above it, so it wraps naturally as two
--    sentences rather than sitting on its own line like a separate item.
UPDATE contract_clause_defs
   SET body = 'The parties agree that the following insurance shall be carried on the Horse during the term of this Agreement, obtained and maintained as set out below. Insurance must be obtained within 30 days of the date of signing of this Agreement.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.INSURANCE';

-- 2) General Liability Insurance (13.2): add a "Require general liability
--    insurance? [Yes]/[No]" gate at the top, matching Mortality & Major Medical.
--    The detail lines only render when Yes.
UPDATE contract_clause_defs
   SET body = 'Require general liability insurance? {{TXN.GL_INSURANCE_REQ}}
General liability insurance is required by {{TXN.GL_REQUIRED_BY}} for {{TXN.GL_PROTECTION}} protection.
Party responsible for the cost: {{TXN.GL_COST_PARTY}}.
Party responsible for obtaining the policy: {{TXN.GL_OBTAIN_PARTY}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.GENERAL_LIABILITY';

INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type, owner_role, is_optional, sort_order, guidance)
VALUES
  ('HORSE_LEASE_V2','TXN.GL_INSURANCE_REQ','INSURANCE_RISK.GENERAL_LIABILITY','INSURANCE_RISK',
   'Require general liability insurance?','yesno','select','yesno','DEAL',false,5,
   'Is general liability insurance required during the lease?')
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label=EXCLUDED.label, clause_key=EXCLUDED.clause_key, input_kind=EXCLUDED.input_kind,
      value_type=EXCLUDED.value_type, format_type=EXCLUDED.format_type, owner_role=EXCLUDED.owner_role,
      is_optional=EXCLUDED.is_optional, sort_order=EXCLUDED.sort_order, guidance=EXCLUDED.guidance;

-- Gate the four GL detail selects on the new yes/no so they hide (and their lines
-- strip out) when general liability insurance is not required.
UPDATE contract_field_defs
   SET conditional_on = '{"equals":["YES"],"field_key":"TXN.GL_INSURANCE_REQ"}'::jsonb
 WHERE template_key='HORSE_LEASE_V2'
   AND field_key IN ('TXN.GL_REQUIRED_BY','TXN.GL_PROTECTION','TXN.GL_COST_PARTY','TXN.GL_OBTAIN_PARTY');

-- 4) Lessee's Representations: this was the only section whose sole clause had no
--    heading, so it rendered as unnumbered body text (no "21.1"). Give it the
--    restated heading so it numbers like every other section.
UPDATE contract_clause_defs
   SET heading = 'Lessee''s Representations'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='LESSEE_REPS.MAIN';

-- 3) Activity risk clauses: broaden the closing sentence to cover unforeseen /
--    unspecified risks of the activity.
UPDATE contract_clause_defs
   SET body = regexp_replace(
        body,
        'Lessee voluntarily assumes these additional risks\.',
        'Lessee voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.')
 WHERE template_key='HORSE_LEASE_V2'
   AND clause_key IN ('INSURANCE_RISK.TRAIL_RIDING','INSURANCE_RISK.JUMPING_RISKS',
                      'INSURANCE_RISK.COMPETITION_RISKS','INSURANCE_RISK.SHARED_ARENA_RISKS');
