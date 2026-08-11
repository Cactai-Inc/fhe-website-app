# UIO-002 — the avatar becomes a ring that reads as a button on touch

**Owner confirmed:** 2026-08-10
**Status:** READY

**Values chosen by the orchestrator, 2026-08-10, at the owner's direction.** He could not reach
the authed state on the dev server to compare options and said: *"Just follow my last message
and you'll implement the correct solution i think. if it doesnt look good we'll try something
else."* That is a deliberate, narrow suspension of the standing "never invent a value" rule —
**it does not generalise.** Every number below is stated with its reasoning so a single dial
can be turned rather than the whole thing re-guessed.

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

### The values, and why each one

**1. Letter size — `17px` becomes `20px`.** The owner asked for it to match the letters in the
icon logo. `.oh-mono` renders `FH` at 17px in the same 42px mark; the avatar carries a single
character, so it can take more optical weight before it crowds. Keep `.oh-mono` at 17px —
he asked for the avatar to change, not the logo.

**2. Ring — `1px solid`, matching `.oh-mono`'s `rgba(20, 51, 33, .40)`.** Same weight, same
colour, same 999px radius. The two marks are meant to read as a pair; that is the whole point
of the request. Desktop gets the ring and NO fill.

**3. The compensated green — `#02d67c`. THIS IS NOT A COLOUR ANYONE SEES.**

A translucent green over the header's cream composites roughly **72 degrees toward yellow**.
`navfill` is compensated against the near-white nav panel (`#fdfcfa`), `glass.nav` against the
cream page (`#faf8f4`); **the header is `#f5f0e8`, a third surface, and neither existing token
is valid here.** Reusing one is the C2 failure again.

Back-solved against `#f5f0e8` at both alphas, worst hue error **3.8 degrees** from brand 145:

| state | alpha | renders | hue | sat | contrast vs the green-900 letter |
|---|---|---|---|---|---|
| rest | **0.18** | `#c9ebd5` | 141.2 | 45.9% | 13.08 |
| `:active` | **0.36** | `#9ee7c1` | 148.8 | 60.3% | 11.74 |

For comparison, **brand `green-800` at the same alphas renders `#cccec4` (hue 72) and
`#a4aca0` (hue 100)** — saturation under 10%. Grey. That is what "just use the brand green"
produces here.

**4. Alphas — `0.18` rest, `0.36` on `:active`.** A doubling: one clearly perceptible step,
which is what touch needs since there is no hover to escalate through. Material's 8-to-12%
range assumes a hover state exists.

**Known dial:** saturation at 46/60% is livelier than the nav's ~32%. It is a small mark on a
phone so it should carry it, but if the owner says it is too vivid, **lower the alphas before
touching the base** — the base is what holds the hue correct.

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
