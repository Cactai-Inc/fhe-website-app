# UIO-016 — nav icons and text sit too far left in the panel

**Status:** READY
**Owner request, 2026-08-10:** *"nav icons and text too far left relative to nav panel size
(desktop version)"*

## The measurement

The rail is `w-60` (240px). The `<nav>` carries `p-2` (8px) and each row carries `px-3`
(12px), so a nav icon starts **20px** from the panel's left edge inside a 240px panel.

## The change

`src/components/app/AppLayout.tsx:827` — the `<nav>` element: **`p-2` → `p-3`**

Icon start moves 20px → 24px. Changing the container rather than the rows shifts both sides
equally, so the hover fill stays symmetrically inset and **no row class has to change** —
there are eight of them (lines 461, 492, 517, 537, 592, 628, 788, 795) and they must all keep
matching each other.

## A comment in this file already claims the value you are setting

Line 594 says *"nav's p-3 plus this link's px-3…"* — the code says `p-2`. The comment was
written against a value that is not there. **Trust the code.** Once you make this change the
comment becomes true; leave it, and note in your log that it was wrong before and is right
after.

## Files
- `src/components/app/AppLayout.tsx` (line 827 only)

## Do NOT
- Do not change any individual row's `px-3`.
- Do not change `w-60`.
- Do not touch the collapsed/icon-only state's `justify-center` behaviour.
- Do not touch the mobile drawer.

## Verification
Build, grep the emitted padding rule. **Check the collapsed nav state too** — `p-3` applies in
both states and the icon-only rail is narrower, so confirm nothing clips or wraps.
