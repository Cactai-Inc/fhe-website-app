import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { fetchOfferings, fetchServiceCategories, type ServiceCategory } from '../lib/api';
import { formatPrice } from '../lib/services';
import { useCart } from '../contexts/CartContext';
import type { Offering, PriceUnitDb } from '../lib/types';

/**
 * OFFERING CATALOG — a category GRID that opens a modal per category to shop its
 * items, like a traditional catalog. Categories are service_types (cover image +
 * description + card_weight); items are the offerings within. Featured categories
 * (card_weight 2) render as larger cards. Desktop = a bento grid; mobile = a
 * stacked column. Everything is database-driven (fetchOfferings + fetchServiceCategories).
 *
 * The primary action is configurable: public Shop "Inquire"s (adds + /checkout);
 * the in-app catalog "Book it"s (adds + the authenticated /app/checkout purchase).
 */

// ── price rendering ──
function splitPrice(amount: number, unit: PriceUnitDb) {
  const full = formatPrice(amount, unit);
  const slash = full.indexOf(' / ');
  if (slash !== -1) return { amount: full.slice(0, slash), unit: full.slice(slash + 1).trim() };
  if (unit === 'percent') return { amount: full, unit: '' };
  return { amount: full, unit: 'one-time' };
}
function PriceTag({ o }: { o: Offering }) {
  if (o.price_amount == null) return <p className="font-serif text-green-800 text-lg italic">Inquire for pricing</p>;
  const { amount, unit } = splitPrice(o.price_amount, o.price_unit ?? 'flat');
  return (
    <p className="font-serif text-green-800 leading-none text-xl sm:text-2xl">
      {amount}
      {unit && <span className="ml-1.5 font-sans text-[0.55em] tracking-wide uppercase text-gold-800 align-baseline">/ {unit}</span>}
    </p>
  );
}

/** The deep-green textural placeholder cover, until real media is uploaded. */
function CoverPlaceholder({ label }: { label: string }) {
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-green-800 via-green-900 to-green-950" aria-hidden="true" />
      <div className="qs-grain absolute inset-0 opacity-[0.07]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 border border-gold-600/20" aria-hidden="true" />
      <div className="absolute inset-0 flex items-end p-4">
        <span className="text-on-dark-soft text-[10px] font-sans tracking-widest uppercase">{`SWAP · ${label.toLowerCase()} image`}</span>
      </div>
    </>
  );
}

