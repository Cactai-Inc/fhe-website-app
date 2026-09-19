import { useEffect, useMemo, useState } from 'react';
import { DataTable, Money, StatusBadge, useAsync, type Column } from '../../../lib/ops';
import { listOrdersBoard, type OrderBoardRow, type OrderBucket } from '../../../lib/ops/api-payments';
import { useDocumentTitle } from '../../../lib/hooks';

/**
 * ORDERS PAGE (/app/ops/orders) — every order in one place, filtered by the
 * owner's seven states (General item 8):
 *   New       — an unconfirmed request (draft, no payment declared)
 *   Unpaid    — confirmed, awaiting payment
 *   Booked    — paid, with a scheduled booking still to come
 *   Paid      — paid, no booking scheduled
 *   Complete  — paid, scheduled, and marked complete
 *   Issue     — paid and scheduled, but past and NOT marked complete or cancelled
 *   Cancelled — voided
 * The bucket is computed server-side (staff_orders_board) from the order and its
 * bookings, so the page and the calendar cannot disagree about an order's state.
 * Payments live on their own page; this is the fulfillment view.
 */

const BUCKETS: { key: OrderBucket | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'booked', label: 'Booked' },
  { key: 'paid', label: 'Paid' },
  { key: 'complete', label: 'Complete' },
  { key: 'issue', label: 'Issue' },
  { key: 'cancelled', label: 'Cancelled' },
];

const BUCKET_TONE: Record<OrderBucket, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  new: 'info', unpaid: 'warning', booked: 'info', paid: 'success',
  complete: 'success', issue: 'danger', cancelled: 'neutral',
};

const BUCKET_LABEL: Record<OrderBucket, string> = {
  new: 'New', unpaid: 'Unpaid', booked: 'Booked', paid: 'Paid',
  complete: 'Complete', issue: 'Issue', cancelled: 'Cancelled',
};

export function OrdersPage() {
  useDocumentTitle('Orders');
  const load = useAsync(listOrdersBoard);
  const [rows, setRows] = useState<OrderBoardRow[]>([]);
  const [bucket, setBucket] = useState<OrderBucket | 'all'>('all');

  useEffect(() => { void load.run().then((r) => setRows(r ?? [])); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.bucket] = (c[r.bucket] ?? 0) + 1;
    return c;
  }, [rows]);

  const shown = bucket === 'all' ? rows : rows.filter((r) => r.bucket === bucket);

  const columns: Column<OrderBoardRow>[] = [
    { key: 'code', header: 'Order', render: (r) => r.display_code ?? r.id.slice(0, 8) },
    { key: 'buyer', header: 'Buyer', render: (r) => r.buyer_name },
    { key: 'items', header: 'Items', render: (r) => <span className="text-secondary">{r.items}</span> },
    { key: 'amount', header: 'Amount', render: (r) => <Money amount={r.amount} /> },
    {
      key: 'bookings', header: 'Bookings',
      render: (r) => r.booking_count === 0 ? <span className="text-muted">—</span>
        : `${r.completed_count}/${r.booking_count} done${r.overdue_count > 0 ? ` · ${r.overdue_count} overdue` : ''}`,
    },
    {
      key: 'status', header: 'Status',
      render: (r) => <StatusBadge status={BUCKET_LABEL[r.bucket]} tone={BUCKET_TONE[r.bucket]} />,
    },
    { key: 'created', header: 'Created', render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5 py-2">
      <header>
        <p className="eyebrow mb-2">Ops · Orders</p>
        <h1 className="heading-section text-green-800">Orders</h1>
        <p className="mt-1 text-sm text-green-800/70">
          Every order and where it stands, from the request through to a completed
          booking. Money owed and received lives on the Payments page.
        </p>
      </header>

      <nav aria-label="Order states" className="flex flex-wrap gap-2">
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
        emptyTitle="No orders here"
        emptyMessage={bucket === 'all' ? 'Orders will appear as they come in.' : `No orders are ${BUCKETS.find((b) => b.key === bucket)?.label.toLowerCase()}.`} />
    </div>
  );
}

export default OrdersPage;
