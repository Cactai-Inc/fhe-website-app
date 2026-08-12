# TASK PAGEVIS — every module on, and the tenant hides pages one at a time

**Owner, 2026-08-11:**

> *"status tile is needed, i should have all modules enabled for FHE tenant and i need the
> ability to hide individual pages not be required to hide entire modules nor be burdened by
> things i wont be using."*

Three instructions, and they only work together:

1. **The module status tile stays.** It is not redundant and is not to be removed.
2. **Every module is enabled for FHE.**
3. **Visibility becomes per PAGE, not per module** — because #2 without #3 buries the owner in
   surfaces he does not use.

---

# MEASURED, 2026-08-11

## What the tenant owns today

```
org_modules — French Heritage Equestrian
  mod.brokerage      enabled = TRUE
  mod.horserecords   enabled = TRUE
  mod.lessons        enabled = TRUE
  mod.barnops        enabled = false     <- turn on
  mod.boarding       enabled = false     <- turn on
  mod.employees      enabled = false     <- turn on
```

`modules` (the catalog) lists all 12 — 6 `core.*` (`is_core = true`) and 6 `mod.*` — and every
one is `active = true`. **The 6 `core.*` rows are the substrate** (tenancy, roles, contracts,
payments, registry, branding). **They are not user-facing surfaces and are not part of this
task.** Only the 6 `mod.*` entitlements are.

## What turning the three on actually surfaces — 11 pages

```
mod.boarding    /app/ops/boarding             BoardingHubPage
                /app/ops/boarding/facilities  FacilitiesPage
                /app/ops/boarding/agreements  BoardAgreementsPage
                /app/ops/boarding/charges     BoardChargesPage
mod.barnops     /app/ops/barnops              BarnopsHubPage
                /app/ops/barnops/resources    ResourcesPage
                /app/ops/barnops/consumption  ConsumptionLogPage
                /app/ops/barnops/allocation-rules  AllocationRulesPage
mod.employees   /app/ops/employees            EmployeesHubPage
                /app/ops/employees/staff      StaffPage
                /app/ops/employees/schedule   SchedulePage
```

**`mod.brokerage` is already enabled and has NO hub page** — its nav entry was removed because
it 404'd. That is why `OpsDashboard` renders it as a non-navigating "Enabled" tile. **Do not
add a brokerage nav entry in this task**; the hub does not exist.

---

# THE MODEL

## 1. Modules stay. They are the entitlement layer.

**Do not replace module gating with page gating.** They answer different questions:

- **`org_modules` = what this tenant is ENTITLED to.** A commercial fact. The platform owner
  sets it.
- **Page visibility = what this tenant CHOOSES to see.** A preference. The tenant owner sets it.

**A hidden page is still entitled**; it is just not in the way. Unhiding must never require the
platform owner. **Never implement "hide" by flipping `org_modules.enabled` to false** — that
would revoke an entitlement to satisfy a display preference, and it would take the other pages
in that module down with it, which is precisely what the owner is objecting to.

## 2. The status tile stays — and now it has a third state to tell the truth about

> *"status tile is needed"*

`OpsDashboard` renders three states today: `Locked` (no entitlement), `Enabled` (entitled, hub
not built), and a navigating tile with `→` (entitled and reachable). **All three stay.**

After this task a fourth condition exists: **entitled, built, and deliberately hidden by the
tenant.** **That must be distinguishable from "Locked."** Locked means *you don't have it*;
hidden means *you have it and chose to put it away* — and the second must be reversible from
the UI without anyone's help. **Say what you chose and why.**

## 3. Where visibility lives

Per-tenant, per-page, and it must survive a deploy. **A DB row, not `localStorage`** — this is
a tenant configuration decision, not a per-browser display preference like DOCCOLS' column
toggle.

**Key it on something stable.** The route path is the obvious key and it is also the fragile
one — `TASK-HORSEONE` is about to move `/app/ops/horse-records` to `/app/ops/horses`. **A
visibility row keyed on a path that later changes silently stops applying, and the page
reappears.** Choose a key that survives a route rename, or state plainly how renames are
handled. **This is the design decision of the task — do not skip past it.**

