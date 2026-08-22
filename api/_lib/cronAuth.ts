/* Shared authorization for the five scheduled endpoints.
 *
 * There were five byte-identical copies of this rule — delivery-sweep,
 * expire-holds, calendar-reminders, notifications-nudge,
 * mint-monthly-allotments — which is how the weakness below survived in all
 * five at once.
 *
 * THE WEAKNESS. The rule was `isVercelCron || isManualRun`, where
 * `isVercelCron` is nothing more than "the request carried an `x-vercel-cron`
 * header." A header is something any caller can send. This site is public and
 * these endpoints mint credits, expire holds, and send email; a request that
 * merely *claims* to be a cron should not be enough to fire them. Vercel's own
 * guidance is the same: verify CRON_SECRET, and treat the header as
 * informational.
 *
 * THE RULE NOW. If CRON_SECRET is configured, it is REQUIRED — a matching
 * bearer token, and the header alone will not do. If it is not configured,
 * behaviour is exactly what it was, so nothing breaks before the secret is set.
 * That ordering matters: the fix must not take the scheduler down between
 * deploying and setting the variable.
 *
 * Compatible with both schedulers. Vercel sends `Authorization: Bearer
 * $CRON_SECRET` on its own cron invocations whenever CRON_SECRET is set, and
 * `.github/workflows/scheduled-jobs.yml` sends the same header.
 */
import type { VercelRequest } from '@vercel/node';

export interface CronAuth {
  /** The request may run the job. */
  ok: boolean;
  /** The platform stamped its cron header — still used for the GET allowance. */
  isVercelCron: boolean;
  /** Why it was refused, for the 401 body. */
  reason?: string;
}

export function authorizeCronRequest(req: VercelRequest): CronAuth {
  const isVercelCron = req.headers['x-vercel-cron'] !== undefined;
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const secret = process.env.CRON_SECRET;

  if (secret) {
    // Configured: the secret is the only proof accepted.
    if (bearer && bearer === secret) return { ok: true, isVercelCron };
    return {
      ok: false,
      isVercelCron,
      reason: 'unauthorized',
    };
  }

  // Not configured: unchanged from before, so setting up the secret is a
  // deliberate step rather than a prerequisite for anything to keep working.
  return { ok: isVercelCron, isVercelCron, reason: isVercelCron ? undefined : 'unauthorized' };
}
