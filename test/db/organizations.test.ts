/**
 * Multi-tenant foundation — organizations + membership (migration 24).
 *
 * The tenancy primitives: a seeded tenant #1, profiles joined to it, and
 * current_org() resolving the caller's tenant. (Per-table org scoping follows.)
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
});
afterAll(async () => {
  await h?.close();
});

describe('organizations foundation', () => {
  it('seeds tenant #1 with an ORG- code', async () => {
    const orgs = await h.q<{ name: string; slug: string; display_code: string; status: string }>(
      `select name, slug, display_code, status from organizations`);
    expect(orgs).toHaveLength(1);
    expect(orgs[0].slug).toBe('fhe');
    expect(orgs[0].display_code).toMatch(/^ORG-/);
    expect(orgs[0].status).toBe('ACTIVE');
  });

  it('joins a new profile to a tenant and resolves it via current_org()', async () => {
    const uid = await h.createAuthUser({ email: 'owner@org.test', isAdmin: true });
    const orgId = (await h.q<{ id: string }>(`select id from organizations limit 1`))[0].id;
    await h.q(`update profiles set org_id=$1 where user_id=$2`, [orgId, uid]);

    await h.asUser(uid);
    const got = (await h.q<{ current_org: string }>(`select current_org()`))[0].current_org;
    expect(got).toBe(orgId);
  });

  it('a member sees their org; an outsider with no membership sees none', async () => {
    const orgId = (await h.q<{ id: string }>(`select id from organizations limit 1`))[0].id;

    const member = await h.createAuthUser({ email: 'member@org.test' });
    await h.q(`update profiles set org_id=$1 where user_id=$2`, [orgId, member]);
    await h.asUser(member);
    expect(await h.q(`select id from organizations`)).toHaveLength(1);

    const outsider = await h.createAuthUser({ email: 'outsider@org.test', org: null }); // no membership
    await h.asUser(outsider);
    expect(await h.q(`select id from organizations`)).toHaveLength(0);
  });
});
