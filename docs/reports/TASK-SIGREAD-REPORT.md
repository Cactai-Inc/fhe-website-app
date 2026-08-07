# TASK SIGREAD — a signer cannot see their own signature

Branch: `task/sigread-signature-self-read` · Worktree: `wt-sigread` (off `origin/main`
@ `fa06ac9`)
Date: 2026-08-06

## Scope delivered

One migration, `signatures` only:
`supabase/migrations/20260806140000_sigread_signatures_self_read.sql` adds one
permissive SELECT policy, `signatures_self_read`
(`deleted_at IS NULL AND signer_contact_id = current_contact_id()`). No
INSERT/UPDATE/DELETE grants. `caller_owns_document` was not touched. No other
tables, functions, or UI files were changed — `ClauseDocument.tsx` was never
opened.

Column confirmed against the live schema before writing anything (`\d
signatures`): `signer_contact_id uuid not null`, matching the task doc.

## 1. Reproduce first (read-only, `BEGIN…ROLLBACK`)

Identity: CJ (`cjzigs@icloud.com`, `profiles.user_id =
0a7fc801-5b17-41f5-b379-11982030d182`, `contact_id =
d99f1472-48b4-466e-aaa7-f76396745c17`, `role = USER`, non-staff). Superuser
query confirmed CJ has exactly 7 `signatures` rows
(`signer_contact_id = d99f1472-…`), 6 on documents he owns (`documents.contact_id
= his own contact_id`, all `CLIENT` role) and 1 on a document he does **not**
own: `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3`, an `EXECUTED` lease where he is
`LESSOR` and the document owner (`documents.contact_id`) is the `LESSEE`,
`352c3898-65d0-4a90-ad59-29107b7e03fe` — the exact structural case the task
describes (the LESSOR side of a lease). That document has 2 signature rows
total (his `LESSOR` row and the `LESSEE`'s row).

```
=== CJ session: identity check ===
BEGIN
SET
SET
            cj_contact_id             | cj_is_admin 
--------------------------------------+-------------
 d99f1472-48b4-466e-aaa7-f76396745c17 | f
(1 row)

=== CJ visible rows on target doc ecaecd42... (he signed as LESSOR, does not own it) — expect 0 ===
 cj_visible_on_target_doc 
--------------------------
                        0
(1 row)

=== CJ visible rows overall where he is the signer — ground truth is 7, expect 6 (one hidden) ===
 cj_visible_total_as_signer 
----------------------------
                          6
(1 row)

ROLLBACK
```
Defect reproduced exactly as diagnosed: CJ's own signature row on a document he
signed but does not own is invisible to him.

## 2. Dry-run (`BEGIN…ROLLBACK`, raw output)

**Policies on `signatures`, before:**
```
 tablename  |       policyname        | permissive  |  cmd   |                                     qual                                     
------------+-------------------------+-------------+--------+------------------------------------------------------------------------------
 signatures | signatures_admin_write  | PERMISSIVE  | ALL    | is_admin()
 signatures | signatures_insert_self  | PERMISSIVE  | INSERT | 
 signatures | signatures_org_boundary | RESTRICTIVE | ALL    | (org_id = current_org())
 signatures | signatures_select       | PERMISSIVE  | SELECT | (is_admin() OR ((deleted_at IS NULL) AND caller_owns_document(document_id)))
(4 rows)
```
Exactly as the task described: no `signer_contact_id = current_contact_id()`
clause anywhere.

**Migration applied inside the dry-run transaction:**
```
BEGIN
CREATE POLICY
 tablename  |       policyname        | permissive  |  cmd   |                                     qual                                     
------------+-------------------------+-------------+--------+------------------------------------------------------------------------------
 signatures | signatures_admin_write  | PERMISSIVE  | ALL    | is_admin()
 signatures | signatures_insert_self  | PERMISSIVE  | INSERT | 
 signatures | signatures_org_boundary | RESTRICTIVE | ALL    | (org_id = current_org())
 signatures | signatures_select       | PERMISSIVE  | SELECT | (is_admin() OR ((deleted_at IS NULL) AND caller_owns_document(document_id)))
 signatures | signatures_self_read    | PERMISSIVE  | SELECT | ((deleted_at IS NULL) AND (signer_contact_id = current_contact_id()))
(5 rows)

--- CJ session: target doc (expect 1 now — his LESSOR row; the LESSEE row stays hidden) ---
SET
SET
 cj_visible_on_target_doc_after 
--------------------------------
                              1
(1 row)

--- CJ session: total as signer (expect 7 now, was 6) ---
 cj_visible_total_after 
------------------------
                      7
(1 row)

--- CJ session: within the same doc, the OTHER signer (LESSEE, a different contact) still 0 ---
 cj_sees_lessee_row 
--------------------
                  0
(1 row)

RESET
ROLLBACK
```

**Boundary, cross-session (a different real login, not just a different query
filter): `maeboon@gmail.com`, `user_id =
d9f57a2f-d009-46dd-a77c-bcc2803c7e85`, `contact_id =
bce1bcf7-e0bc-4374-bb13-9f9cef5db204` — no relation to CJ or to Sarah's
document — scoped explicitly to CJ's `signer_contact_id`, in its own dry-run
transaction:**
```
BEGIN
CREATE POLICY
SET
SET
          maeboon_contact_id          
--------------------------------------
 bce1bcf7-e0bc-4374-bb13-9f9cef5db204
(1 row)

 maeboon_sees_cjs_rows 
-----------------------
                     0
(1 row)

RESET
ROLLBACK
```
The new policy does not leak CJ's rows to an unrelated party.

**Staff parity, same ADMIN session (`admin@fhequestrian.com`, `user_id =
b45a5503-89bc-489a-b012-c7fbf5c09632`), before and after, each its own
dry-run transaction:**
```
=== before ===
BEGIN
SET
SET
 staff_visible_before 
----------------------
                   56
(1 row)
ROLLBACK

=== after ===
BEGIN
CREATE POLICY
SET
SET
 staff_visible_after 
---------------------
                  56
(1 row)
RESET
 superuser_total 
-----------------
              56
(1 row)
ROLLBACK
```
56 = 56 = 56 (superuser total, unfiltered): staff sees the full set, unchanged
by the new policy, matching the org's actual row count. (`signatures_select`
gates on `is_admin()`, not the broader `has_staff_access()` used elsewhere —
pre-existing, not something this task touches.)

