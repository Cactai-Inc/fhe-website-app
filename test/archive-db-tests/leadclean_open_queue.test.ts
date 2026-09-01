/**
 * TASK-LEADCLEAN — the open-lead predicate and the contact_id backfill, applied
 * to a FRESH database and exercised.
 *
 * The harness's default path is the committed schema SNAPSHOT (2026-08-03),
 * which predates both `inbound_open_count()` and this task's migration, so this
 * file seeds a world shaped like the live one and then applies
 * `20260811T1900_leadclean_open_queue.sql` on top. Seeding BEFORE the migration
 * is the point: the backfill is a one-shot data statement, and running it after
 * the fixture exists is the only way to prove what it actually touches.
 *
 * What it proves:
 *   (a) the migration applies to a database that is not production;
 *   (b) a lead whose person is already a CONTACT leaves the open set — whether
 *       its stored status is 'new' or 'contacted' — with no status rewritten;
 *   (c) leads whose person is still a LEAD stay open, and terminal statuses
 *       ('converted'/'expired') stay out on their own;
 *   (d) THE CONTROL: the reserved request keeps its NULL contact_id and stays in
 *       the open set — the backfill's exclusion clause actually excludes it;
 *   (e) the backfill links only where exactly ONE live contact holds that email;
 *       an email held by two contacts stays NULL rather than being guessed;
 *   (f) the backfill changes no already_converted verdict — the same rows are
 *       open before and after it runs;
 *   (g) inbound_open_count() returns that same open count for staff and refuses
 *       a non-staff caller;
 *   (h) no request row is deleted by any of it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from '../db/harness';

let h: TestDb;
let org: string;
let staff: string;
let member: string;

/** The id the migration excludes by name — the owner's acceptance control. */
const CONTROL_ID = '609d45cf-bc56-4c91-afe0-9555a6f9d137';

/** The open-lead predicate, stated once, in SQL, exactly as the migration and
 *  the client both express it. `already_converted` is null when no contact
 *  matched at all, and a NULL there means NOT converted, not "drop the row". */
const OPEN_SQL = `
  select coalesce(q.contact_first_name, '') as name
    from inbound_queue q
   where q.org_id = $1
     and q.status not in ('converted', 'expired')
     and not coalesce(q.already_converted, false)
   order by 1`;

const CONVERTED_SQL = `
  select coalesce(q.contact_first_name, '') as name
    from inbound_queue q
   where q.org_id = $1 and q.already_converted
   order by 1`;

const names = (rows: { name: string }[]) => rows.map((r) => r.name).sort();

