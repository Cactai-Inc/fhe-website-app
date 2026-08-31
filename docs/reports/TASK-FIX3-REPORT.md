# TASK-FIX3 — REPORT: the nav sections, the account page, and the end of the activity surfaces

**Worktree `wt-fix3`, branch `task/fix3`, from `origin/main` @ `cd07e492`. Committed, not pushed.**
**Written 2026-08-31.** Sources of truth read in full first: `TASK-AR3`, `AR4`, `AR5`, `AR6` reports.
**Every DB fact below was measured by `SELECT` against production (`lrstswfxfsezdmvkvukc`) today.**
⚠️ **No production write was made.** The one migration written was applied inside `BEGIN … ROLLBACK`
to prove it parses, replaces cleanly and preserves its grants — and rolled back. §11.

---

## 1. ⚠️ THE HEADLINE: THE FILTER NOW EXISTS

**`manageNavGroups()` returned five groups and all three nav surfaces rendered all five.** The
comment at `AppLayout.tsx:636` said Settings and Modules "are filtered out of the SIDEBAR at the
render site below". **No such filter had ever been written.** The owner reported it on 2026-08-15,
was quoted *in the code* reporting it, and both sections were still on screen sixteen days later.

**The filter is now four lines** — `CARD_PAGE_ONLY`, `railNavGroups()`, `const railGroups =
railNavGroups(navGroups)` — and it is applied at all three sites. **The comment that lied has been
replaced by one that names the filter and says what happened**, so that removing the filter and
leaving the paragraph is now an obvious contradiction rather than an invisible one.

⚠️ **The reason the original miss survived is structural and is why this report leads with it:
there are THREE render sites and changing some of them looks exactly like changing all of them.**
`test/ui/fix3_nav_sections.test.ts` therefore asserts **on the source** that
`railGroups.map(` appears exactly three times and `navGroups.map(` appears **zero** times. A
component test that mounts one surface would have proved nothing about the other two.

**The three call sites, named as the task requires:**

| # | Surface | Where |
|---|---|---|
| 1 | The avatar drop-down (`lg:hidden`) | `AppLayout.tsx` — `{railGroups.length > 0 && (<div className="lg:hidden">` |
| 2 | The desktop staff rail (pinned and collapsed) | `AppLayout.tsx` — `<div className="flex flex-col gap-1">{railGroups.map(…)}` |
| 3 | The mobile drawer | `AppLayout.tsx` — `{railGroups.map((g) => (` after the App-pages block |

---

## 2. ⚠️ THE MODULES QUESTION — ANSWERED WITH EVIDENCE, AS A DELIVERABLE

The owner asked whether the module pages are **VIEWS**, **TENANT PROVISIONING**, or
**BILLING-CONNECTED TOGGLES**, and asked for a reasoned answer that survives the platform build.

### 2.1 The answer: the tenant's module pages are VIEWS. Provisioning already exists and is PLATFORM-side. Billing does not exist, and its seam is already cut.

**⚠️ THE THREE THINGS ARE ALREADY THREE THINGS IN THE DATABASE. They are only one thing in the nav.**

| The three | What it actually is today | Who can do it | Evidence |
|---|---|---|---|
| **The operational pages** (Boarding, Barn Ops, Employees + 8 children) | Views and CRUD over stalls, agreements, charges, resources, consumption, allocation rules, staff, schedule. **None of them writes `org_modules`.** | any staff (`requireStaff`), behind `ModuleGate` | The 3 hubs are KPI + link-card pages (`BoardingHubPage`, `BarnopsHubPage`, `EmployeesHubPage`); the only writers of `org_modules` in the entire database are the three functions in the next row |
| **Provisioning / enablement** | `set_org_module(p_org, p_key, p_enabled, p_source)`, `platform_set_tenant_module(p_org_id, p_module_key, p_enabled)`, and `provision_tenant(…, p_modules text[])`. All `SECURITY DEFINER`; the first two **name SUPER_ADMIN in their own bodies** | SUPER_ADMIN / the billing service **only** | `SELECT proname FROM pg_proc WHERE pg_get_functiondef(oid) ILIKE '%org_modules%'` returns exactly 7 rows: those 3 writers plus 4 readers (`has_module`, `my_modules`, `org_public_config`, `platform_tenant_detail`) |
| **Billing** | ⚠️ **Does not exist — but the seam is already cut into the schema.** `org_modules.source` is CHECK-constrained to `TIER / ADDON / GRANT / SUBSCRIPTION`, and `org_modules.expires_at` exists | nobody — nothing writes `SUBSCRIPTION` and nothing writes `expires_at` | live rows: 3× `TIER` (brokerage, horserecords, lessons, enabled 2026-07-02), 3× `GRANT` (barnops, boarding, employees, enabled 2026-08-12). **`expires_at` is NULL on all six.** |

