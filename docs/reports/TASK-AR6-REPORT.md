# TASK-AR6 — REPORT: should Activity and Oversight be one page?

**Thread:** TASK-AR6 · **Worktree:** `~/Downloads/claude-code-repo/wt-ar6` · **Branch:** `task/ar6`
**Method:** read-only source analysis + production `psql` (SELECT, plus two role probes wrapped in
`BEGIN; … ROLLBACK;` — declared in §4, F4/F5). No code changed. No migration written.

## THE ANSWER, IN ONE PARAGRAPH

**Yes — merge them, but not into "Activity + Oversight".** The honest merge is **one page called
Oversight, in AR4's renamed Admin section, with the activity feed as a band inside it** — and the
feed must be driven by **`dash_activity_readback`** (five ledgers, org-scoped, already built and
already live on the dashboard as zone B6), **not** by `status_feed`, which is what
`/app/ops/activity` reads today and which covers **one ledger of five**. The reframing §2 of the
brief offered is **correct but inverted**: these two pages are not the unfinished halves of the D19
read — **the D19 read was finished on 2026-08-22 by TASK-DASHBOARDBUILD and neither page was told.**
The Activity page links *from* B6 as "the full activity log" while showing strictly **less** than the
collapsed summary that links to it. Three independent authorities already point the same way:
**CR-30** demoted Activity from a page to a link; **ADMIN-IA §1** already writes the Admin section's
entry as one item, *"Oversight/activity log"*; and **CR-63** says Activity "stops being a
destination". ⚠️ **But CR-30's named destination — Account History — does not exist in the
codebase** (zero hits for `AccountHistory`/`account history` anywhere in `src/`), so Activity cannot
be demoted *there* yet. Folding it into Oversight is the move that is available today and does not
contradict CR-30; it parks the org-wide feed on the admin watch page and leaves the per-person
history for CR-30's build.

---

## 1. ⚠️ URGENT

### U1 — `admin_oversight()` reads `audit_logs` with **no tenant filter at all**, and `audit_logs` has no `org_id` column

`admin_oversight()`'s activity block is, verbatim from production:

```sql
SELECT occurred_at, action, table_name, actor_user_id
FROM audit_logs
ORDER BY occurred_at DESC
LIMIT 50
```

No `WHERE`. The function is `SECURITY DEFINER`, so RLS does not apply, and the underlying policy
would not have helped anyway:

```
audit_logs_admin_read  FOR SELECT TO authenticated  USING (is_admin())
```

`is_admin()` is `app_role() IN ('ADMIN','SUPER_ADMIN')` — **it does not mention the org.** And
`\d audit_logs` confirms the table has **no `org_id` column**, so no filter is even possible without
a schema change. Every other read on both pages is correctly scoped (`status_feed` and
`dash_activity_readback` both filter `org_id = current_org()`), which is what makes this one stand
out rather than read as an accepted design.

**Why it is URGENT and not just a finding:** the platform is being rebuilt as multi-tenant
(`docs/rebuild` framing, 2026-08-27). Today there is exactly one organization
(`French Heritage Equestrian`), so nothing leaks *yet*. **The second tenant makes this a
cross-tenant disclosure on the tenant admin's own watch page, silently, with no code change
required to trigger it.** It is the one thing here that gets worse by doing nothing.

**Proven, not inferred:** impersonating the SUPER_ADMIN (whose `profiles.org_id` is `NULL`, so
`current_org()` returns NULL), every org-scoped number on the Oversight page returned **0** — and the
"Recent activity" list still returned **50 rows**. The unscoped panel is the only one that survived
the org boundary being absent. That is the leak, demonstrated.

⚠️ **Not fixed, per the standard. Do not fix it in this thread.**

---

## 2. WHAT THIS AREA IS FOR

**In plain language, one sentence each — §3 Q1.**

**Oversight** — *"Is anything wrong with the business right now, and is anything broken in the
paperwork?"* Four count tiles (members, open support, live posts, flagged posts), a document
integrity panel that names broken documents and lets the owner clear them one at a time with a
written reason, and a list of the last fifty database changes.

**Activity** — ⚠️ **I cannot write that sentence, and per Q1 that is the finding.** The page's own
docblock says it is *"the org-wide aggregate status feed … one place to see the lifecycle of every
account, document, order, and offering."* But of the 200 rows it renders on production today, **138
are `offering` rows reading "Scheduled" or "Completed" with no detail, no name, no actor and no
link** (§4, F6). The nearest true sentence is *"what state changes has the app recorded lately,
without saying to whom, by whom, or about what"* — and nobody comes to a page to ask that.

**Who each is for.** Both are staff surfaces (`ProtectedRoute requireStaff`), both sit in the
`community` nav group, and **neither carries `adminOnly`** — but Oversight's only data call is
`is_admin()`-gated server-side. So they claim the same audience and only one of them honours it
(F4).

---

## 3. THE STATE MATRIX

⚠️ Every row below was produced by running the real functions against production under
`SET LOCAL request.jwt.claims`, not by reading the components.

