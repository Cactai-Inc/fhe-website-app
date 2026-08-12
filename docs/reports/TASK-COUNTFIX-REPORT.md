# TASK COUNTFIX — five numbers, five definitions, one reader each

**Worktree** `wt-countfix` · **branch** `task/countfix` · **base** `origin/main` @ **`0567935`**
(rebased mid-task from `ab8bb83`; TEXTEDIT and PAGEVIS landed while this ran — no conflicts)
**Three commits, not pushed.** Two migrations **applied to production**
(`db.lrstswfxfsezdmvkvukc`).
`npm run typecheck` 0 errors · `npm run typecheck:api` unaffected · `npm run lint` 0 errors
(39 pre-existing warnings, none in the files this touched) · `npm run build` succeeds.

> **A note on how this ran.** The worktree was **deleted and recreated by another process
> mid-session**, taking the first pass of the uncommitted edits with it. The DB migration
> already applied to production survived; the files did not. Everything was redone and
> **committed immediately** thereafter, which is why this landed as three commits rather
> than one. Nothing in this report is from the lost pass — every number below was re-run
> against production after the rebase.

---

# THE ANSWER SHEET

**What the task asked for, in one line each: what the number MEANS, and the single query
that produces it.** Every surface listed now reads that one query and nothing else.

| # | The number means | The ONE query | Read by |
|---|---|---|---|
| **1.5** | **A public catalog item** = an ACTIVE offering in this segment. Price is presentation, never a filter. | `public_offerings()` → filter `segment = X` (`fetchPublicCatalog`) | `/acquisition`, `/book/support`, `/horse`, `/book/horse`, `/book/rider`, `/lessons`, `/sign/*` |
| **1.2** | **A horse's documents** = `documents` for that horse, not soft-deleted, in this org. | `SELECT count(*) FROM documents d WHERE d.horse_id = h.id AND d.deleted_at IS NULL AND d.org_id = h.org_id` (inside `staff_horse_records()`) | `/app/ops/horse-records` "Documents · N attached"; identical predicate to `/app/ops/documents` → By horse |
| **1.3** | **A lesson** = a `bookings` row, `kind='lesson'`, whose status is **not** `available`. An open slot is not a lesson. | `bookings WHERE kind='lesson' AND status <> 'available'` (`listLessonSessions`) | `/app/ops/lessons/sessions`, staff `/app/schedule`, `InstructorHome` |
| **1.4** | **A member's documents** = `my_documents()`. The contract subset is that same list where `is_contract`. | `my_documents()` (+ `.filter(d => d.is_contract)`) | `/app/documents`, `/app/account` → My Documents, `/app/deal`, `/app/onboarding` |
| **1.1** | **Inbound work waiting** = open inbound-queue rows whose lead has not already become a client, **plus** unresolved support requests. | `inbound_open_count()` | Dashboard nav badge, `/app/dashboard` band (via the same predicate in `useOpenLeads`), `/app/ops` KPI tile |

**Where two definitions are legitimately different, they are now labelled differently and
counted separately — never sharing a word:**

- **1.3** — `countOpenLessonSlots()` counts the 279 open slots. It is never called a lesson;
  the sessions board reads **"39 lessons · 279 open slots on the calendar"**.
- **1.4** — `/app/deal` shows a strict **subset** of `/app/documents`, and when that subset is
  empty it now says so in words and links through, instead of reading "nothing here yet"
  beside a Documents page holding six.

---

# 1.5 — `/acquisition` renders three services instead of nothing · **PUBLIC**

**Owner: please open these two yourself. They are the only surfaces in this task that need
no login.**

- **https://fhequestrian.com/acquisition** — was blank in the selection area with "Continue"
  disabled; should now show **three cards**: Horse Finder, Horse Evaluation, Acquisition
  Assistance, each reading **"Inquire for pricing"**.
- **https://fhequestrian.com/shop** — unchanged in content (27 items), and the footer below
  it no longer offers two labels for one destination.

*(Substitute your own host if the deploy lives elsewhere — the routes are `/acquisition` and
`/shop`.)*

### What was wrong

