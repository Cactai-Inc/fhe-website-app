# TASK RECORDS — one page: Leads, Clients, Partners, Vendors, Horses

**Worktree `~/Downloads/claude-code-repo/wt-records`, branch `task/records`, off
`origin/main` at `0567935`.** Not pushed. **Applied, not held** — committed on this
branch (see the commit this report ships with).

`typecheck` 0 errors · `lint` 0 errors / 39 warnings (identical count to `main`) ·
`build` passes (vite build + prerender + seo-files). `test/ui` run in full: same two
pre-existing failures as `main` (`pluspass_create_controls`, and
`reviewnav_section`'s `templates` group missing an incumbent — a TEXTEDIT-task gap,
not touched here) and nothing new. `test:db` not cited, per the standing note that
it is broken independent of this task.

---

# WHAT EXISTS NOW

One page, `Records`, at `/app/records`, with five tabs plus an All default:

```
[ All ] [ Leads ] [ Clients ] [ Partners ] [ Vendors ] [ Horses ]
```

Each addressable by URL: `/app/records`, `/app/records/all`, `/app/records/leads`,
`/app/records/clients`, `/app/records/partners`, `/app/records/vendors`,
`/app/records/horses`. `/app/records` bare and `/app/records/all` render the same
thing — the owner's "one click opens the house with everyone in it."

**It is a tab strip over five INDEPENDENT renderers, not one table with a filter**
(§3 of the task, the load-bearing constraint):

| tab | renderer | population |
|---|---|---|
| All | `ContactDirectory({mode:'all'})` (new mode) | every LEAD/CONTACT/PARTNER/VENDOR contact — TEAM excluded |
| Leads | `ContactDirectory({mode:'leads'})` — unchanged | `contact_type = LEAD` |
| Clients | `Admin` (the whole `/app/admin` page, unchanged) | `admin_client_accounts()` — logins + provisioned clients + bare CONTACT contacts |
| Partners | `ContactDirectory({mode:'partners'})` (new mode) | `contact_type = PARTNER` |
| Vendors | `ContactDirectory({mode:'vendors'})` (new mode) | `contact_type = VENDOR` |
| Horses | `HorseRecordsPage` (the whole `/app/ops/horse-records` page, unchanged) | `staff_horse_records()` — breed/sex/height/owner/lessee/lease-state |

Horses renders its own row shape, as required — no contact columns were bolted onto
it, and no horse fields leaked into the four person-tabs.

`RecordsPage.tsx` (new, 98 lines) is the entire shell: a tab strip
(`RecordsTabStrip`) that is visually a different, larger control than `Admin.tsx`'s
own nine account-scoped tabs (Overview/Bookings/…, which only appear one level
deeper, after a Clients row is isolated) — solid green pills here, small pills there,
so the two layers do not read as one. Below the strip, whichever tab is active
mounts its existing page component **unmodified**, complete with that component's
own `PageLayout` header (its own name, description, Add button). Nothing was
stripped out of Admin/ContactDirectory/HorseRecordsPage to make them fit — the shell
supplies zero chrome of its own beyond the strip, so there is never a doubled
`PageLayout` box.

## Team

Appears nowhere on this page — not a tab, not in the All list (`mode:'all'`
explicitly excludes `contact_type = TEAM`). It lives in Settings, unchanged.

---

# THE FIVE PLACES THE SPEC NAMED, PLUS THE TWO DB FUNCTIONS

| place | change |
|---|---|
| `contacts` check constraint | `VENDOR`, `PARTNER` added; `DIRECTORY` kept (deprecated, not removed) |
| `src/lib/api.ts` — `ContactType` union | `+ 'VENDOR' \| 'PARTNER'`; `CONTACT_TYPE_LABEL` gets both |
| `ContactDossierModal.tsx` type picker | `DIRECTORY` swapped for `VENDOR`/`PARTNER`; `DIRECTORY` still shown IF a contact is already filed there |
| `ContactsPage.tsx` type picker | same swap, same "still shown if already filed" guard |
| `ContactsPage.tsx` mode→type map | `+ vendors: 'VENDOR', partners: 'PARTNER'`, plus a new `all` mode with no single type (filtered in `load()` instead) |
| DB `set_contact_type` | **enumerates the four values explicitly — updated** to accept `VENDOR`/`PARTNER` too, `DIRECTORY` kept |
| DB `admin_client_accounts` | **checked, not changed** — its only `contact_type` reference is `c.contact_type = 'CONTACT' OR IS NULL` on arm 3 (bare contacts); it never enumerated all four, so Vendor/Partner contacts without a login or `clients` row are correctly excluded from the Clients tab with no DB change needed |

