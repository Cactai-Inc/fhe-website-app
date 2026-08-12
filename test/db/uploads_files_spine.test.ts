/**
 * TASK-UPLOADS — the Files spine, applied to a FRESH database and exercised.
 *
 * The harness's default path is the committed schema SNAPSHOT, which predates
 * this migration, so this file applies `20260811T1600_uploads_files_spine.sql`
 * on top of it before testing. That is the point: a migration that typechecks
 * is not a migration that applies, and this proves it does — on a database that
 * is not production.
 *
 * What it proves, all through RLS rather than through the UI:
 *   (a) a member reads and writes only their OWN files;
 *   (b) another member reads none of them;
 *   (c) staff read the tenant's files, and staff uploading FOR a member leaves
 *       the MEMBER as owner — ownership is a column, never the uploader;
 *   (d) D1a — the platform owner (org_id NULL) is denied, on the table and on
 *       storage.objects, and that denial is CORRECT rather than a bug;
 *   (e) org-owned material is gated by content_resources.published, and
 *       unpublishing withdraws the OBJECT too, not just the listing;
 *   (f) surfacing a file on another record is a REFERENCE — one files row.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from './harness';

let h: TestDb;
let org: string;
let memberA: string; let contactA: string;
let memberB: string; let contactB: string;
let staff: string;
let platform: string;   // the platform owner: ADMIN-class role, org_id NULL

const path = (o: string, kind: string, owner: string, name: string) =>
  `${o}/${kind}/${owner}/${name}`;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  // The migration under test, applied to a fresh database.
  await h.db.exec(
    readFileSync(resolve(MIGRATIONS_DIR, '20260811T1600_uploads_files_spine.sql'), 'utf8'),
  );

  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  // The snapshot carries no storage.buckets rows (PGlite has no Storage
  // extension; the harness only shims the SQL surface). Production already has
  // all twelve — this task adds none, it reuses `facility-files`.
  await h.q(`insert into storage.buckets (id, name, public) values ('facility-files','facility-files',false)
             on conflict (id) do nothing`);

  contactA = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email, org_id) values ('Ada','Owner','ada@ex.com',$1) returning id`,
    [org]))[0].id;
  contactB = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email, org_id) values ('Bo','Other','bo@ex.com',$1) returning id`,
    [org]))[0].id;

  memberA = await h.createAuthUser({ email: 'ada@fhe.test', role: 'USER', org });
  memberB = await h.createAuthUser({ email: 'bo@fhe.test', role: 'USER', org });
  staff = await h.createAuthUser({ email: 'staff@fhe.test', role: 'ADMIN', org });
  // D1a: same privileged role, NO tenant. This is the platform account's shape.
  // `org: null` is not enough — a profiles trigger stamps the current org on
  // insert — so the tenant link is cleared explicitly. org_id NULL BY DESIGN;
  // the ruling refuses setting one as the cheap fix.
  platform = await h.createAuthUser({ email: 'platform@cactai.test', role: 'SUPER_ADMIN', org: null });
  await h.q(`update profiles set org_id = null where user_id = $1`, [platform]);

  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contactA, memberA]);
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contactB, memberB]);
  // Membership may already exist (profile creation grants it via trigger) — this
  // only guarantees is_active_member() is true for both, which the org-published
  // read depends on.
  await h.q(
    `insert into members (user_id, status)
     select u, 'active' from unnest(array[$1::uuid,$2::uuid]) u
      where not exists (select 1 from members m where m.user_id = u)`,
    [memberA, memberB]);
  await h.q(`update members set status='active' where user_id = any(array[$1::uuid,$2::uuid])`,
    [memberA, memberB]);
});

afterAll(async () => { await h?.close(); });

describe('(a) a member owns what they upload', () => {
  it('member A uploads a file and reads it back', async () => {
    await h.asUser(memberA);
    const p = path(org, 'contact', contactA, 'coggins.pdf');
    await h.q(
      `insert into files (owner_kind, owner_contact_id, storage_path, filename)
       values ('contact', current_contact_id(), $1, 'coggins.pdf')`, [p]);
    const rows = await h.q(`select filename from files`);
    expect(rows.map((r) => r.filename)).toEqual(['coggins.pdf']);
  });

  it('the object is readable by its owner and the row cannot lie about the path', async () => {
    await h.asUser(memberA);
    await h.q(`insert into storage.objects (bucket_id, name) values ('facility-files', $1)`,
      [path(org, 'contact', contactA, 'coggins.pdf')]);
    const objs = await h.q(`select name from storage.objects where bucket_id='facility-files'`);
    expect(objs).toHaveLength(1);

    // A row owned by A, pointing at B's prefix — refused by the path CHECK.
    await expect(h.q(
      `insert into files (owner_kind, owner_contact_id, storage_path, filename)
       values ('contact', current_contact_id(), $1, 'lie.pdf')`,
      [path(org, 'contact', contactB, 'lie.pdf')],
    )).rejects.toThrow();
  });
});

describe('(b) another member reads none of it', () => {
  it('member B sees no files and cannot write an object under A\'s prefix', async () => {
    await h.asUser(memberB);
    expect(await h.q(`select id from files`)).toHaveLength(0);
    expect(await h.q(`select name from storage.objects where bucket_id='facility-files'`)).toHaveLength(0);

    await expect(h.q(
      `insert into storage.objects (bucket_id, name) values ('facility-files', $1)`,
      [path(org, 'contact', contactA, 'intruder.pdf')],
    )).rejects.toThrow();
  });

  it('member B cannot write a files row owned by someone else, or by the org', async () => {
    await h.asUser(memberB);
    await expect(h.q(
      `insert into files (owner_kind, owner_contact_id, storage_path, filename)
       values ('contact', $1, $2, 'theirs.pdf')`,
      [contactA, path(org, 'contact', contactA, 'theirs.pdf')],
    )).rejects.toThrow();

    await expect(h.q(
      `insert into files (owner_kind, owner_contact_id, storage_path, filename)
       values ('org', null, $1, 'company.pdf')`,
      [path(org, 'org', org, 'company.pdf')],
    )).rejects.toThrow();
  });
});

describe('(c) staff read the tenant\'s files; the uploader is not the owner', () => {
  it('staff see member A\'s file', async () => {
    await h.asUser(staff);
    const rows = await h.q(`select filename from files`);
    expect(rows.map((r) => r.filename)).toContain('coggins.pdf');
  });

  it('staff scanning a file FOR member B leaves B as the owner', async () => {
    await h.asUser(staff);
    await h.q(
      `insert into files (owner_kind, owner_contact_id, storage_path, filename)
       values ('contact', $1, $2, 'scanned.pdf')`,
      [contactB, path(org, 'contact', contactB, 'scanned.pdf')]);

    const [row] = await h.q<{ owner_contact_id: string; uploaded_by_user_id: string }>(
      `select owner_contact_id, uploaded_by_user_id from files where filename='scanned.pdf'`);
    expect(row.owner_contact_id).toBe(contactB);     // the member owns it…
    expect(row.uploaded_by_user_id).toBe(staff);     // …the staff account only uploaded it

    // and B, not the staff uploader, reads it as their own
    await h.asUser(memberB);
    const mine = await h.q(`select filename from files where owner_contact_id = current_contact_id()`);
    expect(mine.map((r) => r.filename)).toEqual(['scanned.pdf']);
  });
});

describe('(d) D1a — the platform owner is not a tenant, and denial is correct', () => {
  it('reads no tenant files and no tenant objects', async () => {
    await h.asUser(platform);
    expect(await h.q(`select id from files`)).toHaveLength(0);
    expect(await h.q(`select id from file_links`)).toHaveLength(0);
    expect(await h.q(`select name from storage.objects where bucket_id='facility-files'`)).toHaveLength(0);
  });

  it('cannot write a tenant file', async () => {
    await h.asUser(platform);
    await expect(h.q(
      `insert into files (org_id, owner_kind, owner_contact_id, storage_path, filename)
       values ($1, 'org', null, $2, 'platform.pdf')`,
      [org, path(org, 'org', org, 'platform.pdf')],
    )).rejects.toThrow();
  });
});

describe('(e) org-owned material is gated by published', () => {
  let orgFile: string;
  const orgPath = () => path(org, 'org', org, 'guide.pdf');

  it('staff publish a company guide and a member can read it', async () => {
    await h.asUser(staff);
    orgFile = (await h.q<{ id: string }>(
      `insert into files (owner_kind, owner_contact_id, storage_path, filename, title)
       values ('org', null, $1, 'guide.pdf', 'Boarding guide') returning id`, [orgPath()]))[0].id;
    await h.q(`insert into storage.objects (bucket_id, name) values ('facility-files', $1)`, [orgPath()]);
    await h.q(
      `insert into content_resources (title, kind, storage_path, file_id, published)
       values ('Boarding guide', 'file', $1, $2, true)`, [orgPath(), orgFile]);

    await h.asUser(memberB);
    expect(await h.q(`select id from files where owner_kind='org'`)).toHaveLength(1);
    expect(await h.q(
      `select name from storage.objects where bucket_id='facility-files' and name=$1`, [orgPath()],
    )).toHaveLength(1);
  });

  it('unpublishing withdraws the OBJECT, not just the listing', async () => {
    await h.asUser(staff);
    await h.q(`update content_resources set published=false where file_id=$1`, [orgFile]);

    await h.asUser(memberB);
    expect(await h.q(`select id from files where owner_kind='org'`)).toHaveLength(0);
    expect(await h.q(
      `select name from storage.objects where bucket_id='facility-files' and name=$1`, [orgPath()],
    )).toHaveLength(0);
  });
});

describe('(f) surfacing is a reference, never a copy', () => {
  it('one file, surfaced on a horse and a deal, is still one row', async () => {
    await h.asUser(staff);
    const [f] = await h.q<{ id: string }>(`select id from files where filename='coggins.pdf'`);
    await h.q(
      `insert into file_links (file_id, subject_type, subject_id) values
         ($1,'horse', gen_random_uuid()), ($1,'deal', gen_random_uuid())`, [f.id]);

    expect(await h.q(`select id from files where filename='coggins.pdf'`)).toHaveLength(1);

    // the owner sees where their file has been put…
    await h.asUser(memberA);
    const seen = await h.q<{ subject_type: string }>(`select subject_type from file_links`);
    expect(seen.map((r) => r.subject_type).sort()).toEqual(['deal', 'horse']);

    // …and an unrelated member sees neither the links nor the file
    await h.asUser(memberB);
    expect(await h.q(`select id from file_links`)).toHaveLength(0);
  });
});
