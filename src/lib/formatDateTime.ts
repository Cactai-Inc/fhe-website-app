/**
 * The one date/time formatter for the app. Every lesson/booking/log surface
 * shows the FULL when: date, time, timezone, and (when given) location — so a
 * rider and an instructor reading the same session never disagree about it.
 *
 * Timezone is rendered as the short zone name (e.g. "EDT") from the viewer's
 * locale, so a session at a fixed instant reads correctly wherever it's opened.
 */

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
};
const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
const ZONE_OPTS: Intl.DateTimeFormatOptions = { timeZoneName: 'short' };

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** The viewer's short timezone name for a given instant (e.g. "EDT"). */
export function zoneLabel(value: string | Date): string {
  const parts = new Intl.DateTimeFormat(undefined, ZONE_OPTS).formatToParts(toDate(value));
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/** "Monday, July 14, 2026" */
export function formatDate(value: string | Date): string {
  return toDate(value).toLocaleDateString(undefined, DATE_OPTS);
}

/** "2:00 PM" (no zone) */
export function formatTime(value: string | Date): string {
  return toDate(value).toLocaleTimeString(undefined, TIME_OPTS);
}

/** "2:00 – 3:00 PM EDT" — a start→end window with the zone once, at the end. */
export function formatTimeRange(start: string | Date, end: string | Date): string {
  return `${formatTime(start)} – ${formatTime(end)} ${zoneLabel(end)}`.trim();
}

/**
 * The full session line: "Monday, July 14, 2026 · 2:00 – 3:00 PM EDT · Main Arena".
 * Pass `end` for a window (else just the start time); `location` is appended when
 * present. This is the canonical rendering for any lesson/booking timestamp.
 */
export function formatSessionWhen(
  start: string | Date,
  end?: string | Date | null,
  location?: string | null,
): string {
  const time = end ? formatTimeRange(start, end) : `${formatTime(start)} ${zoneLabel(start)}`.trim();
  const parts = [formatDate(start), time];
  if (location && location.trim()) parts.push(location.trim());
  return parts.join(' · ');
}
