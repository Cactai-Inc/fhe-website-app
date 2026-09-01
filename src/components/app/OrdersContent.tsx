import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronRight, CreditCard, UserRoundCheck } from 'lucide-react';
import {
  listMyOrders, updatePurchasePaymentMethod, transferPaymentResponsibility,
  payerCandidates, type PayerCandidate,
} from '../../lib/api';
import type { Order } from '../../lib/types';
import { toErrorMessage } from '../../lib/ops/errors';
import { Modal } from '../ops/kit/Modal';

/**
 * MY ORDERS — the shared subject content (TASK-ACCOUNTSURFACE §1/§3), rendered
 * by both /app/orders and the Account page's inline panel. Moved out of
 * Orders.tsx unchanged.
 */

/* ⚠️ TWO METHODS, AND THE STORED VALUE IS LOWERCASE (owner, 2026-08-25).
   "card is not a valid option, we didnt setup stripe yet and check is not valid
   either[,] i never authorized that option, we cant take a check[,] it takes time to
   clear and we dont want to monitor for that, if they can write a check they can use
   zelle."

   ⚠️ AND THE CASING WAS WRONG. This list wrote 'Zelle' / 'Cash' capitalised while the
   declaration path (report_my_payment) writes 'zelle' / 'cash', which is what every
   row in production holds — so anyone using this dropdown wrote a value nothing
   matching the lowercase form would find. The value is now what is stored; the label
   is what is read. */
const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash', label: 'Cash' },
];

/** Lowercase in the database, capitalised for a person. Two methods only. */
const METHOD_LABEL: Record<string, string> = { zelle: 'Zelle', cash: 'Cash' };

