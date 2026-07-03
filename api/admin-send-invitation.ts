/* POST /api/admin-send-invitation
 * Admin-only. Creates an invitation token and emails the registration link.
 * Body: { email, requestId?, expiresInDays? }
 * Header: Authorization: Bearer <supabase access token of an admin>
 *
 * Email delivery uses RESEND_API_KEY if configured; otherwise the function still
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

/** Invitation email via the shared transport (Google SMTP first, Resend dormant),
 *  branded from the INVITING org's registry — never a hardcoded tenant name. */
async function sendEmail(
  db: ReturnType<typeof getSupabaseAdmin>,
  orgId: string | null,
  to: string,
  registerUrl: string,
): Promise<boolean> {
  if (!orgId) return false;
  const identity = await resolveTenantEmailIdentity(db, orgId);
  const fromEmail = process.env.INVITE_FROM_EMAIL || identity.fromEmail;
  const out = await sendViaProvider({
    to,
    fromName: identity.fromName,
    fromEmail,
    subject: `Your invitation to ${identity.fromName}`,
    html: `
      <p>Welcome — we're so glad to have you.</p>
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

  try {
    const db = getSupabaseAdmin();

    // Verify the caller is an admin.
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('is_admin, role, org_id').eq('user_id', userData.user.id).maybeSingle();
    const isAdmin = profile?.is_admin || profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });

    const days = Number(body.expiresInDays) > 0 ? Number(body.expiresInDays) : 7;
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    const inviteToken = makeToken();

    const { error: insErr } = await db.from('invitations').insert({
      request_id: body.requestId ?? null,
      email,
      token: inviteToken,
      expires_at: expiresAt,
      status: 'sent',
    });
    if (insErr) throw insErr;

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const registerUrl = `${origin}/register?token=${inviteToken}`;

    const emailed = await sendEmail(db, profile.org_id ?? null, email, registerUrl);
    return res.status(200).json({ registerUrl, emailed });
  } catch (err) {
    console.error('invite error', err);
    return res.status(500).json({ error: 'could not create invitation' });
  }
}
