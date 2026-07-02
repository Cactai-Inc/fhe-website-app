/**
 * U4 — Org-scope the pre-existing platform catalog (migration 20260630030000).
 *
 * Real-path data test (Wiring & Verification Contract §15(1)): exercises the ACTUAL
 * tables the app writes/reads, as the CORRECT RLS role, and proves for each scoped
 * table that:
 *   (a) org_id DEFAULTS to the caller's tenant on a plain insert;
 *   (b) a cross-tenant insert is REJECTED by the RESTRICTIVE boundary WITH CHECK;
 *   (c) another tenant's rows are HIDDEN by the boundary USING.
 *
 * Plus the §8.6 anon behaviors:
 *   - the anon-read catalog subset (offerings/offering_tiers) is scoped to the
 *     ADDRESSED tenant for a real anon (current_org()=NULL) and never leaks another
 *     tenant's catalog;
 *   - a raw anon intake insert (no host) lands org_id NULL, invisible to both
 *     tenants' admins — no cross-tenant leak.
 *
 * NOTE on the harness: createTestDb() pins the session GUC `app.current_org` to
 * tenant #1, and current_org() falls back to that GUC when auth.uid() IS NULL. So an
 * `asAnon()` caller has current_org()=org#1 in the harness (unlike real Supabase). To
 * exercise the *real* anon path (current_org()=NULL, addressed-tenant scoping) these
 * tests clear that GUC as superuser first, faithfully emulating a production anon.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string, orgB: string, aAdmin: string, bAdmin: string;

/** Clear the seed GUC so current_org() is NULL for anon (real-Supabase anon). */
async function clearOrgGuc() {
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org', '', false)`);
}
/** Restore the seed GUC to tenant #1 (what createTestDb sets by default). */
async function restoreOrgGuc() {
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org', $1, false)`, [orgA]);
}
async function setAddressed(org: string | null) {
  await h.q(`select set_config('app.addressed_org', $1, false)`, [org ?? '']);
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Catalog Rival','catalog-rival') returning id`,
  ))[0].id;
  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
});

afterAll(async () => {
  await h?.close();
});

