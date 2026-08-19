# HANDOFF → ORCH3

## WHERE YOU ARE — read this before anything else

```
repo          /Users/cactai/Downloads/claude-code-repo/fhe-website-app
branch        main            (clean, pushed)
database      Supabase project lrstswfxfsezdmvkvukc — connection string in .env.db
worktrees     /Users/cactai/Downloads/claude-code-repo/wt-*   (see §8a — one is unmerged)
orchestration /Users/cactai/Downloads/claude-code-repo/orchestration/
platform      macOS. Every path above is absolute and real; nothing is a placeholder.
```

⚠️ **`cd` into the repo first.** A Claude Code session often starts in `/Users/Cactai` or in
`~/Downloads`, **not** in the repo — every relative path in this file and in `ORCHESTRATOR.md`
resolves only from the repo root. **`.env` holds placeholder Supabase keys** (the real ones live in
Vercel), so browser-path testing is impossible locally; **`.env.db` holds the real production
connection string and direct `psql` is how everything gets verified.**

---

**Written by ORCH2 at its own close, 2026-08-18, for the thread that replaces it.**
**This file instructs. It is not a status report.** If you finish reading it and still have to ask
the owner how to operate or what to do first, this file failed and you should fix it rather than
answering in chat.

> ⚠️ **NAME COLLISION — read this first.** `~/Downloads/claude-code-repo/orchestration/orch3.md`
> also calls itself ORCH3. **That is a different lane** — the tracker product build, explicitly
> paused. **It is not you and you must not read it as your instructions.** You are the FHE
> orchestrator. Tell the owner in your first message that the two should be renamed (suggest
> `FHE-ORCH-3` here and `TRACKER-ORCH` there) and let him rule.

---

# 1. WHAT YOU ARE

**You orchestrate. You do not build.** Read `docs/ORCHESTRATOR.md` — that is the role, and it does
not change. This file is what is true right now.

**Three absolutes, restated because breaking any one of them has already cost real work:**

1. **Never spawn a subagent, Agent tool, workflow or task tool to do FHE build work.** You author
   a spec and hand the owner a two-line prompt. He runs every thread. Violated twice before it was
   written down.
2. **Verify before asserting.** Query production, read the actual file. Reasoning from what is
   plausible is how this thread told the owner `OpsDashboard` had no route when it has one (§7).
3. **Never trust a self-reported "done."** Audit every returned report against real state.

---

# 2. THE STATE OF THE APP, IN ONE PARAGRAPH

**The database layer is largely correct and expensive; the surface layer is the broken one.**
Roughly 200 RPCs, RLS, the contract engine, the provisioning spine and the credit arithmetic do
the right thing. **Eight times now, work has been built correctly and left unreachable** — no
route, no nav row, no call site, or a second wrong path built beside the right one. The owner's
experience of the product is therefore much worse than the code deserves, and he cannot tell which
of his complaints are unbuilt features and which are wiring. **They are almost all wiring.**
The evidence is `docs/reports/OWNER-WALKTHROUGH-2026-08-18.md` — read it in full before you act.

---

# 3. THE OWNER'S PLAN — his words, his order, do not reorder it without asking

> **Owner, 2026-08-18:** *"1) Run the last task thread… 2) fully map all of the human flows; staff
> and lead/guest/client/customer/vendor/external 3rd parties (support systems like google maps and
> integrations like stripe included). 3) we will review the items in my list…"*

**And when this thread tried to jump ahead of it:**
> *"hold your horses big guy! we need the things i just requested first. we will run all of the
> task threads in sequence and where possible parallel. your single task thread for the fixes we
> just discussed is a small fraction of whats remaining."*

**Step 1 — `TASK-CLOSEOUT` is written, committed (`22acc2e`), and has never been run.**
`docs/tasks/TASK-CLOSEOUT-fix-everything-found-then-prove-it.md`. It fixes the contract-signing
gates (A2/A3/A4), the horse-documents timing, the deal/contract status coupling and the
notification log, then retests. **Hand the owner its prompt as your first act.**

