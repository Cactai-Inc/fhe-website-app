import { serviceLabel } from '../serviceCatalog';

/**
 * THE ZONE REGISTRY — the dashboard's own `pageRegistry`.
 *
 * DASHBOARDS-GROUND-UP-PLAN §7: *"a zone registry in code (the proven
 * `pageRegistry` idiom): key, title, reader RPC, render component, default order
 * per designation."* Same reasoning as that file's header, one level down: code
 * is what actually creates zones, so a table listing them would be a second
 * source of truth that goes stale the first time someone adds one.
 *
 * TWO THINGS LIVE HERE AND NOWHERE ELSE:
 *
 *   THE ORDER. Plan §2: time -> money -> people waiting -> record hygiene ->
 *   stable -> documents -> FYI. Change it here and both views move together.
 *
 *   ⚠️ AND IT DOES NOT NEED A PER-USER EDITOR. Owner, 2026-08-22: *"The dashboard
 *   doesn't need an editor in the traditional sense. Surfaces should be fluid and
 *   dynamic and only shown when there is something to show."* The plan's
 *   `dashboard_prefs` (per-zone pin/hide/reorder) is RULED OUT, not deferred:
 *   a zone that renders only when it holds something already reorders the board
 *   as the day changes, and there is nothing left for a person to arrange. This
 *   list is a design decision, not tenant configuration, so D13 does not bite.
 *   Do not re-open this as unfinished work.
 *
 *   THE REACH (D17). Every zone header is a link to the surface that owns its
 *   work, and every row type resolves to a real route. URLs are built in this
 *   file rather than in SQL because the route table lives in the app — a link
 *   composed in the database goes stale silently the next time a page moves.
 *   Every path below was checked against `src/App.tsx`'s route table on
 *   2026-08-22; `pagevis_registry.test.ts` is the standing guard for the nav's
 *   own paths, and this file is the same discipline for the dashboard's.
 */

export type DashboardView = 'trainer' | 'business';

export interface ZoneDef {
  /** The plan's own zone id — C1, B3 — so a spec and a screen use one word. */
  key: string;
  title: string;
  view: DashboardView;
  /** Ascending. See THE ORDER above. */
  order: number;
  /** One line under the title, when the zone needs explaining. */
  hint?: string;
  /** What the all-quiet footer says is absent. Lower case, no full stop:
   *  "nothing on the calendar today". */
  quiet: string;
  /** The surface that owns this work. The zone header links here. */
  to: string;
}

export const ZONES: ZoneDef[] = [
  /* ── Both desks · what wants you ────────────────────────────────────── */
  /* ⚠️ ONE KEY, TWO VIEWS, ONE LOADER. Owner, 2026-08-26: "the one thing i dont
     see is a clear set of notifications." `notifications` was being written all
     day and read back only by `DashboardPanel`, which DashboardHome shows to
     MEMBERS -- staff are routed to OwnerDashboard, which had no such zone. 77
     unread for admin@ and 60 for hello@ on the day it was found.

     It sits first because it is the only zone whose contents can come from
     anywhere in the app; everything below it is one department's work. It is
     `collapsible` (the only zone that is) and it is NOT sticky -- same ruling as
     the greeting bar on 2026-08-25, "they need to be part of the page and move
     with the rest of the content on scroll." */
  { key: 'N1', view: 'trainer', order: 5, title: 'Notifications',
    quiet: 'no unread notifications', to: '/app/ops/activity' },
  { key: 'N1', view: 'business', order: 5, title: 'Notifications',
    quiet: 'no unread notifications', to: '/app/ops/activity' },

  /* ── Claire · the day sheet ─────────────────────────────────────────── */
  { key: 'C1', view: 'trainer', order: 10, title: 'Today',
    quiet: 'nothing scheduled today', to: '/app/calendar',
    hint: 'Every session today, with whether its plan is ready.' },
  { key: 'C2', view: 'trainer', order: 20, title: 'This week',
    quiet: 'nothing scheduled this week', to: '/app/calendar' },
  { key: 'C3', view: 'trainer', order: 30, title: 'Money waiting',
    quiet: 'no payments waiting on you', to: '/app/ops/payments/review',
    hint: 'Confirming a declared payment governs whether the session happens — it does not unblock the client, who is already unblocked.' },
  { key: 'C4', view: 'trainer', order: 40, title: 'People waiting on a reply',
    quiet: 'nobody is waiting on a reply', to: '/app/records/leads' },
  { key: 'C6', view: 'trainer', order: 50, title: 'Notes loop',
    quiet: 'every session is written up', to: '/app/records/lessons' },
  { key: 'C7', view: 'trainer', order: 60, title: 'The stable',
    quiet: 'no horse needs anything', to: '/app/records/horses' },
  { key: 'C9', view: 'trainer', order: 70, title: 'Documents & onboarding',
    quiet: 'no unsigned paperwork', to: '/app/records/documents' },
  { key: 'C12', view: 'trainer', order: 80, title: 'Evaluations due',
    quiet: 'every rider and horse has their initial evaluation', to: '/app/ops/evaluations' },
  { key: 'C11', view: 'trainer', order: 90, title: 'Community',
    quiet: 'nothing to moderate', to: '/app/ops/moderation' },
  { key: 'C13', view: 'trainer', order: 100, title: 'Gifts',
    quiet: 'no gifts waiting to be redeemed', to: '/app/records/clients' },

  /* ── CJ · the business desk ─────────────────────────────────────────── */
  /* ⚠️ ORGANISED BY WHOSE MOVE IT IS, NOT BY DEPARTMENT (owner, 2026-08-26).
     *"I dont need a section dedicated to contracts and deals, or anything
     specific like that, I need to just have visibility over what is happening
     and what is waiting for a next action by me or a client. Then i need kpi's.
     Thats it."*

     FOUR DEPARTMENT ZONES WERE RETIRED INTO THE TWO BELOW — B1 money, B3 deals
     & contracts, B8 catalog setup, B9 onboarding pipeline. Each answered "what
     is happening in THIS subsystem"; none answered the only question actually
     being asked. Their rows all survive, re-sorted by whose move it is, in
     `_waiting_items()`.

     Two things did NOT survive the fold, deliberately: B8's cover-image and
     staff-title rows (tidiness, not a next action — they are what made that
     zone nine rows long), and every `display_code` (*"an obscure string of
     characters ... completely fucking useless to me"*).

     B2 stays because D26 makes Claire's plate a second pair of eyes, not a
     department; B6 stays because it IS "visibility over what is happening". */
  { key: 'W1', view: 'business', order: 10, title: 'Waiting on you',
    quiet: 'nothing is waiting on you', to: '/app/records/documents',
    hint: 'The next move is yours on every row here.' },
  { key: 'W2', view: 'business', order: 20, title: 'Waiting on a client',
    quiet: 'nobody owes you anything', to: '/app/records/clients',
    hint: 'Sent, and not yet acted on. Nothing here needs you today.' },
  { key: 'B2', view: 'business', order: 30, title: "Claire's plate",
    quiet: 'nothing on her plate needs a second pair of eyes', to: '/app/dashboard',
    hint: 'Money and reply-time mirror here. Her routine work does not, unless it has gone overdue.' },
  { key: 'B6', view: 'business', order: 40, title: 'What the app has been doing',
    quiet: 'nothing recorded in the last two weeks', to: '/app/ops/activity',
    hint: 'D19: five ledgers the app writes and never read back. This is the read.' },
];

