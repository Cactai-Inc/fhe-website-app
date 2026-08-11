# TASK CONTRACTORPHAN — report

Branch `task/contractorphan`, worktree `~/Downloads/claude-code-repo/wt-contractorphan`,
off `origin/main` (`2f5f5d2`). Not pushed.

**Status at handoff**

| Part | State |
|---|---|
| 1 — delete the two orphaned documents | **WRITTEN AND DRY-RUN. NOT APPLIED.** Awaiting review, as instructed. |
| 2 — integrity panel | Built and **applied to production** (function only; reads nothing destructive). |
| 3 — cleanup controls | Built and **applied to production**. Grants verified by re-read. |
| Follow-up — NULL-safe guard | **Applied to production.** Closed a live D1 hole; see §NULL below. |

Migrations:

- `supabase/migrations/20260811T1000_contractorphan_delete_orphaned_documents.sql` — **not applied**
- `supabase/migrations/20260811T1100_contractorphan_integrity_panel_and_cleanup.sql` — applied
- `supabase/migrations/20260811T1200_contractorphan_cleanup_guard_null_safe.sql` — applied

---

# PART 1 — the two orphaned Beaumont documents

## The four preconditions — all four pass, raw output

One query, run against production `lrstswfxfsezdmvkvukc` on 2026-08-11.

```
-[ RECORD 1 ]-----------+--------------------------------------------------
id                      | 0360f829-4c31-4dc0-9b95-3489ee9a71cb
display_code            | DOC-3EVT7RBBZC
title                   | Horse Handling and Routine Care Liability Release
status                  | AWAITING_SIGNATURE
workflow_state          | editable
current_status          | ready_to_sign
contract_id             | ae4ffe95-4662-4813-a16c-e7b5b5f325a4
deleted_at              |
voided_at               |
terminated_at           |
archived_at             |
horse_id                | a8e82033-cf9e-48aa-8ea5-a856f2ede597
horse_name              | Beau
contact_id              | d99f1472-48b4-466e-aaa7-f76396745c17
contact_name            | CJ Z
template_id             | cbf64b7e-040d-4950-8b06-4b9f4877d3a4
template_key            | RELEASE_HORSE_CARE
created_at              | 2026-08-04 04:05:20.519772+00
updated_at              | 2026-08-04 04:05:20.519772+00
chk1_status_awaiting    | t
chk2_live_sig_count     | 0
chk2b_any_sig_count     | 0
chk3_not_exec_void_term | t
chk4_contract_absent    | t
-[ RECORD 2 ]-----------+--------------------------------------------------
id                      | fb6abc6c-ef34-4d80-b731-543eaa40ac71
display_code            | DOC-84AAB8KDWT
title                   | Horse Emergency Veterinary Authorization
status                  | AWAITING_SIGNATURE
workflow_state          | editable
current_status          | ready_to_sign
contract_id             | ae4ffe95-4662-4813-a16c-e7b5b5f325a4
deleted_at              |
voided_at               |
terminated_at           |
archived_at             |
horse_id                | a8e82033-cf9e-48aa-8ea5-a856f2ede597
horse_name              | Beau
contact_id              | d99f1472-48b4-466e-aaa7-f76396745c17
contact_name            | CJ Z
template_id             | e49b1a01-e653-4250-9cdc-b0120593bf69
template_key            | HORSE_EMERGENCY_VET
created_at              | 2026-08-04 04:05:20.519772+00
updated_at              | 2026-08-04 04:05:20.519772+00
chk1_status_awaiting    | t
chk2_live_sig_count     | 0
chk2b_any_sig_count     | 0
chk3_not_exec_void_term | t
chk4_contract_absent    | t
```

`chk2b` counts signatures **including** soft-deleted ones: zero either way. `chk3` tests
`status`, `workflow_state`, `voided_at` and `terminated_at` together, not just `status`.

Scope re-confirmed as exactly these two — every document in the table, live or removed,
whose `contract_id` has no `contracts` row:

```
                  id                  |  display_code  |       status       | current_status | deleted_at |             contract_id
--------------------------------------+----------------+--------------------+----------------+------------+--------------------------------------
 0360f829-4c31-4dc0-9b95-3489ee9a71cb | DOC-3EVT7RBBZC | AWAITING_SIGNATURE | ready_to_sign  |            | ae4ffe95-4662-4813-a16c-e7b5b5f325a4
 fb6abc6c-ef34-4d80-b731-543eaa40ac71 | DOC-84AAB8KDWT | AWAITING_SIGNATURE | ready_to_sign  |            | ae4ffe95-4662-4813-a16c-e7b5b5f325a4
(2 rows)
```

