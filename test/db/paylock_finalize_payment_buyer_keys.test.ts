/**
 * TASK PAYLOCK — the provisioned buyer who could never pay (server half).
 *
 * finalize_purchase_payment is the ONLY generator of the Zelle matching keys
 * (unique_amount + payment_reference). It resolved the purchase with
 *     WHERE id = p_purchase_id AND buyer_user_id = auth.uid()
 * while `_provision_purchase_for_offerings` writes buyer_contact_id and never
 * buyer_user_id (20260802020000_u3_payment_notifications.sql:174-176). RLS let the
 * provisioned client SEE the order (purchases_member_own_select keys on the contact);
 * the RPC's own lookup missed it and raised 'purchase not found'. No memo could ever
 * be generated, so inbound Zelle matching — which keys on unique_amount then
 * payment_reference — had nothing to match.
 *
 * The default harness loads the committed schema snapshot, which carries the OLD
 * function body verbatim (schema_snapshot.sql:8437). So this file exercises the bug
 * FIRST, on the pre-fix definition, then applies the migration file itself and
 * exercises the same calls again. A typecheck proves nothing about a plpgsql body;
 * this proves the migration parses, applies, replays, and changes exactly the
 * behavior it claims to.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from './harness';

const MIGRATION = '20260813T1200_paylock_finalize_payment_keys_on_buyer_contact.sql';

let h: TestDb;
let org: string;

/** The provisioned client: an account whose profile points at a contact. */
let provisionedUid: string;
let provisionedContact: string;
let provisionedPurchase: string;

/** A self-serve buyer: buyer_user_id set, buyer_contact_id NULL (the shape the
 *  original lookup was written for — it must keep working). */
let selfServeUid: string;
let selfServePurchase: string;

/** An unrelated account holder: must never reach either purchase. */
let strangerUid: string;

type FinalizeRow = { unique_amount: string | number; payment_reference: string };

async function finalize(purchaseId: string) {
  return h.q<FinalizeRow>(
    `select * from finalize_purchase_payment($1, 'zelle')`, [purchaseId]);
}

async function purchaseRow(id: string) {
  await h.asSuperuser();
  return (await h.q<{
    status: string; payment_status: string; payment_reference: string | null;
    unique_amount: string | null; amount: string; amount_paid: string;
    buyer_user_id: string | null; buyer_contact_id: string | null;
  }>(`select status, payment_status, payment_reference, unique_amount, amount,
             amount_paid, buyer_user_id, buyer_contact_id
        from purchases where id = $1`, [id]))[0];
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  org = (await h.q<{ id: string }>(
    `select id from organizations order by created_at limit 1`))[0].id;

  /* The snapshot is schema-only outside a small reviewed allowlist, and
     status_events_vocab is not on it — but every purchases INSERT/UPDATE fires
     trg_status_purchases, which FKs (entity_type, status) into that vocabulary.
     Seed the four codes order_status_code can emit (snapshot line 12206) so a
     purchase can exist and change state at all. */
  await h.db.exec(`
    insert into status_events_vocab (entity_type, code, display_name)
    select 'order', c, c from unnest(array['pending','submitted','paid','void']) c
    on conflict do nothing;`);

  // A brand short name so the generated reference is the branded form, not the
  // 'PUR' fallback — this is the memo the client types into their bank app.
  await h.q(
    `insert into config_values (org_id, namespace, key, value_text)
       values ($1, 'BRAND', 'SHORT_NAME', 'FHE')
     on conflict do nothing`, [org]);

  /* ── The provisioned client, in the REAL order the flow creates them:
     staff provisioning writes the CONTACT first (the person has no login yet),
     and the account is born later when they redeem the invitation. The link
     between the two is not hand-made here — profiles_link_contact_trg fires on
     the profile INSERT and ensure_contact_for_profile matches an existing
     same-org contact BY EMAIL (schema_snapshot.sql:7684-7694). That is what makes
     current_contact_id() equal buyer_contact_id in production, and the assertion
     in the first test below is the proof, not an assumption. */
  provisionedContact = (await h.q<{ id: string }>(
    `insert into contacts (org_id, first_name, last_name, email)
       values ($1,'Provisioned','Buyer','provisioned@paylock.test') returning id`, [org]))[0].id;
  provisionedUid = await h.createAuthUser({ email: 'provisioned@paylock.test', org });

  // The purchase exactly as _provision_purchase_for_offerings creates it:
  // buyer_contact_id only, ALREADY at awaiting_payment, no matching keys.
  provisionedPurchase = (await h.q<{ id: string }>(
    `insert into purchases (org_id, buyer_contact_id, status, amount, amount_paid,
                            payment_method, payment_status)
       values ($1, $2, 'awaiting_payment', 1000.00, 0, 'zelle', 'unpaid')
     returning id`, [org, provisionedContact]))[0].id;
  await h.q(
    `insert into purchase_items (org_id, purchase_id, label, price_amount, quantity) values
       ($1,$2,'Single Lesson',150.00,1),
       ($1,$2,'Single Class',90.00,1),
       ($1,$2,'Training 1x Weekly',360.00,1),
       ($1,$2,'Exercise 1x Weekly',200.00,1),
       ($1,$2,'Full Body Clip',200.00,1)`, [org, provisionedPurchase]);

  // ── The self-serve buyer: the shape the old lookup handled.
  selfServeUid = await h.createAuthUser({ email: 'selfserve@paylock.test', org });
  selfServePurchase = (await h.q<{ id: string }>(
    `insert into purchases (org_id, buyer_user_id, status, amount, amount_paid, payment_status)
       values ($1, $2, 'draft', 0, 0, 'unpaid') returning id`, [org, selfServeUid]))[0].id;
  await h.q(
    `insert into purchase_items (org_id, purchase_id, label, price_amount, quantity)
       values ($1,$2,'8-Lesson Punch Card',800.00,1)`, [org, selfServePurchase]);

  strangerUid = await h.createAuthUser({ email: 'stranger@paylock.test', org });
});

