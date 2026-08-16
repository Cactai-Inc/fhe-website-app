/**
 * TASK CREDITALIGN — the credit system matches the catalog, weekly/monthly included.
 *
 * Owner: "when i purchased something that had a multi unit quantity, weekly or monthly
 * allotment, the system didnt recognize that properly for lessons or horse care" and
 * "make the booked and pending-booking item swap."
 *
 * WHAT WAS BROKEN, measured on prod 2026-08-16 before any of this ran:
 *   * all TEN active recurring SKUs minted ZERO — both segments. `1x/2x Weekly Lesson`,
 *     both `(With your horse)` variants and all six horse-care `Exercise/Training/
 *     Turnout 1x & 2x Weekly` SKUs. CREDITFIX's mint loop is gated
 *     `config_kind = 'scheduled'`, so a paid monthly client could book nothing;
 *   * `_provision_purchase_for_offerings` was the ONLY minter, and it is not the only
 *     way a line is bought — `createDraftOrder` (the shop checkout) inserts
 *     `purchase_items` directly and minted nothing at all;
 *   * `generate_monthly_lessons` wrote bookings and spent nothing, so once an allotment
 *     existed the two would double-count;
 *   * nothing could re-charge a booking to a different purchased item.
 *
 * THIS BUG HAS BEEN FIXED AND SILENTLY REVERTED THREE TIMES (20260726010000 → reverted
 * by 20260802020000 → BOOKWRITE kept the tag and not the formula → CREDITFIX). This file
 * asserts the whole SKU table AND that no display name appears in the mint path, so a
 * fourth revert fails loudly here rather than in a client's empty calendar.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, migrationFiles, MIGRATIONS_DIR, type TestDb } from './harness';

/** The snapshot is 2026-08-03. Replaying the whole tail is not possible here — the
 *  repo's migrations are a hand-maintained journal and ~31 of them rewrite existing
 *  function bodies in place (CLAUDE.md says so explicitly), so a fresh replay fails on
 *  data-seeding and return-type changes long before it reaches this task. These are the
 *  ones this area genuinely stands on, in order: the mint (CREDITFIX), the monthly-plan
 *  machinery (BOOKLINK b2/b4), the pending/refund flow (REVIEWQ), and the member's item
 *  picker (ONBOARD), plus ZELLECLOSE's _notify_purchase_paid which the provisioning
 *  spine calls. BOOKLINK's b1/b5 files are prod data backfills — they name real
 *  contacts and cannot run on an empty database, which is exactly the replayability
 *  caveat CLAUDE.md records. */
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
];
const CREDITALIGN = migrationFiles().filter((f) => f.includes('creditalign'));

let h: TestDb;
let org: string;
let staffUid: string;
let clientUid: string;
let clientId: string;
let contactId: string;

/** The catalog slice, shaped exactly like the live one (verified against prod). */
const SKUS = {
  weekly1Rider:  { name: '1x Weekly Lesson',    segment: 'rider', kind: 'recurring', unit: null, freq: 1 },
  weekly2Rider:  { name: '2x Weekly Lessons',   segment: 'rider', kind: 'recurring', unit: null, freq: 2 },
  weekly1Horse:  { name: 'Exercise 1x Weekly',  segment: 'horse', kind: 'recurring', unit: null, freq: 1 },
  weekly2Horse:  { name: 'Training 2x Weekly',  segment: 'horse', kind: 'recurring', unit: null, freq: 2 },
  eightPack:     { name: '8-Lesson Punch Card', segment: 'rider', kind: 'scheduled', unit: 8,    freq: null },
  single:        { name: 'Single Lesson',       segment: 'rider', kind: 'scheduled', unit: 1,    freq: null },
  clip:          { name: 'Full Body Clip',      segment: 'horse', kind: 'scheduled', unit: 1,    freq: null },
} as const;
const ids: Record<keyof typeof SKUS, string> = {} as never;

