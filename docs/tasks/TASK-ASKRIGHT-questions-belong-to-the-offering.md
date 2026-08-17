# TASK ASKRIGHT — the questions belong to the offering, not the funnel

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** The question sets below are the payload and must
be transcribed exactly; the engine that renders them is new component work; and §A6 touches an
existing production form store.

**RUN THIS BEFORE `TASK-CAREPATH`.** CAREPATH rebuilds the horse-care flow around step 2. If step 2
still asks the wrong questions when CAREPATH runs, both tasks touch the same code and one of them
is wasted. **This task fixes what is asked. CAREPATH fixes what happens afterwards.**

**HOW TO RUN THIS TASK — read before starting:**
- **Everything you need is in this file.** Verify every measurement below against live code and the
  live catalog before building on it — this project's task docs go stale within hours.
- **Six decisions are gated on the owner** (§OWNER QUESTIONS, at the end). **Read them first.** Some
  block whole question sets, because the owner gave the questions but not all the answer options.
- **Report to `docs/reports/TASK-ASKRIGHT-REPORT.md`. Commit your work; do NOT push.** The
  orchestrator merges.
- **Never self-report "done" without evidence.** Every DB claim is query output in the report; every
  render claim is marked **NOT VERIFIED** with a numbered click-through checklist for the owner.
- **Do not spawn subagents.** One thread, one task.

---

# THE DEFECT

**Owner, 2026-08-16:**

> *"the step 2 questions for horse clipping service asks the user the same questions as the horse
> training and horse exercise, but the questions are really focused on the exercise service client
> and dont apply to the training or clipping services. This is a big error that we need to
> correct."*

He is right, and it is worse than one funnel. **Both non-lesson funnels ask a single fixed question
set regardless of what was selected:**

