/**
 * redeem_invitation (20260703020000) — the missing last step of invite-only
 * signup (owner-reported: invited users looped on the profile screen forever).
 *  - the invited user redeems: active membership granted, invitation accepted;
 *  - re-redeeming an accepted token fails; wrong-email users fail;
 *  - anon fails; a paused membership reactivates on redemption.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let invited: string;

async function makeInvite(email: string, token: string) {
  await h.asSuperuser();
  await h.q(
    `insert into invitations (email, token, expires_at, status)
     values ($1,$2, now() + interval '7 days', 'sent')`, [email, token]);
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  invited = await h.createAuthUser({ email: 'newmember@fhe.test' });
});
afterAll(async () => {
  await h?.close();
});

describe('redeem_invitation', () => {
  it('grants an active membership and consumes the token', async () => {
    await makeInvite('newmember@fhe.test', 'tok-good');
    await h.asUser(invited);
    const [r] = await h.q<{ redeem_invitation: boolean }>(
      `select redeem_invitation('tok-good')`);
    expect(r.redeem_invitation).toBe(true);

    await h.asSuperuser();
    const [m] = await h.q<{ status: string; tier: string }>(
      `select status, tier from memberships where user_id=$1`, [invited]);
    expect(m).toEqual({ status: 'active', tier: 'community' });
    const [inv] = await h.q<{ status: string }>(
      `select status from invitations where token='tok-good'`);
    expect(inv.status).toBe('accepted');
  });

  it('rejects re-redemption, wrong-email users, and anon', async () => {
    await h.asUser(invited);
    await expect(h.q(`select redeem_invitation('tok-good')`))
      .rejects.toThrow(/not valid/);

    await makeInvite('someoneelse@fhe.test', 'tok-other');
    await h.asUser(invited);
    await expect(h.q(`select redeem_invitation('tok-other')`))
      .rejects.toThrow(/different email/);

    await h.asAnon();
    await expect(h.q(`select redeem_invitation('tok-other')`))
      .rejects.toThrow(/sign in/);
  });

  it('reactivates a paused membership', async () => {
    await h.asSuperuser();
    await h.q(`update memberships set status='paused' where user_id=$1`, [invited]);
    await makeInvite('newmember@fhe.test', 'tok-again');
    await h.asUser(invited);
    await h.q(`select redeem_invitation('tok-again')`);
    await h.asSuperuser();
    const [m] = await h.q<{ status: string }>(
      `select status from memberships where user_id=$1`, [invited]);
    expect(m.status).toBe('active');
  });
});
