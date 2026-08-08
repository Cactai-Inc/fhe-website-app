# Shelved: the cardstock header

**Shelved 2026-08-08, not deleted.** Owner: *"the green header is cool and I love it but it's
got to go. We can save it for another time when we can colour-match the entire site to it."*

## What is here

| file | restore to |
|---|---|
| `CardstockHeader.tsx.txt` | `src/components/app/CardstockHeader.tsx` |
| `header-cardstock.css.txt` | `src/components/app/header-cardstock.css` |

The texture asset **`public/header-stock.jpg` was left in place** (493KB) — it is referenced
only by this CSS, and leaving it means a restore is two file copies with no asset hunt.

## To restore

1. Copy both files back, dropping the `.txt` suffix.
2. Confirm `header-cardstock.css` is imported (it was imported from `AppLayout.tsx`).
3. Check `--cs-hdr-h` still matches what the rails, contract subheader and drawer tab expect
   — they read it for their sticky offsets.

That is the whole restore. Nothing else was entangled with it.

## Why it was shelved, and what has to change before it returns

**The app was two backdrops.** A dark cardstock header above a near-white page meant the
translucent nav panel composited against both at once, and no single label colour is legible
across both. Measured:

```
green-800/20 over the cream page   -> #c8cac0   hue  73deg   (yellow-green)
green-800/20 over the dark header  -> #1a2d23   hue 147deg   (green)
```

**The page is warm (hue 37°), so mixing green into it rotates the hue 72° toward yellow.**
That is why the nav read as washed out — not paleness, a different colour. Over a dark
backdrop the hue barely moves, which is why glass works there and cannot work over cream.

**So this header does not come back on its own.** It returns when the site is colour-matched
to it — meaning the page surfaces move toward the header's darkness, or the header's family
becomes the app's, rather than one dark band sitting on a light app.

## What is genuinely good here and should not be lost

The wordmark, monogram and avatar are **debossed relief** — layered `text-shadow` carving the
letters into the stock texture, with the avatar pressing on hover and click. It was tuned
over several sessions (the "5c" shadow values, the press depth, the ~36px threshold below
which relief stops resolving on mobile).

**Relief needs a mid-tone surface to carve into.** It cannot be ported onto glass — on a
translucent surface over arbitrary content there is nothing to carve, so the values do not
transfer. If this returns, it returns whole.
