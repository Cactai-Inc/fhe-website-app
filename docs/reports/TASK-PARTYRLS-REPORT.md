# TASK PARTYRLS — party read access on document_parties (+ document_deliveries)

Branch: `task/partyrls` · Worktree: `wt-partyrls` (off `origin/main` @ `98f541d`)
Date: 2026-08-06

## Scope delivered

One migration, `document_parties` only:
`supabase/migrations/20260806130000_partyrls_document_parties_self_read.sql`
adds one permissive SELECT policy, `document_parties_self_read`
(`contact_id = current_contact_id()`). No INSERT/UPDATE/DELETE grants. No
other tables, functions, or UI changed.

**`document_deliveries` got no migration.** The task's diagnosis assumed it
had "the same class of gap." Live verification (§1, §2 below) shows it does
not — it already carries a party-read OR-arm and a real party already reads
their own delivery rows today. Adding a second, redundant policy would have
been scope for its own sake, so I didn't. Full reasoning in §2.

## 1. Read-first (done before writing anything)

**`pg_policies` on `document_parties`, before:**
```
 schemaname |      tablename      |           policyname            | permissive  |      roles      |  cmd   |                                                              qual                                                               |        with_check
------------+---------------------+---------------------------------+-------------+-----------------+--------+---------------------------------------------------------------------------------------------------------------------------------+--------------------------
 public     | document_parties    | document_parties_org_boundary   | RESTRICTIVE | {authenticated} | ALL    | (org_id = current_org())                                                                                                        | (org_id = current_org())
 public     | document_parties    | document_parties_staff_all      | PERMISSIVE  | {authenticated} | ALL    | has_staff_access()                                                                                                              | has_staff_access()
```
Exactly as the task described: one RESTRICTIVE org-boundary policy, one
PERMISSIVE staff-only policy. A restrictive policy only narrows what a
permissive policy grants and never grants alone, so any non-staff caller gets
zero rows regardless of org membership or party status.

**`pg_policies` on `document_deliveries`, before (unchanged by this task —
shown for the record):**
```
 document_deliveries | document_deliveries_admin_write | PERMISSIVE | {authenticated} | ALL    | is_admin()
 document_deliveries | document_deliveries_select      | PERMISSIVE | {authenticated} | SELECT | (is_admin() OR ((deleted_at IS NULL) AND (caller_owns_document(document_id) OR (recipient_contact_id = current_contact_id()))))
```
`document_deliveries_select` already has a `recipient_contact_id =
current_contact_id()` OR-arm, unconditional on staff status. It was added in
the *original* migration (`20260629050000_documents_signatures_deliveries.sql`,
lines 202-211), not by a later fix — it has never had the gap the task
described. There is no RESTRICTIVE policy on this table at all, so the
permissive OR-arm is sufficient on its own.

**`listMySignableDocuments()` (`src/lib/ops/api-client.ts:70-116`)** — three
sequential client-side queries, all under the caller's own session:
1. `document_parties` — `.select('document_id, party_role').eq('contact_id', contactId).eq('is_signer', true)`
2. `documents` — `.select('*').in('id', [...]).is('deleted_at', null).neq('status', 'VOID')`
3. `signatures` — `.select('document_id, party_role, signed_at').in('document_id', [...]).eq('signer_contact_id', contactId)`

Query 1 is the one this task fixes. Query 2 already works today —
`documents_select` got a `caller_is_document_party(id)` OR-arm from TASK
DOCVIS (`20260804160000`), and that helper is `SECURITY DEFINER` so it
doesn't depend on `document_parties` RLS. Query 3 is discussed in §4 — it
turns out to have its own, separate gate that this task's named policies
don't touch.

**Other client-side reads of `document_parties` / `document_deliveries`
found in `src/`:**
- `src/lib/ops/api-documents.ts:20` (`listDocumentPartyContacts`) — staff-only
  delivery-panel recipient dropdown, reached only from
  `src/components/ops/documents/DeliveryPanel.tsx`. Relies on
  `document_parties_staff_all`; untouched and unaffected by the new
  self-read policy (it's an additional OR-arm, doesn't narrow staff access).
- `src/lib/api.ts:1132` (`listDeliveries`) and `:1146` (`recordDelivery`) —
  same staff-only `DeliveryPanel.tsx` path, `document_deliveries`. No
  party-facing caller of `document_deliveries` exists in `src/` yet (it's
  for the planned stamp-trail feature per the task doc) — so the fact that
  the policy already supports it is currently unexercised, not moot.

## 2. Dry-run (BEGIN…ROLLBACK, raw output)

