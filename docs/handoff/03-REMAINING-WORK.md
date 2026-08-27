# REMAINING WORK

**Measured 2026-08-26, not remembered.** Where a number appears, it came from a query.

---

## 1. THE BUILD SEQUENCE — three threads, two done

| | | |
|---|---|---|
| **T1 VERSIONSPINE** | ✅ **MERGED** `baabdc11` | `parent_version` on all three version tables with a CHECK, an append-only trigger (proven by attempting UPDATE and DELETE), `contract_template_versions` backfilled for 26 templates, save/list/restore where restore mints forward |
| **T2 CONTRACTOPTIONS** | ✅ **MERGED** `e10624e0` | `contract_menu_dependents` searching **three** condition sites, `active` on option entries, five RPCs where `recode` exists in order to refuse |
| **T3 SURFACEEDITOR** | ⏳ **READY, NOT STARTED** | `docs/HANDOFF-T3-SURFACE-EDITOR.md`. Prerequisites verified present on `main`. **Opus · thinking ON · effort HIGH** |

**T3's prompt:**
```
T3-SURFACEEDITOR

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/HANDOFF-T3-SURFACE-EDITOR.md and build it.
```

⚠️ **WATCH FOR IN ITS REPORT:** whether it honestly names **UI page copy as not landed** rather than
half-extracting it. `content_blocks` and `content_block_versions` are **still zero rows** — that store
has never been driven, and it is the real reason pages are the risky third of that build.

## 2. THE CHANGE-ORDER PASS — ⚠️ THE BULK OF THE WORK, AND IT IS BARELY STARTED

**`docs/CHANGE-ORDER-LEDGER.md` holds 80 change requests. THREE are locked.**

The six-step method is `docs/handoff/02-THE-SIX-STEP-METHOD.md`. **Step 3 (Discussion & Lock) is where
it stalled**, and it stalled because live defects kept pre-empting it — which is the owner's call, not
a failure.

**Resume at CR-30's three open questions** *(people surfaces)* — ⚠️ **re-read them against CR-75
first; the client surface changed after they were asked.** Then the recommended order at the end of
`docs/STEP2-FINDINGS.md`: pricing/cadences/comps → open slots + the toggle → the lead's world → the
lying pages and flow exits → G9 globalization.

⚠️ **This is a chat-and-ruling job, not a build job.** It runs in the orchestrator thread with the
owner, in parallel with build threads.

## 3. SPECS WRITTEN, NOT BUILT

| Spec | State |
|---|---|
| `docs/tasks/TASK-DASHFEED-cluster-by-what-it-asks-of-you.md` | ⚠️ **BLOCKED on three owner questions — see `04-OPEN-QUESTIONS.md`.** Direction is picked and ruled: cluster by the ask (YOURS / THEIRS / TODAY), not by subject |
| `docs/tasks/TASK-ONEEDITOR-one-editor-and-a-version-lineage.md` | §2 reconciled after T1. T3 builds it |
| `docs/tasks/TASK-CONTRACTMENUS-…md` | Rules still govern; its §4 build shape is superseded |
| `docs/tasks/TASK-DAYSHEET-…md` | ⚠️ Largely **now built** — the calendar email work shipped 2026-08-26. **Re-read before assigning; it is stale.** |

## 4. ⚠️ ONE COMMIT DELIBERATELY UNMERGED

**`b9bc9edc` on `task/contractoptions`** — *"the board is organised by whose move it is, not by
department"*. 441 lines: a `WaitingZones` component, registry changes, a 272-line migration.

**It is not merged, on purpose.** The thread that wrote it says so itself: its rows **announce and
then link away** — *"Confirm $460" sends you to the payments page instead of confirming inline* —
which fails `TASK-DASHFEED` §3, the half-measure rule the owner was most emphatic about. **Merging it
would install the thing he complained about and give T3 something to undo.**

⚠️ **Its `_waiting_items()` mechanism IS the right spine** — it already implements "declare your
cluster from your own state". **Finish it against the DASHFEED spec; do not discard it.**

## 5. LOOSE ENDS, SMALL BUT REAL

- ⚠️ **`COST_OPTS` / `DUTY_OPTS`, `ContractCascade.tsx:1449`** — a hardcoded second option vocabulary
  outside everything T2 built. Cannot be deactivated, relabelled, or found by the dependents read.
  **In T3's brief.**
- ⚠️ **`lesson_plans` is a fifth versioning idiom** — restores by re-writing forward (correct in
  spirit) but has no `parent_version` and no append-only guard. **In T3's brief.**
- **`wt-dealparty` / `task/pagefit`** is merged and can be removed.
- **Lint baseline is 48 warnings on `main`**, not the "~26" `CLAUDE.md` claims. **`CLAUDE.md` is
  stale on that line.**
- **`npm run test:db` is 51 files red / 27 green on `main`** and has been for weeks. ⚠️ **That is the
  documented baseline, it runs off a schema snapshot that does not replay migrations, and NOTHING may
  cite it as proof.** Verify against production with `psql`.

## 6. WHAT SHIPPED TODAY — so you do not "find" it as new

Payments became numbered records with split-payment support · card and Stripe removed from every
surface · the calendar emails cut to two, with admin@ receiving neither · file view + soft/hard
delete · the contract's horse derived rather than stored · capacity typed at the signature · the
sign button no longer wiping a clause-composed contract · added payment lines printing and the no-fee
sentence made conditional · dependents sorting with their guardian · My Stable alphabetised ·
the dashboard KPI header unpinned.
