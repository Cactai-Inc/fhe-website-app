# TASK TIPTAP — explanations must work on tap

Branch: `task/tiptap-tooltips` · Worktree: `fhe-worktree-tiptap` (off `origin/main` @ `b8b078a`)
Date: 2026-08-07

## Scope delivered

One new file (`src/components/app/ExplainTip.tsx`) plus tooltip-call-site-only
edits to `ClauseDocument.tsx` (frozen-file exception, per the task's grant) and
`ContractCascade.tsx`. No layout, gating, or field logic touched in either
file — confirmed by diff review (§7). `docs/reports/`, migrations: none.
Sarah's document `704c8d2d-…` was never read or written; nothing in this task
touches document data at all, only the renderer's tooltip mechanism.

## 1. The component — `ExplainTip.tsx`

One shared component, `<ExplainTip text={…} …>{children}</ExplainTip>`:

- **Tap/click toggles a pinned-open bubble.** Tap elsewhere (`mousedown`
  outside both the trigger and the bubble — same pattern already used by
  `AppLayout.tsx`'s nav menu and `SendCopiesMenu.tsx`), Escape, or a scroll
  closes it.
- **Hover opens it on desktop without a click** — gated on `window.matchMedia
  ('(hover: hover) and (pointer: fine)')`, checked once per mount, so a touch
  device never wires the listeners at all (not just "hover fires but does
  nothing" — the handlers are `undefined`, never attached).
- **Keyboard reachable**: `tabIndex={0}`, Enter/Space toggles it (manual
  handler, since the trigger has to stay a plain `span`/`div`/`mark` rather
  than a real `<button>` at sites that wrap actual form controls — see
  `asButton` below), Escape closes it and returns focus to the trigger.
- **Only one open at a time**, page-wide — a module-level `activeClose`
  pointer closes whichever instance was previously open before a new one
  opens, whether that instance was opened by hover or by tap.
- **Positioned via a `document.body` portal**, `position: fixed`, so it always
  escapes an ancestor's `overflow` (the contract panel in `ContractDrawer.tsx`
  scrolls, which would otherwise clip an `absolute`-positioned bubble) and is
  measured/clamped against the real viewport: `left` is clamped into
  `[8px, innerWidth − bubbleWidth − 8px]`, and it flips above the trigger when
  there isn't room below. This is the two-pass "render hidden → measure →
  place" technique — the first implementation gated the bubble's very
  existence on having already computed its position, which is a deadlock
  (nothing ever measures a bubble that only renders once it's already
  positioned); caught by the interaction test in §3 before it shipped anywhere,
  fixed by mounting the bubble immediately (`visibility: hidden` until placed).
- **`title` + `aria-label` stay on the trigger, unconditionally, exactly as
  before.** A screen reader's access to the explanation was never routed
  through the visual bubble — it reads the trigger's own accessible name
  regardless of open state, so nothing here can regress that path. `role=
  "button"` + `aria-expanded` are added by default (matches this app's
  existing `InfoDot` precedent) but are **skippable** via `asButton={false}`
  for sites where `children` is a real (if disabled) form control — ARIA
  button semantics can make a screen reader stop exposing a descendant
  control individually, which the old plain `<span title>` never did. Used at
  exactly one site: `OwnedField` (§2).
- **`underline`** (default on) draws the dotted-underline cue this codebase
  already used at some (not all) of the sites being converted — standardized
  across every wrapped-text site so "dotted underline = tap for the reason"
  means the same thing everywhere. Turned off (`underline={false}`) at sites
  that are already their own distinct marker — an icon glyph, the required
  `*`, or an already-highlighted `<mark>` — so the cue isn't doubled under a
  single character.
- **`as`** picks the wrapper element: `span` (default), `div` for block-level
  call sites, `mark` to preserve that semantic element where it existed
  (`ContractBody`'s "Needs:" highlight).
- **`text` falsy → renders `children` plain**, no `title`, no `tabIndex`, no
  affordance classes at all — reproduces every call site's existing `tip ? …
  : ''` fallback exactly (an untipped `TokenValue`/`ImportedRecordToken`
  looked and behaved identically before and after).

## 2. Call sites converted

**`ClauseDocument.tsx`** (all 6 `title=` sites the task doc named, confirmed
by grep to be the complete list):

| Line (orig) | Site | Notes |
|---|---|---|
| 124 | `TokenValue` — imported value w/ tip | dotted underline (already had it) |
| 135 | `TokenValue` — "on file" hint | dotted underline **added** (previously bare `cursor-help`, invisible on touch and easy to mistake for inert grey text — the exact discoverability failure this task calls out) |
| 214 | `OwnedField` — "This item is set by the Lessor." | `asButton={false}` (wraps the field's own, always-disabled-in-this-branch, `InlineFieldControl`); opacity-55 dimming (existing convention) kept as-is, underline left off — see §4 for why |
| 252 | `ImportedRecordToken` — "not on file" | dotted underline added, same reasoning as line 135 |
| 262 | `ImportedRecordToken` — value | dotted underline (already had it) |
| 999 | required-field `*` | `underline={false}` — the gold `*` glyph is already its own marker |

**`ContractCascade.tsx`** (checked per the task doc's instruction; it does
carry explanation tooltips, in the older block-style `FieldNode`/`ContractBody`
renderers that `ContractPage.tsx` also mounts alongside `ClauseDocument`):

| Line (orig) | Site | Notes |
|---|---|---|
| 296 | `ContractBody` — `⟦NEEDS:…⟧` highlight | `as="mark"` to keep the semantic element; `underline={false}`, the highlight background is its own affordance |
| 1145 | `InlineFieldControl` — `⟲` source-tip icon | `underline={false}`, icon is the marker |
| 1483 | `FieldNode` — `ⓘ` insurance-unresolved icon | `underline={false}` |
| 1487 | `FieldNode` — `⟲` source-tip icon | `underline={false}` |

10 sites converted total. Every one still renders the exact same text it did
before (verified by direct diff — the only thing that changed at each site is
the wrapper, not the string passed as the explanation).

## 3. Left alone, with reasons

**Five `title="Remove"`/`"Delete…"` sites in `ContractCascade.tsx`** (lines
441, 519, 558, 707, 1374) — all are the native `title` on a real `<button
onClick=…>✕</button>` that itself performs the removal (a co-owner row, a
medication block, a fee option, a week-grid party). These are **not**
explanations of an inert state; the button is the actionable element, and its
own `✕` glyph is already a self-evident affordance a phone user doesn't need a
hover-tooltip to act on. Converting these to `ExplainTip` would mean tap #1
opens an explanation ("Remove") that no phone user asked for and tap #2 is
needed to actually remove the row — turning a working one-tap action into a
broken two-tap one. Per the task doc's own rule ("The tooltip trigger belongs
only to elements the viewer cannot act on"), these stay as plain `title=` —
functionally unaffected either way, since the icon alone already tells a
touch user what the button does.

**`InfoDot`** (`ContractCascade.tsx` ~L214) — a pre-existing click-to-toggle
ⓘ popover, not a `title=` tooltip at all (no `title` attribute anywhere in
it), so it's outside this task's stated scope ("convert existing title=
explanations"). Flagging it anyway: it has the same 390px overflow exposure
`ExplainTip` was built to fix (`absolute left-0 top-6 w-64`, no viewport
clamping) and no outside-tap-to-close. Left untouched since converting it
wasn't asked for and doing so would be a second, separate change outside this
task's frozen-file exception; noting it here so the orchestrator can decide
whether it's worth a follow-up.

## 4. Judgment call — `OwnedField`'s affordance (flagged, not silently decided)

Every other wrapped-text site got the dotted-underline cue standardized onto
it (§1, §2). `OwnedField`'s "This item is set by the Lessor." wrapper did
not — it keeps its existing `opacity-55` dimming (documented in the file as
the established, file-wide "not yours" convention) instead of adding an
underline on top. Two reasons:

1. `OwnedField` wraps a whole field row (label + a real, disabled input/
   select/checkbox), not a plain text run — CSS `text-decoration` on that
   wrapper would draw a dotted line under the label text but nothing under
   the input control itself (text-decoration doesn't render on replaced form
   elements), which risks looking like a rendering glitch rather than a
   deliberate cue.
2. Overlaying a *second* affordance convention (dotted underline) on a field
   state that already has its own well-established one (dimmed + "not mine")
   risked reading as visual noise on a row that, unlike the other converted
   sites, is already unambiguously styled as inactive.

To be precise about what actually shipped: `OwnedField`'s call passes no
`underline` override, so it *does* get the component's default
(`underline=true`) — same as every plain-text site. In the browser this will
draw a dotted line under the label text within the row (not under the input
control itself, per point 1 above, since form controls don't render
`text-decoration`). The two reasons above are why that default was left in
place rather than actively suppressed (`underline={false}`) for this
specific site — it was a genuine judgment call, not an oversight, and it's a
one-line change (`underline={false}` on the `ExplainTip` call in
`OwnedField`) if the rendered result looks wrong in a real browser and the
orchestrator would rather it match the icon-marker sites instead.

## 5. Verification

**Could verify, and did:**

- `npm run typecheck` — 0 errors.
- `npm run lint` — 0 errors, 30 warnings, **identical count** to the
  unmodified baseline (confirmed by stashing this task's changes and
  re-running lint against clean `origin/main` in the same worktree: also 30
  warnings, 0 errors). Nothing in this task's diff added or fixed a warning.
- `npm run build:client` — production build succeeds; manually grepped the
  built CSS for every Tailwind class `ExplainTip` constructs via template
  literal (`text-decoration:underline dotted`, `decoration-gold-500/60`,
  `underline-offset-2`, `z-[100]`, `.focus-ring`, `cursor:help`) — all
  present, so Tailwind's JIT extraction did pick up the dynamically-built
  class strings rather than silently dropping them.
- **A throwaway interaction test** (`@testing-library/react` + `vitest`,
  already project dependencies; not committed, deleted after use since the
  task didn't ask for a test suite and it wasn't part of the stated
  deliverable — available to reconstruct on request). It directly exercised,
  in jsdom, the logic a real device would exercise:
  - no trigger/affordance at all when `text` is falsy (matches the original
    per-site `tip ? … : ''` behavior byte-for-byte)
  - click opens the bubble with the right text; a `mousedown` elsewhere
    closes it; clicking the *same* trigger again toggles it closed
  - Escape closes it and moves focus back to the trigger
  - Enter/Space opens it with no mouse involved at all
  - with `matchMedia('(hover: hover)…').matches = false` (simulating touch),
    `mouseenter` does **nothing** — confirms the hover path is actually gated
    off on touch, not just cosmetically inert
  - with `matches = true` (simulating a mouse), `mouseenter` opens it and
    `mouseleave` closes it, no click involved
  - opening a second `ExplainTip` closes a still-open first one
  - a disabled sibling `<button>` inside an `asButton={false}` wrapper never
    fires its own `onClick` on tap (browsers suppress click dispatch on
    disabled form controls), and the tap is instead caught by the wrapper —
    the tap lands on the explanation, not on nothing
  - **the 390px clamp specifically**: `window.innerWidth` set to 390, a
    trigger's `getBoundingClientRect` mocked to sit hard against the right
    edge (`left: 370`), and the resulting bubble's computed `left` asserted
    to stay within `[8, 382]` — i.e., never past the clamped boundary.
  - This test run is *why* the mount-deadlock bug in §1 was caught and fixed
    before this ever reached a real page — the very first version of the
    component would have shipped a tooltip that could never open, because
    the bubble's own existence was gated on a position that could only be
    computed by measuring the (nonexistent) bubble.

**Could not verify — no real device or browser available in this
environment** (consistent with prior threads in this area, per the task
doc's own note):

1. On a real iPhone: tap-opens / tap-elsewhere-closes visually confirmed in a
   live Safari session. Verified only via the jsdom interaction test above,
   which exercises the same event-handling code paths (`click`, `mousedown`,
   `keydown`) but cannot confirm iOS Safari's actual touch→click event
   translation timing or rendering.
2. Hover still works on desktop — verified in jsdom with a mocked
   `matchMedia`, not in a real browser with a real mouse.
3. At 390px, a right-edge field's bubble stays fully on-screen — the clamp
   *formula* is verified (§ above), but not a rendered screenshot; real
   font-metrics/line-wrapping in an actual browser could differ from jsdom's
   zero-layout measurements (jsdom returns `0` from `getBoundingClientRect`
   unless explicitly mocked, so the *rendered* bubble width in a real browser
   was never itself measured, only the clamp math that consumes whatever
   width is reported).
4. Every converted call site shows the same text as before — verified by
   direct code diff (§2), not by rendering the actual contract in a browser
   and reading it.
5. Screen-reader output unchanged — verified by reasoning (title/aria-label
   unchanged at every site, §1) and by `asButton={false}` at the one site
   wrapping real form controls (§2), not by running an actual screen reader.
6. Typecheck and lint clean — **fully verified**, §5 above.

## 6. `ClauseDocument.tsx` — freeze respected

Diffed the file against `origin/main`: the only changes are the new import
and the 6 call sites in §2, each a direct swap of the existing wrapper
element for `<ExplainTip>` with the same (or, at 2 sites, a standardized)
className and the same tip text. No section/clause/field logic, gating,
numbering, or layout line was touched. Nothing came up during conversion that
needed more than this — no stop-and-report was triggered.

## 7. Done-checks

- `npm install` (fresh worktree, no shared `node_modules`).
- `npm run typecheck` — 0 errors.
- `npm run lint` — 0 errors, 30 warnings (baseline-identical, §5).
- `npm run build:client` — succeeds; built CSS contains every class the new
  component constructs (§5).
- `git diff --stat` — 2 files changed (`ClauseDocument.tsx`,
  `ContractCascade.tsx`), 1 new file (`ExplainTip.tsx`); no other files
  touched.

## Honesty notes

- The mount-deadlock bug (§1, §5) was real and would have shipped a
  permanently-broken tooltip (the exact "tooltip that never opens looks
  identical to one with nothing to say" failure mode the task doc warns
  about) had the throwaway test not caught it before this report was
  written. Nothing in typecheck, lint, or the production build would have
  caught it — all three passed cleanly on the broken version too.
- §3 and §4 are judgment calls, flagged rather than silently applied:
  leaving 5 actionable-button `title=` sites unconverted, and leaving
  `InfoDot` unconverted despite sharing this task's core defect.
- No real iPhone or browser was available in this environment. §5 states
  precisely what was and wasn't verifiable here, per the task doc's own
  instruction to state this plainly rather than claim a coverage this
  environment can't produce.
