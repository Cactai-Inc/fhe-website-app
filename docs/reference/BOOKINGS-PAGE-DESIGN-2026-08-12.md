# BOOKINGS BECOMES THE PAGE, CALENDAR BECOMES A VIEW — decision + data, 2026-08-12

**Owner:** *"Bookings, should be the page and calendar lives inside of it as a view. this gives
me the option of a list view, a booking type view, and a calendar view."*

**Recorded as a decision. NOT YET SPECCED** — the data below determines what is worth building
first, and the owner ranked orders/payments/booking last.

---

# WHAT EXISTS

**There is no Bookings page.** `/app/calendar` → `CalendarPage.tsx` (40,687 bytes), plus
`CalendarItemPanel.tsx` and `CalendarSettingsPanel.tsx`. Two routes already fold into it:

```
/app/book              -> Navigate /app/calendar
/app/ops/availability  -> Navigate /app/calendar
```

So the consolidation the owner wants is **already half-done by redirect** — Calendar is the de
facto booking surface. What changes is the framing: Bookings is the page, Calendar is one of
its views.

---

# ⚠️ THE DATA — measured in production, and it decides the build order

```
bookings                          319 rows
  status = available (open slots)  280      <- 88% of the table
  status = scheduled                39
  kind: lesson 318 · block 1

  with offering_id                  22      <- 7%
  with client_id                    25      <- 8%
  with instructor_user_id            0      <- ZERO
  with horse_id                      0      <- ZERO
```

By offering:

```
(no offering)      available   280
(no offering)      scheduled    17     <- real bookings with no type
2x Weekly          scheduled    16
Single Lesson      scheduled     3
Evaluation Lesson  scheduled     2
1x Weekly          scheduled     1
```

## What each requested view would actually render today

| view | verdict |
|---|---|
| **Calendar** | Fine. It is what exists and it works. |
| **List** | **88% of rows are empty availability slots.** A list that does not separate "open slot" from "booked" repeats `InstructorHome`'s D-4 defect — which today makes a trainer's day read 5× busier than it is — at the scale of the whole table. **The list must distinguish them, and it is the first design decision.** |
| **Booking type** | **Only 22 of 319 rows have an `offering_id`** — and **17 of the 39 real scheduled bookings have none**, so 44% of genuine bookings land in "(no type)". The view is buildable; it would be mostly unknown. |

## Two dimensions do not exist at all

- **`instructor_user_id` is NULL on all 319 rows.** No booking names who is teaching it. A
  "by instructor" view or column cannot be built.
- **`horse_id` is NULL on all 319 rows.** No booking names a horse.

## And the link to what paid for it has never been written

ADMINSWEEP Phase 1, finding **F-2**: **0 of 319 bookings carry a `purchase_id`, `credit_id`
or `contract_id`**, and no `fulfillment_unit` carries a `booking_id`. The obligations ledger
generates correctly and **has never once been consumed.**

**This is the same root gap as the missing offering links, not a separate one.** Bookings are
being created without the relationships that would let any of these views say anything.

---

# THE RECOMMENDATION

**This is not "empty because we are pre-launch."** These are 39 *real* scheduled bookings
whose type, instructor, horse and payment link were never recorded. **Building three views over
that produces two views that report "unknown" — and this project's own rule is that a surface
which can never have contents is a defect, not a placeholder.**

**Fix what writes a booking before building views that read one.** The booking-creation path
should set `offering_id`, `instructor_user_id` and the purchase/credit link. Then the list and
type views have something to show, and F-2 closes as a side effect.

**Sequencing, offered as input:** this belongs with `BOOKFLOW`, which the owner ranked last. The
page reframing (Bookings as the page, Calendar as a view) is cheap and can happen any time; the
**list and type views should follow the write-path fix**, not precede it.

---

# ALSO RECORDED, 2026-08-12 — nav moves, and two things to resolve first

**Owner:** *"horses would move up to the community section too"*, following *"move directory
into the Community section (App Pages)"*.

**Two ambiguities to settle before either move happens:**

1. **"Community section" is ambiguous — there are two groups.** `COMMUNITY_GROUP` renders under
   the heading **"Community"** (Activity, Evaluations, Moderation, Field options, Content
   store). `APP_PAGES_GROUP` renders under **"App pages"** (the member view: Dashboard,
   Calendar, My Lessons, My Orders, Catalog, My Documents, Messages, My Posts, My Stable). The
   owner has equated the two in writing; **they are different groups and one of them already
   owns the name.**
2. **Horses (`/app/ops/horse-records`) is a STAFF surface** (`requireStaff`), and members
   already have their own horse surface — **`/app/stable`, "My Stable"**, in the member group.
   Moving the staff horse page into the member-view group puts two horse entries in one list
   meaning different things. **That is the duplication pattern this whole effort is unwinding.**

**Both belong to the re-bucketing pass the owner has already said comes after the
restructuring** — not to a one-off move now that a later pass would undo.
