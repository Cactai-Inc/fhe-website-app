# TASK-SIGNFLOW-A — REPORT

**Thread `FHE-TASK-SIGNFLOW-A`. Change order `CR-101`. Worktree `wt-3`, branch `task/signflow-a`,
branched from `origin/main` `0ae5855f`. Commit `d78d3b3c`. 2026-09-02.**

**CLNR: clean.**

---

## 1. THE HEADLINE

`resolveUnsignedSignatureTokens` now lives in `src/lib/documentBody.ts` and there are exactly **two**
resolution points in the app — `ContractBody` and `BodyWithSignatures` — both calling it.
**Three readers** that rendered an unsigned body without ever calling it now do: the onboarding signing
step, the ops document viewer, and the paper reader on `/app/documents`.
The paper reader also gained the signature script face it has never had, and its pagination is
computed on the RESOLVED text — **proven to matter: the page break moves 88 characters otherwise.**
Display-time only. No migration, no DB write, nothing stored changed.

⚠️ **ONE THING NEEDS YOUR DECISION BEFORE THIS IS FINISHED — §5. It is not a blocker and the work
above is complete, but you should see it before you sign the lease.**

---

## 2. CRITERION BY CRITERION, AGAINST §8 "THE TEST THIS MUST PASS"

### Items 1, 2, 3, 5 — renders. NOT VERIFIED BY ME (`TASK-ROLE.md` §3). The checklist is §8 below.
What I *can* prove without a login, I proved against **production data**, not against the regex.

### Item 4 — `/docs/release-participant` and `/release`
**They no longer exist.** `TASK-SIGNFLOW-D` merged at `e2f3dabf` — **before** this task, not after as
the spec's §5 states. `src/pages/DocsParticipantFlow.tsx` and `src/pages/Release.tsx` are both deleted.
Readers 3 and 4 are gone rather than fixed-for-free. Nothing to verify, nothing to conflict with.

### Item 5 — the executed case is unchanged. **Proven on a real production EXECUTED body**, not reasoned.
Body: the largest of the 81 executed documents, 14,199 characters.
```
T3 — THE EXECUTED CASE MUST NOT CHANGE (real production EXECUTED body)
  bytes in                 : 14199
  literal {{SIG.*}} present: false
  resolve(body) === body   : true        ← byte-identical, not "looks the same"
  pages before/after       : 7 / 7
  page breaks identical    : true
```
Independently, across the whole table: **0 of 81 EXECUTED documents contain a literal `{{SIG.`**, so
there is nothing in any of them for either regex to match.

### Item 6 — a multi-page document paginates identically to one whose tokens were already real
**Document used: the LIVE Pamela Godde lease, `7adcd08f-fd5d-40f9-b726-634074266d7c`, "Horse Lease
Agreement — Standard", `AWAITING_SIGNATURE`, 25,813 characters, 13 pages.** It is the only
`AWAITING_SIGNATURE` document in production and it carries 4 literal SIG tokens.
```
T2 / TEST 6 — RESOLVE BEFORE PAGINATE
  bytes in                 : 25813
  literal SIG tokens       : 4  ["{{SIG.LESSEE.NAME}}","{{SIG.LESSEE.DATE}}","{{SIG.LESSOR.NAME}}","{{SIG.LESSOR.DATE}}"]
  A resolve→paginate pages : 13   breaks [2156,4437,6276,8661,11042,13283,15184,16741,19027,21331,23179,25581,25747]
  B paginate→resolve pages : 13   breaks [2156,4437,6276,8661,11042,13283,15184,16741,19027,21331,23179,25493,25747]
  identical?               : false     ← ⚠️ T2 IS REAL: page 12 breaks 88 characters early
  C already-real control   : 13   breaks [2156,4437,6276,8661,11042,13283,15184,16741,19027,21331,23179,25581,25747]
  A === C (test 6)         : true      ← PASS
```
**The spec's T2 was not hypothetical.** Resolving after pagination would have moved a real page break
on the live lease. The shipped order (A) matches the already-real control (C) exactly.

Both functions under test were **extracted from the shipping source at runtime** (`paginateBody` read
out of `DocumentsContent.tsx`, the resolver out of `documentBody.ts`, TS stripped with the repo's own
esbuild) rather than re-typed, so this exercises the code that ships, not a copy of it.

### THE TELL (§7) — proven on the live lease
```
  "{{" occurrences before  : 4
  "{{" occurrences after   : 0        ← no {{ survives
  today's stamp present    : true  (September 2, 2026)
```

