import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays, Users, BookOpen, FileText, UserRound,
  ReceiptText, Shield, LogOut, GraduationCap, Handshake, Home as HomeIcon,
  Boxes, Contact, LayoutDashboard, Sparkles, BadgeCheck, Mail, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useViewSurfaces, type Surface, type ViewSurfaces } from '../../lib/surfaces';
import NotificationsBell, { useNotificationsBell } from './NotificationsBell';
import CalendarModal from './CalendarModal';

/**
 * APP SHELL (Slice 4 rebuild) — a single avatar menu, no persistent side nav.
 * Logo → Home. Top-right: calendar modal, notifications bell (count badge), and the
 * avatar menu (all navigation lives here). Surfaces are PURCHASE-DRIVEN: the menu
 * shows only the sections the member's purchases unlock (useViewSurfaces). A rider
 * sees feed/community/library/dashboard; a deal/care client sees their dashboard,
 * no feed/community. Operators get the ops menu appended. Mobile-first: the same
 * menu on every breakpoint, opened from the avatar.
 */

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  /** Surface this item requires (from the purchase-driven view model). */
  surface?: Surface;
  /** Tenant module gate (my_modules()), preserved from the entitlement layer. */
  module?: string;
}

// The member menu. Each item declares the surface it needs; items with no surface
// (Home, Profile) are always shown. Home routes to the feed for riders/operators and
// to the member's purpose-built dashboard otherwise (resolved at click via /app).
const MEMBER_NAV: NavItem[] = [
  { to: '/app', label: 'Home', icon: HomeIcon, end: true },
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, surface: 'dashboard' },
  { to: '/app/deal', label: 'My Deal', icon: Handshake, surface: 'deal_dashboard' },
  { to: '/app/care', label: 'Horse Care', icon: Sparkles, surface: 'care_dashboard' },
  { to: '/app/schedule', label: 'Schedule', icon: CalendarDays, surface: 'dashboard' },
  { to: '/app/lessons', label: 'Lessons', icon: GraduationCap, module: 'mod.lessons', surface: 'dashboard' },
  { to: '/app/community', label: 'Community', icon: Users, surface: 'community' },
  { to: '/app/messages', label: 'Messages', icon: Mail },
  { to: '/app/library', label: 'Library', icon: BookOpen, surface: 'library' },
  { to: '/app/documents', label: 'Documents', icon: FileText, surface: 'documents' },
  { to: '/app/orders', label: 'Orders', icon: ReceiptText, surface: 'orders' },
  { to: '/app/engagements', label: 'My Engagements', icon: Handshake },
  { to: '/app/balance', label: 'Balance', icon: ReceiptText },
  { to: '/app/membership', label: 'Membership', icon: BadgeCheck },
  { to: '/app/profile', label: 'Profile', icon: UserRound },
];

/** Items the member actually sees: an item shows when its surface is present (or it
 *  has no surface gate) AND its module (if any) is enabled. Pure/unit-testable. */
export function visibleNav(
  surfaces: ViewSurfaces,
  hasModule: (key: string) => boolean,
): NavItem[] {
  return MEMBER_NAV.filter(
    (item) =>
      (!item.surface || surfaces.surfaces.includes(item.surface)) &&
      (!item.module || hasModule(item.module)),
  );
}

