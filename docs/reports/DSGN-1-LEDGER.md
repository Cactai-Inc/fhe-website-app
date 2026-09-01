# DSGN-1 · LEDGER

**Opened 2026-09-01 · Role:** `docs/method/DSGN-ROLE.md` · **Assignment:** prepare CR-90 and CR-97
for build from `docs/reports/DISCO-1-HANDOFF.md`.

---

## RESUME

**State:** ✅ **DSGN-1 IS COMPLETE.** Both specs written, handoff written, all four files committed.

**Delivered:**
- `docs/tasks/TASK-LIFECYCLE-six-states-and-the-thirty-day-horizon.md` *(CR-90 states + horizon)*
- `docs/tasks/TASK-MONTHEND-the-invoice-the-reminder-and-the-deliberate-override.md`
- `docs/reports/DSGN-1-HANDOFF.md` — chunks, contention, model picks, 4 ASK-OWNER, what I decided

**If a gap comes back from a build, it returns HERE** (`DSGN-ROLE.md` §1): decide first whether the
SPEC was incomplete or the BUILD ignored it, say which plainly, amend the spec, add the missed thing
to THE TEST, and tell ORCH in two lines what moved.

**Nothing is left half-done. No follow-up step is pending in this thread.**

---

## 1 · WHERE THE STEP-3 CONVERSATION IS

⚠️ **DISCO-1-HANDOFF §2 warns "DO NOT AUTHOR PASS 1 OR PASS 3 SPECS FROM THIS DOCUMENT ALONE" and
§8 says no validation criteria exist.** **That warning is STALE and I am not blocked by it.**

**Why:** the handoff closed before the owner's 2026-09-01 conversation. Seven commits after it
(`9b3fe0ab`…`5f1a0446`, plus `9def8e3c`) record that conversation into
`docs/reference/CHANGE-ORDER-LEDGER.md` as CR-97 with 🔒 RULED answers. **The rulings ARE the
validation criteria** — they are the owner's words, decided, in the canonical ledger.
**DSGN-ROLE.md itself (`7b7b1316`, authored after the handoff) names CR-90 + CR-97 as its worked
example of one chunk**, which is ORCH6 transmitting the same decision.

**So: I proceed, and I say in the handoff that I am doing so and on what authority.**

## 2 · ⚠️ CORRECTION TO DISCO-1 — THE 90-DAY HORIZON IS IN **THREE** PLACES, NOT ONE

**DISCO-1-HANDOFF §7 answer table:** *"Is `current_date + 90` in more than one place? ✅ **NO.** One
line in `_ensure_plan_horizon`."* ⚠️ **WRONG, and dangerously so.**

**Query:**
```sql
select proname, (regexp_matches(prosrc,'.{0,70}current_date\s*\+\s*90.{0,40}','g'))[1]
from pg_proc where pronamespace='public'::regnamespace and prosrc ~ 'current_date\s*\+\s*90';
```
**Result — three rows:**
| function | the line | why it matters |
|---|---|---|
| `_ensure_plan_horizon` | `v_through date := coalesce(p_through, current_date + 90)` | **a DEFAULT** |
| `ensure_standing_slots` | `v_target date := current_date + 90` → passes it as `p_through` | ⚠️ **overrides the default** |
| `mint_recurring_allotments` | `v_target date := current_date + 90` → passes it as `p_through` | ⚠️ **overrides it, AND runs daily on cron** |

🔒 **THE TRAP THIS CREATES:** both callers pass `p_through` **explicitly**, so changing only
`_ensure_plan_horizon`'s default — which is exactly where DISO's answer points a build thread —
**changes nothing at all.** And `mint_recurring_allotments` is wired to the live
`/api/mint-monthly-allotments` cron (hourly workflow, `20 8 * * *`), **so it would re-materialise 90
days every morning even if the other two were fixed.**

*(Two further `interval '90 days'` hits — `dash_business_kpis`, `deliver_evaluation_report` — are a
KPI window and a report expiry. Unrelated. Do not touch.)*

## 3 · MEASURED 2026-09-01 (all read-only against prod)

- **`bookings.status` in use:** `available` 594 · `scheduled` 117 · `cancelled` 6 · `completed` 1.
  **Four of twelve.** Confirms CR-97's own measurement, unchanged.
- **`bookings_status_check`** permits 12: `draft available unavailable pending pending_slot
  pending_payment confirmed cancelled expired completed scheduled no_show`.
  ⚠️ **`approved` and `moved` are NOT among them — both need the constraint widened.**
- **Future `scheduled` sessions:** 23 within 30 days · 21 in days 30–60 · 22 beyond 60 ·
  **max `2026-11-30`.** ⚠️ **43 sessions are held beyond the ruled 30+30 window.**
- **No waitlist exists:** `to_regclass('public.waitlist')` is NULL. `request_selections` = 8 rows.
- **20 functions `UPDATE bookings`**; the status-writing seams are `book_open_slot`,
  `confirm_booking`, `confirm_booking_for_purchase`, `request_booking_change`,
  `decide_booking_change`, `swap_booking_item`, `update_my_pending_booking`,
  `withdraw_my_pending_booking`, `cancel_lesson_session`, `complete_lesson_session`,
  `save_booking_form`, `calendar_reminder_sweep`.
- **`booking_change_requests` already exists** (22 cols) and `decide_booking_change` already carries
  a direction-aware approve/decline with `awaiting_client`. ✅ **The move machinery has an
  incumbent — CR-97's `moved` converges on it, greenfield is wrong.**
- **The month-end cadence has an incumbent too:** `/api/mint-monthly-allotments` →
  `mint_recurring_allotments()`, already on the GitHub Actions schedule.
  ⚠️ **No invoice exists anywhere** — confirmed.

## 4 · CHUNKING — decided

**Two chunks, not one, and the waitlist is a third that I am NOT specced.**
- **`TASK-LIFECYCLE`** — the states, the transitions, the viewer-scoped read, and the 30+30 horizon.
  **One machine.** The horizon cannot be specced apart from what `pending` means.
- **`TASK-MONTHEND`** — invoice 3 days before month end, reminder on the last day, payment confirmed
  flips the pending month. **A consumer of the machine**, on the existing scheduler.
- ⚠️ **WAITLIST — NOT SPECCED. BLOCKED.** CR-97's own ASK-OWNER (a/b/c) is unanswered, and the three
  shapes are different products. DSGN-ROLE §2 forbids filling that gap.

**Merge order in front of both: `TASK-BACKDATE` and `TASK-BOOKS1`** — CR-97 names both as landing
first, and both are built-and-unmerged in worktrees right now.

## 5 · HOUSEKEEPING
**No worktree. No write to production. Nothing staged.** `psql` invoked ~10 times, each exiting.
