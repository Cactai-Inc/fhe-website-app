/**
 * Lesson sessions spine (20260703120000) — real-path data tests:
 *
 *  - schedule_lesson_session: staff-gated; org stamped from the CLIENT row;
 *    overlapping SCHEDULED sessions for the same client rejected; a linked
 *    request flips to 'converted'; the member's app user gets a
 *    lesson_scheduled notification (link /app/schedule).
 *  - complete_lesson_session: SCHEDULED → COMPLETED; debits the OLDEST
 *    lesson_credits row with balance exactly once, stamps credit_id, returns
 *    the live remaining sum; a client with no credits still completes
 *    (debited:false); invalid transitions rejected.
 *  - cancel_lesson_session: SCHEDULED → CANCELLED (member notified,
 *    lesson_cancelled) or NO_SHOW (no notification); invalid transitions
 *    rejected.
 *  - my_lesson_sessions: the member's OWN sessions only, upcoming-first then
 *    recent past; direct table reads are fenced the same way (RLS).
 *  - provision_lesson_invitation v3: a lesson-count tier ALSO grants the
 *    lesson_credits row (package_key = tier label); a cadence tier grants none.
 *  - BACKFILL: the migration's INSERT … NOT EXISTS statement is re-runnable —
 *    running it twice never duplicates, unpaid purchases stay unsynced.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string;
let admin: string;
let employee: string;
let member: string;
let memberClient: string;
let member2: string;
let member2Client: string;
let punchTierId: string;
let weeklyTierId: string;

/** Fixed future windows keep the overlap math deterministic. */
const DAY = 86_400_000;
function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

/** An org-A portal member: contact + clients row + profile.contact_id link. */
async function makeClient(
  first: string,
  last: string,
  email: string,
): Promise<{ uid: string; clientId: string }> {
  await h.asSuperuser();
  const uid = await h.createAuthUser({ email, role: 'USER' });
  const contact = (
    await h.q<{ id: string }>(
      `insert into contacts (org_id, first_name, last_name, email)
       values ($1,$2,$3,$4) returning id`,
      [orgA, first, last, email],
    )
  )[0].id;
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [contact, uid]);
  const clientId = (
    await h.q<{ id: string }>(
      `insert into clients (org_id, contact_id) values ($1,$2) returning id`,
      [orgA, contact],
    )
  )[0].id;
  return { uid, clientId };
}

async function schedule(
  clientId: string,
  startsAt: string,
  endsAt: string,
  extra: { requestId?: string; location?: string } = {},
) {
  const [r] = await h.q<{ schedule_lesson_session: {
    session_id: string; client_id: string; status: string; request_id: string | null;
  } }>(
    `select schedule_lesson_session($1, $2::timestamptz, $3::timestamptz, null, $4, $5, null)`,
    [clientId, startsAt, endsAt, extra.requestId ?? null, extra.location ?? null],
  );
  return r.schedule_lesson_session;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  admin = await h.createAuthUser({ email: 'sessions-admin@fhe.test', role: 'ADMIN' });
  employee = await h.createAuthUser({ email: 'sessions-staff@fhe.test', role: 'EMPLOYEE' });

  const c1 = await makeClient('Rae', 'Rider', 'rae@rider.test');
  member = c1.uid;
  memberClient = c1.clientId;
  const c2 = await makeClient('Nova', 'Nocredits', 'nova@rider.test');
  member2 = c2.uid;
  member2Client = c2.clientId;

  const [punch] = await h.q<{ id: string }>(
    `select t.id from offering_tiers t join offerings o on o.id = t.offering_id
     where o.slug = 'riding-lesson' and t.label = '4-Lesson Punch Card'`);
  punchTierId = punch.id;
  const [weekly] = await h.q<{ id: string }>(
    `select t.id from offering_tiers t join offerings o on o.id = t.offering_id
     where o.slug = 'riding-lesson' and t.label = '2x Weekly'`);
  weeklyTierId = weekly.id;
});

