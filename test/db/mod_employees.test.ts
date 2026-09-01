/**
 * Employees & Scheduling — module mod.employees, on the Stage 1j merged model.
 *
 * Real-path data tests (Wiring & Verification Contract §15.1(1)): every
 * assertion exercises the ACTUAL tables/helpers the app uses (profiles
 * employment columns title/pay_type/staff_active; shifts/time_entries keyed by
 * staff_user_id) as the CORRECT RLS role, and asserts rows land with the right
 * columns and read back.
 *
 * Tenants:
 *   orgA = FHE (tenant #1, tier.lesson_brokerage) — mod.employees is OFF.
 *   orgB = a provisioned tenant with mod.employees ON (source ADDON).
 *
 * Contract under test (Stage 1j):
 *  - shifts/time_entries keep org_boundary + module_gate: the module-OFF org
 *    (A) sees NOTHING and cannot INSERT even as ADMIN; the module-ON org (B)
 *    can. Staff identity lives on profiles (core — not module-gated).
 *  - Employment fields on profiles are ADMIN-ONLY writes (role-guard parity
 *    with the old staff table's admin-write RLS).
 *  - An employee reads OWN shifts / time_entries only (not a colleague's).
 *  - Tenant isolation: org B admin cannot write org-A-stamped rows; org B rows
 *    stay invisible to org A even with the module granted.
 *  - org_id DEFAULTS to the caller's tenant on shift/time-entry insert.
 *
 * (The old standalone staff table and the service_assignments/engagements
 * sections were retired: those tables no longer exist — engagements teardown
 * + Stage 1j.)
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // FHE (tenant #1) — mod.employees OFF
let orgB: string; // provisioned tenant — mod.employees ON
let aAdmin: string; // ADMIN of org A (module off)
let bAdmin: string; // ADMIN of org B (module on)
let bEmp1: string;  // EMPLOYEE of org B, marked staff on their profile
let bEmp2: string;  // another EMPLOYEE of org B (colleague, for own-only reads)

/** Run SQL as superuser (RLS bypassed) with app.current_org pinned to `org`. */
async function asSuperInOrg<T = Record<string, unknown>>(org: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org',$1,false)`, [org]);
  return h.q<T>(sql, params);
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Staffed Stables','staffed') returning id`))[0].id;

  // Grant mod.employees to org B (source ADDON); org A (FHE) is left OFF.
  await asSuperInOrg(orgB,
    `insert into org_modules (org_id, module_key, enabled, source) values ($1,'mod.employees',true,'ADDON')`, [orgB]);

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
  bEmp1 = await h.createAuthUser({ role: 'EMPLOYEE', org: orgB });
  bEmp2 = await h.createAuthUser({ role: 'EMPLOYEE', org: orgB });

  // Mark both employees as staff ON THEIR PROFILES (Stage 1j model), as super.
  await asSuperInOrg(orgB,
    `update profiles set title='Barn Hand', pay_type='HOURLY', staff_active=true where user_id=$1`, [bEmp1]);
  await asSuperInOrg(orgB,
    `update profiles set title='Trainer', pay_type='SALARY', staff_active=true where user_id=$1`, [bEmp2]);
});

afterAll(async () => {
  await h?.close();
});

