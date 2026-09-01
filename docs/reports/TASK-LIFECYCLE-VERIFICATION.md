# TASK-LIFECYCLE — VERIFICATION (ORCH7, 2026-09-01)

**Verdict: VERIFIED AND MERGED.** Merge commit on `main` (branch `task/lifecycle-b` from `wt-2`;
`task/lifecycle` in `wt-1` is the abandoned collision branch and was NOT merged).

## What ORCH checked ITSELF — fresh queries against production, run at verification time (D35)
| Claim | My check | Result |
|---|---|---|
| CHECK permits the six states, retires `pending_slot`/`pending_payment` | `pg_get_constraintdef` on `bookings_status_check` | ✅ 13 values incl. `requested`/`approved`/`moved`; both retired spellings gone |
| DEFAULT moved | `information_schema.columns` | ✅ `'requested'::text` |
| Zero `current_date + 90` sites remain | scan of every `public` function body | ✅ 0 |
| The payment flip cannot be silenced by the `UPDATE OF` trap | `pg_get_triggerdef` on `purchases_confirm_bookings` | ✅ trigger exists, **no column list** |
| New functions carry no `anon`/PUBLIC (BOOKS1 trap) | `pg_proc.proacl` on the three new functions | ✅ `authenticated` only on `booking_awaiting_payment`; the two internals `postgres`+`service_role` only |
| Status distribution unchanged for real rows | `GROUP BY status` | ✅ available 604 · scheduled 117 · cancelled 6 · completed 1 |
| Horizon | `plan_horizon_through()` | ✅ `2026-10-31` |
| `request_open_time` writes `requested` (the seam SIGNBOOK inherits) | function body | ✅ |
| Viewer-scoped read | `calendar_free_busy` body: `cancelled` no longer in `WHERE`, emits `pending_reschedule` | ✅ both |

## The reach (D17), verified in source
`confirm_booking` has exactly one RPC call site (`api-calendar.ts:551`), consumed by
`CalendarPage.tsx` `RequestsBar` (`:1299`, staff-gated at `:520`) and `CalendarItemPanel.tsx` —
matching the report. `pending_reschedule` renders: class `:119`, label `:151`, legend row `:138`.

## Gates after merge
typecheck **0** · typecheck:api **0** · lint **46 warnings, 0 errors** (baseline) · build **clean** ·
`test:api` **7/7**. `test:db` not run — red at baseline, proof of nothing.

## What did NOT hold / deviations
- **None found against the spec's §9 criteria.** The thread's two overrides of the spec (three
  states not two; seven extra functions) are CORRECT and are the station-overrules-ORCH mechanism
  working — recorded, not re-litigated.

## ROUTED, not fixed (now on the board)
1. A 1-hour reminder fires for an UNAPPROVED session (pre-existing behaviour under a new name) —
   product question, to DISCO/DSNR.
2. A client accepting a staff counter-time on an unpaid order lands `scheduled` with no payment
   request (`request_purchase_payment` is staff-only) — to DSNR.
3. The month view truncates to 3 items/day, hiding a fourth label (AR1, known).
4. The reschedule waitlist — still the owner's open item №1; nothing stubbed.
5. `TASK-MONTHEND` seam: the pending month flips via the plan's ORIGINAL purchase until per-month
   billing exists — named deliberately in the report §5.3.

## The owner's half
Report §8 — seven render checks on a staff login. **Item 6 is the visible behaviour change**
(next month renders pending/orange for recurring clients); item 4 makes six historical
cancellations visible to their parties for the first time — intended, D32.
