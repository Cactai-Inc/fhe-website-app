# TASK UIPOLISH — nav order/glass, header wordmark + logo, community feed copy

Branch: `task/uipolish` (own worktree, off `origin/main`)
Status: **code-complete, browser verification pending** (typecheck/typecheck:api/lint all pass;
no STOP triggered)

## Context

Owner spec 2026-08-05, six fully-specced UI items plus one conditional STOP gate (item 4's brand
font). Pure UI task — no `.env.db`, no DB access, `ClauseDocument.tsx` frozen.

## STOP gate check (item 4) — cleared, no stop needed

Checked `index.html`, `tailwind.config.js` `fontFamily`, and `src/index.css` for the true brand
font before touching the wordmark. Found it: **Cormorant Garamond**, hosted via a Google Fonts
`@import` in `src/index.css:25` (`family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;
0,700;...`), and documented as the "guaranteed render everywhere" face in
`tailwind.config.js`'s `fontFamily.display`/`fontFamily.serif` (Big Caslon is a macOS-only
progressive enhancement ahead of it, never a hosted asset). Weight 700 (bold) is present in the
import. Since the true brand font — including a bold weight — is genuinely in the codebase
assets, no substitution was needed and the STOP did not trigger.

## What was built

### I6 — one canonical USER nav order
Order: Community Feed, Dashboard, Calendar, Lessons\*, Orders, Catalog, Documents, Messages, My
Posts, My Stable, Account — identical across the mobile drawer, desktop USER rail, and the
welcome/first-visit modal's page list.

- New shared `ClientNavItems` component in
  [AppLayout.tsx](src/components/app/AppLayout.tsx) renders items 2–11 of the order (Community
  Feed stays a separate `<CommunityNav />` call at each site, matching the existing pattern);
  both `ClientRail` (desktop) and the mobile drawer's USER branch now render
  `<CommunityNav /><ClientNavItems .../>` instead of their previous separate, differently-ordered
  inline `QUICK.map`/`PRESENCE_LINKS.filter` logic.
- New `AccountNavLink` component: "Account" is now a rail item (it wasn't before — USER accounts
  previously reached Account only via the avatar dropdown). Active-state matching is
  pathname-plus-no-`?section=`, so it doesn't co-highlight with "My Stable" (which shares
  `/app/account` via `?section=stable`).
- **Lessons** (module-gated via `hasModule('mod.lessons')`, mirroring the staff nav's own
  `module: 'mod.lessons'` convention on `MANAGEMENT_GROUP`) is pending owner confirm per the task
  doc. Dropping it: delete the one `{lessonsOn && <RailLink to="/app/lessons" .../>}` line in
  `ClientNavItems`, and the small `if (lessonsOn) { lines.push(...) }` block in
  `AppOverviewModal.tsx`'s `pageLines()`.
- **Saved Content** is intentionally NOT part of this canonical order — the doc's "Applies to"
  bullet names exactly four presence-gated items (Orders, Documents, My Posts, My Stable),
  omitting it. It stays reachable from the Account page and from the avatar menu's own
  quick-access section (unchanged, see below).
- **Avatar menu: untouched.** `QUICK`/`PRESENCE_LINKS` (the arrays the avatar dropdown's
  quick-access section renders) were not modified, reordered, or relabeled — `ClientNavItems` is
  a fully separate component with its own hardcoded labels/order (e.g. "My Stable" there vs. the
  avatar dropdown's still-unchanged "Stable"). Diffed the avatar-dropdown JSX region
  specifically (the `menuOpen &&` block) — zero changes.
- **Welcome/first-visit modal** ([AppOverviewModal.tsx](src/components/app/AppOverviewModal.tsx)):
  `pageLines()` now takes `presence`/`lessonsOn` (same shape AppLayout already fetches) and lists
  the same items in the same order, gated the same way. This is used by BOTH places that render
  this modal — AppLayout's own auto-open/avatar-menu-reopen tour, and
  [Onboarding.tsx](src/pages/app/Onboarding.tsx)'s end-of-onboarding tour (the literal
  "first-visit" instance) — so both stayed threaded with live data rather than leaving one stale.
  Lessons in the modal changed from RIDER/BOTH-category gating to the same module gate as the
  rail, so the two surfaces never disagree on when it's shown.

