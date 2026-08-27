# CHANGE ORDERS — the raw list

**80 change requests, CR-01 to CR-79 plus CR-76b.** Captured from the owner across 2026-08-24 to
2026-08-26. Distilled from `docs/CHANGE-ORDER-LEDGER.md` (2,562 lines), which stays the record.

**This file carries no recommendations and no dispositions.** For each item:

- **Said** — the owner's own words. His words are the requirement; a paraphrase is an interpretation.
- **Found** — what checking the code and the database established. Fact, not opinion. Absent where no
  research has been done.
- **Owner ruling** — where *he* has already decided. Present on a minority of items. **These are his
  decisions, not proposals, and re-opening them is re-litigating settled ground.**

**Status vocabulary:** `captured` → `researched` → `locked` → `built`.

⚠️ **Read this alongside `docs/REBUILD-SCOPE-multi-tenant-platform-2026-08-27.md`**, which records
that the rebuild target is a multi-tenant platform where users are independent of tenants, and French
Heritage is the first tenant rather than the product.

---

# G1 · CALENDAR SURFACE

## CR-01 · G1 · researched
**Said:** *"i still cant click on things in the month view and get them to open and keep me in the
month view. it should open a modal not take me to the week view."* · *"the dashboard shows the
weekview of whats on the schedule and again, clicking something should open the modal but it takes me
to the calendar."* · *"the booking provisioning and view is always a right side panel and it fucking
sucks we need a large modal in the center of the screen."*
**Found:** Three complaints, one cause — the item panel is part of the calendar page, so nothing else
can host it. It is already an overlay, simply pinned to the right edge and 448px wide for a
fifteen-field form.

## CR-02 · G1 · researched
**Said:** *"there is something booked for 12am which is a physical impossibility and i have no way to
open it because it only shows in the month view and its out of range in the week view."*
**Found:** One booking, midnight to 1pm. Unreachable for two reasons: the week grid draws only
business hours, and an item is placed by its start hour alone. The value itself is a 12 AM / 12 PM
slip, corroborated by an identical booking made the next day.

## CR-03 · G1 · researched
**Said:** *"the calendar still shows a full list of all the open slots in green blocks, we need to
remove this and just make the calendar open for booking by being empty … if something is booked on
the calendar in a specific slot it shows as unavailable to anyone not involved and for something that
doesnt have a specific time it just shows at the top of the day as an item being don[e] on that day,
when the item is confirmed it changes from orange to green and when its complete … it fades but
remains clickable and editable."*
**Found:** The green blocks are generated hourly by a job. **92% of everything in the bookings table
is that generated furniture.** Removing it also removes the thing the self-booking path books.

## CR-04 · G1 · researched
**Said:** *"the calendar bookings still show reserved instead of the client name and activity (week
and month view)."*
**Found:** The read already sends staff the full detail and already labels the row as staff — the
screen never looks at that label, so staff fall through to the same "Reserved" a stranger sees.

## CR-05 · G1 · researched
**Said:** *"the calendar still shows bookings as 30 minutes when they should show 90 minutes for an
evaluation lesson and 60 minutes for all other lessons."*
**Found:** The bookings are already an hour long. The calendar never looks at how long anything is and
draws every item the same size. **Nowhere in the system records how long a service takes.**

## CR-06 · G1 · captured
**Said:** *"the scheduling panel still has the three position toggle at the top … it needs to be
decommissioned, whatever its wired into and whatever controls it or whatever it controls all need to
be dissolved and reconfigured so we dont break anything that is working."*
**Found:** Two of its three positions have never been used. The third is how availability gets
published — which CR-03 removes.

## CR-07 · G1 · researched
**Said:** *"the time selection should be a dropdown list of the 30 minute increments a person can
choose and it should account for what is on the calendar and the duration of the booking."*
**Found:** Both start and end are free-form date-and-time boxes today, which is what allowed CR-02.

---

# G2 · BOOKING PROVISIONING

## CR-08 · G2 · researched
**Said:** *"we are being asked to select a product before we select the client and the inverse is the
right approach. we select a client, then we see what the client has available, if they are a weekly
rider or if they have credits we should see that"*
**Found:** The screen asks for the product first, and the code proves the order is backwards — the
client field's own label is decided by which product was picked. Nothing on the panel is narrowed by
who the client is; every offering and every horse in the system is offered on every booking.

## CR-09 · G2 · researched
**Said:** *"if they dont have a paid offering purchased that matches the selection … we generate that
offering by creating the scheduled booking. if they have that offering we see it and we are using
what they purchased."*
**Found:** Open question against CR-27 — when a booking creates an order, whether it is created in a
state that actually opens. An order that stays unopened is the live defect on Rachel Page's record.

## CR-10 · G2 · researched
**Said:** *"we only show horse care services for clients with a horse. if they dont have a horse in
the system that means we dont have the paperwork signed from them … we dont need to add any text to
the ui to explain this, its self evident … it should honor our rules not ignore them."*
**Found:** The rule already exists and is enforced when the booking is saved — a care booking is
refused without a horse and without that person's care paperwork for that horse. Only the screen
ignores it, so staff pick the service and hit the wall at the end. "Has a horse" is two different
relationships (owning and leasing). There is exactly one horse in the system.

## CR-11 · G2 · built
**Said:** *"the repeat weekly is weird … the primary selection is 'just once' which literally reads
repeat this one time."*
**Found:** Wording built. The underlying control is CR-12's.

## CR-12 · G2 · captured
**Said:** *"this is not the surface for setting a weekly lesson … the primary option is the client
card where they or us can set their weekly riding day and time which then appears automatically on
the calendar until its renewed at the end of the month for the next month. if we do want to repeat a
lesson it would be because they have credits or they intend on purchasing a punch card."*
**Found:** The standing-weekly machinery is already built — it is on a different screen. The
destination named here is the client surface CR-30 and CR-75 replace.

## CR-13 · G2 · captured
**Said:** *"the trainer is always claire there is no need to select a trainer when a lesson or any
other service is scheduled."*
**Found:** The field is already skipped far more often than used, and skipping it loses who taught the
lesson entirely.

## CR-14 · G2 · captured
**Said:** *"for the horse section we should be able to write in the name of a horse and claim it later
for a horse record. right now its either select from the list or no horse lol"* · *"the unclaimed
horse name gets claimed when a horse is being added to an account. you can pick it from a list of
horses (which should only show the names of horses that arent assigned to someone, and to prevent a
horse getting locked to a person automatically, i need to be able to change the owner from the horse
record)"* · *"likewise i can select the owner of a horse record that lives as a name only"*
**Found:** Two of the three already exist — changing a horse's owner from the horse record, and
resolving an owner who is only a name. Ownership is kept as history, so a horse is never locked to
anyone. Not built: no list is filtered to unclaimed horses, and a booking has nowhere to put a horse
name that is not yet a record.

---

# G3 · CLAIRE'S DAY

## CR-21 · G3 · captured
**Said:** *"the in app notifcation isnt needed if we have a static daily view for claire with a next
up card and the daily view should advance as the day progresses so shes not looking at a card that
shows the day ahead and seeing things that already happened, those belong on a separate list further
down the page so she can click on them to add notes or do something to the lesson or scheduled
activity like horse care service or task like giving a horse its supplements or medicine or
contacting the vet."*
**Found:** A "today" list already exists on her dashboard. Missing is the shape — a next-up card,
items leaving the forward list as they pass, and a separate list below for what is done.

## CR-22 · G3 · captured
**Said:** *"Each of these items also needs to have a way for her to record the status as complete,
skipped, no-show (when the client doesnt show up or the horse isnt available), things like cancelled
or rescheduled are self explanatory and we can record them in the log for that item so we know when we
look at a future booking that it was actually something that was rescheduled or when we look back at
an item we see it was cancelled, the client didnt show, the horse wasnt there or was unavailable, or
the booking was rescheduled."*
**Found:** "Complete" and "no-show" already exist in the system's vocabulary and have never been used.
Only "skipped" is genuinely missing. A history log used by other record types exists that bookings
are not yet part of.