| State | Nav row visible? | Route reachable? | **Activity** shows | **Oversight** shows |
|---|---|---|---|---|
| **ADMIN** (2 in prod) | ✅ both | ✅ | **200 rows.** 138 offering · 27 document · 17 account · **10 fulfillment (blank label — F6)** · 8 order | ✅ Members 12 · Open support 0 · Live posts 32 · Flagged 0 · integrity panel · 50 audit rows |
| **SUPER_ADMIN** (1 in prod) | ❌ **neither** — `manageNavGroups` returns the Platform rail only (`AppLayout.tsx:620-623`) | ✅ **yes, by URL** — `requireStaff`, and `isStaff` includes SUPER_ADMIN (`AuthContext.tsx:201`) | **0 rows** → *"No activity in this view yet."* — `current_org()` is NULL because that profile's `org_id` is NULL | **all four tiles read 0**, integrity panel errors, **but "Recent activity" still lists 50 rows** (U1) |
| **MANAGER / EMPLOYEE** (0 in prod today; the instructor lane) | ✅ **both** — COMMUNITY_GROUP sets no `adminOnly` | ✅ | ✅ **200 rows, fully works** — `status_feed` gates on `has_staff_access()` | ❌ **`admin_oversight()` raises `admin access required`** → the page renders *"Could not load oversight."* **and nothing else** — including the integrity panel, which is staff-gated and would have worked (F4) |
| **Instructor with the Oversight grant** | same as above | same | same | ❌ **identical failure.** The grant is a double no-op — see F5 |
| **USER / member** | ❌ | ❌ redirected to `/app` | — | — |
| **Anonymous** | ❌ | ❌ | — | — |
| **Mobile (owner's working device)** | ✅ | ✅ | `max-w-4xl`, flush left, **16px side inset** | `max-w-4xl mx-auto py-8 px-4` **inside a `<main>` that already applies `px-4 … pt-10`** → **32px inset and centred.** Two adjacent pages in one section do not line up (F9) |
| **Empty / populated** | — | — | Not empty: 1,319 `status_events` | Not empty: 5,611 `audit_logs`; `receipt_sends` is 0 rows but **has live writers** — pre-launch, **not** a finding |

**Contact-with-no-account · client-never-invited · invited-never-signed-in · active-with-orders ·
archived** — these five client states **do not vary either page**, because neither page is scoped to
a person. That is itself the point of F10: the question *"what does this client see?"* cannot be
asked on either surface.

---

## 4. FINDINGS

### F1 — ⚠️ THE ONE THAT DECIDES THE TASK: the D19 read already exists, and Activity is a strictly worse version of it that B6 links to as "the full log"

**What.** `dash_activity_readback(p_limit)` is a production function that UNIONs **five** ledgers —
`status_events`, `notifications`, `document_deliveries`, `receipt_sends`, `audit_logs` — org-scoped,
`has_staff_access()`-gated, with a **fair-share-per-ledger** window so the noisiest ledger cannot
drown the others. Its own comment names the exact failure mode: *"straight 'most recent 40' looked
right and was useless: `audit_logs` writes ~3,200 rows a month where `receipt_sends` writes 2, so the
read-back rendered forty identical 'UPDATE documents' lines."*

It renders as dashboard zone **B6, "What the app has been doing"**, whose registry hint reads
*"D19: five ledgers the app writes and never read back. **This is the read.**"*
(`src/lib/dashboard/registry.ts:108-110`).

**And B6's last row is a link:** `src/components/app/dashboard/BusinessZones.tsx:265` —
*"Open the full activity log →"* → `/app/ops/activity`.

**The evidence.** As ADMIN, on production:

| | rows returned |
|---|---|
| `dash_activity_readback(40)` | **32**, spanning up to 5 ledgers |
| `status_feed(NULL,false,200)` — what `/app/ops/activity` calls | **200**, all from **one** ledger |

**Why it matters.** The dashboard tells the owner it has the D19 read, shows him a 12-row collapsed
sample of it, and then sends him to a "full log" that has **dropped four of the five ledgers**.
Notifications, deliveries, receipts and audit rows are all visible in the summary and all absent from
the destination. **This is not two unfinished halves — it is one finished surface and one obsolete
one that outranks it in the nav.**

**Conditions.** True for every ADMIN and every MANAGER/EMPLOYEE. Not true for SUPER_ADMIN, for whom
both return 0.

---

### F2 — Four surfaces read "activity", across two ledgers, in four different shapes

⚠️ Standard §3 checklist item 1 — duplicates and near-duplicates. **Name the incumbent.**

| Surface | Ledger | Scope | Shape | Verdict |
|---|---|---|---|---|
| **B6 zone** (`dash_activity_readback`) | **all five** | org, 14 days, fair share | labelled rows, collapsed by default | ✅ **INCUMBENT — this should survive** |
| `/app/ops/activity` (`status_feed`) | `status_events` only | org, 200 | badge + timestamp, **no links** | ❌ **retire the page; keep nothing** |
| `/app/ops/oversight` "Recent activity" (`admin_oversight`) | `audit_logs` only | ⚠️ **none** (U1) | `"UPDATE · documents"` × 50 | ❌ **replace with the B6 reader** |
| `Admin.tsx:830` client-record "Activity" | `audit_logs`, one user | that user | `"UPDATE"` + table + time | ⚠️ keep — **this is the per-person read**, and it is CR-30's foothold (F10) |
| `Admin.tsx:376` account `StatusLog` | `status_events`, one account | that account | timeline | ⚠️ keep, but see F7 — it is the **only** per-entity timeline that exists |

**Why it matters.** *"3 horse rosters, 3 lead lists, 2 staff landing pages"* is this project's named
failure mode. This is the same shape at a smaller scale, and it is currently **growing**: B6 shipped
2026-08-22 without retiring either of the two it supersedes.

---

### F3 — Oversight renders the raw DDL verb, so its activity list is unreadable by design

**What.** `audit_logs.action` is constrained to exactly three values:

```
audit_logs_action_check  CHECK (action = ANY (ARRAY['INSERT','UPDATE','DELETE']))
```

`OversightPage.tsx:66-70` renders `{a.action}` and `{a.table_name}` and nothing else. So the
"Recent activity" section on production reads, fifty times:

```
UPDATE · documents        8/30/2026, 5:42:26 PM
UPDATE · lesson_credits   8/30/2026, 5:42:26 PM
INSERT · bookings         8/30/2026, 5:42:26 PM
```

The top two `(action, table_name)` pairs alone account for **2,911 of 5,611 rows** (`UPDATE
documents` 2,530; `UPDATE contract_templates` 381).

**Why it matters.** ⚠️ **This is not an emptiness finding — it is the opposite.** The list is full and
conveys nothing: not who, not which document, not what changed. It is the exact output B6's author
described as *"useless"* and engineered around. The owner's watch page shows the failed version.

**Conditions.** True for ADMIN and SUPER_ADMIN in every state; never reached by MANAGER/EMPLOYEE (F4).

---

### F4 — Oversight's nav row is shown to instructor-class staff and the page then fails completely for them — taking a working panel down with it

**What, proven.** In a rolled-back transaction I set one existing profile to `EMPLOYEE` and ran the
three calls as that user:

```
app_role  | is_admin | has_staff_access | current_org
EMPLOYEE  | f        | t                | e656f20b-…

status_feed(NULL,false,200)   → 200 rows          ✅
dash_activity_readback(40)    → 32                ✅
admin_oversight()             → ERROR: admin access required   ❌
```
```
BEGIN … ROLLBACK;  -- verified after: role is back to USER
```

**Why it matters, in three steps.**
1. `COMMUNITY_GROUP` (`AppLayout.tsx:542-553`) sets **no `adminOnly` on any row**, including
   Oversight. `manageNavGroups`'s filter is `(!i.adminOnly || isAdmin || grantKeys.includes(i.to))`
   — with `adminOnly` unset the row is unconditionally visible. **Every manager and employee sees
   "Oversight" in the rail.**
2. The route is `requireStaff`, so they get in.
3. `adminOversight()` rejects, the `.catch` sets `error`, and `OversightPage.tsx:47` gates the entire
   body on `{data && (…)}`. `data` stays `null`. **They see a heading and one red line.**

⚠️ **And `<DocumentIntegrityPanel />` is inside that gate.** `document_integrity()` is gated on
`v_org IS NULL OR NOT has_staff_access()` — **it would have returned data for this user.** A working,
staff-authorised panel is dark because an unrelated sibling call failed.

**Conditions.** No MANAGER or EMPLOYEE profile exists in production today (`profiles` is 1
SUPER_ADMIN, 2 ADMIN, 10 USER). ⚠️ **This is not an emptiness finding:** the instructor lane is a
built, documented role tier with its own grant machinery (`grants.ts`, `instructor_surface_grants`),
and the defect is in the code, not in the data. It fires the moment the first instructor is created.

---

### F5 — The "Oversight" instructor grant is a **double** no-op

`GRANTABLE_SURFACES` (`src/lib/grants.ts:23`) offers an admin the ability to grant
`/app/ops/oversight` to instructors. It cannot work, for two independent reasons:

1. **Visibility:** grants are consumed only by `manageNavGroups`'s `grantKeys.includes(i.to)` branch,
   which is reached only when `i.adminOnly` is true. Oversight has no `adminOnly`. **The row was
   already visible; the grant changes nothing.**
2. **Data:** `ProtectedRoute` accepts a `grantKey` prop — and **`grantKey` is passed on zero routes
   in `App.tsx`.** Even if it were, `admin_oversight()` rejects non-admins server-side (F4). **The
   grant cannot open the data.**

⚠️ Standard §3.2: *"a function with zero call sites is a finding."* This is the UI equivalent — an
admin control that reports success and does nothing, which is `ORCHESTRATOR.md` §3's exact class.
**Activity is not in `GRANTABLE_SURFACES` at all**, though it is the one of the two that actually
works for instructors — the list is backwards.

---

### F6 — Activity renders a blank entity label for a whole entity type, and the newest row on production is one of them

**What.** `status_events.entity_type` holds **six** values in production. `ActivityPage`'s
`ENTITY_LABEL` (line 26) is typed `Record<StatusEntity, string>` and `StatusEntity` is
`'account' | 'document' | 'order' | 'offering'` — **four**. Line 95 renders
`{ENTITY_LABEL[r.entity_type]}` → `undefined` → **empty cell**.

**Evidence — the live `status_feed(NULL,false,200)` as ADMIN:**

```
 entity_type | count        first row returned:
 offering    |   138        fulfillment | Scheduled | Booking c9b8b182-… | 2026-08-30 17:42
 document    |    27
 account     |    17
 fulfillment |    10   ← no label, no tab
 order       |     8
```

`fulfillment` is 10 of 200 in the default "Everything" view **and is the most recent row on the
page**. TypeScript does not catch it because `statusFeed` casts the RPC result
(`api-status.ts:56`) rather than validating it.

**Three consequences, all present:**
- 10 rows render with an empty entity column.
- No tab can isolate them — `ENTITY_TABS` has the same four.
- `lesson_plan` has 4 vocab codes and **`bool_or(is_true_status) = false`**, so with "True status
  only" ticked it can never appear at all; `payment` has 6 vocab codes and zero events.

**Conditions.** Every ADMIN/MANAGER/EMPLOYEE page load, today, unconditionally.

---

### F7 — Nothing on Activity is clickable, which puts it directly against D27

**What.** `ActivityPage.tsx:90` renders each row as a bare `<li>`. `r.entity_id` is fetched, used
**only as part of the React key**, and discarded. `r.actor_user_id` is fetched and **never rendered
at all** — on either page (`OversightPage` puts `actor_user_id` in its TypeScript interface,
`support.ts:59`, and renders only `action`/`table_name`/`occurred_at`).

**Against the ruling.** D27 / TASK-LESSONPLAN: *"An activity log is the minimum; **clicking an entry
opens the content**."* Activity is a log where clicking an entry does nothing.

⚠️ **And the destinations mostly do not exist.** `entityStatusLog()` has exactly **one** call site in
the whole app — `Admin.tsx:376`, for `entity_type = 'account'`. **Of the four entity types Activity
offers, three have no per-entity timeline anywhere.** So "make the rows clickable" is not a
one-line fix; it needs a target per type. That is scoped in §5.

**Why it matters.** ⚠️ Standard §3.4: *"a field that writes somewhere nothing reads is the single
most common defect class."* Here it is the read-side twin — two ledger columns (`entity_id`,
`actor_user_id`) are selected by the RPCs, typed in the client, and shown to nobody. **"Who did
this?" is unanswerable on both pages** despite both fetching the answer.

