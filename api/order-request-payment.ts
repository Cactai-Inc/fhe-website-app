/* POST /api/order-request-payment
 * Staff-only. TASK-CREDITGRANT — the ONE deliberate "please pay this" send.
 *
 * Two halves, in order, so the staff act is recorded even when email fails:
 *   1. `request_purchase_payment` (as the CALLER, via their bearer token, so
 *      has_staff_access() and current_org() apply and the status event carries their
 *      user id) — raises the existing unpaid-balance notification pair, writes the
 *      order timeline, and returns the send key.
 *   2. `sendPaymentRequest` (service role) — one email, one logged attempt.
 *
 * Body: { purchaseId, note? }
 * -> 200 { requested: true, amountDue, sent, reason? }
 * -> 400 missing purchaseId · 401 no session · 403 not staff
 * -> 422 when the RPC refuses (order void, or nothing owed) — the message is the
 *    database's own, because it is the one a person needs to read.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { sendPaymentRequest } from './_lib/paymentRequest.js';

/** A Supabase client that acts AS the calling user (RLS + auth.uid() intact) — so
 *  request_purchase_payment's own has_staff_access()/current_org() fence evaluates
 *  against the real caller, and the status event names them. Same helper shape as
 *  api/orders-mark-paid.ts. */
function callerClient(bearer: string) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
}

interface RequestPaymentRpc {
  purchase_id: string;
  display_code: string | null;
  amount_due: number | string;
  label: string;
  recipient: string | null;
  note: string | null;
  send_key: string;
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
  const purchaseId = (typeof body.purchaseId === 'string' ? body.purchaseId : '').trim();
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
  if (!purchaseId) return res.status(400).json({ error: 'purchaseId required' });

  try {
    const db = getSupabaseAdmin();

    const { data: userData, error: userErr } = await db.auth.getUser(bearer);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('is_admin, role').eq('user_id', userData.user.id).maybeSingle();
    const isStaff = profile?.is_admin
      || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(profile?.role ?? '');
    if (!isStaff) return res.status(403).json({ error: 'forbidden' });

    // Called AS THE STAFF MEMBER — the admin client would defeat the RPC's own fence.
    const { data: rpc, error: rpcErr } = await callerClient(bearer).rpc('request_purchase_payment', {
      p_purchase_id: purchaseId,
      p_note: note,
    });
    if (rpcErr) return res.status(422).json({ error: rpcErr.message });
    const info = rpc as RequestPaymentRpc;

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const result = await sendPaymentRequest(db, purchaseId, info.send_key, {
      recipient: info.recipient,
      amountDue: Number(info.amount_due),
      label: info.label,
      note: info.note,
      orderCode: info.display_code,
      requestedBy: userData.user.id,
      appOrigin: origin,
    });

    return res.status(200).json({
      requested: true,
      amountDue: Number(info.amount_due),
      sent: result.sent,
      reason: result.reason,
    });
  } catch (err) {
    console.error('order-request-payment error', err);
    return res.status(500).json({ error: 'could not request payment' });
  }
}
