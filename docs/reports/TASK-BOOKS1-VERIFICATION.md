# TASK-BOOKS1 — VERIFICATION · ORCH6 · 2026-09-01

⚠️ **First use of the paired-file format** (`ORCHESTRATOR.md` §4a). The thread's own account is
`TASK-BOOKS1-REPORT.md`; this is what ORCH checked ITSELF.

**Merged after rebase. Gates on `main`: typecheck 0 · typecheck:api 0 · lint 46 · build clean ·
`test:api` 7/7.**

## ✅ VERIFIED INDEPENDENTLY, IN PRODUCTION
| Claim | Check | Result |
|---|---|---|
| the deadline defect is gone | `prosrc` of `revenue_summary` | ⚠️ **zero occurrences of `nullif`** |
| the books did not move | `sum(coalesce(amount_paid, amount, 0))` over paid orders | **4 orders · $1,935.00 — unchanged** |
| the union survived the rebase | `pg_get_function_identity_arguments` | **`p_paid_at` at position 5, `p_disposition`, `p_write_down_reason` — both tasks' work in one signature** |
| both behaviours live in the body | grep of `prosrc` | **6 hits across the future-date guard and the disposition branches** |
| ⚠️ no `anon` grant crept in | `proacl` on the four money functions | **clean** — and this thread found and named the default-privileges trap itself |

## ⚠️ THE COLLISION, CLOSED
**This is the task that overwrote `mark_purchase_paid` mid-flight** *(D35)*. **The cause was ORCH's —
two specs, one function, opposite ownership.** **On the rebase it hit THREE conflicts, not the two
ORCH predicted**, resolved by union, **and re-verified against production afterwards rather than
citing the earlier pass** — which is exactly what D35 now requires.
✅ **The two features compose rather than coexist: the Orders-table date control applies to a
discount or comp, so a backfilled give-away books in the month it happened, under BACKDATE's
no-receipt rule.** **That is a better outcome than either spec asked for.**

## ROUTED, NOT FIXED
1. **The dossier Orders tab settles through the union seam but offers no discount/comp affordance** —
   a single additive edit, ⚠️ **no longer contested by any running thread. It needs a spec, not a
   patch at merge** *(`ORCHESTRATOR.md` §0a — ORCH does not fix things)*.
2. **`apply_booking_fee`'s waived-fee path had been raising since the payments ledger landed** —
   repaired inside this task's guard. **Recorded because it was never anybody's task and would
   otherwise look like scope creep in the diff.**
3. **`grant_lesson_credit` retirement is deferred to `CR-94` pass 2**, per R7. **Not forgotten.**
