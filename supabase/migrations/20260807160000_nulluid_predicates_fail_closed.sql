-- NULLUID 2/4 — the three authorisation predicates must fail CLOSED, not NULL
--
-- THE HOLE — same root cause as set_org_module, a different spelling
--   These predicates are built on app_role(), which is
--       SELECT role FROM profiles WHERE user_id = auth.uid()
--   For a caller with no profiles row — every anon caller, because auth.uid() is NULL —
--   that select returns NO ROW, so app_role() is NULL, so the predicate is NULL:
--
--       has_staff_access()  →  SELECT app_role() IN (…)        →  NULL for anon
--       is_org_admin()      →  SELECT app_role() = 'ADMIN'     →  NULL for anon
--       is_super_admin()    →  SELECT app_role() = 'SUPER_ADMIN' → NULL for anon
--
--   The overwhelmingly common guard in this codebase is
--       IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
--   and `NOT NULL` is NULL, which is not TRUE, so **the IF body never executes and the
--   caller is admitted**. The guard reads like a deny and behaves like an allow.
--
--   Measured in prod as `anon`, before this migration:
--       is_admin()          = f      ← already COALESCEd, safe
--       is_active_member()  = f      ← has an explicit auth.uid() IS NULL branch, safe
--       has_staff_access()  = NULL   ← admits
--       is_org_admin()      = NULL   ← admits
--       is_super_admin()    = NULL   ← admits
--       (NOT is_super_admin()) IS TRUE = f   ← the guard does not fire
--
--   52 anon-executable SECURITY DEFINER functions negate one of these three with no
--   preceding `auth.uid() IS NULL` deny. Confirmed live, unauthenticated, over the real
--   PostgREST endpoint with only the project anon key:
--       POST /rest/v1/rpc/platform_tenant_detail {"p_org_id":"e656f20b-…"}
--         → 200, full tenant dossier: org row, usage counts, and every admin's name,
--           email and user_id.
--   That is a read, so nothing was written to prove it.
--
-- THE FIX
--   Make the predicates return false where they returned NULL. This is the smallest
--   change that closes all 52 at once, and it fixes the defect at its source rather than
--   editing 52 guards individually and hoping none is missed.
--
--   is_admin() already has exactly this shape — COALESCE(app_role() IN (…), false) — so
--   this brings the other three into line with the one that was written correctly.
--
-- WHY THIS IS SAFE — checked, not assumed
--   * Strictly MORE restrictive. NULL→false can only turn an accidental allow into a
--     deny; it can never turn a deny into an allow.
--   * An authenticated caller WITH a profiles row is completely unaffected: app_role()
--     returns their role and the comparison was never NULL.
--   * 70 RLS policies reference these predicates. In RLS a qual must evaluate TRUE to
--     admit, so NULL and false are already identical there — this is a no-op for RLS.
--     Scanned every policy for a NEGATED use (`NOT has_staff_access()` in USING or WITH
--     CHECK), which is the one shape that could become more permissive: there are none.
--   * Scanned every function body for a NULL/TRUE/FALSE/DISTINCT test against these
--     predicates. The only hit is provision_tenant's `IF is_super_admin() IS NOT TRUE`,
--     and `false IS NOT TRUE` = `NULL IS NOT TRUE` = true — identical either way.
--   * Volatility, language, SECURITY DEFINER and search_path are preserved exactly.

CREATE OR REPLACE FUNCTION public.has_staff_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT COALESCE(app_role() IN ('SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE'), false)
$fn$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT COALESCE(app_role() = 'ADMIN', false)
$fn$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT COALESCE(app_role() = 'SUPER_ADMIN', false)
$fn$;

COMMENT ON FUNCTION public.has_staff_access() IS
  'True only for a SUPER_ADMIN/ADMIN/MANAGER/EMPLOYEE profile. Fails closed: NULL app_role() (no profiles row, e.g. anon) returns false so that `IF NOT has_staff_access()` actually fires (NULLUID).';
COMMENT ON FUNCTION public.is_org_admin() IS
  'True only for an ADMIN profile. Fails closed on a NULL app_role() (NULLUID).';
COMMENT ON FUNCTION public.is_super_admin() IS
  'True only for a SUPER_ADMIN profile. Fails closed on a NULL app_role() (NULLUID).';
