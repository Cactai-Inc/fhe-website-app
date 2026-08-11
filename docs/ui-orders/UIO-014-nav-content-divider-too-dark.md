# UIO-014 — the divider between the desktop nav and the content is too dark

**Status:** READY
**Owner request, 2026-08-10:** *"divider between desktop nav and subheader is too dark"*

## The change

`src/components/app/AppLayout.tsx:827` — the desktop rail carries
`border-r border-green-950/20`. That is the line the owner is describing: the nav's right
edge, running the full height against the subheader and page body.

**FROM** `border-green-950/20`
**TO**   `border-green-900/12`

**This value is not invented.** `green-900/12` is already this file's declared divider weight
— `NAV_DIVIDER` at line 95 — so the rail edge stops being heavier than every other divider in
the same panel.

## Files
- `src/components/app/AppLayout.tsx` (line 827 only)

## Do NOT
- Do not touch `NAV_DIVIDER` itself, or any divider inside the nav.
- Do not touch the subheader's own `border-b border-green-800/15`
  (`ContractSubheader.tsx:171`) — that is a different line and was not what he flagged.
- Do not touch `oh-rail-shadow`.

## Verification
`npm run build`, then grep the built CSS for the emitted rule. **Remember minified CSS keeps
the space after the colon and rewrites `rgba()` to 8-digit hex** — grepping the source string
will look like a failed deploy when it shipped fine.
