import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, Link, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { FEED_VIEWS, FEED_VIEW_META, type FeedView } from '../../lib/seed';
import { dmUnreadTotal } from '../../lib/community';
import {
  CalendarDays, Users, FileText, UserRound, ReceiptText, Shield, LogOut,
  GraduationCap, Home as HomeIcon, Boxes, Contact, LayoutDashboard,
  /* BookOpen was the Directory row's icon (REVIEW SECTION move, TASK-REVIEWNAV).
     TASK-RECORDS (2026-08-12) reclaims it for the single Records entry that
     replaces Leads/Clients/Directory — Contact and Users are both already
     doing other jobs in this rail (Employees, Community), and the task's own
     instruction is to inherit one of the three retired icons rather than add
     a fourth glyph. */
  BookOpen,
  ChevronDown, ChevronUp, Plus, LifeBuoy, ShoppingBag, MessageSquare, ListChecks,
  PanelLeftClose, PanelLeftOpen, Activity, Compass, Grid3x3, Bookmark,
  Receipt, Eye, Library, NotebookPen,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePrefersReducedMotion } from '../../lib/hooks';
import { useViewSurfaces } from '../../lib/surfaces';
import { fetchMyGrantKeys } from '../../lib/grants';
import {
  myUnreadCount, inboundOpenCount, myWallState, getMyProfile, markTourSeen, fetchMyCategories,
  currentTourFormFactor, myNavPresence,
  type WallState, type StandingCategory, type NavPresence,
} from '../../lib/api';
import { AppOverviewModal } from './AppOverviewModal';
import { CreateModal, type CreateModalStep } from './CreateModal';
import { AppHeader } from './AppHeader';
import { CreateModalTriggerContext } from '../../contexts/CreateModalContext';
import { captureWallReturnDestination } from '../../lib/wallReturn';
/* ── THE NAV PANEL — solid green, cream contents (ONEHEADER §1, owner 2026-08-08)
 *
 * The green glass is DROPPED. It was not a tuning problem, and the arithmetic
 * behind the ruling is worth keeping because it is what rules out ever going
 * back to a compensated base:
 *
 *   Over the warm cream page (hue 37deg) a translucent green composites 72deg
 *   toward YELLOW — green-800/20 renders #c8cac0, hue 73deg, saturation 9%.
 *   Compensating the base only works AT ONE ALPHA: a base solved for 30%
 *   renders as bright emerald at 85%, because at high alpha the page barely
 *   contributes. And at high alpha the brand green needs no correction at all —
 *   #143321 at 85% renders #344d3d, hue 142deg, three degrees off brand.
 *
 * So over a cream page you can have GLASS or YOUR GREEN, not both. The owner
 * chose the green. `glass.nav` in tailwind.config.js was the compensated base
 * that solved for one alpha; nothing reads it now.
 *
 * CONSEQUENCE, and it is the whole rest of this change: every nav label, icon,
 * section heading, divider and badge inverts to cream. Dark text on a dark panel
 * was the actual defect in the previous build — not the green.
 *
 * All three nav surfaces take it (member rail, staff rail, mobile drawer). The
 * staff rail's old `bg-cream-100/40` was not a decision anyone made, and leaving
 * one of the three cream would have forced every shared row component
 * (RailLink, PresenceLink, AccountNavLink, CommunityNav, NavFooter) to carry two
 * palettes. "The mono menu stays" — one menu, one look.
 *
 * Every class below is a plain utility on a palette colour. Nothing uses the
 * bracket-opacity form (`/[0.92]`), which emitted NO RULE AT ALL on 2026-08-08
 * and left the surface as bare blur; percentage form is what emits. Each one is
 * grepped out of the built CSS — see docs/reports/TASK-ONEHEADER-REPORT.md.
 *
 * Reverting the surface is still a one-line swap, now to `bg-cream-100`, but the
 * row palette below has to come back with it. */
const NAV_PANEL = 'bg-cream-25';
/** default row: cream at reading weight; hover is desktop-only (`hover:hover`)
 *  so iOS's sticky post-tap `:hover` can never latch it on.
 *  UIO-003: `transition-colors duration-320 ease-glide` baked in here rather
 *  than left to each call site — several (NavFooter's App tour/Sign out) had
 *  no transition at all, and the rest had Tailwind's bare 150ms default,
 *  which read as instant rather than easing. Centralising it means every row
 *  that reads this constant is fixed at once and can't drift back out of
 *  step the way a per-site `transition-colors` did.
 *  UIO-013 ("try it, not a settled design" — owner): the fill is GONE.
 *  Hover no longer paints the row or swaps the text to cream — it puts a
 *  gold underline under the label. Text-decoration is inherited but painted
 *  per element's own content, and a flex icon is a replaced element with no
 *  glyphs to decorate, so putting `underline` on the row (rather than
 *  reaching into every label span individually) still lands only under the
 *  text — verified empirically (a Chrome screenshot of icon+label in a flex
 *  row with `underline` on the row), not assumed from the spec. `decoration-2`
 *  and `underline-offset-4` are Tailwind's own scale steps, not arbitrary
 *  values — see T1. */
/** NAVMOTION §A — THE HOVER FLICKER, and it was one class in the wrong half.
 *  Owner: "it renders a color dark first and then it lightens to gold so it
 *  looks like a flicker in a weird way still… The same mouseover flicker is
 *  seen on the mobile nav."
 *
 *  DIAGNOSIS VERIFIED, not assumed. Tailwind 3.4.17's `transition-colors`
 *  resolves to `color, background-color, border-color, text-decoration-color,
 *  fill, stroke` — read out of the installed package's own default theme, not
 *  from the docs. So `text-decoration-color` is in the transition. In the idle
 *  state below it was never declared, so it computed to its initial value,
 *  `currentcolor` — which here is `text-green-800`. On hover:
 *    - `text-decoration-line: underline` is NOT animatable. It snaps on in one
 *      frame, painted in whatever the decoration colour is at that instant:
 *      dark green.
 *    - `text-decoration-color` IS animatable and IS in the set, so it then eases
 *      green-800 -> gold-600 across the whole 320ms.
 *  A dark line that becomes gold. Exactly what the owner described.
 *
 *  THE FIX IS `decoration-gold-600` MOVED INTO THE IDLE HALF. The *line* is
 *  still what toggles — there is no underline until hover — but the colour it
 *  appears in is already correct, so there is nothing left to transition and no
 *  first frame to be wrong. Declaring a decoration colour with no decoration
 *  line paints nothing, so the idle row is visually unchanged.
 *
 *  What was deliberately NOT done, because both make it worse: shortening the
 *  duration (a faster flicker is still a flicker) and dropping
 *  `transition-colors` (it is doing real work for `text-green-800` and for
 *  NAV_ICON_IDLE). ONE constant serves the desktop rail AND the mobile drawer,
 *  so the mobile half of the complaint is fixed by this same edit. */
const NAV_ROW_IDLE = 'text-green-800 decoration-gold-600 transition-colors duration-320 ease-glide [@media(hover:hover)]:hover:underline [@media(hover:hover)]:hover:decoration-gold-600 [@media(hover:hover)]:hover:decoration-2 [@media(hover:hover)]:hover:underline-offset-4';
/** NAVMOTION §B — THE SELECTED STATE IS AN UNDERLINE, NOT A FILL.
 *  Owner: "what do you think about letting the underline be the indicator of the
 *  selected page in place of the color change? its a nice lightweight look and
 *  definitely classier than the big green fill, plus every page has a giant title
 *  on it that tells the user where they are." This supersedes UIO-013's
 *  resolution of this constant (the `bg-navfill/80` fill it left in place, and
 *  the whole search for a light-gold fill that could carry cream text — that
 *  question is now moot, there is no fill to solve for).
 *
 *  §B1 — SELECTED IS NOT IDENTICAL TO HOVER, or hovering an unselected row would
 *  make it look selected and hovering the selected row would show no response at
 *  all. It is the same idea one notch stronger, on the same two axes:
 *      hover     gold underline, decoration-2, weight unchanged
 *      selected  gold underline, decoration-4, font-medium, persistent
 *  `decoration-4` is the next step ON TAILWIND'S OWN SCALE (0/1/2/4/8) — T1: not
 *  an arbitrary value. The weight change is what survives a cursor parked on a
 *  neighbouring row. `underline-offset-4` is shared with hover deliberately, so
 *  the rule sits on one baseline and hovering a selected row thickens it in
 *  place instead of moving it.
 *
 *  §B2 — THE FILL AND THE INK ARE ONE DECISION, and this is the trap the order
 *  names. `text-cream-25` is #fdfcfa and NAV_PANEL is `bg-cream-25` — THE SAME
 *  COLOUR. The cream ink was legible only because the navfill block was painted
 *  behind it; removing the fill without moving the ink would have made every
 *  selected label and icon invisible on a near-white panel, at 1.0:1. So the ink
 *  comes back to the green family and goes one step DARKER than idle, which is
 *  how emphasis works on a light panel:
 *      idle label   green-800 (#143321) on cream-25   13.43:1
 *      selected     green-900 (#0d2118) on cream-25   16.41:1
 *  Both clear the 4.5:1 floor with room. (Both numbers are this repo's own
 *  recorded values for those pairs — see tailwind.config.js's cream-25 note and
 *  the group-heading note further down this file — recomputed here and matching.)
 *
 *  THE GOLD RULE ITSELF measures 2.66:1 against cream-25, which is below the
 *  3:1 non-text floor. That is stated rather than fixed, for two reasons: it is
 *  the identical gold-600-on-cream-25 pair the HOVER underline has carried since
 *  UIO-013 and is not introduced here, and selection is redundantly coded — the
 *  darker ink, `font-medium` and `aria-current="page"` all carry it, so the rule
 *  is not the sole means of conveying state. If the owner wants the rule itself
 *  to clear 3:1, `decoration-gold-800` measures 5.58:1 and is a one-token change
 *  in this constant — but it makes selected a different COLOUR from hover rather
 *  than a stronger version of it, which is the thing §B1 rules out. */
const NAV_ROW_ACTIVE = 'text-green-900 font-medium underline decoration-gold-600 decoration-4 underline-offset-4 transition-colors duration-320 ease-glide';
/** UIO-003, cause 1: this constant had no transition at all, so the icon's
 *  own colour snapped to `cream-25` on `group-hover` roughly 30ms into the
 *  row's 150ms fill transition — visible as a one-frame vanish, proven on
 *  the owner's own screen recording (`docs/reference/navhover-frames/`).
 *  CSS transitions are not inherited from the row; the icon needs its own.
 *  UIO-013: the `group-hover:text-cream-25` swap is gone with the fill it
 *  was contrasting against — "do not underline the icon" is explicit, and
 *  there is nothing else for the icon to do on hover now. It stays put. */
const NAV_ICON_IDLE = 'text-green-800/70 transition-colors duration-320 ease-glide';
/** §B2's other half — the icon moves WITH the fill, not after it. `text-cream-25`
 *  here was the same #fdfcfa-on-#fdfcfa hole the label was: legible only against
 *  the navfill block. The icon cannot take an underline ("do not underline the
 *  icon", and a flex SVG has no glyphs to decorate anyway), so its selected
 *  signal is TONE — it goes from 70% green-800 to full-strength green-900, which
 *  is the same direction the label moves and the largest step available without
 *  inventing a treatment:
 *      idle icon      green-800/70 -> renders #5a6f62 on cream-25   5.27:1
 *      selected icon  green-900               on cream-25          16.41:1
 *  Comfortably past the 3:1 floor for a non-text control, and a 3x luminance
 *  step against its own idle state.
 *  KNOWN CONSEQUENCE, flagged rather than papered over: in the COLLAPSED 56px
 *  staff rail a row is an icon and nothing else, so this tone step is the entire
 *  selected indicator there — the underline has no text to sit under. That rail
 *  is the one surface where the fill was doing work the underline cannot take
 *  over. See docs/reports/TASK-NAVMOTION-REPORT.md. */
const NAV_ICON_ACTIVE = 'text-green-900 transition-colors duration-320 ease-glide';

/* ── NAVMOTION §H3 — THE NAV'S LEFT ALIGNMENT LINE, IN ONE PLACE ──────────────
 * Owner, 2026-08-11: "lets add a bit more padding on the left side of the icons
 * so the button contents move right a bit. that will help with the reach and
 * balance out the extreme differential we see now where the right side has so
 * much whitespace and the left side has almost none."
 *
 * THIS SUPERSEDES UIO-016 ON TWO OF ITS FOUR PROHIBITIONS. That order solved the
 * same complaint SYMMETRICALLY — `<nav>` p-2 -> p-3, deliberately not touching
 * any row — on the reasoning that "changing the container rather than the rows
 * shifts both sides equally". Evenly is no longer what is wanted: the row spans
 * the full 216px of inner width and "Dashboard" leaves 100px+ of trailing space,
 * so a thin left margin sits against a wide right one. So UIO-016's "do not
 * change any individual row's px-3" and "do not touch the mobile drawer" are
 * BOTH overridden here. Its other two — do not change `w-60`, do not touch the
 * collapsed state's `justify-center` — still stand, and H4 below is the second.
 *
 * WHY ONE CONSTANT AND NOT NINE EDITS. Three different kinds of element sit on
 * this edge — the rows, the group headings, and CommunityNav's indented children
 * — and moving only the rows would drop every heading out of line with the
 * labels beneath it and leave every child's indent measured from an origin that
 * had moved. This is the same reason NAV_ROW_IDLE centralised its transition:
 * per-call-site copies drift back out of step.
 *
 * THE CHILD INDENT IS DERIVED, and it has to be written as a literal anyway:
 * Tailwind's content scanner reads source text, so a class assembled at runtime
 * emits no rule at all — T1's failure mode arriving by a different road. So the
 * arithmetic lives here in the comment and the result is a literal:
 *     row left   pl-5   20px   (icon starts 12px nav padding + 20px = 32px)
 *     row right  pr-3   12px   unchanged — the asymmetry IS the point
 *     child      pl-11  44px   = 20px origin + the 24px step pl-9 had over px-3
 * Both scale steps, neither arbitrary. They are one decision written twice; if
 * the inset moves, the child moves by the same amount in the same edit.
 *
 * §H4 — THE COLLAPSED RAIL IS EXEMPT AND THAT IS NOT OPTIONAL. `justify-center`
 * centres content in the CONTENT box, which only lands on the row's centre when
 * left and right padding are equal. In the 56px (`w-14`) strip a larger left
 * padding would push every icon right by half the difference — 4px — off a
 * centre line two separate comments in this file already record being brought
 * back onto. Every row that can collapse gates on its own `open`/`staffRailPinned`
 * and keeps symmetric `px-3` when it does. */
