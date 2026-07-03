/**
 * E2E-CONTRACT (critical chain #2, FEATURE_BUILD_PLAN §E2E):
 * intake_submissions row → convert via create_purchase_engagement →
 * required_documents_for signing set → generate_document → record_signature for
 * ALL parties (BUYER, SELLER, and the COMPANY signatory 'Charles Zigmund') →
 * EXECUTED → document_deliveries rows (the deliver-document tail, idempotent).
 *
 * Real-path: the ACTUAL RPCs/tables the app uses, as the CORRECT RLS roles —
 * tenant #1 staff (ADMIN) for intake/convert/generate/sign, the service role for
 * the server-only delivery writer (api/deliver-document.ts inserts with the
 * admin client), and the admin read-back.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string;   // tenant #1 (FHE) — mod.brokerage on, Charles Zigmund seeded
let aAdmin: string; // tenant #1 staff (ADMIN)
let buyer: string, seller: string, horse: string;
let submissionId: string;
let engId: string;
let docId: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });

  await h.asSuperuser();
  const breed = (await h.q<{ code: string }>(`select code from horse_breeds order by code limit 1`))[0].code;
  buyer = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('Iris', 'Intake', 'iris@e2e.test') returning id`))[0].id;
  seller = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('Sam', 'Seller', 'sam@e2e.test') returning id`))[0].id;
  horse = (await h.q<{ id: string }>(
    `insert into horses (registered_name, breed, sex) values ('Cadence',$1,'MARE') returning id`, [breed]))[0].id;
});

afterAll(async () => { await h?.close(); });

describe('chain 2 — intake lands, then converts through the real brokerage RPC', () => {
  it('staff files the intake_submissions row (org-scoped, status NEW)', async () => {
    await h.asUser(aAdmin);
    submissionId = (await h.q<{ id: string }>(
      `insert into intake_submissions (form_key, payload, contact_email, contact_name)
         values ('INTAKE_HORSE_PURCHASE','{"horse_name":"Cadence","budget":"20000"}'::jsonb,
                 'iris@e2e.test','Iris Intake') returning id`))[0].id;
    await h.asSuperuser();
    const [row] = await h.q<{ org_id: string; status: string }>(
      `select org_id, status from intake_submissions where id=$1`, [submissionId]);
    expect(row.org_id).toBe(orgA);
    expect(row.status).toBe('NEW');
  });

  it('convert: create_purchase_engagement opens the engagement with BUYER/SELLER/COMPANY signer parties', async () => {
    await h.asUser(aAdmin);
    engId = (await h.q<{ id: string }>(
      `select create_purchase_engagement($1,$2,$3,$4,$5) as id`,
      [buyer, horse, seller, 20000, 5000]))[0].id;
    expect(engId).toBeTruthy();

    await h.q(
      `update intake_submissions
          set status='CONVERTED', converted_engagement_id=$2, reviewed_at=now(), reviewed_by=$3
        where id=$1`, [submissionId, engId, aAdmin]);

    await h.asSuperuser();
    const [sub] = await h.q<{ status: string; converted_engagement_id: string }>(
      `select status, converted_engagement_id from intake_submissions where id=$1`, [submissionId]);
    expect(sub.status).toBe('CONVERTED');
    expect(sub.converted_engagement_id).toBe(engId);

    const parties = await h.q<{ party_role: string; name: string; is_signer: boolean }>(
      `select ep.party_role, trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')) as name, ep.is_signer
         from engagement_parties ep join contacts c on c.id = ep.contact_id
        where ep.engagement_id=$1 order by ep.signer_order`, [engId]);
    expect(parties.map((p) => p.party_role)).toEqual(['BUYER', 'SELLER', 'COMPANY']);
    expect(parties.every((p) => p.is_signer)).toBe(true);
    // the COMPANY signer is the seeded tenant signatory — Charles Zigmund
    expect(parties[2].name).toBe('Charles Zigmund');
  });

  it('required_documents_for(HORSE_PURCHASE_ASSISTANCE) returns the tenant signing set', async () => {
    await h.asUser(aAdmin);
    const rows = await h.q<{ required_documents_for: string }>(
      `select required_documents_for('HORSE_PURCHASE_ASSISTANCE')`);
    expect(rows.map((r) => r.required_documents_for)).toEqual(['HORSE_EMERGENCY_VET']);
  });
});

describe('chain 2 — generate → sign ALL parties → EXECUTED', () => {
  it('generate_document merges the real engagement inputs (and the required release generates too)', async () => {
    await h.asUser(aAdmin);
    const [doc] = await h.q<{ document_id: string; merged_body: string }>(
      `select * from generate_document($1,'HORSE_PURCHASE_SALE')`, [engId]);
    docId = doc.document_id;
    expect(doc.merged_body).toContain('Iris Intake');
    expect(doc.merged_body).toContain('Sam Seller');
    expect(doc.merged_body).toContain('Cadence');
    expect(doc.merged_body).toContain('$20,000.00');
    expect(doc.merged_body).toContain('$5,000.00');
    expect(doc.merged_body).toContain('$15,000.00'); // balance due

    // the matrix-required document is generatable from the SAME engagement
    const [req] = await h.q<{ document_id: string }>(
      `select document_id from generate_document($1,'HORSE_EMERGENCY_VET')`, [engId]);
    expect(req.document_id).toBeTruthy();
  });

  it('stays DRAFT until EVERY signer (incl. COMPANY) signs; COMPANY signature flips EXECUTED', async () => {
    await h.asUser(aAdmin);
    const s1 = (await h.q<{ record_signature: string }>(
      `select record_signature($1,'BUYER','Iris Intake')`, [docId]))[0].record_signature;
    expect(s1).toBe('DRAFT'); // delivery would be refused here (not EXECUTED)

    const s2 = (await h.q<{ record_signature: string }>(
      `select record_signature($1,'SELLER','Sam Seller')`, [docId]))[0].record_signature;
    expect(s2).toBe('DRAFT'); // company countersignature still pending

    const s3 = (await h.q<{ record_signature: string }>(
      `select record_signature($1,'COMPANY','Charles Zigmund')`, [docId]))[0].record_signature;
    expect(s3).toBe('EXECUTED');

    await h.asSuperuser();
    const sigs = await h.q<{ party_role: string; typed_name: string }>(
      `select party_role, typed_name from signatures
        where document_id=$1 and signed_at is not null order by party_role`, [docId]);
    expect(sigs.map((s) => s.party_role)).toEqual(['BUYER', 'COMPANY', 'SELLER']);
    expect(sigs.find((s) => s.party_role === 'COMPANY')!.typed_name).toBe('Charles Zigmund');
    const [d] = await h.q<{ status: string; effective_date: string; org_id: string }>(
      `select status, effective_date, org_id from documents where id=$1`, [docId]);
    expect(d.status).toBe('EXECUTED');
    expect(d.effective_date).toBeTruthy();
    expect(d.org_id).toBe(orgA);
  });
});

describe('chain 2 — EXECUTED → document_deliveries (the deliver-document tail)', () => {
  /**
   * The server-only delivery writer (api/deliver-document.ts, admin client):
   * guard on EXECUTED, recipients = engagement parties, idempotent per
   * (document, recipient, EMAIL). Reproduced here against the real tables.
   */
  async function deliverExecuted(documentId: string): Promise<number> {
    await h.asServiceRole();
    const [doc] = await h.q<{ status: string; engagement_id: string }>(
      `select status, engagement_id from documents where id=$1`, [documentId]);
    if (doc.status !== 'EXECUTED') return 0; // the API's 409 guard — no premature delivery
    const parties = await h.q<{ contact_id: string }>(
      `select contact_id from engagement_parties where engagement_id=$1`, [doc.engagement_id]);
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

  it('delivers one EMAIL copy per engagement party once EXECUTED', async () => {
    const n = await deliverExecuted(docId);
    expect(n).toBe(3); // BUYER + SELLER + COMPANY

    await h.asUser(aAdmin);
    const rows = await h.q<{ recipient_contact_id: string; channel: string; copy_url: string }>(
      `select recipient_contact_id, channel, copy_url from document_deliveries where document_id=$1`, [docId]);
    expect(rows).toHaveLength(3);
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
    const [{ n: count }] = await h.q<{ n: string }>(
      `select count(*)::text as n from document_deliveries where document_id=$1 and channel='EMAIL'`, [docId]);
    expect(Number(count)).toBe(3);
  });

  it('a not-yet-EXECUTED document is never delivered (the 409 guard)', async () => {
    await h.asUser(aAdmin);
    const [draft] = await h.q<{ document_id: string }>(
      `select document_id from generate_document($1,'HORSE_PURCHASE_SALE')`, [engId]);
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
    expect(await h.q(`select id from intake_submissions where id=$1`, [submissionId])).toHaveLength(0);
  });
});
