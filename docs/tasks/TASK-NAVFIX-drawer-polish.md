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
6. Typecheck and lint clean.

## Constraints

- Own git worktree off `origin/main`.
- **Do not change the tab's size, position, shape or animation.** Only its hit area.
- **`ClauseDocument.tsx` is FROZEN** and is not involved.
- Screenshots at 390px for every visual change.

## Reporting

`docs/reports/TASK-NAVFIX-REPORT.md`. State what you verified on a real device versus in a
harness — prior threads in this area had no browser and said so, which was correct.
