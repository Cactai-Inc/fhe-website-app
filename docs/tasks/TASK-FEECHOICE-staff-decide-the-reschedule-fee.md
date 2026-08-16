# TASK FEECHOICE — staff choose the fee on a reschedule: apply it, pick a different one, or waive it

**Owner, 2026-08-16, verbatim:**

> *"we need reschedule options; apply fee, select the fee to apply or no fee."*

> *"for things where they contact us, its not an in app request so its something the staff handle
> on our side."*

# WHY THIS EXISTS

The automated bands are now live and correct, straight from the **signed** Company Policies §6.
But the policy itself contains fees the clock cannot decide, and the owner has ruled that
anything arriving by phone or text is staff-handled. So the system must let a human **override
the computed fee at the moment of the decision** — not edit the schedule, not bypass the trail.

# WHAT WAS MEASURED (prod, 2026-08-16 — verify, then build)

**Live and working — do not rebuild:**
- `booking_change_fees`: three bands loaded from the policy — **48h → $10, 24h → $20, 8h → $30**.
  Overlapping, tightest wins. Proven live: 72h→$0, 30h→$10, 12h→$20, 3h→$30.
- `reschedule_fee(org, start)` computes the amount. `mark_change_fee_paid` and
  `pending_fee_candidates` already exist.
- ONBOARD built the client-side fee gate: a change inside the window does not submit until the
  client confirms payment or chooses cash.
- REVIEWQ owns the staff decision path (`decide_booking_change`) and `_refund_booking_credit`.
- CASHCONFIRM/ZELLECLOSE own claim→confirm. **A fee charged here must settle through the same
  spine — `mark_purchase_paid` — never a second write path (D6).**

**NOT in the table, deliberately, and this task is where they land:**
- **No-show, $75** (§6). `booking_change_fees_hours_before_check` requires `hours_before > 0`, and
  a no-show is not a reschedule request — it is the absence of one.
- **Late start, $30** (§7): client contacted COMPANY *before* the start time and no later slot was
  available.
- **Late start, $40** (§7): client contacted COMPANY *after* the start time and COMPANY could not
  accommodate. **Keyed on negative time-remaining — inexpressible as an hours-before band.**

Both §7 fees are conditional on a staff judgement (*"if the schedule permits… in their sole
discretion"*), which is exactly why they cannot be automated.

# THE BUILD

## F1 — three options at the decision point
Wherever staff act on a reschedule (REVIEWQ's decision surface — **extend it, do not build a
second**), the computed fee is shown with three choices:
1. **Apply the computed fee** — the default, prefilled from `reschedule_fee()`.
2. **Apply a different fee** — pick from the policy's named fees (no-show $75, late-start $30,
   late-start $40) **or enter an amount**. Every option carries the policy wording so staff know
   which clause they are invoking.
3. **No fee** — waive it.

**A reason is required for anything other than the computed amount.** The waiver and the override
are both discretionary acts against a signed contract; the record must say who decided and why.

## F2 — the fee, once chosen, behaves like every other charge
- It settles through the existing spine, with the same provable trail (`status_events`,
  `receipt_sends`). **One payment spine.**
- It can be paid by Zelle or cash, converging with CASHCONFIRM's claim→confirm path — a fee is
  just another thing a client can claim to have paid and staff confirm.
- The client sees the fee and its policy wording, not a bare number.

## F3 — staff can charge these outside a reschedule
No-show and late-start are not always attached to a reschedule request — a no-show has no request
at all. Staff need to apply one of these fees to a booking directly. Reuse the same chooser.

## F4 — record what the policy said at the time
Store the **amount, the reason, who decided, when**, and which policy clause it came from. If the
schedule changes later, an old charge must still explain itself. **Never mutate a settled fee**
(D11) — corrections supersede.

# TRAPS
- **Do not edit `booking_change_fees` from this flow.** That table is the *policy transcription*;
  this task is per-decision override. Changing the schedule is a settings action, not a
  case action. (The schedule does need an owner-facing editor eventually — D13 — but that is not
  this task; flag it if no editor exists.)
- **Do not re-apply migrations that are already live.** Check `pg_proc` first. A thread re-applied
  REVIEWQ's m2 and resurrected a duplicate `book_open_slot` overload; PostgREST resolves by
  argument name, so the wrong credit could be spent silently.
- **Migrations never contain `BEGIN`/`COMMIT`**; dry-run and **prove the rollback** by re-querying.
- **`REVOKE … FROM PUBLIC` does not remove a direct grant** — prove with `has_function_privilege()`;
  `anon` false on everything new. Two unguarded anon-reachable RPCs were found this way on 08-16.
- `assertWrote()` on every write; RLS silently zeroes UPDATEs.
- **Never symlink `node_modules` across case-variant paths** (`/Users/Cactai` vs `/Users/cactai`) —
  macOS loads React twice, nulls every hook, breaks the build and ~50 UI tests.
- **Run the PGlite suite** (`vitest run`, capped workers, kill your processes before reporting).

# THE TEST THIS MUST PASS
1. Staff acting on a reschedule see the computed fee and all three options.
2. Applying the computed fee charges exactly what `reschedule_fee()` returned.
3. Selecting a different policy fee (no-show / late-start) charges that amount and records the
   reason — prove the trail matches a normal charge, side by side as query output.
4. Waiving records a zero charge with a reason and who decided; it is not silently absent.
5. A no-show fee can be applied to a booking with no reschedule request at all.
6. The client can pay a fee by Zelle or cash through the existing claim→confirm path.
7. `booking_change_fees` is unchanged by every one of the above — prove it.
8. Every DB claim is query output; render claims **NOT VERIFIED** with a numbered owner checklist.

Report to `docs/reports/TASK-FEECHOICE-REPORT.md`. Do not push; the orchestrator merges.
