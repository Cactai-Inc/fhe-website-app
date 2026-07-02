/**
 * Liability-release pass — standalone releases + signing-requirements matrix
 * (20260701070000_liability_releases.sql + the regenerated
 * 20260629100000_load_contract_bodies.sql).
 *
 * Proves:
 *  - the four RELEASE_* templates are seeded with tokenized bodies (COMPANY
 *    party namespaces, never FHE),
 *  - generate_document merges RELEASE_PARTICIPANT for a riding-lesson
 *    engagement: the tenant's {{ORG.LEGAL_IDENTITY}} clause + signatory and the
 *    participant party tokens resolve; no orphan {{ORG.*}}/{{FHE.*}} survives
 *    (only {{SIG.*}} stays live for signing),
 *  - required_documents_for(service) returns the owner's matrix per service
 *    type (releases + facility rules + medical/vet authorizations),
 *  - contract_requirements is org-isolated (RESTRICTIVE org_boundary): a
 *    second tenant sees nothing of tenant #1's matrix and cannot write into it.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

const RELEASES = [
  'RELEASE_GENERAL', 'RELEASE_PARTICIPANT', 'RELEASE_HORSE_EXERCISE', 'RELEASE_HORSE_CARE',
];

let h: TestDb;
let org1: string; // tenant #1 (FHE) — identity seeded by 20260701010000
let orgB: string; // isolation peer
let bAdmin: string;
let engId: string; // RIDING_LESSON engagement on tenant #1

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  org1 = (await h.q<{ id: string }>(
    `select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Release Rival','release-rival') returning id`))[0].id;
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });

  // A riding-lesson engagement on tenant #1 with an adult participant.
  const participant = (await h.q<{ id: string }>(
    `insert into contacts (org_id, full_name, phone, email)
     values ($1,'Paula Participant','619-555-0110','paula@example.com') returning id`, [org1]))[0].id;
  const clientId = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org1, participant]))[0].id;
  engId = (await h.q<{ id: string }>(
    `insert into engagements (org_id, client_id, service_type, start_date)
     values ($1,$2,'RIDING_LESSON','2026-07-01') returning id`, [org1, clientId]))[0].id;
  await h.q(
    `insert into engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
     values ($1,$2,$3,'PARTICIPANT',true,1)`, [org1, engId, participant]);
});

afterAll(async () => {
  await h?.close();
});

describe('the four releases are loaded', () => {
  it('seeds all four RELEASE_* templates active, tokenized, unilateral (owner 2026-07-02)', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ template_key: string; body: string | null; active: boolean; service_type: string | null; party_namespaces: string[] }>(
      `select template_key, body, active, service_type, party_namespaces
       from contract_templates where template_key = any($1) order by template_key`, [RELEASES]);
    expect(rows.map((r) => r.template_key)).toEqual([...RELEASES].sort());
    for (const r of rows) {
      expect(r.active, r.template_key).toBe(true);
      expect(r.service_type, `${r.template_key} is a non-service doc`).toBeNull();
      expect(r.body, `${r.template_key} body loaded`).toBeTruthy();
      // Releases identify the DBA trade name ONLY — no personal identity clause
      // and no COMPANY signing party (unilateral; owner decisions 2026-07-02).
      expect(r.body).toContain('{{ORG.LEGAL_NAME}}');
      expect(r.body).not.toContain('{{ORG.LEGAL_IDENTITY}}');
      expect(r.body).not.toContain('{{ORG.SIGNATORY_NAME}}');
      expect(r.party_namespaces).not.toContain('COMPANY');
      expect(r.party_namespaces).toContain('PARTICIPANT');
      expect(r.party_namespaces).not.toContain('FHE');
    }
  });
});

describe('generate_document — RELEASE_PARTICIPANT for a riding lesson', () => {
  it('merges the tenant identity + participant tokens; only {{SIG.*}} stays live', async () => {
    await h.asSuperuser();
    const [row] = await h.q<{ document_id: string; merged_body: string }>(
      `select * from generate_document($1,'RELEASE_PARTICIPANT')`, [engId]);
    const body = row.merged_body;

    // COMPANY identity: trade name ONLY on releases (owner 2026-07-02) — no
    // personal name, no sole-prop identity clause.
    expect(body).toContain('French Heritage Equestrian');
    expect(body).not.toContain('doing business as');
    expect(body).not.toContain('Charles Zigmund');
    // participant party tokens resolve from engagement_parties → contacts
    expect(body).toContain('Paula Participant');
    expect(body).toContain('paula@example.com');
    // the defined term survives as prose, never as a leftover token
    expect(body).toContain('("COMPANY")');
    expect(body).not.toMatch(/\{\{ORG\./);
    expect(body).not.toMatch(/\{\{FHE\./);
    expect(body).not.toMatch(/\{\{PARTICIPANT\./);
    // every remaining token is a live signature token
    for (const t of body.match(/\{\{[A-Z0-9_.]+\}\}/g) ?? []) {
      expect(t, `unexpected unmerged token ${t}`).toMatch(/^\{\{SIG\./);
    }
    expect(body).toContain('{{SIG.PARTICIPANT.NAME}}');
    // unilateral: no company countersignature block on any release
    expect(body).not.toContain('{{SIG.COMPANY.NAME}}');
  });
});

describe('required_documents_for — the signing-requirements matrix', () => {
  const expectDocs = async (service: string, expected: string[]) => {
    const rows = await h.q<{ required_documents_for: string }>(
      `select required_documents_for from required_documents_for($1)`, [service]);
    expect(rows.map((r) => r.required_documents_for), service).toEqual(expected);
  };

  it('returns the owner rules per service type (tenant #1 seed)', async () => {
    await h.asSuperuser();
    // R1+R2 — rider segment: release + facility rules + human emergency medical
    await expectDocs('RIDING_LESSON',
      ['FACILITY_RULES', 'HUMAN_EMERGENCY_MEDICAL', 'RELEASE_PARTICIPANT']);
    await expectDocs('JUMPER_TRAINING',
      ['FACILITY_RULES', 'HUMAN_EMERGENCY_MEDICAL', 'RELEASE_PARTICIPANT']);
    await expectDocs('HORSEMANSHIP_TRAINING',
      ['FACILITY_RULES', 'HUMAN_EMERGENCY_MEDICAL', 'RELEASE_PARTICIPANT']);
    // R1+R3 — horse segment: release variant + facility rules + horse emergency vet
    await expectDocs('HORSE_EXERCISE',
      ['FACILITY_RULES', 'HORSE_EMERGENCY_VET', 'RELEASE_HORSE_EXERCISE']);
    await expectDocs('HORSE_TRAINING',
      ['FACILITY_RULES', 'HORSE_EMERGENCY_VET', 'RELEASE_HORSE_EXERCISE']);
    await expectDocs('HORSE_CLIPPING',
      ['FACILITY_RULES', 'HORSE_EMERGENCY_VET', 'RELEASE_HORSE_CARE']);
    // R3 — requires_horse brokerage/support: vet authorization only
    await expectDocs('HORSE_EVALUATION', ['HORSE_EMERGENCY_VET']);
    await expectDocs('HORSE_SALE_ASSISTANCE', ['HORSE_EMERGENCY_VET']);
    // no signing set: consulting (no horse yet) and internal
    await expectDocs('HORSE_FINDER', []);
    await expectDocs('INDEPENDENT_CONTRACTOR', []);
  });
});

describe('contract_requirements — org isolation (RESTRICTIVE org_boundary)', () => {
  it("a second tenant sees NONE of tenant #1's matrix (table and helper)", async () => {
    await h.asUser(bAdmin);
    expect(await h.q(`select id from contract_requirements`)).toHaveLength(0);
    expect(await h.q(`select * from required_documents_for('RIDING_LESSON')`)).toHaveLength(0);
  });

  it('a second tenant cannot write into tenant #1 (WITH CHECK boundary) but can seed its own', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`insert into contract_requirements (org_id, service_type, template_key)
           values ($1,'RIDING_LESSON','RELEASE_PARTICIPANT')`, [org1]),
    ).rejects.toThrow();

    // its own row (org_id defaults to current_org()) works and is visible to it
    await h.q(`insert into contract_requirements (service_type, template_key)
               values ('RIDING_LESSON','RELEASE_GENERAL')`);
    const mine = await h.q<{ org_id: string; template_key: string }>(
      `select org_id, template_key from contract_requirements`);
    expect(mine).toHaveLength(1);
    expect(mine[0].org_id).toBe(orgB);
    expect(mine[0].template_key).toBe('RELEASE_GENERAL');

    // …and tenant #1's matrix never gained the row
    await h.asSuperuser();
    const org1Rows = await h.q(
      `select id from contract_requirements where org_id = $1 and template_key = 'RELEASE_GENERAL'`, [org1]);
    expect(org1Rows).toHaveLength(0);
  });
});
