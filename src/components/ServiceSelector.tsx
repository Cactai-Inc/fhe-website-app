import { Check } from 'lucide-react';
import { formatPrice, type PriceUnit } from '../lib/pricing';
import type { ServiceGroup } from '../lib/publicCatalog';
import { useCart } from '../contexts/CartContext';
import type { CartItem } from '../contexts/CartContext';

interface ServiceSelectorProps {
  /** A service_type group with its live SKUs (from public_offerings). */
  group: ServiceGroup;
  /** Eyebrow category label shown above the service name (e.g. "Rider Services"). */
  category?: string;
  /** Compact variant for inline cross-sell/add-on suggestions. */
  compact?: boolean;
  /** Optional small label above the offering grid (used by add-on suggestions). */
  label?: string;
}

/**
 * Shared service + offering selector used by every booking funnel.
 *
 * Each offering (a flat purchasable SKU from the DB catalog, rendered here as a
 * card under its service_type group) toggles independently in/out of the cart.
 * Selecting an active offering again deselects it. No tiers — every offering IS
 * the purchasable item. Semantics are exposed with role="radio"/aria-checked
 * inside a labelled role="radiogroup".
 */
export default function ServiceSelector({
  group,
  category = 'Service',
  compact = false,
  label = '',
}: ServiceSelectorProps) {
  const { toggleItem, isSelected } = useCart();
  const groupLabelId = `svc-${group.code}-label`;

  // The SKU's mechanics, shown as a small hint (replaces the old tier description).
  const mechanics = (o: ServiceGroup['offerings'][number]): string => {
    if (o.config_kind === 'recurring' && o.weekly_frequency) return `${o.weekly_frequency}× weekly · monthly`;
    if (o.config_kind === 'scheduled' && (o.unit_count ?? 1) > 1) return `${o.unit_count} sessions`;
    return o.tagline ?? '';
  };

  return (
    <div className={compact ? '' : 'border border-green-800/10 bg-white p-6 sm:p-8'}>
      {!compact && (
        <>
          <p className="eyebrow mb-2">{category}</p>
          <h3 id={groupLabelId} className="heading-card text-green-800 mb-1">
            {group.name}
          </h3>
          {group.tagline && <p className="font-serif italic text-gold-ink mb-3 text-[0.95rem]">{group.tagline}</p>}
        </>
      )}
      {compact && (
        <>
          <h3 id={groupLabelId} className="font-serif font-medium text-green-800 text-lg mb-1">
            {group.name}
          </h3>
          {group.tagline && <p className="text-sm font-sans text-muted mb-4">{group.tagline}</p>}
        </>
      )}
      {label && (
        <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-ink mb-3">{label}</p>
      )}

      <div role="radiogroup" aria-labelledby={groupLabelId} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {group.offerings.map((o) => {
          const selected = isSelected(o.id);
          // COUNTFIX 1.5: quote-priced SKUs are real services and are now offered
          // here (fetchPublicCatalog no longer drops them). They read
          // "Inquire for pricing" — the same wording OfferingCatalog uses on
          // /shop — instead of formatting a null price as "$0".
          const onEnquiry = o.price_amount == null;
          const item: CartItem = {
            offeringId: o.id,
            offeringName: o.name,
            serviceType: o.service_type,
            price: o.price_amount ?? 0,
            unit: (o.price_unit ?? 'flat') as PriceUnit,
            configKind: o.config_kind,
            weeklyFrequency: o.weekly_frequency,
            unitCount: o.unit_count,
            ...(onEnquiry ? { priceOnEnquiry: true } : {}),
          };
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => toggleItem(item)}
              className={`selectable-card ${selected ? 'selectable-card-selected' : 'selectable-card-unselected'}`}
            >
              {o.is_popular && (
                <span className="absolute top-3 right-3 text-[9px] font-sans font-medium tracking-wider uppercase bg-gold-600 text-green-900 px-2 py-0.5">
                  Popular
                </span>
              )}
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-sm font-sans font-medium text-green-900 pr-8">{o.name}</span>
                <div
                  aria-hidden="true"
                  className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${
                    selected ? 'bg-green-800 border-green-800' : 'border-green-800/30'
                  }`}
                >
                  {selected && <Check size={10} className="text-white" />}
                </div>
              </div>
              {mechanics(o) && <p className="text-xs font-sans text-muted mb-3 leading-snug">{mechanics(o)}</p>}
              <p className={`text-base font-serif font-medium text-green-800${onEnquiry ? ' italic' : ''}`}>
                {onEnquiry
                  ? 'Inquire for pricing'
                  : formatPrice(o.price_amount as number, (o.price_unit ?? 'flat') as PriceUnit)}
              </p>
              {o.note && <p className="text-[10px] font-sans text-gold-ink mt-1">{o.note}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
