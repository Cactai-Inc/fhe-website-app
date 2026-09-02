# FHE-DSNR-SIGNFLOW — LEDGER

**Opened 2026-09-01. Role: `docs/method/DSNR-ROLE.md`. Upstream: `docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md`.**
**Subject: CR-100 (address normalize), CR-101 (SIG token readers), CR-102 (brown→green).**

## RESUME
- **State:** 🔒 **DONE.** All three CRs verified, chunked into 6 specs, handed to ORCH. **This thread
  is finished; a new handoff gets a new thread** (`docs/method/DSNR-ROLE.md` LIFECYCLE).
- **Written:** this ledger · `docs/tasks/TASK-SIGNFLOW-{A,B,C,D,E,F}-*.md` ·
  `docs/reports/FHE-DSNR-SIGNFLOW-HANDOFF.md`. All committed, none pushed.
- **Chunks (REVISED, see below):** A=CR-101 five readers · B=CR-100 address kinds · C=CR-102 the
  signing flow only (15 files, 175 refs + a `.flow-green` scope class). **A‖B file-disjoint; C follows both.**
- **Next station:** `FHE-ORCH-SIGNFLOW`. **Nothing blocks dispatch.** D returns 3 owner questions.

## 🔒 REVISION 2 — 2026-09-01, OWNER RETIRES `/release` AND `/docs/release-participant`
**Verbatim:** *"we dont use docs/release-participant nor /release, those urls if they are still
operational should be traced and most likely anything associated with them should be decommissioned
and the /sign/ flow should be the single pathway we use and just have different ways of getting there
to accommodate the various scenarios/places/events a client would be served with the link to it."*

