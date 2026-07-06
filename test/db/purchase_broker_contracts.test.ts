/**
 * Purchase & Broker contract instances (20260705020000) on the generic engine.
 * Proves both convenience RPCs seed correctly-owned fields and run end to end,
 * exactly like start_lease_contract — the anti-"name-only" guarantee for the two
 * remaining transaction contracts.
 *
 *   - start_purchase_contract → create_purchase_engagement + generate_document
 *       ('HORSE_PURCHASE_SALE'); BUYER/SELLER two-party; HORSE.* owned by SELLER.
 *   - start_broker_contract → create_search_engagement + generate_document
 *       ('HORSE_TRANSACTION_REP'); CLIENT single-signer retainer with COMPANY.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let org: string;
let admin: string;
let buyerUid: string, sellerUid: string;
let buyer: string, seller: string, client: string;
let horse: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  // brokerage module gate — create_purchase/search_engagement require mod.brokerage
  await h.q(`insert into org_modules (org_id, module_key, enabled)
             values ($1,'mod.brokerage',true)
             on conflict (org_id, module_key) do update set enabled = true`, [org]).catch(() => {});
  // pure two-party purchase: clear the COMPANY signatory so buyer+seller only
  await h.q(`update business_config set signatory_contact_id = null where org_id = $1`, [org]);

  const breedCode = (await h.q<{ code: string }>(`select code from horse_breeds order by code limit 1`))[0].code;
  buyer = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('Bianca','Buyer','bianca@buyer.test') returning id`))[0].id;
  seller = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('Sara','Seller','sara@seller.test') returning id`))[0].id;
  client = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('Cara','Client','cara@client.test') returning id`))[0].id;
  horse = (await h.q<{ id: string }>(
    `insert into horses (registered_name, barn_name, breed, sex) values ('Rocket','Roo',$1,'MARE') returning id`, [breedCode]))[0].id;

  admin    = await h.createAuthUser({ email: 'ops@fhe.test', role: 'ADMIN', org });
  buyerUid = await h.createAuthUser({ email: 'bianca@buyer.test', role: 'USER', org });
  sellerUid= await h.createAuthUser({ email: 'sara@seller.test', role: 'USER', org });
  await h.q(`update profiles set contact_id = $2 where user_id = $1`, [buyerUid, buyer]);
  await h.q(`update profiles set contact_id = $2 where user_id = $1`, [sellerUid, seller]);
});
afterAll(async () => { await h?.close(); });

// ── PURCHASE ────────────────────────────────────────────────────────────────
describe('start_purchase_contract — BUYER/SELLER purchase & sale', () => {
  let documentId: string;

  it('creates the engagement + document + party-owned fields', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ start_purchase_contract: { document_id: string; engagement_id: string; fields_seeded: number } }>(
      `select start_purchase_contract($1,$2,$3,$4,$5)`, [buyer, seller, horse, 15000, 3000]);
    documentId = r.start_purchase_contract.document_id;
    expect(r.start_purchase_contract.fields_seeded).toBeGreaterThan(30);

    await h.asSuperuser();
    // BUYER personal owned by BUYER; SELLER personal + HORSE + disclosures by SELLER; TXN by DEAL
    const rows = await h.q<{ field_key: string; owner_role: string; value_type: string }>(
      `select field_key, owner_role, value_type from contract_fields where document_id=$1`, [documentId]);
    const own = Object.fromEntries(rows.map(r => [r.field_key, r.owner_role]));
    expect(own['BUYER.FULL_NAME']).toBe('BUYER');
    expect(own['SELLER.FULL_NAME']).toBe('SELLER');
    expect(own['HORSE.REGISTERED_NAME']).toBe('SELLER');           // seller owns the horse
    expect(own['HORSE.MEDICAL_HISTORY']).toBe('SELLER');           // disclosure histories = seller
    expect(own['TXN.PURCHASE_PRICE']).toBe('DEAL');
    expect(rows.find(r => r.field_key === 'TXN.PURCHASE_PRICE')!.value_type).toBe('currency');

    // originator = buyer; workflow editable
    const [doc] = await h.q<{ originator_contact_id: string; workflow_state: string; status: string }>(
      `select originator_contact_id, workflow_state, status from documents where id=$1`, [documentId]);
    expect(doc.originator_contact_id).toBe(buyer);
    expect(doc.workflow_state).toBe('editable');
    expect(doc.status).toBe('AWAITING_SIGNATURE');
  });

  it('ownership holds: buyer edits own; cannot touch seller/horse; DEAL is buyer-only until recipient editing', async () => {
    await h.asUser(buyerUid);
    await h.q(`select set_contract_field($1,'BUYER.PHONE','(858) 555-1000')`, [documentId]); // own → ok
    await h.q(`select set_contract_field($1,'TXN.PURCHASE_PRICE','$15,000')`, [documentId]); // DEAL as originator → ok
    await expect(h.q(`select set_contract_field($1,'SELLER.FULL_NAME','x')`, [documentId]))
      .rejects.toThrow(/not authorized|owner/i);                                            // seller's field → blocked
    await expect(h.q(`select set_contract_field($1,'HORSE.BREED','x')`, [documentId]))
      .rejects.toThrow(/not authorized|owner/i);                                            // horse (seller's) → blocked

    await h.asUser(sellerUid);
    await h.q(`select set_contract_field($1,'HORSE.BREED','Warmblood')`, [documentId]);      // seller owns horse → ok
    await expect(h.q(`select set_contract_field($1,'TXN.PURCHASE_PRICE','$1')`, [documentId]))
      .rejects.toThrow(/not authorized|recipient/i);                                        // DEAL, editing off → blocked
  });

  it('executes on both signatures via record_signature', async () => {
    await h.asUser(admin);
    await h.q(`select advance_document_workflow($1,'locked')`, [documentId]).catch(() => {});
    await h.asUser(buyerUid);
    await h.q(`select lock_and_sign_contract($1,'BUYER','Bianca Buyer',true)`, [documentId]);
    await h.asUser(sellerUid);
    const [r] = await h.q<{ lock_and_sign_contract: string }>(
      `select lock_and_sign_contract($1,'SELLER','Sara Seller',true)`, [documentId]);
    expect(r.lock_and_sign_contract).toBe('EXECUTED');

    await h.asSuperuser();
    const [doc] = await h.q<{ status: string; workflow_state: string; execution_hash: string | null }>(
      `select status, workflow_state, execution_hash from documents where id=$1`, [documentId]);
    expect(doc.status).toBe('EXECUTED');
    expect(doc.workflow_state).toBe('executed');
    expect(doc.execution_hash).toBeTruthy();
  });
});

// ── BROKER (representation retainer) ─────────────────────────────────────────
describe('start_broker_contract — CLIENT representation retainer', () => {
  let documentId: string;

  it('creates a client-owned retainer with DEAL fee terms', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ start_broker_contract: { document_id: string; engagement_id: string; fields_seeded: number } }>(
      `select start_broker_contract($1,'BUY',$2)`, [client, null]);
    documentId = r.start_broker_contract.document_id;
    expect(r.start_broker_contract.fields_seeded).toBeGreaterThan(5);

    await h.asSuperuser();
    const rows = await h.q<{ field_key: string; owner_role: string }>(
      `select field_key, owner_role from contract_fields where document_id=$1`, [documentId]);
    const own = Object.fromEntries(rows.map(r => [r.field_key, r.owner_role]));
    expect(own['CLIENT.FULL_NAME']).toBe('CLIENT');
    expect(own['HORSE.REGISTERED_NAME']).toBe('CLIENT');       // client describes the target
    expect(own['TXN.REPRESENTATION_FEE']).toBe('DEAL');        // we set the fee, client accepts
    expect(own['ENG.PROTECTION_PERIOD']).toBe('DEAL');

    const [doc] = await h.q<{ originator_contact_id: string; workflow_state: string }>(
      `select originator_contact_id, workflow_state from documents where id=$1`, [documentId]);
    expect(doc.originator_contact_id).toBe(client);
    expect(doc.workflow_state).toBe('editable');
  });

  it('the client signs the retainer (single-signer path)', async () => {
    await h.asUser(admin);
    // staff facilitate the client signature on the retainer
    await h.q(`select advance_document_workflow($1,'locked')`, [documentId]).catch(() => {});
    const [r] = await h.q<{ lock_and_sign_contract: string }>(
      `select lock_and_sign_contract($1,'CLIENT','Cara Client',true)`, [documentId]);
    // with the COMPANY signatory cleared, the CLIENT is the sole signer → EXECUTED
    expect(r.lock_and_sign_contract).toBe('EXECUTED');
    await h.asSuperuser();
    const [doc] = await h.q<{ status: string; execution_hash: string | null }>(
      `select status, execution_hash from documents where id=$1`, [documentId]);
    expect(doc.status).toBe('EXECUTED');
    expect(doc.execution_hash).toBeTruthy();
  });
});
