import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, Link, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { FEED_VIEWS, FEED_VIEW_META, type FeedView } from '../../lib/seed';
import { dmUnreadTotal } from '../../lib/community';
import {
  CalendarDays, Users, FileText, UserRound, ReceiptText, Shield, LogOut, ChevronLeft,
  GraduationCap, Home as HomeIcon, Boxes, Contact, LayoutDashboard,
  Mail, ChevronDown, ChevronUp, Plus, LifeBuoy, ShoppingBag, MessageSquare, BookOpen, ListChecks,
  PanelLeftClose, PanelLeftOpen, Activity, Compass, Handshake, Grid3x3, Bookmark,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useViewSurfaces } from '../../lib/surfaces';
import { fetchMyGrantKeys } from '../../lib/grants';
import {
  myUnreadCount, inboundOpenCount, myWallState, getMyProfile, markTourSeen, fetchMyCategories,
  currentTourFormFactor, myNavPresence,
  type WallState, type StandingCategory, type NavPresence,
} from '../../lib/api';
import { AppOverviewModal } from './AppOverviewModal';
import { CreateModal, type CreateModalStep } from './CreateModal';
import { CardstockHeader } from './CardstockHeader';
import { CreateModalTriggerContext } from '../../contexts/CreateModalContext';
import { captureWallReturnDestination } from '../../lib/wallReturn';

/** I7 — green-glass nav surface (mobile drawer + desktop USER rail only —
 *  NOT the staff rail, which keeps its own `bg-cream-100/40`): a translucent
 *  green wash over the page's cream base, blurred so content scrolling
 *  behind reads through as glass (owner spec 2026-08-05). One shared
 *  constant so both surfaces stay identical and reverting to the previous
 *  solid look is a one-line swap:
 *    glass (ships):  NAV_GLASS below
 *    solid (revert): 'bg-cream-100'
 *  `supports-[not(...)]` is the solid-color fallback for browsers without
 *  backdrop-filter support. */
/* Two bugs lived in this one line, both found 2026-08-08.
   1. `bg-cream-100/[0.92]` NEVER EMITTED. The bracket-opacity form produced no
      rule at all — verified absent from the built CSS — so the surface had no
      background and rendered as bare blur. Percentage form (`/90`) emits, the
      same way `/30` and `/40` already do elsewhere in this file.
   2. The @supports fallback tested only UNPREFIXED `backdrop-filter`. Safari
      shipped that unprefixed in v18; older iPhones support it solely as
      `-webkit-backdrop-filter`. So on those phones the blur worked via the
      prefix while the test still reported "unsupported" and slammed a SOLID
      cream fallback over it — which is why one device showed glass and another
      showed opaque tan from identical code. The test now accepts either. */
const NAV_GLASS = 'bg-green-800/20 backdrop-blur-xl supports-[not((backdrop-filter:blur(1px))_or_(-webkit-backdrop-filter:blur(1px)))]:bg-cream-100 supports-[not((backdrop-filter:blur(1px))_or_(-webkit-backdrop-filter:blur(1px)))]:backdrop-blur-none';

/** Unread-notification count for the Dashboard nav badge. Refreshes on mount and
 *  on every route change (the notifications themselves live on the dashboard now —
 *  there is no bell). */
function useUnreadCount(): number {
  const location = useLocation();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    myUnreadCount().then((n) => active && setCount(n)).catch(() => { /* stay quiet */ });
    return () => { active = false; };
  }, [location.pathname]);
  return count;
}

/** Open-inbound-work count for the Inbound nav badge (requests + support).
 *  Refreshes on mount and on every route change, same as useUnreadCount.
 *  Staff-only RPC — `enabled` gates the fetch so non-staff members (who never
 *  see the Inbound nav item) don't call it at all. */
function useInboundOpenCount(enabled: boolean): number {
  const location = useLocation();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    inboundOpenCount().then((n) => active && setCount(n)).catch(() => { /* stay quiet */ });
    return () => { active = false; };
  }, [location.pathname, enabled]);
  return count;
}

/** I2 — per-account presence for the five dynamic USER nav destinations
 *  (Orders, Documents, Stable, My Posts, Saved Content). One call on layout
 *  mount is enough per the locked design ("refresh on route change is NOT
 *  required — next mount picks it up"), unlike the two badge hooks above.
 *  `enabled` mirrors useInboundOpenCount's staff-only gate, inverted: only
 *  non-staff accounts ever see these links. A failed read just leaves every
 *  link hidden (same fallback as the other quiet-catch hooks here) — these
 *  are discoverability links, not a gate. */
function useNavPresence(enabled: boolean): NavPresence {
  const [presence, setPresence] = useState<NavPresence>({
    orders: false, documents: false, stable: false, posts: false, saved: false,
  });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    myNavPresence().then((p) => active && setPresence(p)).catch(() => { /* links just stay hidden */ });
    return () => { active = false; };
  }, [enabled]);
  return presence;
}

/**
 * APP SHELL — role-adaptive.
 *
 * Rider (USER): two surfaces only — Main (dashboard + community) and Account —
 * reached from the avatar menu. No side rail. The avatar menu also holds quick-
 * access shortcuts.
 *
 * Instructor (MANAGER/EMPLOYEE) and Admin (ADMIN): the same Main page, PLUS
 * management pages. Because there are more than two destinations, these two get a
 * PERSISTENT LEFT RAIL on desktop (management nav, always visible, Main included).
 * On mobile the rail collapses into the avatar menu. Instructor sees the servicing
 * subset; admin sees that plus the tenant-admin pages. Platform items
 * (modules/registry/organizations/provision) are SUPER_ADMIN-only.
 *
 * Header (all types): logo mark + wordmark (mark-only on mobile) → Main; universal
 * create "+"; calendar; avatar menu (notifications fold into the avatar badge).
 */

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  module?: string;
  adminOnly?: boolean;
  superAdmin?: boolean;
  /** Unread-style count shown on this item's badge (RailLink). Not part of the
   *  static nav tables — injected at render time (see AppLayout's navGroups). */
  badge?: number;
}

// `badge` surfaces an unread count on that nav link: 'notifications' (Dashboard) or
// 'messages' (Messages). "Community Feed" is its own nested group (below) and is
// position 1; these are the rest of the quick-access destinations.
const QUICK: { label: string; icon: typeof GraduationCap; to: string; end?: boolean; badge?: 'notifications' | 'messages' }[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/app/dashboard', badge: 'notifications' },
  { label: 'Calendar', icon: CalendarDays, to: '/app/calendar' },
  // The in-app catalog: shop services & book them (real purchase flow).
  { label: 'Catalog', icon: ShoppingBag, to: '/app/catalog' },
  { label: 'Messages', icon: MessageSquare, to: '/app/messages', badge: 'messages' },
];

/** I2 — Orders, Documents, Stable, My Posts, Saved Content: each is the
 *  page's real existing route (found in App.tsx, none invented) except
 *  Stable and Saved, which only exist as Account-page sections — those use
 *  the `?section=` pattern A11 added. `section` marks that case so active-
 *  state matching (PresenceLink, below) can disambiguate two `/app/account`
 *  links from each other, which NavLink's own pathname-only matching can't
 *  do. Icons match what AccountHub's own Row already uses for that same
 *  destination, for visual continuity between the nav and the Account page. */
const PRESENCE_LINKS: { key: keyof NavPresence; label: string; icon: typeof ShoppingBag; to: string; section?: string }[] = [
  { key: 'orders', label: 'My Orders', icon: ReceiptText, to: '/app/orders' },
  { key: 'documents', label: 'My Documents', icon: FileText, to: '/app/documents' },
  /* D2 resolved: /app/stable shipped with ACCOUNTSURFACE, so this points at the
     real route. `section` MUST be dropped alongside it — isActive falls back to
     a pathname match only when `section` is absent (see PresenceLink), so
     leaving it would mean My Stable never highlights as active. */
  { key: 'stable', label: 'My Stable', icon: Boxes, to: '/app/stable' },
  { key: 'posts', label: 'My Posts', icon: Grid3x3, to: '/app/my-posts' },
  { key: 'saved', label: 'My Saved Items', icon: Bookmark, to: '/app/account?section=saved', section: 'saved' },
];

/** The community-feed views, as nested nav links. Each filters the one feed
 *  (/app?filter=…). The 'all' view is NOT a sublink — the parent "Community Feed"
 *  link IS the full view; the sublinks are the specific filters. The selected view
 *  highlights (not the parent), matching the page header. "Shop for sale" is simply
 *  the For Sale view, so it lives here too instead of as a top-level shortcut. */
const COMMUNITY_VIEWS: { key: FeedView; label: string }[] =
  FEED_VIEWS.map((v) => ({ key: v.key, label: FEED_VIEW_META[v.key].navLabel }));

