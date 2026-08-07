# TASK SIGREAD — a signer cannot see their own signature

The third and last known bug in the party-read family. Small, well understood, and it
produces a **visibly wrong document state** for real parties today.

---

## The defect (verified against prod by the orchestrator, 2026-08-06)

`signatures_select` is:

```sql
is_admin() OR (deleted_at IS NULL AND caller_owns_document(document_id))
```

There is **no** `signer_contact_id = current_contact_id()` clause. So a party who signed a
document but does not *own* it cannot read their own signature row. On every lease this is
the LESSOR — and on reverse-direction leases it is FHE's counterparty.

Confirmed live: CJ (a real non-staff signer) has **7 signature rows**, invisible to his own
session on documents he does not own.

### Why it matters now, not eventually

`TASK-PARTYRLS` (merged, `ac70e14`) fixed `document_parties`, so a party's Documents page
now renders the document. But the "signed" state is computed from `signatures` — which
they still cannot read. **The page will show a document they have genuinely signed as
unsigned.** The previous bug hid the problem; fixing it exposed this one.

### The family, for context

| Table | Status |
|---|---|
| `documents` / `my_documents()` | Fixed — TASK-DOCVIS |
| `document_parties` | Fixed — TASK-PARTYRLS (`ac70e14`) |
| `document_deliveries` | Never broken — already had `recipient_contact_id = current_contact_id()` |
| **`signatures`** | **This task** |

---

## The fix

One permissive SELECT policy on `signatures`, mirroring the shape just proven on
`document_parties`:

```sql
signer_contact_id = current_contact_id()
```

Confirm the column name yourself before writing — do not trust this doc. Keep
`deleted_at IS NULL` consistent with the neighbouring policy if that is the established
pattern.

**Do not touch `caller_owns_document`.** It is used on write paths; DOCVIS deliberately
left it alone for that reason.

---

## Verify, do not assert

The failure mode here is silent: RLS returns zero rows with no error, so "the query ran"
proves nothing.

1. **Reproduce first.** As a real non-staff signer, count visible signature rows on a
   document they signed but do not own. Expect 0. Capture it.
2. Apply the migration — dry-run in `BEGIN … ROLLBACK` with raw output shown, then apply.
3. **Prove the fix.** Same session, same query: the signer now sees exactly their own
   rows.
4. **Prove the boundary held.** A query scoped to a *different* contact still returns 0 —
   the policy must not open other people's signatures.
5. **Prove staff is unchanged.** Staff row count identical before and after.
6. **Prove the user-visible outcome.** The party's Documents page now reflects the
   document as signed. This is the actual point of the task; a policy that is correct but
   does not fix the display is not done.

Use CJ (`cjzigs@icloud.com`) — a real, owner-controlled, non-staff identity with 7
signature rows.

## Constraints

- Own git worktree off `origin/main`.
- **`ClauseDocument.tsx` is FROZEN.**
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.
- If the fix appears to need anything beyond one SELECT policy, **stop and report**
  rather than widening scope. The previous thread in this family did exactly that, and it
  was the right call.

## Reporting

`docs/reports/TASK-SIGREAD-REPORT.md`, with raw before/after output for every claim above.
State what you verified with your own eyes versus what you assume.
