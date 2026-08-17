# TASK FEECHOICE — report

Staff choose the fee on a booking: apply the computed reschedule amount, pick a different
policy fee (no-show / late-start), enter a custom amount, or waive it — with a required
reason for every choice but the computed default. `booking_change_fees` (the 48h/24h/8h
schedule) is untouched; this is the per-decision override on top of it.

## 0. A note on how this landed — read before the rest

This repo runs many parallel Claude threads against the **same non-worktree `main`
checkout** at times, and this session hit that directly. Sequence, in order:

1. Everything below was built and verified in `~/Downloads/claude-code-repo/fhe-website-app`
   (the canonical checkout, branch `main`) — DB migration applied to prod, F1 (REVIEWQ
   decision surface) and F3 (standalone booking charge) built and typechecked/linted clean.
2. Mid-session, a **different concurrent thread** committed and pushed `main` (commit
   `2393f0f`, "rulings: horse one-off services mint tagged credits…") using a broad stage
   (`git add -A`-shaped) in that same shared checkout. Its commit swept up this session's
   then-uncommitted working tree along with its own unrelated work: `FeeChooser.tsx`,
   `api-calendar.ts`'s FEECHOICE additions, `CalendarPage.tsx`'s F1 wiring, and
   `supabase/migrations/20260816T2200_feechoice_fee_chooser.sql` all rode along inside a
   commit whose message never mentions FEECHOICE, alongside two of that other thread's own
   migrations and an unrelated `Lessons.tsx` copy change. **That commit is already on
   `origin/main`** (confirmed via `git fetch` + `git rev-list --left-right --count
   HEAD...origin/main` → `0 0`) — this session did not push it and did not choose that
   outcome.
3. Attempting to commit the one remaining piece (`CalendarItemPanel.tsx`'s F3 section)
   directly in that same canonical checkout hit a **pre-commit hook that blocks code
   commits outside a worktree** — the correct guardrail, which the earlier collision went
   around (the sweeping commit either predates the hook or used its override). This
   session then did what should have happened from the start: `git worktree add
   ~/Downloads/claude-code-repo/wt-feechoice -b task/feechoice origin/main`, replayed the
   one outstanding diff there, and committed it properly (`25f6792`). This report lives in
   that same worktree/branch.

**Net effect:** the feature is complete and correct (proof below), but its commit history
is split and one piece landed via someone else's unrelated commit rather than a clean
FEECHOICE one. Nothing was reverted or force-pushed. `task/feechoice` is **not pushed** —
per the task's own instruction, the orchestrator merges. The orchestrator may want to know
that `2393f0f` on `main` already carries most of this work before deciding how to land
`task/feechoice`.

## 1. What was built

**F4 — the record.** New table `booking_fee_charges`: one row per staff fee decision —
`fee_kind` (`computed` / `no_show` / `late_start_before` / `late_start_after` / `custom` /
`waived`), `policy_clause` (§6/§7), `policy_wording`, `amount`, `reason`, `decided_by`,
`decided_at`, `superseded_by`. Reason is DB-enforced (`CHECK`) for every kind except
`computed`. Corrections never mutate a settled row — `apply_booking_fee`'s `p_supersedes`
param points the old row at its replacement and voids the old charge's purchase **only if
it was still unpaid**; a paid one is left exactly as it is (D11).

**F1/F3 — the chooser.** One new RPC, `apply_booking_fee(p_booking_id, p_fee_kind,
p_change_id, p_amount, p_reason, p_supersedes)`:
- Staff-only (`has_staff_access()`).
- Resolves the amount + policy wording per `fee_kind` (computed reads `reschedule_fee()`
  and the matching `booking_change_fees` label live; named fees are the signed policy's
  fixed $75/$30/$40; custom takes a staff-entered amount).
- **Settles through the ONE existing payment spine** — inserts an ordinary `purchases` +
  `purchase_items` row (`offering_id NULL`, so none of `generate_fulfillment_units`,
  `_mint_credits_for_purchase_item`, `promote_buyer_from_offering`, or
  `attach_first_purchase_policies` do anything — verified, §3). A non-zero amount lands
  `awaiting_payment`/`unpaid`; a waiver settles immediately by calling `mark_purchase_paid`
  — **the same function every other settlement path calls**, never a bespoke write.
- Because it's an ordinary purchase, it already appears in PaymentReviewPage's
  Outstanding/Client-claims/Recently-paid buckets and on the client's own `/order/:id`
  page with **zero new frontend for settlement** — `report_my_payment` /
  `confirm_payment_claim` / `markOrderPaid` are unmodified and unaware anything is
  different about a fee purchase.

**Frontend.** One shared component, `src/components/app/FeeChooser.tsx` (radio choice +
conditional reason field + conditional custom-amount input), used at both call sites per
the task's "reuse the same chooser, do not build a second":
- `CalendarPage.tsx`'s `RequestsBar` (REVIEWQ's decision surface, F1) — the old binary
  "Approve" / "Approve + waive" pair is replaced by a "Decide" button that opens the
  chooser inline (computed amount prefilled from `r.fee_amount`); its own Apply button
  calls `apply_booking_fee` then `decide_booking_change` (unchanged, untouched) to execute
  the actual reschedule/cancel/defer. "Reject" is unchanged — a decline has no fee.
