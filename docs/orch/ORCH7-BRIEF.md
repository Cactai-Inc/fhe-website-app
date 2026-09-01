# ORCH7 — YOUR BRIEF

**Written 2026-09-01 by ORCH6.** ⚠️ **This file INSTRUCTS. If you finish it and still have to ask
the owner how to operate, it failed — fix it rather than asking him.**
🔒 **THE TEST THIS FILE MUST PASS: nothing ORCH6 knew exists only in ORCH6.**

## WHERE YOU ARE
```
repo        /Users/cactai/Downloads/claude-code-repo/fhe-website-app
branch      main — pushed and clean
database    Supabase lrstswfxfsezdmvkvukc — connection string is LINE 1 of .env.db (gitignored)
worktrees   wt-1 wt-2 wt-3 — idle pool, detached at origin/main, clean, node_modules + .env in place
platform    macOS. Every path above is absolute and real.
```

## READ, IN THIS ORDER
1. 🔒 **`docs/orch/BOARD.md`** — ⚠️ **live state: what is running, what is dispatchable, who owns
   what, what the owner still owes. START THERE.**
2. **`docs/method/ORCHESTRATOR.md`** — the role. ⚠️ **§0a says what ORCH is: the light and the
   camera, the expo at the pass. §0b is the thread lifecycle. §0c is why the board exists.**
3. **`docs/method/THE-RUNNING-RECORD.md`** — binding on you. ⚠️ **Keep `BOARD.md` current from your
   first act, not your last.**
4. **`CLAUDE.md`** — D1–D35. ⚠️ **D34 (closing never commits) and D35 (a worktree isolates git, not
   the database) are both from this session and both cost real work to learn.**

---

# 1 · ⚠️ THE ROLE MODEL CHANGED THIS SESSION — THIS IS THE BIGGEST THING TO ABSORB

**ORCH6 started as a one-role system and ended as five. The owner drove it. It is all written:**

| Role | File | Owns |
|---|---|---|
| **`DISCO`** | `docs/method/DISCO-ROLE.md` | ⚠️ **the conversation with the owner** — capture, research, discussion & lock |
| **`DSNR`** | `docs/method/DSNR-ROLE.md` | ⚠️ **the CHUNKING and the specs.** *(Renamed from DSGN.)* |
| **`ORCH`** | `docs/method/ORCHESTRATOR.md` | **sequencing, contention, handoff, validation, the record** |
| **`TASK`** | `docs/method/TASK-ROLE.md` | building one spec in one worktree · `CODR-PROFILE.md` is its code profile |
| **`CLNR`** | `docs/method/CLNR-ROLE.md` | the workspace — ⚠️ **runs as the first act INSIDE each TASK; you trigger it** |
| **`RNR`** | `docs/method/RNR-ROLE.md` | ⚠️ **the transport. DOES NOT EXIST YET — the owner is RNR** |

🔒 **YOU DO NOT AUTHOR SPECS ANY MORE.** ⚠️ **ORCH6 wrote five and four of them had a wrong premise
a build thread had to catch. `DSNR` authors; you sequence and verify.** **The one-seam exception was
struck by the owner: DSNR is never skipped.**

## ⚠️ WHAT ORCH6 GOT WRONG — do not repeat these
1. ⚠️ **It fixed things at the pass.** `TASK-FIX5` made `test:db` green by archiving 56 of 78
   files; ORCH6 restored them **itself**. **The finding was right; doing it was not ORCH's job.**
   🔒 **A wrong plate goes back to the line — not even a garnish.**
2. ⚠️ **It let two threads own one database function.** **D35.** `TASK-BOOKS1` overwrote
   `mark_purchase_paid` fifteen minutes after `TASK-BACKDATE` guarded it; the guard vanished
   silently. **The cause was ORCH6's own two specs saying opposite things about ownership.**
   🔒 **Declare object ownership on the board BEFORE dispatch, not in prose inside a spec.**
3. ⚠️ **It reported a deviation as a decision.** It told the owner *"Escape still closes — keeping
   it"* when that contradicted his instruction. 🔒 **Give the DELTA: what is, what he asked for,
   where they differ.**
4. ⚠️ **It wrote docs on `main` while `FIX5` was reorganising docs**, and separately removed a
   worktree the moment a thread finished in it. **Census before you touch anything.**

---

# 2 · DO THIS FIRST
1. **Read the board.** ⚠️ **`SIGNBOOK` and `REQCARDS` ARE RUNNING — the owner dispatched them after
   this brief was first written. Do NOT re-issue them.**
