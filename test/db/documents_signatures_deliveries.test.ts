/**
 * Category 1 — Schema: documents, signatures & deliveries (migration 012).
 *
 * Proves the assemble→sign→deliver substrate:
 *  - migration 12 applies after the templates/tokens migration,
 *  - document_status seeds the DRAFT→AWAITING_SIGNATURE→EXECUTED(+VOID) lifecycle,
 *  - documents get DOC- identifiers and FK their engagement + template + status,
 *  - a signature seals on signed_at: substantive edits are blocked thereafter
 *    (admin included); archival columns stay mutable,
 *  - RLS: a client reads only their own documents/signatures and may self-sign;
 *    strangers are blocked,
 *  - documents and signatures are never hard-deletable.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, migrationFiles, type TestDb } from './harness';

let h: TestDb;

beforeAll(async () => {
  h = await createTestDb();
});
afterAll(async () => {
  await h?.close();
});

// Build an engagement owned by a fresh client user; returns the ids + uid.
async function makeOwnedEngagement(email: string) {
  await h.asSuperuser();
  const uid = await h.createAuthUser({ email });
  const contact = (await h.q<{ id: string }>(
    `insert into contacts (first_name, email) values ($1,$2) returning id`,
    [email, email]))[0].id;
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contact, uid]);
  const client = (await h.q<{ id: string }>(
    `insert into clients (contact_id) values ($1) returning id`, [contact]))[0].id;
  const eng = (await h.q<{ id: string }>(
    `insert into engagements (client_id, service_type) values ($1,'HORSE_PURCHASE_ASSISTANCE') returning id`,
    [client]))[0].id;
  return { uid, contact, client, eng };
}

describe('migration applies additively', () => {
  it('lands after the contract templates migration', () => {
    const files = migrationFiles();
    const tpl = files.findIndex((f) => f.includes('contract_templates_tokens'));
    const doc = files.findIndex((f) => f.includes('documents_signatures_deliveries'));
    expect(tpl).toBeGreaterThanOrEqual(0);
    expect(doc).toBeGreaterThan(tpl);
  });

  it('seeds the document status lifecycle', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ code: string }>(`select code from document_status order by sort_order`);
    expect(rows.map((r) => r.code)).toEqual(['DRAFT', 'AWAITING_SIGNATURE', 'EXECUTED', 'VOID']);
  });
});

describe('documents', () => {
  it('assigns DOC- identifiers and defaults to DRAFT', async () => {
    const { eng } = await makeOwnedEngagement('doc-owner@fhe');
    const tpl = (await h.q<{ id: string }>(
      `select id from contract_templates where template_key='HORSE_PURCHASE_SALE'`))[0].id;
    const doc = (await h.q<{ display_code: string; status: string }>(
      `insert into documents (engagement_id, template_id, title) values ($1,$2,'Purchase and Sale')
       returning display_code, status`, [eng, tpl]))[0];
    // Random non-enumerable codes (20260702070000): unambiguous alphabet, 10 chars.
    expect(doc.display_code).toMatch(/^DOC-[A-HJ-KM-NP-Z2-9]{10}$/);
    expect(doc.status).toBe('DRAFT');
  });

  it('rejects an unknown status (FK to the lookup)', async () => {
    const { eng } = await makeOwnedEngagement('doc-badstatus@fhe');
    await expect(
      h.q(`insert into documents (engagement_id, status) values ($1,'NOT_A_STATUS')`, [eng]),
    ).rejects.toThrow();
  });
});

describe('signatures seal on signing', () => {
  it('blocks substantive edits once signed_at is set, but allows archival', async () => {
    const { eng, contact } = await makeOwnedEngagement('sig-owner@fhe');
    await h.asSuperuser();
    const doc = (await h.q<{ id: string }>(
      `insert into documents (engagement_id) values ($1) returning id`, [eng]))[0].id;
    const sig = (await h.q<{ id: string }>(
      `insert into signatures (document_id, signer_contact_id, party_role, typed_name, signed_at, ip_address)
       values ($1,$2,'BUYER','Jane Buyer', now(), '203.0.113.7') returning id`, [doc, contact]))[0].id;

    // sealed: cannot change the typed name after signing — even as superuser
    await expect(
      h.q(`update signatures set typed_name='Tampered' where id=$1`, [sig]),
    ).rejects.toThrow(/sealed/);

    // archival (deleted_at) is still permitted
    await h.q(`update signatures set deleted_at=now() where id=$1`, [sig]);
    const archived = (await h.q<{ deleted_at: string | null }>(
      `select deleted_at from signatures where id=$1`, [sig]))[0];
    expect(archived.deleted_at).not.toBeNull();
  });

  it('an unsigned (draft) signature can still be edited', async () => {
    const { eng, contact } = await makeOwnedEngagement('sig-draft@fhe');
    await h.asSuperuser();
    const doc = (await h.q<{ id: string }>(
      `insert into documents (engagement_id) values ($1) returning id`, [eng]))[0].id;
    const sig = (await h.q<{ id: string }>(
      `insert into signatures (document_id, signer_contact_id, party_role) values ($1,$2,'BUYER') returning id`,
      [doc, contact]))[0].id;
    await h.q(`update signatures set party_role='SELLER' where id=$1`, [sig]);
    const role = (await h.q<{ party_role: string }>(`select party_role from signatures where id=$1`, [sig]))[0].party_role;
    expect(role).toBe('SELLER');
  });
});

describe('RLS — owner-scoped, client self-sign', () => {
  it('a client reads only their own documents and may sign as themselves; strangers cannot', async () => {
    const alice = await makeOwnedEngagement('alice-doc@fhe');
    const bob = await makeOwnedEngagement('bob-doc@fhe');
    await h.asSuperuser();
    const aliceDoc = (await h.q<{ id: string }>(
      `insert into documents (engagement_id, status) values ($1,'AWAITING_SIGNATURE') returning id`, [alice.eng]))[0].id;
    const bobDoc = (await h.q<{ id: string }>(
      `insert into documents (engagement_id) values ($1) returning id`, [bob.eng]))[0].id;

    // Alice sees her doc, not Bob's.
    await h.asUser(alice.uid);
    const seen = (await h.q<{ id: string }>(`select id from documents`)).map((r) => r.id);
    expect(seen).toContain(aliceDoc);
    expect(seen).not.toContain(bobDoc);

    // Alice can self-sign her own document.
    await h.q(
      `insert into signatures (document_id, signer_contact_id, party_role, typed_name, signed_at)
       values ($1,$2,'BUYER','Alice', now())`, [aliceDoc, alice.contact]);
    expect(await h.q(`select id from signatures`)).toHaveLength(1);

    // Alice cannot sign on Bob's document, nor as someone else.
    await expect(
      h.q(`insert into signatures (document_id, signer_contact_id, party_role, typed_name)
           values ($1,$2,'BUYER','Alice')`, [bobDoc, alice.contact]),
    ).rejects.toThrow();
    await expect(
      h.q(`insert into signatures (document_id, signer_contact_id, party_role, typed_name)
           values ($1,$2,'SELLER','Imposter')`, [aliceDoc, bob.contact]),
    ).rejects.toThrow();
  });
});

describe('documents & signatures are never hard-deletable', () => {
  it('blocks DELETE even for an admin', async () => {
    const { eng, contact } = await makeOwnedEngagement('nodelete@fhe');
    await h.asSuperuser();
    const adminUid = await h.createAuthUser({ email: 'ops-doc@fhe', isAdmin: true });
    const doc = (await h.q<{ id: string }>(
      `insert into documents (engagement_id) values ($1) returning id`, [eng]))[0].id;
    const sig = (await h.q<{ id: string }>(
      `insert into signatures (document_id, signer_contact_id, party_role) values ($1,$2,'BUYER') returning id`,
      [doc, contact]))[0].id;

    await h.asUser(adminUid);
    await expect(h.q(`delete from documents where id=$1`, [doc])).rejects.toThrow();
    await expect(h.q(`delete from signatures where id=$1`, [sig])).rejects.toThrow();
  });
});
