# TASK CAREPATH — a horse care enquiry becomes an active, provisioned client

**This is the FIRST of the three funnel flows to be built.** The owner reviewed horse care and
acquisition on 2026-08-16 and ruled the horse-care funnel *"really good already"* through step 2.
The work is step 3 onward. Acquisition and lessons follow, then the blended versions.

**This task takes precedence over `TASK-THREEFORMS` for the horse-care funnel.** THREEFORMS
described one generic shape for all three; the owner has now specified this lane in detail. Build
what is here. Where the two disagree, this document wins.

⚠️ **`TASK-ASKRIGHT` RUNS FIRST.** Step 2's questions are wrong in production today — every
horse-care buyer is asked the exercise-service questions, so a clipping customer is asked how many
months of turnout support they need. `ASKRIGHT` makes the questions belong to the offering. **This
task does not touch what step 2 asks**; it owns the step tracker, the buttons, the modal, the submit
screen and everything after submission. If `ASKRIGHT` has not merged, stop and say so.

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** Not a Sonnet task: §C5 creates an
anonymously-reachable order path (a security boundary), and §C8–C10 require verifying a long
existing chain end to end rather than rebuilding it — the failure mode is a thread that reports
"done" for work it only assumed.

**HOW TO RUN THIS TASK — read before starting:**
- **Everything you need is in this file.** Verify the measurements in §WHAT WAS MEASURED against
  live code and the database before building on them — they were taken at `main = 0548e33` and this
  project's task docs have gone stale within hours.
- **Three decisions are gated on the owner** (§OWNER QUESTIONS, at the end). **Read them now, not
  after building.** Ask, then build the parts they gate.
- **Report to `docs/reports/TASK-CAREPATH-REPORT.md`. Commit your work; do NOT push. The
  orchestrator merges.**
- **Never self-report "done" without evidence.** Every DB claim is query output pasted into the
  report; every render claim is marked **NOT VERIFIED** with a numbered click-through checklist for
  the owner.
- **Do not spawn subagents for this build.** One thread, one task.

---

# THE OWNER'S FLOW, VERBATIM (2026-08-16)

> *"it asks the right questions in step 2, step 3 is where we need to update things. where it says
> 'this is all we need' and then takes them to a checkout page where we ask for more information is
> confusing for two reasons, first we ask for more information, and is on the 4th page so the step
> tracker is wrong there are 4 steps. we should remove the line that says its everything we need,
> and they should have two buttons, 'continue shopping' clicking that opens a modal that asks them
> which category they want to see and shows the three options (riding lessons, horse care services,
> acquisition services, and a back button and x in the corner to close the modal) clicking an option
> for one of the three categories takes them to that page. the other button is a revised wording of
> the continue button for submission, it should say 'continue to submit request'. the submit screen
> shows a form that we need to update. the form should collect their personal information only. On
> submission they are categorized as a lead, a horse owner, and an order is opened with the item(s)
> selected. We should see all of this on the lead page for this lead, we should also get all this
> information in an email. And the submitter should get an email with the information they sent us.
> (This includes the selections from step 2). On the staff side, when we open the lead from the ops
> or lead page we see their submission and order, we contact them and discuss their needs and order,
> we can select a date for the service if its a single item, or a day of the week if its a weekly
> item, or days of the week if its a weekly item with a quanity of 2 (indicated like the riding
> lesson weekly as 2x). Once we have it provisioned we send them the activation link via email and
> the lead is promoted to client and they get the link and when they click it they are taken through
> the activation flow where they set a password or use google oauth, they see their order
> information page with the booking information if we added it to the calendar and they click
> continue or they click a button that says 'notify staff this isnt correct' and it notifies us,
> either way they are taken to the screen where they add their horse's information and any other
> information we need to collect for a horse owner and then they complete their documents and then
> they see the app overview and then the details page for their ordered item(s) along with the
> booking information if we added it to the calendar is shown to them inside the app."*

---

# WHAT WAS MEASURED (main = `0548e33`, 2026-08-16 — VERIFY, then build)

## The step tracker is genuinely wrong
`src/pages/BookHorse.tsx:14` declares three steps. Step 2 renders the literal eyebrow
`"Step 3 of 3"` (line 169) and its Continue calls `navigate('/checkout')` (line 52). **There is a
fourth screen the tracker never admits to.** The owner is right, and the same defect is in
`BookSupport.tsx:193`.

## The line to remove
`BookHorse.tsx:202-205`:
> *"That's everything we need for now. We'll be in touch to confirm scheduling and discuss how your
> horse is doing."*

It is false the moment the next screen asks for name, email and phone.

## Why the checkout form reads as "more information" — worse than the owner said
`Checkout.tsx` is **riding-lesson shaped**. It asks a horse-care buyer:
- **"Riding experience (years)"** as a required-when-configured radio group (line 467)
- a notes box placeholded *"Where you are in your riding, what you are hoping for, any questions
  at all…"* (line 506)

