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

/** One-off lessons — single or multipack (price/quantity mindset). */
export const LESSON_PACKS: LessonPack[] = [
  { id: 'single', label: 'Single Lesson', description: '60-minute private lesson', price: 125, unit: 'session' },
  { id: 'pack5', label: '5-Lesson Pack', description: 'Five 60-minute private lessons', price: 575, unit: 'flat', perLesson: '$115 / lesson — save $50', popular: true },
  { id: 'pack10', label: '10-Lesson Pack', description: 'Ten 60-minute private lessons', price: 1100, unit: 'flat', perLesson: '$110 / lesson — save $150' },
];

export const LESSON_ADDONS: LessonAddOn[] = [
  { id: 'evaluation', label: 'Evaluation Lesson + Plan', description: 'A focused first session where we assess your riding and map a plan for where you want to go.', price: 95 },
  { id: 'horsemanship', label: 'Horsemanship Training', description: 'Ground-based sessions — handling, body language, and the partnership beneath the riding.', price: 80 },
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

/** Membership subscriptions — per-week and per-month cadences (features mindset). */
export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  { id: 'weekly1', name: 'One Ride a Week', cadenceLabel: 'per week', price: 450, unit: 'month', lessonsLabel: '1 lesson every week' },
  { id: 'weekly2', name: 'Twice a Week', cadenceLabel: 'per week', price: 820, unit: 'month', lessonsLabel: '2 lessons every week', popular: true, highlight: 'Most chosen' },
  { id: 'monthly4', name: 'Monthly Four', cadenceLabel: 'per month', price: 420, unit: 'month', lessonsLabel: '4 lessons a month, your schedule' },
];

/** What every membership includes (benefits mindset). */
export const MEMBERSHIP_INCLUDED: string[] = [
  'An evaluation lesson and a personal riding plan',
  'Horsemanship training, included',
  'A standing place in the rider community and group rides',
  'Member rates on horse care, clipping, and acquisition support',
  'Priority on the schedule',
];
