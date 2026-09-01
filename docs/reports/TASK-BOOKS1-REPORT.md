# TASK-BOOKS1 — REPORT

**Branch `task/books1` (worktree `wt-books1`), rebased on `origin/main` @ `5f1a0446` at finish. 3 commits. DB migration APPLIED to production and verified.**

## 1. Headline

The disposition is live on the payment spine: an order settles as `paid`, `discounted` or `comped` through the ONE `mark_purchase_paid`, keeping the full price on the order and the line, storing the write-down + required reason, undoable, exported. `revenue_summary`'s `nullif(amount_paid, 0)` is gone — the first comp books $0, not $880 — and the four existing paid orders total exactly **$1,935.00** before and after.

## 2. THE TEST — criterion by criterion (all run against production; write tests inside `BEGIN…ROLLBACK`)

**1 · Comp keeps full price on order AND line, $0 owed** ✅
```
C1-order-row | PUR-000339 | amount 880 | amount_paid 0 | paid | comped | write_down 880 | "Goodwill — first month on us" | method comp
C1-line-row  | 2x Weekly Lessons | price_amount 880 | list_price_amount 880
```

**2 · That order books ZERO revenue and an $880 write-down, one `revenue_summary` call** ✅
```
C2: {"count": 5, "total": 1935.00, "write_down_count": 1, "write_down_total": 880, ...}
```
(count went 4→5 with the comp inside the window; total UNMOVED at 1935.00 — under the old `nullif` this comp would have booked +$880 revenue and no loss, the §3 double error.)

**3 · The regression that matters** ✅ — `revenue_summary('2026-01-01','2027-01-01')`:
```
BEFORE migration: {"count": 4, "total": 1935.00}
AFTER  migration: {"count": 4, "total": 1935.00, "write_down_count": 0, "write_down_total": 0}
```

**4 · $880 settled at $792** ✅
```
C4-order-row   | amount 880 | amount_paid 792 | paid | discounted | write_down 88 | "10% loyalty discount"
C4-payment-row | zelle | 792.00 | paid          ← the money is an ordinary payments-ledger record
C4-summary     | total 2727.00 | write_down_total 968
```

**5 · A short payment that is NOT a discount stays a balance owed** ✅
```
C5-part-result | part_paid
C5-order-row   | amount 200 | amount_paid 50 | payment_status unpaid | status awaiting_payment | disposition paid | write_down 0
```
Distinguishable by construction: a part payment leaves the order OPEN, `disposition='paid'`, `write_down=0`; a discount CLOSES it with the shortfall stored.

**6 · `amount_paid IS NULL` behaves exactly as it did** ✅ — the column is `NOT NULL` (0 NULL rows in prod), and the expression change is inert for NULL:
```
(amount_paid, amount) | old coalesce(nullif(ap,0),a,0) | new coalesce(ap,a,0)
(NULL, 500)           | 500                            | 500     ← unchanged
(0,    500)           | 500                            | 0       ← THE deliberate change (R5)
(500,  500)           | 500                            | 500
```

**7 · The CHECK refuses `COMP`, `comped `, `free`** ✅ — three UPDATEs, three
`violates check constraint "purchases_payment_disposition_check"` errors, pasted in the battery. The function door additionally refuses a missing reason: `a comped order needs a reason — what was this given for?`

**8 · Every call site resolves to the NEW body; old signature gone** ✅
```
C8-signatures | count 1 | {p_purchase_id, p_amount, p_reference, p_method, p_paid_at, p_disposition, p_write_down_reason}
```
Call sites, each proven or shown resolvable:
- `confirm_payment_claim` (in-DB, positional 4-arg) — **executed live**: settled a pending cash claim through the new body, `settlement: paid`, claim `confirmed`.
- `apply_booking_fee` (in-DB, positional 4-arg `(id, 0, reason, 'waived')`) — **its exact call shape executed**: a $0-total order now settles `paid`/write_down 0. ⚠️ Under the old body this RAISED (`amount must be > 0`) — the waived-fee path had been broken since the payments ledger landed; the new zero-total branch repairs it (see §5).
- `api/orders-mark-paid.ts:109` — named args, now also passes `p_disposition`/`p_write_down_reason`.
- `api/_lib/reconcile.ts:141` — named 3-arg, resolves via defaults.
- `grant_lesson_credit` — mentions the function only in a comment; no call.

**9 · Status events fire on settlement — probed** ✅
```
comp:     submitted → paid → write_down(detail)
discount: submitted → paid → write_down(detail)
part:     submitted → partial_payment(detail)
```
The settle UPDATEs name `status, payment_status` in their target list, so `status_purchases` (`UPDATE OF`) fires — proven by rows, not inferred.

