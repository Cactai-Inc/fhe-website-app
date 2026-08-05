# TASK UIPOLISH — nav order/glass, header wordmark + logo, community feed copy (owner spec 2026-08-05)

All items are owner-authored. USER-account-facing unless stated. Surfaces: `AppLayout.tsx`,
the welcome/first-visit modal (find it — likely the "app tour" component), the community feed
page, header assets. `ClauseDocument.tsx` FROZEN (not implicated). Pure UI — NO .env.db, NO DB
access.

## 1. Nav order — one canonical order everywhere
Order: **Community Feed, Dashboard, Calendar, Lessons*, Orders, Catalog, Documents, Messages,
My Posts, My Stable, Account.**
(*Lessons: pending owner confirm — build it into the order but behind the same
presence/module gating it has today; if the owner says drop it, removal is one array entry.)
- Applies to: mobile drawer, desktop USER rail, and the welcome/first-visit modal's item
  listing — all three must present the same order. Presence-gated items (Orders, Documents,
  My Posts, My Stable per `my_nav_presence()`) keep their gating; order holds among whatever
  is visible.
- Avatar menu: DO NOT REORDER — owner approved its current shape (Account first, containing
  sign out + app tour).

## 2. Green glass nav surface
Mobile drawer + desktop USER rail get a subtle green-glass treatment:
- Translucent green tint over the light base (start ~`bg-green-800/[0.07]` territory over the
  existing cream, tune by eye) + `backdrop-blur` so content scrolling behind reads as glass.
- HARD CONSTRAINT: nav text/icons keep their current colors and must stay clearly legible —
  if the tint forces any text-color change to survive, the tint is too strong; back it off.
- Solid-color fallback where `backdrop-filter` is unsupported (`@supports` or tailwind's
  `supports-` variant).
- Implement as one shared class/constant so reverting to the current solid look is one line.
  Note both class strings in the report.

## 3. Mobile menu open button
Replace the current header trigger: icon-only, square, no text, no outline. Icon:
`PanelLeftOpen` (the panel icon with the right-facing arrow) from lucide. Keep an
`aria-label="Open menu"`. Size it as a comfortable square tap target consistent with the
header's other icon buttons.

## 4. Header wordmark — "French Heritage", centered, debossed
- Text "French Heritage" centered in the header (both account types unless layout collides
  with staff header contents — if it collides for staff, USER header only; say which).
- Debossed/letterpress: same color family as the header surface, stamped-in look via
  shadow technique (dark inner top shadow + light lower edge, or equivalent) — it should read
  as pressed into the surface, not printed on it.
- Font: a BOLD weight of the brand's display serif. Find the brand font: check the public
  site's font loading (index.html, tailwind.config.js fontFamily, any @font-face in CSS, what
  the marketing pages use for the big serif wordmark). If the true brand font is NOT present
  in the codebase assets, STOP and ask the owner to name/provide it — do not substitute a
  lookalike. The current thin desktop font is explicitly rejected.
- The debossed effect needs the bold weight to read; verify visually plausible values (this
  is one of the browser-pending items — implement the standard letterpress technique and note
  it needs owner eyes).

## 5. Header logo — replace the F square
The green F square is not the brand logo. Replace it with the favicon artwork (find the
favicon asset(s) in public/ or index.html links; use the highest-resolution variant, rendered
crisp at header size, correct rounding). Keep it linking where the current logo links.

## 6. Community feed page copy + spacing
- The page shows the name twice — remove the SMALLER instance, keep the larger.
- Increase the padding above the (remaining) name by 35% of its current value.
- Replace the tagline "everything from the barn and community, newest first" with EXACTLY:
  "A place to welcome new members, share your experiences or views from around the stables,
  and helpful links, tack, or gear you no longer use that others may need".

## Rules
- Branch `task/uipolish` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-uipolish -b task/uipolish origin/main`).
  Copy this doc from the shared checkout (untracked there). No DB access.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors).
- Update `docs/BUILD_TRACKER.md`: add these under section I as I6-I10 with honest
  code-complete/browser-pending statuses.
- Report: `docs/reports/TASK-UIPOLISH-REPORT.md`, committed + pushed. Print ONLY the report
  path. If the brand font is missing (item 4), the STOP-and-ask happens in chat before the
  report.