describe('module_gate — a mod.employees-OFF org (FHE) sees/writes NOTHING in scheduling', () => {
  const tables = ['shifts', 'time_entries'];

  it('org A ADMIN (module off) reads zero rows from the scheduling tables', async () => {
    await h.asUser(aAdmin);
    for (const t of tables) {
      const rows = await h.q(`select * from ${t}`);
      expect(rows, `${t} must be empty for the module-off org`).toHaveLength(0);
    }
  });

  it('org A ADMIN (module off) cannot INSERT into shifts / time_entries', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into shifts (staff_user_id, starts_at) values ($1, now())`, [aAdmin]),
    ).rejects.toThrow();
    await expect(
      h.q(`insert into time_entries (staff_user_id, clock_in) values ($1, now())`, [aAdmin]),
    ).rejects.toThrow();
  });

  it('has_module(mod.employees) is false for org A, true for org B', async () => {
    await h.asUser(aAdmin);
    expect((await h.q<{ ok: boolean }>(`select has_module('mod.employees') as ok`))[0].ok).toBe(false);
    await h.asUser(bAdmin);
    expect((await h.q<{ ok: boolean }>(`select has_module('mod.employees') as ok`))[0].ok).toBe(true);
  });
});

describe('module ON — org B ADMIN has full RCUD on scheduling', () => {
  it('org B ADMIN reads staff via profiles and org_id defaults on scheduling inserts', async () => {
    await h.asUser(bAdmin);
    const staff = await h.q<{ user_id: string; title: string }>(
      `select user_id, title from profiles where staff_active`);
    expect(staff.map((s) => s.user_id).sort()).toEqual([bEmp1, bEmp2].sort());

    // Insert a shift WITHOUT org_id → it must default to the caller's tenant (org B).
    const [shift] = await h.q<{ id: string; org_id: string }>(
      `insert into shifts (staff_user_id, starts_at, ends_at, role)
         values ($1, now(), now() + interval '4 hours', 'MORNING') returning id, org_id`, [bEmp1]);
    expect(shift.org_id).toBe(orgB);

    // Insert a time_entry the same way.
    const [te] = await h.q<{ id: string; org_id: string; minutes: number }>(
      `insert into time_entries (staff_user_id, clock_in, clock_out, minutes)
         values ($1, now(), now() + interval '2 hours', 120) returning id, org_id, minutes`, [bEmp1]);
    expect(te.org_id).toBe(orgB);
    expect(te.minutes).toBe(120);
  });
});

describe('employment fields on profiles are ADMIN-ONLY writes (Stage 1j guard)', () => {
  it('an employee cannot self-set staff_active / title / pay_type', async () => {
    const bStranger = await h.createAuthUser({ role: 'USER', org: orgB });
    await h.asUser(bStranger);
    await expect(
      h.q(`update profiles set staff_active=true, title='Sneak' where user_id=$1`, [bStranger]),
    ).rejects.toThrow();
  });

  it('an admin CAN set employment fields on a profile in their org', async () => {
    const bNew = await h.createAuthUser({ role: 'EMPLOYEE', org: orgB });
    await h.asUser(bAdmin);
    await h.q(`update profiles set title='Groom', staff_active=true where user_id=$1`, [bNew]);
    await h.asSuperuser();
    const [row] = await h.q<{ title: string; staff_active: boolean }>(
      `select title, staff_active from profiles where user_id=$1`, [bNew]);
    expect(row.title).toBe('Groom');
    expect(row.staff_active).toBe(true);
  });
});

describe('employee reads OWN shifts / time_entries only', () => {
  beforeAll(async () => {
    // Seed a shift + time_entry for BOTH employees so "own only" is a real filter.
    await asSuperInOrg(orgB,
      `insert into shifts (org_id, staff_user_id, starts_at, role) values ($1,$2, now(), 'A'),($1,$3, now(), 'B')`,
      [orgB, bEmp1, bEmp2]);
    await asSuperInOrg(orgB,
      `insert into time_entries (org_id, staff_user_id, clock_in, minutes) values ($1,$2, now(), 30),($1,$3, now(), 45)`,
      [orgB, bEmp1, bEmp2]);
  });

  it('bEmp1 reads only their own shifts and time_entries (colleague\'s hidden)', async () => {
    await h.asUser(bEmp1);
    const shifts = await h.q<{ staff_user_id: string }>(`select staff_user_id from shifts`);
    expect(shifts.length).toBeGreaterThan(0);
    expect(shifts.every((s) => s.staff_user_id === bEmp1)).toBe(true);

    const times = await h.q<{ staff_user_id: string }>(`select staff_user_id from time_entries`);
    expect(times.length).toBeGreaterThan(0);
    expect(times.every((t) => t.staff_user_id === bEmp1)).toBe(true);
  });

  it('an employee (non-admin) cannot WRITE shifts (admin-only RCUD)', async () => {
    await h.asUser(bEmp1);
    await expect(
      h.q(`insert into shifts (staff_user_id, starts_at) values ($1, now())`, [bEmp1]),
    ).rejects.toThrow();
  });
});

describe('tenant isolation — org B admin cannot cross into org A (and vice-versa)', () => {
  it('org B ADMIN cannot INSERT a shift stamped for org A (WITH CHECK)', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`insert into shifts (org_id, staff_user_id, starts_at) values ($1,$2, now())`, [orgA, bEmp1]),
    ).rejects.toThrow();
  });

  it('org B rows are invisible to org A even if A had the module (boundary ANDs before gate)', async () => {
    // Give org A the module temporarily so ONLY the boundary can be what hides B's rows.
    await asSuperInOrg(orgA,
      `insert into org_modules (org_id, module_key, enabled, source) values ($1,'mod.employees',true,'GRANT')
       on conflict (org_id, module_key) do update set enabled=true`, [orgA]);
    await h.asUser(aAdmin);
    const rows = await h.q<{ org_id: string }>(`select org_id from shifts`);
    expect(rows.some((r) => r.org_id === orgB)).toBe(false);
    // clean up: turn A back off so the earlier module-off assertions remain coherent if re-run
    await asSuperInOrg(orgA, `update org_modules set enabled=false where org_id=$1 and module_key='mod.employees'`, [orgA]);
  });
});

describe('soft-delete coverage', () => {
  it('hard DELETE is revoked on the scheduling tables (soft-delete only)', async () => {
    await h.asUser(bAdmin);
    for (const t of ['shifts', 'time_entries']) {
      await expect(h.q(`delete from ${t}`), `DELETE on ${t} must be revoked`).rejects.toThrow();
    }
  });
});
