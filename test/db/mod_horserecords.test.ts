/**
 * Horse Records & Health (U9, migration 20260630080000_mod_horserecords) —
 * module mod.horserecords.
 *
 * Real-path data tests (Wiring & Verification Contract §15.1(1)): every assertion
 * exercises the ACTUAL tables/predicate the app uses (horse_parties,
 * horse_health_events, caller_owns_horse) as the CORRECT RLS role, and asserts
 * rows land in the right table with the right columns and read back.
 *
 * Covers, per the U9 spec:
 *  - org_boundary + module_gate: a records-OFF org (org B) sees ZERO rows and
 *    cannot INSERT even as ADMIN; an org with the module ON (org A) works.
 *  - org_id defaults to the caller's tenant on insert (seam 1).
 *  - an OWNER contact reads its own horse_parties and horse_health_events.
 *  - caller_owns_horse() resolves via owner-of-record OR an owned engagement.
 *  - horse_parties rejects a hard DELETE (REVOKE DELETE); soft-delete only.
 *  - payers (horse_parties) resolve only within current_org() — no cross-org
 *    contact leakage (org A staff never see org B's parties, and a shared-role
 *    contact does not bridge tenants).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // FHE (tenant #1) — tier.lesson_brokerage → mod.horserecords ON
let orgB: string; // Rival — NO modules (mod.horserecords OFF)

let aAdmin: string, bAdmin: string;
let aOwnerUser: string;       // a client in org A who OWNS a horse (owner-of-record)
let aEngOwnerUser: string;    // a client in org A who owns an ENGAGEMENT on a horse
let aStranger: string;        // a client in org A who owns nothing

let aHorseOwned: string;      // org A horse whose current_owner_contact_id = aOwner contact
let aHorseEng: string;        // org A horse referenced by aEngOwner's engagement
let bHorse: string;           // org B horse

let aOwnerContact: string;    // aOwnerUser's contact
let bContact: string;         // an org B contact (party on bHorse)

/** Insert a horse under a given org (org_id defaults to the GUC). Returns id. */
async function seedHorse(org: string, barnName: string, ownerContact?: string): Promise<string> {
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org',$1,false)`, [org]);
  const [row] = await h.q<{ id: string }>(
    `insert into horses (barn_name, current_owner_contact_id) values ($1,$2) returning id`,
    [barnName, ownerContact ?? null]);
  await h.q(`select set_config('app.current_org',$1,false)`, [orgA]); // restore default GUC
  return row.id;
}

/** The contact auto-created for a profile by the auth↔contact trigger. */
async function contactOf(uid: string): Promise<string> {
  const [row] = await h.q<{ contact_id: string }>(
    `select contact_id from profiles where user_id=$1`, [uid]);
  return row.contact_id;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Rival Stables','rival') returning id`))[0].id;

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
  aOwnerUser = await h.createAuthUser({ role: 'USER', org: orgA });
  aEngOwnerUser = await h.createAuthUser({ role: 'USER', org: orgA });
  aStranger = await h.createAuthUser({ role: 'USER', org: orgA });

  aOwnerContact = await contactOf(aOwnerUser);
  const aEngOwnerContact = await contactOf(aEngOwnerUser);

  // The trigger-created contacts default org_id to the GUC (org A) — good. But be
  // explicit so ownership + boundary line up regardless of seeding order.
  await h.asSuperuser();
  await h.q(`update contacts set org_id=$1 where id=$2`, [orgA, aOwnerContact]);
  await h.q(`update contacts set org_id=$1 where id=$2`, [orgA, aEngOwnerContact]);

  // org A horses.
  aHorseOwned = await seedHorse(orgA, 'Comet', aOwnerContact);         // owner-of-record path
  aHorseEng   = await seedHorse(orgA, 'Blaze');                        // engagement-owned path

  // Give aEngOwnerUser a client + an engagement referencing aHorseEng, so
  // caller_owns_horse resolves through the OWNED ENGAGEMENT branch.
  await h.asSuperuser();
  const [aEngClient] = await h.q<{ id: string }>(
    `insert into clients (contact_id) values ($1) returning id`, [aEngOwnerContact]);
  await h.q(
    `insert into engagements (client_id, service_type, primary_horse_id)
       values ($1,'HORSE_FINDER',$2)`, [aEngClient.id, aHorseEng]);

  // org B: a contact + a horse it owns (the cross-org leakage probe).
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org',$1,false)`, [orgB]);
  const [bC] = await h.q<{ id: string }>(
    `insert into contacts (full_name, email) values ('B Owner','b-owner@rival.test') returning id`);
  bContact = bC.id;
  await h.q(`select set_config('app.current_org',$1,false)`, [orgA]);
  bHorse = await seedHorse(orgB, 'RivalHorse', bContact);

  // Seed horse_parties + horse_health_events in each org as that org's ADMIN,
  // via the REAL RLS path (not superuser), so boundary + gate are exercised.
  await h.asUser(aAdmin);
  await h.q(
    `insert into horse_parties (horse_id, contact_id, role, share_pct, effective_from)
       values ($1,$2,'owner',100,'2026-01-01')`, [aHorseOwned, aOwnerContact]);
  await h.q(
    `insert into horse_health_events (horse_id, event_type, occurred_at, next_due, notes)
       values ($1,'vaccination', now(), '2027-01-01','EWT/WNV')`, [aHorseOwned]);
  await h.q(
    `insert into horse_health_events (horse_id, event_type, notes)
       values ($1,'farrier','trim + shoes')`, [aHorseEng]);

  // org B ADMIN seeds a party on its own horse. This MUST fail on the module gate
  // (org B lacks mod.horserecords) — asserted below; seed it as SUPERUSER instead
  // so the cross-org-leakage probe has a real org-B row to (not) leak.
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org',$1,false)`, [orgB]);
  await h.q(
    `insert into horse_parties (org_id, horse_id, contact_id, role, share_pct)
       values ($1,$2,$3,'owner',100)`, [orgB, bHorse, bContact]);
  await h.q(`select set_config('app.current_org',$1,false)`, [orgA]);
});

