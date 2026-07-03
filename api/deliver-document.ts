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
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { resolveTenantEmailIdentity, sendViaProvider, renderTemplate } from './_lib/email';

const CHANNEL = 'EMAIL';
const TEMPLATE = 'contract_executed';

interface PartyRow {
  contact_id: string;
  contacts: { email: string | null; full_name: string | null } | null;
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
      .select('id, engagement_id, org_id, status, title')
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
      .select('contact_id, contacts:contact_id (email, full_name)')
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

    const delivered: Array<{ recipientContactId: string; channel: string; emailed: boolean }> = [];

    // 5. Per party: dedupe, email, then (only on a successful send) record delivery.
    for (const party of parties) {
      if (alreadyDelivered.has(party.contact_id)) continue; // idempotent — skip
      const email = party.contacts?.email;
      if (!email) continue; // no address -> cannot email; skip (no orphan row)

      const { subject, body: inner } = renderTemplate(
        TEMPLATE,
        { documentTitle: doc.title, recipientName: party.contacts?.full_name },
        identity.fromName,
      );
      const footerHtml = identity.footer
        ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
        : '';
      const html = `${inner}<p><a href="${copyUrl}">View your executed copy</a></p>${footerHtml}`;

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

    return res.status(200).json({ delivered, status: doc.status });
  } catch (err) {
    console.error('deliver-document error', err);
    return res.status(500).json({ error: 'could not deliver document' });
  }
}
