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

---

## UIO-007 — closing the drawer over a contract no longer reloads and loses your place

**Commit:** `3a807a5`

Note: the order names `AppLayout.tsx:1392` for the drawer and `:965-979` for
the body-lock effect — both had shifted (to ~1415 and ~977-1000) from my own
prior edits earlier in the file. Relocated by content (`w-72 max-w-[85vw]`
for the drawer, `body.style.position = 'fixed'` for the lock), not by
trusting the line numbers.

**What I verified:**
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 30 warnings
  (baseline). `npm run build` — succeeded.
- Grepped source: `position = 'fixed'` — 0 occurrences left in the file.
  `window.scrollTo`/`scrollY` — the only remaining hit is inside my own
  explanatory comment (prose describing why the deleted code was wrong), not
  code.
- Grepped the built JS around the `app-nav-drawer` id (two occurrences exist
  — the header's `aria-controls` reference and the drawer's own render;
  checked both rather than assuming the first hit was the right one): the
  drawer's actual `className` string ships with
  `overflow-y-auto overscroll-contain`.
- Confirmed via UIO-004's own verification that `.overscroll-contain{overscroll-behavior:contain}`
  is a real emitted rule (not re-checked here, same build).

**What I did NOT verify — the order is explicit that this needs a phone:**
- The owner's exact repro (contract at a late section, open the avatar menu,
  close via the avatar and via the content area) — not run in any browser.
- **The iOS-specific caveat, which is the entire reason the old lock
  existed:** whether `overscroll-behavior` actually contains the drawer's
  scroll chaining on iOS Safari specifically, as opposed to just not
  crashing. The order says to STOP and report rather than reinstate the lock
  if this fails on a real device — I have not been able to test a real
  device at all, so this is unconfirmed in either direction, not passing.

---

## UIO-006 — the avatar reads as a button, and its letter grows on mobile

**Commit:** `34c3301`

Three defects named; two shipped, one deliberately did not (see below).

**Hover value (gap 2):** the order says "sitting between rest and pressed in
intensity" without a number, unlike gap 1 (open state) which explicitly says
to bring a comparison instead of picking. Read that contrast in the order's
own structure as intentional — gap 1 flags the "don't pick, show" caveat and
gap 2 doesn't — so treated 7% (the exact arithmetic midpoint of the already-
established 14%/0% ramp) as a principled interpolation of a fully-specified
mechanism, not a new invented value, and shipped it. Flagging the reasoning
explicitly in case that read was wrong — it's one number to change if so.

**What I verified:**
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 30 warnings
  (baseline). `npm run build` — succeeded.
- Grepped the built CSS: `button.oh-avatar:hover{background:linear-gradient(#ffffff12,#ffffff12),#143321}`
  — `#ffffff12` is white at `0x12/255 = 7.06%`, matching the intended 7%.
  Confirmed by byte offset that `:hover` (2059) precedes `:active` (2139) in
  the compiled stylesheet, so a simultaneous hover+press still resolves to
  the darker `:active` value, not the hover one.
- Grepped `.oh-mono{...}` at both breakpoints: `font-size:16px` and
  `font-size:15px`, byte-identical to before the change. Grepped
  `.oh-avatar{...}`: `font-size:19px` and `font-size:18px` at the same two
  breakpoints — matches the order's table exactly. The landscape block
  (`width:34px;height:34px;font-size:14px`) is still one combined rule,
  confirming I left it untouched as instructed.
- Computed contrast independently for all three fills rather than trusting
  my own arithmetic once: rest 8.63–8.68 (established), hover **10.92:1**,
  active 13.43 (established) — monotonic, sits where a midpoint should.

**Gap 1 (open state identical to pressed) — explicitly NOT shipped**, per
the order's own instruction to bring a rendered comparison rather than pick.
Built `docs/reference/uio-006-open-state-options.html` — three options
(reuse the hover fill; keep the fill and add a second gold ring instead;
shift to a gold-tinted veil rather than white) rendered against the real
header background, each showing the full rest → press-flash → settle
sequence so the click still reads regardless of which is chosen.
`app-header.css` still pairs `:active` and `[aria-expanded='true']`
unchanged — this is a real gap in the shipped avatar, not resolved by this
commit, until the owner picks from that page.

