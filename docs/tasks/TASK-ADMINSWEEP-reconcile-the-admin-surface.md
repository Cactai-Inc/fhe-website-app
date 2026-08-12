# TASK ADMINSWEEP — the front half of a full admin refactor

**This is not a cleanup task.** Owner, 2026-08-08:

> "Collect the list of what's missing, combine it with the list of changes, and the outcome
> will be a full refactor of the admin experience — aimed at enabling admin the same way
> that we've aimed at enabling our users."

That is the goal. Everything below serves it.

## Read this before anything else

**The owner is not reporting surprises. He is specifying needs.**

An earlier revision of this doc framed three items — a business Orders page, Horse care, and
an obligations view of Lessons — as "pages the owner expected that do not exist." **That was
wrong, and the owner corrected it.** He did not expect them; he was naming what the business
requires. The distinction matters because it changes what this task is: not reconciling a
system against someone's assumptions, but **building the admin side against a stated set of
needs that has never been written down.**

**The consolidation proposal in `docs/reference/nav-icon-exercise.md` is a SHORTCUT and must
not drive this work.** It merged pages so a duplicated icon set would fit — solving a
symptom. Icons and page counts are *outputs* of knowing what admin needs, not inputs to it.
Use that document only for the settled icon assignment; treat every merge in it as a
hypothesis this task may discard.

**The user side got this attention. The admin side never did.** Onboarding, documents,
booking and community were all designed around enabling the member. No equivalent pass has
been done for the person running the business.

---

## Phase 1 — INVENTORY ONLY. Hard stop for owner review.

Do not delete, build, merge or re-icon anything in Phase 1.

### 1a. What exists

Every admin-reachable route: its nav label, its group, what it actually renders, whether it
reads real data, and whether it is reachable at all. **Include routes with no nav entry**
and **nav entries whose page is a stub** — a previous dead nav item 404'd live and was
removed 2026-08-02, so this has happened before.

### 1b. What the business needs

Not from the code — from what the business does. Categories established with the owner:

| Section | Contains |
|---|---|
| **Sales** | KPIs, plus all sales content: orders, payments, and the obligation books by service category (Lessons, Horse care) |
| **Marketing** | KPIs, plus internal posts, external posts, campaigns, planning |
| **Business / company management** | brand, account, company settings — "all that type of stuff rolls up into one page" |

### 1c. The reconciliation

Three columns: **HAVE AND KEEP** · **HAVE AND REMOVE** · **NEED AND MISSING**.

"Remove" means **removed from view, not deleted** — the standing rule from the personal-page
removal (commit `86a2c33`): keep it building, one boolean from returning, because the
platform may offer it to other tenants later.

---

## Known findings — carry these, do not re-derive

### The data layer for Sales already exists and is UNAPPLIED

`supabase/migrations/20260726090000_biz_expenses_and_financials.sql` — 16.7KB, deliberately
never applied. It creates:

`sales_summary` · `business_kpis` · `growth_summary` · `profit_and_loss` ·
`upsert_expense` · `delete_expense` · `list_expenses` · `expense_categories_list`

Backlog note: two blocking defects in it are **already fixed in-file** (MRR is windowed and
normalised to monthly value of paid recurring items; the member KPI counts non-staff members
only). It was held "until the suite ships."

**So Sales has a backend waiting. Marketing has nothing** — no campaign, post-performance or
planning surface exists.

### Three needs the owner has NAMED that have no page

Stated requirements, not discovered gaps.

- **Orders (business)** — only `/app/orders`, the personal page, now hidden from admin.
- **Horse care** — the services exist in the catalog (Exercise, Training, Turnout 1x/2x
  Weekly; Exercise/Training/Turnout Session; Bridle Path & Ears; Full Body Clip; Legs & Face
  Clip) but have no grouping, label or page.
- **The obligations view of Lessons** — today's Lessons page is `SessionsPage`, a
  day-grouped *booking board*. Credits and packages are separate pages. Nothing shows "what
  the business is carrying."

### The structural gap underneath all three

