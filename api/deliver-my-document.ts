/* POST /api/deliver-my-document
 * The member "email me a copy" endpoint (hardening unit H3).
 *
 * AUTHENTICATED SELF-SEND. Unlike /api/deliver-document (which emails EVERY
 * party and is inherently staff-shaped), this endpoint sends exactly ONE copy:
 * the caller's own, to the caller's own account email. It is a personal
 * re-send, not a delivery event — so there is deliberately NO org-inbox
 * mirror copy here.
 *
 * Body: { documentId }
 * -> 200 { delivered:true, email, logged } on success
 * -> 400 on a missing/invalid documentId
 * -> 401 when the caller has no valid session
 * -> 403 when the caller is not a party on the document
 * -> 404 when the document does not exist (or is soft-deleted)
 * -> 409 when the document is not EXECUTED
 * -> 502 when the mail provider refuses the send
 * -> 5xx when a read fails (never throws uncaught)
 *
 * AUTHORIZATION CHAIN (each step is a hard gate, in order):
 *   bearer token -> auth.getUser -> profiles.contact_id -> document_parties
 * The caller's contact is resolved from THEIR OWN profile, never from the
 * request body, so a caller cannot name someone else's contact or address.
 * The destination address is likewise read from the resolved contact record —
 * the body carries no address and cannot redirect mail.
 *
 * ISOLATION (§15): the document carries its own org_id; the email identity
 * (from-name, footer, brand) resolves against THAT org via the value registry.
 *
 * DELIVERY LOGGING: reuses the existing document_deliveries shape. Because a
 * self-send is a RE-send, the (document_id, recipient_contact_id, channel)
 * unique index will normally already hold the original delivery row; a 23505
 * collision is therefore an expected, successful outcome — the mail still went
 * out — and is reported as logged:false rather than failing the call.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { buildPartyCopyEmail, renderPartyCopyPdfBytes } from './_lib/delivery.js';

const CHANNEL = 'EMAIL';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  // 1. Session required. No bearer -> 401 before anything is read.
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return res.status(401).json({ error: 'unauthorized' });

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

    // 2. Resolve the caller from their token. An invalid/expired token is 401.
    const { data: userData, error: userErr } = await db.auth.getUser(bearer);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });

    // 3. The caller's contact comes from THEIR profile — never from the body.
    const { data: profile, error: profErr } = await db
      .from('profiles')
      .select('contact_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (profErr) throw profErr;
    const callerContactId = profile?.contact_id as string | null | undefined;
    // No linked contact means the caller cannot be a party on anything.
    if (!callerContactId) return res.status(403).json({ error: 'forbidden' });

    // 4. Load the document. Soft-deleted documents read as missing.
    const { data: doc, error: docErr } = await db
      .from('documents')
      .select('id, org_id, status, title, merged_body, execution_hash, deleted_at, signed_at, created_at')
      .eq('id', documentId)
      .maybeSingle();
    if (docErr) throw docErr;
    if (!doc || doc.deleted_at) return res.status(404).json({ error: 'document not found' });
    const executedAt = new Date((doc.signed_at as string | null) ?? (doc.created_at as string));

    // 5. Party check BEFORE status: a non-party learns nothing about a
    //    document's state (403 whether or not it is executed).
    const { data: party, error: partyErr } = await db
      .from('document_parties')
      .select('contact_id, contacts:contact_id (email, first_name, last_name)')
      .eq('document_id', documentId)
      .eq('contact_id', callerContactId)
      .maybeSingle();
    if (partyErr) throw partyErr;
    if (!party) return res.status(403).json({ error: 'forbidden' });

    // 6. Only executed documents are deliverable (no premature delivery).
    if (doc.status !== 'EXECUTED') {
      return res.status(409).json({ error: `document not EXECUTED (status=${doc.status})` });
    }

    // 7. Destination = the party contact's own address, read server-side.
    const contact = (party as unknown as {
      contacts: { email: string | null; first_name: string | null; last_name: string | null } | null;
    }).contacts;
    const email = contact?.email;
    if (!email) return res.status(409).json({ error: 'no email address on file for your contact record' });

    // 8. Tenant-branded identity, scoped to the DOCUMENT's org.
    const identity = await resolveTenantEmailIdentity(db, doc.org_id);

    // Same email shape as the all-parties sender (subject with the real
    // document title, greeting/body/signature, PDF attachment) — one source,
    // api/_lib/delivery.ts, not a second hand-built template.
    const pdfBytes = await renderPartyCopyPdfBytes(doc);
    const partyEmail = buildPartyCopyEmail(
      doc, executedAt, contact?.first_name, contact?.last_name, identity, pdfBytes,
    );

    const sent = await sendViaProvider({
      to: email,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: partyEmail.subject,
      html: partyEmail.html,
      attachments: partyEmail.attachments,
    });
    // No delivery row without a successful send.
    if (!sent.ok) return res.status(502).json({ error: 'could not send the email' });

    // 9. Record the delivery in the existing shape. A self-send is a RE-send:
    //    the original delivery row usually already exists, and the partial
    //    unique index makes that a 23505. That is success, not failure —
    //    the mail went out either way.
    let logged = true;
    const { error: insErr } = await db.from('document_deliveries').insert({
      document_id: documentId,
      recipient_contact_id: callerContactId,
      channel: CHANNEL,
      copy_url: `/portal/documents/${documentId}`,
    });
    if (insErr) {
      if (insErr.code === '23505') {
        logged = false; // already delivered once; re-send is intentional
      } else {
        // A send that cannot be logged is not a silent success: surface it.
        console.error('self-send delivery logging failed', {
          documentId, contactId: callerContactId, error: insErr.message,
        });
        logged = false;
      }
    }

    return res.status(200).json({ delivered: true, email, logged });
  } catch (err) {
    console.error('deliver-my-document error', err);
    return res.status(500).json({ error: 'could not deliver document' });
  }
}
