# TASK I1B — staff/admin sidebar collapse toggle (remediation of I1's missing half)

Branch: `task/i1b-staff-collapse` (own worktree, off `origin/main`)
Status: **code-complete, browser verification pending** (typecheck/typecheck:api/lint all pass)

## Context

Tracker I1 said collapse/expand becomes staff/admin only, removed from USER accounts. TASK I
removed the USER half (ClientRail's pin/hover toggle → fixed 240px rail) but read the spec as
"nobody has it," since staff never had a toggle to begin with. Owner ruling 2026-08-05: that
reading was wrong — staff/admin gain the capability. This task builds it.

## What was built

### 1. Staff rail collapse toggle
Recovered the removed pattern from git history: `ClientRail` (the old USER rail, deleted in
commit `cc39087`, full body at `cc39087^:src/components/app/AppLayout.tsx` lines 353-418) had
a pin/hover-to-peek toggle using `localStorage`-persisted `pinned` state, `PanelLeft` /
`PanelLeftClose` icons, and a hover-expands-without-layout-shift `<aside>`/`<nav>` width split.

Rebuilt on the staff `<aside>` in [AppLayout.tsx](src/components/app/AppLayout.tsx) (the
`showRail` block):
- New state on `AppLayout`: `staffRailPinned` (persisted to `localStorage` key
  `staffRail.pinned`, mirroring the old `clientRail.pinned` key pattern) and `staffRailHovered`;
  `staffRailOpen = staffRailPinned || staffRailHovered`.
- Pinned (default): full-width rail (`w-60 xl:w-64`), exactly as today.
- Collapsed: 56px (`w-14`) icon strip. Hovering the strip peeks the full rail (no layout
  shift — the `<aside>` reserves 56px, the sticky `<nav>` overlays wider on hover, same
  mechanism the old ClientRail used).
- Toggle button (`PanelLeft`/`PanelLeftClose`, same as before), staff-only by construction
  since it lives inside the staff `<aside>`.
- Group headings (Management/People/Community/Modules) collapse to a plain `<div>` separator
  (`role="separator"`) when the rail is collapsed; their items still render (icon + `title`
  tooltip) rather than disappearing.
- `RailLink` gained an `open` prop: collapsed renders icon-only (centered, `title` tooltip,
  badge as a small corner dot); expanded is unchanged from before.
- `CommunityNav` regained the minimal collapsed branch TASK I deleted as dead code (its old
  `open?: boolean` prop and icon-only return) — re-added only the icon+tooltip link, not the
  full old implementation, per the task doc's instruction.

**No gold ring reintroduced.** The fill-only active state from I4 (`bg-cream-200
text-green-800 font-medium`) is unchanged everywhere, including the new collapsed-icon states
(`text-gold-400` on the icon itself is the pre-existing icon-accent convention, not the removed
ring).

### 2. Mobile menu button moved to the header
Owner spec 2026-08-05: the mobile drawer's "Menu" trigger moves from the content area into the
header, to the right of the F logo mark, with breathing room.

- Removed the in-content trigger (previously the first element of `<main>` on every page).
- Added a single trigger in the header's left-hand group, immediately after the logo `<Link>`
  (`gap-3` matches the header's existing rhythm), `lg:hidden` so it only shows where the
  desktop rail isn't present.
- Same render site serves both staff and USER account types — `AppLayout` is the one layout
  both go through, so there was only one trigger to move, not two.
- The drawer itself and its Close behavior (I3) are untouched — only the opener moved.

## Files changed
- `src/components/app/AppLayout.tsx` — all of the above.
- `docs/BUILD_TRACKER.md` — I1 row corrected (USER removal shipped, staff toggle was the
  missing half); new I1B row added, honest about browser-pending status.
- `docs/tasks/TASK-I1B-staff-collapse.md` — copied into the worktree (untracked in the shared
  checkout).

`ClauseDocument.tsx` was not touched (frozen, not implicated). No `.env.db`, no DB access —
pure UI task as scoped.

## Done-checks
- `npm run typecheck` — clean.
- `npm run typecheck:api` — clean.
- `npm run lint` — 29 warnings / 0 errors (baseline, unchanged).
- `npm run build` (Vite bundle step) — succeeds. The build script's prerender step
  (`scripts/prerender.mjs`) fails with `supabaseUrl is required` — confirmed this is
  pre-existing on `origin/main` with no changes applied (this worktree has no `.env`/DB
  access by design), not a regression from this task.

## Retry log
No failures encountered; single pass, no retries needed.

## Not done / pending
- Browser verification (visual pinned↔collapsed transition, hover-peek, tooltip readability,
  mobile header button spacing) — flagged per the task doc's own "browser pending" framing.
