# TASK-WALK2 — REPORT

**Test identities:** `cjzigs+walk1-202608201634@icloud.com` (Walk1 WALKTEST, inherited from WALK1) ·
`cjzigs+walk2-202608210343@icloud.com` (Walk2 Walk2 WALKTEST, created fresh this walk) · staff as
`admin@fhequestrian.com`.
Site: `https://www.frenchheritageequestrian.com` (production) · walk run 2026-08-21, 03:20–04:05 PDT.
Branch `task/walk2`, worktree `~/Downloads/claude-code-repo/wt-walk2`. Committed, not pushed.

---

## Can staff run the business from these screens? **Partly. Confirming payments and running the day-to-day calendar: yes. Selling anything recurring: no.**

Staff have a real, working screen for the two things WALK1 left undone — **Payment review** confirms
a Zelle or cash claim in one click, and the **Calendar** lets staff confirm a client's requested time,
reschedule, and cancel, all with visible before/after effects. That much runs the business.

**But nothing in this build can turn a paid recurring membership into a standing weekly slot.**
Tested on two independent identities against two different recurring products — the inherited
Walk1 client's 1x Weekly Lesson (**PUR-000245**) and a freshly onboarded Walk2 client's 2x Weekly
Lessons (**PUR-000297**) — and in both cases, after full payment confirmation, **zero bookings and
zero lesson credits exist for the plan.** The one button in the entire product that offers to fix
this, **"Pick your weekly time,"** is a dead link to the onboarding wizard, and the wizard — once a
client's paperwork is already signed — reports **"Nothing to do here"** and never shows a day
picker, for either identity, regardless of whether the order is paid or not. Staff have no
alternate control anywhere that reaches it either. **§3.3's acceptance test 3 and 4 (below) fail
outright — not because the behavior is wrong, but because the feature is unreachable.**

---

## Every row this walk created or changed (purge list)