So a horse owner booking daily care is asked how long they have been riding. **That is not merely
redundant — it is the wrong question for this buyer**, and it is the strongest argument for the
owner's ruling that this screen collect personal information ONLY.

## An anonymous visitor CANNOT open an order today — this is the real build work
`src/lib/api.ts:565` — `createDraftOrder` begins:
```
const { data: auth } = await supabase.auth.getUser();
if (!auth.user) throw new Error('Not authenticated');
```
It also stamps `buyer_user_id: auth.user.id` (NOT NULL-ish path) and calls `current_contact_id()`.
**A signed-out horse-care visitor has none of these.** The owner's requirement that submission
opens an order with the selected items therefore needs a definer-side path, not a call to this
function. ⚠️ **Do not relax `createDraftOrder`'s auth check to satisfy this** — that function is on
the authenticated purchase path and weakening it would expose order creation to anonymous callers.

## What already exists and MUST be reused
- **`submit_public_request`** (SECURITY DEFINER, via `submitRequest` in `api.ts:62`) — the one
  intake RPC all three public paths already use. It accepts `p_category`, `p_channel`,
  `p_selections` (offering_id / slug / label) and `p_details` (jsonb). **The step-2 qualifier
  answers and the selections both already have a home here.**
- **`alertOpsInbox`** — fires `/api/request-received` on EVERY `submitRequest` call, writing a
  `request_alert_sends` row per attempt. This is the staff email. **It is already wired; prove it
  fires for this path rather than adding a second sender.**
- **`provision_client_invitation(p_request_id => …)`** — turns a request into an account and issues
  the activation link. **This is the seam the promotion step turns on.**
- **`QualifierGroup`**, `ServiceSelector`, `SelectionBar` — all live and correct.
- The **activation → onboarding → documents → app overview** chain was built by `ONBOARD` and is
  live. **Verify it end to end; do not rebuild it.**
- A **horse-owner directory concept already exists** —
  `supabase/migrations/20260719141000_directory_horse_owner.sql`. **Find how horse-owner status is
  actually represented before inventing a flag.**

---

# THE BUILD

## C1 — THREE steps, and the tracker tells the truth

**Owner, 2026-08-16:** *"the questions page is an insert in between the selection and the submission
with the form"* and *"the form page is always the submission page."*

**There is no separate Review screen.** It is absorbed into the submission page.

| step | horse care | lessons |
|---|---|---|
| 1 | Select Services | Select |
| 2 | **Tell Us More** — the questions (`ASKRIGHT`) | — *(no questions)* |
| 3 | **Your Details** — the submission page: selections, Continue Shopping, the form, the `inquiryLabel()` submit | step **2** for lessons |

- `STEPS` becomes **three**: **Select Services · Tell Us More · Your Details**, with eyebrows
  `Step 1 of 3` … `Step 3 of 3`.
- ⚠️ **The count is not fixed — it is derived.** The questions page appears only when something in
  the cart has questions (`ASKRIGHT` §A0), so a cart with no question sets shows **two** steps.
  **Do not hardcode 3.** The tracker must count the pages that will actually be shown.
- **Keep the submission page in-page rather than sending them to `/checkout`** — the cart,
  selections and answers already live in `CartContext`, and `/checkout` carries lesson-specific
  fields this buyer must not see. **The form component itself is shared** (`ASKRIGHT` §A0); it is
  the *route* that stays put.
- Fix the same off-by-one in `BookSupport.tsx` **only if it does not conflict with the acquisition
  task queued behind this one** — if in doubt, leave acquisition alone and report it.

## C1b — the back control says "Back", not "Previous"
Owner, 2026-08-16: *"keep the 'previous' button relabeled as 'Back' on step 2 page."*

**Measured:** `BookHorse.tsx:217` is a single expression —
`{step === 0 ? 'Back to Services' : 'Previous'}` — so **`Previous` is the label on every step past
the first**, not only step 2. Relabel it to **`Back`** for all of them; step 0 keeps
`Back to Services`.

- Applies to every step of the **three-step structure (§C1)** past the first — the questions page
  and the submission page both read `Back`.
- `BookSupport.tsx:269` carries the identical expression. **Leave it for the acquisition task**
  unless that task is not yet queued when you build — flag it rather than reaching into a lane
  another thread owns.
- `Checkout.tsx:294` says `Back to Selection`. **Do not change it here** — it is shared with the
  lesson funnel.

## C1c — ⚠️ TURNOUT NEEDS ITS OWN QUESTIONS — niche down

**Owner, 2026-08-17:** *"yes you are correct we need to niche down for things like turnout."*

**Measured on `main`:** `HORSE_EXERCISE` contains **two different services** —
`Exercise 1x Weekly · Exercise 2x Weekly · Exercise Session` **and**
`Turnout 1x Weekly · Turnout 2x Weekly · Turnout Session`.

`ASKRIGHT` (merged) keys question sets by `service_type`, so **a turnout buyer is asked what riding
the horse has done with them and before them, and whether it has had prior training.** Nobody rides
a horse to turn it out.

