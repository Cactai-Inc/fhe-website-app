/* POST /api/admin-send-invitation
 * Admin-only. Creates an invitation token and emails the registration link.
 * Body: { email, requestId?, expiresInDays?,
 *         firstName?, lastName?, tierId?, markPaid?, paymentMethod?, notes? }
 * Header: Authorization: Bearer <supabase access token of an admin>
 *
 * Two paths:
 *  - PLAIN INVITE (no tierId): the legacy behavior, unchanged — insert an
 *    invitations row and email the register link.
 *  - PROVISIONED INVITE (tierId present): the client already paid offline for a
 *    riding-lesson tier. The provision_lesson_invitation RPC (service-role)
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
 *  When the invite carries a provisioned purchase, `tierLabel` adds the
 *  "your purchase is ready" line above the register link. */
async function sendEmail(
  db: ReturnType<typeof getSupabaseAdmin>,
  orgId: string | null,
  to: string,
  registerUrl: string,
  tierLabel?: string | null,
): Promise<boolean> {
  if (!orgId) return false;
  const identity = await resolveTenantEmailIdentity(db, orgId);
  const fromEmail = process.env.INVITE_FROM_EMAIL || identity.fromEmail;
  const purchaseLine = tierLabel
    ? `<p>Your ${tierLabel} is ready — create your account to sign your documents and get started.</p>`
    : '';
  const out = await sendViaProvider({
    to,
    fromName: identity.fromName,
    fromEmail,
    subject: `Your invitation to ${identity.fromName}`,
    html: `
      <p>Welcome — we're so glad to have you.</p>
      ${purchaseLine}
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

  // Provisioned invite (client already paid offline for a lesson tier).
  const tierId = typeof body.tierId === 'string' ? body.tierId.trim() : '';
  const firstName = ((body.firstName as string) || '').trim();
  const lastName = ((body.lastName as string) || '').trim();
  if (tierId && (!firstName || !lastName)) {
    return res.status(400).json({ error: 'firstName and lastName required when provisioning a purchase' });
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
    const isAdmin = profile?.is_admin || profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });

    const origin = req.headers.origin || `https://${req.headers.host}`;

    if (tierId) {
      // One transaction server-side: contact + client + engagement + paid
      // transaction + invitation. The RPC returns the token we email — the
      // legacy invitations insert below must NOT also run.
      const { data, error: rpcErr } = await db.rpc('provision_lesson_invitation', {
        p_email: email,
        p_first_name: firstName,
        p_last_name: lastName,
        p_tier_id: tierId,
        p_mark_paid: body.markPaid === true,
        p_payment_method: ((body.paymentMethod as string) || '').trim() || null,
        p_notes: ((body.notes as string) || '').trim() || null,
        // Only sent when present so callers without a request keep the exact
        // legacy payload (the defaulted 8th param covers the omission).
        ...(requestId ? { p_request_id: requestId } : {}),
      });
      if (rpcErr) throw rpcErr;
      const out = (Array.isArray(data) ? data[0] : data) as ProvisionResult;

      const registerUrl = `${origin}/register?token=${out.token}`;
      const emailed = await sendEmail(db, profile.org_id ?? null, email, registerUrl, out.tier_label);
      return res.status(200).json({ registerUrl, emailed, tierLabel: out.tier_label });
    }

    // Plain invite (legacy path, unchanged).
    const days = Number(body.expiresInDays) > 0 ? Number(body.expiresInDays) : 7;
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    const inviteToken = makeToken();

    const { error: insErr } = await db.from('invitations').insert({
      org_id: profile.org_id ?? null, // service-role insert has no current_org(); stamp the admin's org
      request_id: requestId,
      email,
      token: inviteToken,
      expires_at: expiresAt,
      status: 'sent',
    });
    if (insErr) throw insErr;

    const registerUrl = `${origin}/register?token=${inviteToken}`;

    const emailed = await sendEmail(db, profile.org_id ?? null, email, registerUrl);
    return res.status(200).json({ registerUrl, emailed });
  } catch (err) {
    console.error('invite error', err);
    return res.status(500).json({ error: 'could not create invitation' });
  }
}
