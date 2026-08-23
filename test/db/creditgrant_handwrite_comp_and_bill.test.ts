/**
 * TASK-CREDITGRANT — staff hand-write, comp, or bill a lesson credit.
 *
 * Owner: "Staff should be able to hand write a lesson credit whenever they want; they
 * should be able to comp a lesson credit and generate a loss, and they should be able
 * to generate a balance owed and request payment."
 *
 * THE PROPERTY THIS FILE EXISTS TO HOLD: all three modes go through the SAME credit
 * engine a real checkout uses (`purchase_items` INSERT -> `trg_mint_purchase_credits`
 * -> `_mint_credits_for_purchase_item`). TASK-AUTHORITY deleted a raw-insert grant
 * button for being a second write path (D18); if a future change routes any of these
 * three around the engine, the offering/purchase/expiry assertions below fail.
 *
 * It also pins the three things the task said to VERIFY rather than assume:
 *   * minting is gated on `status <> 'draft'`, NOT on payment_status — so BILL mints
 *     immediately and the client is entitled before the money arrives;
 *   * the comp's LIST PRICE AT COMP survives a later price change on the offering;
 *   * the undo genuinely removes the entitlement, and refuses once it has been spent.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, migrationFiles, MIGRATIONS_DIR, type TestDb } from './harness';

/** The snapshot is 2026-08-21 (TASK-TESTREPAIR), so TASK-AUTHORITY's audit trigger on
 *  lesson_credits (2026-08-22) is not in it. It is a prerequisite here because §3 of
 *  the task requires each mode's write to leave an audit row. */
const PREREQS = ['20260822T2352_authority_5_audit_bookings.sql'];
const CREDITGRANT = migrationFiles().filter((f) => f.includes('creditgrant'));

let h: TestDb;
let org: string;
let staffUid: string;
let clientUid: string;
let clientId: string;
let contactId: string;

const SKUS = {
  single: { name: 'CG Single Lesson', kind: 'scheduled', unit: 1, price: 150 },
  pack:   { name: 'CG 4-Lesson Punch Card', kind: 'scheduled', unit: 4, price: 500 },
  weekly: { name: 'CG 1x Weekly Lesson', kind: 'recurring', unit: null, price: 460 },
  quote:  { name: 'CG Quote Only', kind: 'scheduled', unit: 0, price: 0 },
} as const;
const ids: Record<keyof typeof SKUS, string> = {} as never;

type Grant = {
  purchase_id: string; display_code: string | null; item_id: string; credit_id: string;
  credits: number; mode: string; reason: string; list_price: string | number;
  amount: string | number; comp_value: string | number; offering_name: string;
};

async function grant(
  offering: string, qty: number, mode: string, reason: string | null, method?: string,
): Promise<Grant> {
  await h.asUser(staffUid);
  const [{ out }] = await h.q<{ out: Grant }>(
    `select grant_lesson_credit($1,$2,$3,$4,$5,$6) as out`,
    [clientId, offering, qty, mode, reason, method ?? null]);
  return out;
}

async function creditRow(itemId: string) {
  await h.asSuperuser();
  const rows = await h.q<{
    id: string; credits_total: number; credits_remaining: number; offering_id: string | null;
    purchase_id: string | null; package_key: string | null; deleted_at: string | null;
  }>(`select id, credits_total, credits_remaining, offering_id, purchase_id, package_key,
             deleted_at::text
        from lesson_credits where purchase_item_id = $1 order by created_at`, [itemId]);
  return rows;
}

async function purchase(id: string) {
  await h.asSuperuser();
  return (await h.q<{
    status: string; payment_status: string; amount: string; amount_paid: string;
    payment_method: string | null; current_status: string | null; paid_at: string | null;
    notes: string | null;
  }>(`select status, payment_status, amount::text, amount_paid::text, payment_method,
             current_status, paid_at::text, notes
        from purchases where id = $1`, [id]))[0];
}

