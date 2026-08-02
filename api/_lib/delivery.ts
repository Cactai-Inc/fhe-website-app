/* Shared delivery logic for an EXECUTED document's party+company emails.
 * Extracted from api/deliver-document.ts (H2 hardening) so the release-signing
 * path can invoke it in-process (server-to-server, no HTTP hop) instead of the
 * browser firing an unauthenticated POST to the HTTP endpoint. The HTTP
 * endpoint and this direct call now share one implementation — no parallel
 * sender.
 *
 * Idempotent per (document_id, recipient_contact_id, channel='EMAIL'); 404/409
 * surfaced via thrown DeliveryError; identity resolution is org-isolated
 * (§15) — a document is never delivered with another tenant's brand.
 *
 * Post-H2 owner-reported defects fixed here (2026-08-02), found via a real
 * production send during H2 verification:
 *  - document_deliveries has NO org_id column (deliver-documents.ts already
 *    knew this — see its own comment); the insert was throwing on every call,
 *    AFTER the email had already sent, so sends looked successful with no
 *    delivery row ever recorded. Root cause of the "delivery never recorded"
 *    finding — not an env/provider issue.
 *  - the party copy inlined the raw merged_body as a <pre> block instead of
 *    attaching a formatted PDF (deliver-documents.ts's own pattern, via
 *    renderDocumentPdf/pdfFileName, reused here instead of a second one).
 *  - contract_executed's subject was hardcoded ("Your contract is executed"),
 *    never the actual document title.
 *  - the email had no greeting/signature structure, just one inline sentence.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTenantEmailIdentity, sendViaProvider } from './email.js';
import type { EmailAttachment } from './email.js';
import { renderDocumentPdf, pdfFileName } from './documentPdf.js';

const CHANNEL = 'EMAIL';

const FACILITY_RULES_TAIL_RE = /\n+FACILITY RULES ACKNOWLEDGMENT\n[\s\S]*$/;
function stripFacilityRulesTail(body: string): string {
  return body.replace(FACILITY_RULES_TAIL_RE, '\n');
}

interface PartyRow {
  contact_id: string;
  contacts: { email: string | null; first_name: string | null; last_name: string | null } | null;
}

export interface PartyCopyEmail {
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

/** Render the party-copy PDF once (the facility-rules tail stripped) — shared
 *  so a multi-recipient send (deliverExecutedDocument) renders it a single
 *  time rather than once per party. */
export async function renderPartyCopyPdf(doc: { title: string; merged_body: string | null }): Promise<EmailAttachment | null> {
  const text = doc.merged_body ? stripFacilityRulesTail(doc.merged_body) : '';
  if (!text) return null;
  const bytes = await renderDocumentPdf(doc.title, text);
  return { filename: pdfFileName(doc.title), content: bytes, contentType: 'application/pdf' };
}

/** Build a party's "your document is executed" email — subject (with the real
 *  document title), greeting/body/signature, and the PDF attachment. Shared
 *  by deliverExecutedDocument (the all-parties sender) and
 *  api/deliver-my-document.ts (the authenticated self-send) — one source of
 *  the party-copy email shape, not two. `attachment` is passed in (rather
 *  than rendered inside) so a multi-recipient caller can render it once and
 *  reuse it across every party's email. */
export function buildPartyCopyEmail(
  doc: { title: string; execution_hash: string | null },
  recipientFirstName: string | null | undefined,
  identity: { fromName: string; footer: string | null },
  attachment: EmailAttachment | null,
): PartyCopyEmail {
  const executionHash = typeof doc.execution_hash === 'string' && doc.execution_hash.trim() !== ''
    ? doc.execution_hash.trim()
    : null;
  const partyHashHtml = executionHash
    ? `<p style="color:#666;font-size:12px">This document's integrity code: ${executionHash.slice(0, 16)}…</p>`
    : '';
  const footerHtml = identity.footer
    ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
    : '';
  const greeting = recipientFirstName ? `Hi ${recipientFirstName},` : 'Hello,';
  const html =
    `<p>${greeting}</p>` +
    `<p>Your document <strong>${doc.title}</strong> has been fully executed. ` +
    `A PDF copy is attached for your records.</p>` +
    `<p>Thank you,<br/>${identity.fromName}</p>` +
    partyHashHtml + footerHtml;

  return { subject: `${doc.title} — signed and executed`, html, attachments: attachment ? [attachment] : [] };
}

export class DeliveryError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface DeliverExecutedDocumentResult {
  delivered: Array<{ recipientContactId: string; channel: string; emailed: boolean }>;
  companyNotified: boolean;
  status: string;
}

/** Deliver an EXECUTED document's party + company copies. Throws DeliveryError
 *  (404 missing, 409 not EXECUTED) — callers map that to their own response
 *  shape. Idempotent: safe to call more than once for the same document. */