export function OfferingCatalog({ onCheckout, actionLabel = 'Add' }: { onCheckout?: () => void; actionLabel?: string }) {
  const [offerings, setOfferings] = useState<Offering[] | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const { addItem, isSelected } = useCart();

  useEffect(() => {
    Promise.all([fetchOfferings(), fetchServiceCategories()])
      .then(([offs, cats]) => { setOfferings(offs); setCategories(cats); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the catalog.'));
  }, []);

  // offerings grouped by service_type; a category only appears if it has offerings.
  const byType = useMemo(() => {
    const map = new Map<string, Offering[]>();
    for (const o of offerings ?? []) {
      const key = o.service_type ?? 'other';
      (map.get(key) ?? map.set(key, []).get(key)!).push(o);
    }
    for (const items of map.values()) items.sort((a, b) => (a.price_amount ?? Infinity) - (b.price_amount ?? Infinity));
    return map;
  }, [offerings]);

  // categories with purchasable offerings, in the owner's explicit catalog_rank
  // order (card_weight controls SIZE, not order). fetchServiceCategories already
  // orders by catalog_rank then sort_order, so preserve that here.
  const cards = useMemo(() =>
    categories.filter((c) => byType.has(c.code)),
  [categories, byType]);

  const add = (o: Offering) => {
    addItem({ offeringId: o.id, offeringName: o.name, serviceType: o.service_type, price: o.price_amount ?? 0, unit: (o.price_unit ?? 'flat') });
  };

  if (error) return <p role="alert" className="form-error">{error}</p>;
  if (offerings === null) return <p className="body-text text-muted text-sm">Loading the catalog…</p>;

  const active = cards.find((c) => c.code === openCat) ?? null;

  return (
    <>
      {/* Uniform grid, fluid & full-width: 1 col on mobile, 2 on tablet, 3 on desktop.
          Every category is the same size, in strict catalog_rank order — no gaps. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <button key={c.code} type="button" onClick={() => setOpenCat(c.code)}
            className="group relative overflow-hidden rounded-xl text-left focus-ring border border-green-800/10 min-h-[240px] flex flex-col justify-end hover:brightness-105 transition-all">
            {c.cover_image_url
              ? <img src={c.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              : <CoverPlaceholder label={c.display_name} />}
            <div className="absolute inset-0 bg-gradient-to-t from-green-950/85 via-green-950/25 to-transparent" aria-hidden="true" />
            <div className="relative p-4 sm:p-5">
              <h3 className="font-serif text-white font-semibold leading-tight text-xl sm:text-2xl">{c.display_name}</h3>
              {c.description && <p className="text-white/80 text-[12.5px] mt-1.5 line-clamp-2">{c.description}</p>}
            </div>
          </button>
        ))}
      </div>

      {active && (
        <CategoryModal category={active} items={byType.get(active.code) ?? []}
          isSelected={isSelected} onAdd={add} onCheckout={onCheckout} actionLabel={actionLabel}
          onClose={() => setOpenCat(null)} />
      )}
    </>
  );
}

/** The per-category catalog modal: cover + name + description header, then the
 *  offerings as a list with per-item detail, price, and action. */
function CategoryModal({
  category, items, isSelected, onAdd, onCheckout, actionLabel, onClose,
}: {
  category: ServiceCategory;
  items: Offering[];
  isSelected: (id: string) => boolean;
  onAdd: (o: Offering) => void;
  onCheckout?: () => void;
  actionLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-green-950/50 p-0 sm:p-4" onClick={onClose}>
      {/* ~50% larger than before (was max-w-2xl / 672px → 5xl / 1024px). */}
      <div className="bg-cream w-full sm:max-w-5xl sm:rounded-2xl flex flex-col max-h-[100dvh] sm:max-h-[92dvh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header: cover + name + description */}
        <div className="relative shrink-0">
          <div className="relative h-56 sm:h-72 overflow-hidden">
            {category.cover_image_url
              ? <img src={category.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              : <CoverPlaceholder label={category.display_name} />}
            <div className="absolute inset-0 bg-gradient-to-t from-green-950/80 to-transparent" aria-hidden="true" />
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 grid place-items-center text-green-900 hover:bg-white focus-ring">
            <X size={18} />
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
            <h2 className="font-serif text-white text-2xl sm:text-3xl font-semibold leading-tight">{category.display_name}</h2>
          </div>
        </div>
        {category.description && <p className="text-sm text-secondary px-4 sm:px-5 pt-4">{category.description}</p>}

        {/* Item list */}
        <div className="overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-2.5">
          {items.map((o) => {
            const saved = isSelected(o.id);
            const priceless = o.price_amount == null;
            return (
              <div key={o.id} className="bg-white border border-green-800/10 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-serif font-medium text-green-900 text-[15px] leading-snug">
                    {o.name}
                    {o.is_popular && <span className="ml-2 align-middle text-[9px] font-sans tracking-widest uppercase text-gold-800 border border-gold-600/40 px-1.5 py-0.5">Most chosen</span>}
                  </p>
                  {(o.description || o.tagline) && <p className="text-[12.5px] text-muted mt-1 leading-relaxed">{o.description || o.tagline}</p>}
                  {o.note && <p className="text-[11px] text-gold-ink mt-1">{o.note}</p>}
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4 shrink-0">
                  <PriceTag o={o} />
                  <button type="button"
                    onClick={() => { onAdd(o); if (onCheckout && priceless) onCheckout(); }}
                    aria-pressed={!priceless && saved}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 font-sans text-xs font-medium tracking-widest uppercase transition-all focus-ring min-h-[44px] whitespace-nowrap ${
                      !priceless && saved ? 'border border-green-800 bg-green-800/5 text-green-900' : 'bg-green-800 text-white hover:bg-green-700'}`}>
                    {priceless ? 'Inquire' : saved ? <><Check size={14} /> Added</> : actionLabel}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: checkout when there's something in the cart */}
        {onCheckout && (
          <div className="shrink-0 border-t border-green-800/10 p-4 flex justify-end bg-cream">
            <button type="button" onClick={onCheckout} className="btn-primary">
              Go to checkout <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
