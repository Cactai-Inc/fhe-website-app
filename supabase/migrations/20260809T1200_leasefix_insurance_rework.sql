/*
  # LEASEFIX batch 2b — the insurance section rebuilt (13.2 / 13.3 / 13.4)

  Owner spec + sign-off 2026-08-09. Draft language reviewed in
  docs/tasks/TASK-LEASEFIX-insurance-rework.md. Applied to all four lease templates.

  WHAT CHANGES AND WHY

  13.2 General Liability. The old shape was a "not required" checkbox plus two
  status dropdowns plus a Lessee acceptance checkbox, and it could not work: the
  acceptance was gated on BOTH statuses being NONE, so electing "has and will
  maintain" made it unreachable, and `contract_document_detail`'s F1/D4 carve-out
  makes it party-exclusive, so FHE staff (who are the Lessor) could never check it
  at all. It rendered visible-but-dead in every contract.

  Replaced by one Lessor election with four outcomes, then a Lessee election with
  three. The responsibility prose is DERIVED from the election rather than gated
  behind a checkbox asserting it — owner ruling: the election already says it, so
  nobody is asked to certify a thing they have said. The checkboxes that survive
  are the ones that are genuine acceptances of a COST the other party is imposing:
  the deductible share, the mortality cost share, the CCC cost. Those stay
  LESSEE-owned, so the carve-out keeps doing its job.

  Care, Custody and Control moves INTO 13.2 as an inclusion election (owner
  instruction), gated on an ENTITY Lessee as before. Its language is cut down to
  the negligence rule only: CCC answers for Lessee's negligence, and is not a
  fallback for coverage that is absent or has denied a claim.
  `INSURANCE_RISK.COORDINATION` is DELETED — it asserted that CCC is secondary and
  responds to gross negligence, which contradicts the rule above, and it assumed a
  CCC policy that the Lessor can now decline to require.

  13.3 Mortality. On a partial lease the Lessee cannot carry mortality on a horse
  they do not own, so the Lessee status dropdown is gone: the Lessor either does not
  require it, or requires it and holds/obtains it. What the Lessee can be asked for
  is a CONTRIBUTION to the cost, which is what the cost-responsibility election and
  its acceptance checkbox now express.

  13.4 Medical. Medical is only ever a rider on a mortality policy, so it is gated
  on the mortality election. With no mortality it prints N/A and says why, rather
  than vanishing and leaving the reader to wonder if it was overlooked.

  BLAST RADIUS. The retired field keys are deleted from the defs, so a subsequent
  sync_contract_fields_from_defs() DELETES those rows and their answers on the three
  live non-executed leases. Owner has confirmed this is intended — two are test
  samples and the third (Sarah Morgan, DOC-J7NXZDHD5F) is awaiting exactly this
  update before execution. The EXECUTED lease is never touched.

  Requires PGCLIENTENCODING=UTF8.
*/

CREATE TEMP TABLE _lf(k text) ON COMMIT DROP;
INSERT INTO _lf VALUES
  ('HORSE_LEASE_V2'), ('HORSE_LEASE_STANDARD'), ('HORSE_LEASE_FULL'), ('HORSE_LEASE_SIMPLE');


-- ═══ retire the old machinery ════════════════════════════════════════════════
DELETE FROM contract_clause_defs
 WHERE template_key IN (SELECT k FROM _lf)
   AND clause_key IN (
     'INSURANCE_RISK.GL_STATUS', 'INSURANCE_RISK.GL_NONE', 'INSURANCE_RISK.GL_LESSEE_RESP',
     'INSURANCE_RISK.MORT_STATUS', 'INSURANCE_RISK.MORT_NONE', 'INSURANCE_RISK.MORT_LESSEE_RESP',
     'INSURANCE_RISK.MED_STATUS', 'INSURANCE_RISK.MED_NONE', 'INSURANCE_RISK.MED_LESSEE_RESP',
     'INSURANCE_RISK.CCC', 'INSURANCE_RISK.COORDINATION');

