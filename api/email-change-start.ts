/* POST /api/email-change-start — begin an email change (Update B, HANDOFF-email-change).
 *
 * Body: { newEmail: string, mode: 'password' | 'google', password?: string }
 * Auth: Authorization: Bearer <supabase access token> (the signed-in member).
 *
 * Server-side Google detection is AUTHORITATIVE (the UI's checkbox is only a hint):
 * @gmail.com → google; otherwise the domain's MX records decide (google.com /
 * googlemail.com MX = Google-hosted). If the caller asked for the google path but
 * the domain isn't Google-hosted, we 409 so the UI can fall back to password.
 *
 * password path: set the new password on the account NOW (the current email keeps
 * working — adding a password never breaks an existing login), store the pending
 * change with a sha256 token hash, and send the verification email to the NEW
 * address with a /verify-email?token=…&mode=password link.
 *
 * google path: store the pending change + token and return { token } — the client
 * then runs supabase.auth.linkIdentity(google) with a redirect back to
 * /verify-email?token=…&mode=google, where the linked identity is the proof.
 * No verification email is sent for the google path.
 *
 * A new start replaces any prior pending change (no expiry otherwise). */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, randomUUID } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Authoritative Google-hosted check: gmail.com, or MX records pointing at Google. */
async function isGoogleHosted(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  if (domain === 'gmail.com' || domain === 'googlemail.com') return true;
  try {
    const mx = await dns.resolveMx(domain);
    return mx.some((r) => /(^|\.)google(mail)?\.com$/i.test(r.exchange));
  } catch {
    return false; // unresolvable domain → not provably Google-hosted
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ error: 'unauthorized' });

  let body: { newEmail?: string; mode?: string; password?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }

  const newEmail = (body.newEmail || '').trim().toLowerCase();
  const mode = body.mode === 'google' ? 'google' : 'password';
  if (!EMAIL_RE.test(newEmail)) return res.status(400).json({ error: 'invalid email' });
  if (mode === 'password' && (!body.password || body.password.length < 8)) {
    return res.status(400).json({ error: 'password of at least 8 characters required' });
  }

  try {
    const db = getSupabaseAdmin();
    const { data: userData, error: userErr } = await db.auth.getUser(bearer);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const user = userData.user;

    if ((user.email || '').toLowerCase() === newEmail) {
      return res.status(400).json({ error: 'that is already your email' });
    }

    // The new address must not belong to another account.
    const { data: taken } = await db
      .from('profiles').select('user_id').eq('email', newEmail).neq('user_id', user.id).maybeSingle();
    if (taken) return res.status(409).json({ error: 'that email is already in use' });

    // Authoritative Google detection — the UI checkbox is only a hint.
    const googleHosted = await isGoogleHosted(newEmail);
    if (mode === 'google' && !googleHosted) {
      return res.status(409).json({
        error: 'that address is not Google-hosted — use the password path instead',
      });
    }

    const token = randomUUID();
    const { data: profile } = await db
      .from('profiles').select('org_id, first_name, display_name').eq('user_id', user.id).maybeSingle();

    // password path: set the new password NOW (current login keeps working).
    if (mode === 'password') {
      const { error: pwErr } = await db.auth.admin.updateUserById(user.id, {
        password: body.password!,
      });
      if (pwErr) throw pwErr;
    }

    // Store the pending change (replaces any prior one; no expiry).
    const { error: updErr } = await db
      .from('profiles')
      .update({
        pending_email: newEmail,
        pending_email_mode: mode,
        pending_email_token_hash: sha256(token),
        pending_email_started_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);
    if (updErr) throw updErr;

    if (mode === 'password') {
      const origin = req.headers.origin || `https://${req.headers.host}`;
      const link = `${origin}/verify-email?token=${token}&mode=password&email=${encodeURIComponent(newEmail)}`;
      const name = profile?.display_name || profile?.first_name || null;
      let identity = { fromName: 'French Heritage Equestrian', fromEmail: '', footer: '' as string | null };
      if (profile?.org_id) {
        try { identity = await resolveTenantEmailIdentity(db, profile.org_id); } catch { /* fall back */ }
      }
      const sent = await sendViaProvider({
        to: newEmail,
        fromName: identity.fromName,
        fromEmail: identity.fromEmail,
        subject: `Verify your new email — ${identity.fromName}`,
        html:
          `<p>${name ? `Hi ${name},` : 'Hello,'}</p>` +
          `<p>You asked to change your sign-in email to <strong>${newEmail}</strong>.</p>` +
          `<p><a href="${link}">Verify this address</a> and sign in with it plus the password you just set to finish the switch. ` +
          `Your current email keeps working until then.</p>` +
          `<p style="color:#666;font-size:12px">If the link doesn't open, check your spam folder or paste it into your browser:<br/>${link}</p>` +
          (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>` : ''),
      });
      if (!sent.ok) return res.status(502).json({ error: 'could not send the verification email' });
      return res.status(200).json({ ok: true, mode });
    }

    // google path: the client continues with linkIdentity; token rides the redirect.
    return res.status(200).json({ ok: true, mode, token });
  } catch (err) {
    console.error('email-change-start error', err);
    return res.status(500).json({ error: 'could not start the email change' });
  }
}
