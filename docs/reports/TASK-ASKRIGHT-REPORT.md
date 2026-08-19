# TASK-ASKRIGHT — report

**Branch `task/askright`, commit `f81cd5a`, off `main` = `56ef214`. Committed, NOT pushed.**
Built 2026-08-17. Typecheck clean; lint 0 errors / 39 warnings — byte-identical to `main`'s
warning set. **No migration, no SQL, no schema change.**

---

## THE HEADLINE FINDING — the answers have never reached the database

Before anything else, because it changes what this task is:

```
 total_requests | with_details | how_many_horses | wants_lessons | experience | horse_reason | horse_duration
----------------+--------------+-----------------+---------------+------------+--------------+----------------
             16 |            0 |               0 |             0 |          0 |            0 |              0
```

```sql
SELECT jsonb_object_keys(details) AS key, count(*) FROM requests WHERE details <> '{}'::jsonb GROUP BY 1;
-- (0 rows)
```

**All 16 production requests carry an empty `details` jsonb.** `Checkout.tsx` never passed
`p_details` to `submit_public_request`, so **every step-2 answer this site has ever collected was
discarded at submit.** The qualifier answers lived in cart state, were shown back on the review
step, and were dropped on the floor when the visitor pressed the button.

Two consequences:

1. **Dropping `how_many_horses` and `wants_lessons` loses nothing stored** — the owner asked to have
   this checked before the surface went away. There is nothing to migrate and nothing to preserve.
2. **This task is not only "fix which questions are asked."** It is the first time any page-2 answer
   reaches the database at all. That is why §A5's `p_details` wiring is in the diff.

---

## 1. Verification of the doc's own measurements

The task doc's measurements were taken at `9c2d011`; `main` is now `56ef214`. Everything was
re-verified against live code and the live catalog before being built on.

| doc says | verified? | what is actually true |
|---|---|---|
| `QualifierGroup` is single-select only, writes `Record<string,string>` | ✅ | Exactly. `src/components/QualifierGroup.tsx` renders a `role="radiogroup"` and calls `setQualifier(key, value)`. |
| No free-text qualifier component exists | ✅ | Confirmed. Built as `QualifierText.tsx` (§A5). |
| `BookHorse.tsx:135-162` asks `horse_reason` + `horse_duration` of every horse-care buyer | ✅ | Confirmed verbatim, including the clip-buyer-asked-about-injury-recovery case. |
| `BookSupport.tsx:139-186` asks `experience`, `how_many_horses`, `wants_lessons` of everyone | ✅ | Confirmed. |
| `form_definitions` seeds `INTAKE_HORSE_*` rows | ✅ | 28 rows live; the five named ones exist. |
| Codes include `HORSE_SEARCH_RETAINER` | ❌ **WRONG** | **No such service_type exists.** See the live catalog below. |
| **`cadence` is the recurring/one-off field** | ❌ **WRONG** | See §1b. It is `offerings.config_kind`. |

### 1a. The live catalog — the true `service_type` codes and offering slugs

```
   segment   |       service_type        |             slug              |        name         | config_kind          | weekly_frequency
-------------+---------------------------+-------------------------------+---------------------+----------------------+------------------
 acquisition | HORSE_EVALUATION          | horse-evaluation              | Horse Evaluation    | intake_evaluation    |
 acquisition | HORSE_FINDER              | horse-finder                  | Horse Finder        | intake_finder        |
 acquisition | HORSE_PURCHASE_ASSISTANCE | acquisition-assistance        | Acquisition Assist. | document_transaction |
 horse       | HORSE_CLIPPING            | hair-clipping--item-ff1cec9b  | Bridle Path & Ears  | scheduled            |
 horse       | HORSE_CLIPPING            | hair-clipping--item-82fe52e7  | Legs & Face Clip    | scheduled            |
 horse       | HORSE_CLIPPING            | hair-clipping--item-35783d05  | Full Body Clip      | scheduled            |
 horse       | HORSE_EXERCISE            | riding-turnout--item-95804137 | Turnout Session     | scheduled            |
 horse       | HORSE_EXERCISE            | horse-exercise--item-980e2dc9 | Exercise Session    | scheduled            |
 horse       | HORSE_EXERCISE            | horse-exercise--item-73441c62 | Exercise 1x Weekly  | recurring            | 1
 horse       | HORSE_EXERCISE            | riding-turnout--item-e8f8fb83 | Turnout 1x Weekly   | recurring            | 1
 horse       | HORSE_EXERCISE            | riding-turnout--item-96f76b36 | Turnout 2x Weekly   | recurring            | 2
 horse       | HORSE_EXERCISE            | horse-exercise--item-c787e6e5 | Exercise 2x Weekly  | recurring            | 2
 horse       | HORSE_TRAINING            | horse-training--item-be05aa48 | Training Session    | scheduled            |
 horse       | HORSE_TRAINING            | horse-training--item-26473789 | Training 1x Weekly  | recurring            | 1
 horse       | HORSE_TRAINING            | horse-training--item-c83c1021 | Training 2x Weekly  | recurring            | 2
 rider       | RIDING_LESSON             | (8 SKUs)                      |                     | scheduled/recurring  |
 rider       | HORSEMANSHIP_TRAINING     | (2 SKUs)                      |                     | scheduled            |
```

