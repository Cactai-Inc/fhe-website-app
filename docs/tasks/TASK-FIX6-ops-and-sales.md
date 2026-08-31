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

### ⚠️ SEVEN VIEWS IN TWO FAMILIES — the owner's full set, 2026-08-31

> *"sales is a strict focus on the numbers that relate to revenue and could encompasse some of the
> conversion and traffic kpis, marketing would be the only unmentioned role scoped dashboard and the
> thing that would be nice for me is to be able to cycle through strict views of sales, marketing,
> ops, admin. this enables me to run campaigns and see a focused view of the results and things in the
> planning stages. Sales would be similar with focus on revenue, and ops would be similar with focus
> on overall company activities; horses, supplies, staff, things related to the ongoing daily tasks.
> Admin is higher level, things like ordering the company signage, updates to the app, investigating
> issues anyone is having with the app, monitoring website issues, etc..."*

⚠️ **THIS ADDS A SEVENTH VIEW (MARKETING) AND, MORE IMPORTANTLY, SPLITS THE SET INTO TWO FAMILIES
THAT ORGANISE DIFFERENTLY. Do not model them as one flat list.**

| Family | Views | Scoped by | Held by |
|---|---|---|---|
| **BUSINESS LENSES** | **Sales · Marketing · Ops · Admin** | ⚠️ **SUBJECT** | ⚠️ **one person holds ALL FOUR and CYCLES between them** |
| **JOB ROLES** | **Trainer · Instructor · Care-taker** | **what the job touches** — horses / people | **normally ONE per person** |

**The four business lenses, in his words:**
| Lens | Focus |
|---|---|
| **Sales** | ⚠️ **strictly revenue numbers**, and *"could encompass some of the conversion and traffic KPIs"* |
| **Marketing** | **campaigns** — running them, their results, **and what is still in planning** |
| **Ops** | ⚠️ **THE OVERLAP — see above.** *"overall company activities; horses, supplies, staff, things related to the ongoing daily tasks"*, composed from every other view and shared by both owners |
| **Admin** | ⚠️ **higher level** — company signage, app updates, **investigating issues anyone is having with the app**, website monitoring |

⚠️ **THIS SUPERSEDES THE EARLIER "Ops is Claire's view, Admin is mine" NOTE.** **Ops is a business
lens the owner cycles through, not a person's board.** ⚠️ **And Claire's board is a JOB ROLE
(Trainer), not Ops.**

⚠️ **CONSEQUENCE FOR §4 AND §5:** *"investigating issues anyone is having with the app"* is **Admin's
job by his own definition** — so the **error-report inbox belongs on Admin**, and the projects/tasks
list belongs there too. **They are not "Ops-only" as §4 currently says. Correct §4 accordingly.**

⚠️ **CONSEQUENCE FOR THE TOGGLE:** *"cycle through"* is not a two-way switch. **One account holding
four lenses needs a cycler, not a binary toggle** — which is exactly why the model is a SET of held
views (§2b) and not a single stored value.

⚠️ **AND THE OVERLAP IS REAL AND MUST NOT BECOME DUPLICATION:** Sales carries conversion and traffic
KPIs; **Marketing is also about conversion.** ⚠️ **Define each KPI ONCE and register it into both
lenses** — the registry already does this. ⚠️ **Sales is REVENUE-first and Marketing is CAMPAIGN-first;
if a zone cannot be assigned to one of those two intents, ask rather than putting it in both.**

### ⚠️ OPS IS THE OVERLAP — the shared board, not a fifth lens

> *"the overlap is Ops for me and claire, that encompasses the things for
> trainer/instructor/care-taker/sales/marketing."*

⚠️ **THIS CHANGES WHAT OPS IS, NOT JUST WHO HOLDS IT.** Ops is **the shared working surface for the
owner AND Claire**, and it **spans** the other views — trainer, instructor, care-taker, sales,
marketing. **It is the union, not a sibling.**

| | |
|---|---|
| **Ops** | ⚠️ **the OVERLAP.** Held by **both** the owner and Claire. Draws from every other view |
| **Sales · Marketing · Admin** | the owner's focused lenses — he cycles between them |
| **Trainer · Instructor · Care-taker** | job roles, normally one per person |

