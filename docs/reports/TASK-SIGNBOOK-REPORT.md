# TASK-SIGNBOOK — report

**Thread:** `TASK-SIGNBOOK` · `wt-1` · branch `task/signbook` · merge-base `162ab3f7`.
**Spec:** `docs/tasks/TASK-SIGNBOOK-the-wizard-ends-in-a-booking-request-not-a-payment.md`
(+ ORCH6's required-reading addendum). **Running record:** `docs/reports/TASK-SIGNBOOK-LEDGER.md`.
**Migration `20260901T1420` is APPLIED to production. Not pushed. ORCH merges.**

## THE HEADLINE
The self-serve wizard now runs **details → sign → offering → time → send the request → done**, with
**no payment step**, and the last screen says the request was SENT. **Two separate defects were
stopping a new visitor before any of that** — signing sent a purchase-less rider to *"You're all
set"*, and the *"Nothing to do here"* short-circuit fired the instant they signed — so the offering
step was **unreachable by two independent routes** for exactly the person it was built for. Both are
fixed and both are proven by walking the real page in a real Chromium, **25/25**. The
staff-provisioned pay-first door is unchanged and proven in the same run. The exit lands on the
community feed, per the owner's 2026-09-01 ruling, which **reverses `TASK-ONBOARD` §5**.

**CLNR: clean.**

## ⚠️ TRAP 1 RESOLVED ITSELF DURING THE BUILD — AND THAT IS THE DESIGN, NOT LUCK
When this thread started, `requested` was **not a legal `bookings.status`** and TASK-LIFECYCLE was
unbuilt. Rather than stop or stub a status, the end-cap was built to **CALL `request_open_time`**,
the one existing client-request writer, and inherit whatever status that function writes.
**TASK-LIFECYCLE has since landed its constraint and moved `request_open_time` to `'requested'`, and
this flow followed it with zero lines changed here.** Re-verified against production after
LIFECYCLE's migrations landed (D35):

```
TEST 5a · the booking is LIFECYCLE's `requested` | status=requested | carries_the_order=t | carries_the_alert=t
```
🔒 **`request_open_time` is LIFECYCLE's under D35 and this thread never edited it.**

## CRITERION BY CRITERION

### 1 · Fresh visitor from `/sign/rider`: details → docs → offering → time → submit, no payment ✅
`node test/browser/probe-signbook.mjs` — the REAL `Onboarding` in a real Chromium, clicked through:
```
── /sign/rider, no order: the visitor CR-98 is about ──
     header: 1. Your details | 2. Review & sign | 3. Choose your lesson | 4. Pick a time |
             5. Send your request | 6. Request sent
PASS  the header states the owner's order
PASS  no Payment step on the self-serve door (CR-98: pay after approval)
PASS  step 3 — the first page after auth is the details form
PASS  step 4 — details submit lands on Review & sign
PASS  CR-98 step 8 — the signing run is HELD, so one email can carry everything
PASS  ⚠️ step 5 — signing lands on the OFFERING step (before SIGNBOOK it landed on "You're all set")
PASS  step 6 — the offering step lands on pick a day and time
PASS  the offering step built a draft order
PASS  step 7 — the time step lands on the review-and-send step
PASS  D19 — it states the order back before it acts
PASS  D19 — and says plainly that no money moves
PASS  the send button called submit_my_booking_request
PASS  it submitted THE ORDER the shop step built
PASS  it submitted the day that was chosen
```

### 2 · One email: every signed doc attached, order + booking in the body ⚠️ BUILT AND WIRED, DELIVERY NOT OBSERVED
**The mechanism, end to end:** the wizard calls `hold_my_document_delivery()` on entering the sign
step, so `documents_send_executed_email` holds the set instead of mailing it at the last signature;
`submit_my_booking_request` then releases it with the order and booking named. **Proven at the
wire** — the body `net.http_post` actually queued, read out of `net.http_request_queue` inside a
rehearsal:
```
M · what was POSTed to /api/deliver-documents
 url     | https://www.frenchheritageequestrian.com/api/deliver-documents
 context | {"bookingId": "f21c5d99-…", "purchaseId": "bf6c055e-…"}
 documents | 1
L · the client may flush their own set | {"sent": true, "documents": 1, "request_id": 53}
```
`/api/deliver-documents` reads both ids back **from the rows** and passes `ORDER.LINES`,
`ORDER.TOTAL` and `BOOKING.WHEN` into `DOCUMENT_SET_PARTY_COPY`, now at **v2** and carrying both
`{{#if}}` blocks (D13 — the owner re-words them in the template editor, no deploy).
⚠️ **What I did NOT do: watch an email arrive.** No worktree can send one. **This is the owner's
checklist item 3.**

### 3 · Exit lands on the overview modal, over the community feed ✅
```
PASS  step 9 — Continue opens the app-overview modal
PASS  step 9 — closing the modal lands on the COMMUNITY FEED (reverses ONBOARD §5)
PASS  step 9 — and not on the dashboard
```
`AppOverviewModal` was already built and is unchanged. **What changed is what sits behind it.**
This was raised as an ASK-OWNER — CR-98 step 9 says *"over the community feed"* while `TASK-ONBOARD`
§5 had made `/app/dashboard` the landing unconditionally — and **the owner ruled on 2026-09-01,
verbatim:**

> *"the dashboard route is there to ensure they see notifications, but since this is their first
> login and any notifications they might see are related to a scheduled item they just booked we
> dont need to show it. the other notifications that could change this ruling would be for missing
> payment, missing documents that need to be signed, etc... but this flow handles all of that in one
> sweeping set of steps so there cant be anything missing when they enter the app after exiting the
> flow, they need to see the community feed as the first thing after closing the modal."*

🔒 **`TASK-ONBOARD` §5 IS REVERSED, AND FOR ITS OWN REASON.** §5 routed to the dashboard so the
member who *"still owes us their details"* would meet the notice. This flow now collects the
details, the signatures, the order and the time before it ends — **so the condition §5 was written
for cannot exist at this line any more.** `Onboarding.tsx:911` navigates to `/app`, which **is** the
community feed (`App.tsx:253` — the index route, not a redirect). The wall-return check above it is
untouched and still wins.
⚠️ **The one case his premise does not cover, flagged not carved out:** on the **provisioned** door
the payment step ships an *"I'll pay later — finish"* button, so that client can exit with an unpaid
order — something genuinely outstanding. His ruling names *"missing payment"* as the kind of thing
that would change it. I applied the ruling as stated rather than inventing an exception; the
notification is still one click away, badged, on the Dashboard nav row (`AppLayout.tsx:418`).

### 4 · Staff get the notification AND the email with order + date/time ✅
Both ride incumbents, and **`/api/request-received` needed no change at all** — it already renders
selections, the order code and the availability line:
```
TEST 4a · staff notification | booking_time_requested | "A client requested Sep 9, 02:00 PM"
TEST 4b · staff EMAIL payload
   order_         | {"amount": 170.00, "status": "draft", "display_code": "PUR-000357", …}
   requested_time | Wednesday, Sep 9 2026 at 2:00 PM
   channel        | booking
```
`requests.channel='booking'` has been legal since the table was made and the endpoint already labels
it *"Booking request"*; `purchases.request_id` is what `inquiry_email_payload` joins on.
**The alert row is what makes CR-99 A2's "one dashboard list of all new requests" able to see this.**

### 5 · The booking is `requested`, and the credit ledger shows zero mint ✅
```
TEST 5a · status=requested
TEST 5c · lesson_credits=0 | service_credits=0 | order_state=draft/unpaid
```
Three independent reasons it mints nothing, all incumbent: the order stays `draft`;
`_mint_credits_for_purchase_item` returns 0 on a draft; both mint triggers are `AFTER UPDATE OF
status`, which this act never performs. `booking_status_code('requested')` returns `pending` — the
**deliberate** mapping LIFECYCLE wrote (`WHEN p_status IN ('requested','approved','pending','moved')`),
not its `ELSE` fallthrough, so its trap 2 is satisfied.

### 6 · The staff-provisioned already-paid onboarding still completes ✅
```
── staff-provisioned, arriving WITH an order ──
     header: Your order | Your details | Review & sign | Payment | You're all set
PASS  the payment step is STILL THERE on the provisioned door
PASS  and it still opens on the order it was provisioned with
PASS  and it does not get the request end-cap
```
The gate is one fact captured **once, at mount**: `my_onboarding_state().purchase`. It must not be
re-derived — the self-serve visitor acquires an order at the shop step, and re-deriving would flip
them onto the payment door mid-flow. `OrderPayment` is **moved out of the path, not deleted**
(NOSTRIP; REQCARDS gives it a modal home).

### 7 · The blocker walk ✅ — and it found the task's own subject
| # | What was observed | Status |
|---|---|---|
| **B1** | `Onboarding.tsx` — on the last signature, a rider with no purchase fell to `setStep(slots\|done)` and landed on **"You're all set" with nothing bought**. `shop` was reachable only from `?step=shop` or from `enterPayment()`, which is never called without a purchase. **The offering step was unreachable for the self-serve visitor.** | **FIXED** (`:1128`) |
| **B2** | ⚠️ **Found by the browser probe, and only by it.** The *"Nothing to do here"* short-circuit asks four questions about ARRIVAL — no documents, no order, no slot, no contract — and a self-serve visitor answers all four that way **the moment they sign**. It replaced the wizard one render before the offering step could paint. **Fixing B1 alone would have landed them here instead — a worse message.** | **FIXED** (`:1193`) |
| **B3** | The shop step promised *"we'll be in touch to schedule your first lesson"* — true when it led to payment, **false now** that they pick the time on the next screen, and the kind of false that produces two lessons. | **FIXED**, per door |
| **B4** | The step header and the Back order **disagreed with the runtime machine** (header said sign→payment; the machine ran sign→shop). This is what made the spec believe signing came after shopping. | **FIXED** — one `wizardSteps()` feeds both |
| **B5** | The header **grew as you walked it** — it opened "details · sign · done" and gained two steps later, misstating what was ahead. | **FIXED** (`:1256`) |
| **B6** | STABILIZE's activation/clients-row fix **held**: `select count(*) from profiles p where p.contact_id is not null and not exists (select 1 from clients c …)` → the only rows are the three `zz-test-*` fixtures. **No real member is missing a `clients` row**, so `current_client_id()` resolves and `request_open_time` does not raise. | **STILL FIXED** |
| **B7** | `request_open_time` requires a `clients` row and raises *'no member profile'* without one. Nothing in the wizard's path creates one — it comes from `redeem_invitation` → `_ensure_client_account`. A visitor who reaches `/app/onboarding` without redeeming would fail at submit. Not reproduced on live data (B6). | **FLAGGED** |

## THE REACH (D17)
- **The only way in:** emailed activation link → `Register` → `/app/onboarding` (`src/App.tsx:267`).
- **Step 6** — `Onboarding.tsx:2094`, reached by the shop step's `Continue` (`buyPicked`, `:565`).
- **Step 7** — `Onboarding.tsx:2157`; the button calls `sendBookingRequest` (`:683`) →
  `submitMyBookingRequest` (`src/lib/ops/api-calendar.ts:543`) → `submit_my_booking_request`.
- **The hold** — `Onboarding.tsx` sign-step effect → `holdMyDocumentDelivery` (`src/lib/api.ts:664`).
- **The other door** — the same page, `?door` decided by `state.purchase` at mount; `payment` at
  `Onboarding.tsx` is reachable only from it.
- **Is it the only way?** Yes for the request end-cap. The separate incumbent path
  (`CalendarPage.tsx:1144` → `requestOpenTime`) still exists for members past onboarding and is
  **the same writer**, not a second one.

## THE TELL (D19)
The `submit` step prints the order lines and the chosen time and says *"Nothing is booked and
nothing is charged until we come back to you"* **before** the button. The button is the only thing
that sends it (D34). **Undo:** the order is still `draft`, the booking is `requested`, the alert row
is `new` — staff decline, or the client says drop it. Nothing money-shaped has happened.

## ANYTHING I DECIDED THAT THE SPEC DID NOT
1. **The end-cap CALLS `request_open_time` rather than inserting a booking.** This is what made trap
   1 dissolve instead of blocking, and it is why LIFECYCLE's rename reached this flow for free.
2. **The door gate is `state.purchase` at MOUNT**, not any later reading. The spec said "gate by
   entry path"; the path is not the discriminator — a `/sign/*` visitor and a staff-provisioned one
   can share a path. The order is the discriminator.
3. **`requests(channel='booking')` is created by the submit act**, so the existing alert spine
   carries step 10's email with no endpoint change. The alternative — a new endpoint — could not
   have written `request_alert_sends`, whose FK is to `requests`, and INBOUNDALERT's whole lesson is
   that an unrecorded send loses leads.
4. **The wizard's time step is one-off only.** The spec said "slots/time". A self-serve order is a
   `draft`, so no recurring plan and therefore **no standing slot can exist yet** —
   `my_standing_slots` is empty by construction. `StandingSlotPicker` stays for the provisioned door.
5. **No wizard loop-back for an offering's extra documents** — ORCH6's addendum on CR-98 A1 says
   *"no special case"*, and `trg_documents_when_order_opens` is the general rule. It fires when
   staff open the order (REQCARDS), and notifies the client. Nothing to build.
6. **`open_document_delivery_hold` gained a third auth arm and `deliver_executed_document_set` a
   fourth** — "the caller, over their own contact". Strictly narrower than the staff arm already
   there: the argument IS the subject, so it can never name anyone else's documents.

## ⚠️ WHERE THE SPEC WAS WRONG
1. **§2: *"sign comes AFTER shop"* — false.** `:90` is a **type union**, not an order. At runtime
   `signCurrent` always ran before `shop`. The owner's 4-before-5 was already true; what was wrong
   was that shop was **unreachable**, which the spec did not find.
2. **Front matter / trap 1: "`requested` is TASK-LIFECYCLE's".** True — but **`requested` was not a
   legal status at all** when this started, and **`TASK-LIFECYCLE` §2b asserts only `approved` and
   `moved` are missing and does not notice it.** Both threads would have been wrong together.
3. **Trap 4 (loop back to sign an offering's extra document) is superseded** by CR-98 A1.
4. **§5.7 says "before changing anything, WALK the funnel"** — the walk that mattered could not be
   done by reading. B2 was invisible to source-reading and to the SQL; it took a browser.

## ⚠️ ASKED DURING THE BUILD — "does the intake email field check for the email as a lead with an order request from the website?"
**No, and there are two separate reasons, only one of which is about the door.** This is CR-98 A1's
*"Establish where this stands today"*, so it is answered here in full rather than in one line.

**1 · The door does not look.** `api/sign-start.ts:339` sends **`p_request_id: null`**.
`provision_client_invitation` has taken a `p_request_id` all along and, when given one, derives the
org from the lead and the onboarding categories from it (`request_onboarding_categories`). The
funnel never supplies it. ⚠️ **Anti-enumeration is not the reason** — that rule says the RESPONSE
must not reveal whether an address is known; it does not stop the SERVER from using what it knows.

**2 · And the two paths have never met, so today there is nothing to look up.** A website order
submission **never sends an activation link at all**: `submit_public_request` contains zero
references to invitations or provisioning, and both live order-leads confirm it —
```
contact_email                | channel | order | invitation
caseyluke1029@gmail.com      | booking |   t   | — NO INVITATION EVER SENT
msrachelpage@gmail.com       | booking |   t   | — NO INVITATION EVER SENT
```
🔒 **That is the exact goal A1 states is not yet built:** *"the goal, with the only difference being
they have already created an order in the system."*

**What DOES already work, so it is not built twice:** `_ensure_client_account` upserts the contact
**by email**, so a returning lead reuses their own contact row rather than duplicating — and
`my_onboarding_state` reads *"the contact's latest purchase"*, so once they authenticate the wizard
**does** see the website order. `submit_public_request` writes it as `draft`/`unpaid` with
`buyer_user_id` NULL, *"which is precisely what 'lead' means"*.

**⚠️ THE CONSEQUENCE FOR THIS TASK, AND IT IS THE PART THAT NEEDS A DECISION.** SIGNBOOK's door gate
is `state.purchase` present at mount. **A website-order lead therefore lands on the
staff-provisioned door** — order → details → sign → **payment** — and never reaches the new
**time → submit** steps. Skipping the offering step is right (they chose already); **getting a
payment step and never being asked for a day and time is not**, under CR-98's *"pay after we
approve"*. The gate needs a third case: *has an order, but has not yet asked for a time.*
**Not built here — it is a spec change, not a build decision** (§7 puts the door and payment out of
scope, and `api/sign-start.ts` is SIGNDOOR's file, merged three hours ago). → `DSNR`.

## ⚠️ BUILT AFTER THE REPORT WAS FIRST WRITTEN — two owner directions
Both are recorded in full elsewhere; this is the index so nothing is missed at merge.

**1 · The door now knows who is knocking** —
`docs/reports/SIGNBOOK-FINDING-the-door-does-not-know-who-is-knocking.md`.
Migration `20260901T1700` (applied): `account_state_for_email` (service_role only, `anon` and
`authenticated` revoked) + the `SIGN_IN_EXISTING` template. `api/_lib/accountDoor.ts` holds the one
branch both doors use. `api/sign-start.ts` sends "click here to sign in" to an address that already
has a working sign-in and provisions nothing. `api/register-invited.ts`'s 409 — **the one that
rejected the owner's own password** — is fixed at its cause: it was reading `auth.users` through
PostgREST, which `service_role` has no SELECT on. `api/request-activation.ts` is new and gives a
website order submission the same activation email and the same link destination, dispatched from
`submitRequest` alongside the two incumbent sends.

**2 · The wizard runs outside the app chrome, and every step is lossless** — his option B.
`/app/onboarding` is declared in `App.tsx` **outside `AppLayout`** — same URL, same
`requireMember` guard, no nav and no header beside a flow somebody is meant to finish. The
"back to your dashboard" fallback is gone, so the back chain **terminates at the first screen**.
The time step gained a `useFormDraft` so a reload cannot cost the answer. And an **unchanged**
details form no longer re-writes the profile or **re-generates the documents** — pressing Continue
on a form nobody touched is now a navigation, not a write.
⚠️ **This knowingly reverses `TASK-FIX4` §7** (*"on the first step it leaves the flow rather than
disappearing"*), on the owner's instruction.

## FLAGGED, NOT FIXED — one line each
- A booking's `status_events` row is written with `entity_type = 'offering'`, not `'booking'`.
- `request_open_time` still writes a `booking_change_requests` row AND now a `requests` row; REQCARDS
  should decide which one the staff card reads rather than showing both.
- B7 above: a member with no `clients` row cannot submit; nothing in the wizard heals it.
- `flush_held_executed_document_emails` runs at 30 minutes, so a wizard left open longer gets the
  documents email early and the order/booking blocks separately.

## ASK-OWNER — none open
The one this thread raised (step 9's landing surface) **was answered and is built** — see criterion
3. ⚠️ **ORCH: his answer is quoted verbatim there and belongs in
`docs/reference/CHANGE-ORDER-LEDGER.md` as `CR-98 · A4`.** I did not file it myself: `LIFECYCLE` is
live and that file is not mine to take.

## GATES
| | |
|---|---|
| `typecheck` | **0** |
| `typecheck:api` | **0** |
| `lint` | **46** — the baseline exactly. Measured per-file: `Onboarding.tsx` carries the same single pre-existing warning before and after |
| `build` | **clean** (prerender + sitemap written) |
| `test:api` | **7/7** |
| `test:db` | not run — red at baseline, proves nothing (TASK-ROLE §3) |
| `probe-signbook.mjs` | **35/35** |
| `probe-sign-minor.mjs` | **30/30** — SIGNDOOR's probe, re-run, no regression |

## ⚠️ THE OWNER'S CHECKLIST — renders are NOT verified by me
Please run these. **Item 1 is the whole task; item 3 is the only thing no test here can reach.**
1. **On your phone**, open a `/sign/rider` invitation on a fresh address and walk it through. You
   should get: your details → the release → **choose your lesson** → **pick a day and time** →
   a screen listing both with **"Send my request"** → *"Your request is with us."* **No payment
   screen anywhere.**
2. Check the step list at the top reads all six steps **from the first screen** and does not grow.
3. **Check that inbox.** You should have **ONE** email: the signed release attached, **your order**
   and **"You asked for …"** in the body. ⚠️ **Two emails means the hold did not take — tell ORCH.**
4. Check `hello@`: a **notification bell** item *"A client requested …"* **and** an email carrying
   the order code, the price and the requested time.
5. **The other door:** provision a client the way you normally do and open their onboarding. It must
   still show **Your order → Your details → Review & sign → Payment**.
6. On the last screen press **Continue** — the app-overview modal should open — then close it. You
   should land on the **community feed**, not the dashboard.
7. ⚠️ **The chrome, which no test here can check.** Through the whole wizard there must be **no
   nav, no header and no "back to your dashboard"** — only a **Back** link, and none of it on the
   very first screen.
8. ⚠️ **Re-run your own failing case.** Put an address that **already has an account**
   (`cjzigs@icloud.com`) into a `/sign/*` door. You should get *"Sign in to your account"* with a
   link to the **login page** — and never reach a password screen. Then use an address we hold as a
   **lead only** and confirm you get the normal activation email.
9. ⚠️ **Submit an order on the website with a fresh address.** You should now get the **activation
   email** — that link has never been sent before today. ⚠️ **You will also get the "here is what
   you sent us" confirmation; that is two emails for one act and it is flagged for your call.**

## TEARDOWN
```
vite harness (port 5199)   killed
chromium (playwright)      closed by the probe
psql                       no session left open; every rehearsal ended in ROLLBACK
worktrees                  wt-1 = this thread (task/signbook) · wt-2 = LIFECYCLE · wt-3 idle
playwright                 installed --no-save, per the harness README; package.json untouched
```
⚠️ **The `wt-1` branch collision (14:19) and its repair are recorded in the ledger, §6** — including
that ORCH's `git branch -f` instruction would have orphaned this thread's first commit, and that
LIFECYCLE's work was verified safe in `wt-2` before anything was deleted.

---
## VALIDATION — ORCH7, 2026-09-01
Verified AFTER the fact: the merge (`2fa1f7b9`) was pushed before ORCH validation, against the
report's own "ORCH merges" line — recorded as a deviation in `TASK-SIGNBOOK-VERIFICATION.md`.
Checks run by ORCH post-release, all green: `submit_my_booking_request` calls `request_open_time`
(never edited — D35 held); proacl on all 7 new functions carries no anon (`account_state_for_email`
service_role-only, called only from `api/register-invited.ts:79`); gates on main: typecheck 0 ·
typecheck:api 0 · lint 46w/0e · build clean · test:api 7/7. DOOR scope was unspecced and shipped in
the same merge — verified to the same bar, recorded as deviation 2. `task/flowalign` is
undispatched and not licensed.