```
CLOSEOUT

Read docs/tasks/TASK-CLOSEOUT-fix-everything-found-then-prove-it.md and build it.
```
**Opus 5 · thinking ON · effort HIGH** — it changes signing behaviour on executed-document
infrastructure.

**Step 2 — the flow map.** Not written. Every human and system actor, end to end: staff · lead ·
guest · client · customer · vendor · external third parties · **plus Stripe, Google Maps, mail and
Vercel cron as actors in their own right.** Note that §5 below inserts one cheap thing *inside*
this step rather than before it.

**Step 3 — the owner's own list.** **He has not supplied it yet. Ask for it; do not invent it.**

---

# 4. THE REFACTOR ANSWER — this thread's recommendation, unwritten anywhere else until now

The owner asked, and this is the judgement ORCH2 formed and is handing over rather than losing:

> *"You tell me what we can do to refactor this entire heap of hot garbage so that it has the
> areas, features, functions, and a very clean sexy modern looking UI."*

**Do not rewrite.** The correct and expensive layer is the database. A rewrite discards the good
half to fix the bad half and re-learns every lesson in `orchestration/lessons/LESSONS.md`.

**The missing artifact is a specification of the app itself.** Not flows (what must happen) —
**surfaces**: every area, page, entity, action, state, and who can reach it. **No task ever
produced one**, because every task specified a write path and proved that write path. That is
precisely why there is almost no CRUD in Records: no task was ever *"make Records work."*

**Three moves, in order:**

**(a) A reachability + CRUD audit.** Mechanical, cheap, one thread. For every route: is it in
`pageRegistry.ts`? which nav group? which of create/read/update/delete/archive exist? which
actions fire with no confirmation, reason, reference or undo? which surfaces read a ledger that is
being written? **It would have caught all eight instances in §2.** Its output is the inventory the
project has never had. **This belongs inside the owner's step 2, running alongside the flow map —
the flows say what must happen, the audit says where it currently cannot.**

**(b) One page rebuilt to a standard, and the standard falls out of it.** Use
`LessonCreditsPage.tsx` — it is the worst surface in the app and the most contained. Every action
gets a modal that states what will happen, a reason, a reference to the lesson or purchase it
touches, and an undo; grants either attach to a package or say plainly that they do not. **That
page then defines what a table, an action, an empty state, an error and a confirmation look like
everywhere else** — which is the only way "clean sexy modern" becomes a repeatable thing rather
than a per-page opinion.

**(c) Then area by area, Records first**, against that standard — never page by page in isolation,
which is how the app got here.

**One fix does not wait for any of this:** the orphan credit that never expires (`W8`) is
corrupting the ledger every time it is used.

---

# 5. WHAT TO DO, IN ORDER, ON YOUR FIRST DAY

1. **Read** `docs/reports/OWNER-WALKTHROUGH-2026-08-18.md`, then `docs/OPEN-ITEMS-2026-08-18.md`.
2. **Flag the ORCH3 name collision** (top of this file) and get a ruling.
3. **Hand over the `CLOSEOUT` prompt** (§3). It is ready; nothing blocks it.
4. **Ask for the owner's list** (his step 3). It is the only input you cannot derive.
5. **Resolve `task/partyrole`** (§8a) — 10 commits of owner-directed brand, header, footer and SEO
   work are unmerged and would be destroyed by a naive worktree cleanup.
6. **Hand over `ONETEAM`** — `docs/tasks/TASK-ONETEAM-there-is-one-roster-and-it-is-team.md`.
   Written 2026-08-18, never run. Small, bounded, and it closes an owner ruling a previous thread
   skipped on a stale premise. **Sonnet 5 · thinking ON · effort MEDIUM.** It can run in parallel
   with CLOSEOUT — no file overlap.
7. **Write the reachability + CRUD audit spec** while CLOSEOUT runs. It is read-only, touches no
   file any thread owns, and can run fully in parallel. **Sonnet · thinking ON · effort MEDIUM** —
   it is breadth with the traps already written out, not judgement.
8. **Do not start the UI rebuild until the audit has returned.** Rebuilding pages before knowing
   which pages exist is the same mistake at a larger scale.