`publicCatalog.ts:31` filtered `config_kind !== 'inquire' && price_amount != null`. All three
of FHE's active acquisition services are unpriced, so all three were dropped and the page
rendered its heading, its step indicator and **nothing**, with `canProceedStep0 = itemCount > 0`
holding "Continue" disabled and no text explaining why.

**One correction to the spec's wording:** the task says the three offerings are `config_kind
= 'inquire'`. They are not — they are `document_transaction`, `intake_evaluation` and
`intake_finder`. **It is the `price_amount != null` clause alone that emptied the page.** No
active offering in any segment has `config_kind = 'inquire'`, so that clause was inert.

```sql
SELECT segment,
       count(*) AS active_offerings,
       count(*) FILTER (WHERE config_kind <> 'inquire' AND price_amount IS NOT NULL) AS old_filter,
       count(*) AS new_filter
FROM public_offerings() GROUP BY segment ORDER BY segment;
```
```
   segment   | active_offerings | old_filter | new_filter
-------------+------------------+------------+------------
 acquisition |                3 |          0 |          3     ← the page was empty
 horse       |               12 |         12 |         12
 rider       |               12 |         12 |         12
```

### What it renders now — proven by re-running the client's own grouping in SQL

```sql
SELECT t.sort_order, t.code AS group_code, t.display_name AS group_heading,
       o.name AS card, coalesce(o.price_amount::text,'(no price -> "Inquire for pricing")') AS price
FROM service_types t
JOIN public_offerings() o ON o.service_type = t.code AND o.segment = 'acquisition'
WHERE t.active AND t.segment = 'acquisition'
ORDER BY t.sort_order, o.sort_order;
```
```
 sort_order |        group_code         |     group_heading      |          card          |               price
------------+---------------------------+------------------------+------------------------+-------------------------------------
          1 | HORSE_FINDER              | Horse Finder           | Horse Finder           | (no price -> "Inquire for pricing")
          2 | HORSE_EVALUATION          | Horse Evaluation       | Horse Evaluation       | (no price -> "Inquire for pricing")
          3 | HORSE_PURCHASE_ASSISTANCE | Acquisition Assistance | Acquisition Assistance | (no price -> "Inquire for pricing")
```

### The decision, stated

**Quote-priced services are shown, and the price line says so.** The wording and the pattern
are not new — `OfferingCatalog` (`/shop`) has always rendered `price_amount == null` as
*"Inquire for pricing"* with an **Inquire** button. The funnels now do the same thing, which
is why this is a consolidation and not a sixth behaviour.

**The funnel is safe to complete with an unpriced item.** For a signed-out visitor,
`/checkout` is a **booking request**, not a payment — so an enquiry-priced service is exactly
what the funnel is for. A null price is carried through the cart as
`priceOnEnquiry` (`cart.ts`), and **`$0` is never printed**: the cart line, the three review
summaries and the checkout summary all read **"Price on enquiry"**. Per-cadence subtotals are
unchanged (an enquiry line contributes 0, and that group's comment already says the total is
"fixed-price items").

### Also fixed there

- **`ServiceListState`** (new, 57 lines, one component for all three funnels): the loading /
  error / empty notice. `BookSupport`, `BookHorse` and `BookRider` all did
  `{groups.map(...)}` with no empty branch and `.catch(() => setGroups([]))`, so **a failed
  fetch and an empty catalog looked identical** — a blank area, no explanation. Each funnel
  now distinguishes the three states, and the empty/error notice carries the phone, the email
  and a link to `/shop`.
- **`Footer.tsx:37-38`** — *"Ways to Ride"* and *"Book a Lesson"* were adjacent entries both
  pointing at `/shop`. "Book a Lesson" now points at **`/lessons`**, which is a real
  registered route (`App.tsx:159`) and is the lesson funnel.

**Files:** `src/lib/publicCatalog.ts`, `src/components/ServiceSelector.tsx`,
`src/components/ServiceListState.tsx` *(new)*, `src/components/OfferingCatalog.tsx`,
`src/lib/cart.ts`, `src/pages/Checkout.tsx`, `src/pages/BookSupport.tsx`,
`src/pages/BookHorse.tsx`, `src/pages/BookRider.tsx`, `src/components/layout/Footer.tsx`.

---

# 1.2 — a horse's "Documents attached" now means documents

**Migration `20260812T1700_countfix_horse_document_count.sql` — dry-run in a transaction,
applied to production, verified.**

`staff_horse_records().document_count` counted **relationship rows created by a document**,
under a label that says "Documents" and beside a link that opens the documents queue.

```sql
SELECT coalesce(h.nickname,h.registered_name) AS horse,
  (SELECT count(*) FROM horse_relationships r
    WHERE r.horse_id=h.id AND r.source_document_id IS NOT NULL)              AS old_relationship_rows,
  (SELECT count(*) FROM documents d
    WHERE d.horse_id=h.id AND d.deleted_at IS NULL AND d.org_id=h.org_id)    AS new_document_count,
  (SELECT count(*) FROM documents d
    WHERE d.horse_id=h.id AND d.deleted_at IS NULL)                          AS queue_by_horse
