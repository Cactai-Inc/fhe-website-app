/**
 * Rider onboarding flow (20260703030000) — the one-hour path, end to end:
 * admin provisions a paid lesson invitation → invited rider registers (contact
 * heal by email) → completes profile → generates the required set fresh
 * (COMPANY_POLICIES, FACILITY_RULES, RELEASE_PARTICIPANT, HUMAN_EMERGENCY_MEDICAL,
 * populated from the profile, CUT sections stripped for adults) → signs each
 * (EXECUTED per doc; SIG tokens substituted) → my_onboarding_state flips done
 * and carries the purchase snapshot for the dashboard plan card.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let admin: string;
let rider: string;
let tierId: string;
let engagementId: string;
let docs: Array<{ document_id: string; template_key: string; title: string; status: string }>;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  admin = await h.createAuthUser({ email: 'ops@fhe.test', isAdmin: true });
  rider = await h.createAuthUser({ email: 'madeline@rider.test' });
  const [t] = await h.q<{ id: string }>(
    `select t.id from offering_tiers t join offerings o on o.id = t.offering_id
     where o.slug = 'riding-lesson' and t.label = '4-Lesson Punch Card'`);
  tierId = t.id;
});
afterAll(async () => {
  await h?.close();
});

describe('provision_lesson_invitation', () => {
  it('creates contact + client + engagement + paid invoice + purchase + invitation in one call', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ provision_lesson_invitation: {
      invitation_id: string; token: string; engagement_id: string;
      contact_id: string; tier_label: string; amount: number;
    } }>(
      `select provision_lesson_invitation('madeline@rider.test','Madeline','Rider',$1,true,'Zelle',null)`,
      [tierId]);
    const out = r.provision_lesson_invitation;
    expect(out.tier_label).toBe('4-Lesson Punch Card');
    expect(Number(out.amount)).toBe(500);
    engagementId = out.engagement_id;

    await h.asSuperuser();
    const [eng] = await h.q<{ status: string; service_type: string }>(
      `select status, service_type from engagements where id=$1`, [engagementId]);
    expect(eng).toEqual({ status: 'AWAITING_SIGNATURE', service_type: 'RIDING_LESSON' });

    const [txn] = await h.q<{ txn_type: string; status: string; amount: string }>(
      `select txn_type, status, amount from transactions where engagement_id=$1`, [engagementId]);
    expect(txn.txn_type).toBe('INVOICE');
    expect(txn.status).toBe('PAID');
    expect(Number(txn.amount)).toBe(500);

    const [cp] = await h.q<{ tier_label: string; lessons_included: number; paid: boolean; payment_method: string }>(
      `select tier_label, lessons_included, paid, payment_method from client_purchases where engagement_id=$1`,
      [engagementId]);
    expect(cp).toEqual({
      tier_label: '4-Lesson Punch Card', lessons_included: 4, paid: true, payment_method: 'Zelle',
    });

    const [inv] = await h.q<{ status: string }>(
      `select status from invitations where token=$1`, [out.token]);
    expect(inv.status).toBe('sent');
  });

  it('rejects non-staff callers', async () => {
    await h.asUser(rider);
    await expect(h.q(
      `select provision_lesson_invitation('x@y.test','A','B',$1,false,null,null)`, [tierId]))
      .rejects.toThrow(/not authorized/);
  });
});

describe('rider onboarding', () => {
  it('profile save lands on the provisioned contact (heal by email)', async () => {
    await h.asUser(rider);
    await h.q(`select update_my_onboarding_profile($1::jsonb)`, [JSON.stringify({
      phone: '555-0142',
      date_of_birth: '1996-04-12',
      address_street: '12 Bridle Path',
      address_city: 'San Diego', address_state: 'CA', address_zip: '92130',
      emergency_contact_1_name: 'Charles Rider',
      emergency_contact_1_relationship: 'Father',
      emergency_contact_1_phone: '555-0100',
      riding_experience_years: '6',
      jump_experience: "Schooled to 2'6\"",
      riding_background: 'Hunter/jumper lessons since 2019',
    })]);

    await h.asSuperuser();
    // healed onto the PROVISIONED contact (same email), not a duplicate
    const rows = await h.q<{ id: string; phone: string; emergency_contact_1_name: string }>(
      `select id, phone, emergency_contact_1_name from contacts
       where lower(email)='madeline@rider.test' and deleted_at is null`);
    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBe('555-0142');
    expect(rows[0].emergency_contact_1_name).toBe('Charles Rider');
  });

  it('generates the 4 required documents, populated, adult sections only', async () => {
    await h.asUser(rider);
    const [g] = await h.q<{ generate_my_onboarding_documents: typeof docs }>(
      `select generate_my_onboarding_documents()`);
    docs = g.generate_my_onboarding_documents;

    expect(docs.map((d) => d.template_key)).toEqual([
      'COMPANY_POLICIES', 'FACILITY_RULES', 'RELEASE_PARTICIPANT', 'HUMAN_EMERGENCY_MEDICAL',
    ]);
    expect(docs.every((d) => d.status === 'DRAFT')).toBe(true);

    await h.asSuperuser();
    for (const d of docs) {
      const [row] = await h.q<{ merged_body: string }>(
        `select merged_body from documents where id=$1`, [d.document_id]);
      const body = row.merged_body;
      expect(body).toContain('French Heritage Equestrian');        // ORG.LEGAL_NAME
      expect(body).toContain('Madeline Rider');                    // CLIENT.PRINTED_NAME
      expect(body).not.toMatch(/\{\{(CLIENT|PARTICIPANT|ORG|DOC|REQ|ORD)\./); // all non-SIG tokens resolved
      expect(body).not.toContain('CUT-START');                     // markers processed
      expect(body).not.toContain('MINOR PARTICIPANT (IF APPLICABLE)'); // adult → minor sections gone
    }

    const [med] = await h.q<{ merged_body: string }>(
      `select merged_body from documents where id=$1`,
      [docs.find((d) => d.template_key === 'HUMAN_EMERGENCY_MEDICAL')!.document_id]);
    expect(med.merged_body).toContain('Charles Rider');            // emergency contact projected
    expect(med.merged_body).toContain('April 12, 1996');           // CLIENT.DOB formatted
    expect(med.merged_body).not.toContain('CONSENT TO TREAT A MINOR'); // adult cut

    const [rel] = await h.q<{ merged_body: string }>(
      `select merged_body from documents where id=$1`,
      [docs.find((d) => d.template_key === 'RELEASE_PARTICIPANT')!.document_id]);
    expect(rel.merged_body).toContain("Schooled to 2'6\"");        // riding attestation projected
  });

  it('regeneration retires stale drafts (no duplicates) and refreshes profile edits', async () => {
    await h.asUser(rider);
    await h.q(`select update_my_onboarding_profile($1::jsonb)`, [JSON.stringify({
      emergency_contact_2_name: 'Claire Rider',
      emergency_contact_2_relationship: 'Mother',
      emergency_contact_2_phone: '555-0101',
    })]);
    const [g] = await h.q<{ generate_my_onboarding_documents: typeof docs }>(
      `select generate_my_onboarding_documents()`);
    docs = g.generate_my_onboarding_documents;

    await h.asSuperuser();
    const live = await h.q<{ n: string }>(
      `select count(*) as n from documents where engagement_id=$1 and deleted_at is null`, [engagementId]);
    expect(Number(live[0].n)).toBe(4);
    const [med] = await h.q<{ merged_body: string }>(
      `select merged_body from documents where id=$1`,
      [docs.find((d) => d.template_key === 'HUMAN_EMERGENCY_MEDICAL')!.document_id]);
    expect(med.merged_body).toContain('Claire Rider');
  });

  it("each document EXECUTES on the rider's single signature, SIG tokens substituted", async () => {
    await h.asUser(rider);
    for (const d of docs) {
      const [s] = await h.q<{ record_signature: string }>(
        `select record_signature($1,'CLIENT',$2)`, [d.document_id, 'Madeline Rider']);
      expect(s.record_signature).toBe('EXECUTED');
    }

    await h.asSuperuser();
    for (const d of docs) {
      const [row] = await h.q<{ status: string; merged_body: string }>(
        `select status, merged_body from documents where id=$1`, [d.document_id]);
      expect(row.status).toBe('EXECUTED');
      expect(row.merged_body).not.toContain('{{SIG.');
      expect(row.merged_body).toMatch(/Signature: Madeline Rider/);
    }
  });

  it('my_onboarding_state flips done and carries the plan card snapshot', async () => {
    await h.asUser(rider);
    const [r] = await h.q<{ my_onboarding_state: {
      needed: boolean; profile_complete: boolean;
      documents: Array<{ status: string }>;
      purchase: { tier_label: string; lessons_included: number; paid: boolean };
    } }>(`select my_onboarding_state()`);
    const st = r.my_onboarding_state;
    expect(st.needed).toBe(false);
    expect(st.profile_complete).toBe(true);
    expect(st.purchase.tier_label).toBe('4-Lesson Punch Card');
    expect(st.purchase.lessons_included).toBe(4);
    expect(st.purchase.paid).toBe(true);
  });
});
