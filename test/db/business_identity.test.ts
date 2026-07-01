/**
 * Phase 3 — business identity seed (migration 20).
 *
 * Confirms the business_config singleton is seeded from the website brand and
 * that generate_document resolves the FHE signature tokens from it (no per-test
 * override), so generated contracts carry the FHE signature block.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
});
afterAll(async () => {
  await h?.close();
});

describe('business identity seed', () => {
  it('seeds only the business name; deliberately stores no mailing address', async () => {
    const [cfg] = await h.q<{ legal_entity_name: string; signatory_name: string; business_address: string | null }>(
      `select legal_entity_name, signatory_name, business_address from business_config`);
    expect(cfg.legal_entity_name).toBe('French Heritage Equestrian');
    expect(cfg.signatory_name).toBe('French Heritage Equestrian');
    expect(cfg.business_address).toBeNull(); // private; never seeded
  });

  it('generate_document resolves FHE.* from the seed', async () => {
    const serviceType = (await h.q<{ code: string }>(`select code from service_types limit 1`))[0].code;
    const c = (await h.q<{ id: string }>(`insert into contacts (full_name) values ('Acme Stables') returning id`))[0].id;
    const cl = (await h.q<{ id: string }>(`insert into clients (contact_id) values ($1) returning id`, [c]))[0].id;
    const eng = (await h.q<{ id: string }>(
      `insert into engagements (client_id, service_type) values ($1,$2) returning id`, [cl, serviceType]))[0].id;

    const [doc] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'HORSE_PURCHASE_SALE')`, [eng]);
    expect(doc.merged_body).toContain('French Heritage Equestrian'); // signatory name resolved
    expect(doc.merged_body).not.toMatch(/\{\{FHE\./); // FHE tokens all resolved (title → blank)
    expect(doc.merged_body).not.toContain('Windemere'); // no mailing address anywhere
  });
});
