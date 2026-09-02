# FHE-TASK-SIGNFLOW-C — LEDGER

**Spec:** `docs/tasks/TASK-SIGNFLOW-C-green-the-signing-flow-end-to-end.md` (CR-102, narrowed 2026-09-01).
**Opened 2026-09-02.**

## RESUME
Role / thread   TASK-SIGNFLOW-C · wt-3 · branch task/signflow-c
Merge-base      8edfe7fe — origin/main has NOT moved (re-fetched at report time)
DONE            build commit 9f756570 (13 files) · gates green · T1/T2/gold-survival proofs run on dist CSS · report written
IN FLIGHT       nothing — complete
NEXT            ORCH verifies (docs/reports/TASK-SIGNFLOW-C-REPORT.md) and writes TASK-SIGNFLOW-C-VERIFICATION.md; ORCH applies the one-line SignChoose.tsx diff (report §4)
DECIDED         btn-primary ring + form-input-error + disabled:hover + ExplainTip underline in the scope block; SignStart class on 4 sections; AddElementModal via panelClassName; select placeholder → text-green-800/40; comments corrected; drawer/activity/subheader gold-vs-green semantic pair collapsed to light/deep green per "no keepers" (report §5.9)
BLOCKED         nothing
DO NOT          do not count on 393 — index.css loses 7 refs to the btn-sign flip the spec itself orders (388 is right). Do not grep hex for gold survival — Tailwind emits rgb triplets. The Onboarding:115 comment runs 3 lines past the owner quote; do not close it there.

## LOG
- Gate check: `docs/reports/TASK-SIGNFLOW-A-REPORT.md` (21234 B) and `-B-REPORT.md` (18340 B) both exist. Gate OPEN.
- `git worktree list` before entry: wt-1/2/3 all detached at 8edfe7fe, porcelain empty. wt-3 guard OK.
- Baseline app-wide `grep -rEo 'gold-[0-9]+' src | wc -l` on main @ 8edfe7fe = **568** (spec's number reproduces).
- Per-file counts on main @ 8edfe7fe (gold-[0-9]+ / gold-ink): ContractPage 41/2 · ContractCascade 40/0 · AddElementModal 34/0 · Onboarding 16/1 · ContractChangeRequests 12/2 · ClauseDocument 11/0 · ContractActivityCard 6/0 · ContractDrawer 5/1 · ContractSubheader 5/0 · PartyDocumentView 3/0 · DocumentsContent 2/3 · SignStart 0/0 · DocumentViewerPage 0/0. **All 13 match the spec's table.** Sum 175 / 9.
- `btn-sign` adopters on main: index.css:245 (def) · ContractPage.tsx:2307 · Onboarding.tsx:2058. Release.tsx is DELETED (SIGNFLOW-D merged) — two adopters now, both in the flow.
- `createPortal` in src: AppLayout.tsx · ExplainTip.tsx · AddElementModal.tsx:961 (T5 candidate confirmed).

## MEASUREMENTS BEFORE EDITING (in wt-3 @ 8edfe7fe)
- Modal kit (`src/components/ops/kit/Modal.tsx`) does NOT portal — renders `fixed inset-0` in-tree. So every kit Modal in the flow (send modal, ConfirmName, CaptureInfo, Void, AddHorse, ReviewChanges, NotifyConfirm, PaperViewer, AppOverview) is a DOM descendant of the page root → `.flow-green` reaches it.
- `createPortal` in src: AppLayout.tsx (a nav tooltip, green-only) · ExplainTip.tsx (the bubble, green-only; the TRIGGER is in-tree) · **AddElementModal.tsx:961 → the one portal in the flow. Needs the class on its own panel (T5).**
- Global-class occurrences INSIDE the 12 flow files: eyebrow 5 · btn-outline-gold 16 · focus-ring 81 · form-input 56 · text-gold-ink 9 · **btn-primary 23** (its focus ring is gold-800 → added to the scope) · form-input-error 0 (re-declared anyway to keep error-state red at the tied specificity) · link-underline/selectable-card/step-complete/rule-gold/eyebrow-on-dark 0.
- ExplainTip `underline` defaults TRUE → `decoration-gold-500/60` dotted underline; 5 uses in ClauseDocument.tsx without `underline={false}` → gold dotted underlines inside the contract body. ExplainTip.tsx is outside §3 → handled in the scope block by escaped utility name.
- NotifyConfirmModal.tsx:101 `text-gold-ink` (outside §3) — in-tree under ContractPage → covered by `.flow-green .text-gold-ink`, no edit needed.
- SignStart returns a FRAGMENT (`:508`) with 3 sections + an early-return `<section>` at `:495`. Class goes on all 4 sections.
- No `text-white` on any gold fill in the 175 inline refs → §6 deviation 2 (white-on-fill) has ZERO cases. btn-sign is the only white-on-fill and it is the class flip.
- Contrast (node script, scratchpad/contrast.mjs): btn-sign white on green-800/700/600 = 13.77 / 11.04 / 8.72 (was 5.72 / 4.11 / 2.73). Start-here pill green-900 on green-200 = 8.79. NEEDS mark green-900 on green-100 = 12.34. caption green-700/90 on white = 8.19. text-muted glyph = 5.32. placeholder green-800/40 over green-50/70 = 2.28 (incumbent token; was 2.45 in gold).

## EDITS APPLIED (uncommitted at this line; commit follows)
- index.css: header line · btn-sign flipped + comment updated · `.flow-green` block at END of @layer components (source-order wins ties).
- 175 inline refs swapped by `re.sub(r'gold-([0-9])', r'green-\1')` per file (T4-safe: `gold-ink` has no digit).
- §6 deviation 1 applied at ContractCascade 1072 / 1227 / 1356 / 1711 / 1714 (spec said 1076/1231/1360/1715/1718 — shifted −4 by SIGNFLOW-A).
- Comments corrected so they stay true: ContractChangeRequests:376 · ContractDrawer:32-40 · ContractSubheader:271 · AddElementModal:36,703 · ClauseDocument:968 · Onboarding:115,2089 (owner quotes kept verbatim, note appended).
- Scope class applied: Onboarding root div · ContractPage root div · DocumentsContent root div · SignStart ×4 sections · AddElementModal `panelClassName="flow-green"`.
DO NOT: the Onboarding:115 comment does NOT end at the quote — it runs 3 more lines. An inserted `*/` there broke the file once; fixed.

## PROOFS (dist/assets/index-CcSHDESC.css, 108,431 B, build of 9f756570)
- 44 distinct green classes introduced → 44 rules present, 0 missing (scratchpad/t1proof.mjs).
- `.flow-green` block emitted: 10 rules (eyebrow+text-gold-ink · focus-ring:focus-visible · btn-primary:focus-visible · form-input:focus · form-input-error:focus · btn-outline-gold ×4 states · decoration-gold-500\/60). Pasted in report §2.3.
- gold survival: rgb(186 153 53)=8 · rgb(122 100 33)=15 · rgb(92 74 24)=2 · hex #ba9935=16 #7a6421=4 #5c4a18=3.
- gates: typecheck 0 · typecheck:api 0 · lint 0/45 · build ✓ · test:api 7/7.
- keepers: AppLayout/Header/Footer/RosterCard 0 lines changed; 7 staff-tooling files 0 lines changed.
- NEW FINDING: /sign chooser (SignChoose.tsx, outside §3) has 9 .eyebrow → brown. Reported §4 with the one-line diff.

## FINAL STATE
Report at docs/reports/TASK-SIGNFLOW-C-REPORT.md. Branch task/signflow-c, NOT pushed. Complete, nothing in flight. Next station: ORCH.
