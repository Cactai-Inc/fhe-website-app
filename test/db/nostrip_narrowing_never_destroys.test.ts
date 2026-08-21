/**
 * TASK-NOSTRIP — narrowing a category must never destroy required paperwork.
 *
 * TASK-CATEGORISE proved this on production (rolled back):
 *
 *     trigger assigned:  6 documents, correct, derived from the cart
 *     staff read "lessons" on the row and tick Rider  ->  ['RIDER']
 *     after:             4 documents. HORSE_EMERGENCY_VET and
 *                        RELEASE_HORSE_CARE DESTROYED, with no audit_logs row,
 *                        no reason, no actor and no undo.
 *
 * What was destroyed is the record of what a person was obliged to sign before
 * being on the property or handling a horse. These tests are the nine the task
 * names, run against the real function bodies rather than read off the SQL.
 *
 * SNAPSHOT GAP: fixtures/schema_snapshot.sql was generated 2026-08-03 and so
 * predates both WALLSYNC's shared satisfaction predicate (2026-08-07) and
 * CLOSEOUT §1.6's skip mechanism (2026-08-19). Both are applied here on top of
 * the snapshot, in order, before the migration under test — the same pattern
 * uploads_files_spine.test.ts uses. Nothing here modifies the snapshot.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from './harness';

let h: TestDb;
let org: string;
let staff: string;
let member: string;
let contact: string;

/** The two document sets the live `category_document_requirements` holds (D28:
 *  the general release is for visitors and does not stack; rider and owner
 *  releases do — the live data is correct and is reproduced, never "fixed"). */
const RIDER = ['COMPANY_POLICIES', 'FACILITY_RULES', 'HUMAN_EMERGENCY_MEDICAL', 'RELEASE_PARTICIPANT'];
const HORSE_OWNER = ['COMPANY_POLICIES', 'FACILITY_RULES', 'HORSE_EMERGENCY_VET',
  'RELEASE_HORSE_CARE', 'RELEASE_PARTICIPANT'];
/** The mixed cart's answer: six documents. */
const MIXED = [...new Set([...RIDER, ...HORSE_OWNER])].sort();
/** What ticking Rider alone would have destroyed. */
const HORSE_ONLY = ['HORSE_EMERGENCY_VET', 'RELEASE_HORSE_CARE'];

const mig = (f: string) => readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8');

/** Reset the contact to the six-document mixed-cart state before each test. */
async function seedMixedCart() {
  await h.asSuperuser();
  await h.q(`delete from contact_required_documents where contact_id = $1`, [contact]);
  // audit_logs is append-only for everyone (migration 013) — it cannot be
  // cleared between tests, so the assertions below read the LATEST matching row
  // rather than assuming there is only one.
  await h.q(`update documents set deleted_at = now() where contact_id = $1 and deleted_at is null`, [contact]);
  await h.q(
    `insert into contact_required_documents (contact_id, template_key, org_id)
     select $1, k, $2 from unnest($3::text[]) k`, [contact, org, MIXED]);
}

/** Mark one requirement satisfied the way the system does: an EXECUTED,
 *  non-superseded document on a template the contact is required to hold. */
