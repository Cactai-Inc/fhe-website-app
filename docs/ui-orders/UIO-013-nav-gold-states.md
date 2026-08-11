# UIO-013 — the nav loses its fill states and takes gold

**Owner, 2026-08-10.** *"lets see how this looks"* — this is a try-it, not a settled design.

## What changes

**Remove the hover fill entirely** — nav rows and the "Add New" button. No `bg-navfill/64`.

| state | now | after |
|---|---|---|
| hover | green fill, cream text | **a gold underline under the TEXT ONLY** — not the row, not the icon |
| selected | `bg-navfill/80`, cream text | **a light gold fill** — the same shape, gold where the green was |
| badge on a selected/hovered row | gold bubble | **the panel surface colour** (`#fdfcfa`) |

**"Under the text only" is the requirement.** A border-bottom on the row spans its full width;
this must sit under the label's own width. Use an inline element or a background-image
underline on the text span — **not the row.**

**The selected fill is "light gold", not `gold-600`.** Swap the green for a gold at an
equivalent weight. `navfill` is a hue-compensated blend input; **a gold equivalent has to be
solved the same way, against the near-white panel `#fdfcfa`.** State the rendered result and
its contrast with the label.

**Badge colour swap:** on a row whose state has changed, the bubble takes the panel surface so
it reads as a hole rather than a second accent competing with the gold.

## Do NOT

- Do not touch `NAV_ROW_ACTIVE`'s *structure* — only its colour.
- Do not underline the icon, and do not extend the underline across the row.
- Do not change the badge on rows in their rest state.
- Do not touch `UIO-011`'s evaluation page — that asked a different question and is unshipped.

## Verification

Grep `dist/assets/*.css` for the underline rule and the gold fill. **Minified CSS keeps the
space after the colon and rewrites `rgba()` to 8-digit hex** — grep the property, read what
follows.

**State the contrast of the label against the light-gold selected fill.** Gold is a much
lighter base than green; a green-800 label that cleared 8.5:1 on `navfill/80` may not clear
4.5 on gold. **If it does not clear, say so and stop** rather than darkening the label to
compensate.
