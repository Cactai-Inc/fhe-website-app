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
import { renderEmailTemplate } from './emailTemplates.js';
import type { TokenMap } from './emailTemplates.js';
import { renderDocumentPdf, pdfFileName, partyPdfFileName } from './documentPdf.js';

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

/** Render the party-copy PDF bytes once (the facility-rules tail stripped) —
 *  shared so a multi-recipient send (deliverExecutedDocument) renders the
 *  content a single time rather than once per party. The filename is signer-
 *  attributed (owner spec) and built separately per recipient by
 *  buildPartyCopyEmail, since it embeds that recipient's initials. */
export async function renderPartyCopyPdfBytes(doc: { title: string; merged_body: string | null }): Promise<Uint8Array | null> {
  const text = doc.merged_body ? stripFacilityRulesTail(doc.merged_body) : '';
  if (!text) return null;
  return renderDocumentPdf(doc.title, text);
}

/** The token values a party's "signed and executed" email merges. Split out from
 *  the send so the byte-identity harness can exercise the mapping without a
 *  database, and so both callers build the same values from the same inputs. */
export function partyCopyTokens(
  doc: { title: string; execution_hash: string | null },
  recipientFirstName: string | null | undefined,
  recipientLastName: string | null | undefined,
  identity: { fromName: string; contactPhone: string | null; contactUrl: string | null; siteUrl: string | null },
  guardianRecipient?: GuardianRecipient | null,
): TokenMap {
  const siteLine = identity.contactUrl || identity.siteUrl;
  // Tamper-evidence: the template shows a short excerpt of this, never the full
  // SHA-256 — that stays company-copy-only (DOC.INTEGRITY_HASH).
  const executionHash = typeof doc.execution_hash === 'string' && doc.execution_hash.trim() !== ''
    ? doc.execution_hash.trim()
    : null;
  return {
    'DOC.TITLE': doc.title,
    'DOC.REFERENCE_CODE': executionHash ? executionHash.slice(0, 12) : '',
    'ORG.BRAND_NAME': identity.fromName,
    'ORG.PHONE': identity.contactPhone ?? '',
    'ORG.PHONE_TEL': identity.contactPhone ? identity.contactPhone.replace(/[^+\d]/g, '') : '',
    'ORG.SITE_LINK': siteLine ?? '',
    'ORG.SITE_HOST': siteLine ? siteLine.replace(/^https?:\/\//, '') : '',
    'MSG.IS_GUARDIAN_COPY': guardianRecipient ? '1' : '',
    'PARTY.GUARDIAN_FIRST_NAME': guardianRecipient?.firstName ?? '',
    'PARTY.FULL_NAME': [recipientFirstName, recipientLastName].filter(Boolean).join(' '),
  };
}

/** Build a party's "signed and executed" email — owner spec (2026-08-02,
 *  revised after comparing against the company-copy style): plain subject
 *  (no personalized greeting — matches the company copy's professional
 *  tone), one-line body, a reference-code line (a short excerpt, not the
 *  full SHA-256 — that stays company-copy-only), and a contact block sized
 *  for easy tapping. Only the PDF FILENAME is personalized (signer initials
 *  + date) — the email content itself is not. Shared by
 *  deliverExecutedDocument (the all-parties sender) and
 *  api/deliver-my-document.ts (the authenticated self-send) — one source of
 *  the party-copy email shape, not two. `pdfBytes` is passed in (rather than
 *  rendered inside) so a multi-recipient caller can render the content once
 *  and reuse it across every party.
 *
 *  EMAILEXTRACT: the wording is now the `DOCUMENT_PARTY_COPY` row. The owner
 *  spec above is preserved as the seeded content, not as string literals. The
 *  attachment and its signer-attributed filename stay here — a filename is not
 *  correspondence. Returns null when the template is missing, so a caller never
 *  mails a blank in place of a document copy. */
export async function buildPartyCopyEmail(
  db: SupabaseClient,
  doc: { title: string; execution_hash: string | null },
  executedAt: Date,
  recipientFirstName: string | null | undefined,
  recipientLastName: string | null | undefined,
  identity: { fromName: string; contactPhone: string | null; contactUrl: string | null; siteUrl: string | null },
  pdfBytes: Uint8Array | null,
  // C10: when set, this copy is guardian-addressed — recipientFirstName/
  // LastName above stay the actual SIGNER's name (the filename stays signer-
  // attributed), while the greeting names the guardian and the body names
  // the minor as the subject of the documents, not as addressee.
  guardianRecipient?: GuardianRecipient | null,
): Promise<PartyCopyEmail | null> {
  const rendered = await renderEmailTemplate(
    db,
    'DOCUMENT_PARTY_COPY',
    partyCopyTokens(doc, recipientFirstName, recipientLastName, identity, guardianRecipient),
  );
  if (!rendered) return null;

  const attachments: EmailAttachment[] = [];
  if (pdfBytes) {
    attachments.push({
      filename: partyPdfFileName(doc.title, recipientFirstName, recipientLastName, executedAt,
        identity.fromName),
      content: pdfBytes,
      contentType: 'application/pdf',
    });
  }

  return { subject: rendered.subject, html: rendered.html, attachments };
}

export class DeliveryError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface GuardianRecipient {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/** C10 — minor downstream rule: a minor recipient's own email is never used
 *  (the DB trigger keeps it null anyway). Returns null when the contact is
 *  not a minor (send normally, unchanged). When the contact IS a minor,
 *  returns `{ guardian }` — either the guardian's { email, firstName,
 *  lastName } to send there instead, or `{ guardian: null }` when there is
 *  no guardian or the guardian has no email, meaning the caller must SKIP
 *  the recipient entirely (no send, no delivery row) rather than fall back
 *  to the minor's own address. */
export async function resolveMinorRecipient(
  db: SupabaseClient,
  contactId: string,
): Promise<{ guardian: GuardianRecipient | null } | null> {
  const { data: isMinor, error: minorErr } = await db.rpc('is_minor_contact', { p_contact_id: contactId });
  if (minorErr) throw minorErr;
  if (!isMinor) return null;

  const { data: contact, error: contactErr } = await db
    .from('contacts').select('guardian_contact_id').eq('id', contactId).maybeSingle();
  if (contactErr) throw contactErr;
  const guardianId = (contact?.guardian_contact_id as string | null) ?? null;
  if (!guardianId) return { guardian: null };

  const { data: guardianRow, error: guardianErr } = await db
    .from('contacts').select('email, first_name, last_name').eq('id', guardianId).maybeSingle();
  if (guardianErr) throw guardianErr;
  if (!guardianRow?.email) return { guardian: null };

  return {
    guardian: {
      email: guardianRow.email as string,
      firstName: (guardianRow.first_name as string | null) ?? null,
      lastName: (guardianRow.last_name as string | null) ?? null,
    },
  };
}

/** Fire ONE staff alert per endpoint invocation listing every minor recipient
 *  skipped for lack of a guardian email — fail closed, never a silent drop. */
export async function notifyMinorRecipientsSkipped(
  db: SupabaseClient,
  orgId: string,
  link: string,
  names: string[],
): Promise<void> {
  if (names.length === 0) return;
  const { error } = await db.rpc('notify_minor_delivery_skipped', { p_org: orgId, p_link: link, p_names: names });
  if (error) console.error('notify_minor_delivery_skipped failed', { orgId, error: error.message });
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
  // NOTE: documents has no signed_at column (that's on signatures/contracts,
  // a different table) — created_at is the execution moment for these kiosk
  // releases, since sign_release creates + executes in one transaction.
  const { data: doc, error: docErr } = await db
    .from('documents')
    .select('id, org_id, status, title, display_code, merged_body, execution_hash, created_at')
    .eq('id', documentId)
    .maybeSingle();
  if (docErr) throw docErr;
  if (!doc) throw new DeliveryError(404, 'document not found');
  const executedAt = new Date(doc.created_at as string);

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

  const delivered: Array<{ recipientContactId: string; channel: string; emailed: boolean }> = [];

  // The PDF content is identical for every recipient — render the bytes once;
  // the filename (signer-attributed) is still built per party below.
  const partyPdfBytes = await renderPartyCopyPdfBytes(doc);

  // C10: minors recipients skipped for lack of a guardian email, collected so
  // ONE staff alert fires per invocation instead of one per skipped party.
  const skippedMinors: string[] = [];

  // 5. Per party: dedupe, email, then (only on a successful send) record delivery.
  for (const party of parties) {
    if (alreadyDelivered.has(party.contact_id)) continue; // idempotent — skip

    let toEmail = party.contacts?.email ?? null;
    let guardianRecipient: GuardianRecipient | null = null;
    const minorResolution = await resolveMinorRecipient(db, party.contact_id);
    if (minorResolution) {
      if (minorResolution.guardian) {
        toEmail = minorResolution.guardian.email;
        guardianRecipient = minorResolution.guardian;
      } else {
        skippedMinors.push(
          [party.contacts?.first_name, party.contacts?.last_name].filter(Boolean).join(' ') || party.contact_id,
        );
        continue; // fail closed — never fall back to the minor's own address
      }
    }
    if (!toEmail) continue; // no address -> cannot email; skip (no orphan row)

    const partyEmail = await buildPartyCopyEmail(
      db, doc, executedAt, party.contacts?.first_name, party.contacts?.last_name, identity, partyPdfBytes,
      guardianRecipient,
    );
    if (!partyEmail) continue; // template missing -> no send, no delivery row, logged
    const sent = await sendViaProvider({
      to: toEmail,
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

  await notifyMinorRecipientsSkipped(db, doc.org_id, '/app/ops/contacts', skippedMinors);

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
    const companyEmail = await renderEmailTemplate(db, 'DOCUMENT_COMPANY_COPY', {
      'DOC.TITLE': doc.title,
      'DOC.DISPLAY_CODE': doc.display_code ?? documentId.slice(0, 8),
      'DOC.INTEGRITY_HASH': executionHash ?? '',
      'PARTY.SIGNERS': signers,
    });
    // Best-effort by design (step 6's contract): a missing template leaves the
    // company copy unsent and logged, and never fails the party deliveries above.
    if (companyEmail) {
      const notice = await sendViaProvider({
        to: identity.contactEmail,
        fromName: identity.fromName,
        fromEmail: identity.fromEmail,
        subject: companyEmail.subject,
        html: companyEmail.html,
        attachments: companyAttachment ? [companyAttachment] : undefined,
      });
      companyNotified = notice.ok;
    }
  }

  return { delivered, companyNotified, status: doc.status };
}
