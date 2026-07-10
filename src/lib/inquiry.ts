/* Category-aware inquiry wording for the request/checkout surface.
 *
 * The submit button and summary copy personalize to the CATEGORY of what the
 * visitor actually chose — never "cart", "checkout", or a generic "selection".
 * Categories derive from each cart item's serviceType (the flat-catalog field
 * every CartItem carries), mapped to the catalog segments (rider / horse /
 * support). Robust to repricing and new offerings: it reads the real
 * service_type rather than matching fragile id strings.
 *
 *   rider   → LESSONS        (RIDING_LESSON, JUMPER_TRAINING, HORSEMANSHIP_TRAINING)
 *   horse   → HORSE SERVICES (HORSE_TRAINING, HORSE_EXERCISE, HORSE_CLIPPING)
 *   support → ACQUISITION    (HORSE_FINDER, HORSE_EVALUATION, *_ASSISTANCE)
 */
import type { CartItem } from './cart';

/** The three inquiry buckets, mapped from the offering's catalog segment. */
export type InquiryCategory = 'lessons' | 'horse' | 'acquisition';

/** service_type → inquiry bucket. Cart items carry either the DB enum
 *  (RIDING_LESSON…) or the display-catalog id (riding-lesson…), depending on
 *  which surface built them — both vocabularies map here. */
function categoryForServiceType(serviceType: string | null): InquiryCategory {
  switch (serviceType) {
    // DB service_type enums
    case 'RIDING_LESSON':
    case 'JUMPER_TRAINING':
    case 'HORSEMANSHIP_TRAINING':
    // display-catalog ids (src/lib/services.ts)
    case 'riding-lesson':
    case 'hunter-jumper':
    case 'horsemanship':
      return 'lessons';
    case 'HORSE_TRAINING':
    case 'HORSE_EXERCISE':
    case 'HORSE_CLIPPING':
    case 'horse-training':
    case 'horse-exercise':
    case 'riding-turnout':
    case 'hair-clipping':
      return 'horse';
    case 'HORSE_FINDER':
    case 'HORSE_EVALUATION':
    case 'HORSE_PURCHASE_ASSISTANCE':
    case 'HORSE_SALE_ASSISTANCE':
    case 'HORSE_LEASE_IN_ASSISTANCE':
    case 'HORSE_LEASE_OUT_ASSISTANCE':
    case 'horse-locator':
    case 'evaluation':
    case 'brokering':
      return 'acquisition';
    default:
      // the rider funnel is the default path, so wording is never left blank
      return 'lessons';
  }
}

/** Resolve the distinct inquiry categories present in a set of cart items. */
export function inquiryCategories(items: CartItem[]): Set<InquiryCategory> {
  const set = new Set<InquiryCategory>();
  for (const item of items) {
    set.add(categoryForServiceType(item.serviceType));
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
