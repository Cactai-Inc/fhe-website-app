/* Real-path test for POST /api/stripe-webhook (node env).
 *
 * Mocks the Stripe SDK's signature verification + the service-role admin client.
 * Proves:
 *  - a bad/missing signature is rejected 400 and touches NOTHING,
 *  - a completed checkout confirms the order + payment and calls
 *    confirm_booking_for_order exactly once,
 *  - a RETRIED event (already-confirmed order) is acknowledged 200 as duplicate
 *    and re-confirms NOTHING (idempotency guard),
 *  - an event without order metadata is acknowledged without writes,
 *  - non-POST is 405; unconfigured env is 500.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- mutable fake DB state --------------------------------------------------
const state: {
  order: { id: string; status: string } | null;
  orderUpdates: Record<string, unknown>[];
  paymentUpdates: Record<string, unknown>[];
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
} = { order: null, orderUpdates: [], paymentUpdates: [], rpcCalls: [] };

function table(name: string) {
  if (name === 'orders') {
    return {
      select: () => ({ eq: () => ({ single: async () => ({ data: state.order }) }) }),
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          state.orderUpdates.push(patch);
          if (state.order) state.order.status = (patch.status as string) ?? state.order.status;
          return { data: null };
        },
      }),
    };
  }
  if (name === 'payments') {
    return {
      update: (patch: Record<string, unknown>) => ({
        eq: () => ({ eq: async () => { state.paymentUpdates.push(patch); return { data: null }; } }),
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
};
vi.mock('./_lib/supabaseAdmin', () => ({ getSupabaseAdmin: () => dbMock }));

// ---- Stripe SDK mock: constructEvent validates our fake signature ----------
const VALID_SIG = 't=1,v1=valid';
let nextEvent: { type: string; data: { object: { metadata?: Record<string, string> } } };
vi.mock('stripe', () => ({
  default: class StripeMock {
    webhooks = {
      constructEvent: (_raw: Buffer, sig: string, secret: string) => {
        if (sig !== VALID_SIG || secret !== 'whsec_test') throw new Error('bad signature');
        return nextEvent;
      },
    };
  },
}));

import handler from './stripe-webhook';

// ---- minimal req/res --------------------------------------------------------
function makeReq(sig: string | undefined) {
  const body = Buffer.from(JSON.stringify({ any: 'payload' }));
  return {
    method: 'POST',
    headers: sig ? { 'stripe-signature': sig } : {},
    async *[Symbol.asyncIterator]() { yield body; },
  } as never;
}
function makeRes() {
  const res: { statusCode?: number; body?: unknown; status: (c: number) => typeof res; json: (b: unknown) => typeof res } = {
    status(c: number) { res.statusCode = c; return res; },
    json(b: unknown) { res.body = b; return res; },
  };
  return res;
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  state.order = { id: 'order-1', status: 'awaiting_payment' };
  state.orderUpdates = [];
  state.paymentUpdates = [];
  state.rpcCalls = [];
  nextEvent = {
    type: 'checkout.session.completed',
    data: { object: { metadata: { order_id: 'order-1' } } },
  };
});

describe('stripe-webhook', () => {
  it('rejects a bad signature with 400 and performs no writes', async () => {
    const res = makeRes();
    await handler(makeReq('t=1,v1=forged') as never, res as never);
    expect(res.statusCode).toBe(400);
    expect(state.orderUpdates).toHaveLength(0);
    expect(state.paymentUpdates).toHaveLength(0);
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('confirms order + payment and books exactly once on completed checkout', async () => {
    const res = makeRes();
    await handler(makeReq(VALID_SIG) as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(state.orderUpdates).toHaveLength(1);
    expect(state.orderUpdates[0]).toMatchObject({ status: 'confirmed' });
    expect(state.paymentUpdates[0]).toMatchObject({ status: 'confirmed', match_confidence: 'stripe' });
    expect(state.rpcCalls).toEqual([{ fn: 'confirm_booking_for_order', args: { p_order_id: 'order-1' } }]);
  });

  it('acknowledges a retried event as duplicate without re-confirming (idempotency)', async () => {
    state.order = { id: 'order-1', status: 'confirmed' }; // already processed
    const res = makeRes();
    await handler(makeReq(VALID_SIG) as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ received: true, duplicate: true });
    expect(state.orderUpdates).toHaveLength(0);
    expect(state.paymentUpdates).toHaveLength(0);
    expect(state.rpcCalls).toHaveLength(0); // booking NOT confirmed twice
  });

  it('acknowledges an event without order metadata and writes nothing', async () => {
    nextEvent = { type: 'payment_intent.succeeded', data: { object: {} } };
    const res = makeRes();
    await handler(makeReq(VALID_SIG) as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(state.orderUpdates).toHaveLength(0);
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('rejects non-POST with 405 and unconfigured env with 500', async () => {
    const res1 = makeRes();
    await handler({ method: 'GET', headers: {} } as never, res1 as never);
    expect(res1.statusCode).toBe(405);

    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res2 = makeRes();
    await handler(makeReq(VALID_SIG) as never, res2 as never);
    expect(res2.statusCode).toBe(500);
  });
});