## Soft delete, not hard delete — and why no stop was needed

The migration uses `documents.deleted_at`, the repo's convention. **A hard delete is not
required to clear the FK situation**, so the stop-and-report clause did not trigger:

- The FK's referencing-side trigger fires only when `contract_id` itself is modified. An
  `UPDATE` that sets only `deleted_at` produces one new row version and no FK re-check.
  Proven — the dry-run below updates both rows without error.
- `ensure_horse_documents` already sweeps unsigned pending documents with exactly
  `SET deleted_at = now(), deleted_by = auth.uid()`. This is the established mechanism,
  not a new one.
- After the update, the live-orphan count is 0 and neither document can be reached to be
  signed.

`contract_id` is **not** nulled — the owner rejected that as the repair, and the orphan
value is the evidence of what happened. It stays on the removed row.

## Dry run — `BEGIN … ROLLBACK`, raw output

The migration file contains no `COMMIT` (verified: `grep -c COMMIT` = 0).

```
BEGIN
*** BEFORE ***
  display_code  |       status       | current_status | deleted_at |             contract_id
----------------+--------------------+----------------+------------+--------------------------------------
 DOC-3EVT7RBBZC | AWAITING_SIGNATURE | ready_to_sign  |            | ae4ffe95-4662-4813-a16c-e7b5b5f325a4
 DOC-84AAB8KDWT | AWAITING_SIGNATURE | ready_to_sign  |            | ae4ffe95-4662-4813-a16c-e7b5b5f325a4
(2 rows)

 cleaned_up_events_before
--------------------------
                        0
(1 row)

*** APPLYING MIGRATION ***
INSERT 0 1
INSERT 0 2
*** AFTER ***
  display_code  |       status       | current_status |          deleted_at           |             contract_id
----------------+--------------------+----------------+-------------------------------+--------------------------------------
 DOC-3EVT7RBBZC | AWAITING_SIGNATURE | ready_to_sign  | 2026-08-11 11:03:31.221599+00 | ae4ffe95-4662-4813-a16c-e7b5b5f325a4
 DOC-84AAB8KDWT | AWAITING_SIGNATURE | ready_to_sign  | 2026-08-11 11:03:31.221599+00 | ae4ffe95-4662-4813-a16c-e7b5b5f325a4
(2 rows)

-[ RECORD 1 ]------------------------------------------------------------------
entity_id | 0360f829-4c31-4dc0-9b95-3489ee9a71cb
status    | cleaned_up
detail    | CONTRACTORPHAN: DOC-3EVT7RBBZC (Horse Handling and Routine Care Liability
            Release, horse Beau) removed. Reason: contract_id
            ae4ffe95-4662-4813-a16c-e7b5b5f325a4 has no row in contracts, so the document
            could not be signed — the foreign-key re-check aborts the signing transaction.
            AWAITING_SIGNATURE with zero signatures; no evidence destroyed.
            Owner ruling 2026-08-10.
-[ RECORD 2 ]------------------------------------------------------------------
entity_id | fb6abc6c-ef34-4d80-b731-543eaa40ac71
status    | cleaned_up
detail    | CONTRACTORPHAN: DOC-84AAB8KDWT (Horse Emergency Veterinary Authorization,
            horse Beau) removed. Reason: contract_id ae4ffe95-4662-4813-a16c-e7b5b5f325a4
            has no row in contracts, so the document could not be signed — the foreign-key
            re-check aborts the signing transaction. AWAITING_SIGNATURE with zero
            signatures; no evidence destroyed. Owner ruling 2026-08-10.

*** LIVE ORPHANS REMAINING ***
 live_contract_orphans
-----------------------
                     0
(1 row)

ROLLBACK
```

Post-`ROLLBACK` re-query confirms production is untouched:

```
  display_code  |       status       | current_status | deleted_at |             contract_id
----------------+--------------------+----------------+------------+--------------------------------------
 DOC-3EVT7RBBZC | AWAITING_SIGNATURE | ready_to_sign  |            | ae4ffe95-4662-4813-a16c-e7b5b5f325a4
 DOC-84AAB8KDWT | AWAITING_SIGNATURE | ready_to_sign  |            | ae4ffe95-4662-4813-a16c-e7b5b5f325a4
(2 rows)

 cleaned_up_events_now  | 0
```

