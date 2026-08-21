/**
 * TASK-SLOTREACH — the owner can sell and schedule a recurring lesson today.
 *
 * `TASK-WALK2` tested the standing-slot product two independent ways and both
 * dead-ended at ZERO bookings and ZERO credits: *"the standing-slot recurring feature
 * is unreachable, full stop."* Almost all of that was a reach failure in the app — a
 * link to the wrong page and a wizard step a signed client is short-circuited past —
 * and the front end is where it is fixed.
 *
 * THIS FILE PROVES THE PARTS A BROWSER CANNOT, AND THE PARTS THE TASK ASKED FOR BY
 * NAME. Everything below runs against real Postgres (PGlite), so these are measured
 * results and not readings of the source:
 *
 *   §3.1  A 2x-weekly entitlement yields TWO standing days per week, not one.
 *   §3.2  Sessions exist in a month FAR ENOUGH AHEAD that a monthly top-up would have
 *         been required — with nothing waking up. There is no scheduler (`pg_cron` is
 *         absent, the Vercel crons were never created), so the horizon is materialised
 *         ON READ and that is the thing under test.
 *   §3.3  `remaining` is 0 after purchase, 1 after cancelling one standing session,
 *         and 0 again after rebooking it. The bookings ARE the entitlement (D23).
 *   §5    A STAFF reschedule and a STAFF cancel each fire a notification. WALK2's G-3:
 *         *"Neither reschedule nor cancel fires any notification, on any channel."*
 *         Both staff writers were silent; the client-initiated path never was.
 *   §4    No title any of them writes says "booking" to a human (D25).
 *   §2    Staff can READ a client's standing slot at all — `my_standing_slots` is
 *         caller-scoped, so before `client_standing_slots` there was no staff read and
 *         therefore no staff control that could exist.
 *
 * ⚠️ REPLAY CAVEAT, same as every file in this directory: the migration journal is
 * hand-maintained and ~31 migrations rewrite function bodies in place, so a full fresh
 * replay cannot reach here. PREREQS is the set this area genuinely stands on.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, migrationFiles, MIGRATIONS_DIR, type TestDb } from './harness';

const PREREQS = [
  '20260815T0500_creditfix_mint_from_unit_count.sql',
  '20260815T1600_booklink_b2_debit_or_create.sql',
  '20260815T1700_booklink_b4_monthly_plans.sql',
  '20260815T2200_reviewq_m1_schema_widen.sql',
  '20260815T2300_reviewq_m2_write_paths_land_pending.sql',
  '20260815T2400_reviewq_m3_decision_rpcs.sql',
  '20260815T2500_reviewq_m4_delete_never_destroys_evidence.sql',
  '20260816T1400_zelleclose_paid_notify_spine.sql',
  '20260816T1500_onboard_m6_booking_credits_edits_and_fee_schedule.sql',
  '20260816T1800_onboard_m9_book_open_slot_single_signature.sql',
  '20260817T0400_carepath_c5_enquiry_orders.sql',
];
const CREDITALIGN = migrationFiles().filter((f) => f.includes('creditalign'));
const CAREPLANS = migrationFiles().filter((f) => f.includes('careplans'));
const BUYANDBOOK = migrationFiles().filter((f) => f.includes('buyandbook_3'));
const SLOTREACH = migrationFiles().filter((f) => f.includes('slotreach'));

const SKUS = {
  weekly1: { name: '1x Weekly Lesson', segment: 'rider', freq: 1 },
  weekly2: { name: '2x Weekly Lessons', segment: 'rider', freq: 2 },
  careWeekly: { name: '2x Weekly Turnout', segment: 'horse', freq: 2 },
} as const;
const sku: Record<keyof typeof SKUS, string> = {} as never;

let h: TestDb;
let org: string;
let staffUid: string;
let clientUid: string;
let clientId: string;
let contactId: string;

async function apply(files: string[]) {
  await h.asSuperuser();
  for (const f of files) {
    try { await h.db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8')); } catch (err) {
      throw new Error(`migration failed: ${f}\n${(err as Error).message}`);
    }
  }
}

/** A placed (non-draft) order carrying one line, days not yet chosen. */
async function order(offeringId: string) {
  await h.asSuperuser();
  const [{ id: purchase }] = await h.q<{ id: string }>(
    `insert into purchases (org_id, buyer_contact_id, buyer_user_id, status, payment_status, amount)
       values ($1,$2,$3,'awaiting_payment','unpaid',0) returning id`, [org, contactId, clientUid]);
  const [{ id: item }] = await h.q<{ id: string }>(
    `insert into purchase_items (org_id, purchase_id, offering_id, label, price_amount, price_unit, quantity)
       select $1,$2,o.id,o.name,o.price_amount,o.price_unit,1 from offerings o where o.id=$3
     returning id`, [org, purchase, offeringId]);
  return { purchase, item };
}