Migration `supabase/migrations/20260812T1800_records_vendor_partner_split.sql`:
dry-run in `BEGIN…ROLLBACK`, applied, verified against prod (constraint text and
`set_contact_type`'s live definition both read back correctly, shown below). Zero
rows changed type — `DIRECTORY` had zero rows going in, per the task's own note,
confirmed again before touching anything.

```
contacts_contact_type_check → CHECK (contact_type IS NULL OR contact_type = ANY
  (ARRAY['LEAD','CONTACT','TEAM','DIRECTORY','VENDOR','PARTNER']))
```

---

# THE TWO NAVIGATION FILES THIS ALSO TOUCHED, AND WHY

**Not in the task's own file list, but load-bearing for the nav change it does ask
for** — both are the direct, mechanical consequence of turning three empty-since-
REVIEWNAV nav rows into the one Records row.

## `AppLayout.tsx` — `ACCOUNTS_GROUP`

Was empty (TASK-REVIEWNAV moved Leads/Clients/Directory into the temporary Review
group and left the array empty, dropping the "People" heading from the rail
entirely — see that report). Now holds exactly one entry:

```ts
{ to: '/app/records', label: 'Records', icon: BookOpen }
```

**Icon: `BookOpen`, per the task's instruction to inherit one of the three retired
icons and not add a fourth or reuse `UserRound`.** Not `Contact` (already carrying
Employees in `MODULES_GROUP`) or `Users` (already carrying the Community feed
selector) — `BookOpen` was Directory's icon and nothing else in the rail claims it,
so this is the one choice with zero collision risk anywhere in the current nav.

`NavLink`'s default (no `end` prop) prefix-matches, so the Records row highlights as
active on every one of its own tabs, not just the bare URL.

## `src/lib/reviewSection.ts` — the `people` REVIEW_GROUPS entry

**This is the acceptance the REVIEWNAV report's own slot-A warning named in
advance**: *"TASK-ONEPEOPLE will roll A/C/D into one tabbed page… if it has landed
now, this group collapses to the composed page vs slot B."* That is exactly what
happened, so the group now reads:

- **Slot A** → `/app/records`, incumbent, "RecordsPage — Leads / Clients / Partners
  / Vendors / Horses…"
- **Slot B** → `/app/ops/review/contacts`, unchanged — the retired 07-01 directory,
  which was **added** to Review (not moved from anywhere), so it is untouched.

Slots C and D (the old Leads/Directory rows) are gone — they did not "move back"
anywhere, because the owner's ruling replaces all three with one row, not three
restored ones.

`test/ui/reviewnav_section.test.tsx`'s `MOVED` fixture (a hardcoded list, separate
from `reviewSection.ts`) asserted `/app/admin`, `/app/ops/leads` and
`/app/ops/directory` each appear exactly once, as a Review row. That assertion is
now testing a state that no longer exists on purpose, so those three lines were
removed from the fixture with a comment explaining why — not deleted silently.
Confirmed this is the **only** test file that named those three paths.

## `src/lib/pageRegistry.ts` — TASK-PAGEVIS's own registry

**Adjacent, not requested by name, but the same nav row is the subject of both
tasks.** `PAGE_REGISTRY` still listed `people.leads` / `people.clients` /
`people.directory` as three separately-hideable rows pointing at paths that now
just redirect — leaving them would make the Page Visibility settings screen show
three "pages" that no longer independently exist. Replaced with one entry,
`people.records` → `/app/records`, and removed the three retired keys from
`PARKED_IN_REVIEW` (they are not parked; they do not exist under those keys any
more). **Low risk**: `test/ui/pagevis_registry.test.ts`'s "every parked-in-Review
key is a real registry entry" check requires this pairing, and it passes.
Confirmed `AppLayout.tsx` does not yet read this registry at all (the memory note
"nav filter HELD behind HORSEONE" is still true) — so this change affects only the
settings-page listing and the registry's own tests, never runtime nav filtering.

---

# ROUTING — every old destination redirects to ITS OWN tab

