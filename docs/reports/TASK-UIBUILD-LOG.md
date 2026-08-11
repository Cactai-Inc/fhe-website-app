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

---

## UIO-002 — the avatar becomes a ring, and on mobile a solid button

**Commit:** `9614a41`

Implemented against the REWRITTEN (opaque) version at the top of the order —
confirmed the banner and ignored the earlier translucent/`#02d67c` approach
it supersedes. Also deliberately ignored `origin/task/uireview`'s own avatar
CSS (a completely different, older mechanism: opacity-based idle/engaged
states, no white-veil-over-opaque-fill technique) — UIO-001's "the branch's
answer wins" only settles the header edge, not the avatar; UIO-002 is
self-contained and more recent, so its spec is what shipped.

**Mechanism choice (order required picking one and saying which):** white
overlay as a `linear-gradient(rgba(255,255,255,X), rgba(255,255,255,X))`
layer over `theme('colors.green.800')`, not a pseudo-element. Reasoning: the
letter is this element's own text content and always paints above its own
`background` regardless of how many layers that background has, so there's
no stacking-order risk to manage, unlike a `::before` overlay which would
need explicit z-index work to avoid covering the glyph.

**What I verified:**
- `npm run typecheck` — 0 errors.
- `npm run lint` — 0 errors, 30 warnings (baseline, unchanged from UIO-001).
- `npm run build` — succeeded, prerender included.
- Grepped `dist/assets/index-BIOMXEDV.css` for every rule body named in the
  order's verification section:
  - `.oh-avatar` shared rule: `border:1px solid rgba(20,51,33,.4)`,
    `font-size:20px` — ring and new size present.
  - `span.oh-avatar` (desktop): `background:transparent;color:#0d2118` —
    unchanged, no fill.
  - `button.oh-avatar` (mobile rest): `background:linear-gradient(#ffffff24,#ffffff24),#143321`
    — `#ffffff24` is white at alpha `0x24/255 = 14.1%`, matching the spec's
    14%; base colour `#143321` confirms `theme('colors.green.800')` resolved
    correctly.
  - `button.oh-avatar:active,button.oh-avatar[aria-expanded=true]`:
    `background:linear-gradient(#fff0,#fff0),#143321` — `#fff0` is the
    4-digit hex shorthand for white at 0% alpha, so the pressed state
    composites to pure `#143321` with nothing added.
  - `button.oh-avatar:focus-visible`: outline present, unchanged.
  - No `:hover` rule exists anywhere on `.oh-avatar` in the built CSS —
    confirmed absent, matching "`:active` only, not `:hover`."
  - Grepped `.oh-mono` separately to confirm it is untouched: still
    `font-size:17px`, same border/colour as before.
- **Contrast — computed independently (WCAG relative-luminance formula),
  not copied from the order's table**, per "state the rendered contrast...
  because nothing is composited":
  - Mobile `:active`, `#fdfcfa` on `#143321`: **13.43:1** — exact match to
    the order's table.
  - Mobile rest, `#fdfcfa` on `#355040`: **8.63:1** by my calculation vs the
    order's stated 8.68 — within hand-rounding tolerance, consistent.
  - **Desktop, `#0d2118` on the header `#f5f0e8`: I compute 14.83:1, not the
    13.4 the order's table states.** Checked my method against the state
    doc's own separate "13.4:1" figure (`text-green-800` on the nav panel
    `cream-25 #fdfcfa`) and reproduced it exactly (13.43), which is why I
    trust the method — but that figure is for a different letter colour
    (green-800, not green-900) on a different background (cream-25 nav
    panel, not the header). My best read is the order's "13.4 vs the cream
    header" line reused that unrelated figure rather than being computed
    fresh for this pair. **Not a safety regression** — the actual contrast
    is higher than claimed, comfortably AAA either way — but the stated
    number in UIO-002 doesn't match what the shipped colours produce, and I
    did not edit the order to correct it (read-only to me). Flagging for
    UIREVIEW to confirm or correct.

**What I did NOT verify — needs a browser check:**
- The ring, the letter size, and both mobile fill states have not been
  looked at by eye. In particular: the white-overlay-over-opaque-fill
  technique and the size jump to 20px are both new visual outcomes, not just
  copied values — worth a specific look, not just a glance.
- Whether the `:active` transition reads as smooth. `transition: background`
  is animating a `linear-gradient`'s alpha; modern Chrome/Firefox/Safari
  interpolate two structurally-identical gradients, but this is inference
  from the CSS, not something I've seen render.

---

## UIO-003 — the nav hover flicker: icon transition, one double-paint, named durations

**Commit:** `49f42aa`

