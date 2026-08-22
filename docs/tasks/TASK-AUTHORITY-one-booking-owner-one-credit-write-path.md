# TASK-AUTHORITY — one booking owner, one credit write path

**Precedes every UI rebuild.** Any page rebuilt against a bookings table with three owner
columns rebuilds the ambiguity, and the credits page is a live data hazard in front of staff
today. This task removes both. It is a data-layer task with a small surface component; it is
NOT a page redesign.

Serves: D17 (reachable and correctly named), D18 (never a second write path beside a correct
engine), D19 (a value-moving action states itself, records itself, and can be undone).

---

## 1. The owner's words

> "This app is riddled with problems but i dont know which are real and which are because
> there is so much work that hasnt run yet."

> "theres literally no transparency, no safety protocols to back out of something before
> triggering it."

The walkthrough (`docs/reports/OWNER-WALKTHROUGH-2026-08-18.md`) established that the booking
owner-column split is the mechanism behind "Client A appears twice" and "I couldn't reach the
booking from her account," and that the credits page bypasses the entire credit engine.

## 2. What was measured (production, 2026-08-18; re-verified 2026-08-22 — unchanged)

Bookings, 319 rows total: 275 `status='available'`, 43 real `scheduled` (+1 at 00:00 among
them).

```
scheduled bookings by populated owner column:
  client_id only ............................ 32
  client_id + account_contact_id ............  8
  all three (+ account_user_id) .............  3
```

Any surface filtering on `account_contact_id` under-reports by ~74%. All 43 have `client_id`.
`clients.contact_id` is unique and NOT NULL, so a full backfill is a single deterministic
join.

Lesson credits, 4 rows. Three are engine-minted (offering + purchase + item, correctly
expired or period-bounded). One is the orphan: Client A, `credits_total=1`,
`credits_remaining=1`, no `offering_id`, no `purchase_id`, no `purchase_item_id`, no
`period_start`, **no `expires_at`**. It was created by the owner's test click during the
2026-08-18 session ("grant 1 credit fiasco") and represents no real entitlement.

There is no `grant_credit` or `use_credit` RPC in the database. The only credit-touching
routines are the correct engine: `_mint_credits_for_purchase_item`, `_refund_booking_credit`,
`complete_lesson_session`, `credits_roster`, and the two mint triggers. The wrong path is
entirely client-side: `api-lessons.ts:251 createLessonCredit()` (raw insert) and
`:275 consumeLessonCredit()` (read-modify-write decrement via PostgREST), wired to
`LessonCreditsPage.tsx` ("Grant credits" modal; row action "Use 1 credit" at line 283).

`audit_logs` (2,877 rows) covers documents, contacts, signatures, clients, horses, groups,
notifications, document_deliveries. It does NOT cover `lesson_credits` or `bookings`.

## 3. The ruling this task implements

**`account_contact_id` is the authoritative owner of a booking.** Rationale: `contacts` is
the person anchor of the whole identity model (~34 tables key on `contact_id`); a booking
belongs to a person, and `client_id` is one hop of indirection through a table that exists
for commercial marking, not ownership. `client_id` is retained as a legacy denormalization,
kept consistent by trigger, never read for ownership by any new code. `account_user_id`
records which login acted, not who owns; it is documentation, not authority.

⚠️ Owner sign-off required on this ruling before the migration is applied. If the owner
rules `client_id` instead, the task inverts the backfill direction and the read-side grep
target; everything else stands.

**The orphan credit is voided**, not deleted: `credits_remaining` set to 0 with an audit row
recording why. If the owner states the grant was real, the alternative is attaching
`period_start`/`expires_at` matching Client A's current allotment period — ask before
applying, default is void.

## 4. Scope

### Part A — booking ownership authority

1. Migration: backfill `account_contact_id` from `client_id → clients.contact_id` for every
   `bookings` row where it is NULL and `client_id` is not. Expect exactly 32 rows updated
   among scheduled; also cover any `available`/other rows carrying a `client_id`.
2. Migration: trigger on `bookings` INSERT/UPDATE that derives `account_contact_id` from
   `client_id` when only `client_id` is supplied, and raises if both are supplied and
   disagree. No new booking may land with NULL `account_contact_id` while carrying a
   `client_id`.
3. Grep every read of `bookings` in `src/` and `api/` for owner filtering. Repoint anything
   filtering or joining ownership through `client_id` or `account_user_id` to
   `account_contact_id`. Report each call site changed and each left alone, with why.
4. Verify the two surfaces the walkthrough proved divergent now agree: Client A's account
   page booking count equals her calendar/sessions count.

### Part B — one credit write path

