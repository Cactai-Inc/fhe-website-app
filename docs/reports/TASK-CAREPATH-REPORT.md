# TASK-CAREPATH — report

**Branch `task/carepath`, off `main` = `6103997`. Committed, NOT pushed.**
Built 2026-08-17, Opus 5, thinking on, high effort. One thread, no subagents.

- **Typecheck** (app + api): clean. **Lint:** 0 errors, 40 warnings — `main`'s 39 plus
  one new `react-refresh/only-export-components` on `SameHorseAsk.tsx` (it exports a pure
  helper alongside the component so the mapping can be tested).
- **`src/` unit tests: 96 passing** (86 before, 10 new for §C1c).
- **`test/db` (PGlite): `46 failed | 25 passed (71)`, `203 failed | 453 passed | 107 skipped (763)`** —
  **byte-identical to the documented baseline** recorded in the ASKRIGHT report. §8 below.
- **Six migrations, all dry-run inside `BEGIN … ROLLBACK` with the rollback proven, then applied
  to prod and verified with a query.** No `BEGIN`/`COMMIT` inside any migration file.

**`ASKRIGHT` has merged** (`bf45d1b` on main), so this task was not blocked. **`CAREPLANS` has
NOT merged** — only its three docs commits are on main, no code — so §C7 was read against its own
table, per that section's instruction.

---

## 0. THE OWNER QUESTIONS — asked before building, as instructed

| # | question | answer | what it changed |
|---|---|---|---|
| 1 | The order's status name | **Already answered in §C5b** — `draft` + an 'Enquiry — awaiting call' status event | Built exactly that. No new `purchases.status` value. |
| 2 | Does the buyer email list prices? | **"Price where fixed, 'Price on inquiry' otherwise"** | The buyer's copy shows a number where the offering carries one. ⚠️ The number is read from the **catalog** server-side, never from the browser, so a stale cart cannot put a price in someone's inbox. |
| 3 | What else a horse owner must give us | **"Nothing more — it's already complete"** | **No fields added.** What the intake already collects is inventoried in §6 below; insurance is the only thing collected nowhere, and the owner declined it. |
| — | *(mine)* Should `derive_affiliations` require a horse for HORSE_OWNER? | **"No — leave the shared rule alone"** | Correct, and **the §C10a correction later confirmed it**: the grant is a document trigger, not a description of reality. I asked before that correction landed and the answer held. |

---

## 1. Verification of the doc's own measurements

Everything was re-checked against live code and the live database before being built on. The doc was
right about the funnel and wrong about two DB facts.

| doc says | verified? | what is actually true |
|---|---|---|
| `BookHorse.tsx:14` declares 3 steps, step 2 prints "Step 3 of 3", Continue goes to `/checkout` | ✅ | Exactly. Four screens, a tracker admitting three. |
| The *"That's everything we need for now"* line at 202-205 | ✅ | Verbatim. Deleted. |
| `Checkout.tsx` asks a horse-care buyer their riding experience | ⚠️ **already fixed by ASKRIGHT** | `showLessonFields` gates both the experience radio and the availability picker. The **notes placeholder** was still the riding one — that is what §C4 needed here. |
| `BookHorse.tsx:217` — `Previous` on every step past the first | ✅ | Confirmed, single expression. Relabelled. |
| `createDraftOrder` is authenticated-only and must not be relaxed | ✅ | Untouched. The anon path is definer-side. |
| `request_selections.offering_id` is always NULL (ASKRIGHT F3) | ✅ | 7 of 7 production rows. **Fixed here** — §C5 needs the real id. |
| **`horses` cannot represent a lessee** (ASKRIGHT F2) | ❌ **WRONG** | See §5, finding **F1**. It can, and does. |
| `contacts.contact_type` has no horse-owner/deal-client value | ✅ | Confirmed. Not invented — see §C10a below. |
| The `deals` table requires a NOT NULL `contract_id` | ✅ | Confirmed, and not used. |
| §C1d: three offerings are wrongly priced | ⚠️ **FIVE were** | §2, C1d. |
| §C1d: `horse_included` is 8 true / 4 false / 14 NULL | ⚠️ **9 / 4 / 30** | The `= false` discipline the doc demands is what matters, and it is what was built. |

---

## 2. What was built

### C1 · C1b · C2 — three steps, and the tracker tells the truth

**The count is DERIVED, not hardcoded.** `BookHorse` builds its step list from
`cartHasQuestions(state.items)`: `Select Services · Tell Us More · Your Details` when something in
the cart asks a question, `Select Services · Your Details` when nothing does. The eyebrow
(`Step {n} of {total}`), the numbered circles, the connectors and the labels all read that one
derived list, so they cannot disagree with each other. `step` is clamped, so emptying the cart on
the last page cannot strand the visitor on an index that no longer exists.

**The submission page is in-page.** Step 3 renders, in §C2's order: the selection summary (the old
Review screen's markup, moved), **Continue Shopping**, the shared form, and the `inquiryLabel()`
submit. The questions page's forward button reads **`Continue to Submit Inquiry`**.

- The *"That's everything we need for now…"* paragraph is **deleted**. It was false where it stood
  and there is no longer a page for it to be false about.
- **The floating `SelectionBar` renders on step 1 only** — it never appears on the submission page,
  so there is no competing path beside the submit.
- **`BookSupport.tsx` was left alone**, per §C1b: it carries the identical defect and the
  acquisition task owns that lane. It still says `Previous` and still navigates to `/checkout`.
  **Reported, not reached into.**
- `Checkout.tsx:294`'s `Back to Selection` is unchanged, as instructed.

### C1c — turnout gets its own questions

`HORSE_EXERCISE` holds two different services. A question set may now key on the **catalog slug**
where it differs from its `service_type`; turnout claims `riding-turnout*` and Exercise keeps the
rest. **Turnout's `service_type` is unchanged**, because `CAREPLANS` restructures these very SKUs.