## CR-23 · G3 · captured
**Said:** *"whether a task is a booking row or a day is determined by claire which is informed by the
requirements setforth by the client in the offering purchase conversation … this is where we can
either add that capability to certain purchases or contracts capturing it can use the right tokens and
structured fields so that the information can be utilized rather than just read by the contract
parties."*
**Said (correction, same day):** *"we dont have an offering in horse care that involves giving
supplements or medication … it cant hurt to have it in writing but it would be in a notes field and
only AI can make use of that and AI is a v2 platform feature."*
**Found:** Timed-versus-all-day is her judgement, not something to derive. The contract system can
already capture structured information — including a medication schedule and a weekly day grid — but
everything reading it only turns it back into document wording. The medication field generates
nothing. The one structured field with a purchaser behind it is the lease's reserved weekly days.

---

# G4 · NOTIFICATIONS & EMAIL

## CR-24 · G4 · researched
**Said:** *"the new email system for notifications about upcoming lessons is working but its doing too
much, we need a daily email at 7am with the days rundown sent to hello@fhequestrian.com and a client
email at 9am (or 1 hour prior to their scheduled time if their scheduled booking is earlier than 10am)
and then a reminder email 1 hour prior for the client and hello@fhequestrian.com"* · *"just make it
fire off at 1 hour prior based on every hour and give extra time always so it sends it 1.5 hours prior
instead of 30 min prior."* · *"clients get 1 email"* · *"tenant timezone is a good point, all activity
is rooted in pst, Los [A]ngeles."*
**Found:** The reminder job runs and works; it sends on the two-hour mark as well as the one-hour mark,
and emails each alert the moment it appears rather than at a chosen time. The barn's timezone is
written into the code rather than kept as a setting. The email cadence work shipped 2026-08-26 —
calendar emails are down to two, with admin@ receiving neither.

## CR-25 · G4 · captured
**Said:** *"it appears she placed an order, thats great, i didnt notice any big notification, no email
alert, nothing, telling me we got an order for a monthly subscriber riding weekly 2x."*
**Found:** Two reasons. There is no "an order was placed" alert in the system at all — nothing failed,
nothing exists. And her order was never opened, so the paperwork and credits that normally follow an
order did not happen. Separately: the lead alert did reach him, but only 2 of 12 such alerts have ever
been emailed.

## CR-26 · G4 · captured
**Said:** *"we need to surface a payment notification sent to the client 3 days prior to the end of the
month and then we surface payment notifications to us when they say they paid so we know to check and
we need to surface a list of monthly riders who owe payments reminding us to monitor for their payment
… the riders are informed automatically 3 days prior that payment is due within the next 3 days and
then on the day its due we send them another email and for both of these we surface a notification
starting at the 3 day mark and it counts down to your payment is due today and it extends into your
payment is past due by and it counts the days."*
**Found:** The client's "I have paid" declaration already exists end to end — surfacing it to Claire is
a surfacing job, not a build. Nothing else here exists.

## CR-78 · G4 · captured
**Said:** *"for pamela she will sign and then she will see and sign her docs but her email will only be
the docs it wont include the contract because she cant get that until i sign … she is most likely to
sign after adding the info and i will get a notification (i should get a notification when the document
is signable, meaning all fields have been completed, and likely another email when they sign) telling
me to sign it."*
**Found:** Two distinct events are being asked for — *signable* (the last required field is filled,
which involves no signature at all) and *signed*. Nothing fires on "the last blocker cleared";
`contract_lock_blockers` is a read and nothing watches it. The execution-time bundle is the only
confirmed send on this path. His stated ordering constraint — that Pamela's own send carries her
documents but not the contract — is his assumption and has not been confirmed.

---

# G5 · BILLING & PRICING

## CR-28 · G5 · researched
**Said:** *"we say we need 30 days notice for cancellation and we collect payment every month the day
prior to the start of the next month, so we need to set it to fill out the month ahead when payment is
confirmed … until their payment is confirmed their scheduled lessons appear on the calendar only as
pending payment not reserved, when we confirm payment their lessons switch to confirmed and reserved
and if they want to change their lesson schedule while its sitting in pending this is ok, but not when
payment is past due."*
**Found:** "Pending payment" and "confirmed" already exist as booking states and have never been used.
The screen currently promises something untrue — it says the weekly plan is put on the calendar for the
next three months, and no such thing happens anywhere. Nothing records what period a client has paid
through.

## CR-29 · G5 · researched
**Said:** *"the rule about Evaluation lesson being the first thing they buy, when they combine something
like a weekly riding subscription, we should be increasing the price of the first month by $20 and then
changing the price of the evaluation lesson to show it as included with their first month"* · *"we
should offer 3 payment options for the weekly riders … a weekly payment of $260 /week, a bi-weekly
payment of $480, and a monthly payment of $880 … For their willingness to pay for the month up front
they get a discount."*
**Found:** The three prices are internally consistent — paying more often costs more at every step. The
system can only hold one price per service; there is no concept of paying weekly versus monthly for the
same thing. The evaluation rule reads as "+$20" and lands as $150 off the à-la-carte total. There are
four weekly plans on sale and he gave one price ladder.

## CR-38 · G5 · captured
**Said:** *"we didnt make it possible for anyone to set a quantity for the horse care services that are
weekly."*
**Found:** Not yet researched. Open: for a weekly service, whether quantity means visits per week or
weeks bought — two different numbers the system may already conflate.

## CR-39 · G5 · captured
**Said:** *"we need a system for comping an offering or an order (this records a loss for the buisness
and give the client a free credit instead of just marking it paid which records revenue and they dont
see they got something free when they look back at an offering or an order)."*
**Found:** Not yet researched. Three distinct requirements in one sentence: a comp is not a payment; a
comp records a loss; the client must see they were given something free. Open and material: whether
comps have been recorded as "paid" to date, which would mean the revenue figures are already wrong.

## CR-40 · G5 · captured
**Said:** *"we need a discount capability … discounts are a standard in the business world and we have
no way to add one to an order."*
**Found:** Not yet researched. Open: whether an order line can hold a price different from the
offering's price today — if not, discounting, comping and price-overriding are one missing mechanism.

## CR-41 · G5 · captured
**Said:** *"we need to publish our standard rates, those should be high enough to demonstrate our
quality of services and relative market position."*
**Found:** Not yet researched. Bears on CR-29's finding that one service cannot hold three cadence
prices.

## CR-42 · G5 · captured
**Said:** *"nor a way to send out an incentive to someone or to everyone with a redeemable item in it."*
**Found:** Not yet researched. The gift path already issues something redeemable to someone who did not
buy it.

## CR-16 · G7/G5 · captured
**Said:** *"we need to be able to change the offering they ordered... i dont see any way to do that
here."*
**Found:** Cancelling a line is possible; adding one to an existing order is not — the only "add" makes
a second, separate order. Three questions block the build: whether price follows the new offering or the
agreed amount is held; what happens on an already-paid order; and what happens to a weekly plan's chosen
days and any month already on the calendar.
**Owner ruling (2026-08-25):** asked whether the same surface needs quantity, comping, discounting,
voiding, marking paid and cadence — *"the short answer is yes."* So this is the line-item editing model,
specified across CR-38 to CR-42, not a single button.

## CR-60 · G5 · captured
**Said:** *"their booking notification and on calendar both change from awaiting payment, to payment
pending, to paid status based on approval of the order, clicking the payment option on the payment
modal, and verification of payment by an admin."*
**Found:** Three states, three triggers, across two surfaces that move together. CR-28 describes a
two-rung version of the same ladder; the vocabulary is unreconciled.

