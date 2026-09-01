# TASK SVCPURGE — retire the six service contract templates

**Branch** `task/svcpurge` off `origin/main` (2a8b056) · worktree `~/Downloads/claude-code-repo/wt-svcpurge`
**Production DB** `db.lrstswfxfsezdmvkvukc.supabase.co` · **applied 2026-08-06**
**Migration** `supabase/migrations/20260806120000_svcpurge_retire_service_contracts.sql`

Removed: `HORSE_TRAINING`, `HORSE_EXERCISE`, `HORSEMANSHIP_TRAINING`,
`HORSE_EVALUATION`, `RIDER_LESSON`, `RIDER_LESSON_JUMPER`.

**Service Definition documents — the replacement concept — are a SEPARATE upcoming
build.** This task only removed. Nothing was built to replace the six.

---

## 0. Verified vs assumed

Everything below marked **VERIFIED** I ran myself against the production database or
the repo in this worktree, and the raw output is reproduced. Assumptions are listed
separately and marked as such — nothing load-bearing rests on one.

**VERIFIED by me:**
- Zero `documents` rows against all six keys, before and after (§2, §6).
- The complete set of DB artifacts keyed to the six (§1) — via an exhaustive scan of
  every `text`/`jsonb`/`varchar`/array column in every base table in `public`, not a
  guessed table list.
- That the only live reader of `template_variants` keys off the template being
  deleted (§4.2) — read from the live `pg_proc` body, not from a migration file.
- That every `src/`+`api/` hit is a SERVICE TYPE, not a contract template key (§5).
- That the `test:db` suite was already failing on pristine `origin/main`, and that
  this change adds **zero** new failures (§8).
- typecheck / typecheck:api / lint at the stated baseline (§8).

**ASSUMED (stated, not verified):**
- The owner's ruling that these six contracts are not in use and will not be. I
  verified the *data* consequence of that ruling (zero documents ever generated); I
  did not and cannot verify the business intent behind it.
- That `git history is the archive` is an acceptable archive for the six bodies, per
  the task doc. I did not export them anywhere else.

---

## 1. Read-first: every DB artifact keyed to the six

I did not guess which tables to check. I enumerated every column whose name contains
`template_key` or `template_id`, every FK pointing at `contract_templates`, and then
scanned **every** text/jsonb/varchar/array column in every base table in `public` for
the six literal strings (word-boundary regex).

```
=== every table/column named template_key ===
 table_schema |           table_name           |  column_name  | data_type
--------------+--------------------------------+---------------+-----------
 public       | category_document_requirements | template_key  | text
 public       | contact_required_documents     | template_key  | text
 public       | contract_clause_defs           | template_key  | text
 public       | contract_field_defs            | template_key  | text
 public       | contract_requirements          | template_key  | text
 public       | contract_role_documents        | template_key  | text
 public       | contract_section_defs          | template_key  | text
 public       | contract_templates             | template_key  | text
 public       | invitations                    | template_keys | ARRAY
 public       | template_variants              | template_key  | text
 public       | template_version_events        | template_key  | text
(11 rows)

=== all FKs pointing at contract_templates ===
   referencing_table   |                                      def
-----------------------+--------------------------------------------------------------------------------
 template_tokens       | FOREIGN KEY (template_id) REFERENCES contract_templates(id) ON DELETE CASCADE
 documents             | FOREIGN KEY (template_id) REFERENCES contract_templates(id) ON DELETE RESTRICT
 contract_requirements | FOREIGN KEY (template_key) REFERENCES contract_templates(template_key)
(3 rows)
```

Exhaustive full-DB scan for the six strings (every text/jsonb/varchar/array column in
every base table in `public`):

```
NOTICE:  HIT service_types . code  -> 4 row(s)
NOTICE:  HIT activity_checklists . service_type  -> 17 row(s)
NOTICE:  HIT contract_templates . template_key  -> 6 row(s)
NOTICE:  HIT contract_templates . service_type  -> 5 row(s)
NOTICE:  HIT audit_logs . old_value  -> 77 row(s)
NOTICE:  HIT audit_logs . new_value  -> 79 row(s)
NOTICE:  HIT template_variants . template_key  -> 6 row(s)
NOTICE:  HIT contract_requirements . service_type  -> 15 row(s)
NOTICE:  HIT offerings . service_type  -> 19 row(s)
DO
```

