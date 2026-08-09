/*
  # LEASEFIX 2k — 13.2 is restructured around what the Lessor REQUIRES

  Owner, 2026-08-09. The bug: CCC unlocked whenever the LESSEE elected to carry
  general liability. That let a Lessee's voluntary policy hand the Lessor a power
  they do not have — CCC rides on the Lessee's GL policy, so the Lessor can only
  require CCC if the Lessor is requiring GL in the first place. My CCC rework
  (2e) gated on TXN.GL_LESSEE_ELECTION, which is the Lessee's own choice. Wrong
  field: the gate has to read the Lessor's REQUIREMENT.

  Restructured to the owner's model. 13.2 asks what the Lessor requires:

      GL_AND_CCC   general liability AND care, custody and control  (ENTITY Lessee only)
      GL_ONLY      general liability
      NEITHER      neither

  If either requiring option is chosen, the Lessee answers "has" or "will obtain"
  for each required policy — and nothing else, because a requirement forecloses
  going without. Whether a Lessee who is NOT required to carry happens to hold a
  policy is immaterial to this contract, so that branch is gone entirely.

  If NEITHER, the contract must still say who pays. Owner: "lessor can choose to
  not require coverage but still assign liability for cost to the lessee or they
  can assume all risk for costs entirely to themselves." That becomes a second
  question, asked only in that branch, carrying the two paragraphs already signed
  off in batch 2b:

      LESSOR_ALL        Lessor accepts full risk and responsibility
      LESSEE_AT_FAULT   each party bears the costs of its own at-fault claims

  CCC is now gated on GL_AND_CCC alone (plus the unchanged ENTITY-Lessee rule), so
  it cannot be reached through a Lessee's voluntary policy. Its own
  require/don't-require question is retired — the requirement is expressed once,
  in 13.2, which is what the owner asked for. The "not applicable" branch goes with
  it: when CCC is not required there is simply no CCC section.

  NOT CARRIED OVER, and flagged to the owner rather than decided here: the Lessor's
  OWN coverage election ("has and will maintain" / "will obtain and will maintain").
  All three options the owner specified describe what is required OF THE LESSEE, so
  there is nowhere in this model for the Lessor to state their own policy. If it
  should come back it wants its own question rather than a fifth option on this one.

  Requires PGCLIENTENCODING=UTF8.
*/

CREATE TEMP TABLE _lf(k text) ON COMMIT DROP;
INSERT INTO _lf VALUES
  ('HORSE_LEASE_V2'), ('HORSE_LEASE_STANDARD'), ('HORSE_LEASE_FULL'), ('HORSE_LEASE_SIMPLE');


-- ═══ retire the superseded elections and their branches ══════════════════════
DELETE FROM contract_clause_defs
 WHERE template_key IN (SELECT k FROM _lf)
   AND clause_key IN (
     'INSURANCE_RISK.GL_LESSOR_A', 'INSURANCE_RISK.GL_LESSOR_B',
     'INSURANCE_RISK.GL_LESSOR_HAS', 'INSURANCE_RISK.GL_LESSOR_WILL',
     'INSURANCE_RISK.GL_LESSOR_RESP', 'INSURANCE_RISK.GL_LESSOR_REQUIRES',
     'INSURANCE_RISK.GL_LESSEE_ACCEPT',
     'INSURANCE_RISK.CCC_PICK', 'INSURANCE_RISK.CCC_NONE', 'INSURANCE_RISK.CCC_NA');

DELETE FROM contract_field_defs
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN ('TXN.GL_LESSOR_ELECTION', 'TXN.GL_LESSEE_ELECTION', 'TXN.CCC_REQUIRED');


-- ═══ Q1 — what the Lessor requires of the Lessee ═════════════════════════════
-- GL_AND_CCC is offered only for an ENTITY Lessee: care, custody and control is an
-- entity product. The option-level `when` is honoured by fieldWithAvailableOptions
-- and keeps an already-chosen value visible rather than dropping it silently.
INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, format_type, required, is_optional, sort_order, options)
SELECT k, 'TXN.GL_LESSOR_REQUIRES', 'Lessor requires of Lessee', 'INSURANCE_RISK',
       'INSURANCE_RISK.GENERAL_LIABILITY', 'LESSOR', 'select', 'select', 'select',
       true, false, 150,
       '[{"label": "General liability and care, custody and control insurance", "value": "GL_AND_CCC",
          "when": {"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}},
         {"label": "General liability insurance", "value": "GL_ONLY"},
         {"label": "Neither is required of Lessee", "value": "NEITHER"}]'::jsonb
  FROM _lf
