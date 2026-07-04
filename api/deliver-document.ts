/* POST /api/deliver-document
 * Server-only. The sign->EXECUTED->deliver->email tail (PLATFORM_ARCHITECTURE.md
 * §15 chain 2). When a contract's document reaches status='EXECUTED' (all
 * signatures recorded), each engagement party is emailed their executed copy and
 * a document_deliveries row is recorded — one per (party, EMAIL channel).
 *
 * Body: { documentId }
 * -> 200 { delivered:[{recipientContactId, channel, emailed}], status } on success
 * -> 400 on a missing/invalid documentId
 * -> 409 when the document is not EXECUTED (no premature delivery)
 * -> 404 when the document does not exist
 * -> 5xx when a read fails (never throws uncaught)
 *
 * ISOLATION (§15): the document carries its own org_id; the email identity
 * (from-name, footer, template brand) is resolved against THAT org via the value
 * registry — a document is never delivered with another tenant's brand.
 *
 * IDEMPOTENT per (document_id, recipient_contact_id, channel='EMAIL'): a
 * re-invocation inserts no duplicate deliveries and sends no duplicate mail. A
 * delivery row is written only AFTER the email attempt succeeds, so there is no
 * orphan delivery without an email attempt.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider, renderTemplate } from './_lib/email.js';

const CHANNEL = 'EMAIL';
const TEMPLATE = 'contract_executed';

/* Display-time signature styling for emails: wrap the value after a
 * "Signature:" / "By (signature):" label in an email-safe inline-styled span
 * (system cursive stack, no network font). The STORED merged_body is never
 * altered — this only decorates the outgoing HTML. Multiline via the `gm`
 * flags: each signature line is matched at its own line start/end. */
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

/* Party copies carry the DOCUMENT TEXT ONLY: strip the trailing
 * FACILITY RULES ACKNOWLEDGMENT block (appended by the kiosk sign RPC at the
 * very end of merged_body) from the signer's email. The acknowledgment stays
 * in the stored document, the company notification, and the admin/print view. */
const FACILITY_RULES_TAIL_RE = /\n+FACILITY RULES ACKNOWLEDGMENT\n[\s\S]*$/;
function stripFacilityRulesTail(body: string): string {
  return body.replace(FACILITY_RULES_TAIL_RE, '\n');
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
  const documentId = (typeof body.documentId === 'string' ? body.documentId : '').trim();
  if (!documentId) return res.status(400).json({ error: 'documentId required' });

  try {
    const db = getSupabaseAdmin();

    // 1. Load the document (status + org + title). No delivery unless EXECUTED.
    const { data: doc, error: docErr } = await db
      .from('documents')
      .select('id, engagement_id, org_id, status, title, display_code, merged_body, execution_hash')
      .eq('id', documentId)
      .maybeSingle();
    if (docErr) throw docErr;
    if (!doc) return res.status(404).json({ error: 'document not found' });

    if (doc.status !== 'EXECUTED') {
      // Guard: delivery only ever fires on EXECUTED (no premature delivery).
      return res.status(409).json({ error: `document not EXECUTED (status=${doc.status})` });
    }

    // 2. Recipients = the engagement's parties (+ their contact email).
    const { data: partiesRaw, error: partyErr } = await db
      .from('engagement_parties')
      .select('contact_id, contacts:contact_id (email, first_name, last_name)')
      .eq('engagement_id', doc.engagement_id);
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

    // Tamper evidence (20260703110000): documents executed since the e-sign
    // hardening carry a SHA-256 execution hash. The party copy gets a short
    // integrity code; the company copy gets the full hash in its footer.
    // Older executions (no hash) render neither line.
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
        // email greeting = casual surface → first_name (owner name-canon rule)
        { documentTitle: doc.title, recipientName: party.contacts?.first_name },
        identity.fromName,
      );
      const footerHtml = identity.footer
        ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
        : '';
      // PARTY copy = the document text ONLY: no 'Document DOC-…' metadata line
      // and no trailing facility-rules acknowledgment block. (Both remain in the
      // stored document, the company notice below, and the admin print view.)
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
      // No orphan delivery without a successful email attempt.
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
          // Company copy keeps the FULL stored body (code line context is in the
          // subject; acknowledgment block included) — only signatures are styled.
          + (doc.merged_body ? `<pre style="font-family:inherit;white-space:pre-wrap">${withSignatureScript(doc.merged_body)}</pre>` : '')
          // Full integrity hash in the company-copy footer (tamper evidence).
          + companyHashHtml,
      });
      companyNotified = notice.ok;
    }

    return res.status(200).json({ delivered, companyNotified, status: doc.status });
  } catch (err) {
    console.error('deliver-document error', err);
    return res.status(500).json({ error: 'could not deliver document' });
  }
}