⚠️ **SO OPS IS THE DEFAULT LANDING BOARD FOR BOTH OWNERS, and the focused views are what you switch
INTO when you want one subject at a time.** That is consistent with D26 — *"She should live in her
dashboard as the action surface she uses to manage her day/week/month"* — and with the ruling that the
dashboard is the **landing surface**, shown on a fresh login and after ~30 minutes away.

⚠️ **THE BUILD CONSEQUENCE, AND IT IS THE WHOLE REASON THIS MATTERS: OPS MUST BE COMPOSED, NEVER
AUTHORED.** If Ops is the union of the other boards, then **every zone on it already belongs to one of
them.** ⚠️ **Hand-building an Ops board duplicates six others and guarantees drift** — the exact
failure this codebase repeats. **Ops renders the zones the other views define, filtered to what has
something to show** *(D13's recorded exception: a self-arranging surface needs no arrangement
editor — "surfaces should be fluid and dynamic and only shown when there is something to show")*.

### 🔒 SETTLED — CLAIRE IS OPS, THE OWNER IS ADMIN. This is the final shape.
> *"yea shes ops im admin, in the strictest sense of it."*

⚠️ **THIS SECTION SUPERSEDES EVERY EARLIER FRAMING IN THIS FILE.** The model was refined across six
messages; **read this table and treat conflicting detail above as working notes.**

| Board | Whose | Kind |
|---|---|---|
| **Ops** | ⚠️ **CLAIRE'S HOME BOARD** | where she lives. Deep on the job-role side, a snippet of sales/marketing |
| **Admin** | ⚠️ **THE OWNER'S HOME BOARD** | its counterpart. App issues, company-level work, his projects and tasks |
| **Sales · Marketing** | the owner, **focused** | he cycles INTO them for one subject at a time |
| **Trainer · Instructor · Care-taker** | whoever holds the role | scoped to **what is assigned to them** |

⚠️ **ADMIN IS NOT ONE OF FOUR EQUAL LENSES — IT IS HIS HOME**, the way Ops is hers. **He cycles into
Sales and Marketing; he does not cycle into Admin, he lands there.**

