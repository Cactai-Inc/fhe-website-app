
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePrefersReducedMotion } from '../../lib/hooks';
import './app-header.css';

/**
 * THE APP HEADER — one header sitewide (TASK-ONEHEADER, owner 2026-08-08).
 *
 * The cardstock nameplate is shelved (docs/reference/shelved-cardstock-header/).
 * This is the LOGIN screen's header — src/components/layout/Header.tsx — adopted
 * into the app, so signing in no longer swaps one header for another and the
 * colours match either side of the wire.
 *
 * What was adopted is the MATERIAL, not the contents. The public header carries
 * site nav and a sign-in CTA; this one carries what the app header has always
 * carried: the home mark, the wordmark, and the avatar. Sizing, surface and
 * typography come across; the nav does not.
 *
 * The gold hairline did NOT come across, though this note used to say it did.
 * On the public header that rule belongs to the SCROLLED state, and §1 below
 * removed the scrolled state — so the app header shipped with
 * `border-bottom: transparent` and no edge of any kind, against a page, a rail
 * and a subheader all within 1.11:1 of its own tone. It is separated by a soft
 * two-layer shadow instead (owner, 2026-08-09) — depth rather than a drawn rule.
 * See app-header.css, `.oh-hdr`.
 *
 * Three things are deliberately different from the public header, each recorded
 * at its rule in app-header.css:
 *   1. NO SCROLL-MINIFY. The public site drops ~33% of its height on scroll.
 *      Inside the app that would move both rails and the contract subheader
 *      while you scroll a document, because they are sticky at --cs-hdr-h. Fixed
 *      height per breakpoint; only the surface changes.
 *   2. The scrolled surface is declared as its RENDERED colour rather than the
 *      public header's `green-900/10`, so it holds up when the solid green nav
 *      rail passes behind it.
 *   3. No debossed relief anywhere. Relief needs a mid-tone surface to carve
 *      into; on glass there is nothing to carve.
 *
 * SUPERADMIN NEVER RENDERS THIS. Platform chrome is not tenant branding and
 * keeps its own white header — see AppLayout.
 */

type Props = {
  /** first letter of the member's display name — the avatar glyph */
  initial: string;
  /** whether the mobile nav drawer is open (drives the button's ARIA state) */
  menuOpen: boolean;
  /** toggles the mobile nav drawer. ONEHEADER §2: the avatar is that control. */
  onToggleMenu: () => void;
};

/* ── §D2, THE ONE-TIME TIP — the four values that decide its behaviour ────────
 * The wording is a constant because the owner asked for it to be one ("or
 * wording the owner prefers — put the string in one constant").
 *
 * THE MARKER IS localStorage, and that is a deliberate reading of "follow
 * whatever this app already uses for first-run markers" rather than a shortcut.
 * The app has TWO such mechanisms: the tour's server-side, per-form-factor stamp
 * (`profiles.tour_seen_mobile_at`, written by `markTourSeen()`), and the
 * localStorage flags AppLayout already keeps for `communityNav.expanded` and
 * `staffRail.pinned`. The tour's needs a migration and a column, which is a
 * database change for a header hint and is outside this task's file ownership;
 * the localStorage form is what this surface already uses, is per-device (which
 * is the correct grain for "first MOBILE visit" — the same account on a phone
 * and a laptop are two different discoveries), and costs nothing. If the owner
 * wants this to survive a cleared browser, the swap is `markTourSeen`'s shape
 * and one column.
 *
 * The dwell is timed on the DWELL, not on the whole animation — 3.5s of the
 * owner's "3-4 seconds" at full presence, with the 320ms pop before it and the
 * 320ms fade after it on top. */
const MENU_TIP_TEXT = 'Click for menu';
const MENU_TIP_SEEN_KEY = 'navMenuTip.seen';
const MENU_TIP_DWELL_MS = 3500;
const MENU_TIP_EXIT_MS = 320;   // matches .oh-tip--out's duration-320 in app-header.css
/** The same 1024px line the avatar's own display split uses. Declared once here
 *  and once in app-header.css: this half decides whether the TIMERS ever start,
 *  the CSS half decides whether the box can ever paint. Belt and braces on
 *  purpose — the CSS half is the one that cannot be beaten by source order. */
const MENU_TIP_MOBILE_MQ = '(max-width: 1023.98px)';

