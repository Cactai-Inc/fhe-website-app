# TASK LEASEFORK — report (Phases 1–2)

**Branch:** `task/leasefork` — own worktree off `origin/main` (`b8b078a`)
**Database:** `db.lrstswfxfsezdmvkvukc.supabase.co` (prod)
**Applied:** Phases 1–2 at 2026-08-07 20:33:56 UTC; Phase 3 later the same day.
**Status:** All three phases **DONE and applied to prod**. Phase 3 was started only
after orchestrator approval, per the stop-and-report instruction.

Zero content changes. All three forks are byte-identical to `HORSE_LEASE_V2`.

Two defects are recorded below:
- §7 — a **pre-existing** dead gate in `HORSE_LEASE_V2`, reported and **not fixed**
  (content is out of scope).
- §14 — a defect **I introduced in Phase 1**: `clone_contract_template` was
  executable by unauthenticated (`anon`) callers. Found during Phase 3, proven,
  and fixed. It was live in prod for roughly the duration of this task.

---

## 0. Ground truth re-checked before cloning

The task said to confirm, not re-derive, its stated ground truth. Every item was
re-checked against prod. All confirmed, **plus one table the original list missed**.

```
                  id                  |  template_key  |         title         | version | active | contract_kind
--------------------------------------+----------------+-----------------------+---------+--------+---------------
 2ccc055b-f6fc-4af3-b25d-4f74f8246643 | HORSE_LEASE_V2 | Horse Lease Agreement |       1 | t      | HORSE_LEASE
```

Content counts and satellite counts, pre-clone:

```
               t                | count
--------------------------------+-------
 category_document_requirements |     0
 contact_required_documents     |     0
 contract_clause_defs           |   144
 contract_field_defs            |   117
 contract_requirements          |     0
 contract_role_documents        |     0
 contract_section_defs          |    22
 template_variants              |     0
 template_version_events        |     0
```

22 / 144 / 117 as stated; all six named satellites are zero.

**Correction to the ground truth — a seventh satellite table exists.** The task
listed six satellite tables. An exhaustive scan for *every* table in `public`
carrying a `template_key` or `template_id` column found one more that the list
omitted: **`template_tokens`**, which keys on `template_id` (not `template_key`)
and so would not surface in a `template_key` sweep:

```
           table_name           | column_name
--------------------------------+--------------
 category_document_requirements | template_key
 contact_required_documents     | template_key
 contract_clause_defs           | template_key
 contract_field_defs            | template_key
 contract_requirements          | template_key
 contract_role_documents        | template_key
 contract_section_defs          | template_key
 contract_templates             | template_key
 documents                      | template_id
 template_tokens                | template_id
 template_variants              | template_key
 template_version_events        | template_key
```

`template_tokens` holds 307 rows overall but **zero** for `HORSE_LEASE_V2`:

```
 template_tokens_for_v2
------------------------
                      0
```

So the conclusion the task drew still holds — the fork really is four tables — but
it holds for seven zero-count satellites, not six. Had `template_tokens` been
non-zero I would have stopped, as instructed.

**No clone/duplicate helper existed** — confirmed, a search over `pg_proc` for
`%clone%` / `%duplicate%` / `%copy%template%` in `public` returned nothing.

**`start_lease_contract_v2` hardcodes the key in 4 places** (not 1) — see §8.

---

## 1. Phase 1 — the mechanism

`supabase/migrations/20260807120000_leasefork_clone_contract_template.sql`

```
clone_contract_template(p_source_key text, p_new_key text, p_new_title text) RETURNS jsonb
```

One transaction, four tables: `contract_templates` → `contract_section_defs` →
`contract_clause_defs` → `contract_field_defs`. New id, new key, new title,
`version` reset to 1; `deleted_at`/`deleted_by` start clean; everything else on the
template row (`service_type`, `party_namespaces`, `body`, `active`, `wall_gating`,
`contract_kind`) copies verbatim.

Fidelity decisions, and why:

- `section_key` / `clause_key` / `field_key` copy **verbatim, no re-prefixing**.
  Each def table has a `UNIQUE (template_key, *_key)` constraint, so the keys are
  already namespaced by template — renaming them would break every `conditional_on`
  gate for no benefit. §5 proves the gates still resolve inside each fork.
- `conditional_on`, `options`, `responsibility` copy as jsonb values.
- `parent_field_key` and `clause_key` on fields are intra-template references and
  stay verbatim so they resolve inside the clone.
- `sort_order` copies exactly.

Safety decisions:

- **Refuses** if `p_new_key` exists — and it checks the three def tables too, not
  just `contract_templates`, so a half-cleaned key cannot be silently completed.
- Refuses a missing source, and refuses cloning a key onto itself.
- `SECURITY DEFINER` is **required**, not stylistic: `contract_section_defs` and
  `contract_clause_defs` carry SELECT-only RLS policies with no write policy at
  all, so even an admin cannot insert into them under RLS. Callers are gated with
  `auth.uid() IS NOT NULL AND NOT is_admin() → raise`; a NULL `auth.uid()` is the
  direct-psql/migration path, the same convention `profiles_role_guard` uses.
- `REVOKE ALL FROM public`, `GRANT EXECUTE TO authenticated`.

Returns a jsonb receipt with the new id and per-table counts so a caller can assert
on numbers rather than trust them.

---

## 2. Phase 2 — the three forks

`supabase/migrations/20260807121000_leasefork_three_lease_forks.sql`

| New key | Title | id (live) |
|---|---|---|
| `HORSE_LEASE_STANDARD` | Horse Lease Agreement — Standard | `48984c98-a21c-4d97-acb6-0ae5bb2bc043` |
| `HORSE_LEASE_FULL` | Horse Lease Agreement — Comprehensive | `5c728823-057a-47bb-961a-1d42b27ab50e` |
| `HORSE_LEASE_SIMPLE` | Horse Lease Agreement — Simple | `7cfdea76-2ae3-4646-8696-d9e69779e6a7` |

---

## 3. Dry-run (BEGIN … ROLLBACK), raw output

