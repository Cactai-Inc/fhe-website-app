/* POST /api/account-reset — the ONE password-recovery path, for staff and client
 * alike (fix round 2d).
 *
 * Owner, 2026-10-25: the staff action and the client "Forgot password" use one
 * recovery path. Both land on /reset-password (the set-password screen, signed in
 * on success); both send the recovery email through the tenant's own provider.
 *
 * TWO CALLER MODES, ONE ENDPOINT:
 *   • CLIENT (no Authorization header): body { email }. ALWAYS answers the same
 *     neutral { ok: true } whether or not the account exists — no existence leak.
 *     A recovery link is generated and emailed only when the address has a
 *     password-capable account; the link is NEVER returned to an unauthenticated
 *     caller.
 *   • STAFF (Bearer token, verified staff): body { email } or { contactId }.
 *     Returns { ok, emailed, link, googleOnly } — the copyable link is the
 *     fallback the owner asked for, so staff can read it over the phone when the
 *     email does not send.
 *
 * A Google-only account has no password to reset. The client path says so in the
 * neutral confirmation (the page names both cases); the staff path reports it as
 * `googleOnly` so the record can show "this account uses Google" instead of a
 * link that would do nothing.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';

/** The recovery email body. A security email the tenant does not reword, so it is
 *  inline rather than a DB template with its own editor (D13 governs tenant CONTENT;
 *  a password-reset link is not that). */
function recoveryHtml(link: string, brand: string, footer: string | null): string {
  return `
    <p>We received a request to set a new password for your ${brand} account.</p>
    <p><a href="${link}">Set a new password</a></p>
    <p>If you did not ask for this, you can ignore this email — your password is unchanged.</p>
    ${footer ? `<hr /><p style="color:#6b7280;font-size:12px">${footer}</p>` : ''}
  `;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: { email?: string; contactId?: string; classify?: boolean };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }

  const db = getSupabaseAdmin();
  const origin = req.headers.origin || `https://${req.headers.host}`;
  const redirectTo = `${origin}/reset-password`;

  // ── who is calling? staff (bearer) gets the link back; client never does ──
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let isStaff = false;
  let staffOrg: string | null = null;
  if (bearer) {
    const { data: userData } = await db.auth.getUser(bearer);
    if (userData?.user) {
      const { data: profile } = await db
        .from('profiles').select('is_admin, role, org_id').eq('user_id', userData.user.id).maybeSingle();
      isStaff = Boolean(profile?.is_admin
        || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(profile?.role ?? ''));
      staffOrg = profile?.org_id ?? null;
    }
  }

  // Resolve the target email. Staff may pass a contactId; the client passes their
  // own address.
  let email = (body.email ?? '').trim().toLowerCase();
  if (!email && isStaff && body.contactId) {
    const { data: c } = await db.from('contacts')
      .select('email, org_id').eq('id', body.contactId).maybeSingle();
    if (c && (!staffOrg || c.org_id === staffOrg)) email = (c.email ?? '').toLowerCase();
  }
  if (!email) {
    // A staff caller with no resolvable target is a real error; a client with no
    // email is a bad request too, but still give nothing away.
    return isStaff
      ? res.status(400).json({ error: 'no email to send a reset to' })
      : res.status(200).json({ ok: true });
  }

  try {
    // Does a password-capable account exist for this address? Look up the auth
    // user and its identities. Google-only = no password to reset.
    const { data: userRow } = await db
      .from('profiles').select('user_id').ilike('email', email).limit(1).maybeSingle();
    let googleOnly = false;
    const hasAccount = Boolean(userRow?.user_id);

    if (userRow?.user_id) {
      // The admin API is the way to read a user's identities server-side (the
      // auth schema is not exposed through PostgREST). Google-only = every
      // identity is google, so there is no password to reset.
      const { data: full } = await db.auth.admin.getUserById(userRow.user_id);
      const providers = (full?.user?.identities ?? []).map((i) => i.provider);
      googleOnly = providers.length > 0 && providers.every((p) => p === 'google');
    }

    // ⚠️ FIX ROUND 2d — CLASSIFY FOR THE LOGIN FORM. After a failed password
    // sign-in, the login form asks which of two cases it is: the email matches an
    // account (→ offer a reset) or it does not (→ the account-recovery path). It
    // sends nothing; it only reports {exists, googleOnly}. A Google account never
    // reaches a password failure (it signs in through Google), so googleOnly is
    // reported for completeness but the login form only acts on `exists`.
    if (body.classify) {
      return res.status(200).json({ ok: true, exists: hasAccount, googleOnly });
    }

    let emailed = false;
    let link: string | null = null;

    // Generate + send a recovery link only for a password-capable account. A
    // Google-only account gets nothing (there is no password), and a missing
    // account gets nothing — both are invisible to a client caller.
    if (hasAccount && !googleOnly) {
      const { data: gen, error: genErr } = await db.auth.admin.generateLink({
        type: 'recovery', email, options: { redirectTo },
      });
      if (!genErr && gen?.properties?.action_link) {
        link = gen.properties.action_link;
        let identity = { fromName: 'French Heritage Equestrian', fromEmail: '', footer: '' as string | null };
        if (staffOrg) { try { identity = await resolveTenantEmailIdentity(db, staffOrg); } catch { /* fall back */ } }
        else {
          // Client path: resolve the identity from the account's own org.
          const { data: p } = await db.from('profiles').select('org_id').eq('user_id', userRow!.user_id).maybeSingle();
          if (p?.org_id) { try { identity = await resolveTenantEmailIdentity(db, p.org_id); } catch { /* fall back */ } }
        }
        const sent = await sendViaProvider({
          to: email, fromName: identity.fromName, fromEmail: identity.fromEmail,
          subject: 'Set a new password', html: recoveryHtml(link, identity.fromName, identity.footer),
        });
        emailed = sent.ok;
      }
    }

    // CLIENT: always the same neutral answer, no link, no existence signal.
    if (!isStaff) return res.status(200).json({ ok: true });

    // STAFF: the full picture, including the copyable fallback link.
    return res.status(200).json({ ok: true, hasAccount, googleOnly, emailed, link });
  } catch (err) {
    console.error('account-reset error', err);
    // Even on error, never leak existence to a client caller.
    return isStaff
      ? res.status(500).json({ error: 'could not generate a reset link' })
      : res.status(200).json({ ok: true });
  }
}