export function AppHeader({ initial, menuOpen, onToggleMenu }: Props) {
  /* §D2 — a first-run teaching moment that leaves. Three states rather than a
     boolean because the box has to still be in the DOM while it fades out; the
     drawer in AppLayout is built the same way and for the same reason. */
  const [tip, setTip] = useState<'hidden' | 'in' | 'out'>('hidden');
  const reducedMotion = usePrefersReducedMotion();
  const exitTimer = useRef<number | undefined>(undefined);

  /** Stamps the marker and starts the exit. Every dismissal path lands here, so
   *  "it never returns" is true of all of them, not just of the timer. */
  const dismissTip = useCallback(() => {
    setTip((t) => {
      if (t !== 'in') return t;
      exitTimer.current = window.setTimeout(() => setTip('hidden'), MENU_TIP_EXIT_MS);
      return 'out';
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    /* Stamped on SHOW, not on dismiss. A member who backgrounds the app
       mid-dwell has still been shown the tip; re-teaching them on the next
       load is the thing "first mobile visit only" rules out. */
    try {
      if (localStorage.getItem(MENU_TIP_SEEN_KEY) === '1') return;
      if (!window.matchMedia?.(MENU_TIP_MOBILE_MQ).matches) return;
      localStorage.setItem(MENU_TIP_SEEN_KEY, '1');
    } catch { return; }   /* private mode / storage disabled — no tip, no crash */
    setTip('in');
  }, []);

  /* The dwell. Under reduced motion there is no pop to wait out, so the dwell
     starts immediately — the box is fully present from frame one. */
  useEffect(() => {
    if (tip !== 'in') return;
    const t = window.setTimeout(dismissTip, MENU_TIP_DWELL_MS + (reducedMotion ? 0 : MENU_TIP_EXIT_MS));
    return () => window.clearTimeout(t);
  }, [tip, reducedMotion, dismissTip]);

  /* "Any interaction dismisses it immediately: touch, click, scroll, or focus."
     `pointerdown` covers touch and mouse in one; `scroll` is captured because
     the app scrolls inside `overflow-y-auto` containers, not only on window, so
     a bubble-phase listener would miss most of the real scrolling. */
  useEffect(() => {
    if (tip !== 'in') return;
    const opts = { capture: true, passive: true } as const;
    document.addEventListener('pointerdown', dismissTip, opts);
    document.addEventListener('scroll', dismissTip, opts);
    document.addEventListener('focusin', dismissTip, opts);
    document.addEventListener('keydown', dismissTip, opts);
    return () => {
      document.removeEventListener('pointerdown', dismissTip, opts);
      document.removeEventListener('scroll', dismissTip, opts);
      document.removeEventListener('focusin', dismissTip, opts);
      document.removeEventListener('keydown', dismissTip, opts);
    };
  }, [tip, dismissTip]);

  /* Opening the menu obviously dismisses it — and this is the one path where
     the tip has actually done its job. */
  useEffect(() => { if (menuOpen) dismissTip(); }, [menuOpen, dismissTip]);

  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  /* No scroll listener. Owner, 2026-08-08: the header is FLAT AND OPAQUE from
     load through scroll — he chose this header for its simplicity and did not
     want the public site's transparent-to-frosted transition carried into the
     app. Removing the listener also removes a real hazard: while the drawer is
     open AppLayout pins <body> with position:fixed, which drives scrollY to 0
     and would have flipped the header's surface the moment the menu opened. */

  /* The avatar is a MENU BUTTON only where the drawer is the nav. At lg+ the
   * rail is already on screen and open, so there is nothing for it to toggle —
   * it stays the personalisation mark it has been. Same breakpoint the drawer
   * tab used (`@media (min-width: 1024px)`), same rule, one control instead of
   * two. ONEHEADER §4: it opens the ONE nav — it does not bring back the
   * separate avatar dropdown ONEMENU removed. */
  const avatarGlyph = <span aria-hidden="true">{initial}</span>;

  return (
    <header className={`oh-hdr`}>
      <div className="oh-left">
        <Link to="/app" className="oh-homelink" aria-label="French Heritage Equestrian — home">
          <span className="oh-mono" aria-hidden="true">FH</span>
        </Link>
      </div>

      {/* The wordmark's own text is its accessible name, so it needs no label. */}
      <Link to="/app" className="oh-wordmark">
        <span className="oh-w1">French Heritage</span>
        <span className="oh-w2">Equestrian</span>
      </Link>

      <div className="oh-right">
        {/* Which of these two shows is decided in app-header.css at the 1024px
            breakpoint, NOT with `lg:hidden`/`hidden lg:grid`: `.oh-avatar` sets
            `display:grid` itself, and a Tailwind display utility is the same
            specificity — which of them wins would come down to injected
            stylesheet order. A media query in the file that owns the rule cannot
            be beaten by source order. */}
        <button
          type="button"
          className="oh-avatar"
          onClick={onToggleMenu}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="app-nav-drawer"
        >
          {avatarGlyph}
        </button>
        <span className="oh-avatar">{avatarGlyph}</span>
        {/* §D2 — an ADVISORY, not an alert. `role="status"` is polite, so it
            never interrupts a screen-reader user mid-sentence, and nothing here
            takes or traps focus: the box is `pointer-events: none` and holds no
            control at all. Rendering it after the marks keeps it out of the tab
            order by construction as well as by having nothing focusable in it.
            Under reduced motion the box still appears — it is information, not
            decoration, and it is the only thing that says what the control does
            — but it arrives with no pop. That is the deliberate opposite of the
            drawer's reduced-motion rule (§C3), which suppresses motion outright,
            because suppressing THIS would withhold the message itself. */}
        {tip !== 'hidden' && (
          <div
            className={`oh-tip ${tip === 'out' ? 'oh-tip--out' : reducedMotion ? '' : 'oh-tip--pop'}`}
            role="status"
          >
            {MENU_TIP_TEXT}
          </div>
        )}
      </div>
    </header>
  );
}
