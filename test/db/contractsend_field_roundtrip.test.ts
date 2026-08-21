/**
 * CONTRACTSEND §1 (server half) — every field type a lease uses round-trips
 * through the REAL `set_contract_field`, and the horse section really is keyed
 * 'HORSE'.
 *
 * Why this exists: WALK3 reported that no date could be saved and had to write
 * TXN.LEASE_START directly into the database. That framing left open whether the
 * server was rejecting dates. It is not — the write path is clean for every
 * `input_kind` on the lease, which is what localises the defect to the browser
 * (pinned separately in test/ui/contractsend_field_commit.test.tsx).
 *
 * The interesting assertion is the last one: `contract_lock_blockers` returns
 * `horse_unconfirmed` on a fresh lease, and the ONLY control that clears it is
 * the one WALK3 found unreachable. That is why the §2 case-mismatch blocked
 * every lease from ever locking, and not merely a cosmetic affordance.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let org: string, lessee: string, lessor: string, horse: string, admin: string;
let documentId: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  await h.q(`update business_config set signatory_contact_id = null where org_id = $1`, [org]);
  lessee = (await h.q<{ id: string }>(
    `insert into contacts (first_name,last_name,email) values ('Lucy','Lessee','lucy@cs.test') returning id`))[0].id;
  lessor = (await h.q<{ id: string }>(
    `insert into contacts (first_name,last_name,email) values ('Otto','Lessor','otto@cs.test') returning id`))[0].id;
  horse = (await h.q<{ id: string }>(
    `insert into horses (registered_name,nickname,breed,sex) values ('Comet','Buddy',$1,'GELDING') returning id`,
    [(await h.q<{ code: string }>(`select code from horse_breeds order by code limit 1`))[0].code]))[0].id;

  /* The snapshot is schema-only outside a small allowlist, and
     status_events_vocab is not on it — but every documents INSERT fires
     trg_status_documents, which FKs into that vocabulary. Same seed the
     additem suite uses. */
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

  admin = await h.createAuthUser({ email: 'ops@cs.test', role: 'ADMIN', org });
  await h.asUser(admin);
  documentId = (await h.q<{ start_lease_contract_v2: { document_id: string } }>(
    `select start_lease_contract_v2($1,$2,$3)`, [lessee, lessor, horse]))[0].start_lease_contract_v2.document_id;
});

afterAll(async () => { await h?.close(); });

/** One representative value per input_kind, in the shape that kind stores. */
const PROBE: Record<string, string> = {
  date: '2027-03-04', currency: '750', percent: '35', number: '11',
  text: 'probe text', longtext: 'probe long text', certify: 'YES', yesno: 'YES',
};

describe('every input_kind on a lease round-trips through set_contract_field', () => {
  it('writes and reads back one field of each kind', async () => {
    await h.asSuperuser();
    const samples = await h.q<{ field_key: string; input_kind: string }>(
      `select distinct on (coalesce(input_kind,'text'))
              field_key, coalesce(input_kind,'text') as input_kind
         from contract_fields where document_id=$1
        order by coalesce(input_kind,'text'), field_key`, [documentId]);
    expect(samples.length).toBeGreaterThan(10);

    const failures: string[] = [];
    for (const s of samples) {
      // fee_schedule stores a JSON object and refuses a bare string BY DESIGN —
      // its own guard, not a defect, so it is exercised through the structured path.
      if (s.input_kind === 'fee_schedule') continue;
      const want = PROBE[s.input_kind] ?? 'PROBE';
      await h.asUser(admin);
      await h.q(`select set_contract_field($1,$2,$3)`, [documentId, s.field_key, want]);
      await h.asSuperuser();
      const [row] = await h.q<{ value: string | null }>(
        `select value from contract_fields where document_id=$1 and field_key=$2`, [documentId, s.field_key]);
      if (row.value !== want) failures.push(`${s.input_kind} (${s.field_key}): wrote ${want}, read ${row.value}`);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('a date in particular stores and reads back unchanged, ISO in and ISO out', async () => {
    await h.asUser(admin);
    await h.q(`select set_contract_field($1,'TXN.LEASE_START','2027-03-04')`, [documentId]);
    const [d] = await h.q<{ contract_document_detail: { fields: { field_key: string; value: string }[] } }>(
      `select contract_document_detail($1)`, [documentId]);
    const start = d.contract_document_detail.fields.find((f) => f.field_key === 'TXN.LEASE_START');
    // The browser puts this straight into <input type="date">, which silently
    // rejects any non-ISO string — so the exact format is the contract.
    expect(start?.value).toBe('2027-03-04');
  });
});

describe('the horse section, and why its unreachable control blocked every lease', () => {
  it('stores its fields under the upper-case key HORSE', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ section: string }>(
      `select distinct section from contract_fields where document_id=$1 and section ilike 'horse'`, [documentId]);
    expect(rows.map((r) => r.section)).toEqual(['HORSE']);
  });

  it('reports horse_unconfirmed until confirm_horse_section runs', async () => {
    await h.asUser(admin);
    const before = (await h.q<{ contract_lock_blockers: { code: string }[] }>(
      `select contract_lock_blockers($1)`, [documentId]))[0].contract_lock_blockers;
    expect(before.map((b) => b.code)).toContain('horse_unconfirmed');

    await h.q(`select confirm_horse_section($1)`, [documentId]);
    const after = (await h.q<{ contract_lock_blockers: { code: string }[] }>(
      `select contract_lock_blockers($1)`, [documentId]))[0].contract_lock_blockers;
    expect(after.map((b) => b.code)).not.toContain('horse_unconfirmed');
  });
});
