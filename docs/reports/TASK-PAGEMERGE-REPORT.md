# TASK PAGEMERGE — report

Built directly (no subagents, per CLAUDE.md) in worktree `wt-pagemerge`, branch
`task/pagemerge`, base `origin/main` @ **`9deb682`**. **Not pushed** — per the
task doc, the orchestrator merges.

**Operational note:** `main` moved once *during* this session (`9deb682`,
`partystaging: revoke direct anon grants…`, RPC-grants only — verified it does
not touch any file this task edits). Consistent with this repo's standing
pattern of concurrent threads; rebase before merging if `main` has moved
further.

---

## 1. THE CENSUS — re-derived against current `main`, not copied from the manifest

Input was `docs/reports/TASK-DUPECENSUS-REPORT.md` (2026-08-12, 1537 lines) and
`src/lib/reviewSection.ts`'s 13 `REVIEW_GROUPS`. Both explicitly warn they go
stale fast. Re-verified every claim against code before acting, per the task's
own instruction. One correction to the task doc's own framing: **the "second
'Records' nav row" it doesn't mention was the single largest live defect
found** — see §2.1.

| group | reviewSection.ts state | what I found on `main` | disposition |
|---|---|---|---|
| **horses** (roster) | 3 slots, C "live, not dark" | **A 3rd, undocumented problem**: two nav rows both labeled "Records" (Management → `/app/records`, Modules → `/app/ops/records`), landing on different pages. All three implementations already retired-by-boolean; RecordsHubPage's roster was the last live one, redundant with Records' Horses tab. | **RESOLVED this session** — see §2.1 |
| **staff-home** | A live, B/C url-only | Unchanged. `/app/ops` (OpsDashboard, the module launcher) and `/app/ops/preview/instructor-home` still have no nav row and no production account can reach InstructorHome any other way. | **Not touched** — needs an owner look, not code. See §3 |
| **inbound** | "now all read `inbound_open_count()`" | Confirmed: `OpsDashboard.tsx`'s KPI tile now calls `inbound_open_count()` (TASK-COUNTFIX, 2026-08-12, already on `main`). Dashboard badge, band, and KPI tile agree. | **Already resolved** (before this session) — verified, not re-touched |
| **people** (Records) | "RESOLVED 2026-08-12 by TASK-RECORDS" | Confirmed live: `/app/records` with Leads/Clients/Partners/Vendors/Horses/Lessons/Documents/Files/Deals tabs. But its own create-path defect (flagged in reviewSection.ts's own 'contact-editor' warn) was still live. | **Defect fixed this session** — see §2.2 |
| **contact-editor** | A dossier (in use), B 4-field form | `ContactForm`'s create path still didn't set `contact_type` — confirmed live in production code (`ContactsPage.tsx`, whose `LeadsPage`/`PartnersPage`/`VendorsPage`/`AllRecordsPage` exports are what `RecordsPage.tsx` actually renders; this is NOT dead code behind the retired unified route). | **Defect fixed, group left open** — see §2.2 |
| **account** | A in use, B url-only, 3 synthetic accounts | Confirmed. Additionally found: `<TwoFactorSettings/>` was mounted **only** on the page being compared away — `MyLoginContent` had no 2FA control at all, so 2FA was unreachable for every real member. | **RESOLVED this session** — see §2.3 |
| **time** (Calendar/Schedule) | A in use, B url-only, RSVP only in B | Confirmed unchanged. `/app/schedule` still has no nav row; still reachable only via `DashboardPanel`'s two "Coming up" tiles. RSVP (`fetchEvents`/`fetchMyRsvps`/`setRsvp`) still lives only there. | **Not touched** — porting RSVP into Calendar is new UI, not a merge; flagged as a follow-up, not attempted |
| **catalog** | 27/24/0 counts, `/acquisition` renders zero | `/acquisition` empty state and the footer's two `/shop` links are **already fixed** (TASK-COUNTFIX 1.5, comments confirm, already on `main`). `ServiceSelector`'s `role="radiogroup"`/`aria-checked` semantics already correct. | **Already resolved** (before this session) — verified, not re-touched |
| **document** (viewer + body) | A/B viewers, 3 body renderers | `DocumentQueueTable` already dispatched `contract_id ? /app/contracts : /app/ops/documents` correctly; **`Admin.tsx`'s two document links still sent every document to the read-only viewer**, confirmed live (8 of 77 documents affected). Body-renderer triplication (`ContractBody`/`MergedBodyView`/`documentPdf.ts`) unchanged — not attempted. | **Dispatch defect fixed this session**; body-renderer consolidation not attempted — see §2.4 and §3 |
| **signing** | 5 surfaces, 3 writers, no shared block | Unchanged — not re-verified in depth this session. | **Not touched** — see §3 |
| **staff-roster** | Team live, Employees module-disabled | Unchanged; `mod.employees` still off for FHE. | **Not touched, correctly low-priority** (DUPECENSUS's own ranking) |
| **templates** | New page, review-only nav row | **Confirmed unreachable**: `ab45b18` (2026-08-15) deleted the Review nav group same day this page's only nav row lived in it. `/app/ops/admin/templates` was live-but-orphaned — a real regression, not a duplicate. | **RESOLVED this session** — see §2.5 |

**Groups accepted out of `REVIEW_GROUPS` this session** (their own documented
procedure — delete the entry, restore/replace the nav row, retire any
review-only route): `horses`, `account`, `templates`. `contact-editor`'s slot B
`warn` text updated in place (defect fixed, group intentionally left open —
the bigger consolidation was not attempted). 10 groups remain for a future
pass; none of their review-only mounts were touched.

---

## 2. WHAT WAS MERGED, AND WHAT WAS HARVESTED

### 2.1 Horse roster — the duplicate nav row

**The live defect reviewSection.ts didn't name:** `AppLayout.tsx` carried
**two** nav rows both labeled "Records" — `MANAGEMENT_GROUP`'s
`/app/records` (unconditional) and `MODULES_GROUP`'s `/app/ops/records`
(gated on `mod.horserecords`, **enabled** for FHE, so both rendered at once).
The second was `RecordsHubPage`'s own roster — a **third** listing of the same
4 horses the Records page's Horses tab (`HorseRecordsPage`) already shows.
Exactly the "two rows, one concept" pattern CLAUDE.md names as this project's
recurring failure, and the thing rule 5 exists to catch.

**Survivor:** `HorseRecordsPage`, rendered as Records' Horses tab (unchanged
from before this session).

**Harvested into the survivor, both confirmed still missing before this fix:**
- **Breed/colour lookup resolution** (DUPECENSUS 2.1, slot B's one unique
  capability). `horses.breed`/`.color` are lookup CODES
  (`horse_breeds`/`horse_colors` FKs); `HorseRecordsPage` rendered the raw
  code. Fix: `lookupName()` moved from a component-local function
  (`HorseTable.tsx`) to `src/lib/ops/types.ts` (next to `contactName()`, the
  same kind of shared display-formatter) so both surfaces call the same
  function; wired into `HorseRecordsPage`'s summary line and record detail
  (`HorseRecordsPage.tsx`).
- **Ownership + Health lane links** (slot C's two unique capabilities —
  `/app/ops/records/horses/:id/parties` and `/health`, unaffected routes,
  independent of the roster). Added as a "Records" row per horse in
  `HorseRecordsPage.tsx`'s expanded record, next to the existing Documents
  row.

**Retired:** `RecordsHubPage`'s roster, behind a new `RECORDS_HUB_RETIRED`
boolean (`src/pages/app/ops/hubs/RecordsHubPage.tsx`). `/app/ops/records` now
redirects to `/app/records/horses` (App.tsx) — bookmarks still land. The two
lane **routes** (`/app/ops/records/horses/:id/parties`, `/health`) are
untouched and still resolve directly; they were never gated by this flag.

**Nav:** the `MODULES_GROUP` "Records" row removed (`AppLayout.tsx`) — not a
re-add of a retired row (rule 5's concern), the concept it pointed at no
longer has a page of its own. One "Records" row remains, in Management.

### 2.2 People / Contact editor — the create-path defect

DUPECENSUS 2.3/2.4 found: creating a contact from a filtered tab (e.g. "New
lead" on Leads) wrote a bare `contacts` row with no `contact_type`, so the new
person never appeared on the page that created them — they'd show up on
Records' "All" tab instead. Confirmed still live: `ContactForm` (the create
form) has no `contact_type` field, and `ContactsPage.tsx`'s `save` function
did a bare `createContact(input)` with no follow-up.

**Fix** (`src/pages/app/ops/ContactsPage.tsx`): after a successful create, if
the active tab (`mode`) maps to a `contact_type` (`MODE_TYPE[mode]`), call
`setContactType(created.id, type)` — the same RPC the existing "Unfiled"
filing control already uses. 'all' has no single type, so a create from there
is left unfiled, unchanged from before.

**Not attempted:** DUPECENSUS's larger recommendation — retire `ContactForm`
entirely and rebuild its create path on `ContactDossierModal`'s
`update_contact_record()` RPC. That's a bigger, riskier change (different
write path, different field set) than the scope here; the `contact-editor`
review group is left in place with its `warn` text updated to say what's now
fixed and what still isn't.

### 2.3 Account surface — the unreachable 2FA control

Checking DUPECENSUS's own instruction before retiring `/account` ("verify
`TwoFactorSettings` is reachable in `MyLoginContent` first") surfaced that its
premise was **false**: `MyLoginContent` (`ProfileAndPreferences.tsx` →
`LoginSecurityCard.tsx`) has Login/Password/Google rows but **no 2FA control
at all**. `<TwoFactorSettings/>` was mounted only on `/account`, which
redirects every real member away before it renders (`isMember` check,
`Account.tsx`). **Two-step verification was unreachable for every actual
production user** — confirmed by grep, only one render site existed.

**Fix:**
- `<TwoFactorSettings/>` added to `LoginSecurityCard.tsx`'s Login & Security
  section (self-contained component, no props needed — a straight drop-in).
- `/account` retired behind a new `ACCOUNT_PAGE_RETIRED` boolean
  (`src/pages/Account.tsx`); `App.tsx` redirects it to `/app`, extending the
  `isMember`-only redirect the page already had for its remaining audience.
  Nothing else on the page (orders list, profile form) was reachable by any
  route this session added or removed — it was already dead for real members
  and stays retired, not deleted.

### 2.4 Document viewer — dispatch consistency

DUPECENSUS 2.7: `DocumentQueueTable.tsx` correctly dispatches
`contract_id ? /app/contracts/:id : /app/ops/documents/:id`; `Admin.tsx`'s two
document links (the logged-in client's "Documents" tab and the
provisioned-client "Associated items" list) always sent the reader to the
read-only viewer. Confirmed: **8 of 77 live documents carry a `contract_id`**
and open two different ways depending on which page you clicked from.

**Root cause:** neither of `Admin.tsx`'s two data sources
(`admin_client_documents()`, `admin_client_items()`) returned `contract_id` —
the frontend had nothing to route on.

**Fix:**
- Two migrations, additive, dry-run in `BEGIN…ROLLBACK` then applied and
  verified against prod (`db.lrstswfxfsezdmvkvukc`) per CLAUDE.md's discipline:
  - `20260815T1830_admin_client_documents_contract_id.sql` — `DROP`+`CREATE`
    (return shape changed), adds `contract_id uuid` to both arms of the
    UNION (real documents get the real value; synthetic not-yet-generated
    rows get `NULL`, matching their existing `href: undefined`).
  - `20260815T1840_admin_client_items_contract_id.sql` — `CREATE OR REPLACE`
    (jsonb return unchanged), adds `'contract_id', d.contract_id` to the
    `documents` array.
  - **Caught mid-fix:** my first draft of the second migration copied the
    function body from an old migration FILE, which still built an
    `engagements` array — but `engagements` is RETIRED (CLAUDE.md) and no
    longer exists in prod; a later, unfiled rewrite had already dropped that
    arm. Caught by the dry-run erroring (`relation "engagements" does not
    exist`), not by inspection. Corrected by pulling the live body via
    `pg_get_functiondef` instead of trusting the migration file — the exact
    lesson CLAUDE.md's migration-convention section states and the reason
    this session re-learned it the hard way.
- New shared helper `src/lib/documentHref.ts` (one function, matches the
  `linkOrigin.ts` precedent for small single-purpose seams) — used at **all
  three** call sites now: `DocumentQueueTable.tsx` (already correct, now
  shares the rule instead of re-typing it) and `Admin.tsx`'s two links (now
  fixed).
