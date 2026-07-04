/**
 * Shared availability picker — the global weekday/weekend AM-PM preferences,
 * the pageable Sun–Sat week list, and the day-of-week selection. Extracted
 * VERBATIM from the public booking request (Checkout) so the member "book
 * more" page (BOOKING_FLOWS_PLAN §2 Flow D) collects the exact same
 * structured availability that lands in requests.proposed_times.
 *
 * State lives in useAvailabilityPicker(); the component is a pure view over
 * that state, so Checkout renders pixel-identical to the pre-extraction
 * markup. buildSelection() returns everything but the riding-experience
 * question (only the public form asks that — callers add it themselves).
 */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DAY_SHORT,
  weekOptions,
  type AvailabilitySelection,
  type TimePreferences,
  type WeekOption,
} from '../lib/availability';

/** Weeks shown per page of the availability picker (compact enough for phones). */
const WEEKS_PER_PAGE = 4;

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** What the picker collects: AvailabilitySelection minus ridingExperience. */
export type PickerSelection = Omit<AvailabilitySelection, 'ridingExperience'>;

/** All picker state + handlers. Keep it in the page and pass it down. */
export function useAvailabilityPicker() {
  // Availability — one global set of prefs + a pageable Sun–Sat week list.
  const [timePrefs, setTimePrefs] = useState<TimePreferences>({
    weekdayAm: false, weekdayPm: false, weekendAm: false, weekendPm: false,
  });
  const [weekPage, setWeekPage] = useState(0);
  const [selectedWeeks, setSelectedWeeks] = useState<Record<string, WeekOption>>({});
  const [anyDay, setAnyDay] = useState(false);
  const [days, setDays] = useState<number[]>([]);

  // "Today" is fixed for the visit so the list never shifts mid-fill.
  const today = useMemo(() => new Date(), []);
  const visibleWeeks = useMemo(
    () => weekOptions(today, weekPage, WEEKS_PER_PAGE),
    [today, weekPage],
  );

  function toggleWeek(week: WeekOption) {
    setSelectedWeeks((prev) => {
      const next = { ...prev };
      if (next[week.startISO]) delete next[week.startISO];
      else next[week.startISO] = week;
      return next;
    });
  }

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function buildSelection(): PickerSelection {
    return {
      weeks: Object.values(selectedWeeks).sort((a, b) => a.startISO.localeCompare(b.startISO)),
      prefs: timePrefs,
      anyDay,
      days: [...days].sort((a, b) => a - b),
    };
  }

  return {
    timePrefs, setTimePrefs,
    weekPage, setWeekPage,
    selectedWeeks, toggleWeek,
    anyDay, setAnyDay,
    days, toggleDay,
    visibleWeeks,
    buildSelection,
  };
}

export type AvailabilityPickerState = ReturnType<typeof useAvailabilityPicker>;

interface AvailabilityPickerProps {
  picker: AvailabilityPickerState;
  /** Outer fieldset spacing — Checkout's original markup used mt-8. */
  className?: string;
}

