# TASK ZELLECLOSE REPORT — a Zelle payment arrives and the system notices

**Base:** `origin/main` @ `cfd77d6`, working directly in
`~/Downloads/claude-code-repo/fhe-website-app` (no worktree). Real prod DB
(`db.lrstswfxfsezdmvkvukc.supabase.co`) queried directly via `psql` throughout
— every exploratory claim below ran inside `BEGIN … ROLLBACK`; every applied
change is a real, verified write, listed explicitly. **Do not push; the
orchestrator merges.**

```
supabase/migrations/20260813T1200_paylock_finalize_payment_keys_on_buyer_contact.sql   (APPLIED — see Z1; this file already existed on main, unapplied)
supabase/migrations/20260816T1400_zelleclose_paid_notify_spine.sql                     (NEW, applied)
supabase/migrations/20260816T1500_zelleclose_payment_notifications_staff_write.sql     (NEW, applied)
```

Frontend/API, same working copy, not yet pushed: `api/orders-mark-paid.ts` (new),
`api/_lib/reconcile.ts`, `src/lib/ops/api-payments.ts`,
`src/pages/app/ops/PaymentReviewPage.tsx`, `docs/NOTIFICATIONS.md`,
`workspace/zelle-poller.gs`. `npm run typecheck`, `npm run typecheck:api`, and
`npm run lint`: 0 errors (the one pre-existing lint error, in
`test/db/creditfix_mint_from_unit_count.test.ts`, is untouched by this
session — confirmed via `git status`, not in my diff).

Two new PGlite regression tests (`npm run test:db` scope), both green:
`test/db/zelleclose_paid_notify_spine.test.ts` (5/5),
`test/db/zelleclose_payment_notifications_staff_write.test.ts` (4/4). Also
re-ran `paylock_finalize_payment_buyer_keys.test.ts`,
`creditfix_mint_from_unit_count.test.ts`, `harness.smoke.test.ts` for
regressions: 31/31 green. No orphaned vitest/PGlite processes left running
(checked before and after).

---

# Z1 — the memo generator, proven end to end (and the headline finding)

**PAYLOCK's server-side migration was merged to `main` on 2026-08-13 but had
never been applied to prod.** `finalize_purchase_payment`'s live body
(`pg_get_functiondef`, read directly from prod before touching anything) was
byte-identical to the **pre-PAYLOCK** function — the `buyer_contact_id` branch
did not exist:

```sql
WHERE id = p_purchase_id AND buyer_user_id = auth.uid() AND deleted_at IS NULL
```

