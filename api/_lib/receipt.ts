/* Post-payment receipt email. Called from both confirmation paths (Stripe
 * webhook + Zelle reconcile) after an order flips to confirmed.
 *
 * Best-effort by contract: a receipt must never fail a payment confirmation, so
 * every step is caught and the function resolves { sent: false } instead of
 * throwing. Tenant identity resolves from the ORDER's org (registry-scoped —
 * never a hardcoded brand).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTenantEmailIdentity, renderTemplate, sendViaProvider } from './email';

export interface ReceiptResult {
  sent: boolean;
  reason?: string;
}

export async function sendOrderReceipt(db: SupabaseClient, orderId: string): Promise<ReceiptResult> {
  try {
    const { data: order } = await db
      .from('orders')
      .select('id, user_id, org_id, total')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) return { sent: false, reason: 'order not found' };

    const { data: profile } = await db
      .from('profiles')
      .select('email')
      .eq('user_id', order.user_id)
      .maybeSingle();
    const to = profile?.email as string | undefined;
    if (!to) return { sent: false, reason: 'no recipient email' };

    const { data: payment } = await db
      .from('payments')
      .select('amount')
      .eq('order_id', order.id)
      .eq('status', 'confirmed')
      .maybeSingle();
    const amount = Number(payment?.amount ?? order.total);

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
