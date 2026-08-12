# TASK-TESTDB — report

Branch `task/testdb`, worktree `~/Downloads/claude-code-repo/wt-testdb`, off `origin/main`
(rebased onto `0567935` before measuring and again before commit). Not pushed.

---

## The numbers

Both runs are `npm run test:db` on this machine (8 cores, 8.6 GB RAM), rebased on the
same commit.

| | Files failed | Files passed | Tests failed | Tests passed | **Tests SKIPPED** |
|---|---|---|---|---|---|
| **Before** | 64 | 4 | 0 | 37 | **651** of 688 |
| **After** | 46 | 17 | 203 | 330 | **107** of 640 |

- **Skipped: 651 → 107.** Down 544, an 84% drop. That is the number the task asked for.
- **Passing: 37 → 330.** Nearly 9x.
- **Hook timeouts: 36 → 0.**
- Failures rose 0 → 203 **because tests that never ran now run.** A skipped test reported
  nothing; these are reporting. See "What the 203 failures are" below — they are not new
  breakage, they are pre-existing breakage that was invisible.
- Test total fell 688 → 640 because 48 tests were deleted with cause (see Deletions).

---

## 1. The hook timeout — the task doc's stated cause is wrong

The task doc predicted: `beforeAll` "applies the migration journal… `supabase/migrations/`
has grown all year… 10 seconds is very likely no longer enough."

**Measured, before changing anything.** `createTestDb()` timed in isolation, three runs:

```
1.52s   1.15s   1.14s        (and on a second session: 1.95s  1.48s  2.59s)
```

**It does not replay migrations at all.** `createTestDb()` defaults to
`createTestDbFromSnapshot()`, which loads `test/db/fixtures/schema_snapshot.sql`. The
migration-replay path exists but only runs when a test passes `upTo`. Migration growth is
not the cause and was never going to be.

**The actual cause is contention.** Vitest had **no config file in the repo at all**, so
`hookTimeout` was its 10 000 ms default and file parallelism was one worker per core. 68
test files each stand up their own PGlite — a WASM Postgres — and on an 8 GB box with
~0.1 GB free they thrash. Evidence:

- Baseline reported `tests 828s` of test time inside `132s` of wall clock — ~6x oversubscription.
- The same setup measured **5.04s under full-suite load vs 1.14s idle**, and at suite start,
  when all workers load the snapshot simultaneously, past 10s.
- Re-running the unmodified suite gave 63/5, then 62/6, then 61/7, then 64/4. **A
  deterministic failure does not move between runs; a marginal timeout does.**

**Fix — `vitest.config.ts` (new file):** `hookTimeout: 60_000`, `testTimeout: 30_000`.
60s is ~25x the measured idle cost, so a loaded machine cannot reintroduce this.

Re-run immediately after this change alone, before touching anything else, as instructed:

```
Files  55 failed | 13 passed        Tests  88 failed | 172 passed | 428 skipped
Hook timeouts: 0
```

So the timeout accounted for **223 of the 651 skipped tests** — a third, not most of it.
The rest was masked behind it.

### Quantified, as asked: is the setup slow enough to need a big timeout?

**No — and that matters.** 1.1–2.6s per file is a reasonable per-file cost. The suite does
not need a shared prepared database, and I did not rebuild the harness. The 60s budget is
headroom against contention, not against a slow setup.

**Recommendation, not applied:** capping `maxWorkers` to 4 was measured and **changes
nothing about what passes** — identical results, identical wall clock — but cuts internal
test time from 1201s to 680s by reducing thrash. I deliberately left it out of the committed
config so bigger machines stay fast. If the suite is ever run on a memory-constrained CI
box, set it there.

---

## 2. The real headline: the snapshot fixture, not the timeout

Once the timeout was lifted, the dominant cause was one nobody had seen — **21 files dying
on `duplicate key value violates unique constraint "organizations_display_code_key"`.**

The task doc guessed this was "a test isolation problem: two tests creating an org with the
same display code, or state leaking between files." **It is not.** Each file gets its own
private in-memory PGlite; nothing leaks between them and no two tests race.

**The snapshot contains zero `setval` statements.** `grep -c setval` on the fixture returns
`0`. Sequences therefore load back at their start value while the seeded rows already carry
codes consumed from them. The seeded FHE organization holds `ORG-000001` and `org_code_seq`
restarts at 1, so the *first* organization any test inserted collided.

**Fix — `harness.ts`, `alignDisplayCodeSequences()`:** after the snapshot loads, advance
every display-code sequence past the codes its seed rows already hold. Driven off
`pg_trigger` rather than a hardcoded list, because seven other tables (bookings, clients,
contacts, contracts, deals, horses, purchases) use the same `assign_display_code` trigger
and a future snapshot regeneration that seeds one of them would otherwise reintroduce this
silently.

### The same fixture had a second, larger hole: reference data

`modules`, `tiers`, `tier_modules`, `horse_breeds`, `horse_colors`, `org_modules` and
`template_variants` are seeded **by migrations**. The snapshot path does not replay
migrations, and the snapshot's data allowlist (`SNAPSHOT_DATA_TABLES`, 7 tables) did not
include them — so they all loaded **empty**:

