# DASHBOARDS — ground-up design plan (pre-build, for owner approval)

**Status: PLAN ONLY — nothing built.** Authored 2026-08-21 against main `5f2bb5b` and
production `lrstswfxfsezdmvkvukc` (read-only recon). The owner's chat instructions
supersede `TASK-DASHBOARDS-*.md` where they conflict; conflicts and their resolutions
are listed in §8. A visual companion with full mockups of both dashboards was
published as an artifact ("Claire Runs the Day, CJ Runs the Business").

---

## 1. What the dashboards are

Two role-tuned working surfaces for the two people who run FHE, per D26:

- **Claire — Owner, Head Trainer** (`hello@`): every customer-facing operation —
  leads, orders, fulfilment, service, upselling, stable management. Her dashboard is
  **the day sheet**: the surface she lives in to run her day/week/month.
- **CJ — Owner, Business Operations** (`admin@`): business management, deals &
  contracts, tenant admin, app/website support, growth and problem tracking, and
  supporting Claire's workload visibility. His dashboard is **the business desk**.

Both are the **landing surface** (fresh login, and again after ~30 min away). The
designation selects **emphasis only, never capability** (same permissions).

**Design principles (owner-stated + derived):**
1. **Zones, not pages.** The dashboard is a stack of self-contained zones. A zone
   renders **only when it has something to show**; empty zones are absent, and a
   one-line "all quiet" footer names what's absent so silence is visible and trusted.
2. **Action surface, not report.** Every row carries its action (Mark paid, Reply,
   Approve, Plan now) or deep-links to the one surface where the action lives.
3. **One computation, one source (D18).** Every number on a dashboard is a named RPC,
   and any other surface showing that number calls the same RPC. The calendar's
   revenue tile switches to the new revenue engine — no two disagreeing figures.
4. **The app suggests the next thing.** A rule-driven suggestion engine proposes
   to-dos with deadlines and delegation ("have Claire take this while you do that"),
   so the software works the business rather than waiting to be operated. Logic
   first, AI-rankable later — no external integrations.
5. **D25 naming.** Clients' items render as *Riding Lesson*, *turnout service*,
   *clipping appointment* — never "booking".
6. **Reach is part of done (D17).** Dashboard gets a real nav row; every zone's
   click-through target is named in the build spec.

---

## 2. Claire's dashboard — zone inventory (exhaustive)

