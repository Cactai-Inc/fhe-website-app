/**
 * U14 — RLS / gate / audit CI meta-tests + second-tenant isolation end-to-end.
 * Migration: 20260630130000_audit_gate_meta.sql (module core.payments).
 *
 * PLATFORM_ARCHITECTURE.md §4.3 / §11: these are the STANDING CI meta-tests that
 * guard the three stacking seams across the WHOLE schema — driven off
 * information_schema + pg_policy + pg_trigger, so a new table can never silently
 * ship without isolation, gating, or audit. Concretely:
 *
 *   (1) BOUNDARY present + RESTRICTIVE — every public table with an org_id column
 *       has a matching <t>_org_boundary policy that is RESTRICTIVE (polpermissive
 *       = false). A PERMISSIVE boundary would OR into access and breach tenancy.
 *       (Intended exception: `profiles`, the identity substrate current_org()
 *       itself resolves through — it carries self-scoped RLS, not a tenant
 *       boundary, and is enumerated in BOUNDARY_EXEMPT.)
 *
 *   (2) GATE present + RESTRICTIVE — every module-owned table has a <t>_module_gate
 *       policy that is RESTRICTIVE (not merely NAMED _module_gate). A PERMISSIVE
 *       gate would OR into access and widen visibility — this catches it.
 *
 *   (3) AUDIT coverage — every NEW business table (the U14 array) carries exactly
 *       one audit_row_change() trigger (attached by this migration, the sole owner).
 *
 *   (4) SUBSTRATE recursion guard — org_modules/config_values/business_config/
 *       modules/tiers/tier_modules carry NO _module_gate (else has_module() would
 *       recurse; §2/§4.1). Included here as a companion invariant.
 *
 * PLUS a real, end-to-end SECOND-TENANT isolation proof (§15.2): provision a tenant
 * on tier.boarding (slug distinct from 'rival'/'fhe'), assert it is DENIED the
 * brokerage tables/RPCs, sees ONLY its own data, and renders ITS OWN {{ORG.*}} brand
 * through the real generate_document RPC — never another tenant's identity.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;

// ---------------------------------------------------------------------------
// The 22 NEW business tables U14 attaches audit triggers to (the spec array).
// This is the SAME list the migration's DO-loop uses — the meta-test proves the
// migration actually attached them.
// ---------------------------------------------------------------------------
const BUSINESS_TABLES = [
  'org_modules', 'config_values',
  'products', 'product_prices', 'billable_lines',
  'engagement_stages',
  'lesson_packages', 'lesson_credits',
  'horse_parties', 'horse_health_events',
  'facilities', 'stalls', 'board_agreements', 'board_charges',
  'resources', 'resource_lots', 'consumption_events', 'cost_allocation_rules',
  'staff_profiles', 'shifts', 'time_entries', 'service_assignments',
] as const;

// The module-owned tables that MUST carry a RESTRICTIVE <t>_module_gate (seam 2).
// `products` gate is CONDITIONAL (module_key IS NULL OR has_module(module_key)) but
// still a real RESTRICTIVE policy named products_module_gate.
const MODULE_TABLES = [
  'products',
  'engagement_stages',
  'lesson_packages', 'lesson_credits',
  'horse_parties', 'horse_health_events',
  'facilities', 'stalls', 'board_agreements', 'board_charges',
  'resources', 'resource_lots', 'consumption_events', 'cost_allocation_rules',
  'staff_profiles', 'shifts', 'time_entries', 'service_assignments',
] as const;

// The entitlement/registry substrate the module gate itself reads — carries the
// boundary (per-tenant ones) or is global, but NEVER a _module_gate (recursion guard).
const SUBSTRATE_TABLES = [
  'org_modules', 'config_values', 'business_config',
  'modules', 'tiers', 'tier_modules',
] as const;

// org_id tables that intentionally do NOT carry a <t>_org_boundary policy.
// `profiles` is the identity substrate current_org() resolves through: it carries
// self-scoped RLS (profiles_select_own/insert_own/update_own), not a tenant
// boundary, because a tenant boundary would be circular (reading your own profile
// to compute current_org() would require current_org()).
const BOUNDARY_EXEMPT = new Set<string>(['profiles']);

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
});

afterAll(async () => {
  await h?.close();
});

// ===========================================================================
// (a) BOUNDARY present + RESTRICTIVE for every org_id table.
// ===========================================================================
describe('§4.3(a) every org_id table has a RESTRICTIVE <t>_org_boundary', () => {
  it('enumerates the org_id tables and their boundary policies from the catalog', async () => {
    const orgIdTables = (await h.q<{ table_name: string }>(
      `select table_name from information_schema.columns
        where table_schema='public' and column_name='org_id'
        order by table_name`,
    )).map((r) => r.table_name);

    // sanity: the schema really does have a large set of tenant-scoped tables, and
    // our known new tables are among them (guards against an empty/broken query).
    expect(orgIdTables.length).toBeGreaterThan(20);
    for (const t of ['engagement_stages', 'lesson_packages', 'facilities', 'billable_lines', 'config_values']) {
      expect(orgIdTables).toContain(t);
    }

    // Every org_id table (minus the enumerated substrate exception) MUST have a
    // policy named exactly <t>_org_boundary, and it MUST be RESTRICTIVE.
    const policies = await h.q<{ tbl: string; polname: string; permissive: boolean }>(
      `select c.relname as tbl, pol.polname, pol.polpermissive as permissive
         from pg_policy pol
         join pg_class c on c.oid = pol.polrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname='public' and pol.polname like '%\\_org\\_boundary'`,
    );
    const byTable = new Map<string, boolean>(); // table -> permissive flag of its <t>_org_boundary
    for (const p of policies) {
      if (p.polname === `${p.tbl}_org_boundary`) byTable.set(p.tbl, p.permissive);
    }

    const missingBoundary: string[] = [];
    const permissiveBoundary: string[] = [];
    for (const t of orgIdTables) {
      if (BOUNDARY_EXEMPT.has(t)) continue;
      if (!byTable.has(t)) { missingBoundary.push(t); continue; }
      if (byTable.get(t) === true) permissiveBoundary.push(t); // permissive = true is WRONG
    }

    expect(missingBoundary, `org_id tables missing <t>_org_boundary: ${missingBoundary.join(', ')}`).toEqual([]);
    expect(permissiveBoundary, `<t>_org_boundary is PERMISSIVE (must be RESTRICTIVE) on: ${permissiveBoundary.join(', ')}`).toEqual([]);
  });

  it('the exempt identity substrate (profiles) is present and RLS-enabled (self-scoped, not a tenant boundary)', async () => {
    // profiles is exempt from the boundary rule but MUST still have RLS on with its
    // own-row policies — it is not unprotected, just protected differently.
    const [rls] = await h.q<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class c
         join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname='profiles'`);
    expect(rls.relrowsecurity).toBe(true);
    const own = (await h.q<{ polname: string }>(
      `select pol.polname from pg_policy pol
         join pg_class c on c.oid=pol.polrelid
         join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname='profiles'`)).map((r) => r.polname);
    expect(own).toContain('profiles_select_own');
  });
});

// ===========================================================================
// (b) GATE present + RESTRICTIVE for every module-owned table.
// ===========================================================================
describe('§4.3(b) every module-owned table has a RESTRICTIVE <t>_module_gate', () => {
  it('each module table carries a policy named <t>_module_gate that is RESTRICTIVE', async () => {
    const gates = await h.q<{ tbl: string; polname: string; permissive: boolean }>(
      `select c.relname as tbl, pol.polname, pol.polpermissive as permissive
         from pg_policy pol
         join pg_class c on c.oid = pol.polrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname='public' and pol.polname like '%\\_module\\_gate'`,
    );
    const gateByTable = new Map<string, boolean>();
    for (const g of gates) {
      if (g.polname === `${g.tbl}_module_gate`) gateByTable.set(g.tbl, g.permissive);
    }

    const missingGate: string[] = [];
    const permissiveGate: string[] = [];
    for (const t of MODULE_TABLES) {
      if (!gateByTable.has(t)) { missingGate.push(t); continue; }
      if (gateByTable.get(t) === true) permissiveGate.push(t);
    }

    expect(missingGate, `module tables missing <t>_module_gate: ${missingGate.join(', ')}`).toEqual([]);
    expect(permissiveGate, `<t>_module_gate is PERMISSIVE (would OR into access) on: ${permissiveGate.join(', ')}`).toEqual([]);
  });

  it('NO _module_gate anywhere in the schema is PERMISSIVE (catches a mis-declared gate on ANY table)', async () => {
    const permissiveGates = await h.q<{ tbl: string; polname: string }>(
      `select c.relname as tbl, pol.polname
         from pg_policy pol
         join pg_class c on c.oid = pol.polrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname='public' and pol.polname like '%\\_module\\_gate'
          and pol.polpermissive = true`,
    );
    expect(permissiveGates.map((g) => `${g.tbl}.${g.polname}`)).toEqual([]);
  });
});

// ===========================================================================
// (c) SUBSTRATE recursion guard — no _module_gate on the entitlement substrate.
// ===========================================================================
describe('§4.3(d) the entitlement/registry substrate carries NO _module_gate (recursion guard)', () => {
  it('none of the substrate tables has a _module_gate policy', async () => {
    const rows = await h.q<{ tbl: string; polname: string }>(
      `select c.relname as tbl, pol.polname
         from pg_policy pol
         join pg_class c on c.oid = pol.polrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname='public'
          and pol.polname like '%\\_module\\_gate'
          and c.relname = ANY($1::text[])`,
      [SUBSTRATE_TABLES as unknown as string[]],
    );
    expect(rows.map((r) => `${r.tbl}.${r.polname}`)).toEqual([]);
  });
});

// ===========================================================================
// (d) AUDIT coverage — every new business table has an audit_row_change() trigger.
// ===========================================================================
describe('§4.3(e) every new business table has an audit trigger firing audit_row_change()', () => {
  it('each of the 22 business tables carries exactly one audit_row_change() trigger', async () => {
    // Resolve the actual function each audit-named trigger calls, so we prove it is
    // audit_row_change() and not some look-alike.
    const trg = await h.q<{ tbl: string; tgname: string; fn: string }>(
      `select c.relname as tbl, t.tgname, p.proname as fn
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_proc p on p.oid = t.tgfoid
        where n.nspname='public' and not t.tgisinternal
          and p.proname = 'audit_row_change'`,
    );
    const auditedTables = new Set(trg.map((r) => r.tbl));

    const missing: string[] = [];
    for (const t of BUSINESS_TABLES) {
      if (!auditedTables.has(t)) missing.push(t);
    }
    expect(missing, `business tables without an audit_row_change() trigger: ${missing.join(', ')}`).toEqual([]);

    // and no duplicate/double-fire: at most one audit_row_change() trigger per table.
    const counts = new Map<string, number>();
    for (const r of trg) counts.set(r.tbl, (counts.get(r.tbl) ?? 0) + 1);
    const doubled = BUSINESS_TABLES.filter((t) => (counts.get(t) ?? 0) > 1);
    expect(doubled, `business tables with >1 audit trigger (double-fire): ${doubled.join(', ')}`).toEqual([]);
  });

  it('the audit trigger actually WRITES to audit_logs on a real insert (real-path proof)', async () => {
    // Exercise the ACTUAL path: insert into a covered table as superuser and assert an
    // audit_logs row lands for it. engagement_stages is a module table, so we need an
    // engagement to reference; use billable_lines which is core (no module gate) and
    // simplest — but it needs a payer contact. Use config_values: covered, org-scoped,
    // trivially insertable, and proves the trigger fires for a NEW business table.
    const org = (await h.q<{ id: string }>(
      `select id from organizations order by created_at limit 1`))[0].id;
    const before = (await h.q<{ n: string }>(
      `select count(*)::text as n from audit_logs where table_name='config_values'`))[0].n;
    const [cv] = await h.q<{ id: string }>(
      `insert into config_values (org_id, namespace, key, value_text, category)
         values ($1,'BRAND','U14_AUDIT_PROBE','probe','branding') returning id`, [org]);
    const rows = await h.q<{ action: string; record_id: string; new_value: { key: string } }>(
      `select action, record_id, new_value from audit_logs
        where table_name='config_values' and record_id=$1`, [cv.id]);
    const after = (await h.q<{ n: string }>(
      `select count(*)::text as n from audit_logs where table_name='config_values'`))[0].n;
    expect(Number(after)).toBe(Number(before) + 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('INSERT');
    expect(rows[0].new_value.key).toBe('U14_AUDIT_PROBE');
  });
});

// ===========================================================================
// (e) SECOND-TENANT end-to-end isolation + module gate (§15.2).
//   Provision a boarding-tier tenant, prove it is denied brokerage, sees only its
//   own data, and renders its OWN {{ORG.*}} brand through generate_document.
// ===========================================================================
describe('second-tenant isolation + module gate end-to-end (tier.boarding)', () => {
  const SLUG = 'green-meadows'; // DISTINCT from 'rival' and 'fhe'
  let fheOrg: string;      // tenant #1 (template / brokerage-enabled)
  let superAdmin: string;  // SUPER_ADMIN in tenant #1
  let newOrg: string;      // the provisioned boarding tenant
  let newAdmin: string;    // its ADMIN
  let boardingContact: string; // a contact in the boarding tenant (for the eng)

  beforeAll(async () => {
    await h.asSuperuser();
    fheOrg = (await h.q<{ id: string }>(
      `select id from organizations order by created_at limit 1`))[0].id;
    superAdmin = await h.createAuthUser({ role: 'SUPER_ADMIN', org: fheOrg });

    // the /api-found auth user that becomes the new tenant's ADMIN
    await h.asSuperuser();
    newAdmin = (await h.q<{ id: string }>(
      `insert into auth.users (email) values ('owner@green-meadows.test') returning id`))[0].id;

    // Provision the second tenant on tier.boarding via the REAL RPC as SUPER_ADMIN.
    await h.asUser(superAdmin);
    newOrg = (await h.q<{ org: string }>(
      `select provision_tenant(
         'Green Meadows Stables', $1, 'tier.boarding', 'owner@green-meadows.test',
         $2,
         '{"BRAND.NAME":"Green Meadows","CONTACT.EMAIL":"hi@green-meadows.test"}'::jsonb,
         '{"LEGAL_NAME":"Green Meadows Stables LLC","SIGNATORY_NAME":"G. Meadow","SIGNATORY_TITLE":"Owner","ADDRESS":"7 Pasture Ln"}'::jsonb,
         '{"COMMISSION_PURCHASE_RATE":12,"SALES_TAX_RATE":6.5}'::jsonb,
         NULL
       ) as org`, [SLUG, newAdmin]))[0].org;

    // a contact in the new tenant (for a brand-rendering engagement below)
    await h.asSuperuser();
    await h.q(`select set_config('app.current_org', $1, false)`, [newOrg]);
    boardingContact = (await h.q<{ id: string }>(
      `insert into contacts (org_id, full_name, email) values ($1,'Client One','c1@green-meadows.test') returning id`,
      [newOrg]))[0].id;
  });

  it('provisioned distinctly from fhe/rival with tier.boarding entitlements', async () => {
    await h.asSuperuser();
    const [org] = await h.q<{ slug: string; status: string }>(
      `select slug, status from organizations where id=$1`, [newOrg]);
    expect(org.slug).toBe(SLUG);
    expect(['rival', 'fhe']).not.toContain(org.slug);
    expect(org.status).toBe('ACTIVE');

    const mods = (await h.q<{ module_key: string }>(
      `select module_key from org_modules where org_id=$1 and enabled order by module_key`, [newOrg]))
      .map((r) => r.module_key);
    expect(mods).toEqual(['mod.barnops', 'mod.boarding', 'mod.horserecords']);
    expect(mods).not.toContain('mod.brokerage');
  });

  it('MODULE GATE: the boarding tenant is DENIED the brokerage tables (invisible AND unwritable)', async () => {
    // As the boarding ADMIN, engagement_stages rows are gated by has_module('mod.brokerage')
    // which is FALSE — the module gate ANDs, so the table is empty AND writes are rejected.
    await h.asUser(newAdmin);

    // Seed a brokerage row as superuser bound to the boarding org, then confirm the
    // boarding ADMIN cannot SEE it (module gate hides it even for its own org).
    await h.asSuperuser();
    await h.q(`select set_config('app.current_org', $1, false)`, [newOrg]);
    // an engagement to hang the stage off (engagements is core, not gated)
    const engClientContact = (await h.q<{ id: string }>(
      `insert into contacts (org_id, full_name) values ($1,'Brokerage Ghost') returning id`, [newOrg]))[0].id;
    const clientId = (await h.q<{ id: string }>(
      `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [newOrg, engClientContact]))[0].id;
    const stype = (await h.q<{ code: string }>(`select code from service_types order by code limit 1`))[0].code;
    const engId = (await h.q<{ id: string }>(
      `insert into engagements (org_id, client_id, service_type, start_date) values ($1,$2,$3,'2026-07-01') returning id`,
      [newOrg, clientId, stype]))[0].id;
    await h.q(
      `insert into engagement_stages (org_id, engagement_id, stage, status) values ($1,$2,'SEARCH','OPEN')`,
      [newOrg, engId]);

    // module OFF ⇒ invisible to the tenant's own ADMIN
    await h.asUser(newAdmin);
    const seen = await h.q(`select id from engagement_stages`);
    expect(seen).toHaveLength(0);

    // module OFF ⇒ unwritable by the tenant's own ADMIN (WITH CHECK fails)
    await expect(
      h.q(`insert into engagement_stages (engagement_id, stage, status) values ($1,'SEARCH','OPEN')`, [engId]),
    ).rejects.toThrow();
  });

  it('RPC GATE: the boarding tenant is DENIED the brokerage engagement-creation RPCs', async () => {
    await h.asUser(newAdmin);
    // create_search_engagement / create_lease_engagement / create_purchase_engagement
    // all PERFORM require_module('mod.brokerage') → raise for a boarding-only tenant.
    await expect(
      h.q(`select create_search_engagement($1,'buyer','BUY',null)`, [boardingContact]),
    ).rejects.toThrow(/not enabled|mod\.brokerage/i);
    await expect(
      h.q(`select create_lease_engagement($1,'LEASE_IN',null,null)`, [boardingContact]),
    ).rejects.toThrow(/not enabled|mod\.brokerage/i);
    await expect(
      h.q(`select create_purchase_engagement($1,null,null,null,null)`, [boardingContact]),
    ).rejects.toThrow(/not enabled|mod\.brokerage/i);
  });

  it('TENANT ISOLATION: the boarding ADMIN sees ONLY its own tenant data, never fhe (tenant #1)', async () => {
    await h.asUser(newAdmin);
    for (const tbl of ['config_values', 'business_config', 'org_modules', 'contacts']) {
      const rows = await h.q<{ org_id: string }>(`select org_id from ${tbl}`);
      expect(rows.every((r) => r.org_id === newOrg), `${tbl} leaked a non-tenant row`).toBe(true);
      expect(rows.some((r) => r.org_id === fheOrg), `${tbl} exposed fhe (tenant #1) rows`).toBe(false);
    }
  });

  it("BRAND: generate_document renders the boarding tenant's OWN {{ORG.*}} identity, never another tenant's", async () => {
    // A tenant-owned scratch template using {{ORG.*}} tokens (bodies are global; we own
    // this one). generate_document keys config off the ENGAGEMENT's org (v_eng.org_id).
    await h.asSuperuser();
    await h.q(`select set_config('app.current_org', $1, false)`, [newOrg]);
    await h.q(
      `insert into contract_templates (template_key, title, party_namespaces, body, active)
         values ('U14_BRAND_PROBE','U14 Brand Probe', ARRAY['CLIENT','ORG'],
           'ORG=[{{ORG.LEGAL_NAME}}] SIG=[{{ORG.SIGNATORY_NAME}}] ADDR=[{{ORG.ADDRESS}}]', true)
       on conflict (template_key) do nothing`);
    const tmplId = (await h.q<{ id: string }>(
      `select id from contract_templates where template_key='U14_BRAND_PROBE'`))[0].id;
    await h.q(
      `insert into template_tokens (template_id, namespace, field, token, kind, required, party_scoped)
         values
           ($1,'ORG','LEGAL_NAME','{{ORG.LEGAL_NAME}}','field',false,false),
           ($1,'ORG','SIGNATORY_NAME','{{ORG.SIGNATORY_NAME}}','field',false,false),
           ($1,'ORG','ADDRESS','{{ORG.ADDRESS}}','field',false,false)
       on conflict do nothing`, [tmplId]);

    // an engagement in the boarding tenant
    const clientId = (await h.q<{ id: string }>(
      `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [newOrg, boardingContact]))[0].id;
    const stype = (await h.q<{ code: string }>(`select code from service_types order by code limit 1`))[0].code;
    const engId = (await h.q<{ id: string }>(
      `insert into engagements (org_id, client_id, service_type, start_date) values ($1,$2,$3,'2026-07-01') returning id`,
      [newOrg, clientId, stype]))[0].id;
    await h.q(
      `insert into engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
         values ($1,$2,$3,'CLIENT',true,1)`, [newOrg, engId, boardingContact]);

    // Real path: run the actual generate_document RPC and assert the merged body carries
    // THIS tenant's brand, and none of fhe/rival's.
    const [row] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'U14_BRAND_PROBE')`, [engId]);
    expect(row.merged_body).toContain('ORG=[Green Meadows Stables LLC]');
    expect(row.merged_body).toContain('SIG=[G. Meadow]');
    expect(row.merged_body).toContain('ADDR=[7 Pasture Ln]');
    // no other tenant's identity bleeds in, and no leftover token.
    expect(row.merged_body).not.toContain('French Heritage Equestrian'); // tenant #1's legal name
    expect(row.merged_body).not.toMatch(/\{\{ORG\./);
  });
});
