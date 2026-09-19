/* GET/POST /api/atn-weekly-digest — the Monday-morning digest (TASK-ATN Stage 4).
 *
 * Emails each staff member their own alert + task lists for the week, with no
 * overlap: a task that has an alert appears only in the alert list (owner). The
 * composition lives in weekly_digest(user_id); this endpoint resolves recipients,
 * renders a plain list, and sends via the tenant mailer. Skips a person with an
 * empty digest. Scheduled Monday ~08:00 PT; also runnable on demand.
 *
 * Auth: Vercel cron (x-vercel-cron) or Bearer CRON_SECRET for manual runs.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { authorizeCronRequest } from './_lib/cronAuth.js';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function list(items: string[]): string {
  if (items.length === 0) return '<p style="color:#6b7280">Nothing here.</p>';
  return '<ul>' + items.map((i) => `<li>${escapeHtml(i)}</li>`).join('') + '</ul>';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = authorizeCronRequest(req);
  if (req.method !== 'POST' && !(req.method === 'GET' && auth.isVercelCron)) {
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!auth.ok) return res.status(401).json({ error: auth.reason ?? 'unauthorized' });

  const admin = getSupabaseAdmin();
  const { data: orgs, error: orgErr } = await admin
    .from('organizations').select('id').is('deleted_at', null);
  if (orgErr) return res.status(500).json({ error: orgErr.message });

  let sent = 0;
  for (const org of (orgs ?? []) as { id: string }[]) {
    const identity = await resolveTenantEmailIdentity(admin, org.id);
    if (!identity.fromEmail) continue;
    const { data: staff } = await admin.rpc('org_staff_user_ids', { p_org_id: org.id });
    for (const s of ((staff ?? []) as { user_id: string }[])) {
      const { data: digest } = await admin.rpc('weekly_digest', { p_user_id: s.user_id });
      const alerts = (digest?.alerts ?? []) as string[];
      const tasks = (digest?.tasks ?? []) as string[];
      if (alerts.length === 0 && tasks.length === 0) continue;   // nothing to say
      const { data: u } = await admin.auth.admin.getUserById(s.user_id);
      const to = u?.user?.email;
      if (!to) continue;
      const html = `<h2>Your week</h2>`
        + `<h3>Alerts</h3>${list(alerts)}`
        + `<h3>Tasks</h3>${list(tasks)}`
        + identity.footer;
      const r = await sendViaProvider({
        to, fromName: identity.fromName, fromEmail: identity.fromEmail,
        subject: 'Your week — alerts and tasks', html,
      });
      if (r.ok) sent += 1;
    }
  }
  return res.status(200).json({ sent });
}
