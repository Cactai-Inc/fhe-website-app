/* Shared activation-invitation email — extracted from admin-send-invitation.ts
 * (TASK C) so the /sign self-onboarding endpoint sends the IDENTICAL email as
 * the staff-initiated flow. One template, one sender, three callers.
 *
 * INVITEWORKS: a RESEND is the same link again, not a new one, so it must be
 * distinguishable in a mailbox from the first send — people triage on the
 * subject line and open ONE message. `kind` drives the subject, not just the
 * body copy.
 *
 * EMAILEXTRACT: the wording now lives in the `INVITATION` row of email_templates,
 * where the owner can change it without a developer (D13). `kind` still drives the
 * subject — through the MSG.IS_RESEND token — so the resend/first-send distinction
 * survives, and is now editable rather than compiled in. */
import type { getSupabaseAdmin } from './supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './email.js';
import { renderEmailTemplate } from './emailTemplates.js';

export interface ChecklistRow { kind: string; title: string; action: string; done: boolean }

/** Outcome of an invitation send. `ok:false` ALWAYS carries the reason — a send
 *  that failed must never be indistinguishable from one that worked. */
export interface InvitationSendResult {
  ok: boolean;
  messageId: string | null;
  /** Why the send failed, verbatim from the transport. Set iff !ok. */
  error?: string;
}

export interface InvitationEmailInput {
  orgId: string | null;
  to: string;
  registerUrl: string;
  /** 'first' = the original invitation. 'resend' = the SAME link, sent again. */
  kind?: 'first' | 'resend';
  /** Adds the "your purchase is ready" line when the invite carries a purchase. */
  offeringLabel?: string | null;
  checklist?: ChecklistRow[];
  expiresAt?: string | null;
  /**
   * LESSONREQUEST §L3 — the lesson slot agreed on the phone, already in words.
   *
   * Owner ruling, 2026-08-17: *"One message, one link, and the agreed date and
   * time in writing at the top. A second email is a second thing that can fail
   * independently."* So there is no confirmation email — this line is it.
   *
   * ⚠️ ALREADY FORMATTED, DELIBERATELY. No table in this database carries a
   * tenant timezone, and this code runs on a UTC serverless runtime, so
   * formatting an instant here would tell the client their 4pm lesson is at
   * 11pm. The string is composed in the staff member's own browser, in the
   * barn's own timezone, from the very picker they agreed the time in — so what
   * the client reads is what the person who booked it saw.
   */
  agreedTime?: string | null;
  /**
   * P1 ITEM 1 — THE CONTRACT THIS ONE EMAIL ALSO CARRIES.
   *
   * Owner, 2026-08-25: *"i dont want to send her two emails since that is
   * confusing and these should be able to be married up as a unified single
   * email send."* Set only when staff sent a CONTRACT to a counterparty who has
   * no account: the account invitation is what goes out, and it must say both
   * things — your account is ready to claim, and there is a contract waiting.
   *
   * Raw, not escaped, matching how `DOC.TITLE` has always been passed to the
   * CONTRACT_INVITE template — the value is a document title staff typed in the
   * app, and it renders into the SUBJECT line as well as the body, where an
   * escaped ampersand would read as `&amp;`.
   */
  contractTitle?: string | null;
}

/** Invitation email via the shared transport (Google SMTP first, Resend dormant),
 *  branded from the INVITING org's registry — never a hardcoded tenant name. */