const NAV_INSET_L = 'pl-5';
const NAV_INSET_R = 'pr-3';
const NAV_INSET_ROW = `${NAV_INSET_L} ${NAV_INSET_R}`;
const NAV_INSET_CHILD = 'pl-11';
/** The collapsed 56px rail's symmetric padding — §H4. Named rather than inlined
 *  so the exemption is visible at every call site that takes it. */
const NAV_INSET_COLLAPSED = 'px-3';
/** group headings ("Management", "People", …) — the "section header" the owner
 *  named explicitly.
 *  UIO-012: this and its hover were both leftovers from the green-panel era
 *  (T5's family) — nobody chose them for a near-white panel. Rest was
 *  `/55`, measured at 3.78:1 against `#fdfcfa`, already below the 4.5 floor
 *  before anyone hovers; hover was cream text with no fill at all, which the
 *  row hover gained (`bg-navfill/64`, 4.55:1) when the panel went near-white
 *  but this heading never did — rendering `#f5f0e8` on `#fdfcfa`, 1.11:1,
 *  effectively invisible. Raised to `/70` (owner: still visibly quieter than
 *  the row labels, above the floor) — see the hover value at its own call
 *  site below, which goes darker, not lighter, on a light panel. */
const NAV_HEADING = 'text-green-900/70';
const NAV_DIVIDER = 'border-green-900/12';
/** badges: solid gold on green-950 ink. The old `bg-gold-600/70 text-white` was
 *  a translucent gold tuned for a light panel; over green-800 it muddies. */
const NAV_BADGE = 'bg-gold-500 text-green-950';

/* ── NAVMOTION §C / §F — THE DRAWER'S MOTION, AND THE TWO KNOBS ───────────────
 * Owner: "the mobile nav and the overlay that comes with it are not smooth, they
 * dont slide in from there respective sides and the effect is a jarring instant
 * appearance of both surfaces."
 *
 * THE ROOT CAUSE WAS NOT A MISSING TRANSITION — IT WAS THAT THERE WAS NOTHING TO
 * TRANSITION. The whole block was `{mobileNavOpen && ( … )}`: scrim and panel
 * were UNMOUNTED when closed. A CSS transition cannot run on an element that
 * does not exist at the start of it, and on close React removed the node before
 * any exit could play. Both directions were instant by construction.
 *
 * `duration-440` was declared in tailwind.config.js with the comment "440 for a
 * panel crossing the screen", and until this change it was used NOWHERE in
 * src/. It was written for this and the drawer shipped without it.
 *   panel in   duration-440 ease-glide      the declared panel length
 *   panel out  duration-320 ease-glide      a fast exit reads as responsive
 *   scrim      duration-320, fade, both ways
 * No new duration or easing token is introduced; all four are declared already.
 *
 * MOUNT-BEFORE-ANIMATE, UNMOUNT-AFTER-EXIT. The order allows either a
 * permanently-mounted panel or unmount-after-exit. Unmount is chosen for a
 * reason specific to this task: with no browser session to test in, it is the
 * only one of the two whose inertness claim is provable by READING — closed,
 * the drawer is not in the DOM, so "nothing inside it is reachable by Tab" is a
 * fact about the render tree rather than something that has to be observed.
 * It also disposes of §C0's off-canvas hazard outright: there is no parked panel
 * at rest to be scrolled to, focused, or announced.
 *
 * §C0's ARGUMENT STILL HOLDS AND IS RECORDED, because it is a second independent
 * reason the drawer belongs on the LEFT (§E) and it should not have to be
 * rediscovered: browsers do not create scrollable overflow toward the
 * inline-start edge, so content at negative x in an LTR document is unreachable
 * by scrolling, while the same panel parked on the RIGHT would extend the
 * document's scrollable width — which is TASK-FRAMESCROLL's bug arriving from
 * the other direction while that thread removes it. */
const DRAWER_ENTER = 'duration-440';
const DRAWER_EXIT = 'duration-320';
/** Must equal DRAWER_EXIT. The unmount is a JS timer, so the two are one value
 *  written twice — change them together or the panel disappears mid-slide. */
const DRAWER_EXIT_MS = 320;

/** §F — THE SCRIM: KEPT, LIGHTENED, FADED. Removal is a second look, not this
 *  one. Owner: "im curious to learn why the overlay is part of the ui… im open
 *  to trying it without the overlay to see how it looks unless there is a
 *  requirement for accessibility reasons that we cant get rid of it."
 *
 *  THE DIRECT ANSWER: no accessibility rule requires a scrim. WCAG mandates none
 *  and nothing forbids removing it. But it is doing four jobs here and only the
 *  fourth is decorative — it is the tap-outside-to-close target, it blocks taps
 *  reaching the page behind, it is the sighted equivalent of the
 *  `aria-modal="true"` this drawer declares, and it is the ONLY figure-ground
 *  separation between a `bg-cream-25` panel (#fdfcfa) and a cream page: those are
 *  ~1.0:1 apart, so without it the edge rests entirely on `shadow-xl`. This repo
 *  has already paid for that exact arithmetic once — app-header.css records a
 *  glass drawer tab that resolved to cream-on-cream and "a real user could not
 *  find the menu".
 *
 *  So the read is that the complaint was never that the scrim exists — it is
 *  that it APPEARED INSTANTLY AT 45%, which is §C's bug wearing a different hat.
 *  It now fades, and it is lightened one step short of the order's own expected
 *  landing: green-950 at 30%. `/30` is a built-in opacity step — T1, and this
 *  file's own history: `bg-navfill/64` and `border-green-900/12` each emitted NO
 *  RULE AT ALL until the step was declared.
 *
 *  TO SEE IT WITHOUT THE SCRIM, set this to 'bg-green-950/0' — one line, and the
 *  element stays, so tap-outside-to-close and the tap-blocking both survive the
 *  experiment. Do not delete the div. */
const SCRIM_TINT = 'bg-green-950/30';
/** §C2 — the owner asked to see the alternative, so it is one line to see.
 *  TRUE: the scrim FADES (the room dims). FALSE: it slides in from the left with
 *  the panel (the room travels).
 *  Built as a fade because a scrim is a full-viewport layer, so "sliding it in"
 *  is a wipe across the whole screen — it reads as a second panel arriving and
 *  pulls the eye off the nav that just opened, which is the opposite of what
 *  this task is for. Flip it, look, and keep whichever the owner prefers. */
const SCRIM_ENTERS_AS_FADE = true;

/** Unread-notification count for the Dashboard nav badge. Refreshes on mount and
 *  on every route change (the notifications themselves live on the dashboard now —
 *  there is no bell). */
function useUnreadCount(): number {
  const location = useLocation();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    myUnreadCount().then((n) => active && setCount(n)).catch(() => { /* stay quiet */ });
    return () => { active = false; };
  }, [location.pathname]);
  return count;
}

/** Open-inbound-work count for the Inbound nav badge (requests + support).
 *  Refreshes on mount and on every route change, same as useUnreadCount.
 *  Staff-only RPC — `enabled` gates the fetch so non-staff members (who never
 *  see the Inbound nav item) don't call it at all. */
function useInboundOpenCount(enabled: boolean): number {
  const location = useLocation();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    inboundOpenCount().then((n) => active && setCount(n)).catch(() => { /* stay quiet */ });
    return () => { active = false; };
  }, [location.pathname, enabled]);
  return count;
}

/** I2 — per-account presence for the five dynamic USER nav destinations
 *  (Orders, Documents, Stable, My Posts, Saved Content). One call on layout
 *  mount is enough per the locked design ("refresh on route change is NOT
 *  required — next mount picks it up"), unlike the two badge hooks above.
 *  `enabled` mirrors useInboundOpenCount's staff-only gate, inverted: only
 *  non-staff accounts ever see these links. A failed read just leaves every
 *  link hidden (same fallback as the other quiet-catch hooks here) — these
 *  are discoverability links, not a gate. */
function useNavPresence(enabled: boolean): NavPresence {
  const [presence, setPresence] = useState<NavPresence>({
    orders: false, documents: false, stable: false, posts: false, saved: false,
  });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    myNavPresence().then((p) => active && setPresence(p)).catch(() => { /* links just stay hidden */ });
    return () => { active = false; };
  }, [enabled]);
  return presence;
}

/**
 * APP SHELL — role-adaptive.
 *
 * Rider (USER): two surfaces only — Main (dashboard + community) and Account —
 * reached from the avatar menu. No side rail. The avatar menu also holds quick-
 * access shortcuts.
 *
 * Instructor (MANAGER/EMPLOYEE) and Admin (ADMIN): the same Main page, PLUS
 * management pages. Because there are more than two destinations, these two get a
 * PERSISTENT LEFT RAIL on desktop (management nav, always visible, Main included).
 * On mobile the rail collapses into the avatar menu. Instructor sees the servicing
 * subset; admin sees that plus the tenant-admin pages. Platform items
 * (modules/registry/organizations/provision) are SUPER_ADMIN-only.
 *
 * Header (all types): logo mark + wordmark (mark-only on mobile) → Main; universal
 * create "+"; calendar; avatar menu (notifications fold into the avatar badge).
 */

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  module?: string;
  adminOnly?: boolean;
  superAdmin?: boolean;
  /** Unread-style count shown on this item's badge (RailLink). Not part of the
   *  static nav tables — injected at render time (see AppLayout's navGroups). */
  badge?: number;
}

// `badge` surfaces an unread count on that nav link: 'notifications' (Dashboard) or
// 'messages' (Messages). "Community Feed" is its own nested group (below) and is
// position 1; these are the rest of the quick-access destinations.
const QUICK: { label: string; icon: typeof GraduationCap; to: string; end?: boolean; badge?: 'notifications' | 'messages' }[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/app/dashboard', badge: 'notifications' },
  { label: 'Calendar', icon: CalendarDays, to: '/app/calendar' },
  // The in-app catalog: shop services & book them (real purchase flow).
  { label: 'Catalog', icon: ShoppingBag, to: '/app/catalog' },
  { label: 'Messages', icon: MessageSquare, to: '/app/messages', badge: 'messages' },
];

/** I2 — Orders, Documents, Stable, My Posts, Saved Content: each is the
 *  page's real existing route (found in App.tsx, none invented) except
 *  Stable and Saved, which only exist as Account-page sections — those use
 *  the `?section=` pattern A11 added. `section` marks that case so active-
 *  state matching (PresenceLink, below) can disambiguate two `/app/account`
 *  links from each other, which NavLink's own pathname-only matching can't
 *  do. Icons match what AccountHub's own Row already uses for that same
 *  destination, for visual continuity between the nav and the Account page. */
const PRESENCE_LINKS: { key: keyof NavPresence; label: string; icon: typeof ShoppingBag; to: string; section?: string }[] = [
  { key: 'orders', label: 'My Orders', icon: ReceiptText, to: '/app/orders' },
  { key: 'documents', label: 'My Documents', icon: FileText, to: '/app/documents' },
  /* D2 resolved: /app/stable shipped with ACCOUNTSURFACE, so this points at the
     real route. `section` MUST be dropped alongside it — isActive falls back to
     a pathname match only when `section` is absent (see PresenceLink), so
     leaving it would mean My Stable never highlights as active. */
  { key: 'stable', label: 'My Stable', icon: Boxes, to: '/app/stable' },
  { key: 'posts', label: 'My Posts', icon: Grid3x3, to: '/app/my-posts' },
  { key: 'saved', label: 'My Saved Items', icon: Bookmark, to: '/app/account?section=saved', section: 'saved' },
];

/** The community-feed views, as nested nav links. Each filters the one feed
 *  (/app?filter=…). The 'all' view is NOT a sublink — the parent "Community Feed"
 *  link IS the full view; the sublinks are the specific filters. The selected view
 *  highlights (not the parent), matching the page header. "Shop for sale" is simply
 *  the For Sale view, so it lives here too instead of as a top-level shortcut. */
const COMMUNITY_VIEWS: { key: FeedView; label: string }[] =
  FEED_VIEWS.map((v) => ({ key: v.key, label: FEED_VIEW_META[v.key].navLabel }));

function communityHref(key: FeedView): string {
  return key === 'all' ? '/app' : `/app?filter=${key}`;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
  /** One line under the heading. Added for the REVIEW group, which has to say
   *  what sitting in it MEANS (see REVIEW_NOTE) — no other group uses it, and
   *  it renders nothing when absent. */
  note?: string;
}

/** ROLE ARCHITECTURE (owner spec):
 *  SUPER_ADMIN — the PLATFORM admin; belongs to no tenant. Sees platform
 *    management only (organizations, provisioning, flags, registry).
 *  ADMIN — the tenant admin. Grouped management sections (short nav, similar
 *    surfaces consolidated), incl. control of what instructors see.
 *  INSTRUCTOR (MANAGER/EMPLOYEE) — below admin, above client. Baseline =
 *    client support + servicing (intake review/processing, invitations via
 *    Accounts when granted, contacts, lessons, availability, horses,
 *    engagements, documents) + whatever the admin grants (globally or to the
 *    one account). */
const PLATFORM_NAV: NavItem[] = [
  { to: '/app/ops/superadmin/organizations', label: 'Organizations', icon: Shield },
  { to: '/app/ops/admin/modules', label: 'Feature flags', icon: Shield },
  { to: '/app/ops/admin/registry', label: 'Registry', icon: Shield },
];

/* FRONT DESK was eliminated 2026-07-31 (owner). It mixed two different kinds of
 * thing: WORK queues (Inbound, Support) and a list of PEOPLE (Leads). Leads
 * belongs with the other person-lists; the queues belong with the rest of the
 * day-to-day management surfaces. */
/* ICONS — docs/reference/nav-icon-exercise.md, settled by the owner 2026-08-08.
 * Applied here ONLY for pages that survive that document's proposed merges under
 * their own name; the merges themselves are not implemented, and the doc is
 * explicit that most of the assignment cannot land until they exist. What was
 * and was not applied is listed in docs/reports/TASK-ONEHEADER-REPORT.md.
 * Lessons and Horse care are the two custom marks and stay blocked on artwork. */
