# CHANGE-ORDER LEDGER — FHE, thread of 2026-08-24/25

**This is the STEP 1 artefact.** It is a ledger, not a narrative. Its only job is to hold every
captured request in a shape that lets steps 2 and 3 run without failure.

**Method:** `docs/METHOD-change-orders.md`. **Narrative + evidence so far:**
`docs/tasks/TASK-DAYSHEET-…md` (19 sections) — that document is the *working notes*; THIS is the
ledger of record.

## HOW TO READ AN ENTRY

```
CR-nn  ·  GROUP  ·  status
  SAID        the owner's words, verbatim
  A/B         where he offered an alternative mid-message — BOTH are recorded, neither is chosen
  ASK-REPO    questions for the code/DB, answered in step 2 (fact-finding)
  ASK-OWNER   questions for him, raised in step 3 (review) — unless step 2 answers them first
  FOUND       step 2 result, in plain language
  LOCKED      step 3 decision + what success looks like
```

**`status`** — `captured` · `researched` · `locked` · `built`.

## THE FOUR STANDING QUESTIONS

Asked of **every** entry, every time (owner, 2026-08-25):

1. **Is there a global solution already in place?**
2. **Is this request already implemented anywhere else?**
3. **What is the right way to deliver this** — UI, UX, architecture, design?
4. **Am I fixing something attached to something that needs replacing or reimagining entirely?**

⚠️ **Q4 is not theoretical.** It is the question that changed CR-30: the owner wrote a list of fixes
for the contact modal, then saw Pamela's page and realised *"the modal needs to be total thrown out
as is and should be reimagined entirely."* **Ask it before researching, not after building.**

---

# THE GROUPS

| # | Group | Why these belong together |
|---|---|---|
| **G1** | **Calendar surface** | one page, one item panel, one read (`calendar_free_busy`) — research once |
| **G2** | **Booking provisioning** | the panel's form: order of questions, what it may offer, what it writes |
| **G3** | **Claire's day** | the day sheet, dispositions, the item log |
| **G4** | **Notifications & email** | one transport, one cron, one notification table |
| **G5** | **Billing & pricing** | cadences, the evaluation rule, what payment unlocks |
| **G6** | **People surfaces** | lead vs client, modal vs page — **CR-30 may replace this whole group** |
| **G7** | **Orders & paperwork editing** | line-item editing wherever it appears |
| **G8** | **The request→order spine** | approval, opening an order, the states nothing drives |
| **G9** | **Globalization inventory** | feeds the post-fix refactor; every group contributes to it |

---

# G6 · PEOPLE SURFACES

## CR-30 · G6 · captured ⚠️ SUPERSEDES CR-31…CR-36
**SAID**
> *"the modal needs to be total thrown out as is and should be reimagined entirely and the contact
> record page needs the same treatment and the modal design is a great layout for the contact record
> page to inherit and build upon"*

**Context he gave for the change of mind:** *"as I was writing the change requests for it i thought
i was giving you the right set of requirements, then when i saw the page for pamela i realized i
gave you the wrong things to focus on."*

**A/B** — none offered; this is a **replacement of his own earlier requests**, which are retained
below as CR-31…CR-36 because their *content* still describes what he wants the reimagined surface to
do. **They are requirements for the new thing, not fixes to the old one.**

**ASK-REPO**
1. What is on the contact record page today that is **not** on the modal, and vice versa? (the
   union is the requirement)
2. Which reads back each — one RPC, or many? Can one read serve both?
3. How many *other* surfaces show a person? (Leads, Partners, Vendors, Archived, Review mounts,
   Clients) — do they all become the same thing?
4. What does `RosterCard` uniquely carry (badges, rings, flags, `AgreedLessonSection`) and where
   does each land in the new design?
5. Is any of this reachable by URL today, and what breaks if the address changes? (D17)
6. **Standing Q1:** is there a global layout/shell this should be built from, or does it become one?

**ASK-OWNER**
1. Is the reimagined surface **one thing in two modes** (quick view / full record), or **two
   things**?
