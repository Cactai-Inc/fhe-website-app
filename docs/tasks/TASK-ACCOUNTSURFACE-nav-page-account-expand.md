# TASK ACCOUNTSURFACE — one rule for where content lives

**This task supersedes `TASK-STABLEPAGE-own-route.md`, which is deleted.** Both edit
`AccountHub.tsx` and would collide, so they are merged here explicitly. **Every item below
belongs to this thread.**

**Phase 1 is an assessment. Write no code until it is approved.** The duplication problem
in §3 has to be sized before anyone commits to a shape.

---

## The rule (owner, 2026-08-07)

> **Anything reached from the NAV opens as its own page.
> Anything on the ACCOUNT page expands in place to show its contents.**

Same content, two surfaces, two behaviours — decided by where you clicked, not by what the
thing is.

## Where it is broken today

`AccountHub.tsx` mixes both behaviours, and the split is arbitrary:

| Account row | Today | Should be |
|---|---|---|
| Profile & preferences | expands ✅ | expands |
| Saved items | expands ✅ | expands |
| Documents | expands ✅ | expands |
| My Stable | expands ✅ | expands |
| **My posts** | **navigates ❌** | **expands** |
| **My lessons** | **navigates ❌** | **expands** |
| **Orders** | **navigates ❌** | **expands** |
| **Gifts** | **navigates ❌** | **expands** |

And in the nav, **My Stable is not a page at all** — it points at
`/app/account?section=stable`, so "My Stable" and "Account" land in the same place with a
row pre-opened. It needs a real route.

---

## §1 — The four rows that navigate must expand

My posts, My lessons, Orders and Gifts stop navigating and expand in place, like the four
that already do.

## §2 — My Stable gets a real route

Add `/app/stable`, following the pattern `/app/my-posts` and `/app/lessons` already use.
Repoint both nav call sites — `AppLayout.tsx:139` and `:504`. Keep `?section=stable`
working via redirect rather than 404.

Its three groups — **horses, gear, supplies** — become proper page sections there, using
the app's page header model (gold eyebrow + heading + description).

**It must still expand inline on the account page.** Both surfaces, per the rule.

## §3 — The duplication problem — SIZE THIS BEFORE BUILDING

This is why Phase 1 exists.

The nav pages and the account panels are **separate implementations of the same content**:

| Content | Nav page | Account panel |
|---|---|---|
| Documents | `Documents.tsx` (288 lines) | `DocumentsPanel` in `AccountPanels.tsx` |
| Saved | — | `SavedPanel` |
| My Stable | *(none)* | `StableSection` inside `AccountHub.tsx` |
| My posts | `MyPosts.tsx` (196) | *(none)* |
| My lessons | `MyLessons.tsx` (268) | *(none)* |
| Orders | `Orders.tsx` (147) | *(none)* |
| Gifts | `Gifts.tsx` (190) | *(none)* |

`Documents.tsx` does **not** import `DocumentsPanel` — confirm that yourself. Two
implementations of one thing, free to drift apart.

Satisfying the rule means every one of these appears in **both** surfaces. Done naively
that doubles the duplication.

**The obvious shape is one shared component per subject, rendered inline by the account
page and wrapped in a page header by the route.** Do not assume it — assess it. Report:

- how far apart the existing pairs already are (Documents is the live test case);
- whether one component can serve both without contortion, or whether some genuinely need
  to differ;
- what the account page weighs once four more panels expand into it;
- whether expanding-in-place is right for the heavier ones — `MyLessons.tsx` is 268 lines.

**If a shared component would be forced, say so.** A wrong call here produces exactly the
tangle the owner is trying to avoid.

## §4 — Label everything "My"

Owner ruling. Personal content is prefixed **"My"** throughout, so it never collides with
company, community or app-level content — which barely exists today but will, and will
overlap: *app settings vs account settings*, *Stable (the company's) vs My Stable*.

Current labels are inconsistent in both prefix and capitalisation:

| Today | Becomes |
|---|---|
| `My posts` | `My Posts` |
| `My lessons` | `My Lessons` |
| `Saved items` | `My Saved Items` |
| `Documents` | `My Documents` |
| `Orders` | `My Orders` |
| `Gifts` | `My Gifts` |
| `My Stable` | `My Stable` ✅ |
| `Profile & preferences` | **ask — see below** |

Apply in the account page **and** the nav, so the two agree.

**Question for Phase 1:** does "Profile & preferences" become "My Profile & Preferences",
or is it exempt as the account's own primary row? Ask; do not decide.

---

## Phase 1 — assess and report

1. The §3 duplication assessment, with a recommended shape and its cost.
2. The Profile-label question.
3. Whether `MyLessons` and `Documents` are too heavy to expand inline, with evidence.
4. Anything that makes the rule awkward — say so now, not after building.

**Stop and report.**

## Phase 2 — build (after approval)

### Verification

1. Every nav item opens its own page; every account row expands in place. No exceptions.
2. `/app/stable` loads; **"My Stable" and "Account" are no longer the same destination.**
3. My Stable still expands inline on the account page.
4. Adding a horse, gear and a supply all still work — including the microchip-dedup path
   (`AccountHub.tsx:168`).
5. Old `?section=stable` links still land somewhere sensible.
6. Labels match between nav and account page.
7. The account page is still usable at 390px with the heavier panels expanded —
   screenshot it.
8. Typecheck and lint clean.

## Coordination

**`TASK-PLUSPASS` is built but NOT merged** (branch `task/pluspass`, `80849b0`). It adds a
**"+ Horse" control to My Stable** written against the current inline location. **Land
PLUSPASS first**, then build on it. If it has not merged when you start, **stop and
report** — do not duplicate or discard its work.

## Constraints

- Own git worktree off `origin/main`.
- **`ClauseDocument.tsx` is FROZEN** and is not involved.
- Do not reorder nav items or account rows.
- Move working code; do not rewrite it. `StableSection` already handles three independent
  loads, an add-item modal and a horse-record path — if it needs restructuring, say what
  and why.

## Reporting

Phase 1 → `docs/reports/TASK-ACCOUNTSURFACE-PHASE1.md`.
Phase 2 → `docs/reports/TASK-ACCOUNTSURFACE-REPORT.md`.

State what you verified with your own eyes versus what you assume.
