import { useEffect, useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { fetchOfferings } from '../lib/api';
import { formatPrice } from '../lib/services';
import { useCart } from '../contexts/CartContext';
import type { Offering, Segment } from '../lib/types';

/**
 * OFFERING CATALOG — the single, offerings-backed catalog surface, read from the
 * `offerings` table (fetchOfferings, active only). Groups by segment → service
 * family, renders each purchasable offering with its live price, and adds to the
 * shared cart. Used by both the public Shop and the in-app catalog so there is ONE
 * catalog, driven by the database — no hardcoded service lists.
 */

const SEGMENTS: { key: Segment; label: string; blurb: string }[] = [
  { key: 'rider', label: 'For the rider', blurb: 'Lessons, training, and horsemanship.' },
  { key: 'horse', label: 'For your horse', blurb: 'Care, exercise, training, and clipping.' },
  { key: 'acquisition', label: 'Buying, selling & leasing', blurb: 'Evaluation, brokering, and acquisition help.' },
];

const familyLabel = (serviceType: string | null) =>
  (serviceType ?? 'Other').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function OfferingCatalog({ onCheckout }: { onCheckout?: () => void }) {
  const [offerings, setOfferings] = useState<Offering[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addItem, isSelected } = useCart();

  useEffect(() => {
    fetchOfferings().then(setOfferings).catch((e) => setError(e instanceof Error ? e.message : 'Could not load the catalog.'));
  }, []);

  // group: segment → service family → offerings
  const bySegment = useMemo(() => {
    const map = new Map<Segment, Map<string, Offering[]>>();
    for (const o of offerings ?? []) {
      if (o.price_amount == null) continue;   // only truly purchasable rows have a price
      const fam = map.get(o.segment) ?? map.set(o.segment, new Map()).get(o.segment)!;
      const key = o.service_type ?? 'other';
      (fam.get(key) ?? fam.set(key, []).get(key)!).push(o);
    }
    return map;
  }, [offerings]);

  const add = (o: Offering) => {
    addItem({
      offeringId: o.id,
      offeringName: o.name,
      serviceType: o.service_type,
      price: o.price_amount ?? 0,
      unit: (o.price_unit ?? 'flat'),
    });
  };

  if (error) return <p role="alert" className="form-error">{error}</p>;
  if (offerings === null) return <p className="body-text text-muted text-sm">Loading the catalog…</p>;

  return (
    <div className="flex flex-col gap-10">
      {SEGMENTS.map(({ key, label, blurb }) => {
        const families = bySegment.get(key);
        if (!families || families.size === 0) return null;
        return (
          <section key={key}>
            <h2 className="font-serif text-2xl text-green-900">{label}</h2>
            <p className="text-sm text-muted mb-4">{blurb}</p>
            <div className="flex flex-col gap-6">
              {[...families.entries()].map(([fam, items]) => (
                <div key={fam}>
                  <p className="text-[11px] uppercase tracking-wide text-gold-800 font-semibold mb-2">{familyLabel(fam)}</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((o) => {
                      const selected = isSelected(o.id);
                      return (
                        <div key={o.id} className="bg-white border border-green-800/10 rounded-xl p-4 flex flex-col">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-serif text-green-900 text-[15px] font-semibold leading-tight">{o.name}</p>
                            {o.is_popular && <span className="text-[9px] uppercase tracking-wide bg-gold-100 text-gold-800 rounded px-1.5 py-0.5 shrink-0">Popular</span>}
                          </div>
                          {(o.tagline || o.description) && (
                            <p className="text-[12px] text-muted mb-3 line-clamp-3">{o.tagline || o.description}</p>
                          )}
                          <div className="mt-auto flex items-center justify-between gap-2">
                            <span className="font-serif text-green-800">
                              {formatPrice(o.price_amount ?? 0, (o.price_unit ?? 'flat'))}
                            </span>
                            <button type="button" onClick={() => add(o)} disabled={selected}
                              className={`inline-flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 focus-ring ${
                                selected ? 'bg-green-50 text-green-800 border border-green-300' : 'bg-green-800 text-white hover:bg-green-700'}`}>
                              {selected ? <><Check size={13} /> In cart</> : <><Plus size={13} /> Add</>}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {onCheckout && (
        <div className="sticky bottom-4 flex justify-end">
          <CartBar onCheckout={onCheckout} />
        </div>
      )}
    </div>
  );
}

/** A compact cart summary + checkout button; hidden when the cart is empty. */
function CartBar({ onCheckout }: { onCheckout: () => void }) {
  const { state, subtotal } = useCart();
  if (state.items.length === 0) return null;
  return (
    <button type="button" onClick={onCheckout}
      className="inline-flex items-center gap-3 bg-green-800 text-white rounded-full pl-5 pr-4 py-2.5 shadow-lg hover:bg-green-700 focus-ring">
      <span className="text-sm font-medium">{state.items.length} item{state.items.length > 1 ? 's' : ''}</span>
      <span className="text-sm tabular-nums">${subtotal.toLocaleString()}</span>
      <span className="text-sm font-semibold">Checkout →</span>
    </button>
  );
}
