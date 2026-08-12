# TASK-PAGEVIS — REPORT

**Branch** `task/pagevis`, worktree `~/Downloads/claude-code-repo/wt-pagevis`, off `origin/main`.
Not pushed. Database `lrstswfxfsezdmvkvukc` (prod).

**Status: applied, with one part deliberately held.** The entitlements, the table, the RLS, the
two RPCs, the settings page, the status tile and the tests are **live**. The **nav filter is
NOT applied** — `AppLayout.tsx` belongs to `TASK-HORSEONE`, which has not merged, so the task's
own instruction applies: *"report the nav filter as an exact diff instead of applying it."*
It is `docs/reports/PAGEVIS-navfilter.patch`, proven green before it was held, and
`git apply --check` passes against this branch.

---

# 1. THE DESIGN DECISION: WHAT THE VISIBILITY ROW IS KEYED ON

> *"A visibility row keyed on a path that later changes silently stops applying, and the page
> reappears. Choose a key that survives a route rename."*

**The key is a `page_key` — a code-owned slug — and the route path is a field beside it.**

```
src/lib/pageRegistry.ts     { key: 'mgmt.horses', path: '/app/ops/horse-records', label: 'Horses' }
                              ^^^ stored in the DB            ^^^ free to change
org_page_visibility          (org_id, page_key)   ← never sees a path
```

When HORSEONE moves `/app/ops/horse-records`, one field in the registry changes. `mgmt.horses`
does not move, so every stored row keeps applying and nothing reappears. **The database cannot
store a path even by accident** — a CHECK constraint enforces the key grammar
`^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$`, and `/app/ops/boarding/facilities` fails it (proof P5).

**The catalog lives in code, not in a table**, because code is what actually creates pages; a
second copy in the database goes stale the first time somebody adds a route. The database owns
exactly one fact — *which keys this tenant put away*. `test/ui/pagevis_registry.test.ts` reads
`App.tsx` and fails the build if any registry `path` stops being a registered route, so the
rename is caught at build time rather than by the owner clicking a dead link.

**Renames are handled; retirements are handled too.** Deleting a registry entry leaves an orphan
row that nothing reads — harmless. **Default is visible and it is structural, not a default
someone can flip: PRESENCE OF A ROW MEANS HIDDEN.** There is no `hidden boolean`. A page with no
row shows, unhiding is a `DELETE`, and a page added next month ships visible because there is
nothing to insert. New work cannot ship invisible.

---

# 2. WHAT WAS BUILT

### Database — `supabase/migrations/20260812T1600_pagevis_all_modules_and_page_visibility.sql`

| | |
|---|---|
| **Part 1** | All six `mod.*` entitlements ON for French Heritage (barnops, boarding, employees flipped). Scoped to `slug = 'fhe'`, not "every org" — entitlement is a per-tenant commercial fact. The six `core.*` rows are substrate and were not touched. |
| **Part 2** | `org_page_visibility (id, org_id, page_key, hidden_at, hidden_by_user_id)`, RLS on, org boundary RESTRICTIVE, staff read, admin write, `audit_row_change` trigger, `REVOKE ALL … FROM anon`. |
| **Part 3** | `my_hidden_pages()` — the read seam, mirrors `my_modules()`. |
| **Part 4** | `set_page_hidden(page_key, hidden)` — hide inserts, unhide deletes, **refuses the protected key**. |

### Frontend

| File | What |
|---|---|
| `src/lib/pageRegistry.ts` | **NEW.** 33 pages: key, path, label, group, module, parent, protected. Plus `pageSections()` (the settings layout) and `MODULE_HUB_PAGE_KEY` (what the status tile reads). |
| `src/pages/app/ops/admin/AdminPageVisibilityPage.tsx` | **NEW.** The control surface at `/app/ops/admin/pages`. |
| `src/lib/api.ts` | `myHiddenPages()`, `setPageHidden()`. |
| `src/contexts/AuthContext.tsx` | `hiddenPages`, `isPageHidden()`, `refreshHiddenPages()` — the `myPropertyTerm` precedent, same shape. |
| `src/App.tsx` | The `ops/admin/pages` route, `requireAdmin`, matching its Settings siblings. |
| `src/pages/app/ops/OpsDashboard.tsx` | The fourth tile state. `MODULE_HUB_ROUTES` now derives from the registry instead of being a second hand-written map. |
| `test/ui/pagevis_registry.test.ts` | **NEW.** 12 tests — the drift guard. |
| `test/ui/pagevis_settings.test.tsx` | **NEW.** 13 tests — the settings page and the tile. |
| *(held)* `test/ui/pagevis_nav_filter.test.ts` | 10 tests, inside the patch. |

