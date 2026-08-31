# TASK-FIX6 — the dashboard becomes Ops and Sales, and an error can be reported

⚠️ **BUILD TASK.** Report to `docs/reports/TASK-FIX6-REPORT.md`.

**Owner, 2026-08-31.** Read his words in §1 — they are the requirement.

---

## 1. THE REQUIREMENT, VERBATIM

> *"ops dashboard should have been the page we built out with the new dashboard views, one for me Ops,
> one for Claire, Clients. If that is not how its currently built out we need to change that, the
> toggle for showing claires view and showing CJ's view can be adjusted to show a toggle for
> Ops/Sales. Ops shows the company focused view built out for me as the manager of company processes
> and the app/support. Sales shows the client centric view of leads, orders, schedule, and payments.
> Both get a view of the financial kpis, the user growth kpis, the website traffic and lead conversion
> kpis, and a list of things needing attention at the customer level like unsigned docs, unpaid
> orders, cancellations, incomplete deliverables, etc… where they diverge is that my view shows the
> projects im working on for the company, that tasks i need to complete (like the issues found during
> UVT, additions, subtractions, reconfigurations, etc… and when someone hits an error page there needs
> to be a report button and i get the report for the error with all the information needed to know who
> it is, where it happened, what the error is, and the ability to send them an email, in app message,
> notification, etc… to ask questions or report the issue as resolved with details about the
> resolution (like if they need to retry, or if their attempt was handled by me and they are all
> set)."*

## 2. ⚠️ WHAT ALREADY EXISTS — measured 2026-08-31, and it is MOST of the rename

**He asks "if that is not how its currently built out we need to change that." Here is how it is
built out.**

| | |
|---|---|
| **`OwnerDashboard.tsx`** *(359 lines)* | ⚠️ **THE LIVE ONE.** Two views, a toggle, a per-account default. `DashboardHome.tsx:41` — `if (isStaff) return <OwnerDashboard />`. |
| **`OpsDashboard.tsx`** *(292 lines)* | ⚠️ **NOT the live dashboard.** `DashboardHome`'s own header calls it *"the 2026-07-01 OpsDashboard … left routed and untouched"* — a **predecessor**, at `/app/ops`. |
| the two views | **`TrainerZones.tsx`** and **`BusinessZones.tsx`**, with `fetchTrainerKpis` / `fetchBusinessKpis` |
| the toggle | live; the choice sits in `sessionStorage` under `fhe.dashboard.view` as `'trainer' \| 'business'` |

⚠️ **SO THE STRUCTURE HE IS ASKING FOR ALREADY EXISTS — under different names, on a different page
than he remembers.** **This is largely a RENAME plus a redistribution of zones, not a rebuild.**
⚠️ **Do NOT resurrect `OpsDashboard.tsx`.** It is the older page. **`OwnerDashboard` is the survivor;
give it the right names.** *(D18: never build a second implementation beside a working one.)*

**The mapping:** `business` → **Ops** · `trainer` → **Sales**.
⚠️ **CHECK THE MAPPING AGAINST THE ZONES BEFORE APPLYING IT.** His Sales view is *"leads, orders,
schedule, and payments"* — client-centric. **If the trainer zones are Claire's day rather than the
client pipeline, say so and propose the honest split rather than forcing the label.**

## 2b. ⚠️ THE MODEL IS PROVISIONING, NOT A DEFAULT — rewritten 2026-08-31, third and final statement

**This section was amended twice as the owner refined it. This is the settled version; ignore any
earlier framing you may have seen quoted elsewhere.**

**Owner, in sequence:**
> *"two dashboard configs so they can be toggled or only one is selected (by admin for a staff, ie:
> role scoped)"*
> *"a trainer dashboard would be a subset of the sales dashboard that claire is using … that leaves
> sales, trainer, instructor, care taker, as the four open dashboards we can build and role scope
> them"*
> *"In my admin portion of the app i need to have the ability to provision any user's view, this
> applies to me and to claire. and when things are mutually exclusive we can use a toggle when both
> are enabled."*