⚠️ **Turnout is the ONLY offender.** Every other service_type holds variants of a single service —
clip scopes, lesson counts, session-vs-weekly. **Do not generalise a solution beyond this case.**

### The fix — a per-offering override, NOT a new service_type
**Do not change `Turnout*`'s `service_type`.** `CAREPLANS` (wave 2) is going to restructure these
very SKUs, and a service_type change now would collide with it. Instead **let a question set key on
the offering where it differs from its service_type**, falling back to the service_type set
otherwise. **The existing subject model is unchanged** — turnout questions are still `client_horse`.

### The turnout set — OWNER-CONFIRMED, 2026-08-17

| # | question |
|---|---|
| 1–6 | **the shared horse block, unchanged** (own/lease · how long · age · breed · behaviour · injuries) |
| 7 | **Has the horse had any issues with turnout — fencing, gates, or getting out?** |
| 8 | *(weekly only)* What is bringing you to our turnout services? |
| 9 | *(weekly only)* Approximately how long will you need these services? |

**This is the shortest set in the catalog, deliberately.** Two proposals were cut by the owner:

- ⚠️ **"Alone or with other horses?" — DELETED. Never re-add it.** Owner: *"we always turnout
  alone."* It is not a preference to collect; it is how the barn operates, so asking implies a
  choice that does not exist.
- **A free-text box — DELETED.** Training, clipping and exercise each have one; **turnout does
  not.** Question 7 already carries the only thing worth writing down.

- **Question 7 REPLACES exercise's riding-history and prior-training questions** — they must not
  both appear.
- **8 and 9 gate on `config_kind = 'recurring'`**, exactly as exercise's do (`ASKRIGHT` §A3) —
  the à la carte `Turnout Session` gets neither.

**Test:** **Turnout Session** asks the shared six **plus question 7 only** — never about riding,
prior training, turnout companions, or special requirements; **Turnout 1x Weekly** additionally asks
8–9; and **Exercise** offerings are **unchanged**.

## C2 — the submission page carries the selections, Continue Shopping, and the form

The old Review screen's content moves here, so the final page shows, in order:

1. **The selection summary** — the existing markup at `BookHorse.tsx:176-194` is good; move it.
2. **`Continue Shopping`** — opens the category modal (C3). Secondary styling.
3. **The form** — personal information only (C4), the shared component.
4. **The primary submit**, worded by `inquiryLabel()` per `ASKRIGHT` §A6 — *"Inquire about
   {service name} service"* for a horse-care order. **Never a generic "Send Inquiry" or "Submit".**

**The questions page's forward button** (step 2 → step 3) reads **`Continue to Submit Inquiry`** — the same
label `ASKRIGHT` §A6 gives the equivalent controls elsewhere.

- ⚠️ **Delete** the *"That's everything we need for now…"* paragraph (`BookHorse.tsx:202-205`). It was
  false where it stood and there is no longer a page for it.
- **The floating `SelectionBar` must not present a competing path on this page** — check what it
  renders here and suppress it if it duplicates the submit.
- **One submission** — a mixed cart still produces a single inquiry (`ASKRIGHT` §A0).

## C3 — the Continue Shopping modal
- Asks **which category they want to see**, showing exactly three options:
  **Riding Lessons** (`/lessons`) · **Horse Care Services** (`/horse`) · **Acquisition Services**
  (`/acquisition`).
- **A Back button AND an ✕ in the corner**, both closing the modal and returning to step 3.
- Choosing a category navigates to that page. **The cart must survive the jump** — `CartContext`'s
  `SET_FUNNEL` already preserves items deliberately (*"so cross-sell is real"*). **Prove items
  survive**; this modal is the feature that makes mixed carts common rather than accidental.
- ⚠️ **A mixed cart is now the expected outcome of this button.** This task builds the horse-care
  form; the combined category-separated form is `THREEFORMS` F1b. **Establish and report what the
  submit screen does today when the cart holds more than one category** — if it would ask the wrong
  questions or drop selections, say so plainly. Do not silently ship a path that loses items.
- Reuse the project's existing modal/dialog component. **Do not write a new one** — check
  `src/components/` first; `CreateModal` and others exist.

## C4 — the submit screen collects PERSONAL INFORMATION ONLY, and NO DATE

⚠️ **Owner, 2026-08-16:** *"we are removing the date selection from the form on the step 4 page of
the submission for horse care, the only flow with a date selection portion is the lessons page. and
that is by design."* **The horse-care client never picks a date.** Staff set it on the call (§C7).
`proposed_times` is a lessons-only concern. `ASKRIGHT` §A6b carries the same ruling.

⚠️ **Note what the lessons funnel actually collects, so it is not copied here by mistake:** it is
`AvailabilityPicker` — **preference RANGES** (weekday/weekend AM–PM, weeks, days of the week), not a
calendar date. **Horse care collects neither.**

