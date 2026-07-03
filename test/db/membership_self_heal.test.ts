/**
 * ensure_my_membership + single-engagement onboarding scope (20260703070000) —
 * hardening from the 2026-07-03 production incident: an invitation row deleted
 * outside the app stranded a provisioned, PAID client at the member gate.
 *  - a provisioned client with no membership self-heals to active/community;
 *  - my_onboarding_state() heals as a side effect of its first load;
 *  - strangers (no client row) never gain a membership;
 *  - paused reactivates; cancelled stays cancelled (staff decision);
 *  - a DUPLICATE provision no longer doubles the signing checklist (the
 *    checklist follows the single most recent awaiting engagement).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let admin: string;
let tierId: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  admin = await h.createAuthUser({ email: 'ops@fhe.test', isAdmin: true });
  const [t] = await h.q<{ id: string }>(
    `select t.id from offering_tiers t join offerings o on o.id = t.offering_id
     where o.slug = 'riding-lesson' and t.label = 'Single Lesson'`);
  tierId = t.id;
});
afterAll(async () => {
  await h?.close();
});

async function provision(email: string) {
  await h.asUser(admin);
  await h.q(
    `select provision_lesson_invitation($1,'Stranded','Rider',$2,true,'Cash',null)`,
    [email, tierId]);
}

describe('ensure_my_membership', () => {
  it('grants active/community to a provisioned client with no membership (lost token)', async () => {
    await provision('stranded@fhe.test');
    // the invitation row vanishes (the incident) — nothing to redeem
    await h.asSuperuser();
    await h.q(`delete from invitations where email='stranded@fhe.test'`);
    const uid = await h.createAuthUser({ email: 'stranded@fhe.test' });

    await h.asUser(uid);
    const [r] = await h.q<{ ensure_my_membership: boolean }>(`select ensure_my_membership()`);
    expect(r.ensure_my_membership).toBe(true);

    await h.asSuperuser();
    const [m] = await h.q<{ status: string; tier: string }>(
      `select status, tier from memberships where user_id=$1`, [uid]);
    expect(m).toEqual({ status: 'active', tier: 'community' });
  });

  it('my_onboarding_state() self-heals on load', async () => {
    await provision('healed-by-state@fhe.test');
    await h.asSuperuser();
    await h.q(`delete from invitations where email='healed-by-state@fhe.test'`);
    const uid = await h.createAuthUser({ email: 'healed-by-state@fhe.test' });

    await h.asUser(uid);
    const [s] = await h.q<{ my_onboarding_state: { needed: boolean; purchase: { paid: boolean } } }>(
      `select my_onboarding_state()`);
    expect(s.my_onboarding_state.needed).toBe(true);
    expect(s.my_onboarding_state.purchase.paid).toBe(true);

    await h.asSuperuser();
    const [m] = await h.q<{ status: string }>(
      `select status from memberships where user_id=$1`, [uid]);
    expect(m.status).toBe('active');
  });

  it('never grants to an account with no provisioned client row', async () => {
    const uid = await h.createAuthUser({ email: 'stranger@fhe.test' });
    await h.asUser(uid);
    const [r] = await h.q<{ ensure_my_membership: boolean }>(`select ensure_my_membership()`);
    expect(r.ensure_my_membership).toBe(false);
    await h.asSuperuser();
    const rows = await h.q(`select 1 from memberships where user_id=$1`, [uid]);
    expect(rows).toHaveLength(0);
  });

  it('reactivates paused; never overrides cancelled', async () => {
    await provision('paused@fhe.test');
    const paused = await h.createAuthUser({ email: 'paused@fhe.test' });
    await h.asSuperuser();
    await h.q(
      `insert into memberships (user_id, tier, status, org_id)
       values ($1,'community','paused',(select org_id from clients limit 1))`, [paused]);
    await h.asUser(paused);
    const [r1] = await h.q<{ ensure_my_membership: boolean }>(`select ensure_my_membership()`);
    expect(r1.ensure_my_membership).toBe(true);

    await provision('cancelled@fhe.test');
    const cancelled = await h.createAuthUser({ email: 'cancelled@fhe.test' });
    await h.asSuperuser();
    await h.q(
      `insert into memberships (user_id, tier, status, org_id)
       values ($1,'community','cancelled',(select org_id from clients limit 1))`, [cancelled]);
    await h.asUser(cancelled);
    const [r2] = await h.q<{ ensure_my_membership: boolean }>(`select ensure_my_membership()`);
    expect(r2.ensure_my_membership).toBe(false);
    await h.asSuperuser();
    const [m] = await h.q<{ status: string }>(
      `select status from memberships where user_id=$1`, [cancelled]);
    expect(m.status).toBe('cancelled');
  });
});

describe('duplicate provisions', () => {
  it('the checklist follows only the most recent awaiting engagement (4 docs, not 8)', async () => {
    await provision('double@fhe.test');
    await provision('double@fhe.test'); // the accidental second click
    const uid = await h.createAuthUser({ email: 'double@fhe.test' });

    await h.asUser(uid);
    const [s] = await h.q<{ my_onboarding_state: { documents: Array<{ template_key: string }> } }>(
      `select my_onboarding_state()`);
    expect(s.my_onboarding_state.documents.map((d) => d.template_key)).toEqual([
      'COMPANY_POLICIES', 'FACILITY_RULES', 'RELEASE_PARTICIPANT', 'HUMAN_EMERGENCY_MEDICAL',
    ]);

    const [g] = await h.q<{ generate_my_onboarding_documents: Array<{ status: string }> }>(
      `select generate_my_onboarding_documents()`);
    expect(g.generate_my_onboarding_documents).toHaveLength(4);
  });
});
