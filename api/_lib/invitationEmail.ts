/* Shared activation-invitation email — extracted from admin-send-invitation.ts
 * (TASK C) so the /sign self-onboarding endpoint sends the IDENTICAL email as
 * the staff-initiated flow. One template, one sender, two callers. */
import type { getSupabaseAdmin } from './supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './email.js';

export interface ChecklistRow { kind: string; title: string; action: string; done: boolean }

/** Invitation email via the shared transport (Google SMTP first, Resend dormant),
 *  branded from the INVITING org's registry — never a hardcoded tenant name.
 *  When the invite carries a provisioned purchase, `offeringLabel` adds the
 *  "your purchase is ready" line above the register link. */
export async function sendInvitationEmail(
  db: ReturnType<typeof getSupabaseAdmin>,
  orgId: string | null,
  to: string,
  registerUrl: string,
  offeringLabel?: string | null,
  checklist?: ChecklistRow[],
  expiresAt?: string | null,
): Promise<boolean> {
  if (!orgId) return false;
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
  const out = await sendViaProvider({
    to,
    fromName: identity.fromName,
    fromEmail,
    subject: `Your invitation to ${identity.fromName}`,
    html: `
      <p>Welcome — we're so glad to have you.</p>
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
  return out.ok;
}