⚠️ **The act word is "inquire", not "request"** (`ASKRIGHT` §A6). For horse care the wording is
**"Inquire about {service name} service"**. If `ASKRIGHT` has merged, the copy is already correct —
**do not re-word it here.** The step-3 primary button the owner originally called
*"Continue to Submit Request"* becomes **"Continue to Submit Inquiry"** under that ruling.

Owner: *"the form should collect their personal information only."*

⚠️ **THERE IS ONLY ONE SUBMISSION FORM, SHARED BY ALL THREE FUNNELS** (`ASKRIGHT` §A0). Owner:
*"the lesson submission form has all the information that the other forms will collect so there is
only one form on the final submission page… and its one submission to us for review."*
**`Checkout.tsx`'s form is that form. Do not build a horse-care-specific one** — configure the
shared one. A mixed order produces **one** `requests` row, never one per category.

**Keep:** first name, last name, email, phone, preferred contact method, and a free-text notes box
with a **horse-care-appropriate placeholder** (not the riding one).

**Remove for this funnel:** riding experience in years, and anything else that presumes a rider.
The qualifying questions were already asked at step 2 — asking again is the confusion the owner
named.

**Do not delete the riding fields outright** — the lesson funnel still needs them. Make them
configuration, not deletion, so the lesson task can switch them back on.

## C5 — one submission produces THREE things
Owner: *"they are categorized as a lead, a horse owner, and an order is opened with the item(s)
selected."*

1. **A lead** — and the lead is the PERSON, not the row (owner taxonomy, 2026-08-02: a lead has
   identity + intent and no account yet). The `requests` row from `submit_public_request` is the
   intent envelope, with `p_category` set to horse care and the step-2 answers in `p_details`;
   the captured contact is the lead — **verify the `requests_capture_contact` trigger fires on
   this path, and that the answers actually land.**
2. **A horse owner OR LESSEE — capture WHICH** (`ASKRIGHT` §A3e: lease is not own, and the horses
   schema cannot yet tell them apart). **Find the existing representation** (see the directory
   migration above); **if no honest representation exists, do not invent a column** — record
   own-vs-lease in the request and report exactly where staff will read it. **Never falsify
   ownership for a lessee.**
3. **An order with the selected items.** ⚠️ **This is the piece that does not exist.**
   `createDraftOrder` is authenticated-only. Options, in order of preference:
   - extend `submit_public_request` (already SECURITY DEFINER, already receives `p_selections`) to
     also open the order; or
   - a new definer RPC called from the same submit, **stamping `org_id` via the tenant resolution
     the existing RPC already performs**.
   **Whichever is chosen, state it explicitly in the report, and prove the order is anon-creatable
   ONLY through that path** — `has_function_privilege()` on anon, and confirmation that nothing new
   grants anon direct INSERT on `purchases`. **`REVOKE … FROM PUBLIC` does not remove a direct
   grant.**
   The order is a **draft/unpaid** record of intent. **No payment happens here** — payment is at
   the end of activation, per the owner's flow.

## C5b — THE ORDER MODEL — OWNER'S RULING (2026-08-16). This answers Owner Question 1.

**Owner, verbatim:**
> *"everything is considered an order. and a canceled order for anything just voids that item from
> the order unless its the only order. the selections themselves dont create anything until the user
> submits and since we capture their name and email address with the order its not anonymous, its
> just classified as a lead until we promote it to customer so there is nothing owed until the order
> is confirmed and the lead is promoted. that happens all at the same time when we send the invite to
> activate their account."*

### The rules

1. **Everything is an order.** One submission = one order carrying its line items, alongside the one
   `requests` row (§C5). Not a quote, not a wishlist, not a category-specific record type.
2. **Selections create NOTHING until submit.** The cart is client state. **No DB row per selection,
   no cart persistence, no abandoned-cart table.** The first write is the submission.
3. **The submission is identified, not anonymous.** Name + email arrive with the order, so in
   taxonomy terms the person is a **LEAD** (identity + intent, no account yet — the owner's
   authoritative ladder, 2026-08-02). ⚠️ **The Postgres role is still `anon`** — every security
   requirement in §C5 stands unchanged. "Not anonymous" is a taxonomy statement, not a grants one.
4. **Nothing is owed on an unconfirmed order.** No payment surface, receipt, reminder or balance may
   treat it as payable.
5. **Confirmation, lead promotion, and the activation invite are ONE act, at ONE moment.** There is
   no state where the order is confirmed but the person is still a lead, or vice versa. Promotion
   lands them as **CLIENT** (owner-confirmed, 2026-08-16).
6. **Cancellation is per ITEM.** Cancelling any item **voids that line item** and the order total
   recomputes. **Cancelling the only item voids the whole order** (owner-confirmed reading, 2026-08-16). ⚠️ **Check whether `purchase_items` can represent a
   voided line at all** — if it has no status/void column, that is a small migration this task must
   include, dry-run + rollback proven.

### The status mapping — existing vocabulary, no constraint change

