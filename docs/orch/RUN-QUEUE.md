# RUN QUEUE — what to run, in what order, with what settings

**Rewritten 2026-08-31 by ORCH6, after merging `TASK-FIX4`.** ⚠️ **Start at the top. Everything above
the line you are on is merged and pushed; nothing below it has started.**

---

## ✅ MERGED — do not re-run, do not re-audit
`AR1`–`AR7` *(research)* · `FIX1` *(front door + signature engine)* · `FIX2` *(instructor stamp,
standing slot, record reach)* · `FIX3` *(nav sections, activity surfaces removed)* ·
⚠️ **`FIX4` — merged by ORCH6 as `a9ffcdcd`, pushed.** *(It was BUILT and waiting, not waiting to be
run: the brief's "READY" was one step stale. Audit in the merge commit message; report at
`docs/reports/TASK-FIX4-REPORT.md`.)*

**Baselines re-measured on `main` AFTER that merge:** typecheck **0** · typecheck:api **0** ·
lint **46** · `npm run build` **exit 0** · `test:db` **red, documented baseline, proof of nothing**.
⚠️ **WORKTREE STATE IS NOT KEPT HERE — see `docs/orch/BOARD.md`.** *(This line read "NONE LIVE" while
five were live, and it misled `DSGN-1` on 2026-09-01. A status claim in a queue file is a hypothesis,
D20; the board is written on every dispatch and merge.)*

---

## ⚠️ RESEQUENCED 2026-08-31 BY THE OWNER — READ THIS BEFORE THE ORDER BELOW

**He is running `TASK-FIX5` next, then `TASK-FIX6`.** ⚠️ **FIX5 MOVES EVERY DOC PATH IN THIS FILE.**
**After it merges, every prompt below must be re-issued with `docs/tasks/` → the new layout.**
**Do not paste a stale path.**

**And three specs were written or rewritten after the owner's 2026-08-31 corrections:**
- ⚠️ **`TASK-BOOKS1` was REWRITTEN** — a comp is a **payment disposition on an ordinary order**
  (`CR-89`), not a special zero-priced grant. **Any earlier reading of it is superseded.**
- **`TASK-MODAL2` is NEW** (`CR-93`) — Escape, system-triggered dialogs, and the save state beside the
  close icon. **It corrects `TASK-FIX4`, which has already merged.**
- **`TASK-CR85` is unchanged.**

**Still to spec, and ORCH6 owns it:** ⚠️ **`CR-90` — the 30-day standing schedule and month-end
invoicing.** **It is the one with an operational deadline that has already passed** *(see the OPEN
section)*.

## ▶ 1 · TASK-CR85 — three nav sections, People dissolves into Community

```
TASK-CR85

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/TASK-CR85-three-nav-sections.md and build it.
```
**Opus · thinking ON · effort HIGH**

⚠️ **FIRST, AND ALONE IN `AppLayout.tsx` + `pageRegistry.ts`.** Small in intent; the file is the most
contended in the repo and the last nav change shipped desktop-only.
⚠️ **`TASK-FIX6` needs a nav row in those same files, so this goes first** — otherwise FIX6's row is
slotted into a section structure that is about to change under it.
**Opus, not Sonnet:** three render surfaces that have silently disagreed before, plus a group key that
is also registry data.

## ▶ 2 · TASK-BOOKS1 — what a sale was worth, and what we gave away

```
TASK-BOOKS1

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/TASK-BOOKS1-what-a-sale-was-worth.md and build it.
```
**Opus · thinking ON · effort HIGH**

⚠️ **CARRIES CR-86's DEADLINE. Safe to run BESIDE CR-85** — no shared file: it owns the money
functions and the point-of-sale surfaces, not the nav.
⚠️ **It OWNS `revenue_summary`. `TASK-FIX6` may call it and may not redefine it.**

## ▶ 3 · TASK-FIX6 — Ops, Sales, Marketing and the error report

```
TASK-FIX6

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/TASK-FIX6-ops-and-sales.md and build it.
```
**Opus · thinking ON · effort HIGH**

⚠️ **AFTER CR-85 MERGES** *(nav rows)*. FIX4's dependency is satisfied — it is merged.
⚠️ **THE MANDATORY PAUSE IS REAL:** framework → **Sales + Marketing in full** → **STOP and ask the
owner for Claire's Ops zone list** → Admin → Ops. ⚠️ **His list CANNOT arrive early** — *"i dont have
claires ops zone list until i see the full sales and marketing dashboards."* **Steps 1, 2 and 4 ship
without it. Do not hold the merge waiting for it.**
**Verified in production 2026-08-31 by ORCH6, so the spec's premises are current:**
`profiles_dashboard_focus_chk` still pins `dashboard_focus` to `trainer|business` *(1 account each,
11 null)* · `support_requests` **0 rows** · `shifts` **0 rows** · `bookings.kind` = `lesson` **715**,
`block` **3**, ⚠️ **care bookings still ZERO**.

## ▶ 4 · TASK-FIX5 — repo hygiene