afterAll(async () => { await h?.close(); });

describe('module gate — a records-OFF org (org B) sees/writes nothing', () => {
  it('org B ADMIN sees ZERO horse_parties (module gate ANDs to false)', async () => {
    await h.asUser(bAdmin);
    const rows = await h.q(`select id from horse_parties`);
    expect(rows).toHaveLength(0);
  });

  it('org B ADMIN sees ZERO horse_health_events', async () => {
    await h.asUser(bAdmin);
    const rows = await h.q(`select id from horse_health_events`);
    expect(rows).toHaveLength(0);
  });

  it('org B ADMIN cannot INSERT a horse_party (module gate WITH CHECK denies)', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`insert into horse_parties (horse_id, contact_id, role) values ($1,$2,'owner')`,
        [bHorse, bContact]),
    ).rejects.toThrow();
  });

  it('org B ADMIN cannot INSERT a horse_health_event either', async () => {
    await h.asUser(bAdmin);
    await expect(
      h.q(`insert into horse_health_events (horse_id, event_type) values ($1,'vet')`, [bHorse]),
    ).rejects.toThrow();
  });

  it('has_module(mod.horserecords) is ON for org A, OFF for org B', async () => {
    await h.asUser(aAdmin);
    const [a] = await h.q<{ ok: boolean }>(`select has_module('mod.horserecords') as ok`);
    expect(a.ok).toBe(true);
    await h.asUser(bAdmin);
    const [b] = await h.q<{ ok: boolean }>(`select has_module('mod.horserecords') as ok`);
    expect(b.ok).toBe(false);
  });
});

describe('real-path insert — org A ADMIN, right table/columns, reads back', () => {
  it('org A ADMIN reads back the seeded party with its columns', async () => {
    await h.asUser(aAdmin);
    const [row] = await h.q<{ role: string; share_pct: string; org_id: string; horse_id: string }>(
      `select role, share_pct, org_id, horse_id from horse_parties where horse_id=$1`, [aHorseOwned]);
    expect(row.role).toBe('owner');
    expect(Number(row.share_pct)).toBe(100);
    expect(row.org_id).toBe(orgA);     // seam 1: org_id defaulted to caller's tenant
    expect(row.horse_id).toBe(aHorseOwned);
  });

  it('org A ADMIN reads back a seeded health event with next_due', async () => {
    await h.asUser(aAdmin);
    const [row] = await h.q<{ event_type: string; next_due: string; org_id: string }>(
      `select event_type, next_due, org_id from horse_health_events where horse_id=$1 and event_type='vaccination'`,
      [aHorseOwned]);
    expect(row.event_type).toBe('vaccination');
    expect(row.next_due).toBeTruthy();
    expect(row.org_id).toBe(orgA);
  });

  it('org_id defaults to the caller\'s tenant even when omitted from the INSERT', async () => {
    await h.asUser(aAdmin);
    await h.q(
      `insert into horse_parties (horse_id, contact_id, role) values ($1,$2,'trainer')`,
      [aHorseEng, aOwnerContact]);
    const [row] = await h.q<{ org_id: string }>(
      `select org_id from horse_parties where horse_id=$1 and role='trainer'`, [aHorseEng]);
    expect(row.org_id).toBe(orgA);
  });
});