Both migration files were dry-run verbatim inside a transaction before being
applied. Negative cases are wrapped in savepoints (an unguarded `RAISE` aborts the
whole transaction — the first attempt did exactly that and applied nothing).

```
BEGIN
===== 1. install clone_contract_template =====
CREATE FUNCTION
REVOKE
GRANT

===== 2. NEGATIVE: refuses a missing source =====
SAVEPOINT
ERROR:  source template NO_SUCH_TEMPLATE does not exist
CONTEXT:  PL/pgSQL function clone_contract_template(text,text,text) line 20 at RAISE
ROLLBACK

===== 3a. NEGATIVE: refuses cloning onto itself =====
SAVEPOINT
ERROR:  cannot clone HORSE_LEASE_V2 onto itself
CONTEXT:  PL/pgSQL function clone_contract_template(text,text,text) line 16 at RAISE
ROLLBACK

===== 3b. NEGATIVE: refuses an existing target key (HORSE_SALE_V2) =====
SAVEPOINT
ERROR:  template key HORSE_SALE_V2 already exists; clone refuses to merge or overwrite
CONTEXT:  PL/pgSQL function clone_contract_template(text,text,text) line 29 at RAISE
ROLLBACK

===== 4. the three clones =====
 {
     "fields": 117,
     "clauses": 144,
     "sections": 22,
     "source_key": "HORSE_LEASE_V2",
     "template_id": "fe44ec72-d2f9-4df9-aa77-d77760857716",
     "template_key": "HORSE_LEASE_STANDARD"
 }
 {
     "fields": 117,
     "clauses": 144,
     "sections": 22,
     "source_key": "HORSE_LEASE_V2",
     "template_id": "b6474fb5-ded7-44f3-be48-17617b7c65f9",
     "template_key": "HORSE_LEASE_FULL"
 }
 {
     "fields": 117,
     "clauses": 144,
     "sections": 22,
     "source_key": "HORSE_LEASE_V2",
     "template_id": "010278b7-6cfa-4683-b451-e2de2b03ed45",
     "template_key": "HORSE_LEASE_SIMPLE"
 }

===== 5. NEGATIVE: refuses to re-clone over a fork it just made =====
SAVEPOINT
ERROR:  template key HORSE_LEASE_SIMPLE already exists; clone refuses to merge or overwrite
CONTEXT:  PL/pgSQL function clone_contract_template(text,text,text) line 29 at RAISE
ROLLBACK
```

(ids in the dry-run differ from the applied ids — the dry-run was rolled back and
`gen_random_uuid()` ran again on apply. That is expected.)

Rollback proven — after `ROLLBACK` only the two pre-existing lease templates remain:

```
ROLLBACK
===== ROLLED BACK =====
  template_key
----------------
 HORSE_LEASE
 HORSE_LEASE_V2
(2 rows)
```

Em-dash handling was dry-run separately under `PGCLIENTENCODING=UTF8` (the titles
contain U+2014); `chars` vs `bytes` differing by exactly 2 confirms one 3-byte
character stored, not mojibake:

```
     template_key     |                 title                 | chars | bytes
----------------------+---------------------------------------+-------+-------
 HORSE_LEASE_FULL     | Horse Lease Agreement — Comprehensive |    37 |    39
 HORSE_LEASE_SIMPLE   | Horse Lease Agreement — Simple        |    30 |    32
 HORSE_LEASE_STANDARD | Horse Lease Agreement — Standard      |    32 |    34
```

## 3b. Apply, raw output

```
CREATE FUNCTION
REVOKE
GRANT
 {"fields": 117, "clauses": 144, "sections": 22, "source_key": "HORSE_LEASE_V2", "template_id": "48984c98-a21c-4d97-acb6-0ae5bb2bc043", "template_key": "HORSE_LEASE_STANDARD"}
 {"fields": 117, "clauses": 144, "sections": 22, "source_key": "HORSE_LEASE_V2", "template_id": "5c728823-057a-47bb-961a-1d42b27ab50e", "template_key": "HORSE_LEASE_FULL"}
 {"fields": 117, "clauses": 144, "sections": 22, "source_key": "HORSE_LEASE_V2", "template_id": "7cfdea76-2ae3-4646-8696-d9e69779e6a7", "template_key": "HORSE_LEASE_SIMPLE"}
```

---

## 4. Fidelity evidence (live, post-apply)

### 4a. Content fingerprints

md5 over the ordered content of each table, excluding only `id`, `template_key` and
`created_at` (which must differ on a clone) and `title` (which differs by design).
Identical hashes across a column = byte-identical content.

```
     template_key     | n_sec | n_cls | n_fld |           sections_md5           |           clauses_md5            |            fields_md5            |           tmplrow_md5            |         clause_gates_md5         | n_clause_gates |         field_gates_md5          | n_field_gates
----------------------+-------+-------+-------+----------------------------------+----------------------------------+----------------------------------+----------------------------------+----------------------------------+----------------+----------------------------------+---------------
 HORSE_LEASE_V2       |    22 |   144 |   117 | 0dd8caa0aabee98e13fdae5bd802898d | 960a73fc61d9b6a1b07246bf3f1af447 | f5b75f4d0097e8e47eafe8da04066941 | b6c60f32a23927760fafa393087d6bc9 | 217e1459e67522a9a4b242468fb59c7b |             76 | 1961ac012cbd08a8d58e4d921bd8b76a |            40
 HORSE_LEASE          |     0 |     0 |    98 |                                  |                                  | d52a33ba052de53eaed16acac1d8f201 | ac501fc7b048cabfdeb342d19823a8e4 | 768db64cd9f462410c9e4255c9be900d |              0 | 768db64cd9f462410c9e4255c9be900d |             0
 HORSE_LEASE_FULL     |    22 |   144 |   117 | 0dd8caa0aabee98e13fdae5bd802898d | 960a73fc61d9b6a1b07246bf3f1af447 | f5b75f4d0097e8e47eafe8da04066941 | b6c60f32a23927760fafa393087d6bc9 | 217e1459e67522a9a4b242468fb59c7b |             76 | 1961ac012cbd08a8d58e4d921bd8b76a |            40
 HORSE_LEASE_SIMPLE   |    22 |   144 |   117 | 0dd8caa0aabee98e13fdae5bd802898d | 960a73fc61d9b6a1b07246bf3f1af447 | f5b75f4d0097e8e47eafe8da04066941 | b6c60f32a23927760fafa393087d6bc9 | 217e1459e67522a9a4b242468fb59c7b |             76 | 1961ac012cbd08a8d58e4d921bd8b76a |            40
 HORSE_LEASE_STANDARD |    22 |   144 |   117 | 0dd8caa0aabee98e13fdae5bd802898d | 960a73fc61d9b6a1b07246bf3f1af447 | f5b75f4d0097e8e47eafe8da04066941 | b6c60f32a23927760fafa393087d6bc9 | 217e1459e67522a9a4b242468fb59c7b |             76 | 1961ac012cbd08a8d58e4d921bd8b76a |            40
```