2. Does a lead ever need the full record, or only the submission + promote?
3. What must be visible **without a click** on the client surface?

---

## CR-31 · G6 · captured — *requirement for CR-30's rebuild*
**SAID**
> *"i have no way to add a horse to pamela godde's client record, i cant see anything about her
> beyond what is shown on the main record page."*

**FOUND (step 2, done)** Pamela has **no horses and no tags**. The client surface has no horse-add;
the lead surface has one. **The person who needs the record least has it.**

**ASK-OWNER** — none outstanding.

---

## CR-32 · G6 · captured — *requirement for CR-30's rebuild*
**SAID**
> *"the lead modal should be what i get when i click a client card and the client page is what i
> should see when i click a lead card … the page is much better on desktop, the modal is for quick
> access on a page you dont want to leave, for a lead, this would show me the form they submitted
> and give me a quick access point to promote to a client record (activate them as an account),
> thats it. at most i can modify their order contents before i do it"*

⚠️ **A/B, in his own message** — he states the swap, then qualifies it:
- **A** — literal swap: client gets the modal, lead gets the page.
- **B** — by *kind of surface*: **client gets a PAGE** (rich, desktop-first), **lead gets a MODAL**
  (quick, one act: promote). B is what the rest of the message describes.
**Neither is chosen. Discuss in step 3.**

**Caveat he attached:** *"i might be on the phone and the phone is my working device for modifying
the lead record"* — whatever wins must work on a phone.

---

## CR-33 · G6 · captured
**SAID**
> *"why does a lead modal have more data fields and functionally work far better than the actual
> client page we show after a lead becomes a client."*

**FOUND (step 2, done)** The client page is where the modal's parts came from — `ClientRecordActions`
says so in its own header — and it was never switched over to them. **This is the evidence for
CR-30, not a separate fix.**

---

## CR-34 · G6 · captured
**SAID**
> *"what i really need to see is their for[m] submission and contact information and contact
> preference. two clicks and im either calling, texing or email and fully equipped with all the
> relevant information i need to have a conversation with them."*

**FOUND (step 2, done)** Everything is already captured on the request row — including the contact
preference. **But it never reaches the contact record**, so it is lost the moment they become a
client. **Two clicks is the acceptance test.**

**ASK-REPO** — does anything else read the request row for display, and would it also want this?

---

## CR-35 · G6 · captured
**SAID**
> *"we should keep a snapshot of what they send us in the form and the changes should happen on
> promotion to account, this way we can spot trends like upselling or people wanting more than they
> should be requesting."*

**FOUND (step 2, done)** Nothing preserves it. The submitted text is editable in place and **there is
no audit table anywhere in this database.** Serving the customer destroys the trend.

**ASK-OWNER**
1. Snapshot the **whole submission**, or only what they asked to buy?
2. Should the difference be **visible on the record**, or only in reporting?

---

## CR-36 · G6 · captured
**SAID**
> *"keep it one size dont change it based on the contents when i switch tabs it is constantly
> resizing and it stays center aligned which makes it really uncomfortable … keep it the full size
> and keep it locked in the center of the screen."*

**status: built** — but ⚠️ **built on the surface CR-30 throws away.** Carry the requirement, not
the code.

---

# G1 · CALENDAR SURFACE

## CR-01 · G1 · researched
**SAID** *"i still cant click on things in the month view and get them to open and keep me in the
month view. it should open a modal not take me to the week view."*
**SAID** *"the dashboard shows the weekview of whats on the schedule and again, clicking something
should open the modal but it takes me to the calendar."*
**SAID** *"the booking provisioning and view is always a right side panel and it fucking sucks we
need a large modal in the center of the screen."*
**FOUND** Three complaints, one cause: the item panel is part of the calendar page, so nothing else
can host it. It is already an overlay — it is simply pinned to the right edge and 448px wide for a
fifteen-field form.
**ASK-REPO** ⚠️ **Standing Q4 applies — does the item panel need reimagining rather than
re-positioning?** CR-30 asked exactly this of the contact modal and the answer was yes.
**ASK-OWNER** Same question as CR-30's: is this panel worth centring, or worth redesigning?

