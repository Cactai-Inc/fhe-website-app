import { useState } from 'react';
import { Landmark, CreditCard } from 'lucide-react';
import { markAwaitingPayment } from '../../lib/api';
import { startStripeCheckout } from '../../lib/payments';
import { BRAND } from '../../lib/brand';
import type { Order, OrderItem, Payment, PaymentMethod } from '../../lib/types';

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

// Stripe card convenience fee (disclosed). Confirm CA surcharge compliance before enabling — see SETUP.md.
const STRIPE_FEE_RATE = 0.03;

export default function OrderPayment({
  order,
  payment,
  onChange,
}: {
  order: Order & { items: OrderItem[] };
  payment: Payment | null;
  onChange: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>(order.payment_method ?? 'zelle');
  const [working, setWorking] = useState(false);

  // The unique-cents amount is assigned server-side when the order moves to
  // awaiting_payment. Until then we show the plain total for orientation.
  const zelleAmount = order.unique_amount ?? order.total;
  const reference = order.payment_reference ?? '— assigned when you continue —';
  const cardTotal = order.total * (1 + STRIPE_FEE_RATE);

  async function chooseZelle() {
    setWorking(true);
    try {
      await markAwaitingPayment(order.id, 'zelle');
      onChange();
    } finally {
      setWorking(false);
    }
  }

  async function chooseStripe() {
    setWorking(true);
    try {
      await markAwaitingPayment(order.id, 'stripe');
      // Hands off to the Stripe Checkout session created by the serverless function.
      await startStripeCheckout(order.id);
    } finally {
      setWorking(false);
    }
  }

  // If already awaiting payment via Zelle, show the instructions.
  const showingZelleInstructions = order.status === 'awaiting_payment' && method === 'zelle';

  return (
    <div className="bg-white border border-green-800/10 p-8 mb-8">
      <h2 className="font-serif font-medium text-green-800 text-xl mb-2">Payment</h2>
      <p className="body-text text-sm mb-6">
        Zelle is instant and our preferred method. A card option is available with a small disclosed fee.
      </p>

      {payment?.status === 'review' && (
        <div className="bg-gold-50 border border-gold-200 p-4 mb-6 text-sm font-sans text-secondary">
          We’ve received a payment that needs a quick manual check. We’ll confirm shortly — no action needed.
        </div>
      )}

      {/* Method toggle */}
      <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-3 mb-6">
        {([
          { value: 'zelle' as const, label: 'Zelle', icon: Landmark, sub: 'Instant · preferred' },
          { value: 'stripe' as const, label: 'Card', icon: CreditCard, sub: `+${Math.round(STRIPE_FEE_RATE * 100)}% fee` },
        ]).map((opt) => {
          const selected = method === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMethod(opt.value)}
              disabled={order.status === 'awaiting_payment'}
              className={`p-4 border text-left transition-all duration-200 focus-ring disabled:opacity-60 ${
                selected ? 'border-green-800 bg-green-800/5' : 'border-green-800/15 hover:border-green-800/40'
              }`}
            >
              <Icon size={18} className="text-green-800 mb-2" aria-hidden="true" />
              <p className="text-sm font-sans font-medium text-green-900">{opt.label}</p>
              <p className="text-xs font-sans text-muted">{opt.sub}</p>
            </button>
          );
        })}
      </div>

      {method === 'zelle' && (
        <div>
          {showingZelleInstructions ? (
            <div className="bg-cream/60 border border-green-800/10 p-5">
              <p className="text-sm font-sans text-secondary mb-4">
                Open your bank app, send a Zelle payment, and include the reference code in the memo:
              </p>
              <dl className="space-y-3 text-sm font-sans">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Send to</dt>
                  <dd className="text-green-900 font-medium text-right">{BRAND.email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Amount</dt>
                  <dd className="text-green-900 font-medium">{usd(zelleAmount)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Memo / reference</dt>
                  <dd className="text-green-900 font-medium font-mono">{reference}</dd>
                </div>
              </dl>
              <p className="text-xs font-sans text-muted mt-4 leading-relaxed">
                Please send the exact amount shown — the cents help us match your payment
                automatically. We’ll confirm as soon as it lands, usually within the hour.
              </p>
            </div>
          ) : (
            <button type="button" onClick={chooseZelle} disabled={working} className="btn-primary w-full justify-center">
              {working ? 'Preparing…' : 'Pay with Zelle'}
            </button>
          )}
        </div>
      )}

      {method === 'stripe' && order.status !== 'awaiting_payment' && (
        <div>
          <p className="text-sm font-sans text-muted mb-4">
            Card total with fee: <span className="text-green-900 font-medium">{usd(cardTotal)}</span>
          </p>
          <button type="button" onClick={chooseStripe} disabled={working} className="btn-primary w-full justify-center">
            {working ? 'Redirecting…' : 'Pay by Card'}
          </button>
        </div>
      )}
    </div>
  );
}