function communityHref(key: FeedView): string {
  return key === 'all' ? '/app' : `/app?filter=${key}`;
}

export interface NavGroup { key: string; label: string; items: NavItem[]; defaultOpen?: boolean }

/** ROLE ARCHITECTURE (owner spec):
 *  SUPER_ADMIN — the PLATFORM admin; belongs to no tenant. Sees platform
 *    management only (organizations, provisioning, flags, registry).
 *  ADMIN — the tenant admin. Grouped management sections (short nav, similar
 *    surfaces consolidated), incl. control of what instructors see.
 *  INSTRUCTOR (MANAGER/EMPLOYEE) — below admin, above client. Baseline =
 *    client support + servicing (intake review/processing, invitations via
 *    Accounts when granted, contacts, lessons, availability, horses,
 *    engagements, documents) + whatever the admin grants (globally or to the
 *    one account). */
const PLATFORM_NAV: NavItem[] = [
  { to: '/app/ops/superadmin/organizations', label: 'Organizations', icon: Shield },
  { to: '/app/ops/admin/modules', label: 'Feature flags', icon: Shield },
  { to: '/app/ops/admin/registry', label: 'Registry', icon: Shield },
];

/* FRONT DESK was eliminated 2026-07-31 (owner). It mixed two different kinds of
 * thing: WORK queues (Inbound, Support) and a list of PEOPLE (Leads). Leads
 * belongs with the other person-lists; the queues belong with the rest of the
 * day-to-day management surfaces. */
const MANAGEMENT_GROUP: NavItem[] = [
  { to: '/app/ops/intake', label: 'Inbound', icon: Mail },
  { to: '/app/ops/support', label: 'Support', icon: LifeBuoy },
  // Servicing folded in 2026-07-31: three links did not justify a heading of
  // their own, and they are day-to-day management like the queues above.
  { to: '/app/ops/lessons', label: 'Lessons', icon: GraduationCap, module: 'mod.lessons' },
  { to: '/app/ops/horse-records', label: 'Horses', icon: Boxes },
  { to: '/app/ops/documents', label: 'Documents', icon: FileText },
  // A deal is the envelope a transaction lives in — its parties, what each side
  // gives, and the documents that make it real. It sits beside Documents because
  // that is what it produces.
  { to: '/app/ops/deals', label: 'Deals', icon: Handshake },
  // Payment review is a management task; Business is hidden until the reporting
  // and business-ops surfaces that belong there actually exist.
  { to: '/app/ops/payments/review', label: 'Payment review', icon: ReceiptText },
];
/* PEOPLE — everyone we know, one list per relationship to the business:
 *   Leads      potential future clients (the campaign list)
 *   Clients    the paying/serviced roster
 *   Contacts   internal people we serve who are not part of the company
 *   Team       the company itself
 *   Directory  external providers — farriers, vets, suppliers, organizers
 * Leads moved here from Front desk: it is a list of PEOPLE, not a work queue. */
const ACCOUNTS_GROUP: NavItem[] = [
  { to: '/app/ops/leads', label: 'Leads', icon: Contact },
  { to: '/app/admin', label: 'Clients', icon: Users },
  { to: '/app/ops/contacts', label: 'Contacts', icon: Contact },
  { to: '/app/ops/team', label: 'Team', icon: Contact },
  { to: '/app/ops/directory', label: 'Directory', icon: BookOpen },
];
/* SERVICING and BUSINESS were folded into Management 2026-07-31 (owner): the
 * goal is fewer headings, not more. Their items live in MANAGEMENT_GROUP above.
 * BUSINESS_GROUP returns when there is more in it than a single link. */
const COMMUNITY_GROUP: NavItem[] = [
  { to: '/app/ops/activity', label: 'Activity', icon: Activity },
  { to: '/app/ops/evaluations', label: 'Evaluations', icon: FileText },
  { to: '/app/ops/moderation', label: 'Moderation', icon: Shield },
  { to: '/app/ops/lookups', label: 'Field options', icon: ListChecks },
  { to: '/app/ops/content', label: 'Content store', icon: BookOpen },
  { to: '/app/ops/oversight', label: 'Oversight', icon: Shield },
];
const MODULES_GROUP: NavItem[] = [
  // Brokerage has no staff hub page yet (mod.brokerage's live surfaces are the
  // client-lane engagement reads) — the entry linked to an unregistered route
  // and 404'd for every staff user with the module on. Re-add with the hub.
  { to: '/app/ops/boarding', label: 'Boarding', icon: HomeIcon, module: 'mod.boarding' },
  { to: '/app/ops/barnops', label: 'Barn Ops', icon: Boxes, module: 'mod.barnops' },
  { to: '/app/ops/records', label: 'Records', icon: FileText, module: 'mod.horserecords' },
  { to: '/app/ops/employees', label: 'Employees', icon: Contact, module: 'mod.employees' },
];
const SETTINGS_GROUP: NavItem[] = [
  { to: '/app/ops/admin/branding', label: 'Branding', icon: Shield, adminOnly: true },
  { to: '/app/ops/admin/products', label: 'Products', icon: Shield, adminOnly: true },
  { to: '/app/ops/admin/forms', label: 'Forms', icon: Shield, adminOnly: true },
];

// kept for compatibility with anything importing MANAGE_NAV
export const MANAGE_NAV: NavItem[] = [
  ...MANAGEMENT_GROUP, ...ACCOUNTS_GROUP,
  ...COMMUNITY_GROUP, ...MODULES_GROUP, ...SETTINGS_GROUP,
];

/** Build the grouped rail for the caller's role. Instructor grants (nav keys)
 *  un-hide adminOnly items for that instructor. */
export function manageNavGroups(
  hasModule: (key: string) => boolean,
  isAdmin: boolean,
  isSuperAdmin: boolean,
  grantKeys: string[] = [],
): NavGroup[] {
  if (isSuperAdmin) {
    // the platform admin belongs to no tenant — platform surfaces only
    return [{ key: 'platform', label: 'Platform', items: PLATFORM_NAV, defaultOpen: true }];
  }
  const visible = (items: NavItem[]) => items.filter(
    (i) => (!i.module || hasModule(i.module))
        && (!i.adminOnly || isAdmin || grantKeys.includes(i.to)),
  );
  const groups: NavGroup[] = [
    /* MANAGEMENT leads: the two work QUEUES that must be dealt with each day.
       They sat under a separate "Front desk" heading alongside Leads — a list of
       people — which put a queue and a roster under one label. Front desk is
       gone; the queues live here and Leads moved to People. */
    { key: 'management', label: 'Management', items: visible(MANAGEMENT_GROUP), defaultOpen: true },
    { key: 'accounts', label: 'People', items: visible(ACCOUNTS_GROUP), defaultOpen: true },
    { key: 'community', label: 'Community', items: visible(COMMUNITY_GROUP) },
    { key: 'modules', label: 'Modules', items: visible(MODULES_GROUP) },
    { key: 'settings', label: 'Settings', items: visible(SETTINGS_GROUP) },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** C4 — delayed hover/focus label for icon-only rail rows, replacing the old
 *  native `title=` (uncontrollable delay). `ExplainTip` (TASK-TIPTAP) was
 *  evaluated first per the task doc and rejected: it fires on hover with NO
 *  delay, adds click-to-pin state + `role="button"` + a dotted-underline cue
 *  meant for inline prose explanations, and wraps its own trigger — all wrong
 *  for a row that is already its own NavLink/button and just needs a plain
 *  label that shows late. Pure CSS instead: `transition-delay` only applies
 *  via the `group-hover`/`group-focus-visible` variant, so it shows slow and
 *  (with no delay class on the plain `transition-opacity`) hides fast by
 *  construction — no JS state, no third stateful tooltip mechanism. Caller
 *  must put `group relative` on the row. */
/**
 * E4 — collapsed-rail tooltip, rendered in a PORTAL.
 *
 * It used to be an absolutely-positioned sibling at `left-full`, i.e. deliberately
 * outside the rail — but both rails carry `overflow-x-hidden`, which CLIPPED it.
 * After the 1100ms delay the tooltip did appear, got cut off at the rail's edge,
 * and all that survived was a sliver of its `bg-green-950` background. That is the
 * "weird green marking on the nav rail" the owner reported.
 *
 * A portal is required rather than `position: fixed`: the member rail's surface
 * uses `backdrop-blur`, and a backdrop-filter creates a containing block, so a
 * fixed child would still be trapped. Rendering into <body> escapes both the
 * clip and the containing block.
 *
 * Position is measured from the trigger on hover/focus rather than assumed, so it
 * stays correct at any rail width and in either rail.
 */
function NavTooltipLabel({ label }: { label: string }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback(() => {
    // The 1100ms dwell the owner specified — deliberate, not accidental hover.
    timer.current = window.setTimeout(() => {
      const host = anchorRef.current?.parentElement;
      if (!host) return;
      const r = host.getBoundingClientRect();
      setPos({ top: r.top + r.height / 2, left: r.right + 8 });
    }, 1100);
  }, []);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setPos(null);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const host = anchorRef.current?.parentElement;
    if (!host) return;
    host.addEventListener('mouseenter', show);
    host.addEventListener('mouseleave', hide);
    host.addEventListener('focus', show);
    host.addEventListener('blur', hide);
    return () => {
      host.removeEventListener('mouseenter', show);
      host.removeEventListener('mouseleave', hide);
      host.removeEventListener('focus', show);
      host.removeEventListener('blur', hide);
    };
  }, [show, hide]);

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden="true" />
      {pos && createPortal(
        <span
          role="tooltip"
          style={{ top: pos.top, left: pos.left }}
          className="pointer-events-none fixed -translate-y-1/2 z-[100] whitespace-nowrap rounded-md bg-green-950 text-cream-50 text-xs font-sans px-2 py-1 shadow-lg"
        >
          {label}
        </span>,
        document.body,
      )}
    </>
  );
}

