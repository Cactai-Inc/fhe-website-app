/* POST /api/support-received — email the ops inbox when a member submits a
 * support request from /app/account. Called server-side by
 * submit_support_request via pg_net (net.http_post), right after it inserts
 * the support_requests row and fires the in-app staff notification — mirrors
 * api/request-received.ts, the same trigger the public intake form uses. Like
 * api/deliver-documents.ts (the other pg_net-triggered dispatch endpoint), the
 * caller is the database, not the browser, and carries no auth header; this
 * endpoint does not trust the body for anything sensitive — it looks the
 * support request up by id and only ever emails the tenant's own configured
 * ops inbox.
 *
 * Best-effort: any failure returns 200 { emailed:false } so a mail hiccup never
 * blocks the member's submission (which already succeeded).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';

const OPS_INBOX_FALLBACK = 'hello@fhequestrian.com';

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: { requestId?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  if (!body.requestId) return res.status(400).json({ error: 'requestId required' });

  try {
    const db = getSupabaseAdmin();

    const { data: sr } = await db
      .from('support_requests')
      .select('org_id, subject, body, user_id')
      .eq('id', body.requestId)
      .maybeSingle();
    if (!sr) return res.status(200).json({ ok: true, emailed: false, reason: 'support request not found' });

    const orgId = sr.org_id as string;
    const { data: profile } = await db
      .from('profiles')
      .select('display_name, first_name, last_name, email')
      .eq('user_id', sr.user_id as string)
      .maybeSingle();
    // Just the name — "A member" is wording and lives in the SUPPORT_RECEIVED row.
    const name = (profile?.display_name as string | undefined)
      || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
      || '';

    const identity = await resolveTenantEmailIdentity(db, orgId);
    const to = identity.opsInbox || OPS_INBOX_FALLBACK;
    if (!to) return res.status(200).json({ ok: true, emailed: false, reason: 'no ops inbox configured' });

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const rendered = await renderEmailTemplate(db, 'SUPPORT_RECEIVED', {
      'ORG.FOOTER_HTML': identity.footer ? esc(identity.footer) : '',
      'PARTY.FULL_NAME': name,
      'PARTY.FULL_NAME_HTML': name ? esc(name) : '',
      'PARTY.EMAIL_HTML': profile?.email ? esc(profile.email as string) : '',
      'MSG.SUBJECT_HTML': esc(sr.subject as string),
      'MSG.BODY_HTML': esc(sr.body as string),
      'MSG.LINK': `${identity.siteUrl ?? origin}/app/ops/support`,
    });
    if (!rendered) {
      return res.status(200).json({ ok: true, emailed: false, reason: 'SUPPORT_RECEIVED template missing' });
    }

    const sent = await sendViaProvider({
      to,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail || to,
      subject: rendered.subject,
      html: rendered.html,
    });

    if (!sent.ok) return res.status(200).json({ ok: true, emailed: false, reason: sent.error ?? 'send failed' });
    return res.status(200).json({ ok: true, emailed: true });
  } catch (err) {
    console.error('support-received error', err);
    return res.status(200).json({ ok: true, emailed: false, reason: 'internal error' });
  }
}
