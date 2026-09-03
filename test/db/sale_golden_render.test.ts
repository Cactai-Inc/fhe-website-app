/**
 * SALE BUILD (2026-08-02) — GOLDEN-RENDER FIXTURES for the clause-model
 * HORSE_SALE_V2 and HORSE_BILL_OF_SALE templates.
 *
 * The template-level golden suite (golden_render.test.ts) checks flat bodies;
 * clause-model templates carry a placeholder body, so their render surface is
 * remerge_contract_from_clauses over a document instance. These fixtures build
 * documents directly (superuser inserts — no auth path needed for composition)
 * with the field selections named in SALE_BUILD_INSTRUCTIONS §6.5 and assert
 * the conditional branches that composed into the body:
 *
 *   sale A — individual seller, entity buyer, co-buyer YES (JTWROS), deposit
 *            YES, installments NO, financing NOT_INCLUDED, PPE conducted +
 *            contingent, trial NO, no-slaughter INCLUDED, injury history NO
 *   sale B — co-buyer NO (the other branch)
 *   BOS    — paid in full, co-buyer YES, agent NOT_INCLUDED, notary NOT_INCLUDED
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgId: string;

beforeAll(async () => {
  h = await createTestDb();
  const org = await h.q<{ id: string }>(`select id from organizations limit 1`);
  orgId = org[0].id;
  // the documents insert trigger writes a status event; the vocab table carries
  // no rows in the snapshot (data allowlist is template config only) — seed the
  // live 'document' codes so the FK holds
  await h.q(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'document', c, c from unnest(array[
      'assigned','downloaded','in_progress','ready_to_sign','review_approved',
      'send_failed','sent','sent_for_review','signed','superseded','viewed','void'
    ]) c
    on conflict do nothing`);
  await h.q(`
    insert into document_status (code, display_name)
    select c, c from unnest(array['DRAFT','AWAITING_SIGNATURE','EXECUTED','VOID']) c
    on conflict do nothing`);
});

afterAll(async () => {
  await h?.close?.();
});

/** Create a document on a clause-model template, seed its fields from the defs,
 *  apply the fixture values, and return the composed body. */
async function composeFixture(templateKey: string, values: Record<string, string>): Promise<string> {
  const doc = await h.q<{ id: string }>(`
    insert into documents (org_id, template_id, title, status, workflow_state)
    select $2, id, title, 'DRAFT', 'editable' from contract_templates where template_key = $1
    returning id`, [templateKey, orgId]);
  const docId = doc[0].id;
  await h.q(`
    insert into contract_fields (org_id, document_id, field_key, label, section, clause_key,
                                 owner_role, value_type, input_kind, format_type, options,
                                 conditional_on, required, is_optional, sort_order)
    select $2, $1, d.field_key, d.label, d.section, d.clause_key, d.owner_role,
           d.value_type, nullif(d.input_kind,''), d.format_type, d.options,
           d.conditional_on, d.required, d.is_optional, d.sort_order
      from contract_field_defs d where d.template_key = $3`, [docId, orgId, templateKey]);
  for (const [k, v] of Object.entries(values)) {
    await h.q(`
      insert into contract_fields (org_id, document_id, field_key, owner_role, value, value_type, sort_order)
      values ($3, $1, $2, 'SYSTEM', $4, 'text', 0)
      on conflict (document_id, field_key) do update set value = excluded.value`,
      [docId, k, orgId, v]);
  }
  const body = await h.q<{ b: string }>(`select remerge_contract_from_clauses($1) as b`, [docId]);
  return body[0].b;
}