The turnout set is the shared six plus *"Has the horse had any issues with turnout — fencing,
gates, or getting out?"*, with reason and duration on the weekly SKUs only. **No companions
question. No free-text box.** Both were cut by the owner and there is a test asserting neither can
come back.

`CartItem` gained `offeringSlug` (populated at all three selection sites). An item with no slug — a
cart persisted in `sessionStorage` before this existed — falls back to its `service_type` set,
which is the pre-C1c behaviour and never an error. **Asserted.**

⚠️ **One D13 cost, stated plainly:** an offering-scoped section's heading cannot come from the
catalog, because every turnout SKU's `service_type.display_name` is "Horse Exercise" and reading it
would print two identical headings. `"Turnout"` is therefore **a string in
`src/lib/questionSets.ts`**, not a value the owner can edit, until `CAREPLANS` restructures these
SKUs. Every other section heading still comes from the catalog.

### C1d — two data fixes

**1. Price-on-inquiry.** `price_amount` cleared to NULL (never 0) on every offering in
`HORSE_EVALUATION` / `HORSE_FINDER` / `HORSE_PURCHASE_ASSISTANCE`.

⚠️ **The task named three rows; FIVE carried a price.** The rule is the service, not the row, so all
five were cleared:

| offering | was | note |
|---|---|---|
| Lease Evaluation | 225.00 | named in the task |
| Pre-Purchase Evaluation | 275.00 | named in the task |
| Search Retainer | 350.00 | named in the task |
| **Lease Arrangement** | **425.00** | **not named — found by the rule** |
| **Purchase Brokering** | **3.00 percent, `price_min` 500.00** | **not named.** `price_min` was cleared too: it is the "minimum shown" the public summary prints, so leaving it would keep a number online for a service that carries none. |

**All five are `active = false`, so no visitor-reachable price changed.** Every one is editable
again in the catalog editor. **Nothing else was repriced** — clipping, exercise, turnout, training
and lessons are untouched.

**The editor round-trips a NULL.** `AdminProductsPage` maps `''` → `null` on change and
`adminUpdateOffering` sends the patch straight through, so clearing a price to "Price on inquiry"
works from the UI. ⚠️ **But it reported success off `error` alone** — an RLS-filtered UPDATE returns
zero rows with no error, so a blocked price change looked identical to a saved one. It now goes
through `assertWrote()`. That is the D13 surface for exactly this change and it should not be able
to lie about it.

**2. Own-horse lessons summon the horse documents.** `derive_affiliations` granted `HORSE_OWNER` on
`segment = 'horse'`, but the three "(With your horse)" lesson SKUs carry `segment = 'rider'`, so a
client riding their own horse never received the horse liability release or the vet authorisation.

- Keyed on **`horse_included = false`, tested explicitly** — 30 offerings carry NULL, so `!= true`
  would have summoned horse documents for every one of them.
- ⚠️ **And scoped to `segment = 'rider'`.** `horse-finder` also carries `horse_included = false`; an
  unscoped test would have handed `HORSE_OWNER` and the whole horse document set to an
  acquisition-only buyer — the exact deal client §C10a says must receive none of them. **This is not
  in the task text; it is the trap the task's own rule walks into, and the doc's `!= true` warning
  is the smaller half of it.**
- The predicate is now **byte-identical to the one `my_onboarding_state` already uses** for
  `horse_needed`, so the affiliation and the horse step can no longer disagree about one order.

### C2 · C3 — Continue Shopping

`ContinueShoppingModal` shows exactly three options (Riding Lessons `/lessons` · Horse Care Services
`/horse` · Acquisition Services `/acquisition`), a **Back button**, and the **✕** the project's
existing `Modal` already renders — both close and return to the page. Built on
`components/ops/kit/Modal.tsx`; **no second dialog component was written.** It is on the horse-care
submission page and on `/checkout`, so a lessons or acquisition visitor can build a mixed cart too.

### C4 — personal information only

**`InquiryForm` was EXTRACTED from `Checkout.tsx`, not written beside it.** `/checkout` renders it
(lessons and acquisition end there); horse-care step 3 renders the same component in-page. One form
component, one submit path, one `requests` row per submission.

- Riding experience and the availability ranges appear **only when a lesson is in the cart** — a
  mixed cart shows the union, because a lesson is present. **Configuration, not deletion**: the
  lesson task can switch them back on by changing one predicate.
- **The notes placeholder now follows the cart.** A horse owner booking a clip is no longer prompted
  about *"where you are in your riding"*.
- **No date, no range, for horse care.** Staff set the schedule on the call.

### C5 · C5b — one submission produces three things

The order is opened **inside `submit_public_request`** — already SECURITY DEFINER, already resolves
the tenant, already receives the selections. Chosen over a second definer RPC because one submission
must produce one request **and** one order atomically; two RPCs can half-succeed, and the half that
fails is the money one.

**`createDraftOrder` is untouched.**

1. **A lead** — the `requests_capture_contact` trigger dedupes or creates the contact as `LEAD` and
   stamps `requests.contact_id`. Verified firing on this path (§3, test 6).
2. **A horse-owner categorisation** — via the existing `groups` / `derive_affiliations` spine, now
   corrected by C1d.2. No column was invented.
3. **An order** — `draft`, `unpaid`, `buyer_user_id` NULL (there is no account yet, which is what
   "lead" means), carrying one `purchase_items` row per resolved selection, plus an
   **'Enquiry — awaiting call'** status event.

**The order is opened only when at least one selection resolved to a real catalog row.** A
`/contact` message carries no selections and must not manufacture an empty order.

**ASKRIGHT F3 fixed in the same function:** selections resolve by `offering_id` **or** slug, so every
line links to the real catalog row. Without this §C5's order had nothing to point at.

**Status mapping, exactly as §C5b specifies, with no constraint change:**

| moment | `purchases.status` | `current_status` |
|---|---|---|
| submission | `draft` | `enquiry` |
| confirm + promote + invite (one act) | `awaiting_payment` | `submitted` |
| held for a horse | `draft` | `awaiting_horse` |
| last line voided | `void` | `void` |

