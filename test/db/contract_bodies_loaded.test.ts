/**
 * Phase 2 — contract bodies loaded into the database (migration 17, regenerated
 * for the owner's 2026-07-03 template revision).
 *
 * Verifies the generated loader:
 *  - the 18 source-backed templates have a body (18 .md files → 18 keys; the
 *    horse-care release is a single RELEASE_HORSE_CARE.md — owner 2026-07-05
 *    unified it, RELEASE_HORSE_EXERCISE retired via 20260705000000); the
 *    templates without a source doc are NULL,
 *  - per-template template_tokens are derived (concrete tokens linked to template_id),
 *  - derivation is faithful both ways: every derived token appears in its body, and
 *    every {{token}} in a body has a derived row.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

const WITH_BODY = [
  'HORSE_PURCHASE_SALE', 'HORSE_SALE_TRANSFER', 'HORSE_LEASE',
  'HORSE_SEARCH_RETAINER', 'HORSE_EVALUATION', 'HORSE_TRAINING', 'HORSE_EXERCISE',
  'HORSEMANSHIP_TRAINING', 'RIDER_LESSON_JUMPER', 'HORSE_EMERGENCY_VET',
  'HUMAN_EMERGENCY_MEDICAL', 'FACILITY_RULES',
  // the standalone liability releases (liability-release pass; horse-care
  // unified under RELEASE_HORSE_CARE — RELEASE_HORSE_EXERCISE retired 2026-07-05)
  'RELEASE_GENERAL', 'RELEASE_PARTICIPANT', 'RELEASE_HORSE_CARE',
  // contract-module decomposition: the side-scoped transaction-rep module
  'HORSE_TRANSACTION_REP',
  // owner revision 2026-07-03: Company Policies + the lesson order form
  'COMPANY_POLICIES', 'RIDER_LESSON',
];
// HORSE_REPRESENTATION: retired by the decomposition (folded into the finder's
// lease directions) — row kept inactive, source .md deleted, body cleared.
// MINOR_RIDER: retired by the 2026-07-03 revision (minors ride in CUT-marker
// sections of the CLIENT-signer docs) — no source .md, so the regenerated
// loader never loads its body (the migration-11 seed row stays body-NULL).
// RELEASE_HORSE_EXERCISE: retired 2026-07-05 (horse-care release unified under
// RELEASE_HORSE_CARE) — row kept inactive/soft-deleted for referential history,
// source .md deleted, so its body is no longer loaded.
const NO_SOURCE = ['INDEPENDENT_CONTRACTOR', 'MEDIA_RELEASE', 'FACILITY_LICENSE', 'HORSE_REPRESENTATION', 'MINOR_RIDER', 'RELEASE_HORSE_EXERCISE'];

let h: TestDb;
beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
});
afterAll(async () => {
  await h?.close();
});

describe('bodies loaded', () => {
  it('the 18 source-backed templates have a body; those without a source are NULL', async () => {
    const rows = await h.q<{ template_key: string; has_body: boolean }>(
      `select template_key, (body is not null) as has_body from contract_templates`);
    const map = Object.fromEntries(rows.map((r) => [r.template_key, r.has_body]));
    for (const k of WITH_BODY) expect(map[k], `${k} should have a body`).toBe(true);
    for (const k of NO_SOURCE) expect(map[k], `${k} should be NULL`).toBe(false);
  });

  it('signature tokens are left in the body unmerged (rendered by signing)', async () => {
    const body = (await h.q<{ body: string }>(
      `select body from contract_templates where template_key='HORSE_PURCHASE_SALE'`))[0].body;
    expect(body).toContain('{{BUYER.FULL_NAME}}');
    expect(body).toContain('{{SIG.SELLER.NAME}}');
  });
});

describe('per-template tokens derived', () => {
  it('records each contract’s concrete party tokens linked to its template', async () => {
    const rows = await h.q<{ token: string }>(
      `select tt.token from template_tokens tt
       join contract_templates ct on ct.id = tt.template_id
       where ct.template_key = 'HORSE_PURCHASE_SALE'`);
    const tokens = new Set(rows.map((r) => r.token));
    expect(tokens.has('{{BUYER.FULL_NAME}}')).toBe(true);
    expect(tokens.has('{{SELLER.FULL_NAME}}')).toBe(true);
    expect(tokens.has('{{HORSE.BREED}}')).toBe(true);
  });

  it('derived tokens are faithful both ways for every loaded body', async () => {
    const templates = await h.q<{ id: string; template_key: string; body: string }>(
      `select id, template_key, body from contract_templates where body is not null`);
    for (const t of templates) {
      const inBody = new Set(t.body.match(/\{\{[A-Z0-9_.]+\}\}/g) ?? []);
      const derived = new Set(
        (await h.q<{ token: string }>(`select token from template_tokens where template_id=$1`, [t.id]))
          .map((r) => r.token));
      // every derived token is actually in the body
      for (const tok of derived) expect(inBody.has(tok), `${t.template_key}: ${tok} not in body`).toBe(true);
      // every token in the body was derived
      for (const tok of inBody) expect(derived.has(tok), `${t.template_key}: ${tok} not derived`).toBe(true);
    }
  });

  it('left the global dictionary rows untouched', async () => {
    const n = (await h.q<{ c: string }>(`select count(*) c from template_tokens where template_id is null`))[0].c;
    expect(Number(n)).toBeGreaterThanOrEqual(40);
  });
});