### What that resolves to

| Artifact | Rows | Disposition |
|---|---|---|
| `contract_templates` (the six) | 6 | **DELETED** |
| `template_tokens` (via `template_id`) | 87 | **DELETED** — cascade |
| `template_variants` (`HORSE_EVALUATION`) | 6 | **DELETED** — see §4.2 |
| `contract_section_defs` / `clause_defs` / `field_defs` | **0** | nothing to delete — see §4.1 |
| `contract_requirements.template_key` | 0 | n/a |
| `contract_role_documents` | 0 | n/a |
| `category_document_requirements` | 0 | n/a |
| `contact_required_documents` | 0 | n/a |
| `template_version_events` | 0 | n/a |
| `invitations.template_keys` | 0 | n/a |
| `service_types.code` | 4 | **LIVE — untouched** (§3) |
| `offerings.service_type` | 19 | **LIVE — untouched** (§3) |
| `contract_requirements.service_type` | 15 | **LIVE — untouched** (§3) |
| `activity_checklists.service_type` | 17 | **LIVE — untouched** (§3) |
| `audit_logs.old_value` / `.new_value` | 77 / 79 | **historical record — untouched** |

The six templates before deletion:

```
        template_key         |                  id                  |                      title                       |     service_type      | version | active | wall_gating | deleted_at
-----------------------------+--------------------------------------+--------------------------------------------------+-----------------------+---------+--------+-------------+------------
 EVALUATION_LIABILITY_WAIVER | 66a4d669-efb4-47e0-8ce0-ffdb4c9bd0a7 | Pre-Purchase / Lease Evaluation Liability Waiver | HORSE_EVALUATION      |       2 | t      | t           |
 HORSE_EVALUATION            | 5dc175bf-edf7-4c13-a96b-befea9e9e488 | Horse Evaluation Agreement                       | HORSE_EVALUATION      |       1 | t      | f           |
 HORSE_EXERCISE              | a9eb9922-7145-4bbe-93de-f9d6db775a19 | Horse Exercise Services Agreement                | HORSE_EXERCISE        |       1 | t      | f           |
 HORSE_TRAINING              | ccbb4322-1930-493e-9fbc-3df02c3050b5 | Horse Training Services Agreement                | HORSE_TRAINING        |       1 | t      | f           |
 HORSEMANSHIP_TRAINING       | ae3ee232-1884-49ca-b5a4-b00e9f4d6dcf | Horsemanship Training Agreement                  | HORSEMANSHIP_TRAINING |       1 | t      | f           |
 RIDER_LESSON                | 0c4c8d1c-310d-406e-8404-4b6cf9fa8e36 | Riding Lesson Order Form                         |                       |       1 | t      | f           |
 RIDER_LESSON_JUMPER         | 748cb6c3-a7f5-4f0e-99b4-34f0e2faa7b1 | Rider Lesson and Jumper Training Agreement       | RIDING_LESSON         |       1 | t      | f           |
(7 rows)
```

`EVALUATION_LIABILITY_WAIVER` is shown here only for contrast. **It was not touched.**

---

## 2. Zero-document proof — BEFORE (raw)

Counts **every** `documents` row against each template — drafts, executed, voided,
archived, and soft-deleted (`deleted_at IS NOT NULL`) alike.

