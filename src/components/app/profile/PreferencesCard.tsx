import { Bell, Reply, CalendarClock, Sparkles } from 'lucide-react';
import { SectionCard } from './SectionCard';

const CATEGORIES = [
  { icon: Reply, label: 'Replies to my discussions' },
  { icon: CalendarClock, label: 'Event reminders' },
  { icon: Sparkles, label: 'New member welcomes' },
];

/**
 * SECTION 2 — PREFERENCES. Owner spec 2026-08-05 (TASK-PROFILE) asked for the
 * "existing notification preferences" moved into their own clearly-labeled
 * section. Read-first turned up no backing data model at all: no preferences
 * table, and the prior UI (AccountHub's old inline ProfileSection) rendered
 * three `defaultChecked` checkboxes that were never read or saved — toggling
 * them did nothing, on every account.
 *
 * Shipping that as interactive controls in the rebuilt surface would repeat
 * the exact bug SavedPanel was fixed for (AccountPanels.tsx: showing fake data
 * as if it were real, per the owner's I2 report) — so this renders the
 * categories as plain informational rows, not fake toggles, and says so.
 * Flagged as an open gap in TASK-PROFILE-REPORT.md; building real per-category
 * notification preferences is out of this task's scope.
 */
export function PreferencesCard() {
  return (
    <SectionCard icon={Bell} title="Preferences">
      <p className="text-[11.5px] text-muted -mt-1 mb-3">
        You'll receive updates for the following. Per-category control is coming soon.
      </p>
      <div className="flex flex-col gap-2">
        {CATEGORIES.map((c) => (
          <div key={c.label} className="flex items-center gap-3 bg-cream-100/60 border border-green-800/10 rounded-xl px-3.5 py-2.5">
            <c.icon size={15} className="text-green-700 shrink-0" />
            <span className="text-[12.5px] text-green-900">{c.label}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
