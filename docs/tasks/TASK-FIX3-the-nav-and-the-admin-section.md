# TASK-FIX3 — the nav sections, the account page, and the end of the activity surfaces

⚠️ **THIS IS A BUILD TASK.** Report to `docs/reports/TASK-FIX3-REPORT.md`.

**Sources of truth — read all four first:** `docs/reports/TASK-AR3-REPORT.md`, `TASK-AR4-REPORT.md`,
`TASK-AR5-REPORT.md`, `TASK-AR6-REPORT.md` (branches `task/ar3` … `task/ar6`).
⚠️ **AR4 and AR5 edit the same lines in four files and both said so. THIS TASK IS THEM MERGED —
that is why it is one thread and not three.**

---

## 1. ⚠️ THE FINDING THAT FRAMES EVERYTHING HERE

**Settings and Modules were never removed from the sidebar.** No filter exists; `navGroups` renders
whole at `AppLayout.tsx:1682`, `:1935` and `:2168` — desktop rail, pinned rail, mobile drawer.
Two threads found it independently; the orchestrator confirmed it.

⚠️ **AND THE COMMENT AT `AppLayout.tsx:636` ASSERTS THE FIX WHILE QUOTING THE OWNER REPORTING IT:**
> *"Settings and Modules stay in THIS array and are filtered out of the SIDEBAR at the render site
> below … (owner 2026-08-15: "modules and settings should all be inside of the account page", then on
> finding them still there: "the settings and modules sections are still in the nav and they still
> show pages")."*

**Reported 15 August. A fix written into prose. The code never written. Now item 8 on the owner's
list.** ⚠️ **Same class as `Onboarding.tsx:773` claiming a server guarantee that did not exist. When
you finish, DELETE OR CORRECT EVERY COMMENT THAT DESCRIBES BEHAVIOUR THE CODE DOES NOT HAVE — a
false comment is worse than none.**

⚠️ **THE CONSTRAINT THAT COMMENT NAMES IS REAL AND LOAD-BEARING:** the entries cannot simply be
deleted, because `/app/ops/settings` and `/app/ops/modules` render their own contents by calling
`manageNavGroups()` and looking themselves up **by key**. **The destination and the discarded nav row
are fed by one source, deliberately.** Removing the entries blanks both pages.

## 2. ⚠️ THE MODULES QUESTION — THE OWNER ASKED FOR A REASONED ANSWER, NOT A REFLEX

> *"This needs to be repaired by correcting the actual structure of the DB and the routing unless you
> think im wrong … Worth thinking through how this should be constructed for the multi-tenant platform
> build so the changes we make here are not things that need to be rethought when the platform build
> refactors the codebase."*

**He then set out the test himself: are the module pages VIEWS, TENANT PROVISIONING, or BILLING-CONNECTED
TOGGLES?** — and if the third, a toggle adds the module and starts the charge, removes it and stops
the charge, with grace if toggled off inside 30 days, and billed anyway if toggled back on while
anyone is using it.

### THE ORCHESTRATOR'S POSITION — argue with it if the evidence says otherwise

**`org_modules` is per-tenant enablement, and that is a BILLING-ADJACENT fact wearing a nav costume.**
Under D30 the rebuild is a multi-tenant platform where *"the capabilities need to be tuned to the
specific businesses"* — **so module enablement is a platform concern that survives the refactor, and
the per-tenant toggle UI is the thing that does not.**

**Therefore, for THIS task:**
1. ⚠️ **Do NOT build a billing-connected toggle.** There is no billing spine to connect it to, and
   inventing one now guarantees a rebuild. **The 30-day grace rule the owner described is a PLATFORM
   requirement — record it, do not implement it.**
2. **Treat the module pages as what they demonstrably are today** — operational surfaces (Boarding,
   Barn Ops, Employees) — and move them to the account page as link-out cards **per AR5**, which
   found `AccountHub.tsx` already hosts Settings and My Stable as exactly that pattern since
   2026-08-15. ⚠️ **This is not a new pattern; it is the incumbent.**
3. ⚠️ **The "which modules do I have" VIEW and the "operational pages themselves" are two different
   things and are currently one.** **Say so explicitly in your report** — that separation is the
   thing the platform build needs and the thing that makes this change survive it.
4. **Write the answer to his three-way question into the report** with evidence: what each module
   page actually does, whether any of it is provisioning, and what belongs on a tenant surface at all.
   ⚠️ **That analysis is a deliverable, not a preamble.**

## 3. THE MOVES — ordered, because the order matters

⚠️ **Community must become Admin BEFORE App pages becomes Community**, or two sections briefly share
a name.

1. **`community` → "Admin"**, and **Evaluations moves to `management`**.
2. **`app-pages` → "Community"**, and **Calendar moves to `management`**.
   ⚠️ **`APP_PAGES_GROUP` is hand-written JSX at `AppLayout.tsx:1488`, not a registry group** — and
   ⚠️ **AR4 found the heading is NOT RENDERED ON MOBILE AT ALL. Renaming a string fixes desktop only;
   the mobile drawer needs a heading element that does not exist.**
3. **Settings dissolves into Admin.** ⚠️ **AR4 found the task's own membership list was short one row
   — `settings.page_visibility`, the page that un-hides everything else.** **Enumerate from the
   registry, not from any document.**
   ⚠️ Dissolving orphans `/app/ops/settings`, its Account-page card and a TypeScript union — **decide
   each explicitly and say so.**
4. **Modules move to the account page** (§2), and **both groups stop rendering in all three nav
   surfaces.**
5. **Records becomes Contacts** (Leads · Clients · Partners · Vendors) with a nav row on desktop and
   mobile; **horses go to the staff Stable page.**
6. **Activity and Oversight are removed entirely** — see §4.

⚠️ **`GROUP_LABEL` IS NOT DEAD.** The orchestrator wrote *"read by nothing"* into four documents and
**it was wrong** — AR4 proved it renders section headers on `/app/ops/admin/pages`. **Both label
sources must move in lockstep or that page goes stale.**

⚠️ **AR3 found the nav is two disconnected tables of one fact** — `AppLayout.tsx` never imports
`pageRegistry.ts`, and they have drifted at **14 of 25 rows**. ⚠️ **Converging them is the right fix
and is bigger than this task. Report it; if you can converge safely, say what it cost.**

## 4. ⚠️ THE ACTIVITY SURFACES ARE REMOVED — OWNER RULING, 2026-08-31

> *"the pages are virtually worthless and provide no true value in a practical sense because they
> show massive repeating entries with the same thing all of which doesnt actually tell me anything …
> i vote to remove this from all surfaces, remove the surfaces that are dedicated to it entirely, the
> result being less clutter in the menus and on the dashboard."*

**Remove: `/app/ops/activity`, `/app/ops/oversight`, their nav rows, and the dashboard zone.**
⚠️ **"The removal needs to be full and complete"** — routes, registry rows, nav entries, dashboard
zone, and every inbound link. **Removing a thing here is a GREP, not an edit.**

⚠️ **BUT `DocumentIntegrityPanel` LIVES ON OVERSIGHT AND IS NOT ACTIVITY LOGGING.** AR6 calls it *"the
best thing on either page and its CRUD is correct under D32."* **Do not destroy it. Rehome it or
retire it behind a flag deliberately, and say which.**

**Retire behind a flag (D32); do not delete the underlying tables — they keep recording.**

### The note the owner asked for, written where it will be found
> *"all activity log information needs to be located on a single source that isnt rendered in the ui
> at all but has notes added to it that are distilled and summarized from this message explaining
> what would make it worth adding that page to the ui."*

**Write `docs/reference/ACTIVITY-LOG-why-it-has-no-surface.md`** carrying:
- **Why it was removed** — repeating entries carrying no information; `admin_oversight` renders
  `audit_logs.action`, CHECK-constrained to INSERT/UPDATE/DELETE, producing fifty lines of
  *"UPDATE · documents"*. ⚠️ **Not an emptiness finding — the opposite. It is full and says nothing.**
- **What would make it worth surfacing:** rigorous filtering and scoping, entries that carry meaning
  in themselves, and the related record reachable from the entry. ⚠️ **Nothing on either page is
  clickable today: `entity_id` is fetched and used only as a React key, and `actor_user_id` is fetched
  by both pages and rendered by neither. "Who did this?" is unanswerable on both while both query the
  answer.**
- ⚠️ **THE PARTITION REQUIREMENT — the owner's own, and it is a platform ruling:** activity logs must
  be **tenant-scoped**, with platform-level entries visible only to the platform admin and **never
  cross-tenant from inside a tenant account.**
- **The measured facts:** `admin_oversight()` reads `audit_logs` with **no `WHERE` clause**, is
  `SECURITY DEFINER`, and **`audit_logs` has no `org_id` column to filter by** — so this is a schema
  change, not a query fix. **37% of audit rows (951 of 2,537 in 14 days) have `actor_user_id IS
  NULL`**, so any read keyed on the actor silently omits every change the app made to itself.
- **That `dash_activity_readback` exists**, unions five ledgers, and was finished 2026-08-22 —
  ⚠️ **it goes with the dashboard zone, but the FUNCTION is retained**, because it is the working
  starting point if this is ever resurfaced.

## 5. OUT OF SCOPE

`TASK-FIX1` and `TASK-FIX2` in full · the `pageRegistry`/`AppLayout` convergence beyond reporting it ·
page-visibility being unwired *(AR3 and AR4 both found hiding a page removes no nav row and
`OpsDashboard` tells the user it does — **report it, its own thread**)*.

## 6. CONSTRAINTS

- **Worktree `wt-fix3`, branch `task/fix3`**, from `origin/main`. ⚠️ **Copy `.env.db` and `.env` in.**
- ⚠️ **`AppLayout.tsx` (2,217 lines, all three nav surfaces) and `pageRegistry.ts` are YOURS ALONE.**
  `TASK-FIX2` owns `Admin.tsx`, `ContactDossierModal.tsx`, `RecordsPage.tsx`. ⚠️ **AR3 warned that
  removing the Leads tab closes the last general door onto the record surface — so FIX2's reach fix
  must land before, or with, your Records change. Coordinate through the orchestrator; do not race.**
- ⚠️ **`mod.*` flags gate rows. Query `org_modules` — do not read a comment about it** (D20).
- **`test:db` red is the baseline.** Lint baseline **48**. ⚠️ **CSS values must be grepped out of the
  BUILT css, not the source** (T1 — arbitrary Tailwind values have silently emitted nothing twice).
- **COMMIT AS YOU GO. DO NOT PUSH.** ⚠️ **TEARDOWN: census pasted.**

## 7. THE TEST THIS MUST PASS

1. **Settings and Modules appear in NONE of the three nav surfaces** — name all three call sites.
2. `/app/ops/settings` and `/app/ops/modules` **still render their contents** (the §1 constraint).
3. Section names read **Management · People · Community · Admin**, on desktop **and mobile** —
   ⚠️ **including the mobile heading that does not exist today.**
4. Calendar and Evaluations are under Management; Calendar has a **registry row**.
5. Contacts and Stable have nav rows on **both** surfaces.
6. **Activity and Oversight are gone from routes, registry, nav and dashboard** — paste the grep.
7. `DocumentIntegrityPanel` is rehomed or deliberately retired. **Say which.**
8. `docs/reference/ACTIVITY-LOG-why-it-has-no-surface.md` exists and carries §4's five points.
9. **No comment survives claiming behaviour the code does not have.**
10. `typecheck`, `typecheck:api`, lint at 48, **and `npm run build`** since CSS changed.
11. **Renders NOT VERIFIED by you** — numbered checklist for the owner.
