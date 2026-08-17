# TASK CAREPATH — a horse care enquiry becomes an active, provisioned client

**This is the FIRST of the three funnel flows to be built.** The owner reviewed horse care and
acquisition on 2026-08-16 and ruled the horse-care funnel *"really good already"* through step 2.
The work is step 3 onward. Acquisition and lessons follow, then the blended versions.

**This task takes precedence over `TASK-THREEFORMS` for the horse-care funnel.** THREEFORMS
described one generic shape for all three; the owner has now specified this lane in detail. Build
what is here. Where the two disagree, this document wins.

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

## C1 — the step tracker tells the truth: FOUR steps
- `STEPS` becomes four: **Select Services · Tell Us More · Review · Your Details**.
- Every eyebrow follows (`Step 1 of 4` … `Step 4 of 4`). Fix the same off-by-one in
  `BookSupport.tsx` **only if it does not conflict with the acquisition task queued behind this
  one** — if in doubt, leave acquisition alone and report it.
- **Whether step 4 stays at `/checkout` or becomes a fourth step inside `BookHorse` is the
  builder's call**, but the tracker must be visible and correct on it either way. Prefer keeping it
  in-page: the cart, the selections and the qualifier answers are all already in `CartContext`
  there, and `/checkout` carries lesson-specific baggage this buyer must not see.

## C2 — step 3 loses the false line and gains two buttons
- **Delete** the *"That's everything we need for now…"* paragraph (`BookHorse.tsx:202-205`).
- Step 3 shows the selection summary (which is good today) and then **two buttons**:
  1. **`Continue Shopping`** — opens the category modal (C3).
  2. **`Continue to Submit Request`** — the primary; replaces *"Continue to Booking Request"*.
- The primary keeps `btn-primary` styling; `Continue Shopping` is the secondary. **The floating
  `SelectionBar` must not present a competing third path** — check what it renders at this step.

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

## C4 — the submit screen collects PERSONAL INFORMATION ONLY
Owner: *"the form should collect their personal information only."*

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

1. **A lead** — the `requests` row from `submit_public_request`, with `p_category` set to horse
   care and the step-2 qualifier answers carried in `p_details`. **Verify the answers actually
   land**; `p_details` exists but confirm the client passes them.
2. **A horse owner** — categorized as such. **Find the existing representation** (see the directory
   migration above) and use it. **If no honest anonymous-side representation exists, do not invent
   a column** — record it in the request and report exactly where staff will read it.
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

## C7 — staff provision the service, with the right date shape
When staff open the lead they see the submission and the order, have the conversation, and then
schedule. **The date control depends on the item:**

| item shape | what staff pick |
|---|---|
| single item | **a date** |
| weekly item | **a day of the week** |
| weekly item, quantity 2 (`2x`) | **two days of the week** |

**The quantity must come from the catalog, never from parsing the offering name.** Names changed on
2026-08-15 and name-parsing broke credit minting three separate times. `CREDITALIGN` established
minting from `unit_count`; **find the same authoritative field and use it.** The `2x` is how the
owner *describes* it, not where the number lives.

**Reuse the existing booking writers** — `BOOKLINK`'s client+item linkage and `REVIEWQ`'s decision
path. **Do not write a second booking writer.**

## C8 — promotion to client, and the activation flow
- Staff send the activation link **by email**; the lead is **promoted to client**.
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
1. The horse-care tracker reads **Step 1 of 4 … Step 4 of 4**, and no screen is unnumbered.
2. The *"That's everything we need for now"* line is gone.
3. Step 3 offers **Continue Shopping** and **Continue to Submit Request**, and no competing third
   path.
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