5. `LessonCreditsPage` becomes a read-only ledger. Remove the "Use 1 credit" row action and
   the "Grant credits" modal. Delete `consumeLessonCredit()` and `createLessonCredit()` from
   `api-lessons.ts` (the file header's admission of the missing linkage goes with them).
   Consumption's one path is `complete_lesson_session` via SessionsPage, which already
   states, records, and debits correctly.
6. The page states its own contract: a visible line noting credits are minted by purchases
   and consumed by completing a session, with a link to the Sessions page (the completion
   surface). This is the D17 naming/reach repair in miniature — the ledger must tell staff
   where the actions live.
7. Migration: void the orphan grant per §3, one UPDATE with a proving SELECT.
8. If the owner wants ad-hoc comp grants as a real feature, that is a future `grant_credit`
   RPC with mandatory reason, period, expiry, and audit — **named here as the follow-up per
   D13, not built in this task.**

### Part C — audit coverage

9. Migration: extend the existing audit trigger mechanism to `lesson_credits` and
   `bookings`. Same mechanism as the covered tables — do not invent a second audit pattern
   (D18 applies to infrastructure too).

## 5. Out of scope — explicitly

- No calendar changes. W1–W5 (midnight rendering, month-view clicks, availability-as-items,
  "Booking" labels) are the calendar rebuild's problems and depend on this task landing
  first.
- No completion of the 43 stale bookings. That is an owner-run operational pass once the
  Sessions surface is reachable.
- No contacts/clients table merge. The duality is real debt; it is a separate ruling.
- No nav changes, no `/app/ops` registry row, no Review teardown.
- No `grant_credit` RPC (§4.8 names it as follow-up only).

## 6. Traps

- **Zero-row-update-as-success.** Supabase returns no error when RLS filters an UPDATE to
  zero rows. Every frontend write in Part B's residue goes through `assertWrote()`
  (`src/lib/writeGuard.ts`). Every migration UPDATE proves its row count in the same
  transaction.
- **The migration journal is not authoritative; the live DB is.** Read the live trigger and
  function bodies before writing the audit-extension migration — do not pattern-match from a
  migration file that may never have been applied.
- **AFTER-trigger NEW assignment does nothing.** The derive trigger in §4.2 must be BEFORE.
- **No self-contained `COMMIT;` in migrations. Never reuse another migration's temp table
  name.**
- **`anon` holds direct DML grants on several tables; RLS is the only fence.** Removing the
  client-side write functions does not by itself close the raw PostgREST write route to
  `lesson_credits`. Verify RLS on `lesson_credits` denies UPDATE/INSERT to non-staff, and
  report (do not fix here) whether a staff JWT can still write it raw — that finding feeds
  the rank-2 default-grant item on the DECIDE sheet.
- **Two FKs between `profiles` and `contacts`** produce ambiguous PostgREST embeds (the W17
  suspect). Any embed touched in Part A's repointing must carry an explicit FK hint.

## 7. Constraints

- Worktree under `~/Downloads/claude-code-repo/wt-authority`, branch `task/authority`.
- Migration discipline: dry-run in `BEGIN; … ROLLBACK;` against prod, apply, verify with a
  query, commit.
- Contended files: none known live — confirm no open thread owns `api-lessons.ts`,
  `LessonCreditsPage.tsx`, or `CalendarPage.tsx` before starting.
- Do not push. Report and stop.
- A push to `main` auto-deploys; this lands only after the orchestrator audit.

## 8. THE TEST — numbered, provable

1. `SELECT count(*) FROM bookings WHERE deleted_at IS NULL AND status='scheduled' AND account_contact_id IS NULL;` → **0**.
2. `SELECT count(*) FROM bookings WHERE account_contact_id IS NOT NULL AND client_id IS NOT NULL AND account_contact_id <> (SELECT contact_id FROM clients c WHERE c.id = bookings.client_id);` → **0**.
3. Insert a test booking supplying only `client_id` inside `BEGIN;…ROLLBACK;` → `account_contact_id` arrives populated.
4. Client A: booking count via her account surface == count via calendar/sessions query. State both numbers.
5. `grep -rn "consumeLessonCredit\|createLessonCredit" src/ api/` → **no matches**.
6. `SELECT credits_remaining, expires_at FROM lesson_credits WHERE purchase_id IS NULL;` → the orphan shows `0` (or the owner's ruled alternative), and an `audit_logs` row exists for the change.
7. A credit debit performed through SessionsPage completion produces an `audit_logs` row for `lesson_credits`; a booking update produces one for `bookings`.
8. `npm run typecheck` and `npm run lint` → 0 errors.

## 9. THE REACH

After this task: staff reach credit consumption by Records › Lessons › Sessions (complete a
session), and that is the only way. Staff reach the credit ledger at
`/app/ops/lessons/credits`, which is read-only and says so, and links to Sessions. There is
no path anywhere in the product that writes `lesson_credits` outside the engine.

## 10. THE TELL

Completing a session already shows which credit row it debits; verify the toast/confirmation
names the lesson and the remaining balance. The voided orphan is visible in the ledger as
0-remaining with its audit trail. Nothing in this task fires without stating what it did.

## 11. Report

`docs/reports/TASK-AUTHORITY-REPORT.md`. Include the flagged-not-fixed section — expected
entries: the raw-write RLS finding from §6, any owner-filter call sites deliberately left on
`client_id`, and the contacts/clients duality wherever it forced a workaround.