**Live `org_modules`, queried directly today — and note this corrects AR5, which saw four rows on
2026-08-30:**

```
French Heritage Equestrian | mod.barnops      | t | GRANT
French Heritage Equestrian | mod.boarding     | t | GRANT
French Heritage Equestrian | mod.brokerage    | t | TIER
French Heritage Equestrian | mod.employees    | t | GRANT
French Heritage Equestrian | mod.horserecords | t | TIER
French Heritage Equestrian | mod.lessons      | t | TIER
```

**All six enabled.** ⚠️ **This also kills a stale claim in the source:** `reviewSection.ts` asserted
*"mod.employees is DISABLED for FHE, so this renders ModuleGate's locked fallback."* It is enabled
and `StaffPage` renders for real. That comment is corrected in this branch (§8).

### 2.2 ⚠️ The 30-day grace rule already has a mechanism. Do not build a second one.

The owner described a billing toggle that stops the charge on removal, with grace if toggled off
inside 30 days. **`has_module()` — the one function every module gate in the app calls — already
honours an expiry:**

```sql
SELECT EXISTS (SELECT 1 FROM org_modules
                WHERE org_id = current_org() AND module_key = p_key
                  AND enabled AND (expires_at IS NULL OR expires_at > now()))
```

**So "grace" is `expires_at = now() + interval '30 days'` rather than `enabled = false`.** The read
side is built and correct. What is missing is a writer that knows about money. ⚠️ **Recorded as a
platform requirement, NOT implemented** — there is no billing spine to connect it to, and inventing
one now guarantees a rebuild. This paragraph is the deliverable for that item.

### 2.3 ⚠️ "Which modules do I have" and "the operational pages themselves" are two different things and were one thing

**They are one nav section, and that is the whole defect.** "Modules" answered *"what am I entitled
to?"* — an **entitlement view** — while its contents were the *day-to-day work surfaces*. Boarding is
not a setting; it is where a boarder's stall and monthly rate live. Filing them together made the
work surfaces read as configuration and made the entitlement question un-askable anywhere else.

**The separation this task makes, and why it survives the refactor:**

- **The operational pages are now reached as themselves** — three cards on the account page, one per
  hub, gated on `hasModule()` exactly as the nav gated them. A tenant without boarders sees no
  Boarding card at all, not a locked one. **These are tenant surfaces and stay tenant surfaces.**
- **The entitlement view already has a platform home** and always did: `/app/ops/admin/modules`
  (`AdminModulesPage`, joining the world-readable `modules` catalog against this tenant's
  `org_modules` rows, with `source`) and `/app/ops/superadmin/organizations/:id`. ⚠️ **`ops/admin/modules`
  is routed `requireSuperAdmin`, not `requireAdmin`** — the page's own docblock claimed the opposite
  and is corrected in this branch.
- **⚠️ Under D30 the rebuild is a multi-tenant platform, so module enablement is a PLATFORM concern
  and the per-tenant toggle UI is the thing that does not survive.** The tenant does not toggle its
  own entitlements today (the server refuses), and it should not: enablement is what the platform
  sells. **What the tenant needs is a read — "what do I have, and until when" — and that read has a
  natural home in the account page beside the three hub cards, not a nav section of its own.**
  Not built here; named so the platform build has the shape.

**⚠️ The residual honesty gap, stated plainly:** a tenant admin today has **no surface at all** that
answers "which modules do I have". `/app/ops/modules` shows the hubs he can open, which is the same
answer only while everything is on. The Ops dashboard's Modules panel distinguishes Locked from
Hidden and is the closest thing. That is a real gap, it is small, and it belongs to whoever builds
the tenant-facing entitlement read.

---

## 3. THE MOVES — what shipped, in the order the task required

**Community → Admin landed before App pages → Community**, so no two sections ever shared a name.

| # | Move | Where |
|---|---|---|
| 1 | `community` label → **"Admin"**; Evaluations → `management` | `AppLayout.tsx` (`ADMIN_GROUP`, `MANAGEMENT_GROUP`, `manageNavGroups`), `pageRegistry.ts` (`GROUP_LABEL`, `community.evaluations.group`) |
| 2 | `app-pages` label → **"Community"**; Calendar → `management` **with a registry row** | `AppLayout.tsx` (`APP_PAGES_GROUP`, `StaffNavItems`, `MANAGEMENT_GROUP`), `pageRegistry.ts` (`mgmt.calendar`) |
| 3 | Settings dissolves into Admin — **all five rows, enumerated from the registry** | `AppLayout.tsx`, `pageRegistry.ts` (`pageSections()`) |
| 4 | Modules → the account page as three hub cards; both groups stop rendering in all three surfaces | `AccountHub.tsx`, `AppLayout.tsx` |
| 5 | Records → **Contacts**, plus a **Stable** row; both under **People** | `AppLayout.tsx` (`ACCOUNTS_GROUP`), `pageRegistry.ts` (`people.records` label, new `people.stable`) |
| 6 | Activity and Oversight removed entirely | §5 |

