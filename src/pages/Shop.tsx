import { useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, ShoppingBag, Check, X } from 'lucide-react';
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

/* ── Ways to ride with us — the hybrid accordion catalog ─────────────────────
 *
 * A by-appointment, white-glove catalog. Service FAMILIES are vertical,
 * multiple-open accordion panels. Each panel reveals its tiers as priced cards
 * with the LOWEST-priced option shown LARGEST (the entry price is the hero
 * number), the rest stepping down. "View details" opens a tier modal that reads
 * (never buys); the two actions there are Add to cart (stay + keep browsing)
 * and Request this now (add + go to /checkout). NO auto-add on open.
 *
 * Prices are never hardcoded here — every tier comes from src/lib/services.ts,
 * the same source Lessons.tsx uses.
 *
 * SSR-safe: the modal renders null when closed; useCart's persistence is guarded
 * for `window`. No window/document access at module or render top-level.
 */

const seo = () => seoForPath('/shop')!;

// Deep-green textural placeholder for tier media — {/* SWAP: real library media *​/}
// A tasteful green panel (NOT stock) until the owner adds real images/video.
const MEDIA_SWAP_LABEL = 'A photograph or short clip will live here';

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
// Lowest price first (the hero number), the rest stepping down.

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
  return {
    serviceId: sourceServiceId,
    serviceName: sourceServiceName,
    tierId: tier.id,
    tierLabel: tier.label,
    price: tier.price,
    unit: tier.unit,
  };
}

// ─── The by-appointment explanation (shared: reassurance block + modal) ──────
const APPOINTMENT_EXPLAINER =
  "Send your request and we'll call to learn about you and talk through the right fit. Then we send your approval to book and pay online. It's quick, personal, and the way we make sure it's right for you.";