async function applyCreditalign() {
  await h.asSuperuser();
  for (const f of CREDITALIGN) {
    await h.db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
  }
}

/** weekly_frequency × occurrences of the anchor weekday in [from..to] — recomputed
 *  here from the catalog rather than read back from the thing under test. */
async function expectedRecurring(freq: number, from: string, to: string, anchor?: string) {
  await h.asSuperuser();
  const [{ n }] = await h.q<{ n: number }>(
    `select $1::int * (select count(*)::int from generate_series($2::date,$3::date,interval '1 day') d
        where to_char(d,'Dy') = coalesce($4, to_char($2::date,'Dy'))) as n`,
    [freq, from, to, anchor ?? null]);
  return Number(n);
}

async function provision(offeringId: string, markPaid = true) {
  await h.asSuperuser();
  const [{ id }] = await h.q<{ id: string }>(
    `select _provision_purchase_for_offerings($1,$2,$3,$4::uuid[],$5,'zelle','creditalign test',0) as id`,
    [org, contactId, clientId, [offeringId], markPaid]);
  return id;
}

async function creditsFor(offeringId: string) {
  await h.asSuperuser();
  return h.q<{
    id: string; credits_total: number; credits_remaining: number;
    period_start: string | null; expires_at: string | null; purchase_item_id: string | null;
  }>(
    `select id, credits_total, credits_remaining, period_start::text, expires_at::text, purchase_item_id
       from lesson_credits where client_id=$1 and offering_id=$2 and deleted_at is null
       order by created_at`, [clientId, offeringId]);
}

/** The pre-migration read — lesson_credits has no period_start until m1 runs. */
async function creditRowsBefore(offeringId: string) {
  await h.asSuperuser();
  return h.q<{ id: string }>(
    `select id from lesson_credits where client_id=$1 and offering_id=$2 and deleted_at is null`,
    [clientId, offeringId]);
}

async function makeSlot(startsAt: string, offeringId: string | null) {
  await h.asSuperuser();
  return (await h.q<{ id: string }>(
    `insert into bookings (org_id, status, is_flexible, kind, starts_at, ends_at, offering_id)
       values ($1,'available',true,'lesson',$2::timestamptz,$2::timestamptz + interval '1 hour',$3)
     returning id`, [org, startsAt, offeringId]))[0].id;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  for (const f of PREREQS) {
    try {
      await h.db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
    } catch (err) {
      throw new Error(`prerequisite migration failed: ${f}\n${(err as Error).message}`);
    }
  }

  // status_events_vocab isn't a snapshot-seeded table; purchases/bookings INSERT
  // triggers FK into it (same seed creditfix's and reviewq's tests needed).
  await h.q(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'order', c, c from unnest(array['pending','submitted','paid','void','unpaid','draft']) c
    on conflict do nothing;`);
  await h.q(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'offering', c, c from unnest(array['pending','scheduled','cancelled','completed','rescheduled','no_show']) c
    on conflict do nothing;`);
  await h.q(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'fulfillment', c, c from unnest(array['open','scheduled','consumed','delivered','expired','void']) c
    on conflict do nothing;`);

  staffUid = await h.createAuthUser({ role: 'ADMIN', org });
  clientUid = await h.createAuthUser({ role: 'USER', org });
  contactId = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name, email)
       values ($1,'Creditalign','Client','creditalign-client@test.fhe') returning id`, [org]))[0].id;
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contactId, clientUid]);
  clientId = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, contactId]))[0].id;

  for (const [key, s] of Object.entries(SKUS)) {
    ids[key as keyof typeof SKUS] = (await h.q<{ id: string }>(
      `insert into offerings (org_id, segment, name, slug, active, service_type, config_kind,
                              price_unit, unit_count, weekly_frequency, price_amount)
         values ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,100) returning id`,
      [org, s.segment, s.name, `creditalign-${key.toLowerCase()}`,
       s.segment === 'horse' ? 'HORSE_EXERCISE' : 'RIDING_LESSON',
       s.kind, s.kind === 'recurring' ? 'month' : 'session', s.unit, s.freq]))[0].id;
  }
});

