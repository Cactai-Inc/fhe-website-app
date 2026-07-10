/* GET/POST /api/payment-watch — the Zelle billing reminder cron (Slice 5).
 *
 * Reads billing_due_reminders(today): every active, reminders-on schedule whose
 * next due date is 3 days out, 1 day out, or 1 day past, with which window it hit.
 * Sends the branded Zelle reminder to the client (best-effort). Zelle-only: we
 * never charge — we remind, they pay. Mode shapes the copy:
 *   'request'        → "we'll send a Zelle request" (we drive)
 *   'self_recurring' → "please send your Zelle payment" (they drive)
 *
 * WINDOW: like expire-holds, housekeeping/email only 06:00–21:00 PT. Fires daily
 * (once a day is enough for date-window reminders); the gate lives here.
 *
 * Auth: Vercel cron (x-vercel-cron) or Bearer CRON_SECRET for manual runs.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';

const WINDOW_START = 6;
const WINDOW_END = 21;

function pacificHour(): number {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false,
  }).format(new Date());
  const h = parseInt(s, 10);
  return h === 24 ? 0 : h;
}

/** Today's date (YYYY-MM-DD) in America/Los_Angeles — the reminder anchor. */
function pacificToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

const WINDOW_COPY: Record<string, string> = {
  three_days_before: 'is due in 3 days',
  day_before: 'is due tomorrow',
  day_after: 'was due yesterday',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isVercelCron = req.headers['x-vercel-cron'] !== undefined;
  if (req.method !== 'POST' && !(req.method === 'GET' && isVercelCron)) {
    return res.status(405).json({ error: 'method not allowed' });
  }
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const secret = process.env.CRON_SECRET;
  const isManualRun = Boolean(secret && bearer && bearer === secret);
  if (!isVercelCron && !isManualRun) return res.status(401).json({ error: 'unauthorized' });

  const hour = pacificHour();
  if (hour < WINDOW_START || hour >= WINDOW_END) {
    return res.status(200).json({ skipped: 'outside 6am-9pm PT window', hour });
  }

  try {
    const db = getSupabaseAdmin();
    const today = pacificToday();

    const { data: dueRaw, error: dueErr } = await db.rpc('billing_due_reminders', { p_today: today });
    if (dueErr) throw dueErr;
    const due = (dueRaw ?? []) as Array<{
      schedule_id: string; org_id: string; client_id: string;
      amount: number; due_date: string; window_kind: string; mode: string;
    }>;

    // Resolve each client's contact email (client → contact).
    const clientIds = [...new Set(due.map((d) => d.client_id))];
    const emailByClient = new Map<string, { email: string | null; name: string | null }>();
    if (clientIds.length) {
      const { data: clientRows } = await db
        .from('clients')
        .select('id, contact:contacts(first_name, last_name, email)')
        .in('id', clientIds);
      for (const c of (clientRows ?? []) as unknown as Array<{
        id: string; contact: { first_name: string | null; last_name: string | null; email: string | null } | null;
      }>) {
        emailByClient.set(c.id, {
          email: c.contact?.email ?? null,
          name: [c.contact?.first_name, c.contact?.last_name].filter(Boolean).join(' ') || null,
        });
      }
    }

    let emailed = 0;
    for (const d of due) {
      const who = emailByClient.get(d.client_id);
      if (!who?.email || !d.org_id) continue;
      try {
        const identity = await resolveTenantEmailIdentity(db, d.org_id);
        const when = WINDOW_COPY[d.window_kind] ?? 'is coming up';
        const amount = `$${Number(d.amount).toFixed(2)}`;
        const action = d.mode === 'self_recurring'
          ? `Please send your Zelle payment of <strong>${amount}</strong>.`
          : `We'll send you a Zelle request for <strong>${amount}</strong>.`;
        const sent = await sendViaProvider({
          to: who.email,
          fromName: identity.fromName,
          fromEmail: identity.fromEmail,
          subject: `Payment reminder — ${identity.fromName}`,
          html:
            `<p>${who.name ? `Hi ${who.name},` : 'Hello,'}</p>` +
            `<p>Your ${amount} payment ${when} (${new Date(d.due_date + 'T00:00:00').toLocaleDateString()}).</p>` +
            `<p>${action}</p>` +
            (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>` : ''),
        });
        if (sent.ok) emailed += 1;
      } catch { /* best-effort per recipient */ }
    }

    return res.status(200).json({ due: due.length, emailed, hour, today });
  } catch (err) {
    console.error('payment-watch error', err);
    return res.status(500).json({ error: 'payment-watch failed' });
  }
}
