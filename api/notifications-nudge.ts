/* POST /api/notifications-nudge  (also GET when invoked by Vercel cron)
 * Server-only. The email nudge for the notifications spine (BOOKING_FLOWS_PLAN
 * §1 Messaging decision: notifications table + email nudge): members with unread
 * in-app notifications get ONE tenant-branded digest email so nothing is missed
 * off-app. Scheduled daily via vercel.json crons (16:00 UTC ≈ 9am Pacific).
 *
 * AUTH (no user session — this is a cron endpoint):
 *  - Vercel cron: the platform stamps the `x-vercel-cron` header on its
 *    invocations (GET, no custom auth) — presence of that header admits the call.
 *  - Manual runs: Authorization: Bearer ${CRON_SECRET} (env; only honored when
 *    CRON_SECRET is actually set).
 *  - Anything else -> 401.
 *
 * SELECTION: notifications with read_at IS NULL AND emailed_at IS NULL AND
 * created_at < now() - 30 minutes (grace: someone reading in-app right now
 * doesn't get emailed about what they just saw). Per user the digest lists at
 * most 10 titles (newest first); the rest roll into the next run.
 *
 * ONE DIGEST PER USER, branded from the user's org via the value registry
 * (resolveTenantEmailIdentity — never a hardcoded tenant name). emailed_at is
 * stamped ONLY after a successful send, and each user is handled in their own
 * try/catch so one failure never blocks the rest.
 *
 * -> 200 { users_nudged, notifications_marked }
 * -> 401 unauthenticated, 405 bad method, 5xx when the pending scan fails.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider, type TenantEmailIdentity } from './_lib/email.js';

const GRACE_MINUTES = 30;
const PER_USER_CAP = 10;

interface PendingNotification {
  id: string;
  user_id: string;
  org_id: string | null;
  title: string;
  created_at: string;
}

/** Notification titles land in HTML — escape them (they may echo user input). */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel cron invokes with GET + the x-vercel-cron header; manual runs POST.
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

    // Contract reminder sweep runs with the daily nudge: locked-but-unsigned
    // follow-ups, approaching lease starts, approaching lease expirations.
    // Failures never block the digest.
    try { await db.rpc('contract_reminder_sweep'); } catch { /* sweep is best-effort */ }

    // Lease-expiry producer (Update A, spec H.11): inserts 'lease_expiring'
    // notifications for lessees/owners 30/7/1 days before lease_end. The rows it
    // creates ride the same email nudge below on the next pass. Best-effort.
    try { await db.rpc('lease_expiry_nudge'); } catch { /* producer is optional */ }

    // App root for the CTA link — same origin source as the invite register URL
    // (admin-send-invitation): the request's origin/host, correct per deployment.
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const appUrl = `${origin}/app`;

    // Pending = unread, never emailed, and older than the grace window.
    const cutoff = new Date(Date.now() - GRACE_MINUTES * 60_000).toISOString();
    const { data: pendingRaw, error: scanErr } = await db
      .from('notifications')
      .select('id, user_id, org_id, title, created_at')
      .is('read_at', null)
      .is('emailed_at', null)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: false });
    if (scanErr) throw scanErr;
    const pending = (pendingRaw ?? []) as PendingNotification[];

    // Group per user (rows arrive newest-first; the cap keeps the newest 10).
    const byUser = new Map<string, PendingNotification[]>();
    for (const row of pending) {
      const list = byUser.get(row.user_id) ?? [];
      if (list.length < PER_USER_CAP) list.push(row);
      byUser.set(row.user_id, list);
    }

    // Brand identity resolves once per org, not once per user.
    const identityByOrg = new Map<string, TenantEmailIdentity>();

    let usersNudged = 0;
    let notificationsMarked = 0;

    for (const [userId, digest] of byUser) {
      // Per-user fence: one user's failure must not block the others.
      try {
        const { data: profile, error: profErr } = await db
          .from('profiles')
          .select('email, org_id')
          .eq('user_id', userId)
          .maybeSingle();
        if (profErr) throw profErr;
        const email = (profile?.email as string | null | undefined)?.trim();
        if (!email) continue; // no address on file -> nothing to nudge

        const orgId = (profile?.org_id as string | null | undefined) || digest[0].org_id;
        if (!orgId) continue; // cannot resolve a brand -> skip, retry next run

        let identity = identityByOrg.get(orgId);
        if (!identity) {
          identity = await resolveTenantEmailIdentity(db, orgId);
          identityByOrg.set(orgId, identity);
        }

        const n = digest.length;
        const subject = `You have ${n} ${n === 1 ? 'update' : 'updates'} at ${identity.fromName}`;
        const items = digest.map((r) => `<li>${escapeHtml(r.title)}</li>`).join('');
        const footerHtml = identity.footer
          ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
          : '';
        const html =
          `<p>Here's what's waiting for you at ${identity.fromName}:</p>` +
          `<ul>${items}</ul>` +
          `<p><a href="${appUrl}">Open the app to catch up</a></p>` +
          footerHtml;

        const sent = await sendViaProvider({
          to: email,
          fromName: identity.fromName,
          fromEmail: identity.fromEmail,
          subject,
          html,
        });
        if (!sent.ok) continue; // failed send -> emailed_at stays NULL (retry next run)

        // Mark ONLY after the successful send — the digest's rows, no others.
        const ids = digest.map((r) => r.id);
        const { error: markErr } = await db
          .from('notifications')
          .update({ emailed_at: new Date().toISOString() })
          .in('id', ids);
        if (markErr) throw markErr;

        usersNudged += 1;
        notificationsMarked += ids.length;
      } catch (err) {
        console.error(`notifications-nudge: user ${userId} failed`, err);
      }
    }

    return res.status(200).json({ users_nudged: usersNudged, notifications_marked: notificationsMarked });
  } catch (err) {
    console.error('notifications-nudge error', err);
    return res.status(500).json({ error: 'could not run notification nudge' });
  }
}