async function timeline(purchaseId: string) {
  await h.asSuperuser();
  return h.q<{ status: string; detail: string | null }>(
    `select status, detail from status_events
      where entity_type='order' and entity_id=$1 order by created_at, status`, [purchaseId]);
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  for (const f of [...PREREQS, ...CREDITGRANT]) {
    try {
      await h.db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
    } catch (err) {
      throw new Error(`migration failed: ${f}\n${(err as Error).message}`);
    }
  }

  // status_events_vocab is not a snapshot-seeded table; the purchases INSERT trigger
  // FKs into it (the same seed creditfix's and creditalign's tests needed).
  await h.q(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'order', c, c from unnest(array['pending','submitted','paid','void','unpaid','draft',
                                           'item_voided','payment_pending_zelle','payment_pending_cash']) c
    on conflict do nothing;`);
  await h.q(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'offering', c, c from unnest(array['pending','scheduled','cancelled','completed','no_show']) c
    on conflict do nothing;`);
  await h.q(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'fulfillment', c, c from unnest(array['open','scheduled','consumed','delivered','expired','void']) c
    on conflict do nothing;`);

  staffUid = await h.createAuthUser({ role: 'ADMIN', org, isAdmin: true });
  clientUid = await h.createAuthUser({ role: 'USER', org });
  contactId = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name, email)
       values ($1,'Creditgrant','Client','creditgrant-client@test.fhe') returning id`, [org]))[0].id;
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contactId, clientUid]);
  clientId = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, contactId]))[0].id;

  for (const [key, s] of Object.entries(SKUS)) {
    ids[key as keyof typeof SKUS] = (await h.q<{ id: string }>(
      `insert into offerings (org_id, segment, name, slug, active, service_type, config_kind,
                              price_unit, unit_count, price_amount)
         values ($1,'rider',$2,$3,true,'RIDING_LESSON',$4,'session',$5,$6) returning id`,
      [org, s.name, `creditgrant-${key}`, s.kind, s.unit, s.price]))[0].id;
  }
});

