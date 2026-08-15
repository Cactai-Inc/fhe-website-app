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

// The gold line under the price. Owner, 2026-08-14: this line pertains to the
// PRICE — the DB `note` column carries it when set ("Save $100", "Single riding
// lesson"); recurring SKUs without a note keep the computed frequency line.
// The old fallback to `tagline` is gone: tagline now renders under the name.
function mechanics(o: Offering): string {
  if (o.note) return o.note;
  if (o.config_kind === 'recurring' && o.weekly_frequency) return `${o.weekly_frequency}× weekly · monthly`;
  if (o.config_kind === 'scheduled' && (o.unit_count ?? 1) > 1) return `${o.unit_count} lessons`;
  return '';
}

/* Owner-directed card details, 2026-08-14. Display concerns only — the DB stays
 * the source of the words. */

// The "(With your horse)" suffix comes off the rendered title; the DB name keeps
// it so staff surfaces (orders, admin lists) can tell the two Single Lessons apart.
const displayName = (name: string) => name.replace(/\s*\(with your horse\)\s*/i, '');

// The prorate/reschedule footnote on the weekly-subscription cards.
const weeklyFootnote = (freq: number) =>
  `* Option to have first month prorated or book all your lessons for the month in the days ` +
  `remaining. With this program you can ride ${freq}x every week even when there's a 5th week, ` +
  `plus the freedom to easily reschedule or change your riding day(s) right from your rider ` +
  `companion app (subject to schedule availability, we kindly request 48 hrs notice).`;

export default function Lessons() {
  const seo = seoForPath('/lessons');
  const reducedMotion = usePrefersReducedMotion();
  const { toggleItem, isSelected, itemCount, setFunnel } = useCart();
  const navigate = useNavigate();
  const [packs, setPacks] = useState<Offering[]>([]);
  const [packsState, setPacksState] = useState<'loading' | 'error' | 'ready'>('loading');

  // This is the rider path — keeps the booking-request page's back link honest.
  useEffect(() => {
    setFunnel('rider');
  }, [setFunnel]);
  // Riding-lesson SKUs from the live catalog (was the hardcoded LESSON_PACKS).
  useEffect(() => {
    fetchPublicCatalog('rider')
      .then((groups: ServiceGroup[]) => {
        setPacks(groups.find((g) => g.code === 'RIDING_LESSON')?.offerings ?? []);
        setPacksState('ready');
      })
      // A fetch failure used to silently render an empty grid — the page
      // looked like the business sells nothing. Surface it instead.
      .catch(() => { setPacks([]); setPacksState('error'); });
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
          {/* Owner, 2026-08-14: most visitors are first-time riders — the old
              "Find your seat again." spoke only to returners. Exact casing and
              no period, per owner; it also echoes the landing CTA that brought
              the visitor here. */}
          <h1 className="heading-display text-green-800 mb-6 text-[clamp(2.25rem,5vw,3.5rem)]">
            Come Ride With Us
          </h1>
          <p className="body-text text-lg leading-relaxed">
            Private instruction at your own pace — one lesson, or a group when you're ready for a
            rhythm. Patient, classical teaching that meets you exactly where you are, whether it has
            been twenty years or this is your first ride.
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

          {packsState === 'loading' && (
            <p className="text-center text-muted body-text">Loading lesson options…</p>
          )}
          {packsState === 'error' && (
            <p className="text-center text-muted body-text">
              We couldn't load the lesson options. Please refresh the page, or{' '}
              <Link to="/contact" className="underline">contact us</Link> and we'll get you booked.
            </p>
          )}
          {(() => {
            // Two rows: our-horse lessons first, own-horse lessons after the
            // divider. horse_included=false marks the own-horse SKUs in the DB.
            const ourHorse = packs.filter((o) => o.horse_included !== false);
            const ownHorse = packs.filter((o) => o.horse_included === false);
            // A plain render function, not a nested component — a component
            // declared inside render gets a new identity every pass (the
            // AddElementModal remount lesson).
            const card = (o: Offering) => {
              const selected = isSelected(o.id);
              const hint = mechanics(o);
              const badge = o.badge_label ?? (o.is_popular ? 'Popular' : null);
              const title = displayName(o.name);
              // "Punch Card" sits on its own line below "4-Lesson" / "8-Lesson".
              const punch = title.match(/^(.*)\s+Punch Card$/);
              const footnote = o.config_kind === 'recurring' && o.weekly_frequency
                ? weeklyFootnote(o.weekly_frequency) : null;
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
                  {badge && (
                    <span className="absolute top-4 right-4 text-[9px] font-sans font-medium tracking-wider uppercase bg-gold-600 text-green-900 px-2 py-0.5">
                      {badge}
                    </span>
                  )}
                  <h3 className="heading-card text-green-800 mb-1">
                    {punch ? <>{punch[1]}<br />Punch Card</> : title}
                  </h3>
                  {o.tagline && <p className="text-xs text-muted mb-5">{o.tagline}</p>}
                  <p className="font-serif text-4xl text-green-800 mb-1">{usd(o.price_amount ?? 0)}</p>
                  {hint && <p className="text-xs text-gold-ink">{hint}</p>}
                  <span className={`inline-flex items-center gap-1.5 mt-5 text-xs font-sans uppercase tracking-wide ${selected ? 'text-green-800 font-medium' : 'text-muted'}`}>
                    {selected ? <><Check size={13} /> Selected</> : 'Select'}
                  </span>
                  {footnote && <p className="text-[10px] leading-relaxed text-muted mt-4">{footnote}</p>}
                </button>
              );
            };
            return (
              <>
                {/* Mirrors the own-horse divider below — the two lines make the
                    rows read as deliberate sections, no box needed (owner call,
                    2026-08-14: communicate horse-included once, not per card). */}
                <p className="text-center body-text text-lg text-green-800 mb-8">
                  Your riding lesson includes one of our carefully selected horses
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {ourHorse.map(card)}
                </div>
                {ownHorse.length > 0 && (
                  <>
                    <p className="text-center body-text text-lg text-green-800 mt-14 mb-8">
                      Already leasing or own a horse? These lessons are for you
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {ownHorse.map(card)}
                    </div>
                  </>
                )}
              </>
            );
          })()}

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
