import { useEffect, useState } from 'react';
import { Copy, Check, Smartphone, Banknote } from 'lucide-react';
import QRCode from 'qrcode';
import { markAwaitingPayment, configValue, reportMyPayment } from '../../lib/api';
import { toErrorMessage } from '../../lib/ops/errors';
import { BRAND } from '../../lib/brand';
import type { Order, OrderItem, Payment } from '../../lib/types';

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

/* CARD AND STRIPE ARE GONE FROM THIS SCREEN (owner, 2026-08-26): "make sure
   stripe or credit card is not a payment option on any surface or mentioned on
   any histry surface."
   They had been behind a STRIPE_ENABLED = false flag since the account was never
   set up — hidden, but still one boolean away from appearing, and still shaping
   this file's state, copy and fee arithmetic. There are TWO methods (CR-76):
   Zelle and cash. */

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
      setError(toErrorMessage(e, 'Could not record that. Please try again.'));
    } finally {
      setBusy(null);
    }
  }

  if (reportedAt) {
    return (
      <div className="mt-5 pt-5 border-t border-green-800/10">
        {/* D23 — BOTH HALVES, IN ONE BOX. The client is unblocked (their entitlement
            exists the moment they declare, so this says so, plainly and with the
            link), AND staff know a claim is waiting (the same act filed it in the
            payments review queue). Neither sentence is a promise the code does not
            keep any more: declaring is what opens the order. */}
        <p className="text-sm font-sans text-green-800 bg-green-50 border border-green-200 p-4">
          {reportedMethod === 'cash'
            ? 'Thanks — we’ve noted that you’re paying cash. We’ll settle it with you at the ranch.'
            : 'Thanks — we’ve noted that you sent the payment. We’ll confirm it as soon as it lands on our side.'}
          {' '}
          <span className="block mt-2 text-green-900">
            Nothing is waiting on that. Your sessions are yours now — pick your times on the{' '}
            <a href="/app/calendar" className="underline">Calendar</a> whenever you like.
          </span>
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
  /* ⚠️ NOT `order.payment_method` — that column carries 'cash' the moment the
     buyer declares it (report_my_payment writes the method they said they'd use),
     and every panel below sat behind `method === 'zelle'`. So declaring cash
     emptied this entire card: no confirmation, no way back, nothing but a heading.
     With card gone there is one mode left and it is a constant, kept named rather
     than inlined so the panels below still read as "the Zelle panels". */
  const method = 'zelle' as const;
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

  async function chooseZelle() {
    setWorking(true);
    try {
      await markAwaitingPayment(order.id, 'zelle');
      onChange();
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
  //  BUYANDBOOK §3 — a CASH declaration now opens the order through the same
  //  `finalize_purchase_payment` the Zelle button calls, so a cash order has a
  //  payment_reference too. Quoting Zelle instructions at someone who told us they
  //  are paying cash would be the same "wasn't listening" failure in reverse.
  const declaredCash = order.client_reported_method === 'cash';
  const showingZelleInstructions =
    !!order.payment_reference && !declaredCash && method === 'zelle';
  const reference = order.payment_reference ?? '';

  return (
    <div className="bg-white border border-green-800/10 p-8 mb-8">
      <h2 className="font-serif font-medium text-green-800 text-xl mb-2">Payment</h2>
      <p className="body-text text-sm mb-6">
        We accept Zelle &mdash; instant, no fees, straight from your bank app &mdash; or cash at the barn.
      </p>

      {payment?.status === 'review' && (
        <div className="bg-gold-50 border border-gold-200 p-4 mb-6 text-sm font-sans text-secondary">
          We’ve received a payment that needs a quick manual check. We’ll confirm shortly — no action needed.
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
          ) : declaredCash ? null : (
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

    </div>
  );
}
