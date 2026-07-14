/* POST /api/contract-invite — issue + email a contract-counterparty invitation
 * (Update A, spec G). Staff-only (Bearer token). Body: { documentId, contactId,
 * email }. Calls invite_contract_counterparty (service role) then emails the
 * branded register link carrying the token; the register flow redeems it via
 * redeem_contract_invitation and lands the counterparty on the contract. */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ error: 'unauthorized' });

  let body: { documentId?: string; partyRole?: string; email?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const { documentId, partyRole, email } = body;
  if (!documentId || !partyRole || !email) {
    return res.status(400).json({ error: 'documentId, partyRole and email are required' });
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

    // the document must belong to the caller's org
    const { data: doc } = await db
      .from('documents').select('org_id, title').eq('id', documentId).maybeSingle();
    if (!doc || doc.org_id !== profile?.org_id) {
      return res.status(404).json({ error: 'document not found in your organization' });
    }

    // resolve the document party contact for the requested role
    const { data: party } = await db
      .from('document_parties')
      .select('contact_id')
      .eq('document_id', documentId)
      .eq('party_role', partyRole.toUpperCase())
      .maybeSingle();
    if (!party?.contact_id) {
      return res.status(404).json({ error: `no ${partyRole} party on this contract` });
    }

    // Invitation language derives from THIS party's document controls + whether
    // any of their fields still need filling — never promise an action the
    // controls don't allow.
    const { data: ctrl } = await db
      .from('document_party_controls')
      .select('can_fill, can_edit_deal, can_suggest')
      .eq('document_id', documentId).eq('party_role', partyRole.toUpperCase())
      .maybeSingle();
    const { data: unfilled } = await db
      .from('contract_fields')
      .select('id')
      .eq('document_id', documentId).eq('owner_role', partyRole.toUpperCase())
      .or('value.is.null,value.eq.');
    const canFill = ctrl?.can_fill ?? true;
    const needsInfo = canFill && (unfilled?.length ?? 0) > 0;
    const actions: string[] = [];
    if (needsInfo) actions.push('add your information');
    if (ctrl?.can_edit_deal) actions.push('review and edit the terms');
    else if (ctrl?.can_suggest) actions.push('review and suggest changes');
    else actions.push('review the terms');
    const actionPhrase = `${actions.join(', ')}, and sign`;

    const { data: inv, error: invErr } = await db.rpc('invite_contract_counterparty', {
      p_document_id: documentId, p_contact_id: party.contact_id, p_email: email,
    });
    if (invErr) return res.status(400).json({ error: invErr.message });
    const token = (inv as { token: string }).token;

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const link = `${origin}/activate?token=${token}&kind=contract`;
    let identity = { fromName: 'French Heritage Equestrian', fromEmail: '', footer: '' as string | null };
    try { identity = await resolveTenantEmailIdentity(db, doc.org_id); } catch { /* fall back */ }

    const sent = await sendViaProvider({
      to: email,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: `A contract is ready for you — ${identity.fromName}`,
      html:
        `<p>Hello,</p>` +
        `<p><strong>${doc.title ?? 'A contract'}</strong> has been prepared for you.</p>` +
        `<p><a href="${link}">Open the contract</a> — sign in with Google if this is a Gmail address, ` +
        `or set a password with this email. You'll land directly on the contract to ${actionPhrase}.</p>` +
        `<p style="color:#666;font-size:12px">This link is personal to ${email} and expires in 14 days.<br/>${link}</p>` +
        (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>` : ''),
    });
    if (!sent.ok) return res.status(502).json({ error: 'could not send the invitation email' });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('contract-invite error', err);
    return res.status(500).json({ error: 'could not send the invitation' });
  }
}