**The `UPDATE` is guarded by all four preconditions inline.** If production state moves
before this is applied, the migration matches zero rows and writes nothing rather than
removing something the ruling was not made about.

### One side effect worth knowing before applying

Both documents belong to Beau's owner and are of templates `RELEASE_HORSE_CARE` /
`HORSE_EMERGENCY_VET` — exactly the two templates `ensure_horse_documents` generates. Once
they are removed, the next call to `ensure_horse_documents` for Beau will regenerate clean
replacements with no `contract_id`. That is the desirable outcome, but it means the owner
should expect two fresh documents to appear, not a permanent absence.

---

## How a `contracts` row disappeared while the FK still reported valid

**There is an answer, and it is documented in this repo.**

### What the evidence rules out

1. **The FK was never `NOT VALID`, and was never dropped and re-added.**
   `documents_contract_id_fkey` is `convalidated = t` with constraint oid `23716`, sitting
   between `documents_horse_id_fkey` (`23711`) and `document_parties_document_id_fkey`
   (`23691`) — all created together by `20260713150000_spine_s21b_document_parties.sql` on
   2026-07-13. Objects created since are far higher (`contract_notes_document_id_fkey` is
   `32060`). The constraint has been continuously present and validated. No migration in
   the repo drops or recreates it.

2. **All FK triggers on `documents` are enabled** (`tgenabled = 'O'`, all 70).

3. **A normal `DELETE FROM contracts` cannot produce this.** The constraint is
   `ON DELETE SET NULL`, and it demonstrably fires. Live probe, inside `BEGIN … ROLLBACK`:

   ```
   BEGIN
   INSERT 0 1                       -- a throwaway contract
   INSERT 0 1                       -- a throwaway document pointing at it
        phase     |             contract_id
   ---------------+--------------------------------------
    before_delete | 11111111-1111-1111-1111-111111111111
   DELETE 1
       phase     | contract_id | set_null_fired
   --------------+-------------+----------------
    after_delete |             | t
   ROLLBACK
   ```

   A plain delete would have left `contract_id` NULL on both documents, not orphaned.

4. **The contract existed when the documents were inserted.** The insert was FK-checked
   (constraint valid, triggers on), and `xmin` ordering places the documents' insert
   transaction (`11633`) between contract `b3ec6eca` (`11518`, 2026-08-04 02:11) and
   `eef830bf` (`11896`, 2026-08-04 15:37).

5. **Neither document row has been updated since it was inserted.** Both still carry
   `xmin = 11633`, and `updated_at` equals `created_at` to the microsecond (there is a
   `documents_set_updated_at` BEFORE UPDATE trigger, so any update would have moved it).
   The `SET NULL` action therefore never ran against these rows — it did not run and get
   reverted; it never ran.

### What that leaves — and it is on the record

The contract was removed by a path in which the referential action did not fire. Exactly
one such operation is documented, and it is dated the same day the documents were created.
`docs/reports/HANDOFF_DEAL_SALE_BUILD_2026-08-04.md`, §2.3:

> | `documents` + 24 dependent tables | **Deleted 7 pre-existing test documents** (5
> "H2Verify TestSigner" visitor releases, 2 unsigned voided leases) at owner's instruction,
> **with `session_replication_role = replica`**. | Data cleanup, not schema. |

and, the next row:

> | Test rows throughout | Created and deleted deals/**contracts**/documents/contacts/
> horses/auth users/profiles/notifications | Verification data. |

`session_replication_role = replica` disables **all** triggers, including the internal RI
triggers that implement `ON DELETE SET NULL`. A `contracts` row deleted in that session
leaves its children pointing at nothing, silently, with the constraint still marked valid —
because `convalidated` records that the constraint was validated once, not that it still
holds.

**Honest limit:** I cannot prove that this specific contract row was deleted in that
specific session. There are no commit timestamps (`track_commit_timestamp = off`), no
surviving `status_events` for the vanished contract, and the row itself is gone. What I can
say is that the mechanism is established, it is the only documented instance of it, and it
is dated to the same day. Everything else is ruled out by the evidence above.

### The related live hazard, found while looking

`hard_delete_contract(p_document_id)` deletes the document, then deletes the contract
envelope if no other document references it:

