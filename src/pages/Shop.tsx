import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';
import { useCart } from '../contexts/CartContext';
import { OfferingCatalog } from '../components/OfferingCatalog';

/* Ways to ride with us — the public CATALOG. Offerings are read from the database
 * (OfferingCatalog → fetchOfferings); nothing is hardcoded. The public checkout is
 * the by-appointment inquiry path (/checkout). */

const seo = () => seoForPath('/shop')!;

export default function Shop() {
  const meta = seo();
  const navigate = useNavigate();
  const { setFunnel } = useCart();

  // Keep the checkout back-link honest for whatever they add from here.
  useEffect(() => { setFunnel('rider'); }, [setFunnel]);

  return (
    <>
      <Seo title={meta.title} description={meta.description} path="/shop" service={meta.service} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="bg-cream">
        <div className="container-site pt-32 pb-8 sm:pt-40 sm:pb-10">
          <div className="max-w-2xl">
            <p className="eyebrow mb-5">The Catalog</p>
            <h1 className="heading-display text-green-900 text-[clamp(2.5rem,6vw,4.5rem)]">
              Ways to ride with us.
            </h1>
            <p className="body-text mt-6 text-lg max-w-xl">
              A first lesson, a standing place in the community, or care for a
              horse of your own — everything we offer, and what it costs.
            </p>
          </div>

          {/* Compact by-appointment reassurance — one elegant line, gold rule. */}
          <div className="mt-10 sm:mt-12 border-l-2 border-gold-600 pl-5 sm:pl-6 max-w-3xl">
            <p className="font-serif text-green-900 text-lg sm:text-xl leading-snug">
              Everything here is by appointment, arranged personally.
            </p>
            <p className="body-text text-sm mt-1.5">
              Save what interests you; we&rsquo;ll call to find the right fit, then send
              your approval to book and pay online. Quick, personal, and considered.
            </p>
          </div>
        </div>
      </section>

      {/* ── Catalog: offerings-backed, from the database (no hardcoded services). ── */}
      <section className="bg-cream">
        <div className="container-site pb-24 sm:pb-32 pt-8 sm:pt-10">
          <OfferingCatalog onCheckout={() => navigate('/checkout')} actionLabel="Inquire" />
        </div>
      </section>
    </>
  );
}