**Before, as CJ (`profiles.user_id = 0a7fc801-…`, `contact_id =
d99f1472-…`, `role = USER`, non-staff, 17 own `document_parties` rows in
the DB):**
```
BEGIN
SET
SET
            cj_contact_id             |                cj_org                | cj_is_staff
--------------------------------------+--------------------------------------+-------------
 d99f1472-48b4-466e-aaa7-f76396745c17 | e656f20b-ef43-4725-9029-19e7f0190d9c | f
(1 row)

 cj_document_parties_before
----------------------------
                          0
(1 row)

 cj_document_deliveries_before
-------------------------------
                            13
(1 row)
ROLLBACK
```
Confirms the defect exactly as diagnosed: CJ has 17 rows and sees 0. Also
confirms `document_deliveries` is **not** broken — CJ already sees 13 rows
(his own 7 `recipient_contact_id` rows plus rows on documents he owns) with
zero migration applied, which is why §"Scope delivered" above says no
`document_deliveries` change was made.

**Migration applied inside the dry-run transaction, then rolled back:**
```
BEGIN
--- applying migration DDL ---
CREATE POLICY
--- policy list after DDL (still inside txn) ---
    tablename     |          policyname           | permissive  |  cmd   |                qual
------------------+-------------------------------+-------------+--------+-------------------------------------
 document_parties | document_parties_org_boundary | RESTRICTIVE | ALL    | (org_id = current_org())
 document_parties | document_parties_self_read    | PERMISSIVE  | SELECT | (contact_id = current_contact_id())
 document_parties | document_parties_staff_all    | PERMISSIVE  | ALL    | has_staff_access()
(3 rows)

--- CJ session: count after (expect 17) ---
SET
SET
 cj_own_rows
-------------
          17
(1 row)

--- CJ session: query filtered to ANOTHER contact id (expect 0) ---
 other_contact_rows_visible_to_cj
----------------------------------
                                0
(1 row)
ROLLBACK
```

**Staff session, before and after, both inside separate dry-run
transactions (staff = `profiles.user_id = b45a5503-…`, `role = ADMIN`):**
```
=== STAFF session BEFORE (no migration applied yet) ===
BEGIN
SET
SET
            staff_contact             | is_staff
--------------------------------------+----------
 75475f66-8950-4f13-832c-5471070737f8 | t
(1 row)

 staff_visible_before
----------------------
                  101
(1 row)
ROLLBACK
=== STAFF session AFTER (migration applied in-txn, then rolled back) ===
BEGIN
CREATE POLICY
SET
SET
 staff_visible_after
---------------------
                 101
(1 row)
ROLLBACK
=== superuser total row count in the org (upper bound reference) ===
 total_org_rows
----------------
            101
(1 row)
```
101 = 101 = 101: staff sees the full org set, unchanged, and it equals the
unfiltered total — the new policy adds nothing for staff (it's already
covered by the unconditional `document_parties_staff_all`).

Every simulated session above used the established convention from prior
threads (`docs/reports/TASK-DOCVIS-REPORT.md`, `TASK-A13-REPORT.md`):
`SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims =
'{"sub":"<user_id>"}';` inside `BEGIN…ROLLBACK`, which makes `auth.uid()` —
and therefore `current_contact_id()` — resolve exactly as it would for that
user's real JWT.

## 3. Apply (real, committed)

```
BEGIN
CREATE POLICY
COMMIT
--- confirmed policy now live ---
    tablename     |          policyname           | permissive  |  cmd   |                qual
------------------+-------------------------------+-------------+--------+-------------------------------------
 document_parties | document_parties_org_boundary | RESTRICTIVE | ALL    | (org_id = current_org())
 document_parties | document_parties_self_read    | PERMISSIVE  | SELECT | (contact_id = current_contact_id())
 document_parties | document_parties_staff_all    | PERMISSIVE  | ALL    | has_staff_access()
(3 rows)
```

## 4. Post-apply verification (live, not a rolled-back simulation)

**CJ's session now sees exactly his own 17 rows** (all 17 listed, matching
the pre-fix superuser inventory row for row — 11 documents, several with
both a CLIENT and a PARTICIPANT row):
```
 cj_visible_after
------------------
               17
(1 row)
```