| moment | `purchases.status` | owed? |
|---|---|---|
| submission | **`draft`** + an **'Enquiry — awaiting call' status event** from the order vocab (filterable on the ops board, distinct from a staff-made draft) | nothing |
| confirm + promote + invite (one act) | **`awaiting_payment`** | now owed |
| activation payment page | **`paid`** | settled |
| item cancelled | line item void; order **`void`** when the last item goes | — |

**Do not add a `requested` status to the constraint** — every surface that switches on purchase
status would need to learn it. The lead-ness lives on the **person**; the status event carries the
ops-board distinction.

## C6 — everything is visible on the lead page, and two emails go out
- **The lead page must show the submission AND the order** — the personal details, the step-2
  qualifier answers, and the selected items. Owner: *"We should see all of this on the lead page for
  this lead."* **Find the existing lead/ops detail surface and extend it. Do not build a second
  lead page** — this project already paid for three duplicate lead lists.
- **Staff email** — already fires via `alertOpsInbox`. **It must now carry the selections and the
  step-2 answers**, not just a bare notification. Prove the content.
- **Buyer email** — *"the submitter should get an email with the information they sent us. (This
  includes the selections from step 2)"*. **This is a confirmation of what they submitted, NOT a
  booking confirmation.** It must not imply a date is held.
- ⚠️ **Two real leads were lost here before** because the send was fire-and-forget behind a
  best-effort 200 and could not report failure (`orchestration/lessons/LESSONS.md`). **Prove both
  emails send, with a per-attempt row recording the outcome.** If the buyer email cannot be proven,
  say so — do not print "we've emailed you" from an optimistic assumption.

## C5c — CARE FOR A HORSE THEY DO NOT HAVE YET → SPLIT INTO TWO ORDERS

**Owner, 2026-08-16:**
> *"yes we need to log a horse they have if they buy care services, but if they are buying them for a
> horse they dont already have because they are getting our help buying that horse we would split
> them into two separate orders so they onboard with the deal path and the general liability waiver
> only and then we would process the order for the care services when they actually have the horse
> for us to do the work with and they would be prompted to complete the intake form, the documents,
> and make payment for those services."*

**Owner, 2026-08-16 — how the split is triggered:**
> *"we allow it as a unified inbound order inquiry but we have to split it once we know the
> specifics… we just figure out or clarify it when we are talking with them. and our system needs to
> be able to split the orders and keep something as a draft."*

⚠️ **THE SPLIT IS A STAFF ACTION, NOT AN AUTOMATIC CONSEQUENCE OF AN ANSWER.** The inquiry arrives
unified and may be ambiguous; **no question on the form decides this** (`ASKRIGHT` §A3f adds none).
Staff learn the specifics on the call and **choose** to split.

**So build two capabilities, and let staff decide when to use them:**
1. **Split an order** — move selected line items out into a second order on the same inquiry.
2. **Hold an order as a draft** — it owes nothing and schedules nothing until released.

**The common case they serve, and the shape it takes:**

| | order A — acquisition | order B — the care services |
|---|---|---|
| **at confirmation** | `awaiting_payment`, proceeds normally | **stays `draft`**, with a status event meaning **awaiting the horse** — nothing owed, nothing scheduled |
| **onboarding** | the **deal path**: activate → order screen → **general liability waiver only** (§C10a) | **not part of this activation at all** |
| **later, once the horse exists** | — | **wakes up**: the client is prompted to complete the **horse intake form**, the **documents**, and **make payment** for those services |

**Rules:**
- **Staff split at or before confirmation** — the invite must go out against the right order, since
  it starts the deal-path onboarding. **Never split automatically at submission.**
- **Splitting must be possible for any order, for any reason staff have** — this scenario is the
  reason it is being built, not the limit of its use. **Do not hard-code it to the
  acquisition-plus-care case.**
- **Both orders trace to the same inquiry** — one `requests` row, two orders. **Prove the link
  survives**, or staff lose the story of why order B exists.
- **Order B is never `awaiting_payment` while the horse is missing.** Nothing is owed for work that
  cannot begin. It moves to `awaiting_payment` **only when the horse exists** and the client is
  prompted.
- **Use the §C5b vocabulary** — `draft` plus a status event. **No new `purchases.status` value.**
- ⚠️ **What wakes order B is a HORSE APPEARING for that client**, not the acquisition order closing —
  they may buy privately, or we may find one fast. **Key the wake-up on the horse, not the deal.**
- ⚠️ **Do NOT build the acquisition lane here.** Order A's own flow is a later task. **This task owns
  the split and order B's held state**; report exactly where order A is handed off.

**This supersedes the earlier "cannot be scheduled" treatment** — a held second order is the
owner's mechanism, not a blocked line item inside one order.

## C6b — the confirmation screen after the submit: show what happened, honestly
*(Absorbs `THREEFORMS` F2 — that task no longer runs.)*

**Owner (earlier ruling, verbatim):** *"page 3 shows them the confirmation of the items they
selected for their order, the things they input and selected on their form, and a confirmation of
the email sent to us and them and that we try to respond within a few hours using their preferred
contact method."*

