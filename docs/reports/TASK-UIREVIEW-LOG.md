# TASK-UIREVIEW — running log

One entry per exchange. Append only; never rewrite history here.

---

## 2026-08-09 · Entry 1 — setup

Worktree `wt-uireview` created off `origin/main` (`5cce651`), branch `task/uireview`. Repo
confirmed as `Cactai-Inc/fhe-website-app`; no clone exists under `~/Desktop`.

Verified the worktree matches PART 2 rather than assuming it: ONEHEADER (`eaab867`) IS in
`origin/main`; `NAV_PANEL = 'bg-cream-25'` (AppLayout.tsx:61); `--cs-hdr-h` is 76/68/64/56.
T4 confirmed live — `header-cardstock.css` still declares its own `:root { --cs-hdr-h: 80px }`.

**Discrepancy recorded:** the task doc itself is not on `origin/main`. It is on local `main`
at `0cabfca`, unpushed. Read from the git object, not from a working copy.

---

## 2026-08-09 · Entry 2 — avatar ring, mobile intensity, selected fill

**Owner asked** (mode not declared; read as CHANGE, but held before applying — see below):

1. The avatar letter lost its ring; it should look like the logo, with an outline ring
   around the letter.
2. The mobile version renders at the company brand colour instead of a reduced-intensity
   version.
3. The fill for selected / mouseover is darker than brand; it should be the on-brand value.

Mid-message amendment: **“hue should always be on brand, intensity ≠ hue.”**

**What the code actually shows** (all verified, not inferred):

- `.oh-avatar` (app-header.css:151) is `border: 0`, solid `#143321`, cream-100 letter. The
  desktop `span` form carries **no ring of any kind**; the mobile `button` form has a gold
  box-shadow hairline, not a green ring. The logo `.oh-mono` (:105) is
  `1px solid rgba(20,51,33,.40)` with a transparent centre — so avatar and logo do not
  currently share a treatment. The shelved cardstock avatar had a struck ring
  (`.cs-ring-wall` / `.cs-ring-breath`), so **the ring is a real regression from ONEHEADER**,
  not a misremembering.
- Mobile and desktop avatars are the **same** value — both opaque `#143321`. There is no
  reduced variant of anything today.
- Selected is `bg-navfill/80`, hover `bg-navfill/64`; `navfill = #0d341e` is darker
  (L 12.7% vs 13.9%) and far more saturated (60% vs 43.7%) than the brand green.

**Arithmetic finding — the hue compensation is inert at the alphas in use.** Rendered over
the near-white panel: `navfill/80` → `#3d5c4a` hue 145.2°; `green-800/80` → `#435b4c` hue
143.9°. At /64: 143.9° vs 142.3°. A 1.3–1.6° difference. §2.3's compensation was solved for
`/20`, where the drift is genuine (145.2° → 122.2°), and **nothing on this panel runs at /20**.
So moving the base to the brand value costs no measurable hue accuracy. This does not
contradict §2.3's ruling that a *low-alpha* green panel cannot read green — that still holds.

**Second finding — translucency, not the base, is what washes the fill out.** Selected renders
at 20.3% saturation against the brand's 43.7%. No change of base fixes that while the panel
beneath is near-white.

**Third finding — nothing in the palette currently obeys “intensity ≠ hue.”** Alpha over the
warm header drifts hue away from brand (`green-800/70` → 135.4°, `/60` → 129.4°), and the
existing green ramp is not hue-locked either (`green-700` 141.4°, `green-600` 138.5°,
`green-500` 139.7°). A hue-locked tint ladder at 145.2° / 43.7% was computed instead.

**No app code changed.** Items 1 and 2 have no value specified — “reduced intensity version”
is a number the owner has not given, and “like the logo” has four defensible readings. Per
PART 5 a rendered comparison was built rather than hex values sent:
`docs/reference/avatar-and-fill-options.html`. Awaiting his pick.

Commit: (this entry) — mockup + log only, no `src/` changes.

---

## 2026-08-09 · Entry 3 — the motion pass, the Save button, the favicon

**Owner asked**, in sequence: apply the avatar ring (he questioned why it had not been);
mobile avatar at 66% with 100% on hover / press / menu-open; the drawer to glide in and out
from the right; the nav fills to ease rather than snap; Save to become the outlined form of
Send; the favicon to match the header mark.

Applied and committed separately: `b0d8474` (avatar), `7622e1c` (motion), `b052637` (Save +
favicon). **Not pushed.**

**Standing correction to the task doc:** baseline lint is **30 warnings, not ~26**. Measured
by stashing to `origin/main` and re-linting. Nothing in this entry introduced any.

**New trap, T2 sibling.** Tailwind minifies `440ms` to `.44s`. Grepping the declared unit
returns nothing and looks exactly like a failed emit — the same shape of false negative T2
records for `min-width: 1400px`. Grep the rule body (`.duration-440{...}`), never the value
as authored.

