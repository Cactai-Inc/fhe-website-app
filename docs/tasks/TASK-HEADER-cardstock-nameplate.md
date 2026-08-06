# TASK HEADER — Racing Green cardstock header

Replace the app header with the owner-approved "fine printed matter" header: a Racing
Green cardstock sheet carrying an embossed logo mark, an embossed wordmark, and a
debossed, interactive avatar button — **and nothing else**.

The visual design is **settled and signed off** — it was iterated live with the owner
over many rounds on real devices. Port it faithfully; do not redesign it.

## The reference — read this first

`docs/reference/header-mockup.html` is the approved artifact, checked into this branch.
Open it in a browser before writing any code. Every value in it is deliberate, and most
were arrived at by correcting a specific observed failure. **Treat its CSS as the
specification.**

The background asset is committed at `public/header-stock.jpg` (3000×773 book-matched
Racing Green cardstock, dark spine edge on the left). The mockup loads it from
`/header-stock.jpg`, so view the mockup through the app's own dev server.

## The header contains exactly three things

Left: embossed logo squircle with "FH". Center: embossed "French Heritage Equestrian".
Right: debossed avatar button with the user's initial.

**Everything else currently in the header is removed from it.** That means the mobile nav
button, the Create (`+`) button, the Calendar button, and the `ChevronDown` beside the
avatar. Every header in the app looks like this one.

## The part that needs a decision — STOP AND ASK BEFORE BUILDING

Removing those controls strands live functionality. Each has exactly one trigger in the
app today (`src/components/app/AppLayout.tsx`):

| Control | Today's only trigger | What it opens |
|---|---|---|
| Mobile nav | header button, line ~761 | `setMobileNavOpen(true)` — the left drawer, the **only** nav on screens below `lg` |
| Create | header button, line ~804 | `setCreateOpen(true)` → `<CreateModal>` |
| Calendar | header button, line ~808 | `navigate('/app/calendar')` |

The mobile nav button is the load-bearing one: **without it, phone and tablet users have
no way to reach navigation at all**, since the desktop rail is `lg`-only. Deleting it
outright makes the app unusable on mobile.

Do not guess a destination for these. **Report the three orphaned controls to the owner
with a recommendation and wait for the answer.** A reasonable recommendation to put
forward: fold all three into the avatar menu (Create and Calendar as menu items; the
mobile drawer opened from the avatar menu on small screens), since the avatar dropdown
survives and is the one control that remains. But the owner decides.

The avatar dropdown itself **stays** — the debossed avatar is its trigger. Keep `onClick`,
`aria-expanded`, `menuRef`, outside-click close, and every existing `MenuLink`.

## Also still true

- **Superadmin** keeps its separate "Cactai Platform" lockup and never renders the tenant
  wordmark. Confirm with the owner whether superadmin's header gets the cardstock
  treatment too, or stays as-is.
- The "documents awaiting signature" banner sits **above** the header and is unaffected.

## What changes visually

1. **The bar** — white becomes the cardstock sheet: `background-image:
   url('/header-stock.jpg')`, `background-size: cover`, `background-position: center`,
   plus the two radial-gradient light layers and the inset/drop shadow stack from the
   mockup's `.hdr`. Height 80px desktop (was `h-14`).
2. **Logo mark** — the favicon `<img>` becomes the embossed SVG squircle with "FH".
   Stays a `<Link to="/app">`.
3. **Wordmark** — "French Heritage" becomes "French Heritage Equestrian" at 44px with the
   mockup's `.emboss` treatment, short-name swap at ≤480px.
4. **Avatar** — the flat green circle becomes the debossed ring + letter with the full
   press interaction, still triggering the dropdown.

## Non-negotiable construction details

Each of these fixes a specific defect found during iteration. Changing them brings it back.

- **SVG viewBox must equal render size.** Logo: 56-unit viewBox at 56px. Avatar: 50 units
  at 50px. Scaling a viewBox (62 units into 56px) puts the 1px stroke offsets at 0.903px,
  straddling device pixels — the outline goes jagged and fuzzy. Hold these sizes at
  **every breakpoint**; do not resize the marks responsively.
