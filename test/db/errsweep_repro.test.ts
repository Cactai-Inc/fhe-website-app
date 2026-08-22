/**
 * TASK-ERRSWEEP — proves the confirmed case (RegisterComplete.tsx:102): an
 * already-redeemed contract invitation is a genuine, repeatable failure of
 * redeem_contract_invitation, and the plain-object shape Postgres/PostgREST
 * hands back is exactly the shape `instanceof Error` misses and `toErrorMessage`
 * (src/lib/ops/errors.ts) surfaces correctly.
 *
 * Note: the `engagements`/`engagement_parties` tables older test/db fixtures
 * (e2e_contract.test.ts etc.) rely on no longer exist in this schema — that
 * drift is pre-existing on main (test/db is broadly red there; see
 * docs/reports/TASK-TESTREPAIR-REPORT.md) and out of this task's scope. This
 * fixture builds directly on the CURRENT documents/document_parties spine that
 * invite_contract_counterparty (20260816T1700) and redeem_contract_invitation
 * (20260820T0940) actually use, so it is unaffected by that drift.
 *
 * Two things are proven, not assumed:
 *  1. redeeming a second time genuinely raises (real RPC, real DB) — the raw
 *     Postgres exception text is captured verbatim.
 *  2. that exact text, wrapped in the plain-object shape postgrest-js builds
 *     from an RPC rejection (never a real Error — see errors.ts's doc comment),
 *     is recovered by toErrorMessage but LOST by the old `instanceof Error`
 *     ternary RegisterComplete.tsx used before this task.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';
import { toErrorMessage } from '../../src/lib/ops/errors';

let h: TestDb;
let orgA: string;
let buyerEmail: string;
let buyerContact: string;
let buyerUser: string;
let token: string;
let rawExceptionMessage: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  // WORKAROUND for a pre-existing test/db defect, unrelated to ERRSWEEP: the
  // status_events_vocab seed (20260726040000 phase3c_status_model) inserts 0
  // rows in this harness (confirmed: `select count(*) from status_events_vocab`
  // returns 0 on a fresh createTestDb(), on both main and this branch), so the
  // documents status-sync trigger (20260726050000 trg_status_documents) fails
  // its FK on any insert. Re-seeding the one row this fixture needs, exactly as
  // the migration does, unblocks this reproduction without touching the harness
  // or the migrations themselves — that gap is TESTREPAIR/harness territory,
  // out of ERRSWEEP's bounded scope.
  await h.q(
    `INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order) VALUES
       ('document','assigned','Assigned',true,false,10),
       ('account','invited','Invited',true,false,10),
       ('account','redeemed','Redeemed',true,false,20),
       ('account','active','Active',true,false,30),
       ('account','redeemed_unsuccessful','Redeemed — unsuccessful',true,false,25),
       ('account','revoked','Revoked',true,true,40),
       ('account','superseded','Superseded',true,true,45),
       ('account','expired','Expired',true,true,50),
       ('account','sent','Invitation sent',false,false,11),
       ('account','resent','Invitation resent',false,false,12),
       ('account','redeem_failed','Redemption failed',false,false,26)
     ON CONFLICT (entity_type, code) DO NOTHING`);
  // Same gap, same fix: document_status (20260629050000) also seeds 0 rows here.
  await h.q(
    `INSERT INTO document_status (code, display_name, is_terminal, sort_order) VALUES
       ('DRAFT','Draft',false,1), ('AWAITING_SIGNATURE','Awaiting Signature',false,2),
       ('EXECUTED','Executed',true,3), ('VOID','Void',true,4)
     ON CONFLICT (code) DO NOTHING`);

  buyerEmail = 'errsweep-buyer@e2e.test';
  buyerContact = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name, email) values ($1,'Errsweep','Buyer',$2) returning id`,
    [orgA, buyerEmail]))[0].id;

  const docId = (await h.q<{ id: string }>(
    `insert into documents (org_id, contact_id, title)
     values ($1,$2,'Errsweep Repro Contract') returning id`,
    [orgA, buyerContact]))[0].id;

  await h.q(
    `insert into document_parties (org_id, document_id, contact_id, party_role, is_signer, signer_order)
     values ($1,$2,$3,'BUYER',true,1)`,
    [orgA, docId, buyerContact]);

  // service-role caller — matches how /api/contract-invite actually calls this
  // (see 20260816T1700's own comment: the service-role arm exists precisely so
  // a server endpoint, not just staff, can mint the invitation).
  await h.asSuperuser();
  const [inv] = await h.q<{ token: string }>(
    `select invite_contract_counterparty($1,$2,$3) ->> 'token' as token`,
    [docId, buyerContact, buyerEmail]);
  token = inv.token;

  buyerUser = await h.createAuthUser({ email: buyerEmail });
});

afterAll(async () => {
  await h?.close();
});

describe('the confirmed case: redeeming an already-redeemed contract invitation', () => {
  it('succeeds the first time', async () => {
    await h.asUser(buyerUser);
    const [r] = await h.q<{ document_id: string }>(
      `select redeem_contract_invitation($1) ->> 'document_id' as document_id`, [token]);
    expect(r.document_id).toBeTruthy();
  });

  it('genuinely raises on the second redemption — this is what RegisterComplete.tsx must surface', async () => {
    await h.asUser(buyerUser);
    let caught: unknown;
    try {
      await h.q(`select redeem_contract_invitation($1)`, [token]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeTruthy();
    rawExceptionMessage = (caught as Error).message;
    // the real Postgres text (20260820T0940): proves this is a live, reachable
    // failure — not a hypothetical.
    expect(rawExceptionMessage).toMatch(/invitation is not valid or has expired/);
  });

  it('toErrorMessage surfaces that exact text from the plain-object shape supabase-js hands the catch block', () => {
    // postgrest-js never constructs a real Error from an RPC rejection (see
    // src/lib/ops/errors.ts's doc comment) — it hands the catch block a plain
    // object shaped like this, built from the same Postgres exception text
    // just proven above.
    const postgrestShapedRejection = {
      message: rawExceptionMessage,
      details: null,
      hint: null,
      code: 'P0001',
    };

    // THE BUG (pre-fix): RegisterComplete.tsx used to write
    //   err instanceof Error ? err.message : 'We could not finish setting up your account.'
    // — on this exact object, `instanceof Error` is false, so the branch always
    // fell to the generic fallback and the real reason never reached the screen.
    const oldBuggyPattern = (err: unknown) =>
      err instanceof Error ? (err as Error).message : 'We could not finish setting up your account.';
    expect(oldBuggyPattern(postgrestShapedRejection)).toBe('We could not finish setting up your account.');

    // THE FIX: toErrorMessage recovers the real Postgres message.
    expect(toErrorMessage(postgrestShapedRejection, 'We could not finish setting up your account.'))
      .toBe(rawExceptionMessage);
  });
});