export default function AvailabilityPicker({ picker, className = 'mt-8' }: AvailabilityPickerProps) {
  const {
    timePrefs, setTimePrefs, weekPage, setWeekPage, selectedWeeks, toggleWeek,
    anyDay, setAnyDay, days, toggleDay, visibleWeeks,
  } = picker;

  return (
    /* Availability — global time prefs, week list, days of week */
    <fieldset className={className}>
      <legend className="form-label mb-1">When could you come out?</legend>
      <p className="form-hint mb-4">
        Check everything that works — we will find the exact time together.
      </p>

      {/* Global time-of-day preferences */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <fieldset className="border border-green-800/15 bg-white px-4 pb-3 pt-1">
          <legend className="text-[10px] font-sans uppercase tracking-wide text-gold-ink px-1">
            Weekdays
          </legend>
          <div className="flex items-center gap-5">
            <label className="inline-flex items-center gap-2 text-sm font-sans text-secondary cursor-pointer">
              <input
                type="checkbox"
                className="accent-green-800 focus-ring"
                checked={timePrefs.weekdayAm}
                onChange={() => setTimePrefs((p) => ({ ...p, weekdayAm: !p.weekdayAm }))}
              />
              AM
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-sans text-secondary cursor-pointer">
              <input
                type="checkbox"
                className="accent-green-800 focus-ring"
                checked={timePrefs.weekdayPm}
                onChange={() => setTimePrefs((p) => ({ ...p, weekdayPm: !p.weekdayPm }))}
              />
              PM
            </label>
          </div>
        </fieldset>
        <fieldset className="border border-green-800/15 bg-white px-4 pb-3 pt-1">
          <legend className="text-[10px] font-sans uppercase tracking-wide text-gold-ink px-1">
            Weekends
          </legend>
          <div className="flex items-center gap-5">
            <label className="inline-flex items-center gap-2 text-sm font-sans text-secondary cursor-pointer">
              <input
                type="checkbox"
                className="accent-green-800 focus-ring"
                checked={timePrefs.weekendAm}
                onChange={() => setTimePrefs((p) => ({ ...p, weekendAm: !p.weekendAm }))}
              />
              AM
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-sans text-secondary cursor-pointer">
              <input
                type="checkbox"
                className="accent-green-800 focus-ring"
                checked={timePrefs.weekendPm}
                onChange={() => setTimePrefs((p) => ({ ...p, weekendPm: !p.weekendPm }))}
              />
              PM
            </label>
          </div>
        </fieldset>
      </div>

      {/* Week list — Sunday-start weeks, paged forward from this week */}
      <fieldset className="mb-5">
        <legend className="form-label mb-0">
          Which weeks work? <span className="normal-case tracking-normal text-green-800/60">(Sun–Sat)</span>
        </legend>
        <div className="flex items-center justify-between mt-2 mb-2">
          <p className="form-hint">
            {Object.keys(selectedWeeks).length > 0
              ? `${Object.keys(selectedWeeks).length} week${Object.keys(selectedWeeks).length === 1 ? '' : 's'} selected`
              : 'Check as many as you like.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekPage((p) => Math.max(0, p - 1))}
              disabled={weekPage === 0}
              aria-label="Earlier weeks"
              className="p-2 border border-green-800/15 bg-white text-green-800 transition-colors hover:border-green-800/40 disabled:opacity-30 disabled:cursor-not-allowed focus-ring"
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setWeekPage((p) => p + 1)}
              aria-label="Later weeks"
              className="p-2 border border-green-800/15 bg-white text-green-800 transition-colors hover:border-green-800/40 focus-ring"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {visibleWeeks.map((week) => {
            const checked = !!selectedWeeks[week.startISO];
            return (
              <label
                key={week.startISO}
                className={`flex items-center gap-3 border px-4 py-3 text-sm font-sans cursor-pointer transition-all duration-200 ${
                  checked
                    ? 'border-green-800 bg-green-800/5 text-green-900 font-medium'
                    : 'border-green-800/15 bg-white text-secondary hover:border-green-800/40'
                }`}
              >
                <input
                  type="checkbox"
                  className="accent-green-800 focus-ring"
                  checked={checked}
                  onChange={() => toggleWeek(week)}
                />
                {week.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Days of the week — specific days OR open to any */}
      <fieldset>
        <legend className="form-label mb-2">Which days of the week?</legend>
        <label className="inline-flex items-center gap-2 text-sm font-sans text-secondary cursor-pointer mb-3">
          <input
            type="checkbox"
            className="accent-green-800 focus-ring"
            checked={anyDay}
            onChange={() => setAnyDay((v) => !v)}
          />
          I&rsquo;m open to any day of the week
        </label>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {DAY_SHORT.map((label, i) => {
            const checked = !anyDay && days.includes(i);
            return (
              <label
                key={label}
                className={`flex items-center justify-center gap-1.5 border py-2.5 px-1 text-xs font-sans uppercase tracking-wide transition-all duration-200 ${
                  anyDay
                    ? 'border-green-800/10 bg-white text-muted opacity-50 cursor-not-allowed'
                    : checked
                      ? 'border-green-800 bg-green-800/5 text-green-900 font-medium cursor-pointer'
                      : 'border-green-800/15 bg-white text-secondary hover:border-green-800/40 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  className="accent-green-800 focus-ring"
                  aria-label={DAY_FULL[i]}
                  disabled={anyDay}
                  checked={checked}
                  onChange={() => toggleDay(i)}
                />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>
    </fieldset>
  );
}