const STATUS_LABEL: Record<string, string> = {
  draft: 'In progress', awaiting_payment: 'Awaiting payment', paid: 'Paid',
  confirmed: 'Confirmed', cancelled: 'Cancelled', expired: 'Expired',
};
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export function OrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  /* CR-76b: an entry on My Payments links here BY ORDER NUMBER — "the link to the
     order should be clickable to open the orders history page and scroll to that
     order number and expand it." The scroll and the highlight are here; EXPANDING
     the row in place is CR-75's rebuild of this list and is not done yet, so the
     row still opens the order's own page. */
  const wanted = new URLSearchParams(window.location.search).get('order');
  const wantedRef = useRef<HTMLDivElement | null>(null);
  /* CR-75: the row IS the record and it opens in place. The header is the toggle
     — no separate close control. Arriving from a payment entry (?order=PUR-…)
     opens that row and scrolls to it, which is the whole of the owner's ask:
     "open the orders history page and scroll to that order number and expand it." */
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (wanted) setOpen(wanted); }, [wanted]);

  const [managing, setManaging] = useState<Order | null>(null);
  const reload = () => listMyOrders().then(setOrders).catch(() => setOrders([]));

  useEffect(() => {
    let active = true;
    listMyOrders().then((o) => active && setOrders(o)).catch(() => active && setOrders([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  /* Runs after the list paints, which is why it keys on `orders` rather than
     firing on mount — the target node does not exist until the rows do. */
  useEffect(() => {
    if (!wanted || !wantedRef.current) return;
    wantedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [wanted, orders]);

  return (
    <div className="mt-2.5 mb-1">
      {loading ? (
        <p className="body-text text-muted">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-green-800/10 rounded-xl p-8 text-center">
          <p className="body-text text-sm text-muted">You haven't made any purchases yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => {
            const isWanted = !!wanted && o.display_code === wanted;
            const isOpen = open === o.display_code;
            return (
            <div key={o.id} ref={isWanted ? wantedRef : undefined}
              className={`bg-white border p-5 ${isWanted
                ? 'border-gold-400 ring-1 ring-gold-400/40'
                : 'border-green-800/10'}`}>
              <button type="button" aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : (o.display_code ?? null))}
                className="w-full flex items-center justify-between gap-3 text-left hover:opacity-90 focus-ring">
                <div className="min-w-0">
                  <p className="text-sm font-sans font-medium text-green-900">
                    {o.display_code ?? 'Order'} · {new Date(o.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {STATUS_LABEL[o.status] ?? o.status}
                    {o.payment_method ? ` · ${METHOD_LABEL[o.payment_method] ?? o.payment_method}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-serif text-green-800">{usd(o.amount)}</span>
                  {isOpen
                    ? <ChevronDown size={16} className="text-green-800/40" aria-hidden="true" />
                    : <ChevronRight size={16} className="text-green-800/40" aria-hidden="true" />}
                </div>
              </button>

              {isOpen && (
                <div className="mt-4 border-t border-green-800/10 pt-4 flex flex-col gap-3">
                  {o.items && o.items.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {o.items.map((it) => (
                        <li key={it.id}
                          className="flex items-center justify-between text-sm text-green-900">
                          <span className="truncate">{it.label ?? 'Item'}</span>
                          <span className="font-serif text-green-800 shrink-0 ml-3">
                            {it.price_amount != null ? usd(it.price_amount) : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                    <dt className="text-muted">Total</dt>
                    <dd className="text-green-900">{usd(o.amount)}</dd>
                    {/* BOOKS1 (R4, the owner's own sentence): on a discounted or
                        comped order the customer sees the FULL price, the
                        reduction, and that they owe $0 — the give-away is
                        visible, never hidden behind a zero-priced line. */}
                    {o.payment_status === 'paid' && o.payment_disposition !== 'paid' && (
                      <>
                        <dt className="text-muted">
                          {o.payment_disposition === 'comped' ? 'Complimentary' : 'Discount'}
                        </dt>
                        <dd className="text-green-900">−{usd(o.write_down_amount)}</dd>
                        <dt className="text-muted">Amount owed</dt>
                        <dd className="text-green-900">$0.00</dd>
                      </>
                    )}
                    <dt className="text-muted">Payment</dt>
                    <dd className="text-green-900">
                      {o.payment_status === 'paid' ? 'Settled'
                        : o.payment_method ? `${METHOD_LABEL[o.payment_method] ?? o.payment_method} — pending`
                          : 'Awaiting payment'}
                    </dd>
                  </dl>
                  <Link to={`/order/${o.id}`}
                    className="inline-flex items-center gap-1.5 text-xs text-green-800 hover:text-green-700 focus-ring">
                    Open the full order <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              )}
              {/* 4d: payment method + responsibility, on unpaid orders only. */}
              {o.payment_status !== 'paid' && (
                <button type="button" onClick={() => setManaging(o)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-green-800 hover:text-green-700 px-2.5 py-1 rounded-lg border border-green-800/15 hover:border-green-800/30 focus-ring">
                  <CreditCard size={13} aria-hidden="true" /> Manage payment
                </button>
              )}
            </div>
            );
          })}
        </div>
      )}

      {managing && (
        <ManagePaymentModal order={managing}
          onClose={() => setManaging(null)}
          onChanged={() => { void reload(); setManaging(null); }} />
      )}
    </div>
  );
}

/** 4d: change how an unpaid order is paid, or hand the balance to another
 *  account holder (e.g. a parent taking over a rider's payment). */
function ManagePaymentModal({ order, onClose, onChanged }: {
  order: Order; onClose: () => void; onChanged: () => void;
}) {
  /* Match case-insensitively so an order already carrying a capitalised value from
     the old list still selects correctly rather than silently reading as Zelle. */
  const [method, setMethod] = useState(
    (order.payment_method ?? '').toLowerCase() === 'cash' ? 'cash' : 'zelle');
  const [people, setPeople] = useState<PayerCandidate[]>([]);
  const [payer, setPayer] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    payerCandidates().then(setPeople).catch(() => setPeople([]));
  }, []);

  async function saveMethod() {
    setBusy(true); setErr(null);
    try { await updatePurchasePaymentMethod(order.id, method); onChanged(); }
    catch (e) { setErr(toErrorMessage(e, 'Could not update the payment method.')); }
    finally { setBusy(false); }
  }
  async function handOff() {
    if (!payer) return;
    setBusy(true); setErr(null);
    try { await transferPaymentResponsibility(order.id, payer); onChanged(); }
    catch (e) { setErr(toErrorMessage(e, 'Could not transfer responsibility.')); }
    finally { setBusy(false); }
  }

  return (
    /* ⚠️ TASK-FIX4 — converged. This dialog holds two selects, so the backdrop no
       longer closes it; `Save` and `Transfer` remain the only writes. */
    <Modal open onClose={onClose} title="Manage payment" size="sm" error={err}>
        <label className="block text-xs text-muted mb-1" htmlFor="pay-method">Payment method</label>
        <div className="flex gap-2 mb-4">
          <select id="pay-method" className="form-input flex-1" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button type="button" className="btn-primary" disabled={busy} onClick={saveMethod}>Save</button>
        </div>

        <label className="block text-xs text-muted mb-1" htmlFor="pay-payer">
          Hand this balance to someone else
        </label>
        <div className="flex gap-2">
          <select id="pay-payer" className="form-input flex-1" value={payer} onChange={(e) => setPayer(e.target.value)}>
            <option value="">Choose an account…</option>
            {people.map((p) => <option key={p.contact_id} value={p.contact_id}>{p.name}</option>)}
          </select>
          <button type="button" className="btn-outline-gold inline-flex items-center gap-1.5"
            disabled={busy || !payer} onClick={handOff}>
            <UserRoundCheck size={14} aria-hidden="true" /> Transfer
          </button>
        </div>

    </Modal>
  );
}