/** C5b — nav state colours (owner spec 2026-08-07), superseding B3's cream
 *  fill: DEFAULT is today's secondary green (unchanged); SELECTED is a solid
 *  `green-800` fill with `cream-100` text/icon (the panel's own surface
 *  colour, not gold — the old gold-on-active-icon convention this replaces);
 *  HOVER is desktop-only (`lg:` — hover has no meaning on touch, and this
 *  also means iOS's sticky post-tap `:hover` can never trigger it), a
 *  translucent preview of the same green with the SAME selected text colour.
 *  One palette for icon-only and full-width alike. Applied identically here,
 *  in `PresenceLink`, `AccountNavLink` and both `CommunityNav` rows below —
 *  see the task doc, "no component keeps the old treatment." */
function RailLink({ to, label, icon: Icon, end, badge = 0, open = true }: NavItem & { badge?: number; open?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={open ? undefined : label}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-sans transition-colors focus-ring ${open ? '' : 'justify-center'} ${
          isActive
            ? 'bg-green-800 text-cream-100 font-medium'
            : 'text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative shrink-0">
            <Icon size={17} aria-hidden="true" className={isActive ? 'text-cream-100' : 'text-green-600 [@media(hover:hover)]:group-hover:text-cream-100'} />
            {badge > 0 && !open && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[1rem] h-4 px-1 bg-gold-600/70 text-white text-[10px] leading-4 text-center rounded-full">{badge > 9 ? '9+' : badge}</span>
            )}
          </span>
          {open && <span className="flex-1">{label}</span>}
          {badge > 0 && open && (
            <span className="min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full bg-gold-600/70 text-white">{badge > 9 ? '9+' : badge}</span>
          )}
          {!open && <NavTooltipLabel label={label} />}
        </>
      )}
    </NavLink>
  );
}

function MenuLink({ to, label, icon: Icon, end, onNavigate }: NavItem & { onNavigate: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 text-sm font-sans transition-colors focus-ring ${
          isActive ? 'bg-cream-200 text-green-800 font-medium ' : 'text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100'
        }`
      }
    >
      <Icon size={17} aria-hidden="true" />
      {label}
    </NavLink>
  );
}

/** I2 — renders one of PRESENCE_LINKS. Active-state matching is done here
 *  (not delegated to NavLink) because Stable and Saved both point at
 *  `/app/account` with a different `?section=` each — NavLink only compares
 *  pathname, so it would show BOTH as "selected" together on that page.
 *  `section`-less links (Orders, Documents, My Posts) are plain distinct
 *  routes, so a pathname check is exact for them too. */
function PresenceLink({ to, label, icon: Icon, section, onNavigate }: {
  to: string; label: string; icon: typeof ShoppingBag; section?: string; onNavigate?: () => void;
}) {
  const location = useLocation();
  const accountSection = useActiveAccountSection();
  const isActive = section ? accountSection === section : location.pathname === to;
  return (
    <Link to={to} onClick={onNavigate} aria-current={isActive ? 'page' : undefined}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-sans transition-colors focus-ring ${
        isActive ? 'bg-green-800 text-cream-100 font-medium' : 'text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100'}`}>
      <Icon size={18} aria-hidden="true" className={isActive ? 'text-cream-100' : 'text-green-600 [@media(hover:hover)]:group-hover:text-cream-100'} />
      <span className="whitespace-nowrap flex-1">{label}</span>
    </Link>
  );
}

/** I6 — canonical-order "Account" link. Active only on the bare /app/account
 *  view (no `?section=`), so it doesn't co-highlight with My Stable, which
 *  shares the same pathname via `?section=stable`. Styled to match
 *  RailLink/PresenceLink's active-state convention (I4's cream-200 + gold
 *  icon). */
