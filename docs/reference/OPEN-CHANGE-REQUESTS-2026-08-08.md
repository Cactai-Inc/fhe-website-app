# Open change requests — reconciled 2026-08-08

Every UI change the owner requested in the 2026-08-07/08 sessions, reconciled against what
is actually on `main`. **Superseded items are struck and listed separately so they are not
re-implemented.**

**Nothing visual in section B or C has been confirmed in a browser by anyone.** Code changes
were verified against the built CSS; that proves a rule shipped, not that it looks right.

---

## A — NOT IMPLEMENTED

| # | Request | Note |
|---|---|---|
| **A1** | **Replace the app header with the login screen's header** | The root blocker. The greens cannot match until this lands, and every nav colour is being tuned against a backdrop that is about to change. Spec: `TASK-ONEHEADER`. |
| **A2** | Admin nav sections are not collapsible on mobile (desktop has it) | |
| **A3** | Menu button overlaps the **contract actions** card on the contract page | |
| **A4** | "Tap to open" hint text on mobile | "Tap to close" shipped; open did not |
| **A5** | Page-header layout pass — add-new button sits at a different height on every page; `Horse records` is the reference | |
| **A6** | Add-new button becomes a **square, icon-only `+`, right-aligned** | No text label |
| **A7** | Page name moves **up**, above the button; description moves **down** | |
| **A8** | Overall material uniformity — "some glass, some opaque buttons without texture, a header with a different colour and texture" | Depends on A1 |
| **A9** | **Eight nav items share the `Shield` icon** (+ `Contact` ×4, `FileText` ×4, `Boxes` ×3) | Assignment decided in `nav-icon-exercise.md`; not applied |
| **A10** | Sign-out icon reads as an expand-nav control | Made worse by moving the collapse toggle directly above it |
| **A11** | Custom icons: **Lessons** = jumping horse with rider (from the logo), **Horse care** = galloping horse | Blocked: no horse artwork exists in the repo, and lucide has no horse |
| **A12** | "Mess of greens" — five different greens in one calendar view, with no semantic assignment | |
| **A13** | Second drawer option — **full-height with a logo cap** — for comparison | Below-header version shipped; this one not built |

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
| **E1** | **Header item 3** — the owner's third header note was cut off mid-sentence and never completed. |
| **E2** | **The glass-vs-green decision** (from C2's math): high alpha (~0.90, reads green, barely glass), put the panel over a dark backdrop (what A1 changes), or accept pale grey-green. |
| **E3** | The **logo file** for the two custom horse icons (A11). |
| **E4** | Whether **"Horse care"** is the same page as Barn, or separate. |

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
