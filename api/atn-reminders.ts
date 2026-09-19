/* GET/POST /api/atn-reminders — the hourly task-reminder sweep (TASK-ATN Stage 4).
 *
 * Fires due task reminders into the dashboard (alerts) and email (notifications)
 * surfaces the author configured, then stamps/advances them: a one-time reminder
 * fires once, a recurring one re-fires every value·unit. All the logic is in
 * fire_due_task_reminders(); this endpoint is the scheduler's door onto it.
 *
 * Auth: Vercel cron (x-vercel-cron) or Bearer CRON_SECRET for manual runs.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { authorizeCronRequest } from './_lib/cronAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = authorizeCronRequest(req);
  if (req.method !== 'POST' && !(req.method === 'GET' && auth.isVercelCron)) {
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!auth.ok) return res.status(401).json({ error: auth.reason ?? 'unauthorized' });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('fire_due_task_reminders');
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ fired: data ?? 0 });
}
