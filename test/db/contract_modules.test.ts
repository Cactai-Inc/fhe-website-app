/**
 * Contract-module decomposition (20260701080000 + reworked template bodies) —
 * CONTRACT_MODULE_ARCHITECTURE verification.
 *
 * Proves:
 *  - DIRECTIONAL MERGES: the ONE tokenized HORSE_SEARCH_RETAINER (service
 *    HORSE_FINDER) renders the right terminology for all four directions —
 *    find-to-buy / find-to-lease / find-a-buyer / find-a-lessee — driven by the
 *    engagement's CURRENT stage (engagement_stages.retained_by + deal_side) via
 *    template_variants; no {{DIR.*}} survives a merge,
 *  - MODULE SEPARABILITY: the search document generates standalone — no
 *    transactions row, no evaluation or transaction-rep document required,
 *  - STAGED REVENUE CHAIN: each module's fee token lives in its own body
 *    (retainer + success/acquisition in the finder; per-horse evaluation fee in
 *    the evaluation agreement; representation fee in the transaction-rep
 *    agreement) and resolves from its own transactions column,
 *  - create_purchase_engagement records the buyer/BUY TRANSACTION_REP stage, so
 *    the side-scoped HORSE_TRANSACTION_REP merges purchase-side terminology,
 *  - HORSE_REPRESENTATION is retired (inactive → generate_document rejects it).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestDb, type TestDb } from './harness';

const BODIES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/contract_templates');

let h: TestDb;
let org1: string; // tenant #1 (FHE) — identity seeded by 20260701010000

/** Create a CLIENT-party engagement on tenant #1, optionally with a stage row. */
async function mkEngagement(opts: {
  service: string;
  name: string;
  stage?: { stage: string; retained_by: string; deal_side: string };
  horse?: boolean;
}): Promise<string> {
  await h.asSuperuser();
  const [cFirst, ...cRest] = opts.name.split(' ');
  const contact = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name, phone, email)
     values ($1,$2,$3,'619-555-0142',$4) returning id`,
    [org1, cFirst, cRest.join(' ') || null,
     `${opts.name.toLowerCase().replace(/[^a-z]/g, '')}@example.com`]))[0].id;
  const clientId = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org1, contact]))[0].id;
  let horseId: string | null = null;
  if (opts.horse) {
    const breed = (await h.q<{ code: string }>(`select code from horse_breeds order by code limit 1`))[0].code;
    horseId = (await h.q<{ id: string }>(
      `insert into horses (org_id, registered_name, breed, sex, current_location)
       values ($1,'Module Star',$2,'MARE','Carmel Creek Ranch') returning id`, [org1, breed]))[0].id;
  }
  const engId = (await h.q<{ id: string }>(
    `insert into engagements (org_id, client_id, service_type, primary_horse_id, start_date)
     values ($1,$2,$3,$4,'2026-07-01') returning id`, [org1, clientId, opts.service, horseId]))[0].id;
  await h.q(
    `insert into engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
     values ($1,$2,$3,'CLIENT',true,1)`, [org1, engId, contact]);
  if (opts.stage) {
    await h.q(
      `insert into engagement_stages (org_id, engagement_id, stage, retained_by, deal_side, status)
       values ($1,$2,$3,$4,$5,'OPEN')`,
      [org1, engId, opts.stage.stage, opts.stage.retained_by, opts.stage.deal_side]);
  }
  return engId;
}

async function merge(engId: string, templateKey: string): Promise<string> {
  const [row] = await h.q<{ merged_body: string }>(
    `select * from generate_document($1,$2)`, [engId, templateKey]);
  return row.merged_body;
}

/** Every leftover token must be a live signature token. */
function expectOnlySigTokens(body: string) {
  for (const t of body.match(/\{\{[A-Z0-9_.]+\}\}/g) ?? []) {
    expect(t, `unexpected unmerged token ${t}`).toMatch(/^\{\{SIG\./);
  }
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org1 = (await h.q<{ id: string }>(
    `select id from organizations order by created_at limit 1`))[0].id;
});

afterAll(async () => {
  await h?.close();
});

// ============================================================
// Layer 1 — the four directional variants of the ONE finder template
// ============================================================
describe('HORSE_SEARCH_RETAINER — directional merges from the current stage', () => {
  const cases: Array<{
    label: string; retained_by: string; deal_side: string; expects: string[];
  }> = [
    { label: 'find a horse to buy', retained_by: 'buyer', deal_side: 'BUY',
      expects: ['as buyer', 'a horse', 'prospective purchase'] },
    { label: 'find a horse to lease', retained_by: 'lessee', deal_side: 'LEASE_IN',
      expects: ['as lessee', 'a horse', 'prospective lease (lessee)'] },
    { label: 'find a buyer', retained_by: 'owner', deal_side: 'SELL',
      expects: ['as owner', 'a buyer', 'prospective sale'] },
    { label: 'find a lessee', retained_by: 'owner', deal_side: 'LEASE_OUT',
      expects: ['as owner', 'a lessee', 'prospective lease (lessor)'] },
  ];

  for (const c of cases) {
    it(`${c.label} (${c.retained_by}/${c.deal_side}) renders the right terminology`, async () => {
      const eng = await mkEngagement({
        service: 'HORSE_FINDER', name: `Finder ${c.deal_side}`,
        stage: { stage: 'SEARCH', retained_by: c.retained_by, deal_side: c.deal_side },
      });
      const body = await merge(eng, 'HORSE_SEARCH_RETAINER');
      for (const s of c.expects) expect(body, c.label).toContain(s);
      expect(body).not.toMatch(/\{\{DIR\./);
      expectOnlySigTokens(body);
    });
  }

  it('the four directions produce four DIFFERENT documents from the one template', async () => {
    const bodies: string[] = [];
    for (const c of cases) {
      const eng = await mkEngagement({
        service: 'HORSE_FINDER', name: `Distinct ${c.retained_by} ${c.deal_side}`,
        stage: { stage: 'SEARCH', retained_by: c.retained_by, deal_side: c.deal_side },
      });
      bodies.push(await merge(eng, 'HORSE_SEARCH_RETAINER'));
    }
    // compare the ENGAGEMENT section only (owner body 2026-07-03: §1 carries the
    // merged DIR role/target/direction wording but no per-engagement client name)
    const engagementSection = (b: string) =>
      b.slice(b.indexOf('1. ENGAGEMENT'), b.indexOf('2. SEARCH PARAMETERS'));
    const sections = bodies.map(engagementSection);
    expect(new Set(sections).size).toBe(4);
  });

  it('explicit no-result AND no-consummation terms are present (owner body §3)', async () => {
    // Owner revision 2026-07-03: the recital block became section
    // "3. NO GUARANTEE OF RESULTS OR CONSUMMATION" — same two guarantees
    // disclaimed (no result; no consummation), new phrasing.
    const eng = await mkEngagement({
      service: 'HORSE_FINDER', name: 'Recital Check',
      stage: { stage: 'SEARCH', retained_by: 'buyer', deal_side: 'BUY' },
    });
    const body = await merge(eng, 'HORSE_SEARCH_RETAINER');
    expect(body).toContain('NO GUARANTEE OF RESULTS OR CONSUMMATION');
    expect(body).toContain('does not guarantee that the search will locate a horse or any suitable match');
    expect(body).toContain('A search may end with no result, and a successful result may still end with no transaction');
  });
});

// ============================================================
// Module separability — the search stands alone
// ============================================================
describe('module separability', () => {
  it('the search document generates with NO transactions row and no other module document', async () => {
    const eng = await mkEngagement({
      service: 'HORSE_FINDER', name: 'Standalone Searcher',
      stage: { stage: 'SEARCH', retained_by: 'buyer', deal_side: 'BUY' },
    });
    // deliberately NO transactions row, NO evaluation / transaction-rep document
    const body = await merge(eng, 'HORSE_SEARCH_RETAINER');
    expectOnlySigTokens(body); // fee tokens merged blank, not left dangling
    const docs = await h.q<{ title: string }>(
      `select title from documents where engagement_id=$1`, [eng]);
    expect(docs).toHaveLength(1); // the search retainer is the ONLY document
    expect(docs[0].title).toBe('Horse Finder Search and Sourcing Retainer Agreement');
  });

  it('an evaluation generates standalone too (singular engagement shape)', async () => {
    const eng = await mkEngagement({
      service: 'HORSE_EVALUATION', name: 'Eval Only', horse: true,
      stage: { stage: 'EVALUATION', retained_by: 'buyer', deal_side: 'BUY' },
    });
    const body = await merge(eng, 'HORSE_EVALUATION');
    // owner body 2026-07-03: the evaluation module is an order form
    expect(body).toContain('HORSE EVALUATION REQUEST');
    expect(body).toContain('Module Star'); // the per-horse scope binds to THE horse
    expect(body).toContain('ONLY the single horse identified below');
    expectOnlySigTokens(body);
  });
});

// ============================================================
// Staged revenue chain — one fee token per module, each resolving
// ============================================================
describe('staged revenue chain — fee tokens live in their own modules', () => {
  it('file-level placement: each module fee token appears ONLY in its module body', async () => {
    const files = readdirSync(BODIES_DIR).filter((f) => f.endsWith('.md'));
    const bodies = Object.fromEntries(
      files.map((f) => [f.replace(/\.md$/, ''), readFileSync(join(BODIES_DIR, f), 'utf8')]));
    const placement: Record<string, string> = {
      '{{TXN.RETAINER_FEE}}': 'HORSE_SEARCH_RETAINER',
      '{{TXN.SUCCESS_FEE}}': 'HORSE_SEARCH_RETAINER',
      '{{TXN.EVALUATION_FEE}}': 'HORSE_EVALUATION',
      '{{TXN.REPRESENTATION_FEE}}': 'HORSE_TRANSACTION_REP',
    };
    for (const [token, home] of Object.entries(placement)) {
      const carriers = Object.keys(bodies).filter((k) => bodies[k].includes(token));
      expect(carriers, token).toEqual([home]);
    }
  });

  it('search module: flat retainer AND contingent success/acquisition fee resolve', async () => {
    const eng = await mkEngagement({
      service: 'HORSE_FINDER', name: 'Fee Searcher',
      stage: { stage: 'SEARCH', retained_by: 'buyer', deal_side: 'BUY' },
    });
    await h.q(
      `insert into transactions (org_id, engagement_id, txn_type, retainer_fee, success_fee)
       values ($1,$2,'PURCHASE',1500,4500)`, [org1, eng]);
    const body = await merge(eng, 'HORSE_SEARCH_RETAINER');
    expect(body).toContain('Search Retainer (flat fee): $1,500.00');
    expect(body).toContain('Success Fee / Acquisition Fee (contingent): $4,500.00');
  });

  it('evaluation module: the per-horse evaluation fee resolves', async () => {
    const eng = await mkEngagement({
      service: 'HORSE_EVALUATION', name: 'Fee Evaluator', horse: true,
      stage: { stage: 'EVALUATION', retained_by: 'owner', deal_side: 'SELL' },
    });
    await h.q(
      `insert into transactions (org_id, engagement_id, txn_type, evaluation_fee)
       values ($1,$2,'SALE',350)`, [org1, eng]);
    const body = await merge(eng, 'HORSE_EVALUATION');
    expect(body).toContain('Evaluation Fee (per horse): $350.00');
    // transaction context is directional (owner selling → sale)
    expect(body).toContain('Prospective transaction (if applicable): sale');
    expectOnlySigTokens(body);
  });

  it('transaction-rep module: the representation fee resolves, side-scoped', async () => {
    const eng = await mkEngagement({
      service: 'HORSE_LEASE_IN_ASSISTANCE', name: 'Fee Represented', horse: true,
      stage: { stage: 'TRANSACTION_REP', retained_by: 'lessee', deal_side: 'LEASE_IN' },
    });
    await h.q(
      `insert into transactions (org_id, engagement_id, txn_type, representation_fee)
       values ($1,$2,'LEASE',900)`, [org1, eng]);
    const body = await merge(eng, 'HORSE_TRANSACTION_REP');
    expect(body).toContain('Representation Fee: $900.00');
    // our client's side and the unrepresented counterparty, token-driven
    // (owner body 2026-07-03 §1: "CLIENT, as <role> in a prospective <direction>")
    expect(body).toContain('CLIENT, as lessee');
    expect(body).toContain('prospective lease (as lessee)');
    expect(body).toContain('The lessor is not represented by COMPANY');
    expect(body).not.toMatch(/\{\{DIR\./);
    expectOnlySigTokens(body);
  });
});

// ============================================================
// Layer 2 via the real RPC path — purchase engagements carry the stage
// ============================================================
describe('create_purchase_engagement — records the buyer/BUY TRANSACTION_REP stage', () => {
  it('the RPC opens the stage and HORSE_TRANSACTION_REP merges purchase-side terms', async () => {
    await h.asSuperuser();
    const admin = await h.createAuthUser({ role: 'ADMIN', org: org1 });
    const buyer = (await h.q<{ id: string }>(
      `insert into contacts (org_id, first_name, last_name, email) values ($1, 'Bart', 'Buyer', 'bart@example.com') returning id`, [org1]))[0].id;

    await h.asUser(admin);
    const eng = (await h.q<{ create_purchase_engagement: string }>(
      `select create_purchase_engagement($1)`, [buyer]))[0].create_purchase_engagement;

    await h.asSuperuser();
    const stages = await h.q<{ stage: string; retained_by: string; deal_side: string }>(
      `select stage, retained_by, deal_side from engagement_stages where engagement_id=$1`, [eng]);
    expect(stages).toEqual([{ stage: 'TRANSACTION_REP', retained_by: 'buyer', deal_side: 'BUY' }]);

    const body = await merge(eng, 'HORSE_TRANSACTION_REP');
    expect(body).toContain('CLIENT, as buyer');
    expect(body).toContain('prospective purchase');
    expect(body).toContain('The seller is not represented by COMPANY');
    expect(body).not.toMatch(/\{\{DIR\./);
  });
});

// ============================================================
// HORSE_REPRESENTATION — retired into the finder's lease directions
// ============================================================
describe('HORSE_REPRESENTATION is retired', () => {
  it('the row is kept (referential integrity) but inactive with no body', async () => {
    await h.asSuperuser();
    const [row] = await h.q<{ active: boolean; body: string | null }>(
      `select active, body from contract_templates where template_key='HORSE_REPRESENTATION'`);
    expect(row.active).toBe(false);
    expect(row.body).toBeNull();
  });

  it('generate_document rejects it as inactive', async () => {
    const eng = await mkEngagement({
      service: 'HORSE_FINDER', name: 'Retired Rep',
      stage: { stage: 'SEARCH', retained_by: 'lessee', deal_side: 'LEASE_IN' },
    });
    await expect(h.q(`select * from generate_document($1,'HORSE_REPRESENTATION')`, [eng]))
      .rejects.toThrow(/unknown or inactive contract template/);
  });

  it('the lease direction of the finder covers the folded-in representation bundle', async () => {
    const eng = await mkEngagement({
      service: 'HORSE_FINDER', name: 'Lease Seeker',
      stage: { stage: 'SEARCH', retained_by: 'lessee', deal_side: 'LEASE_IN' },
    });
    const body = await merge(eng, 'HORSE_SEARCH_RETAINER');
    expect(body).toContain('prospective lease (lessee)');
    expect(body).toContain('locating a horse for a prospective buyer or lessee');
  });
});