**What I did NOT verify — needs a browser check:**
- All three rendered fills, the hover state, and the new mobile letter sizes
  — not seen in an actual browser at any breakpoint.
- Whether 7% actually reads as "between" to the eye the way it does on paper
  — contrast math and perceived intensity aren't the same thing, and this
  codebase has been burned by that gap before (T6/C1).

---

## UIO-008 — the contract actions block points the wrong way and hides at the edge

**Commit:** `5b79b64`

Found it by content, not by trusting "whichever component renders the
contract actions block": the label/gap/right-arrow shape the owner described
matched `ContractSubheader.tsx`'s mobile toggle exactly (`justify-between`
with the label on the far left and a lone `ChevronDown` pinned to the far
right of a full-width row). Not `ClauseDocument.tsx` — no frozen-file
stop-and-propose needed.

**What I verified:**
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 30 warnings
  (baseline). `npm run build` — succeeded.
- This component is a lazy chunk (T2's warning applies literally) — grepping
  the main entry bundle would have found nothing whether it shipped or not.
  Found the right chunk first (`grep -rl "Contract actions" dist/assets/*.js`
  → `index-Bz1AJatT.js`), then inspected the compiled output directly:
  `className:"md:hidden w-full flex items-center gap-1.5 py-1 text-left"` —
  `justify-between` gone, `gap-1.5` present — and
  `d?r.jsx(lc,{...}):r.jsx(Ws,{...})`, a genuine two-component conditional
  with no `-rotate-90`/`transition-transform` left anywhere in that region.
- Did not assume `lc`/`Ws` were what I expected from their position in the
  ternary — grepped their actual `const lc=ae("ChevronUp",[["path",{d:"m18
  15-6-6-6 6"...` and `const Ws=ae("ChevronDown",[["path",{d:"m6 9 6 6
  6-6"...` definitions. Confirmed: `lc` (rendered when `barOpen` is true) is
  ChevronUp, `Ws` (false) is ChevronDown — down closed, up open, as ordered.

**What I did NOT verify:**
- The spacing itself. The order says this is an eye judgement for the owner
  to confirm — `gap-1.5` is stated and reasoned (matches this bar's own
  SUBHEADER_BTN icon-to-label gap) but not rendered and looked at.

---

## UIO-009 — the header keeps its line and gets its shadow back

**Commit:** `62c71f5`

**Re-read the order from scratch before building**, per the mid-session
warning that it had been rewritten twice and an earlier version told UIBUILD
to raise the rail's z-index — explicitly superseded inside the order's own
final text ("Do not raise the rail's z-index"). What I actually built: only
`box-shadow` added back to `.oh-hdr`; nothing touched `z-index` anywhere.

**Subheader "gains a bottom line" — did not add anything, and want that
flagged rather than silently no-op'd.** The order's table says the subheader
line is a change ("ADD bottom line, same value") the same way the rail
shadow was in UIO-001. I checked the actual current file:
`ContractSubheader.tsx:171` already reads
`bg-cream-25 border-b border-green-800/15 ...` — `border-green-800/15` IS
`rgba(20,51,33,.15)`, the exact value the order asks for. This line
predates my UIO-001 work (it was already there in the very first read of
this file at the start of the session, before any UIBUILD commit touched
it) — it isn't something UIO-001 added that the order's author missed. I'm
reporting this as "already satisfied, nothing to add" rather than "done,"
since the order's own premise (that this line doesn't currently exist)
doesn't match what's in the file, and I'd rather flag the mismatch than
either duplicate a declaration that's already correct or silently do
nothing without saying so.

**What I verified:**
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 30 warnings
  (baseline). `npm run build` — succeeded.
