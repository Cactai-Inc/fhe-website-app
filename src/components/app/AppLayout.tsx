import { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, MessagesSquare, Hash, Users, BookOpen,
  FileText, UserRound, BadgeCheck, ReceiptText, Shield, LogOut, Menu, X, Mail,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/schedule', label: 'Schedule', icon: CalendarDays },
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

export default function AppLayout() {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const name = profile?.display_name || profile?.first_name || 'Member';

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const navLinks = (
    <nav className="flex flex-col gap-1" aria-label="Member area">
      {NAV.map(({ to, label, icon: Icon, end }) => (
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