```
=== ZERO-DOCUMENT PROOF (before): documents joined to templates, per key, incl soft-deleted ===
     template_key      | documents_all | documents_not_deleted | documents_soft_deleted
-----------------------+---------------+-----------------------+------------------------
 HORSE_EVALUATION      |             0 |                     0 |                      0
 HORSE_EXERCISE        |             0 |                     0 |                      0
 HORSE_TRAINING        |             0 |                     0 |                      0
 HORSEMANSHIP_TRAINING |             0 |                     0 |                      0
 RIDER_LESSON          |             0 |                     0 |                      0
 RIDER_LESSON_JUMPER   |             0 |                     0 |                      0
(6 rows)

=== defs counts per key ===
        template_key         | section_defs | clause_defs | field_defs
-----------------------------+--------------+-------------+------------
 EVALUATION_LIABILITY_WAIVER |            0 |           0 |          0
 HORSE_EVALUATION            |            0 |           0 |          0
 HORSE_EXERCISE              |            0 |           0 |          0
 HORSE_TRAINING              |            0 |           0 |          0
 HORSEMANSHIP_TRAINING       |            0 |           0 |          0
 RIDER_LESSON                |            0 |           0 |          0
 RIDER_LESSON_JUMPER         |            0 |           0 |          0
(7 rows)
```

The owner's premise holds: **zero documents ever generated** for any of the six.

---

## 3. The most important finding: the SERVICES are live, only the CONTRACTS are dead

Four of the six template keys are **also** the codes of live service types. Deleting
the templates must not, and did not, touch the services.

```
=== service_types (LIVE service catalog, NOT templates) ===
         code          | active
-----------------------+--------
 HORSE_EVALUATION      | t
 HORSE_EXERCISE        | t
 HORSE_TRAINING        | t
 HORSEMANSHIP_TRAINING | t

=== offerings selling these services ===
     service_type      | offerings | any_active
-----------------------+-----------+------------
 HORSE_EVALUATION      |         4 | t
 HORSE_EXERCISE        |         8 | t
 HORSE_TRAINING        |         4 | t
 HORSEMANSHIP_TRAINING |         3 | t
 JUMPER_TRAINING       |         2 | f
 RIDING_LESSON         |        11 | t
```

32 active SKUs sell these services. And `contract_requirements` maps each service to
the **categorical documents** that replaced the retired contracts — which is precisely
the owner's ruling, visible in the data:

```
     service_type      | req_rows |                                               requires
-----------------------+----------+-------------------------------------------------------------------------------------------------------
 HORSE_EVALUATION      |        3 | {COMPANY_POLICIES,EVALUATION_LIABILITY_WAIVER,HORSE_EMERGENCY_VET}
 HORSE_EXERCISE        |        4 | {COMPANY_POLICIES,FACILITY_RULES,HORSE_EMERGENCY_VET,RELEASE_HORSE_CARE}
 HORSE_TRAINING        |        4 | {COMPANY_POLICIES,FACILITY_RULES,HORSE_EMERGENCY_VET,RELEASE_HORSE_CARE}
 HORSEMANSHIP_TRAINING |        4 | {COMPANY_POLICIES,FACILITY_RULES,HUMAN_EMERGENCY_MEDICAL,RELEASE_PARTICIPANT}
 JUMPER_TRAINING       |        5 | {COMPANY_POLICIES,FACILITY_RULES,HUMAN_EMERGENCY_MEDICAL,RELEASE_JUMPER_ADDENDUM,RELEASE_PARTICIPANT}
 RIDING_LESSON         |        4 | {COMPANY_POLICIES,FACILITY_RULES,HUMAN_EMERGENCY_MEDICAL,RELEASE_PARTICIPANT}
```

Every one of those `template_key` values is a release/policy/authorization. Not one is
a service contract. **Zero rows in `contract_requirements` referenced any of the six.**

### EVALUATION_LIABILITY_WAIVER — explicitly not touched

The waiver's own `template_key` is `EVALUATION_LIABILITY_WAIVER`; its
`service_type` is `HORSE_EVALUATION` — that is the SERVICE, not the deleted template.
The deletion is keyed on `template_key` only, so the waiver is untouched, and the
migration asserts both its survival and the survival of the
`HORSE_EVALUATION → EVALUATION_LIABILITY_WAIVER` requirement row as post-conditions.

---

## 4. Two judgment calls, stated plainly

### 4.1 The def tables were already empty — the task doc's premise was slightly off

The task doc says to "DELETE the defs + template rows." The six are **flat-body**
templates and hold **zero** `contract_section_defs` / `contract_clause_defs` /
`contract_field_defs` rows (§2 raw output). The clause engine is used by
`HORSE_LEASE_V2` / `HORSE_SALE_V2`, not by these. The migration still issues the three
DELETEs as a belt-and-braces sweep; they reported `DELETE 0`, as expected. Nothing was
missed — the rows simply never existed.

