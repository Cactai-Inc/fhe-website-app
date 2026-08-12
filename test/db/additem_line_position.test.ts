/**
 * TASK ADDITEM — position within an item, and the sort_order collision that
 * made "append" mean nothing.
 *
 * add_contract_composition numbered its content lines 10, 20, 30 … from scratch
 * on EVERY call, so a second addition to the SAME header wrote the same
 * sort_orders as the first. remerge_contract_from_clauses orders authored lines
 * by (header order, line sort_order) and had nothing to break the tie: two
 * two-line additions came out interleaved, in neither authoring order. There
 * was also no way to ask for any position other than "wherever the tie lands".
 *
 * The fix uses the ordering column that already exists —
 * contract_fields.sort_order, the one the composer and the editor both read.
 * `header.line_position` splices the new lines into the header's existing run
 * and the whole run is renumbered 10, 20, 30 …
 *
 * The default harness loads the committed schema snapshot rather than replaying
 * the migration chain (which has a known break), and the snapshot predates this
 * migration — so the test applies the migration file ITSELF on top of it, twice.
 * That is the point: a typecheck says nothing about whether a plpgsql body
 * compiles or whether re-applying the journal double-writes.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from './harness';

/* The committed snapshot was taken 2026-08-03 — the day BEFORE the add-item
 * feature shipped — so it has no `contract_fields.custom_kind` and no
 * composition RPCs at all. The feature's own migration is applied first to
 * bring the snapshot up to the point this one changes; it is self-contained
 * (it adds the columns and defines all three functions outright, rather than
 * rewriting an existing body in place, which is the class of migration this
 * repo cannot replay). */
const BASE = '20260804120000_add_item_composition.sql';
const MIGRATION = '20260812T1200_additem_line_position.sql';
const TEMPLATE = 'HORSE_LEASE_V2';

let h: TestDb;
let docId: string;
let sectionKey: string;
let headerKey: string;

/** The authored lines under one header, in the order the document reads them. */
async function linesUnder(clauseKey: string) {
  return h.q<{ sort_order: number; body: string }>(
    `select sort_order, body from contract_fields
      where document_id = $1 and custom_kind = 'line' and clause_key = $2
      order by sort_order, field_key`, [docId, clauseKey]);
}

