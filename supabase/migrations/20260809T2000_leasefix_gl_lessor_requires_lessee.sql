/*
  # LEASEFIX 2j — 13.2 gains "Lessor requires the policy to be held by Lessee"

  Owner, 2026-08-09: the general liability section offers no way to say the Lessor
  REQUIRES the Lessee to carry the policy.

  Correct — and the gap is structural, not an oversight of one option. The Lessor
  election as built answers two different questions in one list:

      NOT_REQ_FULL / NOT_REQ_FAULT   a REQUIREMENT the Lessor is waiving
      HAS / WILL_OBTAIN              the Lessor's OWN coverage status

  so "I require you to carry it" had nowhere to live. This adds it as a fifth
  option, which is the smallest change that answers the request:

      REQUIRE_LESSEE   Requires general liability insurance to be held by Lessee

  KNOWN LIMITATION, flagged to the owner rather than decided here: because these
  are one list, REQUIRE_LESSEE is mutually exclusive with HAS / WILL_OBTAIN, so a
  Lessor who carries their own policy AND requires the Lessee's cannot say both.
  Splitting it into two questions ("does Lessor carry?" and "does Lessor require
  Lessee to carry?") is the proper fix and is a larger change to the section.

  Consequences wired here:

  • The Lessee election appears under REQUIRE_LESSEE, and its "does not carry"
    answer is withdrawn — the whole point of the option is that going without is
    no longer available to the Lessee. Done with an option-level `when`, which
    fieldWithAvailableOptions already honours (ClauseDocument 441-444), and which
    keeps an already-selected value visible rather than silently dropping it.
  • CCC needs no change: it gates on TXN.GL_LESSEE_ELECTION ∈ (HAS, WILL_OBTAIN),
    which is exactly what REQUIRE_LESSEE forces, so it becomes available on its own.
  • The deductible question stays gated on the LESSOR holding the policy. Under
    REQUIRE_LESSEE the policy is the Lessee's, so a Lessor-side deductible split
    would be describing someone else's policy. Say if you want it asked here too.

  Requires PGCLIENTENCODING=UTF8.
*/

CREATE TEMP TABLE _lf(k text) ON COMMIT DROP;
INSERT INTO _lf VALUES
  ('HORSE_LEASE_V2'), ('HORSE_LEASE_STANDARD'), ('HORSE_LEASE_FULL'), ('HORSE_LEASE_SIMPLE');


-- ── the fifth Lessor option ──────────────────────────────────────────────────
UPDATE contract_field_defs
   SET options = '[{"label": "Does not require general liability insurance; Lessor accepts full responsibility", "value": "NOT_REQ_FULL"},
                   {"label": "Does not require general liability insurance; each party bears its own at-fault costs", "value": "NOT_REQ_FAULT"},
                   {"label": "Requires general liability insurance to be held by Lessee", "value": "REQUIRE_LESSEE"},
                   {"label": "Has and will maintain general liability insurance", "value": "HAS"},
                   {"label": "Will obtain and will maintain general liability insurance", "value": "WILL_OBTAIN"}]'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key = 'TXN.GL_LESSOR_ELECTION'
   AND NOT (options @> '[{"value": "REQUIRE_LESSEE"}]'::jsonb);


-- ── what it prints ───────────────────────────────────────────────────────────
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', 'INSURANCE_RISK.GL_LESSOR_REQUIRES', NULL,
       'Lessor requires Lessee to obtain and maintain, at Lessee''s sole cost, general liability insurance covering the Horse and the activities contemplated by this Agreement for the duration of this Agreement, and to provide proof of coverage to Lessor upon request. Failure to obtain or maintain that coverage constitutes a material breach subject to the Termination for Cause provisions of this Agreement.',
       'prose', 152, false,
       '{"equals": ["REQUIRE_LESSEE"], "field_key": "TXN.GL_LESSOR_ELECTION"}'::jsonb,
       false
  FROM _lf
ON CONFLICT (template_key, clause_key) DO NOTHING;


-- ── the Lessee must then answer, and cannot answer "no policy" ───────────────
UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["NOT_REQ_FAULT", "REQUIRE_LESSEE", "HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND clause_key = 'INSURANCE_RISK.GL_LESSEE_PICK';

UPDATE contract_field_defs
   SET conditional_on = '{"equals": ["NOT_REQ_FAULT", "REQUIRE_LESSEE", "HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"}'::jsonb,
       options = '[{"label": "Accepts responsibility for at-fault costs; does not carry general liability insurance", "value": "ACCEPT_FAULT",
                    "when": {"equals": ["NOT_REQ_FAULT", "HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_ELECTION"}},
                   {"label": "Has and will maintain general liability insurance", "value": "HAS"},
                   {"label": "Will obtain and will maintain general liability insurance", "value": "WILL_OBTAIN"}]'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key = 'TXN.GL_LESSEE_ELECTION';


-- live documents pick up the new options + gates
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
