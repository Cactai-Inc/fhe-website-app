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
 * hello@fhequestrian.com), never an address from the request body.
 *
 * INBOUNDALERT — best-effort NO LONGER MEANS UNRECORDED. This still returns
 * 200 { emailed:false } on every failure so a mail hiccup can never cost a
 * lead, but "do not block the submission" and "do not record the outcome" are
 * different things, and only the first one was ever intended. Every attempt now
 * writes a `request_alert_sends` row — recipient, timestamp, outcome, and the
 * provider's error verbatim — via log_request_alert_send, the same discipline
 * receipt_sends applies to receipts. claim_request_alert_send refuses a second
 * send once one has succeeded. The console.error stays; it is a convenience,
 * not the record.
 *
 * A request with NO row at all means this endpoint never ran for it — which is
 * exactly what production looked like for all 13 live requests before this
 * change, because the only caller was the /contact form and every real lead
 * came through checkout or the kiosk. The alert now dispatches from
 * submitRequest (src/lib/api.ts), the one spine all three intake paths share.
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

/** CAREPATH §C6 — what `inquiry_email_payload` returns (the shared reader both
 *  inquiry emails use). */
interface PayloadSelection {
  label: string | null;
  price_amount: number | string | null;
  price_unit: string | null;
}
interface InquiryPayload {
  selections: PayloadSelection[];
  order: { display_code: string | null; status: string | null; current_status: string | null } | null;
}

/** A price where the offering carries one, "Price on inquiry" where it does
 *  not. The number comes from the CATALOG, never from the browser. */
function priceText(s: PayloadSelection): string {
  if (s.price_amount == null) return 'Price on inquiry';
  const n = Number(s.price_amount);
  if (!Number.isFinite(n)) return 'Price on inquiry';
  const money = `$${n.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2,
  })}`;
  const unit = (s.price_unit ?? '').trim();
  if (!unit || unit === 'flat') return money;
  if (unit === 'percent') return `${money}%`;
  return `${money} / ${unit}`;
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

  const requestId = body.requestId;
  /* One key per INVOCATION, not per request: every attempt is its own row, so a
   * retry after a failure is recorded rather than silently swallowed by the
   * unique index. "Provable and single" is enforced by claim_request_alert_send
   * refusing once an attempt has SUCCEEDED — the same guard receipt_sends uses;
   * the key only stops one invocation double-logging itself. */
  const attemptKey = `request-alert:${requestId}:${Date.now()}`;
  let db: ReturnType<typeof getSupabaseAdmin> | null = null;

  /** Record the attempt. Never throws: logging must not mask the send outcome,
   *  and must never fail the visitor's already-saved submission. */
  const logAttempt = async (
    recipient: string | null, succeeded: boolean,
    error: string | null, messageId: string | null,
  ): Promise<void> => {
    if (!db) return;
    try {
      await db.rpc('log_request_alert_send', {
        p_request_id: requestId,
        p_key: attemptKey,
        p_recipient: recipient,
        p_succeeded: succeeded,
        p_error: error,
        p_message_id: messageId,
        p_kind: 'staff',
      });
    } catch (logErr) {
      console.error('request-received could not record its attempt', { requestId, logErr });
    }
  };

  try {
    db = getSupabaseAdmin();

    // Refuses only when an alert for this request already SUCCEEDED. A prior
    // failure leaves the door open, because a failed alert still owes the owner
    // a lead he has not heard about.
    const { data: maySend } = await db.rpc('claim_request_alert_send', {
      p_request_id: requestId, p_key: attemptKey, p_kind: 'staff',
    });
    if (maySend === false) {
      return res.status(200).json({ ok: true, emailed: false, reason: 'already alerted' });
    }

    const { data } = await db
      .from('requests')
      .select(
        'id, org_id, contact_name, contact_email, contact_phone, contact_method, ' +
        'proposed_times, subject, category, channel, entry_location, intent, details, notes, created_at',
      )
      .eq('id', requestId)
      .maybeSingle();
    const r = data as RequestRow | null;
    // The one outcome that CANNOT be recorded: request_alert_sends is anchored
    // to requests by foreign key, so with no request there is nothing to hang
    // the evidence on. Everything past this point is recorded.
    if (!r) return res.status(200).json({ ok: true, emailed: false, reason: 'request not found' });

    const identity = await resolveTenantEmailIdentity(db, r.org_id);
    const to = identity.opsInbox || OPS_INBOX_FALLBACK; // the ops inbox, not the public contact address
    if (!to) {
      await logAttempt(null, false, 'no ops inbox configured', null);
      return res.status(200).json({ ok: true, emailed: false, reason: 'no ops inbox configured' });
    }

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

    /* CAREPATH §C6 — the alert must now carry WHAT THEY ASKED TO BUY, not just
     * a bare notification. The step-2 answers already ride in REQ.DETAILS
     * (ASKRIGHT §A5); the selections were never in this email at all, so an
     * owner reading it could not tell what the person actually chose without
     * opening the app. Read back through the same definer payload the buyer's
     * copy uses, so the two emails cannot describe different submissions. */
    const { data: payload } = await db.rpc('inquiry_email_payload', { p_request_id: requestId });
    const pay = payload as InquiryPayload | null;
    const selections = (pay?.selections ?? []).map((s) => ({
      LABEL: esc(s.label ?? 'A service'),
      PRICE: esc(priceText(s)),
    }));

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
      'REQ.SELECTIONS': selections,
      'REQ.ORDER_CODE_HTML': pay?.order?.display_code ? esc(pay.order.display_code) : '',
      'REQ.ORDER_STATUS_HTML': pay?.order
        ? esc(pay.order.current_status === 'enquiry' ? 'awaiting your call' : (pay.order.status ?? ''))
        : '',
    });
    if (!rendered) {
      // EMAILEXTRACT moved this email's prose into the REQUEST_RECEIVED template,
      // which adds a way for the alert to die that did not exist before: the
      // template row goes missing and the send never happens. Recorded like any
      // other failed attempt — an unrecorded 200 is the exact defect this task
      // exists to close, and a new one is not exempt from it.
      await logAttempt(to, false, 'REQUEST_RECEIVED template missing', null);
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

    // The attempt is recorded either way — that is the point of this endpoint's
    // existence being provable rather than assumed.
    await logAttempt(to, sent.ok, sent.ok ? null : (sent.error ?? 'send failed'), sent.messageId);

    if (!sent.ok) {
      console.error('request-received send failed', { requestId: r.id, error: sent.error });
      return res.status(200).json({ ok: true, emailed: false, reason: sent.error ?? 'send failed' });
    }
    return res.status(200).json({ ok: true, emailed: true });
  } catch (err) {
    console.error('request-received error', err);
    await logAttempt(null, false, err instanceof Error ? err.message : 'internal error', null);
    // best-effort: never fail the visitor's submission over a mail error
    return res.status(200).json({ ok: true, emailed: false, reason: 'internal error' });
  }
}
