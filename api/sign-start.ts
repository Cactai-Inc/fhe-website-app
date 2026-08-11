/* POST /api/sign-start — public self-onboarding entry for the /sign/* pages
 * (TASK C). No auth: anyone on the public site can start their own activation.
 *
 * Body: { path: 'guest'|'rider'|'horse'|'rider+horse', email, confirmEmail }
 * -> 200 { ok: true } — IDENTICAL body whether the email was known or new (no
 *    enumeration), and whether the request was rate-limited or not.
 * -> 400 on a malformed body (bad path, emails missing/mismatched/implausible).
 *
 * Flow:
 *  1. Validate + map path -> standing categories.
 *  2. Rate limit via sign_start_register_attempt (requester_hash =
 *     sha256(ip + user agent), NEVER the email) — 10 allowed provisions/hour
 *     per requester; beyond that, same response, no provisioning.
 *  3. Provision through the canonical spine (service-role): the same
 *     provision_client_invitation RPC admin-send-invitation.ts uses. A repeat
 *     email is the resume path — same contact, fresh token, requirements
 *     preserved.
 *  4. Send the SAME activation email the manual admin flow sends (shared
 *     _lib/invitationEmail.ts helper — one template, one sender).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { sendInvitationEmail, recordInvitationDelivery } from './_lib/invitationEmail.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PATH_CATEGORIES: Record<string, string[]> = {
  guest: ['GUEST'],
  rider: ['RIDER'],
  horse: ['HORSE_OWNER'],
  'rider+horse': ['RIDER', 'HORSE_OWNER'],
};

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** provision_client_invitation() jsonb result (subset used here). */
interface ProvisionResult {
  token: string;
  invitation_id: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: Record<string, unknown>;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }

  // The URL path segment carries a literal '+' (e.g. rider+horse); a caller
  // that percent-encoded it (rider%2Bhorse) arrives here already decoded by
  // the framework, so both forms normalize to the same lookup key.
  const path = ((body.path as string) || '').trim().toLowerCase();
  const categories = PATH_CATEGORIES[path];
  if (!categories) return res.status(400).json({ error: 'unknown path' });

  const email = ((body.email as string) || '').trim().toLowerCase();
  const confirmEmail = ((body.confirmEmail as string) || '').trim().toLowerCase();
  if (!email || !confirmEmail || email !== confirmEmail) {
    return res.status(400).json({ error: 'email and confirmation must match' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' });

  try {
    const db = getSupabaseAdmin();

    // Single-tenant resolution — the same fallback request-received.ts uses:
    // a service-role call has no current_org(), and this endpoint has no
    // staff profile to stamp an org from.
    const { data: orgs } = await db.from('organizations').select('id').limit(2);
    const orgId = (orgs && orgs.length === 1) ? (orgs[0].id as string) : null;

    // Rate limit — keyed on the requester, never the email.
    const forwardedFor = (req.headers['x-forwarded-for'] as string | undefined) || '';
    const ip = forwardedFor.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    const userAgent = (req.headers['user-agent'] as string | undefined) || '';
    const requesterHash = sha256(`${ip}|${userAgent}`);

    const { data: attempt, error: attemptErr } = await db.rpc('sign_start_register_attempt', {
      p_hash: requesterHash,
      p_org: orgId,
    });
    if (attemptErr) throw attemptErr;
    const allowed = Boolean((attempt as { allowed?: boolean } | null)?.allowed);

    if (allowed && orgId) {
      const { data, error: rpcErr } = await db.rpc('provision_client_invitation', {
        p_email: email,
        p_first_name: null,
        p_last_name: null,
        p_categories: categories,
        p_offering_ids: [],
        p_template_keys: null,
        p_mark_paid: false,
        p_payment_method: null,
        p_notes: null,
        p_request_id: null,
        p_org_id: orgId,
        p_partial_amount: 0,
      });
      if (rpcErr) throw rpcErr;
      const out = (Array.isArray(data) ? data[0] : data) as ProvisionResult;

      const origin = req.headers.origin || `https://${req.headers.host}`;
      const registerUrl = `${origin}/activate?token=${out.token}`;
      // The response is deliberately neutral (no enumeration), so the delivery
      // outcome has nowhere to surface EXCEPT the invitation's status trail.
      // Without this a self-onboarding signup that never got its email is
      // invisible to everyone, including the person waiting for it.
      const sent = await sendInvitationEmail(db, orgId, email, registerUrl);
      await recordInvitationDelivery(db, out.invitation_id, sent);
    }
    // Rate-limited (or org unresolved) requests fall through to the same
    // { ok: true } response below — neutral, no enumeration, no provisioning.

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('sign-start error', err);
    return res.status(500).json({ error: 'could not process your request' });
  }
}
