/**
 * TASK ZELLECLOSE — one payment spine, not two.
 *
 * `mark_purchase_paid` (automatic Zelle match, and any staff manual mark-paid)
 * notified the buyer + staff inline. `_provision_purchase_for_offerings`
 * (BOOKLINK's create-and-mark-paid path, reached when staff book a lesson and
 * choose "already paid") writes the exact same terminal purchase columns
 * directly on INSERT — but never notified anyone. status_events still fired
 * either way (trg_status_purchases, unconditional on the columns changing) —
 * only the human-facing side was silent on one of the two writers.
 *
 * The default harness loads the committed schema snapshot, which predates
 * CREDITFIX/ONBOARD (2026-08-15/16) entirely — this file replays exactly the
 * real migration chain those two + this task's fix require, in order, then
 * exercises `_provision_purchase_for_offerings(..., p_mark_paid := true, ...)`
 * BEFORE and AFTER the fix, plus a control proving `mark_purchase_paid`'s own
 * notify behavior is unchanged.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from './harness';

const CREDITFIX = '20260815T0500_creditfix_mint_from_unit_count.sql';
const ONBOARD_M4 = '20260816T1300_onboard_m4_client_reported_payment.sql';
const MIGRATION = '20260816T1400_zelleclose_paid_notify_spine.sql';

let h: TestDb;
let org: string;
let contact: string;
let client: string;
let offering: string;

async function applyMigration(file: string) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  await h.db.exec(sql);
}

async function paidNotificationCount(): Promise<number> {
  const rows = await h.q<{ n: string }>(
    `select count(*)::text as n from notifications where kind = 'payment_received'`);
  return Number(rows[0].n);
}

async function provisionPaid(notes: string): Promise<string> {
  const rows = await h.q<{ purchase_id: string }>(
    `select _provision_purchase_for_offerings($1,$2,$3,array[$4]::uuid[], true, 'cash', $5) as purchase_id`,
    [org, contact, client, offering, notes]);
  return rows[0].purchase_id;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(
    `select id from organizations order by created_at limit 1`))[0].id;

  // The snapshot is schema-only outside a small reviewed allowlist, and
  // status_events_vocab is not on it — but every purchases INSERT/UPDATE fires
  // trg_status_purchases, which FKs (entity_type, status) into that
  // vocabulary (cf. test/db/paylock_finalize_payment_buyer_keys.test.ts).
  await h.db.exec(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'order', c, c from unnest(array['pending','submitted','paid','void']) c
    on conflict do nothing;`);

  // A staff profile so notify_staff has somewhere to write.
  await h.createAuthUser({ email: 'staff@zelleclose.test', org, role: 'ADMIN' });

  contact = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name, email)
       values ($1,'Zelle','Close','zelleclose@test.fhe') returning id`, [org]))[0].id;
  client = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, contact]))[0].id;
  offering = (await h.q<{ id: string }>(
    `insert into offerings (org_id, segment, name, slug, price_amount, price_unit, config_kind)
       values ($1,'rider','Single Lesson','single-lesson-zelleclose',150.00,'session','scheduled')
     returning id`, [org]))[0].id;

  // Replay the real chain up to (not including) this task's own migration —
  // the snapshot predates all three.
  await applyMigration(CREDITFIX);
  await applyMigration(ONBOARD_M4);
});

afterAll(async () => { await h?.close(); });

describe('BEFORE the migration — the silent writer, reproduced', () => {
  it('a booking created already-paid does NOT notify staff', async () => {
    await h.asSuperuser();
    const before = await paidNotificationCount();
    const purchaseId = await provisionPaid('pre-fix proof');
    const after = await paidNotificationCount();
    expect(after).toBe(before); // the bug: silent

    const [row] = await h.q<{ status: string; payment_status: string }>(
      `select status, payment_status from purchases where id = $1`, [purchaseId]);
    expect(row.status).toBe('paid');
    expect(row.payment_status).toBe('paid'); // paid, but nobody was told
  });

  it('control: mark_purchase_paid DOES notify staff (the writer that was never silent)', async () => {
    await h.asSuperuser();
    const [{ id: unpaidPurchase }] = await h.q<{ id: string }>(
      `insert into purchases (org_id, buyer_contact_id, status, amount, amount_paid, payment_status)
         values ($1,$2,'awaiting_payment',150.00,0,'unpaid') returning id`, [org, contact]);
    const before = await paidNotificationCount();
    await h.q(`select mark_purchase_paid($1, 150.00, null, 'cash')`, [unpaidPurchase]);
    const after = await paidNotificationCount();
    expect(after).toBeGreaterThan(before);
  });
});

describe('AFTER the migration — one spine', () => {
  beforeAll(async () => { await applyMigration(MIGRATION); });

  it('a booking created already-paid now notifies staff, same as mark_purchase_paid', async () => {
    await h.asSuperuser();
    const before = await paidNotificationCount();
    const purchaseId = await provisionPaid('post-fix proof');
    const after = await paidNotificationCount();
    expect(after).toBeGreaterThan(before);

    const [row] = await h.q<{ title: string; link: string }>(
      `select title, link from notifications where kind = 'payment_received' order by created_at desc limit 1`);
    expect(row.link).toBe('/app/ops/payments/review');
    expect(row.title).toContain('Payment received');

    const [pur] = await h.q<{ status: string; payment_status: string }>(
      `select status, payment_status from purchases where id = $1`, [purchaseId]);
    expect(pur.status).toBe('paid');
    expect(pur.payment_status).toBe('paid');
  });

  it('mark_purchase_paid keeps notifying (unchanged, still routed through the shared helper)', async () => {
    await h.asSuperuser();
    const [{ id: unpaidPurchase }] = await h.q<{ id: string }>(
      `insert into purchases (org_id, buyer_contact_id, status, amount, amount_paid, payment_status)
         values ($1,$2,'awaiting_payment',150.00,0,'unpaid') returning id`, [org, contact]);
    const before = await paidNotificationCount();
    const status = await h.q<{ mark_purchase_paid: string }>(
      `select mark_purchase_paid($1, 150.00, null, 'zelle') as mark_purchase_paid`, [unpaidPurchase]);
    expect(status[0].mark_purchase_paid).toBe('paid');
    const after = await paidNotificationCount();
    expect(after).toBeGreaterThan(before);
  });

  it('an already-paid purchase is a no-op (unchanged short-circuit)', async () => {
    await h.asSuperuser();
    const purchaseId = await provisionPaid('already paid, second call proof');
    const status = await h.q<{ mark_purchase_paid: string }>(
      `select mark_purchase_paid($1, 150.00, null, 'zelle') as mark_purchase_paid`, [purchaseId]);
    expect(status[0].mark_purchase_paid).toBe('already_paid');
  });
});