**Cross-contact isolation** — CJ's session, query explicitly scoped to
another contact's `contact_id` (the LESSEE on the shared lease,
`352c3898-…`) still returns 0:
```
 lessee_rows_visible_to_cj
---------------------------
                         0
(1 row)
```
The LESSEE contact has no `profiles` row (no login), so a second live party
session for that specific document wasn't available to test end-to-end —
the cross-contact isolation check above (a real session querying a
different contact's rows) is the proof that stands in for it.

**`listMySignableDocuments()`'s three queries, replayed verbatim under CJ's
JWT, live, post-fix:**

Step 1 (`document_parties`, `is_signer = true`) — 11 rows, all his own,
including `ecaecd42-…` (LESSOR) — **this is the query the migration fixes,
and it now returns rows.**

Step 2 (`documents`, non-void) — 10 rows (the 11th, `9a56b738-…`, is
`VOID` and correctly excluded). Includes `ecaecd42-…` as `EXECUTED /
signed` — confirms query 2 already worked pre-fix via `caller_is_document_party`
and continues to.

Step 3 (`signatures`, `signer_contact_id = me`) — only **6** rows, all
`CLIENT`-role documents where CJ is also `documents.contact_id` (the
owner). The 3 documents where CJ is a party-but-not-owner (`LESSOR` role:
`215bac09-…`, `9a56b738-…` [void, moot], `ecaecd42-…`) are **silently
absent** — same failure shape as the bug this task fixes, but on a
different table.

Confirmed as superuser that this is a real gate, not a real absence: CJ
does have a sealed signature on `ecaecd42-…`:
```
                  id                  |             document_id              | party_role |          signer_contact_id           |           signed_at
--------------------------------------+--------------------------------------+------------+--------------------------------------+-------------------------------
 ed429d2e-670a-4e73-b467-19bf3030f3c0 | ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | LESSOR     | d99f1472-48b4-466e-aaa7-f76396745c17 | 2026-07-24 05:12:31.420889+00
```
`signatures_select` is `is_admin() OR (deleted_at IS NULL AND
caller_owns_document(document_id))` — and `caller_owns_document` is a
strict `documents.contact_id = current_contact_id()` ownership check, not a
party check. So for `ecaecd42-…` (owner = the LESSEE, `352c3898-…`), CJ's
own signature row is invisible to CJ.

**Net effect on the app today:** the "Contracts you've signed" section will
now render and list `ecaecd42-…` for CJ (steps 1 and 2 both work), with a
correct PDF/download/click-through — but its `signed` flag will read
**false**, because step 3 can't see his signature. This reproduces for any
party who is a signer-but-not-owner on an executed document (the LESSOR
side of every lease is the structural example — `documents.contact_id`
is single-owner and leases have two real parties).

This is the same class of bug the task fixes (a restrictive-shaped read
gate silently zeroing out a genuine party's own rows), but it lives on
`signatures_select` / `caller_owns_document`, not on either of the two
policies this task was scoped to. Per the task's STOP-and-report rule I
did not touch it — **listing it, not fixing it.**

I could not open a real browser session in this environment; the queries
above are proven to return the right rows under the party's actual JWT
resolution mechanism (`auth.uid()` → `current_contact_id()`), which is the
same code path Supabase's client library exercises. **The browser
click-through/PDF/download visual check itself remains for the owner.**

## 5. What I verified vs. assumed

Verified, with raw output above: the pre-fix defect on `document_parties`;
that `document_deliveries` was never actually broken; the migration's
before/after policy list; CJ's own-row visibility after the fix (17/17);
cross-contact isolation (0 rows for another contact); staff-session
parity (101/101, matching the org total); the exact three queries
`listMySignableDocuments()` issues, live, post-fix, including the
`signatures` gap and proof (via superuser query) that it's a real gate and
not a real absence of a signature.

Assumed, not verified: that the frontend renders `signed: false` rather
than throwing when a document has no matching `signatures` row for the
caller (read `AccountPanels.tsx` / `Documents.tsx` logic, didn't run the
UI) — reasonable given `sealed.has(...)` is a plain `Set` lookup with no
`undefined`-path branch, but not click-tested.

## 6. Other things gated the same way (list, don't fix)

- **`signatures_select` / `caller_owns_document`** — §4 above. A signer
  party who isn't `documents.contact_id`'s owner can't see their own
  signature row, so `listMySignableDocuments()`'s `signed` flag is wrong
  (always `false`) for that party on that document. Structural for any
  lease's LESSOR (the LESSEE is the document owner) and any other
  multi-party document where the signing party differs from the owner.
  `caller_owns_document` is also used by `signatures_insert_self` (a WRITE
  path — noted as the reason DOCVIS didn't widen the helper itself either),
  so the fix shape isn't a trivial helper swap; it needs its own scoped
  task.
- Nothing else found gated this way in the `document_parties` /
  `document_deliveries` client-read surface — `documents_select` and
  `document_deliveries_select` both already carry party-read arms (the
  former from TASK DOCVIS, the latter since the original migration).

## 7. Rules followed

- Own worktree (`wt-partyrls`), branch `task/partyrls`, off `origin/main` @
  `98f541d`.
- Dry-run in `BEGIN…ROLLBACK` before applying, raw output shown (§2).
- SELECT policy only, no INSERT/UPDATE/DELETE.
- Tested with CJ's real non-staff identity, party on executed lease
  `ecaecd42-…`.
- Sarah's document `704c8d2d-…` was never referenced or queried — this
  task's live-data proofs used CJ's own rows and the LESSEE contact id
  (queried by id only, to prove isolation, never to read the LESSEE's live
  negotiation content) plus the lease `ecaecd42-…`, which is `EXECUTED`,
  not the live negotiation in question.
- No scope widened beyond the two named policies — `document_deliveries`
  got investigated, found already correct, and left alone; the
  `signatures` gap found along the way was reported, not touched.
