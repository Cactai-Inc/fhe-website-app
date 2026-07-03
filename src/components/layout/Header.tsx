import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';

// Lean public nav. No sign-in here (invite-only — members reach it via the footer).
const NAV_LINKS = [
  { label: 'Our Story', href: '/about' },
  { label: 'Horse Care', href: '/horse' },
  { label: 'Acquisition', href: '/acquisition' },
];

export default function Header() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { itemCount } = useCart();
  const isHome = location.pathname === '/';
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => setOpen(false), [location]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // On home, header is transparent until scrolled; on other pages always solid
  const solid = !isHome || scrolled;

  const cartLink = (extraClass: string) =>
    itemCount > 0 && (
      <Link
        to="/checkout"
        className={`items-center gap-2 text-xs font-sans tracking-wide text-white/80 hover:text-white transition-colors focus-ring-dark ${extraClass}`}
        aria-label={`${itemCount} ${itemCount === 1 ? 'item' : 'items'} in your inquiry`}
      >
        <span className="relative">
          <ShoppingBag size={18} aria-hidden="true" />
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gold-600 text-green-900 text-[9px] flex items-center justify-center rounded-full font-medium">
            {itemCount}
          </span>
        </span>
      </Link>
    );

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        solid ? 'bg-green-800 shadow-lg shadow-green-900/20' : 'bg-transparent'
      }`}
    >
      <div className="container-site flex items-center justify-between h-16 sm:h-20">

        {/* Logo */}
        <Link
          to="/"
          className="flex flex-col items-start leading-none group focus-ring-dark"
          aria-label="French Heritage Equestrian — Home"
        >
          <span className="font-display text-white text-base sm:text-lg tracking-wide uppercase">
            French Heritage
          </span>
          <span className="text-gold-400 text-[10px] tracking-widest uppercase font-sans font-light">
            Equestrian
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-10" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              aria-current={location.pathname === link.href ? 'page' : undefined}
              className={`text-xs font-sans tracking-widest uppercase transition-colors duration-200 focus-ring-dark ${
                location.pathname === link.href ? 'text-gold-400' : 'text-white/80 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {cartLink('hidden sm:flex')}

          {/* Member entrance — appears only for signed-in members/staff */}
          {user && (
            <Link
              to="/app"
              className="hidden md:inline-flex text-xs font-sans tracking-widest uppercase text-gold-400 hover:text-gold-200 transition-colors focus-ring-dark"
            >
              Member Area
            </Link>
          )}

          {/* Secondary contact link */}
          <Link
            to="/contact"
            className="hidden md:inline-flex text-xs font-sans tracking-widest uppercase text-white/80 hover:text-white transition-colors focus-ring-dark"
          >
            Contact
          </Link>

          {/* Primary CTA — Book a Lesson is the lowest-bar entry point */}
          <Link
            to="/lessons"
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2 border border-gold-600/60 text-white text-xs font-sans tracking-widest uppercase transition-all duration-200 hover:bg-gold-600 hover:border-gold-600 hover:text-green-900 focus-ring-dark"
          >
            Book a Lesson
          </Link>

          {/* Mobile cart affordance */}
          {cartLink('flex sm:hidden')}

          {/* Mobile menu button */}
          <button
            ref={menuButtonRef}
            type="button"
            className="md:hidden text-white p-2.5 -mr-2 focus-ring-dark"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div id="mobile-menu" className="md:hidden bg-green-900 border-t border-white/10">
          <nav className="container-site py-6 flex flex-col gap-5" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm font-sans tracking-widest uppercase text-white/80 hover:text-white transition-colors focus-ring-dark"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/contact"
              className="text-sm font-sans tracking-widest uppercase text-white/80 hover:text-white transition-colors focus-ring-dark"
            >
              Contact
            </Link>
            <Link to="/lessons" className="mt-2 btn-ghost-white text-center justify-center">
              Book a Lesson
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