// ─── Squared-edge accessible modal (brand: no rounded corners) ───────────────
// Focus trap, Esc-to-close, backdrop close, aria-modal. Renders null when
// closed (SSR-safe). Full-width at 390px.

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function ShopModal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const root = dialogRef.current;
    const firstFocusable = root?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? root)?.focus();
    // Lock body scroll while the modal is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-green-950/60 p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col bg-cream border-t sm:border border-gold-600/30 shadow-2xl focus:outline-none"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-green-800/10 px-6 sm:px-8 py-5 flex-shrink-0">
          <h2 className="font-display font-semibold text-green-900 text-2xl sm:text-3xl leading-tight pr-2">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] -mr-2 -mt-1 flex items-center justify-center text-green-800/50 hover:text-green-900 transition-colors focus-ring"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {/* Body (scrolls) */}
        <div className="overflow-y-auto px-6 sm:px-8 py-6">{children}</div>

        {/* Footer actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-green-800/10 px-6 sm:px-8 py-5 flex-shrink-0 bg-cream">
          {footer}
        </div>
      </div>
    </div>
  );
}

// ─── Tier price row (used inside the panel and the modal) ────────────────────
// The lowest price (index 0) renders largest; the rest step down.

function TierPriceList({
  tiers,
  onView,
  variant,
}: {
  tiers: ServiceTier[];
  onView: (tier: ServiceTier) => void;
  variant: 'panel' | 'modal';
}) {
  return (
    <ul className="flex flex-col divide-y divide-green-800/10 border-y border-green-800/10">
      {tiers.map((tier, i) => {
        const { amount, unit } = splitPrice(tier);
        const isHero = i === 0; // lowest-priced → largest
        // Step the amount size down for lower rows.
        const amountSize = isHero
          ? 'text-4xl sm:text-5xl'
          : i === 1
            ? 'text-2xl sm:text-3xl'
            : 'text-xl sm:text-2xl';
        return (
          <li
            key={tier.id}
            className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2 py-5"
          >
            <div className="min-w-0 flex-1">
              <p className="font-sans font-medium text-green-900 leading-snug">
                {tier.label}
                {tier.popular && (
                  <span className="ml-2 align-middle text-[9px] font-sans font-medium tracking-wider uppercase text-gold-800 border border-gold-600/40 px-1.5 py-0.5">
                    Most chosen
                  </span>
                )}
              </p>
              <p className="text-sm text-muted mt-1 leading-relaxed">{tier.description}</p>
              {variant === 'modal' && tier.note && (
                <p className="text-xs text-gold-ink mt-1.5">{tier.note}</p>
              )}
            </div>

            <div className="flex items-baseline gap-3 shrink-0">
              <p className={`font-serif text-green-800 leading-none ${amountSize}`}>
                {amount}
                {unit && (
                  <span className="ml-1.5 font-sans text-[0.5em] tracking-wide uppercase text-gold-800 align-baseline">
                    / {unit}
                  </span>
                )}
              </p>
              {variant === 'panel' && (
                <button
                  type="button"
                  onClick={() => onView(tier)}
                  className="link-underline whitespace-nowrap"
                >
                  View details
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Accordion panel for one family ──────────────────────────────────────────

function FamilyPanel({
  family,
  expanded,
  onToggle,
  onView,
}: {
  family: ShopFamily;
  expanded: boolean;
  onToggle: () => void;
  onView: (family: ShopFamily, tier: ServiceTier) => void;
}) {
  const tiers = sortedByPrice(family.service.tiers);
  const hasTiers = tiers.length > 0;
  const panelId = `family-panel-${family.key}`;
  const btnId = `family-button-${family.key}`;

  return (
    <div className="border-b border-green-800/15">
      <h3>
        <button
          id={btnId}
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="group w-full flex items-center justify-between gap-5 text-left py-7 sm:py-8 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-800 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
        >
          <span className="min-w-0">
            <span className="block font-display font-semibold text-green-900 text-2xl sm:text-4xl leading-tight">
              {family.name}
            </span>
            <span className="block body-text text-sm sm:text-base mt-1.5 sm:mt-2 max-w-xl">
              {family.line}
            </span>
          </span>
          <span
            className="shrink-0 flex items-center justify-center w-11 h-11 border border-gold-600/40 text-green-800 transition-transform duration-300 group-hover:border-gold-600"
            aria-hidden="true"
          >
            <ChevronDown
              size={20}
              className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </span>
        </button>
      </h3>

      {/* Expanded region */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={btnId}
        hidden={!expanded}
        className="pb-9 sm:pb-12"
      >
        {family.note && (
          <p className="body-text text-sm border-l-2 border-gold-600 pl-4 mb-6 max-w-2xl">
            {family.note}
          </p>
        )}

        {hasTiers ? (
          <TierPriceList
            tiers={tiers}
            onView={(tier) => onView(family, tier)}
            variant="panel"
          />
        ) : (
          // Quote-based family: no purchasable tiers → explain + "Talk to us".
          <div className="border border-green-800/10 bg-white p-6 max-w-2xl">
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
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Shop() {
  const meta = seo();
  const navigate = useNavigate();
  const { addItem, isSelected, itemCount, setFunnel } = useCart();

  // Multiple panels open at once — start with Riding Lessons open as the hero.
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set(['riding-lessons']));

  // Active tier for the detail modal (null = closed). Opening = reading only.
  const [active, setActive] = useState<{ family: ShopFamily; tier: ServiceTier } | null>(null);
  const [justAdded, setJustAdded] = useState(false);

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

  function openTier(family: ShopFamily, tier: ServiceTier) {
    setJustAdded(false);
    setActive({ family, tier });
  }

  function closeModal() {
    setActive(null);
    setJustAdded(false);
  }

  // Add to cart — stays open so they can keep browsing; shows confirmation.
  function handleAdd() {
    if (!active) return;
    addItem(toCartItem(active.family, active.tier));
    setJustAdded(true);
  }

  // Request this now — add AND go to checkout.
  function handleRequestNow() {
    if (!active) return;
    addItem(toCartItem(active.family, active.tier));
    navigate('/checkout');
  }

  const activeSelected =
    active !== null &&
    isSelected(toCartItem(active.family, active.tier).serviceId, active.tier.id);

  return (
    <>
      <Seo title={meta.title} description={meta.description} path="/shop" service={meta.service} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="bg-cream">
        <div className="container-site pt-32 pb-10 sm:pt-40 sm:pb-14">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="eyebrow mb-5">Ways to Ride</p>
              <h1 className="heading-display text-green-900 text-[clamp(2.5rem,6vw,4.5rem)]">
                Ways to ride with us.
              </h1>
              <p className="body-text mt-7 text-lg max-w-xl">
                However you would like to begin — a first lesson, a standing place
                in the community, or care for a horse of your own — here is
                everything, and what it costs. Open a section to explore.
              </p>
            </div>

            {/* Persistent cart affordance → /checkout */}
            {itemCount > 0 && (
              <Link
                to="/checkout"
                className="inline-flex items-center gap-2.5 px-5 py-3 border border-green-800/20 bg-white text-green-900 font-sans text-sm hover:border-green-800/50 transition-colors focus-ring"
                aria-label={`${itemCount} in your request — go to checkout`}
              >
                <span className="relative">
                  <ShoppingBag size={18} aria-hidden="true" />
                  <span className="absolute -top-2 -right-2 w-4 h-4 bg-gold-600 text-green-900 text-[9px] flex items-center justify-center font-medium">
                    {itemCount}
                  </span>
                </span>
                <span className="tracking-wide">Your request</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── By-appointment reassurance (white-glove, not fine print) ─────── */}
      <section className="bg-cream">
        <div className="container-site pb-12 sm:pb-16">
          <div className="border-l-2 border-gold-600 bg-white/60 pl-6 sm:pl-8 pr-6 py-7 sm:py-8 max-w-3xl">
            <p className="eyebrow mb-3">By Appointment</p>
            <p className="font-serif text-green-900 text-xl sm:text-2xl leading-snug">
              Every lesson, program, and service is by appointment, arranged
              personally.
            </p>
            <p className="body-text mt-4 text-base max-w-2xl">
              {APPOINTMENT_EXPLAINER}
            </p>
          </div>
        </div>
      </section>

      {/* ── Accordion catalog ───────────────────────────────────────────── */}
      <section className="bg-cream">
        <div className="container-site pb-24 sm:pb-32">
          <div className="border-t border-green-800/15">
            {FAMILIES.map((family) => (
              <FamilyPanel
                key={family.key}
                family={family}
                expanded={openKeys.has(family.key)}
                onToggle={() => toggle(family.key)}
                onView={openTier}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Tier detail modal ───────────────────────────────────────────── */}
      <ShopModal
        open={active !== null}
        onClose={closeModal}
        title={active?.tier.label ?? ''}
        footer={
          active && (
            <>
              <button
                type="button"
                onClick={handleAdd}
                aria-live="polite"
                className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 border font-sans text-sm font-medium tracking-wide uppercase transition-all duration-200 focus-ring ${
                  justAdded || activeSelected
                    ? 'border-green-800 bg-green-800/5 text-green-900'
                    : 'border-green-800 text-green-900 hover:bg-green-800/5'
                }`}
              >
                {justAdded || activeSelected ? (
                  <>
                    <Check size={16} aria-hidden="true" />
                    In your request
                  </>
                ) : (
                  'Add to cart'
                )}
              </button>
              <button
                type="button"
                onClick={handleRequestNow}
                className="btn-primary"
              >
                Request this now
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </>
          )
        }
      >
        {active && (
          <div>
            <p className="eyebrow mb-3">{active.family.name}</p>

            {/* Media swap slot — {/* SWAP: real photo/video from the library *​/}
                A tasteful deep-green textural placeholder (NOT stock) for now. */}
            <div className="relative aspect-[16/9] overflow-hidden bg-green-900 mb-6">
              {/* SWAP: real photograph or short clip of this offering */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-green-800 via-green-900 to-green-950"
                aria-hidden="true"
              />
              <div className="qs-grain absolute inset-0 opacity-[0.08]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-0 border border-gold-600/25" aria-hidden="true" />
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                <p className="text-on-dark-soft text-xs font-sans tracking-widest uppercase">
                  {MEDIA_SWAP_LABEL}
                </p>
              </div>
            </div>

            <p className="body-text text-base">{active.family.service.description}</p>

            {active.family.note && (
              <p className="body-text text-sm border-l-2 border-gold-600 pl-4 mt-5">
                {active.family.note}
              </p>
            )}

            {/* How it's purchased & fulfilled */}
            <div className="mt-7 pt-6 border-t border-green-800/10">
              <p className="eyebrow mb-2">How it works</p>
              <p className="body-text text-sm">{APPOINTMENT_EXPLAINER}</p>
            </div>

            {/* Price list — lowest largest — with this tier surfaced first. */}
            <div className="mt-7 pt-6 border-t border-green-800/10">
              <p className="eyebrow mb-4">Pricing</p>
              <TierPriceList
                tiers={sortedByPrice(active.family.service.tiers)}
                onView={() => {}}
                variant="modal"
              />
            </div>
          </div>
        )}
      </ShopModal>
    </>
  );
}
