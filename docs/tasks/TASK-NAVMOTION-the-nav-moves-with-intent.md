# TASK NAVMOTION — the nav stops flickering, starts sliding, and says what it is

**Owner, 2026-08-11.** One message, eight observations, all on one surface: the nav rail, the
mobile drawer, and the header. They are one task because they are three files that share a
palette, a motion vocabulary and a breakpoint.

Everything below was verified in source on 2026-08-11 before it was written down. Where a
diagnosis is given, the mechanism is named — implement against the mechanism, and if the
mechanism turns out not to be what is happening, **say so in the report rather than patching
around it.**

---

# A. THE HOVER FLICKER — diagnosed, and it is a one-word fix

> *"it renders a color dark first and then it lightens to gold so it looks like a flicker in a
> weird way still… The same mouseover flicker is seen on the mobile nav."*

`AppLayout.tsx:80`:

```
const NAV_ROW_IDLE = 'text-green-800 transition-colors duration-320 ease-glide
  [@media(hover:hover)]:hover:underline
  [@media(hover:hover)]:hover:decoration-gold-600
  [@media(hover:hover)]:hover:decoration-2
  [@media(hover:hover)]:hover:underline-offset-4';
```

**The mechanism.** Tailwind 3.4's `transition-colors` includes `text-decoration-color` —
verified at `node_modules/tailwindcss/lib/corePlugins.js:3445`. In the idle state
`text-decoration-color` is never declared, so it resolves to `currentColor`, which is
`text-green-800`. On hover:

- `text-decoration-line: underline` is **not an animatable property** — it snaps on in one
  frame, at the *current* decoration colour, which is dark green.
- `text-decoration-color` **is** animatable and is in `transition-colors`, so it then eases
  green-800 → gold-600 across the full `duration-320`.

That is the flicker, exactly as described: a dark line that becomes gold.

**THE FIX: declare `decoration-gold-600` in the IDLE state as well.** The line is still absent
until hover (the *line* is what toggles), but the colour it appears in is already correct, so
there is nothing left to transition. One class moved from the hover half to the base half.

**Do not "fix" this by shortening the duration** — that makes the flicker faster, not absent.
**Do not remove `transition-colors`** — it is doing real work for `text-green-800` and for
`NAV_ICON_IDLE`.

**This one constant serves both the desktop rail and the mobile drawer**, so the mobile
half of the complaint is fixed by the same edit. Prove that: name every call site that reads
`NAV_ROW_IDLE` in the report.

**There is a second copy of the same pattern** at `AppLayout.tsx:669` (the group-row variant,
`group-hover:decoration-gold-600` with the same missing idle colour). **Fix both.** Sweep for
any other `decoration-` hover without a matching idle declaration and list what you find.

## Optional, and only if it is genuinely cheap: the underline that grows

A gold rule that wipes in left-to-right rather than appearing whole would suit
`ease-glide` well. It cannot be done with `text-decoration` — it needs a `background-image`
linear-gradient with a `background-size` transition, which means the label span becomes a
positioned element.

**Build the colour fix first and prove it. Then, if the growing underline is a contained
change, build it behind a single constant so it can be reverted in one line.** If it is not
contained, **report it and stop** — the flicker fix is the deliverable, the flourish is not.

---

# B. THE SELECTED STATE BECOMES AN UNDERLINE

> *"what do you think about letting the underline be the indicator of the selected page in
> place of the color change? its a nice lightweight look and definitely classier than the big
> green fill, plus every page has a giant title on it that tells the user where they are so the
> nav isnt that important once you are on the page you want to be on so a subtle vs bold
> indicator wont be giving up anything from how i see it."*

**Approved. Build it.** The owner's reasoning is sound and this supersedes UIO-013's
resolution of `NAV_ROW_ACTIVE`.

## B1. Selected must not be identical to hover

If selected is *just* an underline, then hovering an unselected row makes it look selected, and
hovering the selected row shows no response at all. Selected is the same idea **one notch
stronger**, not a different idea:

- **hover** — gold underline, `decoration-2`, weight unchanged
- **selected** — gold underline, thicker rule, **`font-medium`**, persistent

