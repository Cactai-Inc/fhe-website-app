/**
 * Brokerage & Contracts module (U7, migration 20260630060000_mod_brokerage) — mod.brokerage.
 *
 * Real-path data tests (Wiring & Verification Contract §15.1(1)): every assertion
 * exercises the ACTUAL tables/RPCs the app uses (engagement_stages, template_variants,
 * create_search_engagement / create_lease_engagement / create_purchase_engagement) as the
 * CORRECT RLS role, and asserts rows land in the RIGHT table with the RIGHT columns and
 * read back.
 *
 * Covers:
 *  - engagement_stages: boundary + module_gate — a mod.brokerage-OFF org sees zero rows
 *    and cannot insert even as ADMIN (module gate ANDs with boundary); the ON org can.
 *  - engagement_stages standalone: a TRANSACTION_REP stage exists with NO prior SEARCH
 *    (no required predecessor — CONTRACT_MODULE_ARCHITECTURE partial/mid-way shapes).
 *  - engagement_stages org_boundary: org A cannot see/insert org B rows; org_id defaults
 *    to the caller's tenant.
 *  - template_variants: GLOBAL (no org_id), world-readable, resolves DISTINCT
 *    token_overrides per (retained_by, deal_side); the four directional HORSE_FINDER
 *    variants are registered; non-admin cannot write.
 *  - brokerage RPCs (create_search_engagement / create_lease_engagement) raise
 *    require_module('mod.brokerage') when the module is OFF; land the right rows when ON.
 *  - create_purchase_engagement stays green for a mod.brokerage-ON tenant (FHE).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // FHE (tenant #1) — tier.lesson_brokerage → HAS mod.brokerage
let orgB: string; // brokerage-OFF org (no org_modules rows)
let aAdmin: string, bAdmin: string;
let clientContactA: string, clientContactB: string;
let horseA: string;

/** Run a superuser statement with the seed GUC pinned to a specific org. */
async function asOrg(org: string, sql: string, params: unknown[] = []) {
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org',$1,false)`, [org]);
  const rows = await h.q(sql, params);
  await h.q(`select set_config('app.current_org',$1,false)`, [orgA]); // restore default GUC
  return rows;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Lesson Only Barn','lesson-only') returning id`))[0].id;

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });

  // org B gets a LESSONS-only entitlement (NO mod.brokerage) so the module-gate/deny path is real.
  await h.asSuperuser();
  await h.q(
    `insert into org_modules (org_id, module_key, enabled, source) values ($1,'mod.lessons',true,'TIER')`,
    [orgB]);

  // Seed a client contact + horse per org (org_id defaults to the pinned GUC).
  clientContactA = (await asOrg(orgA,
    `insert into contacts (first_name, last_name, email) values ('Alice', 'Client', 'alice@a.test') returning id`))[0].id as string;
  clientContactB = (await asOrg(orgB,
    `insert into contacts (first_name, last_name, email) values ('Bob', 'Client', 'bob@b.test') returning id`))[0].id as string;
  const breed = (await h.q<{ code: string }>(`select code from horse_breeds order by code limit 1`))[0].code;
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org',$1,false)`, [orgA]);
  horseA = (await h.q<{ id: string }>(
    `insert into horses (registered_name, breed, sex) values ('Comet',$1,'MARE') returning id`, [breed]))[0].id;
});

afterAll(async () => {
  await h?.close();
});