## CR-02 · G1 · researched
**SAID** *"there is something booked for 12am which is a physical impossibility and i have no way to
open it because it only shows in the month view and its out of range in the week view."*
**FOUND** One booking, midnight to 1pm. Unreachable for two reasons: the week grid only draws
business hours, and an item is placed by its start hour only — so even a booking running through 1pm
appears in no row. Cause of the value itself: a 12 AM / 12 PM slip, corroborated by an identical
booking made the next day.
**ASK-OWNER** Confirm the two bookings are the same client before deleting either.

## CR-03 · G1 · researched
**SAID** *"the calendar still shows a full list of all the open slots in green blocks, we need to
remove this and just make the calendar open for booking by being empty … if something is booked on
the calendar in a specific slot it shows as unavailable to anyone not involved and for something
that doesnt have a specific time it just shows at the top of the day as an item being don[e] on that
day, when the item is confirmed it changes from orange to green and when its complete … it fades but
remains clickable and editable."*
**FOUND** The green blocks are generated hourly by a job. **92% of everything in the bookings table
is that generated furniture.** Removing it also removes the thing the self-booking path books.
**ASK-REPO** What replaces client self-booking once there are no published slots? *(one candidate
already exists)*
**ASK-OWNER** Delete the existing generated rows, or let them age out?

## CR-04 · G1 · researched
**SAID** *"the calendar bookings still show reserved instead of the client name and activity (week
and month view)."*
**FOUND** The read already sends staff the full detail **and already labels the row as staff** — the
screen just never looks at that label, so staff fall through to the same "Reserved" a stranger sees.
**ASK-REPO** The read sends ids, not names — add names for staff, or look them up on screen?

## CR-05 · G1 · researched
**SAID** *"the calendar still shows bookings as 30 minutes when they should show 90 minutes for an
evaluation lesson and 60 minutes for all other lessons."*
**FOUND** The bookings are already an hour long — the calendar simply never looks at how long
anything is, and draws every item the same size. **Nowhere in the system records how long a service
takes.**
**ASK-OWNER** Duration for every service, or only lessons for now?

## CR-06 · G1 · captured
**SAID** *"the scheduling panel still has the three position toggle at the top … it needs to be
decommissioned, whatever its wired into and whatever controls it or whatever it controls all need to
be dissolved and reconfigured so we dont break anything that is working."*
**FOUND** Two of its three positions have never been used, ever. The third is how availability gets
published — which CR-03 removes.
⚠️ **CR-03 and CR-06 must be researched and decided TOGETHER**; each changes the evidence for the
other.

## CR-07 · G1 · researched
**SAID** *"the time selection should be a dropdown list of the 30 minute increments a person can
choose and it should account for what is on the calendar and the duration of the booking."*
**FOUND** Today both start and end are free-form date-and-time boxes, which is what allowed CR-02.
⚠️ **Depends on CR-05** (nothing knows durations) **and CR-03** (while the generated slots exist,
every hour already looks busy, so a clash check would refuse everything).

---

# G2 · BOOKING PROVISIONING

## CR-08 · G2 · researched
**SAID** *"we are being asked to select a product before we select the client and the inverse is the
right approach. we select a client, then we see what the client has available, if they are a weekly
rider or if they have credits we should see that"*
**FOUND** The screen asks for the product first, and the code proves the order is backwards: the
client field's own label is decided by which product was picked. Nothing on the panel is narrowed by
who the client is — every offering and **every horse in the system** is offered on every booking.
**ASK-OWNER** Hide what is not relevant, or just sort it to the bottom? (Hiding is decisive but
invisible.)

## CR-09 · G2 · researched
**SAID** *"if they dont have a paid offering purchased that matches the selection … we generate that
offering by creating the scheduled booking. if they have that offering we see it and we are using
what they purchased."*
**ASK-REPO** ⚠️ When a booking creates an order, is it created in a state that actually **opens**?
See CR-27 — an order that stays unopened is exactly the live defect on Rachel Page's record.