- `CalendarItemPanel.tsx` (F3) — an "Apply a fee" button on any lesson/care booking, same
  chooser with no computed amount (so only named/custom/waive show), plus a short list of
  the booking's active charges.

## 2. Traps avoided

- `booking_change_fees` was **not written** by any new code — `apply_booking_fee` only
  `SELECT`s it, to look up the computed band's label. Proven unchanged in §3/§5.
- Checked `pg_proc` before writing anything: `booking_fee_charges` and `apply_booking_fee`
  did not exist; `reschedule_fee`, `decide_booking_change`, `mark_change_fee_paid`,
  `pending_fee_candidates`, `mark_purchase_paid`, `notify_purchase_unpaid`,
  `has_staff_access` all did, with the signatures assumed. Nothing was re-applied.
- Migration has no `BEGIN`/`COMMIT`; dry-run was a real `BEGIN … ROLLBACK` against prod,
  then applied for real, then re-verified live (§3).
- `REVOKE … FROM PUBLIC, anon` + `GRANT … TO authenticated, service_role` on
  `apply_booking_fee`, then proved with `has_function_privilege()` — not inferred from the
  statement's exit code (§3).
- `assertWrote()`-equivalent: `apply_booking_fee` doesn't rely on an UPDATE's row count
  anywhere RLS could silently zero it — every write is a fresh `INSERT` it just performed,
  or `mark_purchase_paid`, which is the existing, already-hardened settlement path.
- Discovered mid-task and worked around, not fixed: a **pre-commit hook blocks code
  commits in the canonical (non-worktree) checkout** — see §0. This session's own
  uncommitted files got swept into a different thread's commit before the hook stopped a
  second such collision on this session's own remaining file.
- Did not touch `mark_change_fee_paid` / `pending_fee_candidates` / the
  `booking_change_requests.fee_reported_*` claim-at-request-time flow at all — that pair
  is dead in the UI today (`markChangeFeePaid` and `pending_fee_candidates` are called
  from nowhere in `src/`), and FEECHOICE's own task text says a fee "must settle through
  mark_purchase_paid — never a second write path," so the new mechanism deliberately does
  not extend the old one.

## 3. THE TEST THIS MUST PASS — query output

Full proof ran as two `BEGIN … ROLLBACK` transactions against **production** Postgres,
impersonating the real staff identity `admin@fhequestrian.com`
(`b45a5503-89bc-489a-b012-c7fbf5c09632`) via `request.jwt.claims` + `SET ROLE
authenticated` (the house technique — CASHCONFIRM/ZELLECLOSE reports used the same). Real
booking `a2351861-…` (client Audrey Slater) was used; nothing was left committed — see the
rollback proof at the end.

