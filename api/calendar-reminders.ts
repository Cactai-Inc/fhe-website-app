/* GET/POST /api/calendar-reminders — the hourly calendar sweep (Phase 6).
 *
 * ⚠️ TWO CALENDAR EMAILS EXIST, AND ADMIN GETS NEITHER (owner, 2026-08-26:
 * "I dont want admin getting calendar update or notification emails, and we only
 *  need the daily one at the start of the day and then the one that is sent 1 hour
 *  prior to start time. they go to hello@fhequestrian.com, and the client gets the
 *  1 hour prior notification only.")
 *
 *   THE 1-HOUR NOTICE   → the client, and a consolidated copy to the ops inbox
 *   THE START OF DAY    → the ops inbox only, once, at 07:00 Pacific
 *
 * The 2-hour reminder is retired (migration 20260826T1700), and the sweep no
 * longer calls notify_staff — that was fanning every reminder out to EVERY admin
 * profile, which is how admin@fhequestrian.com came to be emailed about every
 * session. The per-user loop below independently skips staff accounts, so a stray
 * booking_* notification written by some other path cannot reintroduce it.
 *
 * Jobs each run:
 *  1. calendar_reminder_sweep() — the 1h in-app reminder, stamped so it fires once.
 *  2. Emails un-emailed calendar notifications (kind LIKE 'booking_%') to MEMBERS,
 *     with one consolidated copy to the ops inbox.
 *  3. At 07:00 Pacific only: the day sheet to the ops inbox.
 *
 * WINDOW: emails only 06:00–21:00 America/Los_Angeles (the in-app rows are
 * still written outside the window; we just don't email overnight).
 * AUTH: Vercel cron (x-vercel-cron) or Bearer CRON_SECRET for manual runs.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider, type TenantEmailIdentity } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';
import { authorizeCronRequest } from './_lib/cronAuth.js';

/** 5d: the ops inbox is org-level config (CONTACT/OPS_INBOX_FALLBACK), not a constant.
 *  The literal below is only the last-resort fallback when config is absent. */
