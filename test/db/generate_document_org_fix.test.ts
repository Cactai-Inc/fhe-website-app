/**
 * U1 — generate_document org-isolation fix + {{ORG.*}} de-specification
 * (migration 20260630000000_generate_document_org_fix.sql).
 *
 * PLATFORM_ARCHITECTURE.md §6. Proves the merge engine:
 *   - reads business_config scoped to the ENGAGEMENT's org (v_eng.org_id), NOT an
 *     arbitrary LIMIT-1 row and NOT current_org() — so org A's contract renders
 *     A's signatory and never B's, and vice-versa.
 *   - resolves {{ORG.*}} and {{FHE.*}} to identical per-org values ({{FHE.*}} is a
 *     literal alias), exercised via per-template alias token rows added to ONE
 *     template (no shipped contract body is edited).
 *   - a service_role/BYPASSRLS caller (auth.uid() IS NULL → current_org() = the
 *     session GUC) still scopes to the TARGET engagement's org — no LIMIT-1 /
 *     session-GUC leak.
 *
 * Real-path: exercises the actual generate_document RPC the app calls, asserts the
 * merged body + the persisted documents row, across two isolated tenants.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string, orgB: string;
let engA: string, engB: string;
let tmplId: string;

/** Seed one tenant's full engagement graph (superuser, explicit org_id). */
async function seedOrg(org: string, opts: { legal: string; signatory: string; title: string }) {
  await h.q(
    `insert into business_config (org_id, legal_entity_name, signatory_name, signatory_title)
     values ($1,$2,$3,$4)`,
    [org, opts.legal, opts.signatory, opts.title],
  );

  const serviceType = (await h.q<{ code: string }>(`select code from service_types order by code limit 1`))[0].code;

  const buyer = (await h.q<{ id: string }>(
    `insert into contacts (org_id, full_name, first_name, last_name, phone, email, address_line1, city, state, postal_code) values ($1, 'Party Buyer', 'Party', 'Buyer', '619-555-0001', 'buyer@example.com', '1 Main St', 'San Diego', 'CA', '92101') returning id`,
    [org],
  ))[0].id;
  const seller = (await h.q<{ id: string }>(
    `insert into contacts (org_id, full_name, first_name, last_name) values ($1, 'Party Seller', 'Party', 'Seller') returning id`, [org],
  ))[0].id;
  const clientContact = (await h.q<{ id: string }>(
    `insert into contacts (org_id, full_name, first_name, last_name) values ($1, 'Client Co', 'Client', 'Co') returning id`, [org],
  ))[0].id;
  const clientId = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, clientContact],
  ))[0].id;

  const engId = (await h.q<{ id: string }>(
    `insert into engagements (org_id, client_id, service_type, start_date)
     values ($1,$2,$3,'2026-07-01') returning id`,
    [org, clientId, serviceType],
  ))[0].id;

  await h.q(
    `insert into engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
     values ($1,$2,$3,'BUYER',true,1),($1,$2,$4,'SELLER',true,2)`,
    [org, engId, buyer, seller],
  );

  return engId;
}

beforeAll(async () => {
  // Pin to this unit's migration: U1 lands FIRST and is dependency-free, so it
  // must verify against the schema up to and including itself — independent of
  // sibling units (U2/U3/…) that apply later.
  h = await createTestDb({ upTo: '20260630000000_generate_document_org_fix.sql' });
  await h.asSuperuser();

  // clean slate (children first) so the sole seeded business_config / migration
  // rows do not collide with our two-tenant fixture.
  for (const t of ['documents', 'engagement_parties', 'engagements', 'clients', 'horses', 'contacts', 'business_config']) {
    await h.q(`delete from ${t}`);
  }

  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Rival Stables','rival-u1') returning id`))[0].id;

  engA = await seedOrg(orgA, { legal: 'Alpha Equestrian LLC', signatory: 'A. Owner', title: 'Managing Member' });
  engB = await seedOrg(orgB, { legal: 'Bravo Stables Inc', signatory: 'B. Boss', title: 'President' });

  // Add per-template {{ORG.*}} alias rows to HORSE_PURCHASE_SALE so the alias is
  // exercised on a real merge WITHOUT editing any shipped body (we append the
  // tokens to the body of a copy? No — bodies are global; instead we append the
  // alias tokens to the existing body via a scratch template row we fully own).
  tmplId = (await h.q<{ id: string }>(
    `insert into contract_templates (template_key, title, party_namespaces, body, active)
     values ('U1_ALIAS_PROBE','U1 Alias Probe', ARRAY['BUYER','FHE'],
       'LEGAL ORG=[{{ORG.LEGAL_NAME}}] FHE=[{{FHE.LEGAL_NAME}}] '
       || 'SIG ORG=[{{ORG.SIGNATORY_NAME}}] FHE=[{{FHE.SIGNATORY_NAME}}] '
       || 'ADDR ORG=[{{ORG.ADDRESS}}] FHE=[{{FHE.ADDRESS}}] '
       || 'BRAND=[{{ORG.BRAND_NAME}}] BUYER=[{{BUYER.FULL_NAME}}]',
       true)
     returning id`,
  ))[0].id;

  await h.q(
    `insert into template_tokens (template_id, namespace, field, token, kind, required, party_scoped)
     values
       ($1,'ORG','LEGAL_NAME','{{ORG.LEGAL_NAME}}','field',false,false),
       ($1,'FHE','LEGAL_NAME','{{FHE.LEGAL_NAME}}','field',false,false),
       ($1,'ORG','SIGNATORY_NAME','{{ORG.SIGNATORY_NAME}}','field',false,false),
       ($1,'FHE','SIGNATORY_NAME','{{FHE.SIGNATORY_NAME}}','field',false,false),
       ($1,'ORG','ADDRESS','{{ORG.ADDRESS}}','field',false,false),
       ($1,'FHE','ADDRESS','{{FHE.ADDRESS}}','field',false,false),
       ($1,'ORG','BRAND_NAME','{{ORG.BRAND_NAME}}','field',false,false),
       ($1,'BUYER','FULL_NAME','{{BUYER.FULL_NAME}}','field',false,false)`,
    [tmplId],
  );
});