function AccountNavLink({ onNavigate, open = true }: { onNavigate?: () => void; open?: boolean }) {
  const location = useLocation();
  const accountSection = useActiveAccountSection();
  const isActive = location.pathname === '/app/account' && accountSection == null;
  return (
    <Link to="/app/account" onClick={onNavigate} aria-current={isActive ? 'page' : undefined}
      aria-label={open ? undefined : 'Account'}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-sans transition-colors focus-ring ${open ? '' : 'justify-center'} ${
        isActive ? 'bg-green-800 text-cream-100 font-medium' : 'text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100'}`}>
      {/* `shrink-0` — see the note in CommunityNav's collapsed branch. Without it
          the collapsed rail squashes this icon to the ~8px of content box left
          after the nav's and the link's horizontal padding. */}
      <UserRound size={18} aria-hidden="true" className={`shrink-0 ${isActive ? 'text-cream-100' : 'text-green-600 [@media(hover:hover)]:group-hover:text-cream-100'}`} />
      {open && <span className="whitespace-nowrap flex-1">Account</span>}
      {!open && <NavTooltipLabel label="Account" />}
    </Link>
  );
}

/** Which community-feed view the current location represents (null when not on the
 *  feed at all). On /app the active view is the `?filter=` value, or 'all'. */
function useActiveCommunityView(): FeedView | null {
  const location = useLocation();
  const [params] = useSearchParams();
  if (location.pathname !== '/app') return null;
  const f = params.get('filter');
  return f && FEED_VIEWS.some((v) => v.key === f) ? (f as FeedView) : 'all';
}

/** I2 — which Account-page section (if any) the current location represents,
 *  null off /app/account. Same shape as useActiveCommunityView's `?filter=`
 *  matching, for the `?section=` links (see PresenceLink). */
function useActiveAccountSection(): string | null {
  const location = useLocation();
  const [params] = useSearchParams();
  if (location.pathname !== '/app/account') return null;
  return params.get('section');
}

/** COMMUNITY FEED nav group — a parent header + its views nested as indented links.
 *  Each view filters the one feed; the SELECTED view highlights (not the parent),
 *  and the page header changes to match. The parent is COLLAPSIBLE: a chevron shows/
 *  hides the sublinks (persisted); it auto-expands while you're on the feed so the
 *  active view stays visible. `open` collapses labels in the rail strip.
 *  `onNavigate` closes the mobile menu. */
function CommunityNav({ open = true, onNavigate, indentClass = 'pl-9' }: {
  open?: boolean; onNavigate?: () => void; indentClass?: string;
}) {
  const active = useActiveCommunityView();
  // The parent IS the "All" view: it's highlighted (solid) on the full feed, and a
  // specific-filter sublink owns the highlight when one is selected. No "All posts"
  // sublink — clicking "Community Feed" (or the browser Back) returns to the full view.
  const isAll = active === 'all';
  const onFeed = active !== null;
  // collapse state for the sublinks (persisted, toggle-controlled). Default expanded.
  const [expanded, setExpanded] = useState(() => localStorage.getItem('communityNav.expanded') !== '0');
  useEffect(() => { localStorage.setItem('communityNav.expanded', expanded ? '1' : '0'); }, [expanded]);

  if (!open) {
    // I1B — staff rail icon strip: just the parent icon, active whenever on the feed.
    return (
      <Link to="/app" onClick={onNavigate} aria-label="Community Feed" aria-current={onFeed ? 'page' : undefined}
        className={`group relative flex items-center justify-center rounded-lg px-3 py-2.5 focus-ring ${onFeed ? 'bg-green-800 text-cream-100' : 'text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100'}`}>
        {/* `shrink-0` is REQUIRED, not decorative. In the 56px collapsed rail the
            nav's p-3 plus this link's px-3 leave ~8px of content box, and without
            flex-shrink:0 the SVG is compressed to fit — which is why this icon and
            the account one rendered miniature while every RailLink icon (wrapped in
            a shrink-0 span) stayed 18px. */}
        <Users size={18} className={`shrink-0 ${onFeed ? 'text-cream-100' : 'text-green-600 [@media(hover:hover)]:group-hover:text-cream-100'}`} />
        <NavTooltipLabel label="Community Feed" />
      </Link>
    );
  }

  return (
    <div>
      {/* parent row — the label links to the full feed (= All) and highlights when
          it's the active view; the toggle shows/hides the sublinks. I5: down arrow +
          "show" when collapsed, up arrow + "hide" when expanded — replaces the old
          right-pointing (rotated ChevronDown) collapsed state. C5 (owner, 2026-08-07):
          the toggle's chevron/label were 15px/10px against 17-18px/13.5px everywhere
          else in the rail — brought up to the same scale. */}
      <div className={`group relative flex items-center rounded-lg pr-1 ${isAll ? 'bg-green-800' : '[@media(hover:hover)]:hover:bg-green-600'}`}>
        <Link to="/app" onClick={onNavigate} aria-current={isAll ? 'page' : undefined}
          className={`flex items-center gap-3 flex-1 min-w-0 px-3 py-2.5 text-[13.5px] font-sans focus-ring rounded-lg ${isAll ? 'text-cream-100 font-medium' : 'text-secondary [@media(hover:hover)]:group-hover:text-cream-100'}`}>
          <Users size={18} className={`shrink-0 ${isAll ? 'text-cream-100' : 'text-green-600 [@media(hover:hover)]:group-hover:text-cream-100'}`} />
          <span className="whitespace-nowrap">Community Feed</span>
        </Link>
        <button type="button" onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse community views' : 'Expand community views'}
          aria-expanded={expanded}
          /* Owner, 2026-08-08: icon only. The "show"/"hide" word crowded the row —
             it competed with the "Community Feed" label for a rail that is only
             240px wide, and on the selected (dark) state it read as a second
             element sitting on the pill. The chevron already carries the meaning;
             the accessible name lives on aria-label. */
          className={`shrink-0 flex items-center justify-center p-1.5 rounded-md focus-ring ${isAll ? 'text-cream-100 hover:bg-white/10' : 'text-green-700 [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100'}`}>
          {expanded ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
        </button>
      </div>
      {/* nested views (specific filters only) — the selected one highlights */}
      {expanded && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {COMMUNITY_VIEWS.filter((v) => v.key !== 'all').map((v) => {
            const isActive = active === v.key;
            return (
              <Link key={v.key} to={communityHref(v.key)} onClick={onNavigate} aria-current={isActive ? 'page' : undefined}
                className={`group flex items-center ${indentClass} pr-3 py-1.5 rounded-lg text-[13px] font-sans transition-colors focus-ring ${
                  isActive ? 'bg-green-800 text-cream-100 font-medium' : 'text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100'}`}>
                <span className="whitespace-nowrap">{v.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Unread DM total for the Messages nav badge. Refreshes on mount + route change. */
function useDmUnread(): number {
  const location = useLocation();
  const [n, setN] = useState(0);
  useEffect(() => {
    let active = true;
    dmUnreadTotal().then((c) => active && setN(c)).catch(() => {});
    return () => { active = false; };
  }, [location.pathname]);
  return n;
}

/** I6 — the ONE canonical USER nav order (owner spec 2026-08-05, amended
 *  ONEMENU 2026-08-07): Community Feed, Dashboard, Calendar, My Lessons*, My
 *  Orders, Catalog, My Documents, Messages, My Posts, My Stable, My Saved
 *  Items*, Account — identical across the mobile drawer, the desktop USER
 *  rail (ClientRail, below), and the welcome/first-visit modal's item listing
 *  (AppOverviewModal's pageLines — not re-verified against this order in this
 *  pass). Presence-gated items (Orders, Documents, My Posts, My Stable, My
 *  Saved Items) keep their `my_nav_presence()` gating; order holds among
 *  whatever is visible. My Saved Items is NEW here (owner ruling
 *  2026-08-07, #5): the old I6 note said it was deliberately excluded because
 *  the (now-removed) avatar dropdown carried it as a bonus shortcut — that
 *  reasoning no longer holds once the dropdown is gone, so it's appended
 *  after My Stable rather than left unreachable from mobile nav. Lessons
 *  shipped as "My Lessons" — D1 (TASK-ACCOUNTSURFACE §4) — it is still
 *  module-gated exactly like the staff nav's own Lessons entry
 *  (MANAGEMENT_GROUP above); dropping it is the one `lessonsOn &&` line.
 *  Community Feed itself is NOT in this list — every caller renders
 *  `<CommunityNav />` immediately before this component, matching the
 *  existing pattern of calling it explicitly at each site. */
function ClientNavItems({ bellCount, dmCount, presence, lessonsOn, onNavigate }: {
  bellCount: number; dmCount: number; presence: NavPresence; lessonsOn: boolean; onNavigate?: () => void;
}) {
  return (
    <>
      <RailLink to="/app/dashboard" label="Dashboard" icon={LayoutDashboard} badge={bellCount} />
      <RailLink to="/app/calendar" label="Calendar" icon={CalendarDays} />
      {/* D1 (owner table, TASK-ACCOUNTSURFACE §4): nav labels must match the
          Account page exactly. "Lessons" alone was the bare public-vs-personal
          collision the rule exists to prevent. */}
      {lessonsOn && <RailLink to="/app/lessons" label="My Lessons" icon={GraduationCap} />}
      {presence.orders && <RailLink to="/app/orders" label="My Orders" icon={ReceiptText} />}
      <RailLink to="/app/catalog" label="Catalog" icon={ShoppingBag} />
      {presence.documents && <RailLink to="/app/documents" label="My Documents" icon={FileText} />}
      <RailLink to="/app/messages" label="Messages" icon={MessageSquare} badge={dmCount} />
      {presence.posts && <RailLink to="/app/my-posts" label="My Posts" icon={Grid3x3} />}
      {presence.stable && (
        /* D2 resolved by the orchestrator at merge: ACCOUNTSURFACE's /app/stable
           route is now on main, so this points at it directly instead of taking
           the ?section= redirect hop. `section` dropped so isActive matches on
           pathname — see the note in PRESENCE_LINKS. */
        <PresenceLink to="/app/stable" label="My Stable" icon={Boxes} onNavigate={onNavigate} />
      )}
      {presence.saved && (
        /* Owner ruling 2026-08-07 (#5): Saved Content ships as a visible nav
           item — it was excluded from I6's canonical order specifically
           because the avatar menu carried it as a bonus shortcut; that menu
           is gone now, so its only remaining home is here. Presence-gated
           the same way Orders/Documents/My Posts/My Stable already are — an
           existence check, not the NAVPREFS user-hide feature (not built). */
        <PresenceLink to="/app/account?section=saved" label="My Saved Items" icon={Bookmark} section="saved" onNavigate={onNavigate} />
      )}
      <AccountNavLink onNavigate={onNavigate} />
    </>
  );
}

/** ONEMENU — the staff rail/drawer equivalent of ClientNavItems. Dashboard and
 *  Calendar were already hardcoded at both render sites (unchanged icons —
 *  staff's Dashboard keeps `HomeIcon`, distinct from the member rail's
 *  `LayoutDashboard`, pre-existing and not in this task's scope). Catalog and
 *  Messages are the net-new items from A2's inventory: instructors already
 *  reached them through the old avatar dropdown's client-quick-links branch
 *  (which incorrectly also caught them, since it only excluded admins), while
 *  admins never got them at all. Owner ruling #4 — "admin and instructor
 *  converge... the current divergence is drift, not design" — resolved by
 *  giving every staff account the same set rather than picking a side. */
function StaffNavItems({ bellCount, dmCount, open = true }: { bellCount: number; dmCount: number; open?: boolean }) {
  return (
    <>
      <RailLink to="/app/dashboard" label="Dashboard" icon={HomeIcon} badge={bellCount} open={open} />
      <RailLink to="/app/calendar" label="Calendar" icon={CalendarDays} open={open} />
      <RailLink to="/app/catalog" label="Catalog" icon={ShoppingBag} open={open} />
      <RailLink to="/app/messages" label="Messages" icon={MessageSquare} badge={dmCount} open={open} />
    </>
  );
}

/** ONEMENU — the trailing utility block absorbed from the removed avatar
 *  dropdown: App tour and Sign out. Shared by the member rail, the staff rail
 *  (collapse-aware via `open`) and the mobile drawer (member + staff, one
 *  shared call). Not styled as nav rows — no route, no selected state, so
 *  C5b's fill system doesn't apply; a plain neutral hover matches the old
 *  dropdown's own convention for these two rows.
 *
 *  Sign out (owner ruling #6): the app's ONLY sign-out path, so it is
 *  deliberately NOT a small control among ordinary links — full-width,
 *  generous vertical padding, and `env(safe-area-inset-bottom)` so iOS's home
 *  indicator / Safari toolbar can't overlay it. `onNavigate`, when passed,
 *  additionally closes the mobile drawer — these are plain buttons, not
 *  links, so the drawer's own delegated `closest('a')` close handler (on the
 *  `<nav>` below) doesn't catch them. */
function NavFooter({ open = true, onOpenTour, onSignOut, onNavigate }: {
  open?: boolean; onOpenTour: () => void; onSignOut: () => void; onNavigate?: () => void;
}) {
  return (
    <div className="mt-2 pt-3 pb-2 border-t border-green-800/10 flex flex-col gap-1.5">
      <button type="button" onClick={() => { onNavigate?.(); onOpenTour(); }}
        aria-label={open ? undefined : 'App tour'}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-sans text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100 focus-ring ${open ? '' : 'justify-center'}`}>
        <Compass size={17} aria-hidden="true" className="text-green-600 shrink-0" />
        {open && <span className="flex-1 text-left">App tour</span>}
        {!open && <NavTooltipLabel label="App tour" />}
      </button>
      <button type="button" onClick={() => { onNavigate?.(); onSignOut(); }}
        aria-label={open ? undefined : 'Sign out'}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-3 text-[13.5px] font-sans text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100 focus-ring w-full pb-[max(0.75rem,env(safe-area-inset-bottom))] ${open ? '' : 'justify-center'}`}>
        <LogOut size={17} aria-hidden="true" className="text-green-600 shrink-0" />
        {open && <span className="flex-1 text-left">Sign out</span>}
        {!open && <NavTooltipLabel label="Sign out" />}
      </button>
    </div>
  );
}

/** CLIENT LEFT RAIL (desktop only) — the USER quick-access destinations plus
 *  Community Feed. Members only (staff get the management rail).
 *
 *  I1 (owner spec 2026-08-04, tracker I1): this rail used to expand-on-hover
 *  with a pin toggle to keep it open. That collapse/expand control is
 *  removed entirely for USER accounts — a fixed, non-collapsible sidebar,
 *  always the full 240px width. Staff's own rail (below, in AppLayout) never
 *  had an equivalent toggle either, so no account type has a sidebar-
 *  collapse control after this change.
 *
 *  I7: green-glass surface (NAV_GLASS) — see its definition near the top of
 *  this file for the one-line revert.
 *
 *  ONEMENU: gains the trailing App-tour/Sign-out block (`NavFooter`) absorbed
 *  from the removed avatar dropdown — Q4's owner ruling made the dropdown's
 *  removal universal, not mobile-only, so desktop needs this too. */
function ClientRail({ bellCount, dmCount, presence, lessonsOn, onOpenTour, onSignOut }: {
  bellCount: number; dmCount: number; presence: NavPresence; lessonsOn: boolean;
  onOpenTour: () => void; onSignOut: () => void;
}) {
  return (
    <aside className="hidden lg:block shrink-0 relative z-30 w-60">
      <nav className={`sticky top-[var(--cs-hdr-h)] h-[calc(100dvh-var(--cs-hdr-h))] border-r border-green-800/10 ${NAV_GLASS} p-2 overflow-y-auto overflow-x-hidden flex flex-col`}>
        <div className="flex flex-col gap-0.5">
          {/* Community Feed (position 1) with its views nested underneath. */}
          <CommunityNav indentClass="pl-9" />
          <ClientNavItems bellCount={bellCount} dmCount={dmCount} presence={presence} lessonsOn={lessonsOn} />
        </div>
        <NavFooter onOpenTour={onOpenTour} onSignOut={onSignOut} />
      </nav>
    </aside>
  );
}

export default function AppLayout() {
  const { profile, isAdmin, isStaff, isSuperAdmin, hasModule, signOut } = useAuth();
  const dmCount = useDmUnread();
  useViewSurfaces();
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();
  const inboundCount = useInboundOpenCount(isStaff);
  const presence = useNavPresence(!isStaff);
  // I6 — Lessons' module gate for the canonical USER nav order (ClientNavItems),
  // mirroring the staff nav's own `module: 'mod.lessons'` convention.
  const lessonsOn = hasModule('mod.lessons');
  // I2 — the same presence-gated set the rail uses, reused by the avatar
  // dropdown and mobile drawer below (see PresenceLink for why `section`
  // needs its own active-match instead of relying on NavLink's pathname-only
  // check).
  const navLinks = PRESENCE_LINKS.filter((l) => presence[l.key]);
  const accountSection = useActiveAccountSection();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // PLUSPASS — a page's own "+" control (e.g. Home's "+ Post") can jump the
  // shared CreateModal straight past the generic destination menu into a
  // specific step, via CreateModalTriggerContext below.
  const [createStep, setCreateStep] = useState<CreateModalStep>('destination');
  const openCreateAt = useCallback((step: CreateModalStep) => { setCreateStep(step); setCreateOpen(true); }, []);
  const createModalTrigger = useMemo(() => ({ openCreate: openCreateAt }), [openCreateAt]);
  // Mobile left-nav drawer: the side menu, opened by the button in the header
  // (moved there from the content area, owner spec 2026-08-05).
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // I1B — staff rail collapse (recovered pattern: the old USER ClientRail's
  // pin toggle, removed in TASK I and now rebuilt staff-only per owner ruling
  // 2026-08-05). Pinned (default) = full 240/256px rail; unpinned collapses
  // to a 56px icon strip.
  //
  // C2/C3 (owner, 2026-08-07): hover-to-peek is REMOVED — it was the root
  // cause of C2's page-resize bug. The `<aside>` (which reserves page space)
  // followed `staffRailPinned` while the `<nav>` inside it followed a
  // SEPARATE derived `staffRailOpen = staffRailPinned || staffRailHovered`,
  // so clicking the collapse control with the cursor already over the rail
  // left `staffRailHovered` true — the `<nav>` was already wide, only the
  // `<aside>` changed, and the page reflowed while the menu appeared not to
  // move. Fixed at the cause: one state, no derived variant — both elements
  // read `staffRailPinned` directly (and the same `staffRailWidthClass`
  // string, so they can't drift textually either). The rail is now either
  // full or icon-only, never a hover-expanded in-between.
  const [staffRailPinned, setStaffRailPinned] = useState(() => localStorage.getItem('staffRail.pinned') !== '0');
  useEffect(() => { localStorage.setItem('staffRail.pinned', staffRailPinned ? '1' : '0'); }, [staffRailPinned]);
  const staffRailWidthClass = staffRailPinned ? 'w-60 xl:w-64' : 'w-14';

  const name = profile?.display_name || profile?.first_name || 'Member';
  const initial = (name[0] || 'M').toUpperCase();

  const showRail = isStaff;
  const isTrainer = isStaff && !isAdmin;
  // D8: community access is gated by ACCOUNT, not category — no guest gating.
  // The signing wall (3f): a member with pending wall-gating documents is
  // routed to the document flow on sign-in, refresh, and navigation; staff
  // are never hard-walled (persistent banner instead).
  const location = useLocation();
  const [wall, setWall] = useState<WallState | null>(null);
  const [wallRetry, setWallRetry] = useState(0);
  // FAIL CLOSED: myWallState() now throws instead of returning a permissive
  // default, so a transient failure can no longer silently drop the wall. We
  // hold the member at an explicit retryable state rather than letting them
  // through unverified.
  const [wallError, setWallError] = useState(false);
  useEffect(() => {
    let active = true;
    setWallError(false);
    myWallState()
      .then((w) => { if (active) { setWall(w); setWallError(false); } })
      .catch(() => { if (active) { setWall(null); setWallError(true); } });
    return () => { active = false; };
  }, [location.pathname, wallRetry]);

  // A3: the app-overview tour. The desktop and mobile tours are DIFFERENT
  // experiences and persist independently: each keeps auto-opening on ITS form
  // factor until dismissed there (profiles.tour_seen_desktop_at /
  // tour_seen_mobile_at). Revisitable from the avatar menu at any time.
  // Auto-open is deliberately evaluated AFTER the signing wall below, so a
  // member with pending gating documents clears the wall first and meets the
  // tour once their documents are done.
  const [tourOpen, setTourOpen] = useState(false);
  const [tourSeen, setTourSeen] = useState<boolean | null>(null);
  const [tourCategories, setTourCategories] = useState<StandingCategory[]>([]);
  useEffect(() => {
    let active = true;
    getMyProfile()
      .then((pr) => {
        if (!active) return;
        const seenAt = currentTourFormFactor() === 'mobile'
          ? pr?.tour_seen_mobile_at : pr?.tour_seen_desktop_at;
        setTourSeen(pr ? seenAt != null : true);
      })
      .catch(() => active && setTourSeen(true));
    // Swallowing is CORRECT here (unlike the wall): these categories only pick
    // which variant of the presentational tour is shown. On failure the tour
    // falls back to its guest variant — nothing is gated, so there is nothing
    // to fail closed on.
    fetchMyCategories().then((c) => active && setTourCategories(c)).catch(() => {});
    return () => { active = false; };
  }, []);

  /** Dismissing the auto-opened tour stamps the marker; a menu re-open does not. */
  const closeTour = (stamp: boolean) => {
    setTourOpen(false);
    if (!stamp) return;
    setTourSeen(true);
    void markTourSeen().catch(() => { /* presentational marker only */ });
  };
  const [grantKeys, setGrantKeys] = useState<string[]>([]);
  useEffect(() => {
    if (!isTrainer) return;
    fetchMyGrantKeys().then(setGrantKeys).catch(() => {});
  }, [isTrainer]);
  // Inbound's badge is injected here (not in the static MANAGEMENT_GROUP table)
  // since it's a live count, mirroring how the Dashboard badge is passed as a
  // prop rather than baked into QUICK.
  const navGroups = showRail
    ? manageNavGroups(hasModule, isAdmin, isSuperAdmin, grantKeys).map((g) => ({
        ...g,
        items: g.items.map((it) => (it.to === '/app/ops/intake' ? { ...it, badge: inboundCount } : it)),
      }))
    : [];
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const groupOpen = (g: NavGroup) => openGroups[g.key] ?? g.defaultOpen ?? false;
  const toggleGroup = (key: string) => setOpenGroups((p) => ({ ...p, [key]: !(p[key] ?? navGroups.find((g) => g.key === key)?.defaultOpen ?? false) }));

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  // Close the mobile drawer on Escape and on any route change.
  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMobileNavOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  /* Owner, 2026-08-08: "What is the point of the overlay if you can still scroll
     the page when the menu is open?" — correct, and it was worse than cosmetic:
     the drawer declares role="dialog" aria-modal="true" while the page kept
     scrolling behind it, so the scrim was decorative and the ARIA was a lie.
     Locking the body while it is open makes the scrim mean something.

     `position: fixed` on <body> rather than `overflow: hidden`, because iOS
     Safari ignores overflow:hidden on body — and the scroll position is captured
     and restored, since going fixed otherwise jumps the page to the top on close. */
  useEffect(() => {
    if (!mobileNavOpen) return;
    const y = window.scrollY;
    const { body } = document;
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width };
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.width = '100%';
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, y);
    };
  }, [mobileNavOpen]);
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate('/');
  }
  const closeMenu = () => setMenuOpen(false);
  const closeMobileNav = () => setMobileNavOpen(false);

  // THE SIGNING WALL (3f): pending wall-gating documents route the member to
  // the document flow on sign-in / refresh / navigation until every gating
  // document is signed. The wall IS the prompt — no dashboard notification.
  // Sign-out stays reachable (the flow renders inside the layout chrome).
  //
  // TASK-WALLRETURN: capture where they were actually headed before the
  // redirect discards it — Onboarding's enterApp() reads this back once the
  // member is done here, instead of always landing on the default dashboard/
  // community view. Does not weaken the wall itself: the redirect below is
  // unchanged, this only remembers what it's about to overwrite.
  if (wall?.wall && location.pathname !== '/app/onboarding') {
    captureWallReturnDestination(location.pathname, location.search);
    return <Navigate to="/app/onboarding" replace />;
  }

  // FAIL CLOSED: we could not determine whether this member is walled. Rather
  // than assume they are clear (the old silent behaviour), hold here with a
  // retry. The onboarding route itself stays reachable — it is where a genuinely
  // walled member needs to go, and it re-checks on its own.
  if (wallError && !wall && location.pathname !== '/app/onboarding') {
    return (
      <div className="min-h-screen bg-cream grid place-items-center px-4">
        <div className="bg-white border border-green-800/10 rounded-xl p-6 max-w-md text-center">
          <h1 className="font-serif text-xl text-green-800 mb-2">We couldn't check your documents</h1>
          <p className="body-text text-sm text-muted mb-4">
            We can't confirm whether you have documents awaiting signature, so we've
            paused here rather than let you past. This is usually a brief connection
            problem.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button type="button" className="btn-primary" onClick={() => setWallRetry((n) => n + 1)}>
              Try again
            </button>
            <Link to="/app/onboarding" className="btn-outline-gold">Go to my documents</Link>
          </div>
        </div>
      </div>
    );
  }

  // A3 auto-open — strictly after the wall check above: an unseen tour only
  // opens once the member is past any gating documents (the wall returns early,
  // so this line is unreachable while a wall is pending). The onboarding route
  // owns its own mount, so we never double-open there.
  if (tourSeen === false && !tourOpen && location.pathname !== '/app/onboarding') {
    setTourOpen(true);
  }

  /* THE ACCOUNT DROPDOWN — hoisted out of the header markup because there are
     now two headers (superadmin's untouched platform chrome and the tenant's
     cardstock nameplate) and this panel is identical in both. Hoisting keeps
     ONE copy of the MenuLink set rather than a duplicate that can drift.
     Unchanged from its previous form: same links, same order, same handlers. */
  const accountMenu = menuOpen ? (
    <div className="absolute right-0 mt-1 w-60 max-w-[calc(100vw-2rem)] bg-white border border-green-800/10 shadow-md rounded-md py-1 max-h-[calc(100dvh-5rem)] overflow-y-auto z-50 pb-3">
      <p className="px-4 py-2 text-xs text-muted border-b border-green-800/10 truncate">{name}</p>
      <MenuLink to="/app/account" label="Account" icon={UserRound} onNavigate={closeMenu} />
      {/* admin references — company-associable items only */}
      {isAdmin && !isSuperAdmin && (
        <>
          <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">Company</div>
          <button type="button"
            onClick={() => { closeMenu(); navigate('/app/ops/documents'); }}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100 focus-ring">
            <FileText size={17} /> Pending agreements
          </button>
          {/* Both operators navigate to the community + catalog to help
              members with what they're seeing — no shopper-only links. */}
          <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">Quick access</div>
          <div className="px-1"><CommunityNav onNavigate={closeMenu} indentClass="pl-9" /></div>
          <button type="button" onClick={() => { closeMenu(); navigate('/app/dashboard'); }}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100 focus-ring">
            <LayoutDashboard size={17} /> Dashboard
            {unreadCount > 0 && <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full bg-gold-600/70 text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <button type="button" onClick={() => { closeMenu(); navigate('/app/catalog'); }}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100 focus-ring">
            <ShoppingBag size={17} /> Catalog
          </button>
        </>
      )}
      {/* client quick links — an admin's menu carries company work, not shopper shortcuts */}
      {!isAdmin && !isSuperAdmin && (
        <>
          <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">Quick access</div>
          <div className="px-1"><CommunityNav onNavigate={closeMenu} indentClass="pl-9" /></div>
          {QUICK.map((q) => {
            const raw = q.badge === 'notifications' ? unreadCount : q.badge === 'messages' ? dmCount : 0;
            const badge = raw > 0 ? raw : 0;
            return (
              <button key={q.label} type="button"
                onClick={() => { closeMenu(); navigate(q.to); }}
                className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100 focus-ring">
                <q.icon size={17} /> {q.label}
                {badge > 0 && <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full bg-gold-600/70 text-white">{badge > 9 ? '9+' : badge}</span>}
              </button>
            );
          })}
          {/* I2 — same five presence-gated links as the rail, dropdown-shaped. */}
          {navLinks.map((l) => {
            const isActive = l.section ? accountSection === l.section : location.pathname === l.to;
            return (
              <Link key={l.key} to={l.to} onClick={closeMenu}
                className={`flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans focus-ring ${
                  isActive ? 'bg-cream-200 text-green-800 font-medium ' : 'text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100'}`}>
                <l.icon size={17} /> {l.label}
              </Link>
            );
          })}
        </>
      )}
      {navGroups.length > 0 && (
        <div className="lg:hidden">
          {navGroups.map((g) => (
            <div key={g.key}>
              <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">
                {g.label}
              </div>
              {g.items.map((it) => <MenuLink key={it.to} {...it} onNavigate={closeMenu} />)}
            </div>
          ))}
        </div>
      )}
      <button type="button"
        onClick={() => { closeMenu(); setTourOpen(true); }}
        className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100 border-t border-green-800/10 focus-ring">
        <Compass size={17} aria-hidden="true" className="shrink-0" /> App tour
      </button>
      <button type="button" onClick={handleSignOut}
        className="flex items-center gap-3 px-4 py-2.5 mt-1 w-full text-sm font-sans text-secondary [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100 border-t border-green-800/10 focus-ring">
        <LogOut size={17} aria-hidden="true" className="shrink-0" /> Sign out
      </button>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-cream">
      {/* Staff belt-and-suspenders: never hard-walled — a persistent banner
          links to the flow instead (ops must stay reachable). */}
      {wall?.staff_banner && (
        <div className="bg-gold-50 border-b border-gold-600/40 px-4 py-2 text-sm text-gold-900 text-center">
          You have documents awaiting your signature.{' '}
          <Link to="/app/onboarding" className="underline font-medium">Review and sign</Link>
        </div>
      )}
      {isSuperAdmin ? (
      /* ── SUPERADMIN: PLATFORM CHROME, DELIBERATELY UNTOUCHED ──────────────
         This is the platform operator's chrome, not a tenant's branding, and it
         gets its own design later. It receives NONE of the cardstock header's
         parts — no sheet, no wordmark, no tabs — so it also keeps the mobile nav
         BUTTON that the drawer tab replaced everywhere else, and its avatar
         keeps its ChevronDown. Rendered output is byte-for-byte what it was.

         ONEMENU (2026-08-07): the tenant's CardstockHeader avatar is now an
         inert monogram and no longer renders `accountMenu` at all — its
         contents (Account, Company, Quick access, Sign out) moved into the
         tenant side nav (rail + drawer) instead. `accountMenu` itself is
         UNCHANGED and lives on here, exclusively for superadmin: it is the
         platform operator's only sign-out path, and Q3's ruling was to leave
         this chrome alone entirely rather than fold it into the
         consolidation too. */
      <header className="sticky top-0 z-40 bg-white border-b border-green-800/10">
        <div className="w-full max-w-[120rem] mx-auto grid grid-cols-[auto_1fr_auto] items-center gap-2 px-4 sm:px-8 h-14">
          <div className="flex items-center gap-3 justify-self-start">
            {/* Placeholder wordmark until the platform product is named/branded.
                Never gets the tenant's centered wordmark — there is no tenant
                brand to show here. */}
            <Link to="/app/ops/superadmin/organizations" className="flex items-center gap-2.5" aria-label="Platform — organizations">
              <span className="w-[34px] h-[34px] rounded-lg bg-green-950 text-gold-400 grid place-items-center font-display text-lg font-semibold shrink-0">C</span>
              <span className="hidden sm:inline font-display text-green-900 text-lg uppercase tracking-wide">Cactai Platform</span>
            </Link>
            {/* MOBILE NAV BUTTON — kept here, and ONLY here. Desktop (lg+) has
                the rail instead. */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              className="lg:hidden p-2 text-green-800 rounded-lg hover:bg-cream-100 focus-ring"
            >
              <PanelLeftOpen size={20} aria-hidden="true" />
            </button>
          </div>

          {/* empty middle column so the 3-column grid still holds and the right
              cluster stays right-aligned rather than re-centering into it */}
          <div className="hidden sm:flex justify-self-center items-center" />

          <div className="flex items-center gap-3 justify-self-end">
            <button type="button" onClick={() => setCreateOpen(true)}
              className="p-2 text-green-800 rounded-lg hover:bg-cream-100 focus-ring" aria-label="Create">
              <Plus size={20} />
            </button>
            <button type="button" onClick={() => navigate('/app/calendar')}
              className="p-2 text-green-800 rounded-lg hover:bg-cream-100 focus-ring" aria-label="Calendar">
              <CalendarDays size={18} />
            </button>
            <div className="relative" ref={menuRef}>
              <button type="button" onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100 focus-ring"
                aria-label="Account menu" aria-expanded={menuOpen}>
                {/* No notifications badge on the avatar — the count lives on the
                    Dashboard nav link (desktop rail + mobile menu) instead. */}
                <span className="w-8 h-8 rounded-full bg-green-800 text-white text-sm font-sans grid place-items-center">
                  {initial}
                </span>
                <ChevronDown size={14} className="text-secondary" />
              </button>
              {accountMenu}
            </div>
          </div>
        </div>
      </header>
      ) : (
        /* ── THE CARDSTOCK NAMEPLATE ──────────────────────────────────────────
           The tenant header: a Racing Green cardstock sheet carrying exactly
           three marks — embossed FH squircle, embossed wordmark, debossed
           avatar. See CardstockHeader.tsx and header-cardstock.css; the
           specification is docs/reference/header-mockup.html.

           Gone from here on purpose: the Calendar button (already in the
           nav), the mobile nav button (now the drawer tab, moved to the
           top-right below) and the avatar's ChevronDown (ONEMENU: the
           debossed avatar is now a decorative monogram — no menu at all, see
           CardstockHeader.tsx). The Create tab is admin/staff + desktop only;
           a regular member's create path is the page-level `+` controls
           (PLUSPASS). */
        <CardstockHeader initial={initial} />
      )}

      <div className="w-full max-w-[120rem] mx-auto flex">
        {/* Members (non-staff) get a fixed quick-access rail on desktop (I1). */}
        {!showRail && !isSuperAdmin && (
          <ClientRail bellCount={unreadCount} dmCount={dmCount} presence={presence} lessonsOn={lessonsOn}
            onOpenTour={() => setTourOpen(true)} onSignOut={handleSignOut} />
        )}
        {showRail && (
          /* I1B — width behaves like the old ClientRail: the <aside> RESERVES
             56px normally / 240-256px when PINNED (page sits beside it); the
             <nav> is sticky and matches it exactly (C2/C3: both read
             `staffRailPinned`/`staffRailWidthClass` directly now — no more
             hover-driven divergence between the two). */
          <aside className={`hidden lg:block shrink-0 relative z-30 transition-[width] duration-100 ease-out ${staffRailWidthClass}`}>
            {/* `flex flex-col` is load-bearing: it is what lets the collapse
                toggle's `mt-auto` push it (and Sign out) to the foot of the
                rail. ClientRail already had it; this one did not. */}
            <nav className={`p-3 sticky top-[var(--cs-hdr-h)] h-[calc(100dvh-var(--cs-hdr-h))] overflow-y-auto overflow-x-hidden border-r border-green-800/10 bg-cream-100/40 flex flex-col transition-[width] duration-100 ease-out ${staffRailWidthClass}`}>
              {/* Owner, 2026-08-07: the create control lives HERE now, in the
                  slot the collapse toggle used to occupy, and the header's
                  hanging tab is gone. Icon only in both states — no label even
                  when the rail is open, so position 1 is identical expanded and
                  collapsed and the eye does not have to re-find it. The collapse
                  toggle moved to the foot of the rail, above Sign out. */}
              <div className="flex justify-end mb-1">
                <button type="button" onClick={() => setCreateOpen(true)}
                  aria-label="Create" aria-haspopup="dialog"
                  /* Owner, 2026-08-08: match the rail's own item metrics. This
                     was `p-2.5` + `hover:bg-white`, inherited from the old
                     collapse button — 10px padding against every nav item's
                     `px-3 py-2.5`, so the icon sat off the shared centre line in
                     the collapsed rail, and the white hover belonged to no other
                     surface in the nav. */
                  className="flex items-center justify-center rounded-lg px-3 py-2.5 text-green-700 [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100 focus-ring">
                  <Plus size={18} aria-hidden="true" className="shrink-0" />
                </button>
              </div>
              {/* The static heading here used to read "Management", duplicating
                  the Management GROUP below it — two identical labels in one nav.
                  Platform still gets one because it is the super-admin's only
                  section; a tenant's rail is self-describing. */}
              {isSuperAdmin && staffRailPinned && (
                <p className="px-3 pt-1 pb-2 text-[10px] tracking-widest uppercase text-muted font-semibold">
                  Platform
                </p>
              )}
              {!isSuperAdmin && (
                <div className="mb-1 flex flex-col gap-0.5">
                  <CommunityNav open={staffRailPinned} indentClass="pl-9" />
                  <StaffNavItems bellCount={unreadCount} dmCount={dmCount} open={staffRailPinned} />
                </div>
              )}
              <div className="flex flex-col gap-1">
                {navGroups.map((g) => (
                  <div key={g.key}>
                    {navGroups.length > 1 && staffRailPinned && (
                      <button type="button" onClick={() => toggleGroup(g.key)}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] tracking-widest uppercase text-muted font-semibold hover:text-green-800 focus-ring rounded-md">
                        {g.label}
                        <ChevronDown size={12} className={`transition-transform ${groupOpen(g) ? '' : '-rotate-90'}`} />
                      </button>
                    )}
                    {/* collapsed strip: group headings shrink to a plain separator */}
                    {navGroups.length > 1 && !staffRailPinned && (
                      <div className="my-1 border-t border-green-800/10" role="separator" aria-label={g.label} />
                    )}
                    {(navGroups.length === 1 || groupOpen(g) || !staffRailPinned) && (
                      <div className="flex flex-col gap-0.5">
                        {g.items.map((it) => <RailLink key={it.to} {...it} open={staffRailPinned} />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* ONEMENU — absorbed from the removed avatar dropdown. Staff
                  never had a personal Account link in ANY nav surface before
                  this (owner ruling #3: "no exceptions"). Tour/Sign-out are
                  universal (Q4: dropdown removed everywhere, not mobile-only)
                  — gated off for superadmin, which keeps its own separate
                  avatar-menu sign-out untouched. */}
              {!isSuperAdmin && (
                <>
                  <div className="mt-1 flex flex-col gap-0.5">
                    <AccountNavLink open={staffRailPinned} />
                  </div>
                  {/* Owner, 2026-08-07: the collapse toggle sits at the FOOT of
                      the rail, immediately above Sign out, and stays right-
                      justified in BOTH states so it does not move when the rail
                      collapses. `mt-auto` pins this block to the bottom — the
                      <nav> is already flex-col, so the toggle and footer are
                      pushed down regardless of how few nav items are present. */}
                  <div className="mt-auto flex justify-end pt-2">
                    <button type="button" onClick={() => setStaffRailPinned((v) => !v)}
                      aria-label={staffRailPinned ? 'Collapse menu' : 'Keep menu open'} aria-pressed={staffRailPinned}
                      /* Owner, 2026-08-08: match the rail's own item metrics. This
                     was `p-2.5` + `hover:bg-white`, inherited from the old
                     collapse button — 10px padding against every nav item's
                     `px-3 py-2.5`, so the icon sat off the shared centre line in
                     the collapsed rail, and the white hover belonged to no other
                     surface in the nav. */
                  className="flex items-center justify-center rounded-lg px-3 py-2.5 text-green-700 [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100 focus-ring">
                      {staffRailPinned ? <PanelLeftClose size={18} className="shrink-0" /> : <PanelLeftOpen size={18} className="shrink-0" />}
                    </button>
                  </div>
                  <NavFooter open={staffRailPinned} onOpenTour={() => setTourOpen(true)} onSignOut={handleSignOut} />
                </>
              )}
            </nav>
          </aside>
        )}
        <main className="flex-1 min-w-0 px-4 sm:px-8 xl:px-12 pt-10 sm:py-9 pb-24">
          <CreateModalTriggerContext.Provider value={createModalTrigger}>
            <Outlet />
          </CreateModalTriggerContext.Provider>
        </main>
      </div>

      {/* MOBILE NAV DRAWER — the side menu as an overlay panel, now the ONLY
          mobile menu (ONEMENU: absorbs the old avatar dropdown). Members get
          the same canonical-order quick-access set as the desktop rail (I6,
          now including My Saved Items — see that comment) PLUS the trailing
          Account/App-tour/Sign-out block the dropdown used to carry; staff
          get their grouped management nav PLUS the same trailing block, now
          including a personal Account link they never had in any mobile
          surface before. A click on any link inside closes it (delegated
          `closest('a')` handler below — Sign out/App tour are buttons, not
          links, so `NavFooter` closes explicitly via its own `onNavigate`).
          I7: green-glass surface (NAV_GLASS) — see its definition near the
          top of this file for the one-line revert. */}
      {/* THE DRAWER TAB — mobile only. ONEMENU A1 (owner, 2026-08-07): moved
          from the left edge to the top-right, below the header — the top-
          right is the emptiest part of the UI at initial load, and the tab's
          own mechanics (motion, glass, rides-out-on-the-drawer's-edge) are
          unchanged, just mirrored. Still the drawer's own green glass
          (NAV_GLASS), not cardstock, because it belongs to the drawer rather
          than the header.

          It translates by min(288px,85vw) — the drawer's OWN width formula
          (w-72 max-w-[85vw] below) — so it lands on the drawer's edge at any
          viewport instead of at a guessed offset (the CSS negates this for
          the now-leftward slide — see header-cardstock.css).

          Tab and drawer are driven from the single `mobileNavOpen` state, so
          they cannot desync: the tab's position, its arrow, its labels and the
          drawer are all one boolean. Every close path already routes through
          that state — the scrim's onClick, the Escape handler and the
          route-change effect above, and a selection inside the drawer.

          Superadmin does not get it (it keeps its own mobile nav button,
          unchanged, and its own drawer anchor — see the `isSuperAdmin` check
          on the `<nav>` below); the CSS also hides it at lg+, where the rail
          is the nav. */}
      {!isSuperAdmin && (
        <button
          type="button"
          className={`cs-drawer-tab${mobileNavOpen ? ' is-open' : ''}`}
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileNavOpen}
        >
          <ChevronLeft size={20} aria-hidden="true" strokeWidth={2.25} />
        </button>
      )}

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          {/* B4 (owner, 2026-08-07): black/white scrim, not the drawer's own
              green family — the green-on-green barely separated. Applied
              unconditionally (superadmin's drawer is the same green glass and
              gets the same legibility fix; this is a neutral utility colour,
              not tenant branding). */}
          <div className="absolute inset-0 bg-green-950/45" onClick={closeMobileNav} aria-hidden="true" />
          <nav
            className={`absolute inset-y-0 ${isSuperAdmin ? 'left-0' : 'right-0'} w-72 max-w-[85vw] ${NAV_GLASS} shadow-xl p-3 overflow-y-auto`}
            onClick={(e) => {
              // any real navigation inside closes the drawer
              if ((e.target as HTMLElement).closest('a')) closeMobileNav();
            }}
          >
            {/* I3, amended B2 (owner, 2026-08-07): the "Close" button is
                removed for tenant users — the drawer tab now closes the
                drawer and rides out on its own edge, a second control for
                one job. Superadmin has no such tab (excluded from ONEMENU's
                consolidation) and reaches this same shared drawer via its own
                separate mobile-nav button, so it keeps an explicit close
                control here. */}
            <div className="flex items-center justify-between px-1 pt-1 pb-4">
              <span aria-hidden="true" />
              {isSuperAdmin && (
                <button type="button" onClick={closeMobileNav} aria-label="Close menu"
                  className="flex items-center gap-1.5 pl-3 pr-3 py-2.5 rounded-lg bg-cream-200 text-green-800 font-medium text-[13px] font-sans hover:bg-cream-200/70 focus-ring">
                  Close <PanelLeftClose size={16} aria-hidden="true" />
                </button>
              )}
            </div>
            {!isSuperAdmin && (
              <div className="flex flex-col gap-0.5 mb-1">
                <CommunityNav onNavigate={closeMobileNav} indentClass="pl-9" />
                {!showRail ? (
                  <ClientNavItems bellCount={unreadCount} dmCount={dmCount} presence={presence} lessonsOn={lessonsOn} onNavigate={closeMobileNav} />
                ) : (
                  <StaffNavItems bellCount={unreadCount} dmCount={dmCount} />
                )}
              </div>
            )}
            {navGroups.map((g) => (
              <div key={g.key}>
                <div className="mt-2 border-t border-green-800/10 pt-2 px-3 pb-1 text-[10px] tracking-widest uppercase text-muted font-semibold">
                  {g.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {g.items.map((it) => <RailLink key={it.to} {...it} />)}
                </div>
              </div>
            ))}
            {/* ONEMENU — absorbed from the removed avatar dropdown, staff
                only (members already end their own list with AccountNavLink
                above — I6). */}
            {!isSuperAdmin && showRail && (
              <div className="mt-1 flex flex-col gap-0.5">
                <AccountNavLink onNavigate={closeMobileNav} />
              </div>
            )}
            {!isSuperAdmin && (
              <NavFooter onOpenTour={() => setTourOpen(true)} onSignOut={handleSignOut} onNavigate={closeMobileNav} />
            )}
          </nav>
        </div>
      )}

      {createOpen && (
        <CreateModal
          initialStep={createStep}
          onClose={() => { setCreateOpen(false); setCreateStep('destination'); }}
        />
      )}

      {/* A3: the tour. Auto-opened on first login (stamps the marker on
          dismiss) or re-opened from the avatar menu (leaves the marker be). */}
      <AppOverviewModal
        open={tourOpen}
        onClose={() => closeTour(tourSeen === false)}
        categories={tourCategories}
        presence={presence}
        lessonsOn={lessonsOn}
      />
    </div>
  );
}