DELETE FROM contract_field_defs
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN (
     'TXN.GL_NOT_REQUIRED', 'TXN.GL_LESSOR_STATUS', 'TXN.GL_LESSEE_STATUS', 'TXN.GL_LESSEE_RESPONSIBLE',
     'TXN.MORT_NOT_REQUIRED', 'TXN.MORT_LESSEE_STATUS', 'TXN.MORT_LESSEE_RESPONSIBLE',
     'TXN.MED_NOT_REQUIRED', 'TXN.MED_LESSOR_STATUS', 'TXN.MED_LESSEE_STATUS', 'TXN.MED_LESSEE_RESPONSIBLE');


-- ═══ 13.2 GENERAL LIABILITY ══════════════════════════════════════════════════
-- The heading clause hosts the Lessor election. Empty body => the control is
-- authoring-only and the document prints the heading plus whichever outcome applies.
INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, required, is_optional, sort_order, options)
SELECT k, 'TXN.GL_LESSOR_ELECTION', 'Lessor', 'INSURANCE_RISK',
       'INSURANCE_RISK.GENERAL_LIABILITY', 'LESSOR', 'select', 'select', true, false, 150,
       '[{"label": "Does not require general liability insurance; Lessor accepts full responsibility", "value": "NOT_REQ_FULL"},
         {"label": "Does not require general liability insurance; each party bears its own at-fault costs", "value": "NOT_REQ_FAULT"},
         {"label": "Has and will maintain general liability insurance", "value": "HAS"},
         {"label": "Will obtain and will maintain general liability insurance", "value": "WILL_OBTAIN"}]'::jsonb
  FROM _lf
ON CONFLICT (template_key, field_key) DO NOTHING;

INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', v.ck, NULL, v.body, 'prose', v.so, false, v.cond::jsonb, false
  FROM _lf CROSS JOIN (VALUES

  ('INSURANCE_RISK.GL_LESSOR_A', 151,
   'Lessor has elected not to require general liability insurance under this Agreement. Lessor accepts full risk and responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement, except as otherwise expressly allocated in this Agreement.',
   '{"equals": ["NOT_REQ_FULL"], "field_key": "TXN.GL_LESSOR_ELECTION"}'),

  ('INSURANCE_RISK.GL_LESSOR_B', 152,
   'Lessor has elected not to require general liability insurance under this Agreement. Lessor accepts risk and responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement, except for any such claim arising from an event for which Lessee is at fault, and except as otherwise expressly allocated in this Agreement. Each party is responsible for the costs of any claim arising from an event for which that party is at fault.',
   '{"equals": ["NOT_REQ_FAULT"], "field_key": "TXN.GL_LESSOR_ELECTION"}'),

  ('INSURANCE_RISK.GL_LESSOR_HAS', 153,
   'Lessor has and will maintain general liability insurance covering the Horse and the activities contemplated by this Agreement for the duration of this Agreement, and shall provide proof of coverage to Lessee upon request.',
   '{"equals": ["HAS"], "field_key": "TXN.GL_LESSOR_ELECTION"}'),

  ('INSURANCE_RISK.GL_LESSOR_WILL', 154,
   'Lessor will obtain and will maintain general liability insurance covering the Horse and the activities contemplated by this Agreement, effective no later than the commencement of this Agreement and for its duration, and shall provide proof of coverage to Lessee upon request.',
   '{"equals": ["WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"}'),

  -- derived, not certified: the election above already says it
  ('INSURANCE_RISK.GL_LESSOR_RESP', 155,
   'Lessor accepts financial responsibility for general liability insurance under this Agreement. As between the parties, and except as otherwise expressly allocated in this Agreement, Lessor bears responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement to the extent not covered by an in-force policy.',
   '{"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"}'),

  ('INSURANCE_RISK.GL_LESSEE_ACCEPT', 157,
   'Lessee does not carry general liability insurance under this Agreement. Lessee accepts financial responsibility for liability claims for bodily injury or property damage to third parties arising from an event for which Lessee is at fault, except as otherwise expressly allocated in this Agreement.',
   '{"equals": ["ACCEPT_FAULT"], "field_key": "TXN.GL_LESSEE_ELECTION"}'),

  ('INSURANCE_RISK.GL_LESSEE_HAS', 158,
   'Lessee has and will maintain general liability insurance covering the Horse and the activities contemplated by this Agreement for the duration of this Agreement, and shall provide proof of coverage to Lessor upon request.',
   '{"equals": ["HAS"], "field_key": "TXN.GL_LESSEE_ELECTION"}'),

  ('INSURANCE_RISK.GL_LESSEE_WILL', 159,
   'Lessee will obtain and will maintain general liability insurance covering the Horse and the activities contemplated by this Agreement, effective no later than the commencement of this Agreement and for its duration, and shall provide proof of coverage to Lessor upon request.',
   '{"equals": ["WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_ELECTION"}'),

  ('INSURANCE_RISK.GL_LESSEE_RESP', 160,
   'Lessee accepts financial responsibility for general liability insurance under this Agreement. Lessee shall maintain, at Lessee''s sole cost, general liability insurance covering the Horse and the activities contemplated by this Agreement for the duration of this Agreement, and shall provide proof of coverage to Lessor upon request. As between the parties, and except as otherwise expressly allocated in this Agreement, Lessee bears responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement to the extent not covered by an in-force policy.',
   '{"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_ELECTION"}')

  ) AS v(ck, so, body, cond)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- The Lessee election. Its own clause so the control has a home; empty body, so it
