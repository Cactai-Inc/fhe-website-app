# Open change requests — reconciled 2026-08-08

Every UI change the owner requested in the 2026-08-07/08 sessions, reconciled against what
is actually on `main`. **Superseded items are struck and listed separately so they are not
re-implemented.**

**Nothing visual in section B or C has been confirmed in a browser by anyone.** Code changes
were verified against the built CSS; that proves a rule shipped, not that it looks right.

---

## A — NOT IMPLEMENTED, with the owner's disposition (2026-08-08)

**Numbering matches the list printed to the owner in chat**, which is what he answered
against. An earlier revision of this file numbered A13 differently — corrected here.

| # | Request | Disposition |
|---|---|---|
| **A1** | Replace the app header with the login screen's header | **RUNS FIRST.** `TASK-ONEHEADER`. Everything below is sequenced off it. |
| **A2** | Admin nav sections not collapsible on mobile | **DEFERRED** until after the admin page-structure and menu-contents refactor. |
| **A3** | Menu button overlaps the contract actions card | **SOLVED BY A15** — reverting to the avatar button removes the overlapping tab. No separate work. |
| **A4** | "Tap to open" / "Tap to close" hint text | **CANCELLED — both.** The tab goes when the new header lands, so neither is needed. The shipped "Tap to close" is **removed**; the unshipped "Tap to open" is dropped. |
| **A5** | Add-new button sits at a different height on every page | **After A1**, and after the menu tab is removed. |
| **A6** | Add-new button becomes a square, icon-only `+`, right-aligned | **Implements alongside A5.** |
| **A7** | Page name moves up, description moves down | **RE-EVALUATE after A1, A5, A6** — do not build to the current spec. |
| **A8** | Overall material uniformity | **LAST.** Everything else first. |
| **A9** | Eight nav items share `Shield` (+ `Contact` ×4, `FileText` ×4, `Boxes` ×3) | **Pending the ADMIN PAGE REFACTOR** — see the note below. |
| **A10** | Sign-out icon reads as an expand-nav control | **With A9.** |
| **A11** | Custom horse icons (Lessons, Horse care) | **With A9 and A10.** Artwork still on hold. |
| **A12** | "Mess of greens" | **Part of A8.** |
| **A13** | Nav resize | **Ships with A1** — actively underway in `TASK-ONEHEADER`. |
| **A14** | Lose the glass; nav solid brand green with cream labels | **Next after A1 + A13.** |
| **A15** | Remove the drawer tab; avatar becomes the menu button | **Runs with A14.** |

### The admin refactor — the owner's concern, recorded

> "A9 … is pending refactor of Admin pages (not listed as a request, which is concerning
> because it was long active discussion with a massive list of priorities and requirements
> and goals."

**The concern is fair about THIS list.** This file is a UI change-request reconciliation and
the admin refactor is not a UI change request, so it was never entered here — which means a
reader of this list alone would not know the largest workstream exists.

**The work IS captured**, in `docs/tasks/TASK-ADMINSWEEP-reconcile-the-admin-surface.md`
(`99a7564`, reframed at `10d7a1a`): the full admin refactor, Phase 1 inventory with a hard
stop, the Sales/Marketing/Company-management structure, the tabs ruling, the three named
missing pages, and the finding that admin has pages for records and almost none for commerce.

**But it is not one list.** The admin refactor, this UI list, and the lease/insurance
workstream are three separate documents with no single index. If the owner cannot see all
active workstreams in one place, that is the actual gap — not a missing entry.

**Sequenced order, from the dispositions above:**

`A1 + A13` → `A14 + A15` → `A5 + A6` → `A7` (re-evaluated) → **ADMIN REFACTOR** → `A9 + A10 + A11` → `A2` → `A8 + A12`

## B — IMPLEMENTED, NOT VISUALLY VERIFIED

Shipped and present in the deployed CSS. **Unconfirmed by eye.**

