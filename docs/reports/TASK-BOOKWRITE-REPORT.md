# TASK BOOKWRITE — report

**Branch** `task/bookwrite` (worktree `~/Downloads/claude-code-repo/wt-bookwrite`, off `origin/main`
`0567935`). **Not pushed.**

**Applied to production and verified.** Two migrations:

- `20260812T1600_bookwrite_booking_writers_record_relationships.sql`
- `20260812T1700_bookwrite_purchase_link_must_not_delete_bookings.sql`

**No existing row was changed.** After all work: 319 bookings, still `0` with `purchase_id`,
`credit_id`, `contract_id`, `instructor_user_id`, `horse_id`. 12 fulfillment units, still all
`open`, still none linked. 2 purchases. 3 credits. The 6 orphaned units are untouched. This task
changed what gets written **next**.

---

## The finding in one line

**The consumption machinery was already built, already correct, and had never once been
reachable.** `trg_booking_unit_link` has been on `bookings` the whole time, and it claims a
fulfillment unit on INSERT — guarded by `purchase_id IS NOT NULL`. No writer had ever written a
`purchase_id`. The ledger was not missing; it was starved by one unwritten column.

There was a second reason it could never fire, which mattered just as much: **the trigger only
claimed on INSERT, and every real path attaches the purchase by UPDATE.** `book_open_slot` turns an
existing `available` slot into a booking. The calendar edit branch assigns a purchase to an item
that already exists. Both were invisible to it. Writing `purchase_id` alone would have fixed the
staff-calendar path and left the client self-serve path exactly as dead as before.

---

## 1. Every writer that inserts into `bookings`

Six, all in the database. **No application code inserts or updates `bookings` directly** — every
app write goes through an RPC (`src/lib/ops/api-lessons.ts` touches the table for reads only).

| # | Writer | Creates | Knew and recorded | Knew and **discarded** |
|---|---|---|---|---|
| 1 | `_publish_open_slots_for_org(org, weeks, slot_minutes)` | 280 `available` slots from business hours | time, org | — nothing |
| 2 | `close_day(date, reason)` | all-day `unavailable` block | time, reason | — nothing |
| 3 | `generate_lease_availability(horse, weeks)` | `available` horse-time blocks | horse, time | **`contract_id`** |
| 4 | `save_calendar_item(jsonb)` | **all 39 real bookings** | client, horse, offering, purchase (if picked), location, price | **`account_contact_id`, `account_user_id`, `instructor_user_id`, unambiguous `purchase_id`** |
| 5 | `schedule_lesson_session(...)` | lead-drawer / sessions-board lessons | client, contact, account, horse, request | **`offering_id`, `instructor_user_id`, `purchase_id`** |
| 6 | `request_open_time(...)` | client-requested `pending` time | client, account, offering, horse | **`account_contact_id`** |

Plus one path that does not INSERT but is where a booking *becomes* real, and belongs in this list:

| # | Writer | Does | Knew and recorded | Knew and **discarded** |
|---|---|---|---|---|
| 7 | `book_open_slot(booking, horse)` | client claims an `available` slot | client, account, horse, **`credit_id`** | **`account_contact_id`, the credit's `offering_id`, the credit's purchase** |

`book_open_slot` was the closest to correct — it already debited a credit and recorded
`credit_id`. It still could not name the purchase, because **`lesson_credits` had no
`purchase_id` column.** The credit knew nothing about the order that granted it, so the chain
booking → credit → purchase did not exist to follow.

### Why all 39 real bookings came from writer #4

They carry `created_by`, `location_id` and `display_code`, and 16 of them share a `series_id`.
None carries `account_contact_id`, which `schedule_lesson_session` always sets. Fifteen of the 39
have a hand-typed punch-card count in the notes field — `Melanie 3/8`, `Maddie 6/8`, `Lesson 4/4`.
**That is the fulfillment ledger, being maintained by hand in a free-text field, next to an
automated ledger that had never been consumed.**

---

## 2. What a new booking records now — proven

Every scenario below was executed against **production functions** inside `BEGIN; … ROLLBACK;`.

### A staff-calendar lesson (`save_calendar_item`)

No purchase was supplied. The writer resolved it because exactly one was possible.

