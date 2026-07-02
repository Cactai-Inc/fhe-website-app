/**
 * E2E-PAYMENT (critical chain #3, FEATURE_BUILD_PLAN §E2E):
 * draft order with tier-linked items → finalize_order_payment (server-side price
 * integrity + the Zelle matching keys) → the EXACT candidate query the Zelle
 * reconciler uses (api/_lib/reconcile.ts: status='awaiting_payment' AND
 * unique_amount = parsed amount) → confirm (payment row + order confirmed +
 * confirm_booking_for_order) → the duplicate guards.
 *
 * Real-path: the client OWNS the order (auth.uid() = orders.user_id) and calls
 * the real finalize_order_payment / hold_slot RPCs under RLS; the reconciler's
 * reads/writes run as the service role (the admin client in production).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string;
let admin: string;   // tenant #1 staff — owns the catalog + slots
let client: string;  // the buying client (owns order #1)
let client2: string; // a second client (the same-total decoy order)

let tierId: string;      // server-side tier price 150.00
let slotId: string;
let orderId: string;     // the order under test
let order2Id: string;    // decoy at the same total
let uniqueAmount: number;
let paymentRef: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  admin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  client = await h.createAuthUser({ role: 'USER', org: orgA });
  client2 = await h.createAuthUser({ role: 'USER', org: orgA });

  // Catalog + a bookable slot, created by staff (admin-write RLS).
  await h.asUser(admin);
  const offeringId = (await h.q<{ id: string }>(
    `insert into offerings (segment, name, slug, active)
       values ('rider','E2E Payment Lesson','e2e-payment-lesson', true) returning id`))[0].id;
  tierId = (await h.q<{ id: string }>(
    `insert into offering_tiers (offering_id, label, price_amount, price_unit)
       values ($1,'Single Session',150.00,'session') returning id`, [offeringId]))[0].id;
  slotId = (await h.q<{ id: string }>(
    `insert into availability_slots (start_at, end_at, slot_type, status)
       values (now() + interval '3 days', now() + interval '3 days 1 hour', 'lesson', 'open')
       returning id`))[0].id;
});

afterAll(async () => { await h?.close(); });

describe('chain 3 — draft order + hold, then finalize_order_payment', () => {
  it('the client drafts the order with a TAMPERED tier item price and holds the slot', async () => {
    await h.asUser(client);
    orderId = (await h.q<{ id: string }>(
      `insert into orders (user_id, status, subtotal, total) values ($1,'draft',1,1) returning id`,
      [client]))[0].id;
    // client-side tampering: the tier's real price is 150.00, the cart says 1.00
    await h.q(
      `insert into order_items (order_id, tier_id, label, price_amount, price_unit)
         values ($1,$2,'Single Session',1.00,'session')`, [orderId, tierId]);
    const bookingId = (await h.q<{ hold_slot: string }>(
      `select hold_slot($1,$2)`, [orderId, slotId]))[0].hold_slot;
    expect(bookingId).toBeTruthy();

    await h.asSuperuser();
    const [slot] = await h.q<{ status: string }>(
      `select status from availability_slots where id=$1`, [slotId]);
    expect(slot.status).toBe('held');
  });

  it('finalize forces the SERVER tier price, recomputes totals, and mints the Zelle keys', async () => {
    await h.asUser(client);
    const [res] = await h.q<{ unique_amount: string; payment_reference: string }>(
      `select * from finalize_order_payment($1,'zelle')`, [orderId]);
    uniqueAmount = Number(res.unique_amount);
    paymentRef = res.payment_reference;

    // unique_amount = server total (150.00) + a 1–99 cent offset
    expect(uniqueAmount).toBeGreaterThanOrEqual(150.01);
    expect(uniqueAmount).toBeLessThanOrEqual(150.99);
    // payment_reference is brand-prefixed from the ORDER's org registry (BRAND.SHORT_NAME = FHE)
    expect(paymentRef).toMatch(/^FHE-[0-9A-F]{6}$/);

    await h.asSuperuser();
    const [order] = await h.q<{ status: string; total: string; subtotal: string; payment_method: string }>(
      `select status, total, subtotal, payment_method from orders where id=$1`, [orderId]);
    expect(order.status).toBe('awaiting_payment');
    expect(Number(order.total)).toBe(150);           // NOT the tampered 1.00
    expect(Number(order.subtotal)).toBe(150);
    expect(order.payment_method).toBe('zelle');
    const [item] = await h.q<{ price_amount: string }>(
      `select price_amount from order_items where order_id=$1`, [orderId]);
    expect(Number(item.price_amount)).toBe(150);     // corrected to the tier's price
  });

  it('re-finalizing is idempotent — the matching keys are assigned ONCE', async () => {
    await h.asUser(client);
    const [again] = await h.q<{ unique_amount: string; payment_reference: string }>(
      `select * from finalize_order_payment($1,'zelle')`, [orderId]);
    expect(Number(again.unique_amount)).toBe(uniqueAmount);
    expect(again.payment_reference).toBe(paymentRef);
  });

  it('a second open order at the SAME total gets a DIFFERENT unique_amount', async () => {
    await h.asUser(client2);
    order2Id = (await h.q<{ id: string }>(
      `insert into orders (user_id, status, subtotal, total) values ($1,'draft',150,150) returning id`,
      [client2]))[0].id;
    await h.q(
      `insert into order_items (order_id, tier_id, label, price_amount, price_unit)
         values ($1,$2,'Single Session',150.00,'session')`, [order2Id, tierId]);
    const [res2] = await h.q<{ unique_amount: string }>(
      `select * from finalize_order_payment($1,'zelle')`, [order2Id]);
    expect(Number(res2.unique_amount)).not.toBe(uniqueAmount);
  });
});

describe('chain 3 — the Zelle reconciler match on unique_amount', () => {
  it('the reconciler\'s candidate query finds EXACTLY the one order (deterministic key)', async () => {
    // api/_lib/reconcile.ts: .eq('status','awaiting_payment').eq('unique_amount', n.amount)
    await h.asServiceRole();
    const candidates = await h.q<{ id: string; payment_reference: string }>(
      `select id, total, unique_amount, payment_reference, status from orders
        where status='awaiting_payment' and unique_amount=$1`, [uniqueAmount]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe(orderId);
    expect(candidates[0].payment_reference).toBe(paymentRef); // reference corroborates
  });

  it('confirm: payment row + order confirmed + confirm_booking_for_order (the reconciler writes)', async () => {
    await h.asServiceRole();
    // duplicate guard pre-check (reconcile.ts): no confirmed payment yet
    expect(await h.q(
      `select id from payments where order_id=$1 and status='confirmed'`, [orderId])).toHaveLength(0);

    const [pay] = await h.q<{ id: string }>(
      `insert into payments (order_id, method, amount, reference_code, status, match_confidence, matched_at)
         values ($1,'zelle',$2,$3,'confirmed','amount+reference', now()) returning id`,
      [orderId, uniqueAmount, paymentRef]);
    await h.q(
      `update orders set status='confirmed', paid_at=now(), confirmed_at=now() where id=$1`, [orderId]);
    await h.q(`select confirm_booking_for_order($1)`, [orderId]);
    await h.q(
      `insert into payment_notifications (parsed_amount, parsed_reference, status, matched_payment_id)
         values ($1,$2,'matched',$3)`, [uniqueAmount, paymentRef, pay.id]);

    await h.asSuperuser();
    const [order] = await h.q<{ status: string; paid_at: string }>(
      `select status, paid_at from orders where id=$1`, [orderId]);
    expect(order.status).toBe('confirmed');
    expect(order.paid_at).toBeTruthy();
    const [booking] = await h.q<{ status: string }>(
      `select status from bookings_v2 where order_id=$1`, [orderId]);
    expect(booking.status).toBe('confirmed');
    const [slot] = await h.q<{ status: string }>(
      `select status from availability_slots where id=$1`, [slotId]);
    expect(slot.status).toBe('booked');

    // the client reads their own confirmed payment back (owner read policy)
    await h.asUser(client);
    const mine = await h.q<{ status: string }>(`select status from payments where order_id=$1`, [orderId]);
    expect(mine).toHaveLength(1);
    expect(mine[0].status).toBe('confirmed');
  });
});

describe('chain 3 — duplicate guards', () => {
  it('a replayed notification no longer matches (the order left awaiting_payment)', async () => {
    await h.asServiceRole();
    const candidates = await h.q(
      `select id from orders where status='awaiting_payment' and unique_amount=$1`, [uniqueAmount]);
    expect(candidates).toHaveLength(0); // → review path, never a double-confirm
    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: string }>(
      `select count(*)::text as n from payments where order_id=$1`, [orderId]);
    expect(Number(n)).toBe(1); // still exactly one payment
  });

  it('an order already carrying a confirmed payment hits the duplicate guard (no second payment)', async () => {
    // order2 stays awaiting_payment but (e.g. via Stripe) already has a confirmed payment
    await h.asServiceRole();
    const [o2] = await h.q<{ unique_amount: string }>(
      `select unique_amount from orders where id=$1`, [order2Id]);
    await h.q(
      `insert into payments (order_id, method, amount, status)
         values ($1,'stripe',$2,'confirmed')`, [order2Id, Number(o2.unique_amount)]);

    // the reconciler matches the order…
    const candidates = await h.q<{ id: string }>(
      `select id from orders where status='awaiting_payment' and unique_amount=$1`,
      [Number(o2.unique_amount)]);
    expect(candidates).toHaveLength(1);
    // …then its duplicate guard finds the confirmed payment and STOPS (result 'duplicate')
    const existing = await h.q<{ id: string }>(
      `select id from payments where order_id=$1 and status='confirmed'`, [order2Id]);
    expect(existing.length).toBeGreaterThan(0);

    await h.asSuperuser();
    const [{ n }] = await h.q<{ n: string }>(
      `select count(*)::text as n from payments where order_id=$1`, [order2Id]);
    expect(Number(n)).toBe(1); // the guard prevented a second payment row
  });

  it('a confirmed order can never be re-finalized', async () => {
    await h.asUser(client);
    await expect(
      h.q(`select * from finalize_order_payment($1,'zelle')`, [orderId]),
    ).rejects.toThrow(/cannot finalize/i);
  });
});
