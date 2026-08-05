# TASK DOCVIS — parties see documents they signed (multi-party visibility fix)

Branch: `task/docvis-party-documents` · Worktree: `wt-docvis` (off `origin/main` @ `9364562`)
Date: 2026-08-04

## Scope delivered

One migration (`documents_select` RLS policy widened + `my_documents()`
widened), no other writes. No UI changes. `ClauseDocument.tsx` untouched. No
documents deleted.

## 1. Read-first (mandatory, done before writing anything)

**`my_documents()`** — `SECURITY DEFINER SQL`, `RETURNS TABLE(document_id,
template_key, title, kind, signed_at, current_status, superseded, created_at,
executed_email_sent_at)`. Three `UNION ALL` branches (pending / assigned /
executed); the "pending" and "executed" branches both filtered on
`d.contact_id = current_contact_id()` only. The "assigned" branch keys off
`contact_required_documents.contact_id`, unrelated to a specific document row
— left alone.

**`caller_owns_document(doc_id)`** — `EXISTS (... d.contact_id =
current_contact_id())`. Single-owner check, unchanged by this task.

**`caller_is_document_party(p_document_id)`** — `EXISTS (documents d JOIN
document_parties dp ... dp.contact_id = current_contact_id())`. No
`is_signer` filter — matches ANY party row for the caller, signer or not.
This is exactly the predicate the locked design calls for; reused directly
rather than re-implemented.

**Every policy on `documents`** (`pg_policies`):
```
documents_admin_write   ALL     PERMISSIVE   is_admin()
documents_org_boundary  ALL     RESTRICTIVE  org_id = current_org()
documents_select        SELECT  PERMISSIVE   is_admin() OR caller_owns_document(id)
                                              OR (horse_id IS NOT NULL AND client_can_read_horse(horse_id))
```

**Dependents check on `caller_owns_document`** — `SELECT prosrc ... LIKE
'%caller_owns_document%'` on `pg_proc` returned **0 rows** (no SQL function
body calls it as a sub-expression); it's used only as an inline RLS
predicate. Searching `pg_policies.qual`/`with_check` directly found **4**
policies:

```
documents            documents_select             SELECT  is_admin() OR caller_owns_document(id) OR (horse-read arm)
document_deliveries  document_deliveries_select    SELECT  is_admin() OR (deleted_at IS NULL AND (caller_owns_document(document_id) OR recipient_contact_id = current_contact_id()))
signatures            signatures_select            SELECT  is_admin() OR (deleted_at IS NULL AND caller_owns_document(document_id))
signatures            signatures_insert_self        INSERT  WITH CHECK (signer_contact_id = current_contact_id() AND caller_owns_document(document_id))
```

`signatures_insert_self` is a **WRITE** path gated by `caller_owns_document`.
This is exactly the case the task doc's locked design anticipated: because a
write path depends on the helper, **the helper itself is not widened** — only
`documents_select` gets a new OR-arm. `document_deliveries_select` and
`signatures_select` (both read paths that also use the helper) are left
exactly as they were; the task only asked to widen document *read* access via
`documents_select`, and touching those two wasn't part of the locked design,
so they're unchanged.

This also matches the exact precedent already in the codebase:
`supabase/migrations/20260714420000_lessee_reads_horse_docs_in_term.sql`
previously added a horse-read OR-arm to this same `documents_select` policy
the same way (`DROP POLICY` / `CREATE POLICY`, `caller_owns_document(id)`
left in place, new arm added).