⚠️ **THE NAMING COLLISION IS RESOLVED AND NEEDS NO RENAME.** *"Admin"* is also a **nav section**
(`TASK-FIX3` renamed Community→Admin: Moderation · Field options · Content store · Settings' five).
**These are different kinds of thing — a nav section holds configuration pages; a board is a person's
home surface — and "the Admin board" vs "the Admin section" disambiguate the way "my dashboard" does.**
⚠️ **Do NOT rename either. This was raised and settled deliberately; do not re-open it.**

**Landing:** **Claire lands on Ops. The owner lands on Admin.** ⚠️ **`profiles.dashboard_focus`
already stores exactly this** — the landing preference — **which is why §2b keeps it as a separate
fact from the SET of views an account holds.** **Live values: `business` → `admin@`, `trainer` →
`hello@`; both must migrate to the new names without either owner losing their board.**

### ⚠️ OPS IS CLAIRE'S BOARD. THE OWNER HOLDS IT ONLY TO SEE WHAT SHE SEES.
> *"if I give claire the ops view. she sees everything on the trainer/instructor/care-taker side,
> right now that is all one role and shes it, and she sees a snippet of the sales and marketing
> information. i can list all of the things to include in the ops view but that would be specifically
> for her, and my having access to it is just so i know what she sees. admin is just for me, sales and
> marketing are just for me. she isnt going to toggle between trainer, instructor, care-taker, but she
> can hire someone or someone can volunteer to help out and if we give them an app account and a role
> they get the focused view of whats assigned to them in that role, claire sees all of it in her ops
> dashboard."*

⚠️ **SUPERSEDES "the shared working surface for the owner AND Claire".** **Ops is designed FOR CLAIRE.**
The owner holds it **only to see what she sees** — ⚠️ **so when a design choice would suit him and not
her, IT IS HERS. He is an observer on this board, not a second user to compromise for.**

| View | Who | Why |
|---|---|---|
| **Ops** | **Claire** — owner holds it read-alike, to see what she sees | her whole working surface |
| **Admin · Sales · Marketing** | ⚠️ **the owner ONLY** | not Claire's; she never sees them as boards |
| **Trainer · Instructor · Care-taker** | **whoever holds that role** | a focused view of **what is assigned to them** |

### ⚠️ WHAT OPS CONTAINS — and the two halves are NOT the same depth
1. **EVERYTHING on the trainer / instructor / care-taker side.** ⚠️ **Not a snippet — all of it.**
   **Today those three are one role and Claire is it**, so Ops is currently the whole of that side.
2. **A SNIPPET of sales and marketing.** ⚠️ **Shallow, per the depth rule above.**

⚠️ **SO OPS IS DEEP ON THE JOB-ROLE SIDE AND SHALLOW ON THE BUSINESS SIDE.** **It is not uniformly
shallow, and §"Ops is the shallow layer" applies ONLY to sales and marketing.** **Do not flatten the
job-role half.**

### ⚠️ THE PART THAT DECIDES THE ARCHITECTURE — Ops AGGREGATES OTHER PEOPLE
> *"she can hire someone or someone can volunteer … if we give them an app account and a role they get
> the focused view of whats assigned to them in that role, claire sees all of it in her ops dashboard."*

⚠️ **A ROLE VIEW IS SCOPED TO WHAT IS ASSIGNED TO THAT PERSON. OPS IS SCOPED TO EVERYONE.** So the same
zone must answer two questions — *"what is assigned to me"* and *"what is assigned to anyone in this
role"*. ⚠️ **That is a PARAMETER on one zone, not two zones.** **A zone that hardcodes
`assignee = auth.uid()` cannot serve Ops, and a second copy that omits it is the drift this whole
model exists to prevent.**

⚠️ **AND IT MUST HOLD WITH ZERO OTHER STAFF.** Today Claire is the only person on that side, **so Ops
and Trainer show identical content and the aggregation looks like decoration.** **It is not — it is
what makes the first hire work without a rebuild. Build the scope parameter now; it costs almost
nothing today and everything later.**

⚠️ **CLAIRE HOLDS OPS ONLY — NOT Ops + Trainer as §"Ops is the overlap" stated.** *"she isnt going to
toggle between trainer, instructor, care-taker."* **She has no cycler. The owner has one, across Ops ·
Admin · Sales · Marketing.**

⚠️ **THE OWNER WILL SUPPLY THE OPS CONTENTS.** *"i can list all of the things to include in the ops
view."* **ASK HIM FOR THAT LIST BEFORE BUILDING THE BOARD.** Build the framework, the scope parameter
and the cycler; **do not invent Claire's zone list.**

### ⚠️ AND OPS IS THE SHALLOW LAYER — depth is what separates it from the focused views
> *"the sales and marketing view is deeper than the ops view of those categories."*

⚠️ **THIS IS WHAT MAKES "COMPOSED" WORK RATHER THAN COLLAPSE.** Ops is **not** a copy of Sales — it
is the **top layer** of Sales, Marketing and each job role, gathered in one place. **The focused view
is the same subject at greater depth.**

| | Ops shows | The focused view adds |
|---|---|---|
| **Sales** | the headline revenue number, what needs attention | the breakdown, the trend, the per-client and per-offering detail |
| **Marketing** | is a campaign running, is anything waiting | campaign results, conversion by source, what is in planning |
| **Trainer / Instructor / Care-taker** | today's horses and people, what is outstanding | the full working detail of that role |

⚠️ **SO A ZONE HAS A DEPTH, AND THE SAME ZONE APPEARS AT TWO DEPTHS — it is NOT two zones.** **Give a
zone a summary form and a full form, and let the board choose which it renders.** ⚠️ **Two separate
zone definitions for one subject is exactly the drift this composition model exists to prevent, and
it would be the easy wrong turn here.**

⚠️ **THE TEST THAT KEEPS IT HONEST: every number on Ops must be the SAME number its focused view
shows, from ONE read.** **A summary that recomputes its own figure is how `calendar_revenue` and
`revenue_summary` came to disagree by 9.7×.** **One source, two presentations.**

⚠️ **AND IT ANSWERS A QUESTION §2b LEFT OPEN:** the owner holds **Ops + Sales + Marketing + Admin**;
Claire holds **Ops + Trainer**. **Neither is "one view", so both get the cycler** — which is only
expressible if held views are a SET.

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