---

# 6. LOAD-BEARING RULES YOU MUST NOT REDISCOVER

**Never `~/Desktop`** — iCloud sync destroyed a repo there. Worktrees live at
`~/Downloads/claude-code-repo/wt-<id>`.

**A push to `main` auto-deploys and IS a release.**

**THE SIGNING FREEZE IS IN FORCE** until the owner lifts it.

**Templates are NEVER deleted — hard or soft.** Owner, 2026-08-17: *"dont delete templates."* This
thread soft-deleted four retired `contract_templates` during the purge and had to restore them
from a 44MB backup with their original `deleted_at` timestamps. **Standing rule now.**

**Executed documents are evidence.** 61 of them. Never rewritten, never deletable from the UI.

**D1a — the platform owner is not a tenant.** `admin@cactai.io` has `org_id` NULL **by design**.
Being refused by tenant-gated functions is CORRECT. Three threads reported it as a bug; all three
were wrong.

**`test:db` is broken — 46 red files is the documented baseline, not a regression.** Nothing may
cite it as proof. Verify against production with direct SQL.

**Code commits need a worktree.** The pre-commit hook blocks code commits outside one unless
`FHE_ALLOW_CODE=1`. **Edit code in the worktree from the start, not just at commit time.**

**Stage explicit paths, never `git add docs/`.** This thread swept another thread's in-flight files
into two of its own commits that way (`bdbeb1b`, `44aa0a7`). Content survived; attribution did not.

**Check for a live thread before touching anything yourself.** This thread fixed the timezone while
a `TENANTTZ` thread was working on it and cost that thread ~1000 verified lines.

**Resource hygiene.** Every spec carries a TEARDOWN clause; run a process census each session;
cap vitest workers.

**Empty is not a finding.** Pre-launch counts are the expected state.

**Improve what exists; never build a second implementation alongside it.** This project's defining
failure — 3 horse rosters, 3 lead lists, 2 staff landing pages, 4 identical lease templates. **§2's
instance #8 is the newest one and it is a fresh occurrence, not history.**

---

# 7. WHERE THIS THREAD WAS WRONG — so you neither repeat it nor inherit it

Recorded because a handoff that only carries conclusions hands over the errors as facts.

| the claim | the truth |
|---|---|
| *"`OpsDashboard` was built and never wired"* | It is routed at `/app/ops` via `OpsHome`. **The defect is the missing nav row**, which is a smaller and different fix. |
| *"`horses` has no lease relationship"* (ASKRIGHT §A3e) | It carries `lessee_contact_id`, `lessee_name_text`, `lease_start`, `lease_end`, `sublease_allowed`. The finding was withdrawn and a phantom wave-2 task deleted. |
| *"prove `anon` has no INSERT on `purchases`"* | Anon holds INSERT/UPDATE/DELETE via the repo-wide default grant. **RLS is the denial**, not the grant. |
| *"a party not required to sign the policies is prohibited from signing them"* | Owner: *"so we can apply a document or set to them but we dont have a requirement to do so."* **The rule is discretion.** A whitelist was built and withdrawn. |
| *"CAREPLANS §5c2: ZERO credit rows"* | One allotment row (total = N, remaining = 0) is correct — it is the cap `_refund_booking_credit` restores into. The thread corrected this thread. |
| *"the calendar is parked in the temporary Review menu"* | **It has a permanent nav row** — `AppLayout.tsx:415/1085/1130`, restored by `ab45b18`. The claim came from a **stale comment** at `pageRegistry.ts:125`. `/app/ops` is the one genuinely stranded surface, and it is worse than stated: **URL-only**, because the Review group was deleted on 2026-08-15 and it had no permanent home to return to. |
| *"nothing has been opened in a browser"* | Owner: *"everything has been opened in a browser."* Corrected in `OPEN-ITEMS` §3. |

**Threads have corrected this thread more often than the reverse. When one does, say so plainly
and move on.**

---

# 8. WHAT IS OPEN

