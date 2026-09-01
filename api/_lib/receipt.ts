/* Post-payment receipt email. Called from both confirmation paths (the
 * webhook + Zelle reconcile) after an order flips to confirmed.
 *
 * Best-effort by contract: a receipt must never fail a payment confirmation, so
 * every step is caught and the function resolves { sent: false } instead of
 * throwing. Tenant identity resolves from the ORDER's org (registry-scoped —
 * never a hardcoded brand).
 *
 * Stage 5b — PROVABLE AND SINGLE: every attempt writes a receipt_sends row
 * (success or failure, with the error), and claim_receipt_send refuses a
 * second send once one has succeeded. The Zelle path can no longer re-send.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTenantEmailIdentity, sendViaProvider } from './email.js';
import { renderEmailTemplate } from './emailTemplates.js';

export interface ReceiptResult {
  sent: boolean;
  reason?: string;
}

export async function sendOrderReceipt(
  db: SupabaseClient,
  orderId: string,
  /** Distinguishes attempts; the same key never sends twice. */
  idempotencyKey = `receipt:${orderId}`,
): Promise<ReceiptResult> {
  try {
    // 5b: claim the right to send. False = a receipt already succeeded.
    const { data: maySend } = await db.rpc('claim_receipt_send', {
      p_purchase_id: orderId, p_key: idempotencyKey,
    });
    if (maySend === false) return { sent: false, reason: 'already sent' };
    const { data: order } = await db
      .from('purchases')
      .select('id, buyer_user_id, org_id, amount, amount_paid, payment_disposition, write_down_amount')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) return { sent: false, reason: 'purchase not found' };

    const { data: profile } = await db
      .from('profiles')
      .select('email')
      .eq('user_id', order.buyer_user_id)
      .maybeSingle();
    const to = profile?.email as string | undefined;
    if (!to) return { sent: false, reason: 'no recipient email' };

    // Payment is inline on the purchase row now — the amount is authoritative there.
    const amount = Number(order.amount);

    /* TASK-BOOKS1 (R4): on a discounted or comped order the customer's copy
     * shows the FULL price, the reduction, and that $0 is owed — the give-away
     * is visible, never hidden behind a zero-priced line. The template's
     * {{#if TXN.WRITE_DOWN}} branch selects that wording; on an ordinary paid
     * order all three tokens are empty and the receipt reads as it always has. */
    const writeDown = Number(order.write_down_amount ?? 0);
    const reduced = order.payment_disposition === 'discounted' || order.payment_disposition === 'comped';
    const collected = Number(order.amount_paid ?? 0);

    const identity = await resolveTenantEmailIdentity(db, order.org_id as string);
    const rendered = await renderEmailTemplate(db, 'ORDER_RECEIPT', {
      'ORG.BRAND_NAME': identity.fromName,
      'ORG.FOOTER': identity.footer,
      'TXN.AMOUNT': `$${amount.toFixed(2)}`,
      'TXN.WRITE_DOWN': reduced ? `$${writeDown.toFixed(2)}` : null,
      'TXN.COLLECTED': reduced && collected > 0 ? `$${collected.toFixed(2)}` : null,
      'TXN.REDUCTION_LABEL': order.payment_disposition === 'comped' ? 'Complimentary'
        : order.payment_disposition === 'discounted' ? 'Discount' : null,
    });
    // A receipt is provable and single: a missing template is a logged failed
    // attempt (below), never a silent nothing and never a blank email.
    if (!rendered) {
      await db.rpc('log_receipt_send', {
        p_purchase_id: orderId, p_key: idempotencyKey, p_recipient: to,
        p_succeeded: false, p_error: 'the ORDER_RECEIPT email template is missing or deactivated',
        p_message_id: null,
      });
      return { sent: false, reason: 'the ORDER_RECEIPT email template is missing or deactivated' };
    }

    const out = await sendViaProvider({
      to,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: rendered.subject,
      html: rendered.html,
    });

    // 5b: log the attempt either way — a receipt is provable.
    await db.rpc('log_receipt_send', {
      p_purchase_id: orderId,
      p_key: idempotencyKey,
      p_recipient: to,
      p_succeeded: out.ok,
      p_error: out.ok ? null : (out.error ?? 'send failed'),
      p_message_id: out.messageId ?? null,
    });

    return out.ok ? { sent: true } : { sent: false, reason: out.error };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'receipt failed';
    try {
      await db.rpc('log_receipt_send', {
        p_purchase_id: orderId, p_key: idempotencyKey, p_recipient: null,
        p_succeeded: false, p_error: reason, p_message_id: null,
      });
    } catch { /* logging must never mask the original failure */ }
    return { sent: false, reason };
  }
}