Everything below belongs to a WALKTEST identity. **No real client's row was written** — see
[Stops and deviations](#stops-and-deviations) for the one place a real client's booking was opened
(read-only) by mistake.

| type | id / code | identity | action |
|---|---|---|---|
| purchase **PUR-000238** confirmed | `965d33ab-…` | Walk1 | Zelle claim → confirmed 03:24:22 |
| purchase **PUR-000245** confirmed | `3688a09a-…` | Walk1 | cash claim → confirmed 03:26:19 |
| booking **BKG-000223** confirmed, rescheduled, cancelled | `→ scheduled → cancelled` | Walk1 | credit minted+spent 03:32; moved Aug16→Aug24; cancelled 03:59:56 (credit refunded) |
| booking **BKG-001106** created, rescheduled, cancelled | new → cancelled | Walk1 | staff-authored manually against PUR-000245; moved Aug21→Aug25; cancelled 04:01:28 |
| contact + client + auth.user | `5377e3ea-…` / `0e6687c4-…` / `bd69610d-…` | Walk2 | created via `/sign/rider` 03:44–03:46 |
| invitation ×2 (1 superseded) | `2c9405f5…`, `4ad76b9c…` | Walk2 | redeemed 03:44:22 |
| 4 documents × 4 generation batches (12 DRAFT + 4 EXECUTED) | see §B | Walk2 | signed 03:52:01 — **F-19 reproduced**, see below |
| purchase **PUR-000297** created, declared, confirmed | `7a0a191c-…` | Walk2 | 2x Weekly Lessons $880 bought 03:55, cash-declared 03:57:35, confirmed 04:03:28 |
| notifications | 20 new rows, see §E | both | none emailed (`emailed_at` NULL throughout, as expected) |

**Zero bookings, zero lesson credits exist for PUR-000245 or PUR-000297** — that absence is itself
the central finding, not an omission on this walk's part.

---

## §A — confirming the two waiting payments

**Where staff go:** `Management → Payment review` → `Client claims` tab → `Pending`. Not hard to
find — one click from the sidebar, no scavenger hunt. **Not D17.**

| claim | before | action | after |
|---|---|---|---|
| PUR-000238, Zelle, $170 | `client_claim_status=pending`, `payment_status=pending` | clicked **CONFIRM PAYMENT** 03:24:22 | `status=paid`, `payment_status=paid`, `client_claim_status=confirmed` |
| PUR-000245, cash, $460 | `pending` / `unpaid` | clicked **CONFIRM PAYMENT** 03:26:19 | `paid` / `paid` / `confirmed` |

Both moved instantly from the **Pending** sub-tab to **Confirmed**, and the claim queue read *"Queue
is clear"* immediately after. `A6-claims-confirmed.png`, `A9-claims-after245-confirmed.png`.

### ⚠️ There are two different "confirm" actions, and only one of them touches credits or bookings

Confirming the **payment claim** (above) changed the purchase's payment status and fired a
`payment_received` notification — **and did nothing else.** `lesson_credits`, `service_credits`,
and `bookings` were all still 0 rows for Walk1's client immediately afterward.

Separately, the Calendar's own **"1 pending request"** banner — *"New request · Walk1 WALKTEST ·
Sunday, August 16, 2026 · 8:00 AM"* — is a **third, distinct confirm action** on the client's
originally-requested time. Clicking its **CONFIRM** button at 03:32:20 is what actually:

- flipped `BKG-000223` from `pending` → `scheduled`
- minted **exactly one** `lesson_credits` row (`credits_total=1`) tied to `PUR-000238`
- **spent it in the same instant** (`credits_remaining=0`) against that booking
- fired `booking_confirmed` — *"Your session on Aug 16, 08:00 AM is confirmed"*

**D23/D24, confirmed correct:** the client was already unblocked by declaring (per BUYANDBOOK); this
walk found nothing that re-blocks or re-unblocks access on confirm. **Confirming changed delivery
(the credit, the scheduled status, the notification), not access.**

**Idempotency:** there is no UI path to click either confirm action twice — the claim disappears
from Pending the moment it's confirmed, and the calendar banner disappears the moment its request is
confirmed. Credit and booking counts were read before and after each single click and moved by
exactly one row, never two. `C5-calendar-page.png` shows the banner; `D1-request-confirmed.png` the
result.

---

## §B — the standing slot: **not reachable, on either identity, for either recurring product**

This is the walk's central finding. Tested twice, independently:

### Attempt 1 — Walk1's existing PUR-000245 (1x Weekly Lesson, already paid)
`purchase_items.config` for this order was `{}` — no chosen day, no `plan_ends_on`. The one staff
screen that manages this (`CalendarItemPanel`'s **Monthly Plan** section) requires an existing
`lesson_credits` row for the current month before it will show *any* day-picking control; none
exists, so it perpetually reads: *"Save this booking once to assign the plan, then choose the days
it runs on."* Staff manually created a one-off booking (`BKG-001106`) linking client, offering, and
the paid purchase, submitted it — the booking appeared correctly on the calendar (`D7`) — reopened
the same item, and the Monthly Plan section **still** said "save once," unchanged, even after a full
page reload. **There is no next step available from this screen.** `D6`, `D9`, `D9b`.

### Attempt 2 — Walk2, fresh client, 2x Weekly Lessons, bought and paid start to finish
To rule out "maybe it only works for a plan set up during onboarding," a second WALKTEST identity
was built from scratch: public `/sign/rider` → activated → onboarding paperwork signed → then, as a
returning logged-in member, bought **2x Weekly Lessons ($880/mo)** through the in-app **Catalog**
(this checkout worked cleanly end-to-end — see §F). The order page's own copy reads:

> *"This is 2 standing weekly times, not a bundle of lessons — choose the 2 days and a time for
> each."* **[Pick your weekly time]**

Clicking that link (`href="/app/onboarding"`, confirmed by inspecting the anchor, not just clicking
it) lands back on the onboarding wizard, which — because paperwork is already signed — immediately
shows step 5: **"You're all set."** No day picker. No Payment step, even though the order was still
`draft/unpaid` at that moment. Declaring cash payment on the order (`B17`) changes nothing about
this. Visiting the client's **own** `/app/calendar` afterward (the self-service path the codebase
comments say exists) also produced nothing: **0 bookings, 0 lesson credits**, before and after.

**Staff-side check:** the admin view of this same order page is pixel-identical to the client's —
no extra control appears for staff. `C8-order297-admin-view.png`.

### The acceptance tests, answered honestly
- *Do standing bookings appear on the calendar as theirs?* **No — for either client, zero exist.**
- *`remaining` should be 0, no spendable credit — that's correct.* **True, trivially — there is no
  credit row of any kind, spent or otherwise.**
- *2x-weekly must yield two days a week.* **Untestable — no plan ever initializes to produce even
  one day.**
- *Do slots continue beyond the first month with no scheduler?* **Untestable for the same reason.**
  `pg_cron` was not re-checked this walk (WALK1 already established `cron.job` doesn't exist); moot
  regardless, since nothing is materialized to extend.

---

## §C — the company side, in the owner's words

*"Confirming, revising, cancelling, and authoring and inviting for bookings and accounts."*

| capability | bookings | accounts |
|---|---|---|
| **Confirm** | Payment review (§A) confirms a payment claim; the Calendar's pending-request banner confirms a requested time. Two different screens, two different effects — see §A. | No separate "confirm an account" step observed; an account exists the moment an invitation is redeemed. |
| **Revise** | Calendar → click any booking → **Edit calendar item** panel: change offering, client, time, instructor, horse, location, notes, purchase assignment. Full edit, not just time. `D9`. | Records → open a contact → **Record** tab is directly editable (name, contact, address, emergency contacts, riding background) with **SAVE CHANGES**. `C2`. |
| **Cancel** | Same panel → **Delete**, with a confirm step. Verified: refunds a credit for credit-backed bookings, does not (cannot) for the manually-authored recurring one — see §D. | Contact quick-view drawer offers **Archive** (not exercised — no need to archive a real or test account to confirm the button exists). `C1` (drawer text, screenshot excluded — see note below). |
| **Author** | Calendar → **+ Booking** → full form: offering (all 20 catalog items, including horse-care and non-lesson services), client picker (with **+ New client** inline), assign-to-existing-purchase or create-new, payment method/status, instructor, horse, location, repeat-weekly. This is a real scheduling tool, not a toy. `D2`–`D6`. | **Records → Add New → New client** (`/app/ops/accounts/new`): full staff-authored account creation — category checkboxes (Guest/Rider/Horse owner/Deal client), contact fields, **and** an optional first-lesson scheduling section (service, instructor, horse, location, duration) in the same form, ending in **CREATE & SEND INVITATION**. `C7`. |
| **Invite** | n/a | Same form as Author, above — one screen does both. Also reachable client-side via public `/sign/rider`, which this walk used end-to-end for Walk2's identity (contact → invitation → activation, §B). |

**Undoable (D19):** booking edits and cancellations are: a cancelled booking sets `status=cancelled`
and a `deleted_at` timestamp but the row is never physically removed — it is recoverable in principle
(not verified whether any UI resurrects it; none was found). Contact "Archive" was not exercised, so
its reversibility is unconfirmed, not denied.

*Note on `C0`/`C1` screenshots:* the first attempt to search Records rendered the **entire client
roster** (real names and emails) on screen; that screenshot was deleted immediately and the search
was redone filtered to "Walk1" only (`C0-records-search-walk1.png`, one row). No roster-wide
screenshot survives in this report.

---

## §D — reschedule and cancel, both shapes

### Scheduled / credit-backed — Evaluation Lesson, `BKG-000223`

| step | `remaining` on the linked credit | booking status | notification fired |
|---|---|---|---|
| before | `1 / 0` (already spent, from §A's confirm) | `scheduled`, Aug 16 08:00 | — |
| **reschedule** → Aug 24, 10:00 | `1 / 0` — **unchanged** | `scheduled`, Aug 24 10:00 | **none** |
| **cancel** | `1 / 1` — **refunded** | `cancelled` | **none** |

**Reschedule holds the credit; cancel refunds it via what is presumably `_refund_booking_credit`
under the hood** — exactly the rule the task named, and it worked cleanly. Neither action produced
a notification of any kind, to either the client or staff dashboard, or a DB row — a real gap, see
Flagged below. `D10`–`D15`.

### "Recurring" — the closest reachable proxy, `BKG-001106`

Because §B established there is no way to produce a genuine plan-backed standing-slot booking, this
test used the one manually-staff-authored booking against the recurring purchase (`PUR-000245`,
created in §B's Attempt 1). It carries **no `credit_id`** — by construction, since no plan/credit
ever initialized for this purchase.

| step | credit | booking status |
|---|---|---|
| before | none exists | `scheduled`, Aug 21 08:00 |
| **reschedule** → Aug 25, 09:00 | still none | `scheduled`, Aug 25 09:00 |
| **cancel** | **still none — nothing minted** | `cancelled` |

Reschedule and cancel both work mechanically (time changes cleanly; delete cancels cleanly). **But
cancelling minted no credit**, because the task's described rule — cancelling a standing session
mints one via `_refund_booking_credit` — has nothing to refund from, since this booking was never
routed through the plan/credit system §B found unreachable. **This is the same root cause as §B,
observed from the other side:** the only staff-reachable way to put a recurring-typed booking on the
calendar bypasses the credit machinery entirely, so the safety net the spec describes for standing
sessions does not apply to it. `D16`–`D18`.

---

## §E — notifications, three channels

**`notifications`: 20 new rows this walk** (03:24–04:03), all with `emailed_at` NULL, consistent
with every prior walk (crons that cannot run are the only writer of that column; it proves nothing
either way).

⚠️ **Caveat:** two of the twenty rows — `contract_in_review — "Horse Lease Agreement — Standard is
ready for your review"` at 03:34:19 — belong to neither WALKTEST identity and were not caused by
any action in this walk. Another orchestrated session was working the same production database
concurrently (a lease/contract task, evidently). **Any global notification count in this build is
noisy in a live multi-session environment; the per-action rows below are the reliable signal.**

| time | kind | title | client dashboard | admin dashboard | email row |
|---|---|---|---|---|---|
| 03:24:22 | `payment_received` ×3 | Payment received — Evaluation Lesson | not checked (Walk1 has no working login) | ✅ implied by claim moving to Confirmed | NULL |
| 03:26:19 | `payment_received` ×3 | Payment received — 1x Weekly Lesson | same | ✅ | NULL |
| 03:32:20 | `booking_confirmed` | Your session on Aug 16, 08:00 AM is confirmed | not checked | — | NULL |
| 03:52:0x | `party_signed` ×4 (×2 rows each) | `<doc>` fully executed; signed by Walk2 Walk2 WALKTEST | ✅ *"Book your next lesson"* card only; no per-doc mention | not checked | NULL |
| 03:57:35 | `payment_reported` ×2 | Walk2 Walk2 WALKTEST says they paid 2x Weekly Lessons in cash — not yet confirmed | ✅ *"Payment pending — cash"* on the order page itself | not checked directly, but this is the exact row Payment Review surfaced and confirmed | NULL |
| 04:03:28 | `payment_received` ×3 | Payment received — 2x Weekly Lessons | **checked, 04:05 — dashboard still shows only the generic "Book your next lesson" suggestion, nothing about this payment** | — | NULL |
| — | **(none)** | reschedule/cancel of `BKG-000223` and `BKG-001106` | — | — | **no notification fired at all for either action** |

**Channel 1 (client dashboard):** confirmed directly on Walk2's real session (`E1`) — generic only,
matches WALK1's F-10 finding exactly: a client's own payment declaration and its later confirmation
are both invisible on their own dashboard. **My Orders** (`E2`) is the one place that correctly shows
live order status ("Awaiting payment · cash" → would read differently once confirmed — confirmed
after this screenshot was taken).

**Channel 2 (admin dashboard):** Payment Review's own queues are the reliable admin-facing signal;
this walk did not separately check the general staff Dashboard/inbox for a parallel copy of these
messages.

**Channel 3 (email) — messages the owner should look for:**

| # | expected message | to | fired at |
|---|---|---|---|
| 1 | activation email for `/sign/rider` | `cjzigs+walk2-202608210343@icloud.com` | 03:44 (invitation created) |
| 2 | executed-document copies × 4 | same | 03:52 (UI: *"Your emailed copies are on their way"*) |
| 3 | payment-received confirmation, Evaluation Lesson | `cjzigs+walk1-…@icloud.com` | 03:24:22 |
| 4 | payment-received confirmation, 1x Weekly Lesson | same | 03:26:19 |
| 5 | payment-received confirmation, 2x Weekly Lessons | `cjzigs+walk2-…@icloud.com` | 04:03:28 |

---

## §F — the in-app catalog checkout, retested (WALK1's F-5)

**Fixed.** WALK1 found `POST /rest/v1/purchases` returning a raw `403` from the in-app Catalog. This
walk bought **2x Weekly Lessons** through the exact same surface, as a logged-in member, start to
finish: **Riding Lesson** category → **BOOK IT** → cart persists across the checkout hop (within one
session — see caveat below) → **GO TO CHECKOUT** → **CONTINUE TO YOUR ORDER** → real order page with
a real `PUR-000297`. No error, no 403. `B9`–`B13`.

⚠️ **Cart still does not survive a page reload** (WALK1's F-20, reproduced): a fresh navigation to
`/app/catalog` after adding an item shows an empty cart again. Add-to-cart and checkout must happen
in one unbroken visit.

⚠️ **Executed *Company Policies* no longer promises Stripe** (WALK1's F-6, appears fixed): the
signed copy Walk2 received reads *"COMPANY accepts payment by Zelle and by cash"* — no card, no
Stripe, matching the actual payment UI. `B5f`.

⚠️ **F-19 reproduced exactly:** the onboarding wizard reset to step 1 on every page load during this
walk (WALK1's F-11), and each such reset regenerated a fresh batch of 4 DRAFT documents before the
final signing pass — **12 duplicate DRAFT rows beside 4 EXECUTED**, same shape as WALK1's finding,
same root cause, still unfixed.

---

## Flagged, not fixed

Ranked. No application code was changed (§5).

| # | finding | where |
|---|---|---|
| **G-1** | **No reachable path — staff or client — produces a standing weekly slot for a paid recurring purchase**, on two identities and two products. The only UI control for it (`Pick your weekly time`) is a dead link to a wizard that no-ops once paperwork is signed. §3.3/§6 acceptance tests 3 and 4 fail outright. | §B |
| **G-2** | **Cancelling a manually-authored recurring booking mints no credit** — direct consequence of G-1: the credit/plan machinery the spec describes was never reachable for this booking in the first place. | §D |
| **G-3** | **Neither reschedule nor cancel fires any notification**, on any channel, for either lesson type. A client's session can move or vanish from their calendar with no record anywhere that it happened. | §D |
| **G-4** | **A client's own payment declaration and its later staff confirmation are both invisible on the client's own dashboard** — WALK1's F-10, reproduced on a second identity. | §E |
| **G-5** | **Cart does not survive a page reload** — WALK1's F-20, reproduced. | §F |
| **G-6** | **Onboarding wizard resets to step 1 on every reload**, regenerating duplicate DRAFT documents each time — WALK1's F-11/F-19, reproduced with a fresh identity. | §F |
| **G-7** *(fixed, noted for closure)* | In-app Catalog checkout, previously a raw 403 (WALK1 F-5), now completes cleanly end to end. | §F |
| **G-8** *(fixed, noted for closure)* | Executed Company Policies no longer promises Stripe card payment (WALK1 F-6); text now matches the Zelle/cash-only UI. | §F |

---

## Stops and deviations

**No stop condition was hit** on a real client's data with a write. **One near-miss, self-reported:**
while hunting for the correct calendar cell to open Walk1's newly-created booking, a generic
`text=Booking` matcher (index-based, iterating all booking cells on screen) opened **a real client's
own booking** (Serena Lee, `BKG-000095`) in the edit panel. **No field was changed, nothing was
submitted or deleted** — the panel was closed via its own X control the moment the mismatch was
noticed. The one screenshot taken at that moment (showing her name) was deleted immediately and does
not appear in this report or in git. Verified directly in the database afterward: `BKG-000095.updated_at`
is still `2026-08-02`, three weeks before this walk — **confirmed untouched.** All subsequent
booking-lookup scripts were rewritten to positively identify the target row (by reading the panel's
own client-select value) before taking any action on it, rather than clicking by position.

---

## Teardown

**Browser processes: none left running.** Every Playwright script closed its own browser on exit;
process census at report time found no `chromium`, `headless_shell`, or Playwright process anywhere
on the machine.

**Dev processes started by this thread: none.** No dev server was run. `psql` calls were one-shot
`-c` invocations, exiting immediately each time.

| process | owner | disposition |
|---|---|---|
| Playwright / Chromium | this thread | **none running** |
| `psql` | this thread | **none running** — one-shot per query |
| VS Code helper processes (tsserver, pylance, etc.) | pre-existing, unrelated | left running, not this thread's concern |

**Tooling** (§2): Playwright 1.62.1 + the machine's already-cached Chromium 151.0.7922.34, installed
worktree-local at `wt-walk2/walk2-tooling/` via `npm install --no-save`, `.gitignore` containing `*`
so it self-ignores entirely. **The repo's own `package.json` was never touched.**

**Credential hygiene.** No credential appears in this report, in any commit, or in any screenshot.
`FHE_ADMIN_PASSWORD` was read from `.env.test` into a process variable and never printed. Walk2's own
password was generated locally, written to a gitignored file inside `walk2-tooling/`, and never
echoed to the terminal or included in a screenshot. The one accidental real-client screenshot was
deleted; the one accidental full-roster screenshot (before search-filtering was added) was also
deleted before any commit. All 61 remaining screenshots were reviewed before writing this report;
none contains a real client's name, email, or booking detail other than the DB-confirmed-untouched
Serena Lee panel already covered above.

---

## What's next

1. **G-1 is the one finding that matters most** — it is the same shape of gap WALK1 flagged for
   credits (*"declared payment doesn't unblock booking"*), now found one layer up: **paid recurring
   memberships have no path to ever becoming a schedule.** Whatever BUYANDBOOK's `ensure_standing_slots`
   / `set_recurring_days` machinery was meant to be driven by, no UI anywhere calls it with a fresh
   purchase's actual `purchase_item_id` before a client's paperwork is already signed.
2. **Contracts (WALK3)** were explicitly out of scope here; a `contract_in_review` notification was
   observed firing from a concurrent session during this walk, suggesting that work is proceeding in
   parallel against the same production database.
3. Every row in the purge list above is still live in production, deliberately — none of it was a
   real client, so none of it needs cleanup.
