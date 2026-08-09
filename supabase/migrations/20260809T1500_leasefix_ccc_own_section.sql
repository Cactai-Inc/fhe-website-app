/*
  # LEASEFIX batch 2e — Care, Custody and Control becomes its own section

  Owner correction 2026-08-09: CCC is not part of a general liability policy by
  default. It is an ADD-ON to one — the same relationship medical has to mortality.
  Two consequences:

    1. It gets its own heading again, immediately after General Liability, rather
       than reading as continuation prose under "13.2 General Liability Insurance".
       (Batch 2b folded it into 13.2 on the earlier instruction; this reverses that
       placement only — the language and the controls are unchanged.)

    2. It DEPENDS on the Lessee carrying general liability. If the Lessee is not
       going to have a policy, there is nothing for CCC to attach to, so the
       section prints N/A and says why — exactly as 13.4 does when there is no
       mortality policy for medical coverage to attach to.

  The ENTITY-Lessee gate is unchanged: an individual Lessee sees no CCC section at
  all, and the numbering closes up behind it.

  Gate note: conditional_on has no "not in" operator, so the N/A branch enumerates
  the complement — TXN.GL_LESSEE_ELECTION is one of '' (unanswered, which includes
  the case where the Lessor accepted everything and the Lessee never got an
  election) or 'ACCEPT_FAULT'. This mirrors the {"equals": ["NO", ""]} idiom used
  throughout this template.

  Requires PGCLIENTENCODING=UTF8.
*/

CREATE TEMP TABLE _lf(k text) ON COMMIT DROP;
INSERT INTO _lf VALUES
  ('HORSE_LEASE_V2'), ('HORSE_LEASE_STANDARD'), ('HORSE_LEASE_FULL'), ('HORSE_LEASE_SIMPLE');


-- ── 1. its own numbered section, straight after General Liability ────────────
UPDATE contract_clause_defs
   SET heading = 'Care, Custody and Control Insurance'
 WHERE template_key IN (SELECT k FROM _lf)
   AND clause_key = 'INSURANCE_RISK.CCC_PICK';


-- ── 2. the dependency: no Lessee general liability, nothing to add CCC to ────
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', 'INSURANCE_RISK.CCC_NA', NULL,
       'Not applicable. Care, custody and control insurance is available only as an addition to a general liability policy carried by Lessee. Because Lessee does not carry general liability insurance under this Agreement, no care, custody and control coverage is available.',
       'prose', 171, false,
       '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                 {"equals": ["", "ACCEPT_FAULT"], "field_key": "TXN.GL_LESSEE_ELECTION"}]}'::jsonb,
       false
  FROM _lf
ON CONFLICT (template_key, clause_key) DO NOTHING;

UPDATE contract_clause_defs SET sort_order = 172
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.CCC_NONE';
UPDATE contract_clause_defs SET sort_order = 173
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.CCC_REQ';
UPDATE contract_clause_defs SET sort_order = 174
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.CCC_STATUS';
UPDATE contract_clause_defs SET sort_order = 175
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.CCC_ACCEPT';


-- ── 3. every CCC control and outcome now requires a Lessee GL policy ─────────
-- The Lessor's require/don't-require election itself is only a real question once
-- there is a policy to attach to; otherwise the N/A clause above stands alone.
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                                  {"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_ELECTION"},
                                  {"equals": ["NO"], "field_key": "TXN.CCC_REQUIRED"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.CCC_NONE';

UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                                  {"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_ELECTION"},
                                  {"equals": ["YES"], "field_key": "TXN.CCC_REQUIRED"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND clause_key IN ('INSURANCE_RISK.CCC_REQ', 'INSURANCE_RISK.CCC_STATUS', 'INSURANCE_RISK.CCC_ACCEPT');

UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                                  {"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_ELECTION"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.CCC_REQUIRED';

-- TXN.CCC_LESSEE_ACCEPT's gate is what contract_lock_blockers reads, so widening it
-- here is what keeps the lock rule honest: no Lessee GL policy, no acceptance owed.
UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                                  {"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_ELECTION"},
                                  {"equals": ["YES"], "field_key": "TXN.CCC_REQUIRED"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN ('TXN.CCC_LESSEE_STATUS', 'TXN.CCC_LESSEE_ACCEPT');
