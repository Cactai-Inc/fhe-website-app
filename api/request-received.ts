/* POST /api/request-received — email the barn when a website visitor submits an
 * inquiry/request. Called by the PUBLIC intake form right after the
 * submit_public_request RPC returns (that RPC already inserts the request and
 * fires the in-app staff notification; this adds the email so the owners hear
 * about it even when they're not in the app).
 *
 * Anonymous endpoint (the intake form has no auth). It does NOT trust the caller
 * for anything sensitive: it emails only the tenant's own configured contact
 * address (CONTACT.EMAIL, e.g. hello@fhequestrian.com), never an address from the
 * request body. Body is used only to render the notice. Best-effort: any failure
 * returns 200 { emailed:false } so a mail hiccup never blocks the visitor's
 * submission (which already succeeded).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: {
    orgId?: string; requestId?: string;
    name?: string; email?: string; phone?: string;
    notes?: string; category?: string; channel?: string;
  };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }

  try {
    const db = getSupabaseAdmin();

    // Resolve the tenant. Prefer the request's org (looked up by id, never trusted
    // from the body's orgId); fall back to the sole org for this single-tenant app.
    let orgId: string | null = null;
    if (body.requestId) {
      const { data: r } = await db
        .from('requests').select('org_id').eq('id', body.requestId).maybeSingle();
      orgId = (r?.org_id as string | undefined) ?? null;
    }
    if (!orgId) {
      const { data: orgs } = await db.from('organizations').select('id').limit(2);
      if (orgs && orgs.length === 1) orgId = orgs[0].id as string;
    }
    if (!orgId) return res.status(200).json({ ok: true, emailed: false, reason: 'org not resolved' });

    const identity = await resolveTenantEmailIdentity(db, orgId);
    const to = identity.contactEmail; // the tenant's own published contact address
    if (!to) return res.status(200).json({ ok: true, emailed: false, reason: 'no contact email configured' });

    const name = (body.name || '').trim() || 'A visitor';
    const rows: string[] = [];
    if (body.email) rows.push(`<li><strong>Email:</strong> ${esc(body.email)}</li>`);
    if (body.phone) rows.push(`<li><strong>Phone:</strong> ${esc(body.phone)}</li>`);
    if (body.category) rows.push(`<li><strong>Interested in:</strong> ${esc(body.category)}</li>`);
    if (body.channel) rows.push(`<li><strong>Via:</strong> ${esc(body.channel)}</li>`);
    const notes = (body.notes || '').trim();

    const sent = await sendViaProvider({
      to,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail || to,
      subject: `New inquiry from ${name}`,
      html:
        `<p><strong>${esc(name)}</strong> just submitted an inquiry on the website.</p>` +
        (rows.length ? `<ul style="padding-left:18px">${rows.join('')}</ul>` : '') +
        (notes ? `<p style="white-space:pre-line;border-left:3px solid #ddd;padding-left:12px;color:#333">${esc(notes)}</p>` : '') +
        `<p><a href="https://fhequestrian.com/app/ops/intake">Open the Request Inbox</a> to reply.</p>` +
        (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${esc(identity.footer)}</p>` : ''),
    });

    if (!sent.ok) return res.status(200).json({ ok: true, emailed: false, reason: sent.error ?? 'send failed' });
    return res.status(200).json({ ok: true, emailed: true });
  } catch (err) {
    console.error('request-received error', err);
    // best-effort: never fail the visitor's submission over a mail error
    return res.status(200).json({ ok: true, emailed: false, reason: 'internal error' });
  }
}
