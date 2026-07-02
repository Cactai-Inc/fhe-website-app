/* Real-path test for the Zelle reconciliation core (api/_lib/reconcile.ts) —
 * the logic POST /api/zelle-reconcile executes after its shared-secret check.
 *
 * Proves the matching + review-queue rules:
 *  - a single exact unique-amount match confirms: payment row (confidence
 *    'unique-amount'), order → confirmed, confirm_booking_for_order called once,
 *    notification → matched,
 *  - amount + agreeing reference records confidence 'amount+reference',
 *  - a stripped-cents amount falls back to the reference code and still confirms,
 *  - zero matches → review ('no matching pending order'); >1 match → review
 *    ('ambiguous'), and neither confirms anything,
 *  - a duplicate (order already has a confirmed payment) acknowledges without
 *    re-confirming or re-booking,
 *  - an underpayment routes to review and never confirms,
 *  - every notification lands in payment_notifications first (audit trail).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { reconcileNotification } from './_lib/reconcile';

// ---- mutable fake DB with real filtering ------------------------------------
interface OrderRow { id: string; total: number; unique_amount: number | null; payment_reference: string | null; status: string }
interface PaymentRow { id: string; order_id: string; status: string; [k: string]: unknown }

const state: {
  orders: OrderRow[];
  payments: PaymentRow[];
  notifications: { id: string; status: string; matched_payment_id?: string | null }[];
  orderUpdates: { id: string; patch: Record<string, unknown> }[];
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
} = { orders: [], payments: [], notifications: [], orderUpdates: [], rpcCalls: [] };

let nextId = 0;
const genId = () => `id-${++nextId}`;

/** Thenable filter builder over an in-memory row set. */
function builder<T extends Record<string, unknown>>(rows: T[]) {
  const filters: ((r: T) => boolean)[] = [];
  const api = {
    eq(col: string, val: unknown) { filters.push((r) => r[col] === val); return api; },
    in(col: string, vals: unknown[]) { filters.push((r) => vals.includes(r[col])); return api; },
    then(resolve: (v: { data: T[] }) => void) {
      resolve({ data: rows.filter((r) => filters.every((f) => f(r))) });
    },
  };
  return api;
}

function table(name: string) {
  if (name === 'payment_notifications') {
    return {
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            const id = genId();
            state.notifications.push({ id, status: row.status as string });
            return { data: { id } };
          },
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async (_c: string, id: string) => {
          const n = state.notifications.find((x) => x.id === id);
          if (n) Object.assign(n, patch);
          return { data: null };
        },
      }),
    };
  }
  if (name === 'orders') {
    return {
      select: () => builder(state.orders as unknown as Record<string, unknown>[]),
      update: (patch: Record<string, unknown>) => ({
        eq: async (_c: string, id: string) => {
          state.orderUpdates.push({ id, patch });
          const o = state.orders.find((x) => x.id === id);
          if (o) o.status = (patch.status as string) ?? o.status;
          return { data: null };
        },
      }),
    };
  }
  if (name === 'payments') {
    return {
      select: () => builder(state.payments as unknown as Record<string, unknown>[]),
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            const id = genId();
            state.payments.push({ ...(row as PaymentRow), id });
            return { data: { id } };
          },
        }),
      }),
    };
  }
  throw new Error(`unexpected table ${name}`);
}

const dbMock = {
  from: table,
  rpc: async (fn: string, args: Record<string, unknown>) => {
    state.rpcCalls.push({ fn, args });
    return { data: null, error: null };
  },
} as unknown as SupabaseClient;

beforeEach(() => {
  nextId = 0;
  state.orders = [
    { id: 'order-1', total: 150, unique_amount: 150.37, payment_reference: 'FHE-A1B2', status: 'awaiting_payment' },
  ];
  state.payments = [];
  state.notifications = [];
  state.orderUpdates = [];
  state.rpcCalls = [];
});

describe('zelle reconciliation', () => {
  it('confirms a single exact unique-amount match end to end', async () => {
    const out = await reconcileNotification(dbMock, { amount: 150.37, sender: 'jane@bank.test' });
    expect(out).toMatchObject({ result: 'confirmed', orderId: 'order-1' });
    expect(state.payments[0]).toMatchObject({
      order_id: 'order-1', method: 'zelle', status: 'confirmed', match_confidence: 'unique-amount',
    });
    expect(state.orderUpdates[0]).toMatchObject({ id: 'order-1', patch: { status: 'confirmed' } });
    expect(state.rpcCalls).toEqual([{ fn: 'confirm_booking_for_order', args: { p_order_id: 'order-1' } }]);
    expect(state.notifications[0].status).toBe('matched'); // audit row updated
  });

  it('records amount+reference confidence when the memo corroborates', async () => {
    const out = await reconcileNotification(dbMock, { amount: 150.37, reference: 'FHE-A1B2' });
    expect(out.result).toBe('confirmed');
    expect(state.payments[0].match_confidence).toBe('amount+reference');
  });

  it('falls back to the reference when the bank strips cents — and still confirms', async () => {
    const out = await reconcileNotification(dbMock, { amount: 151, reference: 'FHE-A1B2' });
    expect(out).toMatchObject({ result: 'confirmed', orderId: 'order-1' });
    expect(state.rpcCalls).toHaveLength(1);
  });

  it('routes zero matches to review and confirms nothing', async () => {
    const out = await reconcileNotification(dbMock, { amount: 999.99 });
    expect(out).toMatchObject({ result: 'review', reason: 'no matching pending order' });
    expect(state.payments).toHaveLength(0);
    expect(state.rpcCalls).toHaveLength(0);
    expect(state.notifications[0].status).toBe('review');
  });

  it('routes ambiguous multi-matches to review and confirms nothing', async () => {
    state.orders.push({ id: 'order-2', total: 150, unique_amount: 150.37, payment_reference: 'FHE-Z9Y8', status: 'awaiting_payment' });
    const out = await reconcileNotification(dbMock, { amount: 150.37 });
    expect(out).toMatchObject({ result: 'review', reason: 'ambiguous: multiple pending orders match' });
    expect(state.payments).toHaveLength(0);
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('acknowledges a duplicate without re-confirming or re-booking', async () => {
    state.payments.push({ id: 'pay-0', order_id: 'order-1', status: 'confirmed' });
    const out = await reconcileNotification(dbMock, { amount: 150.37 });
    expect(out).toMatchObject({ result: 'duplicate', orderId: 'order-1' });
    expect(state.payments).toHaveLength(1); // no second payment row
    expect(state.orderUpdates).toHaveLength(0);
    expect(state.rpcCalls).toHaveLength(0);
    expect(state.notifications[0]).toMatchObject({ status: 'matched', matched_payment_id: 'pay-0' });
  });

  it('routes an underpayment (matched by reference) to review — never confirms', async () => {
    const out = await reconcileNotification(dbMock, { amount: 100, reference: 'FHE-A1B2' });
    expect(out).toMatchObject({ result: 'review', reason: 'underpayment' });
    expect(state.payments).toHaveLength(0);
    expect(state.orderUpdates).toHaveLength(0);
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('writes the audit notification row before any matching decision', async () => {
    await reconcileNotification(dbMock, { amount: 999.99, rawSubject: 'Zelle payment received' });
    expect(state.notifications).toHaveLength(1); // even a no-match leaves an audit trail
  });
});
