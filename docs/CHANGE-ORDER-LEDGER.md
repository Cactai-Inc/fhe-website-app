# CHANGE-ORDER LEDGER — FHE, thread of 2026-08-24/25

> ## ⚠️ OVERRIDDEN STATEMENTS ARE DELETED, NOT ARCHIVED
> Owner, 2026-08-25: *"when i changed my mind about something, ignore the overridden statement and
> proceed as if it was never mentioned."*
> Where he replaced an earlier instruction, **the earlier one is gone** — CR-50's first sketch of a
> lead's app, CR-53's card order, CR-57's first arrow rule, CR-32's literal surface swap.
> ⚠️ **An A/B he OFFERED and has not chosen is NOT an override** and stays live: CR-20 and CR-55.
>
> **65 change requests, CR-01…CR-65, none missing.** Audited against every message of the thread on
> 2026-08-25.

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

**✅ ANSWERED IN REVIEW, owner 2026-08-25:**
- **Does a lead ever need the full record?** — *"CR 53's implication is correct"* → **no.**
- **Do the five things only the client page carries survive?** — *"Yes for now. Revise later."* →
  **tags, guardian/dependent links, invite state, last activity, the agreed-lesson panel and the
  account status log all carry over.**
- **Does the client record page get a shareable address?** — **NO**, and the reasoning is a ruling of
  its own:
  > *"I don't understand why we would ever do this. The one thing to check is if the information on
  > the client record and the information[ ]the user enters into their UI fields are the same
  > resource. It's important that they are. Therefore, we would never share a client record page. The
  > client has their own surfaces to modify the fields we make available[ ]to them. That information
  > is then visible on the client record in the appropriate locations."*

  ⚠️ **ONE RESOURCE, TWO VIEWS.** The client edits their own fields on their own surfaces; **staff see
  the same data** on the client record. **Not a copy, not a sync — the same record.**
  ⚠️ **He embedded a VERIFICATION TASK in it:** *"the one thing to check is if… they are the same
  resource."* **Prove it before anything is built** — if the client's profile fields and the staff
  record read different columns anywhere, that is a defect standing in front of the rebuild.
  ⚠️ **And it dissolves the addressability question rather than answering it:** a client record page
  is never shared, so it needs no shareable address.

### 🔒 RULING — LEADS LEAVE THE RECORDS PAGE ENTIRELY (owner, 2026-08-25)
> *"We get rid of leads as a record tab from the record page and they exist as a notification on the
> dashboard that when clicked opens the modal to show us the submission and the buttons for handling
> it. and then based on how it is handled, it goes to the appropriate location and remains visible
> from there as an entry. What this means for when a lead is promoted to a client[:] Their submission
> is retained and becomes part of their client record visible on a surface that shows their account
> history[,] that would be an appropriate replacement for an activity Log as a dedicated page. The
> activity log should be accessed from the account history page as a text link or small button,
> probably in the top right."*

**A LEAD IS NOT A RECORD. IT IS AN INBOX ITEM.**
| | |
|---|---|
| **Leads tab on the Records page** | ⚠️ **DELETED** |
| **where a lead lives** | **a notification on the dashboard** |
| **clicking it** | opens **the modal** — the submission, and the buttons for handling it |
| **after handling** | it **moves to the appropriate location and remains visible there as an entry** |

⚠️ **This resolves the modal-vs-page tension completely.** The modal was never meant to be a record
surface — **it is the handling surface for an inbox item**, which is why it felt wrong as a person's
record and right as a lead's. **Both instincts were correct.**

**AND THE SUBMISSION SURVIVES PROMOTION:**
- the submission is **retained** and becomes **part of the client record**
- it is shown on a surface for **ACCOUNT HISTORY**
- ⚠️ **that surface REPLACES the Activity Log as a dedicated page**
- the **activity log becomes a link from account history** — a text link or small button, **top
  right**

⚠️ **CR-35 IS ANSWERED BY THIS.** *"Keep a snapshot of what they send us … so we can spot trends."*
**The snapshot's home is Account History**, and it is what makes the snapshot worth keeping — the
submission and everything that happened after it, on one surface.
⚠️ **CR-63 is affected:** the account card list includes Activity. **Activity is demoted** — it stops
being a destination and becomes a link inside Account History.

### 🔒 RULING — A FOURTH EXIT: DELETE (owner, 2026-08-25)
> *"Yes I want a delete button. This is a hard delete with a block on that submitter as optional."*

**A lead now has FOUR exits**, not three: make them a client · marketable lead · cancel into the
dungeon · **hard delete**, with **an optional block on the submitter**.

⚠️ **A HARD DELETE AND A BLOCK ARE IN TENSION, AND SOMETHING MUST BE KEPT.** You cannot block a
person you have entirely erased — a block needs **something to match on** (the email address, at
minimum) that survives the deletion. **So "hard delete + optional block" means: erase the record,
and when blocking, retain a minimal blocklist entry.** That is a deliberate exception and should be
designed as one, not discovered later.
⚠️ **Second consequence:** a hard-deleted lead **cannot appear in conversion figures at all** — the
cancel-into-the-dungeon exit removes them from the numbers *(CR-44)*, and deletion removes the row.
**Confirm the numbers behave the same for both, or they will disagree.**

### 🔒 RULING — EVERY RECORD IS A PAGE (owner, 2026-08-25)
> *"every record is a page. [Modals] are for surfacing information quickly, not information dense or
> operationally intensive surfaces. All of those named could update to a page. I go back to saying
> each record type deserves its own unique page view at the layout[;] structure to be the same[,] we
> need uniformity. We need globalization as much as possible, personalization is extremely important
> for making things fully usable"*

| | |
|---|---|
| **a record** | **not a MODAL** |
| **a modal** | **quick surfacing only** — never information-dense, never operationally intensive |
⚠️ **REFINED BY CR-74 (same day):** this was aimed at modals, and against modals it stands. **An
expanding full-width card IS an acceptable record surface** and is preferred over a deeper page when
it can show the same information. **Read CR-74 for the settled rule.**

**So Partners, Vendors and Archived accounts all become pages too.** ✅ Answers the re-asked question.

⚠️ **THE SHAPE OF THE RULE — this is the G9 principle for the whole app:**
- **each record type gets its OWN page view** — a horse is not a person is not a deal
- **the LAYOUT STRUCTURE is the same across all of them** — uniformity
- **globalize as much as possible**
- ⚠️ **but "personalization is extremely important for making things fully usable"** — so uniformity
  is the *frame*, not the content. **A shared skeleton, record-specific flesh.**

⚠️ **This is the answer to CR-63 as well**: a card is a summary and a doorway; **the page is the
record.** One rule, not two.

**ASK-OWNER — remaining to lock CR-30**
1. **Does a marketing-zone or dungeon entry carry the submission**, the way a promoted client's
   record does? *("remains visible from there as an entry" — an entry of what?)*
2. **Is Account History a TAB on the client record page, or a page of its own?** ⚠️ *"Every record is
   a page"* settles record TYPES; account history is a surface within one.
3. Is **promote** purely internal until *send the activation link* — no email on promotion?

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

✅ **SETTLED — see CR-30.** The lead surface is **the submission plus a promote button**; the client
gets a **page** carrying the tab set. *(He floated a literal swap first and then described this
instead; the swap is not a live option.)* 

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

## CR-27 · G8 · 🔒 LOCKED 2026-08-25
**SAID** *"it doesnt appear the pending status is working properly and likely the approval process for
a request isnt working properly either"*
**FOUND** Both are the same thing, and it is worse than a bug: **the steps were designed and never
connected.** A request has ten possible stages and every one ever created sits at the first. **No
part of the system can approve one.** Bookings have twelve possible states and only four have ever
been used. And Rachel Page's order — the only one that came from a request — is still sitting
unopened, which is why she received no paperwork and no credits.
⚠️ **This is the hinge for CR-09, CR-25 and the whole of G5.** It is a build, not a repair.
**✅ LOCKED, owner 2026-08-25 — THE ORDER LIFECYCLE**

> *"the submission is a request to purchase, not an actual purchase, and the approval to purchase is
> the order creation step. There's no point in creating an order that isn't gonna be paid and no point
> in creating an order just to cancel it on our end by declining or denying them … We create the order
> by approving the creation of the order[,] booking is a separate step. The user doesn't see and
> notice that we approved their purchase. They see a notice that their order has been processed and
> they get a payment request … booking follows order creation and, as previously discussed, payment is
> not part of the booking flow. It's part of the fulfillment requirement[;] without payment, we do not
> fulfill … if they don't pay and they show up, we tell them they have to pay[;] if they don't pay and
> don't show up, the order may be canceled. [T]he booking may be rescheduled on the customer side
> prior to payment, they can cancel the order[;] after payment they can cancel the booking and they
> get a credit or they can reschedule the booking based on our policies"*

**THE CHAIN — four separate things, in this order:**
| # | Act | Who | Creates |
|---|---|---|---|
| 1 | **a request to purchase** | the visitor | **not a purchase** — an ask |
| 2 | **approval** | staff | ⚠️ **THE ORDER.** Approving *is* creating it |
| 3 | **booking** | staff, usually after a conversation | a separate step, **after** the order |
| 4 | **payment** | the client | ⚠️ **not part of booking — a FULFILMENT requirement** |

⚠️ **NO ORDER EXISTS BEFORE APPROVAL.** *"No point in creating an order that isn't gonna be paid and
no point in creating an order just to cancel it on our end by declining."* **This settles CR-25 and
CR-09 too** — Rachel Page's `draft` order should never have existed; the request should have stayed a
request until approved.

⚠️ **THE CLIENT NEVER SEES "APPROVED."** They see **"your order has been processed"** and **a payment
request**. Approval is our word, not theirs.

⚠️ **PAYMENT DOES NOT GATE BOOKING. IT GATES FULFILMENT.** The order sits there; the booking sits
there. *"Without payment, we do not fulfil."*