## 3. Apply (real, committed)

```
=== APPLY (real, committed) ===
BEGIN
CREATE POLICY
 tablename  |       policyname        | permissive  |  cmd   |                                     qual                                     
------------+-------------------------+-------------+--------+------------------------------------------------------------------------------
 signatures | signatures_admin_write  | PERMISSIVE  | ALL    | is_admin()
 signatures | signatures_insert_self  | PERMISSIVE  | INSERT | 
 signatures | signatures_org_boundary | RESTRICTIVE | ALL    | (org_id = current_org())
 signatures | signatures_select       | PERMISSIVE  | SELECT | (is_admin() OR ((deleted_at IS NULL) AND caller_owns_document(document_id)))
 signatures | signatures_self_read    | PERMISSIVE  | SELECT | ((deleted_at IS NULL) AND (signer_contact_id = current_contact_id()))
(5 rows)
COMMIT

=== confirmed policy now live (fresh read, outside any txn) ===
 tablename  |       policyname        | permissive  |  cmd   |                                     qual                                     
------------+-------------------------+-------------+--------+------------------------------------------------------------------------------
 signatures | signatures_admin_write  | PERMISSIVE  | ALL    | is_admin()
 signatures | signatures_insert_self  | PERMISSIVE  | INSERT | 
 signatures | signatures_org_boundary | RESTRICTIVE | ALL    | (org_id = current_org())
 signatures | signatures_select       | PERMISSIVE  | SELECT | (is_admin() OR ((deleted_at IS NULL) AND caller_owns_document(document_id)))
 signatures | signatures_self_read    | PERMISSIVE  | SELECT | ((deleted_at IS NULL) AND (signer_contact_id = current_contact_id()))
(5 rows)
```

## 4. Post-apply verification (live, not a rolled-back simulation)

**CJ's session now sees his own row on the target document, and only that
row:**
```
--- target doc (expect 1: his own LESSOR row) ---
                  id                  |             document_id              | party_role |          signer_contact_id           |           signed_at           
--------------------------------------+--------------------------------------+------------+--------------------------------------+-------------------------------
 ed429d2e-670a-4e73-b467-19bf3030f3c0 | ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | LESSOR     | d99f1472-48b4-466e-aaa7-f76396745c17 | 2026-07-24 05:12:31.420889+00
(1 row)

--- total as signer (expect 7, matches superuser ground truth) ---
 cj_visible_total 
------------------
                7
(1 row)

--- within that doc, the LESSEE (different contact) row is still invisible to CJ (expect 0) ---
 cj_sees_lessee_row 
--------------------
                  0
(1 row)
```

