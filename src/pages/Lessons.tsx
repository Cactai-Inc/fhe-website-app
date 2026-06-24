import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Gift } from 'lucide-react';
import { usePrefersReducedMotion } from '../lib/hooks';
import { useCart } from '../contexts/CartContext';
import { LESSON_PACKS, LESSON_ADDONS } from '../lib/catalog';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

const LESSON_POSTER = '/reference-images/Gemini_Generated_Image_f3u06df3u06df3u0.png';
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function Lessons() {
  const seo = seoForPath('/lessons');
  const reducedMotion = usePrefersReducedMotion();
  const { toggleItem, isSelected, addItem, itemCount } = useCart();
  const navigate = useNavigate();
  const [addons, setAddons] = useState<Record<string, boolean>>({});

  function selectPack(p: typeof LESSON_PACKS[number]) {
    toggleItem({
      serviceId: 'riding-lesson', serviceName: 'Riding Lessons',
      tierId: p.id, tierLabel: p.label, price: p.price, unit: p.unit,
    });
  }

  function continueToCheckout() {
    // Add any chosen add-ons before heading to checkout.
    for (const a of LESSON_ADDONS) {
      if (addons[a.id]) {
        addItem({
          serviceId: `addon-${a.id}`, serviceName: 'Lesson Add-on',
          tierId: a.id, tierLabel: a.label, price: a.price, unit: 'flat',
        });
      }
    }
    navigate('/checkout');
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
            {LESSON_PACKS.map((p) => {
              const selected = isSelected('riding-lesson', p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPack(p)}
                  aria-pressed={selected}
                  className={`relative text-left p-7 border transition-all duration-200 focus-ring bg-white ${
                    selected ? 'border-green-800 ring-1 ring-green-800/20' : 'border-green-800/15 hover:border-green-800/40'
                  }`}
                >
                  {p.popular && (
                    <span className="absolute top-4 right-4 text-[9px] font-sans font-medium tracking-wider uppercase bg-gold-600 text-green-900 px-2 py-0.5">
                      Popular
                    </span>
                  )}
                  <h3 className="heading-card text-green-800 mb-1">{p.label}</h3>
                  <p className="text-xs text-muted mb-5">{p.description}</p>
                  <p className="font-serif text-4xl text-green-800 mb-1">{usd(p.price)}</p>
                  {p.perLesson && <p className="text-xs text-gold-ink">{p.perLesson}</p>}
                  <span className={`inline-flex items-center gap-1.5 mt-5 text-xs font-sans uppercase tracking-wide ${selected ? 'text-green-800 font-medium' : 'text-muted'}`}>
                    {selected ? <><Check size={13} /> Selected</> : 'Select'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Add-ons */}
          <div className="mt-12">
            <p className="eyebrow mb-4 text-center">Make it count — optional add-ons</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {LESSON_ADDONS.map((a) => {
                const on = !!addons[a.id];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAddons((s) => ({ ...s, [a.id]: !s[a.id] }))}
                    aria-pressed={on}
                    className={`text-left p-5 border transition-all duration-200 focus-ring bg-white ${
                      on ? 'border-green-800 ring-1 ring-green-800/20' : 'border-green-800/15 hover:border-green-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-sans font-medium text-green-900 text-sm">{a.label}</h4>
                      <span className="font-serif text-green-800">{usd(a.price)}</span>
                    </div>
                    <p className="text-xs text-muted mt-1.5">{a.description}</p>
                    <span className={`inline-flex items-center gap-1.5 mt-3 text-[11px] font-sans uppercase tracking-wide ${on ? 'text-green-800 font-medium' : 'text-muted'}`}>
                      {on ? <><Check size={12} /> Added</> : '+ Add'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button type="button" onClick={continueToCheckout} disabled={itemCount === 0} className="btn-primary">
              Continue
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