**The 5 affected documents** — re-derived from live data (query below),
confirming the task doc's count of 5:
```sql
SELECT DISTINCT d.id, d.contact_id AS doc_owner, dp.contact_id AS party_contact, dp.party_role, dp.is_signer
FROM documents d JOIN document_parties dp ON dp.document_id = d.id
WHERE d.status='EXECUTED' AND d.deleted_at IS NULL
  AND dp.contact_id IS DISTINCT FROM d.contact_id;
```
```
 document_id                          | doc_owner  | party_contact | party_role  | is_signer
 ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | 352c3898…  | d99f1472…     | LESSOR      | t   (real typed signature on file)
 1c8bedd1-66d4-4c8f-8e73-f59948b4d5e5 | 41c5dae9…  | 3c23bb7f…     | PARTICIPANT | f
 2421efb3-3e94-4516-a283-1e029b44afce | 41c5dae9…  | 3c23bb7f…     | PARTICIPANT | f
 a55b8149-3cb1-42db-994e-c419005fb88b | 41c5dae9…  | 3c23bb7f…     | PARTICIPANT | f
 d1258405-f846-49b8-9e19-73f0ee328f83 | 41c5dae9…  | 3c23bb7f…     | PARTICIPANT | f
```
The four `PARTICIPANT` rows are Gabriella Olenik, a minor contact with no
login (`profiles` has no row for her — consistent with `TASK-C10`'s
guardian-addressed-delivery work from earlier the same day); her guardian
Brian Olenik (`41c5dae9…`, the documents' `contact_id`) signed on her behalf,
so `is_signer=false` for her party row even though she's the person the
document is legally about and who should be able to see it. The LESSOR row
is a genuine self-signed party (`is_signer=true`, real `signatures` row).
`caller_is_document_party` doesn't filter on `is_signer`, so both shapes are
covered by the same fix.

## 2. Migration — `supabase/migrations/20260804160000_party_document_visibility.sql`

1. **`documents_select`** — `DROP POLICY` / `CREATE POLICY`, adding
   `OR caller_is_document_party(id)` as a fourth arm. `caller_owns_document`
   and the horse-read arm are untouched.
2. **`my_documents()`** — `CREATE OR REPLACE` (return type unchanged, so no
   `DROP FUNCTION` needed, per the task's "unchanged if possible" and the
   20260804110000 precedent for when a `DROP` *would* be required). The
   "pending" and "executed" branches' `WHERE` clauses change from
   `d.contact_id = current_contact_id()` to `(d.contact_id =
   current_contact_id() OR caller_is_document_party(d.id))`. Applied to both
   branches, not just "executed": the locked design's wording ("rows where
   the caller is the owner OR a party via document_parties") is stated
   generally, not scoped to executed-only, and a party who hasn't signed yet
   still has legitimate reason to see the document listed. The "assigned"
   branch is untouched (no document row to be a party on yet). No duplicate
   rows: `caller_is_document_party` is used as a boolean predicate in the
   `WHERE` clause (not a join), so each branch still emits at most one row
   per `document.id`.

### Dry-run, then apply

```sql
BEGIN;
\i supabase/migrations/20260804160000_party_document_visibility.sql
SELECT * FROM my_documents() LIMIT 0;   -- column list check
SELECT policyname, qual FROM pg_policies WHERE tablename='documents' AND policyname='documents_select';
ROLLBACK;
```
→ `CREATE FUNCTION` / `DROP POLICY` / `CREATE POLICY` all succeeded; column
list unchanged; `qual` showed the new OR-arm. `ROLLBACK` — nothing persisted.

**Applied for real**: `psql -v ON_ERROR_STOP=1 -f
supabase/migrations/20260804160000_party_document_visibility.sql` — same
three statements, no errors.

**Post-apply verification** — `documents_select` now reads:
```
is_admin() OR caller_owns_document(id) OR caller_is_document_party(id)
  OR (horse_id IS NOT NULL AND client_can_read_horse(horse_id))
```
and a re-query of the 4 dependent policies confirms `document_deliveries_select`,
`signatures_select`, and `signatures_insert_self` are byte-identical to their
pre-migration text — the helper itself was not touched.

## 3. Live proofs (raw psql against production, all simulated sessions rolled back)

Simulation technique: `SET LOCAL ROLE authenticated; SET LOCAL
request.jwt.claims = '{"sub":"<user_id>"}'` inside `BEGIN;…ROLLBACK;` —
`current_contact_id()` resolves via `profiles.user_id = auth.uid()`, and
`auth.uid()` reads `request.jwt.claims->>'sub'`.

**Positive — LESSOR** (`cjzigs@icloud.com`'s test profile, `user_id
0a7fc801-…`, already points `contact_id → d99f1472-…` — no repoint needed):
```
 current_contact_id = d99f1472-48b4-466e-aaa7-f76396745c17
 my_documents contains ecaecd42       = t
 direct SELECT on documents (ecaecd42) = 1 row, current_status='signed'
```

**Negative — unrelated contact** (`zz-test-buyer@example.invalid`, `user_id
aaaa1111-…-002`, not a party on any of the 5 documents):
```
 current_contact_id = 753f5b74-b1fd-4b33-8c3a-aaba1357d371
 caller_is_document_party(ecaecd42) = f
 my_documents contains ecaecd42     = f
 direct SELECT row count            = 0
```

**Write-gate — UPDATE, LESSOR as party-not-owner**:
```
UPDATE documents SET title = title || ' [write-gate-test]' WHERE id='ecaecd42-…';
→ UPDATE 0
```
Zero rows touched — the LESSOR can now read the row but still cannot write
it (no UPDATE-permissive policy other than `documents_admin_write`, gated on
`is_admin()`, applies to them).

**Write-gate — INSERT into `signatures`, LESSOR as party-not-owner**
(corroborating that the untouched `caller_owns_document`-gated write path is
unaffected):
```
INSERT INTO signatures (document_id, signer_contact_id, party_role, typed_name, signed_at, method)
VALUES ('ecaecd42-…', current_contact_id(), 'LESSOR', 'write-gate-test', now(), 'typed');
→ ERROR: new row violates row-level security policy for table "signatures"
```
`signatures_insert_self`'s `caller_owns_document(document_id)` check still
correctly rejects the LESSOR (they are not `documents.contact_id` on this
row) — proof that the helper's semantics, and everything gated on it, are
unchanged.

**5-document check** — LESSOR doc (`ecaecd42`) proven above. The 4
Gabriella/PARTICIPANT docs were checked by temporarily repointing the
`cjzigs` test profile's `contact_id` to Gabriella's contact inside the same
`BEGIN;…ROLLBACK;` block used for the read (never committed — verified by
re-querying `profiles` immediately after, which still shows `contact_id =
d99f1472-…`, the original LESSOR contact):
```sql
BEGIN;
UPDATE profiles SET contact_id = '3c23bb7f-…' WHERE user_id = '0a7fc801-…';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"0a7fc801-…"}';
-- current_contact_id() = 3c23bb7f-… (Gabriella)
SELECT d.id, EXISTS(SELECT 1 FROM my_documents() m WHERE m.document_id=d.id) FROM (VALUES (...4 ids...)) AS d(id);
ROLLBACK;
```
```
 1c8bedd1-66d4-4c8f-8e73-f59948b4d5e5 | t
 2421efb3-3e94-4516-a283-1e029b44afce | t
 a55b8149-3cb1-42db-994e-c419005fb88b | t
 d1258405-f846-49b8-9e19-73f0ee328f83 | t
```
All 4 visible; profile repoint confirmed rolled back afterward.

All 5/5 affected documents now resolve visible to their mismatched
party/signer.

## 4. `docs/BUILD_TRACKER.md`

A17 changed from **FAIL** to **PARTIAL — server-side fix verified, browser
pending**, describing the fix, the dependents-check reasoning, and the live
proofs above; explicitly states no browser click has confirmed the Documents
page renders this (that's the re-verify pass's call, not claimed here). A18
and A19 changed from **FAIL** (cascading from A17) to the same **PARTIAL**
status, since the underlying row-load is now unblocked. LESSEE side (company
party) remains **BLOCKED** on both, unrelated to this task — see A7.

## 5. Done-checks

- `npm install` (fresh worktree, no shared `node_modules`).
- `npm run typecheck` — 0 errors.
- `npm run typecheck:api` — 0 errors.
- `npm run lint` — **0 errors, 29 warnings**, matching the documented
  baseline exactly; this task touched no `.ts`/`.tsx` files, only SQL and
  docs.
- Live proofs: §3, all reproduced above.

## 6. Production writes (everything logged)

1. The one migration, `20260804160000_party_document_visibility.sql` —
   dry-run in `BEGIN;…ROLLBACK;`, then applied live via `psql -v
   ON_ERROR_STOP=1 -f …` (§2).

Everything else against production was either read-only (`\d`,
`pg_get_functiondef`, `pg_policies`, `SELECT`) or ran inside
`BEGIN;…ROLLBACK;` blocks that were rolled back and independently
re-verified as leaving no residue (the `signatures_insert_self` INSERT
attempt errored before commit was possible; the `profiles.contact_id`
repoint was re-queried post-rollback and confirmed reverted). No document
was deleted, superseded, or otherwise mutated. No UI file was touched.

## Honesty notes

- Every command output quoted above is what was actually returned by psql
  against `db.lrstswfxfsezdmvkvukc.supabase.co` — nothing is paraphrased
  from assumption.
- The "5 documents" figure was independently re-derived from live data
  (§1), not taken on the task doc's word alone, and matches.
- `my_documents()`'s "pending" branch was widened alongside "executed" as a
  reading of the locked design's general wording; this is a judgment call
  beyond the literal bug report (which was specifically about executed
  documents) and is called out here rather than silently bundled in.
- Browser/UI verification of A17–A19 was explicitly out of scope for this
  task (no UI changes allowed) and is not claimed — `BUILD_TRACKER.md`
  states PARTIAL, matching the task's instruction not to claim the page
  works.