const OPS_INBOX_FALLBACK = 'hello@fhequestrian.com';
/** 07:00 America/Los_Angeles — the start-of-day rundown. */
const DAY_SHEET_HOUR = 7;
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
  // One shared rule for all five scheduled endpoints — see api/_lib/cronAuth.ts.
  const auth = authorizeCronRequest(req);
  const isVercelCron = auth.isVercelCron;
  if (req.method !== 'POST' && !(req.method === 'GET' && isVercelCron)) {
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!auth.ok) return res.status(401).json({ error: auth.reason ?? 'unauthorized' });

  try {
    const db = getSupabaseAdmin();

    // 1. write the due reminders (best-effort): booking 1h/2h + lease start/expiry.
    let swept: unknown = null;
    try { const { data } = await db.rpc('calendar_reminder_sweep'); swept = data; } catch (e) { console.error('reminder sweep', e); }
    try { await db.rpc('lease_reminder_sweep'); } catch (e) { console.error('lease sweep', e); }
    // Keep 4 weeks of bookable open slots published from business hours at
    // all times (idempotent; also republishes hours freed by cancellations
    // within the hour). Best-effort like the sweeps above.
    try { await db.rpc('publish_open_slots_all', { p_weeks: 4, p_slot_minutes: 60 }); } catch (e) { console.error('open-slot publish', e); }

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
      .or('kind.like.booking_%,kind.like.lease_%')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (rowsRaw ?? []) as Row[];

    const byUser = new Map<string, Row[]>();
    for (const r of rows) {
      const list = byUser.get(r.user_id) ?? [];
      if (list.length < PER_USER_CAP) list.push(r);
      byUser.set(r.user_id, list);
    }

    /* ⚠️ STAFF ARE NOT EMAILED INDIVIDUALLY. `notify_staff` writes an in-app row
       to every ADMIN/MANAGER/EMPLOYEE/OWNER profile, and this loop would turn each
       of those into an email — which is the complaint. The in-app notification is
       left alone (it is useful in the app); only the EMAIL is withheld, and the
       shared inbox gets the consolidated copy below instead. */
    const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'EMPLOYEE', 'OWNER', 'SUPERADMIN', 'SUPER_ADMIN']);

    const identityByOrg = new Map<string, TenantEmailIdentity>();
    const opsDigest: string[] = [];
    let emailed = 0;

    for (const [userId, digest] of byUser) {
      try {
        const { data: profile } = await db.from('profiles').select('email, org_id, role').eq('user_id', userId).maybeSingle();
        const isStaff = STAFF_ROLES.has(String(profile?.role ?? '').toUpperCase());
        const email = isStaff ? undefined : (profile?.email as string | null | undefined)?.trim();
        const orgId = (profile?.org_id as string | null | undefined) || digest[0].org_id;
        if (!orgId) continue;

        let identity = identityByOrg.get(orgId);
        if (!identity) { identity = await resolveTenantEmailIdentity(db, orgId); identityByOrg.set(orgId, identity); }

        // collect reminder titles for the shared ops inbox copy
        for (const r of digest) if (r.kind.startsWith('booking_reminder')) opsDigest.push(escapeHtml(r.title));

        if (email) {
          const rendered = await renderEmailTemplate(db, 'CALENDAR_UPDATE', {
            'ORG.BRAND_NAME': identity.fromName,
            'ORG.FOOTER': identity.footer,
            'MSG.ITEMS': digest.map((r) => escapeHtml(r.title)),
            'MSG.LINK': appUrl,
          });
          // Same posture as a failed send: emailed_at stays NULL, next sweep retries.
          if (!rendered) continue;
          const sent = await sendViaProvider({ to: email, fromName: identity.fromName, fromEmail: identity.fromEmail, subject: rendered.subject, html: rendered.html });
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
          const rendered = await renderEmailTemplate(db, 'CALENDAR_OPS_DIGEST', {
            'MSG.COUNT': String(uniq.length),
            'MSG.ITEMS': uniq,
          });
          if (rendered) {
            await sendViaProvider({
              to: first.opsInbox ?? OPS_INBOX_FALLBACK, fromName: first.fromName, fromEmail: first.fromEmail,
              subject: rendered.subject, html: rendered.html,
            });
          }
        } catch (e) { console.error('ops inbox copy', e); }
      }
    }

    /* ── THE START OF DAY ──────────────────────────────────────────────────
       Gated on the Pacific hour rather than given its own cron entry, because the
       barn is on PDT most of the year and a UTC cron would drift an hour twice a
       year. The hourly sweep already knows what time it is where the horses are. */
    let daySheet: 'sent' | 'empty' | 'skipped' = 'skipped';
    if (hour === DAY_SHEET_HOUR) {
      try {
        /* ⚠️ THE ORG MUST BE PASSED. `ops_day_sheet` defaults to current_org(),
           which is NULL under the service role — so a cron call with no org would
           silently report an empty day. It is also the only reason this works on a
           quiet hour, when there are no notifications to borrow an org from. */
        const { data: orgRow } = await db
          .from('organizations').select('id').is('deleted_at', null)
          .order('created_at', { ascending: true }).limit(1).maybeSingle();
        const orgId = (orgRow?.id as string | undefined) ?? rows[0]?.org_id ?? null;
        if (!orgId) throw new Error('no organization to build a day sheet for');
        const { data: sheet } = await db.rpc('ops_day_sheet', { p_org: orgId });
        const items = ((sheet as { items?: { at: string; who: string; what: string; horse: string | null }[] } | null)?.items) ?? [];
        if (items.length === 0) {
          // A quiet day is not an email. Nothing to do is not news.
          daySheet = 'empty';
        } else {
          const ident = identityByOrg.get(orgId)
            ?? await resolveTenantEmailIdentity(db, orgId).catch(() => undefined);
          if (ident?.fromEmail) {
            const rendered = await renderEmailTemplate(db, 'CALENDAR_DAY_SHEET', {
              'MSG.DAY': String((sheet as { day?: string } | null)?.day ?? ''),
              'MSG.COUNT': String(items.length),
              'MSG.ITEMS': items.map((i) => escapeHtml(
                `${i.at} — ${i.what} — ${i.who}${i.horse ? ` (${i.horse})` : ''}`)),
            });
            if (rendered) {
              const sent = await sendViaProvider({
                to: ident.opsInbox ?? OPS_INBOX_FALLBACK, fromName: ident.fromName,
                fromEmail: ident.fromEmail, subject: rendered.subject, html: rendered.html,
              });
              daySheet = sent.ok ? 'sent' : 'skipped';
            }
          }
        }
      } catch (e) { console.error('day sheet', e); }
    }

    return res.status(200).json({ swept, emailed, daySheet });
  } catch (err) {
    console.error('calendar-reminders error', err);
    return res.status(500).json({ error: 'could not run calendar reminders' });
  }
}
