# TASK-BOOKS1 — what a sale was worth, and what we gave away

**Authored 2026-08-31 by ORCH6. Builds the REVENUE half of `CR-86` — gaps 2 and 4.**
⚠️ **It does NOT build the cost sheet, the P&L page or any dashboard tile.** Those are separate and
sequenced after this one; §7 says so explicitly.

⚠️ **THIS TASK CARRIES A DEADLINE AND IT IS THE REASON IT EXISTS.** See §3.

---

## 1. THE REQUIREMENT, VERBATIM

> *"we also had discussed the implementation of a discount and promotional (full comp no cost to the
> customer) designation we can assign to purchasable offerings. its important for our records to show
> when we give away a service or provide a discount, a lot of people are getting discounts on the
> services we are providing them and these are technically a business loss … money in/money out,
> profit or loss, discounts given during a period, money paid for a sale and discount given, etc..."*
> — owner, 2026-08-31

And on where the act happens:

> *"the books is on my side, the visible kpi is shown on the dashboard. the inputs happen on claires
> side and on my side."*

**A discount or a comp is applied WHEN THE SALE IS MADE, by whoever makes it, on the line.** It is
never reconstructed afterwards on an accounting screen.

**And the loss is valued at LIST** *(owner, asked twice, answered once — do not ask a third time)*:
a comp's recorded loss is what the thing would have sold for, **captured on the line at the time of
sale**, because offering prices are editable and valuing a 2026 comp from a 2027 catalogue is wrong.

---

## 2. WHAT I MEASURED — production, 2026-08-31, by ORCH6

| | |
|---|---|
| `purchase_items` | **14 rows**. Columns: `price_amount · price_unit · quantity · config jsonb` — ⚠️ **no list price, no disposition, no reason** |
| lines carrying `config->>'grant_mode'` | ⚠️ **0** |
| lines carrying `config->>'list_price'` | ⚠️ **0** |
| `purchases`, paid | **4** — `PUR-000316 $120 · PUR-000319 $880 · PUR-000320 $880 · PUR-000333 $55`. **Every one has `amount_paid = amount`** |
| comps in the database | ⚠️ **ZERO** |

### ✅ THIS CLOSES THE LEDGER'S OWN URGENT QUESTION
`CR-86` ASK-OWNER 1 — *"Have comps been marked 'paid' to date? If so the revenue figures are already
wrong"* — **is answered: no. There are no comps. Today's revenue figures are trustworthy.** Do not
re-ask it; do not re-derive it. **That is exactly why the fix is cheap now and expensive later.**

---

## 3. ⚠️ THE DEADLINE — AND THE MECHANISM IS NOT WHAT THE BRIEF SAYS

`revenue_summary(p_from, p_to)` sums:

```
coalesce(sum(coalesce(nullif(p.amount_paid, 0), p.amount, 0)), 0)
     FROM purchases WHERE payment_status = 'paid' AND paid_at IN WINDOW
```

⚠️ **`nullif(amount_paid, 0)` means: a PAID order that collected ZERO books at `p.amount` — the full
list price — and records no loss.**

⚠️ **CORRECTION TO `ORCH6-BRIEF.md` §3, verified in the function bodies today.** The brief says a comp
recorded as the owner intends already books as full-price revenue. **It does not — yet.**
`grant_lesson_credit` writes a comp as `amount = 0, amount_paid = 0`, so `coalesce(nullif(0,0), 0, 0)`
= **0**. Today's comp path books nothing and is CORRECT.

⚠️ **THE TRAP ARMS ITSELF THE MOMENT THIS TASK DOES WHAT IT WAS ASKED TO DO.** The instant a line
carries the LIST price and the order records what was actually collected, the natural shape of a comp
becomes *"worth $880, collected $0"* — and `nullif` converts that zero into **$880 of revenue that
never arrived**. A 50%-discounted sale collected in full is fine; a fully-comped one inverts.

