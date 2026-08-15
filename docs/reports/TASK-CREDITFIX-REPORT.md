# TASK CREDITFIX — report

**Branch** `task/creditfix` (worktree `~/Downloads/claude-code-repo/wt-creditfix`, off
`origin/main` `ece89d6`). **Not pushed.**

**Applied to production and verified.** One migration:

- `20260815T0500_creditfix_mint_from_unit_count.sql`

**No existing row was changed.** Before and after: `lesson_credits` still has exactly 3 rows,
same ids, same values, none tagged `offering_id`/`purchase_id` (those tags land on *future*
mints only — retro-tagging existing rows was out of scope and not done). This task changed what
a purchase mints **next**.

---

## The finding in one line

`_provision_purchase_for_offerings` minted `lesson_credits` from a regex on the offering's
**display name**, never from `offerings.unit_count`. It has now been fixed and reverted **twice**
in this codebase's history — this is the third restoration. Prod today mints the wrong count
using the right offering tag (a half-fix rode in sideways through an unrelated migration); this
task restores the count formula and adds the segment gate that never existed at all.

---

## 1. The regression chain (verified against the migration files, not re-derived)

| Migration | Did to the mint logic |
|---|---|
| `20260726010000_phase2_service_credits_horse_gate.sql` | Fixed it: `count = unit_count`, tagged `offering_id`. |
| `20260802020000_u3_payment_notifications.sql:146` | Re-declared the function from an **older** body (adding an unpaid-alert call). Reverted **both** the count formula and the tag back to the name regex, no `offering_id`. |
| `20260812T1600_bookwrite_...sql` (BOOKWRITE, task item's own "twin key" sibling) | Re-declared the function **again** to add `offering_id`/`purchase_id` write-back (BOOKWRITE's own comment: *"the credit records the purchase that granted it and the offering it is for. Both were knowable here and both were discarded."*). This restored the **tag** but left the **count formula untouched** — the regex rode through this migration too, uncommented-on. |

So immediately before this task, prod's `_provision_purchase_for_offerings` tagged every minted
credit with the correct `offering_id` and `purchase_id`, while still computing the count from
`'(\d+)-Lesson'` on the name — a half-fixed function that looked complete (it had the columns)
but wasn't (the arithmetic feeding them was still the old bug). Confirmed by reading prod's live
`pg_get_functiondef` before writing a line, per the task brief's instruction.

---

## 2. The segment gate — the task brief's suggested column was wrong, verified against prod rows

The brief proposed gating the mint on `service_type='RIDING_LESSON'`, flagged with "verify
against prod rows before trusting this line." It doesn't hold:

```
name            | service_type           | segment | config_kind | unit_count
4-Class Pack    | HORSEMANSHIP_TRAINING  | rider   | scheduled   | 4
Single Class    | HORSEMANSHIP_TRAINING  | rider   | scheduled   | 1
```