The weight change is what makes it survive a cursor sitting on a neighbouring row. Pick the
thickness off Tailwind's own `decoration-*` scale — **T1: arbitrary values in this repo have
silently emitted no rule at all, twice.** Grep your chosen classes out of the built CSS and
paste the matches in the report.

## B2. ⚠️ THE FILL AND THE INK ARE ONE DECISION — this is the trap

```js
const NAV_ROW_ACTIVE  = 'bg-navfill/80 text-cream-25 font-medium';   // :95
const NAV_ICON_ACTIVE = 'text-cream-25';                             // :105
```

`text-cream-25` is `#fdfcfa`. `NAV_PANEL` is `bg-cream-25` — **the same colour.** The cream
text is legible *only* because the `navfill` block is painted behind it.

**Remove the fill without moving the ink and the selected row's label and icon become
invisible on a near-white panel.** Selected ink returns to the green family; the icon takes a
weight or tone that reads as selected without a fill behind it.

This exact pairing is documented in this file as having been got wrong once already —
`app-header.css` carries the owner's own words about it: *"i want to leave nothing to
interpretation."* **State the rendered contrast ratio of the selected label and the selected
icon against `#fdfcfa` in the report.** Floor is 4.5:1 for the label.

## B3. `aria-current`

If a selected row does not already carry `aria-current="page"`, add it. With the fill gone the
distinction is finer, and a screen reader must not be depending on a colour that is now subtle.

---

# C. THE DRAWER SLIDES. TODAY IT CANNOT.

> *"the mobile nav and the overlay that comes with it are not smooth, they dont slide in from
> there respective sides and the effect is a jarring instant appearance of both surfaces. And
> the same on closure. Can we have a smooth easy slide in effect used for the nav panel and for
> the overlay?"*

**The root cause is not a missing transition. It is that there is nothing to transition.**

`AppLayout.tsx:1505` is `{mobileNavOpen && ( … )}`. The scrim and the panel are **unmounted**
when closed. A CSS transition cannot run on an element that does not exist at the start of it,
and on close React removes the node before any exit transition could play. That is why both
directions are instant.

**The drawer must stay mounted** and be driven by transform/opacity, with the node either kept
in the tree permanently or unmounted on `transitionend` / after the exit duration. Whichever
you choose:

- **Closed must be fully inert** — not focusable, not hit-testable, not announced. A drawer
  that is merely translated off-screen is still in the tab order and still read by a screen
  reader. `visibility: hidden` at the end of the exit, `inert`, or an unmount-after-exit all
  solve it; a bare `translate-x-full` does not.
- **Nothing may become permanently scrollable off-canvas.** See §C0 — parking it on the LEFT is
  what makes this safe, and it is not symmetric with parking it on the right.

## C0. THE OWNER'S MECHANISM IS CORRECT — with one correction that matters

> *"the menu can be loaded off screen on the left and then its there but the screen can scroll
> left so its never visible and when the click happens the animation happens. Right?"*

**Right, and for a better reason than "it happens to work."** Browsers do not create scrollable
overflow toward the **inline-start** or **block-start** edges. Content sitting at negative `x`
in a left-to-right document is unreachable by scrolling — there is no left-scroll to expose it.
(Same rule that makes the old `margin-left: -9999px` off-screen trick work while its
`margin-right` mirror image does not.) Combined with a `position: fixed` wrapper — positioned
against the viewport, contributing nothing to document layout — a panel parked at `-100%` on the
left is genuinely invisible and genuinely unreachable.

**This is a real argument for §E that was not made there: moving the drawer LEFT is what makes
off-canvas parking safe.** Parked on the right it would extend the document's scrollable width —
which is precisely `TASK-FRAMESCROLL`'s bug arriving from the other direction while that thread
removes it. **Record this in the report as a second, independent reason the drawer belongs on
the left.**

**THE CORRECTION: invisible to the eye is not absent from the app.** A panel translated
off-screen is still in the DOM — still in the tab order, still announced by a screen reader,
still hit-testable at its off-screen coordinates. A keyboard user tabbing down the page would
walk into a menu they cannot see.

