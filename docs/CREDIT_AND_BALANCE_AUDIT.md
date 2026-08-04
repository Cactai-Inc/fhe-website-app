# Credits, money owed, and order revision — live audit

**Audited** 2026-08-04 against the live database and repo. Read-only; nothing
changed. Purpose: establish whether order revision (swap an order line, credit
the difference or bill it) is the wiring job it appears to be.

**Headline: the credit system works, and it is sessions-only. There is no
monetary credit, no account balance, and nothing that applies money to an amount
owed. Order revision is a BUILD, not a wiring task.**

## 1. What works today

- **Session credits are real and correct.** `lesson_credits` and `service_credits`
  are granted on payment and debited by `book_open_slot`. Verified live: a paid
  purchase granted 1 credit; booking took it to 0.
- **Payment marking is unified.** `mark_purchase_paid` sets `status='paid'`,
  `amount_paid`, `paid_at` on every route (Zelle, Stripe webhook, staff). The
  `'confirmed'` divergence was retired 2026-08-02.
- **Partial payment is representable.** `purchases.amount` vs `amount_paid` — the
  outstanding figure is computable per purchase, and `business_kpis` already sums
  `greatest(amount - amount_paid, 0)` as `outstanding`.

## 2. The gaps

### 2.1 Credits are integer counts — there is no money credit
Both credit tables store `credits_total` / `credits_remaining` as **integers**.
There is no monetary column anywhere in either. A credit is "one session", not
"$150". Consequences:

- A refund-to-account or goodwill credit **cannot be represented**.
- Swapping a $150 lesson for a $120 own-horse lesson **cannot leave $30 on
  account** — there is nowhere to put it.
- A credit cannot be applied to a *different* service's price; it can only be
  spent as a session of its own kind (offering-tagged, or untagged and generic).

### 2.2 There is no account balance
No table, view or function computes a per-client balance. `payer_candidates`
("account holders a balance may be transferred to") implies one but no balance
exists to transfer — the function returns payer candidates for barnops cost
allocation, not an account ledger.

### 2.3 Money owed has a primitive, unused
`billable_lines` is the right shape for an amount owed (payer, source, qty, unit
amount, amount, status, period) and has **zero rows**. Its only writer is
`resolve_consumption_billing`, which is barnops consumption billing behind
`mod.barnops` — a different concern from lesson/order revision. Nothing writes a
billable line from a purchase change.

### 2.4 Nothing revises an order
No function modifies a paid purchase's lines. There is no "swap this line",
no reconciliation of the price difference in either direction, and no
credit-note or amount-owed record that would result.

## 3. What order revision actually requires

In dependency order:

1. **Decide the money model.** Either (a) extend credits with a monetary balance,
   or (b) use `billable_lines` for amounts owed and add a credit-balance
   counterpart. (b) reuses an existing primitive and keeps sessions and money
   separate, which matches how the rest of the system already thinks.
2. **A per-client balance** — a queryable net of credits issued vs amounts owed.
3. **Order revision** — swap a purchase line, price the difference, and write
   either a credit or a billable line. Must be idempotent and auditable; it
   mutates paid records.
4. **Application at payment** — let a balance offset a new purchase or an
   outstanding amount, which is where "the $ can be applied to a balance owed"
   becomes true.
5. **Surfaces** — the client sees their balance; staff see and can adjust it.

## 4. The own-horse lesson case (the trigger for this audit)

A rider books a lesson using the barn's horse but intends to ride their own, or
books an own-horse lesson and cannot supply one. Today:

- **Detected:** yes. Buying an own-horse offering derives HORSE_OWNER and attaches
  the horse-owner documents (built 2026-08-04), so someone who cannot complete
  that paperwork surfaces before the lesson — the early-catch the owner described.
- **Corrected:** manually. Staff adjust the order and settle the difference outside
  the system, because items 1–4 above do not exist.

That split is safe and is the current recommendation until the money model is
decided: **detection is automatic, correction is a staff action.**
