# TASK-BACKDATE — an order can carry its real date, and be settled from where the work happens

**Authored 2026-09-01 by ORCH6.** ⚠️ **Read `docs/method/TASK-ROLE.md` first — the standing
requirements are there and are NOT repeated here.** This file carries only what is specific.

**Builds `CR-94` passes 5 and 2, together, because they are the same two entry points.**
⚠️ **It is the PREREQUISITE of the rest of the unit** — `TASK-BOOKS1` defines revenue *at `paid_at`*
and the rolling schedule measures *from the order*, and neither field can be set correctly today.

---

## 1. WHY THIS IS FIRST — the owner's purpose, and the thing that defeats it

> *"all of our clients are largely not in the system fully, their orders, payments, revenue, and
> scheduled bookings need to be backfilled and we need the surfaces to function properly to be able to
> do this."* — owner, 2026-08-31

⚠️ **ATTEMPTED TODAY, THE BACKFILL DOES NOT FAIL. IT SUCCEEDS AND LIES.** Every order and payment is
stamped with the day it was typed, a year of trading collapses into one date, every prior month reads
zero — **and the dashboard ribbon, the calendar money line and CR-86's P&L all report it
confidently.** *(`DISO-1-HANDOFF.md` §2.)*

## 2. WHAT IS TRUE NOW — measured 2026-09-01, by DISO-1 and re-checked by ORCH6

| The act | Carries a real date? | Evidence |
|---|---|---|
| **create the order** | ⚠️ **NO** | `attach_offerings_to_client(p_contact_id, p_offering_ids, p_mark_paid, p_payment_method, p_notes, p_partial_amount, p_org_id)` — **no date parameter exists** |
| **record the payment** | ⚠️ **NO** | `mark_purchase_paid` **HAS `p_paid_at`**; `api/orders-mark-paid.ts:109-114` passes four arguments and **not that one**. `markOrderPaid()` has no date parameter to pass. ⚠️ **Half the fix is a parameter nobody passes** |
| **the revenue figure** | — | `revenue_summary` recognises at `paid_at`, so the above decides the books |
| **the booking** | ✅ **YES** | `<input type="datetime-local">`; production holds bookings back to 2026-07-20 |

### ⚠️ AND THE DOOR — why "mark paid" works once and never again
| | |
|---|---|
| **at provisioning** | ✅ works — **`p_mark_paid` is an ARGUMENT OF CREATING THE ORDER.** Settlement is baked into the creation form |
| **afterwards** | ⚠️ **`markOrderPaid()` has exactly ONE call site — `PaymentReviewPage.tsx:153`** |
| **the staff client record** | ⚠️ **`ContactDossierModal`'s Orders tab CANNOT settle an order.** *(⚠️ `CR-94`'s own table blamed `OrdersContent.tsx` — that is the MEMBER's own My Orders. A thread sent there would have fixed the wrong screen.)* |
| ⚠️ **a `draft` order** | ⚠️ **INVISIBLE EVERYWHERE.** `listOutstandingOrders` filters `status IN ('awaiting_payment','sent')`. **Production: 12 `awaiting_payment/unpaid` *(reachable)*, 4 `paid`, and 1 `draft/unpaid` that NO surface can settle** |

🔒 **So it is not a permission problem** — `mark_purchase_paid` allows `has_staff_access()`, the route
is `requireStaff`, and the nav row exists. **It is a reach problem, plus one status the list forgets.**

## 3. 🔒 WHAT TO BUILD

**R1 · A date on order creation.** `attach_offerings_to_client` takes an occurred-on/created-on date.
⚠️ **Adding a defaulted parameter OVERLOADS rather than replaces — drop the old signature explicitly
and prove every call site moved.**

**R2 · A date on settlement.** `api/orders-mark-paid.ts` passes `p_paid_at` through;
`markOrderPaid()` accepts it. ⚠️ **The RPC already takes it — do not rebuild the spine** (D18).
**Omitted stays `now()`** — today's behaviour is unchanged for a same-day payment.

**R3 · Settle from the staff client record.** A mark-paid control on **`ContactDossierModal`'s Orders
tab**, calling the SAME `markOrderPaid` seam. ⚠️ **No second write path** — if it does not call that
endpoint, it does not ship.

