/**
 * U17 — Settlement roll-up: billable_lines -> transactions
 * (migration 20260630140000_settlement_rollup.sql). Module: core.payments.
 *
 * Real-path data test (Wiring & Verification Contract §15(1)): every assertion
 * exercises the ACTUAL RPC the app calls (settle_billable_lines) as the CORRECT
 * RLS role (org staff), and proves the summed charge lands in the RIGHT table
 * (transactions, txn_type='INVOICE') with the RIGHT columns (amount = SUM,
 * payer_contact_id, period), the source lines flip to SETTLED + stamped with the
 * new transaction_id, the seal takes hold, and the whole thing reads back.
 *
 * Covers the unit's required proofs (§7.11 / §15):
 *  - seed OPEN billable_lines from a consumption/board source, call settle → ONE
 *    transactions INVOICE created with amount = SUM(lines.amount) for the correct
 *    payer + org; lines flipped to SETTLED and stamped transaction_id.
 *  - re-run is idempotent: a second settle for the same payer/period finds no OPEN
 *    lines and creates NO second transaction (no double-invoice).
 *  - a NEW open line added after the first settle IS picked up by a later settle
 *    (the roll-up is re-runnable, not one-shot) into a distinct invoice.
 *  - cross-tenant isolation: org B's payer/lines are never rolled into org A's
 *    invoice, and an org-B call settles only org-B lines.
 *  - the settled lines are sealed (append-only) after settle, exactly like U5.
 *  - the settle is audited (audit_logs INSERT for the transaction).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // FHE (tenant #1)
let orgB: string; // Rival
let aAdmin: string, bAdmin: string;
let aUser: string; // a plain client of org A (for the not-staff denial path)
let payerA: string;   // an org-A contact who owes the charges
let payerA2: string;  // a second org-A payer (isolation within a tenant)
let payerB: string;   // an org-B contact who owes the charges
let horseA: string;   // an org-A horse tied to an engagement (engagement derivation)
let engA: string;     // the engagement whose primary_horse_id = horseA

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Settle Rival','settle-rival') returning id`))[0].id;

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
  aUser = await h.createAuthUser({ role: 'USER', org: orgA });

  await h.asSuperuser();
  // payer contacts (a contact is the billable_lines.payer_contact_id). Seed as
  // superuser so we control org membership explicitly.
  payerA = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name) values ($1, 'Payer', 'A') returning id`, [orgA]))[0].id;
  payerA2 = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name) values ($1, 'Payer', 'A2') returning id`, [orgA]))[0].id;
  payerB = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name) values ($1, 'Payer', 'B') returning id`, [orgB]))[0].id;

  // an org-A horse tied to an engagement whose client is payerA — so the settle's
  // engagement-derivation (line.horse_id -> engagement.primary_horse_id) has a
  // single shared engagement to stamp onto the invoice.
  horseA = (await h.q<{ id: string }>(
    `insert into horses (org_id, barn_name) values ($1,'Comet') returning id`, [orgA]))[0].id;
  const clientA = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [orgA, payerA]))[0].id;
  engA = (await h.q<{ id: string }>(
    `insert into engagements (org_id, client_id, service_type, primary_horse_id)
       values ($1,$2,'HORSE_TRAINING',$3) returning id`, [orgA, clientA, horseA]))[0].id;
});

afterAll(async () => {
  await h?.close();
});

// small helper: seed an OPEN billable_line as org-A staff (the real emit path)
async function seedLineA(
  payer: string,
  amount: number,
  opts: { source_kind?: string; horse_id?: string | null; period?: string | null } = {},
) {
  const { source_kind = 'consumption', horse_id = null, period = null } = opts;
  const [row] = await h.q<{ id: string }>(
    `insert into billable_lines (payer_contact_id, source_kind, amount, horse_id, period, status)
       values ($1,$2,$3,$4,$5::tstzrange,'OPEN') returning id`,
    [payer, source_kind, amount, horse_id, period],
  );
  return row.id;
}

// ---------------------------------------------------------------------------
// core roll-up: OPEN lines -> ONE transactions INVOICE, lines SETTLED + stamped
// ---------------------------------------------------------------------------
describe('settle_billable_lines: rolls OPEN lines into one INVOICE (real RPC path)', () => {
  let txnId: string;

  it('creates ONE transactions INVOICE with amount = SUM for the correct payer + org', async () => {
    await h.asUser(aAdmin);
    // seed three OPEN lines from consumption/board sources for payerA (two share the
    // engagement via horseA; totals must sum across all three).
    await seedLineA(payerA, 40.0, { source_kind: 'consumption', horse_id: horseA });
    await seedLineA(payerA, 60.5, { source_kind: 'board', horse_id: horseA });
    await seedLineA(payerA, 10.25, { source_kind: 'fee' });

    // call the ACTUAL RPC the app uses, as org-A staff
    const [res] = await h.q<{ transaction_id: string; amount: string; lines_settled: number }>(
      `select * from settle_billable_lines($1, NULL)`, [payerA]);
    expect(res.transaction_id).not.toBeNull();
    expect(Number(res.amount)).toBeCloseTo(110.75, 2);
    expect(Number(res.lines_settled)).toBe(3);
    txnId = res.transaction_id;

    // the row LANDED in transactions with the RIGHT columns
    await h.asSuperuser();
    const [txn] = await h.q<{
      org_id: string; txn_type: string; amount: string;
      payer_contact_id: string; engagement_id: string | null; status: string;
    }>(
      `select org_id, txn_type, amount, payer_contact_id, engagement_id, status
         from transactions where id=$1`, [txnId]);
    expect(txn.org_id).toBe(orgA);
    expect(txn.txn_type).toBe('INVOICE');
    expect(Number(txn.amount)).toBeCloseTo(110.75, 2);
    expect(txn.payer_contact_id).toBe(payerA);
    // engagement derivation: the two horse-tied lines share exactly one engagement,
    // but the third (fee, no horse) does not tie to it → NOT a single shared
    // engagement across ALL rolled lines → engagement_id is NULL.
    expect(txn.engagement_id).toBeNull();
  });

  it('flips every rolled line to SETTLED and stamps it with the new transaction_id', async () => {
    await h.asSuperuser();
    const lines = await h.q<{ status: string; transaction_id: string }>(
      `select status, transaction_id from billable_lines where payer_contact_id=$1`, [payerA]);
    expect(lines).toHaveLength(3);
    expect(lines.every((l) => l.status === 'SETTLED')).toBe(true);
    expect(lines.every((l) => l.transaction_id === txnId)).toBe(true);
  });

  it('audits the settle (audit_logs INSERT for the new transaction)', async () => {
    await h.asSuperuser();
    const [audit] = await h.q<{ n: string }>(
      `select count(*) as n from audit_logs
         where table_name='transactions' and record_id=$1 and action='INSERT'`, [txnId]);
    expect(Number(audit.n)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// single shared engagement -> stamped onto the invoice
// ---------------------------------------------------------------------------
describe('settle_billable_lines: stamps the shared engagement when all lines tie to one', () => {
  it('sets engagement_id when EVERY rolled line ties to the same engagement', async () => {
    await h.asUser(aAdmin);
    // both lines charge against horseA → both resolve to engA; no un-tied line.
    await seedLineA(payerA2, 15.0, { source_kind: 'consumption', horse_id: horseA });
    await seedLineA(payerA2, 25.0, { source_kind: 'board', horse_id: horseA });

    const [res] = await h.q<{ transaction_id: string; amount: string }>(
      `select * from settle_billable_lines($1, NULL)`, [payerA2]);
    expect(Number(res.amount)).toBeCloseTo(40.0, 2);

    await h.asSuperuser();
    const [txn] = await h.q<{ engagement_id: string | null }>(
      `select engagement_id from transactions where id=$1`, [res.transaction_id]);
    expect(txn.engagement_id).toBe(engA);
  });
});

// ---------------------------------------------------------------------------
// idempotency / re-runnable
// ---------------------------------------------------------------------------
describe('settle_billable_lines: idempotent + re-runnable', () => {
  it('a re-run for the same payer creates NO second invoice (settled lines skipped)', async () => {
    await h.asSuperuser();
    const before = (await h.q<{ n: string }>(
      `select count(*) as n from transactions where txn_type='INVOICE' and payer_contact_id=$1`, [payerA]))[0];

    await h.asUser(aAdmin);
    const [res] = await h.q<{ transaction_id: string | null; amount: string; lines_settled: number }>(
      `select * from settle_billable_lines($1, NULL)`, [payerA]);
    // no OPEN lines left → no-op: null txn, zero sum, zero lines
    expect(res.transaction_id).toBeNull();
    expect(Number(res.amount)).toBe(0);
    expect(Number(res.lines_settled)).toBe(0);

    await h.asSuperuser();
    const after = (await h.q<{ n: string }>(
      `select count(*) as n from transactions where txn_type='INVOICE' and payer_contact_id=$1`, [payerA]))[0];
    expect(Number(after.n)).toBe(Number(before.n)); // unchanged — no double-invoice
  });

  it('a NEW open line added after settle IS rolled by a later settle (distinct invoice)', async () => {
    await h.asUser(aAdmin);
    await seedLineA(payerA, 5.0, { source_kind: 'fee' });
    const [res] = await h.q<{ transaction_id: string; amount: string; lines_settled: number }>(
      `select * from settle_billable_lines($1, NULL)`, [payerA]);
    expect(res.transaction_id).not.toBeNull();
    expect(Number(res.amount)).toBeCloseTo(5.0, 2);
    expect(Number(res.lines_settled)).toBe(1);

    // the first invoice + this second invoice both exist and are distinct
    await h.asSuperuser();
    const invoices = await h.q<{ id: string; amount: string }>(
      `select id, amount from transactions where txn_type='INVOICE' and payer_contact_id=$1 order by amount`, [payerA]);
    expect(invoices).toHaveLength(2);
    expect(new Set(invoices.map((i) => i.id)).size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// period scoping
// ---------------------------------------------------------------------------
describe('settle_billable_lines: period scoping', () => {
  it('only rolls lines whose period is contained in the settle window', async () => {
    await h.asSuperuser();
    const janPayer = (await h.q<{ id: string }>(
      `insert into contacts (org_id, first_name, last_name) values ($1, 'Period', 'Payer') returning id`, [orgA]))[0].id;
    await h.asUser(aAdmin);
    // one line in January, one in February
    await seedLineA(janPayer, 100.0, { source_kind: 'board', period: '[2026-01-01,2026-02-01)' });
    await seedLineA(janPayer, 200.0, { source_kind: 'board', period: '[2026-02-01,2026-03-01)' });

    // settle only the January window
    const [res] = await h.q<{ transaction_id: string; amount: string; lines_settled: number }>(
      `select * from settle_billable_lines($1, '[2026-01-01,2026-02-01)'::tstzrange)`, [janPayer]);
    expect(Number(res.amount)).toBeCloseTo(100.0, 2);
    expect(Number(res.lines_settled)).toBe(1);

    // the February line stays OPEN, and a later Feb settle picks it up
    await h.asUser(aAdmin);
    const [res2] = await h.q<{ amount: string; lines_settled: number }>(
      `select * from settle_billable_lines($1, '[2026-02-01,2026-03-01)'::tstzrange)`, [janPayer]);
    expect(Number(res2.amount)).toBeCloseTo(200.0, 2);
    expect(Number(res2.lines_settled)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// cross-tenant isolation
// ---------------------------------------------------------------------------
describe('settle_billable_lines: tenant isolation', () => {
  it('org-A settle never rolls org-B lines; org-B settle rolls only org-B lines', async () => {
    // seed an OPEN line for payerB under org B (as org-B staff)
    await h.asUser(bAdmin);
    const [blB] = await h.q<{ id: string }>(
      `insert into billable_lines (payer_contact_id, source_kind, amount, status)
         values ($1,'consumption', 777.00, 'OPEN') returning id`, [payerB]);

    // org-A admin calling settle for payerB (a foreign contact) settles NOTHING:
    // the line is org B's, filtered out by the org boundary in the RPC.
    await h.asUser(aAdmin);
    const [aTry] = await h.q<{ transaction_id: string | null; lines_settled: number }>(
      `select * from settle_billable_lines($1, NULL)`, [payerB]);
    expect(aTry.transaction_id).toBeNull();
    expect(Number(aTry.lines_settled)).toBe(0);

    // the org-B line is still OPEN and unstamped
    await h.asSuperuser();
    const [stillOpen] = await h.q<{ status: string; transaction_id: string | null }>(
      `select status, transaction_id from billable_lines where id=$1`, [blB.id]);
    expect(stillOpen.status).toBe('OPEN');
    expect(stillOpen.transaction_id).toBeNull();

    // org-B admin settles it → org-B INVOICE for org B only
    await h.asUser(bAdmin);
    const [bRes] = await h.q<{ transaction_id: string; amount: string }>(
      `select * from settle_billable_lines($1, NULL)`, [payerB]);
    expect(Number(bRes.amount)).toBeCloseTo(777.0, 2);

    await h.asSuperuser();
    const [bTxn] = await h.q<{ org_id: string; txn_type: string }>(
      `select org_id, txn_type from transactions where id=$1`, [bRes.transaction_id]);
    expect(bTxn.org_id).toBe(orgB);
    expect(bTxn.txn_type).toBe('INVOICE');

    // and the org-B line is now SETTLED + stamped
    const [nowSettled] = await h.q<{ status: string; transaction_id: string }>(
      `select status, transaction_id from billable_lines where id=$1`, [blB.id]);
    expect(nowSettled.status).toBe('SETTLED');
    expect(nowSettled.transaction_id).toBe(bRes.transaction_id);
  });
});

// ---------------------------------------------------------------------------
// authorization: a non-staff client cannot settle
// ---------------------------------------------------------------------------
describe('settle_billable_lines: only org staff may settle', () => {
  it('a plain USER (client) is denied (has_staff_access() guard)', async () => {
    await h.asUser(aUser);
    await expect(
      h.q(`select * from settle_billable_lines($1, NULL)`, [payerA]),
    ).rejects.toThrow(/staff access/i);
  });
});

// ---------------------------------------------------------------------------
// the settled lines are sealed (append-only) after settle — mirrors U5
// ---------------------------------------------------------------------------
describe('settle_billable_lines: rolled lines are sealed (append-only)', () => {
  it('a line settled by the RPC cannot be un-settled or re-amounted', async () => {
    await h.asSuperuser();
    const payerSeal = (await h.q<{ id: string }>(
      `insert into contacts (org_id, first_name, last_name) values ($1, 'Seal', 'Payer') returning id`, [orgA]))[0].id;
    await h.asUser(aAdmin);
    const blId = await seedLineA(payerSeal, 33.0, { source_kind: 'lesson' });
    await h.q(`select * from settle_billable_lines($1, NULL)`, [payerSeal]);

    // now SETTLED via the RPC → the U5 seal blocks substantive UPDATE + DELETE
    await expect(
      h.q(`update billable_lines set amount=1.00 where id=$1`, [blId]),
    ).rejects.toThrow(/append-only|settled/i);
    await expect(
      h.q(`update billable_lines set status='OPEN' where id=$1`, [blId]),
    ).rejects.toThrow(/append-only|settled/i);
    await expect(
      h.q(`delete from billable_lines where id=$1`, [blId]),
    ).rejects.toThrow(/append-only|settled/i);
  });
});
