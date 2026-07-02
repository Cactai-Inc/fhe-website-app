/**
 * Public intake (LANE-PUBLIC, migration 20260702010000_public_intake) — the anon
 * submit seam the /inquire page uses.
 *
 * Real-path data tests (same discipline as intake_submissions.test.ts): every
 * assertion exercises the ACTUAL tables/policies the public page hits
 * (form_definitions anon read, intake_submissions anon INSERT) as the CORRECT
 * RLS role.
 *
 * Proves:
 *  - anon reads ONLY active CLIENT-audience form_definitions (COMPANY hidden).
 *  - anon INSERT lands org-stamped (harness seed GUC → tenant #1) with status NEW
 *    and is read back by tenant #1 staff — the real staff-queue seam.
 *  - the addressed-org arm: with app.addressed_org = org B (and no seed GUC) an
 *    anon submission lands in org B; org A staff cannot see it (isolation) and
 *    org B staff can.
 *  - the abuse fence: non-NEW status, unknown/COMPANY form_key, oversized
 *    payload are all rejected; anon cannot SELECT or UPDATE the queue.
 *  - staff-only access within the org is unchanged: a plain USER still cannot
 *    insert (the public policy is anon-only).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // tenant #1 (FHE)
let orgB: string; // isolation peer
let aAdmin: string, bAdmin: string, aUser: string;

/** Run fn as anon with NO seed GUC and app.addressed_org = org (the real public shape). */
async function asAddressedAnon(org: string | null, fn: () => Promise<void>) {
  await h.asSuperuser();
  const [{ cur }] = await h.q<{ cur: string | null }>(
    `select current_setting('app.current_org', true) as cur`);
  await h.q(`select set_config('app.current_org', '', false)`);
  await h.q(`select set_config('app.addressed_org', $1, false)`, [org ?? '']);
  try {
    await h.asAnon();
    await fn();
  } finally {
    await h.asSuperuser();
    await h.q(`select set_config('app.current_org', $1, false)`, [cur ?? '']);
    await h.q(`select set_config('app.addressed_org', '', false)`);
  }
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Public Rival','public-rival') returning id`))[0].id;
  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
  aUser = await h.createAuthUser({ role: 'USER', org: orgA });
});

afterAll(async () => {
  await h?.close();
});

describe('form_definitions — anon reads only active CLIENT forms', () => {
  it('anon sees the CLIENT intake set and none of the COMPANY forms', async () => {
    await h.asAnon();
    const rows = await h.q<{ form_key: string; audience: string; active: boolean }>(
      `select form_key, audience, active from form_definitions`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.audience === 'CLIENT' && r.active)).toBe(true);
    expect(rows.some((r) => r.form_key === 'INTAKE_HORSE_PURCHASE')).toBe(true);
    expect(rows.some((r) => r.form_key.startsWith('ENGAGEMENT_'))).toBe(false);
  });

  it('a COMPANY form really exists (the anon filter is doing work)', async () => {
    await h.asSuperuser();
    const [row] = await h.q<{ n: number }>(
      `select count(*)::int as n from form_definitions where audience='COMPANY'`);
    expect(row.n).toBeGreaterThan(0);
  });
});

