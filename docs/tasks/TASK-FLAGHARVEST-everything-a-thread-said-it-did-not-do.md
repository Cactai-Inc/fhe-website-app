# TASK FLAGHARVEST — every item a thread flagged, reported, or deliberately left alone

**Owner, 2026-08-12:**

> *"help me work through the things the threads declared they didnt touch, didnt do, didnt
> resolve, stated are worth a closer look, surfaced to bring to my attention, etc… almost every
> thread we've run together in the last 7 days has some of these type of notes, at this point
> there might be answers in them that we can act on instead of reinvestigating or
> relitigating."*

**103 reports exist in `docs/reports/`. 63 of them contain flagged, unresolved or
deliberately-unfixed items.** Nobody has ever read them as a set.

**THIS TASK CHANGES NO CODE.** `git diff` must show `docs/` only. The output is the document the
owner rules from.

---

# ⚠️ THE CONSTRAINT THAT SHAPES EVERYTHING — read this twice

**Owner, explicitly:** *"do not do any type of elimination based on decisions made prior, we will
review the decision set before that is done, but the list deserves to be viewed after its been
reconciled against itself and later work."*

**So:**

- **DO reconcile against ITSELF** — the same finding appears in several reports; collapse those.
- **DO reconcile against LATER WORK** — a thread that later fixed the thing, a migration that
  landed, a merge that closed it. **This is factual: did the code change or not.**
- **DO NOT eliminate anything because a DECISION (D1–D15) appears to settle it.** The owner is
  reviewing the decision set separately and expects some of them to need amending. **A decision
  is not evidence that work was done.**

**Where a decision seems to bear on an item, NOTE IT — do not act on it.** Add a column that
says *"D14 may bear on this"* and leave the item in the list. **The eliminating pass comes
later, and it is his.**

---

# ALSO HARVEST: things that exist and have NEVER BEEN SEEN

**Owner, same conversation:**

> *"anything else that i havent known about until it gets surfaced from our work here needs to be
> reviewed because its highly likely there is a golden egg waiting to be used and in particular
> things like email templates and pages/UI elements. the things built as replacements were shoddy
> at best… when a better version might have already existed in the original."*

**An artifact the owner has never seen is not dead code — it is unreviewed inventory.**

**Collect, as its own section:** every component, page, route, template, email body or copy
string that reports have described as unreachable, unused, dead, orphaned, retired-behind-a-
boolean, or "no callers."

**For each: PASTE ENOUGH OF THE ACTUAL CONTENT THAT HE CAN JUDGE IT.** A description cannot be
judged. **He is the only one who can tell a stub from a golden egg** — the orchestrator
recommended deleting three unviewed email templates and was corrected, and it cost one command
to find out they were stubs.

**Recommend nothing for deletion in this section.** Show it; he rules.

---

# WHAT TO EXTRACT

Reports use different headings for the same thing. **Sweep for all of these and any near
variant:**

```
"Flagged, not fixed"          "Reported, not fixed"        "did not fix"
"left alone"                  "worth a closer look"        "for the owner"
"owner ruling needed"         "NOT VERIFIED"               "out of scope"
"I did not"                   "not built"                  "found and NOT fixed"
"deviation"                   "correction"                 "reported rather than changed"
```

## Per item, record

| field | content |
|---|---|
| **Item** | one sentence, in plain language |
| **Source** | report file + the thread that raised it |
| **Raised** | date |
| **Status** | see below |
| **Evidence** | what you checked to assign that status |
| **Decision that may bear on it** | D-number, **noted only, never applied** |
| **Recommendation** | what you would do — **not what you did** |

## Status — factual only, four values

- **CLOSED BY LATER WORK** — a later thread or migration demonstrably fixed it. **Name the
  commit or the migration.** Not "probably fixed."
- **STILL OPEN** — no later work touched it.
- **SUPERSEDED BY EVENTS** — the thing it concerned no longer exists (file deleted, table
  retired, page removed). **Show it is gone.**
- **CANNOT DETERMINE** — say so. **This is an acceptable answer and is better than a guess.**

**Verify against the CURRENT code and the CURRENT database.** A report from 2026-08-06 describes
a world seven days gone.

---

# ORDER THE OUTPUT BY WHAT IT COSTS HIM

Not by date, not by report. **Rank:**

1. **Live defects still open** — something is wrong in production right now.
2. **Security and data-integrity items.**
3. **Things blocking work** — a decision he owes, a gate nobody can pass.
4. **Unviewed inventory** — the golden-egg section.
5. **Correctness and consistency.**
6. **Cosmetic and cleanup.**

**Deduplicate hard.** The NULL-guard family, the duplicate-surface family and the
`test:db`-is-broken note appear across many reports. **One entry each, listing every report that
raised it.** A list of 200 items nobody reads is a worse outcome than 60 that are true.

**Say how many raw items you found before dedup and how many survived.**

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-flagharvest`, branch `task/flagharvest`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **CHANGE NO CODE.** `git diff` shows `docs/` only. **This is the whole discipline of the
  task** — the temptation to fix a one-line thing you find is exactly what must be resisted, so
  that the owner sees the true shape of what is outstanding.
- **Do not delete or recommend deleting anything in the unviewed-inventory section.**
- **Read production for every status you assign.** `.env.db` line 1. A direct psql connection has
  NULL auth, so org-scoped RPCs legitimately return 0 rows — **know the difference between
  "returns nothing because unauthenticated" and "returns nothing because broken."** Three threads
  have made that mistake.
- **`test:db` is broken** — 203 failures remain after TESTDB. **Do not cite it as proof.**
- **Be exhaustive rather than tidy.** If you cannot finish all 63, **say exactly which reports
  you did not reach.** Implying coverage you do not have is worse than an honest gap.

# THE TEST THIS MUST PASS

1. All **63** reports with flagged sections are read, or the unreached ones are named.
2. Every item carries a status backed by **evidence**, not inference.
3. **Nothing was eliminated because a decision appeared to settle it** — decisions are noted in
   their own column and nothing else.
4. The unviewed-inventory section **shows actual content**, not descriptions, and recommends no
   deletions.
5. Duplicates are collapsed; raw and deduped counts are both stated.
6. Ranked by cost to the owner, and the ranking is explained.
7. **`git diff` shows `docs/` only.**

Report to `docs/reports/TASK-FLAGHARVEST-REPORT.md`.
