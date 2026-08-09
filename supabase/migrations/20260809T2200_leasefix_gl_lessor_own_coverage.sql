/*
  # LEASEFIX 2l — the Lessor's own liability coverage is its own question

  Owner, 2026-08-09: "lessor coverage is separate from lessee when it comes to
  liability."

  2k rebuilt 13.2 around what the Lessor REQUIRES OF THE LESSEE, which is the axis
  CCC hangs off. Correct, but it left nowhere for the Lessor to state what THEY
  carry — I flagged that rather than inventing a fourth option, because folding it
  back into the requirement list is exactly the conflation the owner caught in the
  first place ("requires Lessee to carry" and "has a policy" are not alternatives;
  a Lessor can do both, or neither).

  So it becomes a second, independent election, asked always and answered
  separately:

      TXN.GL_LESSOR_COVERAGE   HAS / WILL_OBTAIN / NONE

  It sits FIRST in the section — what the Lessor carries, then what the Lessor
  requires — and it gates nothing. In particular it does NOT gate CCC: CCC rides
  on the LESSEE's policy, so it stays keyed to the requirement, which is the whole
  point of 2k.

  The three paragraphs are the batch 2b sign-off text verbatim (the HAS and
  WILL_OBTAIN wording that 2k retired, restored unchanged), plus a plain statement
  for the case where the Lessor carries nothing.

  Clause sort orders in 13.2 are renumbered to open a slot after the heading and to
  clear two pre-existing collisions (GL_LESSEE_WILL and GL_LESSEE_PERSONAL both sat
  at 159; the deductible block sat at 162 where the Lessee block now runs). The
  branches are mutually exclusive so the ties were harmless, but ordering that
  depends on a tiebreak is ordering waiting to change under you.

  Requires PGCLIENTENCODING=UTF8.
*/

CREATE TEMP TABLE _lf(k text) ON COMMIT DROP;
INSERT INTO _lf VALUES
  ('HORSE_LEASE_V2'), ('HORSE_LEASE_STANDARD'), ('HORSE_LEASE_FULL'), ('HORSE_LEASE_SIMPLE');


-- ── make room: 151-153 for the Lessor's own coverage ─────────────────────────
UPDATE contract_clause_defs cd SET sort_order = v.so
  FROM (VALUES
    ('INSURANCE_RISK.GL_REQUIRED', 154), ('INSURANCE_RISK.GL_NOT_REQUIRED', 155),
    ('INSURANCE_RISK.GL_ALLOC_PICK', 156), ('INSURANCE_RISK.GL_ALLOC_LESSOR', 157),
    ('INSURANCE_RISK.GL_ALLOC_FAULT', 158), ('INSURANCE_RISK.GL_LESSEE_PICK', 159),
    ('INSURANCE_RISK.GL_LESSEE_HAS', 160), ('INSURANCE_RISK.GL_LESSEE_WILL', 161),
    ('INSURANCE_RISK.GL_LESSEE_PERSONAL', 162), ('INSURANCE_RISK.GL_LESSEE_RESP', 163),
    ('INSURANCE_RISK.GL_DED_SIMPLE', 170), ('INSURANCE_RISK.GL_DED_SPLITC', 171),
    ('INSURANCE_RISK.GL_DED_ACCEPT', 172)
  ) AS v(ck, so)
 WHERE cd.template_key IN (SELECT k FROM _lf) AND cd.clause_key = v.ck;


-- ── the Lessor's own coverage ────────────────────────────────────────────────
-- sort_order 149 puts the control ABOVE the requirement control (150) on the
-- section heading clause they share: what the Lessor carries, then what the
-- Lessor requires.
INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, format_type, required, is_optional, sort_order, options)
SELECT k, 'TXN.GL_LESSOR_COVERAGE', 'Lessor', 'INSURANCE_RISK',
       'INSURANCE_RISK.GENERAL_LIABILITY', 'LESSOR', 'select', 'select', 'select',
       true, false, 149,
       '[{"label": "Has and will maintain general liability insurance", "value": "HAS"},
         {"label": "Will obtain and will maintain general liability insurance", "value": "WILL_OBTAIN"},
         {"label": "Does not carry general liability insurance", "value": "NONE"}]'::jsonb
  FROM _lf
ON CONFLICT (template_key, field_key) DO NOTHING;

INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', v.ck, NULL, v.body, 'prose', v.so, false, v.cond::jsonb, false
  FROM _lf CROSS JOIN (VALUES

  ('INSURANCE_RISK.GL_LESSOR_COVERAGE_HAS', 151,
   'Lessor has and will maintain general liability insurance covering the Horse and the activities contemplated by this Agreement for the duration of this Agreement, and shall provide proof of coverage to Lessee upon request.',
   '{"equals": ["HAS"], "field_key": "TXN.GL_LESSOR_COVERAGE"}'),

  ('INSURANCE_RISK.GL_LESSOR_COVERAGE_WILL', 152,
   'Lessor will obtain and will maintain general liability insurance covering the Horse and the activities contemplated by this Agreement, effective no later than the commencement of this Agreement and for its duration, and shall provide proof of coverage to Lessee upon request.',
   '{"equals": ["WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_COVERAGE"}'),

  ('INSURANCE_RISK.GL_LESSOR_COVERAGE_NONE', 153,
   'Lessor does not carry general liability insurance under this Agreement.',
   '{"equals": ["NONE"], "field_key": "TXN.GL_LESSOR_COVERAGE"}')

  ) AS v(ck, so, body, cond)
ON CONFLICT (template_key, clause_key) DO NOTHING;


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
