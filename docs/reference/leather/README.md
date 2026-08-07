# Leather — design "version B" (PAUSED)

Preserved from a scratchpad before it was lost to a `/tmp` cleanup. This is the **B** in
an A/B against the shipped Racing Green cardstock header. Owner paused it 2026-08-06 to
clear the build queue; resume from here.

## Decided

**Material.** Owner chose the **whole hide** rendered via `background-size: cover`, not a
regional strip — *"warm in the center, nice tanning on the ends, not too much texture or
artifacts."* Regional cuts (long edge A–F, short edge H–J rotated) were all rejected.
Source: `vecteezy_brown-leather-texture-background_73921090.jpg`, 5000×3421.

**Production asset: `leather-band-2400.jpg`** (453 KB, from 6.8 MB).
- Downscaled by **repeated halving**, not one resize. Halving averages every source pixel
  into the result; a single large resize skips pixels, which is exactly how fine grain
  turns into shimmer. This was the owner's stated worry — *"the alias into noise is my
  concern, the bloom and burnishing is my goal."*
- Cropped to the **centre 45% of height**. With `cover` on a wide short header only a
  middle slice is ever visible (~33% on a phone, ~10% on desktop), so nothing visible is
  lost. The left/right tanning the owner liked runs horizontally and is untouched.
- `leather-band-1600.jpg` (230 KB) shows how far it pushes.

**Stamping.** Six treatments were judged; only **"emboss · raised face"** works — *"the
only one that almost looks like the letters are the actual material and definitely look
3D."*

```css
color: rgba(255,206,150,.13);
text-shadow: 0  1.4px 1.4px rgba(0,0,0,.62),
             0 -1.2px 1.2px rgba(255,214,166,.34),
             0  2.5px 4px   rgba(0,0,0,.26);
```

Why it wins: a **raised** letter is uncompressed, so grain and tone stay continuous with
the hide and only the lighting changes. The deboss variants used a dark translucent
"compression" fill, which reads as stain rather than material. Emboss also won on
cardstock — raised is consistently the answer. Returning light must be **warm**; tan
leather bounces warm, and a neutral highlight is the usual tell that a material effect is
faked.

## Still to build

- Full header composition (logo + wordmark + avatar) in the raised treatment
- The **green-glass tab** tucked behind the header, pulling a **full-screen** glass menu
  down. Uses the app's existing `NAV_GLASS`. Mobile only — it *replaces* the drawer and
  the avatar menu, and the avatar becomes pure personalisation.
- **Over-centre bistable mechanism**: both end states held under tension; a physical
  button depression trips it past centre; travel is fast-then-decelerating in **both**
  directions with a trace of overshoot at the stop. Not a spring bounce, not a motor —
  self-powered in both directions.
- Real content must **scroll visibly beneath the glass**. That visibility is the entire
  point, and it is what paper could never offer — the reason the tab belongs on mobile
  here when it did not on the cardstock header.
- Leather login/cover screen where typed characters stamp into the hide.

## Files

| File | What |
|---|---|
| `leather-band-2400.jpg` | **the production asset** |
| `leather-band-1600.jpg` | smaller variant |
| `leather-G.html` | downscale comparison + the six stamping treatments |
| `leather-proto.html` | the six treatments on regional strips |
| `leather-swatches.html` | raw regional cuts, no treatments |
| `leather-loading.html` | earlier gradient-built leather cover |

The swatch pages reference strip files that were **not** preserved — they were rejected,
and are re-cuttable from the source hide if ever needed.

## Gotcha worth remembering

The mockup server (`/tmp/nocache.py`) was `socketserver.TCPServer` — **single-threaded**.
Chrome opens ~6 parallel connections, so multi-megabyte JPEGs queued and timed out, and
images appeared "not to render" with nothing whatsoever wrong with the files. Now
`ThreadingTCPServer`. If mockup images mysteriously fail again, check this first.