### 1–2. Staff see the computed fee and all three options; applying it charges exactly `reschedule_fee()`

```sql
select apply_booking_fee('a2351861-…','computed');
-> {"amount": 30.00, "fee_kind": "computed", "charge_id": "cae21f0b-…", "purchase_id": "6f980284-…"}

select (select amount from booking_fee_charges where fee_kind='computed' and booking_id='a2351861-…'),
       reschedule_fee(org_id, starts_at) from bookings where id='a2351861-…';
 charged | computed_live
---------+---------------
   30.00 |         30.00
```

### 3. A different policy fee charges that amount, records the reason, and its trail matches a normal charge

```sql
select apply_booking_fee('a2351861-…','no_show', NULL, NULL,
  'Client did not show and did not contact us before the scheduled start time — no-show fee applied per Company Policies §6.');
-> {"amount": 75.00, "fee_kind": "no_show", "charge_id": "321fbc89-…", "purchase_id": "dd19f225-…"}
```

Side-by-side, five charges applied to the same booking (`computed` / `no_show` /
`late_start_after` $40 / `custom` $12.34 / `waived`):

```
     fee_kind     | clause | amount |                    reason                     |  status(purch)   | payment_status
------------------+--------+--------+------------------------------------------------+-------------------+----------------
 computed         | §6     |  30.00 | (none — not required)                          | awaiting_payment  | unpaid
 no_show          | §6     |  75.00 | Client did not show… no-show fee per §6.        | awaiting_payment  | unpaid
 late_start_after | §7     |  40.00 | Contacted after start time, could not accomm.   | awaiting_payment  | unpaid
 custom           |        |  12.34 | Partial courtesy adjustment agreed by phone.    | awaiting_payment  | unpaid
 waived            |        |   0.00 | Owner approved a one-time courtesy waiver.      | paid              | paid
```

Then the `no_show` purchase was settled **through `mark_purchase_paid` directly — the
identical function CASHCONFIRM's `confirm_payment_claim` and ZELLECLOSE's auto-match both
call**:

```sql
select mark_purchase_paid(:no_show_purchase, 75, 'TEST-ZL-9911', 'zelle');  -> 'paid'

 id        | status | payment_status | amount | amount_paid | payment_method | reference    | paid_at (set) | current_status
 dd19f225… | paid   | paid           | 75.00  | 75.00       | zelle           | TEST-ZL-9911 | yes            | paid
```

Side-by-side against the `waived` purchase (settled the same call, method `'waived'`) —
**identical column shape**, both `status/payment_status = paid`, `amount_paid` set,
`paid_at` set, `current_status = paid`. Same `status_events` trigger fired for every one of
the five new purchases (`submitted` on insert; `paid` on the waived one at insert-time via
`mark_purchase_paid`) — the ordinary `trg_status_purchases` path, untouched.

### 4. Waiving records a zero charge with a reason and who decided — not silently absent

Row 5 above: `fee_kind='waived'`, `amount=0`, `reason='Owner approved a one-time courtesy
waiver.'`, `decided_by` = the staff user, settled `paid` at `$0.00` via `mark_purchase_paid`
— present in `booking_fee_charges` and as an ordinary (free) order in `purchases`, not a
row that was skipped.

### 5. A no-show fee applies with no reschedule request at all

Every call above passed `p_change_id = NULL` — `apply_booking_fee` never requires one; F3's
"Apply a fee" button on `CalendarItemPanel.tsx` calls it exactly this way.

### 6. Client can pay by Zelle or cash through the existing claim→confirm path

Not re-demonstrated live (the test booking's contact has no linked login in prod to drive
`report_my_payment` as the buyer), but structurally guaranteed rather than assumed: the
fee purchase is created with `buyer_contact_id` set and is otherwise indistinguishable from
any other `purchases` row `report_my_payment` / `confirm_payment_claim` /
`decline_payment_claim` already handle — none of those three functions were touched by this
task, and §3's proof shows the row shape matches a normal purchase exactly. **Flagging this
explicitly as NOT LIVE-VERIFIED with a real client login** — if the orchestrator wants that
leg demonstrated end-to-end, it needs a test identity with `buyer_user_id` set on a real
booking.

