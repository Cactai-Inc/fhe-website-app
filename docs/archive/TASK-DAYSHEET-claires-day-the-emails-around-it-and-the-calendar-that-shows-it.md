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

### 0.1 AND IT IS A LARGE CENTERED MODAL, NOT A SIDE PANEL
**Owner, 2026-08-24:** *"the booking provisioning and view is always a right side panel and it
fucking sucks we need a large modal in the center of the screen."*

**Good news: it is already an overlay, so this is a container change, not a rewrite.**
`CalendarItemPanel.tsx:469-472`:
```
<div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={handleClose}>
  <div className="bg-cream w-full sm:max-w-md h-full …" onClick={e => e.stopPropagation()}>
```
`justify-end` + `sm:max-w-md` + `h-full` is what makes it a right-hand drawer **448px wide** — for a
form with roughly fifteen fields, which is why it feels the way it does. Centering it and widening
it is `items-center justify-center` and a real `max-w`.

**Copy the existing modal idiom rather than inventing one.** `AddHorseModal.tsx:39` is the
precedent already in the repo:
```
fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4
role="dialog" aria-modal="true"    // + outside-click guarded by e.target === e.currentTarget
```
⚠️ Note `CalendarItemPanel` has **no `role="dialog"` and no `aria-modal`** today — worth fixing
while the shell is being replaced.

⚠️ **Only FOUR files use the right-drawer overlay**: `CalendarPage`, `CalendarItemPanel`,
`CalendarSettingsPanel`, `TeamPage`. This is not a house style being overturned — it is a local
habit in the calendar. **`CalendarSettingsPanel` sits beside the item panel and should move with
it**, or the calendar will have one of each.

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

**Root cause — owner, 2026-08-24, and the data corroborates it:**

> *"the midnight booking was likely a typo or the 8am preset was changed to 12 and the am didnt
> change since there is a 12pm noon booking it seems most likely either of those two options are the
> explanation."*

**Everything on 2026-08-28 supports the 12 AM / 12 PM slip:**

| | midnight row | the noon row |
|---|---|---|
| starts | **00:00** | **12:00** |
| ends | **13:00** | **13:00** |
| offering | *2x Weekly Lessons* | *2x Weekly Lessons* |
| purchase | yes | yes |
| created | 2026-08-02 | 2026-08-03 |

**Both end at 13:00. Both are the same offering. Both carry a purchase.** The midnight row is
almost certainly the same intended 12:00–13:00 slot with the START entered as 12 **AM** — in a
`datetime-local` control, noon is `12:00` and midnight is `00:00`, one keystroke apart — and the
end time, being unambiguous in 24-hour form, came out right. It was re-entered correctly the next
day.

**So the row is a data-entry artefact, not a system fault**, and the fix is §11: make the time a
*selection* rather than something typed, so this class of error cannot be expressed. ⚠️ Still
confirm the two rows belong to the same client before deleting either — a duplicate is safe to
remove, a genuine second booking at the wrong time is not.

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
1. ~~**THERE IS NO TENANT TIMEZONE.**~~ **SETTLED, owner 2026-08-24:** *"all activity is rooted in
   pst, Los Angeles."* The VALUE is `America/Los_Angeles`. **Still store it as tenant config, not a
   constant** — no `time_zone` column exists on `organizations` or `org_settings` today, and
   `calendar-reminders.ts` hardcodes the zone inside `pacificHour()`. A tenant fact frozen into
   code is a TENANT FACT HARDCODED IN CODE; seed the setting to `America/Los_Angeles` and read it. Note
   "PST" is the winter abbreviation — the barn is on PDT for most of the year, which is exactly why
   the stored value must be the IANA zone name and never a fixed UTC offset.
2. ~~**Vercel cron granularity.**~~ **SETTLED, owner 2026-08-24:** *"just make it fire off at 1 hour
   prior based on every hour and give extra time always so it sends it 1.5 hours prior instead of
   30 min prior."* **Keep the hourly cron. Round the send time DOWN to the hour, never up** — the
   lead time may grow, never shrink.

   **The rule, stated so it can be implemented without re-deriving it:**
   > On the run at hour **H**, send the 1-hour reminder for every booking starting in
   > **[H+1, H+2)**.

   | Booking | Reminder sent | Lead |
   |---|---|---|
   | 10:00 | 09:00 | 1h 00m |
   | 10:30 | 09:00 | **1h 30m** (not 10:00 / 30m) |
   | 10:45 | 09:00 | 1h 45m |
   | 11:00 | 10:00 | 1h 00m |

   Lead time is therefore always ≥ 1 hour and < 2 hours. **Same rounding governs the 09:00 client
   email**: a booking before 10:00 moves the send to the hour at or before `T − 1h`, so an 09:30
   lesson is emailed at 08:00, not 09:00.

   ⚠️ **A booking created inside its own reminder window gets no reminder** — nothing fires between
   hours. Accept it (the 07:00 rundown and the day sheet both still show it), or send on create;
   do not silently assume it is covered.
3. **The ops inbox is config, not a constant** — `CONTACT/OPS_INBOX_FALLBACK`. Read it, don't
   retype the literal.

### ❓ QUESTIONS — §2
1. **A booking created inside its own reminder window gets no reminder** — nothing fires between
   hourly ticks. Accept it (the 07:00 rundown and the day sheet still show it), or send on create?
2. **Who counts as "the ops inbox"** when a second staff identity exists? Today one address gets
   everything. Is the 07:00 rundown always `hello@`, or per-instructor?

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

### ❓ QUESTIONS — §3
1. **What does "advance" mean exactly** — an item leaves the forward list at its START time, or at
   its END time? A lesson in progress is arguably neither ahead nor behind.
2. **Does the day sheet ever show tomorrow?** "The day's rundown" is today; at 6pm, is the next
   thing on it tomorrow's first item or nothing?

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

### ❓ QUESTIONS — §4
1. **Client no-show vs horse unavailable — one status with a logged reason, or two statuses?**
   Recommend one (`no_show` + reason), since the owner named both under one word.
2. **Does marking an item `completed` do anything beyond display?** Notes, credit consumption and
   billing all plausibly hang off it. Scope deliberately.
3. **Who may set a disposition — Claire only, or any staff?**

---

## 5. THE CALENDAR — remove published open slots

> *"the calendar still shows a full list of all the open slots in green blocks, we need to remove
> this and just make the calendar open for booking by being empty"*

**Those green blocks are `publish_open_slots_all`**, called on every hourly cron run
(`api/calendar-reminders.ts`), publishing 4 weeks of hourly slots. Production:
**494 of 539 bookings are `status='available' AND is_flexible=true`**, spanning 2026-08-04 →
2026-09-20. That is 92% of the table, and it is all generated furniture.

### ⚠️ THIS SUPERSEDES A STANDING WARNING — read this
`docs/archive/HANDOFF-OFFERINGDOCS-2026-08-24.md` §5.2b warns, about the calendar toggle decommission:
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

### ❓ QUESTIONS — §5
1. **Does retiring published slots retire `book_open_slot`?** It takes a `p_booking_id` — it books a
   slot that already exists. With no published slots there is nothing for it to book.
2. **What replaces it for a client self-booking?** `request_open_time(p_starts_at, p_ends_at, …)`
   takes a time directly and needs no slot — is that the whole answer?
3. **Do the 494 existing `available` rows get deleted, or left to age out?** They run to 2026-09-20.

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

### ❓ QUESTIONS — §6
1. **Which of the ten `line_item_state` values does the barn actually use?** Ten were defined and
   one is written. Approving may only need `received → approved → confirmed`, and the rest may be
   scaffolding to retire (D32: keep the enum, stop pretending it is a workflow).
