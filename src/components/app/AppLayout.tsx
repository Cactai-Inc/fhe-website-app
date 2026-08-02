import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { FEED_VIEWS, FEED_VIEW_META, type FeedView } from '../../lib/seed';
import { dmUnreadTotal } from '../../lib/community';
import {
  CalendarDays, Users, FileText, UserRound, ReceiptText, Shield, LogOut,
  GraduationCap, Home as HomeIcon, Boxes, Contact, LayoutDashboard,
  Mail, ChevronDown, Plus, LifeBuoy, ShoppingBag, MessageSquare, BookOpen, ListChecks,
  PanelLeft, PanelLeftClose, Activity, Compass,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useViewSurfaces } from '../../lib/surfaces';
import { fetchMyGrantKeys } from '../../lib/grants';
import {
  myUnreadCount, myWallState, getMyProfile, markTourSeen, fetchMyCategories,
  currentTourFormFactor,
  type WallState, type StandingCategory,
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

function RailLink({ to, label, icon: Icon, end, badge = 0 }: NavItem & { badge?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-sans transition-colors focus-ring ${
          isActive ? 'bg-green-800 text-white' : 'text-secondary hover:bg-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={17} aria-hidden="true" className={isActive ? 'text-gold-400' : 'text-green-600'} />
          <span className="flex-1">{label}</span>
          {badge > 0 && (
            <span className={`min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gold-600 text-white'}`}>{badge > 9 ? '9+' : badge}</span>
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
          isActive ? 'bg-green-800 text-white' : 'text-secondary hover:bg-green-800/[0.06]'
        }`
      }
    >
      <Icon size={17} aria-hidden="true" />
      {label}
    </NavLink>
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
  const onFeed = active !== null;
  // The parent IS the "All" view: it's highlighted (solid) on the full feed, and a
  // specific-filter sublink owns the highlight when one is selected. No "All posts"
  // sublink — clicking "Community Feed" (or the browser Back) returns to the full view.
  const isAll = active === 'all';
  // collapse state for the sublinks (persisted, chevron-controlled). Default expanded.
  const [expanded, setExpanded] = useState(() => localStorage.getItem('communityNav.expanded') !== '0');
  useEffect(() => { localStorage.setItem('communityNav.expanded', expanded ? '1' : '0'); }, [expanded]);

  if (!open) {
    // collapsed rail strip: just the parent icon, active whenever on the feed
    return (
      <Link to="/app" onClick={onNavigate} title="Community Feed"
        className={`flex items-center justify-center rounded-lg px-3 py-2.5 focus-ring ${onFeed ? 'bg-green-800 text-white' : 'text-secondary hover:bg-white'}`}>
        <Users size={18} className={onFeed ? 'text-gold-400' : 'text-green-600'} />
      </Link>
    );
  }

  return (
    <div>
      {/* parent row — the label links to the full feed (= All) and highlights when
          it's the active view; the chevron toggles the sublinks. */}
      <div className={`flex items-center rounded-lg pr-1 ${isAll ? 'bg-green-800' : 'hover:bg-white'}`}>
        <Link to="/app" onClick={onNavigate}
          className={`flex items-center gap-3 flex-1 min-w-0 px-3 py-2.5 text-[13.5px] font-sans focus-ring rounded-lg ${isAll ? 'text-white font-medium' : 'text-secondary'}`}>
          <Users size={18} className={`shrink-0 ${isAll ? 'text-gold-400' : 'text-green-600'}`} />
          <span className="whitespace-nowrap">Community Feed</span>
        </Link>
        <button type="button" onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse community views' : 'Expand community views'}
          aria-expanded={expanded}
          className={`shrink-0 p-1.5 rounded-md focus-ring ${isAll ? 'text-white/90 hover:bg-white/15' : 'text-green-700 hover:bg-green-800/[0.06]'}`}>
          <ChevronDown size={15} className={`transition-transform ${expanded ? '' : '-rotate-90'}`} />
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
                  isActive ? 'bg-green-800 text-white font-medium' : 'text-secondary hover:bg-white'}`}>
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

/** CLIENT LEFT RAIL (desktop only) — a thin icon strip that expands on hover with
 *  almost no delay, and a pin/toggle that keeps it open. Holds the same quick-access
 *  destinations the avatar menu carries. Members only (staff get the management rail).
 */
function ClientRail({ bellCount, dmCount }: { bellCount: number; dmCount: number }) {
  const [pinned, setPinned] = useState(() => localStorage.getItem('clientRail.pinned') === '1');
  const [hovered, setHovered] = useState(false);
  useEffect(() => { localStorage.setItem('clientRail.pinned', pinned ? '1' : '0'); }, [pinned]);
  const open = pinned || hovered;
  // D8: community access follows the ACCOUNT — every member sees the full
  // quick list and the community feed ("guest" is display copy only).
  const quick = QUICK;

  // The <aside> RESERVES the width: 56px normally, 240px when PINNED (page sits
  // beside it). The <nav> is sticky (scroll-follows) and grows to 240px on HOVER —
  // when not pinned it overflows its 56px aside to overlay the page, so hovering
  // causes no layout shift. z-30 keeps it above main, below the sticky header (z-40).
  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`hidden lg:block shrink-0 relative z-30 transition-[width] duration-100 ease-out ${pinned ? 'w-60' : 'w-14'}`}
    >
      <nav
        className={`sticky top-14 h-[calc(100dvh-3.5rem)] border-r border-green-800/10 bg-cream-100 p-2 overflow-y-auto overflow-x-hidden flex flex-col transition-[width] duration-100 ease-out ${open ? 'w-60' : 'w-14'} ${hovered && !pinned ? 'shadow-[8px_0_24px_-12px_rgba(13,33,24,0.25)]' : ''}`}
      >
        {/* pin / show toggle — keeps the rail open when pinned */}
        <button type="button" onClick={() => setPinned((v) => !v)}
          aria-label={pinned ? 'Collapse menu' : 'Keep menu open'} aria-pressed={pinned}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 mb-1 text-green-700 hover:bg-white focus-ring ${open ? '' : 'justify-center'}`}>
          {pinned ? <PanelLeftClose size={18} className="shrink-0" /> : <PanelLeft size={18} className="shrink-0" />}
          {open && <span className="text-[13.5px] font-sans text-secondary whitespace-nowrap">{pinned ? 'Collapse' : 'Keep open'}</span>}
        </button>

        <div className="flex flex-col gap-0.5">
          {/* Community Feed (position 1) with its views nested underneath. */}
          <CommunityNav open={open} indentClass={open ? 'pl-9' : 'pl-3'} />
          {quick.map((q) => {
            const raw = q.badge === 'notifications' ? bellCount : q.badge === 'messages' ? dmCount : 0;
            const badge = raw > 0 ? raw : 0;
            return (
              <NavLink key={q.label} to={q.to} end={q.end}
                className={({ isActive: active }) =>
                  `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-sans transition-colors focus-ring ${open ? '' : 'justify-center'} ${
                    active ? 'bg-green-800 text-white' : 'text-secondary hover:bg-white'}`}
                title={open ? undefined : q.label}>
                {({ isActive: active }) => (
                    <>
                      <span className="relative shrink-0">
                        <q.icon size={18} aria-hidden="true" className={active ? 'text-gold-400' : 'text-green-600'} />
                        {/* collapsed strip: badge dots the icon */}
                        {badge > 0 && !open && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[1rem] h-4 px-1 bg-gold-600 text-white text-[10px] leading-4 text-center rounded-full">{badge > 9 ? '9+' : badge}</span>
                        )}
                      </span>
                      {open && <span className="whitespace-nowrap flex-1">{q.label}</span>}
                      {/* expanded: badge sits at the end of the row */}
                      {badge > 0 && open && (
                        <span className={`min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full ${active ? 'bg-white/20 text-white' : 'bg-gold-600 text-white'}`}>{badge > 9 ? '9+' : badge}</span>
                      )}
                    </>
                )}
              </NavLink>
            );
          })}
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // Mobile left-nav drawer: the side menu, opened by the in-content button that
  // sits at the top-left of EVERY app page (content area, not the header).
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
  const navGroups = showRail ? manageNavGroups(hasModule, isAdmin, isSuperAdmin, grantKeys) : [];
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
        {/* Members (non-staff) get a collapsible quick-access rail on desktop. */}
        {!showRail && !isSuperAdmin && <ClientRail bellCount={unreadCount} dmCount={dmCount} />}
        {showRail && (
          <aside className="hidden lg:block w-60 xl:w-64 shrink-0 border-r border-green-800/10 bg-cream-100/40">
            <nav className="p-3 sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto">
              {/* The static heading here used to read "Management", duplicating
                  the Management GROUP below it — two identical labels in one nav.
                  Platform still gets one because it is the super-admin's only
                  section; a tenant's rail is self-describing. */}
              {isSuperAdmin && (
                <p className="px-3 pt-1 pb-2 text-[10px] tracking-widest uppercase text-muted font-semibold">
                  Platform
                </p>
              )}
              {!isSuperAdmin && (
                <div className="mb-1 flex flex-col gap-0.5">
                  <CommunityNav indentClass="pl-9" />
                  <RailLink to="/app/dashboard" label="Dashboard" icon={HomeIcon} badge={unreadCount} />
                  <RailLink to="/app/calendar" label="Calendar" icon={CalendarDays} />
                </div>
              )}
              <div className="flex flex-col gap-1">
                {navGroups.map((g) => (
                  <div key={g.key}>
                    {navGroups.length > 1 && (
                      <button type="button" onClick={() => toggleGroup(g.key)}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] tracking-widest uppercase text-muted font-semibold hover:text-green-800 focus-ring rounded-md">
                        {g.label}
                        <ChevronDown size={12} className={`transition-transform ${groupOpen(g) ? '' : '-rotate-90'}`} />
                      </button>
                    )}
                    {(navGroups.length === 1 || groupOpen(g)) && (
                      <div className="flex flex-col gap-0.5">
                        {g.items.map((it) => <RailLink key={it.to} {...it} />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </nav>
          </aside>
        )}
        <main className="flex-1 min-w-0 px-4 sm:px-8 xl:px-12 py-6 sm:py-9 pb-24">
          {/* MOBILE NAV BUTTON — opens the left side menu. Owner spec: in the
              CONTENT AREA (not the header), near the top-left, the SAME spot on
              every page. It renders IN FLOW as the first element of <main>, so
              page content starts below it — it can never obstruct nor be
              obstructed, on any page. Desktop (lg+) has the rail instead. */}
          <div className="lg:hidden mb-4">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              className="inline-flex items-center gap-2 px-3 h-10 rounded-lg border border-green-800/15 bg-white text-green-800 shadow-sm hover:bg-cream-100 focus-ring"
            >
              <PanelLeft size={18} aria-hidden="true" />
              <span className="text-[13px] font-sans">Menu</span>
            </button>
          </div>
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
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[10px] tracking-widest uppercase text-muted font-semibold">Menu</span>
              <button type="button" onClick={closeMobileNav} aria-label="Close menu"
                className="p-2 rounded-lg text-green-800 hover:bg-white focus-ring">
                <PanelLeftClose size={18} />
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
