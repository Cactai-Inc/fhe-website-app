/* Calendar modal — a real MONTH-GRID calendar in the header affordance. Days with
 * items carry dot markers; tapping a day lists that day's items below with the
 * date writ large. Sources are role-aware: staff see the whole barn's lesson
 * sessions (org-wide); members see their own — plus community events and the
 * member's billing due dates. Prev/next month navigation. */
import { useEffect, useMemo, useState } from 'react';
import {
  X, CalendarDays, GraduationCap, MapPin, CreditCard, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { fetchEvents } from '../../lib/community';
import { myLessonSessions, type MemberLessonSession } from '../../lib/ops/api-member';
import { listLessonSessions, type LessonSession } from '../../lib/ops/api-lessons';
import { listBillingSchedules, nextDue, type BillingSchedule } from '../../lib/billing';
import { useAuth } from '../../contexts/AuthContext';
import type { CommunityEvent } from '../../lib/community-types';

type Kind = 'lesson' | 'event' | 'payment';

interface Entry { key: string; when: Date; title: string; detail: string; kind: Kind; }

const ICON: Record<Kind, typeof CalendarDays> = {
  lesson: GraduationCap, event: MapPin, payment: CreditCard,
};
const TINT: Record<Kind, string> = {
  lesson: 'text-green-800', event: 'text-gold-800', payment: 'text-red-700',
};
const DOT: Record<Kind, string> = {
  lesson: 'bg-green-700', event: 'bg-gold-600', payment: 'bg-red-600',
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function CalendarModal({ onClose }: { onClose: () => void }) {
  const { isStaff } = useAuth();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  useEffect(() => {
    let active = true;
    Promise.all([
      isStaff
        ? listLessonSessions().catch(() => [] as LessonSession[])
        : Promise.resolve([] as LessonSession[]),
      isStaff
        ? Promise.resolve([] as MemberLessonSession[])
        : myLessonSessions().catch(() => [] as MemberLessonSession[]),
      fetchEvents().catch(() => [] as CommunityEvent[]),
      listBillingSchedules().catch(() => [] as BillingSchedule[]),
    ]).then(([orgSessions, mySessions, events, schedules]) => {
      if (!active) return;
      const rows: Entry[] = [];
      for (const s of orgSessions) {
        if (s.status === 'CANCELLED') continue;
        const t = new Date(s.starts_at);
        rows.push({
          key: `l-${s.id}`, when: t, kind: 'lesson', title: 'Lesson',
          detail: `${t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${s.location ? ` · ${s.location}` : ''}`,
        });
      }
      for (const s of mySessions) {
        if (s.status === 'CANCELLED') continue;
        const t = new Date(s.starts_at);
        rows.push({
          key: `l-${s.id}`, when: t, kind: 'lesson', title: 'Your lesson',
          detail: `${t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${s.location ? ` · ${s.location}` : ''}`,
        });
      }
      for (const e of events) {
        if (!e.starts_at) continue;
        const t = new Date(e.starts_at);
        rows.push({
          key: `e-${e.id}`, when: t, kind: 'event', title: e.title,
          detail: `${t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${e.location ? ` · ${e.location}` : ''}`,
        });
      }
      for (const b of schedules) {
        if (!b.active) continue;
        const due = nextDue(b.start_date, b.cadence);
        rows.push({
          key: `p-${b.id}`, when: due, kind: 'payment',
          title: `Payment due · $${Number(b.amount).toFixed(0)}`,
          detail: b.mode === 'request' ? "We'll send a Zelle request" : 'Zelle payment',
        });
      }
      setEntries(rows);
    });
    return () => { active = false; };
  }, [isStaff]);

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries ?? []) {
      const k = dayKey(e.when);
      (map.get(k) ?? map.set(k, []).get(k)!).push(e);
    }
    for (const list of map.values()) list.sort((a, b) => a.when.getTime() - b.when.getTime());
    return map;
  }, [entries]);

  // month grid: leading blanks + days
  const grid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= days; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    return cells;
  }, [month]);

  const selectedItems = byDay.get(dayKey(selected)) ?? [];
  const isToday = (d: Date) => dayKey(d) === dayKey(today);
  const isSelected = (d: Date) => dayKey(d) === dayKey(selected);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 sm:pt-16" onClick={onClose}>
      <div className="bg-cream w-full sm:max-w-md rounded-2xl max-h-[88dvh] overflow-y-auto shadow-lg pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-green-800/10 sticky top-0 bg-cream z-10">
          <h2 className="font-serif text-green-800 flex items-center gap-2"><CalendarDays size={18} /> Calendar</h2>
          <button type="button" onClick={onClose} aria-label="Close calendar"><X size={20} /></button>
        </div>

        <div className="px-4 pt-3">
          {/* month header */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" aria-label="Previous month" className="p-2 text-secondary hover:text-green-800 focus-ring rounded-md"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              <ChevronLeft size={18} />
            </button>
            <p className="font-serif text-green-900 text-lg font-semibold">
              {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </p>
            <button type="button" aria-label="Next month" className="p-2 text-secondary hover:text-green-800 focus-ring rounded-md"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* weekday header */}
          <div className="grid grid-cols-7 text-center text-[10px] tracking-wide uppercase text-muted font-semibold mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
          </div>

          {/* the grid */}
          <div className="grid grid-cols-7 gap-y-1 mb-4">
            {grid.map((d, i) => {
              if (!d) return <span key={`b${i}`} />;
              const items = byDay.get(dayKey(d)) ?? [];
              const kinds = [...new Set(items.map((x) => x.kind))];
              return (
                <button
                  key={d.getDate()}
                  type="button"
                  onClick={() => setSelected(d)}
                  className={`h-10 rounded-lg grid place-items-center relative text-sm font-sans focus-ring ${
                    isSelected(d) ? 'bg-green-800 text-white font-semibold'
                    : isToday(d) ? 'bg-gold-50 text-green-900 font-semibold border border-gold-400'
                    : 'text-green-900 hover:bg-green-50'
                  }`}
                >
                  {d.getDate()}
                  {kinds.length > 0 && (
                    <span className="absolute bottom-1 flex gap-0.5">
                      {kinds.slice(0, 3).map((k) => (
                        <span key={k} className={`w-1.5 h-1.5 rounded-full ${isSelected(d) ? 'bg-white' : DOT[k]}`} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* the selected day — date writ large */}
          <div className="border-t border-green-800/10 pt-3">
            <p className="font-serif text-green-900 text-xl font-semibold mb-2">
              {selected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            {entries === null && <p className="body-text text-sm text-muted">Loading…</p>}
            {entries !== null && selectedItems.length === 0 && (
              <p className="body-text text-sm text-muted">Nothing on this day.</p>
            )}
            <ul className="flex flex-col gap-2">
              {selectedItems.map((e) => {
                const Icon = ICON[e.kind];
                return (
                  <li key={e.key} className="flex items-start gap-3 p-3 bg-white border border-green-800/10 rounded-lg">
                    <span className={`mt-0.5 ${TINT[e.kind]}`}><Icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-green-900 truncate">{e.title}</span>
                      <span className="block text-xs text-muted">{e.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