All four lease-content hashes and both gate-only hashes are identical across
`HORSE_LEASE_V2` and the three forks. 76 clause gates and 40 field gates each.

(`HORSE_LEASE` in that table is the retired flat template — `active=false`,
soft-deleted 2026-08-02. It is unrelated to this task and untouched; it appears
only because it shares `contract_kind='HORSE_LEASE'`. Note it holds 98 orphan
`contract_field_defs` rows with zero sections and zero clauses — a pre-existing
leftover, **not** touched here.)

### 4b. Row-by-row multiset diff, both directions

A hash collision is not evidence, so the same claim is made a second way: an
`EXCEPT ALL` in **both** directions, per table, per fork, over every content column.

```
         fork         |   tbl    |    direction    | differing_rows
----------------------+----------+-----------------+----------------
 HORSE_LEASE_FULL     | clauses  | fork_not_in_src |              0
 HORSE_LEASE_FULL     | clauses  | src_not_in_fork |              0
 HORSE_LEASE_FULL     | fields   | fork_not_in_src |              0
 HORSE_LEASE_FULL     | fields   | src_not_in_fork |              0
 HORSE_LEASE_FULL     | sections | fork_not_in_src |              0
 HORSE_LEASE_FULL     | sections | src_not_in_fork |              0
 HORSE_LEASE_SIMPLE   | clauses  | fork_not_in_src |              0
 HORSE_LEASE_SIMPLE   | clauses  | src_not_in_fork |              0
 HORSE_LEASE_SIMPLE   | fields   | fork_not_in_src |              0
 HORSE_LEASE_SIMPLE   | fields   | src_not_in_fork |              0
 HORSE_LEASE_SIMPLE   | sections | fork_not_in_src |              0
 HORSE_LEASE_SIMPLE   | sections | src_not_in_fork |              0
 HORSE_LEASE_STANDARD | clauses  | fork_not_in_src |              0
 HORSE_LEASE_STANDARD | clauses  | src_not_in_fork |              0
 HORSE_LEASE_STANDARD | fields   | fork_not_in_src |              0
 HORSE_LEASE_STANDARD | fields   | src_not_in_fork |              0
 HORSE_LEASE_STANDARD | sections | fork_not_in_src |              0
 HORSE_LEASE_STANDARD | sections | src_not_in_fork |              0
(18 rows)
```

### 4c. Clause bodies, byte-for-byte

Joined on `clause_key` and compared by md5 **and** by raw text equality:

```
     template_key     | body_mismatches | body_bytewise_mismatches | clauses_compared
----------------------+-----------------+--------------------------+------------------
 HORSE_LEASE_FULL     |               0 |                        0 |              144
 HORSE_LEASE_SIMPLE   |               0 |                        0 |              144
 HORSE_LEASE_STANDARD |               0 |                        0 |              144
```

### 4d. `{{TOKEN}}` inventory

Every `{{…}}` occurrence extracted from all clause bodies:

```
     template_key     | token_occurrences | distinct_tokens |            token_md5
----------------------+-------------------+-----------------+----------------------------------
 HORSE_LEASE_V2       |               122 |             114 | 4187bdc978d8c1d8831dd355f86237da
 HORSE_LEASE_FULL     |               122 |             114 | 4187bdc978d8c1d8831dd355f86237da
 HORSE_LEASE_SIMPLE   |               122 |             114 | 4187bdc978d8c1d8831dd355f86237da
 HORSE_LEASE_STANDARD |               122 |             114 | 4187bdc978d8c1d8831dd355f86237da
```

Raw spot check on the longest clause body:

```
template_key | HORSE_LEASE_V2
clause_key   | INSURANCE_RISK.MED_TAIL
chars        | 1193
bytes        | 1193
md5          | 720a08079a2180f6fb452afb4c953729

template_key | HORSE_LEASE_STANDARD
clause_key   | INSURANCE_RISK.MED_TAIL
chars        | 1193
bytes        | 1193
md5          | 720a08079a2180f6fb452afb4c953729
```

---

## 5. Gates resolve inside each fork

Hash equality proves the gates *copied*; it does not prove they still *resolve*.
Every `field_key` referenced anywhere inside a `conditional_on` (recursively,
through `all` / `any` nesting) was extracted and joined back against that same
template's own `contract_field_defs`:

```
     template_key     | gate_refs | distinct_fields_referenced | unresolved_refs
----------------------+-----------+----------------------------+-----------------
 HORSE_LEASE_FULL     |       234 |                         46 |               1
 HORSE_LEASE_SIMPLE   |       234 |                         46 |               1
 HORSE_LEASE_STANDARD |       234 |                         46 |               1
 HORSE_LEASE_V2       |       234 |                         46 |               1
```

234 gate references each, resolving to 46 distinct fields, **within the fork's own
key namespace** — no gate leaks back to `HORSE_LEASE_V2`. The single unresolved
reference is identical in the source and is a pre-existing defect, §7.

---

## 6. The original is untouched

### 6a. Template row — identical to the pre-clone capture, field for field

```
id               | 2ccc055b-f6fc-4af3-b25d-4f74f8246643
template_key     | HORSE_LEASE_V2
title            | Horse Lease Agreement
service_type     |
party_namespaces | {LESSOR,LESSEE}
version          | 1
active           | t
created_at       | 2026-07-20 21:54:38.254059+00
updated_at       | 2026-08-01 12:59:44.554188+00
deleted_at       |
deleted_by       |
wall_gating      | f
contract_kind    | HORSE_LEASE
body_md5         | af2572690e946d4358edd01d3eef3dce
body_len         | 23
```

