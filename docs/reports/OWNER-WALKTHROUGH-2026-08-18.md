# OWNER WALKTHROUGH — 2026-08-18

**The owner used the app in a browser and reported what happened. Every claim below was then
verified against the source and against production SQL by the orchestrator.** Nothing here is
inferred, and nothing here is the owner's word taken on trust — each item carries the file, the
line, or the query that proves it.

**Why this document exists:** it is the first time anyone has walked the *product* rather than a
feature. Every finding is a surface defect on top of a database layer that turned out, in each
case, to be correct. **That asymmetry is the single most important fact in this file.**

> **Owner, 2026-08-18:** *"This app is riddled with problems but i dont know which are real and
> which are because there is so much work that hasnt run yet."*
>
> **The answer, established here: almost none of it is unbuilt. It is built and unreachable.**

---

# 0. THE HEADLINE — the pattern, now with eight instances

**Code that exists, is correct, and that nothing routes to, links to, or calls.**

| # | what was built | why nobody could use it | found by |
|---|---|---|---|
| 1 | the inbound lead notifier | **zero call sites** | `INBOUNDALERT` |
| 2 | the gift request path | never routed through `submit_public_request`, so it alerted nobody | `GIFTPATH` |
| 3 | `schedule_lesson_session`'s credit debit | the booking path never called it | `BOOKLINK` |
| 4 | `deal_autocomplete_on_execution` | trapped in a branch that never runs | `CONTRACTWALK` |
| 5 | `/book/rider`'s qualification questions | orphaned page, no link in | `SESSIONBOOK` |
| 6 | **the ops dashboard + instructor home** (`OpsHome`, 275 + 187 lines) | **no nav row exists for `/app/ops`** | this walkthrough |
| 7 | **the Review section itself** (`reviewSection.ts`, 20KB, 9 groups, 27 slots, 5 routes) | nav group deleted `ab45b18`; pages still live, URL-only | this walkthrough |
| 8 | **the entire credit engine** (`_mint_credits_for_purchase_item`, `_refund_booking_credit`, `complete_lesson_session`) | **the credits page reaches around it** and writes the table directly | this walkthrough |

⚠️ **#8 is the worst of the eight, because it is not merely unreachable — a second, wrong path was
built next to the correct one and it is the one the owner found first.**

---

# 1. THE CALENDAR

## 1.1 A booking exists at midnight and cannot be reached — CONFIRMED

**Production:**
```sql
SELECT to_char(starts_at AT TIME ZONE 'America/Los_Angeles','HH24:MI') hhmm, count(*)
FROM bookings WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1;
--  00:00 | 1     ← Madeline Do, 2026-08-28, status 'scheduled'
--  08:00 | 31 … 18:00 | 25
```
```sql
SELECT * FROM business_hours;   -- every weekday: 08:00 → 19:00, closed = false
```

**The week grid renders only the configured open hours** — `src/pages/app/CalendarPage.tsx:404`:
```ts
const hours = Array.from({ length: Math.max(1, closeHour - openHour) }, (_, i) => openHour + i);
```
`openHour = 8`, `closeHour = 19` ⇒ rows `8…18`. **Hour 0 is never rendered, so the item is never
drawn and never clickable.** `itemsFor(day, hour)` filters on `s.getHours() === hour`, so the
booking is not merely off-screen — it is not in the DOM.

⚠️ **This is not "one bad row." It is a class:** any booking outside business hours is invisible
and therefore unmanageable, and nothing prevents one from being created.

## 1.2 Clicking the booking in month view opens the week view instead — CONFIRMED

**`CalendarPage.tsx:355`** — the whole month grid has exactly one click behaviour:
```tsx
<MonthGrid … onPickDay={(d) => { setView('week'); setAnchor(d); }} />
```
**`CalendarPage.tsx:494`** — the day cell is a single `<button onClick={() => onPickDay(d)}>`, and
**`CalendarPage.tsx:501`** — the items inside it are plain `<div>`s with **no click handler at
all**. So a click on the booking bubbles to the day button, switches to week view, and lands the
owner on the one view that cannot draw a midnight booking.