Synced `task/uibuild` to `origin/main` first (fast-forward, clean — all 4 of
my prior commits were already merged upstream, so nothing was lost) to pick
up this and the following orders.

**Scope note:** the order names two examples beyond `NAV_ICON_IDLE` itself
("Add New" Plus, the group-heading buttons) and instructs a sweep of "every
element that changes colour on hover." I scoped that sweep to the nav-rail
family the owner was actually looking at (`RailLink`/`PresenceLink`/
`AccountNavLink`/`CommunityNav`/`NavFooter`/the group headings/the Add New
row) — not `MenuLink` or the account-menu-shaped block around line 1054-1120,
which read as a different, unrelated surface not named by the order and not
part of "both navs." Flagging in case that scope guess was too narrow.

**What I verified:**
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 30 warnings
  (baseline). `npm run build` — succeeded.
- Grepped the built CSS by *property*, not by the value I authored (T2b):
  `.duration-320{transition-duration:.32s}` and
  `.ease-glide{transition-timing-function:cubic-bezier(.32,.72,0,1)}` both
  emitted as real, separate utility rules — not folded into `transition-colors`
  and not silently dropped.
- Confirmed cascade order by byte offset in the built CSS:
  `.transition-colors` (which bundles its own 150ms/default-ease) appears at
  byte 71503; `.duration-320` at 72180 and `.ease-glide` at 72384 — both
  after it, so they win the same-specificity override rather than losing to
  the bundled default depending on source order.
- Grepped the built JS for `duration-320`/`ease-glide`: 8 occurrences each,
  matching the 8 edited call sites exactly (`NAV_ROW_IDLE`, `NAV_ICON_IDLE`,
  the CommunityNav parent pill, its Link, its toggle button, both chevron
  icons, the group-heading button).
- Grepped the source for `bg-navfill/64` in the CommunityNav parent+toggle
  block: appears exactly once now (the parent), confirming the double-paint
  class was removed from the child and not accidentally duplicated.
- The toggle's chevron icon has no colour class of its own — it inherits
  `color` from the button. I added `transition-colors duration-320 ease-glide`
  to the icon directly anyway rather than relying on inherited-value
  reasoning (a continuously-transitioning ancestor's inherited value should
  animate smoothly on a child with no transition of its own, by my
  understanding of the CSS inheritance model) — the order's own bar is
  "confirm each element carries its own transition," so I made it explicit
  rather than resting on inference I haven't seen render.

**What I did NOT verify — needs a browser check:**
- The actual flicker fix. Nothing here proves the icon no longer vanishes on
  hover, that the double-paint row now matches its neighbours' fill strength,
  or that 320ms/glide reads as "easing" rather than "still too fast" — that's
  the owner's read to make, on the frame evidence or in person.
- The scope guess above (nav-rail family only, not the account-menu-shaped
  block at ~1054-1120) is unverified against what the owner was actually
  looking at when he recorded the flicker.

---

## UIO-004 — contain every scroll container instead of harnessing the body

**Commit:** `58f835d`

Cherry-picked `ee9a261` with `git cherry-pick -n`. Both files that touch
regions I'd already edited (`AppLayout.tsx`, `CreateModal.tsx`) auto-merged
with no conflicts — inspected the resulting diff on `AppLayout.tsx` by hand
anyway rather than trusting a clean auto-merge blindly; it's a single-line
`overscroll-contain` addition to the account-menu dropdown, untouched by
UIO-001/002/003.

**File-count discrepancy:** the order says "35 sites across 21 files"; the
actual commit's diffstat is 27 files, 35 single-line insertions. Went with
the diffstat.

**What I verified:**
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 30 warnings
  (baseline). `npm run build` — succeeded.
- Diffed `src/index.css` against the pre-cherry-pick tree: empty. Nothing
  landed on `html`/`body`, matching the order's whole premise.
- Grepped the built CSS for the property: `.overscroll-contain{overscroll-behavior:contain}`
  present as a real rule.
- Grepped the built JS for `overscroll-contain`: 37 occurrences, not 35.
  Traced the gap before reporting it as a discrepancy rather than assuming
  either number was right: `git grep`'d the two extra sites
  (`ContractDrawer.tsx:224`, `ContractSubheader.tsx:275`) and confirmed
  they predate this cherry-pick — exactly what the original commit message
  says ("the rails and drawer already done earlier"). 35 new + 2 pre-existing
  = 37. Not a duplication bug.

**What I did NOT verify — the order says this explicitly needs a phone:**
- Overscroll chaining itself. This is a runtime scroll-physics behavior that
  does not appear in a static render or a CSS grep — I have not tested it on
  a device, iOS or otherwise. Confirming this is unverified, not "probably
  fine."
