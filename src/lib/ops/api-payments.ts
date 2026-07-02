/* LANE-2 data wrappers — core payments review queue (Zelle).
 *
 * Read paths over `payment_notifications` (admin-read RLS; rows are written
 * server-side by api/_lib/reconcile.ts with the service role) plus the
 * candidate-order lookup over `orders` by unique_amount / payment_reference —
 * the same two matching keys the server reconciler uses — so staff get manual
 * matching context. Payment CONFIRMATION stays server-side (reconcile /
 * Stripe webhook); nothing here writes `payments` or `orders`.
 */
import { supabase } from '../supabase';

/** The full status vocabulary from the payment_notifications CHECK
 *  (migration 20260623010000): there is NO 'dismissed' value. */
export type PaymentNotificationStatus = 'unmatched' | 'matched' | 'review';

export interface PaymentNotification {
  id: string;
  received_at: string;
  source_inbox: string | null;
  raw_subject: string | null;
  raw_body: string | null;
  parsed_sender: string | null;
  parsed_amount: number | null;
  parsed_reference: string | null;
  matched_payment_id: string | null;
  status: PaymentNotificationStatus;
}

export interface CandidateOrder {
  id: string;
  status: string;
  total: number;
  unique_amount: number | null;
  payment_reference: string | null;
  created_at: string;
}

/** Notifications in one queue bucket, newest first (admin-read RLS). */
export async function listPaymentNotifications(
  status: PaymentNotificationStatus,
): Promise<PaymentNotification[]> {
  const { data, error } = await supabase
    .from('payment_notifications')
    .select('*')
    .eq('status', status)
    .order('received_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PaymentNotification[];
}

/**
 * Candidate `awaiting_payment` orders for MANUAL matching context: exact
 * unique_amount first (the deterministic reconcile key), then
 * payment_reference; results merged + de-duplicated. Mirrors the server
 * matcher's keys so staff see exactly what reconciliation saw.
 */
export async function findCandidateOrders(
  parsedAmount: number | null,
  parsedReference: string | null,
): Promise<CandidateOrder[]> {
  const byId = new Map<string, CandidateOrder>();
  const cols = 'id, status, total, unique_amount, payment_reference, created_at';

  if (parsedAmount !== null && Number.isFinite(parsedAmount)) {
    const { data, error } = await supabase
      .from('orders')
      .select(cols)
      .eq('status', 'awaiting_payment')
      .eq('unique_amount', parsedAmount);
    if (error) throw error;
    for (const row of (data ?? []) as CandidateOrder[]) byId.set(row.id, row);
  }

  if (parsedReference) {
    const { data, error } = await supabase
      .from('orders')
      .select(cols)
      .eq('status', 'awaiting_payment')
      .eq('payment_reference', parsedReference);
    if (error) throw error;
    for (const row of (data ?? []) as CandidateOrder[]) byId.set(row.id, row);
  }

  return [...byId.values()];
}

/**
 * Dismiss = close a queue item WITHOUT confirming any payment.
 *
 * The payment_notifications CHECK allows only unmatched|matched|review — no
 * 'dismissed' and no notes column — so dismissal uses the allowed TERMINAL
 * status 'matched' with matched_payment_id left NULL (reviewed; no payment
 * was created), which removes it from the review/unmatched buckets.
 *
 * KNOWN SERVER GAP (flagged in the lane report): current RLS grants staff
 * SELECT only on payment_notifications (writes are service-role
 * reconciliation). A blocked update returns zero rows, which this wrapper
 * surfaces as an explicit error — never a silent no-op — until an
 * admin-write policy or RPC ships.
 */
export async function dismissNotification(id: string): Promise<PaymentNotification> {
  const { data, error } = await supabase
    .from('payment_notifications')
    .update({ status: 'matched' })
    .eq('id', id)
    .select('*');
  if (error) throw error;
  const row = (data ?? [])[0] as PaymentNotification | undefined;
  if (!row) {
    throw new Error(
      'Dismiss was blocked: payment notifications are server-managed (staff access is read-only until an admin-write policy ships).',
    );
  }
  return row;
}