**Contrast with week view (`CalendarPage.tsx` WeekGrid):** items there are `<button>` with
`onSelect(it)`. **Month view is read-only by construction, and nothing says so.**

## 1.3 The booking editor has exactly one entry point — CONFIRMED

**`CalendarPage.tsx:202`:**
```ts
if (isStaff) setEditing({ item: it });   // reached ONLY from WeekGrid's onSelect
else setSelected(it);
```
**The only way to edit any booking is to click it in week view.** Combined with 1.1 and 1.2, the
owner's account is exactly right: **there is no path to that booking anywhere in the product.**

## 1.4 "A sea of baby shit green" — CONFIRMED, and it is a data-model choice

**Production:**
```sql
SELECT status, count(*) FROM bookings WHERE deleted_at IS NULL GROUP BY 1;
--  available | 275      ← availability is stored AS booking rows
--  scheduled |  43
```
**`CalendarPage.tsx:84` `itemClass()`:**
- `available` → `bg-green-50 border border-green-600/40`
- default (confirmed / scheduled / completed) → `bg-green-700 border border-green-800`

**275 open slots and 43 real bookings are both rendered green**, differing only in shade. The
owner is looking at 275 pieces of *nothing* drawn as content, with the 43 things that matter
camouflaged among them.

⚠️ **The fix is not a colour.** Absence of a booking should be absence of an element. Availability
is a background property of a cell, not an item to draw.

## 1.5 Every lesson says "Booking" — CONFIRMED

**`CalendarPage.tsx:115–123` `itemLabel()`:**
```ts
if (item.is_mine) return item.kind === 'lesson' ? 'Your lesson' : 'Your booking';
return 'Booking';                       // ← what staff see for EVERY client lesson
```
**Staff — the people who run the barn — see the literal string `Booking` on every client lesson.**
No name, no service, no horse, no instructor. The data to label it is on the row (`account_contact_id`,
`client_id`, `offering_id`, `horse_id`, `instructor_user_id`); nothing reads it.

---

# 2. BOOKINGS — the records exist, split across two keys, and nothing completes

## 2.1 The same person's bookings are split across two foreign keys — CONFIRMED, root cause

```sql
-- by account_contact_id:            Madeline Do →  3
-- by client_id → clients → contacts: Madeline Do → 11
SELECT b.account_contact_id IS NOT NULL AS acct, b.client_id IS NOT NULL AS cl, count(*)
FROM bookings b WHERE deleted_at IS NULL AND status='scheduled' GROUP BY 1,2;
--  f | t | 32        ← 32 of 43 scheduled bookings have NO account_contact_id
--  t | t |  8
--  t | t |  3  (+ account_user_id)
```
**`bookings` carries three different owner columns — `account_contact_id`, `client_id`,
`account_user_id` — and no surface agrees on which one is authoritative.** `account_contact_id` was
added later and **never backfilled**, so any page that filters on it under-reports by ~74%.

⚠️ **This is the mechanism behind "Madeline Do appears twice" and behind "I couldn't get to the
booking from her account."** Her account page and the calendar are not looking at the same set.

## 2.2 Nothing has ever been marked completed — CONFIRMED

```sql
SELECT status, current_status, count(*), min(starts_at)::date FROM bookings
WHERE deleted_at IS NULL GROUP BY 1,2;
--  scheduled | scheduled | 43 | 2026-07-20        ← a month old, still 'scheduled'
```
**Zero bookings in any completed state, ever.** The owner's *"almost 20 bookings completed"* is
true in the real world and **has no representation in the system at all**.

**The completion path exists and is correct:** `SessionsPage.tsx:148` → `completeLessonSession()`
→ `complete_lesson_session(p_session_id, p_debit_credit)`, which debits the oldest credit row.
**It has simply never been used**, because (2.3) it is two levels down behind a hub page and is
called *Sessions*, not *Bookings*.

## 2.3 A central bookings list DOES exist — CORRECTION to the owner's report