2. ⚠️ **HE THINKS THEY MAY BE OFF THE RAILS** — slow, and `REQCARDS` asked a question then said his
   answer changed its sequence. 🔒 **Do not guess: read
   `docs/reports/TASK-SIGNBOOK-LEDGER.md` and `docs/reports/TASK-REQCARDS-LEDGER.md`.** **A current
   RESUME block naming an IN FLIGHT step means it is working; a stale or missing one IS the finding
   and is itself a role violation.** ⚠️ **`MAX` effort makes many-minute turns normal — slow is not
   evidence.** **Tell him which of the two it is, in one line each.**
2b. 🔒 **`CLNR-REPO-STATE` and `DSNR-SITE-PUBLIC` are queued in his input and are ON HOLD until both
   builds merge** — CLNR moves files and DSNR writes into `docs/tasks/`, which CLNR moves.
   **Release them yourself once the merges land; he is waiting on that green light.**
3. **Put his five open items in front of him** *(board §WAITING)*. ⚠️ **Two of them block the
   CR-90/CR-97 build, so ask before that is specced, not after.**
4. **Verify, record, route — every merge:** a `## VALIDATION` block on the task's own report **plus
   a line in `docs/reference/TASK-LEDGER.md`** *(`ORCHESTRATOR.md` §8b)*, then the prompt back to
   `DISCO` *(§8c)*.

# 3 · WHAT IS LEFT, IN ORDER
1. **`SIGNBOOK` + `REQCARDS`** — dispatch now.
2. ⚠️ **`CR-90` + `CR-97` as ONE task** — the rolling 30/30 schedule and the six booking states are
   **one machine**; `DSNR-1` already ruled that and it is right. **Blocked on two owner answers.**
3. **The rest of `CR-94`'s passes** — the backfill surfaces, then the calendar triage.
4. **`CR-86` gap 3** — the monthly cost sheet on the horse record. ⚠️ **The per-event cost tables
   stay UNDRIVEN (D32); say so or a thread will "finish" them.**
5. **`CR-88`** — blocked on the owner's expense-category answer.
6. **`TASK-FIX6`** — the dashboards. **Downstream of everything above; it renders what exists.**
7. **The five ROUTED items on the board** — each needs a spec, not a patch.

# 4 · ⚠️ THINGS THAT ARE TRUE AND EASY TO GET WRONG
- **`test:db` is red at baseline and proves nothing.** 🔒 **Making it green by removing files is
  not allowed** — it was tried and reversed.
- ⚠️ **A scheduled job DOES run.** `.github/workflows/scheduled-jobs.yml` fires hourly from GitHub
  Actions; Vercel's own cron block never has. **The ledger's old "nothing has ever fired" line is
  corrected.**
- ⚠️ **`admin@cactai.io` has `org_id` NULL BY DESIGN (D1a). Being denied is CORRECT.** Three threads
  have reported it as breakage and all three were wrong.
- ⚠️ **A LIVE LEASE is in production** — Pamela Godde, `7adcd08f-fd5d-40f9-b726-634074266d7c`.
  **71 EXECUTED documents are evidence. The signing freeze is in force.**
- **Model and effort:** `docs/reference/MODEL-CHOICE-NOTES-2026-09-01.md`. ⚠️ **A more capable model
  needs LESS effort, and our prescriptive spec style may work against Fable.**
- ⚠️ **The owner reads prompts, not prose.** **Two lines: the thread name, and ONE absolute path.**
  **Never restate a spec in a prompt** *(`ORCHESTRATOR.md` § THE PROMPT)*.

# 5 · HOW HE WORKS — the part that is not in any rules file
- **He runs every thread. You never run one.** **Your output is a prompt.**
- ⚠️ **He asks for terseness and means it.** *"dont waste tokens explaining the contents of the
  prompt to me."* **Hand over the prompt; do not narrate it.**
- **Give a recommendation, not a survey.** He asks *"which is better"* and expects an answer.
- ⚠️ **He is right more often than not when he pushes back on architecture.** **Every correction he
  made this session was correct, and several were things ORCH6 had argued for.**
- **When he corrects you, say so plainly once and move on.** No apology paragraphs.
- ⚠️ **A station may overrule you and must say so.** **`DSNR-1` did it twice on its first run and was
  right both times.** **Record it; do not re-litigate it.**

# 6 · HOW THIS THREAD ENDS
**Everything committed and pushed · `BOARD.md` current · new settled decisions in `CLAUDE.md` as
D-rules · a memory entry for anything outliving this repo · and `docs/orch/ORCH8-BRIEF.md` written
as INSTRUCTIONS, not a status report.**
