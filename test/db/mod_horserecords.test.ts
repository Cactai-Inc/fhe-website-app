/**
 * Horse Records & Health (U9, migration 20260630080000_mod_horserecords) —
 * module mod.horserecords.
 *
 * Real-path data tests (Wiring & Verification Contract §15.1(1)): every assertion
 * exercises the ACTUAL tables/predicate the app uses (horse_relationships —
 * the Stage 1i survivor — horse_health_events, caller_owns_horse) as the
 * CORRECT RLS role, and asserts rows land with the right columns and read back.
 *
 * Contract under test (Stage 1i):
 *  - horse_health_events keeps org_boundary + module_gate (records-OFF org B
 *    sees ZERO rows and cannot INSERT even as ADMIN).
 *  - horse_relationships is core intake infrastructure — NOT module-gated:
 *    org isolation only (each org's staff read/write ONLY their own rows;
 *    org_id is explicit and WITH CHECK pins it to current_org()).
 *  - a party contact reads its own horse_relationships row.
 *  - caller_owns_horse() resolves via owner-of-record OR an owned engagement.
 *  - horse_relationships rejects a hard DELETE (REVOKE DELETE); rows END
 *    (active=false, ended_at) and stay as history.
 *  - payers resolve only within current_org() — no cross-org contact leakage.
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
    `insert into horses (nickname, current_owner_contact_id) values ($1,$2) returning id`,
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

  // aEngOwnerUser used to get a client + an engagement on aHorseEng, so
  // caller_owns_horse would resolve through an OWNED ENGAGEMENT branch.
  // `engagements` is RETIRED (CLAUDE.md: "Tables/concepts: engagements, orders,
  // client_purchases, …") and caller_owns_horse no longer has that branch —
  // verified against the live function, whose body does not mention engagements
  // at all. The scaffolding is gone; aHorseEng survives as a horse NOBODY owns,
  // which is what the remaining assertions actually need it to be.
  await h.asSuperuser();
  await h.q(`insert into clients (contact_id) values ($1)`, [aEngOwnerContact]);

  // org B: a contact + a horse it owns (the cross-org leakage probe).
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org',$1,false)`, [orgB]);
  const [bC] = await h.q<{ id: string }>(
    `insert into contacts (first_name, last_name, email) values ('B', 'Owner', 'b-owner@rival.test') returning id`);
  bContact = bC.id;
  await h.q(`select set_config('app.current_org',$1,false)`, [orgA]);
  bHorse = await seedHorse(orgB, 'RivalHorse', bContact);

  // Seed horse_relationships + horse_health_events in each org as that org's
  // ADMIN, via the REAL RLS path (not superuser), so the boundaries are exercised.
  await h.asUser(aAdmin);
  await h.q(
    `insert into horse_relationships (org_id, horse_id, party_contact_id, relationship, share_pct, term_start)
       values ($1,$2,$3,'OWNER',100,'2026-01-01')`, [orgA, aHorseOwned, aOwnerContact]);
  await h.q(
    `insert into horse_health_events (horse_id, event_type, occurred_at, next_due, notes)
       values ($1,'vaccination', now(), '2027-01-01','EWT/WNV')`, [aHorseOwned]);
  await h.q(
    `insert into horse_health_events (horse_id, event_type, notes)
       values ($1,'farrier','trim + shoes')`, [aHorseEng]);

  // org B's row for the cross-org-leakage probe (seeded as superuser; org B's
  // own staff-write ability is asserted below — the survivor is not module-gated).
  await h.asSuperuser();
  await h.q(`select set_config('app.current_org',$1,false)`, [orgB]);
  await h.q(
    `insert into horse_relationships (org_id, horse_id, party_contact_id, relationship, share_pct)
       values ($1,$2,$3,'OWNER',100)`, [orgB, bHorse, bContact]);
  await h.q(`select set_config('app.current_org',$1,false)`, [orgA]);
});

afterAll(async () => { await h?.close(); });

describe('module gate (health) + org isolation (relationships)', () => {
  it('org B ADMIN sees ONLY its own org\'s horse_relationships (org isolation, no module gate)', async () => {
    await h.asUser(bAdmin);
    const rows = await h.q<{ org_id: string }>(`select org_id from horse_relationships`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.org_id === orgB)).toBe(true);
  });

  it('org B ADMIN sees ZERO horse_health_events', async () => {
    await h.asUser(bAdmin);
    const rows = await h.q(`select id from horse_health_events`);
    expect(rows).toHaveLength(0);
  });

  it('org B ADMIN CAN write its own org\'s relationship rows (not module-gated), but only its own org', async () => {
    await h.asUser(bAdmin);
    await h.q(
      `insert into horse_relationships (org_id, horse_id, party_contact_id, relationship) values ($1,$2,$3,'CARETAKER')`,
      [orgB, bHorse, bContact]);
    await expect(
      h.q(`insert into horse_relationships (org_id, horse_id, party_contact_id, relationship) values ($1,$2,$3,'CARETAKER')`,
        [orgA, bHorse, bContact]),
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
  it('org A ADMIN reads back the seeded relationship with its columns', async () => {
    await h.asUser(aAdmin);
    const [row] = await h.q<{ relationship: string; share_pct: string; org_id: string; horse_id: string }>(
      `select relationship, share_pct, org_id, horse_id from horse_relationships where horse_id=$1`, [aHorseOwned]);
    expect(row.relationship).toBe('OWNER');
    expect(Number(row.share_pct)).toBe(100);
    expect(row.org_id).toBe(orgA);
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

  it('org_id is explicit on the survivor and WITH CHECK pins it to the caller\'s tenant', async () => {
    await h.asUser(aAdmin);
    await h.q(
      `insert into horse_relationships (org_id, horse_id, party_contact_id, relationship) values ($1,$2,$3,'TRAINER')`,
      [orgA, aHorseEng, aOwnerContact]);
    const [row] = await h.q<{ org_id: string }>(
      `select org_id from horse_relationships where horse_id=$1 and relationship='TRAINER'`, [aHorseEng]);
    expect(row.org_id).toBe(orgA);
  });
});

describe('owner-contact client reads own horse_relationships + health', () => {
  it('the owner-of-record contact reads its own horse_relationships row', async () => {
    await h.asUser(aOwnerUser);
    const rows = await h.q<{ party_contact_id: string; horse_id: string }>(
      `select party_contact_id, horse_id from horse_relationships`);
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
    expect(await h.q(`select id from horse_relationships`)).toHaveLength(0);
    expect(await h.q(`select id from horse_health_events`)).toHaveLength(0);
  });
});

// The "OR owned engagement" half of this contract is GONE with `engagements`
// (CLAUDE.md RETIRED list). The test that asserted it — "an ENGAGEMENT owner
// resolves true for the engagement's horse" — was deleted rather than rewritten:
// it covered a resolution branch that no longer exists in caller_owns_horse.
describe('caller_owns_horse() — resolves via ownership of record', () => {
  it('owner-of-record resolves true for their horse, false for another', async () => {
    await h.asUser(aOwnerUser);
    const [owned] = await h.q<{ ok: boolean }>(`select caller_owns_horse($1) as ok`, [aHorseOwned]);
    const [other] = await h.q<{ ok: boolean }>(`select caller_owns_horse($1) as ok`, [aHorseEng]);
    expect(owned.ok).toBe(true);
    expect(other.ok).toBe(false);
  });

  it('a stranger resolves false for every horse', async () => {
    await h.asUser(aStranger);
    const [a] = await h.q<{ ok: boolean }>(`select caller_owns_horse($1) as ok`, [aHorseOwned]);
    const [b] = await h.q<{ ok: boolean }>(`select caller_owns_horse($1) as ok`, [aHorseEng]);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
  });
});

describe('horse_relationships is NEVER hard-deletable (REVOKE DELETE)', () => {
  it('an ADMIN hard DELETE is rejected (permission denied)', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`delete from horse_relationships where horse_id=$1`, [aHorseOwned]),
    ).rejects.toThrow();
  });

  it('rows END (active=false, ended_at) and stay as readable history', async () => {
    await h.asUser(aAdmin);
    // seed a throwaway relationship to end
    await h.q(
      `insert into horse_relationships (org_id, horse_id, party_contact_id, relationship) values ($1,$2,$3,'CARETAKER')`,
      [orgA, aHorseOwned, aOwnerContact]);
    await h.q(
      `update horse_relationships set active=false, ended_at=now() where horse_id=$1 and relationship='CARETAKER'`,
      [aHorseOwned]);
    // the ended row is history: inactive, never deleted (app lists filter active)
    await h.asUser(aOwnerUser);
    const rows = await h.q<{ relationship: string; active: boolean }>(
      `select relationship, active from horse_relationships where horse_id=$1`, [aHorseOwned]);
    const caretaker = rows.filter((r) => r.relationship === 'CARETAKER');
    expect(caretaker.length).toBeGreaterThanOrEqual(1);
    expect(caretaker.every((r) => r.active === false)).toBe(true);
  });
});

describe('payers resolve only within current_org() — no cross-org leakage', () => {
  it('org A staff never see org B\'s horse_relationships (boundary ANDs across tenants)', async () => {
    await h.asUser(aAdmin);
    const rows = await h.q<{ org_id: string }>(`select org_id from horse_relationships`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.org_id === orgA)).toBe(true);
    expect(rows.some((r) => r.org_id === orgB)).toBe(false);
  });

  it('org A staff cannot resolve org B\'s party contact as a payer (cross-org contact hidden)', async () => {
    await h.asUser(aAdmin);
    // The org-B party row exists (seeded as superuser) but is invisible to org A,
    // so org A can never attribute cost to org B's contact.
    const rows = await h.q<{ id: string }>(
      `select id from horse_relationships where party_contact_id=$1`, [bContact]);
    expect(rows).toHaveLength(0);
  });

  it('org A ADMIN cannot INSERT a party stamped with org B (WITH CHECK denies)', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into horse_relationships (org_id, horse_id, party_contact_id, relationship) values ($1,$2,$3,'OWNER')`,
        [orgB, aHorseOwned, aOwnerContact]),
    ).rejects.toThrow();
  });
});
