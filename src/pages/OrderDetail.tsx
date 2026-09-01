import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getOrder, getOrderPayment } from '../lib/api';
import { useDocumentTitle } from '../lib/hooks';
import type { Order, OrderItem, Payment } from '../lib/types';
import { formatPrice } from '../lib/pricing';
import OrderPayment from '../components/order/OrderPayment';
import { fetchMyStandingSlots, type StandingSlot } from '../lib/ops/api-calendar';
import { standingSlotSentence, serviceLabel } from '../lib/standingSlots';
import { orderStatusCopy } from '../lib/orderStatus';

export default function OrderDetail() {
  useDocumentTitle('Your Order');
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<(Order & { items: OrderItem[] }) | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [standing, setStanding] = useState<StandingSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!id) return;
    const [o, p, sl] = await Promise.all([
      getOrder(id),
      getOrderPayment(id).catch(() => null),
      // BUYANDBOOK §4 — a `recurring` line has no count, period or expiry to show,
      // because it is a standing weekly time. Empty for every other kind of order.
      fetchMyStandingSlots(id).catch(() => [] as StandingSlot[]),
    ]);
    setOrder(o);
    setPayment(p);
    setStanding(sl);
  }, [id]);

  useEffect(() => {
    let active = true;
    reload().finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reload]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="body-text text-muted">Loading…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6 pt-24 pb-20">
        <div className="text-center max-w-md">
          <h1 className="heading-section text-green-800 mb-4">We couldn’t find that order</h1>
          <Link to="/account" className="btn-primary">Back to your account</Link>
        </div>
      </div>
    );
  }

  // The order's TRUE status, which is what says "Payment pending — Cash" rather than
  // the generic "Awaiting your payment" a silent order gets.
  const copy = orderStatusCopy(order);
  // The order_documents surface is retired; nothing gates the booking/payment step.
  const allDocsSigned = true;
  const needsPayment = order.status === 'draft' || order.status === 'awaiting_payment';

  return (
    <div className="min-h-screen bg-cream pt-28 pb-20">
      <div className="container-site max-w-3xl">
        <Link to="/account" className="inline-flex items-center gap-2 text-sm font-sans text-secondary hover:text-green-800 transition-colors mb-6 focus-ring">
          <ArrowLeft size={16} />
          Back to your account
        </Link>

        <p className="eyebrow mb-2">Your order</p>
        <h1 className="heading-section text-green-800 mb-2">{copy.title}</h1>
        <p className="body-text mb-10">{copy.body}</p>

        {/* Summary */}
        <div className="bg-white border border-green-800/10 p-8 mb-8">
          <p className="eyebrow mb-5">Summary</p>
          <div className="flex flex-col divide-y divide-green-800/[0.08]">
            {order.items.map((item) => {
              /* D23 — THE ONE THING A WEEKLY BUYER WAS NEVER TOLD. This page showed a
                 recurring line as a price and nothing else: no count, no period, no
                 expiry, no renewal terms. It has none of those, because it is not a
                 bundle — it is a standing weekly time. So the line says which days
                 and times are theirs and that it recurs until cancelled, and while
                 that is still unchosen it says so and points at where to choose. */
              const slot = standing.find((sl) => sl.purchase_item_id === item.id);
              return (
                <div key={item.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    {/* D25 (SLOTREACH §4) — a riding lesson names HIGH. The client
                        never sees "2x Weekly Lessons"; they see the Riding Lessons
                        they have. Every other line keeps its own product name. */}
                    <p className="text-sm font-sans font-medium text-green-900">
                      {slot
                        ? serviceLabel(slot, Math.max(slot.weekly_frequency ?? 1, 1))
                        : item.label}
                    </p>
                    {slot && (
                      <p className="text-xs font-sans text-muted mt-1 leading-relaxed">
                        {standingSlotSentence(slot)}
                        {!slot.chosen && (
                          <>
                            {' '}
                            {/* SLOTREACH §1 — THE BREAK, LOCATED. This pointed at
                                `/app/onboarding`, the wizard's ROOT, and a client whose
                                paperwork is signed is short-circuited straight past the
                                slot step to "You're all set" or "Nothing to do here".
                                So the one door to the standing-slot picker opened onto a
                                wall, and a weekly membership could not be scheduled at
                                all (WALK2). The link names the step; the wizard honours
                                it whatever the paperwork says. */}
                            <Link to="/app/onboarding?step=slots" className="text-green-800 underline">
                              Select the day and time for your weekly{' '}
                              {serviceLabel(slot, Math.max(slot.weekly_frequency ?? 1, 1))}
                            </Link>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-serif font-medium text-green-800 whitespace-nowrap">
                    {formatPrice(item.price_amount, item.price_unit)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scheduling lives on the full calendar. PAYLOCK: this used to read
            "After payment is confirmed, you'll pick your time…" — which nothing
            in the system enforces. Credits are granted when the order is created
            and book_open_slot gates on credits, not on payment_status; no booking
            writer reads payment state at all. The old sentence also buried the
            only calendar link inside a wait that does not exist. */}
        {needsPayment && allDocsSigned && (
          <p className="body-text text-sm text-muted">
            You can pick your times on the{' '}
            <Link to="/app/calendar" className="text-green-800 underline">Calendar</Link>
            {' '}whenever you’re ready — scheduling doesn’t wait on payment.
          </p>
        )}

        {/* Payment */}
        {needsPayment && allDocsSigned && (
          <OrderPayment order={order} payment={payment} onChange={reload} />
        )}

        {needsPayment && !allDocsSigned && (
          <p className="body-text text-sm text-muted">
            Please review and agree to the documents above before continuing to payment.
          </p>
        )}

        {order.status === 'paid' && (
          <div className="bg-green-50 border border-green-200 p-8 text-center">
            {/* BOOKS1 (R4): a discounted or comped order shows the full price,
                the reduction, and that $0 is owed — the give-away is visible. */}
            {order.payment_disposition !== 'paid' && (
              <p className="body-text text-green-800 mb-3">
                Order total ${Number(order.amount).toFixed(2)} ·{' '}
                {order.payment_disposition === 'comped' ? 'Complimentary' : 'Discount'}{' '}
                −${Number(order.write_down_amount).toFixed(2)} · amount owed $0.00.
              </p>
            )}
            <p className="body-text text-green-800 mb-4">
              Everything is confirmed and copies are on their way to your inbox. We can’t wait to
              ride with you.
            </p>
            <Link to="/app/calendar" className="btn-primary">Schedule on the Calendar</Link>
          </div>
        )}
      </div>
    </div>
  );
}
