/**
 * Phase 3 — full purchase flow (migrations 22/23).
 *
 * create_purchase_engagement → generate_document → record_signature, end to end:
 * the engagement + transaction are created, the generated purchase agreement
 * surfaces the actual money inputs (price/deposit/balance), and the document
 * reaches EXECUTED once both signer parties have signed.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let buyer: string, seller: string, horse: string, uid: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  const breed = (await h.q<{ code: string }>(`select code from horse_breeds order by code limit 1`))[0].code;
  buyer = (await h.q<{ id: string }>(
    `insert into contacts (full_name, email) values ('Jane Buyer','jane@ex.com') returning id`))[0].id;
  seller = (await h.q<{ id: string }>(
    `insert into contacts (full_name) values ('John Seller') returning id`))[0].id;
  horse = (await h.q<{ id: string }>(
    `insert into horses (registered_name, breed, sex) values ('Thunderbolt',$1,'GELDING') returning id`, [breed]))[0].id;
  uid = await h.createAuthUser({ email: 'ops@fhe.test', isAdmin: true });
});
afterAll(async () => {
  await h?.close();
});

describe('create_purchase_engagement', () => {
  it('opens the engagement with buyer/seller parties and a PURCHASE transaction', async () => {
    await h.asUser(uid);
    const eng = (await h.q<{ create_purchase_engagement: string }>(
      `select create_purchase_engagement($1,$2,$3,$4,$5)`, [buyer, horse, seller, 15000, 3000]))[0]
      .create_purchase_engagement;
    expect(eng).toBeTruthy();

    await h.asSuperuser();
    const parties = await h.q<{ party_role: string }>(
      `select party_role from engagement_parties where engagement_id=$1 order by signer_order`, [eng]);
    expect(parties.map((p) => p.party_role)).toEqual(['BUYER', 'SELLER']);
    const [txn] = await h.q<{ txn_type: string; amount: string }>(
      `select txn_type, amount from transactions where engagement_id=$1`, [eng]);
    expect(txn.txn_type).toBe('PURCHASE');
    expect(Number(txn.amount)).toBe(15000);
  });
});

describe('generate → sign', () => {
  it('surfaces the money inputs and executes once both parties sign', async () => {
    await h.asUser(uid);
    const eng = (await h.q<{ create_purchase_engagement: string }>(
      `select create_purchase_engagement($1,$2,$3,$4,$5)`, [buyer, horse, seller, 15000, 3000]))[0]
      .create_purchase_engagement;

    const [doc] = await h.q<{ document_id: string; merged_body: string }>(
      `select * from generate_document($1,'HORSE_PURCHASE_SALE')`, [eng]);
    // actual engagement inputs surfaced — no resting blanks for these
    expect(doc.merged_body).toContain('Jane Buyer');
    expect(doc.merged_body).toContain('John Seller');
    expect(doc.merged_body).toContain('Thunderbolt');
    expect(doc.merged_body).toContain('$15,000.00');           // purchase price
    expect(doc.merged_body).toContain('$3,000.00');            // deposit
    expect(doc.merged_body).toContain('$12,000.00');           // computed balance

    // first signature — not yet executed (seller still pending)
    const s1 = (await h.q<{ record_signature: string }>(
      `select record_signature($1,'BUYER',$2)`, [doc.document_id, 'Jane Buyer']))[0].record_signature;
    expect(s1).toBe('DRAFT');

    // second signature — now executed
    const s2 = (await h.q<{ record_signature: string }>(
      `select record_signature($1,'SELLER',$2)`, [doc.document_id, 'John Seller']))[0].record_signature;
    expect(s2).toBe('EXECUTED');

    await h.asSuperuser();
    const sigs = await h.q(`select id from signatures where document_id=$1 and signed_at is not null`, [doc.document_id]);
    expect(sigs).toHaveLength(2);
    const [d] = await h.q<{ status: string; effective_date: string }>(
      `select status, effective_date from documents where id=$1`, [doc.document_id]);
    expect(d.status).toBe('EXECUTED');
    expect(d.effective_date).toBeTruthy();
  });
});
