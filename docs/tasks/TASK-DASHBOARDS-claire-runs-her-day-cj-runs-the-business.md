# TASK-DASHBOARDS — Claire runs her day, CJ runs the business

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** **APPLY YOUR WORK. Do not hold.**

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-dashboards` (**copy `.env.db` and
`.env.test` in — gitignored files do NOT propagate to a worktree**), branch `task/dashboards` ·
report to `docs/reports/TASK-DASHBOARDS-REPORT.md` · commit, **do not push** · no subagents.

---

# 1. WHY — D26, in the owner's words

> *"the logical split is Client vs Business ops… Claire… should be designated as the Owner - Head
> Trainer, she should see things related to customers… For Me (CJ)… Owner - Business Operations…
> She should live in her dashboard as the action surface she uses to manage her day/week/month."*

**`hello@fhequestrian.com` = Owner — Head Trainer. `admin@fhequestrian.com` = Owner — Business
Operations.** Same permissions, **different default emphasis.** Read **D26** in `CLAUDE.md` first.

⚠️ **THE DASHBOARD IS THE LANDING SURFACE** — shown on a fresh login **and after ~30 minutes away**.
Not a page you navigate to.

---

# 2. WHAT EXISTS — converge, do not rebuild (D18)

- **`OpsHome.tsx`** → `isAdmin ? <OpsDashboard/> : <InstructorHome/>`, mounted at **`/app/ops`**.
  ⚠️ **`/app/ops` has NO nav row** — it is URL-only (walkthrough W12, still open). **Fixing that
  reach is part of this task.**
- `OpsDashboard.tsx` already has RLS-scoped KPI tiles (inbound work waiting, documents awaiting
  signature) and a tile registry — **extend it, do not replace it.**
- `DashboardPanel.tsx`, `pageRegistry.ts`, `AppLayout.tsx` nav arrays.
- **Today's new readers:** `lesson_plans_for_day`, `lesson_plan_next_up`, `lesson_plan_roster`,
  `client_standing_slots`, `contract_change_requests_list`.

---

# 3. THE WORK

## §1 — the role designation
A designation on the company accounts — **Head Trainer** or **Business Operations** — that the
dashboard reads. ⚠️ **D13/D21: the owner must be able to change it himself**, not through a
migration. ⚠️ **It selects emphasis, never capability** — permissions are unchanged and identical.

## §2 — Claire's dashboard (Head Trainer)
Her working surface for the day/week/month:
**today's and this week's scheduled Riding Lessons, each with its plan** (`lesson_plans_for_day`) ·
**people to reach out to** · **outstanding payments** · **new orders** · **client questions** ·
**client contributions and responses to lesson notes** · and **the stable**: horses and their
needs/appointments/schedule/usage, equipment and supplies needed or broken, and follow-ups with
vendors, suppliers, partners and customers.
⚠️ **Build what the data supports and say plainly what has no source yet** — do not invent a table
to fill a tile. **Equipment/supplies and vendor follow-ups may have no home; report that rather than
building one.**

## §3 — CJ's dashboard (Business Operations)
Business emphasis — **plus a deliberate subset of Claire's alerts and to-dos**, because the owner
wants *"a second set of eyes, or because we are working on it together."* **State which items are
mirrored and why.**

## §4 — revenue, correctly
⚠️ **Owner: revenue by week and month is a first-class dashboard number, and the calendar shows it
INACCURATELY today.** Find why the calendar's figure is wrong, state it, and put a correct one on
the dashboard. **One computation, one source — do not leave two numbers that disagree (D18).**

## §5 — the landing behaviour
Fresh login lands on the dashboard; returning after **~30 minutes** away lands there again.
⚠️ **Never trap the user** — it is a landing, not a redirect loop. **And `/app/ops` gets a real nav
row**, so it is reachable without typing a URL (D17).

## §6 — every calendar-holder gets a schedule view
⚠️ **D26: "each user with anything on a calendar needs to have a schedule view shown to them."** Not
staff-only. Confirm a member has one; build it if not.

---

# 4. OUT OF SCOPE
The full refactor's IA · redesigning the calendar · new record types (D27 is LESSONPLAN's ground) ·
the platform/tenant console (Cactai super-admin, not FHE).

# 5. THE TEST THIS MUST PASS
1. **Both accounts land on a dashboard at login**, and again after 30 minutes away.
2. **The two dashboards differ** in default content, and **the difference is data-driven** by the
   designation, not hardcoded per email address.
3. **The owner can change the designation himself**, in the app.
4. **Claire's shows today's lessons with their plans**, from real data.
5. **A revenue figure appears and is correct** — reconciled against the source, with the calendar's
   discrepancy explained.
6. **`/app/ops` has a nav row** and is reachable without typing a URL.
7. **A member with a booking has a schedule view.**
8. **Every tile with no data source is listed as such** rather than faked.
9. `typecheck` 0 · lint identical to main.

# 6. THE REACH
What each owner clicks to reach their dashboard, and what they click to change the designation.

# 7. REPORT
`docs/reports/TASK-DASHBOARDS-REPORT.md`. Lead with **what Claire sees when she opens the app.**
