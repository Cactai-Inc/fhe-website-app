/* GET/POST /api/calendar-reminders — the hourly calendar sweep (Phase 6).
 *
 * Two jobs each run:
 *  1. calendar_reminder_sweep() — inserts the 1h + 2h in-app reminders for
 *     upcoming bookings and stamps them so they fire once.
 *  2. Emails the un-emailed calendar notifications (kind LIKE 'booking_%') to
 *     each recipient right away (the daily notifications-nudge is too slow for
 *     reminders), with a copy of every reminder to hello@fhequestrian.com so the
 *     shared ops inbox sees all upcoming calendar items.
 *
 * WINDOW: emails only 06:00–21:00 America/Los_Angeles (the in-app rows are
 * still written outside the window; we just don't email overnight).
 * AUTH: Vercel cron (x-vercel-cron) or Bearer CRON_SECRET for manual runs.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider, type TenantEmailIdentity } from './_lib/email.js';

const OPS_INBOX = 'hello@fhequestrian.com';
const WINDOW_START = 6;
const WINDOW_END = 21;
const PER_USER_CAP = 10;

function pacificHour(): number {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }).format(new Date());
  const h = parseInt(s, 10);
  return h === 24 ? 0 : h;
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface Row { id: string; user_id: string; org_id: string | null; kind: string; title: string; }

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

    // 1. write the due reminders (best-effort).
    let swept: unknown = null;
    try { const { data } = await db.rpc('calendar_reminder_sweep'); swept = data; } catch (e) { console.error('reminder sweep', e); }

    // Outside the email window: rows are written, we just skip sending.
    const hour = pacificHour();
    if (hour < WINDOW_START || hour >= WINDOW_END) {
      return res.status(200).json({ swept, emailed: 0, window: 'closed' });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const appUrl = `${origin}/app/calendar`;

    // 2. email un-emailed calendar notifications immediately.
    const { data: rowsRaw, error } = await db
      .from('notifications')
      .select('id, user_id, org_id, kind, title')
      .is('emailed_at', null)
      .like('kind', 'booking_%')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (rowsRaw ?? []) as Row[];

    const byUser = new Map<string, Row[]>();
    for (const r of rows) {
      const list = byUser.get(r.user_id) ?? [];
      if (list.length < PER_USER_CAP) list.push(r);
      byUser.set(r.user_id, list);
    }

    const identityByOrg = new Map<string, TenantEmailIdentity>();
    const opsDigest: string[] = [];
    let emailed = 0;

    for (const [userId, digest] of byUser) {
      try {
        const { data: profile } = await db.from('profiles').select('email, org_id').eq('user_id', userId).maybeSingle();
        const email = (profile?.email as string | null | undefined)?.trim();
        const orgId = (profile?.org_id as string | null | undefined) || digest[0].org_id;
        if (!orgId) continue;

        let identity = identityByOrg.get(orgId);
        if (!identity) { identity = await resolveTenantEmailIdentity(db, orgId); identityByOrg.set(orgId, identity); }

        // collect reminder titles for the shared ops inbox copy
        for (const r of digest) if (r.kind.startsWith('booking_reminder')) opsDigest.push(escapeHtml(r.title));

        if (email) {
          const items = digest.map((r) => `<li>${escapeHtml(r.title)}</li>`).join('');
          const html = `<p>Calendar update from ${identity.fromName}:</p><ul>${items}</ul>` +
            `<p><a href="${appUrl}">Open your calendar</a></p>` +
            (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>` : '');
          const sent = await sendViaProvider({ to: email, fromName: identity.fromName, fromEmail: identity.fromEmail, subject: `Calendar update — ${identity.fromName}`, html });
          if (!sent.ok) continue;
        }

        await db.from('notifications').update({ emailed_at: new Date().toISOString() }).in('id', digest.map((r) => r.id));
        emailed += digest.length;
      } catch (err) {
        console.error(`calendar-reminders: user ${userId} failed`, err);
      }
    }

    // one consolidated reminder copy to the shared ops inbox
    if (opsDigest.length > 0) {
      const first = identityByOrg.values().next().value as TenantEmailIdentity | undefined;
      if (first?.fromEmail) {
        try {
          const uniq = Array.from(new Set(opsDigest));
          await sendViaProvider({
            to: OPS_INBOX, fromName: first.fromName, fromEmail: first.fromEmail,
            subject: `Upcoming sessions (${uniq.length})`,
            html: `<p>Upcoming calendar items:</p><ul>${uniq.map((t) => `<li>${t}</li>`).join('')}</ul>`,
          });
        } catch (e) { console.error('ops inbox copy', e); }
      }
    }

    return res.status(200).json({ swept, emailed });
  } catch (err) {
    console.error('calendar-reminders error', err);
    return res.status(500).json({ error: 'could not run calendar reminders' });
  }
}
