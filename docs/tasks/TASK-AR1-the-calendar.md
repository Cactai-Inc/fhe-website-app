# TASK-AR1 — the calendar, all of it

⚠️ **READ `docs/method/ADMIN-REVIEW-ANALYSIS-STANDARD.md` FIRST. It is half of this assignment** — the
depth requirement, the state matrix, the report shape, and the rules that will otherwise cost you a
finding. **You are writing a report. You are fixing nothing.**

**Owner, 2026-08-29:** *"fix the entire list of issues already have for the calendar."*

---

## 1. YOUR SCOPE

**The calendar surface and everything that feeds it.** The page, the month and week views, the item
panel, availability, standing weekly slots, durations, and the booking rows the calendar draws.

**The ledger's calendar entries are CR-01 … CR-07 in `docs/reference/CHANGE-ORDER-LEDGER.md`.** ⚠️ **Read them
as INPUT, not as a complete list.** The owner's own criticism of them, 2026-08-28: *"they are
snippets not full written text with a fix, it appears my statements are broken into snippets shown as
quotes and then the cause is identified but no solution or fix mentioned."* **Supplying the missing
fixes is the point of this task.**

**Also in scope, because they are the same surface:** CR-71 (horse activity limits constraining
availability), CR-82 (the horizon and first-month pricing), and D25's naming rules.

## 2. WHAT IS ALREADY MEASURED — do not re-derive, DO re-verify

**Verified 2026-08-28 against production. Each is a starting point, not a conclusion.**

| | |
|---|---|
| **Reachability** | ⚠️ **The calendar has a route (`/app/calendar`) and NO `pageRegistry` row.** It is hand-written JSX in the `APP_PAGES_GROUP` block at `AppLayout.tsx:1488`, parked in Review. **This is D17's original instance and it is still open.** |
| **Furniture** | **565 of 642 bookings — 88% — are `available` generated slots.** Real content is 75 `scheduled` + 2 `cancelled`. *(The ledger says 92%; it has moved.)* |
| **The midnight booking** | ⚠️ **Still live, and it is dated 2026-08-28: `00:00 → 13:00`, thirteen hours, status `scheduled`.** Unreachable in week view because the grid draws business hours only and places an item by its start hour alone. |
| **Durations** | ⚠️ **`offerings` has NO duration column. Nothing anywhere records how long a service takes.** |
| **And the part nobody has reported** | Of 75 scheduled bookings, **72 are exactly 60 minutes and NOT ONE is 90.** So the 90-minute evaluation is not a drawing bug — **the data has never carried it.** |
| **Timezone** | **23 hardcoded `America/Los_Angeles` sites** across `src`, `api` and `supabase`. |
| **Revenue** | **Two functions: `calendar_revenue` and `revenue_summary`.** Two numbers for one fact — the shape of every disagreeing-count defect this project has had. **Do they agree? Prove it with a query.** |
| **Horizon** | `ensure_standing_slots` line 11 `v_target := current_date + 90`, `_ensure_plan_horizon` line 10 same. ⚠️ **`_ensure_plan_horizon` already loops month by month and already takes `p_through`** — the monthly behaviour the owner wants is a wrong default, not a missing mechanism. |
| **Proration** | ⚠️ **ZERO database functions match `prorat`.** The only occurrence in the repo is `src/pages/Lessons.tsx:52`, a public footnote promising customers *"First month can be prorated…"*. **The site promises it and nothing implements it.** |

## 3. THE TRAPS

⚠️ **CR-03 and CR-06 are each other's evidence.** Removing the generated availability furniture also
removes what the self-booking path books, and the three-position toggle is how availability gets
published. **Deciding either alone invalidates the other. Treat them as one question.**

⚠️ **CR-07 is blocked twice over** — a clash-aware picker needs durations to exist (CR-05), and while
the generated slots remain, every hour already looks busy so a clash check would refuse everything.

⚠️ **D25 governs every word the calendar shows.** *"Booking"* is internal taxonomy and must never
appear to a client. Riding lessons are named HIGH (always *"Riding Lesson"*, never the SKU); horse
care is named LOW (turnout, clipping) but never by frequency; and **the noun changes per service** —
a service, an appointment, or a Riding Lesson. **Report every place the calendar breaks this.**

⚠️ **D23 governs what a recurring purchase produces:** a standing weekly slot, not a credit balance.
**A recurring purchase producing a spendable credit is defective** — except as the holding form for a
session owed but not delivered. **Do not report the zero balance as a bug; an orchestrator did and
was corrected.**

⚠️ **CR-71's consecutive-day limit can be broken retroactively** — cancelling a rest day puts a horse
over its limit without anyone touching that horse's booking.

## 4. THE QUESTIONS YOUR REPORT MUST ANSWER

1. **What is the calendar FOR** — for Claire, for staff, for a member? Three answers, plain language.
2. **Should the availability model be inverted** (empty means bookable) — and **what replaces
   self-booking** when the published slots go? ⚠️ **A candidate already exists; name it.**
3. **Where should duration live** so that both the drawing and a clash-aware picker can read it?
   ⚠️ **And how does the 90-minute evaluation get recorded**, given nothing has ever stored one?
4. **Do the two revenue functions agree?** If not, which is right and what is the single source?
5. **What does the calendar look like on a phone?** The owner's working device.
6. **What is the smallest change that makes the horizon monthly**, given `p_through` already exists?
7. ⚠️ **Is there one calendar or several?** The dashboard shows a week view; the ops surfaces show
   their own. **Same component or a second implementation?**

## 5. OUT OF SCOPE

- Building anything. Reports only.
- The proration **pricing rule** — the owner has open questions on it (per-lesson vs whole weeks;
  whether no-prorate credits expire). **Report the mechanism and flag the rule as his to settle.**
- Nav section structure — that is `TASK-AR4`. ⚠️ **But the calendar's missing registry row IS yours
  to report**, because it is a calendar defect; say so and name AR4 as the neighbour.

## 6. REPORT

`docs/reports/TASK-AR1-REPORT.md`, in the standard's §4 shape. Worktree `wt-ar1`, branch `task/ar1`.
**Commit the report only. Do not push.**