### 4.2 `template_variants` — scope extension, called out

Six `template_variants` rows are keyed `HORSE_EVALUATION`. The task doc's work item 2
says "defs + template rows"; work item 1 says to find "anything else keyed by
`template_key`." These are that "anything else," so I deleted them. **This is the one
place I went beyond the literal delete list, and here is the verification behind it:**

The only live reader is `generate_document`. I read its body from the live database
(`pg_proc.prosrc`), not from a migration file:

```sql
    SELECT COALESCE(tv.token_overrides, '{}'::jsonb) INTO v_dir
      FROM template_variants tv
      WHERE tv.template_key = p_template_key      -- <-- keys off the template being generated
        AND tv.retained_by  = (v_ctr.terms ->> 'retained_by')
        AND tv.deal_side    = (v_ctr.terms ->> 'deal_side')
        AND tv.active
      LIMIT 1;
```

It matches on `p_template_key`. With the `HORSE_EVALUATION` template gone, those six
rows are unreachable orphans. They are **not** the waiver's: `EVALUATION_LIABILITY_WAIVER`
has its own `template_key`, zero variant rows, and its body contains no `{{DIR.*}}`
tokens (verified: `body ILIKE '%{{DIR.%'` → `f`). `HORSE_SEARCH_RETAINER` (4) and
`HORSE_TRANSACTION_REP` (6) variants are untouched and were re-verified after the run.

Their exact contents are preserved verbatim in a comment block in the migration, so
restoring them is a copy-paste if this call was wrong.

---

## 5. Repo references — grepped, and NOT removed

Task item 3 says to grep `src/` + `api/` and report anything live-looking instead of
removing it. **Every single hit is a SERVICE TYPE reference, not a contract template
key. I removed none of them.**

```
src/lib/serviceCatalog.ts:25:  { code: 'HORSE_EVALUATION',      label: 'Horse Evaluation',      segment: 'acquisition', requiresHorse: true },
src/lib/serviceCatalog.ts:30:  { code: 'HORSE_TRAINING',        label: 'Horse Training',        segment: 'horse',  requiresHorse: true },
src/lib/serviceCatalog.ts:31:  { code: 'HORSE_EXERCISE',        label: 'Horse Exercise',        segment: 'horse',  requiresHorse: true },
src/lib/serviceCatalog.ts:35:  { code: 'HORSEMANSHIP_TRAINING', label: 'Horsemanship Training', segment: 'rider',  requiresHorse: false },
src/lib/serviceCatalog.ts:63-69: slug → service-code map (horsemanship, horse-training, horse-exercise, riding-turnout, evaluation)
src/lib/inquiry.ts:27,32,33,41:  inquiry routing by service code
src/pages/BookRider.tsx:14:      const HORSEMANSHIP_CODE = 'HORSEMANSHIP_TRAINING';
src/pages/BookSupport.tsx:10:     const HORSE_CARE_CODES = ['HORSE_TRAINING', 'HORSE_EXERCISE', 'HORSE_CLIPPING'];
src/lib/ops/api-public.ts:41-42:  comment about RELEASE_HORSE_EXERCISE (a retired RELEASE, different key)
src/pages/Release.tsx:65:        comment about RELEASE_HORSE_EXERCISE (same)
```

Note `BookRider.tsx:15` declares `const RIDER_LESSON_CODES = ['RIDING_LESSON', 'JUMPER_TRAINING']`
— a local variable whose *name* resembles the template key but whose *values* are
service codes. Not a template reference. Untouched.

**There are zero references in `src/` or `api/` to any of the six as contract template
keys.** No `start_*` helper, catalog, or seed refers to them.

### Two references I found and deliberately did NOT remove

**(a) `suggested_category_for_contact(uuid)` — a live DB function.** Its body contains:

```sql
WHEN EXISTS (SELECT 1 FROM signed WHERE template_key IN ('RELEASE_PARTICIPANT','RIDER_LESSON','RIDER_LESSON_JUMPER','MINOR_RIDER'))
  THEN 'RIDER'
```

