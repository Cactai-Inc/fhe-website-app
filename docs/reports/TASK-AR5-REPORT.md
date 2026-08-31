# TASK-AR5-REPORT — the Modules section moves onto the account page, and everything gets a way back

**Method note:** read-only. No code, migration, or data changes. Production DB read via `psql`
(SELECT only, connection string from `.env.db`). No mutation was attempted, so no `BEGIN…ROLLBACK`
was needed. No dev server or browser harness was started for this thread — see the one place that
matters (Finding 1) where that lowers my confidence, flagged explicitly.

---

## 1. ⚠️ URGENT

None. Nothing here is actively harming a user or corrupting data — everything below is dormant
until AR5 is built, except Finding 1, which is a live discrepancy but not a harm (see below).

---

## 2. WHAT THIS AREA IS FOR

A staff member (owner, manager, or employee) comes to the "Modules" surface to reach the barn's
optional operational tools: boarding stalls and agreements, feed/inventory tracking, and the
employee roster and schedule. These are not "settings" — they are day-to-day work surfaces, the
same category as the Records/Calendar pages, just gated behind a per-tenant module flag because a
barn without boarders or without paid staff doesn't need them cluttering the app.

Today a staff member reaches them by opening the account page (the avatar-menu "Account" page,
`/app/account`), scrolling to the last card labelled **Modules**, and clicking through to a second
page that lists three more cards (Boarding, Barn Ops, Employees) before finally landing on the real
work surface. The owner's request removes that middle page: the module cards should sit directly on
the account page, and every page you reach from there should offer a fast way back — either to the
account page itself, or, one level deeper, back to whichever page sent you there.

---

## 3. WHICH ACCOUNT PAGE — ANSWERED, NOT AMBIGUOUS

**`src/pages/app/AccountHub.tsx`, route `/app/account`.** This is not a judgment call between
candidates — the code already answers it. `Admin.tsx` is the client-roster/CRM surface, not an
"account" surface, and was never a candidate on inspection. AccountHub is where the owner already
put the two other staff operational rows this exact shape of request produced:

> Owner, 2026-08-15 (quoted in `AccountHub.tsx:69,158-166`): *"modules and settings... should all be
> inside of the account page... just show them as cards that open the page when clicked."*

That instruction already shipped for **Settings** and **My Stable** (`AccountHub.tsx:169-170`) and,
for **Modules**, shipped as a single link-out row rather than the cards themselves
(`AccountHub.tsx:212`, added same day). AR5's owner sentence on 2026-08-29 is the second half of
that same instruction, now specifically about Modules: put the cards themselves on the account page,
not a link to a page of cards.

**Confirmed staff-only.** The `isStaff` branch at `AccountHub.tsx:167` is where Settings/Stable/
Modules render; a non-staff member never sees this row today and should not see the new cards
either — these are operator surfaces, matching the task doc's own framing.

---

## 4. WHAT "ONTO THE ACCOUNT PAGE" MEANS STRUCTURALLY — cards that link out, one per hub

