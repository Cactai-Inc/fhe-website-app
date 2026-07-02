/**
 * Intake submissions (OPS-INTAKE, migration 20260701020000_intake_submissions) — core table.
 *
 * Real-path data tests (Wiring & Verification Contract §15.1(1)): every assertion
 * exercises the ACTUAL table/functions the app uses (intake_submissions,
 * create_purchase_engagement, has_staff_access, current_org) as the CORRECT RLS
 * role, and asserts rows land with the RIGHT columns and read back.
 *
 * Proves:
 *  - org_id DEFAULTS to the caller's tenant on insert; status defaults to NEW.
 *  - org_boundary: org B staff cannot SEE or WRITE org A's submissions.
 *  - staff access: a plain USER of the same org sees nothing and cannot insert.
 *  - status flow: NEW → REVIEWED (reviewed_at/reviewed_by stamped) → CONVERTED
 *    with converted_engagement_id pointing at a REAL engagement created through
 *    the real create_purchase_engagement RPC; NEW → DISMISSED.
 *  - the CHECK constraint rejects an out-of-vocabulary status.
 *  - form_key must reference a real form_definitions.form_key.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // FHE (tenant #1) — has mod.brokerage (launch tier)
let orgB: string; // a second tenant (isolation peer)
let aAdmin: string, bAdmin: string;
let aUser: string; // a plain USER (client) of org A — no staff access

beforeAll(async () => {
  h = await createTestDb({ upTo: '20260701020000_intake_submissions.sql' });
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Intake Rival','intake-rival') returning id`))[0].id;

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
  aUser = await h.createAuthUser({ role: 'USER', org: orgA });
});
afterAll(async () => {
  await h?.close();
});

describe('intake_submissions — defaults + org boundary + staff access', () => {
  it('staff insert: org_id DEFAULTS to the caller\'s tenant, status defaults to NEW', async () => {
    await h.asUser(aAdmin);
    await h.q(
      `insert into intake_submissions (form_key, payload, contact_email, contact_name)
         values ('INTAKE_HORSE_FINDER', '{"target_budget":"25000"}'::jsonb, 'ada@barn.test', 'Ada Rider')`);
    await h.asSuperuser();
    const [row] = await h.q<{ org_id: string; status: string; payload: { target_budget: string } }>(
      `select org_id, status, payload from intake_submissions where contact_email='ada@barn.test'`);
    expect(row.org_id).toBe(orgA);
    expect(row.status).toBe('NEW');
    expect(row.payload.target_budget).toBe('25000');
  });

  it('rejects an out-of-vocabulary status (CHECK constraint)', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into intake_submissions (form_key, payload, status)
             values ('INTAKE_HORSE_FINDER','{}'::jsonb,'ARCHIVED')`),
    ).rejects.toThrow();
  });

  it('rejects a form_key that is not a real form_definitions.form_key', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into intake_submissions (form_key, payload) values ('NOT_A_FORM','{}'::jsonb)`),
    ).rejects.toThrow();
  });

  it('org B staff cannot SEE org A\'s submissions', async () => {
    await h.asUser(bAdmin);
    const rows = await h.q<{ contact_email: string | null }>(
      `select contact_email from intake_submissions`);
    expect(rows.some((r) => r.contact_email === 'ada@barn.test')).toBe(false);
  });

  it('org B staff cannot WRITE a submission into org A (WITH CHECK boundary)', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`insert into intake_submissions (org_id, form_key, payload)
             values ($1,'INTAKE_HORSE_FINDER','{}'::jsonb)`, [orgA]),
    ).rejects.toThrow();
  });

  it('a plain USER of org A sees nothing and cannot insert (staff-only access)', async () => {
    await h.asUser(aUser);
    const rows = await h.q(`select id from intake_submissions`);
    expect(rows).toHaveLength(0);
    await expect(
      h.q(`insert into intake_submissions (form_key, payload) values ('INTAKE_HORSE_FINDER','{}'::jsonb)`),
    ).rejects.toThrow();
  });
});

describe('intake_submissions — status flow (REVIEWED / CONVERTED / DISMISSED)', () => {
  it('NEW → REVIEWED stamps reviewed_at + reviewed_by and reads back', async () => {
    await h.asUser(aAdmin);
    const [sub] = await h.q<{ id: string }>(
      `insert into intake_submissions (form_key, payload) values ('INTAKE_HORSE_PURCHASE','{"horse_name":"Comet"}'::jsonb) returning id`);
    await h.q(
      `update intake_submissions set status='REVIEWED', reviewed_at=now(), reviewed_by=$2 where id=$1`,
      [sub.id, aAdmin]);
    const [row] = await h.q<{ status: string; reviewed_at: string | null; reviewed_by: string | null }>(
      `select status, reviewed_at, reviewed_by from intake_submissions where id=$1`, [sub.id]);
    expect(row.status).toBe('REVIEWED');
    expect(row.reviewed_at).not.toBeNull();
    expect(row.reviewed_by).toBe(aAdmin);
  });

  it('CONVERTED links a REAL engagement created via create_purchase_engagement', async () => {
    await h.asUser(aAdmin);
    const [contact] = await h.q<{ id: string }>(
      `insert into contacts (full_name, email) values ('Buyer From Intake','buyer@intake.test') returning id`);
    const [sub] = await h.q<{ id: string }>(
      `insert into intake_submissions (form_key, payload, contact_email)
         values ('INTAKE_HORSE_PURCHASE','{}'::jsonb,'buyer@intake.test') returning id`);

    // The real brokerage RPC (org #1 has mod.brokerage) — the same seam the UI calls.
    const [eng] = await h.q<{ id: string }>(
      `select create_purchase_engagement($1) as id`, [contact.id]);
    expect(eng.id).toBeTruthy();

    await h.q(
      `update intake_submissions
          set status='CONVERTED', converted_engagement_id=$2, reviewed_at=now(), reviewed_by=$3
        where id=$1`,
      [sub.id, eng.id, aAdmin]);

    await h.asSuperuser();
    const [row] = await h.q<{ status: string; converted_engagement_id: string; org_id: string }>(
      `select status, converted_engagement_id, org_id from intake_submissions where id=$1`, [sub.id]);
    expect(row.status).toBe('CONVERTED');
    expect(row.converted_engagement_id).toBe(eng.id);
    expect(row.org_id).toBe(orgA);
    // …and the linked engagement really exists in engagements.
    const [engRow] = await h.q<{ service_type: string }>(
      `select service_type from engagements where id=$1`, [eng.id]);
    expect(engRow.service_type).toBe('HORSE_PURCHASE_ASSISTANCE');
  });

  it('converted_engagement_id must reference a REAL engagement (FK)', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into intake_submissions (form_key, payload, status, converted_engagement_id)
             values ('INTAKE_HORSE_PURCHASE','{}'::jsonb,'CONVERTED', gen_random_uuid())`),
    ).rejects.toThrow();
  });

  it('NEW → DISMISSED', async () => {
    await h.asUser(aAdmin);
    const [sub] = await h.q<{ id: string }>(
      `insert into intake_submissions (form_key, payload) values ('INTAKE_HORSE_LEASE_IN','{}'::jsonb) returning id`);
    await h.q(
      `update intake_submissions set status='DISMISSED', reviewed_at=now(), reviewed_by=$2 where id=$1`,
      [sub.id, aAdmin]);
    const [row] = await h.q<{ status: string }>(
      `select status from intake_submissions where id=$1`, [sub.id]);
    expect(row.status).toBe('DISMISSED');
  });
});
