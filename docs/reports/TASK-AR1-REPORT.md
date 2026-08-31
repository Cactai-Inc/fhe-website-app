# TASK-AR1 — THE CALENDAR, ALL OF IT

**Report only. Nothing was fixed, nothing was migrated, no row was written.**
Worktree `~/Downloads/claude-code-repo/wt-ar1`, branch `task/ar1`, from `origin/main` @ `bb49e713`.
Everything below was verified against **production** on **2026-08-30** with `psql` (SELECT only —
no `BEGIN`/`ROLLBACK` probe was needed) and against the live function bodies in `pg_proc`, not
against migration files.

⚠️ **Where the task brief's own numbers had moved, this report uses the re-verified ones and says so.**

---

## 1. ⚠️ URGENT

### U1 — Editing any session silently reassigns its instructor to whoever pressed Submit

**What.** `calendar_free_busy` never returns `instructor_user_id` — not in the staff branch, not in
any branch. `CalendarItemPanel` initialises its Instructor picker from `item?.instructor_user_id`,
which is therefore always `undefined`, so the select renders on *"You (whoever books it)"* no matter
who is actually assigned. `buildPayload` sends `instructor_user_id: instructorId || null`, and
`save_calendar_item` then does:

> `IF v_instr IS NULL AND v_kind IN ('lesson','care') THEN v_instr := auth.uid(); END IF;`
> …then unconditionally `UPDATE bookings SET … instructor_user_id = v_instr`.

**So opening an existing lesson and pressing Submit — for any reason, even to fix a typo in the
notes — moves that lesson to the person who pressed it.** No warning, no audit row, no undo.

