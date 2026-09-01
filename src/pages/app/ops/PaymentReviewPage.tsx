import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { Link } from 'react-router-dom';
import { AsyncButton, DataTable, Money, StatusBadge, useAsync, useToast } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import {
  listPaymentNotifications,
  findCandidateOrders,
  dismissNotification,
  listPaymentClaims,
  confirmPaymentClaim,
  declinePaymentClaim,
  listOutstandingOrders,
  listPaidOrders,
  markOrderPaid,
  type PaymentNotification,
  type PaymentNotificationStatus,
  type CandidateOrder,
  type PaymentClaim,
  type ClaimStatus,
  type OrderRow,
} from '../../../lib/ops/api-payments';
import { useDocumentTitle } from '../../../lib/hooks';
import { asRecordedDate, barnToday } from '../../../lib/recordedDate';
import { RecordedDateField } from '../../../components/app/RecordedDateField';
import { orderStatusCode, orderStatusLabel } from '../../../lib/orderStatus';
import { statusTone } from '../../../lib/ops/api-status';

/**
 * OPS-PAY-REVIEW — the payment review queue (core payments, NOT module-gated;
 * the route enforces admin).
 *
 * Staff opens /app/ops/payments/review → the 'review' bucket of
 * payment_notifications (server reconciliation routes ambiguous /
 * underpayment / no-match notifications here), switchable to 'unmatched' and
 * 'matched'. Clicking a notification opens the matching panel: the raw email
 * context plus candidate awaiting_payment orders looked up by the SAME keys
 * the server matcher used (unique_amount, then payment_reference), each
 * linking to its order page. 'Dismiss' closes the item without confirming
 * anything (terminal status; see api-payments.dismissNotification). Automatic
 * matching CONFIRMATION is intentionally absent from the notification buckets:
 * it stays server-side (reconcile / webhook) and is never triggered from this UI.
 *
 * CASHCONFIRM — a FOURTH bucket, 'Client claims', added alongside the three
 * above (not a replacement): client-reported claims (report_my_payment,
 * either zelle or cash) that DO get a staff confirm/decline button here,
 * because unlike a Zelle notification a claim has no automatic settlement
 * path at all. See ClaimsQueue below.
 *
 * TASK ZELLECLOSE Z3 added the 'orders' bucket — "who owes money and who has
 * paid?" — direct off `purchases`, with the one staff-manual "mark paid"
 * action (zelle/cash), reusing mark_purchase_paid via /api/orders-mark-paid
 * (same spine automatic matching uses, not a second one).
 *
 * TASK-BACKDATE — the Outstanding table now carries ONE date control for the
 * whole table ("Date paid"), because a backfill session is a run of payments
 * from the same day, not one date per row: set it once, settle the six orders
 * that were paid that afternoon, move on. It defaults to today, where it sends
 * no date at all and every button behaves exactly as it did before.
 *
 * ⚠️ AND IT IS NO LONGER THE ONLY DOOR. `markOrderPaid` is now also called from
 * `ContactDossierModal`'s Orders tab — the staff client record — through this
 * same function and this same endpoint. This page stays the queue ("who owes
 * money"); the record is where you settle the person in front of you.
 *
 * ⚠️ `draft` orders appear in Outstanding now. One existed in production and no
 * surface in the app could settle it. See `listOutstandingOrders`.
 */

type Bucket = PaymentNotificationStatus | 'claims' | 'orders';

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'review', label: 'Needs review' },
  { key: 'unmatched', label: 'Unmatched' },
  { key: 'matched', label: 'Matched' },
  { key: 'claims', label: 'Client claims' },
  { key: 'orders', label: 'Orders' },
];

const usdShort = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

/** Record part of what an order owes. The remaining balance is the default and
 *  the maximum — a part payment can never settle more than is outstanding, and
 *  the database refuses it independently if this is ever bypassed. */
