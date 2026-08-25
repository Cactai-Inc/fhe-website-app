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

## CR-30 · G6 · captured — surface model ✅ SETTLED ⚠️ SUPERSEDES CR-31…CR-36
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

**✅ ANSWERED — owner, 2026-08-25. THE SURFACE MODEL IS SETTLED.**
> *"A lead only needs to show me what they submitted and then if i want to take action for them im
> promoting them to an account and it moves to client and becomes a client record page and i see all
> the options as button tabs like the modal shows me now, and i can configure everything as i need
> to, i probably have a cover page that i see for provisioning them for their first order and this is
> inherited from their submission if there is one attached and then once that order is correct maybe
> i want to do something like add a horse record and other types of things that are found on the
> client records and im able to save it and im able to send the activation link."*

**Not one thing in two modes, and not two peer surfaces. A sequence:**

| Stage | Surface | Contains |
|---|---|---|
| **Lead** | minimal | **what they submitted.** One action: **promote to an account.** Nothing else — a lead is not a record yet |
| **↓ promote** | | the lead becomes a client |
| **Client** | **client record PAGE** | **all the options as button tabs** — the modal's tab set, on a page |
| **↳ landing** | **a provisioning cover page** | their **first order**, **inherited from their submission** where one exists |
| **↳ then** | the other tabs | add a horse record, and everything else found on a client record |
| **↳ acts** | | **save**, and **send the activation link** — two separate acts |

⚠️ **This resolves CR-32's A/B: option B**, with the refinement that the lead surface is not a
smaller record — **it is a submission and a button.**
⚠️ **The provisioning form (CR-15, CR-17–CR-20) becomes the cover page of the client record page.**
Those requirements carry forward into it; that is where they land.
⚠️ *"i probably have a cover page"* — recorded with his hedge intact. **Confirm in review.**

**ASK-REPO** *(added by this answer)*
1. Does the client record page have a real address of its own today, and what breaks when a person
   moves from lead to client? (D17 — a promoted lead should not lose its link)
2. Is **promote** already an act in the system, or is it currently implied by sending an invitation?
3. Where does a lead's submission attach to the new client, so the cover page can inherit it?
4. What happens to the **other** places a person is shown (Partners, Vendors, Archived, Review) —
   do they all become this page?

**ASK-OWNER** *(added by this answer)*
1. Is **promote** purely internal until you press *send the activation link* — i.e. no email leaves
   on promotion? *(The save/send split already exists on the provisioning form.)*
2. A lead you decide **against** — does it get an outcome (declined, archived), or just sit?
3. If there is **no submission** — staff creating a client from scratch — what does the cover page
   show?

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
✅ **RESOLVED 2026-08-25 — B, refined.** See CR-30: the lead surface is not a small record, it is
**the submission plus a promote button**, and the client page carries the modal's tabs. 

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
✅ **WIDENING QUESTION ANSWERED (owner, 2026-08-25): "the short answer is yes."** The same surface
needs quantity, comping, discounting, voiding, marking paid, and cadence. **CR-16 is therefore not a
button — it is the line-item editing model**, and it is specified across CR-38…CR-42 below.
⚠️ **Do not build CR-16 alone.** Building "change the offering" as a one-off produces a sixth
inconsistent way to touch an order.

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

---

# G5 · BILLING & PRICING

## CR-28 · G5 · researched
**SAID** *"we say we need 30 days notice for cancellation and we collect payment every month the day
prior to the start of the next month, so we need to set it to fill out the month ahead when payment
is confirmed … until their payment is confirmed their scheduled lessons appear on the calendar only
as pending payment not reserved, when we confirm payment their lessons switch to confirmed and
reserved and if they want to change their lesson schedule while its sitting in pending this is ok,
but not when payment is past due."*
**FOUND** ✅ **"Pending payment" and "confirmed" already exist as booking states** — two more of the
ones nothing has ever used. ⚠️ And the screen currently **promises something untrue**: it says the
weekly plan is put on the calendar for the next three months, and no such thing happens anywhere.
*(Wording corrected; the behaviour is this change request.)*
**ASK-REPO** Nothing records what period a client has paid **through**. Where should that live?
**ASK-OWNER**
1. Where does the **30 days' notice** live, and what enforces it?
2. ⚠️ Nothing may re-write a month **already paid for**. The current rule only protects weeks
   already past — confirm.

