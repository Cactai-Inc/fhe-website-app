# ORCH6 — YOUR BRIEF

**Written 2026-08-29 by ORCH5.** ⚠️ **This file instructs. It is not a status report.** If you finish
it and still have to ask the owner how to operate, it failed.

## WHERE YOU ARE

```
repo        /Users/cactai/Downloads/claude-code-repo/fhe-website-app
branch      main — pushed and clean
database    Supabase lrstswfxfsezdmvkvukc — connection string is LINE 1 of .env.db (gitignored)
platform    macOS. Every path above is absolute and real.
```

⚠️ **`cd` into the repo before anything.** A fresh session starts in `/Users/Cactai` or `~/Downloads`.

## READ THESE FIRST, IN THIS ORDER

1. **`docs/handoff/00-START-HERE.md`** — the live lineage. ⚠️ **It is the ONLY one; the
   `HANDOFF-ORCH<n>.md` single-file lineage stood down on 2026-08-27.**
2. **`docs/ORCHESTRATOR.md`** — the role. ⚠️ **A previous thread performed this role for a full
   session without reading it and the owner caught it.**
3. **`docs/handoff/02-THE-SIX-STEP-METHOD.md`** — how the owner works, in his own words.
4. **`CLAUDE.md`** — D1–D33, and ⚠️ **no subagent delegation in this repo.**

---

# 1. WHAT IS WAITING FOR YOU

**Six `TASK-AR*` research threads were launched by the owner on 2026-08-29.** They are **read-only**:
each produces a report and a proposed plan, and **none of them writes code.** That was deliberate —
several want the same files, and the sequencing is decided once all six reports exist.

| Task | Scope | Report |
|---|---|---|
| **AR1** | the calendar, entire | `docs/reports/TASK-AR1-REPORT.md` |
| **AR2** | reaching a client record + booking a 2× weekly rider | `TASK-AR2-REPORT.md` |
| **AR3** | Records page → Contacts + My Stable | `TASK-AR3-REPORT.md` |
| **AR4** | nav sections: renames, moves, Settings dissolved | `TASK-AR4-REPORT.md` |
| **AR5** | Modules → the account page, and back buttons | `TASK-AR5-REPORT.md` |
| **AR6** | should Activity and Oversight merge? | `TASK-AR6-REPORT.md` |

**Their shared depth standard is `docs/tasks/ADMIN-REVIEW-ANALYSIS-STANDARD.md`** — read it, because
it is what you audit the reports against.

# 2. YOUR SEQUENCE — the owner's own words

> *"The ORCH6 thread will begin by reviewing the output from the task threads and discuss the
> findings reports with me then author the build threads to correct all the issues using the findings
> reports as reference. After those fixes land and the threads are closed the next step is to run the
> 12 zone sweeps and review the findings with me. After those findings have all been reviewed, that
> thread will then generate an enumarated status document for me to provide to the claude chat thread
> for authoring the full admin app refactor and a handoff prompt for ORCH7 to spawn for the refactor
> when the document(s) are handed to me from the chat thread."*

**So, in order:**

1. **Audit the six reports.** ⚠️ **Never trust a self-reported finding.** Every claim checked in this
   project was worth checking. **Verify the headline claims yourself with your own query.**
2. **Discuss them with the owner** — one item at a time, most-blocking first, in the step-3
   presentation order in `02-THE-SIX-STEP-METHOD.md`.
3. ⚠️ **RECONCILE ACROSS REPORTS BEFORE AUTHORING ANY BUILD.** Six plans will contradict each other —
   AR3 and AR4 both want `pageRegistry.ts`; AR3, AR4 and AR5 all want `AppLayout.tsx` (**2,217 lines,
   all three nav surfaces**); AR2 and AR3 both reshape where a client record lives. **Six
   individually-approved plans deadlock at build time.** Every report carries a **contended-files
   list** precisely so you can compute the build order rather than guess it.
4. **Author the build threads**, sequenced by that contention. **Serialize anything sharing
   `AppLayout.tsx`.**
5. **Audit, merge, push, archive** each — `docs/ORCHESTRATOR.md` §6.
6. **Then, and only then, run the twelve zone sweeps** — `docs/tasks/ZONE-SWEEPS-A1-A12.md`, drafted
   with prompts and per-area model settings. ⚠️ **Sweeps are read-only, so they are freely concurrent;
   batch 3–4 so your audits stay real.** Method: `docs/METHOD-area-sweeps.md`.