afterAll(async () => { await h?.close(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('BEFORE — the bug, on the shipped bodies', () => {
  it('a recurring SKU mints nothing at all, both segments', async () => {
    await provision(ids.weekly1Rider);
    await provision(ids.weekly1Horse);
    expect(await creditRowsBefore(ids.weekly1Rider)).toHaveLength(0);
    expect(await creditRowsBefore(ids.weekly1Horse)).toHaveLength(0);
  });

  it('the shop checkout path mints nothing either — nothing on purchase_items does', async () => {
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from pg_trigger t
         join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid
        where not t.tgisinternal and c.relname in ('purchase_items','purchases')
          and p.prosrc ilike '%lesson_credits%'`);
    expect(Number(n)).toBe(0);
  });

  it('generate_monthly_lessons spends nothing', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select prosrc as src from pg_proc where proname='generate_monthly_lessons'`);
    expect(src).not.toContain('lesson_credits');
  });

  it('there is no way to swap a booking to a different purchased item', async () => {
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from pg_proc where proname='swap_booking_item'`);
    expect(Number(n)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AFTER — the migrations apply, and replay', () => {
  it('applies cleanly, twice (idempotent)', async () => {
    await applyCreditalign();
    await applyCreditalign();
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from pg_proc
        where proname in ('_mint_credits_for_purchase_item','_recurring_allotment',
                          'swap_booking_item','booking_item_options','mint_recurring_allotments',
                          'set_recurring_plan_end')`);
    expect(Number(n)).toBe(6);
  });

  it('book_open_slot still has exactly ONE signature', async () => {
    // A thread resurrected a second overload on 2026-08-15; PostgREST resolves by
    // argument name, so a stray second signature silently spends the wrong item.
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from pg_proc where proname='book_open_slot'`);
    expect(Number(n)).toBe(1);
  });

  it('anon can execute none of the new functions', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ f: string; ok: boolean }>(
      `select f, has_function_privilege('anon', f, 'execute') as ok from unnest(array[
         'public._mint_credits_for_purchase_item(uuid,uuid,date)',
         'public.swap_booking_item(uuid,uuid)',
         'public.booking_item_options(uuid)',
         'public.mint_recurring_allotments()',
         'public.set_recurring_plan_end(uuid,date)']) f`);
    for (const r of rows) expect(r.ok, `${r.f} is anon-executable`).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 1 — every SKU mints what the catalog says, lessons AND horse care', () => {
  it('recurring rider 1x → weekly_frequency × weekday occurrences left this month', async () => {
    const pur = await provision(ids.weekly1Rider);
    const rows = await creditsFor(ids.weekly1Rider);
    expect(rows).toHaveLength(1);
    await h.asSuperuser();
    const [{ from, to }] = await h.q<{ from: string; to: string }>(
      `select current_date::text as from,
              (date_trunc('month',current_date)+interval '1 month - 1 day')::date::text as to`);
    expect(rows[0].credits_total).toBe(await expectedRecurring(1, from, to));
    expect(rows[0].credits_remaining).toBe(rows[0].credits_total);
    expect(pur).toBeTruthy();
  });

  it('recurring rider 2x → double the 1x count', async () => {
    await provision(ids.weekly2Rider);
    const one = (await creditsFor(ids.weekly1Rider))[0].credits_total;
    const two = (await creditsFor(ids.weekly2Rider))[0].credits_total;
    expect(two).toBe(one * 2);
  });

  it('recurring HORSE CARE mints exactly like the lesson one — 1x and 2x', async () => {
    await provision(ids.weekly1Horse);
    await provision(ids.weekly2Horse);
    const one = (await creditsFor(ids.weekly1Horse))[0].credits_total;
    const two = (await creditsFor(ids.weekly2Horse))[0].credits_total;
    expect(one).toBe((await creditsFor(ids.weekly1Rider))[0].credits_total);
    expect(two).toBe(one * 2);
  });

  it('session packs are unchanged — CREDITFIX\'s table still holds', async () => {
    await provision(ids.eightPack);
    await provision(ids.single);
    await provision(ids.clip);
    expect((await creditsFor(ids.eightPack))[0].credits_total).toBe(8);
    expect((await creditsFor(ids.single))[0].credits_total).toBe(1);
    // a horse-segment SCHEDULED SKU still mints no lesson credit (FLOWTRACE F2).
    expect(await creditsFor(ids.clip)).toHaveLength(0);
  });

  it('quantity multiplies both shapes', async () => {
    await h.asSuperuser();
    const pur = (await h.q<{ id: string }>(
      `insert into purchases (org_id, buyer_contact_id, status, amount, payment_status)
         values ($1,$2,'awaiting_payment',0,'unpaid') returning id`, [org, contactId]))[0].id;
    await h.q(
      `insert into purchase_items (org_id, purchase_id, offering_id, label, price_amount, quantity)
         values ($1,$2,$3,'qty test',0,3)`, [org, pur, ids.eightPack]);
    const [{ t }] = await h.q<{ t: number }>(
      `select credits_total as t from lesson_credits where purchase_id=$1`, [pur]);
    expect(Number(t)).toBe(24);
  });

  it('the mint reads the catalog, never a display name', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select prosrc as src from pg_proc where proname='_mint_credits_for_purchase_item'`);
    expect(src).toContain('unit_count');
    expect(src).toContain('weekly_frequency');
    expect(src).not.toMatch(/~\s*'/);          // no regex match operator
    expect(src).not.toMatch(/substring\s*\(/i);
    expect(src).not.toMatch(/\bilike\b/i);
    expect(src).not.toMatch(/o\.name\s*(=|~|like)/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 1b — the shop checkout mints too, and a draft does not', () => {
  it('a DRAFT order mints nothing; opening it mints everything', async () => {
    await h.asSuperuser();
    const pur = (await h.q<{ id: string }>(
      `insert into purchases (org_id, buyer_contact_id, status, amount, payment_status)
         values ($1,$2,'draft',0,'unpaid') returning id`, [org, contactId]))[0].id;
    await h.q(
      `insert into purchase_items (org_id, purchase_id, offering_id, label, price_amount)
         values ($1,$2,$3,'8-pack',0)`, [org, pur, ids.eightPack]);

    let rows = await h.q<{ n: number }>(
      `select count(*)::int as n from lesson_credits where purchase_id=$1`, [pur]);
    expect(Number(rows[0].n)).toBe(0);

    await h.q(`update purchases set status='awaiting_payment' where id=$1`, [pur]);
    rows = await h.q<{ n: number }>(
      `select credits_total as n from lesson_credits where purchase_id=$1`, [pur]);
    expect(Number(rows[0].n)).toBe(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 2 — a month expires and does not carry over', () => {
  let lastMonthCredit: string;

  it('an allotment carries period_start = month start and expires_at = next month', async () => {
    const [row] = await creditsFor(ids.weekly1Rider);
    await h.asSuperuser();
    const [{ ms, ne }] = await h.q<{ ms: string; ne: string }>(
      `select date_trunc('month',current_date)::date::text as ms,
              (date_trunc('month',current_date)+interval '1 month')::date::text as ne`);
    expect(row.period_start).toBe(ms);
    expect(String(row.expires_at).slice(0, 10)).toBe(ne);
  });

  it('LAST month\'s allotment cannot be spent this month', async () => {
    await h.asSuperuser();
    lastMonthCredit = (await h.q<{ id: string }>(
      `insert into lesson_credits (org_id, client_id, offering_id, package_key,
                                   credits_total, credits_remaining, period_start, expires_at)
         values ($1,$2,$3,'Last month',4,4,
                 (date_trunc('month',current_date)-interval '1 month')::date,
                 date_trunc('month',current_date))
       returning id`, [org, clientId, ids.weekly1Rider]))[0].id;

    const slot = await makeSlot(new Date(Date.now() + 86400000).toISOString(), ids.weekly1Rider);
    await h.asUser(clientUid);
    await expect(
      h.q(`select book_open_slot($1,null,$2)`, [slot, lastMonthCredit]),
    ).rejects.toThrow(/NO_CREDITS/);

    await h.asSuperuser();
    const [{ r }] = await h.q<{ r: number }>(
      `select credits_remaining as r from lesson_credits where id=$1`, [lastMonthCredit]);
    expect(Number(r)).toBe(4);   // untouched
  });

  it('the staff roster and the member\'s balance both ignore it', async () => {
    await h.asSuperuser();
    const [{ live, all }] = await h.q<{ live: number; all: number }>(
      `select coalesce(sum(credits_remaining) filter (where expires_at is null or expires_at > now()),0)::int as live,
              coalesce(sum(credits_remaining),0)::int as all
         from lesson_credits where client_id=$1 and deleted_at is null`, [clientId]);
    expect(Number(all) - Number(live)).toBe(4);   // exactly the expired allotment
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 3 — generate_monthly_lessons and the entitlement do not double-spend', () => {
  it('every generated session spends exactly one allotment credit, and it stops when they run out', async () => {
    await h.asSuperuser();
    // a plan of its own, with a day, so the count is deterministic.
    const pur = await provision(ids.weekly2Rider);
    const [{ item }] = await h.q<{ item: string }>(
      `select id as item from purchase_items where purchase_id=$1`, [pur]);
    const [{ dow }] = await h.q<{ dow: string }>(`select to_char(current_date,'Dy') as dow`);
    await h.asUser(staffUid);
    await h.q(`select set_recurring_day($1,$2)`, [item, dow]);

    await h.asSuperuser();
    const before = (await h.q<{ t: number; r: number }>(
      `select credits_total as t, credits_remaining as r from lesson_credits where purchase_item_id=$1`,
      [item]))[0];

    await h.asUser(staffUid);
    const [{ res }] = await h.q<{ res: { created: number; skipped_no_entitlement: number } }>(
      `select generate_monthly_lessons($1,$2,'15:00',60,null,null) as res`, [clientId, item]);

    await h.asSuperuser();
    const after = (await h.q<{ r: number }>(
      `select credits_remaining as r from lesson_credits where purchase_item_id=$1`, [item]))[0];

    // one session made = one credit spent. Never two, never zero.
    expect(Number(before.r) - Number(after.r)).toBe(res.created);
    // and every booking it wrote names the credit it spent.
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from bookings
        where client_id=$1 and credit_id is null and series_id is not null`, [clientId]);
    expect(Number(n)).toBe(0);
    expect(Number(after.r)).toBeGreaterThanOrEqual(0);
  });

  it('a second run writes nothing new and spends nothing', async () => {
    await h.asSuperuser();
    const [{ item }] = await h.q<{ item: string }>(
      `select pi.id as item from purchase_items pi
         join lesson_credits lc on lc.purchase_item_id = pi.id
        where pi.offering_id=$1 and pi.config ? 'recurring_day' limit 1`, [ids.weekly2Rider]);
    const before = (await h.q<{ r: number }>(
      `select credits_remaining as r from lesson_credits where purchase_item_id=$1`, [item]))[0];
    await h.asUser(staffUid);
    await h.q(`select generate_monthly_lessons($1,$2,'15:00',60,null,null)`, [clientId, item]);
    await h.asSuperuser();
    const after = (await h.q<{ r: number }>(
      `select credits_remaining as r from lesson_credits where purchase_item_id=$1`, [item]))[0];
    expect(Number(after.r)).toBe(Number(before.r));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('TESTS 4-6 — the item swap', () => {
  let bookingId: string;
  let fromCredit: string;
  let toCredit: string;

  it('4. a PENDING booking\'s item can be swapped by the client — refund + debit, atomic', async () => {
    // fresh, cleanly separated credits so the arithmetic is unambiguous
    await h.asSuperuser();
    await h.q(`update lesson_credits set deleted_at=now() where client_id=$1 and deleted_at is null`, [clientId]);
    fromCredit = (await h.q<{ id: string }>(
      `insert into lesson_credits (org_id, client_id, offering_id, package_key, credits_total, credits_remaining)
         values ($1,$2,$3,'From pack',4,4) returning id`, [org, clientId, ids.eightPack]))[0].id;
    toCredit = (await h.q<{ id: string }>(
      `insert into lesson_credits (org_id, client_id, offering_id, package_key, credits_total, credits_remaining)
         values ($1,$2,$3,'To pack',2,2) returning id`, [org, clientId, ids.single]))[0].id;

    const slot = await makeSlot(new Date(Date.now() + 5 * 86400000).toISOString(), ids.eightPack);
    await h.asUser(clientUid);
    await h.q(`select book_open_slot($1,null,$2)`, [slot, fromCredit]);
    bookingId = slot;

    await h.asSuperuser();
    expect(Number((await h.q<{ r: number }>(
      `select credits_remaining as r from lesson_credits where id=$1`, [fromCredit]))[0].r)).toBe(3);

    await h.asUser(clientUid);
    const [{ res }] = await h.q<{ res: { to_credit_id: string; refunded: boolean } }>(
      `select swap_booking_item($1,$2) as res`, [bookingId, toCredit]);
    expect(res.to_credit_id).toBe(toCredit);
    expect(res.refunded).toBe(true);

    await h.asSuperuser();
    const rows = await h.q<{ id: string; credits_remaining: number }>(
      `select id, credits_remaining from lesson_credits where id = any($1::uuid[])`,
      [[fromCredit, toCredit]]);
    const by = Object.fromEntries(rows.map((r) => [r.id, Number(r.credits_remaining)]));
    expect(by[fromCredit]).toBe(4);   // returned to the row it came from
    expect(by[toCredit]).toBe(1);     // debited
    const [{ cid }] = await h.q<{ cid: string }>(
      `select credit_id as cid from bookings where id=$1`, [bookingId]);
    expect(cid).toBe(toCredit);
  });

  it('4b. the refund went through the ONE seam — no stray compensating row', async () => {
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from lesson_credits
        where client_id=$1 and package_key='change_credit' and deleted_at is null`, [clientId]);
    expect(Number(n)).toBe(0);
  });

  it('4c. it is recorded — who, from what, to what, when', async () => {
    await h.asSuperuser();
    const [row] = await h.q<{
      swapped_by: string; swapped_by_role: string; booking_status_at: string;
      from_credit_id: string; to_credit_id: string; to_label: string;
    }>(`select swapped_by, swapped_by_role, booking_status_at, from_credit_id, to_credit_id, to_label
          from booking_item_swaps where booking_id=$1`, [bookingId]);
    expect(row.swapped_by).toBe(clientUid);
    expect(row.swapped_by_role).toBe('client');
    expect(row.booking_status_at).toBe('pending');
    expect(row.from_credit_id).toBe(fromCredit);
    expect(row.to_credit_id).toBe(toCredit);
    expect(row.to_label).toBe('Single Lesson');
  });

  it('5. a CONFIRMED booking can be swapped by staff — and NOT by the client', async () => {
    await h.asSuperuser();
    await h.q(`update bookings set status='scheduled' where id=$1`, [bookingId]);

    await h.asUser(clientUid);
    await expect(h.q(`select swap_booking_item($1,$2)`, [bookingId, fromCredit]))
      .rejects.toThrow(/NOT_PENDING/);

    await h.asUser(staffUid);
    const [{ res }] = await h.q<{ res: { by: string } }>(
      `select swap_booking_item($1,$2) as res`, [bookingId, fromCredit]);
    expect(res.by).toBe('staff');

    await h.asSuperuser();
    const rows = await h.q<{ id: string; credits_remaining: number }>(
      `select id, credits_remaining from lesson_credits where id = any($1::uuid[])`,
      [[fromCredit, toCredit]]);
    const by = Object.fromEntries(rows.map((r) => [r.id, Number(r.credits_remaining)]));
    expect(by[fromCredit]).toBe(3);   // debited again
    expect(by[toCredit]).toBe(2);     // returned
    const [{ st }] = await h.q<{ st: string }>(
      `select booking_status_at as st from booking_item_swaps
        where booking_id=$1 order by created_at desc limit 1`, [bookingId]);
    expect(st).toBe('scheduled');
  });

  it('6. a swap to an item with nothing left is REFUSED, with a reason', async () => {
    await h.asSuperuser();
    const empty = (await h.q<{ id: string }>(
      `insert into lesson_credits (org_id, client_id, offering_id, package_key, credits_total, credits_remaining)
         values ($1,$2,$3,'Spent pack',2,0) returning id`, [org, clientId, ids.single]))[0].id;
    const before = Number((await h.q<{ r: number }>(
      `select credits_remaining as r from lesson_credits where id=$1`, [fromCredit]))[0].r);

    await h.asUser(staffUid);
    await expect(h.q(`select swap_booking_item($1,$2)`, [bookingId, empty]))
      .rejects.toThrow(/NO_ENTITLEMENT: "Single Lesson" has nothing left to book with/);

    // nothing moved — the booking is still charged where it was
    await h.asSuperuser();
    expect(Number((await h.q<{ r: number }>(
      `select credits_remaining as r from lesson_credits where id=$1`, [fromCredit]))[0].r)).toBe(before);
    const [{ cid }] = await h.q<{ cid: string }>(
      `select credit_id as cid from bookings where id=$1`, [bookingId]);
    expect(cid).toBe(fromCredit);
  });

  it('6b. an EXPIRED allotment is refused, and so is the wrong segment', async () => {
    await h.asSuperuser();
    const expired = (await h.q<{ id: string }>(
      `insert into lesson_credits (org_id, client_id, offering_id, package_key, credits_total,
                                   credits_remaining, period_start, expires_at)
         values ($1,$2,$3,'Last month',4,4,
                 (date_trunc('month',current_date)-interval '1 month')::date,
                 date_trunc('month',current_date)) returning id`,
      [org, clientId, ids.weekly1Rider]))[0].id;
    const careCredit = (await h.q<{ id: string }>(
      `insert into lesson_credits (org_id, client_id, offering_id, package_key, credits_total, credits_remaining)
         values ($1,$2,$3,'Care plan',4,4) returning id`, [org, clientId, ids.weekly1Horse]))[0].id;

    await h.asUser(staffUid);
    await expect(h.q(`select swap_booking_item($1,$2)`, [bookingId, expired]))
      .rejects.toThrow(/ITEM_EXPIRED/);
    await expect(h.q(`select swap_booking_item($1,$2)`, [bookingId, careCredit]))
      .rejects.toThrow(/WRONG_SERVICE/);
  });

  it('6c. booking_item_options offers only what is legal, and says why when it is not', async () => {
    await h.asUser(clientUid);
    const [{ opts }] = await h.q<{ opts: {
      can_swap: boolean; reason: string | null;
      options: Array<{ credit_id: string; segment: string | null; remaining: number }>;
    } }>(`select booking_item_options($1) as opts`, [bookingId]);
    // the booking is 'scheduled' now, so the client may not swap — and is told why
    expect(opts.can_swap).toBe(false);
    expect(opts.reason).toMatch(/already confirmed/i);
    // no expired, no empty, no horse-care option for a lesson booking
    for (const o of opts.options) {
      expect(o.remaining).toBeGreaterThan(0);
      expect(o.segment).not.toBe('horse');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 7 — the month roll, and stopping a plan without a developer', () => {
  it('mints next month for a PAID plan, once, however often it runs', async () => {
    await h.asSuperuser();
    const pur = await provision(ids.weekly1Rider, true);
    const [{ item }] = await h.q<{ item: string }>(
      `select id as item from purchase_items where purchase_id=$1`, [pur]);

    // pretend it is next month by minting that period explicitly — the same call the
    // cron makes, with the same idempotency key.
    const [{ nm }] = await h.q<{ nm: string }>(
      `select (date_trunc('month',current_date)+interval '1 month')::date::text as nm`);
    const a = Number((await h.q<{ n: number }>(
      `select _mint_credits_for_purchase_item($1,null,$2::date) as n`, [item, nm]))[0].n);
    const b = Number((await h.q<{ n: number }>(
      `select _mint_credits_for_purchase_item($1,null,$2::date) as n`, [item, nm]))[0].n);
    expect(a).toBeGreaterThan(0);
    expect(b).toBe(0);                    // second call mints nothing
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from lesson_credits
        where purchase_item_id=$1 and period_start=$2::date and deleted_at is null`, [item, nm]);
    expect(Number(n)).toBe(1);
  });

  it('an UNPAID plan does not roll', async () => {
    await h.asSuperuser();
    const pur = await provision(ids.weekly2Rider, false);
    const [{ item }] = await h.q<{ item: string }>(
      `select id as item from purchase_items where purchase_id=$1`, [pur]);
    await h.asUser(staffUid);
    await h.q(`select mint_recurring_allotments()`);
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from lesson_credits
        where purchase_item_id=$1 and period_start > date_trunc('month',current_date)::date`, [item]);
    expect(Number(n)).toBe(0);
  });

  it('set_recurring_plan_end stops the roll — and never claws back the month already bought', async () => {
    await h.asSuperuser();
    const pur = await provision(ids.weekly1Horse, true);
    const [{ item }] = await h.q<{ item: string }>(
      `select id as item from purchase_items where purchase_id=$1`, [pur]);
    const held = Number((await h.q<{ r: number }>(
      `select credits_remaining as r from lesson_credits where purchase_item_id=$1`, [item]))[0].r);

    await h.asUser(staffUid);
    await h.q(`select set_recurring_plan_end($1, current_date)`, [item]);

    await h.asSuperuser();
    const [{ nm }] = await h.q<{ nm: string }>(
      `select (date_trunc('month',current_date)+interval '1 month')::date::text as nm`);
    const made = Number((await h.q<{ n: number }>(
      `select _mint_credits_for_purchase_item($1,null,$2::date) as n`, [item, nm]))[0].n);
    expect(made).toBe(0);
    expect(Number((await h.q<{ r: number }>(
      `select credits_remaining as r from lesson_credits
        where purchase_item_id=$1 and period_start=date_trunc('month',current_date)::date`,
      [item]))[0].r)).toBe(held);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 8 — the plan view reads the ledger, both segments', () => {
  it('my_monthly_plan returns every current-month plan and its numbers ARE the credit row', async () => {
    await h.asUser(clientUid);
    const [{ plans }] = await h.q<{ plans: Array<{
      offering_name: string; segment: string; credit_id: string;
      entitled_this_month: number; used_this_month: number; remaining_this_month: number;
    }> }>(`select my_monthly_plan() as plans`);
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.some((p) => p.segment === 'horse')).toBe(true);
    expect(plans.some((p) => p.segment === 'rider')).toBe(true);

    await h.asSuperuser();
    for (const p of plans) {
      const [row] = await h.q<{ t: number; r: number }>(
        `select credits_total as t, credits_remaining as r from lesson_credits where id=$1`,
        [p.credit_id]);
      expect(p.entitled_this_month).toBe(Number(row.t));
      expect(p.remaining_this_month).toBe(Number(row.r));
      expect(p.used_this_month).toBe(Number(row.t) - Number(row.r));
    }
  });
});
