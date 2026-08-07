# TASK ACCOUNTSURFACE — one rule for where content lives

**This task supersedes `TASK-STABLEPAGE-own-route.md`, which is deleted.** Both edit
`AccountHub.tsx` and would collide, so they are merged here explicitly. **Every item below
belongs to this thread.**

**Phase 1 is COMPLETE** — see `docs/reports/TASK-ACCOUNTSURFACE-PHASE1.md`. It confirmed
the §3 duplication, found the account page is a strict accordion (so panel weight is a
per-panel question, not cumulative), and surfaced the bare `Lessons` nav label. §4 below is
now decided by the owner. **Phase 2 is approved to build.**

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

## §4 — The section list and labelling — DECIDED (owner, 2026-08-07)

### The rule

**"My" prefixes everything on the Account page and every nav link to those pages.**

**The one exception: "Account" itself.** The page and its nav link stay plain `Account` —
it is the container, not personal content inside it.

### The ten sections

Today's `Profile & preferences` row carries profile, preferences **and** login together.
It splits into three, so **the page gains two sections**:

| # | Section | Note |
|---|---|---|
| 1 | **My Profile** | **split internally** — see below |
| 2 | **My Preferences** | **new** — was folded into Profile & preferences |
| 3 | **My Login** | **new** — was "Login & security" inside Profile & preferences |
| 4 | **My Documents** | was `Documents` |
| 5 | **My Lessons** | was `My lessons` (casing) |
| 6 | **My Saved Items** | was `Saved items` |
| 7 | **My Posts** | was `My posts` (casing) |
| 8 | **My Orders** | was `Orders` |
| 9 | **My Gifts** | was `Gifts` |
| 10 | **My Stable** | unchanged |

**Order is TBD** — do not invent one. Keep today's relative order and flag it; the owner
will rank them.

**The nav is decided** and its labels must match this table exactly.

### My Profile splits in two

- **Community profile** — what other members see.
- **Account profile** — internal, not community-visible.

`TASK-PROFILE` already built these as distinct concerns inside one section; this makes the
split explicit rather than implied.

### My Login contains

- the **email used to sign in**;
- **password reset**;
- **switch to Sign in with Google** — offered **only** when the member already has a
  password set **and** is either using a Google email or is switching to one. Do not show
  it otherwise.

### Also fix — found by the Phase 1 thread

The nav rail labels the lessons destination plain **`Lessons`**, which is exactly the
public-versus-personal collision the rule exists to prevent. It becomes **`My Lessons`**.
Sweep for any other bare label; the table above is the authority.

---

## Phase 2 — build

Phase 1 established that `DocumentsPanel` is not merely a duplicate of `Documents.tsx` but
is **missing real capability** — no signing, no email-a-copy, no assigned-but-ungenerated
documents, no supersede badge. That is a pre-existing product gap. **Extracting the shared
component must not silently ship the weaker version as the page.** Where the two differ,
the fuller behaviour wins; if that turns out to be a bigger job than the extraction, stop
and report rather than levelling down.

The other four subjects have a single implementation each, so extraction there is
mechanical.

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

**`TASK-PLUSPASS` is merged** — its "+ Horse" control on My Stable is on `main`. Build on
it; do not duplicate or discard it when My Stable moves.

### File ownership — ORCHESTRATOR RULING, 2026-08-07

Both tasks were heading for the same components. Ownership is split by **file**, so both
can run now:

| File | Owner |
|---|---|
| `AppLayout.tsx` | **ONEMENU only** — do not touch it |
| `AccountHub.tsx`, `AccountPanels.tsx`, the new stable page, `App.tsx` routes | **ACCOUNTSURFACE (you)** |

**So this task does NOT change nav labels or nav links**, even though §4 lists them.
ONEMENU is already rebuilding `PRESENCE_LINKS`, `ClientNavItems`, `PresenceLink` and
`AccountNavLink` for the avatar-menu merge, so it applies the `My` labels and adds the
`/app/stable` nav link as part of that rebuild — one thread touching those components once,
rather than two in sequence.

**You still create the `/app/stable` route and page** (§2). ONEMENU points nav at it.
Build the route first so the link has somewhere to land.

Apply `My` labels **on the Account page**. Leave the nav to ONEMENU.

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