The function is live (called from `src/lib/admin.ts:481`). The two purged keys inside
the `IN` list are **unreachable branches** — the CTE selects `template_key` from
EXECUTED documents, and there were never any. The function's output is therefore
**identical before and after** this purge; the RIDER branch still fires on
`RELEASE_PARTICIPANT` / `MINOR_RIDER`. Removing them would mean rewriting a live
function body, which is outside this task's scope and not required for correctness.
**Left in place. Recommend a follow-up cosmetic cleanup — not urgent, not a defect.**

**(b) `scripts/build-template-load-migration.mjs` — one dead entry, removed.**
`POST_SEED_TEMPLATES.RIDER_LESSON` emitted an `INSERT INTO contract_templates ... ON
CONFLICT DO NOTHING` for `RIDER_LESSON`. With its `.md` deleted this entry is dead by
construction, and leaving it would have **re-seeded the purged row on any fresh
database** — a resurrection path that would silently undo the purge. Removed, with the
reason recorded inline. This is `scripts/`, not `src/` or `api/`.

Other false-positive matches I checked and dismissed: `my_onboarding_state()`,
`generate_my_onboarding_documents()`, `release_preview()` all matched only on
`RELEASE_HORSE_EXERCISE` — a separately-retired *release* key that merely contains
`HORSE_EXERCISE` as a substring. No views and no RLS policies reference any of the six
(both verified, 0 rows).

---

## 6. Live proof — dry-run, then apply

### 6.1 Dry-run inside `BEGIN … ROLLBACK` against production (raw)

```
BEGIN
NOTICE:  SVCPURGE assert: HORSE_TRAINING — 0 documents
NOTICE:  SVCPURGE assert: HORSE_EXERCISE — 0 documents
NOTICE:  SVCPURGE assert: HORSEMANSHIP_TRAINING — 0 documents
NOTICE:  SVCPURGE assert: HORSE_EVALUATION — 0 documents
NOTICE:  SVCPURGE assert: RIDER_LESSON_JUMPER — 0 documents
NOTICE:  SVCPURGE assert: RIDER_LESSON — 0 documents
NOTICE:  SVCPURGE: all guards passed — 6 templates, 0 documents, 0 live references
DO
DELETE 0        -- contract_field_defs
DELETE 0        -- contract_clause_defs
DELETE 0        -- contract_section_defs
DELETE 6        -- template_variants
DELETE 6        -- contract_templates
NOTICE:  SVCPURGE: complete — 6 templates removed, waiver + service types intact
DO

========== IN-TRANSACTION VERIFICATION (before ROLLBACK) ==========
 template_key
--------------
(0 rows)
(above must be 0 rows)
 defs_remaining
----------------
              0
 orphan_template_tokens
------------------------
                      0
        template_key         |                      title                       |   service_type
-----------------------------+--------------------------------------------------+------------------
 EVALUATION_LIABILITY_WAIVER | Pre-Purchase / Lease Evaluation Liability Waiver | HORSE_EVALUATION
 templates_total
-----------------
              23
 documents_total
-----------------
              68
ROLLBACK

========== POST-ROLLBACK: prod must be UNCHANGED ==========
 six_templates_still_present
-----------------------------
                           6
```

The rollback was proven: all six were still present in production afterwards.

### 6.2 Negative test — the assert actually aborts

I did not take the guard on faith. I ran the identical guard block with a purge set
extended by one key that **does** have documents (`RELEASE_PARTICIPANT`, 13 docs),
inside `BEGIN … ROLLBACK`:

```
=== NEGATIVE TEST: same guard, purge set = the six PLUS a key that has documents ===
BEGIN
ERROR:  SVCPURGE ABORT: template RELEASE_PARTICIPANT has 13 document row(s) — refusing to delete a template with documents
CONTEXT:  PL/pgSQL function inline_code_block line 16 at RAISE
ROLLBACK
```

It aborts loudly and names the offending key and count. (The trailing `\echo` line in
that scratch script is a client-side psql directive and prints regardless; the
transaction itself was aborted by the ERROR. The real migration runs under
`ON_ERROR_STOP=1 -1`, so an abort exits non-zero and rolls back the whole file.)

