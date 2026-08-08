-- NULLUID 4/4 — remove anon EXECUTE from the platform / tenant-admin surface
--
-- Defence in depth. Migrations 1–3 fix the guards, which is the real fix; this removes
-- the grant that let an unauthenticated caller reach those guards at all. Kept as its
-- own migration so it can be reverted alone if a revoke turns out to be too broad.
--
-- WHY `REVOKE … FROM public` ALONE IS NOT ENOUGH — the third silent-revoke trap
--   Every function below carries BOTH kinds of grant at once:
--       =X/postgres              ← a grant to PUBLIC
--       anon=X/postgres          ← a grant held by the ROLE anon
--   Revoking only FROM public leaves the role-held anon grant. Revoking only FROM anon
--   leaves the PUBLIC grant, through which anon still inherits EXECUTE. Both must go.
--   (Supabase's pg_default_acl grants EXECUTE on every new public function to anon, which
--   is where the role-held grant comes from.)
--   Precedent in this repo: TASK-SECFIX S2 (column revoke against a TABLE-level grant)
--   and S3 (anon revoke against a PUBLIC grant). Same family, third occurrence.
--   has_function_privilege() output before and after is recorded in
--   docs/reports/TASK-NULLUID-REPORT.md — the REVOKE's own output proves nothing.
--
-- WHAT IS REVOKED, AND WHAT IS DELIBERATELY LEFT ALONE
--   Revoked from PUBLIC + anon only. `authenticated` and `service_role` KEEP execute:
--     * set_org_module            — src/pages/app/ops/admin/AdminModulesPage.tsx calls it
--                                   as an authenticated SUPER_ADMIN, and the billing seam
--                                   calls it as service_role. Revoking `authenticated`
--                                   here would break the admin modules page.
--     * provision_tenant          — src/pages/app/ops/superadmin/ProvisionTenantPage.tsx
--                                   and api/admin-provision-tenant.ts.
--     * platform_*                — src/pages/app/ops/superadmin/TenantDetailPage.tsx.
--     * admin_*                   — the tenant-admin UI.
--   Each of these is guarded by SUPER_ADMIN / staff checks that migrations 1–3 have just
--   made actually fire, so `authenticated` is fenced by the guard rather than the grant.
--
-- NOT REVOKED — intentionally public
--   redeem_gift is reached anonymously by design from the unauthenticated /redeem route
--   (TASK-SECFIX2). It is untouched here. Nothing in this migration alters it.
--
-- The other 44 functions in the NULL-uid family identified by this audit are NOT revoked.
-- Several are plausibly reachable from unauthenticated document-signing / kiosk flows,
-- and the task's instruction is to report rather than revoke where unsure. Migrations 2
-- and 3 close their authorisation hole regardless of who may call them. The full list and
-- the reasoning are in docs/reports/TASK-NULLUID-REPORT.md.

REVOKE EXECUTE ON FUNCTION public.set_org_module(uuid, text, boolean, text)          FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.provision_tenant(text, text, text, text, uuid, jsonb, jsonb, jsonb, text[]) FROM public, anon;

REVOKE EXECUTE ON FUNCTION public.platform_set_tenant_module(uuid, text, boolean)    FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.platform_set_tenant_status(uuid, text)             FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.platform_tenant_detail(uuid)                       FROM public, anon;

REVOKE EXECUTE ON FUNCTION public.admin_account_action(uuid, text)                   FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_invitation(uuid)                      FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_expire_invitation(uuid)                      FROM public, anon;

-- Re-assert the grants that must survive, so the intent is explicit in the journal
-- rather than implied by what the REVOKE happened to leave behind.
GRANT EXECUTE ON FUNCTION public.set_org_module(uuid, text, boolean, text)           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provision_tenant(text, text, text, text, uuid, jsonb, jsonb, jsonb, text[])  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_set_tenant_module(uuid, text, boolean)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_set_tenant_status(uuid, text)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_tenant_detail(uuid)                        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_account_action(uuid, text)                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_invitation(uuid)                       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_expire_invitation(uuid)                       TO authenticated, service_role;
