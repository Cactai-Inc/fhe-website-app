/**
 * Minor rider onboarding (20260703060000) — the AUTHENTICATED minor flow
 * (owner directive 2026-07-03: minors join /app/onboarding; the parent/legal
 * guardian holds the account and is the CLIENT signer, the minor rides as the
 * engagement's non-signing PARTICIPANT party):
 *
 *  - update_my_onboarding_profile has_minor:true attaches the minor
 *    (find-or-create contact, org from the engagement, DOB on the contact,
 *    PARTICIPANT party upserted with the org stamped);
 *  - generate_document v9 then KEEPS the MINOR_* CUT sections and resolves
 *    {{PARTICIPANT.FULL_NAME}}/{{PARTICIPANT.DOB}} — asserted in
 *    RELEASE_PARTICIPANT and HUMAN_EMERGENCY_MEDICAL (incl. the CONSENT TO
 *    TREAT A MINOR section);
 *  - the guardian's SINGLE CLIENT signature still EXECUTES every document
 *    (the PARTICIPANT is never a signer);
 *  - my_onboarding_state() exposes "minor" for the UI toggle;
 *  - has_minor:false BEFORE signing removes the PARTICIPANT party and the
 *    regenerated documents drop the minor sections; AFTER execution it never
 *    disturbs the executed records (owner directive: preserve content);
 *  - minor keys absent → the minor state is left untouched;
 *  - sign_general_release (the kiosk wrapper) now REQUIRES an email
 *    (attribution) — sign_release's in-app contract is unchanged.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let admin: string;
let guardianA: string; // keeps the minor through signing
let guardianB: string; // toggles the minor off before signing
let tierId: string;
let engA: string;
let engB: string;
let docsA: Array<{ document_id: string; template_key: string; title: string; status: string }>;
let docsB: Array<{ document_id: string; template_key: string; title: string; status: string }>;

const docBody = async (docs: typeof docsA, key: string): Promise<string> => {
  const [row] = await h.q<{ merged_body: string }>(
    `select merged_body from documents where id=$1`,
    [docs.find((d) => d.template_key === key)!.document_id]);
  return row.merged_body;
};

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  admin = await h.createAuthUser({ email: 'ops@fhe.test', isAdmin: true });
  guardianA = await h.createAuthUser({ email: 'gwen@family.test' });
  guardianB = await h.createAuthUser({ email: 'bella@family.test' });
  const [t] = await h.q<{ id: string }>(
    `select t.id from offering_tiers t join offerings o on o.id = t.offering_id
     where o.slug = 'riding-lesson' and t.label = '4-Lesson Punch Card'`);
  tierId = t.id;
});
afterAll(async () => {
  await h?.close();
});

describe('minor toggle ON — the guardian onboards a minor rider', () => {
  it('attaches the minor as a non-signing PARTICIPANT party (contact + DOB, org stamped)', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ provision_lesson_invitation: { engagement_id: string } }>(
      `select provision_lesson_invitation('gwen@family.test','Gwen','Guardian',$1,true,'Zelle',null)`,
      [tierId]);
    engA = r.provision_lesson_invitation.engagement_id;

    await h.asUser(guardianA);
    await h.q(`select update_my_onboarding_profile($1::jsonb)`, [JSON.stringify({
      phone: '555-0142',
      date_of_birth: '1988-06-02',
      address_street: '12 Bridle Path',
      address_city: 'San Diego', address_state: 'CA', address_zip: '92130',
      emergency_contact_1_name: 'Gary Guardian',
      emergency_contact_1_relationship: 'Spouse',
      emergency_contact_1_phone: '555-0100',
      riding_experience_years: '0',
      has_minor: true,
      minor_first_name: 'Mia',
      minor_last_name: 'Guardian',
      minor_dob: '2017-04-09',
    })]);

    await h.asSuperuser();
    const parties = await h.q<{
      is_signer: boolean; org_id: string;
      first_name: string; last_name: string; dob: string | null; email: string | null;
    }>(
      `select ep.is_signer, ep.org_id, c.first_name, c.last_name,
              c.date_of_birth::text as dob, c.email
       from engagement_parties ep join contacts c on c.id = ep.contact_id
       where ep.engagement_id=$1 and ep.party_role='PARTICIPANT'`, [engA]);
    expect(parties).toHaveLength(1);
    const p = parties[0];
    expect(p.is_signer).toBe(false);                    // the minor NEVER signs
    expect(p.first_name).toBe('Mia');
    expect(p.last_name).toBe('Guardian');
    expect(p.dob).toBe('2017-04-09');                   // DOB lives on the contact
    expect(p.email).toBeNull();                         // minors carry no channel
    const [eng] = await h.q<{ org_id: string }>(
      `select org_id from engagements where id=$1`, [engA]);
    expect(p.org_id).toBe(eng.org_id);                  // org stamped explicitly
  });

  it('my_onboarding_state exposes the minor for the toggle prefill', async () => {
    await h.asUser(guardianA);
    const [r] = await h.q<{ my_onboarding_state: {
      minor: { first_name: string; last_name: string; dob: string } | null;
    } }>(`select my_onboarding_state()`);
    expect(r.my_onboarding_state.minor).toEqual({
      first_name: 'Mia', last_name: 'Guardian', dob: '2017-04-09',
    });
  });

  it('generated documents KEEP the MINOR sections with the minor name + formatted DOB', async () => {
    await h.asUser(guardianA);
    const [g] = await h.q<{ generate_my_onboarding_documents: typeof docsA }>(
      `select generate_my_onboarding_documents()`);
    docsA = g.generate_my_onboarding_documents;
    expect(docsA.map((d) => d.template_key)).toEqual([
      'COMPANY_POLICIES', 'FACILITY_RULES', 'RELEASE_PARTICIPANT', 'HUMAN_EMERGENCY_MEDICAL',
    ]);

    await h.asSuperuser();
    const rel = await docBody(docsA, 'RELEASE_PARTICIPANT');
    expect(rel).toContain('MINOR PARTICIPANT (IF APPLICABLE)');
    expect(rel).toContain("Minor's Name: Mia Guardian");   // {{PARTICIPANT.FULL_NAME}}
    expect(rel).toContain('Date of Birth: April 9, 2017'); // {{PARTICIPANT.DOB}} formatted
    expect(rel).toContain('parent or legal guardian');     // guardian certification kept

    const med = await docBody(docsA, 'HUMAN_EMERGENCY_MEDICAL');
    expect(med).toContain('CONSENT TO TREAT A MINOR');     // MINOR_CONSENT_TO_TREAT kept
    expect(med).toContain('Name: Mia Guardian');           // MINOR_PARTICIPANT_INFO kept
    expect(med).toContain('Date of Birth: April 9, 2017');

    for (const d of docsA) {
      const body = await docBody(docsA, d.template_key);
      expect(body, d.template_key).not.toContain('CUT-START');           // markers processed
      expect(body, d.template_key).not.toMatch(/\{\{PARTICIPANT\./);     // minor tokens resolved
      expect(body, d.template_key).toContain('Gwen Guardian');           // guardian is the CLIENT
    }
  });

  it('a profile save WITHOUT minor keys leaves the minor attached (untouched)', async () => {
    await h.asUser(guardianA);
    await h.q(`select update_my_onboarding_profile($1::jsonb)`, [JSON.stringify({
      jump_experience: 'None yet',
    })]);
    await h.asSuperuser();
    const [n] = await h.q<{ n: string }>(
      `select count(*) as n from engagement_parties
       where engagement_id=$1 and party_role='PARTICIPANT'`, [engA]);
    expect(Number(n.n)).toBe(1);
  });

  it("the guardian's SINGLE CLIENT signature still EXECUTES each document", async () => {
    await h.asUser(guardianA);
    for (const d of docsA) {
      const [s] = await h.q<{ record_signature: string }>(
        `select record_signature($1,'CLIENT',$2)`, [d.document_id, 'Gwen Guardian']);
      expect(s.record_signature, d.template_key).toBe('EXECUTED');
    }
    await h.asSuperuser();
    const rel = await docBody(docsA, 'RELEASE_PARTICIPANT');
    expect(rel).toContain('Signature: Gwen Guardian');
    expect(rel).toContain("Minor's Name: Mia Guardian"); // minor section rides into the record
    expect(rel).not.toContain('{{SIG.');
  });

  it('toggling OFF after execution never disturbs the executed records', async () => {
    await h.asUser(guardianA);
    await h.q(`select update_my_onboarding_profile($1::jsonb)`,
      [JSON.stringify({ has_minor: false })]);
    await h.asSuperuser();
    // the engagement holds EXECUTED documents → the PARTICIPANT party stays
    const [n] = await h.q<{ n: string }>(
      `select count(*) as n from engagement_parties
       where engagement_id=$1 and party_role='PARTICIPANT'`, [engA]);
    expect(Number(n.n)).toBe(1);
    const rel = await docBody(docsA, 'RELEASE_PARTICIPANT');
    expect(rel).toContain("Minor's Name: Mia Guardian"); // content preserved
  });
});

describe('minor toggle OFF before signing — the minor detaches cleanly', () => {
  it('toggle on attaches the minor; toggle off removes the PARTICIPANT party', async () => {
    await h.asUser(admin);
    const [r] = await h.q<{ provision_lesson_invitation: { engagement_id: string } }>(
      `select provision_lesson_invitation('bella@family.test','Bella','Parent',$1,false,null,null)`,
      [tierId]);
    engB = r.provision_lesson_invitation.engagement_id;

    await h.asUser(guardianB);
    await h.q(`select update_my_onboarding_profile($1::jsonb)`, [JSON.stringify({
      phone: '555-0177',
      date_of_birth: '1990-01-15',
      emergency_contact_1_name: 'Ben Parent',
      emergency_contact_1_relationship: 'Spouse',
      emergency_contact_1_phone: '555-0178',
      has_minor: true,
      minor_first_name: 'Milo',
      minor_last_name: 'Parent',
      minor_dob: '2016-08-20',
    })]);
    const [g] = await h.q<{ generate_my_onboarding_documents: typeof docsB }>(
      `select generate_my_onboarding_documents()`);
    docsB = g.generate_my_onboarding_documents;

    await h.asSuperuser();
    const rel = await docBody(docsB, 'RELEASE_PARTICIPANT');
    expect(rel).toContain("Minor's Name: Milo Parent"); // attached and merged

    // change of plans before anything is signed: the adult rides instead
    await h.asUser(guardianB);
    await h.q(`select update_my_onboarding_profile($1::jsonb)`,
      [JSON.stringify({ has_minor: false })]);

    await h.asSuperuser();
    const [n] = await h.q<{ n: string }>(
      `select count(*) as n from engagement_parties
       where engagement_id=$1 and party_role='PARTICIPANT'`, [engB]);
    expect(Number(n.n)).toBe(0); // nothing EXECUTED yet → party removed
  });

  it('state.minor goes null and regenerated documents drop the minor sections', async () => {
    await h.asUser(guardianB);
    const [st] = await h.q<{ my_onboarding_state: { minor: unknown } }>(
      `select my_onboarding_state()`);
    expect(st.my_onboarding_state.minor).toBeNull();

    const [g] = await h.q<{ generate_my_onboarding_documents: typeof docsB }>(
      `select generate_my_onboarding_documents()`);
    docsB = g.generate_my_onboarding_documents;

    await h.asSuperuser();
    const rel = await docBody(docsB, 'RELEASE_PARTICIPANT');
    expect(rel).not.toContain('MINOR PARTICIPANT (IF APPLICABLE)');
    expect(rel).not.toContain("Minor's Name:");
    expect(rel).not.toContain('Milo Parent');
    const med = await docBody(docsB, 'HUMAN_EMERGENCY_MEDICAL');
    expect(med).not.toContain('CONSENT TO TREAT A MINOR');
    expect(med).not.toContain('Milo Parent');
    for (const d of docsB) {
      const body = await docBody(docsB, d.template_key);
      expect(body, d.template_key).not.toContain('CUT-START');
    }
  });
});

describe('sign_general_release — kiosk attribution (email REQUIRED)', () => {
  it('rejects a missing or blank email with "email is required"', async () => {
    await h.asAnon();
    await expect(h.q(
      `select sign_general_release('Walk In', null, '619-555-0100', 'Walk In')`))
      .rejects.toThrow(/email is required/);
    await expect(h.q(
      `select sign_general_release('Walk In', '   ', '619-555-0100', 'Walk In')`))
      .rejects.toThrow(/email is required/);
  });

  it('signs normally with an email (wrapper behavior otherwise unchanged)', async () => {
    await h.asAnon();
    // trailing p_esign_consent required since 20260703110000 (kiosk checkbox)
    const [row] = await h.q<{ r: { status: string; merged_body: string } }>(
      `select sign_general_release('Walk In','walkin@visitor.test',null,'Walk In',null,true) as r`);
    expect(row.r.status).toBe('EXECUTED'); // unilateral: the single signature executes
    expect(row.r.merged_body).toContain('walkin@visitor.test');
  });
});
