import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Gift } from 'lucide-react';
import { usePrefersReducedMotion } from '../lib/hooks';
import { useCart } from '../contexts/CartContext';
import { fetchPublicCatalog, type ServiceGroup } from '../lib/publicCatalog';
import type { Offering } from '../lib/types';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

const LESSON_POSTER = '/reference-images/Hero_A.png';
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

// The SKU's mechanics, shown under the price (replaces the hardcoded perLesson copy).
function mechanics(o: Offering): string {
  if (o.config_kind === 'recurring' && o.weekly_frequency) return `${o.weekly_frequency}× weekly · monthly`;
  if (o.config_kind === 'scheduled' && (o.unit_count ?? 1) > 1) {
    const each = o.price_amount != null ? o.price_amount / (o.unit_count as number) : null;
    return each != null ? `${o.unit_count} lessons · ${usd(each)} each` : `${o.unit_count} lessons`;
  }
  return o.tagline ?? '';
}

export default function Lessons() {
  const seo = seoForPath('/lessons');
  const reducedMotion = usePrefersReducedMotion();
  const { toggleItem, isSelected, itemCount, setFunnel } = useCart();
  const navigate = useNavigate();
  const [packs, setPacks] = useState<Offering[]>([]);

  // This is the rider path — keeps the booking-request page's back link honest.
  useEffect(() => {
    setFunnel('rider');
  }, [setFunnel]);
  // Riding-lesson SKUs from the live catalog (was the hardcoded LESSON_PACKS).
  useEffect(() => {
    fetchPublicCatalog('rider')
      .then((groups: ServiceGroup[]) => setPacks(groups.find((g) => g.code === 'RIDING_LESSON')?.offerings ?? []))
      .catch(() => setPacks([]));
  }, []);

  function selectPack(o: Offering) {
    toggleItem({
      offeringId: o.id,
      offeringName: o.name,
      serviceType: o.service_type,
      price: o.price_amount ?? 0,
      unit: (o.price_unit ?? 'flat'),
      configKind: o.config_kind, weeklyFrequency: o.weekly_frequency, unitCount: o.unit_count,
    });
  }

  return (
    <>
      {seo && <Seo title={seo.title} description={seo.description} path="/lessons" service={seo.service} />}

      {/* Lead content (page leads with words; video reinforces below) */}
      <section className="bg-cream pt-32 pb-12">
        <div className="container-site max-w-3xl text-center">
          <p className="eyebrow mb-4">Book a lesson</p>
          <h1 className="heading-display text-green-800 mb-6 text-[clamp(2.25rem,5vw,3.5rem)]">
            Find your seat again.
          </h1>
          <p className="body-text text-lg leading-relaxed">
            Private instruction at your own pace — one lesson, or a pack when you're ready for a
            rhythm. Patient, classical teaching that meets you exactly where you are, whether it has
            been twenty years or you've never sat a horse.
          </p>
        </div>
      </section>

      {/* Video — rider taking instruction from a trainer */}
      <section className="bg-cream pb-16">
        <div className="container-site">
          <div className="relative overflow-hidden aspect-video max-w-4xl mx-auto bg-green-900">
            {reducedMotion ? (
              <img src={LESSON_POSTER} alt="A rider in a lesson with a trainer" className="w-full h-full object-cover" />
            ) : (
              <video className="w-full h-full object-cover" autoPlay muted loop playsInline preload="metadata" poster={LESSON_POSTER}>
                <source src="/lessons.webm" type="video/webm" />
                <source src="/lessons.mp4" type="video/mp4" />
              </video>
            )}
          </div>
        </div>
      </section>

      {/* Catalog — price/quantity focused */}
      <section className="bg-cream-50 py-20">
        <div className="container-site max-w-5xl">
          <div className="text-center mb-12">
            <p className="eyebrow mb-3">Choose your lessons</p>
            <h2 className="heading-section text-green-800">Single, or save with a pack.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packs.map((o) => {
              const selected = isSelected(o.id);
              const hint = mechanics(o);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => selectPack(o)}
                  aria-pressed={selected}
                  className={`relative text-left p-7 border transition-all duration-200 focus-ring bg-white ${
                    selected ? 'border-green-800 ring-1 ring-green-800/20' : 'border-green-800/15 hover:border-green-800/40'
                  }`}
                >
                  {o.is_popular && (
                    <span className="absolute top-4 right-4 text-[9px] font-sans font-medium tracking-wider uppercase bg-gold-600 text-green-900 px-2 py-0.5">
                      Popular
                    </span>
                  )}
                  <h3 className="heading-card text-green-800 mb-1">{o.name}</h3>
                  {o.tagline && <p className="text-xs text-muted mb-5">{o.tagline}</p>}
                  <p className="font-serif text-4xl text-green-800 mb-1">{usd(o.price_amount ?? 0)}</p>
                  {hint && <p className="text-xs text-gold-ink">{hint}</p>}
                  <span className={`inline-flex items-center gap-1.5 mt-5 text-xs font-sans uppercase tracking-wide ${selected ? 'text-green-800 font-medium' : 'text-muted'}`}>
                    {selected ? <><Check size={13} /> Selected</> : 'Select'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Actions — the single primary step forward */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button type="button" onClick={() => navigate('/checkout')} disabled={itemCount === 0} className="btn-primary">
              Continue to Booking Request
              <ArrowRight size={16} />
            </button>
            <Link to="/gift?item=lessons" className="inline-flex items-center gap-2 text-sm font-sans text-secondary hover:text-green-800 transition-colors focus-ring">
              <Gift size={15} aria-hidden="true" />
              Buy as a gift instead
            </Link>
          </div>
          {itemCount === 0 && (
            <p className="text-xs text-center text-muted mt-3">Choose a lesson option to continue.</p>
          )}

          <p className="text-center mt-10">
            <Link to="/about" className="link-underline">Read our story <ArrowRight size={12} aria-hidden="true" /></Link>
          </p>
        </div>
      </section>
    </>
  );
}
