# NAVHOVER — frame evidence

Extracted from the owner's screen recording, `Screen Recording 2026-08-10 at 11.36.03 AM.mov`
(23.96s, 1376x1018). **The recording itself is NOT in the repo** — it sits one directory above
it, and its filename contains a NARROW NO-BREAK SPACE (U+202F) before "AM", which is why a
literal path with an ordinary space fails to open it. Glob it.

`leads-row-whole-recording-5fps.png` — the Leads row, whole recording, 5fps, 6 columns.
Locates the hover: it runs roughly **19.4s to 21.0s**.

`leads-hover-in-30fps.png` — the hover-in, **19.25s to 19.85s at 30fps, 3x**. This is the
evidence. Each yellow timestamp labels the tile ABOVE it.

`strip.swift` / `fine.swift` — the extractors. No ffmpeg on this machine; these use
AVFoundation via `/usr/bin/swift`. Run as `swift fine.swift <in.mov> <out.png>`.

## What the frames show

| frame | background | icon | label |
|---|---|---|---|
| 19.350s | white | green, visible | dark green |
| **19.383s** | still near-white | **GONE — invisible** | still dark |
| 19.417s | pale sage | faintly back | washing out |
| 19.450s | mid sage | white, visible | white |
| 19.483s+ | settled green | white | white |

**The icon drops out completely for ~1 frame (~33ms) at the start of every hover.** It snaps
to `cream-25` (near-white) with no transition while its background is still near-white and
only ~30ms into a 150ms ease. White on white. The green fill then catches up behind it and the
icon reappears.

Note the label and the icon are also out of sync with EACH OTHER: at 19.383s the icon is
already gone while the label is still dark; at 19.417s the label has washed out while the icon
has come back. Three elements, two transition rates.

Full transition reads ~19.383 -> ~19.483, about 100ms of visible change — consistent with
Tailwind's bare `transition-colors` default of 150ms.