```sql
IF v_contract IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM documents WHERE contract_id = v_contract) THEN
  DELETE FROM contract_parties WHERE contract_id = v_contract;
  DELETE FROM contracts WHERE id = v_contract;
END IF;
```

This is correct under normal conditions and did not cause this. Noted because it is the one
routine, non-superuser path that removes a `contracts` row, and any future work that runs it
under `session_replication_role = replica` reproduces this exact failure.

### Other tables referencing `contracts` — all clean

```
       tbl        | count
------------------+-------
 bookings         |     0
 contract_parties |     0
 deals            |     0
 purchases        |     0
 documents        |     2
```

### Recommendation (not applied — out of this task's scope)

`session_replication_role = replica` should not be used for data cleanup on tables with
`SET NULL`/`CASCADE` children. Where it is genuinely needed, the session should re-check
every FK afterwards (`ALTER TABLE … VALIDATE CONSTRAINT` will not do it — the constraints
are already marked valid; an explicit anti-join per FK will). The integrity panel built in
Part 2 now catches this class of damage for `documents` without anyone having to think of
it.

---

# PART 2 — the document integrity panel

`document_integrity()` (SECURITY DEFINER, `has_staff_access()` + `current_org()` gated),
rendered by `src/components/ops/DocumentIntegrityPanel.tsx` on
`src/pages/app/ops/OversightPage.tsx`, between the usage cards and Recent activity.
**No new page, no new nav entry.**

## The counts the panel produces, cross-checked against direct SQL

Both sides run in the same transaction. RPC on the left, an independently written query on
the right:

```
    check_key     | rpc_count | direct_sql | match
------------------+-----------+------------+-------
 missing_fields   |         2 |          2 | t
 orphan_contact   |         6 |          6 | t
 orphan_contract  |         2 |          2 | t
 orphan_horse     |         0 |          0 | t
 ready_no_parties |         0 |          0 | t
(5 rows)
```

Every number matches the spec's production measurements. Re-queried against live
production after the real apply:

```
    check_key     | live_count            known_key    | known_count
------------------+------------           ---------------+-------------
 orphan_contract  |     2                  orphan_contact |      6
 orphan_horse     |     0
 ready_no_parties |     0
 missing_fields   |     2
```

The `missing_fields` check independently reproduces the NOGUARD2 finding:

```
 ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | DOC-RXW6U9M3BF | EXECUTED | 106 of 128 → 22 missing
 9a56b738-36f7-4a55-a813-cdd17fe4d753 | DOC-U4PZP54FP5 | VOID     | 125 of 128 →  3 missing
```

**Zero-count checks render.** `orphan_horse` and `ready_no_parties` both come back with
`"count": 0` and an empty `items` array, and the panel draws them with a `0` badge and
"Nothing found." A check that vanishes when it passes is a check the owner cannot trust.

## The six contact-orphans

Returned in a **separate `known` object**, not in `checks`. Their items deliberately do not
carry a `can_cleanup` field at all, and the panel renders that group with no button, no
menu, and no control of any kind — only the explanation that they are expected and leave
with the owner-run post-Stage-5 purge via the 5g routine.

Verified composition matches the spec exactly — 5 EXECUTED with a signature each, 1 VOID:

```
                  id                  |  display_code  |  status  | current_status | live_sigs
--------------------------------------+----------------+----------+----------------+-----------
 0ed5bf5b-6a02-4b5a-a7e9-76da4ae199d0 | DOC-D6D2MQFPFA | EXECUTED | signed         |         1
 3f44ea13-3b76-45a7-86c8-a01240dc6fe6 | DOC-PH9S87ZN7J | EXECUTED | signed         |         1
 ace13a30-801e-4c75-9b27-726963b61d42 | DOC-SZD7PUX2AF | EXECUTED | signed         |         1
 84ae915c-9384-41c7-b149-f76204c655f5 | DOC-2MDD2E8P74 | EXECUTED | signed         |         1
 8ef6f9f3-b258-4fdd-b1c6-e322277f233b | DOC-Y5XEWTA2NX | EXECUTED | signed         |         1
 9a56b738-36f7-4a55-a813-cdd17fe4d753 | DOC-U4PZP54FP5 | VOID     | void           |         0
```

Defence in depth: even if this file were later got wrong and a button were rendered over
that group, `can_cleanup_document` refuses all six independently (proven in Part 3, §D).

---

# PART 3 — the cleanup controls

