# TASK-AR4 — the nav sections: renames, moves, and the death of Settings

**Verified 2026-08-30. Worktree `wt-ar4`, branch `task/ar4`. Read-only — no code changed.**

---

## 1. ⚠️ URGENT

**The owner has already asked for the Settings and Modules sidebar sections to be removed once, was
told (by a code comment) that it was handled, and it was not — they are both still live, on-screen,
today, in every nav surface a tenant user sees.**

- 2026-08-15, commit `58d47eee`: owner asks that Settings/Modules move onto the Account page as
  cards. Landing pages (`/app/ops/settings`, `/app/ops/modules`) are built. **The sidebar rows were
  never removed** — the commit only reordered them.
- Same day, commit `aa81995a`: the owner is quoted a second time in the code itself —
  *"the settings and modules sections are still in the nav and they still show pages"* — and the
  commit adds a comment claiming this is now handled: *"Settings and Modules stay in THIS array and
  are filtered out of the SIDEBAR at the render site below."*
- **That filter does not exist and never has.** `git log -p` on `AppLayout.tsx` from that commit to
  `HEAD` shows no commit ever added a `g.key !== 'settings'`-shaped filter anywhere in the file.
  `navGroups.map()` — the one array both live nav surfaces render from — includes every group
  `manageNavGroups()` returns, unfiltered, at `AppLayout.tsx:1935` (desktop rail) and
  `AppLayout.tsx:2168` (mobile drawer). Confirmed live: all 6 modules are enabled for FHE
  (`org_modules`, queried directly) and `SETTINGS_GROUP`'s `Team` row has no module/admin gate, so
  neither group can ever filter to empty. **Settings and Modules render as ordinary sidebar sections,
  on both desktop and mobile, for every staff user, right now.**

This is not a finding TASK-AR4 needs to fix — item 8 already asks for Settings to go away, and this
report's plan (§5) does that. It is flagged here because **the exact failure mode this report exists
to prevent already happened once, silently, and was never caught**: a comment asserted a UI change
that the code never made, and nothing since has re-verified it. Whoever builds this task's plan must
re-verify the sidebar is actually clear of Settings/Modules after the fix — not read a comment saying
so.

---

## 2. WHAT THIS AREA IS FOR

The staff sidebar (desktop) and the staff drawer (mobile) are the only way a staff member finds any
of the ~30 operational pages in this app — records, support, payments, community moderation,
tenant configuration, optional modules. It is grouped under headings (Management, People, Community,
Settings, Modules) so the list is scannable rather than one flat 30-row menu. This task is a pure
information-architecture change to those headings and which pages sit under which one — no page's
own content changes.

---

## 3. THE STATE MATRIX

The nav groups in scope here (`management`, `accounts`, `community`→Admin, `settings`, `modules`)
render **only for staff** (`showRail = isStaff`, `AppLayout.tsx:1399`). Members never see them in any
state — this whole task is staff-surface-only.

