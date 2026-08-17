/* POST /api/admin-send-invitation
 * Admin-only. Creates an invitation token and emails the activation link.
 * Body: { email, requestId?, expiresInDays?, role?,
 *         firstName?, lastName?, title?,
 *         categories?, offeringIds?, offeringId?, templateKeys?,
 *         paymentStatus? ('paid'|'partial'|'unpaid'), partialAmount?, markPaid?,
 *         paymentMethod?, notes?, scheduledFor? }
 * Header: Authorization: Bearer <supabase access token of a staff member>
 *
 * Two paths:
 *  - PLAIN / STAFF INVITE (no categories, no offerings): insert an invitations
 *    row and email the activation link. `role` (USER/MANAGER/ADMIN) provisions a
 *    staff account (admin-only) with an optional `title`.
 *  - PROVISIONED CLIENT INVITE (categories and/or offerings present): the
 *    canonical spine RPC provision_client_invitation (service-role) creates the
 *    contact (canonical email) + client + standing categories (Guest/Rider/
 *    Horse Owner) + onboarding documents + 0..N offering purchase + invitation
 *    in one transaction and returns the token we email; NO plain insert happens.
 *    Names are OPTIONAL (email-only invites) — captured at first-login intake.
 *    `paymentStatus` = paid | partial | unpaid; 'partial' carries `partialAmount`
 *    that reduces the balance on the payer's modal. When `requestId` is present
 *    (Request Inbox conversion), the RPC stamps invitations.request_id and flips
 *    the request to 'invited'.
 *
 * Email delivery uses the shared transport; otherwise the function still
 * creates the invitation and returns the activation URL so the admin can copy it.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { sendInvitationEmail, recordInvitationDelivery, type ChecklistRow } from './_lib/invitationEmail.js';

function makeToken(): string {
  // URL-safe random token. Node 18+ (the Vercel runtime) exposes Web Crypto globally.
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Where in the send path a failure happened. Returned to the caller so a staff
 *  member (or a log line) can tell a provisioning failure from a delivery one. */
type Stage =
  | 'auth' | 'minor-check' | 'provision' | 'expiry-config'
  | 'invitation-insert' | 'supersede' | 'email';

interface ErrorDetail {
  status: number;
  message: string;
  stage: Stage;
  code?: string;
  hint?: string;
}

/** A failure that knows where it happened. */
class StageError extends Error {
  constructor(public stage: Stage, public cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'StageError';
  }
}

/** Run a step; any throw is re-thrown tagged with the stage it came from. */
async function at<T>(stage: Stage, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw err instanceof StageError ? err : new StageError(stage, err);
  }
}

/** A PostgREST/Postgres error shape (message + code/details/hint). */
function pgFields(e: unknown): { message?: string; code?: string; details?: string; hint?: string } {
  return (e && typeof e === 'object') ? e as Record<string, string> : {};
}

/**
 * Turn any thrown value into an operator-readable failure: real message, the
 * stage it came from, and a status that distinguishes "you asked for something
 * impossible" (4xx) from "this deployment is broken" (5xx).
 */
function describeError(err: unknown): ErrorDetail {
  const stage: Stage = err instanceof StageError ? err.stage : 'provision';
  const raw = err instanceof StageError ? err.cause : err;
  const f = pgFields(raw);
  const message = (f.message || (raw instanceof Error ? raw.message : String(raw)) || 'unknown failure').trim();
  const hint = [f.details, f.hint].filter(Boolean).join(' — ') || undefined;

  // Missing deployment configuration is a 5xx: nothing the operator typed is wrong.
  if (/Missing SUPABASE_URL|SERVICE_ROLE_KEY/i.test(message)) {
    return { status: 500, stage, message: `server is misconfigured: ${message}`, code: f.code, hint };
  }
  // A RAISE EXCEPTION out of the provisioning spine is a rejected REQUEST, not a
  // crash — the operator can act on it (pick a category, sign in as the tenant).
  const rejected = /not authorized|is required|could not resolve org|already|invalid|expired|minor|not valid/i.test(message);
  return { status: rejected ? 400 : 500, stage, message, code: f.code, hint };
}

/** provision_client_invitation() jsonb result. */
interface ProvisionResult {
  invitation_id: string;
  token: string;
  contact_id: string;
  purchase_id: string | null;
  categories: string[];
  amount: number;
  labels: string[];
  /** LESSONREQUEST §L3 — present iff the act also booked the agreed lesson. */
  agreed_lesson: { booking_id: string; starts_at: string; ends_at: string } | null;
}

