/**
 * Category 1 — Schema: contract templates & token dictionary (migration 011).
 *
 * Proves the template-assembly substrate is real and matches the canon:
 *  - migration 11 applies after the engagements/horses backbone,
 *  - the 17 canonical contracts are seeded, all active, every one carrying FHE
 *    plus at least one counterparty namespace,
 *  - template_tokens mirrors MERGE_TOKEN_DICTIONARY.md (every documented token
 *    present, well-formed, correctly classed; no orphans),
 *  - party-scoped tokens (person set + {{SIG.*}}) live under the PARTY placeholder,
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

describe('contract_templates — the 17 canonical contracts', () => {
  it('seeds exactly the 17 survivors, all active', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ template_key: string }>(
      `select template_key from contract_templates order by template_key`);
    expect(rows).toHaveLength(17);
    // sort both sides with the same comparator (avoid JS vs PG collation quirks)
    expect(rows.map((r) => r.template_key).sort()).toEqual([
      'FACILITY_LICENSE', 'FACILITY_RULES', 'HORSE_EMERGENCY_VET', 'HORSE_EVALUATION',
      'HORSE_EXERCISE', 'HORSE_LEASE', 'HORSE_PURCHASE_SALE', 'HORSE_REPRESENTATION',
      'HORSE_SALE_TRANSFER', 'HORSE_SEARCH_RETAINER', 'HORSE_TRAINING', 'HORSEMANSHIP_TRAINING',
      'HUMAN_EMERGENCY_MEDICAL', 'INDEPENDENT_CONTRACTOR', 'MEDIA_RELEASE', 'MINOR_RIDER',
      'RIDER_LESSON_JUMPER',
    ].sort());
  });

  it('every template names FHE plus at least one counterparty', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ template_key: string; party_namespaces: string[] }>(
      `select template_key, party_namespaces from contract_templates`);
    for (const r of rows) {
      expect(r.party_namespaces, r.template_key).toContain('FHE');
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
    expect(map['HORSE_SEARCH_RETAINER']).toBe('HORSE_FINDER');
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
    const namespaces = new Set(rows.map((r) => r.namespace));
    expect([...namespaces].sort()).toEqual(['DOC', 'ENG', 'FHE', 'HORSE', 'ORG', 'PARTY', 'TXN']);
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
      '{{ENG.ID}}', '{{ENG.SERVICE_TYPE}}',
      '{{DOC.UUID}}', '{{DOC.GENERATED_DATE}}',
      '{{SIG.PARTY.NAME}}', '{{SIG.PARTY.DATE}}', '{{SIG.PARTY.IP}}',
    ]) {
      expect(tokens.has(t), `dictionary missing ${t}`).toBe(true);
    }
  });

  it('party-scoped tokens (person set + signatures) live under PARTY; signatures are signature-kind', async () => {
    await h.asSuperuser();
    const scoped = await h.q<{ namespace: string; kind: string; token: string }>(
      `select namespace, kind, token from template_tokens where template_id is null and party_scoped`);
    for (const r of scoped) expect(r.namespace).toBe('PARTY');
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

    // anon sees the 16 active ones, not the hidden one
    await h.asAnon();
    const anon = await h.q<{ template_key: string }>(`select template_key from contract_templates`);
    expect(anon).toHaveLength(16);
    expect(anon.map((r) => r.template_key)).not.toContain('MINOR_RIDER');

    // a plain authenticated user cannot insert
    await h.asUser(userUid);
    await expect(
      h.q(`insert into contract_templates (template_key, title, party_namespaces)
           values ('HACK','Hack', ARRAY['CLIENT','FHE'])`),
    ).rejects.toThrow();

    // admin sees all 17 (incl. inactive) and can write
    await h.asUser(adminUid);
    expect(await h.q(`select id from contract_templates`)).toHaveLength(17);
    await h.q(`update contract_templates set version=2 where template_key='HORSE_PURCHASE_SALE'`);
    const v = (await h.q<{ version: number }>(
      `select version from contract_templates where template_key='HORSE_PURCHASE_SALE'`))[0].version;
    expect(v).toBe(2);
  });
});