```
 display_code |  kind  |  status   | offering | instructor | horse | purchase | client | acct_contact | acct_user
 BKG-000415   | lesson | scheduled |    t     |     t      |   t   |    t     |   t    |      t       |     t

   offering    | instructor | horse |  purchase  | account_contact
 Single Lesson |    CJ Z    |  Tiz  | PUR-000059 | Claire Bourdon

 ---- the fulfillment unit it claimed ----
           label           | unit_kind | seq | current_status | linked
 Single Lesson · session 1 |  session  |  1  |   scheduled    |   t
```

### A lead-drawer lesson (`schedule_lesson_session`)

```
 display_code |  status   | offering | instructor | horse | purchase | acct_contact | acct_user
 BKG-000416   | scheduled |    t     |     t      |   t   |    t     |      t       |     t

 ---- the fulfillment unit it claimed ----
                 label                  | unit_kind | current_status
 1x Weekly (With your horse) · period 1 |  period   |   scheduled
```

### A client claiming an open slot (`book_open_slot`) — the ledger closing end to end

A purchase was provisioned through the real money path, then the client claimed a **generic**
open slot (one published from business hours, carrying no offering of its own):

```
 ---- the credit now names what bought it ----
  package_key  | credits_remaining | has_purchase | has_offering | display_code
 Single Lesson |         1         |      t       |      t       |  PUR-000085

 ---- the booking ----
 display_code |  kind  |  status   | offering | credit | purchase | client | acct_contact | acct_user
 BKG-000185   | lesson | scheduled |    t     |   t    |    t     |   t    |      t       |     t

 ---- the unit that booking claimed ----
           label           | unit_kind | current_status
 Single Lesson · session 1 |  session  |   scheduled

 ---- and the credit was debited exactly once ----
 credits_total | credits_remaining
       1       |         0
```

The slot itself had no offering. The booking still says *Single Lesson*, because the credit knew,
and the credit now knows because the purchase told it.

### Completion and cancellation

```
T3  completion   → Single Lesson · session 1 | consumed | consumed_at stamped
T4  cancellation → 1x Weekly … · period 1    | open     | booking_id cleared
```

### Lease availability records its contract

```
{"created": 4, "contract_id": "7ed8bfac-3884-4087-948e-b1bb00714556"}
 lease_slots | with_contract
      4      |       4
```

---

## 3. Fields that are legitimately NULL, and why

The finding was never "everything must be filled".

| Field | Where NULL is correct | Why |
|---|---|---|
| every relational field | `_publish_open_slots_for_org`, `close_day` | **An availability slot is time, not a booking.** No client has claimed it, nothing paid for it, nobody is assigned. A closed day is barn-wide. Proven: T9 shows a closed day with all seven relational columns null. |
| `client_id`, `purchase_id`, `credit_id`, `instructor_user_id` | `generate_lease_availability` | It publishes horse-time held open under a lease **for the lessee to claim later**. The claim is a separate act. `horse_id` and `contract_id` are knowable and are now recorded. |
| `purchase_id`, `credit_id` | `request_open_time` | It is a **request**. Nothing is allocated until staff accept it. Recording a purchase here would claim a unit for time that may never be granted. |
| `credit_id` | `save_calendar_item` | The staff calendar **does not debit credits** — `book_open_slot` does. Writing a credit id without debiting the credit would be a lie in the ledger. |
| `instructor_user_id` | `book_open_slot`, and open slots generally | Nobody is assigned to an open slot yet. When a client claims one, staff assign the instructor afterwards on the calendar. Confirmed null in the T5 output above, deliberately. |
| `horse_id` | any lesson on a barn-supplied horse | Already modelled: `book_open_slot` explicitly allows NULL to mean "barn horse". |
| `contract_id` | lessons and care bookings | There is no contract behind a lesson. Contracts back leases and sales. |
| `purchase_id` | a booking with **no** open unit, or **more than one** candidate purchase | See the auto-link rule below. |
| `lesson_credits.purchase_id` | a hand-granted credit | A staff comp or goodwill credit has no order behind it. The new column is nullable for exactly this. |

---

## 4. The consumption rule — stated before it was built

**This rule was not invented here.** It is what `trg_booking_unit_link` already encoded; it is
written down because the work now depends on it.

- **CLAIM at scheduling.** A booking that names a purchase takes an open `session`/`period` unit
  of that purchase. Unit → `scheduled`, `booking_id` set.