- `modules`/`tiers`/`tier_modules` empty → every `org_modules` / `products` insert failed on
  `*_module_key_fkey`, and `provision_tenant` raised `unknown tier: tier.boarding`.
- `horse_breeds` empty → `select code from horse_breeds limit 1` returned nothing, so tests
  read `.code` / `.display_name` off `undefined` (the task doc's "type errors" — they were
  never type errors, they were an empty table).
- `org_modules` empty → every `has_module()`-gated RLS policy denied, killing the module suites.
- `template_variants` empty → `mod_brokerage`'s live global-registry assertions found no rows.

**Fix:** pulled data-only from the live database (`lrstswfxfsezdmvkvukc`, read-only
`pg_dump`), appended to the snapshot under a commented section, and added to
`SNAPSHOT_DATA_TABLES`. **PII review, as that constant demands:** six of the seven are
global — no `org_id`, no personal data, just feature keys, plan tiers, breed/colour
vocabulary and token-override maps. The seventh, `org_modules`, is per-tenant, but the
tenant is the single organization the snapshot already carries and the rows are module keys
and booleans. Nothing added describes a person.

**This is the systemic finding.** The allowlist is a hand-maintained list, and every
migration-seeded reference table that isn't on it is a silent, latent suite failure. I found
seven by chasing failures. There is no guard that would catch the eighth.

---

## 3. Schema drift — `horses.barn_name` → `nickname`

25 usages across 13 test files. Renamed by
`supabase/migrations/20260717150000_rename_barn_to_nickname.sql`
(`ALTER TABLE public.horses RENAME COLUMN barn_name TO nickname;`), and the tests were never
updated. This is the task doc's "still exists, renamed → point the test at the current
thing" case. Applied mechanically; no behaviour changed.

---

## 4. Deletions — every one names what retired it

**48 tests across 5 files, plus 3 describe blocks and 1 test inside surviving files.**
Each was verified GONE against the live database, not assumed from the doc.

| Deleted | Tests | Retired by |
|---|---|---|
| `purchase_catalog_matrix.test.ts` | 8 | CLAUDE.md RETIRED, Files: *"`src/lib/catalog.ts` (the two hardcoded shadow catalogs — the catalog is DB-driven)"*; and *"There is no tier layer — it was removed 2026-07-08"* (`offering_tiers` = GONE) |
| `client_balance_read.test.ts` | 10 | Subject is the `transactions` payer-read policy. CLAUDE.md RETIRED: *"`transactions`"*. `transactions` = GONE |
| `settlement_rollup.test.ts` | 10 | Subject is the `billable_lines → transactions` INVOICE roll-up. Same line. `transactions` = GONE |
| `e2e_payment.test.ts` | 9 | Subject is the `orders`/`order_items` chain + `hold_slot` + `confirm_booking_for_order`. CLAUDE.md RETIRED: *"`orders`"*. All four = GONE |
| `client_self_signing.test.ts` | 7 | Subject is engagement RLS + `create_purchase_engagement`. CLAUDE.md RETIRED: *"`engagements`"*. Both = GONE |
| `mod_brokerage.test.ts` — 3 describes | 9 | `engagement_stages` + `create_search_/lease_/purchase_engagement`. CLAUDE.md RETIRED: *"`engagements`"*. All = GONE. **The file survives** — its `template_variants` coverage is live and now passes 5/5 |
| `mod_horserecords.test.ts` — 1 test | 1 | *"an ENGAGEMENT owner resolves true for the engagement's horse"* — verified against the live `caller_owns_horse`, whose body no longer mentions engagements at all. The branch is gone, so the assertion is |

`mod_horserecords` went from 0 passing (whole file dead in `beforeAll`) to **17 of 18**.

---

## 5. Production defects — reported, NOT patched

Per the constraint: I did not change `src/` or any migration to make a test pass.

### D-1 (real, live) — a seal trigger references a dropped column

`block_settled_billable_line_update()` is a **live trigger on the live table
`billable_lines`**, and its body tests `NEW.transaction_id IS DISTINCT FROM
OLD.transaction_id`. **`billable_lines` has no `transaction_id` column** — it went with the
`transactions` retirement. Current columns: `id, org_id, payer_contact_id, source_kind,
source_id, horse_id, qty, unit_amount, amount, status, period, created_at, updated_at,
deleted_at, deleted_by`.

**Effect:** any UPDATE touching a row whose `OLD.status = 'SETTLED'` raises
`record "new" has no field "transaction_id"` instead of the intended
`billable_line % is settled and append-only`. The seal still blocks, but with a misleading
error — and a *legitimate* update to a settled row (e.g. stamping `deleted_at`) fails too.
Non-SETTLED updates are unaffected (other `billable_lines` tests pass), so the AND
short-circuits. Caught by `products_billing.test.ts > billable_lines: SETTLED lines are
append-only (seal)`, which is left failing deliberately.

### D-2 (dead code, low severity) — an orphan function survives `orders`

