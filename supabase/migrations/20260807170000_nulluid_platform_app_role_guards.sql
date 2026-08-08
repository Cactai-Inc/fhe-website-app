-- NULLUID 3/4 — the three platform_* guards compare a NULL app_role() with <>
--
-- THE HOLE — the same root cause again, in the spelling that migration 2/4 does NOT fix
--   These three guard with
--       IF app_role() <> 'SUPER_ADMIN' THEN RAISE EXCEPTION 'platform operator only'; END IF;
--   app_role() is `SELECT role FROM profiles WHERE user_id = auth.uid()`, which returns
--   NULL for any caller with no profiles row — every anon caller. `NULL <> 'SUPER_ADMIN'`
--   is NULL, not true, so the IF never fires and the caller is admitted.
--
--   Migration 2/4 cannot reach this: it makes the boolean PREDICATES fail closed, but
--   app_role() is a text accessor whose NULL is a legitimate value ("no profile"). The
--   comparison is what has to be made total, at each of the three call sites.
--
--   Confirmed live in production, unauthenticated, over the real PostgREST endpoint with
--   only the project anon key, BEFORE this migration:
--       POST /rest/v1/rpc/platform_tenant_detail {"p_org_id":"e656f20b-…"}
--         → HTTP 200
--         → {"org":{…"name":"French Heritage Equestrian","slug":"fhe","status":"ACTIVE"…},
--            "usage":{"horses":3,"members":9,"contacts":26,"documents":66,…},
--            "admins":[{"name":"…","role":"ADMIN","email":"…","user_id":"…"}, …],
--            "modules":[…]}
--   An unauthenticated reader obtained the tenant record, per-table row counts, and every
--   staff account's name, email address and user_id. That is the read; the other two are
--   WRITES with the identical guard:
--     * platform_set_tenant_module — upserts org_modules for any org (entitlements).
--     * platform_set_tenant_status — sets organizations.status, i.e. can SUSPEND or
--       ARCHIVE a tenant.
--   Neither write was exercised. The read was sufficient proof and flips nothing.
--
-- THE FIX
--   Make the comparison total: coalesce(app_role(), '') <> 'SUPER_ADMIN'. '' is never a
--   role, so a caller with no profile is now denied instead of admitted. This is the
--   minimal edit — one expression per function, bodies otherwise byte-identical to what
--   is live today, so the change is easy to read and to revert on its own.
--
--   Strictly more restrictive: the only callers whose outcome changes are those for whom
--   app_role() is NULL, i.e. those who have no profile and were never meant to be here.
--   A real SUPER_ADMIN is unaffected. The legitimate caller is the platform operator UI
--   (src/pages/app/ops/superadmin/TenantDetailPage.tsx), an authenticated SUPER_ADMIN.

CREATE OR REPLACE FUNCTION public.platform_set_tenant_module(p_org_id uuid, p_module_key text, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF coalesce(app_role(), '') <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'platform operator only';
  END IF;
  INSERT INTO org_modules (org_id, module_key, enabled, source)
  VALUES (p_org_id, p_module_key, p_enabled, 'GRANT')
  ON CONFLICT (org_id, module_key) DO UPDATE
    SET enabled = p_enabled, updated_at = now();
END;
$fn$;

CREATE OR REPLACE FUNCTION public.platform_set_tenant_status(p_org_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF coalesce(app_role(), '') <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'platform operator only';
  END IF;
  IF p_status NOT IN ('ACTIVE','SUSPENDED','ARCHIVED') THEN
    RAISE EXCEPTION 'status must be ACTIVE, SUSPENDED, or ARCHIVED';
  END IF;
  UPDATE organizations SET status = p_status, updated_at = now()
   WHERE id = p_org_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown organization';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.platform_tenant_detail(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v jsonb;
BEGIN
  IF coalesce(app_role(), '') <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'platform operator only';
  END IF;

  SELECT jsonb_build_object(
    'org', (SELECT jsonb_build_object(
        'id', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status,
        'display_code', o.display_code, 'created_at', o.created_at)
      FROM organizations o WHERE o.id = p_org_id),
    'modules', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'module_key', m.module_key, 'name', m.name, 'description', m.description,
        'is_core', m.is_core,
        'enabled', coalesce(om.enabled, m.is_core),
        'source', om.source) ORDER BY m.is_core DESC, m.module_key), '[]'::jsonb)
      FROM modules m
      LEFT JOIN org_modules om ON om.module_key = m.module_key AND om.org_id = p_org_id
      WHERE m.active),
    'admins', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'user_id', p.user_id, 'email', p.email,
        'name', trim(concat_ws(' ', p.first_name, p.last_name)),
        'role', p.role) ORDER BY p.role, p.email), '[]'::jsonb)
      FROM profiles p
      WHERE p.org_id = p_org_id AND p.role IN ('ADMIN','MANAGER','EMPLOYEE')),
    'usage', jsonb_build_object(
      'members',     (SELECT count(*) FROM profiles WHERE org_id = p_org_id),
      'contacts',    (SELECT count(*) FROM contacts WHERE org_id = p_org_id),
      'engagements', (SELECT count(*) FROM contracts WHERE org_id = p_org_id AND deleted_at IS NULL),
      'horses',      (SELECT count(*) FROM horses WHERE org_id = p_org_id AND deleted_at IS NULL),
      'documents',   (SELECT count(*) FROM documents WHERE org_id = p_org_id AND deleted_at IS NULL))
  ) INTO v;
  RETURN v;
END;
$fn$;
