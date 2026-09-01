/* LANE-2 data wrappers — core payments review queue (Zelle + client claims + orders).
 *
 * Read paths over `payment_notifications` (admin-read RLS; rows are written
 * server-side by api/_lib/reconcile.ts with the service role) plus the
 * candidate-purchase lookup over `purchases` by unique_amount / payment_reference —
 * the same two matching keys the server reconciler uses — so staff get manual
 * matching context. Automatic payment CONFIRMATION stays server-side (reconcile
 * webhook); nothing here writes that path.
 *
 * CASHCONFIRM — client-reported claims (report_my_payment, either method) are a
 * SEPARATE queue read directly off `purchases` (staff already have full RLS
 * read/write there via purchases_staff_all). Confirming/declining a claim calls
 * confirm_payment_claim / decline_payment_claim, which settle through the
 * existing mark_purchase_paid spine — one payment spine, not two (D6).
 *
 * TASK ZELLECLOSE Z3 additions: `listOutstandingOrders` / `listPaidOrders`
 * answer "who owes money and who has paid?" directly off `purchases`
 * (`purchases_staff_all` RLS — has_staff_access(), no new RPC needed for reads).
 * `markOrderPaid` is the one staff-manual-confirm entry point — it calls
 * `/api/orders-mark-paid`, which reuses `mark_purchase_paid` + the receipt
 * trail (`api/_lib/receipt.ts`), never a second write path.
 *
 * TASK-BACKDATE additions: `markOrderPaid` takes the DATE the money arrived, and
 * `listOutstandingOrders` stopped hiding `draft`. Both exist for the owner's
 * backfill of a year of trading. ⚠️ `markOrderPaid` is still the ONE seam — the
 * staff client record (`ContactDossierModal`'s Orders tab) settles through this
 * exact function and this exact endpoint, not a second write path beside it.
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

/* ── CASHCONFIRM — client-reported claims (zelle or cash) ─────────────────── */

/* One definition, the union of both tasks' needs: CASHCONFIRM's queue only ever
 * shows pending/confirmed/declined; ZELLECLOSE's order rows also carry 'none'
 * for an order nobody has claimed. A narrower duplicate was removed at merge. */
export type ClaimStatus = 'none' | 'pending' | 'confirmed' | 'declined';
export type ClientReportedMethod = 'zelle' | 'cash';

export interface PaymentClaim {
  id: string;
  display_code: string | null;
  amount: number;
  buyer_name: string | null;
  client_reported_method: ClientReportedMethod;
  client_reported_reference: string | null;
  client_reported_at: string;
  client_claim_status: ClaimStatus;
  client_claim_decline_reason: string | null;
}

interface PaymentClaimRow {
  id: string;
  display_code: string | null;
  amount: number;
  client_reported_method: ClientReportedMethod;
  client_reported_reference: string | null;
  client_reported_at: string;
  client_claim_status: ClaimStatus;
  client_claim_decline_reason: string | null;
  buyer: { first_name: string | null; last_name: string | null } | null;
}

/** Claims in one bucket, newest first. Reads `purchases` directly — staff
 *  already have full RLS access there (purchases_staff_all); no RPC needed. */
export async function listPaymentClaims(status: ClaimStatus): Promise<PaymentClaim[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select(
      'id, display_code, amount, client_reported_method, client_reported_reference, ' +
        'client_reported_at, client_claim_status, client_claim_decline_reason, ' +
        'buyer:buyer_contact_id(first_name, last_name)',
    )
    .eq('client_claim_status', status)
    .order('client_reported_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PaymentClaimRow[]).map((r) => ({
    id: r.id,
    display_code: r.display_code,
    amount: r.amount,
    buyer_name: [r.buyer?.first_name, r.buyer?.last_name].filter(Boolean).join(' ') || null,
    client_reported_method: r.client_reported_method,
    client_reported_reference: r.client_reported_reference,
    client_reported_at: r.client_reported_at,
    client_claim_status: r.client_claim_status,
    client_claim_decline_reason: r.client_claim_decline_reason,
  }));
}

/**
 * Confirm a pending claim: settles through confirm_payment_claim (which itself
 * calls mark_purchase_paid — the same spine a matched Zelle payment uses), then
 * best-effort triggers the same receipt email Zelle confirmation sends.
 * The receipt call never blocks or fails the confirmation — it is fire-and-log,
 * mirroring the "a receipt must never fail a payment confirmation" contract in
 * api/_lib/receipt.ts.
 */
export async function confirmPaymentClaim(purchaseId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_payment_claim', { p_purchase_id: purchaseId });
  if (error) throw error;

  try {
    const { data: sess } = await supabase.auth.getSession();
    const bearer = sess?.session?.access_token;
    if (!bearer) return;
    await fetch('/api/send-order-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ purchaseId }),
    });
  } catch {
    /* best-effort: receipt_sends still gets a failed-attempt row server-side
       when the call reaches it; a network failure before that is not fatal to
       the confirmation, which has already succeeded. */
  }
}

/** Decline a pending claim that never arrived. `payment_status` is untouched —
 *  a claim never set it — and the claim row is retained (D11), only its
 *  resolution changes. A reason is required. */
