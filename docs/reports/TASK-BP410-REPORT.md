# TASK BP410 — header breakpoint for 375–410px phones — REPORT

Branch `task/bp410`, built in its own git worktree off `origin/main` (98f541d).
Typecheck clean, lint identical to baseline (29 warnings, 0 errors, before and
after — matches the count TASK-HEADER-REPORT recorded for the same baseline).

---

## What shipped

| File | Change |
|---|---|
| `src/components/app/CardstockHeader.tsx` | second logo SVG (48-unit) + second avatar SVG (42-unit), redrawn — not scaled — plus a second well-clip def (`csWellClip42`) |
| `src/components/app/header-cardstock.css` | `.cs-mark-sm { display:none }` default + new `@media (max-width: 410px)` block (padding 12→8, logo 56→48, avatar 50→42, `.cs-fh`/`.cs-av` font-size) |

Nothing else touched — no `AppLayout.tsx` change, no route change survives (see
"How I verified").

---

## The geometry (scaled numerically, not resized)

**Logo squircle**, scaled ×48/56 off the original 56-unit path, center 28→24:

```
M24 3.09 C 9.68 3.09, 3.09 9.68, 3.09 24 C 3.09 38.32, 9.68 44.91, 24 44.91
C 38.32 44.91, 44.91 38.32, 44.91 24 C 44.91 9.68, 38.32 3.09, 24 3.09 Z
```

The light/dark stroke layers keep `translate(0,-1)` / `translate(0,1)` exactly
as-is (physical pixels, not geometry) — same as the 56-unit drawing.

**Avatar**, scaled ×42/50 off the original 50-unit circles, center 25→21:

- Well-band (`.cs-ring-wall` + its clip): cx/cy/r all scaled by the ratio —
  `21, 20.5, 18.31` for the wall; `21, 21, 18.65` for the clip (a new
  `csWellClip42` def, since geometry differs from the 50-unit `csWellClip`).
- Outline triple (`.cs-ring-dark` / `.cs-ring` / `.cs-ring-breath`): center and
  radius scaled (`21, 18.65`), but the ±1 y-offset that makes the "struck
  impression" (24/25/26 → **20/21/22**) is kept literal, not scaled to ±0.84 —
  same rule as the squircle's translate offsets.
- `stroke-width: 1.8` (global `.cs-ring*` rule) and the well's stroke-width
  overrides from the ≤480 block (1.4 / 2.9 hover / 4.8 pressed) are untouched
  — physical pixels, size-independent.
- Letter sizes scaled off the 820px-breakpoint values: `.cs-fh` 19→16.5px
  (×48/56 = 16.29, rounded to the nearest half-pixel per the task doc),
  `.cs-av` 25→21px (×42/50, exact). Their text-shadows are unscoped by any
  breakpoint already (physical-pixel offsets), so nothing there needed
  touching.

`--cs-hdr-h` and the wordmark are untouched at this breakpoint — the task
budget didn't call for either to move, and both are confirmed unchanged below.

---

## How I verified

`/app` is behind Supabase auth and I had no credentials. Following the same
method TASK-HEADER-REPORT used: I mounted the **real** `CardstockHeader` with
its **real** CSS in a temporary route (`/dev-harness-bp410` → a throwaway
`HarnessBP410.tsx`, wired into `App.tsx`, with a dummy `.env.local` so the
Supabase client construction doesn't throw), served it with the project's own
Vite dev server, and drove real Chrome (`playwright-core` against the system
Google Chrome — `chromium-cli` was not available in this environment) at each
width.

**The harness route, its file, and `.env.local` have all been deleted; none
of it is in the diff** — confirmed via `git status --porcelain` showing only
the two intended files.

### Widths checked (portrait, DPR 3)

| Width | Overflow (`scrollWidth` vs viewport) | Marks used | Logo/avatar box | Padding | Wordmark |
|---|---|---|---|---|---|
| 375 | none | compact (48/42) | 48px / 42px | 8px | 30px, short |
| 390 | none | compact | 48px / 42px | 8px | 30px, short |
| 393 | none | compact | 48px / 42px | 8px | 30px, short |
| 410 | none | compact | 48px / 42px | 8px | 30px, short |
| 412 | none | **full** (56/50) | 56px / 50px | 12px | 30px, short |
| 420 | none | full | 56px / 50px | 12px | 30px, short |

No overflow, no clipping, no crowding at any of the required widths.
`--cs-hdr-h` measured `88px` at every one of these (unchanged from before this
task — I did not touch it, and confirmed it via computed style, not just
reading the CSS).

**≥411px is provably unchanged**: at 412 and 420 the measured logo/avatar box
size, padding, and wordmark size are identical to what the ≤480 block alone
produces — my new rule only fires at ≤410, so nothing above that leaks. I
didn't do a byte-level render diff against pre-change output (no baseline
screenshot existed to diff against — this is a new breakpoint, not a
modification of an existing one), but the CSS is additive and scoped to a
media query one pixel narrower than the boundary in question, so there is no
mechanism by which 411px+ could be affected.

