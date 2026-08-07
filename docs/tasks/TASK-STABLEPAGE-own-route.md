# TASK STABLEPAGE — My Stable becomes its own page

My Stable is not a page. It is an inline panel on the account page, reached via
`/app/account?section=stable`, so the "My Stable" and "Account" nav links land in the same
place — the account page, with one row already expanded.

Give it a real route and room to breathe.

---

## What exists today

| Thing | Where |
|---|---|
| Nav link | `AppLayout.tsx:504` → `/app/account?section=stable` |
| Presence/nav item | `AppLayout.tsx:139` → same URL, `section: 'stable'` |
| The content | `StableSection()` in `AccountHub.tsx:63` — horses, gear, supplies, each loaded separately |
| The row | `AccountHub.tsx:213` — toggles the panel open inline |

The account page already mixes two behaviours, which is the underlying inconsistency:

- **Navigate to their own page:** My Posts, My Lessons, Orders, Gifts
- **Toggle open inline:** Profile & preferences, Saved items, Documents, **My Stable**

My Stable is in the wrong group. This task moves it, and **only it** — the other inline
rows are out of scope.

## What to build

1. **A route: `/app/stable`.** Follow whatever pattern `/app/my-posts` and `/app/lessons`
   already use; do not invent a new one.
2. **A real page.** Move `StableSection` out of `AccountHub.tsx` into its own page
   component. Its three groups — **horses, gear, supplies** — become proper page sections
   rather than stacked blocks inside a cramped panel. Use the app's established page
   header model (gold eyebrow + heading + description), as `Home` and the other pages do.
3. **Repoint the nav links** — both call sites above — to `/app/stable`.
4. **The account page row:** keep "My Stable" listed, but make it **navigate** rather than
   toggle, matching My Posts and My Lessons. The account page stays the hub; it just stops
   hosting the content.
5. **Retire `?section=stable`.** If a bookmark or an old link still carries it, redirect to
   `/app/stable` rather than 404 or silently ignoring it.

## Keep working

`StableSection` already does real work — three independent loads, an add-item modal, and a
horse-record path with microchip dedup (`AccountHub.tsx:168`). **Move it; do not rewrite
it.** If it needs restructuring to sit on a page, say what and why in the report rather
than reworking it silently.

## Coordination — read before starting

**`TASK-PLUSPASS` is built but NOT merged** (branch `task/pluspass`, commit `80849b0`). It
adds a **"+ Horse" control to My Stable**, written against the current inline location.
Moving the page will conflict.

**Land PLUSPASS first**, then build on top of it. If it has not merged when you start,
**stop and report** rather than duplicating or discarding its work.

## Out of scope

- The other inline rows (Profile & preferences, Saved items, Documents). They stay as they
  are.
- Any change to what My Stable *does* — no new fields, no new capability.
- The nav order. `My Stable` keeps its position in the canonical order.

## Verification

1. `/app/stable` loads and shows horses, gear and supplies.
2. Both nav links reach it, and **"My Stable" and "Account" are no longer the same
   destination** — this is the defect being fixed.
3. Adding a horse, gear and a supply all still work, including the microchip-dedup path.
4. The old `?section=stable` URL still gets the user somewhere sensible.
5. The account page still renders correctly with the row now navigating.
6. Screenshot at 390px — this is a mobile-first surface.
7. Typecheck and lint clean.

## Constraints

- Own git worktree off `origin/main`.
- **`ClauseDocument.tsx` is FROZEN** and is not involved.
- Do not reorder nav items.

## Reporting

`docs/reports/TASK-STABLEPAGE-REPORT.md`. State what you verified with your own eyes
versus what you assume.
