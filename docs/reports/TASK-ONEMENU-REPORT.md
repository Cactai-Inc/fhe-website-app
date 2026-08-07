# TASK ONEMENU — Phase 2 report

Branch `task/onemenu`, worktree `fhe-worktree-onemenu`, off `origin/main` at `7320419`
(fast-forwarded from the Phase 1 base `b8b078a` before starting — picked up C5b, the
OWNER RULINGS section and section D). Built against the doc as it stood after all six
Phase 1 questions were answered.

Files touched — exactly the three this task owns:

- `src/components/app/AppLayout.tsx` (+295/−132 lines)
- `src/components/app/CardstockHeader.tsx` (rewritten avatar + trimmed props)
- `src/components/app/header-cardstock.css` (+167/−90 lines)

`App.tsx`, `AccountHub.tsx`, `AccountPanels.tsx` — untouched, per the file-ownership
split with ACCOUNTSURFACE. `ClauseDocument.tsx` — untouched, not involved.

`npm run typecheck`: 0 errors. `npm run lint`: 0 errors, 30 warnings — identical count
and identical two `AppLayout.tsx` warnings (lines 236/243, both pre-existing
`export function` fast-refresh notices on `manageNavGroups`/`MANAGE_NAV`) confirmed via
`git stash` diff against the pre-edit file. No new warnings anywhere.

---

## A — Consolidation

### A1 — tab mirrored to the top-right

`.cs-drawer-tab`: `left:0`→`right:0`, `translateX(min(...))`→`translateX(-1 * min(...))`,
border-radius `0 10px 10px 0`→`10px 0 0 10px`. The mobile drawer `<nav>` itself:
`left-0`→`right-0` (tenant only — see Superadmin below).

**Found and fixed a real bug the Phase 1 report explicitly flagged as unverified:**
A1 requires the arrow to point left at rest and right when open. The chevron's rotate-
on-open mechanism doesn't encode which edge it belongs to, so I assumed mirroring the
tab's position wouldn't need to touch it — Phase 1 said exactly that, but declined to
assert the rest-state direction without checking. I built a screenshot harness (see
Verification below) and it showed the opposite of spec: right-pointing at rest,
left-pointing when open. Fixed by rotating the base `.cs-arrow` 180° and having
`.is-open` rotate back to 0 instead of to 180 (`header-cardstock.css`, the
`.cs-drawer-tab .cs-arrow` rule and `.is-open .cs-arrow`). Re-screenshotted — closed
now reads `<`, open reads `>`, matching spec.

No gutter added anywhere; the tab still overlaps page content while scrolling by
design — confirmed nothing in `<main>`'s spacing or the drawer's z-index changed that.

### A2 — avatar menu absorbed

Built role-aware, per the Phase 1 migration table, now executed against the OWNER
RULINGS:

- **Members**: `ClientNavItems` gains `My Saved Items` (ruling #5 — was excluded from
  the old I6 canonical order specifically because the avatar dropdown carried it as a
  bonus shortcut; that dropdown is gone, so it's the item's only remaining home),
  presence-gated identically to Orders/Documents/My Posts/My Stable. `AccountNavLink`
  was already last in the list — unchanged position.
