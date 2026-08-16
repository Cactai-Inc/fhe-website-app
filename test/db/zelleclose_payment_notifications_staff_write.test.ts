/**
 * TASK ZELLECLOSE — the Payment review "Dismiss" gap, diagnosed and fixed.
 *
 * `payment_notifications_org_boundary` is a RESTRICTIVE policy
 * (`AS RESTRICTIVE`, schema_snapshot.sql), and the only PERMISSIVE policy on
 * the table was `payment_notifications_admin_read` — SELECT-only. Postgres
 * RLS denies a command outright when no permissive policy applies to it, so
 * staff UPDATE (Dismiss) was unreachable no matter what `org_id` held — a
 * different bug than the missing `org_id` this task also fixed (that one only
 * affects whether an alert can be routed; it was never what blocked Dismiss).
 *
 * The default snapshot already carries this exact table + both original
 * policies, so this file replays only the new policy migration, not the
 * whole chain.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from './harness';

const MIGRATION = '20260816T1500_zelleclose_payment_notifications_staff_write.sql';

let h: TestDb;
let org: string;
let staffUid: string;
let outsiderUid: string;
let notificationId: string;

async function insertNotification(): Promise<string> {
  await h.asServiceRole(); // service_role carries BYPASSRLS, like the real reconcile.ts insert
  const rows = await h.q<{ id: string }>(
    `insert into payment_notifications (org_id, source_inbox, parsed_amount, status)
       values ($1, 'test@inbox', 123.45, 'review') returning id`, [org]);
  return rows[0].id;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(
    `select id from organizations order by created_at limit 1`))[0].id;
  staffUid = await h.createAuthUser({ email: 'staff@zelleclose-rls.test', org, role: 'ADMIN' });
  outsiderUid = await h.createAuthUser({ email: 'outsider@zelleclose-rls.test', org: null });
});

afterAll(async () => { await h?.close(); });

describe('BEFORE the migration — Dismiss reproduced as unreachable', () => {
  it('a staff UPDATE affects 0 rows even though the row is visible and org matches', async () => {
    notificationId = await insertNotification();

    await h.asUser(staffUid);
    const visible = await h.q<{ id: string }>(
      `select id from payment_notifications where id = $1`, [notificationId]);
    expect(visible).toHaveLength(1); // SELECT already worked (admin_read)

    const updated = await h.q<{ id: string }>(
      `update payment_notifications set status = 'matched' where id = $1 returning id`,
      [notificationId]);
    expect(updated).toHaveLength(0); // the bug: UPDATE silently touches nothing
  });
});

describe('AFTER the migration — staff can Dismiss', () => {
  beforeAll(async () => {
    await h.asSuperuser();
    const sql = readFileSync(join(MIGRATIONS_DIR, MIGRATION), 'utf8');
    await h.db.exec(sql);
  });

  it('a staff UPDATE now succeeds', async () => {
    const id = await insertNotification();
    await h.asUser(staffUid);
    const updated = await h.q<{ id: string; status: string }>(
      `update payment_notifications set status = 'matched' where id = $1 returning id, status`,
      [id]);
    expect(updated).toHaveLength(1);
    expect(updated[0].status).toBe('matched');
  });

  it('a non-staff org member still cannot dismiss (has_staff_access() still gates it)', async () => {
    const id = await insertNotification();
    const memberUid = await h.createAuthUser({ email: 'member@zelleclose-rls.test', org, role: 'USER' });
    await h.asUser(memberUid);
    const updated = await h.q<{ id: string }>(
      `update payment_notifications set status = 'matched' where id = $1 returning id`, [id]);
    expect(updated).toHaveLength(0);
  });

  it('an outsider (no org) still cannot see or dismiss it', async () => {
    const id = await insertNotification();
    await h.asUser(outsiderUid);
    const visible = await h.q<{ id: string }>(
      `select id from payment_notifications where id = $1`, [id]);
    expect(visible).toHaveLength(0);
    const updated = await h.q<{ id: string }>(
      `update payment_notifications set status = 'matched' where id = $1 returning id`, [id]);
    expect(updated).toHaveLength(0);
  });
});
