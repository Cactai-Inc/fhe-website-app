# REMAINING WORK

**Measured 2026-08-26, not remembered.** Where a number appears, it came from a query.

---

## 0. ⚠️ BUILD THIS FIRST — AHEAD OF T3

**`docs/tasks/TASK-ORIGIN-three-things-he-must-be-able-to-log.md`**

The owner is about to review **every client account by hand** and log where they found us, how they
contacted us, and what they bought. ⚠️ **If those surfaces do not exist when he starts, he enters
everything twice.** He confirmed the sequence himself: *"before i review every client's account i
need the surfaces to be there."*

**It is small, and it is on the critical path for the metrics work**, which cannot compute an
attribution number that was never captured.

## 1. THE BUILD SEQUENCE — three threads, two done

| | | |
|---|---|---|
| **T1 VERSIONSPINE** | ✅ **MERGED** `baabdc11` | `parent_version` on all three version tables with a CHECK, an append-only trigger (proven by attempting UPDATE and DELETE), `contract_template_versions` backfilled for 26 templates, save/list/restore where restore mints forward |
| **T2 CONTRACTOPTIONS** | ✅ **MERGED** `e10624e0` | `contract_menu_dependents` searching **three** condition sites, `active` on option entries, five RPCs where `recode` exists in order to refuse |
| **T3 SURFACEEDITOR** | ✅ **MERGED** `04b150be`, 2026-08-27, by a parallel orchestrator session (this repo's `HANDOFF-ORCH<n>.md` lineage — see ⚠️ note below) | Verified independently before merging, not inherited: `email_template_versions` 24 rows + live append-only trigger; `content_blocks` confirmed still 0 rows and `get_content_block` confirmed still NULL under `SET ROLE anon` (the blocked-not-deferred finding below is real and still true); zero pre-merge TS callers of `email_template_*` confirmed; `/app/ops/admin/editor` has a route, `pageRegistry` row, and nav row; all four retired routes still resolve. typecheck/lint clean at the 48-warning baseline. Archived `archive/surfaceeditor-2026-08-27`, worktree removed. |

⚠️ **UI page copy did NOT land, as this file anticipated.** Confirmed still true post-merge:
`content_blocks`/`content_block_versions` still 0 rows, and — the actual blocker — `get_content_block`
resolves the tenant through `current_org()`, which an anonymous visitor's session can't set. Public
marketing copy can't be served from the config store without an anon-safe read path first (a security
decision), and extraction across 124 page files is a separate pass after that. The editor states this
on-screen rather than implying it was missed. Ordered path to done is in
`docs/reports/TASK-SURFACEEDITOR-REPORT.md` §7.4.

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
| `docs/tasks/TASK-ATTRIB-where-they-came-from.md` | ⛔ **SUPERSEDED 2026-08-27 by `TASK-ORIGIN`** (§0), which covers it and adds contact-channel and historic-purchase-with-a-date. **Its three verified allowlist traps were folded into `TASK-ORIGIN` §4 before it was retired.** Retained under D32; do not run it |

## 4. ⚠️ ONE COMMIT DELIBERATELY UNMERGED — AND IT WAS MERGED BY MISTAKE, THEN REVERTED, 2026-08-27

**`b9bc9edc` on `task/contractoptions`** — *"the board is organised by whose move it is, not by
department"*. 441 lines: a `WaitingZones` component, registry changes, a 272-line migration.

**It is not merged, on purpose.** The thread that wrote it says so itself: its rows **announce and
then link away** — *"Confirm $460" sends you to the payments page instead of confirming inline* —
which fails `TASK-DASHFEED` §3, the half-measure rule the owner was most emphatic about. **Merging it
would install the thing he complained about and give T3 something to undo.**

⚠️ **Its `_waiting_items()` mechanism IS the right spine** — it already implements "declare your
cluster from your own state". **Finish it against the DASHFEED spec; do not discard it.**

⚠️ **INCIDENT, 2026-08-27, self-corrected within the same session: a parallel orchestrator session
(the `HANDOFF-ORCH<n>.md` single-file lineage — see the note at the top of this file) audited
`wt-contractoptions` without reading this file first, found `b9bc9edc` genuinely unmerged by content
diff, did not know the reasoning above existed, and merged it — live, pushed to production
(`1450a864`).** Caught roughly 10 minutes later when that session's own memory-check surfaced this
folder for the first time. **Reverted immediately** (`e3c7da6e`, `git revert -m 1 1450a864`),
re-typechecked/linted clean, re-pushed. `WaitingZones.tsx` and the migration file are gone from `main`
again; the DB functions (`dash_waiting_on_you`/`dash_waiting_on_clients`) remain live in production —
harmless with zero callers, exactly the state they were in before either session touched them. **No
user-facing exposure window is known to have been observed**, but the commit was live on `main` (which
auto-deploys) between roughly 02:24 and 02:41 on 2026-08-27 — worth a mention to the owner if he was
in the app in that window. **The lesson, now in `orchestration/lessons/LESSONS.md`: before touching
any worktree, check for a canonical current-state file (this one) before trusting your own git
archaeology, no matter how thorough it feels.**

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

## 7. WHAT THE PARALLEL SESSION SHIPPED — real, verified, not from this lineage's own thread

The `HANDOFF-ORCH<n>.md`-lineage session noted at the top of `00-START-HERE.md` did real, correct
work alongside the incident in §4:

- **TASK-PAMELA** (account save-vs-send; horse-in-contract fields) — audited and merged. Found and
  fixed two things the build's own report missed: a Save was still flipping a lead's
  `requests.status` to `invited` (would have silently dropped people from the follow-up queue —
  `inbound_queue`/`dash_people_waiting()` both key off that column), and a stale "Barn name" label
  live on `RecordsPage → Horses` beyond the one occurrence the report's grep found.
- **T3/SURFACEEDITOR** — merged, folded into §1 above.
- **TASK-ONERAIL** (`docs/tasks/TASK-ONERAIL-three-entry-paths-one-first-login-rail.md`) — written,
  landed, **not yet run**. Read-only adversarial verification of whether the three paths that end in
  a first login (self-service `/sign/*`, admin provision, contract link email) actually converge on
  one shared mechanism per D18. Settles whether `provision_client_invitation` line 135's live
  `apply_category_documents` call can still fire post-OFFERINGDOCS. Spawn prompt is in the file
  itself. Opus 5, effort high, if you're the one deciding whether to send it.