`owns_order(uuid)` is `LANGUAGE sql` and does `SELECT 1 FROM orders o` — `orders` is GONE.
Old-style SQL function bodies are not dependency-tracked, which is why the DROP did not
catch it. **It is unreachable:** no RLS policy, no other function, no view and no code in
`src/` or `api/` references it. Cleanup, not breakage.

*Correction worth recording:* a first, looser scan suggested **nine** functions referencing
dropped tables. Eight were false — the matches were JSON keys (`'orders', v_orders`) and
comments. Only `owns_order` genuinely queries a dropped table. I nearly reported eight
defects that do not exist.

---

## 6. Harness limitation — reported, not fixed, as instructed

**The snapshot carries no privileges.** `grep -c '^GRANT'` and `grep -c '^REVOKE'` both
return `0`. It was dumped without them, and `BOOTSTRAP` in `harness.ts` blanket-grants
`ALL` on every table to `anon`/`authenticated` so that RLS rather than a missing GRANT is
what's under test.

**Consequence: every test asserting a table-level REVOKE cannot pass on the snapshot path,
no matter how correct production is.** ~16 failures are this — the "promise resolved
instead of rejecting" cluster: `horse_relationships` hard-delete, `consumption_events`
append-only, `shifts`/`time_entries` hard-delete, `horses` hard-delete, sealed signatures.

Verified for one: production grants `authenticated`/`anon` exactly
`INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` on `horse_relationships` — **DELETE
is genuinely revoked. The test is right, production is right, and the harness cannot express
the assertion.** Fixing it means either dumping privileges into the snapshot or narrowing
BOOTSTRAP's blanket grant — a harness change, which this task forbids. **Reporting and
stopping.**

---

## 7. What the 203 failures are

Grouped so this is actionable rather than a number. None are regressions from this task —
all are pre-existing conditions that 651 skipped tests were hiding.

| Cluster | ~Count | What it is |
|---|---|---|
| REVOKE/privilege assertions | 16 | §6 above — harness cannot express them |
| `relation "…" does not exist` | 9 | More retired tables inside otherwise-live files |
| Module-set premise is stale | ~10 | Tests assert FHE has `mod.barnops`/`mod.employees` **OFF**. Production has **all six** `mod.*` enabled. The gate mechanism is fine; the vehicle is out of date — they need a rival org as the OFF case |
| `start_lease_contract` / `start_broker_contract` / `start_purchase_contract` / `settle_billable_lines` missing | 4 | `start_broker_contract` is on CLAUDE.md's RETIRED function list; the others need checking against the current contract spine |
| Assorted assertion drift | rest | Labels, counts, ordering — each needs reading individually |

---

## 8. Blocked — needs a decision, deliberately not guessed

**8 files still die in `beforeAll` on a retired *setup* helper while their actual subject is
live.** They are NOT deletable without losing real coverage, and NOT mechanically fixable.

- On `provision_lesson_invitation` (GONE): `esign_hardening`, `lesson_sessions`,
  `membership_self_heal`, `minor_onboarding`, `notifications`, `request_inbox`,
  `rider_onboarding`
- On `engagements` / `create_purchase_engagement` (GONE): `company_party_and_org_tokens`,
  `liability_releases`

Their subjects — `record_signature`, `sign_release`, `sign_general_release`,
`update_my_onboarding_profile`, `generate_my_onboarding_documents`, `my_onboarding_state`,
`ensure_my_membership`, `notify_user`, `my_notifications`, `append_request_note`,
`set_request_checklist`, `schedule_/complete_/cancel_lesson_session` — are **all LIVE**.

**Why I stopped rather than rewriting them:** the replacement spine is
`provision_client_invitation(text,text,text,text[],uuid[],text[],boolean,text,text,uuid,uuid,numeric)`
— twelve parameters and different semantics from the seven-parameter function these tests
were built on. Their downstream assertions also read `engagements`, `transactions` and
`client_purchases`, all gone. Repointing them is **authoring new fixtures**, not fixing a
stale reference, and the task's rule against writing tests that merely assert whatever the
code currently does applies squarely.

**And the finding that makes this urgent: `provision_client_invitation` — the canonical
account-provisioning spine, the single path all account creation is supposed to run
through — has ZERO test coverage.** `grep -rl provision_client_invitation test/db/` returns
nothing. Every provisioning test in the suite is written against a function that no longer
exists. That is a follow-up task worth opening on its own.

---

## Acceptance

1. ✅ Before/after counts reported for files, tests, passed, failed and **skipped**; skipped
   dropped 651 → 107.
2. ✅ Hook timeout diagnosed by **measurement** (1.14–2.59s idle vs 5.04s under load vs a
   10 000 ms default), and the suite re-run after that change alone before the tail was
   touched.
3. ✅ Every deletion names the CLAUDE.md line that retired it, and each was verified GONE
   against the live database.
4. ✅ **No test silenced.** `git diff` introduces no `.skip` and no `.only`. Everything
   unfixed fails loudly.
5. ✅ Production defects (D-1, D-2) reported, not patched. No `src/` file and no migration
   was touched. `ClauseDocument.tsx` untouched.

`npm run typecheck` clean. `npx eslint test/db` clean.
