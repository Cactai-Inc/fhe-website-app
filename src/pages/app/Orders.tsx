import { useDocumentTitle } from '../../lib/hooks';
import { OrdersContent } from '../../components/app/OrdersContent';

/**
 * MY ORDERS (/app/orders). The content itself is OrdersContent, shared with
 * the Account page's inline panel.
 */
export default function Orders() {
  useDocumentTitle('My Orders');
  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">Orders</p>
      <h1 className="heading-section text-green-800 mb-8">Everything you've purchased.</h1>
      <OrdersContent />
    </div>
  );
}