Header: greeting + date + a composed one-line day summary ("4 Riding Lessons today ·
2 payments to confirm · 3 people waiting on a reply"). KPI ribbon: **Today's
lessons · Week fill (booked/capacity) · $ awaiting confirmation · People waiting on
a reply (oldest age)**.

| # | Zone | Contents | Data source | State |
|---|------|----------|-------------|-------|
| C1 | **Today's plan** | Timeline of today: each Riding Lesson with client, horse, **plan chip** (ready / "Plan now"), client pre-lesson note indicator; horse-care services and appointments; each row opens the **Lesson Workspace** (§4) | `bookings`, `lesson_plans_for_day`, `lesson_plan_next_up`, `booking_notes`, `booking_forms` | **EXISTS** |
| C2 | **Week strip** | 7-day mini view: per-day counts, standing slots, gaps, farrier/vet dots; click → calendar | `bookings`, `client_standing_slots` | **EXISTS** |
| C3 | **Money waiting** | Payment claims to confirm (declared Zelle/cash → one-click confirm via `mark_purchase_paid`), new orders to acknowledge/schedule, unpaid aging | `purchases`, `payment_notifications`, CASHCONFIRM spine | **EXISTS** |
| C4 | **People waiting** | Client questions (requests, DMs, contract notes), scheduling requests with proposed times, reschedule/cancel notices, standing-slot changes | `requests`, `booking_change_requests`, `direct_messages`, `contract_note_messages` | **EXISTS** |
| C5 | **Leads & outreach** | New leads with response-age timer, contacted leads needing next touch, follow-ups due, win-back (no booking in N weeks), credits expiring (remind/upsell), punch-card-finishing → offer weekly slot | `requests` EXISTS; follow-ups/win-back/upsell = **task substrate + rules (NEW)** over existing bookings/credits data | **PARTIAL** |
| C6 | **Notes loop** | Past lessons missing her post-lesson notes; unread client contributions/responses; D27 prompts (clipping before/after photos) | `booking_notes`, `activity_checklists`; needs a small **seen-marker** (idiom exists: `contract_change_request_seen`) | **PARTIAL** |
| C7 | **Stable board** | Per-horse: care due today (care-plan chosen days), meds due, open health events, vet/farrier upcoming, usage/rest (rides this week), lease dates approaching | `horses`, `horse_medications`, `horse_health_events`, `bookings`, care-plan configs | **EXISTS** |
| C8 | **Supplies & equipment** | Broken/needed equipment, consumables low, shopping list, vendor follow-ups | `stable_items`, `vendors`, `resources`, `resource_lots` exist but are **empty, lack status/threshold columns, and their pages are unreachable** | **PARTIAL — needs light schema + reach** |
| C9 | **Documents & onboarding** | Unsigned required docs that block a scheduled service ("release unsigned, lesson Saturday"), invitations expiring, PENDING accounts (D8 §3) | `contact_required_documents` (query), `invitations`, `documents` | **EXISTS** |
| C10 | **To-dos & suggestions** | Today/Week/Month tabs, reminders, suggested-next cards with deadline chips + write-in, delegate to CJ | **NEW substrate** (§5) | **NEW** |
| C11 | **Community pulse** | Posts/comments needing reply or moderation, event RSVPs | `feed_posts`, `moderation_actions`, `events` | **EXISTS** |
| C12 | **Evaluations due** | New riders/horses without their initial evaluation (D27: the initial entry) | `evaluation_reports` + `clients` (query) | **EXISTS** |
| C13 | **Gifts** | Gift purchases awaiting redemption | `gifts` | **EXISTS** |

Priority order: time (C1/C2) → money (C3) → people waiting (C4/C5) → record hygiene
(C6) → stable (C7/C8) → documents (C9) → to-dos (C10) → FYI (C11–C13).

## 3. CJ's dashboard — zone inventory (exhaustive)

Header: greeting + composed summary ("Revenue $1,240 this week · 2 deals in motion ·
Claire has 6 open items, 1 overdue · 1 system fault"). KPI ribbon: **Revenue
week/month (deltas + goal pace) · New clients this month · Lead→client conversion ·
Open pipeline · App health light**.

| # | Zone | Contents | Data source | State |
|---|------|----------|-------------|-------|
| B1 | **Revenue & money** | Week/month revenue from the **one correct engine** (§6), declared-but-unconfirmed total with age, unpaid aging, receipts health | new `revenue_summary` RPC over paid `purchases`; `receipt_sends` | **NEW RPC, existing tables** |
| B2 | **Claire's plate (mirror)** | Read-only rollup of her zone counts + oldest ages + overdue highlights. **Mirrored: money items, client-response SLA breaches, anything she flags for CJ. Not mirrored: her routine execution (plans, chores) unless overdue.** | same zone readers, aggregated | **EXISTS once zones exist** |
| B3 | **Deals & contracts** | Deals by stage, docs awaiting his countersign, **proposals awaiting disposition** (D29 resolve queue), change requests, lock blockers | `deals`, `documents`, `contract_change_requests_list`, `contract_lock_blockers` | **EXISTS** |
| B4 | **Growth funnel** | Sessions → inquiries → invited → activated → first purchase, rates + trend, channel split | `requests` (channel/entry_location), `signup_attempts`, `invitations`, `purchases` EXIST; **site traffic needs `page_events` (NEW)** | **PARTIAL** |
| B5 | **App & website health** | Send-log failures, **cron dead-man tiles** (last observed effect per schedule — all five read "never" today, X1), client JS errors (**NEW beacon**), delivery holds, support queue | send logs, `document_delivery_holds`, `support_requests` EXIST; `client_errors` NEW | **PARTIAL** |
| B6 | **Activity read-back** | Unified recent stream over the five write-only ledgers (X3/D19): audit, status events, notifications, deliveries, receipts — filterable; per-client "what do they see" lives on the client record and is linked from here | `audit_logs`, `status_events`, `notifications`, `document_deliveries`, `receipt_sends` | **EXISTS (tables) / NEW (surface)** |
| B7 | **To-dos & goals** | His task tabs + delegation to Claire; **goals bound to metrics** ("10 weekly slots by Oct — 6/10", "$6k Sept — 83% pace") with progress computed from the same KPI RPCs | **NEW substrate** (§5) | **NEW** |
| B8 | **Tenant admin & catalog hygiene** | Actionable config gaps: 5 tiles with zero SKUs, 11 tiles without images, offerings missing booking config, team, page visibility | catalog tables (queries) | **EXISTS** |
| B9 | **Onboarding pipeline** | PENDING accounts aging, invitation failures, wall-stuck members | `invitations`, wall state | **EXISTS** |
| B10 | **Suggested next (business)** | Rule-driven: stale-lead escalations ("take it or hand to Claire"), catalog gaps, purge-routine readiness, etc. | **NEW engine** (§5) | **NEW** |

## 4. The Lesson Workspace (the click-through that makes C1 work)

One assembly surface per lesson (and per care service), opened from any dashboard
row, the calendar, or the client record: **the plan** (versioned, rolls forward) ·
**the chat thread** with the client (existing DM substrate; zero new messaging
machinery) · **her pre-lesson notes** · **the client's pre-lesson note/form
answers** (`booking_forms`) · **post-lesson notes from both sides**
(`booking_notes.phase`, both `author_role`s) · **activity checklist**
(`activity_checklists`, live SessionActivityForm) · **photos/video** (D27; files
spine) · **"Plan the next lesson"** (writes the next `lesson_plans` version so it's
ready before the lesson happens). Nearly everything exists as readers/components —
the work is the assembly page, its reach, and seen-markers. Horse-care variants swap
the plan for the care checklist and add the D27 clipping photo prompts.

## 5. The task & suggestion substrate (the "extra employee") — NEW

The one genuinely new subsystem, and the enabler for half the zones:

- **`ops_tasks`** — org_id, assignee_user_id, title, detail, due_at, cadence
  (none/daily/weekly/monthly), status, snoozed_until, source (`manual` |
  `suggested:<rule>` ), subject_kind/subject_id (polymorphic link: booking, request,
  purchase, horse, document, vendor…), created_by, completed_at. Reminders are tasks
  with a due time. Delegation = assignee change, visible to both.
- **`task_rules`** — rule_key, enabled, trigger event/condition, wording template,
  default due offset, default assignee **by designation**. Seeded rules include:
  lesson completed → write notes / plan next / (clipping → photo prompt, D27);
  order paid → schedule sessions; new lead → reply SLA; lead stale 48h → escalate to
  CJ's mirror; credits expiring → remind; punch card nearly spent → offer weekly
  slot; no booking in N weeks → win-back; contract signed → countersign/next doc;
  supplies below threshold → reorder.
- **`suggest_next()`** RPC evaluates enabled rules → suggestion cards. **Accepting**
  one creates the task (deadline chips + write-in; assignee toggle). Dismissing
  records the dismissal so it doesn't nag.
- **Editor (D13/D21 posture):** v1 ships a rules page — enable/disable, edit
  wording, offsets, default assignee. **The condition builder (full D21 constructor)
  is deliberately deferred and named as the follow-up** — v1 conditions are code
  behind data-declared rules. This boundary is stated up front rather than
  discovered later.
- **AI-ready by shape:** suggestions carry structured subjects, so a later LLM layer
  can rank, batch, and draft (e.g., outreach text) without schema change and without
  external integrations now.
- **`goals`** — metric_key (bound to a named KPI RPC), target, period, owner;
  progress is computed, never typed. **`kpi_daily`** — nightly snapshot rows so
  growth trends survive data churn (written by the app on first dashboard load of a
  day — NOT by a cron, per X1; a cron can take over once proven).
- **`dashboard_prefs`** — per-user zone pin/hide/reorder + quiet-zone demotion
  (D13: arrangement is owner-editable in-app).

## 6. Revenue, correctly (root cause found)

`calendar_revenue` sums `bookings.price_amount` over non-cancelled bookings in the
window. That is **scheduled value, not revenue**, wrong four ways: it counts
bookings whose purchase was never paid; it re-counts credit-covered sessions whose
package purchase was already the revenue (double count); it counts future
standing-slot sessions (D23 mints them into eternity — the further out you look, the
"richer" we get); and it recognizes at session date, not payment date.

**Fix:** one `revenue_summary(p_from, p_to)` over **paid purchases**, recognized at
payment timestamp (from the payment-status event), broken out week/month with
deltas. The dashboard KPI, the calendar tile, and any future report all call this
one RPC (D18). The old figure's meaning ("scheduled value on calendar") can survive
under its own name later if wanted — it just can't be called revenue.

## 7. Shared architecture

- **Designation:** new `profiles.dashboard_focus` (`trainer` | `business`), edited
  on the Team page by the owner (D13). Never read by any permission check.
- **Zone framework:** a zone registry in code (the proven `pageRegistry` idiom):
  key, title, reader RPC, render component, default order per designation, priority
  class. Zones self-hide at zero. `dashboard_prefs` overlays user arrangement.
- **One reader per zone** — each zone's RPC returns its rows + count in one call;
  the dashboard issues them in parallel; KPI RPCs are shared with every other
  surface showing the same number.
- **Landing:** login lands staff on `/app/dashboard`; a return after ≥30 min idle
  re-lands **once per re-entry** (guarded — deep links and in-session navigation are
  never hijacked; no loops). Members keep their Home; **member Schedule exists at
  `/app/schedule` — its nav reach gets verified/fixed in the build (D26: every
  calendar-holder has a schedule view).**
- **Reach:** "Dashboard" becomes the first staff nav row (fixes W12 `/app/ops`
  URL-only). Old `OpsDashboard`/`InstructorHome` **retire into** the new shell — no
  second dashboard left standing beside it (D18 for surfaces).

## 8. Conflicts, constraints, and honest gaps

**Conflicts resolved (owner chat supersedes task doc):**
1. Task doc says "extend OpsDashboard, do not replace"; owner says ground-up and
   don't look at the old ones. → **New shell and zones; reuse the reader RPCs and
   engines underneath (D18 is about data paths); retire the old dashboard surfaces
   into it.**
2. Task doc says "build now, do not hold"; owner says plan first, build after
   approval. → **This document.**

**Gaps that need new substrate (nothing existing covers them):**
1. **No tasks/reminders/goals tables** — §5 is new build. (`requests.checklist` is
   per-lead only.)
2. **Supplies/equipment/vendors**: tables exist, empty, no status/reorder columns,
   pages effectively unreachable. Light additive schema + reach + seeding by use.
3. **No first-party web analytics** (`page_events` beacon+table) — required for
   CJ's traffic/growth beyond inquiry counts. Build-not-buy fits the motto; ~50
   lines client-side, one table, no integration.
4. **No client error capture** (`client_errors` beacon) — required for real app
   health; today problems surface only when a human reports them.
5. **Seen/unseen markers** for notes/questions (reuse the `_seen` idiom).
6. **Designation column** + Team-page control.
7. **Trend history** (`kpi_daily`) — no snapshots exist; trends start accruing the
   day this ships.

**Standing constraints inherited, not worsened (for the record):**
- **X1 — no cron has ever run.** The dashboard computes live at load and depends on
  zero crons; CJ gets a permanent cron dead-man tile so this stops being invisible.
- **X6 — no tenant timezone.** Dashboards render in browser time (correct for the
  two owners); server-composed email text remains UTC — pre-existing defect, listed.
- **X3/D19 — write-only ledgers** — B6 is the read-back surface the app never had.
- Email tails of several flows remain unproven beyond the transactional sends
  proven 2026-08-20; nothing here adds a new email dependency.

## 9. Build phasing (each independently shippable, each spec carrying THE REACH + THE TELL)

- **Phase 1 — Foundation:** designation + Team control · landing behavior · nav row
  · zone framework + prefs · revenue engine + calendar tile switch · zones C1–C4,
  C7, C9, B1, B3, B8, B9 (existing sources) · KPI ribbons · quiet-zone footer.
- **Phase 2 — The work engine:** `ops_tasks`/`task_rules`/`suggest_next` + rules
  editor v1 · C5, C6, C10, B7 (tasks half), B10 · Lesson Workspace · seen-markers ·
  delegation · B2 mirror.
- **Phase 3 — Growth & health:** `page_events` + `client_errors` beacons ·
  `kpi_daily` · goals · B4, B5, B6.
- **Phase 4 — Stable ops:** supplies/equipment/vendor columns + reach + seeding ·
  C8 full · win-back/upsell rules · C11–C13 polish.