### I7 — green glass nav surface
Mobile drawer + desktop USER rail (NOT the staff rail, which keeps its own distinct
`bg-cream-100/40` — out of scope per the doc).

- One shared constant, `NAV_GLASS`, near the top of `AppLayout.tsx`:
  - **Glass (ships):** `'bg-green-800/[0.07] backdrop-blur-md
    supports-[not(backdrop-filter:blur(1px))]:bg-cream-100
    supports-[not(backdrop-filter:blur(1px))]:backdrop-blur-none'`
  - **Solid (one-line revert):** `'bg-cream-100'`
- Applied to `ClientRail`'s `<nav>` and the mobile drawer's `<nav>`, replacing their previous
  literal `bg-cream-100`.
- Nav text/icon colors were not touched anywhere — `RailLink`/`PresenceLink`/`CommunityNav`/
  `AccountNavLink` all keep their existing `text-secondary`/`text-green-800`/`text-gold-400`
  classes, satisfying the hard constraint.

### I8 — community feed page copy + spacing
[Home.tsx](src/pages/app/Home.tsx) (the `/app` community feed page):
- Removed the smaller duplicate: the `eyebrow` `<p>Community Feed</p>` (always literally
  "Community Feed" regardless of the active filter) sat above an `<h1>` that also reads
  "Community Feed" on the default/all view — the smaller instance is gone, the `<h1>` (driven by
  `meta.title`, still correct per-filter) is what remains.
- Padding above the title increased 35%: the `<h1>`'s `mt-0.5` (0.125rem) → `mt-[0.169rem]`
  (0.16875rem, exact 1.35×), since with the eyebrow gone the `h1`'s own top margin is the only
  local spacing above the name.
- Tagline replaced in [seed.ts](src/lib/seed.ts) — `FEED_VIEW_META.all.description` only (the
  literal string the doc quoted belongs to the "All" view alone; the other 7 views' descriptions
  were untouched).

### I9 — mobile menu open button
`AppLayout.tsx`'s header trigger: was a bordered, labeled pill (`PanelLeft` icon + "Menu" text,
`border border-green-800/15 bg-white shadow-sm`). Now icon-only, square, no text, no outline —
`p-2 text-green-800 rounded-lg hover:bg-cream-100 focus-ring`, matching the header's existing
Create/Calendar icon buttons exactly. Icon swapped to `PanelLeftOpen` (confirmed present in the
installed `lucide-react`). `aria-label="Open menu"` kept.

### I10 — header wordmark + logo
Both items touch the same header lockup in `AppLayout.tsx`, so they were built together:

- **Logo (item 5):** the green "F" square replaced with the real favicon artwork
  (`public/favicon.svg` — the only logo/favicon asset in the repo; it's an SVG so there's no
  separate "highest-resolution variant" to choose, and it scales crisp at any size). Same link
  target as before (`/app`).
