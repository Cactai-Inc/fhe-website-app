/* POST /api/zelle-reconcile
 * Receives a parsed Zelle notification from the Google Workspace Apps Script
 * poller and reconciles it against pending orders. Requires the shared secret.
 *
 * Body: { sender?, amount, reference?, rawSubject?, rawBody?, sourceInbox? }
 * Header: x-fhe-secret: <ZELLE_INGEST_SECRET>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { reconcileNotification, type ParsedNotification } from './_lib/reconcile.js';
import { sendOrderReceipt } from './_lib/receipt.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const secret = process.env.ZELLE_INGEST_SECRET;
  if (!secret || req.headers['x-fhe-secret'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  let body: Record<string, unknown>;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const amount = Number(body.amount);
  if (!amount || Number.isNaN(amount)) {
    return res.status(400).json({ error: 'amount required' });
  }

  const notification: ParsedNotification = {
    sender: (body.sender as string | undefined) ?? null,
    amount,
    reference: (body.reference as string | undefined) ?? null,
    memo: (body.memo as string | undefined) ?? null,
    confirmation: (body.confirmation as string | undefined) ?? null,
    rawSubject: body.rawSubject as string | undefined,
    rawBody: body.rawBody as string | undefined,
    sourceInbox: body.sourceInbox as string | undefined,
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
