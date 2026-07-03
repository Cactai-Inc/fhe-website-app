/**
 * Phase 3 — generate_document RPC (migration 18).
 *
 * Seeds a purchase engagement (buyer, seller, horse, FHE config) and proves the
 * merge engine resolves party / horse / config tokens, leaves {{SIG.*}} live,
 * persists a documents row, and errors on bad inputs.
 */
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let engId: string;
let breedLabel: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
});
afterAll(async () => {
  await h?.close();
});

beforeEach(async () => {
  await h.asSuperuser();
  // clean slate, children first (truncate-cascade would reach contract_templates)
  for (const t of ['documents', 'engagement_parties', 'engagements', 'clients', 'horses', 'contacts', 'business_config']) {
    await h.q(`delete from ${t}`);
  }

  const serviceType = (await h.q<{ code: string }>(`select code from service_types order by code limit 1`))[0].code;
  const breed = (await h.q<{ code: string; display_name: string }>(
    `select code, display_name from horse_breeds order by code limit 1`))[0];
  breedLabel = breed.display_name;

  const buyer = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, phone, email, address_line1, city, state, postal_code) values ('Jane', 'Buyer', '619-555-0001', 'jane@example.com', '1 Main St', 'San Diego', 'CA', '92101') returning id`))[0].id;
  const seller = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, phone, email) values ('John', 'Seller', '619-555-0002', 'john@example.com') returning id`))[0].id;
  const clientContact = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name) values ('Acme', 'Stables') returning id`))[0].id;
  const clientId = (await h.q<{ id: string }>(
    `insert into clients (contact_id) values ($1) returning id`, [clientContact]))[0].id;

  const horseId = (await h.q<{ id: string }>(
    `insert into horses (registered_name, barn_name, breed, sex, current_location)
     values ('Thunderbolt','Bolt',$1,'GELDING','Carmel Creek Ranch') returning id`, [breed.code]))[0].id;

  engId = (await h.q<{ id: string }>(
    `insert into engagements (client_id, service_type, primary_horse_id, start_date)
     values ($1,$2,$3,'2026-07-01') returning id`, [clientId, serviceType, horseId]))[0].id;

  await h.q(`insert into engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
             values ($1,$2,'BUYER',true,1),($1,$3,'SELLER',true,2)`, [engId, buyer, seller]);

  await h.q(`insert into business_config (legal_entity_name, signatory_name, signatory_title)
             values ('French Heritage Equestrian','A. Owner','Managing Member')`);
});

describe('generate_document — merge', () => {
  it('resolves party, horse, and config tokens; leaves signatures live', async () => {
    const [row] = await h.q<{ document_id: string; merged_body: string }>(
      `select * from generate_document($1,'HORSE_PURCHASE_SALE')`, [engId]);
    const body = row.merged_body;

    // party tokens resolved from engagement_parties → contacts
    expect(body).toContain('Jane Buyer');
    expect(body).toContain('John Seller');
    expect(body).toContain('San Diego'); // buyer composed address
    // horse tokens; breed rendered as its label, not the raw code
    expect(body).toContain('Thunderbolt');
    expect(body).toContain(breedLabel);
    // tenant identity (ORG.LEGAL_NAME) pulled from business_config — the owner's
    // 2026-07-03 body names COMPANY as a non-party assistant, trade name only
    expect(body).toContain('French Heritage Equestrian');
    expect(body).toContain('is not a party to this Agreement');

    // data tokens are gone…
    expect(body).not.toMatch(/\{\{BUYER\./);
    expect(body).not.toMatch(/\{\{HORSE\./);
    expect(body).not.toMatch(/\{\{FHE\./);
    expect(body).not.toMatch(/\{\{ORG\./);
    // …but signature tokens remain for the signing flow
    expect(body).toContain('{{SIG.BUYER.NAME}}');
    expect(body).toContain('{{SIG.SELLER.NAME}}');
  });

  it('persists a DRAFT documents row carrying the merged body', async () => {
    const [row] = await h.q<{ document_id: string; merged_body: string }>(
      `select * from generate_document($1,'HORSE_PURCHASE_SALE')`, [engId]);
    const [doc] = await h.q<{ merged_body: string; status: string; template_id: string; title: string }>(
      `select merged_body, status, template_id, title from documents where id = $1`, [row.document_id]);
    expect(doc.status).toBe('DRAFT');
    expect(doc.merged_body).toBe(row.merged_body);
    expect(doc.title).toBe('Horse Purchase and Sale Agreement');
  });

  it('blanks tokens whose source is not modeled yet (no orphan {{…}} except SIG)', async () => {
    const [row] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'HORSE_PURCHASE_SALE')`, [engId]);
    const leftover = row.merged_body.match(/\{\{[A-Z0-9_.]+\}\}/g) ?? [];
    // every remaining token must be a signature token
    for (const t of leftover) expect(t, `unexpected unmerged token ${t}`).toMatch(/^\{\{SIG\./);
  });
});

describe('generate_document — guards', () => {
  it('rejects an unknown template', async () => {
    await expect(h.q(`select * from generate_document($1,'NOT_A_TEMPLATE')`, [engId]))
      .rejects.toThrow(/unknown or inactive contract template/);
  });

  it('rejects a template with no loaded body', async () => {
    await expect(h.q(`select * from generate_document($1,'MEDIA_RELEASE')`, [engId]))
      .rejects.toThrow(/has no body loaded/);
  });

  it('rejects an unknown engagement', async () => {
    await expect(h.q(`select * from generate_document('00000000-0000-0000-0000-000000000000','HORSE_PURCHASE_SALE')`))
      .rejects.toThrow(/unknown engagement/);
  });
});