## CR-29 · G5 · researched
**SAID** *"the rule about Evaluation lesson being the first thing they buy, when they combine
something like a weekly riding subscription, we should be increasing the price of the first month by
$20 and then changing the price of the evaluation lesson to show it as included with their first
month"*
**SAID** *"we should offer 3 payment options for the weekly riders … a weekly payment of $260 /week,
a bi-weekly payment of $480, and a monthly payment of $880 … For their willingness to pay for the
month up front they get a discount."*
**FOUND** The three prices are **internally consistent** — paying more often costs more, every step
of the way. ⚠️ But **the system can only hold one price per service**; there is no concept of paying
weekly versus monthly for the same thing. ⚠️ And on the evaluation rule: it reads as *"+$20"* and
lands as **$150 off** the à-la-carte total. Almost certainly intended, but it should be a decision on
the record.
**ASK-OWNER**
1. **Do the other three weekly plans get their own three prices?** You gave one ladder; there are
   **four** weekly plans on sale.
2. **How does "+$20 on the first month" work if they pay weekly?** +$20 on the first week, or spread?
3. Is the **weekly price the real one and monthly the discount**, or the other way round? It decides
   what happens when prices change.
4. What does *"unlocks"* mean concretely when someone is late — does the unpaid week's lesson
   disappear, or sit there unconfirmed?
⚠️ **This revises CR-28**: with three cadences, every date in it becomes relative to *the period*,
not to the month.

## CR-38 · G5 · captured
**SAID** *"we didnt make it possible for anyone to set a quantity for the horse care services that
are weekly."*
**ASK-REPO**
1. Where is quantity held on an order line today, and what actually reads it?
2. **Standing Q2 — is quantity already settable anywhere?** Some services are sold in packs; is that
   the same mechanism or a different one?
3. For a *weekly* service, what does quantity even mean — visits per week, or weeks bought? ⚠️ These
   are different numbers and the system may already conflate them.
4. What does quantity change downstream — the price, the credits issued, how many days get put on the
   calendar? All three?

## CR-39 · G5 · captured ⚠️ THE IMPORTANT ONE
**SAID** *"we need a system for comping an offering or an order (this records a loss for the buisness
and give the client a free credit instead of just marking it paid which records revenue and they
dont see they got something free when they look back at an offering or an order)."*

**Three distinct requirements in one sentence — do not collapse them:**
1. **A comp is not a payment.** Marking something paid records revenue that never arrived.
2. **A comp records a LOSS** — it must be visible as a cost of doing business, not as income.
3. **The client must SEE they were given something free**, on the offering and on the order, when
   they look back.

**ASK-REPO**
1. How is "paid" recorded today, and is comping currently being faked with it? *(If staff have been
   marking comps as paid, the revenue figures are already wrong.)*
2. Do credits carry any notion of what they cost — or are all credits identical once issued?
3. Is there anywhere a client can see **why** they hold a credit?
4. **Standing Q1** — is there an existing money-movement concept (refunds, adjustments, write-offs)
   this belongs inside, or is it new?

**ASK-OWNER**
1. Comp the **whole order**, or **a line**, or both?
2. Is a comped credit the same as a bought one — same expiry, same transferability?
3. Who may comp, and does it need a reason on the record?

## CR-40 · G5 · captured
**SAID** *"we need a discount capability … discounts are a standard in the business world and we have
no way to add one to an order."*
**ASK-REPO**
1. Can an order line hold a price different from the offering's price today? *(If not, discounting
   and comping and price-overriding are all the same missing mechanism.)*
