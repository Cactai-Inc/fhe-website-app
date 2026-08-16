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
 * Body: { purchaseId: string, method: 'zelle' | 'cash', reference?: string }
 * -> 200 { status: 'paid' | 'already_paid', receipt: { sent, reason? } }
 * -> 400 bad body; 401 no/bad bearer; 403 not staff; 404 unknown purchase
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { sendOrderReceipt } from './_lib/receipt.js';

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
  if (!purchaseId) return res.status(400).json({ error: 'purchaseId required' });
  if (!method) return res.status(400).json({ error: "method must be 'zelle' or 'cash'" });

  try {
    const db = getSupabaseAdmin();
    const { data: userData, error: userErr } = await db.auth.getUser(bearer);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('is_admin, role').eq('user_id', userData.user.id).maybeSingle();
    const isStaff = profile?.is_admin
      || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(profile?.role ?? '');
    if (!isStaff) return res.status(403).json({ error: 'forbidden' });

    const { data: order } = await db.from('purchases').select('id, amount').eq('id', purchaseId).maybeSingle();
    if (!order) return res.status(404).json({ error: 'order not found' });

    const asUser = callerClient(bearer);
    const { data: status, error: rpcErr } = await asUser.rpc('mark_purchase_paid', {
      p_purchase_id: purchaseId,
      p_amount: order.amount,
      p_reference: reference,
      p_method: method,
    });
    if (rpcErr) return res.status(400).json({ error: rpcErr.message });

    // Same provable trail an automatic match gets — never a silent second path.
    const receipt = status === 'paid' ? await sendOrderReceipt(db, purchaseId) : { sent: false, reason: status as string };

    return res.status(200).json({ status, receipt });
  } catch (err) {
    console.error('orders-mark-paid error', err);
    return res.status(500).json({ error: 'could not mark this order paid' });
  }
}
