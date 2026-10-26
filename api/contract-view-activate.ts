/* POST /api/contract-view-activate — the "Do it now" step of the contract-first
 * read-only view (STEP 4).
 *
 * A party who was sent a VIEW link (STEP 1) and chose "Do it now" on the activation
 * modal lands here with their view token. This endpoint turns that view token into
 * an ACTIVATION email for the SAME contract, so clicking the emailed link activates
 * their account and routes them to the contract — the existing claim flow.
 *
 * ⚠️ IT DOES NOT INVENT A SECOND CLAIM MECHANISM. It resolves the view token to the
 * contract party it already names (document + contact + email), and mints exactly
 * the invitation `api/contract-invite.ts` mints for that same party:
 *   HAS NO ACCOUNT → invite_contract_party_account → /activate?token (COMMUNITY).
 *   HAS AN ACCOUNT, NEVER ACTIVATED → invite_contract_counterparty → /activate?token&kind=contract.
 *   ALREADY ACTIVE → a "click here to sign in" email to /login (accountDoor), no token.
 * The branch on account state is the same one the /sign/* door and request-activation
 * use, through the shared _lib/accountDoor helper (D18 — one flow, one meaning).
 *
 * ⚠️ THE SEND TARGET IS THE PARTY EMAIL ON THE VIEW TOKEN, not the address typed in
 * the modal. The view link was issued to a specific contract party; the email is the
 * match key (D22). Honouring the typed address instead would let a stranger with a
 * leaked view link redirect the activation email, and comparing the two would make
 * this an enumeration oracle. The typed address is only a confirmation gesture; the
 * success screen echoes the party email we actually sent to.
 *
 * Body: { token }  — the CONTRACT_VIEW token from the view page.
 * -> 200 { ok, status, email } — `status` is the real send outcome
 *    ('sent' | 'send_failed' | 'unavailable'); `email` is the address we sent to,
 *    so the success screen can show it.
 * -> 400 on a missing/invalid token.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';
import { sendInvitationEmail, recordInvitationDelivery, type ChecklistRow } from './_lib/invitationEmail.js';
import { accountStateForEmail, sendSignInEmail, greetingNameForContact } from './_lib/accountDoor.js';

type SendStatus = 'sent' | 'send_failed' | 'unavailable';

interface ViewInvitation {
  document_id: string | null;
  contact_id: string | null;
  email: string;
  org_id: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: { token?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const token = (body.token || '').trim();
  if (!token) return res.status(400).json({ error: 'token required' });

  try {
    const db = getSupabaseAdmin();
    const origin = req.headers.origin || `https://${req.headers.host}`;

    // Resolve the view token to the contract party it names. A view token is the
    // only kind this endpoint honours; an activation/claim token resolves to
    // nothing here.
    const { data: inv } = await db
      .from('invitations')
      .select('document_id, contact_id, email, org_id')
      .eq('token', token)
      .eq('kind', 'CONTRACT_VIEW')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const v = inv as ViewInvitation | null;
    if (!v?.document_id || !v.email) {
      // Unknown or non-view token. Report a neutral unavailable rather than a 404,
      // so a leaked/old token reveals nothing.
      return res.status(200).json({ ok: true, status: 'unavailable' as SendStatus, email: null });
    }
    const email = v.email;
    const orgId = v.org_id;

    // The document title, for the activation email body.
    const { data: doc } = await db
      .from('documents').select('title').eq('id', v.document_id).maybeSingle();
    const docTitle = (doc as { title: string | null } | null)?.title ?? null;

    // Which door, decided by the SAME account-state helper every other door uses.
    const facts = await accountStateForEmail(db, email);

    let status: SendStatus = 'unavailable';

    if (facts.state === 'active') {
      // Already activated — send them to the login page, no token (accountDoor).
      const sent = await sendSignInEmail(db, {
        orgId, to: email, origin,
        greetingName: await greetingNameForContact(db, v.contact_id ?? facts.contactId),
      });
      status = sent.ok ? 'sent' : 'send_failed';
      return res.status(200).json({ ok: true, status, email });
    }

    if (!v.contact_id) {
      // A view token should always carry its contact; if it does not, there is no
      // party to claim. Neutral outcome.
      return res.status(200).json({ ok: true, status: 'unavailable' as SendStatus, email });
    }

    // No active account. Mint the activation invite for THIS contract party, exactly
    // as api/contract-invite.ts does, branching on whether an account exists at all.
    const { data: byContact } = await db
      .from('profiles').select('user_id').eq('contact_id', v.contact_id).limit(1).maybeSingle();
    const { data: byEmail } = byContact ? { data: null } : await db
      .from('profiles').select('user_id').ilike('email', email).limit(1).maybeSingle();
    const hasAccount = Boolean(byContact || byEmail);

    if (!hasAccount) {
      const { data: acct, error: acctErr } = await db.rpc('invite_contract_party_account', {
        p_document_id: v.document_id, p_contact_id: v.contact_id, p_email: email,
      });
      if (acctErr) throw acctErr;
      const issued = acct as { invitation_id: string; token: string; expires_at: string };
      const registerUrl = `${origin}/activate?token=${issued.token}`;
      let checklist: ChecklistRow[] = [];
      try {
        const { data: cl } = await db.rpc('contact_checklist', { p_contact_id: v.contact_id });
        checklist = (cl as ChecklistRow[]) ?? [];
      } catch { /* the invite still goes out */ }
      const sent = await sendInvitationEmail(db, {
        orgId, to: email, registerUrl,
        contractTitle: docTitle, expiresAt: issued.expires_at, checklist,
      });
      await recordInvitationDelivery(db, issued.invitation_id, sent);
      status = sent.ok ? 'sent' : 'send_failed';
      return res.status(200).json({ ok: true, status, email });
    }

    // Has an account that was never activated — the CONTRACT kind, as contract-invite.
    const { data: ctr, error: ctrErr } = await db.rpc('invite_contract_counterparty', {
      p_document_id: v.document_id, p_contact_id: v.contact_id, p_email: email,
    });
    if (ctrErr) throw ctrErr;
    const ctrToken = (ctr as { token: string }).token;
    const link = `${origin}/activate?token=${ctrToken}&kind=contract`;
    const identity = await resolveTenantEmailIdentity(db, orgId);
    const rendered = await renderEmailTemplate(db, 'CONTRACT_INVITE', {
      'ORG.BRAND_NAME': identity.fromName,
      'ORG.FOOTER': identity.footer,
      'DOC.HAS_TITLE': docTitle != null ? '1' : '',
      'DOC.TITLE': docTitle ?? '',
      'DOC.PARTY_NEEDS_INFO': '',
      'DOC.PARTY_CAN_EDIT_DEAL': '',
      'DOC.PARTY_CAN_SUGGEST': '',
      'MSG.LINK': link,
      'MSG.RECIPIENT_EMAIL': email,
    });
    if (!rendered) return res.status(200).json({ ok: true, status: 'send_failed' as SendStatus, email });
    const sent = await sendViaProvider({
      to: email, fromName: identity.fromName, fromEmail: identity.fromEmail,
      subject: rendered.subject, html: rendered.html,
    });
    status = sent.ok ? 'sent' : 'send_failed';
    return res.status(200).json({ ok: true, status, email });
  } catch (err) {
    console.error('contract-view-activate error', err);
    return res.status(500).json({ error: 'could not start activation' });
  }
}