2. Does anything downstream assume line price equals list price — credits, receipts, the contract
   tokens that print amounts?
**ASK-OWNER**
1. Percentage, fixed amount, or both?
2. Line-level, order-level, or both?
3. Does the client see **"$880, less 10%"** or just **"$792"**? ⚠️ This is the same visibility
   principle as CR-39 and should be answered once for both.

## CR-41 · G5 · captured
**SAID** *"we need to publish our standard rates, those should be high enough to demonstrate our
quality of services and relative market position."*
**ASK-REPO**
1. Is there a public-facing price list today, and does it read the same prices staff sell from?
2. ⚠️ **Standing Q4** — CR-29 says one service cannot hold three cadence prices. **A rate card is a
   second reason the pricing model needs rebuilding, not a separate job.**
**ASK-OWNER**
1. "Publish" — a page on the website, or a document sent to people?
2. Is the published rate the **list price that discounts come off**, so a discount is always visible
   as a concession?

## CR-42 · G5 · captured
**SAID** *"nor a way to send out an incentive to someone or to everyone with a redeemable item in
it."*
**ASK-REPO**
1. **Standing Q2 — the gift path already issues something redeemable to someone who did not buy it.**
   Is that the same machinery, and can it be pointed at an incentive?
2. Is there any concept of sending one message to **everyone**, or only to a named person?
3. What would "redeem" attach to — an order not yet placed, or a credit issued up front?
**ASK-OWNER**
1. One person, a group, or everyone — and is "everyone" a real case or an edge case?
2. Does an incentive expire?
3. Single-use per person, or one code many people use? ⚠️ These are very different builds.

⚠️ **CR-38…CR-42 ARE ONE GROUP OF RESEARCH.** Quantity, comps, discounts, published rates and
incentives all touch the same thing: **what an order line is allowed to say about money.** Research
them in one pass or the same tables get read five times.

## CR-43 · G6/G8 · captured — ⚠️ OWNER IS SPLIT, DECISION NEEDED
**SAID**
> *"I'm split on whether we open the door to full account creation with activation email from an
> order which right now ends at the lead stage, im inclined to do it and just implement hcaptcha to
> protect against spam account creation … it wont eliminate the need for the internal pathways and
> processess but it will substantially reduce how many people show up as a lead and then need to wait
> for me to send them a link, the first contact still shows up as a lead but they are a lead with an
> account and the only reason this is important, is that it gates their app access to not show
> community until they are accepted as a client."*

**A/B, his own words** — *"I'm split … im inclined to do it."*
- **A** — keep it as it is: a public order ends at the lead stage and waits for him to send a link.
- **B** — a public order creates the account and sends the activation email, protected by hCaptcha.
  The person still appears as a lead, but **a lead with an account**, and community stays hidden
  until they are accepted as a client.
**He leans B. Not locked.**

**FOUND (fact-finding done at capture, because he asked for an opinion)**
1. ⚠️ **THE DOOR IS ALREADY OPEN.** The self-service signing links already create a full account
   from a public page with no human in the loop. B is **a second entrance to a door that is already
   unlocked**, not a new door. That materially weakens the risk case for A.
2. ⚠️ **B CONTRADICTS A RULE HE SET THE DAY BEFORE.** Ruling 11 (2026-08-24): *"Every account holder
   gets the community feed … gated by ACCOUNT, never by having bought something,"* and the guard was
   deleted to make that true — **community is currently on for every account.** If leads start having
   accounts, then under today's rule **a lead sees community immediately**, which is the opposite of
   what B is for.
3. ✅ **THE GATE HE WANTS ALREADY EXISTS AND IS NOT "HAS AN ACCOUNT."** App access is already decided
   by **membership status**, not by having an account. A lead-with-an-account is a member who is not
   yet active. **No new flag needs inventing** — which matters, because inventing one is how this
   codebase has repeatedly ended up with a single flag carrying two meanings.