function PartPaymentPanel({ order, onRecord, onCancel }: {
  order: { amount: number; amount_paid: number };
  onRecord: (method: 'zelle' | 'cash', amount: number) => void;
  onCancel: () => void;
}) {
  const owed = Math.max(order.amount - order.amount_paid, 0);
  const [amount, setAmount] = useState(String(owed.toFixed(2)));
  const n = Number(amount);
  const valid = Number.isFinite(n) && n > 0 && n <= owed + 0.005;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-green-800/15 bg-cream-100/40 p-3">
      <span className="text-xs text-muted">Outstanding {usdShort(owed)} — record</span>
      <input value={amount} onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal" aria-label="Part payment amount"
        className="w-28 rounded-lg border border-green-800/15 px-2.5 py-1.5 text-sm focus-ring" />
      <AsyncButton className="btn-secondary" pendingLabel="Recording…" disabled={!valid}
        onClick={async () => onRecord('zelle', n)}>Zelle</AsyncButton>
      <AsyncButton className="btn-secondary" pendingLabel="Recording…" disabled={!valid}
        onClick={async () => onRecord('cash', n)}>Cash</AsyncButton>
      <button type="button" className="btn-ghost text-xs" onClick={onCancel}>Cancel</button>
      {!valid && <span className="text-xs text-red-700">Enter an amount up to {usdShort(owed)}.</span>}
    </div>
  );
}

