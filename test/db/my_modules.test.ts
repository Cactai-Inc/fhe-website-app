/**
 * my_modules() UI-gating seam (U15, migration 20260630150000_my_modules) — core.branding.
 *
 * Real-path data tests (Wiring & Verification Contract §15.1(1)): AuthContext's nav
 * gating calls the my_modules() RPC. These assertions exercise that ACTUAL function
 * as the CORRECT RLS roles and prove:
 *  - a plain USER member (NOT staff) can resolve their own tenant's module set —
 *    the whole reason the seam is an RPC and not a direct org_modules SELECT;
 *  - FHE (tenant #1) resolves exactly {mod.brokerage, mod.horserecords, mod.lessons}
 *    (so lessons+brokerage nav shows, boarding/barnops/employees hide) — the manual
 *    acceptance criterion, proven programmatically;
 *  - disabled / expired rows are excluded;
 *  - TENANT ISOLATION: org B never sees org A's entitlements through the RPC.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // FHE (tenant #1), tier.lesson_brokerage
let orgB: string; // Rival — seeded a single module below
let aAdmin: string, aUser: string, bUser: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Rival Stables','rival-mm') returning id`))[0].id;

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  aUser = await h.createAuthUser({ role: 'USER', org: orgA });
  bUser = await h.createAuthUser({ role: 'USER', org: orgB });

  // Give org B exactly one enabled module + one disabled + one expired, so we can
  // prove the RPC filters. current_org() reads the GUC for the superuser insert.
  await h.q(`select set_config('app.current_org',$1,false)`, [orgB]);
  await h.q(
    `insert into org_modules (org_id, module_key, enabled, source) values ($1,'mod.lessons',true,'GRANT')`, [orgB]);
  await h.q(
    `insert into org_modules (org_id, module_key, enabled, source) values ($1,'mod.boarding',false,'GRANT')`, [orgB]);
  await h.q(
    `insert into org_modules (org_id, module_key, enabled, source, expires_at)
       values ($1,'mod.brokerage',true,'SUBSCRIPTION', now() - interval '1 day')`, [orgB]);
  await h.q(`select set_config('app.current_org',$1,false)`, [orgA]); // restore GUC
});
afterAll(async () => {
  await h?.close();
});

describe('my_modules() — the Layer-C nav/route gating seam', () => {
  it('a plain USER member (not staff) resolves their own tenant module set', async () => {
    // The critical case: org_modules_staff_read blocks a direct SELECT for USER.
    await h.asUser(aUser);
    const direct = await h.q(`select module_key from org_modules`);
    expect(direct).toHaveLength(0); // RLS hides the substrate from a non-staff member

    // …but the RPC (SECURITY DEFINER) surfaces it.
    const rows = await h.q<{ module_key: string }>(`select module_key from my_modules()`);
    expect(rows.map((r) => r.module_key)).toEqual(['mod.brokerage', 'mod.horserecords', 'mod.lessons']);
  });

  it('FHE resolves lessons+brokerage and HIDES boarding/barnops/employees (manual acceptance)', async () => {
    await h.asUser(aAdmin);
    const keys = (await h.q<{ module_key: string }>(`select module_key from my_modules()`)).map((r) => r.module_key);
    expect(keys).toContain('mod.lessons');
    expect(keys).toContain('mod.brokerage');
    expect(keys).not.toContain('mod.boarding');
    expect(keys).not.toContain('mod.barnops');
    expect(keys).not.toContain('mod.employees');
  });

  it('excludes disabled and expired rows; keeps only the enabled unexpired one', async () => {
    await h.asUser(bUser);
    const keys = (await h.q<{ module_key: string }>(`select module_key from my_modules()`)).map((r) => r.module_key);
    expect(keys).toEqual(['mod.lessons']);          // enabled
    expect(keys).not.toContain('mod.boarding');     // disabled
    expect(keys).not.toContain('mod.brokerage');    // expired
  });

  it('TENANT ISOLATION: org B never sees org A entitlements through the RPC', async () => {
    await h.asUser(bUser);
    const keys = (await h.q<{ module_key: string }>(`select module_key from my_modules()`)).map((r) => r.module_key);
    // org A has brokerage+horserecords; org B must not inherit them.
    expect(keys).not.toContain('mod.brokerage');
    expect(keys).not.toContain('mod.horserecords');
  });

  it('an outsider (no org) gets an empty set, not an error', async () => {
    const outsider = await h.createAuthUser({ role: 'USER', org: null });
    await h.asUser(outsider);
    const rows = await h.q(`select module_key from my_modules()`);
    expect(rows).toHaveLength(0);
  });
});
