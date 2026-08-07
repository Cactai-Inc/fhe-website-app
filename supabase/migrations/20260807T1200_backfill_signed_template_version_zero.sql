-- TASK WALLSYNC / Bug A — release members re-walled by their own valid signature.
--
-- 19 EXECUTED documents carry signed_template_version = 0, written by an earlier
-- backfill to mean "signed before we recorded versions". The signing wall checks:
--
--   coalesce(d.signed_template_version, ct2.version) >= ct.version
--
-- coalesce(0, …) returns 0, and 0 >= 1 is false. The guard only fires on NULL, so
-- for these rows it never fires — and the comment above it in
-- contact_document_wall_state() says it exists "rather than silently re-walling
-- someone". It re-walled 3 of 4 account holders, 2 of them into a deadlock (the
-- onboarding page is version-blind, so it offered them nothing to sign).
--
-- Why 1 is provable and not a guess: every affected row belongs to COMPANY_POLICIES
-- or FACILITY_RULES, and contract_templates holds ONE row per template_key with the
-- version mutated in place. Both sit at version 1 and no second version has ever
-- existed, so there was nothing else these signatures could have been against.
--
-- The DO block refuses the migration outright if any signed_v = 0 row is found on a
-- template past version 1 — for those the signed version is genuinely unknowable and
-- must be resolved by re-signature, never by assumption.
--
-- Touches signed_template_version ONLY. No document status, current_status or
-- signature content changes. Structural fix (one shared satisfaction predicate) is
-- Bug B, deliberately a separate migration.

BEGIN;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM documents d
    JOIN contract_templates ct ON ct.id = d.template_id
   WHERE d.status = 'EXECUTED' AND d.deleted_at IS NULL
     AND d.signed_template_version = 0
     AND ct.version <> 1;
  IF n > 0 THEN
    RAISE EXCEPTION 'WALLSYNC: % ambiguous row(s) on a re-versioned template; resolve by re-signature, not backfill', n;
  END IF;
END $$;

UPDATE documents d
   SET signed_template_version = 1
  FROM contract_templates ct
 WHERE ct.id = d.template_id
   AND d.status = 'EXECUTED' AND d.deleted_at IS NULL
   AND d.signed_template_version = 0
   AND ct.version = 1;

COMMIT;