**Admin has pages for RECORDS and almost none for COMMERCE.** Contacts, horses, documents,
leads, team all have pages. What was sold, what is owed, what was collected mostly do not.
`Deals` is contracts; `Payment review` is the only money surface.

### The obligations ledger is nearly empty

`fulfillment_units` is the right source for both obligation pages — generated from
`purchase_items` by `config_kind` (`recurring` → period, `scheduled` → session), consumed by
bookings. **It holds 7 rows total, and 1 across all 12 recurring offerings.**

**Establish whether generation is firing before building anything on it.** A view over an
empty ledger looks broken rather than empty, and that would be blamed on the new page.

### Icon assignment is already settled

`docs/reference/nav-icon-exercise.md` — decided 2026-08-08, do not re-open. Two icons are
**custom and unbuilt**: Lessons (jumping horse with rider, from the logo) and Horse care
(galloping horse). **No horse artwork exists in the repo**; the only mark in code is
`public/favicon.svg`, the letters `FH`.

---

## Tabs — the owner's ruling, 2026-08-08

> "A tab is a whole new page inside of a page — quick access. The downside potentially is
> that you're rendering all of it at one time on page load, but that's not a reason to force
> everything onto its own full page that you have to wait to load when you click the link and
> navigate over to it. Tabs can be great. If we have a page that's particularly heavy and
> takes significantly more loading time than the rest, we could split it off of a tab and make
> it its own page. We'll evaluate that when we find those."

**So: default to tabs. Split a tab into its own page only when its weight demands it, and
only on evidence.** Do not pre-emptively split; do not defend a heavy tab on principle.

Where a tab is genuinely heavy, prefer **lazy-loading that tab's content on first
activation** over promoting it to a route — it keeps the grouping the owner wants and
removes the load cost he is worried about.

---

## Phase 2 — the refactor, only after owner review

Phase 1 produces the needs list. **Phase 2 designs the admin experience against it**, and is
where structure — pages, groups, tabs — is decided. Structure follows need; it is not
assumed in advance.

Sequence within Phase 2: **remove, then build, then group.** Removing first shrinks the
surface everything else reasons about. Grouping comes LAST, once it is known what actually
has to be grouped — the opposite of the shortcut this task replaces.

## Verification

1. Every admin nav entry resolves to a page that renders real data. **No stubs, no 404s.**
2. Nothing reachable that the owner marked remove.
3. Everything marked needed either exists or is listed as explicitly deferred with a reason.
4. Typecheck, lint, build clean.

## Constraints

- Own git worktree off `origin/main`, at `~/Downloads/claude-code-repo/wt-adminsweep`.
  **Never `~/Desktop`.**
- **Phase 1 writes no code.** Inventory and reconciliation only.
- `ClauseDocument.tsx` is FROZEN.
- `AppLayout.tsx` belongs to `TASK-MOBILEPASS` — **coordinate before touching it**; if the
  sweep needs nav changes, report them rather than applying them.
- **Do not apply `20260726090000_biz_expenses_and_financials.sql`** without owner sign-off.
  It was withheld deliberately.
- Removal means hidden behind a boolean, never deleted.

## Reporting

`docs/reports/TASK-ADMINSWEEP-PHASE1.md` — the three-column reconciliation, the route
inventory, and an explicit list of what you could not determine.

---

# PHASE 2 — OWNER DIRECTION, 2026-08-11

**Phase 1 is merged (`fb06d3d`). Read `docs/reports/TASK-ADMINSWEEP-PHASE1.md` first — it is
your own inventory and it is now the baseline.**

## ⚠️ M-6 IS REVERSED. WIRE THEM UP; DO NOT RETIRE THEM.

> **Owner:** *"Lets see OpsDashboard and InstructorHome wired up before we make a decision. I
> knew i asked for those and didnt get them."*

Phase 1 offered a landing surface as its cheapest win. The orchestrator's note to the owner
recommended retiring both in favour of `DashboardPanel`. **The owner has overruled that.** He
specified these, never saw them, and will not decide on something he has not looked at.

**Build the ability to evaluate them. Do not delete, retire, or gate either one.**

