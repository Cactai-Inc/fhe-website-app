/**
 * Request Inbox (20260703080000) — the staff rails for public booking requests
 * (BOOKING_FLOWS_PLAN §2 Flow A step 2):
 *
 *  - requests grows staff_notes '[]' + checklist NULL (additive; the anon
 *    public-form INSERT keeps working untouched).
 *  - staff (not just admins) read/update the inbox; plain members see nothing.
 *  - append_request_note: staff-gated, appends {at, by_name: caller profile
 *    first name, note}, returns the updated timeline.
 *  - set_request_checklist: staff-gated, stores the flat key→boolean object.
 *  - provision_lesson_invitation v2: the trailing OPTIONAL p_request_id stamps
 *    invitations.request_id and flips the request to 'invited'; BOTH call
 *    shapes work — the old 7-arg positional/named calls (default NULL) and the
 *    new 8-arg call the API now sends.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let admin: string;
let employee: string;
let member: string;
let tierId: string;
let requestId: string;

const PROPOSED_TIMES = JSON.stringify([
  {
    date: '2026-07-05',
    end: '2026-07-11',
    label: 'Jul 5 – Jul 11, 2026',
    time: 'Weekdays AM & PM · Weekends AM',
    days: 'Mon, Wed, Sat',
  },
]);

const NOTES = [
  'Excited to start!',
  '',
  '— Availability & experience —',
  'Riding experience: 1–2 years',
  'Preferred times: Weekdays AM & PM · Weekends AM',
  'Days: Mon, Wed, Sat',
  'Weeks: Jul 5 – Jul 11, 2026',
].join('\n');

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  admin = await h.createAuthUser({ email: 'inbox-admin@fhe.test', role: 'ADMIN' });
  employee = await h.createAuthUser({ email: 'inbox-staff@fhe.test', role: 'EMPLOYEE' });
  member = await h.createAuthUser({ email: 'inbox-member@fhe.test', role: 'USER' });
  await h.q(`update profiles set first_name='Odile' where user_id=$1`, [admin]);
  const [t] = await h.q<{ id: string }>(
    `select t.id from offering_tiers t join offerings o on o.id = t.offering_id
     where o.slug = 'riding-lesson' and t.label = '4-Lesson Punch Card'`);
  tierId = t.id;

  // The public form's write shape (anon INSERT — must stay working untouched).
  // No RETURNING: anon has no SELECT policy on requests, and RETURNING enforces
  // it — the real form inserts blind, so the test pre-generates the id.
  const [{ id: newId }] = await h.q<{ id: string }>(`select gen_random_uuid() as id`);
  requestId = newId;
  await h.asAnon();
  await h.q(
    `insert into requests (id, contact_name, contact_email, contact_phone, contact_method, proposed_times, notes)
     values ($1, 'Cara Novice', 'cara@rider.test', '555-0107', 'text', $2::jsonb, $3)`,
    [requestId, PROPOSED_TIMES, NOTES]);
  await h.q(
    `insert into request_selections (request_id, offering_slug, label)
     values ($1, 'riding-lesson', 'Riding Lessons — 4-Lesson Punch Card')`,
    [requestId]);
});

afterAll(async () => {
  await h?.close();
});

describe('requests — staff working state (additive columns + staff access)', () => {
  it('a fresh public request defaults staff_notes=[] and checklist=NULL', async () => {
    await h.asUser(admin);
    const [row] = await h.q<{ staff_notes: unknown[]; checklist: unknown; status: string }>(
      `select staff_notes, checklist, status from requests where id=$1`, [requestId]);
    expect(row.staff_notes).toEqual([]);
    expect(row.checklist).toBeNull();
    expect(row.status).toBe('new');
  });

  it('an EMPLOYEE (staff, not admin) reads the inbox and its selections', async () => {
    await h.asUser(employee);
    const rows = await h.q<{ contact_name: string }>(
      `select contact_name from requests where id=$1`, [requestId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].contact_name).toBe('Cara Novice');
    const sels = await h.q<{ label: string }>(
      `select label from request_selections where request_id=$1`, [requestId]);
    expect(sels.map((s) => s.label)).toEqual(['Riding Lessons — 4-Lesson Punch Card']);
  });

  it('staff mark a request contacted via a direct UPDATE (the seam the UI uses)', async () => {
    await h.asUser(employee);
    await h.q(`update requests set status='contacted' where id=$1`, [requestId]);
    const [row] = await h.q<{ status: string }>(
      `select status from requests where id=$1`, [requestId]);
    expect(row.status).toBe('contacted');
  });

  it('a plain member reads nothing and their UPDATE matches no rows', async () => {
    await h.asUser(member);
    expect(await h.q(`select id from requests`)).toHaveLength(0);
    await h.q(`update requests set status='expired' where id=$1`, [requestId]);
    await h.asUser(admin);
    const [row] = await h.q<{ status: string }>(
      `select status from requests where id=$1`, [requestId]);
    expect(row.status).toBe('contacted'); // untouched
  });
});

describe('append_request_note', () => {
  it('rejects a plain member and anon (staff-gated)', async () => {
    await h.asUser(member);
    await expect(h.q(`select append_request_note($1, 'sneaky note')`, [requestId]))
      .rejects.toThrow(/not authorized/);
    await h.asAnon();
    await expect(h.q(`select append_request_note($1, 'anon note')`, [requestId]))
      .rejects.toThrow();
  });

  it('appends {at, by_name: profile first name, note} and returns the timeline', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ append_request_note: Array<{ at: string; by_name: string; note: string }> }>(
      `select append_request_note($1, 'Called — she prefers Saturday mornings.')`, [requestId]);
    const timeline = r.append_request_note;
    expect(timeline).toHaveLength(1);
    expect(timeline[0].by_name).toBe('Odile');
    expect(timeline[0].note).toBe('Called — she prefers Saturday mornings.');
    expect(new Date(timeline[0].at).getTime()).not.toBeNaN();
  });

  it('appends (never rewrites): a second note lands after the first', async () => {
    await h.asUser(employee); // no first_name on this profile → email stands in
    const [r] = await h.q<{ append_request_note: Array<{ by_name: string; note: string }> }>(
      `select append_request_note($1, 'Confirmed the punch card fits.')`, [requestId]);
    expect(r.append_request_note).toHaveLength(2);
    expect(r.append_request_note[0].note).toBe('Called — she prefers Saturday mornings.');
    expect(r.append_request_note[1].by_name).toBe('inbox-staff@fhe.test');
    expect(r.append_request_note[1].note).toBe('Confirmed the punch card fits.');
  });

  it('rejects an empty note and an unknown request', async () => {
    await h.asUser(admin);
    await expect(h.q(`select append_request_note($1, '   ')`, [requestId]))
      .rejects.toThrow(/note text is required/);
    await expect(h.q(`select append_request_note(gen_random_uuid(), 'orphan')`))
      .rejects.toThrow(/unknown request/);
  });
});

describe('set_request_checklist', () => {
  const CHECKLIST = {
    spoke_with_client: true,
    experience_assessed: true,
    program_identified: true,
    times_discussed: false,
    payment_agreed: false,
  };

  it('rejects a plain member (staff-gated)', async () => {
    await h.asUser(member);
    await expect(h.q(
      `select set_request_checklist($1, $2::jsonb)`, [requestId, JSON.stringify(CHECKLIST)]))
      .rejects.toThrow(/not authorized/);
  });

  it('stores the flat key→boolean object and returns it; staff read it back', async () => {
    await h.asUser(employee);
    const [r] = await h.q<{ set_request_checklist: Record<string, boolean> }>(
      `select set_request_checklist($1, $2::jsonb)`, [requestId, JSON.stringify(CHECKLIST)]);
    expect(r.set_request_checklist).toEqual(CHECKLIST);

    await h.asUser(admin);
    const [row] = await h.q<{ checklist: Record<string, boolean> }>(
      `select checklist from requests where id=$1`, [requestId]);
    expect(row.checklist).toEqual(CHECKLIST);
  });

  it('overwrites with the latest state (the UI persists the whole object per toggle)', async () => {
    await h.asUser(admin);
    const all = Object.fromEntries(Object.keys(CHECKLIST).map((k) => [k, true]));
    await h.q(`select set_request_checklist($1, $2::jsonb)`, [requestId, JSON.stringify(all)]);
    const [row] = await h.q<{ checklist: Record<string, boolean> }>(
      `select checklist from requests where id=$1`, [requestId]);
    expect(row.checklist).toEqual(all);
  });

  it('rejects a non-object checklist and an unknown request', async () => {
    await h.asUser(admin);
    await expect(h.q(`select set_request_checklist($1, '[true]'::jsonb)`, [requestId]))
      .rejects.toThrow(/must be a JSON object/);
    await expect(h.q(`select set_request_checklist(gen_random_uuid(), '{}'::jsonb)`))
      .rejects.toThrow(/unknown request/);
  });
});

describe('provision_lesson_invitation v2 — request linkage', () => {
  it('8-arg call: provisions, stamps invitations.request_id, flips the request to invited', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ provision_lesson_invitation: {
      invitation_id: string; token: string; engagement_id: string; request_id: string;
    } }>(
      `select provision_lesson_invitation('cara@rider.test','Cara','Novice',$1,true,'Zelle',null,$2)`,
      [tierId, requestId]);
    const out = r.provision_lesson_invitation;
    expect(out.request_id).toBe(requestId);

    await h.asSuperuser();
    const [inv] = await h.q<{ request_id: string; status: string }>(
      `select request_id, status from invitations where token=$1`, [out.token]);
    expect(inv.request_id).toBe(requestId);
    expect(inv.status).toBe('sent');

    const [req] = await h.q<{ status: string }>(
      `select status from requests where id=$1`, [requestId]);
    expect(req.status).toBe('invited');

    const [eng] = await h.q<{ status: string; service_type: string }>(
      `select status, service_type from engagements where id=$1`, [out.engagement_id]);
    expect(eng).toEqual({ status: 'AWAITING_SIGNATURE', service_type: 'RIDING_LESSON' });
  });

  it('7-arg positional call (the pre-v2 signature) still works — no request touched', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ provision_lesson_invitation: {
      token: string; engagement_id: string; request_id: string | null;
    } }>(
      `select provision_lesson_invitation('legacy@rider.test','Lena','Legacy',$1,false,null,null)`,
      [tierId]);
    const out = r.provision_lesson_invitation;
    expect(out.request_id).toBeNull();

    await h.asSuperuser();
    const [inv] = await h.q<{ request_id: string | null }>(
      `select request_id from invitations where token=$1`, [out.token]);
    expect(inv.request_id).toBeNull();
  });

  it('named-args call without p_request_id (the legacy API payload) still works', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ provision_lesson_invitation: { token: string; request_id: string | null } }>(
      `select provision_lesson_invitation(
         p_email => 'named@rider.test', p_first_name => 'Nia', p_last_name => 'Named',
         p_tier_id => $1, p_mark_paid => true, p_payment_method => 'Cash', p_notes => 'walk-in')`,
      [tierId]);
    expect(r.provision_lesson_invitation.request_id).toBeNull();
    expect(r.provision_lesson_invitation.token).toBeTruthy();
  });

  it('an unknown p_request_id is rejected (FK), leaving no invitation behind', async () => {
    await h.asUser(admin);
    await expect(h.q(
      `select provision_lesson_invitation('fk@rider.test','Faye','Kay',$1,false,null,null,gen_random_uuid())`,
      [tierId])).rejects.toThrow();
    await h.asSuperuser();
    expect(await h.q(`select id from invitations where email='fk@rider.test'`)).toHaveLength(0);
  });

  it('non-staff still cannot provision (gate unchanged by the re-issue)', async () => {
    await h.asUser(member);
    await expect(h.q(
      `select provision_lesson_invitation('x@y.test','A','B',$1,false,null,null,$2)`,
      [tierId, requestId])).rejects.toThrow(/not authorized/);
  });
});
