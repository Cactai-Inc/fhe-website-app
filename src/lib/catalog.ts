/* Lessons + Membership catalog. Placeholder pricing/plans — edit freely.
 * Lessons = price/quantity focused (one-off). Membership = features/benefits
 * focused (subscription). Both ultimately deliver riding lessons.
 */

export interface LessonPack {
  id: string;
  label: string;
  description: string;
  price: number;
  unit: 'session' | 'flat';
  perLesson?: string;   // e.g. "$115 / lesson"
  popular?: boolean;
}

export interface LessonAddOn {
  id: string;
  label: string;
  description: string;
  price: number;
}

/** One-off lessons — single or punch card (price/quantity mindset).
 *  Owner pricing 2026-07-01; the DB twin lives in migration
 *  20260701060000_owner_pricing_2026_07.sql (drift-guard test pins the two). */
export const LESSON_PACKS: LessonPack[] = [
  { id: 'single', label: 'Single Lesson', description: '60-minute private lesson on our horses', price: 150, unit: 'session' },
  { id: 'punch4', label: '4-Lesson Punch Card', description: 'Four private lessons — good for 90 days', price: 500, unit: 'flat', perLesson: 'Save $100', popular: true },
  { id: 'punch8', label: '8-Lesson Punch Card', description: 'Eight private lessons — good for 90 days', price: 950, unit: 'flat', perLesson: 'Save $150' },
];

export const LESSON_ADDONS: LessonAddOn[] = [
  { id: 'evaluation', label: 'Evaluation Lesson', description: 'Required before the first lesson for every new client — we assess your riding and map the plan.', price: 150 },
  { id: 'own-horse-single', label: 'Own Horse — Single Lesson', description: 'For horse owners and lessees: a private lesson on your own horse.', price: 120 },
];

export interface MembershipPlan {
  id: string;
  name: string;
  cadenceLabel: string;        // "per week" | "per month"
  price: number;
  unit: 'month';               // billed monthly regardless of cadence
  lessonsLabel: string;        // "1 lesson / week", "4 lessons / month"
  popular?: boolean;
  highlight?: string;          // small ribbon, e.g. "Most chosen"
}

/** Membership subscriptions — billed the 1st of each month; 30 days notice to
 *  cancel (owner pricing 2026-07-01). */
export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  { id: 'weekly1', name: 'One Ride a Week', cadenceLabel: 'per week', price: 460, unit: 'month', lessonsLabel: '1 lesson every week' },
  { id: 'weekly2', name: 'Twice a Week', cadenceLabel: 'per week', price: 880, unit: 'month', lessonsLabel: '2 lessons every week', popular: true, highlight: 'Most chosen' },
  { id: 'weekly3', name: 'Three Times a Week', cadenceLabel: 'per week', price: 1260, unit: 'month', lessonsLabel: '3 lessons every week' },
];

/** What every membership includes (benefits mindset). */
export const MEMBERSHIP_INCLUDED: string[] = [
  'An evaluation lesson and a personal riding plan',
  'Horsemanship training, included',
  'A standing place in the rider community and group rides',
  'Member rates on horse care, clipping, and acquisition support',
  'Priority on the schedule',
];
