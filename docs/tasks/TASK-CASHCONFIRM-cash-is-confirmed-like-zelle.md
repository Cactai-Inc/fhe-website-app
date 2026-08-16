# TASK CASHCONFIRM — a cash payment is confirmed exactly like a Zelle one

**Owner, 2026-08-16, verbatim:**

> *"cash needs to be confirmed just like zelle, the cash payment is a button click on the user
> side and the payment confirmation page lists it just like a zelle payment for confirmation and
> staff click a button to confirm it."*

# WHAT WAS MEASURED (prod + main, 2026-08-16 — verify, then build)

**The client half is already symmetric and correct — do not rebuild it.**
`OrderPayment.tsx` offers both buttons ("I've sent the payment" / "I'm paying cash"), both call
the same `reportMyPayment(orderId, method, reference)` → `report_my_payment` RPC, and both write
the same three columns on `purchases`: `client_reported_method`, `client_reported_reference`,
`client_reported_at`. A claim deliberately **never** touches `payment_status` — correct, and it
stays that way.

**The staff half is where the asymmetry is.** `PaymentReviewPage.tsx` is Zelle-only *by
construction*: its own header says *"Zelle notifications the server could not auto-match.
Confirmation itself happens server-side — this queue is for context and triage only."* It is
built around inbound Zelle notification rows, so:
- **a cash claim has nowhere to appear**, and
- **there is no staff confirm button at all** — the page explicitly disclaims confirmation.

So the gap is not "cash lacks a button". It is that **the confirmation surface does not accept
client-reported payments of either kind** — Zelle's confirmations arrive server-side from matched
notifications, and cash has no server-side equivalent because there is nothing inbound to match.

# THE BUILD

## C1 — the queue lists client-reported payments, both methods, identically
- The payment confirmation surface gains client-reported claims as first-class rows:
  who, order, amount, **method (zelle | cash)**, the reference if they gave one (Zelle only,
  optional by design — blank is fine), and when they claimed it.
- **Cash and Zelle rows look and behave the same.** The only difference is the method label and
  that cash never carries a reference. Do not build a separate cash queue or a separate page.
- Keep the existing unmatched-Zelle-notification bucket — this is an added bucket alongside it,
  not a replacement. Name the incumbent in your report.

## C2 — staff confirm with a button, and it settles the order
- One action per row: **confirm**. It marks the purchase paid through the existing spine —
  `payment_status`, `status_events`, and the receipt path (`receipt_sends`) — the **same** trail a
  matched Zelle payment produces today. **One payment spine, not two** (D6).
- Confirming records **who** confirmed and **when**, and the method it settled as.
- A decline/undo path: staff must be able to reject a claim that never arrived (the client said
  they paid and did not). It reverts to unpaid with the reason recorded — **never deletes the
  claim**, which is evidence (D11).
- **Notify the client on confirm** through the existing notification spine, one provable row per
  attempt.

## C3 — the two halves stay honest about what they mean
- A client claim is a **claim**, not payment. Staff-facing copy must say so — it is the reason
  `payment_status` is untouched until a human confirms.
- Once confirmed, the client's own order view reflects paid state through the normal path.

# TRAPS
- **Do not let a client claim mark anything paid.** That is the whole safety property here.
- **`REVOKE … FROM PUBLIC` does not remove a direct grant** — prove every new RPC's grants with
  `has_function_privilege()`; `anon` must be false. This has bitten three times, most recently
  2026-08-15 on the partystaging RPCs.
- **Migrations never contain `BEGIN`/`COMMIT`** — the wrapper owns the transaction; dry-run and
  **prove the rollback** by re-querying after it. Two threads wrote to prod believing they were
  dry-running.
- **Do not re-apply migrations that are already live.** Check `pg_proc` / `information_schema`
  first. A thread re-applied REVIEWQ's m2 on 2026-08-15 and resurrected a second
  `book_open_slot` overload — PostgREST resolves by argument name, so the credit picker could
  have silently spent the wrong item.
- `assertWrote()` on every write; RLS silently zeroes UPDATEs.
- **Never symlink `node_modules` across case-variant paths** (`/Users/Cactai` vs `/Users/cactai`)
  — it makes macOS load React twice, nulls every hook, and breaks the build and ~50 UI tests.
  Run `npm install` in your own worktree.
- ZELLECLOSE (`docs/tasks/TASK-ZELLECLOSE-...md`) owns **inbound** Zelle matching and is not yet
  run. **Coordinate: this task owns the client-claim → staff-confirm path only.** If ZELLECLOSE
  has already run, converge on its trail rather than adding a second.

# THE TEST THIS MUST PASS
1. A client clicks "I'm paying cash" → a row appears in the staff confirmation queue that looks
   like a Zelle claim row, minus the reference.
2. A client clicks "I've sent the payment", with and without a reference → both appear.
3. Staff click confirm on a cash row → the purchase is paid, with the same `status_events` /
   receipt trail a Zelle confirmation produces. Show both trails side by side as query output.
4. Staff decline a claim → unpaid, reason recorded, claim row retained.
5. The client is notified on confirmation; a notification row proves the attempt.
6. No client action ever changes `payment_status` — prove it.
7. Every new RPC: `authenticated` true, `anon` false, proven with `has_function_privilege()`.
8. Every DB claim is query output; every render claim is **NOT VERIFIED** with a numbered owner
   checklist.

Report to `docs/reports/TASK-CASHCONFIRM-REPORT.md`. Do not push; the orchestrator merges.