---

### F8 — Oversight's four tiles are dead ends, a fifth number is computed and thrown away, and the grid is sized for five

Three separate defects in one 12-line block.

1. **`open_engagements` is computed by `admin_oversight()`, typed in `OversightUsage`
   (`support.ts:50`), and absent from `CARDS` (`OversightPage.tsx:18-23`).** It returned **1** on
   production. A number the DB computes and the page discards.
2. **`className="grid grid-cols-2 sm:grid-cols-5"` with four cards** (line 45) — the grid is still
   sized for the five that the type says exist. On any `sm`+ viewport the row renders four tiles and
   an empty fifth column.
3. **None of the four tiles is a link.** They are plain `<div>`s — and **every one of the four
   numbers is owned by a sibling page**: Members → Records/Team; Open support → SupportPage;
   Live posts → Home's `CommunityFeed`; Flagged → **ModerationPage, whose own tab is literally
   labelled "All flagged — oversight"** (`ModerationPage.tsx:81`). Four counts, four owners, zero
   ways to get from the count to the owner.

**Conditions.** Every ADMIN load. **Not an emptiness finding** — the numbers are non-zero (12 / 0 /
32 / 0 / 1); the defect is in what happens when you click them, which is nothing.

---

### F9 — The two pages have different page chrome, and Oversight double-pads on mobile