-- prints nothing itself. Suppressed entirely when the Lessor accepts everything (A).
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', 'INSURANCE_RISK.GL_LESSEE_PICK', NULL, '', 'input', 156, false,
       '{"equals": ["NOT_REQ_FAULT", "HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"}'::jsonb, false
  FROM _lf
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, required, is_optional, sort_order, options, conditional_on)
SELECT k, 'TXN.GL_LESSEE_ELECTION', 'Lessee', 'INSURANCE_RISK',
       'INSURANCE_RISK.GL_LESSEE_PICK', 'LESSOR', 'select', 'select', true, false, 156,
       '[{"label": "Accepts responsibility for at-fault costs; does not carry general liability insurance", "value": "ACCEPT_FAULT"},
         {"label": "Has and will maintain general liability insurance", "value": "HAS"},
         {"label": "Will obtain and will maintain general liability insurance", "value": "WILL_OBTAIN"}]'::jsonb,
       '{"equals": ["NOT_REQ_FAULT", "HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"}'::jsonb
  FROM _lf
ON CONFLICT (template_key, field_key) DO NOTHING;

-- Deductible: only meaningful when a Lessor policy exists to have one.
UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.GL_DED_SIMPLE';
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"},
                                  {"equals": ["SPLIT"], "field_key": "TXN.GL_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.GL_DED_SPLITC';
UPDATE contract_field_defs
   SET conditional_on = '{"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.GL_DED_RESP';
UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"},
                                  {"equals": ["SPLIT"], "field_key": "TXN.GL_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN ('TXN.GL_DED_RESP_SPLIT_LESSOR', 'TXN.GL_DED_RESP_SPLIT_LESSEE');

-- A real acceptance: the Lessor is imposing a cost on the Lessee, so the Lessee says yes.
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', 'INSURANCE_RISK.GL_DED_ACCEPT', NULL, '', 'input', 166, false,
       '{"all": [{"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"},
                 {"equals": ["LESSEE", "SPLIT"], "field_key": "TXN.GL_DED_RESP"}]}'::jsonb, false
  FROM _lf
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, format_type, required, is_optional, sort_order, conditional_on)
SELECT k, 'TXN.GL_DED_LESSEE_ACCEPT',
       'Lessee accepts responsibility for the share of any deductible allocated to Lessee above, for claims arising from events for which Lessee bears responsibility.',
       'INSURANCE_RISK', 'INSURANCE_RISK.GL_DED_ACCEPT', 'LESSEE',
       'certify', 'checkbox', 'certify', false, true, 166,
       '{"all": [{"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"},
                 {"equals": ["LESSEE", "SPLIT"], "field_key": "TXN.GL_DED_RESP"}]}'::jsonb
  FROM _lf
