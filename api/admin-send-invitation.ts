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
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';

function makeToken(): string {
  // URL-safe random token. Node 18+ (the Vercel runtime) exposes Web Crypto globally.
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
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
}

/** Invitation email via the shared transport (Google SMTP first, Resend dormant),
 *  branded from the INVITING org's registry — never a hardcoded tenant name.
 *  When the invite carries a provisioned purchase, `offeringLabel` adds the
 *  "your purchase is ready" line above the register link. */
interface ChecklistRow { kind: string; title: string; action: string; done: boolean }

async function sendEmail(
  db: ReturnType<typeof getSupabaseAdmin>,
  orgId: string | null,
  to: string,
  registerUrl: string,
  offeringLabel?: string | null,
  checklist?: ChecklistRow[],
  expiresAt?: string | null,
): Promise<boolean> {
  if (!orgId) return false;
  const identity = await resolveTenantEmailIdentity(db, orgId);
  const fromEmail = process.env.INVITE_FROM_EMAIL || identity.fromEmail;
  const purchaseLine = offeringLabel
    ? `<p>Your ${offeringLabel} is ready — create your account to sign your documents and get started.</p>`
    : '';
  // ONE email for everything assigned to them: what they'll do when they click.
  const pending = (checklist ?? []).filter((c) => !c.done);
  const checklistBlock = pending.length
    ? `<p>When you click the link, here's what we'll ask you to do:</p>` +
      `<ul style="padding-left:18px">` +
      pending.map((c) => `<li style="margin:4px 0"><strong>${c.title}</strong> — ${c.action.toLowerCase()}</li>`).join('') +
      `</ul>` +
      `<p style="color:#666;font-size:13px">This same checklist will be on your dashboard, ticking itself off as you go.</p>`
    : '';
  const out = await sendViaProvider({
    to,
    fromName: identity.fromName,
    fromEmail,
    subject: `Your invitation to ${identity.fromName}`,
    html: `
      <p>Welcome — we're so glad to have you.</p>
      ${purchaseLine}
      ${checklistBlock}
      <p>Create your account here to join the community. You can sign up with Google
      or set a password — your choice on the next page:</p>
      <p><a href="${registerUrl}">${registerUrl}</a></p>
      <p>${expiresAt
        ? `This link is valid until <strong>${new Date(expiresAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>. If it expires, just reach out and we'll send a fresh one.`
        : `This link expires soon. If it does, just reach out and we'll send a fresh one.`}</p>
      <hr/><pre style="font-family:inherit">${identity.footer}</pre>`,
  });
  return out.ok;
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
  // contact_roles + onboarding docs + 0..N offering purchase in one transaction.
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

  try {
    const db = getSupabaseAdmin();

    // Verify the caller is an admin.
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('is_admin, role, org_id').eq('user_id', userData.user.id).maybeSingle();
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

    const origin = req.headers.origin || `https://${req.headers.host}`;

    if (provisioning) {
      // One transaction server-side via the canonical spine: contact (canonical
      // email) + client + standing categories + onboarding docs + 0..N offering
      // purchase + invitation. The RPC returns the token we email — the plain
      // invitations insert below must NOT also run. org_id is stamped from the
      // admin's profile (a service-role call has no current_org()).
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
        p_org_id: profile.org_id ?? null,
        p_partial_amount: partialAmount,
      });
      if (rpcErr) throw rpcErr;
      const out = (Array.isArray(data) ? data[0] : data) as ProvisionResult;

      const registerUrl = `${origin}/activate?token=${out.token}`;
      // "your purchase is ready" line only when an offering was purchased.
      const offeringLabel = (out.labels && out.labels.length > 0) ? out.labels.join(', ') : null;
      const emailed = await sendEmail(db, profile.org_id ?? null, email, registerUrl, offeringLabel);
      return res.status(200).json({
        registerUrl, emailed,
        contactId: out.contact_id,
        categories: out.categories,
        purchaseId: out.purchase_id,
        amount: out.amount,
        offeringLabel,
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
      const { data: cfgDays } = await db.rpc('invitation_expiry_days', { p_org: profile.org_id ?? null });
      days = Number(cfgDays) > 0 ? Number(cfgDays) : 7;
    }
    const expiresAt = scheduledFor
      ? new Date(Date.now() + 48 * 3600000).toISOString()
      : new Date(Date.now() + days * 86400000).toISOString();
    const inviteToken = makeToken();

    // Insert the new live link first, then supersede any prior pending invite
    // for this email (status='superseded', linked via superseded_by/resend_of)
    // so the client page can show the live link above the grayed-out prior one —
    // instead of a bare revoke that discards the lifecycle trail.
    const { data: insRow, error: insErr } = await db.from('invitations').insert({
      org_id: profile.org_id ?? null, // service-role insert has no current_org(); stamp the admin's org
      request_id: requestId,
      email,
      token: inviteToken,
      expires_at: expiresAt,
      status: 'sent',
      invited_role: invitedRole,
      scheduled_for: scheduledFor,
      // carried onto the account at redemption (name → profile, title → staff_profiles)
      first_name: firstName || null,
      last_name: lastName || null,
      title: title || null,
    }).select('id').single();
    if (insErr) throw insErr;

    await db.rpc('supersede_invitations', {
      p_org: profile.org_id ?? null, p_email: email, p_new_invitation_id: insRow.id,
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

    const emailed = await sendEmail(db, profile.org_id ?? null, email, registerUrl, null, checklist, expiresAt);
    return res.status(200).json({ registerUrl, emailed });
  } catch (err) {
    console.error('invite error', err);
    return res.status(500).json({ error: 'could not create invitation' });
  }
}