- **Staff (admin + instructor, ruling #4 — converge)**: new `StaffNavItems` component
  adds Catalog and Messages next to the existing Dashboard/Calendar (mirrors the
  member canonical order's own Dashboard/Calendar/Catalog/Messages sequence — not an
  arbitrary placement). New `AccountNavLink` call after the management groups — staff
  had **no** personal Account link in any nav surface before this (ruling #3, "no
  exceptions" — confirmed genuinely missing in Phase 1, not assumed).
- **Everyone**: new `NavFooter` component — App tour, then Sign out, in a trailing
  block below everything else, on both the rail and the drawer.
- **Superadmin**: entirely excluded from all of the above — see its own section below.

`PRESENCE_LINKS` and `MenuLink` are untouched (old labels, old styling) — they're now
exclusively read by the preserved `accountMenu`, which only superadmin's header still
renders. Left as dead-for-tenant rather than edited, since editing them would be
editing "chrome" that's supposed to stay byte-identical for the one caller left.

### Q2 — the avatar is an inert monogram (owner ruling #1, resolves the Phase 1 tension)

`CardstockHeader.tsx`: the avatar `<button>` is now a plain `<span aria-hidden="true">`
— no `onClick`, no `onPointerDown/Up/Leave/Cancel`, no `is-pressed` state, no
`aria-label`/`aria-expanded`. `header-cardstock.css`: removed the hover/press
transitions on `.cs-ring-wall`/`.cs-ring-dark`/`.cs-ring-breath`/`.cs-av` (all
`:hover`/`.is-pressed` variants deleted at every breakpoint, including the two that had
their own inverse-scale press values at ≤480px and landscape); the static rest-position
`transform: translateY(1px)` on `.cs-av` stays — that's the fixed deboss geometry, not
an animation. `AppLayout.tsx`: `menuOpen`/`menuRef`/`accountMenu` all still exist (see
Superadmin) but are no longer passed to `CardstockHeader` at all.

### Q4 — desktop (owner ruling — universal, not mobile-only)

`ClientRail` and the staff `<aside>` both gained the same `NavFooter` (App tour, Sign
out) and, for staff, the same new `AccountNavLink`. This was flagged in Phase 1 as a
hard constraint, not optional — desktop had genuinely no other sign-out path.

---

## B — Drawer corrections

- **B0** — `.cs-avatar` wrapper widened 50→56px (42→48px at ≤410) to match `.cs-logo`.
  Added an anti-stretch override (`.cs-avatar svg` / `.cs-avatar .cs-mark-sm`) so the
  SVGs themselves stay drawn at their literal 50×50 / 42×42 size, centered via
  `transform: translate(-50%,-50%)` rather than resized — the generic
  `.cs-mark svg{width:100%}` rule would otherwise have stretched them.
  **Measured, not eyeballed**: `getBoundingClientRect()` on the live rendered header
  shows `leftGap === rightGap === 244.65625px` exactly, and the avatar SVG's computed
  width is still `50px`. The 6px asymmetry is gone.
- **B1** — `.cs-drawer-tab::before`, an invisible pseudo-element extending the hit area
  14px left / 6px top+bottom (same technique `.cs-tab::before` already used for the
  create tab). Not tested with an actual touch simulator, but the box math clears the
  44×44 guideline on the previously-short width axis.
- **B2** — Close button removed for tenant, `Menu` label stays. **Superadmin keeps
  it** — see below. Verified in code (not just by memory) that all four close paths are
  independent of the button: scrim `onClick`, the Escape `useEffect`, the route-change
  `useEffect`, and the `<nav>`'s own delegated `closest('a')` handler — none reference
  the Close button.
- **B3 / C5b** — done together, see the C5b section below (C5b explicitly supersedes
  B3's accent-bar suggestion).
- **B4** — scrim `bg-green-950/50` → `bg-black/40`. Applied unconditionally, including
  superadmin's drawer (reasoned in Phase 1: this is a neutral utility color fixing a
  real legibility problem on the same shared green-glass component, not tenant
  branding — flagged as a judgment call, not silently assumed).
- **B5** — `<main>`'s `py-6 sm:py-9` → `pt-10 sm:py-9` (only the mobile top value
  changed; `pb-24`, which already won the cascade over `py-6`'s bottom value before
  this, is untouched). Applied universally, including superadmin's own pages — reasoned
  the same way as B4.
- **B5b** — new `@media (max-width: 600px)` step, inserted between the 820px and 480px
  blocks, moving *only* the long/short wordmark swap up from ≤480px. Chose a new step
  over moving the whole ≤480 tier: the ≤480 bucket's other values (30px font, 12px
  padding) were tuned for phones, not this 481–590px small-tablet/split-screen gap, and
  dragging them up too would have been a second, unrequested change. 600px gives ~10px
  of margin over the measured 590px need.