4. ⚠️ **DEPENDS ON CR-27.** *"Until they are accepted as a client"* is a state change, and **nothing
   in the system can currently accept or approve anything.**

**ASK-OWNER**
1. Confirm the gate moves from *has an account* to *membership is active* — and that ruling 11 is
   **re-worded, not reversed** (its intent was "buying something must not be the price of entry";
   that stays true).
2. **What can an un-accepted account actually reach?** Not "what is hidden" — what is *reachable*.
   That list is the real security decision; hCaptcha only controls how many of them there are.
3. Does the activation email say anything different for a self-created account than for one he sends?

**RECOMMENDATION (mine, asked for):** **B, with the gate on membership status.** The friction it
removes is real, the door it opens is already open, and the mechanism to hold community back already
exists. The work is not hCaptcha — it is CR-27 and one careful re-wording of ruling 11.

## CR-44 · G6 · captured — the lead card, and the three-way choice
**SAID**
> *"a person submits a contact form or an order form. we get a lead card that (currently doesnt show
> us what they sent) will show us what they sent us and give us quick access to the contact
> information from a phone or computer so we can reach out to them, and it give us the choice of how
> to handle the lead; make them a client with an order and a scheduled booking, leave them as a
> marketable lead and send them to the marketing page, or cancel the lead designation so it doesnt
> count in our conversion calculations and send them to the dungeon never to be contacted again."*

**The lead card is a submission, a way to reach them, and exactly three exits:**
| Exit | Result |
|---|---|
| **Make them a client** | with an order **and a scheduled booking** |
| **Marketable lead** | to the **marketing zone** — ⚠️ *does not exist in the app yet* |
| **Cancel the lead** | ⚠️ **removed from conversion calculations**, sent to the **dungeon** |

**ASK-REPO**
1. Does a conversion calculation exist anywhere today? *(If yes, it currently counts people it
   should not.)*
2. Is there an existing archive surface that is already the dungeon in all but name?
3. **Standing Q2** — do Partners, Vendors and other people-lists need the same three exits?

## CR-45 · G6 · captured — not-a-fit, and the two zones
**SAID**
> *"the issue that claire was worried about is when a person isnt the right fit then they are in our
> system and they arent a client and we need to make sure we have a way to mark client records
> appropriately … a lead that didnt work out but is still an account, thats a market able contact for
> later, so a quick note and away to mark them is all we need … either a designated future
> opportunity that we use the notes to know when and why and how to contact them or they are
> designated a permanent non opportunity and we basically block the pursuit of that person from ever
> happening but we dont block them from coming back to try again later if the thing that made them
> not a fit changes … leads that we may market to in the future go into a marketing zone that doesnt
> exist yet in the app, and the ones that we wont market to go into another zone in the app that is
> essentially the dungeon and we can go in there if we need to but we dont want to look at it every
> day."*

⚠️ **THE KEY DISTINCTION — the account is not the risk:**
> *"the promotion to account holder is not in and of itself an issue, the payment and booking and
> client designation is the issue because its a lot to unwind and a lot [of] emails and notifications
> are build off of those things triggering them and it leaves the door open to bloat, confusion,
> frustration, and undue notifications or the surfacing of illegitimate data like client headcount
> that includes people who were not the right fit and never bought from us."*

**So: an account costs nothing. A CLIENT DESIGNATION costs a great deal** — it triggers emails and
notifications, and it inflates headcount with people who never bought. **This is the answer to CR-43
as well: create accounts freely; withhold the client designation.**

**Two markings, each with free text:**
- **Future opportunity** → marketing zone. Notes say **when, why and how** to contact them.
- **Permanent non-opportunity** → the dungeon. **Blocks our pursuit of them, never their return** —
  if the thing that made them not a fit changes, they can come back.

