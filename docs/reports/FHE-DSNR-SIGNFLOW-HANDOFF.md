# FHE-DSNR-SIGNFLOW HANDOFF — for ORCH

**From `FHE-DSNR-SIGNFLOW`, 2026-09-01. Subject: `CR-100`, `CR-101`, `CR-102`.**
**Upstream:** `docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md`.
**Working ledger, with every query behind every number here:** `docs/reports/FHE-DSNR-SIGNFLOW-LEDGER.md`.

**Three change orders and two same-day directives became FIVE task specs.** All three are written, self-sufficient, and ready to
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
| **`FHE-TASK-SIGNFLOW-C`** | `TASK-SIGNFLOW-C-green-the-signing-flow-end-to-end.md` | CR-102 | **13 files, 175 refs** + one scope class in `src/index.css` | **A, B** |
| **`FHE-TASK-SIGNFLOW-D`** | `TASK-SIGNFLOW-D-retire-the-two-signing-doors-we-do-not-use.md` | owner directive 2026-09-01 | trace, then retire `/release` + `/docs/release-participant`, **and close the anonymous signing grant** | — |
| **`FHE-TASK-SIGNFLOW-E`** | `TASK-SIGNFLOW-E-five-doors-one-signing-flow.md` | owner directive 2026-09-01 | **a WALK** — prove the five legitimate doors all land in the same signing flow; repair only what the walk breaks | — |

**`A` ‖ `B` ‖ `D` ‖ `E` are file-disjoint and can run at the same time. `C` follows `A` and `B`.**
**175 of the app's 568 gold refs change. The other 393 stay gold — the owner's nav and accents.**

> ## ⚠️ SECOND REVISION, 2026-09-01 — THE OWNER RETIRED TWO SIGNING DOORS
> > *"we dont use docs/release-participant nor /release, those urls if they are still operational
> > should be traced and most likely anything associated with them should be decommissioned and the
> > /sign/ flow should be the single pathway we use and just have different ways of getting there to
> > accommodate the various scenarios/places/events a client would be served with the link to it."*
>
> **`A` and `C` were amended, not rewritten.** `A` still fixes both pages **for free** (they share the
> renderer it edits) but spends nothing on them and does not verify them. `C` **cuts them from its file
> list and from `.flow-green`** — 6 application points became 4 — because painting a page that is being
> deleted is waste and would collide with `D`.
> 🔒 **`D` is new, and §2a of its spec is the finding that makes it matter — see §5 below.**

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
| `D` | **Opus · thinking ON · HIGH** | a trace, a production count it must ATTRIBUTE correctly (the same template keys are signed through `/app/onboarding`), and a `REVOKE` migration on a live signing function. |
| `E` | **Opus · thinking ON · HIGH** | five doors, each proven from the database rather than the code. ⚠️ **The failure mode is a thread that reads the code, finds it correct, and reports convergence it never observed** — which is the failure this whole task exists to catch. |
| `C` | **Opus · thinking ON · HIGH** | 175 mechanical replacements is the easy half. **The hard half is the `.flow-green` scope class**: CSS specificity, `@apply` inside a descendant selector, and React portals that escape the scope entirely (§7 T5 of its spec). **Those three are where it silently ships half-done.** |

