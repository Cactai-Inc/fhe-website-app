import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Check } from 'lucide-react';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';
import { useCart } from '../contexts/CartContext';
import type { CartItem } from '../lib/cart';
import {
  RIDING_LESSON,
  HUNTER_JUMPER,
  HORSEMANSHIP,
  HORSE_TRAINING,
  HORSE_EXERCISE,
  HORSE_LOCATOR,
  EVALUATION,
  BROKERING,
  formatPrice,
} from '../lib/services';
import type { Service, ServiceTier } from '../lib/services';

/* ── Ways to ride with us — a boutique CATALOG (lookbook, not an accordion) ───
 *
 * The surface reads like a refined editorial catalog: each service FAMILY is a
 * section (heritage-serif heading + one warm line), and beneath it a GRID of
 * image-forward offering cards. Every card carries a tasteful media slot (a
 * green textural SWAP placeholder for now, clearly labeled for the owner's real
 * media), the offering name (serif), a one-line description, a prominent price
 * (uniform size, gold-accented unit), and one clear "View" action that opens the
 * tier detail modal. Squared edges, generous whitespace, aligned grid rhythm —
 * calm, expensive-by-restraint. No expandable text panels anywhere.
 *
 * The modal reads (never buys): Add to cart (stay + keep browsing) and Request
 * this now (add + go to /checkout). NO auto-add on open. Merchandising notes
 * (evaluation-lesson-as-onboarding, horsemanship pairs, acquisition → handling)
 * ride under the relevant family heading and inside the modal.
 *
 * Interaction (owner spec): "View details" EXPANDS the family section IN PLACE
 * (inline, on the page — NO modal, ever) to reveal that family's offerings with
 * prices + the two inline actions per offering (Save it / Submit inquiry). No
 * scrollable modals anywhere — mobile users never fight a scroll-trapped dialog.
 * Saved selections collect under the always-visible header cart icon.
 *
 * Offerings render in standard ascending rank order (entry option first); prices
 * are never hardcoded — every tier comes from src/lib/services.ts.
 *
 * SSR-safe: no window/document access at module or render top-level; useCart's
 * persistence is guarded for `window`.
 */

const seo = () => seoForPath('/shop')!;

// ─── Family model ───────────────────────────────────────────────────────────
// Maps the owner's Shop families onto real configured services. `note` is warm,
// genuine merchandising guidance the owner specified. `emptyState` renders when
// a family has no purchasable tiers (quote-based) instead of tier cards.

interface ShopFamily {
  key: string;
  name: string;                 // family name (Cormorant)
  line: string;                 // one-line description in the panel header
  service: Service;             // the source service (tiers come from here)
  /** Warm onboarding / cross-sell guidance shown in the expanded panel + modal. */
  note?: string;
  /** For quote-based families with no purchasable tiers. */
  emptyState?: { line: string };
}

// The acquisition family folds three support services' tiers into one panel.
const ACQUISITION_SERVICE: Service = {
  id: 'acquisition',
  name: 'Purchase & Lease Support',
  category: 'support',
  tagline: HORSE_LOCATOR.tagline,
  description:
    'From the first search to the signed contract, we help you find and secure the right horse — curating a shortlist, evaluating soundness and temperament, and managing the purchase or lease from start to finish.',
  tiers: [...HORSE_LOCATOR.tiers, ...EVALUATION.tiers, ...BROKERING.tiers],
};

const FAMILIES: ShopFamily[] = [
  {
    key: 'riding-lessons',
    name: 'Riding Lessons',
    line: 'Patient, classical instruction — come as you are, at the pace the horse sets.',
    service: RIDING_LESSON,
    note: 'The Riding Lesson Membership begins with an evaluation lesson, so we can assess your riding and build your plan together — a warm first step, not a hurdle.',
  },
  {
    key: 'jumper-training',
    name: 'Jumper Training',
    line: 'Rhythm and partnership over fences, built around a plan that is truly yours.',
    service: HUNTER_JUMPER,
    note: 'We begin with an evaluation lesson so we can assess your riding and build your plan. Anyone is welcome to request jumper training — the evaluation is simply how the plan gets built.',
  },
  {
    key: 'horsemanship',
    name: 'Horsemanship',
    line: 'Beyond the saddle: groundwork, handling, and the language of the horse.',
    service: HORSEMANSHIP,
    note: 'Horsemanship pairs naturally with riding lessons — the groundwork makes everything in the saddle easier.',
  },
  {
    key: 'horse-training',
    name: 'Horse Training',
    line: 'Patient, methodical training rooted in classical principles — for horses at any stage.',
    service: HORSE_TRAINING,
  },
  {
    key: 'horse-exercise',
    name: 'Horse Exercise',
    line: 'Lunging sessions that keep your horse fit and supple between your rides.',
    service: HORSE_EXERCISE,
  },
  {
    key: 'acquisition',
    name: 'Purchase & Lease Support',
    line: 'From the search to the signed contract, we help you find the right horse.',
    service: ACQUISITION_SERVICE,
    note: 'Clients leasing or buying are warmly encouraged to learn proper horse handling first — our Horsemanship classes are the natural place to start.',
  },
];