**ASK-REPO**
1. What exactly is triggered by "client designation" today, and can an account exist without it?
2. What does "client headcount" count today?
3. Is any of the note/marking machinery already present (status logs, notes on a contact)?

**ASK-OWNER** *(raised at capture on 2026-08-25, correctly deferred to review)*
1. **A person in the dungeon submits again — what should that arrival look like?** He ruled the
   dungeon *"blocks the pursuit of that person"* but explicitly *"we dont block them from coming back
   to try again later if the thing that made them not a fit changes."* So a new submission from a
   dungeoned contact is a case the model already implies and has not yet been given a behaviour.
2. Does a **marketable lead** who submits again return to the normal lead flow, or arrive flagged as
   a returning opportunity with the earlier notes attached?
3. Do the three exits apply to **Partners and Vendors**, or to leads only? *(asked, unanswered)*

## CR-46 · G6 · captured — creating a client from scratch
**SAID**
> *"if i want to create a client record from scratch, i click the button to add a client and then add
> the information about them (including adding a horse or a contract or deal), then select their
> offering if one should be added to create an order, then confirm or adjust the documents they need
> to complete and when applicable like with a deal party account i select when they sign or if they
> sign them partly based on if there is an order created and based on the offerings in it the
> paperwork is selected and i can designate when they sign it relative to the contract/deal they are
> part of, and then i either save it (not finished and ready to send) or send it."*

**The order of the cover page, in his words:** person → *(horse / contract / deal)* → offering →
order → documents → **when they sign** → **save or send**.

⚠️ **"When they sign" is a per-document choice**, and for a deal party it is **relative to the
contract** — this is the disposition concept, and it already exists in part.

## CR-47 · G6/G8 · captured — what actually makes an account active
**SAID**
> *"either way they are now an active account and they just dont have access to the app or their
> records until they click the link so the send itself doesnt do anything, the completion of the
> first sign in from the clicking of the link is what claims the account and makes it accessible.
> somewhere in there we need to identify the exact triggers that set status as draft or active, and
> tag their account properly for rider/owner/deal party/[visitor]."*

⚠️ **THE SEND DOES NOTHING.** The account is active either way. **Claiming — the first sign-in after
clicking the link — is what grants access.**

**ASK-REPO** *(this is a fact-finding assignment, not a question for him)*
1. **Enumerate every trigger that sets an account to draft or active today**, and every place that
   reads it. He has asked for the list — **produce it, do not ask for it.**
2. Where is the tag set, and is it derived or written?
3. Does anything currently confuse *sent* with *active*?

## CR-48 · ALL · captured — vocabulary
**SAID**
> *"i prefer the word visitor over guest, guest is a bit too ambiguous as to what it means in context
> of our business, visitor is clearer, it should read to anyone that they are someone who visited us
> physically."*

**GUEST → VISITOR**, everywhere. ⚠️ Touches the tag, the self-service door, the document set, and the
rule that this is the one tag that obligates paperwork on the strength of being on the property —
which is **exactly why "visitor" is the more accurate word.**
**ASK-REPO** Every place the word appears: UI copy, tag values, document requirement rows, sign-path
names, template wording. ⚠️ Distinguish **displayed words** from **stored values** — changing a
stored value is a migration with readers.

## CR-49 · G6/G8 · captured — the lead's own app: self-activation, and what they see
**SAID**
> *"it would be the same shape as the hidden url /sign/* pathway, except the form is different and
> the only thing they see when they sign in the first time since they are a lead is their order with
> the form they submitted and the catalog where they can edit their order by changing things, adding
> things, or removing things...they can even cancel it so we know not to put too much effort into
> contacting them and not worry if they dont respond to us..."*

**Same shape as the existing self-service door; different form.** ⚠️ That door already exists and
already creates accounts — so this is a **variant of a built pathway**, not a new one.

