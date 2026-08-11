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
| header | **keep** (`rgba(20,51,33,.15)`) | **ADD BACK** |
| contract subheader | **ADD** bottom line, same value | keep (Y-axis) |
| nav rails | — | keep (X-axis) |

**Reuse the header's original shadow value** — `0 2px 4px rgba(16,28,22,.08), 0 6px 18px
rgba(16,28,22,.10)` — which is what the subheader already carries. Do not invent a second one.

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
