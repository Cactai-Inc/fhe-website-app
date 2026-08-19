# TASK ONETEAM — there is one roster of the people who work here, and it is Team

**RUN WITH: Sonnet 5 · thinking ON · effort MEDIUM.** The judgement is already made (below); this
is a bounded consolidation with the traps written out. **Nothing here is open to redesign.**

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-oneteam`, branch `task/oneteam` ·
report to `docs/reports/TASK-ONETEAM-REPORT.md` · commit, **do not push** · no subagents ·
**TEARDOWN: remove `node_modules` from the worktree when done; never symlink it.**

---

# WHY THIS EXISTS

> **Owner, 2026-08-18:** *"i stated to consolidate by taking pages like staff and team and merge
> them into one. we either have a staff or a team and we chose team but staff was in the original
> build and never revised only written around…"*

**The ruling is settled: ONE roster, and it is Team.** `StaffPage` is original-build code that
every later task worked *around* rather than *through*.

## Why it survived — read this, it is the whole lesson

`TASK-PAGEMERGE` had this exact pair in scope, as review group `staff-roster`, and **skipped it**:

> `docs/reports/TASK-PAGEMERGE-REPORT.md:36` — *"**staff-roster** | Team live, Employees
> module-disabled | Unchanged; `mod.employees` still off for FHE. | **Not touched, correctly
> low-priority**"*

**That premise was false when it was written.** Measured 2026-08-18:

| when | what |
|---|---|
| 2026-08-12 08:02 | `org_modules` enables `mod.employees` for FHE (`source = GRANT`) |
| 2026-08-12 08:13 | `TASK-PAGEVIS` commits *"every module on"* |
| 2026-08-12 | `reviewSection.ts` staff-roster written carrying *"mod.employees is DISABLED for FHE"* — **stale within the hour** |
| 2026-08-15 18:30 | `TASK-PAGEMERGE` reads that warning, repeats it, and defers the merge |

**`my_modules()` as `admin@fhequestrian.com` returns `mod.employees` today.** So the deferral was
made on a three-day-old claim, and the result is a live, empty nav row the owner clicked.

⚠️ **The trap for you: `reviewSection.ts` and the PAGEMERGE report both still assert the module is
off. They are wrong. Query `org_modules` yourself before you believe any state claim in any doc.**

---

# WHAT WAS MEASURED — 2026-08-18, production

| thing | value |
|---|---|
| profiles with `staff_active = true` | **2** — CJ and Claire, both `title = 'Owner'` |
| profiles with `pay_type` set | **0** |
| `shifts` rows | **0** |
| readers of `title` / `pay_type` / `staff_active` anywhere in `src/` | **`api-employees.ts` and `StaffPage.tsx` only** |

**So the entire unique payload of the Staff page is two title strings and one unused column.**

## The three-way duplication, named

| concept | Team writes | Staff writes |
|---|---|---|
| who works here | `members` roster + role | `profiles.staff_active` |
| are they active | **`profiles.is_suspended`** (`adminSetSuspended`) | **`profiles.staff_active`** |
| what is their job | — | `profiles.title` |
| how are they paid | — | `profiles.pay_type` |

⚠️ **`is_suspended` and `staff_active` are two independent booleans for one fact**, written by two
pages that never read each other. **This is the defect, not just the duplicate page.**

---

# WHAT TO BUILD

**T1 — Team absorbs the employment fields.** `TeamPage`'s roster rows gain **Title** and **Pay
type**, editable by an admin, written to `profiles.title` / `profiles.pay_type`. Put them in the
existing per-member detail, not a new page.

**T2 — One active flag.** `staff_active` is **retired in favour of `is_suspended`**, which already
has a control, a moderation log entry (`logModeration`) and real usage. Migrate the two live rows,
then stop writing `staff_active`. **Do not drop the column** — retire it behind the standing
delete-nothing rule and say so in the report.

**T3 — `StaffPage` is deleted.** The component, its route (`App.tsx:409`), its nav row
(`employees.staff` in `pageRegistry.ts`, `AppLayout.tsx` MODULES_GROUP). ⚠️ **Deletion is correct
here and is the named exception to the delete-nothing rule** — the owner retired the page. Name
this ruling in the commit message, as the rule requires.

**T4 — Nothing else breaks.** `EmployeesHubPage` deep-links into Staff and reports an
"active staff" KPI; `SchedulePage` calls `listStaffProfiles()` for its staff picker. **Both must
keep working**: retarget the hub's link to `/app/ops/team`, and repoint the picker at the Team
roster query. `listStaffProfiles` either dies or becomes the Team-backed one — **not both.**

**T5 — Fix the query bug on the way past, or prove it was never real.** `STAFF_SELECT`
(`api-employees.ts:112`) embeds `contact:contacts(...)` from `profiles`, and those tables carry
**two FK constraints in opposite directions** (`profiles_contact_id_fkey`,
`contacts_deleted_by_fkey`), which PostgREST cannot disambiguate without a hint — the sibling
`SHIFT_SELECT` on the next line uses one. **This is the leading suspect for why the page rendered
empty with 2 matching rows in the database.** If any surviving query keeps that embed, hint it.
**Report which it was: an ambiguous-embed error, or something else.**

# OUT OF SCOPE

- **`SchedulePage` and the Employees module itself stay.** Shift scheduling is a different concept
  from a roster, it has its own page, and `shifts` is empty pre-launch — **empty is not a
  finding.** ⚠️ **Whether Schedule eventually belongs under Team is an OWNER decision, not yours.
  Raise it in the report; do not act on it.**
- No change to roles, invitations or instructor grants.
- No redesign of `TeamPage`'s layout beyond the two new fields.

# TRAPS

- **Do not "improve" by building a third roster.** This project has three horse rosters and three
  lead lists from exactly that instinct.
- **`reviewSection.ts`'s `staff-roster` group must be deleted** as part of this — the owner's rule
  is that leaving Review IS the acceptance signal, so a merged page that stays listed is a lie.
  Follow that file's own header procedure.
- **A green function call is not a working feature.** After T3, grep for every reference to the
  deleted route and prove zero remain.
- **`test:db` is red at baseline. Never cite it as proof.** Verify against production with `psql`
  using `.env.db`.

# THE TEST THIS MUST PASS

1. `/app/ops/team` shows **CJ and Claire with title `Owner`**, and both fields are editable and
   provably persist (re-query the row, paste it).
2. `/app/ops/employees/staff` is **gone** — route, component, nav row — with a grep proving no
   reference survives.
3. `EmployeesHubPage` loads, its KPI is correct, and its link lands on Team.
4. `SchedulePage` loads and its staff picker still lists both people.
5. **One active flag.** Show the query proving `staff_active` is no longer written, and that the
   two live rows carry the right `is_suspended` value.
6. `reviewSection.ts` no longer lists `staff-roster`.
7. **Production row counts before and after, shown equal** except the intended field writes.

Report to `docs/reports/TASK-ONETEAM-REPORT.md`. Do not push; the orchestrator merges.
