# TASK-AR3 — REPORT: the Records page becomes Contacts, and horses go to My Stable

**Thread:** TASK-AR3 · read-only research · worktree `wt-ar3`, branch `task/ar3`
**Written:** 2026-08-30 · **Verified against:** `origin/main` @ `bb49e713`, production DB
`lrstswfxfsezdmvkvukc`
**Owner items answered:** 3 (Leads/Clients/Partners/Vendors → a page called Contacts, with nav rows)
and 4 (horses → My Stable, with nav rows).
**Brief revision honoured:** `TASK-AR3` §3 as amended 2026-08-30 (`55fe51f1`) — **the CR-30 collision
is resolved and is not treated as open anywhere in this report.** Leads go on Contacts. The plan is
built to be judged, not to be permanent; see §5's opening.

⚠️ **Nothing was changed. No code, no migration, no data write.** Every DB probe below ran inside
`BEGIN; … ROLLBACK;` under `SET LOCAL role authenticated` impersonating the tenant admin
(`hello@fhequestrian.com`, `fdbdfe89-…`), or was a plain `SELECT`. Pamela Godde's live lease was
never touched.

---

## 1. ⚠️ URGENT

**One item. No data is at risk and nothing is corrupting — but it is live today, it is on the
surface this task owns, and two real prospective customers are sitting behind it right now.**

### ⚠️ U1 — the dashboard's "People waiting" link sends staff to a list the person is not on

The owner dashboard's C4 zone (`dash_people_waiting()`) currently holds **two real inbound
enquiries**: Rachel Page (22 Aug) and Casey Caddell (28 Aug). Each card's **Open** link is built by
`contactHref()` — `src/lib/dashboard/registry.ts:176-178` — which returns
`/app/records/clients?open=<contact_id>`.

**Both are `contact_type = 'LEAD'`, and the Clients tab is fed by `admin_client_accounts()`, which
returns only the 24 `CONTACT` rows.** The `?open=` handler (`src/pages/app/Admin.tsx:725-732`) only
isolates a row when the id is already in that list — otherwise it silently does nothing. So the
click lands on a grid of 24 clients with the person you clicked nowhere in it, and **no error, no
empty state, no hint that you are on the wrong tab.**

Proven (impersonating the tenant admin, rolled back):

```
                  id                  | first_name | last_name | contact_type | on_clients_tab | on_leads_tab
--------------------------------------+------------+-----------+--------------+----------------+--------------
 28712509-a2d0-4ad3-a58f-0ec1bff39201 | Rachel     | Page      | LEAD         | f              | t
 1d88cfc6-c2f0-4f4e-80f0-6db68e14ea0a | Casey      | Caddell   | LEAD         | f              | t
```

**Conditions under which it is true:** every dashboard "People waiting" row of kind `inquiry` (the
`default:` branch at `TrainerZones.tsx:231`, and the inline `Open` link at `:296`) whose
`contact_id` is a lead. That is **both rows currently on the board**, and it is the normal state —
a person waiting on a reply is by definition not yet a client. It is also true of `EvaluationsZone`
(`TrainerZones.tsx:423`) and `BusinessZones.tsx:156` for any lead-typed contact.

**Why it belongs here rather than to the dashboard thread:** the fix is the same fix as item 3. One
Contacts surface that holds all four types makes `contactHref()` correct by construction. And the
surviving half of CR-30 — *"a lead can be both a row on Contacts and an item that surfaces on the
dashboard"* — **requires this link to work**, whichever shape wins. Reported, not fixed.

---

## 2. WHAT THIS AREA IS FOR

**Two jobs are living in one page today.**

The first is *"who are the people we deal with, and what is going on with each of them."* Somebody
opens it to find a person — a rider who enquired last week, a client whose paperwork is stuck, the
farrier's number — read what is true about them, change something, or start something. That is what
the owner is calling **Contacts**.

The second is *"what horses are here, and what does each one need."* Somebody opens it to check a
horse's details, see who owns or leases it, fix a wrong breed, attach it to a lease, or add a new
one. That is what the owner is calling **My Stable**.

The Records page also currently carries four **ledgers** — lessons, documents, files and deals —
which are neither of those two jobs. They are "show me everything of this kind that has ever
happened." They were folded in on 2026-08-15 for a stated reason (*"lessons… is really a records
ledger"*), and when the page splits in two, they have nowhere to be. **Section 4, F6 says where each
one goes; none of them may be left where they are, because after the split there is no "there".**

---

## 3. THE STATE MATRIX

**How to read this: each cell says what the person actually sees, and the condition that makes it
so.** Empty-because-pre-launch is never listed as a defect (§5 of the standard); where a count is
given it is there because the *scoping* is wrong, not the volume.

### 3.1 Who can reach the Records page at all

| State | `/app/records` | The nav row | Conditions |
|---|---|---|---|
| **Anonymous** | redirected to sign-in | none | `ProtectedRoute` (`App.tsx:311-312`) |
| **Member (client), any stage** | **403 / bounce** | none | `requireStaff` — members never see this page in any state |
| **Staff — EMPLOYEE / MANAGER** | ✅ all tabs **except Archived** | ✅ "Records" | `TABS.filter(t => !t.adminOnly || isAdmin)` — `RecordsPage.tsx:80` |
| **Staff — ADMIN** (both real owner logins) | ✅ all ten tabs | ✅ "Records" | — |
| **SUPER_ADMIN** (`admin@cactai.io`) | route resolves | ❌ **no nav row at all** | `manageNavGroups` returns only `PLATFORM_NAV` for superadmin (`AppLayout.tsx:620-623`) |
| **Desktop, rail pinned** | ✅ | ✅ labelled | `AppLayout.tsx:1935` |
| **Desktop, rail collapsed (56px)** | ✅ | icon only (`BookOpen`), label on 1100ms hover | `RailLink` `open=false` |
| **Mobile (drawer)** | ✅ | ✅ same row, same source | `AppLayout.tsx:2168` — the drawer maps the **same** `navGroups` array, so a row added once appears on both |
| **Tenant that hid the page** in Settings → Page visibility | ✅ still shown | ✅ **still shown** | ⚠️ **see F2 — hiding does nothing to the nav** |

### 3.2 What each tab shows, per state — measured on production

| Tab | Renderer | Source | Live rows | Renders for | ⚠️ State-dependent behaviour |
|---|---|---|---|---|---|
| **Leads** | `ContactDirectory mode="leads"` | `staff_contact_directory()` filtered `contact_type='LEAD'` | **5** | all staff | Origin/Channel filter selects render **only** on this tab (`ContactsPage.tsx:372-385`); default sort flips to Newest |
| **Clients** | `Admin` (a different component entirely) | `admin_client_accounts()` | **24** | all staff | ⚠️ Card→isolate, not a modal and not an expanding row. The nine account tabs need `user_id`; **7 of 24 have a login**, so 17 people get no tabs (CR-80) |
| **Partners** | `ContactDirectory mode="partners"` | same RPC, `='PARTNER'` | **0** | all staff | identical to Leads minus the two filter selects |
| **Vendors** | `ContactDirectory mode="vendors"` | same RPC, `='VENDOR'` | **0** | all staff | identical to Partners |
| **Horses** | `HorseRecordsPage` | `staff_horse_records()` | **3** | all staff | ⚠️ **not** module-gated, unlike every other `mod.horserecords` surface. Owner/lessee names are clickable **only** because `RecordsPage` passes `onOpenContact`; on any other mount they are plain text (`HorseRecordsPage.tsx:221-228`) |
| **Lessons** | `LessonsHubPage` | `lessons_summary()` | n/a | all staff | Tab is **not** module-gated but the page is: a `mod.lessons`-off tenant sees a tab that renders a "locked" card |
| **Documents** | `DocumentsQueuePage` | `listDocuments()` | — | all staff | ⚠️ renders eyebrow **"Ops"** and its own `<Helmet><title>Documents — Work queue</title>` inside a page called Records |
| **Files** | `FilesRecordsPage` | `files` via `files_staff_rw` RLS | — | all staff | ⚠️ **no heading of any kind**, and **this tab is its only mount in the entire app** |
| **Deals** | `DealsPage` | deals | — | all staff | — |
| **Archived** | `ArchivedAccountsPage` | `archived_contacts()` | 0 archived today | **ADMIN only** | ⚠️ **this tab is its only mount**, and only one link in the app points at it |