2. **Is "approve the request" the SAME act as "open the order"?** §14.2 shows Rachel's order stuck
   in `draft`. If they are one act, this is one build; if two, the order of them matters.
3. **Who approves — Claire only, or CJ too?**

---

## 6b. NAME A HORSE NOW, CLAIM IT TO A RECORD LATER

**Owner, 2026-08-24:** *"for the horse section we should be able to write in the name of a horse and
claim it later for a horse record. right now its either select from the list or no horse lol"*

**Confirmed.** `CalendarItemPanel.tsx:698` and `:733` are both a bare `<select>` whose only escape
hatch is `<option value="">No horse</option>`. There is no free-text path, and
**`bookings` has exactly one horse column — `horse_id uuid`** — so there is nowhere to put a name
that is not yet a record. This needs a schema addition, not just a control change.

**The shape already exists twice in this codebase, and the second one is the right model:**
- `PartiesHorseCard` reaches `AddHorseModal` (built by TASK-PAMELA) — the *heavy* path: create the
  full record now. The owner is explicitly asking for the light one.
- `lookup_suggestions` — propose a value, resolve it later from a review queue. **Same shape.**
  ⚠️ Note the standing D13 gap: `lookup_suggestions` **has no review page**, so if this is modelled
  on it, the claim step must get a surface or it becomes another queue nobody can drain.

**Build:**
1. `bookings.horse_name text` alongside `horse_id` — a name with no record yet.
2. The control becomes select-or-type. `HorseIntakeForm` already has a `SelectOrOther` for height;
   reuse it rather than writing a third variant.
3. **The claim step**: on the horse record surface, an unclaimed name resolves to a real
   `horse_id`, and every booking carrying that name updates. This is the part that makes it worth
   doing — without it, the typed name is just a note.
4. ⚠️ **One field, two meanings, again** (trap §4.5): once both columns exist, every reader must
   decide what "the horse" means. **Rule to write down: `horse_id` wins when set; `horse_name` is
   display-only and never an authority.** Anything that gates on a horse record — care services,
   medications, `ensure_horse_documents` — must keep requiring `horse_id`.

**Also carries a bare horse select, same treatment:** `CreateModal.tsx:223`,
`PartiesHorseCard.tsx:237`. `ScheduleSessionForm` and `AgreedLessonPanel` should be checked when
the control is built — both reference `horse_id` but their pickers were not read for this note.

---

## 7. THE QUESTION INDEX — every open decision, by section

⚠️ **Questions live UNDER the section that raised them** (owner, 2026-08-25). This is the index, not
the content — each `❓ QUESTIONS` block holds the detail and the evidence behind it.

| § | Subject | Open |
|---|---|---|
| **2** | The emails | 2 — reminder gap inside the tick, who the ops inbox is |
| **3** | The day sheet | 2 — what "advance" means, whether tomorrow ever shows |
| **4** | Disposition & the log | 3 — no-show vs horse unavailable, what `completed` triggers, who may set it |
| **5** | Removing open slots | 3 — `book_open_slot`'s fate, what replaces self-booking, the 494 rows |
| **6** | Pending & approval | 3 — which states are real, is approve == open the order, who approves |
| **8** | The scheduling panel | 3 — what "relevant" means, filter vs order, draft-or-open |
| **14** | The monthly cycle | 4 — 30 days' notice, dunning vehicle, non-payers, the lead-alert email |
| **15** | Changing an ordered offering | 3 — price follows or holds, paid orders, recurring days |
| **16** | Two surfaces, one job | 2 — what `Admin.tsx` uniquely does, does TASK-ROSTER stand |
| **18** | The offerings & paperwork pickers | 4 — where `JUMPER_TRAINING` sorts, does the order apply elsewhere, does the gate apply to existing clients, does PaperworkEditor get rows too |
| **17** | Surfaces & pricing | 7 — lead tabs, route vs modal, the other three cadences, +$20 on weekly, which rate anchors, what "unlock" means when late, are `products`/`tiers` dead |

**Answered and closed** — kept for the record, do not re-ask:
timezone (`America/Los_Angeles`) · reminder cadence (hourly, rounded down, `[H+1, H+2)`) · one email
per client per send · what wrote the 00:00 booking (a 12 AM/PM slip) · where an unclaimed horse name
is claimed (§12) · is a task a booking row (§9.1, Claire decides) · does `med_schedule` generate
tasks (**no** — §9.3).

---

## 8. THE SCHEDULING PANEL ASKS ITS QUESTIONS IN THE WRONG ORDER

**Owner, 2026-08-24:**

> *"the repeat weekly is weird … first the primary selection is "just once" which literally reads
> repeat this one time. but more importantly we are being asked to select a product before we
> select the client and the inverse is the right approach. we select a client, then we see what the
> client has available … we only show horse care services for clients with a horse … we dont need
> to add any text to the ui to explain this, its self evident … it should honor our rules not
> ignore them."*

### 8.1 "Repeat weekly for → Just once"
Confirmed, `CalendarItemPanel.tsx:784`. The label is **"Repeat weekly for"** and the default option
is `'1' → 'Just once'`, so the control reads *"repeat weekly for: just once."* It is the first
value in the list, so it is also what everyone sees.

### 8.2 The order is inverted — and the code proves it
Render order today: **Start · End · Offering (`:512`) · Client (`:526`) · Assign to purchase
(`:559`) · … · Horse (`:697`)**.

The dependency runs the wrong way and the code says so out loud — the CLIENT field's own label is
computed from the selected OFFERING:
```
Client{selectedOffering?.segment !== 'horse' ? ' (required to book)' : ''}   // :527
```
You cannot know whether a client is required until a product is chosen. That is backwards.

**The order the owner wants: client → what that client has → the item.**

### 8.3 Nothing is filtered by the client. Anything.
Three separate reads, all client-blind:

| Read | What it fetches | Filtered by client? |
|---|---|---|
| `fetchOfferings()` `:143` | `all.filter(o => o.segment === 'rider' \|\| o.segment === 'horse')` | **no** |
| `listScheduleHorses()` `api-lessons.ts:841` | every row in `horses` where `deleted_at is null` | **no** |
| `fetchClientPurchases(clientId)` `:174` | `client_purchases(p_client_id)` | yes — but only feeds "Assign to purchase", AFTER the offering is already picked |

So **all 32 rider + horse offerings** are offered for every client, and **every horse in the
system** is offered on every booking. The one client-aware read exists and is used for the wrong
job.

### 8.4 What to build
1. **Client first.** Move the client field above the offering field; everything below reacts to it.
2. **Then show what that client HAS.** `client_purchases(p_client_id)` is already the seam —
   surface credits and any standing/monthly plan *as the primary choice*, not as a post-hoc
   "assign to purchase" dropdown.
3. **Filter the offering list to what is relevant to that client.**
4. **If the client has no matching paid offering, the booking GENERATES it.** Owner: *"if they dont
   have a paid offering purchased that matches the selection … we generate that offering by
   creating the scheduled booking. if they have that offering we see it and we are using what they
   purchased."* One act, two paths — consume an entitlement, or create the obligation.
   ⚠️ This is the same seam as OFFERINGDOCS ruling 6 (documents arrive when the order opens). A
   booking that generates a purchase must open that order through the SAME spine, or it becomes a
   second write path (D18) and the paperwork silently does not fire.
5. **Horse care only for clients with a horse.** `offerings.segment = 'horse'` is the set to hide
   (16 of the 32). **No explanatory text** — the owner was explicit.
6. **Filter the horse picker to that client's horses too.** Same rule, same reason.

