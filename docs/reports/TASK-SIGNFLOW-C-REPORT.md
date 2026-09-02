# TASK-SIGNFLOW-C — REPORT

**Thread `FHE-TASK-SIGNFLOW-C` · change order `CR-102` (narrowed 2026-09-01) · worktree `wt-3` ·
branch `task/signflow-c` · merge-base `8edfe7fe` (= `origin/main` at report time, not moved) ·
commit `9f756570` (the build) + the docs commit below. 2026-09-02. ⚠️ NOT PUSHED. ORCH merges.**
Ledger: `docs/reports/FHE-TASK-SIGNFLOW-C-LEDGER.md`.

## 0. CLNR PASS (zeroth act)
**Not clean; NOTHING WAS MOVED** — `wt-2` is dispatching (`SITESEO`) and ORCH6's HOLD on
`CLNR-REPO-STATE` stands. Findings, one line each:
- **Resumability (§2b): PASS for all five roles** — `ORCHESTRATOR.md` · `DISCO-ROLE.md` · `DSNR-ROLE.md` ·
  `TASK-ROLE.md` · `CLNR-ROLE.md`; state at `docs/orch/BOARD.md`; my spec findable from my identifier.
- Loose files at `docs/` root: **0**. Folders outside §2a (pre-existing): `contract-content/` ·
  `contract-exports/` · `proposed/` · `staged/` · `ui-orders/`.