FROM horses h
WHERE h.org_id='e656f20b-ef43-4725-9029-19e7f0190d9c' AND h.deleted_at IS NULL
ORDER BY 1;
```
```
   horse   | old_relationship_rows | new_document_count | queue_by_horse
-----------+-----------------------+--------------------+----------------
 Beau      |                     3 |                  5 |              5
 Peep Show |                     0 |                  6 |              6
 Secret    |                     0 |                  3 |              3
 Tiz       |                     0 |                  6 |              6
```

**All four horses now agree with the queue.** Three of them read "0 attached" beside a
documents icon while holding 6, 3 and 6 documents; Beau read "3" for 2 documents, because two
relationship rows shared one source document.

**One reconciliation against the census.** `TASK-DUPECENSUS` recorded Secret at 5 and Tiz at
8. Those figures **included soft-deleted rows**: Secret has 5 documents of which 2 are
soft-deleted, Tiz 8 of which 2 are. The queue's own reader (`listDocuments()`) filters
`deleted_at IS NULL`, so 3 and 6 are the numbers a person actually sees, and they are what
the record now shows.

**Nothing was retired.** The relationship-provenance count is genuinely interesting and is
simply not a count of documents; no surface asked for it, so it is not carried as a second
field — that would be a sixth definition looking for a home.

---

# 1.3 — a lesson is a lesson; an open slot is an open slot

```sql
SELECT status, count(*) FROM bookings WHERE kind='lesson' GROUP BY status ORDER BY 2 DESC;
```
```
  status   | count
-----------+-------
 available |   279
 scheduled |    39
```
```sql
SELECT 'listLessonSessions (new: status <> available)', count(*) FROM bookings WHERE kind='lesson' AND status <> 'available'
UNION ALL SELECT 'countOpenLessonSlots (status = available)', count(*) FROM bookings WHERE kind='lesson' AND status = 'available'
UNION ALL SELECT 'listLessonSessions (OLD: no filter)',      count(*) FROM bookings WHERE kind='lesson';
```
```
 listLessonSessions (new: status <> available) |    39
 countOpenLessonSlots (status = available)     |   279
 listLessonSessions (OLD: no filter)           |   318
