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
let bAdmin: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Lesson Only Barn','lesson-only') returning id`))[0].id;

  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });

  // org B gets a LESSONS-only entitlement (NO mod.brokerage) so the module-gate/deny path is real.
  await h.asSuperuser();
  await h.q(
    `insert into org_modules (org_id, module_key, enabled, source) values ($1,'mod.lessons',true,'TIER')`,
    [orgB]);

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
// REMOVED by TASK-TESTDB — three describe blocks and their helpers covered
// `engagement_stages` and the create_search_engagement / create_lease_engagement
// / create_purchase_engagement RPCs.
//
// CLAUDE.md, RETIRED — do not resurrect:
//   "Tables/concepts: engagements, orders, client_purchases, lesson_sessions,
//    transactions, contact_roles (now groups), ..."
//
// Verified against the live database: engagement_stages and engagements are both
// dropped, and all three create_*_engagement functions return GONE. These tested
// a brokerage engagement layer that no longer exists, so they were deleted rather
// than repointed. The template_variants coverage above is retained — that table is
// still live and still global.
// ============================================================