A staff-made draft has `current_status` NULL, so the ops board can tell the two apart. **Test 12g:
the `purchases_status_check` constraint is unchanged — output in §3.**

**`purchase_items` could not represent a voided line at all.** It gained `voided_at`, `voided_by`,
`void_reason` and a partial index on the live lines. `_recompute_purchase_total` is the **single
writer** for the total and voids the order when the last live line goes — but never a `paid` order,
because that is a settled fact.

### C5c — split and hold, as staff actions

- **`split_purchase(purchase_id, item_ids[], reason)`** — staff-only, works for **any** order for
  any reason (nothing in it mentions acquisition), refuses to move *every* line (that is a clone,
  not a split), moves the chosen lines to a second order carrying **the same `request_id`**, and
  recomputes both totals. **Nothing splits automatically at submission.**
- **`hold_purchase_for_horse(purchase_id, reason)`** — `draft` plus an `awaiting_horse` event.
  Refuses a paid order.
- **`void_purchase_item(item_id, reason)`** — voided, never deleted.
- **`purchases.request_id`** is the new column that makes "both orders trace to the same inquiry"
  true. Without it the story of why order B exists is lost the moment staff split.
- **Order B wakes on a HORSE APPEARING**, not on the acquisition order closing: a trigger on
  `horses` (INSERT, and UPDATE of `current_owner_contact_id` / `lessee_contact_id`) raises any held
  order for that contact to `awaiting_payment` and notifies staff. Keyed on the horse, as §C5c
  demands — they may buy privately.

### C6 · C6b — the lead page, both emails, and an honest confirmation screen

- **`LeadOrderPanel` is a SECTION of the existing `LeadWorkDrawer`.** No second lead page. It shows
  both orders after a split, the live and voided lines, each line's catalog-derived schedule shape,
  and the split / hold / cancel-a-line controls. While an order is a draft it prints
  **"Nothing owed until this is confirmed"**, not a balance.
- **The staff alert now carries the selections** and the order code. It already carried the step-2
  answers (ASKRIGHT §A5); what the person actually asked to *buy* was missing, so the owner could
  not tell from the email alone.
- **The buyer's copy is new** — `api/inquiry-confirmation.ts`, the twin of `request-received.ts`.
  Anonymous, trusts the caller for nothing but the requestId, **reads the recipient from the
  `requests` row** (no address crosses that boundary from the caller), and writes a
  `request_alert_sends` row for every attempt. Its first paragraph says **"Nothing is scheduled
  yet"** — it is a confirmation of what they submitted, never a booking.
- **Both emails build from one definer reader**, `inquiry_email_payload`, so they cannot describe
  different submissions.
- **`request_alert_sends.kind`** discriminates the two, and *"provable and single"* is now **per
  kind** — otherwise a successful staff alert would have silently suppressed the buyer's copy, which
  is the exact class of bug that table exists to prevent.
- **The confirmation screen shows what happened, honestly.** The items (price-on-inquiry items show
  no number), every answer given, the visitor's own note, and the **real** send status of both
  emails, with the reply promise naming their chosen method ("we will text you"). `null` is its own
  state and reads *"Sending your copy…"* — never *"we've emailed you"*. A failure names the phone
  number. `submitRequest` now returns the send outcome instead of firing and forgetting.

### C8 — confirmation, promotion and the invite are ONE act

Folded into `provision_client_invitation` rather than bolted beside it; **no second provisioning
path**. The same call confirms the inquiry's draft order (`draft` → `awaiting_payment`), promotes
the lead (`LEAD` → `CONTACT`, `clients` row, request → `invited`) and issues the link.

⚠️ **A latent bug found and closed while building it.** `provision_client_invitation` reused an
existing purchase only when its offering set matched `p_offering_ids` **exactly** — and an exact-set
match is precisely what a §C5c split breaks. Confirming a split inquiry would have minted a
**duplicate order**. It now adopts the inquiry's order by `request_id`, which survives a split.

⚠️ **A held order is deliberately NOT confirmed by this act.** Order B stays `draft` /
`awaiting_horse`; nothing is owed for work that cannot begin.

### C9 — the order screen, and "Notify staff this isn't correct"

`ActivationOrderPanel` is the **first** screen of onboarding when there is an order: the items, and
the bookings if staff put any on the calendar. **An empty calendar says the timing will be
confirmed** — it never implies a held date.

Two buttons, and **either proceeds**. The correction calls `report_order_incorrect`, which writes a
`client_flagged` event on the order's own timeline (so staff see it wherever they open the order,
not only in a dismissable notification) and **returns how many staff it actually notified**. The
screen reports that number: reaching nobody is reported as reaching nobody, with the phone number.
It never changes the order's status or gates the client.

### C10 · C10a · C10b — the intake branches, and the answers feed forward

- **The onboarding step list is derived twice over**: the order step appears only when there is an
  order, the horse step only when `horse_needed`.
- **The deal client's document set is DATA.** `category_document_requirements` gained a
  **`Deal client`** category → **`RELEASE_GENERAL`** and nothing else. The check constraint was
  **widened**, never rewritten; Guest / Rider / Horse owner are untouched. Proven: Deal client → 1
  document; Horse owner → 5.
  - **The waiver is `RELEASE_GENERAL`, "General Visitor Liability Release"** — active, wall-gating,
    already in the system. **No new document was authored.** It is **not**
    `EVALUATION_LIABILITY_WAIVER`, which is the per-evaluation waiver the acquisition lane attaches
    to an actual evaluation: a different document for a different moment.
  - **`Deal client` maps to the `GUEST` token.** `groups.group_type` allows only four values, and a
    fifth would have to be taught to `derive_affiliations`, `apply_affiliations` and ~10 RLS-bearing
    surfaces for no gain. **What differs is the paperwork, and that is keyed on the display
    category.** Reported rather than hidden: this is the cost §C10a asked me to name.
