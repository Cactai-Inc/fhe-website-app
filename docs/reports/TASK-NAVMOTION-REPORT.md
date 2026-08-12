# TASK-NAVMOTION — report

**Branch** `task/navmotion`, worktree `~/Downloads/claude-code-repo/wt-navmotion`.
**Files changed** — `src/components/app/AppLayout.tsx`, `src/components/app/AppHeader.tsx`,
`src/components/app/app-header.css`. Nothing else. `ClauseDocument.tsx` and
`src/components/ops/kit/DataTable.tsx` untouched.

**Branch point, corrected.** The order said "off `origin/main` (currently 3d6663b)".
`origin/main` had already moved to **f4b84d0** by the time this started — 3d6663b is now
five commits back, and one of the commits after it (800b352) is *this task's own
amendments*: §D2's tip box, §C0's off-canvas mechanism, and §H's asymmetric inset. Branching
at the named SHA would have built the superseded bounce. Branched off current `origin/main`
instead. Not pushed.

**Checks.** `npm run typecheck` 0 errors · `npx eslint .` 36 warnings, 0 errors — **identical
to the count on `origin/main`, measured, so this change adds none** (CLAUDE.md's "~26" is
stale) · `vite build` clean. All greps below are from `dist/assets/index-CzGee_m9.css`.

**No render was observed.** There is no staff browser session. Everything below is proven
from the built CSS, the source, the installed packages, or arithmetic. Everything visual is
marked **NOT VERIFIED** and collected in the checklist at the end.

---

## T1 — every value added or changed, grepped out of the built CSS

A class that compiles is not a class that emits. Each of these was pulled from the built
stylesheet after the change.

### §A / §B — the underline system

```
.decoration-gold-600{text-decoration-color:#ba9935}
.decoration-4{text-decoration-thickness:4px}
.decoration-2{text-decoration-thickness:2px}
.underline{text-decoration-line:underline}
.underline-offset-4{text-underline-offset:4px}
.text-green-900{--tw-text-opacity: 1;color:rgb(13 33 24 / var(--tw-text-opacity, 1))}
```

### §C — the drawer's motion

```
.duration-440{transition-duration:.44s}
.duration-320{transition-duration:.32s}
.ease-glide{transition-timing-function:cubic-bezier(.32,.72,0,1)}
.transition-transform{transition-property:transform;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}
.transition-opacity{transition-property:opacity;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}
.-translate-x-full{--tw-translate-x: -100%;transform:translate(var(--tw-translate-x),…)}
.translate-x-0{--tw-translate-x: 0px;transform:translate(var(--tw-translate-x),…)}
.opacity-0{opacity:0}
.opacity-100{opacity:1}
.pointer-events-none{pointer-events:none}
.focus\:outline-none:focus{outline:2px solid transparent;outline-offset:2px}
```

**One extra check this needed.** `transition-transform` and `transition-opacity` ship their
*own* `duration:.15s` and `cubic-bezier(.4,0,.2,1)`. `duration-440`/`ease-glide` only win if
they come later in the file. Byte offsets in the built CSS:

| utility | offset |
|---|---|
| `.transition-opacity{` | 75009 |
| `.transition-transform{` | 75259 |
| `.duration-320{` | 75501 |
| `.duration-440{` | 75540 |
| `.ease-glide{` | 75744 |

Property first, then duration, then easing. The overrides land.

### §F — the scrim

```
.bg-green-950\/30{background-color:#0a1a0f4d}
```

`4d` = 77/255 = 30%. `/30` is a built-in opacity step, so unlike `/64`, `/12` and `/8` it
needed no config entry — checked before use rather than after.

### §H — the alignment line

```
.pl-5{padding-left:1.25rem}     20px
.pr-3{padding-right:.75rem}     12px
.pl-11{padding-left:2.75rem}    44px
.px-3{padding-left:.75rem;padding-right:.75rem}
```

### §D — the caret and the tip (plain CSS, `theme()`-resolved)

```
@media (max-width: 1023.98px){
  button.oh-avatar{position:relative;padding-bottom:7px}
  button.oh-avatar:after{content:"";position:absolute;left:50%;bottom:6px;width:0;height:0;
    margin-left:-4px;border-left:4px solid transparent;border-right:4px solid transparent;
    border-top:5px solid #fdfcfa;pointer-events:none;
    transition:transform .32s cubic-bezier(.32,.72,0,1)}
  button.oh-avatar[aria-expanded=true]:after{transform:rotate(180deg)}
}
.oh-tip{position:absolute;top:calc(100% + 10px);right:0;z-index:1;padding:8px 12px;
  border-radius:10px;background:#143321;color:#fdfcfa;font-family:Inter,system-ui,sans-serif;
  font-size:13px;line-height:1.25;font-weight:500;white-space:nowrap;
  box-shadow:0 6px 18px #101c1638;pointer-events:none}
.oh-tip:after{content:"";position:absolute;bottom:100%;right:15px;border:6px solid transparent;
  border-bottom-color:#143321}
.oh-tip--pop{animation:oh-tip-pop .32s cubic-bezier(.32,.72,0,1) both}
.oh-tip--out{animation:oh-tip-fade .32s cubic-bezier(.32,.72,0,1) both}
@keyframes oh-tip-pop{0%{opacity:0;transform:translateY(-6px) scale(.86)}
  to{opacity:1;transform:translateY(0) scale(1)}}
@media (min-width: 1024px){.oh-tip{display:none}}
.oh-right{grid-column:3;display:flex;justify-content:flex-end;position:relative}
```

