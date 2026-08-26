import { supabase } from './supabase';

/**
 * MY PAYMENTS — the ledger (CR-76b, owner 2026-08-25).
 *
 * "My Payments is a history ledger showing every time a payment page was engaged
 *  with and what it saved and what its assocaited with, when it was done, all the
 *  changes made if any exist, and the fuller picture of the status and timestamps."
 *
 * ⚠️ THIS IS AN AUDIT TRAIL, NOT AN OUTSTANDING LIST. It carries paid history as
 * well as what is still owed — the question "does the payments page carry paid
 * history, or only what is outstanding?" was answered EVERYTHING.
 *
 * ⚠️ THERE IS NO WRITE FUNCTION IN HERE ON PURPOSE. A payment entry is a
 * consequence of one of the five existing doors (declare, change method, mark
 * paid, confirm claim, decline claim) — D18, no second write path. Changing a
 * pending method goes through `updatePurchasePaymentMethod` in `api.ts`, the same
 * call the order's own control uses.
 */
export interface PaymentHistoryEntry {
  at: string;
  code: string;
  label: string;
  detail: string | null;
}

export interface PaymentLedgerEntry {
  payment_id: string;
  /** PAY-000001. Minted per INPUT on the payment screen, not per order. */
  payment_number: string | null;
  order_id: string;
  order_number: string | null;
  status: 'pending' | 'paid' | 'declined' | 'cancelled';
  method: 'zelle' | 'cash';
  amount: number;
  reference: string | null;
  declared_at: string;
  confirmed_at: string | null;
  decline_reason: string | null;
  /** Pending only, and the METHOD only — never the amount, never who pays. */
  can_change_method: boolean;
  what: string;
  order_total: number | null;
  /** CR-27: the submission is a `requests` row, the order is the `purchases` row
   *  approval creates — so these two are stitched from different records. */
  submitted_at: string | null;
  approved_at: string | null;
  marked_paid_at: string | null;
  history: PaymentHistoryEntry[];
}

export async function myPayments(): Promise<PaymentLedgerEntry[]> {
  const { data, error } = await supabase.rpc('my_payments');
  if (error) throw error;
  return (data ?? []) as PaymentLedgerEntry[];
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  declined: 'Not verified',
  cancelled: 'Cancelled',
};

/** The two methods, lowercase, exactly as the database stores them. Owner,
 *  2026-08-25: "thats it there are only two choices for payment". Card and check
 *  were never authorised and Stripe is not set up. */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  zelle: 'Zelle',
  cash: 'Cash',
};
