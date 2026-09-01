import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CalendarClock, ChevronLeft, ChevronRight, Wallet, Settings } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { weekWindow, monthWindow } from '../../lib/dashboard/windows';
/* §7.4 — the same formatter the dashboard tile uses. The probe caught these
   printing as `$1,510` and `$1510`: one number, rendered two ways, is exactly
   the disagreement this task exists to remove. */
import { usd } from '../../lib/dashboard/format';
import { PageCreateButton } from '../../components/app/PageCreateButton';
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
  ensureStandingSlots,
  requestBookingChange,
  requestOpenTime,
  fetchRescheduleFee,
  fetchOpenChangeRequests,
  decideBookingChange,
  confirmBooking,
  bookingAwaitsPayment,
  proposeBookingTime,
  fetchMyPendingChanges,
  updateMyPendingBooking,
  withdrawMyPendingBooking,
  fetchMyStandingSlots,
  type OpenChangeRequest,
  type MyPendingChange,
  type StandingSlot,
} from '../../lib/ops/api-calendar';
import { StandingSlotPicker } from '../../components/app/StandingSlotPicker';
import { serviceLabel, standingSlotSummary } from '../../lib/standingSlots';
import { fetchOfferings, createDraftOrder } from '../../lib/api';
import type { Offering } from '../../lib/types';
import { myBookableItems, type MemberBookableItem } from '../../lib/ops/api-member';
import { Modal } from '../../components/ops/kit/Modal';
import { useFormDraft } from '../../lib/formState';
import { toErrorMessage } from '../../lib/ops/errors';
import { useNavigate, Link } from 'react-router-dom';
import { listStableHorses, type StableHorse } from '../../lib/stable';
import { formatSessionWhen, formatTimeRange } from '../../lib/formatDateTime';
import { CalendarItemPanel } from './CalendarItemPanel';
import { CalendarSettingsPanel } from './CalendarSettingsPanel';
import { SessionNotesView } from '../../components/app/SessionNotesView';
import { BookingItemSwap } from '../../components/app/BookingItemSwap';
import { FeeChooser } from '../../components/app/FeeChooser';

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

/** PLUSPASS — the "+ Booking" control doesn't have a grid cell to anchor on,
 *  so it defaults to the next on-the-hour slot inside business hours (rolling
 *  to tomorrow's open if we're past close). Both the staff editor and the
 *  client's open-time request treat this as a suggestion the person can
 *  still change inside the panel/adjust with staff after submitting. */
function nextBookableSlot(openHour: number, closeHour: number): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  if (d.getHours() < openHour) d.setHours(openHour);
  else if (d.getHours() >= closeHour) { d.setDate(d.getDate() + 1); d.setHours(openHour); }
  return d;
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
    // ⚠️ TASK-LIFECYCLE — the three stages before a session is firm. Asked for,
    // said yes to, payment declared: all orange, because to anyone looking at
    // the calendar they are the same thing — not settled yet.
    case 'requested':
    case 'approved':
    case 'pending':
      return 'bg-orange-50 border border-orange-400 text-orange-800';
    // A HELD SLOT. `moved` is what the parties see on their own row;
    // `pending_reschedule` is what everyone else gets from calendar_free_busy
    // over the same booking. Dashed, because the owner's point is that it is
    // occupied AND likely to open up — a solid block would say the opposite.
    case 'moved':
    case 'pending_reschedule':
      return 'bg-orange-50 border border-dashed border-orange-500 text-orange-800';
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
  // ⚠️ TASK-LIFECYCLE — the ONE new label. A sixth colour with no legend row is
  // a colour nobody can read, so it ships with the state it explains.
  { label: 'Pending reschedule', cls: 'bg-orange-50 border border-dashed border-orange-500' },
];

/** A short label for an item the caller may or may not see detail on. */
function itemLabel(item: CalendarItem): string {
  const title = item.notes?.trim();
  if (item.status === 'available') return 'Open';
  // a block is an appointment/unavailable — show its title when we have it
  // (staff see every title; a client sees only their own linked appointment's).
  if (item.kind === 'block') return title || 'Unavailable';
  if (item.status === 'unavailable') return 'Unavailable';
  // ⚠️ TASK-LIFECYCLE — an outsider over a held slot. It is somebody else's
  // time, and the only thing they are told is that it may open up.
  if (item.status === 'pending_reschedule') return 'Pending reschedule';
  // ...and the parties' own row. `cancelled` was invisible to EVERYONE before
  // this task, including the people it happened to (calendar_free_busy filtered
  // it out in the WHERE); now they see it, so it needs a word.
  if (item.is_mine && item.status === 'cancelled') return 'Cancelled';
  if (item.is_mine && item.status === 'moved') return 'Moving — awaiting approval';
  // D25 (SLOTREACH §4) — "booking" is INTERNAL TAXONOMY and must never appear on a
  // calendar chip. A rider's own item is a Riding Lesson; a horse-care item is a
  // session with their horse; someone else's is opaque anyway.
  if (item.is_mine) return item.kind === 'lesson' ? 'Your Riding Lesson' : 'Your session';
  return 'Reserved';
}

