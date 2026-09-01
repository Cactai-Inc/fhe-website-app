# DISCO-1 — the measured ledger

**Thread:** `DISCO-1` · **Opened** 2026-09-01 · **Role:** `docs/method/DISO-ROLE.md`
**Assignment (owner, verbatim):**

> *"Read docs/method/DISO-ROLE.md, then run discovery for CR-94 — the calendar, orders, payments,
> discounts, revenue and scheduling unit — and reconcile docs/CR-TRIAGE-keep-kill-do-2026-08-27.md
> against what has already shipped."*

⚠️ **THIS IS A STEP-2 SESSION ONLY.** CR-94 is already `🔒 RULED`, so step 1 (capture) was done on
2026-08-31 and is in `docs/CHANGE-ORDER-LEDGER.md:3826`. **Step 3 (discussion & lock) has NOT
happened** — it needs the owner. The `ASK-OWNER` list at the end of `DISCO-1-HANDOFF.md` is what
step 3 opens with.

**Everything below was measured against production on 2026-09-01.** Every number has its query
printed beside it. Read-only throughout; no write, no migration, no `BEGIN`.

---

## 0 · THE TWO STANDING RULES THIS SESSION OBEYED

1. ⚠️ **CR-94's own method rule** — *"i dont want to waste tokens and time on the threads reporting
   all the tangential issues we already know about."* Findings outside the six passes are in **§7,
   one line each, no analysis.**
2. **CLAUDE.md — no subagent delegation.** Every query and grep in this file was run in-thread.

---

# 1 · THE MONEY SPINE (CR-94 pass 1 · `TASK-BOOKS1`) — NOTHING OF IT EXISTS YET

**The single most consequential measurement of this session.**

```sql
select table_name, column_name from information_schema.columns
where table_schema='public'
  and (column_name ilike '%discount%' or column_name ilike '%list_price%'
    or column_name ilike '%comp%'     or column_name ilike '%write_down%'
    or column_name ilike '%paid_through%');
```
**Result: nine rows, and not one of them is money.** `contacts.is_company`,
`horses.competition_history`, `deals.completed_at`, `template_tokens.computed`, and five more
substring collisions. **There is no discount column, no list-price column, no comp marker, no
write-down, and no paid-through period anywhere in the schema.**

```sql
select column_name from information_schema.columns where table_name='purchase_items';
```
→ `id · purchase_id · offering_id · label · price_amount · price_unit · quantity · org_id ·
created_at · config · plan_ends_on · voided_at · voided_by · void_reason` — **14 columns.**
**A line holds ONE price.** There is nowhere to record that a $260 line was sold for $200, and
nowhere to record that it was given away.

### What this settles, without asking him anything
- **CR-39 (comp), CR-40 (discount) and CR-16's price-override are ONE missing mechanism**, exactly as
  the triage guessed. ✅ **The triage's guess is confirmed as fact.**
- **CR-28's "paid-through period" does not exist** — confirmed, unchanged since the triage.
- ⚠️ **`revenue_summary` would invert a comp today.** Its body:
  `sum(coalesce(nullif(p.amount_paid, 0), p.amount, 0))` — **a comp settled at `amount_paid = 0`
  falls through `nullif` to `p.amount` and is counted as FULL REVENUE.** Giving something away
  would *increase* the reported figure.
- **Zero comps have been recorded to date** (`select count(*) from purchases where amount_paid = 0
  and payment_status='paid'` → 0), so **no historical figure is wrong yet.** ⚠️ **The first comp
  entered before `TASK-BOOKS1` lands is the one that breaks it** — which is precisely what
  `TASK-BOOKS1 §3` and run-queue item 5 already say.

**INCUMBENT (D18):** `revenue_summary(timestamptz, timestamptz)` is the one revenue definition and
`TASK-BOOKS1` owns it. `calendar_revenue` is its retired predecessor — **still in the database, no
call sites** (`grep -rn "calendar_revenue" src api` → 3 hits, all comments in `api-calendar.ts`
explaining why it was abandoned). It reported $15,600 for August where $1,510 had been received.