```

`listLessonSessions()` had **no status filter**, so all three of its readers — the staff
`/app/schedule`, `SessionsPage`, and `InstructorHome` — were served 318 rows where 39 lessons
existed. A trainer's day read about 5× busier than it was.

**A second defect fell out with it.** `lessonSessionFromBooking` upper-cases the booking
status into `LessonSessionStatus`, a union of `SCHEDULED | COMPLETED | CANCELLED | NO_SHOW`
with **no `AVAILABLE` member**. Those 279 rows carried a status no label map in the app could
render. Excluding them makes the type honest as well as the count.

**The separation is on screen, not implied.** `countOpenLessonSlots()` is the complement,
named for what it is, and `/app/ops/lessons/sessions` now states both under its heading:

> **39 lessons · 279 open slots on the calendar** *(the slot count links to `/app/calendar`)*

Open slots are not hidden — `/app/calendar` already renders them, labelled **"Open"**
(`CalendarPage.tsx:108`).

**Coordination with item 17 (`OPSHOME`), as the task required: this task changed the QUERY
(`src/lib/ops/api-lessons.ts`) and one line of the SessionsPage header. `InstructorHome.tsx`
was NOT touched** — it consumes the corrected reader and its own defects remain OPSHOME's.

---

# 1.4 — the member's documents have one definition, and `/app/deal` filters it

**Migration `20260812T1710_countfix_my_documents_is_contract.sql` — dry-run, applied,
verified.**

### The spec's hypothesis was wrong, and here is the check

The task expected the **wider** count to be the bad one — "documents they are a party to but
cannot read, or soft-deleted rows". **Checked against the RLS: false.**

- `my_documents()` is visible on `contact_id = current_contact_id() OR caller_is_document_party(id)`.
- `documents_select` admits `is_admin() OR caller_owns_document(id) OR caller_is_document_party(id)
  OR (horse_id IS NOT NULL AND client_can_read_horse(horse_id))`.
- The first is a **strict subset** of the second. Both exclude `deleted_at IS NOT NULL`.

Per real account (`a_docs` = my_documents' real rows, `a_assigned` = its
assigned-but-not-generated placeholders, `b_contracts` = my_contract_documents,
`c_rls_readable` = what `documents_select` admits):

```
             email              | a_docs | a_assigned | b_contracts | c_rls_readable
--------------------------------+--------+------------+-------------+----------------
 cjzigs@icloud.com              |     11 |          0 |           5 |             15
 sarahrosengard@gmail.com       |      8 |          0 |           1 |              9
 claire.bourdon21@gmail.com     |      6 |          0 |           0 |              6
 maeboon@gmail.com              |      6 |          0 |           0 |              6
 madelinedo@gmail.com           |      4 |          0 |           0 |              4
 cjzigs+inviteworks@icloud.com  |      0 |          4 |           0 |              0
 cjzigs+inviteworks2@icloud.com |      0 |          4 |           0 |              0
```

`a_docs ≤ c_rls_readable` for **every** account. **`my_documents()` has never listed a
document the member cannot open**, so it is the right count and it stays. *(The census's 13
vs 5 was measured before the row set changed; today's numbers are 11 vs 5.)*

### The real defect, which the census did not name

`my_contract_documents()` has **no void filter**. For `cjzigs@icloud.com` its 5 rows include
**two VOIDED leases**, and `DealHome` split on `status !== 'EXECUTED'` — so both landed under
**"Agreements that need you"**. The page was asking a member to sign two dead documents.

```
                  id                  |         title         |       status       | current_status
--------------------------------------+-----------------------+--------------------+----------------
 ecaecd42-…f9f3 | Horse Lease Agreement | EXECUTED           | signed
 215bac09-…ea1e2| Horse Lease Agreement | AWAITING_SIGNATURE | ready_to_sign
 9a56b738-…d753 | Horse Lease Agreement | VOID               | void            ← offered "Review & sign"
 e1052bae-…bf852| Horse Lease Agreement | AWAITING_SIGNATURE | sent_for_review
 b7233813-…53c1 | Horse Lease Agreement | VOID               | void            ← offered "Review & sign"