## `can_cleanup_document(uuid)` — `can_void_document`'s shape, made stricter

Two deliberate divergences from the function it is modelled on:

| | `can_void_document` | `can_cleanup_document` |
|---|---|---|
| who | staff **or** a party | **staff only** — cleanup is an ops action |
| signatures | blocks only a party who has themselves signed | blocks on **any** live signature from anyone, signed or still pending |

Everything else is carried across unchanged: false when `auth.uid()` is NULL, false for
`executed` / `void` / `terminated`, false on any `voided_at` / `terminated_at`, and
`has_staff_access() AND org_id = current_org()`.

## Proofs, raw output

**D — the safety model, document by document**

```
                 what                  |                  id                  | can_cleanup
---------------------------------------+--------------------------------------+-------------
 orphan, unsigned, AWAITING_SIGNATURE  | 0360f829-4c31-4dc0-9b95-3489ee9a71cb | t
 orphan, unsigned, AWAITING_SIGNATURE  | fb6abc6c-ef34-4d80-b731-543eaa40ac71 | t
 EXECUTED + signed (missing 22 fields) | ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | f
 VOID (missing 3 fields)               | 9a56b738-36f7-4a55-a813-cdd17fe4d753 | f
 known contact-orphan, EXECUTED+signed | 0ed5bf5b-6a02-4b5a-a7e9-76da4ae199d0 | f
 known contact-orphan, EXECUTED+signed | 3f44ea13-3b76-45a7-86c8-a01240dc6fe6 | f
 known contact-orphan, EXECUTED+signed | ace13a30-801e-4c75-9b27-726963b61d42 | f
 known contact-orphan, EXECUTED+signed | 84ae915c-9384-41c7-b149-f76204c655f5 | f
 known contact-orphan, EXECUTED+signed | 8ef6f9f3-b258-4fdd-b1c6-e322277f233b | f
```

**E / F — swept across the whole table, not just the interesting rows**

```
 executed_docs | wrongly_allowed          docs_with_signatures | wrongly_allowed
---------------+-----------------        ----------------------+-----------------
            61 |               0                            61 |               0
```

All 61 executed documents are refused. All 61 documents carrying a live signature are
refused. Zero exceptions.

**G / H / K / L — the refusals**

```
G. cleanup_document() on an executed+signed document
   REFUSED: this document cannot be removed: it is signed, executed, void, terminated,
            already removed, or you are not staff in this organisation
H. cleanup_document() with a blank reason
   REFUSED: a reason is required to remove a document
K. cleanup_document() twice on the same document
   REFUSED: this document cannot be removed: … already removed …
L. with no session at all
   auth.uid() = (null),  can_cleanup_document(…) = f
   document_integrity() REFUSED: staff access required
```

The guard is re-checked **inside** `cleanup_document`, not merely consulted by the UI — a
caller reaching the RPC directly gets the same refusal the button does.

**I — a genuine orphan removed, with its trail** (inside the rolled-back dry run)

```
result | {"id": "0360f829-…", "horse": "Beau", "title": "Horse Handling and Routine Care
          Liability Release", "removed_at": "2026-08-11T11:06:55.475876+00:00",
          "display_code": "DOC-3EVT7RBBZC"}

  display_code  |       status       | removed |              deleted_by
----------------+--------------------+---------+--------------------------------------
 DOC-3EVT7RBBZC | AWAITING_SIGNATURE | t       | b45a5503-89bc-489a-b012-c7fbf5c09632

status        | cleaned_up
detail        | Removed from the document integrity panel: DOC-3EVT7RBBZC (Horse Handling
                and Routine Care Liability Release, horse Beau) — status
                AWAITING_SIGNATURE, no signatures. Reason: Contract envelope no longer
                exists; document cannot be signed.
actor_user_id | b45a5503-89bc-489a-b012-c7fbf5c09632
```

**J — the panel reflects the removal immediately**

```
    check_key     | count
------------------+-------
 orphan_contract  | 1      ← was 2
 orphan_horse     | 0
 ready_no_parties | 0
 missing_fields   | 2
```

## The status_events trail

New vocab row `('document', 'cleaned_up', 'Removed by cleanup')`, applied to production.