async function executeDocument(templateKey: string) {
  await h.asSuperuser();
  const [t] = await h.q<{ id: string }>(
    `select id from contract_templates where template_key = $1 and active and deleted_at is null
      order by version desc limit 1`, [templateKey]);
  await h.q(
    `insert into documents (org_id, contact_id, template_id, title, status, current_status)
     values ($1, $2, $3, $4, 'EXECUTED', 'signed')`,
    [org, contact, t.id, `${templateKey} (executed)`]);
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  // The two prerequisites the 2026-08-03 snapshot predates, then the migration
  // under test. check_function_bodies is relaxed only for the prerequisites:
  // WALLSYNC/CLOSEOUT reissue SQL-language functions whose bodies reference
  // helpers that arrived in migrations between the snapshot and them.
  await h.db.exec('set check_function_bodies = off;');
  await h.db.exec(mig('20260807T1500_wallsync_shared_satisfaction_predicate.sql'));
  await h.db.exec(mig('20260819T0130_closeout_16_skip_a_required_document.sql'));
  await h.db.exec('set check_function_bodies = on;');
  await h.db.exec(mig('20260821T1400_nostrip_narrowing_skips_and_never_destroys.sql'));

  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  // The snapshot's allowlist carries no status_events_vocab / document_status
  // rows, so creating a document dies on two FKs before this task's code is
  // reached (the same pre-existing fixture gap wallreturn_wall_state.test.ts
  // works around locally). Seeded here, not at the shared fixture source.
  await h.q(`insert into document_status (code, display_name, is_terminal, sort_order) values
    ('DRAFT','Draft',false,1),('AWAITING_SIGNATURE','Awaiting Signature',false,2),
    ('EXECUTED','Executed',true,3),('VOID','Void',true,4) on conflict do nothing`);
  // The live document vocabulary (prod status_events_vocab, 2026-08-21).
  await h.q(`insert into status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
    select 'document', c, initcap(replace(c,'_',' ')), true, c in ('signed','superseded','void','cleaned_up'), i
      from unnest(array['assigned','sent_for_review','sent','send_failed','in_progress','viewed',
                        'downloaded','review_approved','ready_to_sign','signed','superseded','void','cleaned_up'])
           with ordinality as t(c, i)
    on conflict do nothing`);

  // The document sets, exactly as production holds them (D28 — not modified).
  await h.q(`delete from category_document_requirements where org_id = $1`, [org]);
  for (const [cat, keys] of [['Rider', RIDER], ['Horse owner', HORSE_OWNER]] as const) {
    await h.q(
      `insert into category_document_requirements (org_id, category, template_key)
       select $1, $2, k from unnest($3::text[]) k`, [org, cat, keys]);
  }

  staff = await h.createAuthUser({ email: 'nostrip.staff@test.fhe', isAdmin: true, role: 'ADMIN', org });
  member = await h.createAuthUser({ email: 'nostrip.member@test.fhe', org });

  await h.asSuperuser();
  contact = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email, org_id)
     values ('Mixed','Cart','nostrip.member@test.fhe',$1) returning id`, [org]))[0].id;
  await h.q(`update profiles set contact_id = $1 where user_id = $2`, [contact, member]);
});

afterAll(async () => { await h?.close(); });

beforeEach(async () => { await seedMixedCart(); });

// ── TEST 1 ──────────────────────────────────────────────────────────────────
describe('1. the CATEGORISE case: narrowing to Rider destroys nothing', () => {
  it('leaves all six rows on the record, two marked skipped with a reason and an actor', async () => {
    await h.asUser(staff);
    const [r] = await h.q<{ narrow_contact_required_documents: { skipped: string[] } }>(
      `select narrow_contact_required_documents($1, $2::text[], $3)`,
      [contact, RIDER, 'Phone call: they board elsewhere, lessons only']);
    expect(r.narrow_contact_required_documents.skipped.sort()).toEqual(HORSE_ONLY);

    await h.asSuperuser();
    const rows = await h.q<{ template_key: string; skipped_at: string | null; skipped_by: string | null; skip_reason: string | null }>(
      `select template_key, skipped_at, skipped_by, skip_reason
         from contact_required_documents where contact_id = $1 order by template_key`, [contact]);

    // THE ASSERTION THIS TASK EXISTS FOR: six rows in, six rows out.
    expect(rows.map((x) => x.template_key)).toEqual(MIXED);

    const skipped = rows.filter((x) => x.skipped_at !== null);
    expect(skipped.map((x) => x.template_key).sort()).toEqual(HORSE_ONLY);
    for (const s of skipped) {
      expect(s.skipped_by).toBe(staff);
      expect(s.skip_reason).toBe('Phone call: they board elsewhere, lessons only');
    }
    // And the four they DO owe are untouched.
    expect(rows.filter((x) => x.skipped_at === null).map((x) => x.template_key)).toEqual(RIDER.slice().sort());
  });
});

// ── TEST 2 ──────────────────────────────────────────────────────────────────
describe('2. a skipped document does not block the person', () => {
  it('my_wall_state() — the function that actually gates a session — stops counting it', async () => {
    // Every template in the mixed set that gates the wall counts before.
    await h.asUser(member);
    const before = (await h.q<{ my_wall_state: { pending: number } }>(`select my_wall_state()`))[0].my_wall_state;

    await h.asUser(staff);
    await h.q(`select narrow_contact_required_documents($1, $2::text[], $3)`,
      [contact, RIDER, 'lessons only']);

    await h.asUser(member);
    const after = (await h.q<{ my_wall_state: { pending: number } }>(`select my_wall_state()`))[0].my_wall_state;

    // my_wall_state does not mention skipped_at itself — it DELEGATES to
    // contact_document_wall_state, which does. This proves the delegation is
    // real rather than assumed.
    expect(after.pending).toBe(before.pending - HORSE_ONLY.length);

    // And the member is never ASKED for it either.
    const asked = await h.q<{ template_key: string }>(
      `select template_key from required_templates_for_contact($1) order by 1`, [contact]);
    expect(asked.map((x) => x.template_key)).toEqual(RIDER.slice().sort());
  });
});

// ── TEST 3 ──────────────────────────────────────────────────────────────────
describe('3. the undo that already existed', () => {
  it('unskip_required_document restores a narrowed requirement — round trip', async () => {
    await h.asUser(staff);
    await h.q(`select narrow_contact_required_documents($1, $2::text[], $3)`,
      [contact, RIDER, 'lessons only']);

    const [u] = await h.q<{ unskip_required_document: { restored: boolean } }>(
      `select unskip_required_document($1, 'RELEASE_HORSE_CARE')`, [contact]);
    expect(u.unskip_required_document.restored).toBe(true);

    await h.asSuperuser();
    const [row] = await h.q<{ skipped_at: string | null; skipped_by: string | null; skip_reason: string | null }>(
      `select skipped_at, skipped_by, skip_reason from contact_required_documents
        where contact_id = $1 and template_key = 'RELEASE_HORSE_CARE'`, [contact]);
    expect(row).toEqual({ skipped_at: null, skipped_by: null, skip_reason: null });

    // It blocks again, which is what "restored" has to mean.
    await h.asUser(member);
    const asked = await h.q<{ template_key: string }>(
      `select template_key from required_templates_for_contact($1) order by 1`, [contact]);
    expect(asked.map((x) => x.template_key)).toContain('RELEASE_HORSE_CARE');
  });
});

// ── TEST 4 ──────────────────────────────────────────────────────────────────
describe('4. executed paperwork is evidence and is never removed by ANY path', () => {
  beforeEach(async () => { await executeDocument('RELEASE_HORSE_CARE'); });

  it('narrow_contact_required_documents refuses, and names the document', async () => {
    await h.asUser(staff);
    await expect(h.q(`select narrow_contact_required_documents($1, $2::text[], $3)`,
      [contact, RIDER, 'lessons only'])).rejects.toThrow(/RELEASE_HORSE_CARE.*executed document/s);

    // Refused OUTRIGHT — the other candidate is not half-skipped either.
    await h.asSuperuser();
    const skipped = await h.q<{ template_key: string }>(
      `select template_key from contact_required_documents
        where contact_id = $1 and skipped_at is not null`, [contact]);
    expect(skipped).toEqual([]);
  });

  it('the Paperwork editor save (set_contact_required_documents) refuses too', async () => {
    await h.asUser(staff);
    await expect(h.q(`select set_contact_required_documents($1, $2::text[])`, [contact, RIDER]))
      .rejects.toThrow(/RELEASE_HORSE_CARE.*never removed/s);

    await h.asSuperuser();
    const rows = await h.q<{ template_key: string }>(
      `select template_key from contact_required_documents where contact_id = $1 order by 1`, [contact]);
    expect(rows.map((x) => x.template_key)).toEqual(MIXED);
  });

  it('skip_required_document refuses (the standing rule, unchanged)', async () => {
    await h.asUser(staff);
    await expect(h.q(`select skip_required_document($1, 'RELEASE_HORSE_CARE', 'because')`, [contact]))
      .rejects.toThrow(/executed document/);
  });
});

// ── TEST 5 ──────────────────────────────────────────────────────────────────
describe('5. the narrowing is recorded', () => {
  it('writes an audit_logs row naming the contact, the templates, the actor and the reason', async () => {
    await h.asUser(staff);
    await h.q(`select narrow_contact_required_documents($1, $2::text[], $3)`,
      [contact, RIDER, 'They board elsewhere']);

    await h.asSuperuser();
    const [act] = await h.q<{ actor_user_id: string; new_value: Record<string, unknown> }>(
      `select actor_user_id, new_value from audit_logs
        where table_name = 'contact_required_documents' and record_id = $1
          and new_value->>'event' = 'requirements_narrowed'
        order by occurred_at desc limit 1`, [contact]);
    expect(act).toBeTruthy();
    expect(act.actor_user_id).toBe(staff);
    expect(act.new_value.reason).toBe('They board elsewhere');
    expect((act.new_value.skipped_templates as string[]).slice().sort()).toEqual(HORSE_ONLY);
    expect(act.new_value.destroyed).toBe(false);

    // …beside a per-template row for each skip, from the ONE skipping body.
    const perTemplate = await h.q<{ new_value: Record<string, string> }>(
      `select new_value from audit_logs
        where record_id = $1 and new_value->>'event' = 'requirement_skipped'
          and new_value->>'reason' = 'They board elsewhere'`, [contact]);
    expect(perTemplate.map((r) => r.new_value.template_key).sort()).toEqual(HORSE_ONLY);
  });
});

// ── TEST 6 ──────────────────────────────────────────────────────────────────
describe('6. a narrowing with no reason is refused', () => {
  it.each([[null], [''], ['   ']])('refuses reason %p and changes nothing', async (reason) => {
    await h.asUser(staff);
    await expect(h.q(`select narrow_contact_required_documents($1, $2::text[], $3)`, [contact, RIDER, reason]))
      .rejects.toThrow(/reason is required/);

    await h.asSuperuser();
    const rows = await h.q<{ template_key: string; skipped_at: string | null }>(
      `select template_key, skipped_at from contact_required_documents where contact_id = $1 order by 1`, [contact]);
    expect(rows.map((x) => x.template_key)).toEqual(MIXED);
    expect(rows.every((x) => x.skipped_at === null)).toBe(true);
  });

  it('and a bare skip with no reason is refused for the same reason', async () => {
    await h.asUser(staff);
    await expect(h.q(`select skip_required_document($1, 'RELEASE_HORSE_CARE', '  ')`, [contact]))
      .rejects.toThrow(/reason is required/);
  });
});

// ── TEST 7 ──────────────────────────────────────────────────────────────────
describe('7. the derived path still cannot strip', () => {
  it('apply_category_documents(RIDER) on a mixed holder removes NOTHING', async () => {
    await h.asServiceRole();
    const [n] = await h.q<{ apply_category_documents: number }>(
      `select apply_category_documents($1, array['RIDER'])`, [contact]);
    expect(n.apply_category_documents).toBe(MIXED.length);

    await h.asSuperuser();
    const rows = await h.q<{ template_key: string }>(
      `select template_key from contact_required_documents where contact_id = $1 order by 1`, [contact]);
    // The CATEGORISE reproduction, at the function that used to do the damage.
    expect(rows.map((x) => x.template_key)).toEqual(MIXED);
  });

  it('the four destroying lines are gone from the function body itself', async () => {
    await h.asSuperuser();
    const [d] = await h.q<{ def: string }>(
      `select pg_get_functiondef('public.apply_category_documents(uuid,text[])'::regprocedure) as def`);
    // The body QUOTES the removed statement in a comment, deliberately, so that
    // whoever reads it next knows what used to be there and why it left. Strip
    // the comments before asserting, or the epitaph reads as the corpse.
    const executable = d.def.replace(/--.*$/gm, '');
    expect(executable).not.toMatch(/delete\s+from\s+contact_required_documents/i);
    expect(d.def).toMatch(/THE DELETE THAT USED TO STAND HERE IS GONE/);
  });

  it('an empty / unmatched category set still touches nothing (rule 1a, kept)', async () => {
    await h.asServiceRole();
    await h.q(`select apply_category_documents($1, array[]::text[])`, [contact]);
    await h.q(`select apply_category_documents($1, array['NOT_A_CATEGORY'])`, [contact]);

    await h.asSuperuser();
    const rows = await h.q<{ template_key: string }>(
      `select template_key from contact_required_documents where contact_id = $1 order by 1`, [contact]);
    expect(rows.map((x) => x.template_key)).toEqual(MIXED);
  });

  it('it still ADDS what a newly ticked category requires', async () => {
    await h.asSuperuser();
    await h.q(`delete from contact_required_documents where contact_id = $1`, [contact]);
    await h.asServiceRole();
    await h.q(`select apply_category_documents($1, array['HORSE_OWNER'])`, [contact]);

    await h.asSuperuser();
    const rows = await h.q<{ template_key: string }>(
      `select template_key from contact_required_documents where contact_id = $1 order by 1`, [contact]);
    expect(rows.map((x) => x.template_key)).toEqual(HORSE_OWNER.slice().sort());
  });

  it('re-ticking a category does NOT silently undo a deliberate staff skip', async () => {
    await h.asUser(staff);
    await h.q(`select narrow_contact_required_documents($1, $2::text[], $3)`,
      [contact, RIDER, 'lessons only']);
    // …the trigger path fires again (they buy another lesson).
    await h.asServiceRole();
    await h.q(`select apply_category_documents($1, array['RIDER','HORSE_OWNER'])`, [contact]);

    await h.asSuperuser();
    const skipped = await h.q<{ template_key: string }>(
      `select template_key from contact_required_documents
        where contact_id = $1 and skipped_at is not null order by 1`, [contact]);
    expect(skipped.map((x) => x.template_key)).toEqual(HORSE_ONLY);
  });
});

// ── AUTHORITY ───────────────────────────────────────────────────────────────
describe('the narrowing door is staff-only', () => {
  it('a member cannot narrow their own paperwork', async () => {
    await h.asUser(member);
    await expect(h.q(`select narrow_contact_required_documents($1, $2::text[], 'nope')`, [contact, RIDER]))
      .rejects.toThrow(/staff access required/);
  });

  it('anon cannot reach it at all', async () => {
    await h.asAnon();
    await expect(h.q(`select narrow_contact_required_documents($1, $2::text[], 'nope')`, [contact, RIDER]))
      .rejects.toThrow();
  });
});

// ── TEST 8 ──────────────────────────────────────────────────────────────────
describe('8. the migration itself moves no requirement rows', () => {
  it('contains no DML against contact_required_documents outside a function body', () => {
    const sql = mig('20260821T1400_nostrip_narrowing_skips_and_never_destroys.sql');
    // Everything between $function$ … $function$ is a body, and everything after
    // a `--` is prose. Neither is a statement the migration RUNS. Strip both and
    // what is left must contain no write against any table.
    const statements = sql
      .replace(/\$function\$[\s\S]*?\$function\$/g, ' <body> ')
      .replace(/^\s*--.*$/gm, '')
      .replace(/\s+/g, ' ');
    expect(statements).not.toMatch(/\b(insert\s+into|update\s+\w|delete\s+from|alter\s+table|drop\s+table|truncate)\b/i);
  });
});