## CR-10 · G2 · researched
**SAID** *"we only show horse care services for clients with a horse. if they dont have a horse in
the system that means we dont have the paperwork signed from them … we dont need to add any text to
the ui to explain this, its self evident … it should honor our rules not ignore them."*
**FOUND** ✅ **The rule already exists and is enforced when the booking is saved** — a care booking
is refused without a horse and without that person's care paperwork for that horse. **Only the
screen ignores it**, so staff can pick the service and hit the wall at the end.
⚠️ **"Has a horse" is two different relationships** — owning one and leasing one. A lease client has
a horse in their care without owning it.
⚠️ Scale: **there is exactly one horse in the system.** The rule will hide horse services from
everyone but one person, and that will look like a bug.

## CR-11 · G2 · researched
**SAID** *"the repeat weekly is weird … the primary selection is "just once" which literally reads
repeat this one time."*
**status: built** (wording) — the underlying control is CR-12's.

## CR-12 · G2 · captured
**SAID** *"this is not the surface for setting a weekly lesson … the primary option is the client
card where they or us can set their weekly riding day and time which then appears automatically on
the calendar until its renewed at the end of the month for the next month. if we do want to repeat a
lesson it would be because they have credits or they intend on purchasing a punch card."*
**FOUND** The standing-weekly machinery is **already built** — it is simply on the wrong screen.
⚠️ **This is a MOVE, not a build**, and it may also fix a related feature previously recorded as
unreachable.
⚠️ **The destination is the client card — which CR-30 is throwing away and reimagining.** Sequence
after CR-30.

## CR-13 · G2 · captured
**SAID** *"the trainer is always claire there is no need to select a trainer when a lesson or any
other service is scheduled."*
**FOUND** The field is already skipped far more often than used, and skipping it loses who taught the
lesson entirely.
**ASK-OWNER** The bookings with no instructor recorded — leave them blank, or assume Claire?
⚠️ Do not write her identity into the code; it belongs in settings.

## CR-14 · G2 · captured
**SAID** *"for the horse section we should be able to write in the name of a horse and claim it later
for a horse record. right now its either select from the list or no horse lol"*
**SAID** *"the unclaimed horse name gets claimed when a horse is being added to an account. you can
pick it from a list of horses (which should only show the names of horses that arent assigned to
someone, and to prevent a horse getting locked to a person automatically, i need to be able to change
the owner from the horse record)"*
**SAID** *"likewise i can select the owner of a horse record that lives as a name only"*
**FOUND** ✅ **Two of the three already exist.** Changing a horse's owner from the horse record, and
resolving an owner who is only a name, are both built — and ownership is kept as history, so a horse
is never locked to anyone. **Not built:** no list anywhere is filtered to horses nobody has claimed,
and a booking has nowhere to put a horse's name that is not yet a record.
**ASK-OWNER** If the existing owner control is not discoverable, is the problem the control or where
it lives?

---

# G7 · ORDERS & PAPERWORK EDITING

## CR-15 · G7 · built
**SAID** *"the attach offering needs to be revised to "+ Add offerings" and the order should be the
[f]irst thing on the page not the last, and then the option to add an offering to the order lives
under the line item for the offering they selected … make it an outline that holds space for a new
line item … the size of the text and … square … remove the rounded square surounding … the rounded
corners on the outside with sharp corners on the elements inside looks weird."*
⚠️ **Built on the surface CR-30 discards.** Carry the requirements.

## CR-16 · G7 · captured ❗ BLOCKED
**SAID** *"we need to be able to change the offering they ordered... i dont see any way to do that
here."*
**FOUND** Cancelling a line is possible; **adding one to an existing order is not** — the only "add"
makes a *second, separate order*. So the obvious shortcut would leave a cancelled order plus a new
one, rather than a changed one.
**ASK-OWNER** *(all three block the build)*
1. Does the **price follow the new offering**, or is the agreed amount held?
2. What happens on an order that is **already paid**?
3. A weekly plan carries the days they chose — what happens to those, and to any month already put
   on the calendar?
