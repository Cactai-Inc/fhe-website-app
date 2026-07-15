/* POST /api/register-invited — password-path account creation for INVITED users.
 *
 * Owner-reported: the invite → register → activate chain broke for password
 * signups because the project requires email confirmation: client-side signUp
 * returns no session, the immediate sign-in fails "Email not confirmed", and
 * every downstream step (profile save, redemption, onboarding routing) dies
 * silently — the person ends up back on the public site with nothing saved.
 *
 * The invitation itself proves control of the inbox (the link is personal to
 * that address), so confirmation is redundant here. This endpoint validates
 * the invitation token, then creates the auth user SERVER-SIDE with
 * email_confirm: true. The client then signs in normally (works — confirmed),
 * saves the profile, redeems, and routes into onboarding. Public/uninvited
 * signups elsewhere keep whatever confirmation policy the project has.
 *
 * Body: { token, password, firstName?, lastName? }
 * -> 200 { ok: true }
 * -> 400 invalid body / weak password
 * -> 404 invitation invalid or expired
 * -> 409 an account already exists for this email (client shows sign-in)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: { token?: string; password?: string; firstName?: string; lastName?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const token = (body.token ?? '').trim();
  const password = body.password ?? '';
  if (!token) return res.status(400).json({ error: 'token required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  try {
    const db = getSupabaseAdmin();

    // the invitation is the credential: must be sent + unexpired
    const { data: inv } = await db
      .from('invitations')
      .select('email, status, expires_at')
      .eq('token', token)
      .maybeSingle();
    if (!inv || inv.status !== 'sent' || new Date(inv.expires_at) < new Date()) {
      return res.status(404).json({ error: 'invitation is not valid or has expired' });
    }

    const { error: createErr } = await db.auth.admin.createUser({
      email: inv.email,
      password,
      email_confirm: true, // the personal invite link already proved the inbox
      user_metadata: {
        ...(body.firstName?.trim() ? { first_name: body.firstName.trim() } : {}),
        ...(body.lastName?.trim() ? { last_name: body.lastName.trim() } : {}),
      },
    });
    if (createErr) {
      const msg = createErr.message || '';
      // The email already has an auth account (e.g. an earlier partial signup, or
      // a reused address). The invitation is the credential, so let the invitee
      // CLAIM it: set the password they just chose + confirm, then they sign in.
      if (/already|registered|exists/i.test(msg)) {
        const { data: existing } = await db
          .schema('auth').from('users').select('id').ilike('email', inv.email).limit(1).maybeSingle();
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
    console.error('register-invited error', err);
    return res.status(500).json({ error: 'could not create the account' });
  }
}