- `docs/method/` still holds STATE: `03-REMAINING-WORK.md` · `04-OPEN-QUESTIONS.md` ·
  `ORCH6-FOR-REVIEW-2026-09-01.md` · `BENCH-TEST-2026-09-01.md` (B's finding, unchanged).
- Reports with no `## VALIDATION`: now **6** (SIGNSTRIP, SIGNDOOR, AR4, REAPER, MODAL2, CR85) — down
  from B's 10; the backfill is on the board.
- **72 merged `task/*` branches** not deleted. **9 stray files** at the shared-workspace root
  (`TASK-*.md` ×4, `COMPLIANCE-FINDINGS.md`, two `.html`, `orchestration.zip`, `v2authoringbrief.md`).
- Worktrees at entry: all three detached at `8edfe7fe`, clean. Process census at entry: empty.

---

## 1. THE HEADLINE
**The signing flow is green from `/sign/:path` through the sign button; the rest of the app is
byte-for-byte untouched.** 175 inline `gold-N` → `green-N` in 11 files; one scope class
`.flow-green` re-points the seven shared classes that painted the public door brown; `.btn-sign`
flipped in place. **13 files changed, all on the spec's list. Every one of the 44 distinct green
classes introduced has a rule in the built CSS, and the `.flow-green` block emitted (pasted in §2.3).**
⚠️ **One gap the spec did not list, reported not fixed (§4): `/sign` itself — the funnel CHOOSER
before `/sign/:path` — carries 9 `.eyebrow` labels and stays brown. One-line diff for ORCH.**

---

## 2. CRITERION BY CRITERION AGAINST §10

### 1 · `git diff --stat` ≤ 14 files — **13, all on the list.** No 15th; `DocsParticipantFlow.tsx` and
`Release.tsx` do not appear (they no longer exist — SIGNFLOW-D deleted them).
```
$ git diff --name-only 8edfe7fe HEAD
docs/reports/FHE-TASK-SIGNFLOW-C-LEDGER.md      (docs — not one of the 13 code files)
src/components/app/AddElementModal.tsx
src/components/app/ClauseDocument.tsx
src/components/app/ContractActivityCard.tsx
src/components/app/ContractCascade.tsx
src/components/app/ContractChangeRequests.tsx
src/components/app/ContractDrawer.tsx
src/components/app/ContractSubheader.tsx
src/components/app/DocumentsContent.tsx
src/components/app/PartyDocumentView.tsx
src/index.css
src/pages/SignStart.tsx
src/pages/app/ContractPage.tsx
src/pages/app/Onboarding.tsx
 13 files changed, 202 insertions(+), 119 deletions(-)      (src only)
```
`DocumentViewerPage.tsx`: 0 gold on main, untouched, as the spec said.

### 2 · zero `gold-[0-9]+` in the §3 files; app-wide **568 → 388**, ⚠️ NOT 393 — explained.
```
$ for f in <the 11 files>; do grep -cE 'gold-[0-9]+' $f; done      → 0 for all 11
$ grep -rEo 'gold-[0-9]+' src | wc -l          main: 568    branch: 388
per-file delta main→branch (every other file in src: unchanged):
  AddElementModal 34→0 · ClauseDocument 11→0 · ContractActivityCard 6→0 · ContractCascade 40→0
  ContractChangeRequests 12→0 · ContractDrawer 5→0 · ContractSubheader 5→0 · DocumentsContent 2→0
  PartyDocumentView 3→0 · ContractPage 41→0 · Onboarding 16→0                 = −175
  src/index.css 31→26                                                          = −5
```
**Why 388:** the spec's 393 = 568 − 175 assumed `index.css` keeps all 31 of its refs. But §5.2 of the
same spec orders the `.btn-sign` flip, which removes **7** (`bg/border-gold-800`, `hover:*-gold-700` ×2,
`active:*-gold-600` ×2, `ring-gold-800`); the rewritten `.btn-sign` comment still names the three old
steps (+3, −3, net 0); and the `.flow-green` block adds **2** (the escaped selector
`.decoration-gold-500\/60` and the comment line naming it). 568 − 175 − 7 + 2 = **388**. The 393 was
the spec forgetting its own §5.2. ⚠️ **The base classes it lists in §5 keep every gold ref — pasted:**
```
$ grep -nE 'gold-[0-9]+' src/index.css   (the definitions, unchanged)
157 .text-gold-ink  { @apply text-gold-800; }      161 .text-gold-accent { @apply text-gold-400; }
165 .eyebrow … text-gold-800                        169 .eyebrow-on-dark … text-gold-400
196 .rule-gold … border-gold-600/30                 206 .focus-ring … ring-gold-800
217 .btn-primary … ring-gold-800                    223-227 .btn-outline-gold … gold-800 (×5)
277 .link-underline … ring-gold-800                 289 .form-input … focus:border-gold-800 focus:ring-gold-800/40
325 .step-complete … bg-gold-600                    335 .selectable-card … ring-gold-800
```

### 3 · THE T1 PROOF — the built CSS (`dist/assets/index-CcSHDESC.css`, 108,431 B)
**(a) Every distinct green class introduced in the 12 `.tsx` files — 44 — has an emitted rule. 0 missing.**
Script: `scratchpad/t1proof.mjs` — takes every `…green-N[/M]` token from the added lines of
`git diff 8edfe7fe HEAD -- src/pages src/components`, escapes it as Tailwind does (`\:` `\/` `\.`),
and requires `.<escaped>` followed by a non-identifier char in the CSS.
```
✓ bg-green-100        ✓ bg-green-100/70     ✓ bg-green-200        ✓ bg-green-400/30     ✓ bg-green-400/70
✓ bg-green-50         ✓ bg-green-50/30      ✓ bg-green-50/40      ✓ bg-green-50/50      ✓ bg-green-50/60
✓ bg-green-50/70      ✓ bg-green-500        ✓ bg-green-600        ✓ bg-green-800/10     ✓ border-green-200
✓ border-green-400    ✓ border-green-400/40 ✓ border-green-400/50 ✓ border-green-400/60 ✓ border-green-400/70
✓ border-green-500    ✓ border-green-500/40 ✓ border-green-600    ✓ border-green-600/30 ✓ border-green-600/40
✓ border-green-800/10 ✓ border-green-800/20 ✓ disabled:text-green-900   ✓ focus:bg-green-50   ✓ focus:border-green-600
✓ hover:bg-green-100  ✓ hover:bg-green-50   ✓ hover:border-green-400/60 ✓ hover:text-green-800
✓ md:hover:decoration-green-600             ✓ placeholder:text-green-800/40   ✓ ring-green-200   ✓ ring-green-300/70
✓ text-green-700      ✓ text-green-700/90   ✓ text-green-800      ✓ text-green-800/40   ✓ text-green-900   ✓ text-green-900/90
distinct green classes introduced in tsx: 44; missing from built CSS: 0
```
Every opacity suffix used (10, 20, 30, 40, 50, 60, 70, 90) was already in the scale — the swap kept the
suffix, so no new `/N` was introduced. `border-green-800/10` and `/20` above are not new classes at all
(they pre-exist app-wide); the script lists them because the diff re-emitted the lines they sit on.

**(b) THE `.flow-green` BLOCK EMITTED — T2. `@apply` with variants inside a descendant selector
compiled under this Tailwind 3.4 setup; no plain-CSS fallback was needed:**
```
$ grep -o '\.flow-green[^{]*{[^}]*}' dist/assets/*.css
.flow-green .eyebrow,.flow-green .text-gold-ink{--tw-text-opacity: 1;color:rgb(20 51 33 / var(--tw-text-opacity, 1))}
.flow-green .focus-ring:focus-visible{--tw-ring-opacity: 1;--tw-ring-color: rgb(20 51 33 / var(--tw-ring-opacity, 1))}
.flow-green .btn-primary:focus-visible{--tw-ring-opacity: 1;--tw-ring-color: rgb(20 51 33 / var(--tw-ring-opacity, 1))}
.flow-green .form-input:focus{--tw-border-opacity: 1;border-color:rgb(20 51 33 / var(--tw-border-opacity, 1));--tw-ring-color: rgb(20 51 33 / .4)}
.flow-green .form-input-error:focus{--tw-border-opacity: 1;border-color:rgb(220 38 38 / var(--tw-border-opacity, 1));--tw-ring-color: rgb(220 38 38 / .4)}
.flow-green .btn-outline-gold{--tw-border-opacity: 1;border-color:rgb(20 51 33 / …);--tw-text-opacity: 1;color:rgb(20 51 33 / …)}
.flow-green .btn-outline-gold:hover{--tw-bg-opacity: 1;background-color:rgb(20 51 33 / …);--tw-text-opacity: 1;color:rgb(255 255 255 / …)}
.flow-green .btn-outline-gold:focus-visible{--tw-ring-opacity: 1;--tw-ring-color: rgb(20 51 33 / …)}
.flow-green .btn-outline-gold:hover:disabled{background-color:transparent;--tw-text-opacity: 1;color:rgb(20 51 33 / …)}
.flow-green .decoration-gold-500\/60{text-decoration-color:#2d704399}
```
`rgb(20 51 33)` is `green-800 #143321`. No `!important` anywhere. Specificity, confirmed not assumed:
`.flow-green .eyebrow` (0,2,0) > `.eyebrow` (0,1,0); `.flow-green .focus-ring:focus-visible` (0,3,0) >
`.focus-ring:focus-visible` (0,2,0); `.flow-green .btn-outline-gold:hover:disabled` (0,4,0) >
`.btn-outline-gold:disabled:hover` (0,3,0). I also grepped the 12 files for any element that pairs a
scoped class with an inline colour utility (`eyebrow … text-*`, `focus-ring … focus-visible:ring-*`,
`form-input … focus:border-*`) — **none**, so the scope's higher specificity overrides nothing it
should not.

**(c) The gold accents survive — both forms, because Tailwind emits `rgb(r g b / …)`, not hex.**
⚠️ **The spec's hex grep is non-zero only by accident** (`::selection`'s literal `#BA9935` and
hex-with-alpha decorations); the rgb triplet is the real count. Both non-zero:
```
$ grep -o '#ba9935\|#7a6421\|#5c4a18' dist/assets/*.css | sort | uniq -c
   3 #5c4a18      4 #7a6421     16 #ba9935
$ grep -o 'rgb(186 153 53' | wc -l → 8  (gold-600)   'rgb(122 100 33' → 15 (gold-800)   'rgb(92 74 24' → 2 (gold-900)
```

