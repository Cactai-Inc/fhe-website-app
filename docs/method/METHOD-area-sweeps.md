# METHOD — AREA SWEEPS: "make this area work"

**Owner-directed, 2026-08-28.** A new task shape, sitting above the change-order ledger. It exists
because of a finding the owner drew out of CR-80: **two gates on the client record were each locally
correct and the defect was their union.** One of them had already been widened once, five days
earlier, in response to his own complaint — a thread was shown one broken state and fixed exactly
that state.

> **`docs/method/ORCHESTRATOR.md` §3b already named this:** *"every task specifies a write path and proves
> that write path. No task has ever been 'make this area work.' So the seam between a correct
> function and a human who can reach it belongs to nobody."*

**This method is that missing task.** ⚠️ **The narrow scoping is the orchestrator's fault before it
is any build thread's** — threads fix what the spec shows them.

---

## 1. WHAT AN AREA SWEEP RETURNS

**The directive is one line: "make this area work."** The deliverable is not a fix, it is a
**judgement about a whole area**, in five parts:

1. **THE FINDINGS** — duplicates · conflicts · wiring gaps · missing items · stale code · bad code.
2. ⚠️ **THE FLOW INVENTORY** — *"a list of written descriptions and flows for everything that area is
   involved in or responsible for."* **In prose, not function names.** This is the part that makes
   the sweep checkable, because it states what the area is FOR independently of what it does.
3. **THE PLAN** — how the area becomes fully operational.
4. **TEST CRITERIA** — mandatory, and provable.
5. **THE DEFINITION OF SUCCESS AT TWO LEVELS** — per flow (inner), and for the area entire.

⚠️ **THE RECONCILIATION IS THE POINT.** The flow inventory is reconciled against the plan, or the
plan against the inventory, until **every flow the area is responsible for is covered by the plan.**
A plan that fixes what the sweep happened to notice is the same narrow scoping this method exists to
end.

⚠️ **A SWEEP WRITES NO CODE.** It is read-only: reports and a plan. That is what makes sweeps safely
concurrent (§4).

---

## 2. THE AREAS — twelve, derived from the codebase, not invented

**Measured 2026-08-28: 132 routes, 29 registry rows, 403 source files, 162 tables, 748 functions.**
⚠️ **132 routes against 29 nav rows is the D17 problem stated as a ratio** — most of this app is
routed and unlisted.

| # | Area | Spine it owns |
|---|---|---|
| **A1** | **Identity & the person record** | `contacts` · `profiles` · `clients` · `members` · `groups` · `invitations` · the promotion spine · Records / dossier / `Admin.tsx` |
| **A2** | **Access, tenancy & roles** | RLS across 162 tables · `org_id` scoping · `has_staff_access` · D1a platform-vs-tenant · membership gating |
| **A3** | **Catalog & the request→order spine** | `offerings` · `requests` · `purchases` · `purchase_items` · approval (CR-27, locked) · line-item editing |
| **A4** | **Money** | payments · credits · comps · discounts · receipts · revenue reporting · `status_events` as a ledger |
| **A5** | **Scheduling & the calendar** | `bookings` · availability · standing slots · durations · horse limits · the calendar surface |
| **A6** | **Fulfilment & Claire's day** | `fulfillment_units` · the day sheet · dispositions · activity and evaluation records |
| **A7** | **Contracts & documents** | templates · clauses · fields · parties · signatures · execution · supersession · authoring and signing surfaces |
| **A8** | **Horses & the stable** | horse records · intake · ownership · health · photos and files |
| **A9** | **Notifications & delivery** | email transport · `notifications` · `document_deliveries` · crons · the alert spine |
| **A10** | **Community & content** | feed · posts · moderation · messages · the content store · page copy |
| **A11** | **Admin config & the kit** | the editor · vocabularies · branding · products · `form_definitions` · page visibility · design primitives |
| **A12** | **Barn operations** | boarding agreements and charges · facilities and stalls · resources · consumption · employees · staff schedule |

**Every route and every table belongs to exactly one area.** Where two areas want the same file, the
file has ONE owner and the other area reports a diff (`ORCHESTRATOR.md` §5).

---

## 3. THE SIX STEPS, APPLIED

| Step | Who | Produces |
|---|---|---|
| **1 · The area brief** | ⚠️ **ORCH** | the boundary — routes, tables, functions the area owns; the ledger CRs that land in it; the D-rules that govern it; contended files; the deliverable's shape |
| **2 · The sweep** | **the area thread** | the five-part return of §1. **Read-only.** |
| **3 · Reconcile & lock** | **ORCH + owner** | locked plan · success criteria at both levels · test criteria |
| **4 · Design handoff** | ORCH | only where the area needs architecture — A1, A2, A3, A4, A5 do; a copy fix does not. **Say per area whether this step is skipped and why.** |
| **5 · Review design, author build handoff** | ORCH | approved design + everything build needs |
| **6 · Build, then two assessments** | thread, then **ORCH** | the thread's own report, then **my independent verification against §3's criteria.** Green both → push and merge |

⚠️ **STEP 1 IS THE ONE THAT STOPS TWELVE THREADS RETURNING TWELVE DIFFERENTLY-SHAPED REPORTS.** The
brief is a template as much as a boundary.

### ⚠️ 3b. THE RECONCILIATION THE OWNER DID NOT NAME — AND IT IS THE ONE THAT BITES