### Item 7 — `grep -rn "UNSIGNED_SIG_DATE" src api`
⚠️ **The spec's grep is the wrong test and returns a misleading result.** `UNSIGNED_SIG_DATE` is a
named constant **only** in what was `ContractCascade.tsx`; both `documentPdf.ts` twins always used
inline regex literals. So the spec's command returns **2 hits in `src/` (both inside the one new file)
and 0 in `api/`** — which is correct but does not measure what T5 wanted.
```
$ grep -rn "UNSIGNED_SIG_DATE" src api
src/lib/documentBody.ts:38:const UNSIGNED_SIG_DATE = /\{\{SIG\.[A-Z_]+\.DATE\}\}/g;
src/lib/documentBody.ts:43:  return body.replace(UNSIGNED_SIG_DATE, stamp).replace(UNSIGNED_SIG_NAME, '');
```
**The test T5 actually meant — one definition per tsconfig project — passes:**
```
$ grep -rn "function resolveUnsignedSignatureTokens" src api
src/lib/documentBody.ts:41:export function resolveUnsignedSignatureTokens(body: string, today = new Date()): string {
api/_lib/documentPdf.ts:88:function resolveUnsignedSignatureTokens(body: string): string {
```
**Three copies became two.** `api/_lib/documentPdf.ts` is untouched and that is deliberate (§3.6):
`grep -rn "from '../../src" api` returns nothing — the two tsconfig projects share no module, so the
server twin *cannot* import the shared file. Its behaviour is already correct and identical. I left a
comment at `src/lib/documentPdf.ts:19-26` and in `src/lib/documentBody.ts` saying so, so the next
reader does not "tidy" it into an import that will not compile.

### Item 8 — the gates
| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **clean, exit 0** |
| `npm run typecheck` (`tsconfig.app.json`) | **clean** |
| `npm run typecheck:api` (`tsconfig.api.json`) | **clean** |
| `npm run lint` | **0 errors, 45 warnings** — `git stash`-verified **identical to baseline** (45/0 on `origin/main`) |
| `npm run build` | **✓ built in 4.27s**, all 10 routes prerendered, sitemap + robots written |

`npm run test:db` not run and not reported — red at baseline, proves nothing (`TASK-ROLE.md` §3).

### Item 9 — the reader inventory
See §3.

---

## 3. THE REACH, AND THE FULL READER INVENTORY (§6)

`grep -rn "merged_body" src` and `grep -rn "BodyWithSignatures\|MergedBodyView\|<ContractBody\|<FlatDocument\|<PartyDocumentView\|paginateBody" src`, 2026-09-02.
**Every surface in the app that puts a document body on screen:**

| # | Surface | File:line | Resolution |
|---|---|---|---|
| 1 | **Onboarding signing step** — the surface you were looking at | `src/pages/app/Onboarding.tsx:2006` | ✅ **via `BodyWithSignatures`** — FIXED |
| 2 | **Ops document viewer** `/app/ops/documents/:id` | `src/pages/app/ops/DocumentViewerPage.tsx:200` → `MergedBodyView.tsx:96` | ✅ **via `BodyWithSignatures`** — FIXED |
| 3 | **Paper reader**, `/app/documents` + Account panel | `src/components/app/DocumentsContent.tsx:183`, pages built at `:291` and `:527` | ✅ **resolves before paginate, then renders via `BodyWithSignatures`** — FIXED, both halves |
| 4 | Contract page, read-only merged frame | `src/pages/app/ContractPage.tsx:1795` | ✅ via `ContractBody` (was already correct) |
| 5 | Contract page, executed frame | `ContractPage.tsx:2195` | ✅ via `ContractBody` |
| 6 | Contract page, retired-preview frame | `ContractPage.tsx:2215` | ✅ via `ContractBody` |
| 7 | Flat document renderer | `ContractPage.tsx:2111` → `FlatDocument.tsx:66` | ✅ via `ContractBody` |
| 8 | Party's view of the body | `ContractPage.tsx:2125` → `PartyDocumentView.tsx:191` | ✅ via `ContractBody` |
| 9 | Client PDF download | `src/lib/documentPdf.ts:204` | ✅ imports the shared function |
| 10 | Server/emailed PDF | `api/_lib/documentPdf.ts:209` | ✅ its own deliberate twin (§3.6) |
| — | `ClauseDocument` / `ClauseProse` | `src/components/app/ClauseDocument.tsx` | ⬜ **does not render a body.** Renders clause SOURCE text with each token as a fill-in control, never `merged_body` |
| — | `src/portal/__fixtures__/portalFixtures.ts` | fixture | ⬜ test data, not a renderer |
| ~~—~~ | ~~`/docs/release-participant`, `/release`~~ | ~~`DocsParticipantFlow.tsx`, `Release.tsx`~~ | 🔻 **DELETED by `TASK-SIGNFLOW-D`, merged before this task.** Not verified, per spec |