/**
 * LESSONREQUEST §L3 — the slot staff agreed on the phone.
 *
 * `starts_at`/`ends_at` are the authority and go to the database. `display` is
 * the same slot in the words the staff member saw, and it is what the client
 * reads in the email: this schema has no tenant timezone column anywhere, so
 * anything formatted on the server renders UTC and a 4pm lesson would reach the
 * client as 11pm. Nothing here is trusted for authorization — the endpoint is
 * already staff-gated above, and the RPC re-checks the org on every id.
 */
interface AgreedLessonBody {
  starts_at?: unknown; ends_at?: unknown;
  offering_id?: unknown; horse_id?: unknown; instructor_user_id?: unknown;
  location?: unknown; notes?: unknown; display?: unknown;
}

function readAgreedLesson(v: unknown): { rpc: Record<string, string>; display: string } | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as AgreedLessonBody;
  const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  const starts = str(a.starts_at);
  const ends = str(a.ends_at);
  if (!starts || !ends) return null;
  const rpc: Record<string, string> = { starts_at: starts, ends_at: ends };
  for (const k of ['offering_id', 'horse_id', 'instructor_user_id', 'location', 'notes'] as const) {
    const val = str(a[k]);
    if (val) rpc[k] = val;
  }
  return { rpc, display: str(a.display) };
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

  // Provisioned client invite: standing category(ies) + optional offering(s).
  // Names are OPTIONAL (email-only invites per spec) — captured at first-login
  // intake. The canonical spine RPC provision_client_invitation writes standing
  // clients marker + onboarding docs + 0..N offering purchase in one transaction.
  const toStrArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  const categories = toStrArray(body.categories);
  const offeringIds = toStrArray(body.offeringIds);
  // Back-compat: a single offeringId folds into offeringIds.
  const singleOffering = typeof body.offeringId === 'string' ? body.offeringId.trim() : '';
  if (singleOffering && !offeringIds.includes(singleOffering)) offeringIds.push(singleOffering);
  const templateKeys = toStrArray(body.templateKeys);
  const firstName = ((body.firstName as string) || '').trim();
  const lastName = ((body.lastName as string) || '').trim();
  const title = ((body.title as string) || '').trim();
  // Payment status → RPC params. 'partial' carries an amount that reduces the
  // balance shown on the payer's modal (purchases.amount_paid).
  const paymentStatus =
    ['paid', 'partial', 'unpaid'].includes(body.paymentStatus as string)
      ? (body.paymentStatus as string)
      : (body.markPaid === true ? 'paid' : 'unpaid');
  const partialAmount = paymentStatus === 'partial' ? Number(body.partialAmount) || 0 : 0;
  const provisioning = categories.length > 0 || offeringIds.length > 0;
  // Optional role for the account being provisioned (New account flow).
  const invitedRole =
    typeof body.role === 'string' && ['USER', 'MANAGER', 'ADMIN'].includes(body.role)
      ? (body.role as string) : 'USER';
  if (invitedRole !== 'USER' && (offeringIds.length > 0 || categories.length > 0)) {
    return res.status(400).json({ error: 'staff invitations cannot carry a category or purchase' });
  }
  // Optional booking-request linkage (staff Request Inbox).
  const requestId =
    typeof body.requestId === 'string' && body.requestId.trim() ? body.requestId.trim() : null;

  // RESEND vs REGENERATE (owner ruling 2026-08-11). This endpoint only ever
  // MINTS a token, so it is never a resend — /api/admin-resend-invitation is.
  // What `mode` decides is whether minting also RETIRES the link the person may
  // already be holding:
  //   'new'         first invitation, or an additional one — retire nothing.
  //   'regenerate'  deliberate replacement — retire the prior live link.
  // The caller says which; nothing here infers it from "an invitation exists".
  const mode = body.mode === 'regenerate' ? 'regenerate' : 'new';

  // LESSONREQUEST §L3 — the agreed slot, when the caller set one.
  const agreed = readAgreedLesson(body.agreedLesson);

  try {
    const db = await at('auth', async () => getSupabaseAdmin());

    // Verify the caller is an admin.
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const profile = await at('auth', async () => {
      const { data, error } = await db
        .from('profiles').select('is_admin, role, org_id').eq('user_id', userData.user!.id).maybeSingle();
      if (error) throw error;
      return data;
    });
    // Two-operator model: instructors (MANAGER/EMPLOYEE) provision + send client
    // invitations too — client support is a servicing capability.
    const isStaff = profile?.is_admin
      || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(profile?.role ?? '');
    if (!profile || !isStaff) return res.status(403).json({ error: 'forbidden' });
    // Only admins may provision staff accounts; instructors invite clients only.
    const isAdminCaller = profile.is_admin || ['ADMIN', 'SUPER_ADMIN'].includes(profile.role ?? '');
    if (invitedRole !== 'USER' && !isAdminCaller) {
      return res.status(403).json({ error: 'only an admin can create staff accounts' });
    }
    // An invitation belongs to a TENANT. A caller with no org has nothing to
    // invite anyone into: the provisioning RPC would die on "could not resolve
    // org", and the plain path on a NOT NULL violation four triggers deep —
    // both previously flattened to "could not create invitation". The platform
    // owner (admin@cactai.io) has org_id NULL BY DESIGN (D1a); the fix is to
    // say so, never to give that account an org.
    if (!profile.org_id) {
      return res.status(403).json({
        stage: 'auth' as Stage,
        error: 'this account is not part of an organization, so it cannot send invitations — '
          + 'sign in with the organization\'s own staff account and try again',
      });
    }
    const orgId = profile.org_id as string;

    // C10: a minor cannot hold an account — reject before provisioning or
    // sending anything (no guardian-redirect for invitations, reject only).
    await at('minor-check', async () => {
      const { data: existingContact } = await db
        .from('contacts').select('id')
        .ilike('email', email).is('deleted_at', null).limit(1).maybeSingle();
      if (!existingContact) return;
      const { data: isMinor, error: minorErr } = await db.rpc('is_minor_contact', { p_contact_id: existingContact.id });
      if (minorErr) throw minorErr;
      if (isMinor) throw new Error('minors cannot be invited to hold accounts; invite the guardian');
    });

    const origin = req.headers.origin || `https://${req.headers.host}`;

    if (provisioning) {
      // One transaction server-side via the canonical spine: contact (canonical
      // email) + client + standing categories + onboarding docs + 0..N offering
      // purchase + invitation. The RPC returns the token we email — the plain
      // invitations insert below must NOT also run. org_id is stamped from the
      // admin's profile (a service-role call has no current_org()).
      const out = await at('provision', async () => {
        const { data, error: rpcErr } = await db.rpc('provision_client_invitation', {
          p_email: email,
          p_first_name: firstName || null,
          p_last_name: lastName || null,
          p_categories: categories,
          p_offering_ids: offeringIds,
          p_template_keys: templateKeys.length > 0 ? templateKeys : null,
          p_mark_paid: paymentStatus === 'paid',
          p_payment_method: ((body.paymentMethod as string) || '').trim() || null,
          p_notes: ((body.notes as string) || '').trim() || null,
          p_request_id: requestId,
          p_org_id: orgId,
          p_partial_amount: partialAmount,
          // §L3: null keeps this call byte-identical to what it always did.
          p_agreed_lesson: agreed ? agreed.rpc : null,
        });
        if (rpcErr) throw rpcErr;
        return (Array.isArray(data) ? data[0] : data) as ProvisionResult;
      });

      // Retiring the prior link is the CALLER's declared intent, not a side
      // effect of provisioning. provision_client_invitation still supersedes
      // internally today; the migration that removes that default is written
      // and held for owner sign-off, and this call is what keeps regenerate
      // correct once it lands. Idempotent in the meantime — the second call
      // finds nothing left to retire.
      if (mode === 'regenerate') {
        await at('supersede', async () => {
          const { error: supErr } = await db.rpc('supersede_invitations', {
            p_org: orgId, p_email: email, p_new_invitation_id: out.invitation_id,
          });
          if (supErr) throw supErr;
        });
      }

      const registerUrl = `${origin}/activate?token=${out.token}`;
      // "your purchase is ready" line only when an offering was purchased.
      const offeringLabel = (out.labels && out.labels.length > 0) ? out.labels.join(', ') : null;
      // The invitation row is committed by now, so a delivery failure cannot roll
      // it back — but it MUST come back as a failure, with its reason, or the
      // operator walks away believing a person was emailed who never was.
      // §L3, owner ruling: ONE message, with the agreed slot in writing at the
      // top. Only named when the RPC actually booked something — the caller's
      // `display` string alone is never enough to make that claim.
      const agreedTime = out.agreed_lesson && agreed?.display ? agreed.display : null;
      const sent = await sendInvitationEmail(db, {
        orgId, to: email, registerUrl, offeringLabel, agreedTime,
      });
      await recordInvitationDelivery(db, out.invitation_id, sent);
      return res.status(200).json({
        registerUrl,
        emailed: sent.ok,
        ...(sent.ok ? {} : { emailError: sent.error, stage: 'email' as Stage }),
        invitationId: out.invitation_id,
        contactId: out.contact_id,
        categories: out.categories,
        purchaseId: out.purchase_id,
        amount: out.amount,
        offeringLabel,
        agreedLesson: out.agreed_lesson ?? null,
      });
    }

    // Plain invite. A scheduled date means terms were agreed in person —
    // the claim-and-pay window tightens to 48 hours from send.
    const scheduledFor =
      typeof body.scheduledFor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.scheduledFor)
        ? body.scheduledFor : null;
    // Expiry window: a scheduled date (terms agreed in person) tightens the
    // claim-and-pay window to 48h; otherwise the org's configured default
    // (INVITATIONS/EXPIRY_DAYS, fallback 7) drives it. Client-supplied
    // expiresInDays still wins if explicitly passed.
    let days = Number(body.expiresInDays) > 0 ? Number(body.expiresInDays) : 0;
    if (!days) {
      days = await at('expiry-config', async () => {
        const { data: cfgDays, error: cfgErr } = await db.rpc('invitation_expiry_days', { p_org: orgId });
        if (cfgErr) throw cfgErr;
        return Number(cfgDays) > 0 ? Number(cfgDays) : 7;
      });
    }
    const expiresAt = scheduledFor
      ? new Date(Date.now() + 48 * 3600000).toISOString()
      : new Date(Date.now() + days * 86400000).toISOString();
    const inviteToken = makeToken();

    // Insert the new live link first, then supersede any prior pending invite
    // for this email (status='superseded', linked via superseded_by/resend_of)
    // so the client page can show the live link above the grayed-out prior one —
    // instead of a bare revoke that discards the lifecycle trail.
    const insRow = await at('invitation-insert', async () => {
      const { data, error: insErr } = await db.from('invitations').insert({
        org_id: orgId, // service-role insert has no current_org(); stamp the admin's org
        request_id: requestId,
        email,
        token: inviteToken,
        expires_at: expiresAt,
        status: 'sent',
        invited_role: invitedRole,
        scheduled_for: scheduledFor,
        // carried onto the account at redemption (name → profile, title → profile employment fields)
        first_name: firstName || null,
        last_name: lastName || null,
        title: title || null,
      }).select('id').single();
      if (insErr) throw insErr;
      return data;
    });

    await at('supersede', async () => {
      const { error: supErr } = await db.rpc('supersede_invitations', {
        p_org: orgId, p_email: email, p_new_invitation_id: insRow.id,
      });
      if (supErr) throw supErr;
    });

    const registerUrl = `${origin}/activate?token=${inviteToken}`;

    // one email, all their items: derive the checklist from what's assigned
    let checklist: ChecklistRow[] = [];
    try {
      const { data: contact } = await db
        .from('contacts').select('id')
        .ilike('email', email).is('deleted_at', null).limit(1).maybeSingle();
      if (contact) {
        const { data: cl } = await db.rpc('contact_checklist', { p_contact_id: contact.id });
        checklist = (cl as ChecklistRow[]) ?? [];
      }
    } catch { /* checklist is best-effort — the invite still goes out */ }

    const sent = await sendInvitationEmail(db, { orgId, to: email, registerUrl, checklist, expiresAt });
    await recordInvitationDelivery(db, insRow.id, sent);
    return res.status(200).json({
      registerUrl,
      emailed: sent.ok,
      ...(sent.ok ? {} : { emailError: sent.error, stage: 'email' as Stage }),
      invitationId: insRow.id,
    });
  } catch (err) {
    // NEVER flatten. A caller who cannot tell "this address belongs to a minor"
    // from "the SMTP password is wrong" cannot fix either one. This endpoint is
    // staff-only (verified above), so the real cause goes back to the operator.
    const detail = describeError(err);
    console.error('invite error', detail.stage, detail.message, err);
    return res.status(detail.status).json({
      error: detail.message,
      stage: detail.stage,
      ...(detail.code ? { code: detail.code } : {}),
      ...(detail.hint ? { hint: detail.hint } : {}),
    });
  }
}
