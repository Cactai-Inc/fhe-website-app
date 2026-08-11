/*
  # LEASEFIX 2m — the Lessee's "does not carry" option is selectable, and renamed

  Owner, 2026-08-10: 13.2's Lessee dropdown offers "Has and will maintain…",
  "Will obtain…" and "Other" — but one of the optional inserts names a selection
  that is not in the menu, so the insert can never be triggered.

  Cause. TXN.GL_LESSEE_STATUS's third option, ACCEPTS_PERSONALLY, carries an
  option-level `when` restricting it to the branch where the Lessor requires
  nothing AND has assigned at-fault costs to the Lessee. In every other branch the
  option is filtered out of the menu — while INSURANCE_RISK.GL_LESSEE_PERSONAL,
  which it gates, is still PREVIEWED muted to the author with the caption
  "This is included when “Lessee” is “Does not carry a policy and accepts the
  at-fault costs personally”." An insert advertising a trigger the menu does not
  offer is the defect.

  Two changes, both to the option:

  1. Label -> "Does not carry general liability insurance" (owner's wording; the
     long sentence was doing the work a clause body should do). The gate caption
     is GENERATED from this label by describeGate/gateValueLabel, so the sentence
     the owner asked to have matched updates itself — there is no second place to
     edit, and no way for the two to drift apart.

  2. The `when` is removed, so the option appears in the menu in every branch,
     which is what the owner asked for.

  CONSEQUENCE, flagged not decided: with the `when` gone, "does not carry" is also
  selectable where the Lessor REQUIRES general liability of the Lessee. The
  document would then state the requirement and the Lessee's non-carriage together
  — a contradiction on its face. That is arguably a legitimate draft state (the
  parties resolve it before signing, and it is visible rather than hidden), but if
  it should be impossible instead, the fix is a narrower `when` limited to
  TXN.GL_LESSOR_REQUIRES = NEITHER. Say which and it is a one-line change.

  The clause body is NOT touched: the owner's "this sentence" is the generated
  caption, not the insert's prose, and that prose was signed off in 2k.

  Requires PGCLIENTENCODING=UTF8.
*/

UPDATE contract_field_defs
   SET options = '[{"label": "Has and will maintain general liability insurance", "value": "HAS"},
                   {"label": "Will obtain and will maintain general liability insurance", "value": "WILL_OBTAIN",
                    "when": {"equals": ["GL_ONLY", "GL_AND_CCC"], "field_key": "TXN.GL_LESSOR_REQUIRES"}},
                   {"label": "Does not carry general liability insurance", "value": "ACCEPTS_PERSONALLY"}]'::jsonb
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND field_key = 'TXN.GL_LESSEE_STATUS'
   AND NOT (options @> '[{"value": "ACCEPTS_PERSONALLY", "label": "Does not carry general liability insurance"}]'::jsonb);

-- live documents carry their own copy of the options
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
