/* LANE-2 data wrappers — the member's own balance (/app/balance).
 *
 * Read-only paths, all client-scoped BY RLS (never by client-side filters):
 *   billable_lines — billable_lines_client_read (payer_contact_id = current_contact_id()),
 *   engagements    — engagements_select (client_id = current_client_id()),
 *   transactions   — transactions_read (engagement owner) + transactions_payer_read
 *                    (payer_contact_id = current_contact_id(), migration
 *                    20260702030000 — settlement invoices can carry a NULL
 *                    engagement_id, so payer read is the policy that makes a
 *                    client's own invoice visible),
 *   payments       — payments_owner_read (owns_order(order_id)).
 *
 * Nothing here writes: charges are emitted by staff/module RPCs, invoices by
 * settle_billable_lines (staff-only), payments by the server reconciler.
 */
import { supabase } from '../supabase';

export type BillableSourceKind = 'consumption' | 'board' | 'lesson' | 'fee';
export type BillableLineStatus = 'OPEN' | 'SETTLED' | 'VOID';

export interface OpenBillableLine {
  id: string;
  payer_contact_id: string;
  source_kind: BillableSourceKind;
  source_id: string | null;
  horse_id: string | null;
  qty: number;
  unit_amount: number;
  amount: number;
  status: BillableLineStatus;
  period: string | null;
  transaction_id: string | null;
  created_at: string;
}

export interface MyEngagement {
  id: string;
  display_code: string | null;
  /** NULL for non-service engagements (e.g. a visitor-release kiosk engagement). */
  service_type: string | null;
  status: string;
  primary_horse_id: string | null;
  created_at: string;
}

export interface MyTransaction {
  id: string;
  display_code: string | null;
  engagement_id: string | null;
  txn_type: 'PURCHASE' | 'SALE' | 'LEASE' | 'INVOICE';
  amount: number | null;
  status: string;
  created_at: string;
}

export interface MyPayment {
  id: string;
  order_id: string;
  method: 'zelle' | 'stripe';
  amount: number;
  reference_code: string | null;
  status: 'pending' | 'matched' | 'confirmed' | 'review' | 'failed' | 'refunded';
  created_at: string;
}

/** The caller's OPEN (not yet invoiced) charge lines, newest first. */
export async function listMyOpenBillableLines(): Promise<OpenBillableLine[]> {
  const { data, error } = await supabase
    .from('billable_lines')
    .select('id, payer_contact_id, source_kind, source_id, horse_id, qty, unit_amount, amount, status, period, transaction_id, created_at')
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OpenBillableLine[];
}

/** The caller's engagements (client-scoped by RLS), newest first. Used to
 *  group charges: a line's engagement is inferred from its horse — the same
 *  primary_horse_id derivation settle_billable_lines uses. */
export async function listMyEngagements(): Promise<MyEngagement[]> {
  const { data, error } = await supabase
    .from('engagements')
    .select('id, display_code, service_type, status, primary_horse_id, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MyEngagement[];
}

/** The caller's financial records — settlement INVOICEs (payer read) plus any
 *  PURCHASE/SALE/LEASE transactions on their own engagements. Newest first. */
export async function listMyTransactions(): Promise<MyTransaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, display_code, engagement_id, txn_type, amount, status, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MyTransaction[];
}

/** The caller's payment history across their orders (owner-read RLS), newest
 *  first. order_id links each payment back to /order/:id. */
export async function listMyPayments(): Promise<MyPayment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, order_id, method, amount, reference_code, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MyPayment[];
}
