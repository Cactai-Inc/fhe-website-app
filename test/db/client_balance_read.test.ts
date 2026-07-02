/**
 * LANE-2 — client balance reads (RLS is the authority for /app/balance).
 *
 * Proves, as the REAL RLS roles, every read path the MyBalance page performs
 * and the new payer-read policy (20260702030000_transactions_payer_read.sql):
 *  - a client reads ONLY their own OPEN billable_lines (payer scoping), and a
 *    second client / another payer's lines are invisible;
 *  - a client cannot write billable_lines (no client write policy): UPDATE is
 *    a zero-row no-op and INSERT is rejected outright;
 *  - after staff settle, the client reads their OWN settlement INVOICE even
 *    when engagement_id is NULL (the exact caller_owns_engagement(NULL) gap
 *    the payer-read policy closes) — and never another payer's invoice;
 *  - the payer-read policy grants SELECT only: the payer cannot UPDATE the
 *    invoice;
 *  - cross-tenant: an org-B invoice for an org-B payer never leaks into the
 *    org-A client's transaction list (org boundary ANDs with payer read);
 *  - payments history is owner-scoped (owns_order): a client sees payments on
 *    their own orders only.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string;
let orgB: string;
let aAdmin: string;   // org-A staff (emits charges, settles)
let bAdmin: string;   // org-B staff
let clientUid: string; // the org-A member whose balance page we're proving
let otherUid: string;  // a second org-A member (isolation within the tenant)
let contactClient: string;
let contactOther: string;
let contactB: string;  // an org-B payer
let horseA: string;
let engA: string;      // engagement owned by clientUid's client, primary horse = horseA
let lineBoardId: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Balance Rival','balance-rival') returning id`))[0].id;

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
  clientUid = await h.createAuthUser({ role: 'USER', org: orgA });
  otherUid = await h.createAuthUser({ role: 'USER', org: orgA });

  await h.asSuperuser();
  // CRM identity: each member is a contact; profiles.contact_id bridges them
  // (current_contact_id()), and a clients row makes them an engagement owner.
  contactClient = (await h.q<{ id: string }>(
    `insert into contacts (org_id, full_name) values ($1,'Balance Client') returning id`, [orgA]))[0].id;
  contactOther = (await h.q<{ id: string }>(
    `insert into contacts (org_id, full_name) values ($1,'Other Member') returning id`, [orgA]))[0].id;
  contactB = (await h.q<{ id: string }>(
    `insert into contacts (org_id, full_name) values ($1,'Rival Payer') returning id`, [orgB]))[0].id;
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contactClient, clientUid]);
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contactOther, otherUid]);

  const clientRow = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [orgA, contactClient]))[0].id;
  horseA = (await h.q<{ id: string }>(
    `insert into horses (org_id, barn_name) values ($1,'Ledger') returning id`, [orgA]))[0].id;
  engA = (await h.q<{ id: string }>(
    `insert into engagements (org_id, client_id, service_type, primary_horse_id)
       values ($1,$2,'HORSE_TRAINING',$3) returning id`, [orgA, clientRow, horseA]))[0].id;

  // staff emit the charges (the real path: modules write billable_lines as staff)
  await h.asUser(aAdmin);
  lineBoardId = (await h.q<{ id: string }>(
    `insert into billable_lines (payer_contact_id, source_kind, amount, horse_id, status)
       values ($1,'board',120.00,$2,'OPEN') returning id`, [contactClient, horseA]))[0].id;
  await h.q(
    `insert into billable_lines (payer_contact_id, source_kind, amount, status)
       values ($1,'fee',30.50,'OPEN')`, [contactClient]);
  await h.q(
    `insert into billable_lines (payer_contact_id, source_kind, amount, status)
       values ($1,'lesson',99.00,'OPEN')`, [contactOther]);
});

afterAll(async () => {
  await h?.close();
});

describe('billable_lines: client reads own OPEN lines only', () => {
  it('the client sees exactly their own lines (payer scoping, not client-side filtering)', async () => {
    await h.asUser(clientUid);
    const rows = await h.q<{ payer_contact_id: string; amount: string; status: string }>(
      `select payer_contact_id, amount, status from billable_lines where status='OPEN' order by amount`);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.payer_contact_id === contactClient)).toBe(true);
    expect(rows.map((r) => Number(r.amount))).toEqual([30.5, 120]);
  });

  it("another member's line is invisible to the client, and vice versa", async () => {
    await h.asUser(otherUid);
    const rows = await h.q<{ payer_contact_id: string; amount: string }>(
      `select payer_contact_id, amount from billable_lines`);
    expect(rows).toHaveLength(1);
    expect(rows[0].payer_contact_id).toBe(contactOther);
    expect(Number(rows[0].amount)).toBe(99);
  });

  it('the client cannot write lines: UPDATE is a zero-row no-op, INSERT is rejected', async () => {
    await h.asUser(clientUid);
    const updated = await h.q(
      `update billable_lines set amount=0.01 where id=$1 returning id`, [lineBoardId]);
    expect(updated).toHaveLength(0);
    await expect(
      h.q(`insert into billable_lines (payer_contact_id, source_kind, amount)
             values ($1,'fee',1.00) returning id`, [contactClient]),
    ).rejects.toThrow(/row-level security|policy/i);

    await h.asSuperuser();
    const [row] = await h.q<{ amount: string }>(
      `select amount from billable_lines where id=$1`, [lineBoardId]);
    expect(Number(row.amount)).toBe(120); // untouched
  });
});

describe('transactions: the payer reads their own settlement INVOICE (payer-read policy)', () => {
  let invoiceId: string;

  it('setup: staff settle rolls the client lines into ONE invoice with engagement_id NULL', async () => {
    await h.asUser(aAdmin);
    const [res] = await h.q<{ transaction_id: string; amount: string; lines_settled: number }>(
      `select * from settle_billable_lines($1, NULL)`, [contactClient]);
    invoiceId = res.transaction_id;
    expect(invoiceId).not.toBeNull();
    expect(Number(res.amount)).toBeCloseTo(150.5, 2);

    // mixed lines (one horse-tied, one un-tied fee) → NOT a single shared
    // engagement → engagement_id NULL: caller_owns_engagement(NULL) is false,
    // so WITHOUT transactions_payer_read the payer could never see this row.
    await h.asSuperuser();
    const [txn] = await h.q<{ engagement_id: string | null }>(
      `select engagement_id from transactions where id=$1`, [invoiceId]);
    expect(txn.engagement_id).toBeNull();
  });

  it('the client reads their own invoice; another member sees nothing', async () => {
    await h.asUser(clientUid);
    const mine = await h.q<{ id: string; txn_type: string; amount: string; payer_contact_id: string }>(
      `select id, txn_type, amount, payer_contact_id from transactions where deleted_at is null`);
    expect(mine.map((t) => t.id)).toContain(invoiceId);
    const inv = mine.find((t) => t.id === invoiceId)!;
    expect(inv.txn_type).toBe('INVOICE');
    expect(Number(inv.amount)).toBeCloseTo(150.5, 2);
    expect(inv.payer_contact_id).toBe(contactClient);

    await h.asUser(otherUid);
    const others = await h.q<{ id: string }>(`select id from transactions`);
    expect(others.map((t) => t.id)).not.toContain(invoiceId);
  });

  it('the client also reads their own engagement (the grouping read the page does)', async () => {
    await h.asUser(clientUid);
    const rows = await h.q<{ id: string; primary_horse_id: string }>(
      `select id, primary_horse_id from engagements`);
    expect(rows.map((r) => r.id)).toContain(engA);
    expect(rows.find((r) => r.id === engA)!.primary_horse_id).toBe(horseA);
  });

  it('payer read grants SELECT only: the payer cannot UPDATE the invoice', async () => {
    await h.asUser(clientUid);
    const updated = await h.q(
      `update transactions set amount=0.01 where id=$1 returning id`, [invoiceId]);
    expect(updated).toHaveLength(0);
    await h.asSuperuser();
    const [row] = await h.q<{ amount: string }>(`select amount from transactions where id=$1`, [invoiceId]);
    expect(Number(row.amount)).toBeCloseTo(150.5, 2);
  });

  it("cross-tenant: an org-B payer's invoice never appears for the org-A client", async () => {
    await h.asUser(bAdmin);
    await h.q(
      `insert into billable_lines (payer_contact_id, source_kind, amount, status)
         values ($1,'consumption',777.00,'OPEN')`, [contactB]);
    const [bRes] = await h.q<{ transaction_id: string }>(
      `select * from settle_billable_lines($1, NULL)`, [contactB]);
    expect(bRes.transaction_id).not.toBeNull();

    await h.asUser(clientUid);
    const mine = await h.q<{ id: string }>(`select id from transactions`);
    expect(mine.map((t) => t.id)).not.toContain(bRes.transaction_id);
  });
});

describe('payments: history is owner-scoped via owns_order', () => {
  let paymentId: string;

  it('a client reads payments on their OWN orders only', async () => {
    // payments are server-written (service role); seed the real shape.
    await h.asSuperuser();
    const orderId = (await h.q<{ id: string }>(
      `insert into orders (user_id, status, subtotal, total)
         values ($1,'paid',150.00,150.00) returning id`, [clientUid]))[0].id;
    paymentId = (await h.q<{ id: string }>(
      `insert into payments (order_id, method, amount, reference_code, status)
         values ($1,'zelle',150.00,'FHE-1234','confirmed') returning id`, [orderId]))[0].id;

    await h.asUser(clientUid);
    const mine = await h.q<{ id: string; order_id: string; amount: string }>(
      `select id, order_id, amount from payments`);
    expect(mine.map((p) => p.id)).toContain(paymentId);
    expect(mine.find((p) => p.id === paymentId)!.order_id).toBe(orderId);

    await h.asUser(otherUid);
    const others = await h.q<{ id: string }>(`select id from payments`);
    expect(others.map((p) => p.id)).not.toContain(paymentId);
  });

  it('a client cannot write payments (server-managed)', async () => {
    await h.asUser(clientUid);
    const updated = await h.q(
      `update payments set status='refunded' where id=$1 returning id`, [paymentId]);
    expect(updated).toHaveLength(0);
  });
});
