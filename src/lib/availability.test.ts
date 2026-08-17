/**
 * LESSONREQUEST §L3 — the availability ROUND TRIP.
 *
 * `requests.proposed_times` stores the visitor's ranges as prose that
 * `daysSummary()` and `timePreferenceSummary()` produce. §L3 has to read them
 * back so staff can see them beside the time picker and an out-of-range choice
 * can be named. The task's trap says in terms: use that column, do not add
 * another — so the prose is parsed rather than duplicated into structured
 * fields that could disagree with it.
 *
 * That is only safe if the parse is the exact inverse of the producer, for
 * EVERY combination the picker can emit — which is what these tests assert,
 * exhaustively (2^4 time preferences × the day cases), not by sampling.
 */
import { describe, it, expect } from 'vitest';
import {
  availabilityEntries,
  parseProposedTimes,
  agreedTimeWarnings,
  timePreferenceSummary,
  toISODate,
  weekLabel,
  type AvailabilitySelection,
  type TimePreferences,
  type WeekOption,
} from './availability';

function week(startISO: string): WeekOption {
  const [y, m, d] = startISO.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  return { start, end, startISO, endISO: toISODate(end), label: weekLabel(start) };
}

const NO_PREFS: TimePreferences = {
  weekdayAm: false, weekdayPm: false, weekendAm: false, weekendPm: false,
};

function sel(over: Partial<AvailabilitySelection>): AvailabilitySelection {
  return {
    weeks: [], prefs: { ...NO_PREFS }, anyDay: false, days: [], ridingExperience: null, ...over,
  };
}

/** Every time-preference combination the picker can produce. */
const ALL_PREFS: TimePreferences[] = [];
for (const weekdayAm of [false, true])
  for (const weekdayPm of [false, true])
    for (const weekendAm of [false, true])
      for (const weekendPm of [false, true])
        ALL_PREFS.push({ weekdayAm, weekdayPm, weekendAm, weekendPm });

describe('parseProposedTimes is the inverse of availabilityEntries', () => {
  it.each(ALL_PREFS)('round-trips prefs %o', (prefs) => {
    const entries = availabilityEntries(sel({ weeks: [week('2026-08-23')], prefs, anyDay: true }));
    const back = parseProposedTimes(entries);
    const any = prefs.weekdayAm || prefs.weekdayPm || prefs.weekendAm || prefs.weekendPm;
    expect(back.prefs).toEqual(any ? prefs : null);
  });

  it('round-trips selected days', () => {
    const entries = availabilityEntries(sel({ weeks: [week('2026-08-23')], days: [1, 3, 6] }));
    expect(parseProposedTimes(entries).days).toEqual([1, 3, 6]);
  });

  it('reads "any day" as null, which is a statement and not silence', () => {
    const entries = availabilityEntries(sel({ weeks: [week('2026-08-23')], anyDay: true }));
    expect(parseProposedTimes(entries).days).toBeNull();
  });

  it('reads "not specified" as an empty list, distinct from "any day"', () => {
    const entries = availabilityEntries(
      sel({ weeks: [week('2026-08-23')], prefs: { ...NO_PREFS, weekdayAm: true } }),
    );
    expect(parseProposedTimes(entries).days).toEqual([]);
  });

  it('round-trips every selected week', () => {
    const weeks = [week('2026-08-23'), week('2026-08-30'), week('2026-09-06')];
    const back = parseProposedTimes(availabilityEntries(sel({ weeks, anyDay: true })));
    expect(back.weeks.map((w) => w.startISO)).toEqual(['2026-08-23', '2026-08-30', '2026-09-06']);
    expect(back.weeks.map((w) => w.endISO)).toEqual(['2026-08-29', '2026-09-05', '2026-09-12']);
  });

  it('survives the 5 live production rows, whose shape predates this parser', () => {
    // Copied verbatim out of prod (requests.proposed_times).
    const live = [
      { end: '2026-08-08', date: '2026-08-02', days: 'Sun, Sat', time: 'Weekends AM & PM', label: 'Aug 2 – Aug 8, 2026' },
      { end: '2026-08-15', date: '2026-08-09', days: 'Sun, Sat', time: 'Weekends AM & PM', label: 'Aug 9 – Aug 15, 2026' },
    ];
    const back = parseProposedTimes(live);
    expect(back.days).toEqual([0, 6]);
    expect(back.prefs).toEqual({ weekdayAm: false, weekdayPm: false, weekendAm: true, weekendPm: true });
    expect(back.weeks).toHaveLength(2);
  });

  it('does not choke on a legacy {date,time} entry or on nothing at all', () => {
    expect(parseProposedTimes([{ date: '', time: 'morning' }]).weeks).toEqual([]);
    expect(parseProposedTimes(null)).toEqual({ weeks: [], days: [], prefs: null });
  });

  it('timePreferenceSummary of a parsed value reproduces the stored string', () => {
    const entries = availabilityEntries(
      sel({ weeks: [week('2026-08-23')], prefs: { weekdayAm: true, weekdayPm: true, weekendAm: true, weekendPm: false } }),
    );
    const back = parseProposedTimes(entries);
    expect(timePreferenceSummary(back.prefs!)).toBe(entries[0].time);
  });
});

describe('agreedTimeWarnings — visible, never blocking', () => {
  // Aug 2026: the 23rd is a Sunday, so 24th Mon, 26th Wed, 29th Sat.
  const offered = parseProposedTimes(
    availabilityEntries(sel({
      weeks: [week('2026-08-23')],
      days: [1, 3],
      prefs: { ...NO_PREFS, weekdayPm: true },
    })),
  );

  it('says nothing when the slot sits inside every range', () => {
    expect(agreedTimeWarnings(offered, new Date(2026, 7, 26, 16, 0))).toEqual([]);
  });

  it('names a date outside the weeks they offered', () => {
    const w = agreedTimeWarnings(offered, new Date(2026, 8, 2, 16, 0));
    expect(w.some((s) => s.includes('outside the week'))).toBe(true);
  });

  it('names a day they did not offer', () => {
    const w = agreedTimeWarnings(offered, new Date(2026, 7, 25, 16, 0)); // Tuesday
    expect(w.some((s) => s.includes('did not offer Tue'))).toBe(true);
  });

  it('names a time of day they did not offer', () => {
    const w = agreedTimeWarnings(offered, new Date(2026, 7, 26, 9, 0)); // Wed morning
    expect(w.some((s) => s.includes('weekday mornings'))).toBe(true);
  });

  it('reports EVERY mismatch, not just the first', () => {
    expect(agreedTimeWarnings(offered, new Date(2026, 8, 5, 9, 0))).toHaveLength(3);
  });

  it('is silent when nothing was offered — there is nothing to check against', () => {
    expect(agreedTimeWarnings(parseProposedTimes([]), new Date(2026, 7, 26, 16, 0))).toEqual([]);
  });

  it('is silent with no slot chosen yet', () => {
    expect(agreedTimeWarnings(offered, null)).toEqual([]);
  });

  it('treats "any day" as never a day mismatch', () => {
    const anyDay = parseProposedTimes(
      availabilityEntries(sel({ weeks: [week('2026-08-23')], anyDay: true, prefs: { ...NO_PREFS, weekendAm: true, weekdayAm: true } })),
    );
    expect(agreedTimeWarnings(anyDay, new Date(2026, 7, 25, 9, 0))).toEqual([]);
  });
});
