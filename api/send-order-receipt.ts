/* POST /api/send-order-receipt
 * Staff-only. CASHCONFIRM C2 — after confirm_payment_claim settles a
 * client-reported claim (zelle or cash) through mark_purchase_paid, the browser
 * calls this endpoint so the SAME receipt path Stripe/Zelle auto-confirmation
 * uses (api/_lib/receipt.ts, receipt_sends) fires here too. Best-effort by the
 * same contract sendOrderReceipt already carries: it never throws, and every
 * attempt (success or failure) writes one receipt_sends row.
 *
 * Body: { purchaseId }
 * -> 200 { sent, reason? } always (best-effort; see above)
 * -> 401 no session; 403 session present but not staff
 * -> 400 missing/invalid purchaseId
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { sendOrderReceipt } from './_lib/receipt.js';

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

    const result = await sendOrderReceipt(db, purchaseId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('send-order-receipt error', err);
    return res.status(500).json({ error: 'could not send receipt' });
  }
}
