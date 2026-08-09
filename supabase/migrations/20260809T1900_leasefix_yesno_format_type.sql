/*
  # LEASEFIX 2i — the two new Yes/No gates render as Yes/No

  Owner, 2026-08-09: the rider-aids gate I added in batch 1 renders as a free-text
  box instead of a Yes / No pair.

  Cause: the control is dispatched on `format_type`, not `input_kind` —
  ContractCascade has `if (fmt === 'yesno')` at both the block (794) and inline
  (1217) render paths, and NO `kind === 'yesno'` fallback anywhere. I set
  input_kind='yesno' and left format_type NULL, so both fields fell through to the
  default text input.

  Every one of the eight Yes/No fields that predate this work sets BOTH columns;
  the only two in the template with a NULL format_type are the two I created:

      TXN.RIDER_AIDS_PROHIBITED   (12.6, batch 1)
      TXN.MED_INCLUDED            (13.5, batch 2b)

  Selects are NOT affected and are deliberately left alone: `kind === 'select'` IS
  handled (874, 1219), so the insurance elections dispatch correctly off input_kind
  regardless of format_type. Verified before writing this rather than assumed.

  Nothing else about 12.6 changes — the Yes branch already reveals the prohibited
  aids list with its "Other" free-text follow-up, and the No branch already prints
  the single sentence "Lessor does not prohibit the use of rider aids."

  This is a data fix. It needs no deploy and does not touch main.

  Requires PGCLIENTENCODING=UTF8.
*/

UPDATE contract_field_defs
   SET format_type = 'yesno'
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND field_key IN ('TXN.RIDER_AIDS_PROHIBITED', 'TXN.MED_INCLUDED')
   AND input_kind = 'yesno'
   AND format_type IS DISTINCT FROM 'yesno';

-- Live documents carry their own copy of the def-owned columns, so they need the
-- refresh too. sync_contract_fields_from_defs is now safe for this (2g stopped it
-- blanking imported HORSE.* values), and a yesno field has no options array, so
-- the option-reset rule cannot touch it either.
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