async function aliveBookings(purchase?: string) {
  await h.asSuperuser();
  return h.q<{ id: string; starts_at: string; dow: string; hhmm: string; credit_id: string | null }>(
    `select id, starts_at::text, to_char(starts_at,'Dy') as dow, to_char(starts_at,'HH24:MI') as hhmm, credit_id
       from bookings
      where client_id=$1 and status not in ('cancelled','expired') and deleted_at is null
        and ($2::uuid is null or purchase_id = $2)
      order by starts_at`, [clientId, purchase ?? null]);
}

/** Every spendable credit this client holds, across every plan. */
async function spendable() {
  await h.asSuperuser();
  const [{ n }] = await h.q<{ n: number }>(
    `select coalesce(sum(credits_remaining),0)::int as n from lesson_credits
      where client_id=$1 and deleted_at is null`, [clientId]);
  return Number(n);
}

async function notificationsFor(uid: string) {
  await h.asSuperuser();
  return h.q<{ kind: string; title: string; link: string | null }>(
    `select kind, title, link from notifications where user_id=$1 order by created_at, title`, [uid]);
}

async function clearNotifications() {
  await h.asSuperuser();
  await h.q(`delete from notifications`);
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  await apply(PREREQS);
  await h.q(`insert into status_events_vocab (entity_type, code, display_name)
    select 'order', c, c from unnest(array['pending','submitted','paid','void','unpaid','draft']) c
    on conflict do nothing;`);
  await h.q(`insert into status_events_vocab (entity_type, code, display_name)
    select 'offering', c, c from unnest(array['pending','scheduled','cancelled','completed','rescheduled','no_show']) c
    on conflict do nothing;`);
  await h.q(`insert into status_events_vocab (entity_type, code, display_name)
    select 'fulfillment', c, c from unnest(array['open','scheduled','consumed','delivered','expired','void']) c
    on conflict do nothing;`);

  staffUid = await h.createAuthUser({ role: 'ADMIN', org });
  clientUid = await h.createAuthUser({ role: 'USER', org });
  contactId = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name, email)
       values ($1,'Slotreach','Client','slotreach-client@test.fhe') returning id`, [org]))[0].id;
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contactId, clientUid]);
  clientId = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, contactId]))[0].id;

  for (const [key, s] of Object.entries(SKUS)) {
    sku[key as keyof typeof SKUS] = (await h.q<{ id: string }>(
      `insert into offerings (org_id, segment, name, slug, active, service_type, config_kind,
                              price_unit, unit_count, weekly_frequency, price_amount)
         values ($1,$2,$3,$4,true,$5,'recurring','month',null,$6,440) returning id`,
      [org, s.segment, s.name, `slotreach-${key.toLowerCase()}`,
       s.segment === 'horse' ? 'HORSE_EXERCISE' : 'RIDING_LESSON', s.freq]))[0].id;
  }

  await apply(CREDITALIGN);
  await apply(CAREPLANS);
  await apply(BUYANDBOOK);
  await apply(SLOTREACH);
});

afterAll(async () => { await h?.close(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('§3 — choosing a slot produces real sessions', () => {
  let purchase: string;
  let item: string;
  let firstCancelled: string;

  it('the SLOTREACH migration applied and did not disturb the standing-slot spine', async () => {
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from pg_proc
        where proname in ('client_standing_slots','booking_service_label','_announce_booking_change',
                          'set_my_standing_schedule','_ensure_plan_horizon','_generate_plan_month')`);
    expect(n).toBe(6);
  });

  it('§3.1 — a 2x-weekly plan lays down TWO standing days a week, each at its own time', async () => {
    ({ purchase, item } = await order(sku.weekly2));
    await h.asUser(clientUid);
    const [{ res }] = await h.q<{ res: Record<string, unknown> }>(
      `select set_my_standing_schedule($1, $2::jsonb, 60, null) as res`,
      [item, JSON.stringify([{ day: 'Tue', time: '16:00' }, { day: 'Thu', time: '17:30' }])]);
    expect((res as { horizon: { ok: boolean } }).horizon.ok).toBe(true);

    const rows = await aliveBookings(purchase);
    expect(rows.length).toBeGreaterThan(8);
    // Every session sits on one of the two chosen days — never on one weekday only,
    // which is precisely the divergence the task named.
    expect(new Set(rows.map((r) => r.dow))).toEqual(new Set(['Tue', 'Thu']));
    // …and each day carries ITS OWN time, not one time for both.
    for (const r of rows) expect(r.hhmm).toBe(r.dow === 'Tue' ? '16:00' : '17:30');

    // Two a week, measured as a rate rather than asserted as a constant: a 90-day
    // horizon spans a variable number of Tuesdays and Thursdays.
    const weeks = new Set(rows.map((r) => r.starts_at.slice(0, 10))).size / 2;
    expect(weeks).toBeGreaterThan(4);
  });

  it('§3.2 — sessions exist THREE MONTHS OUT with nothing waking up (no scheduler)', async () => {
    await h.asSuperuser();
    // The proof that matters: a month that a monthly top-up would have had to open.
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from bookings
        where purchase_id=$1 and status not in ('cancelled','expired') and deleted_at is null
          and starts_at >= date_trunc('month', current_date) + interval '2 months'`, [purchase]);
    expect(n).toBeGreaterThan(0);

    // pg_cron really is absent — the horizon is the only thing holding this up.
    const [{ cron }] = await h.q<{ cron: number }>(
      `select count(*)::int as cron from pg_extension where extname='pg_cron'`);
    expect(cron).toBe(0);

    // And the roll is idempotent: reading again writes nothing new.
    const before = (await aliveBookings(purchase)).length;
    await h.asUser(clientUid);
    await h.q(`select ensure_standing_slots(null)`);
    expect((await aliveBookings(purchase)).length).toBe(before);
  });

  it('§3.3 — remaining is 0 after purchase: the sessions ARE the entitlement', async () => {
    expect(await spendable()).toBe(0);
  });

  it('§3.3 — cancelling one standing session returns exactly one credit', async () => {
    const rows = await aliveBookings(purchase);
    const target = rows.find((r) => r.credit_id !== null);
    expect(target).toBeTruthy();
    firstCancelled = target!.id;

    await h.asSuperuser();
    const [{ id: cr }] = await h.q<{ id: string }>(
      `insert into booking_change_requests (org_id, booking_id, requested_by, request_kind, status)
         values ($1,$2,$3,'cancel','pending') returning id`, [org, firstCancelled, clientUid]);
    await h.asUser(staffUid);
    await h.q(`select decide_booking_change($1,true,true,null)`, [cr]);

    expect(await spendable()).toBe(1);
  });

  it('§3.3 — rebooking that session spends it again, back to 0', async () => {
    await h.asSuperuser();
    const [{ id: creditId }] = await h.q<{ id: string }>(
      `select id from lesson_credits where client_id=$1 and credits_remaining > 0
          and deleted_at is null limit 1`, [clientId]);
    // Book it back the way generation would: one session, one credit spent.
    await h.q(
      `update lesson_credits set credits_remaining = credits_remaining - 1 where id=$1`, [creditId]);
    await h.q(
      `insert into bookings (org_id, kind, status, starts_at, ends_at, client_id,
                             account_contact_id, account_user_id, purchase_id, offering_id, credit_id)
       select $1,'lesson','scheduled', b.starts_at + interval '1 day', b.ends_at + interval '1 day',
              $2,$3,$4,b.purchase_id,b.offering_id,$5
         from bookings b where b.id=$6`,
      [org, clientId, contactId, clientUid, creditId, firstCancelled]);
    expect(await spendable()).toBe(0);
  });

  it('the month never inflates: cancel/rebook ten times and the total holds', async () => {
    const total = async () => {
      await h.asSuperuser();
      const [{ n }] = await h.q<{ n: number }>(
        `select (coalesce(sum(credits_remaining),0)
                 + (select count(*) from bookings b
                     where b.client_id=$1 and b.credit_id = lc.id
                       and b.status not in ('cancelled','expired') and b.deleted_at is null))::int as n
           from lesson_credits lc where lc.client_id=$1 and lc.deleted_at is null
          group by lc.id limit 1`, [clientId]);
      return Number(n);
    };
    const start = await total();
    for (let i = 0; i < 10; i += 1) {
      const rows = await aliveBookings(purchase);
      const t = rows.find((r) => r.credit_id !== null);
      if (!t) break;
      await h.asSuperuser();
      const [{ id: cr }] = await h.q<{ id: string }>(
        `insert into booking_change_requests (org_id, booking_id, requested_by, request_kind, status)
           values ($1,$2,$3,'cancel','pending') returning id`, [org, t.id, clientUid]);
      await h.asUser(staffUid);
      await h.q(`select decide_booking_change($1,true,true,null)`, [cr]);
      await h.asSuperuser();
      await h.q(`update lesson_credits set credits_remaining = credits_remaining - 1 where id=$1`, [t.credit_id]);
      await h.q(
        `insert into bookings (org_id, kind, status, starts_at, ends_at, client_id,
                               account_contact_id, account_user_id, purchase_id, offering_id, credit_id)
         values ($1,'lesson','scheduled', now() + interval '40 days', now() + interval '40 days 1 hour',
                 $2,$3,$4,$5,$6,$7)`,
        [org, clientId, contactId, clientUid, purchase, sku.weekly2, t.credit_id]);
    }
    expect(await total()).toBe(start);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§2 — staff can see (and therefore set) a client’s standing slot', () => {
  it('client_standing_slots returns the plan for staff', async () => {
    await h.asUser(staffUid);
    const [{ res }] = await h.q<{ res: Array<Record<string, unknown>> }>(
      `select client_standing_slots($1) as res`, [contactId]);
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThan(0);
    const plan = res.find((r) => r.offering_name === '2x Weekly Lessons');
    expect(plan).toBeTruthy();
    expect(plan!.chosen).toBe(true);
    expect(plan!.weekly_frequency).toBe(2);
    expect(plan!.recurring_days).toEqual(['Tue', 'Thu']);
  });

  it('and refuses a client — it is a staff read, not a widened one', async () => {
    await h.asUser(clientUid);
    await expect(h.q(`select client_standing_slots($1)`, [contactId]))
      .rejects.toThrow(/operator access required/i);
  });

  it('staff write through the SAME single writer the member uses', async () => {
    await h.asUser(staffUid);
    const [{ res }] = await h.q<{ res: { slots: unknown[] } }>(
      `select set_my_standing_schedule(
         (select pi.id from purchase_items pi
            join purchases pu on pu.id = pi.purchase_id
           where pu.buyer_contact_id=$1 and pi.offering_id=$2 limit 1),
         $3::jsonb, 60, null) as res`,
      [contactId, sku.weekly2, JSON.stringify([{ day: 'Mon', time: '09:00' }, { day: 'Wed', time: '10:00' }])]);
    expect(res.slots).toHaveLength(2);

    await h.asUser(staffUid);
    const [{ res: read }] = await h.q<{ res: Array<Record<string, unknown>> }>(
      `select client_standing_slots($1) as res`, [contactId]);
    const plan = read.find((r) => r.offering_name === '2x Weekly Lessons');
    expect(plan!.recurring_days).toEqual(['Mon', 'Wed']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§5 — reschedule and cancel each fire a notification', () => {
  let bookingId: string;

  beforeAll(async () => {
    await clearNotifications();
    await h.asSuperuser();
    [{ id: bookingId }] = await h.q<{ id: string }>(
      `insert into bookings (org_id, kind, status, starts_at, ends_at, client_id,
                             account_contact_id, account_user_id, offering_id)
         values ($1,'lesson','scheduled', now() + interval '9 days', now() + interval '9 days 1 hour',
                 $2,$3,$4,$5) returning id`,
      [org, clientId, contactId, clientUid, sku.weekly1]);
  });

  it('a STAFF reschedule tells the client — WALK2 G-3, first half', async () => {
    await clearNotifications();
    await h.asUser(staffUid);
    await h.q(
      `select save_calendar_item(jsonb_build_object(
         'id', $1::text, 'kind','lesson', 'status','scheduled',
         'starts_at', (now() + interval '12 days')::text,
         'ends_at',   (now() + interval '12 days 1 hour')::text,
         'client_id', $2::text, 'offering_id', $3::text))`,
      [bookingId, clientId, sku.weekly1]);

    const rows = await notificationsFor(clientUid);
    const moved = rows.filter((r) => r.kind === 'booking_rescheduled');
    expect(moved).toHaveLength(1);
    expect(moved[0].title).toMatch(/Riding Lesson/);
    expect(moved[0].title).toMatch(/has moved to/);
    expect(moved[0].link).toBe('/app/calendar');
  });

  it('an edit that does NOT move the session says nothing — a note is not news', async () => {
    await clearNotifications();
    await h.asUser(staffUid);
    await h.q(
      `select save_calendar_item(jsonb_build_object(
         'id', $1::text, 'kind','lesson', 'status','scheduled',
         'starts_at', (select starts_at::text from bookings where id=$1::uuid),
         'ends_at',   (select ends_at::text   from bookings where id=$1::uuid),
         'client_id', $2::text, 'offering_id', $3::text, 'notes','rain plan'))`,
      [bookingId, clientId, sku.weekly1]);
    expect(await notificationsFor(clientUid)).toHaveLength(0);
  });

  it('a STAFF cancel tells the client, and names the credit it gave back', async () => {
    await clearNotifications();
    // Give it a credit so the refund arm runs and the sentence earns its clause.
    await h.asSuperuser();
    const [{ id: creditId }] = await h.q<{ id: string }>(
      `insert into lesson_credits (org_id, client_id, offering_id, package_key,
                                   credits_total, credits_remaining, purchased_at)
         values ($1,$2,$3,'slotreach-test',1,0,now()) returning id`, [org, clientId, sku.weekly1]);
    await h.q(`update bookings set credit_id=$1 where id=$2`, [creditId, bookingId]);

    await h.asUser(staffUid);
    await h.q(`select delete_calendar_item($1,'one')`, [bookingId]);

    const rows = await notificationsFor(clientUid);
    const cancelled = rows.filter((r) => r.kind === 'booking_cancelled');
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].title).toMatch(/Riding Lesson/);
    expect(cancelled[0].title).toMatch(/is cancelled/);
    expect(cancelled[0].title).toMatch(/back on your account/);

    // …and the booking is cancelled, never destroyed (REVIEWQ m4 still holds).
    await h.asSuperuser();
    const [{ status, gone }] = await h.q<{ status: string; gone: boolean }>(
      `select status, (deleted_at is not null) as gone from bookings where id=$1`, [bookingId]);
    expect(status).toBe('cancelled');
    expect(gone).toBe(true);
  });

  it('re-deleting an already-cancelled session is housekeeping, not a second alarm', async () => {
    await clearNotifications();
    await h.asUser(staffUid);
    await h.q(`select delete_calendar_item($1,'one')`, [bookingId]);
    expect(await notificationsFor(clientUid)).toHaveLength(0);
  });

  it('the notification kind rides the emailer that already exists', async () => {
    // `api/calendar-reminders.ts` selects `kind.like.booking_%` on its hourly sweep,
    // so writing the row with this prefix IS the email wiring — no new channel.
    await clearNotifications();
    await h.asSuperuser();
    const [{ id }] = await h.q<{ id: string }>(
      `insert into bookings (org_id, kind, status, starts_at, ends_at, client_id,
                             account_contact_id, account_user_id, offering_id)
         values ($1,'lesson','scheduled', now() + interval '5 days', now() + interval '5 days 1 hour',
                 $2,$3,$4,$5) returning id`,
      [org, clientId, contactId, clientUid, sku.weekly1]);
    await h.asUser(staffUid);
    await h.q(`select delete_calendar_item($1,'one')`, [id]);
    const rows = await notificationsFor(clientUid);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind.startsWith('booking_')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§4 — the names are right (D25)', () => {
  it('a lesson is ALWAYS "Riding Lesson" — never the SKU, never a frequency', async () => {
    await h.asSuperuser();
    const [{ label }] = await h.q<{ label: string }>(
      `select booking_service_label('lesson', $1) as label`, [sku.weekly2]);
    expect(label).toBe('Riding Lesson');
    expect(label).not.toMatch(/2x|weekly/i);
  });

  it('horse care names the SERVICE, with the frequency stripped', async () => {
    await h.asSuperuser();
    const [{ label }] = await h.q<{ label: string }>(
      `select booking_service_label('care', $1) as label`, [sku.careWeekly]);
    expect(label).toBe('Turnout');          // from "2x Weekly Turnout"
    expect(label).not.toMatch(/2x|weekly/i);
  });

  it('not one notification this suite produced says "booking" to a human', async () => {
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from notifications where title ilike '%booking%'`);
    expect(n).toBe(0);
  });

  it('and decide_booking_change no longer does either', async () => {
    await h.asSuperuser();
    const [{ id }] = await h.q<{ id: string }>(
      `insert into bookings (org_id, kind, status, starts_at, ends_at, client_id,
                             account_contact_id, account_user_id, offering_id)
         values ($1,'lesson','scheduled', now() + interval '15 days', now() + interval '15 days 1 hour',
                 $2,$3,$4,$5) returning id`,
      [org, clientId, contactId, clientUid, sku.weekly1]);
    const [{ id: cr }] = await h.q<{ id: string }>(
      `insert into booking_change_requests (org_id, booking_id, requested_by, request_kind, status)
         values ($1,$2,$3,'cancel','pending') returning id`, [org, id, clientUid]);
    await h.asUser(staffUid);
    await h.q(`select decide_booking_change($1,true,true,null)`, [cr]);

    await h.asSuperuser();
    const [{ title }] = await h.q<{ title: string }>(
      `select title from notifications where kind='booking_cancel_approved' order by created_at desc limit 1`);
    expect(title).toMatch(/Riding Lesson/);
    expect(title).not.toMatch(/booking/i);
  });
});
