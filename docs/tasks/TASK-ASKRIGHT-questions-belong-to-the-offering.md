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

## A1 — questions attach to the offering
- The step-2 question set is **derived from what is in the cart**, not hardcoded per page.
- Key it to the **catalog identity you verified** (`service_type` code, or offering slug where two
  offerings of one type diverge). **Report which you chose and why.**
- Prefer a **declarative definition** (a data structure, or `form_definitions`-style rows) over
  three hand-written JSX branches. Three branches is how this bug was born.
- **An offering with no defined set asks nothing** — it must not silently fall back to the exercise
  questions, which is precisely today's defect.

## A2 — one shared "About Your Horse" block, asked ONCE
**Questions 1–6 are identical across training, clipping and exercise.** They describe the horse, not
the service. **Ask them once**, even when the cart holds two horse-care services.

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

## A6b — ⚠️ ONLY THE LESSONS FUNNEL HAS A DATE PICKER

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
4. Selecting **two horse-care services** asks the shared six **once**, then each service's extras.
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

Report to `docs/reports/TASK-ASKRIGHT-REPORT.md`. Do not push; the orchestrator merges.
