# TASK ZELLECLOSE — a Zelle payment arrives and the system notices

**Owner (FLOWTRACE items 13 + 14):** nothing prompts anyone to check whether a payment arrived,
and **no alert fires when one does.** Payment is how this business gets paid; today it is
entirely manual and entirely invisible to the software.

**Read first:** `docs/reports/TASK-FLOWTRACE-REPORT.md` §5 and the payment-path facts in
`docs/reports/TASK-PAYLOCK-REPORT.md`. PAYLOCK fixed the two locks that made a provisioned buyer
unable to pay at all; **this task is what happens after they do.**

# WHAT WAS MEASURED (prod, 2026-08-15)

- **2 purchases exist. 0 have a `payment_reference`. 0 have a `unique_amount`.**
  Those two columns are the ONLY keys inbound matching uses. Every purchase ever created is
  unmatchable by construction.
- **Why:** the generator (`finalize_purchase_payment`) was unreachable until PAYLOCK. It works
  now — **but nothing has run through it yet**, so the fix is unproven against a real order.
- **The matcher exists** (`api-payments.ts` / `src/lib/payments.ts`) and matches on
  `unique_amount` then `payment_reference`. It has never had anything to match.
- **The trigger that would ingest inbound payment notifications is not in this repo** — FLOWTRACE
  found the intended path runs through an out-of-repo Apps Script. Establish what actually
  exists before building; **do not assume it is missing, and do not rebuild it if it is there.**

# THE BUILD

## Z1 — prove the memo generator end to end (do this FIRST; it may be the whole bug)
- Take a real order through `finalize_purchase_payment` post-PAYLOCK and show the row landing
  with a `payment_reference` and `unique_amount`. **If keys now generate correctly, say so
  loudly** — matching has never been given a fair test, and the rest of this task changes shape.

## Z2 — the arrival path, end to end
- Establish the real inbound path (in-repo trigger, out-of-repo Apps Script, or nothing) and
  **document it in `docs/reference/NOTIFICATIONS.md`** so it stops being folklore.
- When a payment arrives and matches: mark the purchase paid through the existing spine
  (`status_events` + `receipt_sends` — one provable row per attempt), and notify staff.
- When one arrives and does **not** match: it lands in a `review` state that a human sees.
  **A payment nobody can find is worse than no automation** — an unmatched payment must be
  loud, not logged to a console nobody reads (LESSONS.md: fire-and-forget + best-effort-200 is
  how two real leads were silently lost).

## Z3 — the manual half staff actually need
- BOOKLINK made staff able to mark an order paid via **zelle or cash**. Make sure that path
  writes the same provable trail as automatic matching — **one payment spine, not two.**
- Staff need one place that answers *"who owes money and who has paid?"* Put it where they
  already work (the Dashboard needs-attention band / Payment review, which exists in nav).

# TRAPS
- **`REVOKE … FROM PUBLIC` silently no-ops** when a direct grant exists — after any grant
  change, prove with `has_function_privilege()`. Three revokes in this repo did nothing.
- **Migrations never contain BEGIN/COMMIT**; dry-run and PROVE the rollback.
- **Do not build a second payment path.** `finalize_purchase_payment`, `status_events`,
  `receipt_sends` and the purchases spine all exist.
- **Do not touch** `ContractPage.tsx`, `ClauseDocument.tsx`, `AddElementModal.tsx`,
  `PartyControlsCard.tsx`, or booking-queue surfaces (`TASK-REVIEWQ`). Report diffs instead.
- Stripe is `STRIPE_ENABLED = false` — **card is out of scope**, but note that
  `api/stripe-create-session.ts:43` still carries the buyer-key bug PAYLOCK fixed elsewhere
  (flagged, not fixed, in that report). Do not fix it here; do not break it either.
- Real money: **write nothing to a real purchase without saying exactly what you wrote.**

# THE TEST THIS MUST PASS
1. A real order produces a memo + unique amount, shown as query output.
2. The inbound path is documented and its actual existence established (not assumed).
3. A matching payment marks the purchase paid with a provable event trail.
4. A non-matching payment lands somewhere a human sees, and an alert row proves the attempt.
5. Staff-marked zelle/cash payments write the same trail as matched ones.
6. Every DB claim is query output; render claims NOT VERIFIED with a numbered checklist.

Report to `docs/reports/TASK-ZELLECLOSE-REPORT.md`. Do not push; the orchestrator merges.
