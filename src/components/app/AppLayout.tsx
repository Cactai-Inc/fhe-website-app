import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays, Users, FileText, UserRound, ReceiptText, Shield, LogOut,
  GraduationCap, Handshake, Home as HomeIcon, Boxes, Contact, LayoutDashboard,
  Mail, ChevronDown, Plus, LifeBuoy, ShoppingBag, MessageSquare, BookOpen,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useViewSurfaces } from '../../lib/surfaces';
import { fetchMyGrantKeys } from '../../lib/grants';
import { useNotificationsBell } from './NotificationsBell';
import CalendarModal from './CalendarModal';
import { CreateModal } from './CreateModal';

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

const QUICK: { label: string; icon: typeof GraduationCap; to: string }[] = [
  { label: 'Book a lesson', icon: GraduationCap, to: '/app/book' },
  { label: 'Shop for sale', icon: ShoppingBag, to: '/app?filter=for_sale' },
  { label: 'New message', icon: MessageSquare, to: '/app/messages' },
];

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

/* FRONT DESK — everything inbound that needs handling and moving to a point of
 * resolution or matriculation (client and non-client alike): booking requests,
 * form submissions, support. First section — dealing with what came in is the
 * primary job. */
const FRONTDESK_GROUP: NavItem[] = [
  { to: '/app/ops/intake', label: 'Inbound', icon: Mail },
  { to: '/app/ops/leads', label: 'Leads', icon: Contact },
  { to: '/app/ops/support', label: 'Support', icon: LifeBuoy },
];
/* ACCOUNTS — who we know: customers (Clients), internal accounts (Team), and
 * the raw contact book behind both. */
const ACCOUNTS_GROUP: NavItem[] = [
  { to: '/app/admin', label: 'Clients', icon: Users },
  { to: '/app/ops/team', label: 'Team', icon: Contact },
  { to: '/app/ops/contacts', label: 'Directory', icon: Contact },
];
const SERVICING_GROUP: NavItem[] = [
  { to: '/app/ops/lessons', label: 'Lessons', icon: GraduationCap, module: 'mod.lessons' },
  { to: '/app/ops/availability', label: 'Availability', icon: CalendarDays },
  { to: '/app/ops/horse-records', label: 'Horses', icon: Boxes },
  { to: '/app/ops/documents', label: 'Documents', icon: FileText },
];
const BUSINESS_GROUP: NavItem[] = [
  { to: '/app/ops/payments/review', label: 'Payment review', icon: ReceiptText },
];
const COMMUNITY_GROUP: NavItem[] = [
  { to: '/app/ops/moderation', label: 'Moderation', icon: Shield },
  { to: '/app/ops/content', label: 'Content store', icon: BookOpen },
  { to: '/app/ops/oversight', label: 'Oversight', icon: Shield },
];
const MODULES_GROUP: NavItem[] = [
  { to: '/app/ops/brokerage', label: 'Brokerage', icon: Handshake, module: 'mod.brokerage' },
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
  ...FRONTDESK_GROUP, ...ACCOUNTS_GROUP, ...SERVICING_GROUP, ...BUSINESS_GROUP,
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
    { key: 'frontdesk', label: 'Front desk', items: visible(FRONTDESK_GROUP), defaultOpen: true },
    { key: 'accounts', label: 'Accounts', items: visible(ACCOUNTS_GROUP), defaultOpen: true },
    { key: 'servicing', label: 'Servicing', items: visible(SERVICING_GROUP), defaultOpen: true },
    { key: 'business', label: 'Business', items: visible(BUSINESS_GROUP) },
    { key: 'community', label: 'Community', items: visible(COMMUNITY_GROUP) },
    { key: 'modules', label: 'Modules', items: visible(MODULES_GROUP) },
    { key: 'settings', label: 'Settings', items: visible(SETTINGS_GROUP) },
  ];
  return groups.filter((g) => g.items.length > 0);
}

function RailLink({ to, label, icon: Icon, end }: NavItem) {
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
          {label}
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

export default function AppLayout() {
  const { profile, isAdmin, isStaff, isSuperAdmin, hasModule, signOut } = useAuth();
  useViewSurfaces();
  const navigate = useNavigate();
  const bell = useNotificationsBell();
  const [menuOpen, setMenuOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const name = profile?.display_name || profile?.first_name || 'Member';
  const initial = (name[0] || 'M').toUpperCase();

  const showRail = isStaff;
  const isTrainer = isStaff && !isAdmin;
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

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate('/');
  }
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen bg-cream">
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
            <button type="button" onClick={() => setCalOpen(true)}
              className="p-2 text-green-800 rounded-lg hover:bg-cream-100 focus-ring" aria-label="Calendar">
              <CalendarDays size={18} />
            </button>
            <div className="relative" ref={menuRef}>
              <button type="button" onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full hover:bg-green-800/[0.06] focus-ring"
                aria-label="Account menu" aria-expanded={menuOpen}>
                <span className="relative w-8 h-8 rounded-full bg-green-800 text-white text-sm font-sans grid place-items-center">
                  {initial}
                  {bell.count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 bg-gold-600 text-white text-[10px] leading-4 text-center rounded-full">
                      {bell.count > 9 ? '9+' : bell.count}
                    </span>
                  )}
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
                    </>
                  )}
                  {/* client quick links — an admin's menu carries company work, not shopper shortcuts */}
                  {!isAdmin && !isSuperAdmin && (
                    <>
                      <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">Quick access</div>
                      {QUICK.map((q) => (
                        <button key={q.label} type="button"
                          onClick={() => { closeMenu(); navigate(q.to); }}
                          className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary hover:bg-green-800/[0.06] focus-ring">
                          <q.icon size={17} /> {q.label}
                        </button>
                      ))}
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
        {showRail && (
          <aside className="hidden lg:block w-60 xl:w-64 shrink-0 border-r border-green-800/10 bg-cream-100/40">
            <nav className="p-3 sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto">
              <p className="px-3 pt-1 pb-2 text-[10px] tracking-widest uppercase text-muted font-semibold">
                {isSuperAdmin ? 'Platform' : isAdmin ? 'Management' : 'Servicing'}
              </p>
              {!isSuperAdmin && (
                <div className="mb-1"><RailLink to="/app" label="Dashboard" icon={HomeIcon} end /></div>
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
          <Outlet />
        </main>
      </div>

      {calOpen && <CalendarModal onClose={() => setCalOpen(false)} />}
      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
