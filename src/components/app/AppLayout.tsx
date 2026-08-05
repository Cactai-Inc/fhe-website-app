import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { FEED_VIEWS, FEED_VIEW_META, type FeedView } from '../../lib/seed';
import { dmUnreadTotal } from '../../lib/community';
import {
  CalendarDays, Users, FileText, UserRound, ReceiptText, Shield, LogOut,
  GraduationCap, Home as HomeIcon, Boxes, Contact, LayoutDashboard,
  Mail, ChevronDown, ChevronUp, Plus, LifeBuoy, ShoppingBag, MessageSquare, BookOpen, ListChecks,
  PanelLeft, PanelLeftClose, Activity, Compass, Handshake, Grid3x3, Bookmark,
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
import { CreateModal } from './CreateModal';

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
  { key: 'orders', label: 'Orders', icon: ReceiptText, to: '/app/orders' },
  { key: 'documents', label: 'Documents', icon: FileText, to: '/app/documents' },
  { key: 'stable', label: 'Stable', icon: Boxes, to: '/app/account?section=stable', section: 'stable' },
  { key: 'posts', label: 'My Posts', icon: Grid3x3, to: '/app/my-posts' },
  { key: 'saved', label: 'Saved Content', icon: Bookmark, to: '/app/account?section=saved', section: 'saved' },
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

/** I4 — selected-page indicator. The old dark-green fill (`bg-green-800
 *  text-white`) was overpowering on the light UI and the small white text
 *  read poorly at mobile sizes. Replacement: `bg-cream-200` (one step darker
 *  than the cream-100 nav panels, same hue family — tailwind.config.js's
 *  cream scale has no darker step than 200, so nothing was invented) with
 *  dark green text (fixes the light-text-on-dark-fill complaint directly),
 *  plus a gold ring matching the icon's existing active-state gold. Built
 *  and shipped WITH the ring: `bg-cream-200 text-green-800 font-medium`
 *  alone (no `ring-*`) tested too subtle against the cream-100/white
 *  surroundings to read clearly as "selected" — that bare variant is the
 *  one-line revert if the call changes later. Applied identically at every
 *  render site that shows a selected-state nav item (this component,
 *  MenuLink, and both CommunityNav rows below). */
function RailLink({ to, label, icon: Icon, end, badge = 0, open = true }: NavItem & { badge?: number; open?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={open ? undefined : label}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-sans transition-colors focus-ring ${open ? '' : 'justify-center'} ${
          // ring variant (ships): 'bg-cream-200 text-green-800 font-medium '
          // fill-only revert:     'bg-cream-200 text-green-800 font-medium'
          isActive ? 'bg-cream-200 text-green-800 font-medium ' : 'text-secondary hover:bg-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative shrink-0">
            <Icon size={17} aria-hidden="true" className={isActive ? 'text-gold-400' : 'text-green-600'} />
            {badge > 0 && !open && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[1rem] h-4 px-1 bg-gold-600 text-white text-[10px] leading-4 text-center rounded-full">{badge > 9 ? '9+' : badge}</span>
            )}
          </span>
          {open && <span className="flex-1">{label}</span>}
          {badge > 0 && open && (
            <span className="min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full bg-gold-600 text-white">{badge > 9 ? '9+' : badge}</span>
          )}
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
          isActive ? 'bg-cream-200 text-green-800 font-medium ' : 'text-secondary hover:bg-green-800/[0.06]'
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
    <Link to={to} onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-sans transition-colors focus-ring ${
        isActive ? 'bg-cream-200 text-green-800 font-medium ' : 'text-secondary hover:bg-white'}`}>
      <Icon size={18} aria-hidden="true" className={isActive ? 'text-gold-400' : 'text-green-600'} />
      <span className="whitespace-nowrap flex-1">{label}</span>
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
      <Link to="/app" onClick={onNavigate} title="Community Feed"
        className={`flex items-center justify-center rounded-lg px-3 py-2.5 focus-ring ${onFeed ? 'bg-cream-200 text-green-800' : 'text-secondary hover:bg-white'}`}>
        <Users size={18} className={onFeed ? 'text-gold-400' : 'text-green-600'} />
      </Link>
    );
  }

  return (
    <div>
      {/* parent row — the label links to the full feed (= All) and highlights when
          it's the active view; the toggle shows/hides the sublinks. I5: down arrow +
          "show" when collapsed, up arrow + "hide" when expanded — replaces the old
          right-pointing (rotated ChevronDown) collapsed state. */}
      <div className={`flex items-center rounded-lg pr-1 ${isAll ? 'bg-cream-200 ' : 'hover:bg-white'}`}>
        <Link to="/app" onClick={onNavigate}
          className={`flex items-center gap-3 flex-1 min-w-0 px-3 py-2.5 text-[13.5px] font-sans focus-ring rounded-lg ${isAll ? 'text-green-800 font-medium' : 'text-secondary'}`}>
          <Users size={18} className={`shrink-0 ${isAll ? 'text-gold-400' : 'text-green-600'}`} />
          <span className="whitespace-nowrap">Community Feed</span>
        </Link>
        <button type="button" onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse community views' : 'Expand community views'}
          aria-expanded={expanded}
          className="shrink-0 flex items-center gap-1 px-1.5 py-1.5 rounded-md text-green-700 hover:bg-green-800/[0.06] focus-ring">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          <span className="text-[10px] text-muted">{expanded ? 'hide' : 'show'}</span>
        </button>
      </div>
      {/* nested views (specific filters only) — the selected one highlights */}
      {expanded && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {COMMUNITY_VIEWS.filter((v) => v.key !== 'all').map((v) => {
            const isActive = active === v.key;
            return (
              <Link key={v.key} to={communityHref(v.key)} onClick={onNavigate}
                className={`flex items-center ${indentClass} pr-3 py-1.5 rounded-lg text-[13px] font-sans transition-colors focus-ring ${
                  isActive ? 'bg-cream-200 text-green-800 font-medium ' : 'text-secondary hover:bg-white'}`}>
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

/** CLIENT LEFT RAIL (desktop only) — the USER quick-access destinations plus
 *  Community Feed. Members only (staff get the management rail).
 *
 *  I1 (owner spec 2026-08-04, tracker I1): this rail used to expand-on-hover
 *  with a pin toggle to keep it open. That collapse/expand control is
 *  removed entirely for USER accounts — a fixed, non-collapsible sidebar,
 *  always the full 240px width. Staff's own rail (below, in AppLayout) never
 *  had an equivalent toggle either, so no account type has a sidebar-
 *  collapse control after this change. */
function ClientRail({ bellCount, dmCount, presence }: { bellCount: number; dmCount: number; presence: NavPresence }) {
  // D8: community access follows the ACCOUNT — every member sees the full
  // quick list and the community feed ("guest" is display copy only).
  const quick = QUICK;
  // I2 — Orders, Documents, Stable, My Posts, Saved Content: only the ones
  // my_nav_presence() confirms have ≥1 entry. While empty, all five stay
  // reachable from the Account page only (unchanged).
  const links = PRESENCE_LINKS.filter((l) => presence[l.key]);

  return (
    <aside className="hidden lg:block shrink-0 relative z-30 w-60">
      <nav className="sticky top-14 h-[calc(100dvh-3.5rem)] border-r border-green-800/10 bg-cream-100 p-2 overflow-y-auto overflow-x-hidden flex flex-col">
        <div className="flex flex-col gap-0.5">
          {/* Community Feed (position 1) with its views nested underneath. */}
          <CommunityNav indentClass="pl-9" />
          {quick.map((q) => {
            const raw = q.badge === 'notifications' ? bellCount : q.badge === 'messages' ? dmCount : 0;
            const badge = raw > 0 ? raw : 0;
            return (
              <NavLink key={q.label} to={q.to} end={q.end}
                className={({ isActive: active }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-sans transition-colors focus-ring ${
                    active ? 'bg-cream-200 text-green-800 font-medium ' : 'text-secondary hover:bg-white'}`}>
                {({ isActive: active }) => (
                    <>
                      <q.icon size={18} aria-hidden="true" className={active ? 'text-gold-400' : 'text-green-600'} />
                      <span className="whitespace-nowrap flex-1">{q.label}</span>
                      {badge > 0 && (
                        <span className="min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full bg-gold-600 text-white">{badge > 9 ? '9+' : badge}</span>
                      )}
                    </>
                )}
              </NavLink>
            );
          })}
          {links.map((l) => <PresenceLink key={l.key} to={l.to} label={l.label} icon={l.icon} section={l.section} />)}
        </div>
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
  // I2 — the same presence-gated set the rail uses, reused by the avatar
  // dropdown and mobile drawer below (see PresenceLink for why `section`
  // needs its own active-match instead of relying on NavLink's pathname-only
  // check).
  const navLinks = PRESENCE_LINKS.filter((l) => presence[l.key]);
  const accountSection = useActiveAccountSection();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // Mobile left-nav drawer: the side menu, opened by the button in the header
  // (moved there from the content area, owner spec 2026-08-05).
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // I1B — staff rail collapse (recovered pattern: the old USER ClientRail's
  // pin/hover-to-peek toggle, removed in TASK I and now rebuilt staff-only per
  // owner ruling 2026-08-05). Pinned (default) = full 240/256px rail; unpinned
  // collapses to a 56px icon strip that peeks open on hover, same mechanics as
  // the old ClientRail (see git history).
  const [staffRailPinned, setStaffRailPinned] = useState(() => localStorage.getItem('staffRail.pinned') !== '0');
  const [staffRailHovered, setStaffRailHovered] = useState(false);
  useEffect(() => { localStorage.setItem('staffRail.pinned', staffRailPinned ? '1' : '0'); }, [staffRailPinned]);
  const staffRailOpen = staffRailPinned || staffRailHovered;

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
  if (wall?.wall && location.pathname !== '/app/onboarding') {
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
      <header className="sticky top-0 z-40 bg-white border-b border-green-800/10">
        <div className="w-full max-w-[120rem] mx-auto flex items-center justify-between px-4 sm:px-8 h-14">
          <div className="flex items-center gap-3">
            {isSuperAdmin ? (
              /* the PLATFORM operator's chrome — never a tenant's brand. Placeholder
                 wordmark until the platform product is named/branded. */
              <Link to="/app/ops/superadmin/organizations" className="flex items-center gap-2.5" aria-label="Platform — organizations">
                <span className="w-[34px] h-[34px] rounded-lg bg-green-950 text-gold-400 grid place-items-center font-display text-lg font-semibold shrink-0">C</span>
                <span className="hidden sm:inline font-display text-green-900 text-lg uppercase tracking-wide">Cactai Platform</span>
              </Link>
            ) : (
              <Link to="/app" className="flex items-center gap-2.5" aria-label="French Heritage — home">
                <span className="w-[34px] h-[34px] rounded-lg bg-green-800 text-gold-400 grid place-items-center font-display text-lg font-semibold shrink-0">F</span>
                <span className="hidden sm:inline font-display text-green-800 text-lg uppercase tracking-wide">French Heritage</span>
              </Link>
            )}
            {/* MOBILE NAV BUTTON — opens the left side menu. Moved into the header,
                to the right of the logo mark, from the content area (owner spec
                2026-08-05); the drawer itself and its Close behavior (I3) are
                unchanged. Desktop (lg+) has the rail instead. */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              className="lg:hidden inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-green-800/15 bg-white text-green-800 shadow-sm hover:bg-cream-100 focus-ring"
            >
              <PanelLeft size={18} aria-hidden="true" />
              <span className="text-[13px] font-sans">Menu</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
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
                className="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full hover:bg-green-800/[0.06] focus-ring"
                aria-label="Account menu" aria-expanded={menuOpen}>
                {/* No notifications badge on the avatar — the count lives on the
                    Dashboard nav link (desktop rail + mobile menu) instead. */}
                <span className="w-8 h-8 rounded-full bg-green-800 text-white text-sm font-sans grid place-items-center">
                  {initial}
                </span>
                <ChevronDown size={14} className="text-secondary" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-60 max-w-[calc(100vw-2rem)] bg-white border border-green-800/10 shadow-md rounded-md py-1 max-h-[calc(100dvh-5rem)] overflow-y-auto z-50 pb-3">
                  <p className="px-4 py-2 text-xs text-muted border-b border-green-800/10 truncate">{name}</p>
                  <MenuLink to="/app/account" label="Account" icon={UserRound} onNavigate={closeMenu} />
                  {/* admin references — company-associable items only */}
                  {isAdmin && !isSuperAdmin && (
                    <>
                      <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">Company</div>
                      <button type="button"
                        onClick={() => { closeMenu(); navigate('/app/ops/documents'); }}
                        className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary hover:bg-green-800/[0.06] focus-ring">
                        <FileText size={17} /> Pending agreements
                      </button>
                      {/* Both operators navigate to the community + catalog to help
                          members with what they're seeing — no shopper-only links. */}
                      <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">Quick access</div>
                      <div className="px-1"><CommunityNav onNavigate={closeMenu} indentClass="pl-9" /></div>
                      <button type="button" onClick={() => { closeMenu(); navigate('/app/dashboard'); }}
                        className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary hover:bg-green-800/[0.06] focus-ring">
                        <LayoutDashboard size={17} /> Dashboard
                        {unreadCount > 0 && <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full bg-gold-600 text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                      </button>
                      <button type="button" onClick={() => { closeMenu(); navigate('/app/catalog'); }}
                        className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary hover:bg-green-800/[0.06] focus-ring">
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
                            className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary hover:bg-green-800/[0.06] focus-ring">
                            <q.icon size={17} /> {q.label}
                            {badge > 0 && <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full bg-gold-600 text-white">{badge > 9 ? '9+' : badge}</span>}
                          </button>
                        );
                      })}
                      {/* I2 — same five presence-gated links as the rail, dropdown-shaped. */}
                      {navLinks.map((l) => {
                        const isActive = l.section ? accountSection === l.section : location.pathname === l.to;
                        return (
                          <Link key={l.key} to={l.to} onClick={closeMenu}
                            className={`flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans focus-ring ${
                              isActive ? 'bg-cream-200 text-green-800 font-medium ' : 'text-secondary hover:bg-green-800/[0.06]'}`}>
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
                    className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary hover:bg-green-800/[0.06] border-t border-green-800/10 focus-ring">
                    <Compass size={17} aria-hidden="true" /> App tour
                  </button>
                  <button type="button" onClick={handleSignOut}
                    className="flex items-center gap-3 px-4 py-2.5 mt-1 w-full text-sm font-sans text-secondary hover:bg-green-800/[0.06] border-t border-green-800/10 focus-ring">
                    <LogOut size={17} aria-hidden="true" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="w-full max-w-[120rem] mx-auto flex">
        {/* Members (non-staff) get a fixed quick-access rail on desktop (I1). */}
        {!showRail && !isSuperAdmin && <ClientRail bellCount={unreadCount} dmCount={dmCount} presence={presence} />}
        {showRail && (
          /* I1B — width behaves like the old ClientRail: the <aside> RESERVES
             56px normally / 240-256px when PINNED (page sits beside it); the
             <nav> is sticky and grows to full width on HOVER, overlaying the
             page (no layout shift) when not pinned. */
          <aside
            onMouseEnter={() => setStaffRailHovered(true)}
            onMouseLeave={() => setStaffRailHovered(false)}
            className={`hidden lg:block shrink-0 relative z-30 transition-[width] duration-100 ease-out ${staffRailPinned ? 'w-60 xl:w-64' : 'w-14'}`}
          >
            <nav
              className={`p-3 sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto overflow-x-hidden border-r border-green-800/10 bg-cream-100/40 transition-[width] duration-100 ease-out ${staffRailOpen ? 'w-60 xl:w-64' : 'w-14'} ${staffRailHovered && !staffRailPinned ? 'shadow-[8px_0_24px_-12px_rgba(13,33,24,0.25)]' : ''}`}
            >
              {/* pin / collapse toggle — keeps the rail open when pinned */}
              <button type="button" onClick={() => setStaffRailPinned((v) => !v)}
                aria-label={staffRailPinned ? 'Collapse menu' : 'Keep menu open'} aria-pressed={staffRailPinned}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 mb-1 text-green-700 hover:bg-white focus-ring ${staffRailOpen ? '' : 'justify-center'}`}>
                {staffRailPinned ? <PanelLeftClose size={18} className="shrink-0" /> : <PanelLeft size={18} className="shrink-0" />}
                {staffRailOpen && <span className="text-[13.5px] font-sans text-secondary whitespace-nowrap">{staffRailPinned ? 'Collapse' : 'Keep open'}</span>}
              </button>
              {/* The static heading here used to read "Management", duplicating
                  the Management GROUP below it — two identical labels in one nav.
                  Platform still gets one because it is the super-admin's only
                  section; a tenant's rail is self-describing. */}
              {isSuperAdmin && staffRailOpen && (
                <p className="px-3 pt-1 pb-2 text-[10px] tracking-widest uppercase text-muted font-semibold">
                  Platform
                </p>
              )}
              {!isSuperAdmin && (
                <div className="mb-1 flex flex-col gap-0.5">
                  <CommunityNav open={staffRailOpen} indentClass="pl-9" />
                  <RailLink to="/app/dashboard" label="Dashboard" icon={HomeIcon} badge={unreadCount} open={staffRailOpen} />
                  <RailLink to="/app/calendar" label="Calendar" icon={CalendarDays} open={staffRailOpen} />
                </div>
              )}
              <div className="flex flex-col gap-1">
                {navGroups.map((g) => (
                  <div key={g.key}>
                    {navGroups.length > 1 && staffRailOpen && (
                      <button type="button" onClick={() => toggleGroup(g.key)}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] tracking-widest uppercase text-muted font-semibold hover:text-green-800 focus-ring rounded-md">
                        {g.label}
                        <ChevronDown size={12} className={`transition-transform ${groupOpen(g) ? '' : '-rotate-90'}`} />
                      </button>
                    )}
                    {/* collapsed strip: group headings shrink to a plain separator */}
                    {navGroups.length > 1 && !staffRailOpen && (
                      <div className="my-1 border-t border-green-800/10" role="separator" aria-label={g.label} />
                    )}
                    {(navGroups.length === 1 || groupOpen(g) || !staffRailOpen) && (
                      <div className="flex flex-col gap-0.5">
                        {g.items.map((it) => <RailLink key={it.to} {...it} open={staffRailOpen} />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </nav>
          </aside>
        )}
        <main className="flex-1 min-w-0 px-4 sm:px-8 xl:px-12 py-6 sm:py-9 pb-24">
          <Outlet />
        </main>
      </div>

      {/* MOBILE NAV DRAWER — the left side menu as an overlay panel. Members get
          the same quick-access set as the desktop rail (Community Feed + views,
          Dashboard, Calendar, Catalog, Messages, Account); staff get their
          grouped management nav. A click on any link inside closes it. */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-green-950/50" onClick={closeMobileNav} aria-hidden="true" />
          <nav
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-cream-100 shadow-xl p-3 overflow-y-auto"
            onClick={(e) => {
              // any real navigation inside closes the drawer
              if ((e.target as HTMLElement).closest('a')) closeMobileNav();
            }}
          >
            {/* I3 — "Close" (text first, icon after), a larger hit target, and the
                same darker-panel-shade (I4's cream-200) treatment marking the open
                menu as the active state. More bottom padding so it clears the
                first nav item below (was mb-2 — the highlighted Community button
                sat right under it). */}
            <div className="flex items-center justify-between px-1 pt-1 pb-4">
              <span className="text-[10px] tracking-widest uppercase text-muted font-semibold">Menu</span>
              <button type="button" onClick={closeMobileNav} aria-label="Close menu"
                className="flex items-center gap-1.5 pl-3 pr-3 py-2.5 rounded-lg bg-cream-200 text-green-800 font-medium text-[13px] font-sans hover:bg-cream-200/70 focus-ring">
                Close <PanelLeftClose size={16} aria-hidden="true" />
              </button>
            </div>
            {!isSuperAdmin && (
              <div className="flex flex-col gap-0.5 mb-1">
                <CommunityNav onNavigate={closeMobileNav} indentClass="pl-9" />
                {!showRail ? (
                  <>
                    {QUICK.map((q) => {
                      const raw = q.badge === 'notifications' ? unreadCount : q.badge === 'messages' ? dmCount : 0;
                      return <RailLink key={q.to} to={q.to} label={q.label} icon={q.icon} end={q.end} badge={raw > 0 ? raw : 0} />;
                    })}
                    <RailLink to="/app/account" label="Account" icon={UserRound} />
                    {navLinks.map((l) => <PresenceLink key={l.key} to={l.to} label={l.label} icon={l.icon} section={l.section} onNavigate={closeMobileNav} />)}
                  </>
                ) : (
                  <>
                    <RailLink to="/app/dashboard" label="Dashboard" icon={HomeIcon} badge={unreadCount} />
                    <RailLink to="/app/calendar" label="Calendar" icon={CalendarDays} />
                  </>
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
          </nav>
        </div>
      )}

      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} />}

      {/* A3: the tour. Auto-opened on first login (stamps the marker on
          dismiss) or re-opened from the avatar menu (leaves the marker be). */}
      <AppOverviewModal
        open={tourOpen}
        onClose={() => closeTour(tourSeen === false)}
        categories={tourCategories}
      />
    </div>
  );
}
