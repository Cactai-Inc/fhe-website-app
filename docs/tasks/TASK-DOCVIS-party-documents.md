# TASK DOCVIS — parties see documents they signed (multi-party visibility fix)

Production bug, root-caused by the party-verify pass (2026-08-04) and independently confirmed
by the orchestrator: `my_documents()` and the `documents_select` RLS policy (via
`caller_owns_document`) check ONLY `documents.contact_id = current_contact_id()` — neither
considers `document_parties`. `documents.contact_id` is a single-owner column; on the reference
lease it holds the LESSEE, so the LESSOR (a genuine signer, `is_signer=true` in
`document_parties`) sees nothing on their Documents page. **5 currently-EXECUTED production
documents have at least one signer whose contact differs from `documents.contact_id`.**
`caller_is_document_party(...)` already exists and is used correctly elsewhere
(e.g. `document_shares_party_read`).

## Locked design

Add a `document_parties`-based OR to BOTH gates — nothing else:
1. `my_documents()`: rows where the caller is the owner (`contact_id`) OR a party via
   `document_parties` (reuse `caller_is_document_party`'s logic or the helper itself —
   whichever composes; read the helper's prosrc and signature first). No duplicate rows when
   the caller is both (DISTINCT or equivalent).
2. `caller_owns_document(...)` — or, if that helper is used by WRITE paths too (CHECK the
   dependents: `SELECT ... FROM pg_proc WHERE prosrc LIKE '%caller_owns_document%'` and every
   policy on `documents`), do NOT widen the helper itself; instead widen ONLY the
   `documents_select` RLS policy with an OR on `caller_is_document_party(id)`. Party status
   must grant READ, never write/delete. State explicitly in the report which shape you used
   and prove the write paths kept their original gate.

## Work items
1. Read first: prosrc of `my_documents`, `caller_owns_document`, `caller_is_document_party`;
   every policy on `documents` (`\d documents` policies section + `pg_policies`); every
   function referencing `caller_owns_document`. Record in the report.
2. One migration implementing the locked design. `my_documents` return type unchanged if
   possible; if the RETURNS TABLE must change, DROP+recreate per the 20260804110000 precedent.
   Dry-run `BEGIN;...ROLLBACK;`, apply, verify.
3. Live proof, raw psql:
   - Simulated session as LESSOR contact `d99f1472-...` (the cjzigs USER profile links to it
     directly — no repoint needed; `SET LOCAL request.jwt.claims` technique): `my_documents()`
     now returns the executed lease `ecaecd42-...`; direct
     `SELECT ... FROM documents WHERE id='ecaecd42-...'` passes RLS.
   - Negative: an unrelated non-party contact still gets zero rows for that document (pick a
     real unrelated test contact, simulate, show empty).
   - Write-gate proof: as the LESSOR (party, not owner), an UPDATE on that document is still
     rejected by RLS/guards exactly as before (rolled back).
   - The 5-document check: after the fix, for each of the 5 affected executed documents, the
     mismatched signer's simulated session sees the row via `my_documents()` (loop or spot-
     check all 5; list document ids).
4. Update `docs/BUILD_TRACKER.md` A17 (and A18/A19 notes) to reflect: server-side visibility
   fixed, browser re-verification pending. Do not claim the page works — that's the re-verify
   pass's call.

## Rules
- Branch `task/docvis-party-documents` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-docvis -b task/docvis-party-documents origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB: the ONLY write is the one migration + rolled-back proofs. Everything logged.
- NO UI changes. `ClauseDocument.tsx` FROZEN. Signed documents never deleted.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors) + all live proofs above.
- Report: `docs/reports/TASK-DOCVIS-REPORT.md`, committed + pushed. Print ONLY the report path.