- Checked every `z-30`/`z-40`/`z-50` site across `AppLayout.tsx` and
  `ContractSubheader.tsx` rather than assuming the model held: header
  (`.oh-hdr` and superadmin's own header) both `z-40`; both rails and the
  contract subheader all `z-30`. Matches the owner's peer model exactly —
  already correct, confirmed rather than trusted.
- Grepped the built CSS: `.oh-hdr{...border-bottom:1px solid
  rgba(20,51,33,.15);box-shadow:0 2px 4px #101c1614,0 6px 18px
  #101c161a}` — both the line and the shadow present on the same rule, same
  shadow value UIO-001 removed (converted to 8-digit hex by the minifier,
  same as before: `#101c1614` = `rgba(16,28,22,.08)`).
- Grepped the subheader's compiled output in its lazy chunk: `border-b
  border-green-800/15` still present, unchanged by this commit — confirming
  I didn't touch it, consistent with the "already satisfied" finding above.

**What I did NOT verify:**
- Whether the header shadow visually reads correctly now stacked with the
  rail/subheader shadows beneath it, or whether the subheader's line (found
  already-present rather than added) is in fact what the owner meant, versus
  some other line I haven't identified. Not seen in a browser.

---

## UIO-012 — the community pages get a group, and the heading hover is invisible

**Commit:** `67792c6`

**Item 2 (merge Dashboard/Inbound) is BLOCKED per the order and not
implemented** — asked the orchestrator directly rather than picking; see the
conversation. Nothing in this commit touches Dashboard, Inbound, or their
routes.

**Item 1 correctness issue found and fixed, not just implemented as
described:** the order doesn't mention it, but wiring the new group through
the existing `toggleGroup` uncovered a real bug — its fallback (`"what was
this group's state before any click"`) only searched `navGroups`, and the
new pseudo-group isn't a member of that array. Left as-is, the group's first
toggle would always resolve to open, including when it was already open and
the click meant to close it. Widened the fallback's search array to
`[...navGroups, APP_PAGES_GROUP]` rather than working around it with a
separate, bespoke handler — keeps this genuinely "the same toggle," which is
what the order asked for.

**What I verified:**
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 30 warnings
  (baseline). `npm run build` — succeeded.
- Grepped the built CSS: `.text-green-900\/70{color:#0d2118b3}` (0xb3/255 =
  70.2%, matches) and `.hover\:text-green-900:hover{...color:rgb(13 33 24 /
  var(--tw-text-opacity, 1))}` (opacity var defaults to 1 — full strength,
  no alpha reduction).
- Computed the rest-state contrast independently rather than trusting "it's
  above the floor": green-900 at 70% over `#fdfcfa` renders `#55635c`,
  **6.16:1** — clears 4.5 with real margin, well short of the row labels'
  own weight, matching the order's "still visibly quieter" intent.
- Found the App pages group's compiled output in its chunk
  (`index-ciAhD9Pd.js`) and read it directly rather than trusting the
  source diff alone: `Ae={key:"app-pages",label:"App pages",items:[],
  defaultOpen:!0}`, and the toggle function's fallback spread confirmed as
  `[...Ee,Ae].find(...)` (`Ee` = `navGroups`) — the fix landed in the
  actual bundle, not just in source. Located the button's JSX immediately
  before the existing `navGroups.map()` block in the same chunk and
  confirmed it's structurally identical: same `className` template, same
  `hs` (ChevronDown) component, same `ne(...)` (`groupOpen`) rotate logic —
  not just visually similar source, the same pattern compiled.
- Confirmed the separator branch (`!staffRailPinned`) and the content-gate
  branch (`groupOpen(Ae) || !staffRailPinned`) both present and wired to the
  same pseudo-group object.

**What I did NOT verify — needs a browser check:**
- Whether it actually collapses/expands correctly by clicking, whether the
  chevron rotates, and whether the heading is now legible on hover. All
  inferred from reading compiled output, not from clicking anything.
- Persistence: this group behaves exactly like Management/People, which I
  traced to mean **none of them persist across a page reload** — `openGroups`
  is plain `useState({})` with no `localStorage` read/write anywhere I could
  find, unlike `staffRailPinned` and `communityNav.expanded`, which do. The
  order's own verification section hedges the same way ("survives a reload
  if the others do") — flagging in case that's news, since "same persistence"
  might have been assumed to mean "persists," not "doesn't, consistently."

---

## UIO-005 — Save becomes the outlined form of Send; the favicon adopts the header mark

**Commit:** `521d08d`

Cherry-picked `b052637` per the order. It touches three files, not the two
the order's own "Files" section lists (`tailwind.config.js` is the third) —
included it anyway since it's a hard dependency of the cherry-pick the order
named by SHA: the 66% opacity step doesn't exist in Tailwind's default scale
(same T1 trap as `opacity: 64`), so the Save button's hover would emit
nothing without it.

**Real conflict, not auto-merged:** `tailwind.config.js` collided textually
— this branch's UIO-003 commit had already added a `transitionTimingFunction`/
`transitionDuration` block (`glide`, `320`, `440`), and `b052637` adds a
near-identical block under its own "MOTION" heading, sourced from the same
`task/uireview` origin. Not a real disagreement — merged both additions
(opacity now `{64, 66}`, motion tokens declared once) rather than picking a
side or duplicating the block.

**Favicon: applied the order's own later text, not `b052637`'s.** The order
says its favicon supersedes `b052637`'s (different fill, stroke, tracking,
font-size — checked the diff to confirm, not assumed from the order's
prose). Applied verbatim, byte-for-byte, no comment added since "apply this
verbatim, no design decisions left" reads as covering the file's exact
contents, not just its visual result.