**What a LEAD sees on first sign-in — and nothing else:**
| | |
|---|---|
| **their order** | as submitted |
| **the form they submitted** | their own words, back to them |
| **the catalog** | to **change, add or remove** items on that order |
| **cancel** | ⚠️ **the signal that matters** — *"so we know not to put too much effort into contacting them and not worry if they dont respond to us"* |

⚠️ **A cancellation is a lead-management signal, not just an order state.** It tells Claire to stop
chasing. It should reach whatever surface shows people waiting on a reply — and it is arguably a
fourth exit alongside CR-44's three, except **the lead pulls it themselves.**

⚠️ **This is CR-43's answer made concrete:** the account exists, the app is nearly empty, and the
client designation — with its emails, notifications and headcount — is withheld until they are
accepted. The gate is doing real work rather than being cosmetic.

**ASK-REPO**
1. The existing self-service door — what does it share with this, and can one pathway serve both
   with a different form?
2. Is there any concept today of an app surface that shows **only** an order?
3. When a lead edits their own order, does the existing order-editing machinery already permit it, or
   is it staff-only?
4. **Standing Q2** — the member's own shop already lets someone build an order. **Is that the
   catalog surface this describes, already built?**

**ASK-OWNER**
1. Does a lead's edit to their own order need review before it counts, or is their order simply
   theirs until accepted?
2. Does cancelling remove them from the lead list, or mark them cancelled and leave them visible?

## CR-50 · G6/G8 · captured — the access condition
**SAID**
> *"set a condition that if has_account=true and is_lead=true and is_client=false no access to
> community, no access to most of the app pages or settings until is_account=true and is_lead=true and
> is_client=true"*

**The rule, as stated:**
| State | Access |
|---|---|
| account ✓ · lead ✓ · **client ✗** | **no community, no most-of-the-app, no settings** |
| account ✓ · lead ✓ · **client ✓** | full access |

⚠️ **This is the enforcement half of CR-43 and CR-45.** It is what makes "create accounts freely,
withhold the client designation" real rather than cosmetic.

**FOUND** *(carried from CR-43's fact-finding — for step 3, not for the reply)*
- **App access is already decided by a single membership status**, not by account existence. An
  inactive member already gets nothing.
- **Community is currently open to every account** — the guard was removed on 2026-08-24 under the
  ruling *"every account holder gets the community feed."* **That ruling and this condition cannot
  both stand as written.**

**ASK-OWNER**
1. ⚠️ **Three booleans can express states that cannot exist** — a client who is not an account, a
   lead who is neither. Is this **one status with a sequence** (lead → client), or genuinely three
   independent flags? *(This codebase's most repeated defect is one flag carrying two meanings; three
   flags for one sequence is the same trap with more surface area.)*
2. ~~"Most of the app pages" — which pages are the exception?~~ ✅ **ANSWERED, owner 2026-08-25:**
   > *"no its much more than they should see. they only see their order, the catalog, their personal
   > profile information...."*

   ⚠️ **It is an ALLOWLIST OF THREE, not a subtraction from the app.** Stated in response to the
   existing per-page visibility mechanism — **that lever grants far more than a lead should have**,
   so a lead's app is not "the app with pages switched off."
   | A lead sees | |
   |---|---|
   | **their order** | with the form they submitted *(CR-49)* |
   | **the catalog** | to change, add, remove — or cancel *(CR-49)* |
   | **their personal profile information** | — |

   **Everything else is absent, including community.**
3. ~~Settings — none at all, or the minimum?~~ ✅ **ANSWERED:** *"their personal profile
   information."* ⚠️ Confirm in review whether that includes **login/security** (changing a password,
   an auth method) — a person who has just claimed an account may need it.
4. Confirm the 2026-08-24 community ruling is **re-worded rather than reversed** — its intent was
   "buying something must not be the price of entry", which stays true.

**ASK-REPO**
1. Enumerate every page and settings surface, and mark which a lead may reach. **Produce the list;
   do not ask for it.**