**So "loaded off screen and left there" is the right mechanism for the animation and half the
requirement.** At rest the drawer must also be **inert**: `visibility: hidden` applied at the
end of the exit, the `inert` attribute, or unmount-after-exit. `visibility` is usually neatest
here because it can be delayed to land exactly when the outgoing transform finishes — the panel
stays visible while it slides out and becomes unreachable the instant it arrives.

**Prove it in the report: with the drawer closed, nothing inside it is reachable by Tab.**

## C1. Use the vocabulary that already exists

`tailwind.config.js` declares `duration-440` with the comment *"440 for a panel crossing the
screen"* and `ease-glide` as *"the drawer-and-fill curve."* **`duration-440` is declared and
used nowhere in `src/`.** It was written for this and the drawer shipped without it.

- **panel** — `duration-440 ease-glide`
- **scrim** — fade, `duration-320`
- **close** — may be quicker than open; a fast exit reads as responsive where a slow one reads
  as sluggish. Do not exceed the open duration.

**Do not add new duration or easing tokens.** If you believe one is needed, report it.

## C2. The scrim FADES; it does not wipe

> *"with each coming from opposite sides of the screen?"*

**Built as a fade.** A scrim is a full-viewport layer, so "sliding it in" is a wipe across the
whole screen — it reads as a second panel arriving and pulls the eye away from the nav that
just opened, which is the opposite of what this task is for. The room dims; it does not
travel.

**The owner asked to see the alternative, so make it one line to see.** Put the scrim's
entrance behind a single named constant at the top of the block with a comment saying what
flipping it does. **Do not build a settings toggle or a prop for this** — a constant a
developer flips, nothing more.

## C3. Reduced motion

`usePrefersReducedMotion()` exists in `src/lib/hooks.ts:7`, and `src/index.css` already carries
two `prefers-reduced-motion` blocks. **Under reduced motion the drawer appears and disappears
with no transform and no fade** — instantly, which is the current behaviour and is correct for
that setting. Do not merely shorten the duration.

---

# D. THE AVATAR HAS TO LOOK LIKE A MENU

> *"the mobile nav needs a way for the user to know the avatar button is the activation
> surface. what do you think about having the nav jump up and down until its clicked when the
> user visits the mobile layout for the first time?"*

**Orchestrator's read, offered as input and approved by the owner to build:** the bounce is
addressing attention, but the failure is meaning. An avatar reads as *profile*. Motion makes a
user click it; it does not tell them what they are opening. And a bounce that continues *until
clicked* is a permanent distraction competing with page content on every screen.

**Build two things.**

## D1. A menu semantic on the mark — permanent

The smallest thing that reads as "this opens something" without fighting `app-header.css`'s
identity-mark treatment: **a small caret beneath or beside the initial, mobile only.** It must
not appear at `lg+`, where the mark is deliberately inert (`span.oh-avatar`) and toggles
nothing.

Constraints from `app-header.css`, all recorded there with reasons — read them before editing:

- The mobile mark is a **solid green-800 fill with a cream glyph**. Any added mark takes the
  cream family; contrast is stated in the report.
- **The 1024px split is done in CSS media queries, not `lg:hidden`** — deliberately, so the
  outcome cannot depend on stylesheet injection order. Follow that; do not switch it to
  Tailwind display utilities.
- The button already has rest / `:hover` / `:active` / `[aria-expanded='true']` states on a
  documented white-overlay ramp. **Extend that ramp, do not replace it.**

## D2. A ONE-TIME TIP IN A BOX — owner, 2026-08-11. This REPLACES the bounce.

> *"Lets show a tip in a box that appears with visual presence to catch the eye that says click
> for menu. 3-4 seconds should be enough if it pops in a movement oriented way."*

**An earlier draft of this section specified three pulses on the avatar itself. That is
superseded — build the tip box instead.** The reasoning that produced it still holds and is now
better served: motion catches the eye, but only words carry the meaning, and an avatar that
bounces says "press me" without ever saying *what opens*. The box says both.