**Did the order's own required 16px check rather than skipping it as already
decided.** Rendered the verbatim (light) SVG and an inverted (dark-tile,
light-letter) alternative at 16px, on both light and dark tab-bar
backgrounds — headless Chrome screenshot (`--headless --screenshot`), then
actually looked at the resulting PNG with the image-reading tool rather than
inferring from the markup. The inverted option is close to invisible on a
dark tab bar; the verbatim option holds up in both. This is the one place in
today's queue I could do a real visual check rather than only a CSS grep,
and it confirms the order's choice rather than surfacing a disagreement.

**What I verified:**
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 30 warnings
  (baseline). `npm run build` — succeeded.
- Grepped the built CSS: `.hover\:bg-green-800\/66:hover{background-color:#143321a8}`
  (`a8` = 168/255 = 65.9% ≈ 66%), `.border-green-800{...}` and
  `.active\:bg-green-800:active{...}` / `.active\:text-cream-25:active{...}`
  / `.hover\:text-cream-25:hover{...}` all present as real rules.
- `diff public/favicon.svg dist/favicon.svg` — identical; Vite copies
  `public/` verbatim, confirmed rather than assumed.
- `dist/apple-touch-icon.png` present, same byte size as the source PNG.
- `sips -g pixelWidth -g pixelHeight -g hasAlpha` on the rendered PNG before
  shipping it: 180×180, `hasAlpha: no` — the ground is genuinely filled, not
  just visually opaque in a viewer that composites transparency for you.
- `grep -o "favicon.svg\|apple-touch-icon.png" dist/index.html` — both
  references present in the built HTML.

**What I did NOT verify:**
- The order says explicitly: "Neither is browser-verified by grepping. The
  owner confirms both by eye." The Save button's actual hover/press
  transition and the favicon in a real browser tab (as opposed to a
  screenshot of an isolated SVG) are both unseen.
- Font rendering: the apple-touch-icon PNG was rendered by this machine's
  Chrome, which may or may not have resolved `Big Caslon` the same way an
  end user's browser/OS will — I looked at the image and the letterforms
  read as a real serif, but I can't confirm which font in the stack actually
  won.

---

## UIO-012 item 2/2b — Dashboard moves to Management, a divider separates Add New

**Commit:** `cefaad7`

Before writing any code for item 2, stopped and asked rather than guessing:
`IntakePage.tsx` is 870 lines of business-critical staff workflow (booking
pipeline, invitation provisioning that emails registration links, lesson
scheduling) against `DashboardPanel.tsx`'s 46-line personal notification
strip, and `IntakePage.tsx` isn't in UIO-012's Files list. Got back: nav
half only, content merge is a separate task, confirmed via the order's own
later correction ("the orchestrator misread the merge direction" —
clarifying I hadn't actually picked a direction, only flagged the scale
mismatch as a reason to ask; direction stands as originally stated —
Dashboard retained and moved, Inbound dissolved from the nav).

