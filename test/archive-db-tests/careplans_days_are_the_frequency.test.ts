/**
 * TASK CAREPLANS — à la carte or weekly, staff choose the days, quantity follows.
 *
 * Owner, 2026-08-16: "it should just offer ala carte and weekly as the two options and
 * the provisioning that we do on the staff side is to select the days of the week and
 * the quantity is determined from that as well as how many weeks it runs for or
 * indefinitely until cancelled."
 *
 * Owner, 2026-08-17, on what the days MEAN: "it cannot restrict to a specific number of
 * days per week and lock in on that… so if there are 5 sundays and 4 saturdays in the
 * month and those are their selected days they get 9 lessons that month." The chosen
 * weekdays exist ONLY to compute a number. The client then books freely.
 *
 * Owner, 2026-08-17, on the mechanism: "the month starts with applied bookings auto
 * generated and NO CREDITS. if they cancel a booking they get a credit that expires at
 * the end of the month."
 *
 * THE TWO THINGS THIS FILE EXISTS TO CATCH:
 *   1. A REGRESSION IN THE MONEY. `CREDITALIGN` shipped this arithmetic one day earlier
 *      and was itself the third attempt at credit minting. Every plan that has no chosen
 *      days — which is every plan sold before this task, lessons included — must compute
 *      exactly what it computed before. Asserted against an independently recomputed
 *      expectation, not against the thing under test.
 *   2. THE MONTH INFLATING. A cancellation returns a credit; a rebooking spends it. Run
 *      that loop enough times and a wrong seam manufactures sessions nobody paid for.
 *      Asserted by looping it and checking the total never moves.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, migrationFiles, MIGRATIONS_DIR, type TestDb } from '../db/harness';

/** Same replay caveat CREDITALIGN's file documents: the journal is hand-maintained and
 *  ~31 migrations rewrite function bodies in place, so a full fresh replay cannot reach
 *  here. These are the files this area genuinely stands on. */
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
  // CAREPATH §C5b gave a purchase line the ability to be voided and gave the order
  // a recomputed total — set_recurring_days writes a quantity and has to recompute.
  '20260817T0400_carepath_c5_enquiry_orders.sql',
];
const CREDITALIGN = migrationFiles().filter((f) => f.includes('creditalign'));
const CAREPLANS = migrationFiles().filter((f) => f.includes('careplans'));

const SKUS = {
  careWeekly:   { name: 'Exercise Weekly',   segment: 'horse', kind: 'recurring', unit: null, freq: 1 },
  weekly1Rider: { name: '1x Weekly Lesson',  segment: 'rider', kind: 'recurring', unit: null, freq: 1 },
  weekly2Rider: { name: '2x Weekly Lessons', segment: 'rider', kind: 'recurring', unit: null, freq: 2 },
  single:       { name: 'Single Lesson',     segment: 'rider', kind: 'scheduled', unit: 1,    freq: null },
} as const;
const ids: Record<keyof typeof SKUS, string> = {} as never;

let h: TestDb;
let org: string;
let staffUid: string;
let clientUid: string;
let clientId: string;
let contactId: string;

async function apply(files: string[]) {
  await h.asSuperuser();
  for (const f of files) await h.db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
}

/** A paid order carrying one line for `offeringId`, days not yet chosen. */
async function order(offeringId: string, paid = true) {
  await h.asSuperuser();
  const [{ id: purchase }] = await h.q<{ id: string }>(
    `insert into purchases (org_id, buyer_contact_id, status, payment_status, amount)
       values ($1,$2,'awaiting_payment',$3,0) returning id`, [org, contactId, paid ? 'paid' : 'unpaid']);
  const [{ id: item }] = await h.q<{ id: string }>(
    `insert into purchase_items (org_id, purchase_id, offering_id, label, price_amount, price_unit, quantity)
       select $1,$2,o.id,o.name,o.price_amount,o.price_unit,1 from offerings o where o.id=$3
     returning id`, [org, purchase, offeringId]);
  return { purchase, item };
}

async function credits(item: string) {
  await h.asSuperuser();
  return h.q<{
    id: string; credits_total: number; credits_remaining: number;
    period_start: string | null; expires_at: string | null; package_key: string;
  }>(`select id, credits_total, credits_remaining, period_start::text, expires_at::text, package_key
        from lesson_credits where purchase_item_id=$1 and deleted_at is null order by created_at`, [item]);
}

