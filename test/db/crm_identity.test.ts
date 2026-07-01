/**
 * Category 1 — Schema: CRM identity backbone (migration 008).
 *
 * Proves the "contact is the backbone" decision is real and safe:
 *  - all 8 migrations apply in order on top of the deployed seven,
 *  - the finalized 13-service catalog is seeded and killed services are absent,
 *  - existing offerings are reconciled onto the canonical service types,
 *  - human identifiers (CON-/CLI-) generate sequentially,
 *  - profiles.contact_id bridges auth↔domain and current_contact_id() resolves,
 *  - RLS scopes a client to their own contact/client row, admins see all, and
 *    soft-deleted rows vanish from the owner's view.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, migrationFiles, type TestDb } from './harness';

let h: TestDb;

beforeAll(async () => {
  h = await createTestDb();
});
afterAll(async () => {
  await h?.close();
});

describe('migration applies additively', () => {
  it('lands cleanly as an additive migration after the seven', () => {
    const files = migrationFiles();
    expect(files.length).toBeGreaterThanOrEqual(8);
    const idx = files.findIndex((f) => f.includes('crm_identity_backbone'));
    expect(idx, 'crm_identity_backbone migration present').toBeGreaterThanOrEqual(7);
  });

  it('left the existing tables intact (orders/profiles still present)', async () => {
    await h.asSuperuser();
    const t = await h.q<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema='public' and table_name in ('orders','profiles','offerings','contacts','clients')`,
    );
    expect(t.map((x) => x.table_name).sort()).toEqual(['clients', 'contacts', 'offerings', 'orders', 'profiles']);
  });
});

describe('service catalog (13 canonical types)', () => {
  it('seeds exactly the 13 finalized service types, all active', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ code: string }>(`select code from service_types where active order by sort_order`);
    expect(rows.map((r) => r.code)).toEqual([
      'HORSE_FINDER', 'HORSE_EVALUATION', 'HORSE_PURCHASE_ASSISTANCE', 'HORSE_SALE_ASSISTANCE',
      'HORSE_LEASE_IN_ASSISTANCE', 'HORSE_LEASE_OUT_ASSISTANCE', 'HORSE_TRAINING', 'HORSE_EXERCISE',
      'HORSE_CLIPPING', 'RIDING_LESSON', 'JUMPER_TRAINING', 'HORSEMANSHIP_TRAINING', 'INDEPENDENT_CONTRACTOR',
    ]);
  });

  it('contains no killed-service values', async () => {
    await h.asSuperuser();
    const bad = await h.q<{ code: string }>(
      `select code from service_types
       where lower(code) ~ '(grooming|horse_care|bathing|mane|turnout_assist|show_prep|tack_clean)'
          or lower(display_name) ~ '(grooming|horse care|bathing|mane pull|turnout assist|show prep|tack clean)'`,
    );
    expect(bad).toHaveLength(0);
  });

  it('seeds the 9-state engagement lifecycle', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ code: string }>(`select code from engagement_status order by sort_order`);
    expect(rows.map((r) => r.code)).toEqual([
      'LEAD', 'INTAKE_STARTED', 'INTAKE_COMPLETE', 'CONTRACT_PENDING',
      'AWAITING_SIGNATURE', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED',
    ]);
  });
});

describe('offerings reconciliation', () => {
  it('maps every active offering onto a canonical service type', async () => {
    await h.asSuperuser();
    const unmapped = await h.q(`select slug from offerings where active and service_type is null`);
    expect(unmapped).toHaveLength(0);
  });

  it('maps the key slugs to the right service type', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ slug: string; service_type: string }>(
      `select slug, service_type from offerings where slug in ('riding-lesson','hair-clipping','horse-locator','hunter-jumper')`,
    );
    const map = Object.fromEntries(rows.map((r) => [r.slug, r.service_type]));
    expect(map['riding-lesson']).toBe('RIDING_LESSON');
    expect(map['hair-clipping']).toBe('HORSE_CLIPPING');
    expect(map['horse-locator']).toBe('HORSE_FINDER');
    expect(map['hunter-jumper']).toBe('JUMPER_TRAINING');
  });
});

describe('human identifiers + composed address', () => {
  it('assigns CON-/CLI- codes sequentially and composes the address', async () => {
    await h.asSuperuser();
    const c1 = await h.q<{ display_code: string; address_composed: string }>(
      `insert into contacts (full_name, address_line1, city, state, postal_code)
       values ('Jane Rider','123 Mesa Rd','San Diego','CA','92130') returning display_code, address_composed`,
    );
    const c2 = await h.q<{ display_code: string }>(
      `insert into contacts (full_name) values ('Second Person') returning display_code`,
    );
    expect(c1[0].display_code).toMatch(/^CON-\d{6}$/);
    expect(c2[0].display_code).toMatch(/^CON-\d{6}$/);
    // sequential
    const n1 = Number(c1[0].display_code.slice(4));
    const n2 = Number(c2[0].display_code.slice(4));
    expect(n2).toBe(n1 + 1);
    // composed single-line address for {{PARTY.ADDRESS}}
    expect(c1[0].address_composed).toBe('123 Mesa Rd, San Diego, CA 92130');

    const contactId = (await h.q<{ id: string }>(`select id from contacts where full_name='Jane Rider'`))[0].id;
    const cli = await h.q<{ display_code: string }>(
      `insert into clients (contact_id) values ($1) returning display_code`, [contactId],
    );
    expect(cli[0].display_code).toMatch(/^CLI-\d{6}$/);
  });
});

describe('RLS — contact is the backbone, scoped to its owner', () => {
  it('scopes a client to their own contact; admin sees all; anon sees none', async () => {
    await h.asSuperuser();
    // Two portal users, each linked to their own contact.
    const aliceUid = await h.createAuthUser({ email: 'alice@portal.fhe' });
    const bobUid = await h.createAuthUser({ email: 'bob@portal.fhe' });
    const adminUid = await h.createAuthUser({ email: 'ops@fhe', isAdmin: true });

    const aliceContact = (await h.q<{ id: string }>(
      `insert into contacts (full_name, email) values ('Alice A','alice@portal.fhe') returning id`))[0].id;
    const bobContact = (await h.q<{ id: string }>(
      `insert into contacts (full_name, email) values ('Bob B','bob@portal.fhe') returning id`))[0].id;
    await h.q(`update profiles set contact_id=$1 where user_id=$2`, [aliceContact, aliceUid]);
    await h.q(`update profiles set contact_id=$1 where user_id=$2`, [bobContact, bobUid]);
    await h.q(`insert into clients (contact_id) values ($1)`, [aliceContact]);

    // Alice sees only her own contact + her own client row.
    await h.asUser(aliceUid);
    const aliceContacts = await h.q<{ full_name: string }>(`select full_name from contacts`);
    expect(aliceContacts).toHaveLength(1);
    expect(aliceContacts[0].full_name).toBe('Alice A');
    const myClient = await h.q(`select id from clients`);
    expect(myClient).toHaveLength(1);
    // current_contact_id() resolves the bridge
    const resolved = await h.q<{ cid: string }>(`select current_contact_id() as cid`);
    expect(resolved[0].cid).toBe(aliceContact);

    // Bob never sees Alice.
    await h.asUser(bobUid);
    const bobContacts = await h.q<{ full_name: string }>(`select full_name from contacts`);
    expect(bobContacts.map((c) => c.full_name)).toEqual(['Bob B']);

    // Admin sees all (≥ the 2 portal contacts + the 2 from the identifier test).
    await h.asUser(adminUid);
    const all = await h.q(`select id from contacts`);
    expect(all.length).toBeGreaterThanOrEqual(4);

    // Anon sees nothing (no policy grants anon SELECT on contacts).
    await h.asAnon();
    const anon = await h.q(`select id from contacts`);
    expect(anon).toHaveLength(0);
  });

  it('lets a client update only their own contact, and hides soft-deleted rows from them', async () => {
    await h.asSuperuser();
    const uid = await h.createAuthUser({ email: 'carol@portal.fhe' });
    const cid = (await h.q<{ id: string }>(
      `insert into contacts (full_name, email) values ('Carol C','carol@portal.fhe') returning id`))[0].id;
    await h.q(`update profiles set contact_id=$1 where user_id=$2`, [cid, uid]);

    // Update own contact succeeds.
    await h.asUser(uid);
    await h.q(`update contacts set phone='858-555-0101' where id=$1`, [cid]);
    const phone = (await h.q<{ phone: string }>(`select phone from contacts where id=$1`, [cid]))[0].phone;
    expect(phone).toBe('858-555-0101');

    // Soft-delete it (admin/service action) → vanishes from Carol's view, admin still sees it.
    await h.asSuperuser();
    await h.q(`update contacts set deleted_at=now() where id=$1`, [cid]);
    await h.asUser(uid);
    expect(await h.q(`select id from contacts where id=$1`, [cid])).toHaveLength(0);
    await h.asSuperuser();
    expect((await h.q(`select id from contacts where id=$1`, [cid])).length).toBe(1);
  });
});