### 4 · gates — `typecheck` 0 · `typecheck:api` 0 · lint **0 errors / 45 warnings** (= SIGNFLOW-A's
stash-measured baseline of 45; `CLAUDE.md`'s 48 and the board's 46 are stale) · `npm run build` ✓ ·
`test:api` 7/7. `test:db` not run, per the spec.

### 5–8, 10 · RENDERS — NOT VERIFIED BY ME (`TASK-ROLE.md` §3). The checklist is §8.
What I can prove from source for each, I have:
- **5** Onboarding: 16→0 inline gold; the eyebrow/outline-button/focus/input classes re-pointed under
  the root `div.flow-green` (`Onboarding.tsx:1422`). **T7 — strikethrough already correct:**
  `Onboarding.tsx:1985` is `text-muted line-through`, no brown, **untouched.**
- **6** `.btn-sign` states in the built CSS: armed `rgb(20 51 33)` green-800 · hover green-700
  `rgb(26 68 41)` · active green-600 `rgb(33 85 49)` · disabled transparent + `border-green-800/20` +
  `text-green-900/40` (unchanged). Four distinct states, hue only. White-on-fill contrast **13.77 /
  11.04 / 8.72 : 1** (was 5.72 / 4.11 / 2.73 in gold — the press state was under AA before).
