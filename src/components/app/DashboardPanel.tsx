import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Hand } from 'lucide-react';
import { myNotifications, markNotificationRead, countNewRequests, type AppNotification } from '../../lib/api';
import { sayHiBack } from '../../lib/communityFeed';
import { countOpenSupportRequests } from '../../lib/support';
import { timeOfDayWord } from '../../lib/formatDateTime';
import { useAuth } from '../../contexts/AuthContext';
import { myLessonSessions, type MemberLessonSession } from '../../lib/ops/api-member';
import { fetchMyPendingChanges } from '../../lib/ops/api-calendar';
import { fetchHorseOnboardingState, type HorseOnboardingState } from '../../lib/horses';
import { fetchEvents } from '../../lib/community';
import type { CommunityEvent } from '../../lib/community-types';
import { supabase } from '../../lib/supabase';
import { useNavigate as useNav } from 'react-router-dom';

/**
 * DASHBOARD PANEL — the thin, high-value strip above the community feed on the
 * main page. Two bands, LIVE-wired and clickable:
 *   "Needs your attention" — unread notifications (each links to its target) and
 *   "Coming up" — the next scheduled lessons and community events.
 * Renders nothing when there is truly nothing (no placeholder filler).
 */

interface Tile {
  id: string;
  kind: string;
  title: string;
  sub?: string;
  cta: string;
  to: string;
  gold?: boolean;
  /** the underlying notification id — set for notification-backed tiles so they can
   *  be dismissed (marked read → gone). Non-notification tiles omit it. */
  notificationId?: string;
  /** member_hi greetings: the greeter's user_id, for a "Say hi back" action. */
  greeterUserId?: string;
  /** auto-dismiss this tile once it's actually scrolled into view (greetings). */
  dismissOnView?: boolean;
}

function TileCard({ tile, onDismiss }: { tile: Tile; onDismiss?: (opts?: { silent?: boolean }) => void }) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement | null>(null);
  const [saidHiBack, setSaidHiBack] = useState(false);
  const isGreeting = !!tile.greeterUserId;

  // Dismiss-on-VIEW: a greeting clears the moment its tile actually scrolls into view
  // (marks the notification read silently, but stays on screen this session so the
  // user can still Say hi back — it just won't return).
  useEffect(() => {
    if (!tile.dismissOnView || !onDismiss || !ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        onDismiss({ silent: true });
        obs.disconnect();
      }
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [tile.dismissOnView, onDismiss]);

  return (
    <div ref={ref}
      className={`relative rounded-xl p-4 border ${
        tile.gold
          ? 'border-gold-400 shadow-[0_0_0_1px_theme(colors.gold.400)] bg-gradient-to-br from-gold-50 to-white'
          : 'border-green-800/10 bg-white'
      }`}
    >
      {onDismiss && (
        <button type="button" onClick={() => onDismiss()} aria-label="Dismiss"
          className="absolute top-2.5 right-2.5 p-1 text-muted hover:text-green-800 focus-ring rounded-md">
          <X size={15} />
        </button>
      )}
      <p className="text-[9px] tracking-widest uppercase text-gold-800 font-semibold mb-1.5 pr-5">{tile.kind}</p>
      <p className="font-serif text-green-800 text-xl leading-tight font-semibold">{tile.title}</p>
      {tile.sub && <p className="text-sm text-muted mt-1">{tile.sub}</p>}
      {isGreeting ? (
        <button
          type="button"
          disabled={saidHiBack}
          onClick={async () => {
            try { await sayHiBack(tile.greeterUserId!); } catch { /* treat as done */ }
            setSaidHiBack(true);
          }}
          className={`inline-flex items-center gap-1.5 mt-3 text-[10.5px] tracking-wide uppercase px-3.5 py-2 rounded-lg font-medium focus-ring ${
            saidHiBack ? 'bg-green-50 text-green-700 border border-green-200' : 'text-white bg-green-800 hover:bg-green-700'}`}
        >
          <Hand size={13} /> {saidHiBack ? 'Thanked 👋' : 'Say hi back'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => navigate(tile.to)}
          className="inline-flex mt-3 text-[10.5px] tracking-wide uppercase text-white bg-green-800 px-3.5 py-2 rounded-lg font-medium hover:bg-green-700 focus-ring"
        >
          {tile.cta} →
        </button>
      )}
    </div>
  );
}

interface ChecklistRow {
  kind: string; id: string; title: string; action: string; link: string; done: boolean;
}

/** ONE card for everything assigned to the member — the same checklist their
 *  invitation email listed. Ticks itself off live; each row opens its item.
 *  One card instead of a tile per item. */
