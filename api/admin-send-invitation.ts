/* POST /api/admin-send-invitation
 * Admin-only. Creates an invitation token and emails the registration link.
 * Body: { email, requestId?, expiresInDays?,
 *         firstName?, lastName?, offeringId?, markPaid?, paymentMethod?, notes? }
 * Header: Authorization: Bearer <supabase access token of an admin>
 *
 * Two paths:
 *  - PLAIN INVITE (no offeringId): the legacy behavior, unchanged — insert an
 *    invitations row and email the register link.
 *  - PROVISIONED INVITE (offeringId present): the client already paid offline for
 *    a riding-lesson offering. The provision_lesson_invitation RPC (service-role)
 *    creates contact + client + engagement + paid transaction + invitation in
 *    one transaction and returns the token we email; NO legacy insert happens.
 *    firstName/lastName are required on this path (they seed the contact and
 *    the printed name on the onboarding contracts). When `requestId` is
 *    provided (the staff Request Inbox), it is passed through as p_request_id —
 *    the RPC stamps invitations.request_id and flips the request to 'invited'.
 *
 * Email delivery uses the shared transport; otherwise the function still
 * creates the invitation and returns the register URL so the admin can copy it.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';

function makeToken(): string {
  // URL-safe random token. Node 18+ (the Vercel runtime) exposes Web Crypto globally.
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** provision_lesson_invitation() jsonb result. */
interface ProvisionResult {
  invitation_id: string;
  token: string;
  engagement_id: string;
  tier_label: string;
  amount: number;
}

/** Invitation email via the shared transport (Google SMTP first, Resend dormant),
 *  branded from the INVITING org's registry — never a hardcoded tenant name.
 *  When the invite carries a provisioned purchase, `offeringLabel` adds the
 *  "your purchase is ready" line above the register link. */
interface ChecklistRow { kind: string; title: string; action: string; done: boolean }

async function sendEmail(
  db: ReturnType<typeof getSupabaseAdmin>,
  orgId: string | null,
  to: string,
  registerUrl: string,
  offeringLabel?: string | null,
  checklist?: ChecklistRow[],
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
      <p>This link expires soon. If it does, just reach out and we'll send a fresh one.</p>
      <hr/><pre style="font-family:inherit">${identity.footer}</pre>`,
  });
  return out.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  let body: Record<string, unknown>;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const email = ((body.email as string) || '').trim();
  if (!email) return res.status(400).json({ error: 'email required' });

  // Provisioned invite (client already paid offline for a lesson offering).
  const offeringId = typeof body.offeringId === 'string' ? body.offeringId.trim() : '';
  const firstName = ((body.firstName as string) || '').trim();
  const lastName = ((body.lastName as string) || '').trim();
  if (offeringId && (!firstName || !lastName)) {
    return res.status(400).json({ error: 'firstName and lastName required when provisioning a purchase' });
  }
  // Optional role for the account being provisioned (New account flow).
  const invitedRole =
    typeof body.role === 'string' && ['USER', 'MANAGER', 'ADMIN'].includes(body.role)
      ? (body.role as string) : 'USER';
  if (invitedRole !== 'USER' && offeringId) {
    return res.status(400).json({ error: 'staff invitations cannot carry a purchase' });
  }
  // Optional booking-request linkage (staff Request Inbox).
  const requestId =
    typeof body.requestId === 'string' && body.requestId.trim() ? body.requestId.trim() : null;

  try {
    const db = getSupabaseAdmin();

    // Verify the caller is an admin.
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('is_admin, role, org_id').eq('user_id', userData.user.id).maybeSingle();
    // Two-operator model: instructors (MANAGER/EMPLOYEE) provision + send client
    // invitations too — client support is a servicing capability.
    const isStaff = profile?.is_admin
      || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(profile?.role ?? '');
    if (!profile || !isStaff) return res.status(403).json({ error: 'forbidden' });
    // Only admins may provision staff accounts; instructors invite clients only.
    const isAdminCaller = profile.is_admin || ['ADMIN', 'SUPER_ADMIN'].includes(profile.role ?? '');
    if (invitedRole !== 'USER' && !isAdminCaller) {
      return res.status(403).json({ error: 'only an admin can create staff accounts' });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;

    if (offeringId) {
      // One transaction server-side: contact + client + engagement + paid
      // transaction + invitation. The RPC returns the token we email — the
      // legacy invitations insert below must NOT also run.
      const { data, error: rpcErr } = await db.rpc('provision_lesson_invitation', {
        p_email: email,
        p_first_name: firstName,
        p_last_name: lastName,
        p_offering_id: offeringId,
        p_mark_paid: body.markPaid === true,
        p_payment_method: ((body.paymentMethod as string) || '').trim() || null,
        p_notes: ((body.notes as string) || '').trim() || null,
        // Only sent when present so callers without a request keep the exact
        // legacy payload (the defaulted 8th param covers the omission).
        ...(requestId ? { p_request_id: requestId } : {}),
      });
      if (rpcErr) throw rpcErr;
      const out = (Array.isArray(data) ? data[0] : data) as ProvisionResult;

      const registerUrl = `${origin}/activate?token=${out.token}`;
      const emailed = await sendEmail(db, profile.org_id ?? null, email, registerUrl, out.tier_label);
      return res.status(200).json({ registerUrl, emailed, offeringLabel: out.tier_label });
    }

    // Plain invite. A scheduled date means terms were agreed in person —
    // the claim-and-pay window tightens to 48 hours from send.
    const scheduledFor =
      typeof body.scheduledFor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.scheduledFor)
        ? body.scheduledFor : null;
    const days = Number(body.expiresInDays) > 0 ? Number(body.expiresInDays) : 7;
    const expiresAt = scheduledFor
      ? new Date(Date.now() + 48 * 3600000).toISOString()
      : new Date(Date.now() + days * 86400000).toISOString();
    const inviteToken = makeToken();

    const { error: insErr } = await db.from('invitations').insert({
      org_id: profile.org_id ?? null, // service-role insert has no current_org(); stamp the admin's org
      request_id: requestId,
      email,
      token: inviteToken,
      expires_at: expiresAt,
      status: 'sent',
      invited_role: invitedRole,
      scheduled_for: scheduledFor,
    });
    if (insErr) throw insErr;

    const registerUrl = `${origin}/activate?token=${inviteToken}`;

    // one email, all their items: derive the checklist from what's assigned
    let checklist: ChecklistRow[] = [];
    try {
      const { data: contact } = await db
        .from('contacts').select('id')
        .ilike('email', email).is('deleted_at', null).limit(1).maybeSingle();
      if (contact) {
        const { data: cl } = await db.rpc('contact_checklist', { p_contact_id: contact.id });
        checklist = (cl as ChecklistRow[]) ?? [];
      }
    } catch { /* checklist is best-effort — the invite still goes out */ }

    const emailed = await sendEmail(db, profile.org_id ?? null, email, registerUrl, null, checklist);
    return res.status(200).json({ registerUrl, emailed });
  } catch (err) {
    console.error('invite error', err);
    return res.status(500).json({ error: 'could not create invitation' });
  }
}
