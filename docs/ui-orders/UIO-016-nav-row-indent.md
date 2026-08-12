# UIO-016 — nav icons and text sit too far left in the panel

> **⚠️ SHIPPED, THEN SUPERSEDED IN PART on 2026-08-11 — see the note at the foot of this file
> before following any instruction in it.** The owner asked again for the same outcome by an
> asymmetric route; NAVMOTION §H overrides two of the "Do NOT" rules here.

**Status:** SHIPPED — superseded in part
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

---

## SUPERSEDED IN PART — 2026-08-11

**§H of `docs/tasks/TASK-NAVMOTION-the-nav-moves-with-intent.md` overrides two of the "Do NOT"
rules above.** The owner returned to this same complaint on 2026-08-11 and asked for the
**asymmetric** version of the fix — more padding on the LEFT of the row only, so contents move
right — on the desktop rail **and** the mobile drawer.

- ~~"Do not change any individual row's `px-3`"~~ — the row's LEFT padding is now what changes.
- ~~"Do not touch the mobile drawer"~~ — the drawer gets the same inset; reach on a left-hand
  drawer is half the reason.

**Still standing:** do not change `w-60`, and do not touch the collapsed/icon-only state's
`justify-center` behaviour — asymmetric padding would knock those icons off the shared centre
line, so the collapsed `w-14` rail keeps symmetric padding. See NAVMOTION §H4.

**What this order got right and is worth keeping:** the symmetric container fix was the correct
*first* move, and the reason it gave — that changing eight row classes risks them drifting out
of step — is exactly why §H requires the new inset to live in **one shared constant** rather
than being pasted into each row.
