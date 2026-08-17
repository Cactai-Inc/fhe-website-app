/* POST /api/inquiry-confirmation — send the SUBMITTER their own copy of what
 * they just sent us. CAREPATH §C6.
 *
 * Owner: "the submitter should get an email with the information they sent us.
 * (This includes the selections from step 2)."
 *
 * ⚠️ THIS IS NOT A BOOKING CONFIRMATION. Nothing is scheduled until staff call,
 * and the template says so in its own first paragraph. It must never imply a
 * date is held.
 *
 * The sibling of `request-received.ts` and deliberately its twin: anonymous
 * endpoint (the public form has no auth), trusts the caller for NOTHING but the
 * requestId, reads every field back from the database, and writes a
 * `request_alert_sends` row for EVERY attempt — recipient, timestamp, outcome
 * and the provider's error verbatim — discriminated by `kind = 'buyer'`.
 *
 * ⚠️ It differs from its twin in exactly one dangerous respect, and that is
 * handled deliberately: this email goes to an address that arrived in a form
 * submission, not to the tenant's own configured inbox. So the recipient is
 * read from the `requests` row (never from the request body), and it is sent
 * only to the address already stored against that inquiry. No address crosses
 * this boundary from the caller.
 *
 * Returns 200 { emailed } either way — a mail outage must never cost a lead —
 * but the response now REPORTS the outcome, because §C6b's confirmation screen
 * shows the visitor what actually happened rather than assuming it worked.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';

const CONTACT_METHOD_LABEL: Record<string, string> = {
  text: 'text', call: 'a call', email: 'email',
};

interface Selection {
  label: string | null;
  price_amount: number | string | null;
  price_unit: string | null;
}

interface Payload {
  request_id: string;
  org_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_method: string | null;
  selections: Selection[];
  order: { display_code: string | null; status: string | null } | null;
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
}

/* Owner-ruled 2026-08-17: the buyer's copy shows a price where the offering
 * carries one, and "Price on inquiry" where it does not — the same thing the
 * website already showed them. The number comes from the CATALOG (read back by
 * `inquiry_email_payload`), never from the browser, so a stale cart cannot put
 * a price in someone's inbox. */
function priceText(s: Selection): string {
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
   * retry after a failure is recorded rather than swallowed by the unique
   * index. "Provable and single" is enforced by claim_request_alert_send
   * refusing once an attempt of THIS KIND has succeeded. */
  const attemptKey = `inquiry-confirmation:${requestId}:${Date.now()}`;
  let db: ReturnType<typeof getSupabaseAdmin> | null = null;

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
        p_kind: 'buyer',
      });
    } catch (logErr) {
      console.error('inquiry-confirmation could not record its attempt', { requestId, logErr });
    }
  };

  try {
    db = getSupabaseAdmin();

    const { data: maySend } = await db.rpc('claim_request_alert_send', {
      p_request_id: requestId, p_key: attemptKey, p_kind: 'buyer',
    });
    if (maySend === false) {
      return res.status(200).json({ ok: true, emailed: false, reason: 'already confirmed' });
    }

    const { data: payload } = await db.rpc('inquiry_email_payload', { p_request_id: requestId });
    const p = payload as Payload | null;
    // The one outcome that CANNOT be recorded: request_alert_sends is anchored
    // to requests by foreign key, so with no request there is nothing to hang
    // the evidence on. Everything past this point is recorded.
    if (!p) return res.status(200).json({ ok: true, emailed: false, reason: 'request not found' });

    // THE RECIPIENT COMES FROM THE ROW, never from the caller.
    const to = (p.contact_email ?? '').trim();
    if (!to) {
      await logAttempt(null, false, 'inquiry carries no email address', null);
      return res.status(200).json({ ok: true, emailed: false, reason: 'no address on the inquiry' });
    }

    const identity = await resolveTenantEmailIdentity(db, p.org_id);
    const rawName = (p.contact_name ?? '').trim();
    // The answers are the same jsonb the staff alert reads, so the two emails
    // can never describe different submissions.
    const { data: reqRow } = await db
      .from('requests').select('details, notes').eq('id', requestId).maybeSingle();
    const details = (reqRow?.details ?? {}) as Record<string, string>;
    const detailEntries = Object.entries(details)
      .filter(([, v]) => v != null && String(v).trim() !== '');
    // The visitor's OWN note only — everything after the assembled blocks is
    // their answers again, and echoing them twice reads as a machine.
    const notes = String(reqRow?.notes ?? '').split('— Your answers —')[0].trim();

    const rendered = await renderEmailTemplate(db, 'INQUIRY_CONFIRMATION', {
      'ORG.NAME': identity.fromName ?? '',
      'ORG.FOOTER_HTML': identity.footer ? esc(identity.footer) : '',
      'MSG.RECIPIENT_NAME_HTML': rawName ? esc(rawName.split(' ')[0]) : 'there',
      'REQ.CONTACT_METHOD_HTML': p.contact_method
        ? esc(CONTACT_METHOD_LABEL[p.contact_method] ?? p.contact_method)
        : '',
      'REQ.SELECTIONS': (p.selections ?? []).map((s) => ({
        LABEL: esc(s.label ?? 'A service'),
        PRICE: esc(priceText(s)),
      })),
      'REQ.DETAILS': detailEntries.map(([k, v]) => ({
        LABEL: esc(k), VALUE: esc(String(v)),
      })),
      'REQ.NOTES_HTML': notes ? esc(notes) : '',
    });
    if (!rendered) {
      await logAttempt(to, false, 'INQUIRY_CONFIRMATION template missing', null);
      return res.status(200).json({ ok: true, emailed: false, reason: 'INQUIRY_CONFIRMATION template missing' });
    }

    const sent = await sendViaProvider({
      to,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail || identity.opsInbox || to,
      // Replying to their own confirmation should reach the barn, not themselves.
      replyTo: identity.opsInbox || undefined,
      subject: rendered.subject,
      html: rendered.html,
    });

    await logAttempt(to, sent.ok, sent.ok ? null : (sent.error ?? 'send failed'), sent.messageId);

    if (!sent.ok) {
      console.error('inquiry-confirmation send failed', { requestId, error: sent.error });
      return res.status(200).json({ ok: true, emailed: false, reason: sent.error ?? 'send failed' });
    }
    return res.status(200).json({ ok: true, emailed: true });
  } catch (err) {
    console.error('inquiry-confirmation error', err);
    await logAttempt(null, false, err instanceof Error ? err.message : 'internal error', null);
    return res.status(200).json({ ok: true, emailed: false, reason: 'internal error' });
  }
}
