# TASK MOBILEPASS — report

**Headline: almost everything in the task doc is already shipped, superseded, deferred, or
answered.** The task doc was written 2026-08-08 00:01 and the codebase moved fast underneath it
the same day and the two days after (ONEHEADER, fifteen UI orders UIO-001–016, and an
owner reconciliation pass). Per the task's own instruction ("do not re-derive [the
diagnostics], verify them"), every item below was checked against current `main` — via direct
code read, `git blame`/`git log`, and the two authoritative reconciliation docs
(`docs/reference/OPEN-CHANGE-REQUESTS-2026-08-08.md`, `docs/reference/UI-STATE-2026-08-09.md`)
— rather than re-implemented from the stale diagnosis.

Net code change: **one stale comment fixed, two confirmed-dead files deleted.** No feature
work was needed because there was none left to do.

---

## What actually changed

1. **`AppLayout.tsx` — fixed a stale/wrong comment on the mobile-drawer scrim (A5).**
   The comment (written 2026-08-07, commit `91ea92e2`) claimed the scrim was "black/white,
   not the drawer's own green family." The very next day (commit `7adee89f`, 2026-08-08) the
   scrim was deliberately moved back to `bg-green-950/45` and the owner said "contrast looks
   better" (`OPEN-CHANGE-REQUESTS-2026-08-08.md`, C6 — "still not settled" but never reverted
   since). The **code was already correct**; only the comment lied about it — a T5-class trap
   (UI-STATE §6). Rewrote the comment to match the code and cite the source. No visual change.

2. **Deleted `CardstockHeader.tsx` and `header-cardstock.css`.** Verified zero real imports
   (`grep -rn "^import.*CardstockHeader"` — no hits; the only two hits in `src/` were prose
   mentions inside comments in `AppLayout.tsx` and `PageCreateButton.tsx`, not code). Both
   files are byte-identical to the backups already at
   `docs/reference/shelved-cardstock-header/*.txt`, so a restore is still two file copies away
   if the leather/cardstock direction ever returns (UI-STATE §6 T4, §"leather track"). Owner
   approved this exact deletion 2026-08-10 per UI-STATE T4. Confirmed post-deletion: build is
   clean, and grepping the shipped CSS for any `.cs-*` selector returns zero hits (was already
   zero before deletion — T4 was right that the subtree was structurally inert).

That's the entire diff: `git status --short` shows one modified file (comment only) and two
deletions.

---

## Item-by-item disposition

### Section A

