/**
 * Release kiosk (20260702050000, re-issued 20260703050000 for the owner's
 * 2026-07-03 template revision) — proven end-to-end through the real
 * anon-executable RPCs against the single-CLIENT-signer bodies:
 *  - release_preview: all four releases + FACILITY_RULES merge the org identity
 *    (TRADE NAME ONLY — no personal name) and today's date, and TRUNCATE before
 *    the CLIENT signer block (no SIG tokens, no signature lines, no CUT-marker
 *    comments in previews);
 *  - stripped content: covenant-not-to-sue, CC §1542 waiver, free-floating
 *    initials lines, and the company countersign are gone; media consent is a
 *    default grant with a written email opt-out; term = until superseded;
 *  - sign_release rules gate: rejects unless p_rules_acknowledged, and the
 *    executed body records the dated acknowledgment;
 *  - adult path: the CLIENT signs, EXECUTED immediately, the MINOR_* CUT
 *    section is stripped whole (content AND markers absent);
 *  - minor path: the guardian signs as CLIENT, the minor is a non-signing
 *    PARTICIPANT party, the MINOR_* CUT section is KEPT with the minor's
 *    name + DOB resolved, relationship recorded on the signer party row;
 *  - bad template keys rejected; cross-tenant isolation holds.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

const RELEASES = [
  'RELEASE_GENERAL', 'RELEASE_PARTICIPANT', 'RELEASE_HORSE_CARE',
] as const;

let h: TestDb;
let orgA: string;

async function preview(key: string, org?: string) {
  const [row] = await h.q<{ title: string; body: string }>(
    `select * from release_preview($1,$2)`, [key, org ?? null]);
  return row;
}

interface SignRow {
  document_id: string; document_code: string; engagement_id: string;
  contact_id: string; status: string; merged_body: string;
}
async function sign(input: Partial<Record<string, unknown>>) {
  const [raw] = await h.q<{ sign_release: SignRow | string }>(
    `select sign_release($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12,$13,$14)`,
    [
      input.template_key ?? 'RELEASE_GENERAL',
      input.first_name ?? 'Vera',
      input.last_name ?? 'Visitor',
      input.email ?? 'vera@kiosk.test',
      input.phone ?? null,
      input.typed_name ?? 'Vera Visitor',
      input.is_minor ?? false,
      input.minor_first_name ?? null,
      input.minor_last_name ?? null,
      input.minor_dob ?? null,
      input.guardian_relationship ?? null,
      input.rules_acknowledged ?? true,
      input.org ?? null,
      // e-sign hardening (20260703110000): kiosk signings require consent
      input.esign_consent ?? true,
    ],
  );
  const v = raw.sign_release;
  return (typeof v === 'string' ? JSON.parse(v) : v) as SignRow;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(
    `select id from organizations order by created_at limit 1`))[0].id;
});
afterAll(async () => {
  await h?.close();
});

describe('release_preview — all four releases + the rules gate document', () => {
  it('merges trade name + date, hides signatures, carries the owner content decisions', async () => {
    await h.asAnon();
    for (const key of RELEASES) {
      const row = await preview(key);
      const body = row.body;
      // identity: trade name only — never the personal/sole-prop clause
      expect(body, key).toContain('French Heritage Equestrian');
      expect(body, key).not.toContain('Charles Zigmund');
      expect(body, key).not.toContain('doing business as');
      // dates merged; nothing tokenish or signature-ish remains — the body is
      // truncated before the CLIENT signer block (owner 2026-07-03 canon)
      expect(body, key).not.toMatch(/\{\{[A-Z0-9_.]+\}\}/);
      expect(body, key).not.toContain('Printed Name:');
      expect(body, key).not.toContain('Signature:');
      // CUT-marker comments never reach a rendered preview; the minor section
      // sits below the signer block and is truncated with it
      expect(body, key).not.toContain('<!-- CUT');
      expect(body, key).not.toContain("Minor's Name:");
      // owner strikes
      expect(body.toUpperCase(), key).not.toContain('COVENANT NOT TO SUE');
      expect(body, key).not.toContain('1542');
      expect(body, key).not.toMatch(/Initials Acknowledging/i);
      expect(body, key).not.toContain('One (1) Year');
      expect(body, key).toContain('until superseded');
    }
    // media consent: default grant + written email opt-out (general release)
    const gen = await preview('RELEASE_GENERAL');
    expect(gen.body).toMatch(/royalty-free/i);
    expect(gen.body).toMatch(/revoke .* written notice/is);
    // the rules-gate document previews too, truncated at its own CLIENT block
    const rules = await preview('FACILITY_RULES');
    expect(rules.body).toContain('French Heritage Equestrian');
    expect(rules.body).not.toMatch(/\{\{[A-Z0-9_.]+\}\}/);
    expect(rules.body).not.toContain('Printed Name:');
    expect(rules.body).not.toContain('<!-- CUT');
  });

  it('rejects a non-kiosk template key', async () => {
    await h.asAnon();
    await expect(preview('HORSE_PURCHASE_SALE')).rejects.toThrow();
  });
});

describe('sign_release — rules gate', () => {
  it('rejects without the rules acknowledgment; records it when given', async () => {
    await h.asAnon();
    await expect(sign({ rules_acknowledged: false })).rejects.toThrow(/rules/i);
    const res = await sign({});
    expect(res.status).toBe('EXECUTED');
    expect(res.merged_body).toMatch(/acknowledged the Facility Rules/i);
  });
});

describe('sign_release — adult path', () => {
  it('executes on the single CLIENT signature; minor CUT section stripped whole', async () => {
    await h.asAnon();
    const res = await sign({ first_name: 'Alan', last_name: 'Adult', email: 'alan@kiosk.test', typed_name: 'Alan Adult' });
    expect(res.status).toBe('EXECUTED');
    // the typed signature completes the CLIENT block
    expect(res.merged_body).toContain('Printed Name: Alan Adult');
    expect(res.merged_body).toContain('Signature: Alan Adult');
    // nothing tokenish survives signing (SIG.CLIENT.* substituted)
    expect(res.merged_body).not.toMatch(/\{\{[A-Z0-9_.]+\}\}/);
    // adult-only: the MINOR_* CUT section is removed whole — content AND markers
    expect(res.merged_body).not.toContain('<!-- CUT');
    expect(res.merged_body).not.toContain("Minor's Name:");
    expect(res.merged_body).not.toContain('MINOR (IF APPLICABLE)');
    await h.asSuperuser();
    const sigs = await h.q<{ party_role: string; typed_name: string }>(
      `select party_role, typed_name from signatures where document_id=$1`, [res.document_id]);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].party_role).toBe('CLIENT');
  });
});

describe('sign_release — minor path', () => {
  it('guardian signs as CLIENT; minor is a non-signing PARTICIPANT; MINOR section kept with name + DOB', async () => {
    await h.asAnon();
    const res = await sign({
      template_key: 'RELEASE_PARTICIPANT',
      first_name: 'Gail', last_name: 'Guardian', email: 'gail@kiosk.test', typed_name: 'Gail Guardian',
      is_minor: true, minor_first_name: 'Milo', minor_last_name: 'Minor', minor_dob: '2015-04-09',
      guardian_relationship: 'Mother',
    });
    expect(res.status).toBe('EXECUTED');
    // the MINOR_PARTICIPANT CUT section is KEPT (markers stripped) with the
    // minor's identity resolved from the PARTICIPANT contact
    expect(res.merged_body).toContain('MINOR PARTICIPANT (IF APPLICABLE)');
    expect(res.merged_body).toContain("Minor's Name: Milo Minor");
    expect(res.merged_body).toContain('Date of Birth: April 9, 2015');
    expect(res.merged_body).toMatch(/parent or legal guardian/i);
    expect(res.merged_body).not.toContain('<!-- CUT');
    // the guardian signs the single CLIENT block
    expect(res.merged_body).toContain('Printed Name: Gail Guardian');
    expect(res.merged_body).toContain('Signature: Gail Guardian');
    expect(res.merged_body).not.toMatch(/\{\{[A-Z0-9_.]+\}\}/);

    await h.asSuperuser();
    const sigs = await h.q<{ party_role: string }>(
      `select party_role from signatures where document_id=$1`, [res.document_id]);
    expect(sigs.map((s) => s.party_role)).toEqual(['CLIENT']);
    const parties = await h.q<{ party_role: string; is_signer: boolean; relationship: string | null }>(
      `select party_role, is_signer, relationship from engagement_parties
       where engagement_id=$1 order by party_role`, [res.engagement_id]);
    expect(parties).toEqual([
      { party_role: 'CLIENT', is_signer: true, relationship: 'Mother' },
      { party_role: 'PARTICIPANT', is_signer: false, relationship: null },
    ]);
    // the submitted DOB lands on the minor's contact (the token's source)
    const [minor] = await h.q<{ date_of_birth: string }>(
      `select c.date_of_birth::text from engagement_parties ep
       join contacts c on c.id = ep.contact_id
       where ep.engagement_id=$1 and ep.party_role='PARTICIPANT'`, [res.engagement_id]);
    expect(minor.date_of_birth).toBe('2015-04-09');
  });

  it('rejects a minor signing without guardian details', async () => {
    await h.asAnon();
    await expect(sign({ is_minor: true, minor_first_name: null })).rejects.toThrow();
  });
});

describe('cross-tenant isolation', () => {
  it("a second org's kiosk documents never land in org A", async () => {
    await h.asSuperuser();
    const orgB = (await h.q<{ id: string }>(
      `insert into organizations (name, slug) values ('Kiosk Rival','kiosk-rival') returning id`))[0].id;
    await h.q(
      `insert into business_config (org_id, legal_entity_name) values ($1,'Rival Barn Co')
       on conflict do nothing`, [orgB]);

    await h.asAnon();
    const prev = await preview('RELEASE_GENERAL', orgB);
    expect(prev.body).toContain('Rival Barn Co');
    expect(prev.body).not.toContain('French Heritage Equestrian');

    const [rawB] = await h.q<{ sign_release: SignRow | string }>(
      `select sign_release('RELEASE_GENERAL','Betty','B','betty@b.test',null,'Betty B',false,null,null,null,null,true,$1,true)`,
      [orgB]);
    const row = (typeof rawB.sign_release === 'string' ? JSON.parse(rawB.sign_release) : rawB.sign_release) as SignRow;
    await h.asSuperuser();
    const [doc] = await h.q<{ org_id: string }>(
      `select org_id from documents where id=$1`, [row.document_id]);
    expect(doc.org_id).toBe(orgB);
    expect(doc.org_id).not.toBe(orgA);
  });
});
