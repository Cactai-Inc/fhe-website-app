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
  it('seeds the sole-prop identity: Charles Zigmund signs for the DBA (Contracts Legal Pass)', async () => {
    const [cfg] = await h.q<{
      legal_entity_name: string; signatory_name: string; signatory_title: string;
      entity_formation: string; business_address: string | null; signatory_contact_id: string | null;
    }>(
      `select legal_entity_name, signatory_name, signatory_title, entity_formation,
              business_address, signatory_contact_id from business_config`);
    expect(cfg.legal_entity_name).toBe('French Heritage Equestrian'); // trade name / DBA
    expect(cfg.signatory_name).toBe('Charles Zigmund'); // a human signs, not the DBA itself
    expect(cfg.signatory_title).toBe('Owner, Sole Proprietor'); // placeholder pending attorney
    expect(cfg.entity_formation).toBe('Sole proprietorship (California)');
    expect(cfg.business_address).toBeNull(); // disclosure decision pending (attorney checklist)
    expect(cfg.signatory_contact_id).not.toBeNull(); // Charles exists as a contact — COMPANY can sign
  });

  it('seeds ORG.LEGAL_IDENTITY so party blocks identify the sole proprietorship', async () => {
    const [row] = await h.q<{ value_text: string }>(
      `select value_text from config_values where namespace='ORG' and key='LEGAL_IDENTITY'`);
    expect(row.value_text).toContain('Charles Zigmund');
    expect(row.value_text).toContain('doing business as French Heritage Equestrian');
    expect(row.value_text).toContain('sole proprietorship');
  });

  it('generate_document resolves the ORG.* identity from the seed', async () => {
    const serviceType = (await h.q<{ code: string }>(`select code from service_types limit 1`))[0].code;
    const c = (await h.q<{ id: string }>(`insert into contacts (full_name) values ('Acme Stables') returning id`))[0].id;
    const cl = (await h.q<{ id: string }>(`insert into clients (contact_id) values ($1) returning id`, [c]))[0].id;
    const eng = (await h.q<{ id: string }>(
      `insert into engagements (client_id, service_type) values ($1,$2) returning id`, [cl, serviceType]))[0].id;

    const [doc] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'HORSE_PURCHASE_SALE')`, [eng]);
    expect(doc.merged_body).toContain('Charles Zigmund'); // signatory + legal identity resolved
    expect(doc.merged_body).toContain('doing business as French Heritage Equestrian');
    expect(doc.merged_body).not.toMatch(/\{\{(FHE|ORG)\./); // all company tokens resolved
    expect(doc.merged_body).not.toContain('Windemere'); // no mailing address anywhere
  });
});