export function zonesFor(view: DashboardView): ZoneDef[] {
  return ZONES.filter((z) => z.view === view).sort((a, b) => a.order - b.order);
}

/** Owner, 2026-08-23: named by person, not by role — "They should just say
 *  Claire's Dashboard, CJ's Dashboard." D26's designation still selects the
 *  emphasis; only the label changed. */
export const VIEW_LABEL: Record<DashboardView, string> = {
  trainer: "Claire's Dashboard",
  business: "CJ's Dashboard",
};

/**
 * D25, ON A STAFF SURFACE. *"'Booking' is internal taxonomy only. The user sees
 * the offering, at the right level."* Riding goes HIGH — always "Riding Lesson",
 * never the SKU behind it. Horse care goes LOW — the actual service — but stops
 * above quantity and frequency. And the NOUN changes per service: exercise,
 * turnout and training are a *service*; clipping is an *appointment*; a lesson
 * is a *Riding Lesson*.
 *
 * The dashboard obeys it for the same reason the client screens do: Claire reads
 * these rows out loud to the person they are about.
 */
export interface ServiceWording {
  /** What the row is called. */
  label: string;
  /** The noun for prose about it ("change or cancel your …"). */
  noun: 'Riding Lesson' | 'service' | 'appointment' | 'session';
}

export function serviceWording(code: string | null | undefined): ServiceWording {
  switch (code) {
    case 'RIDING_LESSON':
      return { label: 'Riding Lesson', noun: 'Riding Lesson' };
    case 'HORSE_CLIPPING':
      return { label: 'Hair clipping', noun: 'appointment' };
    case 'HORSE_EXERCISE':
      return { label: 'Turnout & exercise', noun: 'service' };
    case 'HORSE_TRAINING':
      return { label: 'Horse training', noun: 'service' };
    case 'HORSE_EVALUATION':
      return { label: 'Horse evaluation', noun: 'session' };
    case null:
    case undefined:
      return { label: 'Session', noun: 'session' };
    default:
      return { label: serviceLabel(code), noun: 'session' };
  }
}

/* ── THE REACH, per row type ──────────────────────────────────────────────
 * Each helper returns a route that exists in App.tsx. When a row cannot be
 * addressed individually (the Leads tab has no `?open=`), it lands on the tab
 * that lists it — which is a real destination, not a dead link. */

/** A session opens on the calendar, at its own date, with its panel open.
 *  `CalendarPage` reads both params (added by this task — see its header). */
export function bookingHref(bookingId: string, startsAt?: string | null): string {
  const on = startsAt ? new Date(startsAt).toISOString().slice(0, 10) : null;
  return `/app/calendar?item=${bookingId}${on ? `&on=${on}` : ''}`;
}

/** A client record. `Admin` (the Clients tab) resolves `open` against both the
 *  row key and `contact_id`, so a contact id is enough. */
export function contactHref(contactId: string | null | undefined): string {
  return contactId ? `/app/records/clients?open=${contactId}` : '/app/records/clients';
}

export function purchaseHref(): string {
  return '/app/ops/payments/review';
}

export function documentHref(documentId: string | null | undefined): string {
  return documentId ? `/app/contracts/${documentId}` : '/app/records/documents';
}

export function dealHref(dealId: string | null | undefined): string {
  return dealId ? `/app/ops/deals/${dealId}` : '/app/records/deals';
}

export function horseHref(horseId: string): string {
  return `/app/horses/${horseId}`;
}

export function messageHref(userId: string | null | undefined): string {
  return userId ? `/app/messages/${userId}` : '/app/messages';
}