**"Is that the only way?" — YES, and I checked the one thing that could have been a fourth reader.**
`ClauseDocument` is the *authoring* surface, and the worry was that a clause body might itself carry a
signature token, which it would then render raw. **It cannot:**
```
$ for f in $(grep -rln "contract_clauses" supabase/migrations/*.sql); do grep -q "{{SIG\." "$f" && echo "BOTH: $f"; done
(no output)
```
and in production, `contract_clause_defs` holds **zero** rows whose body matches `\{\{SIG\.`. Signature
tokens exist only in `contract_templates.body` and in the composed `documents.merged_body`. Confirmed.

**A person's click, for the surface CR-101 came from:** sign in as a client with outstanding onboarding
documents → the wall sends them to `/app/onboarding` → the signing step → the document body in the
bordered scroll box, `Onboarding.tsx:1988-2011`.

---

## 4. §2c — THE THREE QUESTIONS

**This task CAPTURES nothing.** It stores no value, writes no column, and touches no row. It changes
only what a person is shown at the moment of display. So:

1. **CAPTURE → WHERE IS IT SEEN?** Nothing is captured. The transform's output is seen in all ten
   surfaces in §3, every one of them named with a file and a line.
2. **SEEN → WHERE IS IT ACTED ON?** The document is acted on where it always was — the sign button
   beneath the body in the onboarding step. This task changes what is above that button, not the button.
3. **WHAT ELSE DOES THIS OUTCOME NEED THAT NOBODY ASKED FOR?** → **§5. Read that one.**

---

## 5. ⚠️ THE ONE THING THAT NEEDS YOUR DECISION — presented BEFORE I call this done

**The tokens are gone. On the live lease, what sits in the signature space is now a lone full stop.**

The live Pamela lease's stored body reads, exactly:
```
LESSEE
Signature: {{SIG.LESSEE.NAME}}.
Printed Name: French Heritage Equestrian.
Date: {{SIG.LESSEE.DATE}}.
```
There is a **period after the token**. So after resolution the reader sees:
```
Signature: .
Date: September 2, 2026.
```
and because `SIGNATURE_LINE`'s `(.+)` now captures that period, **the period is drawn in the cursive
signature face.** Your 2026-08-24 ruling was that the signature renders as *empty space*; on this
document it renders as a full stop in handwriting.

**This is not something I introduced, and it is strictly better than before** — the same three
documents previously showed `{{SIG.LESSEE.NAME}}.` in cursive. It is also not signature machinery:
no `{{` appears anywhere, so §7's tell passes. But it is not blank space either.

**Where the period comes from — found, exactly.** `remerge_contract_from_clauses`, lines 171-174:
```sql
IF btrim(v_line) <> '' AND btrim(v_line) !~ '[.!?:;)"'']$' THEN
  v_line := v_line || '.';
END IF;
v_line := regexp_replace(v_line, ':\s*\.\s*$', ':');
```
A composed line that does not already end in punctuation gets a period. `Signature: {{SIG.LESSEE.NAME}}`
ends in `}`, so it gets one. **Line 174 is the guard against precisely this outcome** — its own comment
says *"a token resolved to empty ends in its lead-in colon and must stay bare rather than becoming
'are: .'"* — but that guard runs at MERGE time, when signature tokens are deliberately left literal.
The token sits between the colon and the period, so the guard cannot see the case. **The engine already
believes `Signature: .` is wrong; it just cannot reach it, because signature tokens resolve at display
time and everything else resolves at merge time.**

**Scope: 3 documents, all unsigned. 0 of 81 executed documents are affected.**
| Status | Period-suffixed signature line | Total |
|---|---|---|
| `AWAITING_SIGNATURE` | 1 (the live Pamela lease) | 1 |
| `DRAFT` | 2 (Participant Liability Release; Human Emergency Medical Auth v2) | 2 |
| `EXECUTED` | **0** | 81 |

**Zero `contract_templates` rows contain `{{SIG.…}}.`** — the period is added by the composer, never
authored. So this cannot be fixed in the wording editor.

