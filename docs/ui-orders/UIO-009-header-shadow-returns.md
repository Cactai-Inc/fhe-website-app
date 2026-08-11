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
| header | **keep** (`rgba(20,51,33,.15)`) | **ADD BACK — full width, over everything below it** |
| contract subheader | **ADD** bottom line, same value | keep (Y-axis) |
| nav rails | — | keep (X-axis) |

**Reuse the header's original shadow value** — `0 2px 4px rgba(16,28,22,.08), 0 6px 18px
rgba(16,28,22,.10)` — which is what the subheader already carries. Do not invent a second one.

## THE ELEVATION MODEL — owner, 2026-08-10. This supersedes the orchestrator's amendment below.

> *"the subheader is the issue, and why i opted for the full drop shadow from header instead of
> partial. if the nav gets it, the subheader does too... genuinely the subheader and nav can be
> on the same level but the header is always on top of everything."*

```
header              ALWAYS on top. Casts onto whatever sits below it.
nav + subheader     SAME LEVEL as each other. Receive the header's shadow,
                    and cast their own onto the content.
content             bottom. Receives from nav and subheader.
```

**The header's shadow is FULL WIDTH and falls on everything below it — nav included.**

**Why full rather than content-only.** A content-only shadow changes its coverage depending on
whether a subheader is present: full width on a page without one, partial on a page with one.
**That seam is worse than the optical imprecision it was avoiding.** A full shadow simply lands
on whatever is beneath it and needs no special-casing.

**Why nav and subheader are peers.** They are the same surface at two orientations — one
vertical, one horizontal. That is why they take matching treatment: each gets a line (the nav's
`border-r`, the subheader's new `border-bottom`) AND each casts its own shadow onto the content.

**Nothing needs a z-index change.** The header at `z-index: 40` above the rails at `z-30` is
already correct for this model.

---

### (SUPERSEDED — the orchestrator's earlier amendment, kept so it is not re-proposed)

It argued the header's shadow should not fall on the nav, on the grounds that a shadow cast
onto a nearer surface should be tighter than one cast further, and a single `box-shadow` cannot
vary by what it lands on. **The optics were right; the conclusion was wrong.** It missed that
nav and subheader are peers, so scoping the shadow to the content would make the shadow's
coverage depend on which page you are looking at. **Do not raise the rail's z-index.**

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
