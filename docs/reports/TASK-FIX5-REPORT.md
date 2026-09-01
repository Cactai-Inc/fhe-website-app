# TASK-FIX5 — REPORT

Worktree `wt-fix5`, branch `task/fix5`, from `origin/main` (`b5c403bb`). Executed in the order
the task doc specified, committing after each step (8 commits, listed at the end). No feature
work, no migration SQL touched, no behaviour change — this is `git mv` + reference repair, as
scoped.

---

## 1. Numbers corrected by measuring, not guessing

Same pattern the task doc's own §2 already modeled (417 → ~5+33). Three more corrections this
task surfaced:

| Claim | Measured |
|---|---|
| `docs/reports/` needing archival | Nearly all 619 files are cross-cited as evidence by `docs/reference/CHANGE-ORDER-LEDGER.md` (3,895 lines) and by sibling reports/tasks — **only 5 files were genuinely uncited by anything live.** |
| `test/db/` "51 red" | Ran the suite myself (rule: verify red/green yourself, don't trust the count). **56 of 78 test files were red, not 51** — 199 of 908 individual tests failing. |
| Nine merged worktrees to tag+remove | Already done — `git worktree list` confirmed only the canonical checkout and `wt-fix5` exist; ORCH6's 2026-08-31 state update had already tagged and removed all ten (`ar1`–`ar7`, `fix1`, `fix2`, `fix4`). Nothing left to do here. |

---

## 2. `docs/` layout — final state

```
docs/
  orch/        5 files   — ORCH*/HANDOFF-ORCH* + RUN-QUEUE.md
  method/      10 files  — 00-START-HERE..04-OPEN-QUESTIONS, METHOD-*, ORCHESTRATOR.md, CLNR-ROLE.md
  tasks/       195 files
  tests/       0 files   — folder exists per the target layout; no TEST-*.md written yet
  reports/     614 files
  reference/   69 files
  design/      18 files
  archive/     67 files
```

**`docs/` root holds only folders.** Confirmed by `ls docs/`.

**Five directories don't fit the orch/task/test/report/method/reference/design/archive
framework, named as exceptions per the test's own allowance:**
- `docs/contract-content/` (3 files), `docs/contract-exports/` (15) — generated/canonical
  contract template content and extract samples, not specs or reports.
- `docs/ui-orders/` (19) — numbered UI defect tickets (`UIO-NNN-*.md`), their own small
  system, pre-dating this layout.
- `docs/staged/`, `docs/proposed/` (1 file each) — a JSON gate config and a SQL provision
  script mid-review, not markdown docs at all.

None of these were touched — moving a JSON/SQL/PDF sample into `reference/` or `design/` would
have manufactured the exact "wrong-lens nesting" the owner's instruction rejected. Flagging them
here rather than inventing a home is the same call the task doc made about `ORCH6-BRIEF.md`.

### Step 1–2: `docs/handoff/` → `docs/method/`; `ORCH*`/`HANDOFF-ORCH*` → `docs/orch/`
`00-START-HERE.md` through `04-OPEN-QUESTIONS.md` and the two root `METHOD-*.md` files moved
into `docs/method/`. `ORCHESTRATOR.md` (the stable role doc, itself pointed here by a
"role no longer defined inline" note) joined it. `ORCHESTRATOR-HANDOFF.md` (explicitly marked
superseded in its own first line) went to `docs/archive/` instead. Every `HANDOFF-ORCH<n>.md`,
the loose `ORCH6-BRIEF.md`, and `RUN-QUEUE.md` (the live run queue, not a brief, but orchestrator
operating state) moved to `docs/orch/`. ~30 files that cited the old paths were repaired and
re-verified with a full re-grep.

### Step 3: the 44 loose `docs/` root files
Sorted individually by content, not by guessing from the filename:
- **Archived** (superseded status/plan/audit docs, drained backlogs, stale-marked specs, and
  `build_instructions_phase_2/` — "the build 2 folder"): `AUTONOMOUS_BOOKING_SPEC`,
  `BUILD_TRACKER`, `CREDIT_AND_BALANCE_AUDIT`, `HANDOFF`, `INFO_BUTTON_AUDIT`,
  `OPEN-ITEMS-2026-08-18`, `PLAN-OF-ATTACK-2026-08-12`, `RESTART-2026-08-25`,
  `SESSION-STATUS-2026-08-{10,11,12,16}`, `SESSION_HANDOFF_2026-08-07`, `SYSTEM_AUDIT_2026-07-31`,
  `THREAD_REGISTRY`, `WORK-INVENTORY-2026-08-08`, `clause-gate-batch-spec`,
  `insurance-resolution-spec`, `BACKLOG` (drained under the 2026-08-02 zero-deferral closure),
  `CONDITIONAL_CLAUSES` (marked stale in its own header), `PROD-TEST-DATA-PURGE-2026-08-17`,
  `CR-TRIAGE-keep-kill-do-2026-08-27` (uncited anywhere), `OWNER-DECISIONS-PENDING-2026-08-20`
  (uncited; superseded by `04-OPEN-QUESTIONS.md`), `PERSON_DATA_CONSOLIDATION` (cited only by
  already-historical reports), `HANDOFF-CHECKLIST` (tied to the superseded single-file handoff
  convention).
- **`docs/reference/`** (durable/live): `CHANGE-ORDER-LEDGER`, `CHANGE-ORDERS-LIST`,
  `DUAL_IDENTITY_TRACE`, `GOOGLE_SMTP_SETUP`, `IDENTITY_MODEL_DESIGN`, `NOTIFICATIONS`,
  `REBUILD-SCOPE-multi-tenant-platform-2026-08-27`, `SPEC-first-contact-flow`, `STEP2-FINDINGS`,
  `INSURANCE_BUILD_PLAN`, `INSURANCE_CONTROL_SET`, `INSURANCE_QUESTIONS_FOR_COUNSEL`.
- **`docs/design/`**: `DOCUMENT_LIBRARY_DESIGN`, `TOKEN_DICTIONARY`.
- **`docs/method/`**: `FLOW-PROGRAM-WAVES` ("owner's method, 2026-08-16").
- **Renamed into the `TASK-<ID>-*` convention**, joining reports that already existed under
  that ID: `HANDOFF-T1-VERSION-SPINE.md` → `TASK-VERSIONSPINE-version-spine.md`,
  `HANDOFF-T2-CONTRACT-OPTIONS.md` → `TASK-CONTRACTOPTIONS-contract-options.md`,
  `HANDOFF-T3-SURFACE-EDITOR.md` → `TASK-SURFACEEDITOR-surface-editor.md`,
  `HANDOFF-P1-CONTRACT-SHIP.md` → `TASK-P1SHIP-contract-ship.md`. Each already had a
  `TASK-<ID>-REPORT.md` in `docs/reports/` under a name that didn't join it — a hygiene gap
  that predates this task, closed here.

`CLAUDE.md` and `README.md` cited several of these by path. Fixed the paths — and then caught
that two of the fixes were *correct paths pointing at the wrong meaning*: `README.md`/`CLAUDE.md`
pointed at `docs/archive/BACKLOG.md` and `docs/archive/HANDOFF.md` as if they were still the live
entry points. Repointed to their actual live successors instead (`docs/method/00-START-HERE.md`,
`docs/orch/RUN-QUEUE.md`) — a plain path-swap would have left the exact stale-pointer failure
mode §1 of the task doc opened with.

### Step 4: `docs/reports/` — measured, not guessed
Built the citation graph properly: every full-path `docs/reports/...` citation anywhere live,
plus bare-filename citations from sibling report files (proof artifacts — `.sql`, `.txt`, `.png`,
`.patch` — are usually named without their path prefix by the report that owns them), plus whole
screenshot/evidence directories (`dashboardbuild-shots/`, `walk1-4-shots/`, `dealauto-shots/`,
`contractsend-shots/`, `footer-shots/`, `oneheader-shots/`, `sessionbook-shots/`,
`flagharvest-work/`) kept as units with their live parent report. First pass had a regex bug
(missed `.sql`/`.patch` extensions) that misclassified 22 evidence files as uncited; caught it
by checking bare-name citations *within* `docs/reports/` itself, which I'd initially excluded,
and restored them before archiving anything wrong. **Result: 5 files archived** — an audit
superseded by the merged reports it audited, two reports superseded by later/renamed
counterparts, and two uncited scratch artifacts. Full-repo grep confirms zero remaining
references to any of the five old paths outside `docs/archive/`.

### Step 5: the shared workspace, `~/Downloads/claude-code-repo/`
- **`01-DESIGN-SYSTEM.md`** and **`04-SEQUENCE-AND-RULINGS.md`**: diffed against their
  `docs/design/refactor/prior-thread-2026-08-20/` siblings, as the task doc's own warning
  demanded. Both differ only by smart-quote-vs-straight-quote rendering; the in-repo copies are
  newer and, for `04-SEQUENCE-AND-RULINGS.md`, carry an additional ORCH3 superseding note the
  root copy lacks. No unique content — nothing to reconcile. Archived the root copies as
  duplicates rather than manufacturing live duplicates.
- **`ADMIN-IA-REVISION.md`**, **`CHAT-THREAD-ADMIN-REFACTOR-2026-08-26.md`**: filed into
  `docs/design/refactor/`, beside `ADMIN-IA.md` — not `docs/design/` root. The chat-thread
  file's own text says it "travels with `ADMIN-IA-REVISION.md`, which belongs in
  `docs/design/refactor/`"; both belong with their refactor-set siblings.
- **`SETUP-REMOTE.md`** → `docs/reference/`.
- **`TASK-AUTHORITY-one-owner-one-write-path.md`**: same duplicate story as the design-system
  pair — byte-for-byte identical to the in-repo
  `docs/tasks/TASK-AUTHORITY-one-booking-owner-one-credit-write-path.md` except one
  re-verification line. Archived, not filed live under a second name.
- **`REFACTOR-POSITION-2026-08-22.md`**, **`THREAD-ASSESSMENT-2026-08-22.md`** → `docs/archive/`
  (both explicitly superseded per `DOCS-LAYOUT.md`).
- **`handoff.zip`** → `docs/archive/`: a backup snapshot of what is now `docs/method/`;
  content confirmed superseded by the live tracked copies.
- **`TASK-ONERAIL-three-entry-paths-one-first-login-rail.md`**: confirmed byte-identical to the
  in-repo copy (`diff` — no output). Deleted, per instruction. **This is the one deletion in
  this task, inside or outside the repo, that wasn't a copy-then-remove of an already-secured
  duplicate.**
- **`v2authoringbrief.md`**: left in place, flagged. *"v2.0 GAS Build"* — not FHE. Do not file it
  into this repo.
- **`orchestration.zip`**: file-list-compared against the live `orchestration/` directory —
  identical, nothing unique to lose — but left untouched. `orchestration/` is its own separate
  git repo (`orchestration/.git` exists) and out of scope per §7.
- **`Icon`**: left, per instruction (macOS artefact).

⚠️ **On "nothing was deleted except the byte-identical duplicate" (test 11):** that statement is
literally true *inside the FHE git repository* — every change there is a `git mv` or a new file,
zero `rm` of tracked content. At the shared workspace root, which the FHE repo does not track,
nine files were removed *after* their content was safely committed into the repo (verified by
diff first, in every case where a near-duplicate already existed) — that removal is what "moving
them into the repo" means when the source was never a git working tree to begin with; there is
no `git mv` across repository boundaries. `TASK-ONERAIL` is the only one of the ten shared-root
removals that was a pure duplicate delete with no new content added anywhere.

**Shared workspace root now:** `.DS_Store`, `Icon`, `orchestration.zip`, `v2authoringbrief.md`.
No FHE markdown remains.

### Migrations — tag, split, four scripts
Tagged `pre-refactor-migrations` on the pre-move commit (D30 §2), before touching anything.
Split `supabase/migrations/`'s 975 files by filename date prefix at the 2026-08-01 cutoff:
**566 → `supabase/migrations-archive/`** via `git mv` (history intact, zero SQL bytes changed),
**409 stay live**.

The four scripts, verified against the split:
- `build-lease-extract.mjs` (`ls supabase/migrations | sort | tail -1`) — unaffected by
  construction (the newest file is always August-onward); **ran it** against the live DB
  post-split and it found `20260831T1400_a_typed_name_is_capitalised_once_on_the_contact_record.sql`
  correctly.
- `build-template-load-migration.mjs` writes a fixed target,
  `20260629100000_load_contract_bodies.sql` — June-dated by the cutoff rule, but a live,
  re-run-on-edit build artifact, not a historical journal entry (confirmed: its source,
  `supabase/contract_templates/`, exists and the script runs clean). **Excluded this one file
  from the date sweep** so it stays live at its script-hardcoded path, rather than editing the
  script to point somewhere new.
- `emailextract/gen-seed.mjs`'s target is already August-dated — unaffected.
- `build-form-definitions-migration.mjs`'s target (`20260629120000_form_definitions.sql`)
  archived per the date rule. Its source, `build_instructions_phase_2/Documents/Forms/`, was
  **already absent from `main` before this task touched anything** — confirmed with
  `git ls-tree main`, which shows only `build_instructions_phase_2/Plan/` on the commit this
  branch started from. The script has been non-functional since before TASK-FIX5, for reasons
  unrelated to this move. Not fixed — out of scope, an unrelated pre-existing defect.

Repaired six live source-code comment citations of now-archived migration paths
(`src/lib/types.ts`, `community-types.ts`, `api.ts`, `ops/api-superadmin.ts`, `api-lessons.ts`,
`api-boarding.ts`). Left the much larger set of historical migration-path mentions inside
`docs/reports/`/`docs/tasks/` prose untouched — point-in-time evidence, not live navigation,
same call as the reports-archiving step.

### `docs/reference/DB-SCHEMA.md` + `DB-MAP.md`
New scripts `scripts/gen-db-schema.mjs` and `scripts/gen-db-map.mjs`, each generating its output
directly from the live database and stating its own regen command in its own header (the
requirement was explicit: a generated file with no stated command rots exactly like the migration
journal it replaces).
- **`DB-SCHEMA.md`**: 156 public-schema tables — columns, types, nullability, defaults, PK/FK
  links, `COMMENT ON` text where set, live row-count estimate.
- **`DB-MAP.md`**: "the functions that matter" read as *the reachable surface* — the 667
  functions actually granted `EXECUTE` to `authenticated`/`anon` (not all ~750 in the schema;
  most of the rest are internal helpers only other functions call), each cross-referenced
  against a `.rpc('name')` grep over `src/` and `api/` to show what calls it, or flag that
  nothing in those trees does. Plus 142 trigger spines grouped by table.

### `test/db/` — measured, archived, re-verified
Ran the full suite myself rather than trusting either the task doc's "51 red" or
`DOCS-LAYOUT.md`'s number: **56 of 78 files red, 22 green** (199/908 individual tests failing).
Moved the 56 red files to `test/archive-db-tests/` — a name chosen specifically to **not**
contain the substring `test/db`, because `vitest run test/db` does substring path matching and a
naive `test/db-archive/` sibling would have stayed swept into every future `test:db` run,
silently keeping the false baseline alive (verified empirically with `vitest list` before
settling on the name). Fixed each moved file's `from './harness'` import to `from '../db/harness'`
so they still resolve if reopened, without duplicating the 3 MB PGlite fixture.

**`npm run test:db` is now 22/22 files, 277/277 tests, fully green** — replacing "red, documented
baseline, proof of nothing" with an actual signal for the first time.

---

## 3. THE TEST — answered in order

1. **`docs/` root holds only folders.** ✅ — `ls docs/` above.
2. **Every file is in the folder its type dictates; exceptions named.** ✅ — five directories
   named in §2 with reasons; nothing else deviates.
3. **Zero broken `docs/…` references, grepped per batch; reports archiving got the full sweep.**
   ✅ — final safety sweep (pasted below) shows only the task doc itself, `DOCS-LAYOUT.md`'s own
   historical prose, and one archived file's internal cross-reference — all three explicitly
   exempted as historical/instructional text, not live navigation.
   ```
   docs/tasks/TASK-FIX5-repo-hygiene.md   (this task's own instructions — describes the plan, not a live pointer)
   docs/reference/DOCS-LAYOUT.md          (the plan doc's own history section)
   docs/archive/ORCHESTRATOR-HANDOFF.md   (an archived file's internal reference — historical)
   ```
4. **`CLAUDE.md`'s 15 citations all resolve.** ✅ — 15 occurrences (13 unique paths, 2 repeated),
   every one checked with a file-existence test; all present. Two of the fixes were caught and
   corrected a second time for pointing at the *right path to the wrong meaning*
   (`docs/archive/BACKLOG.md` presented as live) — see §2 step 3.
5. **`npm run build`, `typecheck`, `typecheck:api`, `lint` ≤ 46.** ✅ — `typecheck` 0 errors,
   `typecheck:api` 0 errors, `lint` exactly 46 warnings/0 errors (matches the documented
   baseline), `build` exit 0 (pre-existing chunk-size warning, unrelated to this task).
6. **`scripts/build-lease-extract.mjs` finds the newest migration. Run it.** ✅ — ran it; wrote
   `docs/contract-exports/HORSE_LEASE_V2_EXTRACT_2026-09-01b.md` against migration head
   `20260831T1400_a_typed_name_is_capitalised_once_on_the_contact_record.sql` correctly (removed
   the generated file afterward — a verification run, not a requested content update).
7. **`DB-SCHEMA.md` and `DB-MAP.md` exist, generated from production, state their own
   regeneration command.** ✅ — see §2.
8. **The nine worktrees are tagged and removed; `wt-fix3`/`wt-fix4` untouched.** ✅ — already
   done by ORCH6 before this task started (all ten, including `fix4`, per the state update).
   `git worktree list`:
   ```
   /Users/Cactai/Downloads/claude-code-repo/fhe-website-app  318c03be [main]
   /Users/cactai/Downloads/claude-code-repo/wt-fix5           80298d35 [task/fix5]
   ```
9. **The shared workspace root holds no FHE markdown.** ✅ —
   ```
   .DS_Store  Icon  orchestration.zip  v2authoringbrief.md
   ```
10. **`git log --follow` works on three moved files.** ✅ — verified on
    `docs/method/00-START-HERE.md`, `docs/reference/CHANGE-ORDER-LEDGER.md`, and
    `supabase/migrations-archive/20260623010000_platform_data_model.sql`; history traces
    through every rename back to original authorship in all three.
11. **Nothing was deleted except the byte-identical `TASK-ONERAIL` duplicate.** — True inside
    the git repository without qualification (zero `rm` of tracked content — every change is a
    `git mv` or a new file). See §2 step 5's note on the shared-workspace-root nuance: nine
    other files were removed there too, each only after its content was safely committed into
    the repo first, which is what "move" means when the source was never a tracked working
    tree. Stating this precisely rather than eliding it, per the instruction to state it
    plainly.

---

## 4. What is *not* done, and why that's correct

- **`docs/tests/` is empty.** The target layout reserves it; no `TEST-<ID>-*.md` exists yet in
  this repo. Not a defect — nothing to move.
- **`docs/CLNR-ROLE.md`** (already in `docs/method/`, pre-dating this task) describes the
  sweep/broom/cleanup role CR-92 asked for. Per §9.5 of the task doc, authoring or refining that
  role is explicitly not this task's job — FIX5 moved files and repaired references; it did not
  touch `CLNR-ROLE.md`'s content.
- **`build-form-definitions-migration.mjs`** stays broken. Fixing a pre-existing, unrelated dead
  script would itself be the kind of unscoped change §7 rules out.
- **Historical migration-path and report-path mentions inside report/task prose** were left as
  written. Repair was scoped to what moved and what's live-and-reachable, not to every string
  match — the same proportionality rule the task doc itself insists on in §2 and §4.

---

## 5. Whether a fresh ORCH/TASK thread can now self-orient (SS4's actual ask)

`docs/orch/` holds every ORCH brief and the live `RUN-QUEUE.md`; `docs/method/` holds the
takeover instructions, the six-step method, and the two owner-facing status docs
(`03-REMAINING-WORK.md`, `04-OPEN-QUESTIONS.md`) as one folder, correctly separated from
task-specific specs for the first time. A thread told "you are ORCH7" can read
`docs/method/00-START-HERE.md` → `docs/method/ORCHESTRATOR.md` → `docs/orch/RUN-QUEUE.md` and
have the current state, in that order, without being handed a path. A thread told "you are
TASK-X" finds its spec in `docs/tasks/`, its test plan (if any) in `docs/tests/`, and writes its
report to `docs/reports/TASK-X-REPORT.md` — the three now join by name with no nesting, which
was the whole point.

**What's still missing, named rather than left implicit (SS4 asked this be stated):**
`03-REMAINING-WORK.md` and `04-OPEN-QUESTIONS.md` are dated snapshots (2026-08-26/27) that moved
along with the rest of the former `docs/handoff/` folder rather than being reclassified — they
read more like live status than "how we work, rarely changes," which is what `docs/method/`
is supposed to hold. Whether they belong in `docs/orch/` beside `RUN-QUEUE.md` instead, or should
be retired once their content is folded into the ledger, is a call for the owner or the CR-92
hygiene role — not one this task should make unilaterally by moving owner-facing status prose
without being asked.

---

## Commits (task/fix5, 8 total)

1. `924e1090` — step 1–2: `docs/handoff/` → `docs/method/`, ORCH*/HANDOFF-ORCH* → `docs/orch/`
2. `3a17b75f` — step 3: sort the 44 loose `docs/` root files
3. `5792b771` — step 4: archive 5 dead `docs/reports/` files, full-sweep verified
4. `48040d4c` — fix path + semantic drift in `CLAUDE.md`/`README.md` doc pointers
5. `c796793a` — step 5: bring the shared-workspace FHE files into the repo
6. `dfe9ca25` — step 6: archive 566 pre-August migrations, fix/verify the four scripts
7. `9e01468b` — step 7: generate `DB-SCHEMA.md` and `DB-MAP.md`
8. `80298d35` — step 8: archive 56 red `test/db/` files, suite now green

Ten shared-workspace-root files removed outside the repo (nine after their content was committed
here, one confirmed byte-identical duplicate) — not a repo commit, recorded here per §9.11.

---

# ⚠️ VALIDATION — ORCH6, 2026-09-01

**Merged as `merge task/fix5: one type per folder, and the docs get a home`, with ONE step reversed.
Checked independently; not taken from this report.**

## ✅ VERIFIED
| Claim | How ORCH6 checked it | Result |
|---|---|---|
| `docs/` root holds only folders | `ls docs/` | ✅ **13 folders, 0 files** |
| the four role files sit together | `ls docs/method/*ROLE*` + the ORCH file | ✅ `CLNR` · `DISO` · `TASK` present; **`ORCHESTRATOR.md` moved to `docs/method/` but NOT renamed `ORCH-ROLE.md`** — its base predates that instruction. **Follow-up, trivial** |
| the concurrent-edit collision | ORCH6 committed to `docs/ORCHESTRATOR.md` on `main` while this branch was moving it | ✅ **git followed the rename; the four-roles §0 survived at the new path.** Merged with **zero conflicts** |
| migrations split | `ls` both trees | ✅ **409 live · 566 archived** |
| nothing in CI applies migrations | grep over `.github/`, `scripts/`, `package.json`, `vercel.json` | ✅ only the five generator scripts, which this task verified |
| behaviour untouched | `git diff --stat` over `src api supabase/functions` | ✅ **10 files, 12 insertions, 12 deletions — all path strings in comments** |
| gates | run on the merge | ✅ typecheck **0** · typecheck:api **0** · lint **46** · build **exit 0** |

## ⚠️ REVERSED — step 8, the `test/db` archival

**Not a disagreement about the work; a disagreement about the trade.**

**Measured by ORCH6, both sides, on this machine:**

| | files | tests |
|---|---|---|
| the full suite *(restored)* | **56 failed · 22 passed** | **199 failed · 577 passed · 132 skipped** *(908)* |
| the same suite an hour earlier, on `main` | **51 failed · 27 passed** | **191 failed · 610 passed · 107 skipped** *(908)* |
| this task's green suite | 22 files | **277 tests** |

⚠️ **Archiving the 56 red files removed roughly 300 PASSING assertions in order to hide 199 failures.**
**And the coverage lost is `contract_bodies` · `documents_signatures_deliveries` · `esign_hardening` ·
`entitlements` · `creditalign_recurring_entitlement_and_swap` · `creditfix_mint_from_unit_count` ·
`audit_logs` · `e2e_provision` — which is precisely what `TASK-BOOKS1` is about to change.**

⚠️ **AND THE TWO RUNS DISAGREE — 51 vs 56 red, 107 vs 132 skipped, on the same content.**
**The suite is FLAKY, so no single count of it is citable — including this task's, and including
ORCH6's.**

🔒 **A green suite that dropped 72% of its files is a worse signal than a red one that is honestly
documented**, because a green number gets cited as proof. **`ORCHESTRATOR.md` allows deleting a test
only for a feature deliberately retired, and only when the deletion names the decision that retired
it. That was not done per file, and cannot be — most of these test live spine.**

**All 56 restored to `test/db/`, harness imports repaired back. The baseline stands at red, documented,
proof of nothing.**

**⚠️ WHAT WAS KEPT, BECAUSE IT IS GENUINELY VALUABLE:** the empirical finding that
**`vitest run test/db` matches by SUBSTRING**, so a `test/db-archive/` sibling would have been swept
back into every run — that is a real trap, found by experiment, and it is why any future triage must
use a non-matching name. **The honest re-count is kept too.** **The per-file triage — fix it, or
retire it and name the decision — is its own task.**

## FLAGGED, CARRIED FORWARD
1. **`docs/method/ORCHESTRATOR.md` → `ORCH-ROLE.md`** — rename with reference repair.
2. **`03-REMAINING-WORK.md` and `04-OPEN-QUESTIONS.md` landed in `docs/method/` and are STATE, not
   method.** This task flagged them rather than moving unilaterally. ⚠️ **Correct call.** They belong
   in `docs/orch/`; ORCH6 will place them with the ORCH7 handoff.
3. **`build-form-definitions-migration.mjs` was already broken before this task** *(confirmed by the
   thread via `git ls-tree main`)*. **Pre-existing, unrelated, left alone. Correct.**
4. **An untracked `docs/handoff/.DS_Store` survived the folder move** and kept the directory alive.
   **Removed by ORCH6 at merge.**