> *"no way to centrally manage bookings outside of opening them from the calendar"*

**`/app/ops/lessons/sessions` lists every non-available lesson booking, ordered by time**
(`api-lessons.ts:317`), with complete / cancel / reschedule actions. It is reachable **only** from
`LessonsHubPage.tsx:63`, as a small `link-underline` text link on a KPI card, inside
Records › Lessons.

**So the surface is not missing — it is buried, and its name does not contain the word "booking."**
That distinction matters: the fix is navigation and naming, not construction.

---

# 3. LESSON CREDITS — a second, wrong write path built beside a correct engine

## 3.1 "Grant credits" creates an orphan entitlement — CONFIRMED, worse than reported

**Production, every live credit row:**
```
who              | offer | purch | item | package_key       | tot | rem | period_start | expires_at
Kit Garcin       |   t   |   t   |  t   | Single Lesson     |  1  |  0  |              |
Madeline Do      |   t   |   t   |  t   | 2x Weekly Lessons |  4  |  0  | 2026-08-01   | 2026-09-01
Madeline Do      |   f   |   f   |  f   |                   |  1  |  1  |              |          ← the grant
Rachel Engelhorn |   t   |   t   |  t   | Single Lesson     |  1  |  0  |              |
```
**`api-lessons.ts:251` `createLessonCredit()` inserts `{ client_id, package_key, credits_total }`
and nothing else.** No `offering_id`, no `purchase_id`, no `purchase_item_id`, no `period_start`,
**and no `expires_at`.**

⚠️ **The granted credit never expires.** Every other credit in the system is bounded by a purchase
and a period. This one is immortal, unattributable, and reconciles to nothing.

## 3.2 "Use 1 credit" fires instantly with no confirmation, reason, reference or undo — CONFIRMED

