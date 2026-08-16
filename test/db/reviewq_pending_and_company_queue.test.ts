/**
 * TASK REVIEWQ — a booking is REQUESTED until the company says otherwise.
 *
 * book_open_slot wrote status='scheduled' literally when a client claimed an
 * already-published open slot (FLOWTRACE item 10, verified live) — production
 * has never held a pending client booking. request_open_time already wrote
 * 'pending' but had no company-side queue that could act on it beyond a
 * single Confirm button gated on a state no booking had ever reached
 * (FLOWTRACE item 11). The only refusal mechanism, delete_calendar_item, hard
 * -DELETEd the row — no deleted_at, orphaning audit events and leaving spent
 * credits pointing at bookings that no longer exist.
 *
 * This file proves the four migrations against the pre-REVIEWQ prod schema
 * (the committed snapshot): they apply cleanly and replay idempotently, then
 * exercises the six shapes THE TEST THIS MUST PASS names — confirm, decline
 * +refund+reason, propose+accept, propose+decline (round-trips through
 * booking_change_requests, no new table), and delete_calendar_item retiring
 * vs. still hard-deleting an untouched slot.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from './harness';

const MIGRATIONS = [
  '20260815T2200_reviewq_m1_schema_widen.sql',
  '20260815T2300_reviewq_m2_write_paths_land_pending.sql',
  '20260815T2400_reviewq_m3_decision_rpcs.sql',
  '20260815T2500_reviewq_m4_delete_never_destroys_evidence.sql',
];

let h: TestDb;
let org: string;
let staffUid: string;
let clientUid: string;
let clientId: string;
let creditId: string;
let offeringId: string;

async function makeSlot(startsAt: string, endsAt: string): Promise<string> {
  await h.asSuperuser();
  return (await h.q<{ id: string }>(
    `insert into bookings (org_id, status, is_flexible, kind, starts_at, ends_at, offering_id)
       values ($1,'available',true,'lesson',$2,$3,$4) returning id`,
    [org, startsAt, endsAt, offeringId]))[0].id;
}

async function asClient() { await h.asUser(clientUid); }
async function asStaff() { await h.asUser(staffUid); }

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  // bookings INSERT/UPDATE fires trg_status_bookings, which FKs into
  // status_events_vocab(entity_type='offering', code=<bucket>) — same seed
  // creditfix's test needed for purchases/entity_type='order', for the same
  // reason (status_events_vocab isn't a snapshot-seeded table).
  await h.q(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'offering', c, c from unnest(array['pending','scheduled','cancelled','completed']) c
    on conflict do nothing;`);

  // lesson_credits.purchase_id postdates this snapshot (2026-08-03) — added
  // same-day-but-later by CREDITFIX (20260815T0500), which prod already
  // carried by the time REVIEWQ's migrations ran. _refund_booking_credit
  // (M3) tags a refund with the original credit's purchase_id, same
  // defensive ADD COLUMN IF NOT EXISTS reasoning as CREDITFIX's own test.
  await h.q(`ALTER TABLE lesson_credits ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL;`);

  staffUid = await h.createAuthUser({ role: 'ADMIN', org });
  clientUid = await h.createAuthUser({ role: 'USER', org });
  const contact = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name, email)
       values ($1,'Reviewq','Client','reviewq-client@test.fhe') returning id`, [org]))[0].id;
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contact, clientUid]);
  clientId = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, contact]))[0].id;

  offeringId = (await h.q<{ id: string }>(
    `insert into offerings (org_id, segment, name, slug, active, service_type,
                            config_kind, price_unit, unit_count, price_amount)
       values ($1,'rider','Single Lesson','reviewq-single',true,'RIDING_LESSON',
               'scheduled','session',1,150) returning id`, [org]))[0].id;

  creditId = (await h.q<{ id: string }>(
    `insert into lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining, offering_id)
       values ($1,$2,'Single Lesson',1,1,$3) returning id`, [org, clientId, offeringId]))[0].id;
});

afterAll(async () => { await h?.close(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('BEFORE the migration — the bug, reproduced on the shipped body', () => {
  it('book_open_slot still writes status=\'scheduled\' literally', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select pg_get_functiondef('public.book_open_slot(uuid,uuid)'::regprocedure) as src`);
    expect(src).toContain("status = 'scheduled'");
    expect(src).not.toContain("'new'");
  });

  it('delete_calendar_item still hard-DELETEs with no history check', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select pg_get_functiondef('public.delete_calendar_item(uuid,text)'::regprocedure) as src`);
    expect(src).not.toContain('deleted_at');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the migrations apply — and replay', () => {
  it('all four apply cleanly, twice (the journal is hand-replayed)', async () => {
    await h.asSuperuser();
    for (const file of MIGRATIONS) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await h.db.exec(sql);
    }
    for (const file of MIGRATIONS) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await h.db.exec(sql);
    }
  });

  it('book_open_slot now lands pending and decide_booking_change is a single 4-arg signature', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select pg_get_functiondef('public.book_open_slot(uuid,uuid)'::regprocedure) as src`);
    expect(src).toContain("status = 'pending'");
    expect(src).not.toContain("status = 'scheduled'");

    const rows = await h.q<{ nargs: number }>(
      `select pronargs as nargs from pg_proc where proname='decide_booking_change'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].nargs).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('R1 — book_open_slot lands pending, not scheduled', () => {
  let bookingId: string;

  it('claiming an open slot debits the credit but leaves the booking PENDING', async () => {
    bookingId = await makeSlot('2027-01-04T15:00:00Z', '2027-01-04T16:00:00Z');
    await asClient();
    const res = await h.q<{ book_open_slot: { status: string; kind: string } }>(
      `select book_open_slot($1) as book_open_slot`, [bookingId]);
    expect(res[0].book_open_slot.status).toBe('pending');

    await h.asSuperuser();
    const [b] = await h.q<{ status: string; credit_id: string }>(
      `select status, credit_id from bookings where id=$1`, [bookingId]);
    expect(b.status).toBe('pending');
    expect(b.credit_id).toBe(creditId);

    const [c] = await h.q<{ credits_remaining: number }>(
      `select credits_remaining from lesson_credits where id=$1`, [creditId]);
    expect(c.credits_remaining).toBe(0);
  });

  it('inserts exactly one companion booking_change_requests row (request_kind=\'new\')', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ request_kind: string; status: string; awaiting_client: boolean }>(
      `select request_kind, status, awaiting_client from booking_change_requests where booking_id=$1`,
      [bookingId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].request_kind).toBe('new');
    expect(rows[0].status).toBe('pending');
    expect(rows[0].awaiting_client).toBe(false);
  });

  it('shows up in the staff queue (open_change_requests) and nowhere else new', async () => {
    await asStaff();
    const [{ open_change_requests: list }] = await h.q<{ open_change_requests: Array<{ booking_id: string; kind: string }> }>(
      `select open_change_requests() as open_change_requests`);
    expect(list.some((r) => r.booking_id === bookingId && r.kind === 'new')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('R2/test#3 — confirm: staff decides, client notified, companion row closes', () => {
  it('confirm -> scheduled, notification row proves it (fire-and-forget lesson)', async () => {
    const bookingId = await makeSlot('2027-01-05T15:00:00Z', '2027-01-05T16:00:00Z');
    // top up: this client already spent their one credit above
    await h.asSuperuser();
    await h.q(`update lesson_credits set credits_remaining=1 where id=$1`, [creditId]);

    await asClient();
    await h.q(`select book_open_slot($1)`, [bookingId]);

    await asStaff();
    const [cr] = await h.q<{ id: string }>(
      `select id from booking_change_requests where booking_id=$1 and status='pending'`, [bookingId]);
    const [res] = await h.q<{ decide_booking_change: { status: string; kind: string } }>(
      `select decide_booking_change($1, true, false, null) as decide_booking_change`, [cr.id]);
    expect(res.decide_booking_change.status).toBe('approved');

    await h.asSuperuser();
    const [b] = await h.q<{ status: string }>(`select status from bookings where id=$1`, [bookingId]);
    expect(b.status).toBe('scheduled');
    const [crAfter] = await h.q<{ status: string }>(
      `select status from booking_change_requests where id=$1`, [cr.id]);
    expect(crAfter.status).toBe('approved');

    const notifs = await h.q<{ kind: string }>(
      `select kind from notifications where user_id=$1 and kind='booking_confirmed'`, [clientUid]);
    expect(notifs.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('R3/test#4 — decline: terminal status, row survives, credit refunded, reason recorded', () => {
  it('decline mints a change_credit refund and records the reason on the row', async () => {
    await h.asSuperuser();
    await h.q(`update lesson_credits set credits_remaining=1 where id=$1`, [creditId]);
    const bookingId = await makeSlot('2027-01-06T15:00:00Z', '2027-01-06T16:00:00Z');

    await asClient();
    await h.q(`select book_open_slot($1)`, [bookingId]);

    await asStaff();
    const [cr] = await h.q<{ id: string }>(
      `select id from booking_change_requests where booking_id=$1 and status='pending'`, [bookingId]);
    const [res] = await h.q<{ decide_booking_change: { status: string; credit_refunded: boolean } }>(
      `select decide_booking_change($1, false, false, 'not this week') as decide_booking_change`, [cr.id]);
    expect(res.decide_booking_change.status).toBe('rejected');
    expect(res.decide_booking_change.credit_refunded).toBe(true);

    await h.asSuperuser();
    // row survives — never DELETEd, terminal status, not soft-retired either
    // (delete_calendar_item's deleted_at is a separate mechanism — R3 §1).
    const [b] = await h.q<{ status: string; deleted_at: string | null }>(
      `select status, deleted_at from bookings where id=$1`, [bookingId]);
    expect(b.status).toBe('cancelled');
    expect(b.deleted_at).toBeNull();

    const [crAfter] = await h.q<{ staff_note: string }>(
      `select staff_note from booking_change_requests where id=$1`, [cr.id]);
    expect(crAfter.staff_note).toBe('not this week');

    const refunds = await h.q<{ credits_remaining: number }>(
      `select credits_remaining from lesson_credits where client_id=$1 and package_key='change_credit'`,
      [clientId]);
    expect(refunds.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('R2/R4 — propose another time: round-trips through booking_change_requests, no new table', () => {
  it('client accepts a staff-proposed counter-time: booking shifts and confirms', async () => {
    await h.asSuperuser();
    await h.q(`update lesson_credits set credits_remaining=1 where id=$1`, [creditId]);
    const bookingId = await makeSlot('2027-01-07T15:00:00Z', '2027-01-07T16:00:00Z');

    await asClient();
    await h.q(`select book_open_slot($1)`, [bookingId]);

    await asStaff();
    const [proposed] = await h.q<{ propose_booking_time: { change_id: string; awaiting_client: boolean } }>(
      `select propose_booking_time($1, '2027-01-08T17:00:00Z', '2027-01-08T18:00:00Z', 'next day works') as propose_booking_time`,
      [bookingId]);
    expect(proposed.propose_booking_time.awaiting_client).toBe(true);
    const changeId = proposed.propose_booking_time.change_id;

    // staff cannot decide it anymore — it's the client's turn
    await expect(h.q(`select decide_booking_change($1, true, false, null)`, [changeId]))
      .rejects.toThrow(/not authorized/);

    await asClient();
    const [res] = await h.q<{ decide_booking_change: { status: string } }>(
      `select decide_booking_change($1, true, false, null) as decide_booking_change`, [changeId]);
    expect(res.decide_booking_change.status).toBe('approved');

    await h.asSuperuser();
    const [b] = await h.q<{ status: string; starts_at: string }>(
      `select status, starts_at from bookings where id=$1`, [bookingId]);
    expect(b.status).toBe('scheduled');
    expect(new Date(b.starts_at).toISOString()).toBe('2027-01-08T17:00:00.000Z');
  });

  it('client declines a staff-proposed counter-time: round-trips to a fresh pending row, booking stays pending', async () => {
    await h.asSuperuser();
    await h.q(`update lesson_credits set credits_remaining=1 where id=$1`, [creditId]);
    const bookingId = await makeSlot('2027-01-09T15:00:00Z', '2027-01-09T16:00:00Z');

    await asClient();
    await h.q(`select book_open_slot($1)`, [bookingId]);

    await asStaff();
    const [proposed] = await h.q<{ propose_booking_time: { change_id: string } }>(
      `select propose_booking_time($1, '2027-01-10T17:00:00Z', '2027-01-10T18:00:00Z', null) as propose_booking_time`,
      [bookingId]);

    await asClient();
    const [res] = await h.q<{ decide_booking_change: { status: string; booking_status: string } }>(
      `select decide_booking_change($1, false, false, null) as decide_booking_change`,
      [proposed.propose_booking_time.change_id]);
    expect(res.decide_booking_change.status).toBe('withdrawn');
    expect(res.decide_booking_change.booking_status).toBe('pending');

    await h.asSuperuser();
    const [b] = await h.q<{ status: string }>(`select status from bookings where id=$1`, [bookingId]);
    expect(b.status).toBe('pending');

    // exactly one row is 'pending' again — the invariant every pending
    // booking has exactly one open companion row holds after the round trip.
    const openRows = await h.q<{ status: string }>(
      `select status from booking_change_requests where booking_id=$1 and status='pending'`, [bookingId]);
    expect(openRows).toHaveLength(1);
    const withdrawnRows = await h.q<{ status: string }>(
      `select status from booking_change_requests where booking_id=$1 and status='withdrawn'`, [bookingId]);
    expect(withdrawnRows).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('R3/test#6 — delete_calendar_item can no longer destroy a booking with history', () => {
  it('retires (never deletes) a pending booking that already carries a client + a credit', async () => {
    await h.asSuperuser();
    await h.q(`update lesson_credits set credits_remaining=1 where id=$1`, [creditId]);
    const bookingId = await makeSlot('2027-01-11T15:00:00Z', '2027-01-11T16:00:00Z');
    await asClient();
    await h.q(`select book_open_slot($1)`, [bookingId]);

    await asStaff();
    const [{ delete_calendar_item: n }] = await h.q<{ delete_calendar_item: number }>(
      `select delete_calendar_item($1, 'one') as delete_calendar_item`, [bookingId]);
    expect(n).toBe(1);

    await h.asSuperuser();
    const rows = await h.q<{ status: string; deleted_at: string | null }>(
      `select status, deleted_at from bookings where id=$1`, [bookingId]);
    // PROVEN by attempting it: the row still exists (not zero rows).
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('cancelled');
    expect(rows[0].deleted_at).not.toBeNull();

    const cr = await h.q<{ status: string }>(
      `select status from booking_change_requests where booking_id=$1 order by created_at desc limit 1`,
      [bookingId]);
    expect(cr[0].status).toBe('withdrawn');
  });

  it('still hard-deletes a plain unclaimed available slot (the legitimate case, unchanged)', async () => {
    const slotId = await makeSlot('2027-01-12T15:00:00Z', '2027-01-12T16:00:00Z');
    await asStaff();
    const [{ delete_calendar_item: n }] = await h.q<{ delete_calendar_item: number }>(
      `select delete_calendar_item($1, 'one') as delete_calendar_item`, [slotId]);
    expect(n).toBe(1);

    await h.asSuperuser();
    const rows = await h.q(`select id from bookings where id=$1`, [slotId]);
    expect(rows).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('R1 — display buckets: pending is its own bucket, not folded into scheduled', () => {
  it('booking_status_code no longer collapses pending into scheduled', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ code: string }>(
      `select booking_status_code(s) as code from unnest(array['pending','pending_slot','pending_payment']) s`);
    for (const r of rows) expect(r.code).toBe('pending');
    const [scheduled] = await h.q<{ code: string }>(`select booking_status_code('scheduled') as code`);
    expect(scheduled.code).toBe('scheduled');
  });

  it('my_lesson_sessions reports a pending lesson as PENDING, not a raw/unbucketed value', async () => {
    await h.asSuperuser();
    await h.q(`update lesson_credits set credits_remaining=1 where id=$1`, [creditId]);
    const bookingId = await makeSlot('2027-01-13T15:00:00Z', '2027-01-13T16:00:00Z');
    await asClient();
    await h.q(`select book_open_slot($1)`, [bookingId]);

    const [{ my_lesson_sessions: sessions }] = await h.q<{ my_lesson_sessions: Array<{ id: string; status: string }> }>(
      `select my_lesson_sessions() as my_lesson_sessions`);
    const mine = sessions.find((s) => s.id === bookingId);
    expect(mine?.status).toBe('PENDING');
  });
});
