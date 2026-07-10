/* POST /api/email-change-complete — finish an email change (Update B).
 *
 * Body (password path): { token, mode: 'password', email, password }
 *   Proof = possession of the emailed token AND the password set at start
 *   (verified by an actual sign-in attempt against the CURRENT email).
 *
 * Body (google path):   { token, mode: 'google' } + Authorization: Bearer <token>
 *   Proof = the caller's session now carries a linked Google identity whose
 *   email is the pending address (linkIdentity round-trip completed).
 *
 * Promotion is ordered so the account never loses a working login:
 *   1. auth.users.email → pending (email_confirm: true)   ← the switch
 *   2. profiles: old_email ← current, email ← pending, clear pending fields
 * If step 2 fails after step 1, the auth email is already the new one and a
 * retry of this endpoint reconciles profiles (idempotent by token). */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: { token?: string; mode?: string; email?: string; password?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }

  const token = (body.token || '').trim();
  const mode = body.mode === 'google' ? 'google' : 'password';
  if (!token) return res.status(400).json({ error: 'missing token' });

  try {
    const db = getSupabaseAdmin();

    // Locate the pending change by token hash.
    const { data: profile } = await db
      .from('profiles')
      .select('user_id, email, pending_email, pending_email_mode')
      .eq('pending_email_token_hash', sha256(token))
      .maybeSingle();
    if (!profile || !profile.pending_email) {
      return res.status(404).json({ error: 'no pending email change for this link' });
    }
    if (profile.pending_email_mode !== mode) {
      return res.status(400).json({ error: 'wrong verification method for this change' });
    }

    if (mode === 'password') {
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';
      if (email !== profile.pending_email.toLowerCase()) {
        return res.status(400).json({ error: 'that is not the address this link verifies' });
      }
      // Prove the password: a real sign-in against the CURRENT email (set at start).
      const anon = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
        process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
        { auth: { persistSession: false } },
      );
      const { error: signErr } = await anon.auth.signInWithPassword({
        email: profile.email as string,
        password,
      });
      if (signErr) return res.status(401).json({ error: 'wrong password for this account' });
    } else {
      // google path: the caller's session must now carry a Google identity for the
      // pending address (the linkIdentity round-trip is the proof).
      const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!bearer) return res.status(401).json({ error: 'unauthorized' });
      const { data: userData, error: userErr } = await db.auth.getUser(bearer);
      if (userErr || !userData.user || userData.user.id !== profile.user_id) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      const identities = userData.user.identities ?? [];
      const hasGoogle = identities.some(
        (i) => i.provider === 'google'
          && (i.identity_data?.email || '').toLowerCase() === profile.pending_email!.toLowerCase(),
      );
      if (!hasGoogle) {
        return res.status(409).json({
          error: 'Google confirmation not found — sign in with Google as the new address first',
        });
      }
    }

    // ── promote: auth first (the switch), then the profile bookkeeping ──
    const { error: authErr } = await db.auth.admin.updateUserById(profile.user_id, {
      email: profile.pending_email,
      email_confirm: true,
    });
    if (authErr) throw authErr;

    const { error: profErr } = await db
      .from('profiles')
      .update({
        old_email: profile.email,
        email: profile.pending_email,
        pending_email: null,
        pending_email_mode: null,
        pending_email_token_hash: null,
        pending_email_started_at: null,
      })
      .eq('user_id', profile.user_id);
    if (profErr) throw profErr;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('email-change-complete error', err);
    return res.status(500).json({ error: 'could not complete the email change' });
  }
}
