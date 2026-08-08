# TASK MOBILEPASS — mobile nav, header legibility, and one material language

Owner-reported 2026-08-07 from a narrow desktop window (mobile layout **with a cursor**).
Orchestrator diagnostics are inline — **do not re-derive them, verify them.**

**Screenshots were supplied and reviewed by the orchestrator 2026-08-08** — their findings
are folded into C1, C1b, the Header section and E.

**One gap remains:** the owner's **Header item 3 was cut off mid-sentence.** Ask; do not
guess.

---

## A. Confirmed against current `main` — these are real

| # | Item | Diagnostic |
|---|---|---|
| **A1** | Hover state missing | `AppLayout.tsx:373` — `lg:hover:bg-green-800/10`. Hover is gated to `lg:`, so a **narrow window with a cursor** gets none. The earlier "mobile has no mouseover" ruling was wrong for this case. Drive hover off `@media (hover: hover)`, **not** viewport width. |
| **A2** | Selected state is solid | `AppLayout.tsx:316` and `:373` — `bg-green-800`, no alpha, sitting on a glass panel. Owner wants transparency + frosting to match the surface. |
| **A3** | "Menu" label | `AppLayout.tsx:1213` — still rendered. Remove. |
| **A4** | Panel green source | `NAV_GLASS` (`AppLayout.tsx:35`) is `bg-green-800/[0.07] backdrop-blur-md`. **The green is the panel, not the overlay.** Answers the owner's question in nav item 5. |
| **A5** | Scrim colour | `AppLayout.tsx:1197` — already `bg-black/40`, not green. The owner reports it "the same colour as the glass"; likely green-glass *over* black reading as one tone. **Confirm on device before changing** — it may be a contrast problem, not a colour bug. |

## B. Straightforward fixes

- **B1** — Padding above and below **Sign out**.
- **B2** — Notification surfaces are opaque; make them translucent to match the panel.
- **B3** — Panel and button animate at different speeds on open/close. Match duration and
  easing; they should read as one motion.
- **B4 (admin only)** — Nav sections are collapsible on desktop but **not on mobile**. Bring
  the mobile drawer to parity.

## C. The two real design problems — these need judgement, not just CSS

### C1 — Nav text legibility — WORSE than reported. Screenshots reviewed 2026-08-08.

The owner reported the text as hard to read **over dark content**. The screenshots show it
is **also low-contrast over LIGHT content**, which is the ordinary case:

- The drawer renders **near-white**, not green. `bg-green-800/[0.07]` over a light page is
  effectively invisible — the "green glass" reads as plain white.
- Nav labels are **mid-grey on near-white**. That fails on a bright screen indoors, before
  dark content is involved at all.
- Section headers (`MANAGEMENT`, `PEOPLE`) and the "Community Feed / show" row are the worst
  affected — they nearly disappear.

So this is not "glass breaks over dark backdrops." **The panel has almost no surface of its
own in either direction**, and the blur is doing all the work.

**Orchestrator's recommendation:** give the panel a real surface — a cream/paper base at
high opacity with the blur as texture on top, not a 7% tint hoping the backdrop cooperates.
Then set label colour against **that** known surface rather than against whatever is behind
it. Contrast becomes a property of the panel instead of a coincidence.

Do **not** fix this with a text shadow — it trades one legibility problem for a muddier one,
and the owner has rejected heavy shadow treatments elsewhere.

### C1b — Also visible in the screenshots, not in the owner's list

- **The notification badge is fully opaque gold** on a translucent panel — the same mismatch
  as B2, so fix them together.
- **The drawer tab (`>`) keeps a visible focus ring after click** and sits on top of page
  content. Related to D5 but distinct: the ring persists after the pointer interaction,
  which usually means a missing `:focus-visible` distinction.

### C2 — The app has three material languages at once

The owner's words: *"the app feels off with some glass, some opaque buttons without texture,
and a header with a different colour and a texture."*

Today: the **header** is textured cardstock; the **nav** is green glass; **buttons** are flat
opaque. Three surfaces that do not acknowledge each other.

**Orchestrator's recommendation — one rule, three roles:**

| surface | material | why |
|---|---|---|
| **Header** | textured cardstock — **the only textured surface** | it is the brand object; texture is what makes it feel physical |
| **Nav / drawer / overlays** | frosted glass, opaque enough to guarantee contrast (per C1) | these float above content, so they should look like they float |
| **Content + buttons** | flat paper, no texture, no blur | content must be legible and calm; competing texture is what makes it feel busy |

The failure today is that **buttons pick neither** — flat but not paper-toned, sitting on
glass they do not match. Pick a lane per role and apply it everywhere.

**Present options to the owner before implementing C1 or C2.** These change the look of every
screen and are not a thread's call to make alone.

## D. Page-header layout — make one placement and reuse it

Owner: the "add new" button sits at a **different height on every page** — new deal higher
than new contract, lower than new horse.

1. **`Horse records` has the correct placement. It is the reference.** Bring every other page
   to it exactly.
2. **Page name moves up, above the button.**
3. **Description moves down slightly**, below the page name.
4. **The button becomes a square, icon-only `+`, right-aligned.** No text — `+` is already
   the universal add-new affordance and the label is noise.
