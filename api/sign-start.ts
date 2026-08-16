/* POST /api/sign-start — public self-onboarding entry for the /sign/* pages
 * (TASK C, rewired by TASK ONBOARD §2/§3).
 *
 * Body: { path: 'guest'|'rider'|'horse'|'rider+horse', firstName, lastName,
 *         phone, email, confirmEmail }
 * -> 200 { ok, status, attemptId } — `status` is the REAL send outcome
 *    ('sent' | 'send_failed' | 'rate_limited' | 'unavailable'), because the owner
 *    asked for "a screen that renders the actual email sending state with outcome"
 *    rather than an optimistic "check your email".
 * -> 400 on a malformed body.
 *
 * ANTI-ENUMERATION STILL HOLDS, and it is worth being precise about why. The
 * property that matters is that the response must not reveal whether an address
 * is already known to us — and it does not: a brand-new address and a returning
 * one both provision (the repeat is the resume path) and both report the same
 * `status`. What the response now reveals is whether OUR OWN send succeeded, which
 * is a fact about us, not about them. `rate_limited` is keyed on the requester
 * (sha256 of ip + user agent), never on the email, so it is not an oracle either.
 *
 * Flow:
 *  1. Validate + map path -> standing categories.
 *  2. Rate limit via sign_start_register_attempt (requester_hash =
 *     sha256(ip + user agent), NEVER the email) — 10 allowed provisions/hour
 *     per requester; beyond that, no provisioning, and the caller is told so.
 *  3. Provision through the canonical spine (service-role): the same
 *     provision_client_invitation RPC admin-send-invitation.ts uses, now carrying
 *     the name AND phone the person just typed (§2). A repeat email is the resume
 *     path — same contact, fresh token, requirements preserved.
 *  4. Send the SAME activation email the manual admin flow sends (shared
 *     _lib/invitationEmail.ts helper — one template, one sender).
 *  5. Record the attempt and its outcome (signup_attempts). That row is what
 *     /api/signup-help escalates from, and it is why "created but never emailed"
 *     is now a queryable fact instead of a lost 200.
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

/** What the send-state screen renders. */
type SendStatus = 'sent' | 'send_failed' | 'rate_limited' | 'unavailable';

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

  const firstName = ((body.firstName as string) || '').trim();
  const lastName = ((body.lastName as string) || '').trim();
  const phone = ((body.phone as string) || '').trim();
  // §2: the owner overrode the old email-only capture. All four are required by
  // the form; the server enforces the three it can check cheaply.
  if (!firstName || !lastName) return res.status(400).json({ error: 'name required' });
  if (!phone) return res.status(400).json({ error: 'phone required' });

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

    let status: SendStatus = allowed ? 'unavailable' : 'rate_limited';
    let invitationId: string | null = null;
    let sendError: string | null = null;
    let messageId: string | null = null;

    if (allowed && orgId) {
      const { data, error: rpcErr } = await db.rpc('provision_client_invitation', {
        p_email: email,
        p_first_name: firstName || null,
        p_last_name: lastName || null,
        p_phone: phone || null,
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
      invitationId = out.invitation_id;

      const origin = req.headers.origin || `https://${req.headers.host}`;
      const registerUrl = `${origin}/activate?token=${out.token}`;
      const sent = await sendInvitationEmail(db, { orgId, to: email, registerUrl });
      await recordInvitationDelivery(db, out.invitation_id, sent);
      status = sent.ok ? 'sent' : 'send_failed';
      sendError = sent.ok ? null : (sent.error ?? 'the email transport rejected the send');
      messageId = sent.messageId;
    }

    // §3: one row per attempt, whatever happened. This is what the "I never
    // received it" link escalates from, and what turns "an account exists but
    // nobody was ever emailed" into something staff can find.
    let attemptId: string | null = null;
    try {
      const { data: rec } = await db.rpc('record_signup_attempt', {
        p_org: orgId,
        p_email: email,
        p_first_name: firstName || null,
        p_last_name: lastName || null,
        p_phone: phone || null,
        p_path: path,
        p_categories: categories,
        p_invitation_id: invitationId,
        p_email_ok: status === 'sent',
        p_email_error: sendError,
        p_message_id: messageId,
        p_rate_limited: !allowed,
        p_requester_hash: requesterHash,
      });
      attemptId = (rec as string | null) ?? null;
    } catch (recErr) {
      // Recording must never turn a successful signup into a failed request —
      // but it must not vanish either.
      console.error('sign-start: could not record the attempt', recErr);
    }

    return res.status(200).json({ ok: true, status, attemptId });
  } catch (err) {
    console.error('sign-start error', err);
    return res.status(500).json({ error: 'could not process your request' });
  }
}