**WHAT HAPPENS WHEN THEY DON'T PAY:**
| | |
|---|---|
| **doesn't pay, shows up** | **we tell them they have to pay** — the lesson is not silently free |
| **doesn't pay, doesn't show** | **the order MAY be cancelled** *(our discretion, not automatic)* |

**WHAT THE CLIENT MAY DO — and payment is the dividing line:**
| | Before payment | After payment |
|---|---|---|
| **the booking** | **reschedule** — customer side | **reschedule**, per our policies |
| **the order** | **cancel it** | — |
| **the booking** | — | **cancel it → they get a CREDIT** |

⚠️ **Before payment they can walk away from the ORDER. After payment they can only move or convert
the BOOKING** — the money stays with us as a credit.

**✅ ANSWERED — "which stages do we use?"**
> *"We need all of the states that pertain to the options. I'm not sure what logic you were using
> that says this because I listed the happy path statuses[,] those are the only ones we need"*

⚠️ **MY RECOMMENDATION TO COLLAPSE TO THREE WAS WRONG.** He had described the happy path only, and I
read a happy path as a complete vocabulary. **The rule is: every state that corresponds to a REAL
OPTION must exist.** The options above — declined, cancelled-by-us, cancelled-by-them, rescheduled,
credited, unpaid-but-attended — **are all real, so their states are all needed.**

**✅ ALL ANSWERED, owner 2026-08-25:**
1. **Who may approve?** — *"Both"* — **Claire and CJ.**
2. **The eight stuck requests and Rachel's order?** — *"Leave them."* ⚠️ **No migration, no cleanup.**
3. **Is "declined" the dungeon?** — *"No, they're separate. We don't[ ]decline, we just change or
   cancel the request."*
   ⚠️ **THERE IS NO DECLINE.** A request is **changed** or **cancelled** — that is the whole
   vocabulary for a no. Declining a purchase and marking a person not-a-fit *(CR-45)* remain
   entirely separate acts, and **neither is called "declined".**

---

## 🔒 CR-27 — LOCKED. VALIDATION CRITERIA

1. **Claire or CJ can approve a request to purchase, and that act creates the order.** No other path
   creates one from a request.
2. **An unapproved request has NO order.** A submission writes a request; it does not write a
   purchase.
3. **The client is told their order has been PROCESSED, and receives a payment request.** ⚠️ The word
   *approved* appears nowhere the client can see.
4. **Booking is a separate act, performed after order creation**, and can be completed **with no
   payment recorded**.
5. **Payment blocks FULFILMENT, not booking.** An unpaid order and an unpaid booking both persist.
6. **Before payment:** the client can reschedule the booking and cancel the order.
   **After payment:** the client can reschedule per policy, or cancel the booking and **receive a
   credit**.
7. **Non-payment is handled by people, not automatically:** a no-pay-but-attends is asked to pay; a
   no-pay-no-show **may** have the order cancelled — never automatically.
8. **A request is CHANGED or CANCELLED. There is no "decline".**
9. ⚠️ **Every state that corresponds to a real option is written by a real path.** The acceptance test
   for this one: **no state in the vocabulary is left with nothing that can produce it.**
10. **The eight existing requests and Rachel Page's order are untouched.**

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

   ⚠️ **The principle that survives: a lead's app is BUILT UP, not subtracted from.** Stated in
   response to the existing per-page visibility mechanism — **that lever grants far more than a lead
   should have**, so this is not "the app with pages switched off."
   ➜ **The definitive list of what a lead sees is CR-53 (nav, dashboard) and CR-62 (account cards).**
   Read those, not this.
3. ~~Settings — none at all, or the minimum?~~ ✅ **FULLY ANSWERED, owner 2026-08-25:**
   > *"so they can change their name their email their login, etc...preferences dont show, and the
   > other sections and pages dont show."*

   | Shown to a lead | Hidden from a lead |
   |---|---|
   | **name** | **preferences** |
   | **email** | every other section |
   | **login** *(auth method / password)* | every other page |
   | *…and the like* | |

   ⚠️ **"Preferences don't show" is a deliberate exclusion, not an oversight.** Preferred contact
   method, notification choices and the rest belong to someone we have a relationship with — a lead
   has not been accepted yet. ⚠️ **Cross-check with CR-34:** the preferred contact method a visitor
   already gave us on the enquiry form must still be captured and must still reach the contact
   record — **it is hidden from THEIR settings, not discarded.**
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

## CR-51 · G6/G7 · captured — one catalog, and the horse loop closes at sign-in
**SAID**
> *"yea its all one catalog, the gate on evaluation and horse care being order able or required is
> based on having a previous qualifying order or having a horse in the system right? so we dont gate
> them explicitly when they order horse care services but if they self activate we ask for their horse
> information when they sign in so we complete the loop and if they dont have a horse then there is a
> bit of an issue that we know going into the call or text exchange..."*

**ONE CATALOG.** ✅ Answers the open question — a lead sees the same catalog a client does; the
difference is what they may *do*, not what they may *see*.

**The horse-care gate moves from BLOCKING to ASKING:**
| | |
|---|---|
| **At order time** | ⚠️ **do NOT gate.** A lead ordering horse care is not stopped |
| **At first sign-in** | **ask for their horse information** — the loop closes here |
| **If they have no horse** | ⚠️ **not an error — an INTELLIGENCE.** *"a bit of an issue that we know going into the call or text exchange"* |

⚠️ **This is a different philosophy from CR-10** and the two must be reconciled. CR-10 asked to hide
horse services from clients without a horse; this says **let a lead order them and catch it at
sign-in**. Both can be true — *hide from staff picking on someone's behalf, ask when the person
orders for themselves* — but that distinction is not yet stated and should be.

**FOUND** *(for step 3 — his "right?" needs one correction)*
- The existing rule is **not** "a previous qualifying order or a horse in the system." A horse-care
  booking is refused unless there is a horse **and** that person holds the care paperwork for **that
  horse**. **Paperwork is part of the gate**, which matters because a lead who names a horse at
  sign-in still will not have signed anything.

**ASK-REPO**
1. Is the horse-information ask at sign-in the **same intake form staff use**, or a lighter one?
   *(Standing Q2 — a shared one already exists.)*
2. Where does a no-horse flag surface for the person about to make the call?
3. Does the catalog behave identically for a lead and a client today?

**ASK-OWNER**
1. Reconcile with CR-10: **hidden when staff pick for someone, asked when the person orders for
   themselves** — is that the rule?
2. Does the evaluation-lesson-first rule apply to a lead's self-built order the same way?

## CR-52 · G6/G8 · captured — DELETE the "being activated" page
**SAID**
> *"there is an error page that says the account is in the process of being activated. I just hit it
> when i entered a valid email address and the wrong password but the email address and password
> combo match but the account was deleted. ive seen people land on this page when they go straight to
> frenchheritageequestrian.com/app too. it needs to redirect to the login page and if it cant provide
> a valid useful accurate error message, it shouldnt display anything, but the current page i want
> deleted and thats because there is no such thing as an account being in the process of being
> activated, so its an outright lie that harms us and the user."*

**The ruling is unusually absolute — record it as such:**
1. **DELETE the page.** Not reword it. **There is no such state**, so the page describes something
   that cannot happen.
2. **Redirect to login.**
3. **If the message cannot be valid, useful and accurate — show NOTHING.** ⚠️ *"an outright lie that
   harms us and the user"* — **silence beats a plausible-sounding falsehood.**

**Two different ways in, both reported:**
| Route | What happened |
|---|---|
| **Sign-in attempt** | valid email, wrong password — *"the email address and password combo match but the account was deleted"* |
| **Straight to `/app`** | no session at all; other people have hit this too |

⚠️ **The second is the common case** — anyone typing the bare app address gets told their account is
being activated.

**ASK-REPO** *(fact-finding assignments — produce, do not ask)*
1. **Find the page and every route into it.** Two are reported; there may be more.
2. ⚠️ **A DELETED ACCOUNT WHOSE CREDENTIALS STILL AUTHENTICATE.** Establish exactly what "deleted"
   means here — soft-deleted contact, purged record, or an auth identity that outlived its rows. **A
   sign-in that still resolves against a deleted account is worth understanding on its own**, and it
   may be the real defect behind this page.
3. What does hitting `/app` unauthenticated do today, and where should it land?
4. **Standing Q2** — is there already a correct redirect-to-login path this can reuse?
5. Are there **other** dead-end or error pages that assert a state the system does not have?

**ASK-OWNER**
1. When someone with no session hits `/app`, do they land on login **silently**, or with a short
   "please sign in"?

## CR-53 · G6 · captured — THE LEAD'S APP, SPECIFIED
**SAID**
> *"what a person should have access to as a lead is the dashboard and it shows their order as
> pending, and a notification to complete their profile, clicking on these open their expanded cards
> in the account page a back button in the top left area of the page takes them back to the
> dashboard. The nav only shows Dashboard, Catalog, Account, and Sign out. In the Catalog selecting an
> item gives them the option to add it to their existing pending order or create a second sperate
> order. They should have the ability to cancel or modify the order from the modal that should open
> when they click on an order inside the expanded orders card on the account page. their view of the
> account page should be restricted to show only these cards: my profile, my stable, my login, my
> orders, my gifts. in this order: My Orders, My Profile, My Stable, My Gifts, My Login."*

⚠️ **This SUPERSEDES the three-item allowlist in CR-50** — it is the same intent, fully specified.

**NAV — exactly four:** `Dashboard` · `Catalog` · `Account` · `Sign out`

**DASHBOARD** — two things, both clickable:
| | Opens |
|---|---|
| **their order, shown as PENDING** | the expanded orders card on the Account page |
| **a notification to complete their profile** | the expanded profile card on the Account page |

⚠️ **A back button, top-left of the page, returns to the dashboard.** *(A navigation pattern, not a
browser-back reliance.)*

