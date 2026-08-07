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

### B0 — Equalise the header's side columns

The header grid is `1fr auto 1fr`, but the logo is **56px** and the avatar **50px**. Both
side columns are the same width, so the left gap is `1fr − 56` and the right is `1fr − 50`:
**the logo sits exactly 6px closer to the wordmark than the avatar does.** The owner sees
it as the F being tighter to the logo than the C is to the e.

**Fix by equalising the WRAPPER widths, not the drawn marks** (owner's choice). Give both
mark wrappers the same width — the larger of the two — and centre the smaller SVG inside
its wrapper. The logo stays visually larger, which is correct; only the spacing balances.

**Do not resize either SVG.** `TASK-BP410` (merged, `93d3d50`) redrew them at exact
viewBox-equals-render sizes so the 1px offsets stay literal; changing a drawn size
reintroduces resampling. Note BP410 adds a second pair below 410px (48/42) — **equalise
at that breakpoint too**, where the same 6px gap exists.

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

**Remove the cream background fill.** What replaces it is now specified in **C5b** — a
green fill for selected and a translucent green for hover. The earlier accent-bar
suggestion is **withdrawn**; build C5b instead.

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

### B5 — Increase the space above the page title

`<main>` (`AppLayout.tsx` ~966) carries `py-6 sm:py-9` — 24px above the page title on
mobile. The owner reports it as too tight. Increase the top padding on mobile.

This is also what gives the relocated tab clean room: the owner has confirmed **every page
has space in the top-right for the tab to live**, and it will not touch content until the
user scrolls.

### B5b — The 481–590px dead zone overflows

Found by `TASK-BP410` while sweeping widths; pre-existing, not caused by it.

The short-name switch happens at `≤480px`, so anything **above** that renders the full
*"French Heritage Equestrian"* at 29px with full-size marks. That needs ~590px.
Measured: `scrollWidth` 582 against a 500px viewport.

So every width from **481px to roughly 590px overflows** — small tablets, iPad
split-screen, and any resized desktop window.

Fix it as part of the width ladder rather than as a patch: you are already touching the
breakpoint table for B0 and the tab move, so one thread should reason about the whole
ladder at once. Either move the short-name switch up, or add a step in that range.
**Report which and why** — the owner has been explicit that width is the scarcest
resource on this header.

### B6 — Page titles stay LEFT-JUSTIFIED — do not change them

An earlier instruction asked for the title block to be centred. **Withdrawn by the owner.**
With the tab moving to the top-right it no longer collides with left-aligned text, so the
reason for centring is gone.

**Leave the eyebrow, heading and description left-justified exactly as they are, on every
page.** Do not centre `Home.tsx`, do not touch the other six pages using the title model,
and do not add `mx-auto` to the description.

---

## C. Desktop rail corrections (owner, 2026-08-07)

Six items on the desktop rail and the create tab. All verified in code by the orchestrator.

### C1 — The collapse control: icon only, moved right

`AppLayout.tsx` ~934. The pin/collapse button currently renders an icon **plus** the words
`Collapse` / `Keep open`, left-aligned at the top of the rail.

**The icon becomes the button.** Drop the text. Move it to the **right side of the panel**
with appropriate padding, so it sits at the edge it acts on.

### C2 — The page resizes before the menu moves — FIX THE CAUSE, NOT THE TIMING

Two nested elements animate width independently, driven by **different state**:

- the `<aside>` (which reserves page space) follows `staffRailPinned`
- the `<nav>` inside it follows `staffRailOpen`, and
  `staffRailOpen = staffRailPinned || staffRailHovered` (line 578)

So when you click the control **with the cursor over the rail**, `staffRailHovered` is
already true — the `<nav>` is already wide — and only the `<aside>` changes. The page
reflows while the menu appears not to move. That is the reported bug.

**Do not fix this by tuning durations.** Once C3 removes hover-expansion, both elements
can follow a single state and move as one. If they still need to be separate, they must at
minimum share one state and one transition.

### C3 — Kill hover auto-expand

`onMouseEnter` / `onMouseLeave` set `staffRailHovered`, which expands the collapsed rail
over the page. **Remove it.** The rail is either **full — icons and labels — or icon-only**.
Nothing in between, and no expansion the user did not ask for.

This also removes half of C2's cause.

### C4 — Tooltips on the icon-only rail, delayed 1–2s

Collapsed, each item shows only its icon. On hover it reveals the same label the expanded
rail shows, after a **1–2 second delay** — long enough that it appears only when the cursor
lingers deliberately.

`RailLink` currently passes `title={open ? undefined : label}`, a native tooltip with an
uncontrollable delay. Replace it with something whose delay you set.

**`ExplainTip` (`src/components/app/ExplainTip.tsx`, merged from `TASK-TIPTAP`) already
exists** — evaluate it first. It was built tap-first for inline prose, so it may or may not
suit a hover-with-delay rail label. **Reuse it if it fits; if it genuinely does not, say
why rather than forcing it.** Do not build a third tooltip mechanism without saying so.

### C5 — The Community Feed row is undersized

In `CommunityNav` (~line 430) the show/hide control renders a **15px** chevron with a
**10px** text label, against **17–18px** icons and **13.5px** labels everywhere else in the
rail. Bring the Community Feed icon and its toggle to the same scale as every other nav
item.

### C5b — Nav state colours: default → hover → selected

Owner spec, 2026-08-07. Replaces the cream-fill treatment in **B3** — read them together;
B3 removes the old fill, this defines what replaces it.

**This spec is for the DESKTOP rail.** Hover has no meaning on a touch screen, so only the
selected state carries over to the mobile drawer.

| State | Where | Fill | Text + icon |
|---|---|---|---|
| **Default** | both | none | today's secondary green |
| **Hover** | **desktop only** | the same green at reduced opacity — *"you'll go here if you click"* | the **selected** text colour |
| **Selected** | **both** | solid green | the **panel's own surface colour** |

On desktop, hovering shows a faint version of what the row becomes once clicked; on click
the previous selection clears and the new row takes the solid fill. **The mobile drawer gets
the selected state only** — do not invent a touch equivalent of hover.

**Values:**

- Green: **`green-800` `#143321`** — the brand green.
- Selected text and icon: the panel surface, **`cream-100` `#f5f0e8`** (the rail is
  `bg-cream-100/40`). Verify it reads cleanly on `green-800`; step to `cream-50 #faf8f4`
  if it does not.
- Hover fill (desktop): `green-800` at reduced opacity, tuned so it is clearly a preview
  rather than mistakable for the selection itself. The desktop rail's own surface is
  `bg-cream-100/40` — already translucent — so **if layering translucent green on it reads
  muddy, use the solid equivalent instead.** The owner explicitly allowed either.

**Applies to both the icon-only and full-width rail** — one palette, and the collapsed rail
must not diverge from the expanded one. The **selected** state also applies in the mobile
drawer.

**Scope:** this is the four components from B3 — `RailLink`, `PresenceLink`,
`AccountNavLink`, and `CommunityNav`'s nested links. A mixed treatment is worse than
either state.

**Interaction with B3:** B3 says remove the cream fill and use a non-filling indicator.
**This supersedes that** — a fill is now wanted, just a different one. The accent-bar
suggestion in B3 is withdrawn.

### C6 — Move the create tab left

`header-cardstock.css:261` — `--cs-tab-right: calc(112px + env(safe-area-inset-right))`.
Move the tab **left by 10–15px**, roughly half its width, by **increasing** that offset to
around `124px`.

Note `--cs-tab-right` is also read at line 314 to position the tab's mirrored stock layer.
Changing the variable moves both, which is correct — **verify the stock still lines up at
the seam** afterwards.

---

## D. Nav labels and the stable link — ORCHESTRATOR RULING, 2026-08-07

`AppLayout.tsx` is **yours alone**. `TASK-ACCOUNTSURFACE` is forbidden from touching it, so
two nav changes that logically belong to that task are executed **here**, because you are
already rebuilding the components that carry them.

### D1 — Apply the `My` labels in the nav

Owner's table (`TASK-ACCOUNTSURFACE` §4). Nav labels must match the Account page exactly:

`My Profile` · `My Preferences` · `My Login` · `My Documents` · `My Lessons` ·
`My Saved Items` · `My Posts` · `My Orders` · `My Gifts` · `My Stable`

**`Account` keeps no prefix** — page and nav link both stay plain `Account`.

Includes the bare **`Lessons`** label in the rail, which is the public-versus-personal
collision the rule exists to prevent.

### D2 — Point nav at `/app/stable`

Two call sites — `AppLayout.tsx:139` and `:504` — currently point at
`/app/account?section=stable`, which is why "My Stable" and "Account" land in the same
place.

**ACCOUNTSURFACE creates that route.** Confirm it exists before repointing; if it does not
yet, leave the links alone and say so rather than shipping a dead link.

---

## OWNER RULINGS — 2026-08-07. Phase 2 is unblocked.

All six open questions answered. Build against these.

1. **The avatar is an inert monogram.** Not a menu trigger, not a link. Remove the press
   interaction, hover state, pointer cursor, tap-highlight suppression and the menu ARIA
   semantics — a decoration must not announce itself as a control.

2. **Consistency everywhere.** The new state palette (**C5b**) applies to every nav row in
   both the rail and the drawer — no component keeps the old treatment. If it genuinely
   cannot work somewhere, report that rather than leaving a mixed style.

3. **Everything that lives only in the avatar menu moves to the side nav.** That includes
   the staff Account link, which staff have never had in the drawer. No exceptions.

4. **Admin and instructor converge** on the same item set. The current divergence is drift,
   not design.

5. **Saved Content is included** in the merged nav — but see the note below; the real answer
   is that the member chooses.

6. **Sign out goes at the bottom**, however much space sits between it and the last item.
   **Make it a full-width tap target.** On iOS the system overlays that region (home
   indicator, Safari toolbar), so a narrow control there is hard to hit. **This needs a real
   device check** — if full width is still awkward, report it rather than moving it.

### The nav is user-configurable — and this changes NAVPREFS

Owner's model: the welcome modal lists every nav item, explains what each one does, and the
member chooses which to keep. Each item then has a **toggle in Preferences** to show or hide
it in the nav. **This is not built yet** — it is `NAVPREFS`, still queued.

**One consequence for that queued task:** it was specced for **two toggles per item**, one
per menu. With a single merged menu it needs **one**. Recorded here so NAVPREFS is corrected
before it is built.

For this task: ship every item visible, including Saved Content. Hiding is NAVPREFS's job,
not a decision to hardcode here.

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
4. **Desktop — DECIDED, no longer a question.** Owner ruling 2026-08-07: **the avatar
   dropdown is removed on desktop too, and its contents merge into the left-side rail.**
   So the consolidation is universal — one menu everywhere, not a mobile-only change.

   This makes the A2 migration list serve both surfaces. Sign out, Account, Company,
   Quick access and the Manage groups all need a home in the rail as well as the drawer.
   The rail and drawer already share `RailLink`, so much of this is placement rather than
   new construction — but **confirm that before relying on it**.


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
8. The avatar renders as a monogram with **no** interactive behaviour — no press, no
   hover, no pointer cursor, and not announced as a control.
8. The desktop rail still reads correctly after B3 — screenshot it.
9. Superadmin's chrome is unchanged.
10. Desktop is unchanged unless Q4 said otherwise.
11. Typecheck and lint clean.

## Known, and NOT this task's to fix

- **The header wordmark crowding** below 410px is fixed — `TASK-BP410` merged. The
  481–590px dead zone it uncovered is **B5b above**, and is in scope.
- **Gilding the monogram** for mobile legibility is an owner-led design pass.

## Constraints

- Own git worktree off `origin/main`.
- **`ClauseDocument.tsx` is FROZEN** and is not involved.
- Screenshots at 390px for every visual change.
- Do not reorder existing nav items.

## Reporting

Phase 1 → `docs/reports/TASK-ONEMENU-PHASE1-PLAN.md`.
Phase 2 → `docs/reports/TASK-ONEMENU-REPORT.md`.

State what you verified on a real device versus in a harness.