afterAll(async () => {
  await h?.close();
});

describe('schedule_lesson_session — gate, org stamp, notification', () => {
  it('rejects a plain member and anon (staff-gated)', async () => {
    await h.asUser(member);
    await expect(
      schedule(memberClient, iso(2 * DAY), iso(2 * DAY + 3_600_000)),
    ).rejects.toThrow(/not authorized/);
    await h.asAnon();
    await expect(
      schedule(memberClient, iso(2 * DAY), iso(2 * DAY + 3_600_000)),
    ).rejects.toThrow();
  });

  it('an EMPLOYEE books; org stamped from the client row, created_by recorded', async () => {
    await h.asUser(employee);
    const out = await schedule(memberClient, iso(2 * DAY), iso(2 * DAY + 3_600_000), {
      location: 'Main arena',
    });
    expect(out.session_id).toBeTruthy();
    expect(out.status).toBe('SCHEDULED');

    await h.asSuperuser();
    const [row] = await h.q<{
      org_id: string; client_id: string; status: string; location: string; created_by: string;
    }>(`select org_id, client_id, status, location, created_by from lesson_sessions where id=$1`,
      [out.session_id]);
    expect(row.org_id).toBe(orgA);
    expect(row.client_id).toBe(memberClient);
    expect(row.status).toBe('SCHEDULED');
    expect(row.location).toBe('Main arena');
    expect(row.created_by).toBe(employee);
  });

  it('notifies the member: lesson_scheduled, booked-time title, /app/schedule link', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ kind: string; title: string; link: string; org_id: string }>(
      `select kind, title, link, org_id from notifications where user_id=$1 and kind='lesson_scheduled'`,
      [member]);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].title).toMatch(/^Your lesson is booked — /);
    expect(rows[0].link).toBe('/app/schedule');
    expect(rows[0].org_id).toBe(orgA);
  });

  it('rejects an overlapping SCHEDULED session for the same client, clearly', async () => {
    await h.asUser(admin);
    // starts inside the 2-day-out booking made above
    await expect(
      schedule(memberClient, iso(2 * DAY + 1_800_000), iso(2 * DAY + 5_400_000)),
    ).rejects.toThrow(/already has a lesson scheduled/);
    // a non-overlapping window later the same day is fine
    const ok = await schedule(memberClient, iso(2 * DAY + 7_200_000), iso(2 * DAY + 10_800_000));
    expect(ok.status).toBe('SCHEDULED');
  });

  it('another client may take the same window (the overlap fence is per client)', async () => {
    await h.asUser(admin);
    const ok = await schedule(member2Client, iso(2 * DAY), iso(2 * DAY + 3_600_000));
    expect(ok.status).toBe('SCHEDULED');
  });

  it('rejects an inverted window and an unknown client', async () => {
    await h.asUser(admin);
    await expect(
      schedule(memberClient, iso(5 * DAY), iso(5 * DAY - 3_600_000)),
    ).rejects.toThrow(/end must be after the start/);
    await h.asUser(admin);
    await expect(
      h.q(`select schedule_lesson_session(gen_random_uuid(), now(), now() + interval '1 hour')`),
    ).rejects.toThrow(/unknown client/);
  });

  it('a request linked via p_request_id flips to converted and lands on the session', async () => {
    await h.asSuperuser();
    const [{ id: requestId }] = await h.q<{ id: string }>(
      `insert into requests (contact_name, contact_email, status)
       values ('Rae Rider', 'rae@rider.test', 'invited') returning id`);

    await h.asUser(admin);
    const out = await schedule(memberClient, iso(4 * DAY), iso(4 * DAY + 3_600_000), {
      requestId,
    });
    expect(out.request_id).toBe(requestId);

    await h.asSuperuser();
    const [req] = await h.q<{ status: string }>(`select status from requests where id=$1`, [requestId]);
    expect(req.status).toBe('converted');
    const [sess] = await h.q<{ request_id: string }>(
      `select request_id from lesson_sessions where id=$1`, [out.session_id]);
    expect(sess.request_id).toBe(requestId);
  });
});