2. Is page access driven by one gate today, or by a check in each page?
3. ~~Does an existing per-page visibility mechanism exist to ride on?~~ ✅ **It exists and is the
   WRONG LEVER** — owner: *"its much more than they should see."* It switches pages off within an
   app a member otherwise has; a lead's app is built up from three things instead. **Do not implement
   this as page visibility.**

---

# G9 · GLOBALIZATION INVENTORY

## CR-37 · G9 · researched
**SAID** *"we will be implementing a globalization refactor when you and i are done fixing all these
issues … im trying to get as much of the ui and ux in the right standing ahead of the final
evaluation pass of the repo so there is less guess work and less ambiguous questions for me to
answer."*
**FOUND** *(measured, not estimated)*
- **Pop-up panels: 33 screens each build their own; 7 use the shared one that already exists.**
  Between them: six different background shades, three different stacking levels, three different
  ways of positioning.
- **Buttons: the shared style is used on 112 screens; 48 screens hand-build the same green button
  instead — and 29 screens do both.**
- **"Nothing here" messages: a shared one exists; 32 places write their own.**
- **Rounded corners: no agreed rule** — six different radii in use, while the shared form fields and
  buttons have **no rounding at all**. *(Which is why "rounded outside, sharp inside looks weird" is
  a system-wide inconsistency, not one panel's mistake.)*
- **The row list — name, detail, remove — is hand-built on six screens**, two of them this week.
**ASK-OWNER** Does the refactor set the standard, or do the fixes in G1–G8 set it as they land?

---

# ⚠️ CROSS-CUTTING — read before scheduling anything

| Dependency | Consequence if ignored |
|---|---|
| **CR-30 → CR-12, CR-15, CR-20, CR-36** | four requests are built on, or aimed at, the surface being discarded |
| **CR-03 ↔ CR-06** | each is the other's evidence; deciding them apart invalidates both |
| **CR-05 → CR-07** | a clash-aware time picker needs durations to exist first |
| **CR-03 → CR-07** | while generated slots exist, every hour looks busy and a clash check refuses everything |
| **CR-27 → CR-09, CR-25, G5** | nothing can approve a request or open an order; the billing cycle has nothing to hang on |
| **CR-29 → CR-28** | three cadences make every date in the billing cycle relative to the period |
| **CR-50 → ruling 11** | community-for-every-account and no-community-for-leads cannot both stand |
| **CR-49 → CR-43/CR-45** | self-activation is only safe because the client designation is withheld; the empty lead app is what makes the gate real |
| **CR-45 → CR-43** | an account costs nothing; the CLIENT DESIGNATION is what triggers everything — so create accounts freely and withhold the designation |
| **CR-44/45 → new app zones** | marketing zone and dungeon do not exist; both are surfaces, not flags |
| **CR-43 → CR-27** | "accepted as a client" is a state change nothing can currently make |
| **CR-43 → ruling 11** | community is gated by ACCOUNT today; leads with accounts would see it immediately |
| **CR-38…CR-42 → CR-16** | changing an offering is one case of line-item editing; build the model, not the button |
| **CR-41 → CR-29** | a public rate card and three cadence prices are the same pricing rebuild |
| **G9 ← everything** | each group's fix should carry its globalization, or the refactor inherits 34 pop-ups instead of 33 |

# ⚠️ ALREADY BUILT — carry the requirement, not the code
CR-11 · CR-15 · CR-17 · CR-18 · CR-19 · CR-20 · CR-36 — all on surfaces CR-30 may replace.

# ⚠️ ALREADY EXISTS — do not rebuild
Complete / no-show / pending-payment / confirmed states · the "I have paid" declaration · the
standing-weekly editor (wrong screen) · changing a horse's owner · resolving a name-only owner ·
the horse-care paperwork rule (enforced, ignored by the screen) · a today list on the dashboard ·
the customer-facing evaluation gate.
