/**
 * Barn Ops & Inventory cost-attribution ledger
 * (U11, migration 20260630100000_mod_barnops) — module mod.barnops.
 *
 * Real-path data tests (Wiring & Verification Contract §15.1(1) + §15.2 critical
 * chain #4): every assertion exercises the ACTUAL tables/RPC the app uses
 * (resources, resource_lots, consumption_events, cost_allocation_rules,
 * resolve_consumption_billing, billable_lines, has_module/require_module) as the
 * CORRECT RLS role, and asserts rows land in the RIGHT table with the RIGHT columns
 * and read back.
 *
 * Tenants:
 *   orgON  = a tenant with mod.barnops + mod.horserecords ON (source ADDON). The
 *            ledger needs horse_parties (mod.horserecords) as its payer source.
 *   orgA   = FHE (tenant #1, tier.lesson_brokerage) — mod.barnops is OFF.
 *
 * Covers, per the U11 spec:
 *  - org_boundary + module_gate: a barnops-OFF org (orgA) sees ZERO rows and cannot
 *    INSERT even as ADMIN; require_module raises when the module is off.
 *  - consumption_events rejects UPDATE and DELETE (DUMB + APPEND-ONLY).
 *  - resolve_consumption_billing is deterministic/idempotent (re-run yields the SAME
 *    lines), splits an event owner/lessee/barn per rules into billable_lines, the
 *    shares sum to 100 or route the remainder to the barn/default payer, and NEVER
 *    silently drops an uncovered event.
 *  - the explicit cost_allocation_rules override wins over the horse_parties split.
 *  - tenant isolation: orgON's lines never leak to orgA and vice-versa.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgON: string;  // mod.barnops + mod.horserecords ON
let orgA: string;   // FHE (tenant #1) — mod.barnops OFF

let onAdmin: string; // ADMIN of orgON
let aAdmin: string;  // ADMIN of orgA (module off)

// orgON domain rows.
let feedRes: string;      // a 'feed' resource
let feedLot: string;      // a purchased lot of it (unit_cost 2.00)
let splitHorse: string;   // horse split owner 60 / lessee 40 via horse_parties
let overrideHorse: string;// horse whose split is overridden to trainer 100%
let shortHorse: string;   // horse whose horse_parties shares sum to 60 → 40 to barn
let noPartyHorse: string; // horse with NO horse_parties rows → 100% to barn

let ownerContact: string;   // owner of splitHorse (60%)
let lesseeContact: string;  // lessee of splitHorse (40%)
let trainerContact: string; // override payer for overrideHorse
let barnContact: string;    // the default/barn payer

/** Run SQL as superuser (RLS bypassed) with app.current_org pinned to `org`. */
async function asSuperInOrg<T = Record<string, unknown>>(org: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org',$1,false)`, [org]);
  return h.q<T>(sql, params);
}

