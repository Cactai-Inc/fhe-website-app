import type { PriceUnit } from './services';

// ─── Cart item ──────────────────────────────────────────────────────────────

/** Flat catalog: a cart item IS a flat offering (the tier layer was removed
 *  2026-07-08). offeringId is the purchasable unit; serviceType groups by kind. */
export interface CartItem {
  offeringId: string;
  offeringName: string;
  serviceType: string | null;
  price: number;
  unit: PriceUnit;
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
