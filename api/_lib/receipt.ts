/* Post-payment receipt email. Called from both confirmation paths (Stripe
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
      .select('id, buyer_user_id, org_id, amount')
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

    const identity = await resolveTenantEmailIdentity(db, order.org_id as string);
    const rendered = await renderEmailTemplate(db, 'ORDER_RECEIPT', {
      'ORG.BRAND_NAME': identity.fromName,
      'ORG.FOOTER': identity.footer,
      'TXN.AMOUNT': `$${amount.toFixed(2)}`,
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
