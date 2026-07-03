/**
 * Notifications spine (20260703090000) — table RLS, member RPCs, producers:
 *  - RLS: the owner reads only their own rows; the RESTRICTIVE org boundary
 *    blocks a row parked in another tenant even for its owner; only staff
 *    (is_admin) may INSERT directly.
 *  - notify_user: staff/service_role only (same fence as
 *    provision_lesson_invitation); org stamped from the TARGET user's profile.
 *  - my_notifications newest-first + limit; my_unread_count;
 *    mark_notification_read is owner-only.
 *  - First real producer: record_signature v4 — a document flipping EXECUTED
 *    notifies the signer's app user (kind document_executed, /app/documents);
 *    re-signing an executed document does NOT duplicate; a signer contact with
 *    no app account is skipped silently.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let admin: string;
let rider: string;
let bystander: string;
let org1: string;
let org2: string;
let tierId: string;
let docs: Array<{ document_id: string; template_key: string; title: string; status: string }>;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  admin = await h.createAuthUser({ email: 'ops@fhe.test', isAdmin: true });
  rider = await h.createAuthUser({ email: 'madeline@rider.test' });
  bystander = await h.createAuthUser({ email: 'bystander@fhe.test' });
  org1 = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  org2 = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Notif Rival','notif-rival') returning id`))[0].id;
  const [t] = await h.q<{ id: string }>(
    `select t.id from offering_tiers t join offerings o on o.id = t.offering_id
     where o.slug = 'riding-lesson' and t.label = '4-Lesson Punch Card'`);
  tierId = t.id;
});
afterAll(async () => {
  await h?.close();
});

describe('notify_user — gate + org stamp', () => {
  it('rejects a non-staff caller', async () => {
    await h.asUser(rider);
    await expect(h.q(
      `select notify_user($1, 'test', 'Nope')`, [rider]))
      .rejects.toThrow(/not authorized/);
  });

  it("staff create; org stamped from the TARGET user's profile", async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ notify_user: string }>(
      `select notify_user($1, 'welcome', 'Welcome aboard', 'See you soon', '/app')`, [rider]);
    expect(r.notify_user).toBeTruthy();

    await h.asSuperuser();
    const [row] = await h.q<{ org_id: string; user_id: string; kind: string; read_at: string | null }>(
      `select org_id, user_id, kind, read_at from notifications where id=$1`, [r.notify_user]);
    expect(row).toEqual({ org_id: org1, user_id: rider, kind: 'welcome', read_at: null });
  });

  it('service_role may create too (internal producers)', async () => {
    await h.asServiceRole();
    const [r] = await h.q<{ notify_user: string }>(
      `select notify_user($1, 'ops_ping', 'Ping')`, [rider]);
    expect(r.notify_user).toBeTruthy();
  });
});

describe('notifications RLS', () => {
  it('the owner reads their own rows; another member sees none of them', async () => {
    await h.asUser(rider);
    const mine = await h.q<{ kind: string }>(`select kind from notifications`);
    expect(mine.map((n) => n.kind).sort()).toEqual(['ops_ping', 'welcome']);

    await h.asUser(bystander);
    expect(await h.q(`select id from notifications`)).toHaveLength(0);
  });

  it('the RESTRICTIVE org boundary blocks a row parked in another tenant, even for its owner', async () => {
    await h.asSuperuser();
    await h.q(
      `insert into notifications (org_id, user_id, kind, title) values ($1, $2, 'stray', 'Wrong tenant')`,
      [org2, rider]);

    await h.asUser(rider);
    const visible = await h.q<{ kind: string }>(`select kind from notifications`);
    expect(visible.map((n) => n.kind)).not.toContain('stray');

    await h.asSuperuser();
    await h.q(`delete from notifications where kind='stray'`);
  });

  it('direct INSERT: staff pass the is_admin write policy; a plain member is denied', async () => {
    await h.asUser(admin);
    await h.q(
      `insert into notifications (user_id, kind, title) values ($1, 'staff_note', 'From the desk')`,
      [rider]);

    await h.asUser(bystander);
    await expect(h.q(
      `insert into notifications (user_id, kind, title) values ($1, 'forged', 'Nope')`,
      [bystander]))
      .rejects.toThrow(/row-level security/);
  });
});

describe('member RPCs', () => {
  it('my_notifications is newest-first and honors p_limit', async () => {
    // age the very first notification so ordering is deterministic
    await h.asSuperuser();
    await h.q(`update notifications set created_at = now() - interval '1 hour' where kind='welcome'`);

    await h.asUser(rider);
    const [r] = await h.q<{ my_notifications: Array<{ kind: string; title: string }> }>(
      `select my_notifications()`);
    expect(r.my_notifications.length).toBe(3);
    expect(r.my_notifications[r.my_notifications.length - 1].kind).toBe('welcome'); // oldest last
    const [limited] = await h.q<{ my_notifications: Array<{ kind: string }> }>(
      `select my_notifications(1)`);
    expect(limited.my_notifications).toHaveLength(1);
    expect(limited.my_notifications[0].kind).not.toBe('welcome');
  });

  it('my_unread_count counts unread; mark_notification_read is owner-only', async () => {
    await h.asUser(rider);
    const [c0] = await h.q<{ my_unread_count: number }>(`select my_unread_count()`);
    expect(c0.my_unread_count).toBe(3);

    const [target] = await h.q<{ id: string }>(
      `select id from notifications where kind='welcome'`);

    // someone else's mark attempt is a silent no-op
    await h.asUser(bystander);
    const [foreign] = await h.q<{ mark_notification_read: boolean | null }>(
      `select mark_notification_read($1)`, [target.id]);
    expect(foreign.mark_notification_read).toBeNull();

    await h.asUser(rider);
    const [c1] = await h.q<{ my_unread_count: number }>(`select my_unread_count()`);
    expect(c1.my_unread_count).toBe(3); // still unread

    const [own] = await h.q<{ mark_notification_read: boolean | null }>(
      `select mark_notification_read($1)`, [target.id]);
    expect(own.mark_notification_read).toBe(true);
    const [c2] = await h.q<{ my_unread_count: number }>(`select my_unread_count()`);
    expect(c2.my_unread_count).toBe(2);
  });
});

describe('record_signature v4 — the first real producer', () => {
  it("flipping a document EXECUTED notifies the signer's app user", async () => {
    // staff provision the paid lesson invitation for the rider's email
    await h.asUser(admin);
    await h.q(
      `select provision_lesson_invitation('madeline@rider.test','Madeline','Rider',$1,true,'Zelle',null)`,
      [tierId]);

    // rider completes the profile and generates the signing set
    await h.asUser(rider);
    await h.q(`select update_my_onboarding_profile($1::jsonb)`, [JSON.stringify({
      phone: '555-0142',
      date_of_birth: '1996-04-12',
      emergency_contact_1_name: 'Charles Rider',
      emergency_contact_1_relationship: 'Father',
      emergency_contact_1_phone: '555-0100',
    })]);
    const [g] = await h.q<{ generate_my_onboarding_documents: typeof docs }>(
      `select generate_my_onboarding_documents()`);
    docs = g.generate_my_onboarding_documents;
    expect(docs.length).toBeGreaterThan(0);

    const first = docs[0];
    const [s] = await h.q<{ record_signature: string }>(
      `select record_signature($1,'CLIENT',$2)`, [first.document_id, 'Madeline Rider']);
    expect(s.record_signature).toBe('EXECUTED');

    await h.asSuperuser();
    const rows = await h.q<{ user_id: string; org_id: string; title: string; link: string; read_at: string | null }>(
      `select user_id, org_id, title, link, read_at from notifications where kind='document_executed'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(rider);
    expect(rows[0].org_id).toBe(org1);
    expect(rows[0].title).toBe(`${first.title} is signed`);
    expect(rows[0].link).toBe('/app/documents');
    expect(rows[0].read_at).toBeNull();
  });

  it('re-signing an already-executed document does not duplicate the notification', async () => {
    await h.asUser(rider);
    const [again] = await h.q<{ record_signature: string }>(
      `select record_signature($1,'CLIENT',$2)`, [docs[0].document_id, 'Madeline Rider']);
    expect(again.record_signature).toBe('EXECUTED');

    await h.asSuperuser();
    const [n] = await h.q<{ n: string }>(
      `select count(*) as n from notifications where kind='document_executed'`);
    expect(Number(n.n)).toBe(1);
  });

  it('signing the whole set yields one notification per executed document', async () => {
    await h.asUser(rider);
    for (const d of docs.slice(1)) {
      const [s] = await h.q<{ record_signature: string }>(
        `select record_signature($1,'CLIENT',$2)`, [d.document_id, 'Madeline Rider']);
      expect(s.record_signature).toBe('EXECUTED');
    }

    await h.asSuperuser();
    const [n] = await h.q<{ n: string }>(
      `select count(*) as n from notifications where kind='document_executed' and user_id=$1`, [rider]);
    expect(Number(n.n)).toBe(docs.length);
  });

  it('a signer contact with no app account is skipped silently (no row, no error)', async () => {
    // provision for an email that never registers — the contact has no profile
    await h.asUser(admin);
    const [p] = await h.q<{ provision_lesson_invitation: { engagement_id: string } }>(
      `select provision_lesson_invitation('ghost@rider.test','Ghost','Rider',$1,true,'Zelle',null)`,
      [tierId]);
    const engId = p.provision_lesson_invitation.engagement_id;

    // staff facilitate: generate + sign on the client's behalf
    const [gen] = await h.q<{ document_id: string }>(
      `select document_id from generate_document($1, 'FACILITY_RULES')`, [engId]);
    const [s] = await h.q<{ record_signature: string }>(
      `select record_signature($1,'CLIENT','Ghost Rider')`, [gen.document_id]);
    expect(s.record_signature).toBe('EXECUTED');

    await h.asSuperuser();
    // no new row appeared: every document_executed notification still belongs
    // to the rider, and the total is exactly the rider's executed set
    const rows = await h.q<{ user_id: string }>(
      `select user_id from notifications where kind='document_executed'`);
    expect(rows).toHaveLength(docs.length);
    expect(rows.every((r) => r.user_id === rider)).toBe(true);
  });
});