5. **The mobile menu button overlaps the new-contract button.** Move the menu button **up**,
   with breathing room below the header — but not so far that it still overlaps. This
   interacts with items 1–4; solve them together, not separately.

## Header

Screenshots reviewed by the orchestrator 2026-08-08 — a side-by-side of a narrowed desktop
window (left) against real mobile Safari (right), same page.

- **H1 — CONFIRMED.** The narrowed-desktop wordmark is legible; the **real-mobile wordmark is
  markedly fainter** at the same nominal treatment. Desktop got the stronger shadow/highlight
  work and mobile did not. Note the two are at different sizes ("French Heritage Equestrian"
  vs "French Heritage"), and **relief stops resolving below roughly 36px** — so this is
  likely the same size-driven failure diagnosed earlier, not merely a missing style. Fix it
  at the size that actually renders on the device; do not just copy the desktop values, which
  are tuned for a larger glyph.
- **H2 — CONFIRMED.** The `FH` monogram renders as an **outline only**, unfilled, in both
  screenshots. It was decided it would be filled with cream.
- **H3** — **The owner's third item was cut off mid-sentence. Ask.** Do not guess.

## Verification

**This task cannot be verified without a browser.** Everything here is visual.

1. Narrow desktop window **with a cursor**: hover works (A1).
2. Real phone, portrait and landscape.
3. Nav text legible over a **dark** page — screenshot it (C1).
4. Every page's add-new button at the same height as Horse records (D).
5. Menu button overlaps nothing at any width (D5).
6. Typecheck, lint, build clean.

## Constraints

- Own git worktree off `origin/main`, at `~/Downloads/claude-code-repo/wt-mobilepass`.
  **Never `~/Desktop`.**
- `ClauseDocument.tsx` is FROZEN.
- **`AppLayout.tsx`, `CardstockHeader.tsx` and `header-cardstock.css` are this task's** —
  no other thread may hold them concurrently.
- The `.cs-tab` CSS in `header-cardstock.css` is now **unreferenced** (the header create tab
  was removed 2026-08-07, commit `42bbff2`). Safe to delete as cleanup.
- Do not change nav information architecture — labels, order, destinations are settled.

## Reporting

`docs/reports/TASK-MOBILEPASS-REPORT.md`. Screenshots for every visual claim. State what you
verified on a real device versus in a resized window.

---

## E. DESKTOP left rail — owner + screenshots, 2026-08-08

**Scope note:** this task was written for mobile; these are desktop-rail defects. Same files,
same thread, so they belong here rather than in a task that would fight for `AppLayout.tsx`.

### E1 — Community Feed icon looks undersized when collapsed

`CommunityNav`'s collapsed branch (`AppLayout.tsx` ~446) renders `<Users size={18} />` —
**the same nominal size as every other rail icon**, inside the same `px-3 py-2.5
justify-center` box. So this is probably **not** a size bug.

**Hypothesis to check first:** lucide's `Users` glyph carries more internal whitespace and
thinner strokes than `Home`/`Calendar`/`Inbox`, so at an identical `size` it reads smaller.
If confirmed, the fix is to bump **this icon's** size (or stroke width) until it matches
optically — **optical size, not nominal size.** Do not change every icon to chase it.

Confirm against the screenshot before doing anything: the collapsed rail shows this icon
visibly smaller than the house beneath it.

### E2 — Collapsed rail: create `+` at top, collapse toggle at foot

Already implemented on `main` in commit **`42bbff2`** (create `+` occupies position 1; the
collapse toggle moved to the rail foot, above Sign out, right-justified in both states).

The owner reported it missing, **from a build that predates that commit**. **Verify against
current `main` before treating it as outstanding** — and if it is genuinely wrong there, the
bug is in that commit, not a missing change.

### E3 — Hover contrast is too weak

`lg:hover:bg-green-800/10` — **10% green** is not enough to read as a state change against
the rail surface. Darken it.

Interacts with **A1** (hover must key off `@media (hover: hover)`, not `lg:`) and with **C1**
(the panel gets a real surface). **Set hover against the corrected surface**, not the current
washed-out one, or it will be re-tuned twice.

### E4 — Collapsed tooltip renders as a green sliver — ROOT CAUSE FOUND

`NavTooltipLabel` positions itself `absolute left-full ml-2` — deliberately **outside** the
rail. But the rail `<nav>` carries **`overflow-x-hidden`** (both `ClientRail` and the staff
rail), which **clips it**.

So the owner's report is exactly right and the mechanism is: after the 1100 ms delay the
tooltip *does* appear, is clipped at the rail's edge, and all that survives is a sliver of
its `bg-green-950` background — "a weird green marking on the nav rail."

**The fix is not the tooltip's styling.** Options, in order of preference:

1. Render the tooltip in a **portal** so it escapes the clipping context entirely.
2. Drop `overflow-x-hidden` from the rail — **check why it is there first**; it is likely
   guarding against horizontal scroll from long labels, so removing it may reintroduce that.
3. Position the tooltip **inside** the rail bounds — worst option; a 56px rail cannot hold a
   readable label.

**This is the highest-value item in section E** — it is a confirmed root cause with a clear
fix, and it currently makes the collapsed rail unusable for anyone who does not already know
the icons.