**I DID NOT FIX IT, DELIBERATELY.** Every available fix is explicitly forbidden to me:
- editing the stored `merged_body` → §5 out of scope, *"No migration. No DB write of any kind."*
- changing the composer → §5 out of scope, *"The token merge engine."*
- changing `resolveUnsignedSignatureTokens` to eat a trailing period → §3, *"Do not change its behaviour."*

Per `TASK-ROLE.md`, an unlocked HOW is a question I send up, not a choice I make. **It does not block
this task** — the spec's own test 1 asks for "not `Signature: ` followed by a stray token", and there
is no token — so I finished the work rather than stopping. **The decision is yours**, and the cheapest
place to make it is one line in the display-time resolver: when a `{{SIG.*.NAME}}` resolves to empty
and the rest of the line is nothing but punctuation, drop the punctuation too. **That is a `DSNR`
amendment or a new task, not something I should have decided.**

⚠️ **When the lease IS signed, `record_signature` replaces only `{{SIG.LESSEE.NAME}}` and leaves the
period** (`record_signature` lines 130-134), so the executed lease will read `Signature: Pamela Godde.`
That is cosmetic and harmless, and the 81 already-executed documents are unaffected — but it is why
this is worth deciding before rather than after.

---

## 6. WHAT I DECIDED THAT THE SPEC DID NOT

1. **I rewrote TWO false comments, not one.** T1 names `ContractCascade.tsx:323-325`. The docblock
   above `ContractBody` (was `:261`) made the identical false claim — *"This is the single body renderer
   used across the app (m-5)"* — and leaving it would have left the exact sentence that caused CR-101
   sitting in the file. Both now name the two resolution points and require a new renderer to use one.
2. **I added a `🔒` note on `paginateBody`** stating that the body must be resolved before it is called,
   and why (it breaks on a 2,400-character budget, so it measures the text). The spec put the resolution
   at the two call sites; that leaves a third call site free to forget. The note is the cheap guard.
   I did **not** move the resolution inside `paginateBody` — the spec locked the shape at the call sites.
3. **`SeedDocument.body` stays as stored, unresolved.** Only `pages` is resolved. `body` feeds the PDF
   writer, which resolves for itself at `documentPdf.ts:204`; resolving it here would be a second,
   redundant pass with no consumer that needs it.
4. **I repaired a stale docblock on `BodyWithSignatures`** that said it was *"Exported for reuse by the
   kiosk signed confirmation (Release.tsx)"*. `Release.tsx` was deleted by `TASK-SIGNFLOW-D`. It now
   names the three real consumers and says where the page went.
5. **I did not touch a single `gold-*` class or anything cosmetic** (§5). The conflict `TASK-SIGNFLOW-D`
   was warned about cannot occur — D merged first.

---

## 7. ⚠️ WHERE THE SPEC WAS WRONG

1. 🔴 **§5 and §2: "`TASK-SIGNFLOW-D` owns their retirement… D merges after you."** **D merged BEFORE
   me**, at `e2f3dabf`, in `origin/main` at my branch point. Readers 3 and 4 do not exist. The spec's
   whole "you get them for free" paragraph, and its conflict warning, are both moot.
2. 🔴 **T4's premise is false on real data.** T4 states that after resolution `Signature: ` "no longer
   matches" `SIGNATURE_LINE` because `(.+)` needs a character, and calls that the correct outcome.
   **On all three unsigned documents in production the line ends in a period**, so `(.+)` matches it and
   the period is script-faced. T4 reasoned from the template text; the composed body is different. §5.
3. 🟡 **T5's grep does not measure what T5 wants.** `UNSIGNED_SIG_DATE` is a named constant in one file
   only; the `documentPdf.ts` twins use inline regex literals. It returns 2 hits in `src/` and 0 in
   `api/`, never "one and one". The definition-count grep is the real test and it passes. §2 item 7.
4. 🟡 **Line numbers, as the spec itself predicted.** The onboarding reader is `Onboarding.tsx:2006`
   (spec said 1994, DISCO said 1963). `MergedBodyView.tsx` `BodyWithSignatures` was `:30`, now `:49`.
5. 🟢 **Everything else in the spec was correct**, including the two things that mattered most: T2 is
   real and measurable (§2 item 6), and reader 5 was the one that needed actual work.

---

## 8. FLAGGED, NOT FIXED — one line each