// ─── Price helpers ──────────────────────────────────────────────────────────
// Standard ascending rank order: entry/smallest option first, then up. For the
// families here this ascending-by-price order already reads as the natural
// sequence (e.g. single → pack → membership). services.ts defines no explicit
// sort_order, so ascending price is the ordering.

function sortedByPrice(tiers: ServiceTier[]): ServiceTier[] {
  return [...tiers].sort((a, b) => a.price - b.price);
}

/** Split a formatted "$150 / lesson" into the amount and the unit label so the
 *  unit can be gold-accented and rendered smaller. */
function splitPrice(tier: ServiceTier): { amount: string; unit: string } {
  const full = formatPrice(tier.price, tier.unit);
  // formatPrice returns either "$X", "$X / mo", "$X / lesson", or "N% of sale price".
  const slash = full.indexOf(' / ');
  if (slash !== -1) {
    return { amount: full.slice(0, slash), unit: full.slice(slash + 1).trim() };
  }
  if (tier.unit === 'percent') {
    // "N% of sale price" — keep the whole thing as the amount.
    return { amount: full, unit: '' };
  }
  return { amount: full, unit: 'one-time' };
}

function toCartItem(family: ShopFamily, tier: ServiceTier): CartItem {
  // The acquisition family's tiers come from three underlying services; keep the
  // real underlying service id so the checkout/order pipeline resolves the slug.
  const sourceServiceId =
    family.key === 'acquisition'
      ? (HORSE_LOCATOR.tiers.includes(tier)
          ? HORSE_LOCATOR.id
          : EVALUATION.tiers.includes(tier)
            ? EVALUATION.id
            : BROKERING.id)
      : family.service.id;
  const sourceServiceName =
    family.key === 'acquisition'
      ? (HORSE_LOCATOR.tiers.includes(tier)
          ? HORSE_LOCATOR.name
          : EVALUATION.tiers.includes(tier)
            ? EVALUATION.name
            : BROKERING.name)
      : family.service.name;
  // Flat-catalog cart shape (Slice 1): the purchasable unit is one offering.
  // Synthetic offeringId matches the ServiceSelector convention (serviceId-tierId).
  return {
    offeringId: `${sourceServiceId}-${tier.id}`,
    offeringName: `${sourceServiceName} — ${tier.label}`,
    serviceType: sourceServiceId,
    price: tier.price,
    unit: tier.unit,
  };
}

// ─── Price block (uniform emphasized size, gold-accented unit) ───────────────

function PriceTag({ tier, className = '' }: { tier: ServiceTier; className?: string }) {
  const { amount, unit } = splitPrice(tier);
  return (
    <p className={`font-serif text-green-800 leading-none text-2xl sm:text-3xl ${className}`}>
      {amount}
      {unit && (
        <span className="ml-1.5 font-sans text-[0.5em] tracking-wide uppercase text-gold-800 align-baseline">
          / {unit}
        </span>
      )}
    </p>
  );
}

// ─── An offering row — one tier inside the expanded family region ────────────
// Name + description + prominent price + two INLINE actions (no modal): Save it
// (adds to the saved selection, stays) and Submit inquiry (adds + go to /checkout).

