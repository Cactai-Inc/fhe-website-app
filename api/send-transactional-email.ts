/* POST /api/send-transactional-email
 * Server-only. Sends a tenant-branded transactional email (signup, contract
 * executed, receipt, dunning, ...). The tenant's from-name, legal footer, and
 * public contact resolve from the value registry (config_values / business_config)
 * scoped to orgId, so one config write propagates to every email that tenant sends.
 *
 * Body: { to, template, vars?, orgId }
 * -> 200 { messageId, from } on success
 * -> 400 on a missing/invalid `to`, `template`, or `orgId`
 * -> 5xx when the provider fails (never throws uncaught)
 *
 * There is NO hardcoded tenant from-address here: the display name comes from the
 * registry (BRAND.NAME) and the address from an env/registry value (§15 isolation).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { resolveTenantEmailIdentity, sendViaProvider, renderTemplate } from './_lib/email';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  const to = (typeof body.to === 'string' ? body.to : '').trim();
  const template = (typeof body.template === 'string' ? body.template : '').trim();
  const orgId = (typeof body.orgId === 'string' ? body.orgId : '').trim();
  const vars = (body.vars && typeof body.vars === 'object' ? body.vars : {}) as Record<string, unknown>;

  if (!to) return res.status(400).json({ error: 'to required' });
  if (!template) return res.status(400).json({ error: 'template required' });
  if (!orgId) return res.status(400).json({ error: 'orgId required' });

  try {
    const db = getSupabaseAdmin();

    // Resolve tenant-branded identity from the registry, scoped to this org.
    const identity = await resolveTenantEmailIdentity(db, orgId);

    const { subject, body: inner } = renderTemplate(template, vars, identity.fromName);
    const footerHtml = identity.footer
      ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
      : '';
    const html = `${inner}${footerHtml}`;

    const sent = await sendViaProvider({
      to,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject,
      html,
    });

    if (!sent.ok) {
      return res.status(502).json({ error: sent.error || 'email delivery failed' });
    }

    return res.status(200).json({
      messageId: sent.messageId,
      from: `${identity.fromName} <${identity.fromEmail}>`,
    });
  } catch (err) {
    console.error('send-transactional-email error', err);
    return res.status(500).json({ error: 'could not send email' });
  }
}