### 8.4b ✅ THE RULE THE OWNER WANTS HONOURED IS ALREADY ENFORCED — one layer down
Owner: *"it should honor our rules not ignore them."* **The rule exists.**
`assert_horse_care_eligible(p_contact_id, p_horse_id)` raises unless there is a horse AND that
contact holds a `RELEASE_HORSE_CARE` and a `HORSE_EMERGENCY_VET` for **that** horse. It is called by
`book_open_slot` and `attach_booking_horse`.

**So the write layer already refuses what the owner described. The SURFACE ignores it** — the
offering list is unfiltered, so staff can pick a horse-care offering for a horseless client and only
meet the wall on save. §8.4's filtering is therefore not a new rule; it is **making the surface
agree with a rule the database already enforces**, which is why no explanatory text is needed.

### 8.5 ⚠️ "HAS A HORSE" IS NOT ONE COLUMN
`horses` carries **both** `current_owner_contact_id` **and** `lessee_contact_id`. **A lessee has a
horse in their care without owning it** — gate on ownership alone and every lease client loses
access to care services. Use both.

Also `horses.owner_name_text` exists — a free-text owner name for a horse whose owner is not yet a
contact. **That is §6b's pattern already in the schema, in the mirror direction**, and it is the
precedent to copy rather than invent.

⚠️ **Scale check before building the gate:** there is exactly **ONE horse** in production and it
has an owner. So this rule currently hides horse services from every client but one. That is
correct behaviour and it will look like a bug — verify against the rule, not against the screen.

### 8.6 Weekly recurring belongs on the client card, not here
Owner: *"this is not the surface for setting a weekly lesson, though its not a bad option, the
primary option is the client card where they or us can set their weekly riding day and time which
then appears automatically on the calendar until its renewed at the end of the month for the next
month. if we do want to repeat a lesson it would be because they have credits or they intend on
purchasing a punch card."*

**The machinery already exists and is in the wrong place.** `CalendarItemPanel.tsx:594–670` already
holds the standing-weekly editor — `fetchClientMonthlyPlans`, `setRecurringDays`,
`setRecurringPlanEnd`, `generateThisMonth`, and a monthly plan with `recurring_days` /
`weekly_frequency`. `my_standing_slots` is the member-side read.

**So this is a MOVE, not a build:**
- the standing weekly day+time moves to the **client card**, settable by staff or by the client;
- it materialises on the calendar for the month, renewed at month end;
- the panel keeps only a repeat that means **credits or a punch card** — and it must be worded as
  that. "Repeat weekly for → Just once" goes.

⚠️ TASK-WALK2 recorded the standing-slot recurring feature as **unreachable on two identities**.
Moving it to the client card is likely the fix for that as well — check before treating them as
separate work.

### ❓ QUESTIONS — §8
1. **What makes an offering "relevant" to a client?** Held entitlement is obvious; is a lapsed one
   relevant? Is an offering they have never bought but could?
2. **Should the offering list be filtered, or ordered?** Hiding is decisive but invisible; sorting
   what they hold to the top keeps everything reachable. The owner said filter — confirm hiding
   rather than de-emphasising.
3. **When a booking GENERATES a purchase, is it created `draft` or already open?** Given §14.2, a
   new draft nobody opens would repeat the exact defect.

---

## 9. WHERE A TASK COMES FROM — and the capability that is already half-built

**Owner, 2026-08-24, answering "is a task a booking row or a day":**

> *"whether a task is a booking row or a day is determined by claire which is informed by the
> requirements setforth by the client in the offering purchase conversation, unlikely to codified
> from the purchase but this is where we can either add that capability to certain purchases or
> contracts capturing it can use the right tokens and structured fields so that the information can
> be utilized rather than just read by the contract parties."*

**Two rulings in one sentence.**

### 9.1 Timed vs day-level is a HUMAN decision, not a derived one
Claire decides, informed by what the client asked for. **So do not build a rule that infers it.**
One record type with an optional time — `kind='task'`, and the existing `is_flexible` carrying "no
specific time", which is already exactly the "shows at the top of the day" case in §5. Claire's
choice is a field she sets, and it is changeable afterwards.

### 9.2 ⚠️ THE STRUCTURED-FIELD CAPABILITY ALREADY EXISTS. IT IS ONLY EVER READ AS PROSE.

The owner proposes *"the right tokens and structured fields so that the information can be utilized
rather than just read by the contract parties."* **That machinery is built.** Verified:

- **`contract_fields.structured jsonb`** is a real column, and **`set_field_structured(p_document_id,
  p_field_key, p_structured jsonb)`** is a live RPC.
- **`contract_field_defs.input_kind` already has 18 kinds, and four of them are structured
  capture** — and two are precisely what this task needs:

| `input_kind` | Field | What it captures |
|---|---|---|
| **`med_schedule`** | `TXN.MEDICATIONS` — *"Medications and supplements"* | **the supplement/medication regimen** |
| **`week_grid`** | `TXN.DAYS_USED` — *"Reserved days of use"* | **a weekly day grid** |
| `fee_schedule` | `TXN.LEASE_FEE` | payment cadence |
| `contacts_list` | `TXN.CO_OWNERS` | people |

`med_schedule` stores, per item:
```
{ medItems: [ { name, dose, schedule, administer_party, order_party, cost_party, …_note } ] }
```

**And every single consumer turns it back into prose.** The readers of `structured` are
`compose_med_schedule`, `compose_field_prose`, `compose_pair_cost`, `compose_reveal_text`,
`location_full_label`, `remerge_contract_from_fields`, `recompose_document_fields`,
`contract_document_detail` — **all of them compose document text. Nothing consumes a structured
field operationally.** A lease can state exactly which supplements a horse gets, who administers
them and who pays, and none of it reaches Claire's day.

**That is the owner's sentence, exactly: captured, rendered, never utilised.** ⚠️ But see §9.3 —
this is an observation about the mechanism, **not a licence to wire every structured field to an
operational consumer.** Only one field has earned that, and the medication field explicitly has
not.

### 9.3 ⚠️ ONE CONNECTION, NOT TWO — a correction

**An earlier draft of this section proposed generating Claire's daily supplement/medication tasks
from `TXN.MEDICATIONS`. THAT IS WRONG and the owner corrected it, 2026-08-24:**

> *"we dont have an offering in horse care that involves giving supplements or medication, we
> incorporate that into the lease agreements as a field to provision because it needs to be and we
> accomodate those requests where we feel comfortable in combination with exercise purchases. but
> we dont expressly offer it and it cant hurt to have it in writing but it would be in a notes field
> and only AI can make use of that and AI is a v2 platform feature."*

**Confirmed against the catalog.** The horse segment offers exactly three services —
`HORSE_CLIPPING`, `HORSE_EXERCISE`, `HORSE_TRAINING`. **There is no medication or supplement
offering.** It is accommodated where the barn is comfortable, alongside an exercise purchase, and
it is not sold.

**So:**
- **`TXN.MEDICATIONS` stays a written lease provision and generates NOTHING.** It exists so the
  arrangement is in writing. It is a **notes field**, and *"only AI can make use of that and AI is
  a v2 platform feature."*
