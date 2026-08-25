# TASK-DAYSHEET — Claire's day, the emails around it, and the calendar that shows it

**Owner spec, 2026-08-24**, across three messages. Verbatim, because the schedule and the
dispositions are the requirement:

> the new email system for notifications about upcoming lessons is working but its doing too much,
> we need a daily email at 7am with the days rundown sent to hello@fhequestrian.com and a client
> email at 9am (or 1 hour prior to their scheduled time if their scheduled booking is earlier than
> 10am) and then a reminder email 1 hour prior for the client and hello@fhequestrian.com, the in
> app notifcation isnt needed if we have a static daily view for claire with a next up card and the
> daily view should advance as the day progresses so shes not looking at a card that shows the day
> ahead and seeing things that already happened, those belong on a separate list further down the
> page so she can click on them to add notes or do something to the lesson or scheduled activity
> like horse care service or task like giving a horse its supplements or medicine or contacting the
> vet. Each of these items also needs to have a way for her to record the status as complete,
> skipped, no-show (when the client doenst show up or the horse isnt available), things like
> cancelled or rescheduled are self explanatory and we can record them in the log for that item so
> we know when we look at a future booking that it was actually something that was rescheduled or
> when we look back at an item we see it was cancelled, the client didnt show, the horse wasnt
> there or was unavailable, or the booking was rescheduled. Also it doesnt appear the pending
> status is working properly and likely the approval process for a request isnt working properly
> either, and the calendar still shows a full list of all the open slots in green blocks, we need to
> remove this and just make the calendar open for booking by being empty, if something is booked on
> the calendar in a specific slot it shows as unavailable to anyone not involved and for something
> that doesnt have a specific time it just shows at the top of the day as an item being dont on that
> day, when the item is confirmed it changes from orange to green and when its complete (indicated
> by claire doing something in the ui that marks it so) it fades but remains clickable and editable.

> also i still cant click on things in the month view and get them to open and keep me in the month
> view. it should open a modal not take me to the week view. and specifically, there is something
> booked for 12am which is a physical impossibility and i have no way to open it because it only
> shows in the month view and its out of range in the week view.

> also the dashboard shows the weekview of whats on the schedule and again, clicking something
> should open the modal but it takes me to the calendar

---

## 0. THE ONE FINDING THAT TIES THREE COMPLAINTS TOGETHER

**The item panel is page-bound, not a modal.** Every "it takes me somewhere else instead of
opening" report is the same defect wearing a different hat:

| Where | What happens | Line |
|---|---|---|
| Month view | clicking a day sets `setView('week')` — there is no per-ITEM click at all, only `onPickDay` | `CalendarPage.tsx:512` |
| Dashboard | `bookingHref()` returns `/app/calendar?item=…&on=…` — it does open the panel, but only after navigating off the dashboard | `src/lib/dashboard/registry.ts:154` |
| Week view | the panel is a page region of `CalendarPage`, so nothing else can host it | `CalendarPage.tsx` |

**So the fix is ONE thing, not three:** `CalendarItemPanel` becomes openable as a modal over
whatever surface listed the item, and month view / dashboard / week view all open it in place.
`?item=` should keep working — a shared link must still land somewhere real (D17).

---

## 1. THE 12AM BOOKING — found, and it is worse than it looks

```
id      32eae51d-c3b4-400b-a52d-9f833b20b26e
kind    lesson      status  scheduled     is_flexible  false
starts  2026-08-28 00:00  Pacific
ends    2026-08-28 13:00  Pacific        ← a THIRTEEN HOUR lesson
client  yes         offering yes         created 2026-08-02
```

It is the only booking in the table before 06:00. Two separate bugs put it beyond reach:

1. **The week grid only renders business hours.** `const hours = Array.from({ length: closeHour -
   openHour }, …)` — `CalendarPage.tsx:561`, band from business hours, fallback 10–18. Midnight is
   not a row that exists.
2. **Placement is keyed on the START hour only.** `itemsFor(day, hour)` matches
   `s.getHours() === hour` (`CalendarPage.tsx:564`). Even though this booking *runs through* 13:00,
   which IS a rendered row, it appears in none of them.

