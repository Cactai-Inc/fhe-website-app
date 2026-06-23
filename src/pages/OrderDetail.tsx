import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getOrder, getOrderPayment, fetchOrderDocuments } from '../lib/api';
import { useDocumentTitle } from '../lib/hooks';
import type { Order, OrderItem, Payment, OrderDocument } from '../lib/types';
import { formatPrice } from '../lib/services';
import OrderDocuments from '../components/order/OrderDocuments';
import OrderPayment from '../components/order/OrderPayment';

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  draft: { title: 'Let’s finish setting this up', body: 'Review the details below, agree to the documents, and choose how you’d like to pay.' },
  awaiting_payment: { title: 'Awaiting your payment', body: 'Send your payment using the details below. We’ll confirm as soon as it arrives — usually within the hour.' },
  paid: { title: 'Payment received', body: 'Thank you. We’re finalizing your confirmation now.' },
  confirmed: { title: 'You’re all set', body: 'Everything is confirmed. We can’t wait to ride with you.' },
  cancelled: { title: 'This order was cancelled', body: 'If that wasn’t intended, reach out and we’ll sort it.' },
  expired: { title: 'This order expired', body: 'No problem — reach out and we’ll start fresh.' },
};

export default function OrderDetail() {
  useDocumentTitle('Your Order');
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<(Order & { items: OrderItem[] }) | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!id) return;
    const [o, p, d] = await Promise.all([
      getOrder(id),
      getOrderPayment(id).catch(() => null),
      fetchOrderDocuments(id).catch(() => []),
    ]);
    setOrder(o);
    setPayment(p);
    setDocuments(d);
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

  const copy = STATUS_COPY[order.status] ?? STATUS_COPY.draft;
  const allDocsSigned = documents.length === 0 || documents.every((d) => !!d.agreed_at);
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
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-sans font-medium text-green-900">{item.label}</p>
                </div>
                <p className="text-sm font-serif font-medium text-green-800">
                  {formatPrice(item.price_amount, item.price_unit)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Documents */}
        {documents.length > 0 && order.status !== 'confirmed' && (
          <OrderDocuments documents={documents} onSigned={reload} />
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

        {order.status === 'confirmed' && (
          <div className="bg-green-50 border border-green-200 p-8 text-center">
            <p className="body-text text-green-800">
              Everything is confirmed and copies are on their way to your inbox. We can’t wait to
              ride with you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