async function aliveBookings() {
  await h.asSuperuser();
  return h.q<{ id: string; starts_at: string; dow: string; credit_id: string | null }>(
    `select id, starts_at::text, to_char(starts_at,'Dy') as dow, credit_id
       from bookings where client_id=$1 and status not in ('cancelled','expired') order by starts_at`,
    [clientId]);
}

async function spendable() {
  await h.asSuperuser();
  const [{ n }] = await h.q<{ n: number }>(
    `select coalesce(sum(credits_remaining),0)::int as n from lesson_credits
      where client_id=$1 and deleted_at is null`, [clientId]);
  return Number(n);
}

/** Cancel a booking the way a client does: ask, staff approves. */
async function cancelBooking(bookingId: string) {
  await h.asSuperuser();
  const [{ id }] = await h.q<{ id: string }>(
    `insert into booking_change_requests (org_id, booking_id, requested_by, request_kind, status)
       values ($1,$2,$3,'cancel','pending') returning id`, [org, bookingId, clientUid]);
  await h.asUser(staffUid);
  await h.q(`select decide_booking_change($1,true,true,null)`, [id]);
  await h.asSuperuser();
}

async function makeSlot(day: string, offeringId: string | null = null) {
  await h.asSuperuser();
  const [{ id }] = await h.q<{ id: string }>(
    `insert into bookings (org_id, status, is_flexible, kind, starts_at, ends_at, offering_id)
       select $1,'available',true,'lesson', d + time '15:00', d + time '16:00', $3
         from (select d::date from generate_series(current_date+1, current_date+21, interval '1 day') d
                where to_char(d,'Dy') = $2
                  and not exists (select 1 from bookings b where b.client_id=$4
                                    and b.starts_at::date = d::date
                                    and b.status not in ('cancelled','expired'))
                order by d limit 1) x(d)
     returning id`, [org, day, offeringId, clientId]);
  return id;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  for (const f of PREREQS) {
    try { await h.db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8')); } catch (err) {
      throw new Error(`prerequisite migration failed: ${f}\n${(err as Error).message}`);
    }
  }
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
       values ($1,'Careplans','Client','careplans-client@test.fhe') returning id`, [org]))[0].id;
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contactId, clientUid]);
  clientId = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, contactId]))[0].id;

  for (const [key, s] of Object.entries(SKUS)) {
    ids[key as keyof typeof SKUS] = (await h.q<{ id: string }>(
      `insert into offerings (org_id, segment, name, slug, active, service_type, config_kind,
                              price_unit, unit_count, weekly_frequency, price_amount)
         values ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,200) returning id`,
      [org, s.segment, s.name, `careplans-${key.toLowerCase()}`,
       s.segment === 'horse' ? 'HORSE_EXERCISE' : 'RIDING_LESSON',
       s.kind, s.kind === 'recurring' ? 'month' : 'session', s.unit, s.freq]))[0].id;
  }
  await apply(CREDITALIGN);
});

afterAll(async () => { await h?.close(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('BEFORE — what the shipped (CREDITALIGN) bodies do', () => {
  it('there is no plural day set: the generator filters ONE weekday', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select prosrc as src from pg_proc where proname='generate_monthly_lessons'`);
    expect(src).toContain(`to_char(d, 'Dy') <> v_day`);
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from pg_proc
        where proname in ('_recurring_allotment_days','set_recurring_days','_generate_plan_month')`);
    expect(Number(n)).toBe(0);
  });

  it('THE DEFECT: an approved cancellation mints a fresh, never-expiring credit', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select prosrc as src from pg_proc where proname='decide_booking_change'`);
    // It inserts a brand new row rather than restoring the one the booking spent —
    // no offering, no purchase, no period, and no expires_at.
    expect(src).toContain(`'change_credit', 1, 1, now()`);
    expect(src).not.toContain('_refund_booking_credit(r)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the migrations apply, and replay', () => {
  it('applies cleanly, twice', async () => {
    await apply(CAREPLANS);
    await apply(CAREPLANS);
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from pg_proc
        where proname in ('_recurring_allotment_days','_normalize_recurring_days',
                          'set_recurring_days','_generate_plan_month','admin_offering_usage')`);
    expect(Number(n)).toBe(5);
  });

  it('book_open_slot and generate_monthly_lessons each still have exactly ONE signature', async () => {
    await h.asSuperuser();
    for (const fn of ['book_open_slot', 'generate_monthly_lessons', 'set_recurring_days']) {
      const [{ n }] = await h.q<{ n: number }>(
        `select count(*)::int as n from pg_proc where proname=$1`, [fn]);
      expect(Number(n), fn).toBe(1);
    }
  });

  it('NO CATALOG FIELD WAS DROPPED — weekly_frequency, unit_count and config_kind all survive', async () => {
    await h.asSuperuser();
    const cols = await h.q<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_name='offerings' and column_name in ('weekly_frequency','unit_count','config_kind')`);
    expect(cols.map((c) => c.column_name).sort()).toEqual(['config_kind', 'unit_count', 'weekly_frequency']);
    // and it is still POPULATED on a recurring SKU
    const [{ freq }] = await h.q<{ freq: number }>(
      `select weekly_frequency as freq from offerings where id=$1`, [ids.weekly2Rider]);
    expect(Number(freq)).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('THE FORMULA — the chosen days, summed', () => {
  it("the owner's worked example: Sat+Sun in a month with 5 Sundays and 4 Saturdays is 9", async () => {
    await h.asSuperuser();
    // November 2026: Sundays 1,8,15,22,29 (five) and Saturdays 7,14,21,28 (four).
    const [{ sundays, saturdays }] = await h.q<{ sundays: number; saturdays: number }>(
      `select count(*) filter (where to_char(d,'Dy')='Sun')::int as sundays,
              count(*) filter (where to_char(d,'Dy')='Sat')::int as saturdays
         from generate_series(date '2026-11-01', date '2026-11-30', interval '1 day') d`);
    expect(Number(sundays)).toBe(5);
    expect(Number(saturdays)).toBe(4);
    const [{ n }] = await h.q<{ n: number }>(
      `select _recurring_allotment_days(array['Sat','Sun'], date '2026-11-01', date '2026-11-30') as n`);
    expect(Number(n)).toBe(9);
  });

  it('IT IS A SUM, NOT A PRODUCT — a five-week month is never rounded down to four', async () => {
    await h.asSuperuser();
    // One Sunday-only plan across November: five, not four.
    const [{ n }] = await h.q<{ n: number }>(
      `select _recurring_allotment_days(array['Sun'], date '2026-11-01', date '2026-11-30') as n`);
    expect(Number(n)).toBe(5);
  });

  it('and it reaches the ledger: the mint seam produces 9 for that month', async () => {
    const { item } = await order(ids.careWeekly);
    await h.asSuperuser();
    await h.q(`select set_recurring_days($1, array['Sat','Sun'], null, true)`, [item]);
    const [{ n }] = await h.q<{ n: number }>(
      `select _mint_credits_for_purchase_item($1,$2,date '2026-11-01') as n`, [item, clientId]);
    expect(Number(n)).toBe(9);
    await h.q(`delete from lesson_credits where purchase_item_id=$1 and period_start=date '2026-11-01'`, [item]);
    await h.q(`delete from purchase_items where id=$1`, [item]);
  });

  it('a day list is normalised: case, whitespace, duplicates, week order', async () => {
    await h.asSuperuser();
    const [{ d }] = await h.q<{ d: string[] }>(
      `select _normalize_recurring_days(array[' sun ','SAT','Sun','tue']) as d`);
    expect(d).toEqual(['Tue', 'Sat', 'Sun']);
  });

  it('an invalid or empty day list is refused', async () => {
    await h.asSuperuser();
    await expect(h.q(`select _normalize_recurring_days(array['Funday'])`)).rejects.toThrow(/Mon\/Tue\/Wed/);
    await expect(h.q(`select _normalize_recurring_days(array[]::text[])`)).rejects.toThrow(/at least one day/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('REGRESSION — every plan sold before this task computes exactly what it did', () => {
  // This is the test that matters most (§THE TEST 6 and 9d). The expectation is
  // recomputed here from the catalog, never read back from the thing under test.
  async function expectedLegacy(freq: number, anchor: string) {
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select $1::int * (select count(*)::int
          from generate_series(greatest(current_date, date_trunc('month',current_date)::date),
                               (date_trunc('month',current_date) + interval '1 month - 1 day')::date,
                               interval '1 day') d
         where to_char(d,'Dy') = $2) as n`, [freq, anchor]);
    return Number(n);
  }

  it('a 1× lesson plan with a single chosen day is unchanged', async () => {
    const { item } = await order(ids.weekly1Rider);
    await h.asSuperuser();
    await h.q(`select set_recurring_day($1,'Tue')`, [item]);
    const rows = await credits(item);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].credits_total)).toBe(await expectedLegacy(1, 'Tue'));
    await h.q(`delete from lesson_credits where purchase_item_id=$1`, [item]);
    await h.q(`delete from purchase_items where id=$1`, [item]);
  });

  it('a 2× lesson plan with a single chosen day is unchanged — still weekly_frequency × occurrences', async () => {
    const { item } = await order(ids.weekly2Rider);
    await h.asSuperuser();
    await h.q(`select set_recurring_day($1,'Thu')`, [item]);
    const rows = await credits(item);
    expect(Number(rows[0].credits_total)).toBe(await expectedLegacy(2, 'Thu'));
    await h.q(`delete from lesson_credits where purchase_item_id=$1`, [item]);
    await h.q(`delete from purchase_items where id=$1`, [item]);
  });

  it('_recurring_allotment itself was not touched', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select prosrc as src from pg_proc where proname='_recurring_allotment'`);
    expect(src).toContain('p_weekly_frequency');
    expect(src).toContain('p_quantity');
  });

  it('nothing in the new bodies keys on an offering NAME', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ proname: string; src: string }>(
      `select proname, prosrc as src from pg_proc
        where proname in ('_recurring_allotment_days','set_recurring_days','_generate_plan_month',
                          '_mint_credits_for_purchase_item')`);
    for (const r of rows) {
      expect(r.src, r.proname).not.toMatch(/o\.name\s*(=|~|like|ilike)/i);
      expect(r.src, r.proname).not.toContain('substring(');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§P3 — the quantity FOLLOWS the days', () => {
  it('an unpaid order takes the day count as its quantity, and the money follows', async () => {
    const { purchase, item } = await order(ids.careWeekly, false);
    await h.asSuperuser();
    await h.q(`select set_recurring_days($1, array['Tue','Thu'], null, true)`, [item]);
    const [{ qty, amount }] = await h.q<{ qty: number; amount: string }>(
      `select pi.quantity as qty, pu.amount from purchase_items pi
         join purchases pu on pu.id=pi.purchase_id where pi.id=$1`, [item]);
    expect(Number(qty)).toBe(2);
    expect(Number(amount)).toBe(400);      // 2 × the weekly rate — NO volume break
    await h.q(`select set_recurring_days($1, array['Mon','Tue','Thu'], null, true)`, [item]);
    const [{ qty: q3, amount: a3 }] = await h.q<{ qty: number; amount: string }>(
      `select pi.quantity as qty, pu.amount from purchase_items pi
         join purchases pu on pu.id=pi.purchase_id where pi.id=$1`, [item]);
    expect(Number(q3)).toBe(3);
    expect(Number(a3)).toBe(600);
    await h.q(`delete from lesson_credits where purchase_item_id=$1`, [item]);
    await h.q(`delete from purchase_items where id=$1`, [item]);
    await h.q(`delete from purchases where id=$1`, [purchase]);
  });

  it('a PAID order is not silently re-priced by a scheduling action', async () => {
    const { item } = await order(ids.careWeekly, true);
    await h.asSuperuser();
    const [{ res }] = await h.q<{ res: { quantity: number; quantity_locked: boolean } }>(
      `select set_recurring_days($1, array['Tue','Thu'], null, true) as res`, [item]);
    expect(res.quantity_locked).toBe(true);
    expect(Number(res.quantity)).toBe(1);
    await h.q(`delete from lesson_credits where purchase_item_id=$1`, [item]);
    await h.q(`delete from purchase_items where id=$1`, [item]);
  });

  it('a mismatch with the catalog default is REPORTED, never corrected', async () => {
    const { item } = await order(ids.weekly2Rider, false);
    await h.asSuperuser();
    const [{ res }] = await h.q<{ res: { differs_from_catalog: boolean; catalog_default: number } }>(
      `select set_recurring_days($1, array['Mon','Wed','Fri'], null, true) as res`, [item]);
    expect(res.differs_from_catalog).toBe(true);
    expect(Number(res.catalog_default)).toBe(2);
    // and the CATALOG is untouched: one client's plan never edits the SKU
    const [{ freq }] = await h.q<{ freq: number }>(
      `select weekly_frequency as freq from offerings where id=$1`, [ids.weekly2Rider]);
    expect(Number(freq)).toBe(2);
    await h.q(`delete from lesson_credits where purchase_item_id=$1`, [item]);
    await h.q(`delete from purchase_items where id=$1`, [item]);
  });

  it('N weeks sets an end date; indefinite clears it', async () => {
    const { item } = await order(ids.careWeekly, false);
    await h.asSuperuser();
    await h.q(`select set_recurring_days($1, array['Tue'], 2, false)`, [item]);
    const [{ ends }] = await h.q<{ ends: string | null }>(
      `select plan_ends_on::text as ends from purchase_items where id=$1`, [item]);
    expect(ends).not.toBeNull();
    await h.q(`select set_recurring_days($1, array['Tue'], null, true)`, [item]);
    const [{ ends: e2 }] = await h.q<{ ends: string | null }>(
      `select plan_ends_on::text as ends from purchase_items where id=$1`, [item]);
    expect(e2).toBeNull();
    await h.q(`delete from lesson_credits where purchase_item_id=$1`, [item]);
    await h.q(`delete from purchase_items where id=$1`, [item]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('THE MECHANISM — bookings are the entitlement, a credit is the residue', () => {
  let item: string;
  let minted: number;

  it('a provisioned month holds N bookings and ZERO spendable credits', async () => {
    // start from a clean client: the suites above left orders and allotments behind
    await h.asSuperuser();
    await h.q(`delete from bookings where client_id=$1`, [clientId]);
    await h.q(`delete from lesson_credits where client_id=$1`, [clientId]);
    ({ item } = await order(ids.weekly1Rider, true));
    await h.asSuperuser();
    await h.q(`select set_recurring_days($1, array['Mon','Wed','Fri'], null, true)`, [item]);
    const rows = await credits(item);
    minted = Number(rows[0].credits_total);
    expect(minted).toBeGreaterThan(0);

    await h.asUser(staffUid);
    const [{ res }] = await h.q<{ res: { created: number; recurring_days: string[] } }>(
      `select generate_monthly_lessons($1,$2,'10:00',60,null,null) as res`, [clientId, item]);
    expect(res.recurring_days).toEqual(['Mon', 'Wed', 'Fri']);
    expect(Number(res.created)).toBe(minted);

    const alive = await aliveBookings();
    expect(alive).toHaveLength(minted);
    expect(alive.every((b) => b.credit_id !== null)).toBe(true);
    expect(await spendable()).toBe(0);                    // ← the owner's state
  });

  it('a second generate run writes nothing and spends nothing', async () => {
    await h.asUser(staffUid);
    const [{ res }] = await h.q<{ res: { created: number; skipped_existing: number } }>(
      `select generate_monthly_lessons($1,$2,'10:00',60,null,null) as res`, [clientId, item]);
    expect(Number(res.created)).toBe(0);
    expect(Number(res.skipped_existing)).toBe(minted);
    expect(await spendable()).toBe(0);
  });

  it('a cancellation returns ONE credit — into the plan\'s own row, expiring at month end', async () => {
    const before = await aliveBookings();
    await cancelBooking(before[0].id);
    const rows = await credits(item);
    // ONE row, not a new untagged one: the total is unchanged and one is spendable.
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].credits_total)).toBe(minted);
    expect(Number(rows[0].credits_remaining)).toBe(1);
    expect(rows[0].expires_at).not.toBeNull();
    await h.asSuperuser();
    const [{ same }] = await h.q<{ same: boolean }>(
      `select (expires_at = (date_trunc('month', current_date) + interval '1 month')) as same
         from lesson_credits where purchase_item_id=$1`, [item]);
    expect(same).toBe(true);
    // nothing untagged and never-expiring was created
    const [{ loose }] = await h.q<{ loose: number }>(
      `select count(*)::int as loose from lesson_credits
        where client_id=$1 and deleted_at is null and purchase_item_id is null`, [clientId]);
    expect(Number(loose)).toBe(0);
  });

  it('the month is spendable on days the chosen pattern never contained', async () => {
    await h.asSuperuser();
    const [{ credit }] = await h.q<{ credit: string }>(
      `select id as credit from lesson_credits where purchase_item_id=$1`, [item]);
    const slot = await makeSlot('Tue');                    // Mon/Wed/Fri was the pattern
    await h.asUser(clientUid);
    await h.q(`select book_open_slot($1,null,$2)`, [slot, credit]);
    await h.asSuperuser();
    const [{ dow }] = await h.q<{ dow: string }>(
      `select to_char(starts_at,'Dy') as dow from bookings where id=$1`, [slot]);
    expect(dow).toBe('Tue');
    expect(await spendable()).toBe(0);
    expect(await aliveBookings()).toHaveLength(minted);
  });

  it('THE MONTH CANNOT GROW — cancel and rebook five times over', async () => {
    for (let i = 0; i < 5; i += 1) {
      const alive = await aliveBookings();
      expect(alive.length + await spendable()).toBe(minted);   // the invariant, every pass
      await cancelBooking(alive[0].id);
      await h.asSuperuser();
      const [{ credit }] = await h.q<{ credit: string }>(
        `select id as credit from lesson_credits where purchase_item_id=$1 and credits_remaining>0`, [item]);
      const slot = await makeSlot(['Tue', 'Thu', 'Sat', 'Sun', 'Tue'][i]);
      if (!slot) continue;
      await h.asUser(clientUid);
      await h.q(`select book_open_slot($1,null,$2)`, [slot, credit]);
      await h.asSuperuser();
    }
    expect((await aliveBookings()).length + await spendable()).toBe(minted);
    const rows = await credits(item);
    expect(Number(rows[0].credits_total)).toBe(minted);
  });

  it('and the client is stopped at ONE more than the month holds', async () => {
    expect(await spendable()).toBe(0);
    await h.asSuperuser();
    const [{ credit }] = await h.q<{ credit: string }>(
      `select id as credit from lesson_credits where purchase_item_id=$1`, [item]);
    const slot = await makeSlot('Sat');
    await h.asUser(clientUid);
    await expect(h.q(`select book_open_slot($1,null,$2)`, [slot, credit])).rejects.toThrow(/NO_CREDITS/);
    await h.asSuperuser();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§P4 — a fixed-week plan stops, an indefinite one keeps rolling', () => {
  it('the roll skips a plan whose weeks ran out and mints for one that has not', async () => {
    await h.asSuperuser();
    // wipe the fixtures the mechanism suite left so the roll's population is clear
    await h.q(`delete from bookings where client_id=$1`, [clientId]);
    await h.q(`delete from lesson_credits where client_id=$1`, [clientId]);

    const ended = await order(ids.careWeekly, true);
    const running = await order(ids.careWeekly, true);
    for (const o of [ended, running]) {
      await h.q(`select set_recurring_days($1, array['Tue','Thu'], null, true)`, [o.item]);
      // pretend both were bought last month so the roll has something to do
      await h.q(`update purchases set created_at = date_trunc('month', current_date) - interval '1 month'
                  where id=$1`, [o.purchase]);
      await h.q(`delete from lesson_credits where purchase_item_id=$1`, [o.item]);
    }
    await h.q(`update purchase_items set plan_ends_on = (date_trunc('month', current_date) - interval '1 day')::date
                where id=$1`, [ended.item]);

    await h.asUser(staffUid);
    await h.q(`select mint_recurring_allotments()`);
    expect(await credits(ended.item)).toHaveLength(0);
    const live = await credits(running.item);
    expect(live).toHaveLength(1);
    expect(Number(live[0].credits_total)).toBeGreaterThan(0);
  });

  it('the roll is idempotent within a month', async () => {
    await h.asUser(staffUid);
    const [{ res }] = await h.q<{ res: { plans_considered: number; credits_minted: number } }>(
      `select mint_recurring_allotments() as res`);
    expect(Number(res.plans_considered)).toBe(0);
    expect(Number(res.credits_minted)).toBe(0);
  });
});