⚠️ **His own widening question, unanswered:** *are there other line-item actions the same surface
needs* — change quantity, comp or override a price, void the order, mark it paid, switch cadence?

## CR-17 · G7 · built
**SAID** *"why is this shown to me in the ui … 'The first lesson for anyone new … is an evaluation
lesson — plan for an extra 30 minutes total' … the evaluation being a requirement means it should be
the only riding lesson option to select right now until i select it nothing else can be added from
that category. this is handled by software not by surfacing words i read and comply with, also the
notes like that are things that should be in the client facing content not things facing me as the
admin."*
**FOUND** The customer-facing shop already worked this way. Only the staff screen asked politely.

## CR-18 · G7 · built
**SAID** *"horsemanship should be shown below lessons, then horse training then exercise then
clipping."*
**ASK-OWNER** Jumper training was not in the list — where does it belong? *(currently last)*

## CR-19 · G7 · built
**SAID** *"the entire surface is a bit too large the items [c]an be an order form with line items i
add and select from a list on a menu not a giant list of everything with check boxes its a terrible
waste of space and on mobile its going to be a nightmare."*

## CR-20 · G7 · built
**SAID** *"the same for the paperwork, we can preselect and make rows for the documents they should
be signing but that comes after the selection of offerings … just show a row with the menu to select
a new document and the placeholder selection says select a document to add it, and when i select
something it becomes a row and the x is there to delete it and the new empty selectable row appears
below the one i just added and moves up when something is deleted."*
⚠️ **His A/B, in one sentence** — he offered two shapes and then chose:
- **A** — an X on each row plus a **`+` button** that adds an empty row revealing a dropdown.
- **B** — *"or just show a row with the menu"* — a permanent trailing menu row, no button.
**B was built** because it is the one he elaborated. **Confirm in step 3.**
**ASK-OWNER** The separate Paperwork tab was not touched — same treatment?

---

# G3 · CLAIRE'S DAY

## CR-21 · G3 · captured
**SAID** *"the in app notifcation isnt needed if we have a static daily view for claire with a next
up card and the daily view should advance as the day progresses so shes not looking at a card that
shows the day ahead and seeing things that already happened, those belong on a separate list further
down the page so she can click on them to add notes or do something to the lesson or scheduled
activity like horse care service or task like giving a horse its supplements or medicine or
contacting the vet."*
**FOUND** A "today" list already exists on her dashboard. What is missing is the shape: a next-up
card, items leaving the forward list as they pass, and a separate list below for what is done.
**ASK-OWNER**
1. Does an item leave the forward list when it **starts**, or when it **ends**?
2. At the end of the day, does the view show **tomorrow**, or nothing?

## CR-22 · G3 · captured
**SAID** *"Each of these items also needs to have a way for her to record the status as complete,
skipped, no-show (when the client doesnt show up or the horse isnt available), things like cancelled
or rescheduled are self explanatory and we can record them in the log for that item so we know when
we look at a future booking that it was actually something that was rescheduled or when we look back
at an item we see it was cancelled, the client didnt show, the horse wasnt there or was unavailable,
or the booking was rescheduled."*
**FOUND** ✅ **"Complete" and "no-show" already exist in the system's vocabulary** — they have simply
never been used. Only "skipped" is genuinely missing. There is already a history log used by other
record types that bookings are not yet part of.
**ASK-OWNER**
1. Client no-show and horse unavailable — **one status with a reason**, or two statuses?
2. Does marking something complete **do** anything (consume a credit, trigger billing, prompt for
   notes), or is it just a label?
3. Can anyone set it, or only Claire?

