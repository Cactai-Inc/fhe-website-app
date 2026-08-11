/*
  # LEASEFIX 2p — ruling 3 (mortality/medical) and the single-share collapse

  ── RULING 3: mortality is the parent, medical the optional component ────────

  On a partial lease the Lessee cannot insure a horse they do not own, so
  "Lessor requires mortality insurance" was the wrong question — carried over from
  general liability, where requiring a policy of the Lessee is meaningful. The only
  true variable is whether the LESSOR holds one, so the old two-dropdown shape
  (TXN.MORT_ELECTION "is it required" + TXN.MORT_LESSOR_STATUS "has/will obtain")
  MERGES into one election whose answer alone governs everything below:

      NOT_CARRIED   Lessor does not carry a mortality insurance policy for the Horse
      CARRIES       Lessor carries a mortality insurance policy for the Horse
      WILL_OBTAIN   Lessor will obtain a mortality insurance policy for the Horse
                    for the duration of this Agreement

  The dependency is one-directional and is the whole design: mortality stands
  alone and needs nothing; medical is available ONLY where mortality is carried or
  will be obtained; mortality never requires medical. This is the same parent/
  component machinery built for GL -> CCC in 2o, reused rather than reinvented.

  VOCABULARY: "component", never "rider" (owner, 2026-08-10). In a horse lease
  "rider" means the person on the horse. MED_NA already said "a component of a
  mortality policy on the Horse"; every clause added here matches that. The word
  is banned in contract text only — parent/rider stays in these comments and the
  engineering docs.

  ── THE SPLIT: ONE FIELD, ONE PARTY, A UNIT SELECTOR ────────────────────────

  Corrected by the owner 2026-08-10, superseding the percent-only reading:

    > "$100 toward the insurance" is not expressible as a percentage. A fixed
    > contribution and a proportion are different agreements — 10% floats with the
    > premium at renewal, $100 does not — so converting one to the other changes
    > what was agreed.

      Lessee's share of the cost:  [$|%] [number]

  `%` means the Lessor's share is 100 minus X. `$` means the Lessor pays the
  remainder. Either way it is arithmetic and left unstated — NEVER a second field.
  Two independent party shares that can each say 60% is what was actually broken.

  So at all five split sites the per-party PAIR is deleted and replaced by one
  field naming the Lessee in its LABEL, not in its value:

      TXN.MORT_COST_SPLIT_{LESSOR,LESSEE}   -> TXN.MORT_COST_LESSEE_SHARE
      TXN.MED_COST_SPLIT_{LESSOR,LESSEE}    -> TXN.MED_COST_LESSEE_SHARE
      TXN.MORT_DED_RESP_SPLIT_{LESSOR,LESSEE} -> TXN.MORT_DED_LESSEE_SHARE
      TXN.MED_DED_RESP_SPLIT_{LESSOR,LESSEE}  -> TXN.MED_DED_LESSEE_SHARE
      TXN.GL_DED_RESP_SPLIT_{LESSOR,LESSEE}   -> TXN.GL_DED_LESSEE_SHARE

  Typed `percent`, which already ships and renders the unit so the label does not
  have to. The `$`/`%` SELECTOR does not exist yet — that is a ContractCascade
  change, presented as a diff and NOT applied, because it is the shared authoring
  surface for lease, sale and bill of sale. Until it lands these render as percent
  fields; the data shape is already correct for it.

  Also deleted, per the owner: the premium input, the floating `Allocation` field,
  and the composed `*_SPLIT_TEXT` line that restated the split the line above
  already established. The premium is a FACT that changes over time and belongs in
  an appendix; the split is a TERM of the agreement and belongs in the clause.

  compose_insurance_allocation() becomes inert once TXN.*_POLICY_COST is gone (it
  returns at its first CONTINUE WHEN NOT FOUND). It is LEFT IN PLACE, not dropped,
  so the four migrations that reference it stay replayable.

  Requires PGCLIENTENCODING=UTF8.
*/

CREATE TEMP TABLE _lf(k text) ON COMMIT DROP;
INSERT INTO _lf VALUES
  ('HORSE_LEASE_V2'), ('HORSE_LEASE_STANDARD'), ('HORSE_LEASE_FULL'), ('HORSE_LEASE_SIMPLE');


