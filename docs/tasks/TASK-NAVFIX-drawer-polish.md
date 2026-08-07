# TASK NAVFIX — mobile drawer corrections

Four corrections to the shipped mobile nav drawer, from the owner testing it on a phone.
The tab and its motion are confirmed good — **do not change the tab's appearance, position
or animation**, only its touch sensitivity.

All four are small. The care is in not disturbing what works.

---

## N1 — The tab's touch target is too small

`.cs-drawer-tab` is **34 × 46px** (`header-cardstock.css` ~355). Apple's guidance is a
44 × 44px minimum; 34px wide is under it, which is exactly why the owner reports it as
*"not so sensitive to touch."*

**Enlarge the hit area without changing a single visible pixel.** An invisible
pseudo-element extending the touchable region past the drawn tab is the right approach —
padding or a bigger box would move the artwork.

The tab is `position: fixed` at the left edge, so extend right and vertically. Do not
extend left past the viewport edge. Verify the enlarged area does not overlap anything
interactive beneath it.

## N2 — Remove the Close button

`AppLayout.tsx` ~1024. The drawer header holds a "Close" button that predates the tab. The
tab now closes the drawer and rides out on its edge, so this is a second control for the
same job.

Remove **the button only**. The `Menu` label beside it stays. Keep the row's spacing
sensible once the button is gone — the comment above it notes the padding exists to clear
the first nav item.

`closeMobileNav` stays in use by the scrim, Escape, route change and link selection.
Verify all four still work after removal.

## N3 — Replace the active-page fill

`RailLink` (~line 289) marks the current page with `bg-cream-200 text-green-800
font-medium` and a gold icon. On the frosted-glass drawer an opaque cream fill fights the
material — it reads as a card pasted onto the glass.

**Remove the background fill.** The page still needs to be identifiable, so replace it
with a non-filling indicator.

Recommended: a **left accent bar** — a 2–3px gold rule on the item's leading edge, with
the label kept at `font-medium` and the icon staying gold. It marks position without
covering the glass, and it reads at a glance on a small screen.

If a left bar collides with the existing `pl-9` indent used by nested community links,
report it rather than reworking the indent scheme.

**Scope:** `RailLink` is shared by the drawer **and the desktop rail**. Changing it changes
both. That is acceptable and probably desirable — confirm the desktop rail still reads
correctly and screenshot it — but if the two need to diverge, stop and report rather than
forking the component on your own.

Keep `aria-current` behaviour intact; the accessible signal must not depend on colour.

## N4 — Neutralise the overlay

`AppLayout.tsx` ~1010: the scrim is `bg-green-950/50`. The drawer is green glass, so scrim
and drawer sit in the same colour family and barely separate — the only contrast is the
frosting itself. As the owner put it, with clear glass the whole thing would be uniform.

**Move the scrim into black and white.** Something like `bg-black/40` — tune the opacity so
the drawer reads as clearly forward of the page without the backdrop turning heavy.

Removing the scrim entirely is also acceptable **only if** the drawer still reads as
clearly separated from the content behind it. It must keep its click-to-close behaviour
either way, so if it is removed visually it still needs a transparent click-catcher.

Show both options in the report if it is a close call.

## N5 — The tab overlays page content

Owner report: the tab sits over *"the c and the o and half the w"* of the top two lines on
the community welcome page.

**It is worse than a one-page collision.** The tab is `position: fixed` (34px wide at
`left: 0`) and `<main>` carries only `px-4` (16px) on mobile. So the tab overlays an ~18px
strip of whatever is at that vertical band — **at every scroll position**, on every page.
Feed cards, all seven pages using the eyebrow title model, everything that scrolls past.

Two parts, and the second is a decision:

### N5a — Centre the title block (do this)

`src/pages/app/Home.tsx` ~47–60: the eyebrow, the `Welcome new members!` heading and the
description are left-aligned inside a centred page. Centre them.

The description carries `max-w-2xl`, which needs `mx-auto` to actually centre rather than
just centring its text within a left-anchored box.

**Scope check first:** seven pages use this title model — `Home`, `DashboardHome`,
`CatalogPage`, `CareHome`, `DealHome`, `MyPosts`, `AccountHub`. Centring only one makes the
app inconsistent. Report what the others look like and whether the change should apply to
all; **do not change all seven on your own initiative** — bring it back.

### N5b — The persistent overlap (recommend, then stop)

Centring the titles removes the collision the owner saw, but not the underlying overlap.

**Orchestrator's recommendation:** raise `<main>`'s left padding on mobile only (below
`lg`, where the tab exists) to clear 34px plus a small gap — roughly `px-4` → `pl-11`. Cost
is ~28px of usable width on a 390px screen, about 7%.

That cost is real and the owner has said repeatedly that the app needs width, so **do not
implement N5b. Measure it, screenshot it both ways, and report** — the owner decides.

Alternatives worth costing in the same report: shifting the tab partly off-screen so less
of it protrudes; moving it lower; or leaving the overlap as accepted behaviour.

---

## Verification

The owner will judge this on a phone, so:

1. **Tab tapping** — reliable at the edge of the tab, not just dead centre. This is the
   whole point of N1; if you cannot test on a device, say so plainly.
2. All four close paths still work: tab, scrim, Escape, selecting a link.
3. The current page is identifiable at a glance in the drawer, without a fill.
4. The desktop rail still reads correctly after the N3 change — screenshot it.
5. Superadmin's nav is untouched (it keeps its own mobile button and is excluded from the
   tab).
6. N5a: the community welcome text no longer sits under the tab, at 390px.
7. N5b: screenshots with and without the gutter, and the measured width cost.
8. Typecheck and lint clean.

## Constraints

- Own git worktree off `origin/main`.
- **Do not change the tab's size, position, shape or animation.** Only its hit area.
- **`ClauseDocument.tsx` is FROZEN** and is not involved.
- Screenshots at 390px for every visual change.

## Reporting

`docs/reports/TASK-NAVFIX-REPORT.md`. State what you verified on a real device versus in a
harness — prior threads in this area had no browser and said so, which was correct.
