/* POST /api/contract-review-notify — tell the other party there are changes to
 * review, BY EMAIL, with the editor's note and the actual field changes inlined,
 * so they can read them WITHOUT opening the contract (owner requirement, BOS flow).
 *
 * The in-app notification half is `notify_review_changes` in the DB; this is the
 * email half of the same event. `contract_review_payload` (DB) is the single
 * source of who the recipients are and what changed for each of them — this
 * endpoint composes the message from it and sends.
 *
 * Body: { documentId, note? }. Caller must be a signed-in party (Bearer token).
 * -> 200 { ok, emailed, notified }
 * -> 401 no/bad bearer · 403 not a party · 404 doc not found
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function callerClient(bearer: string) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
}

interface Change {
  field_label: string | null; field_key: string | null;
  old_value: string | null; new_value: string | null; actor: string | null; at: string;
}
interface Recipient {
  contact_id: string; name: string; email: string | null; party_role: string; changes: Change[];
}
interface Payload {
  org_id: string; document_id: string; title: string; editor: string;
  note: string | null; link: string; recipients: Recipient[];
}

/** The changes table + the note, as an email body. This is what lets them decide
 *  without opening the document. */
function composeHtml(p: Payload, r: Recipient, appLink: string, footer: string | null): string {
  const rows = r.changes.map((c) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e6e2d6;vertical-align:top;">
        <strong>${esc(c.field_label ?? c.field_key ?? 'This document')}</strong>
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #e6e2d6;color:#8a8577;text-decoration:line-through;">
        ${esc(c.old_value || '(empty)')}
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #e6e2d6;color:#0d2118;">
        ${esc(c.new_value || '(empty)')}
      </td>
    </tr>`).join('');

  const changesBlock = r.changes.length > 0
    ? `<p style="margin:16px 0 6px;">Here is what changed:</p>
       <table style="border-collapse:collapse;width:100%;font-size:14px;">
         <thead><tr>
           <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #0d2118;">Where</th>
           <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #0d2118;">Was</th>
           <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #0d2118;">Now</th>
         </tr></thead>
         <tbody>${rows}</tbody>
       </table>`
    : `<p style="margin:16px 0;">The document was updated and is ready for your review.</p>`;

  const noteBlock = p.note
    ? `<p style="margin:16px 0 6px;">A note from ${esc(p.editor)}:</p>
       <blockquote style="margin:0;padding:10px 14px;border-left:3px solid #a6842a;background:#faf7ee;color:#0d2118;">
         ${esc(p.note)}
       </blockquote>`
    : '';

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0d2118;max-width:620px;">
      <p>Hi ${esc(r.name)},</p>
      <p>${esc(p.editor)} has made changes to <strong>${esc(p.title)}</strong> and would like you to review them.</p>
      ${noteBlock}
      ${changesBlock}
      <p style="margin:20px 0;">
        If you agree with the changes, you can sign again straight away.
        If not, reply to discuss, or open the document to make your own change and add a note.
      </p>
      <p style="margin:20px 0;">
        <a href="${esc(appLink)}" style="background:#0d2118;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;">
          Open the document
        </a>
      </p>
      ${footer ? `<hr style="border:none;border-top:1px solid #e6e2d6;margin:24px 0;"/><p style="color:#8a8577;font-size:12px;">${footer}</p>` : ''}
    </div>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ error: 'unauthorized' });

  let body: { documentId?: string; note?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const documentId = (body.documentId ?? '').trim();
  const note = (body.note ?? '').trim() || null;
  if (!documentId) return res.status(400).json({ error: 'documentId is required' });

  try {
    const asUser = callerClient(bearer);

    // Record the in-app notification + capture the note on the change log FIRST,
    // so the payload below can read the note back as the latest review message.
    const { error: notifyErr } = await asUser.rpc('notify_review_changes', {
      p_document_id: documentId, p_message: note,
    });
    if (notifyErr) {
      const forbidden = /authentication required|forbidden|not found/i.test(notifyErr.message);
      return res.status(forbidden ? 403 : 500).json({ error: notifyErr.message });
    }

    const { data, error } = await asUser.rpc('contract_review_payload', { p_document_id: documentId });
    if (error) return res.status(500).json({ error: error.message });
    const payload = data as Payload;

    const db = getSupabaseAdmin();
    let identity = { fromName: 'French Heritage Equestrian', fromEmail: '', footer: null as string | null };
    try { identity = await resolveTenantEmailIdentity(db, payload.org_id); } catch { /* fall back */ }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const appLink = `${origin}${payload.link}`;

    let emailed = 0;
    for (const r of payload.recipients) {
      if (!r.email) continue;   // in-app notification already reached them if they have a login
      const sent = await sendViaProvider({
        to: r.email,
        fromName: identity.fromName,
        fromEmail: identity.fromEmail,
        subject: `${payload.title} — changes to review`,
        html: composeHtml(payload, r, appLink, identity.footer),
      });
      if (sent.ok) emailed += 1;
    }

    return res.status(200).json({ ok: true, emailed, notified: payload.recipients.length });
  } catch (err) {
    console.error('contract-review-notify error', err);
    return res.status(500).json({ error: 'could not send the review notice' });
  }
}
