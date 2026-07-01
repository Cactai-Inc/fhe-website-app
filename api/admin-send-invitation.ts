/* POST /api/admin-send-invitation
 * Admin-only. Creates an invitation token and emails the registration link.
 * Body: { email, requestId?, expiresInDays? }
 * Header: Authorization: Bearer <supabase access token of an admin>
 *
 * Email delivery uses RESEND_API_KEY if configured; otherwise the function still
 * creates the invitation and returns the register URL so the admin can copy it.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';

function makeToken(): string {
  // URL-safe random token. Node 18+ (the Vercel runtime) exposes Web Crypto globally.
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sendEmail(to: string, registerUrl: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL || 'Hello@FHEquestrian.com';
  if (!key) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `French Heritage Equestrian <${from}>`,
        to,
        subject: 'Your invitation to French Heritage Equestrian',
        html: `
          <p>Welcome — we're so glad to have you.</p>
          <p>Create your account here to join the community:</p>
          <p><a href="${registerUrl}">${registerUrl}</a></p>
          <p>This link expires soon. If it does, just reach out and we'll send a fresh one.</p>
          <p>— French Heritage Equestrian</p>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  const email = (body.email as string || '').trim();
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const db = getSupabaseAdmin();

    // Verify the caller is an admin.
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('is_admin').eq('user_id', userData.user.id).maybeSingle();
    if (!profile?.is_admin) return res.status(403).json({ error: 'forbidden' });

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

    const emailed = await sendEmail(email, registerUrl);
    return res.status(200).json({ registerUrl, emailed });
  } catch (err) {
    console.error('invite error', err);
    return res.status(500).json({ error: 'could not create invitation' });
  }
}
