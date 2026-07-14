/* POST /api/deliver-documents
 * Server-only. Deliver a SET of executed documents (e.g. the four documents of
 * the participant flow) as ONE email with each document attached as a PDF —
 * instead of one text email per document.
 *
 * Body: { documentIds: string[] }
 * -> 200 { delivered:[{email, count}], companyNotified } on success
 * -> 400 on a missing/empty documentIds
 * -> 409 when any document is not EXECUTED (no premature delivery)
 * -> 404 when a document does not exist
 * -> 5xx when a read/render fails
 *
 * Recipients: the union of the documents' engagement parties, grouped by contact
 * email — each distinct signer gets ONE email with all the PDFs. A company copy
 * (org public inbox) receives the same attachments once.
 *
 * Idempotency: a (document, recipient, EMAIL) delivery row is written per
 * document after a successful send, matching /api/deliver-document. A re-invocation
 * that finds every document already delivered to a recipient skips that recipient.
 *
 * PDFs are rendered from documents.merged_body via pdf-lib (pure JS — no headless
 * browser; serverless-safe). Only EXECUTED documents are delivered.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import type { EmailAttachment } from './_lib/email.js';
import { renderDocumentPdf, pdfFileName } from './_lib/documentPdf.js';

const CHANNEL = 'EMAIL';

// The party-copy PDF strips the trailing facility-rules acknowledgment block
// (appended to some kiosk bodies); it stays in the stored doc + company copy.
const FACILITY_RULES_TAIL_RE = /\n+FACILITY RULES ACKNOWLEDGMENT\n[\s\S]*$/;
function stripFacilityRulesTail(body: string): string {
  return body.replace(FACILITY_RULES_TAIL_RE, '\n');
}

interface DocRow {
  id: string;
  org_id: string;
  status: string;
  title: string;
  display_code: string | null;
  merged_body: string | null;
}

interface PartyRow {
  contact_id: string;
  contacts: { email: string | null; first_name: string | null; last_name: string | null } | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: Record<string, unknown>;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const documentIds = Array.isArray(body.documentIds)
    ? (body.documentIds.filter((d) => typeof d === 'string' && d.trim() !== '') as string[])
    : [];
  if (documentIds.length === 0) return res.status(400).json({ error: 'documentIds required' });

  try {
    const db = getSupabaseAdmin();

    // 1. Load all documents. Every one must be EXECUTED and share one org.
    const { data: docsRaw, error: docErr } = await db
      .from('documents')
      .select('id, org_id, status, title, display_code, merged_body')
      .in('id', documentIds);
    if (docErr) throw docErr;
    const docs = (docsRaw ?? []) as DocRow[];
    if (docs.length !== documentIds.length) {
      return res.status(404).json({ error: 'one or more documents not found' });
    }
    const notExecuted = docs.find((d) => d.status !== 'EXECUTED');
    if (notExecuted) {
      return res
        .status(409)
        .json({ error: `document not EXECUTED (id=${notExecuted.id}, status=${notExecuted.status})` });
    }
    const orgId = docs[0].org_id;

    // 2. Render each document to a PDF once (party version = rules-tail stripped).
    const pdfs: Array<{ docId: string; attachment: EmailAttachment }> = [];
    for (const d of docs) {
      const text = stripFacilityRulesTail(d.merged_body ?? '');
      const bytes = await renderDocumentPdf(d.title, text);
      pdfs.push({
        docId: d.id,
        attachment: { filename: pdfFileName(d.title), content: bytes, contentType: 'application/pdf' },
      });
    }
    const allAttachments = pdfs.map((p) => p.attachment);

    // 3. Recipients = union of all documents' parties, grouped by contact.
    const { data: partiesRaw, error: partyErr } = await db
      .from('document_parties')
      .select('contact_id, contacts:contact_id (email, first_name, last_name)')
      .in('document_id', documentIds);
    if (partyErr) throw partyErr;
    const parties = (partiesRaw ?? []) as unknown as PartyRow[];
    // dedupe by contact_id
    const byContact = new Map<string, PartyRow>();
    for (const p of parties) if (!byContact.has(p.contact_id)) byContact.set(p.contact_id, p);

    // 4. Tenant-branded identity (once, scoped to the docs' org).
    const identity = await resolveTenantEmailIdentity(db, orgId);

    // 5. Existing deliveries across these documents (idempotency).
    const { data: existingRaw, error: existErr } = await db
      .from('document_deliveries')
      .select('document_id, recipient_contact_id')
      .in('document_id', documentIds)
      .eq('channel', CHANNEL);
    if (existErr) throw existErr;
    const deliveredSet = new Set(
      (existingRaw ?? []).map(
        (r: { document_id: string; recipient_contact_id: string }) =>
          `${r.document_id}:${r.recipient_contact_id}`,
      ),
    );

    const titles = docs.map((d) => d.title);
    const listHtml = `<ul>${titles.map((t) => `<li>${t}</li>`).join('')}</ul>`;
    const footerHtml = identity.footer
      ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
      : '';

    const delivered: Array<{ email: string; count: number }> = [];

    // 6. One email per distinct signer, with ALL the PDFs attached.
    for (const party of Array.from(byContact.values())) {
      const email = party.contacts?.email;
      if (!email) continue;
      // Which of these documents still need a delivery row for this recipient?
      const pending = docs.filter((d) => !deliveredSet.has(`${d.id}:${party.contact_id}`));
      if (pending.length === 0) continue; // fully delivered already

      const greeting = party.contacts?.first_name ? `Hi ${party.contacts.first_name},` : 'Hello,';
      const html =
        `<p>${greeting}</p>` +
        `<p>Thank you. Your signed documents are attached to this email:</p>` +
        listHtml +
        `<p>Please keep these for your records.</p>` +
        footerHtml;

      const sent = await sendViaProvider({
        to: email,
        fromName: identity.fromName,
        fromEmail: identity.fromEmail,
        subject: `Your signed documents — ${identity.fromName}`,
        html,
        attachments: allAttachments,
      });
      if (!sent.ok) continue; // no orphan delivery rows without a successful send

      // Record a delivery row per document for this recipient (idempotent set).
      for (const d of pending) {
        const { error: insErr } = await db.from('document_deliveries').insert({
          document_id: d.id,
          recipient_contact_id: party.contact_id,
          channel: CHANNEL,
          copy_url: `/portal/documents/${d.id}`,
          org_id: orgId,
        });
        if (insErr) throw insErr;
        deliveredSet.add(`${d.id}:${party.contact_id}`);
      }
      delivered.push({ email, count: pending.length });
    }

    // 7. Company copy: the org inbox gets one email with all attachments (unless
    //    the inbox was already a party recipient). Best-effort.
    let companyNotified = false;
    const partyEmails = new Set(
      Array.from(byContact.values())
        .map((p) => p.contacts?.email?.toLowerCase())
        .filter(Boolean),
    );
    if (identity.contactEmail && !partyEmails.has(identity.contactEmail.toLowerCase()) && delivered.length > 0) {
      const signers = Array.from(byContact.values())
        .map((p) => [p.contacts?.first_name, p.contacts?.last_name].filter(Boolean).join(' '))
        .filter(Boolean)
        .join(', ');
      const notice = await sendViaProvider({
        to: identity.contactEmail,
        fromName: identity.fromName,
        fromEmail: identity.fromEmail,
        subject: `Signed document set${signers ? ` — ${signers}` : ''}`,
        html: `<p>${signers || 'A signer'} executed the following documents (attached):</p>${listHtml}`,
        attachments: allAttachments,
      });
      companyNotified = notice.ok;
    }

    return res.status(200).json({ delivered, companyNotified, documents: documentIds.length });
  } catch (err) {
    console.error('deliver-documents error', err);
    return res.status(500).json({ error: 'could not deliver documents' });
  }
}
