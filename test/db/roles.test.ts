/**
 * Role model (migration 25). `role` is the source of truth; the role helpers are
 * the vocabulary org-scoped RLS will use, and is_admin() now derives from role.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
});
afterAll(async () => {
  await h?.close();
});

async function rolesFor(uid: string) {
  await h.asUser(uid);
  const [r] = await h.q<{ app_role: string; org_admin: boolean; staff: boolean; super: boolean; admin: boolean }>(
    `select app_role() as app_role, is_org_admin() as org_admin, has_staff_access() as staff,
            is_super_admin() as super, is_admin() as admin`);
  return r;
}

describe('role helpers', () => {
  it('ADMIN: org admin + staff + legacy is_admin, not super', async () => {
    const r = await rolesFor(await h.createAuthUser({ role: 'ADMIN' }));
    expect(r).toMatchObject({ app_role: 'ADMIN', org_admin: true, staff: true, super: false, admin: true });
  });

  it('MANAGER and EMPLOYEE: staff, but not org admin', async () => {
    const mgr = await rolesFor(await h.createAuthUser({ role: 'MANAGER' }));
    expect(mgr).toMatchObject({ app_role: 'MANAGER', org_admin: false, staff: true, admin: false });
    const emp = await rolesFor(await h.createAuthUser({ role: 'EMPLOYEE' }));
    expect(emp).toMatchObject({ app_role: 'EMPLOYEE', org_admin: false, staff: true, admin: false });
  });

  it('USER: no staff/admin access', async () => {
    const r = await rolesFor(await h.createAuthUser({ role: 'USER' }));
    expect(r).toMatchObject({ app_role: 'USER', org_admin: false, staff: false, super: false, admin: false });
  });

  it('SUPER_ADMIN: platform-level, and legacy is_admin true, but not a tenant org-admin', async () => {
    const r = await rolesFor(await h.createAuthUser({ role: 'SUPER_ADMIN' }));
    expect(r).toMatchObject({ app_role: 'SUPER_ADMIN', super: true, admin: true, org_admin: false });
  });

  it('role check constraint rejects an unknown role', async () => {
    await h.asSuperuser();
    const uid = await h.createAuthUser({ profile: false });
    await expect(h.q(`insert into profiles (user_id, email, role) values ($1,'x@x.t','WIZARD')`, [uid]))
      .rejects.toThrow();
  });
});
