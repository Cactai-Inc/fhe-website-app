# TASK-BOOKS1 — what a sale was worth, what was collected, and what was given away

**Authored 2026-08-31 by ORCH6. ⚠️ REWRITTEN THE SAME DAY after the owner corrected the mechanism —
see `CR-89`. If you have seen an earlier version of this file quoted anywhere, it is superseded.**

Builds **`CR-89`** and the revenue half of **`CR-86`** *(gaps 2 and 4)*.
⚠️ **It does NOT build the monthly cost sheet, the P&L page, campaign ROI or any dashboard tile.**

---

## 1. THE REQUIREMENT, VERBATIM — and the correction that defines this task

> *"we need to construct the order like any other, then we mark it paid by using an option that comps
> the purchase. This shows the customer the price in full, and it shows the amount owed is $0. The
> system needs to record the loss of the revenue as whatever standard accounting dictates, but
> ultimate anything of monetary value given for free is a write-down on our collected revenue in some
> way and the system needs to track these as well as discounts appropriately. so when we do our taxes
> our revenue and costs and losses and profits are all easily within reach and exportable."*

> *"Yes we have not comped anyone yet, but we have been giving a lot of discounts and need to track
> and account for those and the capability to discount to $0 is part of the same mechanisms."*
> — owner, 2026-08-31

**And the earlier, still-standing ruling:** **a comp's loss is valued at the LIST price**, captured on
the line **at the time of sale**, because offering prices are editable.

### 🔒 THE MECHANISM, AND IT IS NOT WHAT AN EARLIER DRAFT OF THIS FILE SAID
1. **The order is built like any other order** — real lines, real prices, a real total.
2. ⚠️ **The comp or discount is a DISPOSITION APPLIED WHEN THE ORDER IS MARKED PAID.**
3. ⚠️ **The customer sees the full price AND that they owe $0.** The give-away is visible, never
   hidden behind a zero-priced line.
4. **The shortfall is recorded as a write-down against collected revenue** — two figures on one sale.
5. ⚠️ **A discount to $0 IS a comp. ONE mechanism on a spectrum, not two features.**
6. ⚠️ **EXPORTABLE. Tax season is the stated use.** Export is in scope, not a later nicety.

⚠️ **THEREFORE `grant_lesson_credit`'s `comp` MODE IS SUPERSEDED, NOT THE MODEL TO COPY.** It builds a
*special* order (`amount = 0`, `payment_method = 'comp'`), so **the customer never sees what they were
given.** ⚠️ **Measured: it has been used ZERO times, so nothing is stranded by retiring that mode.**
**Its `handwrite` and `bill` modes are order-creation shortcuts and stay.** ⚠️ **Do not leave two ways
to comp** (D18).

---

## 2. WHAT I MEASURED — production, 2026-08-31, by ORCH6

| | |
|---|---|
| `purchase_items` | **14 rows** · `price_amount · price_unit · quantity · config jsonb` — ⚠️ **no list price, no disposition, no reason** |
| lines carrying `config->>'grant_mode'` / `'list_price'` | ⚠️ **0 / 0** — the credit-side comp model has never been used |
| `purchases`, paid | **4** — `PUR-000316 $120` · `PUR-000319 $880` · `PUR-000320 $880` · `PUR-000333 $55`. **Every one `amount_paid = amount`.** Total **$1,935.00** |
| comps in the database | ⚠️ **ZERO** |
| ⚠️ **discounts already given, unrecorded** | ⚠️ **UNKNOWN AND REAL** — *"we have been giving a lot of discounts."* **This task builds the field; the history is the owner's data pass** |

✅ **`CR-86`'s urgent ASK-OWNER 1 — "have comps been marked paid to date?" — is ANSWERED: no.**
**Today's revenue figures are trustworthy. Do not re-ask it.**

---

## 3. ⚠️ THE DEADLINE, AND UNDER CR-89 IT IS NO LONGER HYPOTHETICAL

```
revenue_summary:  coalesce(sum(coalesce(nullif(p.amount_paid, 0), p.amount, 0)), 0)
                  FROM purchases WHERE payment_status = 'paid' AND paid_at IN WINDOW
```

