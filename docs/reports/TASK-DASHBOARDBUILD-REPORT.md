# TASK-DASHBOARDBUILD — report

**Branch** `task/dashboardbuild` · **base** main `c0fd887` · committed, **not pushed**
**DB** `lrstswfxfsezdmvkvukc` (production) — **5 migrations written, dry-run, applied, verified**
**Run** Opus 5 · thinking ON · effort HIGH · no subagents (CLAUDE.md standing rule)

Two dashboards, a toggle between them, a per-account default, and one root-cause fix to
revenue. Everything below was verified against the live database and, where it is a claim
about what a person sees, against a real browser signed in as the real owner account.

---

## 0. WHAT LANDED, IN ONE PARAGRAPH

`/app/dashboard` now renders the owner dashboard for staff: a greeting, a KPI ribbon, a
visible **Head Trainer / Business Operations** toggle, and a stack of zones that render only
when they hold something — with an **all-quiet footer that names what is absent**. Sixteen
zones, each a single named RPC. The default view is `profiles.dashboard_focus`, seeded per
the owner's wording (`hello@` → Head Trainer, `admin@` → Business Operations) and **editable
in the Team page**, not in code. `revenue_summary()` replaces `calendar_revenue` as the only
revenue computation in the app; the calendar's money strip and the dashboard's revenue tile
now call it with the same window and print the identical string.

---

## 1. THE DESIGN BASIS, AND WHAT RE-VERIFICATION CHANGED

`docs/design/DASHBOARDS-GROUND-UP-PLAN.md` was read in full and is cited, not re-derived.
The task doc's warning was correct — the plan was a day old and several of its "EXISTS"
claims needed checking. What re-verification found:

| Plan claim | Status on 2026-08-22 |
|---|---|
| C1 reads `lesson_plans_for_day`, `lesson_plan_next_up`, `booking_forms` | **TRUE, and better than described** — `lesson_plans_for_day()` already joins the plan, the client, the service type and a "progress recorded" flag, and already encodes which sessions are real work via `booking_form_applies()`. C1 reuses it wholesale rather than rebuilding the query. |
| C2 reads `client_standing_slots` | **Function exists but is per-contact** (`client_standing_slots(p_contact_id)`), not a roster — unusable for a 7-day strip across all clients. The strip reads `bookings` directly and counts open slots as capacity. |
| C6 "seen-marker idiom `contract_change_request_seen` already exists" | **TRUE.** `booking_note_seen` copies its shape exactly — same columns, same PK shape, same "a row IS the fact" semantics. |
| C9 reads `contact_required_documents` | **TRUE**, and `contact_document_satisfied(contact, template_key)` is the predicate the wall already uses — reused, so the dashboard and the wall cannot disagree. |
| B8 "5 tiles with zero SKUs, 11 tiles without images" | **TRUE, and the table is `service_types`** (it carries `cover_image_url`). Live: 4 sellable tiles with zero active SKUs + 2 internal ones excluded on purpose, and 11 active tiles with no cover image. |
| B6's "four write-only ledgers" | **FIVE** — `receipt_sends` is a fifth. And `audit_logs` **has no `org_id`**, the only one of the five without one; it is scoped through its actor's profile instead, which is stated in the function header rather than hidden. |
| §6's revenue diagnosis (all four faults) | **TRUE.** Measured — see §4 below. |

---

## 2. §1B — THE VISUAL DIRECTION, AND ONE HONEST DISCREPANCY

