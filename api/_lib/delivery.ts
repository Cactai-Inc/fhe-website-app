/* Shared delivery logic for an EXECUTED document's party+company emails.
 * Extracted from api/deliver-document.ts (H2 hardening) so the release-signing
 * path can invoke it in-process (server-to-server, no HTTP hop) instead of the
 * browser firing an unauthenticated POST to the HTTP endpoint. The HTTP
 * endpoint and this direct call now share one implementation — no parallel
 * sender.
 *
 * Behavior is verbatim from the pre-hardening handler: idempotent per
 * (document_id, recipient_contact_id, channel='EMAIL'), 404/409 via thrown
 * DeliveryError, org-isolated identity resolution, tamper-evidence hash lines,
 * facility-rules-tail stripping on party copies only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTenantEmailIdentity, sendViaProvider } from './email.js';

const CHANNEL = 'EMAIL';
const TEMPLATE = 'contract_executed';
import { renderTemplate } from './email.js';

const SIGNATURE_LINE_RE = /^((?:Signature|By \(signature\)):\s*)(.+)$/gm;
const SIGNATURE_SPAN_STYLE =
  "font-family:'Snell Roundhand','Segoe Script','Brush Script MT',cursive;font-size:1.4em";
function withSignatureScript(body: string): string {
  return body.replace(
    SIGNATURE_LINE_RE,
    (_m, label: string, name: string) =>
      `${label}<span style="${SIGNATURE_SPAN_STYLE}">${name}</span>`,
  );
}

const FACILITY_RULES_TAIL_RE = /\n+FACILITY RULES ACKNOWLEDGMENT\n[\s\S]*$/;
function stripFacilityRulesTail(body: string): string {
  return body.replace(FACILITY_RULES_TAIL_RE, '\n');
}

interface PartyRow {
  contact_id: string;
  contacts: { email: string | null; first_name: string | null; last_name: string | null } | null;
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
  const partyHashHtml = executionHash
    ? `<p style="color:#666;font-size:12px">This document's integrity code: ${executionHash.slice(0, 16)}…</p>`
    : '';
  const companyHashHtml = executionHash
    ? `<hr/><p style="color:#666;font-size:12px">Integrity hash (SHA-256): ${executionHash}</p>`
    : '';

  const delivered: Array<{ recipientContactId: string; channel: string; emailed: boolean }> = [];

  // 5. Per party: dedupe, email, then (only on a successful send) record delivery.
  for (const party of parties) {
    if (alreadyDelivered.has(party.contact_id)) continue; // idempotent — skip
    const email = party.contacts?.email;
    if (!email) continue; // no address -> cannot email; skip (no orphan row)

    const { subject, body: inner } = renderTemplate(
      TEMPLATE,
      { documentTitle: doc.title, recipientName: party.contacts?.first_name },
      identity.fromName,
    );
    const footerHtml = identity.footer
      ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
      : '';
    const docHtml = doc.merged_body
      ? `<hr/><pre style="font-family:inherit;white-space:pre-wrap">${withSignatureScript(stripFacilityRulesTail(doc.merged_body))}</pre>`
      : '';
    const html = `${inner}${docHtml}${partyHashHtml}${footerHtml}`;

    const sent = await sendViaProvider({
      to: email,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject,
      html,
    });
    if (!sent.ok) continue;

    const { error: insErr } = await db.from('document_deliveries').insert({
      document_id: documentId,
      recipient_contact_id: party.contact_id,
      channel: CHANNEL,
      copy_url: copyUrl,
      org_id: doc.org_id,
    });
    if (insErr) throw insErr;

    alreadyDelivered.add(party.contact_id); // guard against duplicate parties in one call
    delivered.push({ recipientContactId: party.contact_id, channel: CHANNEL, emailed: true });
  }

  // 6. Company copy: notify the org's public inbox once per document (skip if
  //    the inbox already received a party copy; best-effort, never fails the call).
  let companyNotified = false;
  const partyEmails = new Set(parties.map((p) => p.contacts?.email?.toLowerCase()).filter(Boolean));
  if (identity.contactEmail && !partyEmails.has(identity.contactEmail.toLowerCase()) && delivered.length > 0) {
    const signers = parties
      .map((p) => [p.contacts?.first_name, p.contacts?.last_name].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(', ');
    const notice = await sendViaProvider({
      to: identity.contactEmail,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: `Signed: ${doc.title} (${doc.display_code ?? documentId.slice(0, 8)})`,
      html: `<p>${signers || 'A signer'} executed <strong>${doc.title}</strong>.</p>`
        + (doc.merged_body ? `<pre style="font-family:inherit;white-space:pre-wrap">${withSignatureScript(doc.merged_body)}</pre>` : '')
        + companyHashHtml,
    });
    companyNotified = notice.ok;
  }

  return { delivered, companyNotified, status: doc.status };
}
