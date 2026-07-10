import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays, Users, FileText, UserRound, ReceiptText, Shield, LogOut,
  GraduationCap, Handshake, Home as HomeIcon, Boxes, Contact, LayoutDashboard,
  Mail, ChevronDown, Plus, LifeBuoy, ShoppingBag, MessageSquare, BookOpen,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useViewSurfaces } from '../../lib/surfaces';
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

const QUICK: { label: string; icon: typeof GraduationCap }[] = [
  { label: 'Book a lesson', icon: GraduationCap },
  { label: 'Shop for sale', icon: ShoppingBag },
  { label: 'New message', icon: MessageSquare },
];

export const MANAGE_NAV: NavItem[] = [
  { to: '/app', label: 'Main', icon: HomeIcon, end: true },
  { to: '/app/ops/intake', label: 'Intake', icon: Mail },
  { to: '/app/ops/availability', label: 'Availability', icon: CalendarDays },
  { to: '/app/ops/contacts', label: 'Contacts', icon: Contact },
  { to: '/app/ops/horses', label: 'Horses', icon: Boxes },
  { to: '/app/ops/engagements', label: 'Engagements', icon: Handshake },
  { to: '/app/ops/documents', label: 'Documents', icon: FileText },
  { to: '/app/ops/lessons', label: 'Lessons', icon: GraduationCap, module: 'mod.lessons' },
  { to: '/app/ops/transactions', label: 'Transactions', icon: ReceiptText, adminOnly: true },
  { to: '/app/ops/payments/review', label: 'Payment review', icon: ReceiptText, adminOnly: true },
  { to: '/app/ops/billing', label: 'Billing', icon: ReceiptText, adminOnly: true },
  { to: '/app/ops/moderation', label: 'Moderation', icon: Shield, adminOnly: true },
  { to: '/app/ops/support', label: 'Support', icon: LifeBuoy, adminOnly: true },
  { to: '/app/ops/oversight', label: 'Oversight', icon: Shield, adminOnly: true },
  { to: '/app/ops/content', label: 'Content store', icon: BookOpen, adminOnly: true },
  { to: '/app/admin', label: 'Accounts', icon: Users, adminOnly: true },
  { to: '/app/ops/brokerage', label: 'Brokerage', icon: Handshake, module: 'mod.brokerage', adminOnly: true },
  { to: '/app/ops/boarding', label: 'Boarding', icon: HomeIcon, module: 'mod.boarding', adminOnly: true },
  { to: '/app/ops/barnops', label: 'Barn Ops', icon: Boxes, module: 'mod.barnops', adminOnly: true },
  { to: '/app/ops/records', label: 'Records', icon: FileText, module: 'mod.horserecords', adminOnly: true },
  { to: '/app/ops/employees', label: 'Employees', icon: Contact, module: 'mod.employees', adminOnly: true },
  { to: '/app/ops/admin/modules', label: 'Feature flags', icon: Shield, superAdmin: true },
  { to: '/app/ops/admin/registry', label: 'Registry', icon: Shield, superAdmin: true },
  { to: '/app/ops/superadmin/organizations', label: 'Organizations', icon: Shield, superAdmin: true },
  { to: '/app/ops/superadmin/provision', label: 'Provision tenant', icon: Shield, superAdmin: true },
];

export function visibleManageNav(
  hasModule: (key: string) => boolean,
  isAdmin: boolean,
  isSuperAdmin: boolean,
): NavItem[] {
  return MANAGE_NAV.filter(
    (item) =>
      (!item.module || hasModule(item.module)) &&
      (!item.adminOnly || isAdmin) &&
      (!item.superAdmin || isSuperAdmin),
  );
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
  const manageItems = showRail ? visibleManageNav(hasModule, isAdmin, isSuperAdmin) : [];

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
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <Link to="/app" className="flex items-center gap-2.5" aria-label="French Heritage — home">
            <span className="w-[34px] h-[34px] rounded-lg bg-green-800 text-gold-400 grid place-items-center font-display text-lg font-semibold shrink-0">F</span>
            <span className="hidden sm:inline font-display text-green-800 text-lg uppercase tracking-wide">French Heritage</span>
          </Link>
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
                <div className="absolute right-0 mt-1 w-60 max-w-[calc(100vw-2rem)] bg-white border border-green-800/10 shadow-md rounded-md py-1 max-h-[80vh] overflow-y-auto z-50">
                  <p className="px-4 py-2 text-xs text-muted border-b border-green-800/10 truncate">{name}</p>
                  <MenuLink to="/app" label="Main" icon={HomeIcon} end onNavigate={closeMenu} />
                  <MenuLink to="/app/account" label="Account" icon={UserRound} onNavigate={closeMenu} />
                  <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">Quick access</div>
                  {QUICK.map((q) => (
                    <button key={q.label} type="button" onClick={closeMenu}
                      className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary hover:bg-green-800/[0.06] focus-ring">
                      <q.icon size={17} /> {q.label}
                    </button>
                  ))}
                  {manageItems.length > 0 && (
                    <div className="lg:hidden">
                      <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">
                        {isAdmin ? 'Management' : 'Servicing'}
                      </div>
                      {manageItems.filter((i) => i.to !== '/app').map((it) => <MenuLink key={it.to} {...it} onNavigate={closeMenu} />)}
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

      <div className="max-w-6xl mx-auto flex">
        {showRail && (
          <aside className="hidden lg:block w-56 shrink-0 border-r border-green-800/10 bg-cream-100/40 min-h-[calc(100vh-3.5rem)]">
            <nav className="p-3 sticky top-14">
              <p className="px-3 pt-1 pb-2 text-[10px] tracking-widest uppercase text-muted font-semibold">
                {isAdmin ? 'Management' : 'Servicing'}
              </p>
              <div className="flex flex-col gap-0.5">
                {manageItems.map((it) => <RailLink key={it.to} {...it} />)}
              </div>
            </nav>
          </aside>
        )}
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 sm:py-9">
          <Outlet />
        </main>
      </div>

      {calOpen && <CalendarModal onClose={() => setCalOpen(false)} />}
      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
