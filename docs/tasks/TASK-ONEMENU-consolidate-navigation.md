# TASK ONEMENU — one menu, moved to the right, plus drawer corrections

**This task SUPERSEDES `TASK-NAVFIX-drawer-polish.md`, which is deleted.** Both sets of
work touch the same drawer, so they are merged here explicitly. **Every item below is in
scope for this thread** — nothing is optional and nothing belongs to another task.

Two jobs, one thread:

- **A. Consolidate** — the avatar dropdown goes away, the nav drawer absorbs it, and its
  tab moves from the left edge to the **top-right**, below the header.
- **B. Correct** — five defects the owner found testing the drawer on a phone.

**Phase 1 is a plan. Do not write code until it is approved.** The migration list and the
sign-out question both need the owner's eyes first.

---

## Why

Two menus on one small screen, each holding a slice of navigation, with a left-edge tab
sitting over the page title. One menu on the right removes the split, puts the tab where
the UI has its most free space, and gives the avatar a single clear job.

---

## A1 — The layout choice

Two options were raised. **Recommendation: Option B**, and the reasoning should be
challenged rather than assumed.

### Option A — hangs from the header, slides down

Closer to the eventual design direction (a full-screen glass panel pulled down from behind
the header). But that direction is **paused and unresolved**, and building a new
interaction pattern now risks doing the work twice.

### Option B — the existing drawer, mirrored to the right ← recommended

Keep the drawer and the tab exactly as they behave today; move the tab to the top-right
and open the panel leftward from the right edge.

Why this wins for now:

- **Reuses proven mechanics.** The tab's motion, the ride-out-on-the-drawer's-edge
  behaviour and the glass surface are all confirmed good by the owner. Mirroring is a
  transform, not a rebuild.
- **The top-right is the emptiest part of the UI.** Owner's reasoning: nothing is covered
  at initial load, which is the moment that matters. Page text is left-aligned, so the
  right edge carries ragged whitespace.
- **Overlap while scrolling is intended, not tolerated.** *"The glass effect is only
  visible if things move behind it."* Content passing under the tab is what makes the
  material read as glass. **Do not add a gutter, inset the content, or otherwise prevent
  the overlap** — an earlier recommendation to do exactly that was withdrawn by the owner.
- **It survives the leather redesign.** If the pull-down direction is adopted later, a
  right-side drawer is a smaller thing to replace than a bespoke pull-down built twice.

Position it below the header on the right, mirroring the current 24px offset. The arrow
points **left** when closed and flips right when open.

---

## A2 — Absorb the avatar menu

The avatar menu holds items with no equivalent in the nav drawer. Produce the complete
list and where each lands. Confirm this inventory yourself; it is a starting point, not
gospel:

| In the avatar menu today | Notes |
|---|---|
| **Account** | A plain link |
| **Company** section | Admin only — company-associable items |
| **Quick access** | The presence-gated set (I2) |
| **Manage** groups | Staff/admin nav groups |
| **Sign out** | **The only sign-out path in the app.** It must not be lost. |

For each: does it belong in the merged menu, and where in the order? The nav drawer has a
deliberate canonical order the owner set — **do not reshuffle existing items** to make room.

---

## B. Drawer corrections (merged in from the deleted NAVFIX task)

### B1 — The tab's touch target is too small

`.cs-drawer-tab` is **34 × 46px** (`header-cardstock.css` ~355). The guideline minimum is
44 × 44px, which is exactly why the owner reports it as *"not so sensitive to touch."*

**Enlarge the hit area without changing a single visible pixel** — an invisible
pseudo-element extending the touchable region, not padding or a larger box, which would
move the artwork. Applies at the tab's new right-side position.

### B2 — Remove the Close button

`AppLayout.tsx` ~1024. The drawer header holds a "Close" button predating the tab. The tab
now closes the drawer and rides out on its edge, so this is a second control for one job.

Remove **the button only** — the `Menu` label stays. Keep the row's spacing sensible
afterwards. `closeMobileNav` remains in use by the scrim, Escape, route change and link
selection; verify all four still work.

### B3 — Replace the active-page fill

`RailLink` (~line 289) marks the current page with `bg-cream-200 text-green-800
font-medium` plus a gold icon. On frosted glass an opaque cream fill fights the material —
it reads as a card pasted onto the glass.