- `AdminDocRow` (`Admin.tsx`) and `ClientItems` (`src/lib/admin.ts`) widened
  with `contract_id: string | null`.

**Not attempted:** the body-renderer triplication (`ContractBody` /
`MergedBodyView` / `documentPdf.ts`'s regex) — DUPECENSUS's recommendation to
extract the shared signature-line regex to one constant is still open.

### 2.5 Templates — a live page that had gone unreachable

`AdminTemplatesPage` (`/app/ops/admin/templates`, TASK-TEXTEDIT) only ever had
a nav row inside the temporary Review section. `ab45b18` (2026-08-15, same
day) deleted the Review nav group — "the review PAGES and routes survive... 
only the nav group is gone" — which left this **real, live, already-shipped**
editor with no way in except typing the URL. Not a duplicate; just orphaned by
a same-day change elsewhere.

**Fix:** added to `SETTINGS_GROUP` beside Forms (`AppLayout.tsx`), exactly
where `reviewSection.ts`'s own entry said it was owed ("on acceptance its nav
row belongs in SETTINGS_GROUP beside Forms"). `adminOnly: true`, matching the
route's `requireAdmin` guard. New icon (`NotebookPen`) rather than a fourth
`Shield` in a group that already had three (the icon exercise's named
defect). Also corrected an adjacent stale comment claiming this was "blocked
on the one-engine-vs-two ruling" — D12 settled that 2026-08-12; nothing blocks
it now.

**Also removed** (adjacent, found while reading the file): a dangling header
comment at the top of `AppLayout.tsx` describing an import that `ab45b18` had
already deleted — described code that no longer existed, left for a future
reader to trip over.

### 2.6 Toggles — none built

**Zero groups needed an A/B/C toggle.** Rule 3 is for competing layouts of
the *same page* the owner hasn't chosen between. Every group re-verified this
session already has a clear incumbent with harvestable losers (DUPECENSUS's
own framing for 12 of 13 groups) or is a dispatch/reachability defect, not a
layout choice. The nearest candidate — staff landing page (DashboardHome vs.
OpsDashboard vs. InstructorHome) — isn't three layouts of one page; they're
three different-purpose surfaces (daily work dashboard / module launcher /
role-specific preview), and DUPECENSUS's own verdict there is "unjudgeable
from code, the owner needs to look," not "ship all three side by side."
Recorded as open in §3, not toggled.

---

## 3. WHAT'S STILL OPEN (not attempted this session — reported, not built)

- **Staff landing page.** `OpsDashboard`'s module launcher (six
  entitlement-gated tiles, the only one in the app) has no nav row and no
  home in `DashboardHome`. `InstructorHomePreview` still can't be seen any
  other way (no MANAGER/EMPLOYEE account exists in production). This needs an
  owner look at the preview, then a decision — not a merge I can make from
  code.