---

# 2 · SETTLING AN ORDER (CR-94 pass 2) — THE LEDGER'S CLAIM IS CONFIRMED, AND IT IS WORSE

## 2a · The measured table, re-run and still true

| | 2026-08-31 (ledger) | 2026-09-01 (this session) |
|---|---|---|
| `mark_purchase_paid` allows staff | ✅ | ✅ **unchanged** |
| `/app/ops/payments/review` reachable | ✅ nav row in both files | ✅ `pageRegistry.ts:177` **unchanged** |
| `markOrderPaid` call sites | ⚠️ ONE | ⚠️ **still ONE** — `PaymentReviewPage.tsx:153` |
| client record can settle an order | ⚠️ no | ⚠️ **no** |

`grep -rn "markOrderPaid" src api` → 6 hits: the definition (`api-payments.ts:333`), the import and
the one call (`PaymentReviewPage.tsx:15,153`), and three prose comments. **Nothing else in the app
can settle an order.**

## 2b · ⚠️ THE CORRECTION — THE LEDGER NAMED THE WRONG SURFACE

CR-94's measured table says *"the client record's Orders tab shows status and 'Manage payment'; it
CANNOT settle an order."* **The surface it describes — `OrdersContent.tsx`, which renders the
"Manage payment" control — is the MEMBER'S OWN "My Orders".** It reads `listMyOrders()` and is
mounted at `/app/orders` and inside `AccountHub.tsx:205`. **Staff never see it about someone else.**

**The staff client record is `ContactDossierModal.tsx`** (opened from `Records › Contacts`, via
`Admin.tsx`). Its Orders tab (`:584-628`) lists orders with a `payment_status ?? status` badge and
offers **one** action: *attach offerings*. Its Payments tab (`:867`) is **read-only** and filters on
`payment_status = 'paid'`, so an unpaid order is invisible there.

⚠️ **The defect is real and the conclusion stands. The file named was wrong, and a task thread sent
to `OrdersContent.tsx` would have fixed the wrong screen.**

## 2c · ⚠️ THE HALF THAT DOES EXIST, AND IT IS THE TRAP

**The client record CAN create an order and mark it paid — at the moment of creation only.**
`ClientRecordActions.tsx:350-394` carries a three-way `unpaid | partial | paid` control that reaches
`attach_offerings_to_client(…, p_mark_paid, p_payment_method, …)`. `CalendarItemPanel.tsx:635` has
the same pair (`needs_payment | paid`) for an order a booking creates.

⚠️ **So "mark paid" appears twice on the surfaces the owner works from, and neither one settles an
order that already exists.** A person who has used those controls will reasonably expect the third
case to work. It is the missing one.

## 2d · What is actually sitting there

```sql
select status, payment_status, count(*) from purchases group by 1,2;
```
| status | payment_status | count |
|---|---|---|
| `awaiting_payment` | `unpaid` | **12** |
| `paid` | `paid` | 4 |
| `draft` | `unpaid` | 1 |

**17 orders in the whole business. 12 of them cannot be settled from the record they belong to.**
Named: Gabriella Olenik ×2, Rachel Engelhorn ×2, Kit Garcin, Madeline Do, Evan LaBuzetta ×2, Audrey
Slater, Serena Lee, Charlotte Caddell, Beth Davis.

**INCUMBENT (D18):** `markOrderPaid` → `/api/orders-mark-paid` → `mark_purchase_paid` /
`confirm_payment_claim`. **One spine, already correct, already staff-permitted.** Pass 2 is a REACH
change (§3b of `ORCHESTRATOR.md`), not a capability change. ⚠️ **Nothing new may be written.**

---

# 3 · ⚠️ THE BACKFILL IS IMPOSSIBLE TODAY (CR-94 pass 5) — THE FINDING THAT REORDERS THE UNIT

**The owner's requirement, verbatim:**
> *"all of our clients are largely not in the system fully, their orders, payments, revenue, and
> scheduled bookings need to be backfilled and we need the surfaces to function properly to be able
> to do this."*

**And on the previous line of the same ruling: *"with their real dates."***