### 3.1 ⚠️ GROUP_LABEL moved in lockstep — it is not dead

The orchestrator wrote *"read by nothing"* into four documents; **AR4 proved it renders the section
headers on `/app/ops/admin/pages`**, via `pageSections()` → `AdminPageVisibilityPage`. Both label
sources moved together. **Measured output of `pageSections()` after the change:**

```
Lessons & Membership:   lessons.hub, lessons.plans, lessons.credits
Boarding & Facility:    boarding.hub, boarding.facilities, boarding.agreements, boarding.charges
Barn Ops & Inventory:   barnops.hub, barnops.resources, barnops.consumption, barnops.allocation_rules
Employees & Scheduling: employees.hub, employees.staff, employees.schedule
Horse Records & Health: records.hub
Management:             mgmt.dashboard, mgmt.calendar, mgmt.support, mgmt.payments_review, community.evaluations
People:                 people.records, people.stable
Admin:                  community.moderation, community.lookups, community.content,
                        settings.team, settings.branding, settings.products, settings.editor,
                        settings.page_visibility
```

**No section headed "Settings" remains on that page.**

### 3.2 ⚠️ THE KEYS DID NOT MOVE, AND THAT WAS DELIBERATE

`org_page_visibility.page_key` is CHECK-constrained to `^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$` and
`pageRegistry.ts`'s own header forbids re-deriving a key from a path. So:

- `community.evaluations` **keeps its key** and only its `group` moved to `management`.
- `people.records` **keeps its key and its path**; only its **label** became "Contacts".
- The five `settings.*` rows **keep both key and `group`**; `pageSections()` folds `settings` into
  the Admin section via a one-line `FOLDED_INTO` map rather than rewriting 5 group fields.
- The AppLayout group key stays `'community'` while its label reads "Admin", for the same reason.

**Cost of that choice, stated:** anyone reading `pageRegistry.ts` sees a row keyed `community.*`
filed under `management`, and a group keyed `community` labelled `Admin`. **That is the design — a
key is a stored identifier, not a description** — and each site now carries a comment saying so.

### 3.3 The Settings orphans — each decided explicitly, as required

| Orphan | Decision | Why |
|---|---|---|
| **`/app/ops/settings` route** | ⚠️ **KEPT, and still renders its card grid.** | The task's own test 2 requires it, and §1's constraint is real: `NavGroupCardsPage` finds the group **by key**, so deleting the `settings` entry from `manageNavGroups()` blanks the page. The group is returned and filtered at the rail instead. D32-consistent: nothing stops resolving. |
| **The Account page's "Settings" card** | ⚠️ **REMOVED.** | Settings is no longer a place you visit — its five pages are ordinary rows in the Admin section, which is where the owner asked them to end up. Keeping the card would leave **two doors onto the same five pages**, which is the duplication this change exists to end. The route still answers for anyone holding the URL; the app no longer advertises it. |
| **`groupKey: 'settings' \| 'modules'` union** | ⚠️ **UNCHANGED.** | Both routes survive, so both literals are still live. Narrowing the union would be a change with no consequence and one more thing to undo. |
| **`OpsDashboard`'s "Settings → Page visibility" prose** | **Updated to "Admin → Page visibility".** | It named a section that no longer exists. |

### 3.4 ⚠️ Page visibility got the nav row it never had

`settings.page_visibility` is the one `protected: true` row in the registry — *"the page that brings
every other one back"* — and **its only door in the whole app was a sentence of prose on the Ops
dashboard's Modules panel.** D17 by the letter, on the page whose entire job is being reachable.
It is now an `adminOnly` row in the Admin section (matching its `requireAdmin` route), and it takes
the `Eye` icon that Oversight freed. **The task's own membership list was short exactly this row;
AR4 found it by enumerating the registry instead of the document, which is what §3 instructed.**

### 3.5 ⚠️ The mobile heading that did not exist

AR4 Finding 3: the desktop rail renders `{APP_PAGES_GROUP.label}` as a clickable heading; **the
mobile drawer rendered no heading for that block at all.** Renaming the string would have changed
nothing on the owner's own device. A heading element was added to the drawer, using the **same
markup as the group headings below it**, deliberately, so the two cannot drift.

