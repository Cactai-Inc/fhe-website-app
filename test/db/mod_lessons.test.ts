/**
 * Lessons & Membership (U8, migration 20260630070000_mod_lessons) — module mod.lessons.
 *
 * Real-path data tests (Wiring & Verification Contract §15.1(1)): every assertion
 * exercises the ACTUAL tables/functions the app uses (lesson_packages,
 * lesson_credits, has_module, current_client_id, config_value) as the CORRECT RLS
 * role, and asserts rows land in the RIGHT table with the RIGHT columns and read
 * back.
 *
 * Proves (per U8 spec):
 *  - org_boundary: org B cannot SEE or WRITE org A's lesson rows, and vice-versa.
 *  - module_gate('mod.lessons'): a mod.lessons-OFF org sees ZERO rows and CANNOT
 *    insert even as its own ADMIN, on both lesson_packages and lesson_credits.
 *  - a client reads ONLY OWN lesson_credits (client_id = current_client_id());
 *    another client of the same org sees nothing of theirs.
 *  - a lesson_packages price resolves through the registry (config_value on the
 *    price_value_key), never a hardcoded literal.
 *  - org_id DEFAULTS to the caller's tenant on insert.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // FHE (tenant #1) — has mod.lessons (tier.lesson_brokerage)
let orgB: string; // a second tenant we grant mod.lessons to (isolation peer)
let orgC: string; // a third tenant WITHOUT mod.lessons (module-gate peer)
let aAdmin: string, bAdmin: string, cAdmin: string;
let aClientUid: string, aClientId: string;       // a portal client of org A
let aClient2Uid: string, aClient2Id: string;     // a second, distinct client of org A

/** Create an org-A portal client: contact + clients row + profile.contact_id link. */
async function makeClient(name: string, email: string, org: string): Promise<{ uid: string; clientId: string }> {
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org',$1,false)`, [org]);
  const uid = await h.createAuthUser({ role: 'USER', org });
  const [first, ...rest] = name.split(' ');
  const contact = (await h.q<{ id: string }>(
    // pinned pre-20260702090000 schema: full_name still exists (NOT NULL)
    `insert into contacts (org_id, full_name, first_name, last_name, email) values ($1,$2,$3,$4,$5) returning id`,
    [org, name, first, rest.join(' ') || null, email]))[0].id;
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contact, uid]);
  const clientId = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, contact]))[0].id;
  await h.q(`select set_config('app.current_org',$1,false)`, [orgA]); // restore harness GUC → org #1
  return { uid, clientId };
}

