/**
 * E2E-CONSUMPTION (critical chain #4, FEATURE_BUILD_PLAN §E2E), mod.barnops:
 * resources/lots → consumption_events (dumb, append-only facts) →
 * resolve_consumption_billing (deterministic attribution) → billable_lines →
 * settle_billable_lines → ONE transactions INVOICE roll-up per payer.
 *
 * Real-path: a barnops-entitled tenant's ADMIN drives every step through the
 * actual tables/RPCs under RLS; tenant #1 (barnops OFF) proves the module gate
 * and cross-tenant isolation on both billable_lines and the INVOICE.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgON: string;  // tenant with mod.barnops + mod.horserecords
let orgA: string;   // FHE (tenant #1) — barnops OFF
let onAdmin: string;
let aAdmin: string;

let feedRes: string;
let feedLot: string;        // unit_cost 2.00
let splitHorse: string;     // owner 60 / lessee 40 via horse_parties
let orphanHorse: string;    // no parties → 100% to the barn/default payer

let ownerContact: string;
let lesseeContact: string;
let barnContact: string;

let ownerInvoice: string;   // the settled INVOICE transaction id

const PERIOD = `[2026-06-01 00:00:00+00,2026-07-01 00:00:00+00)`;

/** Superuser (RLS bypassed) with app.current_org pinned to `org` — seed context. */
async function asSuperInOrg<T = Record<string, unknown>>(org: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org',$1,false)`, [org]);
  return h.q<T>(sql, params);
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgON = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('E2E Consumption Barn','e2e-consumption') returning id`))[0].id;

  await asSuperInOrg(orgON,
    `insert into org_modules (org_id, module_key, enabled, source)
       values ($1,'mod.barnops',true,'ADDON'), ($1,'mod.horserecords',true,'ADDON')`, [orgON]);

  onAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgON });
  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });

  ownerContact = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into contacts (first_name, last_name, email) values ('Olive', 'Owner', 'olive@e2e.test') returning id`))[0].id;
  lesseeContact = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into contacts (first_name, last_name, email) values ('Lee', 'Lessee', 'lee@e2e.test') returning id`))[0].id;
  barnContact = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into contacts (first_name, last_name, email) values ('The', 'Barn', 'barn@e2e.test') returning id`))[0].id;

  splitHorse = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into horses (barn_name) values ('SplitE2E') returning id`))[0].id;
  orphanHorse = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into horses (barn_name) values ('OrphanE2E') returning id`))[0].id;

  // horse_parties: the single source of truth for the split (owner 60 / lessee 40).
  await asSuperInOrg(orgON,
    `insert into horse_parties (org_id, horse_id, contact_id, role, share_pct, effective_from)
       values ($1,$2,$3,'owner',60,'2026-01-01'), ($1,$2,$4,'lessee',40,'2026-01-01')`,
    [orgON, splitHorse, ownerContact, lesseeContact]);

  // the default/barn payer — uncovered consumption routes here, never dropped.
  await asSuperInOrg(orgON,
    `insert into cost_allocation_rules (org_id, scope, payer_contact_id, share_pct)
       values ($1,'default',$2,100)`, [orgON, barnContact]);
});

afterAll(async () => { await h?.close(); });

describe('chain 4 — resources/lots + append-only consumption facts (staff, under RLS)', () => {
  it('staff catalogs the resource and its purchased lot', async () => {
    await h.asUser(onAdmin);
    feedRes = (await h.q<{ id: string }>(
      `insert into resources (resource_key, name, category, unit_of_measure)
         values ('e2e-hay','Timothy Hay','feed','flake') returning id`))[0].id;
    feedLot = (await h.q<{ id: string }>(
      `insert into resource_lots (resource_id, qty_purchased, unit_cost, on_hand, purchased_at)
         values ($1,100,2.00,100,'2026-06-01') returning id`, [feedRes]))[0].id;

    const [lot] = await h.q<{ org_id: string; unit_cost: string }>(
      `select org_id, unit_cost from resource_lots where id=$1`, [feedLot]);
    expect(lot.org_id).toBe(orgON);       // org_id defaulted to the caller's tenant
    expect(Number(lot.unit_cost)).toBe(2);
  });

  it('staff logs the dumb consumption facts (no money on the event)', async () => {
    await h.asUser(onAdmin);
    // splitHorse: 10 + 5 flakes → 20.00 + 10.00; orphanHorse: 3 flakes → 6.00
    await h.q(
      `insert into consumption_events (resource_id, resource_lot_id, horse_id, qty, occurred_at, notes)
         values ($1,$2,$3,10,'2026-06-10','am feed'), ($1,$2,$3,5,'2026-06-15','pm feed')`,
      [feedRes, feedLot, splitHorse]);
    await h.q(
      `insert into consumption_events (resource_id, resource_lot_id, horse_id, qty, occurred_at)
         values ($1,$2,$3,3,'2026-06-20')`, [feedRes, feedLot, orphanHorse]);
    const rows = await h.q<{ org_id: string }>(`select org_id from consumption_events`);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.org_id === orgON)).toBe(true);
  });

  it('the facts are APPEND-ONLY (UPDATE and DELETE rejected)', async () => {
    await h.asUser(onAdmin);
    await expect(h.q(`update consumption_events set qty=999`)).rejects.toThrow();
    await expect(h.q(`delete from consumption_events`)).rejects.toThrow();
  });

  it('the module gate holds: tenant #1 (barnops OFF) cannot even call the resolver', async () => {
    await h.asUser(aAdmin);
    expect(await h.q(`select id from resources`)).toHaveLength(0);
    await expect(
      h.q(`select resolve_consumption_billing($1::tstzrange)`, [PERIOD]),
    ).rejects.toThrow(/not enabled/i);
  });
});