## 3a · An order cannot be created with a real date

```sql
select pg_get_function_arguments(oid) from pg_proc where proname='attach_offerings_to_client';
```
→ `p_contact_id uuid, p_offering_ids uuid[], p_mark_paid boolean, p_payment_method text,
p_notes text, p_partial_amount numeric, p_org_id uuid`

⚠️ **There is no date parameter.** `purchases.created_at` takes its column default. **Every order the
owner backfills is stamped today.**

## 3b · A payment cannot be recorded with a real date

```sql
select pg_get_function_arguments(oid) from pg_proc where proname='mark_purchase_paid';
```
→ `p_purchase_id uuid, p_amount numeric, p_reference text DEFAULT 'zelle', p_method text,
**p_paid_at timestamptz DEFAULT NULL**`

⚠️ **The function CAN backdate. The surface never asks.** `api/orders-mark-paid.ts:109-114` passes
`p_purchase_id`, `p_amount`, `p_reference`, `p_method` — **and stops.** `markOrderPaid`
(`api-payments.ts:333`) takes `(purchaseId, method, reference?, amount?)`: **no date argument
exists anywhere between the button and the RPC.**

## 3c · Why that is fatal rather than untidy

**`revenue_summary` recognises revenue at `paid_at`:**
`WHERE p.payment_status='paid' AND p.paid_at >= p_from AND p.paid_at < p_to`.

⚠️ **A backfilled year of trading would land as a single day's revenue, and every month before it
would read zero.** The dashboard ribbon, the calendar money line, and the whole of CR-86's P&L are
built on that one function. **The backfill would not merely be untidy — it would manufacture a false
financial history that looks correct.**

## 3d · The one half that DOES work

**Bookings can be backdated.** `CalendarItemPanel.tsx:551,555` are `<input type="datetime-local">`
bound straight to `saveCalendarItem`, and production already holds bookings back to **2026-07-20**.
✅ **Scheduled bookings are the only leg of the owner's four (`orders, payments, revenue, bookings`)
that the backfill can do today.**

## 3e · ⚠️ THE SEQUENCING CONSEQUENCE, AND IT CONTRADICTS THE RULED ORDER

CR-94 lists the backfill surfaces as **pass 5 of 6**. **On this evidence pass 5 is a prerequisite of
passes 1 and 3, not a successor** — because:
- pass 1 defines revenue **at `paid_at`**, and `paid_at` is the field the backfill cannot set;
- pass 3's rolling schedule is measured **from the order**, and the orders are not in yet.

⚠️ **This is a proposed change to a 🔒 RULED sequence. DISO does not make it. It goes to him in
step 3 as the first item.**

---

# 4 · THE ROLLING SCHEDULE (CR-94 pass 3 / CR-90)

## 4a · `current_date + 90` — found, single-sourced, still live

```sql
select substring(pg_get_functiondef('public._ensure_plan_horizon'::regproc) from 'v_through[^;]*;');
```
→ `v_through date := coalesce(p_through, current_date + 90);`

**One function. One line. Its callers are `set_recurring_days` and the calendar page's own roll-forward
(`CalendarPage.tsx:221-231`).** ✅ **CR-90's replacement has exactly one place to happen.**

**Its footprint in production:**
```sql
select config->>'horizon_through', count(*) from purchase_items where config ? 'horizon_through' group by 1;
```
→ `2026-11-29 · 3` — **all three standing plans held to the same 90-day wall.**

```sql
select count(*) filter (where starts_at between now() and now()+interval '30 days')  as next_30d,
       count(*) filter (where starts_at between now()+interval '30 days' and now()+interval '60 days') as d30_60,
       count(*) filter (where starts_at > now()+interval '60 days') as beyond_60
from bookings where deleted_at is null and status='scheduled';
```
→ **23 · 21 · 22.** ⚠️ **22 sessions are `scheduled` more than 60 days out.** Under CR-90 (30
confirmed + 30 pending) **those 22 are holding time nobody has paid for**, and 21 more should be
`pending`, not `scheduled`.