⚠️ **Gated on `showRail` (staff).** For a member, that block is the community links **plus their own
personal rows** (My Orders, My Documents, My Stable…), and "Community" would be a heading over the
wrong thing. Staff see it; members see the block unlabelled, exactly as today.

### 3.6 Contacts and Stable — and the seam with TASK-FIX2

`ACCOUNTS_GROUP` was empty and `manageNavGroups()` drops empty groups, which is why "People" had not
rendered since 2026-08-15. It has two rows now, so the heading is back:

- **Contacts** → `/app/records` (`Contact2`, the mark the owner settled on 2026-08-08)
- **Stable** → `/app/records/horses` (`Fence` — deliberately **not** `Boxes`, which is already the
  member rail's "My Stable" *and* Barn Ops)

⚠️ **BOTH POINT AT `RecordsPage`'s OWN TABS, AND THAT IS THE SEAM, NOT AN OVERSIGHT.**
`RecordsPage.tsx`, `Admin.tsx` and `ContactDossierModal.tsx` are **TASK-FIX2's**, and FIX2 is
rebuilding the record surface underneath these two doors. **This task owns the nav; it did not touch
those three files, and did not race.** What that leaves for whoever owns the page: the tab strip
still says "Records" and still carries a Horses tab, so the page has not yet caught up with its two
doors.

⚠️ **Pointing Stable at `/app/stable` was considered and rejected on evidence.** AR3 F3 measured that
surface returning **0 of the tenant's 3 horses** for staff, because it reads the member-scoped
`my_stable_horses()`. AR3's P5 fix (branch `Stable.tsx` on `isStaff` and mount the staff roster)
requires carrying `onOpenContact` and the `ContactDossierModal` mount out of `RecordsPage.tsx` —
**FIX2's file.** A door onto an empty room is worse than a door onto a tab strip.

---

## 4. ⚠️ THE REGISTRY / NAV CONVERGENCE — MEASURED BEFORE AND AFTER

AR3 found the nav is **two disconnected tables of one fact** — `AppLayout.tsx` does not import
`pageRegistry.ts` — and that they had **drifted at 14 of 25 rows**.

**They did not converge structurally (that is bigger than this task, as the brief says). But the
drift is gone.** Measured by walking both tables after the change:

```
REGISTRY ROWS: 30
AGREE (18)              — registry `group` matches the nav group the row renders in
DISAGREE (0)            — was 14 of 25
NO NAV ROW (12)         — lessons.hub/plans/credits, 8 module children, records.hub
NAV ROW, NO REGISTRY ROW (0)
```

**What it cost: nothing extra.** Every disagreement was resolved as a side-effect of moves the owner
asked for — `people.records` was filed under `accounts` while rendering in Management (fixed by
People existing again); Calendar had no registry row (fixed by giving it one); `community.evaluations`
now says `management` because it *is* in Management.

**⚠️ WHAT REMAINS, AND IT IS THE REAL FINDING:** **12 of 30 registry rows have no nav row anywhere.**
`pageRegistry.ts`'s header claimed to list *"EVERY staff page with a nav row of its own"* and its
hub/child rule claimed *"no-cascade is only safe BECAUSE the children are in the nav. If the child
nav rows are ever removed, this rule has to become cascade-with-warning."*
**⚠️ The children were never in the nav. The condition that paragraph named for revisiting the rule
was met before it was written.** Both comments are corrected in this branch (§8); the rule itself is
left as-is, because the honest fix is either eleven nav rows or cascade-with-warning, and both are
bigger than a comment.

**The convergence itself — one table instead of two — is recommended and not attempted.** The shape
is clear now that the drift is zero: `manageNavGroups()` should build from `PAGE_REGISTRY` rows
(which already carry `path`, `label`, `group`, `module`) plus an icon/`adminOnly` column, so a page
is declared once. **Doing it today would have meant rewriting the nav in the same commit that moves
six sections, which is exactly the change nobody could review.**

---

## 5. ACTIVITY AND OVERSIGHT — REMOVED, AND THE GREP

**Removed: routes, components, registry rows, nav rows, the dashboard zone, the grant entry, the
client wrappers, and the two DATABASE FUNCTIONS THAT MINTED LINKS INTO THEM.**

```
$ grep -rn "ops/activity|ops/oversight|ActivityPage|OversightPage|adminOversight|ActivityZone|fetchActivityReadback" src/ api/ test/
src/App.tsx:390                              (comment recording the removal)
src/components/app/dashboard/BusinessZones.tsx:208,210   (comment)
src/components/ops/DocumentIntegrityPanel.tsx:18         (comment)
src/lib/grants.ts:23                                     (comment)
src/lib/support.ts:48,49                                 (comment)
src/lib/pageRegistry.ts:198,199                          (comment)
src/lib/dashboard/registry.ts:51                         (comment)
src/lib/ops/api-dashboard.ts:244                         (comment)
src/pages/app/ops/DocumentsQueuePage.tsx:57,58           (comment)
```

⚠️ **Every surviving hit is a comment recording the removal. Zero live references.** Files deleted:
`src/pages/app/ops/ActivityPage.tsx`, `src/pages/app/ops/OversightPage.tsx`.

**One excluded hit, declared:** `test/db/fixtures/schema_snapshot.sql` still contains
`/app/ops/oversight` twice. It is a point-in-time schema dump used as the PGlite harness baseline,
generated before today's migration. **Regenerating a 27k-line snapshot is TASK-TESTREPAIR-class work
and was not done inside this task** — flagged in §9.

### 5.1 ⚠️ Two DATABASE functions were minting links into the deleted page

`grep` over `src/` would never have found these. **`deliver_evaluation_report()` and
`submit_acquisition_intake()` both call `notify_staff(…, '/app/ops/oversight')`** — so every future
evaluation delivery and every future acquisition intake would have written a staff notification whose
only affordance is a click into the branded 404.

**Migration `20260831T1200_two_alerts_stop_pointing_at_a_page_that_is_gone.sql`** repoints them:
`deliver_evaluation_report → /app/ops/evaluations`, `submit_acquisition_intake → /app/records/deals`.

- ⚠️ **`CREATE OR REPLACE`, not `DROP` + `CREATE`** — both are `SECURITY DEFINER` with EXECUTE granted
  to PUBLIC/anon/authenticated/postgres/service_role, and `DROP` resets grants silently
  (TASK-ORIGIN, 2026-08-27). **Proven in a rolled-back transaction: all five grants survive, and each
  function's remaining `/app/ops/oversight` mention is the explanatory comment, not the string.**
- ⚠️ **No historical rows were touched, because there are none:**
  `SELECT link, count(*) FROM notifications WHERE link LIKE '/app/ops/oversight%' OR link LIKE
  '/app/ops/activity%' GROUP BY 1` returned **0 rows** before the migration was written.
- ⚠️ `/app/records/deals` is the **best available** target, not an obviously right one:
  `mod.brokerage` has no staff hub page, which is a pre-existing gap and is named in §9.

### 5.2 Routes were deleted, not redirected — deliberately

Every other retirement in this codebase (`RECORDS_HUB_RETIRED`, `HORSE_RECORDS_STANDALONE_RETIRED`,
`INTAKE_PAGE_RETIRED`, …) redirects behind a boolean. **These two do not, because there is nowhere to
redirect to.** The ruling was *"remove the surfaces that are dedicated to it entirely… the result
being less clutter"*, and a redirect into a surface that does not exist is clutter with an extra hop.
Both URLs now reach the branded 404. **The ledgers are untouched and still recording (D32).**

### 5.3 ⚠️ `DocumentIntegrityPanel` — RETIRED BEHIND A FLAG. Say which: **retired, not rehomed.**

AR6 called it *"the best thing on either page and its CRUD is correct under D32"*, and the owner's
ruling for it was explicit: **"Retire behind a flag (D32); do not delete the underlying tables — they
keep recording."**

**What that means concretely, because "retire behind a flag" over an unmounted component is not a
flag, it is dead code:** the component is **mounted on the documents ledger**
(`DocumentsQueuePage.tsx`, which is the Records "Documents" tab) **behind
`DOCUMENT_INTEGRITY_PANEL_RETIRED`, which is `true`.** Nothing renders today. **Flip that one boolean
and the panel returns, on the surface that owns documents.** `document_integrity()` and
`cleanup_document()` are untouched in the database and still work.

⚠️ **This is deliberately not a rehoming.** A rehoming would have put a working panel on a new page
the owner did not ask for, inside a task whose instruction was to remove clutter.

### 5.4 The dashboard: zone B6 gone, and a live lie removed with it

- **B6 "What the app has been doing"** — the zone, its loader (`fetchActivityReadback`) and its
  component (`ActivityZone`) are removed. ⚠️ **`dash_activity_readback()` IS RETAINED in the
  database**, per the task: it is the only honest five-ledger read that has ever been built, and it
  is the starting point if this is ever resurfaced.
- ⚠️ **N1 "Notifications" pointed at `/app/ops/activity`** — a page that read `status_events` and had
  **never read `notifications`.** A wrong link on the zone the owner asked for by name.
  **`ZoneDef.to` is now optional** and `DashboardChrome` renders a title with no destination as plain
  text. N1 has no `to`. ⚠️ **Notifications having no surface of their own is a gap worth seeing, not
  one worth papering over with a link to something adjacent.**

### 5.5 The note the owner asked for

**`docs/reference/ACTIVITY-LOG-why-it-has-no-surface.md`** — written, carrying all five required
points, with every number re-measured today rather than copied from AR6:

- why it was removed, and ⚠️ **that it is the opposite of an emptiness finding** — `audit_logs.action`
  is CHECK-constrained to INSERT/UPDATE/DELETE, and **2,919 of 5,632 rows (52%) are two sentences**
  (`UPDATE documents` 2,538, `UPDATE contract_templates` 381);
- the four conditions that would earn it a surface back (scoping, meaningful entries, the record
  reachable, the actor named);
- ⚠️ **the partition requirement** — tenant-scoped, platform entries for the platform admin only,
  never cross-tenant from inside a tenant account;
- the measured facts: `admin_oversight()` reads `audit_logs` with no `WHERE`, is `SECURITY DEFINER`,
  and ⚠️ **`audit_logs` has no `org_id` column** (its ten columns are listed) — so this is a schema
  change, not a query fix; and **807 of 2,401 audit rows in the last 14 days (33.6%) have
  `actor_user_id IS NULL`**, which defeats the obvious join-through-`profiles` workaround;
- that `dash_activity_readback()` is retained, with today's row counts for all five ledgers.

---

## 6. THE TEST THIS HAD TO PASS

| # | Requirement | Result |
|---|---|---|
| 1 | Settings and Modules in NONE of the three nav surfaces; name all three | ✅ §1 — all three named, filter applied at each, pinned by a source-level test |
| 2 | `/app/ops/settings` and `/app/ops/modules` still render their contents | ✅ Both groups still returned by `manageNavGroups()`; routes untouched |
| 3 | Sections read Management · People · Community · Admin, desktop **and** mobile, incl. the mobile heading | ✅ §3.5. ⚠️ **See the caveat below on ORDER** |
| 4 | Calendar and Evaluations under Management; Calendar has a registry row | ✅ `mgmt.calendar` added; `community.evaluations.group = 'management'` |
| 5 | Contacts and Stable have nav rows on both surfaces | ✅ One `ACCOUNTS_GROUP` edit serves both — the rail and the drawer render one array (AR3 F1b) |
| 6 | Activity and Oversight gone from routes, registry, nav, dashboard — paste the grep | ✅ §5, grep pasted |
| 7 | `DocumentIntegrityPanel` rehomed or retired — say which | ✅ **Retired behind a flag**, §5.3 |
| 8 | `ACTIVITY-LOG-why-it-has-no-surface.md` exists with §4's five points | ✅ §5.5 |
| 9 | No comment survives claiming behaviour the code does not have | ✅ §8 — six corrected, itemised |
| 10 | `typecheck`, `typecheck:api`, lint, `npm run build` | ✅ §7 |
| 11 | Renders NOT verified — numbered checklist for the owner | ✅ §10 |

⚠️ **CAVEAT ON TEST 3 — the section ORDER is not the order the task lists.** The App-pages block
(now "Community") is a **pseudo-group rendered above** `navGroups`, not a member of it, on both the
desktop rail and the mobile drawer. So the reading order is **Community · Management · People ·
Admin**, not Management · People · Community · Admin. **All four names are present and correct on
both surfaces; only the sequence differs.** Moving that block below Management is a structural change
to both render sites for a sequence the owner did not explicitly ask for — **flagged, not done.**

---

## 7. THE GATES

| Gate | Baseline (`origin/main`, measured today) | After |
|---|---|---|
| `npm run typecheck` | clean | **clean** |
| `npm run typecheck:api` | clean | **clean** |
| `npm run lint` | **46 problems, 0 errors** ⚠️ (the brief says 48; the tree is at 46) | **46 problems, 0 errors** |
| `npm run build` | — | **succeeds**, incl. prerender + sitemap |
| `npx vitest run test/ui` | 4 files / 11 tests failed, 143 passed | **4 files / 11 tests failed, 156 passed** — same 11, +13 new passing |
| `npm run test:db` | **51 files / 191 tests failed**, 610 passed, 107 skipped | **51 / 191 failed, 610 passed, 107 skipped — identical** |

⚠️ **`test:db` red is the baseline and was run on BOTH branches today, not assumed.** The two runs
are byte-identical in their counts.

**T1 — CSS grepped out of the BUILT stylesheet, not the source.** The new mobile heading reuses the
group-heading classes. In `dist/assets/index-p1gMywro.css`: `.mt-2`, `.border-t`, `.pt-2`, `.pb-1`,
`.text-\[10px\]`, `.tracking-widest`, `.uppercase`, `.font-semibold`, `.pl-5`, `.pr-3`,
`.text-green-900\/70`, `.border-green-900\/12` — **all present.** No new arbitrary value was
introduced; every class was already emitted for the sibling headings.

---

## 8. ⚠️ THE COMMENTS THAT LIED — every one found, corrected or deleted

| Where | Claimed | Truth |
|---|---|---|
| `AppLayout.tsx` `manageNavGroups()` | *"filtered out of the SIDEBAR at the render site below"* | **The filter did not exist.** Replaced with one that names `CARD_PAGE_ONLY`, says what happened, and says to delete the paragraph if the filter goes |
| `reviewSection.ts` | *"mod.employees is DISABLED for FHE, so this renders ModuleGate's locked fallback"* | **All six modules are enabled** (queried today). Corrected, and the D20 consequence — retiring `StaffPage` needs `title`/`pay_type` moved first — written in |
| `AdminModulesPage.tsx` | *"admin route: requireAdmin is on the route"* | Route is **`requireSuperAdmin`**. A tenant admin cannot reach the page at all, so the sentence about their attempt being "surfaced here" was describing something unreachable |
| `pageRegistry.ts` header | *"EVERY staff page with a nav row of its own"* | **12 of 30 have no nav row.** Reworded to what the list actually is |
| `pageRegistry.ts` hub/child rule | *"no-cascade is only safe BECAUSE the children are in the nav"* | **The children were never in the nav.** Corrected, with the count and the reason the rule is left as-is |
| `DocumentIntegrityPanel.tsx` | *"the panel that makes broken documents visible on the Oversight page"* | The page is gone. Rewritten to say where it is mounted, that it is off, and which boolean turns it on |
| `reviewSection.ts` People-A origin | *"one row, 'Records', icon BookOpen"* | Two rows now — Contacts (`Contact2`) and Stable (`Fence`). Updated |
| `pageRegistry.ts` header | *"Calendar/Catalog while they are parked in Review"* | Calendar has a registry row now; **Catalog is the last page in that shape** |
| `AppLayout.tsx` icon import block | BookOpen's reclamation note | BookOpen is gone with the row it was reclaimed for; replaced with the reasoning for `Contact2`/`Fence` and why `Boxes` was refused |

⚠️ **One user-facing sentence is still not true, and is deliberately left alone:** `OpsDashboard`'s
Modules panel says a hidden page's *"menu entry"* can be brought back — **hiding a page removes no
menu entry, because the nav never reads `org_page_visibility` at all.** The task puts that out of
scope and asks for it to be reported; only the section name in that sentence was corrected. **§9.**

---

## 9. FLAGGED, NOT FIXED

1. ⚠️ **Page visibility is wired to nothing.** `manageNavGroups()`'s `visible()` checks `module` and
   `adminOnly` only; `hiddenPages`/`isPageHidden` are never referenced in `AppLayout.tsx`. Hiding a
   page removes no nav row on any of the three surfaces, and `OpsDashboard` tells the user it does.
   **0 rows in `org_page_visibility` today, so it has produced no symptom yet — it will the first
   time the owner uses it.** ⚠️ **This is the flagship D13 surface and it is a silent no-op.** Out of
   scope by the brief; **its own thread.** ⚠️ **And this task just gave Page visibility a nav row,
   which makes it easier to find and therefore easier to be lied to by.**
2. **The `pageRegistry` / `AppLayout` convergence** — §4. Drift is now zero, which makes this the
   cheapest it will ever be. Recommended shape written down there.
3. **12 registry rows with no nav row**, and the hub/child no-cascade rule resting on a false
   premise — §4. Either eleven nav rows or cascade-with-warning.
4. **Section ORDER** — §6's caveat. Community renders above Management on both surfaces.
5. **`admin_oversight()` still exists in the database with no tenant filter and no `org_id` column to
   filter by.** It is now unreachable from the app, which is a strict improvement, but it is still
   `SECURITY DEFINER` and still callable. **The schema fix belongs to whoever resurfaces an activity
   log** — recorded in the reference doc.
6. **`dash_activity_readback()`'s 33.6% NULL-actor blind spot** — its audit branch requires an
   `EXISTS` on `profiles.user_id = actor_user_id`, and NULL fails it. **Must be fixed in the same
   change that ever puts it back on a surface.**
7. **`records.hub` is a dead registry row** — `/app/ops/records` redirects unconditionally
   (`RECORDS_HUB_RETIRED`), so it is a visibility toggle for a page that does not independently
   exist. **Not deleted here:** it is named in `PARKED_IN_REVIEW`, whose own test requires every key
   there to be a real registry entry, so removing it is a two-file edit in a file three other threads
   are touching. AR5 recommended it; it is still right.
8. **`mod.brokerage` has no staff hub page**, which is why §5.1's acquisition-intake notification had
   to settle for the deals ledger.
9. **Catalog** is now the only page left as hand-written JSX with no registry row — the shape
   Calendar just left.
10. **`test/db/fixtures/schema_snapshot.sql` is stale** with respect to today's migration (and, per
    an existing comment in `nostrip_narrowing_never_destroys.test.ts`, has been stale since
    2026-08-03). Regenerating it is its own thread.
