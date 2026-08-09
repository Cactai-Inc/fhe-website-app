
import { Link } from 'react-router-dom';
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

export function AppHeader({ initial, menuOpen, onToggleMenu }: Props) {
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
      </div>
    </header>
  );
}
