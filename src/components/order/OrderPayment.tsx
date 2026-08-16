import { useEffect, useState } from 'react';
import { Landmark, CreditCard, Copy, Check, Smartphone, Banknote } from 'lucide-react';
import QRCode from 'qrcode';
import { markAwaitingPayment, configValue, reportMyPayment } from '../../lib/api';
import { startStripeCheckout } from '../../lib/payments';
import { BRAND } from '../../lib/brand';
import type { Order, OrderItem, Payment, PaymentMethod } from '../../lib/types';

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

/** One Zelle instruction line with a tap-to-copy affordance (bank-app friendly). */
function CopyRow({ label, display, copyValue }: { label: string; display: string; copyValue: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the value is still displayed */
    }
  }
  return (
    <div className="flex justify-between items-center gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-green-900 font-medium text-right flex items-center gap-2">
        <span className={label === 'Memo / reference' ? 'font-mono' : undefined}>{display}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
          className="p-1 text-green-800/60 hover:text-green-800 focus-ring"
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        </button>
      </dd>
    </div>
  );
}

// Card payments stay HIDDEN until Stripe is configured (owner directive).
// Flip to true after the Stripe account + webhook are live — see SETUP.md.
const STRIPE_ENABLED = false;
const STRIPE_FEE_RATE = 0.03;

/**
 * ONBOARD §6 — "I've sent it" and "I'll pay cash".
 *
 * Zelle has no callback, so between the buyer sending money and the bank email
 * arriving there is a gap where the only thing that exists is the buyer's word.
 * This captures that word, with an OPTIONAL confirmation number (owner: "if they
 * leave it blank thats ok"), and hands it to staff to reconcile.
 *
 * It is worded as a claim everywhere it appears — here, in the staff notification,
 * and on the order's status trail — because report_my_payment deliberately does
 * not touch payment_status. A member cannot settle their own order.
 */
