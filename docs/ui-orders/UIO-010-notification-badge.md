# UIO-010 — the badge number

**Owner asked for:** 2026-08-10 · **Status:** BLOCKED — as specified it fails contrast.

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
