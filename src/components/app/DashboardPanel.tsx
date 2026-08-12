import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { fromHere } from '../../lib/linkOrigin';
import { X, Hand, MailWarning } from 'lucide-react';
import { myNotifications, consumeNotification, markNotificationRead, type AppNotification } from '../../lib/api';
import { sayHiBack } from '../../lib/communityFeed';
import { timeOfDayWord } from '../../lib/formatDateTime';
import { useAuth } from '../../contexts/AuthContext';
import { myLessonSessions, type MemberLessonSession } from '../../lib/ops/api-member';
import { fetchMyPendingChanges } from '../../lib/ops/api-calendar';
import { fetchHorseOnboardingState, type HorseOnboardingState } from '../../lib/horses';
import { fetchAcquisitionIntakeState, type AcquisitionIntakeState } from '../../lib/acquisition';
import { fetchEvents } from '../../lib/community';
import type { CommunityEvent } from '../../lib/community-types';
import { supabase } from '../../lib/supabase';
import { useNavigate as useNav } from 'react-router-dom';
import { useOpenLeads } from '../../lib/ops/useOpenLeads';
import { LeadWorkDrawer } from './LeadWorkDrawer';
import type { BookingRequest } from '../../lib/ops/api-intake';

/**
 * DASHBOARD PANEL — the thin, high-value strip above the community feed on the
 * main page. Bands, LIVE-wired and clickable:
 *   "New leads" (staff only) — open booking requests + open support tickets.
 *   TASK-DASHLEADS folded the Inbound queue in here; TASK-LEADCLEAN made this
 *   the ONLY surface for it (/app/ops/intake is retired) and made the list
 *   clean itself: a lead whose person already holds a client record leaves the
 *   open list on its own, derived from `inbound_queue.already_converted`, with
 *   no status for anyone to remember to set. Those leads are not lost — they
 *   move to "already became clients" below the band, each linking to the record
 *   they turned into. No request row is ever deleted.
 *   "Needs your attention" — unread notifications (each links to its target) and
 *   "Coming up" — the next scheduled lessons and community events.
 * Renders nothing when there is truly nothing (no placeholder filler).
 */

/** How many lead cards show before the band collapses the rest behind a count. */
const LEAD_PREVIEW = 6;

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
  /** Handle the CTA HERE instead of navigating to `to` — a lead card opens its
   *  working drawer in place rather than sending staff to another page. */
  onActivate?: () => void;
  /** INBOUNDALERT: one line admitting the email alert for this lead did not
   *  reach the owner. Additive to LEADCLEAN's shipped card — the layout is
   *  untouched, this only appears when there is something to admit. */
  warn?: string;
}

