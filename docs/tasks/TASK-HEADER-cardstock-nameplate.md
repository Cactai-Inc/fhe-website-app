# TASK HEADER — Racing Green cardstock header

Replace the app header with the owner-approved "fine printed matter" header: a Racing
Green cardstock sheet carrying an embossed logo mark, an embossed wordmark, and a
debossed interactive avatar — plus two tabs (Create, and the mobile nav drawer).

The visual design is **settled and signed off**, iterated live with the owner over many
rounds on real devices. Port it faithfully. Do not redesign it.

## The reference — read this first

`docs/reference/header-mockup.html` is the approved artifact, checked in on this branch.
Open it in a browser before writing code. Every value is deliberate and most were arrived
at by correcting a specific observed failure. **Treat its CSS as the specification.**

Background asset: `public/header-stock.jpg` (3000×773 book-matched Racing Green cardstock,
dark spine edge left). The mockup loads `/header-stock.jpg`, so view it through the app's
dev server.

## Scope — three surfaces

### 1. The header

Contains **exactly three things**: embossed logo squircle (FH) left, embossed
"French Heritage Equestrian" centre, debossed avatar right.

**Removed from the header entirely:**
- Calendar button — redundant, it's already in the avatar menu and the nav menu.
  Delete it. No replacement.
- Mobile nav button — replaced by the drawer tab (below).
- The `ChevronDown` beside the avatar — the debossed avatar is the trigger on its own.

**The avatar keeps its dropdown.** It remains the trigger: keep `onClick`,
`aria-expanded`, `menuRef`, outside-click close, and every existing `MenuLink`.

**SUPERADMIN: DO NOT TOUCH.** Superadmin's header is platform chrome, not tenant
branding, and gets its own design later. Leave its "Cactai Platform" lockup and its white
header exactly as they are. Do not apply the cardstock, the wordmark, or the tabs to it.

### 2. The Create tab — desktop only, admin/staff only

A hanging cardstock tab between the wordmark's end and the avatar, carrying a downward
chevron. Hover extends it; moving away retracts it; click opens the **existing
`CreateModal`** (do not build a new one). Keyboard-reachable, extends on focus.

- **Admin/staff only.** Regular users never see it.
- **Desktop only.** Hidden on mobile — there the page-level `+` controls are the create
  path (that's a separate task, PLUSPASS; do not build page `+` controls here).
- **The tab's stock must CONTINUE the header's, not re-crop it.** A 52px tab doing its own
  `background-size:cover` samples a different region of a 3000px image — different grain,
  different tone, reads as a patch stuck on. The mockup clips a viewport-width layer that
  uses the header's identical `cover`/`center` values, mirrored vertically (`scaleY(-1)`)
  so the grain meets itself at the seam. Copy this exactly.

### 3. The drawer tab — mobile only

Left screen edge, **24px below the header**, in the nav's **green glass** (not cardstock —
it belongs to the drawer, not the header).

Use the app's existing `NAV_GLASS` value (`AppLayout.tsx:32`) so it matches the drawer
exactly, including its non-`backdrop-filter` fallback.

Tap → the drawer opens and **the tab rides out attached to the drawer's edge**, arrow
rotating 180° to point back. Tap again, tap the scrim, press Escape, or make a selection →
both close. Drive tab and drawer from **one state** so they cannot desync. The tab
translates by `min(288px, 85vw)` — the drawer's own width formula — so it lands on the
drawer's edge at any viewport. Hidden at `lg+` (desktop has the rail).

**The drawer itself already exists** in `AppLayout.tsx` (~line 985). Attach the tab to it;
do not rebuild it. The mockup's drawer is a stand-in.

## The font — replacing Cormorant app-wide

Owner decision: **replace Cormorant Garamond with Libre Caslon Text.** Update
`tailwind.config.js` (`display` and `serif`) and the `@import` in `src/index.css`.
Keep `"Big Caslon"` ahead of it as the macOS enhancement.

This changes type **everywhere**, not just the header. That is intended, but a follow-up
task (TYPEPASS) will sweep the app for fallout — Libre Caslon's metrics differ from
Cormorant's (it runs larger at the same px size with different weight distribution).
**In this task, change the font and fix only the header.** Do not attempt an app-wide
retune; flag anything obviously broken in your report for TYPEPASS.

