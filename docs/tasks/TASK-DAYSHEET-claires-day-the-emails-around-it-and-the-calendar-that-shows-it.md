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
1. ~~**THERE IS NO TENANT TIMEZONE.**~~ **SETTLED, owner 2026-08-24:** *"all activity is rooted in
   pst, Los Angeles."* The VALUE is `America/Los_Angeles`. **Still store it as tenant config, not a
   constant** — no `time_zone` column exists on `organizations` or `org_settings` today, and
   `calendar-reminders.ts` hardcodes the zone inside `pacificHour()`. A tenant fact frozen into
   code is the MEDIA_RELEASE class; seed the setting to `America/Los_Angeles` and read it. Note
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

## 7. OPEN QUESTIONS FOR THE OWNER

1. ~~What timezone is the barn in?~~ **ANSWERED: `America/Los_Angeles`.** Only "where it lives"
   remains, and that is settled by precedent — tenant settings, not a constant.
2. ~~How precise must "1 hour prior" be?~~ **ANSWERED: hourly cron, rounded down.** Rule and table
   in §2. No plan-tier change needed.
3. ~~Is a task a `booking` row?~~ **ANSWERED, owner 2026-08-24 — see §9.** Timed-vs-day-level is
   **Claire's call at scheduling time**, not a derived property. So it is one record type with an
   optional time (`kind='task'`, `is_flexible` carrying "no specific time"), and the answer opened
   a larger question about where the requirement comes from.
4. **Does the 9am client email go to a client with MULTIPLE items that day** as one email? Assumed
   yes — one email, all their items.
5. **Client no-show vs horse unavailable** — one status with a logged reason, or two statuses?
   Recommend one.
6. **What wrote the 00:00–13:00 booking?** Needs finding before the row is touched.
7. **Where does an unclaimed horse name get claimed?** (§6b) A tab on the horse records page, or a
   prompt on the booking itself when someone next opens it. Recommend the horse records page — it
   is where someone with the authority to create a record already is.

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
2. **`contract_fields` has ZERO rows in production.** The engine is built and no live contract
   currently exercises it — the only documents in prod are the seven onboarding releases (no lease,
   no bill of sale). So this is untested against real data, and anything built on it must be proven
   with a real contract first, not assumed from the schema.
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
