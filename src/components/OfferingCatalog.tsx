import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Check } from 'lucide-react';
import { fetchOfferings } from '../lib/api';
import { formatPrice } from '../lib/services';
import { useCart } from '../contexts/CartContext';
import type { Offering, Segment, PriceUnitDb } from '../lib/types';

/**
 * OFFERING CATALOG — the single, offerings-backed catalog surface, read from the
 * `offerings` table (fetchOfferings, active only). Rendered in the boutique
 * editorial style: each service FAMILY is a hero card (image slot + name + line)
 * that EXPANDS IN PLACE to reveal its offerings as rows (name · description ·
 * prominent gold-accented price · action). Used by both the public Shop and the
 * in-app catalog — one catalog, database-driven, no hardcoded service lists.
 *
 * The primary action is configurable: the public shop "Inquire"s (adds + goes to
 * the by-appointment /checkout); the in-app catalog "Add"s to cart for the real
 * authenticated purchase flow.
 */

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'rider', label: 'For the rider' },
  { key: 'horse', label: 'For your horse' },
  { key: 'acquisition', label: 'Buying, selling & leasing' },
];

// Warm family names + one-line blurbs, keyed by service_type.
const FAMILY: Record<string, { name: string; line: string }> = {
  RIDING_LESSON: { name: 'Riding lessons', line: 'Private instruction on our horses — from a first lesson to a standing spot in the ring.' },
  JUMPER_TRAINING: { name: 'Hunter / jumper', line: 'Focused jumping instruction and monthly training for horse and rider together.' },
  HORSEMANSHIP_TRAINING: { name: 'Horsemanship', line: 'Groundwork and stable craft — the quiet skills that make a real horseperson.' },
  HORSE_TRAINING: { name: 'Horse training', line: 'Professional schooling for your own horse, by the session or on a monthly program.' },
  HORSE_EXERCISE: { name: 'Exercise & turnout', line: 'Keeping your horse fit and moving when you can’t be at the barn.' },
  HORSE_CLIPPING: { name: 'Clipping', line: 'Show-ready trace, bridle-path, and full body clips.' },
  HORSE_EVALUATION: { name: 'Evaluation', line: 'Pre-purchase and lease evaluations — an honest read before you commit.' },
  HORSE_PURCHASE_ASSISTANCE: { name: 'Acquisition help', line: 'Brokering and lease arrangement, handled end to end.' },
  HORSE_FINDER: { name: 'Horse locator', line: 'We search on your behalf and bring you the right horses.' },
};
const familyMeta = (serviceType: string | null) =>
  FAMILY[serviceType ?? ''] ?? { name: (serviceType ?? 'Other').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), line: '' };

/** Split a formatted "$150 / lesson" into amount + unit so the unit can be
 *  gold-accented and smaller. */
function splitPrice(amount: number, unit: PriceUnitDb) {
  const full = formatPrice(amount, unit);
  const slash = full.indexOf(' / ');
  if (slash !== -1) return { amount: full.slice(0, slash), unit: full.slice(slash + 1).trim() };
  if (unit === 'percent') return { amount: full, unit: '' };
  return { amount: full, unit: 'one-time' };
}

function PriceTag({ o }: { o: Offering }) {
  // Active offerings without a set price are quote-based — show "Inquire for pricing".
  if (o.price_amount == null) {
    return <p className="font-serif text-green-800 leading-none text-lg sm:text-xl italic">Inquire for pricing</p>;
  }
  const { amount, unit } = splitPrice(o.price_amount, o.price_unit ?? 'flat');
  return (
    <p className="font-serif text-green-800 leading-none text-2xl sm:text-3xl">
      {amount}
      {unit && <span className="ml-1.5 font-sans text-[0.5em] tracking-wide uppercase text-gold-800 align-baseline">/ {unit}</span>}
    </p>
  );
}