const SALE_COMMON = {
  'SELLER.FULL_NAME': 'Sally Seller', 'SELLER.ADDRESS': '1 Barn Way, San Diego, CA 92101',
  'SELLER.PARTY_TYPE': 'INDIVIDUAL',
  'BUYER.FULL_NAME': 'Buyer Holdings LLC', 'BUYER.ADDRESS': '2 Ranch Rd, San Diego, CA 92102',
  'BUYER.PARTY_TYPE': 'ENTITY',
  'HORSE.REGISTERED_NAME': 'Golden Fixture', 'HORSE.BREED': 'Selle Français',
  'TXN.HAS_ENCUMBRANCES': 'NO', 'TXN.KNOWN_CONDITIONS': 'None known.',
  'TXN.INJURY_HISTORY': 'NO', 'TXN.BREEDING_ELECTION': 'NOT_INCLUDED',
  'TXN.PURCHASE_PRICE': '25000', 'TXN.DEPOSIT_ENABLED': 'YES', 'TXN.DEPOSIT_AMOUNT': '2500',
  'TXN.PAYMENT_METHODS': 'ZELLE', 'TXN.INSTALLMENTS_ENABLED': 'NO',
  'TXN.FINANCING_ELECTION': 'NOT_INCLUDED', 'TXN.SALES_TAX_RESPONSIBLE': 'BUYER',
  'TXN.PPE_CHOICE': 'CONDUCTED', 'TXN.PPE_CONTINGENT': 'YES', 'TXN.PPE_DEADLINE': '2026-08-20',
  'TXN.DRUG_TEST_ELECTION': 'NOT_INCLUDED', 'TXN.TRIAL_ENABLED': 'NO',
  'TXN.DELIVERY_LOCATION': 'FHE main barn', 'TXN.DELIVERY_DATE': '2026-09-01',
  'TXN.TRANSPORT_RESPONSIBLE': 'BUYER', 'TXN.TRANSPORT_COST_RESPONSIBLE': 'BUYER',
  'TXN.BOARD_RATE_AFTER': '75', 'TXN.TRANSFER_FEES_RESPONSIBLE': 'BUYER',
  'TXN.NO_SLAUGHTER_ELECTION': 'INCLUDED',
  'BUYER.ENTITY_SIGNER_NAME': 'Bo Buyer', 'BUYER.ENTITY_SIGNER_TITLE': 'Manager',
};

/** CR-101·A1 (TASK-SIGNFLOW-H): the composer never appends "." to a line that
 *  carries a signature token — the token resolves at signing/display time, so
 *  the period would surface as "Signature: ." unsigned and "Name." signed.
 *  Red until fixtures/schema_snapshot.sql is regenerated from production
 *  (TASK-TESTREPAIR owns that act). */
function expectNoPeriodAfterSignatureLines(body: string) {
  const sigLines = body.split('\n').filter(l => /^(Signature|Date): /.test(l));
  expect(sigLines.length).toBeGreaterThan(0);
  for (const l of sigLines) expect(l, `signature line ends with a period: ${JSON.stringify(l)}`).not.toMatch(/\.$/);
}

describe('HORSE_SALE_V2 — golden branch fixtures', () => {
  it('fixture A (co-buyer YES, JTWROS) composes every elected branch', async () => {
    const body = await composeFixture('HORSE_SALE_V2', {
      ...SALE_COMMON,
      'TXN.CO_BUYER_ENABLED': 'YES',
      'COBUYER.FULL_NAME': 'Casey Cobuyer', 'COBUYER.ADDRESS': '3 Paddock Pl, San Diego, CA 92103',
      'COBUYER.PARTY_TYPE': 'INDIVIDUAL', 'TXN.CO_BUYER_TITLE_FORM': 'JTWROS',
      'COBUYER.PRINTED_NAME': 'Casey Cobuyer',
    });
    // parties + co-buyer branch
    expect(body).toContain('Casey Cobuyer');
    expect(body).toContain('purchases the Horse jointly with Buyer');
    expect(body).toContain('Joint tenants with right of survivorship');
    // party-type definitions: individual seller, entity buyer
    expect(body).toContain('"Seller Parties" means Seller; Seller’s spouse and family'.replace('’', "'"));
    expect(body).toContain('"Buyer Parties" means Buyer; Buyer\'s parent, subsidiary, and affiliated entities');
    // no pending placeholders anywhere
    expect(body).not.toContain('[Pending');
    // deposit yes / installments no / financing declined
    expect(body).toContain('Buyer shall pay a deposit of');
    expect(body).toContain('due in full at or before delivery of the Horse');
    expect(body).not.toContain('payable in installments as follows');
    expect(body).toContain('This sale is not contingent on Buyer obtaining financing');
    // PPE conducted + contingent, trial none, no-slaughter included, injury none
    expect(body).toContain('contingent on a pre-purchase examination');
    expect(body).toContain('No trial period applies to this sale.');
    expect(body).toContain('California Penal Code Section 598c');
    expect(body).toContain('no person has suffered serious injury proximately caused');
    // entity buyer signature capacity block
    expect(body).toContain('Signing on behalf of Buyer Holdings LLC');
    // co-buyer signature block
    expect(body).toContain('CO-BUYER');
    expectNoPeriodAfterSignatureLines(body);
  });

  it('fixture B (co-buyer NO) omits the co-buyer branch entirely', async () => {
    const body = await composeFixture('HORSE_SALE_V2', {
      ...SALE_COMMON,
      'TXN.CO_BUYER_ENABLED': 'NO',
    });
    expect(body).not.toContain('Co-Buyer');
    expect(body).not.toContain('CO-BUYER');
    expect(body).not.toContain('[Pending');
    expect(body).toContain('due in full at or before delivery of the Horse');
    expectNoPeriodAfterSignatureLines(body);
  });

  it('unset gates render pending placeholders (blocks-signing surface)', async () => {
    const body = await composeFixture('HORSE_SALE_V2', {
      'SELLER.FULL_NAME': 'Sally Seller', 'BUYER.FULL_NAME': 'Bob Buyer',
    });
    expect(body).toContain('[Pending — select whether Seller is an individual or an entity.');
    expect(body).toContain('[Pending — select whether Buyer is an individual or an entity.');
    expect(body).toContain('[Pending — state whether anyone has been seriously injured');
    expectNoPeriodAfterSignatureLines(body);
  });
});