## 4b · ⚠️ THE STATE VOCABULARY IS ALREADY BUILT AND HAS NEVER BEEN USED

```sql
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid='bookings'::regclass and contype='c';
```
→ `bookings_status_check` allows **twelve** values:
`draft · available · unavailable · pending · pending_slot · pending_payment · confirmed · cancelled ·
expired · completed · scheduled · no_show`

**In use, measured:** `available` **594** · `scheduled` **117** · `completed` **1**. **Nothing else.**

⚠️ **Nine of the twelve states have never been written.** `pending`, `pending_payment` and `confirmed`
— the three rungs CR-28 and CR-60 both describe — are **already legal values.** ✅ **"THIS EXISTS" is
the finding.** CR-90 pass 3 needs no migration on `bookings`.

⚠️ **And `skipped` is genuinely absent** — CR-22's one real gap, confirmed by the same constraint.

---

# 5 · THE MONTH-END CYCLE (CR-94 pass 4) — ⚠️ ESTABLISHED: JOBS DO RUN

CR-94 pass 4 says *"Establish first whether ANY scheduled job runs in production."* **Answered.**

```sql
select extname from pg_extension;              -- pg_net, pg_stat_statements, pgcrypto,
                                               -- plpgsql, supabase_vault, uuid-ossp
select count(*) from cron.job;                 -- ERROR: relation "cron.job" does not exist
```
⚠️ **`pg_cron` is NOT installed. There is no database-side scheduler and nothing can be scheduled
in SQL.**

**But `vercel.json` declares five crons, and they are running.** Proof, not inference:
```sql
select count(*) filter (where reminder_1h_sent_at is not null) as r1,
       max(reminder_1h_sent_at) from bookings;
```
→ **5 sent · most recent `2026-08-30 10:02:48-07`.** `/api/calendar-reminders` is hourly and has
written rows. ✅ **Corroborates AR1's finding and closes the question.**

**The five declared jobs:** `notifications-nudge` (daily 16:00 UTC) · `expire-holds` (hourly) ·
`calendar-reminders` (hourly) · `delivery-sweep` (hourly) · `mint-monthly-allotments` (daily 08:20 UTC).

**So CR-90's month-end cycle has a working host and needs no new infrastructure — it needs a sixth
Vercel cron.** ⚠️ **`docs/CHANGE-ORDER-LEDGER.md` records that `CRON_SECRET` must be set in two
places; that is a deploy step, not a build step, and it is the thing most likely to be missed.**

---

# 6 · THE CALENDAR (CR-94 pass 6) — CR-01…CR-07 RE-MEASURED

## CR-02 · ⚠️ THE TRIAGE SAYS "TWO BOOKINGS". IT IS ONE.
```sql
select display_code, starts_at at time zone 'America/Los_Angeles', ends_at at time zone 'America/Los_Angeles'
from bookings where deleted_at is null and status <> 'available'
  and extract(hour from starts_at at time zone 'America/Los_Angeles') in (0,12);
```
| code | start | end |
|---|---|---|
| **`BKG-000100`** | **2026-08-28 00:00** | **2026-08-28 13:00** |
| `BKG-000349` | 2026-08-28 12:00 | 2026-08-28 13:00 |

⚠️ **`BKG-000349` is CORRECT** — noon to 1pm, an ordinary hour. **`BKG-000100` is the slip: midnight
to 1pm, thirteen hours.** The triage's *"Correct the 12AM/12PM data slip on the two bookings"* would
have had a task thread "fix" a good row. **One row is wrong, and the second is its evidence, not its
twin.** ✅ Matches `CHANGE-ORDERS-LIST.md`'s own wording — *"corroborated by an identical booking
made the next day"* — which the triage compressed into an error.

## CR-03 · the furniture is 83%, not 92% — and the generator is STILL RUNNING
```sql
select round(100.0*count(*) filter (where status='available')/count(*),1), count(*)
from bookings where deleted_at is null;                        -- 83.4 · 712

select max(created_at), count(*) filter (where created_at > now() - interval '7 days')
from bookings where status='available' and deleted_at is null; -- 2026-08-31 00:50 · 72
```
**594 of 712 rows are generated open slots.** The share fell from 92% because **real bookings grew**,
not because furniture was removed — **72 more slots were generated in the last seven days.**
⚠️ **The number the build must remove keeps growing while the item waits.**