describe('chain 4 — resolve_consumption_billing → billable_lines (deterministic)', () => {
  it('emits the per-payer split lines: owner 12+6, lessee 8+4, barn 6 (nothing dropped)', async () => {
    await h.asUser(onAdmin);
    const [{ resolve_consumption_billing: n }] = await h.q<{ resolve_consumption_billing: number }>(
      `select resolve_consumption_billing($1::tstzrange)`, [PERIOD]);
    expect(Number(n)).toBe(5); // 2 events × (owner+lessee) + 1 orphan → barn

    const sums = await h.q<{ payer_contact_id: string; total: string; n: string }>(
      `select payer_contact_id, sum(amount)::text as total, count(*)::text as n
         from billable_lines where source_kind='consumption'
        group by payer_contact_id`);
    const byPayer = Object.fromEntries(sums.map((r) => [r.payer_contact_id, r]));
    expect(Number(byPayer[ownerContact].total)).toBe(18.0);   // 60% of 30.00
    expect(Number(byPayer[ownerContact].n)).toBe(2);
    expect(Number(byPayer[lesseeContact].total)).toBe(12.0);  // 40% of 30.00
    expect(Number(byPayer[barnContact].total)).toBe(6.0);     // uncovered → barn
  });

  it('re-running the resolver for the same period is idempotent (same lines, same money)', async () => {
    await h.asUser(onAdmin);
    await h.q(`select resolve_consumption_billing($1::tstzrange)`, [PERIOD]);
    const [{ n, total }] = await h.q<{ n: string; total: string }>(
      `select count(*)::text as n, sum(amount)::text as total
         from billable_lines where source_kind='consumption'`);
    expect(Number(n)).toBe(5);
    expect(Number(total)).toBe(36.0);
  });
});

describe('chain 4 — settle_billable_lines → the transactions INVOICE roll-up', () => {
  it('rolls the owner\'s OPEN lines into ONE INVOICE (amount = SUM), lines SETTLED + stamped', async () => {
    await h.asUser(onAdmin);
    const [res] = await h.q<{ transaction_id: string; amount: string; lines_settled: number }>(
      `select * from settle_billable_lines($1, $2::tstzrange)`, [ownerContact, PERIOD]);
    ownerInvoice = res.transaction_id;
    expect(ownerInvoice).not.toBeNull();
    expect(Number(res.amount)).toBe(18.0);
    expect(Number(res.lines_settled)).toBe(2);

    await h.asSuperuser();
    const [txn] = await h.q<{ org_id: string; txn_type: string; amount: string; payer_contact_id: string; status: string }>(
      `select org_id, txn_type, amount, payer_contact_id, status from transactions where id=$1`, [ownerInvoice]);
    expect(txn.org_id).toBe(orgON);
    expect(txn.txn_type).toBe('INVOICE');
    expect(Number(txn.amount)).toBe(18.0);
    expect(txn.payer_contact_id).toBe(ownerContact);
    expect(txn.status).toBe('POSTED');

    const lines = await h.q<{ status: string; transaction_id: string }>(
      `select status, transaction_id from billable_lines
        where source_kind='consumption' and payer_contact_id=$1`, [ownerContact]);
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.status === 'SETTLED' && l.transaction_id === ownerInvoice)).toBe(true);
  });

  it('settled lines are SEALED (append-only) and the settle is audited', async () => {
    await h.asUser(onAdmin);
    await expect(
      h.q(`update billable_lines set amount=0
            where payer_contact_id=$1 and status='SETTLED'`, [ownerContact]),
    ).rejects.toThrow();
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: string }>(
      `select count(*)::text as n from audit_logs
        where table_name='transactions' and record_id=$1 and action='INSERT'`, [ownerInvoice]);
    expect(Number(n)).toBe(1);
  });

  it('a re-settle for the same payer/period is an idempotent no-op — NO second invoice', async () => {
    await h.asUser(onAdmin);
    const [res] = await h.q<{ transaction_id: string | null; amount: string; lines_settled: number }>(
      `select * from settle_billable_lines($1, $2::tstzrange)`, [ownerContact, PERIOD]);
    expect(res.transaction_id).toBeNull();
    expect(Number(res.amount)).toBe(0);
    expect(Number(res.lines_settled)).toBe(0);
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: string }>(
      `select count(*)::text as n from transactions
        where txn_type='INVOICE' and payer_contact_id=$1`, [ownerContact]);
    expect(Number(n)).toBe(1);
  });

  it('the other payers settle into their OWN invoices (lessee 12.00, barn 6.00)', async () => {
    await h.asUser(onAdmin);
    const [lessee] = await h.q<{ transaction_id: string; amount: string }>(
      `select * from settle_billable_lines($1, NULL)`, [lesseeContact]);
    expect(Number(lessee.amount)).toBe(12.0);
    const [barn] = await h.q<{ transaction_id: string; amount: string }>(
      `select * from settle_billable_lines($1, NULL)`, [barnContact]);
    expect(Number(barn.amount)).toBe(6.0);
    expect(lessee.transaction_id).not.toBe(ownerInvoice);
    expect(barn.transaction_id).not.toBe(lessee.transaction_id);
  });

  it('ISOLATION: tenant #1 sees NONE of orgON\'s lines or invoices', async () => {
    await h.asUser(aAdmin);
    expect(await h.q(`select id from billable_lines where source_kind='consumption'`)).toHaveLength(0);
    expect(await h.q(`select id from transactions where txn_type='INVOICE'`)).toHaveLength(0);
  });
});
