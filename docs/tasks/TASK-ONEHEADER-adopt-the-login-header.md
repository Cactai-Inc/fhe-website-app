# TASK ONEHEADER — one header sitewide, adopted from the login screen

Owner, 2026-08-08:

> "The green header is cool and I love it but it's got to go. We can save it for another time
> when we can colour-match the entire site to it. Let's use the header from the login screen —
> it's nice. It won't change on login any more, which is slightly jarring as much as it is
> confirmation you are not outside the wire any more, but at least then the colours will all
> match again."

**The cardstock header is being shelved, not deleted.** It may return when the site is
colour-matched to it.

---

## What the login header actually is

`src/components/layout/Header.tsx` — the public site header. Two states:

| state | surface |
|---|---|
| at top | `bg-transparent border-b border-transparent` |
| scrolled | `bg-green-900/10 backdrop-blur-md border-b border-gold-600/25 shadow-sm shadow-green-950/10` |

It also **minifies on scroll** — `py-6 sm:py-7` → `py-3`, roughly 92px → 60px, with the logo
and wordmark shrinking together.

## The part that makes this bigger than a surface swap

**The app header's wordmark is DEBOSSED RELIEF, and relief cannot survive the change.**

`header-cardstock.css` sets `color: #293a37` with layered `text-shadow` that carves the
letters *into* a photographic stock texture (`url('/header-stock.jpg')`, `background-size:
cover`). The same technique renders the `FH` monogram and the avatar well.

Relief needs a **mid-tone surface to carve into**. On transparent glass over arbitrary page
content there is nothing to carve — the highlight and shadow layers have no material to sit
in, and the wordmark will read as muddy dark text with a halo.

**So this task replaces the wordmark, monogram and avatar treatments as well as the
background.** That is the relief work tuned over several sessions (the "5c" shadow values,
the avatar's press depth, the mobile-size relief threshold). It does not come along.
Budget for re-deciding how the wordmark looks on glass, not for porting values.

## Do not break these

- **`--cs-hdr-h`** (`:root`, currently `80px`, with 86/83 breakpoint overrides) is read by:
  the member rail, the staff rail, the contract subheader, and the drawer tab
  (`top: calc(var(--cs-hdr-h) + 24px)`). **Keep the variable and keep it accurate.** If the
  header minifies on scroll, the variable must track the *current* height or the sticky
  offsets will be wrong in one state.
- **NO MINIFY — decided by the owner, 2026-08-08.** The public site shrinks its header on
  scroll; the app header does **not**. It keeps a fixed height. A header that changes height
  while you scroll also moves every sticky offset beneath it — both rails, the contract
  subheader — and `--cs-hdr-h` would have to track a moving value. Fixed height, one value.
- **The header is where the avatar and monogram live** in the app. The public header carries
  site nav and a CTA instead. **Do not import the public header's contents** — adopt its
  *material*, keep the app's own contents.

## Related, already known

- **The mobile wordmark is faint** (`TASK-MOBILEPASS` H1) and the **monogram is unfilled**
  (H2). Both are relief-treatment problems. **If this task lands first, both may dissolve** —
  do not fix them on the cardstock header only to delete it.
- The owner has a **third header item that was cut off mid-sentence** (H3). Ask.
- `.cs-tab` in `header-cardstock.css` is already dead (the create tab moved into the rail,
  `42bbff2`). Delete it with the rest.

## Verification

1. One header on every route, signed in or out. **No swap at sign-in.**
2. Sticky offsets correct in every state: both rails, contract subheader, drawer tab.
3. Wordmark legible on **mobile**, on a real device — the current one is not, and the whole
   point of this change is colour coherence.
4. Header renders over light and dark page content without the wordmark losing contrast.
5. Typecheck, lint, build clean.
6. **Verify every arbitrary Tailwind value emits into the built CSS.** Two silent
   non-emissions happened on 2026-08-08 (`bg-cream-100/[0.92]` produced no rule at all).
   Grep `dist/assets/*.css` for each new utility; do not assume.

## Constraints

- Own git worktree off `origin/main`, at `~/Downloads/claude-code-repo/wt-oneheader`.
  **Never `~/Desktop`.**
- **`AppLayout.tsx`, `CardstockHeader.tsx` and `header-cardstock.css` are shared with
  `TASK-MOBILEPASS`.** Only one may hold them. Coordinate with the orchestrator first.
- Shelve the cardstock header — keep the file and the asset, do not delete them.
- `ClauseDocument.tsx` is FROZEN.

## Reporting

`docs/reports/TASK-ONEHEADER-REPORT.md`, with mobile screenshots and the emitted-CSS check
for every new utility.

---

## OWNER DECISIONS — 2026-08-08. These are settled; build to them.

> "Lose the glass, and just change the header and the nav resize, icon change, lose the tab
> and use a header button once the new one lands. Avatar is the button again. But the mono
> menu stays."

### 1. The glass is dropped — nav becomes a solid panel

Not a tuning change, a decision. The arithmetic behind it, proven live in a colour proof:

- Over the warm cream page (hue 37°), a translucent green composites **72° toward yellow**.
  `green-800/20` renders `#c8cac0` — hue 73°, saturation 9%.
- Compensating the base only works **at one alpha**. A base solved for 30% renders as bright
  emerald at 85%, because the background barely contributes there.
- **At high alpha the brand green needs no correction at all**: `#143321` at 85% renders
  `#344d3d`, hue 142° — three degrees off brand.

So over a cream page you can have *glass* or *your green*, not both. **The owner chose the
green.** Nav panel is `bg-green-800` at high opacity (~85%) or solid.

**Consequence: every nav label, icon and section header must invert to cream.** Dark text on
a dark panel is the actual defect in the current build, not the green.

### 2. The avatar becomes the menu button — again

The avatar in the NEW header is the control that opens the nav. It was made decorative by an
earlier ruling; that is reversed.

### 3. The drawer tab is removed entirely

No hanging tab. The header's avatar button replaces it. Delete `.cs-drawer-tab` and its
markup — the fade/opacity work from `e968ffa` goes with it.

**Sequencing:** the tab is the ONLY way into the nav on mobile today. **Do not remove it
before the avatar button works**, or the menu becomes unreachable on phones.

### 4. "The mono menu stays"

One menu, not two. The avatar opens the **same single nav** — it does **not** reintroduce the
separate avatar dropdown that `ONEMENU` removed. Its contents stay in the nav.

### 5. Also in this pass

- **Nav resize** — the drawer's dimensions, per the owner.
- **Icon change** — apply `docs/reference/nav-icon-exercise.md`, which is settled. Two icons
  are custom and still blocked on artwork (Lessons, Horse care).

### Order

**The header lands first.** Everything else here is gated on it: the button lives in the new
header, and the tab cannot go until that button exists.
