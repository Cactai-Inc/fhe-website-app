# FHE-DSNR-SIGNFLOW HANDOFF — for ORCH

**From `FHE-DSNR-SIGNFLOW`, 2026-09-01. Subject: `CR-100`, `CR-101`, `CR-102`.**
**Upstream:** `docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md`.
**Working ledger, with every query behind every number here:** `docs/reports/FHE-DSNR-SIGNFLOW-LEDGER.md`.

**Three change orders became SIX task specs.** All six are written, self-sufficient, and ready to
dispatch. 🔒 **Nothing here is waiting on the owner.** Four small design calls are flagged for his
eyes in §4 — **each is one line to reverse and none of them blocks a build.**

---

# 1. THE CHUNKS, IN DEPENDENCY ORDER

| Thread | Spec (`docs/tasks/`) | CR | Owns | Must merge first |
|---|---|---|---|---|
| **`FHE-TASK-SIGNFLOW-A`** | `TASK-SIGNFLOW-A-an-unsigned-document-shows-no-signature-machinery.md` | CR-101 | the token resolver moves to `src/lib/documentBody.ts`; **5 readers** routed through it | — |
| **`FHE-TASK-SIGNFLOW-B`** | `TASK-SIGNFLOW-B-address-inputs-normalize-on-blur.md` | CR-100 | 4 new normalize kinds + 3 doors | — |
| **`FHE-TASK-SIGNFLOW-C`** | `TASK-SIGNFLOW-C-the-decorative-functional-rule-and-the-global-classes.md` | CR-102 | `src/index.css` + `app-header.css` — **13 global classes, 34 refs** | — |
| **`FHE-TASK-SIGNFLOW-D`** | `TASK-SIGNFLOW-D-green-the-document-and-signing-surfaces.md` | CR-102 | **18 files, 210 refs** — the flow the owner was looking at | **A, B, C** |
| **`FHE-TASK-SIGNFLOW-E`** | `TASK-SIGNFLOW-E-the-app-shell-and-the-gold-keepers.md` | CR-102 | **4 files, 47 refs** — every gold that SURVIVES | **C** |
| **`FHE-TASK-SIGNFLOW-F`** | `TASK-SIGNFLOW-F-the-rest-of-the-app-by-the-rule.md` | CR-102 | **70 files, 277 refs** — the sweep | **C** |

**`A` ‖ `B` ‖ `C` are fully file-disjoint and can run at the same time.**
**Then `D` (needs all three) ‖ `E` ‖ `F` — those three are disjoint from each other.**
**34 + 210 + 47 + 277 = 568**, the whole app's gold, with nothing unassigned.

## ⚠️ WHY THESE ARE THE CHUNKS AND NOT OTHERS

- **CR-101 is ONE chunk, not four**, even though it fixes five separate readers. Four of the five share
  `BodyWithSignatures` (`src/components/ops/documents/MergedBodyView.tsx:30`), so **one edit fixes
  four**; the fifth (`PaperViewer`) needs the resolution before `paginateBody` instead. **One seam,
  one function, one task.**
- **CR-100 is ONE chunk** — three doors, but one `NormalizeKind` switch. Splitting by door would put
  three threads in one 133-line file.
- 🔒 **CR-102 IS FOUR, AND THE SPLIT IS BY RISK, NOT BY VOLUME.**
  - **`C` first, alone**, because it writes the classification table `D`, `E` and `F` execute. **Two
    files, and the highest-leverage diff in the whole change order** — one line moves the focus ring
    in 122 files.
  - 🔒 **`E` is deliberately TINY — four files — because every gold the owner said to KEEP lives in
    those four, and nowhere else.** ⚠️ **Folded into the 70-file sweep, one of them gets greened at
    file 60 and a semantic distinction dies silently.** `RosterCard.tsx:83`'s ring is not decoration:
    `:76-78` proves gold = client, green = account, grey = guest.
  - **`D` before `F`** because `D` is the flow the owner will actually walk, and its deviations become
    `F`'s precedents rather than `F` inventing a second answer.
  - **`F` last**, mechanical, with a spec that tells it **there are no keepers in its file list** — so
    "I think I found a keeper" becomes a STOP-and-ask signal rather than a judgement call.

# 2. ⚠️ THE CONTENTION I CAN SEE — you hold the schedule, I do not

🔒 **THREE FILES ARE TOUCHED BY TWO CHUNKS EACH. This is the only reason `D` is gated.**

| File | Chunks | Resolution |
|---|---|---|
| `src/components/app/ContractCascade.tsx` | **A** (resolver move, `:262-322`) · **D** (40 gold refs) | **A merges first.** Both specs say so; `D` §5 T2 tells it to re-grep every line number |
| `src/components/app/DocumentsContent.tsx` | **A** (`:167`, `:273`, `:507`) · **D** (2 gold refs) | same |
| `src/pages/app/Onboarding.tsx` | **B** (5 inputs) · **D** (16 gold refs) | **B merges first**, same handling |

