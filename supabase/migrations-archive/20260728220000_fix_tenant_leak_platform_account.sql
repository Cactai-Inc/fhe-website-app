-- LIVE DEFECT 1 — TENANT LEAK (multi-tenant boundary, not cosmetic).
--
-- MECHANISM (verified before fixing):
--   profiles has NO org boundary at any layer.
--     * RLS: profiles_select_own = (user_id = auth.uid() OR is_admin()).
--       is_admin() is org-blind, so ANY tenant admin reads EVERY profile row
--       in the database, including rows belonging to other orgs.
--     * FE: adminListMembers / listProfileOptions / listStaffProfiles all
--       `select` from profiles with no org filter at all.
--   So the leak is not "NULL org_id treated as universally visible" — it is
--   that org_id is never consulted. admin@cactai.io (org_id NULL,
--   SUPER_ADMIN, the Cactai platform account) is simply one more row an FHE
--   admin can read, and it surfaces in the team listing. The same hole would
--   expose a second tenant's staff the moment one exists.
--
-- FIX (structural, at the boundary — the FE filters are defence in depth):
--   profiles_select_own becomes org-scoped:
--     own row  OR  (admin AND same org AND the row is not platform-tier).
--   Platform-tier = role SUPER_ADMIN or org_id IS NULL. A super admin still
--   sees everything (they operate above tenants); a TENANT admin never sees a
--   platform row or another org's row.
--   profiles_update_own gets the same boundary, so a tenant admin also cannot
--   WRITE a platform/foreign row (the leak's write-side twin).

-- Platform-tier test, reused by both policies.
CREATE OR REPLACE FUNCTION public.is_platform_profile(p_role text, p_org uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE
AS $function$ SELECT p_role = 'SUPER_ADMIN' OR p_org IS NULL $function$;

DROP POLICY profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles FOR SELECT
USING (
  user_id = auth.uid()
  OR app_role() = 'SUPER_ADMIN'                       -- platform sees all
  OR (is_admin()                                       -- tenant admin:
      AND org_id = current_org()                       --   same org only
      AND NOT is_platform_profile(role, org_id))       --   never platform rows
);

DROP POLICY profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles FOR UPDATE
USING (
  user_id = auth.uid()
  OR app_role() = 'SUPER_ADMIN'
  OR (is_admin() AND org_id = current_org() AND NOT is_platform_profile(role, org_id))
)
WITH CHECK (
  user_id = auth.uid()
  OR app_role() = 'SUPER_ADMIN'
  OR (is_admin() AND org_id = current_org() AND NOT is_platform_profile(role, org_id))
);

-- The payer picker (Stage 4d) already scoped by org, but make the platform
-- exclusion explicit there too — it enumerates account holders by name.
CREATE OR REPLACE FUNCTION public.payer_candidates()
RETURNS TABLE(contact_id uuid, name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.contact_id,
         coalesce(nullif(btrim(p.display_name), ''),
                  nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
                  'Member')
    FROM profiles p
    JOIN members m ON m.user_id = p.user_id AND m.status = 'active'
   WHERE p.contact_id IS NOT NULL
     AND p.org_id = current_org()
     AND NOT is_platform_profile(p.role, p.org_id)
     AND auth.uid() IS NOT NULL
   ORDER BY 2;
$function$;
GRANT EXECUTE ON FUNCTION public.payer_candidates() TO authenticated;

-- Assertion: a tenant admin's visible profile set excludes the platform row.
DO $$
DECLARE v_leak int;
BEGIN
  SELECT count(*) INTO v_leak
    FROM profiles
   WHERE is_platform_profile(role, org_id)
     AND org_id IS NOT DISTINCT FROM 'e656f20b-ef43-4725-9029-19e7f0190d9c';
  IF v_leak > 0 THEN
    RAISE EXCEPTION 'a platform-tier profile carries the tenant org — investigate before shipping';
  END IF;
END $$;