⚠️ **THEREFORE: THE `revenue_summary` FIX AND THE DESIGNATION SHIP IN THE SAME BRANCH.** Not the fix
first, not the designation first. **Either alone leaves the books wrong in one direction.**

---

## 4. ⚠️ THE INCUMBENT — A COMP MODEL ALREADY EXISTS. DO NOT BUILD A SECOND ONE (D18)

**`grant_lesson_credit(p_client_id, p_offering_id, p_quantity, p_mode, p_reason, p_payment_method,
p_paid_at)` already implements the whole idea, on the CREDIT side only:**

| It already does | Where |
|---|---|
| three modes — `handwrite · comp · bill` | `p_mode`, validated server-side |
| **the list price read at grant time and stored on the line** | `purchase_items.config` → `list_price` |
| **a reason is mandatory** — no reason, no grant (D19) | `p_reason` |
| the loss reported from the captured price, never re-derived | `comped_credit_value()` → `config->>'grant_mode' = 'comp'` |
| the confirmation the staff member reads | `GrantCreditDialog.tsx` — *"Comped — $X recorded as a loss."* |
| **an undo that refuses a spent grant** | `revoke_lesson_credit_grant()` |
| the client-facing telling | order `notes`: *"With our compliments. …"* |

⚠️ **So the work is NOT inventing discount/comp. It is GENERALISING the model that exists from one
write path to all of them, and giving it a home a report can aggregate.**

### THE FIVE WRITE PATHS — every one of them must end up honest
`create_my_purchase` *(client checkout)* · `_provision_purchase_for_offerings` *(ProvisionClientForm —
the staff first order)* · `grant_lesson_credit` *(the incumbent)* · `apply_booking_fee` ·
`submit_public_request`. ⚠️ **A designation enforced in the UI of one of them is not enforced.**

---

## 5. 🔒 RULINGS — decided by ORCH6, with the reasoning. Do not re-litigate these; build them

**R1 · The three money facts become COLUMNS on `purchase_items`, not jsonb keys.**
`list_price_amount numeric` · `price_disposition text` *(CHECK `full | discount | comp`, default
`full`, NOT NULL)* · `price_reason text`.
**Why, given `grant_lesson_credit` deliberately chose `config` "rather than new columns nothing else
would read":** *something else now reads them* — that is precisely what a P&L is. A vocabulary five
writers must spell identically belongs in a CHECK constraint, and money a period report must aggregate
and filter belongs in a column. ⚠️ **`config` keeps per-line INTENT** *(recurrence, horse, plan
window)*; **it stops holding money.**

**R2 · One copy of the fact.** `config`'s `grant_mode` / `list_price` / `grant_reason` keys are
**retired in the same migration**, and `comped_credit_value()` is repointed at the columns.
⚠️ **Measured: 0 rows carry either key, so there is nothing to migrate and no dual-read window.**
`granted_by` / `granted_at` stay in `config` — provenance, not money.

**R3 · The record is always TWO amounts plus a reason** — what it was worth (`list_price_amount`) and
what was charged (`price_amount`). ⚠️ **A percentage is an ENTRY convenience, computed to a figure and
never stored as a rule.** This answers the ledger's open *"percentage, fixed, or both"* without
another round trip: **both, at entry; one shape, in the record.** ⚠️ **A discount RULE — a standing
formula — is NOT in this task** (D21 would demand an editor for it; see §7).

**R4 · The client sees it.** CR-39 already rules a comp must be visible to the person receiving it.
**A discount is the same act with a smaller number** — the line shows list, the reduction, and what
they paid. ⚠️ **Flag this one back in the report for his confirmation; build it as ruled.**