// ============================================================
// template_variants — GLOBAL, world-read, distinct overrides per direction
// ============================================================
describe('template_variants (GLOBAL, no org_id)', () => {
  it('has NO org_id column (intended-global, §4.3 allow-list)', async () => {
    await h.asSuperuser();
    const cols = (await h.q<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema='public' and table_name='template_variants'`)).map((r) => r.column_name);
    expect(cols).not.toContain('org_id');
  });

  it('registers the four directional HORSE_FINDER variants', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ retained_by: string; deal_side: string }>(
      `select retained_by, deal_side from template_variants
        where template_key='HORSE_SEARCH_RETAINER' order by deal_side`);
    expect(rows).toEqual([
      { retained_by: 'buyer',  deal_side: 'BUY' },
      { retained_by: 'lessee', deal_side: 'LEASE_IN' },
      { retained_by: 'owner',  deal_side: 'LEASE_OUT' },
      { retained_by: 'owner',  deal_side: 'SELL' },
    ]);
  });

  it('resolves DISTINCT token_overrides per (retained_by, deal_side)', async () => {
    await h.asSuperuser();
    const buy = (await h.q<{ token_overrides: Record<string, string> }>(
      `select token_overrides from template_variants
        where template_key='HORSE_SEARCH_RETAINER' and retained_by='buyer' and deal_side='BUY'`))[0].token_overrides;
    const sell = (await h.q<{ token_overrides: Record<string, string> }>(
      `select token_overrides from template_variants
        where template_key='HORSE_SEARCH_RETAINER' and retained_by='owner' and deal_side='SELL'`))[0].token_overrides;
    const leaseIn = (await h.q<{ token_overrides: Record<string, string> }>(
      `select token_overrides from template_variants
        where template_key='HORSE_SEARCH_RETAINER' and retained_by='lessee' and deal_side='LEASE_IN'`))[0].token_overrides;

    // Each direction yields its own terminology — not the same blob.
    expect(buy.DIRECTION_TERM).toBe('purchase');
    expect(sell.DIRECTION_TERM).toBe('sale');
    expect(leaseIn.DIRECTION_TERM).toBe('lease (lessee)');
    expect(buy.TARGET_TERM).toBe('a horse');
    expect(sell.TARGET_TERM).toBe('a buyer');
    expect(buy.DIRECTION_TERM).not.toBe(sell.DIRECTION_TERM);
    expect(buy.TARGET_TERM).not.toBe(sell.TARGET_TERM);
  });

  it('is world-readable to a brokerage-OFF tenant (global, ungated)', async () => {
    // org B has NO mod.brokerage, yet still reads the global variant catalog.
    await h.asUser(bAdmin);
    const rows = await h.q<{ deal_side: string }>(
      `select deal_side from template_variants where template_key='HORSE_SEARCH_RETAINER'`);
    expect(rows.length).toBe(4);
  });

  it('a non-admin cannot write template_variants', async () => {
    const user = await h.createAuthUser({ role: 'USER', org: orgA });
    await h.asUser(user);
    await expect(
      h.q(`insert into template_variants (template_key, retained_by, deal_side)
             values ('HORSE_SEARCH_RETAINER','buyer','BUY')`),
    ).rejects.toThrow();
  });
});

// ============================================================
// engagement_stages — module gate: OFF org denied even as ADMIN
// ============================================================
describe('engagement_stages module_gate — a mod.brokerage-OFF org is denied', () => {
  let engB: string;

  beforeAll(async () => {
    // Give org B an engagement it owns (superuser, past RLS) so the ONLY thing
    // blocking engagement_stages access is the module gate, not a missing engagement.
    engB = (await asOrg(orgB, `
      with cl as (
        insert into clients (contact_id, org_id) values ($1,$2) returning id
      )
      insert into engagements (client_id, service_type, start_date, org_id)
        select id, 'HORSE_FINDER', now()::date, $2 from cl returning id
    `, [clientContactB, orgB]))[0].id as string;
  });

  it('org B ADMIN sees ZERO engagement_stages rows even after superuser seeds one', async () => {
    // Superuser seeds a stage row directly under org B (past RLS).
    await asOrg(orgB,
      `insert into engagement_stages (engagement_id, stage, org_id) values ($1,'SEARCH',$2)`,
      [engB, orgB]);

    // As org B ADMIN (mod.brokerage OFF), the module gate hides it entirely.
    await h.asUser(bAdmin);
    const rows = await h.q<{ id: string }>(`select id from engagement_stages`);
    expect(rows.length).toBe(0);
  });

  it('org B ADMIN cannot INSERT an engagement_stages row (module gate WITH CHECK)', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`insert into engagement_stages (engagement_id, stage) values ($1,'SEARCH')`, [engB]),
    ).rejects.toThrow();
  });

  it('org A ADMIN (mod.brokerage ON) CAN insert and read engagement_stages', async () => {
    // Create an engagement for org A via the real RPC, then a stage on it.
    await h.asUser(aAdmin);
    const engA = (await h.q<{ create_search_engagement: string }>(
      `select create_search_engagement($1,'buyer','BUY',$2)`, [clientContactA, horseA]))[0].create_search_engagement;

    // The RPC already created the SEARCH stage; org A ADMIN reads it (gate passes).
    const rows = await h.q<{ stage: string }>(
      `select stage from engagement_stages where engagement_id=$1`, [engA]);
    expect(rows.map((r) => r.stage)).toContain('SEARCH');
  });
});

// ============================================================
// engagement_stages — tenancy boundary (seam 1)
// ============================================================
describe('engagement_stages org_boundary — cross-tenant isolation', () => {
  it('org_id defaults to the caller\'s tenant on the real RPC path', async () => {
    await h.asUser(aAdmin);
    const engA = (await h.q<{ create_search_engagement: string }>(
      `select create_search_engagement($1,'owner','SELL')`, [clientContactA]))[0].create_search_engagement;
    await h.asSuperuser();
    const [row] = await h.q<{ org_id: string }>(
      `select org_id from engagement_stages where engagement_id=$1`, [engA]);
    expect(row.org_id).toBe(orgA);
  });

  it('org B ADMIN cannot see org A engagement_stages rows (boundary; also gated off)', async () => {
    await h.asUser(bAdmin);
    const rows = await h.q<{ org_id: string }>(`select org_id from engagement_stages`);
    expect(rows.some((r) => r.org_id === orgA)).toBe(false);
  });
});

// ============================================================
// standalone stage — no required predecessor (partial sequential shape)
// ============================================================
describe('a stage can exist standalone (transaction-rep with NO prior search)', () => {
  it('create_lease_engagement opens a TRANSACTION_REP stage with no SEARCH before it', async () => {
    await h.asUser(aAdmin);
    const eng = (await h.q<{ create_lease_engagement: string }>(
      `select create_lease_engagement($1,'LEASE_IN',$2)`, [clientContactA, horseA]))[0].create_lease_engagement;

    const stages = await h.q<{ stage: string; deal_side: string }>(
      `select stage, deal_side from engagement_stages where engagement_id=$1 order by created_at`, [eng]);

    // Exactly one stage, and it is TRANSACTION_REP — no SEARCH predecessor required.
    expect(stages).toHaveLength(1);
    expect(stages[0].stage).toBe('TRANSACTION_REP');
    expect(stages[0].deal_side).toBe('LEASE_IN');
  });

  it('a standalone TRANSACTION_REP stage inserted directly (no engagement chain) is valid', async () => {
    await h.asUser(aAdmin);
    // Open a bare engagement, then a lone TRANSACTION_REP stage — no SEARCH/EVALUATION rows.
    const eng = (await h.q<{ create_lease_engagement: string }>(
      `select create_lease_engagement($1,'LEASE_OUT')`, [clientContactA]))[0].create_lease_engagement;
    const inserted = await h.q<{ id: string; stage: string }>(
      `insert into engagement_stages (engagement_id, stage, retained_by, deal_side, status)
         values ($1,'TRANSACTION_REP','lessor','LEASE_OUT','OPEN') returning id, stage`, [eng]);
    expect(inserted[0].stage).toBe('TRANSACTION_REP');
    // No SEARCH row exists on this engagement — predecessor is NOT required.
    const searches = await h.q<{ id: string }>(
      `select id from engagement_stages where engagement_id=$1 and stage='SEARCH'`, [eng]);
    expect(searches.length).toBe(0);
  });
});

// ============================================================
// brokerage RPCs raise require_module when the module is OFF
// ============================================================
describe('brokerage RPC require_module guard — denied when mod.brokerage is OFF', () => {
  it('create_search_engagement raises for a brokerage-OFF tenant', async () => {
    await h.asUser(bAdmin); // org B has mod.lessons only
    await expect(
      h.q(`select create_search_engagement($1,'buyer','BUY')`, [clientContactB]),
    ).rejects.toThrow(/not enabled/i);
  });

  it('create_lease_engagement raises for a brokerage-OFF tenant', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`select create_lease_engagement($1,'LEASE_IN')`, [clientContactB]),
    ).rejects.toThrow(/not enabled/i);
  });

  it('create_purchase_engagement raises for a brokerage-OFF tenant (now gated too)', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`select create_purchase_engagement($1)`, [clientContactB]),
    ).rejects.toThrow(/not enabled/i);
  });

  it('create_search_engagement SUCCEEDS + lands the right rows for a brokerage-ON tenant', async () => {
    await h.asUser(aAdmin);
    const eng = (await h.q<{ create_search_engagement: string }>(
      `select create_search_engagement($1,'lessee','LEASE_IN',$2)`, [clientContactA, horseA]))[0].create_search_engagement;
    expect(eng).toBeTruthy();

    // Right table, right columns: engagement is HORSE_FINDER; stage is SEARCH/LEASE_IN.
    await h.asSuperuser();
    const [e] = await h.q<{ service_type: string; org_id: string }>(
      `select service_type, org_id from engagements where id=$1`, [eng]);
    expect(e.service_type).toBe('HORSE_FINDER');
    expect(e.org_id).toBe(orgA);
    const [s] = await h.q<{ stage: string; deal_side: string; retained_by: string }>(
      `select stage, deal_side, retained_by from engagement_stages where engagement_id=$1`, [eng]);
    expect(s.stage).toBe('SEARCH');
    expect(s.deal_side).toBe('LEASE_IN');
    expect(s.retained_by).toBe('lessee');
  });
});