- **A small callout near the avatar that reads "Click for menu"** (or wording the owner
  prefers — put the string in one constant). It must visibly point at or attach to the avatar;
  a floating box in the corner does not tell you *which* control it means.
- **It pops.** "Movement oriented" — it arrives with a spring/scale-and-settle, not a plain
  fade. `ease-glide` is the house curve and it is built for exactly this (fast departure, long
  settle). Entrance is short and lively; the dwell is what does the work.
- **Visible ~3–4 seconds, then it leaves on its own.** Time the dwell, not the whole animation.
- **First mobile visit only.** Persist the marker. Follow whatever this app already uses for
  first-run markers — the app tour stamps one (`tourSeen`) — rather than inventing a mechanism.
- **Any interaction dismisses it immediately**: touch, click, scroll, or focus. Opening the menu
  obviously dismisses it, and it never returns.
- **Under `prefers-reduced-motion`: the box still appears** — it is information, not decoration,
  and suppressing it would withhold the one thing that explains the control. **Drop the pop and
  present it plainly.** This is the opposite of §C3's rule and deliberately so.
- **Never at `lg+`.** There is nothing to discover when the rail is already on screen.

**It must not shift layout.** Absolutely positioned or a portal, animating `transform`/`opacity`
only — nothing around it reflows and the header height never changes. It also must not be
clipped by the header: `.oh-hdr` is `height: var(--cs-hdr-h)` with no `overflow` declared, so a
box hanging below the header's bottom edge should escape — **verify that rather than assuming
it**, and note that this file records a portal being required once before because a rail's
`overflow-x-hidden` clipped a tooltip (`AppLayout.tsx:396`).

**Accessibility:** it is an advisory, not an alert. Do not steal focus and do not trap it. If it
is announced at all, `role="status"`/polite is the ceiling — a transient tip must never
interrupt a screen-reader user mid-sentence.

**§D1's permanent caret still stands.** The tip is a first-run teaching moment that leaves; the
caret is what a returning user reads on day thirty. They do different jobs — build both.

---

# E. THE DRAWER MOVES TO THE LEFT

> *"since the desktop uses a left side menu, when i view the two versions (mobile and desktop)
> the app feels off since i have been used to seeing the nav on the left… for consistency the
> activation button being the avatar could either surface the menu from the left or right and
> it wouldnt matter, what are your thoughts about moving the menu to the left?"*

**Move it left.** The owner's own observation is the deciding one: the activation control does
not have to share a side with the panel, because the avatar is a fixed, known target in the
corner either way. What a returning user has muscle memory for is *where the nav lives*.

`AppLayout.tsx:1515`:

```js
className={`absolute inset-y-0 ${isSuperAdmin ? 'left-0' : 'right-0'} w-72 max-w-[85vw] …`}
```

**Superadmin already opens from the left.** So today the app gives three answers across three
surfaces: desktop rail left, superadmin drawer left, tenant drawer right. Moving the tenant
drawer left makes all three agree **and deletes the conditional** — one behaviour, not two.

**The honest cost, recorded so it is not rediscovered as a surprise:** on a large phone a
left drawer means reaching across for the links, not only for the button. The links are
full-width rows down the whole panel height, so the lower ones stay thumb-reachable, but the
top-left items are a longer reach than they are today. **The owner has accepted this
trade-off. Do not re-litigate it; note it in the report if the rendered result changes his
mind.**

---

# F. THE SCRIM — KEEP IT, LIGHTEN IT, FADE IT. REMOVAL IS A SECOND LOOK.

> *"im curious to learn why the overlay is part of the ui when a mobile nav is activated and
> shown? what is the purpose of it?… im open to trying it without the overlay to see how it
> looks unless there is a requirement for accessibility reasons that we cant get rid of it."*

**The direct answer: no accessibility rule requires a scrim.** WCAG mandates no such thing.
Nothing forbids removing it. But it is doing four jobs, and only the fourth is decorative:

1. **It is the close target.** `onClick={closeMobileNav}` is on the scrim div itself
   (`AppLayout.tsx:1512`). Remove the element and tap-outside-to-close leaves with it unless
   the handler is moved to the wrapper.