`<main>` already supplies `px-4 sm:px-8 xl:px-12 pt-10 sm:py-9` (`AppLayout.tsx:2044`).

- `ActivityPage.tsx:55` — `<div className="max-w-4xl">` — flush left, inherits the layout's padding.
- `OversightPage.tsx:36` — `<div className="max-w-4xl mx-auto py-8 px-4">` — **centred, plus its own
  padding on top of the layout's.**

**On the owner's phone that is 32px of side inset on Oversight against 16px on Activity, and one
page centred against one left-aligned, for two rows adjacent in the same nav section.** Neither uses
`PageHeader`; both hand-roll the `h1`. Small, but it is exactly the *"better ui design for a more
functional layout"* the question asks about, and merging them forces the choice anyway.

---

### F10 — Which of D19's ledgers is read by nothing at all? **None of them.** D19's corollary is stale.

⚠️ **Brief §3 Q4, answered directly and against expectation.** Every one of the four (five, with
`receipt_sends`) is read back to a human somewhere:

| Ledger | rows (prod) | org-wide read | per-entity / per-person read |
|---|---|---|---|
| `status_events` | 1,319 | ✅ `/app/ops/activity`, ✅ B6 | ⚠️ `StatusLog` — **accounts only** (F7) |
| `audit_logs` | 5,611 | ⚠️ Oversight, **unscoped** (U1), ✅ B6 | ✅ `Admin.tsx:830` per client · `contact_dossier.activity` |
| `notifications` | 170 | ✅ B6 | ✅ `NotificationsZone` (recipient's own) · `contact_dossier.notifications` |
| `document_deliveries` | 79 | ✅ B6 | ✅ `DeliveryPanel` per document |
| `receipt_sends` | **0** | ✅ B6, `dash_money_health` | — |

**`receipt_sends` at 0 rows is EMPTY, NOT UNWRITTEN** — `log_receipt_send` / `claim_receipt_send`
exist in the DB and `api/_lib/receipt.ts` calls them on every attempt, success or failure. ⚠️ **This
is the distinction the brief demands and it lands on the side of "not a finding."**

**But one real gap survives, and it is in B6, not in the two pages:** the audit branch requires
`EXISTS (SELECT 1 FROM profiles pr WHERE pr.user_id = al.actor_user_id AND pr.org_id = v_org)`, and
**951 of the 2,537 audit rows in the last 14 days (37%) have `actor_user_id IS NULL`** — trigger and
system writes. NULL fails the EXISTS. **The D19 read-back silently omits every change the app made
to itself.** That is a real finding about the surface I am recommending you adopt, so it must be
fixed as part of adopting it.

**The consequence for the brief's framing:** *"no staff member can answer 'what does this client
see?'"* is **no longer true** — `contact_dossier` returns that person's notifications and their audit
trail, and `ContactDossierModal` renders both. The unanswerable question today is the narrower one:
**"what does this client see, on their own record, with the delivery and signature history beside
it?"** That is CR-30's Account History, and it is unbuilt.

---

### F11 — The dashboard's **Notifications** zone links to a page that never reads notifications

`src/lib/dashboard/registry.ts:66-69` registers N1 twice (trainer + business) with
`to: '/app/ops/activity'`. `DashboardChrome.tsx:154-160` renders every zone title as a
`<Link to={def.to}>`. So the **"NOTIFICATIONS ›"** heading on both dashboards — the zone the owner
asked for by name on 2026-08-26 — navigates to `/app/ops/activity`, which reads `status_events` and
**has never read `notifications`**. Small, one-line, and a live lie on the surface the owner uses
most.

---

### F12 — Presence · redundancy · needs · omissions · misconfigurations · outdated

⚠️ The owner's list, each answered explicitly (§3.6).

- **Presence.** Both pages exist, are routed, have registry rows (`pageRegistry.ts:155,160`), have
  nav rows, and **neither is hidden** — `org_page_visibility` has **0 rows** for `community.*`.
  Both are genuinely present for ADMIN.
- **Redundancy.** F1, F2, F8 — one obsolete page, one obsolete panel, four duplicated counts.
- **Needs.** The unmet need is not a page: it is (a) **links out of the log** (F7) and (b) **who did
  it** (F7). Both are already in the data.
- **Unnecessary inclusions.** Oversight's four count tiles (F8) and its "Recent activity" list (F3).
- **Accidental omissions.** `open_engagements` (F8.1); two entity types with no label and no tab
  (F6); `adminOnly` on Oversight's nav row (F4); `grantKey` on the route (F5); NULL-actor audit rows
  in B6 (F10).
- **Misconfigurations.** `sm:grid-cols-5` for four cards (F8.2); double padding (F9); N1's `to`
  (F11); `admin_oversight`'s missing tenant filter (U1).
- **Outdated items.** `/app/ops/activity` in full — superseded by B6 on 2026-08-22 and never
  retired. `ActivityPage`'s own docblock still says *"Phase 3."*
- **Visible / accessible / functional / usable**, separately, per §2:

  | | Activity | Oversight |
  |---|---|---|
  | **Visible** | ✅ nav + registry, all staff | ✅ nav + registry, all staff |
  | **Accessible** | ✅ route + RPC both accept all staff | ⚠️ **route yes, data no** for MANAGER/EMPLOYEE (F4) |
  | **Functional** | ✅ it loads and renders what it queries | ⚠️ partially — integrity panel works, tiles are inert, activity list is unscoped |
  | **Usable** | ❌ **69% offering rows with no name, no actor, no link** | ❌ **50 lines of `UPDATE · documents`** |

  ⚠️ **Both pass Visible and fail Usable. They are not the same question and this is the pair that
  proves it.**

### F13 — CRUD, per entity (§3.5)

| Entity | C | R | U | D |
|---|---|---|---|---|
| `status_events` | ✗ (written by engine triggers elsewhere) | ✅ Activity | ✗ append-only | ✗ correct — a ledger |
| `audit_logs` | ✗ | ✅ Oversight | ✗ blocked by `audit_logs_no_mutate` trigger | ✗ correct |
| `documents` (via integrity panel) | ✗ | ✅ | ✗ | ✅ **`cleanup_document`, reason required, one at a time, signed docs refused server-side** |

**The only write either page performs is `cleanup_document`** — and under **D32** it is the correct
shape: an archive with a reason, not a hard delete, individually confirmed, with the guard duplicated
in `can_cleanup_document` so the UI cannot be the only thing holding it. ✅ **No CRUD defect. This
panel is the best thing on either page and it should survive the merge untouched.**

---

## 5. THE PLAN

⚠️ **Ordered. Dependencies stated. ORCH6 schedules from this.**

### The shape being recommended — ONE page, `/app/ops/oversight`, label **Oversight**, in AR4's **Admin** section

Under **CR-74**: *an expanding full-width card in place beats a deeper page; a modal is for quick
view and quick action; a page is for a record with more than its own fields.* This is not a record —
it is a watch surface — so it stays a page, and the depth goes into **expand-in-place bands**, which
is the shape CR-74 says the owner rates highest.

```
Oversight                                          [ ⟳ refreshed 2 min ago ]

┌─ NEEDS A DECISION ──────────────────────────────────────────────────────┐
│  Document integrity — 4 checks, 2 findings              [expand ▾]       │  ← unchanged; today's
│    every check renders, including at zero (unchanged rule)              │     DocumentIntegrityPanel
└──────────────────────────────────────────────────────────────────────────┘

┌─ THE NUMBERS ───────────────────────────────────────────────────────────┐
│  12 Members   0 Open support   32 Live posts   0 Flagged   1 Open deals  │  ← 5 tiles, grid-cols-5
│  each tile is a LINK to the page that owns it                            │     honest at last
└──────────────────────────────────────────────────────────────────────────┘

┌─ WHAT THE APP HAS BEEN DOING ───────────────────────────────────────────┐
│  [ All ] [ Status ] [ Notified ] [ Delivered ] [ Receipts ] [ Changed ]  │  ← ledger filters,
│                                                                          │     replacing the four
│  DELIVERED   Lease agreement → pamela@…            copy to the barn      │     entity tabs
│              LSE-0041 · Pamela Godde · by Claire        Aug 30, 5:42pm   │  ← subject, actor, TIME
│  ────────────────────────────────────────────────────────────────────── │
│  STATUS      Signed                                                      │
│              HORSE_SALE_V2 · Sundance · by Pamela        Aug 30, 5:41pm  │
│                                                                          │
│  every row is a link to its record (F7)      [ show 40 more ]            │
└──────────────────────────────────────────────────────────────────────────┘
```

**Why this layout and not tabs.** Brief §3 Q2: *"overlapping data with different audiences argues for
two views over one read; overlapping audience with different data argues for tabs."* ⚠️ **Neither
applies.** The audience is identical (staff, and per F4 it *should* be identical) and the data is
identical too — both pages read ledgers written by the same events. **Same audience, same data, two
pages is simple duplication**, and duplication merges into one scroll, not into tabs. Tabs would
hide the integrity findings behind a click, which is the one thing on these pages the owner asked
for by name (*"provide ui elements for me to be able to see this"*, 2026-08-10).

---

**P1 · Fix the tenant leak.** New migration: `CREATE OR REPLACE FUNCTION admin_oversight()` —
either add `org_id uuid REFERENCES organizations(id)` to `audit_logs` and filter on it, or (cheaper,
and matching what B6 already does) filter through `profiles`. ⚠️ **If the `profiles` route is taken,
it must handle `actor_user_id IS NULL` explicitly or it inherits F10's 37% blind spot.**
**Independent of everything else. Ship it first and alone.** *(Fixes U1.)*

**P2 · Point Oversight's activity band at `dash_activity_readback`.** Replace the `admin_oversight()`
activity block's consumer with the five-ledger reader; delete the activity half of
`admin_oversight()`, leaving it a pure usage-count function. **Depends on P1** (same function, same
migration file — do not race them). *(Fixes F1, F2, F3.)*

**P3 · Fix `dash_activity_readback`'s audit branch to include NULL actors.** `… WHERE al.actor_user_id
IS NULL OR EXISTS (…)`. ⚠️ **Must land WITH P2** — adopting the reader without this ships a known
37% blind spot onto the owner's watch page. *(Fixes F10.)*

**P4 · Retire `/app/ops/activity`.** Delete `ActivityPage.tsx`; make the route a `<Navigate replace>`
to `/app/ops/oversight`; drop `community.activity` from `pageRegistry.ts` and the `Activity` row from
`COMMUNITY_GROUP`. Repoint `BusinessZones.tsx:265` and **both N1 registry rows** to
`/app/ops/oversight`. ⚠️ **MUST land with P2** — retiring the page before Oversight can show five
ledgers loses ground. ⚠️ **`AppLayout.tsx` and `pageRegistry.ts` are TASK-AR4's primary files —
this is a one-row deletion inside AR4's rename; the two must not run in parallel.**
*(Fixes F1, F2, F11; delivers the merge.)*

**P5 · `adminOnly: true` on the Oversight nav row, and remove Oversight from `GRANTABLE_SURFACES`** —
**or** widen `admin_oversight()`'s usage counts to `has_staff_access()` and keep the grant. ⚠️
**This is an owner question, not a code question** (§8, Q-B). Whichever way it goes, the nav row and
the server gate must agree. **Independent of P1-P4 except for touching `AppLayout.tsx`** — sequence
after P4 to avoid a second edit to AR4's file. *(Fixes F4, F5.)*

**P6 · Make the tiles honest.** Add the `open_engagements` tile, `grid-cols-5` becomes correct, wrap
each in a `<Link>` to its owning page. **Independent.** *(Fixes F8.)*

**P7 · Make rows clickable, and show the actor.** Render `subject` and resolve `actor_user_id` to a
display name (B6's audit branch already does this join — extend it to the other four branches). Link
target per ledger: `document`/`delivery` → `/app/ops/documents/:id`; `order`/`receipt` → the purchase
detail; `account` → the client record; `status`/`offering` → ⚠️ **needs a ruling — see §8, Q-A.**
**Depends on P2.** *(Fixes F7, closes D27's *"clicking an entry opens the content"* for four of six
types.)*

**P8 · One page chrome.** Drop Oversight's `mx-auto py-8 px-4`; adopt `PageHeader`. **Independent,
cosmetic, safe to bundle with anything.** *(Fixes F9.)*

**Independent, may run in any order or in parallel:** P1 · P6 · P8
**Must land together as one change:** **P2 + P3 + P4**
**Must follow that bundle:** P7
**Must follow P4 and needs an owner answer first:** P5
**Must NOT run in parallel with TASK-AR4:** P4, P5 *(shared `AppLayout.tsx`, `pageRegistry.ts`)*

---

## 6. TEST CRITERIA

⚠️ Provable. Each is a query or an emitted-DOM assertion, never "no error was thrown."

1. **P1** — as ADMIN of a second organization seeded in a `BEGIN…ROLLBACK` transaction, with rows in
   `audit_logs` attributable to org A only: `SELECT jsonb_array_length(admin_oversight()->'activity')`
   returns **0**, not 50. ⚠️ Today it returns 50. *(This is the only test that requires a second org;
   it can be created and rolled back.)*
2. **P1** — `pg_get_functiondef` for `admin_oversight` contains no `FROM audit_logs` with an
   unqualified `ORDER BY … LIMIT`; grep the definition for `org`.
3. **P2** — as ADMIN, the Oversight page's activity band renders **at least 3 distinct `ledger`
   values** in one load. Assert on the emitted DOM: ≥3 distinct `.ledger-label` text values.
   ⚠️ Today the count is 1.
4. **P3** — `SELECT jsonb_array_length(dash_activity_readback(200)->'items')` **increases** after the
   change, and at least one returned row has a NULL actor. Baseline before/after in the same session.
5. **P4** — `GET /app/ops/activity` emits a redirect to `/app/ops/oversight`; `grep -rn
   "ops/activity" src/` returns **only** the redirect route. ⚠️ Today it returns **7** hits across 5
   files.
6. **P5** — the EMPLOYEE probe (§4 F4's exact transaction) either (a) does not render an Oversight
   nav row at all, or (b) renders the page with data — **never the current third outcome**, a
   visible row leading to a red line. Assert on `manageNavGroups(() => true, false, false, [])` —
   `groups.find(g => g.key === 'community').items` must not contain `/app/ops/oversight`.
7. **P5** — `document_integrity()` renders for an EMPLOYEE regardless of whether the usage tiles
   loaded. Assert the panel's DOM node exists when `admin_oversight` rejects.
8. **P6** — five `<a>` elements in the tile grid; `document.querySelectorAll('[data-tile] a').length
   === 5`; the fifth reads the value `admin_oversight()->'usage'->>'open_engagements'` returns.
9. **P7** — every rendered activity row is an `<a>` with a non-empty `href`; **zero** rows render an
   empty entity/ledger label. ⚠️ Today 10 of 200 render empty (F6) and 0 of 200 are links.
10. **P8** — the two pages' root elements emit **identical** layout classes; assert string equality
    on `className` after the change.
11. **Regression, all P** — `cleanup_document` still refuses a signed document. Run it against one of
    the 5 EXECUTED contact-orphan documents inside `BEGIN…ROLLBACK` and assert it raises.
    ⚠️ **Never against `7adcd08f-fd5d-40f9-b726-634074266d7c`** — Pamela Godde's live lease.

---

## 7. SUCCESS, AT TWO LEVELS

**Per fix** — each numbered test in §6 passes, and its "today" baseline is recorded in the build
thread's report so the change is provable rather than asserted.

**For the area as a whole** — ⚠️ **one question, answerable in one place:** an admin or an instructor
opens **one** page in the Admin section and can see, in one scroll, *what is broken in the paperwork*
· *how big the business currently is, with a way into each number* · *what the app has actually been
doing across all five ledgers, who did it, and a link to the thing it happened to.* The nav carries
**one row where it carried two**, which is also what AR4 wants. Nothing that works today is lost:
the document integrity panel is untouched, and the five-ledger reader that already exists finally
has a full-size home instead of a 12-row collapsed sample.

---

## 8. FLAGGED, NOT FIXED

**Q-A · ⚠️ OWNER RULING NEEDED — where does an `offering` status row link to?**
138 of 200 rows in the current feed are `offering`. `status_events.entity_id` for those points at an
`offerings` row, and **there is no offering detail page for staff.** Without a target, P7 leaves the
single largest row class unlinked and the merge only half-answers D27. **Options:** link to the
purchase that contains it · link to `/app/ops/admin/products` · **suppress offering rows from the
feed entirely** (they are engine bookkeeping, not human events — my recommendation). ⚠️ **This one
choice decides whether the feed is 62 useful rows or 200 mostly-noise ones, so it should be asked
before P2 is built, not after.**

**Q-B · ⚠️ OWNER RULING NEEDED — is Oversight admin-only or all-staff?** P5 cannot be built without
this. `GRANTABLE_SURFACES` says the owner once wanted to grant it to instructors; the server gate
says admin. **The document integrity panel is already staff-safe**, so "all staff" is buildable.

**→ TASK-AR4** — P4 and P5 both edit `AppLayout.tsx`'s `COMMUNITY_GROUP` and `pageRegistry.ts`, which
are AR4's primary files. **AR4 renames `community` → `Admin`; AR6 removes one row from it.** Route
them as one build, AR4 first. ⚠️ Also for AR4: **`ADMIN-IA.md` §1 already lists the Admin section's
entry as a single item, *"Oversight/activity log"* — the target IA had already merged these two and
neither page was updated.** And note the **name collision**: ADMIN-IA's zone 3 uses "Activity" for
the *member feed*; retiring this page frees that word.

**→ CR-30 / whichever thread builds Account History** — F10's surviving gap is CR-30's, not AR6's.
⚠️ **`AccountHistory` / "account history" returns ZERO hits in `src/`** — the surface CR-30 named as
Activity's replacement is unbuilt, which is precisely why AR6 recommends folding Activity into
Oversight rather than deleting it outright. **When Account History ships, the per-person slice comes
from `contact_dossier` (which already returns `notifications` + `activity`) and the "activity log,
top right" link should point at `/app/ops/oversight`.**

**→ TASK-AR5 (modules onto the account page)** — Oversight's four count tiles overlap whatever
account-page summary AR5 proposes. **If AR5 recommends a tenant-health block on the account page,
F8's tiles may belong there instead and Oversight keeps only the integrity panel and the feed.**
Worth a five-minute cross-read before either is scheduled.

**→ dashboards / whoever owns `registry.ts`** — F11's N1 mis-link is a one-line fix in a file AR6
does not otherwise need. Cheap to fold into P4; flagging in case dashboards is mid-flight.

**Out of scope, noted:** `feed_posts` has 32 live rows and the member feed renders on `/app` (Home),
not on a `community` route — Oversight's "Live posts" tile counts something with no nav row of its
own. Not AR6's to resolve.

---

## 9. CONTENDED FILES

⚠️ **Required. This is how ORCH6 computes the build order.**

| File | Which fix | ⚠️ Contention |
|---|---|---|
| `supabase/migrations/<new>.sql` (`admin_oversight`, `dash_activity_readback`) | P1, P2, P3 | New file — **but two threads writing `admin_oversight` collide.** AR6 only. |
| `src/pages/app/ops/OversightPage.tsx` | P2, P6, P8 | AR6 only |
| `src/pages/app/ops/ActivityPage.tsx` | P4 — **deleted** | AR6 only |
| `src/lib/support.ts` | P2, P6 | AR6 only |
| `src/lib/ops/api-status.ts` | P4 (`statusFeed` loses its last caller) | ⚠️ `entityStatusLog` in the same file is used by `Admin.tsx` — **TASK-AR2's territory.** Do not delete the module. |
| **`src/components/app/AppLayout.tsx`** | P4, P5 | 🔴 **TASK-AR4 PRIMARY.** Serialize. |
| **`src/lib/pageRegistry.ts`** | P4 | 🔴 **TASK-AR4 PRIMARY.** Serialize. |
| `src/App.tsx` | P4 (route → redirect) | ⚠️ AR1–AR5 all likely touch routes. Low collision risk (one line) but flag it. |
| `src/lib/grants.ts` | P5 | AR6 only |
| `src/lib/dashboard/registry.ts` | P4 (N1 ×2, B6 `to`) | ⚠️ dashboards |
| `src/components/app/dashboard/BusinessZones.tsx` | P4 (B6 footer link) | ⚠️ dashboards |
| `src/components/ops/DocumentIntegrityPanel.tsx` | — **NOT EDITED** | Listed so ORCH6 knows AR6 does **not** claim it |

---

## 10. TEARDOWN

**Worktree:** `/Users/cactai/Downloads/claude-code-repo/wt-ar6` · **Branch:** `task/ar6`
**Committed:** `docs/reports/TASK-AR6-REPORT.md` only. **Not pushed.**
**Started and stopped:** `psql` (six invocations, each exited on completion). No dev server, no
watcher, no browser harness.
**Mutations:** two, both inside `BEGIN … ROLLBACK`, both declared in §4 (F4 — one `profiles.role`
set to `EMPLOYEE` and reverted; the revert was verified by re-reading the row afterwards, which
returned `USER`). **Nothing was written to production.** Pamela Godde's lease
(`7adcd08f-fd5d-40f9-b726-634074266d7c`) was not read, referenced or touched by any statement.
Process census pasted at the end of the thread.