### THE MODEL, IN ONE SENTENCE
⚠️ **A dashboard view is PROVISIONED to an account — any number of them — and the toggle appears only
when an account holds more than one.** **It is not "two views with a default".** *"This applies to me
and to claire"* — **the owner is not exempt from his own provisioning.**

### ⚠️ WHAT ALREADY EXISTS — measured 2026-08-31, and it is more than expected
| | |
|---|---|
| **`profiles.dashboard_focus`** | the stored value. Live: `business` → `admin@fhequestrian.com`, `trainer` → `hello@fhequestrian.com` |
| **`set_dashboard_focus(p_user_id, p_focus)`** | ⚠️ **already admin-settable for ANOTHER account** — `p.user_id = auth.uid() OR coalesce(is_admin(), false)` |
| ⚠️ **`TeamPage.tsx:175`** | ⚠️ **ALREADY CALLS IT FOR ANOTHER MEMBER.** **The provisioning surface EXISTS. There is no D13 gap.** |
| the toggle | live, in `sessionStorage` under `fhe.dashboard.view` |

### ⚠️ THE ONE THING THAT BLOCKS THE WHOLE MODEL
```
CHECK (dashboard_focus IS NULL OR dashboard_focus = ANY (ARRAY['trainer','business']))
```
⚠️ **A single TEXT column with a two-value CHECK cannot express "this account holds Sales AND
Instructor".** **The column is the constraint, and it must become a SET.**

**Recommended: a `dashboard_views text[]` on `profiles`, with the value list in `lookup_options` so
the owner can add a view without a migration (D13/D21).** ⚠️ **`dashboard_focus` is RETAINED as the
landing preference — "which of my views do I open on" — because that is a genuinely different fact
from "which do I hold".** ⚠️ **Do not overload one column with both; that is this codebase's most
repeated defect.** **Migrate the two live rows so neither owner loses their board.**

