/**
 * Generic multi-party contract workflow engine (20260705010000) — WIRED, end to
 * end. Proves the engine works on the horse lease as its first instance and
 * that ownership enforcement, change tracking, sharing, the state machine, and
 * the reused signing engine all hold.
 *
 * This is the anti-"name-only" guarantee: every table gets exercised through its
 * real RPCs as the correct RLS role, and rows are read back.
 *
 * Reuse under test:
 *   - start_lease_contract_v2 → contracts/contract_parties spine + generate_document('HORSE_LEASE_V2')
 *   - lock_and_sign_contract → record_signature (seal/hash/EXECUTED + workflow_state)
 *   - share_document / request_document_change → notify_user
 *
 * TASK-TESTREPAIR (2026-08-21): rewritten against the CURRENT engine — this file
 * had not been touched since 2026-07-05 and every RPC/table it drove had since
 * been renamed or retired:
 *   - start_lease_contract (3-arg) does not exist; start_lease_contract_v2
 *     (20260720180000) has since become the only entry point, and the plain
 *     name was dropped entirely in 20260801000000_audit_fixes_batch1.sql.
 *   - `engagements` / `engagement_parties` are RETIRED (CLAUDE.md "RETIRED — do
 *     not resurrect"), replaced by the contracts/contract_parties spine plus
 *     document_parties (document-scoped signer roles).
 *   - `document_change_requests` is now `contract_change_requests`.
 *   - H1 (originator_authority_collapse, 20260729022000): "the company (staff)
 *     is always the author" — an originator contact (even the lessee, who is
 *     marked originator_contact_id) has NO special edit/workflow authority
 *     anymore. Structural authoring (share_document, editable→editing,
 *     resolve_change_request) is staff-only now; a party's authority is
 *     limited to the fields their role owns via document_party_controls.
 *   - PARTYCTRL (20260804150000_seed_party_controls_at_creation.sql):
 *     start_lease_contract_v2 seeds document_party_controls with
 *     can_edit_deal=true for every party role at creation, so DEAL fields are
 *     editable by any party from the start — recipient_editing no longer
 *     gates DEAL-field access (it now only gates whether a non-staff caller
 *     may reopen editable→editing).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let org: string;
let admin: string;
let lesseeUid: string, lessorUid: string, strangerUid: string;
let lessee: string, lessor: string, stranger: string;
let horse: string;
let documentId: string;
let contractId: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  // Two-party lease: clear the seeded COMPANY signatory so start_lease_contract_v2
  // builds a pure LESSEE + LESSOR two-party document (the owner's dual-signature
  // "lessee signs, lessor countersigns → EXECUTED" scenario).
  await h.q(`update business_config set signatory_contact_id = null where org_id = $1`, [org]);

  // The snapshot is schema-only outside a small allowlist; status_events_vocab
  // is not on it, but every `documents` INSERT fires trg_status_documents,
  // which FKs into that vocabulary (same seed contractsend_field_roundtrip and
  // sale_golden_render use).
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

  const breed = (await h.q<{ display_name: string }>(
    `select display_name from horse_breeds order by code limit 1`))[0].display_name;

  // contacts (org-scoped; org_id defaults to the pinned seed GUC)
  lessee = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('Lucy','Lessee','lucy@lessee.test') returning id`))[0].id;
  lessor = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('Otto','Lessor','otto@lessor.test') returning id`))[0].id;
  stranger = (await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('Sam','Stranger','sam@stranger.test') returning id`))[0].id;
  horse = (await h.q<{ id: string }>(
    `insert into horses (registered_name, nickname, breed, sex) values ('Comet','Buddy',$1,'GELDING') returning id`,
    [(await h.q<{ code: string }>(`select code from horse_breeds order by code limit 1`))[0].code]))[0].id;
  void breed;

  // authenticated users, each bound to their party contact
  admin      = await h.createAuthUser({ email: 'ops@fhe.test', role: 'ADMIN', org });
  lesseeUid  = await h.createAuthUser({ email: 'lucy@lessee.test', role: 'USER', org });
  lessorUid  = await h.createAuthUser({ email: 'otto@lessor.test', role: 'USER', org });
  strangerUid= await h.createAuthUser({ email: 'sam@stranger.test', role: 'USER', org });
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [lessee, lesseeUid]);
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [lessor, lessorUid]);
  await h.q(`update profiles set contact_id=$1 where user_id=$2`, [stranger, strangerUid]);
});

afterAll(async () => {
  await h?.close();
});

// ============================================================
// 1. start_lease_contract_v2 — the wired instance
// ============================================================
describe('start_lease_contract_v2 seeds a party-owned lease contract', () => {
  it('creates contract + document + seeded fields with correct owner_role attribution', async () => {
    // start_lease_contract_v2 requires staff (H1: the company always authors).
    await h.asUser(admin);
    const [r] = await h.q<{ start_lease_contract_v2: {
      document_id: string; contract_id: string; fields_seeded: number; template_key: string } }>(
      `select start_lease_contract_v2($1,$2,$3)`, [lessee, lessor, horse]);
    documentId = r.start_lease_contract_v2.document_id;
    contractId = r.start_lease_contract_v2.contract_id;
    expect(documentId).toBeTruthy();
    expect(contractId).toBeTruthy();
    expect(r.start_lease_contract_v2.template_key).toBe('HORSE_LEASE_V2');
    expect(r.start_lease_contract_v2.fields_seeded).toBeGreaterThan(30);

    await h.asSuperuser();
    // two-party lease: LESSEE + LESSOR, both signers (no COMPANY — signatory cleared)
    const parties = await h.q<{ party_role: string; is_signer: boolean }>(
      `select party_role, is_signer from document_parties where document_id=$1 order by signer_order`, [documentId]);
    expect(parties.map((p) => p.party_role)).toEqual(['LESSEE', 'LESSOR']);
    expect(parties.every((p) => p.is_signer)).toBe(true);

    // document is workflow-editable. H1 (originator_authority_collapse): the
    // COMPANY (staff caller) is always the author now — originator_contact_id
    // is the STAFF caller's own contact (auto-linked by profiles_link_contact_trg),
    // never the lessee's, and it grants no special edit authority (see
    // set_contract_field's ownership tests below).
    const [d] = await h.q<{ workflow_state: string; originator_contact_id: string; status: string }>(
      `select workflow_state, originator_contact_id, status from documents where id=$1`, [documentId]);
    expect(d.workflow_state).toBe('editable');
    const [adminProfile] = await h.q<{ contact_id: string }>(
      `select contact_id from profiles where user_id=$1`, [admin]);
    expect(d.originator_contact_id).toBe(adminProfile.contact_id);
    expect(d.originator_contact_id).not.toBe(lessee);

    // PARTYCTRL: both parties get a document_party_controls row seeded at creation
    const controls = await h.q<{ party_role: string; can_edit_deal: boolean; can_fill: boolean }>(
      `select party_role, can_edit_deal, can_fill from document_party_controls where document_id=$1 order by party_role`, [documentId]);
    expect(controls.map((c) => c.party_role)).toEqual(['LESSEE', 'LESSOR']);
    expect(controls.every((c) => c.can_edit_deal === true && c.can_fill === true)).toBe(true);

    // field ownership: LESSOR personal + HORSE.*→LESSOR, TXN→DEAL
    // (LESSEE.FULL_NAME / LESSOR.FULL_NAME are D22 party TOKENS — filled by
    // fill_party_fields_from_contacts, not contract_field_defs rows — so they
    // are not asserted here as owned fields.)
    const byKey = new Map((await h.q<{ field_key: string; owner_role: string; value_type: string }>(
      `select field_key, owner_role, value_type from contract_fields where document_id=$1`, [documentId]))
      .map((f) => [f.field_key, f]));
    expect(byKey.get('HORSE.REGISTERED_NAME')!.owner_role).toBe('LESSOR'); // horse fields owned by lessor
    expect(byKey.get('TXN.LEASE_TYPE')!.owner_role).toBe('LESSOR');
    expect(byKey.get('TXN.PURCHASE_PRICE') ?? byKey.get('TXN.LEASE_START')!).toBeTruthy();
    expect(byKey.get('TXN.PERMITTED_ACTIVITIES')!.owner_role).toBe('DEAL');
    // checkbox value_type for the permitted-activities field
    expect(byKey.get('TXN.PERMITTED_ACTIVITIES')!.value_type).toBe('checkbox');
  });
});

// ============================================================
// 2. set_contract_field — the ownership enforcement matrix
// ============================================================
describe('set_contract_field enforces party ownership', () => {
  it('lessor CAN set their own LESSOR field, and the HORSE fields they own', async () => {
    await h.asUser(lessorUid);
    const [a] = await h.q<{ set_contract_field: { value: string } }>(
      `select set_contract_field($1,'TXN.LEASE_TYPE','Full lease')`, [documentId]); // LESSOR-owned
    expect(a.set_contract_field.value).toBe('Full lease');
    const [b] = await h.q<{ set_contract_field: { value: string } }>(
      `select set_contract_field($1,'HORSE.REGISTERED_NAME','Comet')`, [documentId]);
    expect(b.set_contract_field.value).toBe('Comet');
  });

  it('lessee CANNOT set a LESSOR-owned field (owner_role mismatch)', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select set_contract_field($1,'TXN.LEASE_TYPE','Partial lease')`, [documentId]))
      .rejects.toThrow(/not authorized to edit this field/);
  });

  it('lessee CANNOT set a HORSE field (owned by lessor)', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select set_contract_field($1,'HORSE.REGISTERED_NAME','Bay')`, [documentId]))
      .rejects.toThrow(/not authorized to edit this field/);
  });

  // PARTYCTRL (20260804150000): start_lease_contract_v2 seeds can_edit_deal=true
  // for EVERY party role at creation — DEAL fields are editable by any party
  // from the start. recipient_editing no longer gates DEAL access (that model
  // predates PARTYCTRL); it now only gates the editable→editing transition
  // (section 5 below).
  it('lessee (a party, via can_edit_deal) CAN set a DEAL field', async () => {
    await h.asUser(lesseeUid);
    const [r] = await h.q<{ set_contract_field: { value: string } }>(
      `select set_contract_field($1,'TXN.PERMITTED_ACTIVITIES','["Trail riding"]')`, [documentId]);
    expect(JSON.parse(r.set_contract_field.value)).toEqual(['Trail riding']);
  });

  it('lessor (a party, via can_edit_deal) CAN also set a DEAL field, with no gating', async () => {
    await h.asUser(lessorUid);
    const val = JSON.stringify(['Trail riding', 'Arena schooling', 'Local shows']);
    const [r] = await h.q<{ set_contract_field: { value: string; value_type: string } }>(
      `select set_contract_field($1,'TXN.PERMITTED_ACTIVITIES',$2)`, [documentId, val]);
    expect(r.set_contract_field.value_type).toBe('checkbox');
    expect(JSON.parse(r.set_contract_field.value)).toEqual(['Trail riding', 'Arena schooling', 'Local shows']);
  });

  it('a non-party (staff) CAN also set any field — staff is always authorized', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ set_contract_field: { value: string } }>(
      `select set_contract_field($1,'TXN.LEASE_TYPE','Full lease')`, [documentId]);
    expect(r.set_contract_field.value).toBe('Full lease');
  });
});

// ============================================================
// 3. share_document — H1: staff-only grant + notify
// ============================================================
describe('share_document grants access, mirrors editing, and notifies', () => {
  it('a party CANNOT share (H1: originator authority collapsed to staff)', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select share_document($1,$2,true)`, [documentId, lessor]))
      .rejects.toThrow(/not authorized to share document/);
  });

  it('staff creates the share, sets recipient_editing, and notifies the recipient', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ share_document: {
      shared_with_contact_id: string; recipient_editing: boolean; notified_at: string } }>(
      `select share_document($1,$2,true)`, [documentId, lessor]);
    expect(r.share_document.shared_with_contact_id).toBe(lessor);
    expect(r.share_document.recipient_editing).toBe(true);
    expect(r.share_document.notified_at).toBeTruthy();

    await h.asSuperuser();
    // document.recipient_editing mirrored
    const [d] = await h.q<{ recipient_editing: boolean }>(
      `select recipient_editing from documents where id=$1`, [documentId]);
    expect(d.recipient_editing).toBe(true);
    // share row exists (unique per document+contact)
    const shares = await h.q(`select id from document_shares where document_id=$1 and shared_with_contact_id=$2`,
      [documentId, lessor]);
    expect(shares).toHaveLength(1);
    // notification produced for the lessor's user
    const notes = await h.q<{ kind: string }>(
      `select kind from notifications where user_id=$1 and kind='contract_shared'`, [lessorUid]);
    expect(notes.length).toBeGreaterThanOrEqual(1);

    // reset recipient_editing off for the remaining tests (staff-only, per H1)
    await h.asUser(admin);
    await h.q(`select share_document($1,$2,false)`, [documentId, lessor]);
  });
});

// ============================================================
// 4. request_document_change / resolve_change_request
// ============================================================
describe('change requests: numbered, notified, staff-resolvable', () => {
  let cr1: string, cr2: string;

  it('a party raises change requests; sequential annotation numbers, staff notified', async () => {
    await h.asUser(lessorUid); // any party may request a change
    const [a] = await h.q<{ request_document_change: { id: string; annotation_number: number } }>(
      `select request_document_change($1,'TXN.LEASE_TYPE',null,'Reconsider full lease, propose partial')`, [documentId]);
    cr1 = a.request_document_change.id;
    expect(a.request_document_change.annotation_number).toBe(1);

    const [b] = await h.q<{ request_document_change: { id: string; annotation_number: number } }>(
      `select request_document_change($1,null,'Section 5','Clarify emergency vet responsibility')`, [documentId]);
    cr2 = b.request_document_change.id;
    expect(b.request_document_change.annotation_number).toBe(2);

    // H1: the originator is the staff caller now, not the lessee — see section 1.
    await h.asSuperuser();
    const notes = await h.q<{ kind: string }>(
      `select kind from notifications where user_id=$1 and kind='contract_change_requested'`, [admin]);
    expect(notes.length).toBeGreaterThanOrEqual(2); // originator (staff) notified per request
  });

  // H1 (originator_authority_collapse): resolve_change_request is staff-only
  // now ("unchanged authority: only staff of the org resolve change requests" —
  // its own comment). A party (even the originator) can no longer accept/reject
  // a change request themselves.
  it('a party CANNOT resolve a change request (staff-only authority)', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select resolve_change_request($1,true,'Partial lease')`, [cr1]))
      .rejects.toThrow(/not authorized to resolve changes/);
  });

  it('staff accepts, applying the new DEAL value via the ownership path; requester notified', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ resolve_change_request: { status: string } }>(
      `select resolve_change_request($1,true,'Partial lease')`, [cr1]);
    expect(r.resolve_change_request.status).toBe('accepted');

    await h.asSuperuser();
    const [f] = await h.q<{ value: string }>(
      `select value from contract_fields where document_id=$1 and field_key='TXN.LEASE_TYPE'`, [documentId]);
    expect(f.value).toBe('Partial lease'); // applied
    const notes = await h.q<{ kind: string }>(
      `select kind from notifications where user_id=$1 and kind='contract_change_resolved'`, [lessorUid]);
    expect(notes.length).toBeGreaterThanOrEqual(1);
  });

  it('staff rejects the second request without applying a value', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ resolve_change_request: { status: string } }>(
      `select resolve_change_request($1,false)`, [cr2]);
    expect(r.resolve_change_request.status).toBe('rejected');

    await h.asSuperuser();
    const open = await h.q(`select id from contract_change_requests where document_id=$1
      and parent_request_id is null and submitted_at is not null and resolved_at is null`, [documentId]);
    expect(open).toHaveLength(0); // no open requests remain (ready to lock)
  });

  it('a resolved request cannot be resolved again', async () => {
    await h.asUser(admin);
    await expect(h.q(`select resolve_change_request($1,true)`, [cr1]))
      .rejects.toThrow(/already resolved/);
  });
});

// ============================================================
// 5. advance_document_workflow — the state machine (H1: staff-driven)
// ============================================================
describe('advance_document_workflow: legal transitions succeed, illegal raise', () => {
  it('rejects a manual →executed', async () => {
    await h.asUser(admin);
    await expect(h.q(`select advance_document_workflow($1,'executed')`, [documentId]))
      .rejects.toThrow(/reached only by signing/);
  });

  it('rejects an unknown target state', async () => {
    await h.asUser(admin);
    await expect(h.q(`select advance_document_workflow($1,'frozen')`, [documentId]))
      .rejects.toThrow(/unknown target/);
  });

  it('a party may NOT reopen editable→editing while recipient_editing is off (H1)', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select advance_document_workflow($1,'editing')`, [documentId]))
      .rejects.toThrow(/counterparty may open editing only when recipient editing is enabled/);
  });

  it('cannot lock while required fields are still empty', async () => {
    await h.asUser(admin);
    await expect(h.q(`select advance_document_workflow($1,'locked')`, [documentId]))
      .rejects.toThrow(/cannot lock/);
  });

  it('fills all required fields (staff-driven), then editable→in_review→locked are legal', async () => {
    // HORSE_LEASE_V2 carries ~30 required fields, most conditionally gated.
    // Rather than hand-pick each one (brittle against the next template edit),
    // drive it the way contract_lock_blockers itself reports readiness: loop
    // reading its 'required_fields' blocker and filling whatever it names,
    // choosing the branch-closing value for any select/yesno field so the
    // conditional graph converges instead of fanning out.
    await h.asUser(admin);
    const CLOSE_BRANCH: Record<string, string> = {
      'LESSEE.PARTY_TYPE': 'INDIVIDUAL', 'LESSOR.PARTY_TYPE': 'INDIVIDUAL',
      'TXN.GL_LESSEE_STATUS': 'DECLINES', 'TXN.GL_LESSOR_REQUIRES': 'LESSOR',
      'TXN.INJURY_HISTORY': 'NO', 'TXN.RIDER_AIDS_PROHIBITED': 'NO',
      'TXN.MORT_ELECTION': 'DECLINES', 'TXN.LEASE_TERM_TYPE': 'FIXED',
    };
    const defs = await h.q<{ field_key: string; label: string | null; input_kind: string | null; options: unknown }>(
      `select field_key, label, input_kind, options from contract_fields where document_id=$1`, [documentId]);
    const byKey = new Map(defs.map((d) => [d.field_key, d]));

    for (let i = 0; i < 15; i++) {
      const blockers = (await h.q<{ contract_lock_blockers: { code: string; message: string }[] }>(
        `select contract_lock_blockers($1)`, [documentId]))[0].contract_lock_blockers;
      const need = blockers.find((b) => b.code === 'required_fields');
      if (!need) break;
      // message names labels, not keys — refetch the actual missing keys directly.
      const missing = await h.q<{ field_key: string; input_kind: string | null; options: unknown }>(
        `select field_key, input_kind, options from contract_fields
          where document_id=$1 and required and coalesce(included,true) and not coalesce(is_na,false)
            and nullif(trim(coalesce(value,'')),'') is null`, [documentId]);
      if (missing.length === 0) break;
      for (const f of missing) {
        const v = CLOSE_BRANCH[f.field_key]
          ?? (f.input_kind === 'yesno' ? 'NO'
             : f.input_kind === 'select' && Array.isArray(f.options) && f.options.length > 0
               ? String((f.options as { value?: string }[])[0]?.value ?? f.options[0])
             : f.input_kind === 'date' ? '2027-01-01'
             : f.input_kind === 'currency' ? '500'
             : 'Provided for lock test');
        await h.q(`select set_contract_field($1,$2,$3)`, [documentId, f.field_key, v]);
      }
    }
    void byKey;

    // confirm the horse section too — a separate lock blocker (CONTRACTSEND).
    await h.q(`select confirm_horse_section($1)`, [documentId]);

    const finalBlockers = (await h.q<{ contract_lock_blockers: unknown[] }>(
      `select contract_lock_blockers($1)`, [documentId]))[0].contract_lock_blockers;
    expect(finalBlockers).toEqual([]);

    // recipient_editing was left off; staff drives the transitions (H1)
    expect((await h.q<{ advance_document_workflow: string }>(
      `select advance_document_workflow($1,'in_review')`, [documentId]))[0].advance_document_workflow).toBe('in_review');
  });

  it('in_review→editing is illegal', async () => {
    await h.asUser(admin);
    await expect(h.q(`select advance_document_workflow($1,'editing')`, [documentId]))
      .rejects.toThrow(/illegal transition/);
  });

  it('in_review→locked succeeds (no open change requests; required fields filled) and notifies the parties', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ advance_document_workflow: string }>(
      `select advance_document_workflow($1,'locked')`, [documentId]);
    expect(r.advance_document_workflow).toBe('locked');

    await h.asSuperuser();
    const [d] = await h.q<{ workflow_state: string }>(
      `select workflow_state from documents where id=$1`, [documentId]);
    expect(d.workflow_state).toBe('locked');
    const notes = await h.q<{ kind: string }>(
      `select kind from notifications where kind in ('contract_in_review','contract_locked')`);
    expect(notes.length).toBeGreaterThanOrEqual(1);
  });

  it('no field writes once locked (unless the caller is staff editing pre-signature)', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select set_contract_field($1,'TXN.LEASE_TERM_TYPE','FLEXIBLE')`, [documentId]))
      .rejects.toThrow(/document is locked|not authorized/);
  });
});

// ============================================================
// 6. lock_and_sign_contract → record_signature (the reused engine)
// ============================================================
describe('lock_and_sign_contract bridges to record_signature; dual signature executes', () => {
  it('lessee signs (not yet executed), lessor countersigns → EXECUTED + workflow_state executed + hash', async () => {
    // lessee signs first
    await h.asUser(lesseeUid);
    const [s1] = await h.q<{ lock_and_sign_contract: string }>(
      `select lock_and_sign_contract($1,'LESSEE','Lucy Lessee',true)`, [documentId]);
    expect(s1.lock_and_sign_contract).toBe('AWAITING_SIGNATURE'); // not all signers yet

    await h.asSuperuser();
    let [d] = await h.q<{ status: string; workflow_state: string }>(
      `select status, workflow_state from documents where id=$1`, [documentId]);
    expect(d.status).toBe('AWAITING_SIGNATURE');
    expect(d.workflow_state).toBe('locked'); // still locked, not yet executed

    // lessor countersigns → executes
    await h.asUser(lessorUid);
    const [s2] = await h.q<{ lock_and_sign_contract: string }>(
      `select lock_and_sign_contract($1,'LESSOR','Otto Lessor',true)`, [documentId]);
    expect(s2.lock_and_sign_contract).toBe('EXECUTED');

    await h.asSuperuser();
    [d] = await h.q<{ status: string; workflow_state: string }>(
      `select status, workflow_state from documents where id=$1`, [documentId]);
    expect(d.status).toBe('EXECUTED');
    expect(d.workflow_state).toBe('executed'); // workflow layer follows status

    const [dh] = await h.q<{ execution_hash: string; effective_date: string }>(
      `select execution_hash, effective_date from documents where id=$1`, [documentId]);
    expect(dh.execution_hash).toBeTruthy(); // tamper-evidence hash present
    expect(dh.effective_date).toBeTruthy();

    // both signatures sealed (signed_at set)
    const sigs = await h.q<{ party_role: string; signed_at: string }>(
      `select party_role, signed_at from signatures where document_id=$1 order by party_role`, [documentId]);
    expect(sigs.map((s) => s.party_role)).toEqual(['LESSEE', 'LESSOR']);
    expect(sigs.every((s) => s.signed_at)).toBe(true);

    // an executed notification was produced
    const notes = await h.q<{ kind: string }>(
      `select kind from notifications where kind='document_executed'`);
    expect(notes.length).toBeGreaterThanOrEqual(1);
  });

  it('sealed signatures are immutable (the block_signed_signature_update trigger holds)', async () => {
    await h.asSuperuser();
    await expect(h.q(
      `update signatures set typed_name='Tampered' where document_id=$1 and party_role='LESSEE'`, [documentId]))
      .rejects.toThrow(/sealed/);
  });

  it('no field writes once executed', async () => {
    await h.asUser(admin);
    await expect(h.q(`select set_contract_field($1,'TXN.LEASE_TERM_TYPE','x')`, [documentId]))
      .rejects.toThrow(/fully executed|document is locked|read-only/);
  });
});

// ============================================================
// 7. read model — my_contract_documents / contract_document_detail
// ============================================================
describe('read model surfaces the caller-appropriate view', () => {
  it('my_contract_documents lists the executed lease for a party with their roles', async () => {
    await h.asUser(lessorUid);
    const [r] = await h.q<{ my_contract_documents: Array<{
      document_id: string; workflow_state: string; my_roles: string; is_originator: boolean;
      open_change_requests: number }> }>(`select my_contract_documents()`);
    const doc = r.my_contract_documents.find((d) => d.document_id === documentId);
    expect(doc).toBeTruthy();
    expect(doc!.workflow_state).toBe('executed');
    expect(doc!.my_roles).toBe('LESSOR');
    expect(doc!.is_originator).toBe(false); // lessor is not the originator
    expect(Number(doc!.open_change_requests)).toBe(0);
  });

  it('contract_document_detail returns fields with per-caller can_edit flags + signatures', async () => {
    await h.asUser(lesseeUid);
    const [r] = await h.q<{ contract_document_detail: {
      document: { workflow_state: string; is_originator: boolean; execution_hash: string };
      my_roles: string[];
      fields: Array<{ field_key: string; owner_role: string; can_edit: boolean; value_type: string }>;
      signatures: Array<{ party_role: string; signed_at: string }>;
    } }>(`select contract_document_detail($1)`, [documentId]);
    const detail = r.contract_document_detail;
    expect(detail.document.workflow_state).toBe('executed');
    expect(detail.document.is_originator).toBe(false); // H1: the staff caller is originator, never the lessee
    expect(detail.document.execution_hash).toBeTruthy();
    expect(detail.my_roles).toContain('LESSEE');
    // executed → nothing is editable anymore
    expect(detail.fields.every((f) => f.can_edit === false)).toBe(true);
    // checkbox field is present and typed
    expect(detail.fields.find((f) => f.field_key === 'TXN.PERMITTED_ACTIVITIES')!.value_type).toBe('checkbox');
    // both signatures reported
    expect(detail.signatures.map((s) => s.party_role).sort()).toEqual(['LESSEE', 'LESSOR']);
  });
});

// ============================================================
// 8. RLS — org boundary + non-party isolation
// ============================================================
describe('RLS: non-party isolation and org boundary', () => {
  it('a non-party contact cannot read the contract fields', async () => {
    await h.asUser(strangerUid);
    const rows = await h.q(`select id from contract_fields where document_id=$1`, [documentId]);
    expect(rows).toHaveLength(0); // party_read policy denies a non-party
  });

  it('a non-party cannot write a field either (no party role)', async () => {
    await h.asUser(strangerUid);
    await expect(h.q(`select set_contract_field($1,'TXN.LEASE_TERM_TYPE','x')`, [documentId]))
      .rejects.toThrow(/not authorized|fully executed|document is locked/);
  });

  it('a non-party cannot read the change requests or shares', async () => {
    await h.asUser(strangerUid);
    expect(await h.q(`select id from contract_change_requests where document_id=$1`, [documentId])).toHaveLength(0);
    expect(await h.q(`select id from document_shares where document_id=$1`, [documentId])).toHaveLength(0);
  });

  it('a party (lessor) CAN read the contract fields (party_read policy)', async () => {
    await h.asUser(lessorUid);
    const rows = await h.q(`select id from contract_fields where document_id=$1`, [documentId]);
    expect(rows.length).toBeGreaterThan(30);
  });

  it('the org boundary holds: a different-org user sees no rows', async () => {
    await h.asSuperuser();
    const otherOrg = (await h.q<{ id: string }>(
      `insert into organizations (name, slug) values ('Other Barn','other-barn') returning id`))[0].id;
    const outsider = await h.createAuthUser({ email: 'out@other.test', role: 'ADMIN', org: otherOrg });
    await h.asUser(outsider);
    const rows = await h.q(`select id from contract_fields where document_id=$1`, [documentId]);
    expect(rows).toHaveLength(0); // RESTRICTIVE org boundary denies cross-tenant read
  });
});
