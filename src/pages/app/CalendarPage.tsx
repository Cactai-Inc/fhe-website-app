import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X, Wallet, Settings } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import {
  fetchCalendar,
  fetchRevenue,
  fetchCreditsRoster,
  type CalendarItem,
  type CalendarView,
  type CreditRosterEntry,
} from '../../lib/ops/api-calendar';
import {
  bookOpenSlot,
  requestBookingChange,
  fetchRescheduleFee,
  fetchOpenChangeRequests,
  decideBookingChange,
  type OpenChangeRequest,
} from '../../lib/ops/api-calendar';
import { toErrorMessage } from '../../lib/ops/errors';
import { Link } from 'react-router-dom';
import { formatSessionWhen, formatTimeRange } from '../../lib/formatDateTime';
import { CalendarItemPanel } from './CalendarItemPanel';
import { CalendarSettingsPanel } from './CalendarSettingsPanel';

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
      // yellow = a notice / not-yet-committed item that needs attention
      return 'bg-yellow-50 border border-dashed border-yellow-500 text-yellow-800';
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
  { label: 'Draft / notice', cls: 'bg-yellow-50 border border-dashed border-yellow-500' },
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
  const [editing, setEditing] = useState<{ item: CalendarItem | null; start?: Date } | null>(null);
  const [money, setMoney] = useState<{ week: number; month: number } | null>(null);
  const [roster, setRoster] = useState<CreditRosterEntry[] | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isStaff = data?.role === 'staff';

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

  // staff revenue (this week + this month) + credits roster
  useEffect(() => {
    if (!isStaff) return;
    const now = new Date();
    const wkFrom = startOfWeek(now);
    const wkTo = addDays(wkFrom, 7);
    const moFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const moTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    Promise.all([
      fetchRevenue(wkFrom.toISOString(), wkTo.toISOString()),
      fetchRevenue(moFrom.toISOString(), moTo.toISOString()),
    ])
      .then(([wk, mo]) => setMoney({ week: wk.total, month: mo.total }))
      .catch(() => setMoney(null));
    fetchCreditsRoster().then(setRoster).catch(() => setRoster([]));
  }, [isStaff, data]);

  const items = data?.items ?? [];

  function onItemClick(it: CalendarItem) {
    if (isStaff) setEditing({ item: it });
    else setSelected(it);
  }
  function onEmptyClick(day: Date, hour: number) {
    if (!isStaff) return;
    const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
    setEditing({ item: null, start: s });
  }

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
          {isStaff && (
            <button type="button" aria-label="Calendar settings" onClick={() => setSettingsOpen(true)} className="p-2 text-green-800 hover:bg-green-50 rounded-md focus-ring">
              <Settings size={18} />
            </button>
          )}
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

      {isStaff && money && (
        <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-green-900">
            <Wallet size={15} className="text-gold-ink" aria-hidden="true" />
            This week <strong>${money.week.toFixed(0)}</strong>
          </span>
          <span className="text-green-900">This month <strong>${money.month.toFixed(0)}</strong></span>
          {roster && roster.length > 0 && (
            <button type="button" className="text-green-800 underline underline-offset-2" onClick={() => setRosterOpen((o) => !o)}>
              {roster.length} with credits
            </button>
          )}
        </div>
      )}
      {isStaff && rosterOpen && roster && (
        <div className="bg-white border border-green-800/10 rounded-lg p-3 mb-3 max-w-sm">
          <p className="form-label mb-1">Credits / plan balances</p>
          <ul className="text-sm divide-y divide-green-800/5">
            {roster.map((r) => (
              <li key={r.client_id} className="flex justify-between py-1">
                <span className="text-green-900">{r.name || 'Client'}</span>
                <span className="text-green-800 font-medium">{r.credits_remaining}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isStaff && <RequestsBar onDecided={() => void load()} />}

      {error && <p role="alert" className="form-error mb-3">{error}</p>}

      <div className="bg-white border border-green-800/10 rounded-lg overflow-x-auto">
        {view === 'week' ? (
          <WeekGrid
            weekStart={range.from}
            openHour={openHour}
            closeHour={closeHour}
            items={items}
            onSelect={onItemClick}
            onEmpty={isStaff ? onEmptyClick : undefined}
          />
        ) : (
          <MonthGrid anchor={anchor} items={items} onPickDay={(d) => { setView('week'); setAnchor(d); }} />
        )}
      </div>

      {loading && <p className="text-sm text-muted mt-3">Loading…</p>}

      {selected && (
        <DetailPanel
          item={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); void load(); }}
        />
      )}
      {editing && (
        <CalendarItemPanel
          item={editing.item}
          defaultStart={editing.start}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
      {settingsOpen && (
        <CalendarSettingsPanel onClose={() => setSettingsOpen(false)} onSaved={() => void load()} />
      )}
    </div>
  );
}

function WeekGrid({
  weekStart,
  openHour,
  closeHour,
  items,
  onSelect,
  onEmpty,
}: {
  weekStart: Date;
  openHour: number;
  closeHour: number;
  items: CalendarItem[];
  onSelect: (i: CalendarItem) => void;
  onEmpty?: (day: Date, hour: number) => void;
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
              <div
                key={d.toISOString()}
                className={`border-l border-green-800/10 min-h-[44px] p-0.5 space-y-0.5 ${onEmpty ? 'cursor-pointer hover:bg-green-50/50' : ''}`}
                onClick={onEmpty && cell.length === 0 ? () => onEmpty(d, h) : undefined}
              >
                {cell.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSelect(it); }}
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

/** The client-side detail + actions panel (Slice 4): book an open slot, or
 *  reschedule / cancel / defer your own booking. */
function DetailPanel({ item, onClose, onChanged }: { item: CalendarItem; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [mode, setMode] = useState<'view' | 'reschedule'>('view');
  const [newStart, setNewStart] = useState('');
  const [scope, setScope] = useState('one');
  const [fee, setFee] = useState(0);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => { fetchRescheduleFee().then(setFee).catch(() => setFee(0)); }, []);

  const isAvailable = item.status === 'available';
  const isMine = !!item.is_mine;
  const canChange = isMine && ['scheduled', 'confirmed', 'pending'].includes(item.status);
  const hoursOut = (new Date(item.starts_at).getTime() - Date.now()) / 3_600_000;
  const feeNow = hoursOut < 48 ? fee : 0;
  const phoneRequired = hoursOut < 24;
  const durationMs = item.ends_at ? new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime() : 3_600_000;

  async function book() {
    setBusy(true); setError(null); setNoCredits(false);
    try {
      await bookOpenSlot(item.id);
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('NO_CREDITS')) setNoCredits(true);
      else setError(toErrorMessage(e, 'Could not book that time.'));
    } finally { setBusy(false); }
  }

  async function change(kind: 'reschedule' | 'cancel' | 'defer') {
    setBusy(true); setError(null);
    try {
      const payload =
        kind === 'reschedule'
          ? { bookingId: item.id, kind, newStart: new Date(newStart).toISOString(), newEnd: new Date(new Date(newStart).getTime() + durationMs).toISOString(), scope: item.series_id ? scope : undefined }
          : { bookingId: item.id, kind, scope: item.series_id ? scope : undefined };
      const r = await requestBookingChange(payload);
      setDone(
        r.phone_required
          ? 'Request submitted — a phone call is required to confirm this change. We’ll call you.'
          : r.fee_amount
            ? `Request submitted — a $${r.fee_amount} fee applies; we’ll confirm once it’s settled.`
            : 'Request submitted — pending confirmation.',
      );
      onChanged();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not submit your request.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div className="bg-cream w-full max-w-sm h-full overflow-y-auto shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg text-green-900">{itemLabel(item)}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <dl className="space-y-3 text-sm mb-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">When</dt>
            <dd className="text-green-900">{formatSessionWhen(item.starts_at, item.ends_at)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Status</dt>
            <dd className="text-green-900 capitalize">{item.status.replace(/_/g, ' ')}</dd>
          </div>
          {item.address && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Address</dt>
              <dd><a className="text-green-800 underline" href={`https://maps.apple.com/?daddr=${encodeURIComponent(item.address)}`} target="_blank" rel="noreferrer">{item.address}</a></dd>
            </div>
          )}
          {item.notes && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Notes</dt>
              <dd className="text-green-900 whitespace-pre-line">{item.notes}</dd>
            </div>
          )}
        </dl>

        {done && <p className="bg-green-50 border border-green-200 text-green-800 text-sm p-3 rounded mb-3">{done}</p>}

        {!done && isAvailable && (
          <div>
            {noCredits ? (
              <div className="bg-gold-50 border border-gold-200 p-3 rounded text-sm">
                <p className="text-green-900 mb-2">You don’t have any lesson credits.</p>
                <Link to="/lessons" className="btn-primary text-sm justify-center w-full">Purchase a package</Link>
              </div>
            ) : (
              <button type="button" className="btn-primary w-full justify-center" disabled={busy} onClick={() => void book()}>
                {busy ? 'Booking…' : 'Book this time'}
              </button>
            )}
          </div>
        )}

        {!done && canChange && mode === 'view' && (
          <div className="flex flex-col gap-2">
            <button type="button" className="btn-secondary w-full justify-center" onClick={() => setMode('reschedule')}>Reschedule</button>
            <button type="button" className="btn-secondary w-full justify-center" disabled={busy} onClick={() => void change('defer')}>Defer (get a credit)</button>
            <button type="button" className="text-sm text-red-700 py-2 hover:bg-red-50 rounded" disabled={busy} onClick={() => void change('cancel')}>Cancel this booking</button>
          </div>
        )}

        {!done && canChange && mode === 'reschedule' && (
          <div className="flex flex-col gap-3">
            <label className="text-sm">
              <span className="form-label">New time</span>
              <input type="datetime-local" className="form-input" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </label>
            {item.series_id && (
              <label className="text-sm">
                <span className="form-label">This is a recurring booking — move</span>
                <select className="form-input" value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="one">Just this one</option>
                  <option value="weeks:2">The next 2 weeks</option>
                  <option value="weeks:4">The next 4 weeks</option>
                  <option value="weeks:8">The next 8 weeks</option>
                  <option value="future">This &amp; all future</option>
                  <option value="all">The whole series</option>
                </select>
              </label>
            )}
            {(feeNow > 0 || phoneRequired) && (
              <div className="bg-orange-50 border border-orange-300 text-orange-900 text-xs p-2 rounded">
                {feeNow > 0 && <p>A ${feeNow} reschedule fee applies (inside 48 hours).</p>}
                {phoneRequired && <p>Inside 24 hours — a phone call is required to confirm.</p>}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" className="btn-primary flex-1 justify-center" disabled={busy || !newStart} onClick={() => void change('reschedule')}>
                {busy ? 'Submitting…' : 'Submit request'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setMode('view')}>Back</button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="form-error mt-3">{error}</p>}
      </div>
    </div>
  );
}

/** Staff inbox of pending client change requests, shown atop the calendar. */
function RequestsBar({ onDecided }: { onDecided: () => void }) {
  const [reqs, setReqs] = useState<OpenChangeRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchOpenChangeRequests().then(setReqs).catch(() => setReqs([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(id: string, approve: boolean, waive = false) {
    setBusy(id);
    try {
      await decideBookingChange(id, approve, waive);
      load();
      onDecided();
    } finally { setBusy(null); }
  }

  if (reqs.length === 0) return null;
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
      <p className="form-label mb-2">Pending requests ({reqs.length})</p>
      <ul className="flex flex-col gap-2">
        {reqs.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-white border border-orange-100 rounded p-2">
            <span className="text-green-900">
              <strong className="capitalize">{r.kind}</strong> · {r.client_name || 'Client'} ·{' '}
              {r.kind === 'reschedule' && r.proposed_starts_at
                ? `→ ${formatSessionWhen(r.proposed_starts_at)}`
                : formatSessionWhen(r.starts_at)}
              {r.fee_amount ? ` · $${r.fee_amount}${r.fee_paid ? ' paid' : ' unpaid'}` : ''}
              {r.phone_required ? ' · 📞 call required' : ''}
            </span>
            <span className="flex gap-1">
              <button type="button" className="btn-primary text-xs" disabled={busy === r.id} onClick={() => void decide(r.id, true, !!r.fee_amount && !r.fee_paid)}>
                {r.fee_amount && !r.fee_paid ? 'Approve + waive' : 'Approve'}
              </button>
              <button type="button" className="btn-secondary text-xs" disabled={busy === r.id} onClick={() => void decide(r.id, false)}>Reject</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