⚠️ **Do not just widen the hour band.** That surfaces this one row and leaves the real hole: any
booking outside business hours is invisible and therefore uneditable, and a multi-hour booking
draws only in its first row. Both want fixing, but the FIRST thing to build is the modal from §0 —
with it, the month view alone is enough to reach any item regardless of the grid's range.

**Root cause of the 00:00–13:00 value itself is NOT yet established.** It predates every calendar
change this month (created 2026-08-02). Do not repair the row before finding what wrote it — a
data fix on an unexplained write is how the same row comes back.

---

## 2. THE EMAILS — what runs now, and what to replace it with

### What runs now
`api/calendar-reminders.ts`, on the Vercel cron `0 * * * *` (hourly). It is **working** — verified
in production, `booking_reminder_1h` and `booking_reminder_2h` rows both emailed on 2026-08-24.
Each hourly run does four things:

1. `calendar_reminder_sweep()` — writes in-app 1h **and** 2h reminders
2. `lease_reminder_sweep()`
3. **`publish_open_slots_all(p_weeks := 4, p_slot_minutes := 60)`** ← this is the green-block
   generator, see §5
4. emails every un-emailed `booking_%` / `lease_%` notification to its recipient, **plus a
   consolidated copy of every reminder to the ops inbox**, inside a 06:00–21:00 Pacific window

**"Doing too much" is exactly right, and specifically:** it sends on the 2h mark as well as the 1h
mark, it emails per-notification rather than per-schedule, and it fires the moment a row appears
rather than at a chosen hour.

### What to build
| When | To | Contents |
|---|---|---|
| **07:00** daily | `hello@fhequestrian.com` | the day's rundown — every item on today |
| **09:00** daily | each client with something today | their item — **but at 1 hour prior instead, if their booking starts before 10:00** |
| **1 hour prior** | the client **and** `hello@` | the reminder |

**Retire:** the 2h reminder, and the per-notification ops copy (the 07:00 rundown replaces it).
**Retire:** the in-app booking reminder notification — *"the in app notifcation isnt needed if we
have a static daily view"*. ⚠️ Retire the SEND, keep the rows if anything reads them; check before
deleting (D32).

### ⚠️ THREE THINGS THAT WILL BITE
1. **THERE IS NO TENANT TIMEZONE.** No `time_zone` column exists on `organizations` or
   `org_settings` — confirmed. `calendar-reminders.ts` hardcodes `America/Los_Angeles` in
   `pacificHour()`. "7am" and "1 hour prior" are timezone statements, so this must be settled
   first. Same finding as TASK-LESSONREQUEST, still unaddressed. **Put it in tenant settings, do
   not hardcode it a second time** (MEDIA_RELEASE class).
2. **Vercel cron granularity.** The current schedule is hourly. 07:00 and 09:00 are fine on an
   hourly tick; **"1 hour prior" is not** — a 10:30 lesson wants a 09:30 send. Either run the
   endpoint more often (`*/15`) and let it decide, or accept hour-granularity reminders. **This is
   an owner call.** Note Vercel's Hobby plan limits cron frequency; check the account's tier before
   promising `*/15`.
3. **The ops inbox is config, not a constant** — `CONTACT/OPS_INBOX_FALLBACK`. Read it, don't
   retype the literal.

---

## 3. THE DAY SHEET — a static daily view that advances

**Partly exists.** `dash_today_plan` and `dash_week_strip` are live reads, and zone `C1 · Today`
already renders "every session today, with whether its plan is ready"
(`src/lib/dashboard/registry.ts:54`). What is missing is the shape:

- **A NEXT UP card** — the single next item, prominent.
- **The view advances as the day progresses.** An item whose time has passed leaves the forward
  list. *"so shes not looking at a card that shows the day ahead and seeing things that already
  happened"*.
- **A separate list further down for what has already happened**, each row clickable — to add
  notes, or to act on the item.