**Everything else is disjoint by construction** — each of `C`/`D`/`E`/`F` carries an exhaustive file
list, and `A`'s and `B`'s files do not overlap each other.

**Two notes for your scheduling, not decisions:**
- ⚠️ **`A` and `D` both edit `ContractCascade.tsx`, which is 1,700 lines and the most-edited file in
  the repo.** If anything else live is in it, `D` is the one to delay — it has the most to redo.
- 🔒 **NONE OF THE SIX TOUCHES THE DATABASE.** No migration, no RPC, no seed, no backfill. **So D35's
  shared-database hazard does not apply to this batch** and worktree isolation is genuinely sufficient
  here — unusually, for once.

# 3. MODEL AND EFFORT — a recommendation; you decide

| Thread | Recommend | Why |
|---|---|---|
| `A` | **Opus · thinking ON · HIGH** | the work is a reach hunt across a module boundary. **DISCO missed a reader; the risk is that `A` misses one too.** |
| `B` | **Opus · thinking ON · HIGH** | the incumbent file argues against this change **in writing** (`normalize.ts:120-126`) and two tests assert the old behaviour. A thread that reads fast will revert itself. |
| `C` | **Opus · thinking ON · HIGH** | small diff, but it is authoring the artefact three later threads execute, **and it is the most exposed to the arbitrary-value trap.** |
| `D` | **Opus · thinking ON · HIGH** | 210 sites plus one genuine judgement — does the fillable-field affordance still read once it is green. |
| `E` | **Opus · thinking ON · HIGH** | four files, but the most expensive possible error. ⚠️ **Not MAX: the uncertainty is already resolved — §3 of that spec rules all 47 sites individually. MAX buys judgement under uncertainty, and there is little left here.** |
| `F` | **Opus · thinking ON · HIGH** | volume, not difficulty. **The failure mode is fatigue at file 55, not a wrong call** — which is why its spec ends in a reconciliation arithmetic check rather than a taste check. |

# 4. ⚠️ FOR THE OWNER — four calls, ordered most-consequential first. NONE BLOCKS A BUILD.
🔒 **I ruled all four. Each is cheap to reverse now and expensive later, which is the only reason they
are here.** ⚠️ **They are NOT re-asks of anything he locked** — the decorative/functional rule and the
"no address lookup" answer are settled and I built on both without reopening either.

1. **The contract pages' "fill this in" language goes green** — `TASK-SIGNFLOW-D` §3/§4.
   ⚠️ **This one DISCO did not find, and it is the biggest consequence in CR-102.** The contract
   surfaces do not merely *use* gold: `bg-gold-50` + `border-gold-400` + `text-gold-800` **IS** the
   signal for *"this is not the document, this is a thing you fill in"* — every inline field, every
   ⟦NEEDS⟧ mark, every "Add …" control, every proposed-change card.
   **My ruling: it goes green** (they are functional; his rule is unambiguous), **and after the change
   the affordance is carried by the WASH AND THE BORDER rather than by the text colour.**
   🔒 **Not blocking: `D` §8 item 6 makes the build thread answer "can you still tell what to fill in?"
   in words, with a screenshot.** *He sees the answer instead of predicting it.*
2. **The footer's four contact icons stay gold** — `TASK-SIGNFLOW-E` §7. He listed *icons* as
   functional, but these are `gold-400` on the **dark green** footer, which is the decorative case he
   blessed; green icons on a green ground would nearly vanish. *If he wants them changed, the answer
   is white, not green — four lines.*
3. **The public header's sign-in button stays gold** — `TASK-SIGNFLOW-E` §7. He listed *buttons* as
   functional, but `Header.tsx:319-323` carries **his own 2026-08-16 design for this exact control**,
   and it sits in the nav region he named a keeper. *Three lines if he wants it green.*
4. **`.eyebrow` goes green in 57 files; `.rule-gold` stays gold** — `TASK-SIGNFLOW-C` §7. Eyebrow is
   text, so it is green by his rule and keeps its identity from tracking rather than hue. `.rule-gold`
   is a decorative divider in the same family as the header hairline he blessed. *One line each.*

# 5. 🔒 WHAT I DECIDED THAT DISCO DID NOT — and where DISCO was wrong

⚠️ **DISCO's handoff was good research, but three of its factual claims do not reproduce.** Every
number below was re-measured by me on 2026-09-01; the queries are in the ledger.

