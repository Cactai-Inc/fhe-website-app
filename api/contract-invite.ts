/* POST /api/contract-invite — issue + email a contract-counterparty invitation
 * (Update A, spec G). Staff-only (Bearer token). Body: { documentId, partyRole,
 * email? }.
 *
 * ⚠️ P1 ITEM 1 — TWO EMAILS BECAME ONE, DECIDED BY WHETHER THEY HAVE AN ACCOUNT.
 *
 * Owner, 2026-08-25: *"the only option is for me to send the contract to her and
 * send the invitation to activate her account, i dont want to send her two emails
 * since that is confusing."*
 *
 * The reason there were two is structural, not cosmetic: `redeem_contract_invitation`
 * requires an already signed-in user whose email matches, so the CONTRACT link
 * assumes the account exists. A unified send must therefore CLAIM THE ACCOUNT FIRST
 * and route to the document second. So this endpoint now branches on the one fact
 * that decides it:
 *
 *   HAS AN ACCOUNT  → invite_contract_counterparty + CONTRACT_INVITE, unchanged.
 *                     This is a real case and that path serves it well.
 *   HAS NO ACCOUNT  → invite_contract_party_account: their ACCOUNT invitation
 *                     (kind COMMUNITY), reused if one already exists, with
 *                     `document_id` stamped on it — and ONE email, the INVITATION
 *                     template, which now names both the claim and the contract.
 *
 * Neither `redeem_contract_invitation` nor the CONTRACT kind is removed; they
 * simply stop being used for people who have no account.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';
import { sendInvitationEmail, recordInvitationDelivery, type ChecklistRow } from './_lib/invitationEmail.js';

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
  const { documentId, partyRole } = body;
  let { email } = body;
  if (!documentId || !partyRole) {
    return res.status(400).json({ error: 'documentId and partyRole are required' });
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

    // SENDGUARD §1: never send a signing invitation to someone who already signed.
    // deliver-documents already refuses on document state (409); the signing-invite
    // path never got the same discipline. invite_contract_counterparty guards this
    // independently — it is directly callable — but the refusal is repeated here so
    // the UI gets a distinguishable code instead of a raw database error.
    const { data: signed } = await db
      .from('signatures')
      .select('party_role, signed_at')
      .eq('document_id', documentId)
      .eq('signer_contact_id', party.contact_id)
      .eq('party_role', partyRole.toUpperCase())
      .is('deleted_at', null)
      .maybeSingle();
    if (signed) {
      return res.status(409).json({
        code: 'ALREADY_SIGNED',
        error: `This ${partyRole.toLowerCase()} has already signed this document — a new signing invitation was not sent.`,
      });
    }

    // The party is already assigned, so derive their email from the contact record
    // when the caller didn't pass one (Send-for-review path). Skip silently if the
    // contact has no email on file — the in-app notification still reaches them.
    if (!email) {
      const { data: c } = await db.from('contacts').select('email').eq('id', party.contact_id).maybeSingle();
      email = c?.email ?? undefined;
      if (!email) return res.status(200).json({ ok: true, emailed: false, reason: 'no email on file for this party' });
    }

    // ── P1 ITEM 1: DOES THIS PERSON HAVE AN ACCOUNT? ─────────────────────
    //
    // `profiles` IS the account (CLAUDE.md: profiles ↔ auth.users, the 1:1
    // bridge). Two ways to be linked to one: the contact is the profile's
    // contact, or the address itself already signs in. Both are checked because
    // a counterparty contact created for a contract may not be linked yet even
    // though the person has been a member for a year.
    const { data: byContact } = await db
      .from('profiles').select('user_id').eq('contact_id', party.contact_id).limit(1).maybeSingle();
    const { data: byEmail } = byContact ? { data: null } : await db
      .from('profiles').select('user_id').ilike('email', email).limit(1).maybeSingle();
    const hasAccount = Boolean(byContact || byEmail);

    if (!hasAccount) {
      // ONE invitation, carrying the contract. The RPC reuses a live or SAVED
      // (draft) account invitation rather than minting a second one, so the link
      // staff already saved is the link the client receives and nothing is
      // superseded — see PAMELA §A.
      const { data: acct, error: acctErr } = await db.rpc('invite_contract_party_account', {
        p_document_id: documentId, p_contact_id: party.contact_id, p_email: email,
      });
      if (acctErr) {
        return /already signed/i.test(acctErr.message)
          ? res.status(409).json({ code: 'ALREADY_SIGNED', error: acctErr.message })
          : res.status(400).json({ error: acctErr.message });
      }
      const issued = acct as { invitation_id: string; token: string; expires_at: string };
      const origin = req.headers.origin || `https://${req.headers.host}`;
      // NO `&kind=contract`: this is the ACCOUNT claim, and the document it
      // carries is read off the invitation row, never off the URL.
      const registerUrl = `${origin}/activate?token=${issued.token}`;

      // The same paperwork lines the ordinary account invitation carries — a
      // counterparty who also owes onboarding documents should be told once, in
      // this one email, rather than discovering them after signing in.
      let checklist: ChecklistRow[] = [];
      try {
        const { data: cl } = await db.rpc('contact_checklist', { p_contact_id: party.contact_id });
        checklist = (cl as ChecklistRow[]) ?? [];
      } catch { /* the invite still goes out */ }

      const sent = await sendInvitationEmail(db, {
        orgId: doc.org_id, to: email, registerUrl,
        contractTitle: doc.title ?? null,
        expiresAt: issued.expires_at, checklist,
      });
      await recordInvitationDelivery(db, issued.invitation_id, sent);
      return res.status(200).json({
        ok: true, emailed: sent.ok, accountClaim: true,
        ...(sent.ok ? {} : { reason: sent.error }),
      });
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

    const { data: inv, error: invErr } = await db.rpc('invite_contract_counterparty', {
      p_document_id: documentId, p_contact_id: party.contact_id, p_email: email,
    });
    // The RPC guards independently, so its refusal can still arrive here (a race, or
    // a signature recorded under a different role than the one being invited). Keep
    // it a refusal, not a generic 400.
    if (invErr) {
      return /already signed/i.test(invErr.message)
        ? res.status(409).json({ code: 'ALREADY_SIGNED', error: invErr.message })
        : res.status(400).json({ error: invErr.message });
    }
    const token = (inv as { token: string }).token;

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const link = `${origin}/activate?token=${token}&kind=contract`;
    let identity = { fromName: 'French Heritage Equestrian', fromEmail: '', footer: '' as string | null };
    try { identity = await resolveTenantEmailIdentity(db, doc.org_id); } catch { /* fall back */ }

    // The invitation LANGUAGE — including which of the review phrases appears —
    // is the CONTRACT_INVITE row; the party's controls arrive as tokens so the
    // email still never promises an action the controls don't allow.
    const rendered = await renderEmailTemplate(db, 'CONTRACT_INVITE', {
      'ORG.BRAND_NAME': identity.fromName,
      'ORG.FOOTER': identity.footer,
      'DOC.HAS_TITLE': doc.title != null ? '1' : '',
      'DOC.TITLE': doc.title ?? '',
      'DOC.PARTY_NEEDS_INFO': needsInfo ? '1' : '',
      'DOC.PARTY_CAN_EDIT_DEAL': ctrl?.can_edit_deal ? '1' : '',
      'DOC.PARTY_CAN_SUGGEST': ctrl?.can_suggest ? '1' : '',
      'MSG.LINK': link,
      'MSG.RECIPIENT_EMAIL': email,
    });
    // The token was already issued by the RPC above, so this is reported the same
    // way a provider failure is: the invitation stands, the email did not go.
    if (!rendered) {
      return res.status(200).json({ ok: true, emailed: false, reason: 'the CONTRACT_INVITE email template is missing or deactivated' });
    }

    const sent = await sendViaProvider({
      to: email,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: rendered.subject,
      html: rendered.html,
    });
    // The token was issued regardless; report whether the email actually sent so
    // the caller can tell the user if delivery (provider config) failed.
    if (!sent.ok) return res.status(200).json({ ok: true, emailed: false, reason: 'email provider not configured or send failed' });

    return res.status(200).json({ ok: true, emailed: true });
  } catch (err) {
    console.error('contract-invite error', err);
    return res.status(500).json({ error: 'could not send the invitation' });
  }
}
