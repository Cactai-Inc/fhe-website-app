# TASK HEADER — Racing Green cardstock header — REPORT

Branch `work/header-cardstock` (from `task/header-cardstock`), built in its own
git worktree. Typecheck clean, lint identical to baseline (29 warnings, 0
errors, before and after), production `vite build` succeeds.

---

## What shipped

| File | Change |
|---|---|
| `src/components/app/CardstockHeader.tsx` | new — the sheet, three marks, Create tab, press physics, SVG defs |
| `src/components/app/header-cardstock.css` | new — the mockup's CSS, namespaced `cs-` |
| `src/components/app/AppLayout.tsx` | header block replaced; drawer tab added; account dropdown hoisted |
| `tailwind.config.js` | `display` + `serif` → Libre Caslon Text |
| `src/index.css` | `@import` swapped; print stack swapped; header comment updated |
| `index.html` | `viewport-fit=cover` |

---

## How I verified

`/app` is behind Supabase auth and I had no credentials, so I could not sign
into the running app. Instead I served the branch with the app's own dev server
and drove real Chrome (Playwright over the system browser) against two things:

1. `docs/reference/header-mockup.html` — the approved artifact.
2. A temporary harness mounting the **real** `CardstockHeader` with the **real**
   `header-cardstock.css` and the **real** `index.css` (fonts, Tailwind), plus
   the drawer tab wired to a copy of AppLayout's drawer markup and `NAV_GLASS`.

Then I pixel-diffed one against the other. **The harness has been deleted; it is
not in the commit.** What that method does and does not cover is set out under
"Not verified" below.

### Verified with my own eyes (screenshots + pixel diffs)

**The header is pixel-identical to the approved mockup.** At 1280×900 @2x the
full header strip diffs to **exactly zero** — every pixel. The logo and avatar
marks diff to **exactly zero at 3x** device scale, which is the case the doc
flags as most sensitive: **the outline is smooth, not jagged.** Both SVGs are
drawn 1:1 (56 at 56px, 50 at 50px) and hold that size at every breakpoint.

Header height and wordmark size measured at every breakpoint in the doc's table,
all matching the mockup exactly:

| Width | Header | Wordmark | Name |
|---|---|---|---|
| 1280 | 80px | 44px | full |
| 900 | 86px | 40px | full |
| 850 | 83px | 34px | full |
| 820 | 76px | 29px | full |
| 390 (coarse) | 88px | 30px | **short** |
| 844×390 coarse | 60px | 28px | full |
| 834 tablet | 83px | 34px | full |