ON CONFLICT (template_key, field_key) DO NOTHING;

INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', v.ck, NULL, v.body, 'prose', v.so, false, v.cond::jsonb, false
  FROM _lf CROSS JOIN (VALUES

  ('INSURANCE_RISK.GL_REQUIRED', 151,
   'Lessor requires Lessee to obtain and maintain, at Lessee''s sole cost, general liability insurance covering the Horse and the activities contemplated by this Agreement for the duration of this Agreement, and to provide proof of coverage to Lessor upon request. Failure to obtain or maintain that coverage constitutes a material breach subject to the Termination for Cause provisions of this Agreement.',
   '{"equals": ["GL_ONLY", "GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"}'),

  ('INSURANCE_RISK.GL_NOT_REQUIRED', 152,
   'Lessor does not require Lessee to carry general liability insurance under this Agreement.',
   '{"equals": ["NEITHER"], "field_key": "TXN.GL_LESSOR_REQUIRES"}'),

  -- the two allocations, verbatim from the batch 2b sign-off
  ('INSURANCE_RISK.GL_ALLOC_LESSOR', 154,
   'Lessor accepts full risk and responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement, except as otherwise expressly allocated in this Agreement.',
   '{"all": [{"equals": ["NEITHER"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
             {"equals": ["LESSOR_ALL"], "field_key": "TXN.GL_NO_REQ_ALLOCATION"}]}'),

  ('INSURANCE_RISK.GL_ALLOC_FAULT', 155,
   'Lessor accepts risk and responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement, except for any such claim arising from an event for which Lessee is at fault, and except as otherwise expressly allocated in this Agreement. Each party is responsible for the costs of any claim arising from an event for which that party is at fault.',
   '{"all": [{"equals": ["NEITHER"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
             {"equals": ["LESSEE_AT_FAULT"], "field_key": "TXN.GL_NO_REQ_ALLOCATION"}]}')

  ) AS v(ck, so, body, cond)
ON CONFLICT (template_key, clause_key) DO NOTHING;


-- ═══ Q2 — who bears the cost when nothing is required ════════════════════════
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', 'INSURANCE_RISK.GL_ALLOC_PICK', NULL, '', 'input', 153, false,
       '{"equals": ["NEITHER"], "field_key": "TXN.GL_LESSOR_REQUIRES"}'::jsonb, false
  FROM _lf
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, format_type, required, is_optional, sort_order, options, conditional_on)
SELECT k, 'TXN.GL_NO_REQ_ALLOCATION', 'Third-party liability costs', 'INSURANCE_RISK',
       'INSURANCE_RISK.GL_ALLOC_PICK', 'LESSOR', 'select', 'select', 'select',
       true, false, 153,
       '[{"label": "Lessor assumes all risk and cost", "value": "LESSOR_ALL"},
         {"label": "Each party bears its own at-fault costs", "value": "LESSEE_AT_FAULT"}]'::jsonb,
       '{"equals": ["NEITHER"], "field_key": "TXN.GL_LESSOR_REQUIRES"}'::jsonb
  FROM _lf
ON CONFLICT (template_key, field_key) DO NOTHING;


