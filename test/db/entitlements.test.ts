/**
 * Entitlement substrate (U2, migration 20260630010000_entitlements) — core.tenancy.
 *
 * Real-path data tests (Wiring & Verification Contract §15.1(1)): every assertion
 * exercises the ACTUAL functions/tables the app uses (has_module/require_module,
 * org_modules) as the CORRECT RLS role, and asserts rows land in the right table
 * with the right columns and read back.
 *
 * Covers:
 *  - has_module() true only for enabled + unexpired rows in current_org();
 *    an expired row reads false; a disabled row reads false.
 *  - require_module() raises when the module is off; is a no-op when on.
 *  - org_modules org_boundary blocks cross-tenant read/write; org_id defaults to
 *    the caller's tenant.
 *  - SUPER_ADMIN is NOT silently granted every module (has_module keys off
 *    org_modules only, not the role).
 *  - Tier expansion: FHE (tenant #1) is seeded exactly {mod.lessons,
 *    mod.brokerage, mod.horserecords} from tier.lesson_brokerage.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // FHE (tenant #1), tier.lesson_brokerage
let orgB: string; // Rival — no modules
let aAdmin: string, bAdmin: string, superAdmin: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Rival Stables','rival') returning id`))[0].id;
  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
  superAdmin = await h.createAuthUser({ role: 'SUPER_ADMIN', org: orgA });
});
afterAll(async () => {
  await h?.close();
});

describe('catalog seed (global, world-readable)', () => {
  it('module catalog contains core.* and mod.* keys with is_core flags', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ module_key: string; is_core: boolean }>(
      `select module_key, is_core from modules order by module_key`);
    const keys = rows.map((r) => r.module_key);
    expect(keys).toEqual(expect.arrayContaining([
      'core.tenancy', 'core.roles', 'core.registry', 'core.branding', 'core.contracts', 'core.payments',
      'mod.brokerage', 'mod.lessons', 'mod.boarding', 'mod.barnops', 'mod.horserecords', 'mod.employees',
    ]));
    const core = rows.filter((r) => r.is_core).map((r) => r.module_key);
    expect(core).toEqual(expect.arrayContaining(['core.tenancy', 'core.payments']));
    expect(core).not.toContain('mod.brokerage');
  });

  it('the five tiers are seeded', async () => {
    const tiers = (await h.q<{ tier_key: string }>(`select tier_key from tiers`)).map((r) => r.tier_key);
    expect(tiers.sort()).toEqual([
      'tier.boarding', 'tier.brokerage', 'tier.full_barn', 'tier.lesson_barn', 'tier.lesson_brokerage',
    ]);
  });

  it('anon can read the public catalog (world-readable), but cannot write it', async () => {
    await h.asAnon();
    const mods = await h.q<{ module_key: string }>(`select module_key from modules`);
    expect(mods.length).toBeGreaterThanOrEqual(12);
    await expect(
      h.q(`insert into modules (module_key, name) values ('mod.evil','Evil')`),
    ).rejects.toThrow();
  });

  it('a tenant ADMIN (not SUPER_ADMIN) cannot write the global catalog', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into modules (module_key, name) values ('mod.sneak','Sneak')`),
    ).rejects.toThrow();
    // SUPER_ADMIN can.
    await h.asUser(superAdmin);
    await h.q(`insert into modules (module_key, name, is_core, active) values ('mod.test','Test',false,true)`);
    await h.asSuperuser();
    const [row] = await h.q<{ module_key: string }>(`select module_key from modules where module_key='mod.test'`);
    expect(row.module_key).toBe('mod.test');
  });
});

describe('tier expansion → FHE org_modules', () => {
  it('FHE (tenant #1) is seeded exactly {mod.lessons, mod.brokerage, mod.horserecords}', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ module_key: string; source: string; enabled: boolean }>(
      `select module_key, source, enabled from org_modules where org_id=$1 order by module_key`, [orgA]);
    expect(rows.map((r) => r.module_key)).toEqual(['mod.brokerage', 'mod.horserecords', 'mod.lessons']);
    for (const r of rows) {
      expect(r.source).toBe('TIER');
      expect(r.enabled).toBe(true);
    }
    // The disabled modules are NOT seeded for FHE.
    expect(rows.map((r) => r.module_key)).not.toContain('mod.boarding');
    expect(rows.map((r) => r.module_key)).not.toContain('mod.barnops');
    expect(rows.map((r) => r.module_key)).not.toContain('mod.employees');
  });
});

describe('has_module() — the RLS predicate', () => {
  it('is true for an enabled, unexpired module in the current org', async () => {
    await h.asUser(aAdmin);
    const [r] = await h.q<{ ok: boolean }>(`select has_module('mod.brokerage') as ok`);
    expect(r.ok).toBe(true);
  });

  it('is false for a module the current org does not have', async () => {
    await h.asUser(aAdmin);
    const [r] = await h.q<{ ok: boolean }>(`select has_module('mod.boarding') as ok`);
    expect(r.ok).toBe(false);
  });

  it('is false for a disabled row', async () => {
    // Seed a disabled row for org B, then check as a B user.
    await h.asSuperuser();
    await h.q(`select set_config('app.current_org',$1,false)`, [orgB]);
    await h.q(`insert into org_modules (org_id, module_key, enabled, source) values ($1,'mod.lessons',false,'GRANT')`, [orgB]);
    await h.q(`select set_config('app.current_org',$1,false)`, [orgA]); // restore GUC
    await h.asUser(bAdmin);
    const [r] = await h.q<{ ok: boolean }>(`select has_module('mod.lessons') as ok`);
    expect(r.ok).toBe(false);
  });

  it('is false for an EXPIRED row (expires_at in the past)', async () => {
    await h.asSuperuser();
    await h.q(`select set_config('app.current_org',$1,false)`, [orgB]);
    await h.q(
      `insert into org_modules (org_id, module_key, enabled, source, expires_at)
         values ($1,'mod.brokerage',true,'SUBSCRIPTION', now() - interval '1 day')`, [orgB]);
    await h.q(`select set_config('app.current_org',$1,false)`, [orgA]);
    await h.asUser(bAdmin);
    const [r] = await h.q<{ ok: boolean }>(`select has_module('mod.brokerage') as ok`);
    expect(r.ok).toBe(false);
  });

  it('is scoped to current_org() — org B does not see org A entitlements', async () => {
    await h.asUser(bAdmin);
    // org B has no enabled brokerage of its own (its brokerage row is expired above)
    const [r] = await h.q<{ ok: boolean }>(`select has_module('mod.horserecords') as ok`);
    expect(r.ok).toBe(false); // A has it, B must not inherit it
  });
});

describe('require_module() — the RPC guard', () => {
  it('raises with insufficient_privilege when the module is OFF', async () => {
    await h.asUser(aAdmin);
    await expect(h.q(`select require_module('mod.boarding')`)).rejects.toThrow(/not enabled/i);
  });

  it('is a no-op (returns void, no raise) when the module is ON', async () => {
    await h.asUser(aAdmin);
    const rows = await h.q(`select require_module('mod.brokerage')`);
    expect(rows).toHaveLength(1); // succeeded — no exception
  });
});

describe('org_modules tenancy boundary (seam 1)', () => {
  it('org_id defaults to the caller\'s tenant on insert', async () => {
    await h.asUser(bAdmin);
    await h.q(`insert into org_modules (module_key, enabled, source) values ('mod.boarding',true,'ADDON')`);
    await h.asSuperuser();
    const [row] = await h.q<{ org_id: string }>(
      `select org_id from org_modules where module_key='mod.boarding' and source='ADDON'`);
    expect(row.org_id).toBe(orgB);
  });

  it('a tenant cannot READ another tenant\'s org_modules rows', async () => {
    await h.asUser(bAdmin);
    const rows = await h.q<{ org_id: string }>(`select org_id from org_modules`);
    expect(rows.every((r) => r.org_id === orgB)).toBe(true);
    expect(rows.some((r) => r.org_id === orgA)).toBe(false);
  });

  it('a tenant cannot WRITE a row into another tenant (WITH CHECK)', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`insert into org_modules (org_id, module_key, enabled, source) values ($1,'mod.employees',true,'GRANT')`, [orgA]),
    ).rejects.toThrow();
  });
});

describe('SUPER_ADMIN is NOT silently granted every module', () => {
  it('has_module() keys off org_modules for the super admin\'s own org, not the role', async () => {
    // superAdmin belongs to org A (FHE). A has brokerage but NOT boarding.
    await h.asUser(superAdmin);
    const [onMod] = await h.q<{ ok: boolean }>(`select has_module('mod.brokerage') as ok`);
    const [offMod] = await h.q<{ ok: boolean }>(`select has_module('mod.boarding') as ok`);
    expect(onMod.ok).toBe(true);   // because A's org_modules has it, not because super admin
    expect(offMod.ok).toBe(false); // super admin does NOT get boarding for free
    // and require_module still raises for the off module even for a super admin
    await expect(h.q(`select require_module('mod.boarding')`)).rejects.toThrow(/not enabled/i);
  });
});

describe('substrate invariant — org_modules carries NO module_gate (recursion guard §4.1)', () => {
  it('org_modules has an _org_boundary policy but no _module_gate policy', async () => {
    await h.asSuperuser();
    const policies = (await h.q<{ policyname: string }>(
      `select policyname from pg_policies where schemaname='public' and tablename='org_modules'`))
      .map((r) => r.policyname);
    expect(policies).toContain('org_modules_org_boundary');
    expect(policies.some((p) => p.includes('module_gate'))).toBe(false);
  });
});
