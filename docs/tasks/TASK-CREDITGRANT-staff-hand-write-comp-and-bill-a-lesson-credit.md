# TASK-CREDITGRANT — staff hand-write, comp, or bill a lesson credit

**The named follow-up from `TASK-AUTHORITY` §4.8**, which deliberately did NOT build this:
*"If the owner wants ad-hoc comp grants as a real feature, that is a future `grant_credit` RPC
with mandatory reason, period, expiry, and audit — named here as the follow-up per D13, not
built in this task."* `TASK-AUTHORITY` deleted the old raw-write `createLessonCredit()` /
`consumeLessonCredit()` and made `LessonCreditsPage` read-only. This task is what replaces the
"Grant credits" button that was removed — not a return to it.

Serves: D18 (never a second write path beside a correct engine), D19 (a value-moving action
states itself, records itself, and can be undone), D13 (owner-operable without a developer).

---

## 1. The owner's words

> "Staff should be able to hand write a lesson credit whenever they want; they should be able to
> comp a lesson credit and generate a loss, and they should be able to generate a balance owed
> and request payment."

Three distinct capabilities, not one button with a checkbox:

1. **Hand-write** — create a lesson credit for a client on staff's own authority, no purchase
   flow required.
2. **Comp** — give a lesson credit away for free, and the app must **record it as a loss**, not
   silently mint a free credit with no financial trace.
3. **Bill** — create a credit before payment is collected, and be able to **request payment**
   for the resulting balance.

## 2. Read this first — the engine these must NOT bypass

`_mint_credits_for_purchase_item` (fires from `purchase_items`), `_refund_booking_credit`,
`complete_lesson_session`, `credits_roster` are the correct, DB18-compliant credit engine.
**Verify their current live bodies before designing anything** — this repo's schema moves fast
and TASK-AUTHORITY itself landed hours before this spec was written.

**The strong default, subject to what you find when you read the live schema:** all three modes
should be a **staff-initiated `purchases` + `purchase_items` row**, differing only in price and
payment state, so credits mint through the existing trigger exactly like a real checkout —
**not** a bespoke `grant_credit()` function that writes `lesson_credits` directly. That would be
a second write path beside the engine TASK-AUTHORITY just finished consolidating onto (D18).
If the live schema makes this genuinely impractical, say so in the report with the reason —
do not silently build the bespoke path instead.

Sketch, to be verified/corrected against the real schema, not assumed:

- **Hand-write, paid in full** — a normal staff-recorded sale: `purchases` row, real
  `price_amount`, payment marked confirmed (staff is attesting cash/Zelle already received, or
  it's genuinely free-standing goodwill accounted at zero — see mode 2). This is close to
  "manually record an order," which may already partially exist somewhere in the staff order
  tools — check before building a new form.
- **Comp** — `price_amount = 0` (or however the schema distinguishes "waived"), but the
  offering's **normal list price at time of comp** must be captured on the row (a column, or
  read from `offerings` at write time and stored — don't rely on it being derivable later if the
  offering's price changes). This is what makes "generate a loss" computable: comps must be
  reportable as a dollar figure (sum of list price across comped rows in a period), not just an
  invisible zero-revenue credit. Surface this as a query/RPC even if no dashboard zone exists yet
  to show it (name it as the reach point for whichever dashboard revenue zone reads it later —
  do not silently produce a number nobody can see, per D17).
- **Bill (balance owed)** — a `purchases` row in whatever payment-pending state a normal unpaid
  order uses. Check whether credits mint immediately on `purchase_items` insert regardless of
  payment state (D23's "declaring payment unblocks everything" was about the *client's own*
  declaration unblocking *their own* booking — this is staff creating a debt on the client's
  behalf before any payment exists at all, which may be a different case; verify against the
  live trigger rather than assuming D23 transfers directly). **"Request payment"** is a distinct,
  explicit staff action — reuse whatever the app already has for nudging a client about an
  unpaid balance (the `notifications-nudge` cron, a payment-reminder email, the order page's own
  "declare payment" surface) rather than inventing a second notification path. If nothing usable
  already exists, build the smallest thing that sends one message, and name a real follow-up for
  anything more elaborate (recurring reminders, etc.) rather than over-building here.

## 3. D19 compliance — non-negotiable for all three modes

Every grant, regardless of mode, must:

1. **State what it will do before it does it** — a confirmation step naming the client, the
   quantity, the mode (hand-write / comp / bill), and for comp/bill, the dollar figure involved.
2. **Capture a mandatory reason** — free text, required, not optional. No reason, no grant.
3. **Record what it was for** — which offering/service the credit represents (not a bare
   unlabeled credit — TASK-AUTHORITY's voided orphan was exactly this failure mode).
4. **Be reversible** — an undo path. If it routes through `purchases`, this may already follow
   from however a normal order/purchase can be voided or refunded today — verify, don't assume.

`audit_logs` now covers both `bookings` and `lesson_credits` (TASK-AUTHORITY, migration
`authority_5`) — confirm each mode's write actually produces a legible row (not just an
UPDATE with an opaque jsonb diff staff can't read without SQL).

## 4. The UI — D13

Staff need a real form, reachable from `LessonCreditsPage` (which TASK-AUTHORITY made
read-only and pointed at Sessions for consumption — this is the other half: **origination**,
not consumption). Fields: client, offering/service, quantity, mode (three clearly labeled
options, not a checkbox soup), reason (required), and for bill mode, whatever "request payment"
needs. The page must make it obvious afterward which credits came from which mode — a comped
credit and a billed-but-unpaid credit should not look identical to a normally-purchased one in
the ledger view.

## 5. Out of scope — name, do not build

- Recurring/automated payment reminders beyond a single "request payment" send.
- A dedicated "comps this month" dashboard tile — build the underlying queryable figure (§2),
  name the dashboard surface as follow-up (connects to `TASK-DASHBOARDBUILD`'s B1 revenue zone
  and its later phases).
- Any change to the checkout/purchase flow for real clients — this is a staff-side origination
  tool only.

## 6. Constraints

- Worktree `~/Downloads/claude-code-repo/wt-creditgrant`, branch `task/creditgrant`.
- Migration discipline: dry-run in `BEGIN; … ROLLBACK;` against prod, apply, verify with a
  query, commit.
- Check `git log --oneline -15` for live threads touching `LessonCreditsPage.tsx`,
  `api-lessons.ts`, or the purchases/fulfillment spine before starting.
- Do not push. Report and stop.

## 7. THE TEST

1. Hand-write a credit as a real staff action (not raw SQL) → client's ledger shows it, reason
   visible, `audit_logs` row exists.
2. Comp a credit → same, plus a query proving the list-price-at-comp figure is retrievable and
   sums correctly across multiple comps.
3. Bill a credit → a payment-pending balance exists in whatever the app's normal unpaid-order
   shape is; "request payment" fires and is provably delivered (reuse existing delivery-logging,
   don't invent a new unproven send path).
4. Every grant has a working undo, proven by using it.
5. `grep` confirms no new raw INSERT/UPDATE onto `lesson_credits` exists outside the engine this
   task extends.
6. `npm run typecheck` / `npm run typecheck:api` / `npm run lint` → 0 errors.

## 8. THE REACH

Where staff click to start each of the three modes, from which page, and where the resulting
credit/balance is visible afterward.

## 9. Report

`docs/reports/TASK-CREDITGRANT-REPORT.md`, with flagged-not-fixed for anything genuinely
deferred (per §5) named plainly, not silently dropped.
