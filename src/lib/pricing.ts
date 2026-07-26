/* Neutral pricing primitives — the shared types + formatter that used to live in
 * the hardcoded services.ts catalog. This module carries NO catalog data; the
 * catalog is the DB `offerings` table (via public_offerings / fetchOfferings).
 * Extracted in Phase 4 so the two hardcoded shadow catalogs (services.ts,
 * catalog.ts) could be retired without breaking the DB-driven consumers. */

export type ServiceCategory = 'rider' | 'horse' | 'support';

/* 'lesson' is a UI-only unit (riding lessons read "per lesson", not "per
 * session"). The DB check constraint doesn't know it — map it to 'session'
 * before any purchase_items write (see Checkout.handleStartPurchase). */
export type PriceUnit = 'lesson' | 'session' | 'month' | 'week' | 'flat' | 'percent';

export function formatPrice(price: number, unit: PriceUnit): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

  switch (unit) {
    case 'month':   return `${formatted} / mo`;
    case 'week':    return `${formatted} / wk`;
    case 'lesson':  return `${formatted} / lesson`;
    case 'session': return `${formatted} / session`;
    case 'percent': return `${price}% of sale price`;
    default:        return formatted;
  }
}