11. **The tenant-facing "what do I have" entitlement read** — §2.3's residual gap.
12. **`StaffPage` vs `TeamPage` (D20) is still unresolved**, and §2's measurement makes it live
    rather than theoretical: `mod.employees` is ON, so `StaffPage` renders and holds `title`/`pay_type`
    that `TeamPage` does not.

---

## 10. ⚠️ RENDERS NOT VERIFIED BY ME — the owner's checklist

**I did not start a dev server or a browser.** Everything above is source, type, lint, build, test and
`psql`. **These eleven need eyes, and the first five are the ones that would embarrass this change.**

1. **Desktop rail, signed in as staff:** the headings read **Community**, **Management**, **People**,
   **Admin**. ⚠️ **There is NO heading reading "Settings" and NO heading reading "Modules".**
2. **Same, on your phone (the drawer):** the same four headings — ⚠️ **including "Community", which
   has never rendered on mobile before.** No Settings, no Modules.
3. **The avatar drop-down** (the third surface, easy to forget): same — no Settings, no Modules.
4. **Open `/app/ops/settings` and `/app/ops/modules` by URL.** Both should still show their card
   grids. ⚠️ **If either says "Nothing here yet.", stop — that is the failure mode this design
   risks.**
5. **`/app/account`:** the "Settings" card is **gone**; three new cards — **Boarding**, **Barn Ops**,
   **Employees** — sit where "Modules" was, in that order, at the bottom. My Stable is unchanged.