Default is **visible**. A page with no row shows. A new page added later shows until hidden —
never the reverse, or new work would ship invisible.

## 4. Hiding hides the NAV ENTRY. It does not remove the route.

- The nav entry goes.
- **The route still resolves.** A bookmark, an in-app link, or a URL still works.
- **Nothing is gated, blocked or 404'd.** This is decluttering, not permission.

**Do not add an auth check here.** `requireStaff` and the module gates already do that job.
Adding a third gate over a *preference* is how a tenant locks itself out of its own data.

**Report — do not fix — any in-app link that would now point at a hidden page.** A link to a
page the owner has put away is not automatically wrong, but he should know it exists.

## 5. The control surface

The tenant owner needs to see every page and toggle each one. Somewhere in Settings —
`SETTINGS_GROUP` already holds Branding / Products / Forms, and this belongs beside them.

- **Group by module**, so the structure is legible.
- **Show every page, including currently visible ones.** A list of only the hidden ones cannot
  be used to hide anything.
- **Hiding a hub while leaving its children visible must not orphan them.** Decide the rule —
  cascade, or block, or allow-with-warning — **state it, and make the UI say it.**
- **The tenant must not be able to hide everything and lose the way back.** The settings page
  itself must always be reachable. **Guard this explicitly and prove it.**

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-pagevis`, branch `task/pagevis`, off `origin/main`.
  **Never `~/Desktop`.** Do not push.
- **⚠️ `AppLayout.tsx` BELONGS TO `TASK-HORSEONE`, which runs first.** The nav filter is the
  heart of this task and it lives in that file. **Rebase onto `origin/main` after HORSEONE
  merges before touching the nav.** If HORSEONE has not merged when you reach that step,
  **build and prove everything else — the table, the RLS, the RPC, the settings page — and
  report the nav filter as an exact diff instead of applying it.**
- **`DashboardPanel.tsx` / `ops/IntakePage.tsx` belong to `TASK-LEADCLEAN`**, and
  **`DataTable.tsx` to `TASK-FRAMESCROLL`.** Do not edit them.
- **Delete nothing.** No page, route or component is removed by this task.
- **RLS, and it is the risky part.** A tenant reads and writes only its own visibility rows.
  **`CREATE FUNCTION` grants EXECUTE to PUBLIC by default** — explicitly
  `REVOKE … FROM PUBLIC, anon`, then re-read `has_function_privilege()` for `anon`,
  `authenticated` and PUBLIC and paste the raw output. **A revoke that reports success may have
  done nothing** — that has happened three times here.
- **D1a:** `admin@cactai.io` is the PLATFORM owner with `org_id` NULL **by design**. Being
  denied by tenant-scoped functions is **correct** for it, not a bug. Do not give it an org.
- Migration: **no self-contained `COMMIT;`**; **do not reuse another migration's temp table
  name.** Dry-run in `BEGIN; … ROLLBACK;`, apply, verify with a query.
- No staff browser session exists and you will not be given one. Prove every claim against SQL;
  report the render as **NOT VERIFIED** with a numbered checklist.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. All **6** `mod.*` entitlements read `enabled = true` for French Heritage — proven by query.
2. All **11** previously-dark pages are reachable, and the nav shows them.
3. Hiding one page removes exactly that nav entry — **its siblings in the same module stay**,
   and `org_modules.enabled` is **unchanged**.
4. A hidden page's route still resolves by URL.
5. The setting survives a reload and is stored per tenant, not per browser.
6. The status tile still renders, and "hidden" is distinguishable from "Locked".
7. The settings page can never be hidden, and the owner can always get back.
8. RLS proven: a tenant cannot read or write another tenant's visibility rows, and the raw
   grant output is in the report.

Report to `docs/reports/TASK-PAGEVIS-REPORT.md`.