/** Staff/admin operations nav (unchanged entitlement gating from the ops layer). */
export const OPS_NAV: NavItem[] = [
  { to: '/app/ops', label: 'Ops Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/ops/intake', label: 'Intake', icon: Mail },
  { to: '/app/ops/availability', label: 'Availability', icon: CalendarDays },
  { to: '/app/ops/contacts', label: 'Contacts', icon: Contact },
  { to: '/app/ops/horses', label: 'Horses', icon: Boxes },
  { to: '/app/ops/engagements', label: 'Engagements', icon: Handshake },
  { to: '/app/ops/documents', label: 'Documents', icon: FileText },
  { to: '/app/ops/transactions', label: 'Transactions', icon: ReceiptText },
  { to: '/app/ops/payments/review', label: 'Payment review', icon: ReceiptText },
  { to: '/app/ops/moderation', label: 'Moderation', icon: Shield },
  { to: '/app/ops/brokerage', label: 'Brokerage', icon: Handshake, module: 'mod.brokerage' },
  { to: '/app/ops/lessons', label: 'Lessons', icon: GraduationCap, module: 'mod.lessons' },
  { to: '/app/ops/boarding', label: 'Boarding', icon: HomeIcon, module: 'mod.boarding' },
  { to: '/app/ops/barnops', label: 'Barn Ops', icon: Boxes, module: 'mod.barnops' },
  { to: '/app/ops/records', label: 'Records', icon: FileText, module: 'mod.horserecords' },
  { to: '/app/ops/employees', label: 'Employees', icon: Contact, module: 'mod.employees' },
  { to: '/app/ops/admin/modules', label: 'Modules', icon: Shield },
  { to: '/app/ops/admin/registry', label: 'Registry', icon: Shield },
  { to: '/app/ops/admin/branding', label: 'Branding', icon: Shield },
  { to: '/app/ops/admin/products', label: 'Products', icon: Shield },
  { to: '/app/ops/superadmin/organizations', label: 'Organizations', icon: Shield, superAdmin: true } as NavItem & { superAdmin?: boolean },
  { to: '/app/ops/superadmin/provision', label: 'Provision tenant', icon: Shield, superAdmin: true } as NavItem & { superAdmin?: boolean },
];

/** The ops nav a staff session actually sees (pure, unit-testable). */
export function visibleOpsNav(hasModule: (key: string) => boolean, isSuperAdmin = false): NavItem[] {
  return OPS_NAV.filter((item) => {
    const sa = (item as NavItem & { superAdmin?: boolean }).superAdmin;
    return (!item.module || hasModule(item.module)) && (!sa || isSuperAdmin);
  });
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
  const { profile, isAdmin, isSuperAdmin, hasModule, signOut } = useAuth();
  const { surfaces } = useViewSurfaces();
  const navigate = useNavigate();
  const bell = useNotificationsBell();
  const [menuOpen, setMenuOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const name = profile?.display_name || profile?.first_name || 'Member';
  const initial = (name[0] || 'M').toUpperCase();
  const items = visibleNav(surfaces, hasModule);
  const opsItems = isAdmin ? visibleOpsNav(hasModule, isSuperAdmin) : [];

  // close the avatar menu on outside click / Escape
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
      {/* Top bar — logo left, calendar + bell + avatar right (every breakpoint) */}
      <header className="sticky top-0 z-40 bg-white border-b border-green-800/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <Link to="/app" className="font-display text-green-800 text-lg uppercase tracking-wide">
            French Heritage
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCalOpen(true)}
              className="p-2 text-green-800 focus-ring rounded-md hover:bg-green-800/[0.06]"
              aria-label="Calendar"
            >
              <CalendarDays size={18} />
            </button>
            <NotificationsBell bell={bell} />
            {/* Avatar menu — the single navigation entry point */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full hover:bg-green-800/[0.06] focus-ring"
                aria-label="Account menu"
                aria-expanded={menuOpen}
              >
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
                <div className="absolute right-0 mt-1 w-60 max-w-[calc(100vw-2rem)] bg-white border border-green-800/10 shadow-md rounded-md py-1 max-h-[80vh] overflow-y-auto z-50">
                  <p className="px-4 py-2 text-xs text-muted border-b border-green-800/10 truncate">{name}</p>
                  {items.map((it) => <MenuLink key={it.to} {...it} onNavigate={closeMenu} />)}
                  {opsItems.length > 0 && (
                    <>
                      <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">
                        Operations
                      </div>
                      <MenuLink to="/app/admin" label="Admin" icon={Shield} onNavigate={closeMenu} />
                      {opsItems.map((it) => <MenuLink key={it.to} {...it} onNavigate={closeMenu} />)}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-4 py-2.5 mt-1 w-full text-sm font-sans text-secondary hover:bg-green-800/[0.06] border-t border-green-800/10 focus-ring"
                  >
                    <LogOut size={17} aria-hidden="true" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 min-w-0">
        <Outlet />
      </main>

      {calOpen && <CalendarModal onClose={() => setCalOpen(false)} />}
    </div>
  );
}
