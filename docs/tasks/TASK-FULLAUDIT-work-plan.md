# TASK-FULLAUDIT — work plan (FOR OWNER REVIEW & APPROVAL)

**Status: AWAITING APPROVAL. No audit analysis begins until the owner signs off (owner ruling).**
Companion files: `TASK-FULLAUDIT-mission-and-requirements.md` (the verbatim directive),
`TASK-FULLAUDIT-worktree-report.md` (worktree rulings). The handoff prompt is at the bottom of
this file.

---

## 0. What this is
A full-depth, UI-downward audit of the entire application for defects, omissions, mis-wirings,
missing CRUD / edit / multi-select, orphaned pages, non-functional buttons/links/tips,
non-centralized/hardcoded resources, and clean-code violations — **presented as FINDINGS for the
owner to triage. No application code is changed by the audit** (the only code touched this
session was the calendar bug fixes, done before this rule was set). The audit runs in a FRESH
thread from the handoff below.

## 1. Method (non-negotiable, from the directive)
- **UI → code, to the fullest depth.** Start from what a user sees on a page, then follow it down
  through components → hooks → API client → RPC → table/RLS as far as it goes. Not a grep pass,
  not a fixed-depth review. Several passes over the same files are expected.
- **Cross-page comparison.** When something is missing or mis-wired on one page, check every
  similar page for the same gap, and evaluate what ELSE should come with the fix (an edit button
  implies a working edit path; a delete button implies a working delete; a list implies
  multi-select where the work is bulk).
- **Rooted in real usage.** Every finding is tied to a user need and the app's purpose, not to an
  abstract ideal. "This button does nothing" must say what it SHOULD do and for whom.
- **Rules yield to best practice.** Where a repo rule / prior decision conflicts with best
  practice, industry norms, user expectation, or plain necessity, the finding is authored to
  BEST PRACTICE and NOTES the rule, so the owner can decide whether the rule or the finding
  changes. (Rules are inputs, not walls.)
- **Connectivity analysis.** Findings are related to each other — a root cause behind several
  symptoms is named once and linked, not filed five times. The body clip → nested-scroller
  finding (calendar) is the model: one cause, many potential victims.
- **Centralization analysis.** Hardcoded things that should be centralized/standardized
  (copy, colors, spacing, status vocabularies, money/date formatting, option lists, config,
  layout primitives) are findings in their own right, with the central home they belong in.

## 2. Priority order (owner: staff/ops first)
1. **Staff / ops surfaces** — the daily drivers, most-reported gaps:
   Calendar · Lessons (hub, plans, packages, credits, sessions) · Records (clients, leads,
   directory, horses, person record, audit) · Orders · Payments · Payment review · Contracts
   (authoring, send, sign, deal set) · Dashboard (KPIs, ATN grid, zones) · Team · Admin
   (products/catalog editor, templates, page visibility, modules) · Tasks.
2. **Member-facing** — onboarding / signing wall · booking & requests · My Lessons · My Orders ·
   My Payments · My Stable · account & profile · community feed.
3. **Public / marketing** — landing, lessons/services pages, sign-up, inquiry, `/sign/*`.

Within each tier, walk the nav/router in order so coverage is even and resumable.

## 3. The pass structure (per surface)
For each page/surface, produce a record with:
- **Reach** — its route, whether it's in nav/registry, whether that's the only way in, and any
  orphan (routed-but-unlinked) or dead-redirect (like `/app/records/lessons`) status.
- **Inventory** — every interactive element (button, link, menu, tip, field, table, filter,
  bulk action) and whether each is WIRED, PARTIALLY wired, or DEAD.
- **CRUD completeness** — for each entity the page manages: can you create, read, update
  (with a real edit path, not just a button), delete (with a real delete, not just a button),
  and multi-select where bulk is the natural operation?
- **Data source** — which table/RPC backs it, and whether siblings showing the same data use a
  DIFFERENT source (the "two ledgers for one fact" class).
