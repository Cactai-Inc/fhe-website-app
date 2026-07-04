/**
 * CA e-signature legal hardening (20260703110000) — proven against the REAL
 * signing RPCs in PGlite (pgcrypto loaded by the harness):
 *
 *  - CONSENT GATE: new kiosk signings are REJECTED without p_esign_consent
 *    (sign_release AND the sign_general_release wrapper, which forwards its
 *    own trailing consent param — never hardcodes it);
 *  - CONSENT LOG: consent-bearing signings write an esign_consents row (org +
 *    contact + document + attribution) on BOTH the kiosk path and
 *    record_signature; record_signature stays optional-but-logged (a 3-arg
 *    positional call — the pre-checkbox staff shape — still signs, no row);
 *  - SESSION ATTRIBUTION: ip_address/user_agent land on every new signature —
 *    read from PostgREST's request.headers GUC (x-forwarded-for FIRST hop)
 *    when not supplied; an explicit p_ip parameter wins over the header; the
 *    GUC absent → NULLs (guarded current_setting — signing never blocks);
 *  - TAMPER EVIDENCE: documents.execution_hash is stamped at the EXECUTED
 *    flip, matches an independent sha256 recompute over the FINAL merged body
 *    + the sealed signature fields, is STABLE across a re-sign of an executed
 *    document, and is ABSENT (NULL) on drafts;
 *  - esign_consents RLS: staff read within their org; members read nothing;
 *    direct INSERTs are denied (SECURITY DEFINER paths only).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let org1: string;
let admin: string;
let rider: string;
let tierId: string;
let docs: Array<{ document_id: string; template_key: string; title: string; status: string }>;

const KIOSK_HEADERS = JSON.stringify({
  'x-forwarded-for': '203.0.113.7, 10.0.0.1',
  'user-agent': 'KioskPad/2.0 (esign-hardening test)',
});

/** Set / clear the PostgREST request-headers GUC the server reads. */
async function setHeaders(json: string | null) {
  await h.q(`select set_config('request.headers', $1, false)`, [json ?? '']);
}

interface SignRow {
  document_id: string; document_code: string; engagement_id: string;
  contact_id: string; status: string; merged_body: string;
}

/** Kiosk sign helper — full positional call incl. the new trailing consent. */
async function kioskSign(over: Partial<Record<string, unknown>> = {}) {
  const [raw] = await h.q<{ sign_release: SignRow | string }>(
    `select sign_release($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12,$13,$14)`,
    [
      over.template_key ?? 'RELEASE_GENERAL',
      over.first_name ?? 'Esther',
      over.last_name ?? 'Esign',
      over.email ?? 'esther@esign.test',
      over.phone ?? null,
      over.typed_name ?? 'Esther Esign',
      over.is_minor ?? false,
      over.minor_first_name ?? null,
      over.minor_last_name ?? null,
      over.minor_dob ?? null,
      over.guardian_relationship ?? null,
      over.rules_acknowledged ?? true,
      over.org ?? null,
      over.esign_consent ?? true,
    ],
  );
  const v = raw.sign_release;
  return (typeof v === 'string' ? JSON.parse(v) : v) as SignRow;
}

/** Independent recompute of the execution-hash formula (raw SQL, no helper). */
async function recomputeHash(documentId: string): Promise<string> {
  const [r] = await h.q<{ hash: string }>(
    `select encode(digest(convert_to(
        d.merged_body || '|' || s.signer_contact_id::text || '|' ||
        s.typed_name || '|' || s.signed_at::text, 'UTF8'), 'sha256'), 'hex') as hash
     from documents d
     join signatures s on s.document_id = d.id and s.deleted_at is null
     where d.id = $1
     order by s.signed_at desc limit 1`,
    [documentId]);
  return r.hash;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org1 = (await h.q<{ id: string }>(
    `select id from organizations order by created_at limit 1`))[0].id;
  admin = await h.createAuthUser({ email: 'ops@fhe.test', isAdmin: true });
  rider = await h.createAuthUser({ email: 'esign.rider@test.fhe' });
  const [t] = await h.q<{ id: string }>(
    `select t.id from offering_tiers t join offerings o on o.id = t.offering_id
     where o.slug = 'riding-lesson' and t.label = '4-Lesson Punch Card'`);
  tierId = t.id;
});
afterAll(async () => {
  await h?.close();
});