| # | Request | Commit |
|---|---|---|
| **B1** | Hover works in a narrow window with a cursor (capability, not width) | `c810495` |
| **B2** | Remove the word "Menu" | `1f562b6` |
| **B3** | Padding above/below Sign out | `1f562b6` |
| **B4** | Notification badge translucent | `d59432d` |
| **B5** | Community Feed + Account icons no longer miniature when collapsed | `7c7b09d` |
| **B6** | Expand/collapse icons are a matched pair | `7c7b09d` |
| **B7** | Create `+` replaces the collapse toggle at rail top; toggle moves to the foot | `42bbff2` |
| **B8** | Header create tab removed | `42bbff2` |
| **B9** | Collapsed-rail tooltip no longer renders as a green sliver (portal) | `1f562b6` |
| **B10** | `+` alignment and white-hover corrected to rail metrics | `91cfa4a` |
| **B11** | "show"/"hide" word removed from the community toggle | `91cfa4a` |
| **B12** | Horizontal overscroll stopped; vertical bounce kept | `aa15d40` |
| **B13** | "Click to close" → "Tap to close" on touch | `aa15d40` |
| **B14** | Scrim locks page scroll | `795f121` |
| **B15** | Tab no longer travels with the drawer — fades instead | `e968ffa` |
| **B16** | Drawer starts below the header | `3b52733` |
| **B17** | Drawer tab visible on an older iPhone (was cream-on-cream) | `e968ffa` + `628079a` |

## C — IMPLEMENTED, OWNER SAYS STILL WRONG

| # | Request | State |
|---|---|---|
| **C1** | **Selection flickers** | Removed 10 nested `backdrop-filter`s; owner reports it persists. **Diagnosis was wrong.** Likely inherent: a `backdrop-blur` panel re-composites its backdrop whenever a child changes. May be unfixable while the panel uses blur at all. |
| **C2** | **The green is not right** | Math done: `green-800/20` over cream composites to `#c8cac0`. A green glass panel over a near-white page **cannot read as green below ~90% alpha** — back-solving needs negative channels at 0.20/0.60/0.80. Blocked on A1. |
| **C3** | **Menu still hard to read** | Same root cause as C2. |
| **C4** | Drawer tab is now too big and 100% opaque | Deliberate (a glass tab is what Sarah could not find) but not what the owner wants. |
| **C5** | Tab icon still wrong | Changed hand-drawn chevron → lucide `ChevronLeft`. Still not right. |
| **C6** | Scrim colour | Changed black/40 → `green-950/45`. Owner: "contrast looks better", still not settled. |

## D — SUPERSEDED — do not implement

| Original request | Superseded by |
|---|---|
| ~~Selected state should have transparency + frosting~~ | Owner later reported hover/selection "mixing glass and opaque". Selection is now **solid** so both states share one material. |
| ~~Fix the panel and tab animating at different speeds~~ | Owner: "instead of fixing that we just remove the tab from being carried." Tab now fades; there is no second motion to sync. |
| ~~Mobile does not need a hover state~~ | Owner reversed this: a narrow desktop window has a cursor and expects hover. |
| ~~Menu button should be green glass~~ | Superseded by the Sarah finding — a glass tab was invisible on her phone. Now solid, though C4 says the current treatment is wrong. |
| ~~Fix the faint mobile wordmark (H1)~~ | Folded into **A1**. Both are relief-treatment problems that disappear when the header is replaced. |
| ~~Fill the monogram with cream (H2)~~ | Folded into **A1**, same reason. |

## E — BLOCKED ON THE OWNER

| # | Needs |
|---|---|
| ~~E1~~ | ~~Header item 3~~ — **CLOSED 2026-08-08.** All three header complaints described the cardstock header, which is being replaced. Owner: "none of that header message matters." |
| ~~E2~~ | ~~Glass vs green~~ — **ANSWERED: lose the glass.** Solid brand green, cream labels. Header does **not** minify on scroll. |
| ~~E3~~ | ~~Logo file for the custom horse icons~~ — **ON HOLD, owner 2026-08-08.** Lessons and Horse care keep placeholders; do not block nav work on them. |
| ~~E4~~ | ~~Horse care vs Barn~~ — **ANSWERED: separate pages.** Also: FHE is a **stable at a ranch, not a barn** — 160 mentions across 45 files need a judged sweep, not a find-replace. |

---

## Recommended order

**A1 first, alone.** C2, C3, A8 and A12 all resolve against whatever the header becomes, and
everything tuned before it is guesswork — every nav colour shipped on 2026-08-08 was solving
against a backdrop scheduled for replacement.

Then the mechanical group — **A5, A6, A7** (page-header layout) — which is independent of
colour entirely and can run in parallel.

Then **A9/A10/A11** (icons), then **A2/A3/A4**.

**C1 needs a decision, not a fix**: if the flicker is inherent to `backdrop-filter`, the
choice is a translucent panel *without* blur, or an opaque one.
