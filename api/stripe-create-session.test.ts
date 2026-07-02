/* Real-path test for POST /api/stripe-create-session (node env).
 *
 * Mocks the Stripe SDK + the service-role admin client. Proves:
 *  - the 3% disclosed card fee is applied in integer cents,
 *  - the line item carries the ORDER's org's brand from the registry (never a
 *    hardcoded name; falls back to business_config.legal_entity_name),
 *  - a caller who does not own the order is 403 (and no session is created),
 *  - an unauthenticated caller is 401; a missing orderId is 400,
 *  - an already-confirmed order is 409 (no re-payment),
 *  - a RETRY does not stack duplicate pending payment rows (updates the one row),
 *  - the order moves to awaiting_payment with method stripe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- mutable fake DB state --------------------------------------------------
const state: {
  order: { id: string; user_id: string; total: number; status: string; org_id: string } | null;
  brandRegistry: Record<string, string | undefined>; // org_id -> BRAND.NAME
  legalName: Record<string, string | undefined>;     // org_id -> legal_entity_name
  pendingPayment: { id: string } | null;
  paymentInserts: Record<string, unknown>[];
  paymentUpdates: Record<string, unknown>[];
  orderUpdates: Record<string, unknown>[];
  authedUser: { id: string } | null;
} = {
  order: null, brandRegistry: {}, legalName: {}, pendingPayment: null,
  paymentInserts: [], paymentUpdates: [], orderUpdates: [], authedUser: null,
};

function table(name: string) {
  if (name === 'orders') {
    return {
      select: () => ({ eq: () => ({ single: async () => ({ data: state.order }) }) }),
      update: (patch: Record<string, unknown>) => ({
        eq: async () => { state.orderUpdates.push(patch); return { data: null }; },
      }),
    };
  }
  if (name === 'config_values') {
    return {
      select: () => ({
        eq: (_c: string, org: string) => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.brandRegistry[org] ? { value_text: state.brandRegistry[org] } : null,
              }),
            }),
          }),
        }),
      }),
    };
  }
  if (name === 'business_config') {
    return {
      select: () => ({
        eq: (_c: string, org: string) => ({
          maybeSingle: async () => ({
            data: state.legalName[org] ? { legal_entity_name: state.legalName[org] } : null,
          }),
        }),
      }),
    };
  }
  if (name === 'payments') {
    return {
      select: () => ({
        eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.pendingPayment }) }) }) }),
      }),
      insert: async (row: Record<string, unknown>) => { state.paymentInserts.push(row); return { data: null }; },
      update: (patch: Record<string, unknown>) => ({
        eq: async () => { state.paymentUpdates.push(patch); return { data: null }; },
      }),
    };
  }
  throw new Error(`unexpected table ${name}`);
}

const dbMock = {
  from: table,
  auth: { getUser: async (token: string) => (token === 'good-token' && state.authedUser
    ? { data: { user: state.authedUser }, error: null }
    : { data: { user: null }, error: new Error('bad token') }) },
};
vi.mock('./_lib/supabaseAdmin', () => ({ getSupabaseAdmin: () => dbMock }));

// ---- Stripe SDK mock ---------------------------------------------------------
const sessionCreates: Record<string, unknown>[] = [];
vi.mock('stripe', () => ({
  default: class StripeMock {
    checkout = {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          sessionCreates.push(params);
          return { url: 'https://checkout.stripe.test/session-1' };
        },
      },
    };
  },
}));

import handler from './stripe-create-session';

function makeReq(over: Partial<{ method: string; token: string; body: unknown }> = {}) {
  return {
    method: over.method ?? 'POST',
    headers: {
      authorization: over.token === undefined ? 'Bearer good-token' : over.token ? `Bearer ${over.token}` : '',
      origin: 'https://fhe.test',
    },
    body: over.body ?? { orderId: 'order-1' },
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
  state.order = { id: 'order-1', user_id: 'user-1', total: 100, status: 'pending_payment', org_id: 'org-fhe' };
  state.brandRegistry = { 'org-fhe': 'French Heritage Equestrian' };
  state.legalName = { 'org-fhe': 'French Heritage Equestrian' };
  state.pendingPayment = null;
  state.paymentInserts = [];
  state.paymentUpdates = [];
  state.orderUpdates = [];
  state.authedUser = { id: 'user-1' };
  sessionCreates.length = 0;
});

describe('stripe-create-session', () => {
  it('applies the 3% card fee in integer cents and moves the order to awaiting_payment', async () => {
    const res = makeRes();
    await handler(makeReq() as never, res as never);
    expect(res.statusCode).toBe(200);
    const lineItems = (sessionCreates[0] as { line_items: { price_data: { unit_amount: number } }[] }).line_items;
    expect(lineItems[0].price_data.unit_amount).toBe(10300); // $100 * 1.03 in cents
    expect(state.orderUpdates[0]).toMatchObject({ status: 'awaiting_payment', payment_method: 'stripe' });
    expect(state.paymentInserts[0]).toMatchObject({ method: 'stripe', amount: 103, status: 'pending' });
  });

  it("carries the ORDER's org brand on the line item (registry, not hardcoded)", async () => {
    state.brandRegistry = { 'org-fhe': 'Bravo Barn' }; // simulate a different tenant's order
    const res = makeRes();
    await handler(makeReq() as never, res as never);
    const li = (sessionCreates[0] as { line_items: { price_data: { product_data: { name: string } } }[] }).line_items;
    expect(li[0].price_data.product_data.name).toBe('Bravo Barn — Order');
  });

  it('falls back to business_config.legal_entity_name when BRAND.NAME is unseeded', async () => {
    state.brandRegistry = {};
    state.legalName = { 'org-fhe': 'Charles Zigmund DBA FHE' };
    const res = makeRes();
    await handler(makeReq() as never, res as never);
    const li = (sessionCreates[0] as { line_items: { price_data: { product_data: { name: string } } }[] }).line_items;
    expect(li[0].price_data.product_data.name).toBe('Charles Zigmund DBA FHE — Order');
  });

  it("rejects a caller who doesn't own the order with 403 and creates no session", async () => {
    state.authedUser = { id: 'someone-else' };
    const res = makeRes();
    await handler(makeReq() as never, res as never);
    expect(res.statusCode).toBe(403);
    expect(sessionCreates).toHaveLength(0);
    expect(state.orderUpdates).toHaveLength(0);
  });

  it('rejects an already-confirmed order with 409 (no double payment)', async () => {
    state.order!.status = 'confirmed';
    const res = makeRes();
    await handler(makeReq() as never, res as never);
    expect(res.statusCode).toBe(409);
    expect(sessionCreates).toHaveLength(0);
  });

  it('a retry refreshes the existing pending payment row instead of stacking a duplicate', async () => {
    state.pendingPayment = { id: 'pay-1' };
    const res = makeRes();
    await handler(makeReq() as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(state.paymentInserts).toHaveLength(0); // no second row
    expect(state.paymentUpdates[0]).toMatchObject({ amount: 103 });
  });

  it('401 without a token; 400 without an orderId', async () => {
    const res1 = makeRes();
    await handler(makeReq({ token: '' }) as never, res1 as never);
    expect(res1.statusCode).toBe(401);

    const res2 = makeRes();
    await handler(makeReq({ body: {} }) as never, res2 as never);
    expect(res2.statusCode).toBe(400);
  });
});