describe('complete_lesson_session — debits the oldest credit exactly once', () => {
  let oldCredit: string;
  let newCredit: string;
  let sessionA: string;
  let sessionB: string;

  beforeAll(async () => {
    await h.asSuperuser();
    // two ledger rows: the OLDER purchase has 1 credit left, the newer 4.
    oldCredit = (
      await h.q<{ id: string }>(
        `insert into lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining, purchased_at)
         values ($1,$2,'4-Lesson Punch Card',4,1, now() - interval '30 days') returning id`,
        [orgA, memberClient],
      )
    )[0].id;
    newCredit = (
      await h.q<{ id: string }>(
        `insert into lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining, purchased_at)
         values ($1,$2,'4-Lesson Punch Card',4,4, now() - interval '1 day') returning id`,
        [orgA, memberClient],
      )
    )[0].id;
    await h.asUser(admin);
    sessionA = (await schedule(memberClient, iso(7 * DAY), iso(7 * DAY + 3_600_000))).session_id;
    sessionB = (await schedule(memberClient, iso(8 * DAY), iso(8 * DAY + 3_600_000))).session_id;
  });

  it('rejects a plain member (staff-gated)', async () => {
    await h.asUser(member);
    await expect(h.q(`select complete_lesson_session($1)`, [sessionA]))
      .rejects.toThrow(/not authorized/);
  });

  it('debits the OLDEST row with balance, stamps credit_id, returns the live sum', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ complete_lesson_session: {
      status: string; debited: boolean; credit_id: string; credits_remaining: number;
    } }>(`select complete_lesson_session($1)`, [sessionA]);
    const out = r.complete_lesson_session;
    expect(out.status).toBe('COMPLETED');
    expect(out.debited).toBe(true);
    expect(out.credit_id).toBe(oldCredit);
    expect(out.credits_remaining).toBe(4); // 0 left on the old row + 4 on the new

    await h.asSuperuser();
    const [oldRow] = await h.q<{ credits_remaining: number }>(
      `select credits_remaining from lesson_credits where id=$1`, [oldCredit]);
    expect(oldRow.credits_remaining).toBe(0);
    const [newRow] = await h.q<{ credits_remaining: number }>(
      `select credits_remaining from lesson_credits where id=$1`, [newCredit]);
    expect(newRow.credits_remaining).toBe(4); // untouched
    const [sess] = await h.q<{ status: string; credit_id: string }>(
      `select status, credit_id from lesson_sessions where id=$1`, [sessionA]);
    expect(sess.status).toBe('COMPLETED');
    expect(sess.credit_id).toBe(oldCredit);
  });

  it('a second complete on the same session is rejected (already COMPLETED)', async () => {
    await h.asUser(admin);
    await expect(h.q(`select complete_lesson_session($1)`, [sessionA]))
      .rejects.toThrow(/only a SCHEDULED lesson/);
    // and the ledger was NOT debited again
    await h.asSuperuser();
    const [{ sum }] = await h.q<{ sum: number }>(
      `select coalesce(sum(credits_remaining),0)::int as sum from lesson_credits where client_id=$1`,
      [memberClient]);
    expect(sum).toBe(4);
  });

  it('the next completion moves on to the newer row (the old one is spent)', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ complete_lesson_session: {
      debited: boolean; credit_id: string; credits_remaining: number;
    } }>(`select complete_lesson_session($1)`, [sessionB]);
    expect(r.complete_lesson_session.debited).toBe(true);
    expect(r.complete_lesson_session.credit_id).toBe(newCredit);
    expect(r.complete_lesson_session.credits_remaining).toBe(3);
  });

  it('a client with no credits still completes — debited:false, remaining 0', async () => {
    await h.asUser(admin);
    const [row] = await h.q<{ id: string }>(
      `select id from lesson_sessions where client_id=$1 and status='SCHEDULED' limit 1`,
      [member2Client]);
    const [r] = await h.q<{ complete_lesson_session: {
      status: string; debited: boolean; credit_id: string | null; credits_remaining: number;
    } }>(`select complete_lesson_session($1)`, [row.id]);
    expect(r.complete_lesson_session.status).toBe('COMPLETED');
    expect(r.complete_lesson_session.debited).toBe(false);
    expect(r.complete_lesson_session.credit_id).toBeNull();
    expect(r.complete_lesson_session.credits_remaining).toBe(0);
  });

  it('p_debit_credit => false completes without touching the ledger', async () => {
    await h.asUser(admin);
    const s = await schedule(memberClient, iso(9 * DAY), iso(9 * DAY + 3_600_000));
    const [r] = await h.q<{ complete_lesson_session: {
      debited: boolean; credit_id: string | null; credits_remaining: number | null;
    } }>(`select complete_lesson_session($1, false)`, [s.session_id]);
    expect(r.complete_lesson_session.debited).toBe(false);
    expect(r.complete_lesson_session.credits_remaining).toBeNull();
    await h.asSuperuser();
    const [{ sum }] = await h.q<{ sum: number }>(
      `select coalesce(sum(credits_remaining),0)::int as sum from lesson_credits where client_id=$1`,
      [memberClient]);
    expect(sum).toBe(3); // unchanged since the previous debit
  });
});

