# TASK-BACKDATE — REPORT

**Thread `TASK`. Branch `task/backdate` in the pool worktree `wt-1`.
Merge-base `1911a6eb` (`origin/main` moved TWICE mid-build — see §6).
NOT PUSHED.**

---

## 0. FIRST ACT — the spec read back

**What I understood the task to be.** The owner cannot backfill a year of trading, and the
reason is not that the backfill fails — it is that it succeeds and lies. Two acts move money:
creating an order and settling one. Neither could say when it really happened, so a year of
orders and payments all landed on the day they were typed, `revenue_summary` (which recognises
at `paid_at`) collapsed the year onto one date, and the dashboard reported it confidently.
Half of the fix already existed: `mark_purchase_paid` has taken `p_paid_at` since TASK-ORIGIN
and nothing has ever passed it. Alongside that, settlement had only one door
(`PaymentReviewPage`), so an order could be marked paid at creation and effectively never
again — and one `draft` order was invisible to every surface in the app.

**What I changed.** A date on `attach_offerings_to_client` (old signature dropped, not
overloaded); `p_paid_at` passed through `api/orders-mark-paid.ts`; a mark-paid control on
`ContactDossierModal`'s Orders tab calling the SAME `markOrderPaid` seam; `draft` added to
the outstanding list; a backdated settlement sends no receipt and no in-app notice and says
so; the date is stated before each act and shown on the record after it; and a future date is
refused inside the functions, not in the UI.