| # | Task doc's diagnosis | Current state | Action |
|---|---|---|---|
| A1 | Hover gated to `lg:`, not `hover:hover` | Already `[@media(hover:hover)]:hover:underline` everywhere — no `lg:hover` in the file (`grep -n "lg:hover"` → 0 hits) | none, confirmed shipped |
| A2 | Selected state solid `bg-green-800` | `NAV_ROW_ACTIVE = 'bg-navfill/80 text-cream-25 font-medium'` — translucent, and the panel itself is no longer green at all | none, confirmed shipped |
| A3 | Stray "Menu" label at :1213 | No visible "Menu" text anywhere in the file (the one hit is `aria-label="Menu"` on the drawer's dialog role — accessibility metadata, not a rendered label) | none, confirmed shipped |
| A4 | `NAV_GLASS` = green glass panel | Panel is `NAV_PANEL = 'bg-cream-25'`, a solid opaque utility class. The whole "green glass" direction was reversed twice over (glass → solid green-800 → near-white) — see the long comment block at the top of `AppLayout.tsx` | none, confirmed shipped |
| A5 | Scrim "already `bg-black/40`" | **Was already stale when this task was written** — see "What actually changed" above | comment fixed |

### Section B

| # | Item | Disposition |
|---|---|---|
| B1 | Padding above/below Sign out | Already shipped (`OPEN-CHANGE-REQUESTS` B3, commit `1f562b6`) — `NavFooter` has a `border-t` + `pt-3` above the block and `pb-[max(0.75rem,env(safe-area-inset-bottom))]` below Sign out specifically. Confirmed by direct read. |
| B2 | Notification surfaces opaque → translucent | **Moot.** There is no standalone "notification surface" component — notifications live on the Dashboard page and surface only as a count badge on the nav link (`AppLayout.tsx` comment: "the notifications themselves live on the dashboard now — there is no bell"). The one badge (`NAV_BADGE`) is covered under C1b below. |
| B3 | Panel/button animate at different speeds | **Superseded.** `OPEN-CHANGE-REQUESTS` D: "instead of fixing that we just remove the tab from being carried." The floating drawer tab this was about no longer exists (ONEHEADER, A15) — there is no second element left to desync from. |
| B4 | Admin nav sections collapsible on mobile, not desktop | **Owner-deferred, do not build.** `OPEN-CHANGE-REQUESTS` A2: "DEFERRED until after the admin page-structure and menu-contents refactor" (`TASK-ADMINSWEEP`). Building this now would be working ahead of a decision the owner explicitly deferred. |

### Section C

| # | Item | Disposition |
|---|---|---|
| C1 | Nav legibility (worst design problem) | **Done — by exactly the fix this task itself recommended.** The panel is `cream-25` (near-white, `#fdfcfa`) at full opacity with `text-green-800` labels, 13.4:1 contrast (UI-STATE §2). Contrast is now a property of the panel, not a coincidence of the backdrop — no blur anywhere in the nav. |
| C1b | Badge opaque gold on translucent panel | **Moot for the same reason as B2** — the panel isn't translucent, so there's no mismatch to fix. The badge colour itself was separately litigated and closed: `UIO-010`, **Status: CLOSED 2026-08-10 — NO CHANGE.** Owner: *"the gold is already dark enough. i wouldnt change that."* Left exactly as `bg-gold-500 text-green-950` (7.86:1). |
| C1b | Drawer tab focus ring persists after click | **Moot.** The drawer tab doesn't exist — deleted entirely by ONEHEADER/A15 ("THE DRAWER TAB IS GONE," comment at `AppLayout.tsx`:1490). The header's avatar button is the only mobile nav control now, and it has its own `:focus-visible` rule in `app-header.css` (gold outline, 2px offset) — no persistence bug observed in code. |
| C2 | Three material languages (header/nav/buttons) | **Not implemented, correctly.** `OPEN-CHANGE-REQUESTS` A8: "LAST. Everything else first." The task doc itself says to bring options to the owner before building this — and the premise has partly changed anyway: the header is no longer textured cardstock (ONEHEADER made it flat/opaque, same lane as content), so the "three materials" framing is now closer to "one flat material, nav slightly raised by tone" than what the task doc described. Left for the owner; not attempted. |

### Section D — not this thread's job

All five D items (page-header placement) are `TASK-PAGEFRAME`'s scope, a separate active
task with its own worktree (`~/Downloads/claude-code-repo/wt-pageframe`) and an explicit
constraint of its own: *"Do not touch `AppLayout.tsx`, `AppHeader.tsx` or `app-header.css`."*
`PageHeader.tsx`/`PageLayout.tsx` already exist and `HorseRecordsPage.tsx` is already the
worked reference — building D here would duplicate or conflict with that thread.

**D5 specifically** (mobile menu button overlapping the new-contract button) is separately
confirmed solved: `OPEN-CHANGE-REQUESTS` A3 — "SOLVED BY A15 — reverting to the avatar button
removes the overlapping tab. No separate work." Confirmed in code: the avatar button now
lives inside the header's normal document flow (`AppHeader.tsx`), not floating over content
the way the old drawer tab did.

### Section E — desktop rail

| # | Item | Disposition |
|---|---|---|
| E1 | Community Feed icon undersized when collapsed | **Shipped** (`OPEN-CHANGE-REQUESTS` B5, commit `7c7b09d`). `CommunityNav`'s collapsed branch carries `shrink-0` on the `Users` icon, with a comment explaining exactly this failure mode. |
| E2 | Collapsed rail: `+` at top, toggle at foot | **Shipped** (B7, commit `42bbff2`). Confirmed by direct read — `AppLayout.tsx`:1349 (Add New) and :1451 (toggle, `mt-auto` at the foot). |
| E3 | Hover contrast too weak (`lg:hover:bg-green-800/10`) | **Superseded**, not just fixed. `UIO-013` removed the hover fill entirely — hover is now a gold underline on the text (`[@media(hover:hover)]:hover:underline`), not a background wash, so "10% is too weak" no longer applies to anything that exists. |
| E4 | Collapsed tooltip clipped to a green sliver | **Shipped** (B9, commit `1f562b6`) — exactly the task doc's own top recommendation (option 1, portal). `NavTooltipLabel` renders via `createPortal(..., document.body)`. |

### Section F — icon identity

| # | Item | Disposition |
|---|---|---|
| F1/F2 | Eight nav items share `Shield`, plus broken tooltips | Tooltips: fixed by E4 above. Icon reassignment: **blocked upstream**, not a MOBILEPASS decision. `OPEN-CHANGE-REQUESTS` A9: "Pending the ADMIN PAGE REFACTOR." `docs/reference/nav-icon-exercise.md` confirms the proposed merges (People, Documents, Barn, Oversight, Content, Settings) that the icon assignment depends on are not implemented — most of the assignment "cannot land until they exist." Nothing to build here without unilaterally doing the admin refactor, which is explicitly out of scope. |
| F3 | Account icon reads miniature | **Shipped**, same commit as E1 (B5, `7c7b09d`). `AccountNavLink` carries `shrink-0` on `UserRound`, same fix, same comment pattern. |
| F4 | Asymmetric collapse toggle (`PanelLeftClose` both states) | **Shipped** (B6, commit `7c7b09d`). Confirmed: `staffRailPinned ? <PanelLeftClose .../> : <PanelLeftOpen .../>` — the matched pair. |
| F5 | Sign-out glyph confusable with panel toggle | Spacing part: **done** — same fix as B1 (breathing room around Sign out). Glyph-choice part: **blocked with A9/A10** per `OPEN-CHANGE-REQUESTS`, same admin-refactor sequencing as F1. Not attempted. |

### Header (H1–H3) — all closed the same day, before this task doc's ink was dry

The task doc's own Header section was written 2026-08-08 00:01:23 (`git blame`, commit
`aab2a51b`). **`OPEN-CHANGE-REQUESTS-2026-08-08.md` closed all three items roughly 17 hours
later that same day** (commit `5be5991`, 17:19:41):

