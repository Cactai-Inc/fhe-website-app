import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CreditCard, UserRoundCheck } from 'lucide-react';
import {
  listMyOrders, updatePurchasePaymentMethod, transferPaymentResponsibility,
  payerCandidates, type PayerCandidate,
} from '../../lib/api';
import type { Order } from '../../lib/types';
import { toErrorMessage } from '../../lib/ops/errors';

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
            return (
            <div key={o.id} ref={isWanted ? wantedRef : undefined}
              className={`bg-white border p-5 ${isWanted
                ? 'border-gold-400 ring-1 ring-gold-400/40'
                : 'border-green-800/10'}`}>
              <Link to={`/order/${o.id}`}
                className="flex items-center justify-between hover:opacity-90 focus-ring">
                <div>
                  <p className="text-sm font-sans font-medium text-green-900">
                    {o.display_code ?? 'Order'} · {new Date(o.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {STATUS_LABEL[o.status] ?? o.status}
                    {o.payment_method ? ` · ${o.payment_method}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-serif text-green-800">{usd(o.amount)}</span>
                  <ArrowRight size={16} className="text-green-800/40" aria-hidden="true" />
                </div>
              </Link>
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
    <div className="fixed inset-0 z-[80] bg-green-950/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-xl text-green-900 mb-4">Manage payment</h2>

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

        {err && <p role="alert" className="text-sm text-red-700 mt-3">{err}</p>}
        <button type="button" onClick={onClose} className="w-full mt-4 py-2 text-sm text-muted hover:text-green-800">Close</button>
      </div>
    </div>
  );
}
