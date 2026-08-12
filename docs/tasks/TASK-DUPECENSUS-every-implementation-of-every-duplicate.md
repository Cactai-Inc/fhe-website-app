# TASK DUPECENSUS — find every duplicate, show every implementation, recommend nothing that deletes

**Owner, 2026-08-11:**

> *"what is the unification strategy for them? Id liked to see every single implementation of
> every duplicate made to decide which to build from. Often the UI is nice in the original and
> the hack ass replacement is shoddy and worth shit, this entire build has been plagued by
> fucked up UI and shoddy wiring, the direct result of hacked together replacement pages when a
> very nice but under built page needed a few new features."*

**THIS TASK BUILDS NOTHING. It produces the document the owner rules from.**

Do not consolidate, delete, retire, rename or "clean up" anything. **Not one line of `src/`
changes.** The output is a report. If you find yourself editing a component, you have
misunderstood the task.

---

# WHY THIS EXISTS

Six duplications are already known, and each cost more to reconcile than modifying the original
would have:

| concept | implementations | status |
|---|---|---|
| horse roster | **3** | `TASK-HORSEONE` specced, not run |
| lead list | **3** | `TASK-LEADCLEAN` running |
| staff landing page | **2** | ADMINSWEEP assessed both; owner deciding |
| document renderer | **2** | `TASK-ONEAUTHOR` converged them |
| lease template | **4** identical clones | `TASK-LEASESET` resolved |
| catalog | 2 hardcoded shadows | deleted 2026-07 |

**The owner's diagnosis is that the replacement is usually the worse one.** The record supports
it: `HorsesPage` (2026-07-01) was superseded nine days later by a page at a second URL, and the
original decayed to zero references and resurfaced two months later as a mystery.

**So the census must be able to tell "nice but under-built" from "hacked together", and it must
show its evidence.** A list of duplicates with no quality signal is useless to the owner —
he already knows they exist.

---

# SCOPE — the whole app

`116` routes · `106` page files · `95` components. Sweep all of it.

## What counts as a duplicate

**Two or more implementations of one concept**, where a user or a developer could reasonably
ask "which of these is the real one?" Look for it in four layers, because it hides in all four:

1. **Routes** — different URLs rendering the same concept.
2. **Pages / components** — different files doing the same job (a roster, a picker, a table, a
   modal, a form for one entity).
3. **Data layer** — different functions reading the same table for the same purpose.
   `listHorses()` vs `staff_horse_records()` vs `listRecordHorses()` is one concept and three
   readers, and **they can disagree**, which is how surfaces end up contradicting each other.
4. **Definitions of one number** — the sharpest case, and the most damaging. `OpsDashboard`
   says intake is **12**; `DashboardPanel` says **7**. Same word, two definitions, two screens.
   **Hunt these deliberately** — every count, badge and total in the app.

**Not duplicates, do not list them as such:** module pages that are dark because the tenant
lacks the module; a member-facing and a staff-facing view of one entity that genuinely differ
in permission and purpose; generic shared primitives (`DataTable`, `Modal`) used many times.

---

# WHAT EACH ENTRY MUST CONTAIN

One section per duplicated concept. Inside it, **one block per implementation** — every one, no
summarising away the third:

- **File path and line count.**
- **Route, as a URL the owner can type.** If unreachable, say so plainly and say why (no nav
  entry / module-gated / zero references / redirects elsewhere).
- **Created:** first commit — short SHA, date, and its message. **This is how "original" vs
  "replacement" gets established**, and the owner has asked for it specifically.
- **Reachability today:** in the nav (which group), linked from elsewhere, or URL-only.
- **What it reads** — the exact query/RPC — and **whether the implementations agree.** If two
  read the same table with different filters, **run both against production and state both
  counts.** A disagreement is the finding.
- **What it can do** that the others cannot. Be specific — this is what must not be lost.

## The quality assessment — the part the owner actually wants

**You cannot see these pages and you will not be given a browser.** Do not describe how
something looks. **Assess it from the code against markers that are readable and that correlate
with the difference the owner is describing:**