**Remove the background fill** and replace it with a non-filling indicator. Recommended: a
**left accent bar**, 2–3px gold on the leading edge, label kept at `font-medium`, icon
still gold.

If a left bar collides with the `pl-9` indent used by nested community links, report it
rather than reworking the indent scheme.

**`RailLink` is shared with the desktop rail.** Changing it changes both. That is
acceptable and probably desirable, but confirm the desktop rail still reads correctly and
screenshot it. If the two genuinely need to diverge, stop and report rather than forking
the component.

Keep `aria-current` intact — the accessible signal must not depend on colour.

### B4 — Neutralise the overlay

`AppLayout.tsx` ~1010: the scrim is `bg-green-950/50`. The drawer is green glass, so scrim
and drawer sit in the same colour family and barely separate; the only contrast is the
frosting itself.

**Move the scrim into black and white** — something like `bg-black/40`, tuned so the drawer
reads as clearly forward without the backdrop turning heavy. Removing it visually is
acceptable **only if** the drawer still separates clearly, and it must keep click-to-close
either way — a transparent catcher if nothing is drawn.

### B5 — Centre the page title block

`src/pages/app/Home.tsx` ~47–60: the eyebrow, the `Welcome new members!` heading and the
description are left-aligned inside a centred page. Centre them. The description carries
`max-w-2xl`, which needs `mx-auto` to actually centre rather than centring text inside a
left-anchored box.

**Scope check first.** Seven pages use this title model — `Home`, `DashboardHome`,
`CatalogPage`, `CareHome`, `DealHome`, `MyPosts`, `AccountHub`. Centring one makes the app
inconsistent. Report what the others look like and whether it should apply to all;
**do not change all seven on your own initiative.**

---

## Phase 1 — the plan

Produce the A2 migration list, then answer these. **Answer, do not decide.**

1. **Sign out.** Where does it live in a merged menu, visually separated from navigation?
   It is destructive-adjacent and must not sit among ordinary links.
2. **What happens to the avatar?** The owner has said the avatar should become
   personalisation rather than a control. Options: inert; or a direct link to `/app/account`
   on tap. **A direct link is worth considering** — it preserves the press animation the
   owner tuned at length and gives the avatar a purpose, rather than animating and doing
   nothing.
3. **Superadmin.** It keeps its own header, its own mobile nav button, and its own avatar
   dropdown, and is excluded from the tab. Does this consolidation touch superadmin at all?
   **Recommendation: no** — leave platform chrome alone entirely.
4. **Desktop.** The avatar dropdown also serves desktop, where the rail is the nav. Does
   the dropdown survive on desktop and disappear only on mobile, or go everywhere?
   Consolidating on desktop is a much larger change and probably a separate task.
5. **B5 scope** — one page, or all seven.

**Stop after Phase 1 and report.**

---

## Phase 2 — build (after approval)

Move the tab, mirror the drawer, migrate the approved items, remove the avatar dropdown
where approved.

### Verification

1. Every item from the avatar menu is reachable in the merged menu — walk the list and
   tick each one.
2. **Sign out works.** Verify explicitly; losing it strands users in a session.
3. All four close paths still work: tab, scrim, Escape, selecting a link.
4. The tab is reliably tappable at the right edge — it must satisfy the 44px minimum from
   `TASK-NAVFIX` N1. If NAVFIX has not merged, apply the same fix here rather than shipping
   a small target again.
5. Nothing is covered **at initial load** at 390px — screenshot the community page
   unscrolled. Overlap **while scrolling is expected and correct**; do not "fix" it.
6. The tab is reliably tappable **at its edges**, not just dead centre (B1).
7. The current page is identifiable at a glance in the drawer, without a fill (B3).
8. The desktop rail still reads correctly after B3 — screenshot it.
9. Superadmin's chrome is unchanged.
10. Desktop is unchanged unless Q4 said otherwise.
11. Typecheck and lint clean.

## Constraints

- Own git worktree off `origin/main`.
- **`ClauseDocument.tsx` is FROZEN** and is not involved.
- Screenshots at 390px for every visual change.
- Do not reorder existing nav items.

## Reporting

Phase 1 → `docs/reports/TASK-ONEMENU-PHASE1-PLAN.md`.
Phase 2 → `docs/reports/TASK-ONEMENU-REPORT.md`.

State what you verified on a real device versus in a harness.