-- ═══ retire what the owner ordered removed ═══════════════════════════════════
DELETE FROM contract_field_defs
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN (
     'TXN.MORT_LESSOR_STATUS',
     'TXN.MORT_POLICY_COST',  'TXN.MORT_COST_ALLOCATION', 'TXN.MORT_COST_SPLIT_TEXT',
     'TXN.MED_POLICY_COST',   'TXN.MED_COST_ALLOCATION',  'TXN.MED_COST_SPLIT_TEXT',
     'TXN.MORT_COST_SPLIT_LESSOR', 'TXN.MORT_COST_SPLIT_LESSEE',
     'TXN.MED_COST_SPLIT_LESSOR',  'TXN.MED_COST_SPLIT_LESSEE',
     'TXN.MORT_DED_RESP_SPLIT_LESSOR', 'TXN.MORT_DED_RESP_SPLIT_LESSEE',
     'TXN.MED_DED_RESP_SPLIT_LESSOR',  'TXN.MED_DED_RESP_SPLIT_LESSEE',
     'TXN.GL_DED_RESP_SPLIT_LESSOR',   'TXN.GL_DED_RESP_SPLIT_LESSEE');

DELETE FROM contract_clause_defs
 WHERE template_key IN (SELECT k FROM _lf)
   AND clause_key IN ('INSURANCE_RISK.MORT_REQ',
                      'INSURANCE_RISK.MORT_COST_SPLIT', 'INSURANCE_RISK.MORT_COST_TOTAL',
                      'INSURANCE_RISK.MED_COST_SPLIT',  'INSURANCE_RISK.MED_COST_TOTAL',
                      'INSURANCE_RISK.MORT_SHARES', 'INSURANCE_RISK.MED_SHARES');


-- ═══ ruling 3 — one Lessor-side election ═════════════════════════════════════
UPDATE contract_field_defs
   SET label = 'Mortality insurance',
       options = '[{"label": "Lessor does not carry a mortality insurance policy for the Horse", "value": "NOT_CARRIED"},
                   {"label": "Lessor carries a mortality insurance policy for the Horse", "value": "CARRIES"},
                   {"label": "Lessor will obtain a mortality insurance policy for the Horse for the duration of this Agreement", "value": "WILL_OBTAIN"}]'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.MORT_ELECTION';

UPDATE contract_clause_defs
   SET body = 'Lessor does not carry mortality insurance on the Horse under this Agreement. Lessor accepts full risk and responsibility for the loss of the Horse''s value in the event of the Horse''s death, theft, or humane destruction, except as otherwise expressly allocated in this Agreement.',
       conditional_on = '{"equals": ["NOT_CARRIED"], "field_key": "TXN.MORT_ELECTION"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MORT_NOT_REQ';

INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', v.ck, NULL, v.body, 'prose', v.so, false, v.cond::jsonb, false
  FROM _lf CROSS JOIN (VALUES
  ('INSURANCE_RISK.MORT_CARRIES', 202,
   'Lessor carries a mortality insurance policy for the Horse. Lessor bears responsibility for loss of, injury to, or death of the Horse, and Lessor''s mortality policy shall be the first policy noticed and claimed against for any such covered event.',
   '{"equals": ["CARRIES"], "field_key": "TXN.MORT_ELECTION"}'),
  ('INSURANCE_RISK.MORT_WILL_OBTAIN', 203,
   'Lessor will obtain a mortality insurance policy for the Horse. Lessor bears responsibility for loss of, injury to, or death of the Horse, and Lessor''s mortality policy shall be the first policy noticed and claimed against for any such covered event.',
   '{"equals": ["WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"}')
  ) AS v(ck, so, body, cond)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- everything downstream keys off "a policy is or will be in force"
UPDATE contract_clause_defs
   SET conditional_on = replace(conditional_on::text,
         '"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"',
         '"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"')::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND conditional_on::text LIKE '%"REQUIRED"%';
UPDATE contract_field_defs
   SET conditional_on = replace(conditional_on::text,
         '"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"',
         '"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"')::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND conditional_on::text LIKE '%"REQUIRED"%';
UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["NOT_CARRIED"], "field_key": "TXN.MORT_ELECTION"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MED_NA';