| State | Desktop rail (`AppLayout.tsx:1935`) | Mobile drawer (`AppLayout.tsx:2168`) |
|---|---|---|
| **Instructor/manager (non-admin)** | Sees Management, People\*, Community, Settings (Team only — Branding/Products/Editor are `adminOnly`), Modules (if `hasModule`). | Same set — `navGroups` is one variable, shared by both render sites. |
| **Admin** | Same groups, full Settings membership (Team + Branding + Products + Editor). | Same. |
| **Super-admin** | `manageNavGroups()` **early-returns** `[{key:'platform', label:'Platform', ...}]` (`AppLayout.tsx:620-623`) — Management/Community/Settings/Modules never appear at all, on either surface. | Same early return; irrelevant to this task. |
| **Rail pinned vs collapsed** (desktop only) | Pinned: heading text visible, expand/collapse per group (`groupOpen`). Collapsed: heading becomes a bare divider with only an `aria-label`, no visible text. | No such state exists on mobile — the drawer always renders every group's items, always expanded (`AppLayout.tsx:2168-2182` has no `groupOpen`/pin check at all). |
| **The App-pages heading specifically** | **Renders as clickable text**, `{APP_PAGES_GROUP.label}` at `AppLayout.tsx:1919`, inside a `<button>` with a chevron. | **Does not render at all.** The mobile block at `AppLayout.tsx:2158-2167` calls `<CommunityNav>` then `<StaffNavItems>` directly, with no heading element, no `{APP_PAGES_GROUP.label}` reference anywhere near it. Confirmed by exhaustive grep — every occurrence of `APP_PAGES_GROUP` in the file is in the desktop-rail block (`1488, 1491, 1495, 1917-1924`); none is near `2158-2167`. |
| **`community`/`settings` group labels on `/app/ops/admin/pages`** | N/A (different page) | N/A — but same on both device widths: `AdminPageVisibilityPage.tsx` renders `pageSections()`'s `section.label`, which comes from `GROUP_LABEL` in `pageRegistry.ts:106-112`, **independently of AppLayout's string literals**. See Finding 1. |
| **Page-visibility hiding (`org_page_visibility`)** | A page toggled "Hidden" on `/app/ops/admin/pages` **stays in the sidebar/drawer regardless.** `hiddenPages`/`isPageHidden` (from `AuthContext`) is never referenced anywhere in `AppLayout.tsx`. Currently 0 rows in `org_page_visibility` (verified via `psql`), so this hasn't produced a visible symptom yet — it will the first time anyone uses the feature. See Finding 2. | Same — one `navGroups` source feeds both. |

\* `accounts`/"People" is currently empty (`ACCOUNTS_GROUP = []`, `AppLayout.tsx:538`) and is dropped
by `manageNavGroups()`'s own `.filter((g) => g.items.length > 0)` — it renders on neither surface
today. Not in this task's scope; noted because AR3 is about to populate it.

---

## 4. FINDINGS

### Finding 1 — ⚠️ Both group-label definitions render. The standing rule that one is dead is wrong.

**What:** `docs/tasks/ADMIN-REVIEW-ANALYSIS-STANDARD.md` §5 states as ground truth: *"`GROUP_LABEL` in
`pageRegistry.ts` is exported and read by NOTHING. The nav's real labels are string literals in
`AppLayout.tsx`."* This task's own doc repeats it: *"Verified: zero readers outside its own file."*
Both are **half right, half wrong**, and every future `TASK-AR*` thread reads that same standing
rule.

**Evidence:**
- `AppLayout.tsx:633-649` (the string-literal `label:` fields inside `manageNavGroups()`) is what
  renders the actual sidebar and drawer headings, at `AppLayout.tsx:1935` and `:2168`. **This part of
  the rule is correct** — it is the primary nav surface and the one with the most users.
- `pageRegistry.ts:106-112` (`GROUP_LABEL`) is read by `pageSections()` (`pageRegistry.ts:272`),
  which is imported and called by `AdminPageVisibilityPage.tsx:201`, whose `Section` component
  renders `section.label` as a visible uppercase heading (`AdminPageVisibilityPage.tsx:128-132`) on
  `/app/ops/admin/pages` — a routed, reachable page (`App.tsx:466`). **`GROUP_LABEL` is not dead.**
  It just renders somewhere other than the sidebar: the section headers on the Page-visibility admin
  screen itself.

**Why it matters:** if this task edits only `AppLayout.tsx`'s string literals (correct for the
sidebar) and treats `pageRegistry.ts`'s `GROUP_LABEL`/`PageGroup` type/`groupOrder` as dead weight to
leave alone, the Page-visibility settings page will keep showing section headers reading "Community"
and "Settings" after the real nav has been renamed to "Admin" and dissolved — a second, independent
desync this task would otherwise leave behind, on the exact admin surface whose whole job is to be
trustworthy about what the nav currently looks like.

**Conditions:** always true, for any staff/admin viewing `/app/ops/admin/pages` — no state-dependence.

