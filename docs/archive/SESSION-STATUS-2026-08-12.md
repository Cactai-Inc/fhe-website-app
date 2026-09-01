# SESSION STATUS — 2026-08-12

**Written for a compaction.** Supersedes `SESSION-STATUS-2026-08-11.md`.
`main` = `7d63f95`, clean, everything pushed.

---

# 1. READ THESE THREE FIRST

- **`docs/archive/PLAN-OF-ATTACK-2026-08-12.md`** — all 24 unresolved items, ordered, plus six small
  rulings. **The single source for what is left.**
- **`CLAUDE.md`** — settled decisions D1–D13. **D12** (two template engines), **D13** (the owner
  must be able to change it without a developer) are today's and they govern everything ahead.
- **`docs/reports/TASK-DUPECENSUS-REPORT.md`** — 21 duplicate groups, ranked by damage, with the
  Review walkthrough at the end.

---

# 2. RUNNING

| thread | state |
|---|---|
| **TEXTEDIT** | started, no commits yet |
| **PAGEVIS** | started |

**Everything else is merged and closed.** Today merged: LEADCLEAN · FRAMESCROLL · ADDITEM ·
ADDNEW · REVIEWNAV · DUPECENSUS · TOKENAUDIT, plus the `<main>` overflow backstop and two nav
fixes applied directly.

---

# 3. SPECS WRITTEN, NOT RUN

`TESTDB` · `COUNTFIX` · `BOOKWRITE` · `RECORDS` · `HORSEONE` (held) · `TOKENAUDIT` (done)

**`HORSEONE` is HELD** until the owner walks the Review section — running it would destroy the
A/B/C it exists to inform.

**`ONEPEOPLE` is RETIRED** — superseded by `RECORDS`.

---

# 4. BLOCKED ON THE OWNER

1. **Can structure be authored while a contract is `in_review`?** Both live leases are
   `in_review`, so **Add Item cannot be used on either** — the feature ADDITEM just repaired is
   unreachable until this is ruled.
2. **Walk the Review section**, rule on the 21 duplicate groups. Gates every consolidation.
3. Delete the two Beaumont documents from the integrity panel.
4. Supabase custom domain / TLS.

---

# 5. THE OWNER'S BROADER QUEUE — recorded 2026-08-12, beyond this repo

## ⚠️ THE FINISH LINE IS NOT THE WEBSITE — owner correction, 2026-08-12

> *"the website doesnt matter until ive sent contracts and invites and i cant do that until we
> finalize the app pages, wiring, features, functions, fields, taxonomy, flows, routing, db, and
> validated everything by your hand and mine."*

**The order is: app finished and VALIDATED → contracts and invites go out → then the website.**
An earlier version of this doc had the website as the immediate finish line. **It is last.**

**Two consequences that change what to work on:**

- **Validation is impossible while duplicates exist.** "Does this page work" has no answer while
  three horse rosters, two staff landing pages and five person-list surfaces are all live and
  the owner does not know which one he is judging. **Walking the Review section (§4 item 2) is a
  PRECONDITION for validation, not a tidy-up.**
- **"Validated by your hand" requires a working test suite.** 60 of 68 DB test files fail and
  601 of 688 tests never run, so every claim is currently hand-verified with `psql`. **TESTDB is
  on the critical path, not in the debt pile.**

**Website — LAST, after contracts and invites are out:**
new images · new copy · revised flow · inbound-pathway review · mobile tweaks.

**Then:** chrome extension → its promo site / SEO → personal website → cactai website → back to
the platform while the extension is in review.

**Alongside:** job applications · podcast / livestream content · a review of his SOPs, habits and
tooling.

## The task tool he wants built

A web tool that **he and Claude both edit in real time**, so nothing is lost between the moment
he thinks of something and the moment it is actionable.

- Repo-backed entries; **Supabase for storage** so it works from any device and can be monetised.
  Local-first for setup/testing is acceptable **only if** the Supabase move is later a no-op —
  otherwise build it on Supabase from the start.
- **Capture from anywhere he talks to Claude** → markdown → Google Drive → a sweep job into the
  repo, **or** written directly to the repo. Which depends on what each Claude surface can
  actually write to, and that is unestablished.
- Claude can **see, author, edit and remove** entries, and **append notes by reference** — most
  items apply to more than one to-do.
- **The point:** he hands things over when they are top of mind (rarely when they are actionable)
  and Claude surfaces them when they are relevant. Ultimately Claude plans his days, manages the
  tasks, records the ideas, and surfaces the memory.

**Open question he raised, unanswered:** he saw something in VS Code settings suggesting a
**GitHub-subscription passthrough** for Claude access — a TOS-acceptable, non-API route. **This
was NOT verified.** It matters because API-only pricing does not support the products he intends.
**Do not speculate about it — check it properly.**

---

# 6. WHAT TODAY'S BUDGET ACTUALLY BUYS

**~20% of the weekly allowance, ~12 hours.** That is **four to six substantial threads**, not
twenty-four. The 24-item plan is weeks of work.

**Therefore: do not start the plan at item 5 and grind.** Spend it where the finish line is.

---

# 7. STANDING RULES THAT GOVERN EVERY SPEC

- **D13** — a feature is not done if changing it needs a thread, SQL, or git.
- **The tool fits the architecture, not the reverse.** No unified templates table; editors over
  the tables that exist.
- **Improve what exists; never build a second implementation alongside it.**
  (`ORCHESTRATOR-HANDOFF.md` — the day's five-duplicate table.)
- **Empty is not a finding.** Pre-launch counts are the expected state.
- **Threads do not push.** The orchestrator merges.
- **`test:db` is broken — 60 of 68 files fail, 601 of 688 tests never run.** Nothing may cite it
  as proof; verify against production.
- **THE SIGNING FREEZE IS IN FORCE.** 61 EXECUTED documents are evidence and are never rewritten.
- **Never `~/Desktop`.**

---

# 8. THE MACHINE

VS Code was at 7 GB; `.vscode/settings.json` (gitignored) now excludes `node_modules` and build
output from the watcher and search index — **down to 0.60 GB**.

**But `vm.swapusage` shows 30.3 GB of 31.7 GB consumed.** That is the sluggishness and a reboot
is the only fix. `fseventsd` at 0.76 GB is the largest process on the machine — Spotlight and
fseventsd still index all 19,393 `node_modules` files. **Adding the repo to Spotlight Privacy is
the durable fix.**

---

# ⚠️ SUPERSEDED 2026-08-12 — THE HANDOFF IS NOW A BATON

State no longer lives here. The respawn document is:

`~/Downloads/claude-code-repo/orchestration/batons/active/FHE-PLAN.md`

The ROLE is `orchestration/charters/L3-PLAN.md`. This file is retained for its FHE-specific
content, which is still accurate.
