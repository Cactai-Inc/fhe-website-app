/* POST /api/contract-working-copy
 * Email the CURRENT state of a contract to the caller as a PDF.
 *
 * Body: { documentId: string }
 * -> 200 { emailed: true, to }        on success
 * -> 400 missing documentId
 * -> 403 caller is neither staff nor a party to the document
 * -> 404 document not found
 * -> 409 the caller has no email address on file
 *
 * WHY THIS IS SEPARATE FROM /api/deliver-documents. That endpoint refuses
 * anything not EXECUTED (409) — deliberately, so a half-finished agreement can
 * never be sent out as if it were signed. This one exists for the opposite need:
 * a party wants to show the contract AS IT STANDS to an adviser, with the
 * unselected options and empty fields still visible, precisely so a lawyer can
 * see the choices before they are made.
 *
 * Two things keep the distinction honest:
 *   • It only ever emails the CALLER. There is no recipient parameter, so this
 *     cannot become a back door for sending an unsigned contract to a third
 *     party under the appearance of a finished document.
 *   • The PDF is titled and headed "WORKING COPY — NOT EXECUTED" with the
 *     timestamp it was generated, so a printed page cannot be mistaken for the
 *     agreement itself.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';
import { renderDocumentPdf, pdfFileName } from './_lib/documentPdf.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: Record<string, unknown>;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const documentId = typeof body.documentId === 'string' ? body.documentId : '';
  if (!documentId) return res.status(400).json({ error: 'documentId required' });

  // The caller's identity comes from their bearer token, never from the body —
  // otherwise anyone could name any recipient.
  const auth = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!auth) return res.status(403).json({ error: 'sign in required' });

  const admin = getSupabaseAdmin();
  const { data: userData, error: userErr } = await admin.auth.getUser(auth);
  if (userErr || !userData?.user) return res.status(403).json({ error: 'sign in required' });
  const userId = userData.user.id;

  const { data: prof } = await admin
    .from('profiles')
    .select('contact_id, email, first_name, role')
    .eq('user_id', userId)
    .maybeSingle();
  const contactId = (prof as { contact_id: string | null } | null)?.contact_id ?? null;

  const { data: doc } = await admin
    .from('documents')
    .select('id, org_id, title, display_code, merged_body, status')
    .eq('id', documentId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!doc) return res.status(404).json({ error: 'document not found' });

  // Staff of the org, or a party to this document. Anyone else is refused.
  const isStaff = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE']
    .includes(((prof as { role?: string } | null)?.role ?? '').toUpperCase());
  let allowed = isStaff;
  if (!allowed && contactId) {
    const { count } = await admin
      .from('document_parties')
      .select('document_id', { count: 'exact', head: true })
      .eq('document_id', documentId)
      .eq('contact_id', contactId);
    allowed = (count ?? 0) > 0;
  }
  if (!allowed) return res.status(403).json({ error: 'not a party to this contract' });

  // Prefer the contact's email — it is the person record the rest of the system
  // treats as authoritative — and fall back to the account's.
  let to: string | null = (prof as { email?: string | null } | null)?.email ?? null;
  if (contactId) {
    const { data: c } = await admin.from('contacts').select('email, first_name')
      .eq('id', contactId).maybeSingle();
    to = (c as { email?: string | null } | null)?.email ?? to;
  }
  if (!to) return res.status(409).json({ error: 'no email address on file for your account' });

  const when = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const banner =
    `WORKING COPY — NOT EXECUTED\n`
    + `Generated ${when}\n`
    + `This reflects the contract as it stands right now. Options that have not been\n`
    + `selected and fields that have not been filled are shown as they appear in the\n`
    + `editor, so an adviser can see the choices still open.\n\n`;

  const title = `${doc.title ?? 'Contract'} (working copy)`;
  const pdf = await renderDocumentPdf(title, banner + (doc.merged_body ?? ''));

  const identity = await resolveTenantEmailIdentity(admin, doc.org_id as string);
  // The banner above stays in code — it is stamped INTO the PDF, which is
  // evidence about the document's state, not correspondence. The email around it
  // is the CONTRACT_WORKING_COPY row.
  const rendered = await renderEmailTemplate(admin, 'CONTRACT_WORKING_COPY', {
    'DOC.HAS_TITLE': doc.title != null ? '1' : '',
    'DOC.TITLE': (doc.title as string | null) ?? '',
    'DOC.DISPLAY_CODE': (doc.display_code as string | null) ?? '',
    'MSG.GENERATED_AT': when,
  });
  if (!rendered) return res.status(502).json({ error: 'could not send the email' });

  const sent = await sendViaProvider({
    to,
    fromName: identity.fromName,
    fromEmail: identity.fromEmail,
    subject: rendered.subject,
    html: rendered.html,
    attachments: [{
      filename: pdfFileName(title),
      content: pdf,
      contentType: 'application/pdf',
    }],
  });

  if (!sent.ok) return res.status(502).json({ error: 'could not send the email' });
  return res.status(200).json({ emailed: true, to });
}
