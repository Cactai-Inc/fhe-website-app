/* POST /api/contract-change-requests-submitted — email the other party when a
 * party submits change requests for review.
 *
 * The dashboard notification is created by the DB (submit_change_requests →
 * contract_notify). This endpoint is the EMAIL half of the same event, and it
 * lists the SAME five highest-impact requests.
 *
 * IMPACT RANKING (see change_request_impact_rank in the DB — the single source
 * of truth; this endpoint only reads the rank it already stored):
 *   money (lease fee / payment terms / payment method) > liability (insurance,
 *   risk of loss) > term & termination > care > permitted use > subject/parties >
 *   assignment/warranties > dispute mechanics > boilerplate. Ties break on the
 *   lower annotation_number so ordering is stable.
 *
 * Body: { documentId }. Caller must be a signed-in party (Bearer token).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';

const TOP_N = 5;

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
      .from('profiles').select('contact_id, org_id').eq('user_id', userData.user.id).maybeSingle();
    const meContact = profile?.contact_id ?? null;
    if (!meContact) return res.status(403).json({ error: 'forbidden' });

    const { data: doc } = await db
      .from('documents').select('id, org_id, title').eq('id', documentId).maybeSingle();
    if (!doc) return res.status(404).json({ error: 'document not found' });

    // the caller must be a party on this document
    const { data: myParty } = await db
      .from('document_parties').select('contact_id')
      .eq('document_id', documentId).eq('contact_id', meContact).maybeSingle();
    if (!myParty) return res.status(403).json({ error: 'forbidden' });

    // The five highest-impact requests THIS caller submitted, newest submission
    // first by impact then annotation number (the documented tie-break).
    const { data: reqs } = await db
      .from('contract_change_requests')
      .select('annotation_number, target_section, body, impact_rank')
      .eq('document_id', documentId)
      .is('parent_request_id', null)
      .eq('author_contact_id', meContact)
      .not('submitted_at', 'is', null)
      .is('resolved_at', null)
      .order('impact_rank', { ascending: false })
      .order('annotation_number', { ascending: true })
      .limit(TOP_N);

    const top = reqs ?? [];
    if (top.length === 0) return res.status(200).json({ ok: true, emailed: 0, reason: 'nothing to report' });

    // resolve section headings for display
    const { data: tmpl } = await db
      .from('documents').select('template_id').eq('id', documentId).maybeSingle();
    let headings = new Map<string, string>();
    if (tmpl?.template_id) {
      const { data: ct } = await db
        .from('contract_templates').select('template_key').eq('id', tmpl.template_id).maybeSingle();
      if (ct?.template_key) {
        const { data: secs } = await db
          .from('contract_section_defs').select('section_key, heading')
          .eq('template_key', ct.template_key);
        headings = new Map((secs ?? []).map((s) => [s.section_key as string, s.heading as string]));
      }
    }

    // who I am, for the greeting
    const { data: meC } = await db
      .from('contacts').select('first_name, last_name').eq('id', meContact).maybeSingle();
    const meLabel = [meC?.first_name, meC?.last_name].filter(Boolean).join(' ') || 'The other party';

    // every OTHER party with an email on file
    const { data: others } = await db
      .from('document_parties').select('contact_id, party_role')
      .eq('document_id', documentId).neq('contact_id', meContact);

    let identity = { fromName: 'French Heritage Equestrian', fromEmail: '', footer: null as string | null };
    try { identity = await resolveTenantEmailIdentity(db, doc.org_id as string); } catch { /* fall back */ }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const link = `${origin}/app/contracts/${documentId}`;

    const items = top.map((r) => {
      const where = r.target_section
        ? (headings.get(r.target_section as string) ?? (r.target_section as string))
        : 'The whole document';
      return `<li style="margin-bottom:8px"><strong>#${r.annotation_number} — ${esc(where)}</strong><br/>${esc(String(r.body ?? ''))}</li>`;
    }).join('');

    let emailed = 0;
    for (const o of others ?? []) {
      const { data: c } = await db
        .from('contacts').select('email').eq('id', o.contact_id as string).maybeSingle();
      const to = c?.email as string | undefined;
      if (!to) continue;   // in-app notification still reached them

      const sent = await sendViaProvider({
        to,
        fromName: identity.fromName,
        fromEmail: identity.fromEmail,
        subject: `${meLabel} requested changes to ${doc.title ?? 'your contract'}`,
        html:
          `<p>Hello,</p>` +
          `<p><strong>${esc(meLabel)}</strong> submitted change requests on ` +
          `<strong>${esc(String(doc.title ?? 'your contract'))}</strong> for your review.</p>` +
          `<p>The most significant ${top.length === 1 ? 'one is' : `${top.length} are`}:</p>` +
          `<ol>${items}</ol>` +
          `<p><a href="${link}">Open the contract</a> to reply to each request and agree or discuss.</p>` +
          `<p style="color:#666;font-size:12px">The contract cannot be locked for signing until these are resolved.<br/>${link}</p>` +
          (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>` : ''),
      });
      if (sent.ok) emailed += 1;
    }

    return res.status(200).json({ ok: true, emailed, listed: top.length });
  } catch (err) {
    console.error('contract-change-requests-submitted error', err);
    return res.status(500).json({ error: 'could not send the change-request notice' });
  }
}
