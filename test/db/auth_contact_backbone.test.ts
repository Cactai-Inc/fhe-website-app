/**
 * Category 2 — Auth backbone (migration 009): a contact is created and linked the
 * moment a profile (signup) appears, so "the contact is the backbone" holds from
 * first login. Dedups by email and is idempotent.
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

describe('contact-at-signup', () => {
  it('is migration 9 and applies after the identity backbone', () => {
    const files = migrationFiles();
    expect(files.length).toBeGreaterThanOrEqual(9);
    // Order matters, not position: the auth backbone (9) must apply after the
    // identity backbone (8) it links into. Don't assert it's the last file —
    // later migrations (engagements/horses, etc.) legitimately follow it.
    const identity = files.findIndex((f) => f.includes('crm_identity_backbone'));
    const auth = files.findIndex((f) => f.includes('auth_contact_backbone'));
    expect(identity).toBeGreaterThanOrEqual(0);
    expect(auth).toBeGreaterThan(identity);
  });

  it('auto-creates and links a contact when a profile is inserted', async () => {
    await h.asSuperuser();
    await h.q(
      `insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111','jane@signup.fhe')`,
    );
    await h.q(
      `insert into profiles (user_id, email, first_name, last_name)
       values ('11111111-1111-1111-1111-111111111111','jane@signup.fhe','Jane','Rider')`,
    );
    const prof = await h.q<{ contact_id: string }>(
      `select contact_id from profiles where user_id='11111111-1111-1111-1111-111111111111'`,
    );
    expect(prof[0].contact_id).toBeTruthy();

    const contact = await h.q<{ first_name: string; last_name: string; email: string; display_code: string }>(
      `select first_name, last_name, email, display_code from contacts where id=$1`, [prof[0].contact_id],
    );
    expect(contact[0].first_name).toBe('Jane');
    expect(contact[0].last_name).toBe('Rider');
    expect(contact[0].email).toBe('jane@signup.fhe');
    expect(contact[0].display_code).toMatch(/^CON-\d{6}$/);
  });

  it('is idempotent — re-running returns the same contact, makes no duplicate', async () => {
    await h.asSuperuser();
    const before = await h.q<{ n: number }>(`select count(*)::int as n from contacts`);
    const again = await h.q<{ ensure_contact_for_profile: string }>(
      `select ensure_contact_for_profile('11111111-1111-1111-1111-111111111111')`,
    );
    const linked = await h.q<{ contact_id: string }>(
      `select contact_id from profiles where user_id='11111111-1111-1111-1111-111111111111'`,
    );
    const after = await h.q<{ n: number }>(`select count(*)::int as n from contacts`);
    expect(again[0].ensure_contact_for_profile).toBe(linked[0].contact_id);
    expect(after[0].n).toBe(before[0].n);
  });

  it('dedups onto an existing unlinked contact with the same email', async () => {
    await h.asSuperuser();
    // A staff-entered lead contact exists first (e.g. from a phone call).
    const existing = await h.q<{ id: string }>(
      `insert into contacts (first_name, last_name, email) values ('Phoned', 'Lead', 'lead@signup.fhe') returning id`,
    );
    // Then that person signs up.
    await h.q(`insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222','lead@signup.fhe')`);
    await h.q(
      `insert into profiles (user_id, email, first_name) values ('22222222-2222-2222-2222-222222222222','lead@signup.fhe','Lead')`,
    );
    const prof = await h.q<{ contact_id: string }>(
      `select contact_id from profiles where user_id='22222222-2222-2222-2222-222222222222'`,
    );
    expect(prof[0].contact_id).toBe(existing[0].id);
  });

  it('falls back to email as the name when the profile has no first/last', async () => {
    await h.asSuperuser();
    await h.q(`insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333','noname@signup.fhe')`);
    await h.q(`insert into profiles (user_id, email) values ('33333333-3333-3333-3333-333333333333','noname@signup.fhe')`);
    const c = await h.q<{ first_name: string }>(
      `select c.first_name from contacts c
       join profiles p on p.contact_id = c.id
       where p.user_id='33333333-3333-3333-3333-333333333333'`,
    );
    expect(c[0].first_name).toBe('noname@signup.fhe');
  });
});