**No new duration or easing token was added.** `theme('transitionDuration.320')` resolved to
`.32s` and `theme('transitionTimingFunction.glide')` to `cubic-bezier(.32,.72,0,1)` — the
same declared values the Tailwind utilities emit, read from config rather than retyped. The
minifier rewrote `::after` to `:after` (equivalent).

### §G — the header sizing

```
@media (max-width: 600px){:root{--cs-hdr-h: 68px}…{padding-left:calc(14px + …)}
  .oh-w1{font-size:23px}.oh-w2{font-size:13px}}
@media (max-width: 400px){:root{--cs-hdr-h: 64px}…{padding-left:calc(10px + …)}
  .oh-w1{font-size:18px}.oh-w2{font-size:11px;letter-spacing:.26em;margin-right:-.26em}}
@media (max-height: 500px) and (orientation: landscape) and (pointer: coarse){
  :root{--cs-hdr-h: 56px}… .oh-w1{font-size:19px}.oh-w2{font-size:11px;letter-spacing:.24em;margin-right:-.24em}}
```

And the proof of the *removal* — a scan of every emitted rule mentioning `.oh-mono` or
`.oh-avatar` that sets `width` or `font-size` returns exactly two, both unscoped:

```
.oh-mono{width:42px;height:42px;…font-size:17px;…}
.oh-avatar{width:42px;height:42px;…font-size:20px;…}
```

No media block overrides either any more. **42px at every width, confirmed from the build.**

---

## A — the hover flicker

### The diagnosis was verified before it was implemented

The order named the mechanism and said to check it. Checked against the installed package,
not the docs:

```
$ node -e "console.log(require('tailwindcss/defaultTheme').transitionProperty.colors)"
color, background-color, border-color, text-decoration-color, fill, stroke
```

(tailwindcss 3.4.17, and the same string at `node_modules/tailwindcss/stubs/config.full.js:951`.
The order cited `lib/corePlugins.js:3445`; that line is the `textDecorationColor` *plugin*,
not the transition set — the claim is right, the citation pointed one file over.)

So `text-decoration-color` is inside `transition-colors`. In the idle state it was never
declared, so it computed to its initial value `currentcolor` = `text-green-800`. On hover
`text-decoration-line: underline` snapped on in one frame — it is not an animatable property
— painted at the *current* decoration colour, dark green, and then `text-decoration-color`
eased green-800 → gold-600 across the full 320ms. A dark line that becomes gold. **Mechanism
confirmed as described.**

### The fix

