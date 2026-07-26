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
import { renderDocumentPdf, pdfFileName } from './_lib/documentPdf.js';

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

    // Resolve the recipient email.
    let toEmail = toEmailInput;
    if (!toEmail) {
      const { data: contact } = await db
        .from('contacts').select('email, first_name')
        .eq('id', report.contact_id).maybeSingle();
      toEmail = (contact?.email as string | null) ?? '';
    }
    if (!toEmail) return res.status(400).json({ error: 'no recipient email' });

    // Render the report PDF (title + body → same document PDF pipeline).
    const heading = report.horse_label ? `${report.title} — ${report.horse_label}` : report.title;
    const pdfBytes = await renderDocumentPdf(heading, report.body ?? '');
    const attachment = { filename: pdfFileName(heading), content: pdfBytes, contentType: 'application/pdf' };

    const identity = await resolveTenantEmailIdentity(db, report.org_id);
    const footerHtml = identity.footer
      ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
      : '';
    const intro = action === 'share'
      ? `<p>A horse evaluation report has been shared with you${report.horse_label ? ` for ${report.horse_label}` : ''}. It's attached to this email.</p>`
      : `<p>Your horse evaluation report${report.horse_label ? ` for ${report.horse_label}` : ''} is attached to this email.</p>`;

    const sent = await sendViaProvider({
      to: toEmail,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: `${heading} — ${identity.fromName}`,
      html: `<p>Hello,</p>${intro}<p>Please keep it for your records.</p>${footerHtml}`,
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
