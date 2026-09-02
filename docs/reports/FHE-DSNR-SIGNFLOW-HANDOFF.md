# FHE-DSNR-SIGNFLOW HANDOFF — for ORCH

**From `FHE-DSNR-SIGNFLOW`, 2026-09-01. Subject: `CR-100`, `CR-101`, `CR-102`.**
**Upstream:** `docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md`.
**Working ledger, with every query behind every number here:** `docs/reports/FHE-DSNR-SIGNFLOW-LEDGER.md`.

**Three change orders became THREE task specs.** All three are written, self-sufficient, and ready to
dispatch. 🔒 **Nothing is waiting on the owner.**

> ## ⚠️ REVISED 2026-09-01, AFTER THE OWNER READ THE FIRST VERSION
> **CR-102 was specced app-wide across four chunks. He narrowed it the same day, and struck its
> central premise.** Verbatim:
> > *"just change the items to green, leave the gold used in the app nav and other accents throughout
> > the app in their light gold color. the signing flow from first page through the last should switch
> > the gold to green for sure. other pages can be evaluated on a case by case basis when i have the
> > opportunity to view them. dont change things in the app arbitrarily."*
>
> **And on the affordance argument I had built §4 around** — that the gold wash on contract fields
> signalled *"this is a control, not the document"*:
> > *"the document is set inside a contained box that is clearly differentiated from the app surface.
> > and green vs gold would not change how the viewer interprets whether or not the content is an app
> > surface."*
>
> 🔒 **He is right — the containment does that work, not the hue. There was no affordance to preserve.**
> **`TASK-SIGNFLOW-D/E/F` are void and archived** (`docs/archive/TASK-SIGNFLOW-*-SUPERSEDED-2026-09-01.md`,
> each carrying his ruling on its first line). **`C` is rewritten: 175 refs in 15 files, not 568 in 96.**
> ⚠️ **`A` and `B` are UNCHANGED by this — they are CR-101 and CR-100 and he did not touch them.**

---

# 1. THE CHUNKS, IN DEPENDENCY ORDER

| Thread | Spec (`docs/tasks/`) | CR | Owns | Must merge first |
|---|---|---|---|---|
| **`FHE-TASK-SIGNFLOW-A`** | `TASK-SIGNFLOW-A-an-unsigned-document-shows-no-signature-machinery.md` | CR-101 | the token resolver moves to `src/lib/documentBody.ts`; **5 readers** routed through it | — |
| **`FHE-TASK-SIGNFLOW-B`** | `TASK-SIGNFLOW-B-address-inputs-normalize-on-blur.md` | CR-100 | 4 new normalize kinds + 3 doors | — |
| **`FHE-TASK-SIGNFLOW-C`** | `TASK-SIGNFLOW-C-green-the-signing-flow-end-to-end.md` | CR-102 | **15 files, 175 refs** + one scope class in `src/index.css` | **A, B** |

**`A` ‖ `B` are file-disjoint and can run at the same time. `C` follows both.**
**175 of the app's 568 gold refs change. The other 393 stay gold — the owner's nav and accents.**

## ⚠️ WHY THESE ARE THE CHUNKS AND NOT OTHERS

- **CR-101 is ONE chunk, not four**, even though it fixes five separate readers. Four of the five share
  `BodyWithSignatures` (`src/components/ops/documents/MergedBodyView.tsx:30`), so **one edit fixes
  four**; the fifth (`PaperViewer`) needs the resolution before `paginateBody` instead. **One seam,
  one function, one task.**
- **CR-100 is ONE chunk** — three doors, but one `NormalizeKind` switch. Splitting by door would put
  three threads in one 133-line file.
- 🔒 **CR-102 IS NOW ONE CHUNK, because the owner's narrowing made it one.** 175 refs in 15 files is
  one thread's work. **The four-way split existed only to make 568 refs across 96 files survivable.**
- 🔒 **AND THE ONE REAL DESIGN DECISION LEFT IN IT — §5 below.** The three PUBLIC signing doors
  (`/sign/...`, `/docs/release-participant`, `/release`) have **ZERO inline gold**: all their brown
  arrives through global classes shared with 57–122 other files. **Replacing inline classes alone
  leaves a third of the signing flow untouched**, and flipping the global classes repaints the whole
  app — the exact thing he said not to do. **The spec resolves it with a `.flow-green` scope class.**

# 2. ⚠️ THE CONTENTION I CAN SEE — you hold the schedule, I do not

🔒 **THREE FILES ARE TOUCHED BY TWO CHUNKS EACH. This is the only reason `C` is gated.**

| File | Chunks | Resolution |
|---|---|---|
| `src/components/app/ContractCascade.tsx` | **A** (resolver move, `:262-322`) · **C** (40 gold refs) | **A merges first.** Both specs say so; `C` §7 T3 tells it to re-grep every line number |
| `src/components/app/DocumentsContent.tsx` | **A** (`:167`, `:273`, `:507`) · **C** (2 gold refs + the scope class) | same |
| `src/pages/app/Onboarding.tsx` | **B** (5 inputs) · **C** (16 gold refs + the scope class) | **B merges first**, same handling |

**Everything else is disjoint by construction** — `C` carries an exhaustive 15-file list, and `A`'s and
`B`'s files do not overlap each other.

**Two notes for your scheduling, not decisions:**
- ⚠️ **`A` and `C` both edit `ContractCascade.tsx`, which is 1,700 lines and the most-edited file in
  the repo.** If anything else live is in it, `C` is the one to delay — it has the most to redo.
