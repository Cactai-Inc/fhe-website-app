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
| rest | **0.22** | `#c0ead0` | 142.9 | 50.0% | 12.76 |
| `:active` | **0.55** | `#6fe2ad` | 152.3 | 66.5% | 10.54 |

For comparison, **brand `green-800` at the same alphas renders `#cccec4` (hue 72) and
`#a4aca0` (hue 100)** — saturation under 10%. Grey. That is what "just use the brand green"
produces here.

**4. Alphas — `0.22` rest, `0.55` on `:active`.** A 33-point jump.

The owner, 2026-08-10: *"the fill should be much darker than 8-12% opacity... we need a larger
jump than 2-4%."* **He was right, and Material was the wrong yardstick.** Material's 8/12% is a
**state layer** — a tint drawn ON TOP of a component that already has its own fill. This ring
has no underlying fill, so the percentage IS the whole mark. The two numbers were never
comparable.

### A FORK, not a dial — know this before "make it darker"

**With this base, raising alpha makes the fill MORE VIVID, not darker.** Even at 0.70 the
green-900 letter still clears AAA (9.80):

```
a=0.22 -> #c0ead0   a=0.36 -> #9ee7c1   a=0.55 -> #6fe2ad   a=0.70 -> #4bde9c
```

That is inherent, not a tuning miss. Holding brand hue over a LIGHT cream forces a bright,
saturated base — a dark base renders grey here, which is exactly what `green-800` does
(hue 72 at 0.18, hue 100 at 0.36, saturation under 10%). So:

- **translucent and hue-correct** -> light and vivid. **This is what the owner asked for**
  ("a version of green with transparency to match the hue of our company color").
- **genuinely dark green** -> only at near-opaque alpha, where the backdrop stops mattering
  and it is simply a filled circle, not a translucent one.

If he asks for "darker" after seeing it, **that is a request to change fork, not to raise the
alpha.** Come back rather than pushing the number.

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
