# TASK PLUSPASS — contextual "+" create controls on every add-capable page

## Why this is urgent

The cardstock header (merged `123f8c0`) removed the universal "+" from the header for
everyone except admin/staff on desktop. Verified before writing this doc: **no page in
the app carries its own create entry point** — the header button was the only door. So
regular members currently have NO way to create anything. This is a live regression on
main; this task is the fix, and it is also the intended end state (owner ruling
2026-08-06): creation belongs on the page where the thing lives.

## The rule

Every page where the viewer can add something carries a visible `+` control — **icon plus
a short text label** (e.g. "+ Post", "+ Booking"), placed directly on the UI surface near
the page title / toolbar area, not floating, not in chrome, not a FAB. Everyone gets them;
admins simply see more of them because they can add more things.

The admin desktop header tab (universal CreateModal) is unaffected — it stays.

## Surfaces (owner's list, verified against the router)

| Page(s) | Control | Opens |
|---|---|---|
| Community feed (`Home.tsx`) + its filtered views + `MyPosts.tsx` | `+ Post` | the EXISTING CreateModal post flow (`feedPostCreate` path) — do not build a new composer |
| Calendar (`CalendarPage.tsx`) / booking surfaces | `+ Booking` | the existing booking flow for the viewer's bookable offerings |
| Catalog (`CatalogPage.tsx`) | (see note) | purchases start from an offering — if a `+` makes no sense here, say so in the report instead of forcing one |
| My Stable (`StablePage`/`HorsePage` list view) | `+ Horse` | the existing horse-intake flow (`HorseIntakePage`) |
| Messages (`Messages.tsx`) | `+ Message` | the existing new-thread flow (`createThread`) |

Read-first: for each surface, find the existing flow and wire the button to it. **This
task builds buttons, not flows.** If a page's create flow doesn't exist or is broken,
report it — do not build one.

Admin-only additions (documents, contracts, invitations, etc.) are a lower priority and
larger inventory: list the admin surfaces you find in the report with a recommendation,
but BUILD only the member-facing five above. A follow-up covers admin surfaces.

## Design

- One shared component (e.g. `PageCreateButton`) so placement, size, and styling are
  decided once. Icon + label, quiet secondary styling that fits the current app UI —
  this is NOT part of the cardstock/leather material design (that decision is still in
  an A/B); keep it conventional and easily restyled later.
- Placement: consistent position relative to the page title on every page. If a page's
  layout makes that impossible, flag it rather than improvising a new position.
- Gate each button on the viewer's actual capability (same checks the underlying flow
  performs) — never show a `+` that leads to a permission error.

## Constraints

- Own git worktree, branch `task/pluspass` off origin/main.
- `ClauseDocument.tsx` FROZEN. Header components (`CardstockHeader.tsx`,
  `header-cardstock.css`) — do not touch; this task is page surfaces only.
- Typecheck + lint clean.

## Verify

1. As a regular member (not staff): every one of the five surfaces shows its `+` and the
   flow it opens works end to end. THIS is the regression being fixed — if you cannot
   verify the member view, the task is not done; say what blocked you.
2. As admin: the same buttons appear plus nothing broken in the header tab.
3. No `+` appears anywhere the viewer lacks capability.

## Report

`docs/reports/TASK-PLUSPASS-REPORT.md` — per surface: what exists, what you wired, what
you verified with your own eyes vs. assume. List the admin-surface inventory at the end.