describe('owner-contact client reads own horse_parties + health', () => {
  it('the owner-of-record contact reads its own horse_parties row', async () => {
    await h.asUser(aOwnerUser);
    const rows = await h.q<{ contact_id: string; horse_id: string }>(
      `select contact_id, horse_id from horse_parties`);
    // sees the party where it is the contact AND/OR owns the horse; all rows readable
    // to it must belong to a horse it owns or a party it is on.
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.horse_id === aHorseOwned)).toBe(true);
  });

  it('the owner-of-record contact reads its own horse_health_events', async () => {
    await h.asUser(aOwnerUser);
    const rows = await h.q<{ horse_id: string; event_type: string }>(
      `select horse_id, event_type from horse_health_events`);
    expect(rows.some((r) => r.horse_id === aHorseOwned && r.event_type === 'vaccination')).toBe(true);
  });

  it('a stranger client (owns nothing) sees NO parties and NO health events', async () => {
    await h.asUser(aStranger);
    expect(await h.q(`select id from horse_parties`)).toHaveLength(0);
    expect(await h.q(`select id from horse_health_events`)).toHaveLength(0);
  });
});

describe('caller_owns_horse() — resolves via ownership OR owned engagement', () => {
  it('owner-of-record resolves true for their horse, false for another', async () => {
    await h.asUser(aOwnerUser);
    const [owned] = await h.q<{ ok: boolean }>(`select caller_owns_horse($1) as ok`, [aHorseOwned]);
    const [other] = await h.q<{ ok: boolean }>(`select caller_owns_horse($1) as ok`, [aHorseEng]);
    expect(owned.ok).toBe(true);
    expect(other.ok).toBe(false);
  });

  it('an ENGAGEMENT owner resolves true for the engagement\'s horse', async () => {
    await h.asUser(aEngOwnerUser);
    const [viaEng] = await h.q<{ ok: boolean }>(`select caller_owns_horse($1) as ok`, [aHorseEng]);
    expect(viaEng.ok).toBe(true);
    // and the engagement owner can read that horse's health events (farrier).
    const rows = await h.q<{ horse_id: string; event_type: string }>(
      `select horse_id, event_type from horse_health_events`);
    expect(rows.some((r) => r.horse_id === aHorseEng && r.event_type === 'farrier')).toBe(true);
  });

  it('a stranger resolves false for every horse', async () => {
    await h.asUser(aStranger);
    const [a] = await h.q<{ ok: boolean }>(`select caller_owns_horse($1) as ok`, [aHorseOwned]);
    const [b] = await h.q<{ ok: boolean }>(`select caller_owns_horse($1) as ok`, [aHorseEng]);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
  });
});

describe('horse_parties is NEVER hard-deletable (REVOKE DELETE)', () => {
  it('an ADMIN hard DELETE is rejected (permission denied)', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`delete from horse_parties where horse_id=$1`, [aHorseOwned]),
    ).rejects.toThrow();
  });

  it('soft-delete (deleted_at) is the only removal, and hides the row from clients', async () => {
    await h.asUser(aAdmin);
    // seed a throwaway party to soft-delete
    await h.q(
      `insert into horse_parties (horse_id, contact_id, role) values ($1,$2,'caretaker')`,
      [aHorseOwned, aOwnerContact]);
    await h.q(
      `update horse_parties set deleted_at=now() where horse_id=$1 and role='caretaker'`, [aHorseOwned]);
    // the owner client no longer sees the soft-deleted caretaker row
    await h.asUser(aOwnerUser);
    const rows = await h.q<{ role: string }>(`select role from horse_parties where horse_id=$1`, [aHorseOwned]);
    expect(rows.some((r) => r.role === 'caretaker')).toBe(false);
  });
});

describe('payers resolve only within current_org() — no cross-org leakage', () => {
  it('org A staff never see org B\'s horse_parties (boundary ANDs across tenants)', async () => {
    await h.asUser(aAdmin);
    const rows = await h.q<{ org_id: string }>(`select org_id from horse_parties`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.org_id === orgA)).toBe(true);
    expect(rows.some((r) => r.org_id === orgB)).toBe(false);
  });

  it('org A staff cannot resolve org B\'s party contact as a payer (cross-org contact hidden)', async () => {
    await h.asUser(aAdmin);
    // The org-B party row exists (seeded as superuser) but is invisible to org A,
    // so org A can never attribute cost to org B's contact.
    const rows = await h.q<{ id: string }>(
      `select id from horse_parties where contact_id=$1`, [bContact]);
    expect(rows).toHaveLength(0);
  });

  it('org A ADMIN cannot INSERT a party stamped with org B (WITH CHECK denies)', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into horse_parties (org_id, horse_id, contact_id, role) values ($1,$2,$3,'owner')`,
        [orgB, aHorseOwned, aOwnerContact]),
    ).rejects.toThrow();
  });
});
