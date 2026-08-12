# TASK LEASESET — report

**Thread:** LEASESET · **Branch:** `task/leaseset` · **Worktree:** `wt-leaseset`
**Base:** `origin/main` @ `16f2516` (`docs: D10 — lease family ruling ... ; LEASESET spec` —
this is the commit that introduced the task doc and the D10 entry itself; no newer
commit existed on `origin/main` at fetch time).
**Applied to production** (`lrstswfxfsezdmvkvukc`). Dry-run first (`BEGIN … ROLLBACK`),
then applied (`BEGIN … COMMIT`), then verified with a fresh query. Not pushed, per
instructions.

---

## Outcome in one line

`HORSE_LEASE_V2` is titled **"Horse Lease Agreement — Standard"**, `HORSE_LEASE_STANDARD`
is deactivated (163 clause rows intact), `HORSE_LEASE_FULL` reads **"...Detailed"**, and
`HORSE_LEASE`'s retention as a never-activate historical reference is now written down in
two places. The 6 live `HORSE_LEASE_V2` documents are **byte-identical before and after** —
proven below, not asserted. No clause content changed anywhere.

---

## What changed

### 1. Migration — `supabase/migrations/20260811T1800_leaseset_standard_simple_detailed_archive.sql`

Three `UPDATE`s on `contract_templates`, no temp table (nothing here needed one), no
self-contained `COMMIT;` inside the file:

```sql
UPDATE contract_templates SET title = 'Horse Lease Agreement — Standard'
 WHERE template_key = 'HORSE_LEASE_V2';

UPDATE contract_templates SET active = false
 WHERE template_key = 'HORSE_LEASE_STANDARD';

UPDATE contract_templates SET title = 'Horse Lease Agreement — Detailed'
 WHERE template_key = 'HORSE_LEASE_FULL';
```

`HORSE_LEASE_SIMPLE` — no row touched, confirmed unchanged in the verify query below.

`HORSE_LEASE`'s archive status is **not** a fifth `UPDATE`. It was already
`active = false`; nothing about its row needed to change. Its retention is recorded as a
comment block in the migration file (reproduced in full at the top of the file) plus the
doc note below — that satisfies "checked first, no `archived` column added, because none
exists" (confirmed by reading the original `CREATE TABLE contract_templates` in
`20260629040000_contract_templates_tokens.sql`: `id, template_key, title, service_type,
party_namespaces, body, version, active, created_at, updated_at, deleted_at, deleted_by`
— no archived/retired boolean, then or now).

### 2. `supabase/contract_templates/HORSE_LEASE.md` — the lockstep + archive note

Added a callout block at the top, above the existing "retired flat template" pointer
content (which is untouched): states the three-key lockstep set
(`HORSE_LEASE_V2` + `HORSE_LEASE_SIMPLE` + `HORSE_LEASE_FULL`), that `HORSE_LEASE_STANDARD`
must not receive content updates, and that `HORSE_LEASE` is retained as historical
reference / resurrectable wording and is never to be activated or used to generate a
document. This is the file `CLAUDE.md` already names as "read before touching lease
wording," so a future `leasefix`-style migration author sees the three-key list before
pasting a four-key `IN (...)`.

### 3. `src/pages/app/ops/NewContractPage.tsx` — the picker, minimal fix

The task flagged that with `HORSE_LEASE_STANDARD` gone, the "Lease version" picker becomes
**Default + three**, and "Default" is the exact label the owner rejected. Fix, kept
minimal:

- Removed the hardcoded `<option value="">Default</option>`.
- Changed the initial `leaseTemplateKey` state from `''` to `'HORSE_LEASE_V2'`.

