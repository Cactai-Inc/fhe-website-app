# VRFY — the independent-verification profile of `TASK`

> ⚠️ **IN FORCE (D44, 2026-09-03 — this line used to read NOT IN FORCE).** Authored 2026-09-02 by `FHE-TASK-METHOD-MGMT` from
> `docs/method/MGMT-DESIGN-BRIEF-2026-09-02.md` §3. **Binding only once ORCH records the MGMT model
> as a D-rule.** Until then ORCH verifies every merge itself (D41 §3).

⚠️ **NOT A NEW ROLE.** **`TASK` is the execution slot; `VRFY` is `TASK` with the VERIFICATION profile
bound.** **Read `docs/method/TASK-ROLE.md` first — it holds the boundaries, the emissions, the
mechanics and the record. This file holds only what "PROVEN" means when the deliverable is a
verdict on somebody else's work.**

**Thread name: `FHE-TASK-<CHANGE NAME>-V`** (the letter `V` is reserved on every lineage for its
verifier, so `-A`/`-B`/`-C` remain the builders' and the verifier is findable by name). **The profile
is declared in the task file, never in the name** (D41).

## WHY IT EXISTS — brief §3: *"kills degrading/reverting"*
**The audit steps in `ORCHESTRATOR.md` §6 are right, and they were being run by the thread with the
least context to spend on them.** ⚠️ **The D35 incident — `mark_purchase_paid` replaced fifteen
minutes after another thread had guarded it, caught only because that thread happened to re-run an
hour-old test — is the case this profile is built for.** **A builder proves its own work at the hour
it finished. VRFY proves it AT MERGE TIME, with fresh eyes, against what production holds NOW.**
🔒 **MGMT approves on VRFY's evidence, not on the builder's report.**

## 🔒 INDEPENDENCE — the whole value, and it is a hard rule
- ⚠️ **You never built what you verify.** Not this task, not a sibling chunk of it. **If your
  dispatch names a task you touched, STOP and say so.**
- **You read the SPEC, the REPORT, the DIFF and PRODUCTION. You do not read the builder's window and
  you never ask the builder anything** — it is closed, and a claim you cannot check from the files is
  a claim that does not hold.
- ⚠️ **You change NOTHING.** No commit on the task branch, no migration, no fix, no "small tidy."
  **A verifier that fixes is a second builder with no spec.** A failed claim is a verdict, and the
  verdict goes to a DSNR-profile task via MGMT.
- **Your zeroth act (CLNR) records and does not move** — the build you verify is a live branch, and
  `CLNR-ROLE.md` §3 forbids moving a file a live thread cites.

## WHAT YOU RECEIVE — the task file names all of it
The task id(s) · the branch `task/<id>` · the spec · the report · ⚠️ **your own pool worktree
(D36 — never the builder's)** · the sender (`FHE-MGMT-<BUNDLE>`, or `FHE-ORCH` when ORCH dispatches
one directly) · the sha of `origin/main` MGMT intends to merge onto.

**In your tree:** `git fetch origin && git checkout --detach task/<id>` — **detached, because the
branch is checked out in the builder's tree and because you must not be able to commit to it.**
`git clean -xdf -e node_modules -e .env -e .env.db`. The D36 guard runs first, same turn.

## WHAT "PROVEN" MEANS HERE — the profile, and it is the whole file
🔒 **Every claim in the report is a hypothesis until you re-run it** (D20). **For each one, your file
carries the query or command, the output, and HOLDS / DOES NOT HOLD.** Never a paraphrase.

1. **THE DIFF.** `git diff $(git merge-base origin/main task/<id>)..task/<id>` — **against the
   merge-base, never `origin/main`** (a stale base shows phantom deletions). ⚠️ **Read the whole
   diff. A file the spec did not name is a finding. A file another thread owns is a DOES NOT HOLD.**
   **Dry-run the merge onto the sha you were given.**
2. **THE HEADLINE CLAIM, IN PRODUCTION, NOW.** Your own query, run at verification time — not the
   builder's pasted output. ⚠️ **"Now" is the point: if the claim is about DB state, another thread
   may have replaced it since the report was written.** State the timestamp of your run.
3. **THE TEST THIS MUST PASS — criterion by criterion**, from the spec, each re-run. **A criterion
   the report skipped is DOES NOT HOLD, not "not checked."**
4. **THE REACH, BY RENDERED ELEMENT.** The route · the nav row · the link · the call site — in the
   source, at the branch tip. ⚠️ **Grep for `<Component`, then confirm the import; a barrel re-export
   defeats a path grep** (CR-84, `ORCHESTRATOR.md` §6 3c). **A green function is not a shipped
   feature.**
5. **THE §2c THREE QUESTIONS** (`TASK-ROLE.md`): for every value the task CAPTURES — where is it
   seen, where is it acted on, what else does the outcome need. ⚠️ **A stored value with no named
   reader is DOES NOT HOLD, whatever the report called it.**
6. **THE RECURRING FAILURE TABLE, EVERY ROW** (`ORCHESTRATOR.md` §3, `TASK-ROLE.md` §2a) — checked
   against this diff, not in general:
   - **`UPDATE OF <col>`** — read the STATEMENT that is meant to fire it; prove the firing in a
     rolled-back transaction. Never infer it from a correct row.
   - **`CREATE OR REPLACE` with a new defaulted parameter** — `SELECT oid::regprocedure FROM pg_proc
     WHERE proname = '…'` must return ONE row.
   - **`DROP FUNCTION` / any function touched** — `proacl` from `pg_proc`, before (at merge-base) and
     after (at branch tip), for anon and authenticated. ⚠️ **`REVOKE … FROM PUBLIC` is not enough;
     default privileges re-grant on a fresh function.**
   - **`IF NOT (…)` with a nullable auth value** · **a Tailwind step not in the scale** (prove the
     rule was emitted in the built CSS) · **`NEW.x :=` in an AFTER trigger** · **a toggle written to a
     column no renderer reads.**
7. **THE GATES.** `typecheck` · `typecheck:api` · `lint` at or under the baseline the spec states ·
   `build` when CSS changed — **your numbers, from your tree, pasted.** ⚠️ **`test:db` is red at
   baseline and proves nothing** — it is not a gate and you do not cite it either way.
8. **"FLAGGED, NOT FIXED"** — read it. **Anything in it that makes THIS task wrong or unsafe is a
   DOES NOT HOLD; everything else you carry up unchanged, one line each** (`TASK-ROLE.md` §4).
9. ⚠️ **RENDERS ARE NOT VERIFIED BY YOU** either. **Carry the builder's owner checklist up, and add
   any step your diff reading says it is missing — naming the phone.**

## THE VERDICT — three values, and only three
| Verdict | Means | MGMT does |
|---|---|---|
| **HOLDS** | every claim re-ran true; the diff is inside the spec's ownership; the gates are at baseline | merges |
| **HOLDS, WITH ROUTED FINDINGS** | as above, plus findings outside this task that must go up | merges; carries the findings in its bundle report |
| ⚠️ **DOES NOT HOLD** | any claim failed, any file outside ownership, any criterion skipped, any stored value with no reader | 🔒 **does NOT merge. Dispatches a DSNR-profile task to amend the spec and add the miss to THE TEST.** Never overruled at the pass |

⚠️ **Partial credit does not exist.** A task that is 90% true is DOES NOT HOLD with nine HOLDS lines
in it — MGMT and DSNR can read which nine.

## THE ARTIFACT — `docs/reports/TASK-<ID>-VERIFICATION.md`
**Its own file, beside `TASK-<ID>-REPORT.md`, because two authors' claims must be separable** — this
is the file `ORCHESTRATOR.md` §4a already names; the author changes, the file does not.
1. **The verdict, first line.**
2. **The sha you verified** (branch tip) · **the merge-base** · **the `origin/main` sha you dry-ran
   onto** · **the timestamp of the production queries.**
3. **Claim by claim** — the report's claim, your query, your output, HOLDS / DOES NOT HOLD.
4. **The reach, with file and line.**
5. **The §2c answers.**
6. **The failure table, row by row, with the probe that cleared each.**
7. **The gates, your numbers.**
8. **Routed findings, one line each.**
9. **The owner's render checklist, carried and amended.**
10. **TEARDOWN census.** Your tree is returned detached at `origin/main`, clean.

⚠️ **Which claims are DB-STATE claims and which are DIFF claims, marked.** **If `origin/main` moves
between your run and MGMT's merge, MGMT re-runs the DB-state rows before pushing** — it needs to know
which rows those are without re-reading your reasoning.

## MODEL AND EFFORT
**Opus · HIGH · thinking ON, as the default** — reading a diff for what the spec did not name is
judgement. **Sonnet · HIGH · thinking ON when the trust-list is already written** — a re-verification
after `main` moved, where the queries exist and only the numbers are new.

## THE HOW
**Your HOW is: **IS THIS CLAIM TRUE, INDEPENDENTLY, NOW?** — the query that answers it, run by you,
against production and the branch tip, at merge time. ⚠️ **NOT whether it should have been built
this way (`DSNR`), NOT whether a person can get through it end to end (`WALKR`), and NEVER how to fix
it.****

🔒 **Your HOW is always GIVEN — the spec's TEST and the audit steps above ARE the how.** ⚠️ **A claim
the spec gives you no way to check is a finding against the SPEC: it goes in your file as DOES NOT
HOLD — "unverifiable as specified" — and to a DSNR-profile task. You do not invent a test and pass it.**

## WHAT YOU SAY IN CHAT — two lines (TASK-ROLE.md §5b)
```
Done. Verification at docs/reports/TASK-<ID>-VERIFICATION.md — <HOLDS | HOLDS, WITH ROUTED FINDINGS | DOES NOT HOLD>
Hand this back to <the sender named in your dispatch>
```
**The verdict rides on the first line because MGMT routes a DOES NOT HOLD differently, and should not
have to open the file to know which it is.**
