/**
 * Gift flow (migration 20260623050000_gifts + the org-scope pass in
 * 20260630030000): the gifts table + the open_gift / redeem_gift RPCs, full path:
 *
 *   mint (staff) → open_gift by code (anon reveal; marks opened) → redeem_gift
 *   (signed-in recipient) — including the intro-call unlock gate, the
 *   already-redeemed / expired / not-found outcomes, and tenant isolation
 *   (gifts are Class-A org-scoped: RESTRICTIVE org_boundary).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string;    // tenant #1 — the gifting tenant
let orgB: string;    // isolation peer
let aAdmin: string;  // org A staff (mints/fulfills/unlocks)
let bAdmin: string;  // org B staff (must see nothing of org A's gifts)
let buyer: string;   // org A user who bought a gift
let redeemer: string;// org A user who redeems

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Gift Rival','gift-rival') returning id`))[0].id;

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
  buyer = await h.createAuthUser({ role: 'USER', org: orgA });
  redeemer = await h.createAuthUser({ role: 'USER', org: orgA });
});

afterAll(async () => { await h?.close(); });

describe('mint → open → redeem (no gate)', () => {
  it('staff mints a paid gift; org_id defaults to the caller\'s tenant', async () => {
    await h.asUser(aAdmin);
    await h.q(
      `insert into gifts (code, item_type, item_label, amount, buyer_name, buyer_email,
                          buyer_user_id, recipient_name, recipient_email, gift_message, status)
         values ('GIFT-E2E1','lessons','Three Lessons',450.00,'Bella Buyer','bella@e2e.test',
                 $1,'Rae Recipient','rae@e2e.test','Enjoy!','paid')`, [buyer]);
    await h.asSuperuser();
    const [g] = await h.q<{ org_id: string; status: string; unlocked: boolean; unlock_gate: string }>(
      `select org_id, status, unlocked, unlock_gate from gifts where code='GIFT-E2E1'`);
    expect(g.org_id).toBe(orgA);
    expect(g.status).toBe('paid');
    expect(g.unlock_gate).toBe('none');
    expect(g.unlocked).toBe(false);
  });

  it('open_gift reveals the gift to an ANON visitor by code and marks it opened', async () => {
    await h.asAnon();
    const rows = await h.q<{
      item_type: string; item_label: string; recipient_name: string;
      gift_message: string; buyer_name: string; status: string; unlock_gate: string;
    }>(`select * from open_gift('GIFT-E2E1')`);
    expect(rows).toHaveLength(1);
    expect(rows[0].item_label).toBe('Three Lessons');
    expect(rows[0].recipient_name).toBe('Rae Recipient');
    expect(rows[0].gift_message).toBe('Enjoy!');
    expect(rows[0].status).toBe('opened'); // flipped on first look

    await h.asSuperuser();
    const [g] = await h.q<{ status: string; opened_at: string }>(
      `select status, opened_at from gifts where code='GIFT-E2E1'`);
    expect(g.status).toBe('opened');
    expect(g.opened_at).toBeTruthy();
  });

  it('a second open still reveals (already opened — no re-flip, still viewable)', async () => {
    await h.asAnon();
    const rows = await h.q<{ status: string }>(`select * from open_gift('GIFT-E2E1')`);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('opened');
  });

  it('redeem_gift requires authentication', async () => {
    await h.asAnon();
    const [r] = await h.q<{ redeem_gift: string }>(`select redeem_gift('GIFT-E2E1')`);
    expect(r.redeem_gift).toBe('not_authenticated');
  });

  it('the signed-in recipient redeems: status/redeemed_at/redeemed_user_id land', async () => {
    await h.asUser(redeemer);
    const [r] = await h.q<{ redeem_gift: string }>(`select redeem_gift('GIFT-E2E1')`);
    expect(r.redeem_gift).toBe('redeemed');

    await h.asSuperuser();
    const [g] = await h.q<{ status: string; redeemed_at: string; redeemed_user_id: string }>(
      `select status, redeemed_at, redeemed_user_id from gifts where code='GIFT-E2E1'`);
    expect(g.status).toBe('redeemed');
    expect(g.redeemed_at).toBeTruthy();
    expect(g.redeemed_user_id).toBe(redeemer);
  });

  it('a second redeem reports already_redeemed (no double-spend)', async () => {
    await h.asUser(redeemer);
    const [r] = await h.q<{ redeem_gift: string }>(`select redeem_gift('GIFT-E2E1')`);
    expect(r.redeem_gift).toBe('already_redeemed');
  });

  it('the redeemer can now read THEIR gift directly (buyer/redeemer read policy)', async () => {
    await h.asUser(redeemer);
    const rows = await h.q<{ code: string }>(`select code from gifts`);
    expect(rows.map((r) => r.code)).toContain('GIFT-E2E1');
  });
});

describe('the intro-call unlock gate', () => {
  it('a gated gift opens but reports unlocked=false, and redeem is held at the gate', async () => {
    await h.asUser(aAdmin);
    await h.q(
      `insert into gifts (code, item_type, item_label, recipient_name, status, unlock_gate)
         values ('GIFT-E2E2','membership','One Month Membership','Gale Gated','paid','intro_call')`);

    await h.asAnon();
    const [opened] = await h.q<{ unlock_gate: string; unlocked: boolean }>(
      `select unlock_gate, unlocked from open_gift('GIFT-E2E2')`);
    expect(opened.unlock_gate).toBe('intro_call');
    expect(opened.unlocked).toBe(false);

    await h.asUser(redeemer);
    const [r] = await h.q<{ redeem_gift: string }>(`select redeem_gift('GIFT-E2E2')`);
    expect(r.redeem_gift).toBe('awaiting_intro_call');
    await h.asSuperuser();
    const [g] = await h.q<{ status: string }>(`select status from gifts where code='GIFT-E2E2'`);
    expect(g.status).not.toBe('redeemed'); // held at the gate
  });

  it('staff clears the gate (unlocked=true); redeem then succeeds', async () => {
    await h.asUser(aAdmin);
    const updated = await h.q<{ id: string }>(
      `update gifts set unlocked=true where code='GIFT-E2E2' returning id`);
    expect(updated).toHaveLength(1);

    await h.asUser(redeemer);
    const [r] = await h.q<{ redeem_gift: string }>(`select redeem_gift('GIFT-E2E2')`);
    expect(r.redeem_gift).toBe('redeemed');
  });
});

describe('edge outcomes — expired / not found / not yet paid', () => {
  it('an expired gift neither opens nor redeems', async () => {
    await h.asUser(aAdmin);
    await h.q(
      `insert into gifts (code, item_type, item_label, status, expires_at)
         values ('GIFT-E2EX','lessons','Expired Lessons','paid', now() - interval '1 day')`);
    await h.asAnon();
    expect(await h.q(`select * from open_gift('GIFT-E2EX')`)).toHaveLength(0);
    await h.asUser(redeemer);
    const [r] = await h.q<{ redeem_gift: string }>(`select redeem_gift('GIFT-E2EX')`);
    expect(r.redeem_gift).toBe('expired');
  });

  it('an unknown code is not_found (and open_gift reveals nothing)', async () => {
    await h.asAnon();
    expect(await h.q(`select * from open_gift('GIFT-NOPE')`)).toHaveLength(0);
    await h.asUser(redeemer);
    const [r] = await h.q<{ redeem_gift: string }>(`select redeem_gift('GIFT-NOPE')`);
    expect(r.redeem_gift).toBe('not_found');
  });

  it('a merely-created (unpaid) gift is not revealable and stays created', async () => {
    await h.asUser(aAdmin);
    await h.q(
      `insert into gifts (code, item_type, item_label, status)
         values ('GIFT-E2EC','lessons','Unpaid Gift','created')`);
    await h.asAnon();
    expect(await h.q(`select * from open_gift('GIFT-E2EC')`)).toHaveLength(0);
    await h.asSuperuser();
    const [g] = await h.q<{ status: string }>(`select status from gifts where code='GIFT-E2EC'`);
    expect(g.status).toBe('created'); // the opened-flip only fires on paid/delivered
  });
});

describe('org isolation — gifts are tenant-scoped (Class-A boundary)', () => {
  it('org B staff sees NONE of org A\'s gifts, even as admin', async () => {
    await h.asUser(bAdmin);
    expect(await h.q(`select id from gifts`)).toHaveLength(0);
  });

  it('org B staff cannot UPDATE an org A gift (unlock across the boundary)', async () => {
    await h.asUser(bAdmin);
    const rows = await h.q<{ id: string }>(
      `update gifts set unlocked=true where code='GIFT-E2E2' returning id`);
    expect(rows).toHaveLength(0); // boundary hides the row — nothing updated
  });

  it('org B staff cannot INSERT a gift into org A (WITH CHECK boundary)', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`insert into gifts (org_id, code, item_type, item_label, status)
             values ($1,'GIFT-E2EB','lessons','Cross-tenant','paid')`, [orgA]),
    ).rejects.toThrow();
  });

  it('the org A buyer reads their own gift; org A\'s admin sees the tenant\'s gifts', async () => {
    await h.asUser(buyer);
    const mine = await h.q<{ code: string }>(`select code from gifts`);
    expect(mine.map((r) => r.code)).toEqual(['GIFT-E2E1']); // buyer_user_id = buyer only
    await h.asUser(aAdmin);
    const all = await h.q<{ code: string }>(`select code from gifts order by code`);
    expect(all.map((r) => r.code)).toEqual(['GIFT-E2E1', 'GIFT-E2E2', 'GIFT-E2EC', 'GIFT-E2EX']);
  });
});
