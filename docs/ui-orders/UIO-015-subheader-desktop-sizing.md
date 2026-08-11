# UIO-015 — the subheader buttons and text are too large on desktop

**Status:** READY
**Owner request, 2026-08-10:** *"buttons on subheader and text (desktop version) too large"*

## Scope: DESKTOP ONLY

Mobile sizing is deliberate — the buttons are full-width touch targets there. **Every change
below is behind `md:` and above.** If a change would alter the sub-`md` rendering, it is wrong.

## The change

`src/components/app/ContractSubheader.tsx:72-75`, the shared button class:

```
'…rounded-lg border font-medium '
+ 'focus-ring whitespace-nowrap w-full px-3 py-3 text-sm '
+ 'md:w-auto md:shrink md:min-w-0 md:py-2 '
```

Add to the `md:` segment: **`md:text-[13px] md:px-2.5 md:py-1.5`**

That takes the desktop control from 14px/12px/8px to 13px/10px/6px.

**This is a first pass, and the owner judges it by eye.** If he wants it smaller again, that
is a second order, not a reason for you to pick a different number now.

## Files
- `src/components/app/ContractSubheader.tsx` (the button class constant only)

## Do NOT
- Do not touch the mobile summary row (line 189-190) or its `text-[13px]`.
- Do not touch the `text-[12px]` party chip (line 272) or the `text-[11px]` count pill
  (line 249) — those are already small and were not flagged.
- Do not change `gap`, `ROW_CLS`, or the `lg:` clamp on line 265.
- Do not touch the drawer (line 288+).

## Verification
Grep the built CSS for the emitted `md:` rules. State plainly that you verified the rules
exist and that **you did not verify the render** — the owner confirms that by eye.