```
TASK-FIX5

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/TASK-FIX5-repo-hygiene.md and build it.
```
**Sonnet · thinking ON · effort HIGH**

⚠️ **LAST. AFTER CR-85, BOOKS1 AND FIX6 HAVE MERGED.** It moves files everything else cites, and
creates worktrees in the directory being cleaned. **Moving files under a running thread is how work is
lost.** The plan is already written in `docs/reference/DOCS-LAYOUT.md`; the execution is mechanical
breadth, which is what Sonnet is for.

## ▶ 5 · the zone sweeps — `docs/tasks/ZONE-SWEEPS-A1-A12.md`

**SEVEN threads, not twelve** — grouped by shared spine. **Opus.**
⚠️ **`A12 Barn operations` owns `resources` / `resource_lots` / `consumption_events` /
`cost_allocation_rules` / `billable_lines`. THE OWNER RULED THE PER-EVENT COST LEDGER OUT on
2026-08-31 — cost is a monthly sheet typed in on the horse record. Those five tables STAY UNDRIVEN
(D32); A12 must not "finish" them.**

## ▶ 6 · the enumerated status document → his chat thread → **ORCH7**
then **ORCH8** for his UVT findings, **ORCH9** for the client side.

---

# ⚠️ SPECCED BUT NOT YET QUEUED — CR-86's other halves

| | What | Blocked on |
|---|---|---|
| **CR-86 gap 3** | ⚠️ **the monthly cost sheet on the horse record** — one row per horse per month; **boarding · bedding · feed · supplements · medications · vet · farrier · other+note**; annual = the sum of the months. ⚠️ **A blank line is NOT zero**, and the surface must show which horses have **no sheet** for a closed month | nothing — **ORCH6/7 to spec** |
| **CR-86 gap 1** | services delivered and never recorded | ⚠️ **his data pass, not code** (D30 — after the refactor) |
| **CR-88** | marketing planning · the campaign builder · financial analysis | ⚠️ **his answer on campaign BUDGET and company-expense categories** — §5 of `ORCH6-BRIEF.md`. **The campaign builder's measurement side already exists (`contacts.client_origin` / `contact_channel`, `TASK-ORIGIN`) — do NOT build a second attribution vocabulary (D18)** |

# ⚠️ OPEN — none of this is in any queued thread

## Needs an owner ruling
1. ✅ **CLOSED by FIX1 — the `anon` EXECUTE grant on `record_signature` / `remove_my_signature` was
   revoked and proven.** *(Migration `20260831T1200_signing_rpcs_are_not_anonymous.sql`.)* **Recorded
   here so a fifth thread does not flag it again.**
2. **Where an offering status row links to** — AR6, 138 of 200 feed rows. ⚠️ **Moot if the activity
   surfaces are gone as ruled; confirm it died with them.**

## The owner's own data pass — mechanism ready, timestamps his
3. **Madeline Do.** Records → Clients → Madeline Do → Orders → *"Their standing weekly time"* → the
   row stamped **`PUR-000319 · $880.00 · PAID`** → two days and times → Set. ⚠️ **`PUR-000230 ·
   unpaid` is the duplicate to expunge.** Proven in a rolled-back run: **26 sessions.**
   ⚠️ **He said "handled later today" on 2026-08-31 — CHECK PRODUCTION BEFORE ASKING AGAIN.**
4. ✅ **Booking `f7881be9` restored to `hello@`** — done, per the ORCH6 brief.
5. **Every other account's backdated orders, revenue attribution and lesson links.**
   ⚠️ **EXCEPT: `TASK-BOOKS1` must land before the first COMP is entered** — see its §3.

## Owner checklists not yet run
6. `docs/reports/TASK-FIX1-REPORT.md` §8 · `TASK-FIX2-REPORT.md` §9 · ⚠️ **`TASK-FIX4-REPORT.md` §11
   — 13 items, and it is the biggest visual change of the three.** **The probes prove reach and
   wiring; they cannot prove RLS, email delivery, or how it looks on his phone.**

## Known, deliberately unscheduled
7. ⚠️ **`AppLayout.tsx` never imports `pageRegistry.ts` and the two have drifted at 14 of 25 rows**
   (AR3). **Two tables of one fact.** ⚠️ **`TASK-CR85` is forbidden to deepen it and will report the
   count; the convergence itself is still its own thread.**
8. **Page visibility is unwired** — hiding a page removes no nav row, and `OpsDashboard` says it does.
9. **The availability inversion (CR-03/CR-06)** — ⚠️ **blocked: neither `request_open_time` nor
   `confirm_booking` debits a credit, so the request path books for free** (AR1).
10. **`offerings.duration_minutes` + its D21 editor** — specced by FIX2 §6.1, not built.
11. **From FIX4, flagged not fixed:** Escape still closes input-bearing dialogs *(deliberate, one line
    to change)* · `van der Berg` → `Van Der Berg` *(the rule working; worth showing him)* · the
    back-control sweep is unstarted, ~18 hand-rolled affordances remain · `TeamPage`'s `run()` closes
    the panel on every action so its "Saved." note has never been visible.