6. **Under Management:** Dashboard, **Calendar**, Support, Payment review, **Evaluations**. Calendar
   should NOT also still be in the Community block above.
7. **Under People:** **Contacts** and **Stable**. Clicking each opens the Records page on the right
   tab. ⚠️ **The page's own tab strip still says "Records" — that is TASK-FIX2's file, not a miss.**
8. **Under Admin:** Moderation, Field options, Content store, Team, Branding, Products, Editor,
   **Page visibility** (new — it has never had a nav row). As a non-admin instructor, only Moderation,
   Field options, Content store and **Team** should appear.
9. **`/app/ops/activity` and `/app/ops/oversight`** should both land on the branded 404.
10. **The business dashboard:** no "What the app has been doing" zone at the bottom; the
    **Notifications** heading is plain text, not a link.
11. **`/app/ops/admin/pages`:** section headings read Management · People · **Admin** (with all five
    former Settings pages inside it, Page visibility included). **No section reads "Settings".**

---

## 11. TEARDOWN

**Worktree** `/Users/cactai/Downloads/claude-code-repo/wt-fix3` · **branch** `task/fix3` ·
**committed, NOT pushed.** `.env` and `.env.db` copied in per the brief.

**Database:** every `psql` invocation was a one-shot `-c` that exited on its own. **Reads were
`SELECT` only.** The single write test — applying the migration — was wrapped
`BEGIN; … ROLLBACK;` and the rollback is in the transcript. ⚠️ **Nothing was written to production.**
Pamela Godde's lease was never read or referenced.

**Long-running processes started and stopped:** two `npm run test:db` runs (one here, one in the
canonical checkout, for the baseline comparison in §7) and one `npm run build`. All exited.

```
$ ps aux | grep -iE "psql|vite|node.*(dev|vitest)" | grep -v grep
(no matching processes)
```

**Files this branch changed:** **16 modified, 2 deleted** (`ActivityPage.tsx`, `OversightPage.tsx`),
**4 added** (the migration, `docs/reference/ACTIVITY-LOG-why-it-has-no-surface.md`,
`test/ui/fix3_nav_sections.test.ts`, and this report).
⚠️ **`RecordsPage.tsx`, `Admin.tsx` and `ContactDossierModal.tsx` were READ and NOT EDITED** —
TASK-FIX2 owns them.