2. **It blocks taps reaching page content behind.** The `fixed` wrapper covers the viewport and
   is itself hit-testable, so this survives losing the *tint* — but only as long as nothing
   gives the wrapper `pointer-events-none`.
3. **`aria-modal="true"` is declared on the wrapper** (`AppLayout.tsx:1506`). That tells
   assistive technology everything outside is inert. The scrim is the sighted equivalent of
   that promise; without it the visual and the ARIA disagree about what state the app is in.
4. **Figure-ground.** The panel is `bg-cream-25` (`#fdfcfa`); app pages are cream. Those are
   roughly 1.0:1 apart, so separation rests entirely on `shadow-xl` and the panel edge.
   **This repo has already paid for exactly this:** `app-header.css` records a glass drawer tab
   that resolved to cream-on-cream and *"a real user could not find the menu."*

**Orchestrator's read, and what to build:** the complaint is almost certainly not that the
scrim exists — it is that it **appears instantly at 45%**, which is §C's bug wearing a
different hat. **Fade it in over `duration-320` and lighten it**, then look. That is a change
§C requires anyway, so it costs nothing to try first.

- **Lighten `bg-green-950/45`.** Somewhere around `/25`–`/30` is the expected landing.
  **Use a step that exists on the opacity scale** — `tailwind.config.js` declares
  `{8, 12, 64, 66}` on top of the built-in 5-steps, and a missing step **emits no rule at
  all**, which is how a border silently vanished on 2026-08-08. Grep the value out of the
  built CSS and paste the match.
- **Removal is the second look, not this one.** Put the scrim's opacity behind the same kind of
  single named constant as §C2 so it can be taken to zero in one line. **Do not delete it.**

## F1. Close the `aria-modal` gap while you are in here

The drawer declares `role="dialog" aria-modal="true"` and has **no focus management at all** —
`AppLayout.tsx:1048-1054` handles Escape, `:1070` closes on route change, and that is
everything. There is no focus trap and no focus return to the avatar on close.

`aria-modal="true"` without a focus trap tells a screen reader the rest of the page is inert
when it is not. **Add the trap and the focus return.** Keep it small: focus moves into the
drawer on open, cycles within it, and returns to the avatar button on close.

---

# G. THE HEADER: MARKS STAY, THE NAME SHRINKS

> *"the header logo and avatar get smaller on mobile layout and i dont think they need to, but
> the name doesnt get small enough so even at the size they are now the name text gets too
> close to them, if we scale down the name text a little for breathing room and keep the avatar
> and logo at their original size i think it will look better."*

**Measured in `app-header.css`, and the owner's diagnosis is precisely right:**

| viewport | `--cs-hdr-h` | `.oh-mono` / `.oh-avatar` | `.oh-w1` | `.oh-w2` |
|---|---|---|---|---|
| default | 76px | **42px** | 26px | 14px |
| ≤600px | 68px | **38px** | *unchanged, 26px* | *unchanged, 14px* |
| ≤400px | 64px | **36px** | 21px | 12px |
| landscape phone | 56px | **34px** | 19px | 11px |

**The 401–600px band is the bug**: the marks step down and the wordmark does not step down at
all, so a full-size 26px nameplate sits beside shrunken marks in a shorter header. That is the
crowding.

**Build:** `.oh-mono` and `.oh-avatar` hold **42px at every width**. The wordmark steps down
**earlier** (it must move in the ≤600px block, where today it does not move at all) and
**further** at the narrow tiers.

**Constraints:**

- `--cs-hdr-h` steps 76 → 68 → 64 → 56. A 42px mark fits all four, but **56px landscape leaves
  7px above and below.** Check it renders without touching the header's edges; if it does not,
  **raise that one tier rather than shrinking the mark back** — and say so.
- **`.oh-mono` was explicitly protected once already**: *"the owner corrected an earlier
  version of this order that touched it."* Holding it at 42px is what he is now asking for;
  changing its `font-size` ratio is not. Keep the mark/glyph proportions the file documents.
