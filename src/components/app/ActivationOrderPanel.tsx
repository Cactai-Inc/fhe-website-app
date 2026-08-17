/**
 * THE ORDER SCREEN INSIDE ACTIVATION — CAREPATH §C9.
 *
 * Owner: *"they see their order information page with the booking information
 * if we added it to the calendar and they click continue or they click a button
 * that says 'notify staff this isnt correct' and it notifies us, either way
 * they are taken to the screen where they add their horse's information."*
 *
 * ⚠️ EITHER BUTTON PROCEEDS. The correction flags staff; it does not block the
 * client, and it does not change the order. The Continue handler runs in both
 * cases — that is the owner's "either way".
 *
 * ⚠️ THE CORRECTION MUST PROVABLY REACH A HUMAN — the same standard §C6 holds
 * the two inquiry emails to. `report_order_incorrect` returns how many staff it
 * notified and writes a `client_flagged` event on the order's own timeline; this
 * screen reports THAT number. Reaching nobody is reported as reaching nobody,
 * with the phone number, rather than as a cheerful "we've told them".
 *
 * ⚠️ NO BOOKING IS INVENTED. Staff set horse-care times on the call (§C4/§C7),
 * so a client may well activate before anything is on the calendar. An empty
 * booking list says the timing will be confirmed — it never implies a held date.
 */
import { useEffect, useState } from 'react';
import { ArrowRight, AlertTriangle, Check, Calendar } from 'lucide-react';
import { getOrder, listOrderBookings, reportOrderIncorrect, type OrderBooking } from '../../lib/api';
import type { Order, OrderItem } from '../../lib/types';
import { toErrorMessage } from '../../lib/ops/errors';
import { BRAND } from '../../lib/brand';

const money = (n: number | null | undefined): string => {
  if (n == null) return 'Price on inquiry';
  const v = Number(n);
  if (!Number.isFinite(v)) return 'Price on inquiry';
  return `$${v.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2,
  })}`;
};

function whenText(b: OrderBooking): string {
  if (!b.starts_at) return 'Time to be confirmed';
  const d = new Date(b.starts_at);
  if (b.all_day) return d.toLocaleDateString(undefined, { dateStyle: 'full' });
  return d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
}

export interface ActivationOrderPanelProps {
  purchaseId: string;
  /** Runs for BOTH buttons — the correction never blocks the client. */
  onContinue: () => void;
}

export function ActivationOrderPanel({ purchaseId, onContinue }: ActivationOrderPanelProps) {
  const [order, setOrder] = useState<(Order & { items: OrderItem[] }) | null>(null);
  const [bookings, setBookings] = useState<OrderBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [note, setNote] = useState('');
  const [flagging, setFlagging] = useState(false);
  /** null = not attempted; a number = how many humans it actually reached. */
  const [reached, setReached] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getOrder(purchaseId), listOrderBookings(purchaseId).catch(() => [])])
      .then(([o, b]) => { if (active) { setOrder(o); setBookings(b); } })
      .catch((e) => active && setError(toErrorMessage(e, 'Could not load your order.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [purchaseId]);

  async function flag() {
    setFlagging(true);
    try {
      const res = await reportOrderIncorrect(purchaseId, note.trim() || undefined);
      setReached(res.recipients);
    } catch (e) {
      setError(toErrorMessage(e, 'We could not send that just now.'));
      setReached(0);
    } finally {
      setFlagging(false);
    }
  }

  if (loading) return <p className="body-text text-muted text-sm">Loading your order…</p>;

  return (
    <section aria-labelledby="act-order-heading" className="bg-white border border-green-800/10 p-6 sm:p-8">
      <p className="eyebrow mb-1">Your order</p>
      <h2 id="act-order-heading" className="font-serif text-green-800 text-xl mb-1.5">
        Here is what we have for you.
      </h2>
      <p className="body-text text-sm text-muted mb-5">
        Check this over. If anything is wrong, tell us now — you can carry on either way.
      </p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}

      {order ? (
        <>
          <div className="border border-green-800/15 rounded-lg p-4 mb-5">
            <p className="text-sm font-medium text-green-900 mb-2">
              {order.display_code ?? 'Your order'}
            </p>
            <ul className="flex flex-col gap-1.5">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-green-900">{it.label}</span>
                  <span className="text-green-900">{money(it.price_amount)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="form-label mb-2 inline-flex items-center gap-2">
              <Calendar size={14} aria-hidden="true" /> Scheduled
            </h3>
            {bookings.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing is on the calendar yet — we will confirm the timing with you.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {bookings.map((b) => (
                  <li key={b.id} className="text-sm text-green-900">
                    {whenText(b)}
                    {b.location ? ` · ${b.location}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="body-text text-sm text-muted mb-6">
          We could not find an order on your account. Carry on — we will sort it out with you.
        </p>
      )}

      {/* The correction's OUTCOME, reported honestly. */}
      {reached !== null && (
        <div className={`text-sm px-4 py-3 mb-5 border ${
          reached > 0
            ? 'bg-green-50 border-green-200 text-green-900'
            : 'bg-red-50 border-red-200 text-red-800'
        }`} role="status">
          {reached > 0 ? (
            <span className="inline-flex items-start gap-2">
              <Check size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              Thank you — {reached === 1 ? 'someone' : `${reached} of us`} at the barn has been told,
              and it is on your order for us to work through with you.
            </span>
          ) : (
            <span className="inline-flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              We recorded it on your order, but we could not reach anyone just now. Please call us
              on{' '}
              <a href={BRAND.phoneHref} className="underline underline-offset-2">{BRAND.phoneDisplay}</a>
              {' '}so this does not sit.
            </span>
          )}
        </div>
      )}

      {flagOpen && reached === null && (
        <div className="mb-5">
          <label className="form-label" htmlFor="act-order-note">What is wrong?</label>
          <textarea
            id="act-order-note" rows={3} className="form-input resize-none"
            placeholder="Tell us what we got wrong — the services, the horse, the timing…"
            value={note} onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={onContinue}>
          Continue <ArrowRight size={16} />
        </button>
        {reached === null && (
          flagOpen ? (
            <button
              type="button" className="btn-outline-gold" disabled={flagging}
              onClick={() => void flag()}
            >
              {flagging ? 'Sending…' : 'Send this to staff'}
            </button>
          ) : (
            <button type="button" className="btn-outline-gold" onClick={() => setFlagOpen(true)}>
              Notify staff this isn't correct
            </button>
          )
        )}
      </div>
      {reached !== null && (
        <p className="text-xs text-muted mt-3">
          You can carry on — nothing is held up while we look at it.
        </p>
      )}
    </section>
  );
}

export default ActivationOrderPanel;
