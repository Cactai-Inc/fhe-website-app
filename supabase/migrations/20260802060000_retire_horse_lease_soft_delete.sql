-- Retire HORSE_LEASE fully: soft-delete the template row.
--
-- HORSE_LEASE was deactivated by U7 Stage B (20260802040000) and its .md was
-- retired from the bodies loader (RETIRED set, commit bc60cd2) — the lease is
-- built from DB clause defs as HORSE_LEASE_V2. Zero live documents reference
-- HORSE_LEASE. Setting deleted_at makes the token-registry guard and body
-- checks skip it, so the loader no longer re-asserting its template_tokens
-- rows is inert. Owner ruling 2026-08-02 (contract update sprint).
UPDATE contract_templates
   SET deleted_at = now()
 WHERE template_key = 'HORSE_LEASE'
   AND deleted_at IS NULL;
