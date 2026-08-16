/* GET/POST /api/delivery-sweep — A15: hourly sweep for silently-failed
 * executed-document delivery.
 *
 * documents.executed_email_sent_at is set at queue time regardless of what
 * happens after the fire-and-forget net.http_post; document_deliveries is the
 * durable success signal (a row per recipient, written only after a real
 * provider send succeeds). This cron calls the DB-side
 * sweep_undelivered_executed_documents() RPC, which finds executed documents
 * stamped >10 minutes ago with a party still missing its delivery row, raises
 * one staff notification per document, and marks executed_email_error so the
 * alert never repeats. All the logic lives in the RPC (SECURITY DEFINER,
 * service_role-only); this endpoint is just the scheduler trigger.
 *
 * Auth: Vercel cron (x-vercel-cron header) or Bearer CRON_SECRET for manual
 * runs — same posture as /api/expire-holds and /api/calendar-reminders.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isVercelCron = req.headers['x-vercel-cron'] !== undefined;
  if (req.method !== 'POST' && !(req.method === 'GET' && isVercelCron)) {
    return res.status(405).json({ error: 'method not allowed' });
  }
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const secret = process.env.CRON_SECRET;
  const isManualRun = Boolean(secret && bearer && bearer === secret);
  if (!isVercelCron && !isManualRun) return res.status(401).json({ error: 'unauthorized' });

  try {
    const db = getSupabaseAdmin();

    // ONBOARD §4 backstop, FIRST: a signing run that was abandoned part-way
    // leaves executed documents deliberately held for a signature that never
    // came. Flush them (as one email each per person) before looking for
    // undelivered ones, so the alert sweep below does not shout about a
    // delivery this run is about to make.
    const { data: flushed, error: flushErr } =
      await db.rpc('flush_held_executed_document_emails', { p_hold_minutes: 30 });
    if (flushErr) console.error('delivery-sweep: hold flush failed', flushErr);
    const released = (flushed ?? []) as Array<{ contact_id: string; documents: number }>;

    const { data, error } = await db.rpc('sweep_undelivered_executed_documents');
    if (error) throw error;
    const alerted = (data ?? []) as Array<{ document_id: string; org_id: string; missing_count: number }>;
    return res.status(200).json({
      alerted: alerted.length,
      documents: alerted,
      heldSetsFlushed: released.length,
      heldSets: released,
    });
  } catch (err) {
    console.error('delivery-sweep error', err);
    return res.status(500).json({ error: 'delivery sweep failed' });
  }
}
