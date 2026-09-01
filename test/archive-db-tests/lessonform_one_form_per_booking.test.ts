/**
 * TASK LESSONFORM — every lesson carries its own activity form, and the form
 * follows the booking.
 *
 * Before this work the pieces existed and none were connected: `form_definitions`
 * held 27 definitions (all intake/engagement, none a per-session activity form),
 * `activity_checklists` held a per-service template list with no per-booking
 * instance, and there was NO response/instance table at all — a form could be
 * defined and never filled in.
 *
 * This file proves the instance layer on the committed pre-LESSONFORM snapshot:
 * the trigger creates exactly one linked row on assignment, the row moves with a
 * reschedule (because the link is the booking id, which a reschedule never
 * changes), a cancel deletes a blank one and RETIRES one that has been written in
 * (D11 — a form with answers is evidence), a replacement booking gets a fresh
 * instance, and the legacy writers now route through the one writer instead of
 * competing with it.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from '../db/harness';

const MIGRATIONS = [
  '20260816T2200_lessonform_m1_one_form_instance_per_booking.sql',
  '20260816T2300_lessonform_m2_the_lifecycle.sql',
  '20260816T2330_lessonform_m3_find_fill_discard.sql',
  '20260816T2350_lessonform_m4_close_the_default_grant.sql',
];

let h: TestDb;
let org: string;
let staffUid: string;
let memberUid: string;
let clientId: string;
let offeringId: string;

const HOUR = 60 * 60 * 1000;
const past = (days: number) => new Date(Date.now() - days * 24 * HOUR).toISOString();
const future = (days: number) => new Date(Date.now() + days * 24 * HOUR).toISOString();

async function makeLesson(startsAt: string, status = 'scheduled'): Promise<string> {
  await h.asSuperuser();
  const endsAt = new Date(new Date(startsAt).getTime() + HOUR).toISOString();
  return (await h.q<{ id: string }>(
    `insert into bookings (org_id, status, kind, starts_at, ends_at, client_id, offering_id)
       values ($1,$2,'lesson',$3,$4,$5,$6) returning id`,
    [org, status, startsAt, endsAt, clientId, offeringId]))[0].id;
}

async function formOf(bookingId: string) {
  await h.asSuperuser();
  return h.q<{ id: string; status: string; answers: Record<string, unknown>; retired_at: string | null }>(
    `select id, status, answers, retired_at from booking_forms where booking_id = $1`, [bookingId]);
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  // Same seed REVIEWQ's and CREDITFIX's files need: any bookings INSERT/UPDATE
  // fires trg_status_bookings, which FKs into status_events_vocab — not a
  // snapshot-seeded table.
  await h.q(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'offering', c, c from unnest(array['pending','scheduled','cancelled','completed','no_show']) c
    on conflict do nothing;`);

  // bookings.deleted_at/deleted_by postdate this snapshot (2026-08-03) — added by
  // REVIEWQ m4 (20260815T2500), which prod already carried before LESSONFORM ran.
  // booking_form_applies() reads deleted_at, so the columns are added here for the
  // same defensive reason REVIEWQ's own test adds lesson_credits.purchase_id.
  await h.q(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deleted_at timestamptz;`);
  await h.q(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deleted_by uuid;`);

  staffUid = await h.createAuthUser({ role: 'ADMIN', org });
  memberUid = await h.createAuthUser({ role: 'USER', org });
  const contact = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name, email)
       values ($1,'Lessonform','Rider','lessonform-rider@test.fhe') returning id`, [org]))[0].id;
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contact, memberUid]);
  clientId = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, contact]))[0].id;

  offeringId = (await h.q<{ id: string }>(
    `insert into offerings (org_id, segment, name, slug, active, service_type,
                            config_kind, price_unit, unit_count, price_amount)
       values ($1,'rider','Single Lesson','lessonform-single',true,'RIDING_LESSON',
               'scheduled','session',1,150) returning id`, [org]))[0].id;

  // the per-service checklist the form's "What we did" field resolves from
  await h.q(
    `insert into activity_checklists (org_id, service_type, label, sort_order)
     select $1,'RIDING_LESSON', l, i
       from unnest(array['Warm-up','Flatwork','Canter work','Cool-down']) with ordinality as t(l, i)`,
    [org]);
});

afterAll(async () => { await h?.close(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('BEFORE the migrations — the central gap, on the shipped schema', () => {
  it('no instance/response table exists: a form can be defined and never filled in', async () => {
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from information_schema.tables
        where table_schema='public' and table_name in ('booking_forms','form_responses','form_instances')`);
    expect(n).toBe(0);
  });

  it('none of the shipped form_definitions is a per-session activity form', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ form_key: string }>(
      `select form_key from form_definitions where form_key like 'ACTIVITY%'`);
    expect(rows).toHaveLength(0);
  });

  it('set_booking_log writes bookings.activity_log directly — nothing behind it', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select pg_get_functiondef('public.set_booking_log(uuid,jsonb,text)'::regprocedure) as src`);
    expect(src).toContain('UPDATE bookings');
    expect(src).not.toContain('save_booking_form');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the migrations apply, and replay idempotently', () => {
  it('applies cleanly', async () => {
    await h.asSuperuser();
    for (const f of MIGRATIONS) {
      await h.db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
    }
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from information_schema.tables
        where table_schema='public' and table_name='booking_forms'`);
    expect(n).toBe(1);
  });

  it('replays without error (CREATE ... IF NOT EXISTS / OR REPLACE throughout)', async () => {
    await h.asSuperuser();
    for (const f of MIGRATIONS) {
      await h.db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
    }
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from form_definitions where form_key='ACTIVITY_SESSION'`);
    expect(n).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('L1 — a real link: one form instance per booking', () => {
  it('assigning a lesson creates EXACTLY ONE instance, linked by booking_id', async () => {
    const b = await makeLesson(past(3));
    const rows = await formOf(b);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('open');
    expect(rows[0].answers).toEqual({});
  });

  it('the instance names the definition it was drawn from, chosen by service', async () => {
    const b = await makeLesson(past(4));
    await h.asSuperuser();
    const [row] = await h.q<{ form_key: string; service_type: string; def: string }>(
      `select f.form_key, f.service_type, fd.form_key as def
         from booking_forms f join form_definitions fd on fd.id = f.form_definition_id
        where f.booking_id = $1`, [b]);
    expect(row.form_key).toBe('ACTIVITY_SESSION');
    expect(row.def).toBe('ACTIVITY_SESSION');
    expect(row.service_type).toBe('RIDING_LESSON');
  });

  it('an OPEN SLOT nobody has taken gets no form, and gets one when it is assigned', async () => {
    await h.asSuperuser();
    const slot = (await h.q<{ id: string }>(
      `insert into bookings (org_id, status, is_flexible, kind, starts_at, ends_at, offering_id)
         values ($1,'available',true,'lesson',$2,$3,$4) returning id`,
      [org, past(1), past(1), offeringId]))[0].id;
    expect(await formOf(slot)).toHaveLength(0);

    await h.q(`update bookings set client_id=$1, status='scheduled' where id=$2`, [clientId, slot]);
    expect(await formOf(slot)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('L2 — Claire finds, fills, and discards', () => {
  it('the backlog carries PAST lessons and excludes upcoming ones', async () => {
    const done = await makeLesson(past(2));
    const soon = await makeLesson(future(4));
    await h.asUser(staffUid);
    const todo = await h.q<{ booking_id: string }>(`select booking_id from lesson_forms('todo')`);
    const upcoming = await h.q<{ booking_id: string }>(`select booking_id from lesson_forms('upcoming')`);
    expect(todo.map((r) => r.booking_id)).toContain(done);
    expect(todo.map((r) => r.booking_id)).not.toContain(soon);
    expect(upcoming.map((r) => r.booking_id)).toContain(soon);
  });

  it('the form carries the LIVE per-service checklist, not a baked copy', async () => {
    const b = await makeLesson(past(2));
    await h.asUser(staffUid);
    const [row] = await h.q<{ view: { checklist: string[] } }>(
      `select booking_form($1) as view`, [b]);
    expect(row.view.checklist).toEqual(['Warm-up', 'Flatwork', 'Canter work', 'Cool-down']);
  });

  it('marking a no-show on the form sets bookings.status = no_show', async () => {
    const b = await makeLesson(past(1));
    await h.asUser(staffUid);
    await h.q(`select save_booking_form($1, '{"attendance":"no_show"}'::jsonb)`, [b]);
    await h.asSuperuser();
    const [{ status }] = await h.q<{ status: string }>(`select status from bookings where id=$1`, [b]);
    expect(status).toBe('no_show');
  });

  it('discarding a BLANK form deletes it and leaves the booking alone', async () => {
    const b = await makeLesson(past(5));
    await h.asUser(staffUid);
    const [{ r }] = await h.q<{ r: { outcome: string } }>(`select discard_booking_form($1) as r`, [b]);
    expect(r.outcome).toBe('deleted');
    expect(await formOf(b)).toHaveLength(0);
    await h.asSuperuser();
    const [{ status }] = await h.q<{ status: string }>(`select status from bookings where id=$1`, [b]);
    expect(status).toBe('scheduled');
  });

  it('discarding a WRITTEN-IN form retires it (kept as a record) — D11', async () => {
    const b = await makeLesson(past(5));
    await h.asUser(staffUid);
    await h.q(`select save_booking_form($1, '{"log_text":"worth keeping"}'::jsonb)`, [b]);
    const [{ r }] = await h.q<{ r: { outcome: string } }>(`select discard_booking_form($1) as r`, [b]);
    expect(r.outcome).toBe('retired');
    const [row] = await formOf(b);
    expect(row.status).toBe('retired');
    expect(row.answers).toMatchObject({ log_text: 'worth keeping' });
  });

  it('an unfilled form is not an error state — a blank instance is simply open', async () => {
    const b = await makeLesson(past(6));
    const [row] = await formOf(b);
    expect(row.status).toBe('open');
    await h.asUser(staffUid);
    const [{ view }] = await h.q<{ view: { form: { blank: boolean } } }>(
      `select booking_form($1) as view`, [b]);
    expect(view.form.blank).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('L3 — the lifecycle', () => {
  it('RESCHEDULE moves the SAME instance, partial answers intact', async () => {
    const b = await makeLesson(past(2));
    await h.asUser(staffUid);
    await h.q(
      `select save_booking_form($1, '{"activities":["Warm-up"],"log_text":"half written"}'::jsonb)`, [b]);
    const [before] = await formOf(b);

    // every reschedule path in the system edits the times in place; the booking
    // id — and therefore the link — never changes.
    await h.asSuperuser();
    await h.q(
      `update bookings set starts_at = starts_at + interval '9 days',
                           ends_at   = ends_at   + interval '9 days' where id=$1`, [b]);

    const [after] = await formOf(b);
    expect(after.id).toBe(before.id);
    expect(after.answers).toEqual(before.answers);
    expect(after.status).toBe('open');
  });

  it('CANCEL deletes a BLANK form', async () => {
    const b = await makeLesson(past(1));
    expect(await formOf(b)).toHaveLength(1);
    await h.asSuperuser();
    await h.q(`update bookings set status='cancelled' where id=$1`, [b]);
    expect(await formOf(b)).toHaveLength(0);
  });

  it('CANCEL retains a form that has ANSWERS, retired rather than deleted', async () => {
    const b = await makeLesson(past(1));
    await h.asUser(staffUid);
    await h.q(`select save_booking_form($1, '{"report":"Good canter work."}'::jsonb)`, [b]);
    await h.asSuperuser();
    await h.q(`update bookings set status='cancelled' where id=$1`, [b]);
    const [row] = await formOf(b);
    expect(row.status).toBe('retired');
    expect(row.retired_at).not.toBeNull();
    expect(row.answers).toMatchObject({ report: 'Good canter work.' });
  });

  it('a retired form refuses further edits, and reviving the booking brings it back', async () => {
    const b = await makeLesson(past(1));
    await h.asUser(staffUid);
    await h.q(`select save_booking_form($1, '{"log_text":"x"}'::jsonb)`, [b]);
    await h.asSuperuser();
    await h.q(`update bookings set status='cancelled' where id=$1`, [b]);

    await h.asUser(staffUid);
    await expect(
      h.q(`select save_booking_form($1, '{"log_text":"y"}'::jsonb)`, [b]),
    ).rejects.toThrow(/retired/i);

    await h.asSuperuser();
    await h.q(`update bookings set status='scheduled' where id=$1`, [b]);
    const [row] = await formOf(b);
    expect(row.status).toBe('open');
    expect(row.retired_at).toBeNull();
  });

  it('a REPLACEMENT booking gets its own fresh instance', async () => {
    const cancelled = await makeLesson(past(1));
    await h.asUser(staffUid);
    await h.q(`select save_booking_form($1, '{"report":"kept"}'::jsonb)`, [cancelled]);
    await h.asSuperuser();
    await h.q(`update bookings set status='cancelled' where id=$1`, [cancelled]);
    const [old] = await formOf(cancelled);

    const replacement = await makeLesson(future(2));
    const [fresh] = await formOf(replacement);
    expect(fresh.id).not.toBe(old.id);
    expect(fresh.status).toBe('open');
    expect(fresh.answers).toEqual({});
  });

  it('a hard-deleted booking takes its form with it (agrees with delete_calendar_item)', async () => {
    const b = await makeLesson(past(1));
    expect(await formOf(b)).toHaveLength(1);
    await h.asSuperuser();
    await h.q(`delete from bookings where id=$1`, [b]);
    expect(await formOf(b)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('L4 — one writer, and the projections the rider surfaces read', () => {
  it('save_booking_form writes bookings.activity_log and bookings.notes', async () => {
    const b = await makeLesson(past(2));
    await h.asUser(staffUid);
    await h.q(
      `select save_booking_form($1,'{"activities":["Flatwork"],"log_text":"staff record","report":"rider note"}'::jsonb)`,
      [b]);
    await h.asSuperuser();
    const [row] = await h.q<{ activity_log: { activities: string[]; text: string }; notes: string }>(
      `select activity_log, notes from bookings where id=$1`, [b]);
    expect(row.activity_log.activities).toEqual(['Flatwork']);
    expect(row.activity_log.text).toBe('staff record');
    expect(row.notes).toBe('rider note');
  });

  it('the legacy set_booking_log now routes THROUGH the form — no rival writer', async () => {
    const b = await makeLesson(past(2));
    await h.asUser(staffUid);
    await h.q(`select set_booking_log($1,'["Canter work"]'::jsonb,'via the legacy RPC')`, [b]);
    const [row] = await formOf(b);
    expect(row.answers).toMatchObject({ activities: ['Canter work'], log_text: 'via the legacy RPC' });
    await h.asSuperuser();
    const [b2] = await h.q<{ activity_log: { text: string } }>(
      `select activity_log from bookings where id=$1`, [b]);
    expect(b2.activity_log.text).toBe('via the legacy RPC');
  });

  it('booking_notes stays the authored thread and is still writable — not the response store', async () => {
    const b = await makeLesson(past(2));
    await h.asUser(staffUid);
    await h.q(`select add_booking_note($1,'post','see you next week')`, [b]);
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from booking_notes where booking_id=$1`, [b]);
    expect(n).toBe(1);
    // and it is NOT where the form's answers went
    const [row] = await formOf(b);
    expect(row.answers).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('access — staff only, anon nothing', () => {
  it('a member cannot read the instance table or call the write RPCs', async () => {
    const b = await makeLesson(past(2));
    await h.asUser(memberUid);
    const rows = await h.q(`select * from booking_forms`);
    expect(rows).toHaveLength(0);
    await expect(h.q(`select save_booking_form($1,'{}'::jsonb)`, [b])).rejects.toThrow(/operator access/i);
    await expect(h.q(`select discard_booking_form($1)`, [b])).rejects.toThrow(/operator access/i);
    await expect(h.q(`select booking_form($1)`, [b])).rejects.toThrow(/operator access/i);
  });

  it('anon holds no privilege on anything new', async () => {
    await h.asSuperuser();
    const [row] = await h.q<Record<string, boolean>>(`
      select has_function_privilege('anon','public.booking_form(uuid)','EXECUTE')                      as f1,
             has_function_privilege('anon','public.save_booking_form(uuid,jsonb,boolean)','EXECUTE')   as f2,
             has_function_privilege('anon','public.discard_booking_form(uuid)','EXECUTE')              as f3,
             has_function_privilege('anon','public.lesson_forms(text)','EXECUTE')                      as f4,
             has_function_privilege('anon','public._ensure_booking_form(bookings)','EXECUTE')          as f5,
             has_table_privilege('anon','public.booking_forms','SELECT')                               as t1,
             has_table_privilege('anon','public.booking_forms','INSERT')                               as t2,
             has_table_privilege('authenticated','public.booking_forms','INSERT')                      as t3,
             has_function_privilege('authenticated','public._ensure_booking_form(bookings)','EXECUTE')  as t4`);
    for (const [k, v] of Object.entries(row)) expect([k, v]).toEqual([k, false]);
  });

  it('booking_report keeps the instructor LOG off the wire for the client', async () => {
    const b = await makeLesson(past(2));
    await h.asUser(staffUid);
    await h.q(
      `select save_booking_form($1,'{"activities":["Flatwork"],"log_text":"staff only","report":"rider note"}'::jsonb)`,
      [b]);
    const [{ staffView }] = await h.q<{ staffView: { activity_log: { text: string | null }; form: unknown } }>(
      `select booking_report($1) as "staffView"`, [b]);
    expect(staffView.activity_log.text).toBe('staff only');
    expect(staffView.form).not.toBeNull();

    await h.asUser(memberUid);
    const [{ clientView }] = await h.q<{
      clientView: { activity_log: { activities: string[]; text: string | null }; form: unknown };
    }>(`select booking_report($1) as "clientView"`, [b]);
    expect(clientView.activity_log.activities).toEqual(['Flatwork']);
    expect(clientView.activity_log.text).toBeNull();
    expect(clientView.form).toBeNull();
  });
});
