/* POST /api/deliver-evaluation-report
 * Server-only. Renders a delivered evaluation report to a PDF (same pdf-lib
 * pipeline as signed documents) and emails it as an attachment:
 *   - action 'email' (default): email the report to the buyer (self-serve
 *     "email me a copy"), logged as an access event.
 *   - action 'share': email the report to a share recipient (email or contact),
 *     the share row is created by share_evaluation_report first.
 *
 * Body: { reportId: string, action?: 'email' | 'share', toEmail?: string }
 * -> 200 { emailed: boolean }
 * -> 400 missing reportId / 404 report not found / 409 report not delivered
 *
 * The report carries its own org_id; the email identity is resolved per-tenant.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';
import { renderDocumentPdf, pdfFileName } from './_lib/documentPdf.js';
import { resolveMinorRecipient, notifyMinorRecipientsSkipped } from './_lib/delivery.js';
import type { GuardianRecipient } from './_lib/delivery.js';

interface ReportRow {
  id: string;
  org_id: string;
  contact_id: string;
  title: string;
  horse_label: string | null;
  body: string | null;
  status: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: Record<string, unknown>;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const reportId = typeof body.reportId === 'string' ? body.reportId.trim() : '';
  const action = body.action === 'share' ? 'share' : 'email';
  const toEmailInput = typeof body.toEmail === 'string' ? body.toEmail.trim() : '';
  if (!reportId) return res.status(400).json({ error: 'reportId required' });

  try {
    const db = getSupabaseAdmin();

    const { data: reportRaw, error: rErr } = await db
      .from('evaluation_reports')
      .select('id, org_id, contact_id, title, horse_label, body, status')
      .eq('id', reportId)
      .is('deleted_at', null)
      .maybeSingle();
    if (rErr) throw rErr;
    const report = reportRaw as ReportRow | null;
    if (!report) return res.status(404).json({ error: 'report not found' });
    if (report.status !== 'delivered') {
      return res.status(409).json({ error: `report not delivered (status=${report.status})` });
    }

    // Resolve the recipient email. C10: only the internal contact-resolved
    // path is guarded — an explicit toEmailInput is an operator/self-typed
    // share address, not a "resolved recipient contact".
    let toEmail = toEmailInput;
    let guardianRecipient: GuardianRecipient | null = null;
    let minorLabel: string | null = null;
    if (!toEmail) {
      const { data: contact } = await db
        .from('contacts').select('email, first_name, last_name')
        .eq('id', report.contact_id).maybeSingle();
      const minorResolution = await resolveMinorRecipient(db, report.contact_id);
      if (minorResolution) {
        if (minorResolution.guardian) {
          toEmail = minorResolution.guardian.email;
          guardianRecipient = minorResolution.guardian;
          minorLabel = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || null;
        } else {
          const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || report.contact_id;
          await notifyMinorRecipientsSkipped(db, report.org_id, '/app/ops/contacts', [name]);
          return res.status(400).json({ error: 'recipient is a minor with no guardian email on file' });
        }
      } else {
        toEmail = (contact?.email as string | null) ?? '';
      }
    }
    if (!toEmail) return res.status(400).json({ error: 'no recipient email' });

    // Render the report PDF (title + body → same document PDF pipeline). The
    // heading is the PDF's, built here because a filename is not correspondence;
    // the SUBJECT line composes the same two parts from tokens in the template.
    const heading = report.horse_label ? `${report.title} — ${report.horse_label}` : report.title;
    const pdfBytes = await renderDocumentPdf(heading, report.body ?? '');
    const attachment = { filename: pdfFileName(heading), content: pdfBytes, contentType: 'application/pdf' };

    const identity = await resolveTenantEmailIdentity(db, report.org_id);
    // Three voices — buyer's own copy, shared copy, guardian copy — are three
    // branches of the EVALUATION_REPORT row now, not three ternaries here.
    const rendered = await renderEmailTemplate(db, 'EVALUATION_REPORT', {
      'ORG.BRAND_NAME': identity.fromName,
      'ORG.FOOTER': identity.footer,
      'DOC.TITLE': report.title,
      'HORSE.LABEL': report.horse_label ?? '',
      'PARTY.GREETING_NAME': guardianRecipient ? (guardianRecipient.firstName ?? '') : '',
      'PARTY.FULL_NAME': guardianRecipient ? (minorLabel ?? '') : '',
      'MSG.IS_GUARDIAN_COPY': guardianRecipient ? '1' : '',
      'MSG.IS_SHARE': action === 'share' ? '1' : '',
    });
    if (!rendered) return res.status(502).json({ emailed: false, error: 'email send failed' });

    const sent = await sendViaProvider({
      to: toEmail,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: rendered.subject,
      html: rendered.html,
      attachments: [attachment],
    });
    if (!sent.ok) return res.status(502).json({ emailed: false, error: 'email send failed' });

    // Audit the delivery/share email.
    await db.rpc('log_evaluation_report_access', {
      p_report_id: reportId,
      p_action: action === 'share' ? 'shared' : 'emailed',
      p_detail: toEmail,
    });

    return res.status(200).json({ emailed: true });
  } catch (err) {
    console.error('deliver-evaluation-report error', err);
    return res.status(500).json({ error: 'internal error' });
  }
}