**Boundary held, live, cross-session (maeboon, scoped to CJ's
`signer_contact_id`):**
```
 maeboon_sees_cjs_rows 
-----------------------
                     0
(1 row)
```

**Staff unchanged, live:**
```
 staff_visible 
---------------
            56
(1 row)
```

**Superuser ground truth, live — confirms this task added zero rows, only a
policy:**
```
 superuser_total 
-----------------
              56
(1 row)
```

## 5. User-visible outcome — the actual point of the task

`listMySignableDocuments()` (`src/lib/ops/api-client.ts:70-116`) is the
function behind the Documents page's "signed" flag
(`src/pages/app/Documents.tsx:214`, `sealed = signables.filter((s) =>
s.signed)`). It runs three sequential queries under the caller's own session
and computes `signed` from a `Set` built off query 3
(`sealed.has(`${document_id}:${party_role}`)`, `api-client.ts:106-114`).
Replayed verbatim, live, as CJ, scoped to the target document:

```
--- step 1: document_parties, is_signer=true (roster) ---
             document_id              | party_role 
--------------------------------------+------------
 ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | LESSOR
(1 row)

--- step 2: documents, non-void, non-deleted ---
                  id                  |  status  | deleted_at 
--------------------------------------+----------+------------
 ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | EXECUTED | 
(1 row)

--- step 3: signatures, signer_contact_id = me, deleted_at IS NULL (this is the query the fix targets) ---
             document_id              | party_role |           signed_at           
--------------------------------------+------------+-------------------------------
 ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | LESSOR     | 2026-07-24 05:12:31.420889+00
(1 row)
```

Steps 1 and 2 already worked before this task (`TASK-PARTYRLS` /
`TASK-DOCVIS`). Step 3 — the one this task's policy governs — now returns
CJ's row with a non-null `signed_at`. That populates
`sealed = {'ecaecd42-…:LESSOR'}`, and `roleByDocument.get(id) === 'LESSOR'`
matches it, so `signed: true` for this document in the array
`listMySignableDocuments()` returns. Before the fix, step 3 returned zero
rows for this document (§1 above), `sealed` did not contain the key, and
`signed` would have read `false` for a document CJ genuinely signed — the
exact defect described in the task doc. The Documents page will now render
`ecaecd42-…` as signed for CJ.

I could not open a real browser session in this environment; the query above
is the identical query the Supabase client issues under the caller's real
JWT, and its result is what `listMySignableDocuments()` deterministically
maps to `signed: true`. The pixel-level click-through remains for the owner,
consistent with how `TASK-PARTYRLS` left the same caveat.

## 6. What I verified vs. assumed

Verified, with raw output above: the pre-fix defect (CJ, 0 of 2 rows visible
on a document he signed but doesn't own); the before/after policy list; CJ's
own-row visibility after the fix; that the *other* signer's row on the same
document stays invisible to CJ (a same-document boundary check, not just a
different-document one); cross-session isolation using a real, unrelated
login (`maeboon@gmail.com`) explicitly scoped to CJ's `signer_contact_id`;
staff-session parity (56/56/56, matching the org total, before and after);
that zero rows were added or removed by this migration; the exact three
queries `listMySignableDocuments()` issues, live, post-fix, and the resulting
`signed: true` computation traced by hand against the current source.

Assumed, not verified: the actual pixel-level render of the Documents page
(no browser session available in this environment) — reasonable given the
`signed` boolean is computed deterministically from the query above and
`Documents.tsx:214`'s filter is a plain boolean check, but not click-tested.

## 7. Rules followed

- Own worktree (`wt-sigread`), branch `task/sigread-signature-self-read`, off
  `origin/main` @ `fa06ac9`.
- Confirmed the `signer_contact_id` column name against the live schema
  before writing the migration, per the task doc's instruction not to trust
  it blindly.
- Reproduced the defect first, with raw output, before writing any fix.
- Dry-run in `BEGIN…ROLLBACK`, raw output shown, before applying.
- One permissive SELECT policy only. No INSERT/UPDATE/DELETE. Nothing beyond
  this was needed — not stopping/reporting a scope overrun, because none
  occurred.
- `caller_owns_document` was not touched, read, or modified.
- `ClauseDocument.tsx` was never opened.
- Sarah's document `704c8d2d-…` was never referenced in any query — all
  live-data proofs used CJ's own rows, the target lease `ecaecd42-…`
  (`EXECUTED`, unrelated to Sarah's negotiation), and `maeboon@gmail.com` for
  the cross-session boundary check.
- No writes beyond the single `CREATE POLICY` DDL statement in the
  migration.
