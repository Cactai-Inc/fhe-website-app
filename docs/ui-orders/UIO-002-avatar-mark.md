# UIO-002 — the avatar becomes a ring that reads as a button on touch

**Owner confirmed:** 2026-08-10
**Status:** BLOCKED — four values are not specified. See "What it must become".

## What he asked for

> "the request was to make the letter larger to match the letters in the icon logo, add the
> ring and on mobile, fill the ring with a version of green with transparency to match the hue
> of our company color and then on click or mouseover (only for mobile layout) the transparency
> changes to indicate its a functional button."

## What is wrong now

`app-header.css`: the desktop avatar is `background: transparent` with `border: 0` — a bare
green letter with no containing shape, while `.oh-mono` beside it keeps
`border: 1px solid rgba(20,51,33,.40)`. The two marks do not read as a pair. Letter is 17px in
a 42px mark.

## What it must become

Settled:

- The avatar gets a **ring**, matching the logo mark's treatment.
- The **letter grows** to match the letters in the icon logo.
- On the **mobile layout only**, the ring is **filled with a translucent green**.
- On `:active` the fill becomes **LESS transparent**, not more.

### The interaction direction is settled and has a reason

Material Design's state layers escalate rest 0% -> hover 8% -> pressed 10-12%; Apple's controls
darken on press. **Interaction ADDS signal.** Fading on press reads as the control retreating
or disabling.

**There is no hover on touch.** The mobile layout gets `:active` only — one step, not two, and
it must register for the ~100ms a tap lasts. That argues for a larger delta than the 8% a
hover state would use, because there is no hover to warm the user up. This codebase already
gates hover on `[@media(hover:hover)]` for exactly this reason; follow that pattern.

### NOT specified — do not invent these

1. the letter size
2. the ring width and colour
3. **the compensated green** — see the warning below
4. the two alpha values (rest and `:active`)

**Build a rendered comparison under `docs/reference/` and let the owner choose.** This is the
method that settled the nav colour after numbers failed: "I can't do anything with numbers."

### THE GREEN MUST BE RE-DERIVED FOR THIS BACKDROP

A translucent green over the header's cream composites roughly **72 degrees toward yellow**.

- `navfill` is pre-compensated against the **near-white nav panel** (`#fdfcfa`)
- `glass.nav` is pre-compensated against the **cream page** (`#faf8f4`)
- the header is **`#f5f0e8`** — a third surface

**Neither existing token is valid here.** Reusing one renders grey-green, which is the C2
failure the owner has already been through once. Derive a third compensated base against
`#f5f0e8`, at BOTH alphas, and state the rendered hue and contrast for each — the method and
worked examples are in `docs/reference/`.

## Files

- `src/components/app/app-header.css`
- `tailwind.config.js` — if a new compensated token is added, it is declared here as a NAMED
  utility, never an arbitrary value

## Do NOT

- Do not give the desktop avatar the mobile fill. The fill is the mobile layout only.
- Do not change `.oh-mono`'s border to match the avatar; the owner asked for the avatar to
  gain a ring, not for the logo mark to change.
- Do not touch the 42px mark size or `--cs-hdr-h`.

## Verification

Grep `dist/assets/*.css` for every new rule body. **An arbitrary Tailwind value or a
non-standard alpha can emit nothing at all while typecheck, lint and build pass** —
`bg-cream-100/[0.92]` produced no rule, and `bg-navfill/64` produced none until 64 was declared
in the config. State the rendered hue and contrast of the fill at both alphas.