**What I verified:**
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 30 warnings
  (baseline). `npm run build` — succeeded.
- Read the compiled `MANAGEMENT_GROUP` array (`x9` in the minified chunk)
  directly: `{to:"/app/dashboard",label:"Dashboard",icon:Ju},{to:"/app/ops/support",...}`
  — Dashboard present, no `/app/ops/intake` anywhere in that array.
- Read the badge-injection line in the same chunk:
  `.map(Be=>Be.to==="/app/dashboard"?{...Be,badge:c+d}:Be)` — targets the
  right path, sums the right two variables (`c`=unreadCount, `d`=inboundCount
  in this chunk's minified names, traced back from the surrounding scope).
- Confirmed `StaffNavItems` (`QN` in the chunk) compiles with exactly three
  items (Calendar, Catalog, Messages) and its function signature dropped
  `bellCount` — then separately checked both of its call sites
  (`r.jsx(QN,{dmCount:o,open:S})` and `r.jsx(QN,{dmCount:o})`) to confirm
  neither still passes `bellCount`, rather than trusting the typecheck pass
  alone to mean the call sites were also cleaned up.
- Confirmed `ClientNavItems` (member rail) is unchanged — still has its own
  Dashboard entry with `badge:e` (bellCount) — members were never part of
  this reshuffle and I checked rather than assumed the shared `RailLink`
  refactor left it alone.
- Confirmed the new divider's compiled output sits directly between the Add
  New button and the App pages group: `r.jsx("div",{className:`my-1
  border-t ${xd}`,role:"separator"})`.
- Grepped for `Inbox` (the lucide icon) across the file after removing its
  only usage: zero remaining references, so removing the import doesn't
  leave a dangling unused symbol.

**Scope note, flagged rather than silently resolved:** the order says the
divider "applies to both rails, client and staff." Checked `ClientRail`'s
render and found no create control above its list at all — no "Add New"
equivalent anywhere in the member rail. Added the divider only where a
create control actually exists (the staff rail) rather than inventing one
for the client rail to attach a divider to.

**What I did NOT verify — needs a browser check:**
- That the merged Management entry actually navigates to Dashboard and
  shows the summed badge count correctly at runtime — traced through
  compiled source, not clicked.
- That removing `bellCount` from `StaffNavItems` didn't silently change
  behavior somewhere the type system wouldn't catch (e.g., if a caller
  relied on a truthy prop existing at all, not just its value) — TypeScript
  and the excess-property check should catch a real mismatch, but this is
  inference, not a render.
- The content-merge decision itself (Inbound dissolving into Leads as
  contact records, per the order's latest correction) is explicitly out of
  scope for this commit and unbuilt.

---

## UIO-010 — the badge number

**Status: CLOSED, NO CHANGE.** No commit. Read the order in full to confirm
it's still closed as of the current queue (last touched at `490a104`,
already synced past) — `NAV_BADGE` (`bg-gold-500 text-green-950`,
`AppLayout.tsx`) is untouched. Nothing to verify because nothing shipped.

---

## UIO-011 — EVALUATION, outline hover and one-green harmonization

**Commit:** `4f8e3b4`

**Nothing in `src/` touched** — confirmed via `git status --short` before
committing, showing only the new `docs/reference/` file.

Built `docs/reference/uio-011-hover-and-green-evaluation.html`, self-contained
(one Google Fonts link, all other CSS inline, same convention as the
existing `header-mockup.html` and this session's own
`uio-006-open-state-options.html`).

**Actually rendered and looked at it before shipping**, not just read the
markup: headless Chrome screenshot at full-page size, inspected with the
image-reading tool. Found the three-column header-ink difference (today's
`#0d2118` vs the proposed `#31523f`) was hard to judge at the full page's
zoom level, so rendered an isolated close-up of just the two colours
side-by-side to confirm the distinction is real but genuinely subtle — which
matches the order's own numbers (2.7× lighter, not a different colour
family) rather than being an artifact of my mockup. Did not tune the mockup
to exaggerate the difference into something more dramatic than what the
order's own contrast table describes.