- **`docs/OPEN-ITEMS-2026-08-18.md`** is the register. It now carries the 14 pre-existing confirmed
  bugs plus **W1–W13** from the walkthrough, 8 open owner decisions, the integration gaps, 11 live
  unrun task docs, and the 535-item `DECIDE.md` sheet awaiting the owner's keep/remove pass.
- **`main` is `5c5f9ee`**, clean. Production was purged of test data on 2026-08-17 — paper trail in
  `docs/PROD-TEST-DATA-PURGE-2026-08-17.md`. Two backups in `~/Downloads/claude-code-repo/backups/`.
- **No live threads.** But **nine worktrees still exist**, and one of them holds unmerged work.

## ⚠️ 8a. `task/partyrole` HOLDS 10 UNMERGED COMMITS — do not remove that worktree

**`~/Downloads/claude-code-repo/wt-partyrole`, branch `task/partyrole`, head `b542009`.**
`git merge-base --is-ancestor task/partyrole main` **fails** — it is NOT on main.

**Despite the branch name, this is not PARTYROLE work** (that merged as `e237033`). The worktree
was reused for a website copy/brand session, and it carries owner-directed work that exists
nowhere else:

```
b542009  merge origin/main into task/partyrole
a845c57  story: nudge the 'What we deliver' link up 5px
b7e1d0b  header: the nav fits before it is shown, and the cart earns its room
e4e3dd8  seo: the tagline is what a shared link says
fb05d20  footer + seo: 'support for purchasing and leasing'
44e9adc  copy: keep the live tagline, and 'classical' not 'classic'
720ff9c  copy: one sentence in three places — footer, tagline, business description
17b9548  brand + seo: the owner's new tagline and business description
3dee9aa  footer: drop the leading 'A', make it full-service
f799d10  footer: owner's new description copy
f1cb01e  footer: full postal address in Find Us; copyright left, Cactai mark right
```
**10 files, +260/−74** — `Seo.tsx`, `Footer.tsx`, `Header.tsx`, `brand.ts`, `seo.ts`,
`BookHorse/BookRider/BookSupport.tsx`, `Landing.tsx`, `Story.tsx`.

**Your first housekeeping act: audit and merge it, or ask the owner whether to.** It is a code
merge to `main`, so it auto-deploys and IS a release — that is why ORCH2 did not do it unasked.
**Do not `git worktree remove` anything until this is resolved.**

**The other eight worktrees are all merged and clean** (`wt-askright` has one uncommitted modified
file, `docs/reports/TASK-ASKRIGHT-REPORT.md` — inspect before discarding). Per `ORCHESTRATOR.md`
§6, archive-tag then remove each once verified.

⚠️ **The convention that "a worktree's presence means the thread is live" has been false for a
week.** Do not infer liveness from the directory listing; check `git merge-base` and `git status`.

---

# 9. READING LIST — in this order, and nothing else is required

1. `docs/ORCHESTRATOR.md` — the role.
2. **`docs/reports/OWNER-WALKTHROUGH-2026-08-18.md`** — what is actually wrong, with proof.
3. `docs/OPEN-ITEMS-2026-08-18.md` — the full register.
4. `CLAUDE.md` — the live spine and the settled D-decisions.
5. `~/Downloads/claude-code-repo/orchestration/lessons/LESSONS.md` — the compounding failure table.
6. `docs/tasks/TASK-CLOSEOUT-fix-everything-found-then-prove-it.md` — the one thing ready to run.

**Do not read `docs/ORCHESTRATOR-HANDOFF.md`** (superseded 2026-08-12) or the older
`SESSION-STATUS-*.md` files. They are history.

---

# 10. THE PROMPT THAT SPAWNS YOU

```
FHE-ORCH-3

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/HANDOFF-ORCH3.md, then docs/ORCHESTRATOR.md, and take over.
```

**Opus 5 · thinking ON · effort HIGH.**

⚠️ **The `cd` line is not optional and was missing from the first draft of this file.** A fresh
Claude Code session does not know which repo it serves — the prompt has to locate itself. **Any
spawn prompt whose first file path is relative is broken**, and that includes every task prompt
(§5 of `ORCHESTRATOR.md`, now corrected).
