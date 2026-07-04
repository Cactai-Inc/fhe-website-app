/* Category-aware inquiry wording for the request/checkout surface.
 *
 * The submit button and summary copy personalize to the CATEGORY of what the
 * visitor actually chose — never "cart", "checkout", or a generic "selection".
 * Categories come from the underlying Service.category in src/lib/services.ts
 * (rider / horse / support), resolved per cart item by its serviceId. This is
 * robust to repricing and to new tiers: it reads the real category field rather
 * than matching fragile id strings.
 *
 *   rider   → LESSONS       (RIDING_LESSON, HUNTER_JUMPER, HORSEMANSHIP)
 *   horse   → HORSE SERVICES (HORSE_TRAINING, HORSE_EXERCISE, TURNOUT, CLIPPING)
 *   support → ACQUISITION   (HORSE_LOCATOR, EVALUATION, BROKERING)
 */
import type { CartItem } from './cart';
import { getServiceById } from './services';
import type { ServiceCategory } from './services';

/** The three inquiry buckets, mapped from Service.category. */
export type InquiryCategory = 'lessons' | 'horse' | 'acquisition';

const CATEGORY_MAP: Record<ServiceCategory, InquiryCategory> = {
  rider: 'lessons',
  horse: 'horse',
  support: 'acquisition',
};

/** Resolve the distinct inquiry categories present in a set of cart items.
 *  Items whose service can't be resolved fall back to 'lessons' (the rider
 *  funnel is the default path), so wording is never left blank. */
export function inquiryCategories(items: CartItem[]): Set<InquiryCategory> {
  const set = new Set<InquiryCategory>();
  for (const item of items) {
    const svc = getServiceById(item.serviceId);
    const category = svc ? CATEGORY_MAP[svc.category] : 'lessons';
    set.add(category);
  }
  return set;
}

/**
 * Warm, boutique-register label for the inquiry submit action, personalized to
 * the category of the chosen items and singular/plural-aware by count within the
 * relevant framing. Never says "cart" / "checkout" / "selection" / "submit".
 *
 *   only lessons      → "Inquire about this lesson"  / "…these lessons"
 *   only horse svcs    → "Inquire about this service" / "…these services"
 *   only acquisition   → "Inquire about finding your horse"
 *   mixed (2+ buckets) → "Inquire about these bookings and services"
 *   empty (defensive)  → "Inquire"
 */
export function inquiryLabel(items: CartItem[]): string {
  if (items.length === 0) return 'Inquire';

  const categories = inquiryCategories(items);

  if (categories.size > 1) {
    return 'Inquire about these bookings and services';
  }

  const [only] = categories;
  const many = items.length > 1;

  switch (only) {
    case 'lessons':
      return many ? 'Inquire about these lessons' : 'Inquire about this lesson';
    case 'horse':
      return many ? 'Inquire about these services' : 'Inquire about this service';
    case 'acquisition':
      return 'Inquire about finding your horse';
    default:
      return 'Inquire';
  }
}