### 3.3 "My Stable" — the same surface across four viewers

| Viewer | Door | What it shows | Conditions |
|---|---|---|---|
| **Member, presence.stable true** | sidebar row "My Stable" → `/app/stable` | their own horses + gear + supplies | `PresenceLink`, `AppLayout.tsx:1093-1099` — inside `ClientNavItems`, which renders **only when `!showRail`** |
| **Member, Account page** | `/app/account` → "My Stable" row expands inline | same `StableSection` | `AccountHub.tsx:197-198` |
| **Staff, sidebar** | ❌ **nothing** | — | `useNavPresence(!isStaff)` (`AppLayout.tsx:1234`) — presence is never even fetched for staff, and `ClientNavItems` is not rendered for them |
| **Staff, Account page** | `/app/account` → **"My Stable — The business's horses, gear, and supplies"** → `/app/stable` | ⚠️ **zero of the tenant's three horses** | `AccountHub.tsx:169`. See **F3** — proven below |
| **Staff, mobile** | same Account-page row; drawer has no My Stable | as above | `StaffNavItems` (`AppLayout.tsx:1124-1133`) carries only Calendar, Catalog, Messages |

---

## 4. FINDINGS

Each finding states the claim, the evidence, why it matters, and **the conditions under which it is
true**.

---

### F1 — ⚠️ THE CONTACTS/MY-STABLE ROWS CANNOT BE ADDED IN ONE PLACE. THE NAV IS TWO DISCONNECTED TABLES OF THE SAME FACT.

**What.** There is no single place to "add a nav link". A staff nav row is defined **twice**, in two
files that do not import each other, and they have already drifted.

**Evidence.**
- The **real** nav is five hand-written `NavItem[]` arrays in `src/components/app/AppLayout.tsx`
  (`MANAGEMENT_GROUP:491`, `ACCOUNTS_GROUP:538`, `COMMUNITY_GROUP:542`, `MODULES_GROUP:554`,
  `SETTINGS_GROUP:572`), assembled by `manageNavGroups()` at `:614-657`.
- The **registry** is `PAGE_REGISTRY` in `src/lib/pageRegistry.ts:129-214`, whose header claims it
  lists *"EVERY staff page with a nav row of its own, in nav order."*
- **`AppLayout.tsx` does not import `pageRegistry.ts` at all.** Verified: the registry's only
  runtime readers are `OpsDashboard.tsx` and `AdminPageVisibilityPage.tsx`.
- **Drift already present, 14 of 25 registry rows:**

  | Registry row | Registry says | The nav actually does |
  |---|---|---|
  | `people.records` | `group: 'accounts'` (§labelled "People") | row lives in `MANAGEMENT_GROUP` (`AppLayout.tsx:514`) |
  | `lessons.hub`, `lessons.plans`, `lessons.credits` | `group: 'management'` | **no nav row exists** |
  | `boarding.facilities/agreements/charges` | `group: 'modules'` | **no nav rows** |
  | `barnops.resources/consumption/allocation_rules` | `group: 'modules'` | **no nav rows** |
  | `employees.staff`, `employees.schedule` | `group: 'modules'` | **no nav rows** |
  | `records.hub` | `group: 'modules'` | **no nav row** (removed `AppLayout.tsx:560-569`) |
  | `settings.page_visibility` | `group: 'settings'`, `protected: true` | **no nav row** — the one page that cannot be hidden is itself not in the nav or on `/app/ops/settings`'s card grid |

**Why it matters.** Items 3 and 4 are *"add a nav link in the sidebar nav on desktop and in the
mobile menu."* Editing only `pageRegistry.ts` produces **nothing on screen** — the exact silent-no-op
class `ORCHESTRATOR.md` §3 catalogues. Editing only `AppLayout.tsx` produces a nav row the tenant
cannot manage. **Both files must change, in the same commit.**

**Conditions.** Always true, every role, both surfaces. The good news is stated in F1b.

### F1b — the desktop rail and the mobile drawer are already one source. Add a row once and both get it.

**Evidence.** `AppLayout.tsx:1935` (rail) and `AppLayout.tsx:2168` (drawer) both render
`{navGroups.map(g => …)}` over the identical array built at `:1476-1481`.

**Why it matters.** The owner asked twice, once per surface. **It is one edit, not two** — provided
the row goes into a `NavItem[]` group and not into the hand-written `StaffNavItems` block
(`:1124-1133`), which the drawer renders separately and which is where Calendar/Catalog/Messages
live.

---

### F2 — Settings → Page visibility hides nothing. The nav never reads it.

**What.** `org_page_visibility` is written, stored and displayed, and **no nav surface consumes it**.