- `remerge_contract_from_clauses:171` appends a period after an unresolved signature token; its own `:174` guard cannot see the case. **This is §5 and it is the one item that needs a decision.**
- 3 report files name a task doc that no longer exists: `A-PARTY-VERIFY-2`, `CHECKBOXTIP`, `INVITEFLOW` (CLNR §4 trigger, pre-existing).
- `docs/` holds 5 folders outside `CLNR-ROLE.md` §2a — `contract-content`, `contract-exports`, `proposed`, `staged`, `ui-orders`; all pre-existing, newest touched 2026-08-31.
- `docs/method/RNR-ROLE.md` still present though D41 deferred the RNR thread.
- `src/lib/acquisition.ts` statically imports `documentPdf.ts` while `DocumentsContent.tsx` dynamic-imports it, so pdf-lib cannot code-split out of the main bundle (pre-existing build warning, unaffected by this change).

---

## 9. THE OWNER'S RENDER CHECKLIST — ⚠️ ON YOUR PHONE, and on a desktop browser

**Nothing here is destructive and nothing writes. Do not sign anything you did not intend to sign — the
live Pamela lease is in production.** Steps 1-4 are read-only.

1. **The surface you complained about.** Sign in as a client who owes onboarding paperwork →
   you land on `/app/onboarding` → the signing step. In the bordered scrolling box:
   - **no `{{` anywhere in the document text;**
   - the date line reads a real date — **`September 2, 2026`**, today, in that shape;
   - the signature line reads `Signature: ` with **nothing after it but a full stop** — see §5, that
     stop is the open question. **What must NOT be there is `{{SIG.CLIENT.NAME}}`.**
2. **`/app/documents` → an unsigned or awaiting row → "Read".** Same three results. **And the new part:
   open an already-signed document here — the name after `Signature:` should now be in the cursive
   script face. It has never been, on this reader, in any version of the app.**
3. **Same reader, page through a long document to the last page.** Use the Horse Lease. It should be
   **13 pages** and the pager dots should let you reach the end with no blank or clipped page.
4. **Staff → a document → `/app/ops/documents/:id`.** Same three results as step 1.
5. **The must-not-change check.** Open an **executed** document in both `/app/documents` → Read **and**
   the ops viewer. It must look **exactly** as it did before — real name in script face, real date, no
   stray characters. Then hit **PDF** on it and confirm the download reads the same as the copy in your
   email. ⚠️ **If anything at all differs on an executed document, stop and tell ORCH — that is the one
   outcome this task must not produce.**
6. **On the phone specifically:** step 1 and step 2, portrait. The paper reader's page-dot pager and the
   onboarding scroll box are the two places a layout change would show.

---

## 10. TEARDOWN CENSUS

**I started no server and no browser.** The `psql` reads I ran against production were all `SELECT`,
all completed, none left open. Scratch files live in the session scratchpad, outside every repo.

```
$ git worktree list
/Users/Cactai/Downloads/claude-code-repo/fhe-website-app d6eb5691 [main]
/Users/Cactai/Downloads/claude-code-repo/wt-1            1567d24c [task/landingsignin]
/Users/Cactai/Downloads/claude-code-repo/wt-2            4f01c7c6 [task/sitecopy-b]
/Users/Cactai/Downloads/claude-code-repo/wt-3            d78d3b3c [task/signflow-a]   ← mine

$ ps -eo pid,etime,args | grep -Ei 'vite|playwright|chromium|psql'
38890  npm exec vite preview --port 4181   → wt-1, TASK-LANDINGSIGNIN     ⚠️ NOT MINE, left running
38909  node .../wt-1/.../vite preview      → wt-1, TASK-LANDINGSIGNIN     ⚠️ NOT MINE, left running
39646  npm exec vite --config test/browser → wt-2, TASK-SITECOPY-B        ⚠️ NOT MINE, left running
39662  node .../wt-2/.../vite              → wt-2, TASK-SITECOPY-B        ⚠️ NOT MINE, left running
39974  sh -c vite build && prerender       → wt-2, TASK-SITECOPY-B        ⚠️ NOT MINE, left running
```
**Every live process belongs to a sibling thread in `wt-1` or `wt-2`. I killed none of them.**

⚠️ **`origin/main` advanced to `d6eb5691` while I worked** (CR-106/CR-107 ledger entries, docs only,
touching none of my files). My merge-base is still `0ae5855f`, so ORCH's audit diff is clean. **Not pushed.**

---

## VALIDATION
*(ORCH appends its verdict here — `TASK-SIGNFLOW-A-VERIFICATION.md` beside this file.)*

---
## VALIDATION — ORCH, 2026-09-02
Independently verified and merged; see TASK-SIGNFLOW-A-VERIFICATION.md beside this report.