**Three acquisition service_types have NO active offering** and therefore never reach a cart:
`HORSE_SALE_ASSISTANCE`, `HORSE_LEASE_IN_ASSISTANCE`, `HORSE_LEASE_OUT_ASSISTANCE`. `JUMPER_TRAINING`
likewise has none. They are correctly unmapped (see finding F5).

### 1b. ⚠️ `cadence` IS THE WRONG FIELD — the answer is `config_kind`

The doc said "`cadence` appears ~69 times in migrations… find it and key off it." **Do not.** Every
occurrence belongs to `client_purchases.cadence` — and `client_purchases` is a **RETIRED table**
(`CLAUDE.md`, "RETIRED — do not resurrect"). It has no bearing on the catalog.

**The authoritative field is `offerings.config_kind`**: `'recurring'` = the weekly, monthly-billed
SKU; `'scheduled'` = the à la carte session. It is corroborated by `weekly_frequency` (set only on
recurring rows) and by `price_unit` (`month` vs `session`). It already rides on `CartItem.configKind`,
so nothing new had to be plumbed. **This is what decides whether the exercise reason/duration pair is
asked**, and it is a catalog field, never a parsed name.

---

## 2. What was built

### The keying scheme (§A2b, test 4d) — **`subject.questionId`**

Every question declares one of four subjects, and **two questions merge only when they are the same
question about the same subject.** The answer key is `subject` + `questionId`:

| the three "breed" questions | key | can they collide? |
|---|---|---|
| Training: *What breed is the horse?* | `client_horse.breed` | |
| Evaluation: *Breed* | `evaluated_horse.breed` | **no — different subject** |
| Finder: *Are there specific breeds you prefer?* | `sought_horse.breed_pref` | **no — different subject and id** |

Ages are keyed the same way (`client_horse.age` vs `evaluated_horse.age` vs `sought_horse.age_range`).
A merge is not "avoided by care" — it is **structurally impossible**, because the subject is half the
key.

### Section identity is the **`service_type`**, not the offering (§A1 — reporting the choice, as asked)

The doc allowed "`service_type` code, or offering slug where two offerings of one type diverge."
**`service_type` was chosen.** The reason is a cart holding *Training Session* **and** *Training 1x
Weekly*: keying sections to offerings would render **two identical Horse Training sections**, and the
shared-section rule would then hoist all six horse questions into a "shared" block above them — an
absurd screen produced by correct code. Keying to `service_type` collapses them into one section, and
matches the owner's own worked example, whose headings are *"Horse Training"* and *"Horse Evaluation"*
— service names, not SKU names.

**Where two SKUs of one type diverge, the divergence is expressed per QUESTION, not per section**:
`appliesWhen: hasRecurringExercise` on exercise Q10/Q11. That is the only divergence the owner
specified, and it needed no second section.

Section **headings** come from `service_types.display_name`, carried on the cart item at selection
time (`CartItem.serviceTypeName`), so renaming a service in the DB renames the heading (D13). The
fallback humanizes the service_type **CODE** — identity, stable — and never the offering name.

### Files

| file | what |
|---|---|
| **`src/lib/questionSets.ts`** *(new, 600 lines)* | The declarative definitions + the assembly engine, the derivation rules, and the submission serializer. **This is the whole payload as data.** |
| **`src/components/QuestionSections.tsx`** *(new)* | Page 2. Assembles from the cart at render time and dispatches each question to one of the two answer components. Mounted by all three entry points. |
| **`src/components/QualifierText.tsx`** *(new)* | §A5's free-text sibling — single-line, multi-line, and the inline variant used for a Yes/No follow-up box. |
| **`src/pages/Questions.tsx`** *(new)* | The `/questions` route: page 2 for a visitor who did not come through a funnel that has one. |
| `src/contexts/CartContext.tsx` | `answerOrigins` + `SET_DERIVED_QUALIFIER` + `WITHDRAW_DERIVED`. |
| `src/components/QualifierGroup.tsx` | `derivedFrom` prop — the visible "we filled this in" line. |
| `src/pages/BookHorse.tsx` · `BookSupport.tsx` | Step 1's hardcoded blocks replaced by `<QuestionSections />`. |
| `src/pages/Lessons.tsx` | The cross-entry decision (§A0). |
| `src/pages/Checkout.tsx` | Lesson-only fields; **answers now travel to the RPC**. |
| `src/lib/inquiry.ts` · `cart.ts` · `Confirmation.tsx` · `OfferingCatalog.tsx` · `ServiceSelector.tsx` · `BookRider.tsx` · `App.tsx` | §A6 wording, the shared display-name helper, the route. |
| **`src/lib/questionSets.test.ts`** *(new)* | 74 tests, numbered to the doc's own test list. |

