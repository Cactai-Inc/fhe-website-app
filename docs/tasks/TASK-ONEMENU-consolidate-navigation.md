# TASK ONEMENU — one menu, moved to the right

Consolidate the two mobile menus into one. The avatar dropdown goes away entirely; the
nav drawer absorbs everything it held, and its tab moves from the left edge to the
**top-right**, below the header.

**Phase 1 is a plan. Do not write code until it is approved.** The migration list and the
sign-out question both need the owner's eyes first.

---

## Why

Two menus on one small screen, each holding a slice of navigation, with a left-edge tab
sitting over the page title. One menu on the right removes the split, puts the tab where
the UI has its most free space, and gives the avatar a single clear job.

---

## The layout choice

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

## Phase 1 — the migration plan

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

### Questions to answer, not decide

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
6. Superadmin's chrome is unchanged.
7. Desktop is unchanged unless Q4 said otherwise.
8. Typecheck and lint clean.

## Coordination

`TASK-NAVFIX` touches the same drawer (close button, active-item styling, scrim colour,
tab hit area). **These two must not run at the same time.** Land NAVFIX first, then build
on it — or fold NAVFIX's items into this task and cancel it. Say which in the Phase 1
report.

## Constraints

- Own git worktree off `origin/main`.
- **`ClauseDocument.tsx` is FROZEN** and is not involved.
- Screenshots at 390px for every visual change.
- Do not reorder existing nav items.

## Reporting

Phase 1 → `docs/reports/TASK-ONEMENU-PHASE1-PLAN.md`.
Phase 2 → `docs/reports/TASK-ONEMENU-REPORT.md`.

State what you verified on a real device versus in a harness.