- **7** `/sign/:path` had **0 inline gold on main** and still has 0; every gold there arrives via
  `.eyebrow` (×1), `.btn-outline-gold` (×1), `.btn-primary` (×3), `.focus-ring` (×2), `.form-input` (×10) —
  all re-pointed by `.flow-green`, applied on **all four** top-level `<section>`s (`SignStart.tsx:495,
  514, 528, 777`) because the page returns a fragment. No wrapper added, no DOM change.
- **8** The contract surface: ContractPage root `div.flow-green` (`:1286`). **T5 measured:** the
  shared `Modal` kit (`ops/kit/Modal.tsx`) does **not** portal — it renders `fixed inset-0` in-tree —
  so the send modal, ConfirmName, CaptureInfo, Void, AddHorse, ReviewChanges, NotifyConfirm and the
  `/app/documents` PaperViewer are all DOM descendants and covered. **The ONE portal in the flow is
  `AddElementModal.tsx:964` (`createPortal` to `<body>`)** — it carries `panelClassName="flow-green"`
  (`:966`) on the dialog panel. `ContractDrawer` renders in-tree (no portal). `ExplainTip` portals its
  bubble, which is green-only; its in-tree trigger's dotted underline is handled (§5d).
- **10** Staff tooling still brown, on purpose — refs unchanged, files untouched:
  `DocumentSurface` 13 · `FormSurface` 10 · `EmailSurface` 3 · `SurfaceVersions` 1 · `TokenPicker` 3 ·
  `DocumentsQueuePage` 4 · `DocumentQueueTable` 1 (`git diff … --stat` = 0 lines for each).

### 9 · THE REST OF THE APP IS UNCHANGED — from source, and it carries equal weight
`AppLayout.tsx` (27 gold refs) · `Header.tsx` (13) · `Footer.tsx` (5) · `RosterCard.tsx` (2, the
client avatar ring) — **all four: 0 lines changed.** No file outside the 13 is in the diff, so the nav
row + underline, the count badges, the notification count, the avatar rings, header, footer, every
marketing page, every ops page and the booking flow's `.step-complete` dots and `.rule-gold` rules
compile from exactly the source they had on `main`. The only CSS that can reach them is `.btn-sign`
(2 adopters, both in the flow) and `.flow-green …` (needs the ancestor class; applied in 5 files, none
of them a shell). The owner's render check for this is §8.9.

