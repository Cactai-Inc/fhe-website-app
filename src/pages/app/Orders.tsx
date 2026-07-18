import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { listMyOrders } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import type { Order } from '../../lib/types';

const STATUS_LABEL: Record<string, string> = {
  draft: 'In progress', awaiting_payment: 'Awaiting payment', paid: 'Paid',
  confirmed: 'Confirmed', cancelled: 'Cancelled', expired: 'Expired',
};
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function Orders() {
  useDocumentTitle('Order History');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listMyOrders().then((o) => active && setOrders(o)).catch(() => active && setOrders([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">Orders</p>
      <h1 className="heading-section text-green-800 mb-8">Your purchases.</h1>

      {loading ? (
        <p className="body-text text-muted">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-green-800/10 rounded-xl p-8 text-center">
          <p className="body-text text-sm text-muted">You haven't made any purchases yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link key={o.id} to={`/order/${o.id}`}
              className="bg-white border border-green-800/10 p-5 flex items-center justify-between hover:shadow-md transition-shadow focus-ring">
              <div>
                <p className="text-sm font-sans font-medium text-green-900">
                  Order · {new Date(o.created_at).toLocaleDateString()}
                </p>
                <p className="text-xs text-muted mt-0.5">{STATUS_LABEL[o.status] ?? o.status}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-serif text-green-800">{usd(o.amount)}</span>
                <ArrowRight size={16} className="text-green-800/40" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