### 7. `booking_change_fees` is unchanged — proven before and after

```sql
-- before any apply_booking_fee call, and again after all five, inside the same transaction:
select count(*), sum(fee_amount) from booking_change_fees;
 bands | total
-------+-------
     3 | 60.00
```
Identical both times. `hours_before/fee_amount/label/active` for all three rows also
re-queried unchanged (48/$10, 24/$20, 8/$30).

### 8. Every DB claim above is query output (§3); rollback proof

```sql
ROLLBACK;
select count(*) from booking_fee_charges where booking_id='a2351861-…';  -> 0
select count(*), sum(fee_amount) from booking_change_fees;               -> 3 | 60.00
```
Nothing from the proof transactions persisted. **What IS live in prod**: the migration
itself (`CREATE TABLE booking_fee_charges`, `CREATE FUNCTION apply_booking_fee`, applied
for real, separately from the rolled-back proof calls) — confirmed via `pg_proc` /
`pg_class` and the grant checks in §2.

### Error paths (also proven, transactional, rolled back individually via `SAVEPOINT`)
- `apply_booking_fee(booking,'no_show')` with no reason → `ERROR: a reason is required for no_show`.
- `apply_booking_fee(booking,'custom', NULL, -5, 'bad amount')` → `ERROR: a non-negative amount is required for a custom fee`.
- Called as a non-staff identity → `ERROR: operator access required`.
- Superseding an already-superseded charge → `ERROR: that charge has already been superseded`.
- Supersede (correction) path: a `$12.34` custom charge corrected to `$20.00` — old row's
  `superseded_by` points at the new one, old (still-unpaid) purchase flips to `status='void'`,
  new charge is active (`superseded_by` null).

## 4. Verification

- `npm run typecheck` — 0 errors.
- `npm run typecheck:api` — 0 errors.
- `npm run lint` — 0 errors (0 new warnings from this task's files; one pre-existing
  warning on `CalendarItemPanel.tsx:152`, unrelated to this change, was there before).
- `npx vitest run test/db --maxWorkers=4` — 46/71 files failed, but **confirmed
  pre-existing**: stashed every FEECHOICE file and re-ran `value_registry.test.ts` (one of
  the failing files) against unmodified `main` — identical failures. `test/db`'s default
  `createTestDb()` loads a static `fixtures/schema_snapshot.sql` last regenerated Aug 12;
  four-plus days of since-merged migrations (including this task's) aren't baked into it.
  Not a FEECHOICE regression, not fixed here — out of scope (regenerating the shared
  snapshot is its own task; 68 files depend on it).
- Resource hygiene: this session's own `vitest`/`vite` processes exited on their own after
  each run — none left running. One `vite build` (PID 84177 at the time) was observed
  running in the canonical checkout, started by a different concurrent process — left
  untouched, not this session's to kill.

## 5. NOT VERIFIED — owner checklist

1. §6/test-item-6 above: a real client claiming payment via `report_my_payment` on a fee
   purchase, end-to-end through the UI, was not exercised live (no linked login on the test
   booking's contact). Structurally sound; not watched happen.
2. No owner-facing editor for the three named-fee amounts ($75/$30/$40) — they're fixed
   constants in `apply_booking_fee`, transcribed from the signed policy, the same way the
   48h/24h/8h schedule itself started as a migration-only value before this task's sibling
   commit loaded it into `booking_change_fees`. D13 gap, same shape as the one already
   flagged in the task doc's own TRAPS section for the schedule itself — not built here,
   flagging per that same standard rather than calling it shipped.
3. The commit-history split described in §0 — whether the orchestrator wants `2393f0f`
   left as-is (content is correct and live) or wants FEECHOICE's history cleaned up
   separately is a call this report doesn't make.
