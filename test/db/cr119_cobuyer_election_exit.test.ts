/**
 * TASK-CR119-A — THE TEST.
 *
 * The bug was never the write path: `set_contract_field(doc,'TXN.CO_BUYER_ENABLED','NO')`
 * already tore the election down via `remove_document_co_buyer`'s teardown hook
 * (`20260802090001_sale_engine_functions.sql:721-725`). The defect was that the
 * co-buyer capture card in ContractPage.tsx (:1954-1998) had no exit of its own —
 * only "Add co-buyer". This proves the RPC path the new "Not adding a co-buyer"
 * button calls (the same `setContractField` call `saveField` already uses) in both
 * states the card can be in:
 *   1. YES elected, no co-buyer party added yet (the common case the card shows).
 *   2. YES elected, a co-buyer WAS already added (2 BUYER parties) — confirms the
 *      button's call still reaches `remove_document_co_buyer` correctly.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string;
let aAdmin: string;
let buyer: string, seller: string, horse: string;
let docId: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });

  // status_events_vocab / document_status: same FK the documents-insert trigger
  // needs (see e2e_contract.test.ts's beforeAll for the identical seed).
  await h.db.exec(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'document', c, c from unnest(array[
      'assigned','sent_for_review','sent','send_failed','in_progress','viewed',
      'downloaded','review_approved','ready_to_sign','signed','superseded','void','cleaned_up'
    ]) c on conflict do nothing;
    insert into document_status (code, display_name, is_terminal, sort_order) values
      ('DRAFT','Draft',false,1), ('AWAITING_SIGNATURE','Awaiting Signature',false,2),
      ('EXECUTED','Executed',true,3), ('VOID','Void',true,4)
    on conflict do nothing;`);

  buyer = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('Wally', 'Walktest', 'wally.cr119@e2e.test') returning id`))[0].id;
  seller = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('Sam', 'Seller', 'sam.cr119@e2e.test') returning id`))[0].id;
  const breed = (await h.q<{ code: string }>(`select code from horse_breeds order by code limit 1`))[0].code;
  horse = (await h.q<{ id: string }>(
    `insert into horses (registered_name, breed, sex) values ('Cr119Fixture',$1,'MARE') returning id`, [breed]))[0].id;

  await h.asUser(aAdmin);
  const [r] = await h.q<{ start_sale_contract: { document_id: string } }>(
    `select start_sale_contract($1,$2,$3,$4,$5)`, [buyer, seller, horse, 20000, 5000]);
  docId = r.start_sale_contract.document_id;
});

afterAll(async () => { await h?.close(); });

async function buyerPartyCount(): Promise<number> {
  const [row] = await h.q<{ n: string }>(
    `select count(*)::text as n from document_parties where document_id=$1 and party_role='BUYER'`, [docId]);
  return Number(row.n);
}

async function coBuyerEnabled(): Promise<string | null> {
  const [row] = await h.q<{ value: string | null }>(
    `select value from contract_fields where document_id=$1 and field_key='TXN.CO_BUYER_ENABLED'`, [docId]);
  return row.value;
}

describe('CR-119-A — the new "Not adding a co-buyer" action, at the RPC layer', () => {
  it('elects YES with no co-buyer party yet — the button\'s call flips it back to NO', async () => {
    await h.asUser(aAdmin);
    await h.q(`select set_contract_field($1,'TXN.CO_BUYER_ENABLED','YES')`, [docId]);
    expect(await coBuyerEnabled()).toBe('YES');
    expect(await buyerPartyCount()).toBe(1);

    // The exact call ContractPage.tsx's new removeCoBuyerElection makes.
    await h.q(`select set_contract_field($1,'TXN.CO_BUYER_ENABLED','NO')`, [docId]);

    expect(await coBuyerEnabled()).toBe('NO');
    expect(await buyerPartyCount()).toBe(1); // nothing to remove — still just the primary buyer
  });

  it('a co-buyer WAS already added (2 BUYER parties) — the same button call removes it via remove_document_co_buyer', async () => {
    await h.asUser(aAdmin);
    await h.q(`select set_contract_field($1,'TXN.CO_BUYER_ENABLED','YES')`, [docId]);
    await h.q(
      `select set_document_co_buyer($1, NULL, 'Cara', 'Cobuyer', 'cara.cr119@e2e.test', NULL, NULL, NULL, NULL, NULL)`,
      [docId]);
    expect(await buyerPartyCount()).toBe(2);

    await h.q(`select set_contract_field($1,'TXN.CO_BUYER_ENABLED','NO')`, [docId]);

    expect(await coBuyerEnabled()).toBe('NO');
    expect(await buyerPartyCount()).toBe(1); // remove_document_co_buyer stripped the second BUYER party
    const [cobuyerVal] = await h.q<{ value: string | null }>(
      `select value from contract_fields where document_id=$1 and field_key='COBUYER.FULL_NAME'`, [docId]);
    // COBUYER.* namespace values are cleared by the teardown, if the field exists on this template
    if (cobuyerVal) expect(cobuyerVal.value ?? '').toBe('');
  });
});