- **B6** — no code change; confirmed via the earlier Explore pass that every title
  block is already left-aligned. Nothing to do.

### Superadmin — the one thing Phase 1 got wrong, caught before shipping

Phase 1 said Part A's changes wouldn't touch superadmin's code path. That's true for
the header (fully separate markup, no `cs-*` classes) but **not** for the mobile
drawer overlay — it's one shared component instance, and superadmin's own
`PanelLeftOpen` button sets the same `mobileNavOpen` state that opens it. Mirroring the
drawer unconditionally would have moved superadmin's mobile nav to the right edge too,
and removing the Close button unconditionally would have left superadmin (which never
gets the new tab) with no explicit close control at all — only scrim/Escape/link-click.

Fixed by conditioning both on `isSuperAdmin`: the drawer `<nav>` renders `left-0` for
superadmin, `right-0` otherwise; the Close button renders only `{isSuperAdmin && (...)}`.
Superadmin's mobile drawer is therefore left exactly as it behaved before this task —
left-anchored, with its Close button. `accountMenu`, `MenuLink`, `menuOpen`, `menuRef`,
and the outside-click/Escape-close effect are all still fully intact and unchanged,
now serving only superadmin's own avatar button.

---

## C — Desktop rail corrections

- **C1** — the collapse button is icon-only unconditionally (label dropped, not just
  hidden) and moved into its own `flex justify-end` row so it sits flush against the
  panel's right edge at both widths.
- **C2 / C3** — root-cause fix, not a duration tune. Deleted `staffRailHovered` and the
  `<aside>`'s `onMouseEnter`/`onMouseLeave` entirely. `<aside>` and `<nav>` now read a
  single `staffRailWidthClass` string (`staffRailPinned ? 'w-60 xl:w-64' : 'w-14'`)
  computed once and reused at both call sites — not just the same *value*, the same
  *string*, so they cannot drift even by a future edit to one but not the other. Every
  other `staffRailOpen` reference in the file (the group-heading toggles, the collapsed
  separator, `RailLink`'s `open` prop, `CommunityNav`'s `open` prop) now reads
  `staffRailPinned` directly.
- **C4** — evaluated `ExplainTip` first, as the doc asked, and rejected it (documented
  inline in `AppLayout.tsx` next to the new `NavTooltipLabel` component): it fires on
  hover with no delay, adds click-to-pin state + `role="button"` + a dotted-underline
  cue built for inline prose, and wraps its own trigger — all wrong for a row that's
  already its own `NavLink`/button. Built a small CSS-only alternative instead:
  `transition-delay` applied only via the `group-hover`/`group-focus-visible` variant,
  so it shows slow and hides fast with no JS state at all. Screenshotted at 600ms (no
  tooltip yet) and 1300ms (tooltip visible, positioned correctly) to confirm the delay
  actually works, not just that the CSS compiles.
- **C5** — `CommunityNav`'s collapse toggle: chevron 15px→18px, label `text-[10px]`→
  `text-[13.5px]`, matching the rest of the rail. Confirmed by screenshot, not just by
  reading the class names back.
- **C5b** — see below.
- **C6** — `--cs-tab-right: calc(112px + ...)` → `calc(124px + ...)`, applied as the
  literal owner-given value rather than re-derived from B0's geometry change (Phase 1
  flagged these as compounding but ambiguous which way). **Verified by measurement**:
  computed `right` on `.cs-tab` is `124px` in the live render, and the mirrored
  stock-seam layer (`.cs-tab::after`, which reads the same variable) moves with it by
  construction since both consume the one custom property — didn't need a second,
  independent check.

### C5b — nav state colours (supersedes B3)