**Recommendation: replace the single "Modules" `NavRow` (`AccountHub.tsx:211-213`) with one
`NavRow`-style card per live module hub** — Boarding, Barn Ops, Employees (see §6, Finding 2, for
why that's three, not four) — using the exact `NavRow` component already on the page. This is not a
new pattern; it is the same link-out card already used for Settings and My Stable, applied three
more times instead of once.

**Why this honours CR-74 rather than fighting it.** CR-74's settled rule
(`CHANGE-ORDER-LEDGER.md:2047-2085`) is *"do not move someone to see or edit something they are
already looking at"* — modals and expanding cards are for **a record's own fields**; a **page** is
for **a record with more than its fields, the things attached to it**. Boarding, Barn Ops, and
Employees are not records with fields — they are each a multi-page operational area (a hub plus 3,
3, and 2 child pages respectively) with tables, forms, and modals of their own. That is squarely
"more than its fields" territory. An expanding card on the account page could not hold a `DataTable`
of board agreements and a create-modal without becoming the deeper page it's supposed to replace.
**The existing NavRow-to-page pattern is the correct one for this content; the fix is removing an
unnecessary extra hop, not replacing the pattern.**

**What changes, concretely:** the account page goes from 1 module row → 3 module rows (Boarding,
Barn Ops, Employees), each linking straight to its hub (`/app/ops/boarding`, `/app/ops/barnops`,
`/app/ops/employees`). `/app/ops/modules` and its `NavGroupCardsPage` instance become unnecessary
for staff who reach modules from the account page — see §6 Finding 3 for what should happen to that
route.

---

## 5. THE STATE MATRIX

| State | My Profile / Login (unaffected) | The 3 module cards on Account | The module hub + child pages |
|---|---|---|---|
| **member (non-staff)**, any status | full section, unchanged | **never rendered** — `isStaff` gate, `AccountHub.tsx:147,167` | routes are `requireStaff` (`App.tsx:398,402,428-430`); a member hitting the URL directly is bounced by `ProtectedRoute` |
| **staff, module ON** (boarding/barnops/employees all `enabled=true` today — see Finding 2) | — | card renders, links to the hub | hub renders its real content; `ModuleGate` passes |
| **staff, module OFF** *(hypothetical — no tenant has one off today, see Finding 2)* | — | ⚠️ **card still renders today** — `MODULES_GROUP` items only carry `module` for the `visible()` filter (`AppLayout.tsx:624-627`), and that filter is what should also gate the new account-page cards. **Recommendation: reuse the same `hasModule()` check so an off module's card disappears from the account page entirely — no locked card, matching how `/app/ops/modules` behaves today.** | hub page still resolves (route always resolves, D32) but renders `ModuleGate`'s "Module not enabled" fallback (`ModuleGate.tsx:34-45`); no data fetch runs (every hub/child checks `on`/`modules['mod.x']` before its `useEffect`, e.g. `StaffPage.tsx:38`, `BoardingHubPage.tsx:47`) |
| **desktop vs mobile** | unaffected | `AccountHub.tsx` grid is `lg:grid-cols-2`; a card behaves identically at both widths — no special mobile case | back button must render identically on both; no existing per-breakpoint back pattern to diverge from (see Finding 4) |
| **staff account also has `isTrainer`/instructor grants** | unaffected | unaffected — the account-page cards do not depend on `grantKeys`, only `MODULES_GROUP`'s own `adminOnly` (none of the three module rows carry `adminOnly` today) | unaffected |

**Empty-is-not-a-finding check:** Boarding/Barn Ops/Employees are not empty for the live tenant —
`staff_active`/`title`/`pay_type` alone show 2 real rows (§6 Finding 2 evidence). This is a live,
used area, not pre-launch scaffolding.

---

## 6. FINDINGS

### Finding 1 — ⚠️ Settings and Modules already appear as their own sidebar sections today, contradicting the comment that says they don't (medium confidence — static read, not browser-proven)

**What:** `AppLayout.tsx:636-648`'s own comment claims: *"Settings and Modules stay in THIS array
and are filtered out of the SIDEBAR at the render site below — they are not nav rows any more."* I
could not find any such filter. `manageNavGroups()` (`AppLayout.tsx:614-657`) returns all five
groups, including `settings` and `modules`, whenever their `items` are non-empty
(`AppLayout.tsx:648-649`, filtered only by `g.items.length > 0` at line 656) — and both are
non-empty for any staff user (`SETTINGS_GROUP`/`MODULES_GROUP` are static, non-conditional arrays).
**All three render sites that consume `navGroups` map over it with no key exclusion:**
`AppLayout.tsx:1682` (mobile top drawer), `:1935` (desktop pinned staff rail), `:2168` (mobile
bottom sheet). None filters out `g.key === 'settings' || g.key === 'modules'`.

**Evidence:** direct read of `AppLayout.tsx:614-657` and the three render sites named above.
**Not** confirmed by rendering the app — I did not start a dev server or the browser harness for
this. The standard's own case study (`TASK-CONTRACTWALK`) is a report that read a control as
reachable off the source and was wrong, so I'm flagging this explicitly as static-analysis
confidence, not proof.

**Why it matters:** the comment quotes the owner discovering exactly this on 2026-08-15 — *"the
settings and modules sections are still in the nav and they still show pages"* — and the fix that
followed it (*"REVIEW SECTION removed... back to normal,"* `AppLayout.tsx:650-654`) was about the
temporary Review section, a different piece of state. Nothing in the diff history visible from this
file suggests the Settings/Modules-in-sidebar complaint was ever separately fixed. **If this is
still true, then AR5 isn't adding a second entry point when it puts module cards on the account
page — Boarding/Barn Ops/Employees may currently have THREE: the sidebar's own "Modules" heading,
`/app/ops/modules`'s cards, and (soon) the account page.** Removing the stale sidebar section is not
optional cleanup here — it's required for "moves onto the account page" to be true rather than
"gets a third way in."

**Conditions:** true for any `isStaff` user on the current `main` branch, both nav surfaces, as of
2026-08-30. **Recommend the build thread confirm with 30 seconds of manual staff login before
touching this** — cheap to verify, expensive to build around a wrong assumption either way.

### Finding 2 — the registry says 12 rows in `group: 'modules'`; only 11 are real, and only 3 are reachable as a group today

`pageRegistry.ts` (a page-**visibility** settings table, not the runtime nav — see Finding 3) lists
12 rows under `group: 'modules'` (`pageRegistry.ts:181-195`), one more than the task doc's own table
counted — **`barnops.allocation_rules` / "Allocation rules" (`pageRegistry.ts:189`) is real and
live-routed (`App.tsx` — `ops/barnops/allocation-rules`) but isn't in the task doc's table.** Minor,
but worth fixing in the task doc so the next reader doesn't undercount.

Of the 12, **one (`records.hub`) is a dead shell** — see Finding 3. The other 11 are real,
live-routed pages: 3 hubs (Boarding, Barn Ops, Employees) + 8 children (Facilities, Board
agreements, Board charges; Resources, Consumption log, Allocation rules; Staff, Schedule).

**Live `org_modules` state, queried directly (2026-08-30, single tenant in production):**

```
name                        | module_key       | enabled
French Heritage Equestrian  | mod.barnops      | t
French Heritage Equestrian  | mod.boarding     | t
French Heritage Equestrian  | mod.employees    | t
French Heritage Equestrian  | mod.horserecords | t
```

**All four are ON.** There is no module-off state to observe live; the OFF behaviour described in
§5's state matrix is read from `ModuleGate` and each page's own gate check, not observed in
production. `mod.employees` in particular is asserted **disabled** by a comment in
`reviewSection.ts:298` (*"mod.employees is DISABLED for FHE, so this renders ModuleGate's locked
fallback"*) — **that comment is stale and wrong today.** It matters here because that same comment
frames `StaffPage` as effectively unreachable, which is not true: `staff_active`, `title`, and
`pay_type` are set on 2 real profile rows in production right now, confirmed by direct query. This
is exactly the D20 stale-claim shape the task doc warned about, just one level removed — not in
`docs/`, but in a source comment.

### Finding 3 — the "second Records row" the task doc flagged is worse than a collision: one of the two is already a dead shell (name AR3)

`pageRegistry.ts:195` still lists `records.hub` (`/app/ops/records`, `group: 'modules'`,
`module: 'mod.horserecords'`) as a live page-visibility entry. It is not live. `App.tsx:423-425`:

```
ops/records → RECORDS_HUB_RETIRED ? <Navigate to="/app/records/horses" replace /> : <RecordsHubPage/>
```

`RECORDS_HUB_RETIRED` is hardcoded `true` (`RecordsHubPage.tsx:118`) — this route only ever
redirects, into `people.records`'s Horses tab (`/app/records`, `RecordsPage.tsx`, AR3's page). The
runtime nav has already removed Records from `MODULES_GROUP` (`AppLayout.tsx:560-569`'s own comment
records this as a 2026-08-15 TASK-PAGEMERGE decision), so **"Records" has not been part of the live
Modules section since before this task was written.** The only thing still calling it a Modules-group
member is the stale `pageRegistry.ts` row, which exists solely to let an admin toggle its
page-visibility — a toggle for a page that no longer independently exists.

Two of its own children still point at it: `HorsePartiesPage.tsx:345` and `HorseHealthPage.tsx:384`
both `<Link to="/app/ops/records">` as their "back" link — which, today, silently redirects into
`/app/records/horses` rather than back to wherever the staff member actually came from (which is
usually `HorseRecordsPage` embedded in the Horses tab at `/app/records`, `RecordsPage.tsx:121`, but
can also be `ContactDossierModal`). **This is a live, working demonstration of exactly the defect
class requirement (b) exists to fix** — a hardcoded "back" target that happens to often land near
the right place and is wrong whenever the entry point wasn't the one the link assumes.

**Recommendation:** delete the `records.hub` row from `pageRegistry.ts` (an orphaned
page-visibility toggle for a page that redirects unconditionally has nothing left to hide) — this is
squarely a Modules-group hygiene item and safe for AR5 to take. **The `HorseParties`/`HorseHealth`
back-link fix and the redirect's ultimate destination are AR3's territory** (People/Records page
shape) — named per the task doc's own instruction. Do not let AR5's back-button component build
block on that; it's an unrelated page.

### Finding 4 — no shared back-button component exists; 20+ hand-rolled instances, all fixed-target, none history-aware

Grep for `ArrowLeft` usage as a "back" affordance turns up 20 files
(`BackButton`/similar shared component: **zero matches, none exists**). Three representative
samples, verbatim:

| File:line | Target | Label |
|---|---|---|
| `HorsePage.tsx:106-108` | `/app/account` (hardcoded) | "My stable" |
| `ops/DealPage.tsx:150-153` | `/app/records/deals` (hardcoded) | "Deals" |
| `Admin.tsx:906-909` | `setSelectedId(null)` (in-page state, not a route) | "All clients" |

Every instance is a **fixed target**, hand-styled independently (own Tailwind classes, own icon
size). None reads `location.state`, `document.referrer`, or any navigation history. This is CR-37's
finding pattern by name (`CHANGE-ORDER-LEDGER.md:2495-2510`: 33 hand-rolled overlays, 48 hand-built
buttons) applied to a control CR-37 didn't specifically count — **a back button hand-rolled a 21st
time is the same defect class**, which the task doc's own trap #2 predicted.

**None of the 11 live module-group pages has a back control of any kind today** — not even a
fixed-target one. Zero of the three hubs and zero of the 8 children link anywhere except forward
(hub → child). A staff member on `Board agreements` today has no in-UI way back except the browser
button or the sidebar/account page from scratch. This is the owner's complaint, literally true, with
no exceptions in this group.

**Recommendation — one component, two modes, matching requirement (a) vs (b) exactly:**
- Build `<BackLink>` (or similar) as a standalone atom, not gated behind `PageLayout` adoption —
  **none of the 11 pages in scope use `PageLayout`** (confirmed: all 11 hand-roll their own header;
  `PageLayout.tsx` exists and is the shared header wrapper per TASK-ONEHEADER-era work, but its
  adoption elsewhere in the app is low, per prior globalization notes — forcing an 11-page
  `PageLayout` migration as a prerequisite would multiply this task's blast radius for no requirement
  the owner asked for). Also expose it as an optional `back` prop on `PageLayout` itself, so future
  `PageLayout` adopters get it for free — but that's additive, not a dependency.
- **Mode "fixed"** — `<BackLink to="/app/account" label="Account" />` — satisfies requirement (a).
  Every one of the 11 module pages gets this, target is **always the account page**, not their own
  hub. Re-read the owner's sentence: *"a back button... so when the link to it is clicked from the
  account page the user can quickly navigate back to the account page"* — every page in the section,
  hub or child, goes straight back to Account. A child page like Facilities does **not** step back
  to the Boarding hub first; that would be a different (also reasonable) design, but it is not what
  was asked, and building the flatter one is strictly less work.
- **Mode "history"** — `<BackLink history label={fallbackLabel} to={fallbackTo} />` — satisfies
  requirement (b), for pages reached BY CLICKING something inside a module page. See Finding 5 for
  how shallow that set actually is.

### Finding 5 — requirement (b)'s fan-out is almost nonexistent for this group: 2 levels deep, dead end, one exception

Every outbound link from every one of the 11 pages was grepped by hand (not sampled):
`BoardingHubPage.tsx` → 3 children, `BarnopsHubPage.tsx` → 3 children, `EmployeesHubPage.tsx` → 2
children. **None of the 8 children link to anything.** There is no third level. Requirement (b) — "a
page linked to FROM those pages needs a back button to wherever it was clicked from" — has **zero
live instances inside Boarding, Barn Ops, or Employees.** The only pages those three modules ever
send a staff member to are their own hub and their own children, both already covered by
requirement (a)'s fixed target.

**The one place requirement (b) is real is the dead `records.hub`/`HorseParties`/`HorseHealth`
chain in Finding 3 — and that's AR3's page, not this group's.** So for AR5's actual, live scope,
recommend building the "history" mode of `<BackLink>` as a small, generically-useful primitive (a
handful of lines: read `location.state?.from`, fall back to a named default) but **do not spend
build time wiring it across this group specifically** — there's nothing here to wire it to yet. Say
so plainly in the plan so ORCH6 doesn't schedule work against a fan-out that doesn't exist.

### Finding 6 — `Staff` (D20): not retired, live, holds real data TeamPage doesn't

`employees.staff` / `StaffPage.tsx` (183 lines) is a fully separate, fully functional page from
`TeamPage.tsx` (548 lines) — not a stub, not dead code. Both edit rows on the same `profiles` table
but disjoint columns:

| | `StaffPage.tsx` | `TeamPage.tsx` |
|---|---|---|
| reads/writes | `title`, `pay_type`, `staff_active` (`api-employees.ts:112,205-225`) | `is_suspended`, role, invitations (`TeamPage.tsx:67,207,305-308`) |
| live data | **2 profiles** have `staff_active=true` and non-null `title`/`pay_type` (queried directly) | separate suspension/role data, not employment fields |

**D20's ruling — "we either have a staff or a team and we chose team" — has not been carried out.**
`Staff` still has its own nav row (`pageRegistry.ts:192`), its own live route
(`App.tsx:429`), and holds the only copy of two real employment fields for two real people.
Retiring it into Team, as `docs/design/refactor/prior-thread-2026-08-20/02-IA-LAYOUT-TREE.html:126`
already proposed (*"StaffPage retires into Team per D20"*), means Team's create/edit form needs
`title`/`pay_type` fields first, or those two people's employment data has nowhere to go. **This is
a real migration, not a nav-row deletion — flagging it as a dependency, not doing it here** (out of
scope: AR5 moves the Modules section, it doesn't merge Staff into Team). If AR5's build removes the
Employees hub's link to Staff before that migration lands, two people's `title`/`pay_type` becomes
unreachable in the UI while still being read by whatever reports/queries key off it — check for
readers before any nav change here, even though no such removal is being proposed by this report.

### Finding 7 — org_page_visibility does not gate the sidebar or the cards page at all today

`manageNavGroups()`'s `visible()` filter (`AppLayout.tsx:624-627`) checks only `hasModule()` and
`adminOnly`/`grantKeys`. It never consults `pageRegistry.ts`'s hidden-page settings
(`org_page_visibility`). `PAGE_REGISTRY`/`pageKeyForPath` are read only by `lib/api.ts` and
`OpsDashboard.tsx` — neither is in this render path. **Practically: hiding a module page via
Settings → Page visibility today has zero effect on the sidebar, the `/app/ops/modules` cards page,
or (consequently) the new account-page cards this task proposes**, unless something is added to make
it so. This is a pre-existing gap, not something AR5 introduces, but the new cards should match
**current** behaviour (ignore page-visibility, gate only on `hasModule`) rather than silently
becoming the first surface that finally respects it — that's a scope decision, not a bug fix, and
should be named as such if anyone raises it in review.

---

## 7. THE PLAN

Ordered; independent items marked, dependent chains marked.

1. **Build `<BackLink>` as a standalone component** (fixed-target mode only, to start — history mode
   has no live consumer per Finding 5, build it as a thin optional prop on the same component so
   it's one component, not two, but there's no urgency on the history path itself). *Independent of
   everything else; do this first, it unblocks 2 and 3.*
2. **Add the fixed-target `<BackLink to="/app/account">` to all 11 live module-group pages** (3 hubs
   + 8 children). *Depends on 1.*
3. **Confirm Finding 1 with a 30-second manual staff-login check** before touching `AppLayout.tsx`.
   *Independent, cheap, do it early — it decides whether step 4 is "add three cards" or "add three
   cards AND delete a stale sidebar section."*
4. **Replace `AccountHub.tsx`'s single "Modules" `NavRow` with three** (Boarding, Barn Ops,
   Employees), each gated the same way `MODULES_GROUP` already gates them (`hasModule()`).
   *Independent of 1/2 — can land in parallel.*
5. **If Finding 1 confirms:** remove `settings`/`modules` from the sidebar-rendering groups (not from
   `manageNavGroups()`'s return value — `/app/ops/settings` and `/app/ops/modules` still call it by
   key and would blank, per `AppLayout.tsx:641-647`'s own note). This is a 3-line-surface exclusion
   (the two mobile render sites + the desktop pinned rail), not a data-model change. **Coordinate
   with AR4 before touching `AppLayout.tsx`** — AR4 is independently restructuring `SETTINGS_GROUP`,
   `COMMUNITY_GROUP`, and the group array literal in the same function; sequence so one thread's diff
   doesn't silently revert the other's line.
6. **Decide `/app/ops/modules`'s fate** and implement whichever is chosen: (a) redirect it to
   `/app/account` (matches the app's own established idiom for a retired standalone —
   `RECORDS_HUB_RETIRED`, `HORSE_RECORDS_STANDALONE_RETIRED` both redirect rather than 404), or (b)
   leave it resolving as a secondary entry point. **Recommend (a)** — it's the pattern this codebase
   already uses everywhere else for exactly this situation, and there is no other reason to visit that
   URL once its 3 cards exist one hop earlier. *Depends on 4 (need the 3 cards to exist on Account
   before removing the only other way to reach `/app/ops/modules`'s content).*
7. **Delete the stale `records.hub` row from `pageRegistry.ts`.** *Independent — pure cleanup,
   touches only `pageRegistry.ts`, zero runtime behaviour change since nothing reads that row today.*
8. **Fix the task doc's own module-row count** (12 → confirm 12, but note `Allocation rules` was
   missing from the table) — trivial, documentation only.

**Explicitly NOT in this plan** (named so ORCH6 doesn't schedule them here): the Staff/Team merge
(Finding 6, needs a field migration first), the `HorseParties`/`HorseHealth` back-link fix and the
Records collision resolution (Finding 3, AR3's page), page-visibility wiring for the sidebar
(Finding 7, pre-existing, not caused by this task).

---

## 8. TEST CRITERIA

1. Log in as staff (`isStaff=true`, not super-admin). `/app/account` shows three cards labelled
   Boarding, Barn Ops, Employees where the single "Modules" row used to be, in that order, only when
   the corresponding `org_modules.enabled=true`.
2. Toggle any of `mod.boarding`/`mod.barnops`/`mod.employees` off in a test tenant (`BEGIN;
   UPDATE org_modules SET enabled=false ...; ROLLBACK;` for a real check, never against FHE's live
   row) — the corresponding card disappears from `/app/account` entirely; no locked/greyed card.
3. Each of the 3 hub pages and 8 child pages shows a back control top-left, labelled for the account
   page, and clicking it lands on `/app/account` — for every one of the 11, not a sample.
4. Same 11, on a viewport under 768px — the back control is present and tappable (owner's device is
   a phone).
5. If Finding 1 is confirmed true: after the fix, a staff user's sidebar (desktop rail AND mobile
   drawer AND mobile bottom sheet — all three render sites) no longer shows a "Modules" or "Settings"
   heading, while `/app/ops/settings` and `/app/ops/modules` (if kept, see plan item 6) still render
   correctly when visited directly.
6. `/app/ops/modules` either 404s-as-redirect to `/app/account` (if plan item 6a is chosen) or still
   renders its 3 cards (if 6b) — not a blank page either way.
7. `pageRegistry.ts` no longer lists `records.hub`; `test/ui/pagevis_registry.test.ts` (the test that
   fails the build if a `path` stops being a registered route) still passes, confirming no other code
   depended on that key.

---

## 9. SUCCESS, AT TWO LEVELS

**Per fix:**
- The back button ships as one component with two call sites' worth of actual behaviour (fixed +
  history-capable), not an 11th-through-31st hand-rolled copy.
- The account page shows the module cards directly; no intermediate cards-page hop remains in the
  staff journey from Account to a module.
- Nothing that currently resolves stops resolving (D32) — `/app/ops/modules` still answers, whichever
  way plan item 6 is decided.

**For the area as a whole:** a staff member reaches any of the 11 module pages from the account page
in exactly one click past the card, and can return to the account page from any of them in exactly
one click, from anywhere in that group, on a phone or a desktop, without relying on the browser's own
back button. The "Modules" concept exists in exactly one place a person can find it (the account
page), not three.

---

## 10. FLAGGED, NOT FIXED

- **Finding 1** (Settings/Modules already leaking into the sidebar) needs a live confirmation before
  anyone builds against it — flagged for whichever thread touches `AppLayout.tsx` next (this task,
  most likely, per the plan).
- **Finding 3** (the Records collision, and the two horse-detail pages whose "back" link already
  points at a dead redirect) — **route to `TASK-AR3`**, which owns the People/Records page shape.
- **Finding 6** (Staff/Team, D20 unresolved) — not this task's fix; needs a `TeamPage` field
  migration first. Flagging so it isn't lost, not proposing it be done here.
- **Finding 7** (page-visibility not wired to the sidebar/cards at all) — pre-existing, wider than
  this task; naming it so a future globalization/settings pass picks it up rather than rediscovering
  it as new.
- **AR4 overlap** — both AR4 and AR5 need to edit `AppLayout.tsx`'s `manageNavGroups()` region and
  the group array at lines 628-655. See Contended Files.

---

## 11. CONTENDED FILES

- **`src/components/app/AppLayout.tsx`** (2,217 lines) — ⚠️ **shared with AR4.** AR5 needs: the
  `settings`/`modules` group-array entries (`:648-649`) and, if Finding 1 confirms, the three
  render-site maps (`:1682`, `:1935`, `:2168`). AR4 needs: `COMMUNITY_GROUP`, `SETTINGS_GROUP`
  relabeling/dissolution, and the same group-array block. **Both threads touch the exact same
  10-line function (`manageNavGroups`, `:614-657`) — sequence, don't parallelize, on this file.**
- **`src/pages/app/AccountHub.tsx`** — the single "Modules" `NavRow` (`:211-213`) becomes three.
  Not contended with any other AR thread found in this review.
- **`src/App.tsx`** — the `ops/modules` route (`:475-477`), if plan item 6a (redirect) is chosen.
- **`src/lib/pageRegistry.ts`** — delete the `records.hub` row (`:195`). ⚠️ **AR3 also reads/edits
  this file's People-group rows** (`people.records`, `:152`) — different lines, same file, low
  collision risk but worth a heads-up.
- **11 page files, new import + a few lines each, no shared contention found:**
  `pages/app/ops/hubs/{BoardingHubPage,BarnopsHubPage,EmployeesHubPage}.tsx`,
  `pages/app/ops/boarding/{FacilitiesPage,BoardAgreementsPage,BoardChargesPage}.tsx`,
  `pages/app/ops/barnops/{ResourcesPage,ConsumptionLogPage,AllocationRulesPage}.tsx`,
  `pages/app/ops/employees/{StaffPage,SchedulePage}.tsx`.
- **New file** for the shared component (e.g. `src/components/app/BackLink.tsx` or under
  `lib/ops` alongside `ModuleGate` — a build-thread naming decision, not this report's).
- **`src/components/app/PageLayout.tsx`** — optional additive `back` prop, low risk, no known
  contention.

---

## TEARDOWN

No dev server, watcher, or long-lived `psql` session was started — every `psql` invocation in this
thread was a single one-shot command that exited on its own. Process census:

```
$ ps aux | grep -iE "psql|vite|node.*dev" | grep -v grep
(no matching processes)
```

Nothing to kill. Worktree: `~/Downloads/claude-code-repo/wt-ar5`. Branch: `task/ar5`. This report is
the only file changed in this worktree.