`is_true_status = false`, **on purpose and load-bearing**: `log_status_event()` issues a
second `UPDATE documents SET current_status = …` for any code flagged true, and on a
document with an orphaned `contract_id` that second same-transaction update is precisely
what re-runs the FK check and aborts. A cleanup tool that could not clean up the one
document class it was built for would be worthless. `cleanup_document` writes the event with
a direct `INSERT` for the same reason; the `(entity_type, status)` FK to
`status_events_vocab` still validates the code, so nothing is lost by not going through the
helper. Both facts are commented in the migration with a **DO NOT FLIP THIS FLAG** note.

## Confirmation and bulk

The confirm dialog names the document, its title and its horse — "You are about to remove
**DOC-3EVT7RBBZC**, **Horse Handling and Routine Care Liability Release**, for horse
**Beau**. It is AWAITING_SIGNATURE and carries no signature." — never "this item". The
reason field is required; the confirm button stays disabled until it is non-empty.

**There is no bulk control.** One document, one button, one confirmation, one RPC that takes
a single uuid. `cleanupDocument` appears exactly twice in the panel — the import and the
single call site — and the string "clean all" appears in 0 files of the built bundle.

## Grants — re-read, not trusted

`REVOKE` reported success; here is the privilege re-read afterwards, which is the only thing
that counts:

```
                         fn                          | anon | authenticated | public_pseudo_role |                                  proacl
-----------------------------------------------------+------+---------------+--------------------+--------------------------------------------------------------------------
 can_cleanup_document(p_document_id uuid)            | f    | t             | f                  | postgres=X/postgres | authenticated=X/postgres | service_role=X/postgres
 cleanup_document(p_document_id uuid, p_reason text) | f    | t             | f                  | postgres=X/postgres | authenticated=X/postgres | service_role=X/postgres
 document_integrity()                                | f    | t             | f                  | postgres=X/postgres | authenticated=X/postgres | service_role=X/postgres
```

`anon` = false, `authenticated` = true, PUBLIC = false. The `proacl` column is the stronger
proof: **every entry names a role.** There is no empty-grantee `=X/postgres` entry, which is
how PUBLIC's default EXECUTE would appear. It is gone, not merely masked.

The revoke is written `FROM PUBLIC, anon` — revoking from `anon` alone is the silent no-op
that has bitten this repo three times, because `anon` keeps what it holds *through* PUBLIC.

`service_role=X/postgres` is the Supabase platform default applied to every function in this
schema, not something these migrations granted.

---

# BUILD

```
npm run typecheck   0 errors
npm run lint        0 errors, 30 warnings
npm run build       ✓ built in 3.82s, prerender + sitemap OK
```

The 30 lint warnings are **the origin/main baseline unchanged** — I measured it by stashing
this branch's changes and re-running: 30 before, 30 after, and none of them are in
`DocumentIntegrityPanel.tsx`, `OversightPage.tsx` or `lib/support.ts`. (CLAUDE.md's "~26" is
stale; `origin/main` itself reports 30.)

---

# VERIFIED vs ASSUMED vs NOT VERIFIED

## Verified by me, against production

- All four Part 1 preconditions, in one query, on both documents — raw output above.
- That these two are the *only* contract-orphans in `documents`, live or removed.
- That `ON DELETE SET NULL` fires normally on this FK (live probe, rolled back).
- That the FK has never been `NOT VALID` and has never been dropped/recreated (constraint
  oid clustering against the 2026-07-13 migration; `convalidated = t`).
- That all 70 FK triggers on `documents` are enabled.
- That neither document row has been updated since insert (`xmin` = insert xid, and
  `updated_at` = `created_at` under a live `BEFORE UPDATE` timestamp trigger).
- That zero orphans exist in `bookings`, `contract_parties`, `deals`, `purchases`.
- That the Part 1 migration soft-deletes both rows, writes both trail rows, drives the live
  orphan count to 0, and that `ROLLBACK` restored production exactly.
- Every integrity count, RPC vs independently-written SQL, in the same transaction; and
  again against live production after the real apply.
- That `can_cleanup_document` refuses **all 61** executed documents and **all 61** documents
  with a live signature — swept across the whole table, not sampled.
- Every refusal path in `cleanup_document` (executed, blank reason, double-removal, no
  session), by exception message.
- The grants, by re-reading `has_function_privilege` and `proacl` after the REVOKE.
- That the panel's strings are present in the built JS bundle, and that no bulk control is.
- typecheck / lint / build, and the lint baseline by direct A/B against `origin/main`.

## Assumed

