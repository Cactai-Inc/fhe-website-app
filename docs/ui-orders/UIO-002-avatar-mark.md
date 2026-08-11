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

## What it must become

### Desktop — ring only

- **Ring:** `1px solid rgba(20, 51, 33, .40)` — identical to `.oh-mono`, same 999px radius.
- **Fill:** none.
- **Letter:** `green-900 #0d2118`, as now, at the new size.

It pairs with the logo mark because it is an identity mark here, not a control.

### Mobile layout — a solid button

| state | fill | letter | contrast |
|---|---|---|---|
| rest | **`green-600` `#215531`** | `cream-25` `#fdfcfa` | **8.50** |
| `:active` | **`green-800` `#143321`** | `cream-25` | **13.43** |

- **Press step:** 1.58 — the largest available in the scale between two usable fills.
- **Fill against the cream header:** 7.69 at rest. It is unmistakably a control.
- Keep the ring. Fill sits inside it.

**Why not the light greens.** `green-100` renders at **1.20 contrast against the header** —
effectively invisible. That is the Sarah failure repeated: a low-contrast control that a real
user could not find on a real phone. **This mark is the only way into the nav on mobile**
(ONEHEADER deleted the drawer tab), so it cannot be quiet.

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

**No `tailwind.config.js` change.** Every colour is an existing brand-scale entry.

## Do NOT

- Do not give the desktop avatar the fill. Fill is the mobile layout only.
- Do not change `.oh-mono` to match the avatar. He asked for the avatar to gain a ring, not
  for the logo mark to change.
- Do not touch the 42px mark size, `--cs-hdr-h`, or any breakpoint.
- Do not reintroduce translucency here in any form.

## Verification

Grep `dist/assets/*.css` for each rule body — the fills, the ring, the letter colours, and the
`:active` block. **Minified CSS keeps the space after the colon**; allow for it.

State the rendered contrast of the letter against the fill in both states. Both should match
the table above exactly, because nothing is composited.