afterAll(async () => {
  await h?.close();
});

describe('generate_document — cross-tenant config isolation', () => {
  it("org A's document renders A's identity and NOT B's", async () => {
    await h.asSuperuser();
    const [row] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'U1_ALIAS_PROBE')`, [engA]);
    expect(row.merged_body).toContain('Alpha Equestrian LLC');
    expect(row.merged_body).toContain('A. Owner');
    expect(row.merged_body).not.toContain('Bravo Stables Inc');
    expect(row.merged_body).not.toContain('B. Boss');
  });

  it("org B's document renders B's identity and NOT A's", async () => {
    await h.asSuperuser();
    const [row] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'U1_ALIAS_PROBE')`, [engB]);
    expect(row.merged_body).toContain('Bravo Stables Inc');
    expect(row.merged_body).toContain('B. Boss');
    expect(row.merged_body).not.toContain('Alpha Equestrian LLC');
    expect(row.merged_body).not.toContain('A. Owner');
  });
});

describe('generate_document — {{ORG.*}} and {{FHE.*}} are aliases', () => {
  it('renders identical per-org values for ORG and FHE namespaces', async () => {
    await h.asSuperuser();
    const [row] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'U1_ALIAS_PROBE')`, [engA]);
    const body = row.merged_body;
    // ORG and FHE resolve from the SAME per-engagement config → identical text.
    expect(body).toContain('ORG=[Alpha Equestrian LLC] FHE=[Alpha Equestrian LLC]');
    expect(body).toContain('ORG=[A. Owner] FHE=[A. Owner]');
    // BRAND_NAME resolves from the typed business_config (legal/business name).
    expect(body).toContain('BRAND=[Alpha Equestrian LLC]');
    // buyer still merges (sanity that the loop ran the party arm too).
    expect(body).toContain('BUYER=[Party Buyer]');
    // no leftover ORG/FHE tokens.
    expect(body).not.toMatch(/\{\{ORG\./);
    expect(body).not.toMatch(/\{\{FHE\./);
  });
});

describe('generate_document — service_role scopes to the engagement, not the session', () => {
  it('a service_role caller with the session pinned to org A renders B for B’s engagement', async () => {
    // Pin the seed/service session GUC to org A. A service_role caller has
    // auth.uid() IS NULL, so current_org() resolves to THIS GUC (org A). If the
    // config read followed current_org() it would leak A's config into B's
    // document; keying off v_eng.org_id renders B correctly.
    await h.q(`select set_config('app.current_org', $1, false)`, [orgA]);
    await h.asServiceRole();

    const [row] = await h.q<{ document_id: string; merged_body: string }>(
      `select * from generate_document($1,'U1_ALIAS_PROBE')`, [engB]);
    expect(row.merged_body).toContain('Bravo Stables Inc'); // B's config, from v_eng.org_id
    expect(row.merged_body).toContain('B. Boss');
    expect(row.merged_body).not.toContain('Alpha Equestrian LLC'); // NOT the org-A session
    expect(row.merged_body).not.toContain('A. Owner');

    // the persisted documents row (right table) carries B's merged config, read
    // back verbatim — proving the config read keyed off v_eng.org_id, not the
    // org-A session. (The documents.org_id stamp itself defaults to current_org()
    // and is not what U1 fixes; the isolation proof is the merged content.)
    await h.asSuperuser();
    const [doc] = await h.q<{ merged_body: string; status: string }>(
      `select merged_body, status from documents where id = $1`, [row.document_id]);
    expect(doc.status).toBe('DRAFT');
    expect(doc.merged_body).toBe(row.merged_body);
    expect(doc.merged_body).toContain('Bravo Stables Inc');
    expect(doc.merged_body).not.toContain('Alpha Equestrian LLC');
  });
});