- **CONSUME at completion.** Booking → `completed`. Unit → `consumed`, `consumed_at` stamped.
- **RELEASE at cancellation.** Booking → `cancelled` or `expired`. `booking_id` cleared, unit
  returns to `open`.
- **PAYMENT DOES NOT CONSUME.** Service is prepaid-gated (D9), so the purchase exists *before* the
  booking. A paid-but-unscheduled unit must read `open`, or "what does this client still have
  coming" stops being answerable — which is the whole point of the ledger.

Two corrections were needed to make that rule true in practice:

**(a) Claim on a purchase attached after creation.** Added the UPDATE branch. Without it the
client self-serve path could never consume anything.

**(b) Claim the unit for the service that was booked.** `consume_unit_for_booking` took the
*lowest-seq* open unit of the purchase, whatever it was for. On the live five-line order
PUR-000059 that meant a **Single Lesson booking claimed the Single Class unit** — the first proof
run reproduced exactly that. The ledger would have read plausibly while being wrong, which is the
failure mode the task warns about for an evidence spine. The claim now prefers a unit whose
`purchase_item.offering_id` matches the booking's offering, and falls back to lowest-seq only when
the booking names no offering or no matching unit is open.

**The auto-link rule: never guess.** A writer records the paying purchase only when it is
**unambiguous** — exactly one purchase of that client has an open `session`/`period` unit. Zero or
two-or-more candidates leave it NULL for staff to pick. Proven:

```
 null_when_no_candidate    : t     (client with no purchases)
 resolves_when_exactly_one : t
 refuses_to_guess          : t     (client with two candidate purchases)

 and a booking created under that ambiguity:
 purchase_left_null | still_names_instructor | still_names_contact
         t          |           t            |          t
```

It records everything it is sure of and declines only the one field it cannot know.

---

## 5. ⚠ The 6 orphaned units — reported, untouched

Confirmed and **not modified, not deleted, not repaired**:

```
 fd07390e…  Single Lesson · session 1     open   purchase: GONE  item: GONE
 61a81199…  Single Class · session 1      open   purchase: GONE  item: GONE
 c330f87f…  Single Lesson · session 1     open   purchase: GONE  item: GONE
 efcfd518…  Single Lesson · session 1     open   purchase: GONE  item: GONE
 f6c51680…  Single Lesson · session 1     open   purchase: GONE  item: GONE
 f1f8465c…  Exercise Session · session 1  open   purchase: GONE  item: GONE
```

Both foreign keys are `ON DELETE CASCADE`, so these rows should not be able to exist. `purchases`
has reached **PUR-000059 with 2 rows surviving**; roughly **71 purchases** were removed with
referential integrity suppressed. The owner has not ruled on them and they are left exactly as
found.

**This is not only history.** See §6 — it is the precedent that made the next item urgent.

---

## 6. A cascade this task armed, and closed

`bookings.purchase_id` was **`ON DELETE CASCADE`**. It is the only relational foreign key on
`bookings` that was not `SET NULL`:

```
account_contact_id · account_user_id · contract_id · credit_id · horse_id
instructor_user_id · location_id · offering_id · request_id      → SET NULL
client_id                                                        → RESTRICT
purchase_id                                                      → CASCADE   ← odd one out
```

That was harmless for as long as no booking had ever carried a `purchase_id` — the cascade could
not fire. **The BOOKWRITE writers populate it on every lesson and care booking with an order
behind it, so this task is what would have armed it.** Demonstrated on production, rolled back:

```
scenario: a COMPLETED lesson, then its purchase is deleted
  under the old CASCADE  → booking_survived: f      ← the lesson history is gone
  under SET NULL         → survived: t, link_nulled: t
```

Given that this database has already lost ~71 purchases to hard deletes, leaving that armed was
not acceptable. Changed to `ON DELETE SET NULL`, consistent with every sibling key and with D11
(nothing is purged; records are retained). A booking is a record of time that was held and often
delivered; it does not stop being true because the order row was removed. Losing the link is
acceptable. Losing the booking is not.

`fulfillment_units.purchase_id` **keeps** its CASCADE — a unit is derived from a `purchase_item`
and has no meaning without it. That asymmetry is deliberate.

**This deletes nothing and repairs no row.** It only changes what a future purchase delete does.

---

## 7. Money paths — reported before changing, no pricing behaviour changed