-- ═══ the Lessee answers only when something is required ══════════════════════
-- The Lessee also answers in one NOT-required case: where the Lessor has assigned
-- at-fault costs to them (owner, 2026-08-09). There the choice is between having a
-- policy behind that exposure and carrying it personally — so "accepts it
-- personally" is offered ONLY there, and "will obtain" only where it is required.
-- Option-level `when` keeps one field serving both states.
INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, format_type, required, is_optional, sort_order, options, conditional_on)
SELECT k, 'TXN.GL_LESSEE_STATUS', 'Lessee', 'INSURANCE_RISK',
       'INSURANCE_RISK.GL_LESSEE_PICK', 'LESSOR', 'select', 'select', 'select',
       true, false, 156,
       '[{"label": "Has and will maintain general liability insurance", "value": "HAS"},
         {"label": "Will obtain and will maintain general liability insurance", "value": "WILL_OBTAIN",
          "when": {"equals": ["GL_ONLY", "GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"}},
         {"label": "Does not carry a policy and accepts the at-fault costs personally", "value": "ACCEPTS_PERSONALLY",
          "when": {"all": [{"equals": ["NEITHER"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
                           {"equals": ["LESSEE_AT_FAULT"], "field_key": "TXN.GL_NO_REQ_ALLOCATION"}]}}]'::jsonb,
       '{"any": [{"equals": ["GL_ONLY", "GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
                 {"all": [{"equals": ["NEITHER"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
                          {"equals": ["LESSEE_AT_FAULT"], "field_key": "TXN.GL_NO_REQ_ALLOCATION"}]}]}'::jsonb
  FROM _lf
ON CONFLICT (template_key, field_key) DO NOTHING;

UPDATE contract_clause_defs
   SET conditional_on = '{"any": [{"equals": ["GL_ONLY", "GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
                                  {"all": [{"equals": ["NEITHER"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
                                           {"equals": ["LESSEE_AT_FAULT"], "field_key": "TXN.GL_NO_REQ_ALLOCATION"}]}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.GL_LESSEE_PICK';

INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', 'INSURANCE_RISK.GL_LESSEE_PERSONAL', NULL,
       'Lessee does not carry general liability insurance under this Agreement. Lessee accepts personal financial responsibility for the costs of any liability claim for bodily injury or property damage to third parties arising from an event for which Lessee is at fault, and acknowledges that no policy stands behind that responsibility.',
       'prose', 159, false,
       '{"equals": ["ACCEPTS_PERSONALLY"], "field_key": "TXN.GL_LESSEE_STATUS"}'::jsonb, false
  FROM _lf
ON CONFLICT (template_key, clause_key) DO NOTHING;

UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["HAS"], "field_key": "TXN.GL_LESSEE_STATUS"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.GL_LESSEE_HAS';
UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_STATUS"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.GL_LESSEE_WILL';
UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_STATUS"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.GL_LESSEE_RESP';


-- ═══ deductible follows the policy that now exists ═══════════════════════════
UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["GL_ONLY", "GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.GL_DED_SIMPLE';
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["GL_ONLY", "GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
                                  {"equals": ["SPLIT"], "field_key": "TXN.GL_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.GL_DED_SPLITC';
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["GL_ONLY", "GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
                                  {"equals": ["LESSEE", "SPLIT"], "field_key": "TXN.GL_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.GL_DED_ACCEPT';
UPDATE contract_field_defs
   SET conditional_on = '{"equals": ["GL_ONLY", "GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.GL_DED_RESP';
UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["GL_ONLY", "GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
                                  {"equals": ["SPLIT"], "field_key": "TXN.GL_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN ('TXN.GL_DED_RESP_SPLIT_LESSOR', 'TXN.GL_DED_RESP_SPLIT_LESSEE');
UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["GL_ONLY", "GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
                                  {"equals": ["LESSEE", "SPLIT"], "field_key": "TXN.GL_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.GL_DED_LESSEE_ACCEPT';


-- ═══ CCC: required by 13.2, never reachable through a voluntary policy ═══════
UPDATE contract_clause_defs
   SET heading = 'Care, Custody and Control Insurance',
       conditional_on = '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                                  {"equals": ["GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.CCC_REQ';

UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                                  {"equals": ["GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND clause_key IN ('INSURANCE_RISK.CCC_STATUS', 'INSURANCE_RISK.CCC_ACCEPT');

UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                                  {"equals": ["GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN ('TXN.CCC_LESSEE_STATUS', 'TXN.CCC_LESSEE_ACCEPT');


-- live documents pick up the new model
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT d.id FROM documents d
             JOIN contract_templates t ON t.id = d.template_id
            WHERE t.contract_kind = 'HORSE_LEASE' AND d.deleted_at IS NULL
              AND d.workflow_state NOT IN ('executed','void')
  LOOP
    PERFORM sync_contract_fields_from_defs(r.id);
    PERFORM remerge_contract_from_clauses(r.id);
  END LOOP;
END $$;
