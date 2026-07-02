/*
  # FHE Suite — my_modules() UI-gating seam (U15, migration 42) — module core.branding

  ADDITIVE. Nothing existing is rewritten.

  PLATFORM_ARCHITECTURE.md §4.3 Layer C: "Nav/route gating reads `org_modules` via a
  `my_modules()` RPC/view surfaced through `AuthContext`. Convenience only; A + B are
  the real fence." This migration lands that seam so the U15 AuthContext bridge does
  not silently no-op.

  Why an RPC (not a direct client SELECT on org_modules): org_modules' access policy
  (org_modules_staff_read, §U2) restricts SELECT to has_staff_access() — a plain USER
  member (a tenant's rider/customer) could NOT read their own tenant's entitlements,
  so nav gating would hide every module for exactly the members who use the app most.
  my_modules() is STABLE SECURITY DEFINER search_path-pinned — shaped exactly like
  current_org()/has_module() — so it reads the org_modules substrate PAST its RLS and
  returns the CURRENT caller's own tenant's enabled+unexpired module keys. It is
  strictly current_org()-scoped: it can never surface another tenant's entitlements
  (no p_org argument), so it is safe to expose to authenticated.

  SUPER_ADMIN is deliberately NOT special-cased (same decision has_module() made):
  the platform owner sees exactly their own org's modules, never a blanket grant.
*/

CREATE OR REPLACE FUNCTION my_modules()
RETURNS TABLE (module_key text)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT om.module_key
    FROM org_modules om
    JOIN modules m ON m.module_key = om.module_key
    WHERE om.org_id = current_org()
      AND om.enabled
      AND (om.expires_at IS NULL OR om.expires_at > now())
      AND COALESCE(m.active, true)
    ORDER BY om.module_key
$$;

COMMENT ON FUNCTION my_modules() IS
  'U15 Layer-C UI-gating seam: the CURRENT caller''s own tenant''s enabled+unexpired module keys, read past org_modules RLS so a plain USER member can resolve nav gating. current_org()-scoped; never crosses tenants.';

-- Any authenticated member may resolve their own module set for nav/route gating.
GRANT EXECUTE ON FUNCTION my_modules() TO authenticated, service_role;
