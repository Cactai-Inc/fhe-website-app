/**
 * PARTYSTAGING — proves the new migration actually applies and behaves, not
 * just typechecks: edit-tier (can_edit_deal) applies an added item
 * immediately; suggest-tier (can_suggest) stages it in
 * contract_pending_compositions until the ACTUAL COUNTERPARTY resolves it
 * (not staff-only, and not the proposer resolving their own suggestion);
 * clause proposals follow the same edit-vs-suggest split; and an
 * already-added item can only be edited/removed by its own author or staff.
 *
 * Same harness pattern as additem_line_position.test.ts: the committed
 * snapshot predates both the add-item feature and this migration, so both
 * are applied on top of it in order, ending with this one — which fully
 * redefines every function it touches (never a source-patch), so nothing
 * else needs replaying.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from './harness';

const ADDITEM_BASE = '20260804120000_add_item_composition.sql';
const ADDITEM_MIGRATION = '20260812T1200_additem_line_position.sql';
const MIGRATION = '20260815T1000_partystaging_edit_vs_suggest.sql';
const TEMPLATE = 'HORSE_LEASE_V2';

let h: TestDb;
let docId: string;
let sectionKey: string;
let lessorUid: string; let lessorContact: string;
let lesseeUid: string; let lesseeContact: string;
let staffUid: string;

/** Insert a contact + a profile linked to it, in one call. */
async function makeParty(role: 'LESSOR' | 'LESSEE', firstName: string) {
  const contact = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name) values ($1, 'Test') returning id`, [firstName]))[0].id;
  const uid = await h.createAuthUser({ email: `${role.toLowerCase()}@test.fhe` });
  await h.asSuperuser();
  await h.q(`update profiles set contact_id = $1 where user_id = $2`, [contact, uid]);
  const org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  await h.q(
    `insert into document_parties (document_id, contact_id, party_role, org_id) values ($1, $2, $3, $4)`,
    [docId, contact, role, org]);
  return { uid, contact };
}

async function setControls(role: string, can_edit_deal: boolean, can_suggest: boolean) {
  await h.asSuperuser();
  await h.q(
    `insert into document_party_controls (document_id, party_role, can_fill, can_edit_deal, can_suggest, org_id)
     select $1, $2, true, $3, $4, org_id from documents where id = $1
     on conflict (document_id, party_role) do update set can_edit_deal = excluded.can_edit_deal, can_suggest = excluded.can_suggest`,
    [docId, role, can_edit_deal, can_suggest]);
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  await h.db.exec(readFileSync(join(MIGRATIONS_DIR, ADDITEM_BASE), 'utf8'));
  await h.db.exec(readFileSync(join(MIGRATIONS_DIR, ADDITEM_MIGRATION), 'utf8'));
  const sql = readFileSync(join(MIGRATIONS_DIR, MIGRATION), 'utf8');
  // Applied TWICE — the second run is the replay-safety proof (CREATE OR
  // REPLACE + ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS
  // throughout, so this must be a silent no-op the second time).
  await h.db.exec(sql);
  await h.db.exec(sql);

  sectionKey = (await h.q<{ section_key: string }>(
    `select section_key from contract_section_defs
      where template_key = $1 order by sort_order limit 1`, [TEMPLATE]))[0].section_key;

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

  const org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  const tpl = (await h.q<{ id: string }>(
    `select id from contract_templates where template_key = $1`, [TEMPLATE]))[0].id;
  docId = (await h.q<{ id: string }>(
    `insert into documents (org_id, template_id, workflow_state, title)
     values ($1, $2, 'editable', 'PARTYSTAGING lease') returning id`, [org, tpl]))[0].id;

  const lessor = await makeParty('LESSOR', 'Lessor');
  lessorUid = lessor.uid; lessorContact = lessor.contact;
  const lessee = await makeParty('LESSEE', 'Lessee');
  lesseeUid = lessee.uid; lesseeContact = lessee.contact;
  staffUid = await h.createAuthUser({ isAdmin: true });

  // The user's own example: lessor edits directly, lessee can only suggest.
  await setControls('LESSOR', true, false);
  await setControls('LESSEE', false, true);
  // can_add_clause is its own independent grant (not implied by can_edit_deal
  // or can_suggest) — both sides need it for the clause tests below.
  await h.asSuperuser();
  await h.q(`update document_party_controls set can_add_clause = true where document_id = $1`, [docId]);
}, 600_000);

afterAll(async () => { await h.close(); });

describe('the migration lands on a fresh database, and replays safely', () => {
  it('added_by_contact_id exists on contract_fields', async () => {
    await h.asSuperuser();
    const cols = await h.q<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_name = 'contract_fields' and column_name = 'added_by_contact_id'`);
    expect(cols).toHaveLength(1);
  });

  it('contract_pending_compositions exists', async () => {
    await h.asSuperuser();
    const t = await h.q(`select 1 from information_schema.tables where table_name = 'contract_pending_compositions'`);
    expect(t).toHaveLength(1);
  });
});

