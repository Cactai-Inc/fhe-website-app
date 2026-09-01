# TASK I1B — staff/admin sidebar collapse toggle (remediation of I1's missing half)

Tracker I1 said: collapse/expand becomes **staff/admin only** — remove from USER accounts.
TASK I removed the USER half (done, merged) but built nothing for staff, reading the spec as
reducible to "nobody has it" since staff never had one. Owner ruling 2026-08-05: that reading
was wrong — staff/admin GAIN the capability. This task builds it.

## What to build
The staff rail (`AppLayout.tsx`'s `showRail` staff `<aside>`) gets a collapse control with the
same interaction model the USER rail used to have (removed in commit "task/i-user-nav-ux" —
recover the pattern from git history of `ClientRail`: pinned/unpinned state persisted in
`localStorage`, hover-to-peek when collapsed, `PanelLeft`/`PanelLeftClose` toggle):
- Pinned (default): full-width rail exactly as today.
- Collapsed: icon-only strip (~56px) — each staff nav item renders its icon with a tooltip
  (`title`); group headings (MANAGEMENT/PEOPLE/COMMUNITY/MODULES) collapse to separators.
  Hovering the strip peeks the full rail; clicking the toggle pins it back open.
- The toggle: staff-only by construction (it lives in the staff aside). Style consistent with
  the I3/I4 work (fill-only active states — the gold ring was removed by owner ruling; do NOT
  reintroduce it).
- Persist per-browser in `localStorage` (same key pattern the old ClientRail used).
- Mobile staff drawer is NOT in scope — collapse is a desktop-rail behavior.

CommunityNav's old `open?: boolean` collapsed branch was deleted as dead code in TASK I — if
the icon-strip needs a collapsed CommunityNav row, re-add the minimal branch (icon + tooltip
only), not the full old implementation.

## Second item (owner spec 2026-08-05): mobile menu button moves to the header
The mobile sidebar's "Menu" trigger currently lives in the content area. Move it into the
header bar, positioned to the RIGHT of the F logo mark with comfortable spacing (breathing
room, not cramped against it — match the header's existing horizontal rhythm). Applies to
whichever account types have the mobile drawer (both staff and USER if both do — find the
render site(s)). The drawer itself and its Close behavior (I3) are unchanged — only the
opener moves. Remove the old in-content trigger; no duplicate triggers.

## Rules
- Branch `task/i1b-staff-collapse` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-i1b -b task/i1b-staff-collapse origin/main`).
  Copy this doc from the shared checkout (untracked). No DB access needed — pure UI; do NOT
  copy .env.db, do NOT touch the DB.
- `ClauseDocument.tsx` FROZEN (not implicated).
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors).
- Update `docs/archive/BUILD_TRACKER.md` I1 honestly ("USER removal shipped + staff toggle
  code-complete, browser pending").
- Report: `docs/reports/TASK-I1B-REPORT.md`, committed + pushed. Print ONLY the report path.
