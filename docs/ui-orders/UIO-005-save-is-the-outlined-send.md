# UIO-005 — Save becomes the outlined form of Send; the favicon adopts the header mark

**Status:** READY

## Why

Two related brand-consistency items designed on `task/uireview` at `b052637`.

**Save and Send are the same action at different commitment levels**, so they should be the
same button in filled and outlined form rather than two unrelated treatments. Outlined reads
as the lower-commitment sibling of the filled primary.

**The favicon is currently `public/favicon.svg` — the bare letters `FH`.** The header now
carries a designed mark; the tab icon should be the same mark, not a different one.

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