- **Wordmark (item 4):** "French Heritage" is no longer inline text next to the logo (that would
  now duplicate the new centered wordmark — same instinct as I8's dedup) — it's a new, separate,
  centered element. Header container changed from a 2-child `flex justify-between` to a 3-column
  `grid grid-cols-[auto_1fr_auto]` (left cluster / centered wordmark / right cluster) so the
  wordmark is genuinely viewport-centered regardless of the two clusters' widths.
  - **Debossed/letterpress technique:** fill color in the header surface's own family
    (`bg-white` → `text-white`), with a dual `text-shadow` — a dark shadow directly above
    (`rgba(13,33,24,0.45)`, simulating the recessed top edge in shadow) and a light shadow
    directly below (`rgba(255,255,255,0.85)`, the lower lip catching a highlight) — so the shape
    reads as pressed *into* the white surface rather than printed on it, per the doc's
    "dark inner top shadow + light lower edge" instruction.
  - **Font:** `font-display font-bold` — Cormorant Garamond weight 700 (bold, confirmed hosted —
    see the STOP-gate check above). The previous inline wordmark had no weight utility at all
    (default ~400, reads thin), which the doc explicitly rejected; this is a genuinely bolder
    render, not a cosmetic tweak.
  - **Both account types:** shown for USER and STAFF/ADMIN headers alike. Checked for a
    collision — the header row itself (this exact `<div className="...grid...">`) is identical
    for both; the staff/admin management rail lives *below* the header, not in this row — so
    there's no header-content collision to route around. Superadmin (the platform operator, no
    tenant) keeps its own unchanged "Cactai Platform" lockup and never shows the French Heritage
    wordmark; the centered grid cell renders empty in that case so the 3-column layout still
    holds (right cluster stays right-aligned, doesn't re-center into the empty middle column).
  - **Mark-only on mobile:** the new wordmark is `hidden sm:flex`, preserving this file's own
    pre-existing header doc comment ("logo mark + wordmark (mark-only on mobile)") — same
    responsive behavior the old inline wordmark had (`hidden sm:inline`).
  - Per the doc's own framing, this is a "verify visually plausible" item — the shadow/size/color
    values are a standard-technique starting point, not owner-eyeballed on a real screen (see
    Not done, below).

## Files changed
- `src/components/app/AppLayout.tsx` — I6, I7, I9, I10 (see above); `PanelLeftOpen` added to the
  lucide import.
- `src/components/app/AppOverviewModal.tsx` — I6 (pageLines reorder + presence/module gating,
  new required `presence`/`lessonsOn` props).
- `src/pages/app/Onboarding.tsx` — I6 (threaded `presence`/`lessonsOn` into its own
  `AppOverviewModal` call site, the other place this same modal renders, so both stay correct
  after the prop signature changed — not a new feature, just keeping an existing call site
  correctly wired).
- `src/pages/app/Home.tsx` — I8 (dedup + spacing).
- `src/lib/seed.ts` — I8 (tagline copy, "All" view only).
- `docs/archive/BUILD_TRACKER.md` — I6–I10 rows added under section I.
- `docs/tasks/TASK-UIPOLISH-nav-header-feed.md` — copied into the worktree (untracked in the
  shared checkout).

`ClauseDocument.tsx` was not touched (frozen, not implicated). No `.env.db`, no DB access — pure
UI task as scoped; `node_modules` was installed fresh in this worktree (gitignored, not part of
the diff).

## Done-checks
- `npm run typecheck` — clean.
- `npm run typecheck:api` — clean.
- `npm run lint` — 29 warnings / 0 errors (baseline, unchanged — no new warnings from this task's
  files).
- `npm run build:client` (Vite bundle step) — all 2084 modules transform successfully (confirms
  every edited file compiles through the real bundler, not just `tsc`). The step then fails
  copying `public/ffmpeg/ffmpeg-core.wasm` into `dist/` with `ENOSPC` — this environment's disk
  is at 99% capacity (134Mi free) system-wide, unrelated to this change; not attempted to fix
  (out of scope, and the disk pressure is host-level, not worktree-level).
- Dev server (`vite`) smoke-tested on the public landing route — 200, no runtime errors in the
  server log.

## Retry log
No failures encountered on any of the above checks; single pass, no retries needed.

## Not done / pending
- **Browser verification, all five UI items (I6–I10).** Every item lives inside `AppLayout.tsx`,
  which is behind Supabase auth. This task explicitly disallows `.env.db`/DB access, so there is
  no way to sign in and view the authenticated app shell in this worktree. This is a hard
  constraint of the task as scoped, not an oversight — flagged clearly rather than claiming a
  visual check that didn't happen. Specifically needs owner eyes on:
  - I7's glass tint strength (7% green + blur) against real nav content and scroll — the doc's
    own "tune by eye" instruction.
  - I10's debossed wordmark — white-on-white-plus-shadow is the standard letterpress technique
    but is the most extreme reading of "same color family as the header surface"; if it reads as
    too faint on a real monitor, the one-line fallback is a slightly warmer near-white
    (e.g. `text-cream-200`) instead of pure `text-white`.
  - I6's new "Account" rail entry and reordered items, for general layout/spacing at real
    viewport sizes (mobile drawer + desktop rail).
- **Lessons inclusion (I6, item 1's footnote)** — built in, module-gated, awaiting the owner's
  go/no-go; removal is a one-line drop in `ClientNavItems` plus a small conditional block in
  `AppOverviewModal.tsx`.
