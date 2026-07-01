import { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, MessagesSquare, Hash, Users, BookOpen,
  FileText, UserRound, BadgeCheck, ReceiptText, Shield, LogOut, Menu, X, Mail,
  GraduationCap, Handshake, Home, Boxes, Contact,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  /** Show only when the tenant has this module enabled (my_modules()). */
  module?: string;
}

// Core community items are always on; the module-tagged items appear only when the
// tenant's my_modules() set (surfaced through AuthContext.hasModule) includes the
// key. FHE (tier.lesson_brokerage) → lessons + brokerage show; boarding / barnops /
// employees hide (PLATFORM_ARCHITECTURE §4.3 Layer C; the U15 acceptance criterion).
const NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/app/lessons', label: 'Lessons', icon: GraduationCap, module: 'mod.lessons' },
  { to: '/app/brokerage', label: 'Brokerage', icon: Handshake, module: 'mod.brokerage' },
  { to: '/app/boarding', label: 'Boarding', icon: Home, module: 'mod.boarding' },
  { to: '/app/barnops', label: 'Barn Ops', icon: Boxes, module: 'mod.barnops' },
  { to: '/app/employees', label: 'Employees', icon: Contact, module: 'mod.employees' },
  { to: '/app/chat', label: 'Chat board', icon: Hash },
  { to: '/app/threads', label: 'Threads', icon: MessagesSquare },
  { to: '/app/messages', label: 'Messages', icon: Mail },
  { to: '/app/members', label: 'Members', icon: Users },
  { to: '/app/content', label: 'Content', icon: BookOpen },
  { to: '/app/documents', label: 'Documents', icon: FileText },
  { to: '/app/orders', label: 'Orders', icon: ReceiptText },
  { to: '/app/membership', label: 'Membership', icon: BadgeCheck },
  { to: '/app/profile', label: 'Profile', icon: UserRound },
];

/** The nav the member actually sees: core items plus the module-gated items whose
 *  module their tenant has. Pure of side effects so it is unit-testable. */
export function visibleNav(hasModule: (key: string) => boolean): NavItem[] {
  return NAV.filter((item) => !item.module || hasModule(item.module));
}

export default function AppLayout() {
  const { profile, isAdmin, hasModule, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = visibleNav(hasModule);
  const name = profile?.display_name || profile?.first_name || 'Member';

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const navLinks = (
    <nav className="flex flex-col gap-1" aria-label="Member area">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 text-sm font-sans rounded-md transition-colors focus-ring ${
              isActive ? 'bg-green-800 text-white' : 'text-secondary hover:bg-green-800/[0.06]'
            }`
          }
        >
          <Icon size={17} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink
          to="/app/admin"
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 text-sm font-sans rounded-md transition-colors focus-ring mt-2 border-t border-green-800/10 pt-4 ${
              isActive ? 'bg-gold-800 text-white' : 'text-gold-ink hover:bg-gold-800/[0.06]'
            }`
          }
        >
          <Shield size={17} aria-hidden="true" />
          Admin
        </NavLink>
      )}
      {isAdmin && (
        <>
          <div className="mt-2 border-t border-green-800/10 pt-3 px-3 pb-1 text-xs uppercase tracking-wide text-secondary/60">
            Operations
          </div>
          {[
            { to: '/app/ops', label: 'Ops Dashboard', icon: LayoutDashboard, end: true },
            { to: '/app/ops/contacts', label: 'Contacts', icon: Contact },
            { to: '/app/ops/horses', label: 'Horses', icon: Boxes },
            { to: '/app/ops/engagements', label: 'Engagements', icon: Handshake },
            { to: '/app/ops/documents', label: 'Documents', icon: FileText },
            { to: '/app/ops/transactions', label: 'Transactions', icon: ReceiptText },
          ].map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm font-sans rounded-md transition-colors focus-ring ${
                  isActive ? 'bg-green-800 text-white' : 'text-secondary hover:bg-green-800/[0.06]'
                }`
              }
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-cream">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-green-800/10 flex items-center justify-between px-4 h-14">
        <Link to="/app" className="font-display text-green-800 text-lg uppercase tracking-wide">FHE</Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="p-2.5 -mr-2 text-green-800 focus-ring"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 min-h-screen border-r border-green-800/10 bg-white px-4 py-6 sticky top-0">
          <Link to="/app" className="px-3 mb-8 block">
            <span className="font-display text-green-800 text-xl uppercase tracking-wide">French Heritage</span>
            <span className="block text-gold-ink text-[10px] tracking-widest uppercase">Members</span>
          </Link>
          {navLinks}
          <div className="mt-auto pt-6 border-t border-green-800/10">
            <p className="px-3 text-xs text-muted mb-2 truncate">{name}</p>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-sans text-secondary hover:text-green-800 w-full focus-ring rounded-md"
            >
              <LogOut size={17} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="lg:hidden fixed inset-0 z-40 bg-white pt-14 px-4 py-6 overflow-y-auto">
            {navLinks}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 mt-6 text-sm font-sans text-secondary w-full focus-ring rounded-md border-t border-green-800/10"
            >
              <LogOut size={17} aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 px-5 sm:px-8 lg:px-12 py-8 lg:py-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
