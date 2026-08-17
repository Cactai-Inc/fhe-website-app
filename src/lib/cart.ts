import type { PriceUnit } from './pricing';
import type { OfferingConfigKind } from './types';
import type { OfferingLineConfig } from './api';

// ─── Cart item ──────────────────────────────────────────────────────────────

/** Flat catalog: a cart item IS a flat offering (the tier layer was removed
 *  2026-07-08). offeringId is the purchasable unit; serviceType groups by kind. */
export interface CartItem {
  offeringId: string;
  offeringName: string;
  serviceType: string | null;
  /** ASKRIGHT: the service_type's own display_name from the live catalog, so
   *  page 2's section headings and the inquire wording name the service the way
   *  the owner named it — renaming it in the DB renames both. Optional because
   *  a cart persisted before this existed will not carry it; the fallback
   *  humanizes the CODE (identity, stable), never the offering name. */
  serviceTypeName?: string | null;
  price: number;
  unit: PriceUnit;
  /** COUNTFIX 1.5: the offering has NO price (`offerings.price_amount IS NULL`) —
   *  it is quoted on enquiry. `price` is 0 so totals stay arithmetic, but every
   *  surface must render "Price on enquiry" rather than "$0". */
  priceOnEnquiry?: boolean;
  /** Phase 4: the SKU's mechanics bucket — drives the checkout config panel. */
  configKind?: OfferingConfigKind | null;
  /** Recurring SKUs: sessions/week (1/2/3), for the config panel copy. */
  weeklyFrequency?: number | null;
  /** Scheduled SKUs: # of sessions granted, for the config panel copy. */
  unitCount?: number | null;
  /** Captured per-line scheduling/config intent (carried to purchase_items.config). */
  config?: OfferingLineConfig;
}

/**
 * What to CALL the service this item belongs to.
 *
 * The live catalog's `service_types.display_name`, carried on the item at
 * selection time. The fallback humanizes the service_type CODE — identity,
 * stable, and safe — and never the offering NAME: names changed on 2026-08-15
 * and name-parsing has broken credit minting three separate times.
 */
export function serviceDisplayName(item: CartItem): string {
  if (item.serviceTypeName) return item.serviceTypeName;
  const code = item.serviceType ?? '';
  if (!code) return 'this service';
  return code.toLowerCase().split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Inquiry summary (group by billing cadence) ───────────────────────────

export type Cadence = PriceUnit;

export interface CadenceGroup {
  unit: Cadence;
  label: string;       // human label for the cadence, e.g. "Monthly"
  items: CartItem[];
  total: number;       // sum of fixed-price items in this group
  isEstimate: boolean; // true for percent (brokering) — never a fixed total
}

const CADENCE_LABEL: Record<Cadence, string> = {
  lesson: 'Per lesson',
  session: 'Per session',
  week: 'Weekly',
  month: 'Monthly',
  flat: 'One-time',
  percent: 'Percentage-based (estimated)',
};

const CADENCE_ORDER: Cadence[] = ['flat', 'lesson', 'session', 'week', 'month', 'percent'];

/** Group cart items by billing cadence so different cadences are never summed
 *  into one misleading total. Percentage (brokering) is flagged as an estimate. */
export function groupByCadence(items: CartItem[]): CadenceGroup[] {
  const byUnit = new Map<Cadence, CartItem[]>();
  for (const item of items) {
    const unit = (item.unit as Cadence) ?? 'flat';
    if (!byUnit.has(unit)) byUnit.set(unit, []);
    byUnit.get(unit)!.push(item);
  }
  return CADENCE_ORDER.filter((u) => byUnit.has(u)).map((unit) => {
    const groupItems = byUnit.get(unit)!;
    const isEstimate = unit === 'percent';
    return {
      unit,
      label: CADENCE_LABEL[unit],
      items: groupItems,
      total: isEstimate ? 0 : groupItems.reduce((s, i) => s + i.price, 0),
      isEstimate,
    };
  });
}