export async function sendInvitationEmail(
  db: ReturnType<typeof getSupabaseAdmin>,
  input: InvitationEmailInput,
): Promise<InvitationSendResult> {
  const { orgId, to, registerUrl, offeringLabel, checklist, expiresAt, agreedTime, contractTitle } = input;
  const isResend = input.kind === 'resend';

  // No org = no brand identity = no from-address. That is a real failure with a
  // real cause (the platform owner has org_id NULL by design — D1a), not an
  // "email provider not configured".
  if (!orgId) {
    return { ok: false, messageId: null, error: 'no org on the sending account — cannot resolve the sender identity' };
  }
  const identity = await resolveTenantEmailIdentity(db, orgId);
  // from_address_rule 'invite' on the INVITATION row: the env override, else the
  // tenant address. Kept in code because it reads an environment variable, which
  // is deployment configuration rather than content.
  const fromEmail = process.env.INVITE_FROM_EMAIL || identity.fromEmail;

  // ONE email for everything assigned to them: what they'll do when they click.
  const pending = (checklist ?? []).filter((c) => !c.done);

  // The wording — including whether a resend says "same link" and how the expiry
  // sentence reads — is the INVITATION row in email_templates. What is left here
  // is the values that wording merges.
  const rendered = await renderEmailTemplate(db, 'INVITATION', {
    'ORG.BRAND_NAME': identity.fromName,
    'ORG.FOOTER': identity.footer,
    'MSG.IS_RESEND': isResend ? '1' : '',
    'MSG.AGREED_TIME': agreedTime ?? '',
    'MSG.CONTRACT_TITLE': contractTitle ?? '',
    'MSG.OFFERING_LABEL': offeringLabel ?? '',
    'MSG.CHECKLIST': pending.map((c) => ({ TITLE: c.title, ACTION: c.action.toLowerCase() })),
    'MSG.LINK': registerUrl,
    'MSG.EXPIRES_ON': expiresAt
      ? new Date(expiresAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : '',
  });
  // A missing template is a real failure with a real cause — never a blank email
  // to a real person, and never a success the operator would walk away believing.
  if (!rendered) {
    return { ok: false, messageId: null, error: 'the INVITATION email template is missing or deactivated' };
  }

  const out = await sendViaProvider({
    to,
    fromName: identity.fromName,
    fromEmail,
    subject: rendered.subject,
    html: rendered.html,
  });
  return out.ok
    ? { ok: true, messageId: out.messageId }
    : { ok: false, messageId: null, error: out.error || 'the email transport rejected the send' };
}

/**
 * Write the delivery attempt onto the invitation's status trail so "created but
 * never emailed" is a fact staff can see later, not a boolean the handler drops
 * on the floor. Best-effort by design: recording must never turn a successful
 * send into a failed request.
 */
export async function recordInvitationDelivery(
  db: ReturnType<typeof getSupabaseAdmin>,
  invitationId: string | null | undefined,
  sent: InvitationSendResult,
): Promise<void> {
  if (!invitationId) return;
  try {
    await db.rpc('record_invitation_delivery', {
      p_invitation_id: invitationId,
      p_ok: sent.ok,
      p_error: sent.ok ? null : (sent.error ?? null),
    });
  } catch (err) {
    console.error('could not record invitation delivery', invitationId, err);
  }
}

/**
 * RESEND: the same token, to the address already on the invitation row, with a
 * subject that says so. No new invitation row, no supersede — the link the
 * person may already be holding keeps working, which is the entire point.
 *
 * The caller NEVER supplies an address: it comes off the row, so this can only
 * ever mail the person the invitation was already going to.
 */
export async function resendInvitationEmail(
  db: ReturnType<typeof getSupabaseAdmin>,
  invitation: { id: string; org_id: string | null; email: string; token: string; expires_at: string | null },
  origin: string,
  opts: { selfService: boolean },
): Promise<InvitationSendResult> {
  const sent = await sendInvitationEmail(db, {
    orgId: invitation.org_id,
    to: invitation.email,
    registerUrl: `${origin}/activate?token=${invitation.token}`,
    kind: 'resend',
    expiresAt: invitation.expires_at,
  });
  // The resend is a fact about this invitation whether or not it landed: the
  // attempt goes on the trail, then the outcome does.
  try {
    await db.rpc('record_invitation_resend', {
      p_invitation_id: invitation.id,
      p_self_service: opts.selfService,
    });
  } catch (err) {
    console.error('could not record invitation resend', invitation.id, err);
  }
  await recordInvitationDelivery(db, invitation.id, sent);
  return sent;
}