function ChecklistCard({ rows }: { rows: ChecklistRow[] }) {
  const navigate = useNav();
  const remaining = rows.filter((r) => !r.done).length;
  return (
    <div className="rounded-xl p-4 border border-gold-400 shadow-[0_0_0_1px_theme(colors.gold.400)] bg-gradient-to-br from-gold-50 to-white sm:col-span-2 lg:col-span-3">
      <p className="text-[9px] tracking-widest uppercase text-gold-800 font-semibold mb-1.5">Your checklist</p>
      <p className="font-serif text-green-800 text-xl leading-tight font-semibold mb-2.5">
        {remaining === 0 ? 'All done ✓' : `${remaining} thing${remaining === 1 ? '' : 's'} to take care of`}
      </p>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <button key={`${r.kind}-${r.id}`} type="button" onClick={() => navigate(r.link)}
            className="flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg hover:bg-white/70 focus-ring">
            <span className={`w-[18px] h-[18px] rounded-full grid place-items-center text-[11px] shrink-0 ${
              r.done ? 'bg-green-700 text-white' : 'border-2 border-gold-600/60 text-transparent'
            }`}>
              ✓
            </span>
            <span className="min-w-0">
              <span className={`block text-sm ${r.done ? 'text-muted line-through' : 'text-green-900 font-medium'}`}>{r.title}</span>
              {!r.done && <span className="block text-[11.5px] text-muted">{r.action}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function fmtTime(d: Date): string {
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function DashboardPanel() {
  const [attention, setAttention] = useState<Tile[]>([]);
  const [comingUp, setComingUp] = useState<Tile[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [suggestBooking, setSuggestBooking] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [horse, setHorse] = useState<HorseOnboardingState | null>(null);
  // Staff-only: counts of untriaged inbound inquiries + open support requests. RLS
  // returns 0 for non-staff, and we further gate the support tile on isStaff so a
  // member's own open ticket never links them to the staff-only support page.
  const [newRequests, setNewRequests] = useState(0);
  const [openSupport, setOpenSupport] = useState(0);
  const { isStaff, profile } = useAuth();
  const firstName = profile?.first_name || profile?.display_name || null;

  useEffect(() => {
    let active = true;
    countNewRequests()
      .then((n) => active && setNewRequests(n))
      .catch(() => {});
    if (isStaff) {
      countOpenSupportRequests()
        .then((n) => active && setOpenSupport(n))
        .catch(() => {});
    }
    fetchMyPendingChanges()
      .then((r) => active && setPendingChanges(r.length))
      .catch(() => {});
    fetchHorseOnboardingState()
      .then((h) => active && setHorse(h))
      .catch(() => {});
    Promise.all([
      myNotifications().catch(() => [] as AppNotification[]),
      myLessonSessions().catch(() => [] as MemberLessonSession[]),
      fetchEvents().catch(() => [] as CommunityEvent[]),
      supabase.rpc('my_onboarding_checklist')
        .then(({ data, error }) => (error ? [] : ((data as ChecklistRow[]) ?? []))) as Promise<ChecklistRow[]>,
    ]).then(([notifications, sessions, events, cl]) => {
      if (!active) return;
      const anyPending = cl.some((r) => !r.done);
      setChecklist(anyPending ? cl : []);
      // paperwork done + nothing on the calendar → the suggested first action
      const hasUpcoming = sessions.some((x) => x.status === 'SCHEDULED' && new Date(x.starts_at).getTime() > Date.now());
      setSuggestBooking(cl.length > 0 && !anyPending && !hasUpcoming);
      if (!active) return;
      const now = Date.now();

      // ── needs attention: unread notifications (linked, dismissable) ──
      // Welcome greetings ("[member] said hi") appear here like any notification, but
      // they auto-dismiss the moment their tile is actually SEEN (dismissOnView) — a
      // one-time hello, not a standing to-do — and carry a "Say hi back" action.
      const att: Tile[] = notifications
        .filter((n) => !n.read_at)
        .slice(0, 3)
        .map((n) => {
          const greeter = n.kind === 'member_hi' ? (n.link?.match(/hi_back=([0-9a-f-]{36})/i)?.[1] ?? null) : null;
          return {
            id: `n-${n.id}`, notificationId: n.id, kind: n.kind.replace(/_/g, ' '), title: n.title,
            sub: n.body ?? undefined, cta: 'Open', to: n.link || '/app', gold: true,
            greeterUserId: greeter ?? undefined,
            dismissOnView: n.kind === 'member_hi',
          };
        });

      // ── coming up: next lessons + next events ──
      const up: Tile[] = [];
      for (const s of sessions) {
        if (s.status !== 'SCHEDULED') continue;
        const t = new Date(s.starts_at);
        if (t.getTime() < now) continue;
        up.push({
          id: `l-${s.id}`, kind: 'lesson', title: fmtTime(t),
          sub: s.location ?? undefined, cta: 'Schedule', to: '/app/schedule',
        });
        if (up.length >= 2) break;
      }
      for (const e of events) {
        if (!e.starts_at || new Date(e.starts_at).getTime() < now) continue;
        up.push({
          id: `e-${e.id}`, kind: 'event', title: e.title,
          sub: fmtTime(new Date(e.starts_at)), cta: 'Details', to: '/app/schedule',
        });
        if (up.length >= 4) break;
      }

      setAttention(att.slice(0, 3));
      setComingUp(up.slice(0, 3));
    });
    return () => { active = false; };
  }, [isStaff]);

  // The horse documents are their own persistent item — shown until they're
  // signed (or until a horse is added, when one is needed). The "your service
  // won't begin" warning shows ONLY when a horse-care service has been purchased
  // and is waiting on an unsigned release.
  const horseCard = horse && (horse.pending_horse_docs.length > 0 || horse.needs_horse);
  const horseTile: Tile | null = horseCard
    ? {
        id: 'horse-docs',
        kind: 'horse documents',
        gold: horse!.service_blocked,
        title: horse!.needs_horse ? 'Add your horse to continue' : 'Complete your horse documents',
        sub: horse!.service_blocked
          ? 'Your purchased horse-care service won’t begin until these are completed and signed.'
          : horse!.needs_horse
            ? 'Add your horse’s details so we can prepare its documents.'
            : `${horse!.pending_horse_docs.length} document${horse!.pending_horse_docs.length > 1 ? 's' : ''} to review & sign.`,
        cta: horse!.needs_horse ? 'Add your horse' : 'Review & sign',
        to: horse!.needs_horse
          ? '/app/horse-intake'
          : (horse!.pending_horse_docs[0]?.link ?? '/app/horse-intake'),
      }
    : null;

  // Dismiss a notification tile. `silent` (auto-dismiss-on-view for greetings) marks
  // it read server-side but KEEPS it on screen this session, so the user can still act
  // on it — it just won't return on reload. The manual × removes it from view too.
  function dismiss(notificationId: string, opts?: { silent?: boolean }) {
    markNotificationRead(notificationId).catch(() => {});
    if (!opts?.silent) setAttention((prev) => prev.filter((t) => t.notificationId !== notificationId));
  }

  const hasAttention = attention.length > 0 || checklist.length > 0 || suggestBooking
    || pendingChanges > 0 || !!horseTile || newRequests > 0 || (isStaff && openSupport > 0);
  // Empty state: nothing needs attention and nothing's coming up → a warm all-clear
  // greeting (owner directive) instead of hiding the panel entirely.
  const allCaughtUp = !hasAttention && comingUp.length === 0;

  return (
    <div className="rounded-2xl border border-green-800/10 shadow-[0_14px_34px_-14px_rgba(13,33,24,0.22)] bg-gradient-to-br from-white to-cream-100 mb-6 sm:mb-7 p-5 sm:p-6">
      {allCaughtUp && (
        <p className="body-text text-green-900 text-sm sm:text-base">
          Hi{firstName ? ` ${firstName}` : ''}! Looks like you’re all caught up, nothing new to report.
          Enjoy your {timeOfDayWord()}!
        </p>
      )}
      {hasAttention && (
        <>
          <p className="text-[10px] tracking-widest uppercase text-gold-800 font-semibold mb-3">Needs your attention</p>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Staff-only, persistent until the inbox is triaged: new website inquiries.
                Shown first so a new inquiry can't be pushed off by other tiles. */}
            {newRequests > 0 && (
              <TileCard tile={{
                id: 'new-inquiries', kind: 'inbox', gold: true,
                title: `${newRequests} new ${newRequests === 1 ? 'inquiry' : 'inquiries'} to review`,
                sub: newRequests === 1
                  ? 'A website visitor is waiting to hear back.'
                  : 'Website visitors are waiting to hear back.',
                cta: 'Open the Request Inbox', to: '/app/ops/intake',
              }} />
            )}
            {/* Staff-only, persistent until triaged: open support requests. */}
            {isStaff && openSupport > 0 && (
              <TileCard tile={{
                id: 'open-support', kind: 'support', gold: true,
                title: `${openSupport} open support request${openSupport === 1 ? '' : 's'}`,
                sub: openSupport === 1
                  ? 'A member is waiting on a reply.'
                  : 'Members are waiting on a reply.',
                cta: 'Open Support', to: '/app/ops/support',
              }} />
            )}
            {horseTile && <TileCard tile={horseTile} />}
            {checklist.length > 0 && <ChecklistCard rows={checklist} />}
            {pendingChanges > 0 && (
              <TileCard tile={{
                id: 'pending-changes', kind: 'suggestion',
                title: `${pendingChanges} pending request${pendingChanges > 1 ? 's' : ''}`,
                sub: 'Awaiting confirmation from our team.',
                cta: 'View on calendar', to: '/app/calendar',
              }} />
            )}
            {suggestBooking && (
              <TileCard tile={{
                id: 'book-first', kind: 'suggestion', gold: true,
                title: 'Book your next lesson',
                sub: 'Paperwork done — pick a time that suits you.',
                cta: 'Book a lesson', to: '/app/calendar',
              }} />
            )}
            {attention.map((t) => <TileCard key={t.id} tile={t} onDismiss={t.notificationId ? (opts) => dismiss(t.notificationId!, opts) : undefined} />)}
          </div>
        </>
      )}
      {comingUp.length > 0 && (
        <>
          <p className={`text-[10px] tracking-widest uppercase text-muted font-semibold mb-3 ${hasAttention ? 'mt-5' : ''}`}>Coming up</p>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {comingUp.map((t) => <TileCard key={t.id} tile={t} />)}
          </div>
        </>
      )}
    </div>
  );
}