⚠️ **§1B names design tokens this repository does not have.** It cites `--accent:#2E5B40`,
`--tan:#96702F`, a serif called *"Iowan Old Style"*, and a file
`docs/design/mockups/visual-direction-board.html`. **That file is not in the repository** —
`docs/design/mockups/` contains only `dashboards-v2-preferred.html`. And the plan's own
rendered mockup, which §1B names as the unchanged basis and which *is* committed, uses this
app's real tokens throughout: `green-800 #143321`, `gold-600 #ba9935`, the cream page, and
**Libre Caslon Text** (the app's `font-serif`; "Iowan Old Style" appears nowhere in the repo).

§1B also says **"layer, do not replace"** and **"it is already close in spirit"**, and the
substance of the ruling is three named additions. So the layering was done against the tokens
that actually exist, and the discrepancy is recorded here rather than silently reconciled.
**All three named elements are built** (`src/index.css`, the `.dash-*` block):

1. **The dawn glow** — `.dash-dawn::before`, a three-stop radial gradient (gold → rose → sky)
   at 0.20–0.30 alpha behind a 26px blur, painted on a `::before` at `z-index:-1` so it can
   never take a border, a shadow or a click. Used in exactly two places, as the ruling
   specifies: **behind the greeting** and **behind the week-fill progress ring**. Never a fill.
2. **The brass hairline** — `.dash-tile` carries `1px solid rgba(186,153,53,0.42)` instead of
   the flat `border-green-800/15` the rest of the app uses on cards, deepening to 0.72 on
   hover. One rule, so every KPI tile moves together.
3. **The serif, reserved** — `font-serif` appears on the greeting, on KPI numerals, on the
   ring's percentage and on the mirror's counts. **Nowhere in body text.**

**The optional motion pass is built too** (§1B marks it cut-first; there was time):
sticky header with `backdrop-filter: blur(14px) saturate(1.4)`; hover-lift on zone cards;
a staggered fade-in capped at 8 steps × 45ms; an animated count-up on KPI numbers; a conic
gradient for the progress ring. **`prefers-reduced-motion: reduce` neutralises every one of
them**, and the count-up additionally never re-animates on a refresh — a number re-rolling
on every poll is noise, not polish.

---

## 3. §2 — THE TOGGLE RULING, AS BUILT

| The ruling | As built |
|---|---|
| **1. Both views reachable by both accounts, always. Neither view gated by identity.** | A segmented control in the dashboard header, rendered unconditionally. `grep -rn "fhequestrian\|hello@\|admin@\|isAdmin\|isTrainer"` across every new file returns **nothing** — there is no identity check anywhere in the dashboard code. Proven in the browser: one account rendered both boards. |
| **2. A per-account SETTING decides which view is PRIMARY, keyed to the login email, stored as a real owner-editable setting — not a hardcoded email switch.** | `profiles.dashboard_focus` (`'trainer' \| 'business'`, CHECK-constrained, NULL allowed). Seeded **by email**, in the migration's own words: `hello@` → `trainer`, `admin@` → `business`. Edited through `set_dashboard_focus(user_id, focus)` — staff-gated, org-scoped, self-or-admin — from **Team → a member → "Default dashboard"**. |
| **3. The toggle persists the CHOICE for the session but does not overwrite the stored default. Only the settings screen changes the default.** | The session choice lives in `sessionStorage['fhe.dashboard.view']`. `set_dashboard_focus` has exactly **one** call site (`TeamPage.tsx`); the toggle calls nothing. The control says which state you are in: *"This is your default view."* / *"Switched for this session — your default is unchanged."* |

**The landing rule (§2.2, D26) is built and proven.** `useStaffLanding()` in
`src/lib/dashboard/landing.ts`, mounted in `AppLayout`, with the plan's two guards intact:
a fresh arrival re-lands **only from `/app` itself** (a deep link is never hijacked, and the
flag is per-tab in `sessionStorage`), and a return after ≥30 minutes of the tab not being
visible re-lands **once**, never when the dashboard is already on screen. The platform owner
is excluded (`isStaff && !isSuperAdmin`, D1a).

---

## 4. §5 — REVENUE. THE NUMBER STAFF TRUSTED WAS TEN TIMES HIGH

The plan's diagnosis was re-checked and is true four ways. **Measured against production,
2026-08-22, both functions on the same window:**

| Window | `calendar_revenue` (old) | `revenue_summary` (new) |
|---|---|---|
| August 2026 | **$15,600** | **$1,510** |
| The next twelve months | **$4,550** | **$0** |

The second row is the clearest statement of the fault: the old function reported four and a
half thousand dollars of *revenue* from sessions **that have not happened**, because D23 mints
a standing slot's sessions into eternity and every one of them carried a `price_amount`. Seven
of this tenant's eleven live purchases are unpaid, and every session hanging off them was
being counted as money earned.

**`revenue_summary(p_from, p_to)`** sums `coalesce(nullif(amount_paid,0), amount, 0)` over
`purchases` where `payment_status='paid'`, recognised at **`paid_at`** — which is authoritative
because `mark_purchase_paid` is the single writer of all three facts, and CASHCONFIRM and
ZELLECLOSE both converged on it. It returns the prior equal-length window too, so a delta needs
no second call and no second definition.

**§7.4's "identical number" is true by construction, not by luck.** The first browser run
caught the two surfaces printing **`$1,510`** and **`$1510`** — one number rendered two ways is
exactly the disagreement this task exists to remove. Both now use one formatter *and* one
window: `revenue` was deliberately **removed from `dash_business_kpis`** so the ribbon and the
calendar both call `revenue_summary` with bounds from a single client-side helper
(`src/lib/dashboard/windows.ts`). If each surface computed its own week boundary they would
agree only for as long as the database's timezone matched the viewer's — and **X6 records that
this tenant has no timezone of its own.**

`calendar_revenue` is **not dropped** (D32). It has no callers.

---

## 5. WHAT WAS BUILT

### Migrations (all applied to production, verified by query)

| File | What |
|---|---|
| `…0900_dashboardbuild_1_revenue_is_paid_money_at_payment_date.sql` | `revenue_summary(from, to)` |
| `…0910_dashboardbuild_2_a_default_view_is_a_setting_not_an_identity.sql` | `profiles.dashboard_focus` + CHECK + per-email seed + `set_dashboard_focus()` |
| `…0920_dashboardbuild_3_a_note_seen_is_a_note_answered.sql` | `booking_note_seen` table + RLS + `mark_booking_note_seen()` |
| `…0930_dashboardbuild_4_the_trainer_zones_each_read_themselves.sql` | C1 C2 C3 C4 C6 C7 C9 C11 C12 C13 + `dash_trainer_kpis()` |
| `…0940_dashboardbuild_5_the_business_zones_each_read_themselves.sql` | B1 B2 B3 B6 B8 B9 + `dash_business_kpis()` |

Every reader returns the same envelope — `{ "count": n, "items": [ … ] }`, where `count` is the
**true** total and `items` may be capped — which is why the framework can hide a zone on `count`
and never on `items.length`. Every one is `SECURITY DEFINER`, `coalesce(has_staff_access(), false)`
(the D1a repair pattern), org-scoped, and revoked from `public`/`anon`.

**B2 is the one that matters architecturally.** `dash_claires_plate()` **calls**
`dash_money_waiting()`, `dash_people_waiting()` and `dash_notes_loop()` rather than re-deriving
their numbers — D18 applied to a dashboard. And it mirrors selectively, per the plan's own rule:
money and reply-time always; **routine execution only when overdue** (a write-up three days late
is the barn's problem; one due this afternoon is Claire's workflow and none of this board's
business).

### Frontend

`src/lib/ops/api-dashboard.ts` (typed seam, one wrapper per reader) ·
`src/lib/dashboard/registry.ts` (**the zone registry — order and THE REACH, the `pageRegistry`
idiom one level down**) · `src/lib/dashboard/landing.ts` · `src/lib/dashboard/windows.ts` ·
`src/lib/dashboard/format.ts` · `src/components/app/dashboard/{DashboardChrome,TrainerZones,BusinessZones}.tsx` ·
`src/pages/app/ops/OwnerDashboard.tsx` · edits to `DashboardHome`, `AppLayout`, `TeamPage`,
`CalendarPage`, `api-calendar.ts`, `index.css`.

**No URL is built in SQL.** THE REACH is decided once, in the registry, because the route table
lives in the app and a link composed in the database goes stale silently the next time a page
moves — D17's `pageRegistry` reasoning, applied to the dashboard.

**D25 is obeyed by returning codes, not prose.** The readers return `service_type`
(`RIDING_LESSON`, `HORSE_CLIPPING`); `serviceWording()` turns it into *"Riding Lesson"*,
*"Hair clipping"*, *"Turnout & exercise"*. The word "booking" appears in the rendered UI
**nowhere** — only as a table name and a variable.

**D19 governs the one value-moving control.** C3's confirm is **two clicks**, not one: the
button becomes the sentence *"Confirm $880 received from Walk4 WALKTEST?"* before anything moves,
and the write goes through `confirmPaymentClaim` → `confirm_payment_claim` → `mark_purchase_paid`
— the same spine Payment review uses (D18).

**Two new deep-link params on the calendar**, added because C1/C2/C6 all point at a specific
session and `CalendarPage` had no way to be addressed at all: `?on=YYYY-MM-DD` opens that week,
`?item=<id>` opens that session's panel once the range loads. Both optional; a stale id simply
does not open.

---

## 6. §7 — THE TEST

Run against **production Supabase** with the real app (`npx vite`), signed in as the real owner
account. Probe: `test/browser/probe-owner-dashboard.mjs` (committed). Screenshots:
`docs/reports/dashboardbuild-shots/`.

| # | Test | Result |
|---|---|---|
| 1 | **Both accounts can toggle to either view, every time** | **PASS, with one honest limit.** One signed-in owner account rendered both boards and toggled freely, and there is **no identity check in any new file** (grep above) — the code cannot behave differently for the other account. **What was not done: signing in as `hello@`.** `.env.test` holds credentials for `admin@fhequestrian.com` only; Claire's password is not in this environment. Her half is proven structurally (no gate) and at the data layer (§7.2 below), not by her own session. |
| 2 | **The stored default is per-account, editable in a settings screen, and survives a toggle** | **PASS, end to end, for a second account.** As CJ: opened Team → Claire → "Default dashboard" (read `trainer`) → set `business` → Save → panel confirmed in place → **`profiles.dashboard_focus` for `hello@` verified as `business` by direct query** → restored to `trainer`. And CJ's own default stayed `business` in the database across a toggle to Head Trainer *and* a full page reload. |
| 3 | **Every listed zone renders only when it has content; empty shows the all-quiet footer** | **PASS, and it demonstrated itself.** The trainer view rendered `C1 C2 C3 C4 C6 C7 C9 C12` and printed **"All quiet: nothing to moderate · no gifts waiting to be redeemed."** — C11 and C13 are precisely the two trainer zones whose readers return 0 against live data (no moderation queue, no unredeemed gifts). Not a wall of blank cards; the two absent zones are named. |
| 4 | **`revenue_summary` is the only revenue computation; the two tiles show the identical number** | **PASS.** Dashboard `$1,510` · calendar `$1,510`. Same RPC, same window helper, same formatter. `calendar_revenue` has zero callers. |
| 5 | **Every zone's click-through lands somewhere real** | **PASS.** Every distinct `href` the rendered zones produced was navigated: 16 targets in the business view, **0 dead**. Deals, contracts, payment review, records, clients-with-`?open=`, activity — all resolved to a real page. |
| 6 | **typecheck 0 · lint identical to main · test/db diffed** | **PASS.** `typecheck` 0 errors. `lint` **46 warnings on main, 46 on the branch — diffed file-for-file and rule-for-rule, identical** (two new warnings appeared mid-build and were both removed: the shared formatters moved out of the component file, and `CalendarPage`'s `items` was memoised). `test/db`: **51 failed files / 193 failed tests on main, 51 / 193 on the branch — the failing-file set diffs to nothing.** No regression; the pre-existing red is unchanged and not this task's. |

---

## 7. §8 — THE REACH

- **The dashboard**: `/app/dashboard`. Already the **first** row of the staff nav
  (`MANAGEMENT_GROUP[0]`) and already in `pageRegistry` as `mgmt.dashboard` — no registry change
  was needed. Also arrived at automatically on fresh login and after ~30 minutes away.
- **The toggle**: on the dashboard itself, in the sticky header, directly under the greeting —
  a two-option segmented control, always visible, never gated.
- **The default-view setting**: **Team → click a member → "Default dashboard"**, a select plus a
  Save button, above the Role control. A one-line link on the dashboard header —
  *"Change my default view"* — goes straight there, so the setting is one click from the toggle
  that made you want it.

## 8. §9 — THE TELL

- **`admin@fhequestrian.com` (CJ)** signs in and lands on **Business Operations**: revenue week
  and month with deltas, new clients, open pipeline; then money that has not landed, Claire's
  plate as a mirror strip, deals & contracts, the onboarding pipeline, catalog hygiene, and the
  activity read-back.
- **`hello@fhequestrian.com` (Claire)** signs in and lands on **Head Trainer**: today's sessions
  with plan chips, the week strip, money waiting, people waiting with ages, the notes loop, the
  stable, documents & onboarding, evaluations due.
- **Either can click the other view at any time** and gets the whole board, not a preview.
- **Changing the default in Team and signing in again** lands you on the other board. Changing
  it and *only toggling* does not: the caption flips to *"Switched for this session — your
  default is unchanged."* and the stored column does not move.
- **`admin@cactai.io`** never sees either view — `DashboardHome` redirects SUPER_ADMIN to the
  platform surfaces before the dashboard is considered, and `set_dashboard_focus` refuses it on
  the org test. Its `dashboard_focus` is NULL and stays NULL (D1a).

---

## 9. FLAGGED — NOT FIXED

### 9.1 The zones §3 put out of scope (named, not silently dropped)

Every one depends on the **task & suggestion substrate** (plan §5), which is real, substantial
and deserves its own task. **None of it was half-built** — §6's trap was observed exactly.

| Zone | Why it is out |
|---|---|
| **C5 · Leads & outreach** | Follow-ups, win-back and upsell are rules over `ops_tasks`/`task_rules`, which do not exist. `requests` alone would be a worse duplicate of C4. |
| **C8 · Supplies & equipment** | `stable_items`/`vendors`/`resources` exist, are empty, have no status or threshold columns, and their pages are effectively unreachable. Needs light additive schema **plus** reach. |
| **C10 · To-dos & suggestions** | The substrate itself. |
| **B4 · Growth funnel** | Needs a new `page_events` table and a client beacon. |
| **B5 · App & website health** | Needs a new `client_errors` beacon. ⚠️ Its **cron dead-man tile** is the piece worth pulling forward: X1 stands — `pg_cron` is still not installed and, per the DEALAUTO follow-up, **no Vercel cron has ever run**. Nothing this task built depends on a scheduler. |
| **B7 · To-dos & goals** | Substrate + `goals` + `kpi_daily`. |
| **B10 · Suggested next** | The rule engine. |

### 9.2 Named as immediate follow-ups

- **The Lesson Workspace (plan §4).** C1 links to the session on the calendar, via the two new
  params. The assembly page — plan · thread · her notes · the client's form answers · post-lesson
  notes from both sides · checklist · photos · *"plan the next lesson"* — is the next thing to
  build, and C1 is already pointed where it will live.
- ~~**`dashboard_prefs` (per-zone pin / hide / reorder).**~~ **WITHDRAWN — this was flagged as a
  D13 gap and the owner ruled it is not one** (2026-08-22, on reading this report):
  *"The dashboard doesn't need an editor in the traditional sense. Surfaces should be fluid and
  dynamic and only shown when there is something to show."*
  **The zone framework already IS the arrangement mechanism.** A zone renders when it holds
  something and is absent when it does not, so the board reorders itself as the day changes and
  there is nothing left for a person to arrange. D13 exists to stop a tenant needing a developer
  to change a thing they own — and a surface that responds to its own data does not have that
  problem. **`dashboard_prefs` is not scheduled, not deferred, and not a gap.** Recorded against
  D13 in `CLAUDE.md` and in `registry.ts` so it is not re-proposed as unfinished work.
- **Retiring `OpsDashboard` / `InstructorHome` into the new shell.** Plan §7 says *"no second
  dashboard left standing beside it"*. `/app/dashboard` is now the staff dashboard and
  `/app/ops` has **no nav row and no link** — but it is still routed and still renders the
  2026-07-01 board plus the **module launcher**, which is the only reach to some module hubs.
  Redirecting it would remove that launcher, which is a separate decision. **Half done, and
  said so.**

### 9.3 The IA-tree proposal (§1B asks for this explicitly)

The separately-reviewed **"Proposed Information Architecture & Layout Tree"** — replacing the
top-level nav with a left rail (Today / Schedule / People / Horses / Money / Documents & Deals /
Operations / Admin→Settings) across ~122 routed surfaces, and depending on TASK-AUTHORITY
running first — **is out of scope here and was not built toward.** This task kept the existing
top nav and only used the dashboard's own already-first nav row. **It is an open item for the
owner.** Two observations for whoever picks it up: the proposal's "Today" is this task's trainer
view, which is now a real surface to design against rather than a sketch; and the document
itself is chat-only and is **not saved in the repository**, so it will need to be committed
before it can be worked from.

### 9.4 Defects found, not this task's to fix

1. **`/rest/v1/contacts?select=…display_name…` returns HTTP 400 on the Clients page.**
   `contacts` has **no `display_name` column** (verified). `src/pages/app/Admin.tsx:589` selects
   it, so the roster's contact supplement **fails on every load** of `/app/records/clients`.
   Caught by the browser probe's network log.
2. **The Community threads read returns HTTP 400.** PostgREST:
   *"Searched for a foreign key relationship between 'threads' and 'profiles' using the hint
   'threads_author_id_fkey' … no matches."* The constraint exists but points at `auth.users`,
   not `profiles`, so the embed can never resolve — **the thread list cannot load its authors,
   ever.** Fires on `/app` itself.
3. **The Team member panel closes on every successful action**, because this page defines
   `onChanged` as `setSelected(null); reload()`. Consequence: the *"Saved."* note on
   `TeamPage.tsx:~328` has **never been visible for any control on that panel** — it unmounts in
   the same tick. Right for "Demote" and "Delete", wrong for the edit controls. **Worked around
   for the one control this task owns** (the default-view save confirms in place and does not
   close), and left alone for the other four, which is a TeamPage change beyond this scope.
4. **C12 is loud because production still holds test identities.** 26 evaluations due, most of
   them `ZZZ-WALK3-TESTHORSE-*` / `WALKTEST` records. That is D1's recorded state — the test
   identities are live until the owner-run 5g purge — not a defect in the zone. It will quieten
   by itself.
5. **X6 stands.** The dashboard renders in browser time, which is correct for the two owners.
   Production's database timezone happens to be `America/Los_Angeles`, so the boundaries agree
   today; `windows.ts` exists so the two surfaces would still agree if it ever did not.

### 9.5 Repo hygiene notes

- **`test/db/fixtures/schema_snapshot.sql` was NOT regenerated.** It is one day stale already —
  DEALAUTO's eight migrations went in without regenerating it either, and this task adds no
  `test/db` test that needs the new objects. Following the existing convention deliberately, and
  saying so.
- **`test/browser/probe-owner-dashboard.mjs` is committed** alongside the two existing probes.
  Unlike them it runs against production rather than the PGlite harness — the questions §7 asks
  are about real stored settings and real revenue — and its header says so. It changes exactly
  one piece of real state (Claire's stored default, via the UI) and prints what it set.
- **Teardown:** the dev server and the browser are stopped; `playwright` was installed with
  `--no-save` and is not in `package.json`; `.env` / `.env.db` / `.env.test` are gitignored and
  were not propagated.