Same id. `updated_at` still `2026-08-01 12:59:44.554188+00` — the
`contract_templates_set_updated_at` trigger would have moved it had any UPDATE
touched the row. It did not.

### 6b. Content counts unchanged, all satellites still zero

```
               t                | count
--------------------------------+-------
 category_document_requirements |     0
 contact_required_documents     |     0
 contract_clause_defs           |   144
 contract_field_defs            |   117
 contract_requirements          |     0
 contract_role_documents        |     0
 contract_section_defs          |    22
 template_tokens (by id)        |     0
 template_variants              |     0
 template_version_events        |     0
```

### 6c. Content checksums unchanged

Captured **before** any migration ran:

```
     tbl      | rows |           fingerprint
--------------+------+----------------------------------
 sections     |   22 | 0dd8caa0aabee98e13fdae5bd802898d
 clauses      |  144 | 960a73fc61d9b6a1b07246bf3f1af447
 fields       |  117 | f5b75f4d0097e8e47eafe8da04066941
 template_row |    1 | b6c60f32a23927760fafa393087d6bc9
```

Identical to the post-apply `HORSE_LEASE_V2` row in §4a.

### 6d. The 4 live documents still bound to it

Pre-clone and post-apply, byte for byte — same ids, same `template_id`, same
statuses, same `updated_at`, same `merged_body` md5 and length:

```
                  id                  |  display_code  |             template_id              |       status       | workflow_state | current_status  |          updated_at           |         merged_body_md5          |  len
--------------------------------------+----------------+--------------------------------------+--------------------+----------------+-----------------+-------------------------------+----------------------------------+-------
 ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | DOC-RXW6U9M3BF | 2ccc055b-f6fc-4af3-b25d-4f74f8246643 | EXECUTED           | executed       | signed          | 2026-08-05 02:57:12.994303+00 | bbaf0d0c40f2086a1dfd5fec01ea638e | 15086
 215bac09-9f66-43ce-8655-85fd05fea1e2 | DOC-VWRU4KUN93 | 2ccc055b-f6fc-4af3-b25d-4f74f8246643 | AWAITING_SIGNATURE | editable       | ready_to_sign   | 2026-08-04 17:11:41.955893+00 | 3bd270d540b71b781ed6748f0e172af1 | 25834
 704c8d2d-d179-43f9-8a4a-7ea8cb920ab9 | DOC-J7NXZDHD5F | 2ccc055b-f6fc-4af3-b25d-4f74f8246643 | AWAITING_SIGNATURE | in_review      | sent_for_review | 2026-08-05 04:24:07.803698+00 | 06b03a81a5b4b8fb653d5fb4058c98a4 | 22801
 9a56b738-36f7-4a55-a813-cdd17fe4d753 | DOC-U4PZP54FP5 | 2ccc055b-f6fc-4af3-b25d-4f74f8246643 | VOID               | void           | void            | 2026-08-06 10:21:11.043028+00 | a7268382b18379af4af54f46bcb1b3c8 | 20612
```

Count still 4; documents pointing at any fork: **0**.

**Sarah's live negotiation `704c8d2d-d179-43f9-8a4a-7ea8cb920ab9`** — read-only
throughout. `updated_at 2026-08-05 04:24:07.803698+00` and `merged_body` md5
`06b03a81a5b4b8fb653d5fb4058c98a4` are unchanged from the pre-clone capture. No
statement in this task wrote to `documents` at all.

### 6e. Independent evidence — the audit trail

`contract_templates` carries an `audit_row_change` trigger on INSERT/UPDATE/DELETE.
It recorded exactly three INSERTs and nothing else. There is **no UPDATE row**
against `HORSE_LEASE_V2`:

```
 action |              record_id               |          occurred_at          |       new_key        |       old_key
--------+--------------------------------------+-------------------------------+----------------------+---------------------
 INSERT | 7cfdea76-2ae3-4646-8696-d9e69779e6a7 | 2026-08-07 20:33:56.990982+00 | HORSE_LEASE_SIMPLE   |
 INSERT | 5c728823-057a-47bb-961a-1d42b27ab50e | 2026-08-07 20:33:56.990982+00 | HORSE_LEASE_FULL     |
 INSERT | 48984c98-a21c-4d97-acb6-0ae5bb2bc043 | 2026-08-07 20:33:56.990982+00 | HORSE_LEASE_STANDARD |
 DELETE | a9eb9922-7145-4bbe-93de-f9d6db775a19 | 2026-08-06 16:55:35.074421+00 |                      | HORSE_EXERCISE
 DELETE | 0c4c8d1c-310d-406e-8404-4b6cf9fa8e36 | 2026-08-06 16:55:35.074421+00 |                      | RIDER_LESSON
```