export default function CalendarPage() {
  useDocumentTitle('Calendar');
  /* TASK-DASHBOARDBUILD — THE REACH FOR EVERY SESSION ROW (D17).
     The owner dashboard's Today zone, week strip and notes loop all point at a
     specific session, and this page had no way to be addressed: no query
     params, so the only possible link was "the calendar, somewhere". Two params
     close that:
       ?on=YYYY-MM-DD   open the week containing that date
       ?item=<id>       open that session's panel once the range has loaded
     Both are optional and independent; an id that is not in the loaded range
     simply does not open, which is the honest behaviour for a stale link. */
  const [params] = useSearchParams();
  const wantItem = params.get('item');
  const wantOn = params.get('on');
  const [view, setView] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState<Date>(() => {
    const on = new URLSearchParams(window.location.search).get('on');
    if (on && /^\d{4}-\d{2}-\d{2}$/.test(on)) return new Date(`${on}T12:00:00`);
    return new Date();
  });
  const [data, setData] = useState<CalendarView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [editing, setEditing] = useState<{ item: CalendarItem | null; start?: Date } | null>(null);
  const [money, setMoney] = useState<{ week: number; month: number } | null>(null);
  const [roster, setRoster] = useState<CreditRosterEntry[] | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [requesting, setRequesting] = useState<Date | null>(null);
  const [buying, setBuying] = useState(false); // A5 — client lesson-purchase panel
  // ONBOARD §7 — the member's own balances, on the page they book from.
  const [myCredits, setMyCredits] = useState<MemberBookableItem[]>([]);
  /* SLOTREACH §1 — THE REACH, ANSWERED PERMANENTLY.
     The standing-slot picker lived inside the onboarding wizard and nowhere else, so
     a member who finished onboarding could never change their weekly time and a
     member who skipped the step could never come back to it (WALK2). This is the
     permanent home: the page they already come to for their schedule, on every
     visit, forever. The order page's link is the transient one. */
  const [standing, setStanding] = useState<StandingSlot[]>([]);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const reloadStanding = useCallback(
    () => fetchMyStandingSlots()
      .then((r) => { setStanding(r); return r; })
      .catch(() => [] as StandingSlot[]),
    [],
  );

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
      setError(toErrorMessage(e, 'Could not load the calendar.'));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  // BUYANDBOOK §4.3 — THE HORIZON, MATERIALISED ON READ. There is no scheduler:
  // `pg_cron` is not installed and the Vercel crons were never created, so nothing
  // wakes up to open next month for a standing weekly slot. Loading a calendar is
  // what rolls it forward — 90 days at a time, idempotent, and a no-op once the
  // window is covered. Once per mount, and the calendar is reloaded only when
  // sessions were actually written.
  const rolled = useRef(false);
  useEffect(() => {
    if (rolled.current) return;
    rolled.current = true;
    ensureStandingSlots()
      .then((r) => { if (r.created > 0) void load(); })
      .catch(() => { /* a horizon that could not roll must never block the calendar */ });
  }, [load]);

  // ONBOARD §7 — reloaded alongside the calendar, so a booking that spends a
  // credit is reflected in the strip without a page refresh.
  useEffect(() => {
    if (isStaff || !data) return;
    let active = true;
    myBookableItems().then((r) => { if (active) setMyCredits(r); }).catch(() => {});
    return () => { active = false; };
  }, [isStaff, data]);

  // SLOTREACH §1 — the member's weekly plans, read alongside their credits. An
  // unchosen slot opens the picker by itself, because it is the one thing they
  // still owe us and the reason their calendar looks empty.
  useEffect(() => {
    if (isStaff || !data) return;
    let cancelled = false;
    void reloadStanding().then((r) => {
      if (cancelled) return;
      if (r.some((x) => !x.chosen)) setSlotsOpen(true);
    });
    return () => { cancelled = true; };
  }, [isStaff, data, reloadStanding]);

  // staff revenue (this week + this month) + credits roster
  useEffect(() => {
    if (!isStaff) return;
    /* TASK-DASHBOARDBUILD §7.4 — the SAME bounds the dashboard ribbon passes,
       from the same helper, so the two surfaces cannot print two figures. */
    const wk = weekWindow();
    const mo = monthWindow();
    Promise.all([
      fetchRevenue(wk.from, wk.to),
      fetchRevenue(mo.from, mo.to),
    ])
      .then(([wk, mo]) => setMoney({ week: wk.total, month: mo.total }))
      .catch(() => setMoney(null));
    fetchCreditsRoster().then(setRoster).catch(() => setRoster([]));
  }, [isStaff, data]);

  /* Memoized because the ?item= effect below depends on it: a fresh array
     identity every render would re-run that effect on every render. */
  const items = useMemo(() => data?.items ?? [], [data]);

  /* ?on= — re-anchor when the param changes within the session (the initial
     value is read in useState above, for the very first render). */
  useEffect(() => {
    if (!wantOn || !/^\d{4}-\d{2}-\d{2}$/.test(wantOn)) return;
    setAnchor(new Date(`${wantOn}T12:00:00`));
  }, [wantOn]);

  /* ?item= — open that session once its range has loaded. Fires once per id:
     re-opening the panel every time the calendar refetches would fight the
     person who just closed it. */
  const openedItem = useRef<string | null>(null);
  useEffect(() => {
    if (!wantItem || !data || openedItem.current === wantItem) return;
    const hit = items.find((x) => x.id === wantItem);
    if (!hit) return;
    openedItem.current = wantItem;
    if (data.role === 'staff') setEditing({ item: hit });
    else setSelected(hit);
  }, [wantItem, data, items]);

  function onItemClick(it: CalendarItem) {
    if (isStaff) setEditing({ item: it });
    else setSelected(it);
  }
  function onEmptyClick(day: Date, hour: number) {
    const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
    if (isStaff) setEditing({ item: null, start: s });
    else setRequesting(s); // client: request this open time
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

  // PLUSPASS — "+ Booking": staff get the same full editor a grid click opens
  // (onEmptyClick); a client gets the same "request this open time" flow.
  function onCreateBooking() {
    const start = nextBookableSlot(openHour, closeHour);
    if (isStaff) setEditing({ item: null, start });
    else setRequesting(start);
  }

  const title =
    view === 'week'
      ? `${range.from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(range.from, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-serif text-2xl text-green-900 inline-flex items-center gap-2">
          <CalendarDays size={22} className="text-gold-ink" aria-hidden="true" /> Calendar
        </h1>
        <div className="flex items-center gap-2">
          {/* D25 — the button used to say "+ Booking", which is the internal word
              for the row it writes, on a surface both staff and clients read. */}
          <PageCreateButton label={isStaff ? 'Calendar item' : 'Request a time'} onClick={onCreateBooking} />
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
        <div className="flex flex-wrap items-center gap-3">
          {!isStaff && (
            <button type="button" className="btn-secondary text-sm" onClick={() => setBuying(true)}>
              Buy lessons
            </button>
          )}
          {LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 text-xs text-green-800/70">
              <span className={`w-3 h-3 rounded-sm ${l.cls}`} /> {l.label}
            </span>
          ))}
        </div>
      </div>

      {isStaff && money && (
        <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
          {/* TASK-DASHBOARDBUILD §5 — the SAME figure the dashboard's revenue
              tile shows, from the same `revenue_summary` call, because they are
              two renderings of one number (D18). Labelled "paid" because that
              is now what it means: money received, on the day it was received.
              It used to be scheduled value and was reading roughly ten times
              high. */}
          <span className="inline-flex items-center gap-1.5 text-green-900">
            <Wallet size={15} className="text-gold-ink" aria-hidden="true" />
            Paid this week <strong>{usd(money.week)}</strong>
          </span>
          <span className="text-green-900">Paid this month <strong>{usd(money.month)}</strong></span>
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

      {/* ── SLOTREACH §1 — THE STANDING WEEKLY TIME, ON THE PAGE THEY LIVE ON ──
          D17: routed is not reachable. A weekly membership is the barn's monthly
          product and its one question — which day and time are yours — could only
          be answered inside an onboarding wizard that a signed client is walked
          past. This bar is the permanent answer to THE REACH: it is on the member's
          own Calendar, it states what they hold in the barn's own words (D25 — a
          Riding Lesson, never "2x Weekly Lessons"), and the picker behind it is the
          same component and the same single writer the wizard uses. */}
      {!isStaff && standing.length > 0 && (
        <div className="bg-white border border-green-800/15 rounded-lg p-4 mb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-green-900">
                <CalendarClock size={15} className="text-gold-ink" aria-hidden="true" />
                Your weekly {standing.length === 1
                  ? serviceLabel(standing[0], Math.max(standing[0].weekly_frequency ?? 1, 1))
                  : 'schedule'}
              </p>
              {standing.map((sl) => {
                const summary = standingSlotSummary(sl);
                return (
                  <p key={sl.purchase_item_id} className="text-sm text-secondary mt-1">
                    {summary
                      ? `${summary} — held for you every week${sl.indefinite ? '' : ` until ${sl.plan_ends_on}`}.`
                      : 'No day and time chosen yet — that is why nothing is on your calendar.'}
                  </p>
                );
              })}
            </div>
            <button type="button"
              className={standing.some((x) => !x.chosen) ? 'btn-primary text-sm' : 'btn-outline-gold text-sm'}
              onClick={() => setSlotsOpen((o) => !o)}>
              {slotsOpen
                ? 'Close'
                : standing.some((x) => !x.chosen)
                  ? 'Select your day and time'
                  : 'Change your day and time'}
            </button>
          </div>
          {slotsOpen && (
            <div className="mt-4 pt-4 border-t border-green-800/10">
              <StandingSlotPicker
                slots={standing}
                audience="client"
                onSaved={() => {
                  // The write materialises the horizon server-side, so the calendar
                  // has new sessions on it the moment this returns.
                  void reloadStanding();
                  void load();
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ONBOARD §7 — "they see the available credits for the items they
          purchased". Staff had a credits roster here for everybody; the member
          could not see their own balance anywhere on the page they book from. */}
      {!isStaff && myCredits.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-green-900">
            <Wallet size={15} className="text-gold-ink" aria-hidden="true" /> Your credits
          </span>
          {myCredits.map((c) => (
            <span key={c.creditId}
              className="text-xs bg-white border border-green-800/15 rounded-full px-3 py-1 text-green-900">
              {c.label} · <strong>{c.creditsRemaining}</strong>
            </span>
          ))}
        </div>
      )}

      {isStaff && <RequestsBar onDecided={() => void load()} />}
      {!isStaff && <MyProposedTimes onDecided={() => void load()} />}

      {error && <p role="alert" className="form-error mb-3">{error}</p>}

      <div className="bg-white border border-green-800/10 rounded-lg overflow-x-auto">
        {view === 'week' ? (
          <WeekGrid
            weekStart={range.from}
            openHour={openHour}
            closeHour={closeHour}
            items={items}
            onSelect={onItemClick}
            onEmpty={onEmptyClick}
          />
        ) : (
          <MonthGrid anchor={anchor} items={items} onSelect={onItemClick}
            onPickDay={(d) => { setView('week'); setAnchor(d); }} />
        )}
      </div>

      {loading && <p className="text-sm text-muted mt-3">Loading…</p>}

      {selected && (
        <DetailPanel
          item={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); void load(); }}
          onBuy={() => { setSelected(null); setBuying(true); }}
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
      {requesting && (
        <RequestTimePanel start={requesting} onClose={() => setRequesting(null)} onDone={() => { setRequesting(null); void load(); }} />
      )}
      {buying && <PurchaseLessonsPanel onClose={() => setBuying(false)} />}
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

/**
 * ⚠️ TASK-FIX2 §4 — WHAT THE MONTH VIEW SHOWED, AND WHY IT SHOWED NOTHING.
 *
 * `dayItems.slice(0, 3)` rendered the first three items in `calendar_free_busy`'s
 * order, which is START TIME. The hourly `/api/calendar-reminders` cron publishes
 * one generated `available` slot per business hour (08:00–20:00, seven days), so
 * every day begins with 8:00 Open, 9:00 Open, 10:00 Open. On Tuesday 2026-09-01
 * the day's two real lessons sat at ranks 10 and 11 — inside "+11 more", which was
 * not clickable. The month view of a working barn showed three empty hours and hid
 * every session on it.
 *
 * ⚠️ THE FURNITURE IS NOT DELETED HERE (AR1 F3/F4/F6). A cron regenerates it hourly
 * and the replacement booking path (`request_open_time`) does not debit a credit
 * yet, so removing it would give lessons away. The fix is ordering and reach:
 * REAL items take the three visible ranks, generated availability fills what is
 * left, and every chip is its own control so a session in view can be opened.
 */
function dayRank(it: CalendarItem): number {
  // 0 = a real session (scheduled / pending / confirmed / completed / draft),
  // 1 = generated open availability. Chronological inside each band.
  return it.status === 'available' ? 1 : 0;
}

function MonthGrid({
  anchor,
  items,
  onPickDay,
  onSelect,
}: {
  anchor: Date;
  items: CalendarItem[];
  onPickDay: (d: Date) => void;
  onSelect: (i: CalendarItem) => void;
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();

  function itemsOn(day: Date): CalendarItem[] {
    return items
      .filter((it) => sameDay(new Date(it.starts_at), day))
      .sort((a, b) => dayRank(a) - dayRank(b)
        || new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
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
            /* The cell is a div carrying the day click, and each chip is its own
               button that stops propagation — the identical shape `WeekGrid`
               already uses for its hour cells, so a chip in the month view opens
               the same panel a chip in the week view does. */
            <div
              key={d.toISOString()}
              onClick={() => onPickDay(d)}
              className={`min-h-[92px] cursor-pointer border-b border-l border-green-800/10 p-1.5 text-left align-top ${
                inMonth ? '' : 'bg-green-800/[0.02] text-green-800/40'
              } ${sameDay(d, today) ? 'bg-gold-50' : ''}`}
            >
              <div className="text-xs font-semibold text-green-900">{d.getDate()}</div>
              <div className="mt-1 space-y-0.5">
                {dayItems.slice(0, 3).map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSelect(it); }}
                    className={`block w-full rounded px-1 py-0.5 text-left text-[10px] leading-tight truncate ${itemClass(it)}`}
                  >
                    {formatTimeRange(it.starts_at, it.ends_at ?? it.starts_at).split(' – ')[0]} {itemLabel(it)}
                  </button>
                ))}
                {dayItems.length > 3 && (
                  /* Says WHAT is hidden, not just how much. Three ranks of "Open"
                     with "+11 more" underneath was the whole defect. */
                  <div className="text-[10px] text-muted">
                    +{dayItems.length - 3} more
                    {dayItems.slice(3).every((it) => it.status === 'available') ? ' open' : ''}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The client-side detail + actions panel (Slice 4): book an open slot, or
 *  reschedule / cancel / defer your own booking. */
function DetailPanel({ item, onClose, onChanged, onBuy }: { item: CalendarItem; onClose: () => void; onChanged: () => void; onBuy: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [mode, setMode] = useState<'view' | 'reschedule'>('view');
  const [newStart, setNewStart] = useState('');
  const [scope, setScope] = useState('one');
  const [fee, setFee] = useState(0);
  const [payShown, setPayShown] = useState(false); // fee payment screen surfaced before submit
  const [done, setDone] = useState<string | null>(null);
  // care bookings pick the horse being cared for, and are gated behind that
  // horse's two signed releases (RELEASE_HORSE_CARE + HORSE_EMERGENCY_VET).
  // lesson bookings offer the same picker, optionally — no docs gate.
  const isCare = item.kind === 'care';
  const isLesson = item.kind === 'lesson';
  const [horses, setHorses] = useState<StableHorse[]>([]);
  const [horseId, setHorseId] = useState('');
  const [docsGate, setDocsGate] = useState<string[] | null>(null);
  // ONBOARD §7 — "select what they are requesting that slot for from the items
  // they purchased". The chosen credit is the one debited; without this the
  // server picked whatever sorted first (FLOWTRACE §9).
  const [items, setItems] = useState<MemberBookableItem[]>([]);
  const [creditId, setCreditId] = useState('');
  // The fee gate's affordances — the same shape as the order payment screen, on
  // purpose: one way to say "I paid", wherever the money comes up.
  const [feeMethod, setFeeMethod] = useState<'zelle' | 'cash' | null>(null);
  const [feeReference, setFeeReference] = useState('');

  useEffect(() => { fetchRescheduleFee().then(setFee).catch(() => setFee(0)); }, []);
  useEffect(() => {
    if (!isCare && !isLesson) return;
    listStableHorses().then(setHorses).catch(() => setHorses([]));
  }, [isCare, isLesson]);
  useEffect(() => {
    if (item.status !== 'available') return;
    myBookableItems().then(setItems).catch(() => setItems([]));
  }, [item.status]);

  const isAvailable = item.status === 'available';
  const isMine = !!item.is_mine;
  // ONBOARD §7: a booking still waiting on us is EDITABLE, not "changeable by
  // request" — nothing has been agreed, so there is nothing to renegotiate.
  // ⚠️ TASK-LIFECYCLE — `requested` is the new first state, and this is what
  // lets the client edit or withdraw their OWN unanswered ask. Without it the
  // member's own request became read-only the moment it was made.
  const isPending = isMine && ['requested', 'pending'].includes(item.status);
  const canChange = isMine && ['scheduled', 'confirmed'].includes(item.status);
  const hoursOut = (new Date(item.starts_at).getTime() - Date.now()) / 3_600_000;
  const feeNow = hoursOut < 48 ? fee : 0;
  const phoneRequired = hoursOut < 24;
  const durationMs = item.ends_at ? new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime() : 3_600_000;
  const feeSettled = feeNow <= 0 || feeMethod !== null;

  async function book() {
    setBusy(true); setError(null); setNoCredits(false); setDocsGate(null);
    try {
      await bookOpenSlot(item.id, (isCare || isLesson) ? horseId || null : null, creditId || null);
      onChanged();
    } catch (e) {
      // BUYANDBOOK §5 — read the code through errorCode, NOT `instanceof Error`: a
      // Supabase refusal is a plain object, so the old test always saw '' and both
      // branches below were dead. The panels existed; nothing could reach them.
      const msg = toErrorMessage(e, '');
      if (msg.includes('NO_CREDITS')) setNoCredits(true);
      else if (msg.includes('HORSE_CARE_DOCS_REQUIRED')) {
        // backend generated whatever was missing for this horse; surface the list.
        const m = msg.match(/\[(.*)\]/);
        setDocsGate(m ? m[1].split(',').map((s) => s.replace(/["\s]/g, '')).filter(Boolean) : []);
      } else setError(toErrorMessage(e, 'Could not book that time.'));
    } finally { setBusy(false); }
  }

  /** Still pending: move it outright. No request, no fee, no waiting. */
  async function editPending() {
    setBusy(true); setError(null);
    try {
      const start = new Date(newStart);
      await updateMyPendingBooking(
        item.id, start.toISOString(), new Date(start.getTime() + durationMs).toISOString());
      setDone('Updated — we’ll confirm your time shortly.');
      onChanged();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not update your request.'));
    } finally { setBusy(false); }
  }

  async function withdrawPending() {
    setBusy(true); setError(null);
    try {
      const r = await withdrawMyPendingBooking(item.id);
      setDone(r.credit_refunded
        ? 'Withdrawn — your credit is back on your account.'
        : 'Withdrawn.');
      onChanged();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not withdraw your request.'));
    } finally { setBusy(false); }
  }

  async function change(kind: 'reschedule' | 'cancel' | 'defer') {
    setBusy(true); setError(null);
    try {
      const common = {
        bookingId: item.id,
        scope: item.series_id ? scope : undefined,
        // Only a reschedule can attract a fee, and only inside the window.
        feeMethod: kind === 'reschedule' && feeNow > 0 ? feeMethod : null,
        feeReference: kind === 'reschedule' && feeNow > 0 ? feeReference : null,
      };
      const payload =
        kind === 'reschedule'
          ? { ...common, kind, newStart: new Date(newStart).toISOString(), newEnd: new Date(new Date(newStart).getTime() + durationMs).toISOString() }
          : { ...common, kind };
      const r = await requestBookingChange(payload);
      setDone(
        r.fee_amount
          ? `Request submitted — we’ve noted the $${r.fee_amount} fee${
              r.fee_method === 'cash' ? ' as cash at the ranch' : ' as sent by Zelle'
            }. We’ll confirm once it’s settled.`
          : r.phone_required
            ? 'Request submitted — a phone call is required to confirm this change. We’ll call you.'
            : 'Request submitted — pending confirmation.',
      );
      onChanged();
    } catch (e) {
      const msg = toErrorMessage(e, '');
      setError(msg.includes('FEE_CONFIRMATION_REQUIRED')
        ? 'Please tell us how you’re paying the change fee before we can submit this.'
        : toErrorMessage(e, 'Could not submit your request.'));
    } finally { setBusy(false); }
  }

  return (
    /* ⚠️ TASK-FIX4 §3 — converged on the shared dialog's `drawer` variant. The
       backdrop no longer closes over a half-filled reschedule or request. */
    <Modal open onClose={onClose} size="sm" panelClassName="bg-cream"
      title={itemLabel(item)} error={error}>
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

        {isMine && (item.kind === 'lesson' || item.kind === 'care') && (
          <SessionNotesView bookingId={item.id} startsAt={item.starts_at} />
        )}

        {done && <p className="bg-green-50 border border-green-200 text-green-800 text-sm p-3 rounded mb-3">{done}</p>}

        {!done && isAvailable && (
          <div className="flex flex-col gap-3">
            {/* ONBOARD §7 — the credits the member actually holds, and which one
                this booking is against. Shown before the horse picker because it
                is the first question the owner's flow asks. */}
            {items.length > 0 ? (
              <label className="text-sm">
                <span className="form-label">What is this time for?</span>
                <select className="form-input" value={creditId} onChange={(e) => setCreditId(e.target.value)}>
                  <option value="">Use my next available credit</option>
                  {items.map((i) => (
                    <option key={i.creditId} value={i.creditId}>
                      {i.label} — {i.creditsRemaining} left
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-xs text-muted">
                You have no sessions left. Taking this time will prompt you to buy.
              </p>
            )}
            {isCare && (
              <label className="text-sm">
                <span className="form-label">Which horse is this for?</span>
                <select className="form-input" value={horseId} onChange={(e) => { setHorseId(e.target.value); setDocsGate(null); }}>
                  <option value="">Select a horse…</option>
                  {horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                {horses.length === 0 && (
                  <span className="block text-xs text-muted mt-1">
                    No horses on file yet. <Link to="/app/account?section=stable" className="text-green-800 underline">Add your horse</Link> first.
                  </span>
                )}
              </label>
            )}
            {isLesson && horses.length > 0 && (
              <label className="text-sm">
                <span className="form-label">Which horse? (optional)</span>
                <select className="form-input" value={horseId} onChange={(e) => setHorseId(e.target.value)}>
                  <option value="">Select a horse…</option>
                  {horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </label>
            )}
            {docsGate ? (
              <div className="bg-gold-50 border border-gold-200 p-3 rounded text-sm">
                <p className="text-green-900 mb-2">
                  Before this horse’s first care session we need two signed releases. We’ve prepared them for you.
                </p>
                <Link to="/app/contracts" className="btn-primary text-sm justify-center w-full">Review &amp; sign paperwork</Link>
              </div>
            ) : noCredits ? (
              <div className="bg-gold-50 border border-gold-200 p-3 rounded text-sm">
                <p className="text-green-900 mb-2">You don’t have any {isCare ? 'service' : 'lesson'} credits.</p>
                <button type="button" className="btn-primary text-sm justify-center w-full" onClick={onBuy}>Buy {isCare ? 'sessions' : 'lessons'}</button>
              </div>
            ) : (
              <button type="button" className="btn-primary w-full justify-center"
                disabled={busy || (isCare && !horseId)} onClick={() => void book()}>
                {busy ? 'Booking…' : 'Book this time'}
              </button>
            )}
          </div>
        )}

        {/* ONBOARD §7 — "until that is confirmed by us it stays pending and its
            fully editable by the user until its confirmed." No request, no fee,
            no approval round-trip: the member moves their own request, or takes
            it back and keeps the credit. */}
        {!done && isPending && (
          <div className="flex flex-col gap-3">
            <p className="text-sm bg-cream-100 border border-green-800/10 p-3 rounded">
              We haven’t confirmed this yet, so it’s still yours to change — no fee.
            </p>
            {/* CREDITALIGN A2 — while it is still a request, the member can also change
                WHICH purchased item it is charged against. Server-gated: once we
                confirm, the same control explains that we will move it for them. */}
            <BookingItemSwap bookingId={item.id} onChanged={onChanged} />
            {mode === 'view' ? (
              <>
                <button type="button" className="btn-secondary w-full justify-center" onClick={() => setMode('reschedule')}>
                  Change the time
                </button>
                <button type="button" className="text-sm text-red-700 py-2 hover:bg-red-50 rounded"
                  disabled={busy} onClick={() => void withdrawPending()}>
                  Withdraw this request
                </button>
              </>
            ) : (
              <>
                <label className="text-sm">
                  <span className="form-label">New time</span>
                  <input type="datetime-local" className="form-input" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
                </label>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary flex-1 justify-center" disabled={busy || !newStart}
                    onClick={() => void editPending()}>
                    {busy ? 'Saving…' : 'Save the new time'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setMode('view')}>Back</button>
                </div>
              </>
            )}
          </div>
        )}

        {!done && canChange && mode === 'view' && (
          <div className="flex flex-col gap-2">
            <BookingItemSwap bookingId={item.id} onChanged={onChanged} />
            {/* D25 — "Reschedule your Riding Lesson", the owner's own words. */}
            <button type="button" className="btn-secondary w-full justify-center" onClick={() => setMode('reschedule')}>
              Reschedule {item.kind === 'lesson' ? 'your Riding Lesson' : 'this session'}
            </button>
            <button type="button" className="btn-secondary w-full justify-center" disabled={busy} onClick={() => void change('defer')}>Defer (get a credit)</button>
            <button type="button" className="text-sm text-red-700 py-2 hover:bg-red-50 rounded" disabled={busy} onClick={() => void change('cancel')}>
              {/* D25 — never "this booking". */}
              Cancel this {item.kind === 'lesson' ? 'Riding Lesson' : 'session'}
            </button>
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
                <span className="form-label">
                  This is a weekly {item.kind === 'lesson' ? 'Riding Lesson' : 'service'} — move
                </span>
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
                {feeNow > 0 && <p>A ${feeNow} change fee applies to this time.</p>}
                {phoneRequired && <p>Inside 24 hours — a phone call is required to confirm.</p>}
              </div>
            )}
            {/* ONBOARD §7 — "the booking doesnt submit to us until they confirm
                they made the payment with zelle or say they will pay cash". The
                gate is enforced server-side too (request_booking_change throws
                FEE_CONFIRMATION_REQUIRED), so this is the affordance, not the
                rule. Same shape as the order payment screen: Zelle with an
                optional confirmation number, or cash. */}
            {feeNow > 0 && payShown && (
              <div className="bg-white border border-green-800/15 rounded p-3 text-sm flex flex-col gap-2">
                <p className="font-medium text-green-900">Settling the ${feeNow} change fee</p>
                <p className="text-green-900/80 text-xs">
                  Send <strong>${feeNow}</strong> via Zelle to <strong>hello@fhequestrian.com</strong>,
                  memo “reschedule” — or pay cash at the ranch. Either way, tell us which below;
                  we’ll confirm the change once it’s settled (staff can also waive it).
                </p>
                <label className="text-xs">
                  <span className="form-label">Confirmation number (optional)</span>
                  <input className="form-input" value={feeReference} disabled={feeMethod === 'cash'}
                    onChange={(e) => setFeeReference(e.target.value)} />
                </label>
                <div className="flex gap-2">
                  <button type="button"
                    className={feeMethod === 'zelle' ? 'btn-primary flex-1 justify-center' : 'btn-secondary flex-1 justify-center'}
                    aria-pressed={feeMethod === 'zelle'}
                    onClick={() => setFeeMethod('zelle')}>
                    I’ve sent it by Zelle
                  </button>
                  <button type="button"
                    className={feeMethod === 'cash' ? 'btn-primary flex-1 justify-center' : 'btn-secondary flex-1 justify-center'}
                    aria-pressed={feeMethod === 'cash'}
                    onClick={() => { setFeeMethod('cash'); setFeeReference(''); }}>
                    I’ll pay cash
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              {feeNow > 0 && !payShown ? (
                <button type="button" className="btn-primary flex-1 justify-center" disabled={!newStart} onClick={() => setPayShown(true)}>
                  Continue to payment
                </button>
              ) : (
                <button type="button" className="btn-primary flex-1 justify-center"
                  disabled={busy || !newStart || !feeSettled}
                  onClick={() => void change('reschedule')}>
                  {busy ? 'Submitting…' : feeNow > 0 ? 'Submit my change' : 'Submit request'}
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={() => { setMode('view'); setPayShown(false); }}>Back</button>
            </div>
            {feeNow > 0 && payShown && !feeSettled && (
              <p className="text-xs text-muted">
                Pick Zelle or cash above — we can’t submit the change until we know.
              </p>
            )}
          </div>
        )}

    </Modal>
  );
}

/** Client: request an arbitrary open time (A2). Availability is a suggestion —
 *  any open in-hours time can be requested; it lands pending for staff to confirm. */
function RequestTimePanel({ start, onClose, onDone }: { start: Date; onClose: () => void; onDone: () => void }) {
  const [duration, setDuration] = useState('60');
  const [note, setNote] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // BOOKLINK B3 — what the client is booking against, from their own
  // purchased items (FLOWTRACE item 7: the offeringId parameter already
  // exists end-to-end; no client surface ever passed it).
  const [items, setItems] = useState<MemberBookableItem[]>([]);
  const [itemCreditId, setItemCreditId] = useState('');

  useEffect(() => {
    myBookableItems().then(setItems).catch(() => setItems([]));
  }, []);

  /* TASK-FIX4 §6 — keyed on the slot, so a request typed for Tuesday 4pm comes
     back to Tuesday 4pm and never to a different time. */
  const draft = useFormDraft(
    `calendar.request-time.${start.toISOString()}`,
    { duration, note, recurring, itemCreditId },
    (d) => {
      if (typeof d.duration === 'string') setDuration(d.duration);
      if (typeof d.note === 'string') setNote(d.note);
      if (typeof d.recurring === 'boolean') setRecurring(d.recurring);
      if (typeof d.itemCreditId === 'string') setItemCreditId(d.itemCreditId);
    },
  );
  function clearForm() {
    setDuration('60'); setNote(''); setRecurring(false); setItemCreditId('');
    setError(null); draft.clear();
  }

  const weekday = start.toLocaleDateString(undefined, { weekday: 'long' });
  const clock = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  async function submit() {
    setBusy(true); setError(null);
    try {
      const endISO = new Date(start.getTime() + Number(duration) * 60_000).toISOString();
      // A5 — a "dedicated weekly slot" request is flagged for staff, who set up
      // the recurring series (payment + confirmation stay a staff-approved step).
      const composed = recurring
        ? `[Requesting a dedicated weekly slot — every ${weekday} at ${clock}] ${note.trim()}`.trim()
        : note.trim();
      const offeringId = items.find((i) => i.creditId === itemCreditId)?.offeringId ?? null;
      await requestOpenTime({ startISO: start.toISOString(), endISO, offeringId, note: composed || undefined });
      setDone(true);
      onDone();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not request that time.'));
    } finally { setBusy(false); }
  }

  return (
    /* ⚠️ TASK-FIX4 §3 — converged on the shared dialog's `drawer` variant. The
       backdrop no longer closes over a half-filled reschedule or request. */
    <Modal open onClose={onClose} size="sm" panelClassName="bg-cream"
      title="Request this time" onClear={clearForm} saveStatus={draft.status}>
        {done ? (
          <p className="bg-green-50 border border-green-200 text-green-800 text-sm p-3 rounded">
            Requested — we’ll confirm your time shortly.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-green-900">{formatSessionWhen(start.toISOString())}</p>
            {items.length > 0 && (
              <label className="text-sm">
                <span className="form-label">What is this time for?</span>
                <select className="form-input" value={itemCreditId} onChange={(e) => setItemCreditId(e.target.value)}>
                  <option value="">Not sure — staff will help</option>
                  {items.map((i) => (
                    <option key={i.creditId} value={i.creditId}>
                      {i.label} ({i.creditsRemaining} left)
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm">
              <span className="form-label">Duration</span>
              <select className="form-input" value={duration} onChange={(e) => setDuration(e.target.value)}>
                {['30', '45', '60', '90'].map((d) => <option key={d} value={d}>{d} minutes</option>)}
              </select>
            </label>
            <label className="flex items-start gap-2 text-sm text-green-900">
              <input type="checkbox" className="mt-0.5" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
              <span>Make this a dedicated weekly slot — same day &amp; time, held for me every week ({weekday}s at {clock}).</span>
            </label>
            <label className="text-sm">
              <span className="form-label">Note (optional)</span>
              <textarea rows={2} className="form-input resize-none" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <p className="form-hint">
              {recurring
                ? 'We’ll set up your weekly time and confirm it. Payment is arranged separately — we confirm each session.'
                : 'You can request any open time — we’ll confirm it (or suggest the nearest fit).'}
            </p>
            <button type="button" className="btn-primary w-full justify-center" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Requesting…' : recurring ? 'Request my weekly slot' : 'Request this time'}
            </button>
            {error && <p role="alert" className="form-error">{error}</p>}
          </div>
        )}
    </Modal>
  );
}

/* A5 — the client buys lessons without leaving the calendar. Lists the lesson
 * offerings and routes the chosen one through the existing draft-order → Zelle
 * checkout (/order/:id). Payment and booking stay decoupled: paying never
 * confirms a time — staff approve each booking. */
function PurchaseLessonsPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [offerings, setOfferings] = useState<Offering[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOfferings()
      .then((all) => setOfferings(all.filter((o) => o.segment === 'rider' && o.active)))
      .catch(() => setError('Could not load lessons to purchase.'));
  }, []);

  async function buy(o: Offering) {
    setBusy(o.id); setError(null);
    try {
      const { orderId } = await createDraftOrder({ items: [{ offering_slug: o.slug }] });
      navigate(`/order/${orderId}`);
    } catch (e) {
      setError(toErrorMessage(e, 'Could not start your purchase.'));
      setBusy(null);
    }
  }

  return (
    /* ⚠️ TASK-FIX4 §3 — converged. A list of things to buy, nothing typed. */
    <Modal open onClose={onClose} size="sm" panelClassName="bg-cream"
      title="Buy lessons" error={error}>
        {offerings === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : offerings.length === 0 ? (
          <p className="text-sm text-muted">No lessons are available to purchase right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {offerings.map((o) => (
              <li key={o.id} className="bg-white border border-green-800/10 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-900">{o.name}</p>
                    {o.tagline && <p className="text-xs text-green-800/70 mt-0.5">{o.tagline}</p>}
                    {o.price_amount != null && (
                      <p className="text-sm text-green-900 mt-1">${o.price_amount}{o.price_unit ? ` / ${o.price_unit}` : ''}</p>
                    )}
                  </div>
                  <button type="button" className="btn-primary text-sm shrink-0" disabled={busy !== null} onClick={() => void buy(o)}>
                    {busy === o.id ? '…' : 'Buy'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="form-hint mt-4">
          You’ll get Zelle payment instructions on the next screen. Each session is still confirmed by our staff — paying holds your purchase, not a specific time.
        </p>
    </Modal>
  );
}

/** Staff inbox of everything awaiting a decision — client-raised reschedule/
 *  cancel/defer asks AND fresh booking requests (REVIEWQ R1/R2), reusing the
 *  same booking_change_requests-backed queue rather than minting a second
 *  page. A 'new' row gets three actions (confirm/decline/propose another
 *  time); a row already countered by staff (awaiting_client) shows a
 *  waiting note instead — the ball is in the client's court. */
function RequestsBar({ onDecided }: { onDecided: () => void }) {
  const [reqs, setReqs] = useState<OpenChangeRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [proposingId, setProposingId] = useState<string | null>(null);
  const [proposeStart, setProposeStart] = useState('');
  const [proposeEnd, setProposeEnd] = useState('');
  // FEECHOICE F1 — approving a reschedule/cancel/defer request opens the fee
  // chooser first (computed / a different policy fee / waived); the chooser's
  // own Apply button is what actually triggers the approval below.
  const [decidingFeeId, setDecidingFeeId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchOpenChangeRequests().then(setReqs).catch(() => setReqs([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(id: string, approve: boolean, waive = false, reason?: string) {
    setBusy(id);
    try {
      await decideBookingChange(id, approve, waive, reason);
      load();
      onDecided();
    } finally { setBusy(null); }
  }

  /** ⚠️ TASK-LIFECYCLE / D19 — IT SAYS WHAT IT IS ABOUT TO DO, BEFORE IT DOES IT.
   *  Approving a request on an order that still owes money does not confirm the
   *  session: it lands on `approved` and emails the client a payment request.
   *  Staff are told which of the two this is before they press, and told again
   *  afterwards, because the two outcomes look identical on the queue. */
  async function confirmNew(bookingId: string, changeId: string) {
    let owes = false;
    try { owes = await bookingAwaitsPayment(bookingId); } catch { owes = false; }
    const ask = owes
      ? 'This order is not paid yet.\n\nApproving it will mark the session APPROVED and send the client a payment request. It is not scheduled until the payment is confirmed.\n\nSend the payment request?'
      : 'Confirm this session? The client will be notified it is scheduled.';
    if (!window.confirm(ask)) return;
    setBusy(changeId);
    try {
      const res = await confirmBooking(bookingId);
      if (res.payment_requested) {
        window.alert('Approved — the payment request has been sent. The session schedules itself once you confirm the money arrived.');
      }
      load();
      onDecided();
    } catch (e) {
      window.alert(toErrorMessage(e, 'Could not approve that request.'));
    } finally { setBusy(null); }
  }

  function declineNew(id: string) {
    const reason = window.prompt('Reason for declining (shown to the client)?') ?? undefined;
    void decide(id, false, false, reason);
  }

  function startPropose(id: string) {
    setProposingId((cur) => (cur === id ? null : id));
    setProposeStart('');
    setProposeEnd('');
  }

  async function sendProposal(bookingId: string, changeId: string) {
    if (!proposeStart || !proposeEnd) return;
    setBusy(changeId);
    try {
      await proposeBookingTime(bookingId, new Date(proposeStart).toISOString(), new Date(proposeEnd).toISOString());
      setProposingId(null);
      load();
      onDecided();
    } catch (e) {
      window.alert(toErrorMessage(e, 'Could not propose that time.'));
    } finally { setBusy(null); }
  }

  if (reqs.length === 0) return null;
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
      <p className="form-label mb-2">Pending requests ({reqs.length})</p>
      <ul className="flex flex-col gap-2">
        {reqs.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 text-sm bg-white border border-orange-100 rounded p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-green-900">
                <strong>{r.kind === 'new' ? 'New request' : <span className="capitalize">{r.kind}</span>}</strong> · {r.client_name || 'Client'} ·{' '}
                {(r.kind === 'reschedule' || r.awaiting_client) && r.proposed_starts_at
                  ? `→ ${formatSessionWhen(r.proposed_starts_at)}`
                  : formatSessionWhen(r.starts_at)}
                {r.fee_amount ? ` · $${r.fee_amount}${r.fee_paid ? ' paid' : ' unpaid'}` : ''}
                {r.phone_required ? ' · 📞 call required' : ''}
              </span>
              {r.awaiting_client ? (
                <span className="text-xs text-muted italic whitespace-nowrap">Waiting on client's response</span>
              ) : r.kind === 'new' ? (
                <span className="flex gap-1">
                  <button type="button" className="btn-primary text-xs" disabled={busy === r.id} onClick={() => void confirmNew(r.booking_id, r.id)}>
                    Confirm
                  </button>
                  <button type="button" className="btn-secondary text-xs" disabled={busy === r.id} onClick={() => declineNew(r.id)}>
                    Decline
                  </button>
                  <button type="button" className="btn-secondary text-xs" disabled={busy === r.id} onClick={() => startPropose(r.id)}>
                    Propose time
                  </button>
                </span>
              ) : (
                <span className="flex gap-1">
                  <button
                    type="button" className="btn-primary text-xs" disabled={busy === r.id}
                    onClick={() => setDecidingFeeId((cur) => (cur === r.id ? null : r.id))}
                  >
                    Decide
                  </button>
                  <button type="button" className="btn-secondary text-xs" disabled={busy === r.id} onClick={() => void decide(r.id, false)}>Reject</button>
                </span>
              )}
            </div>
            {decidingFeeId === r.id && (
              <div className="pt-2 border-t border-orange-100">
                <FeeChooser
                  bookingId={r.booking_id}
                  changeId={r.id}
                  computedAmount={r.fee_amount ?? 0}
                  onCancel={() => setDecidingFeeId(null)}
                  onApplied={(result) => {
                    setDecidingFeeId(null);
                    void decide(r.id, true, result.fee_kind === 'waived');
                  }}
                />
              </div>
            )}
            {proposingId === r.id && (
              <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-orange-100">
                <label className="text-xs">
                  <span className="form-label">New start</span>
                  <input type="datetime-local" className="form-input" value={proposeStart} onChange={(e) => setProposeStart(e.target.value)} />
                </label>
                <label className="text-xs">
                  <span className="form-label">New end</span>
                  <input type="datetime-local" className="form-input" value={proposeEnd} onChange={(e) => setProposeEnd(e.target.value)} />
                </label>
                <button
                  type="button"
                  className="btn-primary text-xs"
                  disabled={busy === r.id || !proposeStart || !proposeEnd}
                  onClick={() => void sendProposal(r.booking_id, r.id)}
                >
                  Send
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={() => setProposingId(null)}>Cancel</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Client's own view of a staff-proposed counter-time (REVIEWQ R2) — the
 *  reversed direction of RequestsBar above: staff already decided (proposed
 *  a different time), and it's this member's turn to accept/decline it. */
function MyProposedTimes({ onDecided }: { onDecided: () => void }) {
  const [changes, setChanges] = useState<MyPendingChange[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyPendingChanges().then(setChanges).catch(() => setChanges([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function respond(id: string, approve: boolean) {
    setBusy(id);
    try {
      await decideBookingChange(id, approve);
      load();
      onDecided();
    } finally { setBusy(null); }
  }

  const proposed = changes.filter((c) => c.awaiting_client);
  if (proposed.length === 0) return null;
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
      <p className="form-label mb-2">We proposed a different time</p>
      <ul className="flex flex-col gap-2">
        {proposed.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-white border border-orange-100 rounded p-2">
            <span className="text-green-900">
              {c.proposed_starts_at ? formatSessionWhen(c.proposed_starts_at) : 'a new time'}
            </span>
            <span className="flex gap-1">
              <button type="button" className="btn-primary text-xs" disabled={busy === c.id} onClick={() => void respond(c.id, true)}>
                Accept
              </button>
              <button type="button" className="btn-secondary text-xs" disabled={busy === c.id} onClick={() => void respond(c.id, false)}>
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
