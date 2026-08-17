import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Gift } from 'lucide-react';
import { usePrefersReducedMotion } from '../lib/hooks';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchPublicCatalog, type ServiceGroup } from '../lib/publicCatalog';
import { cartHasQuestions } from '../lib/questionSets';
import { listStableHorses } from '../lib/stable';
import type { Offering } from '../lib/types';
import Seo from '../components/Seo';
import SelectionBar from '../components/SelectionBar';
import ServiceSelector from '../components/ServiceSelector';
import ServiceListState from '../components/ServiceListState';
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
  const { state, toggleItem, isSelected, itemCount, setFunnel } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [packs, setPacks] = useState<Offering[]>([]);
  const [packsState, setPacksState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [typeName, setTypeName] = useState<string | null>(null);
  // The full RIDING_LESSON group (packs/typeName above are the marketing page's
  // flattened view of the same fetch) — the signed-in purchase-flow branch needs
  // the whole ServiceGroup shape to hand to ServiceSelector, the same component
  // /horse and /acquisition already render their cards with.
  const [group, setGroup] = useState<ServiceGroup | null>(null);

  /**
   * SESSIONBOOK §S2 — "does this member have a horse" (owned OR leased).
   * `my_stable_horses` already unions ownership, lessee and active
   * horse_relationships rows (verified live, 2026-08-17) — a non-empty result
   * IS the answer, so no second "do I own ANY horse" check is needed.
   * Only fetched when signed in; signed-out visitors keep seeing everything and
   * never call this.
   */
  const [hasHorse, setHasHorse] = useState(false);
  const [horseState, setHorseState] = useState<'loading' | 'ready'>('loading');
  useEffect(() => {
    if (!user) { setHorseState('ready'); return; }
    let active = true;
    setHorseState('loading');
    listStableHorses()
      .then((horses) => { if (active) { setHasHorse(horses.length > 0); setHorseState('ready'); } })
      // Fail OPEN (show every lesson) rather than closed — the same convention
      // AuthContext's hiddenPages uses: a failed read should show MORE, not hide
      // lessons a horse-owning member is entitled to.
      .catch(() => { if (active) { setHasHorse(true); setHorseState('ready'); } });
    return () => { active = false; };
  }, [user]);

  /**
   * ASKRIGHT §A0 — THE CROSS-ENTRY CASE.
   *
   * Owner, 2026-08-16: "if there are horse care or acquisition items in the
   * cart and they click the continue button from the lessons page it needs to
   * still show the page 2 for the questions related to the other services
   * before the form is shown."
   *
   * This page is NOT hardcoded to skip the questions page. It asks the cart.
   * A lessons-only order goes straight to the form because nothing in it asks
   * anything — which is a fact about riding lessons, not about /lessons.
   */
  const nextStep = cartHasQuestions(state.items) ? '/questions' : '/checkout';

  // This is the rider path — keeps the booking-request page's back link honest.
  useEffect(() => {
    setFunnel('rider');
  }, [setFunnel]);
  // Riding-lesson SKUs from the live catalog (was the hardcoded LESSON_PACKS).
  useEffect(() => {
    fetchPublicCatalog('rider')
      .then((groups: ServiceGroup[]) => {
        const lessons = groups.find((g) => g.code === 'RIDING_LESSON') ?? null;
        setGroup(lessons);
        setPacks(lessons?.offerings ?? []);
        // The catalog's own display name for the service, carried on the cart
        // item so any surface that names the service says what the owner named
        // it — never an offering name, never a hardcoded string.
        setTypeName(lessons?.name ?? null);
        setPacksState('ready');
      })
      // A fetch failure used to silently render an empty grid — the page
      // looked like the business sells nothing. Surface it instead.
      .catch(() => { setPacks([]); setGroup(null); setPacksState('error'); });
  }, []);

  function selectPack(o: Offering) {
    toggleItem({
      offeringId: o.id,
      offeringName: o.name,
      offeringSlug: o.slug,
      serviceType: o.service_type,
      serviceTypeName: typeName,
      price: o.price_amount ?? 0,
      unit: (o.price_unit ?? 'flat'),
      configKind: o.config_kind, weeklyFrequency: o.weekly_frequency, unitCount: o.unit_count,
    });
  }

  return (
    <>
      {seo && <Seo title={seo.title} description={seo.description} path="/lessons" service={seo.service} />}

      {user ? (
        <>
        {/* SESSIONBOOK — SIGNED IN.
            Owner, 2026-08-16: "when im in an authenticated session and i click
            the book a lesson page link it opens a page that is formatted like
            the horse care and find a horse pages... and the focus is on the
            purchase flow like those other pages use, not a marketing approach."
            No hero, no video, no marketing copy — straight to the same
            ServiceSelector card component /horse and /acquisition render their
            step-1 cards with. This is composition, not a second page: it shares
            the catalog fetch, the cart and the `nextStep` spine the signed-out
            branch below already uses, so Continue still lands on `/checkout`,
            which already branches signed-in members into the member purchase
            panel (`createDraftOrder`). No second purchase path is added here. */}
        <div className="min-h-screen bg-cream pt-24 pb-36">
          <div className="container-site max-w-5xl">
            <div className="mb-10">
              <p className="eyebrow mb-3">Book a Lesson</p>
              <h1 className="heading-section text-green-800 mb-3">Choose Your Lessons</h1>
              <p className="body-text">
                Select the lesson option that fits your schedule. You're signed in, so this goes
                straight to your order — nothing is charged until you confirm.
              </p>
            </div>

            {(() => {
              if (packsState === 'error') return <ServiceListState state="error" />;
              if (packsState === 'loading' || horseState === 'loading') return <ServiceListState state="loading" />;
              // S2 — hide the own-horse lessons (`horse_included = false`) from a
              // member with no horse on record. `hasHorse` already covers owned
              // OR leased (`my_stable_horses` unions both); a member who owns or
              // leases sees BOTH sets — hiding the our-horse lessons would block
              // them from booking a school-horse lesson (owner-confirmed,
              // 2026-08-17). Explicit `=== false` test, never `!= true` —
              // `horse_included` carries NULLs elsewhere in the catalog.
              const offerings = hasHorse
                ? (group?.offerings ?? [])
                : (group?.offerings ?? []).filter((o) => o.horse_included !== false);
              if (!group || offerings.length === 0) {
                return (
                  <ServiceListState
                    state="empty"
                    emptyLead="We don't have a lesson option available for you right now — reach out and we will help you find the right fit."
                  />
                );
              }
              return <ServiceSelector group={{ ...group, offerings }} category="Rider Services" />;
            })()}

            <div className="mt-12 flex items-center justify-center">
              <button type="button" onClick={() => navigate(nextStep)} disabled={itemCount === 0} className="btn-primary">
                Continue
                <ArrowRight size={16} />
              </button>
            </div>
            {itemCount === 0 && (
              <p className="text-xs text-center text-muted mt-3">Choose a lesson option to continue.</p>
            )}
          </div>
        </div>
        <SelectionBar onContinue={() => navigate(nextStep)} />
        </>
      ) : (
        <>
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
            <button type="button" onClick={() => navigate(nextStep)} disabled={itemCount === 0} className="btn-primary">
              {nextStep === '/checkout' ? 'Continue to Submit Inquiry' : 'Continue'}
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
              chosen. It calls the same `nextStep` the button above does, so
              there is one path forward, not two. */}
          <p className="text-center mt-10">
            {/* Owner, 2026-08-16: was /about — a stale page from before the
                community page existed, and one that needs rebuilding. This is
                the community page (route /story, labelled Community in nav). */}
            <Link to="/story" className="link-underline">Learn about our community <ArrowRight size={12} aria-hidden="true" /></Link>
          </p>
        </div>
      </section>

    {itemCount > 0 && (
      <SelectionBar
        onContinue={() => navigate(nextStep)}
        label={nextStep === '/checkout' ? 'Continue to Submit Inquiry' : 'Continue'}
      />
    )}
        </>
      )}
    </>
  );
}
