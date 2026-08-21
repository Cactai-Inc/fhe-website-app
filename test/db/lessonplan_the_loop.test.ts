/**
 * TASK LESSONPLAN — a plan per client, the day's lesson carries it, progress is
 * recorded against it, the plan advances, and the NEXT lesson inherits it.
 *
 * The loop is the acceptance test and it is `the loop closes` below: two lessons
 * for the same rider, progress recorded on the first, and the second showing a
 * plan it never had before — with the prior version still on disk and the change
 * in the log.
 *
 * Everything here runs on the committed pre-LESSONPLAN snapshot with the four
 * LESSONFORM migrations applied first, because the plan hangs off the form
 * instance LESSONFORM built rather than beside it.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from './harness';

/** The uploads spine (files + file_links) postdates this snapshot (2026-08-03)
 *  but long predates LESSONPLAN on prod. m4 hangs lesson photos off it, so the
 *  test applies it first rather than pretending the table is new here. */
const UPLOADS = ['20260811T1600_uploads_files_spine.sql'];

const LESSONFORM = [
  '20260816T2200_lessonform_m1_one_form_instance_per_booking.sql',
  '20260816T2300_lessonform_m2_the_lifecycle.sql',
  '20260816T2330_lessonform_m3_find_fill_discard.sql',
  '20260816T2350_lessonform_m4_close_the_default_grant.sql',
];
const LESSONPLAN = [
  '20260821T1500_lessonplan_m1_a_plan_belongs_to_a_client.sql',
  '20260821T1510_lessonplan_m2_the_day_carries_the_plan.sql',
  '20260821T1520_lessonplan_m3_progress_updates_the_plan.sql',
  '20260821T1530_lessonplan_m4_the_record_of_what_happened.sql',
];

let h: TestDb;
let org: string;
let staffUid: string;
let memberUid: string;
let otherUid: string;
let clientId: string;
let contactId: string;
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

async function plans() {
  await h.asSuperuser();
  return h.q<{
    id: string; version: number; status: string; focus: string | null;
    objectives: { id: string; label: string; state: string; note: string | null }[];
    coach_notes: string | null; supersedes_id: string | null;
    advanced_from_booking_id: string | null;
  }>(`select id, version, status, focus, objectives, coach_notes, supersedes_id,
             advanced_from_booking_id
        from lesson_plans where client_id = $1 order by version`, [clientId]);
}

async function currentPlan() {
  return (await plans()).find((p) => p.status === 'current')!;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  // Any bookings write fires trg_status_bookings, which FKs into
  // status_events_vocab — not a snapshot-seeded table. Same seed LESSONFORM's
  // file needs, for the same reason.
  await h.q(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'offering', c, c from unnest(array['pending','scheduled','cancelled','completed','no_show']) c
    on conflict do nothing;`);

  // bookings.deleted_at/deleted_by postdate this snapshot (REVIEWQ m4), and
  // booking_form_applies() reads deleted_at.
  await h.q(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deleted_at timestamptz;`);
  await h.q(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deleted_by uuid;`);

  staffUid = await h.createAuthUser({ role: 'ADMIN', org });
  memberUid = await h.createAuthUser({ role: 'USER', org });
  otherUid = await h.createAuthUser({ role: 'USER', org });

  contactId = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name, email)
       values ($1,'Lessonplan','Rider','lessonplan-rider@test.fhe') returning id`, [org]))[0].id;
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contactId, memberUid]);
  clientId = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, contactId]))[0].id;

  offeringId = (await h.q<{ id: string }>(
    `insert into offerings (org_id, segment, name, slug, active, service_type,
                            config_kind, price_unit, unit_count, price_amount)
       values ($1,'rider','Single Lesson','lessonplan-single',true,'RIDING_LESSON',
               'scheduled','session',1,150) returning id`, [org]))[0].id;

  await h.q(
    `insert into activity_checklists (org_id, service_type, label, sort_order)
     select $1,'RIDING_LESSON', l, i
       from unnest(array['Warm-up','Flatwork','Canter work','Cool-down']) with ordinality as t(l, i)
     on conflict do nothing`,
    [org]);

  for (const f of [...UPLOADS, ...LESSONFORM, ...LESSONPLAN]) {
    await h.db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
  }
});