He specified **flow inventory ↔ plan, within an area.** There is a second, and it is mine:

> ⚠️ **PLAN ↔ PLAN, ACROSS AREAS.** Two sweeps will propose different fixes to the same seam —
> A1 and A3 both touch the order that provisioning creates; A4 and A5 both touch what a booking
> costs. **Twelve individually-approved plans can deadlock at build time.**

**So step 3 runs twice: once per area with the owner, then once across all areas, by me, before any
build is scheduled.**

---

## 4. ⚠️ CONSECUTIVE vs CONCURRENT — THE ANSWER TURNS ON READ vs WRITE

**A sweep is read-only. A build writes. They have opposite concurrency rules, and separating them is
the whole scheduling insight.**

| | Concurrency | Why |
|---|---|---|
| **Sweeps (step 2)** | ✅ **Concurrent, freely** | nothing is written but the sweep's own uniquely-named report. **No file contention is possible.** The only cost is the owner's time launching them and mine auditing them |
| **Builds (step 6)** | ⚠️ **Consecutive wherever they contend** | last-push-wins is how this repo has lost work before |

⚠️ **AND THE CONTENTION IS MEASURABLE, NOT GUESSED** — because step 2's deliverable includes each
area's file inventory. **After the sweeps I produce a contention matrix and derive the build order
from it.** Areas with disjoint file sets build concurrently; areas sharing a file serialize.

**Predicted hot spots, from what is already known:** `src/lib/api.ts` · `src/pages/app/Admin.tsx` ·
`src/lib/pageRegistry.ts` · `src/App.tsx` · `ContactDossierModal.tsx` · the `status_events` spine.
**A1, A3, A4 and A5 all reach into these.**

⚠️ **THEREFORE A1 BUILDS FIRST AND ALONE.** Not because it is the biggest, but because **it owns the
files every other area needs**, and D30 already names the identity/records model as first in line for
redesign. Everything downstream inherits its shape; building A3 or A4 first means building them twice.

---

## 5. ORDER OF EVENTS

**Wave 0 — calibrate on one area, end to end.**
⚠️ **Do not fan out twelve briefs before one has been through all six steps.** Twelve mis-shaped
sweeps cost more than the delay. **Pilot: A1.** It is where the owner is losing money today (CR-81 —
the $880 2× weekly plan can be sold to a brand-new contact and to nobody else), it owns the contended
files, and a brief that survives the hardest area survives anywhere. **Also Wave 0: promote the
browser harness (§6).**

**Wave 1 — sweeps fan out**, batched 3–4 at a time so the audits stay real. Concurrent, read-only.
Suggested order by dependency: **A2, A3, A5** → **A4, A7, A9** → **A6, A8, A10** → **A11, A12**.

**Wave 2 — cross-area reconciliation (§3b) and the contention matrix.** Mine. Produces the build order.

**Wave 3+ — builds**, serialized by contention, A1 first.

---

## 6. THE BROWSER HARNESS — ⚠️ IT ALREADY EXISTS. PROMOTE IT, DO NOT BUILD IT.

`test/browser/` is real, documented, and was born from exactly the failure this method exists to
prevent: **`TASK-CONTRACTWALK` reported the horse-confirmation control as "reachable and clearly
labelled" by reading the source. It was false — the control could not render at all, and no lease
could be locked or signed because of it.** D17 came out of that. It also caught a date-save bug that
**passed under jsdom and failed in Chromium.**

**Two modes, and they are not equally safe:**

| Mode | What it is | Proves | Risk |
|---|---|---|---|
| **A — shimmed** | the real page, real components, real router; the network layer swapped for payloads from **PGlite** loaded with this repo's schema | **reach · rendering · wiring** | ✅ none — no production |
| **B — live** | the actual app served by vite against **PRODUCTION Supabase**, signed in as the real owner | real data · RLS · delivery | ⚠️ **mutates production** |

**Recommendation.** **Mode A becomes the default evidence for every sweep's reach claims** — promote
it from `npm i -D playwright --no-save` improvisation to an `npm run probe` script with Chromium
pinned (it currently expects `/opt/pw-browsers`, which will not exist on a fresh machine). **Mode B
is gated to explicitly authorised, read-only runs.**

### ⚠️ 6b. THE POLICY COLLISION — THIS NEEDS AN OWNER RULING BEFORE WAVE 0

**`docs/method/ORCHESTRATOR.md` §4 states: *"No worktree gets a staff login. Threads report renders as NOT
VERIFIED and never simulate one — they end with a numbered checklist the owner runs."***

**Mode B already breaks that rule, in committed code.** `probe-owner-dashboard.mjs` signs in as the
real owner against production and, by its own header, *"changes ONE piece of real state … put it back
afterwards"* — manual restoration, on the database holding a live lease.

**So one of two things is true and the owner must say which:**
1. **The rule stands** → Mode B is retired, sweeps use Mode A only, and renders stay owner-verified.
2. **The rule is amended** → browser verification becomes sanctioned, and it needs a **non-owner test
   identity** and a **read-only default**, because the current shape puts real client data one
   selector away from a thread's typo.

⚠️ **Recommendation: (2), with a dedicated test account and read-only as the default.** The reason is
the CONTRACTWALK finding itself — **source-reading produced a confident false claim about reach, and
that is precisely what twelve area sweeps are about to produce twelve of.** But it is not worth doing
on the owner's own login against live client records.