`4-Class Pack` — the task's own example, expected to mint 4 — has `service_type =
'HORSEMANSHIP_TRAINING'`, not `'RIDING_LESSON'`. Gating on `service_type` would have shipped a
second version of the exact bug this task exists to fix (a real punch card minting 0).

What actually separates "mints a bookable lesson credit" from "mints nothing" in prod is
**`offerings.segment`**: `'horse'` (HORSE_CLIPPING / HORSE_EXERCISE / HORSE_TRAINING) vs `'rider'`
(RIDING_LESSON / HORSEMANSHIP_TRAINING / JUMPER_TRAINING). That is also **exactly** the predicate
`book_open_slot` already uses to decide `'lesson'` (credit-gated) vs `'care'`:

```sql
SELECT CASE WHEN o.segment = 'horse' THEN 'care' ELSE 'lesson' END, o.id
```

Gating the mint on `segment <> 'horse'` keeps minting and consumption on the same axis by
construction, instead of adding a second classification that can drift from the one
`book_open_slot` already trusts.

---

## 3. The build

`20260815T0500_creditfix_mint_from_unit_count.sql`:

1. Defensively re-adds `lesson_credits.purchase_id` (`ADD COLUMN IF NOT EXISTS`) — prod already
   has it via BOOKWRITE, but a function that writes to that column shouldn't depend on an
   unrelated migration having added it first. No-op on prod.
2. Replaces the mint loop: for every `purchase_items` row on the purchase just created, joined to
   its `offerings` row, mint `unit_count * quantity` when `config_kind = 'scheduled' AND segment
   <> 'horse' AND unit_count > 0`. Nothing else changed — the pricing math, the `purchases` INSERT,
   the `purchase_items` INSERT, and the `notify_purchase_unpaid` call at the tail are byte-for-byte
   the prior body.
3. The name regex (`'(\d+)-Lesson'`) and the `price_unit = 'session'` else-1 branch are **deleted
   entirely** — nothing in the new body reads `offerings.name` or `price_unit` for the mint count.

**Recurring/monthly SKUs** (`config_kind = 'recurring'`): mint nothing, same as today. That is now
a declared exclusion (`config_kind = 'scheduled'` gate), not an accident of the regex missing
`'month'`-priced names. `TASK-BOOKLINK §B4` owns their entitlement model (mint per month, expire
at month end, no carryover) — nothing here assumes what a recurring SKU should grant.

### The mint table, proven (PGlite, exactly the task's own scenarios)

| offering | segment | config_kind | unit_count | before this task | after |
|---|---|---|---|---|---|
| 8-Lesson Punch Card | rider | scheduled | 8 | 8 *(regex coincidence)* | **8**, tagged |
| 4-Class Pack | rider | scheduled | 4 | **0** | **4**, tagged — proves `segment`, not `service_type` |
| Single Lesson | rider | scheduled | 1 | 1 | **1**, tagged |
| Full Body Clip (grooming) | horse | scheduled | 1 | **1** *(F2 — wrong)* | **0**, no row |
| 1x Weekly Lesson | rider | recurring | — | 0 | **0** — by declared scope now |
| Exercise 1x Weekly | horse | recurring | — | 0 | **0** — by declared scope now |

---

## 4. The twin-key bug named in the task (item 4) — verified ALREADY FIXED, not re-applied

The brief named `my_horse_onboarding_state` as keying its horse-purchase lookup on
`buyer_user_id = auth.uid()` alone, citing `20260714350000_horse_onboarding_state.sql` lines ~56
and ~64. That is true of the **original** file. It is not true of what shipped: `20260726010000`
§6 already rewrote the same function to the two-key idiom
(`pu.buyer_contact_id = v_contact OR pu.buyer_user_id = auth.uid()`), and — checked before writing
anything, per the repo's working rule — prod's live `pg_get_functiondef` today is **byte-identical**
to that rewrite. Nothing has reverted it since.

Re-applying the fix would have been a content-free no-op migration. Instead: left it untouched,
and the new PGlite test file exercises it as a provisioned (contact-keyed, no `buyer_user_id`)
buyer — `needs_horse` resolves to `true` off `buyer_contact_id` alone — so a **future** revert of
this twin-key check is now also caught by a test, not just by re-reading the function body.

One other `lesson_credits` writer exists — `decide_booking_change`, which refunds exactly one
credit (`'change_credit', 1, 1`) when staff cancels/defers a booking. Read and left alone: it's
returning a credit a booking already consumed, not minting from a purchase, doesn't touch
`offerings`, and is outside this task's scope.

---

## 5. Prod delta — what real purchases would mint now vs what they hold (no writes)

Read-only, both purchases prod has ever had:

| purchase | offering | segment | config_kind | unit_count | qty | credits **held** | credits **correct** |
|---|---|---|---|---|---|---|---|
| PUR-000050 | 1x Weekly Lesson (With your horse) | rider | recurring | — | 1 | 0 | 0 |
| PUR-000059 | Single Class | rider | scheduled | 1 | 1 | 1 | 1 |
| PUR-000059 | Training 1x Weekly | horse | recurring | — | 1 | 0 | 0 |
| PUR-000059 | Exercise 1x Weekly | horse | recurring | — | 1 | 0 | 0 |
| PUR-000059 | Single Lesson | rider | scheduled | 1 | 1 | 1 | 1 |
| PUR-000059 | **Full Body Clip** | horse | scheduled | 1 | 1 | **1** | **0** |

**One line disagrees.** Claire's (PUR-000059) grooming purchase minted a bookable lesson credit
it should never have had (F2). Everything else already happens to match, because every real
purchase item so far has `unit_count = 1`. **No backfill was performed** — the task is explicit
that existing wrong credits are not to be retro-minted or deleted; this table is the input for the
owner's ruling on whether to correct that one row by hand.

---

## 6. Migration discipline — a process note, reported honestly

The first dry-run attempt used a migration file that (copying the style of the older
`20260726010000`) wrapped its own body in `BEGIN; … COMMIT;`. Nested inside a `psql BEGIN; \i
file; ROLLBACK;` wrapper, the file's own `COMMIT;` committed the transaction for real — the
following `ROLLBACK;` had nothing left to roll back. The **outcome** was the intended one (verified
immediately after: `pg_get_functiondef` matched the target body exactly, `lesson_credits` still
had its original 3 untouched rows — the `ALTER TABLE … IF NOT EXISTS` and `CREATE INDEX … IF NOT
EXISTS` were harmless no-ops either way), but the dry-run step was not the clean rollback-then-apply
the task's TRAPS section asks for, and the file was non-compliant with the repo's own convention
(confirmed against `PAYLOCK` and `BOOKWRITE`, neither wraps in `BEGIN/COMMIT`). Fixed by stripping
the wrapper from the file before finalizing it, then re-ran the full dry-run → rollback-proof →
apply → replay cycle cleanly against the corrected file, with the same end state confirmed again.
Flagging this rather than presenting a tidier account than what happened.

---

## 7. Proof

- **PGlite**: `test/db/creditfix_mint_from_unit_count.test.ts`, 8/8 passing, exercises: the bug
  reproduced on the shipped (pre-migration) body; the migration applying and replaying twice; the
  regex provably absent from the post-migration body; the full mint table above including the
  `service_type` vs `segment` distinction; `offering_id` + `purchase_id` tagging; the twin-key
  regression guard on `my_horse_onboarding_state`. `npm run test:db` at large still has ~203
  pre-existing failures across 46 files (per `CLAUDE.md`, that suite is flaky) — none in files this
  task touched; only this file needed to be, and is, deterministic.
- **Prod, inside `BEGIN; … ROLLBACK;`**: dry-run applied cleanly, proven rolled back (row count
  unchanged inside vs after).
- **Prod, applied**: `pg_get_functiondef` confirms `unit_count` present, `regexp_match` absent.
  Re-applied the same file a second time immediately after — no error, confirming replay safety
  live, not just in PGlite.
- **Prod, no data mutated**: `lesson_credits` before/after — identical 3 rows, same ids.
- `npm run typecheck` — 0 errors. No frontend files changed (DB-only task); `lint`/`build` not
  re-run for the same reason.
- No orphaned `vitest`/`vite`/PGlite processes after the session (checked via `ps aux`).

## Out of scope, not touched

Ledger unification (`lesson_credits` vs `fulfillment_units`) — flagged only, per the brief.
`book_open_slot`'s credit CHOICE ordering. Anything BOOKLINK owns (calendar UI, staff-save debits,
recurring-SKU entitlement). Backfilling Claire's one wrong credit — reported above, not corrected.