- The avatar's font-size is deliberately a *larger* fraction of its mark than the monogram's,
  because reversed type reads optically smaller. **Preserve that relationship at the held
  size.**
- `.oh-w1`/`.oh-w2` carry negative right margins equal to their own letter-spacing, to cancel
  the trailing tracking space so the two lines centre together. **If you change
  `letter-spacing`, change the matching `margin-right` in the same edit.** They are one value
  written twice.
- The wordmark is `white-space: nowrap` in a `1fr auto 1fr` grid. **Verify the narrowest tier
  still fits without the centre column pushing the side clusters.** 320px is the floor to
  check.

---

# H. THE ROW CONTENTS MOVE RIGHT — an ASYMMETRIC left inset

> **Owner, 2026-08-11:** *"Since its moving left and i asked for this same thing on the desktop
> nav, lets add a bit more padding on the left side of the icons so the button contents move
> right a bit. that will help with the reach and balance out the extreme differential we see now
> where the right side has so much whitespace and the left side has almost none."*

## H1. ⚠️ THIS SUPERSEDES UIO-016. Read that order before you start.

`docs/ui-orders/UIO-016-nav-row-indent.md` is the owner's earlier version of this same request
(*"nav icons and text too far left relative to nav panel size"*), and it **shipped** on
2026-08-10. It moved the icon start 20px → 24px by changing the `<nav>` container from `p-2` to
`p-3`, **deliberately symmetric**: *"Changing the container rather than the rows shifts both
sides equally, so the hover fill stays symmetrically inset and no row class has to change."*

That solved it evenly, and evenly is not what the owner now wants. Two of UIO-016's explicit
prohibitions are **overridden by this section**:

- ~~*"Do not change any individual row's `px-3`"*~~ → **the row's LEFT padding is exactly what
  changes now.**
- ~~*"Do not touch the mobile drawer"*~~ → **the drawer gets it too**; reach on a left-hand
  drawer is half the owner's stated reason.

**Say in the report that UIO-016 is superseded on these two points**, so a later thread reading
that order does not revert this citing it. UIO-016's other two prohibitions — do not change
`w-60`, do not touch the collapsed state's `justify-center` — **still stand**, and H4 is the
second of them.

## H2. What is actually being balanced

Measured 2026-08-11. Member rail `w-60` (240px); `<nav>` `p-3` (12px); row `px-3` (12px) — so an
icon starts **24px** from the panel edge. The row itself spans the full 216px of inner width,
and a short label like "Dashboard" leaves well over 100px of trailing space inside it. That is
the differential: a thin left margin against a wide right one.

**Raise the LEFT padding only; leave the right as it is.** Roughly `pl-5`/`pl-6` against an
unchanged `pr-3` puts the icon at ~32–36px. **Use Tailwind's own scale steps** — T1, twice
burned. Pick the value that looks right and state the resulting icon offset in the report.

## H3. ONE CONSTANT, AND EVERYTHING ON THE LEFT EDGE MOVES WITH IT

**This is the part that will break if it is done row by row.** The nav's left edge is a shared
alignment line, and three different kinds of element sit on it:

- **the rows** — `px-3 py-2.5`, at least nine call sites (`484`, `553`, `573`, `628`, `669`,
  `830`, `837`, `1358`, `1460`)
- **the group headings** — "MANAGEMENT", "PEOPLE" etc., `px-3 py-1.5` (`1388`, `1417`)
- **the indented children** — `CommunityNav`'s `indentClass`, default `pl-9`, applied at `709`
  and passed explicitly at `883`, `1149`, `1165`, `1398`

Change the rows alone and every group heading falls out of line with the labels beneath it, and
every indented child's step reads wrong because its indent is measured from an origin that
moved.

**Put the left inset in ONE constant next to `NAV_ROW_IDLE`** and have all three read from it —
the indents expressed as the constant plus their step, not as a hardcoded `pl-9`. This file
already establishes the pattern and the reason: `NAV_ROW_IDLE` centralised its transition
precisely because per-call-site copies *"drift back out of step."* **Derive the full call-site
list yourself and list it in the report** — the lines above are where to start, not a guarantee
of completeness.

