/**
 * TASK-WALLRETURN — proves the trigger condition the frontend fix relies on:
 * my_wall_state().wall stays true until the LAST wall_gating document is
 * signed, not the first. This is a structural guarantee of
 * contact_document_wall_state() (unchanged by this task — the wall's gating
 * logic is deliberately untouched, see docs/tasks/TASK-WALLRETURN-preserve-destination.md),
 * exercised here end to end against a throwaway test contact rather than
 * just read off the SQL.
 *
 * Bypasses the (currently broken — `offering_tiers` no longer exists,
 * pre-existing/unrelated to this task) provision_lesson_invitation fixture
 * path that rider_onboarding.test.ts and esign_hardening.test.ts use.
 * generate_my_onboarding_documents() only needs contact_required_documents
 * rows, so this seeds those directly.
 *
 * Also seeds `status_events_vocab` and `document_status` directly: the
 * snapshot's SNAPSHOT_DATA_TABLES allowlist (harness.ts) doesn't currently
 * include either, so a fresh PGlite DB has both empty and document creation
 * fails two separate FKs (documents.status -> document_status, and the
 * status-event trigger's entity_type/status -> status_events_vocab) —
 * pre-existing gap, unrelated to this task, worked around locally rather
 * than touched at the shared-fixture source.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let rider: string;
let docs: Array<{ document_id: string; template_key: string; title: string; status: string }>;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  rider = await h.createAuthUser({ email: 'wallreturn.rider@test.fhe' });

  // give the contact a name (server-side typed-name match needs it) and
  // create the contacts row (ensure_contact_for_profile, lazy on first RPC)
  await h.asUser(rider);
  await h.q(`select update_my_onboarding_profile($1::jsonb)`, [JSON.stringify({
    first_name: 'Wanda', last_name: 'Wallreturn',
    phone: '555-0199', date_of_birth: '1990-01-01',
    address_street: '1 Test Way', address_city: 'Testville', address_state: 'CA', address_zip: '90000',
    emergency_contact_1_name: 'Emergency Contact', emergency_contact_1_relationship: 'Friend',
    emergency_contact_1_phone: '555-0100',
  })]);

  await h.asSuperuser();
  await h.q(`insert into status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order) values
    ('document','assigned','Assigned',true,false,10),
    ('document','signed','Signed',true,true,50)
    on conflict do nothing`);
  await h.q(`insert into document_status (code, display_name, is_terminal, sort_order) values
    ('DRAFT','Draft',false,1),
    ('AWAITING_SIGNATURE','Awaiting Signature',false,2),
    ('EXECUTED','Executed',true,3),
    ('VOID','Void',true,4)
    on conflict do nothing`);
  const [contact] = await h.q<{ id: string }>(
    `select id from contacts where lower(email) = 'wallreturn.rider@test.fhe'`);
  // Two wall_gating templates, no horse/minor complexity — this test only
  // cares about the pending-count → wall boolean transition, not document
  // content.
  await h.q(
    `insert into contact_required_documents (contact_id, template_key) values ($1,'COMPANY_POLICIES'), ($1,'FACILITY_RULES')`,
    [contact.id]);
});
afterAll(async () => {
  await h?.close();
});

describe('my_wall_state() — the exact signal AppLayout/Onboarding gate on', () => {
  it('walls the member once required wall-gating documents exist', async () => {
    await h.asUser(rider);
    const [g] = await h.q<{ generate_my_onboarding_documents: typeof docs }>(
      `select generate_my_onboarding_documents()`);
    docs = g.generate_my_onboarding_documents;
    expect(docs.map((d) => d.template_key).sort()).toEqual(['COMPANY_POLICIES', 'FACILITY_RULES']);

    const [w] = await h.q<{ my_wall_state: { pending: number; wall: boolean; staff: boolean } }>(
      `select my_wall_state()`);
    expect(w.my_wall_state).toEqual({ pending: 2, wall: true, staff: false, staff_banner: false });
  });

  it('PARTIAL COMPLETION: signing the first of two does not release the wall', async () => {
    await h.asUser(rider);
    const first = docs.find((d) => d.template_key === 'COMPANY_POLICIES')!;
    const [s] = await h.q<{ record_signature: string }>(
      `select record_signature($1,'CLIENT',$2)`, [first.document_id, 'Wanda Wallreturn']);
    expect(s.record_signature).toBe('EXECUTED');

    const [w] = await h.q<{ my_wall_state: { pending: number; wall: boolean; staff: boolean } }>(
      `select my_wall_state()`);
    // THE ASSERTION THAT MATTERS: one of two signed — still walled.
    expect(w.my_wall_state).toEqual({ pending: 1, wall: true, staff: false, staff_banner: false });
  });

  it('signing the LAST gating document clears the wall', async () => {
    await h.asUser(rider);
    const second = docs.find((d) => d.template_key === 'FACILITY_RULES')!;
    const [s] = await h.q<{ record_signature: string }>(
      `select record_signature($1,'CLIENT',$2)`, [second.document_id, 'Wanda Wallreturn']);
    expect(s.record_signature).toBe('EXECUTED');

    const [w] = await h.q<{ my_wall_state: { pending: number; wall: boolean; staff: boolean } }>(
      `select my_wall_state()`);
    expect(w.my_wall_state).toEqual({ pending: 0, wall: false, staff: false, staff_banner: false });
  });
});