Beyond the asserts there is an independent backstop: `documents.template_id →
contract_templates(id)` is **ON DELETE RESTRICT**, so the database itself would refuse
the delete even if every assert were removed.

### 6.3 Apply to production (raw)

```
NOTICE:  SVCPURGE assert: HORSE_TRAINING — 0 documents
NOTICE:  SVCPURGE assert: HORSE_EXERCISE — 0 documents
NOTICE:  SVCPURGE assert: HORSEMANSHIP_TRAINING — 0 documents
NOTICE:  SVCPURGE assert: HORSE_EVALUATION — 0 documents
NOTICE:  SVCPURGE assert: RIDER_LESSON_JUMPER — 0 documents
NOTICE:  SVCPURGE assert: RIDER_LESSON — 0 documents
NOTICE:  SVCPURGE: all guards passed — 6 templates, 0 documents, 0 live references
DO
DELETE 0
DELETE 0
DELETE 0
DELETE 6
DELETE 6
NOTICE:  SVCPURGE: complete — 6 templates removed, waiver + service types intact
DO
PSQL_EXIT=0
```

### 6.4 Post-migration proof (raw, AFTER)

```
=== A. the six keys absent from contract_templates ===
 template_key
--------------
(0 rows)

=== B. defs count 0 across all three def tables ===
        tbl        | count
-------------------+-------
 section_defs      |     0
 clause_defs       |     0
 field_defs        |     0
 template_variants |     0

=== C. no orphaned template_tokens anywhere ===
 orphan_template_tokens
------------------------
                      0

=== D. EVALUATION_LIABILITY_WAIVER untouched ===
        template_key         |                      title                       |   service_type   | version | active | wall_gating
-----------------------------+--------------------------------------------------+------------------+---------+--------+-------------
 EVALUATION_LIABILITY_WAIVER | Pre-Purchase / Lease Evaluation Liability Waiver | HORSE_EVALUATION |       2 | t      | t

=== E. HORSE_EVALUATION service still requires the waiver ===
   service_type   |        template_key
------------------+-----------------------------
 HORSE_EVALUATION | COMPANY_POLICIES
 HORSE_EVALUATION | EVALUATION_LIABILITY_WAIVER
 HORSE_EVALUATION | HORSE_EMERGENCY_VET

=== F. live service types + offerings untouched ===
         code          | service_active | offerings
-----------------------+----------------+-----------
 HORSE_EVALUATION      | t              |         4
 HORSE_EXERCISE        | t              |         8
 HORSE_TRAINING        | t              |         4
 HORSEMANSHIP_TRAINING | t              |         3

=== G. totals: templates 29 -> 23, documents unchanged at 68 ===
 templates_total | documents_total
-----------------+-----------------
              23 |              68

=== H. surviving template keys (full list) ===
 COMPANY_POLICIES, EVALUATION_LIABILITY_WAIVER, FACILITY_LICENSE, FACILITY_RULES,
 HORSE_BILL_OF_SALE, HORSE_EMERGENCY_VET, HORSE_LEASE, HORSE_LEASE_V2,
 HORSE_PURCHASE_SALE, HORSE_REPRESENTATION, HORSE_SALE_TRANSFER, HORSE_SALE_V2,
 HORSE_SEARCH_RETAINER, HORSE_TRANSACTION_REP, HUMAN_EMERGENCY_MEDICAL,
 INDEPENDENT_CONTRACTOR, MEDIA_RELEASE, MINOR_RIDER, RELEASE_GENERAL,
 RELEASE_HORSE_CARE, RELEASE_HORSE_EXERCISE, RELEASE_JUMPER_ADDENDUM, RELEASE_PARTICIPANT
(23)

=== I. other templates' variants intact ===
     template_key      | count
-----------------------+-------
 HORSE_SEARCH_RETAINER |     4
 HORSE_TRANSACTION_REP |     6
```

`documents_total` is **68 before and 68 after** — not one document row was touched.

---

## 7. Repo changes

**Deleted** (task item 3):