⚠️ **`nullif(amount_paid, 0)` means a PAID order that collected ZERO books at `p.amount`.**
**Under CR-89 a comped order carries the FULL LIST PRICE in `amount` and 0 in `amount_paid` — exactly
that shape.** ⚠️ **So the first comp entered under the new mechanism books as full-price revenue and
records no loss: a double error in one direction.**

⚠️ **THE FIX AND THE DISPOSITION SHIP IN THE SAME BRANCH.** Neither alone is safe.

---

## 4. THE SEAM THAT ALREADY EXISTS — extend it, do not add one

**`mark_purchase_paid(p_purchase_id, p_amount, p_reference, p_method, p_paid_at)` is the ONE payment
spine** *(D6 — `api-payments.ts:14`: "one payment spine, not two")*. Everything settles through it:
`/api/orders-mark-paid`, `confirm_payment_claim`, the Zelle match, the cash confirm, the booking fee.

⚠️ **IT ALREADY TAKES AN AMOUNT.** A short payment is already recordable. **What is missing is
WHY it was short** — a discount, a comp, or a balance still owed — **and everything that follows from
knowing.**

⚠️ **THE FIVE ORDER-WRITING PATHS** — `create_my_purchase` · `_provision_purchase_for_offerings` ·
`grant_lesson_credit` · `apply_booking_fee` · `submit_public_request`. **They CREATE orders; they do
not settle them.** ⚠️ **The disposition belongs at settlement, on one function — that is the whole
point of CR-89.** **What the creation paths owe this task is the LIST PRICE on the line.**

---

## 5. 🔒 RULINGS — decided, with the reasoning. Build them; do not re-open them

**R1 · The disposition lives on the ORDER, at settlement.** `purchases.payment_disposition`
*(CHECK `paid | discounted | comped`, NOT NULL, default `paid`)* · `purchases.write_down_amount`
*(what was given away)* · `purchases.write_down_reason` *(required whenever the disposition is not
`paid` — D19: no reason, no give-away)*.
⚠️ **`amount` stays the FULL price and `amount_paid` stays what was COLLECTED.** The write-down is
`amount − amount_paid`, **stored** rather than re-derived, so a later price edit cannot move a closed
month's books.

**R2 · The LIST PRICE is captured on the LINE at the time of sale.**
`purchase_items.list_price_amount numeric`. **Why both:** the order-level write-down is the accounting
figure; the line-level list price is what makes it defensible three years later, when the offering
costs something different. ⚠️ **Never re-derive a past loss from today's catalogue.**

**R3 · Percentage is an ENTRY convenience, never a stored rule.** The record is always the two
amounts plus a reason. **A standing discount RULE is NOT in this task** *(D21 would demand an editor
for it)*.

**R4 · The customer sees it.** Full price · the reduction · **amount owed $0**. ⚠️ **This is the
owner's own sentence, not an inference.** It applies to a discount and to a comp alike.

**R5 · `revenue_summary` recognises what was COLLECTED.** ⚠️ **`nullif(amount_paid, 0)` goes.**
`amount_paid = 0` on a paid order is **zero revenue**. ⚠️ **`amount_paid IS NULL` is NOT zero** —
keep `coalesce(p.amount_paid, p.amount, 0)` for the null case; only the explicit zero changes meaning.
**The same call additionally returns `write_down_total` and a count, for the window and the prior
window, FROM ONE READ** — a second function computing its own figure is how `calendar_revenue` and
`revenue_summary` came to disagree **9.7×**.

**R6 · EXPORT IS IN SCOPE.** ⚠️ **One named period read → CSV: order · date · client · full price ·
collected · write-down · disposition · reason.** *"so when we do our taxes … all easily within reach
and exportable."* **The cost and profit columns arrive with the cost sheet; this export must be built
so they slot in without a second export appearing beside it.**

