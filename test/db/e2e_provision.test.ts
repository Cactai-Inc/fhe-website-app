/**
 * E2E-PROVISION (critical chain #1, FEATURE_BUILD_PLAN §E2E): provision → the new
 * tenant is fully born — modules per tier, cloned default catalog, branded config,
 * a go-live gap list from config_required_missing — and isolated from tenant #1.
 *
 * Real-path throughout: the ACTUAL provision_tenant RPC as the CORRECT RLS role
 * (SUPER_ADMIN), config_required_missing for the gap list, org_public_config as
 * anon for the branded public surface, has_module as the new tenant's ADMIN.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let fheOrg: string;      // tenant #1 — the template org whose catalog is cloned
let superAdmin: string;  // SUPER_ADMIN of tenant #1 (the platform owner)
let plainAdmin: string;  // a NON-super tenant ADMIN (must be rejected)
let newAdminUid: string; // the auth user who becomes the new tenant's ADMIN
let newOrg: string;      // the provisioned tenant

const SLUG = 'e2e-prov-barn';

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  fheOrg = (await h.q<{ id: string }>(
    `select id from organizations order by created_at limit 1`))[0].id;

  // Template catalog on tenant #1 so the clone step has real rows to copy:
  // a core product (module_key NULL — always cloned), a boarding product (cloned
  // for a tier.boarding tenant) and a brokerage product (must NOT clone).
  await h.q(
    `insert into products (org_id, product_key, name, module_key, active) values
       ($1,'e2e-consult-hour','Consultation Hour', NULL, true),
       ($1,'e2e-board-monthly','Monthly Board','mod.boarding', true),
       ($1,'e2e-brokerage-fee','Brokerage Fee','mod.brokerage', true)`, [fheOrg]);
  const board = (await h.q<{ id: string }>(
    `select id from products where org_id=$1 and product_key='e2e-board-monthly'`, [fheOrg]))[0].id;
  await h.q(
    `insert into product_prices (org_id, product_id, amount, effective_from)
       values ($1,$2,850.00, now() - interval '1 day')`, [fheOrg, board]);

  superAdmin = await h.createAuthUser({ role: 'SUPER_ADMIN', org: fheOrg });
  plainAdmin = await h.createAuthUser({ role: 'ADMIN', org: fheOrg });

  await h.asSuperuser();
  newAdminUid = (await h.q<{ id: string }>(
    `insert into auth.users (email) values ('owner@e2e-prov-barn.test') returning id`))[0].id;
});

afterAll(async () => { await h?.close(); });

describe('chain 1 — provision_tenant births the tenant (SUPER_ADMIN only)', () => {
  it('rejects a non-SUPER_ADMIN caller and leaks no org', async () => {
    await h.asUser(plainAdmin);
    await expect(
      h.q(`select provision_tenant('Nope Barn','e2e-nope','tier.boarding','x@nope.test',$1)`, [null]),
    ).rejects.toThrow(/SUPER_ADMIN/i);
    await h.asSuperuser();
    expect(await h.q(`select 1 from organizations where slug='e2e-nope'`)).toHaveLength(0);
  });

  it('a SUPER_ADMIN provisions a tier.boarding tenant (brand given, CONTACT deliberately left unset)', async () => {
    await h.asUser(superAdmin);
    const [row] = await h.q<{ org: string }>(
      `select provision_tenant(
         'E2E Prov Barn LLC', $1, 'tier.boarding', 'owner@e2e-prov-barn.test', $2,
         '{"BRAND.NAME":"E2E Prov Barn","BRAND.PRIMARY_COLOR":"#123456"}'::jsonb,
         '{"LEGAL_NAME":"E2E Prov Barn LLC","SIGNATORY_NAME":"P. Owner","SIGNATORY_TITLE":"Owner","ADDRESS":"9 Prov Rd"}'::jsonb,
         '{"SALES_TAX_RATE":7.75}'::jsonb,
         NULL
       ) as org`, [SLUG, newAdminUid]);
    expect(row.org).toBeTruthy();
    newOrg = row.org;
    expect(newOrg).not.toBe(fheOrg);

    await h.asSuperuser();
    const [org] = await h.q<{ status: string; name: string }>(
      `select status, name from organizations where id=$1`, [newOrg]);
    expect(org.status).toBe('ACTIVE');
    expect(org.name).toBe('E2E Prov Barn LLC');
  });

  it('grants EXACTLY the tier.boarding module set (org_modules, source TIER, org-scoped)', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ module_key: string; source: string; enabled: boolean; org_id: string }>(
      `select module_key, source, enabled, org_id from org_modules where org_id=$1 order by module_key`, [newOrg]);
    expect(rows.map((r) => r.module_key)).toEqual(['mod.barnops', 'mod.boarding', 'mod.horserecords']);
    expect(rows.every((r) => r.source === 'TIER' && r.enabled && r.org_id === newOrg)).toBe(true);
  });

  it('clones the granted-module default catalog (core + boarding; brokerage NOT cloned), prices included', async () => {
    await h.asSuperuser();
    const prods = await h.q<{ product_key: string; org_id: string }>(
      `select product_key, org_id from products where org_id=$1`, [newOrg]);
    const keys = prods.map((p) => p.product_key);
    expect(keys).toContain('e2e-consult-hour');       // core (module_key NULL)
    expect(keys).toContain('e2e-board-monthly');      // granted module
    expect(keys).not.toContain('e2e-brokerage-fee');  // module NOT granted by the tier
    expect(prods.every((p) => p.org_id === newOrg)).toBe(true);

    const [price] = await h.q<{ amount: string; org_id: string }>(
      `select pp.amount, pp.org_id from product_prices pp
         join products p on p.id = pp.product_id
        where p.org_id=$1 and p.product_key='e2e-board-monthly'`, [newOrg]);
    expect(Number(price.amount)).toBe(850);
    expect(price.org_id).toBe(newOrg);
  });

  it('seeds the branded config (config_values BRAND.* + business_config legal row), org-scoped', async () => {
    await h.asSuperuser();
    const brand = await h.q<{ key: string; value_text: string; org_id: string }>(
      `select key, value_text, org_id from config_values where org_id=$1 and namespace='BRAND' order by key`,
      [newOrg]);
    const byKey = Object.fromEntries(brand.map((r) => [r.key, r.value_text]));
    expect(byKey['NAME']).toBe('E2E Prov Barn');
    expect(byKey['PRIMARY_COLOR']).toBe('#123456');
    expect(brand.every((r) => r.org_id === newOrg)).toBe(true);

    const [cfg] = await h.q<{ legal_entity_name: string; signatory_name: string; sales_tax_rate: string }>(
      `select legal_entity_name, signatory_name, sales_tax_rate from business_config where org_id=$1`, [newOrg]);
    expect(cfg.legal_entity_name).toBe('E2E Prov Barn LLC');
    expect(cfg.signatory_name).toBe('P. Owner');
    expect(Number(cfg.sales_tax_rate)).toBe(7.75);
  });

  it('the branded PUBLIC surface resolves for anon via org_public_config(slug)', async () => {
    await h.asAnon();
    const [row] = await h.q<{ cfg: { brand: Record<string, string>; modules: string[] } }>(
      `select org_public_config($1) as cfg`, [SLUG]);
    expect(row.cfg.brand['NAME']).toBe('E2E Prov Barn');
    expect(row.cfg.modules).toContain('mod.boarding');
    expect(row.cfg.modules).not.toContain('mod.brokerage');
  });
});

describe('chain 1 — config_required_missing lists the go-live gaps', () => {
  it('lists exactly the unset required keys (CONTACT.EMAIL / CONTACT.PHONE)', async () => {
    await h.asUser(superAdmin);
    const rows = await h.q<{ namespace: string; key: string }>(
      `select namespace, key from config_required_missing($1) order by namespace, key`, [newOrg]);
    // BRAND.NAME was provisioned; ORG.LEGAL_NAME is satisfied by the typed
    // business_config column; CONTACT.EMAIL + CONTACT.PHONE were deliberately unset.
    expect(rows.map((r) => `${r.namespace}.${r.key}`)).toEqual(['CONTACT.EMAIL', 'CONTACT.PHONE']);
  });

  it('filling the gaps empties the list', async () => {
    await h.asSuperuser();
    await h.q(
      `insert into config_values (org_id, namespace, key, value_text, category) values
         ($1,'CONTACT','EMAIL','hello@e2e-prov-barn.test','contact'),
         ($1,'CONTACT','PHONE','555-0101','contact')`, [newOrg]);
    const rows = await h.q(`select * from config_required_missing($1)`, [newOrg]);
    expect(rows).toHaveLength(0);
  });
});

describe('chain 1 — the new ADMIN logs in gated + isolated from tenant #1', () => {
  it('has_module reflects the tier for the logged-in new ADMIN', async () => {
    await h.asUser(newAdminUid);
    expect((await h.q<{ ok: boolean }>(`select has_module('mod.boarding') as ok`))[0].ok).toBe(true);
    expect((await h.q<{ ok: boolean }>(`select has_module('mod.barnops') as ok`))[0].ok).toBe(true);
    expect((await h.q<{ ok: boolean }>(`select has_module('mod.brokerage') as ok`))[0].ok).toBe(false);
    await expect(h.q(`select require_module('mod.brokerage')`)).rejects.toThrow(/not enabled/i);
  });

  it('ISOLATION: the new ADMIN sees ONLY the new tenant\'s config/modules — nothing of org #1', async () => {
    await h.asUser(newAdminUid);
    const cfgs = await h.q<{ org_id: string }>(`select org_id from config_values`);
    expect(cfgs.length).toBeGreaterThan(0);
    expect(cfgs.every((r) => r.org_id === newOrg)).toBe(true);
    const oms = await h.q<{ org_id: string }>(`select org_id from org_modules`);
    expect(oms.every((r) => r.org_id === newOrg)).toBe(true);
    const prods = await h.q<{ org_id: string }>(`select org_id from products`);
    expect(prods.every((r) => r.org_id === newOrg)).toBe(true);
  });

  it('ISOLATION the other way: tenant #1 keeps its own entitlements/config untouched', async () => {
    await h.asUser(plainAdmin);
    const oms = await h.q<{ module_key: string; org_id: string }>(
      `select module_key, org_id from org_modules order by module_key`);
    expect(oms.map((r) => r.module_key)).toEqual(['mod.brokerage', 'mod.horserecords', 'mod.lessons']);
    expect(oms.every((r) => r.org_id === fheOrg)).toBe(true);
    // and org #1's template products are still its own (not re-homed by the clone)
    await h.asSuperuser();
    const tpl = await h.q(`select 1 from products where org_id=$1 and product_key='e2e-board-monthly'`, [fheOrg]);
    expect(tpl).toHaveLength(1);
  });
});