**What I did not change.** `revenue_summary` (BOOKS1's). `ops/kit/Modal.tsx` (MODAL2's).
`AppLayout.tsx` / `pageRegistry.ts` (CR85's). The owner's actual data entry (D30) — this makes
it possible, it does not do it. `grant_lesson_credit` — see §5.4.

---

## 1. THE HEADLINE

An order and a payment can each carry the date they really happened, refused server-side if
that date is in the future. A backdated settlement moves money into a closed month **on
purpose**, and sends no receipt and no notice while saying so on screen and on the order's
timeline. Settlement is now reachable from the client's own record through the same one seam
Payment review uses, and the `draft` order that no surface in the app could settle is settleable.
⚠️ **`mark_purchase_paid` was silently overwritten in production by `TASK-BOOKS1` fifteen
minutes after this task's first apply; section 4 of the migration is now an in-place patch, not
a rewrite (§5.1).**

---

## 2. CRITERION BY CRITERION

Every SQL block below ran against **production** as `admin@fhequestrian.com`
(`SET LOCAL role authenticated` + `request.jwt.claims`), inside `BEGIN; … ROLLBACK;`.

### 1. An order created with a past date carries it ✅

```
SELECT attach_offerings_to_client('28712509-…'::uuid, ARRAY['…Turnout Session…'],
         false, NULL, 'TASK-BACKDATE rehearsal', 0, NULL, '2026-03-14'::timestamptz);

 display_code |      status      | payment_status | amount |       created_at       | paid_at
--------------+------------------+----------------+--------+------------------------+---------
 PUR-000337   | awaiting_payment | unpaid         |  25.00 | 2026-03-14 00:00:00-07 |

      label      |       created_at
-----------------+------------------------
 Turnout Session | 2026-03-14 00:00:00-07
```

The purchase, **and its line items**, carry the date. `clients.client_since` does too when the
client shell is created by this call (§5.3).

### 2. A payment settled with a past date lands on `paid_at` ✅

```
SELECT mark_purchase_paid(…, NULL, 'REHEARSAL-1', 'zelle', '2026-03-14'::timestamptz);
 settlement
------------
 paid

 display_code | status | payment_status | amount | amount_paid | payment_method |        paid_at
--------------+--------+----------------+--------+-------------+----------------+------------------------
 PUR-000337   | paid   | paid           |  25.00 |       25.00 | zelle          | 2026-03-14 00:00:00-07

 amount | status | method |      confirmed_at
--------+--------+--------+------------------------
  25.00 | paid   | zelle  | 2026-03-14 00:00:00-07
```

⚠️ The `payments` row's `confirmed_at` moved with it — `_payment_settle` already took the date
and, like `p_paid_at`, nothing had ever passed it.

### 3. `revenue_summary` returns it for THAT month, and the current month is unchanged ✅

Control, before the backdated act:

```
 sept_before | aug_before | march_before
-------------+------------+--------------
 0           | 1935.00    | 0
```

After backdating the $25 order to **2026-03-14**:

```
march      → {"total": 25.00, "count": 1, "prior_total": 0}
september  → {"total": 0,     "count": 0, "prior_count": 4, "prior_total": 1935.00}
```

And after rehearsing the production draft ($880) as paid on **2026-08-22**:

```
 sept_after | aug_after
------------+-----------
 0          | 2815.00      (August 1935.00 → 2815.00; September unchanged at 0)
```

🔒 **SAY IT PLAINLY, BECAUSE IT WILL LOOK LIKE A REGRESSION.** A backdated payment moves money
into a **closed month**, and `revenue_summary` reads `paid_at` in a window, so **two readings of
the same dashboard taken either side of a backfill will legitimately disagree about March, or
August, or any prior month.** That is the feature. It is not a double-count and it is not
drift — the money was always that month's; the system just could not say so. The only figure
that must NOT move is the current one, and it did not.

### 4. No email left the system for the backdated settlement ✅

`receipt_sends` holds one row per **attempt** (success or failure, with the error), and
`sendOrderReceipt` is its only writer. Production baseline:

```
 rows | latest
------+--------
    0 |
```

⚠️ **This is the honest limit of what I can prove end-to-end**, and I am naming it rather than
dressing it up: proving the same-day half against production means actually emailing a real
client a money-received receipt for a rehearsal, and I will not do that. So the branch is
asserted against **the real handler**, with `sendOrderReceipt` spied — no receipt call means no
`receipt_sends` row means no email:

```
$ npx vitest run test/api
 ✓ test/api/orders-mark-paid-backdate.test.ts (7 tests)
   ✓ a settlement carrying a past date > lands the date on mark_purchase_paid and sends NOTHING
   ✓ a settlement carrying a past date > carries the date through the CLAIM path too
   ✓ a same-day settlement > is unchanged — no date is sent, and the receipt still goes
   ✓ a same-day settlement > still sends the receipt when TODAY is stated explicitly
   ✓ a future date is not a backfill > is refused before anything is written
   ✓ a future date is not a backfill > refuses anything that is not a bare calendar date
   ✓ a part payment > sends no receipt whether or not it is backdated
 Test Files  1 passed (1)   Tests  7 passed (7)
```

⚠️ **THE IN-APP NOTICE WAS SUPPRESSED TOO** — beyond the spec, and I am flagging it as a
decision (§5.2). Proven in production for both settlement paths:

```
── R5b: no buyer/staff "payment received" notice for the backdated one ──
 payment_received_notices
--------------------------
                        0
```

### 5. A same-day settlement still sends its receipt ✅

Two ways, and they are the same mechanism. **By construction**: the UI only ever sends a date
when it is in the PAST (`asRecordedDate` returns `undefined` for today), so a same-day
settlement sends no date argument at all and every line below it is byte-for-byte the old path.
**And explicitly**, for a caller that states today anyway — vitest cases 3 and 4 above,
`sendOrderReceipt` called once each.

### 6. A future date is refused, server-side ✅ — in FOUR places

Not in the UI. `attach_offerings_to_client`, `mark_purchase_paid` and `confirm_payment_claim`
are all `EXECUTE`-able by `authenticated` **directly over PostgREST**, so a check that lived
only in the API route would not be a boundary.

```
ERROR:  an order cannot be dated in the future (2026-09-02)
CONTEXT: PL/pgSQL function attach_offerings_to_client(…) line 23 at RAISE

ERROR:  a payment cannot be dated in the future (2026-09-02)
CONTEXT: PL/pgSQL function mark_purchase_paid(…) line 20 at RAISE

ERROR:  a payment cannot be dated in the future (2026-09-08)
CONTEXT: PL/pgSQL function mark_purchase_paid(…) line 20 at RAISE
         PL/pgSQL function confirm_payment_claim(…) line 24 at assignment
```

Plus the API route (vitest case 5): `400 {"error":"a payment cannot be dated in the future"}`,
with `rpc` never called.

### 7. The staff client record settles an order, through the same endpoint ✅

**The call chain, top to bottom, all one seam:**

| | |
|---|---|
| `ContactDossierModal.tsx:651` | `<SettleOrderControl order={o} …/>` — rendered per order, `payment_status !== 'paid' && status !== 'void'` |
| `ContactDossierModal.tsx:1054` | `markOrderPaid(order.purchase_id, method, undefined, undefined, asRecordedDate(paidOn))` |
| `api-payments.ts:371` | `markOrderPaid` → `POST /api/orders-mark-paid` |
| `api/orders-mark-paid.ts:129/141` | `confirm_payment_claim` (pending claim) **or** `mark_purchase_paid` |

**`PaymentReviewPage.tsx:171` calls the identical function.** There is one settlement spine and
this is a second **door** onto it, not a second engine. ⚠️ Nothing new writes `purchases`
directly.

### 8. The one `draft/unpaid` order in production can now be settled ✅

`BEGIN; … ROLLBACK;` on the real row, `PUR-000302` (Madeline Do, $880, created 2026-08-22):

```
 display_code | status | payment_status | amount | amount_paid | paid_at | current_status
--------------+--------+----------------+--------+-------------+---------+----------------
 PUR-000302   | draft  | unpaid         | 880.00 |           0 |         | enquiry

SELECT mark_purchase_paid('3947a545-…', NULL, 'DRAFT-REHEARSAL', 'cash', '2026-08-22'::timestamptz);
 → paid

 display_code | status | payment_status | amount | amount_paid |        paid_at         | current_status
--------------+--------+----------------+--------+-------------+------------------------+----------------
 PUR-000302   | paid   | paid           | 880.00 |      880.00 | 2026-08-22 00:00:00-07 | paid
```

And it is now **visible in both places**: `listOutstandingOrders` includes `draft`, and
`contact_dossier` shows it on Madeline's own record with a **Mark paid** control on it.

**R4 — WHICH I CHOSE AND WHY. The outstanding list includes `draft`.** Promotion-on-settlement
answers a question that only arises *after* this one: you cannot promote an order nobody can
find. And the promotion happens anyway, as a consequence rather than a mechanism —
`mark_purchase_paid` already sets `status = 'paid'` when the money is all in, which is exactly
what the row above shows (`draft` → `paid` in the same write). The list is the "who owes money"
list; a draft that owes $880 owes $880, and `orderStatusLabel` already renders it honestly as
"In progress" so the row never claims to be something it is not.

### 9. Every `attach_offerings_to_client` call site resolves to the NEW signature ✅

**Exactly one signature exists for each function touched — the old ones are gone, not shadowed:**

```
 _notify_purchase_paid(uuid,boolean)
 _provision_purchase_for_offerings(uuid,uuid,uuid,uuid[],boolean,text,text,numeric,timestamp with time zone)
 attach_offerings_to_client(uuid,uuid[],boolean,text,text,numeric,uuid,timestamp with time zone)
 confirm_payment_claim(uuid,timestamp with time zone)
```

**The call sites, named:**

| Caller | Resolves how |
|---|---|
| `src/lib/admin.ts:674` `adminAttachOfferings` — **the only code caller** | named args, now passes `p_occurred_at` |
| DB callers of `attach_offerings_to_client` | **none** (`prosrc` scan returned zero rows) |
| `_provision_purchase_for_offerings` ← `attach_offerings_to_client` | 9 args, explicit |
| ← `redeem_gift`, `_debit_or_create_for_booking`, `provision_client_invitation` | 8 args → the 9-arg default. **Proven, not assumed:** an 8-argument call executes and returns `NULL` on the empty-array guard, so it resolves and is not ambiguous |
| `confirm_payment_claim` ← `api-payments.ts:196` `confirmPaymentClaim` | 1 named arg → the 2-arg default |
| `_notify_purchase_paid` ← `_provision_purchase_for_offerings`, `mark_purchase_paid` ×4 | both now pass the announce flag |

### 10. The status events still fire on settlement ✅ — probed, not inferred

⚠️ `status_purchases` is `BEFORE INSERT OR UPDATE OF status, payment_status, …`, and an
`UPDATE OF` fires on the columns the **statement names**. `paid_at` is written in the **same
UPDATE** as `status` and `payment_status` in every one of BOOKS1's four settlement paths, so the
trigger fires for it. Probed on a backdated settlement:

```
 entity_type |  status   |                                 detail
-------------+-----------+--------------------------------------------------------------------
 order       | submitted |
 order       | paid      |
 order       | paid      | Backdated settlement — recorded as of March 14, 2026. No receipt or notice was sent.

 display_code | current_status
--------------+----------------
 PUR-000342   | paid
```

Rows one and two are the trigger; row three is this task's D19 record of **why** nothing was
sent. `current_status` denormalised correctly.

### 11. `pg_proc.proacl` before and after ✅

| function | before | after |
|---|---|---|
| `attach_offerings_to_client` | `{postgres=X,authenticated=X,service_role=X}` | **identical** |
| `_provision_purchase_for_offerings` | `{postgres=X,service_role=X}` | **identical** |
| `_notify_purchase_paid` | `{postgres=X,service_role=X}` | **identical** |
| `confirm_payment_claim` | `{postgres=X,authenticated=X,service_role=X}` | **identical** |
| `mark_purchase_paid` | `{postgres=X,authenticated=X,service_role=X}` | **identical** (patched in place; ACL never dropped) |
| `contact_dossier` | `{=X,postgres=X,anon=X,authenticated=X,service_role=X}` | **identical** (`CREATE OR REPLACE`) |

⚠️ **AND THE FIRST APPLY GOT THIS WRONG — CAUGHT, MEASURED, FIXED.** `REVOKE ALL … FROM PUBLIC`
is **not enough**: Supabase ships `ALTER DEFAULT PRIVILEGES` granting `EXECUTE` on every new
function to `anon` **and** `authenticated`, and those are **direct grants a PUBLIC revoke does
not touch** — the exact trap in TASK-ROLE §2a. The first apply handed `anon` execute on
`attach_offerings_to_client`, which migration `20260801010000` had deliberately revoked, and on
both internal helpers. The migration now reads
`REVOKE ALL … FROM PUBLIC, anon, authenticated;` before each `GRANT`, and the table above is
the re-measured result.

### 12. `typecheck` · `typecheck:api` · lint · `build` ✅

| | |
|---|---|
| `npm run typecheck` | **0 errors** |
| `npm run typecheck:api` | **0 errors** |
| `npm run lint` | **0 errors, 46 warnings** — budget is ≤46, and **the baseline measured on `origin/main` in this same worktree is also 46**, so this branch adds **zero**. (CLAUDE.md's "48" is stale.) The first draft was 49; `RecordedDateField` was split out of `src/lib/recordedDate.ts` so the pure-function module stops tripping `react-refresh/only-export-components`. |
| `npm run build` | **passes** — vite build + prerender + seo-files, `dist/sitemap.xml` written |
| `npx vitest run test/api` | **7 passed** |
| `npm run test:db` | **not run — red at baseline, proves nothing** (TASK-ROLE §3). Verified against production instead. |

### 13. Renders — ⚠️ NOT VERIFIED BY ME

No worktree has a staff login and I did not simulate one. §8 is the owner's checklist.

---

## 3. THE REACH

**What does a staff member click, from which page, to settle an order for a client whose record
they are looking at — and is that the only way?**

**Records › Clients → click the person → Orders tab → "Mark paid" on the order line → pick the
date → Zelle / Cash.** `ContactDossierModal.tsx:651` → `:1054`.

**It is not the only way, and that is the point** — Ops › Payments › Payment review → Orders
bucket → Zelle / Cash (`PaymentReviewPage.tsx:171`) is still there, and is still the right
surface for "who owes money" across everybody. **They are two doors on one seam:** both call
`markOrderPaid` (`api-payments.ts:371`) → `POST /api/orders-mark-paid` →
`mark_purchase_paid` / `confirm_payment_claim`.

**What it was before:** `markOrderPaid` had **exactly one** call site in the entire app, and the
client record could show you the $880 owed and not let you take it.

**And the record is reachable from five places**, all of which now inherit the control:
`RecordsPage.tsx:129`, `Admin.tsx:293`, `ContactsPage.tsx:455`,
`ArchivedAccountsPage.tsx:164` (archived — the control is hidden there, correctly) and
`ReviewMounts.tsx:85`.

**The order-date half:** the same Orders tab → **Add offerings** → pick → **Order date**
(`ClientRecordActions.tsx:489`). That panel is the only reach for `attach_offerings_to_client`
in the app, and it was already there — it just had no date.

---

## 4. FLAGGED, NOT FIXED

- `contact_dossier`'s orders query has no `deleted_at IS NULL` filter, so a soft-deleted order still lists on the record.
- `_provision_purchase_for_offerings` writes `paid_at` when `p_mark_paid` but writes **no `payments` row**, so a provisioned-paid order has revenue with no payment ledger entry; `mark_purchase_paid` does write one.
- `receipt_sends` is empty in production — no order receipt has ever been attempted, so the email path itself is unexercised in the wild.
- `confirmPaymentClaim` (`api-payments.ts:196`) still sends its receipt through `/api/send-order-receipt` unconditionally; the Client-claims bucket has no date control, so it cannot backdate and cannot suppress.
- `orderStatusLabel` maps both `draft` and `pending` to "In progress", so a draft now in the outstanding list reads the same as a live enquiry.

---

## 5. WHAT I DECIDED THAT THE SPEC DID NOT

### 5.1 ⚠️ `mark_purchase_paid` is patched in place, not rewritten — because a rewrite was already lost once

**This is the finding of the build.** Section 4 of the migration was a full
`CREATE OR REPLACE`. It was applied at 01:20. By 01:35 it had been **silently overwritten in
production** by `TASK-BOOKS1`, which was replacing the same function to add
`p_disposition` / `p_write_down_reason`. Two threads, one function, last write wins — and the
losing half fails **silently**, because the function still exists, still compiles, and still
returns `'paid'`. It was caught only by **re-running the future-date test**, which had passed an
hour earlier and started returning `paid` for tomorrow's date.

`mark_purchase_paid` is BOOKS1's file, not this task's — my own spec says "the RPC already takes
it; do not rebuild the spine". So section 4 is now the repo's established read-modify-rewrite
pattern (CLAUDE.md, ~31 migrations): it reads whatever body is live and **patches** it, so
BOOKS1's disposition logic survives whichever order the two are applied in, it is **idempotent**,
and it **RAISES rather than no-ops** if an anchor moves — a silent no-op here being precisely the
failure mode this repair exists to end.

```
NOTICE:  TASK-BACKDATE: mark_purchase_paid patched — 4 announcement site(s) made backdate-aware
NOTICE:  TASK-BACKDATE: mark_purchase_paid already carries the date guard — nothing to do   (re-run)
```

⚠️ **FOR ORCH: if BOOKS1 re-applies its own full `CREATE OR REPLACE` after this, the guard is
lost again and nothing will say so.** Re-apply section 4 of
`supabase/migrations/20260901T1200_…sql` after merging BOOKS1 and check for the first NOTICE.
**Verified before patching: BOOKS1's body keeps `p_paid_at` and writes
`paid_at = coalesce(p_paid_at, now())` in all four settlement paths** — R2's core survived
their rewrite intact.

### 5.2 A backdated settlement is silent in-app too, not only by email

The spec scoped R5 to `sendOrderReceipt`. But `_notify_purchase_paid` tells the buyer *"We
received your payment of $880. Thank you."* in-app, and notifies staff. Backfilling a year would
ring a real client's bell once per historical payment — the same harm, a different channel. So
`_notify_purchase_paid` gained `p_announce`, and **the resolution half still runs for a backdated
settlement** (suppressing it would leave a backfilled order flagged as owing money in-app for
ever). The order's timeline records that nothing was sent, and why.

### 5.3 `client_since` and the line items carry the date too

`attach_offerings_to_client` creates the `clients` shell when the contact is not a client yet, and
stamped `client_since = now()`. `client_since` is a **D8 marker** — a client backfilled from last
March became a client last March. Same for `purchase_items.created_at`: it is the same act.

### 5.4 `grant_lesson_credit` — R3 does NOT make it fully redundant

The spec asked. It does not. `grant_lesson_credit` **already** takes `p_paid_at`, already has its
own reach (`GrantCreditDialog.tsx:96`), and does three things this task's path does not: a
**quantity**, a **comp/handwrite/bill mode with a required reason**, and an **undo**
(`revoke_lesson_credit_grant`). What R3 removes is the need to use it merely to record a sale
that was paid — but retiring it needs BOOKS1's disposition model to land first, because comp is
the half that has no other home today.

### 5.5 One shape for a date: a bare `YYYY-MM-DD`, and "today" means "send no date"

The API refuses anything else with a 400 rather than reinterpreting an instant. The DB roles are
`America/Los_Angeles` (`20260817T1600`), so a bare date casts to the **start of that day at the
barn**, and the UI, the route and the functions all compare in that one calendar. And the client
only ever sends the value when it is in the **past** — which is what makes "a backdated
settlement sends no email" provable rather than approximate: **the argument's presence is the
backdating.**

### 5.6 The R5 test is committed, but no npm script runs it

`test/api/orders-mark-paid-backdate.test.ts` runs with `npx vitest run test/api`. `package.json`
is not this task's file. **The diff for ORCH:**

```diff
   "typecheck:api": "tsc --noEmit -p tsconfig.api.json",
+  "test:api": "vitest run test/api",
   "check:tokens": "node scripts/check-token-registry.mjs",
```

⚠️ It exists because BOOKS1's own concurrency block says *"your disposition must not re-open
that door"* — and BOOKS1 edits this exact file.

---

## 6. WHERE THE SPEC WAS WRONG

**It was right on every measured claim** — the missing parameter, `mark_purchase_paid`'s unused
`p_paid_at`, the single `markOrderPaid` call site at `PaymentReviewPage.tsx:153`, the
`OrdersContent.tsx` correction, and the production counts (12 `awaiting_payment/unpaid`,
4 `paid`, 1 `draft/unpaid`) all re-measured exactly. Three things it did not anticipate:

1. **§4's `UPDATE OF` trap did not apply as written.** `paid_at` is already written in the *same*
   statement as `status`/`payment_status`, in all four of BOOKS1's paths. The trap is real and I
   probed it (§2.10) — but there was nothing to repair. What §4 *should* have warned about is
   **§5.1**: the function was about to be overwritten by another live thread.
2. **`confirm_payment_claim` is a third settlement entry point and the spec named only two.** It
   takes no date, so a backdated settlement on an order carrying a pending claim would have
   silently dropped the date — the exact "succeeds and lies" failure. It now carries `p_paid_at`
   through to the same `mark_purchase_paid` call it always made.
3. **`origin/main` moved twice during the build** (`57619291` concurrency blocks, `1911a6eb`
   TASK-REAPER). Rebased; merge-base stated at the top.

---

## 7. THE NUMBERS

```
npm run typecheck      0 errors
npm run typecheck:api  0 errors
npm run lint           0 errors, 46 warnings   (origin/main baseline in this worktree: 46 — zero added)
npm run build          passes
npx vitest run test/api  7 passed
```

**Commits (not pushed):** `3643a4ce`, `e0dc0090` on `task/backdate`.
**Files:** `supabase/migrations/20260901T1200_an_order_carries_the_date_it_really_happened.sql` ·
`api/orders-mark-paid.ts` · `src/lib/ops/api-payments.ts` · `src/lib/admin.ts` · `src/lib/api.ts` ·
`src/lib/recordedDate.ts` *(new)* · `src/components/app/RecordedDateField.tsx` *(new)* ·
`src/components/app/ContactDossierModal.tsx` *(Orders tab only)* ·
`src/components/app/ClientRecordActions.tsx` · `src/pages/app/ops/PaymentReviewPage.tsx` ·
`test/api/orders-mark-paid-backdate.test.ts` *(new)*.

---

## 8. THE OWNER'S RENDER CHECKLIST

⚠️ **I did not see any of this render. Please run it, and do 5–7 ON THE PHONE.**

1. **Records › Clients → Madeline Do → Orders.** The $880 `PUR-000302` should be there with a
   **Mark paid** button under its line items. It was invisible to every settlement surface
   before today.
2. Press **Mark paid**. A **Date paid** box appears, set to today, with *"Recorded as of today —
   the client gets their receipt as usual."* under it. **Cancel** — nothing should have changed.
3. Press it again, set the date to **a day last month**. The sentence should turn amber and say
   the money counts in that month and that **no receipt or notice is sent**. Try to type a
   **future** date — the box should not let you, and if you force one the server refuses it.
4. Settle it as **Cash** on a past date. The banner at the top of the Orders section should say
   *"Marked paid (cash). Recorded as of ⟨date⟩. No receipt was sent — this money arrived before
   today."* The order line should now read **Ordered ⟨date⟩ · paid ⟨date⟩**. ⚠️ **Please confirm
   the client received NO email.**
5. **📱 ON THE PHONE:** same screen — is the date box and its sentence readable, and are the
   Zelle / Cash / Cancel buttons reachable without horizontal scrolling?
6. **📱 Records › Clients → anyone → Orders → Add offerings.** An **Order date** box should sit
   above the price total. Pick something, set a past date, **Attach**. The panel should close
   and say *"Recorded as of ⟨date⟩ — it counts in that month, not this one."*
7. **📱 Ops › Payments › Payment review → Orders.** One **Date paid** box above the whole
   Outstanding table (set it once for a run of backfilled payments). The `draft` order should now
   appear in that table. Settle one and read the toast.
8. **Ops dashboard / the revenue ribbon.** After backdating something into a past month, that
   month's figure moves and **the current month must not**. ⚠️ Two readings either side of a
   backfill *will* disagree about the past month — that is correct.

---

## 9. TEARDOWN

**I started no server, no browser, no scratch worktree, and no background process.** Everything
ran as one-shot `psql`, `tsc`, `eslint`, `vite build` and `vitest` invocations, all exited.

```
$ ps -ax | grep -Ei 'vite|node .*dev|playwright|psql|vitest' | grep -v grep
(nothing — no dev server, no headless browser, no open psql session)
```

The only long-lived processes on the machine are **the owner's own**: Google Chrome, VS Code,
and **six `claude` native-binary sessions** — this thread plus the five other live threads. None
were started here and none are mine to kill.

```
$ git worktree list
/Users/Cactai/Downloads/claude-code-repo/fhe-website-app  5f1a0446 [main]
/Users/Cactai/Downloads/claude-code-repo/wt-1             e0dc0090 [task/backdate]   ← this thread
/Users/Cactai/Downloads/claude-code-repo/wt-2             f124151e [task/modal2]
/Users/Cactai/Downloads/claude-code-repo/wt-3             38780be6 [task/reaper]
/Users/cactai/Downloads/claude-code-repo/wt-books1        f52247f5 [task/books1]
/Users/cactai/Downloads/claude-code-repo/wt-cr85          3f385006 [task/cr85]
```

⚠️ **`wt-1` is a POOL worktree and is LEFT IN PLACE on `task/backdate`** for ORCH to merge —
deleting it would delete the branch's checkout. It was taken idle (detached HEAD, clean tree),
branched from `origin/main`, and `git clean -xdf -e node_modules -e .env -e .env.db`'d before any
work. **Two other pool trees (`wt-2`, `wt-3`) were already busy and were not touched.**

Scratch SQL lived in the session scratchpad, outside the repo. **Nothing was pushed.**

**Three commits on `task/backdate`:** `3643a4ce` · `e0dc0090` · `8f06337d`.
