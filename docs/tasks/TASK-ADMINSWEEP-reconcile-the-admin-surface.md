# TASK ADMINSWEEP — reconcile what admin needs against what admin has

**The sweep that was never done.** Owner, 2026-08-08:

> "We never did a full sweep for the admin side of what's needed and what we have, to
> reconcile the two and remove what we don't need or don't want to see, and build what's
> missing."

Every other admin-surface change so far has been reactive — a defect noticed, an icon
duplicated, a page found missing mid-conversation. **Three pages turned out not to exist
inside twenty minutes** of one conversation (business Orders, Horse care, and the
obligations view of Lessons). That is the symptom this task exists to end.

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

### Three pages the owner expected that do not exist

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

## Phase 2 — only after owner review

Build the reconciliation's answer. **Sequence: remove, then merge, then build.** Removing
first shrinks the surface everything else has to reason about.

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
