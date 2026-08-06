# TASK BP410 — header breakpoint for 375–410px phones

## The defect

At the ≤480px breakpoint the header needs ~404.6px of width (measured by the HEADER
thread; reproduced in its report §responsive). iPhone 14/15/16 and the Pros report
390/393 CSS px — the volume iPhones of the last three years — so on them the content
overflows and the avatar clips ~2.6px. The owner's iPhone Air (~420px) clears it, which
is why it wasn't caught on-device.

## The fix (owner-specified)

A new breakpoint at **≤410px** that recovers ~15px+ of horizontal space with, verbatim:
"the same fidelity", "without the text shrinking, without losing the words, and without
crowding". Budget (from the measured 274.6px name width):

| | current (≤480) | new (≤410) |
|---|---|---|
| logo | 56px | **48px** |
| avatar | 50px | **42px** |
| side padding | 12px | **8px** |
| wordmark | 30px "French Heritage" | **unchanged** |
| total | ~404.6 | ~380.6 → 9.4px slack at 390 |

## The non-negotiable part — redraw, don't resize

The marks' SVG geometry is drawn at 56 and 50 units, matching their render size 1:1 so
the 1px stroke offsets land on exact device pixels. Rendering those drawings at 48/42
resamples them — the exact cause of the jagged/fuzzy outline defect this header already
went through once (see `docs/reference/header-mockup.html` comments and
TASK-HEADER-REPORT).

So this breakpoint requires a **second pair of SVG drawings** at 48-unit and 42-unit
viewBoxes (scale the path/circle geometry numerically; keep stroke-width 1.8 and the 1px
layer offsets AS-IS — they are physical pixels, not proportional geometry), swapped in at
≤410px. Wrapper equals viewBox at every size. Letters: scale `.cs-fh`/`.cs-av` font sizes
proportionally (19px→~16.5px, 25px→~21px — round to the nearest half-pixel and eyeball
against the mockup's proportions).

The avatar's well-band/press machinery (`.cs-ring-wall`, clip, press offsets) must come
along at the new geometry: recompute cx/cy/r for the 42-unit drawing (r = 22.2 × 42/50 ≈
18.6, etc.). Press travel values (1px hover / 2.25px click) stay absolute — do not scale.

## Rules

- Own worktree, branch `task/bp410` off origin/main.
- Touch only `CardstockHeader.tsx` + `header-cardstock.css`. No AppLayout changes.
- The mirrored create-tab layer and drawer tab read `--cs-hdr-h` and
  `--cs-tab-right` — check both still resolve correctly at the new breakpoint
  (the tab is desktop-only, but the drawer tab is live here).
- Typecheck + lint clean.

## Verify

Screenshot the header at **375, 390, 393, 410, 412 (Android), 420** widths (portrait) —
no overflow, no clipping, no crowding at any of them; outline SMOOTH (zoom a screenshot
at 3x scale factor to confirm no resampling fuzz). Confirm ≥411px renders byte-identical
to before this change (the new breakpoint must not leak upward). Landscape rule unaffected.

## Report

`docs/reports/TASK-BP410-REPORT.md`, screenshots attached/described, what was measured vs.
assumed.