- **`my_inquiry_answers()` returns the answers GROUPED BY SUBJECT** — which is what makes "only
  `client_horse` may ever prefill" enforceable rather than a convention. Answers filed under *"Horse
  we are being asked to find"* (the not-yet client) come back as `sought_horse`, so `client_horse`
  is empty and the intake is blank with nothing asked.
- **`SameHorseAsk` puts the owner's question before the form**: *"Is this the horse you told us
  about?"*, showing what they said. Yes prefills the overlapping fields, editable. No gives a blank
  form. Nothing is asked when there is nothing to ask about.
- ⚠️ **AGE IS DELIBERATELY NOT PREFILLED.** The inquiry asks an age; the record holds a date of
  birth. Deriving one from the other would invent a birthday we were never told and merge it into a
  legal document. The age is shown to the client instead, for them to answer.

---

## 3. THE TEST THIS MUST PASS — evidence

Every DB claim below is query output. **Every render claim is marked NOT VERIFIED** and appears in
§7's click-through instead.

| # | claim | status | evidence |
|---|---|---|---|
| 1 | Tracker reads Step 1 of 3 … Step 3 of 3, no unnumbered screen | **NOT VERIFIED (render)** | §7.1. The list is derived in code; no screen was opened. |
| 1b | The count is derived — a question-less cart shows **two** | **NOT VERIFIED (render)** | §7.2. `cartHasQuestions` drives the list; `assembleSections([lesson]) === []` is asserted in the unit tests. |
| 1c | Lessons + horse care inserts the questions page | ✅ | ASKRIGHT test 4g, still passing here (96/96). |
| 2 | The "That's everything we need for now" line is gone | ✅ | It is no longer rendered anywhere. ⚠️ **The phrase still appears once in `BookHorse.tsx:179`, inside a JSX comment** recording why it was deleted — so a bare `grep` finds it. `grep` for the JSX that rendered it (`text-sm font-sans text-muted italic` paragraph after the summary) → 0. |
| 2b | `Back` past step 1, `Back to Services` on step 1, no `Previous` | ✅ | The label expression is now `current === 0 ? 'Back to Services' : 'Back'`. ⚠️ The word `Previous` survives once in `BookHorse.tsx:235`, again **inside a comment**, and once for real in `BookSupport.tsx` — that lane is the acquisition task's (§4, G4). |
| 3 | Submission page: summary → Continue Shopping → form → inquiryLabel submit, no competing path | **NOT VERIFIED (render)** | §7.3. `SelectionBar` renders on `stage === 'select'` only. |
| 3b | Confirmation shows items, every answer, honest send status, their method | **NOT VERIFIED (render)** | §7.9–7.10, **including the failure path**. |
| 4 | Modal: three categories, Back **and** ✕, cart survives | **NOT VERIFIED (render)** | §7.4. `SET_FUNNEL` preserves items by design and is unchanged. |
| 5 | A horse-care buyer is never asked riding experience | ✅ **partly pre-existing** | `showLessonFields` gates it (ASKRIGHT). What this task fixed is the **notes placeholder**, which was still the riding one. §7.5 confirms the render. |
| 6 | One submission → a lead, a horse-owner categorisation, an order with its items | ✅ | Query output below. |
| 7 | The order is anon-creatable **only** through the intended path | ✅ | Query output below — both halves. |
| 8 | The lead page shows the submission **and** the order | **NOT VERIFIED (render)** | `request_orders` returns them (RPC proven); §7.12. |
| 9 | Both emails send, each with a per-attempt row, failure path proven | ⚠️ **PARTLY** | The rows, the kinds and the failure path are proven **by construction and by the endpoint's own recorded outcome**; **no live send was performed from this thread** — see §4, gap G2. |
| 10 | Date for a single item, a day for weekly, **two days for weekly ×2** | ❌ **NOT MET** | **§4, gap G1 — the one acceptance test this task does not satisfy.** The catalog field is named: `offerings.weekly_frequency`. |
| 11 | Promotion issues the link through `provision_client_invitation` | ✅ | Query output below. |
| 12 | The full activation chain end to end | **NOT VERIFIED (render)** | §7.13. Each step exists and is wired; no browser was opened. |
| 12b | A deal client sees no horse form and signs only the waiver | ✅ **(DB half)** | Query output below — 1 document, `RELEASE_GENERAL`. Render in §7.14. |
| 12c | The category follows what was bought | ✅ | The four-way proof in C1d.2 below. |
| 12d | Answers retrievable per contact **and per subject** | ✅ | Query output below. |
| 12e | Staff split works for any order; both orders trace to one inquiry | ✅ | Query output below. |
| 12e2 | A mixed inquiry submits unified and unblocked | ✅ | One `requests` row, one order, two lines — the test-6 output below is exactly that case. |
| 12f | Order B wakes on a **horse**, not on the deal closing | ✅ | Query output below. |
| 12g | No new `purchases.status` value | ✅ | Constraint output below. |
| 13 | "Notify staff this isn't correct" provably reaches a human, client proceeds | ✅ **(DB half)** | `report_order_incorrect` returns the recipient count and writes a `client_flagged` event. Render in §7.15. |
| 14 | Mixed-cart behaviour reported honestly | ✅ | §4, gap G3. |
| 15 | DB claims are query output; render claims marked NOT VERIFIED | ✅ | This section and §7. |

### Test 6 — one signed-out submission (run inside `BEGIN … ROLLBACK`; prod not polluted)

```
--- the LEAD (contact captured by the trigger) ---
 contact_type | first_name | last_name |            email
--------------+------------+-----------+------------------------------
 LEAD         | Dry        | Run       | dryrun-carepath@example.test

--- the SELECTIONS now carry a real offering_id (ASKRIGHT F3 fixed) ---
       label       | has_offering_id |         offering_slug
-------------------+-----------------+-------------------------------
 Full Body Clip    | t               | hair-clipping--item-35783d05
 Turnout 1x Weekly | t               | riding-turnout--item-e8f8fb83

--- the ORDER: draft, unpaid, linked to the inquiry, distinct from a staff draft ---
 display_code | status | payment_status | amount | current_status | traces_to_inquiry | no_account_yet
--------------+--------+----------------+--------+----------------+-------------------+----------------
 PUR-000179   | draft  | unpaid         | 300.00 | enquiry        | t                 | t

--- the LINE ITEMS ---
       label       | price_amount | price_unit | linked
-------------------+--------------+------------+--------
 Full Body Clip    |       200.00 | session    | t
 Turnout 1x Weekly |       100.00 | month      | t
```

