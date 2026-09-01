# TASK PAGETITLES — page title restructure + copy pass (owner spec 2026-08-05)

Pure UI/copy task. No DB. `ClauseDocument.tsx` FROZEN (not implicated). Do not touch
`AppLayout.tsx` (nav/header design work pending elsewhere) — these are page-level headers
inside pages.

## The title model (new rule, applies app-wide for USER-facing pages)
Default: a page shows ONLY the small all-caps gold eyebrow title (e.g. "YOUR ACCOUNT",
"CATALOG"). The larger dark-green display text is NOT a default title anymore — it is an
optional per-page intro line with page-specific content. Find the shared/repeated
title-render pattern; if titles are per-page ad hoc, change the pages below and note in the
report which other pages still carry a large title so the owner can rule on them.

## Per-page changes
1. **Community Feed** (`Home.tsx`):
   - Gold eyebrow: the feed's title (per current view meta).
   - Large dark-green intro: "Welcome new members!"
   - Description (the tagline under it) becomes EXACTLY: "This is a space to share your
     experiences at the ranch, links you find helpful, events you hear about, and ads for
     tack or gear you no longer use that others may need."
     (This supersedes the tagline shipped in TASK-UIPOLISH.)
2. **Dashboard**: swap — gold eyebrow "DASHBOARD"; large dark-green text "Good Morning
   {first name}" (use the existing greeting/name source if one exists; match the app's
   existing time-of-day greeting behavior if present — if none exists, "Good Morning" static
   is WRONG at 8pm; implement Good Morning/Afternoon/Evening by local time).
3. **Calendar**: NO title changes.
4. **Catalog**: swap — gold eyebrow "CATALOG"; large dark-green "Shop".
   - Imageless offering cards: REMOVE the placeholder text "swap {category name} image"
     (render no placeholder text; keep whatever neutral background the card has).
   - Rename the "Transaction Assistance" card to "Acquisition Assistance" — AND the content
     rendered when the card is opened. Find the source (offering name in DB vs hardcoded
     label): if it's DB data (offerings table), update the offering row(s) (name + any
     description text containing "Transaction Assistance") and log the exact statements; if
     hardcoded, fix the code. Check for BOTH.

## Rules
- Branch `task/pagetitles` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-pagetitles -b task/pagetitles origin/main`).
  Copy this doc + `.env.db` from the shared checkout (only needed if the catalog rename turns
  out to be DB data).
- Production DB writes: at most the offering-name/description rename, logged. Nothing else.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors).
- Update `docs/archive/BUILD_TRACKER.md` section I with a row for this pass, honest status.
- Report: `docs/reports/TASK-PAGETITLES-REPORT.md`, committed + pushed. Print ONLY the
  report path.