**10 · `pg_proc.proacl` before/after** ✅
```
BEFORE mark_purchase_paid: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
AFTER  mark_purchase_paid: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
AFTER  revenue_summary:    unchanged (CREATE OR REPLACE, same signature — never dropped)
AFTER  revenue_period_lines / revert_purchase_writedown: {postgres,authenticated,service_role}
```
⚠️ Trap found while proving this: the database's **default privileges grant EXECUTE to `anon` on every freshly created function**. The migration revokes `anon` explicitly on all three new/recreated functions; without that, `mark_purchase_paid` would have silently GAINED an anon grant the old signature never had.

**11 · The export reconciles to criteria 2 and 4** ✅ — `revenue_period_lines` (same window):
```
PUR-000316..333 | paid       | collected = full_price | write_down 0
PUR-000339      | comped     | 880 / 0   / 880 | Goodwill — first month on us
PUR-000340      | discounted | 880 / 792 / 88  | 10% loyalty discount
sums: collected 2727.00, written_down 968   ← identical to the summary, BY CONSTRUCTION:
```
`revenue_summary` now aggregates `revenue_period_lines` — one period read feeds the ribbon, the figures and the CSV. Columns: order · date · client · full price · collected · write-down · disposition · reason; cost/profit columns slot into this same read when the cost sheet lands (R6).

**12 · Undo works; refuses spent credits** ✅
```
C12-undo:  {"reverted": true, "was": "discounted", "write_down_was": 88, "now_owing": 88.00, "payment_status": "pending"}
after:     disposition paid | write_down 0 | reason NULL | awaiting_payment | paid_at cleared | amount_paid 792 (the money STAYS recorded)
spent:     ERROR: credits from this order have already been used — the write-down cannot be undone
```

**13 · The numbers** ✅ — `typecheck` **0** · `typecheck:api` **0** · lint **0 errors / 46 warnings (= baseline)** · `npm run build` **passes** (prerender + sitemap written). Plus a new unit test `test/receipt_writedown.test.ts` — 3/3 pass — pinning the receipt's three shapes (paid/comped/discounted) against the real template parser with the exact published body.

**14 · Owner's render checklist** — §8 below.

## 3. THE REACH