### Test 7 — the security boundary, both halves

```
=== 7a — has_function_privilege, anon ===
 _recompute_purchase_total(uuid)                  | anon f | authenticated t
 hold_purchase_for_horse(uuid, text)              | anon f | authenticated t
 split_purchase(uuid, uuid[], text)               | anon f | authenticated t
 submit_public_request(… 13 args …)               | anon t | authenticated t
 void_purchase_item(uuid, text)                   | anon f | authenticated t
 request_orders(uuid)                             | anon f | authenticated t
 inquiry_email_payload(uuid)                      | anon f | authenticated f   (service_role only)
```

⚠️ **`anon` DOES hold a table-level `INSERT` grant on `purchases` and `purchase_items`.** That is the
repo-wide Supabase default on every table, it predates this task, and **it was not changed** — the
task's phrasing ("proof anon has no direct INSERT") is not literally true of this database and
saying otherwise would be false. **RLS is what denies it**, and here is the denial, isolated:

```
BEGIN;
ALTER TABLE purchases DISABLE TRIGGER status_purchases;      -- so the denial is RLS,
ALTER TABLE purchases DISABLE TRIGGER purchases_assign_code; -- not a NOT NULL from a BEFORE trigger
SET LOCAL ROLE anon;
INSERT INTO purchases (org_id, status, amount) VALUES (<real org id>, 'draft', 999);
NOTICE:  DENIED by: new row violates row-level security policy for table "purchases"
ROLLBACK;
```

```
-- and on the child table, with the triggers left in place:
SET LOCAL ROLE anon;
INSERT INTO purchase_items (...);
NOTICE:  DENIED for anon: new row violates row-level security policy for table "purchase_items"
```

The mechanism: `purchases_org_boundary` is **RESTRICTIVE** and reads `org_id = current_org()`, which
is NULL for an anonymous browser, so every direct anon insert filters to zero rows. The definer RPC
is the only path that lands one. **Nothing in this task grants anon anything new**, and
`REVOKE … FROM PUBLIC, anon` was written by name on every staff RPC precisely because a `PUBLIC`
revoke does not remove a direct grant.

### C1d.2 — the horse documents follow the ORDER, proven four ways

```
  buyer   |             bought              |    affiliations     | gets_horse_documents
----------+---------------------------------+---------------------+----------------------
 c1d-acq  | Horse Finder                    | {}                  | f     ← deal client
 c1d-care | Full Body Clip                  | {HORSE_OWNER}       | t     ← unchanged
 c1d-our  | Single Lesson                   | {RIDER}             | f     ← unchanged
 c1d-own  | Single Lesson (With your horse) | {HORSE_OWNER,RIDER}  | t     ← THE FIX
```

### Tests 12e / 12f / 12g / C5b rule 6 — split, hold, wake, void

```
=== staff split: the care line moves to order B on the SAME inquiry ===
 display_code | status | amount | current_status |              request_id              |     items
--------------+--------+--------+----------------+--------------------------------------+----------------
 PUR-000180   | draft  |      0 | enquiry        | 33ef44df-d5fd-4314-9e8e-603ad3e33d4d | Horse Finder
 PUR-000181   | draft  | 200.00 | pending        | 33ef44df-d5fd-4314-9e8e-603ad3e33d4d | Full Body Clip

=== both orders trace to ONE requests row ===
 distinct_requests | orders
-------------------+--------
                 1 |      2

=== hold order B, confirm order A ===
 display_code |      status      | current_status
--------------+------------------+----------------
 PUR-000181   | draft            | awaiting_horse     ← owes nothing, schedules nothing
 PUR-000180   | awaiting_payment | submitted

=== 12f — a HORSE appears for that client (not a deal closing) ===
INSERT INTO horses (org_id, nickname, current_owner_contact_id) VALUES (…);
 display_code |      status      | current_status
--------------+------------------+----------------
 PUR-000181   | awaiting_payment | submitted          ← woken by the horse

=== 12g — the constraint is UNCHANGED ===
 CHECK ((status = ANY (ARRAY['draft','sent','awaiting_payment','paid','void'])))

=== C5b rule 6 — void the last live line ===
 {"amount": 0, "status": "void", "purchase_id": "ea534c49-…"}
```

### Test 11 / §C8 — the ONE act

```
=== provision_client_invitation(…, p_request_id) ===
 {
     "labels": ["Horse Finder"],
     "categories": ["GUEST"],
     "contact_id": "c25ff56c-…",
     "request_id": "baf060a9-…",
     "purchase_id": "0248efd3-…",
     "invitation_id": "423171ec-…",
     "confirmed_orders": ["0248efd3-…"]
 }

--- order A confirmed, held order B untouched, ONE inquiry ---
 display_code |      status      | current_status | amount |     items
--------------+------------------+----------------+--------+----------------
 PUR-000186   | draft            | awaiting_horse | 200.00 | Full Body Clip
 PUR-000185   | awaiting_payment | submitted      |      0 | Horse Finder

--- the lead is promoted, and no duplicate order was minted ---
 contact_type | client_rows | request_status | invitations | orders
--------------+-------------+----------------+-------------+--------
 CONTACT      |           1 | invited        |           1 |      2
```

### Test 12b — the deal client signs exactly one document

```
=== Deal client ===
  template_key   |               title
-----------------+-----------------------------------
 RELEASE_GENERAL | General Visitor Liability Release
(1 row)

=== Horse owner, for comparison ===
 COMPANY_POLICIES, FACILITY_RULES, HORSE_EMERGENCY_VET, RELEASE_HORSE_CARE, RELEASE_PARTICIPANT
```