Confirmed no later migration reverted it (grep found only PAYLOCK's own file
touching this function, and it's the newest). There is no
`supabase_migrations.schema_migrations` table in this DB — migrations are
hand-replayed via `psql`, per this repo's own convention comments — so nothing
tracks what has actually run; this one was simply missed. **Concretely: every
one of the 3 real purchases in prod is still buyer-contact-only
(`buyer_user_id` empty), meaning every real order to date has been
un-payable by the exact mechanism PAYLOCK's report claimed was fixed.**

**Fixed — applied `20260813T1200` to prod for real** (function replacement
only; no purchase row was touched by applying it). Re-verified:
`pg_get_functiondef` now contains the `buyer_contact_id` branch (3 occurrences).

**Then proved it, end to end, against Claire Bourdon's real $1,000 order**
(`1fce288f-…`, buyer_contact_id-only, exactly the provisioned-buyer shape),
**inside `BEGIN…ROLLBACK`**:

```sql
-- as Claire (auth.uid() = d4a30809…, resolves to her contact via current_contact_id())
SELECT * FROM finalize_purchase_payment('1fce288f-6768-4479-a265-534a8ae80dd8', 'zelle');
 unique_amount |        payment_reference
---------------+---------------------------------
       1000.00 | FRENCHHERITAGEEQUESTRIAN-973960

-- buyer_user_id was backfilled (the PAYLOCK "second change") — confirmed on the row
 unique_amount | payment_reference                | buyer_user_id                        | buyer_contact_id
       1000.00 | FRENCHHERITAGEEQUESTRIAN-973960  | d4a30809-8fe7-4db8-8f13-de69df7847d7 | 8c413fd4-…

-- control: an unrelated stranger (CJ Z, a different real buyer) is still refused
SELECT * FROM finalize_purchase_payment('1fce288f-…', 'zelle');
ERROR:  purchase not found
```

`ROLLBACK` confirmed — re-queried after: Claire's real row is still
`unique_amount = NULL`, exactly as it was before this session.

**Say so loudly, per the task's own instruction: yes, keys now generate
correctly.** The reference format is also now proven for real
(`FRENCHHERITAGEEQUESTRIAN-973960` — the full brand short name, uppercased,
non-alnum stripped, not a short "FH" code), which matters for Z2 below.
Matching itself has still never been given a fair test in prod (0 purchases
have ever carried these keys), but the generator that was supposed to make
that possible **now actually can.**

---

# Z2 — the arrival path, end to end

## What exists (established, not assumed)

- **Generator**: `finalize_purchase_payment` — fixed above.
- **Matcher**: `reconcileNotification()` (`api/_lib/reconcile.ts`) — fully
  built, matches on `unique_amount` then `payment_reference`, has a
  reschedule-fee fallback, routes ambiguous/no-match/underpayment to review.
- **Trigger**: **does not operate today.** `workspace/zelle-poller.gs` is a
  reference copy of a Google Apps Script — not deployed as version-controlled
  Apps Script, no `supabase/functions/`, no `pg_cron` (`cron.job` doesn't even
  exist in this DB — extension not installed), no Vercel cron pointed at
  `/api/zelle-reconcile` (`vercel.json`'s crons: nudge, expire-holds,
  calendar-reminders, delivery-sweep only).

**Proof, not assumption**: `select count(*) from payment_notifications` = **0,
in prod, ever** — that table has existed since `20260802020000`, two weeks.
Whatever the exact state of the Apps Script account (never pasted in, pasted
but never triggered, or misconfigured), the operational fact is identical:
**nothing has ever ingested a Zelle notification.** Documented in full —
setup steps, the exact reasoning above, what "live" would take — in
`docs/NOTIFICATIONS.md` (new "Zelle payment ingestion" section). Actually
deploying the Apps Script is a Google Workspace admin action outside this
repo's reach; not attempted.

**Bug found and fixed in the reference script itself**: its reference-code
regex looked for `FH-XXXXXX`. The real generated code (see Z1) is
`FRENCHHERITAGEEQUESTRIAN-973960` — this org's `BRAND/SHORT_NAME` is not "FH".
Even fully deployed, the old regex would never have matched a real reference
typed into a Zelle memo. Now matches the general `<PREFIX>-<6 hex>` shape
instead of a hardcoded prefix.

## The review alert (the concrete gap this task named)

**Before**: the `review` branch (no match / ambiguous / underpayment /
ambiguous fee) only flipped `payment_notifications.status`. Nothing read that
column proactively — an unmatched payment was invisible until a human
happened to open the queue.

**After**: every route into `review` also calls `notify_staff('payment_review', …, '/app/ops/payments/review')`
— same channel every other payment event uses (Dashboard needs-attention band
+ Payment review, already in nav). Both review-producing branches fixed
(the main no-match/ambiguous/underpayment path, and the separate ambiguous-fee
branch inside `matchRescheduleFee`, which had the identical gap).

**A second, deeper bug found while wiring this**: `payment_notifications.org_id`
was **never set** on insert (always `NULL`). Fixed — resolved as the single
org this deployment has (same fallback this codebase's own PGlite test
harness uses for single-tenant setup). Required for the new alert to route at
all.

**A third bug found and fixed while proving the second**: staff `UPDATE`
(Dismiss) was **structurally blocked regardless of `org_id`.** Measured live,
`BEGIN…ROLLBACK`, a real staff user (`b45a5503-…`, ADMIN), `org_id` correctly
matching `current_org()` — `UPDATE` still touched 0 rows:

```
UPDATE payment_notifications SET status='matched' WHERE id = … RETURNING id, status;
UPDATE 0
```

Cause: `payment_notifications_org_boundary` is a **RESTRICTIVE** policy
(`polpermissive = false`), and the only PERMISSIVE policy on the table
(`payment_notifications_admin_read`) is `SELECT`-only. Postgres RLS denies a
command outright when no permissive policy applies to it — restrictive
policies passing is irrelevant if nothing permissive covers the command. So
`UPDATE` (and `INSERT`/`DELETE`) were unreachable for `authenticated` no
matter what `org_id` held. `dismissNotification`'s own comment in
`src/lib/ops/api-payments.ts` had already flagged the symptom ("KNOWN SERVER
GAP … staff access is read-only until an admin-write policy ships") without
diagnosing the restrictive-vs-permissive cause. New migration
`20260816T1500` adds `payment_notifications_staff_write` (permissive, `FOR
UPDATE`, `has_staff_access()`). Re-proved the same way, same transaction
pattern:

```
UPDATE payment_notifications SET status='matched' WHERE id = … RETURNING id, status;
                  id                  | status
--------------------------------------+---------
 8953a13b-d19b-45fb-8687-c9ec964fc8ae | matched
UPDATE 1
```

PGlite regression test (`zelleclose_payment_notifications_staff_write.test.ts`)
reproduces the pre-fix 0-row bug, proves the fix, and proves it does NOT
over-widen: a non-staff org member still can't dismiss, an outsider (no org)
still can't see or touch the row.

---

# Z3 — the manual half staff actually need

## One spine, not two — a real gap found and closed

**Measured**: `mark_purchase_paid` (automatic match, or any staff manual
mark-paid) notified buyer + staff. `_provision_purchase_for_offerings`
(BOOKLINK's create-and-mark-paid path — staff books a lesson, chooses
"already paid") writes the identical terminal purchase columns directly on
INSERT. `status_events` fires either way (`trg_status_purchases`, BEFORE
INSERT OR UPDATE OF `status`/`payment_status` — unconditional on those columns
changing) — but **only one of the two writers ever told anyone.** A booking
created "already paid" was paid, correctly, silently.

**Fixed**: extracted the notify side-effects into `_notify_purchase_paid(uuid)`
(new, internal, `service_role`-only), called from both `mark_purchase_paid`
and `_provision_purchase_for_offerings`'s `p_mark_paid` branch. Byte-identical
notification behavior from both writers now. Proved live (`BEGIN…ROLLBACK`,
real org/offering/contact):

```sql
SELECT _provision_purchase_for_offerings(org, contact, NULL, ARRAY[offering], true, 'cash', 'proof');
-- purchase lands status='paid', payment_status='paid'
SELECT kind, title, link FROM notifications WHERE kind='payment_received' ORDER BY created_at DESC LIMIT 3;
       kind       |                    title                     |           link
------------------+-----------------------------------------------+---------------------------
 payment_received | Payment received — Search Retainer ($350.00)  | /app/ops/payments/review
 payment_received | Payment received — Search Retainer ($350.00)  | /app/ops/payments/review
```

(Two rows = two staff profiles in this org; `notify_staff` writes one row per
staff member by design, not a double-fire.) `ROLLBACK` confirmed.

PGlite test (`zelleclose_paid_notify_spine.test.ts`) reproduces the pre-fix
silence, proves the fix, and proves `mark_purchase_paid`'s own behavior is
unchanged (control case) plus the `already_paid` short-circuit still works.

## The standalone "mark this existing order paid" surface (BOOKLINK's flagged gap)

BOOKLINK widened `mark_purchase_paid` to staff (`has_staff_access()`-guarded)
but shipped no UI for it outside a fresh booking's create-new-order flow —
flagged, not built, in that report. Built now:

- **`api/orders-mark-paid.ts`** (new) — staff-bearer-token endpoint. Calls
  `mark_purchase_paid` **as the calling staff user** (`callerClient(bearer)`,
  the same pattern `delete-document-with-copy.ts` already uses) so
  `has_staff_access()` evaluates against the real actor and
  `status_events.actor_user_id` records who did it — proved live:

  ```sql
  -- as a real staff user (b45a5503…), on a real unpaid order
  SELECT mark_purchase_paid('96b4a815-…', 460.00, NULL, 'cash');  -- 'paid'
  SELECT entity_type, status, actor_user_id FROM status_events WHERE entity_id='96b4a815-…' ORDER BY created_at DESC LIMIT 1;
   order | paid | b45a5503-89bc-489a-b012-c7fbf5c09632   -- the real caller, not NULL
  ```

  Then calls `sendOrderReceipt` — the exact same receipt trail (`receipt_sends`,
  provable, single-send-guaranteed via `claim_receipt_send`) an automatic
  Zelle match gets. **One spine**: no second write path, no second email path.
  `ROLLBACK` confirmed on the real purchase afterward (`awaiting_payment`/`unpaid` again).

- **`src/lib/ops/api-payments.ts`**: `listOutstandingOrders()` /
  `listPaidOrders()` (direct off `purchases`, `purchases_staff_all` RLS — no
  new RPC needed for reads) and `markOrderPaid()` (the client wrapper for the
  endpoint above).

- **`PaymentReviewPage.tsx`**: new **"Orders"** bucket, alongside the existing
  review/unmatched/matched buckets (same page, already in nav — the task's own
  instruction: "put it where they already work"). Two sections — **Outstanding**
  (who owes: buyer, items, amount owed, what they self-reported via
  `report_my_payment` if anything, `payment_status` badge, Zelle/Cash mark-paid
  buttons) and **Recently paid** (who paid: buyer, items, amount, method,
  reference, paid-at).

---

# THE TEST THIS TASK NAMED — status

1. **A real order produces a memo + unique amount, shown as query output.**
   PROVEN — Z1, Claire's real $1,000 order, `BEGIN…ROLLBACK`.
2. **The inbound path is documented and its actual existence established.**
   DONE — `docs/NOTIFICATIONS.md`. Established, not assumed: **it does not
   operate** (0 rows, ever, in `payment_notifications`; no cron/function
   drives it). Setup steps documented for when a Workspace admin deploys it.
3. **A matching payment marks the purchase paid with a provable event trail.**
   PROVEN at the mechanism layer — `reconcileNotification`'s confirmed branch
   was already wired to `mark_purchase_paid` + `confirm_booking_for_purchase`
   + `sendOrderReceipt` before this session; Z1 fixed the one thing that made
   it untestable (no purchase ever had matching keys). **Not exercised
   end-to-end with a real inbound notification this session** — there is no
   live trigger to send one through (item 2), and I did not fabricate a
   payload against the real endpoint (would require a real
   `ZELLE_INGEST_SECRET`, not present in this working copy, and would be a
   real, non-rollback-able write against prod purchases). Flagged, not done —
   see FLAGGED below.
4. **A non-matching payment lands somewhere a human sees, and an alert row
   proves the attempt.** PROVEN — Z2. The `payment_notifications` row itself
   is the attempt-proof (status `review`, one per notification, the same
   pattern `receipt_sends`/`request_alert_sends` use elsewhere in this repo);
   the new `notify_staff` call is the "somewhere a human sees" — both bucket
   in the same nav'd Payment review page and the Dashboard needs-attention
   band. Same caveat as #3: not exercised with a real inbound POST, because
   nothing generates one yet.
5. **Staff-marked zelle/cash payments write the same trail as matched ones.**
   PROVEN — Z3, both halves: the BOOKLINK create-and-mark-paid path now
   notifies identically (was silent), and the new standalone mark-paid
   endpoint reuses `mark_purchase_paid` + `sendOrderReceipt` verbatim, proved
   live with real actor attribution.
6. **Every DB claim is query output; render claims NOT VERIFIED with a
   numbered checklist.** Done — every claim above is a pasted `psql` result,
   almost all inside `BEGIN…ROLLBACK` (the two real applied migrations are
   called out explicitly, each with a dry-run-then-apply-then-reverify
   sequence). Render checklist below.

---

# FLAGGED, NOT FIXED

- **The Apps Script trigger is not deployed** (a Google Workspace admin
  action, outside this repo). Until it is, items 3/4 above stay proven at the
  mechanism layer only, never against a real inbound email. This is the
  single biggest remaining gap between "the code is correct" and "the system
  notices."
- **The reschedule-fee identity matcher** (`matchRescheduleFee`,
  `pending_fee_candidates`) was read and its review branch was given the same
  alert fix, but its match logic itself was not otherwise audited this
  session — out of this task's stated scope (Z1–Z3 are about purchases, not
  fees).
- **Overpayment** (`reconcile.ts`'s own comment: "Overpayment is allowed to
  confirm; flag for FHE to handle a credit… left as a comment for the content
  pass") — pre-existing, unchanged, still just a comment.
- **`api/stripe-create-session.ts:43`** still carries the buyer-key bug PAYLOCK
  flagged elsewhere — per the task's own instruction, not touched (Stripe is
  `STRIPE_ENABLED = false`, out of scope).
- **`my_horse_onboarding_state`** twin-key bug — PAYLOCK's report flagged this
  as found-not-fixed; re-checked this session (CREDITFIX's migration header
  claims it was independently fixed by `20260726010000`) but not re-verified
  against live prod by me — outside this task's scope, noted only because I
  was already reading adjacent code.
- **Whether other merged-but-possibly-unapplied migrations exist beyond
  PAYLOCK's**: spot-checked the load-bearing pieces this task's own build
  depends on (`mark_purchase_paid`'s live body, `report_my_payment`,
  `client_reported_*` columns, `payment_notifications` schema,
  `lesson_credits.purchase_id`, `bookings_lesson_requires_client`,
  `_debit_or_create_for_booking`, `offerings.segment`/`unit_count`,
  `notify_purchase_unpaid`) — all confirmed live. **Not** a full audit of
  every migration file in the repo; a systemic version-drift problem (no
  migrations-tracking table exists in this DB at all) that produced one real
  incident this session and could produce others elsewhere, unrelated to
  payments.

# OUT OF SCOPE (per spec, untouched)

`ContractPage.tsx`, `ClauseDocument.tsx`, `AddElementModal.tsx`,
`PartyControlsCard.tsx`, booking-queue surfaces (`TASK-REVIEWQ`), Stripe.

---

# OWNER CHECKLIST — every render claim above, NOT VERIFIED, to run in a browser

1. Open `/app/ops/payments/review` as staff — confirm the 4 tabs (Needs
   review / Unmatched / Matched / **Orders**, new) all render.
2. On the **Orders** tab, confirm "Outstanding" lists the 3 real unpaid
   purchases (Claire Bourdon $1,000, Gabriella Olenik $460, and the $420 one)
   with correct buyer names and amounts owed.
3. On a real outstanding order, click "Zelle" or "Cash" under Mark paid —
   confirm it moves to "Recently paid," a toast confirms whether the receipt
   email sent, and the buyer sees "Payment received" on their own dashboard.
4. Confirm the Dashboard needs-attention band picks up a `payment_review`
   notification when a payment lands in review (cannot be produced end-to-end
   without the Apps Script trigger — see FLAGGED — but can be forced by
   directly POSTing a non-matching payload to `/api/zelle-reconcile` with the
   real `ZELLE_INGEST_SECRET` in a controlled test).
5. As staff, open a "Needs review" or "Unmatched" item and click Dismiss —
   confirm it now succeeds (previously a silent no-op).
6. As a provisioned buyer (e.g. re-run Claire's flow for real, not rolled
   back), reach the Pay-with-Zelle screen and confirm a memo + amount now
   render — this was structurally impossible before this session's Z1 fix.
