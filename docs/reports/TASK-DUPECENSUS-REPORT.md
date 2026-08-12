# TASK DUPECENSUS — every duplicate, every implementation, and which one to build from

**Produced 2026-08-12** · worktree `wt-dupecensus`, branch `task/dupecensus`, base `origin/main` @ **`9481414`**
**No code changed.** `git diff` against the base shows `docs/` only.

> **The census was re-based TWICE mid-flight and re-verified each time.** I started against
> `33525cd`. While I worked, six threads landed on `main`: **LEADCLEAN** (`5d54177`),
> **FRAMESCROLL** (`29597ff` + `bab6fdd`), **ADMINSWEEP X-1** (`0687429`), the **Team nav move**
> (`7f20103`), and two docs commits — **FORMS-ARE-UNUSED** (`f6da69f`) and the **ONEPEOPLE spec**
> (`9481414`). Four of them changed code this report judges. I rebased to `0687429`, then to
> `9481414`, and **re-ran every affected check against the new code rather than shipping the
> older reading.** Findings closed by another thread are marked **CLOSED** and kept, because the
> *pattern* is what the owner is ruling on. Everything else below is the post-merge number.

**What those merges changed in this report:**

| finding | change |
|---|---|
| **1.1** inbound counts | shrank from a three-way disagreement (**5/7/12**) to a two-way one (**5/5/12**) — LEADCLEAN fixed the badge↔band gap |
| **2.1** horse roster | the `DataTable` scroll caveat is **resolved** by FRAMESCROLL, which *strengthens* the recommendation |
| **2.3** people pages | the duplicate nav entry is **fixed**; and the owner has since specced **`TASK-ONEPEOPLE`**, which supersedes my recommendation — **my capability diff is written to feed it, not to compete with it** |
| **3.7** retirements | a **second** page-hiding constant now exists (`INTAKE_PAGE_RETIRED`) |
| the manifest | People and Inbound rows rewritten; two "MOVE this nav row" instructions became "ADD one" |

---

# HOW TO READ THIS

**What the owner asked for:** *"Id liked to see every single implementation of every duplicate
made to decide which to build from. Often the UI is nice in the original and the hack ass
replacement is shoddy and worth shit."*

So every entry below carries, per implementation: **file + line count · route you can type ·
creation commit (SHA, date, message) · reachability today · exactly what it reads · what it can
do the others cannot · a verdict with its evidence.** Then one recommendation: build from
which, keep which URL, carry across what.

**Two rules I held to and you should hold me to:**

1. **I have not seen these pages.** No browser was used. Every appearance claim is marked
   **NOT VERIFIED** and every judgement is derived from readable code markers, stated openly.
   Where code cannot settle it, I say so and give you the URL to open.
2. **Every number is proven against production** (`db.lrstswfxfsezdmvkvukc`, read-only queries,
   2026-08-12). Direct `psql` has NULL auth — `current_org()`, `auth.uid()` are NULL and
   `has_staff_access()` is `false` — so org-scoped RPCs legitimately return 0 through that
   connection. **I never ran an org-scoped RPC and reported its zero.** I read each function
   body and re-ran its logic with FHE's real `org_id`
   (`e656f20b-ef43-4725-9029-19e7f0190d9c`) substituted. Where RLS changes the answer for a
   real signed-in staff account, I computed the RLS-scoped number too and say which is which.

---

# THE RANKING, AND WHY

Ordered by **what it costs you**, not by file or alphabet:

- **TIER 1 — the app lies.** Two surfaces, one word, two numbers. These are worst because you
  cannot tell you are being misinformed; the screen looks fine. Five of these.
- **TIER 2 — duplicated surfaces you touch daily.** Two or more real implementations of a
  thing you use. Cost is confusion, divergent fixes, and the wiring chases you have already
  paid for. Nine of these.
- **TIER 3 — dead or unreachable implementations.** Real code, nobody reaches it. Cost is low
  today and high the moment somebody edits the wrong one — which is exactly how `HorsesPage`
  became a mystery two months later. Seven of these.

Within a tier: by how often the surface is hit.

---

# WHAT I DID NOT REACH

Stated plainly so you do not read coverage into silence:

- **`api/` (serverless) and `supabase/migrations/`** were not swept for duplication. Only
  `src/` and the DB functions those surfaces call.
- **Email templates** (`api/`-side) were not compared against each other.
- **The three superadmin pages** (`/app/ops/superadmin/*`) were inventoried but not
  quality-scored — they are platform-owner surfaces, out of the tenant UI the owner is ruling on.
- **`ContractPage.tsx` (2,293 lines) and `ContractCascade.tsx` (1,600 lines)** were read only
  where they touch duplication (body rendering, signing, deep links). They were not audited
  internally for self-duplication; at that size there is likely some, and it is a task of its own.
- **CSS/token duplication** beyond counting arbitrary Tailwind values per file.

---

# TIER 1 — THE SURFACES THAT DISAGREE ABOUT A NUMBER

## 1.1 "Inbound work waiting": three definitions were **5 / 7 / 12** — LEADCLEAN closed one, **5 / 5 / 12** remains

The sharpest case in the app. One concept — *what has come in and needs dealing with* — counted
three different ways on three surfaces a staff account sees in the same session.

> **PARTIALLY CLOSED by `TASK-LEADCLEAN` (`5d54177`, merged 2026-08-12, during this census).**
> When I began, the Dashboard **badge** said 5 and the Dashboard **page** said 7, and the
> comment claiming they were the same predicate was false. LEADCLEAN rewrote `useOpenLeads` to
> read `inbound_queue.already_converted` — *"the definition the database already computes on
> every row"* — and **they now agree at 5**, re-verified against production after the merge.
> The comment at `useOpenLeads.ts:62-65` is now **true**.
>
> **`/app/ops` still says 12.** That surface was not in LEADCLEAN's scope and is untouched.

### Implementation A — the Dashboard nav badge — says **5**

- **File:** `src/lib/api.ts:394` (`inboundOpenCount()`) → DB function `inbound_open_count()`;
  rendered at `src/components/app/AppLayout.tsx:1386`.
- **Route:** the badge on the **Dashboard** nav row, visible on every page in the app.
- **Created:** the badge's current home is `86a2c33`-era nav work; the summing behaviour is
  documented in `AppLayout.tsx:1375-1382`.
- **Reachability:** nav — Management group, first row. Unavoidable.
- **What it reads:**
  ```sql
  (SELECT count(*) FROM inbound_queue q
    WHERE q.org_id = current_org() AND q.status NOT IN ('converted','expired')
      AND NOT coalesce(q.already_converted,false))
  + (SELECT count(*) FROM support_requests WHERE org_id = current_org() AND status <> 'resolved')
  ```
- **Production, org substituted:** `4 + 1 + 0` → **5**.

### Implementation B — the Dashboard page's "New leads" band — said **7**, now says **5**

- **File:** `src/lib/ops/useOpenLeads.ts` (91 lines post-LEADCLEAN) → rendered by
  `src/components/app/DashboardPanel.tsx:377-383`, with `LeadWorkDrawer.tsx` (541 lines, new)
  as the in-place working surface.
- **Route:** `/app/dashboard`.
- **Created:** `8f70710` · 2026-08-11 · *"DASHLEADS: leads render as dashboard entries at
  /app/dashboard, not a second page"*; rewritten by `3848dfe` · 2026-08-12 · *"LEADCLEAN: the
  dashboard cleans itself; Inbound retires, its machinery does not"*.
- **Reachability:** nav — the page the badge above sits on.
- **What it read (at `33525cd`):** `listBookingRequests('new')` → `requests` where
  `status = 'new'`, plus unresolved support. **Production: 7.**
- **What it reads now (at `0687429`):** `listLeadQueue()` → `inbound_queue` where
  `already_converted IS NOT TRUE` **and** `status NOT IN ('converted','expired')`, plus
  unresolved support. **Production: 5** — and it additionally returns the 7 converted rows as a
  separate *history* list rather than mixing them into the work.

> **The comment I flagged has been repaired by the code catching up to it.** At `33525cd`,
> `useOpenLeads.ts:38` (at `33525cd`) claimed to use *"the SAME two conditions `inbound_open_count()` counts"*
> and did not — it counted `status='new'` and did not exclude `already_converted`, so badge and
> band disagreed by 2. At `0687429` the same claim sits at `useOpenLeads.ts:62-65` and **is now
> accurate**, because LEADCLEAN moved the predicate to `inbound_queue.already_converted`. I am
> reporting this rather than deleting it because it is the clearest example in the codebase of
> the failure mode the owner is asking about: **a comment asserted a guarantee the code did not
> provide, for a month, and nothing caught it.**

### Implementation C — the Ops dashboard KPI tile "Intake to review" — says **12**

- **File:** `src/pages/app/ops/OpsDashboard.tsx:34` (`countPendingIntake`) → `listIntake()`
  (`src/lib/api.ts:1293`).
- **Route:** `/app/ops` (admins). **URL-only — nothing in the nav links here.**
- **Created:** `257a64c` · 2026-07-01 · *"feat(app): feature group B (partial) — ops CRM core
  before session cap"*.
- **What it reads:** every row of `requests`, filtered client-side to
  `status IN ('new','contacted')`. No `already_converted` filter, no support requests.
- **Production:** `7 + 5` → **12**.

### Implementation D — the Inbound page — **RETIRED during this census**

- **File:** `src/pages/app/ops/IntakePage.tsx` — **907 lines at `33525cd`, 463 at `0687429`**.
  It held **two** list surfaces: the flat inbound list and `RequestInbox` (still present at
  line 95, reached via `?request=<id>`).
- **Route:** `/app/ops/intake`.
- **Retirement constant:** **`INTAKE_PAGE_RETIRED = true` at
  `src/pages/app/ops/IntakePage.tsx:447`** (exported; `App.tsx:91,289` renders
  `IntakeRetiredRedirect` while true). **New — it did not exist when this census began.**
- **Created:** `9038bf4` · 2026-07-01 · *"feat(ops): Wave-7 part 1 — intake, payment review,
  5 module surfaces + hubs, nav/route integration"*; retired `3848dfe` · 2026-08-12.
- **What it read:** `listBookingRequests()` (all statuses) + `listSupportRequests()`; separately
  `listInboundQueue()` for the "waiting on us" banner. **Rendered 12 rows.**

### The evidence, side by side

| surface | definition | at `33525cd` | at `0687429` (now) |
|---|---|---|---|
| Dashboard **nav badge** | not converted/expired, not already-converted, + open support | **5** | **5** |
| Dashboard **"New leads" band** | was `status='new'`; now the badge's own predicate | **7** | **5** ✅ agrees |
| `/app/ops` KPI **"Intake to review"** | `status IN ('new','contacted')` | **12** | **12** ❌ still wrong |
| `/app/ops/intake` list | everything | 12 rows | **retired** (`INTAKE_PAGE_RETIRED`) |

Underlying rows, unchanged: `requests` = 12 (7 `new`, 5 `contacted`), of which **7 are
`already_converted`**; `support_requests` = 0.

**So the live disagreement today is 5 vs 12 — one badge, one page, and a KPI tile on a page
nothing links to that says work exists which is already done.**

### Quality assessment

Scores below are read at **`0687429`** (post-LEADCLEAN).

| | A `DashboardPanel` (+`LeadWorkDrawer`) | C `OpsDashboard` | D `IntakePage` |
|---|---|---|---|
| lines | 489 (+542) | 222 | 464 (was 907) |
| `PageLayout`/`PageHeader` | no | no | no |
| loading branch | **no** (drawer: yes) | yes | yes |
| error branch | **no** — `.catch(() => …)` swallows (drawer: yes) | yes, **inline per tile** | yes |
| empty branch | yes — a warm "all caught up" | **no** | yes |
| responsive utilities | 11 (drawer: 1) | 4 | 2 |
| a11y attributes | 3 (drawer: **13**) | 5 | 6 |
| shared kit used | none (drawer: `Modal`, `StatusBadge`, `useAsync`, `useToast`) | `ModuleGate`, `useAsync` | `DataTable`, `StatusBadge`, `useAsync` |
| comment density | 13% (drawer: 8%) | **20%** | **15%** |
| arbitrary Tailwind values | **15** (drawer: **0**) | **0** | 5 |

**`LeadWorkDrawer` (new, 2026-08-12) is the best-built thing in this group** — 13 a11y
attributes, four shared kit components, zero arbitrary Tailwind values, all three branches. The
panel that hosts it still has none of those properties.