describe('cancel_lesson_session — CANCELLED (notified) / NO_SHOW, transitions fenced', () => {
  let toCancel: string;
  let toNoShow: string;

  beforeAll(async () => {
    await h.asUser(admin);
    toCancel = (await schedule(memberClient, iso(10 * DAY), iso(10 * DAY + 3_600_000))).session_id;
    toNoShow = (await schedule(memberClient, iso(11 * DAY), iso(11 * DAY + 3_600_000))).session_id;
  });

  it('rejects a plain member (staff-gated)', async () => {
    await h.asUser(member);
    await expect(h.q(`select cancel_lesson_session($1)`, [toCancel]))
      .rejects.toThrow(/not authorized/);
  });

  it('cancel flips to CANCELLED and notifies the member (lesson_cancelled)', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ cancel_lesson_session: { status: string } }>(
      `select cancel_lesson_session($1)`, [toCancel]);
    expect(r.cancel_lesson_session.status).toBe('CANCELLED');

    await h.asSuperuser();
    const rows = await h.q<{ title: string; link: string }>(
      `select title, link from notifications where user_id=$1 and kind='lesson_cancelled'`,
      [member]);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toMatch(/was cancelled$/);
    expect(rows[0].link).toBe('/app/schedule');
  });

  it('no-show flips to NO_SHOW without a member notification', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ cancel_lesson_session: { status: string } }>(
      `select cancel_lesson_session($1, true)`, [toNoShow]);
    expect(r.cancel_lesson_session.status).toBe('NO_SHOW');

    await h.asSuperuser();
    const rows = await h.q(
      `select id from notifications where user_id=$1 and kind='lesson_cancelled'`, [member]);
    expect(rows).toHaveLength(1); // still only the one from the cancel above
  });

  it('rejects cancelling a non-SCHEDULED session (already CANCELLED / COMPLETED)', async () => {
    await h.asUser(admin);
    await expect(h.q(`select cancel_lesson_session($1)`, [toCancel]))
      .rejects.toThrow(/only a SCHEDULED lesson/);
  });

  it('a cancelled slot frees the window for rebooking (overlap ignores CANCELLED)', async () => {
    await h.asUser(admin);
    const again = await schedule(memberClient, iso(10 * DAY), iso(10 * DAY + 3_600_000));
    expect(again.status).toBe('SCHEDULED');
  });
});

