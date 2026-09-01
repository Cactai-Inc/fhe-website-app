/*
  # FHE Suite — Public intake (LANE-PUBLIC): anon form read + anon submission INSERT

  The public marketing site renders the CLIENT intake forms (form_definitions,
  20260629120000) at /inquire and lets an unauthenticated visitor submit one into
  the staff intake queue (intake_submissions, 20260701020000). Two seams were
  missing for that legitimate client action — RLS is the authority, so they are
  added HERE, not worked around in client code:

  1. form_definitions — anon may read ONLY active CLIENT-audience forms (the
     public intake set). COMPANY engagement forms and deactivated forms stay
     staff-only (the existing authenticated read policy is untouched).

  2. intake_submissions — anon INSERT, following the addressed-org recipe of
     20260630030000 (Class B: `bookings`/`inquiries`) ADAPTED to this table's
     stricter tenancy (org_id NOT NULL — a submission may never land orphaned):

       - DEFAULT org resolution becomes
           coalesce(current_org(), current_addressed_org(), sole_org())
         · current_org()            — authenticated staff / the seed-context GUC
                                      (the PGlite harness pins app.current_org).
         · current_addressed_org()  — a real addressed public intake (the server
                                      / SECURITY DEFINER seam stamps
                                      app.addressed_org per host slug).
         · sole_org()               — the SINGLE-TENANT fallback (new helper):
                                      when exactly one organization exists (the
                                      FHE launch shape) an unaddressed anon
                                      submission honestly belongs to it. With
                                      2+ tenants and no addressing it resolves
                                      NULL and the NOT NULL column fails LOUDLY
                                      instead of cross-wiring tenants.

       - the RESTRICTIVE org_boundary is re-created `TO anon, authenticated`
         with exactly the Class A/B addressed arms (same predicate text as
         20260630030000) plus the sole-org arm in WITH CHECK. Authenticated
         behavior is unchanged (their current_org() is NOT NULL, so only the
         first arm ever applies — the intake_submissions tests stay green).

       - a PERMISSIVE INSERT policy for anon ONLY (a plain authenticated member
         still cannot insert — staff-only access within the org is preserved).
         The WITH CHECK is the rate-limit/abuse surface: NEW-only, unreviewed,
         size-capped payload, and the form must be a REAL active CLIENT form
         (the EXISTS subquery runs under anon's own form_definitions policy).

  Anon still has NO SELECT/UPDATE/DELETE path on intake_submissions: the queue
  remains write-only from the public side and staff-read via has_staff_access().
*/

-- ============================================================
-- sole_org() — the single-tenant fallback (SECURITY DEFINER so it can count
-- organizations without opening the organizations table to anon).
-- ============================================================
CREATE OR REPLACE FUNCTION sole_org()
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT CASE WHEN (SELECT count(*) FROM organizations) = 1
              THEN (SELECT id FROM organizations LIMIT 1) END
$$;

COMMENT ON FUNCTION sole_org() IS
  'The lone organization when exactly one exists (single-tenant launch fallback for public intake); NULL once a second tenant is provisioned — unaddressed anon writes then fail loudly.';

-- ============================================================
-- 1. form_definitions — anon reads ONLY active CLIENT intake forms
-- ============================================================
DROP POLICY IF EXISTS form_definitions_public_read ON form_definitions;
CREATE POLICY form_definitions_public_read ON form_definitions
  FOR SELECT TO anon
  USING (active AND audience = 'CLIENT');

-- ============================================================
-- 2. intake_submissions — org default + boundary opened to anon
--    (addressed-org recipe, NOT NULL-safe via sole_org())
-- ============================================================
ALTER TABLE intake_submissions ALTER COLUMN org_id
  SET DEFAULT coalesce(current_org(), current_addressed_org(), sole_org());

DROP POLICY IF EXISTS intake_submissions_org_boundary ON intake_submissions;
CREATE POLICY intake_submissions_org_boundary ON intake_submissions
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (
    org_id = current_org()
    OR (current_org() IS NULL AND (
         current_addressed_org() IS NULL
         OR org_id = current_addressed_org()))
  )
  WITH CHECK (
    org_id = current_org()                             -- staff write their own tenant
    OR org_id = current_addressed_org()                -- addressed public intake
    OR (current_org() IS NULL                          -- unaddressed anon intake:
        AND current_addressed_org() IS NULL            --   single-tenant fallback only
        AND org_id = sole_org())
  );

-- ============================================================
-- 3. intake_submissions — PERMISSIVE anon INSERT (the public submit seam).
--    anon ONLY: a plain authenticated member still cannot write the queue.
-- ============================================================
DROP POLICY IF EXISTS intake_submissions_public_insert ON intake_submissions;
CREATE POLICY intake_submissions_public_insert ON intake_submissions
  FOR INSERT TO anon
  WITH CHECK (
    status = 'NEW'
    AND converted_engagement_id IS NULL
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    -- abuse caps: bounded payload + sane contact fields
    AND length(payload::text) <= 20000
    AND (contact_name  IS NULL OR length(contact_name)  <= 200)
    AND (contact_email IS NULL OR (length(contact_email) <= 320 AND position('@' in contact_email) > 1))
    -- the form must be a REAL, active, CLIENT-audience form (evaluated under
    -- anon's own form_definitions_public_read policy)
    AND EXISTS (
      SELECT 1 FROM form_definitions fd
      WHERE fd.form_key = intake_submissions.form_key
        AND fd.active AND fd.audience = 'CLIENT'
    )
  );