- **The items chosen** — price-on-inquiry items show no number.
- **Every answer they gave**, so they can see what was submitted on their behalf.
- **The send status of BOTH emails** (C6), and **the reply promise names their chosen method** —
  "we'll text you", never a generic line.
- ⚠️ **Only claim what happened.** No optimistic "we've emailed you" — the send must be confirmed
  via C6's per-attempt row. **Two real leads were lost to a fire-and-forget send.** A failed send
  is reported honestly, with another way to reach us.

## C7 — staff provision the service, with the right date shape
When staff open the lead they see the submission and the order, have the conversation, and then
schedule. **The date control depends on the item:**

⚠️ **SUPERSEDED IN PART BY `TASK-CAREPLANS` (owner, 2026-08-16).** The 1x/2x shapes below are being
retired: a care service will offer only **à la carte** or **weekly**, and staff will choose **the
days of the week** — with quantity derived from them, plus **N weeks or indefinite until cancelled**.
**Build this section to the table below only if `CAREPLANS` has not merged; otherwise follow
`CAREPLANS`.** Either way the principle is unchanged: **staff set the schedule, the catalog supplies
the numbers, and nothing is parsed from a name.**

| item shape | what staff pick |
|---|---|
| single / à la carte item | **a date** |
| weekly item | **the day(s) of the week** — one or several; quantity follows |
| any weekly plan | **plus how long: N weeks, or indefinite until cancelled** |

⚠️ **A SERVICE FOR A HORSE THAT DOES NOT EXIST YET IS NOT SCHEDULED HERE — IT IS IN HELD ORDER B**
(§C5c). Staff schedule only what belongs to a horse that exists. Order B carries no dates until the
horse appears and the client completes intake, documents and payment.

**The quantity must come from the catalog, never from parsing the offering name.** Names changed on
2026-08-15 and name-parsing broke credit minting three separate times. `CREDITALIGN` established
minting from `unit_count`; **find the same authoritative field and use it.** The `2x` is how the
owner *describes* it, not where the number lives.

**Reuse the existing booking writers** — `BOOKLINK`'s client+item linkage and `REVIEWQ`'s decision
path. **Do not write a second booking writer.**

## C8 — promotion to client, and the activation flow
- Staff send the activation link **by email**; the lead is **promoted to client**.
- ⚠️ **This is §C5b's ONE ACT**: the same moment confirms the order (`draft` → `awaiting_payment`),
  promotes the lead, and sends the invite. **Never one without the others.**
- Issue it through **`provision_client_invitation(p_request_id => …)`** — it already accepts the
  request id. **Do not build a second provisioning path.**
- **Verify, do not rebuild** (`ONBOARD` built this): activation → password **or Google OAuth** →
  order information page → horse information → documents → app overview → the ordered item's detail
  page with booking information.

## C9 — the order confirmation screen inside activation, and "notify staff this isn't correct"
- After sign-in the client sees **their order information, including the booking if staff put one
  on the calendar**.
- **Two buttons:** `Continue`, and **`Notify staff this isn't correct`**.
- ⚠️ **The correction button must provably reach a human** — the same standard as C6. It routes
  through the existing notification spine, with a recorded attempt.
- **Either button proceeds** to horse information. Owner: *"either way they are taken to the
  screen."* **The correction does not block the client** — it flags staff while the client
  continues.

## C10 — horse information and the horse-owner fields
- After the order screen, the client adds **their horse's information and anything else a horse
  owner must give us**.
- **Find the existing horse-intake surface and form definitions** (`form_definitions` exists;
  `ONBOARD` reported a per-document trigger here) and reuse them. **Do not build a third horse
  intake** — this project already had 3 horse rosters.
### ⚠️ C10a — NOT EVERY CLIENT IS A HORSE OWNER. THE INTAKE BRANCHES.

**Owner, 2026-08-16:**
> *"a person coming to us for help finding a horse is a client but they are not a horse owner if
> their horse isnt in our system during onboarding, which an acquisition client wouldnt have one
> they would add, so they are deal client category."*

**"Horse owner" is EARNED BY HAVING A HORSE IN THE SYSTEM — it is not declared on a form.** Two
client categories come out of onboarding:

| category | who | onboarding |
|---|---|---|
| **horse-owner client** | a horse of theirs exists in our system | **completes the horse intake** |
| **deal client** | no horse of theirs exists yet — acquisition clients, and horse-care clients whose service is for the horse we are finding them (`ASKRIGHT` §A3f) | **NO horse intake — there is nothing to add.** Their care services live in **held order B** (§C5c) until the horse exists |

⚠️ **This breaks the straight line in §C10.** A client with no horse must **not** be shown "add your
horse's information" — it is an unanswerable form and it tells them we were not listening.
**Skip that step entirely.**

**Owner, 2026-08-16 — what a deal client's onboarding actually is:**
> *"for them there is only a general liability waiver to complete and then we go do the evaluation
> or help with the contract or whatever they are seeking our services for."*

