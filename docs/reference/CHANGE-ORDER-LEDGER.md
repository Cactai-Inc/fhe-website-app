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

**Method:** `docs/method/METHOD-change-orders.md`. **Narrative + evidence so far:**
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

### 🔒 OWNER RULING — MY RECOMMENDATION IS OVERRULED (2026-08-25)
> *"i disagree with you, the two surfaces you mentioned are on the same location[;] we strip the more
> complicated one unless it has genuinely more information to display[,] then we keep both[,] and we
> add a payments page and card[.] and while the payment is pending it can be changed. a zelle never
> sent needs to be switched to cash by someone if they changed their mind and we wont mark it as paid
> until we see the zelle anyway, so might as well give them the power to change it so we dont have to.
> it saves time and discussions and confusion."*

**The decision:**
1. ⚠️ **BUILD the "My Payments" card AND page.** *(My "no payments editor" recommendation is
   withdrawn.)*
2. **The two existing surfaces are in one location — consolidate.** ⚠️ *"Strip the more complicated
   one UNLESS it has genuinely more information to display, then we keep both."*
3. ⚠️ **A PENDING PAYMENT IS CLIENT-EDITABLE.** *"A Zelle never sent needs to be switched to cash by
   someone if they changed their mind."*

**⚠️ HIS REASONING IS THE PART TO KEEP, AND IT IS BETTER THAN MINE:**
> *"we wont mark it as paid until we see the zelle anyway, so might as well give them the power to
> change it so we dont have to. it saves time and discussions and confusion."*

**The barn already refuses to mark anything paid until the money is seen. So a client changing a
declaration they have not acted on costs the business NOTHING — and every change they cannot make
becomes a message someone has to read and act on.** ⚠️ **I weighed "don't add a third
implementation" and missed that the surfaces are two halves of one job in one place, and that the
operational saving is the point.**

### ✅ AND THE "UNLESS" CLAUSE IS ALREADY ANSWERED — they are NOT the same thing
Checked. **Each carries something the other does not**, so **both survive his own test:**
| Surface | Carries |
|---|---|
| **"Manage payment"** *(modal, My Orders)* | the payment **method**, and ⚠️ **transferring WHO PAYS to another account** — a parent taking over a rider's payment |
| **the order's own panel** *(`/order/:id`)* | **declaring the payment** — Zelle or cash — with ⚠️ **a memo / reference**, which is what lets it be matched to money received |

⚠️ **Neither is "the more complicated one".** One changes the ARRANGEMENT *(how, and who)*; the
other makes the DECLARATION *(I have paid, here is the reference)*. **Merging them loses a field
either way — so the consolidation is bringing both into ONE control on the payments surface, not
choosing a winner.**

### THE ORIGINAL RECOMMENDATION — superseded, kept only to show what was weighed
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

### ✅ BOTH ANSWERED, owner 2026-08-25

**1. What may a client change?** — *"thats it there are only two choices for payment"*
⚠️ **The method, between TWO options, and nothing else.** Not the amount, **not who pays.**

⚠️ **AND THE UI DISAGREES WITH HIM TODAY — TWO WAYS.** The Manage-payment dropdown offers **four**:
```
const PAYMENT_METHODS = ['Zelle', 'Check', 'Cash', 'Card'];
```
- ⚠️ **`Check` and `Card` are not real options.** The declaration path only ever offers **zelle** or
  **cash**, and production has only ever held `zelle` (5), `cash` (1) and blank (2). **Two of the
  four choices lead nowhere.**
- ⚠️ **AND THE CASING DOES NOT MATCH.** The dropdown writes **`'Zelle'` / `'Cash'`** capitalised; the
  declaration path writes **`'zelle'` / `'cash'`** lowercase, which is what every row in production
  actually holds. **Anyone using that dropdown writes a value nothing matching on the lowercase form
  will find.** ⚠️ **Latent, and it would land exactly on the client-editable path he has just asked
  for.**

**2. What does "pending" mean?** — refined by him to the precise version:
> *"pending is used when they declared they made or will make the payment once they select their
> choice from the payment screen. until they make a selection its awaiting payment. and when we
> verify payment was received its marked paid."*

⚠️ **THREE DISTINCT STATES — and this is CR-60's ladder exactly, confirmed:**
| State | Begins when | Set by |
|---|---|---|
| **awaiting payment** | the order exists and **they have not chosen yet** | approving the order *(CR-27: approval creates it)* |
| **payment pending** | ⚠️ **they SELECT their choice on the payment screen** — declaring they have paid **or will** | **the client** |
| **paid** | ⚠️ **we verify the money was received** | **an admin** |

⚠️ **The trigger for `pending` is THEIR SELECTION, not our uncertainty.** Both the middle and the
first rung are unverified, but only one has a declaration behind it.
✅ **CR-60 is confirmed rather than simplified** — three rungs, three triggers, unchanged.

⚠️ **WHAT THEY MAY DO, BY STATE:**
- **awaiting payment** → **make a selection** *(this is what moves it to pending)*
- **pending** → ⚠️ **CHANGE the selection** — Zelle to cash and back — *"a zelle never sent needs to
  be switched to cash"*
- **paid** → nothing; it is settled.

**ASK-OWNER — remaining**
1. **Does the payments page list paid history too**, or only what is outstanding?

---

## CR-76b · G5 · 🔒 LOCKED — MY PAYMENTS IS A HISTORY LEDGER, NOT AN OUTSTANDING LIST

**SAID** *(owner, 2026-08-25, closing the last open question on CR-76)*:
> *"My Payments is a history ledger showing every time a payment page was engaged with and what it
> saved and what its assocaited with, when it was done, all the changes made if any exist, and the
> fuller picture of the status and timestamps. each entry is linked to some type of transaction, as
> of now that can only be an order, so we would create a payment number along side an order number
> and the entries would show the meta data for things like when the order was submitted, when it was
> approved, when payment was submitted, when it was marked paid, what payment method was used, and if
> there were any issues. from this entry the link to the order should be clickable to open the orders
> history page and scroll to that order number and expand it."*

**🔒 LOCKED. It answers the open question: the page carries EVERYTHING, not only what is outstanding.**
⚠️ **And it is not a payments list — it is an AUDIT TRAIL with a payment as its subject.** Every
engagement, every change, every timestamp. **A record of what happened, not a to-do.**

### FOUND — the ledger, the vocabulary and the order number ALL EXIST. Almost nothing writes to them.
This is the repo's standing pattern again *(§6 of the restart doc)*.

| | |
|---|---|
| the ledger table | ✅ **`status_events`** — `entity_type` · `entity_id` · `status` · `detail` · `actor_user_id` · `created_at` |
| `entity_type = 'order'` | ✅ **already a live type**, 48 events |
| the order number | ✅ **`purchases.display_code`** — `PUR-000318` |
| **a payment number** | ❌ **does not exist. This is the one genuinely new identifier he is asking for.** |

⚠️ **THE VOCABULARY ALREADY NAMES ALMOST EVERY LINE HE DESCRIBED.** `status_events_vocab` defines
**20 terms** for `order`, including `submitted` · `payment_requested` · `payment_pending_zelle` ·
`payment_pending_cash` · `payment_reported` · `partial_payment` · `paid` · `claim_confirmed` ·
`claim_declined` · `client_flagged` · `item_voided` · `items_moved` · `split` · `grant_reversed`.
**"What payment method was used" and "if there were any issues" are already named terms**, not new ones.

### ⚠️ TWO MEASURED PROBLEMS, AND THE SECOND ONE IS A DATA FAULT
1. ⚠️ **COVERAGE IS ALMOST NIL.** Eight live orders: **seven carry exactly ONE event, one carries two.**
   Only `submitted` · `paid` · `pending` · `payment_reported` · `payment_pending_*` · `claim_confirmed`
   · `enquiry` have ever been written. **A ledger built on this today would render one line per order.**
   **The build is the WRITES, not the page.**
2. ⚠️ **39 ORDER EVENTS ON 16 ENTITY_IDS MATCH NO PURCHASE THAT EXISTS** — two-thirds of the order
   history points at nothing. `status_events` has **no foreign key** on `entity_id` *(it cannot have
   one — it is polymorphic)*. **Establish what those 16 were before building a page that reads them.**

### ⚠️ CROSS-FINDING — THE LEDGER SPANS TWO ENTITIES, AND CR-27 IS WHY
He asks one entry to carry **"when the order was submitted"** AND **"when it was approved."**
⚠️ **Under CR-27's ruling, approving IS creating the order — so those two facts live on DIFFERENT
ROWS:** the *submission* is a `requests` row; the *order* is the `purchases` row that approval
creates. **One payment entry must therefore stitch a request to a purchase.** There is no
`payment_requested`→`request` edge in the vocabulary today. **Settle this before the schema.**
*(It also explains the 16 orphans as a likely candidate — check whether they are request ids.)*

### THE REACH
`/app/payments` and a **My Payments** card, presence-gated like the rest. **Each entry links to its
order and the orders history page opens on that order number, expanded** — ⚠️ **which is CR-75's
expanding-row pattern doing exactly the job it was ruled for: deep-link, scroll, expand in place.**

### THE TELL
An order with a changed payment method shows **both** choices and when each was made — **not the
current value with the earlier one lost.** ⚠️ **That is the acceptance test: a CHANGE is visible as a
change.** *(CR-76 already ruled a pending payment is client-editable; this is where that edit becomes
evidence.)*

### 🔒 ANSWERED — THE PAYMENT NUMBER IS PER INPUT, NOT PER ORDER
> *"yes we need to have a payment number as an identifier that is unique to each input on the payment
> screen."*

⚠️ **So the ledger is MANY rows per order, and the payment record is its own entity** — an order has
a payment number the way it has line items. **This is the schema decision, and it is now made.**

### 🔒 AND IT ANSWERS A QUESTION HE ASKED IN THE SAME BREATH — **NO, A PAYMENT CANNOT BE SPLIT TODAY**
> *"can a user currently split payment among cash and zelle?"*

**No.** `purchases.payment_method` is **ONE text column ON THE ORDER** — one method, one order.
⚠️ **`amount_paid` exists and `partial_payment` is a defined vocabulary term — used ZERO times** — so
a partial AMOUNT is modelled while the METHOD that paid it has nowhere to live. Production bears it
out: every order is a single method, and `amount_paid` is either `0` or the full amount.

⚠️ **HIS OWN RULING IS THE FIX.** A payment record per input — with its own number, method and amount
— **is** split payment: two inputs against one order, one Zelle, one cash, each with its own number
and timestamp. **The identifier decision and the split capability are the same build.** *(It also
retires the single `payment_method` column as the source of truth, which is where the `'Zelle'` vs
`'zelle'` casing bug in CR-76 lives.)*

---

## CR-77 · G7 · captured + researched — ⚠️ THE SIGNER'S NAME AND TITLE ARE AUTHORED, NOT SIGNED

**SAID** *(owner, 2026-08-25, on being told the company signer tokens print empty)*:
> *"we never signed a contract as the company yet but my understanding of how its designed and this
> is the way it should work, when the lessor has entered their information i review it, they have
> signed it if i entered my information already which as the author i have, and so im the last to
> sign, i open the document with their signature on it and i scroll to the bottom and i need to do
> the same thing as them, type my full name and since im signing on behalf of the company i have to
> include my title and then those fields are populated along with the digital signature being applied
> and the final document is sent to both of us as a pdf."*

**FOUND — his model and the build disagree, and the build is what is blocking him TODAY.**
`LESSEE.ENTITY_SIGNER_NAME` / `_TITLE` are ordinary `contract_field_defs` rows in the `SIGNATURES`
section, `owner_role = LESSEE`, `is_optional = false`, shown only when `LESSEE.PARTY_TYPE = ENTITY`.
⚠️ **Nothing in `src/` or `api/` writes them** — no signing surface collects them. They are
**authoring fields that must be filled before the document can lock.**

⚠️ **Measured on the live lease — `contract_lock_blockers` returns ONE blocker with THREE fields:**
`Signing individual — name` · `Signing individual — title` · `Lessor prohibits the use of rider aids`.

⚠️ **CORRECTION, 2026-08-26 — I CALLED THE THIRD FIELD A DEADLOCK. IT IS NOT.**
`TXN.RIDER_AIDS_PROHIBITED` is `owner_role = LESSOR` — Pamela's — and I wrote that it deadlocks,
because she cannot answer it until the contract reaches her and it cannot reach her until it locks.
⚠️ **THE SECOND HALF IS FALSE. SENDING DOES NOT REQUIRE LOCKING.** `sendForReview`
(`src/lib/contracts.ts:551`) advances the document to `in_review` **when it is not locked** and sends
anyway; its own comment says sending a locked document is merely *also* legitimate. **A counterparty
fills their own fields in `in_review`, before any lock exists.** So the sequence is
**send → she fills → THEN it can lock → both sign.** No deadlock, and her two fields are hers to
answer, not ours.

⚠️ **AND `locked` DOES NOT MEAN SEALED. IT MEANS "READY TO SIGN"** — `ContractPage.tsx:1221` already
labels it exactly that. It freezes the TEXT so signatures attach to a fixed document; `executed` is
the finished state after signatures. **Nothing reverted:** the blocker removed on 2026-08-25 was
`horse_unconfirmed` *(migration `20260825T1200`)*; what blocks today is `required_fields`, a
different code that was never removed and is **the very gate the owner describes wanting** —
*"once the document has all fields filled there should be a button that becomes active."*
⚠️ **THE WORD IS THE PROBLEM, NOT THE MECHANISM. `locked` should be retired from every surface and
message in favour of READY TO SIGN** — it reads as *sealed and finished* to the person using it.

**ASK-OWNER:** should capacity (name + title) move to the **signature act**, as he describes, leaving
only the party's own facts as authored fields? And **must a counterparty-owned field block the lock**,
or should lock require only the fields whose owner is the sender?

**A/B for shipping today, independent of the design:** fill the three fields in the authoring surface
and lock — **or** decide the lock rule first. ⚠️ **The two signer fields are ours and cost nothing to
fill. The rider-aids pair is Pamela's and filling it for her is answering on her behalf.**

---

## CR-78 · G4 · captured — ⚠️ THE SENDER IS NOT TOLD WHEN IT IS HIS TURN

**SAID** *(owner, 2026-08-25, walking the counter-side of the flow)*:
> *"for pamela she will sign and then she will see and sign her docs but her email will only be the
> docs it wont include the contract because she cant get that until i sign, if i sign first, which is
> possible but unlikely since she needs to add information that in its absence is preventing me from
> signing, she is most likely to sign after adding the info and i will get a notification (i should
> get a notification when the document is signable, meaning all fields have been completed, and
> likely another email when they sign) telling me to sign it."*

**TWO NOTIFICATIONS ASKED FOR, and they are different events:**
1. ⚠️ **SIGNABLE** — every required field is now filled. **This is not a signature event**; it fires
   when the last blocker clears, which may be a party editing a field and never touching a signature.
2. **SIGNED** — the counterparty has signed and it is now his turn.

⚠️ **HE ALSO STATED THE ORDERING CONSTRAINT AS A FACT, AND IT SHOULD BE CONFIRMED, NOT ASSUMED:**
that Pamela's own send carries **her documents but not the contract**, because the executed contract
does not exist until he signs last. **The one-email ruling in `docs/reference/SPEC-first-contact-flow.md`
describes the send at the START of her flow; this is the send at the END of it, and they are not the
same email.** ⚠️ **Reconcile the two before either is built.**

**ASK-REPO:** does anything fire on "the last blocker cleared"? `contract_lock_blockers` is a READ —
nothing appears to watch it. The execution-time bundle (`api/deliver-documents.ts`) is the only
confirmed send on this path.

---

## CR-79 · G7 · captured — ⚠️ AN UPLOADED FILE CANNOT BE VIEWED OR DELETED

**SAID** *(owner, 2026-08-26)*:
> *"need a way to delete files. there are two test files from walk4 that i cant delete or even see i
> can only download them, need a button to view and a method to select and delete"*

**Two separate defects in one sentence, and neither is cosmetic:**
1. **NO VIEW.** The only affordance is DOWNLOAD. A file has to leave the app to be identified, which
   makes "is this the one I want to remove?" a round trip through the Downloads folder.
2. **NO DELETE.** ⚠️ **Test files uploaded during a walk are now permanent.** Anything uploaded by
   mistake — or containing something it should not — cannot be taken back through the browser.

**He asked for SELECT-AND-DELETE, i.e. multiple at once**, not a per-row bin icon.

⚠️ **THIS COLLIDES WITH D32 (nothing is removed) AND WITH THE EXECUTED-DOCS RULE.** A signed document
is evidence and must never be sweepable. **So the delete has to distinguish an UPLOADED FILE from a
GENERATED DOCUMENT** — the `files` / `file_links` spine (TASK-UPLOADS) is the former; `documents` is
the latter. **Deleting must be a soft delete on `files`, never a path that can reach an executed
document.**

**🔒 ANSWERED AND BUILT, 2026-08-26.** Owner: *"staff and uploader, we already ruled on this, delete
is soft delete unless its a sensitive file and then i can hard delete from db"* and *"remove the url
leave the object in the db unless i go in and hard delete it or if you give the option to soft or hard
delete from admin ui that is best."*

- **REMOVE** — tombstones the `files` row **and its `file_links`**; the bytes stay, so **Restore** is a
  straight untombstone. ⚠️ **This CHANGED existing behaviour:** `removeMyFile` had been deleting the
  stored object on what it called a soft delete.
- **DELETE PERMANENTLY** — takes the object too. Confirms, and names the count.
- **`listOrgFiles(includeDeleted)`** — without a way to SEE a tombstone there is nothing to restore,
  and a soft delete would be indistinguishable from destruction.
- **VIEW** — images, video, audio and PDFs render in place; anything else opens in a tab.
- ⚠️ **The table never touches `documents`.** A generated or signed record is evidence and is not
  sweepable from here; separate spines, separate tabs.

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
| **CR-76b ⟶ CR-27** | ⚠️ one payment entry must stitch a `requests` row to a `purchases` row, because approval is what creates the order |
| **CR-76b ⟶ CR-75** | the orders page opening on a number and expanding it IS the expanding-row pattern; do not build a second mechanism |
| **CR-77 → CR-78** | the lock blocker is what makes the "it is your turn" notification meaningful — one gate, one signal |
| **CR-78 ↔ SPEC-first-contact-flow** | ⚠️ the one-email ruling covers the send at the START of her flow; this is the send at the END |
| **G9 ← everything** | each group's fix should carry its globalization, or the refactor inherits 34 pop-ups instead of 33 |

# ⚠️ ALREADY BUILT — carry the requirement, not the code
CR-11 · CR-15 · CR-17 · CR-18 · CR-19 · CR-20 · CR-36 — all on surfaces CR-30 may replace.

# ⚠️ ALREADY EXISTS — do not rebuild
Complete / no-show / pending-payment / confirmed states · the "I have paid" declaration · the
standing-weekly editor (wrong screen) · changing a horse's owner · resolving a name-only owner ·
the horse-care paperwork rule (enforced, ignored by the screen) · a today list on the dashboard ·
the customer-facing evaluation gate.

---

# ⚠️ CAPTURED 2026-08-27 — THE CLIENT RECORD IS THREE SURFACES AND TWO OF THEM ARE UNREACHABLE

## CR-80 · G6 · captured + researched — the good record page is reachable exactly once

**SAID**
> *"When I setup a new account manually and save it I see a nice full open profile with a bunch of
> pages linked as buttons on the top of the page. when i go back after the first provisioning pass i
> cant see any of that and i get this fucked up configuration page that needs to be thrown in the
> trash. i dont know why there is not direct path to the full user contact record until they have
> logged in, but whats more troubling, the page i see when setting up a new user as a contact record
> is not the same page i see when i go look at already activated contact records. there is a beautiful
> functional perfectly designed contact record page that is only accessible one time and that is when
> im first setting up a new client and other than that all pathways to seeing a client record take me
> to either the shit single page with not tabs or buttons to see any other parts of the contact
> record, or a shitty outdated version of the contact page."*

**FOUND — two independent gates, and they compound into a hole.**

**GATE 1 — the nine-tab account surface requires a LOGIN, not a person.**
`Admin.tsx:739` — `if (!selectedId || !selected?.user_id) return;` — so `admin_client_overview`
is never fetched for anyone without an auth account, and the Overview / Bookings / Documents /
Orders / Payments / Activity / Posts / Messages / Login tabs render against nothing.
`admin_client_accounts()` returns three kinds: `account` (has `user_id`), `pending` (**NULL**) and
`contact` (**NULL**). ⚠️ **Measured: 15 of 22 live clients have no login, so the tabs cannot load for
them.** This is exactly his *"no direct path to the full user contact record until they have logged
in"* — and it is literal, not a permissions quirk.

**GATE 2 — the rich provisioning form is gated to BEFORE the invitation is sent.**
`Admin.tsx:379` — `if ((neverInvited || isDraft) && row.contact_id) { … }` where
`neverInvited = !row.invite_id && !row.invite_status` and `isDraft = row.invite_status === 'draft'`.
**That block is the "beautiful page": `ProvisionClientForm` (category, paperwork, offerings) plus
`AgreedLessonSection` (the day-and-time picker).** ⚠️ **The moment the invitation is sent the whole
block stops rendering** and the surface falls through to resend / expire / regenerate controls —
his *"fucked up configuration page."*

⚠️ **THE HOLE BETWEEN THEM IS REAL AND OCCUPIED.** Invitation sent + never logged in = **neither**
surface. Gate 2 has closed and gate 1 has not opened. **Measured: 7 clients have the tabs, 14 have
the provisioning form, and 1 is stranded with neither.** That one is not an edge case — it is the
normal state of every client between "invite sent" and "they got round to signing in."