- `BookHorse.tsx:135-162` — every horse-care buyer gets `horse_reason` ("What is bringing you to our
  horse care services?") and `horse_duration`. Someone booking a **clip** is asked whether they are
  *travelling*, *recovering from an injury*, or need *ongoing care and turnout support*, and then
  how many months they will need it. **A clip is one appointment.**
- `BookSupport.tsx:139-186` — every acquisition buyer gets `experience`, `how_many_horses` and
  `wants_lessons`. Someone booking a **Horse Evaluation on a horse they already own** is asked how
  many horses they are considering buying.

**The fix is structural: questions attach to the offering, not the funnel.**

---

# WHAT WAS MEASURED (main = `9c2d011`, 2026-08-16 — VERIFY, then build)

## `QualifierGroup` cannot express most of these questions
`src/components/QualifierGroup.tsx` is **single-select only**. It renders a `role="radiogroup"` of
buttons and writes one string via `setQualifier(key, value)` into
`state.qualifierAnswers: Record<string, string>`.

**The owner's new sets need free text** — *"open input form for problem areas and/or specific
goals"*, *"any notes or special requests"*, *"anything else they want us to know"* — and probably
short-text answers for breed and age. **There is no free-text qualifier component.** Building one
is part of this task. **Extend the existing pattern; do not fork a second answer store.**

## Questions per service ALREADY EXIST as data — as deep intake forms
`supabase/migrations/20260629120000_form_definitions.sql` creates `form_definitions` (one row per
form, `schema` jsonb of sections → typed fields) and seeds, among others:
`INTAKE_HORSE_CLIPPING` · `INTAKE_HORSE_EXERCISE` · `INTAKE_HORSE_EVALUATION` ·
`INTAKE_HORSE_FINDER` · `INTAKE_HORSE_LEASE_IN`.

**These are the POST-sale intake forms** — they carry emergency contact, veterinarian, signature.
**They are not what this task builds**, which is the short PRE-sale qualifier. But note carefully:

- **The precedent is that per-service questions live as DATA, not as JSX.** Prefer that shape here.
- **They overlap heavily** — breed, age, behaviour and medical history appear in both. **A client
  should not be asked their horse's breed before buying and again at intake.** See §A6 and Owner
  Question 2.

## The catalog groups by `service_type`, and the codes look right
`src/lib/publicCatalog.ts` returns `ServiceGroup { code, name, tagline, offerings[] }` where `code`
is the `service_type` code. Codes seen in migrations include `HORSE_EXERCISE`, `HORSE_TRAINING`,
`HORSE_EVALUATION`, `HORSE_SEARCH_RETAINER`, `HORSE_PURCHASE_ASSISTANCE`, and clipping codes.
⚠️ **These came from grepping migration text, not from the live catalog. Query the live catalog and
report the true `service_type` codes and offering slugs before keying anything to them.**

## `cadence` exists but is unproven here
`cadence` appears ~69 times in migrations. **Exercise questions 10 and 11 apply only to the weekly
offering, not the à la carte one** — so an authoritative recurring/one-off field is required.
**Find it, name it in the report, and key off it. Never parse the offering name** — names changed
on 2026-08-15 and name-parsing broke credit minting three separate times.

---

# THE BUILD

## A0 — ONE FLOW, ONE FORM, ONE SUBMISSION — WHATEVER PAGE THEY STARTED ON

**Owner, 2026-08-16:**
> *"the lesson submission form has all the information that the other forms will collect so there is
> only one form on the final submission page, the flow would be that the questions get asked between
> the selection page and the submission page no matter where they continue to submission from, since
> the lessons page doesnt use a page 2 it goes straight to the form if there are horse care or
> acquisition items in the cart and they click the continue button from the lessons page it needs to
> still show the page 2 for the questions related to the other services before the form is shown and
> then the form is sufficient for all the offerings. and its one submission to us for review."*

**The flow, identical from every entry point:**

```
selection page  →  QUESTIONS (page 2)  →  [review]  →  THE FORM  →  one inquiry
   /lessons          shown when ANY        horse care    one shared      one requests
   /horse            selected offering     & acquisition  submission      row for the
   /acquisition      has questions         only           form            whole order
```

### Page 2 is conditional on CONTENT, never on which page they came from
- **It appears when any offering in the cart has a question set** — full stop.
- **Lessons alone goes straight to the form today because lessons has no questions yet**, not
  because `/lessons` is special. **Do not hardcode "the lessons page skips page 2."**
- ⚠️ **The case the owner is calling out:** a visitor holding **horse care or acquisition items who
  presses Continue on `/lessons`** must still be shown page 2 for those offerings' questions before
  the form. **This is the bug this section exists to prevent.**

⚠️ **`TASK-RIDERQUALIFY` consequence — flag it, do not build it here.** That queued task adds rider
questions to the lesson path. Under this architecture they belong on page 2 like everyone else's,
which **answers RIDERQUALIFY's open owner question about where in the flow they go**. Once it
merges, a lessons-only order **will** have a page 2. Note this in your report.

### There is ONE submission form, and it is the lessons form
- **`Checkout.tsx`'s form is the superset** — it already collects first/last name, email, phone,
  preferred contact method, notes, and availability. **It becomes THE form for all three funnels.
  Do not write a second one.**
- **Always shown:** name, email, phone, preferred contact method, notes.
- **Lessons only:** the `AvailabilityPicker` ranges (§A6b).
- ⚠️ **Riding experience is in the wrong place and should move to page 2.** It sits on the form today
  as *"Riding experience (years)"*, but *"Which best matches your equestrian experience?"* is a
  **`person`-subject page-2 question** for Horse Evaluation and Horse Finder (§A4). Left as it is,
  **someone ordering a lesson and an evaluation answers their own experience twice in one order** —
  exactly the duplication §A2b exists to kill. **Recommend relocating it; confirm with the owner
  (Owner Question 8) before moving it.**

### One submission, not one per category
- A mixed order produces **ONE `requests` row** carrying every offering and every answer — *"one
  submission to us for review."*
- **Never split a mixed cart into several inquiries.** Staff review one thing.

## A1 — questions attach to the offering
- The step-2 question set is **derived from what is in the cart**, not hardcoded per page.
- Key it to the **catalog identity you verified** (`service_type` code, or offering slug where two
  offerings of one type diverge). **Report which you chose and why.**
- Prefer a **declarative definition** (a data structure, or `form_definitions`-style rows) over
  three hand-written JSX branches. Three branches is how this bug was born.
- **An offering with no defined set asks nothing** — it must not silently fall back to the exercise
  questions, which is precisely today's defect.

## A2 — THE SHARED SECTION IS DERIVED FROM THE CART, THEN ONE SECTION PER OFFERING

**Owner, 2026-08-16:**
> *"it needs to collect the information from the list on all question lists, but it needs to separate
> out the overlapping information into an initial section, then each offering is its own section with
> additional questions."*

**This is the rule; the tables below are just what it produces for the known offerings.**

**The shape of step 2, for ANY combination in the cart:**

1. **An initial shared section** — every question that appears in **more than one** of the selected
   offerings' lists, asked **once**.
2. **Then one section per selected offering**, each carrying **only that offering's remaining
   questions**, under that offering's name.

**Rules that fall out of it:**
- **Every question from every selected offering's list is collected** — nothing is dropped because
  another offering was also chosen. The shared section removes *repetition*, never *coverage*.
- **Sections are ordered by the order the visitor picked the offerings**, so the screen mirrors their
  own path.
- **One offering selected → no shared section.** Do not render an empty or single-purpose "shared"
  header; its questions simply are its section.
- **The shared section is computed, not hardcoded.** A new offering with its own list must slot in
  without anyone editing a shared-block constant.

⚠️ **THE TRAP: overlap means the SAME question about the SAME subject, not a similar label.**
Within horse care, training / clipping / exercise all ask about **the client's own horse**, so their
first six genuinely merge. But across categories they do not:
- Training's *"What breed is the horse?"* is about **the horse they own**.
- Horse Finder's *"Are there specific breeds you prefer?"* is about **a horse they might buy**.
- Horse Evaluation's *"Breed"* is about **the horse being evaluated**, which may be neither.

**Merging those would corrupt the answers.** Key the shared section so that only genuinely identical
questions merge, **and report the keying scheme you chose.** When in doubt, keep them separate — a
duplicated question is a small annoyance; a merged one produces a wrong answer staff will act on.

## A2b — PAGE 2 IS ASSEMBLED ON THE CLICK, AND ANSWERS ARE HELD

**Owner, 2026-08-16:**
> *"page 2 is truly a dynamic page that is made to order so to speak constructed on the click based
> on the selections made. and the system needs to hold the information so its not asking the same
> information when they pick a lesson, an evaluation, and a horse training offering in the same
> order."*

**There is no static step-2 page for any funnel.** It is assembled from the cart at render time.

### Every question declares a SUBJECT — that is the keying scheme

This is the rule that makes "don't ask twice" safe. **Two questions merge only when they are the
same question about the same subject.** Four subjects cover the current catalog:

| subject | what it is | merges across |
|---|---|---|
| `person` | the buyer / rider themselves | **everything** — all three categories |
| `own_horse` | the horse the client already has | horse care (training, clipping, exercise) — **but see §A3b: it may not exist yet** |
| `evaluated_horse` | a specific horse being assessed | Horse Evaluation only |
| `sought_horse` | preferences for a horse not yet owned | Horse Finder, Acquisition Assistance |

**Age and breed appear under three different subjects and must never merge across them.** The
client's own horse is 12 and a warmblood; the horse being evaluated is 6 and a thoroughbred; the
horse they hope to buy should be 8–12 and any breed. **One `breed` key would destroy all three.**

### The owner's worked example — lesson + evaluation + horse training in one order

| section | subject | contents |
|---|---|---|
| **1. About you** | `person` | equestrian experience / riding level, whether they own or lease a horse — **asked once, serves all three** |
| **2. Horse Training** | `own_horse` | how long they have had the horse, its age, breed, behaviour, injuries, riding history, prior training, goals |
| **3. Horse Evaluation** | `evaluated_horse` | location, age, breed, current use, planned use, concerns |
| **4. Riding Lesson** | `person` | whatever rider questions remain after section 1 |

**Age and breed are asked twice here — correctly** — because they are two different horses. The
experience question is asked **once**, because there is only one person.

### Holding the answers
- Answers persist in the **existing** `state.qualifierAnswers` store, keyed by **subject + question**.
  **Do not add a second store.**
- **Adding an offering later** (via CAREPATH's Continue Shopping modal) **extends** the form with
  that offering's new section and **never re-asks anything already answered.**
- **Removing an offering** hides its section but **retains its answers**, so re-adding it does not
  make the visitor type everything again.
- **Only answers for offerings still in the cart are submitted.**

### What this produces for horse care
**Questions 1–6 are identical across training, clipping and exercise** — same six, same horse. So a
cart with any two of them shows one shared section of six, then a section per service.

| # | question |
|---|---|
| 1 | Do you own or lease the horse? |
| 2 | How long have you had the horse? |
| 3 | What is the age of the horse? |
| 4 | What breed is the horse? |
| 5 | Does the horse have any behaviour issues? |
| 6 | Has the horse had any injuries or current health issues? |

⚠️ **Answer options are NOT specified for most of these** — see Owner Question 1. Do not invent them
silently; propose and confirm.

## A3 — the service-specific questions

## A3b — ⚠️ THE HORSE MAY NOT EXIST YET

**Owner, 2026-08-16:**
> *"not necessarily, they can be asking for training on a horse they are asking us to help them
> acquire."*

**A horse-care order does not imply the client has a horse.** Someone can order **Horse Finder +
Horse Training** together: find me a horse, then train it. In that order, the training questions —
**age, breed, behaviour issues, injuries, prior training, riding history** — have **no answer**,
because there is no horse.

**Consequences, all three of which must be built:**

1. **The two ownership questions do NOT merge.** *"Do you currently own or lease a horse?"*
   (`person`, rider path) and *"Do you own or lease the horse?"* (the horse coming for care) can
   legitimately differ — a client may own one horse and be seeking another for training. **Keep them
   separate.**
2. **Question 1 gates questions 2–6.** It needs an option covering *the horse does not exist yet* —
   proposed wording **"Not yet — I'd like help finding one"** (⚠️ **confirm exact wording with the
   owner**). When chosen, **suppress the remaining horse questions rather than showing unanswerable
   fields**, and record that the horse is yet to be acquired.
3. **The subject shifts.** With no horse, the care questions are not about `own_horse` — they concern
   the `sought_horse` the acquisition service will find. **Do not silently file the answers under
   `own_horse`**, or staff will later read them as describing a horse the client already has.

**Staff collect the horse's details after acquisition**, through the intake surface `CAREPATH` §C10
owns. **Report this hand-off rather than building it here.**

## A3c — INFERRED ANSWERS: prefill what one answer already proves

**Owner, 2026-08-16:**
> *"in the case that they are asked if they are owner or leasing the horse they want a servce for and
> then they also have acquisition offering in their cart, we can auto select that they currently own
> or lease. and this is where a site feels premium."*

**§A3b keeps the two ownership questions separate. This section connects them without merging them.**

### The rule is an IMPLICATION, and it runs ONE WAY ONLY

| if | then | not the reverse |
|---|---|---|
| the client **owns or leases the horse** they want serviced (`own_horse`) | they **currently own or lease a horse** (`person`) — **prefill it** | owning *a* horse does **not** mean they own *the* one they want serviced — they may be seeking a second |

**Never run an implication backwards.** That is the error §A3b exists to prevent: someone owning a
horse while asking us to find another for training.

### How a prefilled answer must behave
- **It is shown answered, never hidden.** The visitor sees the answer and can see it is filled in.
  Deciding for someone invisibly is not premium — it is a wrong answer they never got to catch.
- **It stays editable.** Changing it is an ordinary interaction with no warning or friction.
- **It tracks its source until touched.** If the client changes the horse-care answer to *"not yet"*,
  a still-untouched derived answer **updates with it**. Once the visitor has edited the derived
  answer themselves, **it is theirs and must never be overwritten.**
- **Record that it was derived rather than given.** Staff reading the inquiry should be able to tell
  what the client actually typed from what the system concluded. **Report where you stored that
  distinction.**

### Scope
- **Build the mechanism generally**, then apply it to the one rule above.
- ⚠️ **Do not invent further inferences.** If you find other candidate implications while building
  the question sets, **list them in the report for the owner to rule on** — a wrong inference is
  worse than a repeated question, because the client never sees the question that would have caught
  it.

### Horse Training — after the shared block
| # | question |
|---|---|
| 7 | What type of riding has the horse done with you, and prior to you? |
| 8 | Has the horse had any prior training? |
| 9 | **Free text** — problem areas and/or specific goals you have for the horse's training |

### Horse Clipping — after the shared block
| # | question |
|---|---|
| 7 | Has the horse had any issues with being clipped? |
| 8 | **Free text** — any notes or special requests |

### Horse Exercise — after the shared block
| # | question | applies to |
|---|---|---|
| 7 | What type of riding has the horse done with you, and prior to you? | all |
| 8 | Has the horse had any prior training? | all |
| 9 | **Free text** — problem areas, or specific requests or requirements for the horse's exercise | all |
| 10 | **What is bringing you to our horse care exercise services?** | **weekly only** |
| 11 | Approximately how long will you need these services? | **weekly only** |

- **Q10 is the EXISTING `horse_reason` block with a revised question.** Reuse it; change the wording.
- **Q11 is the EXISTING `horse_duration` block, unchanged.**
- **Q10 and Q11 must NOT appear for the à la carte exercise offering** — owner's explicit ruling.
  This is the `cadence` dependency from §WHAT WAS MEASURED.

## A4 — acquisition, same approach
Owner: *"The flow and question variation between offerings from horse care services will be the same
approach we should use for the acquisition services."*

### Horse Finder AND Acquisition Assistance — one shared set
| # | question |
|---|---|
| 1 | Are you looking to lease, to buy, or open to either? |
| 2 | **Which best matches your equestrian experience?** |
| 3 | Have you found any horses you are already considering? |
| 4 | Are there specific breeds you prefer? |
| 5 | Is there a specific age range you prefer? |
| 6 | Do you have a specific budget range? |
| 7 | Do you have a location for boarding already selected? |
| 8 | What do you plan to use the horse for? |
| 9 | **Free text** — anything else you would like us to know |

**Q2 is the existing `experience` block.** Owner: *"this is currently question 1 so we just need to
change the question and remove the second line of text, the choices for answers are good as is."*
So: **new question text, DELETE the help line** (*"We want to match our guidance to your actual
background."*), **keep the four existing options unchanged.**

⚠️ **`how_many_horses` and `wants_lessons` are absent from the owner's list.** The list reads as
complete and replacing. **Do not delete them until Owner Question 3 is answered** — `wants_lessons`
is a cross-sell.

### Horse Evaluation — its own set
| # | question |
|---|---|
| 1 | Location |
| 2 | Age |
| 3 | Breed |
| 4 | How is the horse currently being used? |
| 5 | What are you planning to use the horse for? |
| 6 | **Free text** — any specific concerns or things you want us to focus on during the evaluation |
| 7 | What is your current riding level? |
| 8 | **Which best matches your equestrian experience?** |

⚠️ **Q8 is the same question text as the Finder set's Q2 but with DIFFERENT options**, per the owner:
**First horse · Owned or leased a horse in the past · Currently own or lease a horse.**

**This proves options belong to the question SET, not to a global key.** A single global
`experience` constant cannot serve both. **Build accordingly**, and see Owner Question 4 for the
cart that holds a Finder and an Evaluation at once.

## A5 — free-text answers, stored in the existing place
- Build the free-text sibling to `QualifierGroup` (single-line and multi-line).
- **Answers land where qualifier answers already land** and travel to the request through
  `submit_public_request`'s existing `p_details` jsonb. **Do not add a column or a second store.**
- **Free text is never required.** These are "anything else" boxes; a required one blocks a sale.
- ⚠️ **Trim and bound free-text length** before it reaches the RPC.

## A6 — ONE WORD FOR THE ACT: **inquire**. "Booking" only when it is on the calendar.

**Owner's ruling, 2026-08-16, and his reasoning:**

> *"request a service is a bit more finite, like they are committing to it blindly without having all
> the details… inquire keeps it premium and honors the uncertainty."*

> *"inquire about booking for lessons. inquire about {service name} service for horse care and
> acquisition."*

**Why this is right, and not merely a tone preference:** a horse-care or acquisition client does not
yet know what they are buying — price is on inquiry and the scope gets shaped on the call. "Request"
would have them committing to something undefined. **"Inquire" is accurate about their state of
knowledge, not just softer.**

**THE GOVERNING RULE — testable:**
> **"Book" / "booking" may only describe something that exists on the calendar.** A submission is
> never a booking: staff call, agree the time, and only then is there a calendar entry.

**"Request" as user-facing copy is retired.** (Internal identifiers keep the word — see scope below.)

### The wording, by funnel

| funnel | the act |
|---|---|
| **Lessons** | **Inquire about booking** |
| **Horse care** | **Inquire about {service name} service** |
| **Acquisition** | **Inquire about {service name} service** |

⚠️ **`{service name}` needs a rule when more than one service is selected.** Name the single service
when there is one; fall back to a plural form when there are several. **Propose the exact fallback
strings in the report and let the owner confirm** — do not invent them silently.

### ⚠️ `inquiryLabel()` ALREADY DOES THIS — update it, do NOT collapse it
`src/lib/inquiry.ts` is already category-aware and already produces
`"Inquire about this lesson"` / `"…this service"` / `"Inquire about finding your horse"`. **It was
built for exactly this ruling.** Keep the helper and the per-category variation; change the strings
to the owner's wording above and extend it to name the service where it currently says "this
service".

### What is there today — five words for one act on a single journey (measured 2026-08-16, verify)

| file | line | today | becomes |
|---|---|---|---|
| `Lessons.tsx` | 280 | `label="Continue to Booking Request"` | `Continue to Inquiry` |
| `Checkout.tsx` | 55 | `useDocumentTitle('Send an Inquiry')` | keep — already correct |
| `Checkout.tsx` | 298 | `'Send us your inquiry'` (signed out) | `Your Inquiry` |
| `Checkout.tsx` | 546 | `'Your inquiry'` | `Your Inquiry` (title case) |
| `Checkout.tsx` | 264 | `'Your request is empty'` | `Your inquiry is empty` |
| `lib/inquiry.ts` | `inquiryLabel()` | `"Inquire about this lesson"` … | owner's wording, above |
| `Confirmation.tsx` | — | `"Your note just landed"` / `"You Reached Out"` | `Your Inquiry Is With Us` |
| `OfferingCatalog.tsx` | 28, 182 | `'Inquire for pricing'` / `'Inquire'` | `Price on inquiry` |
| `BookHorse` `BookRider` `BookSupport` `Checkout` | — | `'Price on enquiry'` | `Price on inquiry` |

⚠️ **Two spellings are live at once** — `"Price on enquiry"` (British) beside `"Inquire"`
(American), sometimes on one screen. **Standardise on the American spelling throughout**, since the
chosen act word is *inquire*.

**Scope discipline:**
- **The nav does not change.** *Book a Lesson*, *Horse Care Services*, *Find a Horse* stay exactly as
  they are — confirmed twice. A nav item names the destination; it does not claim a calendar entry.
- `state.inquirySummary`, `InquiryCategory`, `intent: 'inquiry'`, the `requests` table and
  `submit_public_request` are **internal identifiers, not copy — leave every one of them alone.**
  Renaming code here would collide with three queued tasks for no user-visible gain.
- **`Shop.tsx:56` (`actionLabel="Inquire"`)** is on the hidden `/shop` route, which redirects to
  `/lessons`. Already correct; **do not spend time reviving the page.**

## A6b — ⚠️ ONLY LESSONS COLLECTS AVAILABILITY — AND IT IS RANGES, NOT A CALENDAR

**Owner, 2026-08-16:** *"the submission for lessons doesnt have a calendar type date picker, they
have ranges for every factor in the date and time selection."*

**Measured and confirmed:** `src/components/AvailabilityPicker.tsx` — legend *"When could you come
out?"* — collects **preference ranges, never a specific appointment**:
- **weekday AM / PM** and **weekend AM / PM** toggles,
- **multi-select weeks** (paginated, `WEEKS_PER_PAGE = 4`),
- **day-of-week** toggles, plus an "any day" option.

**Nowhere in any spec should this be called a date picker.** The visitor never names a slot — they
describe when they are free, and staff choose the actual time on the call. **This is precisely why
"inquire" is the honest word for this funnel too.**


**Owner, 2026-08-16:** *"we are removing the date selection from the form on the step 4 page of the
submission for horse care, the only flow with a date selection portion is the lessons page. and that
is by design."*

**This reverses what `TASK-THREEFORMS` said** (it gave horse care a date picker) and it **changes
`TASK-CAREPATH`'s submit screen.** The client never proposes a horse-care date; **staff set it on
the call**, which is already `CAREPATH` §C7 — so the two now agree, and the client is never asked
for a date they cannot know is available.

| funnel | client picks a date? |
|---|---|
| **Lessons** | ✅ yes — the only one |
| **Horse care** | ❌ no — staff schedule after the conversation |
| **Acquisition** | ❌ no — nothing to schedule |

**Remove any horse-care date/availability control from the submit screen** and confirm nothing else
depended on it. **`proposed_times` stays in use for lessons only.**

## A7 — report the overlap with `form_definitions`, do not merge it
The pre-sale answers duplicate part of each post-sale intake form (breed, age, behaviour, medical).
**Report the overlap per service.** Do **not** rewire the intake forms in this task —
`CAREPATH` §C10 owns the intake moment. **This is a finding to hand over, not work to do here.**

---

# TRAPS
- **Do not hardcode three JSX branches per funnel.** That structure is the defect.
- **No silent fallback set.** An unmapped offering asks nothing and is reported.
- **Never parse offering names** for cadence, quantity or identity. Catalog fields only.
- **Do not delete `how_many_horses` / `wants_lessons`** before Owner Question 3 is answered.
- **Do not invent answer options** the owner did not give — propose them and wait.
- **`CAREPATH` runs next against these same two pages.** Keep the change to *what is asked*; leave
  the step tracker, buttons, modal and submit screen to CAREPATH.
- `assertWrote()` on every write; **RLS silently zeroes UPDATEs.**
- **Migrations never contain `BEGIN`/`COMMIT`**; dry-run and **prove the rollback**.
- **Never symlink `node_modules` across case-variant paths** (`/Users/Cactai` vs `/Users/cactai`
  loaded React twice and nulled every hook, 2026-08-16).
- **Run the PGlite suite** (`vitest run`, capped workers, kill your processes before reporting).
  **Not a green baseline — 46 pre-existing red files; diff against `main`.**

---

# THE TEST THIS MUST PASS
1. Selecting **clipping alone** asks the shared six plus the two clipping questions — and **never**
   asks what is bringing them to horse care, or for how long.
2. Selecting **training alone** asks the shared six plus its three.
3. Selecting the **weekly exercise** offering asks all eleven; the **à la carte** exercise offering
   asks nine — **name the catalog field that decides it.**
4. Selecting **two horse-care services** renders: one shared section of the six, **once**, then a
   named section per service with only its extras — and **every question from both lists is present
   exactly once**. Prove coverage, not just de-duplication.
4b. Selecting **one** offering renders **no** shared section.
4c. Selecting offerings whose lists **do not overlap** renders no shared section, and every
    question still appears.
4d. A cart mixing categories does **not** merge questions that merely look alike — prove that
    training's *breed of your horse* and the finder's *preferred breed* stay separate, and **state
    the keying scheme** that guarantees it.
4e. **The owner's example — a lesson, an evaluation and horse training in one order** — renders
    exactly: one *About you* section, then a section per offering. **The experience question appears
    once. Age and breed appear twice, under the two different horses.**
4f. **Adding an offering after answering extends the form and re-asks nothing.** Removing one hides
    its section, keeps its answers for a re-add, and **submits only what is still in the cart.**
4g. ⚠️ **THE CROSS-ENTRY CASE.** A cart holding a **horse-care or acquisition item** whose visitor
    presses **Continue on `/lessons`** is shown **page 2 with those offerings' questions** before the
    form. Prove it from the lessons page specifically — this is the defect §A0 exists to prevent.
4h. **Lessons alone still goes straight to the form** — and prove the skip is because **nothing in
    the cart has questions**, not because the page is hardcoded to skip.
4i. **One mixed order = ONE `requests` row** carrying every offering and every answer. Query output.
4j. **All three funnels reach the SAME submission form component** — prove no second form exists.
4k. ⚠️ **Horse Finder + Horse Training in one order** (§A3b): answering *"not yet"* to owning the
    horse **suppresses** the age/breed/behaviour/injury/prior-training questions instead of showing
    unanswerable fields, the order records that the horse is still to be acquired, and those answers
    are **not** filed as describing a horse the client already owns.
4l. The two ownership questions — the rider's *"a horse"* and horse care's *"the horse"* — **remain
    separate**, and a client who owns one horse while seeking another can answer them differently.
4m. **The inference works and is visible** (§A3c): a client who owns the horse they want serviced,
    and who also holds an acquisition item, finds *"do you currently own or lease a horse?"*
    **already answered** — visibly, and editable.
4n. **The inference is one-way** — owning *a* horse never prefills owning *the* serviced horse.
4o. **A derived answer follows its source until the visitor edits it**, and **never afterwards**.
    Prove both halves: change the source and watch it update; edit the derived answer, change the
    source again, and watch it hold.
4p. **Staff can tell a derived answer from a given one** — name where that distinction is stored.
5. **Horse Finder** and **Acquisition Assistance** ask the nine-question set; the experience question
   carries the new wording, **no help line**, and the original four options.
6. **Horse Evaluation** asks its own eight, with the **three** experience options — proving options
   are per-set.
7. An offering with no mapped set asks **nothing**, and this is reported — no fallback.
8. Free-text answers reach `requests` through the existing `p_details` path — query output — and are
   **never required**.
9. No second answer store, and no second qualifier component beyond the free-text sibling.
10. The `form_definitions` overlap is reported per service.
11. Every DB claim is query output; render claims **NOT VERIFIED** with a numbered owner checklist.

---

# OWNER QUESTIONS — ask before building, do not assume

1. **Answer options for the shared horse block.** You gave the questions, not the choices. Proposed —
   confirm or correct:
   - *Own or lease* → Own · Lease · Neither yet
   - *How long have you had the horse* → Less than 6 months · 6–12 months · 1–3 years · 3+ years
   - *Age* → short text (a number)
   - *Breed* → short text
   - *Behaviour issues* → Yes / No, with a text box appearing on Yes
   - *Injuries or current health issues* → Yes / No, with a text box appearing on Yes
   - Same Yes/No-plus-detail shape for *prior training*, *issues being clipped*, and
     *horses already considering*.
2. **Should the pre-sale answers pre-fill the post-sale intake form?** Today a client would give
   breed, age, behaviour and medical history at step 2, then again at intake. Carrying them over is
   a real saving, but it is CAREPATH §C10's territory — say whether you want it and I will place it.
3. **Are `how many horses are you considering?` and `are you interested in lessons?` being dropped
   from acquisition?** They are not in your new list. The second is a cross-sell, so I would rather
   you deleted it deliberately than have me infer it.
4. **A cart holding both a Horse Finder and a Horse Evaluation** hits the same experience question
   with two different option sets. Ask it once with the four Finder options, once with the three
   Evaluation options, or once with a merged set?
5. **Horse Evaluation Q1 "Location"** — the location of the horse being evaluated, or the client's
   own area? And **Q7 "current riding level"** sits close to **Q8 "equestrian experience"**; confirm
   you want both.
6. **Budget and age range on the Finder set** — free text, or bands you want offered?
8. **Move riding experience from the form to page 2?** It is asked on the submission form today as
   *"Riding experience (years)"*, while page 2 asks *"Which best matches your equestrian
   experience?"* for evaluations and horse searches. **A lesson + evaluation order currently asks the
   same person about their experience twice.** I recommend one `person` question on page 2 — but the
   form's version is in **years** and page 2's is in **bands**, so tell me which you would rather
   keep.
7. ~~One near-merge needs your ruling.~~ **ANSWERED — the two ownership questions stay SEPARATE.**
   See §A3b. (The orchestrator proposed merging them on the assumption that anyone booking training
   owns the horse. **The owner corrected it:** *"not necessarily, they can be asking for training on
   a horse they are asking us to help them acquire."*)

Report to `docs/reports/TASK-ASKRIGHT-REPORT.md`. Do not push; the orchestrator merges.
