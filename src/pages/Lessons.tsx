import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Gift } from 'lucide-react';
import { usePrefersReducedMotion } from '../lib/hooks';
import { useCart } from '../contexts/CartContext';
import { fetchPublicCatalog, type ServiceGroup } from '../lib/publicCatalog';
import type { Offering } from '../lib/types';
import Seo from '../components/Seo';
import SelectionBar from '../components/SelectionBar';
import { seoForPath } from '../lib/seo';

const LESSON_POSTER = '/images/Hero_A.png';
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

// The gold line under the price. Owner, 2026-08-14: this line pertains to the
// PRICE — the DB `note` column carries it when set ("Save $100", "Single riding
// lesson"); recurring SKUs without a note keep the computed frequency line.
// The old fallback to `tagline` is gone: tagline now renders under the name.
function mechanics(o: Offering): string {
  if (o.note) return o.note;
  if (o.config_kind === 'recurring' && o.weekly_frequency) {
    // Riding lessons say what recurs and that the price is a payment cadence
    // (owner, 2026-08-14): "1× weekly lesson · paid monthly". Other recurring
    // services (training/exercise/turnout) keep the generic line.
    // Plain "x", matching the card titles ("1x Weekly Lesson") — the gold line
    // and the title should read as one voice, not "1x" vs "1×".
    if (o.service_type === 'RIDING_LESSON') {
      return `${o.weekly_frequency}x weekly ${o.weekly_frequency > 1 ? 'lessons' : 'lesson'} · paid monthly`;
    }
    return `${o.weekly_frequency}x weekly · monthly`;
  }
  if (o.config_kind === 'scheduled' && (o.unit_count ?? 1) > 1) return `${o.unit_count} lessons`;
  return '';
}

/* Owner-directed card details, 2026-08-14. Display concerns only — the DB stays
 * the source of the words. */

// The "(With your horse)" suffix comes off the rendered title; the DB name keeps
// it so staff surfaces (orders, admin lists) can tell the two Single Lessons apart.
const displayName = (name: string) => name.replace(/\s*\(with your horse\)\s*/i, '');