### Test 12d — answers retrievable per contact **and per subject**

`my_inquiry_answers()`, called as a real signed-in client:

```
 {
     "person": {
         "Which best matches your equestrian experience?": "I currently own or lease a horse"
     },
     "client_horse": {
         "What breed is the horse?": "Warmblood",
         "What is the age of the horse?": "12"
     },
     "sought_horse": {
         "What breed is the horse?": "Something quiet"     ← "Horse we are being asked to find"
     },
     "evaluated_horse": {
         "Breed": "Thoroughbred"
     }
 }
```

Four subjects, four different horses' worth of answers, **never merged**. The horse intake reads
`client_horse` and only `client_horse`.

### Final prod state

```
 purchases.request_id     | t
 purchase_items.voided_at | t
 request_alert_sends.kind | t

      code      |          display_name           | is_true_status
----------------+---------------------------------+----------------
 enquiry        | Enquiry — awaiting call         | t
 split          | Split from another order        | f
 items_moved    | Items moved to another order    | f
 item_voided    | Line item voided                | f
 client_flagged | Client says this is not correct | f
 awaiting_horse | Awaiting the horse              | t
```

---

## 4. GAPS — what this task did NOT deliver, and why

### ⚠️ G1 — TEST 10 IS NOT MET. A weekly ×2 item can be given only ONE day of the week.

**This is the one acceptance test this task fails, and it is a real gap, not a wording quibble.**

- **The catalog field is `offerings.weekly_frequency`** (1 or 2 on the live SKUs). It is read
  correctly, from the catalog, nowhere parsed from a name — `LeadOrderPanel` already prints
  *"Weekly — staff pick 2 days of the week, plus how long"* for a `weekly_frequency = 2` line.
- **But the writer underneath stores one day.** `set_recurring_day(purchase_item_id, day)` writes a
  single `config.recurring_day`, and `generate_monthly_lessons` filters
  `to_char(d,'Dy') <> v_day` — one session per week, whatever the frequency says.
- **I did not extend it, deliberately.** Doing so touches `set_recurring_day`,
  `generate_monthly_lessons`, `client_monthly_plan` **and the credit-minting arithmetic** — the area
  `CREDITALIGN` records as having been broken and reverted **three separate times**, and where a
  wrong entitlement mints credits nobody paid for. §C7 also says in terms: *"Do not write a second
  booking writer."* Half-building a second day into the money spine at the end of a long task is the
  failure mode this report is supposed to prevent.
- **The shape of the fix**, for whoever takes it: `config.recurring_days text[]` with
  `recurring_day` kept as a read fallback, `generate_monthly_lessons` looping the array, and the
  month's entitlement trued against `array_length(days) × weeks` rather than `weeks`. **The
  entitlement arithmetic is the dangerous half.**
- **A date for a single item and a day for a 1× weekly item both work today.** Only the ×2 case
  fails, and it fails by scheduling too little, never by over-minting.

### ⚠️ G2 — no live email was sent from this thread.

The two endpoints, the per-attempt rows, the `kind` discrimination, the per-kind idempotency guard
and both templates are built and applied. **What is not proven is a real send**, because doing so
would have mailed the barn's live ops inbox and a synthetic address from a build thread. What IS
proven: the endpoints' recorded outcome is what the confirmation screen reads (there is no path
where the screen claims a send the endpoint did not report), and the failure path is written and
reachable — `emailed: false` is returned for a missing template, a missing address, a provider error
and an internal error, each with its own recorded row. §7.10 is the owner's live check, **and it is
the one item on that list I would run first.**

### ⚠️ G3 — mixed-cart behaviour at the submit screen, reported honestly

A mixed cart **submits unified and unblocked** — one `requests` row, one order, every line, no extra
question and no special routing (test 12e2). Two honest caveats:

1. **`requests.category` is decided by the funnel the visitor happens to be standing in.**
   `requests_category_check` has no `mixed` value, so something must win. A three-category order
   submitted from `/lessons` is filed as `lessons`. **Staff category filters therefore under-count
   mixed orders.** This is ASKRIGHT F8, unchanged — fixing it means a constraint change and a
   decision about what a mixed inquiry *is*, which is `THREEFORMS` F1b's territory, not this task's.
2. **The form shows the union**, so a mixed cart containing a lesson shows the availability block and
   the riding-experience question. That is correct — a lesson is present — but it means a horse-care
   buyer who added one lesson does see riding questions. Also §A0's ruling, and unchanged.

**Nothing is dropped and no items are lost.** The §C3 modal is now the main producer of mixed carts,
so this is worth the owner's attention even though it is another task's fix.

### ⚠️ G4 — `BookSupport.tsx` still carries the same defect

`Previous` on every step past the first, and a Continue that navigates to `/checkout` from a
three-step tracker. **Left alone per §C1/§C1b**, since the acquisition task owns that lane and
touching it would conflict. **Flagged, as instructed.**

### G5 — the "Turnout" section heading is code, not catalog (D13)

Stated in §2 above. One line in `src/lib/questionSets.ts` until `CAREPLANS` restructures these SKUs.

---

## 5. Findings — things that were not what the docs said

### F1 — ⚠️ ASKRIGHT's F2 IS WRONG. The horse record CAN represent a lessee.

The ASKRIGHT report states: *"`horses.current_owner_contact_id` is a single FK to one contact and is
the only ownership representation; nothing on a horse says 'this person leases me'"*, and concludes
that **"the inquiry will assert a fact the horse record cannot hold."** It can.

```
horses columns: … current_owner_contact_id, lessee_contact_id, lessee_name_text,
                  lease_start, lease_end, sublease_allowed, …
```

- **`horses.lessee_contact_id`** exists, alongside `lessee_name_text`, `lease_start`, `lease_end`.
- **`horse_relationships`** (relationship, party_contact_id, term_start, term_end, active,
  source_document_id) is a full term-scoped relationship table.
