/* POST /api/orders-mark-paid — staff manually confirms an existing order was
 * paid (Zelle or cash), outside the automatic Zelle-matching path.
 *
 * TASK ZELLECLOSE, Z3: BOOKLINK widened `mark_purchase_paid` to staff
 * (guarded by has_staff_access()) but shipped no standalone UI for it outside
 * a fresh booking's create-new-order flow — flagged, not built, in that
 * report. This endpoint is that surface's server half, and it is the SAME
 * spine the automatic matcher uses, not a second one:
 *   1. Calls `mark_purchase_paid` AS THE CALLING STAFF USER (their own bearer
 *      token, not the service role) so `has_staff_access()` evaluates against
 *      the real actor and `status_events.actor_user_id` records who did it —
 *      same pattern as `delete-document-with-copy.ts`'s `callerClient`.
 *   2. Sends the same order-receipt email the automatic Zelle match sends
 *      (`sendOrderReceipt` — provable via `receipt_sends`, never a silent
 *      second confirmation channel).
 *
 * COORDINATION (found live in prod while building this, not anticipated by
 * either task doc): TASK CASHCONFIRM (branch task/cashconfirm, its migration
 * already applied to prod) added `purchases.client_claim_status` +
 * `confirm_payment_claim` — a client's own "I paid" report, confirmed by
 * staff. If this endpoint called `mark_purchase_paid` directly on a purchase
 * with a PENDING claim, the order would settle but the claim would be
 * orphaned forever (`client_claim_status` stuck on 'pending', never resolved,
 * invisible to CASHCONFIRM's "Client claims" queue as anything but an
 * eternally-open item). So: a pending claim routes through
 * `confirm_payment_claim` instead — the exact function CASHCONFIRM's own UI
 * calls — which settles via `mark_purchase_paid` internally AND resolves the
 * claim in one write. No claim (or a resolved one) uses `mark_purchase_paid`
 * directly, as before. Still one spine either way — `confirm_payment_claim`
 * is not a competing path, it's the claim-aware wrapper around the same one.
 *
 * Body: { purchaseId, method: 'zelle' | 'cash', reference?, amount?, paidAt? }
 *
 * TASK-BACKDATE — `paidAt` is a plain `YYYY-MM-DD` calendar date AT THE BARN
 * (America/Los_Angeles; the DB roles were set to it in 20260817T1600). It is the
 * date the money actually arrived, for the owner's backfill of a year of
 * trading, and it lands on `purchases.paid_at` — the field `revenue_summary`
 * recognises revenue at. Omitted, everything below is byte-for-byte the
 * behaviour it has always had (`now()`).
 *
 * ⚠️ A BACKDATED SETTLEMENT SENDS NO RECEIPT. `sendOrderReceipt` fires whenever
 * the status lands `paid`; backfilling a year would email a receipt to a real
 * client for money received in March. So a `paidAt` naming an earlier day than
 * today suppresses the email, and the response says `sent: false` with
 * `reason: 'backdated'` so the screen can say it out loud rather than implying a
 * receipt went out. A SAME-DAY settlement still sends its receipt — and by
 * construction, because the client only sends `paidAt` when it is in the past.
 *
 * ⚠️ A FUTURE DATE IS NOT A BACKFILL and is refused with a 400. The refusal also
 * exists inside `mark_purchase_paid` itself, which is the real boundary: that
 * RPC is EXECUTE-able by `authenticated` directly over PostgREST, so a check
 * that lived only here would not be one.
 *
 * `amount` makes a PART payment (2026-08-26). Omitted, the order settles in full
 * exactly as before — mark_purchase_paid reads NULL as "settle whatever is left".
 * Given, only that much is settled: the order stays open with a running
 * amount_paid until the settled entries cover the total, and each part becomes
 * its own numbered payment record saying which money came which way.
 * -> 200 { status: 'paid' | 'part_paid' | 'already_paid', receipt: { sent, reason? },
 *          claimConfirmed: boolean, recordedAt: string | null }
 * -> 400 bad body / future date; 401 no/bad bearer; 403 not staff; 404 unknown purchase
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { sendOrderReceipt } from './_lib/receipt.js';

/** Today at the barn as `YYYY-MM-DD`.
 *
 *  ⚠️ TWIN of `barnToday()` in `src/lib/recordedDate.ts`, and not a second
 *  implementation by choice: `tsconfig.api.json` includes only `api/`, so a
 *  serverless function cannot import from `src/`. Change one, change both. */
function barnToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** A Supabase client that acts AS the calling user (RLS + auth.uid() intact) —
 *  so mark_purchase_paid's own has_staff_access() guard evaluates against the
 *  real caller, not the service role, and the actor is provable. */
