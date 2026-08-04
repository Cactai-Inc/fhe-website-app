/* GET/POST /api/deliver-executed-sweep — the SERVER-SIDE delivery guarantee.
 *
 * WHY THIS EXISTS (2026-08-04). Executed-document delivery was triggered only
 * from the browser: ContractPage fires /api/deliver-documents when someone has
 * the contract open and sees status EXECUTED. So a party who signed on a phone
 * and closed the tab, or a contract executed by the other side while nobody had
 * the page open, was never emailed anything. A live audit found 39 EXECUTED
 * documents with zero delivery rows.
 *
 * This sweep makes delivery a property of the DOCUMENT BEING EXECUTED rather
 * than of anyone's browser being open. It runs on the hourly cron, finds
 * executed documents whose parties have not been delivered to, and sends.
 *
 * IDEMPOTENT: deliverExecutedDocuments writes a document_deliveries row per
 * (document, recipient, EMAIL) only after a successful send, and skips
 * recipients already delivered to — so repeated runs never double-send.
 *
 * BOUNDED: at most MAX_DOCS per run, oldest-executed first, so a backlog drains
 * over successive runs instead of timing out. Failures are logged and left for
 * the next run rather than swallowed.
 *
 * AUTH: Vercel cron (x-vercel-cron) or Bearer CRON_SECRET for manual runs.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

/** Per-run cap: a backlog drains across runs rather than timing out one. */
const MAX_DOCS = 10;
/** Grace period: give the browser path its chance before the sweep steps in,
 *  so the common case still delivers instantly and this is the safety net. */
const GRACE_MINUTES = 5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isVercelCron = req.headers['x-vercel-cron'] !== undefined;
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const isManualRun = !!process.env.CRON_SECRET && bearer === process.env.CRON_SECRET;
  if (req.method !== 'POST' && !(req.method === 'GET' && isVercelCron)) {
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!isVercelCron && !isManualRun) return res.status(401).json({ error: 'unauthorized' });

  try {
    const db = getSupabaseAdmin();

    // Executed documents that still have at least one party with no EMAIL
    // delivery row. Oldest first so the backlog drains in order.
    const { data: docs, error } = await db.rpc('undelivered_executed_documents', {
      p_limit: MAX_DOCS,
      p_grace_minutes: GRACE_MINUTES,
    });
    if (error) throw error;

    const ids = ((docs ?? []) as { document_id: string }[]).map((d) => d.document_id);
    if (ids.length === 0) return res.status(200).json({ swept: 0, delivered: [] });

    const results: { documentId: string; ok: boolean; error?: string }[] = [];
    for (const documentId of ids) {
      try {
        // Reuse the delivery endpoint rather than duplicating its 200 lines of
        // PDF rendering, recipient union, branding and idempotency. One
        // implementation, one place to fix.
        const base = process.env.PUBLIC_SITE_URL || `https://${process.env.VERCEL_URL ?? ''}`;
        const r = await fetch(`${base}/api/deliver-documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentIds: [documentId] }),
        });
        if (!r.ok) throw new Error(`deliver-documents ${r.status}: ${await r.text()}`);
        results.push({ documentId, ok: true });
      } catch (e) {
        // Log and continue: one bad document must not block the rest, and the
        // next run retries it.
        const message = e instanceof Error ? e.message : 'delivery failed';
        console.error('executed-delivery sweep', documentId, message);
        results.push({ documentId, ok: false, error: message });
      }
    }

    return res.status(200).json({ swept: ids.length, delivered: results });
  } catch (e) {
    console.error('executed-delivery sweep', e);
    return res.status(500).json({ error: 'sweep failed' });
  }
}