**Not in scope:** the `px-4` rows in the desktop avatar dropdown (`accountMenu`, ~`1133`–`1211`).
That is a separate floating surface with its own metrics, not the nav's left edge. **Leave it
alone and say you did.**

## H4. ⚠️ THE COLLAPSED RAIL IS EXEMPT — asymmetric padding will knock its icons off centre

`staffRailWidthClass` is `w-14` — **56px** — when the staff rail is collapsed, and those rows
carry `${open ? '' : 'justify-center'}`. `justify-center` centres content in the **content box**,
which is only centred in the row if the left and right padding are equal. Make the left padding
larger and every icon in the 56px strip shifts right by half the difference.

That centre line is protected in two places already, by name: the comments at `1355` and `1457`
both record a control being brought back onto *"the shared centre line in the collapsed rail."*
**Do not undo that.**

**The asymmetric inset applies to the EXPANDED rail and the mobile drawer only. The collapsed
`w-14` rail keeps symmetric `px-3`.** State in the report how you gated it, and confirm the
collapsed icons still sit on one vertical line.

## H5. Check the labels still fit

Every pixel of left inset is a pixel off the label. The rail is 240px (`xl:w-64`, 256px, at the
widest) and the drawer is `w-72` (288px). **Find the longest nav label in the tree and confirm
it still fits without wrapping or truncating** at the narrowest expanded width — several rows
carry `whitespace-nowrap`, so the failure mode is overflow rather than a visible wrap, which is
`TASK-FRAMESCROLL`'s bug arriving inside a panel that has `overflow-x-hidden`, where it will
simply be clipped and silently unreadable.

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-navmotion`, branch `task/navmotion`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **You own `AppLayout.tsx`, `AppHeader.tsx` and `app-header.css` for the duration.** Other
  threads have been told to report changes to `AppLayout.tsx` rather than edit it; that
  reservation is yours now. **Do not edit `ClauseDocument.tsx`** (STOP-AND-PROPOSE) and **do
  not edit `src/components/ops/kit/DataTable.tsx`** — `TASK-FRAMESCROLL` owns it.
- **T1 — ARBITRARY TAILWIND VALUES HAVE SILENTLY EMITTED NOTHING IN THIS REPO, TWICE**
  (`bg-cream-100/[0.92]`, `border-green-900/12`). Use declared scale steps and named theme
  tokens. **For every colour, opacity, duration and easing value you add or change, grep it out
  of the built CSS and paste the match in the report.** A class that compiles is not a class
  that emits.
- **Delete nothing.** Retire behind a boolean or a named constant; `ContactsPage` is the
  pattern.
- No staff browser session exists and you will not be given one. **Prove what you can prove —
  the built CSS, the computed classes, the contrast arithmetic — and report every render as
  NOT VERIFIED.** Do not describe an animation as though you watched it. Give the owner a
  numbered checklist of what to look at, in order, on a phone and on a desktop.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. Hovering a desktop nav row shows a **gold** underline with **no dark first frame** — and the
   same is true in the mobile drawer, from the same constant.
2. The selected page is marked by an underline, not a fill, and its **label and icon are
   legible on the near-white panel** with the stated contrast ratios.
3. The drawer and the scrim **animate in both directions**; closed, the drawer is inert and
   unreachable by keyboard.
4. The drawer opens from the **left**, for tenants and superadmin alike, from one code path.
5. The avatar carries a **permanent** menu cue, and a **one-time tip box** that pops in, says
   what the control does, dwells 3–4s and leaves on its own.
6. At 401–600px the marks are **42px** and the wordmark has **stepped down**; at 320px nothing
   collides.
7. Focus enters the drawer, is trapped, and returns to the avatar on close. **With the drawer
   closed, nothing inside it is reachable by Tab.**
8. Nav row contents sit further right on an **asymmetric** left inset driven by **one
   constant** — rows, group headings and indented children all still on one alignment line —
   and the **collapsed 56px rail's icons are still centred.**

Report to `docs/reports/TASK-NAVMOTION-REPORT.md`.
