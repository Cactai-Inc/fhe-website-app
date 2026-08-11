/* POST /api/admin-resend-invitation — send the SAME invitation link again.
 *
 * Owner ruling, 2026-08-11: an invitation link stays alive until it expires or
 * staff deliberately deactivate it. "I'll send it again" must not be what kills
 * the working link — so RESEND and REGENERATE are two different acts and staff
 * choose between them explicitly:
 *
 *   RESEND      (this endpoint)            same token, same address, same row.
 *                                          Nothing is superseded. The link the
 *                                          person may already be holding — in
 *                                          an email, a text, on a sticky note —
 *                                          keeps working.
 *   REGENERATE  (admin-send-invitation)    mints a new token and retires the
 *                                          old one. A deliberate act for a
 *                                          compromised or expired link.
 *
 * Body:   { invitationId }
 * Header: Authorization: Bearer <access token of a staff member>
 * -> 200 { emailed, emailError?, email }
 * -> 400 the invitation is not live (expired/redeemed/retired — regenerate instead)
 * -> 403 not staff, or the invitation belongs to another org
 * -> 404 no such invitation
 *
 * The address is NEVER taken from the request: it comes off the invitation row,
 * so this can only ever mail the person it was already going to.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resendInvitationEmail } from './_lib/invitationEmail.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!auth) return res.status(401).json({ error: 'unauthorized' });

  let body: { invitationId?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const invitationId = (body.invitationId ?? '').trim();
  if (!invitationId) return res.status(400).json({ error: 'invitationId required' });

  try {
    const db = getSupabaseAdmin();

    const { data: userData, error: userErr } = await db.auth.getUser(auth);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('is_admin, role, org_id').eq('user_id', userData.user.id).maybeSingle();
    const isStaff = profile?.is_admin
      || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(profile?.role ?? '');
    if (!profile || !isStaff) return res.status(403).json({ error: 'forbidden' });

    const { data: inv, error: invErr } = await db
      .from('invitations')
      .select('id, org_id, email, token, status, expires_at, deleted_at')
      .eq('id', invitationId)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!inv) return res.status(404).json({ error: 'no such invitation' });

    // Org boundary — the service-role client bypasses RLS, so the check the
    // database would have made has to be made here instead.
    if (inv.org_id !== profile.org_id) return res.status(403).json({ error: 'forbidden' });

    // Only a LIVE link can be sent again. Anything else needs a new token, and
    // that is a different, deliberate act — say so instead of quietly doing it.
    if (inv.deleted_at || inv.status !== 'sent' || new Date(inv.expires_at) <= new Date()) {
      const why = inv.deleted_at ? 'was deleted'
        : inv.status === 'redeemed' || inv.status === 'accepted' ? 'has already been redeemed'
        : inv.status === 'superseded' ? 'was replaced by a newer invitation'
        : inv.status === 'revoked' ? 'was revoked'
        : new Date(inv.expires_at) <= new Date() ? 'has expired'
        : `is ${inv.status}`;
      return res.status(400).json({
        error: `this invitation ${why}, so there is no live link to send again — `
          + 'regenerate to issue a new one (that will retire this link)',
        status: inv.status,
      });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const sent = await resendInvitationEmail(db, inv, origin, { selfService: false });

    return res.status(200).json({
      emailed: sent.ok,
      ...(sent.ok ? {} : { emailError: sent.error }),
      email: inv.email,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message
      : (err as { message?: string })?.message || 'unknown failure';
    console.error('resend invitation error', message, err);
    return res.status(500).json({ error: message });
  }
}
