/**
 * Category 1 — Schema: storage buckets & policies (migration 015), §6.
 *
 * Proves path-prefix storage security:
 *  - the eight private buckets exist,
 *  - a client reads objects under engagements/horses they own, and their own
 *    profile/temp folder, but never a stranger's,
 *  - a client may upload to their own profile-images path, not someone else's,
 *    and not into the contracts bucket,
 *  - admin sees everything, anon nothing.
 *
 * (storage.* is emulated by the harness; see harness.ts.)
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;

beforeAll(async () => {
  h = await createTestDb();
});
afterAll(async () => {
  await h?.close();
});

// A client who owns engagement E and horse H (by ownership), returns ids + uid.
async function makeClientWithAssets(email: string) {
  await h.asSuperuser();
  const uid = await h.createAuthUser({ email });
  const contact = (await h.q<{ id: string }>(
    `insert into contacts (full_name, email) values ($1,$2) returning id`, [email, email]))[0].id;
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contact, uid]);
  const client = (await h.q<{ id: string }>(
    `insert into clients (contact_id) values ($1) returning id`, [contact]))[0].id;
  const eng = (await h.q<{ id: string }>(
    `insert into engagements (client_id, service_type) values ($1,'HORSE_PURCHASE_ASSISTANCE') returning id`,
    [client]))[0].id;
  const horse = (await h.q<{ id: string }>(
    `insert into horses (barn_name, current_owner_contact_id) values ('Asset',$1) returning id`, [contact]))[0].id;
  return { uid, contact, client, eng, horse };
}

describe('buckets', () => {
  it('creates the eight private buckets', async () => {
    await h.asSuperuser();
    // Scoped to migration 15's eight launch buckets: later additive migrations
    // (e.g. U13's inventory-docs/horse-health/brand-assets) add more private
    // buckets to the same global table, so assert these eight exist and are
    // private rather than exact-equality on the whole storage.buckets set.
    const eight = [
      'contracts', 'facility-files', 'generated-documents', 'horse-documents',
      'horse-photos', 'profile-images', 'reports', 'temporary-uploads',
    ];
    const rows = await h.q<{ id: string; public: boolean }>(
      `select id, public from storage.buckets where id = any($1) order by id`, [eight]);
    expect(rows.map((r) => r.id).sort()).toEqual(eight);
    expect(rows.every((r) => r.public === false)).toBe(true);
  });
});

describe('RLS — path-prefix ownership', () => {
  it('scopes reads to owned engagements/horses/self; admin all; anon none', async () => {
    const alice = await makeClientWithAssets('alice-stor@fhe');
    const bob = await makeClientWithAssets('bob-stor@fhe');
    await h.asSuperuser();
    const adminUid = await h.createAuthUser({ email: 'ops-stor@fhe', isAdmin: true });

    // Seed objects (as superuser; paths embed the owning id as first folder).
    await h.q(`insert into storage.objects (bucket_id, name) values
      ('contracts', $1),
      ('horse-photos', $2),
      ('profile-images', $3),
      ('contracts', $4)`,
      [`${alice.eng}/agreement.pdf`, `${alice.horse}/conformation.jpg`,
       `${alice.uid}/avatar.png`, `${bob.eng}/agreement.pdf`]);

    // Alice: her contract, her horse photo, her avatar — not Bob's contract.
    await h.asUser(alice.uid);
    const names = (await h.q<{ name: string }>(`select name from storage.objects order by name`)).map((r) => r.name);
    expect(names).toContain(`${alice.eng}/agreement.pdf`);
    expect(names).toContain(`${alice.horse}/conformation.jpg`);
    expect(names).toContain(`${alice.uid}/avatar.png`);
    expect(names).not.toContain(`${bob.eng}/agreement.pdf`);

    // Admin sees all four.
    await h.asUser(adminUid);
    expect((await h.q(`select id from storage.objects`)).length).toBe(4);

    // Anon sees none.
    await h.asAnon();
    expect(await h.q(`select id from storage.objects`)).toHaveLength(0);
  });

  it('lets a client upload to their own profile path, but not elsewhere', async () => {
    const alice = await makeClientWithAssets('alice-up@fhe');
    const bob = await makeClientWithAssets('bob-up@fhe');

    await h.asUser(alice.uid);
    // own profile path: allowed
    await h.q(`insert into storage.objects (bucket_id, name) values ('profile-images', $1)`,
      [`${alice.uid}/new-avatar.png`]);
    expect((await h.q(`select id from storage.objects where bucket_id='profile-images'`)).length).toBeGreaterThanOrEqual(1);

    // someone else's profile path: blocked by WITH CHECK
    await expect(
      h.q(`insert into storage.objects (bucket_id, name) values ('profile-images', $1)`, [`${bob.uid}/evil.png`]),
    ).rejects.toThrow();

    // contracts bucket is not client-writable
    await expect(
      h.q(`insert into storage.objects (bucket_id, name) values ('contracts', $1)`, [`${alice.eng}/forged.pdf`]),
    ).rejects.toThrow();
  });
});