`decoration-gold-600` moved into the idle half of `NAV_ROW_IDLE`
([AppLayout.tsx:110](../../src/components/app/AppLayout.tsx#L110)). The *line* still toggles;
the colour it appears in is already right, so there is nothing to transition. Declaring a
decoration colour with no decoration line paints nothing, so the idle row is unchanged.
Duration untouched, `transition-colors` untouched — both were named as wrong fixes and both
would have been.

### Every call site that reads `NAV_ROW_IDLE`

One constant, so one edit fixes all of them — including the mobile half of the complaint.

| line | surface |
|---|---|
| 687 | `RailLink` — staff rail rows, member rail rows, **and every mobile-drawer row** |
| 754 | `PresenceLink` — My Stable / My Saved Items |
| 775 | `AccountNavLink` — Account, rail + drawer |
| 842 | `CommunityNav`, collapsed 56px strip |
| 955 | `CommunityNav` sublinks — the feed filters |
| 1078 | `NavFooter` — App tour |
| 1085 | `NavFooter` — Sign out |
| 1746 | staff rail "Add New" |
| 1852 | staff rail collapse toggle |

### The second copy, and the sweep

**Second copy fixed** — [AppLayout.tsx:891](../../src/components/app/AppLayout.tsx#L891),
`CommunityNav`'s parent row, same defect in the `group-hover:` form. It is the top row of
every nav surface in the app.

Sweep of the whole tree for `decoration-` hover without a matching idle declaration
(token-level, so lines carrying both a `decoration-` and an `underline-offset` are not
filtered out — that mistake hid these on the first pass):

| site | state | action |
|---|---|---|
| `AppLayout.tsx:110` `NAV_ROW_IDLE` | had the defect | **fixed** |
| `AppLayout.tsx:891` `CommunityNav` | had the defect | **fixed** |
| `ContractSubheader.tsx:261` | **has the defect** — `md:hover:underline md:hover:decoration-gold-600` with no idle colour, and its `SUBHEADER_BTN` base carries `transition-colors`. Its own comment says it "reuses UIO-013's exact underline declaration (AppLayout.tsx's `NAV_ROW_IDLE`)" — it inherited the bug with it. | **NOT FIXED — outside this task's file ownership.** One-token fix: add `decoration-gold-600` to the idle branch. |
| `ExplainTip.tsx:145` | not a candidate — `decoration-gold-500/60` is declared in the *base* state and the underline is permanent, so there is no hover transition to be wrong. | none |

### The growing underline (§A, optional)

**Not built, and reported per the order's instruction.** It cannot be done with
`text-decoration`; it needs a `background-image` linear-gradient with a `background-size`
transition, which means every nav label span becomes a positioned element with its own
background — across nine row components, three of which also carry badges and one of which
splits its background from its ink already. That is not a contained change. The flicker fix
is the deliverable and it is done.

---

## B — the selected state is an underline

`NAV_ROW_ACTIVE` ([AppLayout.tsx:158](../../src/components/app/AppLayout.tsx#L158)):

```diff
- bg-navfill/80 text-cream-25 font-medium
+ text-green-900 font-medium underline decoration-gold-600 decoration-4 underline-offset-4 transition-colors duration-320 ease-glide
```

**§B1 — selected is not identical to hover.** hover = gold rule, `decoration-2`, weight
unchanged. selected = gold rule, `decoration-4`, `font-medium`, persistent. `decoration-4` is
the next step on Tailwind's own scale (0/1/2/4/8) — no arbitrary value. `underline-offset-4`
is shared with hover deliberately, so the rule sits on one baseline and hovering a selected
row thickens it *in place* rather than moving it.

### §B2 — the trap, and it had THREE locations, not one

`text-cream-25` is `#fdfcfa`. `NAV_PANEL` is `bg-cream-25` — the same colour. Removing the
fill without moving the ink renders **1.00:1** (computed, not estimated). Every location was
moved in the same edit:

1. `NAV_ROW_ACTIVE` — the label. Now `text-green-900`.
2. `NAV_ICON_ACTIVE` ([:163](../../src/components/app/AppLayout.tsx#L163)) — was bare
   `text-cream-25`. Now `text-green-900` (idle icons are `green-800/70`, so selected is both
   darker *and* full-strength — the same direction the label moves).
3. **`CommunityNav`'s chevron toggle** ([:938](../../src/components/app/AppLayout.tsx#L938))
   — the easiest to miss. Its selected branch was `text-cream-25 hover:bg-cream-25/10`, a
   cream chevron visible only against the pill. It would have vanished from the selected row
   while staying perfectly visible on every unselected one. Now `text-green-900`. The paired
   `hover:bg-cream-25/10` was **removed rather than re-tuned** — it was a *light* wash
   designed to read on a *dark* pill, so on the panel it is cream-on-cream too, and the idle
   branch beside it carries no hover treatment at all (UIO-013). Removing it makes the two
   branches agree instead of inventing a fill nobody asked for.

### Rendered contrast, against `#fdfcfa`

Computed with the WCAG relative-luminance formula. The two figures that already exist in the
repo (`13.43` in tailwind.config.js's cream-25 note, `16.41` in this file's group-heading
note) reproduce exactly, which is what validates the rest.

| element | colour | ratio | floor |
|---|---|---|---|
| **selected label** | green-900 `#0d2118` | **16.41:1** | 4.5 ✓ |
| idle label | green-800 `#143321` | 13.43:1 | 4.5 ✓ |
| **selected icon** | green-900 `#0d2118` | **16.41:1** | 3.0 ✓ |
| idle icon | green-800/70 → `#5a6f62` | 5.27:1 | 3.0 ✓ |
| *what §B2 would have shipped* | cream-25 on cream-25 | *1.00:1* | — |

**The gold rule itself measures 2.66:1**, which is under the 3:1 non-text floor. Stated
rather than silently fixed, for two reasons: it is the identical gold-600-on-cream-25 pair
the **hover** underline has carried since UIO-013 and is not introduced here (this file's own
note already records 2.66:1 for that pair, from the other direction), and selection is
redundantly coded — darker ink, `font-medium`, and `aria-current="page"` all carry it, so the
rule is not the sole means of conveying state. **If you want the rule itself to clear 3:1:
`decoration-gold-800` measures 5.58:1 and is a one-token change in that constant** — but it
makes selected a different *colour* from hover rather than a stronger version of it, which is
the thing §B1 rules out. Your call; not taken here.

### §B3 — `aria-current`

Already correct everywhere, verified rather than assumed. `RailLink` and `MenuLink` use
`NavLink`, which defaults `aria-current="page"` when active — confirmed in the installed
router (`react-router/dist/production/chunk-M7NGGUU6.mjs:10580`, `"aria-current":
ariaCurrentProp = "page"`, applied at `:10616`). `PresenceLink`, `AccountNavLink` and both
`CommunityNav` branches set it explicitly. Nothing to add.

### One consequence flagged, not papered over

**In the collapsed 56px staff rail a row is an icon and nothing else, so there is no text for
an underline to sit under.** The selected indicator there is now the icon's tone alone
(green-800/70 → green-900 — a 3× luminance-contrast step, so it is a real difference, not
nothing) plus `aria-current`. That rail is the one surface where the fill was doing work the
underline cannot take over. No fill was reintroduced and no new treatment was invented; if it
reads too quietly in use, that is a decision to make with it on screen.

---

## C — the drawer slides

**Root cause confirmed as the order describes it, and it was not a missing transition.** The
whole block was `{mobileNavOpen && ( … )}` — scrim and panel *unmounted* when closed. A CSS
transition cannot run on an element that does not exist at the start of it, and on close
React removed the node before any exit could play. Both directions were instant by
construction.

### What was built

Three states ([AppLayout.tsx:1180-1215](../../src/components/app/AppLayout.tsx#L1180)):
`mobileNavOpen` (the intent, still the only thing the avatar and every close path touch),
`drawerMounted` (in the DOM), `drawerShown` (at the open position). Opening mounts at
`-translate-x-full`, waits **two** animation frames, then flips to `translate-x-0`. Two, not
one: flipping on the mount frame collapses both values into a single style recalculation and
there is nothing to interpolate. Closing flips back and unmounts on a 320ms timer.

**Mechanism chosen: unmount-after-exit**, of the two the order allows. The reason is specific
to this task — with no browser session, it is the only one whose inertness claim is provable
by *reading*: closed, there is no drawer in the DOM at all.

| | value | source |
|---|---|---|
| panel in | `duration-440 ease-glide` | declared in tailwind.config.js as *"440 for a panel crossing the screen"* — **and used nowhere in `src/` until this line.** It was written for this. |
| panel out | `duration-320 ease-glide` | quicker than the entrance, does not exceed it |
| scrim | `duration-320`, fade, both ways | §C1 |

No new duration or easing token. All four already existed.

### Closed is inert — the proof

- **At rest: the node is not rendered.** `{drawerMounted && ( … )}`, and `drawerMounted` is
  false whenever the drawer is closed and its exit has finished. Nothing inside it is in the
  tab order, announced, or hit-testable, because nothing inside it exists. **This is the
  proof that "with the drawer closed, nothing inside it is reachable by Tab" — it is a fact
  about the render tree, not an observation.** *(The behaviour on screen is NOT VERIFIED; the
  absence from the DOM is not.)*
- **During the ~320ms exit**, the only window where the node exists but is not open: the
  wrapper gets `pointer-events-none` and the `inert` attribute. `inert` is set imperatively
  through a ref because React 18.3.1 has no `inert` prop (React 19 added it) — the app is on
  18.3.1, checked.
- Focus is returned to the opener **before** `inert` is applied, so nothing is ever blurred
  by going inert. This falls out of React's effect ordering: cleanups for a commit run before
  effects, and the focus-return lives in the cleanup of the `[mobileNavOpen]` effect while
  `setDrawerShown(false)` lives in an effect body.
- `pointer-events-none` is applied **only while not shown**. While open the wrapper stays
  hit-testable, which is what keeps §F's job 2 (blocking taps to the content behind) working
  independently of the tint.

### §C0 — recorded, as asked

The owner's mechanism is right, and the second reason is now written into the code comment at
[AppLayout.tsx:249](../../src/components/app/AppLayout.tsx#L249) so it is not rediscovered:
browsers do not create scrollable overflow toward the inline-start edge, so content at
negative `x` in an LTR document is unreachable by scrolling — while the same panel parked on
the **right** would extend the document's scrollable width, which is `TASK-FRAMESCROLL`'s bug
arriving from the other direction while that thread removes it. **This is a second,
independent reason the drawer belongs on the left (§E) that §E did not make.** In this build
nothing is parked off-canvas at rest at all, so the hazard is closed twice over.

### §C2 — the scrim's entrance, one line to see

`SCRIM_ENTERS_AS_FADE` ([:299](../../src/components/app/AppLayout.tsx#L299)). `true` = the
room dims. `false` = the scrim slides in from the left with the panel. Both paths are built,
it is a constant a developer flips, and there is no prop and no setting. Built as a fade
because a scrim is a full-viewport layer, so sliding it is a wipe across the whole screen —
it reads as a second panel arriving and pulls the eye off the nav that just opened.

### §C3 — reduced motion

Under `prefers-reduced-motion` the drawer appears and disappears with **no transform and no
fade**, instantly — the current behaviour, preserved deliberately rather than shortened. Both
the paint-a-frame-first delay and the wait-for-the-exit timer are skipped outright via
`usePrefersReducedMotion()` (`src/lib/hooks.ts:7`). `src/index.css:99-104` already forces
`transition-duration: 0.001ms !important` globally under that query, which handles the CSS
half; this is the JS half, which that rule cannot reach.

---

## D — the avatar looks like a menu

### D1 — the permanent caret

An 8×5px CSS triangle below the glyph inside the disc, **mobile only, in a media query** —
the same 1024px rule and the same reasoning as the file's existing display split, not
`lg:hidden`, so the outcome cannot depend on stylesheet injection order.

**It takes the glyph's own ink (`#fdfcfa`), which is why it needs no ramp of its own.** The
order says extend the documented white-overlay ramp, do not replace it. That ramp moves the
*background* (14% rest / 7% hover / 0% pressed) and never the ink, so a caret in cream rides
every step of it for free and carries the ramp's recorded contrasts unchanged:

| state | rendered fill | cream-25 on it |
|---|---|---|
| rest | `#355040` | 8.63:1 |
| hover | `#244131` | 10.92:1 |
| pressed / open | `#143321` | 13.43:1 |

*(the file records 8.68:1 for the rest state; 8.63 is what the composite recomputes to — a
rounding step, not a disagreement.)*

**Geometry**, so it is not re-derived later. The mark is 42px at every width now (§G), so
this is one calculation and not four. `padding-bottom: 7px` on a border-box 42px button
leaves a 33px content box, so `place-items: center` lands the glyph **3.5px higher** and
frees the bottom of the disc; the mark does not change size and the protected font-size ratio
is untouched. At the caret's height the disc is still 33.8px across, so 8px of triangle
clears the ring by ~13px a side.

**It rotates on `aria-expanded`.** This is **not** an answer to UIO-006's open-state question
and does not touch it: that one is about the *fill*, is explicitly left for the owner to see
rendered, and the fill rules are unchanged. A caret pointing down at a menu that is already
open would be a defect on arrival, not a deferred decision.

### D2 — the one-time tip

Lives entirely in `AppHeader.tsx`. Text in one constant: `MENU_TIP_TEXT = 'Click for menu'`.

- **It points at the avatar.** `.oh-right` became the containing block, so `right: 0` is the
  avatar's own right edge; the mark is 42px, so a 12px arrow centred under the mark's centre
  is 21 − 6 = **15px** in. Measured off the control, not floated near it.
- **It pops.** `scale(.86) → scale(1)` with `translateY(-6px) → 0` over 320ms on `ease-glide`
  — the house curve, read through `theme()` rather than retyped. Entrance short and lively.
- **Dwell 3.5s**, timed on the dwell and not the whole animation; the 320ms pop and the 320ms
  fade sit either side of it.
- **First mobile visit only.** Marker: `localStorage['navMenuTip.seen']`, **stamped on show,
  not on dismiss** — a member who backgrounds the app mid-dwell has still been shown it.
  *This is a judgement call and here is the reasoning:* the app has two first-run mechanisms.
  The tour's is a server-side per-form-factor column (`profiles.tour_seen_mobile_at` via
  `markTourSeen()`); the localStorage flags (`communityNav.expanded`, `staffRail.pinned`) are
  what this file already uses. The tour's shape needs a migration and a column for a header
  hint, which is a database change outside this task's file ownership, and localStorage is
  per-device — the correct grain for "first *mobile* visit", since the same account on a
  phone and on a laptop are two different discoveries. **If you want it to survive a cleared
  browser, the swap is `markTourSeen`'s shape and one column.** Wrapped in try/catch so
  private mode is a no-tip, not a crash.
- **Any interaction dismisses it**: `pointerdown` (covers touch and mouse), `scroll`,
  `focusin`, `keydown` — all in the **capture** phase, because the app scrolls inside
  `overflow-y-auto` containers rather than on `window`, so a bubble-phase scroll listener
  would miss most real scrolling. Opening the menu dismisses it. It never returns.
- **Under `prefers-reduced-motion` the box still appears, without the pop** — deliberately the
  opposite of §C3, because it is information, not decoration, and suppressing it would
  withhold the one thing that explains the control.
- **Never at `lg+`** — twice: `AppHeader` refuses to start the timers above 1024px, and
  `@media (min-width: 1024px){.oh-tip{display:none}}` is the half that cannot lose to source
  order.
- **No layout shift**: absolutely positioned, out of flow, animating `transform`/`opacity`
  only. `--cs-hdr-h` never moves.
- **Accessibility**: `role="status"` (polite), `pointer-events: none`, no focusable content,
  no focus steal, no trap.

**The clipping question — verified, not assumed.** The order asked specifically. Grepped the
built stylesheet: `.oh-hdr{position:sticky;top:0;z-index:40;height:var(--cs-hdr-h);display:grid;…}`
— **it declares no `overflow` property at all**, so it defaults to `visible` and a box hanging
below its bottom edge escapes. `.oh-right` likewise. No `overflow:hidden` on html/body/#root
in `index.css`. The portal this file records being needed once before was for a rail with an
explicit `overflow-x-hidden`; that condition does not exist here, so no portal is used.
*(That the box is actually visible on a phone is NOT VERIFIED.)*

---

## E — the drawer moved left

```diff
- absolute inset-y-0 ${isSuperAdmin ? 'left-0' : 'right-0'} w-72 …
+ absolute inset-y-0 left-0 w-72 …
```

**The conditional is deleted, not defaulted.** Superadmin already opened left, so the app was
giving three answers across three surfaces — desktop rail left, superadmin drawer left,
tenant drawer right. One behaviour now, from one code path.

**The accepted cost, recorded in the code so it is not rediscovered as a surprise:** on a
large phone the links are a reach across from the avatar. The rows are full-width down the
whole panel, so the lower ones stay thumb-reachable; the top-left ones are a longer reach
than they were. Not re-litigated — if the rendered result changes your mind, the mechanism is
one class.

Second independent reason recorded under §C0 above.

---

## F — the scrim: kept, lightened, faded

**The direct answer to the question asked: no accessibility rule requires a scrim.** WCAG
mandates none and nothing forbids removing it. But it is doing four jobs and only the fourth
is decorative — it is the close target (`onClick={closeMobileNav}` is on the scrim div), it
blocks taps to the page behind, it is the sighted equivalent of the `aria-modal="true"` this
drawer declares, and it is the only figure-ground separation between a `bg-cream-25` panel
(`#fdfcfa`) and a cream page, which are ~1.0:1 apart.

`bg-green-950/45` → **`bg-green-950/30`**, behind `SCRIM_TINT`
([:293](../../src/components/app/AppLayout.tsx#L293)), and it now fades over `duration-320`
instead of arriving whole. Rendered over the cream page: `#8e948d` → `#b2b5af`.

**To see it with no scrim at all: set `SCRIM_TINT` to `'bg-green-950/0'`.** One line, and the
element stays — so tap-outside-to-close and the tap-blocking both survive the experiment.
The div is not deleted. Removal is the second look.

### F1 — the `aria-modal` gap, closed

The drawer declared `role="dialog" aria-modal="true"` with **no focus management of any
kind** — Escape closed it, a route change closed it, that was all. That combination tells a
screen reader the rest of the page is inert when it is not.

- **Focus in on open** — the `<nav>` itself takes it (`tabIndex={-1}`), not its first link:
  landing on the container announces the dialog without announcing "Community Feed, link" as
  though the user had chosen it. Fired on `drawerShown`, not on mount, because during the
  entrance frames the wrapper is still `inert` and focusing inside an inert subtree does
  nothing.
- **Trapped** — Tab from the last focusable wraps to the first, Shift+Tab from the first (or
  from the container) wraps to the last. Nothing else is intercepted; the existing Escape
  handler is untouched.
- **Returned on close** — to whatever had focus when the drawer opened, captured rather than
  hardcoded so the tenant's avatar and the superadmin's own nav button both get it from one
  path. Guarded: if focus has already moved somewhere outside the drawer, it is left alone —
  yanking it back would be this same bug pointing the other way.
- **`aria-controls="app-nav-drawer"` added to the superadmin mobile-nav button** — it opens
  the same drawer the tenant's avatar does, so it should say so, and it is what the focus
  return queries for as a fallback.

---

## G — the header: marks stay, the name shrinks

| viewport | `--cs-hdr-h` | `.oh-mono` / `.oh-avatar` | `.oh-w1` | `.oh-w2` |
|---|---|---|---|---|
| default | 76px | **42px** (17 / 20) | 26px | 14px |
| ≤600px | 68px | **42px** ← *was 38px* | **23px** ← *was 26px* | **13px** ← *was 14px* |
| ≤400px | 64px | **42px** ← *was 36px* | **18px** ← *was 21px* | **11px** ← *was 12px* |
| landscape | 56px | **42px** ← *was 34px* | 19px | 11px |

**The 401–600px band was the bug** and it is where the wordmark now moves, having previously
not moved at all.

### The recorded reasons that changed, and why they no longer apply

- *"the marks step down with [`--cs-hdr-h`] so the proportion holds"* — a real decision, not
  drift. **Superseded, not corrected:** the owner has measured the result and prefers constant
  marks to a constant mark/header ratio.
- *"`.oh-mono` is UNCHANGED — the owner corrected an earlier version of this order that
  touched it"* — **honoured.** Holding it at 42px is what is now being asked for; its
  font-size ratio is not changed, and with the size held its 17px holds with it.
- *"the avatar's font-size is deliberately a larger fraction of its mark"* — **preserved at
  the held size**, 20/42 = 47.6% against the monogram's 17/42 = 40.5%. Removing the old
  UIO-006 splits *restores* this rather than breaking it: the landscape block had collapsed
  both marks to a **shared** 14px, which flattened the very split the other two blocks
  document.
- *"negative right margins equal to their own letter-spacing"* — **letter-spacing was not
  changed at any tier, so no margin needed changing.** The margins are in `em`, so they track
  font-size automatically. The pair moves together; it did not have to move.

### The width budget, so the next tier is chosen by arithmetic

The grid is `1fr auto 1fr` and the side items are 42px `flex: none`, so the 1fr columns
cannot compress below 42px: the wordmark's first line has exactly
`viewport − padding − 84px` before it starts pushing the marks apart. "FRENCH HERITAGE"
measures **10.48em** at .06em tracking (summed from Libre Caslon Text's uppercase advances;
this file's own earlier note recorded ~200px at 19px, i.e. 10.53em — the two agree to a
rounding step, which is why the figure is trusted).

| tier | worst-case width | budget | line 1 | slack |
|---|---|---|---|---|
| ≤600px | 401px | 289px | 23 × 10.48 = 241px | **48px** (24 a side) |
| ≤400px | **320px** | 216px | 18 × 10.48 = 189px | **27px** (13.7 a side) |
| *≤400px, before this change* | *320px* | *228px* | *21 × 10.48 = 220px* | *8px (4 a side)* ← the collision |
| landscape | ~850px | ~700px | 19 × 10.48 = 199px | ~500px |

**320px holds with 27px to spare, up from 8px.** Note the two faces are not metrically
identical — macOS renders Big Caslon, everything else the hosted Libre Caslon Text — which is
why the tiers are chosen with room rather than to the pixel.

**Vertical:** 42px in 76 / 68 / 64 / 56 leaves 17 / 13 / 11 / **7**px above and below.
**The landscape tier is the tight one and the order named it.** 7px above, 6px below (the 1px
border is inside the border-box). It clears arithmetically — it does not touch the edges —
but it is the smallest clearance in the file, so it is item 9 on the checklist. **If it reads
cramped, the sanctioned fix is to raise that one tier's height, not to shrink the mark back.**
The wordmark stack is 31.8px there, well inside; that tier is height-constrained, not
width-constrained, so shrinking the name further would answer a question nobody asked.

---

## H — the asymmetric left inset

### H1 — UIO-016 is superseded on exactly two points

`docs/ui-orders/UIO-016-nav-row-indent.md` shipped 2026-08-10 and solved this same complaint
**symmetrically** (`<nav>` `p-2` → `p-3`, no row touched). Evenly is not what is wanted now.
**Recorded here so a later thread does not revert this citing that order:**

- ~~*"Do not change any individual row's `px-3`"*~~ → **overridden.** The row's left padding
  is exactly what changes.
- ~~*"Do not touch the mobile drawer"*~~ → **overridden.** The drawer gets it too; reach on a
  left-hand drawer is half the reason.
- *"Do not change `w-60`"* → **still stands, untouched.**
- *"Do not touch the collapsed state's `justify-center`"* → **still stands**, and H4 is that
  same rule enforced.

### H3 — one constant, and everything on the edge reads from it

[AppLayout.tsx:221-227](../../src/components/app/AppLayout.tsx#L221):

```
NAV_INSET_L        pl-5    20px   →  icon starts 12px (nav p-3) + 20px = 32px
NAV_INSET_R        pr-3    12px   unchanged — the asymmetry IS the point
NAV_INSET_ROW      pl-5 pr-3
NAV_INSET_CHILD    pl-11   44px   = 20px origin + the 24px step pl-9 had over px-3
NAV_INSET_COLLAPSED px-3          the §H4 exemption, named so it is visible at each site
```

**Resulting icon offset: 32px, up from 24px.**

The child indent is *derived arithmetically but written as a literal*, and that is forced:
Tailwind's content scanner reads source text, so a class assembled at runtime emits no rule
at all — T1's failure mode arriving by another road. The arithmetic lives in the comment; the
two are one decision written twice, exactly like `.oh-w1`'s letter-spacing/margin pair.

**Full call-site list — derived by grep, not from the order's starting list:**

| line | element | treatment |
|---|---|---|
| 686 | `RailLink` (rail rows, drawer rows) | `open ? NAV_INSET_ROW : NAV_INSET_COLLAPSED` |
| 753 | `PresenceLink` | `NAV_INSET_ROW` (never collapses) |
| 774 | `AccountNavLink` | gated on `open` |
| 823 | `CommunityNav` signature | defaults to the shared constants |
| 842 | `CommunityNav` collapsed strip | `NAV_INSET_COLLAPSED` |
| 894 | `CommunityNav` parent Link | `rowInsetClass` |
| 954 | `CommunityNav` sublinks | `indentClass` + `NAV_INSET_R` |
| 1078, 1085 | `NavFooter` — App tour, Sign out | gated on `open` |
| 1764 | superadmin "Platform" heading | `NAV_INSET_ROW` |
| 1776, 1805 | the two collapsible group headings | `NAV_INSET_ROW` |
| 1988 | the mobile drawer's group headings | `NAV_INSET_ROW` |
| 1130, 1645, 1787 | the three `<CommunityNav />` renders | dropped their `indentClass="pl-9"` and take the shared default |

**Rows, group headings and indented children all move together.** Nine row call sites, four
heading sites, five indent sites.

### Deliberately left symmetric — each one annotated in the code

| line | element | why |
|---|---|---|
| 1746 | staff rail "Add New" | `justify-center` in **both** rail states — not on the left line at all. An asymmetric inset would not move it right, it would move its centred icon+label group 4px off the centre its own comment records bringing it onto. |
| 1852 | staff rail collapse toggle | `justify-center` inside a right-justified wrapper — it sits on the rail's **right** edge. |
| 1516, 1532 | `accountMenu`'s two `CommunityNav` renders | **Out of scope, and it would have broken something.** A new `rowInsetClass="px-3"` prop pins today's geometry: inside its `px-1` wrapper, `px-3` lands these rows at 16px — dead on the `px-4` line its sibling `MenuLink`s sit on. Taking the nav's 20px inset would have silently knocked this row 8px out of line with the menu around it. |

**The `px-4` rows of the desktop avatar dropdown (`accountMenu`, ~1380–1460) were left
completely alone**, as instructed — it is a separate floating surface with its own metrics.

### H4 — the collapsed rail, and how it is gated

Every row that can collapse branches on its own `open` / `staffRailPinned` and takes
`NAV_INSET_COLLAPSED` (`px-3`) when it does; `CommunityNav`'s collapsed branch is a separate
early return that is symmetric by construction. **Left and right padding stay equal at 12px in
the 56px strip, so `justify-center` still centres on the row's centre line — the icons are
still on one vertical line, and nothing about that geometry changed.** *(Confirmed by
arithmetic and by reading every branch; NOT VERIFIED on screen.)*

### H5 — the labels still fit

Narrowest expanded surface is the **240px rail** (the drawer is `w-72`/`max-w-[85vw]` = 272px
at 320px, wider). Inner 216px − `pl-5`+`pr-3` (32px) = 184px content, − icon 18px − `gap-3`
12px = **154px for a label**; badged rows lose 32px more → 122px.

| longest labels | measured at 13.5px Inter | budget |
|---|---|---|
| "My Saved Items" | ~98px | 154px ✓ |
| "Payment review" | ~98px | 154px ✓ |
| **"Community Feed"** | ~104px | **120px** ✓ — the tightest in the tree, because its row also carries the chevron toggle (30px) and the parent's `pr-1` |
| "Dashboard" (badged) | ~66px | 122px ✓ |
| "Discussions" (sublink, 13px, no icon) | ~73px | 160px ✓ |

Nothing wraps, truncates or overflows. The inset costs 8px of label; the tightest row keeps
16px of margin. *(Measured from Inter's advance widths, not rendered — NOT VERIFIED.)*

---

## Nothing was deleted

The scrim div, the superadmin close button, `bg-navfill` (still used at 12 sites on other
surfaces), `glass.nav`, `MANAGE_NAV`, the `pl-9` values on the out-of-scope dropdown, and
every historical comment in all three files are intact. The two behaviours that were removed —
`bg-navfill/80` from the selected row and `hover:bg-cream-25/10` from the selected chevron —
are removals of things §B *is*, with the reasoning recorded at each site, and both are behind
named constants that restore in one line.

## Reported, not fixed

1. **`ContractSubheader.tsx:261`** carries the §A flicker — it copied `NAV_ROW_IDLE`'s
   declaration and inherited the bug. Outside this task's file ownership. One-token fix.
2. **The gold rule measures 2.66:1** against the panel — pre-existing from UIO-013's hover,
   now also the selected indicator. `decoration-gold-800` (5.58:1) is the one-token
   alternative; not taken, see §B.
3. **The collapsed 56px rail's selected state is icon tone only** — the underline has no text
   to sit under there. See §B.
4. **UIO-006's open-state question is still open.** The caret rotates; the fill ramp is
   untouched, exactly as that file asks.

---

# NOT VERIFIED — everything visual

No staff browser session exists and none was used. **No animation was watched.** These are
proven: the built CSS emits every class and rule quoted above; the cascade order lets the
duration/easing overrides win; the contrast arithmetic; the mount/unmount logic and therefore
the closed drawer's absence from the DOM; the label and header width budgets; typecheck, lint
and build. **These are not:** how any of it looks or moves on a real screen.

## Checklist for the owner — in this order

**On a phone (or DevTools device mode), portrait:**

1. **376–600px wide.** The logo mark and the avatar should both be **42px** — the same size
   they are on desktop — and the name should be visibly **smaller** than it was, with clear
   air between it and both marks. This is the band the whole of §G is about.
2. **320px wide** (iPhone SE / "Galaxy Fold" preset). Nothing should collide: the name should
   still be on two lines, on one line each, with ~14px of gap to each mark. If anything
   touches, that is `.oh-w1`'s `font-size` in the `max-width: 400px` block.
3. **Look at the avatar without touching it.** There should be a small cream triangle beneath
   the letter, inside the disc. Does the letter still look centred with it there? *(It was
   raised 3.5px to make room.)*
4. **First load on a phone you have not used before** (or clear `localStorage` key
   `navMenuTip.seen` and reload). A green box saying **"Click for menu"** should pop in below
   the avatar with a little scale-and-settle, point at the avatar with a small arrow, sit for
   ~3.5 seconds, and fade out on its own. It must not push the header or anything else
   around, and it must not be cut off by the header's bottom edge. Tapping, scrolling or
   opening the menu should kill it instantly. **It should never come back.**
5. **Tap the avatar.** The drawer should slide in **from the left** over ~0.44s, unhurried,
   and the background should **dim as it arrives** rather than snapping dark. The caret under
   the avatar should flip to point up.
6. **Tap the dimmed area to close.** The panel should slide back out — noticeably quicker than
   it came in (~0.32s) — and the dim should fade out with it. Neither should vanish.
7. **Hover a nav row** (needs a mouse — plug one in, or use DevTools device mode with a
   cursor). The gold underline should appear **gold immediately**. There must be no dark green
   first frame. Check this in the drawer too — it is the same constant, so if one is right
   both are.
8. **Look at the page you are on.** Its nav row should have **no green fill** — a thicker gold
   underline, slightly bolder text, and a darker icon instead. Confirm you can read it easily.
9. **Rotate to landscape.** The header gets short (56px) and the marks stay 42px. **Confirm
   they are not touching the top or bottom edge.** ~7px of air is expected. If it looks
   pinched, say so — the fix is to raise that one tier's height, not to shrink the marks.

**On desktop:**

10. **Nav row contents should sit further right** — icons ~32px from the panel's left edge,
    up from 24px. Group headings ("MANAGEMENT", "PEOPLE") must line up with the labels
    beneath them, and the indented Community Feed filters must still read as one step in.
    They should all be on the same alignment line as each other.
11. **Collapse the staff rail** (the toggle at its foot). **The icons in the 56px strip must
    still be on one vertical centre line** — this is the thing asymmetric padding would break
    and the one it was gated to protect.
12. **Keyboard, on a narrow window (<1024px).** Tab through the page with the drawer
    **closed** — you must never land on a hidden menu item. Open the drawer with the avatar,
    Tab through it — focus should cycle inside and not escape to the page. Press Escape —
    focus should come back to the avatar button.
13. **Optional, one line each.** To see the scrim slide instead of fade, set
    `SCRIM_ENTERS_AS_FADE = false`. To see it with no tint, set `SCRIM_TINT` to
    `'bg-green-950/0'`. To make the selected underline itself clear the 3:1 contrast floor,
    change `decoration-gold-600` to `decoration-gold-800` in `NAV_ROW_ACTIVE`.
