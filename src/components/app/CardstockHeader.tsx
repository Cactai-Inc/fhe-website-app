import { useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './header-cardstock.css';

/**
 * THE CARDSTOCK NAMEPLATE HEADER
 *
 * A Racing Green cardstock sheet carrying an embossed logo squircle (left), an
 * embossed wordmark (centre) and a debossed avatar (right) — plus the Create
 * tab hanging off its bottom edge. Ported from the owner-approved reference,
 * `docs/reference/header-mockup.html`; that file's CSS is the specification and
 * lives here as `header-cardstock.css`.
 *
 * The header holds EXACTLY those three marks. The old Calendar button, the old
 * mobile-nav button and the avatar's ChevronDown were removed deliberately (the
 * first is reachable from both menus; the second is now the drawer tab; the
 * debossed avatar is its own affordance).
 *
 * SUPERADMIN NEVER RENDERS THIS. Platform chrome is not tenant branding and
 * keeps its own white header — see AppLayout.
 *
 * Sizes are held at every breakpoint on purpose: each SVG is DRAWN at its
 * render size (56 logo, 50 avatar) so one user unit is one CSS pixel and the
 * 1px stroke offsets land on exact device pixels. Resizing the marks
 * responsively is what made the outline jagged.
 *
 * Below 410px there isn't room for that at full size (TASK-BP410), so a
 * SECOND pair of drawings exists at 48/42 units — redrawn, not resized — and
 * header-cardstock.css swaps between the two pairs (`.cs-mark-lg`/
 * `.cs-mark-sm`) at that breakpoint. Same rule, second size.
 */

/** The squircle the FH sits inside — one path, drawn three times at three
 *  offsets (light lip above, hard dark below, face on top). Held at 56 units. */
const SQUIRCLE =
  'M28 3.61 C 11.29 3.61, 3.61 11.29, 3.61 28 C 3.61 44.71, 11.29 52.39, 28 52.39 ' +
  'C 44.71 52.39, 52.39 44.71, 52.39 28 C 52.39 11.29, 44.71 3.61, 28 3.61 Z';

/** The SAME squircle, REDRAWN at 48 units (geometry scaled ×48/56, not the
 *  56-unit path resized) for the ≤410px breakpoint — see header-cardstock.css.
 *  Scaling the 56-unit drawing down to 48px is what put the 1px stroke
 *  offsets on fractional device pixels and produced the jagged-outline defect
 *  this header already went through once (TASK-HEADER-REPORT). */
const SQUIRCLE_48 =
  'M24 3.09 C 9.68 3.09, 3.09 9.68, 3.09 24 C 3.09 38.32, 9.68 44.91, 24 44.91 ' +
  'C 38.32 44.91, 44.91 38.32, 44.91 24 C 44.91 9.68, 38.32 3.09, 24 3.09 Z';

type Props = {
  /** first letter of the member's display name — the debossed glyph */
  initial: string;
  /** the account dropdown, rendered inside the avatar's positioning context */
  menu: ReactNode;
  menuOpen: boolean;
  onAvatarClick: () => void;
  /** outside-click target for the account menu (owned by AppLayout) */
  menuRef: MutableRefObject<HTMLDivElement | null>;
  /** admin/staff only; the CSS additionally holds it to desktop */
  showCreateTab: boolean;
  onCreate: () => void;
};

export function CardstockHeader({
  initial, menu, menuOpen, onAvatarClick, menuRef, showCreateTab, onCreate,
}: Props) {
  /* Press physics run off a class, NOT :active, so a touch that drags off the
     button — or is cancelled by a scroll — releases cleanly instead of sticking
     down. The hover half of the same effect is inside @media (hover:hover) so
     phones never latch it. */
  const [pressed, setPressed] = useState(false);
  const release = () => setPressed(false);

  return (
    <div className="cs-hdrwrap">
      {/* Filter/clip/gradient defs for the avatar well. A native feGaussianBlur
          is used because iOS ignores CSS filter:blur() on SVG children. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <defs>
          <filter id="csWallBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          {/* keeps the blurred wall strictly inside the struck rim */}
          <clipPath id="csWellClip"><circle cx="25" cy="25" r="22.2" /></clipPath>
          {/* same clip, redrawn for the 42-unit avatar (≤410px) — cx/cy/r
              scaled ×42/50, not the 50-unit circle resized */}
          <clipPath id="csWellClip42"><circle cx="21" cy="21" r="18.65" /></clipPath>
          {/* Light comes from above, so the top wall casts and the bottom barely
              does. Faint on purpose: a diffuse shadow that gains REACH as the
              button sinks, not a fill that switches on. */}
          <linearGradient id="csWallFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity=".30" />
            <stop offset="45%" stopColor="#000" stopOpacity=".16" />
            <stop offset="75%" stopColor="#000" stopOpacity=".06" />
            <stop offset="100%" stopColor="#000" stopOpacity=".02" />
          </linearGradient>
        </defs>
      </svg>

      <header className="cs-hdr">
        <div className="cs-left">
          <Link to="/app" className="cs-homelink" aria-label="French Heritage Equestrian — home">
            <span className="cs-mark cs-logo">
              <svg className="cs-mark-lg" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true" focusable="false">
                <path className="cs-ring-light" transform="translate(0,-1)" d={SQUIRCLE} />
                <path className="cs-ring-dark" transform="translate(0,1)" d={SQUIRCLE} />
                <path className="cs-ring" d={SQUIRCLE} />
              </svg>
              {/* TASK-BP410: redrawn at 48 units, not the 56-unit mark resized */}
              <svg className="cs-mark-sm" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
                <path className="cs-ring-light" transform="translate(0,-1)" d={SQUIRCLE_48} />
                <path className="cs-ring-dark" transform="translate(0,1)" d={SQUIRCLE_48} />
                <path className="cs-ring" d={SQUIRCLE_48} />
              </svg>
              <span className="cs-glyph cs-fh cs-emboss">FH</span>
            </span>
          </Link>
        </div>

        {/* The wordmark's own text is its accessible name, so it needs no label. */}
        <Link to="/app" className="cs-wordmark cs-emboss">
          <span className="cs-long">French Heritage Equestrian</span>
          <span className="cs-short">French Heritage</span>
        </Link>

        <div className="cs-right">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className={`cs-mark cs-avatar${pressed ? ' is-pressed' : ''}`}
              onClick={onAvatarClick}
              onPointerDown={() => setPressed(true)}
              onPointerUp={release}
              onPointerLeave={release}
              onPointerCancel={release}
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              <svg className="cs-mark-lg" viewBox="0 0 50 50" width="50" height="50" aria-hidden="true" focusable="false">
                <g clipPath="url(#csWellClip)">
                  <circle className="cs-ring-wall" cx="25" cy="24.4" r="21.8" />
                </g>
                <circle className="cs-ring-dark" cx="25" cy="24" r="22.2" />
                <circle className="cs-ring-breath" cx="25" cy="26" r="22.2" />
                <circle className="cs-ring" cx="25" cy="25" r="22.2" />
              </svg>
              {/* TASK-BP410: redrawn at 42 units, not the 50-unit mark resized.
                  Well-band (wall + clip) cx/cy/r scaled ×42/50; the outline
                  triple's ±1 y-offset (20/21/22) stays literal, same as the
                  logo's translate(0,±1) — a physical pixel, not geometry. */}
              <svg className="cs-mark-sm" viewBox="0 0 42 42" width="42" height="42" aria-hidden="true" focusable="false">
                <g clipPath="url(#csWellClip42)">
                  <circle className="cs-ring-wall" cx="21" cy="20.5" r="18.31" />
                </g>
                <circle className="cs-ring-dark" cx="21" cy="20" r="18.65" />
                <circle className="cs-ring-breath" cx="21" cy="22" r="18.65" />
                <circle className="cs-ring" cx="21" cy="21" r="18.65" />
              </svg>
              <span className="cs-glyph cs-av">{initial}</span>
            </button>
            {menu}
          </div>
        </div>
      </header>

      {/* THE CREATE TAB — admin/staff only, and desktop only (the CSS holds it
          to lg+; on mobile the page-level `+` controls are the create path).
          Ordered after the sheet but painted under it (z-index 1 vs 2), so it
          emerges from BEHIND the card rather than sliding across it. */}
      {showCreateTab && (
        <button className="cs-tab" type="button" onClick={onCreate} aria-label="Create" aria-haspopup="dialog">
          <span className="cs-chev" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