**ACCOUNT PAGE — five cards.** ➜ **Order and layout are CR-62.** ⚠️ **`My Stable` and `My Gifts` are
present for a lead**, which is wider than the first sketch of a lead's app.

**CATALOG** — selecting an item offers a choice:
- **add it to their existing pending order**, or
- **create a second separate order**

**AN ORDER** — clicking one inside the expanded orders card opens **a modal**, and from it they can
**cancel or modify** the order. *(Matches CR-49's cancel-is-a-signal.)*

**ASK-REPO**
1. Do these five cards exist on the account page today, and can the set and order be restricted per
   person without building a second account page?
2. Is there an existing back-button pattern, or is this new?
3. Does anything today let one catalog selection choose between joining an order and starting one?

## CR-54 · G7 · captured — ⚠️ INVESTIGATE FIRST: documents listed twice
**SAID**
> *"the documents card that opens shows me the same set of documents twice, and they are listed as
> cards with one set showing read and resend and the other showing read, pdf, and resend. Seems like a
> clear instance of me saying add pdf to the view in the documents section of the app and instead of
> adding that to the card it created a duplicate set of cards and add the pdf button to it … they are
> the same docs btw"*
> *"Investigate to verify the cause of showing both sets of docs … and then if it was from the doc
> changes we made or my refreshing the page or using the back button after signing the last one, then
> fix the issue there, if its coded that way remove the duplicate"*

**Two sets of cards for the SAME documents:** one offering `read · resend`, the other
`read · pdf · resend`.

⚠️ **HE ASKED FOR THE CAUSE BEFORE THE FIX, EXPLICITLY.** Three candidate causes named:
1. a previous "add a PDF button" request implemented as a **second set of cards** rather than a
   button on the existing one;
2. a **page refresh**;
3. **using the back button after signing the last document.**
**If duplicated data → fix the cause. If duplicated code → delete the duplicate.**

**EVIDENCE — screenshots, 2026-08-25.** ⚠️ **The two sets are NOT identical renderings.** They carry
different subtitles and a different order, which points at **two components reading two shapes**
rather than one component fed twice:
| | Set A | Set B |
|---|---|---|
| under the title | *"You sign as client."* + *"✓ You've signed this document."* | *"✓ Signed · 8/24/2026"* |
| buttons | `Read` · **`Download signed PDF`** · `Resend a copy to me` | `Read` · `Resend a copy to me` |
| order | Participant · Human Emergency · Company Policies · Facility Rules | Human Emergency · Participant · Facility Rules · Company Policies |

⚠️ **Set A knows the ROLE; set B knows the SIGNED DATE.** Neither knows both. **Start there** — the
question is which read each is using, not whether rows were inserted twice. **Also visible:** the
`Contracts you've signed` heading from CR-56 sits between the card and set A.

## CR-58 · G9 · captured — the add controls disagree on the same card
**SAID**
> *"One thing i noticed on the stable card, add a horse is a nice button band then the other two
> sections use brown text with a +, no button, i like the look of the non button version, so the Add a
> horse button should be replaced with a + Add a Horse in brown to match the other two (Gear and
> Supplies)."*

**On one card, three sections, two different add controls:**
| Section | Today | Wanted |
|---|---|---|
| **Horses** | a **button band**, right-aligned: `+ Horse` | **`+ Add a Horse`** — brown text, no button |
| **Gear** | `+ Add gear` — brown text | unchanged |
| **Supplies** | `+ Add a supply` — brown text | unchanged |

**He prefers the text version, and the wording gains "Add a".**

⚠️ **THIS IS A GLOBALIZATION ITEM, NOT A ONE-CARD FIX (G9).** Three add-controls on a single card
already disagree. **Find every "add" affordance in the app** and establish which are buttons and
which are text.
⚠️ **AND IT MAY CONFLICT WITH CR-15**, where he asked for the offerings add-control to be *"an
outline that holds space for a new line item … an unfilled button … square"*. **Two different
answers for "how do you add a thing"** — an outline button there, brown text here. **Reconcile in
review**: they may be genuinely different cases *(adding a line to an order vs adding a record to a
list)*, or one may be the standard. **Do not silently pick one.**

## CR-55 · G7 · captured — the "read" view is broken; replace it
**SAID**
> *"the read button opens a really funky view that turns a 4 page doc into 7 and a lot of titles left
> at the pagebreaks, so we remove that option and use only a pdf view … no option to view as a pdf as
> an overlay on the screen that is a frameless set of scrollable pages with gaps between them which is
> what it should be and then from that they have the option on the screen in the top right corner to
> download."*

⚠️ **The on-screen reader re-flows a 4-page document into 7 and orphans headings at the breaks** —
the same class of defect already fixed in the PDF renderer, in a second, separate viewer.

**Wanted:** **the PDF itself, as a frameless overlay** — scrollable pages with gaps between them —
and a **download** control **top-right on desktop, floating above the document on mobile**.
Card buttons become **download pdf** and **resend**; **read is removed.**

⚠️ **A/B — HIS OWN FALLBACK, in the same breath:**
> *"if this is too much work or potential for error dont do it and just keep the download pdf button
> as the way to download a copy of the document."*
- **A** — build the frameless PDF overlay with the download control.
- **B** — **no viewer at all**; download-pdf is the only way to see it.
**B is explicitly acceptable. Judge by effort and risk, and say which was chosen and why.**

## CR-56 · G7 · captured
**SAID** *"remove the text that says "contracts you've signed"."*

## CR-57 · G9 · captured — ⚠️ ASKED BEFORE AND DROPPED
**SAID**
> *"ive asked for this to be implemented before but it looks like the thread dropped the ball on it, i
> want the cards that are clicked and expand to show the content below them to themselves expand to
> the width of the container and the arrow should be a down arrow when its collapsed and an up arrow
> when its expanded."*

1. **An expanded card expands to the full width of its container.**
2. **The arrow rule is in CR-57a (desktop) and CR-57b (mobile).**

### CR-57a · refinement, owner 2026-08-25
**SAID**
> *"on the desktop version since the card is half the width and it will expand to twice the width and
> then show the content below it, keep the right facing arrow on collapsed state and it has the down
> arrow when its open it should show the up arrow to indicate the contents are hidden on click just
> like the right arrow indicates youre going to expand the card to open it. the switch to an expanded
> state should look like a stretching animation smoothly and at a comfortable speed not an instant
> switch from 50% wide to 100% wide."*

**The arrow points at what the NEXT CLICK does, not at the current state:**
| State | Arrow | Because the next click will |
|---|---|---|
| **collapsed** | **→ right** *(keep as-is)* | **widen** the card — a sideways move |
| **expanded** | **↑ up** *(today it is a down arrow — wrong)* | **hide** the contents |

⚠️ **The correction is that the arrow is an instruction, not a status.** Right means *"this is about
to grow sideways"*; up means *"this is about to close"*. A down arrow on an open card points at
content that is already visible.

**ANIMATION** — the widening is a **smooth stretch at a comfortable speed**, ⚠️ **not an instant jump
from half-width to full**. The card grows, then the content appears below it.

### CR-57b · mobile, owner 2026-08-25
**SAID** *"on mobile all of this is moot, but the arrows need to be the down arrow on closed and up
arrow on opened."*

⚠️ **THE ARROW IS DIFFERENT ON MOBILE, AND THAT IS CORRECT — the rule is consistent even though the
glyph is not.** The arrow still points at what the next click does; on mobile the card is already
full width, so there is no sideways growth to point at — the content simply opens downward.

| | collapsed | expanded |
|---|---|---|
| **desktop** *(half width → full)* | **→ right** — about to widen | **↑ up** — about to close |
| **mobile** *(already full width)* | **↓ down** — about to open downward | **↑ up** — about to close |

**No widening and no stretch animation on mobile** — *"all of this is moot"*.

**ASK-REPO**
1. Do expanding cards animate anywhere today, or do they all snap?
2. Is there an existing transition duration/easing in the design system to reuse rather than picking a
   new number? *(Standing Q1.)*
3. ⚠️ Is the breakpoint where a card stops being half-width **the same everywhere**? The arrow now
   depends on it, so an inconsistent breakpoint becomes a visible bug rather than a layout quirk.
4. ⚠️ **ASSIGNED BY THE OWNER, 2026-08-25** — *"I'm assuming mobile shows single column not two,
   please confirm during your research in step 2."*
   **Confirm mobile is a single column, everywhere cards appear.** ⚠️ **His whole mobile ruling
   (CR-57b) rests on this assumption**, so if any surface is two-up on a small screen, the
   down-arrow rule is wrong there and the exception has to be found before the build, not after.

⚠️ **A REPEAT REQUEST.** Find out where it was previously asked and why it did not land — a request
that has been dropped once will be dropped again.
⚠️ **This is a globalization item** (G9): it is a behaviour every expanding card should share, not a
fix to one card. **Find every expanding card.**

## CR-59 · G6/G8 · captured — PROMOTION TO CLIENT: the whole flow
**SAID**
> *"the lead should be contacted and when the admin promotes to client by approving their order and
> optionally scheduling their first lesson, the view of the app shows them the app tour modal and then
> when they close that they are at the dashboard again and see whatever it should show for a new order
> without payment and a new booking that is confirmed by admin (when there is one). they should be
> prompted to click on a button that says make payment and it opens the payment page as a modal and
> they can see the payment information and pick their option for which payment they are making or did
> submit and then they proceed to the dashboard again. clicking the lesson shown opens the calendar.
> Their nav now contains all the pages and if they didnt update their profile that notification is
> still there on the dashboard, also on the dashboard is the documents to sign and if they click on
> the button on the notification to click to sign they are taken to the intake form that captures the
> remaining missing data fields and then sequentially sign the documents and upon conclusion they exit
> straight back to the dashboard the notification about the documents is gone, when we verify payment
> and mark their order paid that notification goes away"*

⚠️ **PROMOTION IS AN ACT WITH TWO PARTS:** *"approving their order"* and *"optionally scheduling
their first lesson."* **Approving the order IS the promotion.** *(This is CR-27's missing approval,
named at last.)*