**Recommendation:** the ADMIN-REVIEW-ANALYSIS-STANDARD.md §5 bullet should be corrected for the other
five `TASK-AR*` threads reading it; not this report's call to make, flagging for ORCH6.

### Finding 2 — Page-visibility hiding does not touch the sidebar or drawer at all

**What:** `set_page_hidden()` writes `org_page_visibility` and the toggle UI on
`/app/ops/admin/pages` reflects it correctly (`AdminPageVisibilityPage.tsx`), but **no code path
between that table and the rendered nav exists.** `manageNavGroups()`'s signature is
`(hasModule, isAdmin, isSuperAdmin, grantKeys)` — no hidden-pages argument — and its `visible()`
helper (`AppLayout.tsx:624-627`) filters only on `module` and `adminOnly`/`grantKeys`. `hiddenPages`
and `isPageHidden` (exposed by `AuthContext.tsx:39,67,207`) are consumed in exactly two places in the
whole `src/` tree: `AdminPageVisibilityPage.tsx` (the toggle UI itself) and `OpsDashboard.tsx` (a KPI
tile's own hidden/locked badge). **Never in `AppLayout.tsx`.**

**Evidence:** `grep -rn hiddenPages src/` and `grep -rn isPageHidden src/` — 3 and 2 hits total,
neither in the nav file. `org_page_visibility` currently has 0 rows in production (`psql`,
2026-08-30), which is why this has produced no visible symptom yet.

**Why it matters:** this is the flagship D13 surface — *"the owner cannot rearrange his own board
without a thread"* is exactly the complaint D13 exists to prevent, and here the UI **reports
success** (`set_page_hidden` raises on real failure, so the toggle is provably not lying about the
write) while the thing the owner is trying to accomplish — a page not showing in his menu — silently
does not happen. This is `ORCHESTRATOR.md` §3's failure class by the letter, on a surface the owner
will reach for specifically because he was told he could self-serve it.

**Conditions:** true for every page, in every state, not specific to the pages this task moves —
this is a pre-existing, systemic gap the AR4 audit surfaced while establishing what `visible()`
gates on (Q6). Out of this task's fix scope (§8), but too significant to file only as a footnote.

### Finding 3 — Renaming "App pages" to "Community" is a no-op on mobile

**What:** owner item 5 asks to retitle the "App pages" heading to "Community." The desktop rail
renders that heading as visible clickable text (`AppLayout.tsx:1919`, inside the toggle button at
`1917-1921`). **The mobile drawer never renders this heading at all** — `AppLayout.tsx:2158-2167`
calls `<CommunityNav>` then `<StaffNavItems>` with no wrapping label, unlike every other group
rendered via `navGroups.map` at `:2168`, which does get a heading (`:2170-2172`).

**Evidence:** exhaustive grep for `APP_PAGES_GROUP` across the file — every reference is inside the
desktop-rail block (lines 1488, 1491, 1495, 1917, 1919, 1920, 1924); none appears near the mobile
drawer block.

**Why it matters:** a string-only rename of `APP_PAGES_GROUP.label` changes what desktop staff see
and changes **nothing** on mobile, because there is nothing there to change — the label was never
displayed. §5's standard names the owner's working device as a phone. **The fix for item 5 is not a
rename; it requires adding a heading element to the mobile block that does not exist today**, matched
in style to the one the other groups already get at `:2170-2172`.

**Conditions:** always true on the mobile drawer, for every staff role — no state-dependence.

### Finding 4 — dissolving Settings orphans a route, a type, and an Account-page card

**What:** owner item 8 says remove the Settings section. Three things depend on the literal string
`'settings'` surviving as a `manageNavGroups()` key, independent of the sidebar:

1. `NavGroupCardsPage.tsx:23` — `groupKey: 'settings' | 'modules'` is a TypeScript literal union.
   Its body does `manageNavGroups(...).find((g) => g.key === groupKey)` (`:33-34`) and falls back to
   `items = []` → renders `"Nothing here yet."` (`:39`) if the group is gone.
2. `App.tsx:472-474` routes `/app/ops/settings` to `<NavGroupCardsPage groupKey="settings" .../>`.
3. `AccountHub.tsx:170` — `<NavRow icon={Settings} title="Settings" sub="Team, branding, products &
   forms" to="/app/ops/settings" />` — a card on the staff Account page that owner-facing users click
   specifically because it is titled "Settings."

**Why it matters:** if the `'settings'` entry is simply deleted from `manageNavGroups()`'s returned
array (the direct reading of "remove the settings section"), `/app/ops/settings` silently stops
listing anything, while `AccountHub.tsx` keeps advertising it under its old name as a live
destination — a dead end that still looks like a working link. This is the same reachability-vs-code
gap D17 was written about, and this task would be the one creating a fresh instance of it if the plan
stops at the sidebar array.

**Conditions:** true the moment `'settings'` is removed from the groups array, for any staff user who
opens the Account page afterward. Not state-dependent otherwise.

### Finding 5 — the one existing link to Page-visibility will say the wrong section name

**What:** `OpsDashboard.tsx:223` — unconditional prose on the Ops dashboard's "Modules" panel: *"you
can bring its menu entry back under
<Link to="/app/ops/admin/pages">Settings &rarr; Page visibility</Link>."* This is also, per
Finding 2's grep, **one of only two in-app links to `/app/ops/admin/pages` at all** (the other being
`AccountHub.tsx`'s Settings card, one hop further, per Finding 4) — Page-visibility itself has no nav
row in any `NavItem` table despite existing in `pageRegistry.ts` as `settings.page_visibility`
(`:209-213`, `protected: true`). This is the same shape D17 names verbatim — *"a small underlined
text link on a KPI card"* — for the one page whose entire job is being reachable.

**Why it matters:** once Settings dissolves, this text becomes actively wrong (there is no more
"Settings" to point to), and the underlying reachability gap (no real nav row, ever, for the page
that un-hides every other page) predates and outlives this task.

**Conditions:** the label mismatch is created by this task's own fix if `OpsDashboard.tsx:223` is not
updated alongside it; the no-nav-row gap is pre-existing and unconditional.

### Finding 6 — the task doc's own membership count for Settings is short by one row

**What:** this task's own brief (§1) lists Settings' membership as "Branding · Editor · Products ·
Team." `pageRegistry.ts` has **five** `group: 'settings'` entries, not four — the fifth is
`settings.page_visibility` (`:209-213`), the Page-visibility page itself. It is the one `protected:
true` row in the whole registry (cannot be hidden, "brings every other one back").

**Why it matters:** it is not in `SETTINGS_GROUP` in `AppLayout.tsx` (confirmed — no
`/app/ops/admin/pages` reference anywhere in that file, per Finding 5), so it never showed as a
*sidebar* row and the task doc's nav-membership list is correct for what the owner has been looking
at. But it IS one of the five `pageRegistry.ts` rows whose `group` field reads `'settings'`, and
Finding 1 already established that field renders (on `/app/ops/admin/pages` itself, via
`pageSections()`). **Whoever reassigns `settings.*` entries to Admin must move all five, or the page
that lists "every page in the staff menu" mis-files its own listing about itself.**

**Conditions:** always true — a data-model fact, not state-dependent.

---

## 5. THE PLAN

Ordered as the task doc requires: **Community → Admin must land before App-pages → Community**, or
there are briefly two sections named "Community." Grouped into slices; independence noted per slice.

**Slice A — Community becomes Admin.** *(must land first; nothing else depends on it landing first,
so it can be built independently of B–E, but B cannot start before A finishes)*
1. `AppLayout.tsx:635` — `label: 'Community'` → `label: 'Admin'` (the `key: 'community'` string can
   stay as-is; it is never shown to a user — `g.key` is used only as a React key and in
   `toggleGroup`/`groupOpen` lookups, never rendered. Renaming it too is a pure-clarity refactor with
   no stored-data impact, since `PageGroup` values never appear inside a stored `page_key` — flagging
   as optional, not required by the owner's literal ask).
2. `pageRegistry.ts:106-112` — `GROUP_LABEL.community` → `'Admin'` (Finding 1: this is not dead code,
   it renders on `/app/ops/admin/pages`).

**Slice B — App pages becomes Community.** *(depends on A; the mobile-heading gap is a hard
prerequisite, not optional, per Finding 3)*
3. `AppLayout.tsx:1488` — `APP_PAGES_GROUP.label`: `'App pages'` → `'Community'`.
4. `AppLayout.tsx:2158-2167` — **add a heading element** to the mobile drawer's App-pages block,
   matching the style the other groups get at `:2170-2172` (`{APP_PAGES_GROUP.label}` in a `div`).
   Without this, item 5's rename is invisible on the owner's own device.

**Slice C — Calendar moves from App pages into Management.** *(independent of A/B/D/E — can build in
parallel; only needs to land before/with Slice E's registry sweep if both touch `pageRegistry.ts` in
the same PR)*
5. `AppLayout.tsx:1128` — remove the `<RailLink to="/app/calendar" .../>` line from `StaffNavItems`.
6. `AppLayout.tsx:491-526` (`MANAGEMENT_GROUP`) — add `{ to: '/app/calendar', label: 'Calendar', icon:
   CalendarDays }` (icon already imported, line 7).
7. `pageRegistry.ts` — add a new entry, e.g. `{ key: 'mgmt.calendar', path: '/app/calendar', label:
   'Calendar', group: 'management' }`, closing the D17 gap this task's own doc names — Calendar
   becomes a registry-driven row instead of hand-written JSX, for the first time.
8. **Do not touch Catalog.** The owner asked to move Calendar only. Report (§8) that Catalog is in
   the identical hand-written block with the identical missing-registry-row problem, and is now the
   only page left in that shape once Calendar moves.

**Slice D — Evaluations moves from Community(Admin) into Management.** *(independent of A–C; touches
one line in each of two files)*
9. `AppLayout.tsx:544` — remove `{ to: '/app/ops/evaluations', label: 'Evaluations', icon: FileText }`
   from `COMMUNITY_GROUP`.
10. `AppLayout.tsx:491-526` (`MANAGEMENT_GROUP`) — add it there instead (icon already imported).
11. `pageRegistry.ts:156` — `community.evaluations`'s `group: 'community'` → `group: 'management'`.

**Slice E — Settings dissolves into Admin.** *(depends on A landing first — the destination must be
named Admin before pages move into it; must land together as one slice, not split, because 12-16
below all reference the same disappearing group key)*
12. `AppLayout.tsx:648` — delete the `{ key: 'settings', ... }` entry from `manageNavGroups()`'s
    returned array.
13. `AppLayout.tsx:542-553` (now-`Admin`'s array, formerly `COMMUNITY_GROUP`) — append the four
    `SETTINGS_GROUP` items (Team, Branding, Products, Editor) from `:596-603`.
14. `pageRegistry.ts:198-213` — all **five** `group: 'settings'` entries (Finding 6, including
    `settings.page_visibility`) → `group: 'community'` (or `'admin'` if Slice A's optional rename is
    taken).
15. `pageRegistry.ts:268` (`pageSections()`'s `groupOrder`) — drop `'settings'` from the array.
16. **Resolve Finding 4 before shipping this slice** — `NavGroupCardsPage.tsx:23`'s `groupKey:
    'settings' | 'modules'` union, `App.tsx:472-474`'s `/app/ops/settings` route, and
    `AccountHub.tsx:170`'s "Settings" card all need an explicit decision (retire the route +
    card entirely, since its contents now live in Admin's sidebar section and card grid would just
    read "Nothing here yet."; or repoint the card to wherever Admin's own account-page presence ends
    up, if AR5's parallel work gives Admin one). **Flagged, not decided — see §8.**
17. `OpsDashboard.tsx:223` — update "Settings → Page visibility" to name the new location.

---

## 6. TEST CRITERIA

1. Desktop rail (staff, admin role): heading reads "Admin" where "Community" was, contains
   Activity/Moderation/Field options/Content store/Oversight/Branding/Editor/Products/Team; no
   heading reads "Settings" anywhere in the rail.
2. Mobile drawer, same role: same membership under a heading reading "Admin"; **and** a heading
   reading "Community" is visible above Calendar/Catalog/Messages — proven by screenshot or DOM
   query, not by reading the JSX, per Finding 3.
3. `AppLayout.tsx:1128`'s removal is proven by Calendar **not** appearing in `StaffNavItems`'s
   rendered output, and appearing instead inside the Management group, on both surfaces.
4. `pageSections()` on `/app/ops/admin/pages` shows a section headed "Admin" containing all nine
   pages from test 1 **plus Page visibility itself** (Finding 6); no section headed "Settings"
   remains anywhere on that page.
5. `/app/ops/settings` and the Account page's "Settings" card: prove whichever resolution Slice E
   step 16 settles on — either both are gone with no dangling link, or both point somewhere real.
6. `OpsDashboard.tsx`'s Modules panel names the correct destination for restoring a hidden page.
7. A non-admin instructor's rail/drawer: Team appears (no gate), Branding/Products/Editor do not
   (adminOnly, per `visible()` at `AppLayout.tsx:624-627`) — same gating behaviour survives the move,
   proven for at least one instructor account.
8. `test/ui/pagevis_registry.test.ts` still passes (it fails the build if any `pageRegistry.ts` `path`
   stops being a registered route — the new `mgmt.calendar` entry must point at a route that exists).

---

## 7. SUCCESS, AT TWO LEVELS

**Per fix:** each of Slices A–E is done when its own test-criteria items pass on **both** the desktop
rail and the mobile drawer, proven by rendering the page, not by reading the diff.

**For the area as a whole:** a staff user, on a phone, can find every page that used to live under
Settings or the old Community heading, under a section now called Admin; Calendar sits under
Management instead of an unlabeled block; no sidebar or drawer section is named Settings; the
Page-visibility settings surface's own section headers match what the sidebar actually shows; and no
link anywhere in the app (Account page, Ops dashboard) still calls a section "Settings."

---

## 8. FLAGGED, NOT FIXED

- **Finding 2 (page-visibility hiding does not filter the nav at all)** — systemic, pre-existing,
  affects every page in the registry, not just the ones this task moves. Real work, not a one-line
  fix (the nav-building call chain needs a `hiddenPages`/`isPageHidden` argument threaded through
  `manageNavGroups()` and both render sites). Belongs to ORCH6 to schedule as its own thread.
- **Team's placement (task doc Q4)** — Admin (post-dissolution) holds Activity, Moderation, Field
  options, Content store, Oversight, Branding, Editor, Products **and Team**. The `SETTINGS_GROUP`
  comment at `AppLayout.tsx:573` already records the owner calling Team's home *"a business
  configuration activity"* (2026-08-12), which is in some tension with D20's later framing (2026-08-18)
  of Team as *"the one roster of the people who work here."* D20 itself never revisited nav-group
  placement — it settled a duplicate-page merge (StaffPage into TeamPage), not where Team sits in the
  sidebar. **Reporting the tension per the task's instruction; not deciding it.**
- **Catalog (Finding, Slice C step 8)** — same hand-written-JSX, no-registry-row shape as Calendar had
  before this task. Not touched, per the owner's item 5 naming only Calendar. Candidate for a
  follow-up once this task's pattern (Slice C) exists to copy.
- **Finding 4's resolution (retire vs. repoint `/app/ops/settings` and its Account-page card)** — a
  real product decision (does Admin get its own Account-page card grid the way Settings/Modules do
  today?), adjacent to **`TASK-AR5`**, which is already doing the equivalent move for the Modules
  group onto the Account page with back-buttons. Naming AR5 so ORCH6 can route whichever thread builds
  Slice E to coordinate with whatever AR5 lands.
- **Item 7 (merging Activity and Oversight) is `TASK-AR6`.** Both rows are inside the section this
  report renames. Not evaluated here, per this task's own out-of-scope list.
- **AR3** is about to populate the currently-empty `ACCOUNTS_GROUP` ("People") with Contacts/My
  Stable rows — no overlap with this task's edited lines, but shares `AppLayout.tsx`'s
  `manageNavGroups()` region closely enough that build order matters (see §9).
- **The GROUP_LABEL standing-rule correction (Finding 1)** — `docs/tasks/ADMIN-REVIEW-ANALYSIS-
  STANDARD.md` §5 asserts `GROUP_LABEL` is read by nothing; it is read by `pageSections()`, consumed
  by `AdminPageVisibilityPage.tsx`. Every other `TASK-AR*` thread reads that same standing rule as
  ground truth. Flagging for ORCH6 to correct the standard doc itself.

---

## 9. CONTENDED FILES

| File | What this task needs to change | Shared with |
|---|---|---|
| `src/components/app/AppLayout.tsx` | `manageNavGroups()` and its five group arrays (`:491-657`), `APP_PAGES_GROUP` + `StaffNavItems` (`:1124-1133, 1488`), the mobile drawer's App-pages block (`:2158-2167`) | **AR3** (populating `ACCOUNTS_GROUP`, same `manageNavGroups()` region) · **AR5** (removing `MODULES_GROUP` from the same array entirely) — both AR3 and AR5 will conflict line-for-line with this task's edits to `manageNavGroups()`'s returned array (`:628-655`) if built concurrently. |
| `src/lib/pageRegistry.ts` | `GROUP_LABEL` (`:106-112`), `PageGroup` type (`:54`), every `group: 'community'`/`group: 'settings'` `PageEntry` (11 rows total: 6 community + 5 settings), `groupOrder` in `pageSections()` (`:268`), new `mgmt.calendar` entry | **AR1** (calendar reachability — same registry gap, different fix), **AR3**/**AR5** (both add/move `PageEntry` rows in the same file) |
| `src/pages/app/ops/NavGroupCardsPage.tsx` | `groupKey: 'settings' \| 'modules'` union type, if Slice E step 16 retires the `'settings'` key | **AR5** (doing the equivalent removal for `'modules'` — likely wants to edit this same union at the same time) |
| `src/App.tsx` | `/app/ops/settings` route (`:472-474`) — retire or repoint | **AR5** (same file, `/app/ops/modules` route immediately below) |
| `src/pages/app/AccountHub.tsx` | the "Settings" `NavRow` (`:170`) — retire or repoint | **AR5** (the "Modules" `NavRow` two lines below, `:212`, is its exact analogue) |
| `src/pages/app/ops/OpsDashboard.tsx` | one line of prose (`:223`) naming "Settings → Page visibility" | none known |

**Sequencing implication for ORCH6:** this task and **AR5** touch the *same lines* of
`manageNavGroups()`'s returned array (AR4 deletes the `settings` entry at `:648`; AR5 deletes the
`modules` entry at `:649`, immediately below it) and the same three-file pattern
(`NavGroupCardsPage.tsx` / `App.tsx` / `AccountHub.tsx`) for the twin surface each is retiring.
**Building AR4 and AR5 as one combined PR, or landing one fully before the other starts, avoids a
guaranteed merge conflict in all four files.** AR3 is lower-risk — it only adds to a currently-empty
array — but still touches the same array literal, so sequencing after AR4/AR5's edits land is safer
than parallel.

---

## TEARDOWN

No dev server, watcher, or long-lived `psql` session was left running — every `psql` invocation in
this session was a single non-interactive `-c` query against production, read-only (`SELECT`), and
exited immediately. Process census:

```
$ ps aux | grep -i "psql\|vite\|node.*dev" | grep -v grep
(no matching processes)
```

Nothing to kill.
