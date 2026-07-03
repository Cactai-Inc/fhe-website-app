/**
 * Tenant isolation (migration 26). A user in org A cannot see org B's data;
 * the org_id boundary policy ANDs with the existing access policies.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string, orgB: string, aStaff: string, bStaff: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(`insert into organizations (name, slug) values ('Rival Stables','rival') returning id`))[0].id;
  // a contact in each tenant (seed as superuser with explicit org_id)
  await h.q(`insert into contacts (first_name, last_name, org_id) values ('A', 'Contact', $1)`, [orgA]);
  await h.q(`insert into contacts (first_name, last_name, org_id) values ('B', 'Contact', $1)`, [orgB]);
  aStaff = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bStaff = await h.createAuthUser({ role: 'ADMIN', org: orgB });
});
afterAll(async () => {
  await h?.close();
});

describe('tenant isolation', () => {
  it('each tenant sees its own contacts and not the other’s', async () => {
    await h.asUser(aStaff);
    const a = (await h.q<{ name: string }>(
      `select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) as name from contacts`)).map((r) => r.name);
    expect(a).toContain('A Contact');
    expect(a).not.toContain('B Contact');

    await h.asUser(bStaff);
    const b = (await h.q<{ name: string }>(
      `select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) as name from contacts`)).map((r) => r.name);
    expect(b).toContain('B Contact');
    expect(b).not.toContain('A Contact');
  });

  it('a tenant cannot write a row into another tenant', async () => {
    await h.asUser(aStaff);
    // WITH CHECK (org_id = current_org()) blocks planting a row in org B
    await expect(h.q(`insert into contacts (first_name, org_id) values ('X', $1)`, [orgB]))
      .rejects.toThrow();
  });

  it('inserts default org_id to the caller’s tenant', async () => {
    await h.asUser(aStaff);
    await h.q(`insert into contacts (first_name) values ('Defaulted')`); // no org_id given
    await h.asSuperuser();
    const [row] = await h.q<{ org_id: string }>(`select org_id from contacts where first_name='Defaulted'`);
    expect(row.org_id).toBe(orgA);
  });
});