**What the newly-promoted client meets, in order:**
| # | | |
|---|---|---|
| 1 | **the app tour modal** | shown on their next view |
| 2 | **the dashboard** | on closing the tour |
| 3 | **the nav now contains all the pages** | the CR-53 allowlist ends here |

**On that dashboard — four things, each with its own exit:**
| Shows | Click leads to | Disappears when |
|---|---|---|
| **a new order without payment** + a **`Make payment`** button | **the payment page as a MODAL** — see the payment info, pick which payment they are making or already submitted, then back to the dashboard | admin verifies payment and marks the order paid |
| **a new booking, confirmed by admin** *(when there is one)* | **the calendar** | — |
| **complete your profile** *(if still outstanding)* | — | they complete it |
| **documents to sign** | ⚠️ **the INTAKE FORM FIRST** — *"captures the remaining missing data fields"* — **then** the documents **sequentially**, then **straight back to the dashboard** | the last one is signed |

⚠️ **The intake form is part of the signing path, not a separate errand.** One button, one journey,
one exit.

**ASK-REPO**
1. Does the app tour already exist and is it already once-only?
2. Is there a payment surface today, and is it a page that must become a modal?
3. Does the signing path already run intake-then-documents-then-exit, or does it drop the person
   somewhere else at the end?
4. Are these dashboard cards the same self-hiding zones that already exist, or new ones?

## CR-60 · G5 · captured — the three-state payment ladder
**SAID**
> *"their booking notification and on calendar both change from awaiting payment, to payment pending,
> to paid status based on approval of the order, clicking the payment option on the payment modal, and
> verification of payment by an admin."*

**Three states, three triggers, two surfaces — the booking notification AND the calendar move
together:**
| State | Set by |
|---|---|
| **awaiting payment** | **approval of the order** *(the promotion itself)* |
| **payment pending** | **the client picking their payment option** in the payment modal |
| **paid** | **an admin verifying** the payment |

⚠️ **Cross-check CR-28**, which used `pending payment → confirmed`. **This is a three-rung ladder,
not two**, and the middle rung is the client's own declaration — which already exists end to end
*(CR-26)*. **Reconcile the vocabulary in review before either is built.**

## CR-61 · G9 · captured — photo, letter, and what other people see
**SAID**
> *"If the user uploads a picture to their profile they should have a toggle in the preferences
> section to show the letter or photo in the actual avatar on the header, anywhere they post, any
> lessons they book, anything any other user or admin sees that they personally did or are associated
> with their image file should be used and where possible, their name but never the avatar its too
> ambiguous."*

| Where | Shows |
|---|---|
| **their own header avatar** | **their choice** — a toggle in preferences: **letter or photo** |
| **anywhere ANYONE ELSE sees them** — posts, lessons they book, anything they did or are associated with | **their photo, and where possible their NAME.** ⚠️ **never the letter avatar** |

⚠️ **The rule is about the audience, not the surface.** A letter is fine when you are looking at
yourself and already know who you are; **to everyone else it is ambiguous** — which is why the toggle
governs only their own header.
⚠️ **G9:** this is a rule for **every** place a person is depicted. **Find them all** — the toggle is
small, the sweep is not.

**ASK-REPO**
1. Where does the letter avatar render today, and how many of those are seen by other people?
2. Is a photo already uploadable, and is there anywhere it is not used when it exists?
3. ⚠️ **CR-50 says a lead's preferences do not show.** Where does this toggle live for someone who
   has not been promoted yet?

## CR-62 · G6 · captured — card order and layout, lead and client ⚠️ SUPERSEDES CR-53's order
**SAID**
> *"lets change my list order for mobile layout on the lead only view of the cards on the account page
> to: my profile, my stable, my orders, my gifts, my login. on desktop my profile goes on the left in
> row 1, my stable goes on the right in row 1, my orders goes on the left in row 2, my gifts goes on
> the right in row 2, and my login goes on the left in row 3. When their Lead designation is promoted
> to Client, they are granted the extra cards and the list becomes: profile, stable, orders, gifts,
> lessons, preferences, posts, saved items, documents, files, login."*

**LEAD — mobile (single column):** `My Profile` → `My Stable` → `My Orders` → `My Gifts` → `My Login`

**LEAD — desktop (two columns):**
| Row | Left | Right |
|---|---|---|
| 1 | **My Profile** | **My Stable** |
| 2 | **My Orders** | **My Gifts** |
| 3 | **My Login** | *(empty)* |

⚠️ **Same sequence, read left-to-right then down** — so ONE list drives both layouts. **It is a
column count, not a second ordering.** *(Confirms the CR-57 assumption that mobile is single-column.)*

**CLIENT — eleven cards:** `Profile · Stable · Orders · Gifts · Lessons · Preferences · Posts ·
Saved items · Documents · Files · Login`
⚠️ **The first four are unchanged and Login stays last** — promotion **inserts six cards into the
middle**. Nothing moves; the lead's world is a prefix of the client's.

## CR-63 · G6 · captured — ⚠️ OWNER ASKED FOR MY TAKE (cannot test it himself)
**SAID**
> *"i want your take on it since there arent items for me to test this with because the abby account
> doesnt have things in places like lessons or orders. I noticed the nav item for my lessons opens a
> dedicated page whereas the my lessons card in account expands to show something. why is there a
> difference? do we need it shown in both places? if so should they have the same functionality (ie:
> one uniform surface two locations to get to it? should we remove my documents from the nav and
> replace it with my orders? seems like orders is a recurring thing and docs are one time maybe two
> possibly 3 lifetime total so they would want to see orders frequently and documents rarely if
> ever..."*

**Four questions, and the first three are one question.**

**MY TAKE — recorded here for step 3, and given briefly in-thread because he is blocked from
testing it:**

**1–3. Nav and card should not be two implementations** of the same working surface — that is the
defect this ledger keeps finding, two things doing one job and drifting apart.
⚠️ **The rule for WHICH surface is CR-74's, not the one I proposed here.** A card may be the work; a
page is for what the card cannot hold. **Read CR-74.**

**4. Yes — swap Documents out of the nav for Orders.** His reasoning holds: **the nav should carry
what recurs.** Orders are ongoing; documents are two or three events in a lifetime. Documents stay a
card, reachable, just not occupying a permanent slot. ⚠️ **One caveat:** documents are *rare but
urgent* — an unsigned one is blocking. **That belongs on the dashboard as a notification (already
specified in CR-59), not in the nav** — which is exactly why the nav slot is the wrong home for it.

**ASK-REPO**
1. Which of the eleven cards expand into a working surface today, and which already summarise?
2. Which have a dedicated page as well? *(The overlap is the duplication.)*
3. Does the nav's composition come from one place, or is it assembled per surface?

**ASK-OWNER** *(step 3)*
1. Confirm: **card = summary + doorway, page = the work.** Applied to all eleven.
2. Does anything genuinely belong ONLY on a card, with no page behind it?

## CR-64 · G6/G8 · captured — DELETE the "nothing to do here" page ⚠️ SECOND LYING PAGE
**SAID**
> *"on the abby account, the dashboard notification that says book your evaluation lesson takes me to
> the last page of onboarding and shows me "nothing to do here. you're all squared away -- theres no
> onboarding waiting on you. and a big button to go "back to your dashboard"...this is another painful
> example of a page that should never exist and its a liar. there is something to do, book an
> evaluation lesson. so something is routing me to this page and its the same page i got to when i
> finished the document signing flow and if it didnt exist where would i go? simple, dashboard if
> notifications are present, community feed otherwise. and the broken link on the current notification
> needs to be investigated and determined to be a bug that is due to my account being in the state it
> was in when the changes were implemented to the flow or its a true bug and it needs to be fixed
> because other people will be affected by it..."*

⚠️ **THE SECOND PAGE THAT ASSERTS A FALSE STATE.** *(CR-52 was the first.)* Asked on 2026-08-25
whether there were others, he answered *"not that I can remember right now"* — **and then found one
within the hour. Assume there are more; go looking rather than asking.**

**Why it is a lie:** it says *"there's no onboarding waiting on you"* **while a dashboard notification
is telling him to book an evaluation lesson.** Both cannot be true, and the notification is right.

**Two ways in, both reported:**
1. **the `book your evaluation lesson` notification** — a broken link;
2. **the end of the document-signing flow** — ⚠️ **this is where CR-59 says the person should exit
   "straight back to the dashboard."**

**✅ THE LANDING RULE, given plainly:**
> *"if it didnt exist where would i go? simple, dashboard if notifications are present, community
> feed otherwise."*

⚠️ **THIS RESOLVES A RECORDED CONTRADICTION.** A prior thread noted he had asked for
*"no notifications → land on the community feed"*, while the code deliberately lands everyone on the
dashboard **unconditionally**, on his own earlier instruction, because a freshly-activated member
still owes their profile details. **That was surfaced and never settled. It is settled now: the
landing is CONDITIONAL.** ⚠️ The old reasoning still needs honouring — *"complete your profile"* is
itself a notification *(CR-59)*, so someone owing profile details **has** a notification and still
lands on the dashboard. **The two rules agree once the profile prompt counts as a notification.
Verify that it does.**

### ⚠️ AND THE BUTTON LIES TOO — owner, 2026-08-25
**SAID**
> *"I have a dashboard notification, we established that and there is a big button that says back to
> your dashboard on a page im taken to when i click on an onboarding task shown on my dashboard and
> the best part of all of this is when i click the back to your dashboard button, it takes me to the
> community feed! lmfao"*

**Three falsehoods on one page:**
| # | Claim | Truth |
|---|---|---|
| 1 | *"there's no onboarding waiting on you"* | there is — his dashboard says so |
| 2 | the button says **"back to your dashboard"** | **it goes to the community feed** |
| 3 | — | he **has** a notification, so under his own landing rule the dashboard is exactly where he should be |

⚠️ **The page implements the EXACT INVERSE of the landing rule he just gave.** It sends a person with
notifications to the feed. That is not a missing rule — **it is the right rule wired backwards**, and
it is worth finding out whether the condition is simply negated somewhere.
⚠️ **The round trip is a closed loop:** dashboard → onboarding task → "nothing to do" → "back to your
dashboard" → **community feed.** He never returns to the thing that sent him.

**ASK-REPO** *(assignments — produce, do not ask)*
0. ⚠️ **Check whether the landing condition is inverted rather than absent.** If some surface already
   asks "does this person have notifications?" and routes the wrong way on the answer, **that is one
   character, not a feature** — and it may be the same code CR-64 is deleting.
1. **Find the page and every route into it.** Two are known.
2. ⚠️ **Diagnose the broken notification link and say which it is:** an artefact of this one account's
   state when the flow changed, **or a live bug that will hit everyone.** He asked for the
   determination explicitly — **answer it, do not report both possibilities.**
3. Sweep for **every** page that asserts a state the system cannot be in. **Two found by him; find
   the rest.**
4. Where else does the app decide where to send someone after finishing something? Apply one landing
   rule.

## CR-65 · G9 · ⚠️ OWNER-ASSIGNED SWEEP — where every flow ends
**SAID**
> *"i dont know yet i havent used it so its worth you researching the flows and paths to see where the
> end of a flow takes the user when its finished..."*

**Asked whether other buttons lie about where they go, he declined to guess and assigned the sweep
instead.** ⚠️ **Produce the answer; do not come back with the question.**

**THE SWEEP — for every flow in the app, end to end:**
1. **Where does it drop the user when it finishes?**
2. **Does the control's LABEL match that destination?** *(CR-64: "back to your dashboard" → the
   community feed.)*