> ## ⚠️ THIRD REVISION, 2026-09-01 — THE SIGNING-ENTRY RULING
> > *"the ways to get to a signable doc are the self driven account activation via website order
> > submission, /sign/* url, and manual account creation with docs required, and then the manual
> > provisioning of the docs being required is another way and then if an account places an initial
> > order for something that requires docs to be signed and they dont have them signed and linked to
> > their account the system generates the flow for them to sign them on the next app login. all of
> > those should result in the user being taken to the same flow that a person clicking the email link
> > that comes from using the /sign/* flow. the others can be removed. **we dont have a situation where
> > a person without an account signs documents on an ipad or any other way.**"*
>
> 🔒 **The last sentence UNBLOCKED `D`.** It answered the two questions that were going to hold its
> Phase 2 — visit-day, and a printed QR code in the wild. **Both struck. `D` now has ONE stop
> condition and it is technical.** ⚠️ **Its Phase 1 still runs — he asked for a trace — but it measures
> for the record, not to decide.**
> 🔒 **And the rest of it produced `E`, which is a WALK, not a build — because all five doors appear
> to be BUILT already. See §5c.**

# 4. FOR THE OWNER — nothing blocks a dispatch, and `D`'s questions are answered

**CR-102's four calls are gone — his narrowing answered them. `D`'s three questions are gone — the
signing-entry ruling answered them.** 🔒 **Dispatch all five without waiting on him.**

**Two things will come back to him, both from `E`, both AFTER its walk rather than before:**
1. **The deal ending.** `/sign/deal` lands on `/app/contracts/:id`; the other three `/sign/` funnels
   land on `/app/onboarding` (`src/pages/Register.tsx:40-55`). ⚠️ **So `/sign/*` — the thing he named
   as the canon — already has TWO endings.** **DSNR's read: probably legitimate and probably
   converging one step later** (`Onboarding.tsx:907` navigates to `/app/contracts/{id}/start` when a
   contract is what is outstanding) — **but that is a read, not a proof, and `E` must settle it.**
2. **Anything the walk finds landing nowhere usable**, with the smallest fix, **not built until he
   answers.**

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

## 🔒 5a. THE FINDING BEHIND `D`, AND IT IS WORTH MORE THAN THE DELETED LINES
**`api/sign-release.ts:41-47` builds an ANON client and `:133` calls `sign_release` with it.** So that
function still holds an `anon` EXECUTE grant — **and yesterday's hardening migration spared it on
purpose.** `supabase/migrations/20260831T1200_signing_rpcs_are_not_anonymous.sql:21-23`, verbatim:
> *"the public kiosk paths sign through `sign_release` / `sign_general_release`, which are untouched
> here."*

🔒 **Those two pages are the ONLY reason an unauthenticated stranger can still write a contact, an
engagement and an EXECUTED document.** **Retiring them is what finally closes that door** — which
three prior threads (`TASK-AR7`, `TASK-FIX1`, the ORCH5 audit) flagged and could not close because
the kiosks needed it. ⚠️ **`D`'s spec makes it prove the result from `pg_proc.proacl`, and warns that
`REVOKE … FROM PUBLIC` alone leaves a direct `anon` grant standing — a trap this repo has hit before.**

## 5b. THE OTHER DECISIONS I MADE ON THE RETIREMENT
- 🔒 **TRACE FIRST, DELETE SECOND — because he said *"traced and most likely decommissioned."***
  **Two phases in ONE thread**, so it still ships if it is safe rather than becoming a report nobody
  actions. **Phase 2 runs only on a clean Phase 1.**
- 🔒 **NO DATABASE ROW IS TOUCHED** (D32). **Documents signed through those flows are legal records.**
  The only migration is a `REVOKE`/`GRANT`; **the functions themselves are not dropped**, because a
  `DROP`+`CREATE` resets the ACL and because executed documents reference the path that made them.
- **The removal is ordered so each step is separately revertable**, routes first — **removing the three
  routes alone satisfies the whole of his ask**, and everything after it is cleanup.
- **`api/deliver-documents` STAYS.** It is shared with `SendCopiesMenu.tsx:39` and the onboarding
  set-delivery. ⚠️ **The spec makes `D` prove that rather than assume it, and item 9 of its test signs
  a real onboarding document afterwards** — that is where a shared-delivery regression would show.
- **The docs are marked RETIRED, not deleted** — `SURFACE-INVENTORY.md:80-81`, `FLOW-MAP.md:24` (F3),
  `flows/onboarding.md:157`/`:174` — so the next reader does not rediscover a flow that was removed
  deliberately.
- **A 404 for a stranger with an old link is flagged, not solved.** `D` recommends whether a redirect
  to `/sign` is wanted; **it does not build one, because that is the same product decision as Q2.**

## 🔒 5c. WHAT THE SIGNING-ENTRY TRACE FOUND — the five doors are already built
**Traced by DSNR from the code, 2026-09-01. ⚠️ Read, not walked — which is exactly why `E` is a walk.**

| # | The owner's door | Where it is |
|---|---|---|
| 1 | website order submission | `src/lib/api.ts:143` `submitRequest` → `POST /api/request-activation` → `provision_client_invitation` (`:119`). Its own header says *"a website order submission gets the SAME"* |
| 2 | `/sign/*` | `POST /api/sign-start` → same RPC (`:357`) → `/activate?token=` (`:410`) |
| 3 | manual account creation with docs | `ProvisionClientForm.tsx` → `POST /api/admin-send-invitation` → same RPC (`:310`) |
| 4 | manual doc provisioning | `ClientRecordActions.tsx:718` → `POST /api/documents-requested` → ⚠️ emails `${origin}/app/onboarding` **directly**, not `/activate` (`:116`) |
| 5 | order requires docs → the flow appears at next login | 🔒 **THE SIGNING WALL** — `myWallState()`, `AppLayout.tsx:1548-1568`, `:1693`, fed by `contract_role_documents.disposition = 'AT_LOGIN'`, **which is the column default** |

🔒 **Doors 1, 2 and 3 already share ONE spine RPC. Door 5's mechanism exists and defaults ON.**
**So the owner is describing something largely BUILT, and the honest task is to PROVE it reaches —
not to build it again.** ⚠️ **`E` is written as a walk for that reason, and it says in as many words
that "all five converge, here is the proof" is a complete and likely result.**

**The two things the trace could not settle, both now `E`'s job:**
- **Door 4 emails a bare `/app/onboarding` to someone who may have no account** (`has_account` is in
  its result shape at `:35`). ⚠️ **If the no-account case is unhandled, that person meets a login wall
  with no way through.** **In scope for `E`.**
- **Door 5 looks correct from the SCHEMA, which is the weakest possible evidence.** `AT_LOGIN` being
  the default makes the wall look wired whether or not anything writes the rows. 🔒 **`E` must prove
  it link by link** — this repo's dominant failure is code that works and nothing reaches.

⚠️ **AND THE TRAP `E` IS WARNED ABOUT HARDEST:** `FLOW-MAP.md:159` records the guest flow being
declared unbuilt *"reasoned from production emptiness."* **It existed.** **A door with no rows is not
a broken door.**

# 6. ⚠️ WHAT I DID NOT DO, SO YOU ARE NOT SURPRISED
- **I did not run the app or a browser.** Every number here is `grep`, `git` or a file read. **No
  render in this batch is verified by anyone until the owner walks it** — which is why all four specs
  end in a numbered checklist for him rather than a claim.
- 🔒 **I DID NOT QUERY PRODUCTION, AND COULD NOT.** The repo's `.env` carries only
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. ⚠️ **So every claim about what has actually been
  SIGNED through the retiring flows is inherited from `FLOW-MAP.md`, not measured — and `D`'s spec
  says so in those words.**
- **I did not touch code.** `git status` shows only my three docs.
- **I did not re-open anything the owner locked** — the address-lookup answer and the
  decorative/functional ruling are both built on, not revisited.

# 7. 🔒 THE PROMPT — AND IT IS FOR `ORCH`, NOT FOR A BUILD THREAD

**Your next stop is `ORCH`, which sequences these and dispatches them. Nothing needs the owner first.**

```
FHE-ORCH-SIGNFLOW

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/reports/FHE-DSNR-SIGNFLOW-HANDOFF.md and sequence TASK-SIGNFLOW-A, B, C, D and E.
A, B, D and E are file-disjoint and can run together; C follows A and B.
E is a walk, not a build — "all five doors already converge" is a complete result.
```

⚠️ **When you dispatch, each build thread's prompt is two lines and ONE absolute path to its spec —
nothing else. The specs are written to need nothing else.**
⚠️ **Each spec names a worktree requirement it does NOT have: `docs/method/TASK-ROLE.md` §5 says
`NO ASSIGNMENT, NO WORKTREE`. Name `wt-1`/`wt-2`/`wt-3` beside the model line when you hand them out.**

# 8. TEARDOWN
**Process census run at close: this thread started no server, no build, no watcher and no background
job. Nothing to reap.** Read-only against production throughout — **zero queries were run against the
database, because none of the three change orders touches it.**
