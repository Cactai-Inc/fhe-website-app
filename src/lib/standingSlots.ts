import type { StandingSlot } from './ops/api-calendar';

/**
 * HOW A STANDING WEEKLY SLOT IS SAID OUT LOUD.
 *
 * D23: a `recurring` SKU is not a credit balance, so it must never be described as
 * a count. "1 lessons/week" and "4 lessons" describe a pool the client would have to
 * go and spend; a weekly membership is a RESERVED TIME that is already theirs. The
 * honest statement is which days and times those are, and that they recur until
 * cancelled — and it is written once, here, because the order page, the onboarding
 * step and the plan card all have to say the same thing.
 */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const WEEKDAY_PLURAL: Record<string, string> = {
  Mon: 'Mondays', Tue: 'Tuesdays', Wed: 'Wednesdays', Thu: 'Thursdays',
  Fri: 'Fridays', Sat: 'Saturdays', Sun: 'Sundays',
};

/** "16:00" → "4:00 PM", in the reader's own locale.
 *
 *  ⚠️ FORMATTED IN THE BROWSER, NEVER ON THE SERVER. This database has no tenant
 *  timezone column on any table (LESSONREQUEST), so a server-side `to_char` renders
 *  UTC and a 4pm lesson reaches the client as 11pm. The stored value is a wall-clock
 *  time in the barn's own day; the browser doing the reading is the one that knows
 *  how to print it. */
export function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d);
}

/** "Tuesdays at 4:00 PM and Thursdays at 5:30 PM", or null while nothing is chosen. */
export function standingSlotSummary(slot: StandingSlot): string | null {
  const parts = (slot.recurring_days ?? [])
    .map((d) => (slot.recurring_times?.[d]
      ? `${WEEKDAY_PLURAL[d] ?? d} at ${clockLabel(slot.recurring_times[d])}`
      : null))
    .filter((x): x is string => x !== null);
  if (parts.length === 0) return null;
  return parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The whole entitlement in one sentence — what the order page owes a weekly buyer
 *  in place of the count, period, expiry and renewal terms it never showed them. */
export function standingSlotSentence(slot: StandingSlot): string {
  const summary = standingSlotSummary(slot);
  if (!summary) {
    const n = Math.max(slot.weekly_frequency ?? 1, 1);
    return n === 1
      ? 'This is a standing weekly time, not a bundle of lessons — choose the day and time that are yours.'
      : `This is ${n} standing weekly times, not a bundle of lessons — choose the ${n} days and a time for each.`;
  }
  return slot.indefinite
    ? `${summary} are yours, every week until you tell us otherwise.`
    : `${summary} are yours until ${slot.plan_ends_on}.`;
}