- **`my_stable_horses` already reads all three**: a horse appears in your stable when
  `current_owner_contact_id = you` **OR `lessee_contact_id = you`** OR an active
  `horse_relationships` row names you — and it returns `is_owner` as a distinct boolean.
- **`HorseIntakeForm` already collects it**: `my_relationship: 'OWNER' | 'LESSEE'`, a lease block
  with lessee name/email and lease dates.

**So own-vs-lease has a faithful home, and this task parked nothing.** The lessee client's own
answer lands in `requests.details` (ASKRIGHT §A5) and is retrievable per subject by
`my_inquiry_answers()`; the horse record then holds the relationship properly through the intake's
existing `my_relationship` field. **No schema task is needed for this**, contrary to F2's
conclusion. (`horses.lessee_contact_id` is 0-of-1 populated in production, which is presumably how
it was read as absent — an unused column is not a missing one, and this repo's own working rule
warns about exactly that inference.)

### F2 — email tokens are not in `template_tokens`

`template_tokens` holds the document merge-token dictionary, but **no email token has a dictionary
row** — `MSG.*`, `ORG.FOOTER_HTML`, `REQ.*` all return zero rows. The `emailTemplates.ts` header
claims *"Every `{{NS.FIELD}}` used below has a row in `template_tokens`"*; it does not. **Pre-existing
and not created by this task**, so the two new tokens (`REQ.SELECTIONS`, `REQ.ORDER_CODE_HTML`)
follow the existing convention rather than half-founding a registry. `TASK-TEXTEDIT`'s picker will
not list any email token until someone seeds them.

### F3 — `purchases_mint_credits` fires on the confirmation act

`draft → awaiting_payment` is exactly the transition `trg_mint_credits_when_order_opens` watches, so
confirming an enquiry order **mints its credits at that moment**. That is the right moment (§C5b:
confirmation is when anything becomes owed) and it means a recurring line's monthly allotment exists
before the client activates. **Named here because it is a consequence of §C5 that the task text does
not mention**, and because a held order B deliberately does not reach that transition, so it mints
nothing while it waits.

### F4 — `contacts.contact_type` and `deals` are both still wrong homes, and neither was used

Confirmed as the doc measured: `contact_type` allows only `LEAD · CONTACT · TEAM · DIRECTORY ·
VENDOR · PARTNER`, and `deals.contract_id` is NOT NULL so an inquiry with no contract cannot have a
deal row. **Nothing was invented in either.** The distinction lives in
`category_document_requirements`, which is data the owner can edit.

### F5 — five priced offerings, not three (§2, C1d)

### F6 — the `Guest` category carries three documents, `Deal client` carries one

Deliberate, from the owner's *"only a general liability waiver"*. `Deal client` is **not** a copy of
Guest — it omits `COMPANY_POLICIES` and `FACILITY_RULES`. **If the barn wants those back, that is
one row in `category_document_requirements`**, no deploy.

---

## 6. Owner Question 3 — what the horse intake already collects

Asked and answered ("nothing more"), recorded here because §C10's instruction was to report the
inventory rather than guess.

**Already collected by `HorseIntakeForm` / the `horses` table:** registered name · nickname · breed ·
colour · markings · sex · date of birth · height · registration number + organisation · microchip ·
passport number + country · fair market value · medical history · behavioural history · known
conditions · training history · competition history · **vet name, phone, business, address, city,
state, postal** · **farrier name and phone** · home and current location, barn, stall · home trainer
/ care-giver / groom / other person · the **lease block** (lessee name, lessee email, lease start,
lease end, `my_relationship` OWNER|LESSEE, sublease allowed) · **euthanasia authorisation**.

**Collected about the PERSON on the details step:** phone · date of birth · full address · **two
emergency contacts** (name, relationship, phone).

**Collected NOWHERE in the system:** **insurance** — no table in the database has an insurance
column. This was the only real gap and **the owner declined it**. No fields were added.

---

## 7. ⚠️ NOT VERIFIED — the render. A numbered click-through for the owner.

Everything in §3 is proven by query output or test output. **No screen was opened and no browser was
started.** This is the part most likely to hold a surprise.

Start each run with an **empty cart** — it persists in `sessionStorage`, so use a private window or
clear it between runs.

1. **`/horse` → pick `Full Body Clip` → Continue → Continue.** The tracker should read
   **Select Services · Tell Us More · Your Details**, the eyebrows **Step 1 of 3 … Step 3 of 3**, and
   there should be **no fourth screen**.
2. **THE DERIVED COUNT.** Empty cart → `/lessons` → add `Single Lesson` → navigate to **`/horse`**
   without adding anything. The tracker should show **TWO** steps
   (*Select Services · Your Details*) and the eyebrow **Step 1 of 2**. Continue should go **straight
   to the details page**, skipping the questions.
3. **The submission page order.** On step 3: the **selection summary** first, then **Continue
   Shopping**, then the form, then a single primary button reading **"Inquire about Horse Clipping
   service"**. **The floating bar at the bottom must be GONE** on this page, and the
   *"That's everything we need for now"* line must be nowhere.
4. **THE MODAL.** Click **Continue Shopping**. Expect three options, a **Back** button at the
   bottom-left and an **✕** top-right; **Escape** should also close it. Choose **Riding Lessons** —
   you should land on `/lessons` **with Full Body Clip still in your inquiry** (check the summary on
   `/checkout` or come back to `/horse`).
5. **THE RIGHT QUESTIONS.** `/horse` with **only** `Full Body Clip`: the form must **not** ask riding
   experience, must **not** show any availability picker, and the notes box placeholder should read
   *"Anything about your horse or your situation…"* — **not** *"Where you are in your riding…"*.
6. **`/horse` → `Turnout Session` alone → Continue.** Expect the shared six **plus one** question:
   *"Has the horse had any issues with turnout — fencing, gates, or getting out?"*. **No** riding
   history, **no** prior training, **no** free-text box, **no** question about other horses.