### Where the answers land (§A5, and the answer to 4p / 4s)

Both existing staff readers of `requests.details` — `LeadWorkDrawer.tsx`'s list and
`api/request-received.ts`'s alert email — **stringify each value**. A nested payload would reach the
owner's inbox as `[object Object]`. So `details` is **flat**, one entry per answered question, with a
**self-describing key**: `"{subject label} — {question}"`. Both readers render it correctly with **no
change to either surface**.

Because jsonb does not preserve key order, the same answers **also** go into `requests.notes` as an
ordered block — precisely the pattern availability already uses (structured in `proposed_times`, prose
in `notes`). `notes` carries a 4000-char CHECK; `capNotes()` truncates at 3900 so a long inquiry can
never be lost to an RPC exception raised *after* the visitor pressed submit.

---

## 3. THE TEST THIS MUST PASS — evidence

**74 automated tests, all passing**, in `src/lib/questionSets.test.ts`. Fixtures use the **live**
offering ids, service_type codes and `config_kind` values queried above.

```
 RUN  v4.1.9 /Users/Cactai/Downloads/claude-code-repo/wt-askright
 Test Files  1 passed (1)
      Tests  74 passed (74)
```

| # | claim | status | evidence |
|---|---|---|---|
| 1 | clipping alone = shared six + its two; **never** reason/duration | ✅ | `describe('1 — clipping alone')`, incl. an explicit `not.toContain` on both. |
| 2 | training alone = shared six + its three | ✅ | asserted as an exact ordered list. |
| 3 | weekly exercise = 11, à la carte = 9 | ✅ | exact counts. **The catalog field that decides it: `offerings.config_kind`.** |
| 4 | two horse-care services: one shared six, then extras — **coverage proven** | ✅ | The union is recomputed **from `SETS`, independently of the engine**, then compared. Duplicate-freeness asserted separately. |
| 4b | one offering → no shared section | ✅ | four services, table-driven. |
| 4c | non-overlapping lists → no shared section, nothing lost | ✅ | training + evaluation. |
| 4d | lookalikes never merge; **keying scheme stated** | ✅ | three breeds + two ages coexist; scheme is `subject.questionId` (§2 above). |
| 4e | lesson + evaluation + training → **exactly two sections, no shared** | ✅ | `['Horse Evaluation','Horse Training']`; experience once under Evaluation; age and breed twice, correctly. Adding a Finder hoists experience into the shared batch — also asserted. |
| 4e2 | Finder + Evaluation → experience **once**, shared batch, unified list | ✅ | plus a guard that the banned clarifier words never appear in the rendered question. |
| 4f | add extends and re-asks nothing; remove hides but keeps; **submits only what is in the cart** | ✅ | proven through `buildSubmission`. |
| 4g | **cross-entry**: horse-care/acquisition item + Continue on `/lessons` → page 2 | ✅ | `cartHasQuestions` true for both mixes. `Lessons.tsx` routes to `/questions`. |
| 4h | lessons alone → straight to the form, **because nothing asks** | ✅ | `assembleSections([lesson])` is `[]`, and `RIDING_LESSON` has no entry in `SETS`. No page is hardcoded to skip. |
| 4i | one mixed order = **ONE** `requests` row with every offering and every answer | ✅ | **live RPC, §4 below.** |
| 4j | all three funnels reach the SAME form component | ✅ | `Checkout.tsx` is the only form; `grep` for a second is empty. `FUNNEL_BACK`/`FUNNEL_LABELS` are display config on that one component. |
| 4k | "not yet" suppresses the unanswerable questions and refiles the rest | ✅ | seven suppressed keys asserted; gate + goals still asked; `Horse status` recorded; **no key starts with "Your horse —"**. |
| 4k2 | §A3f — mixed cart asks **nothing extra**, no special routing | ✅ | the asked set equals the plain union of the two sets; no question anywhere contains "which horse"/"same horse". |
| 4l | the two ownership questions stay separate | ✅ | a client answers `not_yet` to the serviced horse **and** "I currently own or lease a horse" in the same submission. |
| 4m | the inference works and is visible | ✅ | own **and** lease both conclude it; rendered as an italic line the visitor can see and change. |
| 4n | one-way only | ✅ | no rule targets `client_horse.own_or_lease`; asserted. |
| 4o | follows its source until touched, never after | ✅ | **both halves.** `not_yet` withdraws it (returns `null`); the reducer refuses to overwrite once `answerOrigins` has been cleared by a user edit. |
| 4p | staff can tell derived from given | ✅ | **live row, §4.** The value itself says `auto-filled from "…", not typed by the client`. |
| 4q | the owner's full scenario, from all three entry pages | ✅ | two sections; experience once under Acquisition, prefilled; lessons add nothing; the same cart gives the same page whatever order it was built in. |
| 4r | buying the leased horse links the subjects | ✅ | option offered **only** on `lease`; breed prefills to `Warmblood`, age range to `7–10`; **budget, boarding and use still asked.** |
| 4s | the link is legible to staff | ✅ | **live row, §4** — `"Buying the horse they lease"`, and the first line of the notes block. |
| 5 | Finder and Assistance ask the same nine | ✅ | identical ordered lists; owner's budget and age bands asserted verbatim. |
| 6 | Evaluation asks its own eight, three experience options | ✅ | exact order, incl. *"Where is the horse located?"*. Riding level and experience both present, unmerged. |
| 7 | unmapped offering asks **nothing** | ✅ | `HORSE_SALE_ASSISTANCE` produces no section and never inherits another set's questions. |
| 8 | free text reaches `requests`, bounded, never required | ✅ | **live row, §4**; 5000 chars bound to ≤601; no question carries `required`. |
| 9 | no second answer store, one new component only | ✅ | `qualifierAnswers` is still the only store. `QualifierText` is the only new answer component. |
| 10 | `form_definitions` overlap reported per service | ✅ | §5, finding F1. |
| 11 | DB claims are query output; render claims marked NOT VERIFIED | ✅ | §4 and §7. |