**R5 · `revenue_summary` recognises what was COLLECTED.** `payment_status = 'paid'` with
`amount_paid = 0` is **zero revenue**, not list. ⚠️ **`nullif(amount_paid, 0)` goes.** The function
additionally returns `discount_total` and `comp_total` for the same window and the prior window,
**from one read, in the same call** — because a second function computing its own figure is exactly how
`calendar_revenue` and `revenue_summary` came to disagree 9.7×.
⚠️ **`amount_paid IS NULL` is not zero.** Preserve `coalesce(p.amount_paid, p.amount, 0)` for the
null case; only the *explicit zero* changes meaning.

**R6 · An offering-level designation and a line-level fact are DIFFERENT FACTS and both are kept.**
*"This offering is promotional"* ≠ *"this sale was discounted."* ⚠️ **This task builds the LINE fact
only.** If the offering flag is added later it seeds the line's default; it never replaces the record
of what actually happened.

---

## 6. ⚠️ THE TRAPS

- ⚠️ **`DROP FUNCTION` + `CREATE FUNCTION` resets the ACL to the schema default, silently.**
  `revenue_summary`, `comped_credit_value` and `grant_lesson_credit` are all `SECURITY DEFINER`.
  **Restore grants explicitly and prove them from `pg_proc.proacl` before and after.**
- ⚠️ **`CREATE OR REPLACE` with a NEW defaulted parameter OVERLOADS rather than replaces.** Old
  call sites keep resolving to the old body — a fix that appears to do nothing. **Drop the old
  signature explicitly if you widen one.**
- ⚠️ **A trigger declared `UPDATE OF <col>` fires on the columns the STATEMENT NAMES.** If you touch
  the purchases status/payment triggers, prove firing — do not infer it from a correct stored value.
- ⚠️ **`purchases.amount` is not the sum of its lines today.** Establish the relationship before you
  make `amount` mean anything new. **Report what you find; do not silently redefine it.**
- ⚠️ **THE SIGNING FREEZE IS IN FORCE** and **71 EXECUTED documents are evidence.** Nothing here
  touches `documents` or `signatures`.
- ⚠️ **A LIVE LEASE IS IN PRODUCTION** — Pamela Godde, `7adcd08f-fd5d-40f9-b726-634074266d7c`.
  Rehearse anything destructive inside `BEGIN; … ROLLBACK;`.
- ⚠️ **`test:db` is red at baseline and proves nothing.** Verify against production with SQL.
- **Lint baseline is 46**, typecheck 0, typecheck:api 0.

## 7. OUT OF SCOPE — name these in the report, build none of them

**The monthly cost sheet on the horse record** *(CR-86 gap 3 — the owner's simplification, its own
task)* · **the P&L page and any financial-analysis surface** *(CR-88, and it is blocked on his
company-expense categories)* · **any dashboard tile** *(`TASK-FIX6` renders; it does not create the
means of recording)* · **the full line-item editing model** — CR-16/CR-38…CR-42, quantity/void/mark-paid
as one model — ⚠️ **this task adds the two money facts to the line and the point-of-sale control; it
does not build the line editor** · **the offering-level promotional flag** (R6) · **a standing discount
RULE** (R3) · **his backdated data pass** (D30 — after the refactor).

⚠️ **`resources` · `resource_lots` · `consumption_events` · `cost_allocation_rules` · `billable_lines`
are all built and all 0 rows. THE OWNER RULED THE PER-EVENT COST LEDGER OUT on 2026-08-31** — cost is
a monthly sheet typed in at month end. **LEAVE THEM UNDRIVEN (D32) and say so in the report**, so a
later thread does not "finish" them.

## 8. CONSTRAINTS

- **Worktree `~/Downloads/claude-code-repo/wt-books1`, branch `task/books1`, from `origin/main`.**
  ⚠️ **Copy `.env.db` AND `.env` in** — both gitignored, and `npm run build` dies without `.env`.
- ⚠️ **NEVER `~/Desktop`.**
- ⚠️ **Files you do NOT own:** `AppLayout.tsx`, `pageRegistry.ts` *(`TASK-CR85`)*, `OwnerDashboard.tsx`
  and `dashboard/*` *(`TASK-FIX6`)*. **If you need a change there, REPORT THE DIFF; the orchestrator
  applies it.**