describe('edit-tier applies directly', () => {
  it('LESSOR (can_edit_deal) adding an item lands immediately, stamped with their own authorship', async () => {
    await h.asUser(lessorUid);
    await h.q(`select add_contract_composition($1, $2::jsonb)`, [docId, JSON.stringify({
      section: sectionKey, section_new: false,
      header: { text: 'Edit-tier header' }, elements: [], lines: [{ body: 'edit-tier line' }],
    })]);
    const rows = await h.q<{ body: string; added_by_contact_id: string }>(
      `select body, added_by_contact_id from contract_fields
        where document_id = $1 and custom_kind = 'line' and body = 'edit-tier line'`, [docId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].added_by_contact_id).toBe(lessorContact);
  });

  it('LESSEE (suggest-tier, not edit) is refused by add_contract_composition directly', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select add_contract_composition($1, $2::jsonb)`, [docId, JSON.stringify({
      section: sectionKey, section_new: false,
      header: { text: 'Should not land' }, elements: [], lines: [{ body: 'nope' }],
    })])).rejects.toThrow(/not authorized/);
  });
});

describe('suggest-tier stages, and the actual counterparty (not staff-only) resolves it', () => {
  let headerKey: string;
  let pendingId: string;

  beforeAll(async () => {
    await h.asSuperuser();
    headerKey = (await h.q<{ field_key: string }>(
      `select field_key from contract_fields
        where document_id = $1 and custom_kind = 'header' and label = 'Edit-tier header'`, [docId]))[0].field_key;
  });

  it('LESSEE proposing an item into an existing header stages it, with nothing applied yet', async () => {
    await h.asUser(lesseeUid);
    const [{ pending_id }] = await h.q<{ pending_id: string }>(
      `select propose_contract_composition($1, $2::jsonb)->>'pending_id' as pending_id`, [docId, JSON.stringify({
        section: sectionKey, section_new: false,
        header: { clause_key: headerKey }, elements: [], lines: [{ body: 'suggested line' }],
      })]);
    pendingId = pending_id;
    expect(pendingId).toBeTruthy();

    const applied = await h.q(
      `select 1 from contract_fields where document_id = $1 and body = 'suggested line'`, [docId]);
    expect(applied).toHaveLength(0);

    await h.asSuperuser();
    const pending = await h.q<{ status: string }>(
      `select status from contract_pending_compositions where id = $1`, [pendingId]);
    expect(pending[0].status).toBe('open');
  });

  it('the proposer (LESSEE) resolving their own suggestion is refused', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select resolve_pending_composition($1, 'include')`, [pendingId]))
      .rejects.toThrow(/not authorized/);
  });

  it('the actual counterparty (LESSOR, not staff) can include it, and authorship is stamped to the original proposer', async () => {
    await h.asUser(lessorUid);
    await h.q(`select resolve_pending_composition($1, 'include')`, [pendingId]);

    const rows = await h.q<{ added_by_contact_id: string }>(
      `select added_by_contact_id from contract_fields
        where document_id = $1 and body = 'suggested line'`, [docId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].added_by_contact_id).toBe(lesseeContact);

    await h.asSuperuser();
    const pending = await h.q<{ status: string }>(
      `select status from contract_pending_compositions where id = $1`, [pendingId]);
    expect(pending[0].status).toBe('accepted');
  });

  it('a rejected suggestion stays queryable (grayed-out, not deleted) and nothing applies', async () => {
    await h.asUser(lesseeUid);
    const [{ pending_id }] = await h.q<{ pending_id: string }>(
      `select propose_contract_composition($1, $2::jsonb)->>'pending_id' as pending_id`, [docId, JSON.stringify({
        section: sectionKey, section_new: false,
        header: { clause_key: headerKey }, elements: [], lines: [{ body: 'to be rejected' }],
      })]);

    await h.asUser(lessorUid);
    await h.q(`select resolve_pending_composition($1, 'reject')`, [pending_id]);

    await h.asSuperuser();
    const pending = await h.q<{ status: string }>(
      `select status from contract_pending_compositions where id = $1`, [pending_id]);
    expect(pending[0].status).toBe('rejected');
    const applied = await h.q(
      `select 1 from contract_fields where document_id = $1 and body = 'to be rejected'`, [docId]);
    expect(applied).toHaveLength(0);
  });

  it('a suggestion targeting a new section is refused — suggest-tier must anchor to existing structure', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select propose_contract_composition($1, $2::jsonb)`, [docId, JSON.stringify({
      section: 'BRAND_NEW_SECTION', section_new: true,
      header: { text: 'New header' }, elements: [], lines: [{ body: 'x' }],
    })])).rejects.toThrow(/existing section/);
  });
});

describe('author-only edit/remove of an already-added item', () => {
  let itemKey: string;

  beforeAll(async () => {
    await h.asUser(lessorUid);
    await h.q(`select add_contract_composition($1, $2::jsonb)`, [docId, JSON.stringify({
      section: sectionKey, section_new: false,
      header: { text: 'Author-owned header' }, elements: [], lines: [{ body: 'author line' }],
    })]);
    await h.asSuperuser();
    itemKey = (await h.q<{ field_key: string }>(
      `select field_key from contract_fields where document_id = $1 and body = 'author line'`, [docId]))[0].field_key;
  });

  it('the other party cannot remove someone else\'s item', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select remove_contract_composition($1, $2)`, [docId, itemKey]))
      .rejects.toThrow(/author or staff/);
  });

  it('the other party cannot edit someone else\'s item', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select update_contract_composition($1, $2, $3::jsonb)`, [docId, itemKey, JSON.stringify({
      section: sectionKey, section_new: false, header: { text: 'x' }, elements: [], lines: [{ body: 'hijack' }],
    })])).rejects.toThrow(/author or staff/);
  });

  it('the author can edit their own item (field_key changes, content does not survive under the old key)', async () => {
    await h.asUser(lessorUid);
    await h.q(`select update_contract_composition($1, $2, $3::jsonb)`, [docId, itemKey, JSON.stringify({
      section: sectionKey, section_new: false, header: { text: 'Author-owned header' }, elements: [], lines: [{ body: 'edited line' }],
    })]);
    const old = await h.q(`select 1 from contract_fields where field_key = $1`, [itemKey]);
    expect(old).toHaveLength(0);
    const edited = await h.q(`select 1 from contract_fields where document_id = $1 and body = 'edited line'`, [docId]);
    expect(edited).toHaveLength(1);
  });

  it('staff can remove any item regardless of authorship', async () => {
    await h.asUser(lessorUid);
    const [{ header_key }] = await h.q<{ header_key: string }>(
      `select add_contract_composition($1, $2::jsonb)->>'header_key' as header_key`, [docId, JSON.stringify({
        section: sectionKey, section_new: false, header: { text: 'Staff-removable' }, elements: [], lines: [{ body: 'z' }],
      })]);
    await h.asUser(staffUid);
    await expect(h.q(`select remove_contract_composition($1, $2)`, [docId, header_key])).resolves.toBeDefined();
  });
});

describe('clauses follow the same edit-vs-suggest split, with peer approval', () => {
  it('LESSOR (edit-tier) proposing a clause applies it immediately', async () => {
    await h.asUser(lessorUid);
    const [{ applied }] = await h.q<{ applied: boolean }>(
      `select (propose_clause($1, $2)->>'applied')::boolean as applied`, [docId, 'An edit-tier clause.']);
    expect(applied).toBe(true);
    const terms = await h.q<{ value: string }>(
      `select value from contract_fields where document_id = $1 and field_key = 'TXN.ADDITIONAL_TERMS'`, [docId]);
    expect(terms[0].value).toContain('An edit-tier clause.');
  });

  it('LESSEE (suggest-tier) proposing a clause stages it', async () => {
    await h.asUser(lesseeUid);
    const [{ addendum_id, applied }] = await h.q<{ addendum_id: string; applied: boolean }>(
      `with r as (select propose_clause($1, $2) as j)
       select (j->>'addendum_id')::uuid as addendum_id, (j->>'applied')::boolean as applied from r`,
      [docId, 'A suggested clause.']);
    expect(applied).toBe(false);

    await h.asUser(lesseeUid);
    await expect(h.q(`select resolve_clause($1, true)`, [addendum_id])).rejects.toThrow(/not authorized/);

    await h.asUser(lessorUid);
    await h.q(`select resolve_clause($1, true)`, [addendum_id]);
    const terms = await h.q<{ value: string }>(
      `select value from contract_fields where document_id = $1 and field_key = 'TXN.ADDITIONAL_TERMS'`, [docId]);
    expect(terms[0].value).toContain('A suggested clause.');
  });
});

describe('the in_review widening is preserved, not reverted by this migration', () => {
  it('add_contract_composition and propose_clause still work on an in_review document', async () => {
    // Staff, same as the existing additem_line_position.test.ts convention —
    // has_staff_access() bypasses the party/controls lookup entirely, so this
    // isolates the STATE gate from the party-authorization gate (covered
    // thoroughly above).
    await h.asSuperuser();
    const other = (await h.q<{ id: string }>(
      `insert into documents (org_id, template_id, workflow_state, title)
       select org_id, template_id, 'in_review', 'PARTYSTAGING in_review' from documents where id = $1
       returning id`, [docId]))[0].id;

    await h.asUser(staffUid);
    await h.q(`select add_contract_composition($1, $2::jsonb)`, [other, JSON.stringify({
      section: sectionKey, section_new: false, header: { text: 'In review header' }, elements: [], lines: [{ body: 'x' }],
    })]);
    const [{ applied }] = await h.q<{ applied: boolean }>(
      `select (propose_clause($1, $2)->>'applied')::boolean as applied`, [other, 'in review clause']);
    expect(applied).toBe(true);
  });

  it('an executed document still refuses (the gate the UI mirrors, unchanged)', async () => {
    await h.asSuperuser();
    const other = (await h.q<{ id: string }>(
      `insert into documents (org_id, template_id, workflow_state, title)
       select org_id, template_id, 'executed', 'PARTYSTAGING executed' from documents where id = $1
       returning id`, [docId]))[0].id;
    await h.asUser(staffUid);
    await expect(h.q(`select add_contract_composition($1, $2::jsonb)`, [other, JSON.stringify({
      section: sectionKey, section_new: false, header: { text: 'Nope' }, elements: [], lines: [{ body: 'x' }],
    })])).rejects.toThrow(/not editable/);
  });
});