3. **Does it obey the landing rule** — dashboard when notifications are present, community feed
   otherwise *(CR-64)*?
4. **Is the exit a dead end or a loop?** CR-64's round trip never returns the person to what sent
   them.
5. **Does any exit land on a page that asserts a state the system cannot be in?** *(CR-52, CR-64 —
   two found; assume more.)*

**Flows known to have an end worth checking:** document signing *(CR-59 says straight back to the
dashboard)* · onboarding · the self-service signing links · first sign-in / account claim · the
evaluation-lesson shop · payment declaration · booking a lesson · order placement · contract
execution · invitation acceptance.

⚠️ **Deliverable: one table — flow · exit label · actual destination · correct destination.** That
table is also the specification for fixing them, and it is the only way to know whether CR-64's page
is one bug or the visible corner of a pattern.

## CR-66 · G6 · captured — half of a paired feature never landed
**SAID**
> *"we implemented two things and one never landed and the other apparently did, presence gating and
> on first sign in a modal surfaces with toggles for the user to choose which things the menu shows
> and which are hidden and then the preferences section has the same list with the same toggles.
> Neither of the toggle sets are implemented. but the presence gating is in full effect."*

**The pair, as designed:**
| | Status |
|---|---|
| **presence gating** — a nav row appears only when the person has one | ✅ **live and working** *(confirmed in step 2)* |
| **a first-sign-in modal** — toggles to choose what the menu shows | ❌ **never landed** |
| **the same toggles in Preferences** | ❌ **never landed** |

⚠️ **So the menu is currently decided FOR the person and cannot be decided BY them.** Presence
gating answers *"is there anything here?"*; the toggles were meant to answer *"do I want to see it?"*
Only the first question is being asked.

⚠️ **Cross-check CR-63:** its whole question — *should Documents be swapped for Orders in the nav* —
was about what the menu shows. **The intended answer is that the person chooses.** Settle CR-66
before CR-63.
⚠️ **Cross-check CR-50:** a lead's preferences do not show. **So where do a lead's toggles live —
or does a lead simply not get them?**

**ASK-REPO**
1. Is there a stored shape waiting for these toggles, or is nothing persisted?
2. Is the first-sign-in modal partly built, like the tour is?
3. What happens when presence says *"nothing here"* and the toggle says *"show it"* — which wins?

## CR-67 · G9 · captured — ⚠️ THE MOBILE DASHBOARD IS UNUSABLE
**SAID**
> *"on mobile the dashboard shows some primary data that the rest of the page scrolls under instead
> of it scrolling so the dashboard is useless when there are these things visible and i dont know how
> to get rid of them because they appear to be static elements."*

**The KPI cards at the top of the staff dashboard — revenue this week, revenue this month, new
clients, open pipeline — do not scroll. The page scrolls UNDERNEATH them**, so on a phone the
dashboard is a wall of numbers with the actual work hidden behind it, and **there is no way to
dismiss them.**

⚠️ **"I don't know how to get rid of them" is the real severity.** It is not that the layout is
wrong — it is that **the primary surface of the app is unusable and offers no escape**, and the phone
is his working device *(CR-32)*.

### ⚠️ SCOPE, CLARIFIED — owner 2026-08-25
> *"that was my phone and it doesnt have this type of layout so no it doesnt do that for members but
> it does it on desktop for admin"*

| Surface | Affected |
|---|---|
| **admin dashboard — phone** | ✅ **yes** *(the screenshot)* |
| **admin dashboard — desktop** | ✅ **yes** |
| **member dashboard** | ❌ no — a different layout |

⚠️ **It is NOT a mobile bug. It is the ADMIN dashboard's layout, on every screen size.** That rules
out a breakpoint or an overflow-on-small-screens theory: **whatever pins those cards pins them
always**, and it was simply most obvious on a phone.
⚠️ **And the member dashboard is a DIFFERENT LAYOUT** — two dashboards, two layouts, one of which
works. **Standing Q2: the working one may already be the answer.**

**ASK-REPO**
1. Are they deliberately pinned, or is it a stacking/overflow accident? ⚠️ **It happens at every
   screen size, so it is not a small-screen edge case.**
1b. **What does the MEMBER dashboard do differently?** It does not have the problem — **diff the two
   layouts before designing a fix.**
2. ⚠️ **The header is also overlapping** — *"Show Claire's Dashboard"* is half-hidden behind the
   wordmark in the same screenshot. **Same cause, or two?**
3. **Standing Q4** — is the dashboard's mobile layout worth fixing, or is it the next surface that
   needs reimagining rather than repairing?

### ⚠️ INCIDENTAL FINDING FROM THE SAME SCREENSHOT — answers two open ASK-REPOs
The dashboard already shows:
- **"10 NEW CLIENTS THIS MONTH"** ➜ **CR-45's "what does client headcount count today?" — it exists,
  and it is on the dashboard.**
- **"11 of 16 inquiries became clients (90 days)"** ➜ **CR-44's "does a conversion calculation
  exist?" — YES, and it is visible.**

⚠️ **Both are exactly the numbers he said would be corrupted** by promoting people who were never
the right fit *(CR-45)*. **They are not hypothetical — they are on screen, today.**

**Also visible, unreported by him but worth capturing:** `Jumper Training — BLOCKS SELLING — nothing
is buyable under this service`, and two services flagged `LOOKS UNFINISHED — no cover image`. ⚠️ **The
catalogue is already telling us it is incomplete.**

## CR-68 · G2/G9 · captured — the client-facing Add-a-Horse modal
**SAID**
> *"the add a horse modal for the client facing "My Stable" card in Account page, shows two drop down
> selection menus "Barn" and "Stall" but even though the sections are literally named Barn and Stall,
> there is a selection menu with alternate choices Stable and Pen, neither of which can be selected.
> It also instructs to leave barn blank if outdoor, that is dumb text and needs to be removed. the
> idea for stable or stall or pen or barn is that the key terms used can be selected but we need an
> empty option for them to input their own title for what the location is called at the place their
> horse is kept. two fields with the option to set their own names and input a text entry to go with
> it is sufficient to handle mos[t] cases and if there is more to share the notes section is the place
> to do it but the placeholder text inside of the notes section needs to be changed so it says
> "additional information that will be helpful for finding your horse". Trainer should have a
> selection menu and list claire as the first option, then free text as a fall back, we as the company
> maintain the trainer list globally but if the user enters a trainers name they can see that as an
> option to select from in the future. Apply this to t[he] care giver, groom, and "other" on future
> horses for this account only. Also, on the intake modal, accidentally clicking outside of it closes
> it and erases the inputs. found that out the hard way."*

### ⚠️ 68a — DATA LOSS: clicking outside the modal erases everything typed
> *"accidentally clicking outside of it closes it and erases the inputs. found that out the hard way."*

**Severity first: this destroys work with no warning and no undo.** ⚠️ **It is not specific to this
modal** — the outside-click-to-close pattern is repeated across the app *(step 2 counted 33
hand-rolled overlays)*. **Any of them containing a form has the same defect.**
**Fix the pattern, not the instance:** a modal with unsaved input must not close on an outside click
*(or must confirm first)*.
✅ **CONFIRMED ON A SECOND SURFACE, owner 2026-08-25** — the same modal reached from a **contract**
loses the data the same way. ⚠️ **It travels with the component**, so the component fix covers every
surface that mounts it — but that is *not* the same as the 33-overlay sweep, which is still needed
for the other modals that hand-roll their own shell.

### 68b — the location fields are broken and over-explained
| | |
|---|---|
| **the bug** | fields labelled **Barn** and **Stall** offer **Stable** and **Pen** as choices, **and neither can be selected** |
| **the copy** | *"leave barn blank if outdoor"* — ⚠️ **delete it.** *"That is dumb text"* |
| **what it should be** | **two fields**, each: pick a key term *(barn · stable · stall · pen)* **or an empty option to type their own name for it**, plus a text entry for the value |
| **anything else** | goes in **notes** |

### 68c — the notes placeholder
Change to exactly: **"additional information that will be helpful for finding your horse"**
⚠️ **That reframes the whole section**: notes are not general remarks, they are **directions to the
horse.** The two location fields plus this are meant to cover most cases.