afterAll(async () => { await h?.close(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('BEFORE the migration — the bug, reproduced on the snapshot body', () => {
  it('the activating account auto-links to the contact provisioning wrote', async () => {
    await h.asSuperuser();
    const [{ contact_id }] = await h.q<{ contact_id: string | null }>(
      `select contact_id from profiles where user_id = $1`, [provisionedUid]);
    // nothing in this test set it — the email match did
    expect(contact_id).toBe(provisionedContact);
    // …and it is the key the purchase carries, while buyer_user_id is empty
    const row = await purchaseRow(provisionedPurchase);
    expect(row.buyer_contact_id).toBe(provisionedContact);
    expect(row.buyer_user_id).toBeNull();
  });

  it('the shipped function keys on buyer_user_id alone', async () => {
    await h.asSuperuser();
    const [{ src }] = await h.q<{ src: string }>(
      `select pg_get_functiondef('public.finalize_purchase_payment(uuid,text)'::regprocedure) as src`);
    expect(src).toContain('buyer_user_id = auth.uid()');
    expect(src).not.toContain('current_contact_id()');
  });

  it('RLS shows the provisioned buyer their order (so this is not a visibility problem)', async () => {
    await h.asUser(provisionedUid);
    const rows = await h.q(`select id from purchases where id = $1`, [provisionedPurchase]);
    expect(rows).toHaveLength(1);
  });

  it('…but the RPC raises "purchase not found" for that same buyer', async () => {
    await h.asUser(provisionedUid);
    await expect(finalize(provisionedPurchase)).rejects.toThrow(/purchase not found/i);
  });

  it('and the order is left with no memo and no match key', async () => {
    const row = await purchaseRow(provisionedPurchase);
    expect(row.payment_reference).toBeNull();
    expect(row.unique_amount).toBeNull();
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
      `select pg_get_functiondef('public.finalize_purchase_payment(uuid,text)'::regprocedure) as src`);
    expect(src).toContain('buyer_contact_id = v_contact');
    expect(src).toContain('current_contact_id()');
  });

  it('keeps the function SECURITY DEFINER and off anon', async () => {
    await h.asSuperuser();
    const [{ secdef }] = await h.q<{ secdef: boolean }>(
      `select prosecdef as secdef from pg_proc
        where oid = 'public.finalize_purchase_payment(uuid,text)'::regprocedure`);
    expect(secdef).toBe(true);
    const [{ ok }] = await h.q<{ ok: boolean }>(
      `select has_function_privilege('anon','public.finalize_purchase_payment(uuid,text)','execute') as ok`);
    expect(ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AFTER the migration — the provisioned buyer can pay', () => {
  it('returns a real balance and a branded memo', async () => {
    await h.asUser(provisionedUid);
    const rows = await finalize(provisionedPurchase);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].unique_amount)).toBe(1000);
    expect(rows[0].payment_reference).toMatch(/^FHE-[0-9A-F]{6}$/);
  });

  it('writes the matching keys onto the purchase (what Zelle reconciliation reads)', async () => {
    const row = await purchaseRow(provisionedPurchase);
    expect(row.payment_reference).toMatch(/^FHE-[0-9A-F]{6}$/);
    expect(Number(row.unique_amount)).toBe(1000);
    expect(row.status).toBe('awaiting_payment');
    expect(row.payment_status).toBe('pending');
    // recomputed server-side from the five items, not trusted from the client
    expect(Number(row.amount)).toBe(1000);
  });

  it('backfills buyer_user_id, leaving buyer_contact_id intact (Stage 2 rule)', async () => {
    const row = await purchaseRow(provisionedPurchase);
    expect(row.buyer_user_id).toBe(provisionedUid);
    expect(row.buyer_contact_id).toBe(provisionedContact);
  });

  it('is idempotent — a second call returns the SAME memo (write-once reference)', async () => {
    const before = await purchaseRow(provisionedPurchase);
    await h.asUser(provisionedUid);
    const again = await finalize(provisionedPurchase);
    expect(again[0].payment_reference).toBe(before.payment_reference);
    const after = await purchaseRow(provisionedPurchase);
    expect(after.payment_reference).toBe(before.payment_reference);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AFTER the migration — nothing else moved', () => {
  it('the self-serve buyer (buyer_user_id, no contact) still works', async () => {
    await h.asUser(selfServeUid);
    const rows = await finalize(selfServePurchase);
    expect(Number(rows[0].unique_amount)).toBe(800);
    expect(rows[0].payment_reference).toMatch(/^FHE-[0-9A-F]{6}$/);
    const row = await purchaseRow(selfServePurchase);
    expect(row.status).toBe('awaiting_payment');
    // the caller matched by USER, so the contact key is not invented for them
    expect(row.buyer_contact_id).toBeNull();
  });

  it('a stranger with an account still cannot touch either purchase', async () => {
    await h.asUser(strangerUid);
    await expect(finalize(provisionedPurchase)).rejects.toThrow(/purchase not found/i);
    await expect(finalize(selfServePurchase)).rejects.toThrow(/purchase not found/i);
  });

  it('a caller with NO contact does not match a contactless purchase (NULL = NULL is not TRUE)', async () => {
    /* The dangerous shape of an `OR buyer_contact_id = current_contact_id()` arm:
       if BOTH sides are NULL and the comparison were treated as equality, any
       contactless caller would match every contactless purchase. In SQL the
       comparison yields NULL, which a WHERE clause does not accept — this pins
       that, because the arm is the whole fix.
       Note profiles_link_contact_trg gives every profile a contact, so a caller
       with none is one with no profile row at all. */
    await h.asSuperuser();
    const noProfileUid = await h.createAuthUser({ email: 'noprofile@paylock.test', profile: false });
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from profiles where user_id = $1`, [noProfileUid]);
    expect(n).toBe(0);

    // both sides NULL: the caller has no contact, the purchase has no contact
    const scRow = await purchaseRow(selfServePurchase);
    expect(scRow.buyer_contact_id).toBeNull();

    await h.asUser(noProfileUid);
    const [{ c }] = await h.q<{ c: string | null }>(`select current_contact_id() as c`);
    expect(c).toBeNull();
    await expect(finalize(selfServePurchase)).rejects.toThrow(/purchase not found/i);
  });

  it('an anonymous caller is still refused', async () => {
    await h.asAnon();
    await expect(finalize(provisionedPurchase)).rejects.toThrow();
  });

  it('a soft-deleted purchase is still invisible to its own buyer', async () => {
    await h.asSuperuser();
    const gone = (await h.q<{ id: string }>(
      `insert into purchases (org_id, buyer_contact_id, status, amount, deleted_at)
         values ($1, $2, 'awaiting_payment', 50.00, now()) returning id`,
      [org, provisionedContact]))[0].id;
    await h.asUser(provisionedUid);
    await expect(finalize(gone)).rejects.toThrow(/purchase not found/i);
  });

  it('the partial-balance behavior of 20260725006000 is preserved', async () => {
    await h.asSuperuser();
    const partial = (await h.q<{ id: string }>(
      `insert into purchases (org_id, buyer_contact_id, status, amount, amount_paid, payment_status)
         values ($1, $2, 'awaiting_payment', 0, 300.00, 'pending') returning id`,
      [org, provisionedContact]))[0].id;
    await h.q(
      `insert into purchase_items (org_id, purchase_id, label, price_amount, quantity)
         values ($1,$2,'Monthly Training',500.00,1)`, [org, partial]);

    await h.asUser(provisionedUid);
    const rows = await finalize(partial);
    // pays the BALANCE (500 - 300), while `amount` stays the full order total
    expect(Number(rows[0].unique_amount)).toBe(200);
    const row = await purchaseRow(partial);
    expect(Number(row.amount)).toBe(500);
    expect(Number(row.amount_paid)).toBe(300);
    expect(Number(row.unique_amount)).toBe(200);
  });
});