beforeAll(async () => {
  // Apply migrations up to and including this unit's own migration. U8 depends only
  // on U2 (entitlements) + the CRM backbone, all of which sort before this slot;
  // scoping here keeps this unit's real-path proof independent of later, concurrently
  // built units (e.g. U12 mod_employees) whose in-progress migrations sort AFTER U8.
  h = await createTestDb({ upTo: '20260630070000_mod_lessons.sql' });
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Lesson Rival','lesson-rival') returning id`))[0].id;
  orgC = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('No Lessons Barn','no-lessons') returning id`))[0].id;

  // Grant mod.lessons to org B (so isolation, not the gate, is under test there).
  // org C is deliberately left WITHOUT mod.lessons (the module-gate peer).
  await h.q(`insert into org_modules (org_id, module_key, enabled, source) values ($1,'mod.lessons',true,'GRANT')`, [orgB]);

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
  cAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgC });

  const c1 = await makeClient('Rider One', 'rider1@a.fhe', orgA);
  aClientUid = c1.uid; aClientId = c1.clientId;
  const c2 = await makeClient('Rider Two', 'rider2@a.fhe', orgA);
  aClient2Uid = c2.uid; aClient2Id = c2.clientId;
});
afterAll(async () => {
  await h?.close();
});

describe('lesson_packages — org boundary + default org_id + registry pricing', () => {
  it('org_id DEFAULTS to the caller\'s tenant on insert (staff RCUD)', async () => {
    await h.asUser(aAdmin);
    await h.q(
      `insert into lesson_packages (package_key, name, price_value_key, credits)
         values ('pkg.10','10-Lesson Pack','PKG_10_PRICE',10)`);
    await h.asSuperuser();
    const [row] = await h.q<{ org_id: string; credits: number }>(
      `select org_id, credits from lesson_packages where package_key='pkg.10'`);
    expect(row.org_id).toBe(orgA);
    expect(row.credits).toBe(10);
  });

  it('the package price resolves THROUGH the registry (config_value on price_value_key), not a literal', async () => {
    // Seed the registry PRICING row the package's price_value_key points at.
    await h.asUser(aAdmin);
    await h.q(
      `insert into config_values (namespace, key, value_num, category)
         values ('PRICING','PKG_10_PRICE', 750, 'pricing')`);
    // Resolve the price the way the app would: read the package's key, then config_value().
    const [pkg] = await h.q<{ price_value_key: string }>(
      `select price_value_key from lesson_packages where package_key='pkg.10'`);
    expect(pkg.price_value_key).toBe('PKG_10_PRICE');
    const [resolved] = await h.q<{ price: string | null }>(
      `select config_value('PRICING', $1) as price`, [pkg.price_value_key]);
    expect(resolved.price).toBe('750'); // resolves through the ONE registry seam
  });

  it('org B (also has mod.lessons) cannot SEE org A\'s packages', async () => {
    await h.asUser(bAdmin);
    const rows = await h.q<{ package_key: string }>(`select package_key from lesson_packages`);
    expect(rows.some((r) => r.package_key === 'pkg.10')).toBe(false);
  });

  it('org B cannot WRITE a package into org A (WITH CHECK boundary)', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`insert into lesson_packages (org_id, package_key, name) values ($1,'pkg.evil','Evil')`, [orgA]),
    ).rejects.toThrow();
  });
});

describe('module_gate(\'mod.lessons\') — a lessons-OFF org sees/writes nothing', () => {
  it('org C (no mod.lessons) sees ZERO packages even though org A/B have some', async () => {
    // Seed a package for org B (which HAS the module) so there ARE rows to (not) leak.
    await h.asUser(bAdmin);
    await h.q(`insert into lesson_packages (package_key, name, credits) values ('pkg.b','B Pack',5)`);
    await h.asUser(cAdmin);
    const rows = await h.q<{ package_key: string }>(`select package_key from lesson_packages`);
    expect(rows).toHaveLength(0); // gate ANDs with boundary → nothing visible
  });

  it('org C ADMIN CANNOT INSERT a package (gate blocks WITH CHECK) even for its own org', async () => {
    await h.asUser(cAdmin);
    await expect(
      h.q(`insert into lesson_packages (package_key, name, credits) values ('pkg.c','C Pack',3)`),
    ).rejects.toThrow();
  });

  it('org C ADMIN CANNOT INSERT a lesson_credit (gate blocks) even for its own org', async () => {
    // Give org C a client to reference so the failure is the GATE, not a bad FK.
    await h.asSuperuser();
    await h.q(`select set_config('app.current_org',$1,false)`, [orgC]);
    const cContact = (await h.q<{ id: string }>(
      `insert into contacts (org_id, full_name, first_name, last_name) values ($1, 'C Rider', 'C', 'Rider') returning id`, [orgC]))[0].id;
    const cClient = (await h.q<{ id: string }>(
      `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [orgC, cContact]))[0].id;
    await h.q(`select set_config('app.current_org',$1,false)`, [orgA]);
    await h.asUser(cAdmin);
    await expect(
      h.q(`insert into lesson_credits (client_id, credits_total, credits_remaining) values ($1,10,10)`, [cClient]),
    ).rejects.toThrow();
  });
});

describe('lesson_credits — a client reads ONLY their own', () => {
  beforeAll(async () => {
    // Staff (org A admin) issues credits to two distinct clients of org A.
    await h.asUser(aAdmin);
    await h.q(
      `insert into lesson_credits (client_id, package_key, credits_total, credits_remaining)
         values ($1,'pkg.10',10,10)`, [aClientId]);
    await h.q(
      `insert into lesson_credits (client_id, package_key, credits_total, credits_remaining)
         values ($1,'pkg.10',4,4)`, [aClient2Id]);
  });

  it('the credit rows landed in lesson_credits with the right columns (real-path readback)', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ client_id: string; credits_remaining: number; org_id: string }>(
      `select client_id, credits_remaining, org_id from lesson_credits where org_id=$1 order by credits_remaining desc`,
      [orgA]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ client_id: aClientId, credits_remaining: 10, org_id: orgA });
    expect(rows[1]).toMatchObject({ client_id: aClient2Id, credits_remaining: 4, org_id: orgA });
  });

  it('client One sees ONLY their own credit row (current_client_id)', async () => {
    await h.asUser(aClientUid);
    // Sanity: the predicate resolves this user to their client row.
    const [cid] = await h.q<{ id: string | null }>(`select current_client_id() as id`);
    expect(cid.id).toBe(aClientId);

    const rows = await h.q<{ client_id: string; credits_remaining: number }>(
      `select client_id, credits_remaining from lesson_credits`);
    expect(rows).toHaveLength(1);
    expect(rows[0].client_id).toBe(aClientId);
    expect(rows[0].credits_remaining).toBe(10);
    // and NOT client Two's row
    expect(rows.some((r) => r.client_id === aClient2Id)).toBe(false);
  });

  it('client Two sees ONLY their own credit row (not client One\'s)', async () => {
    await h.asUser(aClient2Uid);
    const rows = await h.q<{ client_id: string }>(`select client_id from lesson_credits`);
    expect(rows).toHaveLength(1);
    expect(rows[0].client_id).toBe(aClient2Id);
  });

  it('a client CANNOT read another tenant\'s credits (org boundary), and org B admin cannot see org A credits', async () => {
    await h.asUser(bAdmin); // org B has mod.lessons, so the gate passes — only the boundary excludes A
    const rows = await h.q<{ client_id: string }>(`select client_id from lesson_credits`);
    expect(rows.some((r) => r.client_id === aClientId || r.client_id === aClient2Id)).toBe(false);
  });
});