- **Centralization** — hardcoded values that belong in a shared token/config/component.
- **Clean code** — dead/commented-out code, stale evolution notes, comments documenting history
  no one needs (per the owner's clean-code rule and memory `fhe-clean-code-no-evolution-comments`).
- **Findings** — each with: severity (blocker / major / minor / hygiene), the user impact, the
  connectivity (what else it relates to), and — where a rule is in the way — the rule noted.

## 4. Deliverable
`docs/reports/TASK-FULLAUDIT-REPORT.md` — the findings report, organized by surface within the
priority tiers, with:
- an executive summary (counts by severity, the top cross-cutting root causes),
- the connectivity map (root causes → the surfaces they touch),
- the centralization ledger (hardcoded-thing → proposed central home),
- per-surface findings as above,
- an explicit **coverage checklist** proving every routed surface was visited (measured against
  the success statement — see §6).
Nothing is auto-fixed. Each finding is written so the owner can approve/modify/decline it, and a
later remediation task can act on it directly.

## 5. Seed findings already identified (carry into the report)
- **F0 — unmerged anon-revoke hardening.** `task/grants-b` cut anon-executable functions 326→134;
  main still has 211 anon-executable public functions. Re-derive the safe revoke set against
  today's schema. (From the worktree report.)
- **F-calendar-clip — body `overflow-x: clip` vs nested scrollers.** The page-fit guard clips
  descendant horizontal scrollers on iOS; audit every `overflow-x` region for the same victimhood.
- **F-lessons-deadroute — `/app/records/lessons` is a dead redirect target** (a 404): the whole
  lessons system redirects there and is unreachable; the built loop (plans → lesson → progress →
  roll-forward) works but nothing links to it, and Claire's dashboard "Notes loop" points at it.
- **F-activity-vocab — `activity_checklists`** seed data (Warm-up/Gymnastics/Course/Cool-down)
  does not match the owner's program terminology and all 31 rows are `active`; trainers see labels
  they don't use. (Owner flagged during B4.)

## 6. Success statement — WHEN it is written
Per the owner: **the success statement is the FIRST task AFTER plan approval**, written by the
fresh thread. It defines, concretely and measurably, what "done" is for this audit (coverage,
depth evidence, finding quality bar, the connectivity + centralization deliverables) so the final
report can be measured against it and nothing is skipped. It is NOT written now — approval first.

## 7. What THIS thread did and did NOT do
- DID: fixed the calendar bugs (week swipe + empty new-item modal, commits 517db211, a9ad6ee3);
  wrote the verbatim capture; wrote the worktree report + rulings; wrote this plan; wrote the
  handoff prompt (below).
- DID NOT: begin the audit, write the success statement, prune any worktree, or change any other
  application code. Those wait on approval and the fresh thread.

---

## 8. HANDOFF PROMPT (for the fresh thread that runs the audit)

> You are running **TASK-FULLAUDIT**, a full-depth, UI-downward defect & completeness audit of the
> entire FHE application. **Read these first, in order:**
> 1. `docs/tasks/TASK-FULLAUDIT-mission-and-requirements.md` — the owner's directive VERBATIM and
>    the run decisions (findings-only; staff/ops first; block on plan approval).
> 2. `docs/tasks/TASK-FULLAUDIT-work-plan.md` — the approved plan (this file). Follow §1 method,
>    §2 priority, §3 pass structure, §4 deliverable.
> 3. `docs/tasks/TASK-FULLAUDIT-worktree-report.md` — worktree rulings + seed finding F0.
> 4. `CLAUDE.md` and the memory index — the D-rules and prior decisions. Treat rules as inputs:
>    where one conflicts with best practice, author the finding to best practice and NOTE the rule.
>
> **Your FIRST act:** write `docs/reports/TASK-FULLAUDIT-SUCCESS.md` — the concrete, measurable
> definition of what a complete audit looks like (coverage of every routed surface, evidence of
> UI→code depth, the finding-quality bar, and the connectivity + centralization deliverables). You
> will measure your final report against it. Then confirm the plan is approved (the owner gates
> this) before deep analysis.
>
> **Then run the audit** into `docs/reports/TASK-FULLAUDIT-REPORT.md`, staff/ops surfaces first,
> walking the nav/router in order, per §3. **Change no application code** — this is findings only;
> each finding carries severity, user impact, connectivity, data source, and any rule-in-the-way
> note. Carry the §5 seed findings in. It is fine to take many passes over the same files.
>
> **Rules of the environment:** no subagent delegation (CLAUDE.md); DB is live prod (conn = line 1
> of `.env.db`), and since this is findings-only you only READ it; commit the report as you go so
> progress survives; `npm run typecheck` and `npm run lint` are the health checks. When context
> runs low, write a continuation note at the top of the report (what's covered, what's next) so the
> next thread resumes cleanly — this audit is expected to span multiple threads.
>
> **Model/effort suggestion for this task:** Opus, HIGH effort, thinking ON — it is deep,
> cross-referential reading-and-judgment work, exactly what that tier is for. (The spawning thread
> decides tier per D45; this is a recommendation.)