```
D  supabase/contract_templates/HORSEMANSHIP_TRAINING.md
D  supabase/contract_templates/HORSE_EVALUATION.md
D  supabase/contract_templates/HORSE_EXERCISE.md
D  supabase/contract_templates/HORSE_TRAINING.md
D  supabase/contract_templates/RIDER_LESSON.md
D  supabase/contract_templates/RIDER_LESSON_JUMPER.md
```

**`Archive/` — none of the six exist there.** Nothing was removed from it. For the
record, `supabase/contract_templates/Archive/` contains only:
`EVALUATION_LIABILITY_WAIVER.md`, `HORSE_EMERGENCY_VET.md`, `HUMAN_EMERGENCY_MEDICAL.md`,
`RELEASE_GENERAL.md`, `RELEASE_HORSE_CARE.md`, `RELEASE_PARTICIPANT OLD.md` — all
releases/policies, all untouched.

**Regenerated** `supabase/migrations/20260629100000_load_contract_bodies.sql` via its
own generator (`node scripts/build-template-load-migration.mjs`), which the file's
header requires after any body change. I first confirmed the generator was **in sync
with the committed file before I deleted anything**, so the resulting diff is provably
nothing but the six removals:

```
 .../20260629100000_load_contract_bodies.sql | 435 ---------------------
 1 file changed, 435 deletions(-)
```

435 deletions, **0 insertions**, and the only changed section headers are the six.
The loader now emits 11 templates instead of 17. Regenerating after a retirement is
the established pattern in this repo (15 prior commits touch this generated file,
including the sale-template retirement in `3475dd4`).

**Updated** `docs/archive/BUILD_TRACKER.md` — new CLEANUP LEDGER entry, plus the explicit note
that Service Definition documents are a separate upcoming build.

---

## 8. Done-checks

| Check | Result |
|---|---|
| `npm run typecheck` | **0 errors** |
| `npm run typecheck:api` | **0 errors** |
| `npm run lint` | **29 problems (0 errors, 29 warnings)** — exactly the stated baseline |

### `test:db` — pre-existing red, and I proved this change adds nothing to it

`test:db` is not in the task's done-checks, but this change touches template data, so
I checked it rather than assuming. Several `test/db` suites carry hard-coded template
key lists. To separate pre-existing breakage from anything I caused, I ran the six
affected suites on a **pristine detached worktree of `origin/main`** and on this
branch, and diffed the failing test names:

```
baseline failures: 22   mine failures: 21

NEW failures introduced by my change: 0

Baseline failures no longer present (test removed or now passing): 1
  - tokenized contract bodies RIDER_LESSON_JUMPER uses only tokens that exist in the dictionary
```

**Zero new failures.** The suite was already failing on `origin/main` (22 failures);
this branch has 21, the difference being one test that iterated over a now-deleted
`.md` file. The total test count drops 128 → 99 for the same reason.

Worth knowing for a future task: the default `createTestDb()` path loads
`test/db/fixtures/schema_snapshot.sql`, **not** the migration journal, and that
snapshot still carries the six templates. It is now drifted from production. I did not
regenerate it — that would change the baseline every db test runs against, which is
well outside this task. **Flagged as a follow-up.**

---

## 9. Nothing was stopped or skipped

The task's stop conditions were: any of the six having documents, or a `src/`/`api/`
reference looking live rather than dead. **Neither occurred.** All six had zero
documents; every `src/`/`api/` hit was a service-type reference, which I left in place
rather than removing. The task was completed in full.

## 10. Follow-ups (none blocking, none actioned here)

1. `suggested_category_for_contact(uuid)` still lists `RIDER_LESSON` /
   `RIDER_LESSON_JUMPER` in a dead `IN` branch. Cosmetic; behavior is unchanged.
   Requires a live function-body rewrite, so it wants its own task.
2. `test/db/fixtures/schema_snapshot.sql` has drifted from production (still holds the
   six templates), and `test:db` is red on `main` independently of this work.
3. `MINOR_RIDER` and `HORSE_REPRESENTATION` are body-less, retired-in-practice template
   rows still present in `contract_templates`. Out of scope here — noting them since the
   inventory surfaced them, not proposing action.