async function contact(
  first: string, email: string, type: 'LEAD' | 'CONTACT',
): Promise<string> {
  const [row] = await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name, email, contact_type)
     values ($1, $2, 'Fixture', $3, $4) returning id`,
    [org, first, email, type]);
  return row.id;
}

async function request(
  first: string, email: string, status: string,
  opts: { contactId?: string | null; id?: string } = {},
): Promise<string> {
  const [row] = await h.q<{ id: string }>(
    `insert into requests (id, org_id, status, contact_name, contact_email,
                           contact_first_name, contact_last_name, channel)
     values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $4, 'Fixture', 'booking')
     returning id`,
    [opts.id ?? null, org, status, first, email]);
  // The capture trigger is AFTER INSERT and assigns NEW.contact_id, which does
  // nothing in an AFTER trigger — so the link is set here when the fixture wants
  // one, exactly as production's older rows carry one and its newer rows do not.
  if (opts.contactId) {
    await h.q(`update requests set contact_id = $1 where id = $2`, [opts.contactId, row.id]);
  }
  return row.id;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  org = (await h.q<{ id: string }>(
    `select id from organizations order by created_at limit 1`))[0].id;

  // ── the people ──────────────────────────────────────────────────────────
  // CONTACT = already a client (what inbound_queue calls converted).
  const cStale1 = await contact('Stale', 'stale1@ex.com', 'CONTACT');
  const cStale2 = await contact('Staletwo', 'stale2@ex.com', 'CONTACT');
  await contact('Stalethree', 'stale3@ex.com', 'CONTACT');   // no link yet
  const cSerena = await contact('Serena', 'serena@ex.com', 'CONTACT');
  // LEAD = enquired, never became a client.
  const cOpen1 = await contact('Openone', 'open1@ex.com', 'LEAD');
  await contact('Opentwo', 'open2@ex.com', 'LEAD');          // no link yet
  await contact('Kit', 'kit@ex.com', 'LEAD');                // the control's person
  const cDone = await contact('Dana', 'dana@ex.com', 'LEAD');
  const cEve = await contact('Eve', 'eve@ex.com', 'LEAD');
  // Two live contacts on ONE email — the ambiguous case the backfill must refuse.
  await contact('Amy', 'amy@ex.com', 'LEAD');
  await contact('Amy', 'amy@ex.com', 'LEAD');

  // ── the requests ────────────────────────────────────────────────────────
  await request('Stale', 'stale1@ex.com', 'new', { contactId: cStale1 });
  await request('Staletwo', 'stale2@ex.com', 'new', { contactId: cStale2 });
  await request('Stalethree', 'stale3@ex.com', 'new');            // NULL link
  await request('Serena', 'serena@ex.com', 'contacted', { contactId: cSerena });
  await request('Openone', 'open1@ex.com', 'contacted', { contactId: cOpen1 });
  await request('Opentwo', 'open2@ex.com', 'contacted');          // NULL link
  await request('Amy', 'amy@ex.com', 'contacted');                // NULL, ambiguous
  await request('Kit', 'kit@ex.com', 'new', { id: CONTROL_ID });  // NULL, RESERVED
  await request('Dana', 'dana@ex.com', 'converted', { contactId: cDone });
  await request('Eve', 'eve@ex.com', 'expired', { contactId: cEve });

  staff = await h.createAuthUser({ email: 'leadclean-staff@fhe.test', role: 'ADMIN', org });
  member = await h.createAuthUser({ email: 'leadclean-member@fhe.test', role: 'USER', org });
});

afterAll(async () => { await h?.close(); });

describe('TASK-LEADCLEAN — the open lead set derives itself', () => {
  it('applies the migration to a fresh database', async () => {
    await h.asSuperuser();

    const before = await h.q<{ name: string }>(OPEN_SQL, [org]);
    const rowsBefore = (await h.q<{ n: string }>(
      `select count(*)::text as n from requests where org_id = $1`, [org]))[0].n;

    await h.db.exec(readFileSync(
      resolve(MIGRATIONS_DIR, '20260811T1900_leadclean_open_queue.sql'), 'utf8'));

    const after = await h.q<{ name: string }>(OPEN_SQL, [org]);
    const rowsAfter = (await h.q<{ n: string }>(
      `select count(*)::text as n from requests where org_id = $1`, [org]))[0].n;

    // (f) the backfill is verdict-neutral, and (h) it deletes nothing.
    expect(names(after)).toEqual(names(before));
    expect(rowsAfter).toBe(rowsBefore);
    expect(rowsAfter).toBe('10');
  });

  it('drops converted leads from the open set and keeps genuine ones', async () => {
    await h.asSuperuser();
    // (b) Serena is 'contacted' and Stale* are 'new' — status is irrelevant to
    // the verdict, being a CONTACT is what retires the card.
    expect(names(await h.q<{ name: string }>(CONVERTED_SQL, [org])))
      .toEqual(['Serena', 'Stale', 'Stalethree', 'Staletwo']);
    // (c) the four still-LEAD rows stay; 'converted'/'expired' stay out on status.
    expect(names(await h.q<{ name: string }>(OPEN_SQL, [org])))
      .toEqual(['Amy', 'Kit', 'Openone', 'Opentwo']);
  });

  it('leaves every request row in place — nothing is deleted or restatused', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ status: string; n: string }>(
      `select status, count(*)::text as n from requests where org_id = $1
       group by status order by status`, [org]);
    expect(rows).toEqual([
      { status: 'contacted', n: '4' },  // Serena, Openone, Opentwo, Amy
      { status: 'converted', n: '1' },  // Dana
      { status: 'expired', n: '1' },    // Eve
      { status: 'new', n: '4' },        // Stale, Staletwo, Stalethree, Kit
    ]);
  });
});

describe('TASK-LEADCLEAN — the contact_id backfill', () => {
  it('links the unambiguous rows', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ name: string; email: string }>(
      `select r.contact_first_name as name, c.email
         from requests r join contacts c on c.id = r.contact_id
        where r.org_id = $1 and r.contact_first_name in ('Stalethree', 'Opentwo')
        order by 1`, [org]);
    expect(rows).toEqual([
      { name: 'Opentwo', email: 'open2@ex.com' },
      { name: 'Stalethree', email: 'stale3@ex.com' },
    ]);
  });

  it('refuses the ambiguous row rather than guessing a person', async () => {
    await h.asSuperuser();
    // (e) two live contacts hold amy@ex.com, so there is no evidence to pick one.
    const [row] = await h.q<{ linked: boolean }>(
      `select contact_id is not null as linked from requests
        where org_id = $1 and contact_first_name = 'Amy'`, [org]);
    expect(row.linked).toBe(false);
  });

  it('does not touch the reserved control row', async () => {
    await h.asSuperuser();
    // (d) exactly one live contact holds kit@ex.com, so the ONLY reason this row
    // is still NULL is the migration's explicit exclusion.
    const [matches] = await h.q<{ n: string }>(
      `select count(*)::text as n from contacts
        where org_id = $1 and lower(email) = 'kit@ex.com' and deleted_at is null`, [org]);
    expect(matches.n).toBe('1');

    const [row] = await h.q<{ linked: boolean; status: string; converted: boolean | null }>(
      `select r.contact_id is not null as linked, r.status, q.already_converted as converted
         from requests r join inbound_queue q on q.id = r.id where r.id = $1`, [CONTROL_ID]);
    expect(row.linked).toBe(false);
    expect(row.status).toBe('new');
    expect(row.converted).toBe(false);
  });
});

describe('TASK-LEADCLEAN — the nav badge counts what the surface shows', () => {
  it('counts the open leads, not the converted ones', async () => {
    await h.asUser(staff);
    const [row] = await h.q<{ n: number }>(`select inbound_open_count() as n`);
    // Four open leads + zero unresolved support requests. The pre-task function
    // counted status='new' flat, which was seven of these ten rows.
    expect(Number(row.n)).toBe(4);
  });

  it('still refuses a non-staff caller', async () => {
    await h.asUser(member);
    await expect(h.q(`select inbound_open_count()`)).rejects.toThrow(/staff access required/);
  });
});