## CR-76 · G5/G6 · captured + researched
**Said:** *"do we need a 'My Payments' card on the account page and a 'My Payments' page that lists all
their payments? i think its more obvious than assuming that they can see and edit their payment on the
order itself from the my orders page or card...we need to see how a person can see and edit their
payment selection and information at present and decide how to proceed if changes are worth making."*
**Found:** A member can already see and change payment in two places — a "Manage payment" modal on an
unpaid order (method, and transferring who pays), and the order's own panel (declaring Zelle or cash
with a reference). It appears on unpaid orders only, so a member has no way to look back at what they
paid. **Two live faults measured:** the Manage-payment dropdown offers `['Zelle','Check','Cash','Card']`
while the declaration path only ever offers zelle or cash, and production holds only `zelle` (5), `cash`
(1) and blank (2) — so two of four choices lead nowhere. And the dropdown writes capitalised `'Zelle'`
while the declaration path writes lowercase `'zelle'`, which is what every production row holds.
**Owner ruling (2026-08-25):** build the My Payments card and page; consolidate the two existing
surfaces — *"we strip the more complicated one unless it has genuinely more information to display, then
we keep both"*; and a pending payment is client-editable, because *"a zelle never sent needs to be
switched to cash by someone if they changed their mind and we wont mark it as paid until we see the
zelle anyway, so might as well give them the power to change it so we dont have to."* On what a client
may change: *"thats it there are only two choices for payment"* — the method, and nothing else. On what
pending means: *"pending is used when they declared they made or will make the payment once they select
their choice from the payment screen. until they make a selection its awaiting payment. and when we
verify payment was received its marked paid."*

## CR-76b · G5 · 🔒 LOCKED
**Said:** *"My Payments is a history ledger showing every time a payment page was engaged with and what
it saved and what its assocaited with, when it was done, all the changes made if any exist, and the
fuller picture of the status and timestamps. each entry is linked to some type of transaction, as of now
that can only be an order, so we would create a payment number along side an order number and the
entries would show the meta data for things like when the order was submitted, when it was approved,
when payment was submitted, when it was marked paid, what payment method was used, and if there were any
issues. from this entry the link to the order should be clickable to open the orders history page and
scroll to that order number and expand it."*
**Said (same exchange):** *"yes we need to have a payment number as an identifier that is unique to each
input on the payment screen."*
**Found:** The ledger table (`status_events`), the vocabulary (20 defined terms for `order`, including
payment method and issue terms) and the order number (`purchases.display_code`) all already exist. A
payment number does not. **Coverage is almost nil:** across eight live orders, seven carry exactly one
event and one carries two. **And a data fault: 39 order events on 16 entity ids match no purchase that
exists** — `status_events` is polymorphic and has no foreign key. Also: a payment cannot be split today —
`purchases.payment_method` is one text column on the order; `amount_paid` exists and `partial_payment` is
a defined term used zero times.
**Owner ruling:** locked. The page carries everything, not only what is outstanding. A payment number
per input on the payment screen — which makes the payment record its own entity and is the same build as
split payment.

---

# G6 · PEOPLE SURFACES

## CR-30 · G6 · captured, surface model settled ⚠️ supersedes CR-31 to CR-36
**Said:** *"the modal needs to be total thrown out as is and should be reimagined entirely and the
contact record page needs the same treatment and the modal design is a great layout for the contact
record page to inherit and build upon"*
**Said (on the change of mind):** *"as I was writing the change requests for it i thought i was giving
you the right set of requirements, then when i saw the page for pamela i realized i gave you the wrong
things to focus on."*
**Owner ruling (2026-08-25), the surface model:** *"A lead only needs to show me what they submitted and
then if i want to take action for them im promoting them to an account and it moves to client and becomes
a client record page and i see all the options as button tabs like the modal shows me now … i probably
have a cover page that i see for provisioning them for their first order and this is inherited from their
submission if there is one attached … and then i either save it … and im able to send the activation
link."* A sequence, not two peer surfaces: a lead is a submission and one button; a client gets the tab
set on a page; the provisioning cover page is the landing.
**Owner ruling — leads leave the Records page entirely:** *"We get rid of leads as a record tab from the
record page and they exist as a notification on the dashboard that when clicked opens the modal to show
us the submission and the buttons for handling it. and then based on how it is handled, it goes to the
appropriate location and remains visible from there as an entry … Their submission is retained and
becomes part of their client record visible on a surface that shows their account history[,] that would
be an appropriate replacement for an activity Log as a dedicated page."*
**Owner ruling — a fourth exit:** *"Yes I want a delete button. This is a hard delete with a block on
that submitter as optional."*
**Owner ruling — every record is a page:** *"every record is a page. [Modals] are for surfacing
information quickly, not information dense or operationally intensive surfaces … each record type
deserves its own unique page view at the layout[;] structure to be the same[,] we need uniformity. We
need globalization as much as possible, personalization is extremely important for making things fully
usable"* — ⚠️ refined the same day by CR-74, which is the settled version.
**Owner ruling — no shareable address:** *"I don't understand why we would ever do this … we would never
share a client record page. The client has their own surfaces to modify the fields we make available[ ]to
them. That information is then visible on the client record in the appropriate locations."* He embedded a
verification task in it: *"the one thing to check is if the information on the client record and the
information[ ]the user enters into their UI fields are the same resource."*
**Still open (his):** whether a marketing-zone or dungeon entry carries the submission; whether Account
History is a tab or a page; whether promote is purely internal until the activation link is sent.

## CR-31 · G6 · captured
**Said:** *"i have no way to add a horse to pamela godde's client record, i cant see anything about her
beyond what is shown on the main record page."*
**Found:** Pamela has no horses and no tags. The client surface has no horse-add; the lead surface has
one.

## CR-32 · G6 · captured
**Said:** *"the lead modal should be what i get when i click a client card and the client page is what i
should see when i click a lead card … the page is much better on desktop, the modal is for quick access
on a page you dont want to leave, for a lead, this would show me the form they submitted and give me a
quick access point to promote to a client record (activate them as an account), thats it. at most i can
modify their order contents before i do it"*
**Said (caveat):** *"i might be on the phone and the phone is my working device for modifying the lead
record"*
**Found:** Settled by CR-30. He floated a literal swap first and then described something else instead.

## CR-33 · G6 · captured
**Said:** *"why does a lead modal have more data fields and functionally work far better than the actual
client page we show after a lead becomes a client."*
**Found:** The client page is where the modal's parts came from — `ClientRecordActions` says so in its own
header — and it was never switched over to them.

## CR-34 · G6 · captured
**Said:** *"what i really need to see is their for[m] submission and contact information and contact
preference. two clicks and im either calling, texing or email and fully equipped with all the relevant
information i need to have a conversation with them."*
**Found:** Everything is already captured on the request row, including the contact preference. It never
reaches the contact record, so it is lost the moment they become a client.

## CR-35 · G6 · captured
**Said:** *"we should keep a snapshot of what they send us in the form and the changes should happen on
promotion to account, this way we can spot trends like upselling or people wanting more than they should
be requesting."*
**Found:** Nothing preserves it. The submitted text is editable in place and there is no audit table
anywhere in this database.
**Still open (his):** whether to snapshot the whole submission or only what they asked to buy, and whether
the difference is visible on the record or only in reporting.

## CR-36 · G6 · built
**Said:** *"keep it one size dont change it based on the contents when i switch tabs it is constantly
resizing and it stays center aligned which makes it really uncomfortable … keep it the full size and keep
it locked in the center of the screen."*
**Found:** Built, on the surface CR-30 discards.