**`LessonCreditsPage.tsx:283`:**
```tsx
{ label: 'Use 1 credit', onClick: (row) => void handleConsume(row) }
```
**`api-lessons.ts:275` `consumeLessonCredit()`** does a read-modify-write of `credits_remaining`
straight onto the table via PostgREST. There is **no `use_credit` or `grant_credit` RPC in the
database at all** — confirmed:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema='public' AND routine_name ILIKE '%credit%';
--  _mint_credits_for_purchase_item · _refund_booking_credit · credits_roster
--  trg_mint_credits_when_order_opens · trg_mint_purchase_credits
```
**Every one of those is part of the correct engine. None of them is what the button calls.**

**The file admits it in its own header** (`api-lessons.ts:13`):
> *"has NO bookings⇄credits linkage and no consume RPC — consumption is a staff decrement of
> `credits_remaining`"*

⚠️ **So the credits page offers staff a raw ledger decrement, unlinked to any lesson, un-auditable,
and irreversible — sitting one nav level from `SessionsPage`, which does the same thing correctly
and records what it was for.**

## 3.3 None of it is audited — CONFIRMED

`audit_logs` holds 3,252 rows and covers `documents`, `contacts`, `signatures`, `clients`,
`horses`, `groups`, `notifications`, `document_deliveries`. **`lesson_credits` and `bookings` are
not among them.** The owner's clicks left no trace anywhere.

---

# 4. TRANSPARENCY — there is no surface that answers "what does the client see?"

> *"i dont know what she is seeing, what emails shes getting, what notifications she has on her
> dashboard from my clicking of the use 1 credit, grant 1 credit fiasco."*

**CONFIRMED, and it is a total absence, not a gap.**

| the question | what exists | what surfaces it |
|---|---|---|
| what notifications does this person have? | `notifications` (48 rows) | **nothing** — no ops page reads another person's notifications |
| what emails were sent to them? | `document_deliveries`, `receipt_sends`, `request_alert_sends`, `signup_alert_sends` | **nothing** — no per-contact view |
| what changed on their record, and who did it? | `audit_logs` (3,252 rows), `status_events` | **nothing** — no per-contact timeline |
| what will they see if I do this? | — | **nothing** — no action in the app previews its own effect |

**Four separate ledgers are being written and none of them is ever read back to a human.**

---

# 5. THE DASHBOARDS — routed, role-adaptive, and absent from the navigation

> *"there is only a plain dashboard, no ops dashboard or instructor dashboard."*

**CONFIRMED as an outcome; the cause is not what it looks like.** An earlier orchestrator claim
that `OpsDashboard` was unrouted was **wrong** — corrected here.

**`OpsHome.tsx:13`:**
```tsx
return isAdmin ? <OpsDashboard /> : <InstructorHome />;
```
mounted at `/app/ops` (`App.tsx:304`). **Both dashboards work and are role-adaptive.**

**`pageRegistry.ts:131` — the nav's one Dashboard row:**
```ts
{ key: 'mgmt.dashboard', path: '/app/dashboard', label: 'Dashboard', group: 'management' },
```
**There is no registry row for `/app/ops`.** The only link to it anywhere in `src/` is
`reviewSection.ts:113` — **the temporary admin-only Review menu** built by `TASK-REVIEWNAV`.

⚠️ **And that Review menu no longer exists.** Commit `ab45b18`, 2026-08-15, removed the Review
nav group at the owner's instruction — *"put back all the pages in the nav where they belong…
claire is flipping out she cant use the app."* Every row it had borrowed was returned to its
permanent home. **`/app/ops` had no permanent home to return to, so it returned to nothing.**

**So `/app/ops` — the real dashboard for both admins and trainers — is reachable by typing the URL
and by no other means.** The two surviving references in the entire `src/` tree are both inside
`reviewSection.ts`, whose nav group is gone.

## 5b. CORRECTION — the calendar DOES have a nav row

**An earlier draft of this document claimed the calendar was parked in Review too. That is wrong.**
It was sourced from the comment at `pageRegistry.ts:125`, which is **stale** — written before
`ab45b18` and never updated when the calendar's row was restored.

**The calendar has a real, permanent nav row** for both staff and clients:
`AppLayout.tsx:415` (`StaffNavItems`), `:1085` (`ClientNavItems`), `:1130`, plus a header icon at
`:1738`. `ab45b18`'s own message records the restoration: *"Calendar + Catalog (StaffNavItems,
recorded order)."*

**This does not soften §1** — every calendar defect there stands. It sharpens it: the calendar is
the one operational surface the owner CAN reach, which is why all his findings are in it.

⚠️ **A stale comment was treated as current state. That is the same error class §0 is about, and
it caught the orchestrator writing the document about it.**

---

# 6. WHAT THIS ADDS UP TO

**Every defect in this document is in the surface layer.** In all eight cases the database did the
right thing:

- the credit engine mints, expires, refunds and reconciles correctly — **the UI reaches around it**
- `complete_lesson_session` debits correctly — **nothing calls it**
- `business_hours` is configured correctly — **the grid renders only part of it**
- four delivery/audit ledgers are written correctly — **nothing reads them**
- both dashboards render correctly — **the nav does not list them**

> **Owner:** *"every single page in this app sucks… this shit is barely past the era of wordpress."*

**The pages are not the disease. They are where the disease is visible.** Nothing in this project
has ever owned the app as a whole: every task specified a write path and proved that write path,
and no task ever asked *is this reachable, is it named correctly, is it the only way to do this,
and does it tell the user what it did.* **That question is the missing artifact, and producing it
is the first thing the next orchestrator does.**

---

# 7. CORRECTIONS TO EXISTING DOCUMENTS

1. **`docs/OPEN-ITEMS-2026-08-18.md` §3** says *"Nothing from wave 1 or 2 has been opened in a
   browser."* **This is wrong.** Owner, 2026-08-18: *"everything has been opened in a browser."*
   The gap is not that nobody looked — it is that **nobody wrote down what they saw.** Fixed in
   that file.
2. **The claim that `OpsDashboard` has no route is wrong** (§5). It is routed at `/app/ops` via
   `OpsHome`. The defect is the missing nav row.