**Deleted: nothing.** No page, route or component was removed.

---

# 3. DECISIONS THE TASK ASKED ME TO MAKE AND STATE

### Hub vs child: **NO CASCADE**

Hiding a hub hides **one row**. Its children keep their own nav rows and stay reachable.

**That is only safe because of the second half of the decision: the eight child pages get their
own nav rows.** The two are joined. Today children are reachable only from cards on their hub,
so hiding a hub *would* strand them — which is why the held patch adds the child rows, and why
**if those rows are ever rejected, this rule must become cascade-with-warning.** The rule is
written on the section in the UI, not just in a comment:

> *"Hiding **Boarding** hides only its own nav row. The pages inside it keep theirs and stay in
> the menu — nothing gets stranded."*

Proven by `pagevis_nav_filter.test.ts` — *"hiding a HUB is not a cascade"*.

### Locked vs Hidden on the status tile

The tile stays, and it has four states now, because Locked and Hidden mean **opposite** things:

| State | Meaning | Who decides | Renders |
|---|---|---|---|
| **Locked** | you do not have this | platform owner (Feature flags) | grey, **not a link** |
| **Enabled** | entitled, hub not built (`mod.brokerage`) | — | white, not a link |
| **→** | entitled, built, shown | — | white, link |
| **Hidden** | entitled, built, **you put it away** | you (Settings → Page visibility) | dashed, muted, **still a link** |

**Hidden stays a `<Link>` deliberately.** Hiding removes the nav entry, not the route, and this
tile is the way back. Collapsing it into "Locked" would tell the owner he had lost something he
had merely tidied. The section carries a line saying exactly that, with a link to the page that
undoes it.

### The way back can never be closed — three layers, and the load-bearing one is in the DB

1. `settings.page_visibility` is `protected: true` in the registry → the row renders with a lock
   and a reason, and **no toggle is rendered at all**.
2. The nav row for `/app/ops/admin/pages` **carries no `page` key**, so the filter has nothing to
   match — hiding *every* key in the registry still leaves that row (nav test).
3. **`set_page_hidden` raises** on that key. This is the one that matters: a UI-only guard is
   bypassed by one `supabase.rpc()` call from the browser console.

Every **other** Settings page — Branding, Products, Forms, Team — stays hideable, because this
one page brings all of them back.

---

# 4. THE TEST THIS HAD TO PASS

| # | Requirement | Result |
|---|---|---|
| 1 | All 6 `mod.*` read `enabled = true` | **PASS**, queried below |
| 2 | All 11 dark pages reachable, and the nav shows them | routes registered + reachable **PASS**; nav rows **HELD in the patch** (proven, not applied) |
| 3 | Hiding one page removes exactly that entry; siblings stay; `org_modules` unchanged | **PASS** — P1/P2 in SQL, nav test, settings test |
| 4 | A hidden page's route still resolves | **PASS by construction** — visibility touches only nav arrays; no route, guard or gate reads it |
| 5 | Survives a reload, stored per tenant not per browser | **PASS** — a DB row, `AuthContext` re-reads it on every session load. No `localStorage` anywhere in this work |
| 6 | Status tile still renders, Hidden ≠ Locked | **PASS** — 5 tile tests |
| 7 | The settings page can never be hidden | **PASS** — P4, plus the nav test's hide-everything case |
| 8 | RLS proven, raw grant output in the report | **PASS** — §5 |

### 1 — all six entitlements

```
    module_key    | enabled | source
------------------+---------+--------
 mod.barnops      | t       | GRANT
 mod.boarding     | t       | GRANT
 mod.brokerage    | t       | TIER
 mod.employees    | t       | GRANT
 mod.horserecords | t       | TIER
 mod.lessons      | t       | TIER
```

### 3 — one page hidden, module untouched

```
=== P1 — FHE admin hides ONE page; org_modules is untouched ===
      page_key       | stamped
 --------------------+---------
  boarding.facilities | t

 -- my_hidden_pages() as this admin:  boarding.facilities

 -- org_modules AFTER: mod.barnops t / mod.boarding t / mod.brokerage t /
                       mod.employees t / mod.horserecords t / mod.lessons t

=== P2 — the SIBLINGS in that same module stay visible ===
       sibling       | hidden
 --------------------+--------
  boarding.hub        | f
  boarding.agreements | f
  boarding.charges    | f

=== P3 — unhide is a DELETE; the row goes ===
 hidden | f          rows_left | 0
```

### Test counts

```
test/ui/pagevis_registry.test.ts     12 passed
test/ui/pagevis_settings.test.tsx    13 passed
test/ui/pagevis_nav_filter.test.ts   10 passed   (against the held diff, before it was reverted)
                                     ──
                                     35
```

`npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 39 warnings, **identical to the
baseline measured on a clean tree**; this work adds none.

Full suite `test/ui`: 146 passed, 5 skipped, **1 failed** —
`pluspass_create_controls.test.tsx:63`. **Pre-existing**: `git stash -u` and re-run gives the same
single failure on a clean tree. Not touched, not mine, not fixed here.

---

# 5. RLS — RAW OUTPUT

### Function grants (the trap this codebase has hit three times)

`CREATE FUNCTION` grants EXECUTE to PUBLIC. A `REVOKE … FROM anon` alone would report success and
do **nothing**, because anon's privilege comes *via PUBLIC*. Both were revoked, then re-read:

```
                         fn                         | anon | authenticated | public_pseudo_role |                                raw_acl
----------------------------------------------------+------+---------------+--------------------+------------------------------------------------------------------------
 my_hidden_pages()                                  | f    | t             | f                  | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
 set_page_hidden(p_page_key text, p_hidden boolean) | f    | t             | f                  | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

`proacl` is explicit and holds **no PUBLIC entry** (a PUBLIC grant appears as a bare `=X/…`).

### Table

```
       relname       | relrowsecurity
---------------------+----------------
 org_page_visibility | t

             polname              | polcmd | polpermissive |                    using_expr                     |                check_expr
----------------------------------+--------+---------------+---------------------------------------------------+-------------------------------------------
 org_page_visibility_admin_write  | *      | t             | (is_admin() AND (org_id = current_org()))         | (is_admin() AND (org_id = current_org()))
 org_page_visibility_org_boundary | *      | f             | (org_id = current_org())                          | (org_id = current_org())
 org_page_visibility_staff_read   | r      | t             | (has_staff_access() AND (org_id = current_org())) |
```

`grantee` list for the table: `authenticated`, `postgres`, `service_role`. **`anon` is absent** —
the `REVOKE ALL … FROM anon` landed.

### Cross-tenant (P8) — run against a throwaway second tenant inside `BEGIN … ROLLBACK`

Only one organization exists in production, so a real second tenant was created, exercised and
rolled back rather than reasoning about the boundary in the abstract.

```
-- tenant B hides one of ITS pages:                    b_hid | t     b_sees | 1
-- FHE admin READ across the boundary:      fhe_sees_via_rpc | 0
                                          fhe_sees_via_table | 0
-- FHE admin hiding the SAME key makes its OWN row:
      slug      |       page_key
 ---------------+----------------------
  fhe           | community.moderation
  proof-tenant-b| community.moderation
-- FHE admin UNHIDE deletes only its own row; tenant B's survives:
  proof-tenant-b| community.moderation
-- direct table writes across the boundary:  fhe_updated_b_rows | 0
                                             fhe_deleted_b_rows | 0
-- INSERT into tenant B: ERROR: new row violates row-level security policy for table "org_page_visibility"
-- tenant B still holds exactly its one row.
```

### Refusals

```
P4  set_page_hidden('settings.page_visibility', true)
    ERROR:  set_page_hidden: settings.page_visibility is the page that unhides everything else and cannot be hidden
P5  set_page_hidden('/app/ops/boarding/facilities', true)
    ERROR:  set_page_hidden: /app/ops/boarding/facilities is not a page key
P6  as a plain member
    ERROR:  set_page_hidden: restricted to a tenant administrator
P7  as admin@cactai.io (PLATFORM owner, org_id NULL)
    ERROR:  set_page_hidden: restricted to a tenant administrator
    my_hidden_pages() → 0 rows
```

**P7 is D1a working, not a defect.** The platform owner holds no FHE rows and is correctly denied
by a tenant-scoped function. No `org_id` was set on it.

Reproducible: `docs/reports/TASK-PAGEVIS-rls-proof.sql`, run inside `BEGIN; \i …; ROLLBACK;`.

---

# 6. THE HELD NAV DIFF

**`docs/reports/PAGEVIS-navfilter.patch`** — `git apply` it after HORSEONE merges. It contains:

1. `NavItem` gains `page?: string`.
2. Page keys on the 14 existing hideable rows.
3. **The 8 module CHILD rows**, so every one of the 11 pages has a nav entry of its own.
4. The **Page visibility** row in `SETTINGS_GROUP` — deliberately with **no** `page` key.
5. `manageNavGroups(…, isPageHidden = () => false)` and the filter clause, added **last** in
   `visible()`, after entitlement and role, with a comment saying why it must never read as a
   third gate.
6. `test/ui/pagevis_nav_filter.test.ts` — its own 10-test proof.