### 11 · §6 deviations, with reasons — and the contrast ratios
**Deviation 1 (placeholder / hint text) — the five sites the spec named, at their post-A line numbers
(−4 from the spec):**
| `ContractCascade.tsx` | was | same-step would be | shipped | why |
|---|---|---|---|---|
| `:1072` `inlineBase` | `placeholder:text-gold-700/70` | `green-700/70` = 4.44:1 — darker than every real hint | `placeholder:text-green-800/40` | the `.form-input` placeholder token (`index.css:290`) |
| `:1227` select w/o value | `text-gold-700/80 italic` | `green-700/80` | `text-green-800/40 italic` | it is a placeholder rendered as the select's own text; same token |
| `:1356` ⟲ source tip | `text-gold-700/80` | `green-700/80` | `text-muted` | hint glyph → the muted token (`index.css:156`) |
| `:1711` ⓘ insurance tip | `text-gold-700` | `green-700` | `text-muted` | hint glyph |
| `:1714` ⟲ source tip | `text-gold-700/80` | `green-700/80` | `text-muted` | hint glyph |
Ratios (node, `scratchpad/contrast.mjs`): `text-muted` glyph on white **5.32:1** (was 2.94);
placeholder `green-800/40` over the `green-50/70` field wash **2.28:1** (was 2.45 in gold) — that is
the app's incumbent placeholder token everywhere else and the spec named it; not changed.
**Deviation 2 (white text on a `gold-500/600` fill) — ZERO cases among the 175.** The only white-on-fill
in the flow is `.btn-sign` (ratios in §2.6). Other changed text-on-fill pairs, all AA:
"Start here" pill `green-900` on `green-200` **8.79** (was 6.34) · ⟦NEEDS⟧ mark `green-900` on
`green-100` **12.34** (was 7.30) · banner strips `green-900` on `green-50` **15.36** (was 8.07) ·
dashed "Add …" controls `green-800` on `green-50` hover **12.56** (was 5.38) · captions `green-700/90`
on white **8.19** (was 3.49 — under AA before).

---

## 3. THE REACH — file and line
| # | What a person does | Route | Root that carries `.flow-green` |
|---|---|---|---|
| 1 | member signs in with a pending set → wall → `/app/onboarding` | `App.tsx:259-266` | `Onboarding.tsx:1422` |
| 2 | `/app/documents` → **Read** · Account → My Documents → Read | `App.tsx:292`, `AccountHub.tsx:190-191` | `DocumentsContent.tsx:453` (its own root, so both hosts) |
| 3 | `/app/contracts/:id` as a party | `App.tsx:328` | `ContractPage.tsx:1286` |
| 4 | Add Item on that surface (staff) | `ContractSubheader` → `AddElementButton` | `AddElementModal.tsx:966` (portal panel) |
| 5 | `/sign/guest` · `/sign/rider` · `/sign/horse` · `/sign/rider+horse` · `/sign/deal`, logged out | `App.tsx:187` | `SignStart.tsx:495, 514, 528, 777` |
| 6 | `/app/ops/documents/:id` | `App.tsx:390` | none needed — 0 gold, verified |
⚠️ **And the one reach the spec missed: `/sign` (no path) — `App.tsx:186` → `SignChoose.tsx`,** the
page that offers the four funnels. 9 `.eyebrow` + 1 `.focus-ring`, 0 inline gold. Outside §3 → §4.

## 3b. §2c — THE THREE QUESTIONS
This task captures **no value**: no column, no jsonb key, no RPC, no copy. CSS classes only.
Seen: every surface in §3. Acted on: n/a. What else the outcome needs that nobody asked for:
**`SignChoose.tsx` (§4, first line)** — without it the public flow's first page is brown and the
next four are green.

---

## 4. FLAGGED, NOT FIXED
- **`/sign` chooser is brown** — `SignChoose.tsx:86` returns a fragment with 9 `.eyebrow`s. **Diff for
  ORCH: add ` flow-green` to each top-level `<section>` className (same treatment as `SignStart`).**
  No inline gold there, so that is the whole change.