describe('my_lesson_sessions — own rows only, upcoming first', () => {
  let member3: string;
  let member3Client: string;

  beforeAll(async () => {
    const c = await makeClient('Uma', 'Upcoming', 'uma@rider.test');
    member3 = c.uid;
    member3Client = c.clientId;
    await h.asSuperuser();
    // a past session (inserted directly — schedule fences the past via overlap only)
    await h.q(
      `insert into lesson_sessions (org_id, client_id, starts_at, ends_at, status)
       values ($1,$2, now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 'COMPLETED')`,
      [orgA, member3Client]);
    await h.asUser(admin);
    await schedule(member3Client, iso(3 * DAY), iso(3 * DAY + 3_600_000)); // later upcoming
    await schedule(member3Client, iso(1 * DAY), iso(1 * DAY + 3_600_000), { location: 'Trail' }); // soonest
  });

  it('returns the member3 sessions upcoming-first (soonest, later, then the past)', async () => {
    await h.asUser(member3);
    const [r] = await h.q<{ my_lesson_sessions: Array<{
      starts_at: string; status: string; location: string | null;
    }> }>(`select my_lesson_sessions()`);
    const sessions = r.my_lesson_sessions;
    expect(sessions).toHaveLength(3);
    expect(sessions[0].location).toBe('Trail'); // soonest upcoming first
    expect(new Date(sessions[0].starts_at).getTime())
      .toBeLessThan(new Date(sessions[1].starts_at).getTime());
    expect(sessions[2].status).toBe('COMPLETED'); // the past one trails
    expect(new Date(sessions[2].starts_at).getTime()).toBeLessThan(Date.now());
  });

  it("never leaks another member's sessions (RPC and direct reads)", async () => {
    await h.asUser(member3);
    const direct = await h.q<{ client_id: string }>(`select client_id from lesson_sessions`);
    expect(direct.every((s) => s.client_id === member3Client)).toBe(true);

    await h.asUser(member);
    const [r] = await h.q<{ my_lesson_sessions: Array<{ id: string }> }>(
      `select my_lesson_sessions()`);
    // member has their own sessions from earlier blocks, none of member3's
    await h.asSuperuser();
    const member3Ids = (await h.q<{ id: string }>(
      `select id from lesson_sessions where client_id=$1`, [member3Client])).map((x) => x.id);
    expect(r.my_lesson_sessions.some((s) => member3Ids.includes(s.id))).toBe(false);
  });

  it('a user with no client record gets an empty array', async () => {
    await h.asUser(admin); // staff profile, no clients row
    const [r] = await h.q<{ my_lesson_sessions: unknown[] }>(`select my_lesson_sessions()`);
    expect(r.my_lesson_sessions).toEqual([]);
  });
});

describe('provision_lesson_invitation v3 — the purchase grants the credits', () => {
  it('a punch-card tier lands a lesson_credits row (package_key = tier label)', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ provision_lesson_invitation: { contact_id: string } }>(
      `select provision_lesson_invitation('poppy@rider.test','Poppy','Punch',$1,true,'Zelle',null,null)`,
      [punchTierId]);

    await h.asSuperuser();
    const [client] = await h.q<{ id: string }>(
      `select id from clients where contact_id=$1`, [r.provision_lesson_invitation.contact_id]);
    const credits = await h.q<{ package_key: string; credits_total: number; credits_remaining: number }>(
      `select package_key, credits_total, credits_remaining from lesson_credits where client_id=$1`,
      [client.id]);
    expect(credits).toHaveLength(1);
    expect(credits[0]).toEqual({
      package_key: '4-Lesson Punch Card', credits_total: 4, credits_remaining: 4,
    });
  });

  it('a monthly-cadence tier (no lesson count) grants NO credits', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ provision_lesson_invitation: { contact_id: string } }>(
      `select provision_lesson_invitation('wanda@rider.test','Wanda','Weekly',$1,true,'Zelle',null,null)`,
      [weeklyTierId]);

    await h.asSuperuser();
    const [client] = await h.q<{ id: string }>(
      `select id from clients where contact_id=$1`, [r.provision_lesson_invitation.contact_id]);
    expect(await h.q(`select id from lesson_credits where client_id=$1`, [client.id])).toHaveLength(0);
  });
});

