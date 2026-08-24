/* POST /api/documents-requested
 * Staff-only. Ask a person to sign one or more documents, and TELL THEM NOW.
 *
 * Body: { contactId, templateKeys: string[], disposition?: 'AT_LOGIN'|'WITH_CONTRACT'|'WHEN_READY' }
 * Header: Authorization: Bearer <supabase access token of a staff member>
 *
 * Owner, 2026-08-24: "We need to use the manual email trigger so it sends when an
 * event happens."
 *
 * The in-app notification always fired the moment staff asked; the EMAIL was
 * riding NOTIFICATION_DIGEST, a daily Vercel cron that has never run on this
 * project — so a person could owe four documents and be told about it inside an
 * app they had no reason to open. This is the immediate send.
 *
 * ORDER MATTERS, and it is deliberate: the requirement and the notification are
 * written FIRST, by the RPC, in one transaction. The email is best-effort on top.
 * A mail failure must never mean the person was not actually asked — that is the
 * shape TASK-PAMELA's invitation path already uses, for the same reason.
 *
 * `notifications.emailed_at` is stamped only on a successful send, so if the
 * digest cron is ever switched on it cannot deliver a second copy of something
 * this endpoint already delivered.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate, escapeHtml } from './_lib/emailTemplates.js';

interface RequestResult {
  count: number;
  titles: string[];
  email: string | null;
  first_name: string | null;
  org_id: string;
  notification_id: string | null;
  has_account: boolean;
  disposition: string;
}

/** What the person is being told about WHEN, in their words rather than ours. */
function whenLine(disposition: string): string {
  switch (disposition) {
    case 'AT_LOGIN':
      return 'These need to be signed before you can use your account, so it is worth '
        + 'doing now — it only takes a few minutes.';
    case 'WITH_CONTRACT':
      return 'These go with your contract and will be ready to sign alongside it.';
    default:
      return 'There is no rush — sign whenever suits you, and we will keep them '
        + 'waiting for you when you sign in.';
  }
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

  const contactId = typeof body.contactId === 'string' ? body.contactId.trim() : '';
  const templateKeys = Array.isArray(body.templateKeys)
    ? body.templateKeys.map((k) => String(k).trim()).filter(Boolean) : [];
  const disposition = ['AT_LOGIN', 'WITH_CONTRACT', 'WHEN_READY'].includes(body.disposition as string)
    ? (body.disposition as string) : 'WHEN_READY';
  if (!contactId) return res.status(400).json({ error: 'contactId required' });
  if (templateKeys.length === 0) return res.status(400).json({ error: 'templateKeys required' });

  try {
    const db = getSupabaseAdmin();

    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('is_admin, role, org_id').eq('user_id', userData.user.id).maybeSingle();
    const isStaff = profile?.is_admin
      || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(profile?.role ?? '');
    if (!profile || !isStaff) return res.status(403).json({ error: 'forbidden' });

    // The requirement + the in-app notification, in one transaction. This RPC
    // refuses a template with no active version, so an unsignable obligation
    // cannot be created here either.
    const { data, error: rpcErr } = await db.rpc('request_documents_from_contact', {
      p_contact_id: contactId, p_template_keys: templateKeys, p_disposition: disposition,
    });
    if (rpcErr) {
      return res.status(/no active template|staff access|not found/i.test(rpcErr.message) ? 400 : 500)
        .json({ error: rpcErr.message });
    }
    const out = data as RequestResult;

    // No login yet → nothing to send. They meet the documents when they activate.
    if (!out.has_account || !out.email) {
      return res.status(200).json({ ...out, emailed: false, emailSkipped: 'no account yet' });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const identity = await resolveTenantEmailIdentity(db, out.org_id);
    const plural = out.count === 1 ? 'a document' : `${out.count} documents`;
    const rendered = await renderEmailTemplate(db, 'DOCUMENTS_REQUESTED', {
      'ORG.BRAND_NAME': identity.fromName,
      'ORG.FOOTER': identity.footer,
      'PARTY.FIRST_NAME': escapeHtml(out.first_name || 'there'),
      'MSG.SUBJECT_TAIL': out.count === 1
        ? 'a document needs your signature'
        : `${out.count} documents need your signature`,
      'MSG.INTRO': `We have ${plural} ready for you to review and sign.`,
      'MSG.DOCUMENT_LIST': out.titles.map((t) => `<li>${escapeHtml(t)}</li>`).join(''),
      'MSG.WHEN': whenLine(out.disposition),
      'MSG.LINK': `${origin}/app/onboarding`,
    });
    if (!rendered) {
      // They ARE asked — the requirement and the notification are committed. Say
      // plainly that the email did not go, rather than implying it did.
      return res.status(200).json({
        ...out, emailed: false,
        emailError: 'the DOCUMENTS_REQUESTED email template is missing or deactivated',
      });
    }

    const sent = await sendViaProvider({
      to: out.email,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: rendered.subject,
      html: rendered.html,
    });

    // Stamped only on success — an unsent notification must stay eligible for
    // whatever delivers it next.
    if (sent.ok && out.notification_id) {
      await db.from('notifications')
        .update({ emailed_at: new Date().toISOString() })
        .eq('id', out.notification_id);
    }

    return res.status(200).json({
      ...out,
      emailed: sent.ok,
      ...(sent.ok ? {} : { emailError: sent.error ?? 'send failed' }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'could not ask for those documents';
    console.error('documents-requested', message, err);
    return res.status(500).json({ error: message });
  }
}
