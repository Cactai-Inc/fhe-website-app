import { useEffect, useMemo, useState } from 'react';
import { DataTable, Money, StatusBadge, useAsync, type Column } from '../../../lib/ops';
import { listPaymentsBoard, type PaymentBoardRow, type PaymentState } from '../../../lib/ops/api-payments';
import { useDocumentTitle } from '../../../lib/hooks';

/**
 * PAYMENTS PAGE (/app/ops/payments) — every order as a payment entry, filtered by
 * the owner's four states (General item 7):
 *   Awaiting payment — unpaid, nothing declared yet
 *   Payment sent     — the buyer has declared a payment (Zelle/cash), unconfirmed
 *   Paid             — confirmed
 *   Overdue          — still unpaid more than 24 hours after the order was created
 * This is the money view; fulfillment (booked / complete / issue) is on Orders.
 * Confirming a payment still happens in Payment review, which owns the settle
 * spine — this page reads the state, it does not add a second write path.
 */

const BUCKETS: { key: PaymentState | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'awaiting_payment', label: 'Awaiting payment' },
  { key: 'payment_sent', label: 'Payment sent' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
];

const STATE_TONE: Record<PaymentState, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  awaiting_payment: 'neutral', payment_sent: 'info', paid: 'success', overdue: 'danger',
};

const STATE_LABEL: Record<PaymentState, string> = {
  awaiting_payment: 'Awaiting payment', payment_sent: 'Payment sent', paid: 'Paid', overdue: 'Overdue',
};

export function PaymentsPage() {
  useDocumentTitle('Payments');
  const load = useAsync(listPaymentsBoard);
  const [rows, setRows] = useState<PaymentBoardRow[]>([]);
  const [bucket, setBucket] = useState<PaymentState | 'all'>('all');

  useEffect(() => { void load.run().then((r) => setRows(r ?? [])); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.pay_state] = (c[r.pay_state] ?? 0) + 1;
    return c;
  }, [rows]);

  const shown = bucket === 'all' ? rows : rows.filter((r) => r.pay_state === bucket);

  const columns: Column<PaymentBoardRow>[] = [
    { key: 'code', header: 'Order', render: (r) => r.display_code ?? r.id.slice(0, 8) },
    { key: 'buyer', header: 'Buyer', render: (r) => r.buyer_name },
    { key: 'amount', header: 'Amount', render: (r) => <Money amount={r.amount} /> },
    {
      key: 'method', header: 'Method',
      render: (r) => r.payment_method ?? r.client_reported_method
        ?? <span className="text-muted">—</span>,
    },
    {
      key: 'state', header: 'Status',
      render: (r) => <StatusBadge status={STATE_LABEL[r.pay_state]} tone={STATE_TONE[r.pay_state]} />,
    },
    {
      key: 'when', header: 'When',
      render: (r) => r.paid_at
        ? `paid ${new Date(r.paid_at).toLocaleDateString()}`
        : `created ${new Date(r.created_at).toLocaleDateString()}`,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5 py-2">
      <header>
        <p className="eyebrow mb-2">Ops · Payments</p>
        <h1 className="heading-section text-green-800">Payments</h1>
        <p className="mt-1 text-sm text-green-800/70">
          Every payment and where it stands. Confirm a declared payment in Payment
          review — this page is the money ledger across all orders.
        </p>
      </header>

      <nav aria-label="Payment states" className="flex flex-wrap gap-2">
        {BUCKETS.map((b) => {
          const n = b.key === 'all' ? rows.length : (counts[b.key] ?? 0);
          return (
            <button key={b.key} type="button" aria-pressed={bucket === b.key}
              className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${
                bucket === b.key
                  ? 'border-green-800 bg-green-800 text-white'
                  : 'border-green-800/20 bg-white text-green-900 hover:border-green-800/40'}`}
              onClick={() => setBucket(b.key)}>
              {b.label}{n ? ` (${n})` : ''}
            </button>
          );
        })}
      </nav>

      <DataTable columns={columns} rows={shown} loading={load.isPending}
        rowKey={(r) => r.id}
        emptyTitle="No payments here"
        emptyMessage={bucket === 'all' ? 'Payments will appear as orders come in.' : `No payments are ${BUCKETS.find((b) => b.key === bucket)?.label.toLowerCase()}.`} />
    </div>
  );
}

export default PaymentsPage;