// The migration's backfill statement, verbatim — kept re-runnable by design so
// this suite can exercise the NOT EXISTS guard as plain SQL.
const BACKFILL_SQL = `
INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining, purchased_at)
SELECT cp.org_id, e.client_id, cp.tier_label, cp.lessons_included, cp.lessons_included, cp.created_at
FROM client_purchases cp
JOIN engagements e ON e.id = cp.engagement_id
WHERE cp.lessons_included IS NOT NULL
  AND cp.lessons_included > 0
  AND cp.paid
  AND e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM lesson_credits lc
    WHERE lc.client_id = e.client_id
      AND lc.deleted_at IS NULL
      AND lc.package_key = cp.tier_label
      AND lc.credits_total = cp.lessons_included
  )`;

describe('backfill — idempotent credits for pre-v3 paid purchases', () => {
  let legacyClient: string;

  beforeAll(async () => {
    // a legacy paid purchase WITHOUT credits (provisioned before v3) + an
    // unpaid one that must stay unsynced.
    const c = await makeClient('Lena', 'Legacy', 'lena@rider.test');
    legacyClient = c.clientId;
    await h.asSuperuser();
    const [eng] = await h.q<{ id: string }>(
      `insert into engagements (org_id, client_id, service_type, status)
       values ($1,$2,'RIDING_LESSON','ACTIVE') returning id`, [orgA, legacyClient]);
    await h.q(
      `insert into client_purchases (org_id, engagement_id, tier_label, amount, lessons_included, paid)
       values ($1,$2,'8-Lesson Punch Card',950,8,true)`, [orgA, eng.id]);
    await h.q(
      `insert into client_purchases (org_id, engagement_id, tier_label, amount, lessons_included, paid)
       values ($1,$2,'4-Lesson Punch Card',500,4,false)`, [orgA, eng.id]);
  });

  it('first run inserts the missing credits for the PAID purchase only', async () => {
    await h.asSuperuser();
    await h.q(BACKFILL_SQL);
    const rows = await h.q<{ package_key: string; credits_total: number; credits_remaining: number }>(
      `select package_key, credits_total, credits_remaining from lesson_credits where client_id=$1`,
      [legacyClient]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      package_key: '8-Lesson Punch Card', credits_total: 8, credits_remaining: 8,
    });
  });

  it('a second run is a no-op (the NOT EXISTS guard holds), even after a partial spend', async () => {
    await h.asSuperuser();
    await h.q(`update lesson_credits set credits_remaining = 5 where client_id=$1`, [legacyClient]);
    await h.q(BACKFILL_SQL);
    await h.q(BACKFILL_SQL); // and a third, for good measure
    const rows = await h.q<{ credits_remaining: number }>(
      `select credits_remaining from lesson_credits where client_id=$1`, [legacyClient]);
    expect(rows).toHaveLength(1);
    expect(rows[0].credits_remaining).toBe(5); // the spend is preserved, nothing re-granted
  });

  it('v3-provisioned purchases are already guarded (no double grant across the suite)', async () => {
    await h.asSuperuser();
    await h.q(BACKFILL_SQL);
    const [poppy] = await h.q<{ id: string }>(
      `select cl.id from clients cl join contacts c on c.id = cl.contact_id
       where c.email = 'poppy@rider.test'`);
    expect(await h.q(`select id from lesson_credits where client_id=$1`, [poppy.id])).toHaveLength(1);
  });
});