- That `session_replication_role = replica` during the documented 2026-08-04 cleanup is what
  removed contract `ae4ffe95`. The mechanism is proven and the session is documented and
  dated; the specific causal link is **not** provable — commit timestamps are off, the
  contract row is gone, and no `status_events` survive for it.
- That `has_staff_access()` is the right gate for the panel. It is the same gate
  `can_void_document` and `hard_delete_contract` use, and `is_admin()` (which already gates
  the Oversight page) is a strict subset of it.
- That `contract_field_defs` keyed by `template_key` is the correct definition of "fields
  the template defines". It reproduces the NOGUARD2 numbers exactly (22 and 3), which is
  strong corroboration but is not the same as having verified the intent.

## NOT VERIFIED

- **The render.** I have no staff browser session and was not given one. I have not seen
  this panel draw. What I can show is the RPC's real output, the component source, and the
  fact that its strings are in the built bundle — I did not build a harness and I am not
  describing anything as a render.
- **The signing flow succeeding after cleanup.** The signing freeze is in force, so I could
  not observe a signature. The reasoning is explicit and testable: the abort comes from a
  second same-transaction `UPDATE` on a row version created by that same transaction, which
  re-runs the FK check against a missing parent. Removing the document removes it from the
  signable set entirely, so the path is not reached rather than being fixed. **Nothing here
  lifts the freeze.**
- One consequence of the `has_staff_access()` gate worth flagging: `admin@cactai.io`
  (SUPER_ADMIN, `org_id = NULL`) gets `staff access required`, because `current_org()`
  returns NULL for it. That is correct under D1 — the platform owner is never an FHE tenant
  identity — but it means the panel is readable by `admin@fhequestrian.com` /
  `hello@fhequestrian.com`, not by the platform account.

  **Correction, 2026-08-11 (see §NULL below).** That was true of `document_integrity()`,
  which uses an explicit `IS NULL` test, and *not* of the cleanup path, which admitted the
  platform owner through a NULL. Stating the gate as uniformly correct was wrong. Fixed and
  proven below.

---

# §NULL — the guard returned NULL, and it was a LIVE hole

Added 2026-08-11, after the work above. Applied, not held.

## What was wrong

`can_cleanup_document` ended with:

```sql
RETURN has_staff_access() AND v_org = current_org();
```

For a caller whose `current_org()` is NULL, `v_org = current_org()` is NULL and
`true AND NULL` is NULL — so the function returned **NULL, not false**. Only a caller who is
*staff* **and** has a NULL org reaches it; for anyone else the expression short-circuits to
`false AND NULL` = false. Today that is exactly one account: `admin@cactai.io`, SUPER_ADMIN,
`org_id NULL`.

`docs/reference/D1a-PLATFORM-OWNER-IS-NOT-A-TENANT.md` describes this class precisely, and
names this task:

> "…evaluates to NULL for a caller whose `current_org()` is NULL, so the `IF` skips and the
> caller is admitted. For the platform owner that admission was the accident. The denial is
> the correct behaviour."

## It was not latent. It was live.

`cleanup_document` guarded itself with `IF NOT can_cleanup_document(id) THEN RAISE …`.
`NOT NULL` is NULL, which is not TRUE, so **the RAISE never fired and execution fell through
to the delete.** Proven against production inside `BEGIN … ROLLBACK`, acting as the platform
owner:

```
=== 1. the caller shape ===
              acting_as               |    role     | staff | org
--------------------------------------+-------------+-------+-----
 3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5 | SUPER_ADMIN | t     |

=== 2. can_cleanup_document on an FHE tenant document: NULL, or false? ===
 result | is_null
--------+---------
        | t

=== 3. what `IF NOT can_cleanup_document(...)` therefore does ===
 not_result | if_branch_taken
------------+-----------------
            | f                  ← the RAISE is skipped

=== 4. can the platform owner actually remove an FHE document RIGHT NOW? ===
WARNING:  HOLE CONFIRMED — the platform owner removed an FHE tenant document
  display_code  | was_removed |              deleted_by
----------------+-------------+--------------------------------------
 DOC-84AAB8KDWT | t           | 3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5

=== 5. document_integrity() (uses an explicit IS NULL test) ===
NOTICE:  refused as designed: staff access required
ROLLBACK
```

A platform-owner-attributed delete of an FHE tenant document is precisely the D1 violation
the ruling forbids. `document_integrity()` was never exposed — it tests `v_org IS NULL`
explicitly, which yields a real boolean.