-- cost: the three real options, both sections
UPDATE contract_field_defs
   SET options = '[{"label": "paid by Lessor", "value": "LESSOR"},
                   {"label": "split between Lessor and Lessee", "value": "SPLIT"},
                   {"label": "Other", "value": "OTHER"}]'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN ('TXN.MORT_COST_RESP', 'TXN.MED_COST_RESP');


-- ═══ one share field per split site ══════════════════════════════════════════
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', v.ck, NULL, v.body, 'input', v.so, false, v.cond::jsonb, false
  FROM _lf CROSS JOIN (VALUES
  ('INSURANCE_RISK.MORT_SHARE', 207, 'Lessee''s share of the cost: {{TXN.MORT_COST_LESSEE_SHARE}}',
   '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["SPLIT"], "field_key": "TXN.MORT_COST_RESP"}]}'),
  ('INSURANCE_RISK.MED_SHARE', 307, 'Lessee''s share of the cost: {{TXN.MED_COST_LESSEE_SHARE}}',
   '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
             {"equals": ["SPLIT"], "field_key": "TXN.MED_COST_RESP"}]}')
  ) AS v(ck, so, body, cond)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- the deductible split clauses lose their pair and take the single share
UPDATE contract_clause_defs
   SET body = 'Lessee''s share of the deductible: {{TXN.MORT_DED_LESSEE_SHARE}}'
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MORT_DEDR_SPLITC';
UPDATE contract_clause_defs
   SET body = 'Lessee''s share of the deductible: {{TXN.MED_DED_LESSEE_SHARE}}'
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MED_DEDR_SPLITC';
UPDATE contract_clause_defs
   SET body = 'Lessee''s share of the deductible: {{TXN.GL_DED_LESSEE_SHARE}}'
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.GL_DED_SPLITC';

INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, format_type, required, is_optional, sort_order, conditional_on)
SELECT k, v.fk, v.label, 'INSURANCE_RISK', v.ck, 'LESSOR',
       'percent', 'text', 'percent', false, false, v.so, v.cond::jsonb
  FROM _lf CROSS JOIN (VALUES

  ('TXN.MORT_COST_LESSEE_SHARE', 'Lessee''s share of the cost', 'INSURANCE_RISK.MORT_SHARE', 207,
   '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["SPLIT"], "field_key": "TXN.MORT_COST_RESP"}]}'),

  ('TXN.MED_COST_LESSEE_SHARE', 'Lessee''s share of the cost', 'INSURANCE_RISK.MED_SHARE', 307,
   '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
             {"equals": ["SPLIT"], "field_key": "TXN.MED_COST_RESP"}]}'),

  ('TXN.MORT_DED_LESSEE_SHARE', 'Lessee''s share of the deductible', 'INSURANCE_RISK.MORT_DEDR_SPLITC', 215,
   '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MORT_COST_RESP"},
             {"equals": ["SPLIT"], "field_key": "TXN.MORT_DED_RESP"}]}'),

  ('TXN.MED_DED_LESSEE_SHARE', 'Lessee''s share of the deductible', 'INSURANCE_RISK.MED_DEDR_SPLITC', 315,
   '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
             {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MED_COST_RESP"},
             {"equals": ["SPLIT"], "field_key": "TXN.MED_DED_RESP"}]}'),

  ('TXN.GL_DED_LESSEE_SHARE', 'Lessee''s share of the deductible', 'INSURANCE_RISK.GL_DED_SPLITC', 164,
   '{"all": [{"equals": ["GL_ONLY"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
             {"equals": ["SPLIT"], "field_key": "TXN.GL_DED_RESP"}]}')

  ) AS v(fk, label, ck, so, cond)
ON CONFLICT (template_key, field_key) DO NOTHING;


-- ═══ the deductible gate the owner reported ══════════════════════════════════
-- it asked who bears the deductible even where the Lessor pays for the policy
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MORT_COST_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MORT_DEDR_SIMPLE';
UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MORT_COST_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.MORT_DED_RESP';
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MORT_COST_RESP"},
                                  {"equals": ["SPLIT"], "field_key": "TXN.MORT_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MORT_DEDR_SPLITC';

UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
                                  {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MED_COST_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MED_DEDR_SIMPLE';
UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
                                  {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MED_COST_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.MED_DED_RESP';
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
                                  {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MED_COST_RESP"},
                                  {"equals": ["SPLIT"], "field_key": "TXN.MED_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MED_DEDR_SPLITC';