- **Member time surface.** `/app/schedule`'s community-events RSVP
  (`fetchEvents`/`fetchMyRsvps`/`setRsvp`) is still the only RSVP surface in
  the app and still has no nav row. Porting it into `CalendarPage` is new UI
  work (a "Community events" panel), not a merge of existing code — didn't
  attempt it this session to keep the diff reviewable.
- **Signing capture** (5 surfaces, 3 writers) and the **document body
  renderer triplication** — unchanged. DUPECENSUS's recommended shared
  `<SignatureBlock>` and shared signature-line regex constant are both still
  open.
- **`contact-editor`**: the full DUPECENSUS-recommended consolidation
  (retire `ContactForm`, rebuild its create path on `ContactDossierModal`'s
  RPC) — only the narrower create-path defect was fixed (§2.2).
- **Staff roster** (Team vs. the disabled Employees module) — correctly
  low-priority per DUPECENSUS's own ranking; not touched.

---

## 4. RULE COMPLIANCE

1. **Current census produced first, and reported before any group was
   touched** — §1.
2. **Every merged group: survivor = incumbent, losers harvested or dropped
   with a reason, line-numbered.** §2.1–2.5. Nothing was dropped silently.
3. **Toggled groups: none, and why** — §2.6.
4. **Nothing deleted.** New retirement booleans (`RECORDS_HUB_RETIRED`,
   `ACCOUNT_PAGE_RETIRED`) follow the existing pattern exactly
   (`HORSES_PAGE_RETIRED`, `CONTACTS_PAGE_RETIRED`, `INTAKE_PAGE_RETIRED`);
   both retired routes still resolve (redirect). No file was deleted, no
   component body stripped.
