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
    // Plain "x" matches the offering names ("1x Weekly Lesson") — same voice.
    if (o.config_kind === 'recurring' && o.weekly_frequency) return `${o.weekly_frequency}x weekly · monthly`;
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

      {/* Two columns is right for a group of several offerings (Riding Lesson
          has 9, Horse Exercise 6). A group holding ONE offering — every
          acquisition service — must not sit in a 2-col grid, or the lone card
          renders half width. Single-offering groups go full width so they fill
          the vertical column BookSupport now places them in. */}
      <div role="radiogroup" aria-labelledby={groupLabelId} className={`grid gap-3 ${group.offerings.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {group.offerings.map((o) => {
          const selected = isSelected(o.id);
          // COUNTFIX 1.5: quote-priced SKUs are real services and are now offered
          // here (fetchPublicCatalog no longer drops them). They read
          // "Price on inquiry" — the same wording OfferingCatalog uses, and
          // the one American spelling (ASKRIGHT §A6) — instead of formatting a
          // null price as "$0".
          const onEnquiry = o.price_amount == null;
          const item: CartItem = {
            offeringId: o.id,
            offeringName: o.name,
            serviceType: o.service_type,
            // The catalog's own display_name for the service_type — page 2's
            // section headings and the inquire wording both read it, so
            // renaming a service in the DB renames them (D13).
            serviceTypeName: group.name,
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
              {/* Owner, 2026-08-16: the radio/checkmark dot is gone — "just
                  remove those they are a nuisance." Selection still reads
                  clearly from the card's own selected styling
                  (selectable-card-selected), and it is still announced properly
                  to assistive tech by role="radio" + aria-checked on the button
                  itself, so nothing is lost semantically. */}
              <div className="mb-2">
                <span className="text-sm font-sans font-medium text-green-900">{o.name}</span>
              </div>
              {mechanics(o) && <p className="text-xs font-sans text-muted mb-3 leading-snug">{mechanics(o)}</p>}
              <p className={`text-base font-serif font-medium text-green-800${onEnquiry ? ' italic' : ''}`}>
                {onEnquiry
                  ? 'Price on inquiry'
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