## CR-23 · G3 · captured
**SAID** *"whether a task is a booking row or a day is determined by claire which is informed by the
requirements setforth by the client in the offering purchase conversation, unlikely to codified from
the purchase but this is where we can either add that capability to certain purchases or contracts
capturing it can use the right tokens and structured fields so that the information can be utilized
rather than just read by the contract parties."*
**FOUND** Timed-versus-all-day is her judgement, not something to derive. Separately: the contract
system **can already capture structured information** — including a medication schedule and a weekly
day grid — but **everything that reads it only turns it back into wording for the document.** Nothing
uses it to do anything.
**SAID (correction, same day)** *"we dont have an offering in horse care that involves giving
supplements or medication … it cant hurt to have it in writing but it would be in a notes field and
only AI can make use of that and AI is a v2 platform feature."*
⚠️ **So the medication field generates NOTHING.** The one structured field worth wiring is the
lease's reserved weekly days — because that is something the client actually bought.

---

# G4 · NOTIFICATIONS & EMAIL

## CR-24 · G4 · researched
**SAID** *"the new email system for notifications about upcoming lessons is working but its doing too
much, we need a daily email at 7am with the days rundown sent to hello@fhequestrian.com and a client
email at 9am (or 1 hour prior to their scheduled time if their scheduled booking is earlier than
10am) and then a reminder email 1 hour prior for the client and hello@fhequestrian.com"*
**SAID** *"just make it fire off at 1 hour prior based on every hour and give extra time always so it
sends it 1.5 hours prior instead of 30 min prior."*
**SAID** *"clients get 1 email"*
**SAID** *"tenant timezone is a good point, all activity is rooted in pst, Los [A]ngeles."*
**FOUND** The reminder job runs and works. It sends on the two-hour mark as well as the one-hour
mark, and emails each alert the moment it appears rather than at a chosen time. **The barn's timezone
is written into the code rather than kept as a setting.**
**ASK-OWNER** A booking made inside its own reminder window never gets a reminder. Accept that, or
send one on creation?

## CR-25 · G4 · captured
**SAID** *"it appears she placed an order, thats great, i didnt notice any big notification, no email
alert, nothing, telling me we got an order for a monthly subscriber riding weekly 2x."*
**FOUND** Two separate reasons. **There is no "an order was placed" alert in the system at all** — so
nothing failed, nothing exists. And **her order was never opened**, so even the paperwork and credits
that normally follow an order did not happen. *(See CR-27.)*
⚠️ Also found: the **lead** alert did reach him, but only 2 of 12 such alerts have ever been emailed
at all.

## CR-26 · G4 · captured
**SAID** *"we need to surface a payment notification sent to the client 3 days prior to the end of
the month and then we surface payment notifications to us when they say they paid so we know to check
and we need to surface a list of monthly riders who owe payments reminding us to monitor for their
payment … the riders are informed automatically 3 days prior that payment is due within the next 3
days and then on the day its due we send them another email and for both of these we surface a
notification starting at the 3 day mark and it counts down to your payment is due today and it
extends into your payment is past due by and it counts the days."*
**FOUND** ✅ The client's "I have paid" declaration **already exists end to end** — telling Claire to
check it is a surfacing job, not a build. Nothing else here exists.
**ASK-OWNER** What happens to a rider who never pays — does the countdown run forever, or does the
plan lapse?

---

# G8 · THE REQUEST → ORDER SPINE

## CR-27 · G8 · researched
**SAID** *"it doesnt appear the pending status is working properly and likely the approval process for
a request isnt working properly either"*
**FOUND** Both are the same thing, and it is worse than a bug: **the steps were designed and never
connected.** A request has ten possible stages and every one ever created sits at the first. **No
part of the system can approve one.** Bookings have twelve possible states and only four have ever
been used. And Rachel Page's order — the only one that came from a request — is still sitting
unopened, which is why she received no paperwork and no credits.
⚠️ **This is the hinge for CR-09, CR-25 and the whole of G5.** It is a build, not a repair.
**ASK-OWNER**
1. Which stages does the barn actually use? Ten were designed; you may only need three.
2. Is **approving the request** the same act as **opening the order**, or two acts?
3. Who can approve — Claire only, or CJ as well?
