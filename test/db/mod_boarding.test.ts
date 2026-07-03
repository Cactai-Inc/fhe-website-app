/**
 * Boarding & Facility (U10, migration 20260630090000_mod_boarding) —
 * module mod.boarding.
 *
 * Real-path data tests (Wiring & Verification Contract §15.1(1)): every assertion
 * exercises the ACTUAL tables the app uses (facilities, stalls, board_agreements,
 * board_charges, billable_lines) as the CORRECT RLS role, and asserts rows land in
 * the right table with the right columns and read back.
 *
 * NOTE on entitlement: FHE (tenant #1) is tier.lesson_brokerage, which does NOT
 * grant mod.boarding — so tenant #1 is a boarding-OFF org. This test therefore
 * provisions a dedicated boarding-ON org (orgA) by inserting an org_modules row for
 * mod.boarding, and uses a second org (orgB) with NO boarding entitlement as the
 * gate/deny probe.
 *
 * Covers, per the U10 spec:
 *  - org_boundary + module_gate across all four tables: a boarding-OFF org (orgB)
 *    sees ZERO rows and cannot INSERT even as ADMIN; boarding-ON org (orgA) works.
 *  - org_id defaults to the caller's tenant on insert (seam 1).
 *  - board_agreement.board_rate DEFAULTS from config_value('BOARDING',
 *    'DEFAULT_BOARD_RATE') in the registry when omitted; an explicit rate overrides.
 *  - a board_charge writes a billable_line (source_kind='board') for the boarder,
 *    and the boarder reads its own line.
 *  - the boarder reads ONLY its own board_agreement (another boarder cannot).
 *  - board_agreements rejects a hard DELETE (REVOKE DELETE); soft-delete only.
 *  - tenant isolation: orgA staff never see orgB rows (boundary ANDs across tenants).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // boarding-ON org (org_modules: mod.boarding enabled)
let orgB: string; // boarding-OFF org (no boarding entitlement)

let aAdmin: string, bAdmin: string;
let aBoarderUser: string;   // a boarder client in org A (own agreement)
let aOtherUser: string;     // a different org A client (owns no agreement)

let aBoarderContact: string;
let aOtherContact: string;
let bContact: string;

let aFacility: string;
let aStall: string;
let aHorse: string;
let bHorse: string;
let aAgreement: string;

const DEFAULT_RATE = 850; // seeded BOARDING/DEFAULT_BOARD_RATE for orgA

async function asOrg(org: string, sql: string, params: unknown[] = []) {
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org',$1,false)`, [org]);
  const rows = await h.q(sql, params);
  await h.q(`select set_config('app.current_org',$1,false)`, [orgA]);
  return rows;
}

async function contactOf(uid: string): Promise<string> {
  const [row] = await h.q<{ contact_id: string }>(
    `select contact_id from profiles where user_id=$1`, [uid]);
  return row.contact_id;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  // orgA is a FRESH org (NOT FHE #1, which lacks mod.boarding). Give it a real
  // mod.boarding entitlement via org_modules — the enforcement source of truth.
  orgA = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Boarding Barn','boarding-barn') returning id`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Rival Stables','rival') returning id`))[0].id;

  await h.q(
    `insert into org_modules (org_id, module_key, enabled, source) values ($1,'mod.boarding',true,'TIER')`,
    [orgA]);
  // orgB intentionally gets NO org_modules row → mod.boarding OFF.

  // Seed the tenant's default board rate in the registry (config_values), so
  // board_agreements.board_rate DEFAULTs from config_value('BOARDING','DEFAULT_BOARD_RATE').
  await h.q(
    `insert into config_values (org_id, namespace, key, value_num, category)
       values ($1,'BOARDING','DEFAULT_BOARD_RATE',$2,'module_config')`,
    [orgA, DEFAULT_RATE]);

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
  aBoarderUser = await h.createAuthUser({ role: 'USER', org: orgA });
  aOtherUser = await h.createAuthUser({ role: 'USER', org: orgA });

  aBoarderContact = await contactOf(aBoarderUser);
  aOtherContact = await contactOf(aOtherUser);
  await h.asSuperuser();
  await h.q(`update contacts set org_id=$1 where id=$2`, [orgA, aBoarderContact]);
  await h.q(`update contacts set org_id=$1 where id=$2`, [orgA, aOtherContact]);

  // Horses per org (org_id defaults to the pinned GUC).
  aHorse = ((await asOrg(orgA,
    `insert into horses (barn_name) values ('Comet') returning id`)) as { id: string }[])[0].id;
  bHorse = ((await asOrg(orgB,
    `insert into horses (barn_name) values ('RivalHorse') returning id`)) as { id: string }[])[0].id;

  // org B contact (the cross-org leakage probe).
  bContact = ((await asOrg(orgB,
    `insert into contacts (first_name, last_name, email) values ('B', 'Owner', 'b-owner@rival.test') returning id`)) as { id: string }[])[0].id;

  // Seed facility + stall in org A via the REAL RLS path (not superuser), so
  // boundary + gate are exercised on WRITE.
  await h.asUser(aAdmin);
  aFacility = (await h.q<{ id: string }>(
    `insert into facilities (name, address_value_key) values ('Main Barn','ORG.ADDRESS') returning id`))[0].id;
  aStall = (await h.q<{ id: string }>(
    `insert into stalls (facility_id, code, stall_type) values ($1,'A-01','matted') returning id`,
    [aFacility]))[0].id;

  // Seed a board_agreement for the boarder, OMITTING board_rate so the registry
  // DEFAULT is exercised.
  aAgreement = (await h.q<{ id: string }>(
    `insert into board_agreements (horse_id, stall_id, boarder_contact_id, board_type, start_date, status)
       values ($1,$2,$3,'full','2026-06-01','ACTIVE') returning id`,
    [aHorse, aStall, aBoarderContact]))[0].id;
});

afterAll(async () => { await h?.close(); });

// ============================================================
// module gate — a boarding-OFF org (orgB) sees/writes nothing across all 4 tables
// ============================================================
describe('module gate — a boarding-OFF org (orgB) sees/writes nothing', () => {
  it('has_module(mod.boarding) is ON for orgA, OFF for orgB', async () => {
    await h.asUser(aAdmin);
    expect((await h.q<{ ok: boolean }>(`select has_module('mod.boarding') as ok`))[0].ok).toBe(true);
    await h.asUser(bAdmin);
    expect((await h.q<{ ok: boolean }>(`select has_module('mod.boarding') as ok`))[0].ok).toBe(false);
  });

  for (const tbl of ['facilities', 'stalls', 'board_agreements', 'board_charges']) {
    it(`orgB ADMIN sees ZERO rows in ${tbl} (module gate ANDs to false)`, async () => {
      await h.asUser(bAdmin);
      expect(await h.q(`select id from ${tbl}`)).toHaveLength(0);
    });
  }

  it('orgB ADMIN cannot INSERT a facility (module gate WITH CHECK denies)', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`insert into facilities (name) values ('Rival Facility')`),
    ).rejects.toThrow();
  });

  it('orgB ADMIN cannot INSERT a board_agreement (module gate WITH CHECK denies)', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`insert into board_agreements (horse_id, boarder_contact_id) values ($1,$2)`,
        [bHorse, bContact]),
    ).rejects.toThrow();
  });
});

// ============================================================
// real-path insert — orgA ADMIN, right table/columns, reads back + seam 1 default
// ============================================================
describe('real-path insert — orgA ADMIN, right table/columns, reads back', () => {
  it('reads back the seeded facility + stall with org_id defaulted to the tenant', async () => {
    await h.asUser(aAdmin);
    const [f] = await h.q<{ name: string; org_id: string }>(
      `select name, org_id from facilities where id=$1`, [aFacility]);
    expect(f.name).toBe('Main Barn');
    expect(f.org_id).toBe(orgA);
    const [s] = await h.q<{ code: string; org_id: string; facility_id: string }>(
      `select code, org_id, facility_id from stalls where id=$1`, [aStall]);
    expect(s.code).toBe('A-01');
    expect(s.org_id).toBe(orgA);
    expect(s.facility_id).toBe(aFacility);
  });

  it('reads back the board_agreement with its columns (seam 1 org_id default)', async () => {
    await h.asUser(aAdmin);
    const [row] = await h.q<{ status: string; org_id: string; horse_id: string; boarder_contact_id: string }>(
      `select status, org_id, horse_id, boarder_contact_id from board_agreements where id=$1`, [aAgreement]);
    expect(row.status).toBe('ACTIVE');
    expect(row.org_id).toBe(orgA);
    expect(row.horse_id).toBe(aHorse);
    expect(row.boarder_contact_id).toBe(aBoarderContact);
  });
});

// ============================================================
// board_rate defaults from the registry
// ============================================================
describe('board_agreement.board_rate DEFAULTS from the registry', () => {
  it('the omitted board_rate resolves to config_value(BOARDING, DEFAULT_BOARD_RATE)', async () => {
    await h.asUser(aAdmin);
    const [row] = await h.q<{ board_rate: string }>(
      `select board_rate from board_agreements where id=$1`, [aAgreement]);
    expect(Number(row.board_rate)).toBe(DEFAULT_RATE);
  });

  it('an explicit board_rate overrides the registry default', async () => {
    await h.asUser(aAdmin);
    await h.q(
      `insert into board_agreements (horse_id, boarder_contact_id, board_rate, status)
         values ($1,$2,1200,'ACTIVE')`,
      [aHorse, aOtherContact]);
    const [row] = await h.q<{ board_rate: string }>(
      `select board_rate from board_agreements where horse_id=$1 and boarder_contact_id=$2`,
      [aHorse, aOtherContact]);
    expect(Number(row.board_rate)).toBe(1200);
  });
});

// ============================================================
// board_charge → billable_line (source_kind='board') for the boarder
// ============================================================
describe('board_charge emits a billable_line for the boarder', () => {
  let lineId: string;
  let chargeId: string;

  it('staff creates a billable_line (source_kind=board) then a board_charge linking it', async () => {
    await h.asUser(aAdmin);
    // The board line is deterministic: rate for the period, payer = the boarder.
    lineId = (await h.q<{ id: string }>(
      `insert into billable_lines
         (payer_contact_id, source_kind, source_id, horse_id, qty, unit_amount, amount, period)
       values ($1,'board',$2,$3,1,$4,$4, tstzrange('2026-06-01','2026-07-01'))
       returning id`,
      [aBoarderContact, aAgreement, aHorse, DEFAULT_RATE]))[0].id;

    chargeId = (await h.q<{ id: string }>(
      `insert into board_charges
         (board_agreement_id, period_start, period_end, amount, billable_line_id)
       values ($1,'2026-06-01','2026-07-01',$2,$3) returning id`,
      [aAgreement, DEFAULT_RATE, lineId]))[0].id;

    // The charge landed in board_charges, linked to the real billable_line, org A.
    const [row] = await h.q<{ amount: string; org_id: string; billable_line_id: string }>(
      `select amount, org_id, billable_line_id from board_charges where id=$1`, [chargeId]);
    expect(Number(row.amount)).toBe(DEFAULT_RATE);
    expect(row.org_id).toBe(orgA);
    expect(row.billable_line_id).toBe(lineId);

    // The billable_line landed with source_kind='board' and the boarder as payer.
    const [line] = await h.q<{ source_kind: string; payer_contact_id: string; amount: string; org_id: string }>(
      `select source_kind, payer_contact_id, amount, org_id from billable_lines where id=$1`, [lineId]);
    expect(line.source_kind).toBe('board');
    expect(line.payer_contact_id).toBe(aBoarderContact);
    expect(Number(line.amount)).toBe(DEFAULT_RATE);
    expect(line.org_id).toBe(orgA);
  });

  it('the boarder reads its OWN board_charge and its OWN billable_line', async () => {
    await h.asUser(aBoarderUser);
    const charges = await h.q<{ id: string; amount: string }>(
      `select id, amount from board_charges where board_agreement_id=$1`, [aAgreement]);
    expect(charges.some((c) => c.id === chargeId)).toBe(true);

    const lines = await h.q<{ id: string; source_kind: string }>(`select id, source_kind from billable_lines`);
    expect(lines.some((l) => l.id === lineId && l.source_kind === 'board')).toBe(true);
  });

  it('a different client (not the boarder) sees NEITHER the charge NOR the line', async () => {
    await h.asUser(aOtherUser);
    // aOtherUser boards a DIFFERENT horse but is not the payer of THIS charge/line,
    // and is not the boarder on aAgreement.
    const charges = await h.q<{ id: string }>(
      `select id from board_charges where id=$1`, [chargeId]);
    expect(charges).toHaveLength(0);
    const lines = await h.q<{ id: string }>(`select id from billable_lines where id=$1`, [lineId]);
    expect(lines).toHaveLength(0);
  });
});

// ============================================================
// boarder reads ONLY its own agreement
// ============================================================
describe('boarder reads ONLY its own board_agreement', () => {
  it('the boarder sees its own agreement', async () => {
    await h.asUser(aBoarderUser);
    const rows = await h.q<{ id: string; boarder_contact_id: string }>(
      `select id, boarder_contact_id from board_agreements`);
    expect(rows.some((r) => r.id === aAgreement)).toBe(true);
    expect(rows.every((r) => r.boarder_contact_id === aBoarderContact)).toBe(true);
  });

  it('a different client does NOT see the boarder\'s agreement', async () => {
    await h.asUser(aOtherUser);
    const rows = await h.q<{ id: string }>(
      `select id from board_agreements where id=$1`, [aAgreement]);
    expect(rows).toHaveLength(0);
  });
});

// ============================================================
// board_agreements is NEVER hard-deletable (REVOKE DELETE)
// ============================================================
describe('board_agreements rejects a hard DELETE (REVOKE DELETE)', () => {
  it('an ADMIN hard DELETE is rejected (permission denied)', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`delete from board_agreements where id=$1`, [aAgreement]),
    ).rejects.toThrow();
  });

  it('soft-delete (deleted_at) is the only removal, and hides the row from the boarder', async () => {
    await h.asUser(aAdmin);
    await h.q(`update board_agreements set deleted_at=now() where id=$1`, [aAgreement]);
    await h.asUser(aBoarderUser);
    const rows = await h.q<{ id: string }>(
      `select id from board_agreements where id=$1`, [aAgreement]);
    expect(rows).toHaveLength(0);
    // restore for any later assertions / independent re-runs
    await h.asUser(aAdmin);
    await h.q(`update board_agreements set deleted_at=null where id=$1`, [aAgreement]);
  });
});

// ============================================================
// tenant isolation — orgA staff never see orgB rows
// ============================================================
describe('tenant isolation — boundary ANDs across tenants', () => {
  it('orgA staff read only orgA facilities/agreements (never orgB)', async () => {
    // seed an orgB facility as SUPERUSER (bypasses gate) so a real orgB row exists.
    await asOrg(orgB, `insert into facilities (org_id, name) values ($1,'Rival Facility')`, [orgB]);
    await h.asUser(aAdmin);
    const facs = await h.q<{ org_id: string }>(`select org_id from facilities`);
    expect(facs.length).toBeGreaterThanOrEqual(1);
    expect(facs.every((f) => f.org_id === orgA)).toBe(true);
    const ags = await h.q<{ org_id: string }>(`select org_id from board_agreements`);
    expect(ags.every((a) => a.org_id === orgA)).toBe(true);
  });

  it('orgA ADMIN cannot INSERT a facility stamped with orgB (WITH CHECK denies)', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into facilities (org_id, name) values ($1,'Cross Tenant')`, [orgB]),
    ).rejects.toThrow();
  });
});
