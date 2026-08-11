# UIO-001 — the header gets a line; the drop shadow moves to what actually floats

**Owner confirmed:** 2026-08-10
**Status:** READY

## What he asked for

> "The drop shadow looks ok, but i think the line will look better and then we can use the
> drop shadow on the sidebar nav and subheader (when there is one) because the drop shadow
> over the sidebar coming down from the header looks weird, like the nav and the content area
> are on the same surface but they functionally are not since they scroll separately."

**Keep the reasoning, not just the outcome.** A shadow cast from the header across the sidebar
asserts one continuous surface. The nav and the content scroll independently, so the shadow is
describing a structure that does not exist. Depth belongs on the things that genuinely float.

This settles the `app-header.css` conflict between `main` and `task/uireview`: **the branch's
answer wins for the header** (line, no shadow), and the shadow is not deleted — it relocates.

## What is wrong now

`main` lifts the header with a real `box-shadow` and deliberately holds a **transparent** 1px
border open so a rule can be added later without reflowing a fixed-height, `border-box` header.
That reserved 1px is the mechanism this order uses — it is not dead code, do not remove it.

## What it must become

1. **Header** — no `box-shadow`. The reserved 1px bottom border becomes a **visible** rule.
2. **Sidebar nav** — gains the drop shadow the header is giving up.
3. **Contract subheader**, when present — same shadow as the nav.

**The shadow value carries over from the header's current one** unless it reads wrong on a
vertical edge; if it does, say so and stop rather than inventing a second one.

## Files

- `src/components/app/app-header.css`
- `src/components/app/AppLayout.tsx` — the two rails
- `src/components/app/ContractSubheader.tsx`

## Do NOT

- Do not remove the reserved 1px border trick. It is why this change does not reflow the header.
- Do not touch `--cs-hdr-h` or any breakpoint.
- Do not restyle the nav panel fill, the row states, or the icons. UIO-002 and the merge of
  `task/uireview` cover those.

## Verification

Grep `dist/assets/*.css` for the header's `border-bottom` rule body and for the absence of a
header `box-shadow`. **Minified CSS keeps the space after the colon** — allow for it.
Confirm the nav and subheader shadows are present in the built CSS, not just in source.