function TileCard({ tile, onDismiss, onOpen }: {
  tile: Tile;
  onDismiss?: (opts?: { silent?: boolean }) => void;
  /** fires when the CTA is used to open the target (for consume-on-visit) */
  onOpen?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
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
      {tile.warn && (
        <p className="flex items-start gap-1.5 text-[12.5px] text-red-700 mt-2 leading-snug">
          <MailWarning size={14} className="shrink-0 mt-px" aria-hidden />
          <span>{tile.warn}</span>
        </p>
      )}
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
          /* RETURN-TO-ORIGIN: a contract opened from a dashboard notification
             sends the reader back HERE after a void/close, rather than to the
             generic documents list. ContractPage validates this and falls back
             on its own if it is ever unusable. */
          onClick={() => {
            onOpen?.();
            if (tile.onActivate) { tile.onActivate(); return; }
            navigate(tile.to, { state: fromHere(location) });
          }}
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
  const navigate = useNav();
  const [attention, setAttention] = useState<Tile[]>([]);
  const [comingUp, setComingUp] = useState<Tile[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [suggestBooking, setSuggestBooking] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [horse, setHorse] = useState<HorseOnboardingState | null>(null);
  const [acqIntake, setAcqIntake] = useState<AcquisitionIntakeState | null>(null);
  const { profile, isStaff } = useAuth();
  const firstName = profile?.first_name || profile?.display_name || null;
  const { open: leads, converted, reload: reloadLeads } = useOpenLeads(isStaff);
  // The lead being worked, in a drawer over the dashboard. Opening a lead used
  // to navigate to /app/ops/intake — a page that no longer exists — so the whole
  // working surface comes here instead (LeadWorkDrawer, the same component the
  // Inbound page used).
  const [openLead, setOpenLead] = useState<BookingRequest | null>(null);
  const [leadsExpanded, setLeadsExpanded] = useState(false);
  const [convertedOpen, setConvertedOpen] = useState(false);
  const leadTiles: Tile[] = leads.map((l) => ({
    id: l.id, kind: 'lead', title: l.title, sub: l.sub, cta: 'Review', to: l.to, gold: true,
    onActivate: l.request ? () => setOpenLead(l.request!) : undefined,
    // Set only when the ops-inbox email did not reach him. The lead is captured
    // regardless — this says he was not told, which is a different failure.
    warn: l.alertWarning,
  }));

  // Deep link: notification writers emit /app/ops/intake?request=<id>, which the
  // retirement redirect forwards here. Open that lead's drawer once it has
  // loaded, so the link still lands on the request rather than on a bare page.
  const [searchParams] = useSearchParams();
  const linkedRequest = searchParams.get('request');
  const autoOpened = useRef<string | null>(null);
  useEffect(() => {
    if (!linkedRequest || autoOpened.current === linkedRequest) return;
    const hit = leads.find((l) => l.request?.id === linkedRequest);
    if (hit?.request) { autoOpened.current = linkedRequest; setOpenLead(hit.request); }
  }, [linkedRequest, leads]);
  // Session hide for the member's own live "pending changes" tile (not backed by a
  // notification). Notification tiles are CONSUMED (deleted + logged) instead.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const hide = (id: string) => setHidden((prev) => new Set(prev).add(id));

  useEffect(() => {
    let active = true;
    fetchMyPendingChanges()
      .then((r) => active && setPendingChanges(r.length))
      .catch(() => {});
    fetchHorseOnboardingState()
      .then((h) => active && setHorse(h))
      .catch(() => {});
    fetchAcquisitionIntakeState()
      .then((a) => active && setAcqIntake(a))
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
      // request_new/support_new are excluded here (TASK-DASHLEADS): they now render
      // in the dedicated "New leads" band above, sourced straight from
      // requests/support_requests via useOpenLeads. Leaving them in both places
      // would show the same lead twice and let "dismiss" here look like it closed
      // the lead when the row underneath is untouched.
      const att: Tile[] = notifications
        .filter((n) => !n.read_at && n.kind !== 'request_new' && n.kind !== 'support_new')
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
  }, []);

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

  // Acquisition intake — a Find-a-Horse / Evaluation purchase awaiting the form
  // that tells us what to do (criteria / owner facts).
  const acqPending = acqIntake?.pending?.[0] ?? null;
  const acqTile: Tile | null = acqPending
    ? {
        id: 'acquisition-intake',
        kind: 'acquisition intake',
        gold: true,
        title: acqPending.config_kind === 'intake_finder'
          ? 'Tell us what horse to find'
          : 'Tell us about the horse to evaluate',
        sub: `Complete the intake for your ${acqPending.label} so we can get started.`,
        cta: 'Complete intake',
        to: `/app/acquisition-intake?item=${acqPending.purchase_item_id}`,
      }
    : null;

  // Close a notification tile. A manual close CONSUMES it — deletes the
  // notification (per-user) and leaves an audit-log entry — so it's gone for good
  // and never returns on this user's dashboard (matching the phone-handled case;
  // the other owner's copy is untouched). `silent` is the greetings' auto-on-view
  // path: mark read only, keep on screen this session (a one-time hello).
  function dismiss(notificationId: string, opts?: { silent?: boolean }) {
    if (opts?.silent) {
      markNotificationRead(notificationId).catch(() => {});
      return;
    }
    consumeNotification(notificationId).catch(() => {});
    setAttention((prev) => prev.filter((t) => t.notificationId !== notificationId));
  }

  // pending-changes is the member's own live state; still session-hideable.
  const showPending = pendingChanges > 0 && !hidden.has('pending-changes');

  const hasAttention = attention.length > 0 || checklist.length > 0 || suggestBooking
    || showPending || !!horseTile || !!acqTile;
  // Empty state: nothing needs attention and nothing's coming up → a warm all-clear
  // greeting (owner directive) instead of hiding the panel entirely.
  const allCaughtUp = !hasAttention && comingUp.length === 0
    && leadTiles.length === 0 && converted.length === 0;
  const visibleLeads = leadsExpanded ? leadTiles : leadTiles.slice(0, LEAD_PREVIEW);
  const hiddenLeads = leadTiles.length - Math.min(leadTiles.length, LEAD_PREVIEW);

  return (
    <div className="rounded-2xl border border-green-800/10 shadow-[0_14px_34px_-14px_rgba(13,33,24,0.22)] bg-gradient-to-br from-white to-cream-100 mb-6 sm:mb-7 p-5 sm:p-6">
      {allCaughtUp && (
        <div className="body-text text-green-900 text-sm sm:text-base flex flex-col gap-1">
          <p>Hi{firstName ? ` ${firstName}` : ''}!</p>
          <p>Looks like you’re all caught up, nothing new to report.</p>
          <p>Enjoy your {timeOfDayWord()}!</p>
        </div>
      )}
      {/* New leads — staff only. Booking requests still `new` + support requests
          not yet `resolved`, read directly (TASK-DASHLEADS: the Inbound nav
          destination is gone; this is where they live now). Its own heading,
          separate from "Needs your attention" below: that band is personal,
          per-user, and dismissable; this one is the shared work queue every
          staff account sees the same rows in, until the row itself changes
          status. */}
      {visibleLeads.length > 0 && (
        <>
          <p className="text-[10px] tracking-widest uppercase text-gold-800 font-semibold mb-3">
            New leads
          </p>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleLeads.map((t) => <TileCard key={t.id} tile={t} />)}
          </div>
          {/* EXPAND, in place. This used to navigate to /app/ops/intake, which
              showed a differently-filtered list — so "1 more waiting" led to a
              page with many more, and the destination is now retired anyway.
              The count is the real remainder of THIS list. */}
          {hiddenLeads > 0 && (
            <button type="button" onClick={() => setLeadsExpanded((v) => !v)}
              aria-expanded={leadsExpanded}
              className="mt-2.5 text-[12px] text-gold-800 font-semibold hover:underline">
              {leadsExpanded ? 'Show fewer' : `Show ${hiddenLeads} more waiting`}
            </button>
          )}
        </>
      )}
      {/* Leads that retired themselves — the person is already a client, so the
          card is out of the open list above. Shown, not hidden: a lead that
          silently vanishes is its own kind of confusion, and this says what
          happened and links to who they became. Collapsed by default because it
          is history, not work. */}
      {converted.length > 0 && (
        <div className={visibleLeads.length > 0 ? 'mt-3' : ''}>
          <button type="button" onClick={() => setConvertedOpen((v) => !v)}
            aria-expanded={convertedOpen}
            className="text-[12px] text-muted font-medium hover:text-green-800 focus-ring rounded">
            {converted.length} {converted.length === 1 ? 'lead' : 'leads'} already became{' '}
            {converted.length === 1 ? 'a client' : 'clients'} {convertedOpen ? '−' : '+'}
          </button>
          {convertedOpen && (
            <div className="mt-2 flex flex-col gap-1.5">
              {converted.map((c) => (
                <div key={c.requestId}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-cream-100/60 px-3 py-2">
                  <span className="text-sm text-green-900 font-medium">{c.name}</span>
                  <span className="text-[11.5px] text-muted">
                    enquired {new Date(c.createdAt).toLocaleDateString()} · now a client
                  </span>
                  {c.contactId && (
                    <button type="button" onClick={() => navigate(`/app/admin?open=${c.contactId}`)}
                      className="ml-auto text-[11.5px] text-gold-800 font-semibold hover:underline">
                      Open record →
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {hasAttention && (
        <>
          <p className={`text-[10px] tracking-widest uppercase text-gold-800 font-semibold mb-3 ${visibleLeads.length > 0 ? 'mt-5' : ''}`}>Needs your attention</p>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {horseTile && <TileCard tile={horseTile} />}
            {acqTile && <TileCard tile={acqTile} />}
            {checklist.length > 0 && <ChecklistCard rows={checklist} />}
            {showPending && (
              <TileCard tile={{
                id: 'pending-changes', kind: 'suggestion',
                title: `${pendingChanges} pending request${pendingChanges > 1 ? 's' : ''}`,
                sub: 'Awaiting confirmation from our team.',
                cta: 'View on calendar', to: '/app/calendar',
              }} onDismiss={() => hide('pending-changes')} />
            )}
            {suggestBooking && (
              <TileCard tile={{
                id: 'book-first', kind: 'suggestion', gold: true,
                title: 'Book your next lesson',
                sub: 'Paperwork done — pick a time that suits you.',
                cta: 'Book a lesson', to: '/app/calendar',
              }} />
            )}
            {attention.map((t) => (
              <TileCard key={t.id} tile={t}
                onDismiss={t.notificationId ? (opts) => dismiss(t.notificationId!, opts) : undefined}
                // Opening the target consumes it too — but not greetings (they use
                // "say hi back", and their consume-on-view is handled separately).
                onOpen={t.notificationId && !t.greeterUserId
                  ? () => { consumeNotification(t.notificationId!).catch(() => {}); }
                  : undefined} />
            ))}
          </div>
        </>
      )}
      {comingUp.length > 0 && (
        <>
          <p className={`text-[10px] tracking-widest uppercase text-muted font-semibold mb-3 ${(hasAttention || visibleLeads.length > 0) ? 'mt-5' : ''}`}>Coming up</p>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {comingUp.map((t) => <TileCard key={t.id} tile={t} />)}
          </div>
        </>
      )}
      {/* The whole lead workflow, over the dashboard: fit checklist, call notes,
          mark contacted, send as gift, provision + invite, schedule the lesson.
          The same component the retired Inbound page used — extracted, not
          rebuilt, so the machinery survived the page. */}
      {openLead && (
        <LeadWorkDrawer
          request={openLead}
          onClose={() => setOpenLead(null)}
          onChanged={reloadLeads}
        />
      )}
    </div>
  );
}