Before, `''` meant "send no `p_template_key`, let the RPC default apply." I checked what
that default actually is —
`start_lease_contract_v2(..., p_template_key text DEFAULT 'HORSE_LEASE_V2')`
(`20260809T1100_leasefix_default_value_and_partial_only.sql`) — so defaulting the picker's
state to the literal key `'HORSE_LEASE_V2'` is **behaviourally identical**: the select now
shows "Horse Lease Agreement — Standard" pre-selected (sourced from the same
`listLeaseTemplates()` row, no duplicate/synthetic option), and submitting sends an
explicit `p_template_key: 'HORSE_LEASE_V2'` instead of omitting the argument — same
outcome, RPC-side default unchanged and untouched. The picker now reads **Standard /
Detailed / Simple**, never "Default." This is a UI-only, non-DB change; not covered by the
"prove with SQL" requirement, and per the task's own instruction I have **not** verified it
in a browser (no staff session available) — reported as **NOT VERIFIED** below, exactly as
instructed.

Files explicitly off-limits and confirmed untouched: `AppLayout.tsx`, `DataTable.tsx`, the
documents queue table/page, `ClauseDocument.tsx`. `git diff --stat` for this branch touches
exactly the three files above.

---

## Proof: dry-run, apply, verify

### Before (measured, matches the task doc's table exactly)

```
     template_key     |                 title                 | active | body_len | clauses | docs
-----------------------+---------------------------------------+--------+----------+---------+------
 HORSE_LEASE           | Horse Lease Agreement                 | f      |    18253 |       0 |    0
 HORSE_LEASE_FULL      | Horse Lease Agreement — Comprehensive | t      |       23 |     163 |    0
 HORSE_LEASE_SIMPLE    | Horse Lease Agreement — Simple         | t      |       23 |     163 |    0
 HORSE_LEASE_STANDARD  | Horse Lease Agreement — Standard      | t      |       23 |     163 |    0
 HORSE_LEASE_V2        | Horse Lease Agreement                 | t      |       23 |     163 |    6
```

### Dry-run (`BEGIN … ROLLBACK`) — produced the target state, then rolled back

```
UPDATE 1
UPDATE 1
UPDATE 1
     template_key     |              title                | active | body_len | clauses | docs
-----------------------+-----------------------------------+--------+----------+---------+------
 HORSE_LEASE           | Horse Lease Agreement             | f      |    18253 |       0 |    0
 HORSE_LEASE_FULL      | Horse Lease Agreement — Detailed  | t      |       23 |     163 |    0
 HORSE_LEASE_SIMPLE    | Horse Lease Agreement — Simple    | t      |       23 |     163 |    0
 HORSE_LEASE_STANDARD  | Horse Lease Agreement — Standard  | f      |       23 |     163 |    0
 HORSE_LEASE_V2        | Horse Lease Agreement — Standard  | t      |       23 |     163 |    6
ROLLBACK
```

Documents queried inside the same dry-run transaction (post-UPDATE, pre-ROLLBACK) matched
the before-snapshot on every column, byte for byte — see the diff below, which is the same
comparison run again after the real apply.

### Applied (`BEGIN … COMMIT`)

```
BEGIN
UPDATE 1
UPDATE 1
UPDATE 1
COMMIT
```

### Verify — fresh query after apply

```
     template_key     |              title                | active | body_len | clauses | docs
-----------------------+-----------------------------------+--------+----------+---------+------
 HORSE_LEASE           | Horse Lease Agreement             | f      |    18253 |       0 |    0
 HORSE_LEASE_FULL      | Horse Lease Agreement — Detailed  | t      |       23 |     163 |    0
 HORSE_LEASE_SIMPLE    | Horse Lease Agreement — Simple    | t      |       23 |     163 |    0
 HORSE_LEASE_STANDARD  | Horse Lease Agreement — Standard  | f      |       23 |     163 |    0
 HORSE_LEASE_V2        | Horse Lease Agreement — Standard  | t      |       23 |     163 |    6
```

Matches every line of "THE TEST THIS MUST PASS" §1–4:
- `HORSE_LEASE_V2`: title "...Standard", **6** docs, **163** clauses, `active = true`. ✅
- `HORSE_LEASE_STANDARD`: `active = false`, **163** clause rows still present. ✅
- `HORSE_LEASE_FULL`: "Detailed". `HORSE_LEASE_SIMPLE`: unchanged, both active. ✅
- `HORSE_LEASE`: still inactive, still **18,253** chars, retention now written down
  (migration comment + `HORSE_LEASE.md`). ✅

### `listLeaseTemplates()` query, run directly against prod