ON CONFLICT (template_key, field_key) DO NOTHING;


-- ═══ Care, Custody and Control — folded into 13.2, ENTITY Lessee only ════════
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', v.ck, NULL, v.body, 'input', v.so, false, v.cond::jsonb, false
  FROM _lf CROSS JOIN (VALUES

  ('INSURANCE_RISK.CCC_PICK', 170, '',
   '{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}'),

  ('INSURANCE_RISK.CCC_NONE', 171,
   'Lessor does not require Lessee to carry care, custody and control insurance under this Agreement.',
   '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
             {"equals": ["NO"], "field_key": "TXN.CCC_REQUIRED"}]}'),

  ('INSURANCE_RISK.CCC_REQ', 172,
   'Lessor requires Lessee to have care, custody and control insurance for the duration of this Agreement. Care, custody and control insurance applies only where loss of, injury to, or death of the Horse is caused by Lessee''s negligence. It shall not be claimed against merely because other coverage is unavailable, is not in force, or has denied a claim. Where a loss is caused by Lessee''s negligence, care, custody and control insurance is the policy to be claimed against for that loss.',
   '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
             {"equals": ["YES"], "field_key": "TXN.CCC_REQUIRED"}]}'),

  ('INSURANCE_RISK.CCC_STATUS', 173,
   'Lessee: {{TXN.CCC_LESSEE_STATUS}} care, custody and control insurance covering the Horse while in Lessee''s care, custody, or control.',
   '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
             {"equals": ["YES"], "field_key": "TXN.CCC_REQUIRED"}]}'),

  ('INSURANCE_RISK.CCC_ACCEPT', 174, '',
   '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
             {"equals": ["YES"], "field_key": "TXN.CCC_REQUIRED"}]}')

  ) AS v(ck, so, body, cond)
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, format_type, required, is_optional, sort_order, options, conditional_on)
SELECT k, v.fk, v.label, 'INSURANCE_RISK', v.ck, v.owner,
       v.kind, v.vtype, v.fmt, v.req, v.opt, v.so, v.options::jsonb, v.cond::jsonb
  FROM _lf CROSS JOIN (VALUES

  ('TXN.CCC_REQUIRED', 'Care, custody and control insurance', 'INSURANCE_RISK.CCC_PICK', 'LESSOR',
   'select', 'select', NULL, true, false, 170,
   '[{"label": "Lessor does not require Lessee to have Care, Custody and Control insurance", "value": "NO"},
     {"label": "Lessor requires Lessee to have Care, Custody and Control insurance for the duration of this lease agreement", "value": "YES"}]',
   '{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}'),

  ('TXN.CCC_LESSEE_STATUS', 'Lessee', 'INSURANCE_RISK.CCC_STATUS', 'LESSOR',
   'select', 'select', NULL, true, false, 173,
   '[{"label": "has and will maintain", "value": "HAS"},
     {"label": "will obtain and will maintain", "value": "WILL_OBTAIN"}]',
   '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
             {"equals": ["YES"], "field_key": "TXN.CCC_REQUIRED"}]}'),

  ('TXN.CCC_LESSEE_ACCEPT',
   'Lessee accepts financial responsibility for the cost of care, custody and control insurance under this Agreement.',
   'INSURANCE_RISK.CCC_ACCEPT', 'LESSEE',
   'certify', 'checkbox', 'certify', false, true, 174, NULL,
   '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
             {"equals": ["YES"], "field_key": "TXN.CCC_REQUIRED"}]}')

  ) AS v(fk, label, ck, owner, kind, vtype, fmt, req, opt, so, options, cond)
ON CONFLICT (template_key, field_key) DO NOTHING;


-- ═══ 13.3 MORTALITY (partial lease: Lessor-side only) ════════════════════════
INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, required, is_optional, sort_order, options)
SELECT k, 'TXN.MORT_ELECTION', 'Mortality insurance', 'INSURANCE_RISK',
       'INSURANCE_RISK.MORTALITY', 'LESSOR', 'select', 'select', true, false, 200,
       '[{"label": "Lessor does not require mortality insurance", "value": "NOT_REQUIRED"},
         {"label": "Lessor requires mortality insurance", "value": "REQUIRED"}]'::jsonb
  FROM _lf