### THE SIX VIEWS, AND ⚠️ WHICH TO ACTUALLY BUILD
**Named by the owner:** Ops *(Claire's)* · Admin *(his)* · Sales · Trainer · Instructor · Care-taker.

⚠️ **NAMING COLLISION — RAISE IT, DO NOT SILENTLY PICK.** **"Admin" is already a NAV SECTION** —
`TASK-FIX3` renamed Community→Admin, holding Moderation, Field options, Content store and Settings'
five pages. **A dashboard view also called Admin makes "go to Admin" ambiguous** — the same defect as
the two nav rows both labelled "Records". **Flag it and let the owner name it.**

### ⚠️ THE ROLES, DEFINED BY THE OWNER — and this CORRECTS an earlier note in this file
> *"trainer is for training horses and instructing people, instructor only gives lessons to people.
> care taker is someone who handles horses and helps with horse care services and may help a trainer
> or instructor get the horses ready or wash them after a lesson and put them in the stall."*

| Role | Works on | Does |
|---|---|---|
| **Trainer** | ⚠️ **horses AND people** | trains horses · instructs people |
| **Instructor** | **people only** | gives lessons |
| **Care-taker** | **horses only** | horse care services · prepares, washes and stalls horses for a trainer or instructor |

⚠️ **SUPERSEDES the earlier "trainer is a subset of sales" note.** With these definitions **it is
not** — **trainer, instructor and care-taker are JOB roles; Sales is a BUSINESS FUNCTION** (leads,
orders, schedule, payments). **A trainer's board is the horses and people they are working with. That
is a different lens, not a filtered Sales.**

⚠️ **THE REAL SUBSET RELATIONSHIP IS DIFFERENT, AND IT IS THE ONE TO BUILD ON:**
**INSTRUCTOR ⊂ TRAINER.** A trainer instructs people **and** trains horses; an instructor does only
the first. ⚠️ **So Instructor is Trainer minus the horse-training zones — one config, role-filtered,
which cannot drift.** **Care-taker overlaps both on the HORSE side** *(preparation, washing,
stalling)* **without training or teaching** — **it shares zones with Trainer but is not a subset of
it.**

⚠️ **THEREFORE THE ZONE MODEL IS TWO AXES, NOT ONE LIST:** **horses** and **people**. Trainer holds
both · Instructor holds people · Care-taker holds horses *(care and preparation, not training)*.
**Define each zone once against an axis and compose the boards from them** — the registry already
registers one zone into two boards. ⚠️ **Three hand-built boards that happen to share zones is the
duplication this codebase keeps producing.**

⚠️ **AND NOTE WHAT THIS MEANS FOR CLAIRE:** she trains horses **and** instructs, so she holds
**Trainer**, not Instructor. **The existing `trainer` value on `hello@fhequestrian.com` is therefore
correctly named and must survive the migration.**

⚠️ **BUILD THE FRAMEWORK FOR SIX; BUILD ONLY THE BOARDS THAT HAVE OCCUPANTS.** **There is one
instructor — Claire — which is the same fact that made an instructor picker unnecessary in `FIX2`.
Care-taker and Instructor have nobody.** **Register them as available-but-empty so they light up on
assignment.** ⚠️ **Four boards nobody occupies is exactly the pattern that produced the eight
features `ORCHESTRATOR.md` §3b lists as reachable by nothing.**

### THE TOGGLE
**Zero or one view → no toggle.** **Two or more → a toggle listing exactly what that account holds.**
⚠️ **Never a toggle offering a view the account was not provisioned.**

## 3. WHAT BOTH VIEWS SHARE — his list, and it is a real constraint

**Both Ops and Sales show:** financial KPIs · user-growth KPIs · **website traffic and lead-conversion
KPIs** · and *"a list of things needing attention at the customer level"* — unsigned documents,
unpaid orders, cancellations, incomplete deliverables.

⚠️ **A SHARED ZONE IS DEFINED ONCE AND REGISTERED TWICE.** The registry already does this — its own
comment says *"N1 is registered twice in the zone registry."* **Follow that pattern. Two copies of one
zone is the defect this codebase keeps producing.**

⚠️ **AND AUDIT EVERY KPI'S INPUTS BEFORE BUILDING IT** — `04-OPEN-QUESTIONS.md` §3, the owner's own
ruling: *"things like conversion rates, number of form submissions, $ per client … are likely not
ready to be calculated because the inputs are most likely not fully or properly implemented."*
**A metric whose input was never captured renders as a zero indistinguishable from a real zero — worse
than omitting it.** ⚠️ **Website traffic in particular: establish whether ANY traffic data reaches
this system before designing a KPI over it. If it does not, say so — do not ship an empty tile.**
**`contacts.client_origin` and `contact_channel` now exist and are the attribution inputs (TASK-ORIGIN),
but they are UNPOPULATED until the owner's backfill.**

## 4. WHERE THEY DIVERGE — Ops only

**His projects and tasks** — *"the projects im working on for the company, the tasks i need to
complete (like the issues found during UVT, additions, subtractions, reconfigurations)"*.
⚠️ **Nothing like this exists. Establish it honestly and propose the smallest real store** — this is a
work-tracking surface for one person, not a project-management product. **D13: he must be able to add,
edit and complete an item without a thread.**

## 5. ⚠️ THE ERROR REPORT — the genuinely new build

**Measured: there is NO error boundary, NO error page and NO error table anywhere.** Verified — zero
matches for `ErrorBoundary` / `componentDidCatch` across `src/`.

⚠️ **BUT `support_requests` ALREADY EXISTS AND IS EMPTY:**
`id · org_id · user_id · subject · body · status · resolved_at · resolved_by · created_at`
**0 rows, and `/app/ops/support` already has a nav row in Management.**
⚠️ **That is most of the spine. EXTEND IT — do not create a second table.** What it lacks is the
*where* and the *what*: route, error text, stack, and the user agent.

**The loop he described, in four parts:**
1. **An error page with a Report button.** ⚠️ **There is no error boundary today, so an unhandled
   error shows the browser's own failure — build the boundary, or the button has nowhere to live.**
2. **The report captures enough to act on:** who *(the signed-in account, and anonymous if not)*,
   where *(route)*, what *(message + stack)*, when, plus user agent. ⚠️ **`record_signature` had this
   exact gap — `ip` and `user_agent` accepted and always passed NULL — and it made an incident
   unsolvable for days. Capture them.**
3. **It reaches the Ops view** as a needing-attention item.
4. ⚠️ **He can reply and resolve** — *"send them an email, in app message, notification"* — and
   **record the resolution** *(retry, or handled and you are all set)*.
   ⚠️ **REUSE THE EXISTING NOTIFICATION SPINE.** Do not build a fourth delivery path. **D19: a
   value-moving or state-changing action states itself, records itself, and can be undone.**

⚠️ **PRIVACY:** an error report may carry whatever the person was typing. **Say in your report what is
captured and what is deliberately not.**

## 6. ⚠️ ONE THING THE OWNER SHOULD SEE BEFORE THIS BUILDS

**`OpsDashboard` currently tells the user page-visibility works.** ⚠️ **It does not — hiding a page
removes no nav row** (AR3, AR4, FIX3 §9). **FIX3 just gave Page visibility its first nav row, so it is
now easier to find and easier to be lied to by.** **Out of scope here — but if you touch
`OpsDashboard`, do not deepen the lie.**

## 7. OUT OF SCOPE

The nav section ORDER *(the owner is still deciding — see §8)* · page visibility *(its own thread)* ·
the metric list itself *(a spec is coming from his separate chat thread; `04-OPEN-QUESTIONS.md` §3 —
**do not author it**)* · Madeline's data · `TASK-FIX4` and `TASK-FIX5`.

## 8. CONSTRAINTS

- **Worktree `wt-fix6`, branch `task/fix6`**, from `origin/main`. ⚠️ **Copy `.env.db` and `.env` in.**
- ⚠️ **RUN AFTER `TASK-FIX4` MERGES.** FIX4 owns forms and modals; the error-report form is a form.
- ⚠️ **`AppLayout.tsx` and `pageRegistry.ts`:** you need a nav row at most. **Nothing else.**
- **Migrations:** `BEGIN; … ROLLBACK;` → apply → verify → commit.
- ⚠️ **`DROP FUNCTION` + `CREATE FUNCTION` RESETS THE ACL to the schema default, silently.** If you
  widen a signature, **restore the grants explicitly and prove it from `pg_proc.proacl`.**
- **`test:db` red is the documented baseline.** ⚠️ **Lint baseline is 46, not 48.**
- **COMMIT AS YOU GO. DO NOT PUSH.** ⚠️ **TEARDOWN: census pasted.**

## 9. THE TEST THIS MUST PASS

1. **The toggle reads Ops / Sales**, and BOTH stored keys migrate — ⚠️ **the `sessionStorage` value
   AND `profiles.dashboard_focus`, which holds `business`/`trainer` on two live accounts today.
   Neither may strand someone on a view that no longer exists.**
1b. ⚠️ **An account assigned ONE config sees no toggle**, and an account with both still toggles.
   **Prove both, and paste the `dashboard_focus` rows.**
2. **Ops shows company process, app and support. Sales shows leads, orders, schedule, payments.**
3. **Both show the shared KPI set and the needing-attention list, from ONE zone definition registered
   twice.** Paste the registry proving it is not duplicated.
4. ⚠️ **Every KPI either has a real input or is absent. Name any you refused to build and why.**
5. **Ops shows his project/task list, and he can add, edit and complete without a developer** (D13).
6. **An error page renders with a Report button** — force an error to prove it.
7. **A report captures who, where, what, when and user agent.** ⚠️ **Paste the stored row.**
8. **It appears on Ops, and can be replied to and resolved with a recorded resolution.**
9. **It extends `support_requests`; no second table.** ⚠️ State plainly that you checked.
10. `typecheck` · `typecheck:api` · lint ≤46 · `npm run build`.
11. **Renders NOT VERIFIED by you** — numbered checklist for the owner.