describe('kiosk consent gate (sign_release + sign_general_release)', () => {
  it('sign_release REJECTS a signing without electronic-signing consent', async () => {
    await h.asAnon();
    await expect(kioskSign({ esign_consent: false }))
      .rejects.toThrow(/electronic signing consent is required/);
    // the rules gate still fires first-class (consent true, rules false)
    await expect(kioskSign({ rules_acknowledged: false }))
      .rejects.toThrow(/rules/i);
  });

  it('sign_general_release forwards its OWN consent param — default false rejects', async () => {
    await h.asAnon();
    // legacy 4-arg positional shape → consent defaults false → rejected
    await expect(h.q(
      `select sign_general_release('Walk In','walkin@esign.test',null,'Walk In')`))
      .rejects.toThrow(/electronic signing consent is required/);
    // explicit consent signs through the wrapper
    const [row] = await h.q<{ r: SignRow | string }>(
      `select sign_general_release('Walk In','walkin@esign.test',null,'Walk In',null,true) as r`);
    const res = (typeof row.r === 'string' ? JSON.parse(row.r) : row.r) as SignRow;
    expect(res.status).toBe('EXECUTED');

    await h.asSuperuser();
    const consents = await h.q<{ contact_id: string; document_id: string }>(
      `select contact_id, document_id from esign_consents where document_id = $1`,
      [res.document_id]);
    expect(consents).toHaveLength(1);
    expect(consents[0].contact_id).toBe(res.contact_id);
  });
});

describe('kiosk signing with consent — consent log + attribution + hash', () => {
  let res: SignRow;

  it('logs the esign_consents row and captures ip/user-agent from request.headers', async () => {
    await h.asAnon();
    await setHeaders(KIOSK_HEADERS);
    res = await kioskSign({});
    await setHeaders(null);
    expect(res.status).toBe('EXECUTED');

    await h.asSuperuser();
    const [consent] = await h.q<{
      org_id: string; contact_id: string; document_id: string; kind: string;
      ip_address: string | null; user_agent: string | null; consented_at: string;
    }>(
      `select org_id, contact_id, document_id, kind, ip_address, user_agent, consented_at
       from esign_consents where document_id = $1`, [res.document_id]);
    expect(consent.org_id).toBe(org1);
    expect(consent.contact_id).toBe(res.contact_id);
    expect(consent.kind).toBe('ESIGN_CONSENT');
    expect(consent.consented_at).toBeTruthy();
    // attribution: FIRST x-forwarded-for hop + the user agent
    expect(consent.ip_address).toBe('203.0.113.7');
    expect(consent.user_agent).toBe('KioskPad/2.0 (esign-hardening test)');

    const [sig] = await h.q<{ ip_address: string | null; user_agent: string | null; method: string }>(
      `select ip_address, user_agent, method from signatures where document_id = $1`,
      [res.document_id]);
    expect(sig.method).toBe('KIOSK_TYPED');
    expect(sig.ip_address).toBe('203.0.113.7');
    expect(sig.user_agent).toBe('KioskPad/2.0 (esign-hardening test)');
  });

  it('stamps execution_hash over the FINAL body; an independent recompute matches', async () => {
    await h.asSuperuser();
    const [doc] = await h.q<{ status: string; execution_hash: string | null; merged_body: string }>(
      `select status, execution_hash, merged_body from documents where id = $1`,
      [res.document_id]);
    expect(doc.status).toBe('EXECUTED');
    expect(doc.execution_hash).toMatch(/^[0-9a-f]{64}$/);
    // the hash covers the FINAL text: post SIG-substitution + rules tail
    expect(doc.merged_body).toContain('Signature: Esther Esign');
    expect(doc.merged_body).toMatch(/acknowledged the Facility Rules/i);
    expect(await recomputeHash(res.document_id)).toBe(doc.execution_hash);
  });

  it('the GUC absent → NULL attribution (guarded read — signing never blocks)', async () => {
    await h.asAnon();
    const bare = await kioskSign({ email: 'noheaders@esign.test', first_name: 'Nora',
      last_name: 'Noheader', typed_name: 'Nora Noheader' });
    expect(bare.status).toBe('EXECUTED');
    await h.asSuperuser();
    const [sig] = await h.q<{ ip_address: string | null; user_agent: string | null }>(
      `select ip_address, user_agent from signatures where document_id = $1`,
      [bare.document_id]);
    expect(sig.ip_address).toBeNull();
    expect(sig.user_agent).toBeNull();
  });
});