describe('intake_submissions — the anon submit seam', () => {
  it('anon submits a CLIENT form; it lands NEW in the seed tenant and staff read it back', async () => {
    await h.asAnon();
    await h.q(
      `insert into intake_submissions (form_key, payload, contact_email, contact_name)
       values ('INTAKE_HORSE_PURCHASE', '{"full_legal_name":"Pia Public","target_budget":"30000"}'::jsonb,
               'pia@public.test', 'Pia Public')`);
    // the REAL staff seam: tenant #1 staff read the queue
    await h.asUser(aAdmin);
    const [row] = await h.q<{ org_id: string; status: string; contact_name: string }>(
      `select org_id, status, contact_name from intake_submissions where contact_email='pia@public.test'`);
    expect(row.org_id).toBe(orgA);
    expect(row.status).toBe('NEW');
    expect(row.contact_name).toBe('Pia Public');
  });

  it('addressed-org arm: an anon submission for org B lands in org B; org A staff never see it', async () => {
    await asAddressedAnon(orgB, async () => {
      await h.q(
        `insert into intake_submissions (org_id, form_key, payload, contact_email)
         values ($1, 'INTAKE_HORSE_SALE', '{"horse_name":"Rival Star"}'::jsonb, 'seller@rival.test')`,
        [orgB]);
    });
    // org A staff: invisible (org boundary)
    await h.asUser(aAdmin);
    expect(
      (await h.q(`select id from intake_submissions where contact_email='seller@rival.test'`)),
    ).toHaveLength(0);
    // org B staff: theirs
    await h.asUser(bAdmin);
    const [row] = await h.q<{ org_id: string; form_key: string }>(
      `select org_id, form_key from intake_submissions where contact_email='seller@rival.test'`);
    expect(row.org_id).toBe(orgB);
    expect(row.form_key).toBe('INTAKE_HORSE_SALE');
  });

  it('an addressed anon cannot write INTO A DIFFERENT tenant (WITH CHECK boundary)', async () => {
    await asAddressedAnon(orgB, async () => {
      await expect(
        h.q(`insert into intake_submissions (org_id, form_key, payload)
             values ($1, 'INTAKE_HORSE_SALE', '{}'::jsonb)`, [orgA]),
      ).rejects.toThrow();
    });
  });

  it('unaddressed anon with 2+ tenants has no sole-org fallback: explicit foreign org rejected', async () => {
    await asAddressedAnon(null, async () => {
      // two orgs exist → sole_org() IS NULL → nothing passes WITH CHECK
      await expect(
        h.q(`insert into intake_submissions (org_id, form_key, payload)
             values ($1, 'INTAKE_HORSE_PURCHASE', '{}'::jsonb)`, [orgA]),
      ).rejects.toThrow();
    });
  });

  it('rejects a non-NEW status, an unknown form, a COMPANY form, and an oversized payload', async () => {
    await h.asAnon();
    await expect(
      h.q(`insert into intake_submissions (form_key, payload, status)
           values ('INTAKE_HORSE_PURCHASE','{}'::jsonb,'REVIEWED')`),
    ).rejects.toThrow();
    await expect(
      h.q(`insert into intake_submissions (form_key, payload) values ('NOT_A_FORM','{}'::jsonb)`),
    ).rejects.toThrow();
    await expect(
      h.q(`insert into intake_submissions (form_key, payload)
           values ('ENGAGEMENT_HORSE_CLIPPING','{}'::jsonb)`),
    ).rejects.toThrow();
    await expect(
      h.q(`insert into intake_submissions (form_key, payload)
           values ('INTAKE_HORSE_PURCHASE', jsonb_build_object('notes', repeat('x', 30000)))`),
    ).rejects.toThrow();
  });

  it('anon cannot READ or UPDATE the queue (write-only from the public side)', async () => {
    await h.asAnon();
    expect(await h.q(`select id from intake_submissions`)).toHaveLength(0);
    await h.q(`update intake_submissions set status='DISMISSED' where contact_email='pia@public.test'`);
    // the row is untouched (no anon UPDATE path — 0 rows matched under RLS)
    await h.asUser(aAdmin);
    const [row] = await h.q<{ status: string }>(
      `select status from intake_submissions where contact_email='pia@public.test'`);
    expect(row.status).toBe('NEW');
  });

  it('staff-only access within the org is unchanged: a plain USER still cannot insert', async () => {
    await h.asUser(aUser);
    await expect(
      h.q(`insert into intake_submissions (form_key, payload) values ('INTAKE_HORSE_PURCHASE','{}'::jsonb)`),
    ).rejects.toThrow();
  });
});