- 🔒 **NONE OF THE THREE TOUCHES THE DATABASE.** No migration, no RPC, no seed, no backfill. **So D35's
  shared-database hazard does not apply to this batch** and worktree isolation is genuinely sufficient
  here — unusually, for once.

# 3. MODEL AND EFFORT — a recommendation; you decide

| Thread | Recommend | Why |
|---|---|---|
| `A` | **Opus · thinking ON · HIGH** | the work is a reach hunt across a module boundary. **DISCO missed a reader; the risk is that `A` misses one too.** |
| `B` | **Opus · thinking ON · HIGH** | the incumbent file argues against this change **in writing** (`normalize.ts:120-126`) and two tests assert the old behaviour. A thread that reads fast will revert itself. |
| `C` | **Opus · thinking ON · HIGH** | 175 mechanical replacements is the easy half. **The hard half is the `.flow-green` scope class**: CSS specificity, `@apply` inside a descendant selector, and React portals that escape the scope entirely (§7 T5 of its spec). **Those three are where it silently ships half-done.** |

# 4. 🔒 FOR THE OWNER — NOTHING. All four of the calls in the previous version are gone.
**His narrowing answered every one of them**: the footer icons, the public header CTA, `.eyebrow`
app-wide and `.rule-gold` are all **outside the signing flow**, so they keep their gold and no longer
need a ruling. **The affordance question he struck outright.**
⚠️ **`ORCH`: dispatch all three without waiting on him.**

# 5. 🔒 WHAT I DECIDED THAT DISCO DID NOT — and where DISCO was wrong

⚠️ **DISCO's handoff was good research, but three of its factual claims do not reproduce.** Every
number below was re-measured by me on 2026-09-01; the queries are in the ledger.

| # | What DISCO said | What is true |
|---|---|---|
| 1 | **three** raw readers show `{{SIG.*}}` | ⚠️ **FIVE.** It missed `src/pages/DocsParticipantFlow.tsx:432` — a **public, unauthenticated** signing flow at `/docs/release-participant` (`src/App.tsx:240`) that renders an unsigned body directly above the signature box. Its onboarding line number (1963) was **already stale**; it is 1994 |
| 2 | **590** gold refs app-wide | **568**, across 96 files. DISCO used `gold-[0-9]*` — zero-or-more — which also counts `gold-ink` and prose in comments. Its per-file numbers are off by one or two nearly everywhere (ContractPage 43→**41**, Onboarding 17→**16**, ClauseDocument 12→**11**, DocumentsContent 5→**2 numeric + 3 `gold-ink`**) |
| 3 | CR-102's judgement calls are the ⟦NEEDS⟧ highlight, `.eyebrow` and focus rings | **The real one is structural and DISCO did not name it: the three PUBLIC signing doors have ZERO inline gold.** All their brown comes through global classes shared with the rest of the app — see §5's `.flow-green` entry |

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
- 🔒 **`.flow-green` — a SCOPE CLASS, and it is the one real design decision in CR-102.**
  Five global classes paint the flow brown (`.eyebrow` 57 files · `.btn-outline-gold` 44 ·
  `.focus-ring` 122 · `.form-input` 95 · `.text-gold-ink` 30). **The three public doors have no inline
  gold at all — they are brown entirely through those five.** Flipping them globally repaints the app
  he told me not to touch; green sibling classes means 42+ call-site swaps and gives no answer for
  `.focus-ring`/`.form-input`, which are on nearly every element. **A scope class is ~6 application
  points, covers all five at once, and is the cheapest thing to unwind when he later greens more:
  flip the base classes, delete the scope.**
- 🔒 **`.btn-sign` flips outright rather than being scoped** — **verified: exactly three adopters, all
  three in the signing flow** (`Release.tsx:466`, `Onboarding.tsx:2046`, `ContractPage.tsx:2307`).
  **Zero collateral, so scoping it would be ceremony.**
- 🔒 **The staff template + queue tooling is CUT** — `DocumentSurface` (13 refs), `FormSurface` (10),
  `EmailSurface` (3), `SurfaceVersions` (1), `TokenPicker` (3), `DocumentsQueuePage` (4),
  `DocumentQueueTable` (1) = **35 refs.** They were in the app-wide version. **They are staff authoring
  tools, not the signing flow, so they fall under "case by case, later."** ⚠️ **Item 10 of the spec's
  test makes the build thread CONFIRM they are still brown**, so nobody greens them helpfully.
- **The gold class names are NOT renamed**, and now they need not be — `.btn-outline-gold` stays gold
  everywhere except inside `.flow-green`, so the name is still honest.
- 🔒 **`gold-N` → `green-N`, same numeric step, is the mapping.** Both scales run dark→light in the
  same direction. ⚠️ **A same-step rule is the point: 175 sites cannot survive per-site taste.** Two
  deviations are allowed and both are named (placeholder text converges on the incumbent `text-muted`;
  white-on-fill contrast is computed and stated).
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
Read docs/reports/FHE-DSNR-SIGNFLOW-HANDOFF.md and sequence TASK-SIGNFLOW-A, B and C.
A and B are file-disjoint and can run together; C follows both.
```

⚠️ **When you dispatch, each build thread's prompt is two lines and ONE absolute path to its spec —
nothing else. The specs are written to need nothing else.**
⚠️ **Each spec names a worktree requirement it does NOT have: `docs/method/TASK-ROLE.md` §5 says
`NO ASSIGNMENT, NO WORKTREE`. Name `wt-1`/`wt-2`/`wt-3` beside the model line when you hand them out.**

# 8. TEARDOWN
**Process census run at close: this thread started no server, no build, no watcher and no background
job. Nothing to reap.** Read-only against production throughout — **zero queries were run against the
database, because none of the three change orders touches it.**
