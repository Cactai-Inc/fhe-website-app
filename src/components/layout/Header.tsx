import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';

/* The single site header — used on the landing AND every inner page.
 *
 * Behavior (owner spec):
 *  - NAKED (fully transparent, no background) by default, at the top of scroll,
 *    on the landing and on every inner page. Nav text is light with a subtle
 *    shadow so it reads over the full-bleed hero or any page top.
 *  - ON SCROLL: (a) MINIFY — header height drops ~33% (py-5→py-3, smaller logo);
 *    (b) a LIQUID-GLASS FROSTED backdrop descends to backstop the nav for
 *    contrast — backdrop-blur + a VERY slight green tint (a whisper of green in
 *    the glass, not a panel) + a hairline gold rule — animated in over ~400ms.
 *  - The nav is identical everywhere (same links on landing + inner pages).
 *
 * The landing is 100dvh/no-scroll, so there the header simply stays naked (it
 * never scrolls); the minify+frost triggers only on pages that actually scroll.
 * SSR-safe: the scroll listener only attaches in the browser (useEffect).
 */

// One nav, consistent everywhere. The rider funnel is reached via the big
// central CTA + Our Story, so the nav surfaces the OTHER offerings (no
// redundant "Ride With Us"), and adds the previously-missing horse services.
const NAV_LINKS = [
  { label: 'Our Story', href: '/story' },
  { label: 'Services for Horses', href: '/horse' },
  { label: 'Find a Horse', href: '/acquisition' },
  { label: 'Say Hello', href: '/contact' },
];

export default function Header() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { itemCount } = useCart();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    handler();
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

  // The saved-selection cart affordance. Always VISIBLE in the header once there
  // is a saved selection — top-right on desktop, CENTERED on mobile (never buried
  // in the hamburger, so the visitor always knows where their selection went).
  const cart = (extraClass: string) =>
    itemCount > 0 && (
      <Link
        to="/checkout"
        className={`inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors focus-ring-dark [text-shadow:0_1px_8px_rgba(0,0,0,0.4)] min-h-[44px] ${extraClass}`}
        aria-label={`${itemCount} saved ${itemCount === 1 ? 'selection' : 'selections'} — open your inquiry`}
      >
        <span className="relative">
          <ShoppingBag size={20} aria-hidden="true" />
          <span className="absolute -top-2 -right-2 w-4 h-4 bg-gold-600 text-green-900 text-[9px] flex items-center justify-center font-medium">
            {itemCount}
          </span>
        </span>
      </Link>
    );

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-[450ms] ease-out ${
        scrolled
          ? // Liquid-glass frost: a whisper of green tint under a blur, backstopped
            // by a hairline gold rule. NOT a solid green panel.
            'bg-green-900/10 backdrop-blur-md border-b border-gold-600/20 shadow-sm shadow-green-950/10'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div
        className={`container-site grid grid-cols-[auto_1fr_auto] items-center gap-2 transition-all duration-[450ms] ease-out ${
          scrolled ? 'py-3' : 'py-5 sm:py-7'
        }`}
      >
        {/* Wordmark (left) — shrinks slightly on scroll (part of the minify). */}
        <Link
          to="/"
          className="justify-self-start flex flex-col items-start leading-none group focus-ring-dark min-h-[44px] justify-center"
          aria-label="French Heritage Equestrian — Home"
        >
          <span
            className={`font-display text-white tracking-wide uppercase [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] transition-all duration-[450ms] ${
              scrolled ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
            }`}
          >
            French Heritage
          </span>
          <span className="text-gold-300 text-[10px] tracking-widest uppercase font-sans font-light">
            Equestrian
          </span>
        </Link>

        {/* Center — the cart, centered on MOBILE only (always visible, never in
            the hamburger). On desktop this slot is empty; the cart sits top-right. */}
        <div className="justify-self-center md:hidden">{cart('')}</div>

        {/* Right cluster — desktop nav + cart (top-right) + sign in; hamburger. */}
        <div className="justify-self-end flex items-center gap-6 lg:gap-9">
          <nav className="hidden md:flex items-center gap-8 lg:gap-10" aria-label="Primary">
            {NAV_LINKS.map((link) => {
              const current = location.pathname === link.href;
              return (
                <Link
                  key={link.label}
                  to={link.href}
                  aria-current={current ? 'page' : undefined}
                  className={`group relative inline-flex items-center min-h-[44px] text-xs font-sans tracking-widest uppercase transition-colors duration-200 focus-ring-dark [text-shadow:0_1px_8px_rgba(0,0,0,0.45)] ${
                    current ? 'text-gold-300' : 'text-white/85 hover:text-white'
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute left-0 -bottom-0.5 h-px bg-gold-300 transition-all duration-300 ${
                      current ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </nav>

          {/* Cart — top-right on desktop. */}
          {cart('hidden md:inline-flex')}

          {/* Member entrance — signed-in members only. */}
          {user && (
            <Link
              to="/app"
              className="hidden md:inline-flex text-[11px] font-sans tracking-widest uppercase text-gold-300 hover:text-gold-200 transition-colors focus-ring-dark [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]"
            >
              Member Area
            </Link>
          )}

          <Link
            to="/login"
            className="hidden md:inline-flex items-center min-h-[44px] text-[11px] font-sans tracking-widest uppercase text-white/60 hover:text-white/90 transition-colors duration-200 focus-ring-dark [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]"
          >
            Sign In
          </Link>

          {/* Mobile menu button (nav links only — the cart is NOT in here). */}
          <button
            ref={menuButtonRef}
            type="button"
            className="md:hidden text-white p-2.5 -mr-2 focus-ring-dark [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.5))]"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile menu — solid frosted-green sheet so links are legible. */}
      {open && (
        <div
          id="mobile-menu"
          className="md:hidden bg-green-900/95 backdrop-blur-md border-t border-gold-600/20"
        >
          <nav className="container-site py-6 flex flex-col gap-5" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm font-sans tracking-widest uppercase text-white/85 hover:text-white transition-colors focus-ring-dark"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/login"
              className="text-sm font-sans tracking-widest uppercase text-white/60 hover:text-white transition-colors focus-ring-dark"
            >
              Sign In
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
