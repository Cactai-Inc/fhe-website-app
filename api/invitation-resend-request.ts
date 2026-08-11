/* POST /api/invitation-resend-request — "send it to me again", from the
 * retired-link page. No auth: the person clicking it is signed out by
 * definition, holding a link that no longer works.
 *
 * Body: { token }  — the RETIRED token they arrived with.
 * -> 200 { ok: true }  ALWAYS, whatever happened. Neutral by design: a
 *    different answer for "that token is real" vs "it isn't" would turn this
 *    into an oracle for which addresses have invitations.
 *
 * THE RULE: this endpoint can only ever send to the address already on the
 * invitation row. It takes no address, accepts no address, and ignores any
 * address in the body. The resolved token is never returned to the caller —
 * it goes into the email and nowhere else.
 *
 * Rate limited to 3 self-service sends per invitation per hour
 * (invitation_request_resend), counted off the 'resent' status trail so a
 * staff resend never eats the invitee's own budget.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resendInvitationEmail } from './_lib/invitationEmail.js';

interface ResendClaim {
  allowed: boolean;
  rate_limited?: boolean;
  invitation_id?: string;
  email?: string;
  token?: string;
  expires_at?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: { token?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const token = (body.token ?? '').trim();
  if (!token) return res.status(400).json({ error: 'token required' });

  try {
    const db = getSupabaseAdmin();

    // Resolves the person's CURRENT live invitation from the retired token and
    // claims one send against the rate limit, in one server-side step.
    const { data, error } = await db.rpc('invitation_request_resend', { p_token: token });
    if (error) throw error;
    const claim = (Array.isArray(data) ? data[0] : data) as ResendClaim | null;

    if (claim?.allowed && claim.invitation_id && claim.email && claim.token) {
      const origin = req.headers.origin || `https://${req.headers.host}`;
      // org_id is not returned by the claim (it is not the caller's business);
      // the sender needs it for the tenant brand, so read it here.
      const { data: inv } = await db
        .from('invitations').select('org_id').eq('id', claim.invitation_id).maybeSingle();
      await resendInvitationEmail(db, {
        id: claim.invitation_id,
        org_id: (inv?.org_id as string | undefined) ?? null,
        email: claim.email,
        token: claim.token,
        expires_at: claim.expires_at ?? null,
      }, origin, { selfService: true });
    }

    // Same body whether we sent, were rate limited, or found nothing at all.
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('invitation resend request error', err);
    // Still neutral: a 500 here would leak that the token resolved to something.
    return res.status(200).json({ ok: true });
  }
}