**Verdicts.**
- **`OpsDashboard`'s KPI tile — the better base for the NUMBER.** It is the only one with a
  per-tile error branch that renders "Couldn't load" instead of a blank tile, it is the only
  one with zero arbitrary Tailwind values, and it carries the highest comment density in the
  app (20%) explaining its own contract. Its *definition* is the worst of the three (it counts
  work that is already done), but its *machinery* is the most disciplined. **Usable — fix the
  filter, keep the tile.**
- **`DashboardPanel`'s band — the better base for the SURFACE, and now the incumbent.** It is
  where the owner actually looks, it renders real entries rather than a bare count, it has the
  only genuine empty state, and post-LEADCLEAN it uses the right predicate. But **the panel
  itself still has no loading branch and no error branch** — every fetch is `.catch(() => …)`,
  so a failed read renders as "you're all caught up." That is the app quietly telling you there
  is no work when it could not find out. It also carries **15 arbitrary Tailwind values**, the
  most in this group. **Usable, with a real defect LEADCLEAN did not touch.**
- **`IntakePage` — retired, and its 15% comment density and `DataTable` usage are worth
  inheriting.** LEADCLEAN kept the machinery (`RequestInbox`, `InboundAttention`) behind the
  boolean rather than deleting it, which is the right call — the *overdue vs already-handled*
  distinction lives there and nothing else computes it.

### Recommendation

- **Build from:** `inbound_open_count()` as the **single definition**, and make the remaining
  surface call it. Two of three now do; **`OpsDashboard.countPendingIntake` is the last
  holdout** and is the only reason this finding is still open.
- **Keep the URL:** `/app/dashboard` for the surface. `/app/ops` should not carry a rival
  intake tile at all (see 2.2).
- **Carry across before anything is deleted:**
  - from `OpsDashboard`: the **inline per-tile error branch** (`kpi-*-error`, `role="alert"`) —
    this is the thing `DashboardPanel` most needs and still lacks;
  - from `IntakePage` (retired, not deleted): the **overdue vs already-handled distinction** and
    `days_open`;
  - from `LeadWorkDrawer`: nothing — it is new and it is the model the rest should follow.
- **Effort:** the remaining disagreement is **one function body** (`countPendingIntake` → call
  `inbound_open_count`). The error-branch port is a **merge**.

---

## 1.2 "Documents attached" on a horse is wrong for **every horse in production**

### Implementation A — the horse record's documents field

- **File:** `src/pages/app/ops/HorseRecordsPage.tsx:104-108`.
- **Route:** `/app/ops/horse-records` → expand a horse → "Documents · N attached", with a
  `FileText` icon and an "open queue" link to `/app/ops/documents`.
- **What it reads:** `staff_horse_records().document_count`, which is
  ```sql
  SELECT count(*) FROM horse_relationships r
   WHERE r.horse_id = h.id AND r.source_document_id IS NOT NULL
  ```
  — a count of **relationship rows created by a document**, not a count of documents.

### Implementation B — the documents queue

- **File:** `src/lib/api.ts:1164` (`listDocuments()`), rendered by
  `src/components/ops/documents/DocumentQueueTable.tsx` (350 lines).
- **Route:** `/app/ops/documents`, filterable **By horse**.
- **What it reads:** `documents` where `deleted_at IS NULL`, with `horse_id` embedded.

### The evidence

| horse | A says "N attached" | distinct source documents | B (`documents.horse_id`) |
|---|---|---|---|
| Beau | **3** | 2 | **5** |
| Peep Show | **0** | 0 | **6** |
| Secret | **0** | 0 | **5** |
| Tiz | **0** | 0 | **8** |

**Not one of the four agrees.** Three horses read "0 attached" next to a documents icon while
holding 5, 6 and 8 documents. Beau reads "3" for 2 documents because two relationship rows
share one source document.

**Verdict:** this is not two implementations competing — it is **one label attached to the
wrong quantity**. `staff_horse_records` is otherwise the best horse reader in the app (see 2.1);
the defect is one sub-select and one field name.

### Recommendation

