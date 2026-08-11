# UIO-005 — Save becomes the outlined form of Send; the favicon adopts the header mark

**Status:** READY

## Why

Two related brand-consistency items designed on `task/uireview` at `b052637`.

**Save and Send are the same action at different commitment levels**, so they should be the
same button in filled and outlined form rather than two unrelated treatments. Outlined reads
as the lower-commitment sibling of the filled primary.

**The favicon is a DIFFERENT MARK built from retired parts.** The owner is still waiting on
this — *"still waiting for the browser tab favicon to be updated to match it."*

`public/favicon.svg` as it stands:

```svg
<rect width="64" height="64" rx="10" fill="#143321"/>
<text ... font-family="Georgia, 'Cormorant Garamond', serif"
      font-size="34" font-weight="500" fill="#ba9935">FH</text>
```

| | favicon today | `.oh-mono`, the header mark |
|---|---|---|
| typeface | **Cormorant Garamond** — RETIRED | Libre Caslon Text |
| weight | **500** — Libre Caslon ships 400/700 only | — |
| letters | `#ba9935` gold | `#0d2118` green-900 |
| ground | `#143321` green | transparent |
| corners | `rx="10"` rounded | **true square**, no radius |
| tracking | none | `letter-spacing: .04em` |

**Cormorant was replaced deliberately** — the owner's decision, recorded in `tailwind.config.js`:
its thin strokes lost the emboss. The favicon never got that change.

## Match the FORM. Judge the fill at 16px.

**Match without argument:** the typeface (Libre Caslon Text), a shipped weight (400 or 700,
never 500), the `.04em` tracking, and the **true square** — no `rx`.

**The fill needs judgement, not blind copying.** The header mark is dark letters on a light
ground, which works at 42px. **A browser tab renders this at 16px**, where thin dark strokes on
a light ground can disappear against a light tab bar. A solid dark tile with light letters is
often the legible choice at that size, and it is what the current favicon does — the one thing
it gets right.

**Render both and look at 16px before choosing.** If the inverted fill wins, say so and keep
it — matching the header's colours exactly is not the goal; **being recognisably the same mark
is.**

**Also check the dark-tab-bar case.** A dark browser theme puts a dark tile on a dark bar.

## What it must become

Cherry-pick `b052637` and reconcile against main. Two changes:

1. **Contract page** — `Save` renders as the outlined variant of `Send`. Same shape, same
   radius, same metrics; outline instead of fill.
2. **Favicon** — adopts the header's mark.

## Files

- `src/pages/app/ContractPage.tsx`
- `public/favicon.svg`

## Do NOT

- **`ClauseDocument.tsx` is FROZEN.** It is a stop-and-propose rule, not a prohibition — if
  this needs a change there, present the minimal diff and WAIT. Do not apply it.
- Do not restyle Send. Save moves to match it, not the reverse.

## Verification

Grep the built CSS for the outlined variant's rule body. For the favicon, confirm the file
changed and that `index.html` still references it.

**Neither is browser-verified by grepping.** The owner confirms both by eye.
