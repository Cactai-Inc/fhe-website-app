/* POST /api/request-received — email the barn immediately when a website
 * visitor submits an inquiry/request, carrying the FULL submission. Called by
 * the PUBLIC intake form right after the submit_public_request RPC returns
 * (that RPC already inserts the request and fires the in-app staff
 * notification; this adds the email so the owners hear about it, with what
 * was actually written, even when they're not in the app).
 *
 * Anonymous endpoint (the intake form has no auth). It does NOT trust the
 * caller for anything: the body carries only requestId, used solely to look
 * the row up — every field in the email (name, contact info, category,
 * availability, category-specific details, notes…) is read back from the
 * `requests` row itself, the one place all of it is already stored. Emails
 * only the tenant's own configured ops inbox (CONTACT.OPS_INBOX, fallback
 * hello@fhequestrian.com), never an address from the request body. Best-
 * effort: any failure returns 200 { emailed:false } so a mail hiccup never
 * blocks the visitor's submission (which already succeeded) — the real error
 * is still logged server-side so a send failure doesn't disappear silently.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';

/* The ops inbox is org-level config (CONTACT/OPS_INBOX); the literal below is
 * only the last-resort fallback when config is absent — same constant calendar-
 * reminders.ts uses for the same config key. */
const OPS_INBOX_FALLBACK = 'hello@fhequestrian.com';

const CATEGORY_LABEL: Record<string, string> = {
  general: 'General question',
  lessons: 'Riding lessons',
  horse_care: 'Horse care',
  acquisition: 'Buying or selling a horse',
  media: 'Media / press',
  partnership: 'Partnership / sponsorship',
};
const CHANNEL_LABEL: Record<string, string> = {
  contact: 'Contact form',
  inquiry: 'Inquiry form',
  booking: 'Booking request',
  kiosk: 'Kiosk',
};
const CONTACT_METHOD_LABEL: Record<string, string> = {
  text: 'Text', call: 'Call', email: 'Email',
};

interface ProposedTime {
  date?: string; time?: string; end?: string; label?: string; days?: string;
}
interface RequestRow {
  id: string;
  org_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  contact_method: string | null;
  proposed_times: ProposedTime[] | null;
  subject: string | null;
  category: string | null;
  channel: string | null;
  entry_location: string | null;
  intent: string | null;
  details: Record<string, string> | null;
  notes: string | null;
  created_at: string;
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
}

/** Human text for one proposed-times entry: structured window or legacy {date,time}. */
function proposedTimeText(t: ProposedTime): string {
  if (t.label) return t.label;
  if (t.date && t.end) return `${t.date} – ${t.end}`;
  if (t.date && t.time) return `${t.date} (${t.time})`;
  return t.date || t.time || '';
}

/** Human label for a details key (e.g. 'rider_age' → 'Rider age') — no field
 *  registry lookup here (api/ never imports src/), just the same fallback
 *  humanization the staff inbox uses when a key isn't otherwise labeled. */
function detailLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: { requestId?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  if (!body.requestId) return res.status(400).json({ error: 'requestId required' });

  try {
    const db = getSupabaseAdmin();

    const { data } = await db
      .from('requests')
      .select(
        'id, org_id, contact_name, contact_email, contact_phone, contact_method, ' +
        'proposed_times, subject, category, channel, entry_location, intent, details, notes, created_at',
      )
      .eq('id', body.requestId)
      .maybeSingle();
    const r = data as RequestRow | null;
    if (!r) return res.status(200).json({ ok: true, emailed: false, reason: 'request not found' });

    const identity = await resolveTenantEmailIdentity(db, r.org_id);
    const to = identity.opsInbox || OPS_INBOX_FALLBACK; // the ops inbox, not the public contact address
    if (!to) return res.status(200).json({ ok: true, emailed: false, reason: 'no ops inbox configured' });

    // Link origin comes from the request, never a baked-in hostname — the same
    // source notifications-nudge and calendar-reminders use, so preview and
    // production deployments each link to themselves.
    const origin = req.headers.origin || `https://${req.headers.host}`;

    const rawName = r.contact_name?.trim() ?? '';
    const submittedAt = new Date(r.created_at).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short',
    });
    const times = (r.proposed_times ?? []).map(proposedTimeText).filter(Boolean);
    const detailEntries = Object.entries(r.details ?? {}).filter(([, v]) => v != null && String(v).trim() !== '');
    const notes = (r.notes || '').trim();

    // Every row label ("Phone:", "Interested in:", "Submitted:") is now in the
    // REQUEST_RECEIVED body, and each optional row is a {{#if}} there — so the
    // barn can reorder or re-word its own inquiry email without a deploy. What is
    // still code is the enum→label vocabularies above, which are shared display
    // labels rather than email prose.
    const rendered = await renderEmailTemplate(db, 'REQUEST_RECEIVED', {
      'ORG.FOOTER_HTML': identity.footer ? esc(identity.footer) : '',
      'MSG.SENDER_NAME': rawName,
      'MSG.SENDER_NAME_HTML': rawName ? esc(rawName) : '',
      'MSG.LINK': `${identity.siteUrl ?? origin}/app/ops/intake?request=${r.id}`,
      'REQ.EMAIL_HTML': esc(r.contact_email),
      'REQ.PHONE_HTML': r.contact_phone ? esc(r.contact_phone) : '',
      'REQ.CONTACT_METHOD_HTML': r.contact_method
        ? esc(CONTACT_METHOD_LABEL[r.contact_method] ?? r.contact_method)
        : '',
      'REQ.CATEGORY_HTML': r.category ? esc(CATEGORY_LABEL[r.category] ?? r.category) : '',
      'REQ.CHANNEL_HTML': r.channel ? esc(CHANNEL_LABEL[r.channel] ?? r.channel) : '',
      'REQ.ENTRY_LOCATION_HTML': r.entry_location ? esc(r.entry_location) : '',
      'REQ.SUBJECT_HTML': r.subject ? esc(r.subject) : '',
      'REQ.INTENT_HTML': r.intent ? esc(r.intent) : '',
      'REQ.SUBMITTED_AT_HTML': esc(submittedAt),
      'REQ.AVAILABILITY_HTML': times.length ? times.map(esc).join('; ') : '',
      'REQ.DETAILS': detailEntries.map(([k, v]) => ({
        LABEL: esc(detailLabel(k)),
        VALUE: esc(String(v)),
      })),
      'REQ.NOTES_HTML': notes ? esc(notes) : '',
    });
    if (!rendered) {
      return res.status(200).json({ ok: true, emailed: false, reason: 'REQUEST_RECEIVED template missing' });
    }

    const sent = await sendViaProvider({
      to,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail || to,
      replyTo: r.contact_email || undefined,
      subject: rendered.subject,
      html: rendered.html,
    });

    if (!sent.ok) {
      console.error('request-received send failed', { requestId: r.id, error: sent.error });
      return res.status(200).json({ ok: true, emailed: false, reason: sent.error ?? 'send failed' });
    }
    return res.status(200).json({ ok: true, emailed: true });
  } catch (err) {
    console.error('request-received error', err);
    // best-effort: never fail the visitor's submission over a mail error
    return res.status(200).json({ ok: true, emailed: false, reason: 'internal error' });
  }
}