describe('HORSE_BILL_OF_SALE — golden fixture', () => {
  it('paid in full + co-buyer YES + agent/notary NOT_INCLUDED', async () => {
    const body = await composeFixture('HORSE_BILL_OF_SALE', {
      'SELLER.FULL_NAME': 'Sally Seller', 'SELLER.ADDRESS': '1 Barn Way, San Diego, CA 92101',
      'SELLER.PARTY_TYPE': 'INDIVIDUAL', 'SELLER.PRINTED_NAME': 'Sally Seller',
      'BUYER.FULL_NAME': 'Bob Buyer', 'BUYER.ADDRESS': '2 Ranch Rd, San Diego, CA 92102',
      'BUYER.PARTY_TYPE': 'INDIVIDUAL', 'BUYER.PRINTED_NAME': 'Bob Buyer',
      'TXN.CO_BUYER_ENABLED': 'YES',
      'COBUYER.FULL_NAME': 'Casey Cobuyer', 'COBUYER.ADDRESS': '3 Paddock Pl, San Diego, CA 92103',
      'COBUYER.PARTY_TYPE': 'INDIVIDUAL', 'TXN.CO_BUYER_TITLE_FORM': 'JTWROS',
      'COBUYER.PRINTED_NAME': 'Casey Cobuyer',
      'HORSE.REGISTERED_NAME': 'Golden Fixture',
      'TXN.PURCHASE_PRICE': '25000',
      'TXN.BOS_PAYMENT_STATUS': 'PAID_IN_FULL',
      'TXN.BOS_HAS_SALE_AGREEMENT': 'YES',
      'TXN.AGENT_ELECTION': 'NOT_INCLUDED',
      'TXN.NOTARY_ELECTION': 'NOT_INCLUDED',
    });
    // paid-in-full conveyance, not the installment variant
    expect(body).toContain('Seller acknowledges receipt of the Purchase Price in full');
    expect(body).not.toContain('title to the Horse passes to Buyer only upon');
    // accompanied by a sale agreement → cross-reference condition branch
    expect(body).toContain('which remains in full force');
    // co-buyer joint title + signature block
    expect(body).toContain('takes title jointly with Buyer');
    expect(body).toContain('CO-BUYER');
    // agent + notary declined branches
    expect(body).toContain('No agent or intermediary receives compensation');
    expect(body).not.toContain('Notary Acknowledgment');
    expect(body).not.toContain('[Pending');
    // §19525 statement present
    expect(body).toContain('Business and Professions Code Section 19525');
    expectNoPeriodAfterSignatureLines(body);
  });
});
