/**
 * Release kiosk (migration 20260702050000) — the owner's 2026-07-02 directives,
 * proven end-to-end through the real anon-executable RPCs:
 *  - release_preview: all four releases + FACILITY_RULES merge the org identity
 *    (TRADE NAME ONLY — no personal name) and today's date, and TRUNCATE before
 *    the signature area (no SIG tokens, no signer-section markers in previews);
 *  - stripped content: covenant-not-to-sue, CC §1542 waiver, free-floating
 *    initials lines, and the company countersign are gone; media consent is a
 *    default grant with a written email opt-out; term = until superseded;
 *  - sign_release rules gate: rejects unless p_rules_acknowledged, and the
 *    executed body records the dated acknowledgment;
 *  - adult path: PARTICIPANT signs, EXECUTED immediately, minor section absent;
 *  - minor path: guardian signs (GUARDIAN role), minor is a non-signing
 *    PARTICIPANT party, DOB + relationship merged, adult section absent;
 *  - bad template keys rejected; cross-tenant isolation holds.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

const RELEASES = [
  'RELEASE_GENERAL', 'RELEASE_PARTICIPANT', 'RELEASE_HORSE_EXERCISE', 'RELEASE_HORSE_CARE',
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
    `select sign_release($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12)`,
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
      // dates merged; nothing tokenish or signature-ish remains
      expect(body, key).not.toMatch(/\{\{[A-Z0-9_.]+\}\}/);
      expect(body, key).not.toContain('ADULT SIGNER');
      expect(body, key).not.toContain('MINOR SIGNER');
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
    // the rules-gate document previews too
    const rules = await preview('FACILITY_RULES');
    expect(rules.body).toContain('French Heritage Equestrian');
    expect(rules.body).not.toMatch(/\{\{[A-Z0-9_.]+\}\}/);
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
  it('executes on the single PARTICIPANT signature; minor section absent', async () => {
    await h.asAnon();
    const res = await sign({ first_name: 'Alan', last_name: 'Adult', email: 'alan@kiosk.test', typed_name: 'Alan Adult' });
    expect(res.status).toBe('EXECUTED');
    expect(res.merged_body).toContain('Alan Adult');
    expect(res.merged_body).not.toContain('MINOR SIGNER');
    expect(res.merged_body).not.toContain('Parent/Guardian');
    await h.asSuperuser();
    const sigs = await h.q<{ party_role: string; typed_name: string }>(
      `select party_role, typed_name from signatures where document_id=$1`, [res.document_id]);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].party_role).toBe('PARTICIPANT');
  });
});

describe('sign_release — minor path', () => {
  it('guardian signs; minor is a non-signing party; DOB + relationship merged; adult section absent', async () => {
    await h.asAnon();
    const res = await sign({
      template_key: 'RELEASE_PARTICIPANT',
      first_name: 'Gail', last_name: 'Guardian', email: 'gail@kiosk.test', typed_name: 'Gail Guardian',
      is_minor: true, minor_first_name: 'Milo', minor_last_name: 'Minor', minor_dob: '2015-04-09',
      guardian_relationship: 'Mother',
    });
    expect(res.status).toBe('EXECUTED');
    expect(res.merged_body).toContain('Milo Minor');
    expect(res.merged_body).toContain('Gail Guardian');
    expect(res.merged_body).toContain('Mother');
    expect(res.merged_body).toMatch(/2015/);
    expect(res.merged_body).not.toContain('ADULT SIGNER');

    await h.asSuperuser();
    const sigs = await h.q<{ party_role: string }>(
      `select party_role from signatures where document_id=$1`, [res.document_id]);
    expect(sigs.map((s) => s.party_role)).toEqual(['GUARDIAN']);
    const parties = await h.q<{ party_role: string; is_signer: boolean }>(
      `select party_role, is_signer from engagement_parties
       where engagement_id=$1 order by party_role`, [res.engagement_id]);
    expect(parties).toEqual([
      { party_role: 'GUARDIAN', is_signer: true },
      { party_role: 'PARTICIPANT', is_signer: false },
    ]);
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
      `select sign_release('RELEASE_GENERAL','Betty','B','betty@b.test',null,'Betty B',false,null,null,null,null,true,$1)`,
      [orgB]);
    const row = (typeof rawB.sign_release === 'string' ? JSON.parse(rawB.sign_release) : rawB.sign_release) as SignRow;
    await h.asSuperuser();
    const [doc] = await h.q<{ org_id: string }>(
      `select org_id from documents where id=$1`, [row.document_id]);
    expect(doc.org_id).toBe(orgB);
    expect(doc.org_id).not.toBe(orgA);
  });
});