function ReportPaymentPanel({
  orderId,
  reportedMethod,
  reportedAt,
  onChange,
}: {
  orderId: string;
  reportedMethod: string | null;
  reportedAt: string | null;
  onChange: () => void;
}) {
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState<'zelle' | 'cash' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function report(method: 'zelle' | 'cash') {
    setBusy(method);
    setError(null);
    try {
      await reportMyPayment(orderId, method, method === 'zelle' ? reference : null);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record that. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  if (reportedAt) {
    return (
      <div className="mt-5 pt-5 border-t border-green-800/10">
        <p className="text-sm font-sans text-green-800 bg-green-50 border border-green-200 p-4">
          {reportedMethod === 'cash'
            ? 'Thanks — we’ve noted that you’re paying cash. We’ll settle it with you at the ranch.'
            : 'Thanks — we’ve noted that you sent the payment. We’ll confirm it as soon as it lands on our side.'}
        </p>
        <button
          type="button"
          onClick={() => void report(reportedMethod === 'cash' ? 'zelle' : 'cash')}
          disabled={busy !== null}
          className="mt-3 text-xs font-sans text-muted underline hover:text-green-800 focus-ring"
        >
          {reportedMethod === 'cash' ? 'Actually, I sent it by Zelle' : 'Actually, I’ll pay cash'}
        </button>
        {error && <p className="form-error mt-2" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-5 pt-5 border-t border-green-800/10">
      <p className="text-sm font-sans font-medium text-green-900 mb-1">Already sent it?</p>
      <p className="text-xs font-sans text-muted mb-3 leading-relaxed">
        Let us know and we’ll watch for it. A confirmation number helps us match it faster,
        but you can leave it blank.
      </p>
      <label className="form-label" htmlFor="payment-confirmation">
        Confirmation number (optional)
      </label>
      <input
        id="payment-confirmation"
        className="form-input mb-3"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        autoComplete="off"
      />
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => void report('zelle')}
          disabled={busy !== null}
          className="btn-primary flex-1 justify-center"
        >
          {busy === 'zelle' ? 'Recording…' : 'I’ve sent the payment'}
        </button>
        <button
          type="button"
          onClick={() => void report('cash')}
          disabled={busy !== null}
          className="btn-secondary flex-1 justify-center inline-flex items-center gap-2"
        >
          <Banknote size={15} aria-hidden="true" />
          {busy === 'cash' ? 'Recording…' : 'I’m paying cash'}
        </button>
      </div>
      {error && <p className="form-error mt-2" role="alert">{error}</p>}
    </div>
  );
}

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
  // Zelle's only sanctioned "one tap": the bank-issued receive QR. Its embedded
  // link preselects US as recipient — scannable on desktop, tappable on mobile.
  const [zelleQrUrl, setZelleQrUrl] = useState<string | null>(null);
  const [qrPng, setQrPng] = useState<string | null>(null);
  useEffect(() => {
    configValue('BRAND', 'ZELLE_QR_URL')
      .then((v) => setZelleQrUrl(v && /^https?:\/\//.test(v) ? v : null))
      .catch(() => setZelleQrUrl(null));
  }, []);
  useEffect(() => {
    if (!zelleQrUrl) { setQrPng(null); return; }
    QRCode.toDataURL(zelleQrUrl, { margin: 1, width: 240, color: { dark: '#0d2118' } })
      .then(setQrPng)
      .catch(() => setQrPng(null));
  }, [zelleQrUrl]);

  // The unique-cents amount is assigned server-side when the order moves to
  // awaiting_payment. Until then we show the plain total for orientation.
  const zelleAmount = order.unique_amount ?? order.amount;
  const cardTotal = order.amount * (1 + STRIPE_FEE_RATE);

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

  // The instructions are only instructions once there is a memo to quote. Keying
  // this on `status === 'awaiting_payment'` (as it did until PAYLOCK) locked out
  // every staff-provisioned order: provisioning creates the purchase ALREADY at
  // awaiting_payment, so this branch rendered on first load — with a memo of
  // "assigned when you continue" and the only control that assigns it, the
  // Pay-with-Zelle button below, living in the branch the order could no longer
  // reach. Keying on the reference itself makes both origins converge on the same
  // path: no memo -> the button, which calls finalize_purchase_payment and
  // generates one; memo -> the instructions that quote it.
  const showingZelleInstructions = !!order.payment_reference && method === 'zelle';
  const reference = order.payment_reference ?? '';

  return (
    <div className="bg-white border border-green-800/10 p-8 mb-8">
      <h2 className="font-serif font-medium text-green-800 text-xl mb-2">Payment</h2>
      <p className="body-text text-sm mb-6">
        {STRIPE_ENABLED
          ? 'Zelle is instant and our preferred method. A card option is available with a small disclosed fee.'
          : 'We accept Zelle — instant, no fees, straight from your bank app.'}
      </p>

      {payment?.status === 'review' && (
        <div className="bg-gold-50 border border-gold-200 p-4 mb-6 text-sm font-sans text-secondary">
          We’ve received a payment that needs a quick manual check. We’ll confirm shortly — no action needed.
        </div>
      )}

      {/* Method toggle (card appears once Stripe is configured) */}
      {STRIPE_ENABLED && (
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
              /* Locked once the keys are assigned, not once the status says
                 awaiting_payment — see showingZelleInstructions below. */
              disabled={!!order.payment_reference}
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
      )}

      {method === 'zelle' && (
        <div>
          {showingZelleInstructions ? (
            <div className="bg-cream/60 border border-green-800/10 p-5">
              <p className="text-sm font-sans text-secondary mb-4">
                Open your bank app, send a Zelle payment, and include the reference code in the memo:
              </p>
              <dl className="space-y-3 text-sm font-sans">
                <CopyRow label="Send to" display={BRAND.email} copyValue={BRAND.email} />
                <CopyRow label="Amount" display={usd(zelleAmount)} copyValue={zelleAmount.toFixed(2)} />
                <CopyRow label="Memo / reference" display={reference} copyValue={order.payment_reference ?? ''} />
              </dl>
              {zelleQrUrl && (
                <div className="mt-5 pt-5 border-t border-green-800/10 flex flex-col sm:flex-row items-center gap-4">
                  {qrPng && (
                    <img src={qrPng} alt="Zelle QR code — scan with your bank app"
                      className="w-36 h-36 rounded-lg border border-green-800/10 bg-white p-1.5" />
                  )}
                  <div className="text-center sm:text-left">
                    <p className="text-sm font-sans text-green-900 font-medium mb-1">Skip the typing</p>
                    <p className="text-xs font-sans text-muted leading-relaxed mb-3">
                      Scan with your bank app's QR scanner — we're preselected as the
                      recipient. On your phone, just tap:
                    </p>
                    <a href={zelleQrUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring">
                      <Smartphone size={15} /> Open in your banking app
                    </a>
                  </div>
                </div>
              )}
              <p className="text-xs font-sans text-muted mt-4 leading-relaxed">
                Include the reference code in the memo so we can match your payment.
                We’ll confirm as soon as it lands, usually within the hour.
              </p>
            </div>
          ) : (
            <button type="button" onClick={chooseZelle} disabled={working} className="btn-primary w-full justify-center">
              {working ? 'Preparing…' : 'Pay with Zelle'}
            </button>
          )}

          {/* ONBOARD §6. Rendered whether or not the Zelle memo has been issued:
              the cash button must be reachable from the payment page itself
              ("they need to be able to have an option on the payment page"), and
              somebody who pays from their bank without pressing our button still
              needs a way to tell us. */}
          <ReportPaymentPanel
            orderId={order.id}
            reportedMethod={order.client_reported_method}
            reportedAt={order.client_reported_at}
            onChange={onChange}
          />
        </div>
      )}

      {STRIPE_ENABLED && method === 'stripe' && !order.payment_reference && (
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