## The fix

```sql
RETURN coalesce(has_staff_access() AND v_org = current_org(), false);
```

plus the same defence on the destructive call site itself, so the path refuses even if the
predicate is later changed back:

```sql
IF NOT coalesce(can_cleanup_document(p_document_id), false) THEN
```

**The denial of the platform owner is the intended end state, not a regression.** D1a settles
it, and explicitly refuses the "just set `org_id` on `admin@cactai.io`" shortcut. Nothing
here re-opens that.

## Proofs after applying, against live production

The fix is in the live function bodies (read back from `pg_get_functiondef`, not assumed):

```
 guard_coalesced | t          call_site_coalesced | t
```

**Platform owner — denied, and false rather than NULL:**

```
    role     | org | result | still_null
-------------+-----+--------+------------
 SUPER_ADMIN |     | f      | f
```

```
DENIED as D1a requires: this document cannot be removed: it is signed, executed, void,
                        terminated, already removed, or you are not staff in this organisation
  display_code  | was_removed
----------------+-------------
 DOC-84AAB8KDWT | f
```

**Tenant staff — unchanged in every case:**

```
                 what                  | can_cleanup | is_null
---------------------------------------+-------------+---------
 orphan, unsigned                      | t           | f
 orphan, unsigned                      | t           | f
 EXECUTED + signed                     | f           | f
 VOID                                  | f           | f
 known contact-orphan, EXECUTED+signed | f           | f
```

**The whole-table sweeps still hold, and NULL is gone entirely:**

```
 executed_docs | wrongly_allowed | still_null          docs_with_signatures | wrongly_allowed | still_null
---------------+-----------------+------------        ----------------------+-----------------+------------
            61 |               0 |          0                            61 |               0 |          0

 all_live_docs | any_null_left
---------------+---------------
            73 |             0     ← every live document now yields a real boolean
```

Tenant staff can still remove a genuine orphan, attributed to them
(`deleted_by = b45a5503-…`), and the panel still refuses the platform owner with
`staff access required`.

No frontend change was needed — the UI already treated the value as falsy, which is why this
never surfaced as visible breakage.

---

# A COUNT MOVED WHILE THIS TASK WAS RUNNING — and it exposes a weakness in one check

`missing_fields` read **2** when measured at 11:00 and **1** at 11:20. I did not change it:
another session edited the lease template in production between the two runs, taking
`contract_field_defs` for `HORSE_LEASE_V2` from **128 defs to 114**.

The check is count-based, exactly as the spec defined it ("documents holding fewer fields
than their template defines"), and it reproduced the NOGUARD2 numbers exactly at the time.
But the template shrinking underneath it shows the count is a weak proxy:

```
  display_code  |  status  | have | defined | defined_keys_absent | stale_keys_held
----------------+----------+------+---------+---------------------+-----------------
 DOC-RXW6U9M3BF | EXECUTED |  106 |     114 |                  35 |              27
 DOC-U4PZP54FP5 | VOID     |  125 |     114 |                  15 |              26
```

`DOC-U4PZP54FP5` **is missing 15 keys the template defines** — but it holds 26 keys the
template no longer defines, so its total (125) exceeds the defined count (114) and the
count-based check no longer flags it. It renders an incomplete contract and the panel now
says it is fine.

**Not changed here.** The semantics were specified and signed off, and this turn's
instruction was narrow. Flagging it for a ruling: comparing *keys* rather than *counts* would
catch both documents and would not drift when a template is edited. It would also surface the
stale-key side, which is arguably a second defect worth its own check.

---

# WHAT NEEDS A DECISION

1. **Apply Part 1?** The migration is written, dry-run, and guarded. It has not been
   applied. It removes two unsigned documents and destroys no evidence.
2. **The `session_replication_role` practice.** Part 1 removes the last visible trace of
   this incident. The finding above is the record of it; the recommendation in that section
   is not implemented and is not in scope here.
3. **Key-based vs count-based `missing_fields`.** The count-based check now passes a document
   that is missing 15 defined keys. Changing it is a semantics change to a signed-off spec,
   so it waits for a ruling.
4. **The wider NULL-guard sweep.** D1a records 48 functions in the same shape and declares
   the `coalesce(…, false)` repairs safe and NOGUARD3 Phase B unblocked. This task repaired
   the two functions it owns. The other 48 are not touched here.
