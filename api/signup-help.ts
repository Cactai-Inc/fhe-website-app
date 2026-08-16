/* POST /api/signup-help — TASK ONBOARD §3, the "I never received it" escape hatch.
 *
 * Owner: "below that is a link they can click if they never received it and it
 * notifies us, that link being clicked prints a confirmation that customer support
 * was notified and will reach out to them. When that link is clicked I need to
 * receive an in app dashboard notice AND an email telling me what happened,
 * hopefully an error code for the email not sending or something."
 *
 * Body: { attemptId }  — the opaque signup_attempts id the send-state screen holds.
 *   It carries NO address: the escalation can only ever describe the attempt it
 *   names, and the endpoint never accepts an email from the caller.
 * -> 200 { ok: true, notified: boolean }
 *
 * `notified` is the truth, not a hope. THREE things are recorded, in this order:
 *   1. claim_signup_help_alert() stamps the attempt and inserts the in-app
 *      dashboard notice for every staff account (once — repeat clicks do not
 *      re-notify, but they do retry the email).
 *   2. the email goes to the tenant ops inbox, using the SIGNUP_EMAIL_HELP
 *      template the owner can edit without a developer (D13).
 *   3. record_signup_alert_send() writes one row per attempt, succeeded or not.
 *
 * That third step is the whole point. LESSONS.md: an inbound-lead alert with no
 * send row and a best-effort 200 is how two real leads were lost, and the person
 * on the other end had no way to know. A support escalation nobody can prove
 * happened is the same failure wearing a different hat.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
}

interface HelpClaim {
  found: boolean;
  first?: boolean;
  org_id?: string | null;
  email?: string;
  name?: string | null;
  phone?: string | null;
  path?: string | null;
  invitation_id?: string | null;
  diagnostic?: string;
  attempted_at?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: { attemptId?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const attemptId = (body.attemptId ?? '').trim();
  if (!UUID_RE.test(attemptId)) return res.status(400).json({ error: 'attemptId required' });

  try {
    const db = getSupabaseAdmin();

    const { data, error } = await db.rpc('claim_signup_help_alert', { p_attempt_id: attemptId });
    if (error) throw error;
    const claim = (Array.isArray(data) ? data[0] : data) as HelpClaim | null;
    // An unknown id is not an error the visitor can act on, and answering
    // differently for a real id would make this an oracle. The dashboard notice
    // is the honest signal for anything that did resolve.
    if (!claim?.found) return res.status(200).json({ ok: true, notified: false });

    const orgId = claim.org_id ?? null;
    if (!orgId) return res.status(200).json({ ok: true, notified: false });

    const identity = await resolveTenantEmailIdentity(db, orgId);
    const to = identity.opsInbox || identity.contactEmail;
    const who = claim.name || claim.email || 'Someone';
    const origin = req.headers.origin || `https://${req.headers.host}`;

    let sent: { ok: boolean; messageId?: string | null; error?: string } = {
      ok: false, error: 'no ops inbox configured',
    };

    if (to) {
      const rendered = await renderEmailTemplate(db, 'SIGNUP_EMAIL_HELP', {
        'ORG.FOOTER_HTML': identity.footer ? esc(identity.footer) : '',
        'MSG.WHO': who,
        'MSG.WHO_HTML': esc(who),
        'MSG.EMAIL_HTML': esc(claim.email ?? ''),
        'MSG.PHONE_HTML': claim.phone ? esc(claim.phone) : '',
        'MSG.PATH_HTML': claim.path ? esc(claim.path) : '',
        'MSG.DIAGNOSTIC_HTML': esc(claim.diagnostic ?? 'no diagnostic recorded'),
        'MSG.INVITATION_ID': claim.invitation_id ?? '',
        'MSG.ATTEMPTED_AT_HTML': esc(claim.attempted_at ?? ''),
        'MSG.LINK': `${identity.siteUrl ?? origin}/app/dashboard`,
      });
      sent = rendered
        ? await sendViaProvider({
            to,
            fromName: identity.fromName,
            fromEmail: identity.fromEmail || to,
            subject: rendered.subject,
            html: rendered.html,
          })
        : { ok: false, error: 'SIGNUP_EMAIL_HELP template missing or deactivated' };
    }

    // One row per attempt. A retry is a NEW row, not an overwrite — the key
    // carries the attempt count so the trail shows every try.
    try {
      const { count } = await db
        .from('signup_alert_sends')
        .select('id', { count: 'exact', head: true })
        .eq('attempt_id', attemptId);
      await db.rpc('record_signup_alert_send', {
        p_attempt_id: attemptId,
        p_key: `signup-help:${attemptId}:${(count ?? 0) + 1}`,
        p_recipient: to ?? null,
        p_ok: sent.ok,
        p_error: sent.ok ? null : (sent.error ?? 'send failed'),
        p_message_id: sent.messageId ?? null,
      });
    } catch (logErr) {
      console.error('signup-help: could not record the alert send', logErr);
    }

    // The in-app notice landed even if the mail did not, so the visitor is told
    // the truth about the notification as a whole, not just about the email.
    return res.status(200).json({ ok: true, notified: true, emailed: sent.ok });
  } catch (err) {
    console.error('signup-help error', err);
    return res.status(200).json({ ok: true, notified: false });
  }
}