The landscape rule correctly does **not** catch the 834px tablet (it gets the
width rule's 83px, not 60px).

Also confirmed by measurement: computed text-shadow, colour, tracking, font and
element geometry all match the mockup at every breakpoint; the wordmark's
per-breakpoint shadow offsets are distinct, not reused.

### Verified interactively (38 assertions, all passing)

- **Create tab** — visible for staff on desktop; extends on hover
  (`translateY(-22px)` → `0`); retracts on mouse-away; extends on focus
  (keyboard-reachable); click fires the existing `CreateModal` handler.
  **Absent for a regular user. Hidden on mobile.**
- **Create tab stock** — its `::after` resolves to `matrix(1,0,0,-1,0,80)` over a
  1280px-wide, 80px-tall layer with the header's own `cover`/`center`. Screenshot
  of the extended tab shows the grain running continuously through the seam.
- **Avatar** — letter at `translateY(1px)` at rest, `2px` on hover, `3.25px`
  pressed; `is-pressed` applied on pointerdown and released on pointerup.
- **The well band never floods the face** — sampled the avatar's central disc at
  rest/hover/press at both 1280 and 390: luminance holds at ~62 in all six
  states, i.e. the inner edge stays clear and never closes to black.
- **Avatar dropdown** — opens on click, right-aligned under the avatar, not
  clipped; **closes on outside click**; a click *inside* the panel does not close
  it; Escape closes; second avatar click toggles closed; `aria-expanded` tracks.
  (Verified with AppLayout's own outside-click effect and a real `useRef`.)
- **Drawer tab** — left screen edge, measured at exactly **24px below the header**
  (header bottom 88 → tab top 112 on a phone); opens the drawer; rides out to
  `translateX(288px)` and lands exactly on the drawer's edge; arrow flips 180°;
  `aria-label`/`aria-expanded` update. **All four close paths work**: tab tap,
  scrim, Escape, and a selection inside. Returns to rest after closing.
  Attachment re-checked at 320/360/390px — at 320 the `85vw` arm wins (272px)
  and the tab still lands exactly on the edge. Hidden at `lg+`.
- **Nav is reachable on a phone.** Yes — the drawer tab opens the full drawer at
  390px, and superadmin retains its own mobile nav button.

### Superadmin — proven untouched

I rendered the superadmin branch of the **old** header (taken verbatim from
`origin/task/header-cardstock`) and the **new** one side by side and compared the
resulting DOM: **`outerHTML` is byte-for-byte identical**, all 33 nodes present in
both, and every element's measured geometry matches. Its white header, "Cactai
Platform" lockup, mobile nav button, Create/Calendar buttons and `ChevronDown`
avatar are all exactly as they were. It gets no cardstock, no wordmark, no tabs,
and no drawer tab.

---

## Things I changed that the doc does not call for

**1. The mockup's Create-tab background does not render — repaired.**
This is the one behavioural change to a mockup value, and it is the item most
worth your eyes.

`.tab::after` in the reference is `transform: scaleY(-1)` with
`transform-origin: top` and nothing else. Measured in Chrome, that maps the
layer's box from tab-local `[0,80]` to `[-80,0]` — the entire mirrored sheet
lands *above* the tab's top edge, outside its `overflow:hidden` clip. The tab
paints **no stock at all**: it renders as a pale box against the cream page.
I confirmed this by measuring the computed transform and by screenshotting the
reference itself with the tab held extended.

I added `translateY(-100%)` ahead of the flip (`scaleY(-1) translateY(-100%)`),
which lands the mirrored strip on the tab's own box. Construction, inputs and
every value are the reference's — the viewport-width layer, the header's
identical `cover`/`center`, the vertical mirror. This only puts them where the
reference's own comment says they go. Verified visually both ways.

**2. The header height is published as `--cs-hdr-h`.**
The reference hardcodes `80px` in three places: the header's own height, the
tab's `::after` height, and the drawer tab's `top: calc(80px + 24px)`. It never
overrides that constant per breakpoint. For the Create tab this is harmless
(desktop-only, where the header *is* 80px). For the drawer tab it is not: on a
phone the header is 88px, so the reference's tab sat 16px below the sheet, not
24. Publishing the height as a variable reproduces the reference exactly on
desktop and makes the doc's wording — "24px below the header" — true everywhere.

**3. The marks name their own font.** The reference sets the face once on `body`
and lets the marks inherit. The app's `body` is `font-sans`, so the wordmark and
the FH silently rendered in **Inter** — caught by comparing computed fonts, not
by eye. `.cs-wordmark/.cs-fh/.cs-av` now name the face directly.

Note the stack is the reference's — `'Libre Caslon Text', Georgia, serif` — and
deliberately **not** the app's `font-display` token, which puts `"Big Caslon"`
first. Big Caslon is a different face with different shapes, and every shadow
offset here was tuned against Libre Caslon Text; you approved the mockup
rendering that face on a Mac. The Big-Caslon-first stack stays on the app-wide
token as the doc specifies. **Flagging in case you want the header to pick up
Big Caslon on macOS too — that is a design call, not a porting one.**

**4. `-webkit-font-smoothing: auto` on the three marks.** The app sets
`antialiased` on `<html>`; the reference does not. That is not cosmetic here —
the emboss *is* the glyph edge. Measured at 3x, the marks differed from the
reference by up to **35/255** on a channel with `antialiased`, and by **exactly
zero** with the platform default restored. Scoped to the three marks only;
the app-wide setting and every other surface are untouched.

**5. The account dropdown was hoisted out of the header markup** into a local
`accountMenu`, because there are now two headers that both render it. I diffed
the hoisted block against the original line by line: **character-identical apart
from the wrapper** (`{menuOpen && (` → `const accountMenu = menuOpen ? (`). Same
links, same order, same handlers, same classes.

**6. `src/index.css`'s print stack.** The contract print rule named
`'Cormorant Garamond'` explicitly rather than going through `font-serif`. Left
alone it would have silently printed contracts in Georgia once the import was
removed, so it moved with the swap. `ClauseDocument.tsx` was not touched.

---

## Not verified — stated plainly

- **I never saw this inside the running app.** No Supabase credentials, so I
  could not sign in. The header, tabs, drawer tab and dropdown were verified in a
  harness using the real components, real CSS and real fonts. What that does
  *not* exercise: the dropdown's actual `MenuLink` navigation targets, the
  admin/staff/superadmin branches resolving against real `useAuth` values, and
  the header sitting above real page content. Those rest on code reading and on
  the DOM-equivalence proof above. **Worth a click-through before merge.**
- **No real device.** Everything is Chrome with emulated viewport, touch and
  device-scale. Not verified on real hardware: iOS tap-highlight suppression,
  `-webkit-touch-callout`, `env(safe-area-inset-*)` behaviour beside a notch,
  `touchcancel`/drag-off release, and whether iOS honours the native
  `feGaussianBlur`. The code for each is the reference's verbatim.
- **The `backdrop-filter` fallback path** (`@supports not …`) was not exercised —
  Chrome supports `backdrop-filter`, so only the glass branch rendered. It comes
  from `NAV_GLASS`, so it matches the drawer by construction.
- **Sub-perceptual residue.** Below 1024px the header strip differs from the
  mockup by ≤4/255 on ~0.25% of pixels, confined to the bottom-left corner where
  the faint dark gradient sits. I verified every computed background property and
  the element rect are identical, and that the mockup renders deterministically
  run-to-run, so this is rasterisation, not a value difference. I did not isolate
  the cause further; at 2/255 it is not visible.

---

## Flagged for the follow-up tasks

**TYPEPASS** (font swap fallout — not fixed here, as instructed):
- **Libre Caslon Text ships 400 and 700 only — there is no 500.** The app uses
  `font-medium` on `.heading-display`, `.heading-section` and `.heading-card`
  (`src/index.css`), which will now synthesise or snap to 400. Those three rules
  carry comments explicitly justifying 500 for Cormorant; that rationale is dead
  and the weights need re-picking.
- Libre Caslon runs larger and heavier than Cormorant at the same px, so
  headings across the app will read bigger than before.
- `-webkit-font-smoothing: antialiased` on `<html>` is worth revisiting
  app-wide now that it is measurably thinning display type.
- The account dropdown's `max-h-[calc(100dvh-5rem)]` still assumes the old 3.5rem
  header. With an 88px header on a phone it can overflow by ~12px. Left alone
  (it scrolls internally); trivial to retune with `--cs-hdr-h`.

**PLUSPASS**: a regular member now has **no create affordance in the header at
all** — the old `+` button is gone and the Create tab is admin/staff-only, per
the doc. Staff lose it on mobile too. This is the intended end state only once
page-level `+` controls land; until then it is a live gap.

**For your judgement (not fixed — following "do not redesign"):**
- At **≤404px the header content overflows the viewport.** Measured at 390px:
  logo (56) + wordmark (274.6) + avatar (50) + 24px padding = 404.6px needed,
  so `document.scrollWidth` is 393 against a 390 viewport. The avatar is clipped
  by ~2.6px and loses its right padding. The marks *abut* the wordmark rather
  than overlapping it (measured gap exactly 0). **The mockup does exactly the
  same thing** — I reproduced it faithfully rather than "improving" it, but it
  is real on the most common phone width and you may not have seen it if you
  iterated on a 414/430px device.
- The cardstock sheet runs edge-to-edge with no `max-w-[120rem]` cap, unlike the
  old header. On an ultrawide display the wordmark centres across the full
  viewport. That is what the mockup does; flagging since it is a visible change.
- The mockup's drawer pops in instantly while the tab slides out over .28s (the
  drawer is conditionally mounted and has no transition). I did not touch the
  drawer, per the doc. A transition on it would make the pair read as one motion.
- Header drop shadow shipped as-is (`0 6px 18px rgba(24,38,32,.14)`), deferred
  for judgement against real scrolling content.

**Mockup defects worth fixing in `header-mockup.html` itself** (I did not edit
the reference): its inline `<script>` runs before `#scrim`, `#createModal`,
`#drawerTab`, `#drawer` and `#navScrim` exist in the DOM, so it throws
`Cannot read properties of null` and **none of the drawer or modal behaviour
works in the reference as checked in**. Only the avatar press physics run.
