import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/hooks';
import { OfferingCatalog } from '../../components/OfferingCatalog';

/**
 * IN-APP CATALOG (/app/catalog) — the offerings catalog inside the authenticated
 * app. Same offerings-backed content as the public shop, but the cart flows into
 * the real /app/checkout purchase flow (documents → payment → confirmation) rather
 * than an inquiry form, because the session is authenticated.
 */
export default function CatalogPage() {
  useDocumentTitle('Catalog');
  const navigate = useNavigate();
  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow">Shop</p>
        <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">Catalog</h1>
        <p className="text-sm text-muted mt-1">Lessons, horse care, training, and acquisition services.</p>
      </header>
      <OfferingCatalog onCheckout={() => navigate('/app/checkout')} actionLabel="Book it" />
    </div>
  );
}
