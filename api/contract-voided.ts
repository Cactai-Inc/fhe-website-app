/* POST /api/contract-voided — email the counterparty when a party voids.
 *
 * The dashboard notification is created by the DB (void_document →
 * contract_notify), note included. This endpoint is the EMAIL half of the same
 * event and carries the same note, plus the keep-or-remove choice.
 *
 * KEEP-OR-REMOVE IS PER-PARTY: "remove" only hides the document from that
 * party's own view. Nothing is ever deleted — the legal record survives for the
 * other party and for staff/ops. The email says so explicitly.
 *
 * Body: { documentId }. Caller must be a signed-in party (Bearer token).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ error: 'unauthorized' });

  let body: { documentId?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const { documentId } = body;
  if (!documentId) return res.status(400).json({ error: 'documentId is required' });

  try {
    const db = getSupabaseAdmin();
    const { data: userData, error: userErr } = await db.auth.getUser(bearer);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });

    const { data: profile } = await db
      .from('profiles').select('contact_id').eq('user_id', userData.user.id).maybeSingle();
    const meContact = profile?.contact_id ?? null;
    if (!meContact) return res.status(403).json({ error: 'forbidden' });

    const { data: doc } = await db
      .from('documents')
      .select('id, org_id, title, voided_at, voided_by, void_reason')
      .eq('id', documentId).maybeSingle();
    if (!doc) return res.status(404).json({ error: 'document not found' });
    if (!doc.voided_at) return res.status(400).json({ error: 'this document is not void' });

    const { data: myParty } = await db
      .from('document_parties').select('contact_id')
      .eq('document_id', documentId).eq('contact_id', meContact).maybeSingle();
    if (!myParty) return res.status(403).json({ error: 'forbidden' });

    const { data: byC } = await db
      .from('contacts').select('first_name, last_name')
      .eq('id', (doc.voided_by ?? meContact) as string).maybeSingle();
    // Just the name. Whether a nameless voider reads as "The other party" is
    // wording, and wording is the CONTRACT_VOIDED row's business now.
    const byName = [byC?.first_name, byC?.last_name].filter(Boolean).join(' ');

    const { data: others } = await db
      .from('document_parties').select('contact_id')
      .eq('document_id', documentId).neq('contact_id', doc.voided_by ?? meContact);

    let identity = { fromName: 'French Heritage Equestrian', fromEmail: '', footer: null as string | null };
    try { identity = await resolveTenantEmailIdentity(db, doc.org_id as string); } catch { /* fall back */ }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const link = `${origin}/app/contracts/${documentId}`;
    const note = (doc.void_reason as string | null) ?? null;

    // Rendered once, outside the recipient loop: every other party reads the same
    // words. The "The other party" fallback now lives in the template, so the
    // token carries the real name or nothing.
    const rendered = await renderEmailTemplate(db, 'CONTRACT_VOIDED', {
      'ORG.FOOTER': identity.footer,
      'PARTY.FULL_NAME': byName,
      'PARTY.FULL_NAME_HTML': byName ? esc(byName) : '',
      'DOC.HAS_TITLE': doc.title != null ? '1' : '',
      'DOC.TITLE': doc.title ?? '',
      'DOC.TITLE_HTML': doc.title != null ? esc(String(doc.title)) : '',
      'MSG.NOTE_HTML': note ? esc(note) : '',
      'MSG.LINK': link,
    });
    if (!rendered) {
      return res.status(500).json({ error: 'the CONTRACT_VOIDED email template is missing or deactivated' });
    }

    let emailed = 0;
    for (const o of others ?? []) {
      const { data: c } = await db
        .from('contacts').select('email').eq('id', o.contact_id as string).maybeSingle();
      const to = c?.email as string | undefined;
      if (!to) continue;

      const sent = await sendViaProvider({
        to,
        fromName: identity.fromName,
        fromEmail: identity.fromEmail,
        subject: rendered.subject,
        html: rendered.html,
      });
      if (sent.ok) emailed += 1;
    }

    return res.status(200).json({ ok: true, emailed });
  } catch (err) {
    console.error('contract-voided error', err);
    return res.status(500).json({ error: 'could not send the void notice' });
  }
}