**R7 · ⚠️ `grant_lesson_credit` IS ELIMINATED ENTIRELY — owner, 2026-08-31.** *"The grant lesson
credit was supposed to be eliminated. i dont see a use case for it, we just process an order and use
the comp to make the user cost $0 and it works for all purchases not just lessons."*
⚠️ **All three modes go, not just `comp`.** `handwrite` and `bill` are order-creation shortcuts that
the ordinary order path plus the payment disposition already covers — **for every kind of purchase,
not just lessons.** **0 rows have ever used any mode.** **Retire behind the repo's pattern; do not
hard-delete** (D32).
⚠️ **BUT NOT BEFORE ITS REPLACEMENT IS REACHABLE.** **Measured 2026-08-31: `markOrderPaid` has exactly
ONE call site — `PaymentReviewPage` — and the client record's Orders tab cannot settle an order.**
**So today, removing this RPC would take away a capability before the replacement path exists.**
🔒 **THEREFORE: this task builds the disposition and the accounting; the RETIREMENT lands with
`CR-94` pass 2, which makes settling reachable from the client record.** ⚠️ **State this explicitly in
your report so the next thread does not think it was forgotten.**

**R8 · An offering-level "promotional" flag is a DIFFERENT FACT and is NOT this task.** *This offering
is promotional* ≠ *this sale was discounted*. If it is added later it seeds the default; it never
replaces the record of what happened.

---

## 6. ⚠️ THE TRAPS

- ⚠️ **`CREATE OR REPLACE` with NEW DEFAULTED PARAMETERS OVERLOADS RATHER THAN REPLACES.** You are
  widening `mark_purchase_paid`, which has **five existing call sites across the API and the UI**.
  **Old 5-arg calls will keep resolving to the OLD body — a fix that appears to do nothing.**
  ⚠️ **Drop the old signature explicitly and prove every caller moved.**
- ⚠️ **`DROP FUNCTION` + `CREATE FUNCTION` RESETS THE ACL silently.** `revenue_summary`,
  `mark_purchase_paid`, `comped_credit_value` and `grant_lesson_credit` are `SECURITY DEFINER`.
  **Restore grants explicitly; paste `pg_proc.proacl` before and after.**
- ⚠️ **`UPDATE OF <col>` triggers fire on the columns the STATEMENT NAMES**, not on what ends up
  stored. `status_purchases` is declared `UPDATE OF status, payment_status`. **If you settle an order
  by writing new columns, prove the status events still fire** — this exact trap has bitten three
  times in this repo, and `report_my_payment` already lost every status event to it.
- ⚠️ **`purchases.amount` is not necessarily the sum of its lines today.** **Establish the
  relationship and REPORT it before making `amount` mean anything new.**
- ⚠️ **THE SIGNING FREEZE IS IN FORCE**; **71 EXECUTED documents are evidence**; **a LIVE LEASE is in
  production** (Pamela Godde, `7adcd08f-fd5d-40f9-b726-634074266d7c`). Nothing here touches them.
- **`test:db` red is the documented baseline and proves nothing.** Verify with SQL against production.
- **Lint baseline 46** · typecheck 0 · typecheck:api 0.

## 7. OUT OF SCOPE — name them in the report, build none

The **monthly cost sheet on the horse record** *(CR-86 gap 3, its own task)* · **the P&L / financial
page** *(CR-88)* · **expense categories and their charts** *(`CR-91` — typed by him, remembered per
scope, and they must go through `lookup_options`, never a second vocabulary)* · **campaign ROI**
*(CR-88)* · **any dashboard tile** *(`TASK-FIX6` renders what exists)* · **the full line-item editing
model** *(CR-16/CR-38…CR-42)* · **the standing-schedule cadence and month-end invoicing** *(`CR-90` —
its own task, and it is a bigger one)* · **his historical discount backfill** *(his data pass — this
task gives it somewhere to land)*.

⚠️ **`resources` · `resource_lots` · `consumption_events` · `cost_allocation_rules` ·
`billable_lines` are built and all 0 rows. THE OWNER RULED THE PER-EVENT COST LEDGER OUT.
LEAVE THEM UNDRIVEN (D32) and say so**, so a later thread does not "finish" them.

## 8. CONSTRAINTS