1. **What does a person CLICK?** `/app/ops/payments/review` → **Orders** bucket → outstanding row → **“Discount / comp”** ([PaymentReviewPage.tsx:405-424](src/pages/app/ops/PaymentReviewPage.tsx#L405-L424) renders [WritedownPanel](src/pages/app/ops/PaymentReviewPage.tsx#L106)). One panel on the spectrum: the amount collected decides — enter **$0 = comp**, more = discount; reason required; the panel STATES the write-down in dollars before the button, and the button itself carries the amount (“Comp — write down $880.00”). The undo lives on the same page, **Recently paid** → “Undo write-down” → arm → confirm ([PaymentReviewPage.tsx:465-486](src/pages/app/ops/PaymentReviewPage.tsx#L465-L486)). Is it the only way? For a human, yes today — `ContactDossierModal`'s Orders tab has no settle control in `origin/main` yet (BACKDATE adds one; see §6). `/api/orders-mark-paid` accepts the disposition for both surfaces.
2. **Where does the owner READ and EXPORT?** The same Orders bucket now opens with a **period bar** ([PeriodFigures](src/pages/app/ops/PaymentReviewPage.tsx#L177)): month picker → *Collected $X (N orders) · Written down $Y (N discounts/comps)* from the same `revenue_summary` call the dashboard ribbon uses, and a **Download CSV** button → `revenue_period_lines` → `revenue_YYYY-MM.csv`. No new page was built to hold a number; the export is one click from the existing payments surface.
3. **`ProvisionClientForm`'s stale comp copy** reconciled ([ProvisionClientForm.tsx:624](src/components/app/ProvisionClientForm.tsx#L624)): now says *build the order at full price and settle it from Payment review — the paperwork is the same either way.*

## 4. THE TELL (D19)

States the dollars before acting (panel preview + button label) · records who (`status_events.actor_user_id` via the settle triggers + `write_down` event), why (required reason, stored on the row AND in the event detail), when (`paid_at`) · undoable (`revert_purchase_writedown`, refuses spent credits; the undo control itself arms before it acts) · the customer's copy shows full price · reduction · $0 owed on the receipt email, `/app/orders`, and `/order/:id`.

## 5. Decisions the spec did not make (deciding silently is the failure)

- **A pending client claim blocks a write-down** (400 with instruction). `confirm_payment_claim` settles IN FULL by design; a write-down beneath a pending claim would orphan it forever. Staff confirm or decline the claim first.
- **Comped ⇒ nothing was ever collected** (`settled = 0` enforced); money already part-paid forces `discounted`. Keeps the three states honest and criterion 5 provable.
- **The zero-total settle repair**: `apply_booking_fee`'s waiver calls `mark_purchase_paid(id, 0, …)` and has RAISED since the payments ledger landed (found while widening the same guard). A zero-total order now settles without a payment record. Same seam, one branch — repaired rather than left broken beside my change.
- **Undo does not claw back credits.** Credits mint when an order leaves draft (D23 — declaration unblocks), not at payment; undo reopens the order into exactly the declared-unpaid state, credits intact, delivery still staff-gated. Spent credits refuse the undo (criterion 12).
- **No % input** (R3 said convenience only, never stored): the panel takes the collected dollars; the record is always two amounts + reason. A % shortcut is a candidate nicety, not a gap.
- **`list_price_amount` capture is ONE `BEFORE INSERT` trigger** (`purchase_items_capture_list_price`), not five function edits — every creation path prices lines from the catalogue at insert, so `price_amount` at insert IS the list price; a future path inserting a pre-reduced price passes `list_price_amount` explicitly. Existing 14 lines backfilled (amount = line-sum held on all 17 purchases — the trap-4 relationship, measured and clean).
- **One RPC wrapper rule kept**: the summary wrapper stays `fetchRevenue` (api-calendar.ts) — its `CalendarRevenue` type gained the four write-down keys as OPTIONAL so `OwnerDashboard`'s `as RevenueWindow` cast (FIX6's file, not mine) keeps compiling untouched.
- **Receipt still sends on a comp/discount** — it IS the customer's copy (R4). A part payment still sends nothing. BACKDATE's no-receipt-on-backdate rule is untouched (their code half is unmerged; nothing here reads `paidAt`).

## 6. ⚠️ FOR ORCH / FIX6 / BACKDATE — shape changes, one block

- **`revenue_summary` (FIX6 reads it): ADDITIVE ONLY.** All existing keys keep their exact meaning; new keys `write_down_total`, `write_down_count`, `prior_write_down_total`, `prior_write_down_count`. `total` now counts an explicit `amount_paid = 0` as zero (it always should have; no live row changes value).
- **`mark_purchase_paid` is now 7-arg** (old 5-arg DROPPED): `+ p_disposition text DEFAULT 'paid', p_write_down_reason text DEFAULT NULL`. `p_paid_at` SURVIVES (BACKDATE rule 2). All callers proven in §2.8.
- **BACKDATE (concurrency rule 3):** their `ContactDossierModal` Orders-tab mark-paid control is unmerged, so I could not put the disposition there. The plumbing is ready: `markOrderPaid(id, method, ref?, amount?, disposition?, writeDownReason?)` and the API accept it, and `WritedownPanel` (PaymentReviewPage) is module-scope and liftable. **The dossier control must grow the discount/comp option when it lands, or the reach defect this unit fixes reappears one door over.**

## 7. Flagged, not fixed / out of scope (named, built none)

- `grant_lesson_credit` **retirement is NOT in this branch — by the spec's own R7 ruling**: it lands with CR-94 pass 2, once settling is reachable from the client record. Until then `GrantCreditDialog`/`LessonCreditsPage` still expose the superseded comp mode (0 uses ever). **Do not read it as forgotten.**
- Monthly cost sheet (CR-86 gap 3) · P&L page (CR-88) · expense categories (CR-91, via `lookup_options`) · campaign ROI (CR-88) · dashboard tiles (FIX6) · line-item editing (CR-16/38…42) · month-end invoicing cadence (CR-90) · the owner's historical discount backfill (his data pass — `p_paid_at` + the disposition give it somewhere to land).
- `resources` / `resource_lots` / `consumption_events` / `cost_allocation_rules` / `billable_lines`: built, 0 rows, owner ruled the per-event cost ledger OUT — left undriven (D32).
- Pre-existing: `grant_lesson_credit` and `comped_credit_value` carry `anon` EXECUTE grants (one line; SECFIX class).
- `comped_credit_value` still reads the retired `config->>'grant_mode'` model (0 rows); it goes quiet with the R7 retirement.

## 8. Owner's render checklist (not verified by me — no worktree has a staff login; include your phone)

1. `/app/ops/payments/review` → **Orders**: the period bar shows the month's *Collected* and *Written down*; **Download CSV** hands you `revenue_YYYY-MM.csv` and its rows match the two figures.
2. An outstanding order → **Discount / comp** → leave $0 → the panel says *“Comps this order — $X is written down… client owes $0”* and refuses until a reason is typed.
3. Comp it → *Recently paid* shows **Full price / Collected $0.00 / Comped — $X written down** (reason on hover) → **Undo write-down** arms, states the reopened balance, undoes.
4. **The customer half only you can confirm** (log in as a test identity, and check the phone): the receipt email reads *“Your order total was $880.00. Complimentary — $880.00 was taken off. Nothing further is owed: your balance on this order is $0.00.”*; `/app/orders` shows Total, the −$ reduction line, **Amount owed $0.00**; `/order/:id` shows the same three figures above the confirmation.
5. Discount path: settle an $880 order at $792 → receipt shows Discount −$88.00 and the $792 payment; Payment review shows *Discounted — $88.00 written down*.
6. Part payment still reads as a balance owed (unchanged), and a claim-pending order still says *confirm the claim first* if you try to discount it.
7. Provision form's offerings blurb now points comps at Payment review.

## 9. Where the spec was wrong (small, stated plainly)

- “`markOrderPaid` has exactly ONE call site” — still true at merge time, but the spec's premise that BACKDATE's `p_paid_at` pass-through would be **merged first** did not hold: BACKDATE's DB half is applied to prod (the 7-arg body I replaced already carried `p_paid_at` from it), its TS half is still unmerged. Rebased twice as instructed; no conflict materialized.
- The five order-writing paths “owe this task the LIST PRICE on the line” — literally true, but satisfiable at one seam (the insert trigger) rather than five edits; the spec did not forbid that and D18 favors it.

## 10. TEARDOWN census

- No servers, browsers or background processes started; the only build commands were `tsc`/`eslint`/`vite build`/`vitest run`, all exited.
- Worktree `wt-books1` retained (it is the deliverable branch). No scratch worktrees created.
- Production DB: migration `20260901T1000_what_a_sale_was_worth.sql` applied + committed; every behavioral test ran inside `BEGIN…ROLLBACK` — **zero test rows persisted** (paid orders count still 4, total still $1,935.00, re-verified after all batteries).
- `ps` census at close: no `node`/`vite`/`psql` processes owned by this session remain.

---

## 11. ADDENDUM — rebased onto merged TASK-BACKDATE (2026-09-01, post-D35)

**Rebased on `origin/main` @ `9ea8f59b` (BACKDATE, CR85, MODAL2, reaper all merged). Three files conflicted — `api/orders-mark-paid.ts`, `src/lib/ops/api-payments.ts`, `PaymentReviewPage.tsx` — all resolved by UNION: `paidAt` and `disposition` both survive, and they compose.**

- **The union, concretely:** `markOrderPaid(purchaseId, method, reference?, amount?, paidAt?, disposition?, writeDownReason?)` — `paidAt` keeps BACKDATE's published position 5 so `ContactDossierModal`'s merged call sites are untouched. The endpoint validates and forwards both; `mark_purchase_paid` receives `p_paid_at` + `p_disposition` + `p_write_down_reason` in one call. PaymentReviewPage's table-level "Date paid" control now applies to a discount/comp too — a backfilled give-away lands in the month it really happened, and BACKDATE's no-receipt-on-backdate rule governs it unchanged (the receipt suppression sits above the disposition in the endpoint).
- **Production body re-verified AFTER the rebase (D35: a green check from an hour ago is not evidence).** The live `mark_purchase_paid` is ORCH/BACKDATE's reconciled union — my two disposition branches intact, BACKDATE's future-date guard at the top (covering every disposition), and their backdate-aware notify/status-event patched inside each branch. Nothing of mine was lost in their in-place patch; nothing of theirs is lost in my branch.
- **§4 re-run against production** (rolled-back battery): comp → `880 / 0 / comped / 880` ✅ · discount at 792 **backdated to 2026-06-15** → `paid_at 2026-06-15`, June's `revenue_summary` books `total 792, write_down_total 88` ✅ (the composition case, proven) · part payment still `part_paid`/open ✅.
- **Future-date guard proven on ALL THREE dispositions**: `2027-01-15` refused with `a payment cannot be dated in the future (2027-01-15)` for paid, comped and discounted alike.
- **Regression re-run:** post-rollback production still `4 paid orders / $1,935.00`.
- **Numbers after rebase:** typecheck 0 · typecheck:api 0 · lint 46 warnings = baseline · build passes · vitest 10/10 — my 3 receipt-shape tests AND BACKDATE's 7 `orders-mark-paid-backdate` API tests pass against the union endpoint.
- **On my own migration file:** left exactly as applied. Replay order is already correct — `20260901T1000` (mine, creates the 7-arg body) precedes `20260901T1200` (BACKDATE's idempotent in-place patch, which adds the guard and no-ops if already patched) — so a fresh replay produces the union without edits.
- **§6's BACKDATE note is now RESOLVED**: the dossier Orders-tab control settles through the union `markOrderPaid`; giving that control a discount/comp affordance remains the one open reach item (one additive edit in `ContactDossierModal`, no longer contested by any running thread).