(the DELETEs are the prior day's `TASK-SVCPURGE`, not this task.)

### 6f. `start_lease_contract_v2` not touched

```
                  signature                   |             def_md5
----------------------------------------------+----------------------------------
 start_lease_contract_v2(uuid,uuid,uuid,text) | 60cf7214813dbf35aab2b37d9089fcdd
```

Still the 4-argument signature, no template parameter. This hash is the Phase 3
baseline to diff against.

---

## 7. Found and NOT fixed — a pre-existing dead gate in `HORSE_LEASE_V2`

The one unresolved gate reference from §5:

```
     template_key     |  src  |       owner       |     ref_field      |                     conditional_on
----------------------+-------+-------------------+--------------------+--------------------------------------------------------
 HORSE_LEASE_FULL     | field | TXN.MONTHLY_START | TXN.LEASE_FEE_TYPE | {"equals": ["FEE"], "field_key": "TXN.LEASE_FEE_TYPE"}
 HORSE_LEASE_SIMPLE   | field | TXN.MONTHLY_START | TXN.LEASE_FEE_TYPE | {"equals": ["FEE"], "field_key": "TXN.LEASE_FEE_TYPE"}
 HORSE_LEASE_STANDARD | field | TXN.MONTHLY_START | TXN.LEASE_FEE_TYPE | {"equals": ["FEE"], "field_key": "TXN.LEASE_FEE_TYPE"}
 HORSE_LEASE_V2       | field | TXN.MONTHLY_START | TXN.LEASE_FEE_TYPE | {"equals": ["FEE"], "field_key": "TXN.LEASE_FEE_TYPE"}
```

The field `TXN.MONTHLY_START` ("First monthly payment date") is gated on
`TXN.LEASE_FEE_TYPE`, **which does not exist** in the template. The nearest real
fields are `TXN.LEASE_FEE` (`input_kind = fee_schedule`) and `TXN.LEASE_TERM_TYPE`.

**Effect: the field can never appear.** Both gate evaluators resolve a missing key
to the empty string, so `equals: ["FEE"]` can never match:

- SQL — `clause_condition_met`: `v_raw := coalesce(v_fields ->> v_key, '')`
- TS — `clauseConditionMet` ([src/lib/contracts.ts:267](src/lib/contracts.ts#L267)):
  `const raw = fieldValues[cond.field_key] ?? ''`

So "First monthly payment date" is dead in the live lease today, and is faithfully
dead in all three forks. **This is a content defect and content is out of scope, so
I did not touch it** — fixing it in `HORSE_LEASE_V2` would edit the template that
is currently signing real leases, which is precisely what this task exists to
avoid. It is the kind of thing the Standard fork's insurance/fee work should sweep
up. Flagged for the orchestrator; needs an owner decision on what the gate was
*meant* to say before anyone changes it.

Related observation, also untouched: the retired `HORSE_LEASE` template (§4a) still
holds 98 orphan `contract_field_defs` rows with no sections and no clauses.

---

## 8. Phase 3 — scope as presented at the stop-and-report gate

This section is what was reported at the Phase 2 gate, before approval. Phase 3 as
built is §12–§15.

**`start_lease_contract_v2` hardcodes `HORSE_LEASE_V2` in 4 places, not 1:**

```
 hardcoded_v2_occurrences
--------------------------
                        4
```

They are: the `SELECT id INTO v_tmpl` lookup; the `'HORSE_LEASE_V2 template missing'`
error string; the `generate_document(...)` call; and the `contract_field_defs`
seed `WHERE d.template_key = 'HORSE_LEASE_V2'`. A parameter that changes only the
first would produce a document whose shell and seeded fields come from a *different*
template than its id claims. All four must move together.

**Call sites:** exactly one, plus its wrapper —
[api.ts:1933](src/lib/api.ts#L1933) `startLeaseContract()` → called once from
[NewContractPage.tsx:123](src/pages/app/ops/NewContractPage.tsx#L123). The RPC
takes named arguments, so an added `DEFAULT` parameter leaves that caller
byte-compatible.

**Picker feasibility** — all three forks are already visible to a
`contract_kind='HORSE_LEASE' AND active AND deleted_at IS NULL` filter, and the
retired flat template correctly falls out of it:

```
                  id                  |     template_key     |                 title                 | version | active |          deleted_at           | contract_kind
--------------------------------------+----------------------+---------------------------------------+---------+--------+-------------------------------+---------------
 8d33612d-1064-4336-a386-130d99a15f7f | HORSE_LEASE          | Horse Lease Agreement                 |       1 | f      | 2026-08-02 11:04:53.675525+00 | HORSE_LEASE
 5c728823-057a-47bb-961a-1d42b27ab50e | HORSE_LEASE_FULL     | Horse Lease Agreement — Comprehensive |       1 | t      |                               | HORSE_LEASE
 7cfdea76-2ae3-4646-8696-d9e69779e6a7 | HORSE_LEASE_SIMPLE   | Horse Lease Agreement — Simple        |       1 | t      |                               | HORSE_LEASE
 48984c98-a21c-4d97-acb6-0ae5bb2bc043 | HORSE_LEASE_STANDARD | Horse Lease Agreement — Standard      |       1 | t      |                               | HORSE_LEASE
 2ccc055b-f6fc-4af3-b25d-4f74f8246643 | HORSE_LEASE_V2       | Horse Lease Agreement                 |       1 | t      |                               | HORSE_LEASE
```

**One thing the orchestrator should decide before Phase 3:** `HORSE_LEASE_V2` and
the retired `HORSE_LEASE` share the title "Horse Lease Agreement". A picker listing
by title will show `HORSE_LEASE_V2` as an untitled-looking "Horse Lease Agreement"
next to three em-dashed variants. That is a labelling question, not a mechanism
question, and renaming `HORSE_LEASE_V2`'s title is explicitly forbidden by this
task — so I have neither done it nor assumed it.

---

---

# PHASE 3 (post-approval)

## 12. `CREATE OR REPLACE` cannot do this — proven, not assumed

The task specifies `start_lease_contract_v2(..., p_template_key text DEFAULT
'HORSE_LEASE_V2')`. `CREATE OR REPLACE FUNCTION` **cannot add a parameter**: a
different argument count creates an *overload*, and PostgreSQL then cannot resolve
a call made at the original arity. Left that way, every existing lease-start call
would break — the exact opposite of the requirement.

Proven live with toy functions of the same shape, in a rolled-back transaction —
first positionally, then with named arguments (the form PostgREST/`supabase.rpc`
emits, i.e. the real production call):

```
CREATE FUNCTION _probe(a int, b int DEFAULT 0) ...
CREATE FUNCTION _probe(a int, b int DEFAULT 0, c text DEFAULT 'X') ...

--- positional call with the ORIGINAL arity ---
ERROR:  function _probe(integer, integer) is not unique
HINT:  Could not choose a best candidate function.

--- named call, exactly how PostgREST/supabase.rpc invokes it ---
ERROR:  function _probe(a => integer, b => integer) is not unique
HINT:  Could not choose a best candidate function.

--- and after DROPping the old arity, the same named call resolves cleanly ---
DROP FUNCTION
    resolves_to
-------------------
 five-arg-analogue
```

So the migration does `DROP FUNCTION` + `CREATE FUNCTION` in one transaction: at no
point are there two candidates, and at no committed point are there none.

## 13. Phase 3 as built

`supabase/migrations/20260807140000_leasefork_start_lease_template_arg.sql`

Post-apply state — one function, five arguments:

```
                        sig                        |                                 proacl                                 |             def_md5
---------------------------------------------------+------------------------------------------------------------------------+----------------------------------
 start_lease_contract_v2(uuid,uuid,uuid,text,text) | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} | 1c11734d56fbb586398ac118a92f7956
```

The ACL is a byte-exact restore of the dropped function's ACL — asserted, not
eyeballed (§14 explains why this needed asserting):

```
 acl_exact_match
-----------------
 t

 candidates
------------
          1
```

### 13a. All four hardcoded sites moved together

Only the *declared default* still mentions the literal — the three usage sites and
the error string now read `v_key`:

```
-- lines still containing HORSE_LEASE_V2 --
 CREATE OR REPLACE FUNCTION public.start_lease_contract_v2(... p_template_key text DEFAULT 'HORSE_LEASE_V2'::text)
 v_key := coalesce(p_template_key, 'HORSE_LEASE_V2');

-- the former usage sites now read v_key --
 FROM contract_templates WHERE template_key = v_key;      <- lookup
 v_key, coalesce(v_kind, 'NULL');                          <- error message
 p_lessee_contact_id, v_key, v_contract, p_horse_id,       <- generate_document()
 WHERE d.template_key = v_key;                             <- contract_field_defs seed
```

### 13b. Validation rejects, never falls back

All three rejections raised under a simulated real staff session (CJ,
`admin@fhequestrian.com`), each in its own savepoint:

```
ERROR:  unknown contract template: NOPE
ERROR:  template HORSE_SALE_V2 is not a lease template (contract_kind = HORSE_SALE)
ERROR:  template HORSE_LEASE is not active
```

The third is the retired flat lease — right `contract_kind`, but inactive and
soft-deleted, so it is correctly refused.

### 13c. The default path is unchanged — task checklist item 3

The exact call [api.ts](src/lib/api.ts) makes today (three named arguments, **no**
template argument at all):

```
 {
     "contract_id": "9102754d-2046-4bab-a091-e92bcaebe706",
     "document_id": "79f9331c-793f-4188-b9ce-9052a21abb62",
     "template_key": "HORSE_LEASE_V2",
     "fields_seeded": 117
 }

 resolved_template |             template_id              |       status       | workflow_state | contract_fields_rows
-------------------+--------------------------------------+--------------------+----------------+----------------------
 HORSE_LEASE_V2    | 2ccc055b-f6fc-4af3-b25d-4f74f8246643 | AWAITING_SIGNATURE | editable       |                  122
```

An explicitly-passed `NULL` also resolves to the default (`HORSE_LEASE_V2`), since a
NULL argument is indistinguishable from an omitted one at the client boundary. That
is the documented default, not a fallback from an invalid value.

Two numbers that look inconsistent but are not: the RPC returns `fields_seeded: 117`
(the `contract_field_defs` seed it performs, matching the template's 117 field defs),
while the document ends up with **122** `contract_fields` rows. The extra 5 come from
paths the RPC calls afterwards, unchanged by this task. 122 is identical for
`HORSE_LEASE_V2` and all three forks, so the behaviour is the same everywhere.

### 13d. Each fork produces a document bound to that fork — checklist item 4

```
  resolved_template   |             template_id              |                 title                 | contract_fields_rows | body_len
----------------------+--------------------------------------+---------------------------------------+----------------------+----------
 HORSE_LEASE_FULL     | 5c728823-057a-47bb-961a-1d42b27ab50e | Horse Lease Agreement — Comprehensive |                  122 |    20004
 HORSE_LEASE_SIMPLE   | 7cfdea76-2ae3-4646-8696-d9e69779e6a7 | Horse Lease Agreement — Simple        |                  122 |    20004
 HORSE_LEASE_STANDARD | 48984c98-a21c-4d97-acb6-0ae5bb2bc043 | Horse Lease Agreement — Standard      |                  122 |    20004

-- every field_def of THAT fork was seeded (0 = none missing) --
     template_key     | defs_not_seeded
----------------------+-----------------
 HORSE_LEASE_FULL     |               0
 HORSE_LEASE_SIMPLE   |               0
 HORSE_LEASE_STANDARD |               0
```

### 13e. Discriminating provenance test

The above shows `template_id` binding, but because the forks are byte-identical it
does **not** by itself prove the composed *body* came from the chosen fork — every
fork would produce the same text either way. So: temporarily mark one clause in
`HORSE_LEASE_STANDARD` only (inside the transaction, rolled back), start one lease
against STANDARD and one against the default, and look for the marker:

```
UPDATE contract_clause_defs SET body = 'ZZMARKERZZ ' || body
 WHERE template_key='HORSE_LEASE_STANDARD' AND clause_key='ENTIRE_AGREEMENT.INTEGRATION';

   started_against    | body_has_STANDARD_only_marker
----------------------+-------------------------------
 HORSE_LEASE_STANDARD | t
 HORSE_LEASE_V2       | f
```

The marker appears in the STANDARD-authored body and not in the default one. That is
real provenance, not an id match. Rolled back — `HORSE_LEASE_STANDARD`'s clause
checksum returned to `9c287f24c012b7001087fb396128ba1d` and no clause anywhere
contains the marker (§16f).

Every lease started in this section was created inside `BEGIN … ROLLBACK`. Zero
documents persisted: `documents` totals 68 rows, and 0 point at any fork.

---

## 14. Defect I introduced in Phase 1, and fixed — `clone_contract_template` was open to `anon`

Found in Phase 3 while diffing function ACLs before and after the DROP/CREATE. The
recreated `start_lease_contract_v2` came back with an ACL *wider* than the one it
replaced:

```
before: {postgres=X,                authenticated=X, service_role=X}
after:  {postgres=X, anon=X,        authenticated=X, service_role=X}   <- anon appeared
```

Root cause — `pg_default_acl` on this database grants EXECUTE on every **new**
function in `public` to anon/authenticated/service_role:

```
 grantor  | schema | objtype |                             defaclacl
----------+--------+---------+-------------------------------------------------------------------
 postgres | public |    f    | {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

`REVOKE ALL ... FROM public` does **not** remove a grant held by the *role* `anon` —
PUBLIC and anon are different grantees. My Phase 1 migration used only that REVOKE.

That alone would have been harmless if the guard held. It did not. Phase 1's guard
read:

```sql
IF auth.uid() IS NOT NULL AND NOT is_admin() THEN RAISE ...
```

i.e. "a NULL `auth.uid()` means a trusted direct psql session". **That is false** —
an anonymous PostgREST request also has a NULL `auth.uid()`. So the guard passed for
anon, and the function is `SECURITY DEFINER`, so it ran as `postgres` and bypassed
RLS. Proven live, before the fix, in a rolled-back transaction:

```
SET LOCAL ROLE anon;
SELECT current_user, auth.uid(), is_admin();
 running_as | uid | admin
------------+-----+-------
 anon       |     | f

SELECT clone_contract_template('HORSE_LEASE_V2','ANON_PROOF_OF_CONCEPT','anon reached it');
 {"fields": 117, "clauses": 144, "sections": 22, ... "template_key": "ANON_PROOF_OF_CONCEPT"}

-- did an unauthenticated caller create a template? --
     template_key      |      title
-----------------------+-----------------
 ANON_PROOF_OF_CONCEPT | anon reached it
```

An unauthenticated caller could mint contract templates. Scope of the exposure: the
function only ever INSERTs and refuses an existing key, so nothing existing could be
read, modified or destroyed — but it was writable surface that should never have been
open, and it was live in prod from the Phase 1 apply until this fix.

**Fixed** by `supabase/migrations/20260807130000_leasefork_clone_grant_hardening.sql`,
at two layers:

- *Grant layer (primary):* EXECUTE revoked from `anon` **and** `authenticated`, both
  named explicitly. PostgREST cannot reach the function at all now — the request
  fails before any function body runs. Nothing in the app called it (there is no
  template-authoring UI and this task did not add one), so no caller lost anything.
- *Guard layer (defence in depth):* deny by default. Trusted direct access is now
  identified by `session_user`, which inside a `SECURITY DEFINER` function still
  reports the real session role — unlike `current_user`, which reports the function
  OWNER and is therefore useless as a caller check here.

```sql
IF NOT (is_admin() OR session_user IN ('postgres', 'supabase_admin')) THEN
  RAISE EXCEPTION 'not authorized to clone a contract template';
END IF;
```

Verified live after the fix:

```
         proname         |                   proacl
-------------------------+----------------------------------------------
 clone_contract_template | {postgres=X/postgres,service_role=X/postgres}

SET LOCAL ROLE anon; SELECT clone_contract_template(...);
ERROR:  permission denied for function clone_contract_template

-- and the migration/psql path still works --
      psql_path
----------------------
 TMP_PSQL_STILL_WORKS
```

`service_role` retains EXECUTE (it comes from `pg_default_acl` and matches the
convention of neighbouring functions), but the guard denies it too: a service_role
call arrives with `session_user = authenticator` and `is_admin() = false`. It is a
dead grant, not a live path.

The three forks created by Phase 2 are unaffected — the corrective migration only
rewrites the guard and the grants, and re-runs no clone.

**What this cost:** the same `REVOKE ALL FROM public` idiom is used elsewhere in this
repo's migrations. Any other `SECURITY DEFINER` function created with a
`auth.uid() IS NULL ⇒ trusted` guard has the same hole. I did **not** audit the rest
of the database for that pattern — it is outside this task, but it is worth a
dedicated pass.

---

## 15. The picker

**`listLeaseTemplates()`** ([api.ts](src/lib/api.ts)) — filters
`contract_kind = 'HORSE_LEASE'`, `active`, not soft-deleted, ordered by title. That
mirrors the RPC's server-side validation exactly, so the UI cannot offer a template
the RPC would reject.

Run as the query PostgREST actually issues, under a real staff session with RLS on:

```
     template_key     |                 title                 | active
----------------------+---------------------------------------+--------
 HORSE_LEASE_V2       | Horse Lease Agreement                 | t
 HORSE_LEASE_FULL     | Horse Lease Agreement — Comprehensive | t
 HORSE_LEASE_SIMPLE   | Horse Lease Agreement — Simple        | t
 HORSE_LEASE_STANDARD | Horse Lease Agreement — Standard      | t
```

Four rows; the retired flat `HORSE_LEASE` correctly excluded.

**`startLeaseContract(..., templateKey?)`** — when no template is chosen the
`p_template_key` key is **omitted from the payload entirely** (not sent as null), so
the RPC's own DEFAULT applies and the call is byte-identical to what it sent before
the parameter existed.

**UI** — a "Lease version" `<select>` on
[NewContractPage.tsx](src/pages/app/ops/NewContractPage.tsx), shown only for a lease
and only when there is more than one version to choose from. Staff-facing by
construction: the route is
`<Route path="ops/contracts/new" element={<ProtectedRoute requireStaff>…` in
[App.tsx:268](src/App.tsx#L268). A failure to load the list leaves the picker empty
and falls through to the RPC default — starting a lease never depends on it.

**Not browser-clicked.** The data path, the RPC and the RLS read are each proven
above against prod, and it typechecks and lints clean, but I did not run the app and
click through the picker. Calling that verified would be overclaiming.

**Open labelling question, deliberately not resolved.** The picker's first option is
"Default" and `HORSE_LEASE_V2` is also listed under its own title, "Horse Lease
Agreement" — selecting either produces V2. Naming `HORSE_LEASE_V2` something
self-describing would remove the redundancy, but renaming it is explicitly forbidden
by this task, so I left both paths visible rather than invent a convention. This is
the same labelling question raised at the Phase 2 gate (§8), still open.

---

## 16. Post-apply safety — the original, again, after Phase 3

`start_lease_contract_v2` was dropped and recreated; that touches `pg_proc` only.
Proven rather than argued:

**16a. Original template row — identical to the pre-clone capture**

```
                  id                  |  template_key  |         title         | version | active |          created_at           |          updated_at           | deleted_at |             body_md5
--------------------------------------+----------------+-----------------------+---------+--------+-------------------------------+-------------------------------+------------+----------------------------------
 2ccc055b-f6fc-4af3-b25d-4f74f8246643 | HORSE_LEASE_V2 | Horse Lease Agreement |       1 | t      | 2026-07-20 21:54:38.254059+00 | 2026-08-01 12:59:44.554188+00 |            | af2572690e946d4358edd01d3eef3dce
```

Same id, same `created_at`, same `updated_at`, same body hash as §0 and §6a.

**16b. Content counts** — `22 / 144 / 117`, unchanged.

**16c/d. The 4 live documents — still bound, still byte-identical**

```
                  id                  |  display_code  |       status       | workflow_state |          updated_at           |         merged_body_md5          |  len
--------------------------------------+----------------+--------------------+----------------+-------------------------------+----------------------------------+-------
 ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | DOC-RXW6U9M3BF | EXECUTED           | executed       | 2026-08-05 02:57:12.994303+00 | bbaf0d0c40f2086a1dfd5fec01ea638e | 15086
 215bac09-9f66-43ce-8655-85fd05fea1e2 | DOC-VWRU4KUN93 | AWAITING_SIGNATURE | editable       | 2026-08-04 17:11:41.955893+00 | 3bd270d540b71b781ed6748f0e172af1 | 25834
 704c8d2d-d179-43f9-8a4a-7ea8cb920ab9 | DOC-J7NXZDHD5F | AWAITING_SIGNATURE | in_review      | 2026-08-05 04:24:07.803698+00 | 06b03a81a5b4b8fb653d5fb4058c98a4 | 22801
 9a56b738-36f7-4a55-a813-cdd17fe4d753 | DOC-U4PZP54FP5 | VOID               | void           | 2026-08-06 10:21:11.043028+00 | a7268382b18379af4af54f46bcb1b3c8 | 20612
```

**Sarah's `704c8d2d-…`** — `updated_at 2026-08-05 04:24:07.803698+00` and
`merged_body` md5 `06b03a81a5b4b8fb653d5fb4058c98a4`, identical to the capture taken
before the first migration. Read-only throughout all three phases; no statement in
this task wrote to `documents` outside a rolled-back transaction.

**16e.** Documents pointing at any fork: **0**.

**16f. No residue from any test**

```
 stray_templates      0      (ANON_PROOF_OF_CONCEPT, TMP_PSQL_STILL_WORKS, X_TMP)
 clauses_with_marker  0      (the ZZMARKERZZ provenance marker)
 total_documents      68     (no trial lease persisted)
```

---

## 17. Verification checklist from the task

| # | Item | Result |
|---|---|---|
| 1 | Fidelity evidence for all three clones — counts, checksums, gate comparison, raw | **Done** — §4a–4d, §5 |
| 2 | Original row + content rows + 4 live documents unchanged | **Done** — §6a–6f (post-Phase-2) and §16a–16f (post-Phase-3), incl. independent audit-trail evidence |
| 3 | Lease with no template argument still produces `HORSE_LEASE_V2` | **Done, exercised live** — §13c |
| 4 | Lease against each fork produces that fork's content | **Done, exercised live** — §13d (binding) and §13e (true provenance) |

## 18. Health

```
npm run typecheck      → 0 errors
npm run typecheck:api  → 0 errors
npm run lint           → 30 problems (0 errors, 30 warnings)
```

30 warnings, all pre-existing `react-refresh/only-export-components` on
`origin/main` — the same count before and after the Phase 3 TypeScript changes.
`npm run build` was **not** run.

## 19. Files

```
supabase/migrations/20260807120000_leasefork_clone_contract_template.sql   (new, Phase 1)
supabase/migrations/20260807121000_leasefork_three_lease_forks.sql         (new, Phase 2)
supabase/migrations/20260807130000_leasefork_clone_grant_hardening.sql     (new, §14 fix)
supabase/migrations/20260807140000_leasefork_start_lease_template_arg.sql  (new, Phase 3)
src/lib/api.ts                                    (listLeaseTemplates + templateKey arg)
src/pages/app/ops/NewContractPage.tsx             (Lease version picker)
docs/reports/TASK-LEASEFORK-REPORT.md             (this file)
```

`ClauseDocument.tsx` untouched, as required — nothing here needed it.

---

## What I verified with my own eyes vs. what I assume

**Verified live against prod, raw output in this report:** every count, checksum and
fingerprint; the bidirectional row diffs; the negative-path errors for both functions;
every rollback; the applied ids; the original's row, counts, checksums and
`updated_at` at two separate points in time; the 4 documents' ids, statuses,
`updated_at` and body hashes, also twice; the `contract_templates` audit trail; the
overload-ambiguity proof; the anon exploit *and* its closure; the ACL before/after
diff and the exact-match assertion; the four hardcoded sites moving to `v_key`; the
default path, the NULL path and all three forks producing real documents; the
marker-based provenance test; the picker's RLS-on query result; the residue checks;
typecheck and lint.

**Assumed, not verified:**

- **The picker was not browser-clicked.** Its data path, RPC and RLS read are each
  proven separately, but nobody rendered the page.
- That no *other* code path keys off the literal `HORSE_LEASE_V2` in a way the forks
  would need to satisfy. I checked `start_lease_contract_v2`, the single UI caller,
  and confirmed no other DB function calls that RPC. I did not audit every function
  in the database for the literal.
- That the four cloned tables are *sufficient* in general. Verified sufficient for
  these forks today — all seven satellite tables are empty for `HORSE_LEASE_V2`, and
  §13d/13e prove a fork-authored document composes correctly end to end. A future
  source template carrying satellite rows would need more.
- The pre-clone `merged_body` hashes of the 4 documents were captured by me at the
  start of this session, not from an earlier record. They prove nothing changed
  *during this task*; they are not a claim about any earlier state.
- **The scope of §14 beyond this task.** I fixed the one function I created. I did
  not audit the rest of the database for the same `REVOKE FROM public` +
  `auth.uid() IS NULL ⇒ trusted` pattern, and I am not asserting it is absent.
