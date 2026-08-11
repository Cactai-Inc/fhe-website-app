# TASK-UIBUILD — build log

One entry per order, appended as it ships. Worktree `wt-uibuild`, branch
`task/uibuild`, off `origin/main`.

---

## UIO-001 — the header gets a line; the drop shadow moves to what actually floats

**Commit:** `538c396`

**Clarification asked before implementing:** the order's shadow value
(`0 2px 4px rgba(16,28,22,.08), 0 6px 18px rgba(16,28,22,.10)`) is Y-axis,
authored for a horizontal edge with content below it. The two nav rails are
vertical panels (`border-r`, full viewport height, content beside them, not
below). Applied unchanged it would only be visible as a thin band at the very
bottom of the browser window, not along the seam where nav meets content —
the order itself calls this out as a stop-and-ask condition rather than
something to solve alone. Asked; got back: rotate to the X axis, same
magnitudes (`2px 0 4px rgba(16,28,22,.08), 6px 0 18px rgba(16,28,22,.10)`),
put it on the `<nav>` (not the `<aside>`, since the two are deliberately
decoupled for the staff rail's collapse animation — see AppLayout.tsx:828),
subheader stays Y-axis since it's horizontal like the header.

**Header border value:** not invented. `main`'s header had a transparent
1px reserved border; `origin/task/uireview` had already resolved this exact
edge to `border-bottom: 1px solid rgba(20, 51, 33, .15)` (matching the
rail's/subheader's own `border-green-800/15`). The order says "the branch's
answer wins for the header" — adopted that value verbatim rather than
choosing a border weight myself.

**What I verified:**
- `npm run typecheck` — 0 errors.
- `npm run lint` — 0 errors, 30 warnings (confirmed this is the pre-existing
  baseline on this branch, not 26 as the state doc says — stashed my changes
  and reran lint against unmodified `task/uibuild` HEAD, got 30 there too).
- `npm run build` — full build including prerender succeeded (needed a
  `.env` with the placeholder `VITE_SUPABASE_*` values copied in from the
  canonical checkout; the worktree had none and prerender hard-fails without
  them — not a code issue).
- Grepped `dist/assets/index-i5No2Jhv.css`: `.oh-hdr` rule body contains
  `border-bottom:1px solid rgba(20,51,33,.15)` and no `box-shadow` in any of
  its six declarations (base + 5 media-query variants). `.oh-rail-shadow`
  and `.oh-subheader-shadow` are both present with the expected rule bodies
  (minifier re-serialized the rgba() calls as `#rrggbbaa` hex — same values:
  `#101c1614` = rgba(16,28,22,.08), `#101c161a` = rgba(16,28,22,.10)).
- Grepped the built JS bundle for the two new class name strings:
  `oh-rail-shadow` appears twice (client rail + staff rail), `oh-subheader-shadow`
  once — confirms both `<nav>` elements and the subheader bar actually carry
  the class in the shipped output, not just in source.

**What I did NOT verify — needs a browser check:**
- **Whether the rail shadow is actually visible, or clipped.** Both
  `<nav>` elements carry `overflow-x-hidden` (for the collapsing staff rail
  and the scrolling client rail) on the *same element* the new box-shadow is
  on. My own understanding is that `overflow-x: hidden` commonly clips a
  box-shadow on that same element in Chrome/Firefox — this is a well-known
  CSS gotcha (card + rounded-corner overflow:hidden losing its own shadow),
  and my new shadow projects exactly on the X axis that `overflow-x-hidden`
  clips. This conflicts with what I was told when I asked ("a box-shadow is
  not clipped by the element's own overflow" — which was reasoning about the
  `<aside>` parent, which indeed has no overflow set, not about the `<nav>`
  itself, which does). I did not restructure the DOM to work around this
  (e.g., moving `overflow-x-hidden` to an inner wrapper) since that widens
  scope beyond what the order authorized. **This needs an actual browser
  look before it's called done** — if the shadow is invisible, the fix is
  structural (split the nav into an outer shadow-carrying element and an
  inner scroll-clipped one) and should go back through UIREVIEW as its own
  order rather than something I invent here.
- The header's line, the rail shadow (if visible), and the subheader shadow
  have not been looked at by eye in any browser or device size. Nothing here
  proves a render.