### ⚠️ One acceptance line is stale and was overruled by the owner

Test **5** still reads *"the experience question carries … the original four options."* Owner
Question 4 was answered after that line was written: **one question, one list, the possession-pure
trio.** The trio is built. §A4's own body carries the same stale sentence ("keep the four existing
options unchanged (but see Owner Question 4)"). Flagging rather than silently choosing.

---

## 4. Live production evidence (run inside `BEGIN … ROLLBACK`, prod not polluted)

The payload was **generated by the shipped code** — `buildSubmission()` run over the owner's full
§A3d scenario (leasing a horse, wants exercise for it, wants lessons, ready to buy, and wants to buy
the horse they lease) — then fed to the real `submit_public_request` RPC.

```
### 4i — ONE requests row for a three-category order
 requests_rows | distinct_ids
---------------+--------------
             1 |            1

### 4i — that ONE row carries every offering
       label        | offering_id_is_null
--------------------+---------------------
 Exercise 1x Weekly | t
 Horse Finder       | t
 Single Lesson      | t

### 8 — every answer landed in requests.details via p_details
 detail_answers
----------------
             21

### 4p / 4s — derived answers and the lease link are legible in the row
 About you — Which best matches your equestrian experience?            | I currently own or lease a horse (auto-filled from “Do you own or lease the horse?”, not typed by the client)
 Buying the horse they lease                                           | Yes — they want to buy the horse they currently lease with us
 Horse you are looking for — Are there specific breeds you prefer?     | Warmblood (auto-filled from “the horse you currently lease”, not typed by the client)
 Horse you are looking for — Is there a specific age range you prefer? | 7–10 (auto-filled from “the horse you currently lease”, not typed by the client)

### free text arrived intact, and notes stayed under the 4000-char CHECK
 If buying him is possible I would rather do that than start a search. |      2011
```

**All 21 answers land. One row. Three offerings. The derived answers say they are derived. The lease
link is a labelled field, not something a reader has to infer.**

⚠️ **`offering_id_is_null = t` on all three is a PRE-EXISTING production defect, not new.** See
finding F3.

---

## 5. Findings — handed over, not built

### F1 — §A7: five intake definitions exist as data with **no way to reach them**

