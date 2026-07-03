/**
 * U3 — Global Value Registry (migration 29, core.registry).
 *
 * Real-path proofs for config_values / config_keys / config_value() /
 * org_public_config() / config_required_missing(), per PLATFORM_ARCHITECTURE §5:
 *
 *   - config_value() resolves the TYPED business_config field (ORG namespace) AND
 *     the EAV config_values field (BRAND / CONTACT), scoped to current_org(): org A
 *     cannot read org B's values.
 *   - UNIQUE(org, namespace, key) is enforced.
 *   - config_values carries the RESTRICTIVE org boundary and defaults org_id to
 *     the caller's tenant (isolation + default proof).
 *   - org_public_config(slug) returns brand + public contact + public pricing for
 *     the ADDRESSED tenant and NEVER commission / retention / e-sign / tax.
 *   - a required config_keys entry left unset is detectable by the go-live check.
 *   - the FHE (tenant #1) BRAND / CONTACT seed lands, sourced from brand.ts.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string, orgB: string;
let aAdmin: string, bAdmin: string, aUser: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  // org A is the seeded tenant #1 (FHE); org B is a second tenant with a distinct slug.
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug, status) values ('Boarding Barn','boarding-barn','ACTIVE') returning id`))[0].id;

  // Distinct business_config (typed) rows per tenant — legal identity + a sensitive
  // financial internal (commission) that must NEVER cross to anon. Org A already has
  // a seeded singleton row (migration 20), so UPDATE it; org B is fresh, so INSERT.
  await h.q(
    `update business_config set legal_entity_name='French Heritage Equestrian',
        signatory_name='A. Owner', signatory_title='Managing Member',
        commission_purchase_rate=15.00, commission_min=2500.00, document_retention='7 years',
        esignature_provider='DocuSign', sales_tax_rate=7.75
     where org_id=$1`, [orgA]);
  await h.q(
    `insert into business_config (org_id, legal_entity_name, signatory_name, signatory_title,
        commission_purchase_rate, commission_min, document_retention, esignature_provider, sales_tax_rate)
     values ($1,'Boarding Barn LLC','B. Boss','Owner',20.00,9999.00,'10 years','HelloSign',9.25)`, [orgB]);

  // Distinct EAV config for each tenant (org B overrides the seeded FHE brand).
  await h.q(
    `insert into config_values (org_id, namespace, key, value_text, category) values
       ($1,'BRAND','NAME','Boarding Barn','branding'),
       ($1,'CONTACT','EMAIL','info@boardingbarn.test','contact'),
       ($1,'CONTACT','PHONE','555-000-2222','contact')`, [orgB]);

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
  aUser  = await h.createAuthUser({ role: 'USER',  org: orgA });
});
afterAll(async () => {
  await h?.close();
});

describe('config_value() — typed + EAV resolution, current_org()-scoped', () => {
  it('resolves the TYPED business_config field (ORG.LEGAL_NAME) for the caller tenant', async () => {
    await h.asUser(aAdmin);
    const [a] = await h.q<{ v: string }>(`select config_value('ORG','LEGAL_NAME') as v`);
    expect(a.v).toBe('French Heritage Equestrian');

    await h.asUser(bAdmin);
    const [b] = await h.q<{ v: string }>(`select config_value('ORG','LEGAL_NAME') as v`);
    expect(b.v).toBe('Boarding Barn LLC');
  });

  it('resolves the EAV config_values field (BRAND.NAME / CONTACT.EMAIL) for the caller tenant', async () => {
    await h.asUser(aAdmin);
    expect((await h.q<{ v: string }>(`select config_value('BRAND','NAME') as v`))[0].v)
      .toBe('French Heritage Equestrian'); // FHE seed from brand.ts
    expect((await h.q<{ v: string }>(`select config_value('CONTACT','EMAIL') as v`))[0].v)
      .toBe('Hello@FHEquestrian.com');

    await h.asUser(bAdmin);
    expect((await h.q<{ v: string }>(`select config_value('BRAND','NAME') as v`))[0].v)
      .toBe('Boarding Barn');
    expect((await h.q<{ v: string }>(`select config_value('CONTACT','EMAIL') as v`))[0].v)
      .toBe('info@boardingbarn.test');
  });

  it('is scoped to current_org(): org A resolves only its own values (never org B\'s)', async () => {
    await h.asUser(aAdmin);
    // org A never sees org B's distinct contact phone.
    expect((await h.q<{ v: string }>(`select config_value('CONTACT','PHONE') as v`))[0].v)
      .toBe('858-439-3614'); // FHE seed, not '555-000-2222'
    // A member (USER) can still read their own org's non-sensitive brand config.
    await h.asUser(aUser);
    expect((await h.q<{ v: string }>(`select config_value('BRAND','NAME') as v`))[0].v)
      .toBe('French Heritage Equestrian');
  });

  it('returns NULL for an unset EAV key (the go-live check flags required ones)', async () => {
    await h.asUser(aAdmin);
    const [row] = await h.q<{ v: string | null }>(`select config_value('BRAND','NONEXISTENT') as v`);
    expect(row.v).toBeNull();
  });
});

describe('config_values — org boundary (seam 1) + default org_id', () => {
  it('org A cannot SEE org B rows', async () => {
    await h.asUser(aAdmin);
    const namesA = (await h.q<{ key: string; value_text: string }>(
      `select key, value_text from config_values where namespace='BRAND'`)).map((r) => r.value_text);
    expect(namesA).toContain('French Heritage Equestrian');
    expect(namesA).not.toContain('Boarding Barn');
  });

  it('org A cannot WRITE a row into org B (RESTRICTIVE WITH CHECK)', async () => {
    await h.asUser(aAdmin);
    await expect(h.q(
      `insert into config_values (org_id, namespace, key, value_text) values ($1,'BRAND','TAGLINE','x')`, [orgB]))
      .rejects.toThrow();
  });

  it('defaults org_id to the caller\'s tenant when omitted', async () => {
    await h.asUser(aAdmin);
    await h.q(`insert into config_values (namespace, key, value_text) values ('BRAND','PRIMARY_COLOR','#123456')`);
    await h.asSuperuser();
    const [row] = await h.q<{ org_id: string }>(
      `select org_id from config_values where namespace='BRAND' and key='PRIMARY_COLOR'`);
    expect(row.org_id).toBe(orgA);
  });
});

describe('config_values — UNIQUE(org, namespace, key)', () => {
  it('rejects a duplicate (org, namespace, key)', async () => {
    await h.asUser(bAdmin);
    // org B already has BRAND.NAME; a second insert must violate the unique index.
    await expect(h.q(
      `insert into config_values (namespace, key, value_text) values ('BRAND','NAME','Dup')`))
      .rejects.toThrow();
  });

  it('allows the same (namespace,key) in a DIFFERENT org (unique is per-org)', async () => {
    // orgA seeded BRAND.NAME and orgB seeded BRAND.NAME independently — both exist.
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: string }>(
      `select count(*)::int as n from config_values where namespace='BRAND' and key='NAME'`);
    expect(Number(n)).toBe(2);
  });
});

describe('org_public_config(slug) — anon-safe public exposure', () => {
  it('returns brand + public contact for the ADDRESSED tenant, as anon', async () => {
    await h.asAnon();
    const [row] = await h.q<{ cfg: Record<string, unknown> }>(
      `select org_public_config('fhe') as cfg`);
    const cfg = row.cfg;
    expect(cfg).not.toBeNull();
    expect((cfg.brand as Record<string, string>).NAME).toBe('French Heritage Equestrian');
    expect((cfg.brand as Record<string, string>).CONTACT_EMAIL).toBe('Hello@FHEquestrian.com');
    expect((cfg.brand as Record<string, string>).CONTACT_PHONE).toBe('858-439-3614');
    expect(cfg.org_id).toBe(orgA);
  });

  it('addresses each tenant by its own slug — org B gets org B brand, not FHE', async () => {
    await h.asAnon();
    const [row] = await h.q<{ cfg: Record<string, unknown> }>(
      `select org_public_config('boarding-barn') as cfg`);
    const brand = (row.cfg.brand as Record<string, string>);
    expect(brand.NAME).toBe('Boarding Barn');
    expect(brand.CONTACT_EMAIL).toBe('info@boardingbarn.test');
    // and it does NOT leak FHE's identity
    expect(brand.NAME).not.toBe('French Heritage Equestrian');
  });

  it('NEVER exposes commission / retention / e-sign / tax internals to anon', async () => {
    await h.asAnon();
    const [row] = await h.q<{ cfg: Record<string, unknown> }>(
      `select org_public_config('fhe') as cfg`);
    const blob = JSON.stringify(row.cfg);
    // the sensitive business_config internals seeded for org A
    expect(blob).not.toContain('DocuSign');       // esignature_provider
    expect(blob).not.toContain('7 years');        // document_retention
    expect(blob).not.toContain('2500');           // commission_min
    expect(blob).not.toMatch(/commission/i);
    expect(blob).not.toMatch(/retention/i);
    expect(blob).not.toMatch(/tax/i);
    expect(blob).not.toContain('7.75');           // sales_tax_rate
  });

  it('returns NULL for an unknown / inactive slug', async () => {
    await h.asAnon();
    const [row] = await h.q<{ cfg: unknown }>(`select org_public_config('no-such-tenant') as cfg`);
    expect(row.cfg).toBeNull();
  });

  it('exposes the module + pricing list shape (arrays)', async () => {
    await h.asAnon();
    const [row] = await h.q<{ cfg: Record<string, unknown> }>(
      `select org_public_config('fhe') as cfg`);
    expect(Array.isArray(row.cfg.modules)).toBe(true);
    expect(Array.isArray(row.cfg.pricing)).toBe(true);
  });
});

describe('config_keys + go-live completeness check', () => {
  it('seeds the global key whitelist with expected_type + required flags', async () => {
    await h.asAnon(); // config_keys is world-readable
    const rows = await h.q<{ namespace: string; key: string; required: boolean; expected_type: string }>(
      `select namespace, key, required, expected_type from config_keys order by namespace, key`);
    const brandName = rows.find((r) => r.namespace === 'BRAND' && r.key === 'NAME');
    expect(brandName?.required).toBe(true);
    expect(brandName?.expected_type).toBe('text');
    // required contact keys are present
    expect(rows.some((r) => r.namespace === 'CONTACT' && r.key === 'EMAIL' && r.required)).toBe(true);
    expect(rows.some((r) => r.namespace === 'CONTACT' && r.key === 'PHONE' && r.required)).toBe(true);
  });

  it('a required config_keys entry left UNSET is detectable per tenant', async () => {
    await h.asSuperuser();
    // org B was seeded BRAND.NAME + CONTACT.EMAIL + CONTACT.PHONE, and its typed
    // business_config column IS filled ('Boarding Barn LLC'), so ORG.LEGAL_NAME
    // counts as SET — none of these should be flagged missing.
    const missingB = (await h.q<{ namespace: string; key: string }>(
      `select namespace, key from config_required_missing($1)`, [orgB]))
      .map((r) => `${r.namespace}.${r.key}`);
    expect(missingB).not.toContain('ORG.LEGAL_NAME'); // typed column satisfies it
    expect(missingB).not.toContain('BRAND.NAME');     // EAV row set
    expect(missingB).not.toContain('CONTACT.EMAIL');  // EAV row set

    // A fresh tenant with NOTHING seeded → every required key surfaces.
    const orgC = (await h.q<{ id: string }>(
      `insert into organizations (name, slug) values ('Empty Co','empty-co') returning id`))[0].id;
    const missingC = (await h.q<{ namespace: string; key: string }>(
      `select namespace, key from config_required_missing($1)`, [orgC]))
      .map((r) => `${r.namespace}.${r.key}`);
    expect(missingC).toContain('BRAND.NAME');
    expect(missingC).toContain('CONTACT.EMAIL');
    expect(missingC).toContain('CONTACT.PHONE');
    expect(missingC).toContain('ORG.LEGAL_NAME'); // no business_config row either
  });
});

describe('generate_document — {{ORG.*}} / {{FHE.*}} CONTACT wiring (U3 half)', () => {
  it('resolves CONTACT phone/email per tenant — the arm generate_document reads', async () => {
    // No shipped body contains {{ORG.PHONE}} today (§6.2), so we assert the exact
    // source generate_document's ORG.* arm reads: config_values ns CONTACT, scoped
    // to the tenant. This is the real data path the merge engine now consumes.
    await h.asUser(aAdmin);
    expect((await h.q<{ v: string }>(`select config_value('CONTACT','PHONE') as v`))[0].v)
      .toBe('858-439-3614');
    expect((await h.q<{ v: string }>(`select config_value('CONTACT','EMAIL') as v`))[0].v)
      .toBe('Hello@FHEquestrian.com');

    // And prove generate_document itself renders a per-template {{ORG.PHONE}} token
    // from the CONTACT registry: attach a probe token+body to a spare template.
    await h.asSuperuser();
    const tmpl = (await h.q<{ id: string }>(
      `select id from contract_templates where body is not null and active and deleted_at is null limit 1`))[0];
    // stash the original body, inject a probe, then restore afterwards
    const orig = (await h.q<{ body: string }>(`select body from contract_templates where id=$1`, [tmpl.id]))[0].body;
    await h.q(`update contract_templates set body = body || ' PHONE={{ORG.PHONE}}' where id=$1`, [tmpl.id]);
    await h.q(
      `insert into template_tokens (template_id, namespace, field, token, kind)
       values ($1,'ORG','PHONE','{{ORG.PHONE}}','field')`, [tmpl.id]);

    // Build a minimal engagement in org A (superuser context; org_id defaults to
    // the seed GUC = org A / tenant #1).
    const svc = (await h.q<{ code: string }>(`select code from service_types order by code limit 1`))[0].code;
    const cc = (await h.q<{ id: string }>(`insert into contacts (first_name, last_name) values ('Probe', 'Client') returning id`))[0].id;
    const cl = (await h.q<{ id: string }>(`insert into clients (contact_id) values ($1) returning id`, [cc]))[0].id;
    const eng = (await h.q<{ id: string }>(
      `insert into engagements (client_id, service_type, start_date) values ($1,$2,'2026-07-01') returning id`,
      [cl, svc]))[0].id;
    const key = (await h.q<{ template_key: string }>(
      `select template_key from contract_templates where id=$1`, [tmpl.id]))[0].template_key;

    const [doc] = await h.q<{ merged_body: string }>(
      `select merged_body from generate_document($1,$2)`, [eng, key]);
    expect(doc.merged_body).toContain('PHONE=858-439-3614');

    // restore the template so no other test observes the probe
    await h.q(`update contract_templates set body=$2 where id=$1`, [tmpl.id, orig]);
    await h.q(`delete from template_tokens where template_id=$1 and token='{{ORG.PHONE}}'`, [tmpl.id]);
    await h.q(`delete from documents where engagement_id=$1`, [eng]);
  });
});