**What's on the page:**
- Question A: two nav-column mockups side by side (today's fill hover vs an
  outline-hover alternative), cursor shown on a non-selected row in both so
  hover and selected read as distinct in the same frame.
- Question B: three full mock-page columns (brand green everywhere / large
  content text only in `#31523f` / everywhere including the header mark,
  company name and avatar letter), each carrying the notification badge —
  per the order's explicit instruction to include the badge in every column,
  since this evaluation is the one pass where the gold/size/shape/position
  are actually in scope (UIO-010 closed the number question but left the
  aesthetic complaint open).
- The order's own contrast table, reproduced rather than recomputed (this
  file has no code to grep — it's a static mockup, not something Tailwind
  builds).

**Recommended nothing beyond what UIO-011 itself already states**, per the
order's own reporting instruction — the page includes the orchestrator's
existing rationale (try the harmonized green on large content text first,
not everywhere) as page copy, but does not argue for column 2 over column 3
or outline over fill beyond restating that reasoning.

**What I did NOT do:** decide anything. This is the one order in today's
queue that explicitly forbids a decision, not just discourages guessing at
a missing value.

---

Queue complete: UIO-003 through UIO-012 (all items), UIO-005, UIO-010,
UIO-011. Nothing left `READY` as of this session's last sync with
`origin/main`.

---

## New queue: UIO-013 through UIO-018

Synced `task/uibuild` to `origin/main` (fast-forward, clean — 54 files, all
from unrelated merged threads: NOGUARD2/3, ROSTER, ROSTERCARD,
CONTRACTORPHAN, INVITEWORKS, DASHLEADS, LEASEFIX. None touch
`AppLayout.tsx`/`app-header.css`/`ContractSubheader.tsx`). **Baseline lint
warnings moved from 30 to 35** with this merge — confirmed by stashing my
own changes and re-running lint against the merged-but-otherwise-untouched
tree before assuming my work introduced anything. 35 is the correct
baseline for everything below.

## UIO-013 — the nav loses its fill states and takes gold

**Commit:** `94f3f8d`