const MANAGEMENT_GROUP: NavItem[] = [
  /* UIO-012 item 2, nav half only: Inbound removed from view here (route
   *  still builds, hidden not deleted — commit 86a2c33's standing rule).
   *  Dashboard moves in from the App pages group, since it was staff's own
   *  management dashboard filed in the wrong section, not a community page.
   *  The content merge (Inbound's booking/support queue folded into the
   *  Dashboard's layout as entries) is its own task — not scoped to this
   *  file, and not attempted here. */
  /* RESTORED 2026-08-15 (owner: "put back all the pages in the nav where they
     belong… claire is flipping out she cant use the app") — the TASK-REVIEWNAV
     experiment ends; the duplicate-page ruling now lives in TASK-PAGEMERGE.
     Dashboard's badge is injected by route below, not by table position. */
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  // Moved up from its own "People" heading (owner, 2026-08-15) — Records
  // (the People/Clients/Partners/Vendors/Horses tabs page) now sits directly
  // in Management; the People group is gone, not hidden — it had no other
  // member (ACCOUNTS_GROUP below is kept, empty, for anything that lands
  // there later; manageNavGroups() drops empty groups already).
  //
  // The standalone Horses row that used to sit right below this one is
  // retired (owner, same session: "we dont need horses as its own page if
  // we have horses on the records page") — Records' own Horses tab, one
  // click away, is the only entry point now.
  { to: '/app/records', label: 'Records', icon: BookOpen },
  { to: '/app/ops/support', label: 'Support', icon: LifeBuoy },
  // Lessons, Documents, Deals RETIRED from here 2026-08-15 (owner: "lessons…
  // is really a records ledger so it should be added to the records page
  // along with documents, files, and deals") — each is a ledger of records,
  // not a work queue, so they moved to be Records tabs instead (in that
  // order, after Horses). Management keeps the actual day-to-day queues.
  // Payment review is a management task; Business is hidden until the reporting
  // and business-ops surfaces that belong there actually exist.
  /* Receipt, not ReceiptText — which My Orders already uses in the member nav.
     Two different pages were wearing one glyph. */
  { to: '/app/ops/payments/review', label: 'Payment review', icon: Receipt },
];
/* PEOPLE (and horses). TASK-RECORDS (2026-08-12) folded what used to be four
 * separate nav rows — Leads, Clients, Contacts (already gone), Directory —
 * plus Horses into ONE row, Records, whose five internal tabs carry the
 * distinctions this comment used to describe: Leads / Clients / Partners /
 * Vendors / Horses. Team is still not here — "that is a business
 * configuration activity" (owner) — it lives in Settings.
 *
 * MOVED 2026-08-15 (owner): Records relocated into MANAGEMENT_GROUP, directly
 * above Horses — a standalone "People" heading for one row was overhead. This
 * group is kept, empty, as the landing spot if anything else joins it;
 * manageNavGroups() already drops empty groups from the rendered rail. */
const ACCOUNTS_GROUP: NavItem[] = [];
/* SERVICING and BUSINESS were folded into Management 2026-07-31 (owner): the
 * goal is fewer headings, not more. Their items live in MANAGEMENT_GROUP above.
 * BUSINESS_GROUP returns when there is more in it than a single link. */
const COMMUNITY_GROUP: NavItem[] = [
  { to: '/app/ops/activity', label: 'Activity', icon: Activity },
  { to: '/app/ops/evaluations', label: 'Evaluations', icon: FileText },
  { to: '/app/ops/moderation', label: 'Moderation', icon: Shield },
  { to: '/app/ops/lookups', label: 'Field options', icon: ListChecks },
  // Library, not BookOpen — Directory (People) already holds BookOpen.
  { to: '/app/ops/content', label: 'Content store', icon: Library },
  /* Eye, not Shield. Shield was on Moderation, Oversight, all three Settings
     pages and all three Platform pages — the "eight identical Shield icons" the
     icon exercise names. This takes one of them off it. */
  { to: '/app/ops/oversight', label: 'Oversight', icon: Eye },
];
const MODULES_GROUP: NavItem[] = [
  // Brokerage has no staff hub page yet (mod.brokerage's live surfaces are the
  // client-lane engagement reads) — the entry linked to an unregistered route
  // and 404'd for every staff user with the module on. Re-add with the hub.
  { to: '/app/ops/boarding', label: 'Boarding', icon: HomeIcon, module: 'mod.boarding' },
  { to: '/app/ops/barnops', label: 'Barn Ops', icon: Boxes, module: 'mod.barnops' },
  /* REMOVED 2026-08-15 (TASK-PAGEMERGE, same session as the RESTORED note this
     replaces) — this row and MANAGEMENT_GROUP's "Records" row above were two
     nav entries reading "Records" at once (module-gated here, unconditional
     above), landing on two different pages: this one was RecordsHubPage's own
     roster, a THIRD listing of the same horses the Records page's Horses tab
     already shows. Not a re-add of a retired row (rule 5) — the concept this
     row pointed at no longer has a page of its own; RecordsHubPage is retired
     (RECORDS_HUB_RETIRED) and /app/ops/records now redirects into Records.
     Its two unique lane links (Ownership, Health) moved to the Horses tab's
     per-record "Records" row — see HorseRecordsPage.tsx. */
  { to: '/app/ops/employees', label: 'Employees', icon: Contact, module: 'mod.employees' },
];
const SETTINGS_GROUP: NavItem[] = [
  /* Owner, 2026-08-12: "team moves to configuration section." Arrived here from
     MANAGEMENT_GROUP.

     It also takes a NEW ICON, and that is not cosmetic: Team carried `Contact`,
     which the same day's X-1 change gave to Clients — so the two sat in the nav
     as the same glyph. `UserRound` is unused anywhere in this nav. Deliberately
     NOT another `Shield`: this group already renders three identical ones, which
     the icon exercise named as a defect ("eight identical Shield icons").

     NOTE: this group still renders under the heading "Settings" (see navGroups
     below). The owner has asked for it to become "Configuration" — that rename
     is still unclaimed; D12 (2026-08-12) already settled the one-engine-vs-two
     ruling this comment used to say TASK-TEMPLATES was blocked on, so nothing
     blocks it now.

     NO `adminOnly`, deliberately, even though every sibling here has it:
     App.tsx routes `ops/team` behind `requireStaff`, not `requireAdmin`.
     Gating the nav entry tighter than the route would hide the page from
     MANAGER/EMPLOYEE staff who can still reach it by URL — a nav that lies
     about what you have. Move the entry, don't change who can see it.

     RESTORED 2026-08-15 (Review experiment ended) — WITHOUT `adminOnly`, for
     the reason recorded above. */
  { to: '/app/ops/team', label: 'Team', icon: UserRound },
  { to: '/app/ops/admin/branding', label: 'Branding', icon: Shield, adminOnly: true },
  { to: '/app/ops/admin/products', label: 'Products', icon: Shield, adminOnly: true },
  { to: '/app/ops/admin/forms', label: 'Forms', icon: Shield, adminOnly: true },
  /* TASK-PAGEMERGE (2026-08-15): AdminTemplatesPage (TASK-TEXTEDIT) had no
     permanent nav row — it only ever had one in the Review section, and
     ab45b18 removed Review's nav group same-day, leaving the page reachable
     by URL only. Placed here per reviewSection.ts's own note, written when
     the page was built: "on acceptance its nav row belongs in SETTINGS_GROUP
     beside Forms." NotebookPen, not another Shield — this group already has
     three identical Shield glyphs (the icon exercise's named defect). */
  { to: '/app/ops/admin/templates', label: 'Templates', icon: NotebookPen, adminOnly: true },
];

// kept for compatibility with anything importing MANAGE_NAV
export const MANAGE_NAV: NavItem[] = [
  ...MANAGEMENT_GROUP, ...ACCOUNTS_GROUP,
  ...COMMUNITY_GROUP, ...MODULES_GROUP, ...SETTINGS_GROUP,
];

/** Build the grouped rail for the caller's role. Instructor grants (nav keys)
 *  un-hide adminOnly items for that instructor. */
export function manageNavGroups(
  hasModule: (key: string) => boolean,
  isAdmin: boolean,
  isSuperAdmin: boolean,
  grantKeys: string[] = [],
): NavGroup[] {
  if (isSuperAdmin) {
    // the platform admin belongs to no tenant — platform surfaces only
    return [{ key: 'platform', label: 'Platform', items: PLATFORM_NAV, defaultOpen: true }];
  }
  const visible = (items: NavItem[]) => items.filter(
    (i) => (!i.module || hasModule(i.module))
        && (!i.adminOnly || isAdmin || grantKeys.includes(i.to)),
  );
  const groups: NavGroup[] = [
    /* MANAGEMENT leads: the two work QUEUES that must be dealt with each day.
       They sat under a separate "Front desk" heading alongside Leads — a list of
       people — which put a queue and a roster under one label. Front desk is
       gone; the queues live here and Leads moved to People. */
    { key: 'management', label: 'Management', items: visible(MANAGEMENT_GROUP), defaultOpen: true },
    { key: 'accounts', label: 'People', items: visible(ACCOUNTS_GROUP), defaultOpen: true },
    { key: 'community', label: 'Community', items: visible(COMMUNITY_GROUP) },
    /* Settings and Modules stay in THIS array and are filtered out of the
       SIDEBAR at the render site below — they are not nav rows any more (owner
       2026-08-15: "modules and settings should all be inside of the account
       page", then on finding them still there: "the settings and modules
       sections are still in the nav and they still show pages").

       They cannot simply be deleted here: /app/ops/settings and /app/ops/modules
       render their own contents by calling this same manageNavGroups() and
       looking themselves up BY KEY (NavGroupCardsPage:35, App.tsx:425-429).
       Removing the entries would blank both pages — the destination and the
       discarded nav row are fed by one source, deliberately, "so this can never
       drift from what the nav shows". */
    { key: 'settings', label: 'Settings', items: visible(SETTINGS_GROUP) },
    { key: 'modules', label: 'Modules', items: visible(MODULES_GROUP) },
    /* REVIEW SECTION removed 2026-08-15 (owner: "the menu fixed… back to
       normal") — every moved row restored to its home above, per each removal
       note. The review PAGES and routes survive (reviewSection.ts, /app/ops/
       review) for TASK-PAGEMERGE to compare implementations; only the nav
       group is gone. */
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** C4 — delayed hover/focus label for icon-only rail rows, replacing the old
 *  native `title=` (uncontrollable delay). `ExplainTip` (TASK-TIPTAP) was
 *  evaluated first per the task doc and rejected: it fires on hover with NO
 *  delay, adds click-to-pin state + `role="button"` + a dotted-underline cue
 *  meant for inline prose explanations, and wraps its own trigger — all wrong
 *  for a row that is already its own NavLink/button and just needs a plain
 *  label that shows late. Pure CSS instead: `transition-delay` only applies
 *  via the `group-hover`/`group-focus-visible` variant, so it shows slow and
 *  (with no delay class on the plain `transition-opacity`) hides fast by
 *  construction — no JS state, no third stateful tooltip mechanism. Caller
 *  must put `group relative` on the row. */
/**
 * E4 — collapsed-rail tooltip, rendered in a PORTAL.
 *
 * It used to be an absolutely-positioned sibling at `left-full`, i.e. deliberately
 * outside the rail — but both rails carry `overflow-x-hidden`, which CLIPPED it.
 * After the 1100ms delay the tooltip did appear, got cut off at the rail's edge,
 * and all that survived was a sliver of its `bg-green-950` background. That is the
 * "weird green marking on the nav rail" the owner reported.
 *
 * A portal is required rather than `position: fixed`: the member rail's surface
 * uses `backdrop-blur`, and a backdrop-filter creates a containing block, so a
 * fixed child would still be trapped. Rendering into <body> escapes both the
 * clip and the containing block.
 *
 * Position is measured from the trigger on hover/focus rather than assumed, so it
 * stays correct at any rail width and in either rail.
 */
function NavTooltipLabel({ label }: { label: string }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback(() => {
    // The 1100ms dwell the owner specified — deliberate, not accidental hover.
    timer.current = window.setTimeout(() => {
      const host = anchorRef.current?.parentElement;
      if (!host) return;
      const r = host.getBoundingClientRect();
      setPos({ top: r.top + r.height / 2, left: r.right + 8 });
    }, 1100);
  }, []);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setPos(null);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const host = anchorRef.current?.parentElement;
    if (!host) return;
    host.addEventListener('mouseenter', show);
    host.addEventListener('mouseleave', hide);
    host.addEventListener('focus', show);
    host.addEventListener('blur', hide);
    return () => {
      host.removeEventListener('mouseenter', show);
      host.removeEventListener('mouseleave', hide);
      host.removeEventListener('focus', show);
      host.removeEventListener('blur', hide);
    };
  }, [show, hide]);

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden="true" />
      {pos && createPortal(
        <span
          role="tooltip"
          style={{ top: pos.top, left: pos.left }}
          className="pointer-events-none fixed -translate-y-1/2 z-[100] whitespace-nowrap rounded-md bg-green-950 text-cream-50 text-xs font-sans px-2 py-1 shadow-lg"
        >
          {label}
        </span>,
        document.body,
      )}
    </>
  );
}

/** Nav state colours. C5b (owner 2026-08-07) put a solid `green-800` fill on the
 *  SELECTED row and left the default row in secondary green; ONEHEADER §1 makes
 *  the PANEL green-800, so the selected fill would now be the panel itself and
 *  the default row would be dark-on-dark. The whole palette inverts — see
 *  NAV_ROW_IDLE / NAV_ROW_ACTIVE / NAV_ICON_* at the top of this file. C5b's
 *  actual rules survive intact: one palette for icon-only and full-width alike,
 *  hover desktop-only, selected carries its own icon colour. Applied identically
 *  here, in `PresenceLink`, `AccountNavLink`, `NavFooter` and both `CommunityNav`
 *  rows — no component keeps the old treatment.
 *
 *  `focus-ring` rather than `focus-ring`: the two differ only in their ring
 *  OFFSET colour, and `focus-ring`'s is `cream` — a cream halo drawn on a cream
 *  page, which is what it was for. On the green panel the offset has to be the
 *  panel, which is exactly what `focus-ring` (ring-offset-green-800) is. */
