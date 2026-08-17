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
import { serviceDisplayName, type CartItem } from './cart';

/** The three inquiry buckets, mapped from the offering's catalog segment. */
export type InquiryCategory = 'lessons' | 'horse' | 'acquisition';

/** service_type → inquiry bucket. Cart items carry either the DB enum
 *  (RIDING_LESSON…) or the display-catalog id (riding-lesson…), depending on
 *  which surface built them — both vocabularies map here. */
function categoryForServiceType(serviceType: string | null): InquiryCategory {
  switch (serviceType) {
    // DB service_type enums + display-catalog ids (src/lib/services.ts)
    case 'RIDING_LESSON':
    case 'JUMPER_TRAINING':
    case 'HORSEMANSHIP_TRAINING':
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

/** The lesson service_types, listed explicitly.
 *
 *  NOT `categoryForServiceType(...) === 'lessons'`: that function DEFAULTS to
 *  'lessons' so wording is never blank, which would make any unrecognised
 *  offering look like a lesson. The submission form's availability block and
 *  riding-experience question are gated on this (§A0/§A6b), and gating them on
 *  a default would show a lesson's date ranges to a horse-care buyer — the
 *  exact thing the owner removed. */
const LESSON_SERVICE_TYPES = new Set([
  'RIDING_LESSON', 'JUMPER_TRAINING', 'HORSEMANSHIP_TRAINING',
  'riding-lesson', 'hunter-jumper', 'horsemanship',
]);

/** Is a lesson in the cart? The one condition the submission form varies on.
 *  A mixed cart shows the UNION — a lesson plus horse care gets the
 *  availability block, because a lesson is present. It is not either/or. */
export function hasLessonItem(items: CartItem[]): boolean {
  return items.some((i) => i.serviceType != null && LESSON_SERVICE_TYPES.has(i.serviceType));
}

/**
 * Label for the submit action — ASKRIGHT §A6.
 *
 * ONE WORD FOR THE ACT: **inquire**. Owner, 2026-08-16: "request a service is a
 * bit more finite, like they are committing to it blindly without having all
 * the details… inquire keeps it premium and honors the uncertainty." And the
 * governing rule, which is testable: **"book"/"booking" may only describe
 * something that exists on the calendar.** A submission is never a booking —
 * staff call, agree a time, and only then is there a calendar entry. Which is
 * why the lessons wording says "inquire about BOOKING": the booking is the
 * thing being inquired about, not the thing being done.
 *
 *   lessons only        → "Inquire about booking"
 *   one other service   → "Inquire about {service name} service"
 *   several services    → "Inquire about these services"          ← proposed
 *   lessons + services  → "Inquire about booking and these services"  ← proposed
 *   empty (defensive)   → "Inquire"
 *
 * The last two are the multi-service fallbacks the owner asked to be proposed
 * rather than invented silently; they are the only strings here that are not
 * his own words.
 */
export function inquiryLabel(items: CartItem[]): string {
  if (items.length === 0) return 'Inquire';

  const lesson = hasLessonItem(items);
  // Distinct SERVICES, not distinct offerings: two clipping SKUs are one
  // service and must not read as "these services".
  const otherServices = new Map<string, CartItem>();
  for (const i of items) {
    if (i.serviceType && !LESSON_SERVICE_TYPES.has(i.serviceType) && !otherServices.has(i.serviceType)) {
      otherServices.set(i.serviceType, i);
    }
  }

  if (otherServices.size === 0) return lesson ? 'Inquire about booking' : 'Inquire';

  if (otherServices.size === 1) {
    const [only] = otherServices.values();
    const named = `Inquire about ${serviceDisplayName(only)} service`;
    return lesson ? `Inquire about booking and ${serviceDisplayName(only)} service` : named;
  }

  return lesson ? 'Inquire about booking and these services' : 'Inquire about these services';
}
