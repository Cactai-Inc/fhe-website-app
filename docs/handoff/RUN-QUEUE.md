# RUN QUEUE — what to run, in what order, with what settings

**Written 2026-08-31 by ORCH5.** ⚠️ **Start at the top. Everything above the line you are on is
merged and pushed; nothing below it has started.**

---

## ▶ 1 · TASK-FIX3 — the nav, the account page, the activity surfaces

```
TASK-FIX3

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/TASK-FIX3-the-nav-and-the-admin-section.md and build it.
```
**Opus · thinking ON · effort HIGH**

**Unblocked.** `TASK-FIX2` landed the reach fix, so all 24 Clients-list people can open the record —
removing the Leads tab no longer closes the last door.
⚠️ **It owns `AppLayout.tsx` and `pageRegistry.ts` alone.** Nothing else may run beside it.
⚠️ **`Admin.tsx` went 1093 → 297 lines in FIX2** — a much smaller surface than its brief assumed.

## ▶ 2 · TASK-FIX4 — input is never lost, and closing never submits

```
TASK-FIX4

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/TASK-FIX4-input-is-never-lost.md and build it.
```
**Opus · thinking ON · effort MAX**

⚠️ **MUST RUN AFTER FIX3 MERGES, NOT BESIDE IT.** Both reach into `ContactDossierModal`'s
neighbourhood. **Rebase on FIX3.**
**MAX because it carries the persisted-draft decision** — a storage seam, not a component tweak — and
because it changes the commit trigger on a fix that shipped days ago.

## ▶ 3 · TASK-FIX6 — the dashboard becomes Ops and Sales

```
TASK-FIX6

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/TASK-FIX6-ops-and-sales.md and build it.
```
**Opus · thinking ON · effort HIGH**

⚠️ **AFTER FIX4** — the error-report form is a form, and FIX4 owns forms and modals.
⚠️ **Largely a RENAME:** `OwnerDashboard` already has two views, a toggle and a per-account default.
`business` → **Ops**, `trainer` → **Sales**. **`OpsDashboard.tsx` is the abandoned 2026-07-01
predecessor — do not resurrect it.** The genuinely new build is the error boundary and the report
loop, which extends the empty `support_requests` table rather than adding one.

## ▶ 4 · TASK-FIX5 — repo hygiene

```
TASK-FIX5

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/TASK-FIX5-repo-hygiene.md and build it.
```
**Sonnet · thinking ON · effort HIGH**

⚠️ **MUST RUN AFTER FIX3, FIX4 AND FIX6 HAVE MERGED** — it is the cleanup, so it goes last. Both cite task paths and both create worktrees in
the directory being cleaned. **Moving files under a running thread is how work is lost.**

**Sonnet, not Opus:** this is `git mv` plus reference repair, with the plan already written in
`docs/reference/DOCS-LAYOUT.md`. **The judgement was spent writing the plan; the execution is
mechanical breadth — which is exactly what Sonnet is for.** ⚠️ **The one real risk is the reference
repair across 417 files, and that is a grep, not a decision.**

## ▶ 5 · FHE-ORCH-6 — the handoff

```
FHE-ORCH-6

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/orch/ORCH6-BRIEF.md, then docs/method/00-START-HERE.md, and take over.
```
**Opus · thinking ON · effort HIGH**

⚠️ **THE PATHS ABOVE ASSUME FIX5 HAS RUN.** If ORCH6 is started before FIX5, the files are still at
`docs/handoff/ORCH6-BRIEF.md` and `docs/handoff/00-START-HERE.md`. **Use whichever exists.**

⚠️ **Its brief §0 says its own §1 is stale** — the six research threads it describes as waiting are
done, audited and merged. **ORCH6 starts with the twelve zone sweeps, then the enumerated status
document, then the ORCH7 handoff.**

**Then, per the owner:** ORCH7 the refactor · ORCH8 his hands-on UVT findings · ORCH9 the client side.

---

# ⚠️ OPEN — none of this is in any queued thread

## Needs an owner ruling
1. ⚠️ **The `anon` EXECUTE grant on `record_signature` and `remove_my_signature`.** Flagged by three
   separate threads and never ruled. **Probed 2026-08-31 and NOT exploitable** — `record_signature`
   stops at `current_contact_id()` being NULL for anon *("no contact for the signing account")*, and
   `remove_my_signature` raises *"authentication required"*. ⚠️ **It is a grant nothing needs, on the
   two functions that write signatures. Revoke it or record why it stays** — a fourth thread will
   otherwise flag it again.
2. **Where an offering status row links to** — AR6, 138 of 200 feed rows. ⚠️ **Moot if the activity
   surfaces are removed as ruled; confirm it dies with them.**

## The owner's own data pass — mechanism ready, timestamps his
3. **Madeline Do.** Records → Clients → Madeline Do → Orders → *"Their standing weekly time"* → the
   row stamped **`PUR-000319 · $880.00 · PAID`** → two days and times → Set.
   ⚠️ **`PUR-000230 · unpaid` is the duplicate to expunge.** Proven in a rolled-back run: **26
   sessions.**
4. ⚠️ **Booking `f7881be9-0a32-4d78-880e-3c2f508ab0bf`** (session 2026-08-24 14:00, still `scheduled`)
   **reads `admin@` and should read `hello@`.** The single proven instance of the instructor
   overwrite, from `audit_logs` 08-24 23:34. **FIX2 prevents recurrence; this row was never repaired.**
5. **Every other account's backdated orders, revenue attribution and lesson links** — the owner's
   stated sweep, once the fixes land.

## Owner checklists not yet run
6. **`docs/reports/TASK-FIX1-REPORT.md` §8** and **`TASK-FIX2-REPORT.md` §9** — browser checklists.
   ⚠️ **The Chromium probes prove reach and wiring. They cannot prove RLS, email delivery, or real
   data.**

## Known, deliberately unscheduled
7. ⚠️ **`AppLayout.tsx` never imports `pageRegistry.ts` and the two have drifted at 14 of 25 rows**
   (AR3). **Two tables of one fact** — the root cause under several nav symptoms. **A candidate for
   its own thread before the zone sweeps.**
8. **Page visibility is unwired** — hiding a page removes no nav row, and `OpsDashboard` says it does
   (AR3, AR4). **Its own thread.**
9. **The availability inversion (CR-03/CR-06)** — ⚠️ **blocked: neither `request_open_time` nor
   `confirm_booking` debits a credit, so the request path books for free** (AR1). **The furniture
   cron is still firing, ~12 rows/day.**
10. **`offerings.duration_minutes` + its D21 editor** — specced by FIX2 §6.1, not built. **Nothing
    records how long a service takes, and no booking is 90 minutes.**
