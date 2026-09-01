/**
 * TASK-BACKDATE R5 — A BACKDATED SETTLEMENT SENDS NO RECEIPT.
 *
 * ⚠️ WHY THIS TEST EXISTS AND WHY IT IS HERMETIC. `receipt_sends` holds one row
 * per ATTEMPT, so "no email left the system" is provable from that table — but
 * proving it end-to-end means settling a real order in production and, for the
 * same-day half, actually emailing a real client money-received mail for a
 * rehearsal. The decision this task added is a branch in
 * `api/orders-mark-paid.ts`, so the branch is what is asserted here, against the
 * real handler, with `sendOrderReceipt` (the ONLY writer of `receipt_sends`)
 * spied. No receipt call, no `receipt_sends` row, no email.
 *
 * ⚠️ IT IS ALSO A GUARD FOR THE NEXT THREAD. `TASK-BOOKS1`'s concurrency block
 * says in as many words: "your disposition must not re-open that door", and it
 * edits this same file. A comp or discount that settles an order must not start
 * emailing receipts for last March.
 *
 * Run: `npx vitest run test/api`. ⚠️ There is no npm script for it —
 * `package.json` is not this task's to edit; the one-line `"test:api"` diff is
 * in the report for ORCH to apply.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendOrderReceipt = vi.fn(async () => ({ sent: true }));
const rpc = vi.fn(async () => ({ data: 'paid', error: null }));

vi.mock('../../api/_lib/receipt.js', () => ({ sendOrderReceipt }));
vi.mock('../../api/_lib/supabaseAdmin.js', () => ({ getSupabaseAdmin: () => admin }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }));

/** The order the handler reads before it acts. `claim` mirrors CASHCONFIRM's
 *  `client_claim_status`, which decides WHICH settlement function is called. */
let order: { id: string; amount: number; client_claim_status: string } | null = null;

const admin = {
  auth: { getUser: async () => ({ data: { user: { id: 'staff-1' } }, error: null }) },
  from(table: string) {
    const data = table === 'profiles' ? { is_admin: true, role: 'ADMIN' } : order;
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data, error: null }),
    };
    return chain;
  },
};

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon-key';

const { default: handler } = await import('../../api/orders-mark-paid.js');

/** Today AT THE BARN — the same calendar the handler and the database use. */
const barnToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

async function post(body: Record<string, unknown>) {
  const out: { code: number; payload: Record<string, unknown> } = { code: 0, payload: {} };
  const res = {
    status(code: number) { out.code = code; return res; },
    json(payload: Record<string, unknown>) { out.payload = payload; return res; },
  };
  const req = { method: 'POST', headers: { authorization: 'Bearer token' }, body };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await handler(req as any, res as any);
  return out;
}

beforeEach(() => {
  sendOrderReceipt.mockClear();
  rpc.mockClear();
  order = { id: 'ord-1', amount: 880, client_claim_status: 'none' };
});

describe('a settlement carrying a past date', () => {
  it('lands the date on mark_purchase_paid and sends NOTHING', async () => {
    const out = await post({ purchaseId: 'ord-1', method: 'zelle', paidAt: '2026-03-14' });

    expect(out.code).toBe(200);
    expect(rpc).toHaveBeenCalledWith('mark_purchase_paid', expect.objectContaining({
      p_purchase_id: 'ord-1', p_paid_at: '2026-03-14',
    }));
    // THE POINT: no receipt call => no receipt_sends row => no email.
    expect(sendOrderReceipt).not.toHaveBeenCalled();
    expect(out.payload.receipt).toEqual({ sent: false, reason: 'backdated' });
    // ...and it says so, rather than leaving the screen to imply one went out.
    expect(out.payload.recordedAt).toBe('2026-03-14');
  });

  it('carries the date through the CLAIM path too, not just the plain one', async () => {
    order = { id: 'ord-1', amount: 880, client_claim_status: 'pending' };
    rpc.mockResolvedValueOnce({ data: { settlement: 'paid' } as never, error: null });

    const out = await post({ purchaseId: 'ord-1', method: 'cash', paidAt: '2026-03-14' });

    expect(rpc).toHaveBeenCalledWith('confirm_payment_claim', {
      p_purchase_id: 'ord-1', p_paid_at: '2026-03-14',
    });
    expect(sendOrderReceipt).not.toHaveBeenCalled();
    expect(out.payload.claimConfirmed).toBe(true);
  });
});

describe('a same-day settlement', () => {
  it('is unchanged — no date is sent, and the receipt still goes', async () => {
    const out = await post({ purchaseId: 'ord-1', method: 'zelle' });

    expect(rpc).toHaveBeenCalledWith('mark_purchase_paid', expect.objectContaining({
      p_paid_at: null,
    }));
    expect(sendOrderReceipt).toHaveBeenCalledTimes(1);
    expect(out.payload.receipt).toEqual({ sent: true });
    expect(out.payload.recordedAt).toBe(null);
  });

  it('still sends the receipt when TODAY is stated explicitly', async () => {
    await post({ purchaseId: 'ord-1', method: 'zelle', paidAt: barnToday() });
    expect(sendOrderReceipt).toHaveBeenCalledTimes(1);
  });
});

describe('a future date is not a backfill', () => {
  it('is refused before anything is written', async () => {
    const out = await post({ purchaseId: 'ord-1', method: 'zelle', paidAt: '2099-01-01' });

    expect(out.code).toBe(400);
    expect(out.payload.error).toMatch(/future/);
    expect(rpc).not.toHaveBeenCalled();
    expect(sendOrderReceipt).not.toHaveBeenCalled();
  });

  it('refuses anything that is not a bare calendar date, rather than guessing', async () => {
    const out = await post({ purchaseId: 'ord-1', method: 'zelle', paidAt: '14/03/2026' });
    expect(out.code).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('a part payment', () => {
  it('sends no receipt whether or not it is backdated — the balance is still owed', async () => {
    rpc.mockResolvedValueOnce({ data: 'part_paid' as never, error: null });
    const out = await post({ purchaseId: 'ord-1', method: 'cash', amount: 100, paidAt: '2026-03-14' });
    expect(sendOrderReceipt).not.toHaveBeenCalled();
    expect(out.payload.receipt).toEqual({ sent: false, reason: 'part_paid' });
  });
});