## CR-43 · G6/G8 · captured ⚠️ owner is split
**Said:** *"I'm split on whether we open the door to full account creation with activation email from an
order which right now ends at the lead stage, im inclined to do it and just implement hcaptcha to protect
against spam account creation … it wont eliminate the need for the internal pathways and processess but it
will substantially reduce how many people show up as a lead and then need to wait for me to send them a
link, the first contact still shows up as a lead but they are a lead with an account and the only reason
this is important, is that it gates their app access to not show community until they are accepted as a
client."*
**A/B, his own:** (A) keep it as it is — a public order ends at the lead stage. (B) a public order creates
the account and sends activation, protected by hCaptcha. **He leans B. Not locked.**
**Found:** The self-service signing links already create a full account from a public page with no human in
the loop, so B is a second entrance to an unlocked door. B contradicts a ruling he set the day before —
*"Every account holder gets the community feed … gated by ACCOUNT, never by having bought something"* — and
the guard was deleted to make that true, so a lead with an account would see community immediately. App
access is already decided by membership status, not by account existence. And *"until they are accepted as
a client"* is a state change nothing in the system can currently make (CR-27).

## CR-44 · G6 · captured
**Said:** *"a person submits a contact form or an order form. we get a lead card that (currently doesnt
show us what they sent) will show us what they sent us and give us quick access to the contact information
from a phone or computer so we can reach out to them, and it give us the choice of how to handle the lead;
make them a client with an order and a scheduled booking, leave them as a marketable lead and send them to
the marketing page, or cancel the lead designation so it doesnt count in our conversion calculations and
send them to the dungeon never to be contacted again."*
**Found:** A conversion calculation does exist and is on the dashboard today — *"11 of 16 inquiries became
clients (90 days)"*, alongside *"10 NEW CLIENTS THIS MONTH"*. The marketing zone does not exist in the app.
CR-30's delete exit makes four, and a hard delete plus an optional block requires something to match on
surviving the deletion.

## CR-45 · G6 · captured
**Said:** *"the issue that claire was worried about is when a person isnt the right fit then they are in
our system and they arent a client and we need to make sure we have a way to mark client records
appropriately … either a designated future opportunity that we use the notes to know when and why and how
to contact them or they are designated a permanent non opportunity and we basically block the pursuit of
that person from ever happening but we dont block them from coming back to try again later if the thing
that made them not a fit changes … leads that we may market to in the future go into a marketing zone that
doesnt exist yet in the app, and the ones that we wont market to go into another zone in the app that is
essentially the dungeon and we can go in there if we need to but we dont want to look at it every day."*
**Said (the key distinction):** *"the promotion to account holder is not in and of itself an issue, the
payment and booking and client designation is the issue because its a lot to unwind and a lot [of] emails
and notifications are build off of those things triggering them and it leaves the door open to bloat,
confusion, frustration, and undue notifications or the surfacing of illegitimate data like client headcount
that includes people who were not the right fit and never bought from us."*
**Still open (his):** what a new submission from a dungeoned contact should look like; whether a returning
marketable lead arrives flagged with earlier notes; whether the three exits apply to Partners and Vendors.

## CR-46 · G6 · captured
**Said:** *"if i want to create a client record from scratch, i click the button to add a client and then
add the information about them (including adding a horse or a contract or deal), then select their offering
if one should be added to create an order, then confirm or adjust the documents they need to complete and
when applicable like with a deal party account i select when they sign or if they sign them partly based on
if there is an order created and based on the offerings in it the paperwork is selected and i can designate
when they sign it relative to the contract/deal they are part of, and then i either save it (not finished
and ready to send) or send it."*
**Found:** The order of the cover page in his own words: person → horse/contract/deal → offering → order →
documents → when they sign → save or send. "When they sign" is a per-document choice, and the disposition
concept already exists in part.

## CR-47 · G6/G8 · captured
**Said:** *"either way they are now an active account and they just dont have access to the app or their
records until they click the link so the send itself doesnt do anything, the completion of the first sign in
from the clicking of the link is what claims the account and makes it accessible. somewhere in there we need
to identify the exact triggers that set status as draft or active, and tag their account properly for
rider/owner/deal party/[visitor]."*
**Found:** He assigned the enumeration as research rather than asking for it. Not yet produced: every trigger
that sets an account draft or active, every place that reads it, where the tag is set and whether it is
derived or written, and whether anything confuses *sent* with *active*.

## CR-48 · ALL · captured
**Said:** *"i prefer the word visitor over guest, guest is a bit too ambiguous as to what it means in context
of our business, visitor is clearer, it should read to anyone that they are someone who visited us
physically."*
**Found:** Touches UI copy, tag values, document requirement rows, sign-path names and template wording.
Displayed words and stored values are different problems — changing a stored value is a migration with
readers.

## CR-49 · G6/G8 · captured
**Said:** *"it would be the same shape as the hidden url /sign/* pathway, except the form is different and the
only thing they see when they sign in the first time since they are a lead is their order with the form they
submitted and the catalog where they can edit their order by changing things, adding things, or removing
things...they can even cancel it so we know not to put too much effort into contacting them and not worry if
they dont respond to us..."*
**Found:** That door already exists and already creates accounts, so this is a variant of a built pathway.
**Still open (his):** whether a lead's edit to their own order needs review, and whether cancelling removes
them from the lead list or marks them cancelled and visible.

## CR-50 · G6/G8 · captured
**Said:** *"set a condition that if has_account=true and is_lead=true and is_client=false no access to
community, no access to most of the app pages or settings until is_account=true and is_lead=true and
is_client=true"*
**Owner ruling on scope (2026-08-25):** *"no its much more than they should see. they only see their order,
the catalog, their personal profile information...."* and on settings: *"so they can change their name their
email their login, etc...preferences dont show, and the other sections and pages dont show."*
**Found:** App access is already decided by a single membership status, not by account existence — an inactive
member already gets nothing. Community is currently open to every account, under a ruling of 2026-08-24; that
ruling and this condition cannot both stand as written. The existing per-page visibility mechanism is the wrong
lever — it grants far more than a lead should have. Three booleans can express states that cannot exist.
⚠️ Superseded in detail by CR-53 and CR-62.

## CR-51 · G6/G7 · captured
**Said:** *"yea its all one catalog, the gate on evaluation and horse care being order able or required is
based on having a previous qualifying order or having a horse in the system right? so we dont gate them
explicitly when they order horse care services but if they self activate we ask for their horse information
when they sign in so we complete the loop and if they dont have a horse then there is a bit of an issue that
we know going into the call or text exchange..."*
**Found:** One correction to his premise — the existing rule is not "a previous qualifying order or a horse in
the system." A horse-care booking is refused unless there is a horse **and** that person holds the care
paperwork for that horse. This is a different philosophy from CR-10, and the two are unreconciled.

## CR-52 · G6/G8 · captured
**Said:** *"there is an error page that says the account is in the process of being activated. I just hit it
when i entered a valid email address and the wrong password but the email address and password combo match but
the account was deleted. ive seen people land on this page when they go straight to
frenchheritageequestrian.com/app too. it needs to redirect to the login page and if it cant provide a valid
useful accurate error message, it shouldnt display anything, but the current page i want deleted and thats
because there is no such thing as an account being in the process of being activated, so its an outright lie
that harms us and the user."*
**Found:** Two routes in are reported — a sign-in attempt, and going straight to `/app` with no session. The
second is the common case. Not yet established: what "deleted" means for an account whose credentials still
authenticate.

## CR-53 · G6 · captured ⚠️ supersedes CR-50's allowlist
**Said:** *"what a person should have access to as a lead is the dashboard and it shows their order as pending,
and a notification to complete their profile, clicking on these open their expanded cards in the account page a
back button in the top left area of the page takes them back to the dashboard. The nav only shows Dashboard,
Catalog, Account, and Sign out. In the Catalog selecting an item gives them the option to add it to their
existing pending order or create a second sperate order. They should have the ability to cancel or modify the
order from the modal that should open when they click on an order inside the expanded orders card on the account
page. their view of the account page should be restricted to show only these cards: my profile, my stable, my
login, my orders, my gifts."*
**Found:** Card order is superseded by CR-62. `My Stable` and `My Gifts` being present for a lead is wider than
the first sketch of a lead's app.

