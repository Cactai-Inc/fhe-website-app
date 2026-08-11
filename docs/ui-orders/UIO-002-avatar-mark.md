# UIO-002 — the avatar becomes a ring, and on mobile a solid button

**Owner confirmed:** 2026-08-10
**Status:** READY

> ## REWRITTEN 2026-08-10 — the earlier version was built on a wrong premise. Ignore it.
>
> An earlier revision specified a **translucent** green fill and carried a compensated base
> (`#02d67c`) back-solved against the header's cream, because a translucent green over a warm
> backdrop rotates ~72 degrees toward yellow.
>
> **The owner corrected the approach:** *"we dont need translucent or transparent buttons we
> arent working with glass... i was wrong in approach so i was wrong with both instructions."*
>
> **Everything is OPAQUE. An opaque fill renders exactly its declared colour** — no
> compositing, no hue rotation, no backdrop dependence. The whole compensation apparatus is
> deleted, not parked. **Do not resurrect `#02d67c`.** Every value below is an existing entry
> in the brand scale, so **trap T1 does not apply to this order** — there is no arbitrary
> value and no non-standard alpha to grep for.

## What he asked for

> "make the letter larger to match the letters in the icon logo, add the ring and on mobile,
> fill the ring... then on click or mouseover (only for mobile layout) [it changes] to
> indicate its a functional button."

Plus, on the state direction: *"the fill should be much darker... we need a larger jump."*
**Interaction deepens the fill.** Fading on press reads as the control disabling.

## What is wrong now

`app-header.css`: the desktop avatar is `background: transparent` with `border: 0` — a bare
green letter with no containing shape — while `.oh-mono` beside it keeps
`border: 1px solid rgba(20,51,33,.40)`. The two marks do not read as a pair. Letter is 17px in
a 42px mark.

## THE FILL AND THE LETTER CHANGE TOGETHER. THIS IS ONE DECISION, NOT TWO.

**Owner, 2026-08-10:** *"make sure the thread knows to switch the color of the letter when the
color of the button is changed from an empty fill to a solid fill... i want to leave nothing
to interpretation."*

**There is no state in which the fill changes and the letter does not.**

| layout | fill | letter | contrast |
|---|---|---|---|
| **desktop** — ring only, no fill | none (transparent) | **`green-900 #0d2118`** | 13.4 vs the cream header |
| **mobile, rest** — solid | `green-800` + 14% white = `#355040` | **`cream-25 #fdfcfa`** | 8.68 |
| **mobile, `:active`** — solid | `green-800` pure `#143321` | **`cream-25 #fdfcfa`** | 13.43 |

### What happens if you change one and not the other

**Keeping the green letter on the filled mobile mark gives `green-900` on `green-800` — a
contrast ratio of 1.22.** That is invisible. Not "hard to read": the letter disappears
completely, and the only way into the nav on a phone becomes a blank green circle.

**This exact failure has already shipped on this project once** — a selected nav row whose
text moved to a new palette while its icon did not. Do not repeat its shape.

### The rule, stated as a rule

- **Empty fill -> dark letter.** Desktop.
- **Solid fill -> cream letter.** Mobile, both states.
- The letter does **not** change between mobile rest and `:active`. Only the fill does. Cream
  clears 8.68 and 13.43 respectively, so one letter colour serves both.

---

## What it must become

### Desktop — ring only

- **Ring:** `1px solid rgba(20, 51, 33, .40)` — identical to `.oh-mono`, same 999px radius.
- **Fill:** none.
- **Letter:** `green-900 #0d2118`, as now, at the new size.

It pairs with the logo mark because it is an identity mark here, not a control.

### Mobile layout — the brand colour under a white veil that clears on press

**The owner's mechanism, 2026-08-10:**

> "we set the color to the brand color for the avatar fill on mobile layout... and then there
> is a white low opacity overlay that changes to a lower opacity when the button is interacted
> with. this results in the button looking interactive without losing the branding alignment
> of the accurate color being distorted."

**The fill is `green-800 #143321` — the brand colour itself, never a derived value.** A white
overlay sits on top and *reduces* on press, so the pressed state IS the brand colour, exactly.

| state | white overlay | renders | cream letter | vs header |
|---|---|---|---|---|
| rest | **14%** | `#355040` | 8.68 | 7.85 |
| `:active` | **0%** | **`#143321` — pure brand** | 13.43 | 12.14 |

- **Press step: 1.55.** The veil lifting is the whole interaction.
- **Letter:** `cream-25 #fdfcfa` in both states.
- Keep the ring. The fill sits inside it.

**Hue is mathematically fixed at 145.2 degrees in every state**, because white is neutral and
blending toward it moves lightness, not hue. That is precisely what the owner was protecting.
Verified at every overlay value from 0 to 36%: hue never moves.

**THE ONE CONSEQUENCE, and it is a fork not a dial.** A white overlay preserves hue but
**collapses saturation** — brand green is 43.7% saturated; at 14% white it is 20.1%, at 22% it
is 14.4%. So the veil must stay LOW or the mark reads muted grey-green rather than brand green.
14% is chosen as the point where the rest state still reads green while leaving a 1.55 step.

**If the owner asks for a bigger press step, raising the rest overlay costs saturation** —
20% white gives a 1.88 step but drops the rest state to 15.6% saturation. That trade goes back
to him; do not simply turn the number up.

**Do not implement this as two hardcoded hex values.** It must be the brand token with an
overlay, so that changing the brand colour changes the button. A pseudo-element or a
`linear-gradient` white layer over `background: theme(colors.green.800)` both work; pick one
and say which.

### Why not a light-green fill (rejected)

An earlier revision proposed `green-100` at rest. It renders at **1.20 contrast against the
cream header** — effectively invisible. That is the Sarah failure repeated: a low-contrast
control a real user could not find on a real phone. **This mark is the only way into the nav
on mobile** (ONEHEADER deleted the drawer tab), so it cannot be quiet.

### Letter size — 17px becomes 20px

He asked for it to match the letters in the icon logo. `.oh-mono` renders `FH` at 17px in the
same 42px mark; the avatar carries one character, so it takes more optical weight before it
crowds. **Leave `.oh-mono` at 17px** — he asked for the avatar to change, not the logo.

### `:active` only, not `:hover`

**There is no hover on touch.** Gate on `[@media(hover:hover)]` the way the nav rows already
do, so a sticky post-tap `:hover` can never latch the pressed fill on. The mobile layout gets
`:active`; the desktop mark has no fill state at all.

## Files

- `src/components/app/app-header.css`

**No `tailwind.config.js` change.** The fill is the existing `green-800` token; the overlay is
white at two opacities.

## Do NOT

- Do not give the desktop avatar the fill. Fill is the mobile layout only.
- Do not change `.oh-mono` to match the avatar. He asked for the avatar to gain a ring, not
  for the logo mark to change.
- Do not touch the 42px mark size, `--cs-hdr-h`, or any breakpoint.
- Do not reintroduce a *translucent green* in any form — the fill is opaque brand colour with
  a white layer over it, which is a different mechanism and the only one that keeps the hue exact.
- Do not bake the two states in as literal hex values. The brand token must be the source.

## Verification

Grep `dist/assets/*.css` for each rule body — the fills, the ring, the letter colours, and the
`:active` block. **Minified CSS keeps the space after the colon**; allow for it.

State the rendered contrast of the letter against the fill in both states. Both should match
the table above exactly, because nothing is composited.