**Trace run by DSNR 2026-09-01 (code only — no production access, see below):**
- Routes live and unguarded: `src/App.tsx:237`, `:238`, `:240`.
- 🔒 **Nothing in shipped code links to either**, except `src/lib/reviewSection.ts:283` (the admin
  Review page's diagnostic slot D, already labelled `DESTRUCTIVE`). **No email template, seed or
  migration contains either URL** — `grep -rn "release-participant|/release" supabase/` → zero.
- 🔒 **THE FINDING: `api/sign-release.ts:41-47` builds an ANON client and `:133` calls `sign_release`
  with it.** So `sign_release` still holds an `anon` grant, and
  `supabase/migrations/20260831T1200_signing_rpcs_are_not_anonymous.sql:21-23` spared it explicitly
  *"the public kiosk paths sign through sign_release / sign_general_release, which are untouched
  here."* **These two pages are the only reason an unauthenticated stranger can still write a contact,
  an engagement and an EXECUTED document.** Retiring them closes what TASK-AR7, TASK-FIX1 and the
  ORCH5 audit each flagged and could not close.
- ⚠️ **`/sign/` does NOT do what they do.** They SIGN on the spot with no account (`signRelease` →
  `POST /api/sign-release` → `sign_release`); `/sign/` CAPTURES a request (`POST /api/sign-start`,
  `SignStart.tsx:449`) and the person signs later in their own account. **Retirement removes
  same-moment signing. Flagged as Q2 to the owner; NOT decided by me.**
- `/sign/guest` does already exist — `FLOW-MAP.md:159` (X9, withdrawn 2026-08-20), `SignChoose.tsx:40`.
- ⚠️ **NOT MEASURED: whether anything was ever signed through these flows in production.** The repo's
  `.env` holds only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. `FLOW-MAP.md:24` (F3) claims 35
  delivery rows — **a document, therefore a hypothesis.** D must re-count it.

**Actions taken:**
- **New `docs/tasks/TASK-SIGNFLOW-D-retire-the-two-signing-doors-we-do-not-use.md`** — two phases in
  one thread; Phase 1 measures and deletes nothing, Phase 2 removes only on a clean Phase 1, with four
  STOP conditions. **No DB row touched (D32); the only migration is a REVOKE/GRANT; the functions are
  not dropped.**
- **`A` amended** — readers 3 and 4 (`DocsParticipantFlow.tsx:432`, `Release.tsx:274`) stay on its list
  because the single shared-renderer edit fixes them at zero cost, but are marked RETIRING: no code
  aimed at them, no verification, one line in the report.
- **`C` amended** — both pages CUT from the file list (15→13) and from `.flow-green` (6→4 application
  points); public-door test narrowed to `/sign/...`. `.btn-sign`'s `Release.tsx:466` adopter is
  incidental and costs nothing.

## 🔒 REVISION 2026-09-01 — THE OWNER NARROWED CR-102 AND STRUCK MY PREMISE
**He read the first handoff and ruled, verbatim:** *"just change the items to green, leave the gold
used in the app nav and other accents throughout the app in their light gold color. the signing flow
from first page through the last should switch the gold to green for sure. other pages can be
evaluated on a case by case basis when i have the opportunity to view them. dont change things in the
app arbitrarily."*
**And on the affordance argument I built the app-wide §4.1 around:** *"the document is set inside a
contained box that is clearly differentiated from the app surface. and green vs gold would not change
how the viewer interprets whether or not the content is an app surface."*
🔒 **He is right. Containment does that work, not hue. There was nothing to preserve, and the whole
four-chunk app-wide split existed to manage a scope he did not want.**
- **Archived, never dispatched:** `docs/archive/TASK-SIGNFLOW-{C,D,E,F}-*-SUPERSEDED-2026-09-01.md`,
  each with his ruling on line 1.
- **A and B untouched** — CR-101 and CR-100, which he did not comment on.
- **New C:** `docs/tasks/TASK-SIGNFLOW-C-green-the-signing-flow-end-to-end.md`.
- 🔒 **THE STRUCTURAL FINDING THAT SHAPES THE NEW C, measured 2026-09-01:** the three PUBLIC signing
  doors have **ZERO** inline gold — `grep -oE 'gold-[0-9]+'` returns 0 for `SignStart.tsx`,
  `DocsParticipantFlow.tsx` and `Release.tsx`. **All their brown arrives through five GLOBAL classes**
  (`.eyebrow` 57 files · `.btn-outline-gold` 44 · `.focus-ring` 122 · `.form-input` 95 ·
  `.text-gold-ink` 30). **So replacing inline classes alone leaves a third of the signing flow
  untouched, and flipping the globals repaints the app he said not to touch.**
  **Resolution: a `.flow-green` scope class, ~6 application points, zero effect outside the flow.**
- **`.btn-sign` flips outright instead** — verified exactly 3 adopters, all in the flow
  (`Release.tsx:466`, `Onboarding.tsx:2046`, `ContractPage.tsx:2307`).
- **Cut from scope:** the staff template/queue tooling (DocumentSurface 13, FormSurface 10,
  EmailSurface 3, SurfaceVersions 1, TokenPicker 3, DocumentsQueuePage 4, DocumentQueueTable 1 = 35
  refs) — authoring tools, not the signing flow. **C's test item 10 makes the build CONFIRM they are
  still brown.**
- **Totals: 175 of 568 gold refs change; 393 stay gold.**

## LOG
- 2026-09-01 — thread opened. Handoff has no open owner questions; all three CRs locked.

## CR-101 — VERIFIED 2026-09-01 (DSNR's own greps, not inherited)
- `resolveUnsignedSignatureTokens` exists **3 times**: `src/components/app/ContractCascade.tsx:289` (exported),
  `src/lib/documentPdf.ts:89` (private), `api/_lib/documentPdf.ts:88` (private). Commit `71993bb2` confirmed
  ("docs: an unsigned document stops showing its signature machinery").
- `<ContractBody>` adopters (resolved, CORRECT today): `FlatDocument.tsx:66`, `PartyDocumentView.tsx:191`,
  `ContractPage.tsx:1795 / 2195 / 2215`.
- ⚠️ **DISCO named THREE raw readers. There are FOUR.** `BodyWithSignatures` (`MergedBodyView.tsx:30`) resolves
  nothing, and its callers are:
  1. `src/pages/app/Onboarding.tsx:1994` — DISCO said 1963. **Line was stale; surface confirmed.**
  2. `src/pages/app/ops/DocumentViewerPage.tsx:200` via `MergedBodyView` — confirmed.
  3. ⚠️ **`src/pages/DocsParticipantFlow.tsx:432` — MISSED BY DISCO.** Public participant signing flow,
     route `/docs/release-participant` (`src/App.tsx:240`). Renders an UNSIGNED `previewBody` pre-signature.
     Same defect, same fix.
  4. `src/pages/Release.tsx:274` — executed body only. DISCO correct that it is unaffected.
- 5th reader, no `BodyWithSignatures` at all: `PaperViewer` (`DocumentsContent.tsx:139`) renders
  `{doc.pages[page]}` raw. ⚠️ Pagination happens BEFORE render (`paginateBody`, called at
  `DocumentsContent.tsx:273` and `:507`), so resolution must happen on the body BEFORE `paginateBody`,
  not inside the viewer.
- 🔒 CONSTRAINT, from `src/lib/documentPdf.ts:13-17` verbatim: *"the two tsconfig projects (`api` and `src`)
  share no module, so ANY change to one MUST be made to the other."* Confirmed: `grep` finds zero imports
  from `api/` into `src/`. So `api/_lib/documentPdf.ts` stays a deliberate twin; only the two `src` copies
  can converge.

## CR-100 — VERIFIED 2026-09-01
- Spine confirmed: `src/lib/normalize.ts` (kinds `name|phone|email`), `useFieldNormalizer`
  (`src/lib/formState.ts:367`), `normalizeKindForField` (`normalize.ts:127`).
- ⚠️ **TRAP DISCO DID NOT NAME — the incumbent argues AGAINST this CR in writing.**
  `normalize.ts:120-126` verbatim: *"⚠️ Deliberately narrow. Owner named three things … and a city or
  a street is NOT one of them. Widening this is a product decision, not a tidy-up: `po box 12` is not
  improved by `Po Box 12`."* And `src/lib/normalize.test.ts:130-131` ASSERTS
  `normalizeKindForField('city') === null` and `('address_line1') === null`. **A build thread that does
  not know CR-100 supersedes this will either revert itself or leave the tests red.**
- ⚠️ **TRAP — substring collision.** `normalizeKindForField` matches with `.includes()`. `'capacity'`
  contains `'city'`. Verified: only caller is `ContactDossierModal.tsx:526`, over `FIELD_GROUPS`
  (`ContactDossierModal.tsx:106-139`), which has no colliding key today — but the derivation is
  advertised as "add a row and it just works", so the match must be tightened, not widened blindly.
- Three entry points confirmed:
  1. `Onboarding.tsx:1630-1647` — `address_street/city/state/zip`, **no `onBlur` on any of the four.**
  2. `SignStart.tsx:645-708`, deal branch — `line1/line2/city/stateV/zip`; **`stateV` uppercases on
     CHANGE** (`:690`), which is the wrong half of the spine (D34/CR-83 say blur).
  3. `ContactDossierModal.tsx` FIELD_GROUPS "Mailing address" (`:122-125`) — auto-wired via
     `normalizeKindForField`, **zero call-site edits needed.** DISCO correct.
- 🔎 **ADJACENT DEFECT, DSNR's find:** `Onboarding.tsx:1615` `text_only_phone` has **no normalizer**,
  while `ob-phone` (`:1592`) does. One line, same spine, same file. Folded into the spec explicitly.
- ⚠️ DISCO said "name/phone/email on the same page all have it." **Half true** — onboarding normalizes
  4 name fields and 1 phone; there is no email input on that step and `text_only_phone` was missed.

## CR-102 — VERIFIED 2026-09-01 (DISCO's numbers do not reproduce)
- `grep -rEo 'gold-[0-9]+' src | wc -l` → **568**, not 590. Across **96 files**.
  Non-numeric tokens separately: `gold-ink` ×55, `gold-accent` ×2, rest is prose.
  DISCO's 590 came from `gold-[0-9]*` (zero-or-more), which also counts `gold-ink`/`gold-armed` prose.
- Per-file, my counts vs DISCO's: ContractPage **41** (said 43) · ContractCascade **40** (40 ✓) ·
  Onboarding **16** (17) · ClauseDocument **11** (12) · DocumentsContent **2 numeric + 3 `gold-ink`**
  (said 5) · PartyDocumentView **3** (3 ✓). **DISCO's ZERO-gold claim for the ops signing surfaces
  reproduces**: DocumentViewerPage 0, MergedBodyView 0, ConfirmNameModal 0.
- By shade: gold-800 ×159 · gold-50 ×104 · gold-600 ×80 · gold-400 ×74 · gold-900 ×56 · gold-200 ×24 ·
  gold-700 ×19 · gold-500 ×19 · gold-300 ×19 · gold-100 ×14.
- Global classes (`src/index.css`), adopters measured by me, excluding index.css itself:
  `focus-ring` 122 files/416 · `btn-primary` 116/209 (gold FOCUS RING only) · `form-input` 95/478
  (gold FOCUS border+ring only) · `eyebrow` 57/135 · `btn-outline-gold` 44/80 · `text-gold-ink` 30/53 ·
  `link-underline` 23/45 (gold focus ring) · `eyebrow-on-dark` 4/7 · `selectable-card` 1/4 ·
  `rule-gold` 3/3 · `btn-sign` 3/3 · `step-complete` 3/3. Plus `app-header.css:309` `outline: 2px solid #7a6421`.
- Keepers verified: `RosterCard.tsx:83` `ring-gold-600` (and `:76-78` prove it is SEMANTIC —
  gold=client / green=account / grey=guest); `Header.tsx:151` nav underline `bg-gold-300`/`bg-gold-700`;
  `Header.tsx:165` notification badge `bg-gold-600`; `AppLayout.tsx:120/163` nav underline
  `decoration-gold-600`, `:253` `NAV_BADGE bg-gold-500`.
- ⚠️ **SHAPE FINDING, DSNR's, not DISCO's.** `ContractCascade.tsx` does not merely *use* gold — it uses
  `bg-gold-50 / border-gold-400 / text-gold-700` as **THE AUTHORING AFFORDANCE**: every inline fillable
  field (`:1074-1076`, `:490`, `:532`), every "Add …" dashed control (`:615/736/845/1613/1683`), the
  ⟦NEEDS⟧ highlight (`:350`) and the insurance callout (`:1698-1701`). **Gold-vs-green IS the signal
  for "this is not the document, this is a thing you fill in."** Flipping it to the same green as body
  text and chrome destroys the affordance. This needs the owner's eyes before chunk D builds.
- T1 trap test is real and cheap: the built CSS carries literal hex —
  `dist/assets/index-*.css` currently holds `#7a6421` ×4, `#5c4a18` ×4, `#ba9935` ×17.