```sql
SELECT template_key, title, active
FROM contract_templates
WHERE contract_kind = 'HORSE_LEASE' AND active = true AND deleted_at IS NULL
ORDER BY title;
```

```
    template_key    |              title                | active
---------------------+-----------------------------------+--------
 HORSE_LEASE_FULL    | Horse Lease Agreement — Detailed  | t
 HORSE_LEASE_SIMPLE  | Horse Lease Agreement — Simple    | t
 HORSE_LEASE_V2      | Horse Lease Agreement — Standard  | t
```

**Three rows.** ✅ (§5 of the test)

### The 6 live documents — before vs. after, byte-identical

Captured `id, template_id, status, signed_template_version, md5(merged_body)` for every
document with `template_id = (SELECT id FROM contract_templates WHERE template_key =
'HORSE_LEASE_V2')`, before the migration and again after:

```
                  id                  |             template_id              |       status        | signed_template_version |             body_md5
---------------------------------------+---------------------------------------+---------------------+--------------------------+-----------------------------------
 215bac09-9f66-43ce-8655-85fd05fea1e2  | 2ccc055b-f6fc-4af3-b25d-4f74f8246643  | AWAITING_SIGNATURE  |                          | f089bb90788affb350b7c6f20b20f133
 704c8d2d-d179-43f9-8a4a-7ea8cb920ab9  | 2ccc055b-f6fc-4af3-b25d-4f74f8246643  | AWAITING_SIGNATURE  |                          | 094aa90ed13439271de213e3e4fc73ba
 9a56b738-36f7-4a55-a813-cdd17fe4d753  | 2ccc055b-f6fc-4af3-b25d-4f74f8246643  | VOID                |                          | a7268382b18379af4af54f46bcb1b3c8
 b7233813-d56d-4410-8628-7612679653c1  | 2ccc055b-f6fc-4af3-b25d-4f74f8246643  | VOID                |                          | 256ce68b6f5e40b361c60609bfc3e372
 e1052bae-c20c-47e3-8703-7ef64f2bf852  | 2ccc055b-f6fc-4af3-b25d-4f74f8246643  | AWAITING_SIGNATURE  |                          | c0c52d6d7d031f7d0ae20a7b5f58ba12
 ecaecd42-0d82-428b-b72f-b73b0cc3f9f3  | 2ccc055b-f6fc-4af3-b25d-4f74f8246643  | EXECUTED            |            1             | bbaf0d0c40f2086a1dfd5fec01ea638e
```

Ran `diff` on the raw `psql` output captured before the migration and captured again after
apply: **zero lines differ.** Same 6 ids, same single `template_id` (the row we retitled,
not re-keyed — confirms the "title only" claim structurally, not just by assertion), same
statuses (including the one `EXECUTED` document, `signed_template_version = 1`,
untouched), same `merged_body` hashes. (§6 of the test.)

---

## Build health

`npm run typecheck` (frontend): **0 errors.**
`npm run lint`: **0 errors**, 36 pre-existing warnings, none in `NewContractPage.tsx` or
any file this task touched.

---

## What I did not do, and why

- **Did not deactivate `HORSE_LEASE_SIMPLE` or `HORSE_LEASE_FULL`.** The owner explicitly
  ruled three byte-identical active copies is the correct state until he modifies one.
- **Did not add an `archived` column.** Checked the original `CREATE TABLE
  contract_templates` — no such column ever existed, on this table. A comment (migration
  + doc) is the record, per instruction.
- **Did not touch `contract_clause_defs` / `contract_field_defs`.** Zero rows written to
  either table by this migration — confirmed by the `UPDATE 1 / UPDATE 1 / UPDATE 1`
  output (three template-row updates, nothing else).
- **Did not verify the picker in a browser.** No staff session exists per the constraints.
  Reported as **NOT VERIFIED**, as instructed. The `git diff` for `NewContractPage.tsx` is
  small (12 lines) and reasoned through above; `listLeaseTemplates()` itself — the data the
  picker renders — is proven against prod.
- **Did not push.** Branch `task/leaseset` has one migration commit plus this report,
  local only.
