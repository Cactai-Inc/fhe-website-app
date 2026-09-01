# TASK-MONTHEND — the month-end invoice, the reminder, and a deliberate override of D9

**Authored 2026-09-01 by `DSGN-1`** from `CR-90` (`docs/reference/CHANGE-ORDER-LEDGER.md:3642`).
⚠️ **Read `docs/method/TASK-ROLE.md` first.**
🔒 **MERGES AFTER `TASK-LIFECYCLE`.** It cannot be built before `pending` means something.

---

## 1 · THE OWNER'S WORDS

> *"The payment invoices which need to go out today should be automatically generated and sent 3 days
> before the last day of the month stating that their payment for next month is due at the end of the
> month and then if unpaid on the last day of the month another notice goes out via email reminding
> them of the payment being due. Once they confirm their payment to us we confirm it was received and
> the pending bookings for the month flip to booked or confirmed."*

**The rule, as ruled:**
- **Invoice: generated and sent 3 days before the last day of the month**, stating next month's
  payment is due at month end.
- **Unpaid on the last day of the month → a second email reminder.**
- ⚠️ **Nothing accrues past the pending month until money is confirmed.** *(That half is
  `TASK-LIFECYCLE`'s horizon. This task does not generate bookings.)*

---

## 2 · ⚠️ THE HEADLINE TRAP — THIS TASK DELIBERATELY OVERRIDES **D9**, AND MUST SAY SO

**D9 (CLAUDE.md) reads:** *"The email chain ends at setup. There is NO welcome email and NO dunning
email… Payment is prepaid-gated (no payment, no service), so overdue reminders have no business
function. Both producers are deleted, not dormant."*

⚠️ **CR-90 asks for a scheduled invoice AND a scheduled overdue reminder. That is dunning, and the
owner asked for it explicitly, in his own words, on 2026-08-31.**

**And the incumbent was built to honour D9 on purpose.** `api/_lib/paymentRequest.ts`, its own header:
> *"NOT DUNNING (D9): nothing schedules this. It fires only when a staff member presses the button,
> once per press."*

🔒 **THE RULING FOR THIS TASK: CR-90 WINS. It is newer, explicit, and the owner's own instruction.**
⚠️ **But it is an override of a settled decision, and D24 governs exactly this situation:**
*"When a settled decision collides with a newer one, override deliberately and FLAG IT."*
**This is the SECOND narrowing of D9 — D24 was the first.**

**What the build must do about it, and this is not optional:**
1. ⚠️ **State the override in the report, in its own section, naming D9.**
2. ⚠️ **Correct the `paymentRequest.ts` header comment.** **Leaving a comment that says "nothing
   schedules this" beside a cron that schedules it is how the next thread gets it wrong.**
3. **Recommend the D9 amendment wording to ORCH.** ⚠️ **Do NOT edit `CLAUDE.md` yourself** — a
   settled decision is amended by the owner through ORCH, not by a build thread.

**What survives of D9, and you must not break it:** **no welcome email**, and **no service delivered
unpaid**. **The narrowing is specifically: a standing monthly plan gets a due notice and one overdue
reminder, because a recurring plan has a billing cycle that the prepaid model never contemplated.**

---

## 3 · WHAT WAS MEASURED — 2026-09-01

**a · There is no invoice anywhere:**
```sql
select table_name from information_schema.tables where table_schema='public' and table_name ilike '%invoice%';
select proname from pg_proc where pronamespace='public'::regnamespace and proname ilike '%invoice%';
```
→ **zero rows, both.** ✅ **Confirms CR-90's *"No invoice is generated anywhere."***
⚠️ **But see §4 — "invoice" is the owner's word for a thing that already exists.**

**b · The scheduler exists and runs.** `.github/workflows/scheduled-jobs.yml` — hourly plus two daily
slots, `workflow_dispatch` for a manual run. ⚠️ **`vercel.json`'s `crons` block has never run**
(Hobby allows 2 daily; it declares 5 hourly) **and is deliberately left in place.**
**Add to the GitHub workflow. Do not add to `vercel.json`.**

**c · The payment request is staff-gated:**
```sql
select left(prosrc,700) from pg_proc where proname='request_purchase_payment';
```
→ `IF NOT coalesce(has_staff_access(), false) THEN RAISE EXCEPTION 'only staff may request payment';`
⚠️ **A cron runs as `service_role`. As written, this function REFUSES it.** See Trap 1.

---

## 4 · 🔒 THE INCUMBENT, NAMED (D18) — "INVOICE" ALREADY EXISTS UNDER ANOTHER NAME

⚠️ **Do NOT build an invoice generator.** The owner's *"payment invoice"* is, mechanically, the thing
this app already calls a **payment request**, and it is complete:

| Piece | What it already does |
|---|---|
| **`request_purchase_payment(p_purchase_id, p_note)`** | computes the balance due, refuses a void order and an order with nothing owed, raises the unpaid-balance notification pair, writes the order timeline, returns a send key |
| **`api/_lib/paymentRequest.ts` → `sendPaymentRequest`** | renders and sends the email; **best-effort, never throws**, so a provider outage cannot fail the recorded action |
| **`payment_request_sends`** | ⚠️ **one row per attempt, success or failure, provider error verbatim.** **No row means it never ran** — this is the idempotency guard AND the proof |
| **`/api/order-request-payment`** | the staff-pressed HTTP entry point |
| **`/api/mint-monthly-allotments` → `mint_recurring_allotments()`** | the existing **month-roll cron**, already on the schedule, already idempotent |

🔒 **THE BUILD IS THEREFORE: a scheduled caller, a date rule, and an audience query.**
**Two emails' worth of new content, and a cron. Nothing else.**
⚠️ **If you find yourself creating an `invoices` table, stop — you have taken a wrong turn.**

---

## 5 · ⚠️ THE TRAPS

**1 · `request_purchase_payment` refuses `service_role`.** It raises *"only staff may request
payment."* 🔒 **Follow the incumbent's own dual-gate idiom rather than inventing one** —
`mint_recurring_allotments` already does exactly this:
`IF NOT (coalesce(auth.role(),'') = 'service_role' OR has_staff_access())`, **and a `service_role`
caller rolls all tenants while a staff caller rolls only their own org.** **Copy that shape.**
⚠️ **Widening the gate must not widen it to `authenticated`** — prove `proacl` before and after
(`fhe-revoke-from-public-is-not-enough`: `CREATE OR REPLACE` re-grants by default).

**2 · ⚠️ "THE LAST DAY OF THE MONTH" IN UTC IS THE WRONG DAY IN CALIFORNIA.**
**GitHub cron is UTC**, and this repo has a standing finding that **there is no tenant timezone**
(TASK-LESSONREQUEST). ⚠️ **A job at `20 8 * * *` UTC is 00:20 or 01:20 Pacific — so "today" in the
job is already tomorrow's date for part of the year, and the DST boundary moves it.**
🔒 **Compute the month boundary in `America/Los_Angeles` explicitly, in ONE place, and say in the
report which date the job believed it was running on.** **Do not use `current_date` bare.**
**Month lengths vary and February exists — derive "3 days before the last day" from
`date_trunc('month', …) + interval '1 month' - interval '1 day'`, never from a hardcoded 27th/28th.**

**3 · ⚠️ IT MUST NOT SEND TWICE, AND THE JOB WILL RUN AGAIN TOMORROW.**
The daily cron fires every day; only two of those days should send. ⚠️ **And GitHub may delay or
repeat a run.** 🔒 **`payment_request_sends` is the guard — query it for an existing send for this
purchase and this billing period BEFORE sending**, the same way
`_mint_credits_for_purchase_item`'s unique index guards the month roll.
**Idempotent-by-construction, not idempotent-by-careful-scheduling.**

**4 · ⚠️ DO NOT EMAIL HISTORY.** The owner is about to backfill *"all of our clients"* — orders and
payments with real past dates (`TASK-BACKDATE`). ⚠️ **A month-end job that sweeps unpaid orders will
find backfilled ones and email real clients about money from months ago.**
**`TASK-BACKDATE` R5 hit the identical trap and ruled: a settlement carrying a past date sends
nothing.** 🔒 **Same rule here: the audience is the CURRENT billing period's standing plans, never
"every unpaid order."** **Scope the query to recurring plans and the period in question, and say in
the report exactly which orders were in and out.**

**5 · The audience is `config_kind = 'recurring'`, and paid-ness is not yours to define.**
⚠️ **`TASK-BOOKS1` owns the disposition model — what "paid" means, including comps and write-downs.**
**Read its answer; do not re-derive "unpaid" from `amount_paid` yourself.** A comped month must not
generate an invoice. ⚠️ **BOOKS1 is unmerged as of 2026-09-01 (`task/books1` @ `43cc7bd5`) — it lands
first.**

**6 · The deadline has already passed, and that is not yours to quietly fix.**
CR-90: *"Today, 2026-08-31, is the last day of the month: both the 3-day-prior invoice and the
month-end reminder are already due and neither can have been sent."*
⚠️ **Do NOT backfire the missed sends on first deploy.** **The first live run must be the NEXT
cycle.** **Report what the job WOULD have sent for the missed cycle, as a list, and let the owner
send them by hand from the existing staff button.**

**7 · `CRON_SECRET` must exist in TWO places** — GitHub Actions repo secret **and** Vercel production
env — **and they must match**, or every call 401s. ⚠️ **This is a deploy step, not a code step, and
it is the step most likely to be missed** (it has been, on this project, twice). **Name it in the
report as an owner action with the exact settings path.**

**8 · The in-app notification alone is not a request for money.** `paymentRequest.ts` records that
`notifications-nudge` **had never run** and 0 of 128 notification rows had `emailed_at` set.
⚠️ **Raising a notification is not sending an invoice.** **The email is the deliverable.**

---

## 6 · OUT OF SCOPE
- **The six states, the horizon, and the payment-confirmed flip** — ⚠️ **all `TASK-LIFECYCLE`.**
  **This task sends mail; it does not move a booking.**
- **The disposition/comp model** (`TASK-BOOKS1`) · **backdated settlement** (`TASK-BACKDATE`).
- **A general dunning engine.** ⚠️ **Two messages, on a standing monthly plan. Nothing else, ever** —
  that is the whole of the D9 narrowing and it does not generalise.
- **Editing `CLAUDE.md`'s D9** — recommend the wording; ORCH and the owner apply it.
- **Stripe or any payment collection.** The client pays by Zelle or cash and declares it (D23).

## 7 · THE REACH (D17) — ⚠️ A CRON IS NOT A FEATURE
**A scheduled job nobody can see, run or verify fails D17 the same way an unrouted page does.**
**Answer with file and line:**
1. **Where does a staff member SEE that this month's invoices went out?** ⚠️ **`payment_request_sends`
   is written and, like D19's four ledgers, may never be read back to a human. Say whether it is.**
2. **How does a staff member send one by hand if the job missed?** *(The button exists —
   `/api/order-request-payment`. Confirm it still reaches the same code path.)*
3. **How is the job run on demand?** *(`workflow_dispatch` — add the new endpoint to its `options`
   list, or it cannot be triggered manually.)*

## 8 · THE TELL (D19)
- **The client gets an email that says what is owed, for which period, and when it is due.**
- **The order timeline records the send** — the same event the staff button writes.
- **`payment_request_sends` carries one row per attempt, with the provider's error verbatim on
  failure.** ⚠️ **A silent failure is the outcome this whole ledger exists to prevent.**
- **Undo:** ⚠️ **an email cannot be recalled — so the reversibility D19 demands is exercised BEFORE
  the send.** **Name what a staff member does to stop a scheduled invoice they do not want sent**
  *(the honest answer may be "nothing today" — if so, say it plainly rather than implying a control
  that does not exist).*

## 9 · THE TEST THIS MUST PASS
1. **The date rule is right for a 28-, 30- and 31-day month.** Paste all three computed pairs.
2. ⚠️ **The rule is computed in `America/Los_Angeles`** and is correct either side of a DST change.
   Paste the boundary case.
3. ⚠️ **Run the job twice on the same day → ONE email.** Paste `payment_request_sends` both times.
4. **Run it on a non-send day → zero emails, exit 200.** ⚠️ **A silent 200 is the correct no-op —
   prove it is a no-op and not a failure being swallowed.**
5. ⚠️ **A backfilled historical unpaid order is NOT emailed** (Trap 4). Construct one and prove it.
6. **A comped/written-down month generates no invoice** (Trap 5).
7. **An unpaid standing plan on the last day of the month gets the reminder — and only then.**
8. ⚠️ **The `service_role` gate works and `authenticated` is NOT admitted.** Paste `proacl` before
   and after, and paste the refusal for a non-staff authenticated caller.
9. **The endpoint returns 401 without `CRON_SECRET` and 200 with it.** ⚠️ **The live call is the
   owner's or ORCH's to make — give the exact command and say you could not run it.**
10. ⚠️ **The missed 2026-08-31 cycle is reported as a LIST, not sent** (Trap 6).
11. **`workflow_dispatch` can run the new job by name.** Paste the workflow diff.
12. `typecheck` · `typecheck:api` · **lint ≤ 46** · `build`.
13. ⚠️ **The email as a client receives it — NOT VERIFIED by you.** Owner checklist, on his phone.

## 10 · WHERE THE REPORT GOES
`docs/reports/TASK-MONTHEND-REPORT.md`, ⚠️ **with the D9 override in its own section** (§2).
**ORCH appends its `## VALIDATION` block.** ⚠️ **A gap returns to `DSGN`.**