### What is actually true today — verified 2026-08-11

```
App.tsx:257   <Route path="ops" element={<ProtectedRoute requireStaff><OpsHome/></ProtectedRoute>} />
OpsHome.tsx:13   return isAdmin ? <OpsDashboard /> : <InstructorHome />;
```

- **`/app/ops` already renders `OpsDashboard` for an admin.** The owner can view it today by
  typing the URL. The only thing missing has ever been a nav link.
- **`InstructorHome` cannot be viewed by anyone.** It renders only for non-admin staff, and
  production `profiles.role` holds **only** `ADMIN` (2), `SUPER_ADMIN` (1) and `USER` (10) —
  **zero MANAGER or EMPLOYEE rows.** There is no account in existence that renders this page.

### Deliver, in this order

1. **A way to see `InstructorHome` without inventing an account.** A staff-gated preview route
   is the cheapest honest option. **It must be unmistakably a preview** — do not let it become a
   second real entry point, and do not fake a role or mutate anyone's `profiles.role` to achieve
   it. Say plainly in the report how a reader can tell it apart from the real thing.
2. **An assessment of each page against what it would need to be a real landing surface** —
   what it renders, what it queries, what is stale, what is empty because the data is empty
   (Phase 1's ledger finding applies directly). The owner is deciding from this.
3. **The nav entry — SPECIFIED, NOT APPLIED.** `AppLayout.tsx` belongs to `TASK-NAVMOTION`,
   which is running. **Hand the orchestrator an exact diff in the report.** One nav entry is not
   worth a conflict in a file another thread is restructuring.

### The tension you must respect, and must not resolve yourself

**`TASK-LEADCLEAN` is running right now** and is consolidating the lead surfaces onto
`DashboardPanel` (`/app/dashboard`), on the owner's ruling: *"inbound goes away. its my
management dashboard… one nav entry under management."*

**So do not make `OpsDashboard` a competing staff landing page.** Wiring it up here is **for
evaluation**, so the owner can compare it against `DashboardPanel` and choose. Building it into
a second permanent home would recreate exactly the duplication LEADCLEAN is removing.

**If your assessment concludes one of them should replace `DashboardPanel`, say so as a
recommendation with evidence. Do not implement it.** That is the owner's call and it is
downstream of LEADCLEAN landing.

## The removal candidates — X-1 through X-4

**Nothing is removed until the owner rules.** He has not yet ruled on X-1 (the duplicate
Contacts nav entry), X-2 (`/app/ops/horses`, zero references), X-3 (the dormant
`/app/ops/availability` redirect) or X-4 (two of the three horse surfaces).

**Do not execute removals in this phase.** If the owner rules mid-flight, the rule stands:
**hidden behind a boolean, never deleted** (`86a2c33`).

## Everything else Phase 1 raised

`F-1` (6 of 12 fulfillment units orphaned by ~57 hard-deleted purchases) and `F-2` (the ledger
has never been consumed — 0 of 319 bookings carry a `purchase_id`, `credit_id` or `contract_id`)
are **findings, not this phase's work.** Do not build an obligations surface on them. The owner
has ranked orders/payments/booking **last**.

## Constraints

- Same worktree and branch — `~/Downloads/claude-code-repo/wt-adminsweep`, `task/adminsweep`.
  **Rebase onto `origin/main` first**; PAGEFRAME, TITLESWEEP, LEASESET and UPLOADS/ONEAUTHOR/
  DOCQUEUE have all landed since your Phase 1 base.
- **Do not edit `AppLayout.tsx`** (NAVMOTION), **`DataTable.tsx`** (FRAMESCROLL), the documents
  queue table/page (DOCCOLS), **`DashboardPanel.tsx` or `ops/IntakePage.tsx`** (LEADCLEAN).
- **Delete nothing.**
- No staff browser session exists and you will not be given one. Report renders as
  **NOT VERIFIED** and give the owner a numbered checklist — starting with the URL for each page.
- Apply your proven work. **Do not leave it held.**

Report to `docs/reports/TASK-ADMINSWEEP-PHASE2.md`.
