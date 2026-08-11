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

## THE FILE — apply this verbatim. No design decisions left.

`public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect x="2" y="2" width="60" height="60" fill="#faf8f4"
        stroke="#143321" stroke-width="4"/>
  <text x="32" y="43" text-anchor="middle"
        font-family="'Big Caslon', 'Libre Caslon Text', Georgia, serif"
        font-size="30" font-weight="400" letter-spacing="1.2"
        fill="#0d2118">FH</text>
</svg>
```

**Why it is not a literal copy of `.oh-mono`, and both reasons are 16px:**

| | header | favicon | why |
|---|---|---|---|
| border | `1px rgba(20,51,33,.40)` | **4px solid `#143321`** | 1px at 40% renders sub-pixel at 16px and vanishes into the tab bar |
| letters | 17px in 42px — 40% | **30px in 64px — 47%** | 40% is elegant at full size and spindly at a quarter of it |
| ground | transparent | **`#faf8f4`** | a tab bar is not guaranteed light; transparent disappears on a dark theme |
| corners | true square | true square | unchanged — the square is the mark |
| tracking | `.04em` | `1.2` at 64px | the same ratio, expressed in user units |
| typeface | `Big Caslon` → `Libre Caslon` → Georgia | **same stack** | Big Caslon is a macOS system font, so this matches the header exactly on a Mac and falls back to Georgia elsewhere. **An SVG favicon cannot load a web font** — `Libre Caslon Text` is listed but inert. At 16px the difference is not perceptible. |

**Do not convert the letters to paths.** It would guarantee identical letterforms everywhere and
solve a problem invisible at this size.

## ALSO MISSING — `apple-touch-icon`

`index.html` declares only `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`.
**iOS home-screen bookmarks do not use SVG.** Add a **180×180 PNG** at
`public/apple-touch-icon.png` rendered from the same mark, and reference it:

```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

**The PNG needs the ground filled** — iOS composites onto its own background and a transparent
one goes black.

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