- `::selection` is a literal `#BA9935` in `index.css:97` (base layer, app-wide) — text selected inside a
  contract highlights gold. Not scoped; the owner has not named it.
- `Onboarding.tsx:106-108/:621` stale payment-step comments — already on the board (wave-2 batch).

## 5. DECIDED — what the spec did not decide, and why
1. **`.btn-primary`'s focus ring is in the scope.** The spec's five classes omit it; it has 23 adopters
   in the 12 files (SignStart ×3, ContractPage ×9, Onboarding ×7…) and its ring is `gold-800`. Item 7
   ("focus rings green when tabbing") fails without it. One line, same block.
2. **`.form-input-error` is re-declared red inside the scope.** Zero adopters in the flow today, but
   `.flow-green .form-input:focus` (0,3,0) would out-rank `.form-input-error:focus` (0,2,0) and paint
   an invalid field green the day one appears. Placed after `.form-input` so the tie resolves by order.
3. **`disabled:hover` re-declared on `.btn-outline-gold`.** Base `.btn-outline-gold:disabled:hover`
   (0,3,0) ties with `.flow-green .btn-outline-gold:hover` (0,3,0); without the line a disabled outline
   button would fill green on hover inside the flow.
4. **ExplainTip's dotted underline** (`decoration-gold-500/60`, `ExplainTip.tsx:145`, `underline`
   defaults to **true**, 5 bare uses in `ClauseDocument.tsx`) is re-pointed by escaped utility name
   inside the scope block. `ExplainTip.tsx` is outside §3, and changing it there would repaint every
   tip app-wide — the scope is the only place that touches the flow alone.
5. **`SignStart`: class on each of the four `<section>`s, not a wrapper `div`** — no new DOM node, so
   T6 (no layout change) holds by construction.
6. **`AddElementModal` via the kit's existing `panelClassName` prop**, not a wrapper inside the portal.
7. **The scope block sits at the END of `@layer components`**, so any specificity tie with a base class
   resolves in the scope's favour by source order.
8. **Comments corrected so none lies about the hue:** `ContractChangeRequests.tsx:376` ("gold ring") ·
   `ContractDrawer.tsx:32-40` · `ContractSubheader.tsx:271` · `AddElementModal.tsx:36, 703` ·
   `ClauseDocument.tsx:968` · `Onboarding.tsx:115, 2089` — the two owner quotes about the evaluation
   lesson's "gold outline" are kept **verbatim** with a CR-102 note appended, not rewritten.
9. ⚠️ **A design consequence the ruling produces, stated so nobody discovers it on screen:** three
   surfaces used gold-vs-green as a SEMANTIC pair — `ContractDrawer` (requests = gold, history = green,
   "so a reader can tell them apart at a glance"), `ContractActivityCard` (SENT/DELIVERED gold vs SIGNED
   green), `ContractSubheader` (open state gold). Under "no exceptions, no keepers" they are now
   light-green vs deep-green (`green-400/60` ring vs `green-700/40`; `green-50` chip with
   `border-green-400/50` vs `border-green-700/30`). Distinguishable, but less so. Executed as ruled; if
   the owner wants the pair back it is a DSNR question, not mine.

## 6. WHERE THE SPEC WAS WRONG
- **§10.2's 393** — forgot its own §5.2 `.btn-sign` flip (−7 in `index.css`). Real number **388**.
- **§10.3's hex grep** — Tailwind emits `rgb(r g b / …)`; hex survives only in `::selection` and
  alpha-hex decorations. Both forms reported; both non-zero.
- **§4's "five classes"** — six and a utility: `.btn-primary`'s ring and ExplainTip's underline also
  paint the flow brown. Handled (§5.1, §5.4).
- **§5.2's "three adopters"** — two. `Release.tsx` is deleted (SIGNFLOW-D merged `e2f3dabf`).
- **§9's reach** — omits `/sign` itself (`SignChoose.tsx`). §4 has the diff.
- **T5's framing** — the shared `Modal` kit does not portal; only `AddElementModal` does. Measured, not
  assumed.