**R4 · A `draft` order must be settleable.** Either the outstanding list includes `draft`, or a draft
is promoted on settlement. ⚠️ **State which you chose and why** — there is 1 such row in production
and it is invisible today.

**R5 · ⚠️ A BACKDATED SETTLEMENT SENDS NO EMAIL.** `/api/orders-mark-paid` calls `sendOrderReceipt`
whenever the status lands `paid`. ⚠️ **Backfilling a year would email a receipt for every historical
payment — to real clients, for money received months ago.** **A settlement carrying a past date sends
nothing, and says on screen that it sent nothing.** *(A same-day settlement still sends its receipt.)*

**R6 · The date is shown, not silent (D19).** The order displays the date it is being recorded
against **before** the act, and the record shows it afterwards.

## 4. ⚠️ SPECIFIC TRAPS
- ⚠️ **`status_purchases` is declared `UPDATE OF status, payment_status`.** Settlement writes both, so
  it fires today. ⚠️ **If you write `paid_at` in a separate statement, the event does not fire for
  it** — prove firing, do not infer it from a correct row.
- ⚠️ **`revenue_summary` reads `paid_at` in a WINDOW.** A backdated payment moves money into a CLOSED
  month. **That is correct and intended — say so explicitly in the report**, because it will look like
  a regression to whoever next compares two dashboard readings.
- ⚠️ **Do NOT touch `revenue_summary` itself. `TASK-BOOKS1` owns it.**
- ⚠️ **A future date is not a backfill.** Refuse one, server-side.
- **`p_paid_at` was added by `TASK-ORIGIN` §4.3 for exactly this reason** — *"a backfilled purchase
  entered today with today's timestamp is worse than no record."* **The judgement is already made; you
  are connecting it.**

## 5. OUT OF SCOPE
The disposition/discount/comp model *(`TASK-BOOKS1`)* · the rolling 30-day schedule and month-end
invoicing *(`CR-90`)* · the calendar triage items *(pass 6)* · ⚠️ **the owner's actual data entry** —
this task makes it possible, it does not do it (D30) · `grant_lesson_credit`'s retirement *(it goes
once this ships — say in your report whether R3 makes it fully redundant)*.

## 6. FILES YOU OWN
`attach_offerings_to_client` and its callers · `api/orders-mark-paid.ts` · `src/lib/ops/api-payments.ts`
· `ContactDossierModal.tsx`'s Orders tab · `PaymentReviewPage.tsx`.
⚠️ **NOT yours:** `revenue_summary` *(BOOKS1)* · `ops/kit/Modal.tsx` *(MODAL2)* · `AppLayout.tsx` /
`pageRegistry.ts` *(CR85)*. **Report the diff; ORCH applies it.**

## 7. THE REACH
**Answer with file and line: what does a staff member click, from which page, to settle an order for a
client whose record they are looking at — and is that the only way?** ⚠️ **"It is on Payment review"
is the answer that produced this task.**

## 8. THE TEST THIS MUST PASS
1. **An order created with a past date carries it.** Paste the row.
2. **A payment settled with a past date lands on `paid_at`.** Paste it.
3. ⚠️ **`revenue_summary` for THAT PAST MONTH now returns it** — and the current month is unchanged.
   Paste both windows.
4. ⚠️ **No email left the system for the backdated settlement.** Prove it from `receipt_sends`.
5. **A same-day settlement still sends its receipt.** Prove it.
6. **A future date is refused, server-side.**
7. ⚠️ **The staff client record settles an order**, through the same endpoint. **Paste the call chain.**
8. **The one `draft/unpaid` order in production can now be settled** — rehearsed in
   `BEGIN; … ROLLBACK;`.
9. ⚠️ **Every `attach_offerings_to_client` call site resolves to the NEW signature; the old one is
   gone.** Name them.
10. ⚠️ **The status events still fire on settlement** — probe it.
11. `pg_proc.proacl` before and after for every function replaced.
12. `typecheck` · `typecheck:api` · **lint ≤ 46** · `build`.
13. ⚠️ **Renders NOT VERIFIED by you** — the owner's checklist, naming the phone.

## 9. WHERE THE REPORT GOES
`docs/reports/TASK-BACKDATE-REPORT.md`. ⚠️ **ORCH appends its `## VALIDATION` block to it.**