- **Worktree `~/Downloads/claude-code-repo/wt-books1`, branch `task/books1`, from `origin/main`.**
  ⚠️ **Copy `.env.db` AND `.env` in.** ⚠️ **NEVER `~/Desktop`.**
- ⚠️ **Files you do NOT own:** `AppLayout.tsx` / `pageRegistry.ts` *(`TASK-CR85`)* ·
  `OwnerDashboard.tsx` and `dashboard/*` *(`TASK-FIX6`)* · `ops/kit/Modal.tsx` *(`TASK-MODAL2`)*.
  **Need a change there? REPORT THE DIFF; the orchestrator applies it.**
- ⚠️ **`revenue_summary` AND `mark_purchase_paid` ARE YOURS.** Other threads may call them and may not
  redefine them. **If either's shape changes, say so in ONE clearly-marked block** so FIX6 is told,
  not surprised.
- **Migrations:** `BEGIN; … ROLLBACK;` → apply → verify → commit. `YYYYMMDDTHHMM_sentence_name.sql`.
  **No self-contained `COMMIT;`.**
- **COMMIT AS YOU GO. DO NOT PUSH.** **Stage explicit paths; never `git add docs/`.**
- ⚠️ **TEARDOWN: paste a process census.**

## 9. THE REACH — answer both, with file and line

1. ⚠️ **What does a person CLICK to comp or discount, and is it the only way?** The settlement
   surfaces are **`PaymentReviewPage`**, the orders list's mark-paid action, and
   `/api/orders-mark-paid`. ⚠️ **`ProvisionClientForm`'s order block already tells staff *"A comped,
   zero-priced offering counts the same as a paid one"* — it talks about a comp it cannot record.**
   **Reconcile that copy with what you build.**
2. ⚠️ **Where does the owner READ discounts and comps for a period, and EXPORT them?** Name the
   surface. **Do not build a page to hold a number** — but R6's export must be reachable by a click,
   not only by a SQL query.

## 10. THE TELL (D19)

- **It states what it will do before it does it** — the amount being written down, in dollars.
- **It records who, why and when**, and **it can be undone.**
- **The customer's copy shows full price, the reduction, and $0 owed** (R4).

## 11. THE TEST THIS MUST PASS — numbered, provable, pasted

1. **An ordinary order, marked paid as COMPED, keeps its full price on the order and the line**, and
   shows **$0 owed**. Paste the row.
2. ⚠️ **That order books ZERO revenue and an $880 write-down** — from ONE `revenue_summary` call.
3. ⚠️ **THE REGRESSION THAT MATTERS: the four existing paid orders total EXACTLY `$1,935.00` before
   and after.** Paste both.
4. **A $880 order settled at $792 books $792 revenue and an $88 write-down**, disposition
   `discounted`, reason recorded.
5. ⚠️ **A short payment that is NOT a discount still reads as a balance owed** — prove the two are
   distinguishable, because that is the whole point of the disposition.
6. ⚠️ **`amount_paid IS NULL` behaves exactly as it did.** Prove it.
7. **The CHECK refuses `COMP`, `comped `, `free`.**
8. ⚠️ **Every existing `mark_purchase_paid` call site resolves to the NEW body.** Name them; prove
   the old signature is gone.
9. ⚠️ **The status events still fire on settlement** — probe it, do not infer it from a correct row.
10. **`pg_proc.proacl` for every function replaced, before and after.**
11. **The export produces the period file, and the numbers in it reconcile to criterion 2 and 4.**
12. **A comp is undoable, and the undo refuses one whose credits are spent.**
13. `typecheck` · `typecheck:api` · **lint ≤ 46** · `npm run build` — paste the numbers.
14. ⚠️ **Renders NOT VERIFIED by you** — a numbered checklist the owner runs, ⚠️ **including what the
    CUSTOMER sees on a comped order**, which is the half only he can confirm.

## 12. WHERE THE REPORT GOES

`docs/reports/TASK-BOOKS1-REPORT.md`. ⚠️ **Its most valuable section is "flagged, not fixed."**
**A green function call is not a shipped feature — prove the reach.**