export function OfferingCatalog({ onCheckout, actionLabel = 'Add' }: { onCheckout?: () => void; actionLabel?: string }) {
  const [offerings, setOfferings] = useState<Offering[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const { addItem, isSelected } = useCart();

  useEffect(() => {
    fetchOfferings()
      .then((rows) => {
        setOfferings(rows);
        // open the first family so the page never reads as a wall of closed cards.
        const first = rows[0]?.service_type;
        if (first) setOpen(new Set([first]));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the catalog.'));
  }, []);

  // group: segment → service family (service_type) → offerings. fetchOfferings
  // already filters to active rows; priced ones sort by price, quote-based
  // (price-less) ones sort to the end.
  const bySegment = useMemo(() => {
    const map = new Map<Segment, Map<string, Offering[]>>();
    for (const o of offerings ?? []) {
      const fam = map.get(o.segment) ?? map.set(o.segment, new Map()).get(o.segment)!;
      const key = o.service_type ?? 'other';
      (fam.get(key) ?? fam.set(key, []).get(key)!).push(o);
    }
    for (const fam of map.values()) for (const items of fam.values())
      items.sort((a, b) => (a.price_amount ?? Infinity) - (b.price_amount ?? Infinity));
    return map;
  }, [offerings]);

  const toggle = (key: string) => setOpen((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const act = (o: Offering) => {
    addItem({ offeringId: o.id, offeringName: o.name, serviceType: o.service_type, price: o.price_amount ?? 0, unit: (o.price_unit ?? 'flat') });
    if (onCheckout) onCheckout();
  };
  const save = (o: Offering) => addItem({ offeringId: o.id, offeringName: o.name, serviceType: o.service_type, price: o.price_amount ?? 0, unit: (o.price_unit ?? 'flat') });

  if (error) return <p role="alert" className="form-error">{error}</p>;
  if (offerings === null) return <p className="body-text text-muted text-sm">Loading the catalog…</p>;

  return (
    <div className="space-y-16 sm:space-y-24">
      {SEGMENTS.map(({ key, label }) => {
        const families = bySegment.get(key);
        if (!families || families.size === 0) return null;
        return (
          <div key={key}>
            <p className="eyebrow mb-6">{label}</p>
            <div className="space-y-16 sm:space-y-24">
              {[...families.entries()].map(([fam, items]) => (
                <FamilySection key={fam} serviceType={fam} items={items}
                  expanded={open.has(fam)} onToggle={() => toggle(fam)}
                  isSelected={isSelected} onSave={save} onAct={act} actionLabel={actionLabel} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A family "hero card" that expands in place to reveal its offering rows. */
function FamilySection({
  serviceType, items, expanded, onToggle, isSelected, onSave, onAct, actionLabel,
}: {
  serviceType: string;
  items: Offering[];
  expanded: boolean;
  onToggle: () => void;
  isSelected: (id: string) => boolean;
  onSave: (o: Offering) => void;
  onAct: (o: Offering) => void;
  actionLabel: string;
}) {
  const meta = familyMeta(serviceType);
  const regionId = `family-region-${serviceType}`;
  const btnId = `family-toggle-${serviceType}`;
  return (
    <section className="scroll-mt-28" aria-labelledby={`family-${serviceType}`}>
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Media slot — deep-green textural placeholder until real media is added. */}
        <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[340px] overflow-hidden bg-green-900 order-1 lg:order-none">
          <div className="absolute inset-0 bg-gradient-to-br from-green-800 via-green-900 to-green-950" aria-hidden="true" />
          <div className="qs-grain absolute inset-0 opacity-[0.07]" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 border border-gold-600/20" aria-hidden="true" />
          <div className="absolute inset-0 flex items-end p-5">
            <span className="text-on-dark-soft text-[10px] font-sans tracking-widest uppercase">{`SWAP · ${meta.name.toLowerCase()} image`}</span>
          </div>
        </div>
        {/* Text side */}
        <div className="flex flex-col justify-center bg-white border border-green-800/12 lg:border-l-0 p-7 sm:p-10">
          <h3 id={`family-${serviceType}`} className="font-display font-medium text-green-900 text-3xl sm:text-4xl leading-tight">{meta.name}</h3>
          {meta.line && <p className="body-text text-base sm:text-lg mt-3 max-w-md">{meta.line}</p>}
          <div className="mt-7">
            <button id={btnId} type="button" aria-expanded={expanded} aria-controls={regionId} onClick={onToggle}
              className="group inline-flex items-center gap-2.5 px-6 py-3 border border-green-800 text-green-900 font-sans text-xs font-medium tracking-widest uppercase transition-all duration-200 hover:bg-green-800 hover:text-white focus-ring min-h-[44px]">
              {expanded ? 'Hide details' : 'View details'}
              <ChevronDown size={16} aria-hidden="true" className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div id={regionId} role="region" aria-labelledby={btnId} hidden={!expanded} className="mt-6">
        <div className="flex flex-col gap-4">
          {items.map((o) => (
            <OfferingRow key={o.id} o={o} saved={isSelected(o.id)} onSave={() => onSave(o)} onAct={() => onAct(o)} actionLabel={actionLabel} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** One offering row inside an expanded family: name · description · price · actions. */
function OfferingRow({
  o, saved, onSave, onAct, actionLabel,
}: {
  o: Offering;
  saved: boolean;
  onSave: () => void;
  onAct: () => void;
  actionLabel: string;
}) {
  return (
    <div className="bg-white border border-green-800/12 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
      <div className="min-w-0 flex-1">
        <p className="font-serif font-medium text-green-900 text-lg sm:text-xl leading-snug">
          {o.name}
          {o.is_popular && (
            <span className="ml-2 align-middle text-[9px] font-sans font-medium tracking-widest uppercase text-gold-800 border border-gold-600/40 px-1.5 py-0.5">Most chosen</span>
          )}
        </p>
        {(o.tagline || o.description) && <p className="text-sm text-muted mt-1.5 leading-relaxed">{o.tagline || o.description}</p>}
        {o.note && <p className="text-xs text-gold-ink mt-1.5">{o.note}</p>}
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end sm:gap-6 shrink-0">
        <PriceTag o={o} />
        <div className="flex items-center gap-2.5">
          {/* Quote-based (price-less) offerings are inquiry-only — no "Save it" to a
              purchase cart, and the primary action always reads "Inquire". */}
          {o.price_amount != null && (
            <button type="button" onClick={onSave} aria-pressed={saved}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border font-sans text-xs font-medium tracking-widest uppercase transition-all duration-200 focus-ring min-h-[44px] whitespace-nowrap ${
                saved ? 'border-green-800 bg-green-800/5 text-green-900' : 'border-green-800/40 text-green-900 hover:border-green-800'}`}>
              {saved ? <><Check size={14} aria-hidden="true" /> Saved</> : 'Save it'}
            </button>
          )}
          <button type="button" onClick={onAct}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-green-800 text-white font-sans text-xs font-medium tracking-widest uppercase transition-all duration-200 hover:bg-green-700 focus-ring min-h-[44px] whitespace-nowrap">
            {o.price_amount == null ? 'Inquire' : actionLabel}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
