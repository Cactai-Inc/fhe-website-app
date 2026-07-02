/**
 * Client engagements + self-signing (lane 1) — RLS + record_signature authz.
 *
 * Proves, against the real migrations (through 20260702000000):
 *  (a) a member (USER role) whose profile.contact_id is the engagement client's
 *      contact READS their own engagement / parties / documents rows, and a
 *      stranger member reads NONE of them (RLS, not the UI, is the fence);
 *  (b) record_signature verifies the CALLER:
 *      - a stranger cannot sign another client's document (no forged signature
 *        row is created, the document never advances),
 *      - the party's own contact CAN self-sign exactly their own role,
 *      - the party's contact canNOT sign a role that isn't theirs (COMPANY),
 *      - tenant staff still facilitate any party (assisted signing).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let admin: string;      // tenant staff (ADMIN)
let memberUid: string;  // the client's own portal login (USER)
let strangerUid: string; // another client's portal login (USER)
let contactA: string;   // the client (BUYER party)
let contactB: string;   // the stranger's contact
let eng: string;
let doc: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  contactA = (await h.q<{ id: string }>(
    `insert into contacts (full_name, email) values ('Alice Client','alice@ex.com') returning id`))[0].id;
  contactB = (await h.q<{ id: string }>(
    `insert into contacts (full_name, email) values ('Sam Stranger','sam@ex.com') returning id`))[0].id;

  admin = await h.createAuthUser({ email: 'staff@fhe.test', role: 'ADMIN' });
  memberUid = await h.createAuthUser({ email: 'alice@fhe.test', role: 'USER' });
  strangerUid = await h.createAuthUser({ email: 'sam@fhe.test', role: 'USER' });
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contactA, memberUid]);
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contactB, strangerUid]);
  // the stranger is a real client of the org too — just not on THIS engagement
  await h.q(`insert into clients (contact_id) values ($1)`, [contactB]);

  // staff opens Alice's purchase engagement and generates the agreement
  await h.asUser(admin);
  eng = (await h.q<{ create_purchase_engagement: string }>(
    `select create_purchase_engagement($1,null,null,12000,2000)`, [contactA]))[0].create_purchase_engagement;
  doc = (await h.q<{ document_id: string }>(
    `select * from generate_document($1,'HORSE_PURCHASE_SALE')`, [eng]))[0].document_id;
  await h.asSuperuser();
});

afterAll(async () => {
  await h?.close();
});

// ============================================================
// (a) client-scoped reads — the member portal's data path
// ============================================================
describe('client-scoped reads (MyEngagements / MyEngagementDetail rely on RLS)', () => {
  it('the member reads their own engagement, parties, and document', async () => {
    await h.asUser(memberUid);
    const engs = await h.q<{ id: string }>(`select id from engagements`);
    expect(engs.map((e) => e.id)).toContain(eng);
    const parties = await h.q<{ party_role: string }>(
      `select party_role from engagement_parties where engagement_id=$1 order by signer_order`, [eng]);
    expect(parties.map((p) => p.party_role)).toEqual(['BUYER', 'COMPANY']);
    const docs = await h.q<{ id: string }>(`select id from documents where engagement_id=$1`, [eng]);
    expect(docs.map((d) => d.id)).toContain(doc);
  });

  it('a stranger member reads NONE of it', async () => {
    await h.asUser(strangerUid);
    expect(await h.q(`select id from engagements where id=$1`, [eng])).toHaveLength(0);
    expect(await h.q(`select id from engagement_parties where engagement_id=$1`, [eng])).toHaveLength(0);
    expect(await h.q(`select id from documents where id=$1`, [doc])).toHaveLength(0);
  });
});

// ============================================================
// (b) record_signature — caller verification (20260702000000)
// ============================================================
describe('record_signature caller verification', () => {
  it('a stranger cannot sign another client\'s document as its party', async () => {
    await h.asUser(strangerUid);
    await expect(
      h.q(`select record_signature($1,'BUYER','Forged Alice')`, [doc]),
    ).rejects.toThrow(/not authorized to sign/);

    await h.asSuperuser();
    // no forged signature row, document did not advance
    expect(await h.q(`select id from signatures where document_id=$1`, [doc])).toHaveLength(0);
    const [{ status }] = await h.q<{ status: string }>(
      `select status from documents where id=$1`, [doc]);
    expect(status).not.toBe('EXECUTED');
  });

  it('the party\'s own contact self-signs their own role', async () => {
    await h.asUser(memberUid);
    const [{ record_signature: status }] = await h.q<{ record_signature: string }>(
      `select record_signature($1,'BUYER','Alice Client')`, [doc]);
    expect(status).toBeTruthy();

    await h.asSuperuser();
    const sigs = await h.q<{ signer_contact_id: string; party_role: string; signed_at: string }>(
      `select signer_contact_id, party_role, signed_at from signatures where document_id=$1`, [doc]);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].signer_contact_id).toBe(contactA);
    expect(sigs[0].party_role).toBe('BUYER');
    expect(sigs[0].signed_at).toBeTruthy();
  });

  it('the member cannot sign a role that is not theirs (COMPANY)', async () => {
    await h.asUser(memberUid);
    await expect(
      h.q(`select record_signature($1,'COMPANY','Alice Client')`, [doc]),
    ).rejects.toThrow(/not authorized to sign/);
  });

  it('tenant staff still facilitate any party, and the document executes', async () => {
    await h.asUser(admin);
    const [{ record_signature: status }] = await h.q<{ record_signature: string }>(
      `select record_signature($1,'COMPANY','Charles Zigmund')`, [doc]);
    expect(status).toBe('EXECUTED');
  });

  it('an unauthenticated caller is still rejected outright', async () => {
    await h.asAnon();
    await expect(
      h.q(`select record_signature($1,'BUYER','Nobody')`, [doc]),
    ).rejects.toThrow(/authentication required/);
  });
});
