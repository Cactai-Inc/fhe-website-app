# TASK CASHCONFIRM — report

**Task:** `docs/tasks/TASK-CASHCONFIRM-cash-is-confirmed-like-zelle.md`
**Branch:** `task/cashconfirm` (worktree off `origin/main` at `cfd77d6`).
**Status:** DONE — committed on the branch, not pushed (per the task: "the orchestrator
merges"). Typecheck (app + api) and lint are both clean on the changed files. Every DB claim
below is query output from a live run against production Postgres, wrapped in
`BEGIN … ROLLBACK` — nothing was left behind (proven at the bottom of §5). **Render: NOT
VERIFIED** — no browser session in this environment; numbered checklist at the bottom.

---

## 1. What was actually missing (confirmed, not re-diagnosed)

The task's own MEASURED section was accurate and I verified it against the live code before
building anything:

- `OrderPayment.tsx` → `ReportPaymentPanel` already offers both buttons and both call
  `report_my_payment(purchase_id, method, reference)`, writing `client_reported_method` /
  `client_reported_reference` / `client_reported_at` — **never `payment_status`**. Untouched
  except for one addition (§2).
- `PaymentReviewPage.tsx` was Zelle-notification-only, with an explicit "confirmation happens
  server-side" disclaimer, and **no confirm button anywhere**.
- `mark_purchase_paid(purchase_id, amount, reference, method)` already existed
  (`20260815T1600_booklink_b2_debit_or_create.sql`) — staff-gated (`has_staff_access()` or
  `service_role`), settles `payment_status`/`status`/`paid_at`/`amount_paid`/`payment_method`,
  resolves the buyer's/staff's "payment due" notices, and calls `notify_user` +
  `notify_staff`. Its own migration comment flagged **"zero callers in src/"** — this task is
  what gives it a caller.
- `purchases.status`/`payment_status` UPDATE is covered by a trigger
  (`trg_status_purchases`, `20260726050000_phase3d_status_writers.sql`) that writes
  `status_events` automatically whenever those two columns change — so `mark_purchase_paid`
  already produces the true-status trail for free; nothing new was needed there.
- **No real Zelle payment has ever cleared in prod** (ZELLECLOSE's own finding: 0 purchases
  have ever had a `payment_reference`). There is no historical "matched Zelle payment" trail to
  diff against for test #3 — the side-by-side proof below is a same-transaction comparison
  against a direct `mark_purchase_paid` call, which is exactly what the (not-yet-run)
  `zelle-reconcile.ts` will call once ZELLECLOSE ships. Coordination held: this task does not
  touch inbound Zelle matching, `payment_notifications`, or the existing three buckets.

## 2. The build

**One new claim-state machine on `purchases`**, distinct from the claim itself and from
`payment_status`:

```sql
client_claim_status          text NOT NULL DEFAULT 'none'   -- none | pending | confirmed | declined
client_claim_resolved_by     uuid REFERENCES profiles(user_id)
client_claim_resolved_at     timestamptz
client_claim_decline_reason  text
```

`client_reported_method` / `client_reported_reference` / `client_reported_at` (the claim
itself) are **never overwritten** by confirm or decline — D11 evidence retention.

**`report_my_payment`** (re-issued, logic otherwise identical) now also sets
`client_claim_status = 'pending'` and clears the three resolution columns on every report —
without this, a client wrongly declined once could never re-file, because
`client_reported_at IS NOT NULL` would stay true forever with no way back into the queue.

**`confirm_payment_claim(purchase_id)`** — staff-gated (`has_staff_access()`), requires
`client_claim_status = 'pending'`, then:
1. calls `mark_purchase_paid(purchase_id, amount, client_reported_reference,
   client_reported_method)` — **the same function a Zelle auto-match will call (D6, one
   spine)**, never a re-implementation;
2. sets `client_claim_status = 'confirmed'`, `client_claim_resolved_by = auth.uid()`,
   `client_claim_resolved_at = now()`;
3. logs a `claim_confirmed` sub-status via `log_status_event` (new vocab row, `sort_order 26`)
   recording who/when/method, on top of the `paid` true-status row the trigger already writes.

**`decline_payment_claim(purchase_id, reason)`** — staff-gated, requires `pending` + a
non-blank reason, sets `client_claim_status = 'declined'` + resolution columns +
`client_claim_decline_reason`, logs a `claim_declined` sub-status (`sort_order 27`).
**`payment_status` is never touched** — a claim never set it, so there is nothing to revert.

**`api/send-order-receipt.ts`** (new) — staff-authed exactly like `api/deliver-document.ts`
(bearer token → `db.auth.getUser` → `profiles.is_admin`/`role` check), calls the existing
`sendOrderReceipt()` (`api/_lib/receipt.ts`) so a cash/Zelle-claim confirmation fires the
**same** `receipt_sends`-logged email Stripe/Zelle auto-confirmation already uses. The browser
calls this right after `confirm_payment_claim` succeeds
(`confirmPaymentClaim()` in `api-payments.ts`), best-effort — a receipt failure never undoes
the confirmation, matching the existing contract stated in `receipt.ts`'s own header comment.

**`PaymentReviewPage.tsx`** — a **fourth bucket**, "Client claims", added to the existing nav
(`review` / `unmatched` / `matched` kept byte-identical, same component, same behavior). It
renders a self-contained `ClaimsQueue` sub-component with its own pending/confirmed/declined
sub-toggle (mirroring the page's existing bucket pattern), a row-click panel showing the claim,
and two actions: **Confirm payment** (`AsyncButton` → `confirmPaymentClaim`) and **Decline**
(reveals a required-reason textarea → `AsyncButton` → `declinePaymentClaim`). Cash and Zelle
rows render through one column set — method label and reference are the only difference, per
the task's explicit requirement.

## 3. Grants — `has_function_privilege()`, not the REVOKE output (the TRAPS lesson)

```
        proname        | anon | authenticated | service_role | public_grant
------------------------+------+---------------+--------------+--------------
 confirm_payment_claim  | f    | t             | t            | f
 decline_payment_claim  | f    | t             | t            | f
 report_my_payment      | f    | t             | t            | f
```

`anon = f` and `public_grant = f` for all three, proved live after the migration applied (not
inferred from the `REVOKE` statement's exit code — three prior tasks in this repo got burned by
that exact gap, most recently partystaging on 2026-08-15).

## 4. Migration discipline

`supabase/migrations/20260816T1900_cashconfirm_client_claim_confirm_and_decline.sql` — no
`BEGIN`/`COMMIT` inside it (the wrapper owns the transaction, per house rule). Sequence actually
run:
1. Dry-run: `psql … <<'SQL' \n BEGIN; \i <file>; <sanity selects>; ROLLBACK; \n SQL` — new
   columns, both vocab rows, and both function signatures all appeared correctly inside the
   transaction.
2. Proved the rollback: re-queried immediately after — 0 rows for the new columns, 0 rows for
   the new functions.
3. Applied for real: `psql -f <file>`.
4. Re-verified live: columns present with the correct defaults, vocab rows present at
   `sort_order 26/27`, grants correct (§3).

`pg_proc`/`information_schema` were checked before writing anything — `confirm_payment_claim`
and `decline_payment_claim` did not exist; `mark_purchase_paid` / `report_my_payment` /
`log_status_event` / `notify_user` did, with the exact signatures assumed. No migration was
re-applied.

## 5. THE TEST THIS MUST PASS — query output

Everything below is **one transaction** (`BEGIN … ROLLBACK`) against production Postgres,
impersonating real, already-live identities via `request.jwt.claims` + `SET ROLE authenticated`
(the standard house technique for exercising real RLS-gated RPCs from `psql`, used in prior
reports — TEXTEDIT, WALLSYNC). Three synthetic purchases were created and destroyed inside the
transaction; the 3 real production purchases were never touched. Full script:
`supabase/migrations/../` — kept in the branch's scratch history, reproduced inline below by
step.

### 1–2. Cash claim (no reference) and Zelle claim (with a reference) both land as claims

```sql
select report_my_payment(:cash_id, 'cash', NULL);
 -> {"method": "cash", "recorded": true, "reference": null}

select report_my_payment(:decline_id, 'zelle', 'ZL-TEST-4471');
 -> {"method": "zelle", "recorded": true, "reference": "ZL-TEST-4471"}
```

Staff queue read (pending bucket), both rows present, one column set:

```
                  id                  | display_code | amount | client_reported_method | client_reported_reference |      client_reported_at       | client_claim_status |   buyer_name
--------------------------------------+--------------+--------+------------------------+---------------------------+--------------------------------+---------------------+----------------
 7b056cf5-…                          | PUR-000107   | 150.00 | cash                   |                            | 2026-08-16 06:14:48.854162+00 | pending             | CJ Z
 e68d49d7-…                          | PUR-000109   |  90.00 | zelle                  | ZL-TEST-4471               | 2026-08-16 06:14:48.854162+00 | pending             | Claire Bourdon
```

Named incumbent kept alongside, unchanged: `payment_notifications` / `listPaymentNotifications`
/ the `review`/`unmatched`/`matched` buckets — this is a fourth bucket, not a replacement (C1).

### 3. Staff confirms a cash row → paid, same spine a Zelle settlement uses (C2, D6)

```sql
select confirm_payment_claim(:cash_id);
 -> {"method": "cash", "confirmed": true, "settlement": "paid"}
```

```
 id      | status | payment_status | paid_at            | amount_paid | payment_method | current_status | client_claim_status | client_claim_resolved_by | client_claim_resolved_at
 7b056cf5 | paid  | paid           | 2026-08-16 06:14:48 | 150.00      | cash           | paid            | confirmed            | b45a5503-… (the ADMIN)   | 2026-08-16 06:14:48
```

**Side-by-side trail** (test #3) against a purchase settled the way the automated Zelle-match
path will call `mark_purchase_paid` directly (no real historical match exists to compare
against — see §1):

```
-- cash claim, confirmed via confirm_payment_claim
 status            | detail                                | actor_user_id
 claim_confirmed   | Confirmed by staff — settled as cash  | b45a5503-… (staff)
 paid              |                                        | b45a5503-… (staff)
 payment_reported  | Client says they are paying cash      | 0a7fc801-… (buyer)
 submitted         |                                        |

-- auto-matched zelle, settled via mark_purchase_paid directly
 status     | detail | actor_user_id
 paid       |        | b45a5503-… (staff)
 submitted  |        |
```

Both reach `paid`/`paid` through the **identical `mark_purchase_paid` call**; the cash row
carries two extra sub-status rows (`payment_reported`, `claim_confirmed`) because a claim
exists to log and an auto-match has none. `confirm_payment_claim` never writes
`payment_status`/`status` itself — it only calls `mark_purchase_paid`.

### 4. Staff declines a claim → unpaid, reason recorded, claim retained (D11)

```sql
select decline_payment_claim(:decline_id, 'Buyer confirmed by phone the Zelle transfer never went through.');
 -> {"reason": "Buyer confirmed by phone the Zelle transfer never went through.", "declined": true}
```

```
 status            | payment_status | client_reported_method | client_reported_reference | client_claim_status | client_claim_decline_reason
 awaiting_payment  | unpaid         | zelle                  | ZL-TEST-4471               | declined             | Buyer confirmed by phone the Zelle transfer never went through.
```

`client_reported_method`/`reference`/`at` are the exact values the buyer submitted, untouched —
the claim is retained, not deleted. `status_events` carries the `claim_declined` sub-status with
the reason as `detail`.

**Re-claim reopens the queue** (necessary corollary, not in the task's numbered list, but
without it decline is a dead end): buyer reports again, `client_claim_status` flips back to
`pending`, `client_claim_decline_reason` clears —

```
 client_claim_status | client_claim_decline_reason | client_reported_method
 pending             |                              | cash
```

### 5. Client notified on confirmation — a notification row proves it (test #5)

Read as the buyer themselves (`notifications_owner_read` RLS — the same path `my_notifications()`
uses):

```
 user_id   | kind              | title                                              | body                                              | link         | created_at
 0a7fc801… | payment_received  | Payment received — CASHCONFIRM test — cash claim   | We received your payment of $150.00. Thank you.  | /app/orders  | 2026-08-16 06:14:48
```

Written by `mark_purchase_paid`'s existing `notify_user` call — reused, not reimplemented.

### 6. No client action ever changes `payment_status` (test #6)

Captured immediately after each `report_my_payment` call, before any staff action:

```
cash claim:  payment_status = unpaid   (client_claim_status = pending)
zelle claim: payment_status = unpaid   (client_claim_status = pending)
```

Both claims land as `unpaid`. `report_my_payment`'s `UPDATE` statement (re-read in the migration
diff) touches `client_reported_*` / `payment_method` / `client_claim_status` and nothing else —
`payment_status` is not a column it can reach.

### 7. Grants — `authenticated` true, `anon` false (test #7)

§3 above. Also proved by negative test — a plain non-staff `authenticated` user calling
`confirm_payment_claim` gets refused **inside** the function body (belt-and-suspenders: the
grant is broad like `mark_purchase_paid`'s, the `has_staff_access()` check inside does the real
gating):

```
ERROR:  operator access required
CONTEXT:  PL/pgSQL function confirm_payment_claim(uuid) line 8 at RAISE
```

And a double-confirm on an already-confirmed claim is refused too (defends the D6 spine from a
double-settlement race):

```
ERROR:  no pending claim on this order (claim status: confirmed)
```

### 8. Receipt trail — proved at the DB layer; the live email round trip is NOT VERIFIED

`receipt_sends` is written by `claim_receipt_send`/`log_receipt_send`
(`20260728170000_stage5_fulfillment_spine.sql`), called from `api/_lib/receipt.ts`'s
`sendOrderReceipt()`, which is Node code (renders a template, calls a real email provider) —
not something a `psql` session can exercise. I called the two RPCs directly with the SQL client
to prove the **shape** of the trail is identical for both settlement paths:

```
 purchase_id | idempotency_key                    | succeeded | recipient_email
 7b056cf5-…  | receipt:test:7b056cf5-…            | t         | test-buyer@example.com   (cash-confirmed)
 0b8d6d96-…  | receipt:test:0b8d6d96-…            | t         | test-buyer@example.com   (auto-zelle)
```

**What this does NOT prove:** that clicking Confirm in the browser actually sends a real email.
That path is `ClaimsQueue` → `confirmPaymentClaim()` → `POST /api/send-order-receipt` →
`sendOrderReceipt()` → the real provider — new wiring, never exercised end-to-end in this
session (no running dev server, no email provider credentials here). **NOT VERIFIED — owner
checklist item #1 below.**

### Rollback proof — nothing was left in prod

```sql
select count(*) from purchases;                                          -- 3  (unchanged)
select count(*) from purchase_items where label like 'CASHCONFIRM test%'; -- 0
select count(*) from receipt_sends where idempotency_key like 'receipt:test:%'; -- 0
```

## 6. Files changed

- `supabase/migrations/20260816T1900_cashconfirm_client_claim_confirm_and_decline.sql` — new,
  applied to prod.
- `api/send-order-receipt.ts` — new.
- `src/lib/ops/api-payments.ts` — added `listPaymentClaims`, `confirmPaymentClaim`,
  `declinePaymentClaim`, and the `PaymentClaim`/`ClaimStatus`/`ClientReportedMethod` types.
  Existing Zelle-notification functions untouched.
- `src/pages/app/ops/PaymentReviewPage.tsx` — fourth bucket + new `ClaimsQueue` sub-component.
  Existing notification bucket JSX re-indented (wrapped in a fragment) but otherwise
  byte-identical logic.

`npm run typecheck`, `npm run typecheck:api`, and `eslint` on all four changed/added files are
clean in a fresh worktree install (`wt-cashconfirm`, its own `node_modules` — never symlinked
across the `/Users/Cactai` vs `/Users/cactai` case-variant path, per the standing trap).

## 7. NOT VERIFIED — owner checklist

1. **Live receipt email on confirm.** Click "Confirm payment" on a real cash or Zelle claim in
   the browser and check: (a) a new `receipt_sends` row with `succeeded = true`, (b) the email
   actually arrives. This exercises `api/send-order-receipt.ts` for the first time outside this
   report.
2. **Browser click-through of the new "Client claims" bucket** — the tab switch, the row-click
   panel, the Confirm and Decline (with required-reason) buttons, and the toast messages. All
   DB-level behavior is proven above; the render itself is not.
3. **A real cash claim end to end**: a member clicks "I'm paying cash" on `OrderPayment.tsx`,
   staff sees it in Client claims, confirms it, member's own order view flips to paid (C3 — "the
   client's own order view reflects paid state through the normal path"). The DB-side proof
   (§5.3) covers the settlement; the member-facing order page was not opened in a browser.

## 8. What I deliberately did not touch

- `payment_notifications`, `listPaymentNotifications`, `findCandidateOrders`,
  `dismissNotification`, the `review`/`unmatched`/`matched` buckets, or anything in
  `api/zelle-reconcile.ts` / `api/_lib/reconcile.ts` — that is ZELLECLOSE's territory
  (inbound Zelle matching), explicitly out of scope here and not yet run.
- `mark_purchase_paid` itself — reused as-is, not modified. `report_my_payment` — reused as-is
  except the one necessary addition (§2) to keep decline from being a dead end.
- The pre-existing `claim_receipt_send`/`log_receipt_send` grants: both are currently granted to
  `anon` as well as `authenticated` (`has_function_privilege('anon', …, 'EXECUTE') = t`) —
  noticed while proving §5.8's grants, unrelated to any RPC this task adds, and out of this
  task's scope. **Flagged, not fixed** — same category as the pre-existing `test/db/
  creditfix_mint_from_unit_count.test.ts` lint error (1 error, pre-dates this branch, untouched
  by any file in this diff).