- **Build from:** `staff_horse_records()` — keep it, change `document_count`'s sub-select to
  count `documents` by `horse_id` (matching what the queue's "By horse" filter shows), or
  rename the field to what it actually counts.
- **Keep the URL:** unchanged.
- **Carry across:** nothing is lost either way — the relationship-provenance count is genuinely
  interesting, it just is not "documents".
- **Effort:** a **one-line SQL change**. This is the cheapest correction in the report and the
  most visibly wrong thing in it.

---

## 1.3 "Lessons" counts **318** where **39** exist — open availability slots are rendered as sessions

### Implementation A — the member's own lessons

- **File:** `src/lib/ops/api-member.ts:96` (`myLessonSessions()`) → `my_lesson_sessions()`.
- **Route:** `/app/schedule` for a **non-staff** member; also the "Coming up" band on
  `/app/dashboard`.
- **Created:** `c34dab5` · 2026-07-02 · *"feat(portal): client portal wave …"*.
- **What it reads:** `bookings` where `kind='lesson' AND client_id = current_client_id() AND
  has_module('mod.lessons')`, `LIMIT 50`. Statuses are upper-cased by the RPC.

### Implementation B — the staff view of the same page

- **File:** `src/lib/ops/api-lessons.ts:283` (`listLessonSessions()`), selected at
  `src/pages/app/Schedule.tsx:54-56` when `isStaff`.
- **Route:** `/app/schedule` for a **staff** account. **URL-only** — `/app/schedule` is in no
  nav table; it is reached only from `DashboardPanel`'s "Coming up" tiles
  (`DashboardPanel.tsx:240,248`).
- **Created:** `9038bf4` · 2026-07-01.
- **What it reads:** `bookings` where `kind='lesson'` — **no status filter, no client filter**.

### Implementation C — the staff sessions board

- **File:** `src/pages/app/ops/lessons/SessionsPage.tsx` (336 lines).
- **Route:** `/app/ops/lessons/sessions`, reached from **Management → Lessons** (module
  `mod.lessons`, **enabled** for FHE).
- **Created:** `ace507f` · 2026-07-03 · *"feat(lessons): staff-confirmed lesson sessions +
  punch-card debits + purchase->credits sync"*.
- **What it reads:** the same `listLessonSessions()`, then filters by **time only**
  (Upcoming / Past / All) — never by status.

### The evidence

| definition | production |
|---|---|
| `bookings` where `kind='lesson'` — what B and C fetch | **318** |
| …of which `status='available'` (unbooked open slots) | **279** |
| …of which `status='scheduled'` (actual sessions) | **39** |
| C's default "Upcoming" filter (`ends_at >= now()`) | **218** |
| …upcoming AND `available` | **203** |
| …upcoming AND `scheduled` | **15** |

**Consequence, from code:** `Schedule.tsx` renders every returned row under the heading
**"Your lessons"** with a status chip driven by
`SESSION_STATUS_LABEL[s.status]` — a map whose only keys are `SCHEDULED`, `COMPLETED`,
`CANCELLED`, `NO_SHOW` (`Schedule.tsx:21-26`). `listLessonSessions` upper-cases the booking
status (`api-lessons.ts:125`), producing `AVAILABLE`, which is **not a key in that map**. The
label and the class both resolve to `undefined`. **NOT VERIFIED visually** — but there is no
code path that produces a label for those 279 rows.

### Quality assessment

| | A/B `Schedule.tsx` | C `SessionsPage.tsx` |
|---|---|---|
| lines | 182 | 336 |
| `PageLayout`/`PageHeader` | no | no |
| loading / error / empty | yes / **no** / yes | yes / yes / yes |
| responsive utilities | **0** | **0** |
| a11y attributes | 9 | 5 |
| shared kit used | **none** | `Modal`, `StatusBadge`, `ModuleGate`, `useAsync`, `useToast` |
| comment density | **2%** — the lowest of any page in this report | 6% |
| arbitrary Tailwind values | 0 | 0 |

**Verdicts.**
- **`SessionsPage` — the better base.** It uses five shared kit components, has all three
  branches, and is a real work board (Complete / Cancel / No-show, credit debits, day
  grouping). Its defect is the missing status filter, inherited from the shared reader.
  **The better base.**
- **`Schedule.tsx` — shoddy.** 2% comment density, no error branch, zero responsive
  utilities, no shared components, a status map that cannot label the data its own reader
  returns, and a role branch (`isStaff ? … : …`) that casts one type to another with
  `as unknown as` to make it compile. It is the oldest page in the group (`a345601` ·
  2026-06-23 · *"Members community app + admin panel"*) and it has not kept up. **Shoddy.**

### Recommendation

- **Build from:** `SessionsPage` for staff; `my_lesson_sessions()` for members — it is the only
  reader that is correctly scoped.
- **Fix at the source:** `listLessonSessions()` must exclude `status='available'`, or take a
  status argument. 279 open slots being served as "sessions" is one missing `.eq('status', …)`.
- **Keep the URL:** `/app/calendar` is where availability belongs and already renders it
  properly. `/app/schedule` should either get a nav entry or be folded into `/app/calendar` —
  it is currently a page nothing in the nav can reach (see 2.5).
- **Carry across from `Schedule.tsx` before retiring it:** the **community-events + RSVP
  section** (`fetchEvents` / `fetchMyRsvps` / `setRsvp`) — that is the only place in the app
  a member can RSVP, and it would be lost.
- **Effort:** the number is a **one-line filter**. The page consolidation is a **merge**.

---

## 1.4 A member's document count: **13** on one page, **5** on another

### Implementation A — My Documents

- **File:** `src/lib/api.ts:657` (`myDocuments()`) → `my_documents()`; rendered by
  `src/components/app/DocumentsContent.tsx` (477 lines).
- **Routes:** `/app/documents` **and** `/app/account` → "My Documents" (same component, one
  implementation — this is the app doing it *right*, see "Not duplicates" below).
- **Created:** `a345601` · 2026-06-23 · *"Members community app + admin panel"*.
- **Reachability:** nav — "My Documents" in the member rail, **but only for non-staff accounts,
  and only when the member actually has documents**: `presence = useNavPresence(!isStaff)`
  (`AppLayout.tsx:1160`) and `navLinks = PRESENCE_LINKS.filter((l) => presence[l.key])`
  (`:1168`). **A staff account has no nav route to its own documents at all.**
- **What it reads:** three unions — pending (generated, unsigned), **assigned-but-not-generated**
  (from `contact_required_documents`, a placeholder row with no document id), and executed.
  Scoped by `contact_id = current_contact_id() OR caller_is_document_party(id)`.

### Implementation B — Acquisition home's agreements list

- **File:** `src/lib/contracts.ts:211` (`myContractDocuments()`) → `my_contract_documents()`;
  rendered by `src/pages/app/DealHome.tsx` (87 lines).
- **Route:** `/app/deal`. **URL-only** (see 3.4 — no production account reaches it today).
- **Created:** `e611bcb` · 2026-07-14 · *"Build care & deal client dashboards; add Calendar to
  avatar menu"*.
- **What it reads:** party rows only (`JOIN document_parties`), **and only documents that have
  `contract_fields`** — i.e. clause-engine contracts. Excludes `document_party_hidden`.

### The evidence — per real production account

| account | `/app/documents` shows | `/app/deal` would show |
|---|---|---|
| cjzigs@icloud.com | **13** | **5** |
| sarahrosengard@gmail.com | **8** | **1** |
| claire.bourdon21@gmail.com | **6** | **0** |
| maeboon@gmail.com | **6** | **0** |
| madelinedo@gmail.com | **4** | **0** |

Three members would see an Acquisition home reading *"no agreements"* while their Documents
page lists six, six and four.

**Verdict:** these are not rivals — they answer different questions (*everything of mine* vs
*negotiable contracts I am a party to*). The damage is that **both are labelled the same way to
the member**: `DealHome`'s heading is agreements, `DocumentsContent`'s is documents, and a
member has no way to know why one is empty.

### Recommendation

- **Build from:** `my_documents()`. It is the complete one, it includes the assigned-but-not-yet-
  generated placeholders (the only reader that tells a member about paperwork that has not been
  produced yet), and it is what the nav points at.
- **Keep the URL:** `/app/documents`.
- **Carry across:** `my_contract_documents()` should stay as a **filter**, not a second list —
  its `open_change_requests`, `my_roles` and `is_originator` fields are real and `ContractPage`
  needs them. `DealHome` should render `my_documents()` filtered to contracts, so the two can
  never disagree about whether a document exists.
- **Effort:** a **merge** — one reader, one filter argument.

---

## 1.5 The public catalog: **27** items on one page, **24** across the funnels, **0** on `/acquisition`

### Implementation A — `OfferingCatalog`

- **File:** `src/components/OfferingCatalog.tsx` (199 lines).
- **Routes:** `/shop` and `/app/catalog`.
- **Reachability:** `/app/catalog` — **app nav → "Catalog"**. `/shop` — **site footer**, twice:
  the footer's Navigation list contains **`{ label: 'Ways to Ride', href: '/shop' }` and
  `{ label: 'Book a Lesson', href: '/shop' }` as adjacent entries**
  (`src/components/layout/Footer.tsx:37-38`) — two labels, one destination, side by side. Same
  class of defect as the "Clients"/"Contacts" pair in 2.3, and the same one-line fix.
- **Created:** `3da6abb` · 2026-07-18 · *"In-app catalog + Dashboard/Catalog menu links; both
  shops offerings-backed"*.
- **What it reads:** `fetchOfferings()` — `offerings` where `active` — plus
  `fetchServiceCategories()` — `service_types` where `active`.
- **Production:** **27** active offerings, all segments.

### Implementation B — `ServiceSelector` + `fetchPublicCatalog`

- **Files:** `src/components/ServiceSelector.tsx` (116 lines) + `src/lib/publicCatalog.ts` (48).
- **Routes:** `/book/rider`, `/horse` + `/book/horse`, `/acquisition` + `/book/support`; and
  `/lessons` uses `fetchPublicCatalog` directly.
- **Reachability — this is the part that matters:** `/horse` and `/acquisition` are **two of the
  four entries in the marketing site's primary navigation**, as *"Horse Care Services"* and
  *"Find a Horse"* (`src/components/layout/Header.tsx:34-39`), and both are in the footer too.
  They are not obscure URLs — they are the top-level way in.
- **Created:** `ServiceSelector` `b87d748` · 2026-06-23 · *"Phase 1b: structural fixes"* — the
  **original**. `publicCatalog.ts` `b9bad0b` · 2026-07-26 · *"Phase 4: offering configuration,
  one catalog, acquisition intake, eval reports"*.
- **What it reads:** `public_offerings()` RPC grouped by `service_types`, then filtered:
  `segment = X AND config_kind <> 'inquire' AND price_amount IS NOT NULL`.

### The evidence

| surface | production |
|---|---|
| `/shop` and `/app/catalog` (`fetchOfferings`) | **27** |
| `/book/rider`, `/lessons` (`fetchPublicCatalog('rider')`) | **12** |
| `/horse`, `/book/horse` (`fetchPublicCatalog('horse')`) | **12** |
| **`/acquisition`, `/book/support`** (`fetchPublicCatalog('acquisition')`) | **0** |

**Why zero:** FHE has 3 active `acquisition` offerings — *Acquisition Assistance*,
*Horse Evaluation*, *Horse Finder* — and **all three have `price_amount = NULL`**
(they are `document_transaction` / `intake_evaluation` / `intake_finder` SKUs priced on
enquiry). `fetchPublicCatalog` requires `price_amount != null`, so it drops all three and
returns an empty array.

**And there is no empty branch.** `BookSupport.tsx:102` and `BookHorse.tsx:95` render
`{groups.map(...)}` with no `groups.length === 0` case. `/acquisition` therefore renders its
step indicator, its heading and **nothing in the selection area** — and "Next" is disabled
because `canProceedStep0 = itemCount > 0`. **A page in the marketing site's primary nav is a
funnel that cannot be completed and does not say why.** **NOT VERIFIED visually; derived from
the code paths and the data.**

### Quality assessment

| | A `OfferingCatalog` | B `ServiceSelector` |
|---|---|---|
| lines | 199 | 116 |
| loading / error / empty | **yes** / **yes** / no | n/a — it is fed a `group` prop; all three belong to its three parent pages, and **none of them has an empty branch** |
| responsive utilities | **19** | 2 |
| a11y attributes | 8 | 7 (`role="radiogroup"`, `aria-checked` — genuinely better semantics) |
| comment density | 9% | 12% |
| arbitrary Tailwind values | 9 | 3 |
| consumers | 2 | 3 |

**Verdicts.**
- **`OfferingCatalog` — the better base.** It has both a loading branch
  (`OfferingCatalog.tsx:89`) and an error branch (`:88`, `role="alert"`), 19 responsive
  utilities against 2, and it shows the whole catalog rather than silently dropping unpriced
  SKUs. It is also the **newer** implementation — the one case in this report where the
  replacement really is better than the original.
- **`ServiceSelector` — usable, and it owns the better accessibility.** `role="radiogroup"` /
  `role="radio"` / `aria-checked` inside a labelled group is correct and `OfferingCatalog`
  does not have it. It is presentational, so its missing branches are its parents' fault rather
  than its own — but none of the three parents supplies them, and it is fed by a reader that
  drops a whole segment.

### Recommendation

- **Build from:** `OfferingCatalog` for rendering; `public_offerings()` for reading (it is the
  security-definer, org-pinned RPC — `fetchOfferings` hits the table directly).
- **Keep the URL:** `/shop` public, `/app/catalog` in-app. The three `/book/*` funnels keep
  their URLs — they are funnels, not catalogs, and their step machinery is not duplicated
  anywhere.
- **Carry across from `ServiceSelector` before retiring it:** the **radiogroup semantics**
  (`role`, `aria-checked`, labelled group) and the **`mechanics()` hint line** that renders
  `config_kind`/`unit_count`/`weekly_frequency` as human text ("3× weekly · monthly").
- **Fix regardless of consolidation:** drop `price_amount != null` from `fetchPublicCatalog`
  (or render "Price on enquiry"), and add an empty branch to `BookSupport`/`BookHorse`.
- **Also collapse:** the footer's two adjacent links to `/shop` (`Footer.tsx:37-38`).
- **Effort:** the empty `/acquisition` page is a **one-line filter change plus an empty state**.
  The renderer consolidation is a **merge**. The footer is **one line**.

---

# TIER 2 — DUPLICATED SURFACES YOU USE

## 2.1 Horse roster — THREE implementations

**`TASK-HORSEONE` is HELD pending this review, so its recommendation is not treated as settled.
My evidence agrees with its history and its conclusion; I found nothing that contradicts it.**

### A — `/app/ops/horse-records` · **currently in use**

- **File:** `src/pages/app/ops/HorseRecordsPage.tsx` — **273 lines**.
- **Created:** `173f952` · **2026-07-10** · *"H.7 + H.8 + role architecture: horse intake
  everywhere, staff records, clean role split"* — **the replacement**.
- **Reachability:** **nav → Management → "Horses"** (`AppLayout.tsx:488`).
- **What it reads:** `staff_horse_records()` — org-scoped, `deleted_at IS NULL`,
  `has_staff_access()`. **Production: 4 horses.**
- **What it can do that the others cannot:** assign/reassign **owner and lessee** with lease
  start/end (writes relationship history via `staff_assign_horse_party`); shows the **active
  lease document** with a deep link; **"Generate availability"** (`generateLeaseAvailability`)
  for a leased horse; inline edit of 13 descriptive fields; add-a-horse through the shared
  `HorseIntakeForm`.

### B — `/app/ops/horses` · routed, **zero references**

- **File:** `src/pages/app/ops/HorsesPage.tsx` — **128 lines**.
- **Created:** `257a64c` · **2026-07-01** · *"feat(app): feature group B (partial) — ops CRM
  core before session cap"* — **the original, nine days earlier**.
- **Reachability:** **URL-only.** Grep of `src/` finds the string `/app/ops/horses` **once**,
  in `App.tsx:279` — the route registration itself. Nothing links to it.
- **What it reads:** `listHorses()` — `horses` where `deleted_at IS NULL`, RLS-scoped.
  **Production: 4 horses** (identical set to A).
- **What it can do that the others cannot:** resolves **breed and colour lookup codes to
  display names** (`listHorseBreeds`/`listHorseColors`) — A renders the raw code; and a real
  create/edit **`Modal` + `HorseForm`** flow.

### C — `/app/ops/records` · in nav, module-gated, **module is ON**

- **File:** `src/pages/app/ops/hubs/RecordsHubPage.tsx` — **103 lines**.
- **Created:** `9038bf4` · **2026-07-01** · *"feat(ops): Wave-7 part 1 …"*.
- **Reachability:** **nav → Modules → "Records"**. `mod.horserecords` is **enabled** for FHE
  (`org_modules`, verified) — **this is not a dark page; it is live in your nav today.**
- **What it reads:** `listRecordHorses()` — byte-identical query to `listHorses()`
  (`from('horses').select('*').is('deleted_at', null).order('nickname')`). **Production: 4.**
- **What it can do that the others cannot:** per-row links into the two record lanes —
  **Ownership** (`/app/ops/records/horses/:id/parties`, the `horse_relationships` ledger) and
  **Health** (`/app/ops/records/horses/:id/health`, health log + care team). Neither A nor B
  reaches those pages at all.

**All three agree on the count (4). They disagree on nothing today** — which is precisely why
this one is cheap to resolve and has been left alone for two months.

### Quality assessment

| | A `HorseRecordsPage` | B `HorsesPage` | C `RecordsHubPage` |
|---|---|---|---|
| lines | 273 | 128 | 103 |
| **`PageLayout`** | **yes** | no | no |
| loading | yes | yes | yes |
| error | yes | yes | yes |
| empty | yes | via `HorseTable` → `DataTable` | yes (`emptyTitle`/`emptyMessage`) |
| responsive utilities | **7** | **0** | **0** |
| `focus-ring` uses | **6** | 0 | 0 |
| shared kit used | none (hand-rolls its modal) | `Modal` + `HorseTable`→`DataTable` | **`DataTable`, `ModuleGate`, `useAsync`** |
| comment density | 3% | 8% | **14%** |
| arbitrary Tailwind values | **9** | **0** | **0** |

**Verdicts.**
- **A — the better base.** It is the only one with `PageLayout`, the only one with responsive
  treatment, the only one with focus handling, and it owns every capability that matters
  (parties, leases, documents, availability). Against it: 3% comment density, 9 arbitrary
  Tailwind values, and a **hand-rolled modal** (`fixed inset-0 … z-[60]`,
  `HorseRecordsPage.tsx:257-269`) sitting beside the app's own `Modal`. **The better base, with
  a hand-rolled modal that should be replaced on the way through.**
- **B — usable, and it holds one thing nobody else has.** Zero responsive utilities, zero
  `focus-ring`, no `PageLayout`, and a header row hand-rolled at line 83. But it shares
  `DataTable` through `HorseTable`, has zero arbitrary Tailwind values, and it is **the only
  place breed and colour codes are resolved to names.** **Usable — and its lookup resolution
  must not be lost.**
- **C — usable as a HUB, not as a roster.** Highest comment density in the group, uses three
  shared kit components, has proper empty copy. But its roster is redundant, and its empty
  message reads *"Add horses on the Horses screen; their records appear here"*
  (`RecordsHubPage.tsx:95`) — prose directing the reader to a page that **has no nav entry and
  that nothing in the app links to.** A staff member following that instruction has nowhere to
  go. **The lanes are worth keeping; the roster is not.**

**One more thing about C — now resolved.** When this census began, `DataTable` had **no scroll
container** (`TASK-FRAMESCROLL`'s finding: 23 consumers, none wrapping it), so C's roster
inherited the sideways-page-scroll defect. **FRAMESCROLL merged during the census
(`29597ff` + `bab6fdd`, 2026-08-12)**: `DataTable.tsx:80-83` now wraps the table in
`overflow-x-auto` and, when it actually overflows, adds `tabIndex={0}`, `role="region"` and
`aria-label="Scroll to see more columns"` — keyboard-reachable, announced. Verified at
`0687429`. **Anything built on `DataTable` now inherits the fix instead of the defect**, which
strengthens the case for C's `DataTable` over A's hand-rolled markup.

### Recommendation

**I agree with `TASK-HORSEONE` and add one correction of emphasis.**

- **Build from:** **A's component** (`HorseRecordsPage.tsx`).
- **Keep the URL:** **`/app/ops/horses`** — B's. Shorter, original, and it says what it is.
  This is the pattern the task doc predicted: *the good name and the good code come from
  different places.* It recurs in 2.4 and 2.6 below.
- **Carry across before B is retired:** **breed/colour lookup resolution** (`listHorseBreeds` /
  `listHorseColors` → display name). Today A shows the raw code. This is the single feature that
  would be silently lost.
- **Carry across before C's roster is retired:** nothing from the roster — but the
  **Ownership and Health lane links must survive**, and per HORSEONE the lanes stay gated on
  `mod.horserecords` while the roster does not.
- **Effort:** **a route change plus one small feature port.** Not a rebuild.

---

## 2.2 Staff landing page — TWO implementations, plus a preview

### A — `/app/dashboard` · **currently in use**

- **File:** `src/pages/app/DashboardHome.tsx` (47 lines) → `src/components/app/DashboardPanel.tsx`
  (401 lines).
- **Created:** `DashboardHome` `bf73aed` · 2026-07-20 · *"App: split Community + Dashboard into
  pages; Community is the sign-in landing"*; `DashboardPanel` `87e2d2f` · 2026-07-10 ·
  *"Update B: app facelift — two-surface rider app, instructor view, account hub"*.
- **Reachability:** **nav → Management → "Dashboard"** for staff (moved there from the member
  group, `AppLayout.tsx:483`); **nav → quick links → "Dashboard"** for members.
- **What it reads:** `myNotifications`, `myLessonSessions`, `fetchEvents`,
  `my_onboarding_checklist`, `fetchMyPendingChanges`, `fetchHorseOnboardingState`,
  `fetchAcquisitionIntakeState`, and `useOpenLeads` for staff.

### B — `/app/ops` · routed, **no nav link**

- **File:** `src/pages/app/OpsHome.tsx` (15 lines) → `src/pages/app/ops/OpsDashboard.tsx`
  (222 lines) for admins, `src/pages/app/InstructorHome.tsx` (186 lines) for non-admin staff.
- **Created:** `OpsHome`/`InstructorHome` `87e2d2f` · 2026-07-10; `OpsDashboard` `257a64c` ·
  2026-07-01 — **the original**.
- **Reachability:** **URL-only.** No nav entry. Reached only if typed.
- **What it reads:** two KPI counts + the module launcher.
- **What it can do that A cannot:** the **module launcher** — six entitlement-gated tiles that
  navigate to each module hub, with a "Locked"/"Enabled" state for modules without a hub. There
  is no other module launcher in the app.

### C — `/app/ops/preview/instructor-home` · built for exactly this review

- **File:** `src/pages/app/ops/InstructorHomePreview.tsx` (66 lines) wrapping `InstructorHome`.
- **Created:** `457f5cc` · 2026-08-11 · *"adminsweep(P2): a preview route so InstructorHome can
  be looked at before it is judged"*.
- **Reachability:** **URL-only, deliberately.** `InstructorHome` renders only for
  `isStaff && !isAdmin`, and **no such account exists in production** (verified: `profiles` has
  2 ADMIN, 1 SUPER_ADMIN, 10 USER — zero MANAGER/EMPLOYEE), so it is otherwise unviewable.

### Quality assessment

| | A `DashboardPanel` | B `OpsDashboard` | C→`InstructorHome` |
|---|---|---|---|
| lines | 401 (+47) | 222 | 186 |
| `PageLayout` | no | no | no |
| loading | **no** | yes | **no** |
| error | **no** | **yes, per tile** | **no** |
| empty | yes | no | **no** |
| responsive utilities | 11 | 4 | 2 |
| a11y attributes | 1 | 5 | **0** |
| shared kit used | none | `ModuleGate`, `useAsync` | none |
| comment density | 13% | **20%** | 6% |
| arbitrary Tailwind values | 12 | **0** | 12 |

**Verdicts.**
- **A — the better base, and the incumbent.** It is where work actually surfaces: leads,
  checklist, horse documents, acquisition intake, pending changes, coming-up. Its gaps are real
  (no loading branch, no error branch — see 1.1) but its content is the product.
- **B — usable, and it owns the module launcher.** Best discipline scores in the group: 20%
  comment density, zero arbitrary Tailwind values, per-tile error branches, `ModuleGate`. Its
  problem is that it is a page nobody can reach and its two KPI numbers are both wrong (1.1).
- **C/`InstructorHome` — shoddy, and unjudgeable from code alone.** Zero a11y attributes, zero
  loading/error/empty branches, 12 arbitrary Tailwind values in 186 lines, 6% comments. **This
  is the one place in this report where I will not give you a final verdict from code:** it has
  never rendered for a real account, so nobody knows whether its content is right.
  **Open `/app/ops/preview/instructor-home` and look at it.** That is what ADMINSWEEP built the
  route for.

### Recommendation

- **Build from:** **A** (`DashboardHome` + `DashboardPanel`).
- **Keep the URL:** `/app/dashboard`.
- **Carry across before B is retired:** the **module launcher** (`MODULE_TILES` +
  `MODULE_HUB_ROUTES` + `ModuleGate` with its Locked/Enabled states) and the **per-tile inline
  error branch**. Both are unique to B and both are good.
- **Do not retire C yet.** It is the review instrument. Retire it after you have looked.
- **Effort:** a **merge** (launcher block moves), plus a **decision** on InstructorHome that
  code cannot make for you.

---

## 2.3 People — FIVE person-list surfaces; **the owner ruled on this mid-census (`TASK-ONEPEOPLE`)**

> **SUPERSEDED IN DIRECTION, KEPT AS EVIDENCE.** On 2026-08-12, while this census was being
> written, the owner specced **`TASK-ONEPEOPLE`** (`9481414`): *"we can rollup people into one
> page called contacts that holds the three remaining people pages as 'Tabs'; Leads, Clients,
> Directory."* It picks **`/app/ops/contacts`** as the home, on the explicit grounds that *"the
> best URL and the best code can come from different places"* — **the same `TASK-HORSEONE`
> pattern this report identifies recurring in 2.1 and 2.5.**
>
> **I do not re-derive or contradict it.** What follows is the part ONEPEOPLE asks for and does
> not have: §5 of that spec says *"Diff the three pages' capabilities and state the result. If
> something only one of them can do would be lost by composing them, say so and stop."*
> **The capability diff, the proof that two of the populations are identical, and one live
> create-path defect are below. That is this section's job now.**

### A — `/app/admin` "Clients" · **currently in use**

- **File:** `src/pages/app/Admin.tsx` — **1,006 lines** (+ `RosterCard.tsx`, 257).
- **Created:** `a345601` · **2026-06-23** · *"Members community app + admin panel"* — the oldest
  page in this report. `RosterCard` is new: `7011e9c` · 2026-08-11 · *"feat(rostercard): the
  people page is cards — triage grid replaces the row build"*.
- **Reachability:** **nav → People → "Clients"**.
- **What it reads:** `admin_client_accounts()` — a three-arm UNION: login-backed accounts +
  provisioned clients without a login + bare contacts. Plus seven direct table reads for the
  card supplement (`groups`, `contacts`, `horses`, `document_parties`, `documents`,
  `purchases`, `audit_logs`).
- **Production:** **17 people** (7 accounts + 9 pending clients + 1 bare contact).

### B — `/app/ops/contacts` "Contacts" · **RETIRED behind `CONTACTS_PAGE_RETIRED`**

- **File:** `src/pages/app/ops/ContactsPage.tsx` — **539 lines**, one `ContactDirectory`
  component in three modes.
- **Created:** `257a64c` · **2026-07-01** · *"feat(app): feature group B (partial) — ops CRM
  core before session cap"*.
- **Retirement constant:** **`CONTACTS_PAGE_RETIRED = true` at
  `src/pages/app/ops/ContactsPage.tsx:523`** (exported; read at `App.tsx:274`). While true, the
  route renders `<Navigate to="/app/admin" replace />`.
- **Reachability at `33525cd`:** **the nav entry still existed.** `AppLayout.tsx:510` had
  `{ to: '/app/ops/contacts', label: 'Contacts' }` in `ACCOUNTS_GROUP`, ungated —
  `manageNavGroups`'s `visible()` filter checks only `module` and `adminOnly`, and this item had
  neither. **The People group showed both "Clients" and "Contacts", and both landed on
  `/app/admin`.** The retirement comment at `ContactsPage.tsx:519-522` said *"the
  /app/ops/contacts route redirects to /app/admin **and the nav item is hidden**"* — it was not.

  > **✅ CLOSED during this census by `0687429`** · 2026-08-12 · *"fix(nav): remove the Contacts
  > entry (it redirected to Clients); Leads takes Users, Clients takes Contact — ADMINSWEEP
  > X-1"*. `ACCOUNTS_GROUP` is now four entries — Leads, Clients, Team, Directory — and the
  > icon collision (Leads and Contacts both wearing `Contact`) went with it. The route still
  > redirects, so bookmarks still land. **Independently found and fixed by ADMINSWEEP X-1
  > while I was measuring it; I confirm the fix against `0687429` rather than claim the find.**
  > **Reachability now: URL-only, redirecting.**

- **What it reads:** `staff_contact_directory()` filtered to `contact_type = 'CONTACT'`.
- **Production:** **17 people** — and they are **the same 17**. Set-difference in both
  directions is **0**. The retirement was correct on population grounds.

### C — `/app/ops/leads` "Leads" · live

- Same file, `mode='leads'` → `contact_type = 'LEAD'`. **Production: 5.**
- **Reachability:** nav → People → "Leads". **`TASK-LEADCLEAN` is running on this page** — 7 of
  its rows are stale (person already a client). Listed as known and settled; not re-derived.

### D — `/app/ops/directory` "Directory" · live but **empty**

- Same file, `mode='directory'` → `contact_type = 'DIRECTORY'`. **Production: 0.**
- **Reachability:** nav → People → "Directory". A nav entry to an empty page.

### E — `/app/ops/team` "Team" · live, **and it left the People group mid-census**

- **File:** `src/pages/app/ops/TeamPage.tsx` — **475 lines**.
- **Created:** `8e71520` · 2026-07-10 · *"Admin uplift: Inbound unification, Clients/Team split,
  contract initiation, catalog CRUD, admin + modal"*.
- **What it reads:** `adminListMembers()` → `profiles`, filtered client-side to `role <> 'USER'`.
- **Production:** **2 rows** as an FHE admin actually sees it (RLS `profiles_select_own` excludes
  platform profiles, so `admin@cactai.io` is correctly not shown — **that is D1a working, not a
  bug**).

### A defect this duplication produces: **"New lead" creates something that is not a lead**

`ContactDirectory` serves three pages from one component and one writer. The create path is
`handleSubmit → createContact(input)` (`ContactsPage.tsx:201`), where `input` is `ContactInput`
— a type whose fields are `first_name, last_name, email, phone, address_*, date_of_birth, tags,
notes` (`src/lib/ops/types.ts:40-47`). **`contact_type` is not in it.** The column default is
`'CONTACT'` (verified in `information_schema`).

**Consequence:** pressing **"New lead"** on `/app/ops/leads` creates a `CONTACT`-typed row. The
toast says "Contact created.", `load()` re-filters to `contact_type === 'LEAD'`, and the new
person **is not in the list**. They appear on `/app/admin` instead. Same for **"New directory
entry"** on `/app/ops/directory`. Only the retired `/app/ops/contacts` mode creates a row that
lands on its own page. **NOT VERIFIED in a browser; derived from the writer, the type and the
column default.**

### And there is a population nothing renders

`contacts` by type in production: `CONTACT` 17, `LEAD` 5, `TEAM` 4 — total 26. The pages cover
17 + 5 + 0 = **22**. The **4 `TEAM`-typed contacts** (CJ Z, Claire Bourdon, French Heritage
Equestrian, CACTAI INC.) appear on **no people page** — `ContactDirectory` has no `TEAM` mode
and `admin_client_accounts` excludes them. TeamPage shows *profiles*, not these contact records.

### Quality assessment

| | A `Admin.tsx` | B/C/D `ContactsPage` | E `TeamPage` |
|---|---|---|---|
| lines | 1,006 | 539 | 475 |
| **`PageLayout`** | **yes** | **yes** | no |
| loading / error / empty | yes / yes / yes | yes / yes / yes | **no** / yes / yes |
| responsive utilities | 4 | 4 | **1** |
| a11y attributes | 7 | 5 | **14** |
| `focus-ring` uses | **16** | 9 | 6 |
| shared kit used | `StatusLog` | `Modal`, `useAsync`, `useToast` | **none** |
| comment density | 7% | **9%** | **3%** |
| arbitrary Tailwind values | **14** | 10 | 4 |

**Verdicts.**
- **A — the better base, and the incumbent.** It is the only surface that shows a person
  regardless of whether they have a login, it has the richest per-person view (10 tabs), the most
  focus handling in the app, and `RosterCard` is 2026-08-11 work built to the owner's triage
  brief. Against it: **1,006 lines in one file** and 14 arbitrary Tailwind values.
  **The better base.**
- **B/C/D `ContactsPage` — usable, and better-written per line than A.** Highest comment density
  of the three, uses three shared kit components, has `PageLayout`. Its filing UI ("Unfiled"
  section, `file(id, type)` → `setContactType`) is genuinely good and A has no equivalent.
  Its create path is broken for two of its three modes. **Usable.**
- **E `TeamPage` — shoddy on discipline, strong on semantics.** 3% comment density (lowest in
  the group), no `PageLayout`, no loading branch, 1 responsive utility in 475 lines, zero shared
  kit — but **14 a11y attributes, double A's and nearly triple B's**. Somebody cared about
  labels and cared about nothing else. **Usable.**

### Recommendation — written FOR `TASK-ONEPEOPLE`, not against it

The owner has ruled the shape: one Contacts page, three population tabs, at `/app/ops/contacts`.
**I agree with the URL choice and reached it independently before the spec existed** — `/app/admin`
says "admin" and shows clients, and it was the target of two differently-labelled nav rows.
So the only useful thing I can add is the capability diff ONEPEOPLE §5 asks for.

**ANSWER TO ONEPEOPLE §5 — "diff the three pages' capabilities; if something would be lost,
say so and stop."** Three things would be lost or broken by a naive compose:

1. **The "Unfiled" section and the `file(id, type)` filing control** (`ContactsPage.tsx:188-196`,
   `:260`). This is **the only place in the app that can set `contact_type`**. `Admin.tsx` has no
   equivalent. If the Clients tab becomes the page's default and the Leads/Directory chrome is
   rebuilt around it, this must come with them — otherwise a contact with a NULL type is
   unfilable, forever.
2. **`ContactForm`'s create path does not set `contact_type`** (defect above). ONEPEOPLE §5 says
   *"the create control must follow the active tab — creating a lead while looking at Directory
   is a defect."* **It is already a defect today, in the other direction:** creating a lead while
   looking at Leads produces a `CONTACT`. **Fixing the tab-following without fixing the writer
   ships the same bug with better chrome.**
3. **Nothing else.** The two populations are provably disjoint by type and the Clients population
   is provably identical to the retired Contacts one (17 = 17, set-difference 0 both ways). There
   is no third capability hiding in `ContactDirectory` that `Admin.tsx` lacks, and no roster
   feature in `Admin.tsx` that composing would disturb — its nine per-person tabs are a different
   layer, which the spec already flags as the trap.

**So: do not stop. Compose — but carry the filing control and fix the writer in the same pass.**

- **Also decide:** whether `TEAM`-typed contacts (4 in production) should appear on any tab.
  They currently appear on none, and Team has just moved out of the People group entirely
  (`7f20103`), which makes that gap easier to forget.
- **Effort:** ONEPEOPLE is a **compose + route change**. The filing-control port is a **merge**.
  The writer fix is **one field**.

---

## 2.4 Contact editor — TWO editors, on the same page, writing through different paths

### A — `ContactDossierModal`

- **File:** `src/components/app/ContactDossierModal.tsx` — **413 lines**.
- **Created:** `428c60f` · 2026-07-30 · *"Contact dossier modal, keyed on contact; nav: Front
  desk eliminated"* — **the replacement**.
- **Route:** no route of its own. Opens from `/app/ops/leads`, `/app/ops/directory` (and the
  retired `/app/ops/contacts`) by clicking a person.
- **What it reads/writes:** `contact_dossier()` RPC / `update_contact_record()` RPC.
- **Fields:** **30**, in five groups — name & contact (9, including `mobile`, `whatsapp`, both
  extensions, DOB), mailing address (6), **emergency contacts (6)**, **riding background (4)**,
  staff notes. Plus seven tabs (record, relationships, documents, orders, paperwork, account,
  activity).

### B — `ContactForm`

- **File:** `src/components/ops/contacts/ContactForm.tsx` — **147 lines**.
- **Created:** `257a64c` · **2026-07-01** — **the original**.
- **Route:** no route of its own. Opens from the **same three pages**, via the "New …" button
  and the edit path.
- **What it writes:** `createContact` / `updateContact` — **direct table writes**, not the RPC.
- **Fields:** **4** — first name, last name, email, phone.

**So on `/app/ops/leads` a person can be edited two ways, in two modals, with two field sets
(4 vs 30) and two write paths (table vs RPC).** Which one you get depends on whether you clicked
the row or the edit control. **NOT VERIFIED visually; derived from both being imported and
rendered by the same file (`ContactsPage.tsx:13` and `:16`).**

### Quality assessment

| | A `ContactDossierModal` | B `ContactForm` |
|---|---|---|
| lines | 413 | 147 |
| fields | 30 | 4 |
| write path | `update_contact_record()` RPC | `.from('contacts').update()` |
| can set `contact_type` | **yes** (`setContactType`) | **no** |
| loading / error / empty | yes / yes / yes | no / yes / n/a |
| a11y | tab semantics, labelled fields | **`FormField` with `id`/`describedBy`/`errorClass`** — the app's own accessible field primitive |
| shared kit used | none | **`FormField`** |
| inline validation | on save | **yes, blocks submit before the data fn is called** |
| comment density | 10% | 9% |

**Verdicts.**
- **A — the better base.** It is keyed on the **contact**, not the account, which is the whole
  point: its own header comment records that the page it replaced *"took a user_id, so it could
  not open for the 13 of 19 contacts without a login."* That is the correct model and it is 30
  fields to 4.
- **B — usable, and it owns the better form craft.** It is the only one of the two using
  `FormField` (the app's accessible field primitive: generated `id`, `aria-describedby`, error
  class), and the only one that validates before calling the data function. It is a **small,
  well-made form** attached to a broken writer.

### Recommendation

- **Build from:** **A**.
- **Carry across before B is retired:** **`FormField` usage and the pre-submit validation
  pattern** — A validates on save, B blocks the call. And **the create path must be rebuilt on
  the RPC with `contact_type` passed**, which fixes 2.3's defect at the same time.
- **Effort:** a **merge**.

---

## 2.5 Member time surfaces — TWO, and the one in the nav is not the one the dashboard links to

### A — `/app/calendar` · **currently in use**

- **File:** `src/pages/app/CalendarPage.tsx` — **893 lines** (+ `CalendarItemPanel` 476,
  `CalendarSettingsPanel` 108).
- **Created:** `ff172e9` · 2026-07-14 · *"Phase 6 Slice 2: full-page week+month calendar
  (read-only)"*.
- **Reachability:** **nav → "Calendar"** (both the member quick links and the staff rail).
  Also the target of the two retired routes `/app/book` and `/app/ops/availability`.
- **What it reads:** `fetchCalendar` (`calendar_free_busy`), `fetchRevenue`,
  `fetchCreditsRoster`, `fetchOpenChangeRequests`, `fetchOfferings`, `listStableHorses`.

### B — `/app/schedule` · **URL-only**

- **File:** `src/pages/app/Schedule.tsx` — **182 lines**.
- **Created:** `a345601` · **2026-06-23** · *"Members community app + admin panel"* — the
  original.
- **Reachability:** **URL-only.** Not in any nav table. The only links to it are two
  `DashboardPanel` "Coming up" tiles (`cta: 'Schedule'` and `cta: 'Details'`,
  `DashboardPanel.tsx:240,248`).
- **What it can do that A cannot:** **community events and RSVP** (`fetchEvents`,
  `fetchMyRsvps`, `setRsvp`). This is the only RSVP surface in the app.

Quality scores are in 1.3. `CalendarPage`: loading/error/empty all present, 13 a11y attributes,
**0 responsive utilities** in 893 lines, 4% comments, 9 arbitrary values. `Schedule`: no error
branch, **0 responsive utilities**, **2% comments**.

**Verdicts.** **`CalendarPage` — the better base** (it is the booking surface, it has all three
branches, and it is what the nav and two retired routes point at). **`Schedule` — shoddy**, and
it is showing staff 318 rows (1.3).

### Recommendation

- **Build from:** `CalendarPage`.
- **Keep the URL:** `/app/calendar`.
- **Carry across before `/app/schedule` is retired:** **community events + RSVP**, in full. If
  this is retired without porting it, members lose the ability to RSVP to anything.
- **Also fix:** `DashboardPanel`'s two "Coming up" tiles link to `/app/schedule`; they should
  link to wherever this lands.
- **Effort:** a **merge** (one section moves), then a **route change**.

---

## 2.6 Document body renderer — THREE implementations of the same plain-text renderer

### A — `ContractBody`

- **File:** `src/components/app/ContractCascade.tsx:246` (file is 1,600 lines).
- **Created:** `614847c` · 2026-07-16 · *"Cascade renderer proven on Horse Care (living-document
  builder, slice 1)"*.
- **Used by:** `/app/contracts/:id` (three call sites) and `FlatDocument`.
- **What it does that the others do not:** renders **`⟦NEEDS:…⟧` marks** as a styled
  `ExplainTip` mark telling the author what is still unfilled, and supports **span selection**
  for pinned comments (`onSelectSpan`).
- **Its own comment (line 241) claims:** *"This is the single body renderer used across the app
  (m-5)."* **It is not.** Third false comment found.

### B — `BodyWithSignatures` / `MergedBodyView`

- **File:** `src/components/ops/documents/MergedBodyView.tsx` — **81 lines**.
- **Created:** `257a64c` · **2026-07-01** — **the original**.
- **Used by:** `/app/ops/documents/:id` (`MergedBodyView`), and `BodyWithSignatures` directly by
  `/release`, `/docs/release-participant` and `/app/onboarding`.
- **What it does not do:** it has no `NEEDS` handling. A body containing `⟦NEEDS:…⟧` renders the
  literal delimiters as text.

### C — the PDF renderer

- **File:** `src/lib/documentPdf.ts:28`.
- **Created:** `6366b66` · 2026-07-07 · *"feat(email): deliver signed document set as one email
  with PDF attachments"*.
- **Used by:** the emailed signed-document PDFs.

### The three regexes

| | pattern | tolerates leading whitespace? |
|---|---|---|
| A `ContractCascade.tsx:245` | `/^(Signature\|By \(signature\)):\s*(.+)$/m` | no |
| B `MergedBodyView.tsx:24` | `/^(Signature\|By \(signature\)):\s*(.+)$/` | no |
| C `documentPdf.ts:28` | `/^(\s*(?:Signature\|By \(signature\)):\s*)(.+)$/` | **yes** |

**Production evidence:**
- 74 live documents; **all 74** have a non-empty `merged_body` and **all 74** contain at least
  one `Signature:` line — so all three renderers run on real content constantly.
- **1 document contains a `NEEDS:` mark**: `DOC-J7NXZDHD5F`, *Horse Lease Agreement*,
  `AWAITING_SIGNATURE`, `current_status = sent_for_review`. Opened at `/app/contracts/<id>` it
  shows a styled "Needs:" mark; opened at `/app/ops/documents/<id>` it shows the raw
  `⟦NEEDS:…⟧` delimiters. **Same document, two screens, two appearances.**
- **0 documents currently have an indented signature line**, so C's whitespace divergence is
  **latent, not active**. Reported because it is a real difference between the screen and the
  emailed PDF, not because it is biting today.

**Verdicts.**
- **A `ContractBody` — the better base.** It is a superset: it does everything B does plus the
  `NEEDS` marks and span selection. `FlatDocument`'s own header comment (2026-08-11) already
  reaches this conclusion: *"MergedBodyView … styles signature lines but not the NEEDS: marks
  that tell an author what is still unfilled, so it is the weaker of the two here."*
- **B — usable, and the original.** 81 lines, purely presentational, correct empty branch, clean.
  It is not bad code; it is incomplete code that four surfaces still use.
- **C — necessary and separate.** A PDF renderer cannot share a React renderer. But **the regex
  must be shared**, not re-typed.

### Recommendation

- **Build from:** **A** (`ContractBody`) for every on-screen body.
- **Keep the URLs:** all of them — this is a component swap, not a route change.
- **Carry across:** nothing from B is lost; A is a superset.
- **Do this regardless:** **extract the signature-line regex to one exported constant** and have
  all three import it. Three copies of one pattern, one of which already differs, is how the
  screen and the PDF drift apart.
- **Effort:** a **merge** — swap `MergedBodyView`'s internals for `ContractBody`, keep its
  wrapper markup and empty state.

---

## 2.7 Staff document viewer — TWO, and which one you get depends on where you clicked

### A — `/app/contracts/:id` · the authoring page

- **File:** `src/pages/app/ContractPage.tsx` — **2,293 lines**.
- **Created:** `503f4ce` · 2026-07-10 · *"Update A (3/3): contract surface + counterparty flow +
  record wiring (frontend)"*.
- **Renderer:** `ClauseDocument` (structure present) or `FlatDocument` (structure null) —
  **`TASK-ONEAUTHOR` converged these two on 2026-08-11 (`7c0f89f`); they are not duplicates,
  they are one slot with two renderers chosen by the document.** Listed as settled.

### B — `/app/ops/documents/:id` · the read-only viewer

- **File:** `src/pages/app/ops/DocumentViewerPage.tsx` — **253 lines**.
- **Created:** `257a64c` · **2026-07-01** — the original.
- **Renderer:** `MergedBodyView` (2.6 B).
- **What it can do that A does not:** `SigningPanel` and `DeliveryPanel`, and a signature roster
  rendered through the shared `DataTable`.

### The routing rule, and where it breaks

`DocumentQueueTable.tsx:129` routes correctly:
```jsx
to={row.contract_id ? `/app/contracts/${row.id}` : `/app/ops/documents/${row.id}`}
```
**`Admin.tsx:518` and `Admin.tsx:248` do not** — they send **every** document to
`/app/ops/documents/:id` unconditionally.

**Production:** 74 live documents — **8 have `contract_id NOT NULL`** and **66 do not**.
So **8 documents open in the full authoring page from `/app/ops/documents`, and in the
read-only viewer from `/app/admin`.** Same document, two behaviours, depending on the page you
started from.

**Verdicts.** **A — the better base** for anything with a `contract_id`; **B — usable and
correct** for the 66 flat documents, and it owns the delivery/signing panels. They are not
really rivals — the rule that chooses between them is just applied in one place and not the
other.

### Recommendation

- **Build from:** both, kept. **Extract the choice into one helper** (`documentHref(row)`) and
  use it at all three call sites.
- **Effort:** a **three-line change**. This is the cheapest fix in Tier 2.

---

## 2.8 Signing — FIVE capture surfaces, THREE writers

| # | surface | file (lines) | route | reachability | writer |
|---|---|---|---|---|---|
| 1 | contract signing | `ContractPage.tsx` (2,293) | `/app/contracts/:id` | linked from Documents, Deals, Horse pages, notifications | `lock_and_sign_contract` |
| 2 | member self-sign | `DocumentsContent.tsx` (477) | `/app/documents`, `/app/account` | **nav** | `record_signature` |
| 3 | onboarding sign | `Onboarding.tsx` (1,181) | `/app/onboarding` | invite links | `record_signature` |
| 4 | kiosk | `Release.tsx` (476) | `/release`, `/release/:key` | public URL | `sign_release` |
| 5 | guided 4-doc flow | `DocsParticipantFlow.tsx` (507) | `/docs/release-participant` | public URL | `sign_release` |

**Creation:** 4 is `c34dab5` · 2026-07-02; 5 is `53e6087` · 2026-07-07; 3 is `3cac284` ·
2026-07-03; 1 is `503f4ce` · 2026-07-10; 2 is `a345601` · 2026-06-23.

Each has its own "type your full legal name" input, its own typed-name-matches-legal-name check,
and (in 3, 4, 5) its own required e-sign consent checkbox.

**Production evidence on the two writers:**

| method | signatures | with `signer_user_id` | NULL |
|---|---|---|---|
| `KIOSK_TYPED` (`sign_release`) | 37 | **0** | **37** |
| `TYPED` (`record_signature`) | 25 | 24 | 1 |

`esign_consents` = **62** = total signed signatures, so consent capture is complete across both
paths — **that part is consistent and worth saying.** The `signer_user_id` gap is mostly
correct-by-design (a kiosk walk-in has no account), but it does mean **60% of signatures in
production carry no signing account**, and only one of the two writers stamps it.

**Verdicts.**
- **1 `ContractPage` — the better base for multi-party signing**, and the only one with
  signature state, re-attestation and change-since-signature handling.
- **4/5 `Release` + `DocsParticipantFlow` — usable and genuinely separate.** They serve
  unauthenticated signers; they cannot share an authenticated component. But **they duplicate
  each other heavily** — same `signRelease`, same `BodyWithSignatures`, same typed-name and
  consent logic, 476 and 507 lines.
- **2 `DocumentsContent`'s inline input — the weakest.** A bare label + input inside a list row.

### Recommendation

- **Build from:** **one shared `<SignatureBlock>`** — typed-name input, name-match rule, e-sign
  consent checkbox, submit state. Every one of the five already implements all four.
- **Do not merge the writers.** `sign_release` (unauthenticated, kiosk attribution) and
  `record_signature` (authenticated, party-scoped) are correctly two functions. But the
  **typed-name matching rule should live in one place**, not five.
- **Merge 4 and 5.** `DocsParticipantFlow` is `/release` with four documents in sequence. Same
  RPC, same renderer, same validation, 983 lines between them.
- **Effort:** the shared block is a **merge**. Collapsing 4 and 5 is a **merge**. Nothing here
  is a rebuild.

---

## 2.9 The Dashboard badge disagrees with the Dashboard page

Not a duplicated *page* — a duplicated *definition of "how much needs my attention"* between a
badge and the page it sits on.

- **The badge** (`AppLayout.tsx:1399`) = `myUnreadCount() + inboundOpenCount()`.
- **The page** (`DashboardPanel.tsx:257`, `:289`) renders unread notifications
  **`.slice(0, 3)`**, excluding kinds `request_new` and `support_new`. **There is no
  "and N more" affordance on that band** — the other 14 are simply not shown and nothing says so.
- **The leads band** (`:358-395`) caps at `LEAD_PREVIEW = 6` but **does have** an expand
  control (`Show N more waiting` / `Show fewer`, with `aria-expanded`) — added by LEADCLEAN,
  which also repointed it from `/app/ops/intake` to an in-place expansion because *"the
  destination showed a differently-filtered list"*. **That is the pattern the attention band
  still lacks.**

**Production, at `0687429`:**

| account | badge value | attention tiles rendered | eligible but hidden | leads band |
|---|---|---|---|---|
| admin@fhequestrian.com | **25** (20 unread + 5 inbound) → displays "9+" | **3** | **14, silently** | 5 open (all shown) + 7 converted |
| hello@fhequestrian.com | **12** (7 + 5) → "9+" | **3** | **4, silently** | 5 open + 7 converted |
| cjzigs@icloud.com | **6** | **3** | **3, silently** | — (not staff) |
| sarahrosengard@gmail.com | **6** | **3** | **3, silently** | — |
| madelinedo@gmail.com | **4** | **3** | **1, silently** | — |

**Every account with notifications has a badge larger than what its dashboard will show**, and
the shortfall is invisible.

**Recommendation:** give the attention band the **same expand control the leads band already
has** — `LEAD_PREVIEW`/`leadsExpanded`/`hiddenLeads` at `DashboardPanel.tsx:38,358-395` is a
working pattern 60 lines away in the same file. **Build from that. Effort: a few lines.**

---

# TIER 3 — DEAD OR UNREACHABLE IMPLEMENTATIONS

## 3.1 `/account` vs `/app/account` — two account pages

| | A `/app/account` | B `/account` |
|---|---|---|
| file | `src/pages/app/AccountHub.tsx` (169) | `src/pages/Account.tsx` (196) |
| created | `87e2d2f` · 2026-07-10 · *"Update B: app facelift …"* | `a602107` · **2026-06-23** · *"Phase 2b: auth + account management + order hub"* |
| reachability | avatar menu / nav | **URL-only**, and redirects members to `/app` |
| audience | every account | signed-in **non-members** only |
| **production audience** | 10 accounts | **3 — all synthetic** (`zz-test-buyer`, `zz-test-cobuyer`, `zz-test-seller` @example.invalid) |

`Account.tsx` also carries a **verbatim copy** of the order-status label map that
`OrdersContent.tsx:18` has (`ORDER_STATUS_LABEL` vs `STATUS_LABEL`, same six keys, same values),
and its own `usd()` formatter.

**Verdicts.** **A — the better base** (12 responsive utilities to 3, 15% comment density to 5%,
expand-in-place sections sharing the `*Content` components). **B — a dead page with one live
part:** `TwoFactorSettings` is rendered here **and** by `MyLoginContent`, so nothing is lost.

**Recommendation:** build from A, keep `/app/account`, **carry across nothing** — verify
`TwoFactorSettings` is reachable in `MyLoginContent` first, then retire B behind a boolean.
**Effort: a route change.**

## 3.2 `serviceCatalog.ts` — a hardcoded catalog with **zero importers in `src/`**

> **Related but distinct:** `docs/reference/FORMS-ARE-UNUSED-2026-08-12.md` (`f6da69f`, landed
> during this census) documents a **third** hardcoded shadow — the 23 `form_definitions` rows,
> read only by `AdminFormsPage`. **This is a fourth, and a different one.** That one is DB rows
> with exactly one reader; this one is a TypeScript constant with **no reader at all**.

- **File:** `src/lib/serviceCatalog.ts` (77 lines), `f241b33` · 2026-06-30 · *"FHE platform —
  consolidated baseline"*.
- **Its own header claims:** *"Single source of truth for the finalized 13-service catalog on
  the front end … **Every UI that names a service reads from here.**"*
- **Reality:** the only file in the repo that imports it is `test/db/service_catalog.test.ts` —
  the test that guards it against drift. **No UI reads it.** Fourth false comment found.
- It is also **not 13 services — it is 14**, and so is the DB (`service_types` = 14 rows). The
  labels match exactly, so the guard test is doing its job; the file is simply orphaned.

`CLAUDE.md` records `services.ts` and `catalog.ts` as the two deleted shadow catalogs. **This is
a third one, still present.**

**Recommendation:** delete the file and its test, or wire `serviceLabel()` into the surfaces that
currently hardcode service names. **Do not leave a "single source of truth" that nothing reads.**
**Effort: a deletion, or a small merge.**

## 3.3 Three count helpers with no consumers

`src/lib/api.ts` defines four dashboard count helpers. **Only one is used:**

| helper | line | consumers |
|---|---|---|
| `countOpenDocuments` | 1325 | 1 — `OpsDashboard` |
| `countContacts` | 1307 | **0** |
| `countHorses` | 1316 | **0** |
| `countOpenBillableLines` | 1335 | **0** |

Three dead readers of three tables, sitting next to a live one. They are the tail of a KPI grid
that lost two tiles. **Effort: a deletion.**

## 3.4 `/app/deal` and `/app/care` — purpose-built homes nobody lands on

- **Files:** `DealHome.tsx` (87), `CareHome.tsx` (98). Both `e611bcb` · 2026-07-14.
- **Reachability:** URL-only. `DashboardHome` redirects to them **only when
  `!surfaces.has_feed`**.
- **Production:** `my_purchase_categories()` returns `deal` for **0 accounts** and `care` for
  **4** — but **all 4 also have `riding`**, so `has_feed` is true and none of them is ever
  redirected. **Neither page is reached by any production account today.**
- **`CareHome` contains a dead link:** `CareHome.tsx:70` → `/horse-care`. **That route does not
  exist in `App.tsx`** — it falls through to the branded 404. It is the page's primary CTA
  ("Request a service").
- **`CareHome` uses `PageLayout`** — one of only nine pages that do.

**Recommendation:** these are not duplicates to resolve so much as **surfaces to decide about**.
Either give them a nav entry and fix the dead link, or fold their content into `/app/dashboard`.
`CareHome`'s "your horses" list duplicates `/app/stable` (both call `listStableHorses`).
**Effort: a decision, then a merge.**

## 3.5 The second dead link

`CalendarPage.tsx:618` → **`/app/contracts`** (no `:id`). **No such route exists** — only
`/app/contracts/:id`. It is a `btn-primary` labelled *"Review & sign paperwork"*. It 404s.

Full route/link cross-check, re-run at `0687429`: **113 registered routes, 49 distinct
internal link targets, 2 unmatched** — this one and `/horse-care` above. Everything else
resolves. Both were dead before the merges and are dead after them.

## 3.6 `/app/ops/team` vs `/app/ops/employees/staff`

- **A `TeamPage`** (475 lines, `8e71520` · 2026-07-10) — **nav → Settings/configuration group** (moved out of People by `7f20103`, 2026-08-12, taking `UserRound` because it shared `Contact` with Clients). Deliberately **not** `adminOnly`, because `App.tsx:292` routes it behind `requireStaff` — *"a nav that lies about what you have"* is the reasoning recorded at `AppLayout.tsx:569-573`.
- **B `StaffPage`** (184 lines, `fe8b229` · 2026-07-01) — route registered, but gated on
  `mod.employees`, which is **disabled** for FHE. Renders the locked fallback.

**Per the task's exclusion rule, a page dark because the tenant lacks the module is not a
duplicate — so I am listing this as low-rank information, not as a duplicate to resolve.**
It is here because the concepts overlap and the owner should know: as an FHE admin, **both
would show the same 2 people**, and `StaffPage` uses **eight** shared kit components against
`TeamPage`'s zero.

**If `mod.employees` is ever enabled, this becomes a Tier 2 duplicate.** `TeamPage` owns roles,
suspension, staff invitations and instructor grants; `StaffPage` owns title and pay type.

## 3.7 Every retirement constant — the complete list REVIEWNAV needs

- **`src/pages/app/ContractPage.tsx:86`** — `const INLINE_BODY_PREVIEW_RETIRED = true`, guarding
  a block at line 2004. Not a page, not in the nav, no route. Recorded here because the task
  asked for **every** retirement constant and REVIEWNAV needs the complete list.

**The complete list of module-level booleans in `src/`, verified at `0687429`:**

| constant | file:line | exported? | what it hides | hides a PAGE? |
|---|---|---|---|---|
| `CONTACTS_PAGE_RETIRED = true` | `src/pages/app/ops/ContactsPage.tsx:523` | **yes** | `/app/ops/contacts` → redirects to `/app/admin` | **YES** |
| **`INTAKE_PAGE_RETIRED = true`** | **`src/pages/app/ops/IntakePage.tsx:447`** | **yes** | `/app/ops/intake` → `IntakeRetiredRedirect` (`App.tsx:91,289`) | **YES — new, landed 2026-08-12 mid-census** |
| `INLINE_BODY_PREVIEW_RETIRED = true` | `src/pages/app/ContractPage.tsx:86` | no | an inline body preview block | no |
| `STRIPE_ENABLED = false` | `src/components/order/OrderPayment.tsx:44` | no | card payment | no |
| `SEED_ENABLED = false` | `src/lib/seed.ts:10` | yes | seed data | no |
| `PASSWORD_AUTH_ENABLED = true` | `src/lib/authConfig.ts:28` | yes | nothing (on) | no |
| `SCRIM_ENTERS_AS_FADE = true` | `src/components/app/AppLayout.tsx:320` | no | an animation choice | no |

**Two constants hide a page: `CONTACTS_PAGE_RETIRED` and `INTAKE_PAGE_RETIRED`.** REVIEWNAV
needs both. The second did not exist when this census started — **which is itself the finding
the owner should take from this table: retirement-by-boolean is now the house pattern, and the
list of what is hidden changes weekly. Anything that consumes this list must re-derive it, not
copy it.**

---

# NOT DUPLICATES — checked, and deliberately excluded

Listed so you know they were examined rather than missed.

- **The `*Content` component pattern.** `/app/documents`, `/app/orders`, `/app/gifts`,
  `/app/my-posts`, `/app/stable`, `/app/lessons` are 17–43-line wrappers around
  `DocumentsContent`, `OrdersContent`, `GiftsContent`, `MyPostsContent`, `StableSection`,
  `MyLessonsContent` — **the same components `/app/account` expands inline**. One
  implementation, two entry points. **This is the app's own correct answer to duplication and
  should be the model for the fixes above.**
- **`ClauseDocument` vs `FlatDocument`.** One body slot, two renderers chosen by whether the
  document has clause structure. `TASK-ONEAUTHOR` (`7c0f89f`, 2026-08-11) converged them
  deliberately. Settled.
- **The dark module pages.** `mod.boarding`, `mod.barnops`, `mod.employees` are **disabled** for
  FHE (verified in `org_modules`), so `/app/ops/boarding/*` (3 pages + hub),
  `/app/ops/barnops/*` (3 + hub) and `/app/ops/employees/*` (2 + hub) render locked. Not
  duplicates. **`mod.lessons`, `mod.horserecords` and `mod.brokerage` are ENABLED** — which is
  why `/app/ops/records` and `/app/ops/lessons/sessions` appear above as live surfaces.
- **`/app/ops/employees/schedule` vs `/app/schedule` vs `/app/calendar`.** The first is a
  **staff shift schedule** (shifts + time entries). Different concept, same word. Not a duplicate.
- **Member-facing vs staff-facing pairs that genuinely differ in permission and purpose:**
  `/app/support` (submit) vs `/app/ops/support` (triage); `/app/evaluations` (read/share/download
  a delivered report) vs `/app/ops/evaluations` (author and send one).
- **The shared primitives.** `DataTable`, `Modal`, `FormField`, `AsyncButton`, `StatusBadge`,
  `EmptyState`, `ModuleGate`, `StatusLog`, `PageLayout`, `PageHeader`. Used many times by design.
- **`PublicIntakeForm` / `ProvisionClientForm` / `CaptureInfoModal` / `CreateModal`.** Four
  forms, four genuinely different jobs (public intake / upgrade a contact to an account / fill a
  contract party's missing fields / the universal "+"). Each is already the single
  implementation of its job. Not duplicates.

---

# SEPARATE REPORT 1 — `PageLayout` / `PageHeader` non-adoption

**Not duplication. Possibly the larger cause of inconsistent UI.** Not fixed here; measured.

**Denominator:** the 80 `.tsx` files under `src/pages/app/**` — this reproduces the task doc's
"80 pages" exactly.

| | count |
|---|---|
| in-app page files | **80** |
| use `PageLayout` or `PageHeader` | **9** |
| **do not** | **71** |
| …of the 71, hand-roll their own `<h1>` | **63** |
| …of the 71, wrap it in their own `<header>` element | **12** |
| …of the 71, render no page title at all | **7** |

**The nine adopters:**

| file | route |
|---|---|
| `src/pages/app/Admin.tsx` | `/app/admin` |
| `src/pages/app/CareHome.tsx` | `/app/care` |
| `src/pages/app/ops/ContactsPage.tsx` | `/app/ops/leads`, `/app/ops/directory` (+ retired `/app/ops/contacts`) |
| `src/pages/app/ops/DealPage.tsx` | `/app/ops/deals/:dealId` |
| `src/pages/app/ops/DealsPage.tsx` | `/app/ops/deals` |
| `src/pages/app/ops/EvaluationReportsPage.tsx` | `/app/ops/evaluations` |
| `src/pages/app/ops/HorseRecordsPage.tsx` | `/app/ops/horse-records` |
| `src/pages/app/ops/LookupReviewPage.tsx` | `/app/ops/lookups` |
| `src/pages/app/ops/NewContractPage.tsx` | `/app/ops/contracts/new` |

**Creation dates tell the story:** `PageLayout.tsx` is `6822d98` · **2026-08-08**, `PageHeader.tsx`
is `9cdb5b1` · **2026-08-08**. Both are four days old. **71 of 80 pages predate the shared frame**
— this is not 71 pages ignoring a convention, it is a convention that arrived after the pages.
That materially changes the remedy: it is a **backfill**, not a discipline problem.

**The 7 with no page title at all:**
`CalendarItemPanel.tsx`, `CalendarSettingsPanel.tsx`, `OpsHome.tsx`,
`ops/BookingFieldsSettings.tsx`, `ops/InstructorHomePreview.tsx`, `ops/lessons/LessonLogEditor.tsx`,
`ops/lessons/ScheduleSessionForm.tsx` — **five of these are panels/forms, not pages**, and only
`OpsHome` (a 15-line role switcher) and `InstructorHomePreview` (a preview wrapper) are routed
pages. So the honest number of **routed pages with no title is 2**, not 7.

**Full list of the 71 non-adopters:** see the enumeration above in the analysis — every file
under `src/pages/app/**` except the nine adopters. Marked here rather than repeated: the useful
cut is the **63 that hand-roll an `<h1>`**, because each of those is one header row that could be
one `PageHeader`.

**Not fixed. No file was touched.**

---

# SEPARATE REPORT 2 — already in flight, listed as known and settled

**These were NOT re-derived and their decisions are NOT contradicted.**

| task | scope | status | does my evidence contradict it? |
|---|---|---|---|
| **`TASK-HORSEONE`** | one Horses page at `/app/ops/horses` | **specced; HELD pending this review** | **No.** Creation dates confirm 2026-07-01 → 2026-07-10 (nine days). Its treatment of `/app/ops/records` (keep the lanes, drop the roster, lanes stay gated on `mod.horserecords`) matches what I measured: the module is **enabled**, so the page is live in the nav. **One addition:** carry `listHorseBreeds`/`listHorseColors` lookup resolution across from `HorsesPage` — it is the one feature only the losing page has, and HORSEONE's "do not port features by hand" instruction would drop it. |
| **`TASK-LEADCLEAN`** | a lead card retires itself when the lead becomes a client | **MERGED `5d54177`, 2026-08-12 — during this census** | **No.** I measured 5 `LEAD` contacts and 12 `requests` (7 `new`, 5 `contacted`), of which **7 are `already_converted`** — consistent with its seven stale leads. **It closed half of finding 1.1** (badge and band now both read 5) and added `INTAKE_PAGE_RETIRED` + `LeadWorkDrawer`. Kit Garcin's row is reserved; I used **Marissa Robertson's** request id in the manifest below. |
| **`TASK-FRAMESCROLL`** | wide content scrolls in frame, header holds | **MERGED `29597ff` + `bab6fdd`, 2026-08-12 — during this census** | **No.** I observed `DataTable` with no scroll container at `33525cd` and **confirm the fix at `0687429`** (`DataTable.tsx:80-83`: `overflow-x-auto`, plus `tabIndex`/`role="region"`/`aria-label` only when actually overflowing). It **strengthens** 2.1's case for `DataTable` over hand-rolled markup. |
| **`TASK-ONEAUTHOR`** | one authoring page, renderer chosen by the document | **done** (`7c0f89f`, 2026-08-11) | **No.** `ClauseDocument`/`FlatDocument` are correctly excluded from this census. |
| **`TASK-LEASESET` / D10** | Standard / Simple / Detailed + archived original | **resolved** | **No.** Template duplication was not re-examined. |
| **`TASK-ROSTER` / `TASK-ROSTERCARD`** | the Clients page won; `/app/ops/contacts` retired | **done** | **No — and I confirm it with new evidence.** The two pages show the **same 17 people**, set-difference 0 in both directions. The retirement was right. The half-applied nav entry it left behind was **removed by ADMINSWEEP X-1 (`0687429`) during this census** (2.3). |
| **`ADMINSWEEP X-1`** | the ContactsPage retirement was half-applied | **MERGED `0687429`, 2026-08-12 — during this census** | **No — it closed my 2.3 headline.** I found the same defect independently while measuring; the fix is theirs and I verified it rather than restating the problem. |
| **Team nav move** (`7f20103`) | Team leaves People for the configuration group, takes `UserRound` | **MERGED 2026-08-12 — during this census** | **No.** Re-verified: `ACCOUNTS_GROUP` is now Leads / Clients / Directory; Team sits at `AppLayout.tsx:574`. Its comment records why it is deliberately **not** `adminOnly` — the route is `requireStaff`, and gating the nav tighter than the route would be *"a nav that lies about what you have."* Worth reading before any nav consolidation. |
| **`TASK-ONEPEOPLE`** (`9481414`) | Leads / Clients / Directory become tabs on one Contacts page at `/app/ops/contacts` | **SPECCED by the owner 2026-08-12 — during this census** | **No — it supersedes my 2.3 recommendation and I defer to it.** It reaches the same URL conclusion I did, by the same `TASK-HORSEONE` reasoning. **My section now answers its §5 capability-diff question** and flags two things it must carry: the `file(id, type)` filing control (the only `contact_type` writer in the app) and the `ContactForm` create defect, which its §5 tab-following requirement would otherwise re-ship. |
| **`FORMS-ARE-UNUSED-2026-08-12`** (`f6da69f`) | the 23 `form_definitions` rows are read by nothing | **documented** | **No, and it is adjacent to my 3.2.** That doc names a **third** hardcoded shadow (form definitions, read only by `AdminFormsPage`). Mine (`src/lib/serviceCatalog.ts`) is a **fourth, and a different one** — a front-end constant array with **zero** `src/` importers. Both should be resolved; neither supersedes the other. |

---

# THE REVIEW MANIFEST — input to `TASK-REVIEWNAV`

One row per **implementation**, grouped by concept, ordered A/B/C/D within each group.
**Slot A is the INCUMBENT** (the one currently in use), not the best.

Routes needing an id use real production ids so the comparison is like-for-like.

| Group | Slot | Label | Route | Reachable? | To wire it | Currently in nav at |
|---|---|---|---|---|---|---|
| **Horse roster** | A | `Horses A (in use)` | `/app/ops/horse-records` | `nav` | — | **Management → "Horses"** |
| Horse roster | B | `Horses B (2026-07-01 original)` | `/app/ops/horses` | `url-only` | add a nav entry under Review; route already registered at `App.tsx:279` | — |
| Horse roster | C | `Horses C (Records hub, module)` | `/app/ops/records` | `nav` | — (gated on `mod.horserecords`, **enabled**) | **Modules → "Records"** |
| **Staff landing** | A | `Staff home A (in use)` | `/app/dashboard` | `nav` | — | **Management → "Dashboard"** |
| Staff landing | B | `Staff home B (2026-07-01 OpsDashboard)` | `/app/ops` | `url-only` | add a nav entry; route registered at `App.tsx:258` | — |
| Staff landing | C | `Staff home C (InstructorHome preview)` | `/app/ops/preview/instructor-home` | `url-only` | add a nav entry; route registered at `App.tsx:265`. **Renders only via this preview — no production account has the non-admin staff role** | — |
| **People roster** ⚠️ | A | `People A (in use — Clients)` | `/app/admin` | `nav` | — . **⚠️ `TASK-ONEPEOPLE` (owner-specced 2026-08-12) rolls A/C/D into one tabbed page at `/app/ops/contacts`. If ONEPEOPLE ships first, this whole group collapses to two slots: the composed page vs slot B. REVIEWNAV must check which landed first.** | **People → "Clients"** |
| People roster | B | `People B (2026-07-01 ContactDirectory — RETIRED)` | `/app/ops/contacts` | **`RETIRED behind CONTACTS_PAGE_RETIRED`** | **flip `CONTACTS_PAGE_RETIRED` to `false` at `src/pages/app/ops/ContactsPage.tsx:523`** — while `true` the route `<Navigate>`s to `/app/admin` and the Review entry would land on slot A | **nothing — the "Contacts" nav row was removed by `0687429` on 2026-08-12.** There is no row to MOVE; REVIEWNAV must ADD one |
| People roster | C | `People C (same component, Leads mode)` | `/app/ops/leads` | `nav` | — (same file as B — reviewing B reviews C; **`TASK-LEADCLEAN` cleaned this page 2026-08-12**) | **People → "Leads"** — becomes a TAB under ONEPEOPLE |
| People roster | D | `People D (same component, Directory mode)` | `/app/ops/directory` | `nav` | — (same file as B; **0 rows in production** — an empty page with a nav entry) | **People → "Directory"** — becomes a TAB under ONEPEOPLE |
| **Account surface** | A | `Account A (in use)` | `/app/account` | `nav` | — | avatar/quick links → "Account" |
| Account surface | B | `Account B (2026-06-23 original)` | `/account` | `url-only` | route registered at `App.tsx:177`. **Redirects to `/app` for any member** — REVIEWNAV must note the reviewer will be bounced unless they are a non-member | — |
| **Member time surface** | A | `Time A (in use — Calendar)` | `/app/calendar` | `nav` | — | **quick links → "Calendar"** |
| Member time surface | B | `Time B (2026-06-23 Schedule)` | `/app/schedule` | `url-only` | add a nav entry; route registered at `App.tsx:207` | — |
| **Catalog** | A | `Catalog A (in use — in-app)` | `/app/catalog` | `nav` | — (`OfferingCatalog`) | **app quick links → "Catalog"** |
| Catalog | B | `Catalog B (public shop, same renderer)` | `/shop` | `nav` | — (`OfferingCatalog`) | **site footer → "Ways to Ride" AND "Book a Lesson"** — **two footer links to this one page**, `Footer.tsx:37-38`. REVIEWNAV should collapse them, not move both |
| Catalog | C | `Catalog C (funnel renderer — horse)` | `/horse` | `nav` | — (`ServiceSelector`) | **marketing header → "Horse Care Services"** (`Header.tsx:36`) + footer → "Horse Care" |
| Catalog | D | `Catalog D (funnel renderer — acquisition, RENDERS ZERO)` | `/acquisition` | `nav` | — . **Shows 0 offerings in production** — all 3 acquisition SKUs have `price_amount = NULL` and the reader filters them out. Label it in the Review section so nobody reports the review link as broken | **marketing header → "Find a Horse"** (`Header.tsx:37`) + footer → "Acquisition Support" |
| **Document viewer** | A | `Doc viewer A (in use — authoring)` | `/app/contracts/704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` | `url-only` (reached from Documents / queue / notifications) | — . **This is `DOC-J7NXZDHD5F`, the one document with a `NEEDS:` mark — pick this id so A and B can be compared on the difference that matters** | — |
| Document viewer | B | `Doc viewer B (2026-07-01 read-only)` | `/app/ops/documents/704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` | `url-only` (reached from the queue) | — . Same document, `MergedBodyView` renderer | — |
| **Document body renderer** | A | `Body A (ContractBody — NEEDS marks + span select)` | same as Doc viewer A | `url-only` | — | — |
| Document body renderer | B | `Body B (MergedBodyView — 2026-07-01 original)` | same as Doc viewer B | `url-only` | — | — |
| Document body renderer | C | `Body C (PDF renderer)` | **`NEEDS A ROUTE`** | **no route** | `src/lib/documentPdf.ts` is a non-React PDF writer. REVIEWNAV cannot mount it as a page — **compare it by emailing a signed copy** of the same document, or skip slot C | — |
| **Contact editor** | A | `Contact editor A (in use — Dossier, 30 fields)` | `/app/ops/leads` → click a person | `url-only` (modal) | **`NEEDS A ROUTE`** if the two are to sit side by side — `ContactDossierModal` takes a `contactId` prop and has no route of its own | — |
| Contact editor | B | `Contact editor B (2026-07-01 ContactForm, 4 fields)` | `/app/ops/leads` → "New lead" | `url-only` (modal) | **`NEEDS A ROUTE`** — `ContactForm` is a presentational form with no route. **Warning for REVIEWNAV: its create path does not set `contact_type`, so anything created through it lands on `/app/admin`, not the page it was created from** | — |
| **Inbound / leads** | A | `Inbound A (in use — dashboard band + drawer)` | `/app/dashboard` | `nav` | — (`useOpenLeads` → `listLeadQueue`, shows **5** open + **7** converted; `LeadWorkDrawer` opens in place) | **Management → "Dashboard"** |
| Inbound / leads | B | `Inbound B (2026-07-01 flat queue — RETIRED 2026-08-12)` | `/app/ops/intake` | **`RETIRED behind INTAKE_PAGE_RETIRED`** | **flip `INTAKE_PAGE_RETIRED` to `false` at `src/pages/app/ops/IntakePage.tsx:447`** — while `true`, `App.tsx:289` renders `IntakeRetiredRedirect`. **This constant is new (2026-08-12); do not assume an older list of retirements is complete** | — |
| Inbound / leads | C | `Inbound C (RequestInbox deep workflow)` | `/app/dashboard?request=9e6ec09c-ef9b-467c-bd84-3c2b2a259a02` | `url-only` | the query param opens that lead's drawer on the dashboard (LEADCLEAN repointed it there from `/app/ops/intake`). **Id is Marissa Robertson's request — deliberately NOT Kit Garcin's, which `TASK-LEADCLEAN` reserves** | — |
| Inbound / leads | D | `Inbound D (2026-07-01 KPI tile — still says 12)` | `/app/ops` | `url-only` | route registered at `App.tsx:258`. **The last surface still using the old definition** (finding 1.1) | — |
| **Signing capture** | A | `Signing A (in use — contract)` | `/app/contracts/e1052bae-c20c-47e3-8703-7ef64f2bf852` | `url-only` | — . `AWAITING_SIGNATURE` lease, so the signing block renders | — |
| Signing capture | B | `Signing B (member self-sign)` | `/app/documents` | `nav` **for non-staff only** | — (inline typed-name input in the list row). **A staff reviewer will not see this nav row** (`useNavPresence(!isStaff)`) — REVIEWNAV must add the Review entry explicitly or the owner cannot reach it | **member rail → "My Documents"**, hidden for staff |
| Signing capture | C | `Signing C (onboarding)` | `/app/onboarding` | `url-only` | route registered at `App.tsx:219`. Renders its signing step only for an account with pending onboarding documents | — |
| Signing capture | D | `Signing D (public kiosk)` | `/release` | `url-only` (public) | route registered at `App.tsx:185`. **Signs a real document — REVIEWNAV should label this destructive** | — |
| **Staff roster** | A | `Staff roster A (in use — Team)` | `/app/ops/team` | `nav` | — | **the configuration group** — moved out of People by `7f20103` on 2026-08-12, icon `UserRound` |
| Staff roster | B | `Staff roster B (2026-07-01 employees module)` | `/app/ops/employees/staff` | `url-only` | route registered at `App.tsx:327`, but **`mod.employees` is DISABLED for FHE** — the page renders `ModuleGate`'s locked fallback. **To review it, `mod.employees` must be enabled in `org_modules` first.** Listed for completeness; ranked lowest | — |

### Notes REVIEWNAV cannot re-derive

1. **TWO booleans hide a page**, both exported: `CONTACTS_PAGE_RETIRED`
   (`src/pages/app/ops/ContactsPage.tsx:523`, imported at `App.tsx:79`) and
   **`INTAKE_PAGE_RETIRED`** (`src/pages/app/ops/IntakePage.tsx:447`, imported at `App.tsx:91`).
   The other five module-level booleans hide a body preview, card payment, seed data, an auth
   method and an animation — none is a page. Full table in 3.7. **`INTAKE_PAGE_RETIRED` landed
   on 2026-08-12, after this census began — re-derive this list, do not copy it.**
2. **The "Contacts" nav row no longer exists** — removed by `0687429` on 2026-08-12. There is
   **nothing to MOVE** for People slot B; REVIEWNAV must ADD a Review entry and flip the boolean.
   Same for Inbound slot B.
3. **Three of these groups share one file.** People B/C/D are all `ContactsPage.tsx`
   (`ContactDirectory` in three modes) — reviewing B reviews C and D's implementation.
   Catalog A/B are both `OfferingCatalog`; C/D are both `ServiceSelector`.
4. **Two components have no route and cannot be reviewed side-by-side without one being
   mounted:** `ContactDossierModal` and `ContactForm`. Both take props, not URL params.
5. **`/acquisition` will render an empty selection area.** That is the finding, not a broken
   review link — REVIEWNAV should label it so nobody reports the review page as broken.
6. **Single-implementation pages were deliberately excluded** from this manifest, per the
   addendum. The Review section is for comparisons.

---

# SUMMARY — the shortest version

- **Five numbers in this app were wrong or contradicted when this census began**, all provable.
  One was fixed mid-census. The four still live: inbound work (**5 vs 12**), horse documents
  (**0 shown where 8 exist**), lesson sessions (**318 shown where 39 exist**), member documents
  (**13 vs 5**), and **a page in the marketing site's primary navigation ("Find a Horse") that
  shows 0 of 3 services and cannot be completed.**
- **Two nav lists carried two entries pointing at one page.** The app's People group ("Clients"
  and "Contacts", both landing on `/app/admin`) — **fixed on 2026-08-12 by `0687429`**. The site
  footer ("Ways to Ride" and "Book a Lesson", both `/shop`, `Footer.tsx:37-38`) — **still there,
  one line.**
- **Four code comments asserted things that were false**, each in a file a thread trusted:
  `useOpenLeads.ts:38` (at `33525cd`) (**now true** — the code caught up), `ContactsPage.tsx:521` (**now true**
  — the nav entry was removed), `ContractCascade.tsx:240-241` (*"the single body renderer used
  across the app"* — **still false**, there are three), `serviceCatalog.ts:3` (*"Every UI that
  names a service reads from here"* — **still false**, none does).
- **The owner's diagnosis holds in 4 of 6 head-to-head cases.** The 2026-07-01 originals hold
  the better craft in horses (lookup resolution, `DataTable`), people (`FormField`, validation),
  document rendering, and ops KPIs (per-tile error branches, 20% comments, zero arbitrary
  values). The replacements hold the better *capability*. **The exception is the catalog**,
  where the newer `OfferingCatalog` beats the original `ServiceSelector` on every marker but
  accessibility.
- **The cheapest remaining high-value fixes**, in order: one SQL sub-select (1.2), one
  `.eq('status', …)` (1.3), one filter clause (1.5), one function body (1.1), three link call
  sites (2.7), one footer line (1.5). **None is a rebuild.**
- **`PageLayout` is four days old.** 71 of 80 in-app pages predate it. That is a backfill, not
  a discipline failure — and it is probably the larger cause of the inconsistent UI.
- **`main` moved twice under this census and closed three of my findings.** LEADCLEAN, FRAMESCROLL
  and ADMINSWEEP X-1 landed while I was measuring them; the Team nav moved; and the owner specced
  **ONEPEOPLE**, which supersedes my People recommendation outright. **That is worth more than any
  single finding here:** the codebase is being corrected faster than one audit can describe it.
  Anything downstream of this report — **REVIEWNAV especially** — must re-derive route tables,
  nav groups and retirement constants against `main` **at the moment it runs**, not trust this
  document's snapshot. The manifest flags each row where that matters.

**No code was changed. `git diff` against `0687429` shows `docs/` only.**