### 68d — people fields: a global list plus a personal one
**Trainer:** a selection menu, **Claire first**, **free text as the fallback**.
| | |
|---|---|
| **the company** | maintains the trainer list **globally** |
| **the user** | types a name not on it — and ⚠️ **sees it as an option to select in future** |
| **scope of that memory** | ⚠️ **"for this account only"** — their own additions do not join the global list |

**Same treatment for: care giver · groom · "other".**

⚠️ **STANDING Q2 — THIS PATTERN ALREADY EXISTS AND IS HALF-BUILT.** The app already has a
**managed-options** concept with a **suggestions** side for values people propose. **It has 33 values
across three vocabularies and NO editor anywhere, and the suggestions queue has no screen** — a
standing gap already on the list. ⚠️ **CR-68d is the same mechanism with one new requirement: a
suggestion that is visible only to the person who made it.** **Do not build a second one.**
⚠️ **And it needs the D21 editor** — *an algorithm ships with an editor* — because "the company
maintains the trainer list globally" means someone must be able to maintain it.

**ASK-REPO**
1. Why can `Stable` and `Pen` not be selected — disabled options, a value mismatch, or a broken
   handler?
2. Does the existing managed-options mechanism support a per-account scope, or is it global only?
3. **How many modals contain a form and close on an outside click?** *(68a is a sweep.)*
4. Is this the same intake form staff use *(CR-51 asked the same question)* — so does fixing it here
   fix it there?

## CR-69 · G2/G7 · captured — is there ONE intake form, and does the euthanasia block still show?
**SAID**
> *"we removed the emergency euthanasia block from the intake form, this leads me to question if the
> intake form on the client side under the account page is the same as the one on the onboarding flow
> and further if the one we made accessible on the contracts is the same. if they are the same we need
> to see if the emergency euthanasia authorization block is still showing on those, if it is it needs
> to be removed, this block needs to be removed from the intake form im filling out on the account
> page as a user. and we need to add a photo upload block in its place"*

**Three places a horse intake form appears:** the **account page**, the **onboarding flow**, and
**contracts**. ⚠️ **He does not know whether they are one form or three — that is the first thing to
establish**, because the answer decides whether this is one fix or three.

| | |
|---|---|
| **confirmed** | the euthanasia block **is still showing on the account-page form** and **must go** |
| ✅ **confirmed by the owner, 2026-08-25** | *"i can confirm the contract modal for add a horse is the same as the one the user sees from the account page, so the euthanasia block needs to be removed there"* — **the contract surface and the account surface are ONE component.** |
| ⏳ **still to establish** | whether the **onboarding flow** form is the same one. ⚠️ **Research task, not a question for him.** |
| **in its place** | ⚠️ **a photo upload block** |

⚠️ **TWO OF THREE ARE ONE COMPONENT — so this is ONE fix reaching two surfaces**, and the euthanasia
block is showing to clients on the contract path today, which is the more exposed of the two.
✅ **And CR-68a is confirmed there too:** *"the click out of the modal closes it and the data is lost,
that needs to be fixed."* **The data-loss bug is not confined to the account page** — it travels with
the component, so **fixing the component fixes both**, and any third surface using it as well.