| marker | why it separates "nice" from "hacked" |
|---|---|
| Uses `PageLayout` / `PageHeader` | **Only 9 of 80 pages do.** The shared frame is the app's own answer to inconsistent headers, widths and control placement. |
| Has empty / loading / error branches | A page that blanks on failure or renders an empty frame was not finished. |
| Responsive treatment | Fixed widths and desktop-only assumptions are the hallmark of a rush. |
| Accessible names, labels, focus handling | Cheap to do while building, rarely retrofitted. |
| Shares the app's components vs re-rolls its own | A hand-rolled table beside `DataTable` is a fork. |
| Comment density and recorded reasoning | This codebase records *why*. Files that don't were written fast. |
| Design-token discipline | Arbitrary Tailwind values have **silently emitted no rule at all** here twice. |

**Give each implementation a plain verdict — "the better base", "usable", "shoddy" — and the
evidence for it.** The owner asked for a judgement, not a neutral inventory. Make the call and
show your working. **Mark every visual claim NOT VERIFIED**, and where the difference genuinely
cannot be settled from code, **say that and tell the owner which URL to open.**

## The recommendation, per duplicate

- **Which implementation to build FROM**, and why.
- **Which URL to keep** — these are separable. `TASK-HORSEONE` keeps the *original's URL* and
  the *replacement's component*, on the grounds that the good name and the good code came from
  different places. **Expect that pattern again and look for it.**
- **What the losing implementation has that the winner lacks** — the list of what must be
  carried across before anything is retired. **This is the most valuable column in the report.**
- **Effort**, honestly: is this a route change, a merge, or a rebuild?

---

# ORDER THE REPORT BY WHAT IT COSTS THE OWNER

Not alphabetically, not by file. **Rank by damage:** surfaces that disagree about a number
first (they make the app lie), then duplicated things the owner uses daily, then dead
implementations nobody reaches. **Say what your ranking is based on.**

---

# TWO THINGS TO REPORT SEPARATELY, NOT FOLD IN

1. **71 of 80 pages do not use `PageLayout`/`PageHeader`.** This is not duplication — it is the
   *other* cause of inconsistent UI, and it may be the larger one. **Quantify it: list the
   pages, and state how many carry their own hand-rolled header row.** Do not fix any of it.
2. **Anything already in flight.** `TASK-LEADCLEAN` (lead list) and `TASK-FRAMESCROLL` are
   running; `TASK-HORSEONE` is specced. **List these as known and settled — do not re-derive
   or contradict them.** If your evidence contradicts one of those decisions, **say so
   explicitly**; that is worth knowing.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-dupecensus`, branch `task/dupecensus`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **CHANGE NO CODE. `git diff` against your base must show `docs/` only.** This is the whole
  discipline of this task.
- **Read production for every count you state.** The DB connection string is the first line of
  `.env.db`. A direct psql connection has NULL auth — `current_org()` and `auth.uid()` are NULL
  — so org-scoped RPCs legitimately return 0. **Know the difference between "returns nothing
  because the caller is unauthenticated" and "returns nothing because it is broken", and never
  report the first as the second.** Three threads have already made that mistake.
- **Do not trust a comment over the code**, and do not trust a task doc over either. Several
  files in this repo document values they do not have.
- **Be exhaustive rather than tidy.** A long, honest list is the deliverable. If you run out of
  room, **say what you did not reach** rather than implying coverage you do not have.

# THE TEST THIS MUST PASS

1. Every duplicated concept in the app is listed, with **every** implementation of it.
2. Each implementation has a creation date and commit, so original and replacement are
   distinguishable.
3. Each has a URL the owner can type, or an explicit statement that it is unreachable.
4. Every count claimed is proven against production, with disagreements between implementations
   stated as numbers.
5. Each duplicate ends with a build-from recommendation and a carry-across list.
6. The report is ranked by damage, and the ranking is explained.
7. **`git diff` shows `docs/` only.**

Report to `docs/reports/TASK-DUPECENSUS-REPORT.md`.
