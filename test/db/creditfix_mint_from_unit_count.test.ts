/**
 * TASK CREDITFIX — credits mint from what was bought, not from a regex on the name.
 *
 * `_provision_purchase_for_offerings` minted `lesson_credits` with
 * count = a regex on the offering's display name ('(\d+)-Lesson'), else 1 if
 * price_unit='session', else nothing — offerings.unit_count was never read
 * (TASK-FLOWTRACE-REPORT §8 / F8, §1 / F2). Since book_open_slot is
 * credit-gated, a 4-Class Pack buyer (and every recurring-SKU buyer) got ZERO
 * bookable credits for a paid purchase, and a horse-segment grooming SKU
 * (Full Body Clip, price_unit='session') minted a bookable LESSON credit it
 * had no business granting.
 *
 * THIRD KNOWN REVERT in this codebase's history: 20260726010000 already fixed
 * this (mint from unit_count, tag offering_id); 20260802020000 silently
 * reverted both by re-declaring the function from an older body; BOOKWRITE
 * (20260812T1600) re-declared it AGAIN and restored the offering_id/
 * purchase_id TAG but not the count formula — the regex rode through
 * untouched. This file proves the bug on the (still-broken-on-count) shipped
 * body, then applies 20260815T0500_creditfix_mint_from_unit_count.sql and
 * proves the exact mint table from the task brief, so a fourth revert fails
 * loudly here.
 *
 * Also guards my_horse_onboarding_state's twin-key purchase lookup
 * (buyer_contact_id OR buyer_user_id) — verified against prod's live
 * pg_get_functiondef to already carry the fix from 20260726010000; this file
 * does not re-apply it, only proves it holds, so if it ever regresses this
 * test (not just a report) catches it.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from './harness';

const MIGRATION = '20260815T0500_creditfix_mint_from_unit_count.sql';

let h: TestDb;
let org: string;

// The six-offering catalog slice this file exercises, mirroring the real
// prod shapes named in the FLOWTRACE mint table.
let offEightPack: string;   // RIDING_LESSON, rider, scheduled, unit_count 8 — name matches the OLD regex
let offFourClass: string;   // HORSEMANSHIP_TRAINING, rider, scheduled, unit_count 4 — name does NOT match the old regex, and service_type is NOT 'RIDING_LESSON'
let offSingle: string;      // RIDING_LESSON, rider, scheduled, unit_count 1, price_unit session
let offClip: string;        // HORSE_CLIPPING, horse, scheduled, unit_count 1, price_unit session — F2's offender
let offRecurRider: string;  // RIDING_LESSON, rider, recurring — declared out of scope
let offRecurHorse: string;  // HORSE_EXERCISE, horse, recurring — declared out of scope

const ALL_OFFERINGS = () => [
  offEightPack, offFourClass, offSingle, offClip, offRecurRider, offRecurHorse,
];

async function provision(contactId: string, clientId: string) {
  return h.q<{ _provision_purchase_for_offerings: string }>(
    `select _provision_purchase_for_offerings($1,$2,$3,$4::uuid[],true,'zelle','creditfix test',0) as _provision_purchase_for_offerings`,
    [org, contactId, clientId, ALL_OFFERINGS()],
  );
}

type CreditRow = {
  offering_id: string | null;
  package_key: string | null; credits_total: number; credits_remaining: number;
};
async function creditsFor(clientId: string) {
  await h.asSuperuser();
  // no purchase_id here: this runs both BEFORE and AFTER the migration, and
  // the column doesn't exist on the base schema pre-migration (added by this
  // migration defensively — see its own ADD COLUMN IF NOT EXISTS). The
  // purchase_id tag is asserted separately, only in the AFTER section.
  return h.q<CreditRow>(
    `select offering_id, package_key, credits_total, credits_remaining
       from lesson_credits where client_id = $1 order by package_key`, [clientId]);
}

async function creditsWithPurchaseFor(clientId: string) {
  await h.asSuperuser();
  return h.q<{ purchase_id: string | null }>(
    `select purchase_id from lesson_credits where client_id = $1`, [clientId]);
}

async function makeContactAndClient(email: string, label: string) {
  const contact = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name, email)
       values ($1,$2,'Creditfix',$3) returning id`, [org, label, email]))[0].id;
  const client = (await h.q<{ id: string }>(
    `insert into clients (org_id, contact_id) values ($1,$2) returning id`, [org, contact]))[0].id;
  return { contact, client };
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(
    `select id from organizations order by created_at limit 1`))[0].id;

  // purchases INSERT fires trg_status_purchases, which FKs into
  // status_events_vocab — same seed paylock's test needed for the same reason.
  await h.q(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'order', c, c from unnest(array['pending','submitted','paid','void']) c
    on conflict do nothing;`);

  const off = async (opts: {
    name: string; slug: string; segment: string; service_type: string;
    config_kind: string; price_unit: string; unit_count: number | null;
    weekly_frequency?: number | null; price: number;
  }) => (await h.q<{ id: string }>(
    `insert into offerings (org_id, segment, name, slug, active, service_type,
                            config_kind, price_unit, unit_count, weekly_frequency, price_amount)
       values ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10) returning id`,
    [org, opts.segment, opts.name, opts.slug, opts.service_type, opts.config_kind,
     opts.price_unit, opts.unit_count, opts.weekly_frequency ?? null, opts.price],
  ))[0].id;

  offEightPack = await off({
    name: '8-Lesson Punch Card', slug: 'creditfix-8-pack', segment: 'rider',
    service_type: 'RIDING_LESSON', config_kind: 'scheduled', price_unit: 'flat',
    unit_count: 8, price: 800,
  });
  offFourClass = await off({
    name: '4-Class Pack', slug: 'creditfix-4-class', segment: 'rider',
    service_type: 'HORSEMANSHIP_TRAINING', config_kind: 'scheduled', price_unit: 'flat',
    unit_count: 4, price: 320,
  });
  offSingle = await off({
    name: 'Single Lesson', slug: 'creditfix-single', segment: 'rider',
    service_type: 'RIDING_LESSON', config_kind: 'scheduled', price_unit: 'session',
    unit_count: 1, price: 150,
  });
  offClip = await off({
    name: 'Full Body Clip', slug: 'creditfix-clip', segment: 'horse',
    service_type: 'HORSE_CLIPPING', config_kind: 'scheduled', price_unit: 'session',
    unit_count: 1, price: 200,
  });
  offRecurRider = await off({
    name: '1x Weekly Lesson', slug: 'creditfix-weekly-rider', segment: 'rider',
    service_type: 'RIDING_LESSON', config_kind: 'recurring', price_unit: 'month',
    unit_count: null, weekly_frequency: 1, price: 200,
  });
  offRecurHorse = await off({
    name: 'Exercise 1x Weekly', slug: 'creditfix-weekly-horse', segment: 'horse',
    service_type: 'HORSE_EXERCISE', config_kind: 'recurring', price_unit: 'month',
    unit_count: null, weekly_frequency: 1, price: 200,
  });
});

afterAll(async () => { await h?.close(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('BEFORE the migration — the bug, reproduced on the shipped body', () => {
  it('the shipped function still keys the mint on a name regex', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select pg_get_functiondef('public._provision_purchase_for_offerings(uuid,uuid,uuid,uuid[],boolean,text,text,numeric)'::regprocedure) as src`);
    expect(src).toContain("'(\\d+)-Lesson'");
    expect(src).not.toContain('unit_count');
  });

  it('mints the exact wrong table from the FLOWTRACE report', async () => {
    await h.asSuperuser();
    const { contact, client } = await makeContactAndClient('before@creditfix.test', 'Before');
    await provision(contact, client);
    const rows = await creditsFor(client);

    const byKey = Object.fromEntries(rows.map((r) => [r.package_key, r]));
    // 8-Lesson Punch Card: regex coincidentally matches -> 8 (right answer, wrong reason)
    expect(byKey['8-Lesson Punch Card'].credits_total).toBe(8);
    // 4-Class Pack: no regex match, price_unit='flat' -> mints NOTHING
    expect(byKey['4-Class Pack']).toBeUndefined();
    // Single Lesson: price_unit='session' else-branch -> 1
    expect(byKey['Single Lesson'].credits_total).toBe(1);
    // Full Body Clip: a GROOMING sku, price_unit='session' -> wrongly mints a lesson credit (F2)
    expect(byKey['Full Body Clip'].credits_total).toBe(1);
    // both recurring/monthly SKUs mint nothing (price_unit='month', no name match)
    expect(byKey['1x Weekly Lesson']).toBeUndefined();
    expect(byKey['Exercise 1x Weekly']).toBeUndefined();

    // exactly 3 rows minted, none tagged with an offering — the pre-fix shape,
    // byte-for-byte what prod carries for its one real provisioned buyer today.
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r.offering_id).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the migration applies — and replays', () => {
  it('applies cleanly, twice (the journal is hand-replayed)', async () => {
    await h.asSuperuser();
    const sql = readFileSync(join(MIGRATIONS_DIR, MIGRATION), 'utf8');
    await h.db.exec(sql);
    await h.db.exec(sql);

    const [{ src }] = await h.q<{ src: string }>(
      `select pg_get_functiondef('public._provision_purchase_for_offerings(uuid,uuid,uuid,uuid[],boolean,text,text,numeric)'::regprocedure) as src`);
    // the regex is provably gone
    expect(src).not.toContain('regexp_match');
    expect(src).not.toContain("'(\\d+)-Lesson'");
    expect(src).not.toContain("v_off.price_unit = 'session'");
    // replaced by the unit_count formula, gated on config_kind + segment
    expect(src).toContain('o.unit_count');
    expect(src).toContain("o.config_kind = 'scheduled'");
    expect(src).toContain("o.segment <> 'horse'");
  });

  it('keeps the function SECURITY DEFINER', async () => {
    await h.asSuperuser();
    const [{ secdef }] = await h.q<{ secdef: boolean }>(
      `select prosecdef as secdef from pg_proc
        where oid = 'public._provision_purchase_for_offerings(uuid,uuid,uuid,uuid[],boolean,text,text,numeric)'::regprocedure`);
    expect(secdef).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AFTER the migration — the mint table the task brief specifies', () => {
  let client: string;
  let purchaseId: string;

  it('mints unit_count x quantity, gated on segment <> horse — not service_type', async () => {
    await h.asSuperuser();
    const made = await makeContactAndClient('after@creditfix.test', 'After');
    client = made.client;
    const rows = await provision(made.contact, client);
    purchaseId = rows[0]._provision_purchase_for_offerings;

    const credits = await creditsFor(client);
    const byKey = Object.fromEntries(credits.map((r) => [r.package_key, r]));

    expect(byKey['8-Lesson Punch Card'].credits_total).toBe(8);
    expect(byKey['8-Lesson Punch Card'].credits_remaining).toBe(8);
    expect(byKey['8-Lesson Punch Card'].offering_id).toBe(offEightPack);

    // the case that disproves service_type='RIDING_LESSON' as the gate: this
    // offering's service_type is HORSEMANSHIP_TRAINING, and it must still mint.
    expect(byKey['4-Class Pack'].credits_total).toBe(4);
    expect(byKey['4-Class Pack'].offering_id).toBe(offFourClass);

    expect(byKey['Single Lesson'].credits_total).toBe(1);
    expect(byKey['Single Lesson'].offering_id).toBe(offSingle);

    // the grooming SKU now mints nothing — no row at all, not a zero-count row
    expect(byKey['Full Body Clip']).toBeUndefined();

    // recurring SKUs mint nothing — still zero, now by declared scope
    // (TASK-BOOKLINK §B4 owns their entitlement), not by name-regex accident
    expect(byKey['1x Weekly Lesson']).toBeUndefined();
    expect(byKey['Exercise 1x Weekly']).toBeUndefined();

    expect(credits).toHaveLength(3);
  });

  it('tags every minted credit with the purchase that granted it', async () => {
    const credits = await creditsWithPurchaseFor(client);
    for (const r of credits) expect(r.purchase_id).toBe(purchaseId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('my_horse_onboarding_state — twin-key purchase lookup (regression guard)', () => {
  it('resolves a contact-keyed (provisioned, no buyer_user_id) horse purchase', async () => {
    await h.asSuperuser();
    const { contact } = await makeContactAndClient('horsegate@creditfix.test', 'Horsegate');
    const uid = await h.createAuthUser({ email: 'horsegate@creditfix.test', org });

    // a provisioned horse-care purchase exactly as _provision_purchase_for_offerings
    // writes it: buyer_contact_id only, buyer_user_id NULL.
    const purchase = (await h.q<{ id: string }>(
      `insert into purchases (org_id, buyer_contact_id, status, amount, amount_paid, payment_status)
         values ($1,$2,'paid',200,200,'paid') returning id`, [org, contact]))[0].id;
    await h.q(
      `insert into purchase_items (org_id, purchase_id, offering_id, label, price_amount, quantity)
         values ($1,$2,$3,'Full Body Clip',200,1)`, [org, purchase, offClip]);

    await h.asUser(uid);
    const [state] = await h.q<{ needs_horse: boolean }>(
      `select (my_horse_onboarding_state()->>'needs_horse')::boolean as needs_horse`);
    // resolves purely via buyer_contact_id = current_contact_id() — this caller
    // has no buyer_user_id row to match on, so a single-key regression would
    // flip this back to false.
    expect(state.needs_horse).toBe(true);
  });

  it('a caller with no horse purchase gets no gate', async () => {
    await h.asSuperuser();
    const { contact } = await makeContactAndClient('nohorse@creditfix.test', 'Nohorse');
    const uid = await h.createAuthUser({ email: 'nohorse@creditfix.test', org });
    void contact;

    await h.asUser(uid);
    const [state] = await h.q<{ needs_horse: boolean }>(
      `select (my_horse_onboarding_state()->>'needs_horse')::boolean as needs_horse`);
    expect(state.needs_horse).toBe(false);
  });
});
