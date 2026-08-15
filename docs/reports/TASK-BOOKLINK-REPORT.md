# TASK-BOOKLINK REPORT — bookings linked to client + item, debited/ordered, monthly plans real

**Base:** `origin/main` @ `9f9ba9e`, worktree `~/Downloads/claude-code-repo/wt-booklink`,
branch `task/booklink`. Three migrations applied live to prod this session (dry-run in
`BEGIN…ROLLBACK` first, applied, verified with a query — every claim below is proven against
production, not simulated). **Do not push; the orchestrator merges.**

```
supabase/migrations/20260815T1500_booklink_b1b5_client_required_and_backfill.sql
supabase/migrations/20260815T1600_booklink_b2_debit_or_create.sql
supabase/migrations/20260815T1700_booklink_b4_monthly_plans.sql
```

Frontend, same worktree, not yet pushed: `src/pages/app/CalendarItemPanel.tsx`,
`src/pages/app/CalendarPage.tsx`, `src/components/app/MyLessonsContent.tsx`,
`src/lib/ops/api-calendar.ts`, `src/lib/ops/api-member.ts`, `src/lib/types.ts`.
`npm run typecheck` and `npm run lint`: 0 errors (39 pre-existing-pattern warnings, none new
except one `react-hooks/exhaustive-deps` on a pre-existing effect I didn't touch the deps of).

**No browser session exists.** Every DB claim below is a pasted query result from this session,
inside `BEGIN … ROLLBACK` for anything exploratory, applied-and-reverified for anything real.
Every render claim is listed NOT VERIFIED with a numbered owner checklist at the end.

---

# B1 — the pointer becomes required

`bookings_lesson_requires_client` CHECK, **NOT VALID**:
`kind <> 'lesson' OR is_flexible OR status IN ('draft','available','unavailable') OR client_id IS NOT NULL`.

Proven live: a `save_calendar_item` call for a committed lesson with no client is refused —

```
ERROR: new row for relation "bookings" violates check constraint "bookings_lesson_requires_client"
```

`NOT VALID` because 3 of the original 14 rows are unresolved name matches (below) — the
constraint still enforces on every future INSERT/UPDATE, including any future edit of those 3
rows; it only skips the initial full-table scan. `CalendarItemPanel.tsx` mirrors the rule
client-side (`needsClientToCommit`) so staff see "Pick the client this lesson is for — or create
one — before booking it" instead of a raw constraint error, and gained a **"+ New client"**
inline flow that calls `adminSendInvitation` (the same `ProvisionClientForm → provision_client_
invitation` spine, not a second client-creation path) and auto-selects the result.

**Scope, exactly as specified:** `kind='lesson'` only. `kind='care'` (horse-care bookings) is
untouched — the spec's own words scope B1 to lesson bookings; I didn't widen it. Worth an owner
ruling if the same notes-only gap exists on care bookings — not measured this session.

# B5 — the backfill

11 of the 14 rows linked, by booking **id** (not note text — `"Melanie 3/8"` is written on two
*different* bookings, 2026-08-07 already-linked and 2026-08-15 the NULL one; matching by id
avoided double-touching the correct pre-existing row — the exact note-drift FLOWTRACE §11 flagged):

| person | contact | client | rows |
|---|---|---|---|
| Melanie O'Mea-Smith | existing | existing (`acf50c76…`) | 6 |
| Marissa Robertson | existing | existing (`3549ec1c…`) | 1 |
| Serena Lee | existing | existing (`2c096857…`) | 1 |
| Naomi Pouliot | existing, has email | **created** `b1bf270e…` via `_ensure_client_account` | 1 |
| Hannah Dryden | existing, has email | **created** `0f27da00…` via `_ensure_client_account` | 1 |
| Gabriella Olenik | existing, **no email on file** | **created** `fecf6410…` via direct INSERT (the same write `_ensure_client_account` performs once a contact is resolved — its email-matching path is moot when the contact id is already known) | 1 |

`_ensure_client_account` called with `p_template_keys = NULL` and no categories, so its own
guard (`v_had_cats OR NOT v_existing`) skips `apply_category_documents` — no onboarding docs
assigned, no email sent, silent backfill only. Proven: `SELECT count(*)` for all 3 new client
rows above, live in prod.

**3 rows deliberately left unlinked, flagged for the owner** (never guess a link):
- **"Maddie 7/8" / "Maddie 8/8"** (`5b4ebb51…`, `a7fae8f9…`) — spec says this name "matches
  nothing." Re-checked this session: a contact **"Madeline Do" does exist with a client row**
  (`e275f036…`), and "Maddie" is a common nickname for Madeline — but a nickname match is not an
  unambiguous one. **Candidate flagged, not linked.**
- **"Audrey 2/4"** (`a2351861…`) — exactly the two candidates the spec names: Audrey Slater (has
  a client row, `13a59482…`) vs Audrey Brennan (contact only, no client row). **Owner ruling
  pending, not linked.**

# B2 — staff picks the item; the system does the accounting

New `_debit_or_create_for_booking(client, offering, purchase?, method?, mark_paid?)`, internal
(revoked from `authenticated`/`anon`, reachable only from `save_calendar_item`'s postgres-owned
context — same pattern as `_provision_purchase_for_offerings` and `_unambiguous_purchase_for_
client`). Wired into `save_calendar_item` at the same point BOOKWRITE's `_unambiguous_purchase_
for_client` fallback lived, gated identically: **only fires on a non-draft commit where nothing
was already resolved** (a re-save of an already-accounted booking carries its `purchase_id`
straight through the payload, so it never re-fires — proven by construction, not just by test).

**Three branches, all proven live this session (`BEGIN…ROLLBACK`, real client/offering ids,
reverted, then re-proven on the real `save_calendar_item` path):**

1. **Debit an existing credit** — a hand-granted 2-credit test pack went to 1 after one call.
2. **Create a new order** — Melanie, no Single Lesson credit → new $150 purchase,
   `awaiting_payment`/`unpaid`/`payment_method='zelle'`, one `lesson_credits` row minted at 1 and
   immediately decremented to 0 (this booking consumes what it just bought).
3. **Monthly/recurring offering** — two calls to book against "1x Weekly Lesson" for the same
   client return the **same purchase both times** (`same_purchase_reused = true`) — the purchase
   *is* the assignment; a second weekly lesson never double-bills. `payment_state='paid'`,
   `payment_method='cash'` landed on the purchase from the first call's staff choice.

**Cash**: no CHECK constraint exists on `purchases.payment_method` in prod (re-verified live —
only `payment_status`/`status` have one), so 'cash' needed no schema change, only a code path
that writes it. `CalendarItemPanel.tsx` gained a Payment method (Zelle/Cash) + Payment status
(Needs to be paid/Already paid) pair, shown only when this save could create a new order (hidden
on an edit that already has a `purchase_id` — no dead controls).

**`mark_purchase_paid`** (FLOWTRACE item 13: zero callers in `src/`, `service_role`-only) widened
to `authenticated`, **guarded internally** with `has_staff_access()` first (the grant alone was
never the safeguard — the function trusted the grant with no internal check, so widening it
required moving the guard inside, not just re-granting). Proven: `has_function_privilege
('authenticated', …, 'EXECUTE') = true` post-migration, function body re-read to confirm the
guard is there. No `src/` UI wired to call it as a standalone "mark paid" action yet — B2's
payment-state selector covers the "create a new order, already paid" case, but there's no
control to retroactively mark an *existing* unpaid order paid outside a fresh booking. **Flagged,
not built** — FLOWTRACE item 13 is now half-closed (staff *can* be granted the call) not fully
closed (no dedicated UI surface for it yet).

`bookings.credit_id` — a column BOOKWRITE added but never wrote — is now populated by both the
create and edit branches of `save_calendar_item`.

# B3 — client picks what they're booking against

`RequestTimePanel` (`CalendarPage.tsx`) gained "What are you booking?", sourced from a new
`myBookableItems()` read (`lesson_credits` with `credits_remaining > 0`, RLS-scoped, same pattern
`myLessonsOverview` already uses — no new RPC). Selecting an item feeds `offeringId` into
`requestOpenTime` — the parameter FLOWTRACE item 7 found already existed end-to-end but no call
site ever passed. Picker is hidden entirely when the client has no purchased items (matches
today's "Not sure — staff will help" default, doesn't regress the no-credits case).

Only `RequestTimePanel` — the "request an open time" flow — is in scope, per the spec and per
FLOWTRACE's own citation (`CalendarPage.tsx:720`). `bookOpenSlot` (claiming an already-published
flexible slot) is untouched; its own credit-matching already handles a NULL-offering slot.

# B4 — monthly plans become assignable and real

**Answering the spec's own COORDINATE flag** ("say in your report exactly how monthly
entitlements are represented and expired"): **not via `lesson_credits`.** All 12 recurring
offerings were re-queried live this session — every one has `unit_count NULL` and mints zero
credits today (`_provision_purchase_for_offerings`'s regex only matches `(\d+)-Lesson` names or
`price_unit='session'`; none of the 12 monthly SKUs qualify). This migration **never touches that
minting path**, so it cannot double-mint against whichever thread runs FLOWTRACE §8's pending
fix. Instead:

- **"The purchase of a `config_kind='recurring'` offering IS the assignment"** (spec's own
  words) — `_monthly_plan_for_client()` is a pure read over `purchases`/`purchase_items`/
  `bookings`. No new table.
- **Recurring day** lives in `purchase_items.config jsonb` as `{"recurring_day":"Mon"}` — the
  existing "per-line intent" column (re-checked live: zero rows use `config` for anything today,
  so no key collision). No new table. Settable via `set_recurring_day` (staff, or the plan's own
  client).
- **"N left this month"** = `weekly_frequency × (occurrences of recurring_day in the current
  calendar month)` minus `(this client's scheduled/completed lesson bookings against this
  purchase this calendar month)`. Both halves are date-scoped to the current month by
  construction — **there is no stored balance to carry forward**, so "no carryover" is the query
  boundary itself, not a sweep that can be skipped, run late, or double-fire.
- **`generate_monthly_lessons`** extends the `series_id` machinery `save_calendar_item` already
  uses (spec's own instruction — extend, don't duplicate) rather than reimplementing it: one
  `series_id`, one booking per remaining occurrence of the recurring day **through month-end,
  structurally** (the `generate_series` upper bound *is* month-end — there is no code path that
  can produce a date past it). Idempotent — re-running skips dates already booked.
- **Reschedule stays within the month**: `request_booking_change` (re-read live from
  `pg_get_functiondef` before editing, so the base is the *actual* current prod body, not a
  stale file copy) gained one guard — a reschedule on a booking whose purchase is a
  `config_kind='recurring'` offering may not move to a different calendar month. Proven live:
  same-month move succeeds, cross-month move raises `"monthly lessons must be used within the
  same month — no carryover to next month"`, and a **non-recurring** booking's reschedule into a
  different month is completely unaffected (control case, also proven).

Full loop proven live this session for a real client (Melanie) against a real offering (1x Weekly
Lesson, Aug 2026 has exactly 4 Fridays): before a day is set, `entitled_this_month = null`
(honest "unknown", not a wrong number); `set_recurring_day('Fri')` → `entitled = 4`;
`generate_monthly_lessons` from "today" (2026-08-15) creates the 2 remaining Fridays (21st, 28th
— the 7th/14th are correctly skipped, in the past); `used_this_month = 2`, `remaining = 2`;
re-running generates 0 more, skips 2 existing.

`MyLessonsContent.tsx` gained a monthly-plan card (offering name, recurring day, "N / M left this
month") above the punch-card credits list, via a new `my_monthly_plan()` RPC — hidden entirely
when the client has none.

---

# THE TEST THIS SPEC NAMED — status

1. **Committed lesson without a client is refused.** PROVEN (DB constraint fires; panel offers
   inline client creation instead — render **NOT VERIFIED**).
2. **Credit-backed lesson decrements the client's balance, DB-provable, calendar shows it as
   theirs.** PROVEN at the DB layer (test-pack credit 2→1; `client_id`/`account_contact_id`/
   `account_user_id` all set by the existing BOOKWRITE resolution, untouched). Calendar
   **render NOT VERIFIED.**
3. **Nothing-to-debit → an order on the purchases spine, marked needing-payment or paid, via
   zelle or cash, provable trail.** PROVEN — new $150 purchase, `payment_method='zelle'`,
   `unpaid`; separately proven `payment_method='cash'` + `paid_at IS NOT NULL` on the mark-paid
   path.
4. **Client books against a chosen purchased item; the booking records the choice.** PROVEN at
   the parameter layer (`offeringId` now reaches `request_open_time` from a real picker).
   Full click-through **NOT VERIFIED** — no browser session.
5. **Monthly-plan client has a marker, a recurring day producing calendar entries, a working
   reschedule request within the month, provably zero usable entitlement from last month.**
   PROVEN — see B4 above. "Zero from last month" is provable by absence: the entitlement query
   is scoped to `date_trunc('month', current_date)` only: no query path ever reads a prior
   month's count, so there is nothing that *could* carry over, by construction rather than by an
   expiry that has to fire correctly.
6. **Melanie's four upcoming lessons render as HERS in her own calendar.** Her 6 backfilled rows
   now carry her `client_id`, `account_contact_id`, and (where she has a profile)
   `account_user_id` — the same fields `calendar_free_busy`'s role/ownership branching reads
   (per FLOWTRACE, unchanged this session). **Render NOT VERIFIED** — no browser session; DB
   state proven (query below).
7. **Every DB claim proven by query output; every render claim NOT VERIFIED with a checklist.**
   Done — see the numbered checklist below.

```sql
-- #6 proof
SELECT id, client_id, account_contact_id, account_user_id, notes
  FROM bookings WHERE client_id = 'acf50c76-e1e1-4772-abfe-1d377bccde83' AND kind='lesson'
  ORDER BY starts_at;
-- 6 rows, all client_id = acf50c76…, all account_contact_id populated
```

---

# FLAGGED, NOT FIXED

- **"Maddie" nickname candidate (Madeline Do) and "Audrey 2/4" (Slater vs Brennan)** — 3 rows,
  owner ruling needed. See B5.
- **`mark_purchase_paid` has no standalone staff UI** — grant + guard fixed (FLOWTRACE item 13
  half-closed), but there's still no "mark this existing order paid" button outside a fresh
  booking's create-new-order path.
- **A multi-week recurring *single-lesson* series (not a monthly plan) still debits only once**
  for the whole series — `_debit_or_create_for_booking` is called once, outside the per-week
  loop, exactly like the BOOKWRITE-era `_unambiguous_purchase_for_client` call it replaces. Not a
  regression I introduced; punch-card credits aren't really the right instrument for a
  weekly-recurring series anyway (that's what B4's monthly-plan path is for) — flagging because
  the spec didn't rule on it either way.
- **Re-assigning an existing booking to a *different* purchase** (staff changes the "Assign to
  purchase" dropdown on an edit) relinks `fulfillment_units` via the existing `trg_booking_unit_
  link` trigger but does **not** reconcile `lesson_credits` (no trigger touches that ledger on
  reassignment). Out of scope for this task's dependency order; noted because B2's debit only
  ever fires on first-commit, not on reassignment.
- **`kind='care'` bookings** are outside B1's required-client rule, exactly as specified — same
  notes-only gap could exist there; not measured.
- **Ledger unification (FLOWTRACE §8)** — explicitly out of scope per this task; B4 was designed
  to be provably non-colliding with it (see the COORDINATE answer above) rather than to solve it.

# OUT OF SCOPE (per spec, untouched)

Duplicate-page merge program, the kiosk, Zelle inbound matching, the review queue beyond B2/B4's
request path, ledger unification.

---

# OWNER CHECKLIST — every render claim above, NOT VERIFIED, to run in a browser

1. Open the staff calendar, create a new lesson booking with no client selected, hit Submit —
   confirm the inline error and the "+ New client" flow both appear and work.
2. Book a lesson for a client with an existing credit — confirm their credit count visibly drops
   on their own "My Lessons" page.
3. Book a lesson for a client with nothing to debit, choose Cash / Already paid — confirm the
   order appears on their Orders page marked paid, method cash.
4. As a client, request an open time and confirm the new "What are you booking?" picker lists
   your actual purchased items and the request lands correctly.
5. Assign a client to a monthly plan (book against a recurring offering, e.g. "1x Weekly
   Lesson"), set a recurring day, click "Generate this month's sessions" — confirm the sessions
   appear on the calendar and "N left this month" is correct on their My Lessons page.
6. Request a reschedule on a monthly-plan lesson to a date in the next month — confirm it's
   refused with the no-carryover message; reschedule within the same month — confirm it works.
7. Melanie O'Mea-Smith's calendar (or the staff view of it) — confirm her 6 backfilled lessons
   show as hers, not grey "unavailable" blocks.
8. Decide "Maddie" (Madeline Do?) and "Audrey 2/4" (Slater or Brennan?) — the 2 owner rulings
   B5 left open.
