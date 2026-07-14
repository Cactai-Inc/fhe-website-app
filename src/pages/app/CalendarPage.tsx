import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { fetchCalendar, type CalendarItem, type CalendarView } from '../../lib/ops/api-calendar';
import { formatSessionWhen, formatTimeRange } from '../../lib/formatDateTime';

/*
 * CP-CALENDAR — the one full-page calendar for client/staff/admin (Phase 6,
 * Slice 2: read-only render). Week + month views over calendar_free_busy, which
 * is role-aware: staff see every item in full, a client sees their own in full,
 * flexible-open blocks as bookable, and everyone else's time as opaque
 * 'unavailable'. Clicking an item opens a read-only detail panel; the editable
 * config + booking panels land in Slices 3–4.
 */

type ViewMode = 'week' | 'month';

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  return new Date(s.getTime() - s.getDay() * DAY_MS); // Sunday-start
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** The outline/fill treatment for an item by status (owner's color model:
 *  yellow=notice, orange=pending, green=approved; plus available + unavailable). */
function itemClass(item: CalendarItem): string {
  switch (item.status) {
    case 'available':
      return 'bg-green-50 border border-green-600/40 text-green-800';
    case 'unavailable':
      return 'bg-green-800/5 border border-green-800/15 text-green-800/50 [background-image:repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.03)_5px,rgba(0,0,0,0.03)_10px)]';
    case 'draft':
      return 'bg-white border border-dashed border-green-800/40 text-green-800/80';
    case 'pending':
    case 'pending_slot':
    case 'pending_payment':
      return 'bg-orange-50 border border-orange-400 text-orange-800';
    case 'cancelled':
    case 'expired':
    case 'no_show':
      return 'bg-white border border-green-800/10 text-green-800/40 line-through';
    default: // confirmed / scheduled / completed
      return 'bg-green-700 border border-green-800 text-white';
  }
}

const LEGEND: { label: string; cls: string }[] = [
  { label: 'Available', cls: 'bg-green-50 border border-green-600/40' },
  { label: 'Booked', cls: 'bg-green-700 border border-green-800' },
  { label: 'Pending', cls: 'bg-orange-50 border border-orange-400' },
  { label: 'Draft', cls: 'bg-white border border-dashed border-green-800/40' },
  { label: 'Unavailable', cls: 'bg-green-800/5 border border-green-800/15' },
];

/** A short label for an item the caller may or may not see detail on. */
function itemLabel(item: CalendarItem): string {
  if (item.status === 'unavailable') return 'Unavailable';
  if (item.status === 'available') return 'Open';
  if (item.is_mine) return item.kind === 'lesson' ? 'Your lesson' : 'Your booking';
  return item.kind === 'block' ? 'Block' : 'Booking';
}

