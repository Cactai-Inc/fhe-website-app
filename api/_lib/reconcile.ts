/* Zelle reconciliation core. Implements the matching + review-queue rules from
 * architecture-flow-spec.md. Pure-ish: takes the admin client + a parsed
 * notification, returns the outcome and performs the DB writes.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ParsedNotification {
  sender?: string | null;
  amount: number;          // dollars
  reference?: string | null;
  rawSubject?: string;
  rawBody?: string;
  sourceInbox?: string;
}

export type ReconcileOutcome =
  | { result: 'confirmed'; orderId: string; paymentId: string }
  | { result: 'review'; reason: string }
  | { result: 'duplicate'; orderId: string };

/**
 * Match a parsed Zelle notification to a pending order and confirm it, or route
 * to the review queue. The primary key is the unique-cents amount (deterministic);
 * the reference code corroborates. Never auto-confirms a low-confidence match.
 */
export async function reconcileNotification(
  db: SupabaseClient,
  n: ParsedNotification,
): Promise<ReconcileOutcome> {
  // Record the raw notification first (audit trail).
  const { data: notif } = await db
    .from('payment_notifications')
    .insert({
      source_inbox: n.sourceInbox ?? null,
      raw_subject: n.rawSubject ?? null,
      raw_body: n.rawBody ?? null,
      parsed_sender: n.sender ?? null,
      parsed_amount: n.amount,
      parsed_reference: n.reference ?? null,
      status: 'unmatched',
    })
    .select('id')
    .single();
  const notificationId = notif?.id as string | undefined;

  const toReview = async (reason: string): Promise<ReconcileOutcome> => {
    if (notificationId) {
      await db.from('payment_notifications').update({ status: 'review' }).eq('id', notificationId);
    }
    return { result: 'review', reason };
  };

  // Find candidate pending orders by exact unique_amount (deterministic key).
  const { data: byAmount } = await db
    .from('orders')
    .select('id, total, unique_amount, payment_reference, status')
    .eq('status', 'awaiting_payment')
    .eq('unique_amount', n.amount);

  let candidates = byAmount ?? [];

  // If amount didn't match (e.g. bank stripped cents), fall back to reference.
  if (candidates.length === 0 && n.reference) {
    const { data: byRef } = await db
      .from('orders')
      .select('id, total, unique_amount, payment_reference, status')
      .eq('status', 'awaiting_payment')
      .eq('payment_reference', n.reference);
    candidates = byRef ?? [];
  }

  if (candidates.length === 0) {
    return toReview('no matching pending order');
  }
  if (candidates.length > 1) {
    return toReview('ambiguous: multiple pending orders match');
  }

  const order = candidates[0];

  // Duplicate guard: a confirmed payment already exists for this order.
  const { data: existing } = await db
    .from('payments')
    .select('id, status')
    .eq('order_id', order.id)
    .in('status', ['confirmed']);
  if (existing && existing.length > 0) {
    if (notificationId) {
      await db.from('payment_notifications')
        .update({ status: 'matched', matched_payment_id: existing[0].id })
        .eq('id', notificationId);
    }
    return { result: 'duplicate', orderId: order.id };
  }

  // Underpayment → review (do not confirm).
  const expected = order.unique_amount ?? order.total;
  if (n.amount + 0.001 < Number(expected)) {
    return toReview('underpayment');
  }

  // Confidence: amount + reference agree = high; amount-only with single match = high.
  const refAgrees = !!n.reference && n.reference === order.payment_reference;
  const confidence = refAgrees ? 'amount+reference' : 'unique-amount';

  // Confirm: create/confirm payment, mark order paid+confirmed, confirm booking.
  const { data: pay } = await db
    .from('payments')
    .insert({
      order_id: order.id,
      method: 'zelle',
      amount: n.amount,
      reference_code: n.reference ?? order.payment_reference ?? null,
      status: 'confirmed',
      match_confidence: confidence,
      matched_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  const nowIso = new Date().toISOString();
  await db.from('orders')
    .update({ status: 'confirmed', paid_at: nowIso, confirmed_at: nowIso })
    .eq('id', order.id);

  // Confirm the held slot/booking (server-side function).
  await db.rpc('confirm_booking_for_order', { p_order_id: order.id });

  if (notificationId) {
    await db.from('payment_notifications')
      .update({ status: 'matched', matched_payment_id: pay?.id ?? null })
      .eq('id', notificationId);
  }

  // Overpayment is allowed to confirm; flag for FHE to handle a credit.
  // (A real impl would write a note; left as a comment for the content pass.)

  return { result: 'confirmed', orderId: order.id, paymentId: pay?.id as string };
}
