import { Check } from 'lucide-react';
import { formatPrice } from '../lib/services';
import type { Service, ServiceTier } from '../lib/services';
import { useCart } from '../contexts/CartContext';
import type { CartItem } from '../contexts/CartContext';

interface ServiceSelectorProps {
  service: Service;
  /** Eyebrow category label shown above the service name (e.g. "Rider Services"). */
  category?: string;
  /** Compact variant for inline cross-sell/add-on suggestions. */
  compact?: boolean;
  /** Optional small label above the tier grid (used by add-on suggestions). */
  label?: string;
}

/**
 * Shared service + tier selector used by every booking funnel.
 *
 * Tiers within a service behave like a single-select radiogroup: choosing a tier
 * replaces any other tier of the same service (enforced by the cart reducer's
 * TOGGLE_ITEM). Selecting the active tier again deselects it. Semantics are
 * exposed with role="radio"/aria-checked inside a labelled role="radiogroup".
 */
export default function ServiceSelector({
  service,
  category = 'Service',
  compact = false,
  label = '',
}: ServiceSelectorProps) {
  const { toggleItem, isSelected } = useCart();
  const groupLabelId = `svc-${service.id}-label`;

  return (
    <div className={compact ? '' : 'border border-green-800/10 bg-white p-6 sm:p-8'}>
      {!compact && (
        <>
          <p className="eyebrow mb-2">{category}</p>
          <h3 id={groupLabelId} className="heading-card text-green-800 mb-1">
            {service.name}
          </h3>
          <p className="font-serif italic text-gold-ink mb-3 text-[0.95rem]">{service.tagline}</p>
          <p className="body-text text-sm mb-6">{service.description}</p>
        </>
      )}
      {compact && (
        <>
          <h3 id={groupLabelId} className="font-serif font-medium text-green-800 text-lg mb-1">
            {service.name}
          </h3>
          <p className="text-sm font-sans text-muted mb-4">{service.tagline}</p>
        </>
      )}
      {label && (
        <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-ink mb-3">{label}</p>
      )}

      <div role="radiogroup" aria-labelledby={groupLabelId} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {service.tiers.map((tier: ServiceTier) => {
          const selected = isSelected(service.id, tier.id);
          const item: CartItem = {
            serviceId: service.id,
            serviceName: service.name,
            tierId: tier.id,
            tierLabel: tier.label,
            price: tier.price,
            unit: tier.unit,
          };
          return (
            <button
              key={tier.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => toggleItem(item)}
              className={`selectable-card ${selected ? 'selectable-card-selected' : 'selectable-card-unselected'}`}
            >
              {tier.popular && (
                <span className="absolute top-3 right-3 text-[9px] font-sans font-medium tracking-wider uppercase bg-gold-600 text-green-900 px-2 py-0.5">
                  Popular
                </span>
              )}
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-sm font-sans font-medium text-green-900 pr-8">{tier.label}</span>
                <div
                  aria-hidden="true"
                  className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${
                    selected ? 'bg-green-800 border-green-800' : 'border-green-800/30'
                  }`}
                >
                  {selected && <Check size={10} className="text-white" />}
                </div>
              </div>
              <p className="text-xs font-sans text-muted mb-3 leading-snug">{tier.description}</p>
              <p className="text-base font-serif font-medium text-green-800">
                {formatPrice(tier.price, tier.unit)}
              </p>
              {tier.note && <p className="text-[10px] font-sans text-gold-ink mt-1">{tier.note}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
