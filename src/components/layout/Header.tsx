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
 *  - The nav is identical everywhere, with ONE exception: the landing route
 *    carries a small Sign In link under Say Hello, because it is the only
 *    page that renders with no footer to hold one. See the right cluster.
 *
 * The landing is 100dvh/no-scroll, so there the header stays naked; the color is
 * still driven by the region behind it (the dark hero → white nav).
 * SSR-safe: listeners attach only in the browser; the initial tone defaults to
 * the correct value per route (landing = over-dark) so first paint has no flash.
 */

// One nav, consistent everywhere. The rider funnel is reached via the big
// central CTA + Our Story, so the nav surfaces the OTHER offerings (no
// redundant "Ride With Us"), and adds the previously-missing horse services.
/* Owner, 2026-08-16: Book a Lesson takes Say Hello's place in the main nav —
 * booking is the thing a visitor came to do, so it belongs in the primary row.
 * Say Hello moves to the right corner (below); Member Area and Sign In leave the
 * header entirely and live in the footer only.
 * ⚠️ AMENDED 2026-09-02, and the decision above still stands everywhere it can:
 * the LANDING route has no footer, so "in the footer only" left it with no way in
 * at desktop width. It — and only it — regains a subordinate Sign In text link. */
const NAV_LINKS = [
  // Owner, 2026-08-16: 'Our Community' — bare 'Community' read as the in-app
  // members' community rather than the story of the place. Route stays /story.
  { label: 'Our Community', href: '/story' },
  // 'Horse Care Services' was 194px of the row's 595 — a third of the nav for
  // one label, and the single biggest reason the row could not fit. The FOOTER
  // has always called this "Horse Care"; the header is the one that disagreed.
  { label: 'Horse Care', href: '/horse' },
  { label: 'Find a Horse', href: '/acquisition' },
  { label: 'Book a Lesson', href: '/lessons' },
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

  // ⚠️ PRESENCE IS A ROUTE QUESTION; TONE IS NOT. `overDark` above is a TONE
  // signal only — it is seeded from the route once and then OVERWRITTEN on every
  // scroll and resize by the detection effect below, on every page. /story has
  // two `data-header-tone="dark"` sections, so scrolling it flips `overDark` to
  // true — anything gated on it would appear there too. The landing-only sign-in
  // link asks the route directly, and only for WHETHER it renders; it still asks
  // `overDark` for what COLOUR it is.
  const isLanding = location.pathname === '/';

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
        // ⚠️ THE GRID GAP IS THE WORDMARK'S BREATHING ROOM. The middle track is
        // `1fr` holding the mobile-only cart, so on desktop it is an empty item
        // that collapses to ZERO width — which left `gap-2` twice, 16px total,
        // as the only thing between "FRENCH HERITAGE" and the first nav link.
        // That is the crowding in the owner's screenshot: the nameplate and
        // "OUR COMMUNITY" touching. xl:gap-8 guarantees 64px of air no matter
        // how wide the right cluster gets.
        className={`container-site grid grid-cols-[auto_1fr_auto] items-center gap-2 min-[940px]:gap-6 xl:gap-12 transition-all duration-[450ms] ease-out ${
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
          {/* whitespace-nowrap: the nameplate is TWO lines by design — "French
              Heritage" over "Equestrian" — and it was breaking into THREE once
              the nav squeezed the auto column ("FRENCH / HERITAGE /
              EQUESTRIAN"). A wordmark is a logo, not copy; it does not reflow.
              With this it holds its 208px and the row's slack comes out of the
              gap instead, which is what the gap is for. */}
          <span className={`flex flex-col items-start whitespace-nowrap leading-[0.95] transition-colors duration-[400ms] ${wordmarkText} ${heroShadow}`}>
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

        {/* Middle track: deliberately empty. The cart used to live here,
            `justify-self-center`, which floated it in open space in the middle of
            the header with no relationship to anything — the owner's note that it
            "looks a bit odd". It now sits in the right cluster beside the
            hamburger, where the other controls are. The track stays so the
            wordmark and the right cluster keep their `auto 1fr auto` push-apart. */}
        <div aria-hidden="true" />

        {/* Right cluster — desktop nav + cart (top-right) + sign in; hamburger. */}
        <div className="justify-self-end flex items-center gap-4 xl:gap-5">
          {/* ⚠️ THE FULL NAV APPEARS AT xl, NOT md. Measured, not guessed: the
              four labels are 595px of text at `tracking-widest` (0.25em — far
              wider than it looks), and with the wordmark, the cart and Say Hello
              the row needs ~1117px. It was switching on at md = 768px, roughly
              350px before it could ever fit, and surviving on nothing but text
              wrapping — which is exactly the two-line stacking the owner
              reported. It was never the cart: the owner's 1030px capture has no
              cart and is already broken, and at 775px the nameplate itself
              breaks into three lines.
              Below xl the hamburger takes over, which is the layout the owner's
              726px capture shows working cleanly. Degrading to a menu that fits
              beats degrading to a row that doesn't. */}
          <nav className="hidden min-[940px]:flex items-center gap-4 xl:gap-6" aria-label="Primary">
            {NAV_LINKS.map((link) => {
              const current = location.pathname === link.href;
              return (
                <Link
                  key={link.label}
                  to={link.href}
                  aria-current={current ? 'page' : undefined}
                  // whitespace-nowrap: a label is one line or it is not shown.
                  // "HORSE CARE SERVICES" breaking into three stacked words is
                  // what made the header look broken; the row now either fits or
                  // hands over to the hamburger.
                  // ⚠️ TRACKING IS THE HIDDEN WIDTH. `tracking-widest` is 0.25em
                  // in this config — a quarter of the type size after EVERY
                  // character, which on ~48 characters of nav is ~145px of pure
                  // letter-spacing. It is the reason the row looked like it
                  // should fit and never did. Below xl it tightens to 0.14em and
                  // drops to 11px, which is still unmistakably the same nav and
                  // buys back the ~150px that lets it survive down to ~900px
                  // instead of collapsing to a hamburger on a 1200px laptop.
                  className={`group relative inline-flex items-center whitespace-nowrap min-h-[44px] text-[11px] xl:text-xs font-sans tracking-[0.14em] xl:tracking-widest uppercase transition-colors duration-[400ms] focus-ring-dark ${heroShadow} ${
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

          {/* Cart — ONE instance at every width, always in the right cluster.
              It was previously rendered twice (a centered mobile copy and an
              xl-only desktop copy) with mirrored breakpoints keeping exactly one
              visible; a single node cannot fall out of step with itself. On
              mobile it lands immediately left of the hamburger. */}
          {cart('')}

          {/* Say Hello — the right corner. Member Area and Sign In used to sit
              here; both moved to the footer (owner, 2026-08-16), so a first-time
              visitor sees one way in and no account chrome. */}
          {/* Owner, 2026-08-16: outlined in gold, and the outline FILLS gold on
              hover with the label flipping to the dark green so it reads against
              the fill. `overDark` swaps the resting ink between the light gold
              (over the hero) and the deep gold (over cream pages) — the border
              and the fill are the same gold in both, so the button looks like one
              control everywhere. */}
          {/* ⚠️ SAY HELLO STANDS DOWN ONCE THERE IS A CART. Owner, 2026-08-17:
              "the hello button is not needed once we have items in the cart",
              and "the cart replacing the hello button is a generous tradeoff
              because the cart icon is very small comparatively" — ~110px of
              bordered button swapped for a 20px glyph. Someone mid-selection has
              already found their way in; the inquiry they are building IS the
              conversation, and /contact stays one tap away in the hamburger and
              in the footer. This is what lets the full nav survive down to ~900px
              while shopping instead of collapsing to a menu. */}
          {/* ⚠️ A VERTICAL STACK, NOT A FIFTH ITEM IN THE ROW. The row's fit floor
              is 940px and it got there by losing labels (see the nav comment
              above); adding Sign In beside Say Hello would spend that budget
              again. Stacked, the cluster's WIDTH is unchanged whenever Say Hello
              is present, because Say Hello is the wider of the two.
              ⚠️ The wrapper carries the 940px breakpoint ITSELF as well as its
              children: an always-rendered wrapper would still be a flex item
              below 940px — zero-wide, but the row's `gap-4` would put 16px of
              dead air where the hamburger's neighbour used to be.
              ⚠️ And it is rendered only when it has a child, for the same reason:
              on an inner page with a full cart both children are absent, and an
              empty div would push the nav and cart 16px off the right rail. */}
          {(itemCount === 0 || isLanding) && (
          <div className="hidden min-[940px]:flex flex-col items-center gap-1">
            {itemCount === 0 && (
            <Link
              to="/contact"
              // px-3.5 + nowrap: the box is sized to its label. It looked oversized
              // because the LABEL was wrapping to two lines inside a fixed
              // min-height, not because the padding was generous. `tracking-widest`
              // already puts 0.25em after the final "O", so the optical right
              // padding runs wider than the left — hence 14px rather than 16.
              className={`hidden min-[940px]:inline-flex items-center whitespace-nowrap min-h-[40px] px-3.5 border text-[11px] font-sans tracking-[0.14em] xl:tracking-widest uppercase transition-colors duration-300 focus-ring-dark hover:bg-gold-600 hover:text-green-950 hover:border-gold-600 ${heroShadow} ${
                overDark
                  ? 'border-gold-300/70 text-gold-300'
                  : 'border-gold-700/60 text-gold-800'
              }`}
            >
              Say Hello
            </Link>
            )}

            {/* Sign In — THE LANDING PAGE ONLY, and this is not a reversal of the
                2026-08-16 decision above. Sign-in lives in the FOOTER, and the
                landing is the one route that renders bare with no footer under it
                (`Landing.tsx:9-23`), so at desktop width it had ZERO ways in. The
                hamburger's Sign In (below) already covers every width under 940px
                on every route including this one — hence the same `min-[940px]`
                breakpoint Say Hello uses, so exactly one of the two is ever live.
                ⚠️ IT IS DELIBERATELY OUTSIDE THE `itemCount === 0` GATE ABOVE.
                Say Hello stands down for a full cart; on every other page the
                footer still catches that person, and here nothing would. Owner,
                2026-09-01: *"thats correct, a person with things in their cart
                needs to go to the cart not the say hello contact us form page"* —
                the cart glyph is the way ONWARD and this is the way IN.
                Subordinate to Say Hello by treatment: a small underlined text
                link in the nav's own ink, never a second button. `/login` is
                unconditional — it handles an already-signed-in visitor itself. */}
            {isLanding && (
            <Link
              to="/login"
              className={`hidden min-[940px]:inline-flex items-center whitespace-nowrap py-0.5 text-[10px] font-sans tracking-[0.14em] uppercase underline underline-offset-4 transition-colors duration-[400ms] focus-ring-dark ${navText} ${heroShadow}`}
            >
              Sign In
            </Link>
            )}
          </div>
          )}

          {/* Mobile menu button (nav links only — the cart is NOT in here). */}
          <button
            ref={menuButtonRef}
            type="button"
            className={`min-[940px]:hidden p-2.5 -mr-2 focus-ring-dark transition-colors duration-[400ms] ${
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
          className="min-[940px]:hidden bg-green-900/95 backdrop-blur-md border-t border-gold-600/20"
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
            {/* Say Hello — the mobile equivalent of the desktop right corner. */}
            <Link
              to="/contact"
              className="text-sm font-sans tracking-widest uppercase text-white/85 hover:text-white transition-colors focus-ring-dark"
            >
              Say Hello
            </Link>

            {/* Account entrance stays HERE but not in the desktop bar (owner,
                2026-08-16): "mobile menu can have sign in on it because there is
                plenty of room and getting to the footer on a mobile device is
                much larger amount of scrolling." The desktop footer is a short
                scroll; a phone footer is not. */}
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
