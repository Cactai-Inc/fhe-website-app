# UIO-009 — the header keeps its line AND gets its shadow back; the subheader gains a line

**Owner confirmed:** 2026-08-10 · **Status:** READY

> "add the drop shadow to the header again, and add the outline to the bottom of the subheader."

## This does not revert UIO-001

UIO-001 moved the shadow off the header because it fell across the sidebar and implied one
continuous surface. **That reasoning still holds and the rails keep their shadow.**

What changes: the header now carries **both** its visible line and a shadow, and the contract
subheader gains a **bottom line** to match — so the two horizontal surfaces are treated alike.

| surface | line | shadow |
|---|---|---|
| header | **keep** (`rgba(20,51,33,.15)`) | **ADD BACK — over the content area only, never over the nav** |
| contract subheader | **ADD** bottom line, same value | keep (Y-axis) |
| nav rails | — | keep (X-axis) |

**Reuse the header's original shadow value** — `0 2px 4px rgba(16,28,22,.08), 0 6px 18px
rgba(16,28,22,.10)` — which is what the subheader already carries. Do not invent a second one.

## THE SHADOW MUST NOT FALL ON THE NAV — added 2026-08-10

> Owner: *"a drop shadow from the header over only the content area might look nicer, but the
> line across the nav means there is already separation anyway... wouldnt it look weird if the
> shadow doesnt look a little larger on the content area if the nav is sitting between the two?"*

**He is describing real optics.** A shadow cast onto a NEARER surface is tight; onto a FURTHER
one it is larger and softer. The nav rail is a raised surface — `#fdfcfa` is lighter than the
page, which is what makes it read as raised — so the header's shadow ought to be tighter on the
nav than on the content. **A single `box-shadow` cannot vary by what it lands on.**

**So it must not land on the nav.** The elevation model becomes coherent:

```
header      highest   casts DOWN  onto content
nav rail    raised    casts RIGHT onto content
content     lowest    receives both, casts nothing
```

**Nothing casts onto a surface at its own elevation.** The content area is the only receiver.

**This also removes a third separator doing a second job.** The nav already has its `border-r`
AND its own X-axis shadow from UIO-001. The header's shadow over it is separation number three
in the same place.

**Suggested mechanism, not a mandate.** The header is `z-index: 40` (`app-header.css:42`); the
rails are `relative z-30`. The rail is `sticky top-[var(--cs-hdr-h)]`, so its top edge sits at
the header's bottom edge and it **never overlaps the header's own box** — raising the rail
above the header therefore clips the shadow exactly where it is unwanted and nowhere else.

**Check the mobile drawer and scrim before changing any z-index.** They stack against the same
values and must stay above both. If raising the rail disturbs them, say so and stop rather than
re-stacking the whole app.

## Files

- `src/components/app/app-header.css`
- `src/components/app/ContractSubheader.tsx`

## Do NOT

- Do not remove the shadow from the rails. It is doing a different job.
- Do not remove the header's line. He asked for the shadow **again**, not instead.
- Do not touch `--cs-hdr-h`.

## Verification

Grep `dist/assets/*.css` for the header's `box-shadow` and the subheader's `border-bottom`.
**Minified CSS rewrites `rgba()` to 8-digit hex** — grep the property, read what follows.
