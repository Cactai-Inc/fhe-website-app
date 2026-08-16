/* LANE-2 data wrappers — core payments review queue (Zelle).
 *
 * Read paths over `payment_notifications` (admin-read RLS; rows are written
 * server-side by api/_lib/reconcile.ts with the service role) plus the
 * candidate-purchase lookup over `purchases` by unique_amount / payment_reference —
 * the same two matching keys the server reconciler uses — so staff get manual
 * matching context. Automatic payment CONFIRMATION stays server-side (reconcile
 * / Stripe webhook).
 *
 * TASK ZELLECLOSE Z3 additions: `listOutstandingOrders` / `listPaidOrders`
 * answer "who owes money and who has paid?" directly off `purchases`
 * (`purchases_staff_all` RLS — has_staff_access(), no new RPC needed for reads).
 * `markOrderPaid` is the one staff-manual-confirm entry point — it calls
 * `/api/orders-mark-paid`, which reuses `mark_purchase_paid` + the receipt
 * trail (`api/_lib/receipt.ts`), never a second write path.
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
  matched_purchase_id: string | null;
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
 * Candidate `awaiting_payment` purchases for MANUAL matching context: exact
 * unique_amount first (the deterministic reconcile key), then
 * payment_reference; results merged + de-duplicated. Mirrors the server
 * matcher's keys so staff see exactly what reconciliation saw.
 *
 * `total` is aliased off the purchase's `amount` column so the read model keeps
 * its shape.
 */
export async function findCandidateOrders(
  parsedAmount: number | null,
  parsedReference: string | null,
): Promise<CandidateOrder[]> {
  const byId = new Map<string, CandidateOrder>();
  const cols = 'id, status, total:amount, unique_amount, payment_reference, created_at';

  if (parsedAmount !== null && Number.isFinite(parsedAmount)) {
    const { data, error } = await supabase
      .from('purchases')
      .select(cols)
      .eq('status', 'awaiting_payment')
      .eq('unique_amount', parsedAmount);
    if (error) throw error;
    for (const row of (data ?? []) as unknown as CandidateOrder[]) byId.set(row.id, row);
  }

  if (parsedReference) {
    const { data, error } = await supabase
      .from('purchases')
      .select(cols)
      .eq('status', 'awaiting_payment')
      .eq('payment_reference', parsedReference);
    if (error) throw error;
    for (const row of (data ?? []) as unknown as CandidateOrder[]) byId.set(row.id, row);
  }

  return [...byId.values()];
}

/**
 * Dismiss = close a queue item WITHOUT confirming any payment.
 *
 * The payment_notifications CHECK allows only unmatched|matched|review — no
 * 'dismissed' and no notes column — so dismissal uses the allowed TERMINAL
 * status 'matched' with matched_purchase_id left NULL (reviewed; no payment
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

/* ── ZELLECLOSE Z3: "who owes money and who has paid?" ─────────────────── */

/** ClaimStatus mirrors TASK-CASHCONFIRM's `client_claim_status` enum (its
 *  migration is already live in prod — coordination note in
 *  `api/orders-mark-paid.ts`). This page does not own that state machine;
 *  it only reads it so staff aren't blind to a pending claim from here. */
export type ClaimStatus = 'none' | 'pending' | 'confirmed' | 'declined';

export interface OrderRow {
  id: string;
  amount: number;
  amount_paid: number;
  status: string;
  payment_status: 'unpaid' | 'pending' | 'paid';
  payment_method: string | null;
  payment_reference: string | null;
  unique_amount: number | null;
  client_reported_method: string | null;
  client_reported_at: string | null;
  client_claim_status: ClaimStatus;
  paid_at: string | null;
  created_at: string;
  buyerName: string;
  items: string;
}

interface RawOrderRow {
  id: string;
  amount: number;
  amount_paid: number;
  status: string;
  payment_status: 'unpaid' | 'pending' | 'paid';
  payment_method: string | null;
  payment_reference: string | null;
  unique_amount: number | null;
  client_reported_method: string | null;
  client_reported_at: string | null;
  client_claim_status: ClaimStatus;
  paid_at: string | null;
  created_at: string;
  contacts: { first_name: string | null; last_name: string | null } | null;
  purchase_items: { label: string | null }[] | null;
}

const ORDER_COLS = `id, amount, amount_paid, status, payment_status, payment_method,
  payment_reference, unique_amount, client_reported_method, client_reported_at,
  client_claim_status, paid_at, created_at,
  contacts:buyer_contact_id ( first_name, last_name ),
  purchase_items ( label )`;

function toOrderRow(r: RawOrderRow): OrderRow {
  const buyerName = [r.contacts?.first_name, r.contacts?.last_name].filter(Boolean).join(' ').trim() || 'Unknown buyer';
  const items = (r.purchase_items ?? []).map((i) => i.label).filter(Boolean).join(', ') || 'Order';
  const { contacts: _contacts, purchase_items: _items, ...rest } = r;
  return { ...rest, buyerName, items };
}

/** Orders that owe money — awaiting_payment/sent, unpaid or partially paid.
 *  Excludes draft (not a real commitment yet) and void. */
export async function listOutstandingOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select(ORDER_COLS)
    .in('status', ['awaiting_payment', 'sent'])
    .in('payment_status', ['unpaid', 'pending'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toOrderRow(r as unknown as RawOrderRow));
}

/** Recently paid orders, newest first. */
export async function listPaidOrders(limit = 25): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select(ORDER_COLS)
    .eq('payment_status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => toOrderRow(r as unknown as RawOrderRow));
}

export interface MarkOrderPaidResult {
  status: 'paid' | 'already_paid';
  receipt: { sent: boolean; reason?: string };
  /** True when this settled a pending CASHCONFIRM claim (via
   *  confirm_payment_claim) rather than a fresh mark_purchase_paid call —
   *  the method/reference passed in were not what actually got used. */
  claimConfirmed: boolean;
}

/** The one staff-manual "mark this existing order paid" entry point — server
 *  half is `/api/orders-mark-paid` (reuses mark_purchase_paid — or, when a
 *  claim is pending, confirm_payment_claim — plus the receipt trail; never a
 *  second write path). */
export async function markOrderPaid(
  purchaseId: string,
  method: 'zelle' | 'cash',
  reference?: string,
): Promise<MarkOrderPaidResult> {
  const { data: sess } = await supabase.auth.getSession();
  const bearer = sess?.session?.access_token;
  if (!bearer) throw new Error('You need to be signed in.');
  const res = await fetch('/api/orders-mark-paid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ purchaseId, method, reference }),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<MarkOrderPaidResult> & { error?: string };
  if (!res.ok) throw new Error(json.error || 'Could not mark this order paid.');
  return {
    status: (json.status as MarkOrderPaidResult['status']) ?? 'paid',
    receipt: json.receipt ?? { sent: false },
    claimConfirmed: json.claimConfirmed ?? false,
  };
}
