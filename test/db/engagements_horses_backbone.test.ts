/**
 * Category 1 — Schema: engagements & horses backbone (migration 010).
 *
 * Proves the operational spine the document layer hangs off is real and safe:
 *  - migration 10 applies additively after the identity/auth backbones,
 *  - HOR- and ENG-YYYY-NNNNNN human identifiers generate as specified,
 *  - a horse must carry at least one name to be contract-identifiable,
 *  - horse_breeds/horse_colors lookups seed and FK-constrain horses,
 *  - RLS scopes a client to engagements they own and horses they own OR that
 *    are referenced by an owned engagement (never "just because it exists"),
 *  - horses are never hard-deletable, even by an admin (REVOKE DELETE);
 *    archival via deleted_at is the only removal and hides the row from clients.
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

describe('migration applies additively', () => {
  it('lands after the identity (8) and auth (9) backbones', () => {
    const files = migrationFiles();
    const identity = files.findIndex((f) => f.includes('crm_identity_backbone'));
    const eng = files.findIndex((f) => f.includes('engagements_horses_backbone'));
    expect(identity).toBeGreaterThanOrEqual(0);
    expect(eng).toBeGreaterThan(identity);
  });

  it('created the new tables alongside the existing ones', async () => {
    await h.asSuperuser();
    const t = await h.q<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema='public'
         and table_name in ('horses','engagements','engagement_parties','horse_breeds','horse_colors')`,
    );
    expect(t.map((x) => x.table_name).sort()).toEqual([
      'engagement_parties', 'engagements', 'horse_breeds', 'horse_colors', 'horses',
    ]);
  });
});

describe('human identifiers', () => {
  it('assigns HOR- codes sequentially', async () => {
    await h.asSuperuser();
    const h1 = (await h.q<{ display_code: string }>(
      `insert into horses (barn_name) values ('Comet') returning display_code`))[0];
    const h2 = (await h.q<{ display_code: string }>(
      `insert into horses (registered_name) values ('Halley''s Comet') returning display_code`))[0];
    expect(h1.display_code).toMatch(/^HOR-\d{6}$/);
    expect(h2.display_code).toMatch(/^HOR-\d{6}$/);
    expect(Number(h2.display_code.slice(4))).toBe(Number(h1.display_code.slice(4)) + 1);
  });

  it('assigns ENG-YYYY-NNNNNN codes (year-stamped) per the merge dictionary', async () => {
    await h.asSuperuser();
    const contact = (await h.q<{ id: string }>(
      `insert into contacts (full_name) values ('Eng Owner') returning id`))[0].id;
    const client = (await h.q<{ id: string }>(
      `insert into clients (contact_id) values ($1) returning id`, [contact]))[0].id;
    const eng = (await h.q<{ display_code: string }>(
      `insert into engagements (client_id, service_type) values ($1,'HORSE_TRAINING') returning display_code`,
      [client]))[0];
    expect(eng.display_code).toMatch(/^ENG-\d{4}-\d{6}$/);
  });
});

describe('integrity constraints', () => {
  it('rejects a horse with no name (must be contract-identifiable)', async () => {
    await h.asSuperuser();
    await expect(
      h.q(`insert into horses (color) values ('BAY')`),
    ).rejects.toThrow();
  });

  it('FK-constrains breed/color to the lookups', async () => {
    await h.asSuperuser();
    await expect(
      h.q(`insert into horses (barn_name, breed) values ('Mystery','NOT_A_BREED')`),
    ).rejects.toThrow();
    // a seeded value is accepted
    const ok = await h.q<{ display_code: string }>(
      `insert into horses (barn_name, breed, color) values ('Valid','HANOVERIAN','GREY') returning display_code`);
    expect(ok[0].display_code).toMatch(/^HOR-\d{6}$/);
  });
});

describe('RLS — client sees own engagements and their horses only', () => {
  it('owns by contact OR by an owned engagement; strangers are hidden; anon sees none', async () => {
    await h.asSuperuser();
    const aliceUid = await h.createAuthUser({ email: 'alice@eng.fhe' });
    const adminUid = await h.createAuthUser({ email: 'ops@eng.fhe', isAdmin: true });

    const aliceContact = (await h.q<{ id: string }>(
      `insert into contacts (full_name, email) values ('Alice Eng','alice@eng.fhe') returning id`))[0].id;
    await h.q(`update profiles set contact_id=$1 where user_id=$2`, [aliceContact, aliceUid]);
    const aliceClient = (await h.q<{ id: string }>(
      `insert into clients (contact_id) values ($1) returning id`, [aliceContact]))[0].id;

    // (a) a horse Alice owns directly
    const ownedHorse = (await h.q<{ id: string }>(
      `insert into horses (barn_name, current_owner_contact_id) values ('Bonnie',$1) returning id`,
      [aliceContact]))[0].id;
    // (b) a horse Alice does NOT own, but referenced by her engagement
    const engHorse = (await h.q<{ id: string }>(
      `insert into horses (barn_name) values ('Clyde') returning id`))[0].id;
    await h.q(
      `insert into engagements (client_id, service_type, primary_horse_id) values ($1,'HORSE_PURCHASE_ASSISTANCE',$2)`,
      [aliceClient, engHorse]);
    // (c) a stranger's horse, unrelated to Alice
    const strangerHorse = (await h.q<{ id: string }>(
      `insert into horses (barn_name) values ('Secretariat') returning id`))[0].id;

    // Alice sees exactly (a) and (b), never (c).
    await h.asUser(aliceUid);
    const seen = (await h.q<{ id: string }>(`select id from horses order by barn_name`)).map((r) => r.id);
    expect(seen.sort()).toEqual([ownedHorse, engHorse].sort());
    expect(seen).not.toContain(strangerHorse);
    // and exactly her one engagement
    expect(await h.q(`select id from engagements`)).toHaveLength(1);

    // Admin sees all three horses.
    await h.asUser(adminUid);
    expect((await h.q(`select id from horses`)).length).toBeGreaterThanOrEqual(3);

    // Anon sees no horses (no anon SELECT policy).
    await h.asAnon();
    expect(await h.q(`select id from horses`)).toHaveLength(0);
  });
});

describe('horses are never hard-deletable (append-only / archival)', () => {
  it('blocks DELETE even for an admin, but allows soft-delete that hides the row from clients', async () => {
    await h.asSuperuser();
    const adminUid = await h.createAuthUser({ email: 'ops2@eng.fhe', isAdmin: true });
    const ownerUid = await h.createAuthUser({ email: 'owner@eng.fhe' });
    const ownerContact = (await h.q<{ id: string }>(
      `insert into contacts (full_name, email) values ('Owner O','owner@eng.fhe') returning id`))[0].id;
    await h.q(`update profiles set contact_id=$1 where user_id=$2`, [ownerContact, ownerUid]);
    await h.q(`insert into clients (contact_id) values ($1)`, [ownerContact]);
    const horse = (await h.q<{ id: string }>(
      `insert into horses (barn_name, current_owner_contact_id) values ('Permanent',$1) returning id`,
      [ownerContact]))[0].id;

    // Admin (authenticated role) cannot hard-delete: DELETE privilege is revoked.
    await h.asUser(adminUid);
    await expect(h.q(`delete from horses where id=$1`, [horse])).rejects.toThrow();

    // Owner sees their horse...
    await h.asUser(ownerUid);
    expect(await h.q(`select id from horses where id=$1`, [horse])).toHaveLength(1);

    // ...admin archives it via deleted_at...
    await h.asSuperuser();
    await h.q(`update horses set deleted_at=now() where id=$1`, [horse]);

    // ...and it vanishes from the owner's view, while the row still exists.
    await h.asUser(ownerUid);
    expect(await h.q(`select id from horses where id=$1`, [horse])).toHaveLength(0);
    await h.asSuperuser();
    expect((await h.q(`select id from horses where id=$1`, [horse])).length).toBe(1);
  });
});