**FOUND — and the third surface is real too.** `ContactDossierModal` and the retired `ContactsPage`
are the *"shitty outdated version"*; `ClientRecordActions.tsx` says in its own header that the modal's
parts came from the client page and the page was never switched over. ⚠️ **This is CR-33 restated by
the owner nine days later, now with money attached — see CR-81.** CR-31 *("no way to add a horse to
Pamela's record")* is the same gate from a different angle.

**ASK-OWNER** — none. The requirement is unambiguous: **one record surface, reachable at every stage
of a person's life, with the provisioning capabilities available after the invitation as well as
before.** ⚠️ It is CR-30/CR-75's People wave; **what is new is that it is now blocking revenue.**

## CR-81 · G2/G5 · captured + researched — ⚠️ A 2× WEEKLY CLIENT CANNOT BE SET UP AFTER PROVISIONING

**SAID**
> *"the clients that have a 2x monthly subscription, cannot be setup for it. even when i go in and add
> a new offering for the 2x weekly it doesnt show up the same way as when i add it for a client im
> setting up for the first time. with that client im able to assigne the 2x weekly package, pick their
> days and times, and the card says 2x weekly paid monthly $880, and the lessons appear on the
> calendar"*

**FOUND — this is CR-80's gate 2, with the invoice attached.** Choosing a recurring offering **and**
picking the standing days and times is possible **only** inside the `ProvisionClientForm` +
`AgreedLessonSection` pair, and that pair renders only while `neverInvited || isDraft`.
⚠️ **So the £/$880 2× weekly plan — the barn's most valuable product — can be sold to a brand-new
contact and to nobody else.** An existing client who wants to start, resume, or change a weekly plan
has no surface that can do it. Adding the offering elsewhere writes an order line but never places
the standing slot, which is why it *"doesnt show up the same way."*

⚠️ **This is D23's standing-slot model working correctly and being unreachable** (D17). The engine is
not the defect; the single gated doorway is.

## CR-82 · G5 · captured + researched — the horizon, and the first month's price

**SAID**
> *"the only thing left to fix with that flow is the lessons are added for 90 days, it should only add
> them on a monthly basis and when setting it up it should ask if i want to prorate the purchase and
> then it reduces the price by the number of lessons remaining for their selected days that month. if
> i say no it gives credits for the prior days that month that were missed and then the user can use
> them whenever they want to get in an extra lesson."*

**FOUND — the 90 days is two hardcoded lines, and the monthly machinery already exists.**
`ensure_standing_slots` line 11: `v_target date := current_date + 90;`
`_ensure_plan_horizon` line 10: `v_through date := coalesce(p_through, current_date + 90);`
⚠️ **`_ensure_plan_horizon` already loops month by month (`v_month + interval '1 month'`), already
records `config->>'horizon_through'`, and already takes a `p_through` argument.** The month-at-a-time
behaviour he is asking for is the default being wrong, not a mechanism that is missing.

**FOUND — ⚠️ NOTHING PRORATES, AND THE PUBLIC SITE ALREADY PROMISES IT.**
**Zero** database functions match `prorat`. The only occurrence in the whole repo is
`src/pages/Lessons.tsx:52`, a footnote on the weekly-subscription cards:
> *"First month can be prorated or book all your lessons for the month in the days …"*

**So a customer reading the lessons page today is told the first month can be prorated, and no code
anywhere can do it.** ⚠️ **Same shape as CR-28's false three-month promise and D23's booking copy:
the copy is right and the code is absent.** His request is therefore not a new feature — **it is the
implementation of a promise already published.**

**THE TWO BRANCHES, in his words:**
| Choice | Effect |
|---|---|
| **prorate = yes** | **reduce the price** by the lessons *remaining* on their chosen days this month |
| **prorate = no** | **issue credits** for the days already missed this month, spendable whenever, for an extra lesson |

⚠️ **Note against D23:** branch 2 mints a **spendable** credit from a recurring plan, which D23 calls
defective in the general case. **It is not defective here, and the distinction matters:** D23's rule
is that the standing slot is the entitlement and a recurring purchase must not mint a spendable
balance *for the slots it is placing*. These credits are for slots that **already passed before the
plan started** — the same "session owed but not delivered at its standing time" holding form D23
itself describes for cancellations. **Consistent, but it must be written into the spec or the next
thread will read it as a D23 violation and refuse to build it.**

**ASK-OWNER**
1. **When prorating, is the price reduced pro-rata per remaining lesson, or to a whole number of
   weeks?** *(2× weekly at $880/month is $110 a lesson at 4 weeks; a half month is not always 4 of 8.)*
2. **Do the no-prorate credits expire?** D23's holding-form credits do; these are compensation for a
   month he was paid in full for.

---

## 🔒 CR-30 — SUPERSEDED IN PART, 2026-08-30. LEADS RETURN TO A RECORDS-STYLE PAGE.

**SAID (owner, 2026-08-30):**
> *"yes i changed my mind on item 3, after testing the unified single records page it was clearly not
> the right decision. This new revision set should help me understand the other side of the options
> and if i like it, then its the basis for the refactor, if i dont like it, the refactor has more
> work to do to come up with a 3rd option."*

⚠️ **THIS SUPERSEDES CR-30's "LEADS LEAVE THE RECORDS PAGE ENTIRELY" RULING** *(2026-08-25: "we get
rid of leads as a record tab from the record page and they exist as a notification on the
dashboard")*. **Under the ledger's own override rule, the earlier statement is DELETED — proceed as
if it was never made.** Leads belong on the **Contacts** page alongside Clients, Partners and
Vendors, per item 3 of the 2026-08-29 admin list.

⚠️ **AND THE REASONING IS THE PART THAT OUTLIVES THIS DECISION.** He is **not** asserting the new
shape is right. He is **buying information**: the unified single records page was tested and rejected,
and this build exists to show him the opposite option so he can judge it against something real.

**Three consequences, and they bind the refactor:**
1. ⚠️ **THIS IS AN EXPERIMENT WITH A DECLARED EXIT.** *"if i like it, then its the basis for the
   refactor, if i dont like it, the refactor has more work to do to come up with a 3rd option."*
   **A third option remaining necessary is a SUCCESS of this build, not a failure of it.**
2. **So it must be built to be JUDGED, not to be permanent.** Nothing downstream should assume the
   Contacts shape survives. **Do not let a later task cite it as settled architecture.**
3. ⚠️ **`TASK-AR3` is instructed to surface this as an unresolved collision. It is now resolved —
   ORCH6 must tell AR3's report so, and must not re-put the question to the owner.**

**The dashboard-notification lead handling from CR-30 is not retired by this** — a lead can be both a
row on Contacts and an item that surfaces on the dashboard. **Only the "get rid of leads as a record
tab" half is deleted.**

---

## CR-83 · G6/G9 · captured — normalise a typed name, and let them correct it before they sign

**SAID (owner, 2026-08-31):**
> *"nearly no names start with a lowercase first letter for the first or last name. names like
> LaBuzetta is a departure from normal single capitalized letter last name but not a unique
> situation, its common. What we should be doing with name entries like Elisheva fiszer, is
> correcting the non capitalized last name to normalize it, what we should not do is change
> LaBuzetta to Labuzetta, and we cannot be expected to get labuzetta properly changed to LaBuzetta
> but Labuzetta is better than labuzetta, the user can adjust it manually on their own. if it was
> la buzetta we could concievably change that to La Buzetta and if the person corrects it to
> La buzetta that is ok we shouldnt recorrect it."*

> *"if we do this prior to signature, we need to allow them to go back (ui must contain a back button
> so data entered isnt lost and if possible also not lost on browser back button) so they can revise
> our normalization prior to signing. Signing must require exact match so they catch any typo or
> capitalization error before signing the documents."*

**THE RULE, stated as four cases:**
| Input | Becomes | Why |
|---|---|---|
| `fiszer` | **`Fiszer`** | a leading lowercase letter is capitalised |
| `labuzetta` | **`Labuzetta`** | better than nothing; the person fixes the interior capital themselves |
| `LaBuzetta` | ⚠️ **`LaBuzetta`** | **an interior capital is NEVER touched** |
| `la buzetta` | **`La Buzetta`** | per WORD, not per field |

⚠️ **AND THE RULE THAT STOPS IT FIGHTING THE USER:** *"if the person corrects it to La buzetta that
is ok we shouldnt recorrect it."* **Normalise on ENTRY, never on every save.** A re-normalising field
overwrites a deliberate correction, and the person cannot win.

**THE TWO REQUIREMENTS THAT COME WITH IT — the owner attached them himself, and they are not
optional:**
1. ⚠️ **A BACK PATH FROM SIGNING TO THE NAME FIELD**, so the normalisation can be revised *before*
   anything is signed. **In-UI back button, and browser-back must not lose entered data either.**
2. ⚠️ **SIGNING STAYS AN EXACT MATCH** — *"so they catch any typo or capitalization error before
   signing."* **The exact gate is a FEATURE: it is the last moment a wrong name is visible.**

⚠️ **THIS SETTLES A JUDGEMENT CALL `TASK-FIX1` FLAGGED (§4.4).** FIX1 relaxed `Onboarding.tsx`'s
exact, case-sensitive gate to the server's case-insensitive rule, on the reasoning that the failure
mode was a *stale record* rather than a wrong one. **The owner's ruling reverses that for the CLIENT
gate: the browser gate goes back to exact.** The **server** rule stays case-insensitive — it exists to
stop a mismatched signature, and it must keep accepting the four legitimate variants already executed
(`"Brian olenik"`, three × `"Elisheva fiszer"`). **Two gates, two jobs: the browser catches the typo,
the server catches the wrong person.**

**FOUND (measured 2026-08-31, before any of this is built):**
- ⚠️ **NOTHING NORMALISES A NAME ANYWHERE.** `"Elisheva fiszer"` is stored exactly as typed.
- ⚠️ **THERE IS NO WAY BACK FROM THE SIGNING STEP.** `Onboarding.tsx` has eight steps
  (`order · details · horse · shop · sign · payment · slots · done`) and **two** `Back` controls in
  the entire file: one on the *done* screen pointing at the dashboard, and one inside the horse
  sub-flow. **From `sign` there is no route to the field holding the name.**
  ⚠️ **So normalising before signature WITHOUT requirement 1 would change a person's name and leave
  them no way to fix it. Requirement 1 is not polish — it is what makes the feature safe.**
- **Four executed signatures carry an uncapitalised surname today** — Brian Olenik ×1, Elisheva
  Fiszer ×3. **They are legitimate and must not be invalidated.**

**ASK-OWNER**
1. **Every name entry point, or only the public ones?** `/sign/*` and onboarding are where a stranger
   types their own name; staff-entered names on the contact record are a different case.
2. **A one-time pass over existing records**, or new entries only? *(Four signatures are affected;
   the contact count is unmeasured.)* ⚠️ **A signature's `typed_name` must NEVER be rewritten — it is
   sealed evidence** (`block_signed_signature_update`). **Any backfill is contacts-only.**

---

## CR-84 · G9 · captured — never lose what someone typed, and show them what we changed

**SAID (owner, 2026-08-31), five requirements in one message:**
> *"silent correction is not the way to do it if we can avoid it, we should show the normalization by
> normalizing after they click out of the input field for everything we normalize. names, phone
> numbers, and if we make the email addresses all lowercase we can show that too. for the old
> documents, leave documents alone, just correct the client records. we need to update the flows to
> give a back button to every page with lossless action and if possible make sure refresh, and
> browser back button is lossless and exit has resume function with lossless capability … any modal
> that opens doesnt close from clicking out once an input is entered into it. we need to make sure
> there is a save and a close button, if save isnt clicked the exit clears the inputs, a clear form
> button should also be there on all input forms/modals. when save is clicked opening that modal
> again resumes with the inputs."*

⚠️ **These are one change request because they are one principle: THE APP NEVER LOSES OR SILENTLY
ALTERS WHAT A PERSON TYPED.** Split across six threads they become six idioms.

