/**
 * Category 1 — Schema: contract templates & token dictionary (migration 011 +
 * the owner's 2026-07-03 template revision; docs/TOKEN_DICTIONARY.md is canon).
 *
 * Proves the template-assembly substrate is real and matches the canon:
 *  - migration 11 applies after the engagements/horses backbone,
 *  - the 24 canonical contracts are seeded, all active except the retired
 *    HORSE_REPRESENTATION; bilateral instruments carry COMPANY plus at least
 *    one counterparty namespace while the unilateral CLIENT-signer documents
 *    (releases, facility rules, policies, lesson order form) carry no COMPANY,
 *  - template_tokens mirrors the token dictionary (every documented token
 *    present, well-formed, correctly classed; no orphans),
 *  - party-scoped tokens live under the PARTY placeholder (shared person set +
 *    {{SIG.*}}) or a concrete party namespace (the CLIENT profile fields),
 *  - RLS: everyone reads active templates, only admins write.
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

describe('migration applies additively', () => {
  it('lands after the engagements/horses backbone', () => {
    const files = migrationFiles();
    const eng = files.findIndex((f) => f.includes('engagements_horses_backbone'));
    const tpl = files.findIndex((f) => f.includes('contract_templates_tokens'));
    expect(eng).toBeGreaterThanOrEqual(0);
    expect(tpl).toBeGreaterThan(eng);
  });
});

describe('contract_templates — the 24 canonical contracts', () => {
  // 17 → 21: the liability-release pass (20260701070000 + the regenerated
  // loader) adds the four standalone RELEASE_* documents. Deliberate count bump.
  // 21 → 22: the contract-module decomposition (20260701080000) registers the
  // side-scoped HORSE_TRANSACTION_REP module and RETIRES HORSE_REPRESENTATION
  // (folded into the tokenized finder's lease directions — row kept for
  // documents.template_id integrity, but deactivated).
  // 22 → 24: the owner's 2026-07-03 revision registers COMPANY_POLICIES (joins
  // every service's required set) and RIDER_LESSON (the lesson order form) via
  // the regenerated loader's POST_SEED inserts.
  it('seeds exactly the 24 canonical rows; all active except the retired HORSE_REPRESENTATION + RELEASE_HORSE_EXERCISE', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ template_key: string; active: boolean }>(
      `select template_key, active from contract_templates order by template_key`);
    expect(rows).toHaveLength(24);
    // sort both sides with the same comparator (avoid JS vs PG collation quirks)
    expect(rows.map((r) => r.template_key).sort()).toEqual([
      'COMPANY_POLICIES',
      'FACILITY_LICENSE', 'FACILITY_RULES', 'HORSE_EMERGENCY_VET', 'HORSE_EVALUATION',
      'HORSE_EXERCISE', 'HORSE_LEASE', 'HORSE_PURCHASE_SALE', 'HORSE_REPRESENTATION',
      'HORSE_SALE_TRANSFER', 'HORSE_SEARCH_RETAINER', 'HORSE_TRAINING', 'HORSE_TRANSACTION_REP',
      'HORSEMANSHIP_TRAINING', 'HUMAN_EMERGENCY_MEDICAL', 'INDEPENDENT_CONTRACTOR',
      'MEDIA_RELEASE', 'MINOR_RIDER',
      'RELEASE_GENERAL', 'RELEASE_HORSE_CARE', 'RELEASE_HORSE_EXERCISE', 'RELEASE_PARTICIPANT',
      'RIDER_LESSON', 'RIDER_LESSON_JUMPER',
    ].sort());
    // Retired rows kept for referential history but inactive: HORSE_REPRESENTATION
    // (decomposition) and RELEASE_HORSE_EXERCISE (horse-care release unified under
    // RELEASE_HORSE_CARE, owner 2026-07-05).
    const RETIRED = new Set(['HORSE_REPRESENTATION', 'RELEASE_HORSE_EXERCISE']);
    for (const r of rows) {
      expect(r.active, r.template_key).toBe(!RETIRED.has(r.template_key));
    }
  });

  it('bilateral templates name COMPANY plus a counterparty; the CLIENT-signer docs are unilateral', async () => {
    // Contracts Legal Pass: the business side is the COMPANY party (role renamed
    // from FHE); no template may still declare the old FHE party namespace.
    // Owner revision 2026-07-03 (loader POST_SEED map + kiosk CLIENT canon):
    // the four RELEASE_* documents, FACILITY_RULES, COMPANY_POLICIES, and the
    // RIDER_LESSON order form are unilateral CLIENT-signer documents — only the
    // signer's side is a party (CLIENT, plus the optional non-signing minor
    // PARTICIPANT); COMPANY appears as prose, not a party.
    const UNILATERAL = new Set([
      'RELEASE_GENERAL', 'RELEASE_PARTICIPANT', 'RELEASE_HORSE_EXERCISE',
      'RELEASE_HORSE_CARE', 'FACILITY_RULES', 'COMPANY_POLICIES', 'RIDER_LESSON',
    ]);
    await h.asSuperuser();
    const rows = await h.q<{ template_key: string; party_namespaces: string[] }>(
      `select template_key, party_namespaces from contract_templates`);
    for (const r of rows) {
      expect(r.party_namespaces, r.template_key).not.toContain('FHE');
      if (UNILATERAL.has(r.template_key)) {
        expect(r.party_namespaces, r.template_key).not.toContain('COMPANY');
        expect(r.party_namespaces, r.template_key).toContain('CLIENT');
        expect(r.party_namespaces.length, r.template_key).toBeGreaterThanOrEqual(1);
        continue;
      }
      expect(r.party_namespaces, r.template_key).toContain('COMPANY');
      expect(r.party_namespaces.length, r.template_key).toBeGreaterThanOrEqual(2);
    }
    // body loading is covered by contract_bodies_loaded.test.ts (Phase 2 / migration 17)
  });

  it('service-specific templates reference a real catalog code', async () => {
    await h.asSuperuser();
    const orphan = await h.q(
      `select template_key from contract_templates t
       where t.service_type is not null
         and not exists (select 1 from service_types s where s.code = t.service_type)`);
    expect(orphan).toHaveLength(0);
    // purchase/sale anchor to the right services
    const map = Object.fromEntries(
      (await h.q<{ template_key: string; service_type: string }>(
        `select template_key, service_type from contract_templates where service_type is not null`))
        .map((r) => [r.template_key, r.service_type]));
    expect(map['HORSE_PURCHASE_SALE']).toBe('HORSE_PURCHASE_ASSISTANCE');
    expect(map['HORSE_SALE_TRANSFER']).toBe('HORSE_SALE_ASSISTANCE');
    // the ONE tokenized Layer-1 finder template (key kept for referential integrity)
    expect(map['HORSE_SEARCH_RETAINER']).toBe('HORSE_FINDER');
    // HORSE_TRANSACTION_REP is deliberately service-NULL: one side-scoped
    // template serves purchase/sale/lease-in/lease-out representation via DIR tokens
    expect(map['HORSE_TRANSACTION_REP']).toBeUndefined();
  });
});

describe('template_tokens — the dictionary in the database', () => {
  it('seeds the global dictionary with well-formed, correctly-classed tokens', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ namespace: string; field: string; token: string; kind: string; party_scoped: boolean }>(
      `select namespace, field, token, kind, party_scoped from template_tokens where template_id is null`);
    // every token is {{...}} and its kind is valid
    for (const r of rows) {
      expect(r.token, `${r.namespace}.${r.field}`).toMatch(/^\{\{.+\}\}$/);
      expect(['field', 'system', 'signature']).toContain(r.kind);
    }
    // the documented namespaces are all represented
    // ORG.* was added by 20260630000000_generate_document_org_fix (§6 de-specification:
    // {{ORG.*}} is the canonical tenant namespace; {{FHE.*}} kept as a back-compat alias).
    // DIR.* was added by 20260701080000_contract_module_decomposition: directional
    // terminology resolved from the engagement's current stage via template_variants.
    // CLIENT (profile/attestation fields), ORD (order instance), and REQ (request
    // inputs) were added by 20260703040000_token_dictionary_sync for the owner's
    // 2026-07-03 template revision (docs/TOKEN_DICTIONARY.md).
    const namespaces = new Set(rows.map((r) => r.namespace));
    expect([...namespaces].sort()).toEqual(
      ['CLIENT', 'DIR', 'DOC', 'ENG', 'FHE', 'HORSE', 'ORD', 'ORG', 'PARTY', 'REQ', 'TXN']);
  });

  it('contains the canonical tokens from each namespace (matches the .md)', async () => {
    await h.asSuperuser();
    const tokens = new Set(
      (await h.q<{ token: string }>(`select token from template_tokens where template_id is null`))
        .map((r) => r.token));
    for (const t of [
      '{{PARTY.FULL_NAME}}', '{{PARTY.ADDRESS}}', '{{PARTY.RELATIONSHIP}}',
      '{{FHE.LEGAL_NAME}}', '{{FHE.EMAIL}}',
      '{{HORSE.REGISTERED_NAME}}', '{{HORSE.BREED}}', '{{HORSE.MICROCHIP}}',
      '{{TXN.PURCHASE_PRICE}}', '{{TXN.COMMISSION_RATE}}', '{{TXN.BALANCE_DUE}}',
      // staged revenue chain (contract-module decomposition): one fee per module
      '{{TXN.RETAINER_FEE}}', '{{TXN.SUCCESS_FEE}}', '{{TXN.EVALUATION_FEE}}', '{{TXN.REPRESENTATION_FEE}}',
      '{{DIR.ROLE_TERM}}', '{{DIR.TARGET_TERM}}', '{{DIR.DIRECTION_TERM}}', '{{DIR.COUNTERPARTY_TERM}}',
      '{{ENG.ID}}', '{{ENG.SERVICE_TYPE}}',
      '{{DOC.UUID}}', '{{DOC.GENERATED_DATE}}', '{{DOC.EFFECTIVE_DATE}}',
      '{{SIG.PARTY.NAME}}', '{{SIG.PARTY.DATE}}', '{{SIG.PARTY.IP}}',
      // owner revision 2026-07-03 (20260703040000_token_dictionary_sync):
      // order/request inputs + CLIENT profile/attestation fields
      '{{ORD.UUID}}', '{{ORD.SERVICE_SELECTION}}',
      '{{REQ.PREFERRED_SCHEDULE}}', '{{REQ.CONDITION_UPDATES}}',
      '{{CLIENT.HORSE_CAPACITY}}', '{{CLIENT.EMERGENCY_CONTACT_1_NAME}}',
      '{{CLIENT.RIDING_EXPERIENCE_YEARS}}', '{{CLIENT.EUTHANASIA_INITIALS}}',
      '{{TXN.SESSION_FEE}}', '{{TXN.JUMPER_TRAINING_FEE}}',
      '{{ENG.SEARCH_OBJECTIVE}}', '{{ENG.PROGRAM_SCOPE}}',
      '{{HORSE.OWNER_NAME}}', '{{HORSE.MEDICATION_NAME}}',
    ]) {
      expect(tokens.has(t), `dictionary missing ${t}`).toBe(true);
    }
  });

  it('party-scoped tokens live under PARTY or a concrete party namespace; signatures are signature-kind', async () => {
    // The shared person field set + {{SIG.*}} stay under the PARTY placeholder
    // (one row serves every party namespace). The 2026-07-03 revision adds the
    // CLIENT-specific profile/attestation fields as literal CLIENT rows —
    // party_scoped, but not shared across namespaces.
    await h.asSuperuser();
    const scoped = await h.q<{ namespace: string; kind: string; token: string }>(
      `select namespace, kind, token from template_tokens where template_id is null and party_scoped`);
    for (const r of scoped) expect(['PARTY', 'CLIENT'], r.token).toContain(r.namespace);
    // the shared person set is still the PARTY placeholder, never duplicated
    const partyRows = scoped.filter((r) => r.namespace === 'PARTY');
    expect(partyRows.length).toBeGreaterThanOrEqual(11); // person set + DOB + 3 SIG
    const sigs = await h.q<{ kind: string }>(
      `select kind from template_tokens where template_id is null and token like '{{SIG.%'`);
    expect(sigs).toHaveLength(3);
    for (const s of sigs) expect(s.kind).toBe('signature');
  });

  it('the (namespace, field) dictionary key is unique', async () => {
    await h.asSuperuser();
    const dupes = await h.q(
      `select namespace, field from template_tokens where template_id is null
       group by namespace, field having count(*) > 1`);
    expect(dupes).toHaveLength(0);
  });
});

describe('RLS — templates read-active, admin-write', () => {
  it('lets anyone read active templates but blocks non-admin writes; admin sees inactive', async () => {
    await h.asSuperuser();
    const adminUid = await h.createAuthUser({ email: 'ops@tpl.fhe', isAdmin: true });
    const userUid = await h.createAuthUser({ email: 'user@tpl.fhe' });
    // hide one template
    await h.q(`update contract_templates set active=false where template_key='MINOR_RIDER'`);

    // anon sees the 21 active ones (24 total; HORSE_REPRESENTATION and
    // RELEASE_HORSE_EXERCISE already retired-inactive, MINOR_RIDER hidden above)
    await h.asAnon();
    const anon = await h.q<{ template_key: string }>(`select template_key from contract_templates`);
    expect(anon).toHaveLength(21);
    expect(anon.map((r) => r.template_key)).not.toContain('MINOR_RIDER');
    expect(anon.map((r) => r.template_key)).not.toContain('HORSE_REPRESENTATION');
    expect(anon.map((r) => r.template_key)).not.toContain('RELEASE_HORSE_EXERCISE');

    // a plain authenticated user cannot insert
    await h.asUser(userUid);
    await expect(
      h.q(`insert into contract_templates (template_key, title, party_namespaces)
           values ('HACK','Hack', ARRAY['CLIENT','FHE'])`),
    ).rejects.toThrow();

    // admin sees all 24 (incl. inactive) and can write
    await h.asUser(adminUid);
    expect(await h.q(`select id from contract_templates`)).toHaveLength(24);
    await h.q(`update contract_templates set version=2 where template_key='HORSE_PURCHASE_SALE'`);
    const v = (await h.q<{ version: number }>(
      `select version from contract_templates where template_key='HORSE_PURCHASE_SALE'`))[0].version;
    expect(v).toBe(2);
  });
});
