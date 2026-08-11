# UIO-003 — the nav hover flicker: the icon vanishes, and one row double-paints

**Owner confirmed:** 2026-08-10 · **Status:** READY

## What he asked for

> "we need to investigate the admin nav menu on desktop to find out why the cursorover and
> hover states flicker and why they react so quickly to the cursor instead of easing in and
> out as the cursor move over them."

Later: happens on **both** navs, worst on the **expanded** menu. macOS "Reduce motion" is OFF.

## Cause 1 — THE ICON HAS NO TRANSITION. Proven from the owner's own screen recording.

**Evidence: `docs/reference/navhover-frames/leads-hover-in-30fps.png`.** Hovering "Leads" in the
expanded staff rail, at 30fps:

| frame | background | icon | label |
|---|---|---|---|
| 19.350s | white | green, visible | dark green |
| **19.383s** | still near-white | **GONE — invisible** | still dark |
| 19.417s | pale sage | faintly back | washing out |
| 19.450s | mid sage | white, visible | white |

**The icon disappears for about one frame on every hover.** `AppLayout.tsx:70` —

```
NAV_ICON_IDLE = 'text-green-800/70 [@media(hover:hover)]:group-hover:text-cream-25'
```

— has no transition, while its row (`:436`) has `transition-colors`. **CSS transitions are not
inherited.** So the icon snaps to near-white while the background is still near-white and only
~30ms into a 150ms ease. White on white. The fill then arrives behind it and it reappears.

**Fix:** give the icon its own transition, matched to the row's.

**Sweep the whole family — do not fix only this constant.** `NAV_ICON_IDLE` is applied at every
icon site in the file, and the same defect exists on the "Add New" `Plus` (`:1287`) and the
group-heading buttons (`:1312`, which carry `hover:text-cream-100` with no transition at all).
**Enumerate every element that changes colour on hover and confirm each carries its own
transition.** Fixing the rows the owner happened to hover over is how this recurs.

## Cause 2 — one row paints its hover fill TWICE

`AppLayout.tsx:595` (parent) and `:622` (child) **both** carry
`[@media(hover:hover)]:hover:bg-navfill/64`. Hovering the child paints both layers:

```
1 - (0.36 × 0.36) = 0.87 effective
```

**87% against 64% everywhere else** — that row jumps darker than its neighbours on hover.

**Fix:** the fill belongs on the parent only. Remove it from the child; keep the child's own
text-colour change.

## Cause 3 — "reacts too quickly" is Tailwind's bare default

Every nav row uses `transition-colors` with **no `duration-*` class**, so it runs at Tailwind's
default **150ms**. There is an ease; it is just short enough to read as instant.

**Use the named utilities from `task/uireview`, which are already designed and reasoned:**

```js
// tailwind.config.js
transitionTimingFunction: { glide: 'cubic-bezier(.32, .72, 0, 1)' },
transitionDuration:       { 320: '320ms', 440: '440ms' },
```

`320` for a colour settling under the cursor, `440` for a panel crossing the screen. **Declare
them as NAMED utilities, never arbitrary values** — `duration-[320ms]` and
`ease-[cubic-bezier(...)]` are exactly the form that emitted no rule at all on 2026-08-08.

Apply `duration-320 ease-glide` to the nav row and icon transitions.

## Files

- `src/components/app/AppLayout.tsx`
- `tailwind.config.js`

## Do NOT

- Do not change `NAV_PANEL`, the row fills, or any colour value. This order is motion only.
- Do not touch `--cs-hdr-h` or any breakpoint.
- Do not apply the 440 duration to nav rows; it is for the drawer.

## Verification

Grep `dist/assets/*.css` for the emitted `duration` and `timing-function` rules and for the
icon's `transition-property`. **Minified CSS rewrites what you are grepping for** — it keeps
the space after the colon AND converts `rgba()` to 8-digit hex. Grep the *property* and read
what follows.

State whether the icon and its row now share a duration, and confirm the double-fill row paints
one layer.
