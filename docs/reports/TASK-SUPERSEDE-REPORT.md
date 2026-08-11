# TASK SUPERSEDE — report

**Task:** `docs/tasks/TASK-SUPERSEDE-supersession-ignores-the-horse.md`
**Branch:** `task/supersede` (worktree off `origin/main`)
**Status:** DONE — fix applied to production, all four proofs run against prod, migration committed.

---

## 1. THE BLANK-HORSE DECISION — asked first, ruled, implemented

Put to the owner before implementing, with recommendation; **the owner chose the
recommended option 2026-08-10:**

> **A horse-bound execution DOES supersede a prior executed blank-horse document of the
> same template for the same person.** A blank execution never revokes horse-bound priors.

Rationale carried with the recommendation: the blank document is an untargeted
authorization being replaced by a targeted one; leaving it live means two live documents
per obligation indefinitely for every pre-horse-binding client. The narrowing risk is
bounded because `ensure_horse_documents` is per-horse — every owned horse gets its own
bound document generated, so other horses are covered by their own pending documents
(surfaced in ops), not by the blank one. Sarah Morgan (the live case) owns exactly one
horse, so for her it is a pure replacement.

The resulting predicate (the whole fix is one added line):

```sql
AND (d.horse_id IS NULL OR d.horse_id = NEW.horse_id)
```

| existing | new | result |
|---|---|---|
| same horse | same horse | superseded (plain replacement) |
| blank | any horse | superseded (owner ruling — Sarah's case) |
| blank | blank | superseded (plain re-sign, via the `IS NULL` arm) |
| horse A | horse B | **retained** (the CJ bug, closed) |
| any horse | blank | retained (blank never revokes targeted) |

## 2. What changed

`supabase/migrations/20260810T1700_supersede_horse_scoped.sql` — full
`CREATE OR REPLACE` of `apply_document_supersession` (not a string-replace body rewrite,
so it is replayable and needs no match assertion). No `BEGIN`/`COMMIT` in the file
(grepped: only the comment and the plpgsql block keyword). Nothing else changed — no
frontend code, no data rewrites, no trigger changes (`documents_apply_supersession`
still fires AFTER UPDATE on the `→ EXECUTED` transition).

**Zero executed documents were rewritten.** Post-apply query shows all six documents of
interest (CJ ×4, Sarah ×2) byte-identical in status/current_status.

## 3. Verification — all four proofs, against production

Dry-run: one transaction installing the new function, running every proof, then
`ROLLBACK`, with post-rollback re-query. Then the migration was applied for real and
proof 1 re-run against the **deployed** function in a second rolled-back transaction.

1. **Bug closed.** Executed Beaumont's `HORSE_EMERGENCY_VET` (`fb6abc6c`) in-txn: Peep
   Show's `e659e722` stayed `EXECUTED / signed`, not superseded. Proven twice — once in
   the dry-run, once against the deployed function.
2. **Real replacement still fires.** Cloned Peep Show's executed vet doc as a new
   `AWAITING_SIGNATURE` row, executed the clone: the prior Peep Show doc became
   `superseded`. Supersession did not go dead.
3. **NULL side as ruled.** (a) Cloned Sarah's blank vet doc as a Secret-Tattoo-bound
   row, executed it: her blank `152912dd` became `superseded`. (b) Executed a further
   blank clone: the bound doc stayed `signed` — a blank execution revokes nothing bound.
4. **Rollback proven.** Post-`ROLLBACK` re-query: `fb6abc6c` back to
   `AWAITING_SIGNATURE / ready_to_sign`, `e659e722` and `152912dd` back to `signed`,
   clones absent, old function body back (`new_predicate_present = f`). After the real
   apply: `new_predicate_live = t` and all document rows unchanged.

Email safety during tests: `documents_send_executed_email` → `send_executed_document_email`
uses `net.http_post` (pg_net) — an async queue **insert**, so the rollback removed any
queued sends; no email escaped the dry-runs.

## 4. FOUND, NOT FIXED — CJ's two `ready_to_sign` docs reference a vanished contract

Both Beaumont documents (`fb6abc6c`, `0360f829`) carry
`contract_id = ae4ffe95-4662-4813-a16c-e7b5b5f325a4`, **which does not exist in
`contracts`** — despite `documents_contract_id_fkey` reporting `convalidated = true`.
No `status_events` trace of that contract remains. Scope is exactly these two rows
(the only orphaned `contract_id` values in `documents`).

**This is itself armed:** signing either document in production will ERROR. The signing
flow updates the row more than once in one transaction (status change, then
`current_status` / `executed_email_error` maintenance); Postgres skips the FK re-check
only for row versions created by other transactions, so the second same-transaction
update re-runs the check against the orphan and aborts. My tests only got past it by
NULLing `contract_id` inside the rolled-back transactions.

Recommendation (owner call, not taken unilaterally): either NULL the two `contract_id`
values (the docs become standalone horse docs, which is what they functionally are), or
delete-and-regenerate them via `ensure_horse_documents` — both are unsigned drafts, so
neither touches evidence. Left untouched pending a ruling.

## 5. Verified vs assumed

**Verified against production:** the old predicate (live `pg_get_functiondef` before the
change); the trigger definition and firing condition; the armed document state (matches
the task doc exactly, plus Mary Richardson holding two blank-horse DRAFTs of the same
templates — the blank→bound ruling will govern her path too); `ensure_horse_documents`
being per-horse (basis of the recommendation); all §3 proofs; the pg_net async email
path; the orphaned contract and its exact scope; post-apply function body and untouched
data.

**Assumed:** that `jsonb_populate_record` clones used in proofs 2–3 are faithful stand-ins
for app-generated documents (they copy every column of a real row, overriding only
id/display_code/horse_id/status); that no other code path executes documents except the
status transition the trigger watches.

**Not done:** no frontend change, so no typecheck claim is made (`npm install` was not
run; nothing TypeScript was touched). No historical supersession markings revisited, per
the task constraint.