- **Supplement/medication items on Claire's day sheet are CLAIRE-CREATED**, like any other task —
  consistent with §9.1, where the timed-vs-day-level call is hers. They are not derived from a
  purchase (there isn't one) and not auto-generated from the contract (deliberately).
- ⚠️ **Do not build a med_schedule → task generator.** It would manufacture obligations the barn has
  not sold and does not want to be held to.

**The connection that DOES survive:**

**`TXN.DAYS_USED` → the standing weekly slots in §8.6.** The lease's *"Reserved days of use"* is
already a `week_grid`, and §8.6 wants a standing weekly day+time to materialise on the calendar for
the month. **Same data, never consumed. Do not build a second weekly-schedule capture.** This one is
a reserved entitlement the client actually bought, which is exactly why it is different from the
medication field.

### 9.4 ⚠️ THREE HONEST CAVEATS
1. ~~The cadence inside `med_schedule` is free text.~~ **MOOT — see §9.3.** Nothing generates from
   it, so the prose `schedule` sub-field is fine as it is. Left recorded only so nobody
   "fixes" it for a consumer that must not exist.
2. **`contract_fields` has zero rows in production — but that is NOT "unproven".** ⚠️ **An earlier
   draft of this caveat said the engine was untested against real data. That was wrong, and the
   owner caught it.** The lease templates are authored and live:

   | Template | Kind | Version | Active | Field defs |
   |---|---|---|---|---|
   | `HORSE_LEASE_V2` / `_FULL` / `_SIMPLE` | `HORSE_LEASE` | 3 | yes | **114 each** |
   | `HORSE_SALE_V2` | `HORSE_SALE` | 1 | yes | 65 |
   | `HORSE_BILL_OF_SALE` | `HORSE_BILL_OF_SALE` | 1 | yes | 48 |

   And lease documents **were issued and exercised**: `status_events` holds **236 events pointing at
   222 distinct documents**, while only **67 documents exist**. So roughly **155 documents were
   created and later hard-deleted**, between 2026-07-26 and 2026-08-22.
   `contract_fields.document_id` is **`ON DELETE CASCADE`**, so purging those documents took their
   field values with them.

   **The accurate statement:** the engine has been exercised; there is simply **no lease document in
   production right now** to read a live `structured` value from. Anything built on it needs a
   freshly issued lease to test against — which is a fixture problem, not a maturity problem.
   ⚠️ Do not confuse `contract_field_defs` (**667 rows** — the authored definitions) with
   `contract_fields` (**0 rows** — per-document values). Conflating the two is what produced the
   wrong claim.
3. **The purchase side is NOT built and the owner said so** — *"unlikely to codified from the
   purchase."* Do not build purchase-side requirement capture on spec. **The contract path is the
   one with the machinery**; if certain purchases later need it, they can reuse the same
   `structured` shape rather than inventing a parallel one.

### 9.5 What this makes the task, concretely
- Claire accepts a requirement (from a contract's structured field, or from a conversation she
  records herself) and it becomes a recurring task, timed or day-level **as she chooses**.
- The document remains the source of the obligation; the task is the operational instance —
  the same relationship the offering already has to a booking. **Do not copy the requirement into
  the task as free text**; point at the field so an amended contract changes the tasks.

---

## 10. DURATION EXISTS NOWHERE — the calendar draws every booking the same size

**Owner, 2026-08-24:** *"the calendar still shows bookings as 30 minutes when they should show 90
minutes for an evaluation lesson and 60 minutes for all other lessons."*

**Three separate gaps, and the DATA is not one of them.** Production booking lengths:
`60 min × 537 · 180 min × 1 · 780 min × 1` (the last is the §1 midnight row). Every real booking is
already stored as an hour. Nothing is 30 minutes.

### 10.1 The week grid never reads `ends_at`
`CalendarPage.tsx:585–608`. The grid is a table of **hour cells**, each `min-h-[44px]`, and an item
renders as a `<button>` *inside* one cell, sized by its own text padding (`text-[11px] py-1`) —
roughly 22px in a 44px row. **That is why a 60-minute booking looks like 30 minutes: it is drawn as
a fixed chip in its start hour, and duration plays no part in rendering at all.**

⚠️ **This is the SAME defect as §1's "a booking spanning 13:00 draws in no row."** `itemsFor(day,
hour)` matches on `s.getHours() === hour` and nothing else. **Proportional-height rendering fixes
both** — an item positioned by its start offset and sized by its length occupies every hour it
actually spans. Do not fix these separately.

### 10.2 ⚠️ `offerings` HAS NO DURATION COLUMN
Checked every column: the only match for duration/minutes/length is **`price_min`**, which is a
price. **"90 minutes for an evaluation, 60 for everything else" cannot be expressed anywhere in the
system today.** This is a schema addition, not a display fix.

### 10.3 The panel hardcodes one hour and never reconsiders
`CalendarItemPanel.tsx:90` — `new Date(initialStart).getTime() + 3_600_000`. The end defaults to
start + 1h, and **it does not react when the offering changes.** Picking the evaluation lesson does
not make it 90 minutes.

### 10.4 What to build
1. **`offerings.duration_minutes`**, owner-editable (D21 — an algorithm ships with an editor).
   Evaluation = 90, other lessons = 60, and every other service gets its own honest number rather
   than inheriting an hour.
2. **The panel derives the end time from the chosen offering**, still overridable by Claire — she
   sets the exception, the offering sets the default. Order matters here: this only works once §8
   puts the offering selection ahead of a client-filtered list.
3. **The grid renders by duration** — position by start, height by length, spanning hour rows. Same
   change that makes §1's multi-hour booking visible.

### 10.5 A hack this retires
`Onboarding.tsx:98` identifies the evaluation lesson by **regex on its NAME**:
```
(o.service_type ?? '') === 'RIDING_LESSON' && /evaluation/i.test(o.name ?? '')
```
That is a TENANT FACT HARDCODED IN CODE, and it silently stops working the
day someone renames the offering. **Once duration and the evaluation's special standing come from
columns, this regex should go.** Do not add a second name-matcher for the 90 minutes.

⚠️ **`publish_open_slots_all(p_slot_minutes := 60)` also hardcodes an hour**, but it is being
retired by §5 — do not "fix" it, delete it.

---

## 11. THE TIME PICKER — a selection, not a typed value

**Owner, 2026-08-24:** *"the time selection should be a dropdown list of the 30 minute increments a
person can choose and it should account for what is on the calendar and the duration of the
booking."*

**Today it is `<input type="datetime-local">`** — `CalendarItemPanel.tsx:500` (Start) and `:505`
(End). Two free-form datetime controls, no increments, no awareness of anything. That is what
allowed §1's midnight row, and it is also why the end time is a second thing to get wrong rather
than a consequence of the first.

### What to build
1. **Date, then a start-time dropdown in 30-minute increments.** Not a typed time. 12 AM stops
   being one keystroke from 12 PM because neither is typed.
2. **The end time is DERIVED from the offering's duration** (§10.4), displayed, not entered.
   Claire can still override it — she sets the exception; the offering sets the default.
3. **Offer only start times that actually fit.** A slot is offered when the booking's full duration
   is free from it. A 90-minute evaluation is not offered at a time where only 60 minutes are open.
4. **Bound the list by business hours** — the same `openHour`/`closeHour` the grid uses
   (`CalendarPage.tsx:305`), with an explicit way to schedule outside them rather than the current
   situation where out-of-hours bookings can be created but never seen (§1).

### ⚠️ THIS DEPENDS ON TWO OTHER SECTIONS — build them first
- **§10.4 `offerings.duration_minutes`.** "Account for the duration" is not implementable while
  nothing records a duration. This is the third section that needs that column; it should be built
  once, early.
- **§5, retiring published open slots.** "What is on the calendar" must mean *real* bookings. While
  494 generated `available` rows exist, every hour of every day already looks occupied, and a
  collision check would refuse everything.

### The payoff worth naming
This is the one item on the list that makes a whole class of defect **unexpressible** rather than
merely fixed. §1's booking is not a bug in code anyone wrote — it is a control that accepted a
value nobody meant. A dropdown of valid, non-colliding, duration-aware start times cannot produce a
13-hour lesson at midnight.

---

## 12. CLAIMING, IN BOTH DIRECTIONS — and TWO OF THE THREE PARTS ALREADY EXIST

**Owner, 2026-08-24:**

> *"the unclaimed horse name gets claimed when a horse is being added to an account. you can pick it
> from a list of horses (which should only show the names of horses that arent assigned to someone,
> and to prevent a horse getting locked to a person automatically, i need to be able to change the
> owner from the horse record)"*
> *"likewise i can select the owner of a horse record that lives as a name only"*

Two mirrored claims, and the schema already has both name-only columns:
`bookings` needs a horse name with no record (§6b — **not built**), and
**`horses.owner_name_text` already exists** — an owner name with no contact.

### ✅ 12.1 ALREADY BUILT — do not spec these, go and look at them

**"I need to be able to change the owner from the horse record."** Built.
`HorseRecordsPage.tsx:184` renders, in edit mode:
```
<option value="">— unassigned{r.owner_name_text ? ` (${r.owner_name_text})` : ''}</option>
```
followed by the full contacts list. Writes go through `staff_assign_horse_party(p_horse_id,
p_role, p_contact_id, …)`, never a direct table write, and that RPC sets `current_owner_contact_id`
or `lessee_contact_id` depending on the role.

**"Likewise I can select the owner of a horse record that lives as a name only."** Same control —
that is exactly what the `— unassigned (owner_name_text)` option is for. A horse whose owner is a
bare name shows that name in the picker, and choosing a contact resolves it.

⚠️ **So a horse is already never locked to a person.** The ownership ledger is
`horse_relationships`, edited by ending the old row and recording the new one, so history is
preserved rather than overwritten. **If this is not discoverable, the defect is reach, not
capability** (D17) — check the horse record actually offers edit mode where Claire expects it
before building anything.

### ❌ 12.2 NOT BUILT — the two real gaps

**1. No horse picker filters to unassigned horses.** Checked every function: the only one containing
`current_owner_contact_id IS NULL` is `generate_document`, and that is for a merge token.
- `listScheduleHorses()` (`api-lessons.ts:841`) — every horse in the org, no filter at all
- `my_listable_horses` — staff see everything; members see only horses they own or lease
- `NewContractPage.tsx:386` — lists all horses, *labelled with the current owner's name*

So "only show the names of horses that aren't assigned to someone" needs a new, filtered read at
the point a horse is added to an account: `current_owner_contact_id IS NULL AND lessee_contact_id
IS NULL`.

**2. `bookings.horse_name` does not exist** (§6b). The booking-side half of the claim — naming a
horse before it is a record — has nowhere to store the name.

### 12.3 The rule to write down before either is built
⚠️ **One field, two meanings** (trap §4.5), and it now applies on both sides:
- **`horse_id` wins when set; `horse_name` is display-only and never an authority.**
- **`current_owner_contact_id` wins when set; `owner_name_text` is display-only and never an
  authority.**

Anything that GATES on a horse or an owner must require the id. In particular
**`assert_horse_care_eligible`** (see §8) already refuses a care booking without a horse *and*
without that contact's `RELEASE_HORSE_CARE` and `HORSE_EMERGENCY_VET` on that horse — a name must
never satisfy it.

---

## 13. "RESERVED" — the read already says staff; the label never asks

**Owner, 2026-08-24:** *"the calendar bookings still show reserved instead of the client name and
activity (week and month view)."*

**This is four lines of UI, and the server is already doing the right thing.**

`calendar_free_busy` has a **staff branch that returns full detail on every item** — `client_id`,
`horse_id`, `offering_id`, `purchase_id`, `price_amount`, `notes`, the lot. And it deliberately
stamps that branch:
```
'is_mine', false, 'mine_role', 'staff'
```

`itemLabel` (`CalendarPage.tsx:126-137`) then branches on **`is_mine` alone**:
```
if (item.is_mine) return item.kind === 'lesson' ? 'Your Riding Lesson' : 'Your session';
return 'Reserved';                                    // ← staff land here, every time
```

**`mine_role: 'staff'` is the exact discriminator required, and the UI never reads it.** The privacy
rule (D25 — *"booking" is internal taxonomy and must never appear on a chip*) was written for
clients and silently applied to everyone, so Claire sees "Reserved" on her own barn's calendar.

### What to build
1. **A staff branch in `itemLabel`** keyed on `mine_role === 'staff'`: client name + activity.
2. ⚠️ **The staff payload carries IDs, not names.** `client_id` and `offering_id` come back as uuids
   and `CalendarPage` does not load client or offering lists (only `listStableHorses`).
   **Recommend adding `client_name` and `offering_name` to the STAFF BRANCH of
   `calendar_free_busy`** — one place, privacy untouched, no client-side N lookups, and it is the
   branch that is already allowed to see them.
3. **Same label function serves both grids** — `WeekGrid` and `MonthGrid` both call `itemLabel`, so
   this fixes week and month at once.
4. ⚠️ **Do not weaken the non-staff branches.** *"Reserved" is CORRECT for someone not involved* —
   §5 says a booked slot shows as unavailable to anyone not involved. The bug is only that **staff
   are always involved** and were never given a branch.

⚠️ `itemLabel` also returns `'Open'` for `status='available'` — **that is the green-block furniture
§5 retires.** When those 494 rows go, that branch goes with them.

---

## 14. THE RACHEL PAGE CASE — a lead, an order nobody was told about, and the monthly cycle

Owner, 2026-08-24, on a real lead. Three separate problems; the third is the largest piece of
unbuilt work in this document.

### 14.1 THE LEAD SURFACE — everything he wants is already captured

> *"what i really need to see is their for[m] submission and contact information and contact
> preference. two clicks and im either calling, texing or email and fully equipped."*

**The request row already holds all of it.** Rachel Page, `requests` id `33517d94…`:

| Field | Value |
|---|---|
| `contact_method` | **`text`** ← the contact preference, captured |
| `contact_phone` | (858) 354-2941 |
| `contact_email` | msrachelpage@gmail.com |
| `notes` | the full form submission — her history, goals, riding experience, preferred times, days |
| `proposed_times` | `[{days: "Sun, Fri, Sat", time: "Weekdays AM & PM · Weekends AM & PM"}]` |
| `status` | `new` |

So this is **a rendering job, not a capture job**. `LeadWorkDrawer` shows an overview; it should
lead with the submission, the contact details, and the preference, with `tel:` / `sms:` / `mailto:`
actions on them. *"Two clicks"* is the acceptance test.

⚠️ **ONE REAL DEFECT UNDERNEATH IT: the preference never reaches the contact record.**
`requests.contact_method = 'text'`, but **`contacts.preferred_contact` is EMPTY** for her. The
answer is captured on the enquiry and never propagated, so the moment she becomes a client the
preference is lost. Fix the propagation, not just the drawer — otherwise the drawer has to read the
request forever.

### 14.2 THE ORDER NOBODY WAS TOLD ABOUT — two independent causes

> *"it appears she placed an order, thats great, i didnt notice any big notification, no email
> alert, nothing, telling me we got an order for a monthly subscriber riding weekly 2x."*

**Cause 1 — there is no such notification. At all.** Every notification kind ever written:
`party_signed · document_executed · request_new · payment_received · contract_in_review ·
booking_reminder_1h/2h · booking_time_requested · contract_cancelled · contract_terminated ·
contract_termination_requested · purchase_unpaid · contract_locked · insurance_unresolved ·
member_hi`. **Nothing for an order being placed.** The alert he expected does not exist to fail.

**Cause 2 — her order never opened.** `purchases 3947a545…`, Rachel Page, **£880 · `2x Weekly
Lessons` · `status = 'draft'` · `payment_status = 'unpaid'`**, created 2026-08-22, and it is
**the only purchase in the system that came from a request** (`request_id` set). Every other order
is `awaiting_payment`.

That matters because both order triggers test the same thing:
```
IF coalesce(OLD.status,'') <> 'draft' OR coalesce(NEW.status,'') = 'draft' THEN RETURN NULL;
```
`purchases_assign_documents` and `purchases_mint_credits` both fire only on `draft → not-draft`.
**Her order is still draft, so she got no documents and no credits either.** ⚠️ This is the same
seam as OFFERINGDOCS ruling 6 — **the request→order path leaves the purchase in `draft` and nothing
opens it.** That is very likely the same missing act as §6's non-existent approval.

✅ **The LEAD alert did work** — two `request_new` notifications for her on 2026-08-22, both
`emailed_at` set. ⚠️ But only **2 of 12** `request_new` rows have ever been emailed, so the
delivery path is not reliably working for everyone. Worth a look while in here.

**Build:** an `order_placed` notification + email on the act that opens the order, through the same
spine as everything else (D18).

### 14.3 THE MONTHLY CYCLE — the copy is wrong and the cycle is unbuilt

> *"we say we need 30 days notice for cancellation and we collect payment every month the day prior
> to the start of the next month, so we need to set it to fill out the month ahead when payment is
> confirmed…"*

**First, the copy is describing behaviour that does not exist.** `StandingSlotPicker.tsx:326`:
> *"every week is put on the calendar for the next three months, rolling forward as it is read"*

**There is no three-month generation anywhere.** `set_recurring_days` re-trues **this month only**
(`period_start = date_trunc('month', current_date)`), and the generator is literally named
`_generate_plan_month`. **The engine is already month-shaped — the sentence is the lie.** Rewrite it
to describe the cycle below.

#### The cycle to build
| # | When | What |
|---|---|---|
| 1 | payment confirmed | **the month ahead is materialised** on the calendar |
| 2 | 3 days before month end | **email the client**: payment due within 3 days |
| 3 | 3 days before → onward | **in-app countdown**: "due in 3 days" → "due in 2" → **"due today"** → **"past due by N days"** |
| 4 | day prior to month start | **email the client again**: due today |
| 5 | client declares payment | **notify US to check** |
| 6 | always | **a list of monthly riders who owe payment**, so nobody is chased by memory |

#### Booking status through the cycle — this is what makes it visible
- **unpaid** → the client's scheduled lessons appear as **`pending_payment`**, NOT reserved
- **payment confirmed** → they become **`confirmed`** and reserved
- **pending** → the client **may change their lesson schedule**
- **past due** → they **may not**

✅ **`pending_payment` and `confirmed` are ALREADY in `bookings_status_check`** — see §4. They are
two of the eight values nothing has ever written. **This ruling is what finally drives them.**

#### ⚠️ What this needs that does not exist
1. **A billing period on the plan.** Nothing records "paid through". `mint_recurring_allotments`
   runs daily (`20 8 * * *`) but mints entitlement, it does not bill.
2. **`purchase_unpaid` exists as a notification kind and has fired exactly ONCE.** It is the nearest
   thing to a dunning notice and is effectively unused — check whether it is the right vehicle
   before minting a new kind.
3. **The client's "I paid" declaration already exists** — `report_my_payment`,
   `confirm_payment_claim`, `decline_payment_claim`, and `purchases.client_claim_status`
   (`none · pending · confirmed · declined`). **Item 5 is a surfacing job, not a build.**
4. **30 days' notice for cancellation is stated and nowhere enforced.** It needs a home — the plan
   record, and the contract wording.
5. ⚠️ **Nothing may re-materialise a month that is already paid.** The copy's *"changing it
   re-materialises from today; weeks already past are untouched"* must become *"…and weeks already
   PAID are untouched"*, or a schedule change silently rewrites a month the client has bought.

### 14.4 Sequencing
14.1 is small and independent — do it first. 14.2 is blocked on the same missing act as §6
(nothing opens an order). 14.3 is the big one and depends on §4's disposition work, because
`pending_payment → confirmed` is the same status machinery.

### ❓ QUESTIONS — §14
1. **Where does "30 days' notice" live and what enforces it?** Stated, nowhere in the system.
2. **Is `purchase_unpaid` the right vehicle for dunning** (it exists and has fired exactly once), or
   does the countdown need its own notification kind?
3. **What happens to a rider who never pays?** The countdown extends forever unless something ends
   it. Does the plan lapse, and after how long?
4. **Does the lead-alert email path need fixing at the same time?** Only 2 of 12 `request_new` rows
   have ever been emailed.

---

## 15. THE ORDERS TAB — five revisions BUILT, one still needs a decision

Owner, 2026-08-25, looking at Rachel Page's record. **Five are done and on this branch; the sixth
is blocked on a real question.**

### ✅ Built
1. **"+ Attach offering" → "+ Add offerings."**
2. **The order is first, not last.** It sat under a standing-time editor for a plan the reader had
   not been shown yet.
3. **Line items render under their order** — requires migration `20260825T0900`, see below.
4. **The add control is an outline that holds a line item's space**, with a square, text-sized,
   unfilled button at its left, in place of the filled dark-green pill. That pill (`TabCreate`) had
   exactly one caller and went with it.
5. **Square corners** on the standing-slot section. ⚠️ The design system was already on the owner's
   side: **`.form-input` and `.btn-primary` carry no border radius at all**, so the rounded box was
   the outlier and the sharp controls inside it were correct.
6. **The modal is one fixed size** (`h-[85vh]`), no longer `max-h-full`. It was re-sizing to each
   tab's content and re-centring under the cursor on every tab change.

⚠️ **`contact_dossier` returned NO line items** — `orders` was purchase-level only (id, code,
status, amount, payment_status, method, created_at). The tab rendered `$880.00 · PUR-000302`
because that was genuinely all it had, and **there was nothing to hang a per-item control on.**
Migration `20260825T0900` adds `items` (label, quantity, price, unit, `config_kind`,
`service_type`, `voided_at`). Additive, applied and verified on production. **Voided lines are
returned, not filtered** (D32) — the UI decides how to show a cancelled line.

### ❌ NOT built — "we need to be able to change the offering they ordered"
**There is no RPC that can do it, and the obvious composition is wrong.**
- `void_purchase_item(p_item_id, p_reason)` exists and is correct — it sets `voided_at`, never
  deletes ("what was asked for is evidence"), logs a status event, and re-runs
  `_recompute_purchase_total`, which voids the ORDER if that was the last live line.
- **But `attachOfferings` creates a NEW PURCHASE**, not a line on the existing one. So
  void-then-attach would leave the record showing a cancelled order and a second order — not a
  changed one.

**The missing piece is `replace_purchase_item(p_item_id, p_offering_id)`** (or
`add_purchase_item(p_purchase_id, …)`), and it carries questions that are the owner's:
1. **Does the price follow the new offering, or is the agreed amount held?**
2. **What happens on a PAID order?** Rachel's is `draft`, so nothing has minted. On a paid order a
   swap moves money and credits.
3. **Recurring plans carry a standing time** (`set_recurring_days` writes against the purchase
   item). Changing the offering under a live weekly plan must decide what happens to the days
   already chosen — and to any month already materialised.

⚠️ **Do not compose this out of void + attach to ship it sooner.** It would create a second order
on the record every time, which is precisely the confusion this tab was being cleaned up to remove.

---

## 16. WHY THE LEAD MODAL BEATS THE CLIENT PAGE

**Owner, 2026-08-25:** *"why does a lead modal have more data fields and functionally work far
better than the actual client page we show after a lead becomes a client."*

**Because the client page is where the lead modal's parts CAME FROM, and it was never switched over
to them.** `ClientRecordActions.tsx:42` says so in its own header:

> *"Exported from here and rendered by `ContactDossierModal`; `Admin.tsx` no longer…"*

| | Surface | Backed by |
|---|---|---|
| **A lead** | `ContactDossierModal` — 7 tabs (Record · Relationships · Documents · Orders · Paperwork · Account · Activity) | **one RPC**, `contact_dossier` |
| **A client** | `Admin.tsx` — the Clients tab, 1,044 lines, `RosterCard` + inline `setSelectedId` expansion | assorted reads |

**`Admin.tsx` does not import `ContactDossierModal` at all.** The working parts were extracted out
of the Clients page into a modal, the modal then grew (tabs, dossier RPC, and now line items), and
the page they were taken from kept its original card. So the richer surface exists and the client
side simply does not point at it.

⚠️ **This is a "two surfaces, one job" defect, and it has a ruling on it already.** TASK-ROSTER
(owner, 2026-08-10) settled that the Clients page is *"THE one people page"*, beating
`/app/ops/contacts`. That ruling has since been overtaken by the modal without anyone saying so.

**The fix is small and the risk is in the leftovers, not the change:** point a client row at
`ContactDossierModal`, then work out what `Admin.tsx` still uniquely does — `RosterCard`'s badges,
rings, flags and `AgreedLessonSection` are not obviously in the modal — and move it, rather than
losing it. **Audit before switching.**

### ❓ QUESTIONS — §16
1. **What does `Admin.tsx` still do that the modal does not?** `RosterCard`'s badges, rings and
   flags, and `AgreedLessonSection`, are not obviously in the dossier. **Audit before switching, or
   they are lost silently.**
2. **Does TASK-ROSTER's ruling stand or is it superseded?** It settled the Clients page as "THE one
   people page" on 2026-08-10; §17 reverses that in practice.

---

## 17. THE SURFACES ARE BACKWARD — and three pricing rulings

**Owner, 2026-08-25.** Supersedes §16's framing: the question is not only *which* surface is richer,
it is *which kind* of surface each person deserves.

### 17.1 THE RULING
> *"the lead modal should be what i get when i click a client card and the client page is what i
> should see when i click a lead card … the page is much better on desktop, the modal is for quick
> access on a page you dont want to leave."*

| | Gets | Because |
|---|---|---|
| **A client** | **the rich surface, as a PAGE on desktop** — every tab, every associated record | this is the working record; you go there to do things |
| **A lead** | **a small MODAL** — the form they submitted, and one act: **promote to a client** (activate the account). At most, edit their order contents first | you are on the phone, you do not want to leave the list |

⚠️ *"the caveat is i might be on the phone and the phone is my working device"* — **so the client
surface must work as a page on desktop AND be usable on a phone.** Not desktop-only.

### 17.2 THE CONCRETE BLOCKER, CONFIRMED
> *"i have no way to add a horse to pamela godde's client record, i cant see anything about her
> beyond what is shown on the main record page."*

**Pamela Godde: `contacts f80e944a…`, ZERO horses, ZERO tags.** She is a client, and the surface she
gets (`Admin.tsx` / `RosterCard`) has no horse-add. A *lead* gets `ContactDossierModal` with
`ClientHorseRecordsCard` and every tab. **The person who needs the record least has it; the person
who needs it most does not.**

### 17.3 SNAPSHOT WHAT THEY ASKED FOR
> *"we should keep a snapshot of what they send us in the form and the changes should happen on
> promotion to account, this way we can spot trends like upselling or people wanting more than they
> should be requesting."*

⚠️ **Nothing preserves it today.** `requests.notes` holds the submitted text and is **mutable**;
`request_selections` is what they picked and is edited in place. **There is no `audit_log` table in
this database at all** — checked. So a staff edit silently overwrites what the visitor actually
said, and the trend the owner wants to measure is destroyed by the act of serving the customer.

**Build: an immutable submission snapshot written once at intake**, with all subsequent edits
applied to the live record. The DIFFERENCE between the two is the signal — it is what makes
"upselling" and "wanting more than they should" measurable rather than anecdotal.

### 17.4 THE EVALUATION LESSON, WHEN COMBINED WITH A SUBSCRIPTION
> *"when they combine something like a weekly riding subscription, we should be increasing the price
> of the first month by $20 and then changing the price of the evaluation lesson to show it as
> included with their first month."*

Live prices: **Evaluation Lesson $170** · **2x Weekly Lessons $880/month** · 1x Weekly $460 ·
with-your-horse variants $780 / $420.

So for a 2x Weekly rider: **$1,050 becomes $900**, the evaluation renders as a line item marked
**Included**, and month one carries the +$20.

⚠️ **State it plainly: that is a $150 concession.** It reads as "+$20" and behaves as "-$150"
against the à-la-carte total. That is very likely intended — the evaluation is an on-ramp, not a
revenue line — but it should be a decision on the record, not an arithmetic accident nobody
noticed.

### 17.5 THREE PAYMENT CADENCES FOR WEEKLY RIDERS
> *"the monthly payment is an inherited config from the way other programs are run, for us, its
> better to offer a higher weekly payment price and they pay us at the end of each week to unlock
> the next week … For their willingness to pay for the month up front they get a discount."*

| Cadence | Price | Paid | Unlocks | Effective /week |
|---|---|---|---|---|
| Weekly | **$260** | end of each week | the next week | $260 |
| Bi-weekly | **$480** | end of every other week | the next two weeks | $240 |
| Monthly | **$880** | end of the month | the next month | ~$220 |

✅ **The ladder is internally consistent** — paying later and more often costs more, monotonically.
Nothing here needs re-deriving.

⚠️ **`offerings` CANNOT EXPRESS THIS.** One `price_amount` and one `price_unit` per row — that is
the whole pricing model. There is no cadence concept.
⚠️ **`product_prices` exists and is a red herring**: 0 rows, and it is keyed to `products`, not
`offerings` — a different, unused spine. **Do not build on it without a ruling** (it may be dead
scaffolding from the Phase-4 SKU design).
⚠️ `offerings.price_model jsonb` exists and holds `{"kind":"inquire"}` on exactly 3 rows. **That is
the natural home for a cadence set**, and it is already an owner-editable column.

⚠️ **This ruling REVISES §14.3.** That section assumed a monthly cycle — "fill the month ahead when
payment is confirmed", "3 days before month end". With three cadences, *every* date in §14.3 becomes
**relative to the period**, not to the month. The status machinery is unchanged
(`pending_payment → confirmed`); the calendar arithmetic is not.

### ❓ QUESTIONS — §17
1. **Do leads keep any tabs at all?** The ruling says *"the form they submitted, and promote"* —
   confirm Documents/Paperwork/Activity disappear for a lead rather than being hidden-but-present.
2. **Is the client surface a route (`/app/records/clients/:id`) or the modal made full-page?** A
   route gives a shareable address (D17) and a back button; the modal is already built.
3. **The three cadences: only for `2x Weekly Lessons`, or every recurring offering?** The owner gave
   ONE ladder and there are **four active recurring rider offerings** ($880 / $780 / $460 / $420).
   The other three need their own numbers, or a rule for deriving them.
4. **How does "+$20 on the first month" behave on the WEEKLY cadence?** +$20 on the first week, or
   +$20 spread across the first four? §17.4 and §17.5 collide here.
5. **Is the ~$220/week monthly rate the anchor, or is $260 the anchor?** i.e. is monthly discounted
   from weekly, or weekly surcharged from monthly? It changes what happens when prices move.
6. **What unlocks mean concretely when payment is late** — §14.3 says a past-due rider may not
   change their schedule. Does an unpaid week's lesson vanish, or sit as `pending_payment`?
7. **`product_prices` / `products` / `tiers` / `tier_modules`: alive or dead?** All empty. If dead,
   say so — they are actively misleading when looking for where price lives.

---

## 18. THE PROVISIONING OFFERINGS PICKER — BUILT

**Owner, 2026-08-25**, three rulings on one control, all built on this branch.

### 18.1 The rule is enforced, not announced
> *"i didnt designate them as rider by picking something and the evaluation being a requirement
> means it should be the only riding lesson option to select right now until i select it nothing
> else can be added from that category. this is handled by software not by surfacing words i read
> and comply with, also the notes like that are things that should be in the client facing content
> not things facing me as the admin."*

The staff form carried a paragraph — *"plan for an extra 30 minutes total: arrive 15 minutes
early…"* — **client guidance, shown to staff, asking the reader to remember a rule the form could
enforce.** Deleted. **The member's own shop already gated this correctly**
(`Onboarding.tsx`); only the staff form asked nicely. Same rule now, same shape: other riding
lessons stay visible and readable but cannot be selected until the evaluation is, and **dropping the
evaluation drops every lesson it unlocked** — leaving them selected would provision a set the rule
says is not orderable. Nothing locks when the catalog has no evaluation to require.

⚠️ **ONE name-matcher, not two.** `isEvaluationOffering` matched on the offering's NAME and was
about to be copied into a second file. It now lives once, in `src/lib/serviceCatalog.ts`, with the
warning attached: **this is a TENANT FACT HARDCODED IN CODE and breaks the day someone renames the
offering.** The real fix is a column — §10.5.

### 18.2 The order of the groups
> *"horsemanship should be shown below lessons, then horse training then exercise then clipping."*

`RIDING_LESSON → HORSEMANSHIP_TRAINING → HORSE_TRAINING → HORSE_EXERCISE → HORSE_CLIPPING`, as
`serviceDisplayRank` in `serviceCatalog.ts`. **Anything unlisted keeps catalog order AFTER these**,
so a new service type appears rather than being silently sorted to the front.

### 18.3 An order form, not a catalogue
> *"the items can be an order form with line items i add and select from a list on a menu not a
> giant list of everything with check boxes its a terrible waste of space and on mobile its going to
> be a nightmare."*

Was: every purchasable offering as a checkbox, grouped, two columns — **the whole catalogue on
screen to choose two things from.** Now: the chosen lines with a running total and a remove control,
and **one native `<select>` with `<optgroup>`s** to add another. That is the mobile-native picker and
it costs one row instead of the page.

⚠️ **The evaluation rule rides on the same data** — a locked lesson is a `disabled` `<option>`, so
it is still listed and readable ("greyed but still very readable", the owner's earlier ruling on the
shop) with no paragraph explaining why. **One mechanism serving both rulings.**

`typecheck 0 · typecheck:api 0 · lint 0 errors · build clean.`

### 18.4 The paperwork is rows too — BUILT
> *"the same for the paperwork, we can preselect and make rows for the documents they should be
> signing but that comes after the selection of offerings … just show a row with the menu to select
> a new document and the placeholder selection says select a document to add it, and when i select
> something it becomes a row and the x is there to delete it and the new empty selectable row
> appears below the one i just added and moves up when something is deleted."*

**Order fixed first.** Paperwork sat ABOVE the offerings, prefilled from a choice the reader had not
made yet — so *"the offerings you chose prefill this"* was shown before there were any. Reading
order now matches causal order.

**The grid becomes rows.** Was a three-column grid of ticked and un-ticked checkboxes; now each
document on the record is a row with an X, and **the last row is always an empty menu** reading
*"Select a document to add it…"*. Adding pushes a fresh empty row down, deleting pulls the list up,
and no button has to be pressed first — the old `+ Add another document` link and its `addingDoc`
state are gone.

⚠️ **Un-ticking and deleting became the SAME ACT**, which is what makes the trailing menu honest:
everything not on a row is in it. The old `shownDocKeys` carried un-ticked suggestions as visible
rows; `docRowKeys` is only what is ON — the prefill from the offerings, plus anything added by hand,
minus anything removed.

⚠️ **A signed document has NO X.** It is evidence they were asked and agreed and is never removed
(NOSTRIP §4). The NOSTRIP panel below — *"they already owe paperwork this selection doesn't
cover"*, with the named reason before anything stops being asked for — is **untouched**.

`typecheck 0 · lint 0 errors · build clean.`

### ❓ QUESTIONS — §18
1. **Where does `JUMPER_TRAINING` go?** The owner named five service types; the rider segment also
   has `JUMPER_TRAINING`, which currently sorts after clipping with everything unlisted. That is
   probably wrong for a rider service — it likely belongs right after horsemanship.
2. **Does the same order apply everywhere offerings are listed** — the member shop, the public
   catalog, the calendar panel — or only to this form?
3. **Should the evaluation gate apply to the ORDERS tab's "Add offerings" too?** That control adds
   offerings to an existing client, who may already have had their evaluation. The rule as written
   is about a NEW rider.
4. **Should the same row treatment go to the ORDERS tab's paperwork and the Paperwork tab?**
   `PaperworkEditor` is a separate surface and was not touched — two shapes for one job is the
   pattern this task keeps finding.

---

## 19. A NAMING CORRECTION — "the MEDIA_RELEASE class" is retired

**Owner, 2026-08-25:** *"what is a MEDIA_RELEASE class? why is that a thing? … fuck media release we
dont care about that, and claude has been harping on it since day one and its fucking irrelevant.
the only thing that matters is liability release matching the offering."*

**He is right, and the label is gone from the code and every document.**

**What it was trying to say:** *a tenant fact hardcoded in code — a value that belongs in data.*
The name came from one past incident: `MEDIA_RELEASE` was retired as a standalone document and
folded into the liability releases, but its template key stayed **hardcoded in two function bodies**,
so the code kept referencing a document that no longer existed. A previous thread used it as
shorthand for the pattern, and it calcified.

**Why the name was bad.** It elevated a **retired, irrelevant document** into a naming convention;
it named an *example* rather than the *pattern*; and it meant nothing to the only person who has to
read these documents. Jargon that has to be explained is not shorthand.

**Replaced everywhere with the plain description: A TENANT FACT HARDCODED IN CODE.** Seven places —
`serviceCatalog.ts`, `Onboarding.tsx`, and four documents.

**And the substantive point stands on its own:** *"the only thing that matters is liability release
matching the offering."* That is what `service_type_document_requirements` is (48 rows, 12 service
types, owner-editable) and it is exactly the OFFERINGDOCS model — **the offering decides the
paperwork.** The three rules that had been hardcoded in function bodies
(`RELEASE_HORSE_EXERCISE`, `RELEASE_JUMPER_ADDENDUM`, `EVALUATION_LIABILITY_WAIVER`) were moved into
that table precisely because a liability release belongs to an offering, not to a function.

⚠️ **The remaining instances of the actual pattern**, which still need fixing regardless of what it
is called: `isEvaluationOffering` matching on an offering's NAME (§18.1), the tenant timezone
hardcoded in `calendar-reminders.ts` (§2), and Claire's user id if the trainer default is ever
written that way (`TASK-HOMESHAPES` §1b).

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