### Outline smoothness (the sensitive part)

Cropped the logo and avatar at DPR 10 (higher than the doc's suggested 3x, for
a bigger inspectable bitmap of the same 1:1 viewBox:CSS-px construction) at
375px, and against the full-size 56/50 marks at 420px as a same-session
crispness baseline. **Both pairs show the same hard-edged, non-blurred
construction** — no jaggedness, no resampling fuzz, on either the squircle or
the avatar's outline/well-band. This is expected: the defect the task warns
about comes from a mismatch between an SVG's `viewBox` and its rendered CSS
size, not from device pixel ratio — and here `viewBox="0 0 48 48"` renders
into a 48×48 container (via `.cs-logo { width:48px; height:48px }` and the
existing `.cs-mark svg { width:100%; height:100% }` rule), same 1:1 relationship
the 56/50 pair already had.

### Avatar press state at the compact size

Clicked the avatar at 375px and screenshotted rest vs. pressed (DPR 6). The
well-band widens and darkens correctly, and the letter sinks — the rescaled
well geometry (`csWellClip42`, `cs-ring-wall` at cx=21/cy=20.5/r=18.31) reads
the same as the full-size version, just smaller. Letter press travel
(rest/hover/pressed transforms) is untouched CSS, so it wasn't expected to
differ and didn't.

### `--cs-hdr-h` / `--cs-tab-right`

`--cs-hdr-h` computed to `88px` at all six required widths (see table above) —
unchanged, since my new block doesn't set it. I did not mount `AppLayout`
(out of scope — the task says no `AppLayout` changes, and the harness exists
specifically to avoid touching it), so I couldn't screenshot the live drawer
tab; instead I confirmed by computed style that the variable it depends on
(`top: calc(var(--cs-hdr-h) + 24px)`) resolves identically before and after.
`--cs-tab-right` is unaffected on inspection — nothing in the new block
touches it, and the create tab itself is `display:none` below 1024px so it's
inert at every width this task cares about.

---

## Measured vs. assumed

- **Measured**: iPhone 14/15/16 report 390/393 CSS px (owner-supplied, taken
  as given — I didn't independently verify against device specs).
- **Measured**: overflow eliminated at 375/390/393/410, full-size marks
  restored unchanged at 412/420, `--cs-hdr-h` unaffected, outline smoothness
  at DPR 10, press-state behavior at the new size.
- **Assumed**: the exact half-pixel rounding for `.cs-fh` (16.5px) follows the
  task doc's own worked example (19×48/56 = 16.29 → nearest half-pixel) rather
  than a fresh eyeball pass against a mockup — there is no mockup for the
  compact marks to eyeball against (this is new artwork, not a port).
- **Not verified**: real-device rendering (iOS Safari specifically, where the
  original jagged-outline defect actually showed up before). Everything above
  was checked in Chrome only, since that's what was available in this
  environment.

---

## Out-of-scope observation (not fixed)

While sweeping widths for the overflow table, **500px also overflows**
(`scrollWidth` 582 vs viewport 500) — pre-existing, not touched by this task.
At 500px only the ≤820/850/900 blocks apply (≤480 doesn't reach that far), so
the wordmark renders the **full** "French Heritage Equestrian" at 29px with
56/50-size marks and 25px padding, which is too wide for a 500px viewport.
This is unrelated to BP410 (which only touches ≤410) and pre-exists on
`origin/main` unchanged — flagging it since I noticed it, not fixing it since
it's out of this task's scope (`CardstockHeader.tsx` + `header-cardstock.css`
only, and specifically the ≤410 budget).