describe('record_signature v5 — in-app/staff path', () => {
  it('provisions + generates the onboarding set: drafts carry NO execution_hash', async () => {
    await h.asUser(admin);
    await h.q(
      `select provision_lesson_invitation('esign.rider@test.fhe','Rita','Rider',$1,true,'Zelle',null)`,
      [tierId]);

    await h.asUser(rider);
    await h.q(`select update_my_onboarding_profile($1::jsonb)`, [JSON.stringify({
      phone: '555-0177',
      date_of_birth: '1994-02-02',
      emergency_contact_1_name: 'Ray Rider',
      emergency_contact_1_relationship: 'Father',
      emergency_contact_1_phone: '555-0100',
    })]);
    const [g] = await h.q<{ generate_my_onboarding_documents: typeof docs }>(
      `select generate_my_onboarding_documents()`);
    docs = g.generate_my_onboarding_documents;
    expect(docs.length).toBeGreaterThan(1);

    await h.asSuperuser();
    const hashes = await h.q<{ execution_hash: string | null }>(
      `select execution_hash from documents where id = any($1::uuid[])`,
      [docs.map((d) => d.document_id)]);
    expect(hashes).toHaveLength(docs.length);
    for (const r of hashes) expect(r.execution_hash).toBeNull();
  });

  it('a legacy 3-arg positional call still signs (consent optional — no row logged)', async () => {
    await h.asUser(rider);
    const [s] = await h.q<{ record_signature: string }>(
      `select record_signature($1,'CLIENT',$2)`, [docs[0].document_id, 'Rita Rider']);
    expect(s.record_signature).toBe('EXECUTED');

    await h.asSuperuser();
    expect(await h.q(
      `select id from esign_consents where document_id = $1`, [docs[0].document_id]))
      .toHaveLength(0);
    // executed via record_signature → hash stamped there too
    const [doc] = await h.q<{ execution_hash: string | null }>(
      `select execution_hash from documents where id = $1`, [docs[0].document_id]);
    expect(doc.execution_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await recomputeHash(docs[0].document_id)).toBe(doc.execution_hash);
  });

  it('consent-bearing sign logs the row; header attribution lands on the signature', async () => {
    await h.asUser(rider);
    await setHeaders(JSON.stringify({
      'x-forwarded-for': '198.51.100.20',
      'user-agent': 'RiderApp/3.1 (esign test)',
    }));
    const [s] = await h.q<{ record_signature: string }>(
      `select record_signature($1,'CLIENT',$2,null,null,true)`,
      [docs[1].document_id, 'Rita Rider']);
    await setHeaders(null);
    expect(s.record_signature).toBe('EXECUTED');

    await h.asSuperuser();
    const [consent] = await h.q<{
      org_id: string; contact_id: string; ip_address: string | null; user_agent: string | null;
    }>(
      `select c.org_id, c.contact_id, c.ip_address, c.user_agent
       from esign_consents c where c.document_id = $1`, [docs[1].document_id]);
    expect(consent).toBeTruthy();
    expect(consent.org_id).toBe(org1);
    expect(consent.ip_address).toBe('198.51.100.20');
    expect(consent.user_agent).toBe('RiderApp/3.1 (esign test)');
    // the consent row's contact IS the signer
    const [sig] = await h.q<{ signer_contact_id: string; ip_address: string; user_agent: string }>(
      `select signer_contact_id, ip_address, user_agent from signatures where document_id = $1`,
      [docs[1].document_id]);
    expect(consent.contact_id).toBe(sig.signer_contact_id);
    expect(sig.ip_address).toBe('198.51.100.20');
    expect(sig.user_agent).toBe('RiderApp/3.1 (esign test)');
  });

  it('an explicit p_ip parameter wins over the request header', async () => {
    await h.asUser(rider);
    await setHeaders(JSON.stringify({ 'x-forwarded-for': '192.0.2.99', 'user-agent': 'Header/1' }));
    const [s] = await h.q<{ record_signature: string }>(
      `select record_signature($1,'CLIENT',$2,$3)`,
      [docs[2].document_id, 'Rita Rider', '203.0.113.250']);
    await setHeaders(null);
    expect(s.record_signature).toBe('EXECUTED');

    await h.asSuperuser();
    const [sig] = await h.q<{ ip_address: string; user_agent: string }>(
      `select ip_address, user_agent from signatures where document_id = $1`,
      [docs[2].document_id]);
    expect(sig.ip_address).toBe('203.0.113.250'); // explicit param wins
    expect(sig.user_agent).toBe('Header/1');      // ua still from the header
  });

  it('the hash is STABLE: re-signing an executed document never rewrites it', async () => {
    await h.asSuperuser();
    const [before] = await h.q<{ execution_hash: string }>(
      `select execution_hash from documents where id = $1`, [docs[0].document_id]);

    await h.asUser(rider);
    const [again] = await h.q<{ record_signature: string }>(
      `select record_signature($1,'CLIENT',$2)`, [docs[0].document_id, 'Rita Rider']);
    expect(again.record_signature).toBe('EXECUTED');

    await h.asSuperuser();
    const [after] = await h.q<{ execution_hash: string }>(
      `select execution_hash from documents where id = $1`, [docs[0].document_id]);
    expect(after.execution_hash).toBe(before.execution_hash);
    expect(await recomputeHash(docs[0].document_id)).toBe(after.execution_hash);
  });
});

