# TASK-AR5 — the Modules section moves onto the account page, and everything gets a way back

⚠️ **READ `docs/method/ADMIN-REVIEW-ANALYSIS-STANDARD.md` FIRST.** **You are writing a report. You are
fixing nothing.**

**Owner, 2026-08-29 — the second half of item 8:**
> *"move the contents of the modules section into the account page, make sure every page in that
> section has a back button in the ui at the top on the left so when the link to it is clicked from
> the account page the user can quickly navigate back to the account page, any pages that are linked
> to inside of those pages also need a back button inside the ui for those pages that take the user
> back to the page they got to it from."*

---

## 1. WHAT MOVES — the Modules group as it stands, verified 2026-08-28

**Twelve registry rows in `group: 'modules'`**, each gated by a `mod.*` flag:

| Module flag | Rows |
|---|---|
| `mod.boarding` | Boarding · Facilities & stalls · Board agreements · Board charges |
| `mod.barnops` | Barn Ops · Resources · Consumption log |
| `mod.employees` | Employees · Schedule · Staff |
| `mod.horserecords` | Records *(`/app/ops/records`)* |

⚠️ **`Staff` is still here, and D20 retired `StaffPage` into `TeamPage`** — *"we either have a staff
or a team and we chose team"*. **A retired page still holding a nav row is a finding, and D20 also
records that `is_suspended` and `staff_active` are two independent booleans for one fact.** Establish
the live state; do not assume the retirement completed.

⚠️ **`Records` at `/app/ops/records` is a SECOND row labelled "Records"** — the first is
`/app/records` in the People group. **Two nav rows, one word, two paths.** `TASK-AR3` is deciding the
other one; report the collision and name AR3.

## 2. THE QUESTIONS YOUR REPORT MUST ANSWER

1. ⚠️ **Which "account page"?** The phrase is ambiguous and getting it wrong wastes the whole build.
   Candidates: the member-facing account page with its cards (`AccountHub.tsx`), the staff
   account-scoped tab surface in `Admin.tsx`, or a settings-like hub. **These modules are STAFF
   operational surfaces — boarding, inventory, employees.** ⚠️ **Determine what he means from the
   code and from how he uses the app; if genuinely ambiguous, FLAG IT rather than choosing.**
2. **What does "onto the account page" mean structurally** — cards that link out, a tab, an accordion?
   ⚠️ **CR-74 is a settled owner ruling and it governs: do not take someone to a deeper page to show
   them what an expanding card could show; modals are for quick work; a page is for a record with
   more than its own fields.** Say how the answer honours it.
3. ⚠️ **THE BACK BUTTON IS TWO REQUIREMENTS, NOT ONE.** Read his sentence carefully:
   - **(a)** every module page gets a back button, **top left**, returning to the account page;
   - **(b)** ⚠️ **every page linked to FROM those pages also gets one, returning to the page the user
     came from** — *"back to the page they got to it from"*, which is **history-aware**, not a fixed
     destination.
   **These are different mechanisms.** (a) is a constant target; (b) depends on where you came from.
   **Enumerate every page reachable from a module page** — that is the real size of this task — and
   say how deep the chain goes.
4. **Does a back-button pattern already exist anywhere?** ⚠️ **CR-53 asked for one on the lead's app**
   — *"a back button in the top left area of the page takes them back to the dashboard"*. **Standing
   question 2: is this already implemented somewhere? If so it is the incumbent and must be reused,
   not rebuilt.** This project's defining failure is second implementations.
5. **What does a module page do when its `mod.*` flag is off** — and what happens to a card on the
   account page pointing at it? ⚠️ **Query `org_modules` for the live state.** D20's lesson: a stale
   claim about a module being off cost a previous task real work.
6. **Is browser-back sufficient for (b)?** Say why or why not. ⚠️ **CR-53 explicitly asked for a nav
   pattern rather than browser-back reliance** — but a hand-rolled history stack is a real cost.
   **Give a recommendation with the trade-off named.**

## 3. THE TRAPS

⚠️ **`AppLayout.tsx` (2,217 lines) holds all three nav surfaces and AR3 and AR4 both want it.**
Removing a whole group touches it. **Be exact in your contended-files list — it is how ORCH6
sequences builds.**

⚠️ **A back button is a UI primitive and there is a design-system pass coming.** CR-37 measured the
state: **33 screens build their own overlay against 7 using the shared one; 48 hand-build the green
button; 32 write their own empty state; six different corner radii.** ⚠️ **A back button
hand-rolled per page becomes the 34th instance of exactly that problem.** **Propose ONE component.**

⚠️ **T1 — arbitrary Tailwind values have silently emitted nothing here twice.** If you propose
spacing or colour values, they must be grepped out of the **built** CSS, not the source.

⚠️ **Removing a nav group is a GREP, not an edit** — find every link, redirect and deep link into
those twelve paths before proposing they move. **Three defects in one day were all this shape: a
thing changed in one place, and a second place that read it was missed.**

## 4. OUT OF SCOPE

Building anything · the section renames and the Settings dissolution (AR4) · Contacts and My Stable
(AR3) · the Activity/Oversight merge (AR6).

## 5. REPORT

`docs/reports/TASK-AR5-REPORT.md`, standard §4 shape. Worktree `wt-ar5`, branch `task/ar5`.
**Commit the report only. Do not push.**
