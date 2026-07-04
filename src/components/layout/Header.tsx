import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';

/* The single site header — used on the landing AND every inner page.
 *
 * Behavior (owner spec):
 *  - NAKED (transparent) at the top of scroll, on the landing and every inner
 *    page. State-aware: nav text + wordmark + logo are LIGHT (white/cream) with a
 *    SUBTLE text-shadow so they read over the dark hero image.
 *  - ON SCROLL: (a) MINIFY — the header height drops ~33% (padding + logo +
 *    wordmark all shrink); (b) a LIQUID-GLASS FROSTED backdrop descends (blur + a
 *    whisper of green tint + hairline gold rule); (c) the nav text + wordmark +
 *    logo flip to DARK GREEN (crisp, NO text-shadow) for legibility on the light
 *    frosted glass. All three transition together on the same scroll trigger
 *    (~400ms). Never dark-green-on-transparent (that would be invisible over the
 *    dark hero) and never light-on-frost.
 *  - The nav is identical everywhere.
 *
 * The landing is 100dvh/no-scroll, so there the header stays naked (never
 * scrolls); the minify+frost+color-flip triggers only on pages that scroll.
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

  // ── State-aware token helpers ──────────────────────────────────────────────
  // naked (over hero) → light text + subtle shadow; frosted → dark green, no shadow.
  const heroShadow = scrolled ? '' : '[text-shadow:0_1px_10px_rgba(0,0,0,0.5)]';
  const navText = scrolled
    ? 'text-green-800 hover:text-green-950'
    : 'text-white/90 hover:text-white';
  const wordmarkText = scrolled ? 'text-green-900' : 'text-white';
  const subtleText = scrolled ? 'text-green-800/70 hover:text-green-900' : 'text-white/60 hover:text-white/90';
  // The gold accent underline reads on both surfaces (deeper gold on light frost).
  const underline = scrolled ? 'bg-gold-700' : 'bg-gold-300';

  // The saved-selection cart affordance. Always VISIBLE in the header once there
  // is a saved selection — top-right on desktop, CENTERED on mobile (never in the
  // hamburger). State-aware color like the rest of the nav.
  const cart = (extraClass: string) =>
    itemCount > 0 && (
      <Link
        to="/checkout"
        className={`inline-flex items-center gap-2 transition-colors duration-[400ms] min-h-[44px] focus-ring-dark ${navText} ${heroShadow} ${extraClass}`}
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
            'bg-green-900/10 backdrop-blur-md border-b border-gold-600/25 shadow-sm shadow-green-950/10'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div
        className={`container-site grid grid-cols-[auto_1fr_auto] items-center gap-2 transition-all duration-[450ms] ease-out ${
          // Minify: a genuine ~33% height cut on scroll (padding shrinks together
          // with the logo + wordmark below). Naked ≈92px → scrolled ≈60px (~35%).
          scrolled ? 'py-3' : 'py-6 sm:py-7'
        }`}
      >
        {/* Wordmark (left) — logo mark + unified heritage-serif nameplate. */}
        <Link
          to="/"
          className="justify-self-start flex items-center gap-3 group focus-ring-dark min-h-[44px]"
          aria-label="French Heritage Equestrian — Home"
        >
          {/* LOGO SLOT — no full logo asset exists in the repo (only a rounded
              favicon), so we render a squared, state-aware "FH" monogram that
              matches the brand and tints per header state. Drop the real logo
              here (an <img src="/…"> sized like this box) when it arrives. */}
          <span
            className={`shrink-0 flex items-center justify-center border transition-all duration-[450ms] ${
              scrolled
                ? 'w-9 h-9 border-green-800/40 text-green-900'
                : 'w-11 h-11 border-white/40 text-white'
            }`}
            aria-hidden="true"
          >
            <span
              className={`font-display font-medium leading-none transition-all duration-[450ms] ${
                scrolled ? 'text-base' : 'text-lg'
              }`}
            >
              FH
            </span>
          </span>

          {/* Unified nameplate — both words in the heritage serif (font-display).
              "Equestrian" is now larger and matched to the "French Heritage"
              face, so the three words read as one cohesive nameplate. */}
          <span className={`flex flex-col items-start leading-[0.95] transition-colors duration-[400ms] ${wordmarkText} ${heroShadow}`}>
            <span
              className={`font-display font-medium tracking-wide uppercase transition-all duration-[450ms] ${
                scrolled ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
              }`}
            >
              French Heritage
            </span>
            <span
              className={`font-display font-medium tracking-[0.18em] uppercase transition-all duration-[450ms] ${
                scrolled ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
              }`}
            >
              Equestrian
            </span>
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
                  className={`group relative inline-flex items-center min-h-[44px] text-xs font-sans tracking-widest uppercase transition-colors duration-[400ms] focus-ring-dark ${heroShadow} ${
                    current
                      ? scrolled ? 'text-green-950' : 'text-white'
                      : navText
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute left-0 -bottom-0.5 h-px transition-all duration-300 ${underline} ${
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
              className={`hidden md:inline-flex text-[11px] font-sans tracking-widest uppercase transition-colors duration-[400ms] focus-ring-dark ${heroShadow} ${
                scrolled ? 'text-gold-800 hover:text-gold-900' : 'text-gold-300 hover:text-gold-200'
              }`}
            >
              Member Area
            </Link>
          )}

          <Link
            to="/login"
            className={`hidden md:inline-flex items-center min-h-[44px] text-[11px] font-sans tracking-widest uppercase transition-colors duration-[400ms] focus-ring-dark ${subtleText} ${heroShadow}`}
          >
            Sign In
          </Link>

          {/* Mobile menu button (nav links only — the cart is NOT in here). */}
          <button
            ref={menuButtonRef}
            type="button"
            className={`md:hidden p-2.5 -mr-2 focus-ring-dark transition-colors duration-[400ms] ${
              scrolled ? 'text-green-900' : 'text-white [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.5))]'
            }`}
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