describe('esign_consents RLS — staff read, definer-only writes', () => {
  it('staff read consents in their org; a plain member reads none', async () => {
    await h.asUser(admin);
    const staffView = await h.q<{ id: string }>(`select id from esign_consents`);
    expect(staffView.length).toBeGreaterThan(0);

    await h.asUser(rider);
    expect(await h.q(`select id from esign_consents`)).toHaveLength(0);
  });

  it('direct INSERTs are denied for members, staff, and anon (SECURITY DEFINER only)', async () => {
    await h.asSuperuser();
    const [anyContact] = await h.q<{ id: string }>(`select id from contacts limit 1`);

    await h.asUser(rider);
    await expect(h.q(
      `insert into esign_consents (org_id, contact_id) values ($1, $2)`,
      [org1, anyContact.id])).rejects.toThrow(/permission denied|row-level security/);

    await h.asUser(admin);
    await expect(h.q(
      `insert into esign_consents (org_id, contact_id) values ($1, $2)`,
      [org1, anyContact.id])).rejects.toThrow(/permission denied|row-level security/);

    await h.asAnon();
    await expect(h.q(
      `insert into esign_consents (org_id, contact_id) values ($1, $2)`,
      [org1, anyContact.id])).rejects.toThrow(/permission denied|row-level security/);
  });
});