afterAll(async () => { await h?.close(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('the migrations', () => {
  it('replay without error — every object is CREATE ... IF NOT EXISTS / OR REPLACE', async () => {
    await h.asSuperuser();
    for (const f of LESSONPLAN) {
      await h.db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
    }
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from information_schema.tables
        where table_schema='public' and table_name='lesson_plans'`);
    expect(n).toBe(1);
  });

  it('the plan hangs off the form instance that already existed — one added column, no parallel table', async () => {
    await h.asSuperuser();
    const cols = await h.q<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema='public' and table_name='booking_forms' and column_name='plan_id'`);
    expect(cols).toHaveLength(1);
    // and nothing that duplicates booking_forms was created beside it
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from information_schema.tables
        where table_schema='public'
          and table_name in ('lesson_plan_progress','booking_plans','lesson_plan_entries')`);
    expect(n).toBe(0);
  });

  it('the change log is status_events widened by one entity kind, not a new ledger', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ code: string; is_true_status: boolean }>(
      `select code, is_true_status from status_events_vocab where entity_type='lesson_plan' order by code`);
    expect(rows.map((r) => r.code)).toEqual(['advanced', 'created', 'revised', 'scrubbed']);
    // all sub-status, so log_status_event()'s denormalizing branch is never entered
    expect(rows.every((r) => r.is_true_status === false)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§1 — a plan belongs to a client', () => {
  it('staff author one, and it becomes version 1', async () => {
    await h.asUser(staffUid);
    await h.q(`select save_lesson_plan($1, $2, $3::jsonb, $4)`, [
      clientId,
      'Get secure at the canter',
      JSON.stringify([
        { label: 'Sitting trot without stirrups', state: 'working' },
        { label: 'Canter transitions on both leads', state: 'planned' },
        { label: 'First cross-rail course', state: 'planned' },
      ]),
      'Nervous after the fall in June — keep sessions short.',
    ]);

    const p = await currentPlan();
    expect(p.version).toBe(1);
    expect(p.focus).toBe('Get secure at the canter');
    expect(p.objectives).toHaveLength(3);
    expect(p.objectives[0].label).toBe('Sitting trot without stirrups');
    // every objective got a stable id so progress can be recorded against it
    expect(p.objectives.every((o) => typeof o.id === 'string' && o.id.length > 10)).toBe(true);
  });

  it('exactly one version is current, always', async () => {
    // read first: plans() resets the session to superuser, so composing the
    // argument inline would drop the staff role before the RPC ever ran
    const objectives = (await currentPlan()).objectives
      .concat([{ id: '', label: 'Ride the whole lesson without a lead', state: 'planned', note: null }]);
    await h.asUser(staffUid);
    await h.q(`select save_lesson_plan($1, $2, $3::jsonb, null)`, [
      clientId, 'Get secure at the canter', JSON.stringify(objectives),
    ]);
    const all = await plans();
    expect(all.filter((p) => p.status === 'current')).toHaveLength(1);
    expect(all).toHaveLength(2);
  });

  it('a save that changes nothing writes no version — the history stays readable', async () => {
    const before = await currentPlan();
    await h.asUser(staffUid);
    await h.q(`select save_lesson_plan($1, $2, $3::jsonb, $4)`, [
      clientId, before.focus, JSON.stringify(before.objectives), before.coach_notes,
    ]);
    const after = await currentPlan();
    expect(after.version).toBe(before.version);
    expect(after.id).toBe(before.id);
  });

  it('a member cannot author a plan, and cannot write the table directly', async () => {
    await h.asUser(memberUid);
    await expect(h.q(`select save_lesson_plan($1,'mine','[]'::jsonb,null)`, [clientId]))
      .rejects.toThrow(/operator access required/i);
    await expect(h.q(
      `insert into lesson_plans (org_id, client_id, focus) values ($1,$2,'mine')`, [org, clientId]))
      .rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§2 — the day\'s lesson carries the plan', () => {
  let today: string;

  it('a lesson today shows the client\'s current plan, with no pinning and no copying', async () => {
    // "today" in the session's own timezone, which is what lesson_plans_for_day compares on
    const [{ d }] = await h.q<{ d: string }>(`select (current_date + interval '10 hours') as d`);
    today = new Date(d).toISOString();
    const bookingId = await makeLesson(today);

    await h.asUser(staffUid);
    const rows = await h.q<{ booking_id: string; focus: string; next_up: string; plan_version: number; progress_recorded: boolean }>(
      `select booking_id, focus, next_up, plan_version, progress_recorded from lesson_plans_for_day(null)`);
    const mine = rows.find((r) => r.booking_id === bookingId)!;
    expect(mine).toBeDefined();
    expect(mine.focus).toBe('Get secure at the canter');
    // "what comes next" is the first objective not yet achieved — derived from
    // the order, not stored
    expect(mine.next_up).toBe('Sitting trot without stirrups');
    expect(mine.progress_recorded).toBe(false);
  });

  it('booking_form() carries the plan in the same read as the form', async () => {
    const bookingId = await makeLesson(today);
    await h.asUser(staffUid);
    const [{ v }] = await h.q<{ v: { plan: { focus: string; version: number } | null; plan_pinned: boolean; plan_next_up: { label: string } } }>(
      `select booking_form($1) as v`, [bookingId]);
    expect(v.plan?.focus).toBe('Get secure at the canter');
    expect(v.plan_pinned).toBe(false);
    expect(v.plan_next_up.label).toBe('Sitting trot without stirrups');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§3 + §4 — THE LOOP: progress is recorded, the plan updates, the next lesson inherits it', () => {
  let lessonOne: string;
  let lessonTwo: string;
  let taughtVersion: number;
  let taughtPlanId: string;

  it('two lessons are booked for the same rider — one held, one still ahead', async () => {
    lessonOne = await makeLesson(past(1));
    lessonTwo = await makeLesson(future(6));
    await h.asUser(staffUid);
    const [{ v: before }] = await h.q<{ v: { plan: { version: number; focus: string } } }>(
      `select lesson_plan_for_booking($1) as v`, [lessonTwo]);
    // both lessons show the SAME plan right now — nothing has happened yet
    taughtVersion = before.plan.version;
    expect(before.plan.focus).toBe('Get secure at the canter');
  });

  it('recording progress writes the lesson up AND advances the plan', async () => {
    const p = await currentPlan();
    taughtPlanId = p.id;
    const sittingTrot = p.objectives[0];
    const canter = p.objectives[1];

    await h.asUser(staffUid);
    const [{ v }] = await h.q<{ v: { plan_advanced: boolean; taught_against: { version: number }; plan: { version: number; focus: string } } }>(
      `select record_lesson_progress($1, $2::jsonb, $3::jsonb, $4, $5, true) as v`, [
        lessonOne,
        JSON.stringify({
          attendance: 'attended',
          activities: ['Warm-up', 'Flatwork'],
          log_text: 'Tense in the first ten minutes, settled after the walk break.',
          report: 'Really solid work today — your sitting trot is coming together.',
        }),
        JSON.stringify([
          { id: sittingTrot.id, state: 'achieved', note: 'Held it for a full long side.' },
          { id: canter.id, state: 'working' },
          // something discovered in the lesson — a new objective with no id
          { label: 'Shorten and lengthen the trot', state: 'planned' },
        ]),
        'Canter transitions, then start pole work',
        null,
      ]);

    expect(v.plan_advanced).toBe(true);
    expect(v.taught_against.version).toBe(taughtVersion);
    expect(v.plan.version).toBe(taughtVersion + 1);
    expect(v.plan.focus).toBe('Canter transitions, then start pole work');
  });

  it('the record of what happened landed on the form, through the one writer', async () => {
    await h.asSuperuser();
    const [f] = await h.q<{ status: string; answers: Record<string, unknown>; plan_id: string }>(
      `select status, answers, plan_id from booking_forms where booking_id=$1`, [lessonOne]);
    expect(f.status).toBe('submitted');
    expect(f.answers.report).toMatch(/sitting trot is coming together/);
    expect(f.answers.plan_progress).toBeDefined();
    // …and LESSONFORM's projections still ran, so every surface that reads the
    // booking columns keeps working
    const [b] = await h.q<{ notes: string; activity_log: { activities: string[]; text: string } }>(
      `select notes, activity_log from bookings where id=$1`, [lessonOne]);
    expect(b.notes).toMatch(/sitting trot is coming together/);
    expect(b.activity_log.activities).toEqual(['Warm-up', 'Flatwork']);
    expect(b.activity_log.text).toMatch(/Tense in the first ten minutes/);
  });

  it('the held lesson is PINNED to the plan it was taught against — its history does not move', async () => {
    await h.asUser(staffUid);
    const [{ v }] = await h.q<{ v: { pinned: boolean; plan: { id: string; version: number } } }>(
      `select lesson_plan_for_booking($1) as v`, [lessonOne]);
    expect(v.pinned).toBe(true);
    expect(v.plan.id).toBe(taughtPlanId);
    expect(v.plan.version).toBe(taughtVersion);
  });

  it('THE LOOP CLOSES: the NEXT lesson shows the UPDATED plan', async () => {
    await h.asUser(staffUid);
    const [{ v }] = await h.q<{ v: { pinned: boolean; plan: { version: number; focus: string; objectives: { label: string; state: string }[] }; next_up: { label: string } } }>(
      `select lesson_plan_for_booking($1) as v`, [lessonTwo]);

    expect(v.pinned).toBe(false);
    expect(v.plan.version).toBe(taughtVersion + 1);
    expect(v.plan.focus).toBe('Canter transitions, then start pole work');

    // what was achieved is marked achieved and is no longer what comes next
    const achieved = v.plan.objectives.find((o) => o.label === 'Sitting trot without stirrups')!;
    expect(achieved.state).toBe('achieved');
    expect(v.next_up.label).toBe('Canter transitions on both leads');

    // and the thing discovered during the lesson is now on the plan
    expect(v.plan.objectives.some((o) => o.label === 'Shorten and lengthen the trot')).toBe(true);
  });

  it('§4 — the prior plan state is RETAINED and the change is LOGGED', async () => {
    const all = await plans();
    const prior = all.find((p) => p.id === taughtPlanId)!;
    expect(prior.status).toBe('superseded');
    // the retained version still says what it said when it was taught
    expect(prior.objectives.find((o) => o.label === 'Sitting trot without stirrups')!.state)
      .toBe('working');

    const advanced = all.find((p) => p.version === taughtVersion + 1)!;
    expect(advanced.supersedes_id).toBe(taughtPlanId);
    expect(advanced.advanced_from_booking_id).toBe(lessonOne);

    await h.asUser(staffUid);
    const [{ v }] = await h.q<{ v: { log: { code: string; detail: string }[]; versions: unknown[] } }>(
      `select client_lesson_plan($1) as v`, [clientId]);
    expect(v.versions.length).toBe(all.length);
    // D19 — the log is read back to a human, not only written
    expect(v.log.some((e) => e.code === 'advanced' && /Advanced after the Riding Lesson/.test(e.detail))).toBe(true);
    expect(v.log.some((e) => e.code === 'created')).toBe(true);
  });

  it('the lesson\'s own trail records that progress was written up', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ detail: string }>(
      `select detail from status_events
        where entity_type='offering' and entity_id=$1 and status='progress_recorded'`, [lessonOne]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].detail).toMatch(/the plan advanced to version/);
  });

  it('recording again with nothing changed does not manufacture a version', async () => {
    const before = await currentPlan();
    await h.asUser(staffUid);
    const [{ v }] = await h.q<{ v: { plan_advanced: boolean } }>(
      `select record_lesson_progress($1, '{}'::jsonb, '[]'::jsonb, null, null, true) as v`, [lessonOne]);
    expect(v.plan_advanced).toBe(false);
    expect((await currentPlan()).id).toBe(before.id);
  });

  it('re-saving a lesson that was ALREADY recorded, with the same outcomes, is a no-op', async () => {
    // The form restores its own answers, so this is what a second click of
    // "Record progress" actually sends. Advancing from the PINNED plan here
    // would re-derive a version the plan has already moved past, every time.
    await h.asSuperuser();
    const [f] = await h.q<{ answers: { plan_progress: unknown[] } }>(
      `select answers from booking_forms where booking_id=$1`, [lessonOne]);
    const before = await currentPlan();

    await h.asUser(staffUid);
    const [{ v }] = await h.q<{ v: { plan_advanced: boolean } }>(
      `select record_lesson_progress($1, '{}'::jsonb, $2::jsonb, $3, null, true) as v`,
      [lessonOne, JSON.stringify(f.answers.plan_progress), before.focus]);
    expect(v.plan_advanced).toBe(false);
    expect((await currentPlan()).id).toBe(before.id);
  });

  it('…and a hand edit made after the lesson is not clobbered by re-saving it', async () => {
    await h.asUser(staffUid);
    const cur = await currentPlan();
    await h.asUser(staffUid);
    await h.q(`select save_lesson_plan($1, $2, $3::jsonb, null)`,
      [clientId, 'Hand-edited focus', JSON.stringify(cur.objectives)]);

    await h.asSuperuser();
    const [f] = await h.q<{ answers: { plan_progress: unknown[] } }>(
      `select answers from booking_forms where booking_id=$1`, [lessonOne]);

    await h.asUser(staffUid);
    await h.q(`select record_lesson_progress($1, '{}'::jsonb, $2::jsonb, null, null, true)`,
      [lessonOne, JSON.stringify(f.answers.plan_progress)]);

    expect((await currentPlan()).focus).toBe('Hand-edited focus');
  });

  it('an earlier version can be restored, and the restore is itself a new version', async () => {
    const all = await plans();
    const v1 = all.find((p) => p.version === 1)!;
    await h.asUser(staffUid);
    await h.q(`select restore_lesson_plan_version($1)`, [v1.id]);

    const now = await currentPlan();
    expect(now.focus).toBe(v1.focus);
    expect(now.version).toBeGreaterThan(all[all.length - 1].version);
    // nothing was resurrected or deleted — the intervening versions are all there
    expect((await plans()).length).toBe(all.length + 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§5 — everyone sees what makes sense for them', () => {
  it('the rider sees their own plan', async () => {
    await h.asUser(memberUid);
    const [{ v }] = await h.q<{ v: { focus: string; objectives: unknown[]; next_up: { label: string } } | null }>(
      `select my_lesson_plan() as v`);
    expect(v).not.toBeNull();
    expect(v!.objectives.length).toBeGreaterThan(0);
    expect(v!.next_up).toBeDefined();
  });

  it('cannot read the plans table directly at all — the private notes are a COLUMN', async () => {
    await h.asUser(memberUid);
    const rows = await h.q(`select id from lesson_plans where client_id = $1`, [clientId]);
    expect(rows).toHaveLength(0);
  });

  it('and NEVER the staff-private coach notes', async () => {
    // the notes are really there
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from lesson_plans
        where client_id=$1 and coach_notes ilike '%Nervous after the fall%'`, [clientId]);
    expect(n).toBeGreaterThan(0);

    await h.asUser(memberUid);
    const [{ v }] = await h.q<{ v: Record<string, unknown> }>(`select my_lesson_plan() as v`);
    expect(v.coach_notes).toBeNull();
    expect(JSON.stringify(v)).not.toMatch(/Nervous after the fall/);
  });

  it('a rider\'s lesson report carries the plan but not the instructor\'s own log', async () => {
    await h.asSuperuser();
    const [{ id }] = await h.q<{ id: string }>(
      `select id from bookings where client_id=$1 and starts_at < now() order by starts_at limit 1`, [clientId]);

    await h.asUser(memberUid);
    const [{ v }] = await h.q<{ v: { plan: Record<string, unknown>; activity_log: { text: string | null }; report: string } }>(
      `select booking_report($1) as v`, [id]);
    expect(v.plan).not.toBeNull();
    expect(v.plan.coach_notes).toBeNull();
    expect(v.activity_log.text).toBeNull();        // staff lane withheld
    expect(v.report).toMatch(/sitting trot is coming together/); // rider lane kept
  });

  it('a different member sees nothing of this rider\'s plan', async () => {
    await h.asUser(otherUid);
    const [{ v }] = await h.q<{ v: unknown }>(`select my_lesson_plan() as v`);
    expect(v).toBeNull();
    await expect(h.q(`select client_lesson_plan($1)`, [clientId]))
      .rejects.toThrow(/operator access required/i);
  });

  it('the activity log lists what happened, and withholds the staff lane from the rider', async () => {
    await h.asUser(staffUid);
    const staffRows = await h.q<{ booking_id: string; report: string; log_text: string | null; plan_version: number | null }>(
      `select booking_id, report, log_text, plan_version from lesson_activity($1, null, 100)`, [clientId]);
    expect(staffRows.length).toBeGreaterThan(0);
    expect(staffRows[0].log_text).toMatch(/Tense in the first ten minutes/);
    expect(staffRows[0].plan_version).toBeGreaterThan(0);

    await h.asUser(memberUid);
    const riderRows = await h.q<{ booking_id: string; report: string; log_text: string | null }>(
      `select booking_id, report, log_text from lesson_activity(null, null, 100)`);
    expect(riderRows.length).toBeGreaterThan(0);
    expect(riderRows.every((r) => r.log_text === null)).toBe(true);
    expect(riderRows[0].report).toMatch(/sitting trot is coming together/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('THE REACH (D17) — the roster in front of the editor', () => {
  it('lists riders WITH a plan and riders with NONE — the second is the question it is opened on', async () => {
    // a rider with a Riding Lesson on the books and no plan: exactly the row
    // this list exists to surface, so it is created here rather than relied on
    await h.asSuperuser();
    const c = (await h.q<{ id: string }>(
      `insert into contacts (org_id, first_name, last_name, email)
         values ($1,'Roster','Newcomer','lessonplan-roster@test.fhe') returning id`, [org]))[0].id;
    const cl = (await h.q<{ id: string }>(
      `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, c]))[0].id;
    await h.q(
      `insert into bookings (org_id, status, kind, starts_at, ends_at, client_id, offering_id)
         values ($1,'scheduled','lesson',$2,$3,$4,$5)`,
      [org, future(3), future(3), cl, offeringId]);

    await h.asUser(staffUid);
    const rows = await h.q<{ client_id: string; plan_id: string | null; focus: string | null; next_up: string | null }>(
      `select client_id, plan_id, focus, next_up from lesson_plan_roster()`);
    const mine = rows.find((r) => r.client_id === clientId)!;
    expect(mine.plan_id).not.toBeNull();
    expect(rows.some((r) => r.plan_id === null)).toBe(true);
  });

  it('a member cannot read the roster at all', async () => {
    await h.asUser(memberUid);
    const rows = await h.q(`select client_id from lesson_plan_roster()`);
    expect(rows).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§3 — photos on a lesson, and who can see them', () => {
  let lessonId: string;
  let fileId: string;

  it('an org file linked to a rider\'s lesson is visible to THAT rider', async () => {
    await h.asSuperuser();
    [{ id: lessonId }] = await h.q<{ id: string }>(
      `select id from bookings where client_id=$1 order by starts_at limit 1`, [clientId]);
    // the path grammar files_path_grammar enforces: {org}/{owner_kind}/{owner}/…
    const path = `${org}/org/${org}/lessonplan-photo.jpg`;
    fileId = (await h.q<{ id: string }>(
      `insert into files (org_id, owner_kind, owner_contact_id, bucket_id, storage_path,
                          filename, mime_type)
       values ($1,'org',null,'facility-files',$2,'lessonplan-photo.jpg','image/jpeg')
       returning id`, [org, path]))[0].id;
    await h.q(`insert into file_links (org_id, file_id, subject_type, subject_id)
                 values ($1,$2,'booking',$3)`, [org, fileId, lessonId]);

    await h.asUser(memberUid);
    const seen = await h.q<{ id: string }>(`select id from files where id=$1`, [fileId]);
    expect(seen).toHaveLength(1);
    const media = await h.q<{ file_id: string }>(`select file_id from lesson_media($1)`, [lessonId]);
    expect(media.map((m) => m.file_id)).toContain(fileId);
  });

  it('…and to nobody else', async () => {
    await h.asUser(otherUid);
    expect(await h.q(`select id from files where id=$1`, [fileId])).toHaveLength(0);
    expect(await h.q(`select file_id from lesson_media($1)`, [lessonId])).toHaveLength(0);
  });

  it('a scrubbed photo is gone from the system, not hidden behind a flag', async () => {
    await h.asUser(staffUid);
    const [{ v }] = await h.q<{ v: { scrubbed: number; storage_path: string } }>(
      `select scrub_lesson_content('media', $1, 'Another client is in the frame') as v`, [fileId]);
    expect(v.scrubbed).toBe(1);
    expect(v.storage_path).toMatch(/lessonplan-photo/);

    await h.asSuperuser();
    expect(await h.q(`select id from files where id=$1`, [fileId])).toHaveLength(0);
    expect(await h.q(`select id from file_links where file_id=$1`, [fileId])).toHaveLength(0);
    // and the reason survives even though the content does not
    const log = await h.q<{ detail: string }>(
      `select detail from status_events
        where entity_type='offering' and entity_id=$1 and detail ilike '%Media scrubbed%'`, [lessonId]);
    expect(log[0].detail).toMatch(/Another client is in the frame/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§7 — a mistaken entry is corrected, or scrubbed', () => {
  let bookingId: string;

  it('a text answer can be scrubbed, and it leaves the projection too', async () => {
    await h.asSuperuser();
    [{ id: bookingId }] = await h.q<{ id: string }>(
      `select id from bookings where client_id=$1 and starts_at < now() order by starts_at limit 1`, [clientId]);

    await h.asUser(staffUid);
    await h.q(`select scrub_lesson_content('answer', $1, $2, 'report')`,
      [bookingId, 'Pasted the wrong rider’s note']);

    await h.asSuperuser();
    const [f] = await h.q<{ answers: Record<string, unknown> }>(
      `select answers from booking_forms where booking_id=$1`, [bookingId]);
    expect(f.answers.report).toBeUndefined();
    const [b] = await h.q<{ notes: string | null }>(`select notes from bookings where id=$1`, [bookingId]);
    expect(b.notes).toBeNull();
  });

  it('a scrub without a reason is refused — the reason is all that is left', async () => {
    await h.asUser(staffUid);
    await expect(h.q(`select scrub_lesson_content('answer', $1, '  ', 'log_text')`, [bookingId]))
      .rejects.toThrow(/needs a reason/i);
  });

  it('the scrub is logged, and the log carries the reason and not the content', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ detail: string }>(
      `select detail from status_events
        where entity_type='offering' and entity_id=$1
          and detail ilike '%Field "report" scrubbed%'`, [bookingId]);
    expect(rows.length).toBe(1);
    expect(rows[0].detail).toMatch(/Pasted the wrong rider/);
    // the reason survives; the content does not appear anywhere in the log
    expect(rows[0].detail).not.toMatch(/sitting trot is coming together/);
  });

  it('a member cannot scrub anything', async () => {
    await h.asUser(memberUid);
    await expect(h.q(`select scrub_lesson_content('answer', $1, 'because', 'log_text')`, [bookingId]))
      .rejects.toThrow(/operator access required/i);
  });

  it('an objective note is scrubbed out of EVERY retained version, not just the current one', async () => {
    // the note written during the lesson is sitting in the superseded versions
    await h.asSuperuser();
    const [{ n: before }] = await h.q<{ n: number }>(
      `select count(*)::int as n from lesson_plans
        where client_id=$1 and objectives::text ilike '%Held it for a full long side%'`, [clientId]);
    expect(before).toBeGreaterThan(0);

    const cur = await currentPlan();
    const target = cur.objectives.find((o) => o.label === 'Sitting trot without stirrups')!;

    await h.asUser(staffUid);
    await h.q(`select scrub_lesson_content('objective_note', $1, $2, $3)`,
      [cur.id, 'Named another client in the note', target.id]);

    await h.asSuperuser();
    const [{ n: after }] = await h.q<{ n: number }>(
      `select count(*)::int as n from lesson_plans
        where client_id=$1 and objectives::text ilike '%Held it for a full long side%'`, [clientId]);
    expect(after).toBe(0);
    // the objective itself survives — only the note was destroyed
    const still = await currentPlan();
    expect(still.objectives.some((o) => o.label === 'Sitting trot without stirrups')).toBe(true);
  });

  it('records stay editable forever — nothing here locks a past lesson (D27)', async () => {
    await h.asUser(staffUid);
    await h.q(`select save_booking_form($1, $2::jsonb, false)`,
      [bookingId, JSON.stringify({ report: 'Corrected write-up.' })]);
    await h.asSuperuser();
    const [b] = await h.q<{ notes: string }>(`select notes from bookings where id=$1`, [bookingId]);
    expect(b.notes).toBe('Corrected write-up.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the edges', () => {
  it('recording progress against a client with no plan refuses outcomes rather than inventing one', async () => {
    await h.asSuperuser();
    const otherContact = (await h.q<{ id: string }>(
      `insert into contacts (org_id, first_name, last_name, email)
         values ($1,'Planless','Rider','lessonplan-planless@test.fhe') returning id`, [org]))[0].id;
    const otherClient = (await h.q<{ id: string }>(
      `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, otherContact]))[0].id;
    const endsAt = new Date(Date.now() - 23 * HOUR).toISOString();
    const b = (await h.q<{ id: string }>(
      `insert into bookings (org_id, status, kind, starts_at, ends_at, client_id, offering_id)
         values ($1,'scheduled','lesson',$2,$3,$4,$5) returning id`,
      [org, past(1), endsAt, otherClient, offeringId]))[0].id;

    await h.asUser(staffUid);
    await expect(h.q(
      `select record_lesson_progress($1,'{}'::jsonb,$2::jsonb,null,null,true)`,
      [b, JSON.stringify([{ id: 'nope', state: 'achieved' }])]))
      .rejects.toThrow(/no lesson plan yet/i);

    // …but a bare "here is where this rider is going" starts the plan
    await h.q(`select record_lesson_progress($1,'{}'::jsonb,'[]'::jsonb,$2,null,true)`,
      [b, 'Find out where she is — start with flatwork']);
    await h.asSuperuser();
    const [p] = await h.q<{ version: number; focus: string }>(
      `select version, focus from lesson_plans where client_id=$1 and status='current'`, [otherClient]);
    expect(p.version).toBe(1);
    expect(p.focus).toBe('Find out where she is — start with flatwork');
  });

  it('an unknown objective state is refused rather than stored', async () => {
    await h.asUser(staffUid);
    await expect(h.q(`select save_lesson_plan($1,'x',$2::jsonb,null)`,
      [clientId, JSON.stringify([{ label: 'Something', state: 'nearly' }])]))
      .rejects.toThrow(/unknown objective state/i);
  });

  it('a blank objective line is dropped, not stored as an empty row', async () => {
    await h.asUser(staffUid);
    await h.q(`select save_lesson_plan($1,'Tidy',$2::jsonb,null)`, [
      clientId, JSON.stringify([{ label: 'Real one' }, { label: '   ' }, { label: '' }]),
    ]);
    expect((await currentPlan()).objectives).toHaveLength(1);
  });

  it('the day view and the form backlog agree about which lessons are real', async () => {
    const cancelled = await makeLesson(new Date().toISOString());
    await h.asSuperuser();
    await h.q(`update bookings set status='cancelled' where id=$1`, [cancelled]);
    await h.asUser(staffUid);
    const rows = await h.q<{ booking_id: string }>(`select booking_id from lesson_plans_for_day(null)`);
    expect(rows.some((r) => r.booking_id === cancelled)).toBe(false);
  });
});