**Evidence.**
- `calendar_free_busy` staff branch (live body): `jsonb_build_object('id', b.id, 'kind', …, 'client_id', b.client_id, 'horse_id', …, 'series_id', b.series_id)` — **no `instructor_user_id` key.**
- [CalendarItemPanel.tsx:104](src/pages/app/CalendarItemPanel.tsx#L104) `useState(item?.instructor_user_id ?? '')`
- [CalendarItemPanel.tsx:343](src/pages/app/CalendarItemPanel.tsx#L343) `instructor_user_id: type === 'offering' && !isFlexible ? instructorId || null : null`
- `save_calendar_item` live body, the `v_instr := auth.uid()` line and the EDIT loop's `UPDATE`.
- Production: 47 of 664 lesson/care bookings carry an instructor; **two distinct instructors, and 2 of the 47 are stamped `admin@fhequestrian.com` while 45 are `hello@fhequestrian.com`.** That distribution is *consistent with* this path having already fired, though it is not proof of it — the mechanism is what is proven, and the mechanism alone is sufficient.

**Conditions under which it is true.** Staff/admin only; the `Session` tab; `Flexible` unchecked;
`kind` resolving to `lesson` or `care`. It does **not** fire for the `Appointment` or `Unavailable`
tabs, because `v_instr := auth.uid()` is guarded on `v_kind IN ('lesson','care')` and those write
`kind='block'`.

**Why this is urgent and not just a bug.** The dashboard's Today zone deep-links straight into this
panel (`bookingHref` → `?item=` → `setEditing({item: hit})` for staff), so the shortest path in the
app from *"look at today's schedule"* to *"corrupt the instructor record"* is two clicks. And under
[[the shared-login reality]] — Claire works inside `hello@`, CJ inside `admin@` — the field is the
only thing that could ever tell the two apart on a session.

### U2 — `all_day` has one writer, one meaning, and no reader; the same Submit erases it

`close_day` is the **only** thing in the system that sets `all_day = true` (a 24-hour
`kind='block' / status='unavailable'` row). `buildPayload` never sends `all_day`, and
`save_calendar_item` does `all_day = coalesce((p->>'all_day')::boolean, false)`. **Editing a closed
day through the panel turns it back into an ordinary block.** Zero closed days exist in production
today, so nothing is damaged yet — this is listed here because it is the same one-line class of
silent overwrite as U1 and should be fixed in the same change, not because it has already cost
anything.

**Nothing else in scope is actively harming a user or corrupting data.** In particular: the
horse double-booking gap (F19) is a real code gap but **zero bookings in production carry a
`horse_id`**, so it is latent, not live.

---

## 2. WHAT THIS AREA IS FOR

**For Claire.** *"What am I doing, and with whom."* She comes here to see her day and her week laid
out in time order, to put a session in when someone asks for one on the phone, to move one, to mark
a day closed, and to see whether the person arriving at 5:30 has paperwork or money outstanding. She
is not shopping and she is not administering — she is reading a plan and adjusting it. **Her working
device is a phone.**

**For staff generally.** The same, plus the queue: the pending requests bar is the one place in the
app where *"somebody asked for a time"* becomes *"yes, no, or how about this instead."* That queue
is on the calendar because a time request can only be answered by looking at the times.

**For a member.** Two things, and only two. *"When am I riding?"* and *"can I have a different
time?"* A weekly rider's answer is a standing day and time that repeats; a punch-card rider's answer
is a balance they spend by asking for a slot. Everything else on the page — the legend, the credit
chips, the buy panel — exists to answer one of those two questions.

**What it is NOT for, and currently pretends to be.** It is not a shop window of the barn's free
hours. Today, 88% of what it draws is exactly that.

---

## 3. THE STATE MATRIX

Every row below was checked against the live RPC bodies and, where a count is given, against
production.

| State | Sees the Calendar? | What renders | What actually works |
|---|---|---|---|
| **Anonymous** | No | `/app/*` is behind `ProtectedRoute`; `calendar_free_busy` raises `authentication required` before any row is read | nothing — correct |
| **Contact, no account** | No | — | — | 
| **Client, invitation never sent / no login** | **No** | **16 of 24 live clients have no `profiles` row.** For them the calendar does not exist; their sessions are visible to staff only | nothing. Every claim below about "a member" is a claim about **8 people** |
| **Signed in, no `clients` row** | Yes, and it is a trap | Full grid of green *Open* blocks. `current_client_id()` is NULL | **Every write fails.** `book_open_slot` → `no member profile`; `request_open_time` → `no member profile`. Both surface as the raw server string. ⚠️ **Re-verified: the only 3 accounts in this state are `zz-test-*@example.invalid` fixtures — the STABILIZE fix held. This row is a shape to protect, not a live defect.** |
| **Signed in, no purchases** | Yes | Grid + *Buy lessons*. No credit chips, no standing-slot bar | Clicking an *Open* block opens the panel, which says *"You have no sessions left"* and offers Buy. Correct. |
| **Active client, punch-card credits** | Yes | Credit chips; *Open* blocks bookable | `book_open_slot` debits the named credit and lands `pending`. Works. |
| **Active client, recurring plan** | Yes | Standing-slot bar; picker auto-opens if unchosen | Works. Their sessions are materialised 90 days out (26 future sessions for the one live plan). ⚠️ Under **D23** the zero spendable balance is correct and is **not** reported here. |
| **Archived client** | No login path | — | — |
| **Staff / admin** | Yes | Full detail per row… | …but labelled **"Reserved"** (F11). Item click opens the **full editor**, never a read view. |
| **Desktop** | Usable | Week grid at its 720 px minimum inside `overflow-x-auto` | — |
| **Mobile (393 px)** | ⚠️ **Barely** | Week grid needs **1.83 screens of horizontal scroll**; month grid compresses to **≈52 px per day column** with 10 px truncated chips | See F21 |
| **Empty vs populated** | — | ⚠️ **The calendar is never empty and cannot be.** The generator fills every business hour. "Empty" is the state this surface has never had, and CR-03 is a request to give it one. |

---

## 4. FINDINGS

### THE FURNITURE, AND WHAT IT HIDES

---

**F1 — In month view, the three chips a day shows are three empty hours, and every real session is
buried in "+N more" where it cannot be opened at all.**

`MonthGrid` renders `dayItems.slice(0, 3)` ([CalendarPage.tsx:658](src/pages/app/CalendarPage.tsx#L658))
in the order `calendar_free_busy` returned them, which is start-time order. Production, Tuesday
2026-09-01:

| rank | time | status |
|---|---|---|
| 1 | 08:00 | available |
| 2 | 09:00 | available |
| 3 | 10:00 | available |
| … | … | … |
| **10** | **16:30** | **scheduled** (Evan LaBuzetta) |
| **11** | **17:00** | **scheduled** (Steph) |

**So the month view of 1 September shows "8:00 Open", "9:00 Open", "10:00 Open", "+11 more" — and
both of the day's actual lessons are invisible.** This is true of every day in the published window.

**Conditions.** Always, for both staff and members, on every day where more than three items exist
— which is every day inside the 4-week publish window. It is worse on a phone, where the chip text
truncates at ~7 characters anyway.

⚠️ **This is the true shape of CR-01.** The owner reported *"I can't click things in month view"*;
the deeper fact is that in month view **there is nothing of his to click.**

---

**F2 — 88% of the bookings table is generated availability, it is regenerated hourly by a live cron,
and it is never retired.**

Production census, 2026-08-30:

| | rows |
|---|---|
| `available` (generated furniture) | **587** — 584 `lesson`, 3 seed `block` |
| `scheduled` | 77 |
| `cancelled` | 2 |
| `completed` | 1 |
| **total** | **667 → 88.0% furniture** |

*(The task brief said 565/642 = 88%; the ledger said 92%. Both have moved; 88% is current.)*

Density, by week:

| week of | `available` | real |
|---|---|---|
| 2026-08-24 | 75 | 13 |
| 2026-08-31 | 82 | 5 |
| **2026-09-07** | **84** | **2** |
| **2026-09-14** | **84** | **2** |
| 2026-09-21 | 71 | 2 |

**84 green blocks a week against 2 real sessions — a 42:1 ratio.** Business hours are 08:00–20:00,
seven days, so the generator publishes 12 slots × 7 days = 84 per week and the calendar is
wall-to-wall green by construction.

**And it accumulates.** `_publish_open_slots_for_org` only refuses to create slots **in the past**
(`IF v_t > now()`); it never retires the ones that have gone by. **266 of the 587 are already in the
past** and will sit there forever under D32. The table grows by ~84 rows a week whether or not
anyone books anything.

---

**F3 — ⚠️ Deleting the furniture is not the fix. A cron puts it back within the hour.**

`vercel.json` schedules `/api/calendar-reminders` at `0 * * * *`, and
[api/calendar-reminders.ts:73](api/calendar-reminders.ts#L73) calls
`publish_open_slots_all({ p_weeks: 4, p_slot_minutes: 60 })` on every run. **It is running.**
Production `created_at` batches on `status='available'` rows prove it:

```
2026-08-23 11:13  →  210    2026-08-27 06:16  →   12
2026-08-24 00:49  →   11    2026-08-28 00:43  →   12
2026-08-25 00:35  →   39    2026-08-29 02:30  →   12
2026-08-26 00:36  →   12    2026-08-30 05:24  →   11
```

A steady ~12 new rows a day is exactly the horizon edge rolling forward one day at a time.

⚠️ **This corrects a standing assumption in this project's memory** that no Vercel cron has ever
run. `/api/calendar-reminders` demonstrably has, daily, since 2026-08-23.

**Consequence for whoever builds CR-03: the delete and the generator must land in one change.**
A migration that clears the rows and ships without touching `api/calendar-reminders.ts` will look
like it worked and be undone by 60 minutes later. Same shape as `docs/ORCHESTRATOR.md` §3.

---

**F4 — Removing the furniture removes client self-booking, because self-booking can only operate on
furniture. The replacement already exists and is named `request_open_time`.**

`book_open_slot` opens with:

> `IF NOT FOUND OR NOT v_b.is_flexible OR v_b.status <> 'available' THEN RAISE EXCEPTION 'that time is no longer open'`

It can *only* claim a pre-existing generated row. It has no branch that creates one.

**The candidate the brief says already exists is `request_open_time`** — the RPC behind
`RequestTimePanel` (*"Request this time"*, [CalendarPage.tsx:1056](src/pages/app/CalendarPage.tsx#L1056)).
It takes an arbitrary start and end, needs no published slot, writes a `pending` booking plus the
companion `booking_change_requests` row the staff queue already reads, and notifies staff. **It is
the same landing state `book_open_slot` produces** (`pending` + a `'new'` change request), so the
staff queue, the confirm path and the client's *"we proposed a different time"* loop all work
unchanged.

**This is the answer to §4 question 2: yes, invert — and `request_open_time` is what replaces
self-booking.**

---

**F5 — …and today the furniture is what makes that replacement unreachable from the grid.**

`WeekGrid` wires the empty-cell handler as
`onClick={onEmpty && cell.length === 0 ? () => onEmpty(d, h) : undefined}`
([CalendarPage.tsx:597](src/pages/app/CalendarPage.tsx#L597)). **No in-hours cell is ever empty** —
the generator guarantees one row per hour — so a member can never click a time on the grid to
request it. The only surviving reach is the header's *"Request a time"* button, which does not let
them pick the time on the grid at all; it guesses via `nextBookableSlot()` and makes them retype it.

⚠️ **So CR-03 does not merely *permit* the empty-means-bookable model — it is what makes the model's
own control reachable.** The two are one change.

---

**F6 — The request path books for free. Neither `request_open_time` nor `confirm_booking` debits a
credit.**

`book_open_slot` debits a `lesson_credits` row and raises `NO_CREDITS` if there isn't one.
`request_open_time` does not touch `lesson_credits` at all. `confirm_booking` — the staff action
that turns a request into a `scheduled` session — updates `bookings.status` and
`booking_change_requests.status` and writes a notification, and **never mentions credits either.**

**So a member can request a time, staff can confirm it, and their balance is untouched.** Production
is consistent with this: **36 of 77 `scheduled` bookings carry a `credit_id`** (39 carry a
`purchase_id`). Some of that gap is legitimate — staff-created sessions from before the credit
engine — but the path is open today.

⚠️ **This is a blocker on F4.** If `request_open_time` becomes the *only* booking path, the debit has
to move to it or to `confirm_booking`, or the barn gives lessons away. **It must land in the same
change as CR-03, not after it.**

---

**F7 — The three-position toggle: two of its positions have written zero rows, ever — and CR-03
makes one of those two essential.**

The toggle is `ItemType` at [CalendarItemPanel.tsx:482](src/pages/app/CalendarItemPanel.tsx#L482):
`Session` / `Appointment` / `Unavailable`. What each writes, and what production holds:

| Position | Writes | Rows in production |
|---|---|---|
| **Session** (`offering`) | `kind='lesson'\|'care'`, `status='scheduled'` — or with **Flexible** checked, `status='available'` | 77 scheduled. **The `available` ones all came from the cron — `created_by` is NULL on all 587.** The panel has published exactly **zero**. |
| **Appointment** | `kind='block'`, `status='unavailable'`, + client/horse, + `notifyAppointmentClient` | **0** |
| **Unavailable** | `kind='block'`, `status='unavailable'` | **0** |

⚠️ **But the conclusion is not "delete two of three."** Once availability is inverted, *"I am not
available then"* becomes the **only** way anything is ever marked unavailable — so `Unavailable`
stops being dead and becomes the load-bearing position, and the thing that actually dies is the
`Session + Flexible` combination that publishes slots.

**The honest restatement of CR-06:** the toggle is not three positions, it is one question asked
badly — *what is this time?* — with a hidden fourth answer (the `Flexible` checkbox) that does not
belong to the question at all. **The checkbox is what to decommission; the question is what to
keep.**

---

**F8 — Closing a day works in the data and is invisible on the calendar.**

`close_day` inserts `kind='block', status='unavailable', all_day=true`, spanning
`p_date → p_date + 1`. Then:

- `WeekGrid` places items by `s.getHours() === hour` and only draws hours `openHour..closeHour` (8–19). A 00:00 row **falls in no drawn row.** The day looks ordinary.
- `MonthGrid` renders it as one chip reading `"12:00 AM Unavailable"` among the day's other 12 chips — and per F1 it is usually below the cut.
- `calendar_free_busy` *does* send `all_day`, and **nothing in `src/` reads it on this surface.** The only `all_day` reader in the app is `ActivationOrderPanel`, on a different query.

**The one thing that does work:** the 24-hour block overlaps every hour, so `_publish_open_slots_for_org`
publishes nothing that day. So a closed day is correctly *sterile* and completely *invisible*.

**Conditions.** Always, both roles, both views. No closed day exists in production yet — this is a
mechanism that is wired and would fail the first time it is used, not an empty-table observation.

---

### THE DRAWING

---

**F9 — One root cause, three symptoms: the week grid draws business hours only, and places an item
by its start hour alone.**

[CalendarPage.tsx:567](src/pages/app/CalendarPage.tsx#L567):
`return sameDay(s, day) && s.getHours() === hour;`
and the row set is `Array.from({length: closeHour - openHour})`.

An item is drawn in exactly one cell, sized `min-h-[44px]`, regardless of how long it is. Therefore:

1. **anything starting outside 08:00–19:59 renders nowhere** (CR-02's midnight booking; F8's closed days);
2. **every item is the same height** whether it is 30 minutes or 13 hours (CR-05);
3. **an item that spans hours occupies only its first**, so a 13-hour block does not visibly block anything.

**One fix addresses all three:** place by offset-from-`openHour` and size by duration, and give the
grid a way to show out-of-hours items (either extend the band to cover the day's actual extremes, or
carry them in an all-day rail above the grid — which is also where `all_day` items belong, and is
what CR-03 asks for in its own words: *"for something that doesnt have a specific time it just shows
at the top of the day"*).

---

**F10 — The midnight booking is still live, it has a twin, and the twin is the evidence.**

| id | starts | ends | status | client | series |
|---|---|---|---|---|---|
| `32eae51d…` | **2026-08-28 00:00** | 13:00 | scheduled | Madeline Do | `f16d887c` (the Thursday 17:30 series) |
| `19b82c10…` | 2026-08-28 08:00 | 13:00 | scheduled | Madeline Do | — |

Same client, same offering (`2x Weekly Lessons`), same date, **both ending at 13:00**, created a day
apart (08-02 and 08-03). Every other booking in the database is 60 minutes except one 3-hour Gabby
lesson.

**The shared 13:00 end is the tell.** These are not two different intents — they are one intended
session (almost certainly 12:00–13:00) entered twice, once with the hour slipping to 00:00. The
free-form `datetime-local` start/end boxes are exactly what allows it, which is CR-07's whole point.

**ASK-OWNER stands, unchanged from the ledger:** confirm both belong to Madeline before either is
removed. ⚠️ **Under D32 the removal is `delete_calendar_item`, which soft-deletes anything with a
client — these both have one, so both survive as `cancelled` rows.**

---

**F11 — Nothing anywhere records how long a service takes — but a per-plan duration store already
exists, is read by six functions, and has never held anything but 60.**

`offerings` has **no** duration column. A whole-schema sweep for `duration|minutes|length` returns
exactly three columns: `bookings.travel_before_minutes`, `bookings.travel_after_minutes`,
`time_entries.minutes`.

**But `purchase_items.config->>'duration_minutes'` exists.** Six live functions read it —
`_ensure_plan_horizon`, `_generate_plan_month`, `generate_monthly_lessons`, `my_standing_slots`,
`client_standing_slots`, `set_my_standing_schedule` — every one of them as
`coalesce((…->>'duration_minutes')::int, 60)`.

**In production exactly one `purchase_item` carries the key, and its value is 60.** The only UI that
writes it is [StandingSlotPicker.tsx:121](src/components/app/StandingSlotPicker.tsx#L121),
`durationMinutes: open.duration_minutes || 60` — which round-trips whatever is already there.
**There is no control anywhere that lets a human set it.**

**And the 90 minutes has never existed.** Every `scheduled` booking is 60 minutes except three
outliers (300, 780, 180). **Not one is 90.** The evaluation lesson is not a drawing bug — the data
has never carried it.

⚠️ **The one place in the entire app where 90 minutes can be expressed** is the client's
`RequestTimePanel` duration select (`['30','45','60','90']`,
[CalendarPage.tsx:1125](src/pages/app/CalendarPage.tsx#L1125)). A member can ask for 90 minutes; a
staff member has to type two timestamps and get the arithmetic right; the offering itself cannot
say.

**Answer to §4 question 3 — where duration should live:**

> **`offerings.duration_minutes`** (nullable int), because duration is a property of *the service the
> barn sells*, not of one person's plan. `Evaluation Lesson` is 90 for everybody, forever.
> `purchase_items.config.duration_minutes` **stays** as the per-plan override that already exists —
> it is the right shape for *"Steph's Saturday runs long"* — and its `coalesce` chain gains one link:
> `coalesce(config→duration, offering.duration_minutes, 60)`.
> **`calendar_free_busy` then needs to emit nothing new**: it already returns `ends_at`, and once
> every writer computes `ends_at` from the resolved duration, the drawing (F9) and a clash-aware
> picker (CR-07) both read the one fact off the row they already have.
> ⚠️ **Under D21 this ships with an editor** — the duration field belongs on the offering editor, not
> in a migration. That is the whole difference between this and hardcoding 90.

**And how the 90 gets recorded historically:** it does not, and should not be back-filled. The three
non-60 rows in the table are two data-entry errors and one 3-hour lesson. Recording starts when the
offering carries the number.

---

### THE NAMING (D25)

---

**F12 — Three implementations of D25's naming rule, and the calendar uses the weakest one.**

| Implementation | Where | Knows the noun? | Knows the service? | Used by |
|---|---|---|---|---|
| `booking_service_label(kind, offering_id)` | SQL | ✗ (always "appointment" for blocks) | ✓ strips `2x weekly` off the offering name | notification titles only |
| `serviceWording(service_type)` | [registry.ts:142](src/lib/dashboard/registry.ts#L142) | ✓ `service` / `appointment` / `Riding Lesson` | ✓ per service type | the dashboard zones only |
| **`itemLabel(item)`** | [CalendarPage.tsx:126](src/pages/app/CalendarPage.tsx#L126), private | ✗ | ✗ | **the calendar** |

`itemLabel` returns five strings and nothing else: `Open` · `Unavailable` · `Your Riding Lesson` ·
**`Your session`** · **`Reserved`**.

**The incumbent should be `serviceWording`.** It is the only one that implements D25 completely, and
`calendar_free_busy` can already produce the input — `booking_service_type(b)` exists and
`dash_week_strip` already calls it. **`itemLabel` should be deleted, not extended.**

Two specific D25 breaches follow from it:

- **A member's horse-care item reads "Your session"** in the chip, the panel heading, and the button *"Reschedule this session"*. D25 requires the actual service and a per-service noun: turnout/exercise/training are a **service**, clipping is an **appointment**.
- **The word "booking" survives in two staff strings**: [CalendarItemPanel.tsx:367](src/pages/app/CalendarItemPanel.tsx#L367) *"before booking it"* and [:425](src/pages/app/CalendarItemPanel.tsx#L425) *"No open request found for this booking."* SLOTREACH §4 extended D25 to staff copy.
- ⚠️ `calendar_money_items` builds the label **`'Confirm your booking'`** — client-facing text, in a function. It has **zero call sites** (F16), so nobody sees it, but it will be seen the moment somebody wires it up.

---

**F13 — CR-04 exactly: the read already labels the row as staff, and the screen never looks.**

`calendar_free_busy`'s staff branch sets `'is_mine', false, 'mine_role', 'staff'` and sends the full
detail set. `itemLabel` tests `item.is_mine` — false for staff — and falls through to **`'Reserved'`**.
**Staff see the same opaque word a stranger sees, on rows they were sent full detail for.**

`mine_role` is declared in the `CalendarItem` interface ([api-calendar.ts:43](src/lib/ops/api-calendar.ts#L43)),
emitted by the RPC, and **read by nothing in `src/`.** A field with a writer and no reader — the
defect class the standard names as this codebase's most common.

**Answer to the ledger's ASK-REPO (ids or names?):** ⚠️ **names, server-side.** The read is already
role-branched, so adding `client_name` and `label` to the staff branch costs one subquery and keeps
the rule *"a client never receives another client's name"* enforced in the one place it can be
enforced. Looking names up on screen would mean a second round-trip and a second copy of the D25
rule — which is F12 all over again.

---

### THE MONEY

---

**F14 — The two revenue functions disagree by 9.7×. `revenue_summary` is right. The calendar
already uses it.**

August 2026, production, both definitions run side by side:

| | total | rows |
|---|---|---|
| `calendar_revenue` — `sum(bookings.price_amount)` over the window's **start times** | **$18,320.00** | 28 |
| `revenue_summary` — `sum(purchases.amount_paid)` at **`paid_at`** | **$1,880.00** | 3 |

**They do not agree and they never could.** One is *scheduled value at the moment work is planned*;
the other is *money received on the day it arrived*. `calendar_revenue` also counts every session of
a monthly plan at the plan's full price, which is where the order-of-magnitude comes from.

**`revenue_summary` is the single source, and this is already resolved.**
[api-calendar.ts:214](src/lib/ops/api-calendar.ts#L214) `fetchRevenue` calls `revenue_summary`, and
both the calendar ribbon and the dashboard tile read that one call through the same
`weekWindow()`/`monthWindow()` helpers. **`calendar_revenue` has zero call sites in `src/`, `api/`
or `test/`.**

**So the finding is not a live wrong number — it is a live wrong function.** Under D32 it stays in
the database, but it is a loaded gun for the next thread that greps for "revenue" and finds a
function whose name matches the surface it is working on. **It needs a comment in its own body
saying so.**

---

**F15 — `calendar_money_items` has zero call sites too.**

Same class. A whole function — payments due, gift expirations, pending confirmations — built for
this surface, granted, live, and read by nothing. Under the checklist's rule 2, a function with zero
call sites is a finding. **It also carries a D25 breach (F12) that has never been seen because
nothing renders it.** Decide deliberately: wire it into the calendar's money row, or comment it as
retained-not-wired. Do not leave it ambiguous.

---

### ONE CALENDAR OR SEVERAL

---

**F16 — There are two week renderers, and the second one is the reason CR-01's dashboard complaint
exists.**

**Answer to §4 question 7: two implementations, five presentations, one ledger.**

| Surface | Component | Reads | Item click |
|---|---|---|---|
| `/app/calendar` week | `WeekGrid` ([CalendarPage.tsx:545](src/pages/app/CalendarPage.tsx#L545)) | `calendar_free_busy` | opens the panel ✓ |
| Dashboard "This week" | **`WeekZone`** ([TrainerZones.tsx:81](src/components/app/dashboard/TrainerZones.tsx#L81)) | `dash_week_strip` | ⚠️ **navigates to `/app/calendar?on=<day>`** |
| Dashboard "Today" | `TodayZone` | `dash_today_plan` | opens the panel ✓ via `bookingHref` |
| `/app/schedule` | `Schedule.tsx` | `my_lesson_sessions` / `bookings` | list only; routed, no nav entry |
| `/app/ops/lessons/sessions` | `SessionsPage` | `bookings` | list only |
| Day-sheet email | `ops_day_sheet` | `bookings` | — |

**Good news: one ledger.** Every one of these reads the `bookings` table. There is no second store.

**The defect is one line.** `TodayZone` already uses `bookingHref(r.booking_id, r.starts_at)` →
`/app/calendar?item=…&on=…`, and `CalendarPage` already honours `?item=`. **`WeekZone` wraps its
whole day card in a single `<Link to={/app/calendar?on=${d.day}}>` and its per-session chips are
`<span>`s inside it** — so clicking a session lands on the calendar's week view and nothing opens.
That is verbatim the owner's *"clicking something should open the modal but it takes me to the
calendar."* **The helper that fixes it lives two files away and its sibling zone already calls it.**

---

**F17 — `dash_week_strip` and `ops_day_sheet` disagree about what "on the schedule" means.**

`dash_week_strip`: `count(*) FILTER (WHERE bk.status = 'scheduled')` — and its `items` array carries
the same filter.
`ops_day_sheet`: `b.status IN ('scheduled','confirmed','pending')`.

`confirm_booking` sets **`'scheduled'` for a lesson and `'confirmed'` for anything else**
(`CASE WHEN kind = 'lesson' THEN 'scheduled' ELSE 'confirmed' END`).

**Therefore every confirmed horse-care session is invisible in Claire's week strip and present on
her day sheet.** Zero `confirmed` rows exist today, so nothing is currently wrong on screen — but
this is the exact shape of every disagreeing-count defect this project has had, and it fires the
first time a turnout or clipping session is confirmed.

---

**F18 — The dashboard advertises the furniture too.**

`dash_week_strip` returns `open_slots` = `count(*) FILTER (WHERE bk.status='available' AND kind='lesson')`,
and `WeekZone` renders *"{d.open} open"* on any day with nothing booked. **On a quiet day Claire's
dashboard says "12 open."** Whatever CR-03 decides, this reader and this renderer are part of it.

⚠️ **Contrast `ops_day_sheet`, which had to write a defensive comment and an explicit exclusion:**
*"'available' is EXCLUDED: 494 of the calendar's rows are published open slots, not sessions. A day
sheet listing them would be unreadable."* **Three surfaces have now each independently worked around
the furniture. That is the cost of it, measured.**

---

### THE HORSE (CR-71)

---

**F19 — The existing horse check enforces overlap and nothing else; three of seven write paths call
it; and no booking in production has ever carried a horse.**

**Answering the ledger's four ASK-REPO questions directly:**

1. **What does the existing check enforce?** `horse_time_conflict(org, horse, start, end, exclude_id, exclude_series)` is a single `EXISTS` over overlapping non-cancelled bookings. **Overlap only.** No volume, no per-weekday rule, no consecutive days, no categorical kind.
2. **Is a horse's schedule ever read across a range?** **No.** Every read is per-booking. Nothing anywhere asks *"what has this horse done this week."* ⚠️ **This is the gap CR-71's consecutive-day limit actually needs**, and it is a new read, not an extension of the check.
3. **Are categorical limits checkable today?** **Partly, and by accident.** `offerings.service_type` distinguishes `RIDING_LESSON` / `JUMPER_TRAINING` / `HORSE_EXERCISE` / `HORSE_TRAINING` / `HORSE_CLIPPING` — enough for *"no jumping"*. **Not** enough for *"no trails"*, which no offering expresses.
4. **Does the lease's reserved-days structure share a shape?** It has a near-relative in `purchase_items.config.recurring_days` (`["Tue","Sat"]`) — a weekday-name array. A horse's allowed-days limit wants the same vocabulary, and should reuse it rather than invent a second weekday encoding.

**Where the check is NOT called:**

| Write path | calls `horse_time_conflict`? |
|---|---|
| `save_calendar_item` | ✓ |
| `request_open_time` | ✓ |
| `_generate_plan_month` | ✓ |
| **`book_open_slot`** | ✗ |
| **`update_my_pending_booking`** | ✗ |
| **`request_booking_change`** / `decide_booking_change` | ✗ |
| **`propose_booking_time`** | ✗ |

**Every client-facing path is in the second group.** A member can book, move, or have staff propose
a time that double-books their own horse.

⚠️ **And `horses` has no limit columns at all** — 64 columns, none of them hours/day, hours/week,
consecutive days, allowed weekdays, or prohibited activities. `rider_level_min` / `rider_level_max`
exist and are **read by nothing** in the database or `src/` — a precedent for "constraint field
added, never wired," which is the failure mode CR-71 must avoid.

⚠️ **Production: `select count(*) from bookings where horse_id is not null` → 0.** The horse pickers
in three panels, `attach_booking_horse`, `set_booking_horse`, `horse_time_conflict` — the entire
horse-on-a-session apparatus has never carried a single row. **CR-71 proposes building limits on a
seam that has never been exercised.** That is not a reason to refuse it; it is a reason to make
proving the seam step one of it.

---

### REACHABILITY, CONFIG, MOBILE, HORIZON

---

**F20 — The calendar's missing `pageRegistry` row: what it actually costs, and a stale comment.**

The route exists, and — ⚠️ **re-verified, correcting the task brief** — the Calendar is **not**
parked in Review any more. It is a hardcoded `RailLink` in **both**
`StaffNavItems` ([AppLayout.tsx:1128](src/components/app/AppLayout.tsx#L1128)) and
`ClientNavItems` ([:1082](src/components/app/AppLayout.tsx#L1082)), with the comment
*"RESTORED 2026-08-15 (Review experiment ended)."* **Staff and members can both reach it from the
nav today.**

**What the missing registry row actually costs is precise:** `PAGE_REGISTRY`'s real consumer is
`AdminPageVisibilityPage`. **The Calendar is the only nav destination in the app a tenant cannot
show or hide from Page visibility.** Under D13 that is a configuration surface with a hole in it.

⚠️ **And `pageRegistry.ts`'s own header comment is 15 days stale:** it still says the App-pages block
holds *"Calendar/Catalog while they are parked in Review."* Same class as D20's `reviewSection.ts`
comment. **A doc claim inside the code is still a hypothesis.**

**Neighbour: `TASK-AR4` owns moving the Calendar link into Management.** The registry row is mine to
report and theirs to land in the same edit, because both touch the same two files.

---

**F21 — On the owner's working device the month view is unreadable and the week view is 1.83 screens
wide.**

| | class | at a 393 px viewport |
|---|---|---|
| `WeekGrid` | `min-w-[720px]`, `grid-cols-[56px_repeat(7,1fr)]` inside `overflow-x-auto` | **720/393 = 1.83 screens.** ~3.5 days visible at once. Day column = (720−56)/7 = **94.9 px** |
| `MonthGrid` | `grid-cols-7`, **no min-width** | compresses to **≈52 px per day cell** before page padding. Chips are `text-[10px] … truncate` with `px-1` → ~43 px of text → **~7 characters** of `"5:30 PM Your Riding Lesson"` |
| Chrome above the grid | `h1` + create button + view toggle + prev/Today/next + gear, then a second `flex-wrap` row with *Buy lessons* + **five** legend chips, then the standing-slot card, then the credits strip, then the requests bar | all `flex-wrap`, so on a phone this stacks to several rows and **the grid begins several hundred pixels down the page** |
| Panels | `DetailPanel` / `RequestTimePanel` `w-full max-w-sm`; `CalendarItemPanel` `w-full sm:max-w-md` | ✓ correct — full-screen on mobile |

**There is no day view.** On a phone, the week grid's 95 px columns and the month grid's 52 px
columns are the only two options, and neither is a mobile design — they are the desktop design at
two zoom levels.

⚠️ **This compounds F1 catastrophically.** On a phone the month view shows ~7 legible characters per
chip, three chips per day, and per F1 all three of those chips say *"Open."*

---

**F22 — What the settings panel can configure, and the four things that matter most that it cannot.**

`CalendarSettingsPanel` edits: per-weekday open/close/closed, close-a-single-day, the flat reschedule
fee, and the tiered change-fee schedule. **All correct and all D13-compliant.**

**Hardcoded, with no editor anywhere:**

| Fact | Where it is frozen |
|---|---|
| Slot length = 60 min | `api/calendar-reminders.ts:73` `p_slot_minutes: 60` |
| Publish horizon = 4 weeks | same line, `p_weeks: 4` |
| **Whether to publish at all** | the existence of that line |
| Standing-slot horizon = 90 days | `ensure_standing_slots` line 11 `current_date + 90` |
| Session duration | nowhere (F11) |
| The barn's timezone | F23 |

⚠️ **Under D21 — "an algorithm is configuration, not code"** — the publish rule is a formula
(business hours × slot length × horizon) with no editor, which the rule now calls a defect by
default. **CR-03 may make the question moot by deleting the publisher entirely; if any of it
survives, it survives with a control.**

---

**F23 — The barn's timezone is asserted in 26 places in the repo and 5 places outside it, and no
tenant can ever state its own.**

Re-verified counts (the brief said 23 across `src`, `api`, `supabase`):

| | `America/Los_Angeles` |
|---|---|
| `src/` | **0** |
| `api/` | 7 (3 files) |
| `supabase/migrations/` | 16 |
| `test/` | 3 |
| **live function bodies** | 3 — `_publish_open_slots_for_org`, `ops_day_sheet`, `contract_event_log` |

⚠️ **And five more that are not in the repository at all:**

```
database 5      TimeZone=America/Los_Angeles
role anon       TimeZone=America/Los_Angeles
role authenticated   TimeZone=America/Los_Angeles
role service_role    TimeZone=America/Los_Angeles
role authenticator   TimeZone=America/Los_Angeles
```

(`pg_db_role_setting`; `pg_settings.source = 'database'`.) **No migration sets these.** They are
Supabase-side configuration, invisible to anyone reading the repo, and they are the *only* reason
that `starts_at::date` in `lesson_plans_for_day` — which does **not** convert — happens to produce
the barn's day rather than UTC's. **A correct-by-accident date cast, load-bearing on infrastructure
config nobody can see from the code.**

**There is no timezone column anywhere in the public schema.** A whole-schema search for
`%timezone%`/`%tz%` returns zero columns. The organization row has none.

**And the browser is a fourth authority.** `WeekGrid` computes `openHour`/`closeHour` from
`business_hours` (naked `time` values, meaning Pacific) but places items with
`new Date(it.starts_at).getHours()` — **the viewer's local hours.** In Los Angeles the two agree.
**Anywhere else they do not, and items silently fall outside the drawn band exactly the way the
midnight booking does.** A client travelling east, or a laptop whose clock is set wrong, gets a
calendar with sessions missing and no error.

---

**F24 — CR-82: the horizon. The smallest change is one line, and it introduces one risk that must be
answered in the same change.**

**The mechanism is already there, exactly as the ledger says.** `_ensure_plan_horizon` takes
`p_through`, loops `WHILE v_month <= v_last` in `interval '1 month'` steps, mints the month's
allotment and generates the month's sessions per iteration, and stamps
`config->>'horizon_through'`. `ensure_standing_slots` skips any plan already covered.

**The smallest change (§4 question 6):** in `ensure_standing_slots`, replace

> `v_target date := current_date + 90;`

with the last day of the current month. Nothing else moves. `_ensure_plan_horizon`'s loop then runs
exactly once, the `horizon_through` guard rolls the plan forward on the first calendar load of each
new month, and `_mint_credits_for_purchase_item` stays idempotent behind its unique index.

**Verified in production:** the one live recurring plan (`purchase_item a88722a9`, Steph, `2x Weekly
Lessons`) carries `"horizon_through": "2026-11-28"` — exactly `current_date + 90` — and has **26
future `scheduled` sessions** running Tue+Sat to 2026-11-28. **The 90 days is materialised, not
theoretical**, so tightening it changes real rows.

⚠️ **THE RISK, and it is the reason this is not a pure one-liner.** `ensure_standing_slots` is
called **only** from `CalendarPage`'s mount effect, once per mount
([CalendarPage.tsx:226](src/pages/app/CalendarPage.tsx#L226)), guarded by `rolled.current`. At 90
days that laziness is harmless — there are always three months of runway. **At one month, a client
who does not open their calendar between the 1st and their first session has no session**, and more
importantly **Claire's day sheet, her week strip and the reminder cron all read `bookings`, so they
would show an empty month for a paid client.**

**The fix is small and belongs in the same change:** `/api/mint-monthly-allotments` already runs
daily at `20 8 * * *` and already exists to roll the month. **Have it call `ensure_standing_slots`
(org-wide) as well as `mint_recurring_allotments`.** The read-time roll then becomes a safety net
instead of the mechanism.

---

**F25 — Nothing prorates, the public site promises it, and this is the third instance of that shape.**

Re-verified: **zero** functions in `pg_proc` match `prorat`. The only occurrence in the repo is
[src/pages/Lessons.tsx:52](src/pages/Lessons.tsx#L52) — a footnote on the live public
weekly-subscription cards: *"First month can be prorated or book all your lessons for the month in
the days …"*

**The mechanism, described so the pricing rule can be decided separately:**

- **Both branches hang off the same moment** — the point at which a recurring plan's days are first chosen and `_ensure_plan_horizon` runs for the starting month. That function already knows the month, the chosen weekdays, and therefore **how many of the month's sessions are in the past**. Neither branch needs a new calculation site.
- **prorate = yes** → reduce the order's amount. `set_recurring_days` already recomputes the order's quantity from the day count and already refuses when `quantity_locked` (the order is paid). That is the seam.
- **prorate = no** → mint a `lesson_credits` row for the missed count, with the same `_mint_credits_for_purchase_item` engine (D18 — never a second write path).

⚠️ **Write D23's exemption into whatever spec is authored, verbatim, or the build thread will refuse
the work.** These credits are for slots that passed *before the plan started* — the "session owed
but not delivered at its standing time" holding form D23 itself describes. They are **not** the
spendable balance D23 calls defective. The ledger already says this; it must survive into the spec.

⚠️ **Under D21, the proration formula ships with an editor, not hardcoded.** That is not a reason to
delay it — it is what makes the owner's two open questions (below) non-blocking.

**The pricing rule is his to settle and is OUT OF SCOPE here** — see §8.

---

**F26 — Minor, recorded so nobody re-derives them.**

| | |
|---|---|
| **a** | `itemClass()` has `cancelled` / `expired` branches with `line-through` styling that **can never render** — `calendar_free_busy` filters both statuses out of the read. Dead CSS. ⚠️ And it means **CR-03's *"when it's complete it fades but remains clickable"* is half-built**: `completed` *is* returned and falls into the `default` branch, which paints it solid green like a live session. |
| **b** | `calendar_free_busy` sorts with `jsonb_agg(item ORDER BY (item->>'starts_at'))` — a **text** sort of a timestamptz. It is wrong only inside the DST fall-back hour, where two items an offset apart sort backwards. One line; fix while nearby. |
| **c** | The read has no `deleted_at IS NULL` filter. It is currently safe only because `delete_calendar_item` also sets `status='cancelled'`, which the status filter catches. A coupling, not a guard. |
| **d** | `delete_calendar_item` **hard-deletes** a row with no client, purchase, credit or change request. Under D32 a hard delete is itself a finding — but here it is the **right** behaviour and the reason CR-03's cleanup is cheap: the furniture has none of those four, so it deletes cleanly rather than leaving 587 `cancelled` tombstones. **Record it as a deliberate exception; do not "fix" it.** |
| **e** | `_publish_open_slots_for_org`'s overlap check excludes `cancelled`/`expired` but **not** `draft` — a staff draft blocks publication for that hour. Harmless today; note it if the publisher survives. |
| **f** | `ops_day_sheet` labels each row with the raw `offerings.name` (*"2x Weekly Lessons"*, *"Evaluation Lesson"*). It goes to the ops inbox, so **this is not a D25 breach** — but `booking_service_label` exists for exactly this and is not used, which is F12 again. |
| **g** | `RequestsBar` uses `window.prompt()` for a decline reason and `window.alert()` for a proposal error. Native dialogs on a phone, and unstyleable. |
| **h** | `travel_before_minutes` / `travel_after_minutes` are folded into the window **only in the opaque branch** of `calendar_free_busy`. **Staff never see the travel padding on their own calendar** — the one role that needs to know whether they can get there. |

---

## 5. THE PLAN

Ordered. **The bracketed groups must land together; the numbered steps between them are
independent.**

---

### ⬛ P0 — The two silent overwrites. Independent of everything. Land first.

**P0.1** Add `instructor_user_id` (and `all_day`) to `calendar_free_busy`'s staff branch; the panel
then round-trips them. **Fixes U1 and U2.** One migration, one file. Does not touch any other
finding's files. *(≈20 lines.)*

---

### ⬛ P1 — THE INVERSION. ⚠️ **CR-03 + CR-06 + F4 + F5 + F6 are ONE change and cannot be split.**

Each one invalidates the others if landed alone — the brief says so, and F4/F5/F6 are why.

**P1.1** Stop the generator: remove the `publish_open_slots_all` call from
`api/calendar-reminders.ts`. ⚠️ **Without this, everything below is undone within 60 minutes (F3).**
**P1.2** Retire the 587 existing `available` rows through `delete_calendar_item` semantics (they hard-delete cleanly — F26d). Comment `publish_open_slots` / `publish_open_slots_all` / `_publish_open_slots_for_org` as retained-not-wired under D32; do not drop them.
**P1.3** Make the grid's empty cells clickable when the cell is genuinely empty — which, after P1.1/P1.2, is most of them. Route the click to `RequestTimePanel` for members and the editor for staff. **This is F5 and it is what makes P1.1 safe.**
**P1.4** Move the credit debit onto the request path — either into `request_open_time` or into `confirm_booking`. **F6. Non-optional: without it the barn gives lessons away.**
**P1.5** Retire the `Flexible` checkbox from `CalendarItemPanel`. **Keep all three toggle positions** — per F7, `Unavailable` becomes load-bearing the moment availability inverts.
**P1.6** Teach `dash_week_strip` and `WeekZone` that there is no such thing as an "open slot" any more (F18).
**P1.7** `itemClass`: make `completed` fade rather than paint solid green — CR-03's own words (F26a).

**Test before/after:** the week of 2026-09-07 goes from **84 available + 2 real** to **0 + 2**.

---

### ⬛ P2 — THE DRAWING. Depends on P1 only for legibility, not correctness. `CalendarPage.tsx` only.

**P2.1** Place items by offset from `openHour` and **size by duration**; render out-of-hours and `all_day` items in a rail above the grid. **One change, three symptoms (F9): CR-02, CR-05's sizing, and F8's invisible closed days.**
**P2.2** Sort `dayItems` and lift the `slice(0, 3)` cap in month view — or, better, once P1 has landed there is rarely more than 3 (F1).

---

### ⬛ P3 — DURATION. ⚠️ **Blocks CR-07. Must land before P5.**

**P3.1** `offerings.duration_minutes` (nullable int) + the field on the offering editor (**D21 — it ships with the editor or it does not ship**).
**P3.2** Resolve as `coalesce(purchase_items.config→duration_minutes, offerings.duration_minutes, 60)` in every writer that computes `ends_at`. `Evaluation Lesson` = 90; everything else = 60.
**P3.3** Do **not** back-fill the three existing non-60 rows (F11) — two are the data-entry errors of F10.

---

### ⬛ P4 — NAMING. Independent. Can run parallel to P2/P3.

**P4.1** `calendar_free_busy` emits `service_type` (via the existing `booking_service_type`) and, in the staff branch only, `client_name` (F13).
**P4.2** **Delete `itemLabel`**; render through `serviceWording` (F12). Staff rows become *"5:30 · Steph · Riding Lesson"*; a member's care row gets the right service and the right noun.
**P4.3** Clear the two staff "booking" strings.

---

### ⬛ P5 — CR-07, THE CLASH-AWARE PICKER. ⚠️ **Blocked on P1 and P3, in that order.**

Both dependencies are real and both are already in the ledger: while the furniture exists every hour
looks busy and a clash check refuses everything; and a clash check without durations cannot know
what "busy" spans. **Replace the two free-form `datetime-local` boxes with a 30-minute-increment
dropdown that reads real bookings and the resolved duration.** This also closes F10's root cause —
you cannot type 00:00 into a dropdown that starts at 08:00.

---

### ⬛ P6 — THE HORIZON. ⚠️ **Two parts that must land together (F24).**

**P6.1** `ensure_standing_slots`: `v_target` becomes the last day of the current month.
**P6.2** `/api/mint-monthly-allotments` also calls `ensure_standing_slots` org-wide. **Without P6.2, P6.1 turns a lazy read into a single point of failure.**

---

### ⬛ P7 — Independent one-liners, any order, any thread.

**P7.1** `pageRegistry` row for the Calendar + correct the stale header comment (F20). ⚠️ **Coordinate with `TASK-AR4`** — same file, same week.
**P7.2** Comment `calendar_revenue` in its own body as superseded by `revenue_summary` (F14).
**P7.3** Decide `calendar_money_items`: wire or comment (F15).
**P7.4** Align `dash_week_strip`'s status filter with `ops_day_sheet`'s (F17).
**P7.5** `WeekZone`'s per-session chips become `bookingHref` links (F16). ⚠️ **The single cheapest fix in this report and it closes half of CR-01.**
**P7.6** Fold travel minutes into the staff branch of the read (F26h).
**P7.7** `window.prompt`/`window.alert` → real UI (F26g).

---

### ⬛ P8 — MOBILE (F21). Independent, and the largest single piece of UI work here.

**P8.1** A **day view** as the phone default. The week grid at 95 px/column and the month grid at 52 px/column are not mobile designs.
**P8.2** Collapse the legend and the toolbar behind a control on small screens so the grid is above the fold.

---

### ⬛ P9 — CR-71, THE HORSE. ⚠️ **Prove the seam before extending it.**

**P9.1** Close the four write paths that skip `horse_time_conflict` (F19). Independent of everything, and worth doing on its own merits.
**P9.2** ⚠️ **Get one booking in production to carry a `horse_id`** before any limit is designed. Zero ever have.
**P9.3** Only then: a per-horse limits structure + the **range read across dates** that consecutive-day limits need and that does not exist today. **Reuse `recurring_days`' weekday vocabulary.**
**P9.4** ⚠️ **Design for retroactive breakage from the start** — cancelling a rest day puts a horse over its consecutive limit with nobody touching that horse's booking. That is an evaluation that has to run on *cancellation*, not only on booking.

---

### ⬛ P10 — PRORATION (F25). Blocked on an owner ruling — see §8.

---

## 6. TEST CRITERIA

Every one is a query or a rendered fact. **None may cite `test:db`** — 51 files are red on `main`.

| # | Fix | Provable by |
|---|---|---|
| T1 | **U1** | Set `instructor_user_id` on a session to user A. Open it as user B, change only the notes, Submit. `select instructor_user_id from bookings where id=…` **still returns A.** |
| T2 | **U2** | `close_day('2026-12-25')`. Open the block, Submit unchanged. `select all_day …` **still true.** |
| T3 | **P1.1/P1.2** | `select count(*) from bookings where status='available'` → **0**. Wait 90 minutes. **Still 0.** ⚠️ The second half is the test — the first half passed before F3 was known. |
| T4 | **P1.3** | On the week of 2026-09-07 as a member, click an empty 14:00 cell → `RequestTimePanel` opens with that time prefilled. |
| T5 | **P1.4** | Member with `credits_remaining = 4` requests a time; staff confirms. `select credits_remaining …` → **3**, and the booking's `credit_id` is non-null. |
| T6 | **P2.1** | With a 90-minute session at 16:30 and a 60-minute one at 18:00, the first renders **1.5× the height** of the second. A 00:00 item and a `close_day` block **both appear in the all-day rail**. |
| T7 | **P2.2 / F1** | Month view, 2026-09-01: both 16:30 and 17:00 are **visible and clickable**, and clicking one **opens the panel without leaving month view**. |
| T8 | **P3** | `select ends_at - starts_at from bookings where offering_id = <Evaluation Lesson>` → **90 minutes**, for a booking created after the change. |
| T9 | **P4** | Signed in as `hello@`, a chip on a scheduled session reads the client's name and *"Riding Lesson"* — **the string "Reserved" appears nowhere in the rendered DOM for a staff session.** |
| T10 | **P5** | The start control offers 30-minute increments only, refuses a time overlapping an existing session, and **cannot express 00:00**. |
| T11 | **P6** | `select config->>'horizon_through' from purchase_items where id='a88722a9…'` → **the last day of the current month**, not `current_date + 90`. Then run `/api/mint-monthly-allotments` on the 1st of a month and confirm the value advances **without anyone opening the calendar**. |
| T12 | **P7.1** | The Calendar appears as a toggleable row on `AdminPageVisibilityPage`; turning it off removes it from **both** rails. |
| T13 | **P7.4** | Confirm a horse-care session (→ `status='confirmed'`). It appears in **both** `dash_week_strip` and `ops_day_sheet`. |
| T14 | **P7.5** | Click a session chip in the dashboard's "This week" → the calendar opens **with that session's panel already open** (`?item=` present in the URL). |
| T15 | **P8** | At a 393 px viewport, the default view needs **no horizontal scroll** and the first session is visible **without scrolling vertically**. |
| T16 | **P9.1** | As a member, book an open time for a horse already booked in that hour → refused with a real message, not a constraint error. |

---

## 7. SUCCESS, AT TWO LEVELS

**Per fix — the one sentence each must earn:**

| | |
|---|---|
| **U1/U2** | Nothing about a session changes except what the person on the screen changed. |
| **P1** | The calendar is empty where the barn is free, and asking for a time is a click on that emptiness. |
| **P2** | An item's position and size on the grid are the truth about when it is and how long it lasts. |
| **P3** | The system knows an evaluation takes 90 minutes, and the owner set that himself. |
| **P4** | Claire reads a name and a service on every row; a member reads the barn's words for what they bought. |
| **P5** | A time that cannot happen cannot be entered. |
| **P6** | A month opens on time whether or not anybody opened the calendar. |
| **P7** | Every count of "what's on the schedule" comes from one definition. |
| **P8** | The owner can run his day from the phone in his pocket. |
| **P9** | A horse cannot be in two places at once, on any path. |

**For the area as a whole — the test the owner will actually apply:**

> ⚠️ **He opens the calendar on his phone, in month view, and every real thing that is happening is
> visible and openable, and nothing that is not happening is drawn at all.**

Today that sentence fails on all four counts: month view shows three empty hours a day (F1), real
sessions are unreachable behind "+11 more" (F1), the chips are not individually clickable (CR-01),
and 88% of what is drawn is not happening (F2). **Those four are one paragraph and they are the
task.**

---

## 8. FLAGGED, NOT FIXED

| | Item | Route to |
|---|---|---|
| **1** | ⚠️ **The proration PRICING RULE.** Two open owner questions, both still open: **(a)** pro-rata per remaining lesson, or to a whole number of weeks? *(2× weekly at $880/mo is $110 a lesson at 4 weeks; a half month is not always 4 of 8.)* **(b)** Do the no-prorate credits expire? D23's holding-form credits do; these compensate for a month paid in full. **The mechanism is specced in F25; the rule is his.** ⚠️ **Under D21 he sets it in an editor, so neither question blocks the build.** | **OWNER** |
| **2** | ⚠️ **The two Madeline Do bookings of 2026-08-28.** Confirm both are hers before either goes (F10). Under D32 both survive as `cancelled` rows. | **OWNER** |
| **3** | **CR-71's two collisions.** A lease reserves four days on a horse whose record allows three — **which wins, and who is told?** And: hard block or staff-overridable warning? Do the limits apply to a farrier visit, or only to riding? | **OWNER** |
| **4** | ⚠️ **Standing Q4 on the item panel, unanswered.** CR-01's ASK-OWNER: is the panel worth **centring**, or worth **redesigning**? This report deliberately does not answer it — CR-30 asked the same question of the contact modal and the answer was "throw it out." **A 15-field form in a 448 px rail is the symptom; whether the form is right is a different question, and it is `TASK-AR2`'s territory as much as mine.** | **OWNER + AR2** |
| **5** | **The Calendar nav row's move** into Management. Mine to *report* (F20); AR4's to *land*, same file. | **`TASK-AR4`** |
| **6** | **`/app/schedule` and `/app/ops/lessons/sessions`** — two more listings of the same rows (F16). Neither is a calendar; both are records surfaces. | **`TASK-AR4`** (nav) / records |
| **7** | **The 2× weekly client who "cannot be setup for it"** — the owner's 2026-08-27 walkthrough. Touches `CalendarItemPanel`'s monthly-plan block, but the defect is in reaching the client record. | **`TASK-AR2`** |
| **8** | ⚠️ **The barn timezone lives in Supabase config, not the repo (F23).** Out of scope for the calendar, in scope for the multi-tenant rebuild: **five settings nobody can see from the code, and no column for a second tenant to state its own.** | **ORCH6 → rebuild** |
| **9** | **`api/calendar-reminders.ts` also owns two email jobs and the day sheet.** P1.1 removes one line from it; everything else in that file belongs to the notifications work. | **G4 / notifications** |

---

## 9. CONTENDED FILES

⚠️ **Required for ORCH6's build ordering.** Grouped by which plan step touches them.

| File | Steps | Also wanted by |
|---|---|---|
| `src/pages/app/CalendarPage.tsx` | **P1.3, P1.7, P2.1, P2.2, P4.2, P5, P7.7, P8** | — ⚠️ **the single most contended file in this report; six of ten steps touch it** |
| `src/pages/app/CalendarItemPanel.tsx` | P0.1, P1.5, P4.3, P5 | `TASK-AR2` (the 2× weekly plan block) |
| `src/lib/ops/api-calendar.ts` | P0.1, P1.4, P3.2, P4.1 | — |
| `src/pages/app/CalendarSettingsPanel.tsx` | P1.5 (if the publisher gains a control) | — |
| `src/components/app/StandingSlotPicker.tsx` | P3.2 | `TASK-AR2` |
| `src/components/app/dashboard/TrainerZones.tsx` | **P1.6, P7.5** | ⚠️ **dashboard work — coordinate** |
| `src/lib/dashboard/registry.ts` | P4.2 (`serviceWording` becomes shared) | dashboard work |
| `src/lib/pageRegistry.ts` | P7.1 | ⚠️ **`TASK-AR4` — same file, same week** |
| `src/components/app/AppLayout.tsx` | — *(read only)* | ⚠️ **`TASK-AR4` owns it** |
| `api/calendar-reminders.ts` | **P1.1**, P6.2-adjacent | notifications / G4 |
| `api/mint-monthly-allotments.ts` | **P6.2** | billing / G5 |
| `vercel.json` | P1.1 (only if the cron entry itself changes) | — |
| `src/pages/Lessons.tsx` | P10 *(the public proration promise)* | ⚠️ **public site — do not touch without a ruling** |
| **New migration:** `calendar_free_busy` | P0.1, P4.1 | — |
| **New migration:** `save_calendar_item` | P0.1, P3.2 | — |
| **New migration:** `request_open_time` / `confirm_booking` | P1.4 | — |
| **New migration:** `book_open_slot`, `update_my_pending_booking`, `request_booking_change`, `propose_booking_time` | P9.1 | — |
| **New migration:** `ensure_standing_slots` | P6.1 | — |
| **New migration:** `dash_week_strip` | P1.6, P7.4 | dashboard work |
| **New migration:** `offerings` + `_generate_plan_month` + `generate_monthly_lessons` | P3 | billing / G5 |
| **New migration:** `calendar_revenue` comment | P7.2 | — |
| **New migration:** `horses` limits + range read | P9.3 | `TASK-AR3` (My Stable) |

**Safe to run fully in parallel with everything else:** **P0** (two RPC bodies + one panel),
**P7.1** (registry, if AR4 has not started), **P7.2/P7.3** (comments only), **P9.1** (four RPC
bodies, no UI).

**Must be one thread, one branch:** **P1**, in full. Five sub-steps across four files and three RPCs
that each break the others if separated.

---

## 10. TEARDOWN

**Processes started by this thread:** `psql` only, one connection at a time, every invocation
short-lived and already exited. **No dev server, no watcher, no browser harness, no background job.**

Process census at close:

```
$ ps -Ao pid,comm | grep -Ei 'psql|postgres|vite|node .*dev|chromium|playwright' | grep -v grep
(no matching processes)
```

**Database:** production was read with `SELECT` only. **No `INSERT`, `UPDATE`, `DELETE`, `BEGIN` or
DDL was issued.** No mutation probe was needed. **Pamela Godde's live lease
(`7adcd08f-fd5d-40f9-b726-634074266d7c`) was never read, referenced or touched.**

**Worktree:** `/Users/cactai/Downloads/claude-code-repo/wt-ar1`
**Branch:** `task/ar1` (from `origin/main` @ `bb49e713`)
**Committed:** this file only. **Not pushed.**
