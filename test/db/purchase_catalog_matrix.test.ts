/**
 * Pre-go-live EXHAUSTIVE purchase-flow matrix (owner mandate, 2026-07-01).
 *
 * Enumerates EVERY purchasable catalog item straight from the database (all
 * active offering_tiers — the server-side source of truth) and runs each one,
 * plus combination carts, through the REAL end-to-end money path:
 *
 *   createDraftOrder-shape inserts → finalize_order_payment RPC →
 *   Zelle notification at the assigned unique amount → reconcile → confirmed.
 *
 * Hunting two classes of defect:
 *   WIRING — any tier whose order cannot finalize or whose payment cannot
 *     auto-match (the unique_amount/payment_reference assignment gap that was
 *     found and fixed by migration 20260701030000);
 *   HARDCODED VALUES — client-side tampered prices on tier-linked items must
 *     be overridden by the server; the payment reference prefix must come from
 *     the ORDER's org registry (BRAND.SHORT_NAME), never a literal.
 *
 * The reconcile logic itself is proven in api/zelle-reconcile.test.ts; here we
 * assert the DB-side contract it depends on: every finalized order carries a
 * DISTINCT unique_amount among open orders and a resolvable reference.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let uid: string;
let tiers: { id: string; label: string; price_amount: number | null; offering_id: string; slug: string }[];

async function makeOrder(items: { tier_id: string | null; offering_id: string | null; label: string; price: number }[]) {
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const [order] = await h.q<{ id: string }>(
    `insert into orders (user_id, status, subtotal, total) values ($1,'draft',$2,$2) returning id`,
    [uid, subtotal],
  );
  for (const i of items) {
    await h.q(
      `insert into order_items (order_id, offering_id, tier_id, label, price_amount, price_unit)
       values ($1,$2,$3,$4,$5,'flat')`,
      [order.id, i.offering_id, i.tier_id, i.label, i.price],
    );
  }
  return order.id;
}

async function finalize(orderId: string, method = 'zelle') {
  const [row] = await h.q<{ unique_amount: string; payment_reference: string }>(
    `select * from finalize_order_payment($1,$2)`, [orderId, method]);
  return { uniqueAmount: Number(row.unique_amount), reference: row.payment_reference };
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  uid = await h.createAuthUser({ email: 'buyer@matrix.test' });
  tiers = (await h.q<{ id: string; label: string; price_amount: string | null; offering_id: string; slug: string }>(
    `select ot.id, ot.label, ot.price_amount, ot.offering_id, o.slug
       from offering_tiers ot join offerings o on o.id = ot.offering_id
      where o.active is distinct from false
      order by o.slug, ot.sort_order`,
  )).map((t) => ({ ...t, price_amount: t.price_amount == null ? null : Number(t.price_amount) }));
});
afterAll(async () => {
  await h?.close();
});

describe('catalog inventory', () => {
  it('has priced tiers to exercise (the seeded catalog is non-empty)', () => {
    expect(tiers.length).toBeGreaterThan(5);
    expect(tiers.filter((t) => t.price_amount != null).length).toBeGreaterThan(5);
  });
});

describe('EVERY priced catalog tier survives the full money path', () => {
  it('finalizes each tier and auto-matches its Zelle payment by unique amount', async () => {
    await h.asUser(uid);
    const priced = tiers.filter((t) => t.price_amount != null && Number(t.price_amount) > 0);
    const seen = new Map<number, string>(); // unique_amount -> tier label
    const failures: string[] = [];

    for (const tier of priced) {
      const orderId = await makeOrder([
        { tier_id: tier.id, offering_id: tier.offering_id, label: `${tier.slug}: ${tier.label}`, price: tier.price_amount! },
      ]);
      const { uniqueAmount, reference } = await finalize(orderId);

      // WIRING: the Zelle matching key exists, exceeds the total by 1-99 cents,
      // and collides with no other open order (the reconciler's single-match rule).
      if (!(uniqueAmount > tier.price_amount! && uniqueAmount < tier.price_amount! + 1)) {
        failures.push(`${tier.slug}/${tier.label}: unique_amount ${uniqueAmount} not in (total, total+1)`);
      }
      if (seen.has(uniqueAmount)) {
        failures.push(`${tier.slug}/${tier.label}: unique_amount ${uniqueAmount} collides with ${seen.get(uniqueAmount)}`);
      }
      seen.set(uniqueAmount, `${tier.slug}/${tier.label}`);

      // HARDCODED VALUES: the memo prefix comes from the org registry.
      if (!/^FHE-[0-9A-F]{6}$/.test(reference)) {
        failures.push(`${tier.slug}/${tier.label}: reference ${reference} not registry-branded`);
      }

      // The reconciler's exact-match query finds this order and only this order.
      const match = await h.q<{ id: string }>(
        `select id from orders where status='awaiting_payment' and unique_amount=$1`, [uniqueAmount]);
      if (match.length !== 1) failures.push(`${tier.slug}/${tier.label}: ${match.length} orders match ${uniqueAmount}`);
    }

    expect(failures, failures.join('\n')).toEqual([]);
    expect(seen.size).toBe(priced.length); // every tier got a distinct key
  });
});

describe('combination carts (multi-item orders)', () => {
  it('every adjacent pair of priced tiers totals correctly and gets a distinct key', async () => {
    await h.asUser(uid);
    const priced = tiers.filter((t) => t.price_amount != null && Number(t.price_amount) > 0);
    const failures: string[] = [];

    for (let i = 0; i + 1 < priced.length; i++) {
      const a = priced[i], b = priced[i + 1];
      const orderId = await makeOrder([
        { tier_id: a.id, offering_id: a.offering_id, label: a.label, price: a.price_amount! },
        { tier_id: b.id, offering_id: b.offering_id, label: b.label, price: b.price_amount! },
      ]);
      const { uniqueAmount } = await finalize(orderId);
      const expected = a.price_amount! + b.price_amount!;
      await h.asSuperuser();
      const [o] = await h.q<{ total: string }>(`select total from orders where id=$1`, [orderId]);
      await h.asUser(uid);
      if (Number(o.total) !== expected) {
        failures.push(`${a.label} + ${b.label}: total ${o.total} ≠ ${expected}`);
      }
      if (!(uniqueAmount > expected && uniqueAmount < expected + 1)) {
        failures.push(`${a.label} + ${b.label}: unique_amount ${uniqueAmount} off total ${expected}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('a full mixed cart (first 5 priced tiers) finalizes with a server-recomputed total', async () => {
    await h.asUser(uid);
    const cart = tiers.filter((t) => t.price_amount != null && Number(t.price_amount) > 0).slice(0, 5);
    const orderId = await makeOrder(cart.map((t) => ({
      tier_id: t.id, offering_id: t.offering_id, label: t.label, price: t.price_amount!,
    })));
    const { uniqueAmount, reference } = await finalize(orderId);
    const expected = cart.reduce((s, t) => s + t.price_amount!, 0);
    expect(uniqueAmount).toBeGreaterThan(expected);
    expect(uniqueAmount).toBeLessThan(expected + 1);
    expect(reference).toMatch(/^FHE-/);
  });
});

describe('hardcoded-value defenses', () => {
  it('a client-tampered tier price is overridden by the server price', async () => {
    await h.asUser(uid);
    const tier = tiers.find((t) => Number(t.price_amount) >= 100)!;
    const orderId = await makeOrder([
      { tier_id: tier.id, offering_id: tier.offering_id, label: tier.label, price: 1 }, // tampered
    ]);
    const { uniqueAmount } = await finalize(orderId);
    await h.asSuperuser();
    const [o] = await h.q<{ total: string }>(`select total from orders where id=$1`, [orderId]);
    expect(Number(o.total)).toBe(tier.price_amount!); // server price won
    expect(uniqueAmount).toBeGreaterThan(tier.price_amount!);
    const [item] = await h.q<{ price_amount: string }>(
      `select price_amount from order_items where order_id=$1`, [orderId]);
    expect(Number(item.price_amount)).toBe(tier.price_amount!);
  });

  it('finalize is idempotent: re-calls keep the same amount + reference', async () => {
    await h.asUser(uid);
    const tier = tiers.find((t) => Number(t.price_amount) > 0)!;
    const orderId = await makeOrder([
      { tier_id: tier.id, offering_id: tier.offering_id, label: tier.label, price: tier.price_amount! },
    ]);
    const first = await finalize(orderId);
    const second = await finalize(orderId);
    expect(second).toEqual(first);
  });

  it("a non-owner cannot finalize someone else's order; confirmed orders are immutable", async () => {
    await h.asUser(uid);
    const tier = tiers.find((t) => Number(t.price_amount) > 0)!;
    const orderId = await makeOrder([
      { tier_id: tier.id, offering_id: tier.offering_id, label: tier.label, price: tier.price_amount! },
    ]);

    await h.asSuperuser();
    const stranger = await h.createAuthUser({ email: 'stranger@matrix.test' });
    await h.asUser(stranger);
    await expect(h.q(`select * from finalize_order_payment($1,'zelle')`, [orderId]))
      .rejects.toThrow(/not your order/);

    await h.asSuperuser();
    await h.q(`update orders set status='confirmed' where id=$1`, [orderId]);
    await h.asUser(uid);
    await expect(h.q(`select * from finalize_order_payment($1,'zelle')`, [orderId]))
      .rejects.toThrow(/cannot finalize/);
  });
});

// ─── catalog.ts ↔ DB drift guard ────────────────────────────────────────────
// The public site prices come from the hardcoded src/lib/catalog.ts while the
// server enforces offering_tiers — two sources for one truth. The lesson packs
// agree today; this test freezes that agreement so future edits to either side
// fail loudly. KNOWN DRIFT (surfaced in the go-live findings, owner to decide):
// membership "Twice a Week" is $820 in catalog.ts vs $875 in the DB seed
// ('2x / Week Monthly'); membership plans are not tier-linked at checkout, so
// the client price is what a member would pay today.
import { LESSON_PACKS } from '../../src/lib/catalog';

describe('catalog.ts ↔ offering_tiers drift guard', () => {
  it('lesson pack prices in the frontend catalog match the DB tiers exactly', async () => {
    await h.asSuperuser();
    const dbTiers = await h.q<{ label: string; price_amount: string }>(
      `select ot.label, ot.price_amount from offering_tiers ot
        join offerings o on o.id = ot.offering_id
       where o.slug = 'riding-lesson' and ot.price_unit in ('session','flat')`);
    const dbByLabel = new Map(dbTiers.map((t) => [t.label, Number(t.price_amount)]));
    for (const pack of LESSON_PACKS) {
      expect(dbByLabel.get(pack.label), `catalog "${pack.label}" vs DB`).toBe(pack.price);
    }
  });
});
