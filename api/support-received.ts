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
    const name = (profile?.display_name as string | undefined)
      || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
      || 'A member';

    const identity = await resolveTenantEmailIdentity(db, orgId);
    const to = identity.opsInbox || OPS_INBOX_FALLBACK;
    if (!to) return res.status(200).json({ ok: true, emailed: false, reason: 'no ops inbox configured' });

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const rows: string[] = [];
    if (profile?.email) rows.push(`<li><strong>Email:</strong> ${esc(profile.email as string)}</li>`);

    const sent = await sendViaProvider({
      to,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail || to,
      subject: `New website inquiry — ${name}`,
      html:
        `<p><strong>${esc(name)}</strong> just submitted a support request.</p>` +
        (rows.length ? `<ul style="padding-left:18px">${rows.join('')}</ul>` : '') +
        `<p><strong>Subject:</strong> ${esc(sr.subject as string)}</p>` +
        `<p style="white-space:pre-line;border-left:3px solid #ddd;padding-left:12px;color:#333">${esc(sr.body as string)}</p>` +
        `<p><a href="${identity.siteUrl ?? origin}/app/ops/support">Open Support</a> to reply.</p>` +
        (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${esc(identity.footer)}</p>` : ''),
    });

    if (!sent.ok) return res.status(200).json({ ok: true, emailed: false, reason: sent.error ?? 'send failed' });
    return res.status(200).json({ ok: true, emailed: true });
  } catch (err) {
    console.error('support-received error', err);
    return res.status(200).json({ ok: true, emailed: false, reason: 'internal error' });
  }
}