function RailLink({ to, label, icon: Icon, end, badge = 0, open = true }: NavItem & { badge?: number; open?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={open ? undefined : label}
      className={({ isActive }) =>
        /* §H3/§H4: the asymmetric inset when the row has a label to push right;
           symmetric `px-3` the moment it collapses to an icon, or every icon in
           the 56px strip slides 4px off the shared centre line. */
        `group relative flex items-center gap-3 ${open ? NAV_INSET_ROW : NAV_INSET_COLLAPSED} py-2.5 rounded-lg text-[13.5px] font-sans transition-colors focus-ring ${open ? '' : 'justify-center'} ${
          isActive ? NAV_ROW_ACTIVE : NAV_ROW_IDLE
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative shrink-0">
            <Icon size={17} aria-hidden="true" className={isActive ? NAV_ICON_ACTIVE : NAV_ICON_IDLE} />
            {badge > 0 && !open && (
              <span className={`absolute -top-1.5 -right-1.5 min-w-[1rem] h-4 px-1 ${NAV_BADGE} [@media(hover:hover)]:group-hover:bg-cream-25 text-[10px] leading-4 text-center rounded-full`}>{badge > 9 ? '9+' : badge}</span>
            )}
          </span>
          {open && <span className="flex-1">{label}</span>}
          {/* UIO-013 blended the badge into `cream-25` on hover so the gold
              underline is the only accent under the cursor, and scoped that to
              `!isActive` for a reason it recorded: a selected row still carried
              the dark navfill block, where a cream badge would have vanished.
              §B removes that block, so the recorded reason is gone and the
              exclusion goes with it — selected and idle rows now behave the same
              under the cursor, which is what the exclusion was working around
              rather than choosing. */}
          {badge > 0 && open && (
            <span className={`min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full ${NAV_BADGE} [@media(hover:hover)]:group-hover:bg-cream-25`}>{badge > 9 ? '9+' : badge}</span>
          )}
          {!open && <NavTooltipLabel label={label} />}
        </>
      )}
    </NavLink>
  );
}

function MenuLink({ to, label, icon: Icon, end, onNavigate }: NavItem & { onNavigate: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 text-sm font-sans transition-colors focus-ring ${
          isActive ? 'bg-cream-200 text-green-800 font-medium ' : 'text-secondary [@media(hover:hover)]:hover:bg-navfill/64 [@media(hover:hover)]:hover:text-cream-100'
        }`
      }
    >
      <Icon size={17} aria-hidden="true" />
      {label}
    </NavLink>
  );
}

/** I2 — renders one of PRESENCE_LINKS. Active-state matching is done here
 *  (not delegated to NavLink) because Stable and Saved both point at
 *  `/app/account` with a different `?section=` each — NavLink only compares
 *  pathname, so it would show BOTH as "selected" together on that page.
 *  `section`-less links (Orders, Documents, My Posts) are plain distinct
 *  routes, so a pathname check is exact for them too. */
function PresenceLink({ to, label, icon: Icon, section, onNavigate }: {
  to: string; label: string; icon: typeof ShoppingBag; section?: string; onNavigate?: () => void;
}) {
  const location = useLocation();
  const accountSection = useActiveAccountSection();
  const isActive = section ? accountSection === section : location.pathname === to;
  return (
    <Link to={to} onClick={onNavigate} aria-current={isActive ? 'page' : undefined}
      /* §H3: this row only ever renders expanded (the rail and the drawer), so
         it takes the inset unconditionally — there is no collapsed form of it to
         exempt. */
      className={`group flex items-center gap-3 rounded-lg ${NAV_INSET_ROW} py-2.5 text-[13.5px] font-sans transition-colors focus-ring ${
        isActive ? NAV_ROW_ACTIVE : NAV_ROW_IDLE}`}>
      <Icon size={18} aria-hidden="true" className={isActive ? NAV_ICON_ACTIVE : NAV_ICON_IDLE} />
      <span className="whitespace-nowrap flex-1">{label}</span>
    </Link>
  );
}

/** I6 — canonical-order "Account" link. Active only on the bare /app/account
 *  view (no `?section=`), so it doesn't co-highlight with My Stable, which
 *  shares the same pathname via `?section=stable`. Styled to match
 *  RailLink/PresenceLink's active-state convention (I4's cream-200 + gold
 *  icon). */
function AccountNavLink({ onNavigate, open = true }: { onNavigate?: () => void; open?: boolean }) {
  const location = useLocation();
  const accountSection = useActiveAccountSection();
  const isActive = location.pathname === '/app/account' && accountSection == null;
  return (
    <Link to="/app/account" onClick={onNavigate} aria-current={isActive ? 'page' : undefined}
      aria-label={open ? undefined : 'Account'}
      /* §H3/§H4 — same gate as RailLink: inset expanded, symmetric collapsed. */
      className={`group relative flex items-center gap-3 rounded-lg ${open ? NAV_INSET_ROW : NAV_INSET_COLLAPSED} py-2.5 text-[13.5px] font-sans transition-colors focus-ring ${open ? '' : 'justify-center'} ${
        isActive ? NAV_ROW_ACTIVE : NAV_ROW_IDLE}`}>
      {/* `shrink-0` — see the note in CommunityNav's collapsed branch. Without it
          the collapsed rail squashes this icon to the ~8px of content box left
          after the nav's and the link's horizontal padding. */}
      <UserRound size={18} aria-hidden="true" className={`shrink-0 ${isActive ? NAV_ICON_ACTIVE : NAV_ICON_IDLE}`} />
      {open && <span className="whitespace-nowrap flex-1">Account</span>}
      {!open && <NavTooltipLabel label="Account" />}
    </Link>
  );
}

/** Which community-feed view the current location represents (null when not on the
 *  feed at all). On /app the active view is the `?filter=` value, or 'all'. */
function useActiveCommunityView(): FeedView | null {
  const location = useLocation();
  const [params] = useSearchParams();
  if (location.pathname !== '/app') return null;
  const f = params.get('filter');
  return f && FEED_VIEWS.some((v) => v.key === f) ? (f as FeedView) : 'all';
}

/** I2 — which Account-page section (if any) the current location represents,
 *  null off /app/account. Same shape as useActiveCommunityView's `?filter=`
 *  matching, for the `?section=` links (see PresenceLink). */
function useActiveAccountSection(): string | null {
  const location = useLocation();
  const [params] = useSearchParams();
  if (location.pathname !== '/app/account') return null;
  return params.get('section');
}

/** COMMUNITY FEED nav group — a parent header + its views nested as indented links.
 *  Each view filters the one feed; the SELECTED view highlights (not the parent),
 *  and the page header changes to match. The parent is COLLAPSIBLE: a chevron shows/
 *  hides the sublinks (persisted); it auto-expands while you're on the feed so the
 *  active view stays visible. `open` collapses labels in the rail strip.
 *  `onNavigate` closes the mobile menu. */
/*  §H3: `indentClass` and `rowInsetClass` both default to the nav's shared
 *  alignment constants, so the rail and the drawer pick them up without any call
 *  site restating them. `rowInsetClass` is NEW and exists for exactly one
 *  reason: this component also renders inside the desktop avatar dropdown
 *  (`accountMenu`), which §H3 puts explicitly out of scope — "a separate
 *  floating surface with its own metrics, not the nav's left edge". Those two
 *  call sites pass the old symmetric values so that surface renders
 *  byte-identically to before; inside its `px-1` wrapper `px-3` lands its rows
 *  at 16px, exactly on the `px-4` line its sibling MenuLinks sit on. Taking the
 *  nav's 20px inset there would have silently knocked this row 8px out of line
 *  with the menu around it. */