## CR-54 · G7 · captured ⚠️ he asked for the cause before the fix
**Said:** *"the documents card that opens shows me the same set of documents twice, and they are listed as cards
with one set showing read and resend and the other showing read, pdf, and resend … they are the same docs btw"*
· *"Investigate to verify the cause of showing both sets of docs … and then if it was from the doc changes we
made or my refreshing the page or using the back button after signing the last one, then fix the issue there, if
its coded that way remove the duplicate"*
**Found (screenshots, 2026-08-25):** The two sets are not identical renderings. Set A shows *"You sign as
client."* + *"✓ You've signed this document."* with `Read · Download signed PDF · Resend`; Set B shows *"✓ Signed
· 8/24/2026"* with `Read · Resend`, and the two are in different orders. **Set A knows the role; set B knows the
signed date; neither knows both** — which points at two components reading two shapes rather than rows inserted
twice.

## CR-55 · G7 · captured ⚠️ A/B, his own fallback
**Said:** *"the read button opens a really funky view that turns a 4 page doc into 7 and a lot of titles left at
the pagebreaks, so we remove that option and use only a pdf view … a frameless set of scrollable pages with gaps
between them which is what it should be and then from that they have the option on the screen in the top right
corner to download."*
**Said (fallback, same breath):** *"if this is too much work or potential for error dont do it and just keep the
download pdf button as the way to download a copy of the document."*
**A/B:** (A) build the frameless PDF overlay with a download control. (B) no viewer at all; download-pdf is the
only way. **B is explicitly acceptable. Neither is chosen.**
**Found:** The on-screen reader repeats a page-break defect already fixed in the PDF renderer, in a second,
separate viewer.

## CR-56 · G7 · captured
**Said:** *"remove the text that says 'contracts you've signed'."*

## CR-57 · G9 · captured ⚠️ asked before and dropped
**Said:** *"ive asked for this to be implemented before but it looks like the thread dropped the ball on it, i
want the cards that are clicked and expand to show the content below them to themselves expand to the width of
the container and the arrow should be a down arrow when its collapsed and an up arrow when its expanded."*
**Said (CR-57a, desktop):** *"on the desktop version since the card is half the width and it will expand to twice
the width … keep the right facing arrow on collapsed state and … when its open it should show the up arrow … the
switch to an expanded state should look like a stretching animation smoothly and at a comfortable speed not an
instant switch from 50% wide to 100% wide."*
**Said (CR-57b, mobile):** *"on mobile all of this is moot, but the arrows need to be the down arrow on closed and
up arrow on opened."*
**Found:** The rule is that the arrow points at what the next click does, not at the current state — which is why
the glyph differs by platform while the rule does not. Mobile is confirmed single-column below 1024px. The rule
was written for one level of expansion; CR-75 needs it to hold at three.

## CR-58 · G9 · captured
**Said:** *"One thing i noticed on the stable card, add a horse is a nice button band then the other two sections
use brown text with a +, no button, i like the look of the non button version, so the Add a horse button should be
replaced with a + Add a Horse in brown to match the other two (Gear and Supplies)."*
**Found:** Three sections on one card already disagree. This may contradict CR-15, where he asked for the
offerings add-control to be *"an outline that holds space for a new line item … an unfilled button … square"* —
two different answers for "how do you add a thing", possibly genuinely different cases (a line on an order versus a
record in a list).

## CR-59 · G6/G8 · captured
**Said:** *"the lead should be contacted and when the admin promotes to client by approving their order and
optionally scheduling their first lesson, the view of the app shows them the app tour modal and then when they
close that they are at the dashboard again and see whatever it should show for a new order without payment and a
new booking that is confirmed by admin (when there is one). they should be prompted to click on a button that says
make payment and it opens the payment page as a modal … Their nav now contains all the pages and if they didnt
update their profile that notification is still there on the dashboard, also on the dashboard is the documents to
sign and if they click on the button on the notification to click to sign they are taken to the intake form that
captures the remaining missing data fields and then sequentially sign the documents and upon conclusion they exit
straight back to the dashboard the notification about the documents is gone, when we verify payment and mark their
order paid that notification goes away"*
**Found:** Approving the order is the promotion — CR-27's missing approval, named. The intake form is part of the
signing path, not a separate errand.

## CR-61 · G9 · captured
**Said:** *"If the user uploads a picture to their profile they should have a toggle in the preferences section to
show the letter or photo in the actual avatar on the header, anywhere they post, any lessons they book, anything
any other user or admin sees that they personally did or are associated with their image file should be used and
where possible, their name but never the avatar its too ambiguous."*
**Found:** The rule is about the audience, not the surface — the toggle governs only their own header; everyone
else always sees the photo and, where possible, the name. Collides with CR-50, which says a lead's preferences do
not show.

## CR-62 · G6 · captured ⚠️ supersedes CR-53's card order
**Said:** *"lets change my list order for mobile layout on the lead only view of the cards on the account page to:
my profile, my stable, my orders, my gifts, my login. on desktop my profile goes on the left in row 1, my stable
goes on the right in row 1, my orders goes on the left in row 2, my gifts goes on the right in row 2, and my login
goes on the left in row 3. When their Lead designation is promoted to Client, they are granted the extra cards and
the list becomes: profile, stable, orders, gifts, lessons, preferences, posts, saved items, documents, files,
login."*
**Found:** One list drives both layouts — same sequence read left-to-right then down, so it is a column count and
not a second ordering. Promotion inserts six cards into the middle; the lead's world is a prefix of the client's.