function OfferingRow({
  tier,
  saved,
  onSave,
  onSubmit,
}: {
  tier: ServiceTier;
  saved: boolean;
  onSave: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="bg-white border border-green-800/12 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
      <div className="min-w-0 flex-1">
        <p className="font-serif font-medium text-green-900 text-lg sm:text-xl leading-snug">
          {tier.label}
          {tier.popular && (
            <span className="ml-2 align-middle text-[9px] font-sans font-medium tracking-widest uppercase text-gold-800 border border-gold-600/40 px-1.5 py-0.5">
              Most chosen
            </span>
          )}
        </p>
        <p className="text-sm text-muted mt-1.5 leading-relaxed">{tier.description}</p>
        {tier.note && <p className="text-xs text-gold-ink mt-1.5">{tier.note}</p>}
      </div>

      {/* Price + the two inline actions. */}
      <div className="flex items-center justify-between gap-4 sm:justify-end sm:gap-6 shrink-0">
        <PriceTag tier={tier} />
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onSave}
            aria-pressed={saved}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border font-sans text-xs font-medium tracking-widest uppercase transition-all duration-200 focus-ring min-h-[44px] whitespace-nowrap ${
              saved
                ? 'border-green-800 bg-green-800/5 text-green-900'
                : 'border-green-800/40 text-green-900 hover:border-green-800'
            }`}
          >
            {saved ? (
              <>
                <Check size={14} aria-hidden="true" />
                Saved
              </>
            ) : (
              'Save it'
            )}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-green-800 text-white font-sans text-xs font-medium tracking-widest uppercase transition-all duration-200 hover:bg-green-700 focus-ring min-h-[44px] whitespace-nowrap"
          >
            Inquire
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── A family section — a catalog "hero card" that EXPANDS IN PLACE ──────────
// Beautiful image-forward family card with a "View details" toggle. Expanding
// reveals the family's offerings inline (no modal). Squared, generous, calm.

function FamilySection({
  family,
  expanded,
  onToggle,
  isSaved,
  onSave,
  onSubmit,
}: {
  family: ShopFamily;
  expanded: boolean;
  onToggle: () => void;
  isSaved: (tier: ServiceTier) => boolean;
  onSave: (family: ShopFamily, tier: ServiceTier) => void;
  onSubmit: (family: ShopFamily, tier: ServiceTier) => void;
}) {
  const tiers = sortedByPrice(family.service.tiers);
  const hasTiers = tiers.length > 0;
  const regionId = `family-region-${family.key}`;
  const btnId = `family-toggle-${family.key}`;

  return (
    <section className="scroll-mt-28" aria-labelledby={`family-${family.key}`}>
      {/* Catalog hero card: image slot + family name/text + View details. */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Media slot — deep-green textural placeholder (NOT stock) until the
            owner adds real media. See the SWAP marker just inside. */}
        <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[340px] overflow-hidden bg-green-900 order-1 lg:order-none">
          {/* SWAP: real photograph of this service family */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-green-800 via-green-900 to-green-950"
            aria-hidden="true"
          />
          <div className="qs-grain absolute inset-0 opacity-[0.07]" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 border border-gold-600/20" aria-hidden="true" />
          <div className="absolute inset-0 flex items-end p-5">
            <span className="text-on-dark-soft text-[10px] font-sans tracking-widest uppercase">
              {`SWAP · ${family.name.toLowerCase()} image`}
            </span>
          </div>
        </div>

        {/* Text side */}
        <div className="flex flex-col justify-center bg-white border border-green-800/12 lg:border-l-0 p-7 sm:p-10">
          <h3
            id={`family-${family.key}`}
            className="font-display font-medium text-green-900 text-3xl sm:text-4xl leading-tight"
          >
            {family.name}
          </h3>
          <p className="body-text text-base sm:text-lg mt-3 max-w-md">{family.line}</p>
          {family.note && (
            <p className="body-text text-sm border-l-2 border-gold-600 pl-4 mt-5 max-w-md">
              {family.note}
            </p>
          )}

          <div className="mt-7">
            <button
              id={btnId}
              type="button"
              aria-expanded={expanded}
              aria-controls={regionId}
              onClick={onToggle}
              className="group inline-flex items-center gap-2.5 px-6 py-3 border border-green-800 text-green-900 font-sans text-xs font-medium tracking-widest uppercase transition-all duration-200 hover:bg-green-800 hover:text-white focus-ring min-h-[44px]"
            >
              {expanded ? 'Hide details' : 'View details'}
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded region — offerings inline (no modal). */}
      <div id={regionId} role="region" aria-labelledby={btnId} hidden={!expanded} className="mt-6">
        {hasTiers ? (
          <div className="flex flex-col gap-4">
            {tiers.map((tier) => (
              <OfferingRow
                key={tier.id}
                tier={tier}
                saved={isSaved(tier)}
                onSave={() => onSave(family, tier)}
                onSubmit={() => onSubmit(family, tier)}
              />
            ))}
          </div>
        ) : (
          // Quote-based family: no purchasable tiers → explain + "Talk to us".
          <div className="border border-green-800/12 bg-white p-7 max-w-2xl">
            <p className="body-text text-base">
              {family.emptyState?.line ??
                'This one is arranged personally, priced to what you need. Tell us what you are after and we will map it out with you.'}
            </p>
            <Link to="/contact" className="btn-primary mt-6">
              Talk to us
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Shop() {
  const meta = seo();
  const navigate = useNavigate();
  const { addItem, isSelected, setFunnel } = useCart();

  // Which family sections are expanded in place (multiple allowed). Riding
  // Lessons opens by default so the page never reads as a wall of closed cards.
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set(['riding-lessons']));

  // Keep the checkout back-link honest for whatever they add from here.
  useEffect(() => {
    setFunnel('rider');
  }, [setFunnel]);

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Save it — adds to the saved selection (cart); stays on the page so they can
  // keep browsing. The header cart icon reflects the new count.
  function handleSave(family: ShopFamily, tier: ServiceTier) {
    addItem(toCartItem(family, tier));
  }

  // Submit inquiry — adds AND goes to checkout (the category-personalized inquiry).
  function handleSubmit(family: ShopFamily, tier: ServiceTier) {
    addItem(toCartItem(family, tier));
    navigate('/checkout');
  }

  const isSaved = (family: ShopFamily, tier: ServiceTier) =>
    isSelected(toCartItem(family, tier).offeringId);

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

      {/* ── Catalog: family sections that expand in place (no modal) ─────── */}
      <section className="bg-cream">
        <div className="container-site pb-24 sm:pb-32 pt-8 sm:pt-10 space-y-16 sm:space-y-24">
          {FAMILIES.map((family) => (
            <FamilySection
              key={family.key}
              family={family}
              expanded={openKeys.has(family.key)}
              onToggle={() => toggle(family.key)}
              isSaved={(tier) => isSaved(family, tier)}
              onSave={handleSave}
              onSubmit={handleSubmit}
            />
          ))}
        </div>
      </section>
    </>
  );
}