ON CONFLICT (template_key, field_key) DO NOTHING;

-- The Lessee can no longer elect to carry mortality; only the Lessor's own status remains.
UPDATE contract_field_defs
   SET options = '[{"label": "currently has", "value": "HAS"},
                   {"label": "will obtain", "value": "WILL_OBTAIN"}]'::jsonb,
       clause_key = 'INSURANCE_RISK.MORT_REQ',
       conditional_on = '{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"}'::jsonb,
       sort_order = 202
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.MORT_LESSOR_STATUS';

INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', v.ck, NULL, v.body, 'input', v.so, false, v.cond::jsonb, false
  FROM _lf CROSS JOIN (VALUES

  ('INSURANCE_RISK.MORT_NOT_REQ', 201,
   'Lessor does not require mortality insurance on the Horse under this Agreement. Lessor accepts full risk and responsibility for the loss of the Horse''s value in the event of the Horse''s death, theft, or humane destruction, except as otherwise expressly allocated in this Agreement.',
   '{"equals": ["NOT_REQUIRED"], "field_key": "TXN.MORT_ELECTION"}'),

  ('INSURANCE_RISK.MORT_REQ', 202,
   'Lessor requires mortality insurance on the Horse for the duration of this Agreement. Lessor {{TXN.MORT_LESSOR_STATUS}} such a policy. Lessor bears responsibility for loss of, injury to, or death of the Horse, and Lessor''s mortality policy shall be the first policy noticed and claimed against for any such covered event.',
   '{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"}'),

  ('INSURANCE_RISK.MORT_COST', 206,
   'The cost of the policy is {{TXN.MORT_COST_RESP}}.',
   '{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"}'),

  ('INSURANCE_RISK.MORT_COST_SPLIT', 207,
   'The cost of the policy shall be split between the parties: {{TXN.MORT_COST_SPLIT_LESSOR}} paid by Lessor and {{TXN.MORT_COST_SPLIT_LESSEE}} paid by Lessee.',
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["SPLIT"], "field_key": "TXN.MORT_COST_RESP"}]}'),

  -- The composed allocation line. Empty until a policy cost is entered, and a line
  -- whose only token is empty is dropped by remerge — so nothing prints until it can.
  ('INSURANCE_RISK.MORT_COST_TOTAL', 208, '{{TXN.MORT_COST_ALLOCATION}}',
   '{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"}'),

  ('INSURANCE_RISK.MORT_DISCLAIMER', 210,
   'Lessee''s obligation to contribute to the cost of this policy exists only while this Agreement is in effect and ends upon the termination or expiration of this Agreement, however arising. The cost of the policy is subject to change. Where the parties'' shares are stated as percentages, those percentages shall govern the allocation of any change in the cost of the policy.',
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["LESSEE", "SPLIT"], "field_key": "TXN.MORT_COST_RESP"}]}'),

  ('INSURANCE_RISK.MORT_ACCEPT', 211, '',
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["LESSEE", "SPLIT"], "field_key": "TXN.MORT_COST_RESP"}]}')

  ) AS v(ck, so, body, cond)
ON CONFLICT (template_key, clause_key) DO NOTHING;

UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MORT_DEDR_SIMPLE';
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["SPLIT"], "field_key": "TXN.MORT_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MORT_DEDR_SPLITC';
UPDATE contract_field_defs
   SET conditional_on = '{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.MORT_DED_RESP';
UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["SPLIT"], "field_key": "TXN.MORT_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN ('TXN.MORT_DED_RESP_SPLIT_LESSOR', 'TXN.MORT_DED_RESP_SPLIT_LESSEE');


