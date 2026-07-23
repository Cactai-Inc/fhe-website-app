/* POST /api/delete-document-with-copy
 * Staff-only. Hard-delete a NON-executed document, but first email a PDF copy of
 * the current document to any party who has already been notified about it or has
 * opened it — so a party who reviewed a draft that's about to vanish keeps a copy
 * for their records. Then the document is hard-deleted (as if it never existed).
 *
 * Body: { documentId: string }
 * -> 200 { deletedId, copiesSent } on success
 * -> 401/403 on auth; 404 when the doc isn't in the caller's org; 409 if executed.
 *
 * "Has seen it" = the party has an in-app notification linking to the document
 * (a review/notify notification), OR a document_deliveries row. Executed documents
 * are never deletable (they must be terminated instead) and are refused here.
 *
 * The PDF is rendered from the current merged_body (the draft the party reviewed).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import type { EmailAttachment } from './_lib/email.js';
import { renderDocumentPdf, pdfFileName } from './_lib/documentPdf.js';

/** A Supabase client that acts AS the calling user (RLS + auth.uid() intact) —
 *  used so hard_delete_contract's own staff-access guard evaluates against the
 *  real caller, not the service role. */
function callerClient(bearer: string) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
}

interface PartyRow {
  contact_id: string;
  contacts: { email: string | null; first_name: string | null } | null;
}

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
  const documentId = typeof body.documentId === 'string' ? body.documentId : '';
  if (!documentId) return res.status(400).json({ error: 'documentId required' });

  try {
    const db = getSupabaseAdmin();
    const { data: userData, error: userErr } = await db.auth.getUser(bearer);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('is_admin, role, org_id').eq('user_id', userData.user.id).maybeSingle();
    const isStaff = profile?.is_admin
      || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(profile?.role ?? '');
    if (!isStaff) return res.status(403).json({ error: 'forbidden' });

    const { data: doc } = await db
      .from('documents').select('id, org_id, title, status, workflow_state, merged_body')
      .eq('id', documentId).maybeSingle();
    if (!doc || doc.org_id !== profile?.org_id) {
      return res.status(404).json({ error: 'document not found in your organization' });
    }
    if (doc.workflow_state === 'executed' || doc.status === 'EXECUTED') {
      return res.status(409).json({ error: 'an executed document cannot be deleted (terminate it instead)' });
    }

    // Parties who have "seen" it: notified (in-app notification linking to the doc)
    // or delivered (a delivery row). We email each of them a copy before deleting.
    const link = `/app/contracts/${documentId}`;
    const [{ data: notif }, { data: deliv }, { data: partiesRaw }] = await Promise.all([
      db.from('notifications').select('user_id').eq('link', link),
      db.from('document_deliveries').select('recipient_contact_id').eq('document_id', documentId),
      db.from('document_parties').select('contact_id, contacts:contact_id (email, first_name)').eq('document_id', documentId),
    ]);
    const parties = (partiesRaw ?? []) as unknown as PartyRow[];

    // Map notified user_ids → contact_ids (parties whose profile got a notification).
    const notifiedUserIds = new Set((notif ?? []).map((n: { user_id: string }) => n.user_id));
    let notifiedContactIds = new Set<string>();
    if (notifiedUserIds.size) {
      const { data: profs } = await db
        .from('profiles').select('contact_id, user_id').in('user_id', Array.from(notifiedUserIds));
      notifiedContactIds = new Set((profs ?? [])
        .filter((p: { contact_id: string | null }) => p.contact_id)
        .map((p: { contact_id: string }) => p.contact_id));
    }
    const deliveredContactIds = new Set((deliv ?? []).map((d: { recipient_contact_id: string }) => d.recipient_contact_id));
    const seenContactIds = new Set<string>([...notifiedContactIds, ...deliveredContactIds]);

    // Render the current document once (only if someone needs a copy).
    let attachment: EmailAttachment | null = null;
    let copiesSent = 0;
    const recipients = parties.filter((p) => seenContactIds.has(p.contact_id) && p.contacts?.email);
    if (recipients.length > 0) {
      const bytes = await renderDocumentPdf(doc.title, doc.merged_body ?? '');
      attachment = { filename: pdfFileName(doc.title), content: bytes, contentType: 'application/pdf' };
      const identity = await resolveTenantEmailIdentity(db, doc.org_id);
      const footerHtml = identity.footer
        ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
        : '';
      for (const p of recipients) {
        const greeting = p.contacts?.first_name ? `Hi ${p.contacts.first_name},` : 'Hello,';
        const html =
          `<p>${greeting}</p>` +
          `<p>The document <strong>${doc.title}</strong> that was shared with you has been withdrawn and removed. ` +
          `A copy is attached to this email for your records.</p>` +
          footerHtml;
        const sent = await sendViaProvider({
          to: p.contacts!.email!,
          fromName: identity.fromName,
          fromEmail: identity.fromEmail,
          subject: `${doc.title} was withdrawn — copy attached`,
          html,
          attachments: [attachment],
        });
        if (sent.ok) copiesSent += 1;
      }
    }

    // Hard delete via the existing RPC, called AS the caller so its own
    // has_staff_access() guard evaluates against the real staff user (not the
    // service role, whose auth.uid() is null).
    const asUser = callerClient(bearer);
    const { error: delErr } = await asUser.rpc('hard_delete_contract', { p_document_id: documentId });
    if (delErr) return res.status(400).json({ error: delErr.message });

    return res.status(200).json({ deletedId: documentId, copiesSent });
  } catch (err) {
    console.error('delete-document-with-copy error', err);
    return res.status(500).json({ error: 'could not delete the document' });
  }
}