- **Outline strokes carry no blur filters.** Three hard-edged strokes (`.ring`,
  `.ring-dark`, `.ring-light`) offset a full 1px. The hardness *is* the struck-impression
  effect.
- **Text shadows use sub-pixel offsets with blur.** A 1px offset at 0 blur renders as a
  detached slab on a 3x phone.
- **Shadow offsets do not scale with font-size.** Each breakpoint's wordmark carries
  offsets computed for its own size (see the per-breakpoint `.wordmark` text-shadow rules).
  Reusing one set across sizes makes large text look washed out.
- **Letter fill matches the sheet exactly** (`#293a37`). A lighter fill reads as a shape
  sitting on the stock rather than displaced material. Tried and rejected.
- **The avatar C sits at `translateY(1px)` at rest** — its deboss shadows (dark above,
  light below) drag the eye upward, so geometric centering reads high.
- **Press interaction**: hover sinks the letter 1px and the ring 0.5px, widens the well
  band, dims the bottom breath; click goes to 2.25px / 1.1px / wider band. Down is fast
  (.07s), release slower (.18s). Driven by an `is-pressed` class via JS pointer events —
  **not `:active`** — so touch-drag-off and `touchcancel` release cleanly. Hover rules
  live inside `@media (hover:hover)` so phones never stick.
- **`-webkit-tap-highlight-color: transparent`** on the avatar, or iOS paints a grey
  square over the round button.
- **Safe-area insets**: header padding is `calc(Xpx + env(safe-area-inset-left/right))`,
  and `index.html`'s viewport meta needs `viewport-fit=cover`, or landscape phones
  letterbox the sheet with pale bands beside the notch.

## The font question — ALSO STOP AND ASK

The mockup uses **Libre Caslon Text 700**. The app ships **Cormorant Garamond**
(`tailwind.config.js` `display`, imported in `src/index.css`), with `"Big Caslon"` ahead
of it as a macOS-only enhancement.

These are visibly different faces, and the emboss values were tuned against Libre Caslon's
weight and modulation. **Do not silently substitute.** Report which you recommend, with
the tradeoff stated (adding a font = one more webfont request; using Cormorant = the
approved shadow values likely need retuning against a lighter face). Wait for the answer.

## Responsive behavior

All values are in the mockup. Summary:

| Width | Header | Wordmark |
|---|---|---|
| desktop | 80px | 44px, full name |
| ≤900px | 86px | 40px |
| ≤850px | 83px | 34px |
| ≤820px | 76px | 29px |
| ≤480px | 88px | 30px, **short name** |
| landscape phone | 60px | 28px, full name |

The landscape rule is keyed on `(max-height:500px) and (orientation:landscape) and
(pointer:coarse)` so it cannot catch a tablet or a short desktop window.

## Constraints

- **`ClauseDocument.tsx` is FROZEN.** Do not touch it.
- Work in your **own git worktree**. The shared checkout gets clobbered by parallel threads.
- Do not restructure `AppLayout.tsx` beyond the header block and whatever the owner's
  answer requires for the three orphaned controls. It is 1047 lines and other threads
  touch it.
- Typecheck and lint clean before reporting.

## Verification before reporting

1. Screenshot desktop, tablet, and mobile-portrait headers; compare against the mockup
   side by side. The outline must be **smooth, not jagged** — the single most sensitive
   detail.
2. Confirm the avatar dropdown opens, closes on outside click, and every menu link
   navigates.
3. Confirm navigation is still reachable on a phone-width screen. If it is not, the task
   is not done.
4. Confirm superadmin still gets its platform lockup.
5. Report anything you changed that is not in this doc, and why.

## Reporting

Write `docs/reports/TASK-HEADER-REPORT.md`. State plainly what you verified with your own
eyes versus what you assume works. If you could not verify something, say so — do not
report it as done.
