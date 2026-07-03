/* Structured availability for the public booking request (Checkout).
 *
 * Weeks run Sunday → Saturday. The picker lists real calendar weeks starting
 * at the CURRENT week and pages forward in fixed-size chunks (never before the
 * current week — the page index is clamped to 0 in the UI).
 *
 * All date math is done on local calendar dates (no UTC conversion) so the
 * visitor's own "today" decides the current week.
 */
import type { ProposedTime } from './types';

// ─── Week math ──────────────────────────────────────────────────────────────

export interface WeekOption {
  start: Date;      // Sunday
  end: Date;        // Saturday
  startISO: string; // local ISO date, e.g. '2026-06-28'
  endISO: string;
  label: string;    // compact, unambiguous, e.g. 'Jun 28 – Jul 4, 2026'
}

/** Midnight local-time copy of a date (drops the time component). */
function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const out = atMidnight(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** The Sunday that starts the week containing `d` (a Sunday maps to itself). */
export function startOfWeekSunday(d: Date): Date {
  return addDays(d, -d.getDay());
}

/** Local ISO date (yyyy-mm-dd) — NOT toISOString(), which shifts to UTC. */
export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const shortDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);

/** 'Jun 28 – Jul 4, 2026' (year once), or 'Dec 27, 2026 – Jan 2, 2027' across years. */
export function weekLabel(start: Date): string {
  const end = addDays(start, 6);
  if (start.getFullYear() === end.getFullYear()) {
    return `${shortDate(start)} – ${shortDate(end)}, ${end.getFullYear()}`;
  }
  return `${shortDate(start)}, ${start.getFullYear()} – ${shortDate(end)}, ${end.getFullYear()}`;
}

function toWeekOption(start: Date): WeekOption {
  const end = addDays(start, 6);
  return { start, end, startISO: toISODate(start), endISO: toISODate(end), label: weekLabel(start) };
}

/** One page of selectable weeks. Page 0 begins with the week containing `from`. */
export function weekOptions(from: Date, page: number, perPage: number): WeekOption[] {
  const first = addDays(startOfWeekSunday(from), Math.max(0, page) * perPage * 7);
  return Array.from({ length: perPage }, (_, i) => toWeekOption(addDays(first, i * 7)));
}

// ─── Preferences ────────────────────────────────────────────────────────────

export interface TimePreferences {
  weekdayAm: boolean;
  weekdayPm: boolean;
  weekendAm: boolean;
  weekendPm: boolean;
}

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Riding experience, in years — single-select. `text` is the notes wording. */
export const EXPERIENCE_OPTIONS = [
  { value: '0', label: '0', text: '0 years' },
  { value: '<1', label: '<1', text: 'under 1 year' },
  { value: '1-2', label: '1–2', text: '1–2 years' },
  { value: '3-4', label: '3–4', text: '3–4 years' },
  { value: '5+', label: '5+', text: '5+ years' },
] as const;
export type ExperienceValue = (typeof EXPERIENCE_OPTIONS)[number]['value'];

export interface AvailabilitySelection {
  weeks: WeekOption[];                      // selected weeks
  prefs: TimePreferences;                   // global weekday/weekend AM/PM
  anyDay: boolean;                          // 'open to any day of the week'
  days: number[];                           // 0 (Sun) … 6 (Sat), when !anyDay
  ridingExperience: ExperienceValue | null;
}

/** e.g. 'Weekdays AM & PM · Weekends AM'. */
export function timePreferenceSummary(prefs: TimePreferences): string {
  const part = (label: string, am: boolean, pm: boolean) =>
    am || pm ? `${label} ${[am && 'AM', pm && 'PM'].filter(Boolean).join(' & ')}` : null;
  const parts = [
    part('Weekdays', prefs.weekdayAm, prefs.weekdayPm),
    part('Weekends', prefs.weekendAm, prefs.weekendPm),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'No time-of-day preference';
}

/** e.g. 'Open to any day of the week' or 'Mon, Wed, Sat'. */
export function daysSummary(anyDay: boolean, days: number[]): string {
  if (anyDay) return 'Open to any day of the week';
  if (days.length === 0) return 'Not specified';
  return [...days].sort((a, b) => a - b).map((d) => DAY_SHORT[d]).join(', ');
}

function hasTimePreference(prefs: TimePreferences): boolean {
  return prefs.weekdayAm || prefs.weekdayPm || prefs.weekendAm || prefs.weekendPm;
}

/** Clean human-readable block for the request notes (empty string if nothing chosen). */
export function availabilityText(sel: AvailabilitySelection): string {
  const lines: string[] = [];
  const exp = EXPERIENCE_OPTIONS.find((o) => o.value === sel.ridingExperience);
  if (exp) lines.push(`Riding experience: ${exp.text}`);
  if (hasTimePreference(sel.prefs)) lines.push(`Preferred times: ${timePreferenceSummary(sel.prefs)}`);
  if (sel.anyDay || sel.days.length > 0) lines.push(`Days: ${daysSummary(sel.anyDay, sel.days)}`);
  if (sel.weeks.length > 0) lines.push(`Weeks: ${sel.weeks.map((w) => w.label).join('; ')}`);
  return lines.join('\n');
}

/** Structured JSON for the requests.proposed_times jsonb column — one entry per
 *  selected week (superset of the legacy {date, time} shape). */
export function availabilityEntries(sel: AvailabilitySelection): ProposedTime[] {
  const time = timePreferenceSummary(sel.prefs);
  const days = daysSummary(sel.anyDay, sel.days);
  if (sel.weeks.length === 0) {
    if (!hasTimePreference(sel.prefs) && !sel.anyDay && sel.days.length === 0) return [];
    return [{ date: '', time, days }];
  }
  return sel.weeks.map((w) => ({
    date: w.startISO,
    end: w.endISO,
    label: w.label,
    time,
    days,
  }));
}
