import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CreditCard, UserRoundCheck } from 'lucide-react';
import {
  listMyOrders, updatePurchasePaymentMethod, transferPaymentResponsibility,
  payerCandidates, type PayerCandidate,
} from '../../lib/api';
import type { Order } from '../../lib/types';

/**
 * MY ORDERS — the shared subject content (TASK-ACCOUNTSURFACE §1/§3), rendered
 * by both /app/orders and the Account page's inline panel. Moved out of
 * Orders.tsx unchanged.
 */

const PAYMENT_METHODS = ['Zelle', 'Check', 'Cash', 'Card'];

const STATUS_LABEL: Record<string, string> = {
  draft: 'In progress', awaiting_payment: 'Awaiting payment', paid: 'Paid',
  confirmed: 'Confirmed', cancelled: 'Cancelled', expired: 'Expired',
};
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export function OrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [managing, setManaging] = useState<Order | null>(null);
  const reload = () => listMyOrders().then(setOrders).catch(() => setOrders([]));

  useEffect(() => {
    let active = true;
    listMyOrders().then((o) => active && setOrders(o)).catch(() => active && setOrders([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

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
          {orders.map((o) => (
            <div key={o.id} className="bg-white border border-green-800/10 p-5">
              <Link to={`/order/${o.id}`}
                className="flex items-center justify-between hover:opacity-90 focus-ring">
                <div>
                  <p className="text-sm font-sans font-medium text-green-900">
                    Order · {new Date(o.created_at).toLocaleDateString()}
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
          ))}
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
  const [method, setMethod] = useState(order.payment_method ?? 'Zelle');
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
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not update the payment method.'); }
    finally { setBusy(false); }
  }
  async function handOff() {
    if (!payer) return;
    setBusy(true); setErr(null);
    try { await transferPaymentResponsibility(order.id, payer); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not transfer responsibility.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-green-950/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-xl text-green-900 mb-4">Manage payment</h2>

        <label className="block text-xs text-muted mb-1" htmlFor="pay-method">Payment method</label>
        <div className="flex gap-2 mb-4">
          <select id="pay-method" className="form-input flex-1" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
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
