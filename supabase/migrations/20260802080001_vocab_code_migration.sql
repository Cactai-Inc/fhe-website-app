-- Vocabulary sweep (2026-08-02 closure): migrate mis-stored horses values to
-- their proper lookup codes. Stored labels/sentinels found by live audit:
--   passport_country 'France'                    -> 'FR'   (label for code FR)
--   passport_country 'N/A' (2 rows)              -> 'NONE' ("No passport")
--   registration_org 'Selle Francais Stud Book'  -> 'SELLE_FRANCAIS' (label)
--   registration_org 'N/A'                       -> 'NONE' ("Not registered")
-- breed/color audited clean (all codes). markings free text is by design
-- (SelectOrOther Other-path + render fallback).
UPDATE horses SET passport_country = 'FR'
 WHERE passport_country = 'France' AND deleted_at IS NULL;
UPDATE horses SET passport_country = 'NONE'
 WHERE passport_country = 'N/A' AND deleted_at IS NULL;
UPDATE horses SET registration_org = 'SELLE_FRANCAIS'
 WHERE registration_org = 'Selle Francais Stud Book' AND deleted_at IS NULL;
UPDATE horses SET registration_org = 'NONE'
 WHERE registration_org = 'N/A' AND deleted_at IS NULL;
