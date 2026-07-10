/* GET/POST /api/expire-holds — the booking-hold reaper (Slice 2).
 *
 * Real-time expiry is by COMPUTATION (a hold past 48h reads as expired to any
 * query; availability excludes it). This cron does the HOUSEKEEPING: flips
 * lapsed line items to `lapsed`, releases held slots, and emails the affected
 * client that their hold lapsed + how to get re-offered.
 *
 * WINDOW (owner C7): housekeeping runs only 06:00–21:00 America/Los_Angeles.
 * Outside that window the endpoint is a no-op (expiry is still real-time in the
 * DB; we just don't send emails or release slots overnight). Vercel cron fires
 * hourly; the window gate lives here.
 *
 * Auth: Vercel cron (x-vercel-cron header) or Bearer CRON_SECRET for manual runs.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';

const WINDOW_START = 6;  // 06:00 PT
const WINDOW_END = 21;   // 21:00 PT (9pm)

/** Current hour in America/Los_Angeles (0-23), DST-correct via Intl. */
function pacificHour(): number {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false,
  }).format(new Date());
  const h = parseInt(s, 10);
  return h === 24 ? 0 : h; // Intl can emit "24" at midnight
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isVercelCron = req.headers['x-vercel-cron'] !== undefined;
  if (req.method !== 'POST' && !(req.method === 'GET' && isVercelCron)) {
    return res.status(405).json({ error: 'method not allowed' });
  }
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const secret = process.env.CRON_SECRET;
  const isManualRun = Boolean(secret && bearer && bearer === secret);
  if (!isVercelCron && !isManualRun) return res.status(401).json({ error: 'unauthorized' });

  // Housekeeping window gate (real-time expiry still holds in the DB regardless).
  const hour = pacificHour();
  if (hour < WINDOW_START || hour >= WINDOW_END) {
    return res.status(200).json({ skipped: 'outside 6am-9pm PT window', hour });
  }

  try {
    const db = getSupabaseAdmin();

    // Capture who is about to lapse (for the email) BEFORE the reap flips state.
    const nowIso = new Date().toISOString();
    const { data: lapsingRaw } = await db
      .from('request_selections')
      .select('id, org_id, label, request_id, requests:request_id (contact_email, contact_name)')
      .eq('state', 'approved_awaiting_claim')
      .lt('hold_expires_at', nowIso);
    const lapsing = (lapsingRaw ?? []) as unknown as Array<{
      id: string; org_id: string | null; label: string | null;
      requests: { contact_email: string | null; contact_name: string | null } | null;
    }>;

    // Do the housekeeping (lapse line items + release order/slot holds).
    const { data: reapData, error: reapErr } = await db.rpc('reap_expired_holds');
    if (reapErr) throw reapErr;

    // Email each affected client (best-effort; grouped by email).
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const byEmail = new Map<string, { name: string | null; org: string | null; items: string[] }>();
    for (const row of lapsing) {
      const email = row.requests?.contact_email;
      if (!email) continue;
      const g = byEmail.get(email) ?? { name: row.requests?.contact_name ?? null, org: row.org_id, items: [] };
      if (row.label) g.items.push(row.label);
      byEmail.set(email, g);
    }
    let emailed = 0;
    for (const [email, g] of byEmail) {
      if (!g.org) continue; // need the tenant to resolve the branded from-identity
      try {
        const identity = await resolveTenantEmailIdentity(db, g.org);
        const list = g.items.length ? `<ul>${g.items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '';
        const sent = await sendViaProvider({
          to: email,
          fromName: identity.fromName,
          fromEmail: identity.fromEmail,
          subject: `Your hold has expired — ${identity.fromName}`,
          html:
            `<p>${g.name ? `Hi ${g.name},` : 'Hello,'}</p>` +
            `<p>The 48-hour hold on your requested booking has expired because payment wasn't completed in time.</p>` +
            list +
            `<p>No problem — just reply and we'll re-offer new dates with a fresh hold.</p>` +
            (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>` : ''),
        });
        if (sent.ok) emailed += 1;
      } catch { /* best-effort per recipient */ }
    }

    return res.status(200).json({ lapsed: reapData ?? 0, emailed, hour });
  } catch (err) {
    console.error('expire-holds error', err);
    return res.status(500).json({ error: 'reaper failed' });
  }
}