The task requires this to be named rather than done quietly.

**`_provision_purchase_for_offerings` was rewritten.** Every pricing expression in it is
byte-identical: `v_total` (the `sum(price_amount)`), `v_paid` (the mark-paid / clamped-partial
branch), the `unpaid|pending|paid` ladder, the `payment_reference` strings, the `purchase_items`
insert, and the `(\d+)-Lesson` / `price_unit='session'` credit-count rule. **The only delta is two
extra columns on the `lesson_credits` INSERT it already performed:** `purchase_id` and
`offering_id`.

`offering_id` was already load-bearing and never populated — `book_open_slot` orders candidate
credits by `(offering_id = v_offering) DESC`, a preference that had nothing to prefer for as long
as no credit was ever tagged.

**`finalize_purchase_payment`, `mark_purchase_paid`, `create_gift` and `confirm_booking_for_purchase`
were not modified.** `offerings.price_amount` is read in exactly the places it was read before.

---

## 8. What a backfill of the 319 existing rows would involve

Not attempted, per the task. Assessment:

| Field | Backfillable? |
|---|---|
| `purchase_id` | **Mostly unrecoverable.** Only 2 purchases survive of ~73 ever created. A booking whose purchase was hard-deleted cannot be relinked — there is nothing to link to. |
| `credit_id` | **Unrecoverable.** 3 credits exist, none carries a purchase or an offering, and nothing records which lesson drew on which. |
| `offering_id` | **17 of 39** real bookings lack it. Partially inferable from the notes (`Melanie 3/8` implies an 8-lesson package) but that is reading prose, not evidence. |
| `client_id` | **14 of 39** lack it. Names appear in notes; the roster has same-name records, so matching by name is unsafe here. |
| `instructor_user_id` | 38 of 39 have `created_by`, and there are only two staff. Setting instructor = creator would be an **inference presented as a record**. Recommend leaving null. |
| `horse_id` | **Unrecoverable.** Never captured anywhere. |
| the 280 availability slots | **Nothing to backfill** — correctly empty. |

The honest position: the 39 real bookings are a hand-kept record whose supporting rows were
deleted. **Recommend no backfill.** Fix forward; let the existing rows be what they are.

---

## 9. Owner-facing surfaces (D13)

Everything added is editable without a developer, SQL, or git:

- **Calendar item panel** — new **Instructor** picker on a client-bound booking. Defaults to
  "You (whoever books it)"; the RPC records the acting staff member when left alone.
- **Schedule-a-lesson form** (used by both the lead work drawer and the sessions board) — new
  **Service** and **Instructor** pickers.
- **Assign to purchase** picker already existed on the calendar panel and is unchanged. It was
  never the problem: it renders only when the client has purchases, and 15 of 17 clients have
  none, so it was almost always invisible. The unambiguous auto-link now covers the common case.
- New `instructor_options()` RPC backs both pickers. The platform owner is excluded by org
  boundary (D1a) rather than by name — it returns CJ and Claire.

---

## 10. Files

**Database (applied to production, verified):**
- `supabase/migrations/20260812T1600_bookwrite_booking_writers_record_relationships.sql`
- `supabase/migrations/20260812T1700_bookwrite_purchase_link_must_not_delete_bookings.sql`

**Frontend:**
- `src/lib/ops/api-calendar.ts` — `instructor_user_id` on the item type, `InstructorOption`, `fetchInstructorOptions()`
- `src/lib/ops/api-lessons.ts` — offering / instructor / purchase on `ScheduleSessionInput` and the RPC call; result type widened; corrected a now-false comment on `consumeLessonCredit`
- `src/pages/app/CalendarItemPanel.tsx` — instructor picker
- `src/pages/app/ops/lessons/ScheduleSessionForm.tsx` — service + instructor pickers, self-fetching
- `src/pages/app/ops/lessons/SessionsPage.tsx` — replaced a hand-copied structural duplicate of the form's value type with the named type

`DashboardPanel.tsx` and `ops/IntakePage.tsx` — **not touched.** The schedule-a-lesson form fetches
its own option lists rather than taking them as props, so LEADCLEAN's shipped layout needed no
change. `ClauseDocument.tsx` — not touched.

