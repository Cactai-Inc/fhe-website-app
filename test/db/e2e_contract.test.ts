/**
 * E2E-CONTRACT (critical chain #2, FEATURE_BUILD_PLAN §E2E):
 * requests row → staff converts → start_sale_contract opens the contract with
 * BUYER/SELLER (+ COMPANY, when a signatory is configured) signer parties →
 * required fields filled → locked → record_signature for ALL signers →
 * EXECUTED → document_deliveries rows (the deliver-document tail, idempotent).
 *
 * Real-path: the ACTUAL RPCs/tables the app uses, as the CORRECT RLS roles —
 * tenant #1 staff (ADMIN) for intake/convert/generate/sign, the service role
 * for the server-only delivery writer (api/deliver-document.ts inserts with
 * the admin client), and the admin read-back.
 *
 * TASK-TESTREPAIR (2026-08-21): rewritten against the CURRENT engine. Every
 * piece of infrastructure this file drove in its original form is retired:
 *   - `intake_submissions` does not exist; `requests` replaced it (no
 *     `payload`/`converted_engagement_id`/`reviewed_at` columns — conversion
 *     is a plain status update, not a dedicated RPC).
 *   - `engagements` / `engagement_parties` / `create_purchase_engagement` are
 *     RETIRED (CLAUDE.md). The contracts/contract_parties spine plus
 *     document_parties (document-scoped) replaced them; `start_sale_contract`
 *     is the new entry point (same PARTYCTRL/H1 model as
 *     `start_lease_contract_v2` — see contract_workflow.test.ts's header).
 *   - `HORSE_PURCHASE_SALE` is retired (deleted_at 2026-08-02,
 *     SALE BUILD/20260802090001) — `HORSE_SALE_V2` is the live sale template.
 *     Its field-value fixture below reuses the exact set proven correct by
 *     sale_golden_render.test.ts's SALE_COMMON (a currently-passing file).
 *   - `record_signature` gained `p_ip`/`p_user_agent` params (still optional,
 *     defaulted) — unaffected positionally for the 3-arg call style, but the
 *     document must be `locked` first (`advance_document_workflow`), which
 *     the original flow never modeled since HORSE_PURCHASE_SALE's old engine
 *     signed straight from DRAFT.
 *   - `document_deliveries`'s reproduction here now sources recipients from
 *     `document_parties` (matching the real `deliverExecutedDocument()` in
 *     api/_lib/delivery.ts, which already made this exact change).
 *   - The seeded COMPANY signatory contact is named "French Heritage
 *     Equestrian" in the current live data (pulled fresh by this task's
 *     snapshot regeneration) — the old test's hardcoded "Charles Zigmund" no
 *     longer exists in the seed and is not asserted here.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string;   // tenant #1 (FHE)
let aAdmin: string; // tenant #1 staff (ADMIN)
let buyerUid: string, sellerUid: string;
let buyer: string, seller: string, horse: string;
let requestId: string;
let contractId: string;
let docId: string;
let companySignatoryContactId: string | null;
let companySignatoryName: string | null;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });

  // status_events_vocab: same FK the documents-insert trigger needs (see
  // contract_workflow.test.ts / sale_golden_render.test.ts for the same seed).
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

  const breed = (await h.q<{ code: string }>(`select code from horse_breeds order by code limit 1`))[0].code;
  buyer = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('Iris', 'Intake', 'iris@e2e.test') returning id`))[0].id;
  seller = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('Sam', 'Seller', 'sam@e2e.test') returning id`))[0].id;
  horse = (await h.q<{ id: string }>(
    `insert into horses (registered_name, breed, sex) values ('Cadence',$1,'MARE') returning id`, [breed]))[0].id;

  // record_signature requires the CALLER's own contact to match the signing
  // party (no staff-impersonation of a party — only the COMPANY role has a
  // staff-signs-on-its-behalf carve-out, for a company contact with no
  // linked account). So buyer/seller each need a real authenticated identity.
  buyerUid = await h.createAuthUser({ email: 'iris@e2e.test', role: 'USER', org: orgA });
  sellerUid = await h.createAuthUser({ email: 'sam@e2e.test', role: 'USER', org: orgA });
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [buyer, buyerUid]);
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [seller, sellerUid]);

  // contract_requirements is pure service_type -> template_key configuration
  // (no PII) but is not on the snapshot's reviewed SNAPSHOT_DATA_TABLES
  // allowlist (harness.ts), so it loads schema-only/empty. Seed the two rows
  // this test needs directly, matching production's live mapping exactly
  // (verified via psql against lrstswfxfsezdmvkvukc during TASK-TESTREPAIR).
  await h.q(`insert into contract_requirements (service_type, template_key)
    values ('HORSE_PURCHASE_ASSISTANCE','COMPANY_POLICIES'),
           ('HORSE_PURCHASE_ASSISTANCE','HORSE_EMERGENCY_VET')
    on conflict do nothing`);

  const [sig] = await h.q<{ signatory_contact_id: string | null }>(
    `select signatory_contact_id from business_config where org_id=$1`, [orgA]);
  companySignatoryContactId = sig?.signatory_contact_id ?? null;
  if (companySignatoryContactId) {
    const [c] = await h.q<{ name: string }>(
      `select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) as name
         from contacts where id=$1`, [companySignatoryContactId]);
    companySignatoryName = c?.name || null;
  }
});

afterAll(async () => { await h?.close(); });

describe('chain 2 — a request lands, then staff converts and opens the sale contract', () => {
  it('staff files the requests row (org-scoped, status new)', async () => {
    await h.asUser(aAdmin);
    requestId = (await h.q<{ id: string }>(
      `insert into requests (contact_name, contact_email, category, channel, notes)
         values ('Iris Intake','iris@e2e.test','acquisition','inquiry','budget 20000 for Cadence')
       returning id`))[0].id;
    await h.asSuperuser();
    const [row] = await h.q<{ org_id: string; status: string }>(
      `select org_id, status from requests where id=$1`, [requestId]);
    expect(row.org_id).toBe(orgA);
    expect(row.status).toBe('new');
  });

  it('convert: start_sale_contract opens the contract with BUYER/SELLER (+COMPANY) signer parties', async () => {
    await h.asUser(aAdmin);
    // conversion is a plain status update now — no dedicated RPC replaced
    // create_purchase_engagement's bookkeeping half.
    await h.q(`update requests set status='converted', contact_id=$2 where id=$1`, [requestId, buyer]);

    const [r] = await h.q<{ start_sale_contract: { document_id: string; contract_id: string } }>(
      `select start_sale_contract($1,$2,$3,$4,$5)`, [buyer, seller, horse, 20000, 5000]);
    docId = r.start_sale_contract.document_id;
    contractId = r.start_sale_contract.contract_id;
    expect(contractId).toBeTruthy();
    expect(docId).toBeTruthy();

    await h.asSuperuser();
    const [req] = await h.q<{ status: string; contact_id: string }>(
      `select status, contact_id from requests where id=$1`, [requestId]);
    expect(req.status).toBe('converted');
    expect(req.contact_id).toBe(buyer);

    const parties = await h.q<{ party_role: string; name: string; is_signer: boolean }>(
      `select dp.party_role, trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')) as name, dp.is_signer
         from document_parties dp join contacts c on c.id = dp.contact_id
        where dp.document_id=$1 order by dp.signer_order`, [docId]);
    const roles = parties.map((p) => p.party_role);
    expect(roles).toContain('BUYER');
    expect(roles).toContain('SELLER');
    expect(parties.every((p) => p.is_signer)).toBe(true);
    // COMPANY signer only appears when a signatory is configured (it is, in
    // this task's freshly-pulled seed) — assert against what's actually seeded
    // rather than a hardcoded name (see header note: "Charles Zigmund" is gone).
    if (companySignatoryContactId) {
      expect(roles).toContain('COMPANY');
      const company = parties.find((p) => p.party_role === 'COMPANY');
      expect(company!.name).toBe(companySignatoryName);
    }
  });

  it('required_documents_for(HORSE_PURCHASE_ASSISTANCE) returns the tenant signing set', async () => {
    await h.asUser(aAdmin);
    const rows = await h.q<{ required_documents_for: string }>(
      `select required_documents_for('HORSE_PURCHASE_ASSISTANCE')`);
    // 20260703030000 §3: COMPANY_POLICIES joins every service's required set
    expect(rows.map((r) => r.required_documents_for)).toEqual(['COMPANY_POLICIES', 'HORSE_EMERGENCY_VET']);
  });
});

describe('chain 2 — fill required fields → lock → sign ALL parties → EXECUTED', () => {
  it('generate_document merges the real contract inputs (and the required vet doc generates too)', async () => {
    await h.asUser(aAdmin);
    const [doc] = await h.q<{ merged_body: string }>(
      `select merged_body from documents where id=$1`, [docId]);
    expect(doc.merged_body).toContain('Iris Intake');
    expect(doc.merged_body).toContain('Sam Seller');
    expect(doc.merged_body).toContain('Cadence');

    // the matrix-required document is generatable on the SAME contract, same parties
    const parties = await h.q<{ contact_id: string; party_role: string; is_signer: boolean; signer_order: number }>(
      `select contact_id, party_role, is_signer, signer_order from document_parties
        where document_id=$1 order by signer_order`, [docId]);
    const [req] = await h.q<{ document_id: string }>(
      `select gd.document_id from generate_document(
         $1,'HORSE_EMERGENCY_VET',$2,$3, $4::jsonb, NULL) gd`,
      [buyer, contractId, horse, JSON.stringify(parties.map((p) => ({
        contact_id: p.contact_id, role: p.party_role, is_signer: p.is_signer, signer_order: p.signer_order,
      })))]);
    expect(req.document_id).toBeTruthy();
  });

  it('fills the required HORSE_SALE_V2 fields (the proven sale_golden_render fixture) and locks', async () => {
    // Reuses the exact field/value set sale_golden_render.test.ts's SALE_COMMON
    // proves correct (a currently-passing file) — co-buyer NO, both parties
    // individuals, no entity-signer branch, so the field graph closes cleanly.
    const values: Record<string, string> = {
      'SELLER.PARTY_TYPE': 'INDIVIDUAL', 'BUYER.PARTY_TYPE': 'INDIVIDUAL',
      'TXN.HAS_ENCUMBRANCES': 'NO', 'TXN.KNOWN_CONDITIONS': 'None known.',
      'TXN.INJURY_HISTORY': 'NO', 'TXN.BREEDING_ELECTION': 'NOT_INCLUDED',
      'TXN.DEPOSIT_ENABLED': 'YES', 'TXN.DEPOSIT_AMOUNT': '5000',
      'TXN.PAYMENT_METHODS': 'ZELLE', 'TXN.INSTALLMENTS_ENABLED': 'NO',
      'TXN.FINANCING_ELECTION': 'NOT_INCLUDED', 'TXN.SALES_TAX_RESPONSIBLE': 'BUYER',
      'TXN.PPE_CHOICE': 'CONDUCTED', 'TXN.PPE_CONTINGENT': 'YES', 'TXN.PPE_DEADLINE': '2026-09-20',
      'TXN.DRUG_TEST_ELECTION': 'NOT_INCLUDED', 'TXN.TRIAL_ENABLED': 'NO',
      'TXN.DELIVERY_LOCATION': 'FHE main barn', 'TXN.DELIVERY_DATE': '2026-10-01',
      'TXN.TRANSPORT_RESPONSIBLE': 'BUYER', 'TXN.TRANSPORT_COST_RESPONSIBLE': 'BUYER',
      'TXN.BOARD_RATE_AFTER': '75', 'TXN.TRANSFER_FEES_RESPONSIBLE': 'BUYER',
      'TXN.NO_SLAUGHTER_ELECTION': 'INCLUDED', 'TXN.CO_BUYER_ENABLED': 'NO',
    };
    await h.asUser(aAdmin); // staff can fill any field regardless of owner_role
    for (const [k, v] of Object.entries(values)) {
      await h.q(`select set_contract_field($1,$2,$3)`, [docId, k, v]);
    }

    const blockers = (await h.q<{ contract_lock_blockers: { code: string; message: string }[] }>(
      `select contract_lock_blockers($1)`, [docId]))[0].contract_lock_blockers;
    expect(blockers, JSON.stringify(blockers)).toEqual([]);

    expect((await h.q<{ advance_document_workflow: string }>(
      `select advance_document_workflow($1,'in_review')`, [docId]))[0].advance_document_workflow).toBe('in_review');
    expect((await h.q<{ advance_document_workflow: string }>(
      `select advance_document_workflow($1,'locked')`, [docId]))[0].advance_document_workflow).toBe('locked');
  });

  it('stays AWAITING_SIGNATURE until EVERY signer (incl. COMPANY) signs; the last signature flips EXECUTED', async () => {
    // record_signature requires the caller's own contact to match the party
    // (no staff-impersonation) — buyer and seller each sign under their own
    // authenticated identity; only COMPANY has a staff-signs-on-its-behalf
    // carve-out (the company contact has no linked account).
    await h.asUser(buyerUid);
    const s1 = (await h.q<{ record_signature: string }>(
      `select record_signature($1,'BUYER','Iris Intake')`, [docId]))[0].record_signature;
    expect(s1).toBe('AWAITING_SIGNATURE'); // delivery would be refused here (not EXECUTED)

    await h.asUser(sellerUid);
    const s2 = (await h.q<{ record_signature: string }>(
      `select record_signature($1,'SELLER','Sam Seller')`, [docId]))[0].record_signature;
    expect(s2).toBe(companySignatoryContactId ? 'AWAITING_SIGNATURE' : 'EXECUTED');

    if (companySignatoryContactId) {
      await h.asUser(aAdmin);
      const s3 = (await h.q<{ record_signature: string }>(
        `select record_signature($1,'COMPANY',$2)`, [docId, companySignatoryName]))[0].record_signature;
      expect(s3).toBe('EXECUTED');
    }

    await h.asSuperuser();
    const sigs = await h.q<{ party_role: string; typed_name: string }>(
      `select party_role, typed_name from signatures
        where document_id=$1 and signed_at is not null order by party_role`, [docId]);
    expect(sigs.map((s) => s.party_role)).toContain('BUYER');
    expect(sigs.map((s) => s.party_role)).toContain('SELLER');
    const [d] = await h.q<{ status: string; effective_date: string; org_id: string; execution_hash: string }>(
      `select status, effective_date, org_id, execution_hash from documents where id=$1`, [docId]);
    expect(d.status).toBe('EXECUTED');
    expect(d.effective_date).toBeTruthy();
    expect(d.execution_hash).toBeTruthy();
    expect(d.org_id).toBe(orgA);
  });
});

describe('chain 2 — EXECUTED → document_deliveries (the deliver-document tail)', () => {
  /**
   * The server-only delivery writer (api/deliver-document.ts →
   * api/_lib/delivery.ts deliverExecutedDocument(), admin client): guard on
   * EXECUTED, recipients = document_parties (that file's own real source
   * table, unchanged by this rewrite), idempotent per (document, recipient,
   * EMAIL). Reproduced here against the real tables.
   */
  async function deliverExecuted(documentId: string): Promise<number> {
    await h.asServiceRole();
    const [doc] = await h.q<{ status: string }>(
      `select status from documents where id=$1`, [documentId]);
    if (doc.status !== 'EXECUTED') return 0; // the API's 409 guard — no premature delivery
    const parties = await h.q<{ contact_id: string }>(
      `select contact_id from document_parties where document_id=$1`, [documentId]);
    const existing = await h.q<{ recipient_contact_id: string }>(
      `select recipient_contact_id from document_deliveries
        where document_id=$1 and channel='EMAIL'`, [documentId]);
    const already = new Set(existing.map((r) => r.recipient_contact_id));
    let inserted = 0;
    for (const p of parties) {
      if (already.has(p.contact_id)) continue;
      await h.q(
        `insert into document_deliveries (document_id, recipient_contact_id, channel, copy_url)
           values ($1,$2,'EMAIL',$3)`, [documentId, p.contact_id, `/portal/documents/${documentId}`]);
      already.add(p.contact_id);
      inserted += 1;
    }
    return inserted;
  }

  it('delivers one EMAIL copy per document party once EXECUTED', async () => {
    const expected = companySignatoryContactId ? 3 : 2; // BUYER + SELLER (+ COMPANY)
    const n = await deliverExecuted(docId);
    expect(n).toBe(expected);

    await h.asUser(aAdmin);
    const rows = await h.q<{ recipient_contact_id: string; channel: string; copy_url: string }>(
      `select recipient_contact_id, channel, copy_url from document_deliveries where document_id=$1`, [docId]);
    expect(rows).toHaveLength(expected);
    expect(rows.every((r) => r.channel === 'EMAIL')).toBe(true);
    expect(rows.every((r) => r.copy_url === `/portal/documents/${docId}`)).toBe(true);
    const recipients = rows.map((r) => r.recipient_contact_id).sort();
    expect(recipients).toContain(buyer);
    expect(recipients).toContain(seller);
  });

  it('re-delivery is idempotent — no duplicate (document, recipient, EMAIL) rows', async () => {
    const n = await deliverExecuted(docId);
    expect(n).toBe(0);
    await h.asSuperuser();
    const expected = companySignatoryContactId ? 3 : 2;
    const [{ n: count }] = await h.q<{ n: string }>(
      `select count(*)::text as n from document_deliveries where document_id=$1 and channel='EMAIL'`, [docId]);
    expect(Number(count)).toBe(expected);
  });

  it('a not-yet-EXECUTED document is never delivered (the 409 guard)', async () => {
    await h.asUser(aAdmin);
    const parties = await h.q<{ contact_id: string; party_role: string; is_signer: boolean; signer_order: number }>(
      `select contact_id, party_role, is_signer, signer_order from document_parties
        where document_id=$1 order by signer_order`, [docId]);
    const [draft] = await h.q<{ document_id: string }>(
      `select gd.document_id from generate_document(
         $1,'HORSE_EMERGENCY_VET',$2,$3, $4::jsonb, NULL) gd`,
      [buyer, contractId, horse, JSON.stringify(parties.map((p) => ({
        contact_id: p.contact_id, role: p.party_role, is_signer: p.is_signer, signer_order: p.signer_order,
      })))]);
    const n = await deliverExecuted(draft.document_id);
    expect(n).toBe(0);
    await h.asSuperuser();
    expect(await h.q(
      `select 1 from document_deliveries where document_id=$1`, [draft.document_id])).toHaveLength(0);
  });

  it('ISOLATION: another tenant\'s staff sees none of these documents', async () => {
    await h.asSuperuser();
    const orgB = (await h.q<{ id: string }>(
      `insert into organizations (name, slug) values ('Contract Rival','e2e-contract-rival') returning id`))[0].id;
    const bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
    await h.asUser(bAdmin);
    expect(await h.q(`select id from documents where id=$1`, [docId])).toHaveLength(0);
    expect(await h.q(`select id from requests where id=$1`, [requestId])).toHaveLength(0);
  });
});