Applied identically to all four named components — `RailLink`, `PresenceLink`,
`AccountNavLink`, `CommunityNav` (both its collapsed icon-strip and its expanded parent
row + nested sublinks):

- **Default**: unchanged, today's `text-secondary` / `text-green-600` icon.
- **Selected**: `bg-green-800` fill, `text-cream-100` text **and icon** — this replaces
  the old gold-icon-on-active convention (I4), not just the cream-vs-white fill. Kept
  the gold badge pills (unread counts) untouched — not part of this spec, still reads
  fine on the new green fill.
- **Hover (desktop only)**: `lg:hover:bg-green-800/10` + `lg:hover:text-cream-100` (and
  `lg:group-hover:text-cream-100` on icons). Scoping every hover class behind the `lg:`
  responsive prefix — rather than `@media(hover:hover)` or a variant prop — does two
  things at once: it's genuinely desktop-only (the rail only renders at `lg+` anyway),
  and it means the mobile drawer gets **zero** hover styling of any kind, old or new,
  which is exactly "do not invent a touch equivalent of hover."

**Accessibility fix found while touching these components**: `PresenceLink`,
`AccountNavLink`, and `CommunityNav`'s Link-based rows compute `isActive` manually
(unlike `RailLink`'s `NavLink`, which sets `aria-current` automatically) and were not
setting `aria-current` at all. Added `aria-current={isActive ? 'page' : undefined}` to
all of them — B3's own text asked to keep this signal color-independent, which isn't
possible if it was never being set in the first place for three of the four components.

---

## D — Nav labels and the stable link

### D1 — `My` labels applied

In `ClientNavItems` (member canonical order): `Lessons`→`My Lessons`,
`Orders`→`My Orders`, `Documents`→`My Documents`. `My Posts` was already correctly
cased. In `StaffNavItems`/the new staff `AccountNavLink` call: `Account` stays plain
(per the one named exception). Left `PRESENCE_LINKS`'s own label strings (`Documents`,
`Orders`, `Stable`) untouched — confirmed via code trace that its only remaining
reader, `accountMenu`, is only reachable by superadmin, for whom `presence` is always
empty (staff never populate `useNavPresence`), so that branch never actually renders —
editing it would be a no-op for behavior and an unnecessary touch to superadmin-only
code.

### D2 — `/app/stable` — confirmed absent, left alone