export async function deliverExecutedDocument(
  db: SupabaseClient,
  documentId: string,
): Promise<DeliverExecutedDocumentResult> {
  // 1. Load the document (status + org + title). No delivery unless EXECUTED.
  const { data: doc, error: docErr } = await db
    .from('documents')
    .select('id, org_id, status, title, display_code, merged_body, execution_hash')
    .eq('id', documentId)
    .maybeSingle();
  if (docErr) throw docErr;
  if (!doc) throw new DeliveryError(404, 'document not found');

  if (doc.status !== 'EXECUTED') {
    throw new DeliveryError(409, `document not EXECUTED (status=${doc.status})`);
  }

  // 2. Recipients = the document's parties (+ their contact email).
  const { data: partiesRaw, error: partyErr } = await db
    .from('document_parties')
    .select('contact_id, contacts:contact_id (email, first_name, last_name)')
    .eq('document_id', documentId);
  if (partyErr) throw partyErr;
  const parties = (partiesRaw ?? []) as unknown as PartyRow[];

  // 3. Idempotency set: (document, recipient, EMAIL) already delivered.
  const { data: existingRaw, error: existErr } = await db
    .from('document_deliveries')
    .select('recipient_contact_id')
    .eq('document_id', documentId)
    .eq('channel', CHANNEL);
  if (existErr) throw existErr;
  const alreadyDelivered = new Set(
    (existingRaw ?? []).map((r: { recipient_contact_id: string }) => r.recipient_contact_id),
  );

  // 4. Resolve the tenant-branded identity ONCE, scoped to the document's org.
  const identity = await resolveTenantEmailIdentity(db, doc.org_id);
  const copyUrl = `/portal/documents/${documentId}`;

  const executionHash = typeof doc.execution_hash === 'string' && doc.execution_hash.trim() !== ''
    ? doc.execution_hash.trim()
    : null;
  const companyHashHtml = executionHash
    ? `<hr/><p style="color:#666;font-size:12px">Integrity hash (SHA-256): ${executionHash}</p>`
    : '';

  const delivered: Array<{ recipientContactId: string; channel: string; emailed: boolean }> = [];

  // The PDF is identical for every recipient — render it once, reuse it.
  const partyAttachment = await renderPartyCopyPdf(doc);

  // 5. Per party: dedupe, email, then (only on a successful send) record delivery.
  for (const party of parties) {
    if (alreadyDelivered.has(party.contact_id)) continue; // idempotent — skip
    const email = party.contacts?.email;
    if (!email) continue; // no address -> cannot email; skip (no orphan row)

    const partyEmail = buildPartyCopyEmail(doc, party.contacts?.first_name, identity, partyAttachment);
    const sent = await sendViaProvider({
      to: email,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: partyEmail.subject,
      html: partyEmail.html,
      attachments: partyEmail.attachments,
    });
    if (!sent.ok) continue;

    const { error: insErr } = await db.from('document_deliveries').insert({
      document_id: documentId,
      recipient_contact_id: party.contact_id,
      channel: CHANNEL,
      copy_url: copyUrl,
    });
    if (insErr) throw insErr;

    alreadyDelivered.add(party.contact_id); // guard against duplicate parties in one call
    delivered.push({ recipientContactId: party.contact_id, channel: CHANNEL, emailed: true });
  }

  // 6. Company copy: notify the org's public inbox once per document (skip if
  //    the inbox already received a party copy; best-effort, never fails the call).
  // Company copy keeps the FULL stored body (acknowledgment block included),
  // rendered to its own PDF since it differs from the party copy's stripped text.
  let companyNotified = false;
  const partyEmails = new Set(parties.map((p) => p.contacts?.email?.toLowerCase()).filter(Boolean));
  if (identity.contactEmail && !partyEmails.has(identity.contactEmail.toLowerCase()) && delivered.length > 0) {
    const signers = parties
      .map((p) => [p.contacts?.first_name, p.contacts?.last_name].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(', ');
    let companyAttachment: EmailAttachment | null = null;
    if (doc.merged_body) {
      const bytes = await renderDocumentPdf(doc.title, doc.merged_body);
      companyAttachment = { filename: pdfFileName(doc.title), content: bytes, contentType: 'application/pdf' };
    }
    const notice = await sendViaProvider({
      to: identity.contactEmail,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: `${doc.title} — signed and executed (${doc.display_code ?? documentId.slice(0, 8)})`,
      html: `<p>${signers || 'A signer'} executed <strong>${doc.title}</strong>. The signed PDF is attached.</p>`
        + companyHashHtml,
      attachments: companyAttachment ? [companyAttachment] : undefined,
    });
    companyNotified = notice.ok;
  }

  return { delivered, companyNotified, status: doc.status };
}
