/* Shared activation-invitation email — extracted from admin-send-invitation.ts
 * (TASK C) so the /sign self-onboarding endpoint sends the IDENTICAL email as
 * the staff-initiated flow. One template, one sender, three callers.
 *
 * INVITEWORKS: a RESEND is the same link again, not a new one, so it must be
 * distinguishable in a mailbox from the first send — people triage on the
 * subject line and open ONE message. `kind` drives the subject, not just the
 * body copy. */
import type { getSupabaseAdmin } from './supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './email.js';

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
}

/** Invitation email via the shared transport (Google SMTP first, Resend dormant),
 *  branded from the INVITING org's registry — never a hardcoded tenant name. */
export async function sendInvitationEmail(
  db: ReturnType<typeof getSupabaseAdmin>,
  input: InvitationEmailInput,
): Promise<InvitationSendResult> {
  const { orgId, to, registerUrl, offeringLabel, checklist, expiresAt } = input;
  const isResend = input.kind === 'resend';

  // No org = no brand identity = no from-address. That is a real failure with a
  // real cause (the platform owner has org_id NULL by design — D1a), not an
  // "email provider not configured".
  if (!orgId) {
    return { ok: false, messageId: null, error: 'no org on the sending account — cannot resolve the sender identity' };
  }
  const identity = await resolveTenantEmailIdentity(db, orgId);
  const fromEmail = process.env.INVITE_FROM_EMAIL || identity.fromEmail;
  const purchaseLine = offeringLabel
    ? `<p>Your ${offeringLabel} is ready — create your account to sign your documents and get started.</p>`
    : '';
  // ONE email for everything assigned to them: what they'll do when they click.
  const pending = (checklist ?? []).filter((c) => !c.done);
  const checklistBlock = pending.length
    ? `<p>When you click the link, here's what we'll ask you to do:</p>` +
      `<ul style="padding-left:18px">` +
      pending.map((c) => `<li style="margin:4px 0"><strong>${c.title}</strong> — ${c.action.toLowerCase()}</li>`).join('') +
      `</ul>` +
      `<p style="color:#666;font-size:13px">This same checklist will be on your dashboard, ticking itself off as you go.</p>`
    : '';

  // The subject is the ONLY part of a resend most people ever read. It has to
  // say "this is the one you already have" without looking like a new invite.
  const subject = isResend
    ? `Here's your invitation link again — ${identity.fromName}`
    : `Your invitation to ${identity.fromName}`;

  const opening = isResend
    ? `<p>Here's that link again — this is the <strong>same invitation</strong> we sent you
       before, not a new one. If you still have the first email, either link works.</p>`
    : `<p>Welcome — we're so glad to have you.</p>`;

  const out = await sendViaProvider({
    to,
    fromName: identity.fromName,
    fromEmail,
    subject,
    html: `
      ${opening}
      ${purchaseLine}
      ${checklistBlock}
      <p>Create your account here to join the community. You can sign up with Google
      or set a password — your choice on the next page:</p>
      <p><a href="${registerUrl}">${registerUrl}</a></p>
      <p>${expiresAt
        ? `This link is valid until <strong>${new Date(expiresAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>. If it expires, just reach out and we'll send a fresh one.`
        : `This link expires soon. If it does, just reach out and we'll send a fresh one.`}</p>
      <hr/><pre style="font-family:inherit">${identity.footer}</pre>`,
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