### 1 · Normalisation happens ON BLUR, in front of them
**Not on submit, not on save — when they leave the field**, so the correction is visible and
revisable. **Applies to: names (CR-83's rules) · phone numbers · email lowercasing.**
⚠️ **"Silent correction is not the way to do it" is the whole requirement.** A value the app changed
without showing them is indistinguishable from a value they typed wrong.

### 2 · Documents are untouched; only the client record is corrected
> *"for the old documents, leave documents alone, just correct the client records."*
⚠️ **Settles CR-83's open ASK-OWNER #2.** Backfill is **contacts-only**. **A signature's `typed_name`
is sealed evidence** (`block_signed_signature_update`) **and is never rewritten** — the four
uncapitalised executed signatures stay exactly as they are.

### 3 · A back button on every page, and it loses nothing
⚠️ **MEASURED: `Onboarding.tsx` has EIGHT steps and TWO `Back` controls** — one on the *done* screen
pointing at the dashboard, one inside the horse sub-flow. **From `sign` there is no route back to the
field holding the name.** Also carries CR-53's *"a back button in the top left area of the page"* and
`TASK-AR5`'s finding of **20+ hand-rolled back affordances and no shared component.**

### 4 · Refresh and browser-back are lossless; exit resumes
**The three ways people actually leave a form**, and none may discard input.
⚠️ **Browser-back is the one that needs a real mechanism** — a step held only in React state is gone
on reload. **Recommend the storage seam rather than assuming one.**

### 5 · ⚠️ A MODAL WITH INPUT IN IT DOES NOT CLOSE ON A BACKDROP CLICK
**MEASURED 2026-08-31, and the number is the finding:**

| | |
|---|---|
| modals closing on backdrop-click or Escape | **33** |
| of those, carrying `<input>`, `<textarea>` or `<select>` | **18** |
| ⚠️ of those 18, using the shared `ops/kit/Modal` | ⚠️ **ZERO — all 18 are hand-rolled** |

⚠️ **The shared `Modal` already has `disableBackdropClose`, and not one input-bearing modal uses it.**
**So this is 18 separate implementations of one bug** — and it is CR-68a, which the owner reported on
2026-08-25 after losing horse-intake data, still live six days later.
⚠️ **The fix is CONVERGENCE ON THE SHARED COMPONENT, not 18 patches.** A 19th hand-rolled overlay
with a guard bolted on is the failure this repo keeps repeating.

### 6 · Save · Close · Clear, and save means resume
| Control | Behaviour |
|---|---|
| **Save** | commits; ⚠️ **reopening the modal RESUMES with those inputs** |
| **Close** | ⚠️ **discards — "if save isnt clicked the exit clears the inputs"** |
| **Clear form** | on **all** input forms and modals |

⚠️ **NOTE THE TENSION WITH CR-75, AND DO NOT RESOLVE IT BY GUESSING.** CR-75 rules that on an
**expanding card** *"closing is never a discard"* — the card header closes and **saves**. Here, on a
**modal**, close **discards** unless saved. **Both are the owner's rulings and they are about
different surfaces.** ⚠️ **A card saves on close. A modal discards on close.** Write it into whatever
component work implements this, or the next thread will "fix" one to match the other.

**FOUND (measured, 2026-08-31):**
- ⚠️ **No name, phone or email normalisation exists anywhere.**
- ⚠️ **No shared back-button component exists** — 20+ hand-rolled instances (`TASK-AR5`).
- ⚠️ **18 input-bearing modals, none using the shared kit component, all closing on backdrop click.**
- **CR-37 measured the same pattern from the other side:** 33 screens build their own overlay against
  7 using the shared one.

**ASK-OWNER**
1. ⚠️ **CR-83 #1 is still open and this message did not settle it:** does on-blur normalisation apply
   to **staff-entered** names on a contact record, or only where a person types their **own** name?
   *(Silent-vs-shown is answered; WHERE is not.)*
2. **Does "resume with the inputs" survive a page reload, or only within one session?** ⚠️ Reload
   survival means persisted per-user draft state — materially larger, and it overlaps #4.

### ⚠️ CR-84 — REVISED 2026-08-31, SAME DAY. THE OWNER IS PARTLY RIGHT AND THE SCOPE MOVED.

**SAID:**
> *"the modal already has an update pushed that fixed part of the problem which is great, less work
> for you, means we only need a clear form and close button, click outside of a modal with inputs
> doesnt close it, an information modal or empty one can close on click out. yes staff-entered inputs
> normalize too."*

**VERIFIED — one modal was fixed, and it is the one that lost his data.** `TASK-FIX2` rewrote
`ContactDossierModal`: every exit now runs through `requestClose`, which **commits first**, and if
the write fails **the record stays open with the edits still in the boxes.** Its own comment names
the incident. ⚠️ **The shared `ops/kit/Modal` is UNCHANGED** — still `Escape`-to-close and
backdrop-to-close, with a `disableBackdropClose` flag nothing uses.

**RE-MEASURED after that fix: 18 → 17.** ⚠️ **Seventeen input-bearing modals still close on a
backdrop click or Escape, and all seventeen are hand-rolled.** **"Less work" is one modal's worth.**

⚠️ **AND THE FIXED ONE IMPLEMENTS THE OPPOSITE RULE TO THE ONE HE JUST GAVE.** `ContactDossierModal`
**commits on close** — CR-75's card rule. This ruling says a modal with inputs **discards** unless
Save is clicked. **Both are his, and the dossier is the deliberate exception**, because CR-75 rules
the client record is an expanding card that happens to be rendered as a modal. ⚠️ **DO NOT
"harmonise" the dossier to the modal rule. It is not drift; it is CR-75.**

### THE THREE-WAY RULE — this is what a builder implements
| Surface | Backdrop click | Close |
|---|---|---|
| **Modal with any input** | ⚠️ **does NOT close** | **discards** unless Save was clicked |
| **Information / empty modal** | ✅ **closes** | — |
| **Expanding card (incl. the dossier)** | — | ⚠️ **SAVES** (CR-75) |

**Controls on every input form and modal: `Save` · `Close` · `Clear form`.** Save means **reopening
resumes with those inputs.**

### ✅ SETTLED — CR-83 ASK-OWNER #1
> *"yes staff-entered inputs normalize too."*
**On-blur normalisation applies everywhere a name, phone or email is typed — staff surfaces
included**, not only where a person types their own.

### ⚠️ REFRESH AND BROWSER-BACK ARE ONE REQUIREMENT, NOT TWO
> *"when i said refresh/back button i was using the word refresh to indicate a reload, i fail to see
> the distinction between them nor a difference."*

**He is right that there is no difference TO HIM, and that is the requirement: both must be
lossless.** ⚠️ **They are one requirement with one fix — the surviving state has to live somewhere
that outlives the page**, because a reload and a browser-back both destroy React state identically.
**They differ only in what a builder must implement to restore the position afterwards, which is an
implementation note and not a second requirement.** ⚠️ **CR-84 ASK-OWNER #2 is therefore ANSWERED:
resume must survive a reload.** That means persisted draft state, and it is the largest single piece
of this change request. **Size it honestly rather than treating it as a modal detail.**

### ⚠️ CR-84 — CORRECTED AGAIN, 2026-08-31. THE ORCHESTRATOR MIS-RECORDED THE DESIGN.

**SAID:**
> *"i said we use the fix as authored, no save button, only a close button and a clear form button
> are needed since it saves, we need to show auto-save so the user knows the inputs are saved, the
> close will be intentional now so its less of an issue … we should auto-save after input and when
> normalizing input we do it after the input is normalized … we only need to add the clear form
> button, the auto-save indicator, and make sure the modals have a close button. then … implement a
> global solution rather than updating each modal with the fix directly."*

⚠️ **THE PREVIOUS ENTRY IS WRONG AND IS SUPERSEDED. There is NO Save button and close does NOT
discard.** I recorded a Save/Close/discard model; the owner had said the opposite. **The dossier fix
is the pattern to generalise, not an exception to it.**

### THE ACTUAL DESIGN — auto-save, and the controls that remain

| | |
|---|---|
| **Saving** | ⚠️ **AUTOMATIC, after input** — and **after normalisation runs**, so what is stored is what the person sees (CR-83) |
| **Save button** | ⚠️ **NONE. Do not add one.** |
| **Close button** | **Required on every modal** — closing is now the deliberate act |
| **Clear form** | **Required on every input form and modal** |
| **Auto-save indicator** | ⚠️ **REQUIRED — *"so the user knows the inputs are saved"***. Without it, auto-save is indistinguishable from data loss |
| **Backdrop click, modal with inputs** | ⚠️ **BLOCKED.** *"the main issue is that closing the modal accidentally from clicking outside of it cleared the input"* |
| **Backdrop click, information / empty modal** | ✅ closes |

⚠️ **ORDER MATTERS AND IT IS EASY TO GET BACKWARDS: normalise on blur FIRST, then auto-save the
normalised value.** Saving raw then normalising leaves the stored value and the displayed value
disagreeing until the next read.

⚠️ **THE PREVIOUS ENTRY'S "CR-75 EXCEPTION" DISSOLVES.** A card and a modal now behave the same way —
**both save, neither discards.** There is no divergence to preserve and nothing to harmonise.

### ⚠️ AND THE DOSSIER FIX IS ONLY HALF OF IT — MEASURED
`ContactDossierModal` accumulates edits in `dirty` and **commits ONLY on close** (`commitRef` →
`requestClose`, `ContactDossierModal.tsx:211-249`). ⚠️ **It does not auto-save after input.** So a
browser crash, a closed tab or a reload still loses everything typed since the modal opened. **The
authored fix solved accidental-close; it did not solve auto-save.** ⚠️ **Do not read "we use the fix
as authored" as "the behaviour is complete" — the owner is adopting its CLOSE semantics, and
auto-save-after-input is the part still to build.**

### THE SCOPE, RESTATED
1. **A global solution** — ⚠️ *"implement a global solution rather than updating each modal with the
   fix directly."* **17 hand-rolled input modals converge on the shared `ops/kit/Modal`**, which
   already has `disableBackdropClose`.
   ⚠️ **CORRECTED 2026-08-31 BY THE `TASK-FIX4` THREAD, AND IT WAS RIGHT: "no adopters" WAS WRONG.**
   **SEVEN files already rendered the shared `Modal`** — four of them import it through the
   `lib/ops` **barrel** (`import { Modal } from '../../lib/ops'`), ⚠️ **which a grep for
   `ops/kit/Modal` does not find.** The thread's own first measurement made the same mistake and
   reported 4. **What was true is narrower: ZERO of the input-bearing, backdrop-closing dialogs used
   it.** *(Re-measured by ORCH6 on both branches at merge time: **26 hand-rolled input-bearing
   overlays → 1**, shared-`Modal` files **7 → 37**.)*
   ⚠️ **THE LESSON, AND IT IS GENERAL: a barrel re-export defeats a path grep.** Count by the
   rendered element (`<Modal`), not by the import path.
2. **Every form page AND modal gets:** clear-form · auto-save · the indicator · on-blur normalisation
   · reload/browser-back persistence.
3. ⚠️ **A back button on anything that is a FLOW** — *"onboarding, orders, etc"*. **Not every page: a
   flow.** `Onboarding.tsx` has eight steps and two Back controls, neither reachable from `sign`.

### ⚠️ CR-84 — CORRECTED A THIRD TIME, 2026-08-31. THE COMMIT TRIGGER IS THE ACTION, NEVER THE CLOSE.

**SAID:**
> *"commits on continue/send/commit/done...etc... not a close button click, no user would input data
> and click close and expect the form submitted."*

⚠️ **HE IS RIGHT, AND THE SHIPPED FIX HAS EXACTLY THE BEHAVIOUR HE IS CALLING WRONG.** Verified in
`ContactDossierModal.tsx:248`:
```
commitRef.current = async () => { if (await commit()) onClose(); };
const requestClose  = () => { void commitRef.current(); };
```
**Every exit — the X, Escape, the backdrop — runs `commit()` and then closes.** ⚠️ **So today, clicking
the close control on that record SUBMITS the form.** That is the *"no user would … click close and
expect the form submitted"* case, live in production.

### THE RULE, FINALLY STATED CORRECTLY
| Trigger | Commits? |
|---|---|
| **The affirmative action** — Continue · Send · Save · Done · Commit · Next | ✅ **YES. This is the ONLY commit trigger.** |
| **Auto-save after input** *(and after normalisation)* | ✅ yes — the draft persists so nothing is lost |
| ⚠️ **Close · X · Escape · backdrop** | ⚠️ **NO. NEVER. Closing is not consent.** |
| **Clear form** | discards the draft deliberately |

⚠️ **THE DISTINCTION THAT MAKES ALL THREE OF HIS RULINGS COHERENT — and it is the thing I kept
missing:**
**PERSISTING a draft and COMMITTING a record are different acts.**
- **Auto-save persists** what was typed, so an accidental close, a crash or a reload loses nothing.
  **It is not a submission.**
- **The affirmative action commits** — that is the moment the person says "this is my answer."
- **Closing does neither.** The draft survives *(auto-save already put it somewhere)*; the record is
  untouched.

**So the earlier entries were wrong in BOTH directions.** The Save/Close/discard model was wrong
because closing must not discard. *"Commits on close"* was wrong because closing must not submit.
⚠️ **The answer is neither: closing does nothing at all, which is exactly why it is safe.**

### ⚠️ CONSEQUENCE — THE DOSSIER FIX IS NOT THE PATTERN TO GENERALISE
The previous entry recorded it as the pattern. **It is not.** It solved accidental-close by making
close SUBMIT, which trades a data-loss bug for an unintended-write bug. ⚠️ **Do not roll
`requestClose` out to the other 17 modals.**

**What to keep from it:** the failure handling — *"IF THE SAVE FAILS THE RECORD STAYS OPEN with the
edits still in the boxes and the reason on screen."* **That instinct is right and belongs in the
shared component.**
**What to replace:** the commit-on-exit trigger, with auto-save-on-input plus an affirmative action.

⚠️ **AND IT NEEDS A DELIBERATE DECISION, NOT A SILENT REWRITE:** `ContactDossierModal` is a live
surface `TASK-FIX2` just rewrote and the orchestrator merged. **Changing its commit trigger is a
behaviour change on a shipped fix — flag it as such in whatever task implements this**, and state
what happens to a record edited between now and then.

---

## CR-85 · G9 · 🔒 RULED — the nav is three sections, and Community is member-facing by design

**SAID (owner, 2026-08-31):**
> *"Community has been the top section. but you are correct to think we should move it down since i
> live in the other layers more. But Community, People, Managment, Admin, is the correct order. The
> calendar needs its own direct link and it is in community, we could move people into community and
> then remove that as a standalone section, now we have community, management, admin."*

> *"catalog and messages belong in community. the only reason i have catalog view and why its in the
> community section is because that is what the community sees. conversely i have a separate surface
> for editing the catalog contents in the admin section."*

### ⚠️ THE ORCHESTRATOR ARGUED AGAINST THIS AND WAS WRONG

**I proposed retiring the hand-written Community block, on the reading that Catalog and Messages were
stray member-facing links with no lens in common.** ⚠️ **They are not stray — they ARE the lens.**
**Community means "what the community sees", and the block is exactly that.** The owner's own words
settle it: the **view** lives in Community, the **editor** lives in Admin.

**Verified 2026-08-31, and the split he describes is already built:**
| Surface | Where | What |
|---|---|---|
| **Catalog** *(view)* | the Community block | what a member sees |
| **Products** *(editor)* | `pageRegistry.ts:267`, Admin | ⚠️ **already a registry row — the editing half exists and is correctly placed** |

⚠️ **AND MY OTHER PREMISE WAS ALSO WRONG: Calendar already has its own direct link and is already in
Management** (`pageRegistry.ts:175`, moved by `TASK-FIX3`). **So "the calendar needs its own direct
link" is satisfied, and it is not a reason to restructure anything.**

### 🔒 THE RULING — THREE SECTIONS, IN THIS ORDER
```
1. Community    what the community sees — Catalog · Messages · (Calendar has its own link in Management)
2. Management   the daily working lens — Dashboard · Calendar · Support · Payments · Lessons · Evaluations
3. Admin        configuration and oversight — Moderation · Field options · Content store · Settings' five
```
**People dissolves into Community**, per his *"move people into community and then remove that as a
standalone section."* ⚠️ **People is only two rows — Contacts and Stable** — which is why it does not
earn a section of its own.

⚠️ **THE ORDER IS A REVERSAL OF TODAY'S AND IS DELIBERATE.** Community currently renders **first**
because the hand-written block sits above `navGroups` at both render sites. **He wants it first→…no:
he wants the order Community · Management · Admin, which happens to keep Community where it already
is.** ⚠️ **Confirm this against the live rail before building — the FIX3 report flagged the order as
`Community · Management · People · Admin`, so the only change is People dissolving.**

### ⚠️ THE OPEN QUESTION THIS DEPENDS ON, AND IT IS STILL HIS
**Messages is in the Community block, and the messaging A/B is UNANSWERED** —
`docs/method/04-OPEN-QUESTIONS.md` §1: do the notes panels become the inbox (A), or is the collective
messages page retired (B)? ⚠️ **If B, Community loses a row and the section is Catalog alone.**
**Settle the A/B before or with this build; do not let a nav change quietly decide a product question.**

**Where this is built:** ⚠️ **NOT in `TASK-FIX6`** — that owns the dashboard. **This is a nav change,
so it belongs with whatever next touches `AppLayout.tsx` and `pageRegistry.ts`.** ⚠️ **`TASK-FIX3`
has merged, so nothing owns those two files right now.**

---

## CR-86 · G5 · captured — the books: unbilled services, discounts, comps, costs, and a real P&L

**SAID (owner, 2026-08-31):**
> *"we have a lot of clients with lease agreements that we also are required to provide care services
> (the contract mentions it specifically, but the aggreements havent been executed yet and the
> services are still being provided and we have paying clients who we provide the training and care
> services for without a lease agreement being part of the relationship and they are not in the system
> and not being tracked nor their revenue being recorded. we also had discussed the implementation of a
> discount and promotional (full comp no cost to the customer) designation we can assign to purchasable
> offerings. its important for our records to show when we give away a service or provide a discount, a
> lot of people are getting discounts on the services we are providing them and these are technically a
> business loss, also cost tracking needs to be added so things like medication, feed, boarding,
> bedding, equipment, and other supplies can be logged and the money tracked against revenue so we can
> see the P&L for the business. This is the type of thing an ops dashboard should show, money in/money
> out, profit or loss, discounts given during a period, money paid for a sale and discount given,
> etc..."*

⚠️ **THIS IS A BUSINESS-RECORDS REQUIREMENT, NOT A DASHBOARD ONE.** The dashboard is the *last* step —
**none of these numbers can be shown because none of them is recorded.** `TASK-FIX6` must NOT try to
build this; it shows what exists.

### ⚠️ FOUR SEPARATE GAPS — do not treat as one
**1. SERVICES DELIVERED AND NOT RECORDED AT ALL.** Two populations:
- lease clients owed care services **by a contract that is not yet executed**, receiving them anyway;
- clients receiving training and care **with no lease in the relationship at all** — ⚠️ *"they are not
  in the system and not being tracked nor their revenue being recorded."*
⚠️ **This is unrecorded REVENUE, not just an unrecorded service.** It is the largest gap and it is
data, not code — **see the owner's own account pass** (`RUN-QUEUE.md`).

**2. DISCOUNT AND COMP AS A DESIGNATION ON AN OFFERING.** *"a discount and promotional (full comp no
cost to the customer) designation we can assign to purchasable offerings."* ⚠️ **And the reason is
accounting, not UX:** *"its important for our records to show when we give away a service or provide a
discount … these are technically a business loss."*

**3. COST TRACKING** — medication, feed, boarding, bedding, equipment, supplies.

**4. THE P&L** — money in, money out, profit or loss, discounts given in a period, and **what was paid
versus what was discounted on a single sale.**

### ⚠️ MEASURED 2026-08-31 — THE COST SPINE ALREADY EXISTS AND IS COMPLETELY EMPTY
| Table | Rows |
|---|---|
| `resources` · `resource_lots` · `consumption_events` · `cost_allocation_rules` · `billable_lines` | ⚠️ **0, every one** |

⚠️ **`resource_lots` ALREADY CARRIES `unit_cost`, `vendor_contact_id`, `qty_purchased` AND `on_hand`.**
**The purchasing-and-consumption model for gap 3 is BUILT AND UNDRIVEN.** ⚠️ **Do not design a second
one — establish why it was never driven, then drive it** (D18). **`A12 Barn operations` in the zone
sweeps owns exactly these tables; sequence against it.**

### ⚠️ AND THE MONEY SIDE HAS NOWHERE TO PUT A DISCOUNT
**`purchase_items` holds `price_amount · price_unit · quantity` — and NO discount, comp, list-price or
reason column.** ⚠️ **So a discounted sale is indistinguishable from a cheap one, and a comp is
indistinguishable from a sale that never happened.** **The loss the owner wants recorded has no field
to live in.**
⚠️ **`grant_lesson_credit` already has a `comp` mode** *(used 0 times)* — **a comp concept exists on
the CREDIT side and not on the ORDER side.** **Reconcile them; do not build a third.**

### ⚠️ THIS IS CR-39 AND CR-40, RE-STATED WITH THE REASON ATTACHED
**CR-39** *(comping records a LOSS, and the client must see they were given something free)* and
**CR-40** *(discounts)* are already in this ledger, **unbuilt**. ⚠️ **CR-39 carries an unanswered
question that is now urgent: have comps been recorded as "paid" to date? If so the revenue figures are
already wrong**, and every P&L built on them inherits it. ⚠️ **ANSWER THAT BEFORE BUILDING THE P&L.**

### DEPENDENCIES
- ⚠️ **CR-16/CR-38…CR-42 are the line-item editing model** — quantity, comp, discount, void, mark
  paid, cadence. **The owner already ruled these are ONE model, not six buttons.** **Discount and comp
  belong there, not bolted onto an offering.**
- ⚠️ **The offering-level "designation" he describes and the line-level discount are DIFFERENT FACTS.**
  *This offering is promotional* ≠ *this sale was discounted*. **Both are needed; conflating them
  loses the per-sale record he asked for.**
- **D21: an algorithm is configuration and ships with an editor.** ⚠️ **A discount RULE is a business
  formula — hardcoding one is a defect by default.**
- **D19: a value-moving action states itself, records itself, and can be undone.** A comp moves value.

### ASK-OWNER
1. ⚠️ **Have comps been marked "paid" to date?** *(CR-39's open question — decides whether existing
   revenue figures are trustworthy.)*
2. **Is a discount a percentage, a fixed amount, or both** — and is it set on the line or the order?
3. **Does the client SEE the discount** *("$880, less 10%")* or only the net? ⚠️ **CR-40 asks this and
   CR-39 answers it for comps — the owner said the client must see a comp. Confirm it is the same for
   discounts.**
4. **Cost tracking scope: purchase-and-consume** *(the existing `resource_lots` model)* **or simple
   expense logging?** ⚠️ **The built spine assumes the former; the owner's list — "medication, feed,
   bedding" — reads like the former too. Confirm before driving it.**

### ⚠️ CR-86 — WHERE EACH PART LIVES (owner, 2026-08-31)
> *"the books is on my side, the visible kpi is shown on the dashboard. the inputs happen on claires
> side and on my side."*

⚠️ **THE BOOKS ARE NOT ONE SURFACE. THREE CONCERNS, THREE HOMES, AND THEY MUST NOT BE COLLAPSED:**

| Concern | Where | Who |
|---|---|---|
| **THE BOOKS** — the ledger itself: reconciliation, the P&L, period reports | ⚠️ **the owner's side (Admin)** | him alone |
| **THE KPI** — money in / money out / profit / discounts given in a period | **the dashboard**, as a zone | ⚠️ **both boards, at their own DEPTH** — a headline on Ops, the full picture on Admin |
| **THE INPUTS** — cost and consumption logged as it happens; discounts and comps applied at the point of sale | ⚠️ **CLAIRE'S SIDE *AND* HIS** | whoever is doing the thing |

⚠️ **THE INPUT HALF IS THE ONE THAT WILL BE BUILT IN THE WRONG PLACE.** *"the inputs happen on claires
side and on my side."* **Claire opens a bag of feed, gives a bute, uses bedding — she is the person
who knows, and she is not going to visit an accounting page to say so.** ⚠️ **So logging consumption
belongs ON HER WORKING SURFACES — on the horse, on the care item, on the day — not on a books screen.**
**A cost model that requires a trip to Admin to record a bag of shavings will not be used, and an
unused ledger is worse than none because the P&L it feeds looks authoritative and is wrong.**

⚠️ **AND THE SAME APPLIES TO A DISCOUNT OR A COMP: they are applied WHEN THE SALE IS MADE**, by
whoever makes it, on the order line. **Not reconstructed later on a books screen.** ⚠️ **This is why
CR-16/CR-38…CR-42's line-item editing model is the home for discount and comp — the owner already
ruled those are ONE model.**

⚠️ **CONSEQUENCE FOR `TASK-FIX6`:** the **KPI zone** is in scope *(it is a dashboard zone, and Ops
shows the shallow form while Admin shows the deep one — the two-depth rule)*. ⚠️ **The BOOKS surface
and the INPUT surfaces are NOT — they are CR-86's own build.** **FIX6 renders numbers; it does not
create the means of recording them.**

⚠️ **AND UNTIL THE INPUTS EXIST, THE KPI HAS NOTHING TO SHOW.** **Do not ship a P&L tile reading
zero** — `04-OPEN-QUESTIONS.md` §3: *"a zero on an always-visible strip is indistinguishable from a
real zero."* **Name it as not-yet-computable and leave it out until CR-86 lands.**

### ⚠️ CR-86 — WHO INPUTS, AND THE HORSE-SPECIFIC / COMPANY-ATTRIBUTABLE SPLIT (owner, 2026-08-31)
> *"she has to be the one to input the stuff to track and the money can be updated by her or me once
> its in the system. particularly with respect to recurring monthly costs like feed, bedding,
> boarding, and then things like farrier for our horses count against the same things, horse specific,
> but company attributable."*

**TWO ROLES ON ONE RECORD, AND THEY ARE SEPARATE:**
| Act | Who | Why |
|---|---|---|
| **Logging that it happened** — the bag opened, the farrier came, the bedding used | ⚠️ **CLAIRE, and only she is positioned to** | she is the one present |
| **Attaching or correcting the MONEY** | **either of them, afterwards** | the invoice may arrive later than the event |

⚠️ **SO A COST RECORD MUST BE VALID BEFORE ITS PRICE IS KNOWN.** **Claire logs the event; the amount
lands later.** ⚠️ **A model that demands a price at logging time forces her to guess or skip — and a
skipped log is a permanently missing cost.** **Design for cost-arrives-later as the NORMAL case, not
an edge case.**

### ⚠️ HORSE-SPECIFIC BUT COMPANY-ATTRIBUTABLE — the distinction that decides the model
**A farrier visit for one of OUR horses attaches to that HORSE and is paid by the COMPANY.** The
identical event on a CLIENT's horse attaches to that horse and is paid by the CLIENT.
⚠️ **Same event, same shape, opposite side of the P&L — and the ONLY thing that differs is who owns
the horse.**

### ✅ MEASURED — THE EXISTING SPINE ALREADY EXPRESSES THIS. DO NOT DESIGN A NEW ONE.
| | |
|---|---|
| `consumption_events` | ⚠️ **already has `horse_id`, `administered_by`, `qty`, `occurred_at`, `notes`** — the event Claire logs, attributed to a horse and a person |
| `resource_lots` | **`unit_cost`, `vendor_contact_id`, `qty_purchased`, `on_hand`** — where the money lives, **separate from the event**, which is exactly the cost-arrives-later shape |
| `cost_allocation_rules` | ⚠️ **`scope` CHECK allows `horse` · `lease` · `board` · `default`, plus `payer_contact_id` and `share_pct`** — **this IS the company-vs-client split, and it even supports a SHARED cost** |

⚠️ **THE MODEL THE OWNER IS DESCRIBING WAS ALREADY BUILT AND HAS NEVER BEEN DRIVEN — 0 rows in all
five tables.** **The work is wiring and surfaces, not schema.** ⚠️ **Establish WHY it was never driven
before driving it; if it was abandoned for a reason, that reason still applies** (D18).

### ⚠️ THE ONE REAL GAP — RECURRING MONTHLY COSTS
**He names feed, bedding and boarding as *recurring monthly*.** ⚠️ **`resources` has
`resource_key · name · category · unit_of_measure · is_consumable` and NO recurrence, NO schedule and
NO standing amount.** **`resource_lots` models a PURCHASE — a lot bought on a date — which is the
right shape for a delivery of shavings and the WRONG shape for a monthly boarding charge that arrives
whether or not anything was delivered.**

⚠️ **So there are TWO cost shapes and only one is built:**
1. **CONSUMED** — bought as a lot, drawn down by events. ✅ **built** *(feed, bedding, medication)*
2. ⚠️ **STANDING** — a recurring monthly charge, not a lot and not consumed *(boarding, and arguably
   the farrier on a cycle)*. ❌ **no model**

**Do NOT force a standing charge into `resource_lots`** — a fake lot with a fake quantity corrupts
`on_hand` and every consumption figure drawn from it. ⚠️ **And do not build a second cost table
either: establish whether a standing charge is a `resources` row with a recurrence, or belongs beside
the existing spine.** **Recommend, with the trade-off stated.**

**ASK-OWNER:** ⚠️ **is boarding a cost we PAY (our horses stabled elsewhere), revenue we CHARGE, or
both?** *(`cost_allocation_rules.scope` already contains `board`, and `A12 Barn operations` owns
boarding agreements and charges.)* **The answer decides which side of the P&L it lands on, and the
word alone does not.**

### 🔒 CR-86 — HOW A COMP IS RECORDED (owner, 2026-08-31) ⚠️ AND THE TRAP IT WALKS INTO
> *"the comps are reported as paid, but the payment amount is $0 and the revenue records as -$ for the
> loss, im not sure the value yet so we can just record the loss as the price of the item comped."*

**THE RULE:** a comped order is **`payment_status = 'paid'`**, **`amount_paid = 0`**, and the business
records **a LOSS equal to the item's price**. ⚠️ **The client is not chased for money; the company
carries the cost — which is CR-39's *"a comp is not a payment"* made concrete.**
**Loss value = the price of the item comped** *(his interim rule; he may refine it once real cost data
exists — see the standing/consumed split above)*.

### ⚠️ AS WRITTEN, THIS WOULD BOOK A COMP AS FULL-PRICE REVENUE. VERIFIED IN THE LIVE FUNCTION.
`revenue_summary` line 22:
```
SELECT coalesce(sum(coalesce(nullif(p.amount_paid, 0), p.amount, 0)), 0), count(*)
 WHERE p.payment_status = 'paid'
```
⚠️ **`nullif(amount_paid, 0)` turns a ZERO into NULL, and the `coalesce` then falls through to
`p.amount` — THE FULL LIST PRICE.** **So an order marked paid at $0 is counted as revenue at its full
price: the exact inverse of the intent.** ⚠️ **Left alone, the first comp inflates revenue by its own
value AND records no loss — a double error in the same direction.**

**Why the fallback exists (do not simply delete it):** it is there for a paid order whose `amount_paid`
was never populated, so the list price is a better guess than zero. ⚠️ **The fix is to make a COMP
DISTINGUISHABLE from an unpopulated amount — which is precisely the missing designation in CR-86 §2.**
**A zero cannot carry that meaning on its own, and that is the whole lesson here.**

### ✅ MEASURED — NOTHING IS WRONG YET, AND THAT IS THE WINDOW
**All three paid orders in production are genuine, with `amount_paid` matching `amount`:**
`PUR-000316 $120` · `PUR-000319 $880` · `PUR-000320 $880`. ⚠️ **ZERO comps have been recorded, so no
revenue figure is currently corrupted.** ⚠️ **This answers CR-39's long-open question — *"have comps
been recorded as paid to date?"* — with **NO**. The books are clean TODAY.**

⚠️ **THEREFORE THE ORDER OF WORK IS FIXED: the comp DESIGNATION and the `revenue_summary` fix must
land BEFORE the first comp is entered.** **The owner is about to do a data pass. If a comp is recorded
first, the error is retroactive and every P&L built on it inherits it silently.** **This is the
cheapest it will ever be to fix.**

**ASK-OWNER:** ⚠️ **is the loss the LIST price or the price on the ORDER LINE?** *(They differ the
moment a discount and a comp appear on one order — "money paid for a sale and discount given", his
own words.)* **His interim answer is "the price of the item comped"; confirm which price that means.**

### 🔒 CR-86 — THE COST CADENCES, AND THE RULE BENEATH THEM (owner, 2026-08-31)
> *"boarding is a cost we pay and we attribute it to the company overall through a horse specifically
> since each horse has their own boarding/bedding/feed/supplements/medications/farrier costs that occur
> repeatedly throughout the year at their own intervals, boarding, bedding, feed can be seen as monthly
> costs, supplements and medications can too, farrier can be seen as annual since we never know how
> long we will go between farrier appointments and we dont know the costs for them, wherease we know
> the monthly payment for boarding and bedding and feed is pretty standard and the supplements and
> medications can fluctuate from month to month but they arent an annual thing even if we ordered a
> year supply we only record the cost when the thing is given which we can enumerate on a monthly
> basis."*

✅ **BOARDING IS A COST WE PAY** *(answers the open ASK-OWNER)*, **attributed to the COMPANY, THROUGH a
specific horse.** ⚠️ **Every cost in this list is per-horse and company-borne** — `cost_allocation_rules`
already expresses exactly that: `scope='horse'`, `scope_id=<horse>`, `payer_contact_id=<company>`.

### ⚠️ THE RULE IS NOT CADENCE. IT IS *WHEN THE COST BECOMES KNOWN.*
**Three ways that moment arrives — one recognition rule, not three cost models:**

| | Amount | Timing | Recognise when | Examples |
|---|---|---|---|---|
| **STANDING** | ⚠️ **known in advance** — *"pretty standard"* | known, monthly | **the period arrives** | boarding · bedding · feed |
| **ON USE** | ⚠️ **known only when given** | irregular | ⚠️ **the thing is ADMINISTERED** — *"we only record the cost when the thing is given"* | supplements · medications |
| **ON EVENT** | ⚠️ **unknown until invoiced** — *"we dont know the costs for them"* | ⚠️ **unknown** — *"we never know how long we will go between"* | **the invoice arrives** | farrier |

⚠️ **THIS SUPERSEDES THE EARLIER "two cost shapes" NOTE** *(consumed vs standing)*. **It is one rule
with three triggers, and the difference between ON USE and ON EVENT is NOT the interval — it is
whether the amount is knowable before it happens.**

⚠️ **"ANNUAL" IS A REPORTING BUCKET, NOT A CADENCE.** He calls farrier annual **because the interval is
unpredictable**, and *"even if we ordered a year supply we only record the cost when the thing is
given."* ⚠️ **DO NOT MODEL AN ANNUAL SCHEDULE. There is no annual event to schedule** — there is an
unpredictable event, reported yearly. **Modelling it as a recurring annual charge would invent a
cost that did not happen.**

### ⚠️ AND A PURCHASE IS NOT A COST — THIS IS THE SHARPEST POINT IN HIS MESSAGE
*"even if we ordered a year supply we only record the cost when the thing is given."*
⚠️ **Buying a year of supplements is NOT twelve months of cost on the day it is bought.** **The lot is
bought; the COST lands as it is administered.** ✅ **The existing spine already does this exactly:
`resource_lots` holds the purchase and `unit_cost`; `consumption_events` records each administration
against a `horse_id`.** ⚠️ **The cost is `qty × unit_cost` at the moment of the event — which is why
these two tables are separate, and why nothing should collapse them.**

### WHAT IS STILL MISSING — narrowed to ONE thing
✅ **ON USE is fully built** *(lots + consumption events)*. ✅ **ON EVENT fits it** — a farrier visit is
a lot with a known cost and a single consumption against one horse, **or a simple per-horse expense;
recommend which, with the trade-off.**
❌ ⚠️ **STANDING has no model.** `resources` carries no recurrence and no standing amount, and
`resource_lots` models a purchase — **wrong for a boarding charge that arrives whether or not anything
was delivered.** ⚠️ **Do NOT fake a lot for it: a phantom quantity corrupts `on_hand` and every
consumption figure computed from it.**

⚠️ **AND STANDING COSTS MUST BE PER-HORSE, NOT ONE COMPANY LINE** — *"each horse has their own"*.
**A single monthly boarding total cannot answer "what does this horse cost us", which is the question
he is asking.**

**ASK-OWNER:** **does a standing cost stop by itself?** ⚠️ **A horse that leaves must stop accruing
boarding, or the P&L drifts quietly every month.** **Ended-by-date, or ended by the horse's own status?**

### 🔒 CR-86 — SIMPLIFIED BY THE OWNER, 2026-08-31. ⚠️ THIS SUPERSEDES THE THREE-TRIGGER COST MODEL.
> *"we can gather what the horse costs us on a monthly and annual basis based on the costs attributed
> to it based on actual consumption… farrier can be fit into that mold too but its not a monthly
> recurring cost the way boarding is… the difference being supplements are daily and if given every
> day the monthly cost changes by month where boarding doesnt. but bedding does. so the simplest thing
> to do is give a space on the horse record for recording the costs at month end. having the right
> lines to input $ is better than trying to figure out how to automate it from a one time input."*

⚠️ **THE RULING: A MONTHLY COST SHEET ON THE HORSE RECORD, TYPED IN AT MONTH END.**
**NOT** a consumption engine. **NOT** a standing-charge scheduler. **NOT** three recognition triggers.
⚠️ **The last several entries above built toward automation; HE HAS RULED IT OUT and the reason is
sound — read it before proposing otherwise.**

### ⚠️ WHY HE IS RIGHT, STATED SO NOBODY RE-AUTOMATES IT LATER
**Every figure he listed is already known at month end by the person who was there.** ⚠️ **Automating
it would require Claire to log every administration all month to RECONSTRUCT a number she can simply
read off an invoice.** **That is more input, not less — and per the standing rule, an input burden she
will skip is a permanently missing cost.**
⚠️ **His own line is the design principle: *"having the right lines to input $ is better than trying
to figure out how to automate it from a one time input."*** **The value is in HAVING the number, not
in deriving it.**

### THE SHAPE
**One row per horse per month.** Lines, from his list: **boarding · bedding · feed · supplements ·
medications · vet · farrier**, plus **other** with a note.
- **Boarding** — flat month to month
- **Bedding, supplements, feed** — vary by month *(usage-driven)*
- **Vet, farrier, medications** — irregular; ⚠️ **entered in the month they are INVOICED**
- ⚠️ **A blank line is not zero.** *"Did it consume medication this month?"* — **"no" and "not yet
  entered" must be distinguishable, or the annual roll-up silently under-reports.**

**Annual = the sum of the months.** ⚠️ **No separate annual model** — which is why *"farrier can be fit
into that mold"*: an irregular cost lands in whichever month it is entered and the year adds up.

### WHAT THIS MEANS FOR THE EXISTING SPINE — ⚠️ DO NOT DRIVE IT
`resources` · `resource_lots` · `consumption_events` · `cost_allocation_rules` · `billable_lines` are
**built and empty (0 rows)**, and the earlier entries said to establish why and drive them.
⚠️ **THIS RULING REMOVES THAT.** **A per-event consumption ledger is exactly the automation he
declined.** **Leave the five tables untouched and undriven** (D32 — retire behind a flag, never
delete). ⚠️ **Say so explicitly in the build so a later thread does not "finish" them.**
⚠️ **`cost_allocation_rules` may still matter later for CLIENT-owned horses** *(who pays)* — **but not
for this, which is company-borne cost on our own horses.**

### ⚠️ WHAT THIS DOES NOT CHANGE
**The comp / discount work and the `revenue_summary` fix are UNAFFECTED and still carry the deadline.**
They are the REVENUE side; this is the COST side. ⚠️ **Both are needed for a P&L, and only the cost
side just got smaller.**

**ASK-OWNER**
1. **Who enters the sheet — Claire, him, or either?** *(Earlier ruling: she logs, either updates the
   money. A month-end sheet is money, which points at either.)*
2. ⚠️ **Does a horse that leaves mid-month still get a sheet?** **Prior open question, now simpler:
   no sheet entered = no cost, so the P&L cannot drift on its own.** **Confirm that is the intent.**

### ✅ CR-86 — THREE QUESTIONS CLOSED (owner, 2026-08-31)
> *"i dont have claires ops zone list until i see the full sales and marketing dashboards, i already
> answered comps list price is the the loss amount, and since we are not going to setup recurring
> monthly cost formulas for horse costs we stop the cost accumulation when we stop inputting the data
> into the record."*

**1 · THE COMP LOSS IS THE LIST PRICE.** ⚠️ **Asked twice; he had already answered and the
orchestrator asked again. It is the LIST price, not the order-line price.**
⚠️ **CONSEQUENCE FOR THE BUILD: the list price must be CAPTURED ON THE LINE AT THE TIME OF SALE.**
`purchase_items` holds `price_amount` — **the price charged** — and **no list price.** A comp at $0
leaves `price_amount = 0`, so **the loss would be unrecoverable after the fact** *(offering prices
change; reading today's catalogue to value a comp from six months ago is wrong)*. **Store the list
price on the line when the comp is applied.**

**2 · A STANDING COST STOPS BY ITSELF — because nothing accrues.** *"since we are not going to setup
recurring monthly cost formulas … we stop the cost accumulation when we stop inputting the data."*
⚠️ **This closes the "does a horse that leaves keep accruing boarding?" question, and the answer is
structural rather than a rule: THERE IS NO ACCRUAL.** **A month with no sheet entered has no cost.**
⚠️ **The P&L cannot drift on its own — which is a real advantage of the typed-sheet model over the
automation, and worth stating so nobody reintroduces a scheduler to "help".**
⚠️ **The corollary is the risk, and it is the OPPOSITE one: a month nobody enters is silently £0, not
"missing".** **§"a blank line is not zero" applies at the SHEET level too — the surface must show which
horses have no sheet for a closed month.** **Under-reporting is now the failure mode; design for it.**

**3 · CLAIRE'S OPS ZONE LIST CANNOT ARRIVE EARLY.** *"i dont have claires ops zone list until i see the
full sales and marketing dashboards."*
⚠️ **CONFIRMS `TASK-FIX6`'s BUILD ORDER AND ITS PAUSE ARE CORRECT AND NON-NEGOTIABLE.** The pause is
not a formality and **cannot be skipped by asking him earlier — he does not have the answer yet, and
will not until Sales and Marketing are in front of him.**
⚠️ **FIX6 STEPS 1, 2 AND 4 (framework · Sales + Marketing · Admin) ARE A COMPLETE SHIPPABLE
DELIVERABLE. Ops (step 5) and the role boards are a SEPARATE, LATER TASK.** **Do not hold the merge
waiting for the list.**

---

## 🔒 CR-87 · G6/G10 · RULED — messaging: threads stay on their surface, one page enumerates them

**SAID (owner, 2026-08-31):**
> *"we already litigated the messaging discussion and choice. we said keep the messaging on the
> surfaces, enumerate the threads in one view on the messages page, make the originating surface
> accessible via link from the message thread shown on messages page."*

⚠️ **THE ORCHESTRATOR KEPT PUTTING THIS AS AN A-OR-B AND IT IS NEITHER — IT IS BOTH, AND IT WAS
ALREADY DECIDED.** `04-OPEN-QUESTIONS.md` §1 framed it as *"(A) the notes panels BECOME the messages"*
**versus** *"(B) messaging lives only on the action surfaces and the collective page is retired."*
**He has ruled a synthesis, and the false dichotomy is why it kept resurfacing as unanswered.**
⚠️ **`04-OPEN-QUESTIONS.md` §1 IS SUPERSEDED. Do not re-ask this.**

### THE RULING — three parts, all required
1. ⚠️ **MESSAGING STAYS ON THE SURFACE IT BELONGS TO.** The chat threads on **lessons · horse-care
   activity records · contracts** remain where they are. **The conversation lives with its subject.**
2. ⚠️ **THE MESSAGES PAGE ENUMERATES THEM — it does not own them.** One view listing every thread
   across all surfaces. ⚠️ **It is an INDEX, not a second store.** **The page is NOT retired.**
3. ⚠️ **EACH THREAD IN THAT LIST LINKS BACK TO ITS ORIGINATING SURFACE.** From the Messages page you
   reach the lesson, the care record or the contract the conversation is about.

### WHY THIS IS THE RIGHT SHAPE — and it answers his own stated goal
**His goal was *"not needing to look at a specific place for a specific thing"* while also *"giving
everyone what they will actually use."*** ⚠️ **Part 1 keeps the conversation in context, where the
person doing the work already is. Part 2 means nothing is lost if you do not remember WHICH lesson or
horse it hung off. Part 3 gets you from the index back to the work.** **Neither surface is redundant —
they answer different questions.**

### ⚠️ WHAT THIS MEANS FOR THE BUILD
- ⚠️ **DO NOT MIGRATE MESSAGES INTO A CENTRAL TABLE.** The threads stay where they are; **the page
  READS across them.** **A second store would be the duplicate-implementation defect this repo keeps
  producing** (D18).
- ⚠️ **The measured state:** `direct_messages` · `channel_messages` · `threads` · `thread_posts` ·
  `contract_note_messages` are **all 0 rows** — ⚠️ **and that is NOT evidence of anything. Nobody is
  in the app yet** *(his own correction, 2026-08-26; `ORCHESTRATOR.md` §4: "empty is not a finding")*.
- ⚠️ **ESTABLISH WHICH TABLE EACH SURFACE ACTUALLY USES before designing the index** — five
  message-shaped tables exist and the notes panels may not all use the same one. **The enumeration is
  only as coherent as what it reads.**
- **Each listed thread needs its subject, its surface, its last activity and its unread state** — an
  index that cannot be triaged at a glance is a list, not an inbox.

### ✅ CONSEQUENCE FOR CR-85 — THE NAV IS UNBLOCKED
⚠️ **The Messages page SURVIVES, so Community keeps both rows: Catalog and Messages.**
**CR-85 was waiting on this and is no longer blocked.**

---

### ✅ CR-86 — ANSWERED AND CORRECTED 2026-08-31 BY ORCH6, FROM PRODUCTION. SPECCED AS `TASK-BOOKS1`.

**ASK-OWNER 1 is CLOSED, and it was the urgent one.** *"Have comps been marked 'paid' to date?"* —
⚠️ **NO. There are ZERO comps in the database.** Four paid orders exist *(`PUR-000316 $120` ·
`PUR-000319 $880` · `PUR-000320 $880` · `PUR-000333 $55`)* and **every one has `amount_paid = amount`**.
**Today's revenue figures are trustworthy.** ⚠️ **Do not re-ask this and do not re-derive it.**

⚠️ **CORRECTION TO THE STATED DEADLINE MECHANISM — read this before quoting the deadline again.**
`ORCH6-BRIEF.md` §3 says a comp recorded as the owner intends *(paid, `amount_paid = 0`)* already
books as full-price revenue through `revenue_summary`'s `coalesce(nullif(p.amount_paid, 0), p.amount, 0)`.
**Verified in the function bodies today: it does NOT — yet.** `grant_lesson_credit` writes a comp as
**`amount = 0, amount_paid = 0`**, so `nullif` has a zero `amount` to fall through to and the sum is
**0**. ⚠️ **The trap ARMS ITSELF the moment the line starts carrying the LIST price**, which is
exactly what the comp designation was asked for. **The deadline is real; the reason is that the fix
and the designation must ship in ONE branch, not that the books are wrong today.**

**Also measured:** `purchase_items` = **14 rows**, ⚠️ **0 carrying `config->>'grant_mode'` and 0
carrying `config->>'list_price'`** — so the incumbent comp model *(`grant_lesson_credit` +
`comped_credit_value`, which value the loss from `config.list_price`)* **has never been used, and
promoting those facts to real columns migrates no data.**

**🔒 Ruled by ORCH6 in the spec, with reasoning, so the build thread does not re-open them:** the two
money facts become **columns on `purchase_items`** *(`list_price_amount`, `price_disposition` CHECK
`full|discount|comp`, `price_reason`)*, not jsonb keys, **because a P&L is the "something else that
reads them" the original jsonb choice said did not exist** · **one copy only** — `config` stops
holding money · **the record is always two amounts plus a reason**, so *"percentage or fixed"* is an
ENTRY question, not a storage one · **the client sees a discount, as CR-39 already rules for a comp.**

⚠️ **AND THE COST HALF IS NOT IN `TASK-BOOKS1`.** Gap 3 is the owner's simplified **monthly cost sheet
on the horse record** and gets its own task; the five built-and-empty cost tables **stay undriven
(D32)**.

## CR-88 · G5/G9 · captured — marketing planning, the campaign builder, and financial analysis

**SAID (owner, 2026-08-31):**
> *"marketing planning doesnt exist yet we need build that just like we need to build the campaign
> builder and we need to build the financial analysis page with inputs into the fuller picture of
> company expenses."*

⚠️ **THREE SEPARATE BUILDS, ALL GREENFIELD — measured 2026-08-31, nothing pre-exists:**
**No `campaign*`, `market*`, `promo*`, `audience*` table.** *(`segment_categories` matches on name only
— it maps a catalog segment to a request category and an onboarding token. **Unrelated. Do not
repurpose it.**)* **On the money side only `revenue_summary` and the retired `calendar_revenue` exist.**

⚠️ **THESE ARE NOT `TASK-FIX6`'s WORK.** FIX6 builds the **Marketing BOARD** — it *shows* things.
**These build the things it shows.** ⚠️ **A board with nothing to display is why FIX6's spec says to
name a KPI as not-yet-computable rather than ship an empty tile.**

### 1 · MARKETING PLANNING
**His words:** the Marketing lens shows *"campaigns — running them, their results, and what is still in
planning."* ⚠️ **"In planning" is the part with no store: a campaign that has not started yet.**
**Establish the smallest honest shape** — a campaign with a state *(planned · running · finished)*, a
window, a channel and a note. ⚠️ **D13: he adds and edits one without a thread. D21: any spend or
performance FORMULA ships with its editor, never hardcoded.**

### 2 · THE CAMPAIGN BUILDER
⚠️ **A campaign must connect to the ATTRIBUTION ALREADY BUILT, or its results are unknowable.**
**`TASK-ORIGIN` shipped `contacts.client_origin` and `contacts.contact_channel`, with the vocabulary
in `lookup_options` and editable at `/app/ops/admin/editor`.** ⚠️ **THAT IS THE MEASUREMENT SIDE OF A
CAMPAIGN AND IT IS ALREADY LIVE — a campaign's result is contacts arriving with its origin.**
⚠️ **Both columns are UNPOPULATED until the owner's backfill, so campaign results read empty until
then. Say so; do not present zero as a result.**
⚠️ **Do NOT build a second attribution vocabulary.** **A new campaign should be able to ADD a
`client_origin` value through the existing editor rather than inventing its own list** (D18).

### 3 · THE FINANCIAL ANALYSIS PAGE
**His words:** *"with inputs into the fuller picture of company expenses."* ⚠️ **So it is not a report
— it is a page with INPUTS.** **It is where CR-86's money side is entered and read:**
- **revenue** — from orders *(exists)*
- **per-horse costs** — CR-86's monthly sheet on the horse record *(to build)*
- ⚠️ **COMPANY expenses that are NOT per-horse** — *"the fuller picture"*. **Nothing per-horse can hold
  insurance, fuel, signage, software or wages.** ⚠️ **THIS IS A GAP CR-86 DOES NOT COVER — CR-86 is
  horse-attributed cost only. Name it as its own line rather than stretching the horse sheet.**
- **discounts and comps given in a period** — CR-86's revenue side
⚠️ **AND IT INHERITS CR-86's DEADLINE: `revenue_summary` books a $0 comp as full-price revenue.**
**Fix that before any financial page reads it, or the page renders a confident wrong number.**

### ⚠️ SEQUENCE — this is the whole point of capturing all three together
**They are ordered by what feeds what, and building out of order produces empty surfaces:**
1. **CR-86's cost sheet + the comp/discount designation + the `revenue_summary` fix** — the inputs
2. **the financial analysis page** — reads them
3. **marketing planning + the campaign builder** — ⚠️ **and their results depend on the owner's
   attribution backfill, which is his data pass**
⚠️ **FIX6's Marketing and Sales boards can be built BEFORE any of this** — they surface what exists and
name what does not. **They are not blocked; these are.**

**ASK-OWNER**
1. **Does a campaign need a BUDGET / spend figure?** *(It is the difference between "did it work" and
   "was it worth it", and it decides whether campaigns touch the P&L.)*
2. **What company-level expense categories does he want?** ⚠️ **Do not invent a chart of accounts.**

---

## CR-89 · G5 · 🔒 RULED — a comp is a PAYMENT DISPOSITION on a normal order, not a special grant

⚠️ **AMENDED 2026-08-31 — `grant_lesson_credit` IS ELIMINATED, NOT NARROWED.**
> *"The grant lesson credit was supposed to be eliminated. i dont see a use case for it, we just
> process an order and use the comp to make the user cost $0 and it works for all purchases not just
> lessons."*

🔒 **THE WHOLE RPC GOES, INCLUDING `handwrite` AND `bill`** — the ordinary order path plus the payment
disposition covers every case, **for every kind of purchase, not just lessons.** ⚠️ **Retire behind
the repo's pattern; do not hard-delete** (D32). **0 rows have ever used any of its modes.**
⚠️ **BEFORE IT IS RETIRED, ITS REPLACEMENT MUST BE REACHABLE** — staff must be able to build an
ordinary order for a client and settle it. **See CR-94: Claire cannot mark an order paid from a
client record today.**

**SAID (owner, 2026-08-31), correcting ORCH6's reading of `TASK-BOOKS1`:**
> *"that is not the mechanism i asked for and i said we need to construct the order like any other,
> then we mark it paid by using an option that comps the purchase. This shows the customer the price
> in full, and it shows the amount owed is $0. The system needs to record the loss of the revenue as
> whatever standard accounting dictates, but ultimate anything of monetary value given for free is a
> write-down on our collected revenue in some way and the system needs to track these as well as
> discounts appropriately. so when we do our taxes our revenue and costs and losses and profits are
> all easily within reach and exportable."*

> *"Yes we have not comped anyone yet, but we have been giving a lot of discounts and need to track
> and account for those and the capability to discount to $0 is part of the same mechanisms."*

### 🔒 WHAT THIS RULES OUT, AND IT IS WHAT ORCH6 HAD SPECCED
⚠️ **`grant_lesson_credit`'s `comp` mode is NOT the model.** It builds a *special* order — `amount = 0`,
`payment_method = 'comp'` — so **the customer never sees a price and never sees that they were given
something worth $880.** The owner's mechanism is the opposite: **an ordinary order at the ordinary
price, and the COMP HAPPENS AT PAYMENT TIME.**

### 🔒 THE MECHANISM
1. **The order is constructed like any other** — real lines, real list prices, a real total.
2. **Marking it paid offers a disposition**: paid in full · **discounted** · **comped**.
3. ⚠️ **The customer sees the price IN FULL and sees the amount owed is $0.** *(A discount shows the
   full price, the reduction, and what is owed.)* **The comp is visible, not hidden behind a zero.**
4. ⚠️ **The write-down is recorded as its own quantity** — revenue collected, and value given away,
   are two separate figures on the same sale. **A discount to $0 IS a comp — one mechanism, one
   spectrum, not two features.**
5. ⚠️ **EXPORTABLE FOR TAX: revenue · costs · losses · profits, all reachable and exportable.**
   **Export is a requirement of this CR, not a later nicety.**

### CONSEQUENCES FOR THE BUILD
- ⚠️ **Discounts are the URGENT half, not comps.** *"we have been giving a lot of discounts"* — that
  is **historical data already given away and unrecorded**, and it is the owner's data pass.
- ⚠️ **`revenue_summary`'s `coalesce(nullif(amount_paid, 0), amount, 0)` NOW BITES FOR REAL.** Under
  this mechanism a comped order carries the **full list price in `amount`** and **0 in `amount_paid`**
  — exactly the shape that books a give-away as full-price revenue. **The deadline stands and the
  mechanism is no longer hypothetical.**
- **`grant_lesson_credit` keeps its `handwrite`/`bill` modes** *(they are order-creation shortcuts)*.
  ⚠️ **Its `comp` mode is superseded by this one and must not become a second way to comp** (D18).
  **0 rows have ever used it, so nothing is stranded.**
- **`mark_purchase_paid` is the incumbent seam** — the disposition belongs there, not in a new RPC.

---

## CR-90 · G3 · 🔒 RULED — a standing schedule is 30 days confirmed + 30 days pending, and the month is invoiced

**SAID (owner, 2026-08-31), on finding Madeline Do booked through 30 November:**
> *"Why did you set 90 days worth when the directive ive instructed is that the schedule should be set
> every 30 days with the next 30 days shown as pending until payment is confirmed. The payment
> invoices which need to go out today should be automatically generated and sent 3 days before the
> last day of the month stating that their payment for next month is due at the end of the month and
> then if unpaid on the last day of the month another notice goes out via email reminding them of the
> payment being due. Once they confirm their payment to us we confirm it was received and the pending
> bookings for the month flip to booked or confirmed or whatever term we use internally for that
> status."*

### ⚠️ MEASURED 2026-08-31 — THE SYSTEM DOES THE OPPOSITE, AND IT WAS NOT A HUMAN CHOICE
**`ensure_standing_slots` (TASK-BUYANDBOOK, `20260821T0120…`, line 502) hardcodes
`v_through date := coalesce(p_through, current_date + 90)`.** ⚠️ **Ninety days, in a default argument.**
Setting Madeline's two standing days therefore materialised **three months at once**:

| | |
|---|---|
| bookings | ⚠️ **39, ALL `scheduled`** — Jul 3 · Aug 10 · **Sep 8 · Oct 9 · Nov 9** — **not one is `pending`** |
| credits minted **on 2026-08-31** | ⚠️ **Sep 8 · Oct 9 · Nov 9** — three unpaid months entitled in one act |
| paid | **one order, `PUR-000319`, $880** |

⚠️ **SO THREE UNPAID MONTHS ARE CONFIRMED ON THE CALENDAR AND ENTITLED IN THE CREDIT LEDGER.**
**This is the defect, not the horizon length by itself.**

### 🔒 THE RULE
- **Confirmed month + ONE pending month.** Never three. ⚠️ **A pending month must be visibly
  `pending`** — on the calendar, to the client, and in the credit ledger.
- **Payment confirmed → that month's pending bookings flip to confirmed**, and only then.
- **Invoice: generated and sent 3 days before the last day of the month**, stating next month's
  payment is due at month end.
- **Unpaid on the last day of the month → a second email reminder.**
- ⚠️ **Nothing accrues past the pending month** until money is confirmed.

### ⚠️ WHAT DOES NOT EXIST YET
**No invoice is generated anywhere.**

⚠️ **CORRECTED 2026-09-01 BY ORCH6 — A SCHEDULER EXISTS AND IT RUNS. THE "NOTHING HAS EVER FIRED"
FRAMING IS OUT OF DATE.** **`.github/workflows/scheduled-jobs.yml` calls the five endpoints hourly
from GitHub Actions**, written after the owner said *"there are no crons setup on vercel and i dont
know how to do that."* ⚠️ **Vercel's `crons` block never ran — Hobby allows 2 daily jobs and it asks
for 5 hourly — but GitHub Actions does, `CRON_SECRET` is set on both sides, and runs are succeeding.**
**Verified from the run history: 2026-09-01 05:49 success, 2026-08-31 21:08 success.**

⚠️ **AND A LIVE DEFECT FOUND IN THE SAME LOOK: `/api/expire-holds` returns 500 `{"error":"reaper
failed"}` on every run**, which is the only reason those runs show as failed —
`calendar-reminders` and `delivery-sweep` return 200 in the same run. **So holds never expire. It has
its own fix, and it is small.**

🔒 **CONSEQUENCE FOR THIS CR: the month-end cadence has somewhere to run. Build the invoice and the
reminder as endpoints on this workflow; do not design around the absence of a scheduler.** ⚠️ **Today, 2026-08-31, is the last day of the month: both the 3-day-prior
invoice and the month-end reminder are already due and neither can have been sent.**

---

## CR-91 · G5/G9 · 🔒 RULED — categories are typed once and remembered, and they exist to be charted

⚠️ **AMENDED 2026-08-31 — EVERY GENERATED MENU MUST APPEAR IN THE ADMIN MENU EDITOR.**
> *"we have a menu editor surface in the admin section of the app and we need to make sure any new
> categories that generate menus for selection from in the future are populated in this surface for
> editing the menu options."*

🔒 **A NEW VOCABULARY THAT DOES NOT SHOW UP IN THE EDITOR IS NOT DONE** (D13, D21). ⚠️ **The editor is
`/app/ops/admin/editor` over `lookup_options`, and its Add is ALLOWLISTED — a new key is only
half-editable until the three allowlists are widened.** **Widening them is part of shipping the
category, not a follow-up.**

**SAID (owner, 2026-08-31), answering the CR-88 budget question:**
> *"no it doesnt need a budget for a campaign, as a hard requirement, but there should be a place to
> record expenses and see the total spend and then record revenue attributable to the campaign and
> calculate the roi."*

> *"dont put labels on anything, ill type in the labels when enter the expenses and the system should
> remember them and provide a menu for me to pick from based on where the expense is being recorded
> (ie: horse related expense categories menu is the entries ive typed into the cateory field wtih the
> input values. marketing expense categories menu is the entries ive type into the catedory field with
> those input values. … i can see the marketing spend by category or the horse spend by category, and
> then when i look at a companywide report i can see the horse spend total as a categoy or the finer
> breakdown of the horse categories in place of the single horse spend value, pie charts are cool for
> this, so are other chart types … so if we implement category capture we need to make use of it with
> ui visuals and reports with graphical visuals."*

### 🔒 THE RULING
- ⚠️ **NO SEEDED CHART OF ACCOUNTS. Do not invent category labels.** He types them.
- **The system remembers what he typed and offers it back as a menu — SCOPED TO WHERE THE EXPENSE IS
  BEING RECORDED.** Horse expenses offer the horse vocabulary; marketing expenses offer the marketing
  vocabulary. ⚠️ **The scope is part of the key, not a filter applied afterwards.**
- ⚠️ **`lookup_options` IS THE INCUMBENT VOCABULARY STORE** *(TASK-ORIGIN, editable at
  `/app/ops/admin/editor`)*. **Use it. Do NOT build a second vocabulary table** (D18) — but note
  `lookup_options`' **Add is allowlisted**, so a new key is only half-editable until three allowlists
  are widened.
- ⚠️ **CATEGORY CAPTURE WITHOUT REPORTING IS NOT WORTH BUILDING — his words.** Category totals per
  department, a company-wide roll-up where **a total can be expanded into its finer breakdown in
  place**, and **real charts** (pie among others), on the Ops and Admin dashboard views.
- **A campaign gets expenses, total spend, attributable revenue and an ROI.** ⚠️ **Attribution comes
  from `contacts.client_origin` / `contact_channel` — do NOT build a second attribution vocabulary,
  and results read EMPTY until his backfill.**

---

## CR-92 · G9 · captured — the repo, the role docs, and a thread that owns hygiene

**SAID (owner, 2026-08-31):**
> *"the entire calude code repo folder needs to be cleaned up, as does the repo itself, there are
> documents everywhere, the ORCH and TASK thread instructions for 6 steps, handoff, and operating
> requirements need a home and need to be kept to strict adherence to these approaches. I should be
> able to close any thread and open a new one and tell it which ORCH or with TASK thread it is and it
> an pick up where the last thread stopped without context loss, memory loss, or any degradation or
> risk of duplication/repetition. strict logs and data records inside the repo is required and the
> hygiene needs to be well defined and a SWEEP or BROOM or CLEANUP thread role is needed with this as
> its sole responsibility. and each thread needs to ensure other threads are honoring the instructions
> and requirements docs for their thread role type. this means an ORCH that takes over for another
> ORCH evaluates the handoff file and state of the repo against what it should be based on ORCH
> instructions and requirements and task and hygiene thread instructions and requirements."*

### THE FOUR REQUIREMENTS, SEPARATED
1. **A HOME for the role documents** — the six-step method, the ORCH role, the TASK requirements, the
   handoff format, the hygiene rules. ⚠️ **One home, not "documents everywhere."**
2. **RESUMABILITY AS A TEST:** *"tell it which ORCH or which TASK thread it is and it picks up where
   the last one stopped"* — **no context loss, no memory loss, no duplication.** ⚠️ **This is a
   stricter test than today's handoff passes: today a new thread must be TOLD which file to read.**
3. **STRICT LOGS AND DATA RECORDS IN THE REPO**, with hygiene defined rather than assumed.
4. ⚠️ **A DEDICATED SWEEP / BROOM / CLEANUP ROLE** whose SOLE responsibility this is —
   **and mutual enforcement: every thread checks that the others honoured their role's own
   instructions.** **An incoming ORCH audits the outgoing ORCH's handoff and the repo state against
   what the role documents require.**

⚠️ **`TASK-FIX5` (repo hygiene) IS NOT THIS.** FIX5 is the mechanical `git mv` pass against
`docs/reference/DOCS-LAYOUT.md`. **This CR is the ROLE and the STANDARD that FIX5's layout then has to
serve.** **Sequence: FIX5 moves the files; the BROOM role owns keeping them that way.**

---

## CR-93 · G9 · 🔒 RULED — the close rule, refined, and the save state sits next to the close icon

⚠️ **AMENDED AGAIN 2026-09-01, AFTER `TASK-MODAL2` SHIPPED. THIS IS THE OPERATIVE RULE.**
> *"the request was for modals that the user can reopen it can close on clickout for any that the user
> cannot reopen it or that has input content it doesnt close on clickout."*

🔒 **THREE CASES, AND THE FIRST TWO ARE UNCHANGED FROM WHAT IS LIVE:**
| The dialog | Click-out |
|---|---|
| **holds input the user entered or selected** | ⚠️ **never closes** — regardless of anything else |
| **no input, and the user CANNOT reopen it** *(a first-login overview, a system notice, a one-time alert)* | ⚠️ **never closes** |
| **no input, and the user CAN reopen it** *(the scheduling and shopping modals, a document preview reachable from a list)* | ✅ **closes** |

⚠️ **WHAT IS LIVE TODAY IS STRICTER THAN THIS.** `TASK-MODAL2` *(merged `4c06685d`)* removed the
backdrop handler entirely, so **NOTHING closes on click-out**, including a reopenable information
dialog. **That was built correctly against the instruction as it then stood** — *"just make all modals
only close on click of button or link … since you cant determine which ones the user can reopen"* —
**and the owner has now made the determination, so the third row must come back.**

⚠️ **THE DESIGN QUESTION THIS HANDS `DSGN`, AND IT IS THE ONE THAT KILLED THE FIRST ATTEMPT:
HOW DOES THE COMPONENT KNOW IT IS REOPENABLE?** **It cannot infer it.** ⚠️ **`TASK-MODAL2` deleted the
`trigger: 'user' | 'system'` concept when the blanket rule replaced it — reopenability is the same
question in better clothes, and it needs an explicit input plus an INVENTORY of every dialog that
opens without a click.** **A default nobody applies is the same as no feature.**

⚠️ **NOT ASKED, NOT ASSUMED: `Escape`.** **The owner's words name CLICK-OUT only. Escape is currently
removed on every dialog. Do not restore it as a side effect — put it to him.**


⚠️ **AMENDED 2026-08-31, LATER THE SAME DAY — THE RULE IS NOW SIMPLER AND HARDER. THIS SUPERSEDES THE
USER-TRIGGERED / SYSTEM-TRIGGERED SPLIT BELOW.**
> *"here is an example of a system modal, the overview modal on first login that tells the user about
> the app. here is an example of a user opened modal, the scheduling and shopping modals. just make
> all modals only close on click of button or link, dont let them close on click-out since you cant
> determine which ones the user can reopen and which ones they cant."*

🔒 **EVERY modal closes ONLY by clicking a control — a button or a link. NO modal closes on click-out.
No Escape. No trigger-source distinction to implement, because the distinction turned out to be
undecidable from inside the component, which is the owner's own reasoning.**

🔒 **AND THE SIDE DRAWER IS ELIMINATED — *"center modal is the only version to use."*** ⚠️ **`TASK-FIX4`
shipped THREE variants; two of them are now retired.** **Measured: `variant="drawer"` at 4 call sites
(3 in `CalendarPage`, plus `TeamPage`, `CalendarSettingsPanel`, `CalendarItemPanel`) and
`variant="sheet"` at 8.** **All become centre modals.**

🔒 **THE BACK CONTROL IS NOT AN ONBOARDING FEATURE** — *"the back control should apply to saving state
on all things any user inputs, not just the onboarding flow steps."* ⚠️ **`TASK-FIX4` built the
component and explicitly did NOT sweep the ~18 remaining hand-rolled affordances. That sweep is now
required.**

🔒 **RESTATED, AND IT IS THE WHOLE ENTRY MODEL:** *"the auto save and normalize functions are supposed
to run when the user clicks out of the field they entered the input into. a save or submit or confirm
button is the only way something is entered as an entry, closing doesnt submit."*

**SAID (owner, 2026-08-31), on `TASK-FIX4`'s shipped behaviour:**
> *"The request is that a modal cannot be accidentally closed by clicking ouside of it when there is
> content inside of it that the user input or selected. the close button/icon is the only way to close
> it once they engage with it. information only modals should close if they are user triggered but if
> they are not user triggered and they are system triggered they should be harder to close to prevent
> accidental closure since the user cannot simply reopen it if they accidentally close it. auto save
> is good, auto save along with each input field being clicked out of is the spec, for normalizing
> fields we auto save after the normalization and the normalization runs after the user clicks out of
> the input field. save state is always shown up next to the close button/icon as a green checkmark
> with the word saved in green (light green) persistent until inputs that arent saved are entered.
> shown when the state is true."*

### ⚠️ WHAT FIX4 SHIPPED vs WHAT IS ASKED — measured on `main` 2026-08-31
| | Shipped | Asked |
|---|---|---|
| **backdrop click** | ✅ blocked whenever the panel holds a field *(live-DOM check)* | ✅ satisfied — **and stricter**, since it protects a field before anything is typed |
| ⚠️ **Escape** | ⚠️ **still closes** (`Modal.tsx:152`) | ⚠️ **MUST NOT** — *"the close button/icon is the only way to close it once they engage with it"* |
| **info modal, user-triggered** | closes on outside click *(no fields present)* | ✅ satisfied |
| ⚠️ **info modal, SYSTEM-triggered** | ⚠️ **no such concept exists** — the component cannot tell who opened it | ⚠️ **must be HARDER to close**, because the user cannot reopen it |
| **normalise on blur, then save** | ✅ built, that order | ✅ |
| ⚠️ **the save indicator's PLACE** | ⚠️ **in the FOOTER bar** (`Modal.tsx:270`) | ⚠️ **next to the close button/icon** — i.e. the header |
| **persistence** | stays `saved` until the next edit | ✅ |
| **wording / colour** | `Check` + `Saved` in `text-green-700`; the dossier says *"Saved to the record"* | **green checkmark + the word "Saved", LIGHT green** |

⚠️ **AND THE PROCESS NOTE, WHICH IS THE MORE IMPORTANT HALF:**
> *"you dont tell me what you are keeping when it might contradict a request — you explain to me
> exactly what the current state is and how it differs from my request."*

**ORCH6 reported "Escape still closes — keeping it" as a settled decision. It was a DEVIATION from
his instruction and should have been presented as a delta, with the current state and the difference
named.** ⚠️ **A ruling of the owner's is not an input to the orchestrator's judgement.**


---

## CR-94 · G3/G5 · 🔒 RULED — the calendar, orders, payments, discounts, revenue and scheduling are ONE pass, run as targeted fixes

**SAID (owner, 2026-08-31):**
> *"there is no way for claire to mark orders paid, this might be a latent bug related to the
> transition from old records page and new records page? bundle the research and remediation in with
> the calendar overhaul since an order, a payment, and a scheduled offering are all linked."*

> *"its all part of the same pass over calendar, orders, payments, discounts, revenue, losses,
> scheduling, etc... these updates need to ship asap and as a unit either consecutively or in one
> update pass, targeted fixes are faster to run and more likely to thorough and accurate and easier to
> validate. the only issue is i dont want to waste tokens and time on the threads reporting all the
> tangential issues we already know about. we should always review the current state first, then
> author the targeted fix and we should do this for the full set of issues and changes in one series
> of passes targeting each issue individually and remediating them the same way."*

> *"all of our clients are largely not in the system fully, their orders, payments, revenue, and
> scheduled bookings need to be backfilled and we need the surfaces to function properly to be able to
> do this."*

### 🔒 THE METHOD, AND IT IS A STANDING RULE FOR THIS UNIT
1. ⚠️ **REVIEW THE CURRENT STATE FIRST, THEN AUTHOR THE TARGETED FIX.** Per issue. Not a survey.
2. ⚠️ **ONE ISSUE PER PASS, remediated the same way it was researched.**
3. ⚠️ **DO NOT REPORT TANGENTIAL KNOWN ISSUES.** *"i dont want to waste tokens and time on the threads
   reporting all the tangential issues we already know about."* **A finding outside the pass's own
   issue goes in ONE line under "flagged, not fixed" — no analysis, no reproduction, no measurement.**
4. **The unit ships consecutively or together; it does not trickle.**

### ⚠️ MEASURED 2026-08-31 — THE MARK-PAID GAP IS REAL AND IT IS A REACH DEFECT, NOT A PERMISSION ONE
| | |
|---|---|
| `mark_purchase_paid` | ✅ **allows staff** — `has_staff_access()`, widened by BOOKLINK |
| `/app/ops/payments/review` | ✅ **`requireStaff`**, and it has a nav row in BOTH `pageRegistry.ts:177` and `AppLayout.tsx:528` |
| ⚠️ **`markOrderPaid` call sites** | ⚠️ **ONE — `PaymentReviewPage`, and nowhere else** |
| ⚠️ **the client record's Orders tab** | ⚠️ **shows status and "Manage payment"; it CANNOT settle an order** |

⚠️ **So the capability exists and the surface a person actually works from does not offer it.** **This
is §3b of `ORCHESTRATOR.md` — correct code nothing reaches — and it blocks the backfill, because the
backfill is done FROM the client record.**

### THE PASSES — each its own targeted task, in this order
1. **The money spine** — the payment disposition, list price on the line, the write-down, the
   `revenue_summary` fix, and the export. *(`TASK-BOOKS1`, specced.)*
2. **Settling an order from where the work happens** — `markOrderPaid` reachable from the client
   record's Orders tab; ⚠️ **and `grant_lesson_credit` retired only once this is true** (CR-89).
3. **The rolling schedule** — 30 days confirmed + 30 pending, the `current_date + 90` default
   replaced, `pending` visible on the calendar, in the ledger and to the client. *(`CR-90`.)*
4. **The month-end cycle** — invoice 3 days before the last day, reminder on the last day, payment
   confirmation flips the pending month. ⚠️ **Establish first whether ANY scheduled job runs in
   production.** *(`CR-90`.)*
5. **The backfill surfaces** — what has to work for the owner to load historical orders, payments,
   revenue and bookings **with their real dates**. ⚠️ **This is the pass that decides whether the data
   pass is possible at all.**
6. **The calendar items from `CR-TRIAGE`** — CR-02 (the 12AM/12PM slip), CR-07 (the picker), CR-04,
   and the rest of the DO list, ⚠️ **which the owner has since widened beyond the original 14.**

---

## CR-95 · G9 · 🔒 RULED — `CLNR`, the hygiene role, and the orchestrator triggers it

**SAID (owner, 2026-08-31):**
> *"Did you author the Hygiene role the way ORCH and TASK are authored roles with spec and instruction
> files? its an action that needs to run periodically by you, not me, you insert it into a task thread
> or suggest i run it as its own thread, i dont monitor the repo state and tell you to give me a
> CLEANUP thread to run, and lets name it CLNR keeping the 4 letter naming convention going."*

🔒 **`CLNR` is a ROLE, authored like `ORCH` and `TASK`, with its own instruction file.**
🔒 ⚠️ **THE ORCHESTRATOR DECIDES WHEN IT RUNS. The owner never has to notice repo drift and ask for
it.** **ORCH either folds the sweep into a task thread or hands the owner a `CLNR` prompt unprompted.**
🔒 **Four-letter thread naming stands: `ORCH` · `TASK` · `CLNR`.**
**Its role file is `docs/method/CLNR-ROLE.md`.**

---

## CR-96 · G9 · 🔒 RULED — DISO, and the orchestrator stops doing the talking

**SAID (owner, 2026-08-31):**
> *"one thing we need to do is use disposable threads for these long discussions and decision setting
> and request making. then that goes to you as a report and then you author the files for another task
> thread to handle the fix."*

> *"i see the 6 steps as TASK thread activities, your role is to orchestrate, that means you are doing
> too much in this thread by discussing things with me, then collecting the information and
> synthesizing it into files for TASK threads, then spawning the TASK threads, then reviewing their
> output claims for validation. I developed but not yet introduced the concept of a DISO thread that
> handles the initial steps in the 6 step sequence, the active Q&A, discovery, and handoff to you for
> authoring TASKS."*

> *"then the TASK thread hands the report back to you for validation of the claims then you can author
> an entry into a ledger or a dedicated file for the TASK for other threads like DISCO, TASK, and ORCH
> to read in the future, then you can write the files for the next TASK thread i need to spawn."*

### 🔒 THE FOUR ROLES
| Role | Owns | Six-step |
|---|---|---|
| **`DISCO`** | ⚠️ **the conversation with the owner** — capture · research · discussion & lock. **Disposable by design, because the conversation is what burns a context window** | **1 · 2 · 3** |
| **`ORCH`** | distillation · sequencing · validation · **the record** | **4 · 5 · 6 (review)** |
| **`TASK`** | building one spec in one worktree | the deliverables |
| **`CLNR`** | the workspace | — |

**Role files: `docs/method/{ORCH,DISO,TASK,CLNR}-ROLE.md`.** *(`ORCH-ROLE.md` is `docs/ORCHESTRATOR.md`
until `TASK-FIX5` renames it.)*

### 🔒 THE RECORD ORCH WRITES AFTER EVERY MERGE — this is the "dedicated file" he asked for
1. ⚠️ **A `## VALIDATION — ORCH<n>` block appended to `docs/reports/TASK-<ID>-REPORT.md`** — what ORCH
   checked **itself**, the query behind it, what held, what did not, the merge commit.
   ⚠️ **An audit living only in a merge commit message or a chat reply is not the record.**
2. **One line in `docs/reference/TASK-LEDGER.md`** — the scannable index.
3. **A D-rule in `CLAUDE.md`** when something was *settled*, not merely built.

### ⚠️ NAMING
**The owner wrote both `DISCO` and `DISCO`.** **`DISCO` is used, to hold the four-letter convention
(`ORCH` · `DISCO` · `TASK` · `CLNR`).** **A rename is one word from him.**

### ⚠️ WHAT THIS SESSION PROVES — ORCH6 ran as its own DISO and it cost the window
**This thread captured requests, researched production, discussed and locked decisions, THEN authored
specs and validated a merge. That is three roles.** ⚠️ **It is why the session is long, and it is the
exact failure the owner is naming.** **From CR-96 forward, a discussion of this length opens a `DISCO`
thread.**

### ⚠️ THE GAP THIS RULING EXPOSES — STEPS 4 AND 5, AND IT IS UNANSWERED
**The six-step method splits ARCHITECTURE & DESIGN from BUILD and runs design FIRST as its own thread**
*("Build never receives an unreviewed design")*. ⚠️ **THAT HAS NEVER HAPPENED HERE — every `TASK`
thread has been a build thread, with ORCH's spec standing in for the design deliverable.**
**Either a `DSGN` role exists, or step 4 is formally ORCH's spec and the method says so.**
**ASK-OWNER — this is the one question this ruling leaves open.**

---

## CR-97 · G3 · captured — the booking lifecycle is six states, and today it is effectively two

**SAID (owner, 2026-09-01):**
> *"I noticed the booking system is failing in a weird way, the stages/status dont function, a block is
> either booked or open. it should have at least, requested, approved, pending, scheduled, moved,
> cancelled.*
>
> *Requested is the status when an order is created with a booking time and date selected, or when a
> user moves an item to a new date and time or when a user with credits selects a date and time.
> Approved is the status when company staff mark the requested booking as approved (this triggers the
> payment request for unpaid orders), its skipped if its a new order that is paid, or the user has
> credits, or its a rescheduled paid order. pending is the status when an unpaid order is marked paid
> by the user declaring a payment method from the payment screen or modal, like approved its skipped if
> the order is paid already. scheduled is the status of a paid order thats been approved for the date
> and time shown. moved is the status of a rescheduled booking (shown only to company and user who it
> belongs to), for anyone else it shows as empty and available. cancelled is the status for an order
> that was cancelled by staff or client, it shows as cancelled to both parties and open and available
> to everyone else."*

### THE MACHINE, AS HE SPECIFIED IT
| State | Entered when | Skipped when |
|---|---|---|
| **requested** | an order is created with a date/time chosen · a user MOVES an item to a new date/time · a credit-holder picks a date/time | — |
| **approved** | staff mark a requested booking approved. ⚠️ **This TRIGGERS the payment request on an unpaid order** | ⚠️ the order is already paid · the user has credits · it is a rescheduled paid order |
| **pending** | the client declares a payment method from the payment screen/modal on an unpaid order | ⚠️ the order is already paid |
| **scheduled** | a PAID order, approved, at the date and time shown | — |
| **moved** | a booking was rescheduled | — |
| **cancelled** | staff or client cancelled | — |

### ⚠️ VISIBILITY IS PART OF THE STATE, NOT A SEPARATE FEATURE
- **`moved`** — ⚠️ **shown only to the company and the person it belongs to. To everyone else the slot
  reads EMPTY AND AVAILABLE.**
- **`cancelled`** — ⚠️ **shown as cancelled to both parties; OPEN AND AVAILABLE to everyone else.**

🔒 **So the rendered status depends on WHO IS LOOKING.** **A single `status` column cannot answer it —
the read must be viewer-scoped.** ⚠️ **This is the part most likely to be built as a UI filter and
leak through a second reader** (D18): **decide it ONCE, on the read.**

### ⚠️ MEASURED 2026-09-01 BY ORCH6 — HE IS RIGHT, AND THE VOCABULARY IS NOT THE PROBLEM
**`bookings_status_check` already permits TWELVE states:** `draft · available · unavailable · pending ·
pending_slot · pending_payment · confirmed · cancelled · expired · completed · scheduled · no_show`.

**What is ever WRITTEN — the whole table:**
| status | rows |
|---|---|
| `available` | **594** |
| `scheduled` | **117** |
| `cancelled` | 6 |
| `completed` | 1 |

⚠️ **Four of twelve, and two of those are 99% of the table — exactly his "a block is either booked or
open."** **`pending_slot` is the column DEFAULT and has never been written. `request_selections` holds
8 rows, all `received`.**

### THE GAP, PRECISELY
| His state | Today |
|---|---|
| **requested** | ⚠️ **nothing means this.** `pending_slot` is the default and is never used |
| **approved** | ⚠️ **NOT IN THE CHECK AT ALL** — new state |
| **pending** | in the CHECK, **never written** *(and `pending_payment` duplicates the idea)* |
| **scheduled** | ✅ exists, used |
| **moved** | ⚠️ **NOT IN THE CHECK AT ALL** — new state, and it carries the viewer-scoped rule |
| **cancelled** | ✅ exists, used — ⚠️ but the viewer-scoped rule is not built |

⚠️ **So this is not "add six statuses."** **It is: two new states, one duplicate to resolve
(`pending` vs `pending_payment` vs `pending_slot`), the TRANSITIONS and who may fire them, the
payment-request trigger hanging off `approved`, and a viewer-scoped read.**

### DEPENDENCIES
- 🔒 **This IS `CR-90`'s "pending until payment is confirmed."** ⚠️ **Same machine. They are ONE task,
  not two** — the rolling 30-day schedule is this lifecycle applied a month at a time.
- **`CR-89`'s payment disposition decides what "paid" means**, and `TASK-BACKDATE` decides what date
  it happened on. **Both land first.**
- ⚠️ **`TASK-BACKDATE` is live and touches settlement. Do not run this beside it.**

### ASK-OWNER
1. ✅ **ANSWERED 2026-09-01: *"hold until the new one is approved."*** 🔒 **The old slot is HELD until
   the new time is approved, then released.** **A refused move therefore has somewhere to fall back to.**

   ✅ **AND THE DISPLAY COLLISION IS RESOLVED, 2026-09-01:** *"a held slot isnt empty and available
   until the new booking is approved then the hold is released."*
   🔒 **WHILE HELD, THE OLD SLOT READS AS OCCUPIED TO EVERYONE ELSE — not open, and with no reason
   given.** **On approval of the new time, the hold releases and the old slot becomes genuinely
   available.** ⚠️ **So `moved` is only "open to everyone else" AFTER the new booking is approved.**
   **The hold is real, not cosmetic: nobody can take the slot the mover may need to fall back to, and
   nobody is told a move is pending.**

### 🔒 THE READ RULE, GENERALISED FROM HIS THREE ANSWERS — build this ONCE
⚠️ **THERE IS NO "AVAILABLE" TO RENDER. Owner, 2026-09-01:** *"the calendar is only going to show
unavailble timeslots with something in them all other calendar space is just empty which means its
available."*
🔒 **AVAILABILITY IS THE ABSENCE OF A BLOCK.** **An outsider sees either something in the slot, or
empty space. `cancelled` and a released `moved` therefore render as NOTHING — not as a chip saying
cancelled, not as a green "available" state.** ⚠️ **Do not build an available-state renderer; today's
594 `available` rows are the schema's business, not the calendar's.**

⚠️ **And an outsider never learns WHY a slot is occupied — with ONE deliberate exception.**
✅ **The exception, owner 2026-09-01:** *"to everyone else it can show as pending reschedule, to
indicate its likely to open up."* ⚠️ **A held slot is still NOT bookable.**
✅ **BUT IT IS WAITLISTABLE — owner, 2026-09-01:** *"they can waitlist on the pending unhold spot."*
🔒 **`Pending reschedule` accepts a WAITLIST entry, never a booking.** **That is what the label is
for: it signals the slot is likely to open, and gives the signal somewhere to go.**
⚠️ **MEASURED 2026-09-01: NO WAITLIST EXISTS.** **No `waitlist` table, no `waitlist` anywhere in `src`
or the migrations** *(`inbound_queue` is lead intake, unrelated)*. **`request_selections` has 8 rows,
all `received`, and its state column carries no CHECK constraint at all.**
⚠️ **So this is a small greenfield build, and `request_selections` is the nearest incumbent — decide
whether a waitlist entry IS a request selection or a new thing, and say which** (D18).
**ASK-OWNER — what happens the moment the hold releases?** Three shapes, and they are different
products: **(a)** the slot simply opens and the waitlister is notified · **(b)** the waitlister gets a
first-refusal window before anyone else can take it · **(c)** it converts straight to a `requested`
booking for them. ⚠️ **Do not build one on assumption; (b) is the only one that makes a waitlist worth
joining, and it is also the only one that needs a timer.**
**Nothing else leaks: no client name, no reason, no new time.**

| State | The parties see | ⚠️ Everyone else sees |
|---|---|---|
| `requested` · `approved` · `pending` · `scheduled` | the real state | **a block — `Booked` / `Unavailable`** |
| `completed` · `no_show` | the real state | **a block — `Booked` / `Unavailable`** |
| `cancelled` | **cancelled** | ⚠️ **nothing — the slot renders empty** |
| `moved`, while the new time is unapproved | **moved** | ⚠️ **`Pending reschedule`** — occupied, but signalling it is likely to open up |
| `moved`, once the new time is approved | **moved** | ⚠️ **nothing — the hold releases and the slot renders empty** |

🔒 **THIS IS ONE VIEWER-SCOPED READ, NOT SIX SPECIAL CASES**, and it must be decided on the READ so a
second reader cannot leak a state a UI filter forgot to hide (D18).
**The occupied labels already exist — `CalendarPage.tsx:121` renders `Booked`, `Unavailable` at :124.
Reuse them. ⚠️ `Pending reschedule` is the ONE new label this CR adds — and it needs a legend entry
beside the other two, or it is a colour nobody can read.**

---

## CR-98 · G1 · ⚠️ URGENT — `/sign/*` asks for everything and shows a purchase block nobody authorised

**SAID (owner, 2026-09-01):**
> *"on the page for /sign/rider remove the block of shit that says 'what youll be able to purchase' I
> never authorized this design, i never asked for it to be setup this way and its very confusing to
> visitors and it looks broken because the block of shit you added to the page looks like buttons that
> dont click. if any of the other /sign pages have this same block of 'what youll be able to buy' shit
> it needs to be removed immediately."*

> *"the purpose of this page is purely to capture the initial information for the setup of an account,
> it was supposed to only ask for their email address. then it prints a notification to check their
> email account for the link to click to setup their account, with the spam notice and the report
> issue link at the bottom."*

### ⚠️ MEASURED 2026-09-01 BY ORCH6 — one file serves all four funnels
**`src/pages/SignStart.tsx`, 1047 lines, routed as `/sign/:path`** *(guest · rider · horse ·
rider+horse — `App.tsx:188`)*. **The string is at `SignStart.tsx:662`.** ⚠️ **So it is on EVERY
`/sign/*` page, not just `/sign/rider`.**
⚠️ **AND THE SECOND HALF OF HIS COMPLAINT IS CONFIRMED: the page carries FOURTEEN-PLUS `<input>`
fields.** **It is a full intake form where he specified ONE BOX.**

### 🔒 THE FLOW HE SPECIFIED, END TO END
1. **`/sign/*` asks for the EMAIL ADDRESS ONLY.** On submit: **confirmation or error**, *"check your
   email for the link"*, ⚠️ **a spam notice, and a way to contact him for help.**
2. **The emailed link → the AUTH SETUP page** — *"google button for gmail accounts and password for
   known non gmail accounts."*
3. **First page after auth: the personal-information form.** ⚠️ **The MINIMUM the DOCUMENTS require,
   and WHICH documents is decided by the `/sign/*` path they arrived through** *(rider → participant
   docs)*.
4. **Then the documents to read and sign.**
5. **Then select the offering.** 6. **Then pick a day and time from the calendar.**
7. **Then submit the booking request.**
8. **Email to them: copies of every signed document, plus the order contents and the booking request
   in the body.**
9. **They exit onto the app's overview modal over the community feed.**
10. **Company side: a notification AND an email showing the order and the date/time selected.**
11. **Staff click APPROVE → the client is notified their order and booking are approved and payment
    is due.**
12. **Client clicks the email link or the dashboard notification → the PAYMENT MODAL opens** *(from
    email: the browser opens, the app logs in, lands on the dashboard, modal opens for that order)*.
13. **The modal shows the order, the total due, and two buttons: PAY CASH · PAY WITH ZELLE.**
    - **CASH:** records the payment type, notifies the company so staff can confirm the booking to
      `scheduled`; the modal shows a confirmation page; they close it and the notification is gone.
    - **ZELLE:** the modal advances to the Zelle payment details; they click to confirm they sent it;
      they close; the notification is gone.
14. **Company gets a notification that the client paid by Zelle; when the money posts, staff click a
    button ON THE NOTIFICATION to mark it paid.**

⚠️ **HE IS NOT ASSUMING THIS IS UNBUILT:** *"if you find that the current implementation already does
these things we need to investigate what is blocking a new visitor from signing up."* **But the intake
half is confirmed out of alignment already.**

---

## CR-99 · G4 · captured — request cards on the dashboard need a home, a style, and their actions

**SAID (owner, 2026-09-01):**
> *"we need a dedicated style and possibly a location where these cluster when there are more than one
> shown at a time, for the type of card that shows an order and/or booking request. the notification
> cards need to enable actions that we take in response to these requests, like seeing the contact
> information so we can contact the client, suggesting a different date and/or time, approving an
> order and/or approving a booking request and marking an order paid."*

> *"status should set automatically for the calendar entry based on the stage of approval and payment,
> the payment status should be set based on the inputs from the client and staff, with each seqential
> interaction that advances the order's payment status being the result of a button clicked by either
> party as required by the software."*

🔒 **THE CARD IS AN ACTION SURFACE, NOT A NOTICE.** **Its actions: see contact details · suggest a
different date/time · approve the order · approve the booking · mark it paid.**
🔒 **STATUS IS DERIVED, NEVER TYPED.** ⚠️ **The calendar entry's status follows the approval and
payment stage automatically; every advance of payment status is a BUTTON one side or the other
pressed.**
⚠️ **THIS IS `CR-97`'s STATE MACHINE SEEN FROM THE STAFF SIDE** — `requested → approved → pending →
scheduled`. **Same machine. Do not let it become a second one** (D18).

---

## CR-98 · A1 — ✅ ANSWERED 2026-09-01. TWO DOORS, NOT A CONTRADICTION.

**SAID (owner):**
> *"there are two ways the documents get initiated, the /sign/* pathway always activates the account
> and assigns the required file set, this is a hands off pathway that is user initiated and born from
> a discussion about a purchase without the user having selected the purchase from the website catalog
> and submitted the request, we send them to this link. If the person submitted an order from the
> website catalog the documents are assigned based on the selected offerings. Im not sure where things
> stand today if the website submission routes the person to the activation flow by sending them the
> link via email the same way the /sign/* does, but that is the goal, with the only difference being
> they have already created an order in the system. If they are setup manually by staff we can decide
> if they should sign documents now or not. if we dont assign the documents to them now then the
> system recognizes this when they make their first purchase (either initiated by them from the
> catalog in the app or by us manually creating an order for them) and the documents are assigned
> based on whats in the order."*

### 🔒 THE RULING — the 2026-08-24 "docs come from the offering" ruling STANDS and is not contradicted
**It governs the ORDER door. The path-set governs the NO-ORDER door.** ⚠️ **Which door decides which
source. There was never a conflict — only an unstated second case.**

| Door | Documents come from | Notes |
|---|---|---|
| **`/sign/*`** — hands-off, user-initiated, **no catalog selection**, link sent after a conversation | 🔒 **the PATH's required file set** | **always activates the account and assigns** |
| **catalog order submitted on the website** | 🔒 **the SELECTED OFFERINGS** | ⚠️ **GOAL: this routes into the SAME activation flow, same emailed link — the only difference is an order already exists.** **Establish where this stands today** |
| **staff sets someone up manually** | ⚠️ **STAFF CHOICE — assign now, or defer** | |

### ⚠️ THE DEFERRED CASE IS A SYSTEM REQUIREMENT, NOT A GAP
🔒 **A person may exist with NO documents assigned.** **The system must RECOGNISE this at their FIRST
PURCHASE — whether the client raises it from the catalog in the app, or staff create the order — and
assign from THE ORDER'S CONTENTS at that moment.**
⚠️ **So assignment has TWO trigger points and they are not alternatives: activation-by-path, and
first-purchase-if-none-yet.** **A build that wires only the first leaves manually-created clients
permanently paperless.**

⚠️ **AND IT ANSWERS THE WIZARD LOOP-BACK QUESTION:** an offering chosen at wizard step 5 that carries a
document the path-set did not include **must assign at that moment under the same first-purchase
rule** — the wizard does not need a special case, it needs the general one.

---

## CR-99 · A2 — ✅ ANSWERED 2026-09-01. NO NEW CARD, AND THE LOCATION IS ONE LIST.

**SAID (owner):**
> *"yea the dashboard is where these notifications are shown, a location means that there is a specific
> spot on the dashboard that lists all new requests (leads, bookings, orders, etc...) the shape is
> based on what the system already creates as long as it carries the functions via buttons and
> information that i requested, i already specd it, dsgn isnt needed."*

🔒 **LOCATION: ONE SPECIFIC SPOT ON THE DASHBOARD THAT LISTS ALL NEW REQUESTS.** ⚠️ **All kinds —
LEADS, bookings, orders, "etc."** **Not an orders band. One inbox of new requests, whatever they are.**

🔒 **SHAPE: WHATEVER THE SYSTEM ALREADY CREATES.** ⚠️ **Do NOT design a new card** (D18). **The only
requirement is that it CARRIES the functions and information already specified in CR-99:**
**see the contact information · suggest a different date and/or time · approve the order · approve the
booking · mark it paid.**

⚠️ **`TASK-REQCARDS` §9's proposed anatomy and its "Requests band" are SUPERSEDED BY THIS.** **The
build takes the shape from the incumbent and this ruling, not from §9.** **`DSNR` is not needed here —
the owner has specified it.**

## CR-100 — address inputs must normalize and validate

**SAID (owner, 2026-09-01, verbatim):**
> *"we need the address fields to normalize the inputs, when i enter my address, 752 windemere ct
> san diego ca 92109, it stays looking like that it should normalize to capitalize and it should
> make sure its a valid address somehow."*

**Recorded by ORCH7 as courier; routed to `DISCO` for the discussion.** Not specced, not discussed
at the pass. What DISCO will need to establish: where address fields live today (the `/sign/*`
paths, onboarding details, the contact record — D22 makes the contact record the source of truth
and `compose_address` composes what is typed), what "normalize" is (capitalization on blur is the
D34-adjacent idiom: on blur, once, in front of the person, never re-correcting a deliberate
change), and what "valid address somehow" means — a format-level check vs a real verification
service, the latter being an external dependency with a cost, which is the owner's call to make.

## CR-101 — signing flow still shows the date and signature tokens; a prior task was meant to fix it

**SAID (owner, 2026-09-01, verbatim):**
> *"noticed that the docs in the signing flow still show the tokens for date and signature, we
> previously ran a task thread that was supposed to remove the visibility of the signature token
> and insert the real date rather than show the token."*

**Recorded by ORCH7 as courier; routed to `DISCO`.** ⚠️ This is a CLAIMED REGRESSION or an
unreached fix (D17's pattern): a prior thread was supposed to have done it. DISCO's first job is
the trace — which task that was (note: `TASK-SIGNSTRIP` 2026-09-01 was a different scope, the
catalog block; do not assume), whether its change merged, and whether the owner is seeing a path
the fix never reached. The signing freeze is in force; whatever the fix is, it must not touch
executed documents (D32, D33).

## CR-102 — the doc-signing flow's brown becomes the company green

**SAID (owner, 2026-09-01, verbatim):**
> *"change the brown used on the things like icons, strikethru, checkmarks, text, boarders,
> highlights, and buttons in the doc signing flow to the company green color."*

**Recorded by ORCH7 as courier; routed to `DISCO`.** Scope named by the owner: icons ·
strikethrough · checkmarks · text · borders · highlights · buttons, in the doc signing flow.
Trap to carry into any spec: T1 — arbitrary Tailwind values have silently emitted nothing here
twice; the built CSS must be grepped for the emitted value.

**🔒 SCOPE RULING (owner, 2026-09-01, to FHE-DISCO-SIGNFLOW, verbatim):**
> *"yea the gold used on the onboarding flow looks like shit brown so switch that gold, in those
> locations and any other places its used, company green. the nav im seeing on admin ui uses gold
> and it looks good, so i dont know why it looks so bad on the onboarding flow. also the contacts
> cards have gold rings around the avatars and they look good too. so i guess you need to discern
> between the gold that shows up properly and gold that looks like shit brown when making the
> change. as a general rule, things that are decorative like the accent around the avatar on a
> contact card in the admin ui or the nav menu showing selected state or notification count are
> the acceptable uses for the nice gold color. anything that is a functional action element or
> something like an icon or text, green is the right choice."*

**So CR-102 is NOT signing-flow-only: the rule is DECORATIVE vs FUNCTIONAL, applied app-wide.**
Decorative accents (avatar rings, nav selected state, notification count) keep gold; functional
action elements, icons and text go green. See `docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md` for the inventory
and the mechanism behind "shows up properly" vs "shit brown."

## CR-98 · A4 — ✅ RULED 2026-09-01: step 9 lands on the COMMUNITY FEED, reversing TASK-ONBOARD §5
**SAID (owner, verbatim, from TASK-SIGNBOOK-REPORT.md criterion 3):**
> *"the dashboard route is there to ensure they see notifications, but since this is their first
> flow, they need to see the community feed as the first thing after closing the modal."*
Built by the SIGNBOOK thread (`a459273b`); filed late by ORCH8 — it lived only in the report.

## CR-103 — the door knows who is knocking: one email field, three states, three emails, three destinations
**SAID (owner, verbatim, from SIGNBOOK-FINDING-the-door-does-not-know-who-is-knocking.md §1):**
> *"yea there is a major fuckup here on two sides. 1) it doesnt check if that email belongs to an
> account already … 2) a valid form submission creates a lead with an order, when the user does this
> they should be sent an email with the link to activate their account and that is the exact same
> flow as this one, same link destination, everything…"*
Ruling: active account → sign-in email/destination · known-but-unactivated → activation link ·
new → activation link via the same spine. Built (`bbea98f8`, `26c8b90b`, migration `20260901T1700`);
filed late by ORCH8.

## CR-104 — the contact form: menu first, checkboxes it reveals, into their own field; visit-when pickers CUT
**SAID (owner, verbatim, from OWNER-BACKLOG-2026-09-01 §3):**
> *"their primary interest they select that, then they use checkboxes for any of their interests and
> they provide us with their information…"*
⚠️ **The when-pickers half (week/date/timeframe) was CUT by him the same day:** *"lets avoid adding
the options for selecting when they want to visit when they select visit the ranch from the menu."*
Built minus the cut (`c92308a8`, `c45ee5ea`, `2964f125` — `requests.interests` + menu-reveals-checkboxes
+ bell/email render); filed late by ORCH8.

## CR-105 — D39: build for the outcome, not the instruction's noun
Promoted to `CLAUDE.md` D39 + `TASK-ROLE.md` §2c + `DSNR-ROLE.md` §6 by the SIGNBOOK thread
(`87eb0888`) after the interests field shipped with no reader. Ledger entry: a stored value with no
named reader is reported as UNFINISHED, not shipped; report §6 item 3b enforces it at verification.

## SITE-PUBLIC rulings R1–R3 (owner, 2026-09-01) — filed by ORCH from FHE-DSNR-SITE-PUBLIC-HANDOFF §0.2
**R1** landing shape approved — the full-cart corner is cart glyph + Sign In; *"a person with things
in their cart needs to go to the cart."* **R2** `/ride`/`/shop`/`/membership`: *"either way, keep and
redirect to the booking page the CTA links to"* — keep-and-301 to `/lessons`; 404 struck; SITESEO
ungated. **R3** narrows D37 — tier lines only on prompts that LAUNCH threads (amended in CLAUDE.md,
ORCHESTRATOR.md, DSNR/DISCO role files).

## CR-106 — full public-site SEO audit + full analytics with attribution, an admin analytics page, and dashboard tiles
**SAID (owner, 2026-09-02, verbatim):**
> *"SITESEO needs to do a full SEO audit for the public facing website pages only and we need full
> analytics with ref attribution and click level user tracking so we know where they went, what they
> did, and where they were when they came to us. the analytics needs to feed an analytics page in the
> app under the admin section and certain key data points should be visible on the admin and ops
> dashboards."*
**Recorded by ORCH; routed to research (DISCO profile) before any spec.** Widens SITESEO beyond its
current spec (301s + route-list convergence, which stays dispatchable as-is). The analytics half
needs a tooling decision (Vercel Web Analytics is live but is page-level; click-level tracking with
referrer attribution needs an events pipeline or product choice — a ruling to prepare, not invent),
a privacy/consent consideration (CA), the admin page, and the dashboard tiles (D26 surfaces).

## CR-107 — many dashboards, with an accessibility selector for the two owner accounts
**SAID (owner, 2026-09-02, verbatim, asked as "did we do the dashboard refactor where…"):**
> *"…there are a lot of different ones and i can enable them as accessible for claire and myself and
> we can choose which ones we want to have accessible from the dashboards page using a selector of
> some kind?"*
**Answer established from the record: NO — not built.** What shipped is TASK-DASHBOARDBUILD
(2026-08-22): the two D26 role-emphasis ops dashboards on the self-arranging zone framework
(`src/lib/dashboard/registry.ts`). The multi-dashboard build was planned
(`docs/design/DASHBOARDS-GROUND-UP-PLAN.md`, owner was reviewing) and held; TASK-FIX6 ("the
dashboards — renders what exists") never ran. ⚠️ **The D13 exception ruled out per-zone ARRANGEMENT
editors; a WHICH-DASHBOARDS-ARE-ACCESSIBLE selector is access control, not arrangement — it is not
excluded by that ruling.** Routed: revisit the plan against this description before any build.

## CR-108 — the location is the RANCH; rename everywhere (FHE v1 ruling)
**SAID (owner, 2026-09-02, verbatim):**
> *"We refer to our location as Ranch not barn. rename everywhere, this is FHE v1 specific and thats
> ok. For the v2 build the setup onboarding for a tenant will ask them to choose their own
> terminology for things like this. We technically dont have 'barn ops' we dont own or run the
> ranch, we board there and rent a tackroom and run our business from there with permission from the
> owner."*
Answers the Barn Ops wording question from SITECOPY-B. The seam exists: `usePropertyTerm` already
renders 'ranch' for FHE. The "Barn Ops" module NAME is held for CR-109's review — the copy sweep
does not guess its replacement.

## CR-109 — Stable/Tackroom management: dedicated Horses · Gear · Supplies · Business pages, with assignment and consumption
**SAID (owner, 2026-09-02, verbatim):**
> *"We have Stable and Tackroom management and tracking needs, if these are bucketed under 'Barn
> Ops' we need to review the layout, inclusions, capabilities, and access/ui visibility. I've only
> ever seen My Stable which shows My Horses and My Gear. As a business with a tackroom we have horse
> specific gear and supplies and general use gear and supplies, logging, tracking, management, and
> visibility for gear and supplies appears to be split between a single gear page and horse specific
> supplies section on the horse records. Im not sure this is ideal, it would be better to have
> dedicated pages for Horses, Gear, Supplies, and Business (boarding, tackroom, signage, insurance,
> decorative items for the tackroom, furniture, etc...), and then the ability to assign things to
> eachother. so we would assign gear to the horse(s) that use it, select the feed and bedding from
> the supplies page on each horses record and input how much they use every month to track
> consumption on a per horse basis and aggregate so we can see the depletion of the amount on hand
> shown in the supplies page."*
Routed to research (DISCO profile) — measured 2026-09-02 before routing: `mod.barnops` is ENABLED
and registered (hub `/app/ops/barnops` + Resources + Consumption log + Allocation rules,
`pageRegistry.ts:298-301`), so consumption/attribution machinery ALREADY EXISTS — the review is a
convergence question (D18), and "I've only ever seen My Stable" despite a live nav row is a
reachability/visibility question (D17) the research must answer.

## CR-101 · A1 — ✅ RULED 2026-09-02: no trailing period on a signature line
**SAID (owner, verbatim):**
> *"we dont need a (.) at the end of a line that has a signature in it. that doesnt even make sense
> to be there in the first place. remove it and the issue you raised is no longer an issue."*
Closes the cursive-period item from SIGNFLOW-A §5. The fix is in `remerge_contract_from_clauses`
(the composer that appends the period, :171-174) — a production migration, so it gets a SHORT
DSNR-profile spec, not a pass-fix. Constraints for that spec: executed bodies are evidence and are
never rewritten (D32/D33, 0 of 81 affected anyway); the three unsigned bodies (incl. the live
Pamela lease) re-compose through the normal remerge path only.

## CR-110 — Modules were to MOVE to the account settings page as the access point, not be stripped; the refactor has not run
**SAID (owner, 2026-09-02, verbatim, correcting TACKROOM handoff §3.1 and the FIX3 framing):**
> *"I didnt request stripping the modules entirely i asked to move it from the rail to the account
> settings page as the access point, it required a refactor that hasnt run yet."*
**State measured 2026-09-02:** TASK-FIX3 (2026-08-31) built only the REMOVAL half — `CARD_PAGE_ONLY`
filters Settings and Modules from all three nav surfaces (`AppLayout.tsx:784-791`). The
access-point half exists as a single parked `NavRow` for Barn Ops at the bottom of the Account page
(`AccountHub.tsx:235`), not as the designed account-settings access point for modules; the other
module hubs have no row there at all. **The refactor — the account settings page as THE access
point for modules — is PENDING and unspecced.** It belongs with the admin-refactor design
(`docs/design/refactor/CHAT-THREAD-ADMIN-REFACTOR-2026-08-26.md`) and is a bundle candidate for
the MGMT trial. Every "the owner asked for exactly that" framing of the rail removal is corrected
by this entry: he asked for a move; half of it ran.

## CR-111 — the vocabulary ruling: Ranch, the full org name, and NINE BANNED WORDS (supersedes D38's "program")
**SAID (owner, 2026-09-03, verbatim):**
> *"use org name in any such instances, and make sure they read properly and use the full name not
> FHE. We board our horses and run our business from a property and business that is designated as a
> Ranch by owner and diversity of the property contents. Since we operate out of Carmel Creek Ranch,
> all references to the locale or location or property or the operations and ongoings surrounding our
> business should be referred to as "Ranch", a barn is a building like a stable, the property
> obviously has those but that reference would only be accurate and acceptable if such a structure was
> relevant to the sentence where the word is being used. We dont use any of the barns on the
> property, stables is how the collection of pens are referred to in some cases or a business in
> others, so using it would be a bit confusing. For FHE, we are located at Carmel Creek Ranch, we
> board our horses in stalls identified by numbers, and we operate out of Tackroom 11. There is a name
> or designation for the general area of the property where our stalls and tackroom are located but i
> dont have the specific information about that to give to you at this time. We do not run a
> "program" so much as we operate a community and offer services like lessons, horse training, lease
> and purchase support… Barn, Stable, School, Program, Academy, Hunter, Trailriding, Tours, Western,
> are all banned words unless specifically instructed to use them, if they are found anywhere
> publicly facing or internally named, show me them with enough information about their location,
> surrounding text, and other contextual data so i can best guide a solution, id like suggestions
> from the thread in hopes that they suggest what i would write down…"*
**Consequences:** TASK-RANCHWORD-A (which maps business-sense "barn" → "program") is WITHDRAWN before
dispatch — "program" is now banned. Replaced by a DISCO-profile audit (`FHE-TASK-BANNEDWORDS`): every
occurrence of the nine words, public or internal, with file:line, surrounding text, sense, and a
suggested replacement, presented to the owner for ruling. Business-sense references use the FULL org
name "French Heritage Equestrian", never "FHE". D38/D43 amended.

## CR-112 — the SUPPLIES system: dashboard + list + inventory + usage + status, reports, and the data flowing to the horse record (CR-109 shaped)
**SAID (owner, 2026-09-03, verbatim):**
> *"border's arent a thing for us, we dont offer boarding, we are bording at the ranch. we handle
> other bording client's needs for their horses. Since they have a "my stable" page with their horses
> and gear, they should have a supplies page. The supplies page should be constructed with pages for
> managing a supplies list, inventory, usage, and status. The supplies page should have a method for
> generating reports that are saved in the users documents page that can be viewed, printed, emailed,
> and downloaded. Reports need to be available as PDF and CSV. They should feature tables, charts,
> graphs, and notes. The report generator should be a set of elements to select from for inclusion
> and a space for the user to input text fields, they should be able to set the arrangement of the
> items and items should use predefined size and spacing parameters so the report layout can auto
> generate based on the arrangement the user defines.*
> *1. The main supplies page is a dashboard, it shows all the information available to the user:
> data, stats, graphs, charts, alerts, notifications, reminders, etc. This page is also the access
> point to the internal sub pages, using buttons on desktop and a dropdown menu on mobile (this should
> be the global standard configuration for navigating sub pages from main pages, worth a review pass
> to see if this is in place and identify any pages needing to be updated to match this requirement).*
> *2. The supplies list page shows items as rows and it has a button to add a new item, an edit button
> to change inputs or select rows to remove, removed rows become hidden but remain available to the
> system so past use history is unaffected when reports are generated and can be unhidden using the
> edit button to see the hidden items at the bottom of the page in a section titled hidden items. This
> enables the user to remove an item from the selection menus on the inventory and usage pages
> without losing it permanently. items need standard columns for basic information: category
> (required, list of common options plus free text input that is saved and selectable on future
> rows), brand (optional, only free text input for first row created then its shown as the first
> option on a selection list that is generated from all past entries in this field, an x to the right
> of the items on the list removes it from the list but leaves it wherever it was used), product name
> (optional, same mechanism as brand), unit size (optional, [number]+[measurement unit] needs a preset
> list of measurement units to select from for the math to work when used in calculations), unit cost
> (optional, $, field must be formatted for use in calculations), unit price (optional, used when
> supplies are billed to a client based on usage, $, formatted for calculations), units per order
> (optional, inherits measurement unit selected for unit size or if no selection was made in that
> column it shows the same list from that column for the user to select from and then that column
> inherits this columns selection), order quantity (optional, inherits same measurement unit from
> prior columns or offers the list and the prior columns inherit the selection), reorder trigger
> (optional, quantity of inventory units remaining (triggers on ≤ value entered), and options for the
> user to select with check boxes for what they want to happen on trigger: alert and/or task),
> checkbox that sets the row as non-inventory item (optional, overrides these fields by making them
> inactive: units per order, order qty, and reorder trigger), notes (optional, free text field, adds
> a button to the item wherever its shown that only appears when there is an entry in this field,
> when the button is clicked it opens the note in a modal). Save button, this saves the item to the
> supplies list.*
> *3. The inventory page shows items as rows and it has a button to add a new item, an edit button to
> change inputs or select rows to remove, removed rows become hidden but available to add again if
> the item from the supplies list is added back, this ensures it retains a continuous records history
> for that specific item while enabling the user to not have it cluttering their page when they arent
> going to reorder it. Add a new item shows a list of items from the supplies list (non-inventory
> items are not shown on the list of options), selection adds the rows as configured from the list
> with empty active fields available for the user to enter current values and make desired
> selections. Save button, this saves the item to their inventory.*
> *4. The usage page shows usage logs as rows and it has a button to add a new entry, an edit button
> to change inputs or select rows to remove, removed rows become hidden but available to add again if
> the item from the supplies list is added back… entries are rows that begin with selection of an
> item from the supplies list, the date or date range (calendar month by name or raw dates by
> selection of day 1 and day N, range displayed as dd/mm/yy + day count), an attribution field with
> list of options that show the actual data if the system has data for the selection or the option as
> a type + free text space for adding information, the way it would work is a two step selection
> first pick the category then see and select from available options with "manual entry" being an
> option. Here is the list of category types: horses, company (if company account), general, client
> (if company account), location (examples: boarding location by name or the stall (written as "Stall
> + optional identifier") or tackroom (written as "Tackroom + optional identifier") or
> competition/other venue by name or activity/event by name), and a free text input for category and
> information for that category that is added as a linked pair to the list for future use), starting
> inventory quantity (pulled from current inventory as snapshot not live to prevent recalculation,
> for non-inventory items "-" is shown), typed number for the quantity used (units inherited from
> supplies list, if null left blank for text input), calculated cost shown with $ included or if
> formula elements are missing from the supplies list entry a blank text input field is shown with
> currency label so the input can be used in cost calculations for reports and other areas, ending
> inventory quantity (calculated by subtracting quantity used from starting inventory snapshot, this
> is what the current inventory reading shows wherever its used, including dated snapshots of on-hand
> inventory on a given date), space for a reorder indicator to be shown if the current quantity is ≤
> the trigger quantity.*
> *…The implementation of this needs to be perfect so it feeds the information to places it should
> go without fail and accurately (ie: supplies attributed to a horse should be visible on the horse
> record in ways that may or may not exist yet but should definitely be shown on the horse record),
> calculations are functional, accurate, and idempotent when they need to be and revise automatically
> when they need to show real-time data. One thing that needs input is the contents of the dashboard
> and report field options as well as any other data points that should be shown in other locations."*
**Answers three of TACKROOM §5's rulings:** (1) two tenancies — the business AND each boarding client
(clients get a Supplies page beside My Stable); (2) money: unit cost AND unit price (billing to a
client by usage stays in scope); (3) usage granularity: dated entries with a snapshot start → quantity
used → computed end, per attribution. ORCH's suggestions list requested — delivered in the ORCH
thread 2026-09-03 and to be folded into the DSNR-profile spec.

## CR-113 — notification preferences: what to email, how (real-time / digest), and reminders
**SAID (owner, 2026-09-03, verbatim):**
> *"the preferences section in the account settings page should contain choices for if/what/when the
> user wants to receive emails for alerts/notifications/tasks. I'm thinking we would ask them what
> they want to receive emails about, and how they want the emails to arrive (real-time as they occur
> and/or summary of unresolved sent daily or weekly or monthly at 8 am or noon or 5 pm). And we should
> have the option for reminders that they can choose if they want them and we send them weekly for
> the number of weeks they want a reminder and they pick the day of the week they get it and the same
> time options; 8 am or noon or 5 pm."*
Depends on a scheduler: the hourly GitHub Actions job is the only cron that has ever fired (AR1).

## CR-114 — the sub-page navigation standard: buttons on desktop, dropdown on mobile — review pass
**SAID (owner, 2026-09-03):** the supplies dashboard's sub-page access "should be the global standard
configuration for navigating sub pages from main pages, worth a review pass to see if this is in
place and identify any pages needing to be updated to match this requirement." Routed as a
DISCO-profile audit of every main→sub-page navigation in the app.

## CR-115 — SITESEO follow-through: routes in service, the About placeholder, and the analytics/Business-Profile inputs ASAP
**SAID (owner, 2026-09-03, verbatim):**
> *"check to make sure all 8 routes are actually accessible and in service, pages like "About" arent
> in service and havent been updated since they were created with placeholder content at the
> formation of this project… Increasing traffic will be the focus once we have fully maximized the
> SEO potential without major changes to the website shape or contents. An about page can be added
> to a list of items to revisit in the future. I didnt supply, nor was i asked by the thread to
> supply information related to google business account, or the other things on the list of
> information needed for SEO and analytics, hopefully that wasnt part of this pass, but it needs to
> be implemented asap!"*
**Facts 2026-09-03:** the eight indexable routes are `/` `/about` `/story` `/services` `/faq`
`/lessons` `/horse` `/acquisition`; `/about` is linked from NO nav surface (only a post-inquiry link);
`/faq` self-describes as placeholder copy; `/story` carries placeholder bands; **`/visit` and
`/contact` — the conversion pages — are `indexable: false`** (worth ruling on). The Business Profile
URL was conditional in SITESEO §4c.7 and never asked for directly — ORCH's miss. **CR-106 (full
audit + analytics) is raised to the front of the queue**; the owner's input list is in the ORCH
thread 2026-09-03.

## CR-119 — 2026-09-03: BILL OF SALE co-buyer checkbox has no way OFF once checked — a live document is stuck
**SAID (owner, verbatim):** *"on the bill of sale contract there is no way to uncheck the option once
its checked for adding a co-buyer. my current bill of sale is now stuck because of this."*
**Live incident — fact-find first, one query, before anything is designed or built.**

**FOUND (ORCH, 2026-09-03, one query + one read):** the write path is not broken.
`remove_document_co_buyer` exists in production and `set_contract_field`'s teardown hook correctly
calls it when `TXN.CO_BUYER_ENABLED` flips to `NO`; the field's generic dropdown control
(`ContractCascade.tsx`'s `SelectWithOther`) can make that write. **The stuck document:**
`80537662-7b4e-4adc-9ebc-49ed9d2bed78` (`HORSE_SALE_V2`, editable, 1 buyer party — no co-buyer was
ever added). **The real defect:** checking "Yes" opens a bespoke capture card
(`ContractPage.tsx:1955-1990`) with an "Add co-buyer" button and no exit — no cancel, no restatement
of the underlying Yes/No. The actual off-switch is a plain, easy-to-miss dropdown elsewhere in the
document body. **Immediate unblock:** on that document, set "Is there a co-buyer?" to No directly —
nothing else needs to undo, since no co-buyer party exists yet. **Durable fix dispatched:**
`FHE-TASK-CR119-A`, wt-13, Opus · HIGH · ON — one action added inside the capture card itself, no DB
change needed.

## CR-118 — 2026-09-03: per-staff-account nav visibility, an Admin-nested account link, and a Team-page control surface — with a self-protection rule
**SAID (owner, verbatim):**
> *"the nav link to the account page on the staff acount needs to be nested inside admin. it only
> needs to be shown on the admin@fhequestrian.com account login. all of the admin section can be
> hidden on the hello@fhequestrian.com account login. and on the team page i should have a surface
> for controlling what nav sections and what nav links the other staff accounts see and their layout
> on a per account basis including my own. the one thing i should not be able to hide from myself is
> the access to the surface that changes what i see in the nav, so there should be a link to it from
> the account page as well and that page should never be hidden from my admin@fhequestrian.com
> account login."*
**Read as five requirements, unbundled by ORCH for the spec:**
1. The account-page nav link nests inside the Admin nav section, staff-side.
2. It (the account link, nested in Admin) shows ONLY on `admin@fhequestrian.com`'s login.
3. The entire Admin nav section is hideable, and IS hidden, on `hello@fhequestrian.com`'s login.
4. Team page gains a per-staff-account nav-visibility + nav-layout control surface — which sections,
   which links within them, and their order — for every staff account INCLUDING the owner's own
   `admin@fhequestrian.com`.
5. **Self-protection invariant:** whatever this control does to `admin@fhequestrian.com`'s own nav,
   it must never be able to hide (a) the account page, or (b) the account page's link to this same
   control surface, from `admin@fhequestrian.com`. No configuration state locks the owner out of the
   control that configures it.
**Confirms, for CR-107 (B7 DASHBOARDS) escalation 1:** `hello@fhequestrian.com` and
`admin@fhequestrian.com` are two real, distinct owner logins today — not the shared-login premise the
board's escalation questioned.

## CR-117 — 2026-09-03: there is no anonymous user any more; the gift flow rides the ACTIVATION LINK, and every "outdated flow" action is updated to it
⚠️ **NUMBERING: this was first written as CR-116 by ORCH-8 while a parallel ORCH thread was independently
filing the activate-then-review ruling as CR-116 (1d64d78c, 07:51, four minutes earlier). The earlier
entry keeps CR-116; this one is CR-117. They are the SAME PRINCIPLE captured from two halves of one
conversation — CR-116 states it for the account itself ("the account is already complete from
provisioning; the link sets up auth only"), CR-117 states it for the gift door ("the code is not a
credential; the link is"). Read them together. Two live ORCH threads on one repo caused this —
recorded in `orchestration/lessons/LESSONS.md`.**
**SAID (owner, verbatim, ruling the GRANTS escalation and widening it):**
> *"these are moot if anon is non authenticated user an do these things because everyone has an
> account now, we changed the account activation and creation process so the user can create and
> activate an account on their own. and every action like opening and redeeming a gift needs to be
> updated to follow this flow instead of an outdated one.*
> *the reveal of you got a gift is an email animation, the invitation link is an activation link that
> takes them to a unique url for them to create and activate an account without an friction, they
> will have already seen the gift but the code is linked to the account activation link they click,
> the buyer just needs to know what email address to use for them and then they are opening the link
> from that email address so thats the address linked to the activation flow. by definition of how an
> account is created, all we need is the email address and the account exists, their clicking of the
> link is what flows the auth setup and thats the "activation" but the account is already active on
> our end, the auth is not active yet on their end."*

**THE PRINCIPLE (ORCH records it as the general rule, because the owner stated it as one):**
**An account exists the moment we have the email address. "Activation" is the RECIPIENT'S auth
setup, not the account's creation.** A surface that asks an unauthenticated stranger to prove
themselves with a code, or to pick a password, is the outdated flow. The link in the email is the
credential, it is unique to that person, and clicking it from that mailbox is the proof.

**RULING on the GRANTS escalation (B1):** the Block B "keep anon" cases are moot.
- `submit_public_request` — **KEEP anon.** The contact form is a true stranger with no email on file
  yet; it is what CREATES the address the account is made from.
- `open_gift` — **REVOKE anon.** The reveal is an email animation, not an anonymous page.
- `redeem_gift` — **REVOKE anon.** It already refuses anon in its body.
- Block A (140 writers with no anonymous caller) — **REVOKE, as one block.**
**ORCH's measurement that makes this safe to do now: `gifts` holds ZERO rows in production**
(total 0, opened 0, redeemed 0, 2026-09-03). Nothing live is reached through the anonymous gift path.

**THE BUILD CONSEQUENCE (routed, not B1's):** the live gift flow is the outdated one and must be
rebuilt to the activation link.
- `src/pages/Redeem.tsx` — anonymous `openGift(code)` reveal, then a PASSWORD form for a recipient
  with no account.
- `src/lib/gifts.ts` `registerForGift()` → `api/register-gift.ts` — `auth.admin.createUser` with a
  password, on its own endpoint, deliberately NOT the invited-registration path. Its own header
  comment says the gift code is the credential — **that premise is now retired.**
- The gift email must carry the reveal (the animation) AND a unique activation link with the code
  bound to it; the recipient's email address is the account.
**Routed to B2 FUNNELDEBT** — it is the same request→account→activation spine that bundle already
owns (`provision_client_invitation`, `redeem_invitation`, the activation email). Scope added to that
bundle by ORCH; `redeem_gift`'s provisioning callees (`_ensure_client_account`,
`_provision_purchase_for_offerings`) join its DB ownership. **B1 changes ACLs only and never a body.**
**Open, for the owner, inside B2's batched summons:** does the same retirement apply to
`api/register-invited.ts` (the other password-path endpoint, which `register-gift` cites as having
"the same problem")?

## CR-111 · A1 — 2026-09-03: "My Stable" is an APPROVED use of "stable" — likely the only one
**SAID (owner):** *"'my stable' (which is an appropriate use of the word stable and likely the only
one we would allow)."* The BANNEDWORDS audit lists it as approved-by-ruling, not as a finding.
Attribution vocabulary he named for supplies: **Headquarters · Stalls · Tackroom · Horse · Event ·
Activity · Client** (+ the ranch itself / a specific arena for location retrieval). Tackroom needs no
number (one tackroom; it is the onsite operating location). The general-area name is irrelevant to
supplies.

## CR-112 · A1 — 2026-09-03: the owner's answers on the supplies design (verbatim, the spec's source)
**Structure ruled:** *"FHE Inventory -> Headquarters + My Stable -> My Horses + My Tackroom [gear,
supplies, property]… Admin is the appropriate app location for a surface that records business
expenses related to non-onsite related needs and inventory entries attributed to Headquarters, My
Stable is the appropriate app location for all onsite related inventory tracking and their expense
information."* My Stable is the main door (light stats at most) to: **Horses · Supplies · Gear ·
[Property/Equipment — name to be decided]**. The gear page ALREADY EXISTS beside horses (owner,
stated several times).
**Ledger answers:** 1 approved · 2 approved · 3 *"yes absolutely… a 50lb bag of feed is received, a
horse ate 12lb of that feed this month, inventory at month start was 18lbs, so ending inventory
remaining is 56lbs, trigger is set to 24lbs so no trigger event, cost is $/bag ÷ 50 = $/lb x 12 =
$X.xx recorded as part of the expenses for that horse for the month and the business for the
month/year"* · 4 *"run rate, burn rate, months cash on hand… predicted dates in the future for
purchases"* · 5 approved · 6 agreed · 8 correct.
**Non-inventory consumables (bedding, hay supplied with boarding, variable qty and cost monthly):**
recorded as expense + quantity + attribution; they do NOT create inventory entries, no reorder
alerts; their data points feed trends and composite cost figures.
**Supplies we give clients:** *"we take it from our stable to give it to theirs… we record the
revenue as part of an order and the expense as part of a cost for the supplies consumed."* Avoid
general/G&A entries wherever possible — true cost per transaction/activity.
**#9 horse record:** the supplies system feeds the horse record; the EXCEPTION is client-supplied
feed/meds/supplements, entered on the horse record itself; the horse record shows OUR-supplied and
CLIENT-supplied as ONE unified consumption set; price appears in the horse's feed cost only when
billed separately; bundled supply shows as part of the care-service cost.
**#10:** scheduled monthly report run: build it; for clients behind a FEATURE FLAG the owner enables.
**#11 dashboard:** no category on-hand (specific items only; categories only where a ratio/$ tied
up/days-supply insight exists); on-hand detail lives one click away in a modal; per-item toggle "show
on dashboard"; non-inventory consumables never appear as raw usage boxes but their specific values
(e.g. hay by type over 3 months) do; monthly (not month-to-date) cadence to spare Claire; TWO config
surfaces — DASHBOARD CONFIG (what is shown, where) and ELEMENT CONFIG (inputs feeding the element +
display variant: raw total · totals over N months · component matrix · pie · stacked bar · line, all
vs total); per-ACCOUNT provisioning from a general default, changes saved to the account not the
tenant; month-over-month, quarter-over-quarter, same-period-last-year, user-defined periods;
**PROJECTIONS: next 1/3/6/9/12 months and now→year-end, usage and cost, vs same period last year
and vs prior period**; **UNACCOUNTED DEVIATIONS** surfaced automatically when found (run-out earlier
than the ledger shows, or an audit) → needs an **AUDIT SURFACE**: start-audit element, guided count
list with expected vs actual per item, ledger captures the metadata, time-since-last-audit + who as
an element (manual or surfaced on interval). Top movers and not-counted-in-30-days: irrelevant.
Recent entries: useful to the owner, useless to Claire (hence per-account).
**#12 reports — the shape:** REJECTED the field-list shape. **A report is a SNAPSHOT OF THE USER'S
DASHBOARD as it appears to them + a set of explicit monthly usage and cost figures for items of
business importance regardless of dashboard + the per-horse statement + a business monthly
snapshot.** Trigger: a "monthly report" button clicked after the month's usage/received/
non-inventory entries are added (no gating, no logic); generated into BOTH accounts in their
variants; defaults to last month; parameters on the primary surface, inclusions (from the dashboard
element list) in a large modal/page off the generate modal; me/both accounts toggle; email + store
in documents; PDF/CSV/both; default = digital copy to documents. **Company documents do NOT
co-mingle with client documents** — a company "my documents" page (shared by both owners; reports
identifiable by owner variant in the name); shared documents (a lease) appear in both. **The
dashboard-config, element-config and report machinery is GLOBAL, plug-and-play on every dashboard.**
Dashboards without manual inputs auto-generate reports, with a reminder the day before and a
deadline one minute before generation.
**#13:** backdated data → old report RENAMED with "outdated"; on regeneration the old one is renamed
"superseded" and ARCHIVED (retrievable); the new report reuses the original name. Non-inventory
items carry cost.
**#14:** disagree with "converge on existing" as framed — build the structure as modeled. Name for the
durable-goods door needed (jumps, desks, cabinets, saddle racks, tack hooks, chairs, umbrella, décor,
signage, cleaning tools; test: the grill goes here, the propane in supplies). **Boarding fee** → on
the horse record (one horse, one stall; fixed monthly). **Tackroom rent** → recorded once, injected
monthly on the 1st automatically (under property, or better). **Fixed business costs** — business
and car insurance, health insurance, car payment, phone, internet — set figures charged monthly on
the 1st automatically; car-related ones are stable-attributed; **electricity at HQ and for charging
the car entered manually**. Better suggestions invited.

## CR-112 · A1 · THE PROPOSED LIST — 2026-09-03: the fourteen ORCH items the numbered answers refer to (filed by ORCH-8, owner-pasted, verbatim)
**Why it is on file:** A1's answers read *"1 approved · 2 approved · 5 approved · 6 agreed · 8 correct"* — numbers against a list that lived only in the owner's chat window. The spec inherits "approved" and must know WHAT was approved. Owner, on being asked: *"List proposed, I ruled on this and the ruling was recorded."* The rulings stand; this is the referent, nothing new. Items 7 and 14 were superseded by A1's structure ruling and A2 (Property, FIFO, resolver KEPT) — read them as history where A1/A2 differ.
1. Add a count/adjustment entry type. Usage alone can never reconcile with reality; the inventory page needs "set actual on-hand," which writes an adjustment event with a reason (spoilage, loss, recount, transfer). Without it the derived number drifts and nobody can say why.
2. Receipts are events too. "Order received" adds quantity with vendor, date, and that order's cost. Unit cost changes between orders, so cost-of-usage should use the receipt cost (average or FIFO) with the list's unit cost as the fallback. This is the existing resource_lots shape.
3. One base unit per item, conversions only within a dimension. Unit size defines package to base (a 50 lb bag = 50 lb), so units-per-order and order-quantity resolve to the base unit and the inheritance you described works without mixed-unit math. Block cross-dimension entries (lb into ml).
4. Assignments with a monthly rate, plus logged actuals. Assigning feed or bedding to a horse with an expected monthly rate gives you projected depletion and a run-out date per item before any usage is logged; the monthly usage entry then records the actual and the dashboard shows variance. This is the cleanest reading of "input how much they use every month."
5. Reorder triggers fire from the database, not the page. Evaluate on every ledger write, one open alert per item until restocked, routed into the existing notifications and tasks spines rather than a new mechanism. Add lead time and a default reorder quantity (units per order × N) so the alert can say "order by the 12th."
6. Hidden means retired, never deleted (D32): a flag, filtered from pickers, included in history and reports. Same for the learning brand/product/category lists: converge on the existing lookup_options mechanism rather than per-field lists; the "x" retires an option and leaves past uses intact.
7. Attribution as one polymorphic field (kind + id + label): horse, client, company, general, location. Locations become a small vocabulary (Stall 14, Tackroom 11, a venue), which also seeds the "general area name" once you have it.
8. Two tenancies in one model. Items carry an owner (the business, or a client contact), exactly as stable_items already does. A client sees their own supplies and their horse's usage; staff see the business's plus every client horse they care for. This is what makes a client statement possible later, which is what your unit-price field is for.
9. The horse record gets a "Supplies & usage" card: current assignments with rates, last three months of actuals, cost, and the existing medications/supplements folded in as supplies attributed to the horse, so there is one place, not two.
10. Reports ride the existing engines: the PDF renderer already used for documents, the files spine so saved reports land on the user's Documents page, and a shared CSV export. The layout engine is a fixed grid of predefined block sizes, as you specified; add saved templates and a scheduled monthly run, which ties into CR-113's digest scheduler.
11. Dashboard contents (proposal): on-hand by category · items at or below trigger · projected run-outs in the next 30 days · month-to-date usage and cost, by horse and by category · top movers · items not counted in 30+ days · open alerts and tasks · recent entries · this month's spend against last.
12. Report elements (proposal): item, category, brand, vendor, period, attribution, start/used/end, cost (unit, receipt, or average), price billed, receipts, adjustments, notes; charts for usage over time per item or horse, cost by category, on-hand against trigger; and a per-horse statement as a first-class template.
13. Decisions to make now, before the spec: how backdated entries affect later snapshots (ledger as-of is the honest answer; captured snapshots stay as history); whether the client-billing resolver stays or retires behind a flag; and that non-inventory items still carry cost so attribution and statements work.
14. Converge, don't rebuild (D18): resources, lots, and consumption events are the right bones; My Stable's supplies list retires into them; My Stable's gear stays until the Gear page is designed.
**ORCH-7's follow-up in the same exchange (the "Equipment" recommendation, the recurring cost schedule, the resolver-retire recommendation) is superseded where A2 rules otherwise: Property (owner's), FIFO not weighted average, resolver KEPT. The recurring cost schedule stands (A1 #14 / bundle item 3).**

## CR-112 · A3 — 2026-09-03: the attribution vocabulary is CONFIRMED; Admin gains a Company page and an Accounting page; Headquarters and G&A are Admin-only attributions
**SAID (owner, verbatim):**
> *"I ruled on 7 explicitly, and you should see it in my pasted content. you listed all of them. no need for me to confirm them, they are confirmed, thats why you know them. the split between headquarters and my stable as attribution roots is based on where the entry is being captured. I proposed a business expenses surface inside the admin section on a new page called Company. Assets and Expenses pages go on a page called Accounting. If an entry is made within this area as an expense it can select the Headquarters or G&A categories in addition to the ones listed under My Stable. Headquarters and G&A should not appear as options anywhere in the My Stable entry surfaces."*
**Consequences ORCH records:** the attribution seed (Headquarters · Stalls · Tackroom · Horse · Event · Activity · Client, + ranch/arena as locations) is confirmed — BUNDLE-SUPPLIES escalation point 5 is STRUCK. Attribution roots follow the CAPTURE SURFACE: Admin → **Company** page (business expenses) and **Accounting** page (holding Assets and Expenses pages) may attribute to Headquarters or G&A in addition to the My Stable categories; My Stable entry surfaces never offer Headquarters or G&A. G&A exists as a category; A1's "avoid general/G&A entries wherever possible" stands as guidance on use, not a ban. D13: the vocabulary remains owner-editable in-app.

## CR-112 · A2 — 2026-09-03: ONE ledger surface per door, two entry types, cost recognized at purchase, the nested structure, and KEEP the billing resolver
**SAID (owner, verbatim):**
> *"Im ok with collapsing the inventory and usage into one page with a unified and accurate name like
> Ledger, it works on every door, the inputs either add units to inventory, remove them, or just
> record consumption in units and/or $… Add Entry can be a button that adds inventory and in doing
> so the item becomes part of the list of items we can add or remove qty from in the same operation
> as it sets the current on-hand qty and the cost/price for those units… when the price changes we
> dont have to update the inventory items list the new cost/price is associated only with the actual
> number of units on the entry, the on-hand units carry the old cost until inventory is exhausted…
> what we need is not 3 pages but 2 entry types, +inventory and +expense, -inventory or +expense;
> assuming we record the cost of inventory as recognized at the time of purchase not the time of use…
> we record the cost in the month its spent regardless of when its consumption occurs."*
> **Structure:** *"My Stable [dashboard + stats card w/ reports] + [inventory list + [item details]] +
> [activity log + [activity details]] + [horses, tackroom] → 1. My Horses [entry surface for expenses
> attributed to each horse: purchase/lease, vet, boarding + bedding + hay, shoeing, clipping,
> training, entry fees for competitions, events, activities] + [stats card w/ reports] + [activity log
> + [activity details]]. 2. My Tackroom [tackroom dashboard w/ reports] + [tackroom inventory list +
> [item details]] + [Supplies, Property] → 2-1. My Supplies [entry surface for inventory w/ costs +
> expenses w/o inventory: feed, cleaners, refreshments, medical/medications, supplements, specialty
> care products, maintenance products] + [dashboard w/ reports] + [supplies inventory list + [item
> details]]. 2-2. My Property [entry surface for inventory w/ costs: tack, riding attire, protective
> gear, furniture, tools, jumps, equipment, signage] + [property dashboard w/ reports] + [property
> inventory list + [item details]]."*
> **Benefits:** *"single entry with data roll-up from inner to outer… two clicks to inner surfaces,
> three clicks to deepest major surface, four clicks to max depth surface (configuration)… accurate
> accounting of complex cost attribution (eg: the full true cost per lesson for each horse w/ ROI
> (revenue/$1 spend) total expenditure w/ purchase/lease or ROI against monthly carry cost)."*
> **Resolver:** *"Keep it! when a horse is leased we have expense sharing. We will be leasing horses
> with shared expenses, order split payer is not a thing we have implemented and definitely not in a
> way that an order assigned to a horse (which isnt even possible yet but needs to be it sounds
> like) can be automatically split based on the contract terms which were designed so they could
> support exactly this functionality."*
**Consequences ORCH records:** the name "Property" is the owner's choice for the durable-goods door
(ORCH's "Equipment" suggestion declined; the internal facility-term collision on the word "property"
is a rename hazard the spec must handle). `resolve_consumption_billing` + `cost_allocation_rules`
are KEPT and become the expense-sharing engine for leased horses; orders need a HORSE attribution;
allocation seeds from lease contract terms. Costing is LOT-LEVEL FIFO (on-hand carries the old
cost until exhausted), not weighted average.

## CR-116 — activate-then-review: an activation link sets up auth only; the account is already
complete from provisioning; the person reviews/edits it, then signs if there are docs, else proceeds
straight to the right destination

**SAID (owner, 2026-09-03, verbatim):**
> *"well thats an issue, i need to be able to setup an account fully and then when the user redeems
> their activation link they are just setting up their auth and then they see their account
> information and if they want to change anything they can, if not, they click continue and if they
> have docs they sign them, if they dont they just proceed right to the appropriate destination."*

**Said in response to a finding surfaced in conversation, not on any bundle's ledger:**
`promote_contact_to_account` (`supabase/migrations/20260802000001_lead_trust_notifications_part2.sql:192`)
only ever writes `contact_id` and `org_id` onto the `profiles` row on promotion — never `first_name`,
`last_name`, or `display_name`. The `profiles_seed_display_name` trigger fires on `INSERT OR UPDATE OF
first_name, last_name, display_name`, and a statement that only sets `contact_id` never touches those
columns, so it never fires. A lead promoted with no prior signup name keeps a blank `display_name`
forever. `redeem_invitation` (same file, line ~344) does the opposite: it `INSERT`s a fresh `profiles`
row with `first_name`/`last_name` pulled off the invitation, which does fire the trigger correctly — so
the gap is specific to `promote_contact_to_account`'s branch, not the whole promotion spine. Not
touched by any live bundle: GRANTS' ownership declaration is ACLs only, never a body.

**Not specced, not discussed at the pass. What fact-finding will need to establish before a spec is
written:**
- **The two doors and which this changes.** `Onboarding.tsx`'s STAFF-PROVISIONED door (an order/account
  already exists at mount) is the one the owner is describing — "setup an account fully" reads as the
  staff-provisioned path (`provision_client_invitation`), not the self-serve `/sign/*` door. Confirm
  against the code: does the provisioned door already separate "set up auth" from "review account info"
  as two steps, or does it currently conflate them? `redeem_invitation` currently does BOTH auth setup
  and (accidentally, via the INSERT branch) the name write in one RPC call with no review step between.
- **What "account information" means as a reviewable/editable screen.** Which fields the person sees
  and can change before continuing — presumably the same fields `promote_contact_to_account` currently
  fails to carry forward (name), plus whatever else was captured at provisioning (address, phone,
  emergency contacts — the D22 contact-record fields). Is this a new screen, or does an existing one
  (Onboarding's `details` step) already do this and just needs to be sequenced correctly?
- **The branch logic: docs vs no docs.** "if they have docs they sign them, if they dont they just
  proceed right to the appropriate destination" — what determines "the appropriate destination" per
  account/offering type, and whether that routing already exists somewhere (the wizard-steps machinery
  `Onboarding.tsx` already has, per the D39 payment-step comment fix in TASK-GRANTS-B) or needs building.
- **Whether this folds the `promote_contact_to_account` display-name gap into itself**, i.e. does fixing
  the sequencing (review screen shows the name, person can correct it, then it saves) make the trigger
  gap moot, or does the trigger still need its own fix so the name is right BEFORE the review screen
  renders (so the field isn't blank when first shown)? Likely both: the trigger gap is a data-completeness
  bug independent of the flow; the review step is new UX regardless of whether the trigger is fixed.

**Recorded by ORCH as courier; routed for fact-finding before a spec is written.**

**Fact-finding done, same day, directly by ORCH in conversation** (not a separate DISCO thread — the
owner directed proceeding this way): `docs/reports/FHE-DISCO-CR116-HANDOFF.md`. Most of the described
flow already exists; the real gap is narrower and precisely located — `promote_contact_to_account`
never mirrors name onto `profiles`, and the no-docs branch is exactly the one that skips the screen
that would trigger it. Ready to dispatch as a DSNR-profile task; queued on `docs/orch/BOARD.md` §ROUTED
item 8, not contended with any live bundle.
