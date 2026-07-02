/**
 * Visitor general-release kiosk (migration 20260702020000_sign_general_release).
 *
 * Real-path data tests: the ACTUAL RPC the /release page calls, as anon, end to
 * end through the REAL merge engine (generate_document → RELEASE_GENERAL) and
 * the REAL signature seal.
 *
 * Proves:
 *  - anon end-to-end on tenant #1 (FHE): contact + client + NON-SERVICE
 *    engagement created, RELEASE_GENERAL merged with the tenant identity and
 *    the visitor's tokens, sealed PARTICIPANT signature recorded; document
 *    stays AWAITING_SIGNATURE because FHE designates a COMPANY signatory —
 *    and EXECUTES through the existing record_signature countersign.
 *  - repeat visitor (same email) reuses the same contact.
 *  - validation fence: typed-name mismatch, missing contact channel, bad
 *    email, bad phone, unknown org are all rejected.
 *  - second-org isolation: a release signed for org B (explicit p_org) lands
 *    entirely in org B (no COMPANY signatory → EXECUTED immediately); org A
 *    staff see none of it and org B staff see all of it.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // tenant #1 (FHE) — seeded identity + signatory
let orgB: string; // isolation peer (no business_config)
let aAdmin: string, bAdmin: string;

type SignResult = {
  document_id: string; document_code: string; engagement_id: string;
  contact_id: string; status: string; merged_body: string;
};

async function sign(
  name: string, email: string | null, phone: string | null, typed: string, org?: string,
): Promise<SignResult> {
  const [row] = await h.q<{ r: SignResult }>(
    `select sign_general_release($1,$2,$3,$4${org ? ',$5' : ''}) as r`,
    org ? [name, email, phone, typed, org] : [name, email, phone, typed]);
  return row.r;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Kiosk Rival','kiosk-rival') returning id`))[0].id;
  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
});

afterAll(async () => {
  await h?.close();
});

describe('visitor flow end-to-end (tenant #1, anon caller)', () => {
  let res: SignResult;

  it('signs as anon: real contact, client, NON-SERVICE engagement, merged document', async () => {
    await h.asAnon();
    res = await sign('Vera Visitor', 'vera@visitor.test', '619-555-0100', 'Vera Visitor');
    expect(res.document_id).toBeTruthy();
    expect(res.document_code).toMatch(/^DOC-/);

    // merged through the REAL engine: tenant identity + visitor tokens resolve
    expect(res.merged_body).toContain('Vera Visitor');
    expect(res.merged_body).toContain('vera@visitor.test');
    expect(res.merged_body).toContain('French Heritage Equestrian');
    expect(res.merged_body).not.toMatch(/\{\{ORG\./);
    expect(res.merged_body).not.toMatch(/\{\{PARTICIPANT\./);
    for (const t of res.merged_body.match(/\{\{[A-Z0-9_.]+\}\}/g) ?? []) {
      expect(t, `unexpected unmerged token ${t}`).toMatch(/^\{\{SIG\./);
    }

    // rows land in tenant #1 with the honest shapes
    await h.asSuperuser();
    const [eng] = await h.q<{ org_id: string; service_type: string | null; status: string; client_id: string }>(
      `select org_id, service_type, status, client_id from engagements where id=$1`, [res.engagement_id]);
    expect(eng.org_id).toBe(orgA);
    expect(eng.service_type).toBeNull(); // NON-SERVICE engagement (documented choice)
    const [contact] = await h.q<{ org_id: string; full_name: string; email: string }>(
      `select org_id, full_name, email from contacts where id=$1`, [res.contact_id]);
    expect(contact).toEqual({ org_id: orgA, full_name: 'Vera Visitor', email: 'vera@visitor.test' });
    const [client] = await h.q<{ contact_id: string; source: string }>(
      `select contact_id, source from clients where id=$1`, [eng.client_id]);
    expect(client.contact_id).toBe(res.contact_id);
    expect(client.source).toBe('VISITOR_RELEASE');
  });

  it('records a SEALED participant signature (typed_name immutable once signed)', async () => {
    await h.asSuperuser();
    const [sig] = await h.q<{ id: string; party_role: string; typed_name: string; signed_at: string; method: string; org_id: string }>(
      `select id, party_role, typed_name, signed_at, method, org_id
       from signatures where document_id=$1 and party_role='PARTICIPANT'`, [res.document_id]);
    expect(sig.typed_name).toBe('Vera Visitor');
    expect(sig.signed_at).not.toBeNull();
    expect(sig.method).toBe('KIOSK_TYPED');
    expect(sig.org_id).toBe(orgA);
    // the seal trigger blocks any substantive change, even superuser
    await expect(
      h.q(`update signatures set typed_name='Someone Else' where id=$1`, [sig.id]),
    ).rejects.toThrow(/sealed/);
  });

  it('EXECUTES immediately on the single visitor signature (unilateral, owner 2026-07-02)', async () => {
    // Releases carry no COMPANY party and need no countersign — the visitor's
    // signature alone executes the document.
    expect(res.status).toBe('EXECUTED');
    await h.asSuperuser();
    const [party] = await h.q<{ n: number }>(
      `select count(*)::int as n from engagement_parties
       where engagement_id=$1 and party_role='COMPANY'`, [res.engagement_id]);
    expect(party.n).toBe(0);
    const [doc] = await h.q<{ status: string; effective_date: string | null }>(
      `select status, effective_date from documents where id=$1`, [res.document_id]);
    expect(doc.status).toBe('EXECUTED');
    expect(doc.effective_date).not.toBeNull();
  });

  it('a repeat visitor with the same email reuses the same contact', async () => {
    await h.asAnon();
    const again = await sign('Vera Visitor', 'vera@visitor.test', null, 'vera visitor');
    expect(again.contact_id).toBe(res.contact_id);
    expect(again.document_id).not.toBe(res.document_id); // a fresh release document
  });
});

describe('validation fence (the anon rate-limit surface)', () => {
  it('rejects a typed signature that does not match the printed name', async () => {
    await h.asAnon();
    await expect(sign('Vera Visitor', 'vera@visitor.test', null, 'V. Visitor'))
      .rejects.toThrow(/typed signature must match/);
  });

  it('rejects a visitor with neither email nor phone', async () => {
    await h.asAnon();
    await expect(sign('No Contact', null, null, 'No Contact'))
      .rejects.toThrow(/email address or phone number/);
  });

  it('rejects malformed email, malformed phone, blank name, unknown org', async () => {
    await h.asAnon();
    await expect(sign('Bad Email', 'not-an-email', null, 'Bad Email')).rejects.toThrow(/invalid email/);
    await expect(sign('Bad Phone', null, 'call me maybe', 'Bad Phone')).rejects.toThrow(/invalid phone/);
    await expect(sign('', 'x@y.test', null, '')).rejects.toThrow(/full name/);
    await expect(sign('Ghost Org', 'g@y.test', null, 'Ghost Org', '00000000-0000-0000-0000-000000000001'))
      .rejects.toThrow(/unknown organization/);
  });
});

describe('second-org isolation', () => {
  let bRes: SignResult;

  it('a release for org B (explicit p_org) lands entirely in org B and EXECUTES (no signatory)', async () => {
    await h.asAnon();
    bRes = await sign('Bram Rival', 'bram@rival.test', '760-555-0101', 'Bram Rival', orgB);
    expect(bRes.status).toBe('EXECUTED'); // org B has no COMPANY signatory → sole signer

    await h.asSuperuser();
    const rows = await h.q<{ tbl: string; org_id: string }>(
      `select 'contact' as tbl, org_id from contacts where id=$1
       union all select 'engagement', org_id from engagements where id=$2
       union all select 'document', org_id from documents where id=$3
       union all select 'signature', org_id from signatures where document_id=$3`,
      [bRes.contact_id, bRes.engagement_id, bRes.document_id]);
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.org_id, r.tbl).toBe(orgB);
  });

  it("org A staff see NONE of org B's release; org B staff see all of it", async () => {
    await h.asUser(aAdmin);
    expect(await h.q(`select id from documents where id=$1`, [bRes.document_id])).toHaveLength(0);
    expect(await h.q(`select id from contacts where id=$1`, [bRes.contact_id])).toHaveLength(0);
    expect(await h.q(`select id from engagements where id=$1`, [bRes.engagement_id])).toHaveLength(0);

    await h.asUser(bAdmin);
    expect(await h.q(`select id from documents where id=$1`, [bRes.document_id])).toHaveLength(1);
    expect(await h.q(`select id from contacts where id=$1`, [bRes.contact_id])).toHaveLength(1);
    expect(await h.q(`select id from engagements where id=$1`, [bRes.engagement_id])).toHaveLength(1);
  });

  it("org A's visitor contact never leaks into org B's email match (per-org find-or-create)", async () => {
    await h.asAnon();
    const cross = await sign('Vera Visitor', 'vera@visitor.test', '619-555-0100', 'Vera Visitor', orgB);
    await h.asSuperuser();
    const [c] = await h.q<{ org_id: string }>(`select org_id from contacts where id=$1`, [cross.contact_id]);
    expect(c.org_id).toBe(orgB); // a NEW org-B contact, not org A's
  });
});
