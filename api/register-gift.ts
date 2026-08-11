/* POST /api/register-gift — password-path account creation for a GIFT
 * recipient who has no account yet.
 *
 * Same problem as /api/register-invited (see that file): client-side signUp
 * requires email confirmation, so a bare sign-in right after fails "Email not
 * confirmed" and the whole redeem flow dies silently. There, the invitation
 * proves control of the inbox. Here there is no invitation — per the task
 * constraint, the GIFT CODE is the credential: whoever holds the code is
 * authorized to redeem it (open_gift is deliberately unguarded for the same
 * reason). So this endpoint's proof-of-authorization is a valid, unredeemed,
 * unexpired gift code — not a matching email. The visitor types whatever
 * email they want their account under; redeem_gift uses that email, not
 * gifts.recipient_email (which may not even be set).
 *
 * Body: { code, email, password }
 * -> 200 { ok: true }
 * -> 400 invalid body / weak password
 * -> 404 gift code invalid, expired, or already redeemed
 * -> 409 an account already exists for this email (client shows sign-in)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: { code?: string; email?: string; password?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const code = (body.code ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!code) return res.status(400).json({ error: 'code required' });
  if (!email) return res.status(400).json({ error: 'email required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  try {
    const db = getSupabaseAdmin();

    // the gift code is the credential: must be a real, still-redeemable gift
    const { data: gift } = await db
      .from('gifts')
      .select('status, expires_at')
      .eq('code', code)
      .maybeSingle();
    if (!gift) return res.status(404).json({ error: 'this gift code is not valid' });
    if (gift.status === 'redeemed') return res.status(404).json({ error: 'this gift has already been redeemed' });
    if (!['created', 'paid', 'delivered', 'opened'].includes(gift.status)) {
      return res.status(404).json({ error: 'this gift is not currently redeemable' });
    }
    if (gift.expires_at && new Date(gift.expires_at) < new Date()) {
      return res.status(404).json({ error: 'this gift has expired' });
    }

    const { error: createErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // the gift code already proved authorization to redeem
    });
    if (createErr) {
      const msg = createErr.message || '';
      // The email already has an auth account. Same claim-it behavior as
      // register-invited: the credential here is the gift code, so let them
      // set the password they just chose and sign in with it.
      if (/already|registered|exists/i.test(msg)) {
        const { data: existing } = await db
          .schema('auth').from('users').select('id').ilike('email', email).limit(1).maybeSingle();
        if (!existing?.id) {
          return res.status(409).json({ error: 'an account already exists for this email — sign in instead' });
        }
        const { error: updErr } = await db.auth.admin.updateUserById(existing.id, {
          password, email_confirm: true,
        });
        if (updErr) return res.status(400).json({ error: updErr.message || 'could not set the password' });
        return res.status(200).json({ ok: true, existed: true });
      }
      return res.status(400).json({ error: msg || 'could not create the account' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('register-gift error', err);
    return res.status(500).json({ error: 'could not create the account' });
  }
}
