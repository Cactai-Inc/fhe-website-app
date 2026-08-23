/* TASK-CREDITGRANT — the email half of "request payment".
 *
 * The DB half (`request_purchase_payment`) raises the app's existing unpaid-balance
 * notification pair and writes the order's timeline. This sends the one email that
 * makes the request actually reach the client, because the `notifications-nudge` cron
 * that would otherwise carry it HAS NEVER RUN on this project (0 of 128 notification
 * rows have `emailed_at` set, 2026-08-23) — an unread in-app notice is not a request
 * for money.
 *
 * Best-effort by the same contract sendOrderReceipt carries: it never throws, so a
 * provider outage cannot fail the staff action that has already been recorded.
 *
 * PROVABLE: every attempt writes one `payment_request_sends` row, success or failure,
 * with the provider's error verbatim. No row at all means this never ran. That is the
 * `receipt_sends` idiom `request_alert_sends` already follows — one small ledger per
 * outbound message class, not a general-purpose mailer nothing can audit.
 *
 * NOT DUNNING (D9): nothing schedules this. It fires only when a staff member presses
 * the button, once per press.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTenantEmailIdentity, sendViaProvider } from './email.js';
import { renderEmailTemplate } from './emailTemplates.js';

export interface PaymentRequestResult {
  sent: boolean;
  reason?: string;
}

/** Values land in HTML — escape them (labels and staff notes echo typed input). */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function money(v: number): string {
  return `$${v.toFixed(2)}`;
}

export async function sendPaymentRequest(
  db: SupabaseClient,
  orderId: string,
  /** The key `request_purchase_payment` returned — one per press. */
  sendKey: string,
  opts: { recipient: string | null; amountDue: number; label: string; note: string | null;
          orderCode: string | null; requestedBy: string | null; appOrigin: string },
): Promise<PaymentRequestResult> {
  const log = async (succeeded: boolean, error: string | null, messageId: string | null) => {
    try {
      await db.rpc('log_payment_request_send', {
        p_purchase_id: orderId,
        p_key: sendKey,
        p_recipient: opts.recipient,
        p_succeeded: succeeded,
        p_amount_due: opts.amountDue,
        p_error: error,
        p_message_id: messageId,
        p_requested_by: opts.requestedBy,
      });
    } catch {
      /* logging must never mask the original outcome */
    }
  };

  try {
    if (!opts.recipient) {
      await log(false, 'no recipient email on file', null);
      return { sent: false, reason: 'no recipient email on file' };
    }

    const { data: order } = await db
      .from('purchases')
      .select('id, org_id, buyer_contact_id')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) {
      await log(false, 'purchase not found', null);
      return { sent: false, reason: 'purchase not found' };
    }

    const { data: contact } = await db
      .from('contacts')
      .select('first_name, last_name')
      .eq('id', order.buyer_contact_id)
      .maybeSingle();
    const fullName = [contact?.first_name, contact?.last_name]
      .filter(Boolean).join(' ').trim();

    const identity = await resolveTenantEmailIdentity(db, order.org_id as string);
    const rendered = await renderEmailTemplate(db, 'PAYMENT_REQUEST', {
      'ORG.BRAND_NAME': identity.fromName,
      'ORG.FOOTER': identity.footer,
      'PARTY.FULL_NAME': fullName ? escapeHtml(fullName) : '',
      'TXN.AMOUNT': money(opts.amountDue),
      'ORD.LABEL': escapeHtml(opts.label),
      'ORD.DISPLAY_CODE': opts.orderCode ? escapeHtml(opts.orderCode) : '',
      'MSG.STAFF_NOTE': opts.note ? escapeHtml(opts.note) : '',
      'MSG.LINK': `${opts.appOrigin}/order/${orderId}`,
    });
    // A missing template is a LOGGED failed attempt, never a silent nothing and never
    // a blank email — the same posture the receipt path takes.
    if (!rendered) {
      const reason = 'the PAYMENT_REQUEST email template is missing or deactivated';
      await log(false, reason, null);
      return { sent: false, reason };
    }

    const out = await sendViaProvider({
      to: opts.recipient,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: rendered.subject,
      html: rendered.html,
    });
    await log(out.ok, out.ok ? null : (out.error ?? 'send failed'), out.messageId ?? null);
    return out.ok ? { sent: true } : { sent: false, reason: out.error };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'payment request failed';
    await log(false, reason, null);
    return { sent: false, reason };
  }
}
