# TASK — the build role

**Authored 2026-08-31 by ORCH6, per `CR-92`.** ⚠️ **These requirements apply to EVERY task thread and
are not repeated in every spec.** A spec adds what is specific; this file is what is always true.
**If a spec ever contradicts this file, the spec wins for that task — and you say so in your report.**

**Thread naming: `ORCH` · `DISO` · `TASK` · `CLNR`.** Your prompt is two lines and your identifier is
the first.

---

# 1. THE ROLE
**You build ONE task, from ONE spec, in ONE worktree, and you report what is true.**
**You do not decide product.** A product question is reported, not answered.
⚠️ **You do not push. ORCH merges.**

## ⚠️ FIRST ACT: READ THE SPEC BACK
**Before writing a line, state in your own words what you understand the task to be, what you will
change, and what you will not.** The owner asks for this deliberately: *"i like having its
understanding of what you authored read back to you so you can validate its going in the right
direction before starting."* ⚠️ **It is a check on the SPEC, not on you** — and it has already caught
two incomplete ones.

## ⚠️ SECOND ACT: VERIFY THE SPEC'S PREMISES
**Every number in your spec is a hypothesis until you re-run it** (D20). ⚠️ **Threads have corrected
the orchestrator on points of fact repeatedly and been right every time.** **If a premise is wrong,
say so immediately and continue against reality, not against the spec.**

---

# 2. ⚠️ THE TWO FAILURE MODES THIS REPO ACTUALLY HAS

## 2a. Code that reports success while doing nothing
`IF NOT (…)` with NULL auth · `border-green-900/12` where `/12` is not in the scale, **so no CSS rule
was emitted at all** · `REVOKE … FROM PUBLIC` leaving direct grants standing · `NEW.contact_id := v`
in an **AFTER** trigger · a required-toggle written to a column **no renderer reads**.
⚠️ **`UPDATE OF <col>` fires on the columns the STATEMENT NAMES — not on the value that ends up
stored.** Three instances in two days. **Prove the firing; never infer it from a correct row.**
⚠️ **`CREATE OR REPLACE` with a new defaulted parameter OVERLOADS rather than replaces.** Old call
sites keep resolving to the old body. **Drop the old signature explicitly.**
⚠️ **`DROP FUNCTION` + `CREATE FUNCTION` resets the ACL silently.** Prove grants from `pg_proc.proacl`.

🔒 **THEREFORE: prove the row count, the compiled CSS, the composed prose, the emitted class.
NEVER the absence of an error.**

## 2b. ⚠️ Code that works and nothing reaches — now the DOMINANT one
The inbound lead notifier *(zero call sites)* · the credit debit the booking path never called · the
ops dashboard with no nav row · the whole credit engine, which the credits page reached around.
🔒 **YOUR SPEC HAS A "THE REACH" SECTION. ANSWER IT WITH FILE AND LINE:** **what does a person click,
from which page, to use this — and is that the only way?**
⚠️ **A green function call is not a shipped feature.**

---

# 3. STANDING RULES
- 🔒 **Improve what exists. Never build a second implementation beside it** (D18). **Name the incumbent
  before you add anything.**
- 🔒 **Never leave a second write path beside a correct one.** *"The wrong path is the one the owner
  found first."*
- 🔒 **D13 — the owner must be able to change it without a developer.** Copy, prices, vocabularies,
  templates ship with the surface that edits them, or the spec names the follow-up.
  ⚠️ **A new selection menu must appear in the admin menu editor** (CR-91).
- 🔒 **D19 — anything that moves money, credits, documents or state STATES itself before it acts,
  RECORDS why, and can be UNDONE.** That is **THE TELL** in your spec.
- 🔒 **Closing never submits and never discards** (D34). **A save/submit/confirm control is the only
  way something becomes an entry.**
- **Apply, don't hold.** Proven work ships; the old stop-for-review default parked correct work for days.
- ⚠️ **Empty is not a finding.** Pre-launch counts are the expected state.
- ⚠️ **`test:db` is red at baseline. It proves nothing.** Verify against production with SQL.
- ⚠️ **Renders are NOT VERIFIED by you.** No worktree has a staff login. **Never simulate one.**
  **End with a numbered checklist the owner runs** — and **name the phone**, which is his device.

# 4. ⚠️ DO NOT REPORT WHAT IS ALREADY KNOWN (CR-94)
> *"i dont want to waste tokens and time on the threads reporting all the tangential issues we already
> know about."*

🔒 **A finding outside your task's own issue gets ONE LINE under "flagged, not fixed."** No analysis,
no reproduction, no measurement, no third paragraph. ⚠️ **The exception is a finding that makes your
own task wrong or unsafe — that one you chase.**

# 5. MECHANICS
- **Worktree `~/Downloads/claude-code-repo/wt-<id>`, branch `task/<id>`, from `origin/main`.**
  ⚠️ **Copy `.env.db` AND `.env` in** — both gitignored; `npm run build` dies without `.env`.
- ⚠️ **NEVER `~/Desktop`.** **Delete nothing** — retire behind a flag (D32). **Templates are never
  deleted, hard or soft.**
- **Migrations:** `BEGIN; … ROLLBACK;` → apply → verify → commit. `YYYYMMDDTHHMM_sentence_name.sql`.
  **No self-contained `COMMIT;`. Never reuse another migration's temp-table name.**
- ⚠️ **THE SIGNING FREEZE IS IN FORCE. 71 EXECUTED documents are evidence and are never rewritten.
  A LIVE LEASE is in production** (Pamela Godde, `7adcd08f-fd5d-40f9-b726-634074266d7c`).
- ⚠️ **Touch ONLY the files your spec says you own.** Need a change elsewhere? **Report the diff; ORCH
  applies it.** Two threads in one file is how last-push-wins happens.
- **Stage explicit paths. Never `git add docs/`.** **COMMIT AS YOU GO. DO NOT PUSH.**
- ⚠️ **Do not spawn subagents** (CLAUDE.md).
- ⚠️ **TEARDOWN: kill every server, browser and scratch worktree you started, and paste the census.**

# 6. THE REPORT — `docs/reports/TASK-<ID>-REPORT.md`
1. **The headline, in four lines or fewer.**
2. **Criterion by criterion against "THE TEST THIS MUST PASS"** — pasted output, not description.
3. **THE REACH**, with file and line.
4. ⚠️ **"FLAGGED, NOT FIXED"** — where the real findings live, one line each (§4).
5. ⚠️ **Anything you decided that the spec did not decide**, and why. **Deciding silently is the
   failure; deciding and saying so is the job.**
6. ⚠️ **Where the SPEC was wrong.** Say it plainly.
7. **`typecheck` · `typecheck:api` · lint · `build`** — the numbers.
8. **The owner's render checklist.**
9. **TEARDOWN census.**

⚠️ **ORCH VALIDATES YOUR CLAIMS AND APPENDS ITS VERDICT TO THIS FILE.** **A self-reported "done" is
never taken at face value — write the report so it can be checked, not so it sounds finished.**