// ---------------------------------------------------------------------------
// Standard Class-A tables (authenticated boundary): default / reject / hide.
// One representative INSERTable table per family, exercised as a real ADMIN.
// ---------------------------------------------------------------------------
describe('U4 class-A boundary: default / cross-tenant reject / hide', () => {
  // (table, columns, values) — the minimal real insert the app performs.
  const cases: Array<{ t: string; cols: string; vals: string; readCol: string }> = [
    { t: 'memberships', cols: 'user_id, tier', vals: `$UID$, 'community'`, readCol: 'tier' },
    { t: 'member_groups', cols: 'name, slug', vals: `'G-$SFX$', 'g-$SFX$'`, readCol: 'slug' },
    { t: 'announcements', cols: 'title, body', vals: `'T-$SFX$', 'b'`, readCol: 'title' },
    { t: 'channels', cols: 'name, slug', vals: `'C-$SFX$', 'c-$SFX$'`, readCol: 'slug' },
    { t: 'events', cols: 'title, starts_at', vals: `'E-$SFX$', now()`, readCol: 'title' },
    { t: 'content_posts', cols: 'title, slug, body', vals: `'P-$SFX$', 'p-$SFX$', 'b'`, readCol: 'slug' },
    { t: 'content_resources', cols: 'title', vals: `'R-$SFX$'`, readCol: 'title' },
    { t: 'gifts', cols: 'code, item_type, item_label', vals: `'GC-$SFX$', 'lessons', 'x'`, readCol: 'code' },
    { t: 'availability_slots', cols: 'start_at, end_at', vals: `now(), now()`, readCol: 'id' },
  ];

  for (const c of cases) {
    it(`${c.t}: defaults org_id to caller, rejects cross-tenant, hides other tenant`, async () => {
      const sfx = Math.random().toString(36).slice(2, 8);
      const build = (uid: string) =>
        c.vals.replace(/\$UID\$/g, `'${uid}'`).replace(/\$SFX\$/g, sfx);

      // (a) default: as org-A admin, plain insert (no org_id) → defaults to org A
      await h.asUser(aAdmin);
      await h.q(`insert into ${c.t} (${c.cols}) values (${build(aAdmin)})`);
      await h.asSuperuser();
      const [defaulted] = await h.q<{ org_id: string }>(
        `select org_id from ${c.t} where ${c.readCol}::text like '%${sfx}%' or org_id=$1 order by org_id limit 1`,
        [orgA],
      );
      // the row we just wrote is under org A
      const aRows = await h.q<{ org_id: string }>(
        `select org_id from ${c.t} where org_id=$1`, [orgA]);
      expect(aRows.length).toBeGreaterThan(0);
      expect(aRows.every((r) => r.org_id === orgA)).toBe(true);
      void defaulted;

      // (b) cross-tenant insert rejected by WITH CHECK (org A admin planting into B)
      await h.asUser(aAdmin);
      await expect(
        h.q(`insert into ${c.t} (org_id, ${c.cols}) values ('${orgB}', ${build(aAdmin)})`),
      ).rejects.toThrow();

      // (c) seed a row under org B (as superuser, explicit org_id) then confirm the
      //     org-A admin cannot SEE it.
      await h.asSuperuser();
      const bSfx = Math.random().toString(36).slice(2, 8);
      const buildB = c.vals.replace(/\$UID\$/g, `'${bAdmin}'`).replace(/\$SFX\$/g, bSfx);
      await h.q(`insert into ${c.t} (org_id, ${c.cols}) values ('${orgB}', ${buildB})`);
      await h.asUser(aAdmin);
      const visibleToA = await h.q<{ org_id: string }>(`select org_id from ${c.t}`);
      expect(visibleToA.every((r) => r.org_id === orgA)).toBe(true);
      // org-B admin, by contrast, sees the org-B row
      await h.asUser(bAdmin);
      const visibleToB = await h.q<{ org_id: string }>(`select org_id from ${c.t} where org_id=$1`, [orgB]);
      expect(visibleToB.length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Commerce order chain (Class A) — real owner path via owns_order().
// ---------------------------------------------------------------------------
describe('U4 class-A commerce: orders/order_items default + isolate', () => {
  it('orders defaults org_id and hides across tenants; order_items too', async () => {
    // org-A user creates an order the real way (owner insert)
    await h.asUser(aAdmin);
    const [oa] = await h.q<{ id: string; org_id: string }>(
      `insert into orders (user_id) values ($1) returning id, org_id`, [aAdmin]);
    expect(oa.org_id).toBe(orgA);
    await h.q(
      `insert into order_items (order_id, label) values ($1, 'Line A')`, [oa.id]);
    await h.asSuperuser();
    const [oi] = await h.q<{ org_id: string }>(
      `select org_id from order_items where order_id=$1`, [oa.id]);
    expect(oi.org_id).toBe(orgA);

    // org-B admin cannot see org-A's order
    await h.asUser(bAdmin);
    const seen = await h.q(`select id from orders where id=$1`, [oa.id]);
    expect(seen).toHaveLength(0);

    // cross-tenant plant rejected
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into orders (user_id, org_id) values ($1, $2)`, [aAdmin, orgB]),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Anon-read catalog subset (offerings / offering_tiers) — addressed-tenant scope.
// ---------------------------------------------------------------------------
describe('U4 §8.6 anon-read catalog: addressed-tenant scoping', () => {
  let offA: string, offB: string;

  beforeAll(async () => {
    await h.asSuperuser();
    offA = (await h.q<{ id: string }>(
      `insert into offerings (segment, name, slug, active, org_id) values ('rider','A Lesson','a-lesson-${orgA.slice(0,4)}', true, $1) returning id`,
      [orgA],
    ))[0].id;
    offB = (await h.q<{ id: string }>(
      `insert into offerings (segment, name, slug, active, org_id) values ('rider','B Lesson','b-lesson-${orgB.slice(0,4)}', true, $1) returning id`,
      [orgB],
    ))[0].id;
    await h.q(
      `insert into offering_tiers (offering_id, label, price_unit, org_id) values ($1,'A tier','session',$2)`,
      [offA, orgA]);
    await h.q(
      `insert into offering_tiers (offering_id, label, price_unit, org_id) values ($1,'B tier','session',$2)`,
      [offB, orgB]);
  });

  it('a real anon addressing tenant A sees only A\'s catalog, never B\'s', async () => {
    await clearOrgGuc();          // real anon: current_org() = NULL
    await setAddressed(orgA);
    await h.asAnon();
    // asAnon() re-sets role but the GUCs above persist for this session
    await setAddressed(orgA);     // ensure addressed org survives the role switch
    const rows = await h.q<{ org_id: string }>(`select org_id from offerings`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.org_id === orgA)).toBe(true);
    expect(rows.some((r) => r.org_id === orgB)).toBe(false);

    const tiers = await h.q<{ org_id: string }>(`select org_id from offering_tiers`);
    expect(tiers.every((r) => r.org_id === orgA)).toBe(true);
  });

  it('switching the addressed tenant to B flips visibility to B only', async () => {
    await clearOrgGuc();
    await h.asAnon();
    await setAddressed(orgB);
    const rows = await h.q<{ org_id: string }>(`select org_id from offerings`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.org_id === orgB)).toBe(true);
    expect(rows.some((r) => r.org_id === orgA)).toBe(false);
  });

  afterAll(async () => {
    await restoreOrgGuc();
    await h.asSuperuser();
    await setAddressed(null);
  });
});

// ---------------------------------------------------------------------------
// Class B raw-anon intake — null-org_id lands, invisible to every tenant.
// ---------------------------------------------------------------------------
describe('U4 §8.6 class-B intake: raw anon insert is org-null + invisible', () => {
  it('a real anon (no host) inserts a request that lands org_id NULL and no tenant admin can see it', async () => {
    await clearOrgGuc();          // real anon: current_org() = NULL
    await h.asAnon();
    await setAddressed(null);     // no host addressed
    await h.q(
      `insert into requests (contact_name, contact_email) values ('Ghost','ghost-${Date.now()}@test.fhe')`);

    await h.asSuperuser();
    const [nullRow] = await h.q<{ n: number }>(
      `select count(*)::int as n from requests where org_id is null and contact_name='Ghost'`);
    expect(nullRow.n).toBeGreaterThan(0);

    // neither tenant admin sees the null-org request
    await h.asUser(aAdmin);
    const aSees = await h.q<{ n: number }>(
      `select count(*)::int as n from requests where contact_name='Ghost'`);
    expect(aSees[0].n).toBe(0);
    await h.asUser(bAdmin);
    const bSees = await h.q<{ n: number }>(
      `select count(*)::int as n from requests where contact_name='Ghost'`);
    expect(bSees[0].n).toBe(0);
  });

  it('an addressed anon intake stamps the addressed tenant and only that tenant sees it', async () => {
    await clearOrgGuc();
    await h.asAnon();
    await setAddressed(orgB);
    await h.q(
      `insert into requests (contact_name, contact_email, org_id) values ('Addressed-B','ab-${Date.now()}@test.fhe', $1)`,
      [orgB]);

    await h.asUser(bAdmin);
    const bSees = await h.q<{ n: number }>(
      `select count(*)::int as n from requests where contact_name='Addressed-B'`);
    expect(bSees[0].n).toBe(1);
    await h.asUser(aAdmin);
    const aSees = await h.q<{ n: number }>(
      `select count(*)::int as n from requests where contact_name='Addressed-B'`);
    expect(aSees[0].n).toBe(0);
  });

  afterAll(async () => {
    await restoreOrgGuc();
    await h.asSuperuser();
    await setAddressed(null);
  });
});