```

### The fix

`my_documents()` gains **`is_contract`** = `EXISTS (SELECT 1 FROM contract_fields cf WHERE
cf.document_id = d.id)` — precisely the predicate `my_contract_documents()` selected on.
`/app/deal` now reads `my_documents()` and filters it, so **the two surfaces can never
disagree about whether a document exists**, and the void exclusion comes for free.

The two numbers are still different, deliberately — one is a subset of the other — so the
page **says which is which** rather than leaving the member to guess:

> *"No negotiable agreements yet … Your other 6 documents are in **Documents**."*

**On the DROP.** Adding an output column changes the return type, which `CREATE OR REPLACE`
refuses, so the migration does `DROP FUNCTION IF EXISTS public.my_documents()` first. The only
other reference is `my_nav_presence()`, which does `EXISTS (SELECT 1 FROM my_documents()
LIMIT 1)` — column-agnostic and resolved at runtime; the drop and create are one transaction.

**`myContractDocuments()` is retained, annotated, and no longer read by anything.** It is
**not** deleted, per the standing rule. Two cautions are recorded in its docblock for anyone
who wires it up again: no void filter, and its staff branch returns the whole org rather than
"mine".

**One correction to the census** while I was in there: it says `ContractPage` needs
`my_contract_documents`'s `open_change_requests` / `my_roles` fields. It does not —
`ContractPage` reads **`contract_document_detail()`**, a different RPC. `DealHome` was
`my_contract_documents`'s only consumer in the codebase.

---

# 1.1 — inbound work states one number, and all three surfaces agree

`countPendingIntake` was the third definition: every `requests` row with status `new` or
`contacted`, counted client-side, with no `already_converted` filter and no support requests.

**`useOpenLeads` and `DashboardPanel.tsx` were NOT touched** — LEADCLEAN's shipped design is
intact, and the constraint to keep the dashboard and the badge in step is satisfied by not
moving either of them. The tile came to them.

```sql
SELECT 'A nav badge  = inbound_open_count()',
  (SELECT count(*) FROM inbound_queue q WHERE q.org_id='e656f20b-…'
     AND q.status NOT IN ('converted','expired') AND NOT coalesce(q.already_converted,false))
+ (SELECT count(*) FROM support_requests WHERE org_id='e656f20b-…' AND status <> 'resolved')
UNION ALL
SELECT 'B dashboard  = useOpenLeads (listLeadQueue + support)',
  (SELECT count(*) FROM inbound_queue q WHERE q.org_id='e656f20b-…'
     AND coalesce(q.already_converted,false) IS NOT TRUE
     AND q.status NOT IN ('converted','expired')
     AND EXISTS (SELECT 1 FROM requests r WHERE r.id=q.id))
+ (SELECT count(*) FROM support_requests WHERE org_id='e656f20b-…' AND status <> 'resolved')
UNION ALL
SELECT 'C /app/ops   = inbound_open_count()  [after this change]', … same as A …
UNION ALL
SELECT 'C OLD countPendingIntake = requests IN (new,contacted)',
  (SELECT count(*) FROM requests WHERE status IN ('new','contacted'));
```
```
 A nav badge  = inbound_open_count()                                |  6
 B dashboard  = useOpenLeads (listLeadQueue + support)              |  6
 C /app/ops   = inbound_open_count()  [after this change]           |  6
 C OLD countPendingIntake = requests IN (new,contacted)             | 13
