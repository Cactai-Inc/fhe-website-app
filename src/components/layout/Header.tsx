import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';

/* The single site header — used on the landing AND every inner page.
 *
 * Behavior (owner spec):
 *  - CONTEXT-AWARE nav color (the key behavior): the header is FIXED and content
 *    scrolls UNDER it, so the nav color keys off WHAT REGION IS BEHIND the header
 *    RIGHT NOW — not on scroll position. Over a DARK/green region → WHITE nav +
 *    subtle shadow; over a LIGHT/cream region → DARK GREEN nav + no shadow. This
 *    flips LIVE as differently-toned sections pass under the header (e.g. on
 *    /story, scrolling from the light S1 into the green S2 turns the nav white,
 *    then back to green in the next light section). Dark regions opt in with
 *    `data-header-tone="dark"`; light is the default. See the detection effect.
 *  - FROST + MINIFY stay keyed to SCROLL, independently: on scroll a liquid-glass
 *    frosted backdrop descends (blur + a whisper of green tint + hairline gold
 *    rule) and the header height drops ~33% (padding + logo + wordmark shrink).
 *    Because the frost is a translucent green tint, all four combos stay legible
 *    (naked/frosted × over-dark/over-light).
 *  - The nav is identical everywhere.
 *
 * The landing is 100dvh/no-scroll, so there the header stays naked; the color is
 * still driven by the region behind it (the dark hero → white nav).
 * SSR-safe: listeners attach only in the browser; the initial tone defaults to
 * the correct value per route (landing = over-dark) so first paint has no flash.
 */

// One nav, consistent everywhere. The rider funnel is reached via the big
// central CTA + Our Story, so the nav surfaces the OTHER offerings (no
// redundant "Ride With Us"), and adds the previously-missing horse services.
const NAV_LINKS = [
  { label: 'Our Story', href: '/story' },
  { label: 'Horse Care Services', href: '/horse' },
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
  const headerRef = useRef<HTMLElement>(null);

  // ── Context-aware tone ──────────────────────────────────────────────────────
  // `overDark` = the header band is currently over a DARK/green region, so the
  // nav must be WHITE (with a subtle shadow). Otherwise the region is light and
  // the nav is DARK GREEN. This is INDEPENDENT of scroll (frost/minify below):
  // it flips live as differently-toned sections scroll under the fixed header.
  //
  // Detection: on scroll/resize (rAF-throttled, passive) we sample every
  // `[data-header-tone="dark"]` element and check whether it overlaps the header
  // band [0, header bottom]. Re-queries the DOM each pass, so per-route dark
  // sections are picked up without re-registering anything.
  //
  // SSR-safe: no window/document at module or initial-render time. The initial
  // value defaults to the correct tone per route (landing hero is dark), so the
  // prerendered/first paint has no flash.
  const [overDark, setOverDark] = useState<boolean>(() => location.pathname === '/');

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Region detection — recomputed on scroll/resize and whenever the route (and
  // thus the set of dark sections) changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let raf = 0;

    const measure = () => {
      raf = 0;
      const header = headerRef.current;
      // The band we care about: the header's fixed footprint at the top.
      const bandTop = 0;
      const bandBottom = header ? header.getBoundingClientRect().bottom : 72;
      // Sample a probe line just inside the header's bottom edge.
      const probeY = Math.max(1, bandBottom - 2);

      const darkEls = document.querySelectorAll<HTMLElement>('[data-header-tone="dark"]');
      let dark = false;
      darkEls.forEach((el) => {
        if (dark) return;
        const r = el.getBoundingClientRect();
        // Does this dark section overlap the header band vertically?
        if (r.top <= probeY && r.bottom >= bandTop) dark = true;
      });
      setOverDark(dark);
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };

    // Initial pass after layout settles (route content mounted).
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [location.pathname]);

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

  // ── Context-aware token helpers ─────────────────────────────────────────────
  // Color + shadow key off `overDark` (the region behind the header), NOT scroll.
  //   over a DARK/green region → WHITE nav + subtle shadow (legible over photos);
  //   over a LIGHT/cream region → DARK GREEN nav + no shadow (crisp on frost/light).
  // This holds in all four combos (naked/frosted × over-dark/over-light) because
  // the frost is a translucent green tint: over-light-frosted is light enough for
  // dark-green, and over-dark (frosted or not) stays dark enough for white.
  const heroShadow = overDark ? '[text-shadow:0_1px_10px_rgba(0,0,0,0.5)]' : '';
  const navText = overDark
    ? 'text-white/90 hover:text-white'
    : 'text-green-800 hover:text-green-950';
  const wordmarkText = overDark ? 'text-white' : 'text-green-900';
  const subtleText = overDark ? 'text-white/60 hover:text-white/90' : 'text-green-800/70 hover:text-green-900';
  // The gold accent underline reads on both surfaces (deeper gold on light).
  const underline = overDark ? 'bg-gold-300' : 'bg-gold-700';

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
      ref={headerRef}
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
              scrolled ? 'w-9 h-9' : 'w-11 h-11'
            } ${overDark ? 'border-white/40 text-white' : 'border-green-800/40 text-green-900'}`}
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
                      ? overDark ? 'text-white' : 'text-green-950'
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
                overDark ? 'text-gold-300 hover:text-gold-200' : 'text-gold-800 hover:text-gold-900'
              }`}
            >
              Member Area
            </Link>
          )}

          {!user && (
            <Link
              to="/login"
              className={`hidden md:inline-flex items-center min-h-[44px] text-[11px] font-sans tracking-widest uppercase transition-colors duration-[400ms] focus-ring-dark ${subtleText} ${heroShadow}`}
            >
              Sign In
            </Link>
          )}

          {/* Mobile menu button (nav links only — the cart is NOT in here). */}
          <button
            ref={menuButtonRef}
            type="button"
            className={`md:hidden p-2.5 -mr-2 focus-ring-dark transition-colors duration-[400ms] ${
              overDark ? 'text-white [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.5))]' : 'text-green-900'
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
            {user ? (
              <Link
                to="/app"
                className="text-sm font-sans tracking-widest uppercase text-gold-300 hover:text-gold-200 transition-colors focus-ring-dark"
              >
                Member Area
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-sm font-sans tracking-widest uppercase text-white/60 hover:text-white transition-colors focus-ring-dark"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