- **Items are not only lessons.** Horse care services, and TASKS: supplements, medication, calling
  the vet. ⚠️ `horse_medications` and `horse_health_events` exist; **whether a task is a `booking`
  row or its own thing is an open design question** — see §7.

---

## 4. DISPOSITION AND THE ITEM LOG

Claire records, on any item: **complete · skipped · no-show** (client didn't show, **or the horse
isn't available**). **Cancelled** and **rescheduled** are recorded too, in the item's log, so that:
- looking at a FUTURE booking shows it is the product of a reschedule;
- looking BACK at an item shows it was cancelled / no-showed / the horse was unavailable / moved.

### ✅ The vocabulary is already in the schema
`bookings_status_check` admits **twelve** values:
`draft · available · unavailable · pending · pending_slot · pending_payment · confirmed ·
cancelled · expired · completed · scheduled · no_show`

**`completed` and `no_show` are already there.** Missing: **`skipped`**, and a way to distinguish
*client no-show* from *horse unavailable* — the owner named both under one word. Suggest keeping
`no_show` as the status and putting the REASON in the log entry, rather than minting two statuses.

### ⚠️ But only FOUR of the twelve have ever been written
Production, all 539 rows: `available` 494 · `scheduled` 43 · `cancelled` 1 · `draft` 1.
**Never once used: `pending`, `pending_slot`, `pending_payment`, `confirmed`, `unavailable`,
`expired`, `completed`, `no_show`.** The owner's *"the pending status isn't working"* is not a bug
in a working feature — **the states exist in the constraint and nothing ever moves a booking into
them.**

### The log
`status_events` exists and is the right home — it already carries `offering · document · account ·
order · fulfillment · lesson_plan` (1,142 rows). **It has no `booking` entity_type.** Adding one is
the cheapest correct way to get the item log, and it reuses a read surface the deal pages already
use rather than inventing `booking_status_log`.

---

## 5. THE CALENDAR — remove published open slots

> *"the calendar still shows a full list of all the open slots in green blocks, we need to remove
> this and just make the calendar open for booking by being empty"*

**Those green blocks are `publish_open_slots_all`**, called on every hourly cron run
(`api/calendar-reminders.ts`), publishing 4 weeks of hourly slots. Production:
**494 of 539 bookings are `status='available' AND is_flexible=true`**, spanning 2026-08-04 →
2026-09-20. That is 92% of the table, and it is all generated furniture.

### ⚠️ THIS SUPERSEDES A STANDING WARNING — read this
`docs/HANDOFF-OFFERINGDOCS-2026-08-24.md` §5.2b warns, about the calendar toggle decommission:
*"THE ONE THING THAT MUST NOT BE DISTURBED: `is_flexible` … it is the single most-used behaviour in
the table."* **That warning was based on those 494 rows, and this ruling deletes them.** The two
tasks must be sequenced together or the second will be reasoned about from a table that no longer
means what it meant. `is_flexible` on a *real* booking (the "no specific time" case in §5.2 below)
still matters; `is_flexible` as availability furniture does not.

### The new display rules
| State | How it shows |
|---|---|
| **open for booking** | **empty.** No row, no block, nothing published |
| **booked, specific time** | to anyone not involved: **unavailable**. No detail |
| **booked, no specific time** | **at the top of the day**, as an item happening that day |
| **confirmed** | changes **orange → green** |
| **complete** (Claire marks it) | **fades, stays clickable and editable** |

⚠️ **Retire the publisher and the rows, but check what reads `status='available'` first** — the
booking path (`book_open_slot`) takes a `p_booking_id`, i.e. it books an EXISTING published slot.
**Removing published slots removes the thing that function books.** The request path
(`request_open_time(p_starts_at, p_ends_at, …)`) takes a time directly and does not need one. So
this ruling likely retires `book_open_slot` as well — confirm before deleting (D32: keep the
function, remove the callers and the publisher).

---

## 6. PENDING AND APPROVAL — diagnosed, and the news is worse than "not working"

> *"it doesnt appear the pending status is working properly and likely the approval process for a
> request isnt working properly either"*

**Correct on both counts, and the cause is the same in each: the state machines were defined and
never driven.**

**Booking statuses** — eight of twelve never written (§4).

**Request line items.** `request_selections.state` is an enum `line_item_state` with **ten** values:
`received · in_review · approved_awaiting_claim · claimed_awaiting_completion · confirmed ·
declined · not_a_booking · withdrawn · expired · lapsed`.
**All 8 rows in production are `received`.** `approved_at` has never been set on any row.

Only three functions in the entire database touch that column:
- `derive_request_status` — **reads** it
- `reap_expired_holds` — expiry only
- `request_onboarding_categories`

**There is no approve function.** Nothing writes `in_review`, `approved_awaiting_claim`,
`claimed_awaiting_completion` or `confirmed`. Grep of `src/` and `api/` finds no approval surface
either — `request_selections` appears only in read paths (`LeadWorkDrawer`, `useOpenLeads`,
`IntakePage`, `api-intake`) and in `api/expire-holds.ts`.

**Requests themselves** are stuck too: `requests_status_check` admits
`new · contacted · invited · expired · converted`, and production holds **`new` 10, `contacted` 6**
— nothing has ever reached `invited` or `converted`.

⚠️ **A vocabulary mismatch on top of it:** `derive_request_status` returns **`'new'` / `'open'` /
`'closed'`**, and `requests.status` permits **none of `open`/`closed`**. Writing that function's
output into that column would violate the CHECK. Nothing calls it today — no DB caller, no UI
caller — so it is dead code carrying a third vocabulary. **This is another instance of trap §4.5,
one name with two meanings.**

**This is a build, not a repair.** Ruling 6 of OFFERINGDOCS depends on it — *"once we approve the
request and their offering is scheduled the docs get triggered"* — and the approval it names does
not exist yet. Documents currently trigger on the purchase `draft → open` transition instead.

---

## 7. OPEN QUESTIONS FOR THE OWNER

1. **What timezone is the barn in, and where does it live?** Blocks every time in §2.
2. **How precise must "1 hour prior" be?** Hourly cron gives up to an hour of slop. `*/15` costs a
   plan tier — worth it?
3. **Is a task (supplements, medication, call the vet) a `booking` row?** It has a day but often no
   time, no client, and no offering. Making it a booking gets the calendar and the day sheet free;
   giving it its own table avoids twelve more branches on `bookings.kind`. **Recommend: a booking
   with `kind='task'` and `is_flexible=true`** — it is the "no specific time, shows at the top of
   the day" case the owner already described, so the display rule is already specified.
4. **Does the 9am client email go to a client with MULTIPLE items that day** as one email? Assumed
   yes — one email, all their items.
5. **Client no-show vs horse unavailable** — one status with a logged reason, or two statuses?
   Recommend one.
6. **What wrote the 00:00–13:00 booking?** Needs finding before the row is touched.

---

## THE REACH

Claire's day sheet is the dashboard she already lands on; the next-up card and the past list are
zones on it, not a new page. Any item, anywhere it is listed — month view, week view, dashboard —
opens the same modal in place. `/app/calendar?item=<id>` keeps working for shared links.

## THE TELL

A calendar with nothing on Tuesday means Tuesday is bookable — no green blocks to read past.
Claire marks a lesson complete at 11:05 and it drops off the forward list, fades, and is still
there below to write notes against. At 07:00 the ops inbox has the day; at 09:00 each client has
theirs; an hour before each item both get the reminder — and no in-app reminder duplicates any of it.

## FLAGGED BEFORE STARTING

- **§0 first.** The modal is one change that answers three reports and makes the 12am booking
  reachable without touching the grid's hour range.
- **§5 and §5.2b of the OFFERINGDOCS handoff are one task, not two.** Deleting published
  availability changes the evidence the toggle decommission was reasoned from.
- **§6 is a build.** Do not schedule it as a bug fix; nothing about approval was ever wired.
- **Nothing here needs a new state vocabulary** — `bookings.status` and `line_item_state` are
  already rich enough. The work is drivers and surfaces, plus `skipped`.
