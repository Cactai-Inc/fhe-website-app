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
  | { result: 'confirmed'; orderId: string }
  | { result: 'fee_confirmed'; changeId: string }
  | { result: 'review'; reason: string }
  | { result: 'duplicate'; orderId: string };

/**
 * Match a parsed Zelle notification to a pending purchase and confirm it, or
 * route to the review queue. The primary key is the unique-cents amount
 * (deterministic); the reference code corroborates. Never auto-confirms a
 * low-confidence match. Payment lives INLINE on the purchase row now — the
 * confirm step calls the mark_purchase_paid + confirm_booking_for_purchase RPCs
 * (the `payments` table is retired).
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

  // Find candidate pending purchases by exact unique_amount (deterministic key).
  const purchaseCols = 'id, amount, unique_amount, payment_reference, status, payment_status';
  const { data: byAmount } = await db
    .from('purchases')
    .select(purchaseCols)
    .eq('status', 'awaiting_payment')
    .eq('unique_amount', n.amount);

  let candidates = byAmount ?? [];

  // If amount didn't match (e.g. bank stripped cents), fall back to reference.
  if (candidates.length === 0 && n.reference) {
    const { data: byRef } = await db
      .from('purchases')
      .select(purchaseCols)
      .eq('status', 'awaiting_payment')
      .eq('payment_reference', n.reference);
    candidates = byRef ?? [];
  }

  if (candidates.length === 0) {
    // Fallback: a reschedule FEE. Match by IDENTITY — the payer's memo, sender
    // name, email, or phone appearing in the notification. Any one is a match;
    // none → internal review. Amount is only a tiebreaker when the identity
    // matches MORE THAN ONE open fee.
    const feeOutcome = await matchRescheduleFee(db, n, notificationId);
    if (feeOutcome) return feeOutcome;
    return toReview('no matching pending purchase or fee');
  }
  if (candidates.length > 1) {
    return toReview('ambiguous: multiple pending purchases match');
  }

  const order = candidates[0];

  // Duplicate guard: the purchase is already paid.
  if (order.payment_status === 'paid') {
    if (notificationId) {
      await db.from('payment_notifications')
        .update({ status: 'matched', matched_purchase_id: order.id })
        .eq('id', notificationId);
    }
    return { result: 'duplicate', orderId: order.id };
  }

  // Underpayment → review (do not confirm).
  const expected = order.unique_amount ?? order.amount;
  if (n.amount + 0.001 < Number(expected)) {
    return toReview('underpayment');
  }

  // Confirm: mark the purchase paid inline, then confirm the held slot/booking.
  await db.rpc('mark_purchase_paid', {
    p_purchase_id: order.id,
    p_amount: n.amount,
    p_reference: n.reference ?? order.payment_reference ?? null,
  });
  await db.rpc('confirm_booking_for_purchase', { p_purchase_id: order.id });

  if (notificationId) {
    await db.from('payment_notifications')
      .update({ status: 'matched', matched_purchase_id: order.id })
      .eq('id', notificationId);
  }

  // Overpayment is allowed to confirm; flag for FHE to handle a credit.
  // (A real impl would write a note; left as a comment for the content pass.)

  return { result: 'confirmed', orderId: order.id };
}

interface FeeCandidate {
  id: string;
  fee_amount: number | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}

const onlyDigits = (s: string) => s.replace(/\D/g, '');

/** Does this payer identity appear anywhere in the notification text? Email or
 *  phone (7+ digits) is a strong hit; a full name substring counts too. */
function identityHit(hay: string, hayDigits: string, c: FeeCandidate): boolean {
  const email = c.email?.toLowerCase().trim();
  if (email && email.length > 3 && hay.includes(email)) return true;
  const phone = c.phone ? onlyDigits(c.phone) : '';
  if (phone.length >= 7 && hayDigits.includes(phone)) return true;
  const name = c.name?.toLowerCase().trim();
  if (name && name.length > 2 && hay.includes(name)) return true;
  return false;
}

/** Match a notification to an open reschedule fee by identity (memo/sender/
 *  email/phone), using amount only to break a multi-identity tie. Returns the
 *  outcome when it matched or was ambiguous, or null to fall through to review. */
async function matchRescheduleFee(
  db: SupabaseClient,
  n: ParsedNotification,
  notificationId: string | undefined,
): Promise<ReconcileOutcome | null> {
  const { data } = await db.rpc('pending_fee_candidates');
  const candidates = (data ?? []) as FeeCandidate[];
  if (candidates.length === 0) return null;

  // The full notification text is the haystack (memo/reference included).
  const hay = [n.sender, n.reference, n.rawSubject, n.rawBody].filter(Boolean).join(' ').toLowerCase();
  const hayDigits = onlyDigits(hay);

  let hits = candidates.filter((c) => identityHit(hay, hayDigits, c));
  if (hits.length === 0) return null; // no identity → route to review

  if (hits.length > 1) {
    // tie-break by amount; only auto-confirm when it resolves to exactly one
    const byAmount = hits.filter((c) => Number(c.fee_amount) === n.amount);
    if (byAmount.length !== 1) {
      if (notificationId) await db.from('payment_notifications').update({ status: 'review' }).eq('id', notificationId);
      return { result: 'review', reason: 'ambiguous fee: multiple payers match' };
    }
    hits = byAmount;
  }

  const changeId = hits[0].id;
  await db.from('booking_change_requests').update({ fee_paid: true }).eq('id', changeId);
  if (notificationId) await db.from('payment_notifications').update({ status: 'matched' }).eq('id', notificationId);
  return { result: 'fee_confirmed', changeId };
}