export default function CalendarPage() {
  useDocumentTitle('Calendar');
  const [view, setView] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [data, setData] = useState<CalendarView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarItem | null>(null);

  // the visible range: a Sunday-start week, or the 6-week grid covering a month.
  const range = useMemo(() => {
    if (view === 'week') {
      const from = startOfWeek(anchor);
      return { from, to: addDays(from, 7) };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const from = startOfWeek(first);
    return { from, to: addDays(from, 42) };
  }, [view, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCalendar(range.from.toISOString(), range.to.toISOString()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the calendar.');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];

  // the hour band from business hours (fallback 10–18), for the week grid rows.
  const [openHour, closeHour] = useMemo(() => {
    const hrs = data?.hours ?? [];
    const opens = hrs.filter((h) => !h.closed).map((h) => parseInt(h.open.slice(0, 2), 10));
    const closes = hrs.filter((h) => !h.closed).map((h) => parseInt(h.close.slice(0, 2), 10));
    return [opens.length ? Math.min(...opens) : 10, closes.length ? Math.max(...closes) : 18];
  }, [data]);

  function shift(dir: number) {
    setAnchor((a) =>
      view === 'week' ? addDays(a, dir * 7) : new Date(a.getFullYear(), a.getMonth() + dir, 1),
    );
  }

  const title =
    view === 'week'
      ? `${range.from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(range.from, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-serif text-2xl text-green-900 inline-flex items-center gap-2">
          <CalendarDays size={22} className="text-gold-ink" aria-hidden="true" /> Calendar
        </h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full bg-green-800/10 p-0.5">
            {(['week', 'month'] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-full text-sm capitalize transition-colors ${
                  view === v ? 'bg-green-800 text-white' : 'text-green-800'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button type="button" aria-label="Previous" onClick={() => shift(-1)} className="p-2 text-green-800 hover:bg-green-50 rounded-md focus-ring">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setAnchor(new Date())} className="text-sm text-green-800 px-2 py-1 hover:bg-green-50 rounded-md">
            Today
          </button>
          <button type="button" aria-label="Next" onClick={() => shift(1)} className="p-2 text-green-800 hover:bg-green-50 rounded-md focus-ring">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="font-serif text-lg text-green-900">{title}</p>
        <div className="flex flex-wrap gap-3">
          {LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 text-xs text-green-800/70">
              <span className={`w-3 h-3 rounded-sm ${l.cls}`} /> {l.label}
            </span>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="form-error mb-3">{error}</p>}

      <div className="bg-white border border-green-800/10 rounded-lg overflow-x-auto">
        {view === 'week' ? (
          <WeekGrid
            weekStart={range.from}
            openHour={openHour}
            closeHour={closeHour}
            items={items}
            onSelect={setSelected}
          />
        ) : (
          <MonthGrid anchor={anchor} items={items} onPickDay={(d) => { setView('week'); setAnchor(d); }} />
        )}
      </div>

      {loading && <p className="text-sm text-muted mt-3">Loading…</p>}

      {selected && <DetailPanel item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function WeekGrid({
  weekStart,
  openHour,
  closeHour,
  items,
  onSelect,
}: {
  weekStart: Date;
  openHour: number;
  closeHour: number;
  items: CalendarItem[];
  onSelect: (i: CalendarItem) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: Math.max(1, closeHour - openHour) }, (_, i) => openHour + i);
  const today = new Date();

  function itemsFor(day: Date, hour: number): CalendarItem[] {
    return items.filter((it) => {
      const s = new Date(it.starts_at);
      return sameDay(s, day) && s.getHours() === hour;
    });
  }

  return (
    <div className="min-w-[720px]">
      {/* day header */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-green-800/10">
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className={`px-2 py-2 text-center border-l border-green-800/10 ${sameDay(d, today) ? 'bg-gold-50' : ''}`}>
            <div className="text-[10px] uppercase tracking-wide text-muted">
              {d.toLocaleDateString(undefined, { weekday: 'short' })}
            </div>
            <div className="text-sm font-semibold text-green-900">{d.getDate()}</div>
          </div>
        ))}
      </div>
      {/* hour rows */}
      {hours.map((h) => (
        <div key={h} className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-green-800/5">
          <div className="px-2 py-1 text-[11px] text-muted text-right">
            {new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })}
          </div>
          {days.map((d) => {
            const cell = itemsFor(d, h);
            return (
              <div key={d.toISOString()} className="border-l border-green-800/10 min-h-[44px] p-0.5 space-y-0.5">
                {cell.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onSelect(it)}
                    className={`w-full text-left rounded px-1.5 py-1 text-[11px] leading-tight ${itemClass(it)}`}
                  >
                    {itemLabel(it)}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MonthGrid({
  anchor,
  items,
  onPickDay,
}: {
  anchor: Date;
  items: CalendarItem[];
  onPickDay: (d: Date) => void;
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();

  function itemsOn(day: Date): CalendarItem[] {
    return items.filter((it) => sameDay(new Date(it.starts_at), day));
  }

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wide text-muted font-semibold border-b border-green-800/10">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d} className="py-2">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const dayItems = itemsOn(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onPickDay(d)}
              className={`min-h-[92px] border-b border-l border-green-800/10 p-1.5 text-left align-top ${
                inMonth ? '' : 'bg-green-800/[0.02] text-green-800/40'
              } ${sameDay(d, today) ? 'bg-gold-50' : ''}`}
            >
              <div className="text-xs font-semibold text-green-900">{d.getDate()}</div>
              <div className="mt-1 space-y-0.5">
                {dayItems.slice(0, 3).map((it) => (
                  <div key={it.id} className={`rounded px-1 py-0.5 text-[10px] leading-tight truncate ${itemClass(it)}`}>
                    {formatTimeRange(it.starts_at, it.ends_at ?? it.starts_at).split(' – ')[0]} {itemLabel(it)}
                  </div>
                ))}
                {dayItems.length > 3 && (
                  <div className="text-[10px] text-muted">+{dayItems.length - 3} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Read-only detail (Slice 2). The editable config/booking panels arrive in
 *  Slices 3–4; for now this shows what the caller is allowed to see. */
function DetailPanel({ item, onClose }: { item: CalendarItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div className="bg-cream w-full max-w-sm h-full overflow-y-auto shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg text-green-900">{itemLabel(item)}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">When</dt>
            <dd className="text-green-900">{formatSessionWhen(item.starts_at, item.ends_at)}</dd>
          </div>
          {item.status && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Status</dt>
              <dd className="text-green-900 capitalize">{item.status.replace(/_/g, ' ')}</dd>
            </div>
          )}
          {item.address && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Address</dt>
              <dd>
                <a
                  className="text-green-800 underline"
                  href={`https://maps.apple.com/?daddr=${encodeURIComponent(item.address)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.address}
                </a>
              </dd>
            </div>
          )}
          {typeof item.price_amount === 'number' && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Price</dt>
              <dd className="text-green-900">${item.price_amount.toFixed(2)}</dd>
            </div>
          )}
          {item.notes && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Notes</dt>
              <dd className="text-green-900 whitespace-pre-line">{item.notes}</dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-muted mt-6">
          Booking &amp; configuration actions arrive with the next update.
        </p>
      </div>
    </div>
  );
}