Small all-caps sans labels: **11px** for eyebrow-level labels, **10.5px** for the smaller
meta line beneath them. That half-step is deliberate hierarchy — do not flatten it.

## Non-negotiable construction details

Each fixes a specific defect found during iteration. Changing them brings it back.

- **SVG viewBox must equal render size.** Logo: 56-unit viewBox at 56px. Avatar: 50 at
  50px. Scaling a viewBox (62 units into 56px) puts 1px stroke offsets at 0.903px,
  straddling device pixels — the outline goes jagged and fuzzy. Hold these sizes at
  **every breakpoint**; do not resize the marks responsively.
- **Outline strokes carry no blur filters.** Three hard-edged strokes offset a full 1px.
  The hardness *is* the struck-impression effect.
- **Text shadows use sub-pixel offsets with blur.** 1px at 0 blur = detached slab at 3x.
- **Shadow offsets do not scale with font-size.** Each breakpoint's wordmark carries
  offsets computed for its own size. Reusing one set washes out large text.
- **Letter fill matches the sheet exactly** (`#293a37`). Lighter fill reads as a shape
  sitting on the stock. Tried and rejected twice.
- **The avatar C sits at `translateY(1px)` at rest** — deboss shadows drag the eye up, so
  geometric centring reads high.
- **Avatar press**: hover sinks the letter 1px and the ring 0.5px, widens the well band,
  dims the bottom breath; click → 2.25px / 1.1px / wider band. Down fast (.07s), release
  slower (.18s). Driven by an `is-pressed` class via JS pointer events — **not `:active`**
  — so touch-drag-off and `touchcancel` release cleanly. Hover rules inside
  `@media (hover:hover)` so phones never stick.
- **The well band must never flood the face.** It's a blurred band clipped inside the rim;
  too wide + too blurred near a 24px radius closes over the centre and turns the button
  solid black. Verify the inner edge stays clear at every state.
- **`-webkit-tap-highlight-color: transparent`** on tappable marks, or iOS paints a grey
  square over the round avatar.
- **Safe-area insets**: header padding is `calc(Xpx + env(safe-area-inset-left/right))`,
  and `index.html`'s viewport meta needs `viewport-fit=cover`, or landscape phones
  letterbox the sheet with pale bands beside the notch.

## Responsive

| Width | Header | Wordmark |
|---|---|---|
| desktop | 80px | 44px, full name |
| ≤900px | 86px | 40px |
| ≤850px | 83px | 34px |
| ≤820px | 76px | 29px |
| ≤480px | 88px | 30px, **short name** |
| landscape phone | 60px | 28px, full name |

Landscape rule is keyed `(max-height:500px) and (orientation:landscape) and
(pointer:coarse)` so it cannot catch a tablet or short desktop window.

## Deliberately deferred — do not do these

- **Header drop shadow tuning.** The mockup's `0 6px 18px rgba(24,38,32,.14)` ships as-is.
  It will be judged against real scrolling content afterwards.
- **Page-level `+` controls** (PLUSPASS).
- **App-wide type retune** (TYPEPASS).

## Constraints

- **`ClauseDocument.tsx` is FROZEN.** Do not touch it.
- Work in your **own git worktree**. The shared checkout gets clobbered.
- Do not restructure `AppLayout.tsx` beyond the header block, the drawer tab, and the
  font swap. It is 1047 lines and other threads touch it.
- Typecheck and lint clean before reporting.

## Verification before reporting

1. Screenshot desktop, tablet, mobile-portrait, and mobile-landscape headers; compare
   against the mockup side by side. **The outline must be smooth, not jagged** — the
   single most sensitive detail in this build.
2. Avatar dropdown opens, closes on outside click, every menu link navigates.
3. Drawer tab opens the drawer, rides out attached, arrow flips, and all four close paths
   work (tab, scrim, Escape, selection).
4. Create tab appears for admin on desktop only — **not** for regular users, **not** on
   mobile — and opens the existing CreateModal.
5. Superadmin's header is untouched.
6. Confirm nav is reachable on a phone. If it isn't, the task is not done.
7. Report anything you changed that is not in this doc, and why.

## Reporting

Write `docs/reports/TASK-HEADER-REPORT.md`. State plainly what you verified with your own
eyes versus what you assume. If you could not verify something, say so — do not report it
as done.