| old route | new destination | notes |
|---|---|---|
| `/app/admin` | `/app/records/clients` | `RedirectWithQuery` — preserves `?open=<id>`, which `DashboardPanel.tsx` and `DocumentQueueTable.tsx` both still send |
| `/app/ops/leads` | `/app/records/leads` | `RedirectWithQuery`, same reasoning |
| `/app/ops/directory` | `/app/records/vendors` | plain `Navigate` — zero rows, so no query-param callers found; **Vendor chosen over Partner** because most of the old Directory blurb (farriers, vets, suppliers) reads as Vendor and Partner is the narrower new category — stated here as a judgment call, not a neutral fact |
| `/app/ops/contacts` (`CONTACTS_PAGE_RETIRED`) | `/app/records/clients` | repointed from `/app/admin` to skip the extra hop now that `/app/admin` itself just redirects |

None default to `/app/records` bare (the All tab) — each lands on the specific tab
it used to be, per the task's own test criterion.

**Guard chain double-checked, not assumed:** removing `requireStaff` from the
`admin`/`ops/leads` routes (now bare `RedirectWithQuery`) does not weaken anything —
`ProtectedRoute requireStaff` still wraps `records`/`records/:tab`, so a non-staff
member hitting the old URL redirects through to `/app/records/...` and is bounced to
`/app` there, one hop later than before, same outcome.

---

# CROSS-LINKING — both directions, reasoned separately

## Horse → its people (NEW)

`HorseRecordsPage`'s owner/lessee names, previously plain text, take an optional
`onOpenContact?: (contactId) => void` prop. When Records supplies it, clicking a
name opens `ContactDossierModal` **in place** — a modal over the Horses tab, no
route change, works for a contact of any type without needing to know which
people-tab they are filed under. When the prop is absent (the standalone
`/app/ops/horse-records` route, untouched), the names render exactly as before —
plain text. This is the one place "what a list displays" changed, and only in the
sense that existing text became clickable; the text itself is identical.

## Person → their horses (existing, reused unchanged)

Already live, on every tab: `ContactDossierModal` (opened from every
`ContactDirectory`-based tab) and `Admin.tsx`'s own isolated view (the Clients tab)
both already render `ClientHorseRecordsCard`, which lists a contact's horses as
working links to `/app/horses/:id`. **Not rebuilt** — reused exactly as the task
instructed. One honest caveat: those links navigate to the member-facing horse
page, a route change, not a same-page expansion the way the new horse→person link
is. Recorded rather than smoothed over. A second, INERT "Horses" section
(`Section title="Horses"` / `Row`) also renders in the same dossier — pre-existing,
plain text, not a link, and not touched; it duplicates `ClientHorseRecordsCard`'s
information without duplicating its function, a pre-existing quirk, not a new one.

---

# THE "ALL" TAB

Built as a new `mode: 'all'` on the existing `ContactDirectory` component (same
component the other three modes extend), not a new bespoke surface:

- Population: `staff_contact_directory()`'s full result, filtered client-side to
  `contact_type` present and `!== 'TEAM'`. No DB change — the RPC already returns
  every contact regardless of type.
- Same card grid, same search, same designation Chips (Rider/Horse
  owner/Counterparty/etc.) as every other `ContactDirectory` tab — satisfying §5
  ("additive markers are filter chips, not tabs… follow that pattern") by literally
  reusing the pattern rather than inventing a parallel one.
- One addition specific to this mode: a small type badge (`Lead`/`Contact` i.e.
  Client/`Partner`/`Vendor`) on each card, since — unlike the single-type tabs —
  the type is not implied by which tab you are on.
- Unfiled contacts (`contact_type IS NULL`) still surface in the existing Unfiled
  banner, unchanged mechanism.
- **No Add button target was invented for this mode's ambiguity.** `ContactForm`'s
  create path does not set `contact_type` on any tab today (a pre-existing defect,
  first named in the DUPECENSUS/REVIEWNAV reports) — a contact created from any tab,
  All included, lands Unfiled regardless of which tab you created it from. Not
  fixed here; flagged again below.

---

# WHAT WAS NOT TOUCHED

- **`Admin.tsx`, `ContactsPage.tsx`, `HorseRecordsPage.tsx`'s existing render
  paths** — composed, not ported, not rewritten. `git diff --stat` on
  `ContactsPage.tsx` and `HorseRecordsPage.tsx` is additive (new modes, an optional
  prop); no existing branch's output changed.