-- ═══ 13.4 MEDICAL (only ever a rider on the mortality policy) ════════════════
INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, required, is_optional, sort_order, options, conditional_on)
SELECT k, 'TXN.MED_INCLUDED', 'Medical coverage is included on the mortality policy',
       'INSURANCE_RISK', 'INSURANCE_RISK.MEDICAL', 'LESSOR', 'yesno', 'text', true, false, 300,
       NULL, '{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"}'::jsonb
  FROM _lf
ON CONFLICT (template_key, field_key) DO NOTHING;

INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', v.ck, NULL, v.body, 'input', v.so, false, v.cond::jsonb, false
  FROM _lf CROSS JOIN (VALUES

  ('INSURANCE_RISK.MED_NA', 301,
   'Not applicable. Medical coverage is available only as a component of a mortality policy on the Horse. Because no mortality insurance is required or in force under this Agreement, no medical coverage is available.',
   '{"equals": ["NOT_REQUIRED"], "field_key": "TXN.MORT_ELECTION"}'),

  ('INSURANCE_RISK.MED_NOT_INCLUDED', 302,
   'Medical coverage is not included on the mortality policy for the Horse under this Agreement.',
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["NO"], "field_key": "TXN.MED_INCLUDED"}]}'),

  ('INSURANCE_RISK.MED_INC', 303,
   'Medical coverage is included as a component of the mortality policy on the Horse for the duration of this Agreement.',
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"}]}'),

  ('INSURANCE_RISK.MED_COST', 306,
   'The cost of the medical component is {{TXN.MED_COST_RESP}}.',
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"}]}'),

  ('INSURANCE_RISK.MED_COST_SPLIT', 307,
   'The cost of the medical component shall be split between the parties: {{TXN.MED_COST_SPLIT_LESSOR}} paid by Lessor and {{TXN.MED_COST_SPLIT_LESSEE}} paid by Lessee.',
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
             {"equals": ["SPLIT"], "field_key": "TXN.MED_COST_RESP"}]}'),

  ('INSURANCE_RISK.MED_COST_TOTAL', 308, '{{TXN.MED_COST_ALLOCATION}}',
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"}]}'),

  ('INSURANCE_RISK.MED_DISCLAIMER', 310,
   'Lessee''s obligation to contribute to the cost of the medical component exists only while this Agreement is in effect and ends upon the termination or expiration of this Agreement, however arising. The cost of the policy is subject to change. Where the parties'' shares are stated as percentages, those percentages shall govern the allocation of any change in the cost of the policy.',
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
             {"equals": ["LESSEE", "SPLIT"], "field_key": "TXN.MED_COST_RESP"}]}'),

  ('INSURANCE_RISK.MED_ACCEPT', 311, '',
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
             {"equals": ["LESSEE", "SPLIT"], "field_key": "TXN.MED_COST_RESP"}]}')

  ) AS v(ck, so, body, cond)
ON CONFLICT (template_key, clause_key) DO NOTHING;

UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND clause_key IN ('INSURANCE_RISK.MED_DEDR_SIMPLE', 'INSURANCE_RISK.MED_TAIL');
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
                                  {"equals": ["SPLIT"], "field_key": "TXN.MED_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MED_DEDR_SPLITC';
UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.MED_DED_RESP';
UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
                                  {"equals": ["SPLIT"], "field_key": "TXN.MED_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN ('TXN.MED_DED_RESP_SPLIT_LESSOR', 'TXN.MED_DED_RESP_SPLIT_LESSEE');


-- ═══ cost-allocation fields, shared shape for mortality and medical ══════════
INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, format_type, required, is_optional, sort_order, options, conditional_on)
SELECT k, v.fk, v.label, 'INSURANCE_RISK', v.ck, v.owner,
       v.kind, v.vtype, v.fmt, v.req, v.opt, v.so, v.options::jsonb, v.cond::jsonb
  FROM _lf CROSS JOIN (VALUES

  ('TXN.MORT_COST_RESP', 'Cost of the policy', 'INSURANCE_RISK.MORT_COST', 'LESSOR',
   'select', 'select', NULL, true, false, 206,
   '[{"label": "the full responsibility of Lessor", "value": "LESSOR_FULL"},
     {"label": "the responsibility of Lessee", "value": "LESSEE"},
     {"label": "to be split by the parties as set out below", "value": "SPLIT"}]',
   '{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"}'),

  ('TXN.MORT_COST_SPLIT_LESSOR', 'Lessor''s share ($ or %)', 'INSURANCE_RISK.MORT_COST_SPLIT', 'LESSOR',
   'text', 'text', NULL, false, false, 207, NULL,
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["SPLIT"], "field_key": "TXN.MORT_COST_RESP"}]}'),

  ('TXN.MORT_COST_SPLIT_LESSEE', 'Lessee''s share ($ or %)', 'INSURANCE_RISK.MORT_COST_SPLIT', 'LESSOR',
   'text', 'text', NULL, false, false, 207, NULL,
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["SPLIT"], "field_key": "TXN.MORT_COST_RESP"}]}'),

  ('TXN.MORT_POLICY_COST', 'Cost of the policy (if known)', 'INSURANCE_RISK.MORT_COST_TOTAL', 'LESSOR',
   'text', 'text', NULL, false, true, 208, NULL,
   '{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"}'),

  ('TXN.MORT_COST_ALLOCATION', 'Allocation', 'INSURANCE_RISK.MORT_COST_TOTAL', 'SYSTEM',
   'text', 'text', NULL, false, true, 209, NULL,
   '{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"}'),

  ('TXN.MORT_LESSEE_ACCEPT',
   'Lessee accepts financial responsibility for Lessee''s share of the cost of mortality insurance as stated above.',
   'INSURANCE_RISK.MORT_ACCEPT', 'LESSEE',
   'certify', 'checkbox', 'certify', false, true, 211, NULL,
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["LESSEE", "SPLIT"], "field_key": "TXN.MORT_COST_RESP"}]}'),

  ('TXN.MED_COST_RESP', 'Cost of the medical component', 'INSURANCE_RISK.MED_COST', 'LESSOR',
   'select', 'select', NULL, true, false, 306,
   '[{"label": "the full responsibility of Lessor", "value": "LESSOR_FULL"},
     {"label": "the responsibility of Lessee", "value": "LESSEE"},
     {"label": "to be split by the parties as set out below", "value": "SPLIT"}]',
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"}]}'),

  ('TXN.MED_COST_SPLIT_LESSOR', 'Lessor''s share ($ or %)', 'INSURANCE_RISK.MED_COST_SPLIT', 'LESSOR',
   'text', 'text', NULL, false, false, 307, NULL,
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
             {"equals": ["SPLIT"], "field_key": "TXN.MED_COST_RESP"}]}'),

  ('TXN.MED_COST_SPLIT_LESSEE', 'Lessee''s share ($ or %)', 'INSURANCE_RISK.MED_COST_SPLIT', 'LESSOR',
   'text', 'text', NULL, false, false, 307, NULL,
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
             {"equals": ["SPLIT"], "field_key": "TXN.MED_COST_RESP"}]}'),

  ('TXN.MED_POLICY_COST', 'Cost of the medical component (if known)', 'INSURANCE_RISK.MED_COST_TOTAL', 'LESSOR',
   'text', 'text', NULL, false, true, 308, NULL,
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"}]}'),

  ('TXN.MED_COST_ALLOCATION', 'Allocation', 'INSURANCE_RISK.MED_COST_TOTAL', 'SYSTEM',
   'text', 'text', NULL, false, true, 309, NULL,
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"}]}'),

  ('TXN.MED_LESSEE_ACCEPT',
   'Lessee accepts financial responsibility for Lessee''s share of the cost of the medical component as stated above.',
   'INSURANCE_RISK.MED_ACCEPT', 'LESSEE',
   'certify', 'checkbox', 'certify', false, true, 311, NULL,
   '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
             {"equals": ["LESSEE", "SPLIT"], "field_key": "TXN.MED_COST_RESP"}]}')

  ) AS v(fk, label, ck, owner, kind, vtype, fmt, req, opt, so, options, cond)
ON CONFLICT (template_key, field_key) DO NOTHING;