**A deal client's onboarding is: activate → order screen → GENERAL LIABILITY WAIVER → done.**
No horse intake, and **no horse-dependent documents** — the horse-specific paperwork belongs to a
horse that does not exist yet. Then staff go and do the work they were engaged for.

⚠️ **Find the existing general liability waiver and use it** — do not author a new document.
`EVALUATION_LIABILITY_WAIVER` and other release/waiver templates exist in the contract engine;
**name the one you used and prove it is the right one.** If the document set assigned at activation
is driven by a rule or trigger (`ONBOARD` found a per-document trigger here), **that rule is what
changes** — a deal client gets exactly one document.

⚠️ **A horse-care order can produce a deal client.** If §A3f's answer was *"the horse you help me
find"*, they bought care but own nothing yet. **Category follows the horse, not the service bought.**

**Measured — there is no home for this today, so do NOT invent one:**
`contacts.contact_type` allows only `LEAD · CONTACT · TEAM · DIRECTORY · VENDOR · PARTNER` — no
horse-owner or deal-client value. The `deals` table exists but **requires a `contract_id`
(NOT NULL)**, and an acquisition inquiry has no contract yet, so a deal row cannot represent this
either. **Report how you expressed the distinction and what it cost.** A derived category (does a
horse exist for this contact?) is likely right and needs no schema change — **prove it and say so.**

### C10b — the answers must FEED FORWARD, not die in the request
**Owner:** *"we collect the information from them on the acquisition or horse care intake. that
information then goes into the form used for an evaluation or a contract, or in the case of horse
care it goes into the form for their horse intake form."*

The inquiry answers are **the first draft of the client's file**, not a one-time filter:
- **horse care →** the horse intake form (via the same-horse question below)
- **acquisition →** the evaluation form and the contract *(that lane is a later task — **do not build
  it here**)*

**So store the answers structurally**, keyed by question and subject (`ASKRIGHT` §A2b), retrievable
per contact. ⚠️ **Answers flattened into a notes blob cannot feed anything** — if `p_details` is the
store, confirm it holds them as addressable keys, and **say so in the report.**

### ⚠️ ASK WHETHER IT IS THE SAME HORSE — NEVER ASSUME IT
**Owner, 2026-08-16:** *"we dont assume the inquiry about horse clipping and the inquiry about
evaluation or any of the acquisition services are related to the same horse… we can ask them if it
is before asking them to fill it in."*

An order can name **three different horses**: the one they own or lease (`client_horse`), one being
evaluated (`evaluated_horse`), and one they hope to buy (`sought_horse`).

- Before the intake form is filled, **ask whether the horse being added is the one from their
  inquiry.** **Yes → prefill** the overlapping fields (age, breed, behaviour, health) from the
  `client_horse` answers, editable. **No → a blank form.**
- **Only `client_horse` answers may ever prefill.** `evaluated_horse` and `sought_horse` answers
  describe *different animals* — **never use them to prefill anything.**
- If the order carried no `client_horse` answers, **ask nothing and show a blank form.**
- Prefilled values follow `ASKRIGHT` §A3c's rules: visible, editable, recorded as derived.

⚠️ **There is no "post-sale" form.** The activation intake is `HorseIntakeForm.tsx` and it runs
*before* the payment page. The `INTAKE_HORSE_*` rows in `form_definitions` have **no surface** and
are **not** to be wired up here — report them, nothing more.

- ⚠️ **Own-vs-lease has nowhere faithful to land** (`ASKRIGHT` §A3e): `horses.current_owner_contact_id`
  is the only relationship a horse record carries. **Do not falsify ownership for a lessee** —
  report the gap and state exactly where you parked the answer until the schema task exists.
- Then documents, then app overview, then the item detail page **with the booking information**.

---

# TRAPS
- **Do not weaken `createDraftOrder`'s auth check.** Build the anonymous path definer-side.
- **Do not build a second lead page, booking writer, provisioning path, modal component, or horse
  intake.** Every one exists.
- **Do not parse offering names for quantity.** Catalog field only.
- **Do not let the buyer email imply a confirmed booking.** Nothing is scheduled until staff call.
- **Acquisition and lessons are queued behind this.** `BookSupport.tsx` shares the step-tracker
  defect and `Checkout.tsx` is shared by all three — **touch shared code as configuration, not
  rewrites**, or you will conflict with the next two tasks.
- **`THREEFORMS` F1b (the combined mixed-cart form) is NOT this task.** Report the mixed-cart
  behaviour honestly; do not half-build it.
- **Migrations never contain `BEGIN`/`COMMIT`**; dry-run with `BEGIN; \i …; ROLLBACK;` and **prove
  the rollback**.
- **`REVOKE … FROM PUBLIC` does not remove a direct grant** — prove with `has_function_privilege()`.
- `assertWrote()` on every write; **RLS silently zeroes UPDATEs.**
- **Never symlink `node_modules` across case-variant paths** (`/Users/Cactai` vs `/Users/cactai`
  loaded React twice and nulled every hook, 2026-08-16).
