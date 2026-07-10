/**
 * Generic multi-party contract workflow engine (20260705010000) — WIRED, end to
 * end. Mirrors rider_onboarding.test.ts in style; proves the engine works on the
 * horse lease as its first instance and that ownership enforcement, change
 * tracking, sharing, the state machine, and the reused signing engine all hold.
 *
 * This is the anti-"name-only" guarantee: every table gets exercised through its
 * real RPCs as the correct RLS role, and rows are read back.
 *
 * Reuse under test:
 *   - start_lease_contract → create_lease_engagement + generate_document('HORSE_LEASE')
 *   - lock_and_sign_contract → record_signature v6 (seal/hash/EXECUTED + workflow_state)
 *   - share_document / request_document_change → notify_user
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
let engagementId: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;

  // Two-party lease: clear the seeded COMPANY signatory so create_lease_engagement
  // builds a pure LESSEE + LESSOR two-party engagement (the owner's dual-signature
  // "lessee signs, lessor countersigns → EXECUTED" scenario).
  await h.q(`update business_config set signatory_contact_id = null where org_id = $1`, [org]);

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
    `insert into horses (registered_name, barn_name, breed, sex) values ('Comet','Buddy',$1,'GELDING') returning id`,
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
// 1. start_lease_contract — the wired instance
// ============================================================
describe('start_lease_contract seeds a party-owned lease contract', () => {
  it('creates engagement + document + seeded fields with correct owner_role attribution', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ start_lease_contract: {
      document_id: string; engagement_id: string; fields_seeded: number } }>(
      `select start_lease_contract($1,$2,$3)`, [lessee, lessor, horse]);
    documentId = r.start_lease_contract.document_id;
    engagementId = r.start_lease_contract.engagement_id;
    expect(documentId).toBeTruthy();
    expect(engagementId).toBeTruthy();
    expect(r.start_lease_contract.fields_seeded).toBeGreaterThan(30);

    await h.asSuperuser();
    // two-party lease: LESSEE + LESSOR, both signers (no COMPANY — signatory cleared)
    const parties = await h.q<{ party_role: string; is_signer: boolean }>(
      `select party_role, is_signer from engagement_parties where engagement_id=$1 order by signer_order`, [engagementId]);
    expect(parties.map((p) => p.party_role)).toEqual(['LESSEE', 'LESSOR']);
    expect(parties.every((p) => p.is_signer)).toBe(true);

    // document is workflow-editable, originator = lessee ("us")
    const [d] = await h.q<{ workflow_state: string; originator_contact_id: string; status: string }>(
      `select workflow_state, originator_contact_id, status from documents where id=$1`, [documentId]);
    expect(d.workflow_state).toBe('editable');
    expect(d.originator_contact_id).toBe(lessee);

    // field ownership: LESSEE personal→LESSEE, LESSOR personal + HORSE.*→LESSOR, TXN→DEAL
    const byKey = new Map((await h.q<{ field_key: string; owner_role: string; value_type: string }>(
      `select field_key, owner_role, value_type from contract_fields where document_id=$1`, [documentId]))
      .map((f) => [f.field_key, f]));
    expect(byKey.get('LESSEE.FULL_NAME')!.owner_role).toBe('LESSEE');
    expect(byKey.get('LESSEE.EMAIL')!.owner_role).toBe('LESSEE');
    expect(byKey.get('LESSOR.FULL_NAME')!.owner_role).toBe('LESSOR');
    expect(byKey.get('HORSE.REGISTERED_NAME')!.owner_role).toBe('LESSOR'); // horse fields owned by lessor
    expect(byKey.get('HORSE.MICROCHIP')!.owner_role).toBe('LESSOR');
    expect(byKey.get('TXN.LEASE_FEE')!.owner_role).toBe('DEAL');
    expect(byKey.get('TXN.LEASE_TYPE')!.owner_role).toBe('DEAL');
    // checkbox value_type for the permitted-activities field
    expect(byKey.get('TXN.PERMITTED_ACTIVITIES')!.value_type).toBe('checkbox');
    expect(byKey.get('TXN.LEASE_FEE')!.value_type).toBe('currency');
  });
});

// ============================================================
// 2. set_contract_field — the ownership enforcement matrix
// ============================================================
describe('set_contract_field enforces party ownership', () => {
  it('lessee CAN set their own LESSEE field', async () => {
    await h.asUser(lesseeUid);
    const [r] = await h.q<{ set_contract_field: { value: string; entered_by_contact_id: string } }>(
      `select set_contract_field($1,'LESSEE.PHONE','555-0100')`, [documentId]);
    expect(r.set_contract_field.value).toBe('555-0100');
    expect(r.set_contract_field.entered_by_contact_id).toBe(lessee);
  });

  it('lessee CANNOT set a LESSOR personal field', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select set_contract_field($1,'LESSOR.PHONE','999')`, [documentId]))
      .rejects.toThrow(/not authorized to edit this field/);
  });

  it('lessee CANNOT set a HORSE field (owned by lessor)', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select set_contract_field($1,'HORSE.COLOR','Bay')`, [documentId]))
      .rejects.toThrow(/not authorized to edit this field/);
  });

  it('lessee (the originator) CAN set a DEAL field', async () => {
    await h.asUser(lesseeUid);
    const [r] = await h.q<{ set_contract_field: { value: string } }>(
      `select set_contract_field($1,'TXN.LEASE_FEE','$500/month')`, [documentId]);
    expect(r.set_contract_field.value).toBe('$500/month');
  });

  it('lessor CANNOT set a DEAL field while recipient_editing is false', async () => {
    await h.asUser(lessorUid);
    await expect(h.q(`select set_contract_field($1,'TXN.LEASE_TERM','6 months')`, [documentId]))
      .rejects.toThrow(/not authorized to edit this field/);
  });

  it('lessor CAN set their own LESSOR field, and the HORSE fields they own', async () => {
    await h.asUser(lessorUid);
    const [a] = await h.q<{ set_contract_field: { value: string } }>(
      `select set_contract_field($1,'LESSOR.PHONE','555-0200')`, [documentId]);
    expect(a.set_contract_field.value).toBe('555-0200');
    const [b] = await h.q<{ set_contract_field: { value: string } }>(
      `select set_contract_field($1,'HORSE.COLOR','Chestnut')`, [documentId]);
    expect(b.set_contract_field.value).toBe('Chestnut');
  });

  it('lessor CANNOT edit a lessee personal field (ever)', async () => {
    await h.asUser(lessorUid);
    await expect(h.q(`select set_contract_field($1,'LESSEE.PHONE','000')`, [documentId]))
      .rejects.toThrow(/not authorized to edit this field/);
  });

  it('lessor CAN set a DEAL field AFTER set_recipient_editing(true)', async () => {
    await h.asUser(admin);
    await h.q(`select set_recipient_editing($1,true)`, [documentId]);
    await h.asUser(lessorUid);
    const [r] = await h.q<{ set_contract_field: { value: string } }>(
      `select set_contract_field($1,'TXN.LEASE_TERM','6 months')`, [documentId]);
    expect(r.set_contract_field.value).toBe('6 months');
  });

  it('lessee STILL cannot edit a lessor personal field even with recipient_editing on', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select set_contract_field($1,'LESSOR.PHONE','111')`, [documentId]))
      .rejects.toThrow(/not authorized to edit this field/);
    // turn recipient_editing back off for the rest of the flow
    await h.asUser(admin);
    await h.q(`select set_recipient_editing($1,false)`, [documentId]);
  });

  it('a checkbox field round-trips through the ownership path', async () => {
    await h.asUser(lesseeUid); // originator owns DEAL
    const val = JSON.stringify(['Trail riding', 'Arena schooling', 'Local shows']);
    const [r] = await h.q<{ set_contract_field: { value: string; value_type: string } }>(
      `select set_contract_field($1,'TXN.PERMITTED_ACTIVITIES',$2)`, [documentId, val]);
    expect(r.set_contract_field.value_type).toBe('checkbox');
    expect(JSON.parse(r.set_contract_field.value)).toEqual(['Trail riding', 'Arena schooling', 'Local shows']);
  });
});

// ============================================================
// 3. share_document — party-to-party grant + notify
// ============================================================
describe('share_document grants access, mirrors editing, and notifies', () => {
  it('creates the share, sets recipient_editing, and notifies the recipient', async () => {
    await h.asUser(lesseeUid); // originator shares with the lessor
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

    // reset recipient_editing off for the remaining ownership tests
    await h.asUser(admin);
    await h.q(`select set_recipient_editing($1,false)`, [documentId]);
  });
});

// ============================================================
// 4. request_document_change / resolve_change_request
// ============================================================
describe('change requests: numbered, notified, resolvable', () => {
  let cr1: string, cr2: string;

  it('assigns sequential annotation numbers and notifies the originator', async () => {
    await h.asUser(lessorUid); // the counterparty raises change requests
    const [a] = await h.q<{ request_document_change: { id: string; annotation_number: number; current_value: string } }>(
      `select request_document_change($1,'TXN.LEASE_FEE',null,'Fee is too high, propose $400')`, [documentId]);
    cr1 = a.request_document_change.id;
    expect(a.request_document_change.annotation_number).toBe(1);
    expect(a.request_document_change.current_value).toBe('$500/month'); // snapshot of the field

    const [b] = await h.q<{ request_document_change: { id: string; annotation_number: number } }>(
      `select request_document_change($1,null,'Section 5','Clarify emergency vet responsibility')`, [documentId]);
    cr2 = b.request_document_change.id;
    expect(b.request_document_change.annotation_number).toBe(2);

    await h.asSuperuser();
    const notes = await h.q<{ kind: string }>(
      `select kind from notifications where user_id=$1 and kind='contract_change_requested'`, [lesseeUid]);
    expect(notes.length).toBeGreaterThanOrEqual(2); // originator notified per request
  });

  it('accept applies the new DEAL value via the ownership path; requester is notified', async () => {
    await h.asUser(lesseeUid); // originator resolves
    const [r] = await h.q<{ resolve_change_request: { status: string } }>(
      `select resolve_change_request($1,true,'$400/month')`, [cr1]);
    expect(r.resolve_change_request.status).toBe('accepted');

    await h.asSuperuser();
    const [f] = await h.q<{ value: string }>(
      `select value from contract_fields where document_id=$1 and field_key='TXN.LEASE_FEE'`, [documentId]);
    expect(f.value).toBe('$400/month'); // applied
    const notes = await h.q<{ kind: string }>(
      `select kind from notifications where user_id=$1 and kind='contract_change_resolved'`, [lessorUid]);
    expect(notes.length).toBeGreaterThanOrEqual(1);
  });

  it('reject closes the request without applying a value', async () => {
    await h.asUser(lesseeUid);
    const [r] = await h.q<{ resolve_change_request: { status: string } }>(
      `select resolve_change_request($1,false)`, [cr2]);
    expect(r.resolve_change_request.status).toBe('rejected');

    await h.asSuperuser();
    const open = await h.q(`select id from document_change_requests where document_id=$1 and status='open'`, [documentId]);
    expect(open).toHaveLength(0); // no open requests remain (ready to lock)
  });

  it('a resolved request cannot be resolved again', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select resolve_change_request($1,true)`, [cr1]))
      .rejects.toThrow(/already accepted/);
  });
});

// ============================================================
// 5. advance_document_workflow — the state machine
// ============================================================
describe('advance_document_workflow: legal transitions succeed, illegal raise', () => {
  it('rejects a manual →executed', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select advance_document_workflow($1,'executed')`, [documentId]))
      .rejects.toThrow(/reached only by signing/);
  });

  it('rejects an unknown target state', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select advance_document_workflow($1,'frozen')`, [documentId]))
      .rejects.toThrow(/unknown target/);
  });

  it('cannot lock while required fields are still empty', async () => {
    // TXN.LEASE_TYPE and the names are still empty at this point → lock refused
    await h.asUser(lesseeUid);
    await expect(h.q(`select advance_document_workflow($1,'locked')`, [documentId]))
      .rejects.toThrow(/required field/);
  });

  it('fills all required fields via each owner (and staff), then editable→editing→editable→in_review are legal', async () => {
    // required fields: LESSEE.FULL_NAME (LESSEE), LESSOR.FULL_NAME + HORSE.REGISTERED_NAME (LESSOR),
    // TXN.LEASE_TYPE + TXN.LEASE_FEE (DEAL — TXN.LEASE_FEE already set). Fill them while editable.
    await h.asUser(lesseeUid);
    await h.q(`select set_contract_field($1,'LESSEE.FULL_NAME','Lucy Lessee')`, [documentId]);
    await h.q(`select set_contract_field($1,'TXN.LEASE_TYPE','Full lease')`, [documentId]); // originator owns DEAL
    await h.asUser(lessorUid);
    await h.q(`select set_contract_field($1,'LESSOR.FULL_NAME','Otto Lessor')`, [documentId]);
    await h.q(`select set_contract_field($1,'HORSE.REGISTERED_NAME','Comet')`, [documentId]);

    await h.asUser(lesseeUid);
    expect((await h.q<{ advance_document_workflow: string }>(
      `select advance_document_workflow($1,'editing')`, [documentId]))[0].advance_document_workflow).toBe('editing');
    expect((await h.q<{ advance_document_workflow: string }>(
      `select advance_document_workflow($1,'editable')`, [documentId]))[0].advance_document_workflow).toBe('editable');
    expect((await h.q<{ advance_document_workflow: string }>(
      `select advance_document_workflow($1,'in_review')`, [documentId]))[0].advance_document_workflow).toBe('in_review');
  });

  it('in_review→editing is illegal', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select advance_document_workflow($1,'editing')`, [documentId]))
      .rejects.toThrow(/illegal transition/);
  });

  it('in_review→locked succeeds (no open change requests; required fields filled) and notifies the counterparty', async () => {
    await h.asUser(lesseeUid);
    const [r] = await h.q<{ advance_document_workflow: string }>(
      `select advance_document_workflow($1,'locked')`, [documentId]);
    expect(r.advance_document_workflow).toBe('locked');

    await h.asSuperuser();
    const [d] = await h.q<{ workflow_state: string }>(
      `select workflow_state from documents where id=$1`, [documentId]);
    expect(d.workflow_state).toBe('locked');
    // the lessor (counterparty) was notified on the in_review/locked handoffs
    const notes = await h.q<{ kind: string }>(
      `select kind from notifications where user_id=$1 and kind in ('contract_in_review','contract_locked')`, [lessorUid]);
    expect(notes.length).toBeGreaterThanOrEqual(1);
  });

  it('no field writes once locked', async () => {
    await h.asUser(lesseeUid);
    await expect(h.q(`select set_contract_field($1,'TXN.LEASE_TERM','12 months')`, [documentId]))
      .rejects.toThrow(/document is locked/);
  });
});

// ============================================================
// 6. lock_and_sign_contract → record_signature v6 (the reused engine)
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
    expect(d.workflow_state).toBe('executed'); // v6: workflow layer follows status

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
      `select kind from notifications where kind='document_executed' and title like '%signed%'`);
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
    await expect(h.q(`select set_contract_field($1,'TXN.LEASE_TERM','x')`, [documentId]))
      .rejects.toThrow(/document is locked|read-only/);
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
    expect(detail.document.is_originator).toBe(true); // lessee is originator
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
    await expect(h.q(`select set_contract_field($1,'LESSEE.PHONE','666')`, [documentId]))
      .rejects.toThrow(/not authorized|document is locked/);
  });

  it('a non-party cannot read the change requests or shares', async () => {
    await h.asUser(strangerUid);
    expect(await h.q(`select id from document_change_requests where document_id=$1`, [documentId])).toHaveLength(0);
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