afterAll(async () => { await h?.close(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('the gate — no reason, no grant (D19.2)', () => {
  it('refuses a blank reason', async () => {
    await expect(grant(ids.single, 1, 'handwrite', '   ')).rejects.toThrow(/reason is required/i);
    await expect(grant(ids.single, 1, 'comp', null)).rejects.toThrow(/reason is required/i);
  });

  it('refuses a non-staff caller', async () => {
    await h.asUser(clientUid);
    await expect(h.q(`select grant_lesson_credit($1,$2,1,'comp','I would like one')`,
      [clientId, ids.single])).rejects.toThrow(/only staff/i);
  });

  it('refuses a recurring SKU by name — a standing slot is not a credit balance (D23)', async () => {
    await expect(grant(ids.weekly, 1, 'handwrite', 'wrong shape'))
      .rejects.toThrow(/standing slot, not a credit balance/i);
  });

  it('refuses a SKU that carries no credit units rather than granting nothing', async () => {
    await expect(grant(ids.quote, 1, 'comp', 'nothing to mint'))
      .rejects.toThrow(/carries no credit units/i);
  });

  it('refuses an unknown mode', async () => {
    await expect(grant(ids.single, 1, 'freebie', 'typo')).rejects.toThrow(/handwrite, comp or bill/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('mode 1 — HAND-WRITE', () => {
  let g: Grant;
  beforeAll(async () => { g = await grant(ids.pack, 1, 'handwrite', 'Paid me in cash at the barn', 'cash'); });

  it('mints through the engine: the credit carries the offering, the purchase and the line', async () => {
    const [c] = await creditRow(g.item_id);
    expect(c.credits_total).toBe(4);          // unit_count 4 x quantity 1
    expect(c.credits_remaining).toBe(4);
    expect(c.offering_id).toBe(ids.pack);      // never a bare unlabelled credit (D19.3)
    expect(c.purchase_id).toBe(g.purchase_id);
    expect(c.package_key).toBe(SKUS.pack.name);
  });

  it('records the money as received, at list price', async () => {
    const p = await purchase(g.purchase_id);
    expect(p.status).toBe('paid');
    expect(p.payment_status).toBe('paid');
    expect(Number(p.amount)).toBe(500);
    expect(Number(p.amount_paid)).toBe(500);
    expect(p.payment_method).toBe('cash');
    expect(p.paid_at).not.toBeNull();
  });

  it('writes the act on the order timeline in WORDS, with the reason (D19)', async () => {
    const events = await timeline(g.purchase_id);
    const ev = events.find((e) => e.status === 'staff_grant');
    expect(ev).toBeTruthy();
    expect(ev!.detail).toMatch(/Hand-wrote 4 x CG 4-Lesson Punch Card/);
    expect(ev!.detail).toMatch(/\$500\.00 recorded as received/);
    expect(ev!.detail).toMatch(/Paid me in cash at the barn/);
    // the note is a note, not a status: the order still reads "paid"
    expect((await purchase(g.purchase_id)).current_status).toBe('paid');
  });

  it('leaves an audit_logs row for the credit itself (authority_5)', async () => {
    await h.asSuperuser();
    const [c] = await creditRow(g.item_id);
    const rows = await h.q<{ action: string }>(
      `select action from audit_logs where table_name='lesson_credits' and record_id=$1`, [c.id]);
    expect(rows.map((r) => r.action)).toContain('INSERT');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('mode 2 — COMP, and the loss it generates', () => {
  let a: Grant;
  beforeAll(async () => {
    a = await grant(ids.single, 2, 'comp', 'Made up for a lesson I cancelled');
    await grant(ids.pack, 1, 'comp', 'Working student');
  });

  it('the line is free but the credits are real', async () => {
    const [c] = await creditRow(a.item_id);
    expect(c.credits_total).toBe(2);
    const p = await purchase(a.purchase_id);
    expect(Number(p.amount)).toBe(0);
    expect(p.payment_method).toBe('comp');
  });

  it('captures the LIST PRICE AT COMP on the line', async () => {
    await h.asSuperuser();
    const [row] = await h.q<{ price_amount: string; config: Record<string, unknown> }>(
      `select price_amount::text, config from purchase_items where id=$1`, [a.item_id]);
    expect(Number(row.price_amount)).toBe(0);
    expect(Number(row.config.list_price)).toBe(150);
    expect(row.config.grant_mode).toBe('comp');
    expect(row.config.grant_reason).toBe('Made up for a lesson I cancelled');
  });

  it('sums the loss across comps, in dollars', async () => {
    await h.asUser(staffUid);
    const [{ out }] = await h.q<{ out: { comp_count: number; credits_comped: number;
      list_value: string | number; by_service: { service: string; list_value: string | number }[] } }>(
      `select comped_credit_value() as out`);
    expect(out.comp_count).toBe(2);
    expect(Number(out.list_value)).toBe(2 * 150 + 1 * 500);   // 800
    expect(out.credits_comped).toBe(2 + 4);
    const single = out.by_service.find((s) => s.service === SKUS.single.name);
    expect(Number(single!.list_value)).toBe(300);
  });

  it('a later price change does NOT restate a recorded loss', async () => {
    await h.asSuperuser();
    await h.q(`update offerings set price_amount = 999 where id=$1`, [ids.single]);
    await h.asUser(staffUid);
    const [{ out }] = await h.q<{ out: { list_value: string | number } }>(
      `select comped_credit_value() as out`);
    expect(Number(out.list_value)).toBe(800);
    await h.asSuperuser();
    await h.q(`update offerings set price_amount = $2 where id=$1`, [ids.single, SKUS.single.price]);
  });

  it('a comp is not a payment — no "payment received" notice goes out', async () => {
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from notifications where user_id=$1 and kind='payment_received'
         and link = '/app/orders' and created_at >= (select created_at from purchases where id=$2)`,
      [clientUid, a.purchase_id]);
    expect(n).toBe(0);
  });

  it('tells the client what they now hold', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ title: string; body: string | null }>(
      `select title, body from notifications where user_id=$1 and kind='credit_granted'
         and link = $2`, [clientUid, `/order/${a.purchase_id}`]);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toMatch(/2 x CG Single Lesson/);
    expect(rows[0].body).toMatch(/With our compliments/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('mode 3 — BILL, and asking for the money', () => {
  let g: Grant;
  beforeAll(async () => { g = await grant(ids.single, 3, 'bill', 'Three lessons, invoice to follow'); });

  it('opens a real balance owed', async () => {
    const p = await purchase(g.purchase_id);
    expect(p.status).toBe('awaiting_payment');
    expect(p.payment_status).toBe('unpaid');
    expect(Number(p.amount)).toBe(450);
    expect(Number(p.amount_paid)).toBe(0);
    expect(p.paid_at).toBeNull();
  });

  it('MINTS ANYWAY — the engine gates on status <> draft, never on payment_status', async () => {
    const [c] = await creditRow(g.item_id);
    expect(c.credits_total).toBe(3);
    expect(c.credits_remaining).toBe(3);
  });

  it('raises NO payment-due notice on its own — asking is a separate act', async () => {
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from notifications
        where kind='purchase_unpaid' and link=$1`, [`/order/${g.purchase_id}`]);
    expect(n).toBe(0);
  });

  it('request_purchase_payment raises the existing unpaid pair and says so on the timeline', async () => {
    await h.asUser(staffUid);
    const [{ out }] = await h.q<{ out: { amount_due: string | number; recipient: string | null;
      send_key: string; label: string } }>(
      `select request_purchase_payment($1,'Bank transfer is easiest for us') as out`, [g.purchase_id]);
    expect(Number(out.amount_due)).toBe(450);
    // the ACCOUNT email, not the contact's — that is where they sign in and read it
    await h.asSuperuser();
    const [{ email }] = await h.q<{ email: string }>(
      `select email from profiles where user_id=$1`, [clientUid]);
    expect(out.recipient).toBe(email);
    await h.asUser(staffUid);
    expect(out.send_key).toMatch(/^payreq:/);
    expect(out.label).toBe(SKUS.single.name);

    await h.asSuperuser();
    const notes = await h.q<{ kind: string; title: string; body: string | null }>(
      `select kind, title, body from notifications where link=$1 order by created_at`,
      [`/order/${g.purchase_id}`]);
    // the standing "payment due" notice (the existing spine) + the staff note
    expect(notes.filter((n) => n.kind === 'purchase_unpaid')).toHaveLength(2);
    expect(notes.some((n) => n.body === 'Bank transfer is easiest for us')).toBe(true);

    const ev = (await timeline(g.purchase_id)).find((e) => e.status === 'payment_requested');
    expect(ev!.detail).toMatch(/\$450\.00 requested/);
    expect(ev!.detail).toMatch(/Bank transfer is easiest for us/);
  });

  it('falls back to the contact email for a client with no login', async () => {
    await h.asSuperuser();
    const noLogin = (await h.q<{ id: string }>(
      `insert into contacts (org_id, first_name, last_name, email)
         values ($1,'No','Login','creditgrant-nologin@test.fhe') returning id`, [org]))[0].id;
    const noLoginClient = (await h.q<{ id: string }>(
      `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, noLogin]))[0].id;
    await h.asUser(staffUid);
    const [{ out }] = await h.q<{ out: { purchase_id: string } }>(
      `select grant_lesson_credit($1,$2,1,'bill','No account yet') as out`,
      [noLoginClient, ids.single]);
    const [{ req }] = await h.q<{ req: { recipient: string | null } }>(
      `select request_purchase_payment($1,null) as req`, [out.purchase_id]);
    expect(req.recipient).toBe('creditgrant-nologin@test.fhe');
  });

  it('refuses to ask for money on an order that owes none', async () => {
    const paid = await grant(ids.single, 1, 'handwrite', 'Already settled');
    await h.asUser(staffUid);
    await expect(h.q(`select request_purchase_payment($1,null)`, [paid.purchase_id]))
      .rejects.toThrow(/owes nothing/i);
  });

  it('logs every send attempt, success or failure — no row means it never ran', async () => {
    await h.asUser(staffUid);
    const [{ out }] = await h.q<{ out: { send_key: string } }>(
      `select request_purchase_payment($1,null) as out`, [g.purchase_id]);
    await h.asServiceRole();
    await h.q(`select log_payment_request_send($1,$2,'creditgrant-client@test.fhe',false,450,
                                               'email provider not configured',null,null)`,
      [g.purchase_id, out.send_key]);
    await h.asSuperuser();
    const rows = await h.q<{ succeeded: boolean; error: string | null }>(
      `select succeeded, error from payment_request_sends where purchase_id=$1`, [g.purchase_id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].succeeded).toBe(false);
    expect(rows[0].error).toBe('email provider not configured');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the undo (D19.4)', () => {
  it('takes back the entitlement and voids the order and its lines', async () => {
    const g = await grant(ids.pack, 1, 'comp', 'Granted by mistake');
    expect((await creditRow(g.item_id))[0].deleted_at).toBeNull();

    await h.asUser(staffUid);
    const [{ out }] = await h.q<{ out: { credits_revoked: number; items_voided: number } }>(
      `select revoke_lesson_credit_grant($1,'Wrong client') as out`, [g.purchase_id]);
    expect(out.credits_revoked).toBe(1);
    expect(out.items_voided).toBe(1);

    // the credit is gone from every live read
    expect((await creditRow(g.item_id))[0].deleted_at).not.toBeNull();
    const p = await purchase(g.purchase_id);
    expect(p.status).toBe('void');
    expect(Number(p.amount)).toBe(0);
    await h.asSuperuser();
    const [{ voided }] = await h.q<{ voided: number }>(
      `select count(*)::int as voided from purchase_items
        where purchase_id=$1 and voided_at is not null`, [g.purchase_id]);
    expect(voided).toBe(1);

    const ev = (await timeline(g.purchase_id)).find((e) => e.status === 'grant_reversed');
    expect(ev!.detail).toMatch(/Wrong client/);
  });

  it('a reversed comp stops counting as a loss', async () => {
    await h.asUser(staffUid);
    const before = Number((await h.q<{ out: { list_value: string | number } }>(
      `select comped_credit_value() as out`))[0].out.list_value);
    const g = await grant(ids.single, 1, 'comp', 'Counted, then undone');
    const mid = Number((await h.q<{ out: { list_value: string | number } }>(
      `select comped_credit_value() as out`))[0].out.list_value);
    expect(mid).toBe(before + 150);
    await h.q(`select revoke_lesson_credit_grant($1,'undo')`, [g.purchase_id]);
    const after = Number((await h.q<{ out: { list_value: string | number } }>(
      `select comped_credit_value() as out`))[0].out.list_value);
    expect(after).toBe(before);
  });

  it('reverses a hand-written grant, and the recorded payment with it', async () => {
    const g = await grant(ids.single, 1, 'handwrite', 'Miskeyed the amount', 'zelle');
    await h.asUser(staffUid);
    await h.q(`select revoke_lesson_credit_grant($1,'Re-entering it correctly')`, [g.purchase_id]);
    const p = await purchase(g.purchase_id);
    expect(p.status).toBe('void');
    expect(p.payment_status).toBe('unpaid');
    expect(Number(p.amount_paid)).toBe(0);
    expect(p.paid_at).toBeNull();
  });

  it('REFUSES once a credit has been spent — the lesson happened', async () => {
    const g = await grant(ids.single, 1, 'comp', 'Spent before undo');
    await h.asSuperuser();
    await h.q(`update lesson_credits set credits_remaining = 0 where purchase_item_id=$1`, [g.item_id]);
    await h.asUser(staffUid);
    await expect(h.q(`select revoke_lesson_credit_grant($1,'too late')`, [g.purchase_id]))
      .rejects.toThrow(/already been used/i);
  });

  it('refuses twice, refuses without a reason, and refuses a non-grant order', async () => {
    const g = await grant(ids.single, 1, 'comp', 'Undo twice');
    await h.asUser(staffUid);
    await expect(h.q(`select revoke_lesson_credit_grant($1,null)`, [g.purchase_id]))
      .rejects.toThrow(/reason is required/i);
    await h.q(`select revoke_lesson_credit_grant($1,'first')`, [g.purchase_id]);
    await expect(h.q(`select revoke_lesson_credit_grant($1,'second')`, [g.purchase_id]))
      .rejects.toThrow(/already been undone/i);

    await h.asSuperuser();
    const [{ id }] = await h.q<{ id: string }>(
      `insert into purchases (org_id, buyer_contact_id, status, amount)
         values ($1,$2,'awaiting_payment',10) returning id`, [org, contactId]);
    await h.q(`insert into purchase_items (org_id, purchase_id, label, price_amount, quantity)
                 values ($1,$2,'A real checkout line',10,1)`, [org, id]);
    await h.asUser(staffUid);
    await expect(h.q(`select revoke_lesson_credit_grant($1,'not mine to undo')`, [id]))
      .rejects.toThrow(/not a staff credit grant/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the ledger says where each credit came from (§4)', () => {
  it('labels purchase / handwrite / comp / bill differently, with the reason', async () => {
    // a real client checkout, minted by the same trigger with no grant_mode
    await h.asSuperuser();
    const [{ id: shopOrder }] = await h.q<{ id: string }>(
      `insert into purchases (org_id, buyer_contact_id, status, amount, payment_status)
         values ($1,$2,'awaiting_payment',150,'unpaid') returning id`, [org, contactId]);
    await h.q(`insert into purchase_items (org_id, purchase_id, offering_id, label, price_amount, quantity)
                 values ($1,$2,$3,$4,150,1)`, [org, shopOrder, ids.single, SKUS.single.name]);

    const hw = await grant(ids.single, 1, 'handwrite', 'Ledger: handwrite', 'cash');
    const cp = await grant(ids.single, 1, 'comp', 'Ledger: comp');
    const bl = await grant(ids.single, 1, 'bill', 'Ledger: bill');

    await h.asUser(staffUid);
    const [{ out }] = await h.q<{ out: {
      id: string; origin: string; reason: string | null; offering_name: string | null;
      can_undo: boolean; undo_blocked: string | null; amount_due: string | number;
      purchase_id: string | null; quantity: number;
      list_price: string | number | null; list_value: string | number | null;
    }[] }>(`select credit_ledger($1) as out`, [clientId]);

    const byPurchase = (pid: string) => out.find((r) => r.purchase_id === pid)!;
    expect(byPurchase(shopOrder).origin).toBe('purchase');
    expect(byPurchase(shopOrder).reason).toBeNull();
    expect(byPurchase(shopOrder).can_undo).toBe(false);
    expect(byPurchase(shopOrder).undo_blocked).toMatch(/did not come from a staff grant/);

    expect(byPurchase(hw.purchase_id).origin).toBe('handwrite');
    expect(byPurchase(cp.purchase_id).origin).toBe('comp');
    expect(byPurchase(bl.purchase_id).origin).toBe('bill');
    expect(byPurchase(cp.purchase_id).reason).toBe('Ledger: comp');
    expect(byPurchase(cp.purchase_id).offering_name).toBe(SKUS.single.name);
    expect(Number(byPurchase(bl.purchase_id).amount_due)).toBe(150);
    expect(Number(byPurchase(cp.purchase_id).amount_due)).toBe(0);
    expect(byPurchase(bl.purchase_id).can_undo).toBe(true);
    // per-unit vs per-line: the ledger shows the LINE's list value
    const comp2 = await grant(ids.single, 2, 'comp', 'Two at once');
    const [{ out: out2 }] = await h.q<{ out: { purchase_id: string | null; quantity: number;
      list_price: string | number | null; list_value: string | number | null }[] }>(
      `select credit_ledger($1) as out`, [clientId]);
    const two = out2.find((r) => r.purchase_id === comp2.purchase_id)!;
    expect(two.quantity).toBe(2);
    expect(Number(two.list_price)).toBe(150);
    expect(Number(two.list_value)).toBe(300);
  });

  it('hides a revoked grant, and explains a spent one instead of offering a dead button', async () => {
    const gone = await grant(ids.single, 1, 'comp', 'Will be undone');
    const spent = await grant(ids.single, 1, 'comp', 'Will be spent');
    await h.asUser(staffUid);
    await h.q(`select revoke_lesson_credit_grant($1,'undone for the ledger test')`, [gone.purchase_id]);
    await h.asSuperuser();
    await h.q(`update lesson_credits set credits_remaining = 0 where purchase_item_id=$1`, [spent.item_id]);

    await h.asUser(staffUid);
    const [{ out }] = await h.q<{ out: { purchase_id: string | null; can_undo: boolean;
      undo_blocked: string | null }[] }>(`select credit_ledger($1) as out`, [clientId]);
    expect(out.some((r) => r.purchase_id === gone.purchase_id)).toBe(false);
    const s = out.find((r) => r.purchase_id === spent.purchase_id)!;
    expect(s.can_undo).toBe(false);
    expect(s.undo_blocked).toMatch(/1 of these credits have been used/);
  });

  it('never calls a returned credit or an orphan a purchase', async () => {
    await h.asSuperuser();
    // the shape _refund_booking_credit leaves when a standing slot is given back
    await h.q(`insert into lesson_credits (org_id, client_id, package_key, credits_total,
                                           credits_remaining, offering_id)
                 values ($1,$2,'change_credit',1,1,$3)`, [org, clientId, ids.single]);
    // the orphan shape TASK-AUTHORITY found: no line, no order, no offering
    await h.q(`insert into lesson_credits (org_id, client_id, credits_total, credits_remaining)
                 values ($1,$2,1,0)`, [org, clientId]);

    await h.asUser(staffUid);
    const [{ out }] = await h.q<{ out: { origin: string; package_key: string | null;
      purchase_id: string | null; can_undo: boolean }[] }>(
      `select credit_ledger($1) as out`, [clientId]);
    const change = out.find((r) => r.package_key === 'change_credit')!;
    expect(change.origin).toBe('change');
    expect(change.can_undo).toBe(false);
    const orphan = out.find((r) => r.package_key === null && r.purchase_id === null)!;
    expect(orphan.origin).toBe('unknown');
    expect(orphan.can_undo).toBe(false);
  });

  it('the grant picker offers only what can actually mint a credit', async () => {
    await h.asUser(staffUid);
    const [{ out }] = await h.q<{ out: { id: string; name: string }[] }>(
      `select grantable_offerings() as out`);
    const names = out.map((o) => o.name);
    expect(names).toContain(SKUS.single.name);
    expect(names).toContain(SKUS.pack.name);
    expect(names).not.toContain(SKUS.weekly.name);   // recurring = standing slot (D23)
    expect(names).not.toContain(SKUS.quote.name);    // unit_count 0 mints nothing
  });
});

describe('D18 — one write path', () => {
  it('nothing in the grant path writes lesson_credits directly', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select string_agg(pg_get_functiondef(p.oid), E'\n') as src
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public'
          and p.proname in ('grant_lesson_credit','request_purchase_payment','comped_credit_value')`);
    expect(src).not.toMatch(/insert\s+into\s+lesson_credits/i);
    expect(src).toMatch(/_mint_credits_for_purchase_item/);
  });

  it('the undo only ever soft-deletes — it never removes a credit row', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select pg_get_functiondef(p.oid) as src from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='revoke_lesson_credit_grant'`);
    expect(src).not.toMatch(/delete\s+from\s+lesson_credits/i);
    expect(src).toMatch(/set deleted_at = now\(\)/i);
  });
});
