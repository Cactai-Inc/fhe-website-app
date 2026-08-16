# TASK CREDITALIGN — the credit system matches the catalog, including weekly/monthly

**Owner, 2026-08-16, verbatim:**

> *"the prices for everything we sell is already shown in the catalog, the payment amounts are
> determined based on this, what was missing is the credit system being aligned with the actual
> catalog items. when i purchased something that had a multi unit quantity, weekly or monthly
> allotment, the system didnt recognize that properly for lessons or horse care."*
>
> *"make the booked and pending-booking item swap."*

# WHAT WAS MEASURED (prod, 2026-08-16 — verify, then build)

**Half of this is already fixed. The other half is the bigger half.**

- **Multi-unit packs: FIXED by CREDITFIX** (merged). Minting now reads `offerings.unit_count ×
  quantity`, gated on `config_kind='scheduled' AND segment <> 'horse'`. Proven: 4-Class Pack → 4,
  8-Lesson Punch Card → 8, Single → 1, horse-segment services → 0.
- **Weekly/monthly (`config_kind='recurring'`): MINTS ZERO. ALL TEN SKUs, BOTH SEGMENTS.**
  Measured live — `1x/2x Weekly Lesson`, both `(With your horse)` variants, and all six horse-care
  recurring SKUs (`Exercise/Training/Turnout 1x & 2x Weekly`) mint **0** credits. CREDITFIX
  deliberately scoped recurring out and told the next task to own the seam. **This task is that
  seam.** A client on a monthly plan has paid and can book nothing from credits.
- **The monthly machinery EXISTS — do not rebuild it.** BOOKLINK shipped
  `_monthly_plan_for_client`, `client_monthly_plan`, `my_monthly_plan`, `set_recurring_day`,
  `generate_monthly_lessons`. **But `generate_monthly_lessons` writes BOOKINGS directly and mints
  no credits** (verified: no `lesson_credits` reference, does `INSERT INTO bookings`). So a
  monthly client gets calendar rows but the credit view — what the booking UI reads to show
  "what can I book?" — stays empty.
- **`fulfillment_units` already models this**: 9 `session`, 4 `period`. `period` is the recurring
  shape. **Establish whether the entitlement belongs there rather than in `lesson_credits`** —
  and say which you chose and why. Do not create a third ledger.
- **`book_open_slot` is segment-aware**, so a correct horse-care entitlement can be consumed by
  the same path lessons use. Reuse it.

# THE BUILD

## A1 — a recurring purchase produces a real, visible entitlement
- Buying a weekly/monthly SKU must produce entitlement the client can see and book against, for
  **both lessons and horse care** — the owner named both, and all six horse-care recurring SKUs
  are equally broken.
- **The month is the boundary and it does not carry over** (owner, established in BOOKLINK's
  §B4): a month's allotment expires at month end. Whatever store you choose must carry an expiry
  the bookkeeping enforces, and the UI must show what remains **this month**.
- `weekly_frequency` × weeks-in-the-billing-month is the natural count. **State your formula and
  how a partial first month is handled** — ONBOARD's payment flow already offers proration, so
  the two must agree.
- **Do not double-mint.** `generate_monthly_lessons` already creates bookings. Either it consumes
  the new entitlement, or it stops creating bookings and the client books from credits — **pick
  one and say which**, because both together spends the allotment twice.

## A2 — item swap on a booking, pending or booked
> *"make the booked and pending-booking item swap."*

- The client (while pending) and staff (any time) can change **which purchased item** a booking is
  charged against — the thing ONBOARD explicitly did not build because it moves money.
- **The swap is a refund + a debit, atomically**: return the credit to the item being unassigned,
  consume one from the item being assigned. Reuse `_refund_booking_credit` (REVIEWQ's helper) —
  **it is the one refund seam; do not write a second.**
- Refuse the swap when the target item has no remaining entitlement, with a clear reason. Never
  leave a booking charged against nothing, and never let a swap mint entitlement from thin air.
- Record it: who swapped, from what, to what, when.

## A3 — the catalog is the single source of the numbers
- Nothing may infer quantity from a display name — CREDITFIX removed one such regex and offering
  names changed the same week (`1x Weekly` → `1x Weekly Lesson`), which is exactly why.
  `unit_count`, `weekly_frequency`, `config_kind` and `segment` are the inputs.
- **Report the prod delta**: for every existing purchase, entitlement-held vs entitlement-correct.
  **Do not backfill** — the owner rules on that separately, as with CREDITFIX's one wrong row.

# TRAPS
- **Do not re-apply migrations that are already live.** Check `pg_proc` first. A thread re-applied
  REVIEWQ's m2 on 2026-08-15 and resurrected a second `book_open_slot` overload; PostgREST
  resolves by argument name, so the credit picker could silently spend the wrong item.
- **Migrations never contain `BEGIN`/`COMMIT`**; dry-run and **prove the rollback** by re-querying.
- **`REVOKE … FROM PUBLIC` does not remove a direct grant** — prove with `has_function_privilege()`;
  `anon` false on everything new.
- **This bug has been fixed and silently reverted three times** (`20260726010000` → reverted by
  `20260802020000` → BOOKWRITE restored tagging but kept the broken formula → CREDITFIX). **Write
  the test so a fourth revert fails loudly.**
- `assertWrote()` on every write; RLS silently zeroes UPDATEs.
- **Never symlink `node_modules` across case-variant paths** (`/Users/Cactai` vs `/Users/cactai`)
  — macOS loads React twice, nulls every hook, breaks the build and ~50 UI tests. `npm install`
  in your own worktree.
- **RUN THE PGlite SUITE** (`test/db/`) — ONBOARD skipped it, so replayability on a fresh database
  is currently unproven across this area. Use `vitest run` (never watch) and cap workers; kill
  every process you start before reporting (8GB machine, twice killed by orphaned vitest).

# THE TEST THIS MUST PASS
1. Buying each of the ten recurring SKUs produces the correct visible entitlement — table of
   SKU → expected → actual, for lessons **and** horse care.
2. A monthly client's entitlement expires at month end and does not carry over; prove a
   last-month allotment is unusable this month.
3. `generate_monthly_lessons` and the entitlement do not double-spend — state the model, prove it.
4. A pending booking's item can be swapped: source credit returned, target debited, atomic,
   through `_refund_booking_credit`.
5. A booked (confirmed) booking's item can be swapped by staff, same guarantees.
6. A swap to an item with no entitlement is refused with a reason.
7. Nothing keys on a display name anywhere in the mint path.
8. Prod delta reported, nothing backfilled.
9. PGlite suite green; every DB claim query output; render claims **NOT VERIFIED** with a numbered
   owner checklist.

Report to `docs/reports/TASK-CREDITALIGN-REPORT.md`. Do not push; the orchestrator merges.
