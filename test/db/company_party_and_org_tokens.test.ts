/**
 * Contracts Legal Pass — COMPANY party + ORG token engine
 * (migrations 20260701000000_company_party_and_org_tokens.sql +
 *  20260701010000_seed_fhe_company_identity.sql).
 *
 * Proves the pieces the pass added:
 *  - the generic ORG.* EAV fallback resolves config_values scoped to the
 *    ENGAGEMENT's org — tenant B's policy values never merge into tenant A's
 *    document, and an unseeded key renders blank (never errors, never leaks);
 *  - EMERGENCY_CONTACT.* resolves through the party arm from an engagement
 *    party with that role;
 *  - HORSE.VET_NAME / VET_PHONE / FARRIER_NAME / FARRIER_PHONE resolve from the
 *    new horses columns;
 *  - create_purchase_engagement adds the COMPANY signing party only when the
 *    org has a designated signatory (business_config.signatory_contact_id).
 *
 * Real-path: exercises the live generate_document / create_purchase_engagement
 * RPCs across two isolated tenants; probe template rows are test-owned (no
 * shipped body edited).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string, orgB: string;
let engA: string, engB: string;

/** Seed a tenant: config + policy values + client/horse/engagement graph. */
async function seedOrg(org: string, opts: {
  legal: string; invoiceDays: number; emergencyName: string; vetName: string;
}) {
  await h.q(
    `insert into business_config (org_id, legal_entity_name, signatory_name)
     values ($1,$2,$3)
     on conflict do nothing`,
    [org, opts.legal, `${opts.legal} Signer`],
  );
  await h.q(
    `insert into config_values (org_id, namespace, key, value_num)
     values ($1,'ORG','INVOICE_DUE_DAYS',$2)`,
    [org, opts.invoiceDays],
  );

  const serviceType = (await h.q<{ code: string }>(`select code from service_types order by code limit 1`))[0].code;
  const breed = (await h.q<{ code: string }>(`select code from horse_breeds order by code limit 1`))[0].code;

  const clientContact = (await h.q<{ id: string }>(
    `insert into contacts (org_id, full_name) values ($1,'Client Co') returning id`, [org]))[0].id;
  const clientId = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, clientContact]))[0].id;
  const emergency = (await h.q<{ id: string }>(
    `insert into contacts (org_id, full_name, phone) values ($1,$2,'619-555-0199') returning id`,
    [org, opts.emergencyName]))[0].id;
  const horse = (await h.q<{ id: string }>(
    `insert into horses (org_id, registered_name, breed, sex, vet_name, vet_phone, farrier_name, farrier_phone)
     values ($1,'Probe Pony',$2,'MARE',$3,'858-555-0142','Iron Mike','858-555-0143') returning id`,
    [org, breed, opts.vetName]))[0].id;

  const engId = (await h.q<{ id: string }>(
    `insert into engagements (org_id, client_id, service_type, primary_horse_id, start_date)
     values ($1,$2,$3,$4,'2026-07-01') returning id`,
    [org, clientId, serviceType, horse]))[0].id;

  await h.q(
    `insert into engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order, relationship)
     values ($1,$2,$3,'CLIENT',true,1,null),($1,$2,$4,'EMERGENCY_CONTACT',false,null,'Spouse')`,
    [org, engId, clientContact, emergency],
  );

  return engId;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  orgA = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Alpha Barn','alpha-clp') returning id`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Bravo Barn','bravo-clp') returning id`))[0].id;

  engA = await seedOrg(orgA, { legal: 'Alpha Barn LLC', invoiceDays: 15, emergencyName: 'Erin Alpha', vetName: 'Dr. Alpha Vet' });
  engB = await seedOrg(orgB, { legal: 'Bravo Barn Inc', invoiceDays: 45, emergencyName: 'Evan Bravo', vetName: 'Dr. Bravo Vet' });

  // Probe template: exercises the generic ORG EAV fallback (seeded + unseeded
  // keys), the EMERGENCY_CONTACT party arm, and the new horses columns.
  const tmplId = (await h.q<{ id: string }>(
    `insert into contract_templates (template_key, title, party_namespaces, body, active)
     values ('CLP_PROBE','Contracts Legal Pass Probe', ARRAY['CLIENT','EMERGENCY_CONTACT','COMPANY'],
       'DUE=[{{ORG.INVOICE_DUE_DAYS}}] UNSET=[{{ORG.NEVER_SEEDED_KEY}}] '
       || 'EC=[{{EMERGENCY_CONTACT.FULL_NAME}}|{{EMERGENCY_CONTACT.RELATIONSHIP}}|{{EMERGENCY_CONTACT.PHONE}}] '
       || 'VET=[{{HORSE.VET_NAME}}|{{HORSE.VET_PHONE}}] FARRIER=[{{HORSE.FARRIER_NAME}}|{{HORSE.FARRIER_PHONE}}]',
       true)
     returning id`))[0].id;

  await h.q(
    `insert into template_tokens (template_id, namespace, field, token, kind, required, party_scoped) values
       ($1,'ORG','INVOICE_DUE_DAYS','{{ORG.INVOICE_DUE_DAYS}}','field',false,false),
       ($1,'ORG','NEVER_SEEDED_KEY','{{ORG.NEVER_SEEDED_KEY}}','field',false,false),
       ($1,'EMERGENCY_CONTACT','FULL_NAME','{{EMERGENCY_CONTACT.FULL_NAME}}','field',false,true),
       ($1,'EMERGENCY_CONTACT','RELATIONSHIP','{{EMERGENCY_CONTACT.RELATIONSHIP}}','field',false,true),
       ($1,'EMERGENCY_CONTACT','PHONE','{{EMERGENCY_CONTACT.PHONE}}','field',false,true),
       ($1,'HORSE','VET_NAME','{{HORSE.VET_NAME}}','field',false,false),
       ($1,'HORSE','VET_PHONE','{{HORSE.VET_PHONE}}','field',false,false),
       ($1,'HORSE','FARRIER_NAME','{{HORSE.FARRIER_NAME}}','field',false,false),
       ($1,'HORSE','FARRIER_PHONE','{{HORSE.FARRIER_PHONE}}','field',false,false)`,
    [tmplId],
  );
});

afterAll(async () => {
  await h?.close();
});

describe('generic ORG.* EAV fallback — org-scoped, blank-safe', () => {
  it("merges each tenant's own policy value and never the other's", async () => {
    await h.asSuperuser();
    const [a] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'CLP_PROBE')`, [engA]);
    const [b] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'CLP_PROBE')`, [engB]);
    expect(a.merged_body).toContain('DUE=[15]');
    expect(a.merged_body).not.toContain('45');
    expect(b.merged_body).toContain('DUE=[45]');
    expect(b.merged_body).not.toContain('15');
  });

  it('renders an unseeded ORG key blank (no error, no token residue)', async () => {
    await h.asSuperuser();
    const [a] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'CLP_PROBE')`, [engA]);
    expect(a.merged_body).toContain('UNSET=[]');
    expect(a.merged_body).not.toMatch(/\{\{ORG\./);
  });

  it('a service_role caller pinned to org A still merges B for B’s engagement', async () => {
    await h.q(`select set_config('app.current_org', $1, false)`, [orgA]);
    await h.asServiceRole();
    const [b] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'CLP_PROBE')`, [engB]);
    expect(b.merged_body).toContain('DUE=[45]'); // B's value via v_eng.org_id
    expect(b.merged_body).not.toContain('DUE=[15]'); // NOT the org-A session's
    await h.asSuperuser();
  });
});

describe('EMERGENCY_CONTACT party tokens', () => {
  it('resolve name/relationship/phone from the engagement party', async () => {
    await h.asSuperuser();
    const [a] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'CLP_PROBE')`, [engA]);
    expect(a.merged_body).toContain('EC=[Erin Alpha|Spouse|619-555-0199]');
    const [b] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'CLP_PROBE')`, [engB]);
    expect(b.merged_body).toContain('EC=[Evan Bravo|Spouse|619-555-0199]');
  });
});

describe('HORSE vet/farrier tokens', () => {
  it('resolve from the new horses columns', async () => {
    await h.asSuperuser();
    const [a] = await h.q<{ merged_body: string }>(
      `select * from generate_document($1,'CLP_PROBE')`, [engA]);
    expect(a.merged_body).toContain('VET=[Dr. Alpha Vet|858-555-0142]');
    expect(a.merged_body).toContain('FARRIER=[Iron Mike|858-555-0143]');
  });
});

describe('COMPANY party creation is signatory-gated', () => {
  it('create_purchase_engagement adds no COMPANY party when the org has no signatory', async () => {
    await h.asSuperuser();
    const uid = await h.createAuthUser({ email: 'gate-ops@fhe.test', isAdmin: true });
    const breed = (await h.q<{ code: string }>(`select code from horse_breeds order by code limit 1`))[0].code;
    const buyer = (await h.q<{ id: string }>(
      `insert into contacts (full_name) values ('Gate Buyer') returning id`))[0].id;
    const horse = (await h.q<{ id: string }>(
      `insert into horses (registered_name, breed, sex) values ('Gate Horse',$1,'GELDING') returning id`, [breed]))[0].id;

    // Temporarily clear the seeded FHE signatory to exercise the negative path.
    const [saved] = await h.q<{ id: string; signatory_contact_id: string }>(
      `select id, signatory_contact_id from business_config where signatory_contact_id is not null limit 1`);
    await h.q(`update business_config set signatory_contact_id = null where id = $1`, [saved.id]);

    try {
      await h.asUser(uid);
      const eng = (await h.q<{ create_purchase_engagement: string }>(
        `select create_purchase_engagement($1,$2,null,1000,null)`, [buyer, horse]))[0]
        .create_purchase_engagement;
      await h.asSuperuser();
      const parties = await h.q<{ party_role: string }>(
        `select party_role from engagement_parties where engagement_id=$1`, [eng]);
      expect(parties.map((p) => p.party_role)).not.toContain('COMPANY');
    } finally {
      await h.asSuperuser();
      await h.q(`update business_config set signatory_contact_id = $1 where id = $2`,
        [saved.signatory_contact_id, saved.id]);
    }
  });
});