function CommunityNav({ open = true, onNavigate, indentClass = NAV_INSET_CHILD, rowInsetClass = NAV_INSET_ROW }: {
  open?: boolean; onNavigate?: () => void; indentClass?: string; rowInsetClass?: string;
}) {
  const active = useActiveCommunityView();
  // The parent IS the "All" view: it's highlighted (solid) on the full feed, and a
  // specific-filter sublink owns the highlight when one is selected. No "All posts"
  // sublink — clicking "Community Feed" (or the browser Back) returns to the full view.
  const isAll = active === 'all';
  const onFeed = active !== null;
  // collapse state for the sublinks (persisted, toggle-controlled). Default expanded.
  const [expanded, setExpanded] = useState(() => localStorage.getItem('communityNav.expanded') !== '0');
  useEffect(() => { localStorage.setItem('communityNav.expanded', expanded ? '1' : '0'); }, [expanded]);

  if (!open) {
    // I1B — staff rail icon strip: just the parent icon, active whenever on the feed.
    return (
      <Link to="/app" onClick={onNavigate} aria-label="Community Feed" aria-current={onFeed ? 'page' : undefined}
        /* §H4: this branch IS the collapsed 56px strip — symmetric `px-3`, and
           it is the one row that says so by construction rather than by gate. */
        className={`group relative flex items-center justify-center rounded-lg ${NAV_INSET_COLLAPSED} py-2.5 focus-ring ${onFeed ? NAV_ROW_ACTIVE : NAV_ROW_IDLE}`}>
        {/* `shrink-0` is REQUIRED, not decorative. In the 56px collapsed rail the
            nav's p-3 plus this link's px-3 leave ~8px of content box, and without
            flex-shrink:0 the SVG is compressed to fit — which is why this icon and
            the account one rendered miniature while every RailLink icon (wrapped in
            a shrink-0 span) stayed 18px. */}
        <Users size={18} className={`shrink-0 ${onFeed ? NAV_ICON_ACTIVE : NAV_ICON_IDLE}`} />
        <NavTooltipLabel label="Community Feed" />
      </Link>
    );
  }

  return (
    <div>
      {/* parent row — the label links to the full feed (= All) and highlights when
          it's the active view; the toggle shows/hides the sublinks. I5: down arrow +
          "show" when collapsed, up arrow + "hide" when expanded — replaces the old
          right-pointing (rotated ChevronDown) collapsed state. C5 (owner, 2026-08-07):
          the toggle's chevron/label were 15px/10px against 17-18px/13.5px everywhere
          else in the rail — brought up to the same scale. */}
      {/* Owner, 2026-08-09: the SELECTED pill was `bg-cream-100` — the header
          fill again, sitting on the cream-25 panel, so the highlight barely
          registered AND it was the inverse of NAV_ROW_ACTIVE, which this row's
          own sublinks use. Selecting the parent and selecting a child looked
          like two different design systems. The pill is now the shared
          `bg-navfill/80`; because the row splits its background (this div) from
          its ink (the Link and the toggle below), NAV_ROW_ACTIVE is applied in
          those two halves rather than as one class. */}
      {/* UIO-013: the idle branch's hover fill is gone — the "Community Feed"
          Link below carries a group-hover underline instead. `group` stays on
          this div because that underline is still triggered by hovering
          anywhere in the row, toggle button included, matching how the fill
          covered the same area before.
          NAVMOTION §B: the SELECTED pill (`bg-navfill/80`) is gone too. This row
          splits its background from its ink — the fill lived here, the ink on
          the Link and the toggle below — which is exactly why §B2's trap has two
          halves in this component and not one. With the fill removed the whole
          selected treatment moves to the two ink halves; nothing paints here. */}
      <div className="group relative flex items-center rounded-lg pr-1 transition-colors duration-320 ease-glide">
        {/* Owner, 2026-08-09: the idle label was `text-cream-100/80` — a palette
            left over from when NAV_PANEL was green. The panel is now cream-25
            (#fdfcfa) and cream-100 (#f5f0e8) is literally the HEADER fill, so
            this row's text was rendering header-colour ink on a near-white
            panel: invisible. Idle now uses the same green ink as NAV_ROW_IDLE,
            which every other row in the rail already had. */}
        {/* §A, SECOND COPY: the same missing idle decoration colour as
            NAV_ROW_IDLE, in the group-hover form. `decoration-gold-600` added to
            the idle half here too — without it this row flickers dark-to-gold
            exactly like the others, and it is the row at the top of every nav
            surface in the app.
            §B2: the selected half was `text-cream-25 font-medium` — #fdfcfa ink
            that was legible only against the pill removed on the line above. It
            takes the shared NAV_ROW_ACTIVE now, so this row and every RailLink
            mark selection the same way instead of two systems. */}
        <Link to="/app" onClick={onNavigate} aria-current={isAll ? 'page' : undefined}
          className={`flex items-center gap-3 flex-1 min-w-0 ${rowInsetClass} py-2.5 text-[13.5px] font-sans focus-ring rounded-lg transition-colors duration-320 ease-glide ${isAll ? NAV_ROW_ACTIVE : 'text-green-800 decoration-gold-600 [@media(hover:hover)]:group-hover:underline [@media(hover:hover)]:group-hover:decoration-gold-600 [@media(hover:hover)]:group-hover:decoration-2 [@media(hover:hover)]:group-hover:underline-offset-4'}`}>
          <Users size={18} className={`shrink-0 ${isAll ? NAV_ICON_ACTIVE : NAV_ICON_IDLE}`} />
          <span className="whitespace-nowrap">Community Feed</span>
        </Link>
        <button type="button" onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse community views' : 'Expand community views'}
          aria-expanded={expanded}
          /* Owner, 2026-08-08: icon only. The "show"/"hide" word crowded the row —
             it competed with the "Community Feed" label for a rail that is only
             240px wide, and on the selected (dark) state it read as a second
             element sitting on the pill. The chevron already carries the meaning;
             the accessible name lives on aria-label. */
          /* Owner, 2026-08-09: both halves of the old ONEHEADER §1 note here are
             now dead — the panel is no longer green (so an idle cream mark
             vanished, like the label did) and the selected pill is no longer
             cream (so green ink on it would vanish in turn). Selected is cream
             ink on the navfill pill, matching NAV_ICON_ACTIVE; idle is green,
             matching NAV_ICON_IDLE. The selected hover tint inverts with the
             pill: a light wash on dark, where it was a dark wash on light. */
          /* UIO-003, cause 2 (historical): this button's own `hover:bg-navfill/64`
             used to stack with the parent div's identical fill above —
             hovering the toggle painted both layers (1 - 0.36² = 87%
             effective, against 64% everywhere else). Fixed by moving the fill
             to the parent only.
             UIO-013: that parent fill is gone entirely now, and this is an
             icon-only control with no text to underline — "do not underline
             the icon" — so its idle branch gets no hover treatment at all. */
          /* NAVMOTION §B2, the trap's THIRD location and the easiest to miss —
             this control's selected branch was `text-cream-25` too, a cream
             chevron that was only ever visible because the navfill pill was
             behind it. With the pill gone it would have been #fdfcfa on #fdfcfa:
             the toggle would have vanished from the selected row while staying
             perfectly visible on every unselected one.
             It takes green ink at the same strength the label does. The paired
             `hover:bg-cream-25/10` goes with it rather than being re-tuned: it
             was a LIGHT wash designed to read on a DARK pill, so on the panel it
             would be cream-on-cream too — and the idle branch beside it carries
             no hover treatment at all (UIO-013: "do not underline the icon", and
             nothing else was chosen for it). Removing it makes the two branches
             agree instead of inventing a fill nobody asked for. */
          className={`shrink-0 flex items-center justify-center p-1.5 rounded-md focus-ring transition-colors duration-320 ease-glide ${isAll ? 'text-green-900' : 'text-green-800/70'}`}>
          {expanded
            ? <ChevronUp size={18} className="shrink-0 transition-colors duration-320 ease-glide" />
            : <ChevronDown size={18} className="shrink-0 transition-colors duration-320 ease-glide" />}
        </button>
      </div>
      {/* nested views (specific filters only) — the selected one highlights */}
      {expanded && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {COMMUNITY_VIEWS.filter((v) => v.key !== 'all').map((v) => {
            const isActive = active === v.key;
            return (
              <Link key={v.key} to={communityHref(v.key)} onClick={onNavigate} aria-current={isActive ? 'page' : undefined}
                /* §H3 — the indented children. `indentClass` now defaults to the
                   DERIVED child inset (44px = the row's new 20px origin + the
                   24px step it always had over px-3), so the step reads the same
                   as it did from an origin that has moved. */
                className={`group flex items-center ${indentClass} ${NAV_INSET_R} py-1.5 rounded-lg text-[13px] font-sans transition-colors focus-ring ${
                  isActive ? NAV_ROW_ACTIVE : NAV_ROW_IDLE}`}>
                <span className="whitespace-nowrap">{v.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Unread DM total for the Messages nav badge. Refreshes on mount + route change. */
function useDmUnread(): number {
  const location = useLocation();
  const [n, setN] = useState(0);
  useEffect(() => {
    let active = true;
    dmUnreadTotal().then((c) => active && setN(c)).catch(() => {});
    return () => { active = false; };
  }, [location.pathname]);
  return n;
}

/** I6 — the ONE canonical USER nav order (owner spec 2026-08-05, amended
 *  ONEMENU 2026-08-07): Community Feed, Dashboard, Calendar, My Lessons*, My
 *  Orders, Catalog, My Documents, Messages, My Posts, My Stable, My Saved
 *  Items*, Account — identical across the mobile drawer, the desktop USER
 *  rail (ClientRail, below), and the welcome/first-visit modal's item listing
 *  (AppOverviewModal's pageLines — not re-verified against this order in this
 *  pass). Presence-gated items (Orders, Documents, My Posts, My Stable, My
 *  Saved Items) keep their `my_nav_presence()` gating; order holds among
 *  whatever is visible. My Saved Items is NEW here (owner ruling
 *  2026-08-07, #5): the old I6 note said it was deliberately excluded because
 *  the (now-removed) avatar dropdown carried it as a bonus shortcut — that
 *  reasoning no longer holds once the dropdown is gone, so it's appended
 *  after My Stable rather than left unreachable from mobile nav. Lessons
 *  shipped as "My Lessons" — D1 (TASK-ACCOUNTSURFACE §4) — it is still
 *  module-gated exactly like the staff nav's own Lessons entry
 *  (MANAGEMENT_GROUP above); dropping it is the one `lessonsOn &&` line.
 *  Community Feed itself is NOT in this list — every caller renders
 *  `<CommunityNav />` immediately before this component, matching the
 *  existing pattern of calling it explicitly at each site. */
function ClientNavItems({ bellCount, dmCount, presence, lessonsOn, onNavigate }: {
  bellCount: number; dmCount: number; presence: NavPresence; lessonsOn: boolean; onNavigate?: () => void;
}) {
  return (
    <>
      <RailLink to="/app/dashboard" label="Dashboard" icon={LayoutDashboard} badge={bellCount} />
      <RailLink to="/app/calendar" label="Calendar" icon={CalendarDays} />
      {/* D1 (owner table, TASK-ACCOUNTSURFACE §4): nav labels must match the
          Account page exactly. "Lessons" alone was the bare public-vs-personal
          collision the rule exists to prevent. */}
      {lessonsOn && <RailLink to="/app/lessons" label="My Lessons" icon={GraduationCap} />}
      {presence.orders && <RailLink to="/app/orders" label="My Orders" icon={ReceiptText} />}
      <RailLink to="/app/catalog" label="Catalog" icon={ShoppingBag} />
      {presence.documents && <RailLink to="/app/documents" label="My Documents" icon={FileText} />}
      <RailLink to="/app/messages" label="Messages" icon={MessageSquare} badge={dmCount} />
      {presence.posts && <RailLink to="/app/my-posts" label="My Posts" icon={Grid3x3} />}
      {presence.stable && (
        /* D2 resolved by the orchestrator at merge: ACCOUNTSURFACE's /app/stable
           route is now on main, so this points at it directly instead of taking
           the ?section= redirect hop. `section` dropped so isActive matches on
           pathname — see the note in PRESENCE_LINKS. */
        <PresenceLink to="/app/stable" label="My Stable" icon={Boxes} onNavigate={onNavigate} />
      )}
      {presence.saved && (
        /* Owner ruling 2026-08-07 (#5): Saved Content ships as a visible nav
           item — it was excluded from I6's canonical order specifically
           because the avatar menu carried it as a bonus shortcut; that menu
           is gone now, so its only remaining home is here. Presence-gated
           the same way Orders/Documents/My Posts/My Stable already are — an
           existence check, not the NAVPREFS user-hide feature (not built). */
        <PresenceLink to="/app/account?section=saved" label="My Saved Items" icon={Bookmark} section="saved" onNavigate={onNavigate} />
      )}
      <AccountNavLink onNavigate={onNavigate} />
    </>
  );
}

/** ONEMENU — the staff rail/drawer equivalent of ClientNavItems. Calendar was
 *  already hardcoded at both render sites. Catalog and Messages are the
 *  net-new items from A2's inventory: instructors already reached them
 *  through the old avatar dropdown's client-quick-links branch (which
 *  incorrectly also caught them, since it only excluded admins), while
 *  admins never got them at all. Owner ruling #4 — "admin and instructor
 *  converge... the current divergence is drift, not design" — resolved by
 *  giving every staff account the same set rather than picking a side.
 *  UIO-012 item 2: Dashboard moved to the MANAGEMENT_GROUP table — it was
 *  staff's own management dashboard, filed in the wrong section. */
function StaffNavItems({ dmCount, open = true }: { dmCount: number; open?: boolean }) {
  return (
    <>
      {/* RESTORED 2026-08-15 (Review experiment ended), in the recorded order. */}
      <RailLink to="/app/calendar" label="Calendar" icon={CalendarDays} open={open} />
      <RailLink to="/app/catalog" label="Catalog" icon={ShoppingBag} open={open} />
      <RailLink to="/app/messages" label="Messages" icon={MessageSquare} badge={dmCount} open={open} />
    </>
  );
}

/** ONEMENU — the trailing utility block absorbed from the removed avatar
 *  dropdown: App tour and Sign out. Shared by the member rail, the staff rail
 *  (collapse-aware via `open`) and the mobile drawer (member + staff, one
 *  shared call). Not styled as nav rows — no route, no selected state, so
 *  C5b's fill system doesn't apply; a plain neutral hover matches the old
 *  dropdown's own convention for these two rows.
 *
 *  Sign out (owner ruling #6): the app's ONLY sign-out path, so it is
 *  deliberately NOT a small control among ordinary links — full-width,
 *  generous vertical padding, and `env(safe-area-inset-bottom)` so iOS's home
 *  indicator / Safari toolbar can't overlay it. `onNavigate`, when passed,
 *  additionally closes the mobile drawer — these are plain buttons, not
 *  links, so the drawer's own delegated `closest('a')` close handler (on the
 *  `<nav>` below) doesn't catch them. */
function NavFooter({ open = true, onOpenTour, onSignOut, onNavigate }: {
  open?: boolean; onOpenTour: () => void; onSignOut: () => void; onNavigate?: () => void;
}) {
  return (
    <div className={`mt-2 pt-3 pb-2 border-t ${NAV_DIVIDER} flex flex-col gap-1.5`}>
      {/* §H3/§H4 — these two are nav rows on the same left edge as the links
          above them, so they take the same inset and the same collapsed
          exemption. */}
      <button type="button" onClick={() => { onNavigate?.(); onOpenTour(); }}
        aria-label={open ? undefined : 'App tour'}
        className={`group relative flex items-center gap-3 rounded-lg ${open ? NAV_INSET_ROW : NAV_INSET_COLLAPSED} py-2.5 text-[13.5px] font-sans ${NAV_ROW_IDLE} focus-ring ${open ? '' : 'justify-center'}`}>
        <Compass size={17} aria-hidden="true" className={`shrink-0 ${NAV_ICON_IDLE}`} />
        {open && <span className="flex-1 text-left">App tour</span>}
        {!open && <NavTooltipLabel label="App tour" />}
      </button>
      <button type="button" onClick={() => { onNavigate?.(); onSignOut(); }}
        aria-label={open ? undefined : 'Sign out'}
        className={`group relative flex items-center gap-3 rounded-lg ${open ? NAV_INSET_ROW : NAV_INSET_COLLAPSED} py-3 text-[13.5px] font-sans ${NAV_ROW_IDLE} focus-ring w-full pb-[max(0.75rem,env(safe-area-inset-bottom))] ${open ? '' : 'justify-center'}`}>
        <LogOut size={17} aria-hidden="true" className={`shrink-0 ${NAV_ICON_IDLE}`} />
        {open && <span className="flex-1 text-left">Sign out</span>}
        {!open && <NavTooltipLabel label="Sign out" />}
      </button>
    </div>
  );
}

/** CLIENT LEFT RAIL (desktop only) — the USER quick-access destinations plus
 *  Community Feed. Members only (staff get the management rail).
 *
 *  I1 (owner spec 2026-08-04, tracker I1): this rail used to expand-on-hover
 *  with a pin toggle to keep it open. That collapse/expand control is
 *  removed entirely for USER accounts — a fixed, non-collapsible sidebar,
 *  always the full 240px width. Staff's own rail (below, in AppLayout) never
 *  had an equivalent toggle either, so no account type has a sidebar-
 *  collapse control after this change.
 *
 *  I7's green-glass surface is gone — ONEHEADER §1 makes this a solid green
 *  panel (NAV_PANEL). See its definition near the top of this file for the
 *  arithmetic that rules out going back to glass over a cream page.
 *
 *  ONEMENU: gains the trailing App-tour/Sign-out block (`NavFooter`) absorbed
 *  from the removed avatar dropdown — Q4's owner ruling made the dropdown's
 *  removal universal, not mobile-only, so desktop needs this too. */
function ClientRail({ bellCount, dmCount, presence, lessonsOn, onOpenTour, onSignOut }: {
  bellCount: number; dmCount: number; presence: NavPresence; lessonsOn: boolean;
  onOpenTour: () => void; onSignOut: () => void;
}) {
  return (
    <aside className="hidden lg:block shrink-0 relative z-30 w-60">
      {/* UIO-014: the rail's right edge was heavier than every other divider
          in the same panel — border-green-950/20, not this file's own
          declared divider weight (NAV_DIVIDER, border-green-900/12). Not an
          invented value; matching what's already the standard.
          UIO-016: p-2 -> p-3. Icon start was 20px from the panel's left
          edge inside a 240px (w-60) panel; changing the container rather
          than every row's own px-3 shifts both sides equally, so the hover
          underline/selected fill stay symmetrically inset and no row class
          needs touching. The staff rail's own <nav> already carries p-3 —
          untouched here, this order's Files section scopes to this rail
          only. */}
      <nav className={`sticky top-[var(--cs-hdr-h)] h-[calc(100dvh-var(--cs-hdr-h))] border-r border-green-900/12 ${NAV_PANEL} p-3 overflow-y-auto overflow-x-hidden flex flex-col oh-rail-shadow`}>
        <div className="flex flex-col gap-0.5">
          {/* Community Feed (position 1) with its views nested underneath. */}
          <CommunityNav />
          <ClientNavItems bellCount={bellCount} dmCount={dmCount} presence={presence} lessonsOn={lessonsOn} />
        </div>
        <NavFooter onOpenTour={onOpenTour} onSignOut={onSignOut} />
      </nav>
    </aside>
  );
}

export default function AppLayout() {
  const { profile, isAdmin, isStaff, isSuperAdmin, hasModule, signOut } = useAuth();
  const dmCount = useDmUnread();
  useViewSurfaces();
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();
  const inboundCount = useInboundOpenCount(isStaff);
  const presence = useNavPresence(!isStaff);
  // I6 — Lessons' module gate for the canonical USER nav order (ClientNavItems),
  // mirroring the staff nav's own `module: 'mod.lessons'` convention.
  const lessonsOn = hasModule('mod.lessons');
  // I2 — the same presence-gated set the rail uses, reused by the avatar
  // dropdown and mobile drawer below (see PresenceLink for why `section`
  // needs its own active-match instead of relying on NavLink's pathname-only
  // check).
  const navLinks = PRESENCE_LINKS.filter((l) => presence[l.key]);
  const accountSection = useActiveAccountSection();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // PLUSPASS — a page's own "+" control (e.g. Home's "+ Post") can jump the
  // shared CreateModal straight past the generic destination menu into a
  // specific step, via CreateModalTriggerContext below.
  const [createStep, setCreateStep] = useState<CreateModalStep>('destination');
  const openCreateAt = useCallback((step: CreateModalStep) => { setCreateStep(step); setCreateOpen(true); }, []);
  const createModalTrigger = useMemo(() => ({ openCreate: openCreateAt }), [openCreateAt]);
  // Mobile left-nav drawer: the side menu, opened by the button in the header
  // (moved there from the content area, owner spec 2026-08-05).
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* ── §C — THE DRAWER'S THREE STATES ────────────────────────────────────────
   * `mobileNavOpen` is the INTENT and stays the one thing the header's avatar
   * and every close path touch. The two below are the render:
   *   drawerMounted  in the DOM at all
   *   drawerShown    at the open position (transform 0 / scrim opaque)
   * They have to be separate because both directions need a frame the other
   * cannot provide: opening needs the panel painted CLOSED once before it can
   * animate toward open, and closing needs it to still EXIST while it slides
   * away. `{mobileNavOpen && …}` alone could give neither, which is why both
   * directions were instant. */
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerShown, setDrawerShown] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const drawerWrapRef = useRef<HTMLDivElement | null>(null);
  /** Whatever had focus when the drawer opened — §F1's focus return. */
  const drawerOpenerRef = useRef<HTMLElement | null>(null);
  /* §C3 — under reduced motion the drawer appears and disappears with no
   * transform and no fade. That is the CURRENT behaviour and it is correct for
   * that setting, so it is preserved deliberately rather than merely shortened:
   * both the paint-a-frame-first delay and the wait-for-the-exit timer below are
   * skipped outright. (index.css already forces `transition-duration: 0.001ms`
   * globally under that query, so the CSS half is handled; this is the JS half,
   * which that rule cannot reach.) */
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (mobileNavOpen) {
      setDrawerMounted(true);
      if (reducedMotion) { setDrawerShown(true); return; }
      /* Two frames, not one. The first gets the node into the DOM at
         `-translate-x-full`; the second is the earliest the browser can have
         painted it there. Flipping on the same frame it mounts is the classic
         way to get no animation at all — the two style values collapse into one
         style recalculation and there is nothing to interpolate between. */
      let cancelled = false;
      requestAnimationFrame(() => {
        if (cancelled) return;
        requestAnimationFrame(() => { if (!cancelled) setDrawerShown(true); });
      });
      return () => { cancelled = true; };
    }
    setDrawerShown(false);
    if (reducedMotion) { setDrawerMounted(false); return; }
    const t = window.setTimeout(() => setDrawerMounted(false), DRAWER_EXIT_MS);
    return () => window.clearTimeout(t);
  }, [mobileNavOpen, reducedMotion]);

  /* CLOSED IS INERT, and translating a panel off-screen does not achieve that on
   * its own — an off-canvas panel is still in the tab order, still announced,
   * still hit-testable at its off-screen coordinates. Unmounting settles it at
   * rest (there is no drawer at all when closed), and `inert` covers the only
   * window where the node exists but is not open: the ~320ms of the exit.
   * Set imperatively because React 18 has no `inert` prop — React 19 added it,
   * and this app is on 18.3.1. */
  useEffect(() => {
    const node = drawerWrapRef.current;
    if (!node) return;
    if (drawerShown) node.removeAttribute('inert');
    else node.setAttribute('inert', '');
  }, [drawerShown, drawerMounted]);

  /* §F1 — the `aria-modal` gap. The drawer has declared
   * `role="dialog" aria-modal="true"` with NO focus management of any kind:
   * Escape closed it, a route change closed it, and that was everything. That
   * combination tells a screen reader the rest of the page is inert when it is
   * not. Focus moves in on open and returns to whatever opened it on close.
   * The opener is captured rather than hardcoded so the tenant's avatar and the
   * superadmin's own nav button both get it from one code path; the
   * `aria-controls` query is the fallback if that element has gone away. */
  useEffect(() => {
    if (!mobileNavOpen) return;
    drawerOpenerRef.current = document.activeElement as HTMLElement | null;
    return () => {
      const active = document.activeElement as HTMLElement | null;
      /* Only reclaim focus if it is still inside the drawer or has fallen to
         <body> because the element holding it was just removed. If the user has
         already moved focus somewhere else, yanking it back would be the bug
         this is meant to prevent, pointing the other way.
         Containment is tested through the drawer's own id rather than a ref: the
         ref's value at CLEANUP time is what matters here (at effect time the
         drawer has not mounted yet and the ref is still null), and reading
         `ref.current` in a cleanup is exactly what react-hooks warns about. The
         id is the same node by a route that has no such hazard. */
      const stillInDrawer = !!active?.closest?.('#app-nav-drawer');
      if (active && active !== document.body && !stillInDrawer) return;
      const opener = drawerOpenerRef.current
        ?? document.querySelector<HTMLElement>('[aria-controls="app-nav-drawer"]');
      opener?.focus?.();
    };
  }, [mobileNavOpen]);

  /* Focus enters on SHOWN, not on mounted: during the entrance frames the
   * wrapper is still `inert`, and focusing inside an inert subtree does
   * nothing. The <nav> itself takes focus (it carries `tabIndex={-1}`) rather
   * than its first link — landing on a container announces the dialog without
   * announcing "Community Feed, link" as though the user had chosen it. */
  useEffect(() => { if (drawerShown) drawerRef.current?.focus(); }, [drawerShown]);

  /** The trap. Small on purpose — Tab cycles within the drawer, Shift+Tab wraps
   *  backwards, and nothing else is intercepted (Escape is handled separately,
   *  below, and still is). */
  const onDrawerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const root = drawerRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )).filter((el) => el.offsetParent !== null);
    if (items.length === 0) { e.preventDefault(); root.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault(); first.focus();
    }
  }, []);

  // I1B — staff rail collapse (recovered pattern: the old USER ClientRail's
  // pin toggle, removed in TASK I and now rebuilt staff-only per owner ruling
  // 2026-08-05). Pinned (default) = full 240/256px rail; unpinned collapses
  // to a 56px icon strip.
  //
  // C2/C3 (owner, 2026-08-07): hover-to-peek is REMOVED — it was the root
  // cause of C2's page-resize bug. The `<aside>` (which reserves page space)
  // followed `staffRailPinned` while the `<nav>` inside it followed a
  // SEPARATE derived `staffRailOpen = staffRailPinned || staffRailHovered`,
  // so clicking the collapse control with the cursor already over the rail
  // left `staffRailHovered` true — the `<nav>` was already wide, only the
  // `<aside>` changed, and the page reflowed while the menu appeared not to
  // move. Fixed at the cause: one state, no derived variant — both elements
  // read `staffRailPinned` directly (and the same `staffRailWidthClass`
  // string, so they can't drift textually either). The rail is now either
  // full or icon-only, never a hover-expanded in-between.
  const [staffRailPinned, setStaffRailPinned] = useState(() => localStorage.getItem('staffRail.pinned') !== '0');
  useEffect(() => { localStorage.setItem('staffRail.pinned', staffRailPinned ? '1' : '0'); }, [staffRailPinned]);
  const staffRailWidthClass = staffRailPinned ? 'w-60 xl:w-64' : 'w-14';

  const name = profile?.display_name || profile?.first_name || 'Member';
  const initial = (name[0] || 'M').toUpperCase();

  const showRail = isStaff;
  const isTrainer = isStaff && !isAdmin;
  // D8: community access is gated by ACCOUNT, not category — no guest gating.
  // The signing wall (3f): a member with pending wall-gating documents is
  // routed to the document flow on sign-in, refresh, and navigation; staff
  // are never hard-walled (persistent banner instead).
  const location = useLocation();
  const [wall, setWall] = useState<WallState | null>(null);
  const [wallRetry, setWallRetry] = useState(0);
  // FAIL CLOSED: myWallState() now throws instead of returning a permissive
  // default, so a transient failure can no longer silently drop the wall. We
  // hold the member at an explicit retryable state rather than letting them
  // through unverified.
  const [wallError, setWallError] = useState(false);
  useEffect(() => {
    let active = true;
    setWallError(false);
    myWallState()
      .then((w) => { if (active) { setWall(w); setWallError(false); } })
      .catch(() => { if (active) { setWall(null); setWallError(true); } });
    return () => { active = false; };
  }, [location.pathname, wallRetry]);

  // A3: the app-overview tour. The desktop and mobile tours are DIFFERENT
  // experiences and persist independently: each keeps auto-opening on ITS form
  // factor until dismissed there (profiles.tour_seen_desktop_at /
  // tour_seen_mobile_at). Revisitable from the avatar menu at any time.
  // Auto-open is deliberately evaluated AFTER the signing wall below, so a
  // member with pending gating documents clears the wall first and meets the
  // tour once their documents are done.
  const [tourOpen, setTourOpen] = useState(false);
  const [tourSeen, setTourSeen] = useState<boolean | null>(null);
  const [tourCategories, setTourCategories] = useState<StandingCategory[]>([]);
  useEffect(() => {
    let active = true;
    getMyProfile()
      .then((pr) => {
        if (!active) return;
        const seenAt = currentTourFormFactor() === 'mobile'
          ? pr?.tour_seen_mobile_at : pr?.tour_seen_desktop_at;
        setTourSeen(pr ? seenAt != null : true);
      })
      .catch(() => active && setTourSeen(true));
    // Swallowing is CORRECT here (unlike the wall): these categories only pick
    // which variant of the presentational tour is shown. On failure the tour
    // falls back to its guest variant — nothing is gated, so there is nothing
    // to fail closed on.
    fetchMyCategories().then((c) => active && setTourCategories(c)).catch(() => {});
    return () => { active = false; };
  }, []);

  /** Dismissing the auto-opened tour stamps the marker; a menu re-open does not. */
  const closeTour = (stamp: boolean) => {
    setTourOpen(false);
    if (!stamp) return;
    setTourSeen(true);
    void markTourSeen().catch(() => { /* presentational marker only */ });
  };
  const [grantKeys, setGrantKeys] = useState<string[]>([]);
  useEffect(() => {
    if (!isTrainer) return;
    fetchMyGrantKeys().then(setGrantKeys).catch(() => {});
  }, [isTrainer]);
  // UIO-012 item 2: Dashboard's badge is injected here (not in the static
  // MANAGEMENT_GROUP table) since it's a live count, the same reason
  // Inbound's badge was before it moved here — Inbound's own count doesn't
  // just move house, it SUMS into Dashboard's: myUnreadCount() (unreadCount,
  // "addressed to you") + inboundOpenCount() (inboundCount, "waiting to be
  // picked up") are different sources, and with Inbound off the nav its
  // count has nowhere else to live — dropping it would make open leads
  // invisible from the nav, a regression against today.
  const navGroups = showRail
    ? manageNavGroups(hasModule, isAdmin, isSuperAdmin, grantKeys).map((g) => ({
        ...g,
        items: g.items.map((it) => (it.to === '/app/dashboard' ? { ...it, badge: unreadCount + inboundCount } : it)),
      }))
    : [];
  /* UIO-012: the first five items (Community Feed + the four StaffNavItems)
   *  sat above MANAGEMENT with no heading — the only group in the rail that
   *  could not collapse. Not a real entry in `navGroups` (its content is
   *  CommunityNav + StaffNavItems, not a flat NavItem[] a RailLink can
   *  render), so it's a separate pseudo-group carrying only what
   *  `groupOpen`/`toggleGroup` need — `items` stays empty and unused. */
  const APP_PAGES_GROUP: NavGroup = { key: 'app-pages', label: 'App pages', items: [], defaultOpen: true };
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const groupOpen = (g: NavGroup) => openGroups[g.key] ?? g.defaultOpen ?? false;
  // `[...navGroups, APP_PAGES_GROUP]` — APP_PAGES_GROUP isn't IN navGroups,
  // so a lookup scoped to navGroups alone would resolve its own defaultOpen
  // as `undefined` on the first toggle and always flip to open, even when it
  // was already open and the click meant to close it.
  const toggleGroup = (key: string) => setOpenGroups((p) => ({ ...p, [key]: !(p[key] ?? [...navGroups, APP_PAGES_GROUP].find((g) => g.key === key)?.defaultOpen ?? false) }));

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  // Close the mobile drawer on Escape and on any route change.
  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMobileNavOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  /* UIO-007: the body lock that used to sit here (`position: fixed` on
     <body>, scroll position captured and restored on close) is deleted, not
     fixed. It was "restore scroll position after a teardown" — a workaround,
     not a fix, and the same shape as the contract reload bug this project
     already paid for once. It also restored the wrong scroller: it captured
     `window.scrollY`, but the app scrolls inside `overflow-y-auto`
     containers, so on a page with one (e.g. a contract mid-document) it put
     the WINDOW back where it was while the actual scroller — a container —
     had never moved, landing the user somewhere else entirely.

     The scrim still means something without it: the drawer (above) now
     carries `overscroll-contain`, which stops its own scroll chaining to the
     page behind it without freezing anything. If the page never moves,
     there is nothing to capture and nothing to put back. */
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate('/');
  }
  const closeMenu = () => setMenuOpen(false);
  const closeMobileNav = () => setMobileNavOpen(false);

  // THE SIGNING WALL (3f): pending wall-gating documents route the member to
  // the document flow on sign-in / refresh / navigation until every gating
  // document is signed. The wall IS the prompt — no dashboard notification.
  // Sign-out stays reachable (the flow renders inside the layout chrome).
  //
  // TASK-WALLRETURN: capture where they were actually headed before the
  // redirect discards it — Onboarding's enterApp() reads this back once the
  // member is done here, instead of always landing on the default dashboard/
  // community view. Does not weaken the wall itself: the redirect below is
  // unchanged, this only remembers what it's about to overwrite.
  if (wall?.wall && location.pathname !== '/app/onboarding') {
    captureWallReturnDestination(location.pathname, location.search);
    return <Navigate to="/app/onboarding" replace />;
  }

  // FAIL CLOSED: we could not determine whether this member is walled. Rather
  // than assume they are clear (the old silent behaviour), hold here with a
  // retry. The onboarding route itself stays reachable — it is where a genuinely
  // walled member needs to go, and it re-checks on its own.
  if (wallError && !wall && location.pathname !== '/app/onboarding') {
    return (
      <div className="min-h-screen bg-cream grid place-items-center px-4">
        <div className="bg-white border border-green-800/10 rounded-xl p-6 max-w-md text-center">
          <h1 className="font-serif text-xl text-green-800 mb-2">We couldn't check your documents</h1>
          <p className="body-text text-sm text-muted mb-4">
            We can't confirm whether you have documents awaiting signature, so we've
            paused here rather than let you past. This is usually a brief connection
            problem.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button type="button" className="btn-primary" onClick={() => setWallRetry((n) => n + 1)}>
              Try again
            </button>
            <Link to="/app/onboarding" className="btn-outline-gold">Go to my documents</Link>
          </div>
        </div>
      </div>
    );
  }

  // A3 auto-open — strictly after the wall check above: an unseen tour only
  // opens once the member is past any gating documents (the wall returns early,
  // so this line is unreachable while a wall is pending). The onboarding route
  // owns its own mount, so we never double-open there.
  if (tourSeen === false && !tourOpen && location.pathname !== '/app/onboarding') {
    setTourOpen(true);
  }

  /* THE ACCOUNT DROPDOWN — hoisted out of the header markup because there are
     now two headers (superadmin's untouched platform chrome and the tenant's
     cardstock nameplate) and this panel is identical in both. Hoisting keeps
     ONE copy of the MenuLink set rather than a duplicate that can drift.
     Unchanged from its previous form: same links, same order, same handlers. */
  const accountMenu = menuOpen ? (
    <div className="absolute right-0 mt-1 w-60 max-w-[calc(100vw-2rem)] bg-white border border-green-800/10 shadow-md rounded-md py-1 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain z-50 pb-3">
      <p className="px-4 py-2 text-xs text-muted border-b border-green-800/10 truncate">{name}</p>
      <MenuLink to="/app/account" label="Account" icon={UserRound} onNavigate={closeMenu} />
      {/* admin references — company-associable items only */}
      {isAdmin && !isSuperAdmin && (
        <>
          <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">Company</div>
          <button type="button"
            onClick={() => { closeMenu(); navigate('/app/ops/documents'); }}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary [@media(hover:hover)]:hover:bg-navfill/64 [@media(hover:hover)]:hover:text-cream-100 focus-ring">
            <FileText size={17} /> Pending agreements
          </button>
          {/* Both operators navigate to the community + catalog to help
              members with what they're seeing — no shopper-only links. */}
          <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">Quick access</div>
          {/* §H3: the avatar dropdown is OUT OF SCOPE — "a separate floating
              surface with its own metrics, not the nav's left edge". The old
              values are passed explicitly so this surface keeps rendering
              exactly as it does today: inside `px-1`, `px-3` puts these rows at
              16px, dead on the `px-4` line its sibling MenuLinks sit on. */}
          <div className="px-1"><CommunityNav onNavigate={closeMenu} indentClass="pl-9" rowInsetClass="px-3" /></div>
          <button type="button" onClick={() => { closeMenu(); navigate('/app/dashboard'); }}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary [@media(hover:hover)]:hover:bg-navfill/64 [@media(hover:hover)]:hover:text-cream-100 focus-ring">
            <LayoutDashboard size={17} /> Dashboard
            {unreadCount > 0 && <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full bg-gold-600/70 text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <button type="button" onClick={() => { closeMenu(); navigate('/app/catalog'); }}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary [@media(hover:hover)]:hover:bg-navfill/64 [@media(hover:hover)]:hover:text-cream-100 focus-ring">
            <ShoppingBag size={17} /> Catalog
          </button>
        </>
      )}
      {/* client quick links — an admin's menu carries company work, not shopper shortcuts */}
      {!isAdmin && !isSuperAdmin && (
        <>
          <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">Quick access</div>
          {/* §H3: the avatar dropdown is OUT OF SCOPE — "a separate floating
              surface with its own metrics, not the nav's left edge". The old
              values are passed explicitly so this surface keeps rendering
              exactly as it does today: inside `px-1`, `px-3` puts these rows at
              16px, dead on the `px-4` line its sibling MenuLinks sit on. */}
          <div className="px-1"><CommunityNav onNavigate={closeMenu} indentClass="pl-9" rowInsetClass="px-3" /></div>
          {QUICK.map((q) => {
            const raw = q.badge === 'notifications' ? unreadCount : q.badge === 'messages' ? dmCount : 0;
            const badge = raw > 0 ? raw : 0;
            return (
              <button key={q.label} type="button"
                onClick={() => { closeMenu(); navigate(q.to); }}
                className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary [@media(hover:hover)]:hover:bg-navfill/64 [@media(hover:hover)]:hover:text-cream-100 focus-ring">
                <q.icon size={17} /> {q.label}
                {badge > 0 && <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full bg-gold-600/70 text-white">{badge > 9 ? '9+' : badge}</span>}
              </button>
            );
          })}
          {/* I2 — same five presence-gated links as the rail, dropdown-shaped. */}
          {navLinks.map((l) => {
            const isActive = l.section ? accountSection === l.section : location.pathname === l.to;
            return (
              <Link key={l.key} to={l.to} onClick={closeMenu}
                className={`flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans focus-ring ${
                  isActive ? 'bg-cream-200 text-green-800 font-medium ' : 'text-secondary [@media(hover:hover)]:hover:bg-navfill/64 [@media(hover:hover)]:hover:text-cream-100'}`}>
                <l.icon size={17} /> {l.label}
              </Link>
            );
          })}
        </>
      )}
      {navGroups.length > 0 && (
        <div className="lg:hidden">
          {navGroups.map((g) => (
            <div key={g.key}>
              <div className="mt-1 border-t border-green-800/10 pt-2 px-4 pb-1 text-xs uppercase tracking-wide text-secondary/60">
                {g.label}
              </div>
              {g.items.map((it) => <MenuLink key={it.to} {...it} onNavigate={closeMenu} />)}
            </div>
          ))}
        </div>
      )}
      <button type="button"
        onClick={() => { closeMenu(); setTourOpen(true); }}
        className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-sans text-secondary [@media(hover:hover)]:hover:bg-navfill/64 [@media(hover:hover)]:hover:text-cream-100 border-t border-green-800/10 focus-ring">
        <Compass size={17} aria-hidden="true" className="shrink-0" /> App tour
      </button>
      <button type="button" onClick={handleSignOut}
        className="flex items-center gap-3 px-4 py-2.5 mt-1 w-full text-sm font-sans text-secondary [@media(hover:hover)]:hover:bg-navfill/64 [@media(hover:hover)]:hover:text-cream-100 border-t border-green-800/10 focus-ring">
        <LogOut size={17} aria-hidden="true" className="shrink-0" /> Sign out
      </button>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-cream">
      {/* Staff belt-and-suspenders: never hard-walled — a persistent banner
          links to the flow instead (ops must stay reachable). */}
      {wall?.staff_banner && (
        <div className="bg-gold-50 border-b border-gold-600/40 px-4 py-2 text-sm text-gold-900 text-center">
          You have documents awaiting your signature.{' '}
          <Link to="/app/onboarding" className="underline font-medium">Review and sign</Link>
        </div>
      )}
      {isSuperAdmin ? (
      /* ── SUPERADMIN: PLATFORM CHROME, DELIBERATELY UNTOUCHED ──────────────
         This is the platform operator's chrome, not a tenant's branding, and it
         gets its own design later. It receives NONE of the cardstock header's
         parts — no sheet, no wordmark, no tabs — so it also keeps the mobile nav
         BUTTON that the drawer tab replaced everywhere else, and its avatar
         keeps its ChevronDown. Rendered output is byte-for-byte what it was.

         ONEMENU (2026-08-07): the tenant's CardstockHeader avatar is now an
         inert monogram and no longer renders `accountMenu` at all — its
         contents (Account, Company, Quick access, Sign out) moved into the
         tenant side nav (rail + drawer) instead. `accountMenu` itself is
         UNCHANGED and lives on here, exclusively for superadmin: it is the
         platform operator's only sign-out path, and Q3's ruling was to leave
         this chrome alone entirely rather than fold it into the
         consolidation too. */
      <header className="sticky top-0 z-40 bg-white border-b border-green-800/10">
        <div className="w-full max-w-[120rem] mx-auto grid grid-cols-[auto_1fr_auto] items-center gap-2 px-4 sm:px-8 h-14">
          <div className="flex items-center gap-3 justify-self-start">
            {/* Placeholder wordmark until the platform product is named/branded.
                Never gets the tenant's centered wordmark — there is no tenant
                brand to show here. */}
            <Link to="/app/ops/superadmin/organizations" className="flex items-center gap-2.5" aria-label="Platform — organizations">
              <span className="w-[34px] h-[34px] rounded-lg bg-green-950 text-gold-400 grid place-items-center font-display text-lg font-semibold shrink-0">C</span>
              <span className="hidden sm:inline font-display text-green-900 text-lg uppercase tracking-wide">Cactai Platform</span>
            </Link>
            {/* MOBILE NAV BUTTON — kept here, and ONLY here. Desktop (lg+) has
                the rail instead. */}
            {/* §F1: `aria-controls` added — it opens the same drawer the
                tenant's avatar does, so it should say so, and it is what the
                focus-return fallback queries for when the captured opener has
                gone away. */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              aria-controls="app-nav-drawer"
              className="lg:hidden p-2 text-green-800 rounded-lg hover:bg-cream-100 focus-ring"
            >
              <PanelLeftOpen size={20} aria-hidden="true" />
            </button>
          </div>

          {/* empty middle column so the 3-column grid still holds and the right
              cluster stays right-aligned rather than re-centering into it */}
          <div className="hidden sm:flex justify-self-center items-center" />

          <div className="flex items-center gap-3 justify-self-end">
            <button type="button" onClick={() => setCreateOpen(true)}
              className="p-2 text-green-800 rounded-lg hover:bg-cream-100 focus-ring" aria-label="Create">
              <Plus size={20} />
            </button>
            <button type="button" onClick={() => navigate('/app/calendar')}
              className="p-2 text-green-800 rounded-lg hover:bg-cream-100 focus-ring" aria-label="Calendar">
              <CalendarDays size={18} />
            </button>
            <div className="relative" ref={menuRef}>
              <button type="button" onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full [@media(hover:hover)]:hover:bg-navfill/64 [@media(hover:hover)]:hover:text-cream-100 focus-ring"
                aria-label="Account menu" aria-expanded={menuOpen}>
                {/* No notifications badge on the avatar — the count lives on the
                    Dashboard nav link (desktop rail + mobile menu) instead. */}
                <span className="w-8 h-8 rounded-full bg-green-800 text-white text-sm font-sans grid place-items-center">
                  {initial}
                </span>
                <ChevronDown size={14} className="text-secondary" />
              </button>
              {accountMenu}
            </div>
          </div>
        </div>
      </header>
      ) : (
        /* ── THE ONE HEADER (TASK-ONEHEADER, owner 2026-08-08) ────────────────
           The cardstock nameplate is SHELVED, not deleted — the files and the
           texture asset stay put and a verbatim copy with restore instructions
           lives at docs/reference/shelved-cardstock-header/. It returns when the
           site is colour-matched to it.

           In its place: the login screen's header, so the header no longer
           changes at sign-in and the colours match either side of the wire. See
           AppHeader.tsx — it adopts the public header's MATERIAL and keeps the
           app's own contents (home mark, wordmark, avatar), it does not import
           the public header's site nav.

           The avatar is the menu button again (ONEHEADER §2) below lg, which is
           what let the hanging drawer tab be deleted (§3). It opens the one
           nav — not a second avatar menu (§4). */
        <AppHeader
          initial={initial}
          menuOpen={mobileNavOpen}
          onToggleMenu={() => setMobileNavOpen((v) => !v)}
        />
      )}

      <div className="w-full max-w-[120rem] mx-auto flex">
        {/* Members (non-staff) get a fixed quick-access rail on desktop (I1). */}
        {!showRail && !isSuperAdmin && (
          <ClientRail bellCount={unreadCount} dmCount={dmCount} presence={presence} lessonsOn={lessonsOn}
            onOpenTour={() => setTourOpen(true)} onSignOut={handleSignOut} />
        )}
        {showRail && (
          /* I1B — width behaves like the old ClientRail: the <aside> RESERVES
             56px normally / 240-256px when PINNED (page sits beside it); the
             <nav> is sticky and matches it exactly (C2/C3: both read
             `staffRailPinned`/`staffRailWidthClass` directly now — no more
             hover-driven divergence between the two). */
          <aside className={`hidden lg:block shrink-0 relative z-30 transition-[width] duration-100 ease-out ${staffRailWidthClass}`}>
            {/* `flex flex-col` is load-bearing: it is what lets the collapse
                toggle's `mt-auto` push it (and Sign out) to the foot of the
                rail. ClientRail already had it; this one did not. */}
            {/* ONEHEADER §1: `bg-cream-100/40` becomes the shared NAV_PANEL. The
                staff rail was the one nav surface still on a light background,
                which was drift rather than a decision — and it shares every row
                component with the two surfaces that ARE green, so leaving it
                light would mean carrying two palettes through RailLink,
                CommunityNav, AccountNavLink and NavFooter. One menu, one look. */}
            <nav className={`p-3 sticky top-[var(--cs-hdr-h)] h-[calc(100dvh-var(--cs-hdr-h))] overflow-y-auto overflow-x-hidden border-r border-green-950/20 ${NAV_PANEL} flex flex-col transition-[width] duration-100 ease-out oh-rail-shadow ${staffRailWidthClass}`}>
              {/* Owner, 2026-08-07: the create control lives HERE now, in the
                  slot the collapse toggle used to occupy, and the header's
                  hanging tab is gone. The collapse toggle moved to the foot of
                  the rail, above Sign out.
                  Owner, 2026-08-09: it is no longer icon-only. The row spans the
                  rail with the icon and the words "Add New" centred as one
                  group — right-aligned bare "+" read as a stray control rather
                  than an action. Collapsed, the label drops and the tooltip
                  carries it, exactly as RailLink does, so the icon still lands
                  on the shared centre line in the 56px strip. */}
              <div className="mb-1">
                <button type="button" onClick={() => setCreateOpen(true)}
                  aria-label={staffRailPinned ? undefined : 'Add New'} aria-haspopup="dialog"
                  /* Owner, 2026-08-08: match the rail's own item metrics. This
                     was `p-2.5` + `hover:bg-white`, inherited from the old
                     collapse button — 10px padding against every nav item's
                     `px-3 py-2.5`, so the icon sat off the shared centre line in
                     the collapsed rail, and the white hover belonged to no other
                     surface in the nav. */
                  /* §H3/§H4: SYMMETRIC px-3 deliberately. This control is
                     `justify-center` in BOTH rail states — it is not on the
                     nav's left alignment line at all — so an asymmetric inset
                     would not move it right, it would move its centred
                     icon+label group 4px off the centre this comment above
                     already records bringing it onto. */
                  className={`group relative w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13.5px] font-sans transition-colors ${NAV_ROW_IDLE} focus-ring`}>
                  <Plus size={18} aria-hidden="true" className={`shrink-0 ${NAV_ICON_IDLE}`} />
                  {staffRailPinned && <span className="whitespace-nowrap">Add New</span>}
                  {!staffRailPinned && <NavTooltipLabel label="Add New" />}
                </button>
                {/* UIO-012 item 2b: "Add New" is a control, not a page, but it
                    sat flush above the list with nothing marking the
                    difference — it read as the App pages group's first entry.
                    Same divider language the collapsed-group separator below
                    already uses (border-t + role="separator"), not a new
                    treatment. */}
                <div className={`my-1 border-t ${NAV_DIVIDER}`} role="separator" />
              </div>
              {/* The static heading here used to read "Management", duplicating
                  the Management GROUP below it — two identical labels in one nav.
                  Platform still gets one because it is the super-admin's only
                  section; a tenant's rail is self-describing. */}
              {isSuperAdmin && staffRailPinned && (
                <p className={`${NAV_INSET_ROW} pt-1 pb-2 text-[10px] tracking-widest uppercase ${NAV_HEADING} font-semibold`}>
                  Platform
                </p>
              )}
              {/* UIO-012: same chevron, same toggle, same persistence as the
                  Management/People headings below — deliberately the same
                  markup, not a shared component, so this doesn't risk
                  touching their behaviour while giving this group its own. */}
              {!isSuperAdmin && (
                <div className="mb-1">
                  {staffRailPinned && (
                    <button type="button" onClick={() => toggleGroup(APP_PAGES_GROUP.key)}
                      className={`w-full flex items-center justify-between ${NAV_INSET_ROW} py-1.5 text-[10px] tracking-widest uppercase ${NAV_HEADING} font-semibold transition-colors duration-320 ease-glide hover:text-green-900 focus-ring rounded-md`}>
                      {APP_PAGES_GROUP.label}
                      <ChevronDown size={12} className={`transition-transform ${groupOpen(APP_PAGES_GROUP) ? '' : '-rotate-90'}`} />
                    </button>
                  )}
                  {!staffRailPinned && (
                    <div className={`my-1 border-t ${NAV_DIVIDER}`} role="separator" aria-label={APP_PAGES_GROUP.label} />
                  )}
                  {(groupOpen(APP_PAGES_GROUP) || !staffRailPinned) && (
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      <CommunityNav open={staffRailPinned} />
                      <StaffNavItems dmCount={dmCount} open={staffRailPinned} />
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1">
                {navGroups.map((g) => (
                  <div key={g.key}>
                    {navGroups.length > 1 && staffRailPinned && (
                      <button type="button" onClick={() => toggleGroup(g.key)}
                        /* UIO-003: no transition at all before this — the
                           group heading snapped straight to its hover colour
                           with nothing easing it in.
                           UIO-012: hover was `cream-100`, a leftover from the
                           green-panel era — on the near-white panel it
                           rendered #f5f0e8 on #fdfcfa, 1.11:1, effectively
                           invisible. On a LIGHT panel emphasis goes darker,
                           not lighter: full-strength green-900, 16.41:1. */
                        className={`w-full flex items-center justify-between ${NAV_INSET_ROW} py-1.5 text-[10px] tracking-widest uppercase ${NAV_HEADING} font-semibold transition-colors duration-320 ease-glide hover:text-green-900 focus-ring rounded-md`}>
                        {g.label}
                        <ChevronDown size={12} className={`transition-transform ${groupOpen(g) ? '' : '-rotate-90'}`} />
                      </button>
                    )}
                    {/* collapsed strip: group headings shrink to a plain separator */}
                    {navGroups.length > 1 && !staffRailPinned && (
                      <div className={`my-1 border-t ${NAV_DIVIDER}`} role="separator" aria-label={g.label} />
                    )}
                    {/* ── REVIEW SECTION (temporary — TASK-REVIEWNAV) ────────
                        The group's one-line note, gold so it reads as
                        scaffolding against a rail of green rows — the same
                        signal InstructorHomePreview's banner uses rather than a
                        second visual language for "temporary". It has to be
                        HERE, in the nav, and not only on the pages: the owner's
                        rule is that nav position IS the status, so the thing
                        that says what the position means belongs beside it.
                        Shown when the group is open (a collapsed group shows no
                        rows to explain) and only in the pinned rail (the 56px
                        strip has no room for prose). `note` is set by exactly
                        one group; every other group renders nothing here. */}
                    {g.note && staffRailPinned && groupOpen(g) && (
                      <p className={`${NAV_INSET_ROW} pb-1.5 text-[11px] leading-snug text-gold-800`}>{g.note}</p>
                    )}
                    {(navGroups.length === 1 || groupOpen(g) || !staffRailPinned) && (
                      <div className="flex flex-col gap-0.5">
                        {g.items.map((it) => <RailLink key={it.to} {...it} open={staffRailPinned} />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* ONEMENU — absorbed from the removed avatar dropdown. Staff
                  never had a personal Account link in ANY nav surface before
                  this (owner ruling #3: "no exceptions"). Tour/Sign-out are
                  universal (Q4: dropdown removed everywhere, not mobile-only)
                  — gated off for superadmin, which keeps its own separate
                  avatar-menu sign-out untouched. */}
              {!isSuperAdmin && (
                <>
                  {/* RESTORED 2026-08-15 (Review experiment ended) — exactly as
                      the removal note recorded it. */}
                  <div className="mt-1 flex flex-col gap-0.5">
                    <AccountNavLink open={staffRailPinned} />
                  </div>
                  {/* Owner, 2026-08-07: the collapse toggle sits at the FOOT of
                      the rail, immediately above Sign out, and stays right-
                      justified in BOTH states so it does not move when the rail
                      collapses. `mt-auto` pins this block to the bottom — the
                      <nav> is already flex-col, so the toggle and footer are
                      pushed down regardless of how few nav items are present. */}
                  <div className="mt-auto flex justify-end pt-2">
                    <button type="button" onClick={() => setStaffRailPinned((v) => !v)}
                      aria-label={staffRailPinned ? 'Collapse menu' : 'Keep menu open'} aria-pressed={staffRailPinned}
                      /* Owner, 2026-08-08: match the rail's own item metrics. This
                     was `p-2.5` + `hover:bg-white`, inherited from the old
                     collapse button — 10px padding against every nav item's
                     `px-3 py-2.5`, so the icon sat off the shared centre line in
                     the collapsed rail, and the white hover belonged to no other
                     surface in the nav. */
                  /* §H3/§H4: symmetric px-3, same reason as "Add New" above —
                     this one is `justify-center` inside a right-justified
                     wrapper, so it sits on the rail's RIGHT edge and never on
                     the left line the inset governs. */
                  className={`flex items-center justify-center rounded-lg px-3 py-2.5 ${NAV_ROW_IDLE} focus-ring`}>
                      {staffRailPinned ? <PanelLeftClose size={18} className="shrink-0" /> : <PanelLeftOpen size={18} className="shrink-0" />}
                    </button>
                  </div>
                  <NavFooter open={staffRailPinned} onOpenTour={() => setTourOpen(true)} onSignOut={handleSignOut} />
                </>
              )}
            </nav>
          </aside>
        )}
        {/* FRAMESCROLL backstop, applied by the orchestrator 2026-08-12. `min-w-0`
            lets this box SHRINK; it does not stop a `overflow: visible` child
            painting past its edge and widening the document — which is what made
            `.oh-hdr` (position: sticky, top: 0) scroll horizontally out of the
            viewport on the Documents page. `DataTable` was the root cause and is
            fixed; this is the guard against the next wide child.

            It MUST be `clip`, not `hidden`. `overflow: hidden` makes this a scroll
            container, and every `position: sticky` DESCENDANT would then resolve
            against it instead of the viewport — `ContractSubheader` is sticky at
            `top: var(--cs-hdr-h)` inside page content and would stop sticking.
            `clip` clips without creating a scroll container, so sticky descendants
            are unaffected, and it is the only value that permits `overflow-y:
            visible` on the other axis. The two nav rails are SIBLINGS of <main>,
            not descendants, so they were never at risk.

            Consistent with an existing owner decision, not a new pattern:
            src/index.css:41-58 records `overflow-x: clip` being REMOVED from
            <html> on 2026-08-08 because root-level overflow disturbs scroll
            anchoring — with the instruction "clip it on THAT element rather than
            on the document root." This is that element. It does not reintroduce
            the anchoring regression, because <main> never becomes a scroll
            container under `clip`. */}
        <main className="flex-1 min-w-0 overflow-x-clip px-4 sm:px-8 xl:px-12 pt-10 sm:py-9 pb-24">
          <CreateModalTriggerContext.Provider value={createModalTrigger}>
            <Outlet />
          </CreateModalTriggerContext.Provider>
        </main>
      </div>

      {/* MOBILE NAV DRAWER — the side menu as an overlay panel, now the ONLY
          mobile menu (ONEMENU: absorbs the old avatar dropdown). Members get
          the same canonical-order quick-access set as the desktop rail (I6,
          now including My Saved Items — see that comment) PLUS the trailing
          Account/App-tour/Sign-out block the dropdown used to carry; staff
          get their grouped management nav PLUS the same trailing block, now
          including a personal Account link they never had in any mobile
          surface before. A click on any link inside closes it (delegated
          `closest('a')` handler below — Sign out/App tour are buttons, not
          links, so `NavFooter` closes explicitly via its own `onNavigate`).
          T5, corrected 2026-08-10: NAV_PANEL is near-white (`bg-cream-25`),
          not solid green — that was true only of an earlier direction the
          owner reversed. See its definition near the top of this file. */}
      {/* THE DRAWER TAB IS GONE — ONEHEADER §3 (owner, 2026-08-08). No hanging
          tab: the header's avatar button is the way into the nav on a phone, so
          there is one control for one job instead of a tab bolted to the side of
          the viewport. The `.cs-drawer-tab` rules ride out with the shelved
          cardstock stylesheet, which is no longer imported.

          Sequencing held, per the task doc: the tab was the ONLY way into the
          nav on mobile, so it could not go until the avatar button existed. It
          does — see AppHeader above, and note it drives this same
          `mobileNavOpen` state, so the two can no more desync than the tab
          could.

          Superadmin never had the tab; it keeps its own mobile nav button and
          its own drawer anchor — see the `isSuperAdmin` checks below. */}

      {drawerMounted && (
        <div
          ref={drawerWrapRef}
          /* `pointer-events-none` ONLY while not shown — i.e. during the exit,
             when the panel is on its way out and taps should already be reaching
             the page again. While OPEN the wrapper stays hit-testable, which is
             what keeps §F's job 2 (blocking taps to the content behind) working
             independently of the tint. */
          className={`fixed inset-x-0 bottom-0 top-[var(--cs-hdr-h)] z-50 lg:hidden ${drawerShown ? '' : 'pointer-events-none'}`}
          role="dialog" aria-modal="true" aria-label="Menu"
          onKeyDown={onDrawerKeyDown}
        >
          {/* MOBILEPASS: this comment previously claimed a black/white scrim per
              B4 (owner, 2026-08-07) — stale. The very next day (7adee89f,
              2026-08-08) the scrim was deliberately moved back to green-950/45
              and the owner said "contrast looks better"
              (OPEN-CHANGE-REQUESTS-2026-08-08.md, C6: "still not settled" but
              never reverted).
              NAVMOTION §F: lightened 45% -> 30% and, more to the point, it now
              FADES instead of arriving whole. Both knobs — the tint and whether
              it fades or slides — are named constants at the top of this file.
              It is still the close target and still the tap blocker; nothing
              about removing it has been done here, because removal is the second
              look and this is the first. */}
          <div
            className={`absolute inset-0 ${SCRIM_TINT} ${
              SCRIM_ENTERS_AS_FADE
                ? `transition-opacity ${DRAWER_EXIT} ease-glide ${drawerShown ? 'opacity-100' : 'opacity-0'}`
                : `transition-transform ${DRAWER_EXIT} ease-glide ${drawerShown ? 'translate-x-0' : '-translate-x-full'}`
            }`}
            onClick={closeMobileNav}
            aria-hidden="true"
          />
          <nav
            id="app-nav-drawer"
            ref={drawerRef}
            tabIndex={-1}
            /* §E — THE DRAWER OPENS FROM THE LEFT, FOR EVERYONE, FROM ONE PATH.
               The `${isSuperAdmin ? 'left-0' : 'right-0'}` conditional is GONE.
               Owner: "since the desktop uses a left side menu… the app feels off
               since i have been used to seeing the nav on the left." Superadmin
               already opened left, so the app was giving three answers across
               three surfaces — desktop rail left, superadmin drawer left, tenant
               drawer right — and this makes all three agree while deleting a
               branch rather than adding one.
               THE ACCEPTED COST, recorded so it is not rediscovered as a
               surprise: on a large phone the links are now a reach across from
               the avatar. The rows are full-width down the whole panel, so the
               lower ones stay thumb-reachable; the top-left ones are a longer
               reach than they were. The owner has taken this trade.
               §C1: `duration-440` — declared in tailwind.config.js as "440 for a
               panel crossing the screen" and, until this line, used nowhere in
               src/. The exit is quicker than the entrance (320) because a fast
               exit reads as responsive where a slow one reads as sluggish; it
               does not exceed the open duration. */
            className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] ${NAV_PANEL} shadow-xl p-3 overflow-y-auto overscroll-contain focus:outline-none transition-transform ease-glide ${
              drawerShown ? `translate-x-0 ${DRAWER_ENTER}` : `-translate-x-full ${DRAWER_EXIT}`
            }`}
            onClick={(e) => {
              // any real navigation inside closes the drawer
              if ((e.target as HTMLElement).closest('a')) closeMobileNav();
            }}
          >
            {/* I3, amended B2 (owner, 2026-08-07): the "Close" button is
                removed for tenant users — the drawer tab now closes the
                drawer and rides out on its own edge, a second control for
                one job. Superadmin has no such tab (excluded from ONEMENU's
                consolidation) and reaches this same shared drawer via its own
                separate mobile-nav button, so it keeps an explicit close
                control here. */}
            <div className="flex items-center justify-between px-1 pt-1 pb-4">
              <span aria-hidden="true" />
              {isSuperAdmin && (
                <button type="button" onClick={closeMobileNav} aria-label="Close menu"
                  className="flex items-center gap-1.5 pl-3 pr-3 py-2.5 rounded-lg bg-cream-200 text-green-800 font-medium text-[13px] font-sans hover:bg-cream-200/70 focus-ring">
                  Close <PanelLeftClose size={16} aria-hidden="true" />
                </button>
              )}
            </div>
            {!isSuperAdmin && (
              <div className="flex flex-col gap-0.5 mb-1">
                <CommunityNav onNavigate={closeMobileNav} />
                {!showRail ? (
                  <ClientNavItems bellCount={unreadCount} dmCount={dmCount} presence={presence} lessonsOn={lessonsOn} onNavigate={closeMobileNav} />
                ) : (
                  <StaffNavItems dmCount={dmCount} />
                )}
              </div>
            )}
            {navGroups.map((g) => (
              <div key={g.key}>
                <div className={`mt-2 border-t ${NAV_DIVIDER} pt-2 ${NAV_INSET_ROW} pb-1 text-[10px] tracking-widest uppercase ${NAV_HEADING} font-semibold`}>
                  {g.label}
                </div>
                {/* REVIEW SECTION — the same one-line note the rail carries, on
                    the same conditional. Renders for no other group. */}
                {g.note && (
                  <p className={`${NAV_INSET_ROW} pb-1.5 text-[11px] leading-snug text-gold-800`}>{g.note}</p>
                )}
                <div className="flex flex-col gap-0.5">
                  {g.items.map((it) => <RailLink key={it.to} {...it} />)}
                </div>
              </div>
            ))}
            {/* ONEMENU — absorbed from the removed avatar dropdown, staff
                only (members already end their own list with AccountNavLink
                above — I6). RESTORED 2026-08-15 (Review experiment ended) —
                the drawer half of the same move as the rail above. */}
            {!isSuperAdmin && showRail && (
              <div className="mt-1 flex flex-col gap-0.5">
                <AccountNavLink onNavigate={closeMobileNav} />
              </div>
            )}
            {!isSuperAdmin && (
              <NavFooter onOpenTour={() => setTourOpen(true)} onSignOut={handleSignOut} onNavigate={closeMobileNav} />
            )}
          </nav>
        </div>
      )}

      {createOpen && (
        <CreateModal
          initialStep={createStep}
          onClose={() => { setCreateOpen(false); setCreateStep('destination'); }}
        />
      )}

      {/* A3: the tour. Auto-opened on first login (stamps the marker on
          dismiss) or re-opened from the avatar menu (leaves the marker be). */}
      <AppOverviewModal
        open={tourOpen}
        onClose={() => closeTour(tourSeen === false)}
        categories={tourCategories}
        presence={presence}
        lessonsOn={lessonsOn}
      />
    </div>
  );
}