Confirmed by grep across `src/` and `api/`: **nothing references `INTAKE_HORSE_CLIPPING`,
`INTAKE_HORSE_EXERCISE`, `INTAKE_HORSE_EVALUATION`, `INTAKE_HORSE_FINDER` or
`INTAKE_HORSE_LEASE_IN`.** `form_definitions` is read by exactly two things: the admin forms listing
(`admin_form_definitions`) and `SessionActivityForm` (which uses `ACTIVITY_SESSION`). They are paper-form
imports with no surface. **Not wired, as instructed.**

**The overlap per service** — the field labels the inquiry now collects that those definitions also
carry, should they ever be surfaced (this is test 10):

| service | intake definition | overlapping fields |
|---|---|---|
| Training | `INTAKE_HORSE_TRAINING` | **Age · Breed · Known Vices** (≈ behaviour) **· Known Medical Conditions** (≈ injuries) **· Under Saddle / Ground Handling** (≈ riding history) **· Specific Goals / Primary Goal** (≈ training goals) |
| Clipping | `INTAKE_HORSE_CLIPPING` | **Age · Breed · Behavioral Information · Special handling considerations** (≈ clipping issues) |
| Exercise | `INTAKE_HORSE_EXERCISE` | **Age · Breed · Behavioral Considerations · Known Medical Conditions · Current Level of Training** (≈ prior training) **· Desired Frequency** (≈ duration) |
| Evaluation | `INTAKE_HORSE_EVALUATION` | **Age · Breed · Horse Location · Intended Use · Known Behavioral Concerns · Known Medical History · Training History · Experience Level of Intended Rider** (≈ riding level) |
| Finder | `INTAKE_HORSE_FINDER` | **Breed Preferences · Desired Age Range · Target/Maximum Budget · Purpose of Horse · Horse Ownership Experience** (≈ the experience question — the definition's own label confirms the owner's reading that it is a **possession** question) **· Current Riding Level** |

The activation intake that actually runs is `HorseIntakeForm.tsx`, and **Owner Question 2 is already
answered**: ask whether it is the same horse before prefilling, only `client_horse` answers may ever
prefill, and it is built in **`CAREPATH` §C10** — not here.

### F2 — §A3e: lease is not own, and the horse record still cannot say so

Re-verified on `main`. `horses.current_owner_contact_id` is a single FK to one contact and is the
only ownership representation; `my_stable_horses` derives `is_owner` from it; **nothing on a horse
says "this person leases me."**

- **What the inquiry now captures:** `client_horse.own_or_lease` as **three distinct values** —
  `own`, `lease`, `not_yet` — never a merged "yes". It lands in `requests.details` as
  *"Your horse — Do you own or lease the horse?" → "I lease the horse"*.
- **Where it will have nowhere faithful to go:** **`CAREPATH` §C10's horse intake has no column for
  it.** Recording a lessee as `current_owner_contact_id` is a false ownership claim (and the wrong
  answer when the real owner must authorise care); leaving it elsewhere means the horse never appears
  in the lessee's stable. **The inquiry will assert a fact the horse record cannot hold.**
- **No schema change was made here**, as instructed. Adding a lease relationship touches `horses`,
  RLS, `my_stable_horses`, staff horse records and the lease contract engine — its own task.

### F3 — every `request_selections` row in production has a NULL `offering_id`

```sql
SELECT rs.offering_id IS NULL AS no_offering_id, rs.offering_slug, rs.label FROM request_selections rs …
 t | 85cab901-959c-43ac-b2bf-dd3b7dec9f64 | Evaluation Lesson
 t | a7968835-b46e-4911-9484-894b375ae4a8 | 1x Weekly
 …  (7 of 7 rows)
```

**Cause:** `Checkout.tsx` sends `offering_slug: i.offeringId` — and `cart.offeringId` is the offering
**UUID**, not the slug. `submit_public_request` resolves selections by `WHERE o.slug = …`, never
matches, falls into its `IF NOT FOUND` branch and writes a row with the UUID in the slug column and
`offering_id` NULL. **It ignores an `offering_id` key even when one is supplied** — my proof passed one
and it was still NULL.

**Consequence:** an inquiry's offerings are linked to the catalog by **label text only**. `CAREPATH`
§C5b turns an inquiry into a draft order, which needs the real id.

**The fix (2 lines, additive, NOT applied here — it is a pre-existing defect and a migration this
task was not scoped to make):**
```sql
-- in submit_public_request's selections loop
WHERE (o.id = nullif(v_sel->>'offering_id','')::uuid OR o.slug = (v_sel->>'offering_slug'))
  AND o.org_id = v_org
```
plus `offering_id: i.offeringId` at the Checkout call site.

### F4 — the member path drops the answers

