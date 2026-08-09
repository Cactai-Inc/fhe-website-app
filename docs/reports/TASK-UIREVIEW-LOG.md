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