- **Run the PGlite suite** (`vitest run`, capped workers, kill your processes before reporting).
  **Not a green baseline — 46 pre-existing red files; diff against `main`.**

---

# THE TEST THIS MUST PASS
1. The horse-care tracker reads **Step 1 of 3 … Step 3 of 3**, and no screen is unnumbered.
1b. **The count is derived, not hardcoded** — a cart whose offerings have no question set shows
    **two** steps, and the questions page is skipped. Prove the tracker follows.
1c. ⚠️ **Lessons plus horse care in one order inserts the questions page** even when the visitor
    started on `/lessons` — owner: *"when the lessons are part of the order with any of the other
    two the questions page gets inserted."* (`ASKRIGHT` §A0 owns this; prove it still holds here.)
2. The *"That's everything we need for now"* line is gone.
2b. The back control reads **`Back`** on every step past the first, and **`Back to Services`** on
    step 1 — the word `Previous` appears nowhere in the horse-care funnel.
3. The **submission page** carries the selection summary, **Continue Shopping**, the form and the
   `inquiryLabel()` submit (*"Inquire about {service name} service"*) — in that order, with no
   competing path from the floating bar.
3b. After submitting, the **confirmation screen** shows the items, every answer given, and the
    honest send status of both emails, naming their chosen contact method (C6b) — including the
    failure path.
4. The modal shows the three categories, has **both** a Back button and an ✕, and choosing one
   navigates there **with the cart intact** — prove the items survive.
5. The submit screen asks for personal information only. **A horse-care buyer is never asked their
   riding experience** — prove it, since today they are.
6. One submission produces a **lead**, a **horse-owner categorization**, and an **order carrying the
   selected items** — three query results, from a signed-out browser.
7. The order is anon-creatable **only** through the intended definer path;
   `has_function_privilege()` output for anon on the new/changed function, and proof anon has no
   direct INSERT on `purchases`.
8. The **lead page shows the submission and the order together** — personal details, step-2 answers,
   selected items.
9. **Both emails send** — staff (carrying selections and answers) and buyer (confirming what they
   submitted, not a booking) — each with a per-attempt row. **Prove the failure path too.**
10. Staff scheduling offers a **date** for a single item, a **day** for a weekly item, and **two
    days** for a weekly quantity-2 item, with the quantity read from the catalog — **name the field**.
11. Promotion issues the activation link through `provision_client_invitation` — prove which
    function ran.
12. Following the link end to end reaches: password/OAuth → order page **with booking** → horse
    information → documents → app overview → item detail **with booking**. Prove each, **or report
    the break rather than patching around it.**
12b. ⚠️ **A DEAL CLIENT'S PATH IS DIFFERENT** (§C10a): a client with no horse in the system —
    including a horse-care client whose service is for the horse we are finding them — is **never
    shown the horse intake**, completes **only the general liability waiver**, and reaches the app
    without horse-dependent documents. **Name the waiver used** and prove no horse form appeared.
12c. **The client category is derived from whether a horse exists**, not from what they bought —
    prove a horse-care buyer with no horse lands as a deal client.
12d. **The inquiry answers are retrievable per contact and per subject** (§C10b) — prove they can
    populate a downstream form rather than sitting in a text blob.
12e. ⚠️ **THE SPLIT IS A STAFF ACTION** (§C5c): staff can move selected line items into a second
    order on the same inquiry, and hold an order as a draft that owes and schedules nothing.
    **Prove it is staff-initiated, works for any order rather than only the acquisition case, and
    that both orders trace back to the one `requests` row.** Order A goes `awaiting_payment`;
    held order B stays `draft`.
12e2. **A mixed inquiry submits unified and unblocked**, with no extra question and no special
    routing — the ambiguity is allowed and the call resolves it.
12f. **Order B wakes on a HORSE APPEARING for that client** — not on the acquisition order closing —
    and only then prompts intake, documents and payment, moving to `awaiting_payment`. Prove the
    trigger is the horse.
12g. **No new `purchases.status` value was added** for any of this — `draft` plus status events, per
    §C5b. Prove the constraint is unchanged.
13. **`Notify staff this isn't correct` provably reaches a human**, and the client still proceeds.
14. Mixed-cart behaviour at the submit screen is **reported honestly**, whatever it is.
15. Every DB claim is query output. Render claims are marked **NOT VERIFIED** with a numbered
    click-through checklist for the owner.

---

# OWNER QUESTIONS — ask before building, do not assume
1. **The order's status name.** It is unpaid intent created before any conversation. Should it be a
   `draft` purchase, or does the ops board need it visibly distinct from a staff-made draft?
2. **Does the buyer email list prices**, or only the services chosen? Several horse-care offerings
   are price-on-enquiry, and quoting a number before the call may be wrong.
3. **What "anything else we need to collect for a horse owner" includes** beyond the horse itself —
   vet, farrier, insurance, emergency contact? **Report what the existing horse intake already
   collects and ask him to confirm the gap** rather than guessing.

Report to `docs/reports/TASK-CAREPATH-REPORT.md`. Do not push; the orchestrator merges.