```

**All three agree at 6. The old tile said 13** — it counted seven leads whose person has
already become a client, plus it never counted support requests at all.

`listLeadQueue` drops a queue row that has no matching `requests` row (`if (full) open.push`).
That could in principle put the band one below the badge, so it was checked: **zero
`inbound_queue` rows lack a `requests` row** (`inbound_queue` is a view over `requests`).

**Two more things that were wrong about that tile, fixed with it:**

- **Its label lied by omission.** "Intake to review" never mentioned support requests, which
  the definition includes. It now reads **"Inbound work waiting"** — the same words as the
  concept, on all three surfaces.
- **It linked to a retired page.** `to: '/app/ops/intake'` — `INTAKE_PAGE_RETIRED` is `true`,
  so that route only bounces through `IntakeRetiredRedirect` to `/app/dashboard`. It links
  there directly now.

`src/lib/reviewSection.ts` (the temporary Review nav from `TASK-REVIEWNAV`) described slot D
as *"the last surface still using the old definition, which is why it says 12"*. That copy is
updated — leaving it would have been a fourth statement of a number that no longer exists.

> **Numbers moved since the census.** It recorded 5 / 5 / 12 against 12 `requests` rows.
> Production now holds 13 `requests` (8 `new`, 5 `contacted`), 7 of them already-converted, so
> the same two definitions read **6** and **13** today. The disagreement was the point, and it
> is gone either way.

---

# WHAT IS NOT VERIFIED

Stated plainly, so nothing reads as more proven than it is.

- **No staff browser session exists**, so **every staff-side render is NOT VERIFIED**:
  `/app/ops/horse-records`, `/app/ops/lessons/sessions`, `/app/ops`, `/app/deal`,
  `/app/documents`. Each is proven at the **data** layer with the SQL above and at the
  **type** layer by a clean `typecheck` + `build`; none has been looked at.
- **`/acquisition` and `/shop` are public and are the owner's to confirm** — URLs are at the
  top of §1.5. The three cards and their grouping are proven in SQL by re-running the
  client's own grouping logic, but nobody has seen the page.
- **`test:db` was not cited as proof** anywhere in this report, per the constraint. It is
  broken (60 of 68 files failing) and is `TASK-TESTDB`'s subject.
- **`ClauseDocument.tsx` was not touched** — STOP-AND-PROPOSE, and nothing here needed it.
- The **two enquiry lines in a mixed cart** (one priced item + one "Price on enquiry" item)
  render a per-cadence subtotal covering only the priced ones. That is correct and the
  group's own comment says so, but it has not been seen on screen.

---

# FLAGGED, NOT FIXED

Real defects found while verifying, deliberately out of scope. **None is required by this
task's tests; all are recorded so they are not rediscovered a third time.**

1. **`Schedule.tsx` still casts one type to another to compile** (`isStaff ? listLessonSessions()
   as unknown as MemberLessonSession[] : myLessonSessions()`), and still heads the staff view
   **"Your lessons"** while listing the whole property's. The count is now right; the page is
   not. **Census 2.5 owns the consolidation.**
2. **`DashboardPanel` has no loading and no error branch** — every fetch is `.catch(() => …)`,
   so a failed read renders "you're all caught up". LEADCLEAN did not touch it and neither did
   this task, because the constraint was to leave its shipped design alone. **The census's
   recommendation stands: port `OpsDashboard`'s inline per-tile error branch into it.**
3. **A staff account has no nav route to its own documents** (`useNavPresence(!isStaff)`,
   `AppLayout.tsx`). Unrelated to the counts, but it is why staff-side document behaviour is
   hard to check by hand.
4. **`my_contract_documents()`'s staff branch returns every contract in the org**, under a
   function named "my". Nothing reads it now. If it is ever revived, that is a trap.
5. **`countOpenLessonSlots()` is org-scoped by RLS only** — like `listLessonSessions()`, it
   trusts the `bookings` policies rather than naming an org. Consistent with its neighbour,
   noted because it is a new reader.

---

# COMMITS

```
20acafd  COUNTFIX 1.1: the Ops KPI tile adopts inbound_open_count()
ac6b61b  COUNTFIX 1.4: /app/deal reads the member's one document list, filtered
ffbb296  COUNTFIX 1.5 + 1.2 + 1.3: one definition per number
0567935  (origin/main)
```

**Migrations applied to production:**
`supabase/migrations/20260812T1700_countfix_horse_document_count.sql`
`supabase/migrations/20260812T1710_countfix_my_documents_is_contract.sql`

Both replace whole function bodies rather than string-patching them, so — unlike the ~31
rewrite-in-place migrations CLAUDE.md warns about — **both are safe to replay on a fresh
database.**

**Not pushed**, per the constraint.

---

# THE TEST THIS HAD TO PASS

| | | |
|---|---|---|
| 1 | `/acquisition` renders something truthful | **Data proven** (3 groups, 3 cards, "Inquire for pricing"). **Owner confirms the render** — public URL in §1.5. |
| 2 | The footer no longer offers two labels for one destination | **PASS** — "Book a Lesson" → `/lessons`. |
| 3 | A horse's "documents attached" agrees with the queue, for all 4 horses | **PASS** — 5/6/3/6 both sides, in production. |
| 4 | The lessons surface separates 39 scheduled from 279 available, and does not present a slot as a lesson | **PASS** — reader excludes `available`; the board states both numbers with different words. |
| 5 | A member's document count agrees between both surfaces and matches what RLS lets them read | **PASS** — one reader, `is_contract` filter; `my_documents ⊆ documents_select` proven per account. |
| 6 | Inbound work states one number, and the dashboard and nav badge still agree | **PASS** — all three at 6; `useOpenLeads` and `DashboardPanel` untouched. |
| 7 | Each of the five has ONE named query, read by every surface that shows it | **PASS** — the answer sheet at the top. |
