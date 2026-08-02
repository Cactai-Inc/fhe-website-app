/* POST /api/deliver-document
 * Staff-only (H2 hardening, 2026-08-02). The sign->EXECUTED->deliver->email
 * tail (PLATFORM_ARCHITECTURE.md §15 chain 2) for the ops-panel resend case
 * (DeliveryPanel.tsx). When a contract's document is status='EXECUTED', each
 * engagement party is emailed their executed copy and a document_deliveries
 * row is recorded — one per (party, EMAIL channel).
 *
 * The kiosk release flow no longer calls this endpoint: it has no session to
 * attach (public/anonymous by design), so its delivery now happens
 * server-side, in-process, from api/sign-release.ts via the same
 * deliverExecutedDocument() this handler calls — never over HTTP, never
 * unauthenticated. This endpoint is reserved for the staff-gated resend UI.
 *
 * Body: { documentId }
 * -> 200 { delivered:[{recipientContactId, channel, emailed}], status } on success
 * -> 401 no session; 403 session present but not staff
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
import { deliverExecutedDocument, DeliveryError } from './_lib/delivery.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
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

    const { data: userData, error: userErr } = await db.auth.getUser(bearer);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('is_admin, role').eq('user_id', userData.user.id).maybeSingle();
    const isStaff = profile?.is_admin
      || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(profile?.role ?? '');
    if (!isStaff) return res.status(403).json({ error: 'forbidden' });

    const result = await deliverExecutedDocument(db, documentId);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof DeliveryError) return res.status(err.status).json({ error: err.message });
    console.error('deliver-document error', err);
    return res.status(500).json({ error: 'could not deliver document' });
  }
}