function formatReceived(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function PaymentReviewPage() {
  useDocumentTitle('Payment review');
  const [bucket, setBucket] = useState<Bucket>('review');
  const [rows, setRows] = useState<PaymentNotification[]>([]);
  const [selected, setSelected] = useState<PaymentNotification | null>(null);
  const [candidates, setCandidates] = useState<CandidateOrder[]>([]);
  const [outstanding, setOutstanding] = useState<OrderRow[]>([]);
  const [paid, setPaid] = useState<OrderRow[]>([]);

  const load = useAsync(listPaymentNotifications);
  const matches = useAsync(findCandidateOrders);
  const outstandingLoad = useAsync(listOutstandingOrders);
  const paidLoad = useAsync(listPaidOrders);
  const toast = useToast();

  const refresh = useCallback(
    async (status: Bucket) => {
      // Neither of the non-notification buckets loads from this queue:
      // ClaimsQueue and the orders view each fetch their own rows.
      if (status === 'claims' || status === 'orders') return;
      const data = await load.run(status);
      setRows(data);
    },
    [load],
  );

  const refreshOrders = useCallback(async () => {
    const [o, p] = await Promise.all([outstandingLoad.run(), paidLoad.run()]);
    setOutstanding(o);
    setPaid(p);
  }, [outstandingLoad, paidLoad]);

  useEffect(() => {
    setSelected(null);
    setCandidates([]);
    if (bucket === 'orders') {
      refreshOrders().catch(() => {
        /* surfaced via outstandingLoad.isError / paidLoad.isError */
      });
      return;
    }
    refresh(bucket).catch(() => {
      /* surfaced via load.isError */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket]);

  /* `amount` records a PART payment: only that much is settled, the order stays
     open with the balance outstanding, and this part becomes its own numbered
     payment record. Omitted, the order settles in full — the behaviour every
     existing button here has always had. */
  const markPaid = async (order: OrderRow, method: 'zelle' | 'cash', amount?: number) => {
    try {
      // TASK-BACKDATE: `asRecordedDate` returns undefined for today, so a
      // same-day settlement sends no date and keeps `now()` and its receipt.
      const result = await markOrderPaid(order.id, method, undefined, amount, asRecordedDate(paidOn));
      const verb = result.claimConfirmed ? 'Confirmed the client’s claim' : `Marked paid (${method})`;
      // ⚠️ "receipt NOT sent" with no reason reads as a failure. A backdated
      // settlement suppressed it ON PURPOSE and has to say so.
      const asOf = result.recordedAt ? ` Recorded as of ${result.recordedAt}.` : '';
      toast.success(
        result.status === 'already_paid'
          ? 'That order was already marked paid.'
          : result.status === 'part_paid'
            // No receipt on a part, and saying so is the point: the balance is
            // still owed and the client has not been told anything is settled.
            ? `Recorded ${usdShort(amount ?? 0)} by ${method}. The balance is still outstanding.${asOf}`
            : result.receipt.sent
              ? `${verb} — receipt sent.${asOf}`
              : result.receipt.reason === 'backdated'
                ? `${verb}.${asOf} No receipt was sent — this money arrived before today.`
                : `${verb} — receipt NOT sent (${result.receipt.reason ?? 'unknown reason'}).${asOf}`,
      );
      await refreshOrders();
      setSplitting(null);
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not mark this order paid.'));
    }
  };

  const [splitting, setSplitting] = useState<OrderRow | null>(null);
  /** TASK-BACKDATE: the date every settlement on this table is recorded against.
   *  One control for the table, not one per row — see the note at the top. */
  const [paidOn, setPaidOn] = useState(barnToday());

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
      // dismiss is only reachable from a notification row (bucket !== 'orders')
      await refresh(bucket as PaymentNotificationStatus);
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not dismiss the notification.'));
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

  const outstandingColumns: Column<OrderRow>[] = [
    { key: 'buyer', header: 'Who', render: (r) => r.buyerName },
    { key: 'items', header: 'For', render: (r) => r.items },
    { key: 'owed', header: 'Owes', render: (r) => <Money amount={r.amount - r.amount_paid} /> },
    {
      key: 'reported',
      header: 'Client says',
      render: (r) =>
        r.client_reported_method ? (
          <span>
            {r.client_reported_method === 'cash' ? 'Cash' : 'Zelle'} —{' '}
            {r.client_reported_at ? formatReceived(r.client_reported_at) : 'reported'}
            {r.client_claim_status === 'pending' && (
              <span className="ml-1 text-amber-700">(claim pending — see Client claims)</span>
            )}
          </span>
        ) : (
          '—'
        ),
    },
    // The ORDER's state, not the raw payment_status. A declared order reads
    // "Payment pending — Cash"; both of them read "pending" on payment_status alone,
    // which is the distinction staff need to act on (owner, 2026-08-21).
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={orderStatusLabel(r)} tone={statusTone(orderStatusCode(r))} />,
    },
    {
      key: 'actions',
      header: 'Mark paid',
      render: (r) =>
        r.client_claim_status === 'pending' ? (
          // TASK CASHCONFIRM already has a claim open on this order (its own
          // "Client claims" bucket) — confirm it as reported rather than
          // offering a method choice that wouldn't be the one actually used.
          <AsyncButton
            className="btn-secondary"
            pendingLabel="Confirming…"
            onClick={() => markPaid(r, (r.client_reported_method as 'zelle' | 'cash') ?? 'zelle')}
          >
            Confirm claim ({r.client_reported_method ?? 'reported'})
          </AsyncButton>
        ) : (
          <div className="flex gap-2">
            <AsyncButton className="btn-secondary" pendingLabel="Marking…" onClick={() => markPaid(r, 'zelle')}>
              Zelle
            </AsyncButton>
            <AsyncButton className="btn-secondary" pendingLabel="Marking…" onClick={() => markPaid(r, 'cash')}>
              Cash
            </AsyncButton>
            {/* PART PAYMENT (owner, 2026-08-26: "make it operable"). Only shown
                where there is a balance to split — an order settles on the last
                part, so this disappears by itself. */}
            <button type="button" className="btn-ghost text-xs"
              onClick={() => setSplitting(splitting?.id === r.id ? null : r)}>
              Part payment
            </button>
            {splitting?.id === r.id && (
              <PartPaymentPanel order={r}
                onRecord={(m, a) => void markPaid(r, m, a)}
                onCancel={() => setSplitting(null)} />
            )}
          </div>
        ),
    },
  ];

  const paidColumns: Column<OrderRow>[] = [
    { key: 'buyer', header: 'Who', render: (r) => r.buyerName },
    { key: 'items', header: 'For', render: (r) => r.items },
    { key: 'amount', header: 'Paid', render: (r) => <Money amount={r.amount} /> },
    { key: 'method', header: 'Method', render: (r) => r.payment_method ?? '—' },
    { key: 'reference', header: 'Reference', render: (r) => r.payment_reference ?? '—' },
    { key: 'paid_at', header: 'Paid at', render: (r) => (r.paid_at ? formatReceived(r.paid_at) : '—') },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <p className="eyebrow mb-2">Ops · Payments</p>
        <h1 className="heading-section text-green-800">Payment review</h1>
        <p className="mt-1 text-sm text-green-800/70">
          {bucket === 'orders'
            ? 'Who owes money and who has paid. Automatic Zelle matches land here already reconciled — this is where staff settle everything else (zelle or cash), with the same provable trail.'
            : bucket === 'claims'
              ? "A buyer's own word that they paid, by Zelle or cash. Unlike an auto-matched notification these have no automatic settlement path, so staff confirm or decline them right here."
              : 'Zelle notifications the server could not auto-match. Automatic confirmation happens server-side — this queue is for context and triage only.'}
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

      {bucket === 'orders' ? (
        <div className="space-y-8">
          <section>
            <h2 className="form-label mb-2">Outstanding — who owes money</h2>
            {/* ⚠️ TASK-BACKDATE R6 — the date is stated BEFORE the act, once for
                the table, so a run of backfilled settlements cannot silently
                land on today. */}
            <div className="mb-3 border border-green-800/15 bg-cream-100/40 p-3">
              <RecordedDateField value={paidOn} onChange={setPaidOn} kind="payment" />
            </div>
            {outstandingLoad.isError ? (
              <p role="alert" className="form-error text-sm">
                {outstandingLoad.error?.message ?? 'Could not load outstanding orders.'}
              </p>
            ) : (
              <DataTable
                columns={outstandingColumns}
                rows={outstanding}
                rowKey={(r) => r.id}
                loading={outstandingLoad.isPending && outstanding.length === 0}
                emptyTitle="Nobody owes anything"
                emptyMessage="No orders are awaiting payment."
              />
            )}
          </section>
          <section>
            <h2 className="form-label mb-2">Recently paid</h2>
            {paidLoad.isError ? (
              <p role="alert" className="form-error text-sm">
                {paidLoad.error?.message ?? 'Could not load paid orders.'}
              </p>
            ) : (
              <DataTable
                columns={paidColumns}
                rows={paid}
                rowKey={(r) => r.id}
                loading={paidLoad.isPending && paid.length === 0}
                emptyTitle="No payments yet"
                emptyMessage="Nothing has been marked paid yet."
              />
            )}
          </section>
        </div>
      ) : bucket === 'claims' ? (
        <ClaimsQueue toast={toast} />
      ) : (
        <>
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
                    {selected.parsed_sender ?? 'Unknown sender'} ·{' '}
                    <Money amount={selected.parsed_amount} />
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
        </>
      )}
    </div>
  );
}

/**
 * CASHCONFIRM — client-reported claims (either zelle or cash), a bucket alongside
 * the notification queue above, not a replacement for it. Self-contained: fetches
 * its own rows for a claim-status sub-bucket (pending/confirmed/declined),
 * confirms through confirm_payment_claim (→ mark_purchase_paid, the same spine a
 * matched Zelle payment settles through), or declines with a required reason.
 * `toast` is shared with the parent page so both queues render through one
 * toast strip.
 */
const CLAIM_BUCKETS: { key: ClaimStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'declined', label: 'Declined' },
];

function formatClaimed(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function ClaimsQueue({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [claimBucket, setClaimBucket] = useState<ClaimStatus>('pending');
  const [claims, setClaims] = useState<PaymentClaim[]>([]);
  const [selected, setSelected] = useState<PaymentClaim | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const load = useAsync(listPaymentClaims);

  const refresh = useCallback(
    async (status: ClaimStatus) => {
      const data = await load.run(status);
      setClaims(data);
    },
    [load],
  );

  useEffect(() => {
    setSelected(null);
    setShowDecline(false);
    setDeclineReason('');
    refresh(claimBucket).catch(() => {
      /* surfaced via load.isError */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimBucket]);

  const confirm = async (row: PaymentClaim) => {
    try {
      await confirmPaymentClaim(row.id);
      toast.success(
        `Marked paid — ${row.client_reported_method === 'cash' ? 'cash' : 'Zelle'}.`,
      );
      setSelected(null);
      await refresh(claimBucket);
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not confirm the payment.'));
    }
  };

  const decline = async (row: PaymentClaim) => {
    const reason = declineReason.trim();
    if (!reason) return;
    try {
      await declinePaymentClaim(row.id, reason);
      toast.success('Claim declined.');
      setSelected(null);
      setShowDecline(false);
      setDeclineReason('');
      await refresh(claimBucket);
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not decline the claim.'));
    }
  };

  const columns: Column<PaymentClaim>[] = [
    { key: 'claimed', header: 'Claimed', render: (r) => formatClaimed(r.client_reported_at) },
    { key: 'buyer', header: 'Buyer', render: (r) => r.buyer_name ?? '—' },
    { key: 'order', header: 'Order', render: (r) => r.display_code ?? '—' },
    { key: 'amount', header: 'Amount', render: (r) => <Money amount={r.amount} /> },
    {
      key: 'method',
      header: 'Method',
      render: (r) => (r.client_reported_method === 'cash' ? 'Cash' : 'Zelle'),
    },
    { key: 'reference', header: 'Reference', render: (r) => r.client_reported_reference ?? '—' },
  ];
  if (claimBucket === 'declined') {
    columns.push({
      key: 'reason',
      header: 'Reason',
      render: (r) => r.client_claim_decline_reason ?? '—',
    });
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Claim buckets" className="flex gap-2">
        {CLAIM_BUCKETS.map((b) => (
          <button
            key={b.key}
            type="button"
            aria-pressed={claimBucket === b.key}
            className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${
              claimBucket === b.key
                ? 'border-green-800 bg-green-800 text-white'
                : 'border-green-800/20 bg-white text-green-900 hover:border-green-800/40'
            }`}
            onClick={() => setClaimBucket(b.key)}
          >
            {b.label}
          </button>
        ))}
      </nav>

      {load.isError ? (
        <p role="alert" className="form-error text-sm">
          {load.error?.message ?? 'Could not load payment claims.'}
        </p>
      ) : (
        <DataTable
          columns={columns}
          rows={claims}
          rowKey={(r) => r.id}
          loading={load.isPending && claims.length === 0}
          onRowClick={claimBucket === 'pending' ? (row) => setSelected(row) : undefined}
          emptyTitle="Queue is clear"
          emptyMessage={
            claimBucket === 'pending'
              ? 'No client-reported claims waiting on staff.'
              : 'Nothing here yet.'
          }
        />
      )}

      {selected && (
        <section
          aria-label="Confirm or decline claim"
          data-testid="claim-panel"
          className="rounded border border-green-800/15 bg-white p-5 space-y-4"
        >
          <div>
            <h2 className="font-serif text-lg text-green-900">
              {selected.buyer_name ?? 'Unknown buyer'} · <Money amount={selected.amount} />
            </h2>
            <p className="text-sm text-green-800/70">
              Says they paid by {selected.client_reported_method === 'cash' ? 'cash' : 'Zelle'}
              {selected.client_reported_reference
                ? ` · ref ${selected.client_reported_reference}`
                : ''}
              {' · claimed '}
              {formatClaimed(selected.client_reported_at)}
            </p>
            <p className="mt-2 text-xs text-green-800/60">
              This is a claim, not a confirmed payment — the buyer said this; staff have not
              verified it yet.
            </p>
          </div>

          {!showDecline ? (
            <div className="flex gap-2">
              <AsyncButton
                className="btn-primary"
                pendingLabel="Confirming…"
                onClick={() => confirm(selected)}
              >
                Confirm payment
              </AsyncButton>
              <button type="button" className="btn-secondary" onClick={() => setShowDecline(true)}>
                Decline
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="form-label" htmlFor="decline-reason">
                Why is this claim being declined?
              </label>
              <textarea
                id="decline-reason"
                className="form-input"
                rows={2}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
              />
              <div className="flex gap-2">
                <AsyncButton
                  className="btn-primary"
                  pendingLabel="Declining…"
                  disabled={!declineReason.trim()}
                  onClick={() => decline(selected)}
                >
                  Confirm decline
                </AsyncButton>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowDecline(false);
                    setDeclineReason('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default PaymentReviewPage;