A **signed-in** visitor at `/checkout` does not submit an inquiry: `handleStartPurchase()` calls
`createDraftOrder()` and goes to the order hub. **Page-2 answers have no carrier on that path** —
`createDraftOrder` takes items and a subtotal. This is the same class of gap as the headline finding,
on the other branch. **`CAREPATH` §C5b owns the draft-order model**; naming it there is more useful
than half-wiring it here.

### F5 — offerings with no question set (test 7, reported as required)

Nothing in the live catalog reaches a cart unmapped. For completeness, the service_types with **no**
set are: `RIDING_LESSON`, `HORSEMANSHIP_TRAINING`, `JUMPER_TRAINING` (by design — lessons ask
nothing), and `HORSE_SALE_ASSISTANCE`, `HORSE_LEASE_IN_ASSISTANCE`, `HORSE_LEASE_OUT_ASSISTANCE`,
`ONBOARDING`, `INDEPENDENT_CONTRACTOR` (**no active offerings — they cannot be selected**). Should the
owner activate a sale or lease-assistance SKU, **it will ask nothing** until a set is written. That is
the designed behaviour, not a fallback.

### F6 — ⚠️ Turnout is not its own service; it inherits the Exercise questions

The four **Turnout** SKUs (`Turnout Session`, `Turnout 1x/2x Weekly`) carry
`service_type = 'HORSE_EXERCISE'`. So a turnout buyer gets the exercise set, including
*"What type of riding has the horse done with you, and prior to you?"* — **which is an odd question
to ask about turnout.** Either turnout wants its own `service_type` (a catalog change, owner's call)
or the shared set is accepted. **Not guessed; flagged.**

### F7 — `/book/rider` is a second rider funnel that still asks rider questions

`/book/rider` → `BookRider.tsx` is a live route with its own step 2 asking `owns_horse`, `boarding`
and `wants_horse`. It contradicts the owner's ruling that *"the rider questions are already on the
lesson form. there is nothing to add and no separate questions for them."* It is **not linked from the
nav or from any page** (grep: only `App.tsx` references it). **Left alone** — deleting a surface is not
this task's call. **Recommendation:** redirect it to `/lessons`, exactly as `/shop` and `/ride`
already do. One line.

### F8 — a mixed cart's `requests.category` is decided by the last page visited

`Checkout.tsx` sets `category` from `state.funnel`. A three-category order submitted from `/lessons`
is filed as `lessons`. `requests_category_check` has no `mixed` value, so something must win.
Unchanged here (it is submission-screen behaviour, CAREPATH's territory) but it means **staff filters
will under-count mixed orders.**

### F9 — no further inferences were invented (§A3c scope)

Two additional implications were noticed while transcribing the sets and are **listed for the owner to
rule on, not built**:

1. `sought_horse.lease_or_buy = 'lease'` **plus** `client_horse.own_or_lease = 'lease'` → they are
   probably comfortable leasing. *Weak; recommend NOT building — it concludes a preference from a
   circumstance.*
2. `client_horse.own_or_lease = 'not_yet'` **plus** an acquisition item in the cart → the care service
   is for the horse we will find. *Plausible, and it would let the care answers be filed against the
   sought horse automatically — but §A3f rules explicitly that this ambiguity is resolved on the call,
   not by the form. Recommend NOT building.*

---

## 6. Decisions I made, and the ones still open

### Judgment calls made (each reversible in one line — say the word)

| # | call | why |
|---|---|---|
| J1 | **Nothing on page 2 is required.** Continue is always enabled. | §A5: "a required one blocks a sale." Today both funnels gate Continue on one answer; that gating is gone. **This is a behaviour change — reverse it if you want the gate back.** |
| J2 | **Shared section heading: "First, a few details".** | You never named it. It has to be neutral: it can hold questions about the person *and* about their horse at once. |
| J3 | **`OfferingCatalog.tsx:182`'s `'Inquire'` BUTTON was left alone.** | §A6's table maps it to "Price on inquiry" alongside the price string — but that is an **action button**, and "Price on inquiry" is a price statement. Only the price string changed. |
| J4 | **`Confirmation.tsx`'s display heading "We Are So Glad / You Reached Out" kept.** | It contains neither retired word. "Your Inquiry Is With Us" now carries the page title and the eyebrow, and the body reads "It just landed with us". Overrule and I will put it in the H1. |
| J5 | **`/lessons`' button says "Continue" when the cart has questions**, "Continue to Submit Inquiry" when it goes straight to the form. | The owner's table gives one string, but with page 2 inserted that string would name a page that is not next. "Continue" is the existing vocabulary of the other funnels' non-final steps, not invented copy. |
| J6 | **The `A3d` option is offered only on `lease`, never on `own`.** | You cannot buy a horse you already own. The spec said "lease or own one"; offering it to an owner would be a nonsense choice. |
| J7 | **`not_yet` WITHDRAWS a still-derived experience answer** rather than setting it to something. | "Not yet" proves nothing about whether they own *a* horse — they may own another. Concluding either way would be a wrong answer they never got to catch. |
| J8 | **`/questions` is a route; the two funnels keep their in-page step 2.** | Both mount the *same* `QuestionSections` engine — one engine, three entry points. Collapsing the funnels' steps would rewrite the step tracker, which the traps reserve for CAREPATH. |

### ⚠️ Answer options I had to choose because they were never specified

**These are the only strings in the build that are not yours.** All are one-line edits in
`src/lib/questionSets.ts`:

| question | what I built | note |
|---|---|---|
| Evaluation Q7 *"What is your current riding level?"* | **New to riding · Beginner · Intermediate · Advanced** | Borrowed from the existing `CATEGORY_FIELDS.lessons.experience_level` so the site says one thing. **Needs your confirmation.** |
| Acquisition Q4 *"Are there specific breeds you prefer?"* | **short text** | A picklist would be wrong for someone; it also has to accept the prefilled breed from a leased horse. |
| Acquisition Q8 *"What do you plan to use the horse for?"* | **short text** | |
| Evaluation Q4/Q5 *current use / planned use* | **short text** | |
| Acquisition Q7 *"Do you have a location for boarding already selected?"* | **Yes/No + detail** | Follows your "same Yes/No-plus-detail shape" instruction. |
| Acquisition Q1 *"lease, to buy, or open to either?"* | **To lease · To buy · Open to either** | The question names its own options. |
| Training/Exercise Q7 *"What type of riding has the horse done…"* | **short text** | |
| §A6 multi-service fallbacks | *"Inquire about these services"* / *"Inquire about booking and these services"* | **You asked to be shown these rather than have them invented.** Single service reads *"Inquire about Horse Clipping service"*, using the catalog's own name. |

**Owner, 2026-08-17, on the list above:** *"i can edit them after they land and i see them in
context."* Right instinct, and the reason they were built rather than held. **But see F10 — today
that edit is a code change, not something you can do yourself.**

### ⚠️ F10 — D13: THE QUESTION SETS SHIP WITHOUT AN EDITOR. THIS FEATURE IS NOT DONE.

**D13 is an acceptance criterion, and this build does not meet it.** The question sets — every
question, every answer option, every band, every section heading — live in
`src/lib/questionSets.ts`. Changing a word requires a thread and a commit. By D13's own test
(*"a feature is NOT DONE if changing it requires the owner to open a thread, write SQL, or touch
git"*), **the question sets have no editor and the work is unfinished. Saying so here rather than
calling it shipped.**

**Why it was built this way anyway, and why that was still the right call:**
- §A1 explicitly sanctioned it — *"a data structure, **or** `form_definitions`-style rows"*.
- The sets need things `form_definitions`' schema cannot express: subject keying, the §A3b gate,
  the `config_kind` condition, and the §A3c/§A3d derivation rules. Forcing them into today's row
  shape would have meant either a weaker engine or a schema change this task was not scoped to make.
- A DB read would also put a network failure between the visitor and page 2 of a funnel.

**The follow-up that finishes it — naming it, per D13's corollary.** The natural home already exists
and is already ruled on: **D12's Form builder**, whose whole purpose is authoring exactly this shape
(*products, articles and guides are built with forms*). The work is to promote `SETS` from a TS
constant to `form_definitions`-style rows with three added field properties (`subject`, `showWhen`,
`appliesWhen`), and point the Form builder at them. **Until that lands, every change on the list
above is one line and one commit — send them over and they are same-day.**

**What IS already owner-editable today, so it is not overstated:** the section **headings** and the
service name in the inquire wording both read `service_types.display_name` from the live catalog —
renaming a service in the DB renames both, with no code change.

---

## 7. ⚠️ NOT VERIFIED — the render. A numbered click-through for the owner

Everything above is proven by test output or query output. **No screen was opened.** Nothing in this
section has been seen rendering, and it is the part most likely to hold a surprise.

Start each run with an **empty cart** (the cart persists in `sessionStorage` — open a private window
or clear it between runs).

1. **`/horse` → select `Full Body Clip` alone → Continue.** Expect **8 questions in one unnamed run**:
   own/lease, how long, age, breed, behaviour, injuries, clipping issues, notes. **Expect NO
   "what is bringing you to our horse care services" and NO "how long will you need these services".**
2. **Answer "Yes" to *Does the horse have any behaviour issues?***. A **"Tell us more" box should
   appear directly under it**, attached to the same white card.
3. **Same page, choose *"Not yet — I'd like help finding one"* for question 1.** Questions 2–6 and the
   clipping-issues question should **disappear**; the notes box stays.
4. **`/horse` → select `Full Body Clip` AND `Training Session` → Continue.** Expect **three headings**:
   *First, a few details* (the six), *Horse Clipping* (2), *Horse Training* (3). Confirm the six appear
   **once**.
5. **`/horse` → `Exercise Session` (à la carte) alone.** 9 questions, **no reason/duration**.
   Then **`Exercise 1x Weekly`** — 11, **with** them.
6. **`/acquisition` → `Horse Finder` alone.** 9 questions. Confirm *"Which best matches your equestrian
   experience?"* has **three** options and **NO grey help line beneath it**. Confirm **no "how many
   horses"** and **no "are you interested in lessons"** anywhere, and that the old
   "Noted for our conversation" panel is gone from the review step.
7. **Budget and age bands read exactly `$2–5k · $5–7k · $7–10k · $10k+ · Not sure` and
   `3–5 · 5–7 · 7–10 · 10+ · No preference`.**
8. **`/acquisition` → `Horse Finder` + `Horse Evaluation`.** The experience question should appear
   **once**, in the *First, a few details* block at the top.
9. **THE CROSS-ENTRY CASE.** `/horse` → add `Training Session`. Then navigate to **`/lessons`**, add
   `Single Lesson`, and press **Continue there**. You should land on **`/questions`** and see the
   **Horse Training** section — *not* the form.
10. **Lessons alone.** Empty cart → `/lessons` → `Single Lesson` → Continue. You should go **straight to
    `/checkout`**, button reading **"Continue to Submit Inquiry"**. No questions page.
11. **THE INFERENCE.** Cart = `Training Session` + `Horse Finder`. On page 2 answer *"I lease the
    horse"*. Scroll to *"Which best matches your equestrian experience?"* — it should already show
    **"I currently own or lease a horse"** selected, with a gold italic line reading *"We filled this
    in from your answer to 'Do you own or lease the horse?' — change it if we got it wrong."*
12. **Change it yourself** to *"This will be my first horse"*. The gold line disappears. Now go back and
    change the horse answer to *"I own the horse"* — **your answer must hold.**
13. **THE LEASED HORSE.** Cart = `Exercise 1x Weekly` + `Horse Finder`. Answer *"I lease the horse"*,
    breed `Warmblood`, age `8`. Under Horse Finder, *"Have you found any horses you are already
    considering?"* should now offer a third option: **"Yes — the horse I currently lease"**. Choose it.
    **Breed and age range should fill in (Warmblood, 7–10) with the gold line**, while **budget,
    boarding and intended use stay empty and still asked.**
14. **`/checkout` with horse care only.** The **availability picker and the "Riding experience (years)"
    row must be GONE.** Add a lesson to the cart and reload — **both come back.**
15. **Submit it.** Then open the lead in **Ops → Intake → the request**, and confirm the **Details**
    list shows every answer with readable labels, and that **"Buying the horse they lease"** is visible
    when it applies. Check the alert **email** renders the same list.
16. **Wording sweep:** no screen should say *"Booking Request"*, *"Price on enquiry"* or
    *"Your request is empty"*. The **nav is unchanged** (*Book a Lesson*, *Horse Care Services*,
    *Find a Horse*).

---

## 8. Test-suite state

- **`src/` unit tests: 3 files, 86 tests, all passing** (74 of them new).
- **Typecheck:** clean. **Lint:** 0 errors, 39 warnings — **identical to `main`**.
- **`test/db` (PGlite):** run with `--maxWorkers=2`; **this task adds no migration and no SQL**, so the
  suite exercises nothing this diff changed. Result recorded in §8a.

### 8a. `test/db` result

```
 Test Files  46 failed | 25 passed (71)
      Tests  203 failed | 453 passed | 107 skipped (763)
   Duration  97.00s   (npx vitest run test/db --maxWorkers=2)
```

**46 failed files — exactly the documented pre-existing baseline**, unchanged by this diff. The
failures are the known ones (`storage_buckets`, `value_registry`, `contract_bodies_loaded`,
`business_config`, `audit_logs`, …) and touch schema, RLS and contract-template areas this task does
not go near. **This branch adds no migration, no SQL and no RPC change**, so there is no mechanism by
which it could move that number — and it did not.

---

## 9. TEARDOWN

Processes spawned by this thread were killed and confirmed before reporting; see the session's
process census. No dev server was started.