/** A period covering all seeded events. */
const PERIOD = `[2026-06-01 00:00:00+00,2026-07-01 00:00:00+00)`;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgON = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Barn Ops Stables','barnops') returning id`))[0].id;

  // Grant mod.barnops + mod.horserecords to orgON (source ADDON); orgA is left OFF.
  await asSuperInOrg(orgON,
    `insert into org_modules (org_id, module_key, enabled, source)
       values ($1,'mod.barnops',true,'ADDON'), ($1,'mod.horserecords',true,'ADDON')`, [orgON]);

  onAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgON });
  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });

  // ---- orgON contacts (payers) ----
  ownerContact = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into contacts (full_name, email) values ('Owner O','owner@on.test') returning id`))[0].id;
  lesseeContact = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into contacts (full_name, email) values ('Lessee L','lessee@on.test') returning id`))[0].id;
  trainerContact = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into contacts (full_name, email) values ('Trainer T','trainer@on.test') returning id`))[0].id;
  barnContact = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into contacts (full_name, email) values ('The Barn','barn@on.test') returning id`))[0].id;

  // ---- orgON horses ----
  splitHorse = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into horses (barn_name) values ('Split') returning id`))[0].id;
  overrideHorse = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into horses (barn_name) values ('Override') returning id`))[0].id;
  shortHorse = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into horses (barn_name) values ('Short') returning id`))[0].id;
  noPartyHorse = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into horses (barn_name) values ('Orphan') returning id`))[0].id;

  // ---- horse_parties shares (the single source of truth for the split) ----
  // splitHorse: owner 60 / lessee 40 → sums to 100.
  await asSuperInOrg(orgON,
    `insert into horse_parties (org_id, horse_id, contact_id, role, share_pct, effective_from)
       values ($1,$2,$3,'owner',60,'2026-01-01'), ($1,$2,$4,'lessee',40,'2026-01-01')`,
    [orgON, splitHorse, ownerContact, lesseeContact]);
  // overrideHorse: horse_parties says owner 100, but an override will redirect to trainer.
  await asSuperInOrg(orgON,
    `insert into horse_parties (org_id, horse_id, contact_id, role, share_pct, effective_from)
       values ($1,$2,$3,'owner',100,'2026-01-01')`, [orgON, overrideHorse, ownerContact]);
  // shortHorse: owner 60 only → 40 remainder must route to the barn/default payer.
  await asSuperInOrg(orgON,
    `insert into horse_parties (org_id, horse_id, contact_id, role, share_pct, effective_from)
       values ($1,$2,$3,'owner',60,'2026-01-01')`, [orgON, shortHorse, ownerContact]);
  // noPartyHorse: intentionally NO horse_parties rows.

  // ---- default/barn payer + the explicit override rule ----
  await asSuperInOrg(orgON,
    `insert into cost_allocation_rules (org_id, scope, payer_contact_id, share_pct)
       values ($1,'default',$2,100)`, [orgON, barnContact]);
  await asSuperInOrg(orgON,
    `insert into cost_allocation_rules (org_id, scope, scope_id, payer_contact_id, share_pct, effective_from)
       values ($1,'horse',$2,$3,100,'2026-01-01')`, [orgON, overrideHorse, trainerContact]);

  // ---- resource + lot (unit_cost 2.00) ----
  feedRes = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into resources (org_id, resource_key, name, category, unit_of_measure)
       values ($1,'hay','Timothy Hay','feed','flake') returning id`, [orgON]))[0].id;
  feedLot = (await asSuperInOrg<{ id: string }>(orgON,
    `insert into resource_lots (org_id, resource_id, qty_purchased, unit_cost, on_hand, purchased_at)
       values ($1,$2,100,2.00,100,'2026-06-01') returning id`, [orgON, feedRes]))[0].id;

  // ---- consumption events (DUMB facts) as orgON ADMIN via the REAL RLS path ----
  // 10 flakes to splitHorse → amount 20.00, split 12/8 owner/lessee.
  await h.asUser(onAdmin);
  await h.q(
    `insert into consumption_events (resource_id, resource_lot_id, horse_id, qty, occurred_at, notes)
       values ($1,$2,$3,10,'2026-06-10','am feed')`, [feedRes, feedLot, splitHorse]);
  // 5 flakes to overrideHorse → amount 10.00, override → trainer 100%.
  await h.q(
    `insert into consumption_events (resource_id, resource_lot_id, horse_id, qty, occurred_at)
       values ($1,$2,$3,5,'2026-06-11')`, [feedRes, feedLot, overrideHorse]);
  // 10 flakes to shortHorse → amount 20.00, owner 60% + barn 40%.
  await h.q(
    `insert into consumption_events (resource_id, resource_lot_id, horse_id, qty, occurred_at)
       values ($1,$2,$3,10,'2026-06-12')`, [feedRes, feedLot, shortHorse]);
  // 3 flakes to noPartyHorse → amount 6.00, 100% to barn (uncovered → default, not dropped).
  await h.q(
    `insert into consumption_events (resource_id, resource_lot_id, horse_id, qty, occurred_at)
       values ($1,$2,$3,3,'2026-06-13')`, [feedRes, feedLot, noPartyHorse]);
});

afterAll(async () => { await h?.close(); });

// ------------------------------------------------------------------
describe('module gate — a barnops-OFF org (orgA / FHE) sees & writes nothing', () => {
  it('orgA ADMIN sees ZERO resources / lots / events / rules (gate ANDs to false)', async () => {
    await h.asUser(aAdmin);
    expect(await h.q(`select id from resources`)).toHaveLength(0);
    expect(await h.q(`select id from resource_lots`)).toHaveLength(0);
    expect(await h.q(`select id from consumption_events`)).toHaveLength(0);
    expect(await h.q(`select id from cost_allocation_rules`)).toHaveLength(0);
  });

  it('orgA ADMIN cannot INSERT a resource (module gate WITH CHECK denies)', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into resources (resource_key, name, category) values ('x','X','feed')`),
    ).rejects.toThrow();
  });

  it('orgA ADMIN cannot INSERT a consumption_event either', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into consumption_events (resource_id, qty) values ($1,1)`, [feedRes]),
    ).rejects.toThrow();
  });

  it('has_module(mod.barnops) is ON for orgON, OFF for orgA', async () => {
    await h.asUser(onAdmin);
    expect((await h.q<{ ok: boolean }>(`select has_module('mod.barnops') as ok`))[0].ok).toBe(true);
    await h.asUser(aAdmin);
    expect((await h.q<{ ok: boolean }>(`select has_module('mod.barnops') as ok`))[0].ok).toBe(false);
  });

  it('require_module raises for the barnops-OFF org — resolve_consumption_billing denied', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`select resolve_consumption_billing($1::tstzrange)`, [PERIOD]),
    ).rejects.toThrow(/module .* is not enabled/);
  });
});

// ------------------------------------------------------------------
describe('real-path insert — orgON, right table/columns, reads back', () => {
  it('the seeded resource lands with its columns (category CHECK, org_id default)', async () => {
    await h.asUser(onAdmin);
    const [row] = await h.q<{ category: string; unit_of_measure: string; is_consumable: boolean; org_id: string }>(
      `select category, unit_of_measure, is_consumable, org_id from resources where id=$1`, [feedRes]);
    expect(row.category).toBe('feed');
    expect(row.unit_of_measure).toBe('flake');
    expect(row.is_consumable).toBe(true);
    expect(row.org_id).toBe(orgON);
  });

  it('a consumption_event reads back with org_id defaulted to the caller tenant', async () => {
    await h.asUser(onAdmin);
    const [row] = await h.q<{ org_id: string; qty: string; horse_id: string }>(
      `select org_id, qty, horse_id from consumption_events where horse_id=$1`, [splitHorse]);
    expect(row.org_id).toBe(orgON);        // seam 1: org_id defaulted to caller tenant
    expect(Number(row.qty)).toBe(10);
    expect(row.horse_id).toBe(splitHorse);
  });
});

// ------------------------------------------------------------------
describe('consumption_events is DUMB + APPEND-ONLY (REVOKE UPDATE/DELETE)', () => {
  it('an ADMIN UPDATE of a consumption_event is rejected (append-only)', async () => {
    await h.asUser(onAdmin);
    await expect(
      h.q(`update consumption_events set qty = 999 where horse_id=$1`, [splitHorse]),
    ).rejects.toThrow();
  });

  it('an ADMIN DELETE of a consumption_event is rejected (append-only)', async () => {
    await h.asUser(onAdmin);
    await expect(
      h.q(`delete from consumption_events where horse_id=$1`, [splitHorse]),
    ).rejects.toThrow();
  });
});

// ------------------------------------------------------------------
describe('resolve_consumption_billing — splits, sums-to-100, remainder→barn, no drops', () => {
  it('emits billable_lines per payer (source_kind=consumption) into the RIGHT table', async () => {
    await h.asUser(onAdmin);
    const [{ resolve_consumption_billing: n }] = await h.q<{ resolve_consumption_billing: number }>(
      `select resolve_consumption_billing($1::tstzrange)`, [PERIOD]);
    // splitHorse: 2 lines (owner+lessee); override: 1 (trainer); short: 2 (owner+barn);
    // noParty: 1 (barn) → 6 lines total.
    expect(Number(n)).toBe(6);

    const rows = await h.q<{ payer_contact_id: string; amount: string; horse_id: string; source_kind: string; source_id: string }>(
      `select payer_contact_id, amount, horse_id, source_kind, source_id
         from billable_lines where source_kind='consumption' order by amount desc`);
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.source_kind === 'consumption')).toBe(true);
    // every line references a real consumption event (never a dropped/orphan attribution).
    expect(rows.every((r) => r.source_id)).toBe(true);
  });

  it('splitHorse (owner 60 / lessee 40) splits 20.00 → owner 12.00, lessee 8.00 (sums to 100%)', async () => {
    await h.asUser(onAdmin);
    const owner = await h.q<{ amount: string }>(
      `select amount from billable_lines where source_kind='consumption' and horse_id=$1 and payer_contact_id=$2`,
      [splitHorse, ownerContact]);
    const lessee = await h.q<{ amount: string }>(
      `select amount from billable_lines where source_kind='consumption' and horse_id=$1 and payer_contact_id=$2`,
      [splitHorse, lesseeContact]);
    expect(owner).toHaveLength(1);
    expect(lessee).toHaveLength(1);
    expect(Number(owner[0].amount)).toBe(12.0);
    expect(Number(lessee[0].amount)).toBe(8.0);
    expect(Number(owner[0].amount) + Number(lessee[0].amount)).toBe(20.0);
  });

  it('overrideHorse: the explicit cost_allocation_rules override WINS over horse_parties', async () => {
    await h.asUser(onAdmin);
    // trainer gets 100% (10.00); the owner (horse_parties) gets NOTHING for this horse.
    const trainer = await h.q<{ amount: string }>(
      `select amount from billable_lines where source_kind='consumption' and horse_id=$1 and payer_contact_id=$2`,
      [overrideHorse, trainerContact]);
    const owner = await h.q(
      `select id from billable_lines where source_kind='consumption' and horse_id=$1 and payer_contact_id=$2`,
      [overrideHorse, ownerContact]);
    expect(trainer).toHaveLength(1);
    expect(Number(trainer[0].amount)).toBe(10.0);
    expect(owner).toHaveLength(0);
  });

  it('shortHorse (owner 60 only): remainder 40% routes to the barn/default payer (never dropped)', async () => {
    await h.asUser(onAdmin);
    // amount 20.00 → owner 12.00, barn 8.00 (the 40% remainder).
    const owner = await h.q<{ amount: string }>(
      `select amount from billable_lines where source_kind='consumption' and horse_id=$1 and payer_contact_id=$2`,
      [shortHorse, ownerContact]);
    const barn = await h.q<{ amount: string }>(
      `select amount from billable_lines where source_kind='consumption' and horse_id=$1 and payer_contact_id=$2`,
      [shortHorse, barnContact]);
    expect(Number(owner[0].amount)).toBe(12.0);
    expect(Number(barn[0].amount)).toBe(8.0);
  });

  it('noPartyHorse (no override, no shares): the whole event routes to barn — NOT dropped', async () => {
    await h.asUser(onAdmin);
    const barn = await h.q<{ amount: string }>(
      `select amount from billable_lines where source_kind='consumption' and horse_id=$1 and payer_contact_id=$2`,
      [noPartyHorse, barnContact]);
    expect(barn).toHaveLength(1);
    expect(Number(barn[0].amount)).toBe(6.0);   // 3 flakes * 2.00 * 100%
  });
});

// ------------------------------------------------------------------
describe('resolve_consumption_billing is deterministic / idempotent (re-run = same lines)', () => {
  it('a second run for the same period yields the SAME lines (no double-billing)', async () => {
    await h.asUser(onAdmin);
    const before = await h.q<{ n: string; total: string }>(
      `select count(*)::text n, coalesce(sum(amount),0)::text total
         from billable_lines where source_kind='consumption'`);

    // re-run.
    const [{ resolve_consumption_billing: n2 }] = await h.q<{ resolve_consumption_billing: number }>(
      `select resolve_consumption_billing($1::tstzrange)`, [PERIOD]);
    expect(Number(n2)).toBe(6);

    const after = await h.q<{ n: string; total: string }>(
      `select count(*)::text n, coalesce(sum(amount),0)::text total
         from billable_lines where source_kind='consumption'`);
    expect(after[0].n).toBe(before[0].n);          // same count — not doubled
    expect(Number(after[0].total)).toBe(Number(before[0].total));  // same total money
    // sanity: total = 20 (split) + 10 (override) + 20 (short) + 6 (noParty) = 56.00
    expect(Number(after[0].total)).toBe(56.0);
  });

  it('a SETTLED consumption line is preserved across a re-run (sealed, not re-emitted)', async () => {
    // settle one OPEN line as superuser (past RLS), then re-run; it must survive.
    await asSuperInOrg(orgON,
      `update billable_lines set status='SETTLED'
         where source_kind='consumption' and horse_id=$1 and payer_contact_id=$2`,
      [noPartyHorse, barnContact]);

    await h.asUser(onAdmin);
    await h.q(`select resolve_consumption_billing($1::tstzrange)`, [PERIOD]);

    // the SETTLED line is still there, untouched by the re-run's OPEN-only delete.
    const settled = await h.q<{ status: string; amount: string }>(
      `select status, amount from billable_lines
         where source_kind='consumption' and horse_id=$1 and payer_contact_id=$2 and status='SETTLED'`,
      [noPartyHorse, barnContact]);
    expect(settled).toHaveLength(1);
    expect(Number(settled[0].amount)).toBe(6.0);
  });
});

// ------------------------------------------------------------------
describe('tenant isolation — orgON lines never leak to orgA', () => {
  it('orgA ADMIN sees ZERO consumption billable_lines (boundary ANDs across tenants)', async () => {
    await h.asUser(aAdmin);
    const rows = await h.q(`select id from billable_lines where source_kind='consumption'`);
    expect(rows).toHaveLength(0);
  });

  it('orgON ADMIN sees only its own consumption lines, all stamped org_id=orgON', async () => {
    await h.asUser(onAdmin);
    const rows = await h.q<{ org_id: string }>(
      `select org_id from billable_lines where source_kind='consumption'`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.org_id === orgON)).toBe(true);
  });
});