5. **Nav unchanged from `ab45b18` except where this merge's own outcome
   requires it, or an orphaned page needs its home back:**
   - Removed: `MODULES_GROUP` "Records" (`/app/ops/records`) — a duplicate
     row for a page whose roster no longer exists; not a re-add case.
   - Added: `SETTINGS_GROUP` "Templates" — restoring reachability for a
     shipped page whose only nav row was deleted same-day by `ab45b18`,
     exactly the kind of "put back where it belongs now with this merge"
     the owner's instruction covers.
   - Every other row from `ab45b18` is untouched (verified: `Contact` icon
     import checked, the Employees row that a bad `Edit` briefly dropped was
     caught by `tsc` and restored before this report was written).
6. **Typecheck, lint, build all clean at parity with baseline** — `tsc
   --noEmit`: 0 errors. `eslint`: 40 problems (1 error, 39 warnings) —
   **identical to `main`'s own baseline**, re-run on `main` directly to
   confirm (1 pre-existing unrelated test-file error, 39 pre-existing
   warnings; this session added zero net warnings — one new export triggered
   a fast-refresh warning, resolved by relocating the helper rather than
   accepting the regression). `npm run build`: succeeds, including
   prerender; the two `<Navigate>`-in-`StaticRouter` console warnings during
   prerender (`/ride`, `/membership`) are pre-existing, confirmed identical
   on `main`, unrelated to any route this task touched.