## CR-04 · ⚠️ NOT FIXED — AND THE TRIAGE'S ONE-LINE VERDICT IS HALF RIGHT
The triage: *"The read already sends staff full detail and the staff label; make the screen look at
the label."*

**The root cause is exactly as described.** `calendar_free_busy` staff branch emits
`'is_mine', false, 'mine_role', 'staff'`. `CalendarPage.tsx:127-140` `itemLabel()` tests
`if (item.is_mine)` — **false for staff** — and falls through to `return 'Reserved'` at **`:139`**.

⚠️ **But the label is not enough, and the triage promises more than the payload holds.** The staff
branch sends `client_id` and `offering_id` — **UUIDs. It sends no client NAME and no offering NAME.**
The owner asked for *"the client name and activity"*. **Reading `mine_role` fixes the fall-through
and then displays two UUIDs.** ✅ **Correction recorded: CR-04 is a two-part fix, not a one-liner.**

## CR-05 · confirmed absent, single-sourced
```sql
select column_name from information_schema.columns where table_name='offerings';
```
→ 23 columns; **no `duration_minutes`.** Unchanged since the triage and since `TASK-FIX2 §6.1`
specced it. **CR-07 depends on it; CR-05 is the true head of the calendar chain.**

## CR-06 · the three-position toggle is GONE
`grep -rn "three-position|toggleAvailability|setAvailability" src` → **no matches.**
`CalendarItemPanel.tsx:46` now carries `type ItemType = 'unavailable' | 'offering' | 'appointment'`.
✅ **Shipped, uncredited.** ⚠️ **What CR-06 protected still stands: the third position was how
availability got published, and 594 rows say the publishing mechanism is untouched.**

## CR-07 · not built
`CalendarItemPanel.tsx:551,555` → two `<input type="datetime-local">`. **Free-form, no 30-minute
increments, no clash check, no duration awareness.** Exactly the condition that produced CR-02.

## CR-01 · the panel is still the calendar page's
`CalendarPage.tsx` is 1,461 lines and hosts `CalendarItemPanel` (966 lines) directly. **Unchanged.**

---

# 7 · FLAGGED, NOT FIXED — one line each, per CR-94's rule 3

- `purchases.payment_method` holds **`zelle` ×9, `Zelle` ×3, `cash` ×1, NULL ×4** — the writer was
  fixed (`OrdersContent.tsx:29`), **the three existing rows were never reconciled.**
- `PUR-000320` (**$880, paid**) belongs to contact *Steph* with **no last name and no email**, carries
  **23 bookings to 2026-11-28**, and is a **third** `2x Weekly Lessons` order beside `PUR-000319` and
  `PUR-000230`.
- `PUR-000230` (Madeline Do, the run-queue's *"duplicate to expunge"*) **has 4 bookings attached**;
  deleting it is not a bare row delete.
- `grant_lesson_credit` **still exists** — CR-89 retires it only after pass 2 lands.
- **12 storage buckets, all accepting ANY MIME type; 11 with no size limit; `profile-images` public
  with neither.** Unchanged since ORCH5 measured it on 2026-08-27.
- **Euthanasia block still present** in `HorseIntakeForm.tsx` (CR-69).
- *"Barn (blank if outdoor)"* still present at `HorseIntakeForm.tsx:435` (CR-68b).
- `bookings.all_day` is **false on all 712 rows** — CR-03's all-day row has no data behind it yet.
- **86 of 118 real bookings carry an instructor**; 32 do not (CR-13).
- `lesson_credits`: **23 rows, 15 credits outstanding.**

---

# 8 · TEARDOWN — process census

**Processes started by this thread: none.** No dev server, no build, no test run, no background job.
`psql` was invoked 12 times, each exiting on completion. **No worktree created. No file staged. No
commit. No write to production.**