⚠️ **Standing Q2, and it is the whole question here.** *(CR-51 and CR-68 both asked a version of "is
this the same form staff use?" — answer it once, properly, for all four surfaces.)*

## CR-70 · G7/G9 · captured — the horse record page
**SAID**
> *"i need to be able to edit a horse after its in my stable and remove a horse record from my stable.
> Im looking at the horse record page now after adding the horse and it appears to have those
> functions but i dont want to try removing, make sure it works and that its double gated with a
> confirmation modal before action happens. On the horse record page it shows the following tabs,
> record, documents, schedule, and activity. Documents is empty and there is no way to add anything,
> this could be confused with files which would be considered documents, we previously split the two
> so that things authored in the system are documents and things added via upload are files and they
> can include photos, videos, pdfs, and im not sure what other file types are supported by[t] we need
> to research that. with respect to the horse record page we need to add an upload button for adding
> files to the documents tab, we need to add a tab for photos and videos and the upload button on that
> page allows a user to add the content to the record and then they can select from the availble
> content associated with this horse record when they create a post in the community feed, also
> anything they post in the community feed should be able to be tagged with a horse from any of the
> members and the content should appear in the horse record for that horse."*

### 70a — edit and remove, double-gated
Edit a horse and remove it from the stable **appear to exist**. ⚠️ **He deliberately did not test
remove.** **Verify it works, and that destructive action is double-gated behind a confirmation
modal.**

### 70b — documents vs files, and the empty tab
| | |
|---|---|
| **the rule (already ruled, previously)** | **DOCUMENTS = authored in the system.** **FILES = uploaded** — photos, videos, PDFs, *"and im not sure what other file types are supported"* |
| **today** | the Documents tab is **empty with no way to add anything** |
| **wanted** | **an upload button on the Documents tab** for adding files |

⚠️ **He named the confusion himself** — *"this could be confused with files which would be considered
documents"*. **The split is real and already ruled; the tab does not yet reflect it.**
⚠️ **ASK-REPO: what file types are actually supported?** He said to research it. *(This meets the
open feed-media work — no allowed types on the bucket, nine buckets with no size limit.)*

### 70c — a Photos & Videos tab, and it feeds the community feed
1. **A new tab for photos and videos**, with an upload button that attaches content to the horse
   record.
2. ⚠️ **When creating a community post, they can select from the content already on that horse's
   record.** *(Not a fresh upload every time — the record is the library.)*
3. ⚠️ **Any post can be TAGGED with a horse — including another member's horse** — *"tagged with a
   horse from any of the members"*.
4. ⚠️ **Tagged content then APPEARS IN THAT HORSE'S RECORD.**

⚠️ **POINT 3 AND 4 TOGETHER ARE A PERMISSION QUESTION, NOT A FEATURE.** Anyone can tag anyone's
horse, and doing so **writes to that horse's record**. **Who may tag, and can an owner remove a tag
from their own horse?** That must be decided before it is built.
⚠️ **This is also the answer to a long-standing gap:** *"sharing captured content"* was ruled to be
the community feed plus constraints. **This is the mechanism that connects the feed to the records**
— and it makes the media constraints work *(compression, allowed types, size limits)* load-bearing
rather than housekeeping.

**ASK-REPO**
1. Do edit and remove actually work on a horse, and is remove confirmed before it fires?
2. What is the existing files/uploads spine, and does the horse record already link to it?
3. Which file types does the storage layer actually accept today?
4. Can a feed post already reference an existing stored file, or only a fresh upload?
5. Is there any existing tagging concept on a post?

## CR-71 · G1/G2 · captured — the horse record holds its own limits, and they drive availability
**SAID**
> *"we need to add the ability for the horse record to hold the activity restrictions and limits,
> something like the number of hours per day and per week and consecutive days and then this
> information controls the availability of the horse, we can also make it so certain days the horse
> cant be used or the usage is day specific (ie: on tuesdays and thursdays the horse can only be used
> 1 hour, other days the horse can be used 2 hours, and never more than 5 consecutive days, no
> jumping, no trails, etc...)"*

⚠️ **THE HORSE BECOMES A CONSTRAINT ON THE CALENDAR, NOT JUST A FIELD ON A BOOKING.**

**Two kinds of limit, and they behave differently:**
| | Examples | Nature |
|---|---|---|
| **VOLUME** | hours per day · hours per week · **max consecutive days** *(e.g. never more than 5)* | ⚠️ **cumulative — needs history to evaluate.** "Consecutive days" cannot be answered by looking at one booking |
| **KIND** | **no jumping · no trails** | ⚠️ **categorical — evaluated against the offering**, not against a clock |

**And a third thing that is neither:**
| **DAY-SPECIFIC** | *"on tuesdays and thursdays the horse can only be used 1 hour, other days 2 hours"* · certain days **not at all** | a per-weekday schedule of volume limits |

⚠️ **"CONSECUTIVE DAYS" IS THE HARD ONE.** Every other limit can be checked against the day being
booked. Consecutive-day limits require **looking backwards and forwards across existing bookings**,
and they can be **broken retroactively** — cancelling a rest day can put a horse over its limit
without anyone touching that horse's booking. **Design for that or it will be wrong quietly.**

⚠️ **THIS IS THE OTHER HALF OF A PAIR.** A lease already captures **"Reserved days of use"** as
structured data *(CR-23)* — **what a lessee is entitled to.** This is **what the horse can take.**
Both constrain the same calendar and **they can contradict each other**: a lease may reserve four
days a week on a horse whose record allows three. **Which wins, and who is told?**

⚠️ **Standing Q2 — there is already a horse time-conflict check** used when booking. **That is the
seam**; these limits extend it rather than needing a new one.

**ASK-REPO**
1. What does the existing horse time-conflict check actually enforce today?
2. Is there anywhere a horse's schedule is read across a date range, or only per booking?
   *(CR-70's Schedule tab and the missing horse-appointments read are both relevant.)*
3. Do offerings carry anything that says "this is jumping" / "this is a trail ride" — i.e. is the
   categorical limit checkable at all today?
4. Does the lease's reserved-days structure share a shape with this, or are they unrelated?

**ASK-OWNER**
1. **A lease reserves more than the horse's limit allows — which wins?**
2. **Are limits a hard block or a warning staff can override?** *(A vet says three days; Claire knows
   why the fourth is fine.)*
3. **Do the limits apply to everything, or only to riding?** Does a farrier visit consume an hour?
4. **Who sets them — the owner, or us?** ⚠️ For a client-owned horse these are the owner's
   instructions; for a lease horse they may be ours.

## CR-72 · G7 · captured + researched — the four party controls on a contract
**SAID**
> *"explain to me what edit deal terms enables when its checked. also explain what suggest and propose
> do when those are checked... these controls were a good idea at the time but i think we evolved past
> them and might want to change or remove them based on what your research reveals about what they
> control and how wired up everything actually is."*

**FOUR SWITCHES, PER PARTY, PER DOCUMENT — what each actually does:**

| Switch | What it lets that party do |
|---|---|
| **Can fill fields** *(on by default)* | fill in the fields **that belong to their own role** — their name, their address, their answers |
| **Can edit deal terms** *(off by default)* | edit the **shared** fields — the negotiated terms both parties care about, price, dates, responsibilities. ⚠️ **This is the one with teeth** |
| **Can suggest changes** | ⚠️ **not edit — PROPOSE.** Their change is **staged, not applied**, and appears under *"Proposed changes"* for someone to accept or reject |
| **Can add a clause** | propose **a new item** into the contract. Same staging: *"Proposed clauses don't change the contract until accepted"* |

**Two rules built around them:**
- ⚠️ **"Edit deal terms" and "Suggest changes" are mutually exclusive** — you either change the terms
  or you propose changes to them, never both.
- ⚠️ **You cannot turn off "Can edit deal terms" for the last party who has it.** The UI blocks it:
  *"Enable it for the other party first."* Somebody must always be able to move the deal.

**Who is exempt:** ⚠️ **staff and the contract's originator bypass all four** — they can always edit
and always propose.
**One thing nobody may do on someone's behalf:** ⚠️ **elections** — a choice that is a party's own act
*(who carries an obligation)* can only be made by that party. **Not even staff can substitute.**

### ⚠️ FINDINGS THAT BEAR ON HIS INSTINCT

1. **Only TWO control rows exist in the entire system**, both with the same settings:
   `fill ✓ · edit deal ✓ · suggest ✗ · add clause ✓`.
2. ⚠️ **"Can suggest changes" has NEVER been turned on. Not once.** The propose-and-review tier —
   the machinery with the most surface area *(staged values, a review queue, accept and reject
   paths, change history)* — **has never been exercised.**
3. **"Can fill" defaults to on and does the routine work.** It is the only one that earns its keep
   silently.
4. **"Can edit deal terms" is doing real work** and has a real safety rule around it.
5. ⚠️ **The same flag lives in TWO tables** — the per-document controls and the contract parties
   table both carry `can_edit_deal`. **One of them is likely stale.**

### MY READ *(he asked)*
**His instinct is supported, with one exception.** Three of the four are answering a single question
— *is this person a real counterparty, or someone just filling in their details?* — and the fourth,
suggest, was built for a negotiation style **the barn has never actually used**.

**But "edit deal terms" is not decoration.** It is the only thing standing between a counterparty and
the negotiated terms, and it has a guard so a deal can never become unmovable.

**Options for him:**
- **A — collapse to one switch.** *"This party can change the deal"* vs *"this party fills in their
  own details."* Retire suggest and add-clause; keep the election rule and the last-editor guard.
- **B — keep all four, delete nothing, but stop showing what is unused.** Suggest and add-clause
  become staff-only.
- **C — keep as is**, on the grounds that a real negotiation will eventually want proposals.

⚠️ **Before choosing: the propose machinery is not just a checkbox.** Retiring it also retires the
staged values, the review queue and part of the change history — **so it should be a decision about
whether the BARN ever negotiates that way**, not about whether the switch looks tidy.

**ASK-OWNER**
1. **Has a counterparty ever proposed a change rather than making one** — is that a real way you
   work, or a thing that sounded right when it was built?
2. **Should a lessee or a buyer be able to change deal terms at all**, or only fill in their own
   details and sign?

## CR-73 · G7 · captured + researched — remove "I have reviewed the horse information"
**SAID**
> *"as the author (admin) its weird that the box for "I have reviewed the horse information and it is
> accurate" is shown. not just weird that im seeing it as im creating the contract for the first time,
> because i have no way to know if its accurate, the data comes from the horse record and the horse
> record is either mine and i created it so i think its accurate or its not mine and i dont know if
> its accurate...either way remove that entirely from the system it serves no purpose."*

**His reasoning is the whole argument, and it holds:** the horse data comes **from the horse record**.
Either the record is ours — in which case confirming it adds nothing — or it is not, in which case
**we are not the ones who can vouch for it.** ⚠️ **There is no third case**, which is why the control
has no job.

### ⚠️ FINDINGS — it has never been used, and it can BLOCK
| | |
|---|---|
| **documents where the horse section has ever been confirmed** | ⚠️ **ZERO, out of 68** |
| **it is wired into** | the workflow-advance path **and the contract lock blockers** |
| **there is even a reopen path** | `reopen_horse_section` |

⚠️ **A GATE NOBODY HAS EVER SATISFIED, SITTING IN THE PATH THAT LOCKS A CONTRACT.** Either it is
blocking contracts and being worked around, or the blocker is conditional and inert. **Establish
which before removing it** — if contracts have been advancing past an unsatisfied gate, that tells us
something about the other blockers too.

⚠️ **Same shape as everything else this pass has found:** built, wired, and never driven. **This one
is worse than inert — it is a lock condition.**

### Removing it, precisely
- **the checkbox and its button** — gone
- **the gate in workflow-advance and in the lock blockers** — gone *(that is the part that matters)*
- ⚠️ **the two columns on the document** — nothing has ever been written to them, so **there is no
  history to preserve**. D32 keeps evidence; **there is none here.** Removal is clean, and this should
  be stated when it is done rather than assumed.

**ASK-REPO**
1. Is the lock blocker conditional — does it only apply to contracts with a horse? *(All 68 documents
   include the four onboarding releases, which have no horse at all.)*
2. Does anything else read the confirmation — a token, a printed line in a contract body, a party
   view?

## CR-74 · G9 · captured — ⚠️ THE EXPAND-IN-PLACE CARD MAY BE THE STANDARD, NOT THE PAGE
**SAID**
> *"if i click on the horse records tab on the records page the list of horses as rows works really
> well as cards, surfaces I can click on and quickly make changes, its bug free and works great …
> this exact card with click to expand and editable surface is what we should show and use on the
> client record where the horse is shown. right now it opens a full horse record page, im not sure if
> there is a difference and if there is there are bigger decisions to make, i didnt scrutinize the two
> approaches to seeing the horse record, but i used both to make changes to sundance's record
> information and one is clearly superior ux and ui and its the one that is shown on the horse records
> tab."*

⚠️ **THIS SITS AGAINST HIS OWN RULING AND THE TENSION IS THE POINT.**
- **CR-30:** *"every record is a page. [Modals] are for surfacing information quickly, not
  information dense or operationally intensive surfaces."*
- **CR-63:** *"card = summary and doorway, page = the work"* — **my recommendation, which he
  accepted.**
- **Now:** he used both surfaces on the same horse and **the expand-in-place editable card won.**

**These are reconcilable, and the distinction is worth naming rather than choosing between:**
an expanding card is **not a modal** — it does not cover the page, it does not trap focus, and it
keeps the list visible. **The rule may be "no MODALS for dense work" rather than "no CARDS for
work"** — in which case CR-63's *page = the work* is the part that needs revising, not CR-30's.

⚠️ **Two horse surfaces exist and he has not compared them.** *"im not sure if there is a difference
and if there is there are bigger decisions to make."* **Establish whether the page does anything the
card cannot** before either is adopted as the standard — if it does not, one of them should stop
existing; if it does, the difference is the design question.

✅ **FIXED SAME DAY — the one fault he named on the card.** Breed, colour and sex rendered as bare
text boxes while editing, and breed/colour are lookup CODES resolved to names on the read path — so
editing meant typing a raw code correctly on the surface he rates highest. They now render their
lists. *(Retired codes are excluded unless the record already holds one.)*

**ASK-REPO**
1. **What can the horse record PAGE do that the card cannot?** Tabs, documents, schedule, activity —
   the card has none of those. **That is probably the honest answer, and it means the two are not
   rivals: the card is for the record's FIELDS, the page is for everything attached to it.**
2. Where else does an expand-in-place editable card already exist, and where is a page used for the
   same job?

## 🔒 RULING — THE SURFACE RULE, SETTLED (owner, 2026-08-25)
> *"modal and card are not the same. an expanded card with editable fields is perfectly the right
> choice, dont take me to an editor page if im already looking at the thing i want to change. but dont
> use a modal when there is enough information to take up a whole page. modals are sort of temporary
> views, they dont feel like full rich content, and so we should use them when we need to see or do
> something quick without taking the person away from the page they are on. Whereas an expanded card
> opens space on that page to show the content and if its full width like it is on the horse records
> page its far superior to taking the user to a deeper page to show them the same information."*

⚠️ **THE GOVERNING PRINCIPLE:** **do not move someone to see or edit something they are already
looking at.**

| Surface | Use it for | Never |
|---|---|---|
| **MODAL** | something **quick** — see it or do it **without leaving the page you are on**. A temporary view | ⚠️ **anything with enough information to fill a page.** *"They don't feel like full rich content"* |
| **EXPANDED CARD** *(full width, in place)* | **the record's own fields, viewed AND edited**, in the list you found it in. ⚠️ **Far superior to a deeper page showing the same information** | — |
| **PAGE** | a record with **more than its fields** — the things attached to it | ⚠️ taking someone somewhere to show them what the card could have shown |

⚠️ **THIS REPLACES "card = summary and doorway, page = the work"** *(CR-63, my formulation, which he
accepted and has now corrected)*.

⚠️ **AND A SECOND CORRECTION, owner 2026-08-25 — "a modal CAN be the work":**
> *"a modal can be the work, if we ask a person for payment with a notification we open notifications
> as modals for quick view and quick action items and payment is exactly that, they click the
> notification, the modal opens[,] the[y] make their selections for payment and click done and the
> modal closes and the notification should go away."*

**The test is not whether it is WORK. It is whether the work is QUICK and whether the page behind it
should stay.** ⚠️ **Notifications open as modals** — quick view, quick action, and the notification
clears when the action completes. **Payment is exactly that shape.** What a modal must not hold is
**content with enough information to fill a page**, not *work*.

⚠️ **AND IT REFINES "every record is a page"** *(CR-30)*: that ruling was aimed at **modals** being
used as record surfaces, and it stands against modals. **It does not stand against an expanding
card** — the card does not cover the page, does not trap focus, and leaves the list visible.

**What this means for the horse, concretely:** on the client record the horse shows as **the
expanding editable card** — the fields are right there. **The page remains for what the card cannot
hold**: documents, schedule, activity, photos. **They are complements, not rivals.**

## CR-75 · G6/G9 · captured — ⚠️ THE CLIENT RECORD BECOMES AN EXPANDING ROW, AND THE PATTERN NESTS
**SAID**
> *"we can use the same thing for the client records. click the card and it opens to expand to fill
> the page and show the full content. the only slight issue with this is on desktop its a grid of
> cards not rows and thats superior because it shows more information in a denser but very readable
> way but its not alphabetized and even if it was how it reads will be weird so im ok with switching
> to condensed rows with client names and clicking it expands the row into a space that shows all the
> content we discussed having on a client records page. this is definitely superior to the option of
> taking me to a deeper page. the breaking point will be where we draw a line in the sand. does the
> horse record still use the same click to expand approach inside of the expanded space for the client
> record, i vote yes. but, does a document do the same? this one needs to be tested, i vote yes, use
> this principle everywhere it works and see how it plays out."*

### ⚠️ THIS REVISES TODAY'S SURFACE MODEL — read CR-30 and CR-32 alongside it
Earlier today: *"a lead is a submission plus a promote button; a client gets a PAGE."* **The client
half of that is now an expanding row on the records list instead.** ⚠️ **The lead half is
untouched** — a lead is still a dashboard notification opening a modal *(CR-44)*.

### The list itself changes shape
| | |
|---|---|
| **today, desktop** | **a grid of cards** — ⚠️ **he rates the grid HIGHER for density and readability** |
| **why it loses anyway** | **it is not alphabetised**, and *"even if it was how it reads will be weird"* — ⚠️ **a grid has no reading order a person can rely on.** Density loses to findability |
| **wanted** | **condensed rows, client names**, clicking expands the row into a space carrying everything a client record page would have |

### ⚠️ AND THE PATTERN NESTS — deliberately, and to be TESTED
| Level | Expands into | His call |
|---|---|---|
| the client row | the full client record | **yes** |
| **the horse inside it** | the horse's fields *(the card he rates best in the app)* | **"i vote yes"** |
| **a document inside that** | ? | ⚠️ **"this one needs to be tested, i vote yes"** |

> *"use this principle everywhere it works and see how it plays out."*

⚠️ **HE NAMED THE RISK HIMSELF: "the breaking point will be where we draw a line in the sand."**
**This is an instruction to find that line by building, not to decide it in advance.** Three things
that will find it faster:
1. **A DOCUMENT IS THE LIKELIEST BREAK.** A horse's fields fit in a row's worth of space; **a
   contract is pages of prose.** Expanding one inside an expanded horse inside an expanded client is
   three levels of nesting around content that has its own scroll. **Test that case first — it is
   the one that decides the rule.**
2. **MOBILE ALREADY HAS NO ROOM TO NEST.** Everything is full width at one column *(confirmed
   below 1024px)*, so each level of expansion is the whole screen. ⚠️ **The line may be in a
   different place on a phone than on a desktop**, and the phone is his working device.
3. ~~How does someone get back out?~~ ✅ **ANSWERED, owner 2026-08-25:**
   > *"yes i agree about the quick close necessity for the expanded view approach and an obvious close
   > button in the top right that collapses everything and saves their work is the right approach."*

   **Refined moments later, and this is the settled version:**
   > *"right now clicking the header of the card opens and closes and its obvious, easy, and works
   > well. clicking the highest level cards header will obviously close everything"*

   | | |
   |---|---|
   | **the close affordance** | ⚠️ **the CARD HEADER ITSELF** — it already opens and closes, and it *"works well"*. **No separate close button.** |
   | **closing a nested level** | that card's own header |
   | **closing everything** | ⚠️ **the top-level card's header** — collapsing a parent takes its children with it, which happens **for free** in a nesting model |
   | ⚠️ **and it SAVES THEIR WORK** | **closing is never a discard** |

   ⚠️ **The top-right close button is NOT needed** — he proposed it and then found the existing
   affordance already does the job. **Do not build one.**
   ⚠️ **The one thing that does not come for free is the saving.** Collapsing is inherent to
   nesting; **committing edits on collapse is not, and is the part to build.**

   ⚠️ **"Saves their work" is the load-bearing half.** These are **editable** surfaces nested inside
   each other; a close that abandoned edits would make the whole pattern hostile — and **it is the
   exact bug already recorded in CR-68a**, where clicking outside a modal erases everything typed.
   **Same principle, opposite control: closing commits.**
   ⚠️ **So an expanded card needs no separate save.** If closing saves, a save button is a second way
   to do one thing — decide that deliberately rather than shipping both.

### What is already settled and should be reused
- **CR-57/57a/57b — the expand behaviour itself:** full width, smooth stretch, **right arrow when
  collapsed on desktop · down arrow on mobile · up arrow when expanded**. ⚠️ **That rule was written
  for one level. It needs to hold at three.**
- **CR-74 — why an expanding card beats a page:** *do not move someone to see or edit something they
  are already looking at.* **Nesting is that principle applied recursively**, which is exactly why it
  is worth testing rather than assuming.

**ASK-REPO**
1. Is the Clients list a grid today, and what would rows cost?
2. Does anything already nest an expansion inside an expansion anywhere in the app? *(If so, that is
   the prototype.)*
3. What is on the client record page that must fit inside an expanded row?

**ASK-OWNER** *(after testing, not before)*
1. **Where did the line land?** Which level stopped being readable.
2. Does a document expand **in place**, or is a document the point where a page is right?

## CR-76 · G5/G6 · captured + researched — is a "My Payments" surface needed?
**SAID**
> *"do we need a "My Payments" card on the account page and a "My Payments" page that lists all their
> payments? i think its more obvious than assuming that they can see and edit their payment on the
> order itself from the my orders page or card...we need to see how a person can see and edit their
> payment selection and information at present and decide how to proceed if changes are worth
> making."*

### ✅ FOUND — a member CAN already see and change payment, in two places
| Where | What they can do |
|---|---|
| **My Orders** *(the account card and `/app/orders` — same content)* | ⚠️ on an **unpaid** order, a **"Manage payment"** button opens **a MODAL** — payment method, and **transferring who pays** *(a parent taking over a rider's payment)* |
| **the order itself** *(`/order/:id`)* | the fuller panel — **declare Zelle or cash, with a reference** |

⚠️ **"MANAGE PAYMENT" IS ALREADY A MODAL** — the exact shape he just described as correct for
payment. **The pattern is not missing; it is unreachable from where he expects it.**

⚠️ **It appears on UNPAID orders only.** So a member has **no way to look back at what they paid** —
which is a different need from changing a payment, and the one a "My Payments" surface would
actually serve.

### THE RECOMMENDATION
**Two different things are being conflated, and only one of them is missing.**
1. **Managing a payment** — ⚠️ **already built, twice.** A third surface would be a **third
   implementation of one job**, which is the defect this ledger keeps finding. **Fix the REACH, not
   the surface count.**
2. **A payment HISTORY** — ⚠️ **genuinely absent.** *"A list of all their payments"*, including paid
   ones, is not reachable anywhere.

**So: no "My Payments" editor. A payment history, if he wants one — and the honest question is
whether that belongs as its own card or as paid orders being visible in My Orders**, since a payment
is an attribute of an order rather than a thing a person owns separately.

⚠️ **And the notification path he described is the real answer to discoverability:** *"they click the
notification, the modal opens … and the notification should go away."* **That is the reach problem
solved** — the person is told there is a payment due and acts on it in place, instead of being
expected to go looking under Orders.

**ASK-OWNER**
1. **Do you want a payment HISTORY**, or is *"paid orders stay visible in My Orders"* enough?
2. Should **"Manage payment"** also appear on a **paid** order — to view what was paid, not change
   it?

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
| **CR-71 ↔ CR-23** | the lease says what a lessee may use; the horse record says what the horse can take — they can contradict |
| **CR-71 → CR-03, CR-07** | horse limits are a second input to what the calendar may offer |
| **CR-69 → CR-51, CR-68** | three change requests now hinge on whether the horse intake form is one component or several |
| **CR-70c → feed media** | tagging writes to another member's horse record — a permission question, and it makes the media constraints load-bearing |
| **CR-68a → G9** | outside-click-closes destroys unsaved input; 33 hand-rolled overlays share the pattern |
| **CR-68d → lookup options** | the propose-a-value mechanism exists, has no editor, and its queue has no screen |
| **CR-66 ⟶ CR-63** | the nav question assumes we choose; the design says the person chooses |
| **CR-67 ⟶ CR-32** | the phone is his working device, and the dashboard is unusable on it |
| **CR-64 ⟶ CR-52** | second page asserting a false state; the sweep is now a task, not a question |
| **CR-64 ⟶ CR-59** | the signing flow's exit currently lands on the page CR-64 deletes |
| **CR-59 ⟶ CR-27** | approving the order IS the promotion — the approval nothing can currently perform |
| **CR-60 ↔ CR-28** | three rungs here, two there; the vocabulary must be reconciled before either is built |
| **CR-61 ↔ CR-50** | the avatar toggle lives in preferences, which a lead cannot see |
| **CR-53 ⟶ CR-50** | the four-item nav and five-card account page supersede the three-item allowlist |
| **CR-55 ↔ PDF work** | the on-screen reader repeats the page-break defect already fixed in the PDF renderer — one of the two viewers should not exist |
| **CR-51 ↔ CR-10** | one says hide horse services without a horse, the other says let them order and ask at sign-in |
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