async function addLines(spec: Record<string, unknown>) {
  await h.q(`select add_contract_composition($1, $2::jsonb)`, [docId, JSON.stringify(spec)]);
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  await h.db.exec(readFileSync(join(MIGRATIONS_DIR, BASE), 'utf8'));
  const sql = readFileSync(join(MIGRATIONS_DIR, MIGRATION), 'utf8');
  // Applied TWICE on purpose: the second run is the replay-safety proof.
  await h.db.exec(sql);
  await h.db.exec(sql);

  // A section of the seeded lease template to hang the addition on.
  sectionKey = (await h.q<{ section_key: string }>(
    `select section_key from contract_section_defs
      where template_key = $1 order by sort_order limit 1`, [TEMPLATE]))[0].section_key;

  /* The snapshot is schema-only outside a small reviewed allowlist, and
     status_events_vocab is not on it — but every documents INSERT fires
     trg_status_documents, which FKs into that vocabulary. Seed the document
     codes so a document can exist at all. */
  await h.db.exec(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'document', c, c from unnest(array[
      'assigned','sent_for_review','sent','send_failed','in_progress','viewed',
      'downloaded','review_approved','ready_to_sign','signed','superseded','void','cleaned_up'
    ]) c on conflict do nothing;
    insert into document_status (code, display_name, is_terminal, sort_order) values
      ('DRAFT','Draft',false,1), ('AWAITING_SIGNATURE','Awaiting Signature',false,2),
      ('EXECUTED','Executed',true,3), ('VOID','Void',true,4)
    on conflict do nothing;`);

  const uid = await h.createAuthUser({ isAdmin: true });
  const org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  const tpl = (await h.q<{ id: string }>(
    `select id from contract_templates where template_key = $1`, [TEMPLATE]))[0].id;
  docId = (await h.q<{ id: string }>(
    `insert into documents (org_id, template_id, workflow_state, title)
     values ($1, $2, 'editable', 'ADDITEM ordering') returning id`, [org, tpl]))[0].id;

  await h.asUser(uid);
}, 600_000);

afterAll(async () => { await h.close(); });

describe('the migration lands on a fresh database', () => {
  it('the function carries the new parameter and the splice', async () => {
    const [{ def }] = await h.q<{ def: string }>(
      `select pg_get_functiondef(oid) as def from pg_proc where proname = 'add_contract_composition'`);
    expect(def).toContain('line_position');
    expect(def).toContain('v_before');
  });
});

describe('authored lines are one ordered run per header', () => {
  it('the first addition numbers from 10', async () => {
    await addLines({
      section: sectionKey, section_new: false,
      header: { text: 'Trailering', position: 1 },
      elements: [], lines: [{ body: 'line A' }, { body: 'line B' }],
    });
    headerKey = (await h.q<{ field_key: string }>(
      `select field_key from contract_fields
        where document_id = $1 and custom_kind = 'header' and label = 'Trailering'`, [docId]))[0].field_key;
    expect(await linesUnder(headerKey)).toEqual([
      { sort_order: 10, body: 'line A' },
      { sort_order: 20, body: 'line B' },
    ]);
  });

  it('a SECOND addition to the same header appends instead of colliding', async () => {
    await addLines({
      section: sectionKey, section_new: false,
      header: { clause_key: headerKey },
      elements: [], lines: [{ body: 'line C' }, { body: 'line D' }],
    });
    // The defect this pins: both additions used to write 10 and 20.
    expect(await linesUnder(headerKey)).toEqual([
      { sort_order: 10, body: 'line A' },
      { sort_order: 20, body: 'line B' },
      { sort_order: 30, body: 'line C' },
      { sort_order: 40, body: 'line D' },
    ]);
  });

  it('line_position splices into the middle and renumbers the run', async () => {
    await addLines({
      section: sectionKey, section_new: false,
      header: { clause_key: headerKey, line_position: 2 },
      elements: [], lines: [{ body: 'INSERTED' }],
    });
    expect((await linesUnder(headerKey)).map((r) => r.body)).toEqual([
      'line A', 'INSERTED', 'line B', 'line C', 'line D',
    ]);
  });

  it('position 1 goes first and an out-of-range position goes last', async () => {
    await addLines({
      section: sectionKey, section_new: false,
      header: { clause_key: headerKey, line_position: 1 },
      elements: [], lines: [{ body: 'FIRST' }],
    });
    await addLines({
      section: sectionKey, section_new: false,
      header: { clause_key: headerKey, line_position: 999 },
      elements: [], lines: [{ body: 'LAST' }],
    });
    const rows = await linesUnder(headerKey);
    expect(rows.map((r) => r.body)).toEqual([
      'FIRST', 'line A', 'INSERTED', 'line B', 'line C', 'line D', 'LAST',
    ]);
    // Renumbered as a clean run every time — no gaps to exhaust, no ties.
    expect(rows.map((r) => r.sort_order)).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  it('the composed document reads in that same order', async () => {
    const [{ merged_body: body }] = await h.q<{ merged_body: string }>(
      `select merged_body from documents where id = $1`, [docId]);
    const at = (s: string) => body.indexOf(s);
    expect(at('FIRST')).toBeGreaterThan(-1);
    expect(at('FIRST')).toBeLessThan(at('line A'));
    expect(at('line A')).toBeLessThan(at('INSERTED'));
    expect(at('INSERTED')).toBeLessThan(at('line B'));
    expect(at('line D')).toBeLessThan(at('LAST'));
  });
});

describe('adding under a TEMPLATE header keeps its own ordering', () => {
  it('appends after the template prose and orders among itself', async () => {
    const tplClause = (await h.q<{ clause_key: string }>(
      `select clause_key from contract_clause_defs
        where template_key = $1 and section_key = $2 and heading is not null and heading <> ''
        order by sort_order limit 1`, [TEMPLATE, sectionKey]))[0]?.clause_key;
    if (!tplClause) return;                 // this section has no headed clause
    await addLines({
      section: sectionKey, section_new: false,
      header: { clause_key: tplClause }, elements: [], lines: [{ body: 'hosted one' }],
    });
    await addLines({
      section: sectionKey, section_new: false,
      header: { clause_key: tplClause, line_position: 1 }, elements: [], lines: [{ body: 'hosted zero' }],
    });
    expect((await linesUnder(tplClause)).map((r) => r.body)).toEqual(['hosted zero', 'hosted one']);
  });
});

describe('the state gate the UI must mirror', () => {
  it('refuses a document that is not editable', async () => {
    await h.asSuperuser();
    const other = (await h.q<{ id: string }>(
      `insert into documents (org_id, template_id, workflow_state, title)
       select org_id, template_id, 'executed', 'ADDITEM executed' from documents where id = $1
       returning id`, [docId]))[0].id;
    const uid = await h.createAuthUser({ isAdmin: true });
    await h.asUser(uid);
    await expect(h.q(`select add_contract_composition($1, $2::jsonb)`, [other, JSON.stringify({
      section: sectionKey, section_new: false, header: { text: 'Nope' }, elements: [], lines: [{ body: 'x' }],
    })])).rejects.toThrow(/not editable/);
    await expect(h.q(`select remove_contract_composition($1, $2)`, [other, 'CUSTOM.ANY_1']))
      .rejects.toThrow(/not editable/);
  });
});
