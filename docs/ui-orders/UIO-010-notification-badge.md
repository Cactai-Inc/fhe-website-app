# UIO-010 — the badge number

**Status: CLOSED 2026-08-10 — NO CHANGE. Do not implement.**

> Owner, after seeing the numbers: *"the gold is already dark enough. i wouldnt change that. so
> maybe we leave the number as dark green if the white isnt acceptable."*

**The badge stays exactly as it is: `green-950` on `gold-500`, 7.86:1.**

**It is not the best option — it is the legally acceptable one.** Owner's correction, and the
distinction matters: contrast maths **rules options out**; it does not make what survives good.
The proposed cream number was 2.23:1, and the only rescues cost either the gold's brightness or
the badge's identity. Nothing here made the badge better.

**SO THE AESTHETIC COMPLAINT IS STILL OPEN.** The owner noticed something about how the badge
sits on the nav. What was settled is that **changing the number cannot fix it** — the number is
the one element with no headroom. Anything that does fix it changes something else: the badge's
size, its shape, its position, or the gold itself.

**If the palette is revisited — see `UIO-011` — the badge comes with it.** That is the pass
where this has room to move, because the gold would be in scope rather than fixed.

Everything below is the working that ruled out the number.

---

**(historical) Owner asked for:** 2026-08-10 · was BLOCKED — as specified it fails contrast.

> "the notification bubbles on the nav are gold with a green number, lets make the number the
> color of the nav surface."

## The problem, measured

**The desktop nav surface is NEAR-WHITE — `#fdfcfa`.** Its token is named `cream-25`, which
misleads: the page is cream (`#faf8f4`) and the header is a warmer cream (`#f5f0e8`), so
"the nav's cream" points at the wrong swatch. The badge is `gold-500 #caa83e`.

```
cream-25 on gold-500 :  2.23:1     <- badge digits need 4.5:1
```

**It would be barely readable.** The current `green-950` number gives **7.86:1**.

## What works — three shapes, owner picks

**1. Darken the gold, keep the cream number.** The look he asked for, made legible:

```
cream-25 on gold-700 : 4.01   still fails
cream-25 on gold-800 : 5.58   PASS
cream-25 on gold-900 : 8.37   PASS
```

`gold-800 #7a6421` is the lightest gold that carries a cream number. **Cost:** the badge stops
being bright gold and becomes a deep bronze — a visible change to the nav's accent.

**2. Invert it.** Badge becomes the near-white nav surface, number becomes gold. `gold-800` on `cream-25`
is the same 5.58:1. Keeps the gold visible as the *number*, and the badge stops competing with
the selected-row fill for attention.

**3. Leave it.** `green-950` on `gold-500` at 7.86:1 is the most legible option on the table.

**ASK. DO NOT PICK.** Build a rendered comparison of all three at real badge size — small
reversed digits are exactly where a contrast table misleads and the eye does not.

## Files

- `src/components/app/AppLayout.tsx` (`NAV_BADGE`)
- `tailwind.config.js` only if a new gold is needed — it is not; the scale already has 700/800/900.

## Verification

State the rendered contrast of whichever is chosen. **Badge digits are small text: 4.5:1 is the
floor, not 3.0.**
