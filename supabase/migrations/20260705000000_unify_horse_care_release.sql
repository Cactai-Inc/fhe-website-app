/*
  # FHE CRM — Unify the horse-care liability release under RELEASE_HORSE_CARE

  Owner decision 2026-07-05: there is ONE equine-services liability release for
  all horse-care services. The prior two keys (RELEASE_HORSE_CARE +
  RELEASE_HORSE_EXERCISE) held byte-identical bodies; the split was an artifact,
  not intent. Horse-care services span the full handling→work risk range
  (clipping/turnout … lunging/riding/training), and the single release's
  authorization + assumption-of-risk language already covers the top of that
  range (training-level activity). Attorney to bless the unified scope on review.

  This migration:
  1. Repoints the contract_requirements matrix: HORSE_TRAINING and HORSE_EXERCISE
     now require RELEASE_HORSE_CARE (they previously required the retired
     RELEASE_HORSE_EXERCISE; HORSE_CLIPPING already used RELEASE_HORSE_CARE).
  2. Retires the RELEASE_HORSE_EXERCISE template — deactivated + soft-deleted, NOT
     dropped, so any EXISTING executed/draft documents that reference it keep
     their template_id intact and their sealed bodies untouched (preservation).
     New generations resolve RELEASE_HORSE_CARE.

  Additive and non-destructive: no executed document rows are modified; the old
  template row is deactivated (kept for referential history), the matrix rows are
  repointed. The loader (20260629100000) will no longer emit a body for
  RELEASE_HORSE_EXERCISE once its .md is removed; this migration makes the DB
  state correct regardless.
*/

-- 1) Repoint the matrix. Delete the stale RELEASE_HORSE_EXERCISE requirement
--    rows and ensure RELEASE_HORSE_CARE is required for those service types.
--    Org-aware: operate across all orgs that have the stale rows.
DELETE FROM contract_requirements
  WHERE template_key = 'RELEASE_HORSE_EXERCISE';

INSERT INTO contract_requirements (org_id, service_type, template_key)
SELECT DISTINCT cr.org_id, st.service_type, 'RELEASE_HORSE_CARE'
FROM (VALUES ('HORSE_TRAINING'::text), ('HORSE_EXERCISE'::text)) AS st(service_type)
CROSS JOIN (SELECT DISTINCT org_id FROM contract_requirements) cr
WHERE NOT EXISTS (
  SELECT 1 FROM contract_requirements x
  WHERE x.org_id = cr.org_id
    AND x.service_type = st.service_type
    AND x.template_key = 'RELEASE_HORSE_CARE'
)
-- only add the release requirement for orgs that actually service these types
AND EXISTS (
  SELECT 1 FROM contract_requirements y
  WHERE y.org_id = cr.org_id AND y.service_type = st.service_type
);

-- 2) Retire the RELEASE_HORSE_EXERCISE template (deactivate + soft-delete,
--    preserve the row so executed documents' template_id stays valid).
UPDATE contract_templates
  SET active = false,
      deleted_at = coalesce(deleted_at, now()),
      updated_at = now()
  WHERE template_key = 'RELEASE_HORSE_EXERCISE'
    AND deleted_at IS NULL;

-- Confirm RELEASE_HORSE_CARE is active (it is the surviving canonical release).
UPDATE contract_templates
  SET active = true, deleted_at = NULL, updated_at = now()
  WHERE template_key = 'RELEASE_HORSE_CARE';