Health: `typecheck` 0 errors · `typecheck:api` 0 errors · `lint` 0 errors, 39 warnings —
**identical to the count on a clean `0567935`** (measured by stashing; CLAUDE.md's "~26" is stale).

---

## 11. NOT VERIFIED — no staff browser session exists

The database behaviour is proven by direct SQL above. **The UI has not been exercised in a
browser.** Checklist:

1. Open the calendar as staff → create a **Booking** item → confirm an **Instructor** dropdown
   appears listing CJ and Claire, defaulted to "You (whoever books it)".
2. Save it with a client selected → reopen → confirm the instructor persisted.
3. Confirm the **Assign to purchase** picker appears for a client who has a purchase.
4. Save a booking for a client with exactly one open purchase **without** touching that picker →
   confirm the order/purchase view shows the unit as **Scheduled**, not Open.
5. Ops → Lessons → Sessions → **Schedule a lesson** → confirm new **Service** and **Instructor**
   dropdowns render and submit without error.
6. Same form from the lead work drawer (Intake → a request → schedule) → confirm both dropdowns
   render there too and the request still converts.
7. Mark a lesson **completed** → confirm the unit reads **Consumed**.
8. Cancel a lesson → confirm the unit returns to **Open**.
9. As a client with credits, claim an open slot → confirm it books and the order view shows the
   unit as Scheduled.

`test:db` is broken (60 of 68 files failing) and is **not** cited as evidence anywhere in this
report.

---

## 12. Flagged, not fixed

1. **`createLessonCredit` is duplicated** — `src/lib/api.ts:1814` and
   `src/lib/ops/api-lessons.ts:251` are two independent implementations of the same insert.
   Neither sets `purchase_id` or `offering_id`, which is correct for a hand grant, but the
   duplication means a future change will be made in one and missed in the other.
2. **`generate_lease_availability` parses `TXN.DAYS_USED` as a comma list**, and the live executed
   lease holds the prose sentence `"Lessor: Tue, Thu, Sun; Lessee: Mon, Wed, Fri, Sat."` It splits
   into tokens like `Lessor:Tue` and `Sun;Lessee:Mon`, of which only `Thu`, `Wed`, `Fri` happen to
   match a weekday — which is why the proof produced 4 slots rather than the intended set. The
   contract link is correct; **the day parsing is wrong and predates this task.**
3. **`generate_lease_availability` had been unreachable.** It filtered on template key
   `HORSE_LEASE`, which under D10 is the archived original that never backs a document, so it
   always raised "no executed lease contract for this horse". Retargeted to the live family
   (`_V2` / `_SIMPLE` / `_FULL`) because `contract_id` could not otherwise be recorded at all.
   Worth knowing that this feature has never run in production.
4. **`save_calendar_item`'s edit branch overwrites unconditionally.** It sets `client_id`,
   `purchase_id`, `offering_id` and `horse_id` from the payload every time, so a caller that sends
   a partial payload silently clears them. The panel is documented as sending complete state and
   does, so this is latent rather than live. Not changed — tightening it risks breaking
   intentional clearing.
5. **`status_events` files bookings under `entity_type = 'offering'`.** Checked, and it is
   **deliberate** — the vocab defines six `offering` codes and `booking_status_code()` maps into
   them. Recorded so a future thread does not "fix" it into a regression.
6. **`listLessonSessions()` reads 318 where 39 exist** — TASK-COUNTFIX owns the read path. Not
   touched.

---

## 13. One side effect worth stating

Display-code sequences are non-transactional, so the rolled-back proof runs consumed numbers
without creating rows. `purchase_code_seq` is at **95** and `booking_code_seq` at **438**. The next
real purchase and booking will have codes above those, leaving visible gaps. **No rows were
created** — `purchases` still holds 2 and `bookings` still holds 319.

---

## The test this had to pass

1. ✅ Every writer enumerated, with what each knows at creation — §1, six INSERT paths plus
   `book_open_slot`, and confirmation that no app code writes the table directly.
2. ✅ A new lesson booking records its offering, instructor, horse and paying purchase — §2, three
   writers proven, with the claimed unit shown each time.
3. ✅ Legitimately-null fields named with reasons — §3.
4. ✅ A booking claims its unit, and the rule was stated before it was built — §4, including the
   two corrections needed to make the stated rule actually hold.
5. ✅ The 6 orphaned units reported and untouched — §5, re-confirmed after all work.
6. ✅ No pricing behaviour changed — §7.