- **Line numbers** — ContractCascade deviations at 1072/1227/1356/1711/1714 (spec: +4);
  `btn-sign` adopters at `Onboarding.tsx:2058` (spec: 2046) and `ContractPage.tsx:2307` before my edit;
  now 2063 / 2312 after the comments I added above the roots.

## 7. GATES
| gate | result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run typecheck:api` | 0 errors |
| `npm run lint` | 0 errors · 45 warnings (= A's measured baseline) |
| `npm run build` | ✓ (vite + prerender + seo-files) |
| `npm run test:api` | 7 / 7 |
| `npm run test:db` | not run — red at baseline, proves nothing |

## 8. THE OWNER'S RENDER CHECKLIST — on the phone (iPhone Safari) AND a desktop browser
1. **`/app/onboarding`** as a member with a pending set: the documents list, the reader, the e-sign
   consent row, every panel and banner — **zero brown**. A completed document is still struck through
   in muted green (unchanged).
2. **The sign button, four states, named:** (a) unarmed = muted grey outline · (b) type your name and tick
   consent → **filled green** · (c) mouse over → lighter green · (d) press and hold → lighter again.
   Three distinct greens, then release.
3. 🔒 **Logged OUT, on the phone:** `/sign/guest`, `/sign/rider`, `/sign/horse`, `/sign/rider+horse`,
   `/sign/deal`. The "GET STARTED" eyebrow is **green**; "Copy our email address" is a **green outline**
   button that fills green on hover; tab through the form — every focus ring **green**; tap into the
   email box — the focus border and halo **green**. **This is the proof `.flow-green` landed.**
   ⚠️ Then open plain **`/sign`** (the chooser): its labels are **still brown** — expected, §4, one line
   for ORCH.
4. **`/app/contracts/:id` as a party:** banner strips, change-request and amendment cards, the activity
   card chips, the subheader's open-drawer state, inline fields and their underlines, ⟦NEEDS⟧ marks, the
   dashed "Add …" controls, the ⓘ / ⟲ glyphs — **zero brown.** Open the **Change requests** drawer and,
   as staff, **Add Item** (the modal) — both green. Hover a clause tip: the dotted underline is green.
5. **`/app/documents` → Read**, and **Account → My Documents → Read**: the document icons and the
   "Awaiting your signature" line green; the Read/outline buttons green; the paper reader's close X ring
   green when tabbed.
6. 🔒 **UNCHANGED — check each and report any that turned green as a defect:** the `/app` nav's selected
   row and its underline · a nav count badge · the notification count · a **client's** contact-card avatar
   ring (**must be gold**) · the public header and footer · one marketing page (`/ride`) · one ops page
   (`/app/ops/documents`) · the booking flow's step dots and divider rules.
7. **Still brown on purpose:** the template editors (Document / Form / Email surfaces, the token picker)
   and the documents queue.

## 9. TEARDOWN — census
```
$ git worktree list
/Users/Cactai/Downloads/claude-code-repo/fhe-website-app 8edfe7fe [main]
/Users/Cactai/Downloads/claude-code-repo/wt-1            8edfe7fe (detached HEAD)
/Users/Cactai/Downloads/claude-code-repo/wt-2            8edfe7fe (detached HEAD)
/Users/Cactai/Downloads/claude-code-repo/wt-3            (tip of task/signflow-c) [task/signflow-c]   ← mine
$ ps aux | grep -E 'vite|node |vitest|playwright|chromium|esbuild' | grep -v grep
(empty — I started no server or browser; the build and tests exited)
```
Scratch files: `scratchpad/contrast.mjs`, `scratchpad/t1proof.mjs` (session scratchpad, outside the repo).
`dist/` in `wt-3` is the build output, gitignored. **Nothing pushed.**

---

## VALIDATION
*(ORCH appends its verdict here — `TASK-SIGNFLOW-C-VERIFICATION.md` beside this file.)*