The filter itself is three tokens of logic:

```ts
&& !(i.page && isPageHidden(i.page))
```

**A row with no `page` key is unhideable by construction**, which is what protects the way back
and every nav row this task did not enumerate.

**Why it is held rather than applied:** the task names `AppLayout.tsx` as HORSEONE's file and
gives this exact fallback. HORSEONE is not merely unmerged — it is **explicitly HELD** behind
`DUPECENSUS → REVIEWNAV → the owner's ruling`, so this could be a long wait. **Consequence, said
plainly: until the patch is applied, hiding a page changes the status tile but changes no nav
row, and the settings page has no nav entry (reach it at `/app/ops/admin/pages`).** If you would
rather have the feature working now than wait on HORSEONE, say so and it applies in one command
— it is already written and already proven.

---

# 7. IN-APP LINKS THAT WOULD POINT AT A HIDDEN PAGE — REPORTED, NOT FIXED

A link to a page you put away is not automatically wrong (the route resolves and it still
works), so per the task none of these were changed. All of them are hub→child cards, which is
the expected shape:

| Source | Links to |
|---|---|
| `src/pages/app/ops/hubs/BoardingHubPage.tsx:23,28,33` | facilities, agreements, charges |
| `src/pages/app/ops/hubs/BarnopsHubPage.tsx:24,31,38` | resources, consumption, allocation-rules |
| `src/pages/app/ops/hubs/EmployeesHubPage.tsx:48,52` | staff, schedule |
| `src/pages/app/ops/records/HorseHealthPage.tsx:384`, `HorsePartiesPage.tsx:345` | back-links to `/app/ops/records` |
| `src/pages/app/InstructorHome.tsx:143,153` | `/app/ops/lessons` |

**The decision, stated:** hub cards are **not** filtered by visibility. A hub you kept still
lists a child you put away. Filtering them would mean hiding a page removes two different kinds
of thing, and the second one is content on a page you chose to keep.

---

# 8. FLAGGED — NOT FIXED, FOR THE OWNER

1. **The App-pages block is not hideable.** Messages (and Calendar/Catalog while they sit in
   Review) are hand-written JSX in `StaffNavItems`, not a `NavItem[]` table, so there is no row
   for the filter to remove. Making them hideable means restructuring that block — beyond this
   task, and half-doing it would have been worse than naming it.
2. **Review rows are deliberately excluded from the registry.** Nav position IS their status
   (owner: *"once its moved out of the review section its deemed done"*), so hiding a Review row
   would falsify the acceptance signal. The **real** pages behind them are in the registry under
   their permanent homes, marked `PARKED_IN_REVIEW`, and the settings page says so on the row.
3. **Lessons' three child pages** (`packages`, `credits`, `sessions`) and the two parameterised
   Records routes have **no nav rows and are therefore not in the registry.** They were outside
   the task's 11. If the owner wants them in the nav, they need rows first — say the word.
4. **11 rows in one Modules group is a lot of nav** and that may itself read as clutter. It is
   the mandated shape (default visible; you cannot hide what is not shown), and the fix is two
   clicks on the new page rather than a code change. Flagging it because the owner's complaint
   was about volume.
5. **`org_modules` now shows every module on, so `AdminModulesPage` is the only place to turn one
   off** — and that page is `requireSuperAdmin`. That is correct (entitlement is the platform
   owner's call) but worth knowing: the tenant owner cannot turn a module off himself, by design.
   He can hide every one of its pages, which is what he actually asked for.

---

# 9. NOT VERIFIED — needs a browser

No staff browser session exists in this environment. Everything above is proved by SQL against
prod or by tests. **The render is NOT VERIFIED.** Checklist, in order:

1. Sign in as `admin@fhequestrian.com`, go to `/app/ops/admin/pages`. All 33 rows appear,
   grouped by module, all showing "Shown".
2. `Page visibility` row shows a lock and **"Always shown"**, with no toggle.
3. Click **Facilities & stalls** → it flips to "Hidden" and stays hidden after a full reload.
4. `/app/ops/boarding/facilities` still opens by URL and renders normally.
5. `/app/ops` → the Boarding tile reads **Hidden** (dashed, muted) and still navigates.
6. Turn a module off under Feature flags → its pages read **Locked** with no toggle, visibly
   different from Hidden.
7. Bring Facilities back; confirm the tile and the row return.
8. **After the patch is applied:** hiding **Barn Ops** removes only that rail row — Resources,
   Consumption log and Allocation rules stay.
9. **After the patch:** hide every hideable page, confirm **Page visibility** is still in the
   rail and everything can be brought back from it.
