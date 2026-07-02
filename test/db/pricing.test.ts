/**
 * Phase 3 — pricing seed (migration 21).
 *
 * Owner terms: 15% commission with a $500 minimum (whichever is greater);
 * lease fees $250 full / $150 half. Confirms the config values and that
 * generate_document renders {{TXN.COMMISSION_RATE}} as "15%" in a representation
 * contract (the rate is config-sourced, chosen by the engagement's service type).
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

describe('pricing seed', () => {
  it('records 15% / $500 commission and $250/$150 lease fees', async () => {
    const [c] = await h.q<Record<string, string>>(
      `select commission_purchase_rate, commission_sale_rate, commission_min,
              lease_full_fee, lease_half_fee, commission_lease_rate from business_config`);
    expect(Number(c.commission_purchase_rate)).toBe(15);
    expect(Number(c.commission_sale_rate)).toBe(15);
    expect(Number(c.commission_min)).toBe(500);
    expect(Number(c.lease_full_fee)).toBe(250);
    expect(Number(c.lease_half_fee)).toBe(150);
    expect(c.commission_lease_rate).toBeNull(); // lease is flat-fee, not %
  });
});

describe('commission token resolution', () => {
  it('renders {{TXN.COMMISSION_RATE}} as 15% in the finder retainer contract', async () => {
    // (was HORSE_REPRESENTATION — retired by the contract-module decomposition;
    // the finder retainer carries the same config-sourced commission alternative)
    const c = (await h.q<{ id: string }>(`insert into contacts (full_name) values ('Rep Client') returning id`))[0].id;
    const cl = (await h.q<{ id: string }>(`insert into clients (contact_id) values ($1) returning id`, [c]))[0].id;
    // HORSE_FINDER is purchase-side representation → uses the purchase commission rate
    const eng = (await h.q<{ id: string }>(
      `insert into engagements (client_id, service_type) values ($1,'HORSE_FINDER') returning id`, [cl]))[0].id;
    await h.q(`insert into engagement_parties (engagement_id, contact_id, party_role) values ($1,$2,'CLIENT')`, [eng, c]);

    const [doc] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'HORSE_SEARCH_RETAINER')`, [eng]);
    expect(doc.merged_body).toContain('15%');
    expect(doc.merged_body).not.toMatch(/\{\{TXN\.COMMISSION_RATE\}\}/);
  });
});
