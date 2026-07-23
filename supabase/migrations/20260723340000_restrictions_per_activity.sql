-- Restrictions section: preformatted per-activity restriction blocks for Jumping,
-- Competitions, and Trail Riding — in activity-button order, each shown only when
-- its activity is selected, each with an "omit" checkbox. Omit → the preformatted
-- content is replaced with "Lessor does not restrict <activity>." A titled omit
-- checkbox survives either way.
--
-- Implemented with CLAUSE-level gating (well-tested `all` composite): per activity,
-- a title/checkbox clause (gated on the activity) + a content clause (gated
-- activity AND omit=No) + a "does not restrict" clause (gated activity AND omit=Yes).
-- All live in the Permitted Use section, sequenced in button order, before the
-- free-form Add-Restrictions line.

-- fold jumping fields into the restrictions area + gate them (jumping AND not omit)
UPDATE contract_field_defs
   SET clause_key='RESTRICT.JUMP_ON', section='PERMITTED_USE', conditional_on=NULL
 WHERE template_key='HORSE_LEASE_V2' AND field_key IN ('TXN.JUMP_MAX_HEIGHT','TXN.JUMP_DAYS_PER_WEEK','TXN.JUMP_SUPERVISION');

-- competition + trail restriction inputs
INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type, owner_role, is_optional, sort_order)
VALUES
  ('HORSE_LEASE_V2','TXN.COMP_RESTRICTION','RESTRICT.COMP_ON','PERMITTED_USE','Competition restriction','text','text','text','LESSOR',true,1),
  ('HORSE_LEASE_V2','TXN.TRAIL_RESTRICTION','RESTRICT.TRAIL_ON','PERMITTED_USE','Trail-riding restriction','text','text','text','LESSOR',true,1)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label=EXCLUDED.label, clause_key=EXCLUDED.clause_key, section=EXCLUDED.section,
      input_kind=EXCLUDED.input_kind, value_type=EXCLUDED.value_type, format_type=EXCLUDED.format_type,
      is_optional=EXCLUDED.is_optional, sort_order=EXCLUDED.sort_order, conditional_on=NULL;

-- omit checkboxes (certify), on the title clauses, shown when the activity is on.
INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type, owner_role, is_optional, sort_order)
VALUES
  ('HORSE_LEASE_V2','TXN.JUMP_OMIT','RESTRICT.JUMP_TITLE','PERMITTED_USE','Do not restrict jumping','certify','checkbox','certify','LESSOR',true,1),
  ('HORSE_LEASE_V2','TXN.COMP_OMIT','RESTRICT.COMP_TITLE','PERMITTED_USE','Do not restrict competitions','certify','checkbox','certify','LESSOR',true,1),
  ('HORSE_LEASE_V2','TXN.TRAIL_OMIT','RESTRICT.TRAIL_TITLE','PERMITTED_USE','Do not restrict trail riding','certify','checkbox','certify','LESSOR',true,1)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label=EXCLUDED.label, clause_key=EXCLUDED.clause_key, section=EXCLUDED.section,
      input_kind=EXCLUDED.input_kind, value_type=EXCLUDED.value_type, format_type=EXCLUDED.format_type,
      is_optional=EXCLUDED.is_optional, sort_order=EXCLUDED.sort_order, conditional_on=NULL;

-- clauses, sequenced within Permitted Use (Restrictions band starts at 73):
--   Jumping (73.x) → Competitions (74.x) → Trail (75.x) → free-form (76)
-- JUMPING
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, sort_order, conditional_on) VALUES
 ('HORSE_LEASE_V2','PERMITTED_USE','RESTRICT.JUMP_TITLE','Jumping Restrictions','{{TXN.JUMP_OMIT}}',730,'{"contains":["JUMPING"],"field_key":"TXN.PERMITTED_ACTIVITIES"}'),
 ('HORSE_LEASE_V2','PERMITTED_USE','RESTRICT.JUMP_ON',NULL,'Jumping is restricted as follows: maximum height {{TXN.JUMP_MAX_HEIGHT}}; no more than {{TXN.JUMP_DAYS_PER_WEEK}} days per week; under trainer supervision only: {{TXN.JUMP_SUPERVISION}}.',731,'{"all":[{"contains":["JUMPING"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["NO"],"field_key":"TXN.JUMP_OMIT"}]}'),
 ('HORSE_LEASE_V2','PERMITTED_USE','RESTRICT.JUMP_OFF',NULL,'Lessor does not restrict jumping.',732,'{"all":[{"contains":["JUMPING"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["YES"],"field_key":"TXN.JUMP_OMIT"}]}'),
-- COMPETITIONS
 ('HORSE_LEASE_V2','PERMITTED_USE','RESTRICT.COMP_TITLE','Competition Restrictions','{{TXN.COMP_OMIT}}',740,'{"contains":["COMPETITIONS"],"field_key":"TXN.PERMITTED_ACTIVITIES"}'),
 ('HORSE_LEASE_V2','PERMITTED_USE','RESTRICT.COMP_ON',NULL,'Competitions are restricted as follows: {{TXN.COMP_RESTRICTION}}.',741,'{"all":[{"contains":["COMPETITIONS"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["NO"],"field_key":"TXN.COMP_OMIT"}]}'),
 ('HORSE_LEASE_V2','PERMITTED_USE','RESTRICT.COMP_OFF',NULL,'Lessor does not restrict competitions.',742,'{"all":[{"contains":["COMPETITIONS"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["YES"],"field_key":"TXN.COMP_OMIT"}]}'),
-- TRAIL
 ('HORSE_LEASE_V2','PERMITTED_USE','RESTRICT.TRAIL_TITLE','Trail-Riding Restrictions','{{TXN.TRAIL_OMIT}}',750,'{"contains":["TRAIL"],"field_key":"TXN.PERMITTED_ACTIVITIES"}'),
 ('HORSE_LEASE_V2','PERMITTED_USE','RESTRICT.TRAIL_ON',NULL,'Trail riding is restricted as follows: {{TXN.TRAIL_RESTRICTION}}.',751,'{"all":[{"contains":["TRAIL"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["NO"],"field_key":"TXN.TRAIL_OMIT"}]}'),
 ('HORSE_LEASE_V2','PERMITTED_USE','RESTRICT.TRAIL_OFF',NULL,'Lessor does not restrict trail riding.',752,'{"all":[{"contains":["TRAIL"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["YES"],"field_key":"TXN.TRAIL_OMIT"}]}')
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key=EXCLUDED.section_key, heading=EXCLUDED.heading, body=EXCLUDED.body,
      sort_order=EXCLUDED.sort_order, conditional_on=EXCLUDED.conditional_on;

-- the existing free-form Restrictions clause becomes the "Additional restrictions"
-- line at the end of the band.
UPDATE contract_clause_defs
   SET heading='Additional Restrictions', body='Additional restrictions: {{TXN.PERMITTED_RESTRICTIONS}}', sort_order=760
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PERMITTED_USE.RESTRICTIONS';

-- remove the standalone jumping-restrictions clause (folded in above).
DELETE FROM contract_clause_defs
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.JUMP_RESTRICTIONS';

-- ── unrelated tweak batched here: evaluation period — swap "Waived by Lessee"
--    and "Refused by Lessor" button order.
UPDATE contract_field_defs
   SET options = '[
        {"label":"Requested by Lessee","value":"REQUESTED"},
        {"label":"Required by Lessor","value":"REQUIRED"},
        {"label":"Refused by Lessor","value":"REFUSED"},
        {"label":"Waived by Lessee","value":"WAIVED"}
      ]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.EVALUATION_ENABLED';
