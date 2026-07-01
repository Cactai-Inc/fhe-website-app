/**
 * provision_tenant() + set_org_module() (U6, migration 20260630050000_provision_tenant)
 * — module core.tenancy.
 *
 * Real-path data tests (Wiring & Verification Contract §15.1(1) + §15.2 critical
 * chain #1): every assertion drives the ACTUAL provision_tenant / set_org_module RPCs
 * the /api layer calls, as the CORRECT RLS role (SUPER_ADMIN / a non-super caller),
 * and asserts the rows land in the RIGHT tables (organizations, business_config,
 * config_values, org_modules, products/product_prices, profiles, audit_logs) with the
 * RIGHT columns, org-scoped to the NEW tenant, and read back.
 *
 * Covers the spec's required proofs:
 *  - a SUPER_ADMIN provisions a second tenant (slug 'boarding-barn', DISTINCT from
 *    'rival'/'fhe') with tier.boarding; org + business_config + config_values +
 *    org_modules + ADMIN profile all created and org-scoped to the new tenant;
 *  - a non-SUPER_ADMIN caller is REJECTED;
 *  - re-running with the same slug behaves idempotently/atomically — the second call
 *    raises and leaves NO partial tenant (exactly one org for that slug);
 *  - the seeded tenant's has_module('mod.boarding') is TRUE and
 *    has_module('mod.brokerage') is FALSE (tier gate is real);
 *  - the tier's default catalog is cloned into the new tenant (real clone path);
 *  - set_org_module flips an add-on entitlement on/off.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let fheOrg: string;          // tenant #1 (the template org)
let superAdmin: string;      // SUPER_ADMIN in tenant #1 — the platform owner
let plainUser: string;       // a non-super caller (ADMIN of tenant #1)
let newAdminUid: string;     // the /api-created auth user to become the new tenant ADMIN

const SLUG = 'boarding-barn'; // DISTINCT from 'rival' and 'fhe'

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  fheOrg = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  // Seed a DEFAULT catalog on the template org (tenant #1) so the clone step has real
  // rows to copy — proves provision_tenant actually clones products/product_prices.
  // A boarding-module product (cloned only when the new tenant has mod.boarding) and a
  // brokerage-module product (must NOT clone into a boarding-tier tenant).
  await h.q(
    `insert into products (org_id, product_key, name, module_key, active)
       values ($1,'board-monthly','Monthly Board','mod.boarding',true)`, [fheOrg]);
  await h.q(
    `insert into products (org_id, product_key, name, module_key, active)
       values ($1,'brokerage-fee','Brokerage Fee','mod.brokerage',true)`, [fheOrg]);
  const boardProd = (await h.q<{ id: string }>(
    `select id from products where org_id=$1 and product_key='board-monthly'`, [fheOrg]))[0].id;
  await h.q(
    `insert into product_prices (org_id, product_id, amount, effective_from)
       values ($1,$2,850.00, now() - interval '1 day')`, [fheOrg, boardProd]);

  superAdmin = await h.createAuthUser({ role: 'SUPER_ADMIN', org: fheOrg });
  plainUser = await h.createAuthUser({ role: 'ADMIN', org: fheOrg });

  // The auth user the /api layer would find-or-create for the new tenant's ADMIN.
  await h.asSuperuser();
  newAdminUid = (await h.q<{ id: string }>(
    `insert into auth.users (email) values ('owner@boarding-barn.test') returning id`))[0].id;
});

afterAll(async () => {
  await h?.close();
});

// ---------------------------------------------------------------------------
// Access control — SUPER_ADMIN only.
// ---------------------------------------------------------------------------
describe('provision_tenant is SUPER_ADMIN-only', () => {
  it('rejects a non-SUPER_ADMIN caller (a plain tenant ADMIN)', async () => {
    await h.asUser(plainUser);
    await expect(
      h.q(
        `select provision_tenant('Denied Barn','denied-barn','tier.boarding','x@denied.test', $1)`,
        [null],
      ),
    ).rejects.toThrow(/SUPER_ADMIN/i);
    // and NO org leaked in from the rejected call
    await h.asSuperuser();
    const rows = await h.q(`select 1 from organizations where slug='denied-barn'`);
    expect(rows).toHaveLength(0);
  });

  it('rejects an anonymous caller', async () => {
    await h.asAnon();
    await expect(
      h.q(`select provision_tenant('Anon Barn','anon-barn','tier.boarding','x@anon.test', $1)`, [null]),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// The blessed happy path — a SUPER_ADMIN provisions a second tenant.
// ---------------------------------------------------------------------------
describe('a SUPER_ADMIN provisions a second tenant (tier.boarding)', () => {
  let newOrg: string;

  it('creates the org and returns its id', async () => {
    await h.asUser(superAdmin);
    const [row] = await h.q<{ org: string }>(
      `select provision_tenant(
         'Boarding Barn LLC', $1, 'tier.boarding', 'owner@boarding-barn.test',
         $2,
         '{"BRAND.NAME":"Boarding Barn","CONTACT.EMAIL":"hello@boarding-barn.test","CONTACT.PHONE":"555-0100"}'::jsonb,
         '{"LEGAL_NAME":"Boarding Barn LLC","SIGNATORY_NAME":"B. Boss","SIGNATORY_TITLE":"Owner","ADDRESS":"1 Barn Rd"}'::jsonb,
         '{"COMMISSION_PURCHASE_RATE":10,"SALES_TAX_RATE":7.75}'::jsonb,
         NULL
       ) as org`,
      [SLUG, newAdminUid]);
    expect(row.org).toBeTruthy();
    newOrg = row.org;
    expect(newOrg).not.toBe(fheOrg);
  });

  it('the organizations row is created ACTIVE with the given slug + an ORG- code', async () => {
    await h.asSuperuser();
    const [org] = await h.q<{ id: string; name: string; slug: string; status: string; display_code: string }>(
      `select id, name, slug, status, display_code from organizations where slug=$1`, [SLUG]);
    expect(org.id).toBe(newOrg);
    expect(org.name).toBe('Boarding Barn LLC');
    expect(org.status).toBe('ACTIVE');
    expect(org.display_code).toMatch(/^ORG-/);
  });

  it('seeds a business_config typed row org-scoped to the new tenant (legal + rates)', async () => {
    await h.asSuperuser();
    const [cfg] = await h.q<{
      org_id: string; legal_entity_name: string; signatory_name: string;
      signatory_title: string; business_address: string;
      commission_purchase_rate: string; sales_tax_rate: string;
    }>(`select org_id, legal_entity_name, signatory_name, signatory_title, business_address,
               commission_purchase_rate, sales_tax_rate
          from business_config where org_id=$1`, [newOrg]);
    expect(cfg.org_id).toBe(newOrg);
    expect(cfg.legal_entity_name).toBe('Boarding Barn LLC');
    expect(cfg.signatory_name).toBe('B. Boss');
    expect(cfg.signatory_title).toBe('Owner');
    expect(cfg.business_address).toBe('1 Barn Rd');
    expect(Number(cfg.commission_purchase_rate)).toBe(10);
    expect(Number(cfg.sales_tax_rate)).toBe(7.75);
    // isolation: exactly one business_config for this tenant, and it is NOT FHE's.
    const count = await h.q(`select 1 from business_config where org_id=$1`, [newOrg]);
    expect(count).toHaveLength(1);
  });

  it('seeds config_values BRAND / CONTACT rows org-scoped to the new tenant', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ namespace: string; key: string; value_text: string; org_id: string }>(
      `select namespace, key, value_text, org_id from config_values where org_id=$1 order by namespace, key`,
      [newOrg]);
    expect(rows.every((r) => r.org_id === newOrg)).toBe(true);
    const byKey = Object.fromEntries(rows.map((r) => [`${r.namespace}.${r.key}`, r.value_text]));
    expect(byKey['BRAND.NAME']).toBe('Boarding Barn');
    expect(byKey['CONTACT.EMAIL']).toBe('hello@boarding-barn.test');
    expect(byKey['CONTACT.PHONE']).toBe('555-0100');
  });

  it('seeds org_modules from tier.boarding (mod.boarding/horserecords/barnops), org-scoped', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ module_key: string; source: string; enabled: boolean; org_id: string }>(
      `select module_key, source, enabled, org_id from org_modules where org_id=$1 order by module_key`,
      [newOrg]);
    expect(rows.map((r) => r.module_key)).toEqual(['mod.barnops', 'mod.boarding', 'mod.horserecords']);
    for (const r of rows) {
      expect(r.source).toBe('TIER');
      expect(r.enabled).toBe(true);
      expect(r.org_id).toBe(newOrg);
    }
    // brokerage/lessons are NOT granted by tier.boarding.
    expect(rows.map((r) => r.module_key)).not.toContain('mod.brokerage');
    expect(rows.map((r) => r.module_key)).not.toContain('mod.lessons');
  });

  it('creates an ADMIN profile bound to the new tenant (the passed-in auth user)', async () => {
    await h.asSuperuser();
    const [prof] = await h.q<{ user_id: string; email: string; role: string; org_id: string; contact_id: string | null }>(
      `select user_id, email, role, org_id, contact_id from profiles where user_id=$1`, [newAdminUid]);
    expect(prof.role).toBe('ADMIN');
    expect(prof.org_id).toBe(newOrg);
    expect(prof.email).toBe('owner@boarding-barn.test');
    // the profiles->contact trigger bound identity
    expect(prof.contact_id).toBeTruthy();
  });

  it('the new ADMIN, logged in, sees has_module boarding TRUE and brokerage FALSE', async () => {
    await h.asUser(newAdminUid);
    const [b] = await h.q<{ ok: boolean }>(`select has_module('mod.boarding') as ok`);
    const [k] = await h.q<{ ok: boolean }>(`select has_module('mod.brokerage') as ok`);
    expect(b.ok).toBe(true);
    expect(k.ok).toBe(false);
    // require_module enforces it too
    await expect(h.q(`select require_module('mod.brokerage')`)).rejects.toThrow(/not enabled/i);
    const ok = await h.q(`select require_module('mod.boarding')`);
    expect(ok).toHaveLength(1);
  });

  it('clones ONLY the granted-module default catalog into the new tenant (real clone path)', async () => {
    await h.asSuperuser();
    const prods = await h.q<{ product_key: string; module_key: string | null; org_id: string }>(
      `select product_key, module_key, org_id from products where org_id=$1 order by product_key`, [newOrg]);
    const keys = prods.map((p) => p.product_key);
    // board product (module granted) cloned; brokerage product (module NOT granted) not cloned.
    expect(keys).toContain('board-monthly');
    expect(keys).not.toContain('brokerage-fee');
    expect(prods.every((p) => p.org_id === newOrg)).toBe(true);
    // its price row was cloned too, org-scoped, at the current effective amount.
    const [price] = await h.q<{ amount: string; org_id: string }>(
      `select pp.amount, pp.org_id from product_prices pp
         join products p on p.id = pp.product_id
        where p.org_id=$1 and p.product_key='board-monthly'`, [newOrg]);
    expect(Number(price.amount)).toBe(850);
    expect(price.org_id).toBe(newOrg);
  });

  it('emits a PROVISION_TENANT audit marker for the new org', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ new_value: { event: string; slug: string; tier_key: string } }>(
      `select new_value from audit_logs
        where table_name='provision_tenant' and record_id=$1`, [newOrg]);
    expect(rows).toHaveLength(1);
    expect(rows[0].new_value.event).toBe('PROVISION_TENANT');
    expect(rows[0].new_value.slug).toBe(SLUG);
    expect(rows[0].new_value.tier_key).toBe('tier.boarding');
  });

  it('TENANT ISOLATION: the new ADMIN cannot see FHE (tenant #1) data', async () => {
    await h.asUser(newAdminUid);
    // config_values + org_modules + business_config all scope to current_org() (new tenant)
    const cfgs = await h.q<{ org_id: string }>(`select org_id from config_values`);
    expect(cfgs.every((r) => r.org_id === newOrg)).toBe(true);
    expect(cfgs.some((r) => r.org_id === fheOrg)).toBe(false);
    const bc = await h.q<{ org_id: string }>(`select org_id from business_config`);
    expect(bc.every((r) => r.org_id === newOrg)).toBe(true);
    const oms = await h.q<{ org_id: string }>(`select org_id from org_modules`);
    expect(oms.every((r) => r.org_id === newOrg)).toBe(true);
  });

  it('does NOT disturb FHE (tenant #1) entitlements — still lesson_brokerage', async () => {
    await h.asSuperuser();
    const rows = (await h.q<{ module_key: string }>(
      `select module_key from org_modules where org_id=$1 order by module_key`, [fheOrg]))
      .map((r) => r.module_key);
    expect(rows).toEqual(['mod.brokerage', 'mod.horserecords', 'mod.lessons']);
  });
});

// ---------------------------------------------------------------------------
// Idempotency / atomicity — a same-slug re-run raises and leaves NO partial tenant.
// ---------------------------------------------------------------------------
describe('re-running with the same slug is atomic (no partial tenant)', () => {
  it('the second provision with the same slug raises', async () => {
    await h.asUser(superAdmin);
    await expect(
      h.q(
        `select provision_tenant('Boarding Barn Two', $1, 'tier.boarding', 'dup@boarding-barn.test', $2)`,
        [SLUG, null],
      ),
    ).rejects.toThrow();
  });

  it('there is still EXACTLY ONE org for that slug (the first), and no orphaned config', async () => {
    await h.asSuperuser();
    const orgs = await h.q<{ id: string; name: string }>(
      `select id, name from organizations where slug=$1`, [SLUG]);
    expect(orgs).toHaveLength(1);
    expect(orgs[0].name).toBe('Boarding Barn LLC'); // the FIRST provision, not the rolled-back second
    // no business_config / org_modules leaked from the rolled-back attempt (each tenant
    // has exactly its own rows; count of orgs with slug is the invariant that matters).
    const [{ n }] = await h.q<{ n: string }>(
      `select count(*)::text as n from business_config where org_id=$1`, [orgs[0].id]);
    expect(Number(n)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// set_org_module — the add-on / billing seam.
// ---------------------------------------------------------------------------
describe('set_org_module flips an add-on entitlement', () => {
  let org: string;

  beforeAll(async () => {
    await h.asSuperuser();
    org = (await h.q<{ id: string }>(`select id from organizations where slug=$1`, [SLUG]))[0].id;
  });

  it('a SUPER_ADMIN can enable an add-on module (mod.lessons) on a tenant', async () => {
    await h.asUser(superAdmin);
    await h.q(`select set_org_module($1,'mod.lessons', true, 'ADDON')`, [org]);
    await h.asSuperuser();
    const [row] = await h.q<{ enabled: boolean; source: string; org_id: string }>(
      `select enabled, source, org_id from org_modules where org_id=$1 and module_key='mod.lessons'`, [org]);
    expect(row.enabled).toBe(true);
    expect(row.source).toBe('ADDON');
    expect(row.org_id).toBe(org);
    // the tenant's ADMIN now sees it live
    await h.asUser(newAdminUid);
    const [r] = await h.q<{ ok: boolean }>(`select has_module('mod.lessons') as ok`);
    expect(r.ok).toBe(true);
  });

  it('a SUPER_ADMIN can disable it again (upsert), and has_module flips off', async () => {
    await h.asUser(superAdmin);
    await h.q(`select set_org_module($1,'mod.lessons', false, 'ADDON')`, [org]);
    await h.asUser(newAdminUid);
    const [r] = await h.q<{ ok: boolean }>(`select has_module('mod.lessons') as ok`);
    expect(r.ok).toBe(false);
  });

  it('rejects a non-super authenticated caller', async () => {
    await h.asUser(plainUser);
    await expect(
      h.q(`select set_org_module($1,'mod.lessons', true, 'ADDON')`, [org]),
    ).rejects.toThrow(/SUPER_ADMIN|billing/i);
  });

  it('rejects an unknown module', async () => {
    await h.asUser(superAdmin);
    await expect(
      h.q(`select set_org_module($1,'mod.nope', true, 'ADDON')`, [org]),
    ).rejects.toThrow(/unknown module/i);
  });
});