7. **`/horse` → `Turnout 1x Weekly`.** The same, **plus** *"What is bringing you to our turnout
   services?"* and *"Approximately how long will you need these services?"*.
8. **`/horse` → `Exercise Session` + `Turnout Session`.** Expect **three headings**: *First, a few
   details*, *Horse Exercise*, **Turnout** — and the shared six should appear **once**.
9. **SUBMIT IT.** Fill the form, choose **Text** as the contact method, and submit. The confirmation
   screen should show: the items you chose, **every answer you gave**, your note, and the line
   **"we will text you"**.
10. ⚠️ **THE EMAILS — RUN THIS ONE FIRST.** On that same confirmation screen, the **Emails** block
    should resolve within a few seconds to two ticks. Then check: **the ops inbox has the alert, and
    it now lists WHAT THEY ASKED ABOUT with prices**; and **the address you submitted has its own
    copy**, whose first paragraph says nothing is scheduled yet. If either line stays on
    *"Sending…"* or turns into a warning, that is gap **G2** showing you a real problem — tell me the
    wording it showed.
11. **THE FAILURE PATH.** (Optional, but this is what cost two leads.) Submit with a deliberately
    undeliverable address. The buyer line should read *"We could not email your copy just now…"*
    **with the phone number**, and the staff line should still tick.
12. **THE LEAD PAGE.** Open the lead in **Ops → Intake**. You should see the personal details, the
    **Details** list of answers, and a new **Order** section: the order code, *"Enquiry — awaiting
    call"*, **"Nothing owed until this is confirmed"**, the lines with their schedule shape, and the
    buttons **Split this order** (only when there is more than one line) and **Hold — awaiting the
    horse**.
13. **THE SPLIT.** With a two-line inquiry, click **Split this order**, tick one line, give a reason,
    and move it. Expect **two orders on the one lead**, the reason visible on both. Then **Hold** the
    second one — it should read *"Held. Nothing is owed and nothing is scheduled."*
14. **THE ONE ACT.** Complete the checklist and **Send confirmation & invite**. The first order
    should become `awaiting_payment`; **the held one must stay a draft**.
15. **ACTIVATION.** Follow the link → set a password (or Google) → you should land on **Your order**
    *before* Your details, showing the items and either the booking or
    *"Nothing is on the calendar yet"*. Click **Notify staff this isn't correct**, type something,
    send: expect a green line naming **how many** people were told. Then **Continue** — it must let
    you through either way.
16. **THE DEAL CLIENT (12b).** Invite someone with the **Deal client** category. Their onboarding
    should show **no horse step at all** and **exactly one document**: *General Visitor Liability
    Release*.
17. **THE SAME-HORSE ASK (C10b).** As a horse-care client whose inquiry answered breed/age, reach the
    horse step. Before the form you should be asked *"Is this the horse you told us about?"* with
    your own answers listed. **Yes** should prefill breed (and behaviour/health if you gave them) —
    **but NOT the date of birth**, which stays blank on purpose. **No** should give a blank form.
18. **THE CATALOG EDITOR (C1d).** Ops → Admin → Products: open any offering, clear its price to
    empty, save, reopen. It should still be empty, and the public page should read **"Price on
    inquiry"**. Then check that `/acquisition` shows **no prices at all**.

---

## 8. Test-suite state

```
src/       3 files, 96 tests, all passing   (86 before; 10 new for §C1c)
typecheck  clean (app + api)
lint       0 errors, 40 warnings (main = 39; +1 react-refresh on SameHorseAsk.tsx)

test/db    Test Files  46 failed | 25 passed (71)
                Tests  203 failed | 453 passed | 107 skipped (763)
             Duration  86.05s   (npx vitest run test/db --maxWorkers=2)
```

**Byte-identical to the documented pre-existing baseline** (the ASKRIGHT report records the same
`46 | 25` and `203 | 453 | 107`). The failures are the known ones — `storage_buckets`,
`value_registry`, `contract_bodies_loaded`, `business_config`, `audit_logs` — in schema, RLS and
contract-template areas this diff does not go near. **Six migrations landed and the number did not
move.**

---

## 9. Migrations applied to prod (all dry-run + rollback proven first)

| file | what |
|---|---|
| `20260817T0300_carepath_c1d_inquiry_pricing_and_own_horse_lessons.sql` | 5 offerings unpriced; `derive_affiliations` grants HORSE_OWNER for own-horse lessons |
| `20260817T0400_carepath_c5_enquiry_orders.sql` | `purchases.request_id`; `purchase_items` void columns; 5 order status codes; `_recompute_purchase_total`; `submit_public_request` opens the order + F3 fix; `split_purchase`; `hold_purchase_for_horse`; `void_purchase_item`; the horses wake-up trigger; grants |
| `20260817T0500_carepath_c6_two_inquiry_emails.sql` | `request_alert_sends.kind`; per-kind claim/log; `inquiry_email_payload`; the `INQUIRY_CONFIRMATION` template; selections appended to `REQUEST_RECEIVED` |
| `20260817T0600_carepath_c6_lead_page_orders.sql` | `request_orders` |
| `20260817T0700_carepath_c8_c9_one_act_and_order_screen.sql` | `provision_client_invitation` confirms the inquiry's order in the one act; `report_order_incorrect`; `client_flagged` vocab |
| `20260817T0800_carepath_c10a_deal_client_category.sql` | `Deal client` → `RELEASE_GENERAL`; the category CHECK widened |
| `20260817T0900_carepath_c10b_answers_feed_forward.sql` | `my_inquiry_answers()` |

---

## 10. TEARDOWN

No dev server, no build, no watcher was started. `vitest` was run with `--maxWorkers=2` and each run
exited on its own; `psql` invocations are one-shot. The worktree carries a `node_modules` **symlink
to the canonical checkout**, same-case path (`/Users/Cactai/…` → `/Users/Cactai/…`), matching the
pattern `wt-askright` already uses — **not** the case-variant symlink that loaded React twice on
2026-08-16. Process census confirmed clean before reporting.
