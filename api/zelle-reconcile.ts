/* POST /api/zelle-reconcile
 * Receives a parsed Zelle notification from the Google Workspace Apps Script
 * poller and reconciles it against pending orders. Requires the shared secret.
 *
 * Body: { sender?, amount, reference?, rawSubject?, rawBody?, sourceInbox? }
 * Header: x-fhe-secret: <ZELLE_INGEST_SECRET>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { reconcileNotification, type ParsedNotification } from './_lib/reconcile';
import { sendOrderReceipt } from './_lib/receipt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const secret = process.env.ZELLE_INGEST_SECRET;
  if (!secret || req.headers['x-fhe-secret'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  const amount = Number(body.amount);
  if (!amount || Number.isNaN(amount)) {
    return res.status(400).json({ error: 'amount required' });
  }

  const notification: ParsedNotification = {
    sender: body.sender ?? null,
    amount,
    reference: body.reference ?? null,
    rawSubject: body.rawSubject,
    rawBody: body.rawBody,
    sourceInbox: body.sourceInbox,
  };

  try {
    const db = getSupabaseAdmin();
    const outcome = await reconcileNotification(db, notification);
    if (outcome.result === 'confirmed') {
      await sendOrderReceipt(db, outcome.orderId); // best-effort; never fails reconciliation
    }
    return res.status(200).json(outcome);
  } catch (err) {
    console.error('reconcile error', err);
    return res.status(500).json({ error: 'reconciliation failed' });
  }
}