**A real trap avoided:** `66` is not in Tailwind's built-in opacity scale any more than `64`
was. `bg-green-800/66` would have emitted nothing. Declared in `tailwind.config.js`; the
built rule `.hover\:bg-green-800\/66:hover{background-color:#143321a8}` was grepped out of
`dist/assets/*.css` (a8 = 168/255 = 66%).

**On the 66% value.** The owner said afterwards it was arbitrary — a midpoint to move either
way from. He can move up, not down, and the binding constraint is the label, not the fill.
Over the subheader bar `green-800/66` renders `#63776b` and carries cream at 4.66:1; `/62` is
4.14:1. If a lighter cursorover is wanted the label must stay green — a tint at /8–/20 — since
between roughly /35 and /60 the fill is too dark for green ink and too light for cream and
nothing is legible. Both directions rendered in `docs/reference/avatar-and-fill-options.html`.

---

## 2026-08-09 · Entry 4 — the nav cursor-over flicker: cause found

Investigated per T7 — enumerated rather than reasoned from likely culprits.

**Ruled OUT, with evidence.** The standing C1 theory is that the flicker is inherent to
`backdrop-filter` re-compositing. **It cannot be**: there is no `backdrop-blur` left anywhere
in the nav. `grep` finds it only in `EmailChangeModal`, `DocumentsContent`, `FeedVideo`, the
public `Header`, and two comments. `NAV_PANEL` is `bg-cream-25`, opaque. Also ruled out: no
hover rule changes geometry (no `hover:font-*`, `hover:p-*`, `hover:scale-*`, `hover:border-*`
anywhere in `AppLayout.tsx`), and there is no polling interval re-rendering the rail — so
neither a hover-loss loop nor render churn is available as an explanation.

**CAUSE 1 — the Community Feed row is invisible until you hover it.** `AppLayout.tsx:589`
sets the idle label to `text-cream-100/80`; `:605` sets the chevron to `text-cream-100/65`.
Those are cream marks, and ONEHEADER made the panel near-white. Rendered:

| | idle | hovered |
|---|---|---|
| label | `#f7f2ec` on `#fdfcfa` — **1.08:1** | cream on `#637c6d` — 3.99:1 |
| chevron | `#f8f4ee` — **1.07:1** | readable |

A normal rail row is 13.43:1 idle. So this row is *blank* until the cursor reaches it and
*appears* when it does — and vanishes again on exit. Dragging the pointer down the menu makes
items materialise and disappear. That reads as flicker, and it is not a compositing artifact;
it is two colours left over from the green panel. Same class as T5's stale comment — the code
comments at `:592` and `:601` still say "on the green panel… cream like every other idle
mark", which was true before ONEHEADER and is not now.

**CAUSE 2 — nested hover fills stack.** `:587` puts `hover:bg-navfill/64` on the parent row
and `:605` puts the same fill on the chevron button *inside* it. Hovering the chevron
composites 0.64 over 0.64 — an effective 87%. The patch under the chevron renders `#2c4e3a`
against the row's `#637c6d`, a large jump. Crossing onto and off the chevron therefore steps
the fill darker and back within one row.

Both are deterministic, both are in the diff, neither needs a browser to confirm — though a
browser would confirm them instantly. **No fix applied**: both are colour changes and the
owner has not chosen values. Reported for his call.

**Also found, not asked for and NOT changed:** the comment at `AppLayout.tsx:66-69` describes
`NAV_ROW_ACTIVE` as "cream fill, green ink". The constant is `bg-navfill/80 text-cream-25` —
dark fill, cream ink, the opposite. Another stale ONEHEADER-reversal comment, T5's family.

---

## 2026-08-09 · Entry 5 — contract items need two clicks: cause found

`ClauseDocument.tsx` is FROZEN and was not touched. The controls are not in it anyway — they
are `InlineFieldControl` in `ContractCascade.tsx`.

**The first click is consumed by a blur-triggered reload.**

1. Every text control in `ContractCascade` commits on blur — `:368`, `:405`, `:447`,
   `:511-517`, `:898`, `:905`, `:963`, `:991`.
2. That commit lands in `saveField` (`ContractPage.tsx:874`), which does
   `await setContractField(...)` **and then `await load({ blank: false })`** — a full document
   refetch — then bumps `changeKey`.
3. `load` calls `setDetail(d)`, re-rendering the whole document subtree.

So: pointer goes down on a toggle → the focused field blurs → save → full reload → the button
node is replaced → pointer comes up on a different node → **the browser never fires `click`**,
because a click requires down and up on the same element. The second attempt works because
nothing holds focus any more. On touch the synthesized click is lost the same way.

The toggles themselves are plain `onClick` (`:799` yes/no, `:887` buttons/multi-select), so
they have no defence against this.

**Distinguishing the fix from the workaround**, per T7: moving the toggles to
`onPointerDown` would make the symptom go away and is a workaround. The fix is that a single
field write should not remount the document — either update locally and reconcile, or stop
`await load()` on every field save. That is a behaviour change in `ContractPage`, not a UI
tweak, so it goes back to the orchestrator rather than being done here.
