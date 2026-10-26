/* POST /api/contract-review-link — share a contract for REVIEW (fix round 3, item 5).
 *
 * Staff-only (Bearer token). Body: { documentId, email }.
 *
 * The read-only contract view is a share-for-review tool, not an invite path. This
 * endpoint issues a CONTRACT_VIEW token for ANY email address — a party or an
 * outside reviewer, with no contact required — and mails the CONTRACT_VIEW_INVITE
 * template, reworded as a review share (no activation language). The link stays
 * valid until a staff member revokes it; it is not killed by execution.
 *
 * This is deliberately NOT the party-invite path. Inviting a party to activate and
 * sign is /api/contract-invite; sharing a read-only copy for review is this.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ error: 'unauthorized' });

  let body: { documentId?: string; email?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const { documentId } = body;
  const email = (body.email ?? '').trim();
  if (!documentId || !email) {
    return res.status(400).json({ error: 'documentId and email are required' });
  }

  try {
    const db = getSupabaseAdmin();
    const { data: userData, error: userErr } = await db.auth.getUser(bearer);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('is_admin, role, org_id').eq('user_id', userData.user.id).maybeSingle();
    const isStaff = profile?.is_admin
      || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(profile?.role ?? '');
    if (!isStaff) return res.status(403).json({ error: 'forbidden' });

    const { data: doc } = await db
      .from('documents').select('org_id, title').eq('id', documentId).maybeSingle();
    if (!doc || doc.org_id !== profile?.org_id) {
      return res.status(404).json({ error: 'document not found in your organization' });
    }

    // Issue a CONTRACT_VIEW token for this email. No contact is required — a
    // reviewer who is not a party is the whole point of the share tool.
    const { data: viewTok, error: viewErr } = await db.rpc('issue_contract_view_token', {
      p_document_id: documentId, p_contact_id: null, p_email: email,
    });
    if (viewErr) return res.status(400).json({ error: viewErr.message });
    const issued = viewTok as { invitation_id: string; token: string };
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const viewUrl = `${origin}/contract/view?token=${issued.token}`;

    let identity = { fromName: 'French Heritage Equestrian', fromEmail: '', footer: '' as string | null };
    try { identity = await resolveTenantEmailIdentity(db, doc.org_id); } catch { /* fall back */ }

    const rendered = await renderEmailTemplate(db, 'CONTRACT_VIEW_INVITE', {
      'ORG.BRAND_NAME': identity.fromName,
      'ORG.FOOTER': identity.footer,
      'DOC.HAS_TITLE': doc.title != null ? '1' : '',
      'DOC.TITLE': doc.title ?? '',
      'MSG.LINK': viewUrl,
      'MSG.RECIPIENT_EMAIL': email,
    });
    if (!rendered) {
      return res.status(200).json({ ok: true, emailed: false, reason: 'the CONTRACT_VIEW_INVITE email template is missing or deactivated' });
    }
    const sent = await sendViaProvider({
      to: email,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: rendered.subject,
      html: rendered.html,
    });
    return res.status(200).json({
      ok: true, emailed: sent.ok, invitationId: issued.invitation_id,
      ...(sent.ok ? {} : { reason: 'email provider not configured or send failed' }),
    });
  } catch (err) {
    console.error('contract-review-link error', err);
    return res.status(500).json({ error: 'could not send the review link' });
  }
}
