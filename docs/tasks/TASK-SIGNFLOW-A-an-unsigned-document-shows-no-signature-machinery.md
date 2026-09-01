# TASK-SIGNFLOW-A — an unsigned document shows no signature machinery, in EVERY reader

**Spec by `FHE-DSNR-SIGNFLOW`, 2026-09-01. Change order: `CR-101`.**
**Thread name: `FHE-TASK-SIGNFLOW-A`.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` — the standing requirements. **Not repeated here.**
> - `docs/method/CLNR-ROLE.md` §3 — your zeroth act.
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-SIGNFLOW-A-LEDGER.md` FIRST.
> - `CLAUDE.md` **D17** (`:365`) — a feature is not done until it is REACHABLE. **This whole task is a
>   D17 fix: the code is correct and merged, and three surfaces never call it.**
> - `CLAUDE.md` **D18** (`:376`) — never leave a second implementation beside a correct one.
> - `docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md` §ITEM 1 — the discovery. ⚠️ **Its reader list is
>   INCOMPLETE and its line numbers are stale; this spec supersedes it. See §2.**

---

## 1. THE OWNER'S WORDS

> *"noticed that the docs in the signing flow still show the tokens for date and signature, we
> previously ran a task thread that was supposed to remove the visibility of the signature token and
> insert the real date rather than show the token."*
> — owner, `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-101

And the ruling the earlier fix was built to, still in force (commit `71993bb2`, 2026-08-24, carried
verbatim in `src/components/app/ContractCascade.tsx:270-284`):
- **the DATE** is a fact already known — the document is being signed today — so it renders as today's
  date, in the same `"August 24, 2026"` shape `generate_document` produces;
- **the SIGNATURE** is the one thing we must not invent — it renders as **empty space**.

## 2. WHAT WAS MEASURED — re-run by DSNR on 2026-09-01, not inherited

| Fact | How it was measured |
|---|---|
| The fix exists, merged, never reverted | `git log --oneline -1 71993bb2` → *"docs: an unsigned document stops showing its signature machinery"* |
| `resolveUnsignedSignatureTokens` exists **three times** | `grep -rn "resolveUnsignedSignatureTokens" src api` → `src/components/app/ContractCascade.tsx:289` (exported), `src/lib/documentPdf.ts:89` (private), `api/_lib/documentPdf.ts:88` (private) |
| Surfaces that DO resolve (correct today, do not touch) | `grep -rn "<ContractBody" src` → `FlatDocument.tsx:66`, `PartyDocumentView.tsx:191`, `ContractPage.tsx:1795`, `:2195`, `:2215` |
| The renderer's own claim is FALSE | `ContractCascade.tsx:323-325` says *"Every frame that shows a document body comes through here"*. It does not. |

### ⚠️ THE READER LIST — DISCO NAMED THREE. THERE ARE FOUR, AND A FIFTH OF A DIFFERENT SHAPE.
`grep -rn "BodyWithSignatures" src` and `grep -rn "MergedBodyView" src`, 2026-09-01:

| # | Reader | Renders | Resolves tokens? |
|---|---|---|---|
| 1 | `src/pages/app/Onboarding.tsx:1994` | `<BodyWithSignatures text={body}>` — **the surface the owner was looking at** | ❌ no |
| 2 | `src/pages/app/ops/DocumentViewerPage.tsx:200` → `MergedBodyView` (`src/components/ops/documents/MergedBodyView.tsx:77`) | staff doc viewer | ❌ no |
| 3 | ⚠️ **`src/pages/DocsParticipantFlow.tsx:432`** — **MISSED BY DISCO** | the PUBLIC participant signing flow, route `/docs/release-participant` (`src/App.tsx:240`); renders an **unsigned `previewBody`** immediately above the "type your full name to sign" box | ❌ no |
| 4 | `src/pages/Release.tsx:274` | kiosk confirmation, an **executed** body | ❌ no — but harmless, nothing left to match. **Covered for free; do not special-case it.** |
| 5 | `PaperViewer`, `src/components/app/DocumentsContent.tsx:139` | the "Read" reader on `/app/documents` and the Account panel: `{doc.pages[page]}` — **raw text**, and **no signature script-face styling at all** | ❌ no |

⚠️ **DISCO's line number for the onboarding reader (1963) was already stale on the day it was written.
It is 1994. Re-grep; do not trust a line number in any document, including this one.**

## 3. THE INCUMBENT, NAMED (D18) — this is CONVERGENCE, not greenfield

`resolveUnsignedSignatureTokens` (`ContractCascade.tsx:289`) is the incumbent and it is **correct**.
`UNSIGNED_SIG_DATE = /\{\{SIG\.[A-Z_]+\.DATE\}\}/g` → `toLocaleDateString('en-US', {month:'long',
day:'numeric', year:'numeric'})`; `UNSIGNED_SIG_NAME = /\{\{SIG\.[A-Z_]+\.(?!DATE)[A-Z_]+\}\}/g` → `''`.
**Do not write a second resolver. Do not change its behaviour.**

`BodyWithSignatures` (`MergedBodyView.tsx:30`) is the incumbent renderer for readers 1–4 and it is
also correct at what it does — it script-faces `Signature: <name>` / `By (signature): <name>` lines.
**It is the right place to put the resolution, because four readers already share it.**

### 🔒 THE SHAPE — decided by DSNR, and this is the HOW; do not re-open it

1. **Create `src/lib/documentBody.ts`** and move `resolveUnsignedSignatureTokens` there **verbatim**,
   with its full comment block (`ContractCascade.tsx:262-288`). It is the natural home: a pure
   string→string function with no React in it, used by a renderer, a viewer and a PDF writer.
2. **`ContractCascade.tsx` imports it and re-exports it** (`export { resolveUnsignedSignatureTokens }
   from '../../lib/documentBody';`) so no existing importer breaks. Its call at `:322` stays exactly
   where it is. **Replace the false comment at `:323-325`** — see §4 T4.
3. **`src/lib/documentPdf.ts` imports it** and its private copy at `:89` is DELETED. Its call at `:210`
   stays.
4. **`MergedBodyView.tsx` `BodyWithSignatures` resolves first**: `const resolved =
   resolveUnsignedSignatureTokens(text)` at the top of the function, and every downstream line split
   works on `resolved`. **This one edit fixes readers 1, 2, 3 and 4 at once**, and is why they are
   one task and not four.
5. **`PaperViewer` (reader 5) needs BOTH halves**, and it is the only one that does:
   - **resolve BEFORE `paginateBody`**, at the two places the pages array is built —
     `DocumentsContent.tsx:273` and `DocumentsContent.tsx:507`. ⚠️ **Not inside the viewer**:
     `paginateBody` (`DocumentsContent.tsx:63`, a 2,400-character-per-page accumulator) measures the text to decide page breaks, and a
     `{{SIG.CLIENT.DATE}}` is a different width than `September 1, 2026`. Resolving after pagination
     would put the break in the wrong place.
   - **converge its renderer**: replace the bare `{doc.pages[page]}` at `DocumentsContent.tsx:167`
     with `<BodyWithSignatures text={doc.pages[page]} />`. That gives it the script face the other
     four readers have and it has never had. `BodyWithSignatures` is already imported-able from
     `../ops/documents/MergedBodyView`. **The double resolution (once before paginate, once inside
     `BodyWithSignatures`) is harmless and deliberate — the second pass finds nothing to match.**
6. 🔒 **`api/_lib/documentPdf.ts` IS NOT TOUCHED, AND THAT IS NOT AN OVERSIGHT.**
   `src/lib/documentPdf.ts:13-17` states the constraint verbatim: *"the two tsconfig projects (`api`
   and `src`) share no module, so ANY change to one MUST be made to the other."* Verified —
   `grep -rn "from '../../src" api` returns nothing. Its copy is a deliberate twin and its behaviour
   is already correct. **Say so in your report; do not "tidy" it into an import that will not compile.**

## 4. THE TRAPS

- **T1 — the comment that lied.** `ContractCascade.tsx:323-325` currently reads *"Every frame that
  shows a document body comes through here — the flat renderer, the read-only frame and the executed
  frame — so resolving the unsigned tokens once, here, covers all of them and cannot drift between
  them."* **That sentence is the entire reason CR-101 exists**: someone believed it. **Rewrite it to
  name the two resolution points that will exist after this task** (`ContractBody` and
  `BodyWithSignatures`, both now calling the one shared function) and to say that a NEW body renderer
  must call `resolveUnsignedSignatureTokens` or reuse one of those two.
- **T2 — resolve before paginate.** See §3.5. A passing screenshot of page 1 does not prove this;
  check a document long enough to have a page 2.
- **T3 — the executed case must not change.** The regexes only match still-literal `{{SIG.*}}`. An
  executed body holds a real name and a real date, so nothing matches. `Release.tsx:274` and every
  `EXECUTED` row in `DocumentsContent` must look **identical before and after**. ⚠️ **Prove this by
  opening an executed doc, not by reasoning about the regex.**
- **T4 — `Signature:` line styling and token resolution interact.** After resolution, an unsigned
  `Signature: {{SIG.CLIENT.NAME}}` becomes `Signature: ` with a trailing space. `SIGNATURE_LINE`
  (`MergedBodyView.tsx:22`) is `/^(Signature|By \(signature\)):\s*(.+)$/` — `(.+)` needs at least one
  character, so an emptied line **no longer matches** and falls through as plain text. **That is the
  correct outcome** (there is no name to script-face). Do not "fix" it.
- **T5 — three copies, and after this task there must be exactly two.** `src` gets ONE
  (`src/lib/documentBody.ts`); `api/_lib` keeps its twin. ⚠️ **Prove it:**
  `grep -rn "UNSIGNED_SIG_DATE" src api` must return **one hit under `src/`** and one under `api/`.
- **T6 — `DocsParticipantFlow` is a PUBLIC route.** `/docs/release-participant`, no auth. It is the
  one reader you cannot check with a staff login. Include it in the owner's checklist by URL.

## 5. OUT OF SCOPE — do not touch
- **Colour.** `CR-102` is `TASK-SIGNFLOW-C/D/E` and owns every `gold-*` in these files. ⚠️ **You and
  `TASK-SIGNFLOW-D` both edit `ContractCascade.tsx` and `DocumentsContent.tsx`. Change nothing
  cosmetic; D merges after you and will conflict on anything you touched for taste.**
- `api/_lib/documentPdf.ts` (§3.6).
- The token merge engine, `generate_document`, `template_tokens`, any stored `merged_body`. **This is
  display-time only. No migration. No DB write of any kind.**
- The `⟦NEEDS:…⟧` mark and its highlight — that is D's.

## 6. THE REACH — what a person clicks

| # | Path | The click |
|---|---|---|
| 1 | **primary** | sign in as a client with outstanding onboarding docs → `/app/onboarding` → the signing step → the document body in the bordered scroll box (`Onboarding.tsx:1990-1998`) |
| 2 | | `/app/documents` (or Account → Documents) → an unsigned/awaiting row → **Read** (`DocumentsContent.tsx:293`, `:334`) → `PaperViewer` |
| 3 | | staff → a document → `/app/ops/documents/:id` → `DocumentViewerPage.tsx:200` |
| 4 | | **public, no login** → `/docs/release-participant` → fill the info step → **Continue to documents** → the preview above the signature box |

**Is that the only way?** For an unsigned body, yes — those four plus `<ContractBody>`'s five call
sites (already correct). ⚠️ **Prove it before you finish**: `grep -rn "merged_body" src` and
`grep -rn "BodyWithSignatures\|MergedBodyView\|ContractBody" src`, and list in your report every hit
that renders a body, with which of the two resolution points it goes through. **A reader you did not
find is this task shipping half-done, which is exactly what happened on 2026-08-24.**

## 7. THE TELL (D19)
Nothing here moves money, credits or state — **it changes what a person is asked to sign**, which is
why it matters. The tell is negative and visual: **on an unsigned document, no `{{` appears anywhere
in the body, and the date line reads as a real date.** There is nothing to undo: no stored value
changes, and reverting the commit restores the previous appearance exactly.

## 8. THE TEST THIS MUST PASS
**Built from the validation criteria the owner agreed on 2026-09-01
(`docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md` §ITEM 1).** ⚠️ **Renders are NOT verified by you —
`docs/method/TASK-ROLE.md` §3. Items 1–5 are the numbered checklist you hand the owner, and it must
name the phone.**

1. **Unsigned, onboarding reader** (`/app/onboarding`): no `{{SIG` anywhere in the body; the date
   position reads today's date as e.g. `September 1, 2026`; the signature position is **blank space**,
   not `Signature: ` followed by a stray token.
2. **Unsigned, Documents "Read"** (`PaperViewer`): same three results — **and** an already-signed
   `Signature: Jane Doe` line now renders in the script face, which it never did before.
3. **Unsigned, ops viewer** (`/app/ops/documents/:id`): same three results.
4. **Unsigned, public participant flow** (`/docs/release-participant`, logged out): same three results.
5. **Executed, all four**: **unchanged** — real name in script face, real date. Compare against the
   same document before the change.
6. **A multi-page document in `PaperViewer`** paginates identically to a document whose tokens were
   already real — i.e. the page break did not move because of a token. State which document you used
   and its page count.
7. `grep -rn "UNSIGNED_SIG_DATE" src api` → exactly **one** hit under `src/`, one under `api/`.
8. `npm run build` succeeds and `npx tsc --noEmit` is clean. ⚠️ **`npm run test:db` is red at baseline
   and proves nothing** (`docs/method/TASK-ROLE.md` §3) — do not report it as a result either way.
9. **The reader inventory from §6 is in your report as a list**, each entry marked *resolves via
   `ContractBody`* / *resolves via `BodyWithSignatures`* / *resolves before paginate* / *does not
   render a body*.

## 9. WHERE THE REPORT GOES
`docs/reports/TASK-SIGNFLOW-A-REPORT.md`. Ledger: `docs/reports/FHE-TASK-SIGNFLOW-A-LEDGER.md`.
**Open the ledger with your first action.** `ORCH` verifies your claims itself and writes
`TASK-SIGNFLOW-A-VERIFICATION.md` beside it. **You do not push.**
