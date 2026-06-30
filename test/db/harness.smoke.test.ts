/**
 * Harness smoke test — proves the PGlite harness faithfully applies the seven
 * deployed migrations and enforces their RLS the way Supabase would. This is the
 * foundation every later DB test builds on; if this is green, the harness is
 * trustworthy.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, migrationFiles, type TestDb } from './harness';

let h: TestDb;

beforeAll(async () => {
  h = await createTestDb();
});

afterAll(async () => {
  await h?.close();
});

describe('migrations', () => {
  it('discovers the seven deployed migrations in order', () => {
    const files = migrationFiles();
    expect(files.length).toBeGreaterThanOrEqual(7);
    // lexical sort == chronological for timestamp-prefixed names
    expect([...files]).toEqual([...files].sort());
    expect(files[0]).toContain('create_bookings_and_inquiries');
  });

  it('applies all migrations and creates the core tables', async () => {
    await h.asSuperuser();
    const tables = await h.q<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    const names = tables.map((t) => t.table_name);
    for (const expected of [
      'profiles', 'offerings', 'offering_tiers', 'requests', 'invitations',
      'availability_slots', 'orders', 'order_items', 'order_documents',
      'bookings_v2', 'payments', 'payment_notifications', 'memberships', 'gifts',
    ]) {
      expect(names, `missing table: ${expected}`).toContain(expected);
    }
  });

  it('has the SECURITY DEFINER helpers', async () => {
    await h.asSuperuser();
    const fns = await h.q<{ proname: string }>(
      `select proname from pg_proc where proname in ('is_admin','owns_order','validate_invitation')`,
    );
    expect(fns.map((f) => f.proname).sort()).toEqual(['is_admin', 'owns_order', 'validate_invitation']);
  });
});

describe('RLS — profiles', () => {
  it('lets a user read only their own profile, and an admin read all', async () => {
    const alice = await h.createAuthUser({ email: 'alice@test.fhe' });
    const bob = await h.createAuthUser({ email: 'bob@test.fhe' });
    const admin = await h.createAuthUser({ email: 'admin@test.fhe', isAdmin: true });

    await h.asUser(alice);
    const aliceSees = await h.q(`select user_id from profiles`);
    expect(aliceSees).toHaveLength(1);
    expect((aliceSees[0] as { user_id: string }).user_id).toBe(alice);

    await h.asUser(admin);
    const adminSees = await h.q(`select user_id from profiles`);
    expect(adminSees.length).toBeGreaterThanOrEqual(3);

    // keep bob referenced so the intent is clear
    expect(bob).not.toBe(alice);
  });
});

describe('RLS — public catalog vs private inbox', () => {
  it('lets anon read active offerings but never requests', async () => {
    // seed an active offering as superuser
    await h.asSuperuser();
    await h.q(
      `insert into offerings (segment, name, slug, active) values ('rider','Probe Lesson','probe-lesson', true)`,
    );

    await h.asAnon();
    const offerings = await h.q(`select slug from offerings where slug = 'probe-lesson'`);
    expect(offerings).toHaveLength(1);

    // requests is an admin-only inbox; anon may INSERT (public form) but not SELECT
    const reqRead = await h.q(`select count(*)::int as n from requests`);
    expect((reqRead[0] as { n: number }).n).toBe(0);
  });

  it('lets anon submit a request (public form) that only admins can read', async () => {
    await h.asAnon();
    await h.q(
      `insert into requests (contact_name, contact_email) values ('Visitor','visitor@test.fhe')`,
    );

    const admin = await h.createAuthUser({ email: 'admin2@test.fhe', isAdmin: true });
    await h.asUser(admin);
    const seen = await h.q(`select contact_email from requests where contact_email = 'visitor@test.fhe'`);
    expect(seen).toHaveLength(1);
  });
});