function callerClient(bearer: string) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ error: 'unauthorized' });

  let body: Record<string, unknown>;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const purchaseId = typeof body.purchaseId === 'string' ? body.purchaseId : '';
  const method = body.method === 'cash' ? 'cash' : body.method === 'zelle' ? 'zelle' : '';
  const reference = typeof body.reference === 'string' && body.reference.trim() ? body.reference.trim() : null;
  const rawAmount = typeof body.amount === 'number' ? body.amount
    : typeof body.amount === 'string' && body.amount.trim() !== '' ? Number(body.amount) : null;
  if (rawAmount !== null && (!Number.isFinite(rawAmount) || rawAmount <= 0)) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  if (!purchaseId) return res.status(400).json({ error: 'purchaseId required' });
  if (!method) return res.status(400).json({ error: "method must be 'zelle' or 'cash'" });

  /* TASK-BACKDATE. One shape only — a bare calendar date — so there is exactly
     one meaning and no instant to reinterpret. PostgREST casts it to
     `timestamptz` in a session whose timezone IS the barn's, giving the start of
     that day here. Anything else is a 400 rather than a guess. */
  const paidAt = typeof body.paidAt === 'string' && body.paidAt.trim() ? body.paidAt.trim() : null;
  if (paidAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
    return res.status(400).json({ error: 'paidAt must be a calendar date (YYYY-MM-DD)' });
  }
  const today = barnToday();
  if (paidAt !== null && paidAt > today) {
    return res.status(400).json({ error: 'a payment cannot be dated in the future' });
  }
  // The date's PRESENCE is the backdating: a same-day settlement sends no date
  // at all, keeps `now()`, and keeps its receipt.
  const backdated = paidAt !== null && paidAt < today;

  try {
    const db = getSupabaseAdmin();
    const { data: userData, error: userErr } = await db.auth.getUser(bearer);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('is_admin, role').eq('user_id', userData.user.id).maybeSingle();
    const isStaff = profile?.is_admin
      || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(profile?.role ?? '');
    if (!isStaff) return res.status(403).json({ error: 'forbidden' });

    const { data: order } = await db.from('purchases')
      .select('id, amount, client_claim_status').eq('id', purchaseId).maybeSingle();
    if (!order) return res.status(404).json({ error: 'order not found' });

    const asUser = callerClient(bearer);
    const hasPendingClaim = order.client_claim_status === 'pending';

    let status: string | null;
    if (hasPendingClaim) {
      // CASHCONFIRM's claim-aware settlement — resolves client_claim_status
      // in the same write, using the claim's own reported method/reference
      // rather than whatever was picked in this UI (staff is confirming what
      // the client already said, not re-declaring it).
      const { data, error: rpcErr } = await asUser.rpc('confirm_payment_claim', {
        p_purchase_id: purchaseId,
        // TASK-BACKDATE: the claim wrapper carries the date through to the same
        // mark_purchase_paid call it always made. Dropping it here is how a
        // backfill would settle on the right order and the WRONG month.
        p_paid_at: paidAt,
      });
      if (rpcErr) return res.status(400).json({ error: rpcErr.message });
      status = (data as { settlement?: string })?.settlement ?? null;
    } else {
      const { data, error: rpcErr } = await asUser.rpc('mark_purchase_paid', {
        p_purchase_id: purchaseId,
        // NULL settles the remainder; a number settles exactly that much.
        p_amount: rawAmount,
        p_reference: reference,
        p_method: method,
        // NULL keeps now() — TASK-ORIGIN §4.3 added this parameter for exactly
        // this and nothing had ever passed it.
        p_paid_at: paidAt,
      });
      if (rpcErr) return res.status(400).json({ error: rpcErr.message });
      status = data as string;
    }

    // Same provable trail an automatic match gets — never a silent second path.
    // ⚠️ A PART PAYMENT SENDS NO RECEIPT. A receipt says the order is settled,
    // and it is not — the balance is still owed.
    // ⚠️ AND A BACKDATED SETTLEMENT SENDS NO RECEIPT EITHER. The email says "we
    // received your payment"; for money that arrived in March, sent during a
    // backfill, that is a lie to a real client. The reason is returned so the
    // screen states it rather than leaving staff to assume one went out.
    const receipt = status !== 'paid'
      ? { sent: false, reason: status ?? 'unknown' }
      : backdated
        ? { sent: false, reason: 'backdated' }
        : await sendOrderReceipt(db, purchaseId);

    return res.status(200).json({
      status, receipt, claimConfirmed: hasPendingClaim, recordedAt: paidAt,
    });
  } catch (err) {
    console.error('orders-mark-paid error', err);
    return res.status(500).json({ error: 'could not mark this order paid' });
  }
}
