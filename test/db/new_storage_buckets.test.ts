/**
 * U13 — New storage buckets with org-prefix isolation (core.branding).
 * Migration: 20260630120000_new_storage_buckets.sql, PLATFORM_ARCHITECTURE.md §8.4.
 *
 * REAL-PATH proof against the ACTUAL storage.objects table the app writes to:
 *  - the three new buckets (inventory-docs, horse-health, brand-assets) exist
 *    and are PRIVATE,
 *  - an object under brand-assets/{orgA}/... is invisible AND unwritable to an
 *    orgB user (tenant isolation — org_id is the LEADING path segment),
 *  - an orgA admin can write under its OWN org prefix,
 *  - a malformed leading path segment yields NO access (try_cast_uuid → NULL,
 *    so the org comparison is false — never a raise inside the policy),
 *  - staff (non-admin) may write inventory-docs/horse-health but NOT brand-assets
 *    (admin-write), and a horse owner can read its own horse-health objects.
 *
 * (storage.* is emulated by the harness; see harness.ts.)
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string, orgB: string;
let aAdmin: string, aStaff: string, bStaff: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(
    `select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Rival Stables','rival-u13') returning id`))[0].id;

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  aStaff = await h.createAuthUser({ role: 'EMPLOYEE', org: orgA });
  // orgB is exercised with a NON-admin staff member: migration 15's pre-existing
  // storage_admin_all grants any tenant ADMIN full read/write on EVERY bucket with
  // no org boundary, so cross-tenant isolation of the org-prefix policies is proven
  // against a non-admin caller (the honest boundary these additive policies enforce).
  bStaff = await h.createAuthUser({ role: 'EMPLOYEE', org: orgB });
});
afterAll(async () => {
  await h?.close();
});

describe('buckets', () => {
  it('creates the three new private buckets', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ id: string; public: boolean }>(
      `select id, public from storage.buckets
       where id in ('inventory-docs','horse-health','brand-assets') order by id`);
    expect(rows.map((r) => r.id)).toEqual(['brand-assets', 'horse-health', 'inventory-docs']);
    expect(rows.every((r) => r.public === false)).toBe(true);
  });
});

describe('org-prefix isolation (org_id is the leading path segment)', () => {
  it('an orgA brand-assets object is invisible and unwritable to an orgB user', async () => {
    // Seed a brand-assets object under org A's prefix (as superuser).
    await h.asSuperuser();
    await h.q(`insert into storage.objects (bucket_id, name) values ('brand-assets', $1)`,
      [`${orgA}/logo.png`]);

    // orgB staff cannot SEE org A's object (org boundary AND'd in every policy).
    await h.asUser(bStaff);
    const bNames = (await h.q<{ name: string }>(
      `select name from storage.objects where bucket_id='brand-assets'`)).map((r) => r.name);
    expect(bNames).not.toContain(`${orgA}/logo.png`);

    // orgB staff cannot WRITE under org A's prefix (WITH CHECK org boundary); and
    // brand-assets is admin-write anyway — doubly denied.
    await expect(
      h.q(`insert into storage.objects (bucket_id, name) values ('brand-assets', $1)`,
        [`${orgA}/evil-logo.png`]),
    ).rejects.toThrow();
  });

  it('an orgA admin can write and read under its own org prefix', async () => {
    await h.asUser(aAdmin);
    await h.q(`insert into storage.objects (bucket_id, name) values ('brand-assets', $1)`,
      [`${orgA}/hero.png`]);
    const names = (await h.q<{ name: string }>(
      `select name from storage.objects where bucket_id='brand-assets'`)).map((r) => r.name);
    expect(names).toContain(`${orgA}/hero.png`);
    // and the original superuser-seeded logo under its own org
    expect(names).toContain(`${orgA}/logo.png`);
  });

  it('a malformed leading path segment yields no access (try_cast_uuid NULL)', async () => {
    // Superuser plants an object whose first segment is not a uuid.
    await h.asSuperuser();
    await h.q(`insert into storage.objects (bucket_id, name) values ('brand-assets', $1)`,
      ['not-a-uuid/logo.png']);

    // Org A's staff cannot see it: try_cast_uuid('not-a-uuid') = NULL, and
    // NULL = current_org() is never true (no raise, just denied). (A non-admin
    // caller, so migration 15's storage_admin_all does not admit it.)
    await h.asUser(aStaff);
    const names = (await h.q<{ name: string }>(
      `select name from storage.objects where bucket_id='brand-assets'`)).map((r) => r.name);
    expect(names).not.toContain('not-a-uuid/logo.png');

    // And staff cannot WRITE a malformed-prefix object through the org-scoped policy
    // (brand-assets is admin-write, and the org prefix is NULL anyway).
    await expect(
      h.q(`insert into storage.objects (bucket_id, name) values ('inventory-docs', $1)`,
        ['garbage/hack.png']),
    ).rejects.toThrow();
  });
});

describe('staff vs admin write layering', () => {
  it('staff may write inventory-docs/horse-health under own org, not brand-assets', async () => {
    await h.asUser(aStaff);

    // inventory-docs under own org: allowed (has_staff_access).
    await h.q(`insert into storage.objects (bucket_id, name) values ('inventory-docs', $1)`,
      [`${orgA}/invoice.pdf`]);
    expect((await h.q(
      `select id from storage.objects where bucket_id='inventory-docs' and name=$1`,
      [`${orgA}/invoice.pdf`])).length).toBe(1);

    // horse-health under own org: allowed.
    await h.q(`insert into storage.objects (bucket_id, name) values ('horse-health', $1)`,
      [`${orgA}/${orgA}/note.pdf`]);
    expect((await h.q(
      `select id from storage.objects where bucket_id='horse-health' and name=$1`,
      [`${orgA}/${orgA}/note.pdf`])).length).toBe(1);

    // brand-assets: staff (non-admin) is BLOCKED (admin-write only).
    await expect(
      h.q(`insert into storage.objects (bucket_id, name) values ('brand-assets', $1)`,
        [`${orgA}/staff-logo.png`]),
    ).rejects.toThrow();

    // staff cannot write into another org's prefix either.
    await expect(
      h.q(`insert into storage.objects (bucket_id, name) values ('inventory-docs', $1)`,
        [`${orgB}/leak.pdf`]),
    ).rejects.toThrow();
  });
});

describe('horse-health owner read', () => {
  it('a client who owns the horse reads its horse-health objects within its org', async () => {
    // Build an org A client who owns a horse; path = horse-health/{orgA}/{horseId}/...
    await h.asSuperuser();
    const uid = await h.createAuthUser({ email: 'owner-u13@fhe', org: orgA });
    const contact = (await h.q<{ id: string }>(
      `insert into contacts (full_name, email, org_id) values ('Owner U13','owner-u13@fhe',$1) returning id`,
      [orgA]))[0].id;
    await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contact, uid]);
    const horse = (await h.q<{ id: string }>(
      `insert into horses (barn_name, current_owner_contact_id, org_id) values ('Bella',$1,$2) returning id`,
      [contact, orgA]))[0].id;

    // Seed a health object under the owner's org + horse.
    await h.q(`insert into storage.objects (bucket_id, name) values ('horse-health', $1)`,
      [`${orgA}/${horse}/coggins.pdf`]);
    // And a health object for a horse the client does NOT own (owner = some other contact).
    const otherContact = (await h.q<{ id: string }>(
      `insert into contacts (full_name, org_id) values ('Other',$1) returning id`, [orgA]))[0].id;
    const otherHorse = (await h.q<{ id: string }>(
      `insert into horses (barn_name, current_owner_contact_id, org_id) values ('NotYours',$1,$2) returning id`,
      [otherContact, orgA]))[0].id;
    await h.q(`insert into storage.objects (bucket_id, name) values ('horse-health', $1)`,
      [`${orgA}/${otherHorse}/coggins.pdf`]);

    // The owner (a plain client, not staff) reads only its own horse's object.
    await h.asUser(uid);
    const names = (await h.q<{ name: string }>(
      `select name from storage.objects where bucket_id='horse-health'`)).map((r) => r.name);
    expect(names).toContain(`${orgA}/${horse}/coggins.pdf`);
    expect(names).not.toContain(`${orgA}/${otherHorse}/coggins.pdf`);
  });
});