**Scope:** applied to the nav-rail family only (`RailLink`/`NAV_ROW_IDLE`/
`NAV_ICON_IDLE`/`CommunityNav`/Add New), consistent with UIO-003's own
scoping — the account-menu-dropdown-shaped block (`MenuLink` and the block
around what's now lines 1132-1268) still carries the old
`hover:bg-navfill/64` fill untouched. Same reasoning as before: that's a
different, unrelated surface the order doesn't name.

**What I verified:**
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 35 warnings
  (new baseline, confirmed above). `npm run build` — succeeded.
- Grepped the built CSS for all four underline sub-properties by property,
  not by my authored class name — first attempt at the regex mis-escaped
  Tailwind's arbitrary-variant selector (`\[\@media\(hover\:hover\)\]\:...`)
  and returned nothing, which looked exactly like a T1 silent-fail; redid it
  with a plain substring search rather than trusting the first empty result.
  Confirmed present: `text-decoration-line:underline`,
  `text-decoration-color:#ba9935` (gold-600, exact hex), `text-decoration-thickness:2px`,
  `text-underline-offset:4px` — both the direct `hover:` forms (row-level,
  e.g. RailLink) and the `group-hover:` forms (CommunityNav's Link, which
  needs to react to hovering its sibling toggle button too).
- Confirmed `.group:hover .[...]group-hover:bg-cream-25{background-color:rgb(253 252 250 ...)}`
  present for the badge — exact cream-25 value.
- Confirmed `bg-navfill/64` is now ONLY emitted for the untouched
  account-menu block (grepped the source lines producing the one remaining
  compiled rule, all outside this order's scope) and `bg-navfill/80`
  (selected, untouched) still emits unchanged.
- **The empirical check that mattered most**: before centralizing the
  underline in the row-level className (rather than touching every
  individual label span, which the order suggests as one option), rendered
  a minimal flex-row reproduction (icon + label, `underline` on the row) in
  headless Chrome and looked at it — confirmed the line stays under the
  label's own text width and does not appear under the icon or stretch
  across the row. This is standard CSS behavior (text-decoration doesn't
  decorate replaced elements, and paints per-element even when inherited to
  flex children), but I tested rather than assumed it given how explicit the
  order is about the icon and the row being off-limits.

**Selected-fill ("light gold") — explicitly NOT shipped**, per the order's
own stop condition. Computed cream-25 vs. gold-600 contrast at every alpha
from 0.2 to 1.0 (Python, WCAG relative-luminance formula): best case is
2.66:1 at 100% opacity (no blend at all) — the fill and the label color are
structurally incompatible, not a tuning problem. `NAV_ROW_ACTIVE` is
byte-for-byte unchanged; documented the finding in a comment at its
declaration so a future thread doesn't re-attempt the same math.

**Badge on selected row also NOT changed** (not explicitly required, but
coupled to the blocked piece) — reasoned that blending the badge into the
panel color only makes visual sense against an unfilled or light
background; against the still-dark `navfill/80` selected fill, a cream
badge would look like a stray light dot rather than "a hole," so left it
untouched pending the selected-fill question being resolved by the owner.

**What I did NOT verify — needs a browser check:**
- The actual rendered underline in the real app (not just the isolated
  repro), the badge's hover blend, and whether removing the fill entirely
  reads as intended rather than "broken" — this is explicitly a "try it"
  per the owner, so the verdict is his to make.

---

## UIO-014 — the divider between the desktop nav and the content is too dark

**Commit:** `7280812`

**Scope note:** the order's Files section names one line in `AppLayout.tsx`
only. Determined which of the two rails "line 827" actually meant by
checking out the exact commit that authored UIO-014
(`git show 6ed5cd4:src/components/app/AppLayout.tsx`) rather than guessing
from the current, already-shifted line numbers — confirmed it's the
`ClientRail` (member rail), not the staff rail, which carries the identical
`border-r border-green-950/20` untouched. Did not extend the fix to the
staff rail on my own judgment.

**Real bug found and fixed, not just the literal instruction implemented:**
before shipping, checked whether `border-green-900/12` (the order's own
stated target, "not invented — already this file's declared divider
weight") actually compiles. It did not, anywhere, ever — confirmed by
listing every `green-900` rule the build actually emits (10, 15, 20, 40,
50, 70, 75, 80, 90, 95 all present; 12 absent) and cross-referencing
Tailwind's real default opacity scale
(`node -e "console.log(Object.keys(require('tailwindcss/defaultTheme').opacity))"`
— steps of 5, so 12 was never going to be in it) against
`tailwind.config.js`'s custom additions (64, 66 — not 12). Stopped and
asked rather than shipping a value I'd just proven does nothing; the answer
was to fix the scale (added `12: '0.12'`), which the orchestrator
authorized explicitly since it's outside UIO-014's own Files list.

**Swept the whole source tree for every other `color-utility/N` opacity
modifier**, per the follow-up instruction, cross-checked against the full
valid set (5-step default plus 8/12/64/66): found `/8` also missing,
6 sites across 4 files this task doesn't own
(`ContractActivityCard.tsx`, `HorsePage.tsx`, `ops/ActivityPage.tsx`,
`ops/EvaluationReportsPage.tsx` — listed exhaustively via grep, not
sampled). Added `8: '0.08'` to the same scale fix; did not touch those
files' content, only the shared config that now makes their existing
classes work. Every other value in active use (5 through 95 in 5s, plus 64
and 66) was already covered — confirmed by the sweep script's full output,
not a partial check.

**The six NAV_DIVIDER sites that change as a side effect of the config
fix** (all were rendering `border-color: currentColor` — Tailwind
preflight's global default — instead of the intended faint wash, since
`border-t` alone still draws a line even when its color utility silently
fails):
1. `AppLayout.tsx:827` — `NavFooter`'s own top border (pre-existing, not
   from this session)
2. `AppLayout.tsx:1362` — the "Add New" divider (UIO-012, this session)
3. `AppLayout.tsx:1387` — the App pages group's collapsed-state divider
   (UIO-012, this session)
4. `AppLayout.tsx:1417` — the pre-existing collapsed-group separator
   (Management/People/etc., predates this session)
5. `AppLayout.tsx:1542` — the mobile drawer's section-heading border
   (pre-existing)
6. `AppLayout.tsx:873` (this order) — the client rail's own right edge,
   the new site UIO-014 asked for

**What I verified:**
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 35 warnings
  (baseline). `npm run build` — succeeded.
- Grepped the built CSS by property for both fixed values:
  `border-green-900\/12{border-color:#0d21181f}` (`0x1f`/255 = 12.2% ≈ 12%,
  confirms the right alpha, not just that a rule exists) and
  `green-800\/8{border-color:#14332114}` /
  `green-800\/8{background-color:#14332114}` (`0x14`/255 = 7.8% ≈ 8%).
- Read the compiled JS for the client rail's actual className string:
  `border-r border-green-900/12` present; the staff rail's className still
  reads `border-r border-green-950/20`, confirming the scope stayed at
  exactly one rail as ordered.

**What I did NOT verify:**
- Whether the now-correctly-rendering dividers at the other 5 sites read as
  intended visually, or whether any of them now looks TOO faint/heavy in
  context — I only confirmed they went from "wrong colour" to "the declared
  colour," not that the declared colour is definitely right everywhere it's
  used. Worth a specific look at all six, not just the one this order asked
  about.

---

## UIO-015 — the subheader buttons and text are too large on desktop

**Commit:** `ae87c2c`

**Amending per the orchestrator's instruction: the order's quoted "current
state" of `SUBHEADER_BTN` (lines 72-75) was stale.** It quoted a version
with `text-sm` and no `md:` overrides beyond `md:py-2`. The actual file had
already moved to fluid `clamp()`-based sizing for `padding-inline`,
`font-size` and `gap` (three more lines the order doesn't quote at all),
replacing an earlier two-breakpoint version a comment block says had real
bugs ("the row still wrapped well above the intended breakpoint"). This
wasn't something I needed to discover by reading history — the order simply
described a file that no longer existed by the time I reached it.

**Tested the literal instruction before shipping it, found it was a no-op,
and stopped rather than shipping something that looked right in the diff
and did nothing in the render:** appended `md:text-[13px] md:px-2.5
md:py-1.5` to the class string, built, and read the compiled CSS's byte
offsets for both the new fixed-value rules and the existing `clamp()`
rules. The `clamp()` rules land AFTER the fixed-value rules in Tailwind's
own generated stylesheet regardless of where either sits in my source
string — same specificity, later-in-source wins, so the fluid ceiling
always overrode my fixed values. Reverted the experiment before asking.

**Confirmed direction: lower the `clamp()` ceilings in place**, using
exactly the values the orchestrator authorized (13px, 0.625rem/10px) —
these are UIO-015's own targets (13px text, ~10px horizontal padding),
just expressed correctly for the system the file actually uses, not my own
invented numbers. Minimums and the `vw` scaling term untouched, so
sub-ceiling fluid behavior is unchanged. Explicitly did NOT revert to fixed
breakpoint values, which the orchestrator noted would reintroduce the bug
the `clamp()` system exists to prevent.

**What I verified:**
- `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 35 warnings
  (baseline). `npm run build` — succeeded.
- Grepped the built CSS by the actual clamp arguments (not just presence of
  the property): `font-size:clamp(11.5px,1.05vw,13px)` and
  `padding-inline:clamp(.4rem,1.1vw,.625rem)` both present with the exact
  new ceilings.
- Confirmed the mobile base (`px-3 py-3 text-sm`, sub-`md`) and the `gap`
  clamp (`clamp(0.25rem,0.5vw,0.375rem)`) are byte-for-byte unchanged —
  grepped both directly rather than trusting the diff alone.

**What I did NOT verify — the order says explicitly this is an eye
judgement:**
- The actual rendered button/text size on a real desktop viewport. Grepping
  confirms the rule exists with the right numbers; it does not confirm 13px
  reads as "not too large" to the owner.
