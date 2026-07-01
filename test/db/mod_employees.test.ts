/**
 * Employees & Scheduling (U12, migration 20260630110000_mod_employees) — module mod.employees.
 *
 * Real-path data tests (Wiring & Verification Contract §15.1(1)): every assertion
 * exercises the ACTUAL tables/helpers the app uses (staff_profiles, shifts,
 * time_entries, service_assignments, has_module/require_module,
 * caller_staff_profile_ids) as the CORRECT RLS role, and asserts rows land in the
 * right table with the right columns and read back.
 *
 * Tenants:
 *   orgA = FHE (tenant #1, tier.lesson_brokerage) — mod.employees is OFF.
 *   orgB = a provisioned tenant with mod.employees ON (source ADDON).
 *
 * Covers:
 *  - org_boundary + module_gate across all four tables: the module-OFF org (A)
 *    sees NOTHING and cannot INSERT even as ADMIN; the module-ON org (B) can.
 *  - Tenant isolation: org B admin cannot see/write org A rows and vice-versa.
 *  - An employee reads OWN staff_profile / shifts / time_entries only (not a
 *    colleague's), and cannot read them at all when the module is off.
 *  - service_assignment links an engagement to a staff_profile and reads back.
 *  - org_id DEFAULTS to the caller's tenant on insert.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // FHE (tenant #1) — mod.employees OFF
let orgB: string; // provisioned tenant — mod.employees ON
let aAdmin: string; // ADMIN of org A (module off)
let bAdmin: string; // ADMIN of org B (module on)
let bEmp1: string;  // EMPLOYEE of org B with a staff_profile
let bEmp2: string;  // another EMPLOYEE of org B (colleague, for own-only reads)
let spEmp1: string; // bEmp1's staff_profile id
let spEmp2: string; // bEmp2's staff_profile id
let engB: string;   // an engagement in org B (for the service_assignment link)

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

  // Seed two staff_profiles in org B (as super, pinned to B) linking the employees.
  spEmp1 = (await asSuperInOrg<{ id: string }>(orgB,
    `insert into staff_profiles (profile_user_id, title, pay_type, active)
       values ($1,'Barn Hand','HOURLY',true) returning id`, [bEmp1]))[0].id;
  spEmp2 = (await asSuperInOrg<{ id: string }>(orgB,
    `insert into staff_profiles (profile_user_id, title, pay_type, active)
       values ($1,'Trainer','SALARY',true) returning id`, [bEmp2]))[0].id;

  // An engagement in org B to link a service_assignment to. Build the client chain.
  const contactB = (await asSuperInOrg<{ id: string }>(orgB,
    `insert into contacts (full_name, email) values ('Owner B','owner@b.test') returning id`))[0].id;
  const clientB = (await asSuperInOrg<{ id: string }>(orgB,
    `insert into clients (contact_id) values ($1) returning id`, [contactB]))[0].id;
  engB = (await asSuperInOrg<{ id: string }>(orgB,
    `insert into engagements (client_id, service_type, status)
       values ($1,'RIDING_LESSON','LEAD') returning id`, [clientB]))[0].id;
});

afterAll(async () => {
  await h?.close();
});

describe('module_gate — a mod.employees-OFF org (FHE) sees/writes NOTHING', () => {
  const tables = ['staff_profiles', 'shifts', 'time_entries', 'service_assignments'];

  it('org A ADMIN (module off) reads zero rows from every table', async () => {
    await h.asUser(aAdmin);
    for (const t of tables) {
      const rows = await h.q(`select * from ${t}`);
      expect(rows, `${t} must be empty for the module-off org`).toHaveLength(0);
    }
  });

  it('org A ADMIN (module off) cannot INSERT a staff_profile even as admin', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into staff_profiles (profile_user_id, title) values ($1,'X')`, [aAdmin]),
    ).rejects.toThrow();
  });

  it('org A ADMIN (module off) cannot INSERT into shifts / time_entries / service_assignments', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into shifts (staff_profile_id, starts_at) values ($1, now())`, [spEmp1]),
    ).rejects.toThrow();
    await expect(
      h.q(`insert into time_entries (staff_profile_id, clock_in) values ($1, now())`, [spEmp1]),
    ).rejects.toThrow();
    await expect(
      h.q(`insert into service_assignments (staff_profile_id, service_type) values ($1,'RIDING_LESSON')`, [spEmp1]),
    ).rejects.toThrow();
  });

  it('has_module(mod.employees) is false for org A, true for org B', async () => {
    await h.asUser(aAdmin);
    expect((await h.q<{ ok: boolean }>(`select has_module('mod.employees') as ok`))[0].ok).toBe(false);
    await h.asUser(bAdmin);
    expect((await h.q<{ ok: boolean }>(`select has_module('mod.employees') as ok`))[0].ok).toBe(true);
  });
});

describe('module ON — org B ADMIN has full RCUD', () => {
  it('org B ADMIN reads the seeded staff_profiles and org_id defaults to org B on insert', async () => {
    await h.asUser(bAdmin);
    const staff = await h.q<{ id: string; org_id: string }>(`select id, org_id from staff_profiles`);
    expect(staff.map((s) => s.id).sort()).toEqual([spEmp1, spEmp2].sort());
    expect(staff.every((s) => s.org_id === orgB)).toBe(true);

    // Insert a shift WITHOUT org_id → it must default to the caller's tenant (org B).
    const [shift] = await h.q<{ id: string; org_id: string }>(
      `insert into shifts (staff_profile_id, starts_at, ends_at, role)
         values ($1, now(), now() + interval '4 hours', 'MORNING') returning id, org_id`, [spEmp1]);
    expect(shift.org_id).toBe(orgB);

    // Insert a time_entry the same way.
    const [te] = await h.q<{ id: string; org_id: string; minutes: number }>(
      `insert into time_entries (staff_profile_id, clock_in, clock_out, minutes)
         values ($1, now(), now() + interval '2 hours', 120) returning id, org_id, minutes`, [spEmp1]);
    expect(te.org_id).toBe(orgB);
    expect(te.minutes).toBe(120);
  });
});

describe('service_assignment links an engagement to a staff_profile', () => {
  it('an assignment rows in the right table with the right columns and reads back', async () => {
    await h.asUser(bAdmin);
    const [sa] = await h.q<{ id: string; engagement_id: string; staff_profile_id: string; service_type: string; status: string; org_id: string }>(
      `insert into service_assignments (engagement_id, staff_profile_id, service_type, scheduled_at, status)
         values ($1, $2, 'RIDING_LESSON', now() + interval '1 day', 'SCHEDULED')
       returning id, engagement_id, staff_profile_id, service_type, status, org_id`, [engB, spEmp2]);
    expect(sa.engagement_id).toBe(engB);
    expect(sa.staff_profile_id).toBe(spEmp2);
    expect(sa.service_type).toBe('RIDING_LESSON');
    expect(sa.status).toBe('SCHEDULED');
    expect(sa.org_id).toBe(orgB);

    // Reads back joined to the engagement (proves the FK wiring, not just the insert).
    const [joined] = await h.q<{ eng: string; staff_title: string }>(
      `select e.id as eng, sp.title as staff_title
         from service_assignments a
         join engagements e on e.id = a.engagement_id
         join staff_profiles sp on sp.id = a.staff_profile_id
        where a.id = $1`, [sa.id]);
    expect(joined.eng).toBe(engB);
    expect(joined.staff_title).toBe('Trainer');
  });
});

describe('employee reads OWN staff_profile / shifts / time_entries only', () => {
  beforeAll(async () => {
    // Seed a shift + time_entry for BOTH employees so "own only" is a real filter.
    await asSuperInOrg(orgB,
      `insert into shifts (staff_profile_id, starts_at, role) values ($1, now(), 'A'),($2, now(), 'B')`, [spEmp1, spEmp2]);
    await asSuperInOrg(orgB,
      `insert into time_entries (staff_profile_id, clock_in, minutes) values ($1, now(), 30),($2, now(), 45)`, [spEmp1, spEmp2]);
  });

  it('caller_staff_profile_ids() resolves only the caller\'s staff_profile', async () => {
    await h.asUser(bEmp1);
    const ids = (await h.q<{ id: string }>(`select caller_staff_profile_ids() as id`)).map((r) => r.id);
    expect(ids).toEqual([spEmp1]);
  });

  it('bEmp1 reads only their own staff_profile (not the colleague\'s)', async () => {
    await h.asUser(bEmp1);
    const rows = await h.q<{ id: string; profile_user_id: string }>(`select id, profile_user_id from staff_profiles`);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(spEmp1);
    expect(rows[0].profile_user_id).toBe(bEmp1);
  });

  it('bEmp1 reads only their own shifts and time_entries (colleague\'s hidden)', async () => {
    await h.asUser(bEmp1);
    const shifts = await h.q<{ staff_profile_id: string }>(`select staff_profile_id from shifts`);
    expect(shifts.length).toBeGreaterThan(0);
    expect(shifts.every((s) => s.staff_profile_id === spEmp1)).toBe(true);

    const times = await h.q<{ staff_profile_id: string }>(`select staff_profile_id from time_entries`);
    expect(times.length).toBeGreaterThan(0);
    expect(times.every((t) => t.staff_profile_id === spEmp1)).toBe(true);
  });

  it('an employee (non-admin) cannot WRITE staff_profiles / shifts (admin-only RCUD)', async () => {
    await h.asUser(bEmp1);
    await expect(
      h.q(`insert into staff_profiles (profile_user_id, title) values ($1,'Sneak')`, [bEmp1]),
    ).rejects.toThrow();
    await expect(
      h.q(`insert into shifts (staff_profile_id, starts_at) values ($1, now())`, [spEmp1]),
    ).rejects.toThrow();
  });
});

describe('tenant isolation — org B admin cannot cross into org A (and vice-versa)', () => {
  it('org B ADMIN cannot INSERT a staff_profile stamped for org A (WITH CHECK)', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`insert into staff_profiles (org_id, profile_user_id, title) values ($1,$2,'Cross')`, [orgA, bAdmin]),
    ).rejects.toThrow();
  });

  it('org B rows are invisible to org A even if A had the module (boundary ANDs before gate)', async () => {
    // Give org A the module temporarily so ONLY the boundary can be what hides B's rows.
    await asSuperInOrg(orgA,
      `insert into org_modules (org_id, module_key, enabled, source) values ($1,'mod.employees',true,'GRANT')
       on conflict (org_id, module_key) do update set enabled=true`, [orgA]);
    await h.asUser(aAdmin);
    // A now has the module, but must still see ZERO of B's staff_profiles (boundary).
    const rows = await h.q<{ org_id: string }>(`select org_id from staff_profiles`);
    expect(rows.some((r) => r.org_id === orgB)).toBe(false);
    // clean up: turn A back off so the earlier module-off assertions remain coherent if re-run
    await asSuperInOrg(orgA, `update org_modules set enabled=false where org_id=$1 and module_key='mod.employees'`, [orgA]);
  });
});

describe('audit + soft-delete coverage', () => {
  it('inserting a staff_profile writes an audit_logs row', async () => {
    await h.asUser(bAdmin);
    const emp = await h.createAuthUser({ role: 'EMPLOYEE', org: orgB });
    const [sp] = await h.q<{ id: string }>(
      `insert into staff_profiles (profile_user_id, title) values ($1,'Audited') returning id`, [emp]);
    await h.asSuperuser();
    const [log] = await h.q<{ table_name: string; action: string }>(
      `select table_name, action from audit_logs where record_id=$1 and table_name='staff_profiles'`, [sp.id]);
    expect(log.table_name).toBe('staff_profiles');
    expect(log.action).toBe('INSERT');
  });

  it('hard DELETE is revoked on all four tables (soft-delete only)', async () => {
    await h.asUser(bAdmin);
    for (const t of ['staff_profiles', 'shifts', 'time_entries', 'service_assignments']) {
      await expect(h.q(`delete from ${t}`), `DELETE on ${t} must be revoked`).rejects.toThrow();
    }
  });
});
