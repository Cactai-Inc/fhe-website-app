import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AsyncButton, DataTable, Money, StatusBadge, useAsync, useToast } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import {
  listPaymentNotifications,
  findCandidateOrders,
  dismissNotification,
  type PaymentNotification,
  type PaymentNotificationStatus,
  type CandidateOrder,
} from '../../../lib/ops/api-payments';
import { useDocumentTitle } from '../../../lib/hooks';

/**
 * OPS-PAY-REVIEW — the Zelle payment review queue (core payments, NOT
 * module-gated; the route enforces admin).
 *
 * Staff opens /app/ops/payments/review → the 'review' bucket of
 * payment_notifications (server reconciliation routes ambiguous /
 * underpayment / no-match notifications here), switchable to 'unmatched' and
 * 'matched'. Clicking a notification opens the matching panel: the raw email
 * context plus candidate awaiting_payment orders looked up by the SAME keys
 * the server matcher used (unique_amount, then payment_reference), each
 * linking to its order page. 'Dismiss' closes the item without confirming
 * anything (terminal status; see api-payments.dismissNotification).
 * Payment CONFIRMATION is intentionally absent: it stays server-side
 * (reconcile / webhook) and is never triggered from this UI.
 */

const BUCKETS: { key: PaymentNotificationStatus; label: string }[] = [
  { key: 'review', label: 'Needs review' },
  { key: 'unmatched', label: 'Unmatched' },
  { key: 'matched', label: 'Matched' },
];

function formatReceived(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function PaymentReviewPage() {
  useDocumentTitle('Payment review');
  const [bucket, setBucket] = useState<PaymentNotificationStatus>('review');
  const [rows, setRows] = useState<PaymentNotification[]>([]);
  const [selected, setSelected] = useState<PaymentNotification | null>(null);
  const [candidates, setCandidates] = useState<CandidateOrder[]>([]);

  const load = useAsync(listPaymentNotifications);
  const matches = useAsync(findCandidateOrders);
  const toast = useToast();

  const refresh = useCallback(
    async (status: PaymentNotificationStatus) => {
      const data = await load.run(status);
      setRows(data);
    },
    [load],
  );

  useEffect(() => {
    setSelected(null);
    setCandidates([]);
    refresh(bucket).catch(() => {
      /* surfaced via load.isError */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket]);

  const openMatchPanel = async (row: PaymentNotification) => {
    setSelected(row);
    setCandidates([]);
    try {
      const found = await matches.run(row.parsed_amount, row.parsed_reference);
      setCandidates(found);
    } catch {
      /* surfaced via matches.isError */
    }
  };

  const dismiss = async (row: PaymentNotification) => {
    try {
      await dismissNotification(row.id);
      toast.success('Notification dismissed.');
      setSelected(null);
      setCandidates([]);
      await refresh(bucket);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not dismiss the notification.');
    }
  };

  const columns: Column<PaymentNotification>[] = [
    { key: 'received', header: 'Received', render: (r) => formatReceived(r.received_at) },
    { key: 'sender', header: 'Sender', render: (r) => r.parsed_sender ?? '—' },
    { key: 'amount', header: 'Amount', render: (r) => <Money amount={r.parsed_amount} /> },
    { key: 'reference', header: 'Reference', render: (r) => r.parsed_reference ?? '—' },
    { key: 'subject', header: 'Subject', render: (r) => r.raw_subject ?? '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <p className="eyebrow mb-2">Ops · Payments</p>
        <h1 className="heading-section text-green-800">Payment review</h1>
        <p className="mt-1 text-sm text-green-800/70">
          Zelle notifications the server could not auto-match. Confirmation itself happens
          server-side — this queue is for context and triage only.
        </p>
      </header>

      <nav aria-label="Queue buckets" className="flex gap-2">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            type="button"
            aria-pressed={bucket === b.key}
            className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${
              bucket === b.key
                ? 'border-green-800 bg-green-800 text-white'
                : 'border-green-800/20 bg-white text-green-900 hover:border-green-800/40'
            }`}
            onClick={() => setBucket(b.key)}
          >
            {b.label}
          </button>
        ))}
      </nav>

      {toast.toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`rounded px-4 py-2 text-sm ${
            t.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'
          }`}
        >
          {t.message}
        </div>
      ))}

      {load.isError ? (
        <p role="alert" className="form-error text-sm">
          {load.error?.message ?? 'Could not load payment notifications.'}
        </p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={load.isPending && rows.length === 0}
          onRowClick={openMatchPanel}
          emptyTitle="Queue is clear"
          emptyMessage="No notifications in this bucket."
        />
      )}

      {selected && (
        <section
          aria-label="Manual matching"
          data-testid="match-panel"
          className="rounded border border-green-800/15 bg-white p-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-lg text-green-900">Manual matching</h2>
              <p className="text-sm text-green-800/70">
                {selected.parsed_sender ?? 'Unknown sender'} · <Money amount={selected.parsed_amount} />
                {selected.parsed_reference ? ` · ref ${selected.parsed_reference}` : ''}
              </p>
              {selected.raw_subject && (
                <p className="mt-1 text-sm text-green-900">{selected.raw_subject}</p>
              )}
              {selected.raw_body && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-green-800/5 p-3 text-xs text-green-900">
                  {selected.raw_body}
                </pre>
              )}
            </div>
            {selected.status !== 'matched' && (
              <AsyncButton
                className="btn-secondary"
                pendingLabel="Dismissing…"
                onClick={() => dismiss(selected)}
              >
                Dismiss
              </AsyncButton>
            )}
          </div>

          <div>
            <h3 className="form-label mb-2">Candidate orders (awaiting payment)</h3>
            {matches.isPending ? (
              <p className="text-sm text-green-800/70" data-testid="candidates-loading">
                Searching…
              </p>
            ) : matches.isError ? (
              <p role="alert" className="form-error text-sm">
                {matches.error?.message ?? 'Could not search for candidate orders.'}
              </p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-green-800/70" data-testid="candidates-empty">
                No awaiting-payment order matches this amount or reference.
              </p>
            ) : (
              <ul className="divide-y divide-green-800/10">
                {candidates.map((order) => (
                  <li key={order.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="text-sm text-green-900">
                      <Money amount={order.unique_amount ?? order.total} />
                      {order.payment_reference ? ` · ref ${order.payment_reference}` : ''}
                      <span className="ml-2 text-green-800/60">
                        created {formatReceived(order.created_at)}
                      </span>
                    </div>
                    <Link className="link-underline text-sm" to={`/order/${order.id}`}>
                      Open order
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default PaymentReviewPage;
