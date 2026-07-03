/**
 * Week-picker logic for the public booking request (Checkout availability).
 * Pins the calendar math: weeks start Sunday, the list starts at the CURRENT
 * week, paging is contiguous and never goes before page 0, labels are compact
 * and unambiguous (incl. across a year boundary), and the structured
 * JSON/human-text builders emit exactly what the request submission needs.
 */
import { describe, it, expect } from 'vitest';
import {
  startOfWeekSunday,
  toISODate,
  weekLabel,
  weekOptions,
  timePreferenceSummary,
  daysSummary,
  availabilityText,
  availabilityEntries,
  type AvailabilitySelection,
  type TimePreferences,
} from './availability';

const NO_PREFS: TimePreferences = {
  weekdayAm: false, weekdayPm: false, weekendAm: false, weekendPm: false,
};

// Friday, July 3 2026 — the week containing it starts Sunday, June 28.
const FRI = new Date(2026, 6, 3, 15, 30);

describe('startOfWeekSunday', () => {
  it('returns the preceding Sunday for a mid-week date', () => {
    const start = startOfWeekSunday(FRI);
    expect(start.getDay()).toBe(0);
    expect(toISODate(start)).toBe('2026-06-28');
  });

  it('maps a Sunday to itself (midnight, time stripped)', () => {
    const sunday = new Date(2026, 6, 5, 23, 59);
    expect(toISODate(startOfWeekSunday(sunday))).toBe('2026-07-05');
    expect(startOfWeekSunday(sunday).getHours()).toBe(0);
  });
});

describe('weekOptions (paging)', () => {
  it('page 0 starts at the current week and runs Sun–Sat', () => {
    const weeks = weekOptions(FRI, 0, 4);
    expect(weeks).toHaveLength(4);
    expect(weeks.map((w) => w.startISO)).toEqual([
      '2026-06-28', '2026-07-05', '2026-07-12', '2026-07-19',
    ]);
    expect(weeks[0].endISO).toBe('2026-07-04'); // Saturday closes the week
    expect(weeks[0].label).toBe('Jun 28 – Jul 4, 2026');
  });

  it('pages are contiguous: page 1 picks up where page 0 ended', () => {
    expect(weekOptions(FRI, 1, 4)[0].startISO).toBe('2026-07-26');
  });

  it('never pages before the current week (negative page clamps to 0)', () => {
    expect(weekOptions(FRI, -3, 4)[0].startISO).toBe('2026-06-28');
  });
});

describe('weekLabel', () => {
  it('shows the year once when the week stays inside it', () => {
    expect(weekLabel(new Date(2026, 6, 5))).toBe('Jul 5 – Jul 11, 2026');
  });

  it('shows both years across a year boundary', () => {
    expect(weekLabel(new Date(2026, 11, 27))).toBe('Dec 27, 2026 – Jan 2, 2027');
  });
});

describe('summaries', () => {
  it('summarises weekday/weekend AM/PM preferences', () => {
    expect(timePreferenceSummary({ weekdayAm: true, weekdayPm: true, weekendAm: true, weekendPm: true }))
      .toBe('Weekdays AM & PM · Weekends AM & PM');
    expect(timePreferenceSummary({ ...NO_PREFS, weekendAm: true })).toBe('Weekends AM');
    expect(timePreferenceSummary(NO_PREFS)).toBe('No time-of-day preference');
  });

  it('any-day wins over specific days; specific days sort Sun→Sat', () => {
    expect(daysSummary(true, [1, 3])).toBe('Open to any day of the week');
    expect(daysSummary(false, [3, 1])).toBe('Mon, Wed');
    expect(daysSummary(false, [])).toBe('Not specified');
  });
});

describe('availabilityText / availabilityEntries', () => {
  const selection: AvailabilitySelection = {
    weeks: weekOptions(FRI, 0, 2),
    prefs: { ...NO_PREFS, weekdayAm: true },
    anyDay: false,
    days: [1, 3],
    ridingExperience: '1-2',
  };

  it('renders a clean human-readable block', () => {
    expect(availabilityText(selection)).toBe(
      [
        'Riding experience: 1–2 years',
        'Preferred times: Weekdays AM',
        'Days: Mon, Wed',
        'Weeks: Jun 28 – Jul 4, 2026; Jul 5 – Jul 11, 2026',
      ].join('\n'),
    );
  });

  it('is empty when nothing was chosen', () => {
    expect(availabilityText({ weeks: [], prefs: NO_PREFS, anyDay: false, days: [], ridingExperience: null }))
      .toBe('');
  });

  it('emits one structured jsonb entry per selected week', () => {
    expect(availabilityEntries(selection)).toEqual([
      { date: '2026-06-28', end: '2026-07-04', label: 'Jun 28 – Jul 4, 2026', time: 'Weekdays AM', days: 'Mon, Wed' },
      { date: '2026-07-05', end: '2026-07-11', label: 'Jul 5 – Jul 11, 2026', time: 'Weekdays AM', days: 'Mon, Wed' },
    ]);
  });

  it('falls back to a single dateless entry when prefs exist but no weeks', () => {
    expect(availabilityEntries({ weeks: [], prefs: NO_PREFS, anyDay: true, days: [], ridingExperience: null }))
      .toEqual([{ date: '', time: 'No time-of-day preference', days: 'Open to any day of the week' }]);
    expect(availabilityEntries({ weeks: [], prefs: NO_PREFS, anyDay: false, days: [], ridingExperience: null }))
      .toEqual([]);
  });
});