7. **Review the twelve with the owner**, then **produce the enumerated status document** he hands to
   his Claude chat thread for authoring the full admin refactor.
8. **Write the ORCH7 handoff** for the refactor build.

**The chain after you:** ORCH7 runs the refactor · **ORCH8** receives the owner's hands-on UVT
findings and assigns remediation · **ORCH9** begins the client side. ⚠️ **Carry this roadmap forward
in your own handoff — it exists nowhere else.**

# 3. ⚠️ THINGS THAT WILL BITE YOU

1. ⚠️ **Code commits are blocked in the canonical checkout.** Work in a worktree at
   `~/Downloads/claude-code-repo/wt-<id>`. As the orchestrator MERGING, `FHE_ALLOW_CODE=1 git commit`
   is the sanctioned exception.
2. ⚠️ **Worktrees need `.env.db` AND `.env` copied in explicitly** — both gitignored, and
   `npm run build` dies without `.env`.
3. ⚠️ **`GROUP_LABEL` in `pageRegistry.ts` is exported and read by NOTHING.** The nav's real labels
   are string literals at `AppLayout.tsx:633-649`. **A rename applied to the dead one changes nothing
   on screen.**
4. ⚠️ **`DROP FUNCTION` + `CREATE FUNCTION` resets a function's grants to the schema default,
   silently.** Postgres refuses `CREATE OR REPLACE` when a defaulted parameter is added, so widening
   a signature forces a drop. **Any migration that drops a function restores its grants explicitly
   and proves the end state from `pg_proc.proacl`** — a `REVOKE` reporting success is not proof.
5. ⚠️ **`PUBLIC EXECUTE` is on 376 of 748 functions**, so an ACL alone proves nothing either way.
   **Call the function as `anon` in a rolled-back transaction and count rows.**
6. ⚠️ **`test:db` is 51 files red on `main`** and has been for weeks. **Documented baseline. Nothing
   may cite it as proof.** Lint baseline is **48 warnings**, measured.
7. ⚠️ **A LIVE LEASE WITH A REAL CLIENT IS IN PRODUCTION** — Pamela Godde, `HORSE_LEASE_V2`, document
   `7adcd08f-fd5d-40f9-b726-634074266d7c`. It is **sent and awaiting signature**; blockers are
   clear. **Rehearse anything destructive in `BEGIN; … ROLLBACK;`.**
   ⚠️ **And one thing the owner should decide before she signs:** `TXN.RIDER_AIDS_PROHIBITED` is
   `owner_role = LESSOR` — **her** field — and was answered `NO` by the LESSEE on 2026-08-26. **Raise
   it; do not fix it.**

# 4. ⚠️ TWO RULINGS THE OWNER OWES YOU

1. **The browser harness.** `test/browser/` exists in two modes. The shimmed mode (real page, real
   Chromium, PGlite behind it) is safe and is the only honest way to prove a render. **The live mode
   signs into PRODUCTION as the owner and mutates it, which contradicts `ORCHESTRATOR.md` §4's *"no
   worktree gets a staff login"* — in committed code.** ⚠️ **Either the rule stands and the live probe
   retires, or the rule is amended with a dedicated non-owner test identity and read-only default.
   ORCH5 recommended the latter. It was not answered.**
2. **CR-30 versus item 3.** CR-30 is an owner ruling that **leads leave the Records page entirely**
   and become a dashboard notification. His 2026-08-29 item 3 says to **move Leads onto a Contacts
   page.** ⚠️ **AR3 is instructed to surface this collision rather than choose. Put it to him.**

# 5. HOW THIS THREAD ENDS

Everything committed and pushed · **`docs/handoff/` updated, since it is the only live lineage** ·
any new settled decision recorded in `CLAUDE.md` as a numbered D-rule · a memory entry for anything
that outlives this repo · and the ORCH7 handoff written as **instructions, not a status report**.

⚠️ **The test it must pass: nothing this thread knows exists only in this thread.** An unwritten
judgement — why a plan was scoped that way, what the owner meant by an ambiguous instruction, which
approach was rejected and why, **and where you turned out to be wrong** — is an unwritten decision,
and the handoff is incomplete until it is written down.
