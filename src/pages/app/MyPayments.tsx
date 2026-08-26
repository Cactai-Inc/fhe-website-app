import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, ArrowUpRight } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import {
  myPayments, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL,
  type PaymentLedgerEntry,
} from '../../lib/paymentLedger';
import { updatePurchasePaymentMethod } from '../../lib/api';

/**
 * MY PAYMENTS (/app/payments) — CR-76b.
 *
 * A HISTORY LEDGER, not a bill. Every entry the payment screen ever produced,
 * paid ones included, each with its own number and its own trail of changes.
 *
 * ⚠️ THE ROW IS THE RECORD AND IT EXPANDS IN PLACE (CR-74 / CR-75). The header
 * is the toggle — "right now clicking the header of the card opens and closes and
 * its obvious, easy, and works well" — and there is no separate close button;
 * he proposed one and withdrew it.
 *
 * ⚠️ AWAITING PAYMENT IS NOT AN ENTRY. Until someone picks a method there is
 * nothing to number: "until they make a selection its awaiting payment." Those
 * orders live on My Orders, which is where the choice is made.
 */
const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const when = (s: string | null) => (s
  ? new Date(s).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  : null);

const STATUS_CHIP: Record<string, string> = {
  pending: 'bg-gold-100 text-green-900 border-gold-400/50',
  paid: 'bg-green-800/10 text-green-800 border-green-800/20',
  declined: 'bg-red-50 text-red-800 border-red-200',
  cancelled: 'bg-cream-100 text-muted border-green-800/10',
};

export default function MyPayments() {
  useDocumentTitle('My Payments');
  const [rows, setRows] = useState<PaymentLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const reload = () => myPayments().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    let active = true;
    myPayments().then((r) => active && setRows(r)).catch(() => active && setRows([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">Payments</p>
      <h1 className="heading-section text-green-800 mb-2">Every payment, and what happened to it.</h1>
      <p className="body-text text-sm text-muted mb-8">
        Each entry has its own number. While a payment is pending you can still change
        how you're paying it.
      </p>

      {loading ? (
        <p className="body-text text-muted">Loading&hellip;</p>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-green-800/10 rounded-xl p-8 text-center">
          <p className="body-text text-sm text-muted">
            No payments yet. When you choose how to pay an order, it appears here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((p) => (
            <PaymentRow key={p.payment_id} p={p}
              open={open === p.payment_id}
              onToggle={() => setOpen((k) => (k === p.payment_id ? null : p.payment_id))}
              onChanged={() => void reload()} />
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentRow({ p, open, onToggle, onChanged }: {
  p: PaymentLedgerEntry; open: boolean; onToggle: () => void; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const Chevron = open ? ChevronDown : ChevronRight;

  /* Only the METHOD, and only while pending (CR-76). Not the amount, not who
     pays — those are the barn's to change, and the order's own control does it. */
  async function switchTo(method: 'zelle' | 'cash') {
    setBusy(true); setErr(null);
    try {
      await updatePurchasePaymentMethod(p.order_id, method);
      onChanged();
    } catch (e) {
      setErr(e && typeof e === 'object' && 'message' in e
        ? String((e as { message?: unknown }).message) : 'That did not save.');
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-white border border-green-800/10">
      {/* THE HEADER IS THE TOGGLE — no separate close control (CR-75). */}
      <button type="button" onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 p-5 text-left focus-ring hover:bg-cream-100/40">
        <div className="min-w-0">
          <p className="text-sm font-sans font-medium text-green-900 truncate">
            {p.payment_number ?? 'Payment'} · {p.what}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {PAYMENT_METHOD_LABEL[p.method] ?? p.method} · {when(p.declared_at)}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-[0.68rem] px-2 py-0.5 rounded-full border ${STATUS_CHIP[p.status] ?? ''}`}>
            {PAYMENT_STATUS_LABEL[p.status] ?? p.status}
          </span>
          <span className="text-sm font-serif text-green-800">{usd(p.amount)}</span>
          <Chevron size={16} className="text-green-800/40" aria-hidden="true" />
        </div>
      </button>

      {open && (
        <div className="border-t border-green-800/10 p-5 pt-4 flex flex-col gap-4">
          {/* WHAT IT IS ASSOCIATED WITH, and the way back to it. */}
          <div>
            <p className="eyebrow mb-1">Order</p>
            <Link to={`/app/orders?order=${encodeURIComponent(p.order_number ?? '')}`}
              className="inline-flex items-center gap-1.5 text-sm text-green-800 hover:text-green-700 focus-ring">
              {p.order_number ?? 'View the order'}
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
            {p.order_total != null && (
              <p className="text-xs text-muted mt-1">Order total {usd(p.order_total)}</p>
            )}
          </div>

          {/* THE TIMESTAMPS HE LISTED. Absent ones are shown as absent rather
              than hidden — "not yet" is information. */}
          <div>
            <p className="eyebrow mb-1.5">Timeline</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <Fact label="Order submitted" value={when(p.submitted_at)} />
              <Fact label="Order approved" value={when(p.approved_at)} />
              <Fact label="Payment submitted" value={when(p.declared_at)} />
              <Fact label="Marked paid" value={when(p.marked_paid_at ?? p.confirmed_at)} />
              {p.reference && <Fact label="Reference" value={p.reference} />}
              {p.decline_reason && <Fact label="Issue" value={p.decline_reason} />}
            </dl>
          </div>

          {/* ALL THE CHANGES MADE, IF ANY EXIST. */}
          {p.history.length > 0 && (
            <div>
              <p className="eyebrow mb-1.5">History</p>
              <ul className="flex flex-col gap-1.5">
                {p.history.map((h, i) => (
                  <li key={`${h.at}-${i}`} className="text-xs text-green-900/80">
                    <span className="text-muted">{when(h.at)}</span> — {h.label}
                    {h.detail ? <span className="text-muted"> · {h.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.can_change_method && (
            <div>
              <p className="eyebrow mb-1.5">Change how you're paying</p>
              <div className="flex items-center gap-2">
                {(['zelle', 'cash'] as const).map((m) => (
                  <button key={m} type="button" disabled={busy || m === p.method}
                    onClick={() => void switchTo(m)}
                    className={`text-xs px-3 py-1.5 rounded-lg border focus-ring ${
                      m === p.method
                        ? 'border-green-800/40 bg-green-800/10 text-green-900'
                        : 'border-green-800/15 text-green-800 hover:border-green-800/30'}`}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </button>
                ))}
              </div>
              {err && <p className="text-xs text-red-700 mt-2">{err}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-green-900">{value ?? <span className="text-muted">Not yet</span>}</dd>
    </>
  );
}
