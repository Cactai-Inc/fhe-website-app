/**
 * Category 1 — Schema: audit logging (migration 013), security model §8.
 *
 * Proves the trail is real and tamper-proof:
 *  - migration 13 applies last,
 *  - INSERT/UPDATE on a business table writes an audit row with the acting user,
 *    action, table, record id, and old/new JSONB,
 *  - audit_logs is append-only: UPDATE and DELETE are rejected for everyone,
 *  - only admins can read it.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, migrationFiles, type TestDb } from './harness';

let h: TestDb;

beforeAll(async () => {
  h = await createTestDb();
});
afterAll(async () => {
  await h?.close();
});

describe('migration applies additively', () => {
  it('lands after the documents/signatures migration', () => {
    const files = migrationFiles();
    const doc = files.findIndex((f) => f.includes('documents_signatures_deliveries'));
    const aud = files.findIndex((f) => f.includes('audit_logs'));
    expect(doc).toBeGreaterThanOrEqual(0);
    expect(aud).toBeGreaterThan(doc);
  });
});

describe('the trigger captures row changes', () => {
  it('records INSERT and UPDATE with actor, action, and old/new values', async () => {
    await h.asSuperuser();
    const userUid = await h.createAuthUser({ email: 'actor@audit.fhe' });

    // Act as a real principal so auth.uid() is captured.
    await h.asUser(userUid);
    // (superuser-created contact write is blocked by RLS for a plain user, so do
    //  the writes as superuser but with the session's claim set — switch to a
    //  contact the admin owns is unnecessary; we audit a lookup-free business row.)
    await h.asSuperuser();
    await h.q(`select set_config('request.jwt.claim.sub',$1,false)`, [userUid]);

    const contact = (await h.q<{ id: string }>(
      `insert into contacts (full_name, email) values ('Audit Target','t@audit.fhe') returning id`))[0].id;
    await h.q(`update contacts set phone='555-0001' where id=$1`, [contact]);

    const rows = await h.q<{
      action: string; table_name: string; record_id: string; actor_user_id: string | null;
      old_value: unknown; new_value: Record<string, unknown> | null;
    }>(`select action, table_name, record_id, actor_user_id, old_value, new_value
        from audit_logs where table_name='contacts' and record_id=$1 order by occurred_at`, [contact]);

    expect(rows.map((r) => r.action)).toEqual(['INSERT', 'UPDATE']);
    expect(rows[0].table_name).toBe('contacts');
    expect(rows[0].record_id).toBe(contact);
    expect(rows[0].actor_user_id).toBe(userUid);
    // INSERT: no old, has new
    expect(rows[0].old_value).toBeNull();
    expect((rows[0].new_value as { full_name: string }).full_name).toBe('Audit Target');
    // UPDATE: captures the new phone
    expect((rows[1].new_value as { phone: string }).phone).toBe('555-0001');
  });

  it('captures a DELETE on a deletable business table', async () => {
    await h.asSuperuser();
    const contact = (await h.q<{ id: string }>(
      `insert into contacts (full_name) values ('Doomed') returning id`))[0].id;
    const client = (await h.q<{ id: string }>(
      `insert into clients (contact_id) values ($1) returning id`, [contact]))[0].id;
    const eng = (await h.q<{ id: string }>(
      `insert into engagements (client_id, service_type) values ($1,'HORSE_TRAINING') returning id`, [client]))[0].id;
    await h.q(`delete from engagements where id=$1`, [eng]);
    const del = await h.q<{ action: string; old_value: Record<string, unknown> }>(
      `select action, old_value from audit_logs where table_name='engagements' and record_id=$1 and action='DELETE'`, [eng]);
    expect(del).toHaveLength(1);
    expect((del[0].old_value as { id: string }).id).toBe(eng);
  });
});

describe('audit_logs is append-only and admin-read-only', () => {
  it('rejects UPDATE and DELETE for everyone, including superuser', async () => {
    await h.asSuperuser();
    const row = (await h.q<{ id: string }>(`select id from audit_logs limit 1`))[0].id;
    await expect(h.q(`update audit_logs set action='UPDATE' where id=$1`, [row])).rejects.toThrow(/append-only/);
    await expect(h.q(`delete from audit_logs where id=$1`, [row])).rejects.toThrow(/append-only/);
  });

  it('is readable by admins, invisible to plain clients', async () => {
    await h.asSuperuser();
    const adminUid = await h.createAuthUser({ email: 'ops@audit.fhe', isAdmin: true });
    const plainUid = await h.createAuthUser({ email: 'plain@audit.fhe' });

    await h.asUser(adminUid);
    expect((await h.q(`select id from audit_logs`)).length).toBeGreaterThan(0);

    await h.asUser(plainUid);
    expect(await h.q(`select id from audit_logs`)).toHaveLength(0);
  });
});