- ⚠️ **`revenue_summary` IS YOURS.** `TASK-FIX6` may call it and may not redefine it. If its shape
  changes, **say so in the report in one clearly-marked block** so FIX6 is told, not surprised.
- **Migrations:** `BEGIN; … ROLLBACK;` dry run → apply → verify → commit. Timestamp-named, repo
  convention `YYYYMMDDTHHMM_sentence_case_name.sql`. **No self-contained `COMMIT;`.**
- **COMMIT AS YOU GO. DO NOT PUSH.** **Stage explicit paths; never `git add docs/`.**
- ⚠️ **TEARDOWN: paste a process census at the end** — no vite/vitest/chromium/psql left running.

## 9. THE REACH — required, and it is half the value of this task

**Answer both, in the report, with the file and line:**
1. ⚠️ **What does a person CLICK, from which page, to comp or discount a line — and is that the only
   way?** The incumbent is `GrantCreditDialog` (credits only, reached from the credits page). The
   other point of sale is **`ProvisionClientForm`'s order block** *(the staff first order, reached
   from `LeadWorkDrawer` and `ClientInvitationSection`)*, whose own copy already says *"A comped,
   zero-priced offering counts the same as a paid one"* — **so it already talks about comps it cannot
   record.** ⚠️ **That surface is the one the owner and Claire actually use to sell something, and it
   is where the designation has to appear.**
2. **Where does the owner READ the discounts and comps given in a period?** ⚠️ **Not a new page** —
   the credits page already shows a comped total from `comped_credit_value`. **Say plainly which
   existing surface shows the order-side figure, or state that nothing does yet and that CR-88's
   financial page is where it will land.** **Do not build a page to hold a number.**

## 10. THE TELL — required (D19)

- **Comping or discounting states what it is doing BEFORE it does it**, records **who, why and when**,
  and **can be undone.** `revoke_lesson_credit_grant` is the shape to follow.
- **The staff member sees the loss in dollars at the moment they apply it** — *"Comped — $880 recorded
  as a loss"* is the existing wording and it is good.
- **The client sees what they were given** (R4).

## 11. THE TEST THIS MUST PASS — numbered, provable, pasted

1. **A line records list, charged, disposition and reason.** Paste the row.
2. ⚠️ **A comp of an $880 offering books ZERO revenue and an $880 loss** — paste `revenue_summary`
   and the comp figure for the same window, from ONE call each.
3. ⚠️ **REGRESSION, AND IT IS THE ONE THAT MATTERS: the four existing paid orders total exactly the
   same before and after your change to `revenue_summary`.** Paste both totals. **$1,935.00.**
4. **A 10%-discounted $880 sale collected in full books $792 revenue and an $88 discount.**
5. ⚠️ **`amount_paid IS NULL` still behaves as it did.** Prove it — a rolled-back transaction is fine.
6. **A designation cannot be spelled wrongly** — the CHECK refuses `COMP`, `comped`, `free`.
7. ⚠️ **All five write paths produce a valid disposition** — name each and show what it writes.
   A path that can leave the column NULL is a failure of this criterion.
8. **`comped_credit_value` reads the columns, `config` no longer carries money, and the two cannot
   disagree** — because there is only one of them (R2).
9. ⚠️ **`pg_proc.proacl` for every function you replaced, before and after.**
10. **A comp is undoable, and the undo refuses a spent one.**
11. `typecheck` · `typecheck:api` · **lint ≤ 46** · `npm run build` — paste the numbers.
12. ⚠️ **Renders NOT VERIFIED by you.** End with a numbered checklist the owner runs in a browser.

## 12. WHERE THE REPORT GOES

`docs/reports/TASK-BOOKS1-REPORT.md`. ⚠️ **Its most valuable section is "flagged, not fixed."**
**Never report a green function call as a shipped feature** — prove the reach.