export async function declinePaymentClaim(purchaseId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('decline_payment_claim', {
    p_purchase_id: purchaseId,
    p_reason: reason,
  });
  if (error) throw error;
}


/* ── ZELLECLOSE Z3: "who owes money and who has paid?" ─────────────────── */

/** ClaimStatus mirrors TASK-CASHCONFIRM's `client_claim_status` enum (its
 *  migration is already live in prod — coordination note in
 *  `api/orders-mark-paid.ts`). This page does not own that state machine;
 *  it only reads it so staff aren't blind to a pending claim from here. */
export interface OrderRow {
  id: string;
  amount: number;
  amount_paid: number;
  status: string;
  /** The order's TRUE status code — 'payment_pending_zelle' / 'payment_pending_cash'
   *  once the client has declared, which `payment_status` ('pending') cannot say. */
  current_status: string | null;
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
  current_status: string | null;
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

const ORDER_COLS = `id, amount, amount_paid, status, current_status, payment_status, payment_method,
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

/** Orders that owe money — draft/awaiting_payment/sent, unpaid or partially paid.
 *  Excludes void.
 *
 *  ⚠️ TASK-BACKDATE R4 — `draft` USED TO BE FILTERED OUT HERE, on the reasoning
 *  that it is "not a real commitment yet". Measured in production 2026-09-01:
 *  12 awaiting_payment/unpaid, 4 paid, and ONE draft/unpaid — `PUR-000302`,
 *  $880, created 2026-08-22 — that NO surface in the app could settle. It was
 *  not deferred, it was invisible.
 *
 *  **THE CHOICE WAS: LIST IT, OR PROMOTE IT ON SETTLEMENT. Listing it wins**,
 *  for one reason — promotion cannot happen to an order nobody can find, so it
 *  answers a question that only arises after this one is answered. And the
 *  promotion happens anyway as a consequence, not as a separate mechanism:
 *  `mark_purchase_paid` already sets `status = 'paid'` when the money is all in,
 *  so settling a draft moves it off draft by the same write that settles it.
 *
 *  The list is the "who owes money" list, and a draft that owes $880 owes $880.
 *  `orderStatusLabel` already renders it honestly as "In progress", so the row
 *  never claims to be something it is not. */
export async function listOutstandingOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select(ORDER_COLS)
    .in('status', ['draft', 'awaiting_payment', 'sent'])
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
  /** `part_paid` = the money was recorded but the order is not settled yet — a
   *  split, with a balance still outstanding. No receipt is sent for a part. */
  status: 'paid' | 'part_paid' | 'already_paid';
  /** `reason: 'backdated'` = the settlement was recorded against an earlier day,
   *  so no receipt was sent on purpose. Say so on screen — an unexplained
   *  "receipt NOT sent" reads as a failure. */
  receipt: { sent: boolean; reason?: string };
  /** The date the settlement was recorded against (`YYYY-MM-DD`), or null for a
   *  same-day settlement, which is recorded at `now()` exactly as before. */
  recordedAt: string | null;
  /** True when this settled a pending CASHCONFIRM claim (via
   *  confirm_payment_claim) rather than a fresh mark_purchase_paid call —
   *  the method/reference passed in were not what actually got used. */
  claimConfirmed: boolean;
}

/** The one staff-manual "mark this existing order paid" entry point — server
 *  half is `/api/orders-mark-paid` (reuses mark_purchase_paid — or, when a
 *  claim is pending, confirm_payment_claim — plus the receipt trail; never a
 *  second write path). */
/** `amount` settles only that much and leaves the order open — the split between
 *  cash and Zelle. Omit it to settle the remainder, which is the old behaviour and
 *  what every existing caller does.
 *
 *  ⚠️ TASK-BACKDATE — `paidAt` is a bare `YYYY-MM-DD` at the barn and is the date
 *  the money actually arrived. It lands on `purchases.paid_at`, which is what
 *  `revenue_summary` recognises revenue at, so this is the argument that decides
 *  which MONTH a backfilled payment counts in. **Pass it only when it is in the
 *  past** (`asRecordedDate` in `src/lib/recordedDate.ts` enforces that) — omitted
 *  keeps `now()` and keeps the receipt, which is the unchanged same-day path.
 *  A past date suppresses the receipt email server-side and comes back as
 *  `receipt.reason === 'backdated'`. A future one is refused with a 400. */
export async function markOrderPaid(
  purchaseId: string,
  method: 'zelle' | 'cash',
  reference?: string,
  amount?: number,
  paidAt?: string,
): Promise<MarkOrderPaidResult> {
  const { data: sess } = await supabase.auth.getSession();
  const bearer = sess?.session?.access_token;
  if (!bearer) throw new Error('You need to be signed in.');
  const res = await fetch('/api/orders-mark-paid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ purchaseId, method, reference, amount, paidAt }),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<MarkOrderPaidResult> & { error?: string };
  if (!res.ok) throw new Error(json.error || 'Could not mark this order paid.');
  return {
    status: (json.status as MarkOrderPaidResult['status']) ?? 'paid',
    receipt: json.receipt ?? { sent: false },
    claimConfirmed: json.claimConfirmed ?? false,
    recordedAt: json.recordedAt ?? null,
  };
}