- **H1** (faint mobile wordmark) — *"Folded into A1. Both are relief-treatment problems that
  disappear when the header is replaced."*
- **H2** (unfilled FH monogram) — *"Folded into A1, same reason."*
- **H3** (the cut-off third item) — **already asked and already answered.** *"CLOSED
  2026-08-08. All three header complaints described the cardstock header, which is being
  replaced. Owner: 'none of that header message matters.'"*

A1 = ONEHEADER, which shipped that same day (commit `eaab867`) and replaced the cardstock
header entirely — no debossed relief anywhere in the new header by design (`app-header.css`
file header: *"No debossed relief anywhere. Relief needs a mid-tone surface to carve into; on
glass there is nothing to carve"*). Confirmed visually (see Verification below): the current
`.oh-mono` FH mark is a flat outline square with green ink, matching what the code says — not
a bug, a deliberate flat re-design of the mark.

**I did not need to ask the owner about H3.** The record already has the answer, and re-asking
a settled question is exactly the kind of thing `docs/ORCHESTRATOR-HANDOFF.md`'s 2026-08-11
entry calls out ("re-raising sequencing the owner had already settled").

---

## Verification

**Static checks — all clean, full output in this session:**
```
npm run typecheck        # 0 errors
npm run typecheck:api    # 0 errors
npm run lint              # 0 errors, 36 warnings (pre-existing drift beyond UI-STATE's
                          # 2026-08-09 baseline of ~26 — none of the 38 warning lines are in
                          # AppLayout.tsx's edited region or in either deleted file; the two
                          # AppLayout.tsx warnings present, at :346/:353, are pre-existing
                          # react-refresh warnings on unrelated exports, untouched by this task)
npm run build             # vite build + prerender + seo-files — clean, all 10 public pages
                          # prerendered without error
```
Grepped the shipped `dist/assets/*.css` per T1/T2: `bg-green-950/45`, `bg-cream-25`, and
`bg-navfill/80` all emit real rules (`#0a1a0f73`, `rgb(253 252 250 / ...)`, `#0d341ecc`), and
zero `.cs-*` selectors remain — confirms the cardstock deletion didn't silently break the one
class it might have shared a name with, and that nothing regressed.

**Browser sanity check — done, but limited.** No real Supabase credentials exist in this
worktree (a placeholder `.env`, copied from the main checkout, was added purely so `vite
build`'s prerender step doesn't throw — same setup already present in `wt-oneauthor`). I
started the dev server and drove it with Playwright:

- `/` (desktop, 1280px) and `/` (mobile viewport, 390×844) — load clean, zero console errors.
- `/app` and `/app/dashboard` — correctly redirect to the sign-in page (expected, no
  credentials), zero console errors, nothing crashes.
- Visually confirmed the FH monogram renders as a flat, unfilled green-outline square on the
  login header (same component family ONEHEADER adopted into the app) — matches what H2's
  code review found, corroborating that it's deliberate, not broken.

**What I could NOT verify, and did not claim to:** the actual in-app header, nav rail, mobile
drawer, hover states, and scrim — all of it is behind Supabase auth I don't have credentials
for in this worktree. Every "already shipped" claim above rests on reading the current source,
the shipped CSS, and the commits/owner-quotes in `OPEN-CHANGE-REQUESTS-2026-08-08.md` and
`UI-STATE-2026-08-09.md` — not on a live click-through of the authenticated app, and not on a
real phone. If any of those reconciliation docs are themselves wrong about what shipped, that
would only surface on a real device pass, which needs real credentials.

---

## Constraints honored

- Own worktree, `task/mobilepass` off `origin/main`, at `~/Downloads/claude-code-repo/wt-mobilepass`.
- `ClauseDocument.tsx` — not touched.
- `AppLayout.tsx`, `CardstockHeader.tsx`, `header-cardstock.css` — the only files touched
  (one edit, two deletions).
- Nav information architecture (labels, order, destinations) — untouched.
- Not pushed.