Grepped `App.tsx` on `origin/main` for `path="stable"` before starting: no match, and
no route resembling it anywhere under `/app`. Per the doc's explicit instruction, the
two call sites (`PRESENCE_LINKS`'s `stable` entry is untouched dead code per D1 above;
the live one is `ClientNavItems`'s `PresenceLink to="/app/account?section=stable"`)
were **left pointed at the existing `?section=stable` link**, with an inline comment
recording that the check was made and what it found. **ACCOUNTSURFACE needs to ping
this thread once `/app/stable` ships** — repointing is a one-line change at that point
(`ClientNavItems`'s single `PresenceLink to=` call), but it wasn't safe to do blind.

---

## Verification

Walking the doc's own Phase 2 checklist:

1. **Every avatar-menu item reachable in the merged menu** — yes, walked the Phase 1
   migration table item by item during the build; the two real gaps it found (staff
   Account link, My Saved Items) are both now present. ✅
2. **Sign out works** — `NavFooter`'s Sign-out button calls the same `handleSignOut`
   that always existed (`setMenuOpen(false)` [now a harmless no-op for tenant users
   since `menuOpen` never becomes true for them] → `signOut()` → `navigate('/')`).
   Verified by code trace, not a live click — see "Not verified" below. ⚠️
3. **All four close paths** — verified by code trace (B2 above): scrim, Escape,
   route-change, delegated link-click are each wired independently of the removed
   button. ✅
4. **Tab tappable at the right edge, ≥44px** — B1's hit-slop extends the 34px box to
   effectively ~48px on the content-facing side; not measured with an actual touch
   simulator. ⚠️
5. **Nothing covered at initial load, 390px, unscrolled** — not screenshotted inside
   the real app (no auth available in this environment — see below); reasoned from the
   unchanged `<main>` layout and the tab's fixed position that this holds, but it's the
   one item I'd most want a real screenshot of before calling this fully done. ⚠️
6. **Tab tappable at its edges** — same caveat as #4.
7. **Current page identifiable without a fill** — superseded by C5b (a fill IS used
   again, just green) — screenshotted and confirmed the selected row reads clearly
   against both the cream-100/40 rail and the green glass drawer. ✅
8. **Avatar renders as a monogram, zero interactive behaviour** — confirmed in code
   (no handlers, no classes, no ARIA) and by screenshot (it renders, looks identical
   at rest). Press/hover removal can't be screenshotted, only code-traced. ✅ (code) /
   ⚠️ (interaction-absence, inherently hard to screenshot a negative)
9. **Desktop rail reads correctly after C5b** — screenshotted, both pinned and
   collapsed, selected state and default state visible and legible. ✅
10. **Superadmin's chrome unchanged** — the one place Phase 1 was wrong (the shared
    drawer) is now explicitly conditioned back to its original behavior — see the
    Superadmin section above. Not re-screenshotted live (no superadmin credentials
    either), verified by code trace of every `isSuperAdmin` branch touched. ⚠️
11. **Desktop unchanged unless Q4 said otherwise** — Q4 explicitly said otherwise
    (universal removal); ClientRail and the staff rail both intentionally changed. ✅
12. **Typecheck and lint clean** — ✅, see the top of this report.

### What was verified on a real device versus in a harness

**Nothing was verified on a real device or in the real running app with real
authentication** — this environment has no Supabase credentials (`.env` is gitignored
and not present in a fresh worktree, and none of the sibling worktrees on this machine
have one checked out either), so `/app/*` routes cannot be reached at all.

What I did instead, since shipping with zero visual confirmation felt too weak for a
change this size: built a throwaway Vite multi-page entry
(`preview-onemenu.html` + `src/dev-preview-onemenu.tsx`, both deleted before finishing,
never committed) that mounted the **real** `CardstockHeader` component directly, and
the real `RailLink`/`PresenceLink`/`AccountNavLink`/`CommunityNav`/`NavFooter`/
`StaffNavItems`/`ClientNavItems`/`ClientRail` functions from `AppLayout.tsx` via
temporary `export` keywords (reverted immediately after screenshotting — confirmed by
re-running lint against the restored file that the exports are gone and the warning
count is back to baseline). Wrapped in a `MemoryRouter` with mock `presence`/`badge`
data — no AuthContext, no Supabase, no real routing, so this proves the CSS/layout is
correct but nothing about the data-fetching hooks (`useNavPresence`, `useUnreadCount`,
etc.), which were untouched by this task anyway.

This harness is what caught the arrow-direction bug (see A1) and produced the B0/C4/
C5/C6 measurements cited above — it's a genuine, if partial, verification, not a
rubber stamp. It did **not** cover: the actual drawer overlay inside real page content
(item 5 above), touch-target size on an actual touchscreen (items 4/6), the safe-area
padding on an actual iOS device's Sign-out button (owner explicitly asked for this
check), or superadmin's live chrome.

### Still needing a real device or real login before this ships

- **Sign out's iOS safe-area handling** (owner's explicit ask). Code-level mitigation
  is in place (`pb-[max(0.75rem,env(safe-area-inset-bottom))]` on the Sign-out row in
  `NavFooter`) but this is exactly the kind of thing that can look right in every
  harness and still be wrong on an actual notched phone.
- **The drawer over real page content at 390px, unscrolled** (item 5) — the harness
  screenshots the drawer's own content correctly, but not layered over a real page.
- **Superadmin's live chrome**, to confirm the `isSuperAdmin` conditionals actually
  produce byte-identical behavior to before, not just correct-looking code.