**Evidence.** `hiddenPages` / `isPageHidden` exist on `AuthContext` (`:39-40, 67, 207, 226-227`) and
have exactly **two** readers in `src/`: `AdminPageVisibilityPage.tsx:165` (the editor itself) and
`OpsDashboard.tsx:176,229` (the module tile's "Hidden" badge). `manageNavGroups()`'s filter is
`(!i.module || hasModule(i.module)) && (!i.adminOnly || isAdmin || grantKeys.includes(i.to))` —
`AppLayout.tsx:624-627`. **No visibility term.** `NavItem` (`:397-408`) has no `key` field, so there
is nothing to match a registry key against even if it wanted to.

`OpsDashboard.tsx` tells the user otherwise, in prose: *"you can bring its menu entry back under
Settings → Page visibility."*

**Why it matters.** Adding registry rows for Contacts and My Stable implies they are hideable. They
will not be. And `pageRegistry.ts`'s own header states a design (*"The NAV ENTRY goes. That is all"*)
and a safety rule (*"no-cascade is only safe BECAUSE the children are in the nav"*) that are both
false against the code.

**Conditions.** Always. **Not yet observable in production** — `select * from org_page_visibility`
returns 0 rows, so no tenant has tried. It will surface the first time the owner hides anything.

---

### F3 — ⚠️ "My Stable", the surface staff can reach today, shows NONE of the tenant's horses. Moving horses onto it as-is is a regression from 3 to 0.

**What.** A staff "My Stable" already exists, is already named that, and is already reachable — but
it is scoped to horses the **company contact** owns or leases, not to the tenant's roster.

**Evidence — the door.** `AccountHub.tsx:167-170`:
```
{isStaff && (
  <NavRow icon={Boxes} title="My Stable" sub="The business's horses, gear, and supplies" to="/app/stable" />
```
with a comment saying it exists *"for the same reason it was unreachable for staff before today:
useNavPresence… is disabled entirely for staff… so this was the only door."*

**Evidence — the scope.** `my_stable_horses()` (live body read from `pg_proc`) resolves
`v_scope := company_contact_id()` for staff and filters
`current_owner_contact_id = v_scope OR lessee_contact_id = v_scope OR <active horse_relationships row>`.
`staff_horse_records()` returns every non-deleted horse in the org.

**Proven** (as the tenant admin, `BEGIN … ROLLBACK`):

```
 my_stable_horses(default/staff) | 0
 my_stable_horses(true)          | 0
 my_stable_horses(false)         | 0
 staff_horse_records             | 3
```

The company contact is `352c3898-…` (French Heritage Equestrian). None of Tiz Love, Sundance or
Secret Tattoo is owned or leased by it.

**Why it matters.** ⚠️ **This is not "empty is not a finding."** The two populations are different
*by design*, and the gap widens as the barn grows: My Stable is *"horses the business itself owns"*;
the Horses tab is *"every horse here."* Executing item 4 literally — pointing the horse roster at
the existing `/app/stable` — hands the owner a page that is correct-looking and blank.

**Conditions.** True for every staff user, on desktop and mobile, in both company and personal
voice, today and for as long as the barn's horses are client-owned. It flips only for a horse the
company itself buys.

---

### F4 — Partners and Vendors carry NOTHING that Leads does not. They are one component with one filter.

**What.** Question 5, answered: yes, they are the same surface.

**Evidence.** `LeadsPage`, `PartnersPage` and `VendorsPage` are three one-line wrappers around a
single component — `ContactsPage.tsx:669-688`:
```
export function VendorsPage()  { return <ContactDirectory mode="vendors" />; }
export function PartnersPage() { return <ContactDirectory mode="partners" />; }
export function LeadsPage()    { return <ContactDirectory mode="leads" />; }
```
`mode` changes exactly four things, and nothing else in 500 lines:

| | Leads | Partners | Vendors |
|---|---|---|---|
| `contact_type` filter (`MODE_TYPE:49-52`) | `LEAD` | `PARTNER` | `VENDOR` |
| Title / blurb / "+ new" label (`MODE_COPY:54-85`) | differ | differ | differ |
| Default sort (`:181`) | **Newest** | A–Z | A–Z |
| Origin + Channel selects (`:372-385`) | **yes** | no | no |

Same card grid, same quick-view modal, same filing chips, same dossier, same archive flow, same
columns, same document handling — **there is none; no tab has document requirements of its own.**
Live counts: Leads 5, Partners 0, Vendors 0.

**Why it matters.** Three tabs and a fourth (Clients) on a page called Contacts, where the only real
distinction is one stored column, is the "3 horse rosters / 3 lead lists" failure in miniature. **The
owner already ruled the other way**, 2026-08-12, quoted in `RecordsPage.tsx`'s own header:
> *"directories are collections of contacts … vendors, partners, clients/customers and leads are
> specific types of designations applied to contacts"*

**Conditions.** Always. Note the corollary: `BUSINESS_FILTERS` (Counterparties / Horse owners /
Lessees) is gated to `mode === 'contacts'` (`:267`), which **no live route uses** — it renders only
on the admin-only review mount `/app/ops/review/contacts`. That filter row is dead on every tab the
owner can reach.

---

### F5 — the four person-tabs use THREE different list idioms, and none of them is the one the owner ruled for.

**What.** Whatever "Contacts" becomes has to host CR-75's expanding row. Today it would inherit
three incompatible patterns.

**Evidence.**

| Surface | Pattern | Where |
|---|---|---|
| Leads / Partners / Vendors | **card grid** → quick-view **modal** → *"Open full record"* → **a second modal** (`ContactDossierModal`) | `ContactsPage.tsx:417`, `:464`, `:454` |
| Clients | **card grid** → **isolate in place** (the other cards vanish, the record renders where the list was, nine sub-tabs appear) | `Admin.tsx:894`, `:906` |
| Horses | **condensed rows** → **expand in place, editable** | `HorseRecordsPage.tsx:345-377` |

CR-74 (🔒 owner ruling, 2026-08-25) names the third one as the asset:
> *"if i click on the horse records tab on the records page the list of horses as rows works really
> well… its bug free and works great… an expanded card with editable fields is perfectly the right
> choice"*

CR-75 extends it to clients: *"im ok with switching to condensed rows with client names and clicking
it expands the row."*

**⚠️ THE ASSET, IDENTIFIED PRECISELY** — this is the thing that must survive item 4:
`EditableRecord` at **`src/pages/app/ops/HorseRecordsPage.tsx:29-312`**, plus its list shell at
**`:345-378`** (the `openId === r.id` toggle on a full-width header button). It has **one
dependency on where it is mounted**: the optional `onOpenContact` prop. When it is absent, owner and
lessee stop being clickable and render as plain text (`:221-228`, `:254-261`). `RecordsPage.tsx:121`
is the only caller that supplies it.

**Why it matters.** Move `HorseRecordsPage` without carrying `onOpenContact` and its wiring
(`RecordsPage.tsx:111, 128-130` — the `ContactDossierModal` mounted one level above the tab) and the
owner loses *"a horse links to its people… without leaving the page"* on the exact surface he
praised.

**Conditions.** Always, on every mount other than `RecordsPage`.

---

### F6 — the other six tabs: two would become UNREACHABLE, four have a retirement to reverse.

**What.** Question 1's second half. *"Not mentioned"* is not an answer, so here is each one.

| Tab | Standalone route today | Registry row | Other mounts | ⚠️ Disposition if `/app/records` changes shape |
|---|---|---|---|---|
| **Lessons** | `/app/ops/lessons` → **redirects** here (`LESSONS_HUB_STANDALONE_RETIRED`, `App.tsx:410-412`) | ✅ `lessons.hub`, **already filed `group: 'management'`** — only its `path` points into Records | — | **Un-retire.** Flip the boolean, repoint `pageRegistry.ts:168` to `/app/ops/lessons`, add the `MANAGEMENT_GROUP` row the registry already believes exists |
| **Documents** | `/app/ops/documents` → **redirects** here (`App.tsx:362-364`) | ❌ none (`mgmt.documents` deleted 2026-08-15) | — | **Un-retire + new registry row.** It is `documentHref()`'s fallback (`registry.ts:185`) and dashboard zone C9's destination |
| **Deals** | `/app/ops/deals` → **redirects** here (`App.tsx:382-384`) | ❌ none | `/app/ops/deals/:dealId` (`DealPage`) resolves independently | **Un-retire + new registry row.** `DealPage.tsx:150` and `CreateModal.tsx:429` both point at `/app/records/deals` |
| **Files** | ❌ **none. No route exists anywhere.** | ❌ none | ❌ **none** | ⚠️ **`RecordsPage.tsx:124` is the only mount of `FilesRecordsPage` in the codebase.** Delete the tab and the file manager — including the hard-delete control the owner asked for on 2026-08-26 — ceases to exist. **Needs a route AND a nav row, both net-new.** |
| **Archived** | ❌ **none** | ❌ none | ❌ **none** | ⚠️ **`RecordsPage.tsx:126` is the only mount of `ArchivedAccountsPage`.** Exactly **one** inbound link in the app (`ContactsPage.tsx:601`, inside the archive-confirm panel). Recommended: a **"Show archived" control on Contacts**, which preserves TASK-ARCHIVE's own stated reason (*"the way out and the way back are one click apart"*) |
| **Horses** | `/app/ops/horse-records` → redirects here (`HORSE_RECORDS_STANDALONE_RETIRED = true`, `HorseRecordsPage.tsx:405`) | ❌ none (`mgmt.horses` deleted 2026-08-15) | — | **→ My Stable** (item 4). See F3, F5, F8 |

**Why it matters.** Files and Archived are the two the task doc's D17-inverse warns about: *"a route
that disappears takes its inbound links with it."* Here there is no route to disappear — there is a
tab, and nothing else.

**Conditions.** Files: all staff. Archived: ADMIN only (`RecordsPage.tsx:66,80`, and again inside
`archived_contacts()`).

---

### F7 — the flag question, answered: `HORSE_RECORDS_STANDALONE_RETIRED` retires the ROUTE, not the page.

**What.** The task doc asks what the flag currently does and whether the standalone page is
reachable.

**Evidence.** `HorseRecordsPage.tsx:405` — `export const HORSE_RECORDS_STANDALONE_RETIRED = true;`
consumed at `App.tsx:356-358`:
```
<Route path="ops/horse-records" element={HORSE_RECORDS_STANDALONE_RETIRED
  ? <Navigate to="/app/records/horses" replace />
  : <ProtectedRoute requireStaff><HorseRecordsPage /></ProtectedRoute>} />
```
**The component is not retired. It is the live Horses tab** (`RecordsPage.tsx:121`). Only the
standalone entry point is closed. Flipping the boolean to `false` restores a second door to the same
component **at a route with no nav row** — which is not what item 4 asks for.

**Two sibling flags, same shape, both `true`:** `HORSES_PAGE_RETIRED` (`HorsesPage.tsx:137`) and
`RECORDS_HUB_RETIRED` (`RecordsHubPage.tsx:118`). Both were **genuinely** duplicate horse rosters and
both now redirect to `/app/records/horses`. Do not resurrect either.

---

### F8 — there are FOUR live horse surfaces, and the dashboard's own "The stable" zone uses two of them at once.

**What.** The defining failure of this project, still present, on the surface item 4 moves.

**Evidence.**

| # | Surface | Route | Shape | Who links to it |
|---|---|---|---|---|
| 1 | `HorseRecordsPage` — **the incumbent** | `/app/records/horses` | expanding rows, full staff edit, party assignment, availability generation, archive | dashboard C7 **"More"** (`TrainerZones.tsx:403`), `registry.ts:85`, 3 route redirects |
| 2 | `HorsePage` | `/app/horses/:horseId` | client-facing page, 4 tabs (Record / Documents / Schedule / Activity) | dashboard C7 **each card** via `horseHref()` (`TrainerZones.tsx:389`), C12 (`:423`) |
| 3 | `StableSection` | `/app/stable` + Account-page panel | member list: horses + gear + supplies | member sidebar; staff Account page (`AccountHub.tsx:169`) |
| 4 | `HorsePartiesPage` / `HorseHealthPage` | `/app/ops/records/horses/:id/parties`\|`/health` | the ownership ledger and the health log | ⚠️ **only** from inside an expanded row (`HorseRecordsPage.tsx:184,187`) — nowhere else in the app |

**The zone contradicts itself.** Dashboard zone C7 is titled **"The stable"**. Clicking a horse card
goes to #2. Clicking "More" goes to #1. **This is CR-74's complaint stated as code:** *"right now it
opens a full horse record page, im not sure if there is a difference and if there is there are
bigger decisions to make."*

**Conditions.** Always, for every staff user, on both dashboards. Surfaces 1 and 2 read different
RPCs (`staff_horse_records` vs `horse_page_detail`) and offer different edit sets.

---

### F9 — ⚠️ an archived horse has no surface and no way back. D32 is not satisfied on the Horses tab.

**What.** The Archive control on the horse row is effectively a delete.

**Evidence.**
- `HorseRecordsPage.tsx:299-306` → `staffArchiveHorse()` → `staff_archive_horse(p_id)`.
- Live body: `UPDATE horses SET deleted_at = now(), deleted_by = auth.uid() …`. **No reason
  parameter.**
- `staff_horse_records()` excludes `deleted_at IS NOT NULL`.
- **No un-archive/restore function for a horse exists in the database.** Verified:
  `select proname from pg_proc where proname ilike '%horse%' and (proname ilike '%unarch%' or proname ilike '%restore%')` → **0 rows.**
- `ArchivedAccountsPage` reads `archived_contacts()` — **contacts only.** An archived horse appears
  nowhere.

**Contrast with the contact path, deliberately built the other way** four months into the same
codebase: `archive_contact(p_contact_id, p_reason)` **requires a reason** (D19), the UI refuses an
empty one (`ContactsPage.tsx:610`), and `unarchiveContact()` + a dedicated view exist.

**Why it matters.** D32 says nothing is truly deleted. For a horse, from the UI's point of view, it
is: invisible, unlisted, unrestorable, with no record of why. **This travels with the roster into
My Stable**, so it is in scope.

**Conditions.** Every staff user (`has_staff_access()`, not admin-gated — note the contact archive
*is* admin-gated, `ContactsPage.tsx:578`). Confirm-once-then-archive; two clicks, no reason, no undo.

---

### F10 — two nav rows read "Records", and the second one is a ghost.

**What.** Question: what does `records.hub` serve, and which has the owner been using.

**Evidence.** `pageRegistry.ts:195` — `{ key: 'records.hub', path: '/app/ops/records', label: 'Records', group: 'modules', module: 'mod.horserecords' }`.
- Its nav row was **removed** on 2026-08-15 (`AppLayout.tsx:560-569`) — it was *"a THIRD listing of
  the same horses."*
- Its route **redirects**: `App.tsx:423-425`, `RECORDS_HUB_RETIRED = true` → `/app/records/horses`.
- It is in `PARKED_IN_REVIEW` (`pageRegistry.ts:85`) — and the Review nav section was deleted on
  2026-08-15 (`AppLayout.tsx:650-654`).
- It still does **two** live jobs:
  1. It appears in **Settings → Page visibility** as a row labelled **"Records"** under *Horse
     Records & Health* — a second hideable "Records" beside `people.records`.
  2. It is the sole entry in `MODULE_HUB_PAGE_KEY['mod.horserecords']`
     (`pageRegistry.ts:218-220`), so `OpsDashboard`'s module tile labelled **"Records"** navigates
     to `/app/ops/records` → redirect → `/app/records/horses`.

**Which has the owner been using: `people.records`.** It is the one with a nav row
(`AppLayout.tsx:514`), the one 8 of 13 dashboard zones point at, and the one all six retirement
redirects target. `records.hub` has had no door since 2026-08-15.

**Why it matters.** When horses leave `/app/records`, the `mod.horserecords` module tile becomes a
dead bounce. `records.hub` should be **retired from the registry** (per that file's own convention:
*"RETIRING A PAGE: delete the entry"*) and `MODULE_HUB_PAGE_KEY` repointed at My Stable — or the
tile loses its destination and, per `OpsDashboard.tsx:104` + the "dead links are forbidden" rule,
silently degrades to a non-navigating "Enabled" tile.

**Conditions.** The tile renders only for ADMIN, only at `/app/ops` — which has **no nav row of its
own**, so it is reached by typing the URL. Low blast radius, but it is a second thing labelled
Records and the owner asked what it was.

---

### F11 — the tab strip and its contents do not share a gutter, and on a phone the strip is three rows deep.

**What.** Presentation defects that a rename will not fix and a split mostly will.

**Evidence — width.** `RecordsTabStrip` is `max-w-6xl mx-auto px-4 sm:px-6` (`RecordsPage.tsx:79`).
The tabs beneath it are not:

| Tab | Container | Aligned with the strip? |
|---|---|---|
| Leads / Partners / Vendors / Deals / Archived | `width="wide"` = `max-w-6xl` | ✅ |
| Files | `max-w-6xl mx-auto px-4 sm:px-6` | ✅ |
| Clients | `width="full"` = `max-w-none` | ❌ runs wider than the strip |
| Horses | `width` default = `max-w-4xl` | ❌ narrower |
| Lessons | `max-w-4xl mx-auto py-8 px-4` | ❌ narrower |
| **Documents** | `<div className="max-w-5xl">` — **no `mx-auto`, no horizontal padding** | ❌ **hugs the left edge with no gutter** |

**Evidence — mobile.** The strip is `flex flex-wrap gap-1.5`, ten pills at `px-4 py-2 text-sm`
(`RecordsPage.tsx:79,86`). Ten labels — Leads, Clients, Partners, Vendors, Horses, Lessons,
Documents, Files, Deals, Archived — at 32px of padding plus 6px of gap each cannot fit one line on a
390px viewport with 32px of page gutter. It wraps to three rows above every list. **The owner's
working device is a phone.**

**Evidence — the document title.** `RecordsPage.tsx:101` calls `useDocumentTitle('Records')`. Every
tab component sets its own (`HorseRecordsPage.tsx:317` "Horse records", `DealsPage.tsx:224`,
`ArchivedAccountsPage.tsx:41`, `Documents` via `<Helmet>`). React runs child effects before parent
effects, so **the parent wins and the browser tab always reads "Records"**, whichever tab is open.

**Why it matters.** Splitting to two pages of 4 and 1 removes the three-row strip on its own.
Documents' missing gutter and the Ops eyebrow (`DocumentsQueuePage.tsx:343`) do not fix themselves —
they follow the page to its new home.

**Conditions.** Width mismatch: all viewports. Strip wrap: below roughly 900px, i.e. every phone and
most tablets in portrait.

---

### F12 — dead code inside the surface being renamed.

Small, but the checklist asks for it. ⚠️ **Reported, and deliberately NOT queued for deletion** —
see §5's reversibility rule. Each is inert; removing it is the one irreversible act available in
this build and it buys the owner nothing he can judge. **Sweep after his verdict, not before.**

| Item | Evidence | Verdict |
|---|---|---|
| `DirectoryMode = 'all'` + `MODE_COPY.all` + two `mode === 'all'` branches | `ContactsPage.tsx:45, 80-84, 228-230, 431-435` | **Dead.** The All tab was removed 2026-08-23 (owner: *"eliminate it entirely, its useless as is"*) and nothing constructs `mode="all"` |
| `DirectoryPage()` | `ContactsPage.tsx:669-671` | **Dead export.** Zero callers; `/app/ops/directory` redirects to Vendors |
| `BUSINESS_FILTERS` + `FILTER_MAP` + the `counts` memo | `ContactsPage.tsx:88-93, 267, 287-300` | Reachable **only** at `/app/ops/review/contacts`, admin-only, behind a "retired" banner |
| `GROUP_LABEL` | `pageRegistry.ts:106-112` | **Dead export**, read by nothing outside its own file. Names the accounts group "People" — a label that matches `AppLayout.tsx:634` by coincidence, not by wiring. **AR4 owns the ruling** |
| `App.tsx:310` comment: *"/app/records bare = the All tab"* | vs `RecordsPage.tsx:103`, which defaults to **`leads`** | Stale by 8 days. ⚠️ It also means **the "Records" nav row opens the Leads tab** — the exact tab CR-30 says should not be there |

---

### F13 — CRUD, per entity, on the surfaces in scope

| Entity | Create | Read | Update | Delete (D32 = archive) | ⚠️ |
|---|---|---|---|---|---|
| **Contact** (Lead/Partner/Vendor) | ✅ `+ new` → `ContactForm`; type set by a **second** RPC after insert (`ContactsPage.tsx:256-262`) | ✅ card → modal → dossier | ✅ Edit contact, or the dossier | ✅ `archive_contact` with a required reason — **ADMIN only** (`:578`) | Create from Partners/Vendors works; create from a hypothetical "all" view would leave the row unfiled |
| **Client** | ⚠️ **navigates away** to `/app/ops/accounts/new` (`Admin.tsx:856`) | ✅ card → isolate | ✅ but **gated**: the rich provisioning block needs `neverInvited \|\| isDraft`; the nine tabs need `user_id` — **CR-80's hole** | ✅ soft (`admin_account_action`) **and** ⚠️ **a real hard delete** — `adminHardDeleteClient` → `POST /api/hard-delete-client`, service-role, *"NUCLEAR… Irreversible"* (`admin.ts:984-993`) | The hard delete is a genuine D32 exception. CR-30 authorises a hard delete **for leads**; nothing on record authorises one for clients. **Route to AR2** |
| **Horse** | ✅ `+ horse` → `HorseIntakeForm` in a modal (`HorseRecordsPage.tsx:380-393`) | ✅ row → expand | ✅ every descriptive field, owner, lessee, lease dates | ⚠️ archive with **no reason, no view, no restore** — **F9** | Not admin-gated, unlike the contact archive |

---

## 5. THE PLAN

**Ordering rule used:** anything that changes a route or a nav row touches `AppLayout.tsx`,
`pageRegistry.ts` and `App.tsx`, which AR4 and AR5 also want. Those are grouped into as few landings
as possible. Everything that can be done inside one page's own file is marked independent.

### ⚠️ THE QUESTION THIS BUILD ANSWERS — read this before the fixes

**The owner is not asserting that Contacts + My Stable is right. He is buying information**
(owner, 2026-08-30, CR-30 supersession):
> *"after testing the unified single records page it was clearly not the right decision. This new
> revision set should help me understand the other side of the options and if i like it, then its
> the basis for the refactor, if i dont like it, the refactor has more work to do to come up with a
> 3rd option."*

**So the success criterion is not "Contacts ships." It is: after a week of using it, he can answer
this sentence, and today he cannot —**

> **"When I open the app to deal with a person or a horse, is it faster when the app is organised by
> WHO/WHAT I am dealing with (two pages, one job each) than when it is organised by RECORD KIND (one
> page, ten tabs)?"**

Concretely, three things he will be able to judge that are unavailable today:
1. **Does he stop choosing a tab before he can start working?** Today the Records nav row opens
   **Leads** (`RecordsPage.tsx:103`) regardless of what he came for; every visit begins with a tab
   choice. Contacts and My Stable each open onto the thing itself.
2. **Does the dashboard land him on the record?** 8 of the owner dashboard's 13 zones point into
   `/app/records/*` (`registry.ts:75-110`), and **U1 proves at least one of them lands on the wrong
   list.** After this, one hop from a dashboard card should put the person or horse in front of him.
3. **Is a person-shaped page actually one page?** Contacts will hold four populations that are one
   stored column (F4) but three list idioms (F5). If they still feel like four places after the
   merge, that is the signal that a third option is needed.

⚠️ **A third option still being needed is a SUCCESS of this build.** Nothing downstream may cite the
Contacts shape as settled architecture.

### ⚠️ THE REVERSIBILITY RULE — applied at every fork below

Because this is an experiment with a declared exit, **each step below states what it costs to undo.**
Three standing choices follow from that, and they are not negotiable within this plan:

- **⛔ NOTHING IS DELETED.** The ten-tab shell retires behind a boolean the way
  `HORSE_RECORDS_STANDALONE_RETIRED`, `HORSES_PAGE_RETIRED` and `RECORDS_HUB_RETIRED` already do
  (D32, and this repo's standing rule from `86a2c33`). ⚠️ **This reverses one recommendation I would
  otherwise have made:** F12's dead code (`mode='all'`, `DirectoryPage`, `BUSINESS_FILTERS`) is
  **reported and left in place**. Deleting it is the one irreversible act available here and it buys
  nothing he can judge. **Defer every deletion until after he has ruled.**
- **⛔ NO ROUTE IS CLOSED.** `/app/records` and `/app/records/:tab` keep resolving as redirects.
  Reverting is then a boolean and a redirect target, not a restoration.
- **⛔ THE REGISTRY KEY DOES NOT CHANGE.** `people.records` keeps its key and only its `path` moves —
  exactly what `pageRegistry.ts`'s own header instructs, and what makes the undo a one-line edit.

**Total cost to undo the whole thing, if built this way:** flip one boolean in `RecordsPage.tsx`,
revert two `path` values in `pageRegistry.ts`, revert two `NavItem` rows in `AppLayout.tsx`, and
point `contactHref()` back. **No component is rewritten and no data moves** — every fix below is a
change of *where a surface is mounted*, not of what it does. The two exceptions are called out at
P5.2 and P8.

### ⚠️ RESOLVED, NOT ASKED — the CR-30 collision

The brief originally instructed this thread to surface leads-on-Contacts as an unresolved collision
with CR-30. **The owner ruled again on 2026-08-30 and the collision is gone**
(`docs/reference/CHANGE-ORDER-LEDGER.md`, the CR-30 supersession entry; `TASK-AR3` §3 as amended). Under the
ledger's override rule the earlier statement is deleted. **Leads are on Contacts. This report does
not hedge against CR-30 and does not put the question back to him.**

**The surviving half of CR-30 is load-bearing for U1:** *"a lead can be both a row on Contacts and an
item that surfaces on the dashboard."* The dashboard lead card stays; it just has to work.

### RULED, NOT ESCALATED — what "My Stable" means for staff

The brief allowed me to flag this as genuinely ambiguous. **It is not.** The evidence is
one-directional, so I am ruling:

- `AccountHub.tsx:167-170` already gives staff a row **named "My Stable"**, subtitled *"The
  business's horses, gear, and supplies"*, and its own comment says it exists because the surface
  *"was unreachable for staff… so this was the only door."*
- Dashboard zone C7 is titled **"The stable"** and points at `/app/records/horses`
  (`registry.ts:84-85`).
- `docs/reference/nav-icon-exercise.md` records an owner correction of 2026-08-08 about the staff
  horses page: *"Rename it **Stable**, which also matches the member-side term already in use (`My
  Stable`)."*

**So item 4 is "give the staff horses page the name it was already ruled to have, and put it in the
sidebar."** It is **not** a request to point staff at the member-scoped surface — **F3 proves that
returns 0 of the tenant's 3 horses.**

### ONE OPEN QUESTION — and it does not block anything

**Q-1 (affects P5 only). What does staff's My Stable contain besides horses?**
`/app/stable` today renders horses **+ Gear + Supplies** (`StableSection`), and CR-58 is a live
change request about the Gear/Supplies add-controls on that card. When it becomes the staff horses
page: do Gear and Supplies stay (the business's own tack and feed), or is staff's My Stable horses
only?

**Recommendation — keep all three sections, and do not wait for an answer.** They already exist,
CR-58 assumes they do, and removing a section is a deletion (see the reversibility rule). If he
wants horses only, hiding two sections afterwards is a one-line change.

---

### P1 — Fix the lead link (independent, one file, no nav or route change)

Make `contactHref()` resolve to wherever the person actually is. Until Contacts exists, the minimal
correct behaviour is to send a `LEAD` to the Leads tab and everyone else to Clients; once Contacts
ships (P3), it collapses to one path with a `?open=` that works for all four types.

**Files:** `src/lib/dashboard/registry.ts`.
**Independent.** Ship it first, on its own — it is U1 and it waits on nothing.
**↩ Undo cost: one function body.** It is also the only fix here that is worth keeping whatever he
decides about Contacts, because a link that lands on the wrong list is wrong under every shape.

### P2 — Give Files and Archived somewhere to live (must land WITH P3)

Neither has a route today (F6). Before `/app/records` reshapes:
- **Files** → new route `/app/ops/files` + registry row + nav row.
- **Archived** → recommend **not** a route: a "Show archived" toggle on Contacts, which is where the
  archive action already is and where the un-archive belongs. Fallback if the owner wants a page:
  `/app/ops/archived`, admin-only.

**Files:** `App.tsx`, `pageRegistry.ts`, `AppLayout.tsx`, `FilesRecordsPage.tsx` (it needs a heading —
F11), `ArchivedAccountsPage.tsx`.
**Must land with P3.** ⚠️ If the Records tab strip loses these two tabs before their new doors
exist, both components become unmountable.
**↩ Undo cost: none — this is purely additive.** A route and a nav row for a page that had neither
is correct under Contacts, under the ten-tab page, and under a third option. **Do this even if
everything else is reverted.**

### P3 — Records → Contacts

1. **One list, not four tabs.** `ContactDirectory` becomes the whole page, with type **filter
   chips** (Leads · Clients · Partners · Vendors) driven by `contacts.contact_type`. This is F4's
   evidence plus the owner's own 2026-08-12 ruling, quoted in `RecordsPage.tsx`'s own header.
   ⚠️ **Add the chips; do NOT remove the `mode` plumbing, `'all'`, `DirectoryPage` or
   `BUSINESS_FILTERS`** (F12). They are dead but harmless, and deleting them is the one thing here
   that cannot be flipped back. Report them; sweep them after he rules.
   **↩ If he wants tabs back instead of chips, that is a presentational swap inside one component —
   the data path is identical either way.**
2. **⚠️ The Clients segment is AR2's surface, not mine.** `Admin.tsx` (1093 lines, nine account
   tabs, CR-80's two gates) is being reworked by AR2. **This plan hosts it; it must not rewrite it.**
   The seam is: Contacts owns the *list and the filter*; AR2 owns *what opens when you click a row*.
3. **Rows, not cards** (CR-74/CR-75) — reuse `HorseRecordsPage`'s expand shell, which is the
   component the owner named as the standard. **Do not reimplement it; extract it.**
4. Route `/app/records` → `/app/contacts`, with `/app/records` and `/app/records/:tab` kept as
   redirects (D32 — the six retirement redirects and every bookmark point there).
5. Registry: `people.records` **keeps its key**, `path` → `/app/contacts`. That is precisely what
   `pageRegistry.ts`'s header instructs.
6. Rename the document title (F11) and retire the tab strip **behind a boolean** —
   `RECORDS_TABS_RETIRED`, the same shape as the three retirement flags already in this codebase.
   ⚠️ **The ten-tab shell is not deleted.**

**Files:** `RecordsPage.tsx` (becomes the Contacts page; the tab shell stays in the file behind the
flag), `ops/ContactsPage.tsx`, `App.tsx`, `pageRegistry.ts`, `AppLayout.tsx`, and the **18 inbound
links** in P6.
**Must land with P2 and P6.**
**↩ Undo cost: one boolean + one `path` value + one redirect target.** Because the key never moves
and no route closes, reverting restores the ten-tab page with every bookmark and every redirect
still resolving. **No component is rewritten to get here and none is rewritten to get back.**

### P4 — Contacts gets its nav row (must land WITH P3)

Add one `NavItem`. **⚠️ Both files, or it is a no-op (F1).**
- `AppLayout.tsx:514` — replace the `Records` row **in place**, in `MANAGEMENT_GROUP`.
  ⚠️ **Recommend against moving it into `ACCOUNTS_GROUP`**: that array is empty (`:538`) and
  `manageNavGroups` drops empty groups (`:656`), so using it resurrects a "People" heading — **which
  is AR4's taxonomy, not mine.** Leaving both rows where Records already sits keeps AR4 free to move
  the whole group later.
- `pageRegistry.ts:152` — update `path`. ⚠️ Its `group: 'accounts'` **already disagrees** with where
  the row renders; fix it to `'management'` in the same edit, or tell AR4 to.
- **Icon: `Contact2`.** Settled by the owner on 2026-08-08 (`nav-icon-exercise.md` §5, *"People →
  `Contact2`"*), verified present in the installed `lucide-react`, and **not used anywhere in this
  nav**. It frees `BookOpen`.
- **Mobile is free** — F1b. No second edit.

**↩ Undo cost: two lines** (one `NavItem`, one registry `path`).

### P5 — Horses → My Stable (must land WITH P6)

1. **`HorseRecordsPage` is the incumbent and it moves whole** — `EditableRecord` and its expand
   shell, unmodified (F5). ⚠️ **Carry `onOpenContact` and the `ContactDossierModal` mount with it**
   (`RecordsPage.tsx:111, 121, 128-130`), or the owner/lessee links go dead.
2. **`/app/stable` branches on `isStaff`.** `Stable.tsx` is 20 lines; staff render the horse-records
   roster (+ Gear/Supplies per Q-1), members render `StableSection` unchanged. **One route, one nav
   row, no fourth roster.** ⚠️ Do **not** point staff at `my_stable_horses` — F3 proves it returns 0
   of 3.
   ⚠️ **This is one of the two places in the plan that is not a pure re-mount** — it adds a branch to
   a member-facing file. Keep the member arm byte-identical so the undo is deleting the `isStaff`
   arm, and nothing else.
3. **Nav row:** `AppLayout.tsx` `MANAGEMENT_GROUP`, directly beneath Contacts, label **"My Stable"**.
   New registry row `people.stable` → `/app/stable`. ⚠️ **Icon: not `Boxes`** — the member rail
   already uses it for My Stable (`:1098`) *and* `MODULES_GROUP` uses it for Barn Ops (`:559`), so a
   staff rail would show two identical glyphs, which the icon exercise names as a defect. `Fence` and
   `Warehouse` are both present in `lucide-react` and unused; **`Fence` reads as a paddock.**
4. **Retire `records.hub`** from the registry and repoint `MODULE_HUB_PAGE_KEY['mod.horserecords']`
   at the new key, or the Ops module tile becomes a dead bounce (F10).
5. **Module gate:** decide whether My Stable is gated on `mod.horserecords`. It is not gated today
   and every other surface for that module is. **Multi-tenant consequence** — irrelevant to FHE
   (all six modules on) and wrong for the next tenant.

**↩ Undo cost: one `isStaff` branch, one `NavItem`, one registry row, one `MODULE_HUB_PAGE_KEY`
entry.** `HorseRecordsPage` itself is untouched throughout, which is the whole point — **the asset
CR-74 praises is moved, never edited.**

### P6 — the inbound links (must land WITH P3 and P5)

**Every reference to `/app/records*` outside `RecordsPage` itself. 18 non-comment sites.**

| Target | Sites |
|---|---|
| `/app/records/clients` | `App.tsx:316` (`/app/admin` redirect), `App.tsx:339` (`ops/contacts`), `TrainerZones.tsx:486`, `BusinessZones.tsx:173`, `registry.ts:93` (C13), `:104` (B9), `:177` **`contactHref()` — 5 further call sites**, `OwnerDashboard.tsx:348` |
| `/app/records/leads` | `App.tsx:346` (`ops/leads`), `TrainerZones.tsx:231, 296, 318`, `registry.ts:81` (C4), `OwnerDashboard.tsx:311` |
| `/app/records/horses` | `App.tsx:351, 357, 424` (three retirement redirects), `TrainerZones.tsx:403`, `registry.ts:85` (C7) |
| `/app/records/lessons` | `App.tsx:411`, `pageRegistry.ts:168`, `TrainerZones.tsx:360`, `registry.ts:83`, `InstructorHome.tsx:162` |
| `/app/records/documents` | `App.tsx:363`, `TrainerZones.tsx:429`, `registry.ts:87`, `registry.ts:185` (`documentHref` fallback) |
| `/app/records/deals` | `App.tsx:383`, `CreateModal.tsx:429`, `BusinessZones.tsx:144`, `registry.ts:102`, `:189` (`dealHref` fallback), `DealPage.tsx:150` |
| `/app/records/vendors` | `App.tsx:345` (`ops/directory`) |
| `/app/records/archived` | `ContactsPage.tsx:601` |
| `/app/records/partners` | **none** |
| `/app/records/files` | **none** — the tab is the only way in |
| bare `/app/records` | `AppLayout.tsx:514`, `pageRegistry.ts:152`, `reviewSection.ts:161` |

⚠️ **8 of the owner dashboard's 13 zone destinations point into `/app/records/*`** (`registry.ts:75-110`).
The dashboard is where both owners land. **This is the highest-traffic consequence of the split.**

### P7 — the four ledgers get their own doors (must land WITH P3)

Per F6: un-retire Lessons, Documents and Deals; each gets a route, a registry row and a
`MANAGEMENT_GROUP` nav row. `lessons.hub` needs only a path change — the registry already files it
under `management`.

**↩ Undo cost: three booleans back to `true`, three rows removed.** ⚠️ **Un-retiring is itself the
reversible direction** — it re-opens doors that already exist behind a flag, rather than closing
any.

### P8 — horse archive gets a reason and a way back (independent — DB + one page)

Per F9: add `p_reason` to `staff_archive_horse` (matching `archive_contact`), add a restore
function, and surface archived horses. **Independent of every other item** and safe to run in
parallel — it touches one RPC and one component.

⚠️ **This is the second non-re-mount, and the only DB change in the plan.** It is also the only fix
here that is *unconditionally* right: it is a D32 repair, not an experiment, and it should survive
whichever shape he chooses. ⚠️ **`staff_archive_horse` is a live function — changing its signature
resets its ACLs** (TASK-ORIGIN, 2026-08-27: `DROP`+`CREATE` resets function grants). **Re-grant
explicitly and verify with `\df+` before it reaches production.**
**↩ Undo cost: a down-migration. Not free — sequence it on its own.**

### P9 — presentation cleanups (independent, one file each)

Documents' missing gutter and its "Ops" eyebrow (`DocumentsQueuePage.tsx:339, 343`); Files' missing
heading (`FilesRecordsPage.tsx:143`).
⚠️ **F12's dead code is deliberately NOT in this step** — see the reversibility rule. It is a
post-judgement sweep, and it needs its own thread once the shape is settled.
**↩ Undo cost: cosmetic, per file.**

---

## 6. TEST CRITERIA

Each is a thing to observe, not the absence of an error (`ORCHESTRATOR.md` §3).

**P1 · the lead link**
1. As `hello@fhequestrian.com`, open `/app/dashboard`. Click **Open** on the Rachel Page card.
   **Rachel Page's record is on screen, open.** Repeat for Casey Caddell.
2. Click **Open** on a card whose contact is `contact_type='CONTACT'`. **That client's record is on
   screen, open.** (Guards against fixing one type by breaking the other.)

**P2 · Files and Archived**
3. Type `/app/ops/files` with the tab strip gone. **The file table renders, with a heading.**
4. `grep -rn "FilesRecordsPage\|ArchivedAccountsPage" src/` returns **at least one mount that is not
   a Records tab**, for each.
5. Archive a test contact, then find it again from Contacts **without typing a URL**, and restore it.

**P3 · Contacts**
6. `/app/contacts` renders one list containing all **33** rows `staff_contact_directory()` returns,
   minus TEAM = **29**, and the four filter chips partition it **5 / 24 / 0 / 0**.
7. `/app/records`, `/app/records/clients`, `/app/records/leads`, `/app/admin`, `/app/ops/leads`,
   `/app/ops/contacts`, `/app/ops/directory` each land on Contacts with the right filter applied.
8. `npx vitest run test/ui/pagevis_registry.test.ts` passes — **it asserts no two registry rows share
   a path and every path is a registered route**, both of which this work can break.
9. Clicking a row **expands it in place**; clicking the header again collapses it. Measured on a
   390px viewport as well as desktop.

**P4/P5 · the nav rows**
10. As ADMIN on **desktop**: **Contacts** and **My Stable** both appear in the rail, with distinct
    icons, and neither shares a glyph with another visible row.
11. As ADMIN on a **390px viewport**: open the drawer. **Both rows are there**, in the same group,
    same order. *(Same array — F1b — but prove it once.)*
12. As **MANAGER/EMPLOYEE** (create one; none exists in production): both rows appear; **Archived is
    not reachable** from Contacts.
13. Settings → Page visibility lists **Contacts** and **My Stable**, and hiding one **removes the
    rail row** — or F2 is filed as a known, stated gap rather than silently shipped.

**P5 · My Stable**
14. `/app/stable` as `hello@fhequestrian.com` lists **Tiz Love, Sundance and Secret Tattoo** — all
    three, not zero. ⚠️ **This is the single test that proves F3 was fixed and not reproduced.**
15. `/app/stable` as a member account lists **that member's** horses and no others.
16. Expand a horse: **Edit record & parties** saves; the owner name is a **link** that opens the
    contact dossier without leaving the page; the **Ownership** and **Health** links both resolve.
17. `/app/ops` module tile "Records" (or its replacement) navigates somewhere that renders.

**P8 · horse archive**
18. Archiving a horse **requires a reason**; the horse then appears in an archived view; restoring
    it puts it back on the roster with its parties intact.

**P6 · no dead links**
19. `grep -rn "/app/records" src/` returns **only** the redirect definitions in `App.tsx` — and each
    of those redirects, followed in a browser, lands somewhere that renders.

**⚠️ THE UNDO TEST — the one that makes §5's reversibility claim real**
20. On a throwaway branch: flip `RECORDS_TABS_RETIRED` back to `false`, revert `people.records.path`
    and `people.stable`, revert the two `NavItem` rows, revert `contactHref()`. **The ten-tab
    Records page renders, the "Records" nav row is back, and criteria 7's seven redirects all still
    resolve.** Then throw the branch away. ⚠️ **Run this before P3 is called done**, not after he
    asks for it — an untested undo is a hypothesis, and this repo has a table of changes that
    reported success and did nothing.

---

## 7. SUCCESS, AT TWO LEVELS

**Per fix** — each numbered criterion in §6 observed, on a real signed-in session, on **both**
desktop and a 390px viewport, as **ADMIN and as a non-admin staff account**.

**For the experiment** — ⚠️ **the level that outranks the other two.** After a week of real use the
owner can answer §5's question: *is the app faster organised by who/what I am dealing with than by
record kind?* **Either answer is a success.** If he says no, the build has done its job by making
the alternative concrete, and the refactor goes looking for a third option — which he named as an
outcome in advance. ⚠️ **The failure mode is not "he rejects it." It is shipping something he cannot
cheaply reverse, or that nobody records a verdict on.** So the build is not closed until (a) the
undo path in §5 has been *exercised once* on a branch and shown to restore the ten-tab page, and
(b) his verdict is written into `docs/reference/CHANGE-ORDER-LEDGER.md` as the CR-30 supersession's outcome.

**For the area as a whole** — four statements, all of which are false today:

1. **There is one place to find a person, and it is called Contacts.** Every path that means "show
   me this person" ends there — the nav, the dashboard, the redirects — and the person is on it
   whatever their type and whatever stage they are at. *(Today: four tabs, two components, and a
   dashboard link that lands on a list a lead is not on.)*
2. **There is one place to find a horse, it is called My Stable, and it has every horse.** *(Today:
   four horse surfaces, a dashboard zone that uses two of them at once, and a "My Stable" that shows
   0 of 3.)*
3. **Nothing lost a door.** Files, Archived, Lessons, Documents and Deals are each reachable from
   the nav — not from a tab strip that no longer exists. *(Today: two of the five have no route at
   all.)*
4. **A nav row is one edit.** Adding, moving or hiding a page changes one thing and both surfaces
   agree. *(Today: two disconnected tables, drifted at 14 of 25 rows, and the hide feature is
   unwired.)*

---

## 8. FLAGGED, NOT FIXED

| # | What | Route to |
|---|---|---|
| 1 | ~~CR-30 vs owner item 3~~ — **RESOLVED 2026-08-30, not flagged.** The owner ruled again; leads are on Contacts. This report does not re-put the question. ⚠️ **What ORCH6 must carry instead: the Contacts shape is an experiment with a declared exit, and no downstream task may cite it as settled architecture.** | **closed** |
| 2 | **The client record itself** — CR-80's two gates (17 of 24 clients cannot load the nine tabs; the rich provisioning form closes the moment the invitation is sent). Contacts *hosts* this; it must not redesign it. | **TASK-AR2** |
| 3 | **`adminHardDeleteClient`** — a genuine irreversible hard delete on the Clients surface (`admin.ts:984`, `POST /api/hard-delete-client`). CR-30 authorises a hard delete for **leads**; nothing authorises one for clients. D32 exception, undocumented. | **TASK-AR2** + owner |
| 4 | **Nav section taxonomy** — whether the empty `ACCOUNTS_GROUP` ("People") comes back, whether `GROUP_LABEL` is deleted or wired, and which section Contacts and My Stable finally sit in. I place both rows where Records already sits, precisely so this stays open. | **TASK-AR4** |
| 5 | **F2 — page visibility is unwired.** Bigger than my two rows; it is the whole `PAGE_REGISTRY` ↔ `AppLayout` seam, and `OpsDashboard` tells users it works. | **TASK-AR4** (owns the registry) |
| 6 | **`settings.page_visibility` has no nav row and no card** on `/app/ops/settings` — the one page marked `protected: true` because *"this page brings every other one back"* is itself reachable only via one prose link on `/app/ops`, which has no nav row either. | **TASK-AR4** |
| 7 | **`/app/ops` (OpsDashboard) has no nav row** — the module launcher and the KPI tiles are URL-only. Relevant here only because the `mod.horserecords` tile is one of `records.hub`'s two remaining jobs. | **TASK-AR4 / AR6** |
| 8 | **Module gating is inconsistent** — Records tabs are ungated while the equivalent nav rows are gated. A `mod.lessons`-off tenant sees a Lessons tab that renders a lock. Invisible at FHE (all six modules on); wrong for tenant two. | **TASK-AR5** (module surfaces) |
| 9 | **CR-58** — the Gear/Supplies add-control styling on the My Stable card. Lands inside P5's page. Not designed here. | **ORCH6** to sequence after P5 |
| 10 | **`ContactDossierModal` (632 lines) vs `Admin.tsx`'s isolate view vs `ProvisionClientForm`** — three record surfaces for one person, named by CR-33 and CR-80. Contacts inherits whichever survives. | **TASK-AR2** |
| 11 | **`reviewSection.ts` + the four `/app/ops/review/*` mounts** still reference `/app/records` and still mount `ContactDirectory mode="contacts"`. The Review experiment ended 2026-08-15; these are the last of it. | **ORCH6** — cleanup, low priority |

---

## 9. CONTENDED FILES

⚠️ **Required for build ordering. Files marked ⛔ are wanted by another AR thread — those cannot run
in parallel with mine.**

| File | What AR3 needs | Also wanted by |
|---|---|---|
| ⛔ `src/components/app/AppLayout.tsx` | 2 nav rows, 2 icons, possibly the group for both | **AR4** (renames all five group labels, moves rows), **AR5** (dissolves MODULES_GROUP) |
| ⛔ `src/lib/pageRegistry.ts` | `people.records` path+group; new `people.stable`; retire `records.hub`; 3 un-retired ledger rows; `MODULE_HUB_PAGE_KEY` | **AR4** (`GROUP_LABEL`, section taxonomy), **AR5** (module rows) |
| ⛔ `src/App.tsx` | `/app/contacts`; keep `/app/records*` as redirects; new `/app/ops/files`; un-retire 3 ledger routes | **AR5** (back buttons on module pages), **AR1** (calendar route) |
| ⛔ `src/pages/app/Admin.tsx` | hosted as the Clients segment — **AR3 must not rewrite it** | **AR2** — owns it outright |
| ⛔ `src/components/app/ContactDossierModal.tsx` | opened from Contacts rows | **AR2** — owns it outright |
| ⛔ `src/pages/app/AccountHub.tsx` | the staff "My Stable" row at `:169` | **AR5** — moving Modules onto this page |
| `src/pages/app/RecordsPage.tsx` | **becomes** the Contacts page; tab strip removed | AR3 only |
| `src/pages/app/ops/ContactsPage.tsx` | one list + filter chips; dead `mode`s removed | AR3 only |
| `src/pages/app/ops/HorseRecordsPage.tsx` | moves to My Stable, `onOpenContact` carried | AR3 only |
| `src/pages/app/Stable.tsx` | branches on `isStaff` | AR3 only |
| `src/components/app/StableSection.tsx` | staff branch; Q-1 decides Gear/Supplies | AR3 only (CR-58 touches it later) |
| `src/lib/dashboard/registry.ts` | `contactHref` (**U1**), `documentHref`/`dealHref` fallbacks, 8 zone `to:` targets | possibly **AR6** (Activity zone B6) |
| `src/components/app/dashboard/TrainerZones.tsx` | 6 link sites | possibly **AR6** |
| `src/components/app/dashboard/BusinessZones.tsx` | 3 link sites | possibly **AR6** |
| `src/pages/app/ops/OwnerDashboard.tsx` | 2 tile targets | possibly **AR6** |
| `src/pages/app/ops/DocumentsQueuePage.tsx` | new home; gutter + "Ops" eyebrow | AR3 only |
| `src/pages/app/ops/FilesRecordsPage.tsx` | new route; needs a heading | AR3 only |
| `src/pages/app/ops/ArchivedAccountsPage.tsx` | new home | AR3 only |
| `src/pages/app/ops/DealsPage.tsx` · `hubs/LessonsHubPage.tsx` | un-retired standalone routes | AR3 only |
| `src/pages/app/ops/DealPage.tsx` · `InstructorHome.tsx` · `components/app/CreateModal.tsx` | one link each | AR3 only |
| `src/pages/app/ops/OpsDashboard.tsx` | `MODULE_HUB_ROUTES` for `mod.horserecords` | **AR5** (module surfaces) |
| `src/lib/reviewSection.ts` | stale `/app/records` reference | AR3 only |
| `test/ui/pagevis_registry.test.ts` | ⚠️ **will fail** on duplicate paths / unregistered routes — a guard, not an obstacle | AR4 |
| **DB** — `staff_archive_horse` + a new restore fn (P8) | reason param, restore path | nobody |

**Suggested build order, given the above:**
`P1` (alone, immediately — it is U1, it touches one file nobody else wants, and it is right under
every shape) →
`P8` and `P9` (parallel with each other; `P8` is the only migration, so give it its own landing and
verify its grants) →
`P2 + P3 + P4 + P6 + P7` **as one landing** — they share `AppLayout.tsx`, `pageRegistry.ts` and
`App.tsx`, and splitting them leaves the app with tabs whose destinations do not exist →
`P5` — its own landing, **after** P3. My Stable's route and nav row are logically independent of
Contacts', but they touch the same three files, so **it must not run concurrently with P3.**

⚠️ **No step waits on an owner answer.** Q-1 has a stated default that does not block P5.

⚠️ **One extra step ORCH6 should schedule and no fix above contains: exercise the undo.** Before P3
is called done, cut a branch, flip `RECORDS_TABS_RETIRED` back, revert the two `path` values and the
two `NavItem` rows, and confirm the ten-tab Records page renders with every redirect still
resolving. **§5's reversibility claim is a hypothesis until someone runs it** — and this project has
a documented history of changes that reported success and did nothing (`ORCHESTRATOR.md` §3).

---

## 10. TEARDOWN

**Nothing was left running.** No dev server, no watcher, no build. Every `psql` invocation was a
one-shot command that exited; each write-touching probe was wrapped in `BEGIN; … ROLLBACK;` and is
transcribed above. No browser harness was started. **The production-login probe was not used**, per
the standard.

**Worktree:** `/Users/cactai/Downloads/claude-code-repo/wt-ar3`
**Branch:** `task/ar3` (from `origin/main` @ `bb49e713`)
**Committed:** this report only. **Not pushed.**

Process census taken after the work — see the commit message body for the pasted output.
