# TASK-CREDITGRANT — report

**Branch** `task/creditgrant` · **worktree** `~/Downloads/claude-code-repo/wt-creditgrant`
**Date** 2026-08-23 · **Migrations applied to prod** (`lrstswfxfsezdmvkvukc`): 7 · **Not pushed.**

> Owner: *"Staff should be able to hand write a lesson credit whenever they want; they should be
> able to comp a lesson credit and generate a loss, and they should be able to generate a balance
> owed and request payment."*

All three exist, all three are one act with three prices, and none of them writes `lesson_credits`.

---

## 1. What was verified BEFORE anything was designed

The task said to read the live engine rather than assume it. Four findings shaped the design.

| Checked | Live fact (2026-08-23) | Consequence |
|---|---|---|
| `_mint_credits_for_purchase_item` | Gates on `purchases.status <> 'draft'`. **It does not read `payment_status` at all.** | **BILL mints immediately.** No new minting rule was needed — the entitlement exists the moment the order is placed, which is the shape D23 rules for a client's own declaration. The task was right to say "verify rather than assume D23 transfers": it does not transfer, but the same behaviour already falls out of the gate that is actually there. |
| `_provision_purchase_for_offerings` | Already the staff-side "make an order and let the trigger mint" pattern — but takes an offering-id **array**, quantity fixed at 1, no reason, no captured price. | Not reusable as-is (it is the invitation spine's provisioner). `grant_lesson_credit` follows its shape deliberately, including its `_notify_purchase_paid` / `notify_purchase_unpaid` fork. |
| `void_purchase_item` | Voids a line, recomputes the total, voids the order **only when the order is not already `paid`**, retains everything as evidence. | It is the undo's engine — but the undo must set the purchase to `void` *first*, or a hand-written "paid" order survives as paid with nothing on it. |
| `notifications` | **128 rows, 0 with `emailed_at` set.** The `notifications-nudge` cron that would email them has never run (matches `TASK-DEALAUTO` follow-up F3: no Vercel cron has ever run). | An in-app notification alone is not a request for money. "Request payment" raises the existing notification pair **and** sends one email immediately, logged. |

---

## 2. THE REACH (D17)

**Nav → Records → Lessons → Open credits ledger → `/app/ops/lessons/credits`.**

- `LessonCreditsPage` now also has **its own nav row** — `lessons.credits` in
  [pageRegistry.ts](src/lib/pageRegistry.ts), child of `lessons.hub`, same shape as
  `lessons.plans`. It was previously reachable only as a small underlined link on a hub KPI
  card, which is *literally* the shape D17 was written about. A surface that moves money should
  not be findable only by knowing where it hides.
- **Hand-write / comp / bill** all start from one button: **"Grant a credit"**, the page's own
  primary action, top-right of `/app/ops/lessons/credits`.
- **Request payment** has two entry points, both explicit: the confirmation screen right after a
  BILL grant, and a per-row *Request payment* link on any billed row that still owes money.
- **Undo** is a per-row *Undo* link on any staff-granted row. Where undo is impossible the row
  says **"No undo"** with the reason on hover, rather than showing a dead button.
- **Afterwards the credit is visible** in the same ledger, with an **Origin** column —
  Purchased / Hand-written / Comped / Billed / Returned / Unattributed — the reason underneath the
  service, the comped list value, and the amount owed. The balance is on the same page
  (`Credits outstanding`) and the comps figure beside it (`Comped this month`).

---

## 3. What was built

### 3.1 The three modes are one order, not one button with a checkbox

`grant_lesson_credit(client, offering, quantity, mode, reason, payment_method)` writes a
`purchases` + `purchase_items` pair and lets `purchase_items_mint_credits` →
`_mint_credits_for_purchase_item` mint. **It never touches `lesson_credits`** — proven by
`pg_get_functiondef` in the test, and by the DB-wide writer census in §5.

| Mode | Line price | Order | Client sees |
|---|---|---|---|
| `handwrite` | list | `paid` / `paid`, `amount_paid` = total, method as attested | a paid order + the usual "payment received" trail |
| `comp` | **0**, with the **list price at comp** stored on `purchase_items.config` | `paid` / `paid`, amount 0, method `comp` | "With our compliments" — and **no** payment-received notice |
| `bill` | list | `awaiting_payment` / `unpaid` | "added now — $X is owed"; **no payment-due notice until staff ask** |

Refusals are by name, not by silence: a non-staff caller, a blank reason, quantity < 1, an unknown
mode, a **recurring** SKU (*"a weekly plan is a standing slot, not a credit balance"* — D23), a SKU
with `unit_count = 0`, and — the important one — **if the engine minted nothing, the whole grant
rolls back** rather than leaving an order that merely looks like an entitlement.

### 3.2 A comp is a dollar figure, not an invisible zero

The list price is read from `offerings` **at grant time and stored on the line**, never re-derived.
`comped_credit_value(from, to)` sums it, with a per-service breakdown, excluding voided lines and
void orders — so a reversed comp stops counting as a loss.

**It is reachable today**: `Comped this month: $X · N comps · N credits` renders on the credits page
next to the outstanding balance. Per §5 of the task, the dashboard surface is **named, not built** —
see §7.1.

**Pinned by test:** changing an offering's price after the comp does not restate the recorded loss.

### 3.3 Asking for the money is its own act

`request_purchase_payment(purchase, note)` — staff-gated, refuses a void order or one that owes
nothing — calls the **existing** `notify_purchase_unpaid` spine (buyer notice + staff review-queue
notice), adds the staff note as its own line so the client sees *why*, writes
`payment_requested` on the order timeline, and returns a **send key**.

`POST /api/order-request-payment` then calls `sendPaymentRequest`, which renders the new
`PAYMENT_REQUEST` email template with the tenant's own brand identity and sends via the app's one
provider path. **Every attempt writes one `payment_request_sends` row** — success or failure, with
the provider's error verbatim. That table mirrors `receipt_sends`, exactly as `request_alert_sends`
already does; it is the repo's own idiom for provable delivery, not a new notification path.

**This is not dunning.** Nothing schedules it; one press sends one message. D9's no-dunning ruling
is about automated overdue chasing and survives intact — see §6.

### 3.4 The undo (D19.4)

`revoke_lesson_credit_grant(purchase, reason)` soft-deletes the minted credits, voids the order,
then voids each line through the existing `void_purchase_item` (evidence retained, D11/D16),
clears any standing payment-due notice, and writes `grant_reversed` on the timeline.

**It refuses, by name, in three cases** — and refusing is correct, not a gap:
- a credit already **spent** ("2 of these credits have already been used") — the lesson happened;
- a **session booked** against the credits — cancel it first;
- a payment that **actually settled** (a receipt succeeded, or a client claim was confirmed) — that
  is a refund, not an undo.

A hand-written grant **is** reversible: staff attested the money themselves, so reversing is a
correction of their own attestation, and the status event says the recorded payment is reversed
with it.

### 3.5 The ledger stopped lying

`credit_ledger(client)` is **one named query** (COUNTFIX discipline) joining each credit to the
line that minted it and the order that owes for it. It reports six origins, because six real shapes
exist on that table:

`purchase` · `handwrite` · `comp` · `bill` · **`change`** (the compensating row
`_refund_booking_credit` leaves when a standing slot is given back) · **`unknown`**.

> **Found while building this:** one live credit row on prod (`d2697af5…`, 2026-08-18) has **no
> line, no order, no offering and no package key** — TASK-AUTHORITY's orphan shape, fully spent.
> A naive `coalesce(grant_mode, 'purchase')` would have labelled it *Purchased*. The ledger now
> says **Unattributed**. It is not otherwise touched: it is spent, and it is evidence.

`can_undo` mirrors the revoke RPC's own refusals so the page never offers a button that would
throw, and `undo_blocked` carries the sentence explaining why.

---

## 4. Migrations (all applied to prod, dry-run in `BEGIN; … ROLLBACK;` first)

| File | What |
|---|---|
| `20260823T0100_creditgrant_1_a_staff_grant_is_a_word_on_the_order_timeline.sql` | 3 `status_events_vocab` codes — `staff_grant`, `grant_reversed`, `payment_requested`. All `is_true_status = false`: notes on the timeline, never replacing `current_status`. |
| `…T0110_creditgrant_2_a_staff_grant_is_an_order_not_a_second_write_path.sql` | `grant_lesson_credit()` |
| `…T0120_creditgrant_3_every_grant_can_be_taken_back.sql` | `revoke_lesson_credit_grant()` |
| `…T0130_creditgrant_4_a_comp_is_a_dollar_figure_not_an_invisible_zero.sql` | `comped_credit_value()` |
| `…T0140_creditgrant_5_asking_for_the_money_is_its_own_act.sql` | `payment_request_sends` table + RLS, `request_purchase_payment()`, `log_payment_request_send()` |
| `…T0150_creditgrant_6_the_payment_request_email.sql` | `PAYMENT_REQUEST` email template + 3 `template_tokens` dictionary rows (`ORD.DISPLAY_CODE`, `ORD.LABEL`, `MSG.STAFF_NOTE`) |
| `…T0160_creditgrant_7_the_ledger_says_where_each_credit_came_from.sql` | `credit_ledger()`, `grantable_offerings()` |

`ORD.DISPLAY_CODE` closes a gap `ORD.UUID`'s own notes recorded on 2026-08-12: *"The real order
number lives on the purchase (PUR-000001 style) and has no token today."*

**Code:** `api/_lib/paymentRequest.ts`, `api/order-request-payment.ts`,
`src/pages/app/ops/lessons/GrantCreditDialog.tsx`, `src/pages/app/ops/lessons/LessonCreditsPage.tsx`
(rewritten), `src/lib/ops/api-lessons.ts` (seam extended), `src/lib/pageRegistry.ts` (nav row),
`test/db/creditgrant_handwrite_comp_and_bill.test.ts` (new, 33 tests).

---

## 5. THE TEST (§7) — results

**1–4 proven twice: in PGlite against the real migrations, and on the LIVE production database**
inside `BEGIN; … ROLLBACK;` acting as `admin@fhequestrian.com` (`has_staff_access() = t`,
org `e656f20b…`), against a real client. Prod carries **zero** new rows from it.

| # | Requirement | Result |
|---|---|---|
| 1 | Hand-write, real staff action, ledger + reason + audit row | ✅ 8 × 8-Lesson Punch Card, `PUR-000303`, $950 recorded received. Timeline: *"Hand-wrote 8 x 8-Lesson Punch Card ($950.00 recorded as received) — Paid cash at the barn 2026-08-23"*. `audit_logs` INSERT on `lesson_credits`, credits 8. |
| 2 | Comp + a query proving the list-price-at-comp sums | ✅ 2 × Single Lesson, `PUR-000304`, line $0, `list_price` 150 on the line. `comped_credit_value()` → `list_value 300.00`, `comp_count 1`, `credits_comped 2`, per-service breakdown. Price-change immunity pinned by test. |
| 3 | Bill = a real pending balance; "request payment" fires and is provably delivered | ✅ `PUR-000305`, `awaiting_payment`/`unpaid`, $150 owed, **1 credit minted anyway**. `request_purchase_payment` → 2 `purchase_unpaid` notifications + the staff note, recipient resolved (`kitgarcin@gmail.com`), timeline: *"Payment of $150.00 requested — Zelle is easiest for us"*. Delivery is provable via `payment_request_sends` (one row per attempt, error verbatim) — see §7.4 for what "delivered" can and cannot mean today. |
| 4 | Every grant has a working undo, proven by using it | ✅ Comp undone on prod: `credits_revoked 1`, `items_voided 1`, order voided, and `comped_credit_value()` dropped `300.00 → 0`. Hand-write undo also reverses the recorded payment. Refusals proven for spent credits, live bookings, double-undo, no reason, and a non-grant order. |
| 5 | `grep` — no new raw write onto `lesson_credits` outside the engine | ✅ App code: `lesson_credits` appears only in **SELECTs** (`api-lessons.ts` ×2, `api-member.ts` ×2). DB writer census — `_debit_or_create_for_booking`, `_generate_plan_month`, `_mint_credits_for_purchase_item`, `_refund_booking_credit`, `book_open_slot`, `complete_lesson_session`, `purge_account`, `set_recurring_day(s)`, `swap_booking_item` (all pre-existing) **+ `revoke_lesson_credit_grant`, which only ever sets `deleted_at`** (asserted by test). `grant_lesson_credit` is **absent from that list**. |
| 6 | `typecheck` / `typecheck:api` / `lint` → 0 errors | ✅ 0 / 0 / 0. Lint warnings **46 — byte-identical to the pre-change baseline** (measured by stashing). My files lint clean on their own. |

**Suite regression check (stash-measured):**

| | Files | Tests |
|---|---|---|
| `test/db` before | 51 failed / 26 passed (77) | 193 failed / 575 passed / 107 skipped |
| `test/db` after | 51 failed / **27 passed** (78) | 193 failed / **607 passed** / 107 skipped |
| `test/ui` before / after | 99 passed, 10 env errors — identical | identical |

**Zero regressions.** The 51 red `test/db` files and the 10 `test/ui` env errors are the
pre-existing baseline, untouched by this task.

---

## 6. Decisions taken, and one deliberate collision (flagged per D24)

**D9 says there is no dunning email, because payment is prepaid-gated.** The owner has now asked
for *"generate a balance owed and request payment."* These do not actually collide — but the line
is thin enough to state rather than assume:

- **What D9 rules out survives untouched:** no schedule, no reminder series, no automatic overdue
  chase, no producer that fires without a person. `vercel.json` gains nothing.
- **What this adds:** a human presses a button, once, and one message goes. That is correspondence,
  not dunning. The task's §5 explicitly puts anything more elaborate out of scope, and nothing here
  can repeat itself.

Other judgement calls, made rather than escalated:

1. **Recurring SKUs are refused, by name.** A weekly plan is a standing slot (D23); granting one
   would either mint nothing or mint the punch card D23 rejects. `grantable_offerings()` does not
   offer them, so the picker cannot present a choice the RPC would refuse.
2. **A comp posts as `status='paid'`, `amount=0`, `payment_method='comp'`.** "Paid" here means
   *nothing is outstanding*, which is true, and it keeps comps out of the unpaid queue. The mode is
   never inferred from that — it is read from `config->>'grant_mode'`.
3. **BILL raises no payment-due notice on its own.** §2 of the task says asking is a distinct act;
   auto-notifying would have made the "Request payment" button a duplicate.
4. **The undo refuses a settled payment.** Voiding an order does not return money. That is a refund
   and it belongs to the payment tools.

---

## 7. Flagged, not fixed

### 7.1 The comps figure has no dashboard zone yet — **named, per task §5**
`comped_credit_value()` is built and rendered on the credits page. The dashboard reach point is
**zone `B1` "Money that has not landed"** (`src/lib/dashboard/registry.ts`, business view), whose
reader is `dashboard_business_zones`. It does not call this function. That is the follow-up, and it
is deliberately not built here.

### 7.2 `email_templates` still has no editor — a **pre-existing D13 gap**, now 22 templates wide
Grep finds **zero** frontend references to `email_key` (2026-08-23). The owner cannot change a word
of any transactional email without SQL. `PAYMENT_REQUEST` inherits that gap; it does not create it.
Per D13's own wording this makes the *email wording* unfinished, not the feature — but it should be
named as a real piece of work: **an email-template editor, alongside the D12 Document/Form
builders**, which is where D12 already says correspondence emails belong ("their own Templates
section").

### 7.3 `npm run check:tokens` exits 1 — **pre-existing, and it does not read email templates**
The guard's reverse check lists 55 registry rows "appearing in no body". It scans only
`contract_clause_defs` / `contract_templates`, **never `email_templates`**, so every email-only
token is on that list already — `MSG.LINK`, `MSG.COUNT`, `MSG.ITEMS`, `TXN.AMOUNT` among them. The
three rows added here join that pre-existing class of 52. Fixing it means teaching the guard about
email bodies; that is a one-file change to `scripts/check-token-registry.mjs` and is **not done
here** because it would change the pass/fail status of 52 rows this task did not create.

### 7.4 "Provably delivered" today means *provably attempted, with the outcome recorded*
`payment_request_sends` records every attempt with the provider's verbatim error, and no row at all
means the endpoint never ran — that is the same standard `receipt_sends` and `request_alert_sends`
hold. **What cannot be proven from this thread** is a successful SMTP hand-off, because that needs
`GMAIL_SMTP_USER` / `GMAIL_SMTP_PASS` in a deployed environment; a local run returns
`email provider not configured`, which the code logs as a failed attempt (proven by test) rather
than swallowing. The in-app notification lands regardless and is what the client sees on the order
page. **The daily digest that would otherwise carry it is still dead** — 0 of 128 notifications ever
emailed, because no Vercel cron has ever run (already flagged by `TASK-DEALAUTO` F3; unchanged
here).

### 7.5 One orphan credit row on prod, left alone
`d2697af5-4d47-4265-9c7a-6362a400fe39` — no package, no offering, no purchase, `credits_total 1`,
`credits_remaining 0`, created 2026-08-18. It is fully spent, so it is evidence of a lesson, not a
live entitlement. The ledger now labels it **Unattributed** instead of silently calling it
*Purchased*. It is **not** cleaned up here: deleting spent evidence is the opposite of D11, and
`authority_4` already voided the orphan that was still spendable.

### 7.6 Not built, and deliberately so
- Recurring/automated payment reminders (task §5).
- Any change to the client-facing checkout (task §5) — `create_my_purchase` and the shop path are
  untouched.
- A partial undo (returning 1 of 4 granted credits). The undo is all-or-nothing; a partly-spent
  grant refuses and says how many were used. Splitting a grant is what `split_purchase` /
  `void_purchase_item` are for on the order side, and no owner requirement asked for it.