| # | What DISCO said | What is true |
|---|---|---|
| 1 | **three** raw readers show `{{SIG.*}}` | ⚠️ **FIVE.** It missed `src/pages/DocsParticipantFlow.tsx:432` — a **public, unauthenticated** signing flow at `/docs/release-participant` (`src/App.tsx:240`) that renders an unsigned body directly above the signature box. Its onboarding line number (1963) was **already stale**; it is 1994 |
| 2 | **590** gold refs app-wide | **568**, across 96 files. DISCO used `gold-[0-9]*` — zero-or-more — which also counts `gold-ink` and prose in comments. Its per-file numbers are off by one or two nearly everywhere (ContractPage 43→**41**, Onboarding 17→**16**, ClauseDocument 12→**11**, DocumentsContent 5→**2 numeric + 3 `gold-ink`**) |
| 3 | CR-102's judgement calls are the ⟦NEEDS⟧ highlight, `.eyebrow` and focus rings | **The real one is bigger and DISCO did not name it** — see §4.1. The contract surfaces' whole authoring affordance is built out of gold |

**And the decisions I made that were not in the handoff at all:**

- 🔒 **The resolver moves to `src/lib/documentBody.ts`.** DISCO left the shape open ("by resolver call
  or by converging on the shared renderer — DSNR's shape call"). **Both, and neither alone:** the
  function moves to a shared module (killing one of two `src` duplicates, D18), and
  `BodyWithSignatures` calls it — **one edit fixing four of the five readers.** The fifth needs the
  resolution before `paginateBody`, because pagination measures text and a token is a different width
  than a date.
- 🔒 **`api/_lib/documentPdf.ts` is deliberately NOT converged.** `src/lib/documentPdf.ts:13-17` states
  the constraint verbatim: the `api` and `src` tsconfig projects **share no module**. Verified — zero
  imports cross that line. **Left as a deliberate twin, and the spec says so, so a build thread does
  not "tidy" it into something that will not compile.**
- 🔒 **`normalizeKindForField` gets EXACT-KEY matching for the address kinds, not substrings.** It
  matches with `.includes()`, and ⚠️ **`'capacity'.includes('city')` is `true`.** It does not bite
  today, but the function is advertised as "add a row to `FIELD_GROUPS` and it just works", so the
  next row someone adds is the trap.
- 🔒 **`SignStart.tsx:690`'s `.toUpperCase()` on CHANGE is removed**, not left beside the new blur
  normalizer. It is the app's only existing address normalization and it is **the wrong half of the
  spine** — correcting a value while the person is still typing is exactly the silent correction
  CR-83 exists to prevent. ⚠️ **This is the one subtractive edit in the batch.**
- **`text_only_phone` on `Onboarding.tsx:1615` gets a normalizer.** One line, same page, same spine,
  same defect as its sibling at `:1592`. **A deliberate scope addition by me, flagged as mine in the
  spec (`B` §3e) so it does not read as drift.** *Strike it if you would rather it did not ride along.*
- **The gold class names are NOT renamed.** `.btn-outline-gold` will paint green, and that is a
  half-lie — but renaming it is 80 call sites across 44 files while `D`, `E` and `F` are all live in
  those files. **One line under "flagged, not fixed" for a later `CLNR` pass instead.**
- 🔒 **`gold-N` → `green-N`, same numeric step, is the mapping.** Both scales run dark→light in the
  same direction. ⚠️ **A same-step rule is the point: 487 sites across three threads cannot survive
  per-site taste.** Two deviations are allowed and both are named (placeholder text converges on the
  incumbent `text-muted`; white-on-fill contrast is computed and stated).
- **Strikethrough is already correct.** The owner listed it; `Onboarding.tsx:1969` is
  `text-muted line-through`, green-toned, no brown. ⚠️ **`D` is told to REPORT "already correct" and
  explicitly told not to invent a change to have something to show.**

# 6. ⚠️ WHAT I DID NOT DO, SO YOU ARE NOT SURPRISED
- **I did not run the app or a browser.** Every number here is `grep`, `git` or a file read. **No
  render in this batch is verified by anyone until the owner walks it** — which is why all six specs
  end in a numbered checklist for him rather than a claim.
- **I did not touch code.** `git status` shows only my three docs.
- **I did not re-open anything the owner locked** — the address-lookup answer and the
  decorative/functional ruling are both built on, not revisited.

# 7. 🔒 THE PROMPT — AND IT IS FOR `ORCH`, NOT FOR A BUILD THREAD

**Your next stop is `ORCH`, which sequences these and dispatches them. Nothing needs the owner first.**

```
FHE-ORCH-SIGNFLOW

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/reports/FHE-DSNR-SIGNFLOW-HANDOFF.md and sequence TASK-SIGNFLOW-A through F.
A, B and C are file-disjoint and can run together; D needs all three, E and F need C.
```

⚠️ **When you dispatch, each build thread's prompt is two lines and ONE absolute path to its spec —
nothing else. The specs are written to need nothing else.**
⚠️ **Each spec names a worktree requirement it does NOT have: `docs/method/TASK-ROLE.md` §5 says
`NO ASSIGNMENT, NO WORKTREE`. Name `wt-1`/`wt-2`/`wt-3` beside the model line when you hand them out.**

# 8. TEARDOWN
**Process census run at close: this thread started no server, no build, no watcher and no background
job. Nothing to reap.** Read-only against production throughout — **zero queries were run against the
database, because none of the three change orders touches it.**