// The prorate/reschedule footnote for the weekly-subscription cards — one
// block below each row (owner, 2026-08-14: not repeated inside the cards),
// anchored by a * on those cards' descriptions.
const WEEKLY_FOOTNOTE =
  `* First month can be prorated or book all your lessons for the month in the days ` +
  `remaining. With this program you can ride every week even when there's a 5th week, ` +
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
      {/* pb-12→pb-8: the video sits a touch closer to the intro (owner).
          max-w-3xl→4xl: the intro paragraph holds to ≤3 lines on desktop
          (owner); the short centered heading is unaffected by the wider column. */}
      <section className="bg-cream pt-32 pb-8">
        <div className="container-site max-w-4xl text-center">
          <p className="eyebrow mb-4">Book a lesson</p>
          {/* Owner, 2026-08-14: most visitors are first-time riders — the old
              "Find your seat again." spoke only to returners. Exact casing and
              no period, per owner; it also echoes the landing CTA that brought
              the visitor here. */}
          <h1 className="heading-display text-green-800 mb-6 text-[clamp(2.25rem,5vw,3.5rem)]">
            Start Riding With Us
          </h1>
          <p className="body-text text-lg leading-relaxed">
            Private instruction at your own pace — one lesson, or a group when you're ready for the
            challenge. Patient, classical teaching that meets you exactly where you are, whether
            you're getting back in the saddle or this is your first ride.
          </p>
        </div>
      </section>

      {/* Video — rider taking instruction from a trainer.
          PHONES (owner, 2026-08-16, with screenshots): the riders read too small
          and too much empty foreground sand sat under them. The frame goes to 5:4
          — a little taller than 16:9, NOT portrait — and `object-cover` then
          crops to the riders rather than shrinking them, anchored at 42% so the
          bottom edge lands near the fence line instead of halfway down the arena.
          Wide is right here (the owner's zoom keeps both outer riders and the
          palms); only the empty sand goes.
          The gap below was a whole band of cream between the photo and "CHOOSE
          YOUR LESSONS": pb-16 → pb-6 on phones, and the next section's py-20
          → pt-10 on phones (see below). sm+ untouched. */}
      <section className="bg-cream pb-6 sm:pb-16">
        <div className="container-site">
          <div className="relative overflow-hidden aspect-[5/4] sm:aspect-video max-w-4xl mx-auto bg-green-900">
            {reducedMotion ? (
              <img src={LESSON_POSTER} alt="Three riders on horseback at the ranch" className="w-full h-full object-cover [object-position:center_42%] sm:[object-position:center_center]" />
            ) : (
              <video className="w-full h-full object-cover [object-position:center_42%] sm:[object-position:center_center]" autoPlay muted loop playsInline preload="metadata" poster={LESSON_POSTER}>
                <source src="/lessons.webm" type="video/webm" />
                <source src="/lessons.mp4" type="video/mp4" />
              </video>
            )}
          </div>
        </div>
      </section>

      {/* Catalog — price/quantity focused */}
      {/* pt trimmed on phones — the owner's screenshot showed a large cream
          band between the photo and this heading. sm+ keeps py-20. */}
      {/* pb-36 at the foot: room for the floating SelectionBar so it can never
          cover the last card. */}
      <section className="bg-cream-50 pt-10 pb-36 sm:pt-20 sm:pb-36">
        <div className="container-site max-w-5xl">
          {/* Owner, screenshot 2026-08-14: the heading sat tight under its
              eyebrow with a chasm below — air moved above (mb-3→mb-5), the
              block's bottom margin halved (mb-12→mb-6; the horse-included
              line below carries its own mb-8). */}
          <div className="text-center mb-6">
            <p className="eyebrow mb-5">Choose your lessons</p>
            <h2 className="heading-section text-green-800">From Your 1st Ride to Weekly Lessons</h2>
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
              // Weekly cards carry the * that anchors the block below the row.
              const weekly = o.config_kind === 'recurring' && !!o.weekly_frequency;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => selectPack(o)}
                  aria-pressed={selected}
                  className={`relative flex flex-col items-start text-left p-7 border transition-all duration-200 focus-ring bg-white ${
                    selected ? 'border-green-800 ring-1 ring-green-800/20' : 'border-green-800/15 hover:border-green-800/40'
                  }`}
                >
                  {/* flex-col above: a <button> vertically centers its content
                      by default, so short cards floated mid-row when the grid
                      stretched them — titles now align along the top edge in
                      every column count (owner, 2026-08-14). */}
                  {/* top-2/right-2 (was 4): hugging the corner clears the badge
                      fully above the title's line — the longer weekly titles
                      were crowding it (owner, 2026-08-15). */}
                  {badge && (
                    <span className="absolute top-2 right-2 text-[9px] font-sans font-medium tracking-wider uppercase bg-gold-600 text-green-900 px-2 py-0.5">
                      {badge}
                    </span>
                  )}
                  <h3 className="heading-card text-green-800 mb-1">
                    {punch ? <>{punch[1]}<br />Punch Card</> : title}
                  </h3>
                  {/* The anchor reads at a glance: full-size and gold, not a
                      grey superscript (owner: it was hard to see). */}
                  {o.tagline && <p className="text-xs text-muted mb-5">{o.tagline}{weekly && <span className="text-gold-ink font-semibold" aria-hidden="true"> *</span>}</p>}
                  <p className="font-serif text-4xl text-green-800 mb-1">{usd(o.price_amount ?? 0)}</p>
                  {hint && <p className="text-xs text-gold-ink">{hint}</p>}
                  <span className={`inline-flex items-center gap-1.5 mt-5 text-xs font-sans uppercase tracking-wide ${selected ? 'text-green-800 font-medium' : 'text-muted'}`}>
                    {selected ? <><Check size={13} /> Selected</> : 'Select'}
                  </span>
                </button>
              );
            };
            // 1 col on phones, 2 on small screens, 3 on desktop (owner: the
            // missing middle step made tablet widths cramped).
            const gridCls = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
            const footnote = (
              <p className="text-xs leading-relaxed text-muted mt-5 max-w-3xl mx-auto">
                {WEEKLY_FOOTNOTE}
              </p>
            );
            return (
              <>
                {/* Mirrors the own-horse divider below — the two lines make the
                    rows read as deliberate sections, no box needed (owner call,
                    2026-08-14: communicate horse-included once, not per card). */}
                <p className="text-center body-text text-lg text-green-800 mb-8">
                  Your riding lesson includes one of our carefully selected horses.
                </p>
                <div className={gridCls}>
                  {ourHorse.map(card)}
                </div>
                {ownHorse.length > 0 && (
                  <>
                    <p className="text-center body-text text-lg text-green-800 mt-14 mb-8">
                      Already leasing or own a horse? These lessons are for you.
                    </p>
                    <div className={gridCls}>
                      {ownHorse.map(card)}
                    </div>
                  </>
                )}
                {/* Once, at the bottom, under the last set of cards (owner). */}
                {footnote}
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
              Buy as a gift
            </Link>
          </div>
          {itemCount === 0 && (
            <p className="text-xs text-center text-muted mt-3">Choose a lesson option to continue.</p>
          )}

          {/* The floating bar belongs here too — this is where lessons are
              chosen. Unlike the three-step funnels, /lessons goes straight to
              checkout, so the bar calls that same navigate. */}
          <p className="text-center mt-10">
            {/* Owner, 2026-08-16: was /about — a stale page from before the
                community page existed, and one that needs rebuilding. This is
                the community page (route /story, labelled Community in nav). */}
            <Link to="/story" className="link-underline">Learn about our community <ArrowRight size={12} aria-hidden="true" /></Link>
          </p>
        </div>
      </section>

    {itemCount > 0 && (
      <SelectionBar onContinue={() => navigate('/checkout')} label="Continue to Booking Request" />
    )}
    </>
  );
}
