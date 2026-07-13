/* Post-payment receipt email. Called from both confirmation paths (Stripe
 * webhook + Zelle reconcile) after an order flips to confirmed.
 *
 * Best-effort by contract: a receipt must never fail a payment confirmation, so
 * every step is caught and the function resolves { sent: false } instead of
 * throwing. Tenant identity resolves from the ORDER's org (registry-scoped —
 * never a hardcoded brand).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTenantEmailIdentity, renderTemplate, sendViaProvider } from './email.js';

export interface ReceiptResult {
  sent: boolean;
  reason?: string;
}

export async function sendOrderReceipt(db: SupabaseClient, orderId: string): Promise<ReceiptResult> {
  try {
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
    const tpl = renderTemplate('receipt', { amount: `$${amount.toFixed(2)}` }, identity.fromName);
    const html = `${tpl.body}\n<hr/><pre style="font-family:inherit">${identity.footer}</pre>`;

    const out = await sendViaProvider({
      to,
      fromName: identity.fromName,
      fromEmail: identity.fromEmail,
      subject: tpl.subject,
      html,
    });
    return out.ok ? { sent: true } : { sent: false, reason: out.error };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : 'receipt failed' };
  }
}