## CR-63 · G6 · captured ⚠️ he asked for a recommendation, being unable to test it
**Said:** *"i want your take on it since there arent items for me to test this with because the abby account doesnt
have things in places like lessons or orders. I noticed the nav item for my lessons opens a dedicated page whereas
the my lessons card in account expands to show something. why is there a difference? do we need it shown in both
places? if so should they have the same functionality (ie: one uniform surface two locations to get to it? should
we remove my documents from the nav and replace it with my orders? seems like orders is a recurring thing and docs
are one time maybe two possibly 3 lifetime total so they would want to see orders frequently and documents rarely
if ever..."*
**Found:** CR-66 bears directly on it — the design intent was that the person chooses what the menu shows, so the
premise that we pick is itself in question. Documents are rare but urgent, and an unsigned one is blocking, which
CR-59 already places on the dashboard as a notification.

## CR-64 · G6/G8 · captured ⚠️ second page asserting a false state
**Said:** *"on the abby account, the dashboard notification that says book your evaluation lesson takes me to the
last page of onboarding and shows me 'nothing to do here. you're all squared away -- theres no onboarding waiting
on you. and a big button to go back to your dashboard'...this is another painful example of a page that should never
exist and its a liar. there is something to do, book an evaluation lesson … if it didnt exist where would i go?
simple, dashboard if notifications are present, community feed otherwise. and the broken link on the current
notification needs to be investigated and determined to be a bug that is due to my account being in the state it was
in when the changes were implemented to the flow or its a true bug and it needs to be fixed because other people will
be affected by it..."*
**Said (same day):** *"there is a big button that says back to your dashboard on a page im taken to … and the best
part of all of this is when i click the back to your dashboard button, it takes me to the community feed! lmfao"*
**Found:** Three falsehoods on one page, and the landing rule he gives is the exact inverse of what the page does.
Two routes in are known: the notification link, and the end of the document-signing flow — which CR-59 says should
exit straight back to the dashboard. Asked whether other such pages existed he said *"not that I can remember right
now"* and found one within the hour.
**Owner ruling — the landing rule:** *"dashboard if notifications are present, community feed otherwise."* This
settles a previously recorded contradiction; the profile prompt is itself a notification (CR-59), so a member owing
profile details still lands on the dashboard.

## CR-65 · G9 · ⚠️ owner-assigned sweep
**Said:** *"i dont know yet i havent used it so its worth you researching the flows and paths to see where the end
of a flow takes the user when its finished..."*
**Found:** Assigned as research rather than answered. The deliverable he specified is one table — flow · exit label ·
actual destination · correct destination — across document signing, onboarding, the self-service signing links, first
sign-in, the evaluation shop, payment declaration, booking, order placement, contract execution and invitation
acceptance. Not yet produced.

## CR-66 · G6 · captured
**Said:** *"we implemented two things and one never landed and the other apparently did, presence gating and on
first sign in a modal surfaces with toggles for the user to choose which things the menu shows and which are hidden
and then the preferences section has the same list with the same toggles. Neither of the toggle sets are
implemented. but the presence gating is in full effect."*
**Found:** Confirmed. Presence gating is live and working; the first-sign-in modal and the Preferences toggles never
landed. So the menu is decided for the person and cannot be decided by them. Open: what happens when presence says
"nothing here" and the toggle says "show it".

## CR-67 · G9 · captured
**Said:** *"on mobile the dashboard shows some primary data that the rest of the page scrolls under instead of it
scrolling so the dashboard is useless when there are these things visible and i dont know how to get rid of them
because they appear to be static elements."*
**Said (scope, clarified):** *"that was my phone and it doesnt have this type of layout so no it doesnt do that for
members but it does it on desktop for admin"*
**Found:** Not a mobile bug — the admin dashboard's layout at every screen size. The member dashboard is a different
layout and does not have the problem. The header also overlaps in the same screenshot. The KPI header was unpinned
2026-08-26.

## CR-74 · G9 · 🔒 RULING — the surface rule
**Said:** *"if i click on the horse records tab on the records page the list of horses as rows works really well as
cards, surfaces I can click on and quickly make changes, its bug free and works great … this exact card with click
to expand and editable surface is what we should show and use on the client record where the horse is shown. right
now it opens a full horse record page, im not sure if there is a difference and if there is there are bigger
decisions to make."*
**Owner ruling (2026-08-25):** *"modal and card are not the same. an expanded card with editable fields is perfectly
the right choice, dont take me to an editor page if im already looking at the thing i want to change. but dont use a
modal when there is enough information to take up a whole page. modals are sort of temporary views, they dont feel
like full rich content, and so we should use them when we need to see or do something quick without taking the person
away from the page they are on. Whereas an expanded card opens space on that page to show the content and if its full
width like it is on the horse records page its far superior to taking the user to a deeper page to show them the same
information."*
**Owner ruling (second correction, same day) — a modal CAN be the work:** *"a modal can be the work, if we ask a
person for payment with a notification we open notifications as modals for quick view and quick action items and
payment is exactly that, they click the notification, the modal opens[,] the[y] make their selections for payment and
click done and the modal closes and the notification should go away."*
**Found:** This replaces the earlier formulation *"card = summary and doorway, page = the work"*, and refines CR-30's
*"every record is a page"*, which was aimed at modals and still stands against them. One fault he named on the card
was fixed the same day — breed, colour and sex rendered as bare text boxes while editing.

## CR-75 · G6/G9 · captured ⚠️ revises CR-30's client half
**Said:** *"we can use the same thing for the client records. click the card and it opens to expand to fill the page
and show the full content. the only slight issue with this is on desktop its a grid of cards not rows and thats
superior because it shows more information in a denser but very readable way but its not alphabetized and even if it
was how it reads will be weird so im ok with switching to condensed rows with client names and clicking it expands
the row into a space that shows all the content we discussed having on a client records page … does the horse record
still use the same click to expand approach inside of the expanded space for the client record, i vote yes. but, does
a document do the same? this one needs to be tested, i vote yes, use this principle everywhere it works and see how it
plays out."*
**Said (on closing):** *"right now clicking the header of the card opens and closes and its obvious, easy, and works
well. clicking the highest level cards header will obviously close everything"* — and the close *"saves their work"*.
**Found:** He named the risk himself: *"the breaking point will be where we draw a line in the sand."* Mobile is
single-column below 1024px, so every level of expansion is the whole screen there. Collapsing is inherent to nesting;
committing edits on collapse is not, and is the part to build. He proposed a top-right close button and then withdrew
it, having found the card header already does the job.
**Still open (his, after testing):** where the line landed, and whether a document expands in place or is the point
where a page is right.

---

# G7 · ORDERS & PAPERWORK EDITING

## CR-15 · G7 · built
**Said:** *"the attach offering needs to be revised to '+ Add offerings' and the order should be the [f]irst thing on
the page not the last, and then the option to add an offering to the order lives under the line item for the offering
they selected … make it an outline that holds space for a new line item … remove the rounded square surounding … the
rounded corners on the outside with sharp corners on the elements inside looks weird."*
**Found:** Built, on the surface CR-30 discards.

## CR-17 · G7 · built
**Said:** *"why is this shown to me in the ui … 'The first lesson for anyone new … is an evaluation lesson' … the
evaluation being a requirement means it should be the only riding lesson option to select right now until i select it
nothing else can be added from that category. this is handled by software not by surfacing words i read and comply
with, also the notes like that are things that should be in the client facing content not things facing me as the
admin."*
**Found:** The customer-facing shop already worked this way; only the staff screen asked politely.

## CR-18 · G7 · built
**Said:** *"horsemanship should be shown below lessons, then horse training then exercise then clipping."*
**Found:** Built. Jumper training was not in his list and currently sits last.

## CR-19 · G7 · built
**Said:** *"the entire surface is a bit too large the items [c]an be an order form with line items i add and select
from a list on a menu not a giant list of everything with check boxes its a terrible waste of space and on mobile its
going to be a nightmare."*

## CR-20 · G7 · built ⚠️ A/B, neither formally chosen
**Said:** *"the same for the paperwork, we can preselect and make rows for the documents they should be signing but
that comes after the selection of offerings … just show a row with the menu to select a new document and the
placeholder selection says select a document to add it, and when i select something it becomes a row and the x is
there to delete it and the new empty selectable row appears below the one i just added and moves up when something is
deleted."*
**A/B:** (A) an X on each row plus a `+` button that adds an empty row revealing a dropdown. (B) a permanent trailing
menu row, no button. **B was built** because it is the one he elaborated. The separate Paperwork tab was not touched.

## CR-72 · G7 · captured + researched ⚠️ he asked for a recommendation
**Said:** *"explain to me what edit deal terms enables when its checked. also explain what suggest and propose do when
those are checked... these controls were a good idea at the time but i think we evolved past them and might want to
change or remove them based on what your research reveals about what they control and how wired up everything actually
is."*
**Found:** Four switches per party per document. *Can fill fields* (on by default) — fill the fields belonging to their
own role. *Can edit deal terms* (off by default) — edit the shared negotiated terms. *Can suggest changes* — propose,
staged not applied. *Can add a clause* — same staging. Two rules built around them: edit-deal-terms and suggest-changes
are mutually exclusive, and you cannot turn off edit-deal-terms for the last party who has it. Staff and the originator
bypass all four; nobody may make another party's elections. **Only two control rows exist in the entire system, both
identical. "Can suggest changes" has never been turned on, not once** — so the propose-and-review tier, which has the
most surface area, has never been exercised. The same flag lives in two tables and one is likely stale.
**Still open (his):** whether a counterparty has ever proposed a change rather than making one, and whether a lessee or
buyer should be able to change deal terms at all.

## CR-73 · G7 · captured + researched
**Said:** *"as the author (admin) its weird that the box for 'I have reviewed the horse information and it is accurate'
is shown. not just weird that im seeing it as im creating the contract for the first time, because i have no way to know
if its accurate, the data comes from the horse record and the horse record is either mine and i created it so i think
its accurate or its not mine and i dont know if its accurate...either way remove that entirely from the system it serves
no purpose."*
**Found:** **Confirmed on zero documents out of 68.** It is wired into the workflow-advance path and the contract lock
blockers, and there is a `reopen_horse_section` path. Nothing has ever been written to its two columns, so there is no
history to preserve. Not yet established: whether the lock blocker is conditional, and whether anything else reads the
confirmation.

## CR-77 · G7 · captured + researched
**Said:** *"we never signed a contract as the company yet but my understanding of how its designed and this is the way it
should work, when the lessor has entered their information i review it, they have signed it if i entered my information
already which as the author i have, and so im the last to sign, i open the document with their signature on it and i
scroll to the bottom and i need to do the same thing as them, type my full name and since im signing on behalf of the
company i have to include my title and then those fields are populated along with the digital signature being applied and
the final document is sent to both of us as a pdf."*
**Found:** His model and the build disagree. `LESSEE.ENTITY_SIGNER_NAME` / `_TITLE` are ordinary contract field
definitions in the SIGNATURES section, required, shown only when the party type is ENTITY — **and nothing in the codebase
writes them.** They are authoring fields that must be filled before the document can lock. Measured on the live lease,
`contract_lock_blockers` returns one blocker with three fields: signing individual name, signing individual title, and
*"Lessor prohibits the use of rider aids"* — the third is Pamela's own field. **Sending does not require locking:** a
counterparty fills their own fields in `in_review`, before any lock exists, so the sequence is send → she fills → then it
can lock → both sign. And `locked` does not mean sealed; it means ready to sign, which is what the UI already calls it.
**Still open (his):** whether capacity (name + title) should move to the signature act, and whether a counterparty-owned
field should block the lock at all.

## CR-79 · G7 · 🔒 answered and built 2026-08-26
**Said:** *"need a way to delete files. there are two test files from walk4 that i cant delete or even see i can only
download them, need a button to view and a method to select and delete"*
**Owner ruling:** *"staff and uploader, we already ruled on this, delete is soft delete unless its a sensitive file and
then i can hard delete from db"* and *"remove the url leave the object in the db unless i go in and hard delete it or if
you give the option to soft or hard delete from admin ui that is best."*
**Found:** Built. Remove tombstones the file row and its links and leaves the bytes, so restore is a straight untombstone;
delete permanently takes the object and names the count; deleted files are listable so a tombstone can be seen; view
renders images, video, audio and PDFs in place. The table never touches generated documents.

---

# G8 · THE REQUEST → ORDER SPINE

## CR-27 · G8 · 🔒 LOCKED 2026-08-25
**Said:** *"it doesnt appear the pending status is working properly and likely the approval process for a request isnt
working properly either"*
**Found:** Both are the same thing, and the steps were designed and never connected. **A request has ten possible stages
and every one ever created sits at the first. No part of the system can approve one.** Bookings have twelve possible
states and only four have ever been used. Rachel Page's order — the only one that came from a request — is still sitting
unopened, which is why she received no paperwork and no credits.
**Owner ruling — the order lifecycle:** *"the submission is a request to purchase, not an actual purchase, and the
approval to purchase is the order creation step. There's no point in creating an order that isn't gonna be paid and no
point in creating an order just to cancel it on our end by declining or denying them … We create the order by approving
the creation of the order[,] booking is a separate step. The user doesn't see and notice that we approved their purchase.
They see a notice that their order has been processed and they get a payment request … booking follows order creation
and, as previously discussed, payment is not part of the booking flow. It's part of the fulfillment requirement[;]
without payment, we do not fulfill … if they don't pay and they show up, we tell them they have to pay[;] if they don't
pay and don't show up, the order may be canceled. [T]he booking may be rescheduled on the customer side prior to payment,
they can cancel the order[;] after payment they can cancel the booking and they get a credit or they can reschedule the
booking based on our policies"*
**Owner ruling — which states:** *"We need all of the states that pertain to the options. I'm not sure what logic you were
using that says this because I listed the happy path statuses[,] those are the only ones we need"* — every state that
corresponds to a real option must exist.
**Owner ruling — three answers:** who may approve — *"Both"* (Claire and CJ). The eight stuck requests and Rachel's order —
*"Leave them."* Whether declined is the dungeon — *"No, they're separate. We don't[ ]decline, we just change or cancel the
request."*
**Locked validation criteria:** (1) Claire or CJ approving a request creates the order, and no other path does. (2) An
unapproved request has no order. (3) The client is told their order has been *processed* and receives a payment request;
the word *approved* appears nowhere they can see. (4) Booking is a separate act after order creation and can complete with
no payment recorded. (5) Payment blocks fulfilment, not booking. (6) Before payment the client can reschedule the booking
and cancel the order; after payment they can reschedule per policy, or cancel the booking and receive a credit. (7)
Non-payment is handled by people, never automatically. (8) A request is changed or cancelled — there is no "decline". (9)
No state in the vocabulary is left with nothing that can produce it. (10) The eight existing requests and Rachel Page's
order are untouched.

---

# HORSE RECORD

## CR-68 · G2/G9 · captured — the client-facing Add-a-Horse modal
**Said:** *"the add a horse modal for the client facing 'My Stable' card in Account page, shows two drop down selection
menus 'Barn' and 'Stall' but even though the sections are literally named Barn and Stall, there is a selection menu with
alternate choices Stable and Pen, neither of which can be selected. It also instructs to leave barn blank if outdoor, that
is dumb text and needs to be removed. the idea for stable or stall or pen or barn is that the key terms used can be
selected but we need an empty option for them to input their own title for what the location is called at the place their
horse is kept … but the placeholder text inside of the notes section needs to be changed so it says 'additional information
that will be helpful for finding your horse'. Trainer should have a selection menu and list claire as the first option,
then free text as a fall back, we as the company maintain the trainer list globally but if the user enters a trainers name
they can see that as an option to select from in the future. Apply this to t[he] care giver, groom, and 'other' on future
horses for this account only. Also, on the intake modal, accidentally clicking outside of it closes it and erases the
inputs. found that out the hard way."*
**68a — data loss.** Clicking outside the modal closes it and erases everything typed. **Confirmed on a second surface**
(the same modal reached from a contract), so it travels with the component. Step-2 counted **33 hand-rolled overlays** in
the app sharing the outside-click-to-close pattern; any of them containing a form has the same defect.
**68b — the location fields.** Fields labelled Barn and Stall offer Stable and Pen as choices, and neither can be selected.
Wanted: two fields, each picking a key term (barn · stable · stall · pen) or an empty option to type their own name, plus a
text entry. *"Leave barn blank if outdoor"* to be deleted.
**68c — the notes placeholder.** Change to exactly *"additional information that will be helpful for finding your horse"*.
**68d — people fields.** Trainer: a menu with Claire first, free text as fallback. The company maintains the list globally;
a name a user types becomes an option **for that account only**. Same for care giver, groom and "other".
**Found (68d):** This mechanism already exists and is half-built — a managed-options concept with a suggestions side, **33
values across three vocabularies, no editor anywhere, and the suggestions queue has no screen.** The new requirement is a
suggestion visible only to its author.

## CR-69 · G2/G7 · captured
**Said:** *"we removed the emergency euthanasia block from the intake form, this leads me to question if the intake form on
the client side under the account page is the same as the one on the onboarding flow and further if the one we made
accessible on the contracts is the same. if they are the same we need to see if the emergency euthanasia authorization block
is still showing on those, if it is it needs to be removed, this block needs to be removed from the intake form im filling
out on the account page as a user. and we need to add a photo upload block in its place"*
**Found:** Three places a horse intake form appears — the account page, the onboarding flow, and contracts. **The account
page and the contract surface are ONE component**, confirmed by the owner: *"i can confirm the contract modal for add a horse
is the same as the one the user sees from the account page, so the euthanasia block needs to be removed there."* **The block
is still showing on the account-page form and therefore on the contract path.** Whether the onboarding flow uses the same
component is not yet established. CR-68a's data-loss bug is confirmed on this surface too.

## CR-70 · G7/G9 · captured — the horse record page
**Said:** *"i need to be able to edit a horse after its in my stable and remove a horse record from my stable. Im looking at
the horse record page now after adding the horse and it appears to have those functions but i dont want to try removing, make
sure it works and that its double gated with a confirmation modal before action happens. On the horse record page it shows the
following tabs, record, documents, schedule, and activity. Documents is empty and there is no way to add anything, this could
be confused with files which would be considered documents, we previously split the two so that things authored in the system
are documents and things added via upload are files … we need to add an upload button for adding files to the documents tab,
we need to add a tab for photos and videos and the upload button on that page allows a user to add the content to the record
and then they can select from the availble content associated with this horse record when they create a post in the community
feed, also anything they post in the community feed should be able to be tagged with a horse from any of the members and the
content should appear in the horse record for that horse."*
**70a — edit and remove.** Both appear to exist. **He deliberately did not test remove.** To verify: that it works, and that
the destructive action is double-gated behind a confirmation modal.
**70b — documents vs files.** The split is already ruled: documents are authored in the system, files are uploaded. The
Documents tab is empty with no way to add anything. Which file types storage actually accepts is unresearched — the related
finding is no allowed types on the bucket and nine buckets with no size limit.
**70c — photos and videos.** A new tab with upload; community posts select from content already on the horse's record; any
post can be tagged with **any member's** horse; tagged content then appears in that horse's record. ⚠️ **Points three and four
together are a permission question** — anyone can tag anyone's horse, and doing so writes to that horse's record. Who may tag,
and whether an owner can remove a tag from their own horse, is undecided.

## CR-71 · G1/G2 · captured
**Said:** *"we need to add the ability for the horse record to hold the activity restrictions and limits, something like the
number of hours per day and per week and consecutive days and then this information controls the availability of the horse, we
can also make it so certain days the horse cant be used or the usage is day specific (ie: on tuesdays and thursdays the horse
can only be used 1 hour, other days the horse can be used 2 hours, and never more than 5 consecutive days, no jumping, no
trails, etc...)"*
**Found:** Three kinds of limit, behaving differently. **Volume** (hours per day/week, max consecutive days) is cumulative and
needs history to evaluate. **Kind** (no jumping, no trails) is categorical and evaluated against the offering. **Day-specific**
is a per-weekday schedule of volume limits. **Consecutive days is the hard one** — it requires looking backwards and forwards
across existing bookings, and can be broken retroactively, because cancelling a rest day can put a horse over its limit without
anyone touching that horse's booking. A horse time-conflict check already exists at booking. A lease already captures reserved
days of use as structured data (CR-23), so the two can contradict.
**Still open (his):** which wins when a lease reserves more than the horse's limit; whether limits are a hard block or a
staff-overridable warning; whether they apply to everything or only riding; and who sets them for a client-owned horse.

---

# G9 · GLOBALIZATION INVENTORY

## CR-37 · G9 · researched
**Said:** *"we will be implementing a globalization refactor when you and i are done fixing all these issues … im trying to get
as much of the ui and ux in the right standing ahead of the final evaluation pass of the repo so there is less guess work and
less ambiguous questions for me to answer."*
**Found (measured, not estimated):**
- **Pop-up panels:** 33 screens each build their own; 7 use the shared one that already exists. Between them, six background
  shades, three stacking levels, three ways of positioning.
- **Buttons:** the shared style is used on 112 screens; 48 hand-build the same green button; 29 do both.
- **Empty-state messages:** a shared one exists; 32 places write their own.
- **Rounded corners:** no agreed rule — six radii in use, while the shared form fields and buttons have no rounding at all.
- **The row list** (name, detail, remove) is hand-built on six screens, two of them that week.
**Still open (his):** whether the refactor sets the standard, or the fixes in G1–G8 set it as they land.

---

# CROSS-CUTTING DEPENDENCIES

| Dependency | Consequence if ignored |
|---|---|
| CR-30 → CR-12, CR-15, CR-20, CR-36 | four requests are built on, or aimed at, the surface being discarded |
| CR-75 revises CR-30 | the client half became an expanding row; the lead half is untouched |
| CR-03 ↔ CR-06 | each is the other's evidence; deciding them apart invalidates both |
| CR-05 → CR-07 | a clash-aware time picker needs durations to exist first |
| CR-03 → CR-07 | while generated slots exist, every hour looks busy and a clash check refuses everything |
| CR-27 → CR-09, CR-25, all of G5 | nothing can approve a request or open an order; the billing cycle has nothing to hang on |
| CR-29 → CR-28 | three cadences make every date in the billing cycle relative to the period |
| CR-41 → CR-29 | a public rate card and three cadence prices are the same pricing rebuild |
| CR-38…CR-42 → CR-16 | changing an offering is one case of line-item editing; build the model, not the button |
| CR-71 ↔ CR-23 | the lease says what a lessee may use; the horse record says what the horse can take — they can contradict |
| CR-71 → CR-03, CR-07 | horse limits are a second input to what the calendar may offer |
| CR-69 → CR-51, CR-68 | three requests hinge on whether the horse intake form is one component or several |
| CR-70c → feed media | tagging writes to another member's horse record — a permission question |
| CR-68a → G9 | outside-click-closes destroys unsaved input; 33 hand-rolled overlays share the pattern |
| CR-68d → lookup options | the propose-a-value mechanism exists, has no editor, and its queue has no screen |
| CR-66 → CR-63 | the nav question assumes we choose; the design says the person chooses |
| CR-67 → CR-32 | the phone is his working device, and the dashboard is unusable on it |
| CR-64 → CR-52 | second page asserting a false state; the sweep is a task, not a question |
| CR-64 → CR-59 | the signing flow's exit currently lands on the page CR-64 deletes |
| CR-59 → CR-27 | approving the order IS the promotion — the approval nothing can currently perform |
| CR-60 ↔ CR-28 | three rungs here, two there; the vocabulary must be reconciled before either is built |
| CR-61 ↔ CR-50 | the avatar toggle lives in preferences, which a lead cannot see |
| CR-53 → CR-50 | the four-item nav and five-card account page supersede the three-item allowlist |
| CR-62 → CR-53 | one ordered list drives both layouts; it supersedes CR-53's order |
| CR-55 ↔ PDF work | the on-screen reader repeats a defect already fixed in the PDF renderer |
| CR-51 ↔ CR-10 | one says hide horse services without a horse, the other says let them order and ask at sign-in |
| CR-50 → the community ruling | community-for-every-account and no-community-for-leads cannot both stand |
| CR-49 → CR-43, CR-45 | self-activation is only safe because the client designation is withheld |
| CR-45 → CR-43 | an account costs nothing; the CLIENT DESIGNATION triggers everything |
| CR-44, CR-45 → new zones | the marketing zone and the dungeon do not exist; both are surfaces, not flags |
| CR-43 → CR-27 | "accepted as a client" is a state change nothing can currently make |
| CR-76b → CR-27 | one payment entry must stitch a request row to a purchase row, because approval creates the order |
| CR-76b → CR-75 | the orders page opening on a number and expanding it IS the expanding-row pattern |
| CR-77 → CR-78 | the lock blocker is what makes the "it is your turn" notification meaningful |
| CR-78 ↔ SPEC-first-contact-flow | the one-email ruling covers the send at the START of her flow; this is the send at the END |
| G9 ← everything | each group's fix should carry its globalization, or the refactor inherits 34 pop-ups instead of 33 |

# ALREADY BUILT — carry the requirement, not the code
CR-11 · CR-15 · CR-17 · CR-18 · CR-19 · CR-20 · CR-36 — all on surfaces CR-30 may replace.
CR-79 — built 2026-08-26. CR-24's email half — shipped 2026-08-26. CR-67's KPI header — unpinned 2026-08-26.

# ALREADY EXISTS — do not rebuild
Complete / no-show / pending-payment / confirmed booking states · the "I have paid" declaration · the standing-weekly editor
(on a different screen) · changing a horse's owner · resolving a name-only owner · the horse-care paperwork rule (enforced,
ignored by the screen) · a today list on the dashboard · the customer-facing evaluation gate · the conversion calculation and
client headcount (both on the dashboard now) · the accept/reject/withdraw disposition on contract proposals (named `resolve`).