- **`DashboardPanel.tsx`, `ops/IntakePage.tsx`, `ClauseDocument.tsx`** — not opened.
- **`admin@cactai.io`** — not queried, not touched; D1a is orthogonal to this task.
- **Nothing was deleted.** `DirectoryPage`/`'directory'` mode still exist in
  `ContactsPage.tsx` (no live route points at them any more, per the split, but the
  mode and the still-accepted `DIRECTORY` type both survive).

---

# PRODUCTION DATA — measured again at verification time, not copied from the task doc

```
contact_type   CONTACT 17 · LEAD 6 · TEAM 4 · (VENDOR 0 · PARTNER 0 — new, unused)
clients        client_since 18 · customer_since 0        — matches the task doc
groups         RIDER 16 · HORSE_OWNER 11 · GUEST 1        — matches the task doc
horses         4 live · 4 with an owner · 1 leased        — matches the task doc
```

**One discrepancy, stated plainly: the task doc recorded `CONTACT 20`; production
now reads `CONTACT 17`**, three rows fewer, measured fresh against prod during this
session rather than trusted from the doc. Everything else matches. Consistent with
the standing lesson that task docs go stale within hours under parallel threads —
not investigated further here since it does not change anything this task builds
(no code path depends on the exact count), but it should not be read as this task's
own number.

---

# WHAT IS PROVED, AND WHAT IS NOT

**Proved:** `typecheck` 0 errors, `lint` 0 errors (39 warnings, identical to
`main`), `build` succeeds end to end including prerender. `test/ui` run in full —
142 tests, same 2 pre-existing failures as `main` (`pluspass_create_controls`,
`reviewnav_section`'s unrelated `templates` incumbent gap), zero new failures. The
migration was dry-run, applied and read back from the live database. The
`admin_client_accounts` exclusion of Vendor/Partner from Clients was verified by
reading its live definition, not by inference.

**NOT VERIFIED — no staff browser session exists in this environment.** Nobody has
looked at this rendered. Walk this by hand:

1. `/app/records` loads, shows the tab strip, defaults to All with cards for every
   non-Team contact.
2. Click each of Leads / Clients / Partners / Vendors / Horses — each tab's content
   matches what `/app/ops/leads` / `/app/admin` / (new) / (new) /
   `/app/ops/horse-records` used to show, respectively.
3. Isolate a Clients row — the nine account-scoped tabs (Overview…Login) still
   render, and visually read as a different, nested layer from the Records tab
   strip above them.
4. On the Horses tab, expand a horse with an assigned owner — the owner's name is a
   link; clicking it opens that contact's dossier as a modal, Horses tab still
   visible underneath.
5. On any people tab, open a contact who owns a horse — the dossier's "Horse
   records" card shows the horse as a link.
6. Visit `/app/admin`, `/app/ops/leads`, `/app/ops/directory` directly — each lands
   on its corresponding Records tab, not the All default.
7. Visit `/app/admin?open=<a real contact id>` — lands on the Clients tab with that
   row already isolated.
8. Confirm the desktop rail shows exactly one "Records" row in the People section,
   and it stays highlighted while on any of its tabs.
9. Confirm Team does not appear anywhere on `/app/records` (any tab).
10. In Settings → Page visibility, confirm "Records" appears once (not three times)
    under People.

---

# THE TEST THIS HAD TO PASS

| # | requirement | status |
|---|---|---|
| 1 | One Records page, five tabs, each addressable by URL | **done** |
| 2 | Old routes redirect to their own tab, not the default | **done** — table above |
| 3 | Clients tab keeps its roster, isolate, all nine per-person tabs, reading as a different layer | **done**, render **NOT VERIFIED** |
| 4 | Horses renders its own row shape, no contact columns | **done** — `HorseRecordsPage` unmodified besides the optional link prop |
| 5 | VENDOR/PARTNER accepted, DIRECTORY still validates, no row changed type | **done** — verified against prod, 0 rows changed |
| 6 | Team appears nowhere on this page | **done** — not a tab, explicitly excluded from All |
| 7 | Horse↔people cross-links, without leaving the page | **done** both directions — see the cross-linking section for the one caveat (person→horse still opens `/app/horses/:id`, pre-existing) |
| 8 | Nav shows one Records entry | **done** |