---

## 5. OWNER CHECKLIST — every render claim NOT VERIFIED in a browser

No browser was used (no UI test run this session). Everything below is
derived from code, migrations, and DB queries, not from looking at the page.

1. `/app/records/horses` — expand a horse, confirm breed/color show resolved
   names (not raw codes like `TWH` / `BAY`) and the new "Records" row shows
   working **Ownership** and **Health** links.
2. `/app/ops/records` — confirm it redirects to `/app/records/horses`
   (bookmark still lands) and the nav no longer shows two "Records" rows.
3. `/app/ops/admin/templates` — confirm it now appears under Settings,
   between Forms and (nothing) — no separate check-in needed if it renders,
   this is a nav-visibility claim only.
4. Create a person from `/app/records/leads` ("+ Add"), confirm the new row
   appears on the **Leads** tab, not just "All". Repeat on Partners/Vendors.
5. `/app/account` → My Login — confirm a "Two-step verification" card renders
   below the Google row and that enrolling (scan → verify code) works.
6. Visit `/account` directly while signed in — confirm it redirects to
   `/app` instead of rendering the old page (for every account, not just
   members — this is new behavior for the 3 synthetic non-member accounts).
7. Open a contract-backed document (one of the 8 with `contract_id`) from
   `/app/admin`'s Clients → a client's Documents tab, or from the
   provisioned-client "Associated items" list — confirm it opens
   `/app/contracts/:id` (the authoring page), not `/app/ops/documents/:id`.

---

## 6. FILES TOUCHED

```
src/App.tsx                                          — 2 retirement wire-ups
src/components/app/AppLayout.tsx                      — nav row swap, stale comment cleanup
src/components/app/profile/LoginSecurityCard.tsx      — TwoFactorSettings mount
src/components/ops/documents/DocumentQueueTable.tsx    — shared documentHref
src/components/ops/horses/HorseTable.tsx               — lookupName relocated
src/lib/admin.ts                                       — ClientItems.contract_id
src/lib/documentHref.ts                                — new, shared helper
src/lib/ops/types.ts                                   — lookupName (shared)
src/lib/reviewSection.ts                               — 3 groups accepted, 1 warn updated
src/pages/Account.tsx                                  — ACCOUNT_PAGE_RETIRED
src/pages/app/Admin.tsx                                — documentHref at 2 sites
src/pages/app/ops/ContactsPage.tsx                     — contact_type on create
src/pages/app/ops/HorseRecordsPage.tsx                 — breed/colour + lanes harvested
src/pages/app/ops/hubs/RecordsHubPage.tsx               — RECORDS_HUB_RETIRED
supabase/migrations/20260815T1830_admin_client_documents_contract_id.sql  — applied to prod
supabase/migrations/20260815T1840_admin_client_items_contract_id.sql     — applied to prod
```

Both migrations are **already applied to prod** (dry-run → apply → verify per
CLAUDE.md's convention) — that part of the diff is live regardless of when
this branch merges. Everything else is frontend-only, on `task/pagemerge`,
not pushed.
